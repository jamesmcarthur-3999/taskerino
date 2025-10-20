/**
 * Flow State Card Component
 *
 * Glass card with blue/cyan accent for representing periods of deep focus
 */

import React from 'react';
import { Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';

export interface FlowStateCardProps {
  duration: number;
  activity: string;
  focusScore: number; // 0-100
  screenshotSequence?: string[];
  timestamp?: string;
  theme?: CanvasTheme;
  onClickScreenshot?: (id: string) => void;
}

interface CanvasTheme {
  colorScheme?: 'ocean' | 'sunset' | 'forest' | 'lavender' | 'monochrome';
  mode?: 'light' | 'dark';
  primaryColor?: string;
}

export function FlowStateCard({
  duration,
  activity,
  focusScore,
  screenshotSequence,
  timestamp,
  theme,
  onClickScreenshot,
}: FlowStateCardProps) {
  // Format duration in minutes to readable format
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Focus score color coding
  const getFocusColor = (score: number) => {
    if (score >= 80) return { bg: 'bg-cyan-500', text: 'text-cyan-600', ring: 'stroke-cyan-500' };
    if (score >= 60) return { bg: 'bg-blue-500', text: 'text-blue-600', ring: 'stroke-blue-500' };
    if (score >= 40) return { bg: 'bg-indigo-500', text: 'text-indigo-600', ring: 'stroke-indigo-500' };
    return { bg: 'bg-gray-500', text: 'text-gray-600', ring: 'stroke-gray-500' };
  };

  const focusColor = getFocusColor(focusScore);

  // Calculate progress ring properties
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (focusScore / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${getGlassClasses('subtle')} ${getRadiusClass('card')} p-6 border-l-4 border-cyan-500 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}
    >
      <div className="flex items-start gap-4">
        {/* Focus Score Ring */}
        <div className="flex-shrink-0 relative">
          <svg width="64" height="64" className="transform -rotate-90">
            {/* Background ring */}
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="4"
            />
            {/* Progress ring */}
            <motion.circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              className={focusColor.ring}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - progress }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
          {/* Score percentage */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-sm font-bold ${focusColor.text}`}>
              {focusScore}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Duration Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700 uppercase tracking-wide">
              Flow State
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Activity Description */}
          <p className="text-gray-900 font-medium leading-relaxed text-base mb-2">
            {activity}
          </p>

          {/* Focus Score Label */}
          <p className="text-sm text-gray-600">
            Focus Score: <span className={`font-semibold ${focusColor.text}`}>{focusScore}/100</span>
          </p>

          {/* Screenshot Sequence */}
          {screenshotSequence && screenshotSequence.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-600 mb-2">Session progression:</p>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {screenshotSequence.map((screenshotId, index) => (
                  <button
                    key={screenshotId}
                    onClick={() => onClickScreenshot?.(screenshotId)}
                    className="flex-shrink-0 w-10 h-10 rounded bg-white/20 hover:bg-white/30 hover:scale-105 transition-all duration-200 cursor-pointer border border-white/20 flex flex-col items-center justify-center relative group"
                    title={`Screenshot ${index + 1}`}
                  >
                    <span className="text-[10px]">📸</span>
                    <span className="text-[8px] text-cyan-700 font-semibold">{index + 1}</span>
                  </button>
                ))}
              </div>
            </div>
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
        </div>
      </div>
    </motion.div>
  );
}
