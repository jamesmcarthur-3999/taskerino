/**
 * Learning Card Component
 *
 * Glass card with purple/lavender left border for displaying learning moments and discoveries
 */

import React from 'react';
import { BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';

export interface LearningCardProps {
  discovery: string;
  context?: string;
  relatedScreenshots?: string[];
  timestamp?: string;
  theme?: CanvasTheme;
  onClickScreenshot?: (id: string) => void;
}

interface CanvasTheme {
  colorScheme?: 'ocean' | 'sunset' | 'forest' | 'lavender' | 'monochrome';
  mode?: 'light' | 'dark';
  primaryColor?: string;
}

export function LearningCard({
  discovery,
  context,
  relatedScreenshots,
  timestamp,
  theme,
  onClickScreenshot,
}: LearningCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`${getGlassClasses('subtle')} ${getRadiusClass('card')} p-6 border-l-4 border-purple-500 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
          <BookOpen size={18} className="text-purple-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 font-medium leading-relaxed text-base">
            {discovery}
          </p>

          {/* Context */}
          {context && (
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              {context}
            </p>
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

          {/* Screenshot Thumbnails */}
          {relatedScreenshots && relatedScreenshots.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-gray-600">Related:</span>
              <div className="flex gap-1">
                {relatedScreenshots.slice(0, 4).map((screenshotId, index) => (
                  <button
                    key={screenshotId}
                    onClick={() => onClickScreenshot?.(screenshotId)}
                    className="w-8 h-8 rounded bg-purple-100 hover:bg-purple-200 transition-colors text-xs text-purple-700 flex items-center justify-center"
                    title="View screenshot"
                  >
                    <span className="text-[10px]">📸</span>
                  </button>
                ))}
                {relatedScreenshots.length > 4 && (
                  <span className="text-xs text-gray-500 flex items-center">
                    +{relatedScreenshots.length - 4}
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
