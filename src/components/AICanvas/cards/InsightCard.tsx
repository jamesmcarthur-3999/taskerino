/**
 * Insight Card Component
 *
 * Glass card with amber left border for displaying insights
 */

import React from 'react';
import { Lightbulb } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';

export interface InsightCardProps {
  insight: string;
  timestamp: string;
  tags?: string[];
  relatedScreenshots?: string[];
  theme?: ThemeConfig;
}

interface ThemeConfig {
  colorScheme?: 'ocean' | 'sunset' | 'forest' | 'lavender' | 'monochrome';
}

export function InsightCard({
  insight,
  timestamp,
  tags,
  relatedScreenshots,
  theme,
}: InsightCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 border-l-4 border-amber-500 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
          <Lightbulb size={18} className="text-amber-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 font-medium leading-relaxed">
            {insight}
          </p>

          {/* Timestamp */}
          <p className="text-xs text-gray-600 mt-2">
            {new Date(timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Related Screenshots Count */}
          {relatedScreenshots && relatedScreenshots.length > 0 && (
            <div className="mt-3 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1">
                📸 {relatedScreenshots.length} screenshot{relatedScreenshots.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
