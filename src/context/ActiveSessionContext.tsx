import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Session, SessionScreenshot, SessionAudioSegment, SessionContextItem, SessionVideo, SessionRecordingConfig } from '../types';
import { generateId } from '../utils/helpers';
import { validateSession } from '../utils/sessionValidation';
import { useSessionList } from './SessionListContext';
import { useRecording } from './RecordingContext';
import { useEnrichmentContext } from './EnrichmentContext';
import { useUI } from './UIContext';
import { getStorage } from '../services/storage';
import { getChunkedStorage } from '../services/storage/ChunkedSessionStorage';
import { getPersistenceQueue } from '../services/storage/PersistenceQueue';
import { useSessionMachine } from '../hooks/useSessionMachine';
import { sessionEnrichmentService } from '../services/sessionEnrichmentService';

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
  startSession: (
    config: Omit<Session, 'id' | 'startTime' | 'screenshots' | 'extractedTaskIds' | 'extractedNoteIds'>,
    onScreenshotCaptured?: (screenshot: SessionScreenshot) => void | Promise<void>
  ) => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => Promise<void>;
  restoreSession: (session: Session) => Promise<void>;

  // Session loading (progressive loading from chunked storage)
  loadSession: (sessionId: string) => Promise<void>;

  // Session data updates
  updateActiveSession: (updates: Partial<Session>) => void;
  addScreenshot: (screenshot: SessionScreenshot) => void;
  addAudioSegment: (segment: SessionAudioSegment) => void;
  deleteAudioSegmentFile: (segmentId: string) => void;
  updateScreenshotAnalysis: (screenshotId: string, analysis: SessionScreenshot['aiAnalysis'], status: SessionScreenshot['analysisStatus'], error?: string) => void;
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
  const { updateSession: updateInSessionList, addSession: addToSessionList } = useSessionList();
  const { stopAll, recordingState } = useRecording();
  const { startTracking, updateProgress, stopTracking } = useEnrichmentContext();
  const { addNotification, dispatch: uiDispatch } = useUI(); // FIX: Added uiDispatch for navigation

  // XState machine for session lifecycle coordination
  const {
    context: machineContext,
    send,
    reportError: reportMachineError,
    reset,
    isIdle,
    isError,
    currentState,
  } = useSessionMachine();

  // AbortController to prevent double-ending (mutex pattern)
  const endSessionAbortControllerRef = useRef<AbortController | null>(null);

  // ============================================================================
  // Machine State Listeners
  // ============================================================================

  // React to machine errors
  useEffect(() => {
    if (isError && machineContext.errors.length > 0) {
      console.error('[ActiveSessionContext] Machine error:', machineContext.errors);
      // Note: We don't show toast here to avoid dependency on toast library
      // Components using this context should check isError and display errors
    }
  }, [isError, machineContext.errors]);

  // React to recording state changes
  useEffect(() => {
    const { recordingState: machineRecordingState } = machineContext;
    const hasErrors = Object.values(machineRecordingState).some(s => s === 'error');

    if (hasErrors) {
      const failedServices = Object.entries(machineRecordingState)
        .filter(([, state]) => state === 'error')
        .map(([service]) => service);

      console.warn('[ActiveSessionContext] Recording service errors:', failedServices);
      // Note: We don't show toast here to avoid dependency on toast library
      // Components using this context should monitor recordingState
    }
  }, [machineContext]);

  // ISSUE #15 FIX: Watch RecordingContext errors and report to machine
  // This ensures the sessionMachine transitions to error state BEFORE local error state is set
  useEffect(() => {
    const { screenshots, audio, video } = recordingState.lastError;

    // Check if any service has a new error
    if (screenshots || audio || video) {
      const errorService = screenshots ? 'screenshots' : audio ? 'audio' : 'video';
      const error = (screenshots || audio || video)!;

      // Only report error if machine is in 'starting' or 'active' state
      // (errors in other states are already handled by invoke onError handlers)
      if (currentState === 'starting' || currentState === 'active') {
        const errorMessage = error.type === 'PermissionDenied'
          ? `${errorService}: Permission denied - ${error.data.systemMessage}`
          : error.type === 'DeviceNotFound'
          ? `${errorService}: Device not found`
          : error.type === 'SystemError'
          ? `${errorService}: ${error.data.message}`
          : `${errorService}: ${error.type}`;

        console.log(`[ActiveSessionContext] Reporting ${errorService} error to machine:`, errorMessage);
        reportMachineError(errorMessage);
      }
    }
  }, [recordingState.lastError, currentState, reportMachineError]);

  // Start a new session
  const startSession = useCallback(async (
    config: Omit<Session, 'id' | 'startTime' | 'screenshots' | 'extractedTaskIds' | 'extractedNoteIds'>,
    onScreenshotCaptured?: (screenshot: SessionScreenshot) => void | Promise<void>
  ) => {
    console.log('[ActiveSessionContext] Starting session via XState machine');

    // Guard: Prevent starting if not idle
    if (!isIdle) {
      console.warn('[ActiveSessionContext] Cannot start: machine not in idle state (current:', currentState, ')');

      // DEFENSIVE: Check if this is a stale state issue
      // If UI shows no active session AND recordings are idle, this is a false positive
      const allRecordingsIdle =
        recordingState.screenshots === 'idle' &&
        recordingState.audio === 'idle' &&
        recordingState.video === 'idle';

      if (activeSession === null && allRecordingsIdle) {
        console.error('[ActiveSessionContext] STATE DESYNC DETECTED!');
        console.error('[ActiveSessionContext] Machine is not idle, but no session exists and recordings are idle');
        console.error('[ActiveSessionContext] This indicates a state synchronization bug');
        console.error('[ActiveSessionContext] Attempting automatic recovery by forcing RESET...');

        // Force reset to recover
        reset();

        // Give machine time to transition (async state update)
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check if reset worked
        if (!isIdle) {
          console.error('[ActiveSessionContext] RESET failed! Machine still in state:', currentState);
          throw new Error('Cannot start session: state reset failed. Please refresh the app.');
        }

        console.log('[ActiveSessionContext] State reset successful, proceeding with session start');
      } else {
        // Legitimate block: there's actually a session in progress
        throw new Error('Cannot start session: session already in progress');
      }
    }

    // Note: Session validation is handled by the XState machine's validateConfig service
    // which uses the centralized validation functions from sessionValidation.ts
    // We keep minimal validation here for immediate user feedback before machine processing

    // STEP 1: Quick name validation for immediate feedback
    if (!config.name || config.name.trim() === '') {
      console.error('[ActiveSessionContext] Validation failed: Session name is required');
      throw new Error('Session name is required');
    }

    // STEP 2: Check permissions
    console.log('[ActiveSessionContext] Checking required permissions...');

    if (config.enableScreenshots || config.videoRecording) {
      const { checkScreenRecordingPermission, showMacOSPermissionInstructions } = await import('../utils/permissions');
      const hasScreenPermission = await checkScreenRecordingPermission();

      if (!hasScreenPermission) {
        console.error('[ActiveSessionContext] Screen recording permission denied');
        showMacOSPermissionInstructions();
        throw new Error('Screen recording permission is required. Please grant permission in System Settings.');
      }
      console.log('[ActiveSessionContext] Screen recording permission: GRANTED');
    }

    if (config.audioRecording) {
      console.log('[ActiveSessionContext] Audio recording enabled, will check microphone permission when starting');
    }

    // STEP 3: Create the session
    const newSession: Session = {
      ...config,
      id: generateId(),
      startTime: new Date().toISOString(),
      screenshots: [],
      extractedTaskIds: [],
      extractedNoteIds: [],
      status: 'active',
      relationshipVersion: 1,
      enrichmentConfig: {
        autoEnrichOnComplete: true,
        includeAudioReview: true,
        includeVideoChapters: true,
        maxCostThreshold: 10.0,
      },
    };

    // STEP 4: Validate the complete session object
    const sessionValidation = validateSession(newSession);
    if (!sessionValidation.valid) {
      console.error('[ActiveSessionContext] Complete session validation failed:', sessionValidation.errors);
      throw new Error(`Session validation failed: ${sessionValidation.errors.join(', ')}`);
    }

    console.log('[ActiveSessionContext] Starting new session:', newSession.id);

    // Convert config to SessionRecordingConfig for the machine
    const sessionConfig: SessionRecordingConfig = {
      name: config.name,
      description: config.description,
      screenshotsEnabled: config.enableScreenshots || false,
      audioConfig: config.audioRecording && config.audioConfig ? {
        enabled: true,
        sourceType: config.audioConfig.sourceType,
        micDeviceId: config.audioConfig.micDeviceId,
        systemAudioDeviceId: config.audioConfig.systemAudioDeviceId,
        balance: config.audioConfig.balance,
        micVolume: config.audioConfig.micVolume,
        systemVolume: config.audioConfig.systemVolume,
      } : undefined,
      videoConfig: config.videoRecording && config.videoConfig ? {
        enabled: true,
        sourceType: config.videoConfig.sourceType === 'multi-source' ? 'display' : config.videoConfig.sourceType,
        displayIds: config.videoConfig.displayIds,
        windowIds: config.videoConfig.windowIds,
        webcamDeviceId: config.videoConfig.webcamDeviceId,
        quality: config.videoConfig.quality,
        fps: config.videoConfig.fps,
        resolution: config.videoConfig.resolution,
      } : undefined,
    };

    // Send START event to machine (machine fully handles recording orchestration)
    // Use custom screenshot callback if provided (for AI analysis), otherwise use addScreenshot
    // Wrap to ensure it always returns Promise<void>
    const screenshotCallback = async (screenshot: SessionScreenshot) => {
      if (onScreenshotCaptured) {
        await onScreenshotCaptured(screenshot);
      } else {
        await addScreenshot(screenshot);
      }
    };

    send({
      type: 'START',
      config: sessionConfig,
      session: newSession,
      callbacks: {
        onScreenshotCapture: screenshotCallback,
        onAudioSegment: addAudioSegment,
      },
    });

    // Save metadata immediately
    try {
      const chunkedStorage = await getChunkedStorage();
      await chunkedStorage.saveFullSession(newSession);
      console.log('[ActiveSessionContext] Session metadata saved');
    } catch (error) {
      console.error('[ActiveSessionContext] Failed to save initial session metadata:', error);
    }

    // Add to session list
    const sessionForList: Session = {
      ...newSession,
      screenshots: [],
      audioSegments: [],
      contextItems: [],
    };
    await addToSessionList(sessionForList);
    console.log('[ActiveSessionContext] Session added to list');

    setActiveSession(newSession);
    // Clear any previous abort controller
    endSessionAbortControllerRef.current = null;
  }, [isIdle, currentState, send, reset, recordingState, activeSession, addToSessionList]);

  // Pause active session
  const pauseSession = useCallback(() => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot pause: no active session');
      return;
    }

    // Guard: Check session status (not machine state)
    if (activeSession.status !== 'active') {
      console.warn('[ActiveSessionContext] Cannot pause: session not active (current:', activeSession.status, ')');
      return;
    }

    console.log('[ActiveSessionContext] Pausing session:', activeSession.id);

    // Send PAUSE event to machine (for state tracking)
    send({ type: 'PAUSE' });

    // Update local state
    setActiveSession({
      ...activeSession,
      status: 'paused',
      pausedAt: new Date().toISOString(),
    });
  }, [activeSession, send]);

  // Resume paused session
  const resumeSession = useCallback(() => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot resume: no active session');
      return;
    }

    // Guard: Check session status (not machine state)
    if (activeSession.status !== 'paused') {
      console.warn('[ActiveSessionContext] Cannot resume: session not paused (current:', activeSession.status, ')');
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

    // Send RESUME event to machine (for state tracking)
    send({ type: 'RESUME' });

    // Update local state
    setActiveSession({
      ...activeSession,
      status: 'active',
      pausedAt: undefined,
      totalPausedTime: (activeSession.totalPausedTime || 0) + additionalPausedTime,
    });
  }, [activeSession, send]);

  // Load full session (progressive loading from chunked storage)
  const loadSession = useCallback(async (sessionId: string) => {
    console.log('[ActiveSessionContext] Loading full session:', sessionId);

    try {
      const chunkedStorage = await getChunkedStorage();
      const session = await chunkedStorage.loadFullSession(sessionId);

      if (!session) {
        console.error('[ActiveSessionContext] Session not found:', sessionId);
        return;
      }

      console.log('[ActiveSessionContext] Session loaded successfully:', sessionId);
      setActiveSession(session);
    } catch (error) {
      console.error('[ActiveSessionContext] Failed to load session:', error);
      throw error;
    }
  }, []);

  // End active session (saves via chunked storage)
  const endSession = useCallback(async () => {
    if (!activeSession) {
      console.warn('[ActiveSessionContext] Cannot end: no active session');
      return;
    }

    // Mutex pattern: Create new AbortController to prevent concurrent ends
    if (endSessionAbortControllerRef.current) {
      console.warn('[ActiveSessionContext] Session is already ending (mutex locked)');
      return;
    }

    const abortController = new AbortController();
    endSessionAbortControllerRef.current = abortController;

    // Prevent ending already-completed session
    if (activeSession.status === 'completed') {
      console.warn('[ActiveSessionContext] Attempted to end already-completed session');
      endSessionAbortControllerRef.current = null;
      return;
    }

    // Guard: Check session status (can end from active or paused)
    if (activeSession.status !== 'active' && activeSession.status !== 'paused') {
      console.warn('[ActiveSessionContext] Cannot end: session not active/paused (current:', activeSession.status, ')');
      endSessionAbortControllerRef.current = null;
      return;
    }

    console.log('[ActiveSessionContext] Ending session:', activeSession.id);

    // Send END event to machine (for state tracking)
    send({ type: 'END' });

    // Stop all recording services via RecordingContext
    let sessionVideo: SessionVideo | null = null;
    try {
      console.log('[ActiveSessionContext] Stopping all recording services');
      sessionVideo = await stopAll(); // ✅ Capture SessionVideo return value

      // Check if aborted after async operation
      if (abortController.signal.aborted) {
        console.warn('[ActiveSessionContext] Session end aborted after stopping services');
        endSessionAbortControllerRef.current = null;
        return;
      }

      // Log video data if captured
      if (sessionVideo) {
        console.log('[ActiveSessionContext] Video data captured:', {
          id: sessionVideo.id,
          attachmentId: sessionVideo.fullVideoAttachmentId,
          hash: sessionVideo.hash,
          duration: sessionVideo.duration
        });
      } else if (activeSession.videoRecording) {
        console.warn('[ActiveSessionContext] Video recording was enabled but no SessionVideo returned');
      }
    } catch (error) {
      console.error('[ActiveSessionContext] Failed to stop recording services:', error);
      endSessionAbortControllerRef.current = null;
      throw error;
    }

    // Extended audio grace period - ensures all in-flight audio chunks arrive
    console.log('[ActiveSessionContext] Waiting 300ms for final audio chunks...');
    await new Promise(resolve => setTimeout(resolve, 300));

    if (abortController.signal.aborted) {
      console.warn('[ActiveSessionContext] Session end aborted after audio grace period');
      endSessionAbortControllerRef.current = null;
      return;
    }

    // Flush persistence queue BEFORE creating completedSession
    // This ensures all pending appends (screenshots, audio segments) are committed to storage
    // Prevents race condition where enrichment reads stale in-memory data
    console.log('[ActiveSessionContext] Flushing persistence queue...');
    const persistenceQueue = getPersistenceQueue();
    await persistenceQueue.flush();
    console.log('[ActiveSessionContext] ✅ All pending writes committed to storage');

    if (abortController.signal.aborted) {
      console.warn('[ActiveSessionContext] Session end aborted after queue flush');
      endSessionAbortControllerRef.current = null;
      return;
    }

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
      video: sessionVideo || activeSession.video,
    };

    // Check if aborted before storage operations
    if (abortController.signal.aborted) {
      console.warn('[ActiveSessionContext] Session end aborted before saving');
      endSessionAbortControllerRef.current = null;
      return;
    }

    // Save to chunked storage
    const chunkedStorage = await getChunkedStorage();
    const storage = await getStorage();
    const tx = await storage.beginTransaction();

    try {
      // Check if aborted before transaction
      if (abortController.signal.aborted) {
        console.warn('[ActiveSessionContext] Session end aborted before transaction');
        endSessionAbortControllerRef.current = null;
        return;
      }

      // Save full session via chunked storage
      // Note: This re-enqueues audio segment chunks to persistence queue
      await chunkedStorage.saveFullSession(completedSession);

      // CRITICAL FIX: Flush persistence queue AGAIN to ensure re-enqueued chunks are written
      // Without this, user might navigate to review tab before chunks exist in storage
      console.log('[ActiveSessionContext] Flushing persistence queue after saveFullSession...');
      await persistenceQueue.flush();
      console.log('[ActiveSessionContext] ✅ All saveFullSession writes committed to storage');

      // Clear activeSessionId
      const settings = await storage.load<Record<string, unknown>>('settings') || {};
      tx.save('settings', { ...settings, activeSessionId: undefined });

      // CRITICAL: Notify SessionListContext INSIDE transaction
      // This ensures the UI update is part of the atomic operation
      // If transaction fails, the UI won't be updated with invalid state
      updateInSessionList(completedSession.id, completedSession);

      await tx.commit();

      // Notify state machine that persistence is complete
      send({ type: 'PERSIST_COMPLETE' });
      console.log('[ActiveSessionContext] ✅ Persistence complete, state machine transitioning to completed');

      // Check if aborted after commit
      if (abortController.signal.aborted) {
        console.warn('[ActiveSessionContext] Session end aborted after commit');
        endSessionAbortControllerRef.current = null;
        return;
      }

      setActiveSession(null);
      endSessionAbortControllerRef.current = null; // Release mutex on success

      console.log('[ActiveSessionContext] Session ended and saved via chunked storage:', completedSession.id);

      // ============================================================================
      // BACKGROUND ENRICHMENT UX: NAVIGATE TO SESSIONS LIST
      // ============================================================================
      // Navigate user back to sessions list (non-blocking UX)
      // They can see enrichment status in the session card and continue using the app
      console.log('[ActiveSessionContext] Navigating to sessions list...');
      uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'sessions' });
      // Note: Session will show enrichment status badge in SessionCard
      // User can interact with other sessions while this one enriches in background

      // Start background media processing (fire-and-forget)
      (async () => {
        try {
          console.log('[TASK 11] Starting background media processing...');
          const { getBackgroundMediaProcessor } = await import('../services/enrichment/BackgroundMediaProcessor');
          const { eventBus } = await import('../utils/eventBus');
          const { getBackgroundEnrichmentManager } = await import('../services/enrichment/BackgroundEnrichmentManager');

          const processor = getBackgroundMediaProcessor();
          const enrichmentManager = getBackgroundEnrichmentManager();

          // Create enrichment job FIRST (in waiting state)
          console.log('[TASK 11] Creating enrichment job...');
          await enrichmentManager.enqueueSession({
            sessionId: completedSession.id,
            sessionName: completedSession.name,
            priority: 'normal',
            options: {
              includeAudio: completedSession.enrichmentConfig?.includeAudioReview ?? true,
              includeVideo: completedSession.enrichmentConfig?.includeVideoChapters ?? true,
              includeSummary: true,
              includeCanvas: true,
            },
          });

          // Start media processing
          console.log('[TASK 11] Starting media processor...');
          await processor.process({
            sessionId: completedSession.id,
            sessionName: completedSession.name,
            videoPath: sessionVideo?.fullVideoAttachmentId ?
              await (async () => {
                const { videoStorageService } = await import('../services/videoStorageService');
                return await videoStorageService.getVideoPath(sessionVideo.fullVideoAttachmentId!);
              })() : null,
            audioSegments: completedSession.audioSegments || [],
            onProgress: (stage, progress) => {
              console.log(`[TASK 11] Media processing progress: ${stage} ${progress}%`);
              // Emit event for SessionProcessingScreen
              eventBus.emit('media-processing-progress', {
                sessionId: completedSession.id,
                stage,
                progress,
              });
            },
            onComplete: async (optimizedVideoPath) => {
              console.log('[TASK 11] Media processing complete!', optimizedVideoPath);

              // Update session with optimized media path (video or audio-only)
              if (optimizedVideoPath) {
                console.log('[TASK 11] Updating session with optimized media path...');

                // Calculate session duration in seconds for audio-only sessions
                const durationSeconds = completedSession.endTime && completedSession.startTime
                  ? (new Date(completedSession.endTime).getTime() - new Date(completedSession.startTime).getTime()) / 1000
                  : 0;

                // For audio-only sessions (no video recording), create minimal video object
                // For sessions with video, merge optimized path into existing video object
                const videoUpdate: Partial<Session> = {
                  video: completedSession.video ? {
                    ...completedSession.video,
                    optimizedPath: optimizedVideoPath,
                  } : {
                    // Minimal video object for audio-only sessions
                    id: `video-${completedSession.id}`,
                    sessionId: completedSession.id,
                    fullVideoAttachmentId: '', // Empty for audio-only sessions
                    duration: durationSeconds,
                    chunkingStatus: 'complete',
                    optimizedPath: optimizedVideoPath,
                  } as SessionVideo,
                };

                console.log('[TASK 11] Video update object:', JSON.stringify(videoUpdate, null, 2));

                try {
                  await updateInSessionList(completedSession.id, videoUpdate);
                  console.log('[TASK 11] ✅ Session updated successfully with optimized path');
                } catch (updateError) {
                  console.error('[TASK 11] ❌ Failed to update session with optimized path:', updateError);
                  throw updateError;
                }
              }

              // Mark media processing complete (triggers enrichment)
              console.log('[TASK 11] Marking media processing complete...');
              await enrichmentManager.markMediaProcessingComplete(
                completedSession.id,
                optimizedVideoPath
              );

              // Emit complete event
              eventBus.emit('media-processing-complete', {
                sessionId: completedSession.id,
                optimizedPath: optimizedVideoPath || '',
              });

              console.log('[TASK 11] ✅ Media processing and enrichment job setup complete');
            },
            onError: async (error) => {
              console.error('[TASK 11] Media processing failed:', error);

              // Emit error event
              eventBus.emit('media-processing-error', {
                sessionId: completedSession.id,
                stage: 'concatenating', // Default stage
                error: error.message,
              });

              // Show notification
              addNotification({
                type: 'error',
                title: 'Media Processing Failed',
                message: `Failed to process "${completedSession.name}": ${error.message}`,
              });
            },
          });
        } catch (error) {
          console.error('[TASK 11] Failed to start background processing:', error);
          // Show notification
          addNotification({
            type: 'error',
            title: 'Processing Failed',
            message: `Failed to start background processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      })();

    } catch (error) {
      await tx.rollback();
      console.error('[ActiveSessionContext] Failed to save session, rolled back:', error);
      endSessionAbortControllerRef.current = null; // ALWAYS release mutex on error
      throw error;
    } finally {
      // Safety net: ALWAYS release mutex even if error path forgets
      endSessionAbortControllerRef.current = null;
    }
  }, [activeSession, updateInSessionList, stopAll, send, startTracking, updateProgress, stopTracking, addNotification]);

  // Update active session
  const updateActiveSession = useCallback((updates: Partial<Session>) => {
    setActiveSession(prev => {
      if (!prev) {
        console.warn('[ActiveSessionContext] Cannot update: no active session');
        return prev;
      }
      return { ...prev, ...updates };
    });
  }, []);

  // Restore orphaned session (from hot reload, crash, or improper shutdown)
  const restoreSession = useCallback(async (session: Session) => {
    console.log('[ActiveSessionContext] Restoring orphaned session:', session.id);

    // Set the session as active in state (UI only - recordings NOT resumed)
    setActiveSession({
      ...session,
      status: 'paused', // Mark as paused since recordings aren't running
    });

    // Update SessionList to show it's active
    updateInSessionList(session.id, {
      ...session,
      status: 'paused',
    });

    console.log('[ActiveSessionContext] Session restored (UI only, recordings not resumed)');
  }, [updateInSessionList]);

  // Add screenshot to active session (saves via chunked storage)
  const addScreenshot = useCallback(async (screenshot: SessionScreenshot) => {
    console.log('[ActiveSessionContext] addScreenshot called with:', screenshot.id);

    // Get current session ID for async storage operation
    let sessionId: string | null = null;

    setActiveSession(prev => {
      if (!prev) {
        console.warn('[ActiveSessionContext] Cannot add screenshot: no active session');
        return prev;
      }

      // Guard: Check session status (can add screenshots when active or paused)
      if (prev.status !== 'active' && prev.status !== 'paused') {
        console.warn('[ActiveSessionContext] Cannot add screenshot: session not active/paused (current:', prev.status, ')');
        return prev;
      }

      sessionId = prev.id;

      console.log('[ActiveSessionContext] Adding screenshot to session:', prev.id, 'Current count:', prev.screenshots.length);

      // Update local state immediately
      return {
        ...prev,
        screenshots: [...prev.screenshots, screenshot],
        lastScreenshotTime: screenshot.timestamp,
      };
    });

    // Append to chunked storage (background save via PersistenceQueue)
    if (sessionId) {
      try {
        const chunkedStorage = await getChunkedStorage();
        await chunkedStorage.appendScreenshot(sessionId, screenshot);
        console.log('[ActiveSessionContext] Screenshot appended to storage');
      } catch (error) {
        console.error('[ActiveSessionContext] Failed to append screenshot:', error);
      }
    }
  }, []);

  // Add audio segment to active session (saves via chunked storage)
  // OPTIMISTIC UI: Updates state immediately, saves to storage in background
  const addAudioSegment = useCallback((segment: SessionAudioSegment) => {
    let sessionId: string | null = null;
    let shouldAdd = false;

    // IMMEDIATE state update (no await - optimistic UI)
    setActiveSession(prev => {
      if (!prev) {
        console.warn('[ActiveSessionContext] Cannot add audio: no active session');
        return prev;
      }

      // Guard: Check session status (can add audio when active or paused)
      if (prev.status !== 'active' && prev.status !== 'paused') {
        console.warn('[ActiveSessionContext] Cannot add audio: session not active/paused (current:', prev.status, ')');
        return prev;
      }

      // Check for duplicate segment
      const existingSegment = prev.audioSegments?.find(s => s.id === segment.id);
      if (existingSegment) {
        console.warn('[ActiveSessionContext] Duplicate audio segment detected:', segment.id);
        return prev;
      }

      sessionId = prev.id;
      shouldAdd = true;

      // Update local state immediately
      return {
        ...prev,
        audioSegments: [...(prev.audioSegments || []), segment],
      };
    });

    // BACKGROUND storage save (fire-and-forget, with error logging)
    // Don't await - UI has already updated, storage happens in background
    if (shouldAdd && sessionId) {
      const sessionIdCopy = sessionId; // Capture for closure
      void getChunkedStorage()
        .then(chunkedStorage => chunkedStorage.appendAudioSegment(sessionIdCopy, segment))
        .catch(error => {
          console.error('[ActiveSessionContext] Failed to append audio segment (background save):', error);
          // Note: UI already shows segment, so we just log the error
          // Could add retry logic here if needed
        });
    }
  }, []);

  // Delete audio segment file
  const deleteAudioSegmentFile = useCallback((segmentId: string) => {
    setActiveSession(prev => {
      if (!prev) {
        console.warn('[ActiveSessionContext] Cannot delete audio file: no active session');
        return prev;
      }

      return {
        ...prev,
        audioSegments: (prev.audioSegments || []).map(segment =>
          segment.id === segmentId
            ? { ...segment, filePath: undefined }
            : segment
        ),
      };
    });
  }, []);

  // Update screenshot analysis
  const updateScreenshotAnalysis = useCallback((screenshotId: string, analysis: SessionScreenshot['aiAnalysis'], analysisStatus: SessionScreenshot['analysisStatus'], analysisError?: string) => {
    setActiveSession(prev => {
      if (!prev) {
        console.warn('[ActiveSessionContext] Cannot update screenshot analysis: no active session');
        return prev;
      }

      return {
        ...prev,
        screenshots: prev.screenshots.map(screenshot =>
          screenshot.id === screenshotId
            ? {
                ...screenshot,
                aiAnalysis: analysis,
                analysisStatus,
                analysisError,
              }
            : screenshot
        ),
      };
    });
  }, []);

  // Add screenshot comment
  const addScreenshotComment = useCallback((screenshotId: string, comment: string) => {
    setActiveSession(prev => {
      if (!prev) {
        console.warn('[ActiveSessionContext] Cannot add comment: no active session');
        return prev;
      }

      return {
        ...prev,
        screenshots: prev.screenshots.map(screenshot =>
          screenshot.id === screenshotId
            ? { ...screenshot, userComment: comment }
            : screenshot
        ),
      };
    });
  }, []);

  // Toggle screenshot flag
  const toggleScreenshotFlag = useCallback((screenshotId: string) => {
    setActiveSession(prev => {
      if (!prev) {
        console.warn('[ActiveSessionContext] Cannot toggle flag: no active session');
        return prev;
      }

      return {
        ...prev,
        screenshots: prev.screenshots.map(screenshot =>
          screenshot.id === screenshotId
            ? { ...screenshot, flagged: !screenshot.flagged }
            : screenshot
        ),
      };
    });
  }, []);

  // Add extracted task
  // Note: This maintains backward compatibility with extractedTaskIds array
  // The actual relationship creation should happen in SessionListContext.linkSessionToTask()
  const addExtractedTask = useCallback((taskId: string) => {
    setActiveSession(prev => {
      if (!prev) {
        console.warn('[ActiveSessionContext] Cannot add task: no active session');
        return prev;
      }

      return {
        ...prev,
        extractedTaskIds: [...prev.extractedTaskIds, taskId],
      };
    });
  }, []);

  // Add extracted note
  // Note: This maintains backward compatibility with extractedNoteIds array
  // The actual relationship creation should happen in SessionListContext.linkSessionToNote()
  const addExtractedNote = useCallback((noteId: string) => {
    setActiveSession(prev => {
      if (!prev) {
        console.warn('[ActiveSessionContext] Cannot add note: no active session');
        return prev;
      }

      return {
        ...prev,
        extractedNoteIds: [...prev.extractedNoteIds, noteId],
      };
    });
  }, []);

  // Add context item
  const addContextItem = useCallback((item: SessionContextItem) => {
    setActiveSession(prev => {
      if (!prev) {
        console.warn('[ActiveSessionContext] Cannot add context item: no active session');
        return prev;
      }

      return {
        ...prev,
        contextItems: [...(prev.contextItems || []), item],
      };
    });
  }, []);

  // NOTE: We intentionally do NOT sync active sessions to SessionListContext during recording.
  // Reason: This was causing a stale state bug where screenshots would appear then disappear.
  // The 1-second debounced sync would overwrite fresh data with stale data.
  // Active sessions are the source of truth in ActiveSessionContext.
  // SessionListContext gets the final session when endSession() is called.
  // See: /docs/sessions-rewrite/ACTIVITY_DISAPPEARING_BUG.md

  const value: ActiveSessionContextValue = {
    activeSession,
    activeSessionId: activeSession?.id,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    restoreSession,
    loadSession,
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
