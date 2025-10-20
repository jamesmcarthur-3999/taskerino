/**
 * Focus Area Card Component
 *
 * Glass card with blue accent for displaying focus areas with time allocation
 */

import React from 'react';
import { Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';
import type { SessionScreenshot } from '../../../types';

export interface FocusAreaCardProps {
  name: string;
  timeSpent: number; // in minutes
  tasks?: string[];
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

export function FocusAreaCard({
  name,
  timeSpent,
  tasks,
  timestamp,
  relatedScreenshots,
  onClickScreenshot,
  theme,
}: FocusAreaCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Icon and Name */}
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Target size={18} className="text-blue-600" />
          </div>
          <h4 className="text-gray-900 font-semibold">{name}</h4>
        </div>

        {/* Time Spent */}
        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-bold text-blue-600">{timeSpent}</div>
          <div className="text-xs text-gray-500">minutes</div>
        </div>
      </div>

      {/* Tasks List */}
      {tasks && tasks.length > 0 && (
        <div className="space-y-1 mb-3">
          {tasks.map((task: string, idx: number) => (
            <div key={idx} className="text-xs text-gray-600 flex items-start gap-2">
              <span className="text-blue-500 flex-shrink-0">"</span>
              <span className="flex-1">{task}</span>
            </div>
          ))}
        </div>
      )}

      {/* Timestamp */}
      {timestamp && (
        <p className="text-xs text-gray-600 mb-2">
          {new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}

      {/* Related Screenshots */}
      {relatedScreenshots && relatedScreenshots.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Related:</span>
          <div className="flex gap-1">
            {relatedScreenshots.slice(0, 3).map((screenshot) => (
              <button
                key={screenshot.id}
                onClick={() => onClickScreenshot?.(screenshot)}
                className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 transition-colors text-xs text-gray-700 flex items-center justify-center"
                title="View screenshot"
              >
                <span className="text-[10px]">=ø</span>
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
    </motion.div>
  );
}
