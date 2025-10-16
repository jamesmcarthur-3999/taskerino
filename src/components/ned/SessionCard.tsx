/**
 * Session Card - Enhanced
 *
 * Interactive session display in Ned's chat with rich features:
 * - Status color-coded border
 * - Activity type badges
 * - Duration and screenshot metrics
 * - Recent activities from AI analysis
 * - Extracted tasks/notes preview
 * - Ask Ned button
 * - Session navigation
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  Clock,
  Camera,
  Tag,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageCircle,
  FileText,
  ListTodo,
  Activity,
  Calendar
} from 'lucide-react';
import type { Session } from '../../types';
import { EnrichmentLoadingBar } from './EnrichmentLoadingBar';

interface SessionCardProps {
  session: Session;
  onView?: (sessionId: string) => void;
  onAskNed?: (context: string) => void;
  compact?: boolean;
}

const STATUS_COLORS = {
  active: 'border-l-green-500 bg-green-50/70',
  paused: 'border-l-orange-500 bg-orange-50/70',
  completed: 'border-l-gray-500 bg-white/50',
};

const STATUS_ICONS = {
  active: PlayCircle,
  paused: PauseCircle,
  completed: CheckCircle2,
};

const STATUS_ICON_COLORS = {
  active: 'text-green-600',
  paused: 'text-orange-600',
  completed: 'text-gray-600',
};

const ACTIVITY_COLORS = {
  coding: 'bg-blue-100/70 text-blue-700',
  meeting: 'bg-purple-100/70 text-purple-700',
  research: 'bg-cyan-100/70 text-cyan-700',
  design: 'bg-pink-100/70 text-pink-700',
  email: 'bg-green-100/70 text-green-700',
  other: 'bg-gray-100/70 text-gray-700',
};

export const SessionCard = React.memo<SessionCardProps>(({
  session,
  onView,
  onAskNed,
  compact = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [showExtracted, setShowExtracted] = useState(false);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    let dateText = '';
    if (diffDays === 0) dateText = 'Today';
    else if (diffDays === 1) dateText = 'Yesterday';
    else if (diffDays < 7) dateText = `${diffDays} days ago`;
    else dateText = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const timeText = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${dateText} at ${timeText}`;
  };

  const handleAskNed = () => {
    if (!onAskNed) return;
    onAskNed(`Tell me more about the session: "${session.name}"`);
  };

  // Calculate duration (excluding pause time)
  const calculateDuration = () => {
    if (session.totalDuration !== undefined) return session.totalDuration;
    if (!session.startTime) return 0;

    const startMs = new Date(session.startTime).getTime();
    const endMs = session.endTime ? new Date(session.endTime).getTime() : new Date().getTime();
    let totalPausedMs = session.totalPausedTime || 0;

    // If currently paused, add current pause duration
    if (session.status === 'paused' && session.pausedAt) {
      const currentPauseDuration = new Date().getTime() - new Date(session.pausedAt).getTime();
      totalPausedMs += currentPauseDuration;
    }

    // Calculate active duration: (end - start - total paused time) in minutes
    const activeMs = endMs - startMs - totalPausedMs;
    return Math.floor(activeMs / (1000 * 60));
  };

  const duration = calculateDuration();

  // Get recent activities from screenshots
  const recentActivities = session.screenshots
    .filter(ss => ss.aiAnalysis?.detectedActivity)
    .slice(-3)
    .map(ss => ss.aiAnalysis!.detectedActivity);

  const StatusIcon = STATUS_ICONS[session.status];

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/70 backdrop-blur-xl border-2 border-white/60 shadow-lg shadow-cyan-100/30 cursor-pointer hover:border-cyan-300/60 hover:shadow-cyan-200/40 transition-all"
        onClick={() => onView?.(session.id)}
      >
        <StatusIcon className={`w-4 h-4 ${STATUS_ICON_COLORS[session.status]} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 truncate">
            {session.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
            <span>{formatDuration(duration)}</span>
            <span>•</span>
            <span>{session.screenshots.length} screenshots</span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`rounded-xl border-2 border-l-4 overflow-hidden transition-all ${
        STATUS_COLORS[session.status]
      } backdrop-blur-xl border-white/60 shadow-lg shadow-cyan-100/30 hover:shadow-xl hover:shadow-cyan-200/40`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 border-b border-white/60">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-cyan-100/70 flex-shrink-0">
            <StatusIcon className={`w-4 h-4 ${STATUS_ICON_COLORS[session.status]}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900">
              {session.name}
            </h3>
            {session.description && (
              <p className="text-sm text-gray-600 mt-1">
                {session.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-600">
              {/* Date/Time */}
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDateTime(session.startTime)}</span>
              </div>
              {/* Duration */}
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatDuration(duration)}</span>
              </div>
              {/* Screenshot Count */}
              <div className="flex items-center gap-1">
                <Camera className="w-3 h-3" />
                <span>{session.screenshots.length} screenshots</span>
              </div>
              {/* Activity Type */}
              {session.activityType && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  ACTIVITY_COLORS[session.activityType as keyof typeof ACTIVITY_COLORS] || ACTIVITY_COLORS.other
                }`}>
                  {session.activityType}
                </span>
              )}
              {/* Status Badge */}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                session.status === 'active' ? 'bg-green-100/70 text-green-700' :
                session.status === 'paused' ? 'bg-orange-100/70 text-orange-700' :
                'bg-gray-100/70 text-gray-700'
              }`}>
                {session.status}
              </span>
            </div>
          </div>
        </div>

        {/* Actions - Enhanced on Hover */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <AnimatePresence>
            {isHovered && (
              <>
                {onAskNed && (
                  <motion.button
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    onClick={handleAskNed}
                    className="p-1.5 rounded-lg hover:bg-purple-100/70 transition-all hover:shadow-md"
                    title="Ask Ned about this session"
                  >
                    <MessageCircle className="w-4 h-4 text-purple-600" />
                  </motion.button>
                )}
                {onView && (
                  <motion.button
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ delay: 0.05 }}
                    onClick={() => onView(session.id)}
                    className="p-1.5 rounded-lg hover:bg-white/80 transition-all hover:shadow-md"
                    title="View full session"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-600" />
                  </motion.button>
                )}
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Recent Activities */}
      {recentActivities.length > 0 && (
        <div className="px-4 py-3 border-b border-white/60">
          <button
            onClick={() => setShowActivities(!showActivities)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-cyan-600 transition-colors mb-2"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Recent Activities</span>
            {showActivities ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          <AnimatePresence>
            {showActivities && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5"
              >
                {recentActivities.map((activity, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="w-1 h-1 bg-cyan-500 rounded-full mt-1.5 flex-shrink-0" />
                    <span>{activity}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Extracted Tasks/Notes */}
      {(session.extractedTaskIds.length > 0 || session.extractedNoteIds.length > 0) && (
        <div className="px-4 py-3">
          <button
            onClick={() => setShowExtracted(!showExtracted)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-cyan-600 transition-colors"
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>
              Extracted {session.extractedTaskIds.length} task{session.extractedTaskIds.length !== 1 ? 's' : ''}, {session.extractedNoteIds.length} note{session.extractedNoteIds.length !== 1 ? 's' : ''}
            </span>
            {showExtracted ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          <AnimatePresence>
            {showExtracted && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 p-3 rounded-lg bg-white/50 border border-white/60"
              >
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  {session.extractedTaskIds.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <ListTodo className="w-3.5 h-3.5" />
                      <span>{session.extractedTaskIds.length} task{session.extractedTaskIds.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {session.extractedNoteIds.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{session.extractedNoteIds.length} note{session.extractedNoteIds.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Tags */}
      {session.tags && session.tags.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2">
            <Tag className="w-3 h-3 text-gray-500 flex-shrink-0" />
            <div className="relative max-w-full overflow-hidden">
              <div
                className="flex items-center gap-2 overflow-x-auto max-w-full"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                <div className="flex items-center gap-2 flex-nowrap" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {session.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs rounded-full bg-cyan-100/70 text-cyan-700 hover:bg-cyan-200/70 transition-colors cursor-pointer flex-shrink-0"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              {/* Subtle fade-out gradient at the right edge */}
              {session.tags.length > 3 && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none"
                  style={{
                    background: 'linear-gradient(to left, rgba(255, 255, 255, 0.95), transparent)',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enrichment Loading Bar - Shows at bottom when enrichment is in progress */}
      <EnrichmentLoadingBar session={session} />
    </motion.div>
  );
});
