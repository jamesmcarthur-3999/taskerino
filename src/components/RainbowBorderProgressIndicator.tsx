/**
 * RainbowBorderProgressIndicator
 *
 * Displays a rainbow-colored progress indicator around the screen border
 * during session enrichment. Progress flows clockwise: top → right → bottom → left.
 *
 * Features:
 * - SVG-based path animation using stroke-dasharray
 * - Rainbow gradient (cyan → blue → purple → pink → magenta)
 * - Shimmer/glow effect
 * - GPU-accelerated for 60fps performance
 * - Consumes EnrichmentContext for real-time progress
 * - Fixed position overlay (z-45, pointer-events-none)
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEnrichmentContext } from '../context/EnrichmentContext';

const BORDER_WIDTH = 4; // 4px border
const BORDER_PADDING = 0; // Distance from edge

export const RainbowBorderProgressIndicator: React.FC = () => {
  const { activeEnrichments, hasActiveEnrichments } = useEnrichmentContext();

  // Get the most recent active enrichment for display
  // (In practice, there should only be one at a time, but the system supports multiple)
  const activeEnrichment = useMemo(() => {
    if (!hasActiveEnrichments) return null;

    // Get the most recently started enrichment
    const enrichments = Array.from(activeEnrichments.values());
    return enrichments.sort((a, b) => b.startTime - a.startTime)[0];
  }, [activeEnrichments, hasActiveEnrichments]);

  // Wrap conditional inside AnimatePresence for proper exit animations
  return (
    <AnimatePresence mode="wait">
      {activeEnrichment && (
        <motion.div
          key={`rainbow-border-${activeEnrichment.sessionId}`}
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <RainbowBorderSVG progress={activeEnrichment.progress} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface RainbowBorderSVGProps {
  progress: number; // 0-100
}

const RainbowBorderSVG: React.FC<RainbowBorderSVGProps> = ({ progress }) => {
  // Define path in a fixed 100x100 coordinate system
  // This works with pathLength=100 for easy percentage-based progress
  const path = useMemo(() => {
    const padding = 0.5; // Small padding to prevent edge clipping
    return `M ${padding} ${padding}
            L ${100 - padding} ${padding}
            L ${100 - padding} ${100 - padding}
            L ${padding} ${100 - padding}
            Z`;
  }, []);

  // With pathLength=100 on the SVG path, progress directly maps to dasharray
  // No complex pixel calculations needed!
  const dashArray = useMemo(() => {
    return `${progress} ${100 - progress}`;
  }, [progress]);

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        overflow: 'visible',
      }}
    >
      {/* Define rainbow gradient */}
      <defs>
        <linearGradient id="rainbow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(6, 182, 212)" /> {/* Cyan */}
          <stop offset="25%" stopColor="rgb(59, 130, 246)" /> {/* Blue */}
          <stop offset="50%" stopColor="rgb(147, 51, 234)" /> {/* Purple */}
          <stop offset="75%" stopColor="rgb(236, 72, 153)" /> {/* Pink */}
          <stop offset="100%" stopColor="rgb(219, 39, 119)" /> {/* Magenta */}
        </linearGradient>

        {/* Shimmer effect - animated gradient for glow */}
        <linearGradient id="shimmer-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
          <stop offset="50%" stopColor="rgba(255, 255, 255, 0.8)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />

          {/* Animate the shimmer moving along the gradient */}
          <animate
            attributeName="x1"
            values="-100%;200%"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="x2"
            values="0%;300%"
            dur="2s"
            repeatCount="indefinite"
          />
        </linearGradient>

        {/* Glow filter for extra sparkle */}
        <filter id="border-glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="1.5" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Base rainbow border (always visible for completed portion) */}
      <motion.path
        d={path}
        fill="none"
        stroke="url(#rainbow-gradient)"
        strokeWidth={0.4}
        strokeLinecap="round"
        strokeDasharray={dashArray}
        strokeDashoffset={0}
        pathLength={100}
        filter="url(#border-glow)"
        style={{
          willChange: 'stroke-dasharray',
          transform: 'translateZ(0)', // GPU acceleration
        }}
        initial={{ strokeDasharray: `0 100` }}
        animate={{ strokeDasharray: dashArray }}
        transition={{
          duration: 0.5,
          ease: 'easeOut',
        }}
      />

      {/* Shimmer overlay (moves along the border) */}
      <motion.path
        d={path}
        fill="none"
        stroke="url(#shimmer-gradient)"
        strokeWidth={0.6}
        strokeLinecap="round"
        strokeDasharray={dashArray}
        strokeDashoffset={0}
        pathLength={100}
        style={{
          opacity: 0.6,
          willChange: 'stroke-dasharray',
          transform: 'translateZ(0)', // GPU acceleration
        }}
        initial={{ strokeDasharray: `0 100` }}
        animate={{ strokeDasharray: dashArray }}
        transition={{
          duration: 0.5,
          ease: 'easeOut',
        }}
      />
    </svg>
  );
};
