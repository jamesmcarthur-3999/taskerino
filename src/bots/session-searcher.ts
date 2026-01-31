// src/bots/session-searcher.ts
import { Baleybot, text } from '@baleybots/core';
import { ChatBot, History } from '@baleybots/chat';
import { MODELS } from './config';
import { SessionSearchResultSchema, type SessionSearchResult } from './types';
import type { Session } from '../types';

// Thread storage for multi-turn conversations
const threadHistories = new Map<string, History>();

function getThreadHistory(threadId: string): History {
  if (!threadHistories.has(threadId)) {
    threadHistories.set(threadId, History.inMemory(20));
  }
  return threadHistories.get(threadId)!;
}

export function clearSessionSearchThread(threadId: string): void {
  threadHistories.delete(threadId);
}

export function createSessionSearchThread(): string {
  return `session-search-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Build session search context
 */
function buildSessionContext(sessions: Session[]): string {
  const parts: string[] = ['## Sessions'];

  sessions.forEach(s => {
    parts.push(`\n### [${s.id}] ${s.name}`);
    if (s.description) parts.push(`Description: ${s.description}`);
    parts.push(`Time: ${s.startTime} - ${s.endTime || 'ongoing'}`);
    parts.push(`Status: ${s.status}`);
    if (s.tags?.length) parts.push(`Tags: ${s.tags.join(', ')}`);

    // Screenshot summaries
    if (s.screenshots?.length) {
      const activities = s.screenshots
        .filter(ss => ss.aiAnalysis?.detectedActivity)
        .map(ss => ss.aiAnalysis!.detectedActivity)
        .slice(0, 5);
      if (activities.length) {
        parts.push(`Activities: ${activities.join(', ')}`);
      }
    }

    // Audio summaries
    if (s.audioSegments?.length) {
      const phrases = s.audioSegments
        .flatMap(seg => seg.keyPhrases || [])
        .slice(0, 5);
      if (phrases.length) {
        parts.push(`Key phrases: ${phrases.join(', ')}`);
      }
    }
  });

  return parts.join('\n');
}

/**
 * Session Searcher Bot
 *
 * Searches sessions using natural language queries.
 * Searches metadata, screenshot analyses, and audio transcriptions.
 */
export const sessionSearcher = Baleybot.create({
  name: 'session-searcher',
  goal: `You are a session search agent for a productivity app. Given a query and session data:

1. Find sessions matching the query
2. Search across metadata, screenshot activities, and audio
3. Support temporal queries ("yesterday", "last week", "coding sessions")
4. Activity mapping:
   - "coding/programming" → IDE, terminal activities
   - "meetings" → video apps, discussion audio
   - "research" → browser, documentation
5. Return session IDs with summary
6. Suggest refinements

Return only IDs that exist in the provided data.`,
  model: MODELS.FAST,
  outputSchema: SessionSearchResultSchema,
  verbose: false,
});

/**
 * Search sessions
 */
export async function searchSessions(
  query: string,
  sessions: Session[],
  threadId?: string
): Promise<SessionSearchResult & { threadId: string }> {
  const context = buildSessionContext(sessions);
  const searchPrompt = `${context}\n\n## Query\n${query}`;

  if (threadId) {
    const history = getThreadHistory(threadId);
    const chat = ChatBot.forUser(sessionSearcher, { history });
    const result = await chat.send(searchPrompt);
    return { ...result, threadId };
  }

  const newThreadId = createSessionSearchThread();
  const result = await sessionSearcher.process(text(searchPrompt));
  return { ...result, threadId: newThreadId };
}
