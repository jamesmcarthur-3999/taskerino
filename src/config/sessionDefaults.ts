/**
 * Session Default Configuration
 *
 * Centralized defaults for all session recording settings.
 * These values are used when users don't explicitly configure settings.
 *
 * Philosophy: We make smart decisions so users don't have to worry about
 * technical details. All defaults are chosen for optimal balance of quality,
 * file size, and compatibility.
 */

export const SESSION_DEFAULTS = {
  /**
   * Video Recording Defaults
   *
   * - H.264: Best compatibility across all platforms
   * - 5000 kbps: High quality for 1080p without bloat
   * - Native resolution: Uses display's native resolution
   * - 30fps: Smooth playback, reasonable file size
   */
  video: {
    codec: 'h264' as const,
    bitrate: 5000, // kbps
    resolution: 'native' as const, // Will use display's native resolution
    frameRate: 30,
  },

  /**
   * Screenshot Defaults
   *
   * - WebP: Best compression (40-60% smaller than JPEG/PNG)
   * - 80% quality: Excellent visual quality for AI analysis
   * - Auto-fallback: Falls back to JPEG if WebP not supported
   */
  screenshot: {
    format: 'webp' as const,
    quality: 80,
  },

  /**
   * Audio Recording Defaults
   *
   * - 48kHz: Industry standard for high-quality recording
   * - 16-bit: Perfect for voice, smaller than 24-bit
   */
  audio: {
    sampleRate: 48000, // Hz
    bitDepth: 16,
  },

  /**
   * Storage Defaults
   *
   * - Location: Automatic (uses app data directory)
   * - Naming: Timestamped with session name
   */
  storage: {
    location: 'auto' as const, // Resolves to {appDataDir}/taskerino/sessions/
    namingPattern: 'session-{timestamp}-{name}' as const,
  },

  /**
   * Picture-in-Picture (Webcam) Defaults
   */
  pip: {
    position: 'bottom-right' as const,
    size: 'medium' as const,
    borderEnabled: true,
  },
} as const;

/**
 * Helper type to extract default values
 */
export type SessionDefaultsType = typeof SESSION_DEFAULTS;

/**
 * Get default video codec
 */
export function getDefaultVideoCodec(): 'h264' | 'h265' | 'vp9' {
  return SESSION_DEFAULTS.video.codec;
}

/**
 * Get default video bitrate
 */
export function getDefaultVideoBitrate(): number {
  return SESSION_DEFAULTS.video.bitrate;
}

/**
 * Get default video frame rate
 */
export function getDefaultVideoFrameRate(): number {
  return SESSION_DEFAULTS.video.frameRate;
}

/**
 * Get default screenshot format
 */
export function getDefaultScreenshotFormat(): 'png' | 'jpg' | 'webp' {
  return SESSION_DEFAULTS.screenshot.format;
}

/**
 * Get default screenshot quality
 */
export function getDefaultScreenshotQuality(): number {
  return SESSION_DEFAULTS.screenshot.quality;
}

/**
 * Get default audio sample rate
 */
export function getDefaultAudioSampleRate(): number {
  return SESSION_DEFAULTS.audio.sampleRate;
}

/**
 * Get default audio bit depth
 */
export function getDefaultAudioBitDepth(): number {
  return SESSION_DEFAULTS.audio.bitDepth;
}

/**
 * Get default PiP position
 */
export function getDefaultPipPosition(): 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' {
  return SESSION_DEFAULTS.pip.position;
}

/**
 * Get default PiP size
 */
export function getDefaultPipSize(): 'small' | 'medium' | 'large' {
  return SESSION_DEFAULTS.pip.size;
}

/**
 * Get default PiP border enabled
 */
export function getDefaultPipBorderEnabled(): boolean {
  return SESSION_DEFAULTS.pip.borderEnabled;
}
