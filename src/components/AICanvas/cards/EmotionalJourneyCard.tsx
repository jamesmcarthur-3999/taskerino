/**
 * Emotional Journey Card Component
 *
 * Glass card with colored background for displaying emotional phases
 */

import React from 'react';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';
import type { SessionScreenshot } from '../../../types';
import { ScreenshotThumbnail } from '../ScreenshotThumbnail';

export interface EmotionalJourneyCardProps {
  emotion: 'frustrated' | 'confused' | 'focused' | 'excited' | 'satisfied' | 'neutral';
  context: string;
  startTime: string;
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

const emotionColors = {
  frustrated: { bg: 'bg-red-500', text: 'text-red-900', emoji: '😤' },
  confused: { bg: 'bg-orange-400', text: 'text-orange-900', emoji: '🤔' },
  focused: { bg: 'bg-blue-500', text: 'text-blue-900', emoji: '🎯' },
  excited: { bg: 'bg-yellow-400', text: 'text-yellow-900', emoji: '🤩' },
  satisfied: { bg: 'bg-green-500', text: 'text-green-900', emoji: '😊' },
  neutral: { bg: 'bg-gray-400', text: 'text-gray-900', emoji: '😐' },
};

export function EmotionalJourneyCard({
  emotion,
  context,
  startTime,
  timestamp,
  relatedScreenshots,
  onClickScreenshot,
  theme,
}: EmotionalJourneyCardProps) {
  const colors = emotionColors[emotion];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${getGlassClasses('medium')} ${getRadiusClass('field')} overflow-hidden hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}
    >
      <div className={`${colors.bg} p-4`}>
        <div className="flex items-center justify-between mb-2">
          {/* Emotion */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">{colors.emoji}</span>
            <span className={`font-semibold ${colors.text} capitalize`}>{emotion}</span>
          </div>

          {/* Time */}
          <span className={`text-sm ${colors.text} opacity-90`}>
            {new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Context */}
        <p className={`text-sm ${colors.text}`}>{context}</p>

        {/* Related Screenshots */}
        {relatedScreenshots && relatedScreenshots.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <span className={`text-xs ${colors.text} opacity-90`}>Related:</span>
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
                <span className={`text-xs ${colors.text} opacity-75`}>
                  +{relatedScreenshots.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
