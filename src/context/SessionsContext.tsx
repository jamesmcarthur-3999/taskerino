import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Session, SessionScreenshot, SessionAudioSegment, SessionContextItem } from '../types';
import { generateId } from '../utils/helpers';
import { getStorage } from '../services/storage';
import { attachmentStorage } from '../services/attachmentStorage';
import { audioConcatenationService } from '../services/audioConcatenationService';
import { keyMomentsDetectionService } from '../services/keyMomentsDetectionService';
import { sessionEnrichmentService } from '../services/sessionEnrichmentService';
import { validateAudioConfig, validateVideoConfig, validateSession } from '../utils/sessionValidation';
import { useUI } from './UIContext';
import { useEnrichmentContext } from './EnrichmentContext';
import { getPersistenceQueue } from '../services/storage/PersistenceQueue';
import { QueryEngine, type QueryFilter, type QuerySort } from '../services/storage/QueryEngine';

interface SessionsState {
  sessions: Session[];
  activeSessionId?: string;
}

interface CleanupMetrics {
  sessionEnds: {
    total: number;
    successful: number;
    failed: number;
    screenshotCleanupFailures: number;
    audioCleanupFailures: number;
  };
  sessionDeletes: {
    total: number;
    successful: number;
    failed: number;
    attachmentCleanupFailures: number;
  };
  audioQueueCleanup: {
    sessionsCleared: number;
    totalChunksDropped: number;
  };
}

type SessionsAction =
  | { type: 'START_SESSION'; payload: Omit<Session, 'id' | 'startTime' | 'screenshots' | 'extractedTaskIds' | 'extractedNoteIds'> }
  | { type: 'END_SESSION'; payload: string }
  | { type: 'PAUSE_SESSION'; payload: string }
  | { type: 'RESUME_SESSION'; payload: string }
  | { type: 'UPDATE_SESSION'; payload: Session }
  | { type: 'DELETE_SESSION'; payload: string }
  | { type: 'ADD_SESSION_SCREENSHOT'; payload: { sessionId: string; screenshot: SessionScreenshot } }
  | { type: 'ADD_SESSION_AUDIO_SEGMENT'; payload: { sessionId: string; audioSegment: SessionAudioSegment } }
  | { type: 'DELETE_AUDIO_SEGMENT_FILE'; payload: { sessionId: string; segmentId: string } }
  | { type: 'UPDATE_SCREENSHOT_ANALYSIS'; payload: { screenshotId: string; analysis: SessionScreenshot['aiAnalysis']; analysisStatus: SessionScreenshot['analysisStatus']; analysisError?: string } }
  | { type: 'ADD_SCREENSHOT_COMMENT'; payload: { screenshotId: string; comment: string } }
  | { type: 'TOGGLE_SCREENSHOT_FLAG'; payload: string }
  | { type: 'SET_ACTIVE_SESSION'; payload: string | undefined }
  | { type: 'ADD_EXTRACTED_TASK_TO_SESSION'; payload: { sessionId: string; taskId: string } }
  | { type: 'ADD_EXTRACTED_NOTE_TO_SESSION'; payload: { sessionId: string; noteId: string } }
  | { type: 'ADD_SESSION_CONTEXT_ITEM'; payload: { sessionId: string; contextItem: SessionContextItem } }
  | { type: 'UPDATE_CONTEXT_ITEM'; payload: { sessionId: string; contextItemId: string; content: string } }
  | { type: 'DELETE_CONTEXT_ITEM'; payload: { sessionId: string; contextItemId: string } }
  | { type: 'LOAD_SESSIONS'; payload: Partial<SessionsState> }
  | { type: 'MARK_SESSION_INTERRUPTED'; payload: string };

const initialState: SessionsState = {
  sessions: [],
  activeSessionId: undefined,
};

function sessionsReducer(state: SessionsState, action: SessionsAction): SessionsState {
  switch (action.type) {
    case 'START_SESSION': {
      // Validate required fields
      if (!action.payload.name || action.payload.name.trim() === '') {
        console.error('[START_SESSION] Validation failed: Session name is required');
        return state;
      }

      // Validate audioConfig if provided
      if (action.payload.audioConfig) {
        const audioValidation = validateAudioConfig(action.payload.audioConfig);
        if (!audioValidation.valid) {
          console.error('[START_SESSION] Audio config validation failed:', audioValidation.errors);
          return state;
        }
      }

      // Validate videoConfig if provided
      if (action.payload.videoConfig) {
        const videoValidation = validateVideoConfig(action.payload.videoConfig);
        if (!videoValidation.valid) {
          console.error('[START_SESSION] Video config validation failed:', videoValidation.errors);
          return state;
        }
      }

      // Create the session
      const newSession: Session = {
        ...action.payload,
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
        console.error('[START_SESSION] Complete session validation failed:', sessionValidation.errors);
        return state;
      }

      console.log('[START_SESSION] Validation passed, creating session:', newSession.id);
      return {
        ...state,
        sessions: [...state.sessions, newSession],
        activeSessionId: newSession.id,
      };
    }

    case 'END_SESSION': {
      const sessionId = action.payload;
      const session = state.sessions.find(s => s.id === sessionId);

      // Validation: Prevent double-ending
      if (!session) {
        console.warn('Attempted to end non-existent session:', sessionId);
        return state;
      }

      if (session.status === 'completed') {
        console.warn('Attempted to end already-completed session:', sessionId);
        return state;
      }

      // Continue with existing end logic...
      return {
        ...state,
        sessions: state.sessions.map(session => {
          if (session.id !== sessionId) return session;

          const endTime = new Date().toISOString();
          let totalDuration: number | undefined;

          if (session.startTime) {
            const startMs = new Date(session.startTime).getTime();
            const endMs = new Date(endTime).getTime();
            let totalPausedMs = session.totalPausedTime || 0;

            if (session.status === 'paused' && session.pausedAt) {
              const currentPauseDuration = endMs - new Date(session.pausedAt).getTime();
              totalPausedMs += currentPauseDuration;
            }

            const activeMs = endMs - startMs - totalPausedMs;
            totalDuration = Math.floor(activeMs / 60000);
          }

          return {
            ...session,
            status: 'completed',
            endTime,
            totalDuration,
            pausedAt: undefined,
          };
        }),
        activeSessionId: state.activeSessionId === sessionId ? undefined : state.activeSessionId,
      };
    }

    case 'PAUSE_SESSION': {
      const sessionId = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                status: 'paused',
                pausedAt: new Date().toISOString(),
              }
            : session
        ),
      };
    }

    case 'RESUME_SESSION': {
      const sessionId = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session => {
          if (session.id !== sessionId) return session;

          let additionalPausedTime = 0;
          if (session.pausedAt) {
            const pauseStart = new Date(session.pausedAt).getTime();
            const pauseEnd = new Date().getTime();
            additionalPausedTime = pauseEnd - pauseStart;
          }

          return {
            ...session,
            status: 'active',
            pausedAt: undefined,
            totalPausedTime: (session.totalPausedTime || 0) + additionalPausedTime,
          };
        }),
        activeSessionId: sessionId,
      };
    }

    case 'UPDATE_SESSION': {
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === action.payload.id ? { ...session, ...action.payload } : session
        ),
      };
    }

    case 'DELETE_SESSION': {
      audioConcatenationService.clearCache(action.payload);
      keyMomentsDetectionService.clearCache(action.payload);

      return {
        ...state,
        sessions: state.sessions.filter(session => session.id !== action.payload),
        activeSessionId: state.activeSessionId === action.payload ? undefined : state.activeSessionId,
      };
    }

    case 'ADD_SESSION_SCREENSHOT': {
      const { sessionId, screenshot } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                screenshots: [...session.screenshots, screenshot],
                lastScreenshotTime: screenshot.timestamp,
              }
            : session
        ),
      };
    }

    case 'ADD_SESSION_AUDIO_SEGMENT': {
      const { sessionId, audioSegment } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session => {
          if (session.id !== sessionId) return session;

          // Check if segment already exists (by ID)
          const existingSegment = session.audioSegments?.find(s => s.id === audioSegment.id);
          if (existingSegment) {
            console.warn('⚠️ [SESSIONS CONTEXT] Attempted to add duplicate audio segment:', audioSegment.id);
            return session; // Don't add duplicate
          }

          return {
            ...session,
            audioSegments: [...(session.audioSegments || []), audioSegment],
          };
        }),
      };
    }

    case 'DELETE_AUDIO_SEGMENT_FILE': {
      const { sessionId, segmentId } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                audioSegments: (session.audioSegments || []).map(segment =>
                  segment.id === segmentId
                    ? { ...segment, filePath: undefined }
                    : segment
                ),
              }
            : session
        ),
      };
    }

    case 'UPDATE_SCREENSHOT_ANALYSIS': {
      const { screenshotId, analysis, analysisStatus, analysisError } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session => ({
          ...session,
          screenshots: (session.screenshots || []).map(screenshot =>
            screenshot.id === screenshotId
              ? {
                  ...screenshot,
                  aiAnalysis: analysis,
                  analysisStatus,
                  analysisError,
                }
              : screenshot
          ),
        })),
      };
    }

    case 'ADD_SCREENSHOT_COMMENT': {
      const { screenshotId, comment } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session => ({
          ...session,
          screenshots: (session.screenshots || []).map(screenshot =>
            screenshot.id === screenshotId
              ? { ...screenshot, userComment: comment }
              : screenshot
          ),
        })),
      };
    }

    case 'TOGGLE_SCREENSHOT_FLAG': {
      const screenshotId = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session => ({
          ...session,
          screenshots: (session.screenshots || []).map(screenshot =>
            screenshot.id === screenshotId
              ? { ...screenshot, flagged: !screenshot.flagged }
              : screenshot
          ),
        })),
      };
    }

    case 'SET_ACTIVE_SESSION': {
      return {
        ...state,
        activeSessionId: action.payload,
      };
    }

    case 'ADD_EXTRACTED_TASK_TO_SESSION': {
      const { sessionId, taskId } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                extractedTaskIds: [...session.extractedTaskIds, taskId],
              }
            : session
        ),
      };
    }

    case 'ADD_EXTRACTED_NOTE_TO_SESSION': {
      const { sessionId, noteId } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                extractedNoteIds: [...session.extractedNoteIds, noteId],
              }
            : session
        ),
      };
    }

    case 'ADD_SESSION_CONTEXT_ITEM': {
      const { sessionId, contextItem } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                contextItems: [...(session.contextItems || []), contextItem],
              }
            : session
        ),
      };
    }

    case 'LOAD_SESSIONS':
      return { ...state, ...action.payload };

    case 'MARK_SESSION_INTERRUPTED': {
      const sessionId = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? { ...session, status: 'interrupted' }
            : session
        ),
      };
    }

    default:
      return state;
  }
}

interface SessionsContextType {
  sessions: Session[];
  activeSessionId?: string;

  startSession: (session: Omit<Session, 'id' | 'startTime' | 'screenshots' | 'extractedTaskIds' | 'extractedNoteIds'>) => void;
  endSession: (id: string) => Promise<void>;
  pauseSession: (id: string) => void;
  resumeSession: (id: string) => void;
  updateSession: (session: Session) => void;
  deleteSession: (id: string) => Promise<void>; // Fix #9: Now async to clean up attachments
  addScreenshot: (sessionId: string, screenshot: SessionScreenshot) => void;
  addAudioSegment: (sessionId: string, segment: SessionAudioSegment) => void;
  deleteAudioSegmentFile: (sessionId: string, segmentId: string) => void;
  updateScreenshotAnalysis: (screenshotId: string, analysis: any, status: SessionScreenshot['analysisStatus'], error?: string) => void;
  addScreenshotComment: (screenshotId: string, comment: string) => void;
  toggleScreenshotFlag: (screenshotId: string) => void;
  setActiveSession: (id?: string) => void;
  addExtractedTask: (sessionId: string, taskId: string) => void;
  addExtractedNote: (sessionId: string, noteId: string) => void;
  addContextItem: (sessionId: string, item: SessionContextItem) => void;
  getCleanupMetrics: () => CleanupMetrics;

  // Query Engine Methods (Phase 3.3)
  querySessions: (filters: QueryFilter[], sort?: QuerySort, limit?: number) => Promise<Session[]>;
}

const SessionsContext = createContext<SessionsContextType | undefined>(undefined);

// Critical actions that need immediate save
const CRITICAL_ACTIONS = new Set([
  'END_SESSION',
  'DELETE_SESSION',
  'START_SESSION',
  'UPDATE_SESSION',
  'ADD_SESSION_SCREENSHOT',
  'ADD_SESSION_AUDIO_SEGMENT',
  'UPDATE_SCREENSHOT_ANALYSIS',
  'ADD_SESSION_CONTEXT_ITEM',
  'MARK_SESSION_INTERRUPTED',
]);

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(sessionsReducer, initialState);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const stateRef = useRef(state);
  const { addNotification } = useUI();
  const { startTracking, updateProgress, stopTracking } = useEnrichmentContext();
  const queue = getPersistenceQueue();

  // Audio chunk queue management (Fix #7: Prevent unbounded memory growth)
  const audioChunkQueueRef = useRef<Map<string, SessionAudioSegment[]>>(new Map()); // sessionId -> queue
  const processingAudioRef = useRef<Map<string, boolean>>(new Map()); // sessionId -> isProcessing

  // Cleanup metrics tracking
  const cleanupMetricsRef = useRef<CleanupMetrics>({
    sessionEnds: {
      total: 0,
      successful: 0,
      failed: 0,
      screenshotCleanupFailures: 0,
      audioCleanupFailures: 0,
    },
    sessionDeletes: {
      total: 0,
      successful: 0,
      failed: 0,
      attachmentCleanupFailures: 0,
    },
    audioQueueCleanup: {
      sessionsCleared: 0,
      totalChunksDropped: 0,
    },
  });

  // Keep stateRef up to date
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Audio chunk queue processor (Fix #7: Backpressure handling)
  const processAudioChunkQueue = React.useCallback(async (sessionId: string) => {
    if (processingAudioRef.current.get(sessionId)) return; // Already processing
    processingAudioRef.current.set(sessionId, true);

    const queue = audioChunkQueueRef.current.get(sessionId) || [];
    const MAX_QUEUE_SIZE = 50;

    // Process chunks in batches
    while (queue.length > 0) {
      const chunk = queue.shift();
      if (!chunk) break;

      // Dispatch to reducer
      baseDispatch({ type: 'ADD_SESSION_AUDIO_SEGMENT', payload: { sessionId, audioSegment: chunk } });

      // Small delay to prevent overwhelming storage
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    processingAudioRef.current.set(sessionId, false);
  }, []);

  // Custom dispatch wrapper that immediately saves for critical actions
  const dispatch = React.useCallback((action: SessionsAction) => {
    console.log('[DISPATCH] Action fired:', action.type, action.payload);
    baseDispatch(action);

    // If critical action, enqueue with critical priority (immediate processing)
    if (CRITICAL_ACTIONS.has(action.type)) {
      console.log('[DISPATCH] Critical action detected, enqueueing with critical priority:', action.type);
      queueMicrotask(async () => {
        await new Promise(resolve => requestAnimationFrame(resolve));

        console.log(`[DISPATCH] Critical action ${action.type} - enqueueing to persistence queue`);

        // Enqueue sessions with critical priority
        queue.enqueue('sessions', stateRef.current.sessions, 'critical');

        // Enqueue settings with critical priority
        try {
          const storage = await getStorage();
          const settings = await storage.load<any>('settings') || {};
          queue.enqueue('settings', {
            ...settings,
            activeSessionId: stateRef.current.activeSessionId,
          }, 'critical');
        } catch (error) {
          console.error('Failed to load settings for critical save:', error);
        }

        console.log('Critical session data enqueued for immediate persistence');

          // Auto-trigger enrichment when session ends
          if (action.type === 'END_SESSION') {
            console.log('[AUTO-ENRICH] END_SESSION detected');
            const sessionId = action.payload;
            const endedSession = stateRef.current.sessions.find(s => s.id === sessionId);

            if (!endedSession) {
              console.error('[AUTO-ENRICH] ERROR: Could not find ended session with ID:', sessionId);
              return;
            }

            console.log('🎯 [AUTO-ENRICH] Session ended, triggering background enrichment:', endedSession.name);
            console.log('[AUTO-ENRICH] Session data:', {
              id: endedSession.id,
              audioSegments: endedSession.audioSegments?.length || 0,
              videoAttachment: !!endedSession.video?.fullVideoAttachmentId,
              hasEnrichmentStatus: !!endedSession.enrichmentStatus,
            });

            // Check if session has enrichable content
            console.log('[AUTO-ENRICH] Checking if session can be enriched...');
            const capability = await sessionEnrichmentService.canEnrich(endedSession);
            console.log('[AUTO-ENRICH] Enrichment capability:', capability);

              if (capability.audio || capability.video) {
                console.log('✨ [AUTO-ENRICH] Starting enrichment in background...', {
                  audio: capability.audio,
                  video: capability.video,
                });

                // Start tracking enrichment in EnrichmentContext (for rainbow border UI)
                startTracking(sessionId, endedSession.name);

                // Trigger enrichment in the background (fire-and-forget)
                // The enrichmentService will initialize enrichmentStatus properly
                // This won't block the UI or session ending
                sessionEnrichmentService.enrichSession(endedSession, {
                  includeAudio: capability.audio,
                  includeVideo: capability.video,
                  includeSummary: true,
                  includeCanvas: true, // Generate canvas as part of enrichment
                  // Force regeneration if video enrichment not completed (handles failed/interrupted enrichments)
                  forceRegenerate: endedSession.enrichmentStatus?.video?.status !== 'completed',
                  onProgress: (progress) => {
                    console.log(`🔄 [AUTO-ENRICH] ${progress.stage}: ${progress.message} (${progress.progress}%)`);

                    // Update EnrichmentContext for real-time UI (rainbow border)
                    // This is in-memory only - no storage writes, avoiding storage thrashing
                    updateProgress(sessionId, progress);
                  },
                }).then(async (result) => {
                  console.log('✅ [AUTO-ENRICH] Background enrichment completed successfully', {
                    totalCost: result.totalCost,
                    audioCompleted: result.audio?.completed,
                    videoCompleted: result.video?.completed,
                  });

                  // Stop tracking enrichment
                  stopTracking(sessionId);

                  // Notify user of successful enrichment completion
                  addNotification({
                    type: 'success',
                    title: 'Session Enriched',
                    message: `"${endedSession.name}" enrichment complete ${result.totalCost ? `(Cost: $${result.totalCost.toFixed(2)})` : ''}`,
                  });

                  // Update React state with enriched session (including canvas)
                  try {
                    const storage = await getStorage();
                    const sessions = await storage.load<Session[]>('sessions');

                    if (sessions) {
                      // Canvas was generated as part of enrichment - no need to clear cache
                      console.log('✅ [AUTO-ENRICH] React state updated with enriched session (including canvas)');

                      // Use LOAD_SESSIONS to reload the enriched session from storage
                      dispatch({
                        type: 'LOAD_SESSIONS',
                        payload: { sessions }
                      });
                    }
                  } catch (error) {
                    console.error('❌ [AUTO-ENRICH] Failed to update React state:', error);
                  }
                }).catch(async (error) => {
                  console.error('❌ [AUTO-ENRICH] Background enrichment failed:', error.message);

                  // Stop tracking enrichment on failure
                  stopTracking(sessionId);

                  // Notify user of enrichment failure
                  addNotification({
                    type: 'error',
                    title: 'Enrichment Failed',
                    message: `Failed to enrich "${endedSession.name}": ${error.message}`,
                  });

                  // CRITICAL FIX: Reload sessions from storage to sync enrichmentStatus
                  // The enrichment service writes enrichmentStatus='failed' directly to storage,
                  // but React state is stale. Without reloading, the debounced save (5s later)
                  // overwrites storage with stale data, causing session to disappear.
                  try {
                    console.log('🔄 [AUTO-ENRICH] Reloading sessions from storage to sync failed enrichmentStatus');
                    const storage = await getStorage();
                    const sessions = await storage.load<Session[]>('sessions');

                    if (sessions) {
                      // Reload sessions to sync enrichmentStatus (failure state)
                      // Note: Canvas may have been partially generated before failure - preserve it
                      console.log('✅ [AUTO-ENRICH] React state synced after enrichment failure');

                      // Use LOAD_SESSIONS to reload from storage
                      dispatch({
                        type: 'LOAD_SESSIONS',
                        payload: { sessions }
                      });
                    }
                  } catch (reloadError) {
                    console.error('❌ [AUTO-ENRICH] CRITICAL: Failed to reload sessions after enrichment failure:', reloadError);
                    // This is critical - if we can't reload, the session may be lost
                  }

                  // Errors are logged but don't interrupt the user experience
                });
              } else {
                console.log('⏭️ [AUTO-ENRICH] No enrichable content, skipping');
                console.log('[AUTO-ENRICH] Reasons:', {
                  audioReason: capability.reasons.audio,
                  videoReason: capability.reasons.video,
                  audioCapable: capability.audio,
                  videoCapable: capability.video,
                });
              }
          }
      });
    }
  }, [queue, startTracking, updateProgress, stopTracking]);

  // Load sessions on mount
  useEffect(() => {
    async function loadSessions() {
      try {
        const storage = await getStorage();
        const [sessions, settings] = await Promise.all([
          storage.load<Session[]>('sessions'),
          storage.load<any>('settings')
        ]);

        // Migrate old sessions to ensure backward compatibility
        const rawSessionCount = Array.isArray(sessions) ? sessions.length : 0;
        const migratedSessions = Array.isArray(sessions)
          ? sessions.map(session => {
              const migrated = { ...session };

              // Validate required fields exist (defensive check for corrupted data)
              if (!migrated.id || !migrated.name || !migrated.startTime) {
                console.warn('⚠️ [MIGRATION] Skipping corrupted session:', migrated.id, 'missing required fields');
                return null;
              }

              // Validate startTime is parseable
              const startDate = new Date(migrated.startTime);
              if (isNaN(startDate.getTime())) {
                console.warn('⚠️ [MIGRATION] Skipping session with invalid date:', migrated.id, migrated.startTime);
                return null;
              }

              // Ensure backwards compatibility for optional fields
              // Old sessions don't have audioConfig/videoConfig, which is fine (they're optional)
              // Clean up null values (should be undefined for optional fields)
              if (migrated.audioConfig === null) {
                delete migrated.audioConfig;
              }
              if (migrated.videoConfig === null) {
                delete migrated.videoConfig;
              }

              return migrated;
            })
            .filter((s): s is Session => s !== null) // Remove null entries from corrupted sessions
          : [];

        console.log(`📊 [LOAD_SESSIONS] Loaded ${migratedSessions.length} sessions (${rawSessionCount} raw, ${rawSessionCount - migratedSessions.length} filtered out)`);
        if (rawSessionCount > 0) {
          console.log('Session statuses:', {
            active: migratedSessions.filter(s => s.status === 'active').length,
            paused: migratedSessions.filter(s => s.status === 'paused').length,
            completed: migratedSessions.filter(s => s.status === 'completed').length,
            interrupted: migratedSessions.filter(s => s.status === 'interrupted').length,
          });
        }

        dispatch({
          type: 'LOAD_SESSIONS',
          payload: {
            sessions: migratedSessions,
            activeSessionId: settings?.activeSessionId,
          },
        });

        // Crash Recovery: Detect interrupted sessions (active or paused when app closed)
        if (Array.isArray(sessions)) {
          const interruptedSessions = sessions.filter(
            session => session.status === 'active' || session.status === 'paused'
          );

          if (interruptedSessions.length > 0) {
            console.log('[CRASH RECOVERY] Detected interrupted sessions:', interruptedSessions.length);

            // Mark each interrupted session
            for (const session of interruptedSessions) {
              console.log(`[CRASH RECOVERY] Marking session "${session.name}" (${session.id}) as interrupted`);
              dispatch({
                type: 'MARK_SESSION_INTERRUPTED',
                payload: session.id,
              });
            }

            console.log('[CRASH RECOVERY] All interrupted sessions have been marked');
          } else {
            console.log('[CRASH RECOVERY] No interrupted sessions detected');
          }

          // Enrichment Crash Recovery: Detect stalled enrichments (app crashed during enrichment)
          const stalledEnrichments = sessions.filter(
            session => session.enrichmentStatus?.status === 'in-progress'
          );

          if (stalledEnrichments.length > 0) {
            console.log('[ENRICHMENT CRASH RECOVERY] Detected stalled enrichments:', stalledEnrichments.length);

            // Mark each stalled enrichment as failed
            for (const session of stalledEnrichments) {
              console.log(`[ENRICHMENT CRASH RECOVERY] Marking enrichment failed for "${session.name}" (${session.id})`);

              // Update enrichmentStatus to failed state
              const updatedSession: Session = {
                ...session,
                enrichmentStatus: session.enrichmentStatus ? {
                  ...session.enrichmentStatus,
                  status: 'failed' as const,
                  progress: session.enrichmentStatus.progress ?? 0,
                  currentStage: session.enrichmentStatus.currentStage ?? 'audio',
                  errors: [
                    ...(session.enrichmentStatus.errors || []),
                    'Enrichment interrupted due to app crash or unexpected closure'
                  ],
                  completedAt: new Date().toISOString(),
                } : undefined,
              };

              dispatch({
                type: 'UPDATE_SESSION',
                payload: updatedSession,
              });
            }

            console.log('[ENRICHMENT CRASH RECOVERY] All stalled enrichments marked as failed');
          } else {
            console.log('[ENRICHMENT CRASH RECOVERY] No stalled enrichments detected');
          }
        }

        setHasLoaded(true);
      } catch (error) {
        console.error('Failed to load sessions:', error);
        setHasLoaded(true);
      }
    }

    loadSessions();
  }, []);

  // Flush queue on window/app close - critical safety net
  useEffect(() => {
    const handleBeforeUnload = async () => {
      console.log('App closing - flushing persistence queue');
      try {
        await queue.shutdown();
        console.log('Persistence queue flushed successfully');
      } catch (error) {
        console.error('Failed to flush persistence queue:', error);
        // Fallback: try direct save
        try {
          const storage = await getStorage();
          await storage.save('sessions', stateRef.current.sessions);

          const settings = await storage.load<any>('settings') || {};
          await storage.save('settings', {
            ...settings,
            activeSessionId: stateRef.current.activeSessionId,
          });
          console.log('Fallback save complete');
        } catch (fallbackError) {
          console.error('Fallback save also failed:', fallbackError);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [queue]);

  // Periodic auto-save for active sessions - limits data loss to 30 seconds
  // Uses critical priority to ensure immediate persistence
  useEffect(() => {
    if (!hasLoaded || !state.activeSessionId) return;

    console.log('Starting periodic auto-save for active session');

    const interval = setInterval(async () => {
      console.log('Periodic auto-save for active session (critical priority)');
      // Enqueue with critical priority for immediate processing
      queue.enqueue('sessions', stateRef.current.sessions, 'critical');

      // Also save activeSessionId to settings
      try {
        const storage = await getStorage();
        const settings = await storage.load<any>('settings') || {};
        queue.enqueue('settings', {
          ...settings,
          activeSessionId: stateRef.current.activeSessionId,
        }, 'critical');
      } catch (error) {
        console.error('Periodic auto-save settings enqueue failed:', error);
      }
    }, 30000); // Every 30 seconds

    return () => {
      console.log('Stopping periodic auto-save');
      clearInterval(interval);
    };
  }, [hasLoaded, state.activeSessionId, queue]);

  // Save sessions using persistence queue (replaces debounced saves)
  useEffect(() => {
    if (!hasLoaded) return;

    // Enqueue sessions with normal priority (batched 100ms)
    queue.enqueue('sessions', state.sessions, 'normal');

    // Enqueue settings with normal priority (batched 100ms)
    // We need to load current settings first to avoid overwriting
    (async () => {
      try {
        const storage = await getStorage();
        const settings = await storage.load<any>('settings') || {};
        queue.enqueue('settings', {
          ...settings,
          activeSessionId: state.activeSessionId,
        }, 'normal');
      } catch (error) {
        console.error('Failed to load settings for queue save:', error);
      }
    })();
  }, [hasLoaded, state.sessions, state.activeSessionId, queue]);

  const value: SessionsContextType = {
    sessions: state.sessions,
    activeSessionId: state.activeSessionId,

    startSession: React.useCallback((session: Omit<Session, 'id' | 'startTime' | 'screenshots' | 'extractedTaskIds' | 'extractedNoteIds'>) => {
      dispatch({ type: 'START_SESSION', payload: session });
    }, [dispatch]),

    endSession: React.useCallback(async (id: string) => {
      console.log('[SESSION END] Starting cleanup for session:', id);

      // Track metrics: increment total
      cleanupMetricsRef.current.sessionEnds.total++;
      let hadErrors = false;

      // NOTE: Final summary generation removed - now handled by enrichment service
      // This eliminates 2-10 second UI freeze when ending session

      // Import services dynamically to avoid circular dependencies
      const { screenshotCaptureService } = await import('../services/screenshotCaptureService');
      const { audioRecordingService } = await import('../services/audioRecordingService');

      // Stop screenshot capture (only if this session is active)
      try {
        const activeScreenshotSessionId = screenshotCaptureService.getActiveSessionId();
        if (activeScreenshotSessionId === id) {
          console.log('[SESSION END] Stopping screenshot capture for session:', id);
          screenshotCaptureService.stopCapture();
          console.log('[SESSION END] Screenshot capture stopped');
        } else {
          console.log('[SESSION END] Screenshot capture not active for this session (active:', activeScreenshotSessionId, ')');
        }
      } catch (error) {
        console.error('[SESSION END] Failed to stop screenshot capture:', error);
        cleanupMetricsRef.current.sessionEnds.screenshotCleanupFailures++;
        hadErrors = true;
        addNotification({
          type: 'warning',
          title: 'Cleanup Warning',
          message: 'Failed to stop screenshot capture. Resources may still be active.',
        });
      }

      // Stop audio recording (only if this session is active)
      try {
        const activeAudioSessionId = audioRecordingService.getActiveSessionId();
        if (activeAudioSessionId === id) {
          console.log('[SESSION END] Stopping audio recording for session:', id);
          await audioRecordingService.stopRecording();
          console.log('[SESSION END] Audio recording stopped');
        } else {
          console.log('[SESSION END] Audio recording not active for this session (active:', activeAudioSessionId, ')');
        }
      } catch (error) {
        console.error('[SESSION END] Failed to stop audio recording:', error);
        cleanupMetricsRef.current.sessionEnds.audioCleanupFailures++;
        hadErrors = true;
        addNotification({
          type: 'warning',
          title: 'Cleanup Warning',
          message: 'Failed to stop audio recording. Resources may still be active.',
        });
      }

      // Fix #7: Clear audio chunk queue to prevent memory leak
      const queue = audioChunkQueueRef.current.get(id);
      const droppedChunks = queue?.length || 0;

      audioChunkQueueRef.current.delete(id);
      processingAudioRef.current.delete(id);

      // Track queue cleanup metrics
      if (droppedChunks > 0) {
        cleanupMetricsRef.current.audioQueueCleanup.sessionsCleared++;
        cleanupMetricsRef.current.audioQueueCleanup.totalChunksDropped += droppedChunks;
        console.log(`[SESSION END] Audio queue cleared (${droppedChunks} chunks dropped)`);
      } else {
        console.log('[SESSION END] Audio queue cleared');
      }


      dispatch({ type: 'END_SESSION', payload: id });

      // Track success/failure
      if (hadErrors) {
        cleanupMetricsRef.current.sessionEnds.failed++;
      } else {
        cleanupMetricsRef.current.sessionEnds.successful++;
      }
    }, [dispatch, addNotification]),

    pauseSession: React.useCallback((id: string) => {
      dispatch({ type: 'PAUSE_SESSION', payload: id });
    }, [dispatch]),

    resumeSession: React.useCallback((id: string) => {
      dispatch({ type: 'RESUME_SESSION', payload: id });
    }, [dispatch]),

    updateSession: React.useCallback((session: Session) => {
      dispatch({ type: 'UPDATE_SESSION', payload: session });
    }, [dispatch]),

    deleteSession: React.useCallback(async (id: string) => {
      // Track metrics: increment total
      cleanupMetricsRef.current.sessionDeletes.total++;
      let hadErrors = false;

      // Find the session being deleted
      const session = state.sessions.find(s => s.id === id);

      if (!session) {
        console.warn('Attempted to delete non-existent session:', id);
        cleanupMetricsRef.current.sessionDeletes.failed++;
        return;
      }

      // Check if enrichment is in progress
      if (session.enrichmentStatus?.status === 'in-progress') {
        console.warn('Cannot delete session while enrichment is in progress:', session.name);
        cleanupMetricsRef.current.sessionDeletes.failed++;
        throw new Error('Cannot delete session while enrichment is in progress. Please wait for enrichment to complete or cancel it first.');
      }

      // Fix #9: Delete all associated attachments before deleting the session
      console.log(`[DELETE SESSION] Collecting attachments for session "${session.name}" (${id})`);
      const { collectSessionAttachmentIds } = await import('../utils/sessionCleanup');
      const attachmentIds = collectSessionAttachmentIds(session);

      if (attachmentIds.length > 0) {
        console.log(`[DELETE SESSION] Found ${attachmentIds.length} attachments to delete`);
        try {
          // Delete attachments - handles missing files gracefully
          await attachmentStorage.deleteAttachments(attachmentIds);
          console.log(`[DELETE SESSION] Successfully cleaned up attachments`);
        } catch (error) {
          // Log error but don't block session deletion
          console.error(`[DELETE SESSION] Error cleaning up attachments (continuing anyway):`, error);
          cleanupMetricsRef.current.sessionDeletes.attachmentCleanupFailures++;
          hadErrors = true;
          addNotification({
            type: 'warning',
            title: 'Cleanup Warning',
            message: 'Some attachment files could not be deleted. Storage cleanup may be incomplete.',
          });
        }
      } else {
        console.log(`[DELETE SESSION] No attachments to clean up`);
      }

      // Now delete the session
      dispatch({ type: 'DELETE_SESSION', payload: id });

      // Track success/failure
      if (hadErrors) {
        cleanupMetricsRef.current.sessionDeletes.failed++;
      } else {
        cleanupMetricsRef.current.sessionDeletes.successful++;
      }
    }, [dispatch, state.sessions, addNotification]),

    addScreenshot: React.useCallback((sessionId: string, screenshot: SessionScreenshot) => {
      dispatch({ type: 'ADD_SESSION_SCREENSHOT', payload: { sessionId, screenshot } });
    }, [dispatch]),

    addAudioSegment: React.useCallback((sessionId: string, audioSegment: SessionAudioSegment) => {
      // Fix #7: Use queue management with backpressure handling
      const MAX_QUEUE_SIZE = 50;

      // Get or create queue for this session
      let queue = audioChunkQueueRef.current.get(sessionId);
      if (!queue) {
        queue = [];
        audioChunkQueueRef.current.set(sessionId, queue);
      }

      // Fix #7: Enforce queue size limit by dropping oldest chunks
      if (queue.length >= MAX_QUEUE_SIZE) {
        const dropped = queue.shift(); // Remove oldest chunk
        console.warn(`[AUDIO QUEUE] Dropped chunk ${dropped?.id} due to backpressure (session: ${sessionId})`);
      }

      // Add to queue
      queue.push(audioSegment);

      // Start processing the queue
      processAudioChunkQueue(sessionId);
    }, [processAudioChunkQueue]),

    deleteAudioSegmentFile: React.useCallback((sessionId: string, segmentId: string) => {
      dispatch({ type: 'DELETE_AUDIO_SEGMENT_FILE', payload: { sessionId, segmentId } });
    }, [dispatch]),

    updateScreenshotAnalysis: React.useCallback((screenshotId: string, analysis: any, analysisStatus: SessionScreenshot['analysisStatus'], analysisError?: string) => {
      dispatch({ type: 'UPDATE_SCREENSHOT_ANALYSIS', payload: { screenshotId, analysis, analysisStatus, analysisError } });
    }, [dispatch]),

    addScreenshotComment: React.useCallback((screenshotId: string, comment: string) => {
      dispatch({ type: 'ADD_SCREENSHOT_COMMENT', payload: { screenshotId, comment } });
    }, [dispatch]),

    toggleScreenshotFlag: React.useCallback((screenshotId: string) => {
      dispatch({ type: 'TOGGLE_SCREENSHOT_FLAG', payload: screenshotId });
    }, [dispatch]),

    setActiveSession: React.useCallback((id?: string) => {
      dispatch({ type: 'SET_ACTIVE_SESSION', payload: id });
    }, [dispatch]),

    addExtractedTask: React.useCallback((sessionId: string, taskId: string) => {
      dispatch({ type: 'ADD_EXTRACTED_TASK_TO_SESSION', payload: { sessionId, taskId } });
    }, [dispatch]),

    addExtractedNote: React.useCallback((sessionId: string, noteId: string) => {
      dispatch({ type: 'ADD_EXTRACTED_NOTE_TO_SESSION', payload: { sessionId, noteId } });
    }, [dispatch]),

    addContextItem: React.useCallback((sessionId: string, contextItem: SessionContextItem) => {
      dispatch({ type: 'ADD_SESSION_CONTEXT_ITEM', payload: { sessionId, contextItem } });
    }, [dispatch]),

    getCleanupMetrics: React.useCallback(() => cleanupMetricsRef.current, []),

    // Query Engine Methods (Phase 3.3)
    querySessions: React.useCallback(async (filters: QueryFilter[], sort?: QuerySort, limit?: number) => {
      const storage = await getStorage();
      const queryEngine = new QueryEngine(storage);

      const result = await queryEngine.execute<Session>({
        collection: 'sessions',
        filters,
        sort,
        limit,
      });

      console.log(`[Sessions] Query returned ${result.entitiesReturned} sessions in ${result.executionTime}ms`);

      return result.entities;
    }, []),
  };

  return (
    <SessionsContext.Provider value={value}>
      {children}
    </SessionsContext.Provider>
  );
}

/**
 * @deprecated This hook is deprecated and will be removed in Phase 7.
 *
 * SessionsContext has been split into three focused contexts for better maintainability:
 * - useSessionList() - For managing the list of completed sessions
 * - useActiveSession() - For managing the currently active session
 * - useRecording() - For managing recording services
 *
 * See migration guide: /docs/sessions-rewrite/CONTEXT_MIGRATION_GUIDE.md
 *
 * @example
 * // Before
 * const { sessions, activeSessionId, startSession } = useSessions();
 *
 * // After
 * const { sessions } = useSessionList();
 * const { activeSession, startSession } = useActiveSession();
 * const { startScreenshots } = useRecording();
 */
export function useSessions() {
  const context = useContext(SessionsContext);
  if (context === undefined) {
    throw new Error('useSessions must be used within a SessionsProvider');
  }

  // Log deprecation warning once per component mount
  React.useEffect(() => {
    console.warn(
      '%c[DEPRECATED] useSessions() is deprecated',
      'color: orange; font-weight: bold',
      '\n\nSessionsContext has been split into three focused contexts:\n' +
      '  • useSessionList() - For session list operations\n' +
      '  • useActiveSession() - For active session operations\n' +
      '  • useRecording() - For recording services\n\n' +
      'See migration guide: /docs/sessions-rewrite/CONTEXT_MIGRATION_GUIDE.md\n\n' +
      'This hook will be removed in Phase 7 (Week 13-14).'
    );
  }, []);

  return context;
}
