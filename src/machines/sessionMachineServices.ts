import { fromPromise } from 'xstate';
import type { SessionRecordingConfig } from '../types';
import type { RecordingServiceState } from './sessionMachine';

/**
 * Service: Validate session configuration
 *
 * Validates that the session configuration is valid and generates a session ID.
 * Ensures required fields are present and values are within acceptable ranges.
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

    // Validate audio configuration if enabled
    if (config.audioConfig?.enabled) {
      const validSourceTypes = ['microphone', 'system-audio', 'both'];
      if (!validSourceTypes.includes(config.audioConfig.sourceType)) {
        throw new Error(`Invalid audio source type: ${config.audioConfig.sourceType}`);
      }

      // Validate balance (0-100)
      if (
        config.audioConfig.balance !== undefined &&
        (config.audioConfig.balance < 0 || config.audioConfig.balance > 100)
      ) {
        throw new Error('Audio balance must be between 0 and 100');
      }

      // Validate volumes (0.0-1.0)
      if (
        config.audioConfig.micVolume !== undefined &&
        (config.audioConfig.micVolume < 0 || config.audioConfig.micVolume > 1)
      ) {
        throw new Error('Microphone volume must be between 0.0 and 1.0');
      }

      if (
        config.audioConfig.systemVolume !== undefined &&
        (config.audioConfig.systemVolume < 0 || config.audioConfig.systemVolume > 1)
      ) {
        throw new Error('System audio volume must be between 0.0 and 1.0');
      }
    }

    // Validate video configuration if enabled
    if (config.videoConfig?.enabled) {
      const validSourceTypes = ['display', 'window', 'webcam', 'display-with-webcam'];
      if (!validSourceTypes.includes(config.videoConfig.sourceType)) {
        throw new Error(`Invalid video source type: ${config.videoConfig.sourceType}`);
      }

      // Validate that required IDs are present based on source type
      if (
        config.videoConfig.sourceType === 'display' &&
        (!config.videoConfig.displayIds || config.videoConfig.displayIds.length === 0)
      ) {
        throw new Error('Display recording requires at least one display ID');
      }

      if (
        config.videoConfig.sourceType === 'window' &&
        (!config.videoConfig.windowIds || config.videoConfig.windowIds.length === 0)
      ) {
        throw new Error('Window recording requires at least one window ID');
      }

      // Validate FPS if specified
      if (config.videoConfig.fps !== undefined) {
        if (config.videoConfig.fps < 10 || config.videoConfig.fps > 60) {
          throw new Error('Video FPS must be between 10 and 60');
        }
      }

      // Validate resolution if specified
      if (config.videoConfig.resolution) {
        if (
          config.videoConfig.resolution.width < 640 ||
          config.videoConfig.resolution.height < 480
        ) {
          throw new Error('Video resolution must be at least 640x480');
        }
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

    // Check microphone permission if needed
    if (config.audioConfig?.enabled) {
      const hasMicPermission = await checkMicrophonePermission();
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
    input: { sessionId: string; config: SessionRecordingConfig }
  }) => {
    const { sessionId, config } = input;

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
        await startScreenshotService(sessionId);
        recordingState.screenshots = 'active';
      } catch (error) {
        recordingState.screenshots = 'error';
        errors.push(`Screenshot service failed: ${error}`);
      }
    }

    // Start audio service if enabled
    if (config.audioConfig?.enabled) {
      try {
        await startAudioService(sessionId, config.audioConfig);
        recordingState.audio = 'active';
      } catch (error) {
        recordingState.audio = 'error';
        errors.push(`Audio service failed: ${error}`);
      }
    }

    // Start video service if enabled
    if (config.videoConfig?.enabled) {
      try {
        await startVideoService(sessionId, config.videoConfig);
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

    // TODO: Implement actual pause logic
    // For now, this is a stub that will be implemented in future tasks
    console.log(`[sessionMachine] Pausing recording services for session: ${sessionId}`);

    return {};
  }
);

/**
 * Service: Resume recording services
 *
 * Resumes all paused recording services.
 */
export const resumeRecordingServices = fromPromise(
  async ({ input }: { input: { sessionId: string } }) => {
    const { sessionId } = input;

    // TODO: Implement actual resume logic
    // For now, this is a stub that will be implemented in future tasks
    console.log(`[sessionMachine] Resuming recording services for session: ${sessionId}`);

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

    // TODO: Implement actual stop logic
    // For now, this is a stub that will be implemented in future tasks
    console.log(`[sessionMachine] Stopping recording services for session: ${sessionId}`);

    return {};
  }
);

/**
 * Service: Monitor recording health
 *
 * Continuously monitors the health of all recording services while active.
 * This service runs in the background and can detect issues early.
 */
export const monitorRecordingHealth = fromPromise(
  async ({ input }: { input: { sessionId: string } }) => {
    const { sessionId } = input;

    // TODO: Implement actual health monitoring
    // For now, this is a stub that will be implemented in future tasks
    console.log(`[sessionMachine] Monitoring recording health for session: ${sessionId}`);

    // This would normally run continuously, checking service health
    // and potentially sending UPDATE_RECORDING_STATE events if issues are detected

    return {};
  }
);

// ============================================================================
// Helper Functions (Stubs for future implementation)
// ============================================================================

/**
 * Check if the app has screen recording permission
 */
async function checkScreenRecordingPermission(): Promise<boolean> {
  // TODO: Implement actual permission check
  // This would use Tauri commands to check macOS screen recording permission
  console.log('[sessionMachine] Checking screen recording permission (stub)');
  return true;
}

/**
 * Check if the app has microphone permission
 */
async function checkMicrophonePermission(): Promise<boolean> {
  // TODO: Implement actual permission check
  // This would use Tauri commands to check microphone permission
  console.log('[sessionMachine] Checking microphone permission (stub)');
  return true;
}

/**
 * Start screenshot capture service
 */
async function startScreenshotService(sessionId: string): Promise<void> {
  // TODO: Integrate with actual screenshot service
  // This would call screenshotCaptureService.startCapture()
  console.log(`[sessionMachine] Starting screenshot service for session: ${sessionId} (stub)`);
}

/**
 * Start audio recording service
 */
async function startAudioService(
  sessionId: string,
  config: NonNullable<SessionRecordingConfig['audioConfig']>
): Promise<void> {
  // TODO: Integrate with actual audio service
  // This would call audioRecordingService.startRecording()
  console.log(
    `[sessionMachine] Starting audio service for session: ${sessionId}, source: ${config.sourceType} (stub)`
  );
}

/**
 * Start video recording service
 */
async function startVideoService(
  sessionId: string,
  config: NonNullable<SessionRecordingConfig['videoConfig']>
): Promise<void> {
  // TODO: Integrate with actual video service
  // This would call video recording Tauri commands
  console.log(
    `[sessionMachine] Starting video service for session: ${sessionId}, source: ${config.sourceType} (stub)`
  );
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
