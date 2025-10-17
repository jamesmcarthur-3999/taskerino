/**
 * Animation utilities
 *
 * Additional utility functions for animation orchestration and configuration.
 */

import type { Transition, Variants } from 'framer-motion';
import { springPresets, easingPresets, durationPresets } from './presets';
import { fadeInVariants } from './variants';

/**
 * Get layout transition configuration
 * Optimized for Framer Motion's layout animations
 */
export function getLayoutTransition(reducedMotion: boolean = false): Transition {
  if (reducedMotion) {
    return {
      duration: 0,
    };
  }

  return {
    type: 'spring',
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  };
}

/**
 * Layout morph transition for module repositioning
 * Used when modules change position in the grid
 */
export function createLayoutMorphTransition(
  reducedMotion: boolean = false
): Transition {
  if (reducedMotion) {
    return {
      duration: 0,
    };
  }

  return {
    layout: {
      type: 'spring',
      stiffness: 200,
      damping: 25,
      mass: 1,
    },
  };
}

/**
 * Create a custom transition combining multiple configs
 */
export function mergeTransitions(
  ...transitions: Partial<Transition>[]
): Transition {
  return Object.assign({}, ...transitions);
}

/**
 * Create variants with custom timing
 */
export function createCustomVariants(
  config: {
    from?: Record<string, number | string>;
    to?: Record<string, number | string>;
    transition?: Transition;
  } = {}
): Variants {
  const { from = {}, to = {}, transition = springPresets.gentle } = config;

  return {
    hidden: {
      opacity: 0,
      ...from,
    },
    visible: {
      opacity: 1,
      ...to,
      transition,
    },
    exit: {
      opacity: 0,
      ...from,
      transition: {
        duration: durationPresets.fast,
        ease: easingPresets.easeIn,
      },
    },
  };
}

/**
 * Orchestration helper for sequential animations
 */
export async function animateSequence(
  animations: Array<() => Promise<void>>
): Promise<void> {
  for (const animate of animations) {
    await animate();
  }
}

/**
 * Orchestration helper for parallel animations
 */
export async function animateParallel(
  animations: Array<() => Promise<void>>
): Promise<void> {
  await Promise.all(animations.map((animate) => animate()));
}
