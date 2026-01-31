// src/bots/tools/session-tools.ts
import { tool } from '@baleybots/core';
import { z } from 'zod';
import { summarizeSession } from '../session-summarizer';
import type { Session } from '../../types';

let sessions: Session[] = [];

export function setSessionToolsState(sessionList: Session[]) {
  sessions = sessionList;
}

export const getSessionDetailsTool = tool(
  'get_session_details',
  'Get full details for a specific session including screenshots and audio.',
  z.object({
    sessionId: z.string(),
  }),
  async ({ sessionId }) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return { error: `Session ${sessionId} not found` };

    return {
      session: {
        ...session,
        // Summarize screenshots instead of full data
        screenshotCount: session.screenshots?.length || 0,
        audioSegmentCount: session.audioSegments?.length || 0,
        screenshots: session.screenshots?.slice(0, 5).map(ss => ({
          id: ss.id,
          timestamp: ss.timestamp,
          summary: ss.aiAnalysis?.summary,
          activity: ss.aiAnalysis?.detectedActivity,
        })),
      },
    };
  }
);

export const getSessionSummaryTool = tool(
  'get_session_summary',
  'Generate an AI summary of a session. Use when user asks about what they worked on.',
  z.object({
    sessionId: z.string(),
  }),
  async ({ sessionId }) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return { error: `Session ${sessionId} not found` };

    const summary = await summarizeSession(
      session,
      session.screenshots || [],
      session.audioSegments
    );

    return { sessionId, summary };
  }
);

export const getActiveSessionTool = tool(
  'get_active_session',
  'Get the currently active session if one exists.',
  z.object({}),
  async () => {
    const activeSession = sessions.find(s => s.status === 'active');
    if (!activeSession) return { active: false, message: 'No active session' };

    return {
      active: true,
      session: {
        id: activeSession.id,
        name: activeSession.name,
        startTime: activeSession.startTime,
        screenshotCount: activeSession.screenshots?.length || 0,
        duration: Math.round(
          (Date.now() - new Date(activeSession.startTime).getTime()) / 60000
        ),
      },
    };
  }
);

export const sessionTools = {
  get_session_details: getSessionDetailsTool,
  get_session_summary: getSessionSummaryTool,
  get_active_session: getActiveSessionTool,
};
