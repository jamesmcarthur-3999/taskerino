/**
 * CanvasHeading - Typography Component
 *
 * Semantic headings (h1-h6) with consistent hierarchy, optional icons,
 * theme-aware badges, emphasis levels, and gradient text effects.
 */

import React from 'react';
import type { HeadingProps } from '../types';
import { TYPOGRAPHY } from '../../../design-system/theme';

export function CanvasHeading({
  level,
  text,
  icon,
  badge,
  emphasis = 'normal',
  gradient = false,
}: HeadingProps) {
  // Map heading levels to typography system
  const headingStyles = {
    1: TYPOGRAPHY.heading.h1,
    2: TYPOGRAPHY.heading.h2,
    3: TYPOGRAPHY.heading.h3,
    4: TYPOGRAPHY.heading.h4,
    5: TYPOGRAPHY.heading.h5,
    6: TYPOGRAPHY.heading.h6,
  };

  // Map emphasis to classes
  const emphasisClasses = {
    subtle: 'opacity-60',
    normal: 'opacity-100',
    strong: '', // Already bold from heading styles
    hero: TYPOGRAPHY.display.large, // Use display typography for hero
  };

  // Enhanced gradient text effects - more variety
  const gradientClass = gradient
    ? level === 1 || emphasis === 'hero'
      ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-clip-text text-transparent'
      : 'bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent'
    : '';

  // Add line-height for better visual weight
  const lineHeightClass = level <= 2 ? 'leading-tight' : 'leading-snug';

  const className = [
    headingStyles[level],
    emphasisClasses[emphasis],
    gradientClass,
    lineHeightClass,
    'flex items-center gap-3 flex-wrap',
  ]
    .filter(Boolean)
    .join(' ');

  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

  return (
    <Tag className={className}>
      {/* Icon with subtle background for visual interest */}
      {icon && (
        <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg">
          {icon}
        </span>
      )}
      <span>{text}</span>
      {/* Theme-aware badge - uses gradient for h1/h2, solid color for smaller */}
      {badge && (
        <span
          className={`px-2.5 py-0.5 ${TYPOGRAPHY.badge} rounded-full ${
            level <= 2
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
              : 'bg-cyan-100 text-cyan-700'
          }`}
        >
          {badge}
        </span>
      )}
    </Tag>
  );
}
