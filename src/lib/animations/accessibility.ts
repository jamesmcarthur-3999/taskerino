/**
 * Accessibility helpers
 *
 * Utilities for respecting user motion preferences and accessibility settings.
 */

import { useEffect, useState } from 'react';
import type { Variants } from 'framer-motion';
import { fadeInVariants } from './variants';

/**
 * Hook to detect if user prefers reduced motion
 *
 * @returns boolean indicating if reduced motion is preferred
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * Check if reduced motion is preferred (synchronous)
 */
export function shouldReduceMotion(): boolean {
  if (typeof window === 'undefined') return false;

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
}

/**
 * Get animation variant based on reduced motion preference
 *
 * @param variant - The desired animation variant
 * @param reducedMotion - Whether reduced motion is preferred
 * @returns The appropriate variant (or fade if reduced motion)
 */
export function getMotionSafeVariant(
  variant: Variants,
  reducedMotion: boolean
): Variants {
  if (reducedMotion) {
    return fadeInVariants;
  }
  return variant;
}
