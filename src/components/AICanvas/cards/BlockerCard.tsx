/**
 * Blocker Card Component
 *
 * Glass card with red left border for displaying blockers/issues
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';
import type { SessionScreenshot } from '../../../types';

export interface BlockerCardProps {
  blocker: string;
  severity?: 'low' | 'medium' | 'high';
  timestamp?: string;
  relatedScreenshots?: SessionScreenshot[];
  theme?: ThemeConfig;
}

interface ThemeConfig {
  colorScheme?: 'ocean' | 'sunset' | 'forest' | 'lavender' | 'monochrome';
}

export function BlockerCard({
  blocker,
  severity = 'medium',
  timestamp,
  relatedScreenshots,
  theme,
}: BlockerCardProps) {
  // Severity affects border and icon color intensity
  const severityStyles = {
    low: {
      border: 'border-red-300',
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
    },
    medium: {
      border: 'border-red-500',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
    },
    high: {
      border: 'border-red-600',
      iconBg: 'bg-red-200',
      iconColor: 'text-red-700',
    },
  };

  const styles = severityStyles[severity];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 border-l-4 ${styles.border} hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full ${styles.iconBg} flex items-center justify-center`}>
          <AlertCircle size={18} className={styles.iconColor} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Severity Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-bold uppercase tracking-wide ${styles.iconColor}`}>
              {severity} severity
            </span>
          </div>

          <p className="text-gray-900 font-medium leading-relaxed">
            {blocker}
          </p>

          {/* Timestamp */}
          {timestamp && (
            <p className="text-xs text-gray-600 mt-2">
              {new Date(timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}

          {/* Related Screenshots */}
          {relatedScreenshots && relatedScreenshots.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-gray-600">Evidence:</span>
              <div className="flex gap-1">
                {relatedScreenshots.slice(0, 3).map((screenshot) => (
                  <div
                    key={screenshot.id}
                    className="w-6 h-6 rounded bg-gray-200 text-xs text-gray-700 flex items-center justify-center"
                    title="Screenshot"
                  >
                    <span className="text-[10px]">📸</span>
                  </div>
                ))}
                {relatedScreenshots.length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{relatedScreenshots.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
