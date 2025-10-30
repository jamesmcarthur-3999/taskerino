import React, { useState, useEffect, useRef } from 'react';
import { Mic, Copy, Check, AlertCircle, CheckSquare, Volume2, VolumeX, Clock } from 'lucide-react';
import type { Session, SessionAudioSegment } from '../../types';
import { getGlassClasses, getRadiusClass, TRANSITIONS } from '../../design-system/theme';

interface LiveTranscriptPanelProps {
  session: Session;
}

export function LiveTranscriptPanel({ session }: LiveTranscriptPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSegmentRef = useRef<HTMLDivElement>(null);

  const audioSegments = session.audioSegments || [];
  const sortedSegments = [...audioSegments].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Auto-scroll to newest segment
  useEffect(() => {
    if (lastSegmentRef.current && session.status === 'active') {
      lastSegmentRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [audioSegments.length, session.status]);

  const copySegment = async (segmentId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(segmentId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const copyAllTranscript = async () => {
    const fullTranscript = sortedSegments
      .map((segment) => {
        const time = formatTime(segment.timestamp);
        const text = segment.enrichedTranscription || segment.transcription;
        return `[${time}] ${text}`;
      })
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(fullTranscript);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const hasVADDetection = (segment: SessionAudioSegment) => {
    // Check if segment has voice activity detection metadata
    return segment.transcription && segment.transcription.trim().length > 0;
  };

  if (audioSegments.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        {session.audioRecording ? (
          <>
            <Mic size={48} className="text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Listening...</h3>
            <p className="text-sm text-gray-600">
              Transcript will appear here as you speak
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-gray-500">Recording audio</span>
            </div>
          </>
        ) : (
          <>
            <Mic size={48} className="text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No audio recorded</h3>
            <p className="text-sm text-gray-600">
              Enable audio recording to see transcripts
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/20">
        <div className="flex items-center gap-2">
          <Mic size={18} className="text-red-600" />
          <span className="text-sm font-semibold text-gray-900">
            Live Transcript
          </span>
          {session.status === 'active' && session.audioRecording && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-gray-500">Recording</span>
            </div>
          )}
        </div>

        <button
          onClick={copyAllTranscript}
          className={`px-3 py-1.5 ${getGlassClasses('subtle')} ${getRadiusClass('field')} flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:shadow-md ${TRANSITIONS.standard}`}
        >
          {copiedAll ? (
            <>
              <Check size={14} className="text-green-600" />
              <span className="text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy All</span>
            </>
          )}
        </button>
      </div>

      {/* Transcript container */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {sortedSegments.map((segment, index) => {
          const isLast = index === sortedSegments.length - 1;
          const text = segment.enrichedTranscription || segment.transcription;
          const isVoiceDetected = hasVADDetection(segment);

          return (
            <div
              key={segment.id}
              ref={isLast ? lastSegmentRef : undefined}
              className={`group relative p-4 ${getGlassClasses('medium')} ${getRadiusClass('field')} ${TRANSITIONS.standard} hover:shadow-lg`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Timestamp */}
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-gray-500" />
                    <span className="text-xs font-medium text-gray-600">
                      {formatTime(segment.timestamp)}
                    </span>
                  </div>

                  {/* VAD Indicator */}
                  {isVoiceDetected ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 rounded-full">
                      <Volume2 size={10} className="text-green-600" />
                      <span className="text-[10px] font-semibold text-green-700">VOICE</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-500/10 rounded-full">
                      <VolumeX size={10} className="text-gray-500" />
                      <span className="text-[10px] font-semibold text-gray-600">SILENT</span>
                    </div>
                  )}

                  {/* Quality indicator */}
                  {segment.transcriptionQuality === 'final' && (
                    <div className="px-2 py-0.5 bg-cyan-500/10 rounded-full">
                      <span className="text-[10px] font-semibold text-cyan-700">FINAL</span>
                    </div>
                  )}

                  {/* Duration */}
                  <span className="text-[10px] text-gray-500">
                    {segment.duration}s
                  </span>
                </div>

                {/* Copy button */}
                <button
                  onClick={() => copySegment(segment.id, text)}
                  className={`opacity-0 group-hover:opacity-100 p-1 hover:bg-white/50 ${getRadiusClass('element')} ${TRANSITIONS.standard}`}
                >
                  {copiedId === segment.id ? (
                    <Check size={14} className="text-green-600" />
                  ) : (
                    <Copy size={14} className="text-gray-600" />
                  )}
                </button>
              </div>

              {/* Transcript text */}
              <p className={`text-sm leading-relaxed ${getSentimentColor(segment.sentiment)}`}>
                {text}
              </p>

              {/* Metadata badges */}
              {(segment.keyPhrases?.length || segment.containsTask || segment.containsBlocker) && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {/* Task indicator */}
                  {segment.containsTask && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 rounded-full">
                      <CheckSquare size={10} className="text-purple-600" />
                      <span className="text-[10px] font-semibold text-purple-700">TASK</span>
                    </div>
                  )}

                  {/* Blocker indicator */}
                  {segment.containsBlocker && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 rounded-full">
                      <AlertCircle size={10} className="text-orange-600" />
                      <span className="text-[10px] font-semibold text-orange-700">BLOCKER</span>
                    </div>
                  )}

                  {/* Key phrases */}
                  {segment.keyPhrases?.slice(0, 3).map((phrase, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-gray-500/10 rounded-full text-[10px] font-medium text-gray-700"
                    >
                      {phrase}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="px-4 py-3 border-t border-white/20">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <span>{sortedSegments.length} segments</span>
            <span>
              {Math.round(sortedSegments.reduce((sum, s) => sum + s.duration, 0) / 60)}min total
            </span>
          </div>
          <div className="flex items-center gap-2">
            {sortedSegments.some(s => s.transcriptionQuality === 'final') && (
              <span className="text-cyan-600 font-medium">Enhanced transcript available</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
