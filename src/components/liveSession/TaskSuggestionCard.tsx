/**
 * TaskSuggestionCard
 *
 * Display a single task suggestion from AI with "Create Task" button.
 * Converts AI suggestion into an actual task with one click.
 *
 * @example
 * ```tsx
 * <TaskSuggestionCard
 *   suggestion={{
 *     title: "Fix authentication timeout",
 *     description: "User reported 30s timeout during login",
 *     priority: "high",
 *     context: "Detected blocker in screenshot at 14:32",
 *     tags: ["backend", "urgent"],
 *     topicId: "topic-auth-123"
 *   }}
 *   sessionId="session-123"
 *   onTaskCreated={(taskId) => console.log('Task created:', taskId)}
 *   onDismiss={(suggestionId) => console.log('Dismissed:', suggestionId)}
 * />
 * ```
 */

import React, { useState } from 'react';
import { CheckSquare, Plus, X, CheckCircle2, Loader2, Calendar } from 'lucide-react';
import { getGlassClasses, getRadiusClass, getInfoGradient } from '@/design-system/theme';
import { createTaskFromSuggestion } from '@/services/liveSession/updateApi';
import type { TaskSuggestion } from '@/services/liveSession/toolExecutor';

interface TaskSuggestionCardProps {
  suggestion: TaskSuggestion;
  sessionId: string;
  onTaskCreated?: (taskId: string) => void;
  onDismiss?: (suggestionId: string) => void;
}

export const TaskSuggestionCard: React.FC<TaskSuggestionCardProps> = ({
  suggestion,
  sessionId,
  onTaskCreated,
  onDismiss
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateTask = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const task = await createTaskFromSuggestion(suggestion, sessionId);
      setIsCreated(true);
      setCreatedTaskId(task.id);
      onTaskCreated?.(task.id);
    } catch (err) {
      console.error('[TaskSuggestionCard] Failed to create task:', err);
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDismiss = () => {
    // Generate a unique ID for the suggestion if not present
    const suggestionId = `task-suggestion-${Date.now()}`;
    onDismiss?.(suggestionId);
  };

  const priorityConfig = {
    urgent: { bg: 'bg-red-100', text: 'text-red-700', icon: 'text-red-600', badge: 'bg-red-100 text-red-700' },
    high: { bg: 'bg-orange-100', text: 'text-orange-700', icon: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
    medium: { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
    low: { bg: 'bg-gray-100', text: 'text-gray-700', icon: 'text-gray-600', badge: 'bg-gray-100 text-gray-700' }
  };

  const priority = suggestion.priority || 'medium';
  const config = priorityConfig[priority];

  return (
    <div
      className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-4 border-2 transition-all relative group ${
        isCreated ? 'border-green-400 bg-green-50/30' : 'border-gray-200 hover:border-cyan-300'
      }`}
      role="article"
      aria-label={`Task suggestion: ${suggestion.title}`}
    >
      {/* Dismiss Button */}
      {!isCreated && onDismiss && (
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 rounded"
          aria-label="Dismiss suggestion"
        >
          <X size={16} className="text-gray-400 hover:text-gray-600" />
        </button>
      )}

      {/* Task Icon & Priority Badge */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${config.bg}`}>
          <CheckSquare className={config.icon} size={20} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${config.badge}`}>
              {priority.toUpperCase()}
            </span>
          </div>
          <h4 className="font-semibold text-gray-900 mb-1">{suggestion.title}</h4>
          {suggestion.context && (
            <p className="text-sm text-gray-600">{suggestion.context}</p>
          )}
        </div>
      </div>

      {/* Due Date (if present) */}
      {suggestion.dueDate && (
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
          <Calendar size={14} />
          <span>
            Due: {new Date(suggestion.dueDate).toLocaleDateString()}
            {suggestion.dueTime && ` at ${suggestion.dueTime}`}
          </span>
        </div>
      )}

      {/* Tags (if present) */}
      {suggestion.tags && suggestion.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {suggestion.tags.map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {!isCreated ? (
          <button
            onClick={handleCreateTask}
            disabled={isCreating}
            className={`flex-1 py-2 px-4 ${getInfoGradient(
              'strong'
            ).container} text-white rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2`}
            aria-label="Create task from suggestion"
          >
            {isCreating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus size={16} />
                Create Task
              </>
            )}
          </button>
        ) : (
          <>
            <div className="flex-1 flex items-center justify-center gap-2 text-green-600 font-medium">
              <CheckCircle2 size={18} />
              Task Created
            </div>
            {createdTaskId && (
              <button
                onClick={() => {
                  // TODO: Open task sidebar with createdTaskId
                  console.log('View task:', createdTaskId);
                }}
                className={`py-2 px-4 ${getGlassClasses(
                  'medium'
                )} border border-gray-300 rounded-lg font-medium hover:border-cyan-400 transition-colors`}
                aria-label="View created task"
              >
                View Task
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
