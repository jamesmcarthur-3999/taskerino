/**
 * HeroSplit - For balanced content
 *
 * Features:
 * - Two-column layout (50/50)
 * - Glass morphism styling
 * - Gradient background
 * - Responsive (stack on mobile)
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ImageOff } from 'lucide-react';
import { getRadiusClass, getGlassClasses } from '../../../design-system/theme';
import { fadeInVariants, slideInLeftVariants, slideInRightVariants } from '../../morphing-canvas/animations/transitions';
import { attachmentStorage } from '../../../services/attachmentStorage';

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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Load featured image from attachment storage
  useEffect(() => {
    if (!featuredImage) {
      setImageUrl(null);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    attachmentStorage
      .getAttachment(featuredImage)
      .then((attachment) => {
        if (!attachment || !attachment.base64) {
          console.warn('[HeroSplit] No attachment data found for:', featuredImage);
          setHasError(true);
          setImageUrl(null);
          return;
        }

        // Create data URL from base64
        const mimeType = attachment.mimeType || 'image/png';
        const dataUrl = `data:${mimeType};base64,${attachment.base64}`;
        setImageUrl(dataUrl);
      })
      .catch((error) => {
        console.error('[HeroSplit] Failed to load featured image:', error);
        setHasError(true);
        setImageUrl(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [featuredImage]);

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
            <div className="w-full h-full rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
              ) : hasError ? (
                <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                  <ImageOff className="w-12 h-12" />
                  <p className="text-sm">Failed to load image</p>
                </div>
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Featured"
                  className="w-full h-full object-cover"
                  onError={() => setHasError(true)}
                />
              ) : null}
            </div>
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
