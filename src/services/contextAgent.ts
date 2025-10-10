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

import Anthropic from '@anthropic-ai/sdk';
import type { Note, Task, Company, Contact, Topic } from '../types';
import type { ContextAgentResult } from './nedTools';

interface AgentThread {
  id: string;
  messages: Anthropic.MessageParam[];
  createdAt: string;
}

export class ContextAgentService {
  private client: Anthropic | null = null;
  private threads: Map<string, AgentThread> = new Map();

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    }
  }

  setApiKey(apiKey: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
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
    if (!this.client) {
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
      // Call Claude Haiku
      const response = await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        system: systemPrompt,
        messages: thread.messages,
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
    return `You are a Context Agent for Taskerino. Your job is to search and filter notes and tasks based on user queries.

You have access to:
- Notes: Can contain text, tags, dates, linked to companies/contacts/topics
- Tasks: Have titles, priorities, due dates, statuses, tags
- Companies, Contacts, Topics: Organizational entities

Your responses must be in this JSON format:
\`\`\`json
{
  "note_ids": ["note_123", "note_456"],
  "task_ids": ["task_789"],
  "summary": "Found 2 notes about NVIDIA Q4 earnings and 1 related task",
  "suggestions": ["Want to see notes from Q3 as well?"]
}
\`\`\`

Search Strategy:
1. **Keyword matching**: Search in content, titles, tags
2. **Date filtering**: Use metadata for date ranges
3. **Entity linking**: Filter by companies, contacts, topics
4. **Metadata use**: Priority, status, source, sentiment
5. **Relationship awareness**: Tasks link to notes via context field

**CRITICAL: Quality Over Quantity**

Your goal is to return the MOST RELEVANT results, not the most results:

✅ GOOD:
- User asks "tasks about NVIDIA" → Return 3-5 most relevant/recent NVIDIA tasks
- User asks "notes from last week" → Return most important notes from last week
- Focus on relevance, recency, and importance (high priority tasks, detailed notes)

❌ BAD:
- Returning 50+ loosely related items
- Including tangentially related content
- Overwhelming the user with quantity

**Ranking Priority:**
1. Exact keyword matches in title/content
2. Recent items (this week > last week > older)
3. High priority tasks, important notes
4. Items with rich metadata (descriptions, tags, relationships)
5. Items linked to active topics/companies

**Result Limits:**
- For focused queries: Return 3-10 most relevant items
- For broad queries: Return 10-15 most representative items
- Never return more than 20 items unless explicitly asked

If query is ambiguous, ask clarifying questions:
- "Which John? John Doe (Acme Corp) or John Smith (TechCo)?"
- "This week or next week?"
- "All notes or just high priority?"

Be smart about dates:
- "this week" = current week
- "next week" = upcoming week
- "Q4" = Oct-Dec
- "this year" = current year

Remember: Better to return 5 perfect matches than 50 mediocre ones.`;
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
${notes.slice(0, 50).map(n => {
  const entities = [
    ...(n.companyIds || []).map(id => companies.find(c => c.id === id)?.name).filter(Boolean),
    ...(n.contactIds || []).map(id => contacts.find(c => c.id === id)?.name).filter(Boolean),
    ...(n.topicIds || []).map(id => topics.find(t => t.id === id)?.name).filter(Boolean),
  ];
  return `- [${n.id}] ${n.summary} (${n.timestamp.split('T')[0]}, tags: ${n.tags.join(', ') || 'none'}, entities: ${entities.join(', ') || 'none'})`;
}).join('\n')}
${notes.length > 50 ? `\n... and ${notes.length - 50} more notes` : ''}

**Tasks (${tasks.length}):**
${tasks.slice(0, 30).map(t =>
  `- [${t.id}] ${t.title} (${t.priority}, ${t.status}, due: ${t.dueDate || 'none'}, tags: ${t.tags?.join(', ') || 'none'})`
).join('\n')}
${tasks.length > 30 ? `\n... and ${tasks.length - 30} more tasks` : ''}

Use IDs in your response. Search through ALL data, not just what's shown above.`;
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
