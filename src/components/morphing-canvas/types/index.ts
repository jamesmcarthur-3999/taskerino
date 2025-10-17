/**
 * Type definitions for the Morphing Canvas system
 *
 * This file contains all the core types for the morphing canvas container,
 * modules, layouts, themes, and animations.
 */

import type { ComponentType, ReactNode } from 'react';
import type { Variants } from 'framer-motion';

// ============================================================================
// RE-EXPORTS FROM MODULE.TS AND SESSION.TS
// ============================================================================

// Export all new module types
export type {
  ModuleType,
  ModuleVariant,
  ModulePosition,
  ModuleTheme,
  ModuleData,
  ModuleInteractions,
  NestedModuleConfig,
  LinkedModule,
  ModuleCondition,
  ModuleSize,
  TaskVariant,
  TaskAction,
  TaskModuleConfig,
  TaskModuleData,
  TaskModuleProps,
  TimelineEventType,
  TimelineEvent,
  FocusPeriod as TimelineFocusPeriod,
  TimelineData,
  TimelineModuleProps,
  PartialModuleConfig,
  SerializableModuleConfig,
} from './module';

export {
  ModuleTypeValues,
  ModuleStateValues,
  isModuleType,
  isModuleState,
  EVENT_TYPE_CONFIG,
} from './module';

// Export all session types
export type {
  SessionType,
  SessionMetadata,
  SessionParticipant,
  SessionState,
  BreakPeriod,
  FocusMetric,
  Interruption,
  ContextSwitch,
  MorphingCanvasSessionSummary,
  SessionPreferences,
  SessionAnalytics,
  TimeSeriesDataPoint,
  SessionInsight,
  SessionRecording,
} from './session';

export {
  SessionTypeValues,
  isSessionType,
  calculateSessionDuration,
  isSessionActive,
  formatSessionDuration,
  DEFAULT_SESSION_PREFERENCES,
} from './session';

// ============================================================================
// LAYOUT SYSTEM
// ============================================================================

/**
 * Grid breakpoints for responsive layouts
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

/**
 * CSS Grid slot definition for module placement
 */
export interface GridSlot {
  column: string; // e.g., "1 / 7" or "span 6"
  row: string; // e.g., "1 / 3" or "span 2"
}

/**
 * Responsive grid slots for different breakpoints
 */
export interface ResponsiveGridSlot {
  mobile?: GridSlot;
  tablet?: GridSlot;
  desktop: GridSlot;
  wide?: GridSlot;
}

/**
 * Layout template defining module placement
 */
export interface LayoutTemplate {
  id: string;
  name: string;
  description?: string;
  slots: Record<string, ResponsiveGridSlot>;
  gridConfig: {
    columns: number; // typically 12
    gap: string; // e.g., "1rem"
    minHeight?: string;
  };
}

// ============================================================================
// THEME SYSTEM
// ============================================================================

/**
 * Theme mode
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Color palette definition
 */
export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  warning: string;
  success: string;
  info: string;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  mode: ThemeMode;
  colors: ColorPalette;
  borderRadius: {
    small: string;
    medium: string;
    large: string;
  };
  spacing: {
    unit: number; // base unit in pixels
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
  };
}

// ============================================================================
// MODULE SYSTEM (LEGACY)
// ============================================================================

/**
 * @deprecated Use ModuleType from './types/module' instead
 * Legacy module types - kept for backward compatibility
 */
export type LegacyModuleType =
  | 'clock'
  | 'weather'
  | 'calendar'
  | 'tasks'
  | 'notes'
  | 'media'
  | 'chart'
  | 'feed'
  | 'quick-actions'
  | 'ai-chat'
  | 'custom';

/**
 * Module priority for loading and rendering
 */
export type ModulePriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * @deprecated Use ModuleState from './types/module' instead
 * Legacy module state - kept for backward compatibility
 */
export type LegacyModuleState = 'idle' | 'loading' | 'ready' | 'error' | 'empty';

/**
 * Module action handler
 */
export interface ModuleAction<T = unknown> {
  type: string;
  payload?: T;
  moduleId: string;
}

/**
 * @deprecated Use ModuleConfig from './types/module' instead
 * Legacy module configuration - kept for backward compatibility
 */
export interface LegacyModuleConfig {
  id: string;
  type: LegacyModuleType;
  slotId: string; // references LayoutTemplate.slots key
  priority?: ModulePriority;
  enabled?: boolean;

  // Module-specific settings
  settings?: Record<string, unknown>;

  // Visual customization
  style?: {
    background?: string;
    padding?: string;
    borderRadius?: string;
    shadow?: string;
  };

  // Module chrome/frame
  chrome?: {
    showHeader?: boolean;
    title?: string;
    icon?: string;
    actions?: ModuleChromeAction[];
  };

  // Animation preferences
  animation?: {
    entrance?: Variants;
    exit?: Variants;
    layout?: boolean;
  };
}

/**
 * Module configuration - now supports both legacy and new module types
 */
export interface ModuleConfig {
  id: string;
  type: LegacyModuleType | string; // Support both legacy and new types
  slotId: string; // references LayoutTemplate.slots key
  priority?: ModulePriority;
  enabled?: boolean;

  // Module-specific settings
  settings?: Record<string, unknown>;

  // Visual customization
  style?: {
    background?: string;
    padding?: string;
    borderRadius?: string;
    shadow?: string;
  };

  // Module chrome/frame
  chrome?: {
    showHeader?: boolean;
    title?: string;
    icon?: string;
    actions?: ModuleChromeAction[];
  };

  // Animation preferences
  animation?: {
    entrance?: Variants;
    exit?: Variants;
    layout?: boolean;
  };
}

/**
 * Module chrome action button
 */
export interface ModuleChromeAction {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
}

/**
 * Module state - now supports both legacy and new states
 */
export type ModuleState = LegacyModuleState | 'loaded' | 'collapsed' | 'expanded' | 'interactive' | 'disabled';

/**
 * Base props for all module components
 */
export interface ModuleProps<T = unknown> {
  config: ModuleConfig;
  sessionData?: SessionData;
  onAction?: (action: ModuleAction) => void;
  state?: ModuleState;
  data?: T;
}

/**
 * Module component definition for registry
 * Uses 'any' for component type to allow flexibility with module-specific props
 */
export interface ModuleDefinition<T = any> {
  type: LegacyModuleType | string; // Support both legacy and new types
  component: ComponentType<any>; // Changed to 'any' to support custom prop interfaces
  defaultConfig?: Partial<ModuleConfig>;
  displayName: string;
  description?: string;
  preload?: () => Promise<void>;
}

// ============================================================================
// MORPHING CANVAS CONFIGURATION
// ============================================================================

/**
 * Main configuration for the Morphing Canvas
 */
export interface MorphingCanvasConfig {
  id: string;
  name: string;
  description?: string;

  // Layout
  layout: LayoutTemplate;
  alternativeLayouts?: LayoutTemplate[];

  // Theme
  theme: ThemeConfig;

  // Modules
  modules: ModuleConfig[];

  // Behavior
  behavior?: {
    enableAnimations?: boolean;
    respectReducedMotion?: boolean;
    enableAutoLayout?: boolean;
    persistState?: boolean;
  };

  // Metadata
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    author?: string;
    tags?: string[];
  };
}

// ============================================================================
// SESSION & DATA
// ============================================================================

/**
 * Session data passed to modules
 */
export interface SessionData {
  userId?: string;
  preferences?: Record<string, unknown>;
  permissions?: string[];
  [key: string]: unknown;
}

// ============================================================================
// ANIMATION SYSTEM
// ============================================================================

/**
 * FLIP animation state
 */
export interface FLIPState {
  first: DOMRect;
  last: DOMRect;
  invert: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
  };
}

/**
 * Stagger animation config
 */
export interface StaggerConfig {
  delayChildren?: number;
  staggerChildren?: number;
  staggerDirection?: 1 | -1;
  when?: 'beforeChildren' | 'afterChildren';
}

/**
 * Animation transition config
 */
export interface AnimationTransition {
  type?: 'spring' | 'tween' | 'inertia';
  duration?: number;
  delay?: number;
  ease?: string | number[];
  stiffness?: number;
  damping?: number;
  mass?: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract the data type from a ModuleProps type
 */
export type ExtractModuleData<T> = T extends ModuleProps<infer D> ? D : never;

/**
 * Module registry type - supports both legacy and new module types
 */
export type ModuleRegistry = Map<string, ModuleDefinition>;

/**
 * Layout change event
 */
export interface LayoutChangeEvent {
  previousLayoutId: string;
  currentLayoutId: string;
  timestamp: number;
}

/**
 * Module error boundary fallback props
 */
export interface ModuleErrorFallbackProps {
  error: Error;
  resetError: () => void;
  moduleConfig: ModuleConfig;
}

/**
 * Module chrome props
 */
export interface ModuleChromeProps {
  config: ModuleConfig;
  state: ModuleState;
  onAction?: (action: ModuleAction) => void;
  children: ReactNode;
}
