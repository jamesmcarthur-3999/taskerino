/**
 * useCompactNavigation Hook
 *
 * SIMPLIFIED for Option C - no coordination context needed
 * Uses media query only to determine compact mode
 */

import { useEffect, useState } from 'react';

export const useCompactNavigation = () => {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1000px)');

    const updateCompactState = (matches: boolean) => {
      setIsCompact(matches);
    };

    // Set initial state
    updateCompactState(mediaQuery.matches);

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => updateCompactState(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isCompact;
};
