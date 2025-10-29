/**
 * SessionPreview Component
 *
 * Displays session metadata in a lightweight preview UI.
 * Fast load (<100ms) using ChunkedSessionStorage.loadMetadata().
 *
 * Features:
 * - Session metadata (name, description, timestamps, category, tags)
 * - Summary (if available from enrichment)
 * - Basic stats (screenshot count, audio duration, video duration)
 * - "Load Full Session" button for full mode transition
 *
 * Performance:
 * - Metadata load: <50ms (ChunkedSessionStorage target)
 * - Render time: <100ms
 *
 * @see src/services/storage/ChunkedSessionStorage.ts
 */

import { useState, useEffect } from 'react';
import { Calendar, Clock, Camera, Mic, Video, Tag, FileText, CheckCircle2, AlertCircle, Target, Lightbulb, Play } from 'lucide-react';
import type { SessionMetadata } from '../../services/storage/ChunkedSessionStorage';
import { getChunkedStorage } from '../../services/storage/ChunkedSessionStorage';
import { getGlassClasses, getRadiusClass, BACKGROUND_GRADIENT } from '../../design-system/theme';

interface SessionPreviewProps {
  sessionId: string;
  onLoadFull: () => void;
}

export function SessionPreview({ sessionId, onLoadFull }: SessionPreviewProps) {
  const [metadata, setMetadata] = useState<SessionMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadTime, setLoadTime] = useState(0);

  useEffect(() => {
    loadMetadata();
  }, [sessionId]);

  async function loadMetadata() {
    const startTime = performance.now();
    setLoading(true);
    setLoadError(null);

    try {
      const chunkedStorage = await getChunkedStorage();
      const sessionMetadata = await chunkedStorage.loadMetadata(sessionId);

      if (!sessionMetadata) {
        setLoadError('Session not found');
        setMetadata(null);
      } else {
        setMetadata(sessionMetadata);

        // Also load summary if available (separate chunk, but still fast <50ms)
        if (sessionMetadata.hasSummary) {
          const summary = await chunkedStorage.loadSummary(sessionId);
          if (summary) {
            // Merge summary into metadata for display
            setMetadata({ ...sessionMetadata, summary } as any);
          }
        }
      }
    } catch (error) {
      console.error('[SessionPreview] Failed to load metadata:', error);
      setLoadError('Failed to load session preview');
      setMetadata(null);
    } finally {
      const endTime = performance.now();
      setLoadTime(endTime - startTime);
      setLoading(false);
    }
  }

  // Format date helper
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Format duration helper
  const formatDuration = (ms: number) => {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Loading state
  if (loading) {
    return (
      <div className={`h-full w-full ${BACKGROUND_GRADIENT.primary} ${getRadiusClass('card')} shadow-xl overflow-hidden relative flex items-center justify-center`}>
        <div className="text-center">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6 py-4 rounded-2xl shadow-lg">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="font-semibold">Loading preview...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError || !metadata) {
    return (
      <div className={`h-full w-full ${BACKGROUND_GRADIENT.primary} ${getRadiusClass('card')} shadow-xl overflow-hidden relative flex items-center justify-center`}>
        <div className="text-center max-w-md px-8">
          <div className={`${getGlassClasses('medium')} ${getRadiusClass('modal')} p-8`}>
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Preview Not Available</h3>
            <p className="text-gray-600 mb-4">{loadError || 'Session not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate duration
  const duration = metadata.endTime
    ? new Date(metadata.endTime).getTime() - new Date(metadata.startTime).getTime()
    : Date.now() - new Date(metadata.startTime).getTime();

  // Summary data (if available)
  const summary = (metadata as any).summary;

  return (
    <div className={`h-full w-full ${BACKGROUND_GRADIENT.primary} ${getRadiusClass('card')} shadow-xl overflow-hidden relative flex flex-col`}>
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 via-cyan-500/10 to-teal-500/10 animate-gradient-reverse pointer-events-none" />

      {/* Header */}
      <div className={`relative z-10 flex-shrink-0 ${getGlassClasses('medium')} border-b-2 shadow-xl p-6`}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{metadata.name}</h1>
            <span className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-2 border-cyan-400/50 rounded-full text-xs font-bold text-cyan-800 shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              Preview Mode
            </span>
          </div>

          {/* Quick stats row */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} />
              <span>{formatDate(metadata.startTime)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>{formatDuration(duration)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Camera size={14} />
              <span>{metadata.chunks.screenshots.count} screenshots</span>
            </div>
            {metadata.chunks.audioSegments.count > 0 && (
              <div className="flex items-center gap-1.5">
                <Mic size={14} />
                <span>{metadata.chunks.audioSegments.count} audio segments</span>
              </div>
            )}
            {metadata.hasVideo && (
              <div className="flex items-center gap-1.5">
                <Video size={14} />
                <span>Video</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Description */}
          {metadata.description && (
            <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-6`}>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Description</h3>
              <p className="text-gray-800 leading-relaxed">{metadata.description}</p>
            </div>
          )}

          {/* Category & Tags */}
          <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-6`}>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Metadata</h3>

            <div className="space-y-3">
              {metadata.category && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 min-w-[100px]">Category:</span>
                  <span className="px-3 py-1 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full text-sm font-semibold text-cyan-800">
                    {metadata.category}
                  </span>
                  {metadata.subCategory && (
                    <span className="px-3 py-1 bg-white/50 rounded-full text-sm font-semibold text-gray-700">
                      {metadata.subCategory}
                    </span>
                  )}
                </div>
              )}

              {metadata.tags && metadata.tags.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-sm text-gray-600 min-w-[100px]">Tags:</span>
                  <div className="flex flex-wrap gap-2">
                    {metadata.tags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className="px-3 py-1 bg-white/50 rounded-full text-sm font-semibold text-gray-700"
                      >
                        <Tag size={12} className="inline mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 min-w-[100px]">Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  metadata.status === 'completed' ? 'bg-green-100 text-green-800' :
                  metadata.status === 'active' ? 'bg-blue-100 text-blue-800' :
                  metadata.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {metadata.status.charAt(0).toUpperCase() + metadata.status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Summary (if available) */}
          {summary && (
            <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">AI Summary</h3>
              </div>

              {/* Narrative */}
              {summary.narrative && (
                <div className={`${getGlassClasses('subtle')} ${getRadiusClass('field')} p-4 mb-4`}>
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{summary.narrative}</p>
                </div>
              )}

              {/* Achievements & Blockers Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Achievements */}
                {summary.achievements && summary.achievements.length > 0 && (
                  <div className={`${getGlassClasses('subtle')} ${getRadiusClass('field')} p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                        Achievements
                      </h4>
                    </div>
                    <ul className="space-y-2">
                      {summary.achievements.slice(0, 3).map((achievement: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span className="flex-1 line-clamp-2">{achievement}</span>
                        </li>
                      ))}
                      {summary.achievements.length > 3 && (
                        <li className="text-xs text-gray-500 italic">
                          +{summary.achievements.length - 3} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Blockers */}
                {summary.blockers && summary.blockers.length > 0 && (
                  <div className={`${getGlassClasses('subtle')} ${getRadiusClass('field')} p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                        Blockers
                      </h4>
                    </div>
                    <ul className="space-y-2">
                      {summary.blockers.slice(0, 3).map((blocker: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                          <span className="text-red-600 mt-0.5">⚠</span>
                          <span className="flex-1 line-clamp-2">{blocker}</span>
                        </li>
                      ))}
                      {summary.blockers.length > 3 && (
                        <li className="text-xs text-gray-500 italic">
                          +{summary.blockers.length - 3} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Key Insights (preview 3) */}
              {summary.keyInsights && summary.keyInsights.length > 0 && (
                <div className={`${getGlassClasses('subtle')} ${getRadiusClass('field')} p-4 mt-4`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                      Key Insights
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {summary.keyInsights.slice(0, 3).map((item: any, i: number) => (
                      <div key={i} className="text-sm text-gray-800 line-clamp-2">
                        <span className="text-amber-600 mr-1">💡</span>
                        {item.insight}
                      </div>
                    ))}
                    {summary.keyInsights.length > 3 && (
                      <div className="text-xs text-gray-500 italic">
                        +{summary.keyInsights.length - 3} more insights
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recommended Tasks (preview 3) */}
              {summary.recommendedTasks && summary.recommendedTasks.length > 0 && (
                <div className={`${getGlassClasses('subtle')} ${getRadiusClass('field')} p-4 mt-4`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-cyan-600" />
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                      Recommended Tasks
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {summary.recommendedTasks.slice(0, 3).map((task: any, i: number) => (
                      <div key={i} className="text-sm text-gray-800">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold line-clamp-1">{task.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                            task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    ))}
                    {summary.recommendedTasks.length > 3 && (
                      <div className="text-xs text-gray-500 italic">
                        +{summary.recommendedTasks.length - 3} more tasks
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            {/* Screenshots */}
            <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} border-2 border-purple-300/40 p-5`}>
              <div className="flex items-center gap-2 text-purple-700 mb-2">
                <Camera size={18} />
                <span className="text-xs font-semibold uppercase tracking-wide">Screenshots</span>
              </div>
              <p className="text-3xl font-bold text-purple-800">{metadata.chunks.screenshots.count}</p>
            </div>

            {/* Audio */}
            {metadata.chunks.audioSegments.count > 0 && (
              <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} border-2 border-blue-300/40 p-5`}>
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <Mic size={18} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Audio</span>
                </div>
                <p className="text-3xl font-bold text-blue-800">{metadata.chunks.audioSegments.count}</p>
                <p className="text-xs text-blue-700 mt-1">segments</p>
              </div>
            )}

            {/* Video */}
            {metadata.hasVideo && metadata.video && (
              <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} border-2 border-teal-300/40 p-5`}>
                <div className="flex items-center gap-2 text-teal-700 mb-2">
                  <Video size={18} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Video</span>
                </div>
                <p className="text-3xl font-bold text-teal-800">{formatDuration(metadata.video.duration * 1000)}</p>
              </div>
            )}
          </div>

          {/* Load Full Session Button */}
          <div className="sticky bottom-0 py-6 bg-gradient-to-t from-white/80 via-white/60 to-transparent backdrop-blur-sm">
            <button
              onClick={onLoadFull}
              className="w-full px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-2xl font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-xl flex items-center justify-center gap-3"
            >
              <Play size={24} />
              Load Full Session
            </button>
            {loadTime > 0 && (
              <p className="text-center text-xs text-gray-500 mt-2">
                Preview loaded in {Math.round(loadTime)}ms
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
