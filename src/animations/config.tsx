/**
 * Animation System - Configuration
 *
 * Global animation configuration provider and context.
 * Centralizes animation settings and reduced motion preferences.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { MotionConfig as FramerMotionConfig } from 'framer-motion';
import { useReducedMotion } from './hooks';
import type { MotionConfig, AnimationContextValue, AnimationTransition } from './types';
import { durations, easings } from './tokens';

// ============================================================================
// ANIMATION CONTEXT
// ============================================================================

/**
 * Default animation configuration
 */
const defaultConfig: MotionConfig = {
  reducedMotion: false,
  skipAnimations: false,
  transition: {
    duration: durations.s.normal,
    ease: easings.smooth as any,
  },
};

/**
 * Animation context
 */
const AnimationContext = createContext<AnimationContextValue>({
  config: defaultConfig,
  updateConfig: () => {},
});

// ============================================================================
// ANIMATION PROVIDER
// ============================================================================

export interface AnimationProviderProps {
  /** Children to wrap */
  children: React.ReactNode;
  /** Initial configuration */
  initialConfig?: Partial<MotionConfig>;
  /** Whether to override reduced motion preference */
  overrideReducedMotion?: boolean;
}

/**
 * Animation configuration provider
 * Wraps the application with Framer Motion's MotionConfig
 * and provides animation settings via context
 */
export function AnimationProvider({
  children,
  initialConfig = {},
  overrideReducedMotion = false,
}: AnimationProviderProps) {
  const systemReducedMotion = useReducedMotion();
  const [config, setConfig] = useState<MotionConfig>({
    ...defaultConfig,
    ...initialConfig,
    reducedMotion: overrideReducedMotion
      ? initialConfig.reducedMotion ?? false
      : systemReducedMotion,
  });

  /**
   * Update animation configuration
   */
  const updateConfig = useCallback((updates: Partial<MotionConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  /**
   * Memoize context value
   */
  const contextValue = useMemo<AnimationContextValue>(
    () => ({
      config,
      updateConfig,
    }),
    [config, updateConfig]
  );

  /**
   * Determine transition based on configuration
   */
  const transition = useMemo(() => {
    if (config.skipAnimations || config.reducedMotion) {
      return { duration: 0 } as const;
    }
    return config.transition || defaultConfig.transition!;
  }, [config]);

  return (
    <AnimationContext.Provider value={contextValue}>
      <FramerMotionConfig
        reducedMotion={config.reducedMotion ? 'always' : 'never'}
        transition={transition as any}
      >
        {children}
      </FramerMotionConfig>
    </AnimationContext.Provider>
  );
}

// ============================================================================
// ANIMATION CONFIG HOOK
// ============================================================================

/**
 * Hook to access animation configuration
 * Provides current config and update function
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { config, updateConfig } = useAnimationConfig();
 *
 *   // Check if animations should be disabled
 *   if (config.reducedMotion) {
 *     return <div>Static content</div>;
 *   }
 *
 *   // Update config
 *   useEffect(() => {
 *     updateConfig({ skipAnimations: true });
 *   }, []);
 *
 *   return <motion.div>Animated content</motion.div>;
 * }
 * ```
 */
export function useAnimationConfig(): AnimationContextValue {
  const context = useContext(AnimationContext);

  if (!context) {
    throw new Error('useAnimationConfig must be used within AnimationProvider');
  }

  return context;
}

// ============================================================================
// ANIMATION ENABLED HOOK
// ============================================================================

/**
 * Hook to check if animations are enabled
 * Combines reduced motion preference and skip animations setting
 *
 * @returns boolean indicating if animations should run
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const animationsEnabled = useAnimationsEnabled();
 *
 *   return (
 *     <motion.div
 *       animate={animationsEnabled ? { opacity: 1 } : undefined}
 *     >
 *       Content
 *     </motion.div>
 *   );
 * }
 * ```
 */
export function useAnimationsEnabled(): boolean {
  const { config } = useAnimationConfig();
  return !config.reducedMotion && !config.skipAnimations;
}

// ============================================================================
// ANIMATION TOGGLE HOOK
// ============================================================================

/**
 * Hook to toggle animations on/off
 * Useful for debugging or performance testing
 *
 * @returns Object with enabled state and toggle function
 *
 * @example
 * ```tsx
 * function DebugPanel() {
 *   const { enabled, toggle } = useAnimationToggle();
 *
 *   return (
 *     <button onClick={toggle}>
 *       Animations: {enabled ? 'ON' : 'OFF'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useAnimationToggle(): {
  enabled: boolean;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
} {
  const { config, updateConfig } = useAnimationConfig();

  const toggle = useCallback(() => {
    updateConfig({ skipAnimations: !config.skipAnimations });
  }, [config.skipAnimations, updateConfig]);

  const enable = useCallback(() => {
    updateConfig({ skipAnimations: false });
  }, [updateConfig]);

  const disable = useCallback(() => {
    updateConfig({ skipAnimations: true });
  }, [updateConfig]);

  return {
    enabled: !config.skipAnimations && !config.reducedMotion,
    toggle,
    enable,
    disable,
  };
}

// ============================================================================
// ANIMATION SPEED CONTROL
// ============================================================================

/**
 * Hook to control global animation speed
 * Multiplies all durations by a speed factor
 *
 * @returns Object with current speed and update function
 *
 * @example
 * ```tsx
 * function SpeedControl() {
 *   const { speed, setSpeed } = useAnimationSpeed();
 *
 *   return (
 *     <input
 *       type="range"
 *       min="0.1"
 *       max="2"
 *       step="0.1"
 *       value={speed}
 *       onChange={(e) => setSpeed(parseFloat(e.target.value))}
 *     />
 *   );
 * }
 * ```
 */
export function useAnimationSpeed(): {
  speed: number;
  setSpeed: (speed: number) => void;
} {
  const [speed, setSpeedState] = useState(1);
  const { updateConfig } = useAnimationConfig();

  const setSpeed = useCallback(
    (newSpeed: number) => {
      setSpeedState(newSpeed);
      // Update transition duration based on speed
      updateConfig({
        transition: {
          duration: (durations.s.normal / newSpeed),
          ease: easings.smooth as any,
        },
      });
    },
    [updateConfig]
  );

  return { speed, setSpeed };
}

// ============================================================================
// CONDITIONAL ANIMATION WRAPPER
// ============================================================================

export interface ConditionalAnimationProps {
  /** Children to render */
  children: React.ReactNode;
  /** Whether to enable animations for this component tree */
  enabled?: boolean;
  /** Fallback when animations are disabled */
  fallback?: React.ReactNode;
}

/**
 * Wrapper that conditionally enables animations for its children
 * Useful for performance-critical sections
 *
 * @example
 * ```tsx
 * function HeavyComponent() {
 *   return (
 *     <ConditionalAnimation enabled={false}>
 *       <motion.div>Static rendering for performance</motion.div>
 *     </ConditionalAnimation>
 *   );
 * }
 * ```
 */
export function ConditionalAnimation({
  children,
  enabled = true,
  fallback,
}: ConditionalAnimationProps) {
  const { config, updateConfig } = useAnimationConfig();
  const previousSkipState = React.useRef(config.skipAnimations);

  React.useEffect(() => {
    if (!enabled) {
      previousSkipState.current = config.skipAnimations;
      updateConfig({ skipAnimations: true });
    }

    return () => {
      if (!enabled) {
        updateConfig({ skipAnimations: previousSkipState.current });
      }
    };
  }, [enabled, config.skipAnimations, updateConfig]);

  if (!enabled && fallback) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================================================
// PERFORMANCE MONITOR
// ============================================================================

export interface PerformanceMonitorProps {
  /** Children to render */
  children: React.ReactNode;
  /** FPS threshold below which to disable animations */
  fpsThreshold?: number;
  /** Whether to log performance metrics */
  debug?: boolean;
}

/**
 * Monitor performance and automatically disable animations if FPS drops
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <AnimationProvider>
 *       <PerformanceMonitor fpsThreshold={30} debug>
 *         <MyApp />
 *       </PerformanceMonitor>
 *     </AnimationProvider>
 *   );
 * }
 * ```
 */
export function PerformanceMonitor({
  children,
  fpsThreshold = 30,
  debug = false,
}: PerformanceMonitorProps) {
  const { updateConfig } = useAnimationConfig();
  const frameTimesRef = React.useRef<number[]>([]);
  const lastFrameTimeRef = React.useRef<number>(performance.now());

  React.useEffect(() => {
    let animationFrameId: number;

    function measureFPS() {
      const now = performance.now();
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      // Keep last 60 frame times
      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      // Calculate average FPS
      const avgFrameTime =
        frameTimesRef.current.reduce((sum, time) => sum + time, 0) /
        frameTimesRef.current.length;
      const fps = 1000 / avgFrameTime;

      if (debug) {
        console.log(`FPS: ${fps.toFixed(2)}`);
      }

      // Disable animations if FPS drops below threshold
      if (fps < fpsThreshold) {
        updateConfig({ skipAnimations: true });
        if (debug) {
          console.warn(`FPS dropped below ${fpsThreshold}, disabling animations`);
        }
      }

      animationFrameId = requestAnimationFrame(measureFPS);
    }

    animationFrameId = requestAnimationFrame(measureFPS);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [fpsThreshold, debug, updateConfig]);

  return <>{children}</>;
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export const config = {
  AnimationProvider,
  useAnimationConfig,
  useAnimationsEnabled,
  useAnimationToggle,
  useAnimationSpeed,
  ConditionalAnimation,
  PerformanceMonitor,
} as const;

export default config;
