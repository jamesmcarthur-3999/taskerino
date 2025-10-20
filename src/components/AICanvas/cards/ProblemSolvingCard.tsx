/**
 * Problem Solving Card Component
 *
 * Glass card with blue left border for displaying problem-solving journey
 */

import React from 'react';
import { Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';
import type { SessionScreenshot } from '../../../types';

export interface ProblemSolvingCardProps {
  problem: string;
  approach: Array<{
    step: number;
    action: string;
    outcome: string;
  }>;
  resolution?: string;
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

export function ProblemSolvingCard({
  problem,
  approach,
  resolution,
  timestamp,
  relatedScreenshots,
  onClickScreenshot,
  theme,
}: ProblemSolvingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 border-l-4 border-blue-500 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <Target size={18} className="text-blue-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Problem */}
          <div>
            <h4 className="text-gray-900 font-semibold mb-1">Problem:</h4>
            <p className="text-sm text-gray-700">{problem}</p>
          </div>

          {/* Approach Steps */}
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Approach</h5>
            {approach.map((step, idx) => (
              <div
                key={idx}
                className={`${getGlassClasses('subtle')} ${getRadiusClass('field')} p-3`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{step.action}</div>
                    <div className="text-xs text-gray-600 mt-1">{step.outcome}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resolution */}
          {resolution && (
            <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
              <div className="font-semibold text-green-900 text-sm mb-1">✓ Resolution</div>
              <div className="text-sm text-green-800">{resolution}</div>
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
