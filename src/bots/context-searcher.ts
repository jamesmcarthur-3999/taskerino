// src/bots/context-searcher.ts
import { Baleybot, text } from '@baleybots/core';
import { ChatBot, History } from '@baleybots/chat';
import { MODELS } from './config';
import { SearchResultSchema, type SearchResult } from './types';
import type { Note, Task, Topic, Company, Contact } from '../types';

// Thread storage for multi-turn conversations
const threadHistories = new Map<string, History>();

/**
 * Get or create history for a thread
 */
function getThreadHistory(threadId: string): History {
  if (!threadHistories.has(threadId)) {
    threadHistories.set(threadId, History.inMemory(20));
  }
  return threadHistories.get(threadId)!;
}

/**
 * Clear a thread's history
 */
export function clearSearchThread(threadId: string): void {
  threadHistories.delete(threadId);
}

/**
 * Create a new search thread ID
 */
export function createSearchThread(): string {
  return `search-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Build search context from data
 */
function buildSearchContext(
  notes: Note[],
  tasks: Task[],
  topics: Topic[],
  companies: Company[],
  contacts: Contact[]
): string {
  const parts: string[] = [];

  // Notes
  if (notes.length > 0) {
    parts.push('## Notes');
    notes.forEach(n => {
      const meta = [
        n.timestamp,
        n.source,
        n.metadata?.sentiment,
        n.tags?.join(', ')
      ].filter(Boolean).join(' | ');
      parts.push(`[${n.id}] ${n.summary || n.content.slice(0, 150)} (${meta})`);
    });
    parts.push('');
  }

  // Tasks
  if (tasks.length > 0) {
    parts.push('## Tasks');
    tasks.forEach(t => {
      const status = t.done ? '✓' : '○';
      const meta = [t.priority, t.dueDate, t.tags?.join(', ')].filter(Boolean).join(' | ');
      parts.push(`${status} [${t.id}] ${t.title} (${meta})`);
    });
    parts.push('');
  }

  // Topics, Companies, Contacts
  if (topics.length > 0) {
    parts.push(`## Topics: ${topics.map(t => t.name).join(', ')}`);
  }
  if (companies.length > 0) {
    parts.push(`## Companies: ${companies.map(c => c.name).join(', ')}`);
  }
  if (contacts.length > 0) {
    parts.push(`## Contacts: ${contacts.map(c => c.name).join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Context Searcher Bot
 *
 * Searches notes and tasks using natural language queries.
 * Supports multi-turn conversations for refinement.
 */
export const contextSearcher = Baleybot.create({
  name: 'context-searcher',
  goal: `You are a search agent for a productivity app. Given a search query and database of notes/tasks:

1. Find relevant items matching the query
2. Support temporal queries ("last week", "today", "this month")
3. Filter by priority, status, tags, topics
4. Return IDs of matching items
5. Provide a helpful summary of results
6. Suggest follow-up queries if helpful

Return only IDs that exist in the provided data.`,
  model: MODELS.FAST,
  outputSchema: SearchResultSchema,
  verbose: false,
});

/**
 * Search notes and tasks
 */
export async function searchContext(
  query: string,
  notes: Note[],
  tasks: Task[],
  topics: Topic[],
  companies: Company[],
  contacts: Contact[],
  threadId?: string
): Promise<SearchResult & { threadId: string }> {
  const context = buildSearchContext(notes, tasks, topics, companies, contacts);

  const searchPrompt = `## Data\n${context}\n\n## Query\n${query}`;

  // If thread provided, use ChatBot for multi-turn
  if (threadId) {
    const history = getThreadHistory(threadId);
    const chat = ChatBot.forUser(contextSearcher, { history });
    const result = await chat.send(searchPrompt);
    return { ...result, threadId };
  }

  // Single-turn search
  const newThreadId = createSearchThread();
  const result = await contextSearcher.process(text(searchPrompt));
  return { ...result, threadId: newThreadId };
}
