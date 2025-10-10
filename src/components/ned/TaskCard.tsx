/**
 * Task Card - Enhanced
 *
 * Interactive task display in Ned's chat with rich features:
 * - Inline priority toggle
 * - Interactive subtasks with progress bar
 * - Status color-coded border
 * - Quick reschedule bar
 * - Source note preview
 * - Ask Ned button
 * - AI confidence badge
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Clock,
  Flag,
  Trash2,
  Edit2,
  MessageCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import type { Task } from '../../types';

interface TaskCardProps {
  task: Task;
  onComplete?: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onPriorityChange?: (taskId: string, priority: Task['priority']) => void;
  onSubtaskToggle?: (taskId: string, subtaskId: string) => void;
  onReschedule?: (taskId: string, date: string) => void;
  onAskNed?: (context: string) => void;
  sourceNote?: { id: string; summary: string } | null;
  relatedNotesCount?: number;
  compact?: boolean;
}

const PRIORITY_COLORS = {
  low: 'text-gray-500',
  medium: 'text-cyan-600',
  high: 'text-orange-600',
  urgent: 'text-red-600',
};

const PRIORITY_BG = {
  low: 'bg-gray-50/70',
  medium: 'bg-cyan-50/70',
  high: 'bg-orange-50/70',
  urgent: 'bg-red-50/70',
};

const STATUS_BORDER_COLORS = {
  todo: 'border-l-gray-400',
  'in-progress': 'border-l-blue-500',
  done: 'border-l-green-500',
  blocked: 'border-l-red-500',
};

const PRIORITIES: Task['priority'][] = ['low', 'medium', 'high', 'urgent'];

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onComplete,
  onEdit,
  onDelete,
  onPriorityChange,
  onSubtaskToggle,
  onReschedule,
  onAskNed,
  sourceNote,
  relatedNotesCount = 0,
  compact = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showSourceNote, setShowSourceNote] = useState(false);

  const formatDueDate = (date?: string, time?: string) => {
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
    else if (diffDays < 7) dateText = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    else dateText = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    if (time) {
      dateText += ` at ${time}`;
    }

    return dateText;
  };

  const handlePriorityToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onPriorityChange) return;

    const currentIndex = PRIORITIES.indexOf(task.priority);
    const nextIndex = (currentIndex + 1) % PRIORITIES.length;
    onPriorityChange(task.id, PRIORITIES[nextIndex]);
  };

  const handleQuickReschedule = (days: number) => {
    if (!onReschedule) return;

    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    onReschedule(task.id, newDate.toISOString().split('T')[0]);
    setShowReschedule(false);
  };

  const handleAskNed = () => {
    if (!onAskNed) return;
    onAskNed(`Tell me more about the task: "${task.title}"`);
  };

  const dueText = formatDueDate(task.dueDate, task.dueTime);
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.done;

  // Calculate subtask progress
  const subtaskProgress = task.subtasks?.length
    ? (task.subtasks.filter(st => st.done).length / task.subtasks.length) * 100
    : 0;
  const subtaskText = task.subtasks?.length
    ? `${task.subtasks.filter(st => st.done).length}/${task.subtasks.length}`
    : null;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/70 backdrop-blur-xl border-2 border-white/60 shadow-lg shadow-cyan-100/30 hover:shadow-cyan-200/40 transition-all"
      >
        <button
          onClick={() => onComplete?.(task.id)}
          className="flex-shrink-0 hover:scale-110 transition-transform"
        >
          {task.done ? (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          ) : (
            <Circle className="w-4 h-4 text-gray-400" />
          )}
        </button>
        <span className={`text-sm flex-1 ${task.done ? 'line-through text-gray-500' : 'text-gray-900'}`}>
          {task.title}
        </span>
        {task.priority !== 'low' && (
          <Flag className={`w-3 h-3 ${PRIORITY_COLORS[task.priority]}`} />
        )}
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
        task.done
          ? 'bg-white/50 backdrop-blur-xl border-white/40 shadow-lg shadow-gray-100/30 border-l-green-500'
          : `bg-white/70 backdrop-blur-xl ${PRIORITY_BG[task.priority]} border-white/60 shadow-lg shadow-cyan-100/30 hover:shadow-xl hover:shadow-cyan-200/40 ${STATUS_BORDER_COLORS[task.status]}`
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <button
          onClick={() => onComplete?.(task.id)}
          className="flex-shrink-0 mt-0.5 hover:scale-110 transition-transform"
        >
          {task.done ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title with AI Badge */}
          <div className="flex items-start gap-2">
            <h3 className={`font-medium flex-1 ${
              task.done
                ? 'line-through text-gray-500'
                : 'text-gray-900'
            }`}>
              {task.title}
            </h3>
            {task.createdBy === 'ai' && task.aiContext && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100/70 text-purple-700 text-xs"
                title={`AI created (${Math.round(task.aiContext.confidence * 100)}% confidence)`}
              >
                <Sparkles className="w-3 h-3" />
                <span>{Math.round(task.aiContext.confidence * 100)}%</span>
              </div>
            )}
          </div>

          {task.description && (
            <p className="text-sm text-gray-600 mt-1">
              {task.description}
            </p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {/* Priority Toggle */}
            <button
              onClick={handlePriorityToggle}
              className={`flex items-center gap-1 text-xs font-medium ${PRIORITY_COLORS[task.priority]} hover:scale-105 transition-transform`}
              title="Click to change priority"
            >
              <Flag className="w-3 h-3" />
              <span className="capitalize">{task.priority}</span>
            </button>

            {/* Due Date with Quick Reschedule */}
            {dueText && (
              <div className="relative">
                <button
                  onClick={() => setShowReschedule(!showReschedule)}
                  className={`flex items-center gap-1 text-xs ${
                    isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'
                  } hover:text-cyan-600 transition-colors`}
                >
                  <Clock className="w-3 h-3" />
                  <span>{dueText}</span>
                </button>

                {/* Quick Reschedule Bar */}
                <AnimatePresence>
                  {showReschedule && onReschedule && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute top-full mt-1 left-0 z-10 flex gap-1 p-1 bg-white/90 backdrop-blur-xl rounded-lg border-2 border-white/60 shadow-xl"
                    >
                      <button
                        onClick={() => handleQuickReschedule(0)}
                        className="px-2 py-1 text-xs rounded hover:bg-cyan-100/70 transition-colors"
                      >
                        Today
                      </button>
                      <button
                        onClick={() => handleQuickReschedule(1)}
                        className="px-2 py-1 text-xs rounded hover:bg-cyan-100/70 transition-colors"
                      >
                        Tomorrow
                      </button>
                      <button
                        onClick={() => handleQuickReschedule(7)}
                        className="px-2 py-1 text-xs rounded hover:bg-cyan-100/70 transition-colors"
                      >
                        Next Week
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Subtask Progress */}
            {subtaskText && (
              <button
                onClick={() => setShowSubtasks(!showSubtasks)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-cyan-600 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${subtaskProgress}%` }}
                      className="h-full bg-cyan-500 rounded-full"
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span>{subtaskText}</span>
                </div>
                {showSubtasks ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs rounded-full bg-cyan-100/70 text-cyan-700"
                  >
                    {tag}
                  </span>
                ))}
                {task.tags.length > 3 && (
                  <span className="text-xs text-gray-600">
                    +{task.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Interactive Subtasks */}
          <AnimatePresence>
            {showSubtasks && task.subtasks && task.subtasks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-1.5"
              >
                {task.subtasks.map((subtask) => (
                  <button
                    key={subtask.id}
                    onClick={() => onSubtaskToggle?.(task.id, subtask.id)}
                    className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 w-full text-left transition-colors group"
                  >
                    {subtask.done ? (
                      <CheckCircle2 className="w-3 h-3 text-green-600 group-hover:scale-110 transition-transform" />
                    ) : (
                      <Circle className="w-3 h-3 group-hover:scale-110 transition-transform" />
                    )}
                    <span className={subtask.done ? 'line-through' : ''}>
                      {subtask.title}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Source Note Preview */}
          {sourceNote && (
            <div className="mt-3">
              <button
                onClick={() => setShowSourceNote(!showSourceNote)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-cyan-600 transition-colors"
              >
                <FileText className="w-3 h-3" />
                <span>From note</span>
                {showSourceNote ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
              <AnimatePresence>
                {showSourceNote && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-1.5 p-2 rounded-lg bg-white/50 border border-white/60"
                  >
                    <p className="text-xs text-gray-700">{sourceNote.summary}</p>
                    {task.sourceExcerpt && (
                      <p className="text-xs text-gray-600 mt-1 italic">
                        "{task.sourceExcerpt}"
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Related Notes Count */}
          {relatedNotesCount > 0 && (
            <div className="mt-2">
              <button className="flex items-center gap-1 text-xs text-gray-600 hover:text-cyan-600 transition-colors">
                <FileText className="w-3 h-3" />
                <span>{relatedNotesCount} related note{relatedNotesCount > 1 ? 's' : ''}</span>
              </button>
            </div>
          )}
        </div>

        {/* Actions - Enhanced on Hover */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <AnimatePresence>
            {(isHovered || showReschedule || showSubtasks) && (
              <>
                {onAskNed && (
                  <motion.button
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    onClick={handleAskNed}
                    className="p-1.5 rounded-lg hover:bg-purple-100/70 transition-all hover:shadow-md"
                    title="Ask Ned about this task"
                  >
                    <MessageCircle className="w-4 h-4 text-purple-600" />
                  </motion.button>
                )}
                {onEdit && (
                  <motion.button
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ delay: 0.05 }}
                    onClick={() => onEdit(task.id)}
                    className="p-1.5 rounded-lg hover:bg-white/80 transition-all hover:shadow-md"
                    title="Edit task"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </motion.button>
                )}
                {onDelete && (
                  <motion.button
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ delay: 0.1 }}
                    onClick={() => onDelete(task.id)}
                    className="p-1.5 rounded-lg hover:bg-red-100/70 transition-all hover:shadow-md"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </motion.button>
                )}
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
