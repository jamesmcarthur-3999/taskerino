/**
 * useRelationshipCardActions - Hook for relationship card action handlers
 *
 * Provides action handlers (view, edit, remove, etc.) for relationship cards.
 * Uses contexts (useTasks, useNotes, useSessionList, useUI, useRelationships)
 * to perform entity-specific actions with proper confirmation dialogs.
 *
 * @module hooks/useRelationshipCardActions
 * @since 2.0.0
 */

import { useCallback } from 'react';
import type { Relationship, EntityType } from '@/types/relationships';
import type { Task, Note, Session } from '@/types';
import { useTasks } from '@/context/TasksContext';
import { useNotes } from '@/context/NotesContext';
import { useSessionList } from '@/context/SessionListContext';
import { useUI } from '@/context/UIContext';
import { useRelationships } from '@/context/RelationshipContext';
import { EntityType as EntityTypeEnum } from '@/types/relationships';

/**
 * Hook options
 */
interface UseRelationshipCardActionsOptions {
  /** Callback when action completes successfully */
  onSuccess?: (action: string, entityId: string) => void;
  /** Callback when action fails */
  onError?: (action: string, error: Error) => void;
  /** Skip confirmation dialogs? (default: false) */
  skipConfirmation?: boolean;
}

/**
 * Task-specific action handlers
 */
interface TaskActions {
  /** Toggle task complete status */
  toggleComplete: (taskId: string) => Promise<void>;
  /** Reschedule task (open task sidebar in edit mode) */
  reschedule: (taskId: string) => void;
}

/**
 * Note-specific action handlers
 */
interface NoteActions {
  /** Add update to note (open note sidebar in edit mode) */
  addUpdate: (noteId: string) => void;
}

/**
 * Session-specific action handlers
 */
interface SessionActions {
  /** Trigger enrichment for session */
  enrich: (sessionId: string) => Promise<void>;
  /** Export session data */
  exportSession: (sessionId: string) => Promise<void>;
}

/**
 * Hook return value
 */
interface UseRelationshipCardActionsResult {
  // Common actions (all entity types)
  /** View entity (opens sidebar) */
  view: (entityId: string, entityType: EntityType) => void;

  /** Edit entity (opens sidebar in edit mode) */
  edit: (entityId: string, entityType: EntityType) => void;

  /** Remove relationship (with confirmation) */
  remove: (relationship: Relationship) => Promise<void>;

  // Task-specific actions
  task: TaskActions;

  // Note-specific actions
  note: NoteActions;

  // Session-specific actions
  session: SessionActions;
}

/**
 * useRelationshipCardActions - Provides action handlers for relationship cards
 *
 * **Features**:
 * - Common actions: view, edit, remove
 * - Task-specific: toggle complete, reschedule
 * - Note-specific: add update
 * - Session-specific: enrich, export
 * - Confirmation dialogs for destructive actions
 * - Success/error callbacks
 * - Proper context integration
 *
 * **Usage**:
 * ```tsx
 * function TaskRelationshipCard({ relationship, task }: Props) {
 *   const actions = useRelationshipCardActions({
 *     onSuccess: (action, id) => {
 *       console.log(`${action} succeeded for ${id}`);
 *     },
 *     onError: (action, error) => {
 *       console.error(`${action} failed:`, error);
 *     }
 *   });
 *
 *   return (
 *     <div>
 *       <button onClick={() => actions.view(task.id, 'task')}>View</button>
 *       <button onClick={() => actions.edit(task.id, 'task')}>Edit</button>
 *       <button onClick={() => actions.task.toggleComplete(task.id)}>
 *         Toggle Complete
 *       </button>
 *       <button onClick={() => actions.remove(relationship)}>Remove</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @param options - Hook options
 * @returns Hook result with action handlers
 */
export function useRelationshipCardActions(
  options: UseRelationshipCardActionsOptions = {}
): UseRelationshipCardActionsResult {
  const { onSuccess, onError, skipConfirmation = false } = options;

  // Get contexts
  const tasksContext = useTasks();
  const notesContext = useNotes();
  const sessionsContext = useSessionList();
  const uiContext = useUI();
  const relationshipsContext = useRelationships();

  /**
   * View entity (opens sidebar)
   */
  const view = useCallback(
    (entityId: string, entityType: EntityType) => {
      try {
        switch (entityType) {
          case EntityTypeEnum.TASK:
            uiContext.dispatch({
              type: 'OPEN_SIDEBAR',
              payload: { type: 'task', itemId: entityId, label: 'View Task' },
            });
            break;

          case EntityTypeEnum.NOTE:
            uiContext.dispatch({
              type: 'OPEN_SIDEBAR',
              payload: { type: 'note', itemId: entityId, label: 'View Note' },
            });
            break;

          case EntityTypeEnum.SESSION:
            // For sessions, navigate to sessions zone and select the session
            uiContext.dispatch({ type: 'SET_ZONE', payload: 'sessions' });
            // Session details will auto-open based on URL or state
            break;

          default:
            console.warn(`[useRelationshipCardActions] View not implemented for type: ${entityType}`);
        }

        onSuccess?.('view', entityId);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to view entity');
        onError?.('view', err);
        console.error('[useRelationshipCardActions] View failed:', err);
      }
    },
    [uiContext, onSuccess, onError]
  );

  /**
   * Edit entity (opens sidebar in edit mode)
   */
  const edit = useCallback(
    (entityId: string, entityType: EntityType) => {
      try {
        switch (entityType) {
          case EntityTypeEnum.TASK:
            uiContext.dispatch({
              type: 'OPEN_SIDEBAR',
              payload: { type: 'task', itemId: entityId, label: 'Edit Task' },
            });
            break;

          case EntityTypeEnum.NOTE:
            uiContext.dispatch({
              type: 'OPEN_SIDEBAR',
              payload: { type: 'note', itemId: entityId, label: 'Edit Note' },
            });
            break;

          case EntityTypeEnum.SESSION:
            // Sessions typically don't have edit mode - just view
            view(entityId, entityType);
            break;

          default:
            console.warn(`[useRelationshipCardActions] Edit not implemented for type: ${entityType}`);
        }

        onSuccess?.('edit', entityId);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to edit entity');
        onError?.('edit', err);
        console.error('[useRelationshipCardActions] Edit failed:', err);
      }
    },
    [uiContext, view, onSuccess, onError]
  );

  /**
   * Remove relationship (with confirmation)
   */
  const remove = useCallback(
    async (relationship: Relationship) => {
      try {
        // Confirm before removing (unless skipConfirmation is true)
        if (!skipConfirmation) {
          const confirmed = window.confirm(
            'Are you sure you want to remove this relationship? This action cannot be undone.'
          );
          if (!confirmed) {
            return;
          }
        }

        // Remove relationship via context
        await relationshipsContext.removeRelationship(relationship.id);

        onSuccess?.('remove', relationship.id);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to remove relationship');
        onError?.('remove', err);
        console.error('[useRelationshipCardActions] Remove failed:', err);
      }
    },
    [relationshipsContext, skipConfirmation, onSuccess, onError]
  );

  /**
   * Task-specific: Toggle complete status
   */
  const toggleComplete = useCallback(
    async (taskId: string) => {
      try {
        const task = tasksContext.state.tasks.find(t => t.id === taskId);
        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }

        // Dispatch toggle action (uses reducer logic from TasksContext)
        tasksContext.dispatch({ type: 'TOGGLE_TASK', payload: taskId });

        onSuccess?.('toggleComplete', taskId);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to toggle task');
        onError?.('toggleComplete', err);
        console.error('[useRelationshipCardActions] Toggle complete failed:', err);
      }
    },
    [tasksContext, onSuccess, onError]
  );

  /**
   * Task-specific: Reschedule task (opens task sidebar in edit mode)
   */
  const reschedule = useCallback(
    (taskId: string) => {
      edit(taskId, EntityTypeEnum.TASK);
    },
    [edit]
  );

  /**
   * Note-specific: Add update to note (opens note sidebar in edit mode)
   */
  const addUpdate = useCallback(
    (noteId: string) => {
      edit(noteId, EntityTypeEnum.NOTE);
    },
    [edit]
  );

  /**
   * Session-specific: Trigger enrichment
   */
  const enrich = useCallback(
    async (sessionId: string) => {
      try {
        const session = sessionsContext.getSessionById(sessionId);
        if (!session) {
          throw new Error(`Session not found: ${sessionId}`);
        }

        // Check if enrichment is already in progress
        if (session.enrichmentStatus?.status === 'in-progress') {
          throw new Error('Enrichment already in progress for this session');
        }

        // TODO: Trigger enrichment via EnrichmentContext or service
        // For now, just log - actual implementation will be in enrichment context
        console.log(`[useRelationshipCardActions] Enrichment triggered for session: ${sessionId}`);

        uiContext.dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'info',
            title: 'Enrichment Started',
            message: 'Session enrichment is in progress...',
          },
        });

        onSuccess?.('enrich', sessionId);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to enrich session');
        onError?.('enrich', err);
        console.error('[useRelationshipCardActions] Enrich failed:', err);

        uiContext.dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'error',
            title: 'Enrichment Failed',
            message: err.message,
          },
        });
      }
    },
    [sessionsContext, uiContext, onSuccess, onError]
  );

  /**
   * Session-specific: Export session data
   */
  const exportSession = useCallback(
    async (sessionId: string) => {
      try {
        const session = sessionsContext.getSessionById(sessionId);
        if (!session) {
          throw new Error(`Session not found: ${sessionId}`);
        }

        // Create JSON export
        const exportData = {
          session,
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json',
        });

        // Download file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-${session.name.replace(/\s+/g, '-')}-${sessionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        uiContext.dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'success',
            title: 'Session Exported',
            message: `Session "${session.name}" exported successfully`,
          },
        });

        onSuccess?.('exportSession', sessionId);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to export session');
        onError?.('exportSession', err);
        console.error('[useRelationshipCardActions] Export failed:', err);

        uiContext.dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'error',
            title: 'Export Failed',
            message: err.message,
          },
        });
      }
    },
    [sessionsContext, uiContext, onSuccess, onError]
  );

  // Return all action handlers
  return {
    view,
    edit,
    remove,
    task: {
      toggleComplete,
      reschedule,
    },
    note: {
      addUpdate,
    },
    session: {
      enrich,
      exportSession,
    },
  };
}

/**
 * Export type for external use
 */
export type {
  UseRelationshipCardActionsResult,
  UseRelationshipCardActionsOptions,
  TaskActions,
  NoteActions,
  SessionActions,
};
