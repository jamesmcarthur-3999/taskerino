/**
 * useMatrixAnimation Hook
 *
 * Handles matrix animation timing and progress tracking
 */

import { useState, useEffect, useRef } from 'react';
import { getCycleDuration, type AnimationSpeed } from './matrixPatterns';

export interface UseMatrixAnimationOptions {
  speed?: AnimationSpeed;
  loop?: boolean;
  onComplete?: () => void;
}

export interface MatrixAnimationState {
  progress: number;
  isComplete: boolean;
  reset: () => void;
}

/**
 * Custom hook for managing matrix animation state
 */
export function useMatrixAnimation(options: UseMatrixAnimationOptions = {}): MatrixAnimationState {
  const { speed = 'medium', loop = true, onComplete } = options;

  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(Date.now());
  const hasCalledCompleteRef = useRef<boolean>(false);

  const cycleDuration = getCycleDuration(speed);

  const reset = () => {
    setProgress(0);
    setIsComplete(false);
    startTimeRef.current = Date.now();
    hasCalledCompleteRef.current = false;
  };

  useEffect(() => {
    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min(elapsed / cycleDuration, 1);

      setProgress(newProgress);

      if (newProgress >= 1) {
        setIsComplete(true);

        // Call onComplete callback once at 95% progress
        if (newProgress >= 0.95 && !hasCalledCompleteRef.current && onComplete) {
          hasCalledCompleteRef.current = true;
          setTimeout(() => {
            onComplete();
          }, 1000); // Wait 1 second after 95% before calling
        }

        if (loop) {
          // Reset for next cycle
          startTimeRef.current = Date.now();
          hasCalledCompleteRef.current = false;
        } else {
          // Stop animation
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cycleDuration, loop, onComplete]);

  return {
    progress,
    isComplete,
    reset,
  };
}
