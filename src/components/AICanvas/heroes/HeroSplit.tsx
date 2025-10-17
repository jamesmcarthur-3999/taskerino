/**
 * HeroSplit - For balanced content
 *
 * Features:
 * - Two-column layout (50/50)
 * - Glass morphism styling
 * - Gradient background
 * - Responsive (stack on mobile)
 */

import React from 'react';
import { motion } from 'framer-motion';
import { getRadiusClass, getGlassClasses } from '../../../design-system/theme';
import { fadeInVariants, slideInLeftVariants, slideInRightVariants } from '../../morphing-canvas/animations/transitions';

export interface ThemeConfig {
  primary: string;
  secondary: string;
  mode?: 'light' | 'dark';
  primaryColor?: string;
}

export interface HeroSplitProps {
  title: string;
  narrative: string;
  stats: {
    duration: string;
    screenshots: number;
    date?: string;
  };
  theme: ThemeConfig;
  featuredImage?: string;
}

export function HeroSplit({ title, narrative, stats, theme, featuredImage }: HeroSplitProps) {
  return (
    <motion.div
      variants={fadeInVariants}
      initial="hidden"
      animate="visible"
      className={`relative overflow-hidden ${getRadiusClass('card')} shadow-2xl`}
      style={{
        background: `linear-gradient(135deg, ${theme.primary}15 0%, ${theme.secondary}15 100%)`,
        minHeight: '280px',
      }}
    >
      {/* Gradient background */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(circle at 0% 0%, ${theme.primary}20, transparent 50%),
                       radial-gradient(circle at 100% 100%, ${theme.secondary}20, transparent 50%)`,
        }}
      />

      {/* Two column layout */}
      <div className="relative z-10 grid md:grid-cols-2 gap-6 p-8 h-full min-h-[280px]">
        {/* Left column - Text content */}
        <motion.div
          variants={slideInLeftVariants}
          className={`${getGlassClasses('strong')} ${getRadiusClass('field')} p-6 shadow-xl flex flex-col justify-center`}
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{title}</h1>
          <p className="text-base text-gray-700 leading-relaxed">{narrative}</p>
          {stats.date && (
            <p className="text-sm text-gray-500 mt-4">{stats.date}</p>
          )}
        </motion.div>

        {/* Right column - Stats or featured image */}
        <motion.div
          variants={slideInRightVariants}
          className={`${getGlassClasses('strong')} ${getRadiusClass('field')} p-6 shadow-xl flex flex-col justify-center`}
        >
          {featuredImage ? (
            <img
              src={`/api/attachments/${featuredImage}`}
              alt="Featured"
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900">{stats.duration}</div>
                <div className="text-sm text-gray-600">Session Duration</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900">{stats.screenshots}</div>
                <div className="text-sm text-gray-600">Screenshots Captured</div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Responsive: Stack on mobile */}
      <style>{`
        @media (max-width: 768px) {
          .grid.md\\:grid-cols-2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </motion.div>
  );
}
