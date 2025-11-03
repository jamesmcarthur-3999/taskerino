import { useState } from 'react';
import { Check, Edit2, X, Clock } from 'lucide-react';
import type { AIProcessResult } from '../../types';

export interface QuickTaskConfirmationProps {
  task: AIProcessResult['tasks'][0];
  processingTimeMs: number;
  onConfirm: (task: AIProcessResult['tasks'][0]) => void;
  onEdit: (task: AIProcessResult['tasks'][0]) => void;
  onDiscard: () => void;
}

/**
 * Inline task confirmation for single-task captures
 * Fast path that skips the full review page
 */
export function QuickTaskConfirmation({
  task,
  processingTimeMs,
  onConfirm,
  onEdit,
  onDiscard,
}: QuickTaskConfirmationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState(task);

  const handleConfirm = () => {
    onConfirm(isEditing ? editedTask : task);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedTask(task);
    setIsEditing(false);
  };

  const priorityColors = {
    urgent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
    high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
    medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
    low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  };

  const formatDueDate = (date?: string, time?: string) => {
    if (!date) return null;
    const dateObj = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dateStr = '';
    if (dateObj.toDateString() === today.toDateString()) {
      dateStr = 'Today';
    } else if (dateObj.toDateString() === tomorrow.toDateString()) {
      dateStr = 'Tomorrow';
    } else {
      dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    if (time) {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      dateStr += ` at ${displayHour}:${minutes} ${ampm}`;
    }

    return dateStr;
  };

  const dueDateFormatted = formatDueDate(task.dueDate, task.dueTime);

  return (
    <div
      className="
        mt-4 p-5 rounded-xl border-2
        bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30
        border-blue-300 dark:border-blue-700
        shadow-lg shadow-blue-500/10 dark:shadow-blue-500/5
        animate-in slide-in-from-bottom-4 fade-in duration-300
      "
      data-testid="quick-task-confirmation"
    >
      {/* Processing time badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
          <div className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400 animate-pulse" />
          <span className="font-medium">Task Created</span>
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Processed in {processingTimeMs}ms
        </span>
      </div>

      {isEditing ? (
        // Edit mode
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Task Title
            </label>
            <input
              type="text"
              value={editedTask.title}
              onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {editedTask.description && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Description
              </label>
              <textarea
                value={editedTask.description}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Priority
              </label>
              <select
                value={editedTask.priority}
                onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value as any })}
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={editedTask.dueDate || ''}
                onChange={(e) => setEditedTask({ ...editedTask, dueDate: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {editedTask.dueDate && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Due Time
              </label>
              <input
                type="time"
                value={editedTask.dueTime || ''}
                onChange={(e) => setEditedTask({ ...editedTask, dueTime: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleConfirm}
              className="
                flex-1 px-4 py-2.5 rounded-lg
                bg-blue-500 hover:bg-blue-600
                text-white font-medium text-sm
                transition-colors
                flex items-center justify-center gap-2
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              "
            >
              <Check className="w-4 h-4" />
              Save & Confirm
            </button>
            <button
              onClick={handleCancelEdit}
              className="
                px-4 py-2.5 rounded-lg
                bg-zinc-200 dark:bg-zinc-700
                hover:bg-zinc-300 dark:hover:bg-zinc-600
                text-zinc-700 dark:text-zinc-300 font-medium text-sm
                transition-colors
                flex items-center justify-center gap-2
                focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2
              "
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        // Display mode
        <>
          <div className="space-y-3 mb-5">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {task.title}
            </h3>

            <div className="flex flex-wrap gap-2 items-center">
              <span className={`px-3 py-1 text-sm rounded-lg capitalize font-medium border ${priorityColors[task.priority]}`}>
                {task.priority} priority
              </span>
              {dueDateFormatted && (
                <span className="px-3 py-1 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600">
                  {dueDateFormatted}
                </span>
              )}
            </div>

            {task.description && (
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {task.description}
              </p>
            )}

            {task.dueDateReasoning && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                {task.dueDateReasoning}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="
                flex-1 px-4 py-2.5 rounded-lg
                bg-blue-500 hover:bg-blue-600
                text-white font-medium text-sm
                transition-colors
                flex items-center justify-center gap-2
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                shadow-sm
              "
            >
              <Check className="w-4 h-4" />
              Confirm & Save
            </button>
            <button
              onClick={handleEdit}
              className="
                px-4 py-2.5 rounded-lg
                bg-white dark:bg-zinc-800
                hover:bg-zinc-50 dark:hover:bg-zinc-700
                text-zinc-700 dark:text-zinc-300 font-medium text-sm
                border border-zinc-300 dark:border-zinc-600
                transition-colors
                flex items-center justify-center gap-2
                focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2
              "
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={onDiscard}
              className="
                px-4 py-2.5 rounded-lg
                bg-white dark:bg-zinc-800
                hover:bg-red-50 dark:hover:bg-red-950/30
                text-red-600 dark:text-red-400 font-medium text-sm
                border border-zinc-300 dark:border-zinc-600
                hover:border-red-300 dark:hover:border-red-700
                transition-colors
                flex items-center justify-center gap-2
                focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
              "
            >
              <X className="w-4 h-4" />
              Discard
            </button>
          </div>
        </>
      )}
    </div>
  );
}
