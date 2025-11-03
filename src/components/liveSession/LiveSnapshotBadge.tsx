/**
 * LiveSnapshotBadge
 *
 * Small badge showing momentum (high/medium/low) with animated indicator.
 * Used in CurrentFocusCard, LiveIntelligencePanel, and TopNavigation.
 *
 * @example
 * ```tsx
 * <LiveSnapshotBadge
 *   momentum="high"
 *   showLabel={true}
 *   size="md"
 *   tooltip="Current work momentum"
 * />
 * ```
 */

import React from 'react';

interface LiveSnapshotBadgeProps {
  momentum: 'high' | 'medium' | 'low';
  showLabel?: boolean; // Show text label (default: false)
  size?: 'sm' | 'md' | 'lg'; // Default: 'md'
  tooltip?: string; // Custom tooltip text
}

const sizeMap = {
  sm: { dot: 'w-2 h-2', text: 'text-xs', padding: 'px-2 py-0.5' },
  md: { dot: 'w-3 h-3', text: 'text-sm', padding: 'px-2.5 py-1' },
  lg: { dot: 'w-4 h-4', text: 'text-base', padding: 'px-3 py-1.5' }
};

const momentumConfig = {
  high: {
    bg: 'bg-green-100',
    dot: 'bg-green-500',
    text: 'text-green-700',
    animate: 'animate-pulse'
  },
  medium: {
    bg: 'bg-amber-100',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    animate: ''
  },
  low: {
    bg: 'bg-gray-100',
    dot: 'bg-gray-400',
    text: 'text-gray-700',
    animate: ''
  }
};

export const LiveSnapshotBadge: React.FC<LiveSnapshotBadgeProps> = ({
  momentum,
  showLabel = false,
  size = 'md',
  tooltip
}) => {
  const sizeClasses = sizeMap[size];
  const config = momentumConfig[momentum];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full ${config.bg} ${sizeClasses.padding}`}
      title={tooltip || `Momentum: ${momentum}`}
      role="status"
      aria-label={`Momentum: ${momentum}`}
    >
      {/* Animated Dot */}
      <div className={`rounded-full ${sizeClasses.dot} ${config.dot} ${config.animate}`} />

      {/* Label (optional) */}
      {showLabel && (
        <span className={`font-semibold ${config.text} ${sizeClasses.text}`}>
          {momentum.charAt(0).toUpperCase() + momentum.slice(1)}
        </span>
      )}
    </div>
  );
};
