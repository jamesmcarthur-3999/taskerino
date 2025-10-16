import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
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

interface SettingsState {
  aiSettings: AISettings;
  learningSettings: LearningSettings;
  userProfile: UserProfile;
  learnings: UserLearnings;
  nedSettings: NedSettings;
}

type SettingsAction =
  | { type: 'UPDATE_AI_SETTINGS'; payload: Partial<AISettings> }
  | { type: 'UPDATE_LEARNING_SETTINGS'; payload: Partial<LearningSettings> }
  | { type: 'UPDATE_USER_PROFILE'; payload: Partial<UserProfile> }
  | { type: 'UPDATE_NED_SETTINGS'; payload: Partial<NedSettings> }
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
