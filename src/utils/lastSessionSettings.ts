/**
 * Last Session Settings
 *
 * Persists user's last session configuration to enable one-click start.
 * Stored in localStorage for cross-session persistence.
 */

export interface LastSessionSettings {
  screenshotInterval: number;
  enableScreenshots: boolean;
  audioRecording: boolean;
  videoRecording?: boolean;
  autoAnalysis: boolean;
  lastUsed: string; // ISO timestamp
}

const STORAGE_KEY = 'taskerino_last_session_settings';

const DEFAULT_SETTINGS: LastSessionSettings = {
  screenshotInterval: 2,
  enableScreenshots: true,
  audioRecording: false,
  videoRecording: false,
  autoAnalysis: true,
  lastUsed: new Date().toISOString(),
};

/**
 * Load last session settings from localStorage
 */
export function loadLastSessionSettings(): LastSessionSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored);

    // Validate the loaded settings
    if (!isValidSettings(parsed)) {
      console.warn('Invalid last session settings found, using defaults');
      return DEFAULT_SETTINGS;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load last session settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save session settings to localStorage
 */
export function saveLastSessionSettings(settings: Partial<LastSessionSettings>): void {
  try {
    const current = loadLastSessionSettings();
    const updated: LastSessionSettings = {
      ...current,
      ...settings,
      lastUsed: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save last session settings:', error);
  }
}

/**
 * Get a human-readable summary of settings for display
 */
export function getSettingsSummary(settings: LastSessionSettings): string {
  const parts: string[] = [];

  // Interval
  if (settings.screenshotInterval < 1) {
    parts.push(`${settings.screenshotInterval * 60}s intervals`);
  } else {
    parts.push(`${settings.screenshotInterval}m intervals`);
  }

  // Screenshot status
  if (settings.enableScreenshots) {
    parts.push('screenshots on');
  } else {
    parts.push('screenshots off');
  }

  // Audio status
  if (settings.audioRecording) {
    parts.push('audio on');
  } else {
    parts.push('audio off');
  }

  // Video status
  if (settings.videoRecording) {
    parts.push('video on');
  } else {
    parts.push('video off');
  }

  return parts.join(', ');
}

/**
 * Reset to default settings
 */
export function resetSessionSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to reset session settings:', error);
  }
}

/**
 * Validate settings object
 */
function isValidSettings(settings: any): settings is LastSessionSettings {
  return (
    settings &&
    typeof settings.screenshotInterval === 'number' &&
    settings.screenshotInterval > 0 &&
    typeof settings.enableScreenshots === 'boolean' &&
    typeof settings.audioRecording === 'boolean' &&
    typeof settings.autoAnalysis === 'boolean' &&
    typeof settings.lastUsed === 'string'
  );
}
