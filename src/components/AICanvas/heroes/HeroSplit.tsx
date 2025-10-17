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
}

export interface HeroSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  theme: ThemeConfig;
}

export function HeroSplit({ left, right, theme }: HeroSplitProps) {
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
        {/* Left column */}
        <motion.div
          variants={slideInLeftVariants}
          className={`${getGlassClasses('strong')} ${getRadiusClass('field')} p-6 shadow-xl`}
        >
          {left}
        </motion.div>

        {/* Right column */}
        <motion.div
          variants={slideInRightVariants}
          className={`${getGlassClasses('strong')} ${getRadiusClass('field')} p-6 shadow-xl`}
        >
          {right}
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
