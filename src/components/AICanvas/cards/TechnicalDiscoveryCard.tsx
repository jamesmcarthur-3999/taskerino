/**
 * Technical Discovery Card Component
 *
 * Glass card with emerald left border for displaying technical discoveries
 */

import React from 'react';
import { Code2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';
import type { SessionScreenshot } from '../../../types';
import { ScreenshotThumbnail } from '../ScreenshotThumbnail';

export interface TechnicalDiscoveryCardProps {
  title: string;
  technology: string;
  finding: string;
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

export function TechnicalDiscoveryCard({
  title,
  technology,
  finding,
  timestamp,
  relatedScreenshots,
  onClickScreenshot,
  theme,
}: TechnicalDiscoveryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 border-l-4 border-emerald-500 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
          <Code2 size={18} className="text-emerald-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title and Technology Badge */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h4 className="text-gray-900 font-semibold flex-1">{title}</h4>
            <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full font-medium flex-shrink-0">
              {technology}
            </span>
          </div>

          {/* Finding with icon */}
          <div className="flex items-start gap-2 mb-2">
            <span className="text-lg flex-shrink-0">🔍</span>
            <p className="text-sm text-gray-700 leading-relaxed flex-1">
              {finding}
            </p>
          </div>

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
                  <ScreenshotThumbnail
                    key={screenshot.id}
                    screenshot={screenshot}
                    size="sm"
                    onClick={() => onClickScreenshot?.(screenshot)}
                    showIcon
                  />
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
