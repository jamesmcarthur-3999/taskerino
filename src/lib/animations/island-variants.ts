/**
 * Island-specific animation variants
 *
 * Animation variants and springs specifically for the Navigation Island component.
 */

import type { Variants, Transition } from 'framer-motion';

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
  damping: 25,
};

/**
 * Island container variants
 * Controls the expansion/collapse of the navigation island
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
 * Mode content variants
 * Controls the entrance/exit animations for mode components
 * (Search, Task, Note, Processing, Session modes)
 */
export const modeContentVariants: Variants = {
  initial: {
    opacity: 0,
    y: -8,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.98,
  },
};
