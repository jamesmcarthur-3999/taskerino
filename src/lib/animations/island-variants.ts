/**
 * Island-specific animation variants
 *
 * Animation variants and springs specifically for the Navigation Island component.
 * These animations power the morphing transition between collapsed tabs and expanded modes.
 */

import type { Variants, Transition } from 'framer-motion';
import { shouldReduceMotion } from './accessibility';

/**
 * Spring configuration for the island expansion/collapse
 * Smooth, bouncy animation matching cubic-bezier(0.34, 1.56, 0.64, 1)
 */
export const islandSpring: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
};

/**
 * Content spring for mode content animations
 * Slightly softer than the island spring for nested content
 */
export const islandContentSpring: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

/**
 * Island container variants
 * Controls the expansion/collapse of the navigation island
 * Uses FLIP animation for smooth morphing between states
 *
 * IMPORTANT: Using explicit pixel widths instead of 'auto' to prevent
 * the island from collapsing to 0 width when content transitions.
 * The 'auto' value causes Framer Motion to measure content width,
 * which becomes nearly 0 when content is hidden during transitions.
 */
export const islandVariants: Variants = {
  collapsed: {
    width: 640, // Fixed width for collapsed state with tabs (increased from 520px to accommodate all navigation tabs with proper spacing)
    scale: 1,
  },
  expanded: {
    width: 672, // Fixed width for expanded state (max-w-2xl = 42rem = 672px)
    scale: 1,
  },
};

/**
 * Get island variants based on compact mode
 * Returns responsive widths that prevent button cutoff in non-compact mode
 *
 * @param isCompact - Whether the navigation is in compact mode
 * @returns Variants object with appropriate widths for current mode
 */
export function getIslandVariants(isCompact: boolean): Variants {
  if (isCompact) {
    return {
      collapsed: {
        width: 400, // Compact mode: Icon-only buttons with minimal spacing
        scale: 1,
      },
      expanded: {
        width: 384, // Compact expanded mode (24rem)
        scale: 1,
      },
    };
  }

  // Non-compact mode: Full width with button labels
  return {
    collapsed: {
      width: 720, // Increased from 640px to ensure all buttons with labels fit without cutoff
      scale: 1,
    },
    expanded: {
      width: 672, // Standard expanded width (max-w-2xl = 42rem = 672px)
      scale: 1,
    },
  };
}

/**
 * Mode content variants
 * Controls the entrance/exit animations for mode components
 * (Search, Task, Note, Processing, Session modes)
 *
 * Timeline:
 * - Exit: Content fades out quickly (0.15s) - overlap with tabs appearing
 * - Enter: Content fades in after container expands (0.1s delay)
 *
 * Key insight: By removing mode="wait" from AnimatePresence,
 * tabs will start appearing WHILE the mode is exiting, ensuring
 * the island always has visible content during transition.
 */
export const modeContentVariants: Variants = {
  initial: {
    opacity: 0,
    y: -10,
    scale: 0.96,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      opacity: { duration: 0.25, delay: 0.1 },
      y: { duration: 0.3, delay: 0.1 },
      scale: { duration: 0.3, delay: 0.1 },
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: {
      opacity: { duration: 0.15 },
      y: { duration: 0.15 },
      scale: { duration: 0.15 },
    },
  },
};

/**
 * Get mode content variants with reduced motion support
 * If user prefers reduced motion, returns simplified fade-only variants
 */
export function getModeContentVariants(): Variants {
  if (shouldReduceMotion()) {
    return {
      initial: { opacity: 0 },
      animate: {
        opacity: 1,
        transition: { duration: 0.2 }
      },
      exit: {
        opacity: 0,
        transition: { duration: 0.1 }
      },
    };
  }
  return modeContentVariants;
}
