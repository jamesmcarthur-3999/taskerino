/**
 * CanvasSeparator - Typography Component
 *
 * Visual divider between sections with optional label.
 */

import React from 'react';
import type { SeparatorProps } from '../types';

export function CanvasSeparator({
  orientation = 'horizontal',
  thickness = 'normal',
  spacing = 'normal',
  label,
}: SeparatorProps) {
  // Map spacing to margin classes
  const spacingClasses = {
    tight: 'my-2',
    normal: 'my-4',
    relaxed: 'my-6',
    loose: 'my-8',
  };

  // Map thickness to border width
  const thicknessClasses = {
    thin: 'border-t',
    normal: 'border-t-2',
    thick: 'border-t-4',
  };

  if (orientation === 'vertical') {
    // Vertical separator (for horizontal layouts)
    const verticalThickness = {
      thin: 'border-l',
      normal: 'border-l-2',
      thick: 'border-l-4',
    };

    return (
      <div
        className={`${verticalThickness[thickness]} border-gray-200 mx-${spacing === 'tight' ? '2' : spacing === 'normal' ? '4' : spacing === 'relaxed' ? '6' : '8'}`}
        style={{ minHeight: '1rem' }}
      />
    );
  }

  // Horizontal separator
  if (label) {
    return (
      <div className={`relative ${spacingClasses[spacing]}`}>
        <div className="absolute inset-0 flex items-center">
          <div className={`w-full ${thicknessClasses[thickness]} border-gray-200`} />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-sm font-medium text-gray-500">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${spacingClasses[spacing]} ${thicknessClasses[thickness]} border-gray-200`} />
  );
}
