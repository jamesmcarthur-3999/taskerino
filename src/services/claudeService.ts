import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProcessResult,
  AIQueryResponse,
  Topic,
  Note,
  Task,
  AppState,
  Attachment,
} from '../types';
import {
  findMatchingTopic,
  calculateMatchConfidence,
  findSimilarNotes,
} from '../utils/helpers';
import { LearningService } from './learningService';
import { fileStorage } from './fileStorageService';

export class ClaudeService {
  private client: Anthropic | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    } else {
      // Auto-load API key from localStorage if available
      this.loadApiKeyFromStorage();
    }
  }

  private loadApiKeyFromStorage() {
    try {
      const savedKey = localStorage.getItem('claude-api-key');
      if (savedKey) {
        this.client = new Anthropic({ apiKey: savedKey, dangerouslyAllowBrowser: true });
        console.log('✅ Loaded API key from localStorage');
      }
    } catch (error) {
      console.error('Failed to load API key from storage:', error);
    }
  }

  setApiKey(apiKey: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
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
    if (!this.client) {
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

    const prompt = `${settings.systemInstructions}
${learningsSection}

**CRITICAL RULES:**
1. TOPIC HIERARCHY: Always associate content in this order:
   - PRIMARY: Customer/Company (most important)
   - SECONDARY: People mentioned in the conversation
   - TERTIARY: Features, products, or technologies discussed

2. NOTE CONSOLIDATION:
   - For call transcripts or long inputs: Create ONE comprehensive note for the primary customer
   - For quick notes: Create one focused note
   - NEVER create multiple notes from a single input unless it discusses completely separate customers

3. UPDATE vs CREATE:
   - If recent notes exist for the same customer/topic, consider updating rather than creating new
   - Look for notes from the same day or recent conversation threads

**Existing Topics:** ${topicList}

**Recent Notes (for context):**
${recentNotes || 'No recent notes'}

**Existing Tasks (do NOT create duplicates):**
${recentTasks}

**⚠️ IMPORTANT - Duplicate Detection & Reporting:**
Before creating any task, check if it already exists in the list above.
- If a task is very similar to an existing one (same title, same general topic), DO NOT add it to the tasks array
- Instead, add it to the skippedTasks array with the reason and existing task title
- This helps the user understand why certain tasks weren't created
- Only extract NEW tasks that aren't already in the system

**User Input:**
"""
${text}
"""${attachmentInfo}

**⚠️ CRITICAL - TASK EXTRACTION REQUIREMENTS ⚠️**

**STEP 1: Extract ALL tasks from input**
Read the entire input carefully and identify EVERY action item, follow-up, or to-do mentioned.
- If multiple tasks are listed (e.g., "follow up on X, Y, and Z"), create a SEPARATE task for EACH
- Don't combine multiple distinct actions into one task
- Look for phrases like "need to", "follow up", "send", "update", "schedule", "review", etc.

**STEP 2: For EVERY task, populate ALL required fields:**
1. title - Clear, actionable task title
2. description - REQUIRED, NEVER empty or null. 1-2 sentences of context.
3. sourceExcerpt - REQUIRED, NEVER empty. Exact quote from user input.
4. dueDate - If temporal context exists (EOD, tomorrow, Friday, etc.), calculate the date
5. dueTime - If dueDate is set, time is REQUIRED (use 18:00 for EOD, 09:00 for morning)
6. dueDateReasoning - Explain why this date/time was chosen
7. tags - 2-4 relevant tags
8. priority - high/medium/low based on urgency
9. suggestedSubtasks - If multi-step, break into subtasks

**Example:** "I need to follow up with NVIDIA on contract costs, M365 updates, and email an update EOD tomorrow"
→ Should create 3 SEPARATE tasks, each with description, sourceExcerpt, date, time, etc.

**Analysis Instructions:**

1. **Identify Primary Topic**: What is the MAIN customer/company this input is about? Match to existing topics if possible.

2. **Identify Secondary Topics**: Who are the people mentioned? What features/technologies discussed?

3. **Input Type**: Is this a call transcript (long, conversational), a meeting note, or a quick capture?

4. **Tags**:
   - Extract meaningful tags from the content (e.g., "pricing", "demo", "integration")
   - Preserve any hashtags found in the original text (e.g., #training, #customer-success)
   - Tags should be lowercase, without # symbols in the output
   - Aim for 3-8 relevant tags

5. **Note Strategy**:
   - If call transcript: Create ONE comprehensive note summarizing the entire conversation
   - If quick note: Create one focused note
   - Check if you should UPDATE an existing recent note instead of creating new

Return ONLY valid JSON (no markdown):
{
  "inputType": "call_transcript" | "meeting_note" | "quick_note",
  "primaryTopic": {
    "name": "Acme Corp",
    "type": "company",
    "confidence": 0.95,
    "matchedExisting": "Acme Corp" // if matched to existing, use EXACT existing name
  },
  "secondaryTopics": [
    {
      "name": "Sarah Johnson",
      "type": "person",
      "relationTo": "Acme Corp"
    }
  ],
  "noteStrategy": {
    "action": "create" | "update",
    "shouldConsolidate": true,
    "updateNoteId": "note-123"
  },
  "note": {
    "content": "## Context\n\nBrief overview of the call/meeting in 1-2 sentences.\n\n## Discussion Points\n\n- **Key topic 1**: Details about this topic\n- **Key topic 2**: Details about this topic\n- **Decisions made**: Any decisions or agreements\n\n## Next Steps\n\n- Action item 1\n- Action item 2\n\n## Additional Notes\n\nAny other relevant context or observations.",
    "summary": "Brief one-line summary",
    "topicAssociation": "Acme Corp",
    "tags": ["pricing", "demo", "integration"],
    "source": "call" | "email" | "thought" | "other",
    "sentiment": "positive" | "neutral" | "negative",
    "keyPoints": [
      "Discussed enterprise pricing model",
      "Sarah has concerns about ROI",
      "Need to follow up with updated numbers"
    ],
    "relatedTopics": ["Sarah Johnson", "Enterprise Sales"]
  },
  "tasks": [
    {
      "title": "Send Enterprise pricing to Sarah at Acme Corp",
      "priority": "high",
      "dueDate": "2025-10-05",
      "dueTime": "18:00",
      "dueDateReasoning": "User said 'end of week' which is Friday at EOD (6PM)",
      "description": "Include updated Q3 numbers and ROI analysis for enterprise tier. Sarah requested this during call about pricing concerns.",
      "tags": ["pricing", "enterprise"],
      "suggestedSubtasks": [
        "Prepare pricing spreadsheet",
        "Get approval from sales manager",
        "Send via email with follow-up"
      ],
      "sourceExcerpt": "Send Enterprise pricing to Sarah",
      "relatedTo": "Acme Corp"
    }
  ],
  "skippedTasks": [
    {
      "title": "Follow up with Acme Corp",
      "reason": "duplicate",
      "existingTaskTitle": "Follow up with Acme Corp on pricing",
      "sourceExcerpt": "need to follow up with Acme"
    }
  ],
  "tags": ["pricing", "enterprise", "sales"],
  "sentiment": "positive"
}

**NOTE CREATION RULES:**
For the note object, ALWAYS provide:
1. **Content** - Well-structured markdown with proper hierarchy:
   - Use ## for section headers (Context, Discussion Points, Next Steps, etc.)
   - Use **bold** for emphasis on key terms and names
   - Use bullet points (- ) for lists
   - Use numbered lists (1. 2. 3.) for sequential steps
   - Structure content logically with clear sections
   - For call transcripts: Include Context, Discussion Points, Decisions, Next Steps
   - For quick notes: Use appropriate structure based on content
   - Make it scannable and easy to read with visual hierarchy
2. **Summary** - Brief one-line summary (max 100 characters)
3. **Tags** - 3-8 relevant tags extracted from content (lowercase, no # symbols)
4. **Source** - Determine input type:
   - "call" - If it's a call transcript, meeting notes, or conversation
   - "email" - If it's from email or written correspondence
   - "thought" - If it's a personal note, idea, or quick capture
   - "other" - If unclear
5. **Sentiment** - Overall tone: positive, neutral, or negative
6. **Key Points** - 3-5 bullet points of the most important information
7. **Related Topics** - Names of secondary topics/people mentioned (if any)

**TASK CREATION RULES:**
For each task, ALWAYS provide:
1. **Due Date Inference** - Extract temporal context:
   - "today", "ASAP", "urgent" → today's date
   - "tomorrow" → tomorrow's date
   - "this week", "by Friday", "end of week" → upcoming Friday
   - "next week" → Monday of next week
   - "end of month" → last day of current month
   - "in X days/weeks" → calculate exact date
   - If no temporal context, set dueDate to null

2. **Due Date Reasoning** - Explain your inference (e.g., "end of week", "urgent", "in 2 weeks")

3. **Description** - Extract relevant context from the note (1-2 sentences)

4. **Tags** - 2-4 relevant tags based on task type and content

5. **Suggested Subtasks** - If task is multi-step, break into 2-5 subtasks

6. **Source Linking** - ALWAYS include:
   - sourceExcerpt: The exact text from input that triggered this task

**TEMPORAL CONTEXT:**
${(() => {
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return `Current Date & Time: ${dayOfWeek}, ${monthDay} at ${currentTime} ${timeZone}
Current Date (ISO): ${now.toISOString().split('T')[0]}
Current Time (24h): ${currentTime}
Day of Week: ${dayOfWeek}
Business Hours: 9:00 AM - 6:00 PM (09:00 - 18:00)
End of Day (EOD): 6:00 PM (18:00)`;
})()}

**DATE INFERENCE EXAMPLES:**
- "EOD today" → ${new Date().toISOString().split('T')[0]} at 18:00
- "EOD tomorrow" → ${new Date(Date.now() + 86400000).toISOString().split('T')[0]} at 18:00
- "by end of week" → Next Friday at 18:00
- "next Monday" → Next Monday at 09:00
- "in 2 weeks" → ${new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]}
- "ASAP" or "urgent" → ${new Date().toISOString().split('T')[0]} (today)
- No temporal context → Leave dueDate as null

**TASK EXTRACTION EXAMPLES:**

Example 1:
Input: "Need to send proposal to Acme Corp by Friday"
Output:
{
  "title": "Send proposal to Acme Corp",
  "priority": "high",
  "dueDate": "[next Friday date]",
  "dueTime": "18:00",
  "dueDateReasoning": "User specified 'by Friday', defaulting to EOD",
  "description": "Send proposal to Acme Corp as requested. Time-sensitive deadline for Friday.",
  "sourceExcerpt": "Need to send proposal to Acme Corp by Friday",
  "tags": ["proposal", "acme-corp"]
}

Example 2:
Input: "Follow up with Sarah about the pricing discussion. Need to provide update via email my EOD tomorrow."
Output:
{
  "title": "Follow up with Sarah about pricing discussion",
  "priority": "high",
  "dueDate": "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}",
  "dueTime": "18:00",
  "dueDateReasoning": "User said 'EOD tomorrow' which is 6PM tomorrow",
  "description": "Follow up with Sarah regarding pricing discussion and provide update via email by EOD tomorrow.",
  "sourceExcerpt": "Follow up with Sarah about the pricing discussion. Need to provide update via email my EOD tomorrow.",
  "tags": ["follow-up", "email", "pricing"]
}

Example 3:
Input: "Review contract terms and schedule meeting"
Output:
{
  "title": "Review contract terms and schedule meeting",
  "priority": "medium",
  "dueDate": null,
  "dueTime": null,
  "dueDateReasoning": "No temporal context provided",
  "description": "Review contract terms and schedule related meeting.",
  "sourceExcerpt": "Review contract terms and schedule meeting",
  "tags": ["contract", "meeting"]
}

**⚠️ VALIDATION CHECKLIST - REVIEW BEFORE RETURNING JSON ⚠️**
For EVERY task in your response, verify:
✓ description is NOT null, NOT empty, has actual content (1-2 sentences minimum)
✓ sourceExcerpt is NOT null, NOT empty, contains exact quote from user input
✓ If dueDate exists → dueTime MUST exist (18:00 for EOD, 09:00 for morning, etc.)
✓ dueDateReasoning explains why this date was chosen
✓ tags has 2-4 relevant tags
✓ priority is set based on urgency
✓ title is clear and actionable

**COMMON MISTAKES TO AVOID:**
❌ Leaving description empty or null → WRONG
❌ Leaving sourceExcerpt empty → WRONG
❌ Setting dueDate without dueTime → WRONG
❌ Generic descriptions like "Task to do" → WRONG
✅ Specific descriptions with context → CORRECT
✅ Exact quotes in sourceExcerpt → CORRECT
✅ Both date AND time when deadline exists → CORRECT
`;

    try {
      // Build content array for vision support
      const contentBlocks: Anthropic.MessageParam['content'] = [
        { type: 'text', text: prompt }
      ];

      // Add image attachments to content blocks
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          if (attachment.type === 'image' || attachment.type === 'screenshot') {
            try {
              let base64Data: string;

              // Get base64 from thumbnail or read from file
              if (attachment.thumbnail && attachment.thumbnail.startsWith('data:image')) {
                // Extract base64 from data URL
                base64Data = attachment.thumbnail.split(',')[1];
              } else if (attachment.path) {
                // Read file and convert to base64
                const fileData = await fileStorage.readAttachment(attachment.path);
                base64Data = fileStorage.uint8ArrayToBase64(fileData);
              } else {
                continue; // Skip if no data available
              }

              // Determine media type
              const mediaType = attachment.mimeType.startsWith('image/')
                ? attachment.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
                : 'image/png';

              contentBlocks.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              });
            } catch (error) {
              console.error('Failed to load image attachment:', error);
              // Continue processing without this image
            }
          }
        }
      }

      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-5-20250929', // Latest model - Claude Sonnet 4.5
        max_tokens: 4096,
        messages: [{ role: 'user', content: contentBlocks }],
      });

      const content = message.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const responseText = content.text.trim();
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const aiResponse = JSON.parse(jsonText);

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
    if (!this.client) {
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

    const prompt = `${settings.systemInstructions}

**Knowledge Base:**
${context}

**Question:** ${question}

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

    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-5-20250929', // Latest model - Claude Sonnet 4.5
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const responseText = content.text.trim();
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const result = JSON.parse(jsonText);

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
    if (!this.client) {
      throw new Error('API key not set. Please configure your Claude API key in Settings.');
    }

    const prompt = `${optimizationContext}

**Your Task:**
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

Only include "suggestedSettings" if shouldOptimize is true. Make conservative adjustments (5-10% changes at most).
`;

    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const responseText = content.text.trim();
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const result = JSON.parse(jsonText);
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