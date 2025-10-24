import type {
  Session,
  AudioDeviceConfig,
  VideoRecordingConfig,
  AudioSourceType,
  VideoSourceType,
} from '../types';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate audio device configuration
 */
export function validateAudioConfig(config: AudioDeviceConfig): ValidationResult {
  const errors: string[] = [];

  // Edge case: null or undefined config
  if (!config) {
    errors.push('Audio config cannot be null or undefined');
    return { valid: false, errors };
  }

  // Validate source type
  const validSourceTypes: AudioSourceType[] = ['microphone', 'system-audio', 'both'];
  if (!validSourceTypes.includes(config.sourceType)) {
    errors.push(`Invalid sourceType: ${config.sourceType}. Must be one of: ${validSourceTypes.join(', ')}`);
  }

  // Validate device IDs based on source type (check for empty strings)
  if (config.sourceType === 'microphone') {
    if (!config.micDeviceId || config.micDeviceId.trim() === '') {
      errors.push('micDeviceId is required and cannot be empty when sourceType is "microphone"');
    }
  }

  if (config.sourceType === 'system-audio') {
    if (!config.systemAudioDeviceId || config.systemAudioDeviceId.trim() === '') {
      errors.push('systemAudioDeviceId is required and cannot be empty when sourceType is "system-audio"');
    }
  }

  if (config.sourceType === 'both') {
    if (!config.micDeviceId || config.micDeviceId.trim() === '') {
      errors.push('micDeviceId is required and cannot be empty when sourceType is "both"');
    }
    if (!config.systemAudioDeviceId || config.systemAudioDeviceId.trim() === '') {
      errors.push('systemAudioDeviceId is required and cannot be empty when sourceType is "both"');
    }
  }

  // Validate balance (only for 'both' mode)
  if (config.balance !== undefined && config.balance !== null) {
    if (typeof config.balance !== 'number' || isNaN(config.balance)) {
      errors.push('balance must be a valid number');
    } else if (config.balance < 0 || config.balance > 100) {
      errors.push(`Invalid balance: ${config.balance}. Must be between 0 and 100`);
    }
  }

  // Validate volumes (check for NaN, Infinity, negative values)
  if (config.micVolume !== undefined && config.micVolume !== null) {
    if (typeof config.micVolume !== 'number' || isNaN(config.micVolume) || !isFinite(config.micVolume)) {
      errors.push('micVolume must be a valid finite number');
    } else if (config.micVolume < 0 || config.micVolume > 1) {
      errors.push(`Invalid micVolume: ${config.micVolume}. Must be between 0.0 and 1.0`);
    }
  }

  if (config.systemVolume !== undefined && config.systemVolume !== null) {
    if (typeof config.systemVolume !== 'number' || isNaN(config.systemVolume) || !isFinite(config.systemVolume)) {
      errors.push('systemVolume must be a valid finite number');
    } else if (config.systemVolume < 0 || config.systemVolume > 1) {
      errors.push(`Invalid systemVolume: ${config.systemVolume}. Must be between 0.0 and 1.0`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate video recording configuration
 */
export function validateVideoConfig(config: VideoRecordingConfig): ValidationResult {
  const errors: string[] = [];

  // Edge case: null or undefined config
  if (!config) {
    errors.push('Video config cannot be null or undefined');
    return { valid: false, errors };
  }

  // Validate source type
  const validSourceTypes: VideoSourceType[] = ['display', 'window', 'webcam', 'display-with-webcam'];
  if (!validSourceTypes.includes(config.sourceType)) {
    errors.push(`Invalid sourceType: ${config.sourceType}. Must be one of: ${validSourceTypes.join(', ')}`);
  }

  // Validate source-specific requirements
  if (config.sourceType === 'display' || config.sourceType === 'display-with-webcam') {
    if (!config.displayIds || config.displayIds.length === 0) {
      errors.push('At least one displayId is required when sourceType includes display');
    } else {
      // Check for empty strings in displayIds
      const emptyDisplayIds = config.displayIds.filter(id => !id || id.trim() === '');
      if (emptyDisplayIds.length > 0) {
        errors.push('displayIds cannot contain empty strings');
      }
    }
  }

  if (config.sourceType === 'window') {
    if (!config.windowIds || config.windowIds.length === 0) {
      errors.push('At least one windowId is required when sourceType is "window"');
    } else {
      const emptyWindowIds = config.windowIds.filter(id => !id || id.trim() === '');
      if (emptyWindowIds.length > 0) {
        errors.push('windowIds cannot contain empty strings');
      }
    }
  }

  if (config.sourceType === 'webcam' || config.sourceType === 'display-with-webcam') {
    if (!config.webcamDeviceId || config.webcamDeviceId.trim() === '') {
      errors.push('webcamDeviceId is required and cannot be empty when sourceType includes webcam');
    }
  }

  // Validate PiP config (only for display-with-webcam)
  if (config.sourceType === 'display-with-webcam' && config.pipConfig) {
    const validPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    if (!validPositions.includes(config.pipConfig.position)) {
      errors.push(`Invalid PiP position: ${config.pipConfig.position}`);
    }

    const validSizes = ['small', 'medium', 'large'];
    if (!validSizes.includes(config.pipConfig.size)) {
      errors.push(`Invalid PiP size: ${config.pipConfig.size}`);
    }

    if (config.pipConfig.borderRadius !== undefined && config.pipConfig.borderRadius !== null) {
      if (typeof config.pipConfig.borderRadius !== 'number' || isNaN(config.pipConfig.borderRadius) || config.pipConfig.borderRadius < 0) {
        errors.push('PiP borderRadius must be a non-negative number');
      }
    }
  }

  // Validate quality preset
  const validQualities = ['low', 'medium', 'high', 'ultra'];
  if (!validQualities.includes(config.quality)) {
    errors.push(`Invalid quality: ${config.quality}. Must be one of: ${validQualities.join(', ')}`);
  }

  // Validate FPS (check for NaN, non-finite values)
  if (typeof config.fps !== 'number' || isNaN(config.fps) || !isFinite(config.fps)) {
    errors.push('fps must be a valid finite number');
  } else if (config.fps < 10 || config.fps > 60) {
    errors.push(`Invalid fps: ${config.fps}. Must be between 10 and 60`);
  }

  // Validate resolution (if provided)
  if (config.resolution) {
    if (typeof config.resolution.width !== 'number' || isNaN(config.resolution.width) || config.resolution.width < 640) {
      errors.push('Resolution width must be a valid number and at least 640');
    }
    if (typeof config.resolution.height !== 'number' || isNaN(config.resolution.height) || config.resolution.height < 480) {
      errors.push('Resolution height must be a valid number and at least 480');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate complete session configuration
 */
export function validateSession(session: Partial<Session>): ValidationResult {
  const errors: string[] = [];

  // Edge case: null or undefined session
  if (!session) {
    errors.push('Session cannot be null or undefined');
    return { valid: false, errors };
  }

  // Validate basic required fields
  if (session.name !== undefined && (typeof session.name !== 'string' || session.name.trim() === '')) {
    errors.push('Session name must be a non-empty string');
  }

  if (session.description !== undefined && typeof session.description !== 'string') {
    errors.push('Session description must be a string');
  }

  // Validate screenshot interval
  if (session.screenshotInterval !== undefined) {
    if (typeof session.screenshotInterval !== 'number' || isNaN(session.screenshotInterval)) {
      errors.push('screenshotInterval must be a valid number');
    } else if (session.screenshotInterval !== -1 && session.screenshotInterval < 1) {
      errors.push('screenshotInterval must be at least 1 minute or -1 for adaptive mode');
    }
  }

  // Validate audio config if audio recording is enabled
  if (session.audioRecording === true) {
    if (!session.audioConfig) {
      errors.push('audioConfig is required when audioRecording is enabled');
    } else {
      const audioValidation = validateAudioConfig(session.audioConfig);
      if (!audioValidation.valid) {
        errors.push(...audioValidation.errors.map(e => `Audio config: ${e}`));
      }
    }
  }

  // Validate video config if video recording is enabled
  if (session.videoRecording === true) {
    if (!session.videoConfig) {
      errors.push('videoConfig is required when videoRecording is enabled');
    } else {
      const videoValidation = validateVideoConfig(session.videoConfig);
      if (!videoValidation.valid) {
        errors.push(...videoValidation.errors.map(e => `Video config: ${e}`));
      }
    }
  }

  // Validate enrichment config if present
  if (session.enrichmentConfig) {
    if (typeof session.enrichmentConfig.includeAudioReview !== 'boolean') {
      errors.push('enrichmentConfig.includeAudioReview must be a boolean');
    }
    if (typeof session.enrichmentConfig.includeVideoChapters !== 'boolean') {
      errors.push('enrichmentConfig.includeVideoChapters must be a boolean');
    }
    if (typeof session.enrichmentConfig.autoEnrichOnComplete !== 'boolean') {
      errors.push('enrichmentConfig.autoEnrichOnComplete must be a boolean');
    }
    if (session.enrichmentConfig.maxCostThreshold !== undefined) {
      if (typeof session.enrichmentConfig.maxCostThreshold !== 'number' ||
          isNaN(session.enrichmentConfig.maxCostThreshold) ||
          session.enrichmentConfig.maxCostThreshold < 0) {
        errors.push('enrichmentConfig.maxCostThreshold must be a non-negative number');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a session uses the new media config system
 */
export function hasMediaConfig(session: Session): boolean {
  return !!(session.audioConfig || session.videoConfig);
}

/**
 * Check if a session is using legacy (pre-media-config) settings
 */
export function isLegacySession(session: Session): boolean {
  return !hasMediaConfig(session);
}
