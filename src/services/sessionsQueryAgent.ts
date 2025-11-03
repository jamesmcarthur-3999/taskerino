/**
 * Sessions Query Agent
 *
 * AI-powered session search using Claude Haiku.
 * Works behind the scenes for Ned - users never interact directly.
 *
 * Features:
 * - Thread-based conversations (agent remembers context)
 * - Searches across session metadata AND screenshot analyses
 * - Smart date/time understanding
 * - Semantic search through screenshot content
 * - Returns structured data with session IDs
 */

import { invoke } from '@tauri-apps/api/core';
import type { ClaudeChatResponse, ClaudeMessage } from '../types/tauri-ai-commands';
import type { Session } from '../types';
import { debug } from "../utils/debug";

interface AgentThread {
  id: string;
  messages: ClaudeMessage[];
  createdAt: string;
}

export interface SessionsQueryResult {
  sessions: Session[];
  summary: string;
  suggestions?: string[];
  thread_id: string;
}

export class SessionsQueryAgent {
  private hasApiKey: boolean = false;
  private threads: Map<string, AgentThread> = new Map();

  constructor(apiKey?: string) {
    if (apiKey) {
      this.setApiKey(apiKey);
    } else {
      // Auto-load from storage like sessionsAgentService
      this.loadApiKeyFromStorage();
    }
  }

  private async loadApiKeyFromStorage() {
    try {
      const savedKey = await invoke<string | null>('get_claude_api_key');
      if (savedKey && savedKey.trim()) {
        this.hasApiKey = true;
        debug.log(debug.log(console.log('✅ SessionsQueryAgent: Loaded API key from storage')));
      }
    } catch (error) {
      console.error('❌ SessionsQueryAgent: Failed to load API key from storage:', error);
    }
  }

  async setApiKey(apiKey: string) {
    await invoke('set_claude_api_key', { apiKey });
    this.hasApiKey = true;
  }

  /**
   * Create a new agent thread for a conversation
   */
  createThread(): string {
    const threadId = `session_thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.threads.set(threadId, {
      id: threadId,
      messages: [],
      createdAt: new Date().toISOString(),
    });
    return threadId;
  }

  /**
   * Search for sessions based on query
   */
  async search(
    query: string,
    sessions: Session[],
    threadId?: string
  ): Promise<SessionsQueryResult> {
    if (!this.hasApiKey) {
      throw new Error('Sessions Query Agent: API key not set');
    }

    // Get or create thread
    const actualThreadId = threadId || this.createThread();
    const thread = this.threads.get(actualThreadId);

    if (!thread) {
      throw new Error('Thread not found');
    }

    // Build context for agent
    const systemPrompt = this.buildSystemPrompt();
    const dataContext = this.buildDataContext(sessions);

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
          messages: thread.messages,
          system: systemPrompt,
        },
      });

      const content = response.content[0];
      const responseText = content.type === 'text' ? content.text : '';

      // Add assistant response to thread
      thread.messages.push({
        role: 'assistant',
        content: responseText,
      });

      // Parse response and extract session IDs
      const result = this.parseResponse(responseText, sessions);

      return {
        ...result,
        thread_id: actualThreadId,
      };
    } catch (error) {
      console.error('Sessions Query Agent error:', error);
      throw error;
    }
  }

  /**
   * Build system prompt for Sessions Query Agent
   */
  private buildSystemPrompt(): string {
    return `<role>
You are a Sessions Query Agent for Taskerino. Search and filter work sessions based on user queries.
</role>

<data_sources>
- Sessions: metadata, screenshots, audio recordings, AI analyses
- Screenshot Analyses: AI summaries of visual activities
- Audio Transcriptions: speech-to-text with key phrases and metadata
- Extracted Tasks/Notes: items created from sessions
- Temporal Data: start/end times, durations, relative dates
</data_sources>

<output_format>
\`\`\`json
{
  "session_ids": ["session_123", "session_456"],
  "summary": "Found 2 sessions about authentication work from last week",
  "suggestions": ["Want to see sessions from earlier this month?"]
}
\`\`\`
</output_format>

<search_strategy>
1. Match keywords in names, descriptions, tags, activity types
2. Search screenshot AI analyses (detectedActivity, summary, keyElements)
3. Search audio transcriptions, key phrases, detected tasks/blockers
4. Filter by dates (relative: "last week", "yesterday", "this month")
5. Filter by activity (what was done from screenshots AND audio)
6. Filter by duration (short vs long sessions)
7. Filter by status (active, paused, completed)
8. Find sessions that produced specific tasks/notes
</search_strategy>

<quality_principle>
Return the MOST RELEVANT sessions, not all matching sessions.

Rank by: exact match > activity match > recency > depth > productivity
- Focused queries: 3-8 sessions
- Broad queries: 8-15 sessions
- Maximum: 20 sessions unless explicitly requested

Audio-only sessions are EQUALLY important as screenshot-based sessions.

Better 5 perfect matches than 50 mediocre ones.
</quality_principle>

<date_intelligence>
- "today" = current day
- "yesterday" = previous day
- "this week" = Mon-Sun current
- "last week" = previous week
- "this/last month" = calendar month
- "recent" = last 7 days
</date_intelligence>

<activity_mapping>
Common activity queries map to:
- "coding/programming" → IDE, terminal, code editors (screenshots)
- "meetings" → Video apps, calendar, OR conversation audio
- "discussion/conversation" → Audio transcriptions (PRIMARY source)
- "brainstorming" → Audio with key phrases and ideas
- "research" → Browser, documentation
- "email" → Email client
- "design" → Design tools, mockups
</activity_mapping>

<ambiguity_handling>
If query is unclear, ask clarifying questions:
- Multiple projects? "Which project? Auth or dashboard?"
- Vague timeframe? "This week or last week?"
- Status unclear? "Active sessions only or all?"
</ambiguity_handling>`;
  }

  /**
   * Build data context string
   */
  private buildDataContext(sessions: Session[]): string {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0];

    // Debug: Log session counts
    const audioOnlySessions = sessions.filter(s =>
      s.screenshots.length === 0 && (s.audioSegments || []).length > 0
    );
    const screenshotSessions = sessions.filter(s => s.screenshots.length > 0);
    const hybridSessions = sessions.filter(s =>
      s.screenshots.length > 0 && (s.audioSegments || []).length > 0
    );

    console.log('📊 Sessions Query Agent - Session Breakdown:');
    console.log(`  Total sessions: ${sessions.length}`);
    console.log(`  Audio-only sessions: ${audioOnlySessions.length}`);
    console.log(`  Screenshot-only sessions: ${screenshotSessions.length - hybridSessions.length}`);
    console.log(`  Hybrid (screenshots + audio): ${hybridSessions.length}`);

    if (audioOnlySessions.length > 0) {
      console.log('📝 Audio-only session details:');
      audioOnlySessions.forEach(s => {
        console.log(`  - "${s.name}" (${s.id}): ${(s.audioSegments || []).length} audio segments`);
      });
    }

    return `CURRENT DATE/TIME: ${currentDate} ${currentTime}

AVAILABLE SESSIONS:

**All Sessions (${sessions.length}):**
${sessions.map(s => {
  const duration = this.calculateDuration(s);
  const screenshots = s.screenshots || [];
  const screenshotActivities = screenshots
    .filter(ss => ss.aiAnalysis?.detectedActivity)
    .map(ss => ss.aiAnalysis!.detectedActivity)
    .slice(0, 3);

  const activitySummary = screenshotActivities.length > 0
    ? ` | Activities: ${screenshotActivities.join(', ')}`
    : '';

  // Audio segment information
  const audioSegments = s.audioSegments || [];
  const audioInfo = audioSegments.length > 0 ? `, ${audioSegments.length} audio segments` : '';

  // Transcription preview (first 150 chars from all transcriptions combined)
  const transcriptionPreview = audioSegments
    .map(seg => seg.transcription)
    .join(' ')
    .substring(0, 150);
  const audioTranscript = transcriptionPreview ? `\n  Audio: "${transcriptionPreview}${audioSegments.map(s => s.transcription).join(' ').length > 150 ? '...' : ''}"` : '';

  // Key phrases from audio
  const keyPhrases = audioSegments
    .flatMap(seg => seg.keyPhrases || [])
    .slice(0, 5);
  const audioKeyPhrases = keyPhrases.length > 0 ? `\n  Key phrases: ${keyPhrases.join(', ')}` : '';

  // Detected tasks/blockers in audio
  const audioTasks = audioSegments.filter(seg => seg.containsTask).length;
  const audioBlockers = audioSegments.filter(seg => seg.containsBlocker).length;
  const audioMetadata = (audioTasks > 0 || audioBlockers > 0)
    ? `\n  Audio metadata: ${audioTasks} tasks detected, ${audioBlockers} blockers detected`
    : '';

  const namePreview = s.name ? s.name.substring(0, 60) : 'Unnamed Session';
  const descPreview = s.description ? s.description.substring(0, 100) : 'None';
  const tagsStr = s.tags && s.tags.length > 0 ? s.tags.join(', ') : 'none';

  return `- [${s.id}] "${namePreview}" (${s.status}, ${this.formatDate(s.startTime)}, ${duration}min, ${screenshots.length} screenshots${audioInfo}${activitySummary})
  Description: ${descPreview}
  Tags: ${tagsStr}${audioTranscript}${audioKeyPhrases}${audioMetadata}`;
}).join('\n')}

**Screenshot Analyses Available:**
For each session, you can see what activities were detected in screenshots.
Look at the "Activities" field above to understand what work was actually done.

**Audio Transcriptions Available:**
For sessions with audio recording, you can see:
- Full transcriptions of what was said
- Key phrases extracted from the audio
- Detected tasks and blockers mentioned in audio
Use this audio data to search for sessions by conversation content, even if there are no screenshots.

Use session IDs in your response. You can see ALL ${sessions.length} sessions above.`;
  }

  /**
   * Parse agent response and extract matching sessions
   */
  private parseResponse(
    responseText: string,
    sessions: Session[]
  ): Omit<SessionsQueryResult, 'thread_id'> {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const data = JSON.parse(jsonMatch[1]);

      // Extract actual session objects by IDs
      const matchedSessions = sessions.filter(s => data.session_ids?.includes(s.id));

      // Debug: Log what the agent returned
      console.log('🤖 Sessions Query Agent Response:');
      console.log(`  Agent returned ${data.session_ids?.length || 0} session IDs`);
      console.log(`  Matched ${matchedSessions.length} actual sessions`);

      const audioOnlyReturned = matchedSessions.filter(s =>
        s.screenshots.length === 0 && (s.audioSegments || []).length > 0
      );
      console.log(`  Including ${audioOnlyReturned.length} audio-only sessions:`);
      if (audioOnlyReturned.length > 0) {
        audioOnlyReturned.forEach(s => {
          console.log(`    - "${s.name}" (${s.id})`);
        });
      }

      return {
        sessions: matchedSessions,
        summary: data.summary || `Found ${matchedSessions.length} sessions`,
        suggestions: data.suggestions || [],
      };
    } catch (error) {
      console.error('Failed to parse Sessions Query Agent response:', error);

      // Fallback: simple keyword search (including audio transcriptions)
      const keywords = responseText.toLowerCase().split(/\s+/);
      const matchedSessions = sessions.filter(s => {
        // Combine all audio transcriptions
        const audioText = (s.audioSegments || [])
          .map(seg => seg.transcription)
          .join(' ')
          .toLowerCase();

        return keywords.some(kw =>
          s.name.toLowerCase().includes(kw) ||
          s.description?.toLowerCase().includes(kw) ||
          s.tags.some(tag => tag.toLowerCase().includes(kw)) ||
          audioText.includes(kw)
        );
      });

      return {
        sessions: matchedSessions.slice(0, 10),
        summary: 'Search completed (fallback mode)',
        suggestions: [],
      };
    }
  }

  /**
   * Calculate session duration in minutes
   */
  private calculateDuration(session: Session): number {
    if (!session.startTime) return 0;
    const endTime = session.endTime || new Date().toISOString();
    return Math.floor(
      (new Date(endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60)
    );
  }

  /**
   * Format date for display
   */
  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
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
export const sessionsQueryAgent = new SessionsQueryAgent();
