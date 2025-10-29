/**
 * useRelationshipCard - Hook for relationship card state management
 *
 * Manages card state (hover, expanded, loading) and fetches full entity data
 * based on relationship.targetType. Provides entity data and state handlers
 * for relationship card components.
 *
 * @module hooks/useRelationshipCard
 * @since 2.0.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Relationship, EntityType } from '@/types/relationships';
import type { Task, Note, Session } from '@/types';
import { useTasks } from '@/context/TasksContext';
import { useNotes } from '@/context/NotesContext';
import { useSessionList } from '@/context/SessionListContext';
import { EntityType as EntityTypeEnum } from '@/types/relationships';

/**
 * Hook options
 */
interface UseRelationshipCardOptions {
  /** Auto-load entity on mount? (default: true) */
  autoLoad?: boolean;
  /** Initial hover state (default: false) */
  initialHover?: boolean;
  /** Initial expanded state (default: false) */
  initialExpanded?: boolean;
}

/**
 * Hook return value
 */
interface UseRelationshipCardResult<T> {
  /** Full entity data (null if loading or error) */
  entity: T | null;

  /** Is entity data loading? */
  isLoading: boolean;

  /** Error that occurred during fetch (null if no error) */
  error: Error | null;

  /** Is card currently hovered? */
  isHovered: boolean;

  /** Is card currently expanded? */
  isExpanded: boolean;

  /** Set hover state */
  setIsHovered: (hovered: boolean) => void;

  /** Set expanded state */
  setIsExpanded: (expanded: boolean) => void;

  /** Toggle expanded state */
  toggleExpanded: () => void;

  /** Manually trigger entity refetch */
  refetch: () => Promise<void>;
}

/**
 * useRelationshipCard - Manage relationship card state and fetch entity data
 *
 * **Features**:
 * - Automatic entity loading based on relationship.targetType
 * - Hover and expanded state management
 * - Loading/error state handling
 * - Manual refetch capability
 * - Type-safe entity data based on targetType
 *
 * **Usage**:
 * ```tsx
 * function TaskRelationshipCard({ relationship }: { relationship: Relationship }) {
 *   const {
 *     entity: task,
 *     isLoading,
 *     isHovered,
 *     setIsHovered,
 *     isExpanded,
 *     toggleExpanded
 *   } = useRelationshipCard<Task>(relationship);
 *
 *   if (isLoading) return <Spinner />;
 *   if (!task) return null;
 *
 *   return (
 *     <div
 *       onMouseEnter={() => setIsHovered(true)}
 *       onMouseLeave={() => setIsHovered(false)}
 *     >
 *       <h3>{task.title}</h3>
 *       {isExpanded && <TaskDetails task={task} />}
 *     </div>
 *   );
 * }
 * ```
 *
 * **With Custom Options**:
 * ```tsx
 * const { entity, isHovered } = useRelationshipCard<Note>(relationship, {
 *   autoLoad: true,
 *   initialExpanded: false
 * });
 * ```
 *
 * @param relationship - Relationship object containing targetId and targetType
 * @param options - Hook options
 * @returns Hook result with entity data and state handlers
 */
export function useRelationshipCard<T = Task | Note | Session>(
  relationship: Relationship,
  options: UseRelationshipCardOptions = {}
): UseRelationshipCardResult<T> {
  const { autoLoad = true, initialHover = false, initialExpanded = false } = options;

  // Get context hooks
  const tasksContext = useTasks();
  const notesContext = useNotes();
  const sessionsContext = useSessionList();

  // State
  const [entity, setEntity] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [error, setError] = useState<Error | null>(null);
  const [isHovered, setIsHovered] = useState(initialHover);
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  /**
   * Load entity data based on targetType
   */
  const loadEntity = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { targetType, targetId } = relationship;

      // Fetch entity based on type
      let fetchedEntity: Task | Note | Session | null = null;

      switch (targetType) {
        case EntityTypeEnum.TASK: {
          const task = tasksContext.state.tasks.find(t => t.id === targetId);
          if (!task) {
            throw new Error(`Task not found: ${targetId}`);
          }
          fetchedEntity = task;
          break;
        }

        case EntityTypeEnum.NOTE: {
          const note = notesContext.state.notes.find(n => n.id === targetId);
          if (!note) {
            throw new Error(`Note not found: ${targetId}`);
          }
          fetchedEntity = note;
          break;
        }

        case EntityTypeEnum.SESSION: {
          const session = sessionsContext.getSessionById(targetId);
          if (!session) {
            throw new Error(`Session not found: ${targetId}`);
          }
          fetchedEntity = session;
          break;
        }

        default:
          throw new Error(`Unsupported entity type: ${targetType}`);
      }

      setEntity(fetchedEntity as T);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to load entity');
      setError(errorObj);
      console.error('[useRelationshipCard] Error loading entity:', errorObj);
    } finally {
      setIsLoading(false);
    }
  }, [relationship, tasksContext, notesContext, sessionsContext]);

  /**
   * Manual refetch function
   */
  const refetch = useCallback(async () => {
    await loadEntity();
  }, [loadEntity]);

  /**
   * Toggle expanded state
   */
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Initial load
  useEffect(() => {
    if (autoLoad) {
      loadEntity();
    }
  }, [autoLoad, loadEntity]);

  // Refetch when relationship changes (targetId or targetType)
  useEffect(() => {
    if (autoLoad && entity !== null) {
      loadEntity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationship.targetId, relationship.targetType]);

  return {
    entity,
    isLoading,
    error,
    isHovered,
    isExpanded,
    setIsHovered,
    setIsExpanded,
    toggleExpanded,
    refetch,
  };
}

/**
 * Export type for external use
 */
export type { UseRelationshipCardResult, UseRelationshipCardOptions };
