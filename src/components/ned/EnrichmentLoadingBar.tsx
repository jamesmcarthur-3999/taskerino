/**
 * EnrichmentLoadingBar Component
 *
 * Subtle loading bar that appears at the bottom of session cards to show
 * enrichment progress. Designed to match the glassmorphic design system
 * with cyan/purple gradients.
 *
 * Features:
 * - Subtle gradient progress bar (2-3px height)
 * - Animated shimmer effect
 * - Hover tooltip showing current enrichment stage
 * - Only visible when enrichment is in progress
 * - Smooth fade in/out transitions
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Film, Mic, FileText } from 'lucide-react';
import type { Session } from '../../types';
import { useEnrichmentContext } from '../../context/EnrichmentContext';
import { useReducedMotion } from '../../lib/animations';

interface EnrichmentLoadingBarProps {
  session: Session;
}

/**
 * Get human-readable stage message
 */
const getStageMessage = (session: Session): string => {
  const enrichmentStatus = session.enrichmentStatus;
  if (!enrichmentStatus) return 'Initializing...';

  const currentStage = enrichmentStatus.currentStage;
  const progress = enrichmentStatus.progress;

  switch (currentStage) {
    case 'audio':
      return `Analyzing audio... ${Math.round(progress)}%`;
    case 'video':
      return `Generating video chapters... ${Math.round(progress)}%`;
    case 'summary':
      return `Creating session summary... ${Math.round(progress)}%`;
    case 'complete':
      return 'Finalizing enrichment...';
    default:
      return 'Processing...';
  }
};

/**
 * Get stage icon
 */
const getStageIcon = (stage: string) => {
  switch (stage) {
    case 'audio':
      return <Mic className="w-3 h-3" />;
    case 'video':
      return <Film className="w-3 h-3" />;
    case 'summary':
      return <FileText className="w-3 h-3" />;
    default:
      return <Loader2 className="w-3 h-3 animate-spin" />;
  }
};

/**
 * EnrichmentLoadingBar Component
 */
export function EnrichmentLoadingBar({ session }: EnrichmentLoadingBarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { getActiveEnrichment } = useEnrichmentContext();
  const prefersReducedMotion = useReducedMotion();

  const enrichmentStatus = session.enrichmentStatus;
  const activeEnrichment = getActiveEnrichment(session.id);

  // Only show if enrichment is in progress (check both real-time and persisted state)
  const isEnriching = activeEnrichment || enrichmentStatus?.status === 'in-progress';

  if (!isEnriching) {
    return null;
  }

  // Prefer real-time data from EnrichmentContext, fallback to persisted session state
  const progress = activeEnrichment?.progress ?? enrichmentStatus?.progress ?? 0;
  const currentStage = activeEnrichment?.stage ?? enrichmentStatus?.currentStage ?? 'audio';
  const stageMessage = getStageMessage(session);
  const stageIcon = getStageIcon(currentStage ?? 'audio');

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Loading Bar */}
      <div className="h-[3px] bg-gradient-to-r from-gray-100 to-gray-50 relative overflow-hidden">
        {/* Progress Fill with Gradient */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Animated Shimmer Effect */}
          {!prefersReducedMotion && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
              style={{
                width: '50%',
              }}
            />
          )}
        </motion.div>
      </div>

      {/* Hover Tooltip */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
          >
            <div className="bg-white/90 backdrop-blur-xl border-2 border-white/60 shadow-lg shadow-cyan-200/40 rounded-xl px-3 py-2 min-w-[200px]">
              {/* Stage Info */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center text-white">
                  {stageIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900">
                    Enriching Session
                  </p>
                  <p className="text-[10px] text-gray-600 truncate">
                    {stageMessage}
                  </p>
                </div>
              </div>

              {/* Progress Details */}
              <div className="space-y-1.5">
                {/* Audio Stage */}
                {enrichmentStatus?.audio && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <Mic className="w-3 h-3 flex-shrink-0" />
                    <span className="flex-1 text-gray-700">Audio Analysis</span>
                    <span
                      className={`font-semibold ${
                        enrichmentStatus?.audio?.status === 'completed'
                          ? 'text-green-600'
                          : enrichmentStatus?.audio?.status === 'processing'
                          ? 'text-blue-600'
                          : enrichmentStatus?.audio?.status === 'failed'
                          ? 'text-red-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {enrichmentStatus?.audio?.status === 'completed'
                        ? '✓'
                        : enrichmentStatus?.audio?.status === 'processing'
                        ? '...'
                        : enrichmentStatus?.audio?.status === 'failed'
                        ? '✗'
                        : '○'}
                    </span>
                  </div>
                )}

                {/* Video Stage */}
                {enrichmentStatus?.video && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <Film className="w-3 h-3 flex-shrink-0" />
                    <span className="flex-1 text-gray-700">Video Chapters</span>
                    <span
                      className={`font-semibold ${
                        enrichmentStatus?.video?.status === 'completed'
                          ? 'text-green-600'
                          : enrichmentStatus?.video?.status === 'processing'
                          ? 'text-blue-600'
                          : enrichmentStatus?.video?.status === 'failed'
                          ? 'text-red-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {enrichmentStatus?.video?.status === 'completed'
                        ? '✓'
                        : enrichmentStatus?.video?.status === 'processing'
                        ? '...'
                        : enrichmentStatus?.video?.status === 'failed'
                        ? '✗'
                        : '○'}
                    </span>
                  </div>
                )}

                {/* Summary Stage */}
                {enrichmentStatus?.summary && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <FileText className="w-3 h-3 flex-shrink-0" />
                    <span className="flex-1 text-gray-700">Summary</span>
                    <span
                      className={`font-semibold ${
                        enrichmentStatus?.summary?.status === 'completed'
                          ? 'text-green-600'
                          : enrichmentStatus?.summary?.status === 'processing'
                          ? 'text-blue-600'
                          : enrichmentStatus?.summary?.status === 'failed'
                          ? 'text-red-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {enrichmentStatus?.summary?.status === 'completed'
                        ? '✓'
                        : enrichmentStatus?.summary?.status === 'processing'
                        ? '...'
                        : enrichmentStatus?.summary?.status === 'failed'
                        ? '✗'
                        : '○'}
                    </span>
                  </div>
                )}
              </div>

              {/* Tooltip Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px]">
                <div className="w-2 h-2 bg-white border-r-2 border-b-2 border-white/60 rotate-45" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
