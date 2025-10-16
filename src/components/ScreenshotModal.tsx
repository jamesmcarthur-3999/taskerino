/**
 * ScreenshotModal - Full-screen screenshot viewer with AI analysis
 *
 * Rendered as React portal at document root for true full-screen display.
 * Shows relevant AI analysis details in a clean, scannable layout.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertCircle, Lightbulb, TrendingUp } from 'lucide-react';
import type { SessionScreenshot } from '../types';

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
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-10"
      >
        <X size={24} className="text-white" />
      </button>

      {/* Main content container */}
      <div
        className="w-full h-full flex flex-col p-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Screenshot - takes most of the space */}
        <div className="flex-1 flex items-center justify-center mb-6 min-h-0">
          <img
            src={imageUrl}
            alt="Screenshot"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>

        {/* Info panel - bottom section - scrollable */}
        <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6 overflow-y-auto max-h-[40vh] flex-shrink-0">
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
        </div>
      </div>
    </div>
  );

  // Render as portal at document root for true full-screen display
  return createPortal(modalContent, document.body);
}
