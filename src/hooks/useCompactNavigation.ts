/**
 * useCompactNavigation Hook
 *
 * REFACTORED to use NavigationCoordinationContext
 *
 * No more:
 * - Constant DOM measurements on every scroll
 * - Flip-flopping between states
 * - Uncoordinated animations
 *
 * Now:
 * - Single source of truth from context
 * - Cached measurements
 * - Coordinated with menu button morphing
 */

import { useNavigationCoordination } from '../contexts/NavigationCoordinationContext';

export const useCompactNavigation = () => {
  const { isIslandCompact } = useNavigationCoordination();
  return isIslandCompact;
};
