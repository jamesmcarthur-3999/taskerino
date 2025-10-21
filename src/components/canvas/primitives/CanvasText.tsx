/**
 * CanvasText - Typography Component
 *
 * Body text with size, weight, color, and alignment options.
 * Supports markdown rendering for rich text.
 */

import React from 'react';
import type { TextProps } from '../types';
import { CanvasCitation } from './CanvasCitation';
import { TYPOGRAPHY, TEXT_COLORS } from '../../../design-system/theme';

export function CanvasText({
  content,
  size = 'base',
  weight = 'normal',
  color = 'default',
  align = 'left',
  markdown = false,
  citations,
}: TextProps) {
  // Map size to typography system
  const sizeClasses = {
    xs: TYPOGRAPHY.body.small,     // 12px - Tertiary text
    sm: TYPOGRAPHY.body.default,   // 14px - Secondary text
    base: TYPOGRAPHY.body.large,   // 16px - Primary text
    lg: TYPOGRAPHY.heading.h4,     // 18px - Large text
    xl: TYPOGRAPHY.heading.h3,     // 20px - Extra large text
  };

  // Map weight to Tailwind classes (can override typography defaults)
  const weightClasses = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  // Map color to text color system
  const colorClasses = {
    default: TEXT_COLORS.primary,     // text-gray-900
    muted: TEXT_COLORS.secondary,     // text-gray-600
    emphasis: `${TEXT_COLORS.primary} font-medium`, // text-gray-900 + medium weight
    success: 'text-green-700',
    warning: 'text-amber-700',
    danger: 'text-red-700',
  };

  // Map align to Tailwind classes
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const className = [
    sizeClasses[size],
    weightClasses[weight],
    colorClasses[color],
    alignClasses[align],
  ]
    .filter(Boolean)
    .join(' ');

  if (markdown) {
    // Simple markdown rendering with HTML escaping for security
    // Escape HTML first to prevent XSS
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Apply markdown transformations
    const processedContent = escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, `<code class="px-1.5 py-0.5 bg-gray-100 rounded ${TYPOGRAPHY.body.small} font-mono text-gray-800">$1</code>`);

    return (
      <div className="inline-flex items-baseline flex-wrap">
        <p className={`${className} leading-relaxed`} dangerouslySetInnerHTML={{ __html: processedContent }} />
        {/* Citation indicator - superscript by default */}
        {citations && citations.length > 0 && (
          <CanvasCitation citations={citations} />
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-baseline flex-wrap">
      <p className={`${className} leading-relaxed`}>{content}</p>
      {/* Citation indicator - superscript by default */}
      {citations && citations.length > 0 && (
        <CanvasCitation citations={citations} />
      )}
    </div>
  );
}
