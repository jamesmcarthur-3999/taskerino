/**
 * Context Agent Service
 *
 * Uses Claude Haiku to search, filter, and summarize notes/tasks.
 * Works behind the scenes for Ned - users never interact directly.
 *
 * Features:
 * - Thread-based conversations (agent remembers context)
 * - Metadata-aware search
 * - Smart summarization for large result sets
 * - Returns structured data with IDs
 * - Prompt caching for 70-85% cost reduction (system prompt + database context cached)
 *
 * Caching Behavior:
 * - First request: Pays full price, creates cache (valid for 5 minutes)
 * - Subsequent requests: 90% discount on cached tokens (system prompt + database context)
 * - Cache persists for 5 minutes after last use
 * - Expected savings: ~15K tokens cached per request
 */

import { invoke } from '@tauri-apps/api/core';
import type { ClaudeChatResponse, ClaudeMessage } from '../types/tauri-ai-commands';
import type { Note, Task, Company, Contact, Topic } from '../types';
import type { ContextAgentResult } from './nedTools';

interface AgentThread {
  id: string;
  messages: ClaudeMessage[];
  createdAt: string;
}

export class ContextAgentService {
  private hasApiKey: boolean = false;
  private threads: Map<string, AgentThread> = new Map();

  constructor(apiKey?: string) {
    if (apiKey) {
      this.setApiKey(apiKey);
    } else {
      // Auto-load API key from storage
      this.loadApiKeyFromStorage();
    }
  }

  async setApiKey(apiKey: string): Promise<void> {
    await invoke('set_claude_api_key', { apiKey });
    this.hasApiKey = true;
  }

  private async loadApiKeyFromStorage() {
    try {
      const savedKey = await invoke<string | null>('get_claude_api_key');
      if (savedKey && savedKey.trim()) {
        this.hasApiKey = true;
        console.log('✅ ContextAgent: Loaded API key from storage');
      } else {
        console.warn('⚠️ ContextAgent: No API key found in storage');
      }
    } catch (error) {
      console.error('❌ ContextAgent: Failed to load API key from storage:', error);
    }
  }

  /**
   * Create a new agent thread for a conversation
   */
  createThread(): string {
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.threads.set(threadId, {
      id: threadId,
      messages: [],
      createdAt: new Date().toISOString(),
    });
    return threadId;
  }

  /**
   * Search for notes and tasks based on query
   */
  async search(
    query: string,
    notes: Note[],
    tasks: Task[],
    companies: Company[],
    contacts: Contact[],
    topics: Topic[],
    threadId?: string
  ): Promise<ContextAgentResult> {
    if (!this.hasApiKey) {
      throw new Error('Context Agent: API key not set');
    }

    // Get or create thread
    const actualThreadId = threadId || this.createThread();
    const thread = this.threads.get(actualThreadId);

    if (!thread) {
      throw new Error('Thread not found');
    }

    // Build context for agent
    const systemPrompt = this.buildSystemPrompt();
    const dataContext = this.buildDataContext(notes, tasks, companies, contacts, topics);

    // For the first message in thread, add database context with cache control
    // For subsequent messages, only send the query (cached context is reused)
    if (thread.messages.length === 0) {
      thread.messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: dataContext,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: query,
          },
        ],
      });
    } else {
      thread.messages.push({
        role: 'user',
        content: query,
      });
    }

    try {
      // Build system prompt with cache control
      const systemBlocks = [
        {
          type: 'text' as const,
          text: systemPrompt,
          cache_control: { type: 'ephemeral' as const },
        },
      ];

      // Call Claude Haiku via Tauri
      const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
        request: {
          model: 'claude-haiku-4-5-20251001', // Official Haiku 4.5 model (October 2025)
          maxTokens: 64000, // Claude Haiku 4.5 max output limit (2025)
          system: systemBlocks,
          messages: thread.messages,
        },
      });

      // Check for truncation in response
      if (response.stopReason === 'max_tokens') {
        console.error('❌ ContextAgent: Response truncated due to max_tokens limit!');
        console.error(`   Requested: 64000 tokens`);
        console.error(`   Used: ${response.usage?.outputTokens || 'unknown'} output tokens`);
        throw new Error('Context Agent response was truncated. This should not happen with 64K token limit.');
      }

      const content = response.content[0];
      const responseText = content.type === 'text' ? content.text : '';
      console.log(`📊 ContextAgent: Response length: ${responseText.length} characters, ${response.usage?.outputTokens || 'unknown'} tokens`);

      // Log cache usage stats for monitoring
      if (response.usage.cacheCreationInputTokens || response.usage.cacheReadInputTokens) {
        console.log('🔥 Context Agent Cache Stats:', {
          input: response.usage.inputTokens,
          output: response.usage.outputTokens,
          cacheCreation: response.usage.cacheCreationInputTokens || 0,
          cacheRead: response.usage.cacheReadInputTokens || 0,
          cacheSavings: response.usage.cacheReadInputTokens
            ? `${Math.round(((response.usage.cacheReadInputTokens / (response.usage.inputTokens + response.usage.cacheReadInputTokens)) * 100))}% of input cached`
            : '(cache warming)',
        });
      }

      // Add assistant response to thread
      thread.messages.push({
        role: 'assistant',
        content: responseText,
      });

      // Parse response and extract IDs
      const result = this.parseResponse(responseText, notes, tasks);

      return {
        ...result,
        thread_id: actualThreadId,
      };
    } catch (error) {
      console.error('Context Agent error:', error);
      throw error;
    }
  }

  /**
   * Build system prompt for Context Agent
   */
  private buildSystemPrompt(): string {
    return `<role>
You are a Context Agent for Taskerino. You search and filter notes and tasks based on queries.
</role>

<critical_output_requirement>
YOU MUST ALWAYS RESPOND WITH ONLY A JSON CODE BLOCK. NO EXCEPTIONS.

RULES:
- NEVER respond conversationally
- NEVER ask clarifying questions
- NEVER provide explanations outside the JSON structure
- NEVER say "I'm ready to help" or similar greetings
- If the query is unclear: return empty arrays with a summary explaining what you need
- If the query is empty: return empty arrays with a summary listing available data
- Your ENTIRE response must be ONLY the JSON code block shown in <output_format>

THIS IS NOT A CHAT. THIS IS A SEARCH API. ALWAYS RETURN JSON.
</critical_output_requirement>

<data_sources>
- Notes: text, tags, dates, linked to companies/contacts/topics
- Tasks: titles, priorities, due dates, statuses, tags
- Companies, Contacts, Topics: organizational entities
</data_sources>

<output_format>
\`\`\`json
{
  "note_ids": ["note_123", "note_456"],
  "task_ids": ["task_789"],
  "summary": "Found 2 notes about NVIDIA Q4 earnings and 1 related task",
  "suggestions": ["Want to see notes from Q3 as well?"]
}
\`\`\`

IMPORTANT: Your entire response must be ONLY the JSON code block above. No other text before or after.
</output_format>

<search_strategy>
1. Match keywords in content, titles, tags
2. Filter by dates using metadata
3. Filter by companies, contacts, topics
4. Use metadata: priority, status, source, sentiment
5. Leverage relationships (tasks link to notes)
</search_strategy>

<quality_principle>
Return the MOST RELEVANT results, not the most results.

Rank by: exact match > recency > priority > metadata richness
- Focused queries: 3-10 items
- Broad queries: 10-15 items
- Maximum: 20 items unless explicitly requested

Better 5 perfect matches than 50 mediocre ones.
</quality_principle>

<ambiguity_handling>
If query is unclear, ask clarifying questions:
- Multiple entities? "Which John? John Doe (Acme) or John Smith (TechCo)?"
- Vague timeframe? "This week or next week?"
- Unclear scope? "All notes or just high priority?"
</ambiguity_handling>

<date_intelligence>
- "this week" = current week
- "next week" = upcoming week
- "Q4" = Oct-Dec
- "this year" = current year
</date_intelligence>`;
  }

  /**
   * Build data context string
   */
  private buildDataContext(
    notes: Note[],
    tasks: Task[],
    companies: Company[],
    contacts: Contact[],
    topics: Topic[]
  ): string {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0];

    return `CURRENT DATE/TIME: ${currentDate} ${currentTime}

AVAILABLE DATA:

**Companies (${companies.length}):**
${companies.map(c => `- ${c.name} (ID: ${c.id}, ${c.noteCount} notes)`).join('\n') || '(none)'}

**Contacts (${contacts.length}):**
${contacts.map(c => `- ${c.name} (ID: ${c.id}, ${c.noteCount} notes)`).join('\n') || '(none)'}

**Topics (${topics.length}):**
${topics.map(t => `- ${t.name} (ID: ${t.id}, ${t.noteCount} notes)`).join('\n') || '(none)'}

**Notes (${notes.length}):**
${notes.map(n => {
  const entities = [
    ...(n.companyIds || []).map(id => companies.find(c => c.id === id)?.name).filter(Boolean),
    ...(n.contactIds || []).map(id => contacts.find(c => c.id === id)?.name).filter(Boolean),
    ...(n.topicIds || []).map(id => topics.find(t => t.id === id)?.name).filter(Boolean),
  ];
  return `- [${n.id}] ${n.summary.substring(0, 150)} (${n.timestamp.split('T')[0]}, tags: ${n.tags.join(', ') || 'none'}, entities: ${entities.join(', ') || 'none'})`;
}).join('\n')}

**Tasks (${tasks.length}):**
${tasks.map(t =>
  `- [${t.id}] ${t.title.substring(0, 100)} (${t.priority}, ${t.status}, due: ${t.dueDate || 'none'}, tags: ${t.tags?.join(', ') || 'none'})`
).join('\n')}

Use IDs in your response. You can see ALL ${notes.length} notes and ALL ${tasks.length} tasks above.`;
  }

  /**
   * Parse agent response and extract matching items
   */
  private parseResponse(
    responseText: string,
    notes: Note[],
    tasks: Task[]
  ): Omit<ContextAgentResult, 'thread_id'> {
    try {
      // Extract JSON from response - be flexible with formatting
      // Try with code block first (```json or ``` with whitespace variations)
      let jsonText = '';
      const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);

      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      } else {
        // Try without code blocks - maybe the response is just JSON
        const directJsonMatch = responseText.match(/(\{[\s\S]*\})/);
        if (directJsonMatch) {
          jsonText = directJsonMatch[1];
        } else {
          console.error('❌ ContextAgent: Failed to parse response - no JSON found');
          console.error('Response text (first 500 chars):', responseText.substring(0, 500));
          console.error('Response text (last 500 chars):', responseText.substring(Math.max(0, responseText.length - 500)));
          throw new Error('No JSON found in response');
        }
      }

      const data = JSON.parse(jsonText);

      // Extract actual objects by IDs
      const matchedNotes = notes.filter(n => data.note_ids?.includes(n.id));
      const matchedTasks = tasks.filter(t => data.task_ids?.includes(t.id));

      return {
        notes: matchedNotes,
        tasks: matchedTasks,
        summary: data.summary || `Found ${matchedNotes.length} notes and ${matchedTasks.length} tasks`,
        suggestions: data.suggestions || [],
      };
    } catch (error) {
      console.error('Failed to parse Context Agent response:', error);

      // Fallback: simple keyword search
      const keywords = responseText.toLowerCase().split(/\s+/);
      const matchedNotes = notes.filter(n =>
        keywords.some(kw => n.content.toLowerCase().includes(kw) || n.summary.toLowerCase().includes(kw))
      );
      const matchedTasks = tasks.filter(t =>
        keywords.some(kw => t.title.toLowerCase().includes(kw))
      );

      return {
        notes: matchedNotes.slice(0, 10),
        tasks: matchedTasks.slice(0, 10),
        summary: 'Search completed (fallback mode)',
        suggestions: [],
      };
    }
  }

  /**
   * Clear thread (for cleanup)
   */
  clearThread(threadId: string) {
    this.threads.delete(threadId);
  }

  /**
   * Get thread message count (for debugging)
   */
  getThreadMessageCount(threadId: string): number {
    return this.threads.get(threadId)?.messages.length || 0;
  }
}

// Singleton instance
export const contextAgent = new ContextAgentService();
