/**
 * Animation System - Hooks
 *
 * Custom React hooks for managing animations throughout the application.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import type {
  ScrollAnimationConfig,
  ScrollProgressConfig,
  FLIPState,
  OrchestrationConfig,
  LayoutTransitionConfig,
  StaggerConfig,
} from './types';
import { durations, springs, layoutSprings } from './tokens';
import { fadeVariants } from './variants';
import type { Variants, Transition } from 'framer-motion';

// ============================================================================
// REDUCED MOTION
// ============================================================================

/**
 * Hook to detect if user prefers reduced motion
 * Consolidated from existing implementations
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
 * Hook to get motion-safe variants
 * Returns fade variants if reduced motion is preferred
 */
export function useMotionSafeVariants(variants: Variants): Variants {
  const reducedMotion = useReducedMotion();
  return reducedMotion ? fadeVariants : variants;
}

// ============================================================================
// LAYOUT TRANSITION
// ============================================================================

/**
 * Hook to get layout transition configuration
 * Respects reduced motion preference
 */
export function useLayoutTransition(
  config: LayoutTransitionConfig = {}
): Transition {
  const reducedMotion = useReducedMotion();
  const { type = 'spring', duration, bounce } = config;

  if (reducedMotion) {
    return { duration: 0 };
  }

  if (type === 'spring') {
    return {
      ...layoutSprings.default,
      ...(bounce !== undefined && { bounce }),
    };
  }

  return {
    type: 'tween',
    duration: duration || durations.s.normal,
  };
}

// ============================================================================
// STAGGERED CHILDREN
// ============================================================================

/**
 * Hook to manage staggered children animations
 * Returns controls and state for coordinated animations
 */
export function useStaggeredChildren(config: StaggerConfig = {}) {
  const [isAnimating, setIsAnimating] = useState(false);
  const reducedMotion = useReducedMotion();

  const {
    delayChildren = 0,
    staggerChildren = 0.05,
    staggerDirection = 1,
  } = config;

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: 'beforeChildren',
        delayChildren: reducedMotion ? 0 : delayChildren,
        staggerChildren: reducedMotion ? 0 : staggerChildren,
        staggerDirection,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: reducedMotion ? { duration: 0 } : springs.gentle,
    },
  };

  return {
    containerVariants,
    itemVariants,
    isAnimating,
    setIsAnimating,
  };
}

// ============================================================================
// SCROLL ANIMATION
// ============================================================================

/**
 * Hook to trigger animations based on scroll position
 * Uses Framer Motion's useInView
 */
export function useScrollAnimation(config: ScrollAnimationConfig = {}) {
  const {
    threshold = 0.1,
    once = true,
    amount = 'some',
    margin = '0px',
  } = config;

  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, {
    once,
    amount,
    margin: margin as any,
  });

  return { ref, isInView };
}

// ============================================================================
// SCROLL PROGRESS
// ============================================================================

/**
 * Hook to track scroll progress
 * Returns a motion value between 0 and 1
 */
export function useScrollProgress(config: ScrollProgressConfig = {}): {
  scrollYProgress: MotionValue<number>;
  scrollY: MotionValue<number>;
} {
  const { target, offset = ['start end', 'end start'], container } = config;

  const { scrollYProgress, scrollY } = useScroll({
    target: target || undefined,
    offset: offset as any,
    container: container || undefined,
  });

  return { scrollYProgress, scrollY };
}

/**
 * Hook to create a smooth scroll progress value
 * Uses spring physics for smoother animations
 */
export function useSmoothScrollProgress(
  config: ScrollProgressConfig = {}
): MotionValue<number> {
  const { scrollYProgress } = useScrollProgress(config);
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return smoothProgress;
}

// ============================================================================
// FLIP ANIMATION
// ============================================================================

/**
 * Hook to perform FLIP animations
 * Returns helpers for managing FLIP transitions
 */
export function useFLIPAnimation() {
  const [isAnimating, setIsAnimating] = useState(false);
  const firstRectRef = useRef<DOMRect | null>(null);

  /**
   * Capture the initial (First) position
   */
  const captureFirst = useCallback((element: HTMLElement) => {
    firstRectRef.current = element.getBoundingClientRect();
  }, []);

  /**
   * Calculate FLIP state
   */
  const calculateFLIP = useCallback(
    (element: HTMLElement): FLIPState | null => {
      if (!firstRectRef.current) return null;

      const lastRect = element.getBoundingClientRect();
      const firstRect = firstRectRef.current;

      return {
        first: firstRect,
        last: lastRect,
        invert: {
          x: firstRect.left - lastRect.left,
          y: firstRect.top - lastRect.top,
          scaleX: firstRect.width / lastRect.width,
          scaleY: firstRect.height / lastRect.height,
        },
      };
    },
    []
  );

  /**
   * Apply FLIP animation
   */
  const applyFLIP = useCallback(
    async (
      element: HTMLElement,
      flipState: FLIPState,
      transition = springs.smooth
    ): Promise<void> => {
      setIsAnimating(true);
      const { invert } = flipState;

      // Invert
      element.style.transform = `translate(${invert.x}px, ${invert.y}px) scale(${invert.scaleX}, ${invert.scaleY})`;
      element.style.transformOrigin = 'top left';

      // Force reflow
      element.offsetHeight;

      // Play
      const animation = element.animate(
        [
          {
            transform: `translate(${invert.x}px, ${invert.y}px) scale(${invert.scaleX}, ${invert.scaleY})`,
          },
          {
            transform: 'translate(0, 0) scale(1, 1)',
          },
        ],
        {
          duration: ((transition as any).duration || 0.3) * 1000,
          easing: 'ease-out',
          fill: 'both',
        }
      );

      await animation.finished;
      setIsAnimating(false);
    },
    []
  );

  /**
   * Perform complete FLIP transition
   */
  const performFLIP = useCallback(
    async (
      element: HTMLElement,
      callback: () => void | Promise<void>,
      transition = springs.smooth
    ): Promise<void> => {
      // First
      captureFirst(element);

      // Execute change
      await callback();

      // Last, Invert, Play
      const flipState = calculateFLIP(element);
      if (flipState) {
        await applyFLIP(element, flipState, transition);
      }
    },
    [captureFirst, calculateFLIP, applyFLIP]
  );

  return {
    isAnimating,
    captureFirst,
    calculateFLIP,
    applyFLIP,
    performFLIP,
  };
}

// ============================================================================
// ANIMATION ORCHESTRATION
// ============================================================================

/**
 * Hook to orchestrate complex animation sequences
 * Supports sequential, parallel, and staggered execution
 */
export function useOrchestration() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(
    new Set()
  );

  /**
   * Execute orchestration sequence
   */
  const execute = useCallback(
    async (config: OrchestrationConfig): Promise<void> => {
      const { mode, steps, onComplete, onStepComplete } = config;
      setIsRunning(true);
      setCompletedSteps(new Set());

      try {
        if (mode === 'sequence') {
          // Sequential execution
          for (const step of steps) {
            setCurrentStepId(step.id);
            if (step.delay) {
              await new Promise((resolve) =>
                setTimeout(resolve, step.delay)
              );
            }
            await step.animate();
            setCompletedSteps((prev) => new Set([...prev, step.id]));
            onStepComplete?.(step.id);
          }
        } else if (mode === 'parallel') {
          // Parallel execution
          await Promise.all(
            steps.map(async (step) => {
              setCurrentStepId(step.id);
              if (step.delay) {
                await new Promise((resolve) =>
                  setTimeout(resolve, step.delay)
                );
              }
              await step.animate();
              setCompletedSteps((prev) => new Set([...prev, step.id]));
              onStepComplete?.(step.id);
            })
          );
        } else if (mode === 'stagger') {
          // Staggered execution
          const staggerDelay = 50; // Default stagger delay
          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            setTimeout(async () => {
              setCurrentStepId(step.id);
              if (step.delay) {
                await new Promise((resolve) =>
                  setTimeout(resolve, step.delay)
                );
              }
              await step.animate();
              setCompletedSteps((prev) => new Set([...prev, step.id]));
              onStepComplete?.(step.id);
            }, i * staggerDelay);
          }
        }

        onComplete?.();
      } finally {
        setIsRunning(false);
        setCurrentStepId(null);
      }
    },
    []
  );

  /**
   * Reset orchestration state
   */
  const reset = useCallback(() => {
    setIsRunning(false);
    setCurrentStepId(null);
    setCompletedSteps(new Set());
  }, []);

  return {
    isRunning,
    currentStepId,
    completedSteps,
    execute,
    reset,
  };
}

// ============================================================================
// CONTROLLED ANIMATION
// ============================================================================

/**
 * Hook to control animations manually
 * Returns play, pause, reset controls
 */
export function useControlledAnimation() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [variant, setVariant] = useState<string>('hidden');

  const play = useCallback(() => {
    setIsPlaying(true);
    setVariant('visible');
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setVariant('hidden');
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  return {
    isPlaying,
    variant,
    play,
    pause,
    reset,
    toggle,
    setVariant,
  };
}

// ============================================================================
// MOUSE POSITION
// ============================================================================

/**
 * Hook to track mouse position for parallax effects
 */
export function useMousePosition() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({
        x: event.clientX,
        y: event.clientY,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return mousePosition;
}

/**
 * Hook to create parallax effect based on mouse position
 */
export function useParallax(strength: number = 20) {
  const { x, y } = useMousePosition();
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const offsetX = ((x - centerX) / centerX) * strength;
    const offsetY = ((y - centerY) / centerY) * strength;

    setPosition({ x: offsetX, y: offsetY });
  }, [x, y, strength]);

  return position;
}

// ============================================================================
// INTERSECTION OBSERVER
// ============================================================================

/**
 * Hook to detect when element enters viewport
 * Alternative to useScrollAnimation with more control
 */
export function useIntersection(
  options: IntersectionObserverInit = {}
): {
  ref: React.RefObject<HTMLElement | null>;
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
} {
  const ref = useRef<HTMLElement | null>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setEntry(entry);
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return {
    ref,
    isIntersecting: entry?.isIntersecting ?? false,
    entry,
  };
}

// ============================================================================
// EXPORT ALL HOOKS
// ============================================================================

export const hooks = {
  useReducedMotion,
  useMotionSafeVariants,
  useLayoutTransition,
  useStaggeredChildren,
  useScrollAnimation,
  useScrollProgress,
  useSmoothScrollProgress,
  useFLIPAnimation,
  useOrchestration,
  useControlledAnimation,
  useMousePosition,
  useParallax,
  useIntersection,
} as const;

export default hooks;
