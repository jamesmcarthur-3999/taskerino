/**
 * Stagger animation helpers
 *
 * Utilities for creating staggered animations across multiple elements.
 */

import type { Variants } from 'framer-motion';
import type { StaggerConfig } from './types';
import { springPresets } from './presets';

/**
 * Generate stagger animation configuration
 *
 * @param config - Stagger configuration
 * @returns Variants with stagger applied
 */
export function createStaggerVariants(config: StaggerConfig = {}): Variants {
  const {
    delayChildren = 0,
    staggerChildren = 0.1,
    staggerDirection = 1,
    when = 'beforeChildren',
  } = config;

  return {
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
  };
}

/**
 * Generate stagger variants for a list of items
 *
 * @param itemCount - Number of items
 * @param baseDelay - Base delay before first item
 * @param staggerDelay - Delay between each item
 * @returns Variants for container and items
 */
export function createListStaggerVariants(
  itemCount: number,
  baseDelay = 0,
  staggerDelay = 0.05
) {
  return {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          delayChildren: baseDelay,
          staggerChildren: staggerDelay,
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
        transition: springPresets.gentle,
      },
    },
  };
}

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
