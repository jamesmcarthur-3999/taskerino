/**
 * Animation System - Utilities
 *
 * Helper functions for creating and manipulating animations.
 */

import type { Variants, Transition } from 'framer-motion';
import type {
  AnimationTransition,
  FLIPState,
  CustomVariantConfig,
  StaggerConfig,
} from './types';
import { durations, easings, springs } from './tokens';
import { fadeVariants } from './variants';

// ============================================================================
// VARIANT CREATION
// ============================================================================

/**
 * Create custom variants with simplified configuration
 */
export function createVariants(config: CustomVariantConfig = {}): Variants {
  const { from = {}, to = {}, transition = springs.gentle } = config;

  return {
    hidden: {
      opacity: 0,
      ...from,
    },
    visible: {
      opacity: 1,
      ...to,
      transition: transition as any,
    },
    exit: {
      opacity: 0,
      ...from,
      transition: {
        duration: durations.s.fast,
        ease: easings.easeIn as any,
      },
    },
  };
}

/**
 * Create stagger variants for container and items
 */
export function createStaggerVariants(config: StaggerConfig = {}): {
  container: Variants;
  item: Variants;
} {
  const {
    delayChildren = 0,
    staggerChildren = 0.05,
    staggerDirection = 1,
    when = 'beforeChildren',
  } = config;

  return {
    container: {
      hidden: {
        opacity: 0,
        transition: {
          when,
          staggerChildren,
          staggerDirection: staggerDirection * -1,
        },
      },
      visible: {
        opacity: 1,
        transition: {
          when,
          delayChildren,
          staggerChildren,
          staggerDirection,
        },
      },
    },
    item: {
      hidden: {
        opacity: 0,
        y: 20,
        scale: 0.95,
      },
      visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: springs.gentle,
      },
    },
  };
}

// ============================================================================
// TRANSITION UTILITIES
// ============================================================================

/**
 * Merge multiple transition configurations
 * Later configs override earlier ones
 */
export function mergeTransitions(
  ...transitions: Partial<AnimationTransition>[]
): AnimationTransition {
  return Object.assign({}, ...transitions);
}

/**
 * Get layout transition configuration
 * Optimized for Framer Motion's layout animations
 */
export function getLayoutTransition(reducedMotion: boolean = false): Transition {
  if (reducedMotion) {
    return { duration: 0 };
  }

  return {
    type: 'spring',
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  };
}

/**
 * Create layout morph transition for module repositioning
 */
export function createLayoutMorphTransition(
  reducedMotion: boolean = false
): Transition {
  if (reducedMotion) {
    return { duration: 0 };
  }

  return {
    layout: {
      type: 'spring',
      stiffness: 200,
      damping: 25,
      mass: 1,
    },
  } as Transition;
}

// ============================================================================
// MOTION SAFETY
// ============================================================================

/**
 * Get animation variant based on reduced motion preference
 * Returns fade variant if reduced motion is preferred
 */
export function getMotionSafeVariant(
  variant: Variants,
  reducedMotion: boolean
): Variants {
  if (reducedMotion) {
    return fadeVariants;
  }
  return variant;
}

/**
 * Check if reduced motion is preferred (synchronous)
 */
export function shouldReduceMotion(): boolean {
  if (typeof window === 'undefined') return false;

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
}

/**
 * Get motion-safe transition
 * Returns instant transition if reduced motion is preferred
 */
export function getMotionSafeTransition(
  transition: AnimationTransition,
  reducedMotion: boolean
): AnimationTransition {
  if (reducedMotion) {
    return { duration: 0 };
  }
  return transition;
}

// ============================================================================
// STAGGER UTILITIES
// ============================================================================

/**
 * Get stagger delay for an item index
 */
export function getStaggerDelay(
  index: number,
  baseDelay: number = 0,
  staggerDelay: number = 0.05
): number {
  return baseDelay + index * staggerDelay;
}

/**
 * Calculate stagger delays for a list of items
 */
export function calculateStaggerDelays(
  itemCount: number,
  staggerDelay: number = 0.05,
  baseDelay: number = 0
): number[] {
  return Array.from({ length: itemCount }, (_, i) =>
    getStaggerDelay(i, baseDelay, staggerDelay)
  );
}

/**
 * Create reverse stagger delays
 */
export function calculateReverseStaggerDelays(
  itemCount: number,
  staggerDelay: number = 0.05,
  baseDelay: number = 0
): number[] {
  const delays = calculateStaggerDelays(itemCount, staggerDelay, baseDelay);
  return delays.reverse();
}

// ============================================================================
// FLIP ANIMATION UTILITIES
// ============================================================================

/**
 * Calculate FLIP state for an element
 * FLIP = First, Last, Invert, Play
 */
export function calculateFLIP(
  element: HTMLElement,
  firstRect: DOMRect
): FLIPState {
  const lastRect = element.getBoundingClientRect();

  return {
    first: firstRect,
    last: lastRect,
    invert: {
      x: firstRect.left - lastRect.left,
      y: firstRect.top - lastRect.top,
      scaleX: firstRect.width / lastRect.width,
      scaleY: firstRect.height / lastRect.height,
    },
  };
}

/**
 * Apply FLIP animation to an element
 */
export function applyFLIPAnimation(
  element: HTMLElement,
  flipState: FLIPState,
  transition: AnimationTransition = springs.smooth
): Animation {
  const { invert } = flipState;

  // Invert: Apply the inverted transform
  element.style.transform = `translate(${invert.x}px, ${invert.y}px) scale(${invert.scaleX}, ${invert.scaleY})`;
  element.style.transformOrigin = 'top left';

  // Force a reflow
  element.offsetHeight;

  // Play: Animate to the final state
  return element.animate(
    [
      {
        transform: `translate(${invert.x}px, ${invert.y}px) scale(${invert.scaleX}, ${invert.scaleY})`,
      },
      {
        transform: 'translate(0, 0) scale(1, 1)',
      },
    ],
    {
      duration: (transition.duration || 0.3) * 1000,
      easing: Array.isArray(transition.ease)
        ? `cubic-bezier(${transition.ease.join(',')})`
        : (transition.ease as string) || 'ease-out',
      fill: 'both',
    }
  );
}

/**
 * Perform complete FLIP transition
 */
export async function performFLIPTransition(
  element: HTMLElement,
  callback: () => void | Promise<void>,
  transition?: AnimationTransition
): Promise<void> {
  // First: Capture initial position
  const firstRect = element.getBoundingClientRect();

  // Execute the change
  await callback();

  // Last: Capture final position
  const flipState = calculateFLIP(element, firstRect);

  // Invert and Play
  const animation = applyFLIPAnimation(element, flipState, transition);

  await animation.finished;
}

// ============================================================================
// ORCHESTRATION UTILITIES
// ============================================================================

/**
 * Execute animations sequentially
 */
export async function animateSequence(
  animations: Array<() => Promise<void>>
): Promise<void> {
  for (const animate of animations) {
    await animate();
  }
}

/**
 * Execute animations in parallel
 */
export async function animateParallel(
  animations: Array<() => Promise<void>>
): Promise<void> {
  await Promise.all(animations.map((animate) => animate()));
}

/**
 * Execute animations with stagger
 */
export async function animateStagger(
  animations: Array<() => Promise<void>>,
  staggerDelay: number = 50
): Promise<void> {
  const promises = animations.map((animate, index) => {
    return new Promise<void>((resolve) => {
      setTimeout(async () => {
        await animate();
        resolve();
      }, index * staggerDelay);
    });
  });

  await Promise.all(promises);
}

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// TRANSFORM UTILITIES
// ============================================================================

/**
 * Parse transform string to object
 */
export function parseTransform(transformString: string): Record<string, number> {
  const transforms: Record<string, number> = {};
  const regex = /(\w+)\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(transformString)) !== null) {
    const [, property, value] = match;
    transforms[property] = parseFloat(value);
  }

  return transforms;
}

/**
 * Build transform string from object
 */
export function buildTransform(transforms: Record<string, number | string>): string {
  return Object.entries(transforms)
    .map(([key, value]) => {
      if (typeof value === 'number') {
        // Add default units
        if (key === 'rotate' || key.includes('Rotate')) {
          return `${key}(${value}deg)`;
        }
        if (key.includes('translate') || key.includes('Translate')) {
          return `${key}(${value}px)`;
        }
        return `${key}(${value})`;
      }
      return `${key}(${value})`;
    })
    .join(' ');
}

// ============================================================================
// EASING UTILITIES
// ============================================================================

/**
 * Create cubic bezier easing string
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

/**
 * Create steps easing string
 */
export function steps(count: number, direction: 'start' | 'end' = 'end'): string {
  return `steps(${count}, ${direction})`;
}

// ============================================================================
// VIEWPORT UTILITIES
// ============================================================================

/**
 * Check if element is in viewport
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Get element position relative to viewport
 */
export function getViewportPosition(element: HTMLElement): {
  top: number;
  left: number;
  bottom: number;
  right: number;
  centerX: number;
  centerY: number;
} {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    right: rect.right,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
  };
}

/**
 * Calculate distance from element to viewport center
 */
export function getDistanceFromCenter(element: HTMLElement): {
  x: number;
  y: number;
  distance: number;
} {
  const viewportCenter = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };

  const elementCenter = getViewportPosition(element);

  const x = elementCenter.centerX - viewportCenter.x;
  const y = elementCenter.centerY - viewportCenter.y;
  const distance = Math.sqrt(x * x + y * y);

  return { x, y, distance };
}

// ============================================================================
// CLAMP AND INTERPOLATION
// ============================================================================

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

/**
 * Map value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Normalize value to 0-1 range
 */
export function normalize(value: number, min: number, max: number): number {
  return (value - min) / (max - min);
}

// ============================================================================
// TIMING UTILITIES
// ============================================================================

/**
 * Convert milliseconds to seconds
 */
export function msToSeconds(ms: number): number {
  return ms / 1000;
}

/**
 * Convert seconds to milliseconds
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * Get total animation duration including delay
 */
export function getTotalDuration(transition: AnimationTransition): number {
  const duration = transition.duration || 0;
  const delay = transition.delay || 0;
  return duration + delay;
}

// ============================================================================
// EXPORT ALL UTILITIES
// ============================================================================

export const utils = {
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

  // FLIP animation
  calculateFLIP,
  applyFLIPAnimation,
  performFLIPTransition,

  // Orchestration
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
} as const;

export default utils;
