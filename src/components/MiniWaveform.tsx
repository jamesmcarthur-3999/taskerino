/**
 * MiniWaveform
 *
 * Compact animated waveform visualization for audio segments in timeline.
 * Displays audio waveform data with smooth animations and playback preview.
 *
 * Features:
 * - 30-bar waveform representation
 * - Animated bars with staggered timing for visual interest
 * - Hover preview with playback indicator
 * - Click to play audio
 * - Gradient color scheme (purple to pink)
 * - Responsive to parent container width
 */

import React, { useState } from 'react';
import { WAVEFORM, AUDIO_GRADIENTS, TRANSITIONS } from '../design-system/theme';

interface MiniWaveformProps {
  /** Waveform data array (0-1 normalized values) */
  waveform?: number[];
  /** Total duration in seconds */
  duration: number;
  /** Whether audio is currently playing */
  isPlaying?: boolean;
  /** Current playback progress (0-1) */
  progress?: number;
  /** Callback when waveform is clicked */
  onClick?: () => void;
  /** Optional className for container */
  className?: string;
}

/**
 * Generate placeholder waveform data if none provided
 */
function generatePlaceholderWaveform(barCount: number): number[] {
  return Array.from({ length: barCount }, () => Math.random() * 0.6 + 0.2);
}

export function MiniWaveform({
  waveform,
  duration,
  isPlaying = false,
  progress = 0,
  onClick,
  className = '',
}: MiniWaveformProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Use provided waveform or generate placeholder
  const waveformData = waveform || generatePlaceholderWaveform(WAVEFORM.barCount);

  // Ensure we have exactly the right number of bars
  const normalizedData = waveformData.slice(0, WAVEFORM.barCount);
  while (normalizedData.length < WAVEFORM.barCount) {
    normalizedData.push(0.3);
  }

  // Calculate which bars should be highlighted based on progress
  const progressBarIndex = Math.floor(progress * WAVEFORM.barCount);

  return (
    <div
      className={`
        flex items-center gap-[${WAVEFORM.barGap}px] h-8 px-3 py-2
        bg-gradient-to-r ${AUDIO_GRADIENTS.background}
        rounded-lg cursor-pointer
        ${TRANSITIONS.standard}
        ${isHovered ? 'scale-105' : ''}
        ${className}
      `}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      aria-label={`Audio waveform, ${duration} seconds`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {normalizedData.map((value, index) => {
        const barHeight = WAVEFORM.minHeight + (value * (WAVEFORM.maxHeight - WAVEFORM.minHeight));
        const isActive = isPlaying && index <= progressBarIndex;
        const isPast = index < progressBarIndex;

        return (
          <div
            key={index}
            className={`
              rounded-full ${TRANSITIONS.fast}
              ${isActive ? `bg-${WAVEFORM.activeColor}` : `bg-${WAVEFORM.color}`}
              ${isPast ? 'opacity-50' : ''}
              ${isHovered ? 'opacity-100' : 'opacity-70'}
            `}
            style={{
              width: `${WAVEFORM.barWidth}px`,
              height: `${barHeight}px`,
              transitionDelay: `${index * 10}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
