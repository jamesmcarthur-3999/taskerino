import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getStorage } from '../services/storage';

// Types (extracted from AppContext)
interface AISettings {
  systemInstructions: string;
  autoMergeNotes: boolean;
  autoExtractTasks: boolean;
}

interface LearningSettings {
  enabled: boolean;
  confirmationPoints: number;
  rejectionPenalty: number;
  applicationBonus: number;
  flagMultiplier: number;
  timeDecayDays: number;
  timeDecayRate: number;
  thresholds: {
    deprecated: number;
    active: number;
    rule: number;
  };
}

interface UserProfile {
  name: string;
}

interface UserLearnings {
  userId: string;
  profileName: string;
  learnings: any[];
  stats: {
    totalLearnings: number;
    activeRules: number;
    experimentalPatterns: number;
    observations: number;
  };
}

interface NedSettings {
  chattiness: 'concise' | 'balanced' | 'verbose';
  showThinking: boolean;
  permissions: Array<{
    toolName: string;
    level: 'forever' | 'session' | 'always-ask';
    grantedAt: string;
  }>;
  sessionPermissions: Array<{
    toolName: string;
    level: 'forever' | 'session' | 'always-ask';
    grantedAt: string;
  }>;
  tokenUsage: {
    total: number;
    thisMonth: number;
    estimatedCost: number;
  };
}

/**
 * Session Recording Defaults
 *
 * User-customizable defaults for session recording.
 * Merged from sessionDefaults.ts for centralized configuration.
 */
interface SessionRecordingDefaults {
  // Video defaults
  video: {
    codec: 'h264' | 'h265' | 'vp9';
    bitrate: number; // kbps
    resolution: 'native' | { width: number; height: number };
    frameRate: number;
  };

  // Screenshot defaults
  screenshot: {
    format: 'png' | 'jpg' | 'webp';
    quality: number; // 0-100
  };

  // Audio defaults
  audio: {
    sampleRate: number; // Hz
    bitDepth: 16 | 24;
  };

  // PiP defaults
  pip: {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    size: 'small' | 'medium' | 'large';
    borderEnabled: boolean;
  };

  // Audio recording advanced settings
  audioRecording: {
    micGain: number; // 0-200 (100 = unity)
    systemAudioGain: number; // 0-200 (100 = unity)
    micNoiseReduction: boolean;
    micEchoCancellation: boolean;
    autoLeveling: boolean;
    compression: boolean;
    compressionThreshold: number; // dB
    perAppAudioEnabled: boolean;
    vadThreshold: number; // -50 to -20 dB, default -45
  };

  // Last-used device selections (for restoring on next session)
  lastUsedDevices: {
    micDeviceId?: string;
    systemAudioDeviceId?: string;
    webcamDeviceId?: string;
    displayIds?: string[];
  };
}

interface SettingsState {
  aiSettings: AISettings;
  learningSettings: LearningSettings;
  userProfile: UserProfile;
  learnings: UserLearnings;
  nedSettings: NedSettings;
  sessionRecordingDefaults: SessionRecordingDefaults;
}

type SettingsAction =
  | { type: 'UPDATE_AI_SETTINGS'; payload: Partial<AISettings> }
  | { type: 'UPDATE_LEARNING_SETTINGS'; payload: Partial<LearningSettings> }
  | { type: 'UPDATE_USER_PROFILE'; payload: Partial<UserProfile> }
  | { type: 'UPDATE_NED_SETTINGS'; payload: Partial<NedSettings> }
  | { type: 'UPDATE_SESSION_RECORDING_DEFAULTS'; payload: Partial<SessionRecordingDefaults> }
  | { type: 'GRANT_NED_PERMISSION'; payload: { toolName: string; level: 'forever' | 'session' | 'always-ask'; sessionOnly?: boolean } }
  | { type: 'REVOKE_NED_PERMISSION'; payload: { toolName: string; sessionOnly?: boolean } }
  | { type: 'CLEAR_SESSION_PERMISSIONS' }
  | { type: 'LOAD_SETTINGS'; payload: Partial<SettingsState> };

// Default state (copied from AppContext)
const defaultState: SettingsState = {
  aiSettings: {
    systemInstructions: `You are a helpful assistant that organizes notes and extracts actionable tasks. Be concise and focus on what matters.`,
    autoMergeNotes: true,
    autoExtractTasks: true,
  },
  learningSettings: {
    enabled: true,
    confirmationPoints: 10,
    rejectionPenalty: 20,
    applicationBonus: 1,
    flagMultiplier: 1.5,
    timeDecayDays: 30,
    timeDecayRate: 0.5,
    thresholds: {
      deprecated: 10,
      active: 50,
      rule: 80,
    },
  },
  userProfile: {
    name: '',
  },
  learnings: {
    userId: 'default',
    profileName: 'Personal',
    learnings: [],
    stats: {
      totalLearnings: 0,
      activeRules: 0,
      experimentalPatterns: 0,
      observations: 0,
    },
  },
  nedSettings: {
    chattiness: 'balanced',
    showThinking: false,
    permissions: [],
    sessionPermissions: [],
    tokenUsage: {
      total: 0,
      thisMonth: 0,
      estimatedCost: 0,
    },
  },
  sessionRecordingDefaults: {
    video: {
      codec: 'h264',
      bitrate: 5000, // kbps
      resolution: 'native',
      frameRate: 30,
    },
    screenshot: {
      format: 'webp',
      quality: 80,
    },
    audio: {
      sampleRate: 48000, // Hz
      bitDepth: 16,
    },
    pip: {
      position: 'bottom-right',
      size: 'medium',
      borderEnabled: true,
    },
    audioRecording: {
      micGain: 100, // Unity gain (no change)
      systemAudioGain: 100, // Unity gain (no change)
      micNoiseReduction: false,
      micEchoCancellation: false,
      autoLeveling: false,
      compression: false,
      compressionThreshold: -20, // dB
      perAppAudioEnabled: false,
      vadThreshold: -45, // dB (-50 = very sensitive, -40 = normal, -30 = aggressive)
    },
    lastUsedDevices: {
      micDeviceId: undefined,
      systemAudioDeviceId: undefined,
      webcamDeviceId: undefined,
      displayIds: undefined,
    },
  },
};

// Reducer (copied logic from AppContext reducer)
function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'UPDATE_AI_SETTINGS':
      return { ...state, aiSettings: { ...state.aiSettings, ...action.payload } };

    case 'UPDATE_LEARNING_SETTINGS':
      return { ...state, learningSettings: { ...state.learningSettings, ...action.payload } };

    case 'UPDATE_USER_PROFILE':
      return { ...state, userProfile: { ...state.userProfile, ...action.payload } };

    case 'UPDATE_NED_SETTINGS':
      return { ...state, nedSettings: { ...state.nedSettings, ...action.payload } };

    case 'UPDATE_SESSION_RECORDING_DEFAULTS':
      return {
        ...state,
        sessionRecordingDefaults: {
          ...state.sessionRecordingDefaults,
          ...action.payload,
          // Ensure nested objects are merged properly
          video: action.payload.video ? { ...state.sessionRecordingDefaults.video, ...action.payload.video } : state.sessionRecordingDefaults.video,
          screenshot: action.payload.screenshot ? { ...state.sessionRecordingDefaults.screenshot, ...action.payload.screenshot } : state.sessionRecordingDefaults.screenshot,
          audio: action.payload.audio ? { ...state.sessionRecordingDefaults.audio, ...action.payload.audio } : state.sessionRecordingDefaults.audio,
          pip: action.payload.pip ? { ...state.sessionRecordingDefaults.pip, ...action.payload.pip } : state.sessionRecordingDefaults.pip,
          audioRecording: action.payload.audioRecording ? { ...state.sessionRecordingDefaults.audioRecording, ...action.payload.audioRecording } : state.sessionRecordingDefaults.audioRecording,
          lastUsedDevices: action.payload.lastUsedDevices ? { ...state.sessionRecordingDefaults.lastUsedDevices, ...action.payload.lastUsedDevices } : state.sessionRecordingDefaults.lastUsedDevices,
        },
      };

    case 'GRANT_NED_PERMISSION': {
      const { toolName, level, sessionOnly } = action.payload;
      const permission = {
        toolName,
        level,
        grantedAt: new Date().toISOString(),
      };

      if (sessionOnly) {
        return {
          ...state,
          nedSettings: {
            ...state.nedSettings,
            sessionPermissions: [
              ...state.nedSettings.sessionPermissions.filter(p => p.toolName !== toolName),
              permission,
            ],
          },
        };
      } else {
        return {
          ...state,
          nedSettings: {
            ...state.nedSettings,
            permissions: [
              ...state.nedSettings.permissions.filter(p => p.toolName !== toolName),
              permission,
            ],
          },
        };
      }
    }

    case 'REVOKE_NED_PERMISSION': {
      const { toolName, sessionOnly } = action.payload;
      if (sessionOnly) {
        return {
          ...state,
          nedSettings: {
            ...state.nedSettings,
            sessionPermissions: state.nedSettings.sessionPermissions.filter(p => p.toolName !== toolName),
          },
        };
      } else {
        return {
          ...state,
          nedSettings: {
            ...state.nedSettings,
            permissions: state.nedSettings.permissions.filter(p => p.toolName !== toolName),
          },
        };
      }
    }

    case 'CLEAR_SESSION_PERMISSIONS':
      return {
        ...state,
        nedSettings: {
          ...state.nedSettings,
          sessionPermissions: [],
        },
      };

    case 'LOAD_SETTINGS':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// Context
const SettingsContext = createContext<{
  state: SettingsState;
  dispatch: React.Dispatch<SettingsAction>;
} | null>(null);

// Provider
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(settingsReducer, defaultState);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load from storage on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const storage = await getStorage();
        const settings = await storage.load<any>('settings');

        if (settings) {
          dispatch({
            type: 'LOAD_SETTINGS',
            payload: {
              aiSettings: settings.aiSettings || defaultState.aiSettings,
              learningSettings: settings.learningSettings || defaultState.learningSettings,
              userProfile: settings.userProfile || defaultState.userProfile,
              learnings: settings.learnings || defaultState.learnings,
              nedSettings: settings.nedSettings || defaultState.nedSettings,
              sessionRecordingDefaults: settings.sessionRecordingDefaults || defaultState.sessionRecordingDefaults,
            },
          });
        }
        setHasLoaded(true);
      } catch (error) {
        console.error('Failed to load settings:', error);
        setHasLoaded(true);
      }
    }
    loadSettings();
  }, []);

  // Save to storage on change (debounced 5 seconds)
  useEffect(() => {
    if (!hasLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const storage = await getStorage();
        await storage.save('settings', {
          aiSettings: state.aiSettings,
          learningSettings: state.learningSettings,
          userProfile: state.userProfile,
          learnings: state.learnings,
          nedSettings: state.nedSettings,
          sessionRecordingDefaults: state.sessionRecordingDefaults,
        });
        console.log('Settings saved to storage');
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    }, 5000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasLoaded, state]);

  return (
    <SettingsContext.Provider value={{ state, dispatch }}>
      {children}
    </SettingsContext.Provider>
  );
}

// Hook
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

// ============================================================================
// Helper Hooks for Session Recording Defaults
// ============================================================================

/**
 * Hook for managing session recording defaults
 * Provides convenient methods for updating recording settings
 */
export function useSessionRecordingDefaults() {
  const { state, dispatch } = useSettings();

  const updateAudioRecordingDefaults = useCallback((updates: Partial<SessionRecordingDefaults['audioRecording']>) => {
    dispatch({
      type: 'UPDATE_SESSION_RECORDING_DEFAULTS',
      payload: {
        audioRecording: updates as SessionRecordingDefaults['audioRecording'],
      } as Partial<SessionRecordingDefaults>,
    });
  }, [dispatch]);

  const updateLastUsedDevices = useCallback((updates: Partial<SessionRecordingDefaults['lastUsedDevices']>) => {
    dispatch({
      type: 'UPDATE_SESSION_RECORDING_DEFAULTS',
      payload: {
        lastUsedDevices: updates,
      },
    });
  }, [dispatch]);

  const updateVideoDefaults = useCallback((updates: Partial<SessionRecordingDefaults['video']>) => {
    dispatch({
      type: 'UPDATE_SESSION_RECORDING_DEFAULTS',
      payload: {
        video: updates as SessionRecordingDefaults['video'],
      } as Partial<SessionRecordingDefaults>,
    });
  }, [dispatch]);

  const updatePipDefaults = useCallback((updates: Partial<SessionRecordingDefaults['pip']>) => {
    dispatch({
      type: 'UPDATE_SESSION_RECORDING_DEFAULTS',
      payload: {
        pip: updates as SessionRecordingDefaults['pip'],
      } as Partial<SessionRecordingDefaults>,
    });
  }, [dispatch]);

  return {
    sessionRecordingDefaults: state.sessionRecordingDefaults,
    updateAudioRecordingDefaults,
    updateLastUsedDevices,
    updateVideoDefaults,
    updatePipDefaults,
  };
}
