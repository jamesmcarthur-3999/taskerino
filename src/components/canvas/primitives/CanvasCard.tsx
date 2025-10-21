/**
 * CanvasCard - Layout Component
 *
 * Elevated card container with glass morphism, optional header/footer,
 * and enhanced theming with distinctive visual styles.
 */

import React from 'react';
import type { CardProps } from '../types';
import { CANVAS_COMPONENTS, getGlassClasses, getRadiusClass, TRANSITIONS } from '../../../design-system/theme';

export function CanvasCard({
  variant = 'lifted',
  padding = 'normal',
  theme = 'default',
  header,
  footer,
  children,
}: CardProps) {
  // Get theme classes
  const themeClasses = CANVAS_COMPONENTS.themes[theme];

  // Map padding to Tailwind spacing (increased for better readability)
  const paddingMap = {
    tight: 'p-2',
    normal: 'p-4',      // Increased from p-3
    relaxed: 'p-5',     // Increased from p-4
    loose: 'p-6',
  };
  const paddingClass = paddingMap[padding];

  // Map spacing to horizontal padding for header/footer (BUGFIX: was using invalid px-${padding} syntax)
  const horizontalPaddingMap = {
    tight: 'px-2',
    normal: 'px-4',
    relaxed: 'px-5',
    loose: 'px-6',
  };
  const horizontalPaddingClass = horizontalPaddingMap[padding];

  // Get elevation shadow
  const shadowClass = CANVAS_COMPONENTS.elevation[variant];

  // Enhanced theme-specific styles with gradient borders and glows (more subtle)
  const themeEnhancements = {
    success: 'ring-1 ring-green-200/40 hover:ring-green-300/50',
    warning: 'ring-1 ring-amber-200/40 hover:ring-amber-300/50',
    danger: 'ring-1 ring-red-200/40 hover:ring-red-300/50',
    info: 'ring-1 ring-cyan-200/40 hover:ring-cyan-300/50',
    purple: 'ring-1 ring-purple-200/40 hover:ring-purple-300/50',
    default: '',
  };

  // Build card className (lighter borders and shadows)
  const cardClassName = [
    getGlassClasses('medium'),
    getRadiusClass('card'),
    shadowClass,
    `border ${themeClasses.border}`,
    themeEnhancements[theme],
    TRANSITIONS.standard,
    'overflow-hidden',
    'hover:shadow-xl',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClassName}>
      {/* Header Section */}
      {header && (
        <div
          className={`border-b ${themeClasses.border} ${themeClasses.bg} backdrop-blur-sm ${horizontalPaddingClass} py-3`}
        >
          {header}
        </div>
      )}

      {/* Main Content - Added leading-normal for better readability */}
      <div className={`${paddingClass} ${themeClasses.text} leading-normal`}>{children}</div>

      {/* Footer Section */}
      {footer && (
        <div
          className={`border-t ${themeClasses.border} ${themeClasses.bg} backdrop-blur-sm ${horizontalPaddingClass} py-3`}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
