/**
 * RecentActivityCard
 *
 * Displays completed/pending AI processing jobs in the Recent Activity section.
 * Follows SessionCard design principles: compact, minimal, content-first.
 *
 * Design specifications:
 * - Padding: p-4 (16px) - efficient use of space
 * - Text: text-sm for body - readable but compact
 * - Metadata: Single row with dot separators
 * - No decorative effects - clean and professional
 * - Actions appear on hover - keeps UI clean
 */

import { motion } from 'framer-motion';
import { Sparkles, Trash2, FileText, CheckSquare, Clock } from 'lucide-react';
import type { PersistedReviewJob } from '../../types/captureProcessing';
import { getRadiusClass, TRANSITIONS } from '../../design-system/theme';

export interface RecentActivityCardProps {
  review: PersistedReviewJob;
  onReview: (review: PersistedReviewJob) => void;
  onDismiss: (jobId: string) => void;
}

/**
 * Format timestamp to relative time
 */
function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * RecentActivityCard component
 * Compact card for displaying AI processing results
 */
export function RecentActivityCard({
  review,
  onReview,
  onDismiss,
}: RecentActivityCardProps) {
  const noteCount = review.draftNoteIds?.length || 0;
  const taskCount = review.result.tasks?.length || 0;
  const refinementCount = review.result.conversationContext?.iterationCount || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`
        group relative
        bg-white/40 backdrop-blur-xl
        ${getRadiusClass('card')}
        border-2 border-white/60
        p-4
        hover:shadow-lg
        ${TRANSITIONS.standard}
        cursor-pointer
      `}
      onClick={() => onReview(review)}
    >
      {/* Header with AI icon and summary */}
      <div className="flex items-start gap-3 mb-3">
        {/* Simple icon - no pulsing or glows */}
        <div className="p-2 rounded-[12px] bg-purple-100 flex-shrink-0">
          <Sparkles className="w-4 h-4 text-purple-600" />
        </div>

        {/* Summary text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 leading-relaxed line-clamp-2">
            {review.result.aiSummary}
          </p>
        </div>
      </div>

      {/* Metadata row - SINGLE ROW with dots */}
      <div className="flex items-center gap-3 text-xs text-gray-600 mb-3">
        {noteCount > 0 && (
          <>
            <div className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              <span>{noteCount} {noteCount === 1 ? 'note' : 'notes'}</span>
            </div>
            <span className="text-gray-300">•</span>
          </>
        )}

        {taskCount > 0 && (
          <>
            <div className="flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              <span>{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
            </div>
            <span className="text-gray-300">•</span>
          </>
        )}

        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{formatTimeAgo(review.createdAt)}</span>
        </div>

        {refinementCount > 0 && (
          <>
            <span className="text-gray-300">•</span>
            <span className="text-purple-600 font-semibold">
              Refined {refinementCount}×
            </span>
          </>
        )}
      </div>

      {/* Actions - appear on hover */}
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReview(review);
          }}
          className={`
            px-4 py-2
            bg-gradient-to-r from-cyan-500 to-blue-500
            text-white
            ${getRadiusClass('field')}
            text-sm font-semibold
            hover:from-cyan-600 hover:to-blue-600
            ${TRANSITIONS.fast}
          `}
        >
          Review →
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(review.id);
          }}
          className={`
            p-2
            ${getRadiusClass('field')}
            hover:bg-red-50
            text-gray-600 hover:text-red-600
            ${TRANSITIONS.fast}
          `}
          aria-label="Dismiss"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  );
}
