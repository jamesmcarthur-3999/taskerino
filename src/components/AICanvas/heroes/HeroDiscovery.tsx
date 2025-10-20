/**
 * HeroDiscovery - For learning/research sessions
 *
 * Features:
 * - Title with exploration/compass icon
 * - Topics displayed as colorful pills
 * - Insights count with lightbulb icon
 * - Resources as book/link count
 * - Connected nodes or constellation pattern
 * - Purple gradient (curiosity/discovery)
 * - Curious, exploratory, enlightened mood
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Compass, Lightbulb, BookOpen, Clock } from 'lucide-react';
import { getRadiusClass, getGlassClasses, TRANSITIONS } from '../../../design-system/theme';
import { fadeInVariants, scaleUpVariants, bounceInVariants } from '../../morphing-canvas/animations/transitions';

export interface ThemeConfig {
  primary: string;
  secondary: string;
  mode?: 'light' | 'dark';
  primaryColor?: string;
}

export interface HeroDiscoveryProps {
  title: string;
  topicsExplored: string[];
  keyInsights: string[];
  resourcesUsed: number;
  duration: number; // in minutes
  theme: ThemeConfig;
}

export function HeroDiscovery({
  title,
  topicsExplored,
  keyInsights,
  resourcesUsed,
  duration,
  theme,
}: HeroDiscoveryProps) {
  // Format duration
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  // Topic colors for variety
  const topicColors = [
    'from-purple-400/80 to-pink-400/80 border-purple-300/60',
    'from-violet-400/80 to-indigo-400/80 border-violet-300/60',
    'from-fuchsia-400/80 to-purple-400/80 border-fuchsia-300/60',
    'from-pink-400/80 to-rose-400/80 border-pink-300/60',
    'from-indigo-400/80 to-blue-400/80 border-indigo-300/60',
  ];

  return (
    <motion.div
      variants={fadeInVariants}
      initial="hidden"
      animate="visible"
      className={`relative overflow-hidden ${getRadiusClass('card')} shadow-2xl`}
      style={{
        background: `linear-gradient(135deg, #9333ea 0%, #c026d3 100%)`,
        minHeight: '320px',
      }}
    >
      {/* Constellation pattern overlay */}
      <div className="absolute inset-0">
        {/* Animated dots representing knowledge nodes */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white/40 rounded-full"
            style={{
              left: `${15 + (i * 7) % 70}%`,
              top: `${20 + (i * 11) % 60}%`,
            }}
            animate={{
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 3 + (i % 3),
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
        {/* Connecting lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20">
          <motion.line
            x1="20%"
            y1="30%"
            x2="40%"
            y2="50%"
            stroke="white"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, delay: 0.5 }}
          />
          <motion.line
            x1="40%"
            y1="50%"
            x2="60%"
            y2="40%"
            stroke="white"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, delay: 0.8 }}
          />
          <motion.line
            x1="60%"
            y1="40%"
            x2="75%"
            y2="60%"
            stroke="white"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, delay: 1.1 }}
          />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 p-8 text-white h-full">
        {/* Header with icon and title */}
        <motion.div
          variants={scaleUpVariants}
          className="flex items-center gap-4 mb-6"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xl">
            <Compass size={32} className="text-white drop-shadow-lg" />
          </div>
          <h1 className="text-3xl font-bold drop-shadow-lg flex-1">{title}</h1>
        </motion.div>

        {/* Two column layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left column - Topics & Insights */}
          <motion.div
            variants={fadeInVariants}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            {/* Topics */}
            <div>
              <h3 className="text-sm font-semibold mb-2 opacity-90 uppercase tracking-wide">
                Topics Explored
              </h3>
              <div className="flex flex-wrap gap-2">
                {topicsExplored.slice(0, 5).map((topic, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className={`px-3 py-1.5 bg-gradient-to-r ${topicColors[index % topicColors.length]} backdrop-blur-md rounded-full text-sm font-medium shadow-lg border-2`}
                  >
                    {topic}
                  </motion.div>
                ))}
                {topicsExplored.length > 5 && (
                  <div className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-sm font-medium">
                    +{topicsExplored.length - 5} more
                  </div>
                )}
              </div>
            </div>

            {/* Key Insights */}
            <div>
              <h3 className="text-sm font-semibold mb-2 opacity-90 uppercase tracking-wide flex items-center gap-2">
                <Lightbulb size={16} />
                Key Insights
              </h3>
              <div className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 space-y-2`}>
                {keyInsights.slice(0, 3).map((insight, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="text-sm leading-relaxed border-l-2 border-white/40 pl-3"
                  >
                    {insight}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right column - Stats */}
          <motion.div
            variants={bounceInVariants}
            transition={{ delay: 0.3 }}
            className={`${getGlassClasses('strong')} ${getRadiusClass('field')} p-6 shadow-xl flex flex-col justify-center space-y-6`}
          >
            {/* Resources Used */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                <BookOpen size={28} className="text-white" />
              </div>
              <div className="text-4xl font-bold mb-1">{resourcesUsed}</div>
              <div className="text-sm opacity-90">Resources Explored</div>
            </div>

            {/* Duration */}
            <div className="text-center pt-6 border-t border-white/30">
              <div className="flex items-center justify-center gap-2 text-lg">
                <Clock size={20} />
                <span className="font-semibold">{durationText}</span>
              </div>
              <div className="text-sm opacity-90 mt-1">Discovery Time</div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
