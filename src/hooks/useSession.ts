/**
 * @file useSession.ts - Convenience hook for session operations
 *
 * @overview
 * Provides a simplified, ergonomic API for common session operations. This is a
 * convenience wrapper around SessionsContext that provides sensible defaults and
 * derived state.
 *
 * @difference_from_other_hooks
 * - **useSession()** - Convenience wrapper with defaults (THIS FILE)
 * - **useActiveSession()** - Phase 1 active session lifecycle (preferred for new code)
 * - **useSessionList()** - Phase 1 session CRUD and filtering (preferred for new code)
 * - **useSessions()** - DEPRECATED - Direct context access (legacy)
 *
 * @features
 * - Simplified session start/end/pause/resume methods
 * - Sensible defaults for session configuration
 * - Derived state (activeSession, hasActiveSession, isSessionActive)
 * - Helper methods (getSession, getSessionDuration)
 * - Filtered views (pastSessions, activeSessions)
 *
 * @usage
 * ```typescript
 * function MyComponent() {
 *   const {
 *     activeSession,
 *     hasActiveSession,
 *     startSession,
 *     endSession,
 *     pauseSession
 *   } = useSession();
 *
 *   return (
 *     <div>
 *       {hasActiveSession ? (
 *         <button onClick={() => endSession()}>
 *           End {activeSession.name}
 *         </button>
 *       ) : (
 *         <button onClick={() => startSession({
 *           name: "Work Session",
 *           description: "Daily work"
 *         })}>
 *           Start Session
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @defaults
 * When calling startSession(), these defaults are applied:
 * - screenshotInterval: 2 minutes
 * - autoAnalysis: true
 * - status: 'active'
 * - audioRecording: false
 * - enableScreenshots: true
 * - audioMode: 'off'
 * - tags: [] (empty array)
 *
 * @deprecated_note
 * This hook uses deprecated SessionsContext. For new code, use Phase 1 contexts:
 * - useActiveSession() - For active session lifecycle
 * - useSessionList() - For session CRUD and filtering
 * - useRecording() - For recording service management
 *
 * @migration_example
 * ```typescript
 * // OLD (deprecated):
 * const { activeSession, startSession } = useSession();
 *
 * // NEW (Phase 1):
 * const { activeSession, startSession } = useActiveSession();
 * const { sessions, filteredSessions } = useSessionList();
 * ```
 *
 * @see {@link ../context/SessionsContext.tsx} - DEPRECATED - Use Phase 1 contexts
 * @see {@link ../context/ActiveSessionContext.tsx} - NEW - Phase 1 active session management
 * @see {@link ../context/SessionListContext.tsx} - NEW - Phase 1 session list management
 * @see {@link ../docs/sessions-rewrite/CONTEXT_MIGRATION_GUIDE.md} - Migration guide
 */

import { useSessionList } from '../context/SessionListContext';
import { useActiveSession } from '../context/ActiveSessionContext';
import type { Session } from '../types';

/**
 * Convenience hook for session operations with sensible defaults
 *
 * @deprecated Use Phase 1 contexts instead:
 * - useActiveSession() for active session lifecycle
 * - useSessionList() for session CRUD and filtering
 * - useRecording() for recording service management
 */
export function useSession() {
  const {
    sessions,
    updateSession: updateSessionFromContext,
    deleteSession: deleteSessionFromContext,
  } = useSessionList();

  const {
    activeSession,
    activeSessionId,
    startSession: startSessionFromContext,
    endSession: endSessionFromContext,
    pauseSession: pauseSessionFromContext,
    resumeSession: resumeSessionFromContext,
  } = useActiveSession();

  // Get active session (already provided by useActiveSession)
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
      endSessionFromContext();
    }
  };

  /**
   * Pause the current session
   */
  const pauseSession = (sessionId?: string) => {
    const id = sessionId || activeSession?.id;
    if (id) {
      pauseSessionFromContext();
    }
  };

  /**
   * Resume a paused session
   */
  const resumeSession = (sessionId?: string) => {
    const id = sessionId || activeSession?.id;
    if (id) {
      resumeSessionFromContext();
    }
  };

  /**
   * Update session data
   */
  const updateSession = (session: Session) => {
    const { id, ...updates } = session;
    updateSessionFromContext(id, updates);
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
