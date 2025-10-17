/**
 * AnimationProvider
 *
 * Global animation context provider that manages motion preferences
 * and provides animation configuration to all components.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { useReducedMotion } from './accessibility';

interface AnimationContextValue {
  reducedMotion: boolean;
}

const AnimationContext = createContext<AnimationContextValue>({
  reducedMotion: false,
});

export function useAnimation() {
  return useContext(AnimationContext);
}

interface AnimationProviderProps {
  children: ReactNode;
}

/**
 * AnimationProvider wraps the app and provides:
 * - Global reduced motion detection
 * - Consistent animation configuration
 * - Motion preferences context
 */
export function AnimationProvider({ children }: AnimationProviderProps) {
  const reducedMotion = useReducedMotion();

  return (
    <AnimationContext.Provider value={{ reducedMotion }}>
      <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
        {children}
      </MotionConfig>
    </AnimationContext.Provider>
  );
}
