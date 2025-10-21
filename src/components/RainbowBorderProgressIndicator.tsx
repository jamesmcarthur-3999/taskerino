/**
 * RainbowBorderProgressIndicator
 *
 * Displays a glowing rainbow-colored progress indicator around the screen border
 * during session enrichment. Progress flows clockwise: top → right → bottom → left.
 *
 * Features:
 * - SVG-based path animation with rounded corners matching container
 * - Multi-layer glow effect for depth and "shedding light" appearance
 * - Rainbow gradient (cyan → blue → purple → pink → magenta)
 * - GPU-accelerated for 60fps performance
 * - Consumes EnrichmentContext for real-time progress
 * - Smoothed progress animation to prevent hanging at high percentages
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform, useAnimationFrame } from 'framer-motion';
import { useEnrichmentContext } from '../context/EnrichmentContext';
import { useReducedMotion } from '../lib/animations';

export const RainbowBorderProgressIndicator: React.FC = () => {
  const { activeEnrichments, hasActiveEnrichments } = useEnrichmentContext();
  const prefersReducedMotion = useReducedMotion();

  // Get the most recent active enrichment for display
  const activeEnrichment = useMemo(() => {
    if (!hasActiveEnrichments) return null;
    const enrichments = Array.from(activeEnrichments.values());
    return enrichments.sort((a, b) => b.startTime - a.startTime)[0];
  }, [activeEnrichments, hasActiveEnrichments]);

  return (
    <AnimatePresence mode="wait">
      {activeEnrichment && (
        <motion.div
          key={`rainbow-border-${activeEnrichment.sessionId}`}
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Outer glow layer - subtle */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 50% 0%, rgba(6, 182, 212, 0.15) 0%, transparent 35%), radial-gradient(circle at 100% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 35%), radial-gradient(circle at 50% 100%, rgba(147, 51, 234, 0.15) 0%, transparent 35%), radial-gradient(circle at 0% 50%, rgba(236, 72, 153, 0.15) 0%, transparent 35%)',
              filter: 'blur(30px)',
              transform: 'scale(1.01)',
            }}
          />

          {/* Mid glow layer - reduced */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, rgba(6, 182, 212, 0.12), rgba(59, 130, 246, 0.12), rgba(147, 51, 234, 0.12), rgba(236, 72, 153, 0.12))',
              filter: 'blur(15px)',
            }}
          />

          {/* SVG Border - with smoothed progress */}
          <RainbowBorderSVG
            targetProgress={activeEnrichment.progress}
            prefersReducedMotion={prefersReducedMotion}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface RainbowBorderSVGProps {
  targetProgress: number; // 0-100 - actual progress from enrichment
  prefersReducedMotion: boolean;
}

const RainbowBorderSVG: React.FC<RainbowBorderSVGProps> = ({ targetProgress, prefersReducedMotion }) => {
  // Track when enrichment started for time-based minimum duration
  const startTimeRef = useRef<number | null>(null);

  // Minimum duration in seconds - ensures we don't rush through early steps
  const MIN_DURATION_SECONDS = 8;

  // MotionValue for elapsed time (updates on every frame, no React re-renders!)
  const elapsedSeconds = useMotionValue(0);

  // MotionValue for target progress (updated when prop changes)
  const targetProgressMV = useMotionValue(targetProgress);

  // Update target progress motion value when prop changes
  useEffect(() => {
    targetProgressMV.set(targetProgress);
  }, [targetProgress, targetProgressMV]);

  // Use animation frame to update elapsed time at 60fps (GPU-accelerated, no React re-renders)
  useAnimationFrame((time) => {
    // Initialize start time on first frame
    if (startTimeRef.current === null) {
      startTimeRef.current = time;
    }

    // Calculate elapsed time in seconds
    const elapsed = (time - startTimeRef.current) / 1000;
    elapsedSeconds.set(elapsed);
  });

  // Calculate time-based maximum progress using useTransform (60fps, no re-renders)
  const timeBasedMaxProgress = useTransform(
    elapsedSeconds,
    (elapsed) => Math.min((elapsed / MIN_DURATION_SECONDS) * 100, 100)
  );

  // Gate the target progress by time
  const gatedProgress = useTransform(
    [targetProgressMV, timeBasedMaxProgress],
    (latest: number[]) => Math.min(latest[0], latest[1])
  );

  // Smoothed progress that "catches up" to gated target progress
  const smoothedProgress = useSpring(gatedProgress, {
    stiffness: 50,
    damping: 30,
    mass: 1,
  });

  // Create rounded rectangle path that matches container's rounded-[24px]
  // Using arc commands (A) for corners
  const path = useMemo(() => {
    // Border radius in viewBox units (24px radius for rounded-[24px])
    // Approximate as 3% of a 100x100 viewBox for responsive scaling
    const r = 3;

    // Start from top-left, after the corner radius
    return `
      M ${r} 0
      L ${100 - r} 0
      A ${r} ${r} 0 0 1 100 ${r}
      L 100 ${100 - r}
      A ${r} ${r} 0 0 1 ${100 - r} 100
      L ${r} 100
      A ${r} ${r} 0 0 1 0 ${100 - r}
      L 0 ${r}
      A ${r} ${r} 0 0 1 ${r} 0
      Z
    `.trim();
  }, []);

  return (
    <svg
      className="absolute inset-0 w-full h-full rounded-[24px]"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        transform: 'translateZ(0)', // GPU acceleration
      }}
    >
      {/* Define gradients */}
      <defs>
        <linearGradient id="rainbow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(6, 182, 212)" /> {/* Cyan */}
          <stop offset="25%" stopColor="rgb(59, 130, 246)" /> {/* Blue */}
          <stop offset="50%" stopColor="rgb(147, 51, 234)" /> {/* Purple */}
          <stop offset="75%" stopColor="rgb(236, 72, 153)" /> {/* Pink */}
          <stop offset="100%" stopColor="rgb(219, 39, 119)" /> {/* Magenta */}
        </linearGradient>

        {/* Shimmer gradient for sparkle effect */}
        <linearGradient id="shimmer-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
          <stop offset="50%" stopColor="rgba(255, 255, 255, 0.9)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          {!prefersReducedMotion && (
            <>
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
            </>
          )}
        </linearGradient>

        {/* Lighter glow filter - optimized for performance */}
        <filter id="border-glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Base rainbow border */}
      <motion.path
        d={path}
        fill="none"
        stroke="url(#rainbow-gradient)"
        strokeWidth={prefersReducedMotion ? 1.5 : 1.0}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        strokeDashoffset={0}
        filter={prefersReducedMotion ? undefined : "url(#border-glow)"}
        style={{
          strokeDasharray: useTransform(smoothedProgress, p => `${p} ${100 - p}`),
        }}
      />

      {/* Shimmer overlay - subtle, follows same smoothed progress */}
      {!prefersReducedMotion && (
        <motion.path
          d={path}
          fill="none"
          stroke="url(#shimmer-gradient)"
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={100}
          strokeDashoffset={0}
          style={{
            strokeDasharray: useTransform(smoothedProgress, p => `${p} ${100 - p}`),
            opacity: 0.5,
          }}
        />
      )}
    </svg>
  );
};
