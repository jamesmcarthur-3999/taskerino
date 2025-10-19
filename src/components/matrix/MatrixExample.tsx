/**
 * Matrix Animation Example
 *
 * Example component demonstrating how to use the matrix animation system.
 * This can be used as a reference for integrating the matrix into the AI Canvas.
 */

import React from 'react';
import { MatrixCore } from './MatrixCore';

// ============================================================================
// EXAMPLE COMPONENT
// ============================================================================

export const MatrixExample: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="bg-white/50 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl border-2 border-white/60">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Matrix Animation Demo</h2>
        <p className="text-gray-600 mb-6">
          Tetris pattern - blocks assembling from bottom to top
        </p>

        <div className="flex justify-center">
          <MatrixCore
            rows={12}
            cols={16}
            cellSize={24}
            cellGap={6}
            pattern="tetris"
            speed="medium"
            colorScheme="lavender"
            loop={true}
            className="rounded-xl"
          />
        </div>

        <div className="mt-6 text-sm text-gray-500 text-center">
          60fps animation powered by requestAnimationFrame
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example 1: Basic usage with default settings
 *
 * ```tsx
 * <MatrixCore
 *   rows={10}
 *   cols={10}
 *   pattern="tetris"
 *   speed="medium"
 * />
 * ```
 */

/**
 * Example 2: Custom color scheme
 *
 * ```tsx
 * <MatrixCore
 *   rows={10}
 *   cols={10}
 *   pattern="tetris"
 *   speed="fast"
 *   colorScheme="ocean"
 * />
 * ```
 */

/**
 * Example 3: Wave pattern
 *
 * ```tsx
 * <MatrixCore
 *   rows={8}
 *   cols={8}
 *   cellSize={30}
 *   cellGap={8}
 *   pattern="wave"
 *   speed="slow"
 *   colorScheme="forest"
 * />
 * ```
 */

/**
 * Example 4: Loading animation with callback
 *
 * ```tsx
 * <MatrixCore
 *   rows={10}
 *   cols={10}
 *   pattern="tetris"
 *   speed="medium"
 *   loop={false}
 *   onComplete={() => console.log('Animation complete!')}
 * />
 * ```
 */

export default MatrixExample;
