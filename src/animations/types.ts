/**
 * Animation System - Type Definitions
 *
 * Centralized TypeScript types for the unified animation system
 */

import type { Transition, Variant, Variants } from 'framer-motion';

// ============================================================================
// CORE ANIMATION TYPES
// ============================================================================

/**
 * Animation transition configuration
 */
export interface AnimationTransition {
  duration?: number;
  delay?: number;
  ease?: number[] | string;
  type?: 'spring' | 'tween' | 'inertia';
  stiffness?: number;
  damping?: number;
  mass?: number;
  restDelta?: number;
  restSpeed?: number;
  velocity?: number;
  bounce?: number;
  times?: number[];
  repeat?: number;
  repeatType?: 'loop' | 'reverse' | 'mirror';
  repeatDelay?: number;
  from?: number | string;
  elapsed?: number;
  driver?: any;
  when?: 'beforeChildren' | 'afterChildren';
  delayChildren?: number;
  staggerChildren?: number;
  staggerDirection?: number;
}

/**
 * Spring animation configuration
 */
export interface SpringConfig {
  type: 'spring';
  stiffness: number;
  damping: number;
  mass?: number;
  restDelta?: number;
  restSpeed?: number;
}

/**
 * Tween animation configuration
 */
export interface TweenConfig {
  type: 'tween';
  duration: number;
  ease?: number[] | string;
  delay?: number;
}

// ============================================================================
// VARIANT TYPES
// ============================================================================

/**
 * Standard animation variant states
 */
export type VariantState = 'hidden' | 'visible' | 'exit';

/**
 * Extended variant states including hover and tap
 */
export type ExtendedVariantState = VariantState | 'initial' | 'animate' | 'hover' | 'tap' | 'focus';

/**
 * Animation direction
 */
export type AnimationDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Easing function names
 */
export type EasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'smooth' | 'snappy' | 'elastic' | 'anticipate' | 'bouncy';

/**
 * Duration preset names
 */
export type DurationName = 'instant' | 'fast' | 'normal' | 'moderate' | 'slow' | 'slower' | 'glacial';

/**
 * Spring preset names
 */
export type SpringPresetName = 'gentle' | 'bouncy' | 'snappy' | 'smooth' | 'stiff';

// ============================================================================
// STAGGER ANIMATION
// ============================================================================

/**
 * Stagger animation configuration
 */
export interface StaggerConfig {
  delayChildren?: number;
  staggerChildren?: number;
  staggerDirection?: 1 | -1;
  when?: 'beforeChildren' | 'afterChildren';
}

/**
 * Stagger variants result
 */
export interface StaggerVariants {
  container: Variants;
  item: Variants;
}

// ============================================================================
// FLIP ANIMATION
// ============================================================================

/**
 * FLIP animation state (First, Last, Invert, Play)
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
 * FLIP animation configuration
 */
export interface FLIPConfig {
  transition?: AnimationTransition;
  onComplete?: () => void;
}

// ============================================================================
// SCROLL ANIMATION
// ============================================================================

/**
 * Scroll animation configuration
 */
export interface ScrollAnimationConfig {
  threshold?: number;
  once?: boolean;
  amount?: 'some' | 'all' | number;
  margin?: string;
}

/**
 * Scroll progress configuration
 */
export interface ScrollProgressConfig {
  target?: React.RefObject<HTMLElement>;
  offset?: [string, string];
  container?: React.RefObject<HTMLElement>;
}

// ============================================================================
// LAYOUT TRANSITION
// ============================================================================

/**
 * Layout transition configuration
 */
export interface LayoutTransitionConfig {
  type?: 'spring' | 'tween';
  duration?: number;
  bounce?: number;
}

/**
 * Layout animation type
 */
export type LayoutType = boolean | 'position' | 'size';

// ============================================================================
// ORCHESTRATION
// ============================================================================

/**
 * Animation orchestration step
 */
export interface OrchestrationStep {
  id: string;
  animate: () => Promise<void>;
  delay?: number;
}

/**
 * Animation orchestration mode
 */
export type OrchestrationMode = 'sequence' | 'parallel' | 'stagger';

/**
 * Orchestration configuration
 */
export interface OrchestrationConfig {
  mode: OrchestrationMode;
  steps: OrchestrationStep[];
  onComplete?: () => void;
  onStepComplete?: (stepId: string) => void;
}

// ============================================================================
// MOTION CONFIG
// ============================================================================

/**
 * Global motion configuration
 */
export interface MotionConfig {
  reducedMotion: boolean;
  transition?: AnimationTransition;
  skipAnimations?: boolean;
}

/**
 * Animation context value
 */
export interface AnimationContextValue {
  config: MotionConfig;
  updateConfig: (config: Partial<MotionConfig>) => void;
}

// ============================================================================
// VARIANT BUILDERS
// ============================================================================

/**
 * Fade variant configuration
 */
export interface FadeVariantConfig {
  duration?: number;
  delay?: number;
  ease?: EasingName | number[] | string;
}

/**
 * Slide variant configuration
 */
export interface SlideVariantConfig {
  direction?: AnimationDirection;
  distance?: number;
  duration?: number;
  delay?: number;
  spring?: SpringPresetName;
}

/**
 * Scale variant configuration
 */
export interface ScaleVariantConfig {
  from?: number;
  to?: number;
  duration?: number;
  delay?: number;
  spring?: SpringPresetName;
}

/**
 * Custom variant configuration
 */
export interface CustomVariantConfig {
  from?: Record<string, number | string>;
  to?: Record<string, number | string>;
  transition?: AnimationTransition;
}

// ============================================================================
// MODULE ANIMATION
// ============================================================================

/**
 * Module animation variant names
 */
export type ModuleVariantName =
  | 'fade'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'scaleUp'
  | 'scaleDown'
  | 'bounce'
  | 'none';

/**
 * Island animation state
 */
export type IslandState = 'collapsed' | 'expanded';

/**
 * Mode content state
 */
export type ModeContentState = 'initial' | 'animate' | 'exit';

// ============================================================================
// INTERACTION VARIANTS
// ============================================================================

/**
 * Hover scale configuration
 */
export interface HoverScaleConfig {
  scale?: number;
  transition?: AnimationTransition;
}

/**
 * Tap scale configuration
 */
export interface TapScaleConfig {
  scale?: number;
  transition?: AnimationTransition;
}

/**
 * Interaction variant configuration
 */
export interface InteractionVariantConfig {
  hover?: HoverScaleConfig;
  tap?: TapScaleConfig;
  whileHover?: Variant;
  whileTap?: Variant;
  whileFocus?: Variant;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Animation timing function
 */
export type TimingFunction = number[] | string;

/**
 * Animation delay calculation function
 */
export type DelayFunction = (index: number) => number;

/**
 * Variant resolver function
 */
export type VariantResolver<T = any> = (custom?: T) => Variant;

/**
 * Transition resolver function
 */
export type TransitionResolver<T = any> = (custom?: T) => Transition;
