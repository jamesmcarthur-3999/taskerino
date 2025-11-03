import { invoke } from '@tauri-apps/api/core';
import type { Note, Topic, Company, Contact } from '../types';
import type { ClaudeChatResponse, ClaudeMessage } from '../types/tauri-ai-commands';
import { getEnrichmentLockService } from './enrichmentLockService';

/**
 * Options for note enrichment
 */
export interface NoteEnrichmentOptions {
  forceRegenerate?: boolean;  // Ignore existing enrichment
  generateTitle?: boolean;     // Default: true
  extractTags?: boolean;       // Default: true
  generateSummary?: boolean;   // Default: true
  findRelations?: boolean;     // Default: true
  analyzeEntities?: boolean;   // Analyze for companies/contacts/topics (default: true)
}

/**
 * Result of note enrichment
 */
export interface NoteEnrichmentResult {
  success: boolean;
  error?: string;

  // Suggested metadata (user reviews before applying)
  suggestedTitle?: string;
  suggestedTags?: string[];
  suggestedSummary?: string;
  keyTopics?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';

  // Relationships to existing entities
  relatedNoteIds?: string[];

  // NEW FORMAT: Relationships array (like claudeService)
  relationships?: Array<{
    from: { type: 'note'; id: string };
    to: { type: 'topic' | 'company' | 'contact' | 'note'; id?: string; name?: string };
    relationType: string;
    metadata?: { confidence?: number; reasoning?: string };
  }>;

  // NEW FORMAT: New entities to create
  newEntities?: {
    topics: Array<{ name: string; type: 'company' | 'person' | 'subject' | 'project'; confidence: number }>;
    companies: Array<{ name: string; confidence: number }>;
    contacts: Array<{ name: string; confidence: number }>;
  };

  // DEPRECATED: Old format for backwards compatibility (will be removed)
  suggestedTopicIds?: string[];
  suggestedCompanyIds?: string[];
  suggestedContactIds?: string[];
  newTopics?: Array<{ name: string; type?: string }>;
  newCompanies?: Array<{ name: string }>;
  newContacts?: Array<{ name: string }>;
}

/**
 * Context for enrichment (existing entities in the database)
 */
export interface EnrichmentContext {
  existingNotes: Note[];
  existingTopics: Topic[];
  existingCompanies: Company[];
  existingContacts: Contact[];
}

/**
 * Service for enriching notes with AI-generated metadata and relationship suggestions
 */
export class NoteEnrichmentService {
  private lockService = getEnrichmentLockService(5); // 5 minute timeout
  private hasApiKey: boolean = false;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.loadApiKey(apiKey);
    } else {
      this.loadApiKeyFromStorage();
    }
  }

  private async loadApiKeyFromStorage() {
    try {
      const savedKey = await invoke<string | null>('get_claude_api_key');
      if (savedKey) {
        this.hasApiKey = true;
        console.log('✅ [NOTE ENRICHMENT] Loaded API key from storage');
      }
    } catch (error) {
      console.error('[NOTE ENRICHMENT] Failed to load API key from storage:', error);
    }
  }

  private async loadApiKey(apiKey: string) {
    this.hasApiKey = !!apiKey;
  }

  /**
   * Check if a note can be enriched
   */
  public canEnrich(note: Note): { success: boolean; reason?: string } {
    if (!this.hasApiKey) {
      return {
        success: false,
        reason: 'API key not configured. Please add your Claude API key in Settings.',
      };
    }

    if (!note.content || note.content.trim().length < 50) {
      return {
        success: false,
        reason: 'Note content must be at least 50 characters long.',
      };
    }

    return { success: true };
  }

  /**
   * Main enrichment method
   */
  public async enrichNote(
    note: Note,
    context: EnrichmentContext,
    options: NoteEnrichmentOptions = {}
  ): Promise<NoteEnrichmentResult> {
    // Set defaults
    const opts: Required<NoteEnrichmentOptions> = {
      forceRegenerate: options.forceRegenerate ?? false,
      generateTitle: options.generateTitle ?? true,
      extractTags: options.extractTags ?? true,
      generateSummary: options.generateSummary ?? true,
      findRelations: options.findRelations ?? true,
      analyzeEntities: options.analyzeEntities ?? true,
    };

    // Validate
    const canEnrichResult = this.canEnrich(note);
    if (!canEnrichResult.success) {
      return {
        success: false,
        error: canEnrichResult.reason,
      };
    }

    // Check if already enriched (unless forceRegenerate)
    if (!opts.forceRegenerate && note.metadata?.aiEnrichment) {
      console.log('[NOTE ENRICHMENT] Note already enriched, skipping');
      return {
        success: false,
        error: 'Note already enriched. Use forceRegenerate to re-enrich.',
      };
    }

    // Acquire lock to prevent concurrent enrichment
    const lockAcquired = await this.lockService.acquireLock(note.id, 5 * 60 * 1000); // 5 minutes
    if (!lockAcquired) {
      return {
        success: false,
        error: 'Note is currently being enriched. Please wait.',
      };
    }

    try {
      console.log('[NOTE ENRICHMENT] Starting enrichment for note:', note.id);

      // Generate enrichment using Claude
      const enrichment = await this.generateEnrichment(note, context, opts);

      console.log('[NOTE ENRICHMENT] Enrichment completed successfully');
      return {
        success: true,
        ...enrichment,
      };
    } catch (error) {
      console.error('[NOTE ENRICHMENT] Error during enrichment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during enrichment',
      };
    } finally {
      // Always release lock
      await this.lockService.releaseLock(note.id);
    }
  }

  /**
   * Generate enrichment using Claude API
   */
  private async generateEnrichment(
    note: Note,
    context: EnrichmentContext,
    options: Required<NoteEnrichmentOptions>
  ): Promise<Omit<NoteEnrichmentResult, 'success' | 'error'>> {
    // Build prompt
    const prompt = this.buildEnrichmentPrompt(note, context, options);

    // Call Claude API
    const messages: ClaudeMessage[] = [
      { role: 'user', content: prompt },
    ];

    const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
      request: {
        model: 'claude-sonnet-4-5-20250929', // Claude Sonnet 4.5
        maxTokens: 8000,
        messages,
        system: undefined,
        temperature: undefined,
      },
    });

    // Extract text content
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }

    const responseText = content.text.trim();

    // Parse JSON response
    const enrichment = this.parseEnrichmentResponse(responseText);

    return enrichment;
  }

  /**
   * Build the enrichment prompt
   */
  private buildEnrichmentPrompt(
    note: Note,
    context: EnrichmentContext,
    options: Required<NoteEnrichmentOptions>
  ): string {
    const { existingNotes, existingTopics, existingCompanies, existingContacts } = context;

    // Format existing entities for context
    const topicsList = existingTopics.map(t => `- ${t.name}`).join('\n') || 'None';
    const companiesList = existingCompanies.map(c => `- ${c.name}`).join('\n') || 'None';
    const contactsList = existingContacts.map(c => `- ${c.name}${c.profile?.email ? ` (${c.profile.email})` : ''}`).join('\n') || 'None';

    // Get recent notes for similarity matching (last 20)
    const recentNotes = existingNotes
      .slice(-20)
      .map(n => ({
        id: n.id,
        summary: n.summary,
        tags: n.tags,
      }));

    const recentNotesList = recentNotes
      .map(n => `- ${n.summary.substring(0, 100)}... [tags: ${n.tags.join(', ')}]`)
      .join('\n') || 'None';

    return `<system_instructions>
You are an intelligent note enrichment assistant. Your job is to analyze a note's content and suggest metadata improvements and entity relationships.

**CRITICAL**: You must output ONLY valid JSON. No explanatory text before or after the JSON object.
</system_instructions>

<note_content>
${note.content}
</note_content>

<existing_entities>
**Existing Topics:**
${topicsList}

**Existing Companies:**
${companiesList}

**Existing Contacts:**
${contactsList}

**Recent Notes (for similarity matching):**
${recentNotesList}
</existing_entities>

<your_task>
Analyze the note content and provide enrichment suggestions in JSON format:

1. **${options.generateTitle ? 'REQUIRED' : 'SKIP'}** - suggestedTitle: A concise, descriptive title (3-8 words)

2. **${options.extractTags ? 'REQUIRED' : 'SKIP'}** - suggestedTags: Array of relevant tags (3-7 tags)

3. **${options.generateSummary ? 'REQUIRED' : 'SKIP'}** - suggestedSummary: 2-3 sentence summary

4. **${options.generateSummary ? 'REQUIRED' : 'SKIP'}** - keyTopics: Array of main topics/concepts discussed

5. **${options.generateSummary ? 'REQUIRED' : 'SKIP'}** - sentiment: "positive" | "neutral" | "negative"

6. **${options.findRelations ? 'REQUIRED' : 'SKIP'}** - relatedNoteIds: Array of note IDs with similar content (from recent notes above)

7. **${options.analyzeEntities ? 'REQUIRED' : 'SKIP'}** - Relationships:
   Create explicit relationships between this note and entities (topics/companies/contacts):
   - relationships: Array of { from, to, relationType, metadata }
   - Use existing entity IDs when available, or new entity names if creating
   - Relationship types: "note-topic", "note-company", "note-contact", "note-note"

8. **${options.analyzeEntities ? 'REQUIRED' : 'SKIP'}** - New Entities (if NOT found in existing):
   - newEntities.topics: Topics (subjects/projects/concepts)
   - newEntities.companies: Organizations/businesses mentioned
   - newEntities.contacts: People mentioned

**Entity Creation Rules:**
- **Companies**: Create in newEntities.companies for organizations (e.g., "Acme Corp", "Google")
- **Contacts**: Create in newEntities.contacts for people (e.g., "Sarah", "John from sales")
- **Topics**: Create in newEntities.topics ONLY for subjects/projects/themes (e.g., "API Development", "Marketing")
  - Do NOT create topics for people or companies - use contacts/companies instead

**Matching Guidelines:**
- Use fuzzy matching for entity names (e.g., "John" matches "John Smith")
- Prefer linking to existing entities over creating new ones
- For topics, match on concept similarity, not just exact names
- If entity exists, reference by ID in relationships
- If entity doesn't exist, reference by name in relationships AND include in newEntities
</your_task>

<output_format>
Output ONLY this JSON structure (no markdown, no explanation):

{
  "suggestedTitle": "Title here",
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "suggestedSummary": "2-3 sentence summary here.",
  "keyTopics": ["topic1", "topic2"],
  "sentiment": "positive",
  "relatedNoteIds": ["note-id-1", "note-id-2"],
  "relationships": [
    {
      "from": { "type": "note", "id": "NOTE_ID_PLACEHOLDER" },
      "to": { "type": "topic", "id": "topic-123" },
      "relationType": "note-topic",
      "metadata": { "confidence": 0.95 }
    },
    {
      "from": { "type": "note", "id": "NOTE_ID_PLACEHOLDER" },
      "to": { "type": "company", "name": "Acme Corp" },
      "relationType": "note-company",
      "metadata": { "confidence": 0.9, "reasoning": "Company mentioned in meeting" }
    }
  ],
  "newEntities": {
    "topics": [{ "name": "API Development", "type": "subject", "confidence": 0.9 }],
    "companies": [{ "name": "Acme Corp", "confidence": 0.95 }],
    "contacts": [{ "name": "Sarah Johnson", "confidence": 0.9 }]
  }
}

**IMPORTANT**:
- For from.id in relationships, use "NOTE_ID_PLACEHOLDER" - it will be replaced with actual note ID
- For to.id, use actual entity ID if it exists in the existing lists
- For to.name, use entity name if it doesn't exist yet (and include in newEntities)
- All fields are optional EXCEPT those marked REQUIRED based on options
- Use empty arrays [] if no matches found
- Output ONLY JSON, nothing else
</output_format>`;
  }

  /**
   * Parse Claude's JSON response
   */
  private parseEnrichmentResponse(responseText: string): Omit<NoteEnrichmentResult, 'success' | 'error'> {
    let jsonText = responseText.trim();

    // Try to extract JSON from markdown code blocks
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }
    // If no code blocks, try to find JSON object directly
    else if (!responseText.startsWith('{')) {
      const objectMatch = responseText.match(/(\{[\s\S]*\})/);
      if (objectMatch) {
        jsonText = objectMatch[1];
      }
    }

    try {
      const parsed = JSON.parse(jsonText);

      return {
        suggestedTitle: parsed.suggestedTitle,
        suggestedTags: parsed.suggestedTags || [],
        suggestedSummary: parsed.suggestedSummary,
        keyTopics: parsed.keyTopics || [],
        sentiment: parsed.sentiment,
        relatedNoteIds: parsed.relatedNoteIds || [],
        // NEW FORMAT
        relationships: parsed.relationships || [],
        newEntities: {
          topics: (parsed.newEntities?.topics || []).map((t: any) => ({
            name: t.name,
            type: t.type || 'subject',
            confidence: t.confidence || 0.9,
          })),
          companies: (parsed.newEntities?.companies || []).map((c: any) => ({
            name: c.name,
            confidence: c.confidence || 0.9,
          })),
          contacts: (parsed.newEntities?.contacts || []).map((c: any) => ({
            name: c.name,
            confidence: c.confidence || 0.9,
          })),
        },
      };
    } catch (parseError) {
      console.error('[NOTE ENRICHMENT] Failed to parse Claude response as JSON');
      console.error('Parse error:', parseError);
      console.error('Attempted to parse:', jsonText.substring(0, 500));
      console.error('Full response:', responseText.substring(0, 1000));

      throw new Error(
        `Failed to parse enrichment response as JSON. ` +
        `Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. ` +
        `Response preview: ${responseText.substring(0, 200)}...`
      );
    }
  }
}

// Singleton instance
let noteEnrichmentServiceInstance: NoteEnrichmentService | null = null;

/**
 * Get the singleton instance of NoteEnrichmentService
 */
export function getNoteEnrichmentService(): NoteEnrichmentService {
  if (!noteEnrichmentServiceInstance) {
    noteEnrichmentServiceInstance = new NoteEnrichmentService();
  }
  return noteEnrichmentServiceInstance;
}

/**
 * Destroy the singleton instance (for testing or shutdown)
 */
export function destroyNoteEnrichmentService(): void {
  noteEnrichmentServiceInstance = null;
}
