/**
 * NavigationCoordinationContext
 *
 * Centralized state management for coordinating menu button morphing and island compacting.
 *
 * Architecture:
 * - Single source of truth for navigation state
 * - Cached measurements (no constant DOM queries)
 * - Scroll-based state transitions
 * - Prevents flip-flopping with proper thresholds
 *
 * Scroll Behavior:
 * 0-100px:    Menu button inline, island full width
 * 100-250px:  Menu button morphs, island compacts if needed (TRANSITION)
 * 250px+:     Both stay in final state (NO FLIP-FLOPPING)
 */

import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { useScrollAnimation } from './ScrollAnimationContext';

// Scroll thresholds - single source of truth
const SCROLL_THRESHOLDS = {
  MENU_START: 100,    // Menu button starts morphing
  MENU_END: 250,      // Menu button fully compact
  HYSTERESIS: 10,     // Prevents flip-flopping near thresholds
} as const;

// Cached measurements
interface NavigationMeasurements {
  logoWidth: number;
  menuButtonExpandedWidth: number;
  menuButtonCompactWidth: number;
  islandFullWidth: number;
  islandCompactWidth: number;
  viewportWidth: number;
  timestamp: number;
}

// Navigation state
interface NavigationState {
  // Scroll-based state
  menuButtonPhase: 'inline' | 'transitioning' | 'compact';

  // Spatial state (calculated once per scroll phase)
  needsCompactIsland: boolean;

  // Measurements
  measurements: NavigationMeasurements | null;

  // Flags
  isCompactViewport: boolean; // Media query: viewport < 1000px
}

interface NavigationCoordinationContextType extends NavigationState {
  // Actions
  invalidateMeasurements: () => void;

  // Derived values
  isMenuButtonFixed: boolean;
  isIslandCompact: boolean;
}

const NavigationCoordinationContext = createContext<NavigationCoordinationContextType | undefined>(undefined);

// Default measurements (fallback)
const DEFAULT_MEASUREMENTS: NavigationMeasurements = {
  logoWidth: 120,
  menuButtonExpandedWidth: 400,
  menuButtonCompactWidth: 140,
  islandFullWidth: 1280,
  islandCompactWidth: 384,
  viewportWidth: 1920,
  timestamp: 0,
};

export function NavigationCoordinationProvider({ children }: { children: ReactNode }) {
  const { scrollY } = useScrollAnimation();

  // State
  const [state, setState] = useState<NavigationState>({
    menuButtonPhase: 'inline',
    needsCompactIsland: false,
    measurements: null,
    isCompactViewport: false,
  });

  // Refs
  const lastPhaseRef = useRef<'inline' | 'transitioning' | 'compact'>('inline');
  const measurementsCacheRef = useRef<NavigationMeasurements | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  /**
   * Measure all navigation elements
   * Called ONCE per layout change, not on every scroll
   */
  const measureNavigation = useCallback((): NavigationMeasurements => {
    const logoContainer = document.querySelector('[data-logo-container]') as HTMLElement;
    const navigationIsland = document.querySelector('[data-navigation-island]') as HTMLElement;

    const measurements: NavigationMeasurements = {
      logoWidth: logoContainer?.offsetWidth || DEFAULT_MEASUREMENTS.logoWidth,
      menuButtonExpandedWidth: 400, // Known value from MenuMorphPill
      menuButtonCompactWidth: 140,  // Known value from MenuMorphPill
      islandFullWidth: 1280,         // Known value from NavigationIsland
      islandCompactWidth: 384,       // Known value from NavigationIsland
      viewportWidth: window.innerWidth,
      timestamp: Date.now(),
    };

    measurementsCacheRef.current = measurements;
    return measurements;
  }, []);

  /**
   * Calculate if island needs to be compact based on available space
   * Only called when entering 'compact' phase
   */
  const calculateNeedsCompactIsland = useCallback((measurements: NavigationMeasurements): boolean => {
    const { logoWidth, menuButtonCompactWidth, islandFullWidth, viewportWidth } = measurements;

    // Calculate available space for island
    const gap = 12; // Standard gap
    const logoAndMenuWidth = logoWidth + gap + menuButtonCompactWidth + gap;
    const availableSpaceForIsland = viewportWidth - logoAndMenuWidth - gap; // Right padding

    // Island needs to compact if its full width doesn't fit
    return availableSpaceForIsland < islandFullWidth;
  }, []);

  /**
   * Invalidate measurements (e.g., on resize, layout change)
   */
  const invalidateMeasurements = useCallback(() => {
    measurementsCacheRef.current = null;
    // Force recalculation on next scroll update
    lastPhaseRef.current = 'inline'; // Reset to trigger fresh calculation
  }, []);

  /**
   * Check viewport compact mode (media query)
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1000px)');

    const updateViewportMode = () => {
      setState(prev => ({
        ...prev,
        isCompactViewport: mediaQuery.matches,
      }));
    };

    updateViewportMode();
    mediaQuery.addEventListener('change', updateViewportMode);

    return () => mediaQuery.removeEventListener('change', updateViewportMode);
  }, []);

  /**
   * Main scroll-driven state machine
   * Updates menu button phase and calculates spatial constraints
   */
  useEffect(() => {
    // Determine menu button phase based on scroll position
    let newPhase: 'inline' | 'transitioning' | 'compact';

    if (scrollY < SCROLL_THRESHOLDS.MENU_START - SCROLL_THRESHOLDS.HYSTERESIS) {
      newPhase = 'inline';
    } else if (scrollY >= SCROLL_THRESHOLDS.MENU_START && scrollY < SCROLL_THRESHOLDS.MENU_END) {
      newPhase = 'transitioning';
    } else if (scrollY >= SCROLL_THRESHOLDS.MENU_END) {
      newPhase = 'compact';
    } else {
      // In hysteresis zone - maintain current phase
      newPhase = lastPhaseRef.current;
    }

    // Only update if phase changed (prevents constant recalculation)
    if (newPhase !== lastPhaseRef.current) {
      lastPhaseRef.current = newPhase;

      // Get or create measurements
      const measurements = measurementsCacheRef.current || measureNavigation();

      // Calculate spatial constraints when entering transitioning OR compact phase
      // Once compact is needed, KEEP IT until we go back to inline
      let needsCompactIsland = state.needsCompactIsland; // Preserve current state

      if (newPhase === 'transitioning' || newPhase === 'compact') {
        // Calculate if we need compact (only if not already set)
        if (!needsCompactIsland) {
          needsCompactIsland = calculateNeedsCompactIsland(measurements);
        }
      } else if (newPhase === 'inline') {
        // Reset compact state when fully scrolled back to top
        needsCompactIsland = false;
      }

      setState(prev => ({
        ...prev,
        menuButtonPhase: newPhase,
        needsCompactIsland,
        measurements,
      }));
    }
  }, [scrollY, state.needsCompactIsland, measureNavigation, calculateNeedsCompactIsland]);

  /**
   * Handle window resize
   * Invalidate measurements and recalculate
   */
  useEffect(() => {
    let rafId: number | null = null;

    const handleResize = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        invalidateMeasurements();
        rafId = null;
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [invalidateMeasurements]);

  // Derived values
  const isMenuButtonFixed = state.menuButtonPhase !== 'inline';
  const isIslandCompact = state.isCompactViewport || state.needsCompactIsland;

  const value: NavigationCoordinationContextType = {
    ...state,
    invalidateMeasurements,
    isMenuButtonFixed,
    isIslandCompact,
  };

  return (
    <NavigationCoordinationContext.Provider value={value}>
      {children}
    </NavigationCoordinationContext.Provider>
  );
}

export const useNavigationCoordination = () => {
  const context = useContext(NavigationCoordinationContext);
  if (!context) {
    throw new Error('useNavigationCoordination must be used within NavigationCoordinationProvider');
  }
  return context;
};
