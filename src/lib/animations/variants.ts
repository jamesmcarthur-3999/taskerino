/**
 * Animation variants
 *
 * Pre-configured Framer Motion variants for common animations.
 */

import type { Variants } from 'framer-motion';
import { springPresets, easingPresets, durationPresets } from './presets';

/**
 * Fade in from opacity 0 to 1
 */
export const fadeInVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: durationPresets.normal,
      ease: easingPresets.easeOut,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: durationPresets.fast,
      ease: easingPresets.easeIn,
    },
  },
};

/**
 * Slide in from bottom with fade
 */
export const slideUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 40,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: springPresets.gentle,
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: durationPresets.fast,
      ease: easingPresets.easeIn,
    },
  },
};

/**
 * Scale up from center with fade
 */
export const scaleUpVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springPresets.gentle,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: durationPresets.fast,
      ease: easingPresets.easeIn,
    },
  },
};

/**
 * Slide in from right
 */
export const slideInRightVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 100,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: springPresets.smooth,
  },
  exit: {
    opacity: 0,
    x: -50,
    transition: {
      duration: durationPresets.fast,
      ease: easingPresets.easeIn,
    },
  },
};

/**
 * Slide in from left
 */
export const slideInLeftVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -100,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: springPresets.smooth,
  },
  exit: {
    opacity: 0,
    x: 50,
    transition: {
      duration: durationPresets.fast,
      ease: easingPresets.easeIn,
    },
  },
};

/**
 * Bounce in with spring physics
 */
export const bounceInVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.3,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springPresets.bouncy,
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: {
      duration: durationPresets.fast,
      ease: easingPresets.easeIn,
    },
  },
};

/**
 * Map of named animation variants
 */
export const moduleAnimationVariants = {
  fade: fadeInVariants,
  slideUp: slideUpVariants,
  scaleUp: scaleUpVariants,
  slideRight: slideInRightVariants,
  slideLeft: slideInLeftVariants,
  bounce: bounceInVariants,
} as const;

export type ModuleAnimationVariantName = keyof typeof moduleAnimationVariants;
