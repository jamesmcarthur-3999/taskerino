/**
 * HeroProblemSolver - For debugging/problem-solving sessions
 *
 * Features:
 * - Problem statement in prominent position
 * - Status indicator (solved/in-progress) with appropriate icon
 * - "Approaches tried" counter with visual representation
 * - Breakthrough moment highlighted if exists
 * - Before/after split or puzzle pieces coming together
 * - Amber→green gradient (challenge→success)
 * - Determined, triumphant mood
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, CheckCircle, Clock, AlertCircle, Lightbulb } from 'lucide-react';
import { getRadiusClass, getGlassClasses, TRANSITIONS } from '../../../design-system/theme';
import { fadeInVariants, scaleUpVariants, slideUpVariants, bounceInVariants } from '../../morphing-canvas/animations/transitions';

export interface ThemeConfig {
  primary: string;
  secondary: string;
  mode?: 'light' | 'dark';
  primaryColor?: string;
}

export interface HeroProblemSolverProps {
  problemStatement: string;
  solutionFound: boolean;
  approachesTried: number;
  duration: number; // in minutes
  breakthroughMoment?: string;
  theme: ThemeConfig;
}

export function HeroProblemSolver({
  problemStatement,
  solutionFound,
  approachesTried,
  duration,
  breakthroughMoment,
  theme,
}: HeroProblemSolverProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  // Format duration
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  // Trigger confetti if solved
  useEffect(() => {
    if (solutionFound) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [solutionFound]);

  // Dynamic gradient based on solution status
  const gradientColors = solutionFound
    ? 'linear-gradient(135deg, #f59e0b 0%, #10b981 100%)' // Amber to green
    : 'linear-gradient(135deg, #f59e0b 0%, #fb923c 100%)'; // Amber gradient

  return (
    <motion.div
      variants={fadeInVariants}
      initial="hidden"
      animate="visible"
      className={`relative overflow-hidden ${getRadiusClass('card')} shadow-2xl`}
      style={{
        background: gradientColors,
        minHeight: '320px',
      }}
    >
      {/* Confetti effect for solved problems */}
      {showConfetti && solutionFound && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: -10,
                backgroundColor: [
                  '#10b981',
                  '#34d399',
                  '#fbbf24',
                  '#f59e0b',
                  '#60a5fa',
                ][Math.floor(Math.random() * 5)],
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

      {/* Animated puzzle pieces pattern */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: solutionFound
            ? [
                `radial-gradient(circle at 20% 30%, rgba(16,185,129,0.3) 0%, transparent 50%)`,
                `radial-gradient(circle at 80% 70%, rgba(16,185,129,0.3) 0%, transparent 50%)`,
                `radial-gradient(circle at 20% 30%, rgba(16,185,129,0.3) 0%, transparent 50%)`,
              ]
            : [
                `radial-gradient(circle at 30% 40%, rgba(251,146,60,0.2) 0%, transparent 50%)`,
                `radial-gradient(circle at 70% 60%, rgba(251,146,60,0.2) 0%, transparent 50%)`,
                `radial-gradient(circle at 30% 40%, rgba(251,146,60,0.2) 0%, transparent 50%)`,
              ],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-8 text-white h-full">
        {/* Header with status */}
        <motion.div
          variants={scaleUpVariants}
          className="flex items-start justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xl">
              {solutionFound ? (
                <CheckCircle size={28} className="text-green-100 drop-shadow-lg" />
              ) : (
                <AlertCircle size={28} className="text-amber-100 drop-shadow-lg" />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold opacity-90 uppercase tracking-wide">
                {solutionFound ? 'Solved' : 'In Progress'}
              </div>
              <div className="flex items-center gap-2 text-lg mt-1">
                <Clock size={18} />
                <span className="font-semibold">{durationText}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Problem Statement */}
        <motion.div
          variants={slideUpVariants}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h3 className="text-sm font-semibold mb-2 opacity-90 uppercase tracking-wide">
            Problem
          </h3>
          <div className={`${getGlassClasses('strong')} ${getRadiusClass('field')} p-4 shadow-xl`}>
            <p className="text-xl font-bold leading-relaxed">{problemStatement}</p>
          </div>
        </motion.div>

        {/* Two column layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left column - Approaches */}
          <motion.div
            variants={bounceInVariants}
            transition={{ delay: 0.2 }}
            className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-6 shadow-xl`}
          >
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap size={20} className="text-amber-200" />
                <h3 className="text-sm font-semibold opacity-90 uppercase tracking-wide">
                  Approaches Tried
                </h3>
              </div>
              <div className="text-5xl font-bold mb-3">{approachesTried}</div>

              {/* Visual representation of attempts */}
              <div className="flex justify-center gap-1.5 flex-wrap">
                {Array.from({ length: Math.min(approachesTried, 10) }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.05, type: 'spring' }}
                    className="w-3 h-3 rounded-full bg-white/60 shadow"
                  />
                ))}
                {approachesTried > 10 && (
                  <span className="text-xs opacity-90 ml-1">+{approachesTried - 10}</span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Right column - Breakthrough or Status */}
          <motion.div
            variants={slideUpVariants}
            transition={{ delay: 0.3 }}
            className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-6 shadow-xl flex flex-col justify-center`}
          >
            {breakthroughMoment ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={24} className="text-yellow-200" />
                  <h3 className="text-sm font-semibold opacity-90 uppercase tracking-wide">
                    Breakthrough
                  </h3>
                </div>
                <p className="text-base leading-relaxed italic">
                  "{breakthroughMoment}"
                </p>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="text-6xl mb-2">{solutionFound ? '🎯' : '🔍'}</div>
                  <p className="text-base font-semibold">
                    {solutionFound
                      ? 'Problem solved successfully!'
                      : 'Working towards solution...'}
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* Success message */}
        {solutionFound && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-center"
          >
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-500/30 backdrop-blur-md rounded-full shadow-xl border-2 border-green-300/40">
              <CheckCircle size={20} className="text-green-100" />
              <span className="font-bold text-lg">Solution Achieved</span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
