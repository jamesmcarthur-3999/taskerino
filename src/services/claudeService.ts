import { invoke } from '@tauri-apps/api/core';
import type {
  AIProcessResult,
  AIQueryResponse,
  Topic,
  Note,
  Task,
  AppState,
  Attachment,
} from '../types';
import type {
  ClaudeChatResponse,
  ClaudeMessage,
  ClaudeContentBlock,
  ClaudeImageSource,
} from '../types/tauri-ai-commands';
import {
  findMatchingTopic,
  calculateMatchConfidence,
  findSimilarNotes,
} from '../utils/helpers';
import { LearningService } from './learningService';
import { fileStorage } from './fileStorageService';

export class ClaudeService {
  private hasApiKey: boolean = false;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.setApiKey(apiKey);
    } else {
      // Auto-load API key from storage if available
      this.loadApiKeyFromStorage();
    }
  }

  private async loadApiKeyFromStorage() {
    try {
      const savedKey = await invoke<string | null>('get_claude_api_key');
      if (savedKey) {
        this.hasApiKey = true;
        console.log('✅ Loaded API key from storage');
      }
    } catch (error) {
      console.error('Failed to load API key from storage:', error);
    }
  }

  async setApiKey(apiKey: string) {
    try {
      await invoke('set_claude_api_key', { apiKey });
      this.hasApiKey = true;
    } catch (error) {
      console.error('Failed to set API key:', error);
      throw error;
    }
  }

  /**
   * Main processing function: Analyzes text, detects topics, creates/merges notes, extracts tasks
   */
  async processInput(
    text: string,
    existingTopics: Topic[],
    existingNotes: Note[],
    settings: AppState['aiSettings'],
    userLearnings?: AppState['learnings'],
    learningSettings?: AppState['learningSettings'],
    existingTasks?: Task[],
    attachments?: Attachment[],
    extractTasks: boolean = true
  ): Promise<AIProcessResult> {
    if (!this.hasApiKey) {
      throw new Error('API key not set. Please configure your Claude API key in Settings.');
    }

    const processingSteps: string[] = [];

    // Step 1: Analyze text with AI
    processingSteps.push('Analyzing text...');

    const topicList = existingTopics.map(t => t.name).join(', ') || 'None yet';

    // Get recent notes for context (last 10 notes)
    const recentNotes = existingNotes
      .slice(-10)
      .map(n => {
        const topic = existingTopics.find(t => t.id === n.topicId);
        return `[${topic?.name || 'Unknown'}] ${n.summary}`;
      })
      .join('\n');

    // Get recent tasks to avoid duplicates (last 20 tasks)
    const recentTasks = existingTasks
      ?.slice(-20)
      .map(t => `- "${t.title}" (${t.priority}, ${t.dueDate ? `due ${t.dueDate}` : 'no due date'})`)
      .join('\n') || 'None yet';

    // Get applicable learnings
    let learningsSection = '';
    if (userLearnings && learningSettings && learningSettings.enabled) {
      const learningService = new LearningService(userLearnings, learningSettings);
      const applicableLearnings = learningService.getApplicableLearnings();

      if (applicableLearnings.length > 0) {
        learningsSection = `

**USER-SPECIFIC LEARNINGS:**
${learningService.formatForPrompt(applicableLearnings)}

**How to apply learnings:**
- ✅ RULE (${learningSettings.thresholds.rule}%+): Must follow strictly - these are established user preferences
- 📊 PATTERN (${learningSettings.thresholds.active}-${learningSettings.thresholds.rule - 1}%): Should follow unless context clearly contradicts
- 🔬 OBSERVATION (<${learningSettings.thresholds.active}%): Consider as suggestion, use judgment
- [USER-FLAGGED]: User explicitly wants this learned faster - prioritize

When creating tasks, due dates, priorities, and tags, check learnings first.
`;
      }
    }

    const attachmentInfo = attachments && attachments.length > 0
      ? `\n\n**Attachments (${attachments.length}):**
${attachments.map(a => `- ${a.name} (${a.type}, ${a.mimeType})`).join('\n')}

**IMPORTANT - Image Analysis:**
If images are attached, analyze them carefully:
1. Extract any visible text (OCR)
2. Identify key visual elements (diagrams, charts, UI elements, etc.)
3. Describe what the image shows in context of the text
4. Extract any actionable items or important information from the images
5. Incorporate image insights into your topic detection and task extraction

Images may contain:
- Screenshots of applications, dashboards, or UIs
- Diagrams or flowcharts explaining systems
- Handwritten or printed notes
- Charts, graphs, or data visualizations
- Product mockups or designs
`
      : '';

    const prompt = `<system_instructions>
${settings.systemInstructions}
</system_instructions>
${learningsSection}

<existing_data>
Topics: ${topicList}

Recent Notes:
${recentNotes || 'No recent notes'}

Existing Tasks (check for duplicates):
${recentTasks}
</existing_data>

<user_input>
${text}
</user_input>
${attachmentInfo}

<core_rules>
1. Topic Hierarchy: PRIMARY (Customer/Company) > SECONDARY (People) > TERTIARY (Features/Tech)
2. Note Consolidation: ONE comprehensive note per customer/topic from each input
3. Update vs Create: Check if recent note exists for same topic before creating new
4. Duplicate Detection: Check existing tasks; if duplicate, add to skippedTasks array with reason
5. Task Extraction: Create SEPARATE task for EACH distinct action item mentioned
</core_rules>

<task_requirements>
For EVERY task, provide ALL fields:
- title: Clear, actionable
- description: REQUIRED, 1-2 sentences (never empty/null)
- sourceExcerpt: REQUIRED, exact quote from input (never empty/null)
- dueDate + dueTime: If temporal context exists, BOTH required (18:00 for EOD, 09:00 for morning)
- dueDateReasoning: Why this date/time chosen
- tags: 2-4 relevant tags
- priority: high/medium/low
- suggestedSubtasks: If multi-step task
</task_requirements>

<note_structure>
Use markdown with:
- ## for headers (Context, Discussion, Decisions, Next Steps)
- **bold** for key terms/names
- Bullet lists (-) and numbered lists (1. 2. 3.)
- Clear sections for scanability
</note_structure>

<output_schema>
{
  "inputType": "call_transcript" | "meeting_note" | "quick_note",
  "primaryTopic": {"name": "", "type": "company", "confidence": 0.95, "matchedExisting": ""},
  "secondaryTopics": [{"name": "", "type": "person", "relationTo": ""}],
  "noteStrategy": {"action": "create"|"update", "shouldConsolidate": true, "updateNoteId": ""},
  "note": {
    "content": "## Context\n\n...\n\n## Discussion Points\n\n...\n\n## Next Steps\n\n...",
    "summary": "One-line summary (max 100 chars)",
    "topicAssociation": "",
    "tags": ["tag1", "tag2"],
    "source": "call"|"email"|"thought"|"other",
    "sentiment": "positive"|"neutral"|"negative",
    "keyPoints": ["Point 1", "Point 2"],
    "relatedTopics": ["Topic 1"]
  },
  "tasks": [
    {
      "title": "",
      "priority": "high",
      "dueDate": "2025-10-05",
      "dueTime": "18:00",
      "dueDateReasoning": "",
      "description": "",
      "tags": [],
      "suggestedSubtasks": [],
      "sourceExcerpt": "",
      "relatedTo": ""
    }
  ],
  "skippedTasks": [{"title": "", "reason": "duplicate", "existingTaskTitle": "", "sourceExcerpt": ""}],
  "tags": [],
  "sentiment": "positive"
}
</output_schema>

<temporal_context>
${(() => {
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return `${dayOfWeek}, ${monthDay} at ${currentTime}
ISO Date: ${now.toISOString().split('T')[0]}
Business Hours: 09:00-18:00 | EOD: 18:00`;
})()}

Date Inference:
- "EOD today" → ${new Date().toISOString().split('T')[0]} at 18:00
- "tomorrow" → ${new Date(Date.now() + 86400000).toISOString().split('T')[0]} at 09:00
- "by Friday"/"end of week" → Next Friday at 18:00
- "next week" → Next Monday at 09:00
- "ASAP"/"urgent" → today
- No context → null
</temporal_context>

<example>
Input: "Follow up with Sarah about pricing, send proposal EOD Friday"
Output tasks:
[
  {
    "title": "Follow up with Sarah about pricing",
    "description": "Follow up with Sarah regarding pricing discussion.",
    "sourceExcerpt": "Follow up with Sarah about pricing",
    "dueDate": null,
    "dueTime": null,
    "dueDateReasoning": "No specific deadline",
    "priority": "medium",
    "tags": ["follow-up", "pricing"]
  },
  {
    "title": "Send proposal",
    "description": "Send proposal by end of day Friday.",
    "sourceExcerpt": "send proposal EOD Friday",
    "dueDate": "[Friday]",
    "dueTime": "18:00",
    "dueDateReasoning": "EOD Friday specified",
    "priority": "high",
    "tags": ["proposal"]
  }
]
</example>

Return valid JSON only (no markdown).`;

    try {
      // Build content array with prompt caching enabled
      // Split prompt into cacheable static instructions and dynamic user input
      const staticInstructions = `<system_instructions>
${settings.systemInstructions}
</system_instructions>
${learningsSection}

<core_rules>
1. Topic Hierarchy: PRIMARY (Customer/Company) > SECONDARY (People) > TERTIARY (Features/Tech)
2. Note Consolidation: ONE comprehensive note per customer/topic from each input
3. Update vs Create: Check if recent note exists for same topic before creating new
4. Duplicate Detection: Check existing tasks; if duplicate, add to skippedTasks array with reason
5. Task Extraction: Create SEPARATE task for EACH distinct action item mentioned
</core_rules>

<task_requirements>
For EVERY task, provide ALL fields:
- title: Clear, actionable
- description: REQUIRED, 1-2 sentences (never empty/null)
- sourceExcerpt: REQUIRED, exact quote from input (never empty/null)
- dueDate + dueTime: If temporal context exists, BOTH required (18:00 for EOD, 09:00 for morning)
- dueDateReasoning: Why this date/time chosen
- tags: 2-4 relevant tags
- priority: high/medium/low
- suggestedSubtasks: If multi-step task
</task_requirements>

<note_structure>
Use markdown with:
- ## for headers (Context, Discussion, Decisions, Next Steps)
- **bold** for key terms/names
- Bullet lists (-) and numbered lists (1. 2. 3.)
- Clear sections for scanability
</note_structure>

<output_schema>
{
  "inputType": "call_transcript" | "meeting_note" | "quick_note",
  "primaryTopic": {"name": "", "type": "company", "confidence": 0.95, "matchedExisting": ""},
  "secondaryTopics": [{"name": "", "type": "person", "relationTo": ""}],
  "noteStrategy": {"action": "create"|"update", "shouldConsolidate": true, "updateNoteId": ""},
  "note": {
    "content": "## Context\n\n...\n\n## Discussion Points\n\n...\n\n## Next Steps\n\n...",
    "summary": "One-line summary (max 100 chars)",
    "topicAssociation": "",
    "tags": ["tag1", "tag2"],
    "source": "call"|"email"|"thought"|"other",
    "sentiment": "positive"|"neutral"|"negative",
    "keyPoints": ["Point 1", "Point 2"],
    "relatedTopics": ["Topic 1"]
  },
  "tasks": [
    {
      "title": "",
      "priority": "high",
      "dueDate": "2025-10-05",
      "dueTime": "18:00",
      "dueDateReasoning": "",
      "description": "",
      "tags": [],
      "suggestedSubtasks": [],
      "sourceExcerpt": "",
      "relatedTo": ""
    }
  ],
  "skippedTasks": [{"title": "", "reason": "duplicate", "existingTaskTitle": "", "sourceExcerpt": ""}],
  "tags": [],
  "sentiment": "positive"
}
</output_schema>

<temporal_context>
${(() => {
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return `${dayOfWeek}, ${monthDay} at ${currentTime}
ISO Date: ${now.toISOString().split('T')[0]}
Business Hours: 09:00-18:00 | EOD: 18:00`;
})()}

Date Inference:
- "EOD today" → ${new Date().toISOString().split('T')[0]} at 18:00
- "tomorrow" → ${new Date(Date.now() + 86400000).toISOString().split('T')[0]} at 09:00
- "by Friday"/"end of week" → Next Friday at 18:00
- "next week" → Next Monday at 09:00
- "ASAP"/"urgent" → today
- No context → null
</temporal_context>

<example>
Input: "Follow up with Sarah about pricing, send proposal EOD Friday"
Output tasks:
[
  {
    "title": "Follow up with Sarah about pricing",
    "description": "Follow up with Sarah regarding pricing discussion.",
    "sourceExcerpt": "Follow up with Sarah about pricing",
    "dueDate": null,
    "dueTime": null,
    "dueDateReasoning": "No specific deadline",
    "priority": "medium",
    "tags": ["follow-up", "pricing"]
  },
  {
    "title": "Send proposal",
    "description": "Send proposal by end of day Friday.",
    "sourceExcerpt": "send proposal EOD Friday",
    "dueDate": "[Friday]",
    "dueTime": "18:00",
    "dueDateReasoning": "EOD Friday specified",
    "priority": "high",
    "tags": ["proposal"]
  }
]
</example>

Return valid JSON only (no markdown).`;

      const dynamicContext = `
<existing_data>
Topics: ${topicList}

Recent Notes:
${recentNotes || 'No recent notes'}

Existing Tasks (check for duplicates):
${recentTasks}
</existing_data>

<user_input>
${text}
</user_input>
${attachmentInfo}`;

      // Build content blocks with prompt caching
      // Cache the static instructions (system rules, schema, examples)
      // Keep dynamic data (user input, existing data) uncached
      const contentBlocks: ClaudeContentBlock[] = [
        {
          type: 'text',
          text: staticInstructions,
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: dynamicContext
        }
      ];

      // Add image attachments to content blocks
      if (attachments && attachments.length > 0) {
        console.log('🖼️ Processing', attachments.length, 'attachments for Claude API');
        for (const attachment of attachments) {
          console.log('📎 Processing attachment:', {
            id: attachment.id,
            type: attachment.type,
            name: attachment.name,
            hasThumbnail: !!attachment.thumbnail,
            hasPath: !!attachment.path,
          });

          if (attachment.type === 'image' || attachment.type === 'screenshot') {
            try {
              let base64Data: string;

              // Get base64 from thumbnail or read from file
              if (attachment.thumbnail && attachment.thumbnail.startsWith('data:image')) {
                console.log('✅ Using thumbnail data for', attachment.name);
                // Extract base64 from data URL
                base64Data = attachment.thumbnail.split(',')[1];
              } else if (attachment.path) {
                console.log('📄 Reading from file path:', attachment.path);
                // Read file and convert to base64
                const fileData = await fileStorage.readAttachment(attachment.path);
                base64Data = fileStorage.uint8ArrayToBase64(fileData);
                console.log('✅ Read', fileData.length, 'bytes from file');
              } else {
                console.warn('⚠️ Skipping attachment - no thumbnail or path:', attachment.name);
                continue; // Skip if no data available
              }

              // Determine media type
              const mediaType = attachment.mimeType.startsWith('image/')
                ? attachment.mimeType
                : 'image/png';

              console.log('✅ Adding image to Claude API request:', {
                name: attachment.name,
                mediaType,
                base64Length: base64Data.length,
              });

              const imageSource: ClaudeImageSource = {
                type: 'base64',
                mediaType: mediaType,
                data: base64Data,
              };

              contentBlocks.push({
                type: 'image',
                source: imageSource,
              });
            } catch (error) {
              console.error('❌ Failed to load image attachment:', error);
              // Continue processing without this image
            }
          }
        }
        console.log('✅ Total content blocks to send to Claude:', contentBlocks.length, '(2 text blocks +', contentBlocks.length - 2, 'images)');
      }

      // Build messages array
      const messages: ClaudeMessage[] = [
        { role: 'user', content: contentBlocks }
      ];

      const response = await invoke<ClaudeChatResponse>('claude_chat_completion_vision', {
        model: 'claude-sonnet-4-5-20250929', // Latest model - Claude Sonnet 4.5
        maxTokens: 64000, // Claude Sonnet 4.5 max output limit (2025)
        messages,
        system: undefined,
        temperature: undefined,
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const responseText = content.text.trim();
      let jsonText = responseText;

      // Try multiple extraction strategies for JSON from Claude's response
      // Strategy 1: Extract from markdown code blocks (```json or ```)
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }
      // Strategy 2: If no code blocks, try to find JSON object/array directly
      else if (!responseText.startsWith('{') && !responseText.startsWith('[')) {
        const objectMatch = responseText.match(/(\{[\s\S]*\})/);
        const arrayMatch = responseText.match(/(\[[\s\S]*\])/);
        if (objectMatch) {
          jsonText = objectMatch[1];
        } else if (arrayMatch) {
          jsonText = arrayMatch[1];
        }
      }

      let aiResponse;
      try {
        aiResponse = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Failed to parse Claude response as JSON');
        console.error('Parse error:', parseError);
        console.error('Attempted to parse:', jsonText.substring(0, 500));
        console.error('Full response (first 1000 chars):', responseText.substring(0, 1000));

        throw new Error(
          `Failed to parse AI response as JSON. Claude may have returned text instead of structured data. ` +
          `Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. ` +
          `Response preview: ${responseText.substring(0, 100)}...`
        );
      }

      // DEBUG: Log full AI response for analysis
      console.group('🤖 AI Response Analysis');
      console.log('Input length:', text.length, 'characters');
      console.log('Input type:', aiResponse.inputType || 'unknown');
      console.log('Primary topic:', aiResponse.primaryTopic?.name || 'None');
      console.log('Secondary topics:', aiResponse.secondaryTopics?.length || 0);
      console.log('Note strategy:', aiResponse.noteStrategy?.action || 'create');
      console.log('Overall sentiment:', aiResponse.sentiment || 'unknown');
      console.log('Overall tags:', aiResponse.tags?.join(', ') || 'none');

      if (aiResponse.note) {
        console.group('📝 Note Details:');
        console.log({
          hasSummary: !!aiResponse.note.summary,
          summaryLength: aiResponse.note.summary?.length || 0,
          hasContent: !!aiResponse.note.content,
          contentLength: aiResponse.note.content?.length || 0,
          hasTags: !!aiResponse.note.tags,
          tagsCount: aiResponse.note.tags?.length || 0,
          tags: aiResponse.note.tags?.join(', ') || 'none',
          source: aiResponse.note.source || 'not set',
          sentiment: aiResponse.note.sentiment || 'not set',
          hasKeyPoints: !!aiResponse.note.keyPoints,
          keyPointsCount: aiResponse.note.keyPoints?.length || 0,
          hasRelatedTopics: !!aiResponse.note.relatedTopics,
          relatedTopicsCount: aiResponse.note.relatedTopics?.length || 0,
        });
        console.groupEnd();
      }

      console.log('Tasks extracted:', aiResponse.tasks?.length || 0);
      if (aiResponse.tasks && aiResponse.tasks.length > 0) {
        console.group('📋 Task Details:');
        aiResponse.tasks.forEach((task: any, i: number) => {
          console.log(`\nTask ${i + 1}:`, {
            title: task.title,
            priority: task.priority,
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            hasDescription: !!task.description,
            descriptionLength: task.description?.length || 0,
            hasSourceExcerpt: !!task.sourceExcerpt,
            hasTags: task.tags?.length > 0,
            tagsCount: task.tags?.length || 0,
            hasSubtasks: task.suggestedSubtasks?.length > 0,
            subtasksCount: task.suggestedSubtasks?.length || 0,
            hasDueDateReasoning: !!task.dueDateReasoning,
          });
        });
        console.groupEnd();
      }

      console.log('Skipped tasks:', aiResponse.skippedTasks?.length || 0);
      if (aiResponse.skippedTasks && aiResponse.skippedTasks.length > 0) {
        console.group('⏭️ Skipped Tasks (Duplicates):');
        aiResponse.skippedTasks.forEach((skipped: any, i: number) => {
          console.log(`\nSkipped ${i + 1}:`, {
            title: skipped.title,
            reason: skipped.reason,
            existingTaskTitle: skipped.existingTaskTitle,
            sourceExcerpt: skipped.sourceExcerpt,
          });
        });
        console.groupEnd();
      }
      console.groupEnd();

      // Step 2: Process PRIMARY topic first (most important)
      processingSteps.push('Identifying primary topic...');

      const topicResults = [];
      let primaryTopicResult = null;

      if (aiResponse.primaryTopic) {
        const primary = aiResponse.primaryTopic;
        const matchedTopic = findMatchingTopic(primary.name, existingTopics);

        if (matchedTopic) {
          const confidence = calculateMatchConfidence(primary.name, matchedTopic);
          primaryTopicResult = {
            name: matchedTopic.name,
            type: primary.type || 'company',
            confidence,
            existingTopicId: matchedTopic.id,
          };
        } else {
          // New primary topic
          primaryTopicResult = {
            name: primary.name,
            type: primary.type || 'company',
            confidence: 1.0,
          };
        }

        topicResults.push(primaryTopicResult);
      }

      // Step 3: Process SECONDARY topics (people, features, etc.)
      processingSteps.push('Detecting related topics...');

      if (aiResponse.secondaryTopics) {
        for (const secondary of aiResponse.secondaryTopics) {
          const matchedTopic = findMatchingTopic(secondary.name, existingTopics);

          if (matchedTopic) {
            topicResults.push({
              name: matchedTopic.name,
              type: secondary.type || 'other',
              confidence: calculateMatchConfidence(secondary.name, matchedTopic),
              existingTopicId: matchedTopic.id,
            });
          } else {
            // Create secondary topic
            topicResults.push({
              name: secondary.name,
              type: secondary.type || 'other',
              confidence: 1.0,
            });
          }
        }
      }

      // Step 4: Create ONE note for the primary topic
      processingSteps.push('Creating note...');

      const noteResults = [];

      if (primaryTopicResult && aiResponse.note) {
        const topicId = primaryTopicResult.existingTopicId || 'new';
        let mergedWith: string | undefined;
        let isNew = true;

        // Check if we should update an existing note
        if (aiResponse.noteStrategy?.action === 'update' && aiResponse.noteStrategy.updateNoteId) {
          mergedWith = aiResponse.noteStrategy.updateNoteId;
          isNew = false;
        } else if (settings.autoMergeNotes && primaryTopicResult.existingTopicId) {
          // Or check similarity with recent notes
          const similarNotes = findSimilarNotes(
            aiResponse.note.content,
            primaryTopicResult.existingTopicId,
            existingNotes,
            1 // last 1 day for call transcripts
          );

          if (similarNotes.length > 0) {
            mergedWith = similarNotes[0].id;
            isNew = false;
          }
        }

        noteResults.push({
          topicId,
          topicName: primaryTopicResult.name,
          content: aiResponse.note.content,
          summary: aiResponse.note.summary,
          sourceText: text, // Store original input for validation
          isNew,
          mergedWith,
          tags: aiResponse.note.tags || aiResponse.tags || [],
          source: (aiResponse.note.source || (aiResponse.inputType === 'call_transcript' ? 'call' : aiResponse.inputType === 'meeting_note' ? 'call' : 'thought')) as 'call' | 'email' | 'thought' | 'other' | undefined,
          sentiment: (aiResponse.note.sentiment || aiResponse.sentiment) as 'positive' | 'neutral' | 'negative' | undefined,
          keyPoints: aiResponse.note.keyPoints || [],
          relatedTopics: aiResponse.note.relatedTopics || aiResponse.secondaryTopics?.map((t: any) => t.name) || [],
        });
      }

      // Fallback: If no primary topic detected, create a "General" topic
      if (topicResults.length === 0) {
        topicResults.push({
          name: 'General Notes',
          type: 'other' as const,
          confidence: 1.0,
        });

        noteResults.push({
          topicId: 'new',
          topicName: 'General Notes',
          content: text,
          summary: 'Note added',
          sourceText: text, // Store original input
          isNew: true,
          tags: aiResponse.tags || [],
          source: 'thought' as const,
          sentiment: (aiResponse.sentiment || 'neutral') as 'positive' | 'neutral' | 'negative',
          keyPoints: [],
          relatedTopics: [],
        });
      }

      // Step 5: Extract tasks (all linked to primary topic)
      processingSteps.push('Extracting tasks...');

      const taskResults = extractTasks
        ? aiResponse.tasks?.map((task: any) => ({
            title: task.title,
            priority: task.priority || 'medium',
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            dueDateReasoning: task.dueDateReasoning,
            description: task.description,
            sourceExcerpt: task.sourceExcerpt,
            tags: task.tags || [],
            suggestedSubtasks: task.suggestedSubtasks || [],
            topicId: primaryTopicResult?.existingTopicId, // Link to primary topic
            noteId: undefined, // Will be set when saving
          })) || []
        : [];

      // Extract skipped/duplicate tasks
      const skippedTasks = aiResponse.skippedTasks?.map((skipped: any) => ({
        title: skipped.title,
        reason: skipped.reason || 'duplicate',
        existingTaskTitle: skipped.existingTaskTitle,
        sourceExcerpt: skipped.sourceExcerpt,
      })) || [];

      processingSteps.push('Done!');

      return {
        detectedTopics: topicResults,
        notes: noteResults,
        tasks: taskResults,
        skippedTasks: skippedTasks.length > 0 ? skippedTasks : undefined,
        sentiment: aiResponse.sentiment,
        keyTopics: aiResponse.tags || [],
        processingSteps,
      };
    } catch (error) {
      console.error('Error processing with Claude:', error);
      throw new Error(
        `Failed to process: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Query assistant: Ask questions about notes and topics
   */
  async queryAssistant(
    question: string,
    topics: Topic[],
    notes: Note[],
    tasks: Task[],
    settings: AppState['aiSettings']
  ): Promise<AIQueryResponse> {
    if (!this.hasApiKey) {
      throw new Error('API key not set. Please configure your Claude API key in Settings.');
    }

    // Build context from all data
    const context = topics.map(topic => {
      const topicNotes = notes.filter(n => n.topicId === topic.id).slice(0, 5);
      const topicTasks = tasks.filter(t => t.topicId === topic.id);

      return `
**${topic.name}** (${topic.noteCount} notes)

Recent Notes:
${topicNotes.map(n => `- [${new Date(n.timestamp).toLocaleDateString()}] ${n.summary}`).join('\n') || 'None'}

Open Tasks:
${topicTasks.filter(t => !t.done).map(t => `- ${t.title} (${t.priority})`).join('\n') || 'None'}
`;
    }).join('\n---\n');

    // Split into cacheable static instructions and dynamic data
    const staticQueryInstructions = `${settings.systemInstructions}

Provide a helpful, specific answer using the information above. Include which topics you're referencing and suggest follow-up questions if relevant.

Return ONLY valid JSON (no markdown):
{
  "answer": "Your detailed answer here",
  "sources": [
    {
      "type": "note",
      "id": "note-id",
      "excerpt": "relevant excerpt",
      "topicName": "Acme Corp"
    }
  ],
  "relatedTopics": ["topic-id-1", "topic-id-2"],
  "suggestedFollowUps": ["What about pricing?", "Any recent updates?"]
}`;

    const dynamicQueryContext = `
**Knowledge Base:**
${context}

**Question:** ${question}`;

    try {
      // Use content blocks with prompt caching
      const contentBlocks: ClaudeContentBlock[] = [
        {
          type: 'text',
          text: staticQueryInstructions,
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: dynamicQueryContext
        }
      ];

      const messages: ClaudeMessage[] = [
        { role: 'user', content: contentBlocks }
      ];

      const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
        request: {
          model: 'claude-sonnet-4-5-20250929', // Latest model - Claude Sonnet 4.5
          maxTokens: 64000, // Claude Sonnet 4.5 max output limit (2025)
          messages,
          system: undefined,
          temperature: undefined,
        }
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const responseText = content.text.trim();
      let jsonText = responseText;

      // Try multiple extraction strategies for JSON
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      } else if (!responseText.startsWith('{') && !responseText.startsWith('[')) {
        const objectMatch = responseText.match(/(\{[\s\S]*\})/);
        const arrayMatch = responseText.match(/(\[[\s\S]*\])/);
        if (objectMatch) {
          jsonText = objectMatch[1];
        } else if (arrayMatch) {
          jsonText = arrayMatch[1];
        }
      }

      let result;
      try {
        result = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Failed to parse query response as JSON');
        console.error('Parse error:', parseError);
        console.error('Response preview:', responseText.substring(0, 500));
        throw new Error(
          `Failed to parse query response. ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        );
      }

      return {
        answer: result.answer || 'I could not find an answer to that question.',
        sources: result.sources || [],
        relatedTopics: result.relatedTopics || [],
        suggestedFollowUps: result.suggestedFollowUps || [],
      };
    } catch (error) {
      console.error('Error querying with Claude:', error);
      throw new Error(
        `Failed to process query: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * AI-driven parameter optimization: Analyzes learning effectiveness and suggests adjustments
   */
  async optimizeLearningParameters(
    optimizationContext: string
  ): Promise<{
    shouldOptimize: boolean;
    reasoning: string;
    suggestedSettings?: Partial<AppState['learningSettings']>;
  }> {
    if (!this.hasApiKey) {
      throw new Error('API key not set. Please configure your Claude API key in Settings.');
    }

    // Split into cacheable static instructions and dynamic data
    const staticOptimizationInstructions = `**Your Task:**
Analyze the learning system performance and determine if parameter adjustments are needed.

**Decision Criteria:**
1. If accuracy is >80% and promotion rate is healthy (20-40%), system is working well - no changes needed
2. If accuracy is low (<60%), parameters may need adjustment
3. If promotion rate is too low (<10%), learnings may be too hard to promote
4. If promotion rate is too high (>60%), thresholds may be too lenient
5. If degradation rate is high (>30%), rejection penalty may be too harsh

**Output Format:**
Return ONLY valid JSON (no markdown):
{
  "shouldOptimize": true/false,
  "reasoning": "Explain why optimization is/isn't needed based on metrics",
  "suggestedSettings": {
    "confirmationPoints": 10,
    "rejectionPenalty": 20,
    "applicationBonus": 1,
    "flagMultiplier": 1.5,
    "timeDecayDays": 30,
    "timeDecayRate": 0.5,
    "thresholds": {
      "deprecated": 10,
      "active": 50,
      "rule": 80
    }
  }
}

Only include "suggestedSettings" if shouldOptimize is true. Make conservative adjustments (5-10% changes at most).`;

    try {
      // Use content blocks with prompt caching
      const contentBlocks: ClaudeContentBlock[] = [
        {
          type: 'text',
          text: staticOptimizationInstructions,
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: optimizationContext
        }
      ];

      const messages: ClaudeMessage[] = [
        { role: 'user', content: contentBlocks }
      ];

      const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
        request: {
          model: 'claude-sonnet-4-5-20250929',
          maxTokens: 64000, // Claude Sonnet 4.5 max output limit (2025)
          messages,
          system: undefined,
          temperature: undefined,
        }
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const responseText = content.text.trim();
      let jsonText = responseText;

      // Try multiple extraction strategies for JSON
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      } else if (!responseText.startsWith('{') && !responseText.startsWith('[')) {
        const objectMatch = responseText.match(/(\{[\s\S]*\})/);
        const arrayMatch = responseText.match(/(\[[\s\S]*\])/);
        if (objectMatch) {
          jsonText = objectMatch[1];
        } else if (arrayMatch) {
          jsonText = arrayMatch[1];
        }
      }

      let result;
      try {
        result = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Failed to parse optimization response as JSON');
        console.error('Parse error:', parseError);
        console.error('Response preview:', responseText.substring(0, 500));
        throw parseError;
      }

      return result;
    } catch (error) {
      console.error('Error optimizing parameters with Claude:', error);
      return {
        shouldOptimize: false,
        reasoning: 'Failed to analyze: ' + (error instanceof Error ? error.message : 'Unknown error'),
      };
    }
  }
}

export const claudeService = new ClaudeService();
