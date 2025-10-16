/**
 * AudioSegmentCard - Redesigned Timeline Component
 *
 * Modern, compact audio segment card for timeline display with:
 * - Horizontal layout with gradient icon badge
 * - Transcript-only display (audio player removed)
 * - Dynamic text sizing based on transcript length
 * - Progressive sizing: shorter text = larger font size
 * - Quick actions: Copy
 * - Glassmorphism with purple/pink gradient theme
 */

import React, { useState } from 'react';
import { Volume2, Copy } from 'lucide-react';
import { GradientIconBadge } from './GradientIconBadge';
import type { SessionAudioSegment } from '../types';
import { RADIUS, AUDIO_GRADIENTS, TRANSITIONS } from '../design-system/theme';

interface AudioSegmentCardProps {
  segment: SessionAudioSegment;
  sessionStartTime: string;
}

export const AudioSegmentCard = React.memo(function AudioSegmentCard({
  segment,
  sessionStartTime,
}: AudioSegmentCardProps) {
  const [copySuccess, setCopySuccess] = useState(false);

  // Calculate timestamp from session start
  const sessionStart = new Date(sessionStartTime).getTime();
  const segmentTime = new Date(segment.timestamp).getTime();
  const relativeTime = Math.floor((segmentTime - sessionStart) / 1000);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Get transcript text
  const getTranscriptText = () => {
    if (segment.mode === 'transcription') {
      return segment.transcription;
    }
    if (segment.transcription && segment.transcription.trim() && segment.transcription !== 'No clear speech detected.') {
      return segment.transcription;
    }
    return segment.description || 'No clear speech detected';
  };

  const transcriptText = getTranscriptText();

  // Calculate dynamic text size based on character count and estimated line count
  const getTextSizeClass = () => {
    const charCount = transcriptText.length;

    // Estimate lines (rough approximation: ~50 chars per line at base size)
    const estimatedLines = Math.ceil(charCount / 50);

    // Progressive sizing: fewer chars = larger text
    if (charCount < 50) {
      // Very short (likely 1 line) - extra large
      return 'text-2xl leading-relaxed';
    } else if (charCount < 100) {
      // Short (1-2 lines) - large
      return 'text-xl leading-relaxed';
    } else if (charCount < 150 || estimatedLines < 3) {
      // Medium (2-3 lines) - larger than base
      return 'text-lg leading-relaxed';
    } else if (charCount < 250) {
      // Medium-long (3-5 lines) - slightly larger
      return 'text-base leading-normal';
    } else {
      // Long (5+ lines) - base size
      return 'text-sm leading-normal';
    }
  };

  const textSizeClass = getTextSizeClass();

  const handleCopyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy transcript:', err);
    }
  };

  return (
    <div
      className={`
        bg-gradient-to-r ${AUDIO_GRADIENTS.background}
        backdrop-blur-xl border-2 border-purple-300/40
        rounded-[${RADIUS.card}px] p-4
        ${AUDIO_GRADIENTS.shadow} hover:${AUDIO_GRADIENTS.shadowHover}
        ${TRANSITIONS.standard}
        group
      `}
    >
      {/* Header Row: Icon + Label + Duration + Copy Action */}
      <div className="flex items-center gap-2 mb-3">
        {/* Icon Badge */}
        <GradientIconBadge
          icon={Volume2}
          iconSize={16}
          gradientFrom="from-purple-50"
          gradientTo="to-pink-50"
          iconColor="text-purple-600"
          size={32}
        />

        {/* Label + Duration */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`font-bold uppercase tracking-wide ${AUDIO_GRADIENTS.textPrimary}`}>
            AUDIO
          </span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-500">{formatDuration(segment.duration)}</span>
        </div>

        <div className="flex-1" />

        {/* Copy Action */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopyTranscript}
            className={`p-1.5 rounded-lg ${TRANSITIONS.fast} ${
              copySuccess
                ? 'bg-green-100 text-green-600'
                : 'hover:bg-purple-100 text-gray-500 hover:text-purple-600'
            }`}
            title="Copy transcript"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      {/* Transcript - Dynamic Text Sizing */}
      <div className="mt-2 px-1">
        <p className={`${textSizeClass} ${AUDIO_GRADIENTS.textPrimary} break-words`}>
          {transcriptText === 'No clear speech detected' ? (
            <span className="italic text-gray-500">{transcriptText}</span>
          ) : (
            `"${transcriptText}"`
          )}
        </p>
      </div>

      {/* Compact Footer: Metadata */}
      <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-3 px-1">
        <span>{new Date(segment.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
        <span>·</span>
        <span>+{formatTime(relativeTime)}</span>
      </div>
    </div>
  );
});
