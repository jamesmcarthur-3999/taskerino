/**
 * CanvasStatCard - Data Display Component
 *
 * Large number display with label, icon, trend, and optional action.
 * Uses gradient backgrounds from design system with enhanced visuals.
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { StatCardProps } from '../types';
import {
  getRadiusClass,
  getSuccessGradient,
  getWarningGradient,
  getDangerGradient,
  getInfoGradient,
  STATS_CARD_GRADIENTS,
  TRANSITIONS,
  TYPOGRAPHY,
  TEXT_COLORS,
} from '../../../design-system/theme';

export function CanvasStatCard({ value, label, icon, trend, theme = 'default', action }: StatCardProps) {
  // Map theme to gradient - prioritize STATS_CARD_GRADIENTS for visual consistency
  const gradient =
    theme === 'success'
      ? getSuccessGradient('medium')
      : theme === 'warning'
        ? getWarningGradient('medium')
        : theme === 'danger'
          ? getDangerGradient('medium')
          : theme === 'purple'
            ? {
                container: 'bg-gradient-to-br from-purple-500/30 via-pink-500/20 to-purple-400/30 border-2 border-purple-300/50',
                iconBg: 'bg-purple-100/60',
                iconColor: 'text-purple-600',
                textPrimary: 'text-purple-900',
                textSecondary: 'text-purple-700',
              }
            : theme === 'info'
              ? {
                  container: `bg-gradient-to-br ${STATS_CARD_GRADIENTS.duration.bg} border-2 ${STATS_CARD_GRADIENTS.duration.border}`,
                  iconBg: 'bg-blue-100/60',
                  iconColor: STATS_CARD_GRADIENTS.duration.icon,
                  textPrimary: STATS_CARD_GRADIENTS.duration.text,
                  textSecondary: 'text-blue-700',
                }
              : getInfoGradient('medium'); // default

  return (
    <div
      className={`${gradient.container} ${getRadiusClass('card')} p-4 shadow-md hover:shadow-lg ${TRANSITIONS.standard} hover:scale-[1.01] active:scale-[0.99]`}
    >
      {/* Icon (if provided) */}
      {icon && (
        <div className={`${gradient.iconBg} ${gradient.iconColor} w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-sm`}>
          <span className="text-lg">{icon}</span>
        </div>
      )}

      {/* Value - Use display typography for large numbers */}
      <div className={`${TYPOGRAPHY.display.small} ${gradient.textPrimary} mb-1`}>{value}</div>

      {/* Label - Use overline typography for stat labels */}
      <div className={`${TYPOGRAPHY.overline} ${gradient.textSecondary} mb-2`}>{label}</div>

      {/* Trend (if provided) */}
      {trend && (
        <div className={`flex items-center gap-2 ${TYPOGRAPHY.label.small}`}>
          {trend.direction === 'up' && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full">
              <TrendingUp className="w-4 h-4 text-green-700" />
              <span className="text-green-800">{trend.value}</span>
            </div>
          )}
          {trend.direction === 'down' && (
            <div className="flex items-center gap-1 px-2 py-1 bg-red-100 rounded-full">
              <TrendingDown className="w-4 h-4 text-red-700" />
              <span className="text-red-800">{trend.value}</span>
            </div>
          )}
          {trend.direction === 'neutral' && (
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full">
              <Minus className="w-4 h-4 text-gray-700" />
              <span className="text-gray-800">{trend.value}</span>
            </div>
          )}
          <span className={TEXT_COLORS.secondary}>{trend.label}</span>
        </div>
      )}

      {/* Action button (if provided) */}
      {action && (
        <button
          className={`mt-3 px-3 py-1.5 bg-white/90 hover:bg-white border border-gray-300 hover:border-gray-400 ${TEXT_COLORS.secondary} ${getRadiusClass('field')} ${TYPOGRAPHY.button.small} ${TRANSITIONS.standard} hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
