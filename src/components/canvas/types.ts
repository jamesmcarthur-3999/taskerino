/**
 * Canvas Component System - Type Definitions
 *
 * Defines the type system for AI-composable UI components.
 * AI generates JSON conforming to these types, which ComponentRenderer
 * interprets and renders as React components.
 */

import type { ReactNode } from 'react';
import type { SourceCitation } from '../../types';

// ============================================================================
// CORE TYPES
// ============================================================================

export type ComponentType =
  // Layout
  | 'Stack' | 'Grid' | 'Card' | 'Tabs' | 'Accordion'
  // Typography
  | 'Heading' | 'Text' | 'Badge' | 'Separator'
  // Data Display
  | 'List' | 'Timeline' | 'Table' | 'StatCard'
  | 'Chart' | 'ProgressBar' | 'ImageGallery' | 'KeyValue'
  // Interactive
  | 'Button' | 'ActionToolbar' | 'ToggleGroup'
  // Action Components (New)
  | 'ActionCard' | 'ActionGroup' | 'RelatedItemsPanel' | 'ActionReviewDashboard';

export type ThemeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
export type SpacingSize = 'tight' | 'normal' | 'relaxed' | 'loose';
export type ElevationVariant = 'flat' | 'lifted' | 'floating' | 'elevated';
export type EmphasisLevel = 'subtle' | 'normal' | 'strong' | 'hero';

/**
 * Component Tree - Recursive structure for nested components
 */
export interface ComponentTree {
  component: ComponentType;
  props: Record<string, any>;
  children?: ComponentTree[];
  style?: ComponentStyle;
}

/**
 * Style configuration for any component
 */
export interface ComponentStyle {
  spacing?: SpacingSize;
  emphasis?: EmphasisLevel;
  theme?: ThemeVariant;
}

/**
 * Action definition - what happens when user clicks something
 *
 * Enhanced with structured data for different action types.
 * Each action type has its own specific data structure for type safety.
 */
export interface Action {
  type:
    | 'create_task'
    | 'update_task'
    | 'create_note'
    | 'update_note'
    | 'link_to_task'
    | 'link_to_note'
    | 'batch_create'
    | 'export'
    | 'share'
    | 'expand'
    | 'custom';

  label: string;
  icon?: string;

  // Structured data (use ONE of these based on type)

  /** Data for creating a new task */
  createTask?: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    tags?: string[];
    topicId?: string;
    dueDate?: string;
    estimatedDuration?: number; // minutes
    sourceSessionId: string;
    relatedScreenshotIds?: string[];
  };

  /** Data for updating an existing task */
  updateTask?: {
    taskId: string;
    existingTitle: string; // For display purposes
    updates: {
      status?: 'todo' | 'in-progress' | 'done' | 'blocked';
      description?: string; // Append to existing description
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      notes?: string; // Additional notes to append
      completedAt?: string;
    };
    reasoning: string; // Why this update is suggested
  };

  /** Data for creating a new note */
  createNote?: {
    title: string;
    content: string; // Rich HTML or markdown
    tags?: string[];
    topicIds?: string[];
    companyIds?: string[];
    contactIds?: string[];
    sourceSessionId: string;
    relatedScreenshotIds?: string[];
  };

  /** Data for updating an existing note */
  updateNote?: {
    noteId: string;
    existingTitle: string; // For display purposes
    updates: {
      content?: string; // Append to existing content
      tags?: string[]; // Additional tags to add
    };
    reasoning: string; // Why this update is suggested
  };

  /** Data for linking to existing task */
  linkToTask?: {
    taskId: string;
    title: string;
    relevance: string; // Why it's relevant to this session
    status?: 'todo' | 'in-progress' | 'done' | 'blocked';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  };

  /** Data for linking to existing note */
  linkToNote?: {
    noteId: string;
    title: string;
    relevance: string; // Why it's relevant to this session
    tags?: string[];
  };

  /** Data for batch operations */
  batch?: {
    actions: Action[];
    groupReasoning?: string; // Why these actions are grouped
  };

  // Legacy support for generic data
  data?: Record<string, any>;

  // Metadata
  metadata?: {
    reasoning?: string; // Why AI suggests this action
    confidence?: number; // 0-1 confidence score
    relatedScreenshotIds?: string[];
    timestamp?: string;
  };
}

// ============================================================================
// LAYOUT COMPONENT PROPS
// ============================================================================

export interface StackProps {
  direction: 'vertical' | 'horizontal';
  spacing?: SpacingSize;
  align?: 'start' | 'center' | 'end' | 'stretch';
  wrap?: boolean;
  children?: ReactNode;
}

export interface GridProps {
  columns: 1 | 2 | 3 | 4 | 6 | 'auto';
  gap?: SpacingSize;
  responsive?: boolean;
  children?: ReactNode;
}

export interface CardProps {
  variant?: ElevationVariant;
  padding?: SpacingSize;
  theme?: ThemeVariant;
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export interface TabsProps {
  tabs: Array<{
    id: string;
    label: string;
    icon?: string;
    badge?: string | number;
  }>;
  defaultTab?: string;
  orientation?: 'horizontal' | 'vertical';
  children?: ReactNode; // Content for each tab comes from children array (matched by index)
}

export interface AccordionProps {
  items: Array<{
    id: string;
    title: string;
    icon?: string;
    badge?: string | number;
    defaultExpanded?: boolean;
    citations?: SourceCitation[]; // Source references for this accordion section
  }>;
  allowMultiple?: boolean;
  children?: ReactNode; // Content for each item comes from children array (matched by index)
}

// ============================================================================
// TYPOGRAPHY COMPONENT PROPS
// ============================================================================

export interface HeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  icon?: string;
  badge?: string | number;
  emphasis?: EmphasisLevel;
  gradient?: boolean;
}

export interface TextProps {
  content: string;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'default' | 'muted' | 'emphasis' | 'success' | 'warning' | 'danger';
  align?: 'left' | 'center' | 'right';
  markdown?: boolean;
  citations?: SourceCitation[]; // Source references for this text
}

export interface BadgeProps {
  text: string;
  variant?: ThemeVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  pulse?: boolean;
}

export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  thickness?: 'thin' | 'normal' | 'thick';
  spacing?: SpacingSize;
  label?: string;
}

// ============================================================================
// DATA DISPLAY COMPONENT PROPS
// ============================================================================

export interface ListItem {
  id: string;
  content: string;
  icon?: string;
  badge?: string;
  subItems?: string[];
  metadata?: string;
  citations?: SourceCitation[]; // Source references for this item
}

export interface ListProps {
  items: ListItem[];
  variant?: 'bulleted' | 'numbered' | 'checkmark' | 'custom';
  spacing?: SpacingSize;
  theme?: ThemeVariant;
}

export interface TimelineItem {
  id: string;
  timestamp: string | number;
  title: string;
  description?: string;
  icon?: string;
  theme?: ThemeVariant;
  screenshotIds?: string[]; // Legacy: kept for backwards compatibility
  metadata?: Record<string, any>;
  citations?: SourceCitation[]; // Source references for this event
}

export interface TimelineProps {
  items: TimelineItem[];
  orientation?: 'vertical' | 'horizontal';
  showTimestamps?: boolean;
  interactive?: boolean;
}

export interface TableColumn {
  id: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

export interface TableRow {
  id: string;
  cells: Record<string, any>;
  theme?: ThemeVariant;
  actions?: Action[];
}

export interface TableProps {
  columns: TableColumn[];
  rows: TableRow[];
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
}

/**
 * Standard Stat Types - Predefined stat categories for consistent reporting
 * Maps to specific visual themes and icons for AI-generated stats
 */
export type StandardStatType =
  // Time & Activity
  | 'duration'           // Total session duration (blue/clock icon)
  | 'screenshots'        // Screenshot count (purple/camera icon)
  | 'activities'         // Activity count (teal/activity icon)
  | 'context_switches'   // Context switch count (orange/shuffle icon)

  // Achievements & Issues
  | 'achievements'       // Achievement count (green/checkmark icon)
  | 'blockers'           // Blocker count (red/alert icon)
  | 'tasks_created'      // Tasks created (blue/checkbox icon)
  | 'notes_created'      // Notes created (cyan/note icon)

  // Scores & Metrics
  | 'focus_score'        // Focus quality 0-100 (purple/target icon)
  | 'productivity_score' // Productivity 0-100 (green/trending-up icon)
  | 'energy_level'       // Energy level 0-100 (yellow/zap icon)
  | 'learning_score';    // Learning depth 0-100 (blue/book icon)

/**
 * Standard Stat Metadata - For aggregation and reporting
 */
export interface StandardStatMetadata {
  type: StandardStatType;
  sessionId: string;
  timestamp: string;
  rawValue: number | string;
}

export interface StatCardProps {
  value: string | number;
  label: string;
  icon?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
    label: string;
  };
  theme?: ThemeVariant;
  action?: Action;
  statType?: StandardStatType;  // Optional: For standard stat tracking
  metadata?: StandardStatMetadata; // Optional: For reporting/aggregation
}

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
}

export interface ChartProps {
  type: 'line' | 'bar' | 'area' | 'pie' | 'donut';
  data: {
    labels: string[];
    datasets: ChartDataset[];
  };
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  tooltip?: boolean;
}

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'linear' | 'circular';
  theme?: ThemeVariant;
  striped?: boolean;
  animated?: boolean;
}

export interface GalleryImage {
  id: string;
  url: string;
  thumbnail?: string;
  caption?: string;
  timestamp?: string;
}

export interface ImageGalleryProps {
  images: GalleryImage[];
  layout?: 'grid' | 'masonry' | 'carousel';
  columns?: 2 | 3 | 4;
  showCaptions?: boolean;
  clickable?: boolean;
}

export interface KeyValueItem {
  key: string;
  value: string | number | ReactNode;
  icon?: string;
  copyable?: boolean;
}

export interface KeyValueProps {
  items: KeyValueItem[];
  layout?: 'stacked' | 'horizontal';
  spacing?: SpacingSize;
}

// ============================================================================
// INTERACTIVE COMPONENT PROPS
// ============================================================================

export interface ButtonProps {
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  action: Action;
}

export interface ActionToolbarProps {
  actions: Action[];
  layout?: 'horizontal' | 'vertical';
  spacing?: SpacingSize;
  sticky?: boolean;
}

export interface ToggleOption {
  id: string;
  label: string;
  icon?: string;
}

export interface ToggleGroupProps {
  options: ToggleOption[];
  selected: string;
  onChange: (id: string) => void;
  variant?: 'pills' | 'buttons';
}

// ============================================================================
// ACTION COMPONENT PROPS (New - for actionable summaries)
// ============================================================================

/**
 * ActionCard - Rich preview card for a single action
 *
 * Displays full action details with inline editing capabilities.
 * User can modify fields before executing the action.
 */
export interface ActionCardProps {
  /** The action to display and execute */
  action: Action;

  /** Whether the card starts expanded (showing all details) */
  expanded?: boolean;

  /** Whether fields are editable before execution */
  editable?: boolean;

  /** Optional callback after successful execution */
  onComplete?: () => void;

  /** Optional callback on cancel/dismiss */
  onCancel?: () => void;

  /** Visual theme */
  theme?: ThemeVariant;
}

/**
 * ActionGroup - Grouped related actions
 *
 * Displays multiple related actions with option for batch execution.
 * Good for grouping follow-up tasks, related updates, etc.
 */
export interface ActionGroupProps {
  /** Group title */
  title: string;

  /** Optional description of why these actions are grouped */
  description?: string;

  /** Actions in this group */
  actions: Action[];

  /** Whether to show "Execute All" button */
  allowBatch?: boolean;

  /** Whether group starts collapsed */
  defaultCollapsed?: boolean;

  /** Visual theme for the group container */
  theme?: ThemeVariant;

  /** Optional callback after all actions complete */
  onAllComplete?: () => void;
}

/**
 * RelatedItem - An existing task or note from the system
 */
export interface RelatedItem {
  /** Item type */
  type: 'task' | 'note';

  /** Item ID */
  id: string;

  /** Item title/name */
  title: string;

  /** AI explanation of relevance to this session */
  relevance: string;

  /** Current status (for tasks) */
  status?: 'todo' | 'in-progress' | 'done' | 'blocked';

  /** Priority (for tasks) */
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  /** Tags */
  tags?: string[];

  /** Creation date */
  createdAt?: string;

  /** Last modified date */
  lastModified?: string;

  /** Optional suggested update action */
  suggestedUpdate?: Action;

  /** Screenshots that reference this item */
  relatedScreenshotIds?: string[];
}

/**
 * RelatedItemsPanel - Shows existing tasks/notes with suggested updates
 *
 * Displays items already in the system that relate to this session.
 * Can suggest updates to these items based on session content.
 */
export interface RelatedItemsPanelProps {
  /** Related items to display */
  items: RelatedItem[];

  /** Panel title */
  title?: string;

  /** Whether to show items with no suggested updates */
  showItemsWithoutUpdates?: boolean;

  /** Maximum items to show before "Show More" */
  maxItems?: number;

  /** Visual theme */
  theme?: ThemeVariant;
}

/**
 * ActionReviewDashboard - Bulk action management interface
 *
 * Aggregates all actions from the canvas for review and bulk operations.
 * Shows summary stats and allows selective execution.
 */
export interface ActionReviewDashboardProps {
  /** Whether to auto-collect all actions from the canvas */
  collectAllActions?: boolean;

  /** Manually provided actions (if not auto-collecting) */
  actions?: Action[];

  /** Whether to show summary statistics */
  showStats?: boolean;

  /** Whether to allow bulk operations */
  allowBulk?: boolean;

  /** Title for the dashboard */
  title?: string;

  /** Visual theme */
  theme?: ThemeVariant;

  /** Callback after bulk operations complete */
  onBulkComplete?: () => void;
}
