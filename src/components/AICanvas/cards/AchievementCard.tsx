/**
 * Achievement Card Component
 *
 * Glass card with green left border for displaying session achievements
 */

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';
import type { SessionScreenshot } from '../../../types';

export interface AchievementCardProps {
  achievement: string;
  timestamp?: string;
  relatedScreenshots?: SessionScreenshot[];
  onClickScreenshot?: (screenshot: SessionScreenshot) => void;
  theme?: ThemeConfig;
}

interface ThemeConfig {
  colorScheme?: 'ocean' | 'sunset' | 'forest' | 'lavender' | 'monochrome';
  mode?: 'light' | 'dark';
  primaryColor?: string;
}

export function AchievementCard({
  achievement,
  timestamp,
  relatedScreenshots,
  onClickScreenshot,
  theme,
}: AchievementCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 border-l-4 border-green-500 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={18} className="text-green-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 font-medium leading-relaxed">
            {achievement}
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
              <span className="text-xs text-gray-600">Related:</span>
              <div className="flex gap-1">
                {relatedScreenshots.slice(0, 3).map((screenshot) => (
                  <button
                    key={screenshot.id}
                    onClick={() => onClickScreenshot?.(screenshot)}
                    className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 transition-colors text-xs text-gray-700 flex items-center justify-center"
                    title="View screenshot"
                  >
                    <span className="text-[10px]">📸</span>
                  </button>
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
