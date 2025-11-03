/**
 * TaskRelationshipCard Component
 *
 * Rich card display for related tasks with:
 * - Priority and status indicators
 * - Completion checkbox
 * - Due date with overdue highlighting
 * - Subtask progress bar
 * - Hover actions (view, edit, remove)
 * - AI confidence badge
 * - Support for 3 variants: compact, default, expanded
 *
 * @module components/relationships/TaskRelationshipCard
 * @since 2.0.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Clock,
  Flag,
  Trash2,
  Edit2,
  ExternalLink,
  Sparkles,
  FileText,
} from 'lucide-react';
import type { Task } from '@/types';
import type { Relationship } from '@/types/relationships';
import {
  getRadiusClass,
  TRANSITIONS,
  getStatusBadgeClasses,
} from '@/design-system/theme';
import { useRelationshipActions } from '@/hooks/useRelationshipActions';

/**
 * Props for TaskRelationshipCard
 */
export interface TaskRelationshipCardProps {
  /** The relationship being displayed */
  relationship: Relationship;

  /** The task entity */
  task: Task;

  /** Display variant */
  variant?: 'compact' | 'default' | 'expanded';

  /** Callback when view button is clicked */
  onView?: (taskId: string) => void;

  /** Callback when toggle complete is clicked */
  onToggleComplete?: (taskId: string) => void;

  /** Callback when edit button is clicked */
  onEdit?: (taskId: string) => void;

  /** Callback when remove relationship is clicked */
  onRemove?: () => void;

  /** Show action buttons on hover */
  showActions?: boolean;

  /** Show task description excerpt */
  showExcerpt?: boolean;

  /** Show related notes count */
  showRelatedCounts?: boolean;
}

/**
 * Status border colors (left border accent)
 */
const STATUS_BORDER_COLORS = {
  todo: 'border-l-gray-400',
  'in-progress': 'border-l-cyan-500',
  done: 'border-l-green-500',
  blocked: 'border-l-red-500',
};

/**
 * Priority background colors
 */
const PRIORITY_BG = {
  low: 'bg-gray-50/50',
  medium: 'bg-cyan-50/50',
  high: 'bg-orange-50/50',
  urgent: 'bg-red-50/50',
};

/**
 * Priority text colors
 */
const PRIORITY_COLORS = {
  low: { text: 'text-gray-600' },
  medium: { text: 'text-cyan-700' },
  high: { text: 'text-orange-700' },
  urgent: { text: 'text-red-700' },
};

/**
 * Card animation variants
 */
const cardVariants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
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

/**
 * Format due date with time
 */
function formatDueDate(date?: string, time?: string): string | null {
  if (!date) return null;

  const dateObj = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(dateObj);
  taskDate.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let dateText = '';
  if (diffDays === 0) dateText = 'Today';
  else if (diffDays === 1) dateText = 'Tomorrow';
  else if (diffDays === -1) dateText = 'Yesterday';
  else if (diffDays < -1) dateText = `${Math.abs(diffDays)} days ago`;
  else if (diffDays < 7)
    dateText = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  else dateText = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (time) {
    dateText += ` at ${time}`;
  }

  return dateText;
}

/**
 * TaskRelationshipCard - Rich card for displaying task relationships
 *
 * @example
 * ```tsx
 * <TaskRelationshipCard
 *   relationship={relationship}
 *   task={task}
 *   variant="default"
 *   onView={handleView}
 *   onToggleComplete={handleToggle}
 *   onEdit={handleEdit}
 *   onRemove={handleRemove}
 *   showActions={true}
 *   showExcerpt={true}
 * />
 * ```
 */
export const TaskRelationshipCard = React.memo<TaskRelationshipCardProps>(
  ({
    // relationship prop is kept for API consistency but not currently used in rendering
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    relationship,
    task,
    variant = 'default',
    onView,
    onToggleComplete,
    onEdit,
    onRemove,
    showActions = true,
    showExcerpt = false,
    showRelatedCounts = false,
  }) => {
    // Hover state
    const [isHovered, setIsHovered] = useState(false);

    // Get relationship actions
    const { getLinks } = useRelationshipActions(task.id, 'task');

    // Calculate subtask progress
    const subtaskProgress = useMemo(() => {
      if (!task.subtasks || task.subtasks.length === 0) return 0;
      return (task.subtasks.filter(st => st.done).length / task.subtasks.length) * 100;
    }, [task.subtasks]);

    // Format due date
    const dueText = formatDueDate(task.dueDate, task.dueTime);

    // Check if overdue
    const isOverdue = useMemo(() => {
      return task.dueDate && new Date(task.dueDate) < new Date() && !task.done;
    }, [task.dueDate, task.done]);

    // Count related notes (if needed)
    const relatedNotesCount = useMemo(() => {
      if (!showRelatedCounts) return 0;
      const links = getLinks('task-note');
      return links.length;
    }, [showRelatedCounts, getLinks]);

    // Compact variant
    if (variant === 'compact') {
      return (
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={`flex items-center gap-2 px-3 py-2 ${getRadiusClass('field')} bg-white/50 backdrop-blur-xl border border-white/60 hover:shadow-md ${TRANSITIONS.standard}`}
          role="article"
          aria-labelledby={`task-title-${task.id}`}
        >
          {/* Checkbox */}
          <button
            onClick={() => onToggleComplete?.(task.id)}
            className="flex-shrink-0 hover:scale-110 transition-transform"
            aria-label={task.done ? 'Mark as incomplete' : 'Mark as complete'}
            aria-pressed={task.done}
            role="checkbox"
            tabIndex={0}
          >
            {task.done ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" aria-hidden="true" />
            ) : (
              <Circle className="w-4 h-4 text-gray-400" aria-hidden="true" />
            )}
          </button>

          {/* Title */}
          <span
            id={`task-title-${task.id}`}
            className={`text-sm flex-1 min-w-0 truncate ${
              task.done ? 'line-through text-gray-500' : 'text-gray-900'
            }`}
          >
            {task.title}
          </span>

          {/* Priority indicator */}
          {task.priority !== 'low' && (
            <Flag
              className={`w-3 h-3 flex-shrink-0 ${PRIORITY_COLORS[task.priority].text}`}
              aria-hidden="true"
            />
          )}
        </motion.div>
      );
    }

    // Default and expanded variants
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
          ${STATUS_BORDER_COLORS[task.status]}
          ${PRIORITY_BG[task.priority]}
          shadow-lg hover:shadow-xl hover:shadow-cyan-200/40
          ${TRANSITIONS.standard}
          hover:scale-[1.02]
          p-4
        `}
        role="article"
        aria-labelledby={`task-title-${task.id}`}
        aria-describedby={`task-meta-${task.id}`}
      >
        {/* Header Row: Checkbox + Title + AI Badge */}
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={() => onToggleComplete?.(task.id)}
            className="flex-shrink-0 mt-0.5 hover:scale-110 transition-transform"
            aria-label={task.done ? 'Mark as incomplete' : 'Mark as complete'}
            aria-pressed={task.done}
            role="checkbox"
            tabIndex={0}
          >
            {task.done ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" aria-hidden="true" />
            ) : (
              <Circle className="w-5 h-5 text-gray-400" aria-hidden="true" />
            )}
          </button>

          {/* Title + AI Badge */}
          <div className="flex-1 min-w-0">
            <h3
              id={`task-title-${task.id}`}
              className={`text-base font-semibold leading-normal ${
                task.done ? 'line-through text-gray-500' : 'text-gray-900'
              }`}
            >
              {task.title}
            </h3>

            {/* AI Confidence Badge */}
            {task.createdBy === 'ai' && task.aiContext && (
              <div
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs mt-1"
                title={`AI created (${Math.round(task.aiContext.confidence * 100)}% confidence)`}
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                <span>{Math.round(task.aiContext.confidence * 100)}%</span>
              </div>
            )}
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
                      onClick={() => onView(task.id)}
                      className={`p-1.5 ${getRadiusClass('field')} bg-white/90 hover:bg-white ${TRANSITIONS.standard} hover:shadow-md shadow-sm`}
                      aria-label="View task"
                      aria-describedby={`task-title-${task.id}`}
                    >
                      <ExternalLink className="w-4 h-4 text-gray-600" aria-hidden="true" />
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => onEdit(task.id)}
                      className={`p-1.5 ${getRadiusClass('field')} bg-white/90 hover:bg-white ${TRANSITIONS.standard} hover:shadow-md shadow-sm`}
                      aria-label="Edit task"
                      aria-describedby={`task-title-${task.id}`}
                    >
                      <Edit2 className="w-4 h-4 text-gray-600" aria-hidden="true" />
                    </button>
                  )}
                  {onRemove && (
                    <button
                      onClick={onRemove}
                      className={`p-1.5 ${getRadiusClass('field')} bg-white/90 hover:bg-red-100 ${TRANSITIONS.standard} hover:shadow-md shadow-sm`}
                      aria-label="Remove relationship"
                      aria-describedby={`task-title-${task.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" aria-hidden="true" />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Metadata Row: Priority + Due Date + Status */}
        <div id={`task-meta-${task.id}`} className="flex flex-wrap items-center gap-3 mt-3">
          {/* Priority Badge */}
          <div
            className={`flex items-center gap-1 text-xs font-medium ${PRIORITY_COLORS[task.priority].text}`}
          >
            <span className="sr-only">Priority: {task.priority}</span>
            <Flag className="w-3 h-3" aria-hidden="true" />
            <span className="capitalize">{task.priority}</span>
          </div>

          {/* Due Date */}
          {dueText && (
            <div
              className={`flex items-center gap-1 text-xs ${
                isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'
              }`}
            >
              <Clock className="w-3 h-3" aria-hidden="true" />
              <span>{dueText}</span>
            </div>
          )}

          {/* Status Badge */}
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClasses(task.status)}`}
          >
            {task.status}
          </span>
        </div>

        {/* Progress Bar (if subtasks exist) */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <span>
                {task.subtasks.filter(st => st.done).length}/{task.subtasks.length} subtasks
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${subtaskProgress}%` }}
                className="h-full bg-cyan-500 rounded-full"
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* Excerpt (if showExcerpt) */}
        {showExcerpt && task.description && (
          <div className="mt-3 px-3 py-2 rounded-[12px] bg-white/50 border border-white/60">
            <p className="text-sm text-gray-700 leading-snug line-clamp-2">
              {task.description}
            </p>
          </div>
        )}

        {/* Related Counts (if showRelatedCounts) */}
        {showRelatedCounts && relatedNotesCount > 0 && (
          <div className="mt-3 flex items-center gap-1 text-xs text-gray-600">
            <FileText className="w-3 h-3" aria-hidden="true" />
            <span>
              {relatedNotesCount} related note{relatedNotesCount > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Expanded variant: Show subtasks list */}
        {variant === 'expanded' && task.subtasks && task.subtasks.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {task.subtasks.map((subtask, idx) => (
              <div
                key={subtask.id || idx}
                className="flex items-center gap-2 text-xs text-gray-600"
              >
                {subtask.done ? (
                  <CheckCircle2
                    className="w-3 h-3 text-green-600 flex-shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                )}
                <span className={subtask.done ? 'line-through' : ''}>{subtask.title}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    );
  }
);

TaskRelationshipCard.displayName = 'TaskRelationshipCard';
