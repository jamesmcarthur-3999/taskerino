import { fromPromise, fromCallback } from 'xstate';
import { invoke } from '@tauri-apps/api/core';
import type { SessionRecordingConfig, Session, SessionScreenshot, SessionAudioSegment } from '../types';
import type { RecordingServiceState } from './sessionMachine';
import { screenshotCaptureService } from '../services/screenshotCaptureService';
import { audioRecordingService } from '../services/audioRecordingService';
import { videoRecordingService } from '../services/videoRecordingService';
import { getPersistenceQueue } from '../services/storage/PersistenceQueue';
import { validateAudioConfig, validateVideoConfig, validateAudioDeviceAvailability, fallbackToDefaultAudioDevices } from '../utils/sessionValidation';

/**
 * Service: Validate session configuration
 *
 * Validates that the session configuration is valid and generates a session ID.
 * Uses the centralized validation functions from sessionValidation.ts to ensure
 * consistency across the entire application.
 *
 * @see /src/utils/sessionValidation.ts - Single source of truth for validation
 */
export const validateConfig = fromPromise(
  async ({ input }: { input: { config: SessionRecordingConfig } }) => {
    const { config } = input;

    // Validate session name
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('Session name is required');
    }

    if (config.name.length > 255) {
      throw new Error('Session name must be 255 characters or less');
    }

    // Validate that at least one recording type is enabled
    const hasScreenshots = config.screenshotsEnabled;
    const hasAudio = config.audioConfig?.enabled ?? false;
    const hasVideo = config.videoConfig?.enabled ?? false;

    if (!hasScreenshots && !hasAudio && !hasVideo) {
      throw new Error('At least one recording type must be enabled');
    }

    // Validate audio configuration if enabled (using centralized validation)
    if (config.audioConfig?.enabled) {
      // Convert SessionRecordingConfig.audioConfig to AudioDeviceConfig format
      const audioDeviceConfig = {
        sourceType: config.audioConfig.sourceType,
        micDeviceId: config.audioConfig.micDeviceId,
        systemAudioDeviceId: config.audioConfig.systemAudioDeviceId,
        balance: config.audioConfig.balance,
        micVolume: config.audioConfig.micVolume,
        systemVolume: config.audioConfig.systemVolume,
      };

      const audioValidation = validateAudioConfig(audioDeviceConfig);
      if (!audioValidation.valid) {
        throw new Error(`Audio config validation failed: ${audioValidation.errors.join(', ')}`);
      }

      // Runtime device availability check
      try {
        const availableDevices = await audioRecordingService.getAudioDevices();
        const availabilityValidation = validateAudioDeviceAvailability(audioDeviceConfig, availableDevices);

        if (!availabilityValidation.valid) {
          console.warn('[validateConfig] Audio device validation failed, attempting fallback to default devices');

          // Attempt to fallback to default devices
          const fixedConfig = fallbackToDefaultAudioDevices(audioDeviceConfig, availableDevices);

          if (fixedConfig) {
            // Update config with fixed devices
            console.log('[validateConfig] Successfully fell back to default devices');
            config.audioConfig.micDeviceId = fixedConfig.micDeviceId;
            config.audioConfig.systemAudioDeviceId = fixedConfig.systemAudioDeviceId;
            config.audioConfig.sourceType = fixedConfig.sourceType;
          } else {
            // No fallback available - throw error
            throw new Error(`Audio devices not available: ${availabilityValidation.errors.join(', ')}`);
          }
        }
      } catch (error) {
        console.error('[validateConfig] Failed to enumerate audio devices:', error);
        throw new Error(`Failed to validate audio devices: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Validate video configuration if enabled (using centralized validation)
    if (config.videoConfig?.enabled) {
      // Convert SessionRecordingConfig.videoConfig to VideoRecordingConfig format
      const videoRecordingConfig = {
        sourceType: config.videoConfig.sourceType,
        displayIds: config.videoConfig.displayIds,
        windowIds: config.videoConfig.windowIds,
        webcamDeviceId: config.videoConfig.webcamDeviceId,
        quality: config.videoConfig.quality || 'medium' as const,
        fps: config.videoConfig.fps || 30,
        resolution: config.videoConfig.resolution,
      };

      const videoValidation = validateVideoConfig(videoRecordingConfig);
      if (!videoValidation.valid) {
        throw new Error(`Video config validation failed: ${videoValidation.errors.join(', ')}`);
      }
    }

    // Generate session ID
    const sessionId = crypto.randomUUID();

    return { sessionId };
  }
);

/**
 * Service: Check required system permissions
 *
 * Verifies that the application has the necessary permissions to perform
 * the requested recording operations.
 */
export const checkPermissions = fromPromise(
  async ({
    input,
  }: {
    input: { config: SessionRecordingConfig; sessionId: string }
  }) => {
    const { config } = input;
    const missingPermissions: string[] = [];

    // Check screen recording permission if needed
    if (config.screenshotsEnabled || config.videoConfig?.enabled) {
      const hasScreenPermission = await checkScreenRecordingPermission();
      if (!hasScreenPermission) {
        missingPermissions.push('screen recording');
      }
    }

    // Request microphone permission if needed (only for audio recording)
    // This will proactively trigger the macOS permission dialog if not yet determined
    const needsMicPermission = config.audioConfig?.enabled;

    if (needsMicPermission) {
      const hasMicPermission = await requestMicrophonePermission();
      if (!hasMicPermission) {
        missingPermissions.push('microphone');
      }
    }

    if (missingPermissions.length > 0) {
      throw new Error(missingPermissions.join(', '));
    }

    return { permissions: 'granted' };
  }
);

/**
 * Service: Start recording services
 *
 * Initializes and starts all enabled recording services (screenshots, audio, video).
 * Returns the initial recording state for each service.
 */
export const startRecordingServices = fromPromise(
  async ({
    input,
  }: {
    input: {
      sessionId: string;
      config: SessionRecordingConfig;
      session: Session;
      callbacks: {
        onScreenshotCapture?: (screenshot: SessionScreenshot) => Promise<void>;
        onAudioSegment?: (segment: SessionAudioSegment) => void;
      };
    }
  }) => {
    const { sessionId, config, session, callbacks } = input;

    // Initialize recording state
    const recordingState: {
      screenshots: RecordingServiceState;
      audio: RecordingServiceState;
      video: RecordingServiceState;
    } = {
      screenshots: 'idle',
      audio: 'idle',
      video: 'idle',
    };

    const errors: string[] = [];

    // Start screenshot service if enabled
    if (config.screenshotsEnabled) {
      try {
        await startScreenshotService(sessionId, session, callbacks.onScreenshotCapture);
        recordingState.screenshots = 'active';
      } catch (error) {
        recordingState.screenshots = 'error';
        errors.push(`Screenshot service failed: ${error}`);
      }
    }

    // Start audio service if enabled
    if (config.audioConfig?.enabled) {
      try {
        await startAudioService(sessionId, session, config.audioConfig, callbacks.onAudioSegment);
        recordingState.audio = 'active';
      } catch (error) {
        recordingState.audio = 'error';
        errors.push(`Audio service failed: ${error}`);
      }
    }

    // Start video service if enabled
    if (config.videoConfig?.enabled) {
      try {
        await startVideoService(sessionId, session, config.videoConfig);
        recordingState.video = 'active';
      } catch (error) {
        recordingState.video = 'error';
        errors.push(`Video service failed: ${error}`);
      }
    }

    // If any critical service failed, throw error
    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }

    return { recordingState };
  }
);

/**
 * Service: Pause recording services
 *
 * Pauses all active recording services.
 */
export const pauseRecordingServices = fromPromise(
  async ({ input }: { input: { sessionId: string } }) => {
    const { sessionId } = input;
    console.log(`[sessionMachine] Pausing recording services for session: ${sessionId}`);

    const errors: string[] = [];

    // Pause screenshot capture
    try {
      await screenshotCaptureService.pauseCapture();
      console.log(`[sessionMachine] Screenshot service paused`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to pause screenshot service:`, error);
      errors.push(`Screenshot: ${error}`);
    }

    // Pause audio recording
    try {
      await audioRecordingService.pauseRecording();
      console.log(`[sessionMachine] Audio service paused`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to pause audio service:`, error);
      errors.push(`Audio: ${error}`);
    }

    // Pause video recording
    // Note: Video recording does not currently support pause/resume
    // Video will continue recording during paused state
    console.log(`[sessionMachine] Video service pause not supported (continues recording)`);

    if (errors.length > 0) {
      throw new Error(`Failed to pause services: ${errors.join(', ')}`);
    }

    return {};
  }
);

/**
 * Service: Resume recording services
 *
 * Resumes all paused recording services.
 */
export const resumeRecordingServices = fromPromise(
  async ({
    input,
  }: {
    input: {
      sessionId: string;
      config: SessionRecordingConfig;
      session: Session;
      callbacks: {
        onScreenshotCapture?: (screenshot: SessionScreenshot) => Promise<void>;
        onAudioSegment?: (segment: SessionAudioSegment) => void;
      };
    }
  }) => {
    const { sessionId, config, session, callbacks } = input;

    console.log(`[sessionMachine] Resuming recording services for session: ${sessionId}`);

    const services = [];

    // Resume screenshots if enabled
    if (config.screenshotsEnabled) {
      console.log(`[sessionMachine] Resuming screenshot capture`);
      services.push(
        startScreenshotService(sessionId, session, callbacks.onScreenshotCapture)
      );
    }

    // Resume audio if enabled
    if (config.audioConfig?.enabled) {
      console.log(`[sessionMachine] Resuming audio recording`);
      services.push(
        startAudioService(sessionId, session, config.audioConfig, callbacks.onAudioSegment)
      );
    }

    // Resume video if enabled
    if (config.videoConfig?.enabled) {
      console.log(`[sessionMachine] Resuming video recording`);
      services.push(
        startVideoService(sessionId, session, config.videoConfig)
      );
    }

    // Start all services in parallel
    await Promise.all(services);

    console.log(`[sessionMachine] ✅ All recording services resumed`);

    return {};
  }
);

/**
 * Service: Stop recording services
 *
 * Gracefully stops all recording services and performs cleanup.
 */
export const stopRecordingServices = fromPromise(
  async ({ input }: { input: { sessionId: string } }) => {
    const { sessionId } = input;
    console.log(`[sessionMachine] Stopping recording services for session: ${sessionId}`);

    const errors: string[] = [];

    // Stop screenshot capture
    try {
      await screenshotCaptureService.stopCapture();
      console.log(`[sessionMachine] Screenshot service stopped`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to stop screenshot service:`, error);
      errors.push(`Screenshot service: ${error}`);
    }

    // Stop audio recording (has 5s grace period for pending chunks)
    try {
      await audioRecordingService.stopRecording();
      console.log(`[sessionMachine] Audio service stopped`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to stop audio service:`, error);
      errors.push(`Audio service: ${error}`);
    }

    // Stop video recording
    try {
      await videoRecordingService.stopRecording();
      console.log(`[sessionMachine] Video service stopped`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to stop video service:`, error);
      errors.push(`Video service: ${error}`);
    }

    // Flush any pending storage writes
    try {
      const queue = getPersistenceQueue();
      await queue.flush();
      console.log(`[sessionMachine] Storage flushed`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to flush storage:`, error);
      errors.push(`Storage flush: ${error}`);
    }

    // Don't throw - allow session to complete even if cleanup has issues
    if (errors.length > 0) {
      console.warn(`[sessionMachine] Some services failed to stop cleanly:`, errors.join('; '));
    }

    return {};
  }
);

/**
 * Service: Monitor recording health
 *
 * Continuously monitors the health of all recording services while active.
 * Checks permissions and service status every 10 seconds.
 * Sends UPDATE_RECORDING_STATE events if issues are detected.
 */
export const monitorRecordingHealth = fromCallback(({ sendBack, input }: { sendBack: (event: { type: 'UPDATE_RECORDING_STATE'; updates: Partial<Record<string, string>> }) => void; input: { sessionId: string } }) => {
  const { sessionId } = input;
  console.log(`[sessionMachine] Starting health monitor for session: ${sessionId}`);

  // Monitor permissions and service health every 10 seconds
  const monitorInterval = setInterval(async () => {
    // Check screen recording permission
    try {
      const hasScreenPermission = await checkScreenRecordingPermission();
      if (!hasScreenPermission) {
        console.warn(`[sessionMachine] Screen recording permission lost`);
        sendBack({
          type: 'UPDATE_RECORDING_STATE',
          updates: {
            screenshots: 'error',
            video: 'error'
          }
        });
      }
    } catch (error) {
      console.error('[sessionMachine] Permission check failed:', error);
    }

    // Check microphone permission
    try {
      const hasMicPermission = await checkMicrophonePermission();
      if (!hasMicPermission) {
        console.warn(`[sessionMachine] Microphone permission lost`);
        sendBack({
          type: 'UPDATE_RECORDING_STATE',
          updates: { audio: 'error' }
        });
      }
    } catch (error) {
      console.error('[sessionMachine] Permission check failed:', error);
    }

    // Check service health
    try {
      const isScreenshotActive = screenshotCaptureService.isCapturing();
      if (!isScreenshotActive) {
        console.warn(`[sessionMachine] Screenshot service stopped`);
        sendBack({
          type: 'UPDATE_RECORDING_STATE',
          updates: { screenshots: 'error' }
        });
      }
    } catch (error) {
      console.error('[sessionMachine] Service check failed:', error);
    }
  }, 10000);

  // Cleanup function
  return () => {
    console.log(`[sessionMachine] Stopping health monitor`);
    clearInterval(monitorInterval);
  };
});

// ============================================================================
// Helper Functions (Stubs for future implementation)
// ============================================================================

/**
 * Check if the app has screen recording permission
 */
async function checkScreenRecordingPermission(): Promise<boolean> {
  try {
    return await invoke<boolean>('check_screen_recording_permission');
  } catch (error) {
    console.error('[sessionMachine] Failed to check screen recording permission:', error);
    return false;
  }
}

/**
 * Check if the app has microphone permission
 */
async function checkMicrophonePermission(): Promise<boolean> {
  try {
    return await invoke<boolean>('check_microphone_permission');
  } catch (error) {
    console.error('[sessionMachine] Failed to check microphone permission:', error);
    return false;
  }
}

/**
 * Request microphone permission proactively
 * This will trigger the macOS permission dialog if permission hasn't been determined yet
 */
async function requestMicrophonePermission(): Promise<boolean> {
  try {
    return await invoke<boolean>('request_microphone_permission');
  } catch (error) {
    console.error('[sessionMachine] Failed to request microphone permission:', error);
    return false;
  }
}

/**
 * Start screenshot capture service
 */
async function startScreenshotService(
  sessionId: string,
  session: Session,
  onCapture?: (screenshot: SessionScreenshot) => Promise<void>
): Promise<void> {
  try {
    // Wrap optional callback to match expected signature
    const callback = onCapture || (async () => {});
    await screenshotCaptureService.startCapture(session, callback);
    console.log(`[sessionMachine] Screenshot service started for session: ${sessionId}`);
  } catch (error) {
    console.error(`[sessionMachine] Failed to start screenshot service:`, error);
    throw error;
  }
}

/**
 * Start audio recording service
 */
async function startAudioService(
  sessionId: string,
  session: Session,
  config: NonNullable<SessionRecordingConfig['audioConfig']>,
  onSegment?: (segment: SessionAudioSegment) => void
): Promise<void> {
  try {
    // Provide a default no-op callback if not specified
    const callback = onSegment || (() => {});
    await audioRecordingService.startRecording(session, callback);
    console.log(`[sessionMachine] Audio service started for session: ${sessionId}`);
  } catch (error) {
    console.error(`[sessionMachine] Failed to start audio service:`, error);
    throw error;
  }
}

/**
 * Start video recording service
 */
async function startVideoService(
  sessionId: string,
  session: Session,
  config: NonNullable<SessionRecordingConfig['videoConfig']>
): Promise<void> {
  try {
    // The videoRecordingService.startRecording expects a Session object
    // with videoRecording flag and videoConfig already set
    await videoRecordingService.startRecording(session);
    console.log(`[sessionMachine] Video service started for session: ${sessionId}`);
  } catch (error) {
    console.error(`[sessionMachine] Failed to start video service:`, error);
    throw error;
  }
}

/**
 * Bundled services object for use with XState machine
 */
export const sessionMachineServices = {
  validateConfig,
  checkPermissions,
  startRecordingServices,
  pauseRecordingServices,
  resumeRecordingServices,
  stopRecordingServices,
  monitorRecordingHealth,
};
