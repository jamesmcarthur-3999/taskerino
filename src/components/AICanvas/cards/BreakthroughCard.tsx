/**
 * Breakthrough Card Component
 *
 * Glass card with gold/yellow left border for highlighting breakthrough moments
 */

import React from 'react';
import { Lightbulb, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';

export interface BreakthroughCardProps {
  moment: string;
  beforeState?: string;
  afterState?: string;
  impact: 'high' | 'medium' | 'low';
  timestamp?: string;
  theme?: CanvasTheme;
}

interface CanvasTheme {
  colorScheme?: 'ocean' | 'sunset' | 'forest' | 'lavender' | 'monochrome';
  mode?: 'light' | 'dark';
  primaryColor?: string;
}

export function BreakthroughCard({
  moment,
  beforeState,
  afterState,
  impact,
  timestamp,
  theme,
}: BreakthroughCardProps) {
  // Impact determines styling intensity
  const impactStyles = {
    low: {
      border: 'border-yellow-400',
      iconBg: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
      badgeColor: 'bg-yellow-100 text-yellow-700',
      stars: 1,
    },
    medium: {
      border: 'border-yellow-500',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      badgeColor: 'bg-yellow-200 text-yellow-800',
      stars: 2,
    },
    high: {
      border: 'border-yellow-600',
      iconBg: 'bg-yellow-200',
      iconColor: 'text-yellow-700',
      badgeColor: 'bg-yellow-300 text-yellow-900',
      stars: 3,
    },
  };

  const styles = impactStyles[impact];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, rotate: -2 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{
        duration: 0.4,
        type: 'spring',
        stiffness: 200,
        damping: 15
      }}
      className={`${getGlassClasses('subtle')} ${getRadiusClass('card')} p-6 border-l-4 ${styles.border} hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}
    >
      <div className="flex items-start gap-3">
        {/* Icon with celebration animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 10 }}
          className={`flex-shrink-0 w-8 h-8 rounded-full ${styles.iconBg} flex items-center justify-center relative`}
        >
          <Lightbulb size={18} className={styles.iconColor} />
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 2] }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Sparkles size={16} className={styles.iconColor} />
          </motion.div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Impact Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${styles.badgeColor}`}>
              {impact} impact
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: styles.stars }).map((_, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="text-yellow-500"
                >
                  ⭐
                </motion.span>
              ))}
            </div>
          </div>

          {/* Moment Description */}
          <p className="text-gray-900 font-semibold leading-relaxed text-base mb-3">
            {moment}
          </p>

          {/* Before/After Split View */}
          {(beforeState || afterState) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {beforeState && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Before
                  </p>
                  <p className="text-sm text-gray-700 leading-snug">
                    {beforeState}
                  </p>
                </div>
              )}
              {afterState && (
                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-1">
                    After
                  </p>
                  <p className="text-sm text-gray-800 leading-snug">
                    {afterState}
                  </p>
                </div>
              )}
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
