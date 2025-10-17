import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

interface ScrollSyncOptions {
  ref: RefObject<HTMLElement>;
  scrollY: number;
  scrollProgress: number;
  transforms: {
    translateY?: (scrollY: number, progress: number) => number;
    opacity?: (scrollY: number, progress: number) => number;
    scale?: (scrollY: number, progress: number) => number;
    blur?: (scrollY: number, progress: number) => number;
  };
  enabled?: boolean;
}

/**
 * Custom hook for high-performance scroll-synchronized animations
 * Uses direct DOM manipulation to bypass React render cycle
 *
 * @example
 * ```tsx
 * const heroRef = useRef<HTMLDivElement>(null);
 * useScrollSync({
 *   ref: heroRef,
 *   scrollY,
 *   scrollProgress,
 *   transforms: {
 *     translateY: (y) => y * 0.5,
 *     opacity: (_, progress) => 1 - progress,
 *   },
 * });
 * ```
 */
export function useScrollSync({
  ref,
  scrollY,
  scrollProgress,
  transforms,
  enabled = true,
}: ScrollSyncOptions): void {
  const rafIdRef = useRef<number | null>(null);
  const willChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prefersReducedMotionRef = useRef<boolean>(false);
  const lastScrollYRef = useRef<number>(scrollY);

  // Check for prefers-reduced-motion on mount
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mediaQuery.matches;

    const handleChange = (e: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = e.matches;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const element = ref.current;

    // Early return conditions
    if (!element || !enabled || prefersReducedMotionRef.current) {
      return;
    }

    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    // Apply transformations in RAF for smooth rendering
    rafIdRef.current = requestAnimationFrame(() => {
      const transformParts: string[] = [];
      const filterParts: string[] = [];

      // Apply translateY transform
      if (transforms.translateY) {
        const value = transforms.translateY(scrollY, scrollProgress);
        transformParts.push(`translateY(${value}px)`);
      }

      // Apply scale transform
      if (transforms.scale) {
        const value = transforms.scale(scrollY, scrollProgress);
        transformParts.push(`scale(${value})`);
      }

      // Apply opacity
      if (transforms.opacity) {
        const value = transforms.opacity(scrollY, scrollProgress);
        element.style.opacity = value.toString();
      }

      // Apply blur filter
      if (transforms.blur) {
        const value = transforms.blur(scrollY, scrollProgress);
        filterParts.push(`blur(${value}px)`);
      }

      // Apply all transforms at once
      if (transformParts.length > 0) {
        element.style.transform = transformParts.join(' ');
      }

      // Apply all filters at once
      if (filterParts.length > 0) {
        element.style.filter = filterParts.join(' ');
      }

      // Dynamically manage will-change for performance
      const isScrolling = scrollY !== lastScrollYRef.current;

      if (isScrolling) {
        // Build will-change value based on active transforms
        const willChangeProperties: string[] = [];

        if (transforms.translateY || transforms.scale) {
          willChangeProperties.push('transform');
        }
        if (transforms.opacity) {
          willChangeProperties.push('opacity');
        }
        if (transforms.blur) {
          willChangeProperties.push('filter');
        }

        if (willChangeProperties.length > 0) {
          element.style.willChange = willChangeProperties.join(', ');
        }

        // Clear any existing timeout
        if (willChangeTimeoutRef.current) {
          clearTimeout(willChangeTimeoutRef.current);
        }

        // Remove will-change after scrolling stops (performance optimization)
        willChangeTimeoutRef.current = setTimeout(() => {
          if (element) {
            element.style.willChange = 'auto';
          }
        }, 150);
      }

      lastScrollYRef.current = scrollY;
    });

    // Cleanup function
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      if (willChangeTimeoutRef.current) {
        clearTimeout(willChangeTimeoutRef.current);
        willChangeTimeoutRef.current = null;
      }
    };
  }, [ref, scrollY, scrollProgress, transforms, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const element = ref.current;

      // Cancel any pending RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      // Clear timeout
      if (willChangeTimeoutRef.current) {
        clearTimeout(willChangeTimeoutRef.current);
        willChangeTimeoutRef.current = null;
      }

      // Reset styles on unmount
      if (element) {
        element.style.transform = '';
        element.style.opacity = '';
        element.style.filter = '';
        element.style.willChange = 'auto';
      }
    };
  }, [ref]);
}
