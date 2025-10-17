/**
 * HeroTimeline - For coding/work sessions
 *
 * Features:
 * - Bold gradient background
 * - Large title and narrative
 * - Stats bar at bottom
 * - Animated overlay
 * - Framer Motion entrance
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Camera, TrendingUp } from 'lucide-react';
import { getRadiusClass } from '../../../design-system/theme';
import { fadeInVariants, slideUpVariants } from '../../morphing-canvas/animations/transitions';

export interface HeroTimelineProps {
  title: string;
  narrative: string;
  stats: {
    duration: string;
    screenshots: number;
    intensity: string;
  };
  theme: {
    primary: string;
    secondary: string;
  };
}

export function HeroTimeline({ title, narrative, stats, theme }: HeroTimelineProps) {
  return (
    <motion.div
      variants={slideUpVariants}
      initial="hidden"
      animate="visible"
      className={`relative overflow-hidden ${getRadiusClass('card')} shadow-2xl`}
      style={{
        background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
        minHeight: '280px',
      }}
    >
      {/* Animated gradient overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10"
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%'],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'linear',
        }}
        style={{
          backgroundSize: '200% 200%',
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-8 text-white h-full flex flex-col justify-between">
        {/* Top content */}
        <div>
          {/* Title */}
          <motion.h1
            variants={fadeInVariants}
            className="text-4xl font-bold mb-4 drop-shadow-lg"
          >
            {title}
          </motion.h1>

          {/* Narrative */}
          <motion.p
            variants={fadeInVariants}
            transition={{ delay: 0.1 }}
            className="text-lg text-white/90 leading-relaxed max-w-3xl drop-shadow"
          >
            {narrative}
          </motion.p>
        </div>

        {/* Stats bar */}
        <motion.div
          variants={slideUpVariants}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-6 text-sm font-medium mt-6"
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-white/20 backdrop-blur-md rounded-full">
            <Clock size={16} />
            <span>{stats.duration}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white/20 backdrop-blur-md rounded-full">
            <Camera size={16} />
            <span>{stats.screenshots} captures</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white/20 backdrop-blur-md rounded-full">
            <TrendingUp size={16} />
            <span>{stats.intensity}</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
