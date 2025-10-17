/**
 * Animation System - Barrel Exports
 *
 * Centralized exports for the unified animation system.
 * Import animations from this file for consistent usage across the application.
 *
 * @example
 * ```tsx
 * import { fadeVariants, useReducedMotion, FadeIn } from '@/animations';
 * ```
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Core animation types
  AnimationTransition,
  SpringConfig,
  TweenConfig,

  // Variant types
  VariantState,
  ExtendedVariantState,
  AnimationDirection,
  EasingName,
  DurationName,
  SpringPresetName,

  // Stagger types
  StaggerConfig,
  StaggerVariants,

  // FLIP types
  FLIPState,
  FLIPConfig,

  // Scroll types
  ScrollAnimationConfig,
  ScrollProgressConfig,

  // Layout types
  LayoutTransitionConfig,
  LayoutType,

  // Orchestration types
  OrchestrationStep,
  OrchestrationMode,
  OrchestrationConfig,

  // Motion config types
  MotionConfig,
  AnimationContextValue,

  // Variant builder types
  FadeVariantConfig,
  SlideVariantConfig,
  ScaleVariantConfig,
  CustomVariantConfig,

  // Module types
  ModuleVariantName,
  IslandState,
  ModeContentState,

  // Interaction types
  HoverScaleConfig,
  TapScaleConfig,
  InteractionVariantConfig,

  // Utility types
  TimingFunction,
  DelayFunction,
  VariantResolver,
  TransitionResolver,
} from './types';

// ============================================================================
// TOKEN EXPORTS
// ============================================================================

export {
  // Duration tokens
  durations,
  getDuration,
  getDurationMs,

  // Easing tokens
  easings,
  getEasing,

  // Spring tokens
  springs,
  getSpring,
  layoutSprings,

  // Delay tokens
  delays,
  getDelay,
  getDelayMs,

  // Stagger configs
  staggerConfigs,

  // Transition presets
  transitions,

  // Value tokens
  scales,
  distances,
  opacities,
  blurs,
  zIndices,

  // Island animation tokens
  islandAnimation,

  // Consolidated export
  tokens,
} from './tokens';

// ============================================================================
// VARIANT EXPORTS
// ============================================================================

export {
  // Basic fade variants
  fadeVariants,
  createFadeVariants,

  // Slide variants
  slideUpVariants,
  slideDownVariants,
  slideLeftVariants,
  slideRightVariants,
  createSlideVariants,

  // Scale variants
  scaleUpVariants,
  scaleDownVariants,
  bounceVariants,
  createScaleVariants,

  // Stagger variants
  staggerContainerVariants,
  listItemVariants,

  // Island variants
  islandVariants,
  modeContentVariants,

  // Module variants
  moduleVariants,
  getModuleVariant,

  // Interaction variants
  buttonInteractionVariants,
  iconButtonInteractionVariants,
  cardInteractionVariants,
  subtleInteractionVariants,
  createInteractionVariants,

  // Combined variants
  slideScaleVariants,
  slideBlurVariants,

  // Consolidated export
  variants,
} from './variants';

// ============================================================================
// HOOK EXPORTS
// ============================================================================

export {
  // Reduced motion
  useReducedMotion,
  useMotionSafeVariants,

  // Layout transitions
  useLayoutTransition,

  // Stagger animations
  useStaggeredChildren,

  // Scroll animations
  useScrollAnimation,
  useScrollProgress,
  useSmoothScrollProgress,

  // FLIP animations
  useFLIPAnimation,

  // Orchestration
  useOrchestration,

  // Controlled animations
  useControlledAnimation,

  // Mouse interactions
  useMousePosition,
  useParallax,

  // Intersection observer
  useIntersection,

  // Consolidated export
  hooks,
} from './hooks';

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export {
  // Variant creation
  createVariants,
  createStaggerVariants,

  // Transition utilities
  mergeTransitions,
  getLayoutTransition,
  createLayoutMorphTransition,

  // Motion safety
  getMotionSafeVariant,
  shouldReduceMotion,
  getMotionSafeTransition,

  // Stagger utilities
  getStaggerDelay,
  calculateStaggerDelays,
  calculateReverseStaggerDelays,

  // FLIP utilities
  calculateFLIP,
  applyFLIPAnimation,
  performFLIPTransition,

  // Orchestration utilities
  animateSequence,
  animateParallel,
  animateStagger,
  delay,

  // Transform utilities
  parseTransform,
  buildTransform,

  // Easing utilities
  cubicBezier,
  steps,

  // Viewport utilities
  isInViewport,
  getViewportPosition,
  getDistanceFromCenter,

  // Math utilities
  clamp,
  lerp,
  mapRange,
  normalize,

  // Timing utilities
  msToSeconds,
  secondsToMs,
  getTotalDuration,

  // Consolidated export
  utils,
} from './utils';

// ============================================================================
// COMPONENT EXPORTS
// ============================================================================

export {
  // Base components
  AnimatedDiv,
  AnimatedButton,
  AnimatedCard,
  AnimatedList,
  AnimatedListItem,
  AnimatedSpan,

  // Animation components
  FadeIn,
  SlideIn,
  ScaleIn,

  // Stagger components
  StaggerContainer,
  StaggerItem,

  // Interactive components
  InteractiveButton,
  InteractiveCard,

  // Utility components
  Presence,
  ConditionalRender,
  AnimatedListRenderer,
  ModalWrapper,

  // Consolidated export
  components,
} from './components';

// Component prop types
export type {
  FadeInProps,
  SlideInProps,
  ScaleInProps,
  StaggerContainerProps,
  StaggerItemProps,
  InteractiveButtonProps,
  InteractiveCardProps,
  PresenceProps,
  ConditionalRenderProps,
  AnimatedListProps,
  ModalWrapperProps,
} from './components';

// ============================================================================
// CONFIG EXPORTS
// ============================================================================

export {
  // Provider
  AnimationProvider,

  // Hooks
  useAnimationConfig,
  useAnimationsEnabled,
  useAnimationToggle,
  useAnimationSpeed,

  // Components
  ConditionalAnimation,
  PerformanceMonitor,

  // Consolidated export
  config,
} from './config';

// Config prop types
export type {
  AnimationProviderProps,
  ConditionalAnimationProps,
  PerformanceMonitorProps,
} from './config';

// ============================================================================
// RE-EXPORTS FROM FRAMER MOTION
// ============================================================================

/**
 * Re-export commonly used Framer Motion exports
 * for convenience and consistency
 */
export {
  motion,
  AnimatePresence,
  useAnimation,
  useMotionValue,
  useTransform,
  useSpring,
  useScroll,
  useInView,
  useDragControls,
  useAnimationControls,
  LazyMotion,
  domAnimation,
  domMax,
  m,
} from 'framer-motion';

export type {
  Variants,
  Variant,
  Transition,
  MotionProps,
  HTMLMotionProps,
  SVGMotionProps,
  MotionValue,
  DragControls,
  PanInfo,
  TargetAndTransition,
} from 'framer-motion';

// Import for backwards compatibility exports
import {
  durations as durationTokens,
  easings as easingTokens,
  springs as springTokens,
  delays as delayTokens,
  scales as scaleTokens,
  distances as distanceTokens,
  opacities as opacityTokens,
  islandAnimation as islandAnimationTokens,
} from './tokens';

import {
  moduleVariants as moduleVariantsImport,
  fadeVariants as fadeVariantsImport,
} from './variants';

import type { ModuleVariantName } from './types';

// ============================================================================
// BACKWARDS COMPATIBILITY EXPORTS
// ============================================================================

/**
 * Island-specific exports for backwards compatibility
 * with TopNavigation/utils/islandAnimations.ts
 */
export const springConfig = islandAnimationTokens.spring;
export const contentSpring = islandAnimationTokens.contentSpring;
export const islandSpring = islandAnimationTokens.spring;
export const islandContentSpring = islandAnimationTokens.contentSpring;

/**
 * Module-specific exports for backwards compatibility
 * with morphing-canvas/animations/transitions.ts
 */
export const springPresets = springTokens;
export const easingPresets = {
  easeOut: easingTokens.easeOut,
  easeIn: easingTokens.easeIn,
  easeInOut: easingTokens.easeInOut,
  sharp: easingTokens.sharp,
  bouncy: easingTokens.bouncy,
};
export const durationPresets = {
  instant: durationTokens.s.instant,
  fast: durationTokens.s.fast,
  normal: durationTokens.s.normal,
  slow: durationTokens.s.slow,
  slower: durationTokens.s.slower,
};

// Alias for module variants
export const moduleAnimationVariants = moduleVariantsImport;
export type ModuleAnimationVariantName = ModuleVariantName;

// Alias for fade variant
export const fadeInVariants = fadeVariantsImport;
