import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, FileText, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { PersistedReviewJob } from '../../types/captureProcessing';
import {
  loadPendingReviews,
  deletePendingReview,
} from '../../services/captureReviewStorage';
import {
  getGlassClasses,
  getRadiusClass,
  TYPOGRAPHY,
  TEXT_COLORS,
  SHADOWS,
  TRANSITIONS,
} from '../../design-system/theme';

export interface PendingReviewsProps {
  onResumeReview: (review: PersistedReviewJob) => void;
  onReviewsChanged?: () => void; // Callback when reviews are deleted/changed
}

/**
 * Component for displaying and managing pending capture reviews
 * Shows list of reviews that haven't been completed, with resume/dismiss options
 */
export function PendingReviews({ onResumeReview, onReviewsChanged }: PendingReviewsProps) {
  const [reviews, setReviews] = useState<PersistedReviewJob[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      const loaded = await loadPendingReviews();
      // Only show pending_review and in_review statuses
      const activeReviews = loaded.filter(
        (r) => r.status === 'pending_review' || r.status === 'in_review'
      );
      setReviews(activeReviews);
    } catch (error) {
      console.error('Failed to load pending reviews:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = async (jobId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering resume

    try {
      await deletePendingReview(jobId);
      setReviews((prev) => prev.filter((r) => r.id !== jobId));
      onReviewsChanged?.();
    } catch (error) {
      console.error('Failed to dismiss review:', error);
    }
  };

  const handleResumeReview = (review: PersistedReviewJob) => {
    onResumeReview(review);
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  if (isLoading) {
    return (
      <div
        className={`${getGlassClasses('medium')} ${getRadiusClass('card')} border-2 border-white/60 ${SHADOWS.card} p-4`}
      >
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-500 border-t-transparent" />
          <span className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.secondary}`}>
            Loading reviews...
          </span>
        </div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return null; // Don't show anything if no pending reviews
  }

  return (
    <div
      className={`${getGlassClasses('medium')} ${getRadiusClass('card')} border-2 border-white/60 ${SHADOWS.card} overflow-hidden`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-4 hover:bg-white/10 ${TRANSITIONS.standard}`}
      >
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-cyan-600" />
          <div className="text-left">
            <h3 className={`${TYPOGRAPHY.heading.h3} ${TEXT_COLORS.primary}`}>
              Pending Reviews
            </h3>
            <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.secondary}`}>
              {reviews.length} capture{reviews.length !== 1 ? 's' : ''} waiting for review
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={20} className={TEXT_COLORS.secondary} />
        </motion.div>
      </button>

      {/* Review List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t-2 border-white/30">
              {reviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 border-b border-white/20 last:border-b-0 hover:bg-white/5 ${TRANSITIONS.standard} cursor-pointer`}
                  onClick={() => handleResumeReview(review)}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* AI Summary */}
                      <p className={`${TYPOGRAPHY.body.default} ${TEXT_COLORS.primary} mb-2`}>
                        {review.result.aiSummary}
                      </p>

                      {/* Metadata */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className={`flex items-center gap-1 ${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary}`}
                        >
                          <Clock size={12} />
                          {formatTimeAgo(review.createdAt)}
                        </span>
                        <span className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary}`}>
                          {review.draftNoteIds.length} note{review.draftNoteIds.length !== 1 ? 's' : ''}
                        </span>
                        {review.result.tasks && review.result.tasks.length > 0 && (
                          <span className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary}`}>
                            {review.result.tasks.length} task{review.result.tasks.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dismiss Button */}
                    <button
                      onClick={(e) => handleDismiss(review.id, e)}
                      className={`flex-shrink-0 p-2 ${getRadiusClass('element')} hover:bg-red-500/20 ${TRANSITIONS.standard} group`}
                      title="Dismiss review"
                    >
                      <Trash2
                        size={16}
                        className="text-gray-400 group-hover:text-red-600 transition-colors"
                      />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
