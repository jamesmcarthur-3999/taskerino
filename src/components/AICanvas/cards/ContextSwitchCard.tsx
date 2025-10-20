/**
 * Context Switch Card Component
 *
 * Glass card showing context switches and their impact
 */

import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';

export interface ContextSwitchCardProps {
  fromTask: string;
  toTask: string;
  reason?: string;
  impact: 'productive' | 'neutral' | 'disruptive';
  timestamp?: string;
  theme?: ThemeConfig;
}

interface ThemeConfig {
  colorScheme?: 'ocean' | 'sunset' | 'forest' | 'lavender' | 'monochrome';
  mode?: 'light' | 'dark';
  primaryColor?: string;
}

export function ContextSwitchCard({
  fromTask,
  toTask,
  reason,
  impact,
  timestamp,
  theme,
}: ContextSwitchCardProps) {
  // Impact determines color scheme
  const impactStyles = {
    productive: {
      border: 'border-green-500',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      badge: 'bg-green-100 text-green-700',
      label: 'Productive',
      arrowColor: 'text-green-500',
    },
    neutral: {
      border: 'border-gray-400',
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600',
      badge: 'bg-gray-100 text-gray-700',
      label: 'Neutral',
      arrowColor: 'text-gray-400',
    },
    disruptive: {
      border: 'border-red-500',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      badge: 'bg-red-100 text-red-700',
      label: 'Disruptive',
      arrowColor: 'text-red-500',
    },
  };

  const styles = impactStyles[impact];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`${getGlassClasses('subtle')} ${getRadiusClass('card')} p-6 border-l-4 ${styles.border} hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full ${styles.iconBg} flex items-center justify-center`}>
          <ArrowRightLeft size={18} className={styles.iconColor} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Impact Badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${styles.badge}`}>
              {styles.label}
            </span>
          </div>

          {/* Task Transition */}
          <div className="space-y-2">
            {/* From Task */}
            <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                From
              </p>
              <p className="text-sm text-gray-800 leading-snug">
                {fromTask}
              </p>
            </div>

            {/* Arrow Indicator */}
            <div className="flex items-center justify-center py-1">
              <motion.div
                initial={{ x: -5, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                <ArrowRightLeft size={16} className={styles.arrowColor} />
              </motion.div>
            </div>

            {/* To Task */}
            <div className={`rounded-lg px-3 py-2 border ${
              impact === 'productive'
                ? 'bg-green-50 border-green-200'
                : impact === 'disruptive'
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                impact === 'productive'
                  ? 'text-green-700'
                  : impact === 'disruptive'
                  ? 'text-red-700'
                  : 'text-gray-500'
              }`}>
                To
              </p>
              <p className="text-sm text-gray-800 leading-snug">
                {toTask}
              </p>
            </div>
          </div>

          {/* Reason */}
          {reason && (
            <div className="mt-3 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 mb-1">
                Reason
              </p>
              <p className="text-sm text-gray-700 leading-snug">
                {reason}
              </p>
            </div>
          )}

          {/* Timestamp */}
          {timestamp && (
            <p className="text-xs text-gray-500 mt-3">
              {new Date(timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
