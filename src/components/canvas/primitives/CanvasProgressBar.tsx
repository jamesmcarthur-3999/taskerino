/**
 * CanvasProgressBar - Data Display Component
 *
 * Progress visualization (linear or circular) with optional animation.
 */

import React from 'react';
import type { ProgressBarProps } from '../types';
import { CANVAS_COMPONENTS } from '../../../design-system/theme';

export function CanvasProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  variant = 'linear',
  theme = 'default',
  striped = false,
  animated = false,
}: ProgressBarProps) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);
  const themeClasses = CANVAS_COMPONENTS.themes[theme];

  if (variant === 'circular') {
    // Circular progress (simplified - would use SVG for production)
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="flex flex-col items-center gap-2">
        {label && <div className="text-sm font-medium text-gray-700">{label}</div>}
        <div className="relative w-24 h-24">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-200"
            />
            {/* Progress circle */}
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="text-cyan-500 transition-all duration-500"
              strokeLinecap="round"
            />
          </svg>
          {/* Percentage in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-gray-900">{percentage}%</span>
          </div>
        </div>
      </div>
    );
  }

  // Linear progress bar
  return (
    <div className="w-full">
      {label && <div className="text-sm font-medium text-gray-700 mb-2">{label}</div>}

      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={[
            'h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 ease-out',
            striped ? 'bg-[length:1rem_1rem] bg-gradient-stripes' : '',
            animated ? 'animate-pulse' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ width: `${percentage}%` }}
        >
          {/* Shimmer effect for animated */}
          {animated && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
          )}
        </div>
      </div>

      {showPercentage && (
        <div className="text-xs text-right text-gray-600 mt-1">{percentage}%</div>
      )}
    </div>
  );
}
