/**
 * SessionRelationshipCard Component
 *
 * Rich card display for related sessions with:
 * - Status icon with color-coded background
 * - Duration and screenshot count
 * - Activity type badges
 * - Recent activities from AI analysis
 * - Hover actions (view, remove)
 * - 3 variants: compact, default, expanded
 * - Framer Motion animations
 * - Full accessibility support
 *
 * Based on RELATIONSHIP_CARD_SPECIFICATIONS.md
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Camera,
  Calendar,
  Tag,
  ExternalLink,
  Trash2,
  Activity,
} from 'lucide-react';
import type { Session } from '@/types';
import type { Relationship } from '@/types/relationships';
import { getRadiusClass, TRANSITIONS } from '@/design-system/theme';
import { useRelationshipActions } from '@/hooks/useRelationshipActions';

// ============================================================================
// TYPES
// ============================================================================

export interface SessionRelationshipCardProps {
  relationship: Relationship;
  session: Session;
  variant?: 'compact' | 'default' | 'expanded';
  onView?: (sessionId: string) => void;
  onRemove?: () => void;
  showActions?: boolean;
  showActivities?: boolean;
  showExcerpt?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_COLORS = {
  active: 'border-l-green-500 bg-green-50/50',
  paused: 'border-l-yellow-500 bg-yellow-50/50',
  completed: 'border-l-gray-500 bg-white/50',
  interrupted: 'border-l-red-500 bg-red-50/50',
} as const;

const STATUS_ICON_BG = {
  active: 'bg-green-100',
  paused: 'bg-yellow-100',
  completed: 'bg-gray-100',
  interrupted: 'bg-red-100',
} as const;

const STATUS_ICON_COLORS = {
  active: 'text-green-600',
  paused: 'text-yellow-600',
  completed: 'text-gray-600',
  interrupted: 'text-red-600',
} as const;

const ACTIVITY_COLORS = {
  coding: 'bg-blue-100 text-blue-800',
  meeting: 'bg-purple-100 text-purple-800',
  research: 'bg-cyan-100 text-cyan-800',
  design: 'bg-pink-100 text-pink-800',
  email: 'bg-emerald-100 text-emerald-800',
  other: 'bg-gray-100 text-gray-700',
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 25,
      duration: 0.3,
    },
  },
  exit: {
    opacity: 0,
    y: -5,
    transition: {
      duration: 0.2,
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format duration from minutes to human-readable string
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format date/time to relative or absolute string
 */
function formatDateTime(dateStr: string): string {
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
}

/**
 * Calculate session duration in minutes
 */
function calculateDuration(session: Session): number {
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
}

/**
 * Get recent activities from session screenshots
 */
function getRecentActivities(session: Session, limit: number = 3): string[] {
  return session.screenshots
    .filter(ss => ss.aiAnalysis?.detectedActivity)
    .slice(-limit)
    .map(ss => ss.aiAnalysis!.detectedActivity);
}

// ============================================================================
// COMPONENT
// ============================================================================

export const SessionRelationshipCard = React.memo<SessionRelationshipCardProps>(
  ({
    relationship,
    session,
    variant = 'default',
    onView,
    onRemove,
    showActions = true,
    showActivities = false,
    showExcerpt = false,
  }) => {
    // State
    const [isHovered, setIsHovered] = useState(false);

    // Computed values
    const duration = useMemo(() => calculateDuration(session), [session]);
    const recentActivities = useMemo(() => getRecentActivities(session), [session]);

    // Status icon
    const statusIconMap = {
      active: PlayCircle,
      paused: PauseCircle,
      completed: CheckCircle2,
      interrupted: AlertCircle,
    };
    const StatusIcon = statusIconMap[session.status];

    // Compact variant (minimal display)
    if (variant === 'compact') {
      return (
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={`flex items-center gap-2 px-3 py-2 ${getRadiusClass('field')} bg-white/50 backdrop-blur-xl hover:shadow-md ${TRANSITIONS.standard} cursor-pointer`}
          onClick={() => onView?.(session.id)}
        >
          <StatusIcon className={`w-4 h-4 ${STATUS_ICON_COLORS[session.status]} flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 truncate">{session.name}</p>
            <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
              <span>{formatDuration(duration)}</span>
              <span>•</span>
              <span>{session.screenshots.length} screenshots</span>
            </div>
          </div>
        </motion.div>
      );
    }

    // Default and Expanded variants
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative group
          bg-white/70 backdrop-blur-xl
          ${getRadiusClass('card')}
          border-l-4 border-2 border-white/60
          ${STATUS_COLORS[session.status]}
          shadow-lg hover:shadow-xl hover:shadow-cyan-200/40
          ${TRANSITIONS.standard}
          hover:scale-[1.02]
          p-4
        `}
        role="article"
        aria-labelledby={`session-title-${session.id}`}
        aria-describedby={`session-meta-${session.id}`}
      >
        {/* Header Row: Status Icon + Title */}
        <div className="flex items-start gap-3">
          {/* Status Icon Badge */}
          <div
            className={`flex-shrink-0 p-2 ${getRadiusClass('field')} ${STATUS_ICON_BG[session.status]}`}
          >
            <StatusIcon className={`w-4 h-4 ${STATUS_ICON_COLORS[session.status]}`} />
          </div>

          {/* Title + Metadata */}
          <div className="flex-1 min-w-0">
            <h3 id={`session-title-${session.id}`} className="text-base font-semibold leading-normal text-gray-900">
              {session.name}
            </h3>

            {/* Date + Duration + Screenshots + Activity Type */}
            <div
              id={`session-meta-${session.id}`}
              className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-600"
            >
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

              {/* Activity Type Badge (if set) */}
              {session.activityType && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    ACTIVITY_COLORS[session.activityType as keyof typeof ACTIVITY_COLORS] || ACTIVITY_COLORS.other
                  }`}
                >
                  {session.activityType}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons (overlay on hover) */}
        {showActions && (
          <div className="absolute top-3 right-3 z-10">
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-1"
                >
                  {onView && (
                    <button
                      onClick={() => onView(session.id)}
                      className={`p-1.5 ${getRadiusClass('field')} bg-white/90 hover:bg-white ${TRANSITIONS.standard} hover:shadow-md shadow-sm`}
                      aria-label="View session"
                      aria-describedby={`session-title-${session.id}`}
                    >
                      <ExternalLink className="w-4 h-4 text-gray-600" aria-hidden="true" />
                    </button>
                  )}
                  {onRemove && (
                    <button
                      onClick={onRemove}
                      className={`p-1.5 ${getRadiusClass('field')} bg-white/90 hover:bg-red-100 ${TRANSITIONS.standard} hover:shadow-md shadow-sm`}
                      aria-label="Remove relationship"
                      aria-describedby={`session-title-${session.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" aria-hidden="true" />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Recent Activities (if showActivities and activities exist) */}
        {showActivities && recentActivities.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
              <Activity className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Recent Activities</span>
            </div>
            {recentActivities.map((activity, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="w-1 h-1 bg-cyan-500 rounded-full mt-1.5 flex-shrink-0" aria-hidden="true" />
                <span>{activity}</span>
              </div>
            ))}
          </div>
        )}

        {/* Excerpt (AI-generated summary) */}
        {showExcerpt && session.summary?.narrative && (
          <div className={`mt-3 px-3 py-2 ${getRadiusClass('field')} bg-white/50 border border-white/60`}>
            <p className="text-sm text-gray-700 leading-snug line-clamp-2">{session.summary.narrative}</p>
          </div>
        )}

        {/* Tags */}
        {session.tags && session.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <Tag className="w-3 h-3 text-gray-500 flex-shrink-0" aria-hidden="true" />
            {session.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className={`px-2 py-0.5 text-xs rounded-full bg-cyan-100 text-cyan-800 hover:bg-cyan-200 ${TRANSITIONS.colors} cursor-pointer`}
              >
                {tag}
              </span>
            ))}
            {session.tags.length > 3 && (
              <span className="text-xs text-gray-600">+{session.tags.length - 3}</span>
            )}
          </div>
        )}
      </motion.div>
    );
  }
);

SessionRelationshipCard.displayName = 'SessionRelationshipCard';
