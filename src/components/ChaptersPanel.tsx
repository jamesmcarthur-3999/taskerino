/**
 * Chapters Panel
 *
 * Displays AI-generated video chapters with timestamps
 * - Click any chapter to jump to that moment in the video
 * - Shows chapter titles, summaries, and key topics
 * - Highlights current chapter during playback
 * - Generate chapters with elegant AI button
 */

import React, { useState } from 'react';
import { BookOpen, Clock, Sparkles } from 'lucide-react';
import type { VideoChapter, Session } from '../types';
import { ICON_SIZES } from '../design-system/theme';
import { videoChapteringService } from '../services/videoChapteringService';

interface ChaptersPanelProps {
  chapters: VideoChapter[];
  currentTime: number;
  onSeekToTime: (time: number) => void;
  session?: Session;
  onChaptersGenerated?: () => void;
}

export function ChaptersPanel({
  chapters,
  currentTime,
  onSeekToTime,
  session,
  onChaptersGenerated,
}: ChaptersPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find current chapter based on playback time
  const currentChapterId = chapters.find(
    (chapter) => currentTime >= chapter.startTime && currentTime < chapter.endTime
  )?.id || null;

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format duration as "Xm Ys"
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0 && secs > 0) {
      return `${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m`;
    }
    return `${secs}s`;
  };

  // Handle chapter generation
  const handleGenerateChapters = async () => {
    if (!session) {
      setError('Session data not available');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Generate and save chapters automatically
      const proposals = await videoChapteringService.proposeChapters(session);
      await videoChapteringService.saveChapters(session.id, proposals);

      // Notify parent to refresh
      if (onChaptersGenerated) {
        onChaptersGenerated();
      }

      // Success - parent will re-render with new chapters
      setIsGenerating(false);
    } catch (err) {
      console.error('Failed to generate chapters:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate chapters');
      setIsGenerating(false);
    }
  };

  if (chapters.length === 0) {
    return (
      <div className="bg-gray-50 h-full flex flex-col items-center justify-center p-8">
        {isGenerating ? (
          // Loading state
          <div className="text-center space-y-4">
            <div className="relative inline-flex">
              {/* Pulsing gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-[24px] animate-pulse opacity-20 blur-xl"></div>
              <div className="relative bg-white/60 backdrop-blur-xl rounded-[24px] border-2 border-white/80 p-8 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {/* Animated sparkles */}
                    <Sparkles size={48} className="text-cyan-500 animate-pulse" />
                    <div className="absolute inset-0 animate-ping opacity-30">
                      <Sparkles size={48} className="text-purple-500" />
                    </div>
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      Analyzing video with AI...
                    </h3>
                    <p className="text-sm text-gray-600">
                      Detecting topic transitions and key moments
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500">This may take a few moments</p>
          </div>
        ) : error ? (
          // Error state
          <div className="text-center space-y-4">
            <div className="bg-red-50 border-2 border-red-200 rounded-[24px] p-6">
              <p className="text-red-700 font-semibold mb-2">Failed to generate chapters</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
            {session && (
              <button
                onClick={handleGenerateChapters}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-[16px] font-bold text-sm hover:shadow-lg hover:scale-105 transition-all flex items-center gap-2 mx-auto"
              >
                <Sparkles size={16} />
                Try Again
              </button>
            )}
          </div>
        ) : (
          // Empty state with sparkly button
          <div className="text-center space-y-6">
            <div className="relative inline-flex">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full opacity-20 blur-2xl animate-pulse"></div>
              <BookOpen size={64} className="relative text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No chapters yet</h3>
              <p className="text-sm text-gray-600 max-w-xs mx-auto">
                Let AI analyze your video and create chapter markers automatically
              </p>
            </div>
            {session && (
              <button
                onClick={handleGenerateChapters}
                className="group relative px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-[20px] font-bold text-base hover:shadow-2xl hover:shadow-cyan-500/30 hover:scale-105 transition-all flex items-center gap-3 mx-auto overflow-hidden"
              >
                {/* Animated shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>

                {/* Sparkles icon with animation */}
                <div className="relative">
                  <Sparkles size={20} className="animate-pulse" />
                  <div className="absolute inset-0 animate-ping opacity-40">
                    <Sparkles size={20} />
                  </div>
                </div>

                <span className="relative">Generate Chapters with AI</span>
              </button>
            )}
            {!session && (
              <p className="text-xs text-gray-500">
                Session data required to generate chapters
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 h-full xl:flex xl:flex-col xl:h-[700px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-white border-b border-gray-200 z-10 xl:flex-shrink-0">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <BookOpen size={ICON_SIZES.md} className="text-cyan-600" />
          Chapters
          <span className="text-sm font-normal text-gray-600">({chapters.length})</span>
        </h3>
      </div>

      {/* Chapters List */}
      <div className="overflow-y-auto p-4 space-y-3 xl:flex-1">
        {chapters.map((chapter, index) => {
          const isCurrentChapter = chapter.id === currentChapterId;
          const duration = chapter.endTime - chapter.startTime;

          return (
            <div
              key={chapter.id}
              onClick={() => onSeekToTime(chapter.startTime)}
              className={`p-4 rounded-[16px] border-2 cursor-pointer transition-all ${
                isCurrentChapter
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-400 shadow-lg scale-[1.02]'
                  : 'bg-white border-white/60 hover:bg-white/60 hover:border-white/80 hover:scale-[1.01]'
              }`}
            >
              {/* Chapter Number & Time */}
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={`text-lg font-bold w-8 h-8 rounded-full flex items-center justify-center ${
                    isCurrentChapter
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {index + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                        isCurrentChapter
                          ? 'bg-cyan-500 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      <Clock size={12} />
                      {formatTime(chapter.startTime)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDuration(duration)}
                    </span>
                  </div>
                  {isCurrentChapter && (
                    <span className="text-xs font-semibold text-cyan-600 animate-pulse mt-1 inline-block">
                      ▶ Playing
                    </span>
                  )}
                </div>
              </div>

              {/* Chapter Title */}
              <h4
                className={`font-bold mb-2 ${
                  isCurrentChapter ? 'text-gray-900 text-base' : 'text-gray-800 text-sm'
                }`}
              >
                {chapter.title}
              </h4>

              {/* Chapter Summary */}
              {chapter.summary && (
                <p
                  className={`text-sm leading-relaxed ${
                    isCurrentChapter ? 'text-gray-800' : 'text-gray-600'
                  }`}
                >
                  {chapter.summary}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
