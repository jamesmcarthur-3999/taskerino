/**
 * CanvasStack - Layout Component
 *
 * Flexible stacking layout (vertical or horizontal) with consistent spacing.
 * Used for organizing components in a linear flow.
 */

import React from 'react';
import type { StackProps } from '../types';
import { CANVAS_COMPONENTS } from '../../../design-system/theme';

export function CanvasStack({
  direction,
  spacing = 'normal',
  align = 'stretch',
  wrap = false,
  children,
}: StackProps) {
  // Map spacing to Tailwind gap classes
  const gapClass = CANVAS_COMPONENTS.grid.gaps[spacing];

  // Map align to Tailwind classes
  const alignClass = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  }[align];

  // Build className
  const className = [
    'flex',
    direction === 'vertical' ? 'flex-col' : 'flex-row',
    gapClass,
    alignClass,
    wrap && direction === 'horizontal' ? 'flex-wrap' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={className}>{children}</div>;
}
