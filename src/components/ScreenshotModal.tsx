/**
 * ScreenshotModal - Full-screen screenshot viewer with AI analysis
 *
 * Rendered as React portal at document root for true full-screen display.
 * Shows relevant AI analysis details in a clean, scannable layout.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Lightbulb, TrendingUp } from 'lucide-react';
import { MODAL_OVERLAY, getGlassClasses, getRadiusClass } from '../design-system/theme';
import type { SessionScreenshot } from '../types';
import {
  modalBackdropVariants,
  modalContentViewerVariants
} from '../animations/variants';

interface ScreenshotModalProps {
  screenshot: SessionScreenshot;
  imageUrl: string;
  onClose: () => void;
}

export function ScreenshotModal({ screenshot, imageUrl, onClose }: ScreenshotModalProps) {
  const { timestamp, aiAnalysis } = screenshot;

  // Extract key insights to display (max 3-5 pieces of useful info)
  const hasBlockers = aiAnalysis?.progressIndicators?.blockers?.length ?? 0 > 0;
  const hasAchievements = aiAnalysis?.progressIndicators?.achievements?.length ?? 0 > 0;
  const hasInsights = aiAnalysis?.progressIndicators?.insights?.length ?? 0 > 0;
  const hasContextDelta = !!aiAnalysis?.contextDelta;

  const modalContent = (
    <AnimatePresence>
      {/* Animated Backdrop */}
      <motion.div
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={modalBackdropVariants.smooth}
        className={`${MODAL_OVERLAY} z-[9999] flex items-center justify-center bg-black/90`}
        onClick={onClose}
      >
        {/* Close button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 25 }}
          onClick={onClose}
          className={`absolute top-6 right-6 w-12 h-12 ${getRadiusClass('pill')} ${getGlassClasses('subtle')} flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-10`}
        >
          <X size={24} className="text-white" />
        </motion.button>

        {/* Main content container - Animated */}
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={modalContentViewerVariants}
          className="w-full h-full flex flex-col p-8 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Screenshot - takes most of the space with reveal animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05, type: 'spring', stiffness: 200, damping: 25 }}
          className="flex-1 flex items-center justify-center mb-6 min-h-0"
        >
          <img
            src={imageUrl}
            alt="Screenshot"
            className={`max-w-full max-h-full object-contain ${getRadiusClass('card')} shadow-2xl`}
          />
        </motion.div>

        {/* Info panel - bottom section - scrollable with slide up animation */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 25 }}
          className={`${getGlassClasses('subtle')} ${getRadiusClass('card')} p-6 overflow-y-auto max-h-[40vh] flex-shrink-0`}
        >
          <div className="flex flex-wrap gap-6">
            {/* Left section: Basic info */}
            <div className="flex-1 min-w-[300px]">
              <div className="flex items-center gap-4 mb-3">
                <div>
                  <div className="text-white/70 text-xs uppercase tracking-wide mb-1">
                    Activity
                  </div>
                  <div className="text-white text-lg font-semibold">
                    {aiAnalysis?.detectedActivity || 'Activity'}
                  </div>
                </div>
                <div className="h-8 w-px bg-white/20"></div>
                <div>
                  <div className="text-white/70 text-xs uppercase tracking-wide mb-1">
                    Time
                  </div>
                  <div className="text-white text-sm">
                    {new Date(timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              {aiAnalysis?.summary && (
                <div className="text-white/90 text-sm leading-relaxed">
                  {aiAnalysis.summary}
                </div>
              )}
            </div>

            {/* Right section: Key insights */}
            {(hasBlockers || hasAchievements || hasInsights || hasContextDelta) && (
              <div className="flex-1 min-w-[300px] space-y-3">
                <div className="text-white/70 text-xs uppercase tracking-wide mb-2">
                  Key Insights
                </div>

                {/* Blockers - shown first if present (important!) */}
                {hasBlockers && aiAnalysis?.progressIndicators?.blockers && (
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-red-300 text-xs font-medium mb-1">Blocker</div>
                      <div className="text-white/90 text-sm">
                        {aiAnalysis.progressIndicators.blockers[0]}
                      </div>
                    </div>
                  </div>
                )}

                {/* Achievements */}
                {hasAchievements && aiAnalysis?.progressIndicators?.achievements && (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-green-300 text-xs font-medium mb-1">Achievement</div>
                      <div className="text-white/90 text-sm">
                        {aiAnalysis.progressIndicators.achievements[0]}
                      </div>
                    </div>
                  </div>
                )}

                {/* Context Delta - what changed */}
                {hasContextDelta && aiAnalysis?.contextDelta && (
                  <div className="flex items-start gap-2">
                    <TrendingUp size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-blue-300 text-xs font-medium mb-1">What Changed</div>
                      <div className="text-white/90 text-sm">
                        {aiAnalysis.contextDelta}
                      </div>
                    </div>
                  </div>
                )}

                {/* Insights - if available and space permits */}
                {hasInsights && !hasBlockers && !hasContextDelta && aiAnalysis?.progressIndicators?.insights && (
                  <div className="flex items-start gap-2">
                    <Lightbulb size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-yellow-300 text-xs font-medium mb-1">Insight</div>
                      <div className="text-white/90 text-sm">
                        {aiAnalysis.progressIndicators.insights[0]}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  // Render as portal at document root for true full-screen display
  return createPortal(modalContent, document.body);
}
