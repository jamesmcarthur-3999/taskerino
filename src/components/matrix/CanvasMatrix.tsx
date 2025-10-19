/**
 * CanvasMatrix Component
 *
 * Wrapper component for MatrixCore configured for canvas generation loading state
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MatrixCore } from './MatrixCore';
import { getGlassClasses, getRadiusClass, type ColorScheme } from '../../design-system/theme';
import { useMatrixAnimation } from './useMatrixAnimation';

export interface CanvasMatrixProps {
  progress?: number; // External progress (0-1) - if provided, overrides internal animation
  colorScheme?: ColorScheme;
  onComplete?: () => void;
  className?: string;
}

/**
 * CanvasMatrix - Configured matrix animation for canvas generation
 */
export function CanvasMatrix({
  progress: externalProgress,
  colorScheme = 'lavender',
  onComplete,
  className = '',
}: CanvasMatrixProps) {
  const [isNearComplete, setIsNearComplete] = useState(false);
  const { progress: internalProgress } = useMatrixAnimation({
    speed: 'medium',  // ~10 seconds to complete (matches typical canvas generation)
    loop: false,      // Single progressive animation, not looping
    onComplete,
  });

  // Use external progress if provided, otherwise use internal animation
  const progress = externalProgress !== undefined ? externalProgress : internalProgress;

  // Detect near-completion for glow effect
  useEffect(() => {
    if (progress > 0.95) {
      setIsNearComplete(true);
    } else {
      setIsNearComplete(false);
    }
  }, [progress]);

  // Responsive grid configuration
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const gridConfig = isMobile
    ? { rows: 8, cols: 8, cellSize: 10 }
    : { rows: 10, cols: 10, cellSize: 12 };

  // Dynamic message based on progress
  const getMessage = () => {
    if (progress < 0.3) return "Analyzing session structure...";
    if (progress < 0.7) return "Assembling layout components...";
    if (progress < 0.95) return "Adding final touches...";
    return "Canvas ready!";
  };

  const glassClasses = getGlassClasses('medium');
  const radiusClass = getRadiusClass('card');
  const ringClasses = isNearComplete ? 'ring-2 ring-purple-400 ring-opacity-50' : '';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`${glassClasses} ${radiusClass} p-6 ${ringClasses} transition-all duration-300 ${className}`}
    >
      {/* Matrix SVG centered */}
      <div className="flex items-center justify-center mb-4">
        <MatrixCore
          rows={gridConfig.rows}
          cols={gridConfig.cols}
          cellSize={gridConfig.cellSize}
          cellGap={3}
          pattern="tetris"
          speed="medium"     // ~10 second animation
          colorScheme={colorScheme}
          loop={false}       // Progressive build-up, completes once
          progress={progress} // Pass progress to MatrixCore
        />
      </div>

      {/* Loading message */}
      <p className="text-xs text-center text-gray-600 animate-pulse">
        {getMessage()}
      </p>
    </motion.div>
  );
}
