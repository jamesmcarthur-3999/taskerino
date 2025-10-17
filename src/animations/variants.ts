/**
 * Animation System - Variants
 *
 * Reusable Framer Motion variant configurations for consistent animations
 * across the application.
 */

import type { Variants } from 'framer-motion';
import { durations, easings, springs, distances, opacities, scales, islandAnimation } from './tokens';
import type {
  AnimationDirection,
  FadeVariantConfig,
  SlideVariantConfig,
  ScaleVariantConfig,
  InteractionVariantConfig,
  ModuleVariantName,
} from './types';

// ============================================================================
// FADE VARIANTS
// ============================================================================

/**
 * Simple fade in/out animation
 */
export const fadeVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
  },
  visible: {
    opacity: opacities.visible,
    transition: {
      duration: durations.s.normal,
      ease: [0.4, 0, 0.2, 1] as any,
    },
  },
  exit: {
    opacity: opacities.hidden,
    transition: {
      duration: durations.s.fast,
      ease: [0.4, 0, 1, 1] as any,
    },
  },
};

/**
 * Fade with custom configuration
 */
export function createFadeVariants(config: FadeVariantConfig = {}): Variants {
  const {
    duration = durations.s.normal,
    delay = 0,
    ease = easings.easeOut,
  } = config;

  return {
    hidden: { opacity: opacities.hidden },
    visible: {
      opacity: opacities.visible,
      transition: { duration, delay, ease: ease as any },
    },
    exit: {
      opacity: opacities.hidden,
      transition: { duration: durations.s.fast, ease: easings.easeIn as any },
    },
  };
}

// ============================================================================
// SLIDE VARIANTS
// ============================================================================

/**
 * Slide up animation
 */
export const slideUpVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    y: distances.medium,
  },
  visible: {
    opacity: opacities.visible,
    y: 0,
    transition: springs.gentle,
  },
  exit: {
    opacity: opacities.hidden,
    y: -distances.small,
    transition: {
      duration: durations.s.fast,
      ease: easings.easeIn as any,
    },
  },
};

/**
 * Slide down animation
 */
export const slideDownVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    y: -distances.medium,
  },
  visible: {
    opacity: opacities.visible,
    y: 0,
    transition: springs.gentle,
  },
  exit: {
    opacity: opacities.hidden,
    y: distances.small,
    transition: {
      duration: durations.s.fast,
      ease: easings.easeIn as any,
    },
  },
};

/**
 * Slide left animation
 */
export const slideLeftVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    x: distances.large,
  },
  visible: {
    opacity: opacities.visible,
    x: 0,
    transition: springs.smooth,
  },
  exit: {
    opacity: opacities.hidden,
    x: -distances.small,
    transition: {
      duration: durations.s.fast,
      ease: easings.easeIn as any,
    },
  },
};

/**
 * Slide right animation
 */
export const slideRightVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    x: -distances.large,
  },
  visible: {
    opacity: opacities.visible,
    x: 0,
    transition: springs.smooth,
  },
  exit: {
    opacity: opacities.hidden,
    x: distances.small,
    transition: {
      duration: durations.s.fast,
      ease: easings.easeIn as any,
    },
  },
};

/**
 * Create slide variants with custom configuration
 */
export function createSlideVariants(config: SlideVariantConfig = {}): Variants {
  const {
    direction = 'up',
    distance = distances.medium,
    spring = 'gentle',
  } = config;

  const directionMap = {
    up: { axis: 'y', value: distance },
    down: { axis: 'y', value: -distance },
    left: { axis: 'x', value: distance },
    right: { axis: 'x', value: -distance },
  };

  const { axis, value } = directionMap[direction];

  return {
    hidden: {
      opacity: opacities.hidden,
      [axis]: value,
    } as any,
    visible: {
      opacity: opacities.visible,
      [axis]: 0,
      transition: springs[spring],
    } as any,
    exit: {
      opacity: opacities.hidden,
      [axis]: -value / 2,
      transition: {
        duration: durations.s.fast,
        ease: easings.easeIn as any,
      },
    } as any,
  };
}

// ============================================================================
// SCALE VARIANTS
// ============================================================================

/**
 * Scale up animation
 */
export const scaleUpVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    scale: 0.9,
  },
  visible: {
    opacity: opacities.visible,
    scale: scales.default,
    transition: springs.gentle,
  },
  exit: {
    opacity: opacities.hidden,
    scale: 0.95,
    transition: {
      duration: durations.s.fast,
      ease: easings.easeIn as any,
    },
  },
};

/**
 * Scale down animation
 */
export const scaleDownVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    scale: 1.1,
  },
  visible: {
    opacity: opacities.visible,
    scale: scales.default,
    transition: springs.gentle,
  },
  exit: {
    opacity: opacities.hidden,
    scale: 1.05,
    transition: {
      duration: durations.s.fast,
      ease: easings.easeIn as any,
    },
  },
};

/**
 * Bounce in animation
 */
export const bounceVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    scale: 0.3,
  },
  visible: {
    opacity: opacities.visible,
    scale: scales.default,
    transition: springs.bouncy,
  },
  exit: {
    opacity: opacities.hidden,
    scale: 0.8,
    transition: {
      duration: durations.s.fast,
      ease: easings.easeIn as any,
    },
  },
};

/**
 * Create scale variants with custom configuration
 */
export function createScaleVariants(config: ScaleVariantConfig = {}): Variants {
  const {
    from = 0.9,
    to = scales.default,
    spring = 'gentle',
  } = config;

  return {
    hidden: {
      opacity: opacities.hidden,
      scale: from,
    },
    visible: {
      opacity: opacities.visible,
      scale: to,
      transition: springs[spring],
    },
    exit: {
      opacity: opacities.hidden,
      scale: from + (to - from) / 2,
      transition: {
        duration: durations.s.fast,
        ease: easings.easeIn as any,
      },
    },
  };
}

// ============================================================================
// STAGGER VARIANTS
// ============================================================================

/**
 * Stagger container variant
 */
export const staggerContainerVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
  },
  visible: {
    opacity: opacities.visible,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.05,
      delayChildren: 0,
    },
  },
  exit: {
    opacity: opacities.hidden,
    transition: {
      when: 'afterChildren',
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

/**
 * List item variant (used with stagger container)
 */
export const listItemVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    y: distances.small,
    scale: 0.95,
  },
  visible: {
    opacity: opacities.visible,
    y: 0,
    scale: scales.default,
    transition: springs.gentle,
  },
  exit: {
    opacity: opacities.hidden,
    y: -10,
    scale: 0.95,
    transition: {
      duration: durations.s.fast,
      ease: easings.easeIn as any,
    },
  },
};

// ============================================================================
// ISLAND VARIANTS
// ============================================================================

/**
 * Navigation Island container variants
 * Migrated from TopNavigation/utils/islandAnimations.ts
 */
export const islandVariants: Variants = {
  collapsed: {
    width: 'auto',
  },
  expanded: {
    width: '100%',
  },
};

/**
 * Mode content variants for navigation island
 * Controls entrance/exit animations for mode components
 */
export const modeContentVariants: Variants = {
  initial: {
    opacity: opacities.hidden,
    y: islandAnimation.modeContent.offsetY,
  },
  animate: {
    opacity: opacities.visible,
    y: 0,
  },
  exit: {
    opacity: opacities.hidden,
    y: islandAnimation.modeContent.exitOffsetY,
    scale: islandAnimation.modeContent.exitScale,
  },
};

// ============================================================================
// MODULE VARIANTS
// ============================================================================

/**
 * Module animation variants map
 * Consolidated from morphing-canvas/animations/transitions.ts
 */
export const moduleVariants: Record<ModuleVariantName, Variants> = {
  fade: fadeVariants,
  slideUp: slideUpVariants,
  slideDown: slideDownVariants,
  slideLeft: slideLeftVariants,
  slideRight: slideRightVariants,
  scaleUp: scaleUpVariants,
  scaleDown: scaleDownVariants,
  bounce: bounceVariants,
  none: {
    hidden: {},
    visible: {},
    exit: {},
  },
};

/**
 * Get module variant by name
 */
export function getModuleVariant(name: ModuleVariantName): Variants {
  return moduleVariants[name];
}

// ============================================================================
// INTERACTION VARIANTS
// ============================================================================

/**
 * Button hover/tap variants
 */
export const buttonInteractionVariants = {
  hover: {
    scale: scales.hover.button,
    transition: springs.snappy,
  },
  tap: {
    scale: scales.tap.button,
    transition: springs.snappy,
  },
};

/**
 * Icon button hover/tap variants
 */
export const iconButtonInteractionVariants = {
  hover: {
    scale: scales.hover.iconButton,
    transition: springs.snappy,
  },
  tap: {
    scale: scales.tap.iconButton,
    transition: springs.snappy,
  },
};

/**
 * Card hover/tap variants
 */
export const cardInteractionVariants = {
  hover: {
    scale: scales.hover.card,
    transition: springs.gentle,
  },
  tap: {
    scale: scales.tap.card,
    transition: springs.gentle,
  },
};

/**
 * Subtle hover/tap variants
 */
export const subtleInteractionVariants = {
  hover: {
    scale: scales.hover.subtle,
    transition: springs.smooth,
  },
  tap: {
    scale: scales.tap.subtle,
    transition: springs.smooth,
  },
};

/**
 * Create custom interaction variants
 */
export function createInteractionVariants(config: InteractionVariantConfig = {}) {
  const {
    hover = { scale: scales.hover.button },
    tap = { scale: scales.tap.button },
    whileHover,
    whileTap,
    whileFocus,
  } = config;

  return {
    whileHover: whileHover || {
      scale: hover.scale,
      transition: hover.transition || springs.snappy,
    },
    whileTap: whileTap || {
      scale: tap.scale,
      transition: tap.transition || springs.snappy,
    },
    whileFocus: whileFocus || {},
  };
}

// ============================================================================
// COMBINED VARIANTS
// ============================================================================

/**
 * Slide and scale combined
 */
export const slideScaleVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    y: distances.medium,
    scale: 0.95,
  },
  visible: {
    opacity: opacities.visible,
    y: 0,
    scale: scales.default,
    transition: springs.gentle,
  },
  exit: {
    opacity: opacities.hidden,
    y: -distances.small,
    scale: 0.95,
    transition: {
      duration: durations.s.fast,
      ease: easings.easeIn as any,
    },
  },
};

/**
 * Slide with blur
 */
export const slideBlurVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    y: distances.medium,
    filter: 'blur(8px)',
  },
  visible: {
    opacity: opacities.visible,
    y: 0,
    filter: 'blur(0px)',
    transition: springs.gentle,
  },
  exit: {
    opacity: opacities.hidden,
    y: -distances.small,
    filter: 'blur(4px)',
    transition: {
      duration: durations.s.fast,
      ease: easings.easeIn as any,
    },
  },
};

// ============================================================================
// EXPORT ALL VARIANTS
// ============================================================================

export const variants = {
  // Basic
  fade: fadeVariants,
  slideUp: slideUpVariants,
  slideDown: slideDownVariants,
  slideLeft: slideLeftVariants,
  slideRight: slideRightVariants,
  scaleUp: scaleUpVariants,
  scaleDown: scaleDownVariants,
  bounce: bounceVariants,

  // Stagger
  staggerContainer: staggerContainerVariants,
  listItem: listItemVariants,

  // Island
  island: islandVariants,
  modeContent: modeContentVariants,

  // Module
  module: moduleVariants,

  // Interaction
  buttonInteraction: buttonInteractionVariants,
  iconButtonInteraction: iconButtonInteractionVariants,
  cardInteraction: cardInteractionVariants,
  subtleInteraction: subtleInteractionVariants,

  // Combined
  slideScale: slideScaleVariants,
  slideBlur: slideBlurVariants,
} as const;

export default variants;
