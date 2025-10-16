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

  setApiKey(apiKey: string) {
    invoke('set_claude_api_key', { apiKey });
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

    // Add user query to thread
    thread.messages.push({
      role: 'user',
      content: `${thread.messages.length === 0 ? dataContext + '\n\n' : ''}${query}`,
    });

    try {
      // Call Claude Haiku via Tauri
      const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
        request: {
          model: 'claude-3-5-haiku-20241022',
          maxTokens: 4096,
          system: systemPrompt,
          messages: thread.messages,
        },
      });

      const content = response.content[0];
      const responseText = content.type === 'text' ? content.text : '';

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
You are a Context Agent for Taskerino. Search and filter notes and tasks based on user queries.
</role>

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
      // Extract JSON from response
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const data = JSON.parse(jsonMatch[1]);

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
