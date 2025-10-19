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
// MODAL VARIANTS
// ============================================================================

/**
 * Modal backdrop fade variants
 * Used for all modal overlays with different speeds based on modal type
 */
export const modalBackdropVariants = {
  // Fast backdrop for critical confirmations (200ms)
  critical: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.2, ease: easings.easeOut as any },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.15, ease: easings.easeIn as any },
    },
  },
  // Standard backdrop for most modals (250ms)
  standard: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.25, ease: easings.easeOut as any },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2, ease: easings.easeIn as any },
    },
  },
  // Smooth backdrop for content viewers (300ms)
  smooth: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.3, ease: easings.smooth as any },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.25, ease: easings.easeIn as any },
    },
  },
  // Gentle backdrop for info/help modals (300ms soft)
  gentle: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.3, ease: easings.gentle as any },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.25, ease: easings.easeOut as any },
    },
  },
  // Slow backdrop for immersive experiences (400ms)
  immersive: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.4, ease: easings.gentle as any },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.3, ease: easings.easeOut as any },
    },
  },
} as const;

/**
 * Modal confirmation variants
 * Sharp, attention-grabbing animations for critical confirmations
 * Includes slight bounce for urgency
 */
export const modalConfirmationVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springs.bouncy, // Slight overshoot for attention
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -5,
    transition: springs.snappy, // Quick dismissal
  },
};

/**
 * Modal content viewer variants
 * Smooth, elegant animations for viewing content (screenshots, images, etc.)
 */
export const modalContentViewerVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springs.smooth,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -10,
    transition: springs.gentle,
  },
};

/**
 * Modal form variants
 * Professional, focused animations for forms (QuickTask, QuickNote, etc.)
 * Includes subtle slide-up for context
 */
export const modalFormVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 40,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: springs.gentle,
  },
  exit: {
    opacity: 0,
    y: 20,
    transition: springs.snappy,
  },
};

/**
 * Modal info/help variants
 * Friendly, inviting animations for onboarding and help content
 */
export const modalInfoVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springs.smooth,
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.99,
    transition: springs.smooth,
  },
};

/**
 * Modal experience variants
 * Immersive, staged animations for full experiences (enrichment, progress, etc.)
 * Uses fade-only to avoid distraction from content
 */
export const modalExperienceVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: easings.gentle as any,
    },
  },
  exit: {
    opacity: 0,
    transition: springs.gentle,
  },
};

/**
 * Modal settings variants
 * Professional, utility-focused animations for settings and configuration
 */
export const modalSettingsVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 30,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springs.gentle,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 15,
    transition: springs.snappy,
  },
};

/**
 * Modal stagger variants for multi-section modals
 * Used with stagger containers to animate header → body → footer
 */
export const modalStaggerContainerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.05, // 50ms stagger
      delayChildren: 0,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      when: 'afterChildren',
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

/**
 * Modal section variants (header, body, footer)
 * Used as children of stagger container
 */
export const modalSectionVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: springs.gentle,
  },
  exit: {
    opacity: 0,
    y: -5,
    transition: springs.snappy,
  },
};

/**
 * Helper: Create coordinated backdrop + content animation
 * Returns both backdrop and content variants for a specific modal type
 */
export function createModalAnimationVariants(type: 'confirmation' | 'content' | 'form' | 'info' | 'experience' | 'settings') {
  const backdropVariants = {
    confirmation: modalBackdropVariants.critical,
    content: modalBackdropVariants.smooth,
    form: modalBackdropVariants.standard,
    info: modalBackdropVariants.gentle,
    experience: modalBackdropVariants.immersive,
    settings: modalBackdropVariants.standard,
  };

  const contentVariants = {
    confirmation: modalConfirmationVariants,
    content: modalContentViewerVariants,
    form: modalFormVariants,
    info: modalInfoVariants,
    experience: modalExperienceVariants,
    settings: modalSettingsVariants,
  };

  return {
    backdrop: backdropVariants[type],
    content: contentVariants[type],
  };
}

// ============================================================================
// CARD VARIANTS
// ============================================================================

/**
 * Card entrance with slide + fade
 */
export const cardEntranceVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    y: distances.small,
    scale: 0.95,
  },
  visible: {
    opacity: opacities.visible,
    y: 0,
    scale: scales.default,
    transition: springs.smooth,
  },
  exit: {
    opacity: opacities.hidden,
    y: -distances.small,
    scale: 0.95,
    transition: {
      duration: durations.s.fast,
    },
  },
};

/**
 * Card hover lift animation
 */
export const cardHoverVariants = {
  hover: {
    y: -4,
    scale: 1.02,
    transition: springs.snappy,
  },
  tap: {
    scale: 0.98,
    transition: springs.snappy,
  },
};

/**
 * Card press feedback
 */
export const cardPressVariants = {
  tap: {
    scale: 0.98,
    transition: springs.bouncy,
  },
};

/**
 * Card selection state
 */
export const cardSelectionVariants: Variants = {
  unselected: {
    scale: scales.default,
    opacity: opacities.visible,
  },
  selected: {
    scale: 1.01,
    opacity: opacities.visible,
    transition: springs.gentle,
  },
};

/**
 * Card exit animation
 */
export const cardExitVariants: Variants = {
  exit: {
    opacity: opacities.hidden,
    scale: 0.9,
    y: -distances.small,
    transition: {
      duration: durations.s.fast,
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

  // Modal
  modalBackdrop: modalBackdropVariants,
  modalConfirmation: modalConfirmationVariants,
  modalContentViewer: modalContentViewerVariants,
  modalForm: modalFormVariants,
  modalInfo: modalInfoVariants,
  modalExperience: modalExperienceVariants,
  modalSettings: modalSettingsVariants,
  modalStaggerContainer: modalStaggerContainerVariants,
  modalSection: modalSectionVariants,

  // Card-specific
  cardEntrance: cardEntranceVariants,
  cardHover: cardHoverVariants,
  cardPress: cardPressVariants,
  cardSelection: cardSelectionVariants,
  cardExit: cardExitVariants,
} as const;

export default variants;
