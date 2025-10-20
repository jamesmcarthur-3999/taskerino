/**
 * Problem Solution Card Component
 *
 * Glass card with orange→green gradient for showing problem-solving journey
 */

import React from 'react';
import { Wrench, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';

export interface ProblemSolutionCardProps {
  problem: string;
  solution: string;
  timeToResolve?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  timestamp?: string;
  theme?: ThemeConfig;
}

interface ThemeConfig {
  colorScheme?: 'ocean' | 'sunset' | 'forest' | 'lavender' | 'monochrome';
  mode?: 'light' | 'dark';
  primaryColor?: string;
}

export function ProblemSolutionCard({
  problem,
  solution,
  timeToResolve,
  difficulty = 'medium',
  timestamp,
  theme,
}: ProblemSolutionCardProps) {
  // Difficulty determines badge color
  const difficultyStyles = {
    easy: {
      badge: 'bg-green-100 text-green-700',
      label: 'Easy',
    },
    medium: {
      badge: 'bg-yellow-100 text-yellow-700',
      label: 'Medium',
    },
    hard: {
      badge: 'bg-red-100 text-red-700',
      label: 'Hard',
    },
  };

  const difficultyStyle = difficultyStyles[difficulty];

  // Format time to resolve
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`${getGlassClasses('subtle')} ${getRadiusClass('card')} p-6 border-l-4 border-gradient-to-b from-orange-500 to-green-500 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default bg-gradient-to-r from-orange-50/30 to-green-50/30`}
      style={{
        borderImage: 'linear-gradient(to bottom, rgb(249, 115, 22), rgb(34, 197, 94)) 1',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-100 to-green-100 flex items-center justify-center">
          <Wrench size={18} className="text-orange-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {difficulty && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${difficultyStyle.badge}`}>
                {difficultyStyle.label}
              </span>
            )}
            {timeToResolve !== undefined && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                ⏱️ {formatTime(timeToResolve)}
              </span>
            )}
          </div>

          {/* Two-Part Layout: Problem | Solution */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-3 items-start">
            {/* Problem */}
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-2">
                Problem
              </p>
              <p className="text-sm text-gray-800 leading-relaxed">
                {problem}
              </p>
            </div>

            {/* Arrow Transition */}
            <div className="hidden md:flex items-center justify-center py-4">
              <ArrowRight size={20} className="text-gray-400" />
            </div>

            {/* Solution */}
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">
                Solution
              </p>
              <p className="text-sm text-gray-800 leading-relaxed">
                {solution}
              </p>
            </div>
          </div>

          {/* Timestamp */}
          {timestamp && (
            <p className="text-xs text-gray-500 mt-3">
              {new Date(timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
