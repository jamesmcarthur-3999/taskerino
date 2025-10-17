/**
 * Transcript Panel
 *
 * Displays full transcript with timestamps
 * - Click any line to jump audio to that moment
 * - Auto-scrolls to follow current playback
 * - Highlights current segment
 */

import React, { useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import type { SessionAudioSegment } from '../types';
import { audioConcatenationService } from '../services/audioConcatenationService';
import { getGlassClasses, RADIUS, TRANSITIONS, SCALE } from '../design-system/theme';

interface TranscriptPanelProps {
  audioSegments: SessionAudioSegment[];
  currentTime: number;
  onSeekToTime: (time: number) => void;
}

export function TranscriptPanel({
  audioSegments,
  currentTime,
  onSeekToTime,
}: TranscriptPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Find current segment based on playback time
  const getCurrentSegmentId = () => {
    const segmentInfo = audioConcatenationService.sessionTimeToSegment(currentTime);
    return segmentInfo?.segmentId || null;
  };

  const currentSegmentId = getCurrentSegmentId();

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
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-cyan-600" />
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
            Transcript
          </h3>
          <span className="text-xs text-gray-600 bg-white/40 px-3 py-1 rounded-full">
            {audioSegments.length} segments
          </span>
        </div>
      </div>

      {/* Transcript List */}
      <div
        ref={containerRef}
        className="max-h-[600px] overflow-y-auto p-4 space-y-3"
      >
        {audioSegments.map((segment) => {
          const sessionTime = audioConcatenationService.segmentTimeToSessionTime(segment.id, 0);
          const isCurrentSegment = segment.id === currentSegmentId;

          return (
            <div
              key={segment.id}
              onClick={() => onSeekToTime(sessionTime)}
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
