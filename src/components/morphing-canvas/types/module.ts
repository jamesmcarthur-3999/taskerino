/**
 * Module Type System for Morphing Canvas
 *
 * This file defines the core types and interfaces for individual modules
 * that can be placed within the Morphing Canvas layout system.
 */

import type { Task } from '../../../types';

/**
 * Enumeration of all available module types in the Morphing Canvas.
 * Each module type represents a distinct UI component with specific functionality.
 */
export type ModuleType =
  | 'task-action-item'
  | 'note-insight'
  | 'timeline'
  | 'screenshot-gallery'
  | 'decision-record'
  | 'quote-highlight'
  | 'metrics-dashboard'
  | 'progress-indicator'
  | 'code-changes'
  | 'idea-cluster'
  | 'meeting-attendee'
  | 'learning-path'
  | 'problem-solution'
  | 'file-resource-list'
  | 'video-chapter-navigator'
  | 'action-triage'
  | 'cross-session-links'
  | 'ai-insights'
  // Legacy module types for backward compatibility
  | 'media'
  | 'tasks'
  | 'notes'
  | 'calendar'
  | 'feed'
  | 'clock'
  | 'weather'
  | 'chart'
  | 'quick-actions'
  | 'ai-chat'
  | 'custom';

/** Module type values for runtime checks */
export const ModuleTypeValues: readonly ModuleType[] = [
  'task-action-item',
  'note-insight',
  'timeline',
  'screenshot-gallery',
  'decision-record',
  'quote-highlight',
  'metrics-dashboard',
  'progress-indicator',
  'code-changes',
  'idea-cluster',
  'meeting-attendee',
  'learning-path',
  'problem-solution',
  'file-resource-list',
  'video-chapter-navigator',
  'action-triage',
  'cross-session-links',
  'ai-insights',
  // Legacy module types
  'media',
  'tasks',
  'notes',
  'calendar',
  'feed',
  'clock',
  'weather',
  'chart',
  'quick-actions',
  'ai-chat',
  'custom',
] as const;

/**
 * Module variants define different visual and functional variations of each module type.
 * Each module type can have multiple variants to suit different use cases.
 */
export type ModuleVariant =
  // Task Action Item variants
  | 'task-checklist'
  | 'task-kanban'
  | 'task-priority-matrix'
  | 'task-timeline'
  | 'compact'
  | 'default'
  | 'expanded'
  // Note Insight variants
  | 'note-card'
  | 'note-document'
  | 'note-sticky'
  | 'note-markdown'
  // Timeline variants
  | 'timeline-vertical'
  | 'timeline-horizontal'
  | 'timeline-gantt'
  | 'timeline-calendar'
  | 'horizontal'
  | 'vertical'
  // Screenshot Gallery variants
  | 'gallery-grid'
  | 'gallery-carousel'
  | 'gallery-masonry'
  | 'gallery-lightbox'
  // Decision Record variants
  | 'decision-adr'
  | 'decision-table'
  | 'decision-tree'
  | 'decision-log'
  // Quote Highlight variants
  | 'quote-card'
  | 'quote-inline'
  | 'quote-callout'
  | 'quote-sidebar'
  // Metrics Dashboard variants
  | 'metrics-cards'
  | 'metrics-charts'
  | 'metrics-table'
  | 'metrics-sparklines'
  // Progress Indicator variants
  | 'progress-bar'
  | 'progress-circle'
  | 'progress-steps'
  | 'progress-milestone'
  // Code Changes variants
  | 'code-diff'
  | 'code-commit-list'
  | 'code-file-tree'
  | 'code-blame'
  // Idea Cluster variants
  | 'idea-mindmap'
  | 'idea-cards'
  | 'idea-tags'
  | 'idea-network'
  // Meeting Attendee variants
  | 'attendee-list'
  | 'attendee-grid'
  | 'attendee-carousel'
  | 'attendee-roster'
  // Learning Path variants
  | 'learning-roadmap'
  | 'learning-steps'
  | 'learning-tree'
  | 'learning-progress'
  // Problem Solution variants
  | 'problem-solution-card'
  | 'problem-solution-split'
  | 'problem-solution-accordion'
  | 'problem-solution-table'
  // File Resource List variants
  | 'file-list'
  | 'file-grid'
  | 'file-tree'
  | 'file-explorer'
  // Video Chapter Navigator variants
  | 'video-chapters-list'
  | 'video-chapters-timeline'
  | 'video-chapters-thumbnails'
  | 'video-chapters-accordion'
  // Action Triage variants
  | 'triage-queue'
  | 'triage-matrix'
  | 'triage-flow'
  | 'triage-prioritized'
  // Cross Session Links variants
  | 'links-graph'
  | 'links-list'
  | 'links-timeline'
  | 'links-cards'
  // AI Insights variants
  | 'ai-summary'
  | 'ai-suggestions'
  | 'ai-analysis'
  | 'ai-patterns'
  // Generic
  | 'kanban';

/**
 * Represents the current state of a module.
 * States control both visual appearance and user interaction possibilities.
 */
export type ModuleState =
  /** Module is currently loading data or initializing */
  | 'loading'
  /** Module has successfully loaded and is displaying content */
  | 'loaded'
  /** Module is minimized/collapsed to save space */
  | 'collapsed'
  /** Module is expanded to show full content */
  | 'expanded'
  /** Module has no data to display */
  | 'empty'
  /** Module encountered an error during loading or rendering */
  | 'error'
  /** Module is in interactive mode (e.g., editing, dragging) */
  | 'interactive'
  /** Module is temporarily disabled and cannot be interacted with */
  | 'disabled';

/** Module state values for runtime checks */
export const ModuleStateValues: readonly ModuleState[] = [
  'loading',
  'loaded',
  'collapsed',
  'expanded',
  'empty',
  'error',
  'interactive',
  'disabled',
] as const;

/**
 * Position configuration for a module within the grid layout.
 * Defines where and how the module should be placed in the canvas.
 */
export interface ModulePosition {
  /** The slot identifier this module is assigned to */
  slot: string;
  /** CSS Grid column placement (e.g., "1 / 3" or "span 2") */
  gridColumn: string;
  /** CSS Grid row placement (e.g., "1 / 2" or "auto") */
  gridRow: string;
  /** Order for flex/grid ordering (lower numbers appear first) */
  order: number;
  /** Z-index for layering when modules overlap */
  zIndex?: number;
}

/**
 * Theme configuration for a module's visual appearance.
 * Supports semantic color tokens for consistent theming.
 */
export interface ModuleTheme {
  /** Primary brand/accent color for the module */
  primary: string;
  /** Lighter variant of the primary color */
  primaryLight: string;
  /** Darker variant of the primary color */
  primaryDark: string;
  /** Semantic colors for different states and meanings */
  semantic: {
    /** Success state color (e.g., completed tasks) */
    success: string;
    /** Warning state color (e.g., pending items) */
    warning: string;
    /** Error state color (e.g., failed operations) */
    error: string;
    /** Info state color (e.g., helpful tips) */
    info: string;
    /** Neutral color for disabled or inactive items */
    neutral: string;
  };
  /** Background color for the module */
  background?: string;
  /** Text color for content */
  text?: string;
  /** Border color */
  border?: string;
  /** Shadow configuration */
  shadow?: string;
  /** Border radius for rounded corners */
  borderRadius?: string;
}

/**
 * Generic data structure for module content.
 * Each module type should extend this with their specific data requirements.
 */
export interface ModuleData {
  /** Unique identifier for this data instance */
  id: string;
  /** Timestamp when the data was created */
  createdAt: Date;
  /** Timestamp when the data was last updated */
  updatedAt: Date;
  /** User or system that created this data */
  createdBy?: string;
  /** Arbitrary metadata for extensibility */
  metadata?: Record<string, unknown>;
  /** The actual content data (structure varies by module type) */
  content: unknown;
}

/**
 * Interaction configuration for module user interactions.
 * Defines what actions users can perform on the module.
 */
export interface ModuleInteractions {
  /** Whether the module can be dragged to a new position */
  draggable?: boolean;
  /** Whether the module can be resized */
  resizable?: boolean;
  /** Whether the module can be collapsed/expanded */
  collapsible?: boolean;
  /** Whether the module can be removed from the canvas */
  removable?: boolean;
  /** Whether the module can be edited in place */
  editable?: boolean;
  /** Whether the module can be duplicated */
  duplicatable?: boolean;
  /** Whether the module supports keyboard navigation */
  keyboardNavigable?: boolean;
  /** Custom interaction handlers */
  customActions?: Array<{
    id: string;
    label: string;
    icon?: string;
    handler: string; // Function name or identifier
  }>;
}

/**
 * Configuration for nested modules (modules within modules).
 * Enables complex hierarchical layouts.
 */
export interface NestedModuleConfig {
  /** Whether this module can contain child modules */
  allowNested: boolean;
  /** Maximum nesting depth allowed */
  maxDepth?: number;
  /** Allowed module types for children */
  allowedChildTypes?: ModuleType[];
  /** Layout type for arranging child modules */
  childLayout?: 'grid' | 'flex' | 'stack' | 'masonry';
  /** Maximum number of child modules */
  maxChildren?: number;
}

/**
 * Defines relationships between modules for linked interactions.
 * Enables modules to react to changes in other modules.
 */
export interface LinkedModule {
  /** ID of the linked module */
  moduleId: string;
  /** Type of relationship */
  relationship: 'parent' | 'child' | 'sibling' | 'depends-on' | 'affects' | 'references';
  /** Whether changes in this module should trigger updates in the linked module */
  bidirectional?: boolean;
  /** Custom synchronization logic identifier */
  syncHandler?: string;
}

/**
 * Conditional rendering configuration for modules.
 * Determines when a module should be visible or active.
 */
export interface ModuleCondition {
  /** Field to evaluate for the condition */
  field: string;
  /** Comparison operator */
  operator: 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than' | 'exists' | 'not-exists';
  /** Value to compare against */
  value?: unknown;
  /** Combine multiple conditions with AND/OR */
  logicalOperator?: 'AND' | 'OR';
  /** Additional conditions to evaluate */
  conditions?: ModuleCondition[];
}

/**
 * Size configuration for a module.
 * Defines dimensions and constraints for module sizing.
 */
export interface ModuleSize {
  /** Width in CSS units (px, %, rem, etc.) */
  width?: string;
  /** Height in CSS units */
  height?: string;
  /** Minimum width */
  minWidth?: string;
  /** Maximum width */
  maxWidth?: string;
  /** Minimum height */
  minHeight?: string;
  /** Maximum height */
  maxHeight?: string;
  /** Aspect ratio to maintain (e.g., "16/9") */
  aspectRatio?: string;
  /** Whether the module should grow to fill available space */
  flexGrow?: number;
  /** Whether the module should shrink when space is limited */
  flexShrink?: number;
}

/**
 * Complete configuration for a module instance in the Morphing Canvas.
 * This is the primary interface for defining a module's properties and behavior.
 */
export interface ModuleConfig {
  /** Unique identifier for this module instance */
  id: string;
  /** Type of module (determines rendering component) */
  type: ModuleType;
  /** Visual/functional variant of the module */
  variant: ModuleVariant;
  /** Current state of the module */
  state?: ModuleState;
  /** Position configuration within the layout */
  position: ModulePosition;
  /** Size configuration for the module */
  size: ModuleSize;
  /** Theme configuration for visual appearance */
  theme: ModuleTheme;
  /** Module-specific configuration options */
  config: Record<string, unknown>;
  /** Data to be displayed by the module */
  data?: ModuleData;
  /** Interaction capabilities and handlers */
  interactions: ModuleInteractions;
  /** Nested module configuration */
  nested?: NestedModuleConfig;
  /** Linked modules for cross-module interactions */
  linkedModules?: LinkedModule[];
  /** Conditions for showing/hiding the module */
  condition?: ModuleCondition;
  /** Custom CSS class names for styling */
  className?: string;
  /** Inline styles (use sparingly, prefer theme) */
  style?: Record<string, string>;
  /** ARIA label for accessibility */
  ariaLabel?: string;
  /** Whether the module is currently visible */
  visible?: boolean;
  /** Animation configuration for module transitions */
  animation?: {
    /** Animation type */
    type: 'fade' | 'slide' | 'scale' | 'none';
    /** Duration in milliseconds */
    duration: number;
    /** Easing function */
    easing: string;
    /** Delay before animation starts */
    delay?: number;
  };
  /** Custom data attributes for testing or tracking */
  dataAttributes?: Record<string, string>;

  // Legacy/backward compatibility properties
  showDuration?: boolean;
  showFocusPeriods?: boolean;
  enableScrubbing?: boolean;
  enableInteraction?: boolean;
  animationDuration?: number;
}

/**
 * Type guard to check if a value is a valid ModuleType
 */
export function isModuleType(value: unknown): value is ModuleType {
  return ModuleTypeValues.includes(value as ModuleType);
}

/**
 * Type guard to check if a value is a valid ModuleState
 */
export function isModuleState(value: unknown): value is ModuleState {
  return ModuleStateValues.includes(value as ModuleState);
}

/**
 * Helper type for creating partial module configurations
 * Useful for updates and defaults
 */
export type PartialModuleConfig = Partial<ModuleConfig> & Pick<ModuleConfig, 'id' | 'type'>;

/**
 * Helper type for module configuration without computed/runtime properties
 * Useful for serialization and storage
 */
export type SerializableModuleConfig = Omit<ModuleConfig, 'data'> & {
  data?: Omit<ModuleData, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
  };
};

// ============================================================================
// TASK MODULE TYPES
// ============================================================================

/**
 * Task module variant types
 * Defines the different visual presentations available for the task module
 */
export type TaskVariant = 'compact' | 'default' | 'expanded' | 'kanban';

/**
 * Task action types for callbacks
 * Defines the possible user interactions with tasks
 */
export type TaskAction =
  | 'toggle-complete'
  | 'edit'
  | 'delete'
  | 'view-details'
  | 'change-priority'
  | 'change-status';

/**
 * Task module configuration
 * Extends base config with task-specific options
 */
export interface TaskModuleConfig extends ModuleConfig {
  sortBy?: 'priority' | 'dueDate' | 'createdAt' | 'status';
  groupBy?: 'none' | 'priority' | 'status' | 'topic';
  showCompleted?: boolean;
  enableInlineEdit?: boolean;
  compactSpacing?: boolean;
}

/**
 * Task module data structure
 * Wrapper for task data passed to the module
 */
export interface TaskModuleData {
  tasks: Task[];
}

/**
 * Task module props
 * Complete interface for the TaskModule component
 */
export interface TaskModuleProps {
  data: TaskModuleData;
  variant: TaskVariant;
  config?: TaskModuleConfig;
  onAction?: (action: TaskAction, task: Task) => void;
  isLoading?: boolean;
  error?: string | null;
}

// ============================================================================
// TIMELINE MODULE TYPES
// ============================================================================

/**
 * Timeline event types
 */
export type TimelineEventType =
  | 'task_created'
  | 'task_completed'
  | 'decision_made'
  | 'screenshot_taken'
  | 'note_added'
  | 'break_started'
  | 'break_ended'
  | 'focus_started'
  | 'focus_ended'
  | 'milestone_reached'
  | 'context_switch'
  | 'meeting_started'
  | 'meeting_ended';

/**
 * Timeline Event
 */
export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  linkedItemId?: string;
  linkedItemType?: 'task' | 'note' | 'session';
  duration?: number; // in milliseconds
  color?: string;
  icon?: string;
}

/**
 * Focus Period
 */
export interface FocusPeriod {
  id: string;
  startTime: string;
  endTime: string;
  type: 'focus' | 'break' | 'meeting' | 'context_switch';
  intensity?: number; // 0-100
  label?: string;
  color?: string;
}

/**
 * Timeline Data
 */
export interface TimelineData {
  sessionStart: string;
  sessionEnd: string;
  events: TimelineEvent[];
  focusPeriods?: FocusPeriod[];
  currentTime?: string; // For active sessions
}

/**
 * Timeline Module Props
 */
export interface TimelineModuleProps {
  data: TimelineData;
  variant?: 'horizontal' | 'vertical' | 'compact';
  config?: ModuleConfig;
  onEventClick?: (event: TimelineEvent) => void;
  onTimeSeek?: (timestamp: string) => void;
  className?: string;
}

/**
 * Event Icon Mapping
 */
export const EVENT_TYPE_CONFIG: Record<TimelineEventType, { icon: string; color: string; label: string }> = {
  task_created: {
    icon: 'CheckSquare',
    color: '#3b82f6', // blue-500
    label: 'Task Created'
  },
  task_completed: {
    icon: 'CheckCircle2',
    color: '#22c55e', // green-500
    label: 'Task Completed'
  },
  decision_made: {
    icon: 'Lightbulb',
    color: '#f59e0b', // amber-500
    label: 'Decision Made'
  },
  screenshot_taken: {
    icon: 'Camera',
    color: '#8b5cf6', // violet-500
    label: 'Screenshot'
  },
  note_added: {
    icon: 'FileText',
    color: '#06b6d4', // cyan-500
    label: 'Note Added'
  },
  break_started: {
    icon: 'Coffee',
    color: '#f97316', // orange-500
    label: 'Break Started'
  },
  break_ended: {
    icon: 'Play',
    color: '#10b981', // emerald-500
    label: 'Break Ended'
  },
  focus_started: {
    icon: 'Target',
    color: '#ec4899', // pink-500
    label: 'Focus Started'
  },
  focus_ended: {
    icon: 'Pause',
    color: '#6366f1', // indigo-500
    label: 'Focus Ended'
  },
  milestone_reached: {
    icon: 'Flag',
    color: '#ef4444', // red-500
    label: 'Milestone'
  },
  context_switch: {
    icon: 'ArrowRightLeft',
    color: '#64748b', // slate-500
    label: 'Context Switch'
  },
  meeting_started: {
    icon: 'Users',
    color: '#0ea5e9', // sky-500
    label: 'Meeting Started'
  },
  meeting_ended: {
    icon: 'UserX',
    color: '#71717a', // zinc-500
    label: 'Meeting Ended'
  }
};
