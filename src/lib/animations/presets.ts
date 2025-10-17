/**
 * Animation presets
 *
 * Pre-configured animation presets for springs, easings, and durations.
 */

/**
 * Spring animation presets
 */
export const springPresets = {
  gentle: {
    type: 'spring' as const,
    stiffness: 120,
    damping: 14,
    mass: 0.5,
  },
  bouncy: {
    type: 'spring' as const,
    stiffness: 260,
    damping: 20,
    mass: 0.8,
  },
  snappy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 30,
    mass: 0.5,
  },
  smooth: {
    type: 'spring' as const,
    stiffness: 100,
    damping: 20,
    mass: 1,
  },
  island: {
    type: 'spring' as const,
    stiffness: 260,
    damping: 26,
  },
  islandContent: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 25,
  },
} as const;

/**
 * Easing presets for tween animations
 */
export const easingPresets = {
  easeOut: [0.0, 0.0, 0.2, 1],
  easeIn: [0.4, 0.0, 1, 1],
  easeInOut: [0.4, 0.0, 0.2, 1],
  sharp: [0.4, 0.0, 0.6, 1],
  bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

/**
 * Duration presets in seconds
 */
export const durationPresets = {
  instant: 0,
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  slower: 0.8,
} as const;
