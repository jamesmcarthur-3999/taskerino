/**
 * HeroFocus - For deep work sessions
 *
 * Features:
 * - Large centered task name
 * - Focus score visualization (progress ring)
 * - Duration with clock icon
 * - Achievement callout
 * - Optional screenshot timeline
 * - Blue/cyan gradient (focus/concentration)
 * - Calm, centered, productive mood
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Target, TrendingUp } from 'lucide-react';
import { getRadiusClass, getGlassClasses, TRANSITIONS } from '../../../design-system/theme';
import { fadeInVariants, scaleUpVariants, slideUpVariants } from '../../morphing-canvas/animations/transitions';

export interface ThemeConfig {
  primary: string;
  secondary: string;
  mode?: 'light' | 'dark';
  primaryColor?: string;
}

export interface HeroFocusProps {
  taskName: string;
  duration: number; // in minutes
  achievement: string;
  focusScore: number; // 0-100
  screenshotSequence?: string[];
  theme: ThemeConfig;
}

export function HeroFocus({
  taskName,
  duration,
  achievement,
  focusScore,
  screenshotSequence = [],
  theme,
}: HeroFocusProps) {
  // Format duration
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  // Calculate progress ring circumference
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (focusScore / 100) * circumference;

  return (
    <motion.div
      variants={fadeInVariants}
      initial="hidden"
      animate="visible"
      className={`relative overflow-hidden ${getRadiusClass('card')} shadow-2xl`}
      style={{
        background: `linear-gradient(135deg, #0891b2 0%, #0284c7 100%)`,
        minHeight: '320px',
      }}
    >
      {/* Animated gradient overlay */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            `radial-gradient(circle at 30% 40%, rgba(255,255,255,0.15) 0%, transparent 60%)`,
            `radial-gradient(circle at 70% 60%, rgba(255,255,255,0.15) 0%, transparent 60%)`,
            `radial-gradient(circle at 30% 40%, rgba(255,255,255,0.15) 0%, transparent 60%)`,
          ],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-12 text-white h-full flex flex-col items-center justify-center text-center">
        {/* Focus Score Ring */}
        <motion.div
          variants={scaleUpVariants}
          className="relative mb-8"
        >
          <svg width="120" height="120" className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="8"
              fill="none"
            />
            {/* Progress circle */}
            <motion.circle
              cx="60"
              cy="60"
              r={radius}
              stroke="white"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
            />
          </svg>
          {/* Center icon and score */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Target size={28} className="text-white mb-1" />
            <span className="text-2xl font-bold">{focusScore}</span>
            <span className="text-xs opacity-90">Focus</span>
          </div>
        </motion.div>

        {/* Task Name */}
        <motion.h1
          variants={slideUpVariants}
          transition={{ delay: 0.2 }}
          className="text-4xl font-bold mb-4 drop-shadow-lg max-w-2xl"
        >
          {taskName}
        </motion.h1>

        {/* Duration */}
        <motion.div
          variants={fadeInVariants}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-3 mb-6 px-6 py-3 bg-white/20 backdrop-blur-md rounded-full shadow-xl"
        >
          <Clock size={24} className="text-white drop-shadow" />
          <span className="text-2xl font-bold">{durationText}</span>
        </motion.div>

        {/* Achievement */}
        <motion.div
          variants={slideUpVariants}
          transition={{ delay: 0.4 }}
          className="max-w-xl"
        >
          <div className={`${getGlassClasses('medium')} ${getRadiusClass('field')} px-6 py-3 shadow-xl border-2 border-white/40`}>
            <div className="flex items-center gap-2 text-lg">
              <TrendingUp size={20} className="text-cyan-200" />
              <span className="font-semibold">{achievement}</span>
            </div>
          </div>
        </motion.div>

        {/* Optional Screenshot Timeline */}
        {screenshotSequence.length > 0 && (
          <motion.div
            variants={fadeInVariants}
            transition={{ delay: 0.5 }}
            className="mt-8 flex gap-2 overflow-x-auto max-w-2xl px-4"
          >
            {screenshotSequence.slice(0, 5).map((screenshot, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-white/40 shadow-lg"
              >
                <img
                  src={`/api/attachments/${screenshot}`}
                  alt={`Progress ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
