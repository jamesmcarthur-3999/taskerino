/**
 * @file sessionValidation.ts - Session configuration validation utilities
 *
 * @overview
 * Provides comprehensive validation for session configurations including audio devices,
 * video recording setups, and session-level settings. Ensures configurations are valid
 * before starting a session to prevent runtime errors.
 */

import type {
  Session,
  AudioDeviceConfig,
  VideoRecordingConfig,
  AudioSourceType,
  VideoSourceType,
} from '../types';

/**
 * Validation result returned by all validation functions
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates audio device configuration
 *
 * @param config - Audio device configuration to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateAudioConfig({
 *   sourceType: 'microphone',
 *   micDeviceId: 'default',
 *   micVolume: 1.0
 * });
 * if (!result.valid) {
 *   console.error('Audio config errors:', result.errors);
 * }
 * ```
 *
 * @validation_rules
 * - sourceType must be 'microphone', 'system-audio', or 'both'
 * - micDeviceId required for 'microphone' and 'both' modes
 * - systemAudioDeviceId required for 'system-audio' and 'both' modes
 * - balance must be 0-100 (only for 'both' mode)
 * - volumes must be 0.0-1.0 (finite numbers)
 * - Device IDs cannot be empty strings
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
 * Validates video recording configuration
 *
 * @param config - Video recording configuration to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateVideoConfig({
 *   sourceType: 'display',
 *   displayIds: ['main-display'],
 *   quality: 'high',
 *   fps: 30
 * });
 * ```
 *
 * @validation_rules
 * - sourceType: 'display', 'window', 'webcam', 'display-with-webcam', or 'multi-source'
 * - displayIds required for 'display' and 'display-with-webcam' modes
 * - windowIds required for 'window' mode
 * - webcamDeviceId required for 'webcam' and 'display-with-webcam' modes
 * - multiSourceConfig required for 'multi-source' mode (≥2 sources)
 * - quality: 'low', 'medium', 'high', or 'ultra'
 * - fps: 10-60 (finite number)
 * - resolution: width ≥640, height ≥480
 * - PiP config validated for 'display-with-webcam' mode
 *
 * @wave_1_3
 * Added support for 'multi-source' recording with compositor modes
 */
export function validateVideoConfig(config: VideoRecordingConfig): ValidationResult {
  const errors: string[] = [];

  // Edge case: null or undefined config
  if (!config) {
    errors.push('Video config cannot be null or undefined');
    return { valid: false, errors };
  }

  // Validate source type (Wave 1.3: added 'multi-source')
  const validSourceTypes: Array<VideoSourceType | 'multi-source'> = ['display', 'window', 'webcam', 'display-with-webcam', 'multi-source'];
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

  // Validate multi-source config (Wave 1.3)
  if (config.sourceType === 'multi-source') {
    if (!config.multiSourceConfig) {
      errors.push('multiSourceConfig is required when sourceType is "multi-source"');
    } else {
      if (!config.multiSourceConfig.sources || config.multiSourceConfig.sources.length === 0) {
        errors.push('At least one source is required in multiSourceConfig');
      } else if (config.multiSourceConfig.sources.length < 2) {
        errors.push('Multi-source recording requires at least 2 sources');
      }

      const validCompositors = ['passthrough', 'grid', 'sidebyside'];
      if (!validCompositors.includes(config.multiSourceConfig.compositor)) {
        errors.push(`Invalid compositor: ${config.multiSourceConfig.compositor}. Must be one of: ${validCompositors.join(', ')}`);
      }
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
 * Validates complete session configuration before starting
 *
 * @param session - Partial session object to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateSession({
 *   name: "Work Session",
 *   description: "Daily work",
 *   screenshotInterval: 5,
 *   audioRecording: true,
 *   audioConfig: { ... },
 *   videoRecording: false
 * });
 * if (!result.valid) {
 *   // Show errors to user
 * }
 * ```
 *
 * @validation_rules
 * - name: non-empty string
 * - description: must be a string if provided
 * - screenshotInterval: ≥1 minute or -1 for adaptive mode
 * - audioConfig: validated if audioRecording is true
 * - videoConfig: validated if videoRecording is true
 * - enrichmentConfig: all boolean fields validated, maxCostThreshold ≥0
 *
 * @edge_cases
 * - Handles null/undefined session gracefully
 * - Allows partial configuration for updates
 * - Validates nested configs (audio, video, enrichment)
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
    } else if (session.screenshotInterval !== -1 && session.screenshotInterval < 0.1) {
      // Allow intervals down to 0.1 minutes (6 seconds) - UI offers 10s (0.167) and 30s (0.5)
      errors.push('screenshotInterval must be at least 0.1 minutes (6 seconds) or -1 for adaptive mode');
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
 * Checks if a session uses the new media config system (Phase 3+)
 *
 * @param session - Session to check
 * @returns true if session uses audioConfig or videoConfig
 *
 * @example
 * ```typescript
 * if (hasMediaConfig(session)) {
 *   // Use new Phase 3 media system
 * } else {
 *   // Migrate from legacy
 * }
 * ```
 *
 * @phase_3
 * New sessions use audioConfig/videoConfig instead of legacy boolean flags
 */
export function hasMediaConfig(session: Session): boolean {
  return !!(session.audioConfig || session.videoConfig);
}

/**
 * Validates that selected audio devices are currently available
 *
 * @param config - Audio device configuration to validate
 * @param availableDevices - Array of currently available audio devices
 * @returns Validation result with errors for missing devices
 *
 * @example
 * ```typescript
 * const availableDevices = await audioRecordingService.getAudioDevices();
 * const result = validateAudioDeviceAvailability(config, availableDevices);
 * if (!result.valid) {
 *   // Fallback to default device or show error
 * }
 * ```
 *
 * @runtime_validation
 * This checks if devices configured in the session still exist at runtime.
 * Devices may be disconnected between configuration and session start.
 */
export function validateAudioDeviceAvailability(
  config: AudioDeviceConfig,
  availableDevices: Array<{ id: string; name: string; deviceType: string }>
): ValidationResult {
  const errors: string[] = [];

  if (!config) {
    errors.push('Audio config cannot be null or undefined');
    return { valid: false, errors };
  }

  if (!availableDevices || availableDevices.length === 0) {
    errors.push('No audio devices available');
    return { valid: false, errors };
  }

  // Check microphone device
  if (config.sourceType === 'microphone' || config.sourceType === 'both') {
    if (config.micDeviceId) {
      const micExists = availableDevices.some(
        (d) => d.id === config.micDeviceId && d.deviceType === 'Input'
      );
      if (!micExists) {
        errors.push(`Microphone device not found: ${config.micDeviceId}. Device may have been disconnected.`);
      }
    }
  }

  // Check system audio device
  if (config.sourceType === 'system-audio' || config.sourceType === 'both') {
    if (config.systemAudioDeviceId) {
      const systemAudioExists = availableDevices.some(
        (d) => d.id === config.systemAudioDeviceId && d.deviceType === 'Output'
      );
      if (!systemAudioExists) {
        errors.push(`System audio device not found: ${config.systemAudioDeviceId}. Device may have been disconnected.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Attempts to fix audio config by falling back to default devices
 *
 * @param config - Audio device configuration with missing devices
 * @param availableDevices - Array of currently available audio devices
 * @returns Fixed config with default devices, or null if no devices available
 *
 * @example
 * ```typescript
 * const fixed = fallbackToDefaultAudioDevices(config, availableDevices);
 * if (fixed) {
 *   // Use fixed config
 * } else {
 *   // Cannot proceed - no devices available
 * }
 * ```
 *
 * @fallback_strategy
 * - Replaces missing microphone with default input device
 * - Replaces missing system audio with default output device
 * - Returns null if no default devices are available
 */
export function fallbackToDefaultAudioDevices(
  config: AudioDeviceConfig,
  availableDevices: Array<{ id: string; name: string; deviceType: string; isDefault: boolean }>
): AudioDeviceConfig | null {
  const fixed = { ...config };
  let madeChanges = false;

  // Find default input device
  const defaultInput = availableDevices.find((d) => d.deviceType === 'Input' && d.isDefault);
  const firstInput = availableDevices.find((d) => d.deviceType === 'Input');
  const fallbackInput = defaultInput || firstInput;

  // Find default output device
  const defaultOutput = availableDevices.find((d) => d.deviceType === 'Output' && d.isDefault);
  const firstOutput = availableDevices.find((d) => d.deviceType === 'Output');
  const fallbackOutput = defaultOutput || firstOutput;

  // Fix microphone device
  if (config.sourceType === 'microphone' || config.sourceType === 'both') {
    if (config.micDeviceId) {
      const micExists = availableDevices.some(
        (d) => d.id === config.micDeviceId && d.deviceType === 'Input'
      );
      if (!micExists && fallbackInput) {
        console.warn(`[VALIDATION] Microphone device "${config.micDeviceId}" not found, falling back to ${fallbackInput.name}`);
        fixed.micDeviceId = fallbackInput.id;
        madeChanges = true;
      } else if (!micExists && !fallbackInput) {
        // No input device available - cannot proceed with microphone mode
        if (config.sourceType === 'microphone') {
          return null; // Cannot use microphone-only mode without input device
        }
        // For 'both' mode, switch to system-audio only
        fixed.sourceType = 'system-audio';
        madeChanges = true;
      }
    }
  }

  // Fix system audio device
  if (config.sourceType === 'system-audio' || config.sourceType === 'both') {
    if (config.systemAudioDeviceId) {
      const systemExists = availableDevices.some(
        (d) => d.id === config.systemAudioDeviceId && d.deviceType === 'Output'
      );
      if (!systemExists && fallbackOutput) {
        console.warn(`[VALIDATION] System audio device "${config.systemAudioDeviceId}" not found, falling back to ${fallbackOutput.name}`);
        fixed.systemAudioDeviceId = fallbackOutput.id;
        madeChanges = true;
      } else if (!systemExists && !fallbackOutput) {
        // No output device available - cannot proceed with system-audio mode
        if (config.sourceType === 'system-audio') {
          return null; // Cannot use system-audio-only mode without output device
        }
        // For 'both' mode, switch to microphone only
        fixed.sourceType = 'microphone';
        madeChanges = true;
      }
    }
  }

  return madeChanges ? fixed : config;
}

