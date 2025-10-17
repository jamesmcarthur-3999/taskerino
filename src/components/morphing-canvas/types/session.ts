/**
 * Session Type System for Morphing Canvas
 *
 * This file defines session-related types including session metadata,
 * session types, and session state management.
 */

/**
 * Session types that determine the context and purpose of a work session.
 * Each session type influences the default layout and module configurations.
 */
export type SessionType =
  /** Active coding or development session */
  | 'coding'
  /** Brainstorming and ideation session */
  | 'brainstorming'
  /** Meeting or collaborative session */
  | 'meeting'
  /** Learning or educational session */
  | 'learning'
  /** Debugging or troubleshooting session */
  | 'debugging'
  /** Quick task or administrative session */
  | 'quick_task'
  /** Planning or design session */
  | 'planning'
  /** Review or code review session */
  | 'review'
  /** Research or exploration session */
  | 'research'
  /** Documentation writing session */
  | 'documentation'
  /** Testing or QA session */
  | 'testing'
  /** General or mixed purpose session */
  | 'general';

/** Session type values for runtime checks */
export const SessionTypeValues: readonly SessionType[] = [
  'coding',
  'brainstorming',
  'meeting',
  'learning',
  'debugging',
  'quick_task',
  'planning',
  'review',
  'research',
  'documentation',
  'testing',
  'general',
] as const;

/**
 * Session metadata containing identifying information and context.
 * This interface captures all essential information about a work session.
 */
export interface SessionMetadata {
  /** Unique identifier for the session */
  id: string;
  /** Human-readable title for the session */
  title: string;
  /** Type of session determining layout and behavior */
  type: SessionType;
  /** Optional description of the session purpose */
  description?: string;
  /** Timestamp when the session started */
  startTime: Date;
  /** Timestamp when the session ended (undefined for active sessions) */
  endTime?: Date;
  /** Tags for categorizing and searching sessions */
  tags: string[];
  /** Project or workspace this session belongs to */
  projectId?: string;
  /** User who owns this session */
  userId?: string;
  /** Team or group this session is shared with */
  teamId?: string;
  /** Whether this session is currently active */
  isActive?: boolean;
  /** Last time the session was updated */
  lastUpdated?: Date;
  /** Duration of the session in milliseconds */
  duration?: number;
  /** Session goals or objectives */
  goals?: string[];
  /** Participants in the session (for collaborative sessions) */
  participants?: SessionParticipant[];
  /** Custom metadata fields */
  customFields?: Record<string, unknown>;
}

/**
 * Information about a participant in a collaborative session.
 */
export interface SessionParticipant {
  /** Unique identifier for the participant */
  id: string;
  /** Display name */
  name: string;
  /** Email address */
  email?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Role in the session */
  role?: 'owner' | 'editor' | 'viewer';
  /** When the participant joined */
  joinedAt: Date;
  /** Whether the participant is currently active */
  isActive: boolean;
  /** Last activity timestamp */
  lastActivity?: Date;
}

/**
 * Session state information for tracking progress and status.
 */
export interface SessionState {
  /** Current phase or stage of the session */
  phase?: 'planning' | 'executing' | 'reviewing' | 'concluding';
  /** Progress percentage (0-100) */
  progress?: number;
  /** Current focus area or task */
  currentFocus?: string;
  /** Whether the session is paused */
  isPaused: boolean;
  /** Break periods during the session */
  breaks?: BreakPeriod[];
  /** Focus periods during the session */
  focusPeriods?: FocusMetric[];
  /** Session interruptions */
  interruptions?: Interruption[];
  /** Context switches during the session */
  contextSwitches?: ContextSwitch[];
}

/**
 * Represents a break period during a session.
 */
export interface BreakPeriod {
  /** Unique identifier for the break */
  id: string;
  /** When the break started */
  startTime: Date;
  /** When the break ended */
  endTime?: Date;
  /** Duration in milliseconds */
  duration?: number;
  /** Type of break */
  type: 'short' | 'long' | 'lunch' | 'meeting' | 'other';
  /** Optional notes about the break */
  notes?: string;
}

/**
 * Metrics for a focus period during a session.
 */
export interface FocusMetric {
  /** Unique identifier for the focus period */
  id: string;
  /** When focus started */
  startTime: Date;
  /** When focus ended */
  endTime?: Date;
  /** Duration in milliseconds */
  duration?: number;
  /** Focus intensity (0-100) */
  intensity?: number;
  /** What was focused on */
  subject?: string;
  /** Quality rating (0-5) */
  quality?: number;
}

/**
 * Represents an interruption during a session.
 */
export interface Interruption {
  /** Unique identifier for the interruption */
  id: string;
  /** When the interruption occurred */
  timestamp: Date;
  /** Type of interruption */
  type: 'notification' | 'meeting' | 'call' | 'message' | 'other';
  /** Duration of the interruption in milliseconds */
  duration?: number;
  /** Source of the interruption */
  source?: string;
  /** Whether it was expected */
  expected: boolean;
}

/**
 * Represents a context switch during a session.
 */
export interface ContextSwitch {
  /** Unique identifier for the context switch */
  id: string;
  /** When the switch occurred */
  timestamp: Date;
  /** What was switched from */
  from: string;
  /** What was switched to */
  to: string;
  /** Reason for the switch */
  reason?: string;
  /** Whether it was planned */
  planned: boolean;
}

/**
 * Session summary data for analytics and reporting.
 * Renamed to avoid conflicts with main app SessionSummary type.
 */
export interface MorphingCanvasSessionSummary {
  /** Session metadata */
  metadata: SessionMetadata;
  /** Total duration in milliseconds */
  totalDuration: number;
  /** Active work time (excluding breaks) */
  activeTime: number;
  /** Break time */
  breakTime: number;
  /** Number of tasks completed */
  tasksCompleted: number;
  /** Number of tasks created */
  tasksCreated: number;
  /** Number of notes created */
  notesCreated: number;
  /** Number of decisions made */
  decisionsMade: number;
  /** Number of context switches */
  contextSwitchCount: number;
  /** Number of interruptions */
  interruptionCount: number;
  /** Average focus intensity (0-100) */
  averageFocusIntensity?: number;
  /** Productivity score (0-100) */
  productivityScore?: number;
  /** Key achievements during the session */
  achievements?: string[];
  /** Issues or blockers encountered */
  blockers?: string[];
}

/**
 * Session preferences for customizing the session experience.
 */
export interface SessionPreferences {
  /** Whether to auto-save session state */
  autoSave: boolean;
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;
  /** Whether to track time automatically */
  autoTrackTime: boolean;
  /** Whether to enable focus mode */
  enableFocusMode: boolean;
  /** Focus mode settings */
  focusModeSettings?: {
    /** Hide distractions */
    hideDistractions: boolean;
    /** Mute notifications */
    muteNotifications: boolean;
    /** Enable break reminders */
    breakReminders: boolean;
    /** Break reminder interval in minutes */
    breakReminderInterval?: number;
  };
  /** Default session type for new sessions */
  defaultSessionType?: SessionType;
  /** Whether to sync across devices */
  syncAcrossDevices: boolean;
  /** Theme preference for the session */
  themePreference?: 'light' | 'dark' | 'auto';
  /** Layout preference */
  layoutPreference?: string;
}

/**
 * Session analytics data for tracking and improving productivity.
 */
export interface SessionAnalytics {
  /** Session ID */
  sessionId: string;
  /** Time-series data points */
  timeSeries: TimeSeriesDataPoint[];
  /** Activity breakdown by type */
  activityBreakdown: Record<string, number>;
  /** Focus score over time */
  focusScoreHistory: number[];
  /** Comparison with previous sessions */
  comparison?: {
    /** Previous session ID */
    previousSessionId: string;
    /** Percentage change in duration */
    durationChange: number;
    /** Percentage change in productivity */
    productivityChange: number;
    /** Percentage change in focus */
    focusChange: number;
  };
  /** Insights and recommendations */
  insights?: SessionInsight[];
}

/**
 * A single data point in time-series session data.
 */
export interface TimeSeriesDataPoint {
  /** Timestamp for this data point */
  timestamp: Date;
  /** Activity level (0-100) */
  activityLevel: number;
  /** Focus level (0-100) */
  focusLevel: number;
  /** Type of activity */
  activityType?: string;
  /** Custom metrics */
  metrics?: Record<string, number>;
}

/**
 * AI-generated insight about a session.
 */
export interface SessionInsight {
  /** Unique identifier for the insight */
  id: string;
  /** Type of insight */
  type: 'tip' | 'warning' | 'achievement' | 'suggestion' | 'pattern';
  /** Insight title */
  title: string;
  /** Detailed description */
  description: string;
  /** Severity or importance (1-5) */
  importance: number;
  /** Whether the insight is actionable */
  actionable: boolean;
  /** Suggested action if actionable */
  suggestedAction?: string;
  /** Related data or metrics */
  relatedData?: Record<string, unknown>;
}

/**
 * Configuration for session recording and replay.
 */
export interface SessionRecording {
  /** Whether recording is enabled */
  enabled: boolean;
  /** What to record */
  recordingSettings: {
    /** Record module interactions */
    interactions: boolean;
    /** Record state changes */
    stateChanges: boolean;
    /** Record screenshots */
    screenshots: boolean;
    /** Screenshot interval in milliseconds */
    screenshotInterval?: number;
    /** Record audio */
    audio: boolean;
    /** Record video */
    video: boolean;
  };
  /** Storage settings */
  storage: {
    /** Where to store recordings */
    location: 'local' | 'cloud' | 'hybrid';
    /** Maximum storage size in MB */
    maxSize?: number;
    /** Retention period in days */
    retentionDays?: number;
  };
}

/**
 * Type guard to check if a value is a valid SessionType
 */
export function isSessionType(value: unknown): value is SessionType {
  return SessionTypeValues.includes(value as SessionType);
}

/**
 * Helper function to calculate session duration
 */
export function calculateSessionDuration(metadata: SessionMetadata): number {
  if (!metadata.endTime) {
    return Date.now() - metadata.startTime.getTime();
  }
  return metadata.endTime.getTime() - metadata.startTime.getTime();
}

/**
 * Helper function to check if a session is active
 */
export function isSessionActive(metadata: SessionMetadata): boolean {
  return metadata.isActive === true && !metadata.endTime;
}

/**
 * Helper function to format session duration
 */
export function formatSessionDuration(durationMs: number): string {
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Default session preferences
 */
export const DEFAULT_SESSION_PREFERENCES: SessionPreferences = {
  autoSave: true,
  autoSaveInterval: 60000, // 1 minute
  autoTrackTime: true,
  enableFocusMode: false,
  focusModeSettings: {
    hideDistractions: true,
    muteNotifications: true,
    breakReminders: true,
    breakReminderInterval: 25, // Pomodoro style
  },
  syncAcrossDevices: true,
  themePreference: 'auto',
};
