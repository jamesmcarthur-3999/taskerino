import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Session, SessionScreenshot, SessionAudioSegment, AudioConfig, VideoConfig } from '../types';
import { screenshotCaptureService } from '../services/screenshotCaptureService';
import { audioRecordingService } from '../services/audioRecordingService';
import { videoRecordingService } from '../services/videoRecordingService';

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

interface RecordingState {
  screenshots: RecordingServiceState;
  audio: RecordingServiceState;
  video: RecordingServiceState;
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
  startScreenshots: (session: Session, onCapture: (screenshot: SessionScreenshot) => void) => void;
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
  stopVideo: () => Promise<void>;

  // Batch Operations
  stopAll: () => Promise<void>;
  pauseAll: () => void;
  resumeAll: () => void;

  // Metrics
  getCleanupMetrics: () => CleanupMetrics;
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
  });

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
  // Screenshot Service
  // ========================================

  const startScreenshots = useCallback((session: Session, onCapture: (screenshot: SessionScreenshot) => void) => {
    console.log('[RecordingContext] Starting screenshot capture for session:', session.id);
    try {
      screenshotCaptureService.startCapture(session, onCapture);
      setRecordingState(prev => ({ ...prev, screenshots: 'active' }));
    } catch (error) {
      console.error('[RecordingContext] Failed to start screenshots:', error);
      setRecordingState(prev => ({ ...prev, screenshots: 'error' }));
      throw error;
    }
  }, []);

  const stopScreenshots = useCallback(() => {
    console.log('[RecordingContext] Stopping screenshot capture');
    try {
      screenshotCaptureService.stopCapture();
      setRecordingState(prev => ({ ...prev, screenshots: 'stopped' }));
    } catch (error) {
      console.error('[RecordingContext] Failed to stop screenshots:', error);
      cleanupMetricsRef.current.sessionEnds.screenshotCleanupFailures++;
      throw error;
    }
  }, []);

  const pauseScreenshots = useCallback(() => {
    console.log('[RecordingContext] Pausing screenshot capture');
    screenshotCaptureService.pauseCapture();
    setRecordingState(prev => ({ ...prev, screenshots: 'paused' }));
  }, []);

  const resumeScreenshots = useCallback(() => {
    console.log('[RecordingContext] Resuming screenshot capture');
    screenshotCaptureService.resumeCapture();
    setRecordingState(prev => ({ ...prev, screenshots: 'active' }));
  }, []);

  // ========================================
  // Audio Service
  // ========================================

  const startAudio = useCallback(async (session: Session, onSegment: (segment: SessionAudioSegment) => void) => {
    console.log('[RecordingContext] Starting audio recording for session:', session.id);
    try {
      await audioRecordingService.startRecording(session, onSegment);
      setRecordingState(prev => ({ ...prev, audio: 'active' }));
    } catch (error) {
      console.error('[RecordingContext] Failed to start audio:', error);
      setRecordingState(prev => ({ ...prev, audio: 'error' }));
      throw error;
    }
  }, []);

  const stopAudio = useCallback(async () => {
    console.log('[RecordingContext] Stopping audio recording');
    try {
      await audioRecordingService.stopRecording();
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
    audioRecordingService.resumeRecording();
    setRecordingState(prev => ({ ...prev, audio: 'active' }));
  }, []);

  // ========================================
  // Video Service
  // ========================================

  const startVideo = useCallback(async (session: Session) => {
    console.log('[RecordingContext] Starting video recording for session:', session.id);
    try {
      await videoRecordingService.startRecording(session);
      setRecordingState(prev => ({ ...prev, video: 'active' }));
    } catch (error) {
      console.error('[RecordingContext] Failed to start video:', error);
      setRecordingState(prev => ({ ...prev, video: 'error' }));
      throw error;
    }
  }, []);

  const stopVideo = useCallback(async () => {
    console.log('[RecordingContext] Stopping video recording');
    try {
      await videoRecordingService.stopRecording();
      setRecordingState(prev => ({ ...prev, video: 'stopped' }));
    } catch (error) {
      console.error('[RecordingContext] Failed to stop video:', error);
      throw error;
    }
  }, []);

  // ========================================
  // Batch Operations
  // ========================================

  const stopAll = useCallback(async () => {
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
  };

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useRecording() {
  const context = useContext(RecordingContext);
  if (context === undefined) {
    throw new Error('useRecording must be used within RecordingProvider');
  }
  return context;
}
