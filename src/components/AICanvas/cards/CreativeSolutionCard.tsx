/**
 * Creative Solution Card Component
 *
 * Glass card with pink left border for displaying creative solutions
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';
import type { SessionScreenshot } from '../../../types';

export interface CreativeSolutionCardProps {
  title: string;
  description: string;
  approach?: string;
  outcome?: string;
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

export function CreativeSolutionCard({
  title,
  description,
  approach,
  outcome,
  timestamp,
  relatedScreenshots,
  onClickScreenshot,
  theme,
}: CreativeSolutionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 border-l-4 border-pink-500 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
          <Sparkles size={18} className="text-pink-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title with emoji */}
          <div className="flex items-start gap-2 mb-2">
            <span className="text-2xl flex-shrink-0">✨</span>
            <h4 className="text-gray-900 font-semibold flex-1">{title}</h4>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            {description}
          </p>

          {/* Approach */}
          {approach && (
            <div className="bg-pink-50 rounded p-3 mb-2">
              <div className="text-xs font-semibold text-pink-700 mb-1">Approach</div>
              <p className="text-sm text-gray-700">{approach}</p>
            </div>
          )}

          {/* Outcome */}
          {outcome && (
            <div className="bg-green-50 rounded p-3 mb-2">
              <div className="text-xs font-semibold text-green-700 mb-1">Outcome</div>
              <p className="text-sm text-gray-700">{outcome}</p>
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
                    className="w-6 h-6 rounded bg-white/20 hover:bg-white/30 hover:scale-105 transition-all duration-200 cursor-pointer border border-white/20 text-xs text-gray-700 flex items-center justify-center"
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
