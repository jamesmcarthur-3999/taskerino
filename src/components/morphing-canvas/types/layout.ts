/**
 * Layout Type System for Morphing Canvas
 *
 * This file defines the layout configuration types including layout types,
 * slot definitions, and overall canvas configuration.
 */

import type { ModuleType, ModuleConfig } from './module';

/**
 * Predefined layout types for the Morphing Canvas.
 * Each layout type provides optimized configurations for specific use cases.
 */
export type LayoutType =
  /** Optimized for focused development work with minimal distractions */
  | 'deep_work_dev'
  /** Layout designed for creative brainstorming and ideation sessions */
  | 'creative_brainstorm'
  /** Layout for collaborative meetings with shared content */
  | 'collaborative_meeting'
  /** Layout optimized for learning and educational content */
  | 'learning_session'
  /** Layout for debugging and problem-solving workflows */
  | 'problem_solving'
  /** Compact layout for quick task management */
  | 'quick_task'
  /** Flexible layout combining multiple session types */
  | 'mixed_session'
  /** Fully customizable layout defined by user */
  | 'custom';

/** Layout type values for runtime checks */
export const LayoutTypeValues: readonly LayoutType[] = [
  'deep_work_dev',
  'creative_brainstorm',
  'collaborative_meeting',
  'learning_session',
  'problem_solving',
  'quick_task',
  'mixed_session',
  'custom',
] as const;

/**
 * Defines a slot within the grid layout system.
 * Slots are designated areas where modules can be placed.
 */
export interface SlotDefinition {
  /** Unique identifier for this slot */
  id: string;
  /** Display name for the slot (for UI/debugging) */
  name?: string;
  /** CSS Grid column placement (e.g., "1 / 3" or "span 2") */
  gridColumn: string;
  /** CSS Grid row placement (e.g., "1 / 2" or "auto") */
  gridRow: string;
  /** Minimum height for the slot in CSS units */
  minHeight?: string;
  /** Maximum height for the slot in CSS units */
  maxHeight?: string;
  /** Minimum width for the slot in CSS units */
  minWidth?: string;
  /** Maximum width for the slot in CSS units */
  maxWidth?: string;
  /** Types of modules that can be placed in this slot */
  acceptedModules?: ModuleType[];
  /** Priority for module placement (higher = more important) */
  priority: number;
  /** Whether this slot is required (must contain a module) */
  required?: boolean;
  /** Whether multiple modules can occupy this slot */
  allowMultiple?: boolean;
  /** Flex grow factor when using flexbox */
  flexGrow?: number;
  /** Flex shrink factor when using flexbox */
  flexShrink?: number;
  /** Flex basis when using flexbox */
  flexBasis?: string;
  /** Padding inside the slot */
  padding?: string;
  /** Gap between modules in this slot (if allowMultiple is true) */
  gap?: string;
  /** Alignment of content within the slot */
  alignContent?: 'start' | 'center' | 'end' | 'stretch';
  /** Justification of content within the slot */
  justifyContent?: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
}

/**
 * Configuration for layout-level animation settings.
 * Controls how modules transition and animate within the layout.
 */
export interface AnimationConfig {
  /** Whether animations are enabled globally */
  enabled: boolean;
  /** Default duration for animations in milliseconds */
  duration: number;
  /** Default easing function (CSS easing or cubic-bezier) */
  easing: string;
  /** Delay before animations start in milliseconds */
  delay?: number;
  /** Whether to animate layout changes (slot resizing, reordering) */
  animateLayout?: boolean;
  /** Whether to animate module entrance/exit */
  animateModules?: boolean;
  /** Whether to use reduced motion for accessibility */
  respectReducedMotion?: boolean;
  /** Custom spring physics for smooth animations */
  spring?: {
    stiffness: number;
    damping: number;
    mass?: number;
  };
}

/**
 * Configuration for the grid layout system.
 * Defines how slots are arranged and behave.
 */
export interface LayoutConfig {
  /** Array of slot definitions for the layout */
  slots: SlotDefinition[];
  /** Maximum width of the canvas in CSS units */
  maxWidth?: string;
  /** Minimum width of the canvas in CSS units */
  minWidth?: string;
  /** Spacing/gap between slots in CSS units */
  spacing: string;
  /** Number of columns in the grid (for auto-generation) */
  columns?: number;
  /** Number of rows in the grid (for auto-generation) */
  rows?: number;
  /** Template columns definition (CSS grid-template-columns) */
  templateColumns?: string;
  /** Template rows definition (CSS grid-template-rows) */
  templateRows?: string;
  /** Animation configuration for layout transitions */
  animation: AnimationConfig;
  /** Padding around the entire canvas */
  padding?: string;
  /** Whether the layout should be fixed or fluid */
  mode?: 'fixed' | 'fluid' | 'hybrid';
  /** Auto-placement algorithm for modules without explicit positions */
  autoPlacement?: 'dense' | 'sparse' | 'row' | 'column';
  /** Whether to allow overlapping modules */
  allowOverlap?: boolean;
}

/**
 * Theme configuration for the overall canvas appearance.
 * Applies to the canvas container and provides defaults for modules.
 */
export interface ThemeConfig {
  /** Color mode for the canvas */
  mode: 'light' | 'dark' | 'auto' | 'system';
  /** Primary brand color */
  primaryColor: string;
  /** Secondary brand color */
  secondaryColor?: string;
  /** Accent color for highlights and interactions */
  accentColor?: string;
  /** Background color for the canvas */
  backgroundColor?: string;
  /** Text color */
  textColor?: string;
  /** Border color for separators and outlines */
  borderColor?: string;
  /** Visual density ('compact', 'comfortable', 'spacious') */
  density: 'compact' | 'comfortable' | 'spacious';
  /** Font family for all text */
  fontFamily?: string;
  /** Base font size */
  fontSize?: string;
  /** Border radius for rounded corners */
  borderRadius?: string;
  /** Shadow elevation system */
  shadows?: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  /** Whether to use high contrast colors for accessibility */
  highContrast?: boolean;
  /** Custom CSS variables to inject */
  cssVariables?: Record<string, string>;
}

/**
 * Responsive breakpoint configuration.
 * Defines how the layout adapts to different screen sizes.
 */
export interface ResponsiveBreakpoint {
  /** Name/identifier for this breakpoint */
  name: string;
  /** Minimum width for this breakpoint (in px) */
  minWidth: number;
  /** Maximum width for this breakpoint (in px, optional) */
  maxWidth?: number;
  /** Layout configuration to use at this breakpoint */
  layout?: Partial<LayoutConfig>;
  /** Theme overrides for this breakpoint */
  theme?: Partial<ThemeConfig>;
  /** Modules to hide at this breakpoint */
  hideModules?: string[];
  /** Modules to show at this breakpoint */
  showModules?: string[];
  /** Whether to stack modules vertically */
  stack?: boolean;
}

/**
 * Responsive configuration for adaptive layouts.
 * Enables the canvas to adapt to different screen sizes and orientations.
 */
export interface ResponsiveConfig {
  /** Whether responsive behavior is enabled */
  enabled: boolean;
  /** Breakpoint definitions */
  breakpoints: ResponsiveBreakpoint[];
  /** Default breakpoint to use as base */
  defaultBreakpoint?: string;
  /** Whether to use container queries instead of media queries */
  useContainerQueries?: boolean;
  /** Behavior for touch devices */
  touchOptimizations?: {
    /** Increase touch target sizes */
    enlargeTargets?: boolean;
    /** Minimum touch target size in pixels */
    minTargetSize?: number;
    /** Disable hover effects */
    disableHover?: boolean;
  };
}

/**
 * Accessibility configuration for inclusive design.
 * Ensures the canvas is usable by everyone.
 */
export interface A11yConfig {
  /** Enable keyboard navigation */
  keyboardNavigation: boolean;
  /** Enable screen reader announcements */
  screenReaderAnnouncements: boolean;
  /** Focus trap within the canvas when modal modules are open */
  focusTrap?: boolean;
  /** Skip to content link */
  skipToContent?: boolean;
  /** Enable high contrast mode */
  highContrastMode?: boolean;
  /** Respect prefers-reduced-motion */
  respectReducedMotion: boolean;
  /** ARIA live region for announcements */
  ariaLive?: 'polite' | 'assertive' | 'off';
  /** Custom ARIA labels for layout regions */
  ariaLabels?: Record<string, string>;
  /** Keyboard shortcuts configuration */
  keyboardShortcuts?: {
    /** Enable global keyboard shortcuts */
    enabled: boolean;
    /** Custom shortcut mappings */
    shortcuts?: Record<string, string>;
  };
}

/**
 * Performance optimization configuration.
 * Controls rendering and update strategies for optimal performance.
 */
export interface PerformanceConfig {
  /** Enable virtual scrolling for long lists */
  virtualScrolling?: boolean;
  /** Lazy load modules outside viewport */
  lazyLoading?: boolean;
  /** Debounce time for resize events (ms) */
  resizeDebounce?: number;
  /** Throttle time for scroll events (ms) */
  scrollThrottle?: number;
  /** Maximum number of concurrent animations */
  maxConcurrentAnimations?: number;
  /** Enable hardware acceleration */
  hardwareAcceleration?: boolean;
  /** Reduce rendering quality when animating */
  reducedQualityWhileAnimating?: boolean;
}

/**
 * Session information for contextual layout behavior.
 * Links the canvas to session-specific data and state.
 */
export interface SessionConfig {
  /** Current session ID */
  sessionId: string;
  /** Session type (affects default layout choices) */
  sessionType?: string;
  /** User ID associated with this session */
  userId?: string;
  /** Whether to persist layout changes */
  persistLayout?: boolean;
  /** Whether to sync layout across devices */
  syncAcrossDevices?: boolean;
  /** Auto-save interval for layout state (ms) */
  autoSaveInterval?: number;
}

/**
 * Complete configuration for the Morphing Canvas.
 * This is the primary interface for initializing and configuring the canvas.
 */
export interface MorphingCanvasConfig {
  /** Layout type selection */
  layoutType: LayoutType;
  /** Session configuration */
  session: SessionConfig;
  /** Theme configuration */
  theme: ThemeConfig;
  /** Array of module configurations to render */
  modules: ModuleConfig[];
  /** Layout configuration defining slots and grid */
  layout: LayoutConfig;
  /** Responsive configuration for adaptive layouts */
  responsive: ResponsiveConfig;
  /** Accessibility configuration */
  a11y: A11yConfig;
  /** Performance optimization settings */
  performance?: PerformanceConfig;
  /** Custom event handlers */
  eventHandlers?: {
    /** Called when layout type changes */
    onLayoutChange?: (layoutType: LayoutType) => void;
    /** Called when a module is added */
    onModuleAdd?: (module: ModuleConfig) => void;
    /** Called when a module is removed */
    onModuleRemove?: (moduleId: string) => void;
    /** Called when a module is updated */
    onModuleUpdate?: (module: ModuleConfig) => void;
    /** Called when slots are rearranged */
    onSlotRearrange?: (slots: SlotDefinition[]) => void;
    /** Called on theme change */
    onThemeChange?: (theme: ThemeConfig) => void;
    /** Called on error */
    onError?: (error: Error, context: string) => void;
  };
  /** Debug mode for development */
  debug?: boolean;
  /** Custom CSS class name for the canvas container */
  className?: string;
  /** Custom data attributes */
  dataAttributes?: Record<string, string>;
}

/**
 * Type guard to check if a value is a valid LayoutType
 */
export function isLayoutType(value: unknown): value is LayoutType {
  return LayoutTypeValues.includes(value as LayoutType);
}

/**
 * Helper type for creating partial canvas configurations.
 * Useful when updating configuration at runtime.
 */
export type PartialMorphingCanvasConfig = Partial<MorphingCanvasConfig> &
  Pick<MorphingCanvasConfig, 'layoutType' | 'session'>;

/**
 * Helper type for slot definitions without computed properties.
 * Useful for serialization and storage.
 */
export type SerializableSlotDefinition = Omit<SlotDefinition, 'acceptedModules'> & {
  acceptedModules?: string[];
};

/**
 * Helper type for canvas configuration without functions and computed properties.
 * Useful for serialization and storage.
 */
export type SerializableMorphingCanvasConfig = Omit<
  MorphingCanvasConfig,
  'modules' | 'eventHandlers'
> & {
  modules: string[]; // Array of module IDs
};

/**
 * Preset layout configurations for common use cases.
 * These can be used as starting points for custom layouts.
 */
export const LAYOUT_PRESETS: Record<LayoutType, Partial<LayoutConfig>> = {
  deep_work_dev: {
    spacing: '1rem',
    templateColumns: '1fr 2fr 1fr',
    templateRows: 'auto 1fr auto',
    padding: '1.5rem',
    mode: 'fixed',
  },
  creative_brainstorm: {
    spacing: '2rem',
    templateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    templateRows: 'masonry',
    padding: '2rem',
    mode: 'fluid',
    allowOverlap: true,
  },
  collaborative_meeting: {
    spacing: '1.5rem',
    templateColumns: '1fr 1fr',
    templateRows: 'auto 1fr auto',
    padding: '1.5rem',
    mode: 'hybrid',
  },
  learning_session: {
    spacing: '1rem',
    templateColumns: '300px 1fr',
    templateRows: 'auto 1fr',
    padding: '1rem',
    mode: 'fixed',
  },
  problem_solving: {
    spacing: '1rem',
    templateColumns: '1fr 2fr',
    templateRows: 'auto 1fr auto',
    padding: '1.5rem',
    mode: 'fixed',
  },
  quick_task: {
    spacing: '0.5rem',
    templateColumns: '1fr',
    templateRows: 'auto',
    padding: '1rem',
    mode: 'fluid',
  },
  mixed_session: {
    spacing: '1.5rem',
    templateColumns: 'repeat(12, 1fr)',
    templateRows: 'repeat(auto-fill, minmax(100px, auto))',
    padding: '1.5rem',
    mode: 'hybrid',
  },
  custom: {
    spacing: '1rem',
    templateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    templateRows: 'auto',
    padding: '1rem',
    mode: 'fluid',
  },
};

/**
 * Default theme configuration.
 * Provides sensible defaults for new canvas instances.
 */
export const DEFAULT_THEME: ThemeConfig = {
  mode: 'system',
  primaryColor: '#3b82f6',
  secondaryColor: '#8b5cf6',
  accentColor: '#f59e0b',
  density: 'comfortable',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: '14px',
  borderRadius: '0.5rem',
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
};

/**
 * Default animation configuration.
 * Provides smooth, accessible animations by default.
 */
export const DEFAULT_ANIMATION: AnimationConfig = {
  enabled: true,
  duration: 300,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  delay: 0,
  animateLayout: true,
  animateModules: true,
  respectReducedMotion: true,
  spring: {
    stiffness: 300,
    damping: 30,
    mass: 1,
  },
};

/**
 * Default accessibility configuration.
 * Ensures baseline accessibility for all users.
 */
export const DEFAULT_A11Y: A11yConfig = {
  keyboardNavigation: true,
  screenReaderAnnouncements: true,
  focusTrap: false,
  skipToContent: true,
  respectReducedMotion: true,
  ariaLive: 'polite',
  keyboardShortcuts: {
    enabled: true,
  },
};
