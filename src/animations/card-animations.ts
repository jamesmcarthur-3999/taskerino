/**
 * Card Animation System
 *
 * Specialized animation utilities and configurations for card components.
 * Provides categorized card types with appropriate animation sets.
 */

import type { Variants, Transition } from 'framer-motion';
import { springs, durations, distances, opacities, scales } from './tokens';
import type { SpringPresetName } from './types';

// ============================================================================
// CARD CATEGORIES
// ============================================================================

export type CardCategory =
  | 'primary-action'      // SessionCard, TaskCard - Full interaction suite
  | 'information'         // AchievementCard, InsightCard - Subtle hover only
  | 'media'              // ScreenshotCard, AudioSegmentCard - Lift + preview
  | 'conversational'     // Ned cards - Soft, conversational
  | 'static';            // Base Card.tsx - Minimal, content-focused

export type CardInteractionType =
  | 'clickable'
  | 'hoverable'
  | 'selectable'
  | 'static';

// ============================================================================
// CARD ENTRANCE VARIANTS
// ============================================================================

/**
 * Fade + slide up entrance for individual cards
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
 * Subtle fade entrance for information cards
 */
export const cardEntranceFadeVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
  },
  visible: {
    opacity: opacities.visible,
    transition: springs.gentle,
  },
  exit: {
    opacity: opacities.hidden,
    transition: {
      duration: durations.s.fast,
    },
  },
};

/**
 * Spring bounce entrance for playful cards
 */
export const cardEntranceBounceVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    y: distances.medium,
    scale: 0.8,
  },
  visible: {
    opacity: opacities.visible,
    y: 0,
    scale: scales.default,
    transition: springs.bouncy,
  },
  exit: {
    opacity: opacities.hidden,
    y: -distances.small,
    scale: 0.9,
    transition: {
      duration: durations.s.fast,
    },
  },
};

// ============================================================================
// CARD HOVER VARIANTS
// ============================================================================

/**
 * Lift + shadow hover for primary action cards
 */
export const cardHoverLiftVariants = {
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
 * Subtle scale + glow for secondary/information cards
 */
export const cardHoverSubtleVariants = {
  hover: {
    scale: 1.01,
    transition: springs.gentle,
  },
  tap: {
    scale: 0.99,
    transition: springs.gentle,
  },
};

/**
 * Media card hover with stronger lift
 */
export const cardHoverMediaVariants = {
  hover: {
    y: -6,
    scale: 1.03,
    transition: springs.snappy,
  },
  tap: {
    scale: 0.97,
    transition: springs.bouncy,
  },
};

/**
 * No hover effect for static cards
 */
export const cardHoverNoneVariants = {
  hover: {},
  tap: {},
};

// ============================================================================
// CARD SELECTION VARIANTS
// ============================================================================

/**
 * Selection animation for multi-select cards
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

// ============================================================================
// CARD LIST STAGGER
// ============================================================================

/**
 * Create staggered entrance for card lists
 */
export function createCardListStagger(
  staggerDelay: number = 0.05
): Variants {
  return {
    hidden: {
      opacity: opacities.hidden,
    },
    visible: {
      opacity: opacities.visible,
      transition: {
        when: 'beforeChildren',
        staggerChildren: staggerDelay,
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
}

/**
 * Card item variant for use with stagger container
 */
export const cardListItemVariants: Variants = {
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
    y: -10,
    scale: 0.95,
    transition: {
      duration: durations.s.fast,
    },
  },
};

// ============================================================================
// CARD PRESS/CLICK FEEDBACK
// ============================================================================

/**
 * Press animation for interactive cards
 */
export const cardPressVariants = {
  tap: {
    scale: 0.98,
    transition: springs.bouncy,
  },
};

/**
 * Strong press feedback for action cards
 */
export const cardPressStrongVariants = {
  tap: {
    scale: 0.96,
    transition: springs.bouncy,
  },
};

// ============================================================================
// CARD ANIMATION PRESETS BY CATEGORY
// ============================================================================

/**
 * Get animation configuration for a specific card category
 */
export function getCardAnimationConfig(category: CardCategory) {
  switch (category) {
    case 'primary-action':
      return {
        entrance: cardEntranceVariants,
        hover: cardHoverLiftVariants,
        press: cardPressVariants,
        spring: 'snappy' as SpringPresetName,
        staggerDelay: 0.06,
      };

    case 'information':
      return {
        entrance: cardEntranceFadeVariants,
        hover: cardHoverSubtleVariants,
        press: cardHoverNoneVariants,
        spring: 'gentle' as SpringPresetName,
        staggerDelay: 0.04,
      };

    case 'media':
      return {
        entrance: cardEntranceVariants,
        hover: cardHoverMediaVariants,
        press: cardPressStrongVariants,
        spring: 'snappy' as SpringPresetName,
        staggerDelay: 0.05,
      };

    case 'conversational':
      return {
        entrance: cardEntranceVariants,
        hover: cardHoverSubtleVariants,
        press: cardPressVariants,
        spring: 'gentle' as SpringPresetName,
        staggerDelay: 0.05,
      };

    case 'static':
      return {
        entrance: cardEntranceFadeVariants,
        hover: cardHoverNoneVariants,
        press: cardHoverNoneVariants,
        spring: 'smooth' as SpringPresetName,
        staggerDelay: 0.03,
      };

    default:
      return {
        entrance: cardEntranceVariants,
        hover: cardHoverSubtleVariants,
        press: cardHoverNoneVariants,
        spring: 'gentle' as SpringPresetName,
        staggerDelay: 0.05,
      };
  }
}

/**
 * Get interaction type for a card category
 */
export function getCardInteractionType(
  category: CardCategory
): CardInteractionType {
  switch (category) {
    case 'primary-action':
      return 'clickable';
    case 'media':
      return 'clickable';
    case 'information':
      return 'hoverable';
    case 'conversational':
      return 'hoverable';
    case 'static':
      return 'static';
    default:
      return 'hoverable';
  }
}

// ============================================================================
// CARD LAYOUT TRANSITION
// ============================================================================

/**
 * Layout transition for card grid/list reordering
 */
export const cardLayoutTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

// ============================================================================
// CARD EXIT VARIANTS
// ============================================================================

/**
 * Exit animation for card removal
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

/**
 * Slide out exit for card dismissal
 */
export const cardExitSlideVariants: Variants = {
  exit: {
    opacity: opacities.hidden,
    x: distances.large,
    transition: {
      duration: durations.s.normal,
    },
  },
};

// ============================================================================
// EXPORT ALL
// ============================================================================

export const cardAnimations = {
  // Entrance
  entrance: cardEntranceVariants,
  entranceFade: cardEntranceFadeVariants,
  entranceBounce: cardEntranceBounceVariants,

  // Hover
  hoverLift: cardHoverLiftVariants,
  hoverSubtle: cardHoverSubtleVariants,
  hoverMedia: cardHoverMediaVariants,
  hoverNone: cardHoverNoneVariants,

  // Press
  press: cardPressVariants,
  pressStrong: cardPressStrongVariants,

  // Selection
  selection: cardSelectionVariants,

  // List
  listItem: cardListItemVariants,

  // Exit
  exit: cardExitVariants,
  exitSlide: cardExitSlideVariants,

  // Layout
  layoutTransition: cardLayoutTransition,

  // Helpers
  createListStagger: createCardListStagger,
  getConfig: getCardAnimationConfig,
  getInteractionType: getCardInteractionType,
} as const;

export default cardAnimations;
