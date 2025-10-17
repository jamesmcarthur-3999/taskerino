/**
 * Task Module Component
 *
 * A flexible task display module for the Morphing Canvas system.
 * Supports multiple variants: compact, default, expanded, and kanban.
 *
 * Features:
 * - Multiple view variants (compact, default, expanded, kanban)
 * - Interactive task completion toggle
 * - Priority badges with color coding
 * - Status indicators
 * - Responsive design (stacks on mobile)
 * - Loading, empty, and error states
 * - Smooth animations with Framer Motion
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
  MoreVertical,
  Loader2,
  Inbox,
  PlayCircle,
  CheckSquare,
  XCircle,
} from 'lucide-react';
import type {
  TaskModuleProps,
  TaskAction,
  TaskVariant,
} from '../types/module';
import type { Task } from '../../../types';
import { Card } from '../../Card';
import { Badge } from '../../Badge';
import { Button } from '../../Button';
import { getRadiusClass } from '../../../design-system/theme';

// ============================================================================
// CONSTANTS & CONFIGS
// ============================================================================

const PRIORITY_CONFIG = {
  low: {
    color: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200/60',
    label: 'Low',
    badgeVariant: 'success' as const,
  },
  medium: {
    color: 'bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-700 border border-orange-200/60',
    label: 'Medium',
    badgeVariant: 'warning' as const,
  },
  high: {
    color: 'bg-gradient-to-r from-orange-100 to-red-100 text-red-700 border border-red-200/60',
    label: 'High',
    badgeVariant: 'danger' as const,
  },
  urgent: {
    color: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200/60',
    label: 'Urgent',
    badgeVariant: 'danger' as const,
  },
};

const STATUS_CONFIG = {
  todo: {
    icon: Circle,
    label: 'To Do',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
  },
  'in-progress': {
    icon: PlayCircle,
    label: 'In Progress',
    color: 'text-blue-500',
    bgColor: 'bg-blue-100',
  },
  done: {
    icon: CheckSquare,
    label: 'Done',
    color: 'text-green-500',
    bgColor: 'bg-green-100',
  },
  blocked: {
    icon: XCircle,
    label: 'Blocked',
    color: 'text-red-500',
    bgColor: 'bg-red-100',
  },
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sort tasks based on configuration
 */
function sortTasks(
  tasks: Task[],
  sortBy: 'priority' | 'dueDate' | 'createdAt' | 'status' = 'priority'
): Task[] {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const statusOrder = { 'in-progress': 0, todo: 1, blocked: 2, done: 3 };

  return [...tasks].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      case 'dueDate':
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      case 'status':
        return statusOrder[a.status] - statusOrder[b.status];
      case 'createdAt':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      default:
        return 0;
    }
  });
}

/**
 * Format due date display
 */
function formatDueDate(dueDate?: string, dueTime?: string): string {
  if (!dueDate) return '';

  const date = new Date(dueDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  let dateStr = '';
  if (isToday) dateStr = 'Today';
  else if (isTomorrow) dateStr = 'Tomorrow';
  else {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    dateStr = date.toLocaleDateString('en-US', options);
  }

  if (dueTime) {
    dateStr += ` at ${dueTime}`;
  }

  return dateStr;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Task Checkbox Component
 */
function TaskCheckbox({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: () => void;
}) {
  const isCompleted = task.done || task.status === 'done';

  return (
    <button
      onClick={onToggle}
      className="flex-shrink-0 group relative"
      aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
    >
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5 text-green-500 group-hover:text-green-600" />
        ) : (
          <Circle className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
        )}
      </motion.div>
    </button>
  );
}

/**
 * Priority Badge Component
 */
function PriorityBadge({ priority }: { priority: Task['priority'] }) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <Badge variant={config.badgeVariant} size="sm" rounded>
      {config.label}
    </Badge>
  );
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: Task['status'] }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

/**
 * Due Date Display Component
 */
function DueDateDisplay({ dueDate, dueTime }: { dueDate?: string; dueTime?: string }) {
  if (!dueDate) return null;

  const dateStr = formatDueDate(dueDate, dueTime);
  const isPast = new Date(dueDate) < new Date();
  const isToday = new Date(dueDate).toDateString() === new Date().toDateString();

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        isPast && !isToday ? 'text-red-500' : isToday ? 'text-orange-500' : 'text-gray-500'
      }`}
    >
      <Calendar className="w-3 h-3" />
      {dateStr}
    </span>
  );
}

// ============================================================================
// VARIANT RENDERERS
// ============================================================================

/**
 * Compact Variant - Dense list with checkboxes and title only
 */
function CompactTaskItem({
  task,
  onAction,
}: {
  task: Task;
  onAction?: (action: TaskAction, task: Task) => void;
}) {
  const handleToggle = useCallback(() => {
    onAction?.('toggle-complete', task);
  }, [task, onAction]);

  return (
    <motion.div
      variants={itemVariants}
      className={`flex items-center gap-3 px-3 py-2 ${getRadiusClass('card')} hover:bg-white/40 transition-colors group`}
    >
      <TaskCheckbox task={task} onToggle={handleToggle} />
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm font-medium truncate ${
            task.done || task.status === 'done'
              ? 'line-through text-gray-400'
              : 'text-gray-700'
          }`}
        >
          {task.title}
        </span>
      </div>
      <PriorityBadge priority={task.priority} />
    </motion.div>
  );
}

/**
 * Default Variant - Card view with title, description, priority badge
 */
function DefaultTaskCard({
  task,
  onAction,
}: {
  task: Task;
  onAction?: (action: TaskAction, task: Task) => void;
}) {
  const handleToggle = useCallback(() => {
    onAction?.('toggle-complete', task);
  }, [task, onAction]);

  const handleViewDetails = useCallback(() => {
    onAction?.('view-details', task);
  }, [task, onAction]);

  return (
    <motion.div variants={itemVariants}>
      <Card
        variant="interactive"
        hover
        className="p-4 cursor-pointer group"
        onClick={handleViewDetails}
      >
        <div className="flex items-start gap-3">
          <div onClick={(e) => e.stopPropagation()}>
            <TaskCheckbox task={task} onToggle={handleToggle} />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3
                className={`text-sm font-semibold ${
                  task.done || task.status === 'done'
                    ? 'line-through text-gray-400'
                    : 'text-gray-800'
                }`}
              >
                {task.title}
              </h3>
              <PriorityBadge priority={task.priority} />
            </div>

            {task.description && (
              <p className="text-xs text-gray-600 line-clamp-2">
                {task.description}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={task.status} />
              <DueDateDisplay dueDate={task.dueDate} dueTime={task.dueTime} />
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/**
 * Expanded Variant - Full cards with all metadata
 */
function ExpandedTaskCard({
  task,
  onAction,
}: {
  task: Task;
  onAction?: (action: TaskAction, task: Task) => void;
}) {
  const handleToggle = useCallback(() => {
    onAction?.('toggle-complete', task);
  }, [task, onAction]);

  const handleViewDetails = useCallback(() => {
    onAction?.('view-details', task);
  }, [task, onAction]);

  return (
    <motion.div variants={itemVariants}>
      <Card
        variant="elevated"
        hover
        className="p-5 cursor-pointer group"
        onClick={handleViewDetails}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div onClick={(e) => e.stopPropagation()}>
              <TaskCheckbox task={task} onToggle={handleToggle} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3
                  className={`text-base font-bold ${
                    task.done || task.status === 'done'
                      ? 'line-through text-gray-400'
                      : 'text-gray-800'
                  }`}
                >
                  {task.title}
                </h3>
              </div>

              {task.description && (
                <p className="text-sm text-gray-600 mb-3">
                  {task.description}
                </p>
              )}

              {/* Metadata */}
              <div className="flex items-center gap-3 flex-wrap">
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} />
                <DueDateDisplay dueDate={task.dueDate} dueTime={task.dueTime} />
              </div>

              {/* Subtasks */}
              {task.subtasks && task.subtasks.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Subtasks ({task.subtasks.filter((st) => st.done).length}/{task.subtasks.length})
                  </p>
                  {task.subtasks.slice(0, 3).map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex items-center gap-2 text-xs text-gray-600"
                    >
                      {subtask.done ? (
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      ) : (
                        <Circle className="w-3 h-3 text-gray-400" />
                      )}
                      <span className={subtask.done ? 'line-through' : ''}>
                        {subtask.title}
                      </span>
                    </div>
                  ))}
                  {task.subtasks.length > 3 && (
                    <p className="text-xs text-gray-400 ml-5">
                      +{task.subtasks.length - 3} more
                    </p>
                  )}
                </div>
              )}

              {/* Tags */}
              {task.tags && task.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {task.tags.map((tag) => (
                    <Badge key={tag} variant="info" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/**
 * Kanban Variant - Columns by status
 */
function KanbanView({
  tasks,
  onAction,
}: {
  tasks: Task[];
  onAction?: (action: TaskAction, task: Task) => void;
}) {
  const columns = useMemo(() => {
    return {
      todo: tasks.filter((t) => t.status === 'todo'),
      'in-progress': tasks.filter((t) => t.status === 'in-progress'),
      done: tasks.filter((t) => t.status === 'done'),
      blocked: tasks.filter((t) => t.status === 'blocked'),
    };
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Object.entries(STATUS_CONFIG).map(([status, config]) => {
        const Icon = config.icon;
        const columnTasks = columns[status as Task['status']];

        return (
          <div key={status} className="flex flex-col min-h-[300px]">
            {/* Column Header */}
            <div className="mb-3 pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${config.color}`} />
                <h3 className="font-semibold text-sm text-gray-700">
                  {config.label}
                </h3>
                <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {columnTasks.length}
                </span>
              </div>
            </div>

            {/* Column Tasks */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex-1 space-y-2"
            >
              <AnimatePresence mode="popLayout">
                {columnTasks.map((task) => (
                  <DefaultTaskCard key={task.id} task={task} onAction={onAction} />
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * TaskModule - Main component for displaying tasks
 */
export function TaskModule({
  data,
  variant = 'default',
  config,
  onAction,
  isLoading = false,
  error = null,
}: TaskModuleProps) {
  // Filter tasks based on config
  const filteredTasks = useMemo(() => {
    let tasks = data.tasks;

    // Filter out completed tasks if configured
    if (config?.showCompleted === false) {
      tasks = tasks.filter((t) => !t.done && t.status !== 'done');
    }

    return tasks;
  }, [data.tasks, config?.showCompleted]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    return sortTasks(filteredTasks, config?.sortBy);
  }, [filteredTasks, config?.sortBy]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-8 h-8 text-cyan-500" />
        </motion.div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card variant="flat" className="p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="font-semibold">Error loading tasks</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  // Empty state
  if (sortedTasks.length === 0) {
    return (
      <Card variant="flat" className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <Inbox className="w-12 h-12 text-gray-300 mb-4" />
          </motion.div>
          <h3 className="text-lg font-semibold text-gray-600 mb-1">
            No tasks recorded
          </h3>
          <p className="text-sm text-gray-400">
            Tasks will appear here once created
          </p>
        </div>
      </Card>
    );
  }

  // Render based on variant
  if (variant === 'kanban') {
    return <KanbanView tasks={sortedTasks} onAction={onAction} />;
  }

  // List variants (compact, default, expanded)
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`space-y-${config?.compactSpacing ? '1' : '2'}`}
    >
      <AnimatePresence mode="popLayout">
        {sortedTasks.map((task) => {
          if (variant === 'compact') {
            return (
              <CompactTaskItem key={task.id} task={task} onAction={onAction} />
            );
          } else if (variant === 'expanded') {
            return (
              <ExpandedTaskCard key={task.id} task={task} onAction={onAction} />
            );
          } else {
            return (
              <DefaultTaskCard key={task.id} task={task} onAction={onAction} />
            );
          }
        })}
      </AnimatePresence>
    </motion.div>
  );
}

// Default export
export default TaskModule;
