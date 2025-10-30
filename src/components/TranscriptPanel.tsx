/**
 * Transcript Panel
 *
 * Displays full transcript with timestamps
 * - Click any line to jump audio to that moment
 * - Auto-scrolls to follow current playback
 * - Highlights current segment
 *
 * IMPORTANT: Uses actual session timeline (same as ProgressiveAudioLoader),
 * NOT the concatenated timeline from audioConcatenationService.
 */

import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { MessageSquare, ChevronUp, ChevronDown } from 'lucide-react';
import type { SessionAudioSegment, Session } from '../types';
import { getGlassClasses, RADIUS, TRANSITIONS, SCALE } from '../design-system/theme';

interface TranscriptPanelProps {
  audioSegments: SessionAudioSegment[];
  currentTime: number;
  session: Session;
  onSeek: (time: number) => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export interface TranscriptPanelRef {
  scrollToTime: (time: number) => void;
}

export const TranscriptPanel = forwardRef<TranscriptPanelRef, TranscriptPanelProps>(
  ({ audioSegments, currentTime, session, onSeek, isExpanded, onToggleExpanded }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate segment start time in actual session timeline
    // SAME LOGIC as ProgressiveAudioLoader._calculateSegmentStartTime
    const calculateSegmentStartTime = (segment: SessionAudioSegment): number => {
      const sessionStartTime = new Date(session.startTime).getTime();
      const segmentCaptureTime = new Date(segment.timestamp).getTime();
      const captureOffset = (segmentCaptureTime - sessionStartTime) / 1000;

      // Subtract duration to get actual start time
      // Example: segment captured at 10s with 10s duration = starts at 0s
      const startTime = captureOffset - segment.duration;

      // Clamp to 0 if negative
      return Math.max(0, startTime);
    };

    // Find current segment based on playback time
    const getCurrentSegmentId = (): string | null => {
      for (const segment of audioSegments) {
        const startTime = calculateSegmentStartTime(segment);
        const endTime = startTime + segment.duration;

        if (currentTime >= startTime && currentTime < endTime) {
          return segment.id;
        }
      }
      return null;
    };

    const currentSegmentId = getCurrentSegmentId();

    // Expose scroll method via ref
    useImperativeHandle(ref, () => ({
      scrollToTime: (time: number) => {
        // Find segment at time and scroll to it
        const segment = audioSegments.find(seg => {
          const startTime = calculateSegmentStartTime(seg);
          const endTime = startTime + seg.duration;
          return time >= startTime && time < endTime;
        });

        if (segment && containerRef.current) {
          const element = containerRef.current.querySelector(`[data-segment-id="${segment.id}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }));

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

    if (audioSegments.length === 0) {
      return (
        <div className={`${getGlassClasses('medium')} rounded-[24px] p-8 text-center`}>
          <MessageSquare size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No transcript available</p>
        </div>
      );
    }

    return (
      <div className={`${getGlassClasses('medium')} rounded-[24px] shadow-xl overflow-hidden`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-cyan-600" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                Transcript
              </h3>
              <span className="text-xs text-gray-600 bg-white/40 px-3 py-1 rounded-full">
                {audioSegments.length} segments
              </span>
            </div>
            {onToggleExpanded && (
              <button
                onClick={onToggleExpanded}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
              </button>
            )}
          </div>
        </div>

        {/* Transcript List */}
        <div
          ref={containerRef}
          className={`overflow-y-auto p-4 space-y-3 ${isExpanded ? 'max-h-[800px]' : 'max-h-[600px]'}`}
        >
          {audioSegments.map((segment) => {
            // Calculate actual session time using same logic as ProgressiveAudioLoader
            const sessionTime = calculateSegmentStartTime(segment);
            const isCurrentSegment = segment.id === currentSegmentId;

            return (
              <div
                key={segment.id}
                data-segment-id={segment.id}
                onClick={() => onSeek(sessionTime)}
                className={`p-4 rounded-[16px] border-2 cursor-pointer ${TRANSITIONS.standard} ${
                  isCurrentSegment
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-400 shadow-lg scale-[1.02]'
                    : `${getGlassClasses('subtle')} hover:bg-white/60 hover:border-white/80 ${SCALE.subtleHover}`
                }`}
              >
                {/* Time Badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full ${
                      isCurrentSegment
                        ? 'bg-cyan-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {formatTime(sessionTime)}
                  </span>
                  {isCurrentSegment && (
                    <span className="text-xs font-semibold text-cyan-600 animate-pulse">
                      ▶ Playing
                    </span>
                  )}
                </div>

                {/* Transcription Text */}
                <p
                  className={`text-sm leading-relaxed ${
                    isCurrentSegment ? 'text-gray-900 font-medium' : 'text-gray-700'
                  }`}
                >
                  {segment.transcription}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

TranscriptPanel.displayName = 'TranscriptPanel';
