/**
 * CanvasGrid - Layout Component
 *
 * Responsive grid layout with configurable columns and gaps.
 * Automatically collapses to single column on mobile when responsive=true.
 */

import React from 'react';
import type { GridProps } from '../types';
import { CANVAS_COMPONENTS } from '../../../design-system/theme';

export function CanvasGrid({
  columns,
  gap = 'normal',
  responsive = true,
  children,
}: GridProps) {
  // Get gap class
  const gapClass = CANVAS_COMPONENTS.grid.gaps[gap];

  // Get column class
  let columnClass: string;
  if (columns === 'auto') {
    // Auto-fit with minimum width
    columnClass = 'grid-cols-[repeat(auto-fit,minmax(250px,1fr))]';
  } else if (responsive) {
    // Use responsive column classes
    columnClass = CANVAS_COMPONENTS.grid.columns[columns];
  } else {
    // Fixed columns (no responsive behavior)
    columnClass = `grid-cols-${columns}`;
  }

  const className = ['grid', columnClass, gapClass].filter(Boolean).join(' ');

  return <div className={className}>{children}</div>;
}
