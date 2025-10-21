/**
 * CanvasButton - Interactive Component
 *
 * Action trigger with variants, sizes, loading states, and action handling.
 */

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ButtonProps } from '../types';
import { CANVAS_COMPONENTS, getRadiusClass } from '../../../design-system/theme';
import { useActionExecution } from '../ActionExecutionContext';

export function CanvasButton({
  label,
  icon,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading: propLoading = false,
  action,
}: ButtonProps) {
  const execution = useActionExecution();
  const [isExecuting, setIsExecuting] = useState(false);
  const loading = propLoading || isExecuting;

  // Get variant styles
  const variantClasses = CANVAS_COMPONENTS.buttons[variant];

  // Map size to padding and text size
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const handleClick = async () => {
    if (disabled || loading) return;

    setIsExecuting(true);
    try {
      // Execute action based on type
      switch (action.type) {
        case 'create_task':
          if (action.createTask) {
            await execution.createTask({
              title: action.createTask.title,
              description: action.createTask.description,
              priority: action.createTask.priority,
              tags: action.createTask.tags,
              dueDate: action.createTask.dueDate,
            });
            execution.showNotification({
              type: 'success',
              title: 'Task Created',
              message: action.createTask.title,
            });
          }
          break;
        case 'update_task':
          if (action.updateTask) {
            const tasks = execution.getTasks();
            const task = tasks.find(t => t.id === action.updateTask?.taskId);
            if (task && action.updateTask) {
              await execution.updateTask({
                ...task,
                ...action.updateTask.updates,
              });
              execution.showNotification({
                type: 'success',
                title: 'Task Updated',
                message: action.updateTask.existingTitle,
              });
            }
          }
          break;
        case 'create_note':
          if (action.createNote) {
            await execution.createNote({
              title: action.createNote.title,
              content: action.createNote.content,
              tags: action.createNote.tags,
            });
            execution.showNotification({
              type: 'success',
              title: 'Note Created',
              message: action.createNote.title,
            });
          }
          break;
        case 'update_note':
          if (action.updateNote) {
            const notes = execution.getNotes();
            const note = notes.find(n => n.id === action.updateNote?.noteId);
            if (note && action.updateNote.updates.content) {
              await execution.updateNote({
                ...note,
                content: `${note.content}\n\n${action.updateNote.updates.content}`,
              });
              execution.showNotification({
                type: 'success',
                title: 'Note Updated',
                message: action.updateNote.existingTitle,
              });
            }
          }
          break;
        case 'link_to_task':
        case 'link_to_note':
        case 'batch_create':
        case 'export':
        case 'share':
        case 'expand':
        case 'custom':
          console.log(`[CanvasButton] ${action.type} action not yet implemented`, action.data);
          execution.showNotification({
            type: 'info',
            title: 'Not Implemented',
            message: `${action.type} action coming soon`,
          });
          break;
        default:
          console.warn('[CanvasButton] Unknown action type:', action.type);
      }
    } catch (error) {
      console.error('[CanvasButton] Action failed:', error);
      execution.showNotification({
        type: 'error',
        title: 'Action Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const className = [
    variantClasses,
    sizeClasses[size],
    getRadiusClass('field'),
    'inline-flex items-center justify-center gap-2',
    'font-semibold',
    'hover:scale-105 active:scale-95',
    'transition-all duration-200',
    disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button onClick={handleClick} disabled={disabled || loading} className={className}>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        icon && <span>{icon}</span>
      )}
      <span>{label}</span>
    </button>
  );
}
