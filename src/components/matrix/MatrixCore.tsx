/**
 * MatrixCore Component
 *
 * Core matrix grid SVG renderer with animation support
 */

import React from 'react';
import { useMatrixAnimation } from './useMatrixAnimation';
import { getPattern, type MatrixPattern, type AnimationSpeed } from './matrixPatterns';
import type { ColorScheme } from '../../design-system/theme';

export interface MatrixCell {
  row: number;
  col: number;
  state: number; // 0 = empty, 1 = active, 2 = settled
}

export interface MatrixCoreProps {
  rows?: number;
  cols?: number;
  cellSize?: number;
  cellGap?: number;
  pattern?: MatrixPattern;
  speed?: AnimationSpeed;
  colorScheme?: ColorScheme;
  loop?: boolean;
  progress?: number; // External progress (0-1) - if provided, overrides internal animation
  onComplete?: () => void;
  className?: string;
}

// Color scheme to Tailwind color mapping
const COLOR_SCHEME_COLORS: Record<ColorScheme, { primary: string; secondary: string; accent: string }> = {
  ocean: {
    primary: '#0891b2', // cyan-600
    secondary: '#2563eb', // blue-600
    accent: '#06b6d4', // cyan-500
  },
  sunset: {
    primary: '#ea580c', // orange-600
    secondary: '#db2777', // pink-600
    accent: '#f97316', // orange-500
  },
  forest: {
    primary: '#059669', // emerald-600
    secondary: '#0d9488', // teal-600
    accent: '#10b981', // emerald-500
  },
  lavender: {
    primary: '#9333ea', // purple-600
    secondary: '#db2777', // pink-600
    accent: '#a855f7', // purple-500
  },
  monochrome: {
    primary: '#374151', // gray-700
    secondary: '#111827', // gray-900
    accent: '#4b5563', // gray-600
  },
};

/**
 * MatrixCore - Core matrix grid component
 */
export function MatrixCore({
  rows = 10,
  cols = 10,
  cellSize = 12,
  cellGap = 3,
  pattern = 'tetris',
  speed = 'medium',
  colorScheme = 'lavender',
  loop = true,
  progress: externalProgress,
  onComplete,
  className = '',
}: MatrixCoreProps) {
  const { progress: internalProgress } = useMatrixAnimation({ speed, loop, onComplete });

  // Use external progress if provided, otherwise use internal animation
  const progress = externalProgress !== undefined ? externalProgress : internalProgress;

  // Get pattern function
  const patternFn = getPattern(pattern);
  const grid = patternFn(rows, cols, progress);

  // Get colors for the scheme
  const colors = COLOR_SCHEME_COLORS[colorScheme];

  // Calculate SVG dimensions
  const width = cols * cellSize + (cols - 1) * cellGap;
  const height = rows * cellSize + (rows - 1) * cellGap;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ overflow: 'visible' }}
    >
      {grid.map((row, rowIndex) =>
        row.map((cellState, colIndex) => {
          const x = colIndex * (cellSize + cellGap);
          const y = rowIndex * (cellSize + cellGap);

          // Determine cell color based on state
          let fill = 'transparent';
          let opacity = 0.1;

          if (cellState === 1) {
            // Active/falling state - primary color with pulse
            fill = colors.accent;
            opacity = 0.8 + Math.sin(Date.now() / 200) * 0.2; // Pulse effect
          } else if (cellState === 2) {
            // Settled state - secondary color
            fill = colors.primary;
            opacity = 0.6;
          } else {
            // Empty state - very faint
            fill = colors.secondary;
            opacity = 0.05;
          }

          return (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              fill={fill}
              opacity={opacity}
              rx={2}
              ry={2}
              style={{
                transition: 'fill 0.3s ease, opacity 0.3s ease',
              }}
            />
          );
        })
      )}
    </svg>
  );
}

// Export types
export type { MatrixPattern, AnimationSpeed };
export type { ColorScheme } from '../../design-system/theme';
