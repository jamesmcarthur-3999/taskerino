/**
 * Animation System - Tokens
 *
 * Animation constants including durations, easings, springs, delays, and stagger values.
 * Imports from design-system/theme.ts where applicable and adds Framer Motion specific values.
 */

import {
  DURATION,
  EASING,
  STAGGER_DELAY,
} from '../design-system/theme';
import type {
  AnimationTransition,
  SpringConfig,
  TweenConfig,
  EasingName,
  DurationName,
  SpringPresetName,
} from './types';

// ============================================================================
// DURATIONS
// ============================================================================

/**
 * Animation durations in milliseconds (from theme)
 * Extended with seconds for Framer Motion
 */
export const durations = {
  // Milliseconds (from theme)
  ms: DURATION,

  // Seconds (for Framer Motion)
  s: {
    instant: DURATION.instant / 1000,
    fast: DURATION.fast / 1000,
    normal: DURATION.normal / 1000,
    moderate: DURATION.moderate / 1000,
    slow: DURATION.slow / 1000,
    slower: DURATION.slower / 1000,
    glacial: DURATION.glacial / 1000,
  },
} as const;

/**
 * Get duration in seconds by name
 */
export function getDuration(name: DurationName): number {
  return durations.s[name];
}

/**
 * Get duration in milliseconds by name
 */
export function getDurationMs(name: DurationName): number {
  return durations.ms[name];
}

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

/**
 * Easing curves for natural motion (from theme + additions)
 */
export const easings = {
  // From theme
  linear: [0, 0, 1, 1],
  easeIn: EASING.easeIn,
  easeOut: EASING.easeOut,
  easeInOut: EASING.easeInOut,
  smooth: EASING.smooth,
  snappy: EASING.snappy,
  elastic: EASING.elastic,
  anticipate: EASING.anticipate,

  // Additional for Framer Motion
  bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',

  // Material Design easings
  standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
  sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)',
} as const;

/**
 * Get easing function by name
 */
export function getEasing(name: EasingName): string | readonly number[] {
  return easings[name] as string | readonly number[];
}

// ============================================================================
// SPRING CONFIGURATIONS
// ============================================================================

/**
 * Spring animation presets
 * Optimized for different interaction types
 */
export const springs: Record<SpringPresetName, SpringConfig> = {
  // Gentle, soft spring - for large elements
  gentle: {
    type: 'spring',
    stiffness: 120,
    damping: 14,
    mass: 0.5,
  },

  // Bouncy spring - for playful interactions
  bouncy: {
    type: 'spring',
    stiffness: 260,
    damping: 20,
    mass: 0.8,
  },

  // Snappy spring - for quick feedback
  snappy: {
    type: 'spring',
    stiffness: 400,
    damping: 30,
    mass: 0.5,
  },

  // Smooth spring - for layout transitions
  smooth: {
    type: 'spring',
    stiffness: 100,
    damping: 20,
    mass: 1,
  },

  // Stiff spring - for small, precise movements
  stiff: {
    type: 'spring',
    stiffness: 500,
    damping: 35,
    mass: 0.4,
  },
} as const;

/**
 * Get spring configuration by name
 */
export function getSpring(name: SpringPresetName): SpringConfig {
  return springs[name];
}

// ============================================================================
// LAYOUT SPRINGS
// ============================================================================

/**
 * Specialized spring configurations for layout animations
 */
export const layoutSprings = {
  // For module repositioning
  default: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  },

  // For smooth layout shifts
  smooth: {
    type: 'spring' as const,
    stiffness: 200,
    damping: 25,
    mass: 1,
  },

  // For quick layout changes
  snappy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 35,
    mass: 0.6,
  },
} as const;

// ============================================================================
// DELAYS
// ============================================================================

/**
 * Stagger delays for coordinated animations (from theme)
 */
export const delays = {
  // From theme (in ms)
  ms: STAGGER_DELAY,

  // In seconds for Framer Motion
  s: {
    tiny: STAGGER_DELAY.tiny / 1000,
    small: STAGGER_DELAY.small / 1000,
    medium: STAGGER_DELAY.medium / 1000,
    large: STAGGER_DELAY.large / 1000,
  },
} as const;

/**
 * Get delay in seconds
 */
export function getDelay(size: 'tiny' | 'small' | 'medium' | 'large'): number {
  return delays.s[size];
}

/**
 * Get delay in milliseconds
 */
export function getDelayMs(size: 'tiny' | 'small' | 'medium' | 'large'): number {
  return delays.ms[size];
}

// ============================================================================
// STAGGER CONFIGURATIONS
// ============================================================================

/**
 * Stagger animation configurations
 */
export const staggerConfigs = {
  // Fast stagger for small lists
  fast: {
    delayChildren: 0,
    staggerChildren: delays.s.tiny,
    staggerDirection: 1 as const,
    when: 'beforeChildren' as const,
  },

  // Normal stagger for medium lists
  normal: {
    delayChildren: 0,
    staggerChildren: delays.s.small,
    staggerDirection: 1 as const,
    when: 'beforeChildren' as const,
  },

  // Slow stagger for dramatic effect
  slow: {
    delayChildren: 0,
    staggerChildren: delays.s.medium,
    staggerDirection: 1 as const,
    when: 'beforeChildren' as const,
  },

  // Reverse stagger
  reverse: {
    delayChildren: 0,
    staggerChildren: delays.s.small,
    staggerDirection: -1 as const,
    when: 'beforeChildren' as const,
  },
} as const;

// ============================================================================
// TRANSITION PRESETS
// ============================================================================

/**
 * Common transition configurations
 */
export const transitions = {
  // Instant (no animation)
  instant: {
    duration: 0,
  },

  // Fast tween
  fast: {
    type: 'tween' as const,
    duration: durations.s.fast,
    ease: easings.easeOut,
  },

  // Normal tween
  normal: {
    type: 'tween' as const,
    duration: durations.s.normal,
    ease: easings.smooth,
  },

  // Slow tween
  slow: {
    type: 'tween' as const,
    duration: durations.s.slow,
    ease: easings.smooth,
  },

  // Bouncy tween
  bouncy: {
    type: 'tween' as const,
    duration: durations.s.moderate,
    ease: easings.bouncy,
  },
} as const;

// ============================================================================
// SCALE VALUES
// ============================================================================

/**
 * Scale values for interaction states
 */
export const scales = {
  // Hover states
  hover: {
    button: 1.05,
    iconButton: 1.1,
    card: 1.02,
    subtle: 1.01,
  },

  // Active/tap states
  tap: {
    button: 0.95,
    iconButton: 0.9,
    card: 0.99,
    subtle: 0.99,
  },

  // Default scale
  default: 1,
} as const;

// ============================================================================
// DISTANCES
// ============================================================================

/**
 * Distance values for slide animations (in pixels)
 */
export const distances = {
  small: 20,
  medium: 40,
  large: 100,
  screen: '100%',
} as const;

// ============================================================================
// OPACITY VALUES
// ============================================================================

/**
 * Opacity values for fade animations
 */
export const opacities = {
  hidden: 0,
  visible: 1,
  subtle: 0.6,
  faded: 0.4,
} as const;

// ============================================================================
// BLUR VALUES
// ============================================================================

/**
 * Blur values for backdrop effects (in pixels)
 */
export const blurs = {
  none: 0,
  subtle: 4,
  medium: 8,
  strong: 12,
  extraStrong: 16,
} as const;

// ============================================================================
// Z-INDEX VALUES
// ============================================================================

/**
 * Z-index values for layering animated elements
 */
export const zIndices = {
  base: 0,
  elevated: 10,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  popover: 1400,
  toast: 1500,
  tooltip: 1600,
} as const;

// ============================================================================
// ISLAND ANIMATION CONSTANTS
// ============================================================================

/**
 * Navigation Island specific animation values
 * Migrated from TopNavigation/utils/islandAnimations.ts
 */
export const islandAnimation = {
  // Spring for island expansion/collapse
  spring: {
    type: 'spring' as const,
    stiffness: 260,
    damping: 26,
  },

  // Content spring for mode transitions
  contentSpring: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 25,
  },

  // Mode content transition values
  modeContent: {
    offsetY: -8,
    exitOffsetY: -12,
    exitScale: 0.98,
  },
} as const;

// ============================================================================
// EXPORT ALL
// ============================================================================

/**
 * Centralized export of all animation tokens
 */
export const tokens = {
  durations,
  easings,
  springs,
  layoutSprings,
  delays,
  staggerConfigs,
  transitions,
  scales,
  distances,
  opacities,
  blurs,
  zIndices,
  islandAnimation,
} as const;

export default tokens;
