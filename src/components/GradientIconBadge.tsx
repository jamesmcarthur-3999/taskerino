/**
 * GradientIconBadge
 *
 * Reusable component for displaying an icon within a gradient background badge.
 * Used across timeline cards (audio, screenshot, note) for visual consistency.
 *
 * Features:
 * - Circular gradient background
 * - Icon with customizable size
 * - Optional pulse animation for active states
 * - Flexible gradient customization
 */

import React from 'react';
import type { LucideProps } from 'lucide-react';
import { TRANSITIONS } from '../design-system/theme';

interface GradientIconBadgeProps {
  /** Lucide icon component */
  icon: React.ComponentType<LucideProps>;
  /** Icon size in pixels */
  iconSize?: number;
  /** Background gradient classes (e.g., 'from-purple-50 to-pink-50') */
  gradientFrom: string;
  gradientTo: string;
  /** Icon color class (e.g., 'text-purple-500') */
  iconColor: string;
  /** Badge size (diameter in pixels) */
  size?: number;
  /** Whether to show pulse animation */
  pulse?: boolean;
  /** Optional className for additional styling */
  className?: string;
}

export function GradientIconBadge({
  icon: Icon,
  iconSize = 20,
  gradientFrom,
  gradientTo,
  iconColor,
  size = 48,
  pulse = false,
  className = '',
}: GradientIconBadgeProps) {
  return (
    <div
      className={`
        flex-shrink-0 rounded-full flex items-center justify-center
        bg-gradient-to-br ${gradientFrom} ${gradientTo}
        ${pulse ? 'animate-pulse' : ''}
        ${TRANSITIONS.standard}
        ${className}
      `}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <Icon size={iconSize} className={iconColor} />
    </div>
  );
}
