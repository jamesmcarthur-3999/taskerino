/**
 * HeroCelebration - For achievements
 *
 * Features:
 * - Extra vibrant colors
 * - Large achievement callout
 * - Optional CSS confetti
 * - Celebratory emoji support
 * - Dramatic entrance
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Sparkles } from 'lucide-react';
import { getRadiusClass } from '../../../design-system/theme';
import { bounceInVariants, scaleUpVariants } from '../../morphing-canvas/animations/transitions';

export interface ThemeConfig {
  primary: string;
  secondary: string;
  mode?: 'light' | 'dark';
  primaryColor?: string;
}

export interface HeroCelebrationProps {
  title: string;
  achievement: string;
  confetti?: boolean;
  theme: ThemeConfig;
}

export function HeroCelebration({ title, achievement, confetti = false, theme }: HeroCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (confetti) {
      setShowConfetti(true);
      // Remove confetti after animation completes
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [confetti]);

  return (
    <motion.div
      variants={scaleUpVariants}
      initial="hidden"
      animate="visible"
      className={`relative overflow-hidden ${getRadiusClass('card')} shadow-2xl`}
      style={{
        background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
        minHeight: '280px',
      }}
    >
      {/* Animated sparkle overlay */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.3) 0%, transparent 50%)`,
            `radial-gradient(circle at 80% 70%, rgba(255,255,255,0.3) 0%, transparent 50%)`,
            `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.3) 0%, transparent 50%)`,
          ],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* CSS Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: -10,
                backgroundColor: [
                  '#FFD700',
                  '#FF69B4',
                  '#00CED1',
                  '#FF6347',
                  '#9370DB',
                  '#FFB6C1',
                ][Math.floor(Math.random() * 6)],
              }}
              animate={{
                y: ['0vh', '110vh'],
                x: [0, (Math.random() - 0.5) * 100],
                rotate: [0, Math.random() * 360],
                opacity: [1, 0.8, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                delay: Math.random() * 0.5,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 p-8 text-white h-full flex flex-col justify-center items-center text-center">
        {/* Trophy icon */}
        <motion.div
          variants={bounceInVariants}
          className="mb-6"
        >
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl">
            <Trophy size={40} className="text-white drop-shadow-lg" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          variants={scaleUpVariants}
          transition={{ delay: 0.2 }}
          className="text-4xl font-bold mb-4 drop-shadow-lg flex items-center gap-3"
        >
          {title}
          <Sparkles size={32} className="text-yellow-300 drop-shadow-lg" />
        </motion.h1>

        {/* Achievement callout */}
        <motion.div
          variants={bounceInVariants}
          transition={{ delay: 0.3 }}
          className="max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-6 py-4 bg-white/20 backdrop-blur-md rounded-full shadow-2xl border-2 border-white/40">
            <span className="text-3xl">🎉</span>
            <span className="text-xl font-bold">{achievement}</span>
            <span className="text-3xl">🎉</span>
          </div>
        </motion.div>

        {/* Celebratory message */}
        <motion.p
          variants={scaleUpVariants}
          transition={{ delay: 0.4 }}
          className="text-lg text-white/90 mt-6 drop-shadow max-w-xl"
        >
          Outstanding work! This milestone represents significant progress and dedication.
        </motion.p>
      </div>
    </motion.div>
  );
}
