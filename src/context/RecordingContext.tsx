import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Session, SessionScreenshot, SessionAudioSegment, SessionVideo, AudioDevice, DisplayInfo, WindowInfo, WebcamInfo, RecordingError } from '../types';
import { isRecordingError } from '../types';
import { screenshotCaptureService } from '../services/screenshotCaptureService';
import { audioRecordingService } from '../services/audioRecordingService';
import { videoRecordingService } from '../services/videoRecordingService';
import { adaptiveScreenshotScheduler } from '../services/adaptiveScreenshotScheduler';
import { listen } from '@tauri-apps/api/event';

/**
 * RecordingContext - Manages recording services (screenshots, audio, video)
 *
 * Responsibilities:
 * - Start/stop screenshot capture
 * - Start/stop audio recording
 * - Start/stop video recording
 * - Track recording state
 * - Provide cleanup metrics
 *
 * This context does NOT manage:
 * - Session data (see ActiveSessionContext)
 * - Session list (see SessionListContext)
 *
 * Note: This is a thin wrapper around recording services.
 * Data flows to ActiveSessionContext via callbacks.
 */

// ============================================================================
// Types
// ============================================================================

type RecordingServiceState = 'idle' | 'active' | 'paused' | 'stopped' | 'error';

// Error state interface
interface RecordingErrorState {
  screenshots: RecordingError | null;
  audio: RecordingError | null;
  video: RecordingError | null;
}

// Permission status interface
interface PermissionStatus {
  microphone: boolean | null; // null = not checked yet
  camera: boolean | null;
  screenRecording: boolean | null;
  lastChecked: Date | null;
  isChecking: boolean;
}

interface RecordingState {
  screenshots: RecordingServiceState;
  audio: RecordingServiceState;
  video: RecordingServiceState;
  lastError: RecordingErrorState;
  permissionStatus: PermissionStatus;
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

interface RecordingContextValue {
  recordingState: RecordingState;

  // Screenshot Service
  startScreenshots: (session: Session, onCapture: (screenshot: SessionScreenshot) => void | Promise<void>) => void;
  stopScreenshots: () => void;
  pauseScreenshots: () => void;
  resumeScreenshots: () => void;

  // Audio Service
  startAudio: (session: Session, onSegment: (segment: SessionAudioSegment) => void) => Promise<void>;
  stopAudio: () => Promise<void>;
  pauseAudio: () => void;
  resumeAudio: () => void;

  // Video Service
  startVideo: (session: Session) => Promise<void>;
  stopVideo: () => Promise<import('../types').SessionVideo | null>;

  // Batch Operations
  stopAll: () => Promise<SessionVideo | null>;
  pauseAll: () => void;
  resumeAll: () => void;

  // Metrics
  getCleanupMetrics: () => CleanupMetrics;

  // Query Methods
  getActiveScreenshotSessionId: () => string | null;
  getActiveAudioSessionId: () => string | null;
  getActiveVideoSessionId: () => string | null;
  isCapturing: () => boolean;
  isAudioRecording: () => boolean;
  isVideoRecording: () => Promise<boolean>;

  // Permission/Device Methods
  checkVideoPermission: () => Promise<boolean>;
  checkMicrophonePermission: () => Promise<boolean>;
  checkCameraPermission: () => Promise<boolean>;
  checkAllPermissions: () => Promise<void>;
  requestMicrophonePermission: () => Promise<boolean>;
  requestCameraPermission: () => Promise<boolean>;
  openSystemPreferences: (pane: 'screenRecording' | 'microphone' | 'camera') => Promise<void>;
  invalidatePermissionCache: () => Promise<void>;
  getAudioDevices: () => Promise<AudioDevice[]>;
  enumerateDisplays: () => Promise<DisplayInfo[]>;
  enumerateWindows: () => Promise<WindowInfo[]>;
  enumerateWebcams: () => Promise<WebcamInfo[]>;

  // Audio Processing
  processAudioChunk: (
    audioBase64: string,
    duration: number,
    sessionId: string,
    onSegment: (segment: SessionAudioSegment) => void
  ) => Promise<void>;

  // Adaptive Scheduler
  updateCuriosityScore: (score: number) => void;

  // Error management
  clearError: (service: 'screenshots' | 'audio' | 'video') => void;
  clearAllErrors: () => void;
  resetAll: () => void;
  getActiveErrors: () => Array<{ service: 'screenshots' | 'audio' | 'video'; error: RecordingError }>;
}

// ============================================================================
// Context
// ============================================================================

const RecordingContext = createContext<RecordingContextValue | undefined>(undefined);

interface RecordingProviderProps {
  children: ReactNode;
}

export function RecordingProvider({ children }: RecordingProviderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    screenshots: 'idle',
    audio: 'idle',
    video: 'idle',
    lastError: {
      screenshots: null,
      audio: null,
      video: null,
    },
    permissionStatus: {
      microphone: null,
      camera: null,
      screenRecording: null,
      lastChecked: null,
      isChecking: false,
    },
  });

  // Store session and callback for screenshot resume
  const screenshotSessionRef = useRef<Session | null>(null);
  const screenshotCallbackRef = useRef<((screenshot: SessionScreenshot) => void | Promise<void>) | null>(null);

  // Store session and callback for audio resume
  const audioSessionRef = useRef<Session | null>(null);
  const audioCallbackRef = useRef<((segment: SessionAudioSegment) => void) | null>(null);

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

  // ========================================
  // Runtime Error Listening (Phase 1 - Fix #4B)
  // ========================================

  useEffect(() => {
    // Listen for recording errors emitted by Rust during active recording
    const unlisten = listen<{
      sessionId: string;
      errorType: 'audio' | 'video' | 'screenshots';
      errorCode: string;
      message: string;
      canRetry: boolean;
      timestamp: number;
    }>('recording-error', (event) => {
      const { sessionId, errorType, errorCode, message, canRetry } = event.payload;

      console.error(
        `[RecordingContext] Runtime recording error: ${errorType} for session ${sessionId}:`,
        message
      );

      // Classify the error based on error code and create proper discriminated union
      let recordingError: RecordingError;

      if (errorCode.includes('PERMISSION')) {
        recordingError = {
          type: 'PermissionDenied',
          data: {
            permission: errorType === 'audio' ? 'microphone' : 'screenRecording',
            canRetry,
            systemMessage: message,
          },
        };
      } else if (errorCode.includes('DEVICE')) {
        recordingError = {
          type: 'DeviceNotFound',
          data: {
            deviceType: errorType === 'audio' ? 'microphone' : 'display',
            deviceId: undefined,
          },
        };
      } else {
        recordingError = {
          type: 'SystemError',
          data: {
            source: errorType === 'audio' ? 'cpal' : 'screenCaptureKit',
            message,
            isRecoverable: canRetry,
          },
        };
      }

      // Update recording state with error
      setRecordingState((prev) => ({
        ...prev,
        [errorType]: 'error',
        lastError: {
          ...prev.lastError,
          [errorType]: recordingError,
        },
      }));
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // ========================================
  // Screenshot Service
  // ========================================

  const startScreenshots = useCallback((session: Session, onCapture: (screenshot: SessionScreenshot) => void | Promise<void>) => {
    console.log('[RecordingContext] Starting screenshot capture for session:', session.id);

    // RACE CONDITION FIX: Clear error state on new session (prevents stale errors)
    setRecordingState(prev => ({
      ...prev,
      lastError: { ...prev.lastError, screenshots: null }
    }));

    try {
      // Store session and callback for resume
      screenshotSessionRef.current = session;
      screenshotCallbackRef.current = onCapture;

      // Wrap callback to always return Promise
      const asyncCallback = async (screenshot: SessionScreenshot) => {
        await onCapture(screenshot);
      };

      // Error callback to handle screenshot capture failures
      const errorCallback = (error: Error) => {
        console.error('[RecordingContext] Screenshot capture error:', error);

        // Classify and store error
        const recordingError = isRecordingError(error)
          ? error
          : classifyScreenshotError(error);

        setRecordingState(prev => ({
          ...prev,
          screenshots: 'error',
          lastError: { ...prev.lastError, screenshots: recordingError }
        }));
      };

      screenshotCaptureService.startCapture(session, asyncCallback, errorCallback);
      setRecordingState(prev => ({
        ...prev,
        screenshots: 'active',
        lastError: { ...prev.lastError, screenshots: null }
      }));
    } catch (error) {
      console.error('[RecordingContext] Failed to start screenshots:', error);

      // Classify and store error
      const recordingError = isRecordingError(error)
        ? error
        : classifyScreenshotError(error);

      setRecordingState(prev => ({
        ...prev,
        screenshots: 'error',
        lastError: { ...prev.lastError, screenshots: recordingError }
      }));

      throw error;
    }
  }, []);

  const stopScreenshots = useCallback(async () => {
    console.log('[RecordingContext] Stopping screenshot capture');
    try {
      await screenshotCaptureService.stopCapture();
      // Clear stored session and callback
      screenshotSessionRef.current = null;
      screenshotCallbackRef.current = null;
      setRecordingState(prev => ({ ...prev, screenshots: 'stopped' }));
    } catch (error) {
      console.error('[RecordingContext] Failed to stop screenshots:', error);
      cleanupMetricsRef.current.sessionEnds.screenshotCleanupFailures++;
      throw error;
    }
  }, []);

  const pauseScreenshots = useCallback(async () => {
    console.log('[RecordingContext] Pausing screenshot capture');
    await screenshotCaptureService.pauseCapture();
    setRecordingState(prev => ({ ...prev, screenshots: 'paused' }));
  }, []);

  const resumeScreenshots = useCallback(async () => {
    console.log('[RecordingContext] Resuming screenshot capture');
    if (!screenshotSessionRef.current || !screenshotCallbackRef.current) {
      console.error('[RecordingContext] Cannot resume: session or callback not found');
      return;
    }

    // Wrap callback to always return Promise
    const asyncCallback = async (screenshot: SessionScreenshot) => {
      await screenshotCallbackRef.current!(screenshot);
    };

    await screenshotCaptureService.resumeCapture(screenshotSessionRef.current, asyncCallback);
    setRecordingState(prev => ({ ...prev, screenshots: 'active' }));
  }, []);

  // ========================================
  // Audio Service
  // ========================================

  const startAudio = useCallback(async (session: Session, onSegment: (segment: SessionAudioSegment) => void) => {
    console.log('[RecordingContext] Starting audio recording for session:', session.id);

    // RACE CONDITION FIX: Clear error state on new session (prevents stale errors)
    setRecordingState(prev => ({
      ...prev,
      lastError: { ...prev.lastError, audio: null }
    }));

    try {
      // Store session and callback for resume
      audioSessionRef.current = session;
      audioCallbackRef.current = onSegment;

      await audioRecordingService.startRecording(session, onSegment);
      setRecordingState(prev => ({
        ...prev,
        audio: 'active',
        lastError: { ...prev.lastError, audio: null }
      }));
    } catch (error) {
      console.error('[RecordingContext] Failed to start audio:', error);

      // Classify and store error
      const recordingError = isRecordingError(error)
        ? error
        : classifyAudioError(error);

      setRecordingState(prev => ({
        ...prev,
        audio: 'error',
        lastError: { ...prev.lastError, audio: recordingError }
      }));

      throw error;
    }
  }, []);

  const stopAudio = useCallback(async () => {
    console.log('[RecordingContext] Stopping audio recording');
    try {
      await audioRecordingService.stopRecording();
      // Clear stored session and callback
      audioSessionRef.current = null;
      audioCallbackRef.current = null;
      setRecordingState(prev => ({ ...prev, audio: 'stopped' }));
    } catch (error) {
      console.error('[RecordingContext] Failed to stop audio:', error);
      cleanupMetricsRef.current.sessionEnds.audioCleanupFailures++;
      throw error;
    }
  }, []);

  const pauseAudio = useCallback(() => {
    console.log('[RecordingContext] Pausing audio recording');
    audioRecordingService.pauseRecording();
    setRecordingState(prev => ({ ...prev, audio: 'paused' }));
  }, []);

  const resumeAudio = useCallback(() => {
    console.log('[RecordingContext] Resuming audio recording');
    if (!audioSessionRef.current || !audioCallbackRef.current) {
      console.error('[RecordingContext] Cannot resume: session or callback not found');
      return;
    }
    audioRecordingService.resumeRecording(audioSessionRef.current, audioCallbackRef.current);
    setRecordingState(prev => ({ ...prev, audio: 'active' }));
  }, []);

  // ========================================
  // Video Service
  // ========================================

  const startVideo = useCallback(async (session: Session) => {
    console.log('[RecordingContext] Starting video recording for session:', session.id);

    // RACE CONDITION FIX: Clear error state on new session (prevents stale errors)
    setRecordingState(prev => ({
      ...prev,
      lastError: { ...prev.lastError, video: null }
    }));

    try {
      await videoRecordingService.startRecording(session);
      setRecordingState(prev => ({
        ...prev,
        video: 'active',
        lastError: { ...prev.lastError, video: null }
      }));
    } catch (error) {
      console.error('[RecordingContext] Failed to start video:', error);

      // Classify and store error
      const recordingError = isRecordingError(error)
        ? error
        : classifyVideoError(error);

      setRecordingState(prev => ({
        ...prev,
        video: 'error',
        lastError: { ...prev.lastError, video: recordingError }
      }));

      throw error;
    }
  }, []);

  const stopVideo = useCallback(async () => {
    console.log('[RecordingContext] Stopping video recording');
    try {
      const sessionVideo = await videoRecordingService.stopRecording();
      setRecordingState(prev => ({ ...prev, video: 'stopped' }));
      return sessionVideo;
    } catch (error) {
      console.error('[RecordingContext] Failed to stop video:', error);
      throw error;
    }
  }, []);

  // ========================================
  // Batch Operations
  // ========================================

  const stopAll = useCallback(async (): Promise<SessionVideo | null> => {
    console.log('[RecordingContext] Stopping all recording services');
    const results = await Promise.allSettled([
      (async () => stopScreenshots())(),
      stopAudio(),
      stopVideo(),
    ]);

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.error(`[RecordingContext] ${failures.length} service(s) failed to stop`);
    }

    // Extract SessionVideo from stopVideo() result (3rd promise)
    let sessionVideo: SessionVideo | null = null;
    const videoResult = results[2];
    if (videoResult.status === 'fulfilled') {
      sessionVideo = videoResult.value;
      if (sessionVideo) {
        console.log('[RecordingContext] SessionVideo retrieved:', sessionVideo.id);
      }
    } else if (videoResult.status === 'rejected') {
      console.error('[RecordingContext] stopVideo() failed:', videoResult.reason);
    }

    // RACE CONDITION FIX: Reset recordingState to 'idle' after stopAll()
    // This ensures clean state for next session (prevents stale 'stopped' states)
    setRecordingState(prev => ({
      screenshots: 'idle',
      audio: 'idle',
      video: 'idle',
      lastError: {
        screenshots: null,
        audio: null,
        video: null,
      },
      permissionStatus: prev.permissionStatus, // Preserve permission status
    }));
    console.log('[RecordingContext] Recording state reset to idle');

    return sessionVideo;
  }, [stopScreenshots, stopAudio, stopVideo]);

  const pauseAll = useCallback(() => {
    console.log('[RecordingContext] Pausing all recording services');
    pauseScreenshots();
    pauseAudio();
    // Note: Video doesn't support pause currently
  }, [pauseScreenshots, pauseAudio]);

  const resumeAll = useCallback(() => {
    console.log('[RecordingContext] Resuming all recording services');
    resumeScreenshots();
    resumeAudio();
    // Note: Video doesn't support resume currently
  }, [resumeScreenshots, resumeAudio]);

  // ========================================
  // Metrics
  // ========================================

  const getCleanupMetrics = useCallback(() => {
    return cleanupMetricsRef.current;
  }, []);

  // ========================================
  // Query Methods
  // ========================================

  const getActiveScreenshotSessionId = useCallback(() => {
    return screenshotCaptureService.getActiveSessionId();
  }, []);

  const getActiveAudioSessionId = useCallback(() => {
    return audioRecordingService.getActiveSessionId();
  }, []);

  const getActiveVideoSessionId = useCallback(() => {
    return videoRecordingService.getActiveSessionId();
  }, []);

  const isCapturing = useCallback(() => {
    return screenshotCaptureService.isCapturing();
  }, []);

  const isAudioRecording = useCallback(() => {
    return audioRecordingService.isCurrentlyRecording();
  }, []);

  const isVideoRecording = useCallback(async () => {
    return await videoRecordingService.isCurrentlyRecording();
  }, []);

  // ========================================
  // Permission/Device Methods
  // ========================================

  const checkVideoPermission = useCallback(async () => {
    return await videoRecordingService.checkPermission();
  }, []);

  const checkMicrophonePermission = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const hasPermission = await invoke<boolean>('check_microphone_permission');

      setRecordingState(prev => ({
        ...prev,
        permissionStatus: {
          ...prev.permissionStatus,
          microphone: hasPermission,
          lastChecked: new Date(),
        },
      }));

      return hasPermission;
    } catch (error) {
      console.error('[RecordingContext] Failed to check microphone permission:', error);
      setRecordingState(prev => ({
        ...prev,
        permissionStatus: {
          ...prev.permissionStatus,
          microphone: false,
          lastChecked: new Date(),
        },
      }));
      return false;
    }
  }, []);

  const checkCameraPermission = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const hasPermission = await invoke<boolean>('check_camera_permission');

      setRecordingState(prev => ({
        ...prev,
        permissionStatus: {
          ...prev.permissionStatus,
          camera: hasPermission,
          lastChecked: new Date(),
        },
      }));

      return hasPermission;
    } catch (error) {
      console.error('[RecordingContext] Failed to check camera permission:', error);
      setRecordingState(prev => ({
        ...prev,
        permissionStatus: {
          ...prev.permissionStatus,
          camera: false,
          lastChecked: new Date(),
        },
      }));
      return false;
    }
  }, []);

  const checkAllPermissions = useCallback(async () => {
    setRecordingState(prev => ({
      ...prev,
      permissionStatus: { ...prev.permissionStatus, isChecking: true },
    }));

    const [screenRecording, microphone, camera] = await Promise.all([
      checkVideoPermission(),
      checkMicrophonePermission(),
      checkCameraPermission(),
    ]);

    setRecordingState(prev => ({
      ...prev,
      permissionStatus: {
        screenRecording,
        microphone,
        camera,
        lastChecked: new Date(),
        isChecking: false,
      },
    }));
  }, [checkVideoPermission, checkMicrophonePermission, checkCameraPermission]);

  const requestMicrophonePermission = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke<boolean>('request_microphone_permission');
      // Re-check permission after request
      return await checkMicrophonePermission();
    } catch (error) {
      console.error('[RecordingContext] Failed to request microphone permission:', error);
      return false;
    }
  }, [checkMicrophonePermission]);

  const requestCameraPermission = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke<boolean>('request_camera_permission');
      // Re-check permission after request
      return await checkCameraPermission();
    } catch (error) {
      console.error('[RecordingContext] Failed to request camera permission:', error);
      return false;
    }
  }, [checkCameraPermission]);

  const openSystemPreferences = useCallback(async (pane: 'screenRecording' | 'microphone' | 'camera') => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_system_preferences', { pane });
    } catch (error) {
      console.error('[RecordingContext] Failed to open system preferences:', error);
      throw error;
    }
  }, []);

  const invalidatePermissionCache = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('invalidate_permission_cache');
      // Re-check all permissions after invalidation
      await checkAllPermissions();
    } catch (error) {
      console.error('[RecordingContext] Failed to invalidate permission cache:', error);
    }
  }, [checkAllPermissions]);

  const getAudioDevices = useCallback(async () => {
    return await audioRecordingService.getAudioDevices();
  }, []);

  const enumerateDisplays = useCallback(async () => {
    return await videoRecordingService.enumerateDisplays();
  }, []);

  const enumerateWindows = useCallback(async () => {
    return await videoRecordingService.enumerateWindows();
  }, []);

  const enumerateWebcams = useCallback(async () => {
    return await videoRecordingService.enumerateWebcams();
  }, []);

  // ========================================
  // Audio Processing
  // ========================================

  const processAudioChunk = useCallback(async (
    audioBase64: string,
    duration: number,
    sessionId: string,
    onSegment: (segment: SessionAudioSegment) => void
  ) => {
    await audioRecordingService.processAudioChunk(
      audioBase64,
      duration,
      sessionId,
      onSegment
    );
  }, []);

  // ========================================
  // Adaptive Scheduler
  // ========================================

  const updateCuriosityScore = useCallback((score: number) => {
    if (adaptiveScreenshotScheduler.isActive()) {
      adaptiveScreenshotScheduler.updateCuriosityScore(score);
    }
  }, []);

  // ========================================
  // Error Management
  // ========================================

  const clearError = useCallback((service: 'screenshots' | 'audio' | 'video') => {
    console.log(`[RecordingContext] Clearing error for ${service}`);
    setRecordingState(prev => ({
      ...prev,
      lastError: { ...prev.lastError, [service]: null }
    }));
  }, []);

  const clearAllErrors = useCallback(() => {
    console.log('[RecordingContext] Clearing all errors');
    setRecordingState(prev => ({
      ...prev,
      lastError: { screenshots: null, audio: null, video: null }
    }));
  }, []);

  /**
   * Force reset ALL recording services to idle state
   * Used for recovery from stuck states or cleanup after errors
   *
   * CRITICAL: This is a forceful reset that:
   * - Sets all services (screenshots, audio, video) to 'idle'
   * - Clears all errors
   * - Preserves permission status (permissions don't need reset)
   *
   * Use this when:
   * - Recovery modal is dismissed
   * - Machine is stuck in a bad state
   * - Need to completely reset recording lifecycle
   */
  const resetAll = useCallback(() => {
    console.log('[RecordingContext] RESET ALL - Forcing all services to idle state');
    setRecordingState(prev => ({
      screenshots: 'idle',
      audio: 'idle',
      video: 'idle',
      lastError: { screenshots: null, audio: null, video: null },
      permissionStatus: prev.permissionStatus, // Preserve permission status
    }));
  }, []);

  const getActiveErrors = useCallback(() => {
    const errors: Array<{ service: 'screenshots' | 'audio' | 'video'; error: RecordingError }> = [];

    if (recordingState.lastError.screenshots) {
      errors.push({ service: 'screenshots', error: recordingState.lastError.screenshots });
    }
    if (recordingState.lastError.audio) {
      errors.push({ service: 'audio', error: recordingState.lastError.audio });
    }
    if (recordingState.lastError.video) {
      errors.push({ service: 'video', error: recordingState.lastError.video });
    }

    return errors;
  }, [recordingState.lastError]);

  const value: RecordingContextValue = {
    recordingState,
    startScreenshots,
    stopScreenshots,
    pauseScreenshots,
    resumeScreenshots,
    startAudio,
    stopAudio,
    pauseAudio,
    resumeAudio,
    startVideo,
    stopVideo,
    stopAll,
    pauseAll,
    resumeAll,
    getCleanupMetrics,
    // Query methods
    getActiveScreenshotSessionId,
    getActiveAudioSessionId,
    getActiveVideoSessionId,
    isCapturing,
    isAudioRecording,
    isVideoRecording,
    // Permission/device methods
    checkVideoPermission,
    checkMicrophonePermission,
    checkCameraPermission,
    checkAllPermissions,
    requestMicrophonePermission,
    requestCameraPermission,
    openSystemPreferences,
    invalidatePermissionCache,
    getAudioDevices,
    enumerateDisplays,
    enumerateWindows,
    enumerateWebcams,
    // Audio processing
    processAudioChunk,
    // Adaptive scheduler
    updateCuriosityScore,
    // Error management
    clearError,
    clearAllErrors,
    resetAll,
    getActiveErrors,
  };

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
}

// ============================================================================
// Error Classification Helpers
// ============================================================================

function classifyScreenshotError(error: unknown): RecordingError {
  if (isRecordingError(error)) return error;

  const errorMessage = error instanceof Error ? error.message : String(error);

  // Entitlement missing (expected in dev mode, not fatal)
  if (errorMessage.toLowerCase().includes('entitlement')) {
    return {
      type: 'SystemError',
      data: {
        source: 'codeSignature',
        message: 'Screen-recording entitlement not found (expected in dev mode). Screen recording may still work with permission.',
        isRecoverable: true  // Changed to true since it's not actually fatal
      }
    };
  }

  // Code signing issues
  if (errorMessage.toLowerCase().includes('code sign') || errorMessage.toLowerCase().includes('signature')) {
    return {
      type: 'SystemError',
      data: {
        source: 'codeSignature',
        message: 'Code signing issue detected. App may need to be rebuilt with proper certificates.',
        isRecoverable: false
      }
    };
  }

  // Permission denied
  if (errorMessage.toLowerCase().includes('permission')) {
    return {
      type: 'PermissionDenied',
      data: {
        permission: 'screenRecording',
        canRetry: true,
        systemMessage: 'Screen recording permission required. Grant permission in System Settings > Privacy & Security > Screen Recording.'
      }
    };
  }

  // Device not found
  if (errorMessage.toLowerCase().includes('no display') || errorMessage.toLowerCase().includes('screen not found')) {
    return {
      type: 'DeviceNotFound',
      data: {
        deviceType: 'display',
        deviceId: undefined
      }
    };
  }

  // Generic system error
  return {
    type: 'SystemError',
    data: {
      source: 'screenCaptureKit',
      message: errorMessage,
      isRecoverable: true
    }
  };
}

function classifyAudioError(error: unknown): RecordingError {
  if (isRecordingError(error)) return error;

  const errorMessage = error instanceof Error ? error.message : String(error);

  // API key missing
  if (errorMessage.includes('API key') || errorMessage.includes('OpenAI')) {
    return {
      type: 'InvalidConfiguration',
      data: {
        field: 'openai_api_key',
        reason: 'OpenAI API key not configured. Add your key in Settings.'
      }
    };
  }

  // Permission denied
  if (errorMessage.toLowerCase().includes('permission')) {
    return {
      type: 'PermissionDenied',
      data: {
        permission: 'microphone',
        canRetry: true,
        systemMessage: errorMessage
      }
    };
  }

  // Device not found
  if (errorMessage.toLowerCase().includes('no device') || errorMessage.toLowerCase().includes('microphone not found')) {
    return {
      type: 'DeviceNotFound',
      data: {
        deviceType: 'microphone',
        deviceId: undefined
      }
    };
  }

  // Generic error
  return {
    type: 'SystemError',
    data: {
      source: 'cpal',
      message: errorMessage,
      isRecoverable: true
    }
  };
}

function classifyVideoError(error: unknown): RecordingError {
  if (isRecordingError(error)) return error;

  const errorMessage = error instanceof Error ? error.message : String(error);

  // Permission denied
  if (errorMessage.toLowerCase().includes('permission')) {
    return {
      type: 'PermissionDenied',
      data: {
        permission: 'screenRecording',
        canRetry: true,
        systemMessage: errorMessage
      }
    };
  }

  // Device in use
  if (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('in use')) {
    return {
      type: 'DeviceInUse',
      data: {
        deviceType: 'display',
        deviceId: 'primary'
      }
    };
  }

  // Generic error
  return {
    type: 'SystemError',
    data: {
      source: 'screenCaptureKit',
      message: errorMessage,
      isRecoverable: true
    }
  };
}

// ============================================================================
// Hook
// ============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export function useRecording() {
  const context = useContext(RecordingContext);
  if (context === undefined) {
    throw new Error('useRecording must be used within RecordingProvider');
  }
  return context;
}
