/**
 * Morphing Canvas - Main exports
 *
 * Export all public APIs for the morphing canvas system
 */

// Main components
export { MorphingCanvas } from './MorphingCanvas';
export type { MorphingCanvasProps } from './MorphingCanvas';
export { ModuleRenderer } from './ModuleRenderer';
export type { ModuleRendererProps } from './ModuleRenderer';

// Registry
export {
  initializeModuleRegistry,
  registerModule,
  registerModules,
  getModule,
  hasModule,
  getRegisteredModuleTypes,
  getAllModules,
  unregisterModule,
  clearRegistry,
  getRegistrySize,
  preloadModule,
  preloadModules,
  getRegistry,
} from './registry';

// Types
export type {
  // Layout
  Breakpoint,
  GridSlot,
  ResponsiveGridSlot,
  LayoutTemplate,

  // Theme
  ThemeMode,
  ColorPalette,
  ThemeConfig,

  // Module
  ModuleType,
  ModulePriority,
  ModuleState,
  ModuleAction,
  ModuleConfig,
  ModuleChromeAction,
  ModuleProps,
  ModuleDefinition,

  // Canvas
  MorphingCanvasConfig,
  SessionData,

  // Animation
  FLIPState,
  StaggerConfig,
  AnimationTransition,

  // Utility
  DeepPartial,
  ExtractModuleData,
  ModuleRegistry,
  LayoutChangeEvent,
  ModuleErrorFallbackProps,
  ModuleChromeProps,
} from './types';

// Module-specific types (from types/module.ts)
export type {
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
} from './types/module';

export {
  ModuleTypeValues,
  ModuleStateValues,
  isModuleType,
  isModuleState,
  EVENT_TYPE_CONFIG,
} from './types/module';

// Session types (from types/session.ts)
export type {
  SessionType,
  SessionMetadata,
  SessionParticipant,
  SessionState as MorphingSessionState,
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
} from './types/session';

export {
  SessionTypeValues,
  isSessionType,
  calculateSessionDuration,
  isSessionActive,
  formatSessionDuration,
  DEFAULT_SESSION_PREFERENCES,
} from './types/session';

// Animation utilities
export {
  // Presets
  springPresets,
  easingPresets,
  durationPresets,

  // FLIP
  calculateFLIP,
  applyFLIPAnimation,
  performFLIPTransition,

  // Stagger
  createStaggerVariants,
  createListStaggerVariants,

  // Variants
  fadeInVariants,
  slideUpVariants,
  scaleUpVariants,
  slideInRightVariants,
  slideInLeftVariants,
  bounceInVariants,
  moduleAnimationVariants,

  // Reduced motion
  useReducedMotion,
  shouldReduceMotion,
  getMotionSafeVariant,

  // Utilities
  mergeTransitions,
  getStaggerDelay,
  createCustomVariants,
  animateSequence,
  animateParallel,
} from './animations/transitions';

export type { ModuleAnimationVariantName } from './animations/transitions';

// Module components (for direct import if needed)
export { ClockModule } from './modules/ClockModule';
export { QuickActionsModule } from './modules/QuickActionsModule';
export { NotesModule } from './modules/NotesModule';
export { TaskModule } from './modules/TaskModule';
export { TimelineModule } from './modules/TimelineModule';
