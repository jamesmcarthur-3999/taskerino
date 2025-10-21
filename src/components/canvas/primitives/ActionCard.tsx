/**
 * ActionCard - Rich Action Preview Component
 *
 * Displays full action details with inline editing capabilities.
 * User can modify fields before executing create/update actions.
 */

import React, { useState } from 'react';
import { CheckCircle2, XCircle, Edit3, ChevronDown, ChevronUp, Loader2, ExternalLink } from 'lucide-react';
import type { ActionCardProps } from '../types';
import { getGlassClasses, getRadiusClass, CANVAS_COMPONENTS, TRANSITIONS } from '../../../design-system/theme';
import { useActionExecution } from '../ActionExecutionContext';

export function ActionCard({
  action,
  expanded = false,
  editable = true,
  onComplete,
  onCancel,
  theme = 'default',
}: ActionCardProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [isEditing, setIsEditing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Editable state (initialized from action data)
  const [editedData, setEditedData] = useState<any>(
    action.createTask || action.createNote || action.updateTask || action.updateNote || {}
  );

  const themeClasses = CANVAS_COMPONENTS.themes[theme];

  // Determine action type display
  const getActionTypeDisplay = () => {
    switch (action.type) {
      case 'create_task':
        return { label: 'Create Task', icon: '✓', color: 'blue' };
      case 'update_task':
        return { label: 'Update Task', icon: '♻️', color: 'purple' };
      case 'create_note':
        return { label: 'Create Note', icon: '📝', color: 'cyan' };
      case 'update_note':
        return { label: 'Update Note', icon: '♻️', color: 'purple' };
      case 'link_to_task':
        return { label: 'Link to Task', icon: '🔗', color: 'gray' };
      case 'link_to_note':
        return { label: 'Link to Note', icon: '🔗', color: 'gray' };
      default:
        return { label: action.type, icon: action.icon || '•', color: 'gray' };
    }
  };

  const typeDisplay = getActionTypeDisplay();

  // Build className
  const cardClassName = [
    getGlassClasses('medium'),
    getRadiusClass('card'),
    'border-2',
    themeClasses.border,
    'overflow-hidden',
    TRANSITIONS.standard,
    'hover:shadow-lg',
  ].join(' ');

  const renderCreateTaskForm = () => {
    const data = action.createTask!;
    const edited = editedData as typeof data;

    return (
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          {isEditing ? (
            <input
              type="text"
              value={edited.title || data.title}
              onChange={(e) => setEditedData({ ...edited, title: e.target.value })}
              className={`w-full px-3 py-2 border border-gray-300 ${getRadiusClass('field')} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          ) : (
            <div className="text-base font-semibold text-gray-900">{edited.title || data.title}</div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          {isEditing ? (
            <textarea
              value={edited.description || data.description}
              onChange={(e) => setEditedData({ ...edited, description: e.target.value })}
              rows={4}
              className={`w-full px-3 py-2 border border-gray-300 ${getRadiusClass('field')} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          ) : (
            <div className="text-sm text-gray-700 whitespace-pre-wrap">{edited.description || data.description}</div>
          )}
        </div>

        {/* Priority & Due Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            {isEditing ? (
              <select
                value={edited.priority || data.priority}
                onChange={(e) => setEditedData({ ...edited, priority: e.target.value })}
                className={`w-full px-3 py-2 border border-gray-300 ${getRadiusClass('field')} focus:ring-2 focus:ring-blue-500`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 text-xs font-semibold ${getRadiusClass('element')} ${
                    (edited.priority || data.priority) === 'urgent'
                      ? 'bg-red-100 text-red-700'
                      : (edited.priority || data.priority) === 'high'
                      ? 'bg-orange-100 text-orange-700'
                      : (edited.priority || data.priority) === 'medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {edited.priority || data.priority}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            {isEditing ? (
              <input
                type="date"
                value={edited.dueDate || data.dueDate || ''}
                onChange={(e) => setEditedData({ ...edited, dueDate: e.target.value })}
                className={`w-full px-3 py-2 border border-gray-300 ${getRadiusClass('field')} focus:ring-2 focus:ring-blue-500`}
              />
            ) : (
              <div className="text-sm text-gray-700">
                {edited.dueDate || data.dueDate || 'None'}
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {(data.tags || edited.tags) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex flex-wrap gap-2">
              {(edited.tags || data.tags || []).map((tag, i) => (
                <span
                  key={i}
                  className={`px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 ${getRadiusClass('element')}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderUpdateTaskForm = () => {
    const data = action.updateTask!;
    const edited = editedData as typeof data;

    return (
      <div className="space-y-4">
        {/* Existing Task Info */}
        <div className={`p-3 bg-gray-50 border border-gray-200 ${getRadiusClass('element')}`}>
          <div className="text-xs font-medium text-gray-500 mb-1">Updating Existing Task:</div>
          <div className="text-sm font-semibold text-gray-900">{data.existingTitle}</div>
        </div>

        {/* Reasoning */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Why Update?</label>
          <div className="text-sm text-gray-700 italic">{data.reasoning}</div>
        </div>

        {/* Status Update */}
        {data.updates.status && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            {isEditing ? (
              <select
                value={edited.updates?.status || data.updates.status}
                onChange={(e) =>
                  setEditedData({
                    ...edited,
                    updates: { ...edited.updates, status: e.target.value },
                  })
                }
                className={`w-full px-3 py-2 border border-gray-300 ${getRadiusClass('field')} focus:ring-2 focus:ring-blue-500`}
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
            ) : (
              <div className="text-sm font-medium text-gray-900">
                {edited.updates?.status || data.updates.status}
              </div>
            )}
          </div>
        )}

        {/* Additional Notes */}
        {data.updates.notes && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
            {isEditing ? (
              <textarea
                value={edited.updates?.notes || data.updates.notes}
                onChange={(e) =>
                  setEditedData({
                    ...edited,
                    updates: { ...edited.updates, notes: e.target.value },
                  })
                }
                rows={3}
                className={`w-full px-3 py-2 border border-gray-300 ${getRadiusClass('field')} focus:ring-2 focus:ring-blue-500`}
              />
            ) : (
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {edited.updates?.notes || data.updates.notes}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCreateNoteForm = () => {
    const data = action.createNote!;
    const edited = editedData as typeof data;

    return (
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          {isEditing ? (
            <input
              type="text"
              value={edited.title || data.title}
              onChange={(e) => setEditedData({ ...edited, title: e.target.value })}
              className={`w-full px-3 py-2 border border-gray-300 ${getRadiusClass('field')} focus:ring-2 focus:ring-blue-500`}
            />
          ) : (
            <div className="text-base font-semibold text-gray-900">{edited.title || data.title}</div>
          )}
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
          {isEditing ? (
            <textarea
              value={edited.content || data.content}
              onChange={(e) => setEditedData({ ...edited, content: e.target.value })}
              rows={6}
              className={`w-full px-3 py-2 border border-gray-300 ${getRadiusClass('field')} focus:ring-2 focus:ring-blue-500`}
            />
          ) : (
            <div className="text-sm text-gray-700 whitespace-pre-wrap prose prose-sm max-w-none">
              {edited.content || data.content}
            </div>
          )}
        </div>

        {/* Tags */}
        {(data.tags || edited.tags) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex flex-wrap gap-2">
              {(edited.tags || data.tags || []).map((tag, i) => (
                <span
                  key={i}
                  className={`px-2 py-1 text-xs font-medium bg-cyan-100 text-cyan-700 ${getRadiusClass('element')}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFormContent = () => {
    if (action.createTask) return renderCreateTaskForm();
    if (action.updateTask) return renderUpdateTaskForm();
    if (action.createNote) return renderCreateNoteForm();
    if (action.updateNote) {
      // Similar to updateTask
      const data = action.updateNote!;
      return (
        <div className="space-y-3">
          <div className={`p-3 bg-gray-50 border border-gray-200 ${getRadiusClass('element')}`}>
            <div className="text-xs font-medium text-gray-500 mb-1">Updating Existing Note:</div>
            <div className="text-sm font-semibold text-gray-900">{data.existingTitle}</div>
          </div>
          <div className="text-sm text-gray-700 italic">{data.reasoning}</div>
        </div>
      );
    }
    if (action.linkToTask || action.linkToNote) {
      const data = (action.linkToTask || action.linkToNote)!;
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-gray-500" />
            <div className="text-sm font-semibold text-gray-900">{data.title}</div>
          </div>
          <div className="text-sm text-gray-700 italic">{data.relevance}</div>
        </div>
      );
    }
    return <div className="text-sm text-gray-500">No additional details</div>;
  };

  const execution = useActionExecution();

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      if (action.type === 'create_task' && action.createTask) {
        const data = editedData as typeof action.createTask;
        await execution.createTask({
          title: data.title,
          description: data.description,
          priority: data.priority,
          tags: data.tags,
          topicId: data.topicId,
          dueDate: data.dueDate,
        });
        execution.showNotification({
          type: 'success',
          title: 'Task Created',
          message: data.title,
        });
      } else if (action.type === 'update_task' && action.updateTask) {
        const data = editedData as typeof action.updateTask;
        const tasks = execution.getTasks();
        const existingTask = tasks.find((t) => t.id === data.taskId);
        if (existingTask) {
          await execution.updateTask({
            ...existingTask,
            ...data.updates,
            description: data.updates.description
              ? `${existingTask.description}\n\n${data.updates.description}`
              : existingTask.description,
          });
          execution.showNotification({
            type: 'success',
            title: 'Task Updated',
            message: data.existingTitle,
          });
        }
      } else if (action.type === 'create_note' && action.createNote) {
        const data = editedData as typeof action.createNote;
        await execution.createNote({
          title: data.title,
          content: data.content,
          tags: data.tags,
          topicIds: data.topicIds,
        });
        execution.showNotification({
          type: 'success',
          title: 'Note Created',
          message: data.title,
        });
      } else if (action.type === 'update_note' && action.updateNote) {
        const data = editedData as typeof action.updateNote;
        const notes = execution.getNotes();
        const existingNote = notes.find((n) => n.id === data.noteId);
        if (existingNote) {
          await execution.updateNote({
            ...existingNote,
            content: data.updates.content
              ? `${existingNote.content}\n\n${data.updates.content}`
              : existingNote.content,
          });
          execution.showNotification({
            type: 'success',
            title: 'Note Updated',
            message: data.existingTitle,
          });
        }
      }

      onComplete?.();
    } catch (error) {
      console.error('[ActionCard] Execution failed:', error);
      execution.showNotification({
        type: 'error',
        title: 'Action Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className={cardClassName}>
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 border-b-2 ${themeClasses.border} ${themeClasses.bg} cursor-pointer`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{typeDisplay.icon}</span>
          <div>
            <div className="text-sm font-semibold text-gray-900">{typeDisplay.label}</div>
            <div className="text-xs text-gray-600">{action.label}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {action.metadata?.confidence && (
            <span className="text-xs text-gray-500">
              {Math.round(action.metadata.confidence * 100)}% confident
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* AI Reasoning */}
          {action.metadata?.reasoning && (
            <div className={`p-3 bg-blue-50 border border-blue-200 ${getRadiusClass('element')}`}>
              <div className="text-xs font-medium text-blue-700 mb-1">💡 Why this action?</div>
              <div className="text-sm text-blue-900">{action.metadata.reasoning}</div>
            </div>
          )}

          {/* Form Content */}
          {renderFormContent()}

          {/* Related Screenshots */}
          {action.metadata?.relatedScreenshotIds && action.metadata.relatedScreenshotIds.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2">
                📸 Related: {action.metadata.relatedScreenshotIds.length} screenshot(s)
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            {editable && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 ${getRadiusClass('element')} hover:bg-gray-200 ${TRANSITIONS.fast}`}
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
            )}

            {isEditing && (
              <button
                onClick={() => setIsEditing(false)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 ${getRadiusClass('element')} hover:bg-gray-50 ${TRANSITIONS.fast}`}
              >
                Cancel Edit
              </button>
            )}

            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 ${getRadiusClass('element')} hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${TRANSITIONS.fast} shadow-md hover:shadow-lg`}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {action.type.includes('create') ? 'Create' : action.type.includes('update') ? 'Update' : 'Execute'}
                </>
              )}
            </button>

            {onCancel && (
              <button
                onClick={onCancel}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 ${getRadiusClass('element')} hover:bg-red-100 ${TRANSITIONS.fast}`}
              >
                <XCircle className="w-4 h-4" />
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
