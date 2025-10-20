/**
 * Collaboration Card Component
 *
 * Glass card with teal left border for displaying collaboration wins
 */

import React from 'react';
import { Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';
import type { SessionScreenshot } from '../../../types';

export interface CollaborationCardProps {
  title: string;
  description: string;
  participants?: string[];
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

export function CollaborationCard({
  title,
  description,
  participants,
  timestamp,
  relatedScreenshots,
  onClickScreenshot,
  theme,
}: CollaborationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 border-l-4 border-teal-500 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
          <Users size={18} className="text-teal-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title with emoji */}
          <div className="flex items-start gap-2 mb-2">
            <span className="text-2xl flex-shrink-0">🤝</span>
            <h4 className="text-gray-900 font-semibold flex-1">{title}</h4>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            {description}
          </p>

          {/* Participants */}
          {participants && participants.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {participants.map((participant: string, idx: number) => (
                <span key={idx} className="text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded-full font-medium">
                  {participant}
                </span>
              ))}
            </div>
          )}

          {/* Timestamp */}
          {timestamp && (
            <p className="text-xs text-gray-600">
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
