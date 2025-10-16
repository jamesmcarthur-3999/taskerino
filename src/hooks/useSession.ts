import { useSessions } from '../context/SessionsContext';
import type { Session } from '../types';

/**
 * useSession Hook
 *
 * Provides easy access to session functionality across the app.
 * Use this hook to start, pause, resume, or end sessions from any component.
 */
export function useSession() {
  const {
    sessions,
    activeSessionId,
    startSession: startSessionFromContext,
    endSession: endSessionFromContext,
    pauseSession: pauseSessionFromContext,
    resumeSession: resumeSessionFromContext,
    updateSession: updateSessionFromContext,
    deleteSession: deleteSessionFromContext,
  } = useSessions();

  // Get active session
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const hasActiveSession = !!activeSession;
  const isSessionActive = activeSession?.status === 'active';
  const isSessionPaused = activeSession?.status === 'paused';

  // Get all sessions
  const allSessions = sessions;
  const pastSessions = sessions.filter(s => s.status === 'completed');
  const activeSessions = sessions.filter(s => s.status === 'active' || s.status === 'paused');

  /**
   * Start a new session
   */
  const startSession = (sessionData: {
    name: string;
    description: string;
    tags?: string[];
    screenshotInterval?: number;
    autoAnalysis?: boolean;
    activityType?: string;
  }) => {
    startSessionFromContext({
      name: sessionData.name,
      description: sessionData.description,
      tags: sessionData.tags || [],
      screenshotInterval: sessionData.screenshotInterval || 2,
      autoAnalysis: sessionData.autoAnalysis ?? true,
      activityType: sessionData.activityType,
      status: 'active',
      audioRecording: false,
      enableScreenshots: true,
      audioMode: 'off',
      audioReviewCompleted: false,
    });
  };

  /**
   * End the current session
   */
  const endSession = (sessionId?: string) => {
    const id = sessionId || activeSession?.id;
    if (id) {
      endSessionFromContext(id);
    }
  };

  /**
   * Pause the current session
   */
  const pauseSession = (sessionId?: string) => {
    const id = sessionId || activeSession?.id;
    if (id) {
      pauseSessionFromContext(id);
    }
  };

  /**
   * Resume a paused session
   */
  const resumeSession = (sessionId?: string) => {
    const id = sessionId || activeSession?.id;
    if (id) {
      resumeSessionFromContext(id);
    }
  };

  /**
   * Update session data
   */
  const updateSession = (session: Session) => {
    updateSessionFromContext(session);
  };

  /**
   * Delete a session
   */
  const deleteSession = (sessionId: string) => {
    deleteSessionFromContext(sessionId);
  };

  /**
   * Get session by ID
   */
  const getSession = (sessionId: string) => {
    return sessions.find(s => s.id === sessionId);
  };

  /**
   * Calculate session duration in minutes
   */
  const getSessionDuration = (session: Session) => {
    if (!session.startTime) return 0;
    const endTime = session.endTime || new Date().toISOString();
    return Math.floor((new Date(endTime).getTime() - new Date(session.startTime).getTime()) / 60000);
  };

  return {
    // State
    activeSession,
    hasActiveSession,
    isSessionActive,
    isSessionPaused,
    allSessions,
    pastSessions,
    activeSessions,

    // Actions
    startSession,
    endSession,
    pauseSession,
    resumeSession,
    updateSession,
    deleteSession,

    // Utilities
    getSession,
    getSessionDuration,
  };
}
