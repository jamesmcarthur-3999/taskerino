/**
 * CanvasBadge - Typography Component
 *
 * Status indicators, tags, and counts with theming and optional pulse animation.
 * All badges use standardized typography for consistency.
 */

import React from 'react';
import type { BadgeProps } from '../types';
import { CANVAS_COMPONENTS, TYPOGRAPHY } from '../../../design-system/theme';

export function CanvasBadge({
  text,
  variant = 'default',
  size = 'md',
  icon,
  pulse = false,
}: BadgeProps) {
  // Get theme classes
  const badgeClasses = CANVAS_COMPONENTS.badges[variant];

  // Map size to padding (all use TYPOGRAPHY.badge for text)
  const sizeClasses = {
    sm: 'px-2 py-0.5',    // Compact
    md: 'px-2.5 py-0.5',  // Standard
    lg: 'px-3 py-1',      // Large
  };

  const className = [
    badgeClasses,
    sizeClasses[size],
    TYPOGRAPHY.badge,  // Standardized: text-xs font-semibold uppercase
    'inline-flex items-center gap-1.5',
    'rounded-full border',
    'transition-all duration-200',
    pulse ? 'animate-pulse' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{text}</span>
    </span>
  );
}
