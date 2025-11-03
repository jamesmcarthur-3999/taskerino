/**
 * WaveformVisualizer - Real-time audio waveform visualization
 *
 * Displays live waveform using Web Audio API AnalyserNode data.
 * Canvas-based rendering at 60fps for smooth animations.
 *
 * Features:
 * - Real-time waveform (time-domain) visualization
 * - 60fps smooth animation via requestAnimationFrame
 * - Responsive canvas sizing
 * - Dark mode support
 * - Optional frequency spectrum mode
 *
 * Performance:
 * - Target: 60fps (16.67ms per frame)
 * - GPU-accelerated canvas rendering
 * - Minimal CPU overhead
 *
 * Integration:
 * - Uses WebAudioPlayback's AnalyserNode
 * - Phase 6 Wave 3, Task 6.9
 *
 * @see docs/sessions-rewrite/PHASE_6_VALIDATED_PLAN.md - Task 6.9
 */

import React, { useEffect, useRef } from 'react';
import type { WebAudioPlayback } from '../../services/WebAudioPlayback';

// ============================================================================
// Component Props
// ============================================================================

export interface WaveformVisualizerProps {
  /** WebAudioPlayback instance (required for waveform data) */
  audioPlayback: WebAudioPlayback | null;

  /** Canvas width (default: 800px) */
  width?: number;

  /** Canvas height (default: 200px) */
  height?: number;

  /** Visualization mode (default: 'waveform') */
  mode?: 'waveform' | 'frequency';

  /** Waveform color (default: 'rgb(0, 200, 255)') */
  color?: string;

  /** Background color (default: 'rgb(20, 20, 20)') */
  backgroundColor?: string;

  /** Line width (default: 2) */
  lineWidth?: number;

  /** Custom className for styling */
  className?: string;
}

// ============================================================================
// WaveformVisualizer Component
// ============================================================================

export function WaveformVisualizer({
  audioPlayback,
  width = 800,
  height = 200,
  mode = 'waveform',
  color = 'rgb(0, 200, 255)',
  backgroundColor = 'rgb(20, 20, 20)',
  lineWidth = 2,
  className = '',
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Animation loop
  useEffect(() => {
    if (!audioPlayback || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[WAVEFORM VISUALIZER] Failed to get canvas context');
      return;
    }

    // Set canvas dimensions (accounting for device pixel ratio)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    /**
     * Animation loop (60fps target)
     * Draws waveform or frequency spectrum
     */
    function draw() {
      if (!audioPlayback || !canvasRef.current || !ctx) return;

      // Get waveform/frequency data
      const dataArray =
        mode === 'waveform'
          ? audioPlayback.getWaveformData()
          : audioPlayback.getFrequencyData();

      const bufferLength = dataArray.length;

      // Clear canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Draw waveform/spectrum
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        // Normalize data (0-255 → 0-1)
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Continue animation loop
      animationRef.current = requestAnimationFrame(draw);
    }

    // Start animation
    draw();

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [audioPlayback, width, height, mode, color, backgroundColor, lineWidth]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`waveform-visualizer ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}
      aria-label="Audio waveform visualization"
      role="img"
    />
  );
}

/**
 * Compact waveform visualizer (for inline playback controls)
 */
export function CompactWaveformVisualizer({
  audioPlayback,
  className = '',
}: {
  audioPlayback: WebAudioPlayback | null;
  className?: string;
}) {
  return (
    <WaveformVisualizer
      audioPlayback={audioPlayback}
      width={400}
      height={60}
      lineWidth={1.5}
      className={className}
    />
  );
}

/**
 * Full-width waveform visualizer (for session review)
 */
export function FullWidthWaveformVisualizer({
  audioPlayback,
  className = '',
}: {
  audioPlayback: WebAudioPlayback | null;
  className?: string;
}) {
  return (
    <WaveformVisualizer
      audioPlayback={audioPlayback}
      width={1200}
      height={200}
      className={className}
    />
  );
}

/**
 * Frequency spectrum visualizer
 */
export function FrequencySpectrumVisualizer({
  audioPlayback,
  className = '',
}: {
  audioPlayback: WebAudioPlayback | null;
  className?: string;
}) {
  return (
    <WaveformVisualizer
      audioPlayback={audioPlayback}
      mode="frequency"
      width={800}
      height={200}
      color="rgb(255, 100, 0)"
      className={className}
    />
  );
}
