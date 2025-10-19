import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useMotionValue, type MotionValue } from 'framer-motion';
import { scrollProgressEasing, clamp } from '../utils/easing';

interface ScrollState {
  scrollY: number;
  scrollProgress: number;
  isScrolled: boolean;
  direction: 'up' | 'down' | null;
  velocity: number;
  smoothVelocity: number; // Smoothed velocity for better animation quality
}

interface ScrollAnimationContextType extends ScrollState {
  scrollYMotionValue: MotionValue<number>;
  scrollProgressMotionValue: MotionValue<number>;
  registerScrollContainer: (ref: HTMLElement | null) => void;
  unregisterScrollContainer: (ref: HTMLElement | null) => void;
  resetScroll: () => void;
}

const ScrollAnimationContext = createContext<ScrollAnimationContextType | undefined>(undefined);

const SCROLL_THRESHOLD = 150; // Pixels to consider "scrolled"
const SCROLL_RANGE = 300; // Total range for 0-1 progress
const VELOCITY_SMOOTHING = 0.15; // Lower = smoother, higher = more responsive (0-1)

export function ScrollAnimationProvider({ children }: { children: ReactNode }) {
  const [scrollState, setScrollState] = useState<ScrollState>({
    scrollY: 0,
    scrollProgress: 0,
    isScrolled: false,
    direction: null,
    velocity: 0,
    smoothVelocity: 0,
  });

  // Create MotionValues for Framer Motion integration
  const scrollYMotionValue = useMotionValue(0);
  const scrollProgressMotionValue = useMotionValue(0);

  const scrollContainersRef = useRef<Set<HTMLElement>>(new Set());
  const lastScrollYRef = useRef(0);
  const lastScrollTimeRef = useRef(Date.now());
  const tickingRef = useRef(false);
  const smoothVelocityRef = useRef(0); // Track smooth velocity for exponential smoothing

  const registerScrollContainer = useCallback((ref: HTMLElement | null) => {
    if (!ref) return;
    scrollContainersRef.current.add(ref);
  }, []);

  const unregisterScrollContainer = useCallback((ref: HTMLElement | null) => {
    if (!ref) return;
    scrollContainersRef.current.delete(ref);
  }, []);

  const resetScroll = useCallback(() => {
    // Reset all scroll containers to top
    scrollContainersRef.current.forEach(container => {
      container.scrollTop = 0;
    });

    // Reset scroll state immediately
    setScrollState({
      scrollY: 0,
      scrollProgress: 0,
      isScrolled: false,
      direction: null,
      velocity: 0,
      smoothVelocity: 0,
    });

    // Reset MotionValues
    scrollYMotionValue.set(0);
    scrollProgressMotionValue.set(0);

    // Reset refs
    lastScrollYRef.current = 0;
    lastScrollTimeRef.current = Date.now();
    smoothVelocityRef.current = 0;
  }, [scrollYMotionValue, scrollProgressMotionValue]);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;

      // Only process scroll events from registered containers
      if (!scrollContainersRef.current.has(target)) return;

      const currentScrollY = target.scrollTop;
      const currentTime = Date.now();

      if (!tickingRef.current) {
        requestAnimationFrame(() => {
          const timeDelta = currentTime - lastScrollTimeRef.current;
          const scrollDelta = currentScrollY - lastScrollYRef.current;

          // Calculate raw velocity (pixels per millisecond)
          const rawVelocity = timeDelta > 0 ? Math.abs(scrollDelta / timeDelta) : 0;

          // Apply exponential smoothing for velocity
          // This creates a more stable velocity value that doesn't jump around
          const smoothVelocity = smoothVelocityRef.current +
            VELOCITY_SMOOTHING * (rawVelocity - smoothVelocityRef.current);
          smoothVelocityRef.current = smoothVelocity;

          // Calculate raw progress (0 to 1 over SCROLL_RANGE)
          const rawProgress = clamp(currentScrollY / SCROLL_RANGE, 0, 1);

          // Apply easing to progress for smoother feel
          const easedProgress = scrollProgressEasing(rawProgress);

          // Determine direction
          const direction = scrollDelta > 0 ? 'down' : scrollDelta < 0 ? 'up' : scrollState.direction;

          // Update state
          setScrollState({
            scrollY: currentScrollY,
            scrollProgress: easedProgress,
            isScrolled: currentScrollY > SCROLL_THRESHOLD,
            direction,
            velocity: rawVelocity,
            smoothVelocity,
          });

          // Update MotionValues in the same RAF callback for performance
          scrollYMotionValue.set(currentScrollY);
          scrollProgressMotionValue.set(easedProgress);

          lastScrollYRef.current = currentScrollY;
          lastScrollTimeRef.current = currentTime;
          tickingRef.current = false;
        });

        tickingRef.current = true;
      }
    };

    // Add event listener with capture phase to catch all scroll events
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  return (
    <ScrollAnimationContext.Provider
      value={{
        ...scrollState,
        scrollYMotionValue,
        scrollProgressMotionValue,
        registerScrollContainer,
        unregisterScrollContainer,
        resetScroll,
      }}
    >
      {children}
    </ScrollAnimationContext.Provider>
  );
}

export const useScrollAnimation = () => {
  const context = useContext(ScrollAnimationContext);
  if (!context) {
    throw new Error('useScrollAnimation must be used within a ScrollAnimationProvider');
  }
  return context;
};
