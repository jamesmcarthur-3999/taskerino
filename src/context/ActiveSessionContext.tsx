import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Session, SessionScreenshot, SessionAudioSegment, SessionContextItem, ScreenshotAnalysis } from '../types';
import { generateId } from '../utils/helpers';
import { validateAudioConfig, validateVideoConfig, validateSession } from '../utils/sessionValidation';
import { useSessionList } from './SessionListContext';

/**
 * ActiveSessionContext - Manages the currently active session
 *
 * Responsibilities:
 * - Track active session state
 * - Session lifecycle (start, pause, resume, end)
 * - Add data to active session (screenshots, audio, etc.)
 * - Hand off completed sessions to SessionListContext
 *
 * This context does NOT manage:
 * - List of completed sessions (see SessionListContext)
 * - Recording services (see RecordingContext)
 */

// ============================================================================
// Types
// ============================================================================

interface ActiveSessionContextValue {
  // Active session (or null if no session active)
  activeSession: Session | null;
  activeSessionId: string | undefined;

  // Session lifecycle
  startSession: (config: Omit<Session, 'id' | 'startTime' | 'screenshots' | 'extractedTaskIds' | 'extractedNoteIds'>) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => Promise<void>;

  // Session data updates
  updateActiveSession: (updates: Partial<Session>) => void;
  addScreenshot: (screenshot: SessionScreenshot) => void;
  addAudioSegment: (segment: SessionAudioSegment) => void;
  deleteAudioSegmentFile: (segmentId: string) => void;
  updateScreenshotAnalysis: (screenshotId: string, analysis: ScreenshotAnalysis | undefined, status: SessionScreenshot['analysisStatus'], error?: string) => void;
  addScreenshotComment: (screenshotId: string, comment: string) => void;
  toggleScreenshotFlag: (screenshotId: string) => void;

  // Session links
  addExtractedTask: (taskId: string) => void;
  addExtractedNote: (noteId: string) => void;
  addContextItem: (item: SessionContextItem) => void;
}

// ============================================================================
// Context
// ============================================================================

const ActiveSessionContext = createContext<ActiveSessionContextValue | undefined>(undefined);

interface ActiveSessionProviderProps {
  children: ReactNode;
}

export function ActiveSessionProvider({ children }: ActiveSessionProviderProps) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const { addSession: addToSessionList, updateSession: updateInSessionList } = useSessionList();

  // Track if session has been ended to prevent double-ending
  const isEndingRef = useRef(false);

  // Start a new session
  const startSession = useCallback((config: Omit<Session, 'id' | 'startTime' | 'screenshots' | 'extractedTaskIds' | 'extractedNoteIds'>) => {
    // Validate required fields
    if (!config.name || config.name.trim() === '') {
      console.error('[ActiveSessionContext] Validation failed: Session name is required');
      return;
    }

    // Validate audioConfig if provided
    if (config.audioConfig) {
      const audioValidation = validateAudioConfig(config.audioConfig);
      if (!audioValidation.valid) {
        console.error('[ActiveSessionContext] Audio config validation failed:', audioValidation.errors);
        return;
      }
    }

    // Validate videoConfig if provided
    if (config.videoConfig) {
      const videoValidation = validateVideoConfig(config.videoConfig);
      if (!videoValidation.valid) {
        console.error('[ActiveSessionContext] Video config validation failed:', videoValidation.errors);
        return;
      }
    }

    // Create the session
    const newSession: Session = {
      ...config,
      id: generateId(),
      startTime: new Date().toISOString(),
      screenshots: [],
      extractedTaskIds: [],
      extractedNoteIds: [],
      status: 'active',
    };

    // Validate the complete session object
    const sessionValidation = validateSession(newSession);
    if (!sessionValidation.valid) {
      console.error('[ActiveSessionContext] Complete session validation failed:', sessionValidation.errors);
      return;
    }

    console.log('[ActiveSessionContext] Starting new session:', newSession.id);
    setActiveSession(newSession);
    isEndingRef.current = false;
  }, []);

  // Pause active session
  const pauseSession = useCallback(() => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot pause: no active session');
      return;
    }

    console.log('[ActiveSessionContext] Pausing session:', activeSession.id);
    setActiveSession({
      ...activeSession,
      status: 'paused',
      pausedAt: new Date().toISOString(),
    });
  }, [activeSession]);

  // Resume paused session
  const resumeSession = useCallback(() => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot resume: no active session');
      return;
    }

    // Calculate paused duration
    let additionalPausedTime = 0;
    if (activeSession.pausedAt) {
      const pauseStart = new Date(activeSession.pausedAt).getTime();
      const pauseEnd = new Date().getTime();
      additionalPausedTime = pauseEnd - pauseStart;
    }

    console.log('[ActiveSessionContext] Resuming session:', activeSession.id);
    setActiveSession({
      ...activeSession,
      status: 'active',
      pausedAt: undefined,
      totalPausedTime: (activeSession.totalPausedTime || 0) + additionalPausedTime,
    });
  }, [activeSession]);

  // End active session
  const endSession = useCallback(async () => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot end: no active session');
      return;
    }

    // Prevent double-ending
    if (isEndingRef.current) {
      console.warn('[ActiveSessionContext] Session is already ending');
      return;
    }

    isEndingRef.current = true;

    // Prevent ending already-completed session
    if (activeSession.status === 'completed') {
      console.warn('[ActiveSessionContext] Attempted to end already-completed session');
      isEndingRef.current = false;
      return;
    }

    console.log('[ActiveSessionContext] Ending session:', activeSession.id);

    const endTime = new Date().toISOString();
    let totalDuration: number | undefined;

    if (activeSession.startTime) {
      const startMs = new Date(activeSession.startTime).getTime();
      const endMs = new Date(endTime).getTime();
      let totalPausedMs = activeSession.totalPausedTime || 0;

      // If paused, include current pause duration
      if (activeSession.status === 'paused' && activeSession.pausedAt) {
        const currentPauseDuration = endMs - new Date(activeSession.pausedAt).getTime();
        totalPausedMs += currentPauseDuration;
      }

      const activeMs = endMs - startMs - totalPausedMs;
      totalDuration = Math.floor(activeMs / 60000); // Convert to minutes
    }

    const completedSession: Session = {
      ...activeSession,
      status: 'completed',
      endTime,
      totalDuration,
      pausedAt: undefined,
    };

    // Save to session list
    await addToSessionList(completedSession);

    // Clear active session
    setActiveSession(null);
    isEndingRef.current = false;

    console.log('[ActiveSessionContext] Session ended and saved:', completedSession.id);
  }, [activeSession, addToSessionList]);

  // Update active session
  const updateActiveSession = useCallback((updates: Partial<Session>) => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot update: no active session');
      return;
    }

    setActiveSession({ ...activeSession, ...updates });
  }, [activeSession]);

  // Add screenshot to active session
  const addScreenshot = useCallback((screenshot: SessionScreenshot) => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot add screenshot: no active session');
      return;
    }

    setActiveSession({
      ...activeSession,
      screenshots: [...activeSession.screenshots, screenshot],
      lastScreenshotTime: screenshot.timestamp,
    });
  }, [activeSession]);

  // Add audio segment to active session
  const addAudioSegment = useCallback((segment: SessionAudioSegment) => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot add audio: no active session');
      return;
    }

    // Check for duplicate segment
    const existingSegment = activeSession.audioSegments?.find(s => s.id === segment.id);
    if (existingSegment) {
      console.warn('[ActiveSessionContext] Duplicate audio segment detected:', segment.id);
      return;
    }

    setActiveSession({
      ...activeSession,
      audioSegments: [...(activeSession.audioSegments || []), segment],
    });
  }, [activeSession]);

  // Delete audio segment file
  const deleteAudioSegmentFile = useCallback((segmentId: string) => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot delete audio file: no active session');
      return;
    }

    setActiveSession({
      ...activeSession,
      audioSegments: (activeSession.audioSegments || []).map(segment =>
        segment.id === segmentId
          ? { ...segment, filePath: undefined }
          : segment
      ),
    });
  }, [activeSession]);

  // Update screenshot analysis
  const updateScreenshotAnalysis = useCallback((screenshotId: string, analysis: ScreenshotAnalysis | undefined, analysisStatus: SessionScreenshot['analysisStatus'], analysisError?: string) => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot update screenshot analysis: no active session');
      return;
    }

    setActiveSession({
      ...activeSession,
      screenshots: activeSession.screenshots.map(screenshot =>
        screenshot.id === screenshotId
          ? {
              ...screenshot,
              aiAnalysis: analysis,
              analysisStatus,
              analysisError,
            }
          : screenshot
      ),
    });
  }, [activeSession]);

  // Add screenshot comment
  const addScreenshotComment = useCallback((screenshotId: string, comment: string) => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot add comment: no active session');
      return;
    }

    setActiveSession({
      ...activeSession,
      screenshots: activeSession.screenshots.map(screenshot =>
        screenshot.id === screenshotId
          ? { ...screenshot, userComment: comment }
          : screenshot
      ),
    });
  }, [activeSession]);

  // Toggle screenshot flag
  const toggleScreenshotFlag = useCallback((screenshotId: string) => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot toggle flag: no active session');
      return;
    }

    setActiveSession({
      ...activeSession,
      screenshots: activeSession.screenshots.map(screenshot =>
        screenshot.id === screenshotId
          ? { ...screenshot, flagged: !screenshot.flagged }
          : screenshot
      ),
    });
  }, [activeSession]);

  // Add extracted task
  const addExtractedTask = useCallback((taskId: string) => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot add task: no active session');
      return;
    }

    setActiveSession({
      ...activeSession,
      extractedTaskIds: [...activeSession.extractedTaskIds, taskId],
    });
  }, [activeSession]);

  // Add extracted note
  const addExtractedNote = useCallback((noteId: string) => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot add note: no active session');
      return;
    }

    setActiveSession({
      ...activeSession,
      extractedNoteIds: [...activeSession.extractedNoteIds, noteId],
    });
  }, [activeSession]);

  // Add context item
  const addContextItem = useCallback((item: SessionContextItem) => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot add context item: no active session');
      return;
    }

    setActiveSession({
      ...activeSession,
      contextItems: [...(activeSession.contextItems || []), item],
    });
  }, [activeSession]);

  // Sync active session changes to SessionListContext (for live updates in session list)
  useEffect(() => {
    if (activeSession && activeSession.status === 'active') {
      // Debounce updates to avoid excessive storage writes
      const timeoutId = setTimeout(() => {
        updateInSessionList(activeSession.id, activeSession);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [activeSession, updateInSessionList]);

  const value: ActiveSessionContextValue = {
    activeSession,
    activeSessionId: activeSession?.id,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    updateActiveSession,
    addScreenshot,
    addAudioSegment,
    deleteAudioSegmentFile,
    updateScreenshotAnalysis,
    addScreenshotComment,
    toggleScreenshotFlag,
    addExtractedTask,
    addExtractedNote,
    addContextItem,
  };

  return (
    <ActiveSessionContext.Provider value={value}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export function useActiveSession() {
  const context = useContext(ActiveSessionContext);
  if (context === undefined) {
    throw new Error('useActiveSession must be used within ActiveSessionProvider');
  }
  return context;
}
