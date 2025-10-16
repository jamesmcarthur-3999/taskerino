/**
 * ReviewTimeline Component
 *
 * Unified timeline for the Review tab. Shows all session items chronologically:
 * - Screenshots (compact cards)
 * - Audio segments (with transcripts)
 * - Context items (user notes)
 *
 * Features:
 * - Grouped by video chapters with full metadata
 * - Collapsible/expandable chapters
 * - Clickable chapter headers for seeking
 * - Active chapter highlighting
 * - Screenshot thumbnails
 * - Enhanced visual hierarchy
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit3, Link as LinkIcon, Mic, ChevronDown } from 'lucide-react';
import type { Session, SessionScreenshot, SessionAudioSegment, SessionContextItem, VideoChapter } from '../types';
import { AudioSegmentCard } from './AudioSegmentCard';
import { ScreenshotCard } from './ScreenshotCard';
import { UserNoteCard } from './UserNoteCard';
import { useUI } from '../context/UIContext';
import { RADIUS } from '../design-system/theme';

// Timeline item type
type TimelineItem =
  | { type: 'screenshot'; data: SessionScreenshot }
  | { type: 'audio'; data: SessionAudioSegment }
  | { type: 'context'; data: SessionContextItem };

/**
 * Groups timeline items by which chapter they belong to based on timestamp
 */
function groupItemsByChapter(
  items: TimelineItem[],
  chapters: VideoChapter[],
  sessionStart: Date
): Map<VideoChapter | null, TimelineItem[]> {
  const groups = new Map<VideoChapter | null, TimelineItem[]>();

  // Initialize groups for each chapter
  chapters.forEach(chapter => groups.set(chapter, []));

  // Group for items before first chapter or with no chapters
  groups.set(null, []);

  items.forEach(item => {
    const itemTime = (new Date(item.data.timestamp).getTime() - sessionStart.getTime()) / 1000;

    // Find which chapter this item belongs to
    const chapter = chapters.find(
      c => itemTime >= c.startTime && itemTime < c.endTime
    );

    const group = groups.get(chapter || null) || [];
    group.push(item);
    groups.set(chapter || null, group);
  });

  return groups;
}

interface ReviewTimelineProps {
  session: Session;
  currentTime: number; // Seconds from session start
  onSeek: (timestamp: string) => void;
  onAddComment?: (screenshotId: string, comment: string) => void;
  onToggleFlag?: (screenshotId: string) => void;
  onAddContext?: (contextItem: SessionContextItem) => void;
  showContextCapture?: boolean;
}

export function ReviewTimeline({
  session,
  currentTime,
  onSeek,
  onAddContext,
  showContextCapture,
}: ReviewTimelineProps) {
  const { addNotification } = useUI();
  const [showContextInput, setShowContextInput] = useState(false);
  const [quickNoteContent, setQuickNoteContent] = useState('');
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());
  const contextInputRef = useRef<HTMLInputElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  // Memoize timeline items for performance
  const sortedTimelineItems = useMemo(() => {
    const screenshots = session.screenshots || [];
    const audioSegments = session.audioSegments || [];
    const contextItems = session.contextItems || [];

    // Merge all timeline items
    const timelineItems: TimelineItem[] = [
      ...screenshots.map(s => ({ type: 'screenshot' as const, data: s })),
      ...audioSegments.map(a => ({ type: 'audio' as const, data: a })),
      ...contextItems.map(c => ({ type: 'context' as const, data: c }))
    ];

    // Sort chronologically (oldest first - scroll down to see later events)
    return [...timelineItems].sort((a, b) => {
      const timeA = new Date(a.data.timestamp).getTime();
      const timeB = new Date(b.data.timestamp).getTime();
      return timeA - timeB;
    });
  }, [session.screenshots, session.audioSegments, session.contextItems]);

  // Group items by chapters if chapters exist
  const chapters = session.video?.chapters || [];
  const hasChapters = chapters.length > 0;
  const groupedItems = useMemo(() =>
    hasChapters
      ? groupItemsByChapter(sortedTimelineItems, chapters, new Date(session.startTime))
      : new Map<VideoChapter | null, TimelineItem[]>(),
    [sortedTimelineItems, chapters, hasChapters, session.startTime]
  );

  // Auto-focus context input
  useEffect(() => {
    if (showContextInput && contextInputRef.current) {
      contextInputRef.current.focus();
    }
  }, [showContextInput]);

  // Auto-scroll to active item when currentTime changes
  useEffect(() => {
    if (activeItemRef.current && timelineContainerRef.current) {
      const container = timelineContainerRef.current;
      const activeItem = activeItemRef.current;

      const containerRect = container.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();

      // Check if item is visible in container
      const isVisible =
        itemRect.top >= containerRect.top &&
        itemRect.bottom <= containerRect.bottom;

      if (!isVisible) {
        // Scroll to center the active item
        const scrollOffset = activeItem.offsetTop - container.offsetTop - (container.clientHeight / 2) + (activeItem.clientHeight / 2);
        container.scrollTo({
          top: scrollOffset,
          behavior: 'smooth'
        });
      }
    }
  }, [currentTime]);

  // Helper: Format time (seconds to MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper: Format duration in human-readable format
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins === 0) {
      return `${secs}s`;
    }
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // Helper: Check if chapter is active
  const isChapterActive = (chapter: VideoChapter): boolean => {
    return currentTime >= chapter.startTime && currentTime < chapter.endTime;
  };

  // Helper: Calculate chapter progress
  const getChapterProgress = (chapter: VideoChapter): number => {
    if (!isChapterActive(chapter)) return 0;
    const elapsed = currentTime - chapter.startTime;
    const duration = chapter.endTime - chapter.startTime;
    return Math.min(100, (elapsed / duration) * 100);
  };

  // Helper: Handle chapter header click
  const handleChapterClick = (chapter: VideoChapter) => {
    const timestamp = new Date(new Date(session.startTime).getTime() + chapter.startTime * 1000).toISOString();
    onSeek(timestamp);
  };

  // Helper: Toggle chapter collapse
  const toggleChapterCollapse = (chapterId: string) => {
    setCollapsedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  };

  const handleAddQuickNote = () => {
    if (!quickNoteContent.trim() || !onAddContext) return;

    const contextItem: SessionContextItem = {
      id: `context-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sessionId: session.id,
      timestamp: new Date().toISOString(),
      type: 'note',
      content: quickNoteContent.trim(),
    };

    onAddContext(contextItem);
    setQuickNoteContent('');
    setShowContextInput(false);

    addNotification({
      type: 'success',
      title: 'Note Added',
      message: 'Quick note added to timeline',
    });
  };

  // Check if item is currently playing
  const isItemActive = useCallback((timestamp: string) => {
    const sessionStart = new Date(session.startTime).getTime();
    const itemTime = (new Date(timestamp).getTime() - sessionStart) / 1000;
    return Math.abs(currentTime - itemTime) < 5; // Within 5 seconds = active
  }, [session.startTime, currentTime]);

  // Render a single timeline item (used by both grouped and flat views)
  const renderTimelineItem = useCallback((item: TimelineItem, index: number) => {
    const isActive = isItemActive(item.data.timestamp);

    // Context items
    if (item.type === 'context') {
      const contextItem = item.data as SessionContextItem;
      return (
        <div
          key={contextItem.id}
          ref={isActive ? activeItemRef : null}
          className="flex gap-6 relative w-full"
        >
          <div className="relative flex-shrink-0">
            <div className={`w-5 h-5 rounded-full transition-all duration-300 ${
              isActive
                ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-400/50 scale-150 animate-pulse'
                : 'bg-gradient-to-br from-amber-300 to-amber-500 border-2 border-white shadow-md'
            }`} style={isActive ? { boxShadow: '0 0 20px rgba(251, 191, 36, 0.6), 0 0 40px rgba(251, 191, 36, 0.3)' } : {}} />
          </div>

          <div className="flex-1">
            <UserNoteCard
              contextItem={contextItem}
              sessionStartTime={session.startTime}
              isActive={isActive}
              onClick={() => onSeek(contextItem.timestamp)}
              onEdit={(id, content) => console.log('Edit note:', id, content)}
              onDelete={(id) => console.log('Delete note:', id)}
              onConvertToTask={(content) => console.log('Convert to task:', content)}
              priority="normal"
            />
          </div>
        </div>
      );
    }

    // Audio segments
    if (item.type === 'audio') {
      const segment = item.data as SessionAudioSegment;
      return (
        <div
          key={segment.id}
          ref={isActive ? activeItemRef : null}
          onClick={() => onSeek(segment.timestamp)}
          className="flex gap-6 relative w-full cursor-pointer"
        >
          <div className="relative flex-shrink-0">
            <div className={`w-5 h-5 rounded-full transition-all duration-300 ${
              isActive
                ? 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-400/50 scale-150 animate-pulse'
                : 'bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-white shadow-md'
            }`} style={isActive ? { boxShadow: '0 0 20px rgba(168, 85, 247, 0.6), 0 0 40px rgba(168, 85, 247, 0.3)' } : {}} />
          </div>

          <div className="flex-1">
            <AudioSegmentCard
              segment={segment}
              sessionStartTime={session.startTime}
            />
          </div>
        </div>
      );
    }

    // Screenshots
    const screenshot = item.data as SessionScreenshot;
    const isCodeActivity = screenshot.aiAnalysis?.detectedActivity?.toLowerCase().includes('code');

    return (
      <div
        key={screenshot.id}
        ref={isActive ? activeItemRef : null}
        className="flex gap-6 relative w-full"
      >
        <div className="relative flex-shrink-0">
          <div className={`w-5 h-5 rounded-full transition-all duration-300 ${
            isActive
              ? `${isCodeActivity ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-slate-400 to-slate-600'} shadow-lg scale-150 animate-pulse`
              : `${isCodeActivity ? 'bg-gradient-to-br from-blue-300 to-blue-500' : 'bg-gradient-to-br from-slate-300 to-slate-500'} border-2 border-white shadow-md`
          }`} style={isActive ? {
            boxShadow: isCodeActivity
              ? '0 0 20px rgba(96, 165, 250, 0.6), 0 0 40px rgba(96, 165, 250, 0.3)'
              : '0 0 20px rgba(148, 163, 184, 0.6), 0 0 40px rgba(148, 163, 184, 0.3)'
          } : {}} />
        </div>

        <div className="flex-1">
          <ScreenshotCard
            screenshot={screenshot}
            sessionStartTime={session.startTime}
            isActive={isActive}
            onClick={() => onSeek(screenshot.timestamp)}
          />
        </div>
      </div>
    );
  }, [isItemActive, session.startTime, session.id, onSeek]);

  if (sortedTimelineItems.length === 0) {
    return (
      <div className={`bg-white/40 backdrop-blur-xl rounded-[${RADIUS.field}px] border border-white/60 p-8 text-center`}>
        <p className="text-gray-600">No timeline items yet</p>
      </div>
    );
  }

  return (
    <div className={`
  relative
  bg-gradient-to-br from-white/60 via-white/50 to-white/40
  backdrop-blur-xl
  rounded-[${RADIUS.card}px]
  shadow-[0_8px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)]
  border border-white/60
  ring-1 ring-black/5
  overflow-visible
`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-8 pt-8">
        <h4 className="text-sm font-bold text-gray-900">Timeline</h4>
        {onAddContext && session.status === 'active' && (
          <button
            onClick={() => setShowContextInput(!showContextInput)}
            className={`px-3 py-1.5 rounded-[12px] font-semibold text-xs transition-all flex items-center gap-1.5 ${
              showContextInput
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                : 'bg-white/40 backdrop-blur-sm text-gray-700 hover:bg-white/60 border border-white/60'
            }`}
          >
            <Plus size={14} />
            {showContextInput ? 'Hide' : 'Add Note'}
          </button>
        )}
      </div>

      {/* Context Input */}
      {showContextInput && onAddContext && (
        <div className={`bg-white/60 backdrop-blur-sm rounded-[${RADIUS.element}px] border border-white/60 p-4 mb-4 mx-8 animate-in fade-in slide-in-from-top-2 duration-200`}>
          <input
            ref={contextInputRef}
            type="text"
            value={quickNoteContent}
            onChange={(e) => setQuickNoteContent(e.target.value)}
            placeholder="Type your note and press Enter..."
            className={`w-full px-3 py-2 bg-white/60 backdrop-blur-sm border border-white/80 rounded-[${RADIUS.element}px] focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 outline-none transition-all text-sm text-gray-900 placeholder:text-gray-500`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && quickNoteContent.trim()) {
                handleAddQuickNote();
              }
            }}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-gray-500">Press Enter to add</span>
            <button
              onClick={() => {
                setShowContextInput(false);
                setQuickNoteContent('');
              }}
              className="text-[10px] text-gray-500 hover:text-gray-700 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Timeline Items - Virtualized */}
      <div
        ref={timelineContainerRef}
        className="relative px-8 pb-8"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#22d3ee rgba(255, 255, 255, 0.2)'
        }}
      >
        {hasChapters ? (
          // Grouped by chapters - SHOW ALL CHAPTERS (Keep existing chapter rendering for now)
          <div className="space-y-4 overflow-x-visible">
          {Array.from(groupedItems.entries()).map(([chapter, items], chapterIndex) => {
            // Skip null chapter (items before first chapter)
            if (!chapter) {
              // Render items without chapter header
              if (items.length === 0) return null;
              return (
                <div key="uncategorized" className="mb-6">
                  <div className="space-y-4 ml-9">
                    {items.map((item, index) => renderTimelineItem(item, index))}
                  </div>
                </div>
              );
            }

            const isActive = isChapterActive(chapter);
            const isCollapsed = collapsedChapters.has(chapter.id);
            const progress = getChapterProgress(chapter);
            const duration = chapter.endTime - chapter.startTime;

            return (
              <div key={chapter.id} className="mb-6">
                {/* Chapter Header - Gradient Border */}
                <div className={`
                  bg-gradient-to-r rounded-[${RADIUS.field}px] p-[2px] transition-all mb-4
                  ${isActive
                    ? 'from-violet-500 via-purple-500 to-pink-500 shadow-[0_8px_32px_rgba(139,92,246,0.3),0_0_24px_rgba(236,72,153,0.2)] scale-[1.02]'
                    : 'from-gray-200 to-gray-300 shadow-sm'
                  }
                `}>
                  <div className={`bg-white/90 backdrop-blur-xl rounded-[${RADIUS.field - 2}px]`}>
                    {/* Clickable Header */}
                    <button
                      onClick={() => handleChapterClick(chapter)}
                      className={`w-full text-left p-4 hover:bg-white/50 transition-colors rounded-[${RADIUS.field - 2}px]`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Number Badge */}
                        <div className={`
                          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                          ${isActive
                            ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-md'
                            : 'bg-gray-200 text-gray-700'
                          }
                        `}>
                          {chapterIndex + 1}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Title and Time Range */}
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h5 className={`text-sm font-bold truncate ${isActive ? 'text-cyan-700' : 'text-gray-900'}`}>
                              {chapter.title}
                            </h5>
                            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                              {formatTime(chapter.startTime)} - {formatTime(chapter.endTime)}
                            </span>
                          </div>

                          {/* Summary */}
                          {chapter.summary && (
                            <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                              {chapter.summary}
                            </p>
                          )}

                          {/* Metadata Row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Duration Badge */}
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                              {formatDuration(duration)}
                            </span>

                            {/* Confidence Badge */}
                            {chapter.confidence !== undefined && (
                              <span className={`
                                inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                                ${chapter.confidence >= 0.8
                                  ? 'bg-green-100 text-green-700'
                                  : chapter.confidence >= 0.6
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-orange-100 text-orange-700'
                                }
                              `}>
                                {Math.round(chapter.confidence * 100)}% confident
                              </span>
                            )}

                            {/* Key Topics */}
                            {chapter.keyTopics && chapter.keyTopics.length > 0 && (
                              <>
                                {chapter.keyTopics.slice(0, 3).map((topic, idx) => (
                                  <span
                                    key={idx}
                                    className={`
                                      inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                                      ${isActive ? 'bg-cyan-100 text-cyan-700' : 'bg-blue-100 text-blue-700'}
                                    `}
                                  >
                                    {topic}
                                  </span>
                                ))}
                                {chapter.keyTopics.length > 3 && (
                                  <span className="text-[10px] text-gray-500">
                                    +{chapter.keyTopics.length - 3} more
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Progress Bar (only if active) */}
                          {isActive && progress > 0 && (
                            <div className="mt-2 bg-gray-200 rounded-full h-1 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Collapse Toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleChapterCollapse(chapter.id);
                          }}
                          className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <ChevronDown
                            size={16}
                            className={`text-gray-500 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                          />
                        </button>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Timeline Items in Chapter - Indented */}
                {!isCollapsed && (
                  <div className="ml-12 relative">
                    {/* Connector line for items */}
                    {items.length > 0 && (
                      <div className="absolute left-[10px] top-0 bottom-0 w-1 bg-gradient-to-b from-violet-400 via-purple-500 to-pink-500 opacity-80 shadow-[0_0_12px_rgba(139,92,246,0.3)] rounded-full" />
                    )}

                    <div className="space-y-4">
                      {items.length === 0 ? (
                        <div className="text-xs text-gray-500 italic py-2">
                          No activity in this chapter
                        </div>
                      ) : (
                        items.map((item, index) => renderTimelineItem(item, index))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        ) : (
          // No chapters - render flat timeline
          <div className="relative">
            <div className="absolute left-[10px] top-0 bottom-0 w-1 bg-gradient-to-b from-violet-400 via-purple-500 to-pink-500 opacity-80 shadow-[0_0_12px_rgba(139,92,246,0.3)] rounded-full z-0" />
            <div className="space-y-4">
              {sortedTimelineItems.map((item, index) => renderTimelineItem(item, index))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
