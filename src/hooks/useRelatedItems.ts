/**
 * useRelatedItems - Hook for fetching related entities
 *
 * Automatically loads and tracks related entities for a given entity ID.
 * Re-fetches when relationships change or when dependencies change.
 *
 * @module hooks/useRelatedItems
 * @since 2.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import type { RelationshipType } from '@/types/relationships';
import { useRelationships } from '@/context/RelationshipContext';
import type { EntityWithRelationships } from '@/services/relationshipManager';

/**
 * Hook options
 */
interface UseRelatedItemsOptions {
  /** Auto-load on mount? (default: true) */
  autoLoad?: boolean;
  /** Refetch interval in ms (0 = no refetch) */
  refetchInterval?: number;
}

/**
 * Hook return value
 */
interface UseRelatedItemsResult<T> {
  /** Related entity items */
  items: T[];
  /** Is initial load in progress? */
  isLoading: boolean;
  /** Is refetch in progress? */
  isRefetching: boolean;
  /** Error that occurred during fetch (null if no error) */
  error: Error | null;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
}

/**
 * useRelatedItems - Fetch and track related entities for an entity
 *
 * **Features**:
 * - Automatic loading on mount
 * - Re-fetches when relationships change
 * - Manual refetch via `refetch()` function
 * - Optional periodic refetch
 * - Loading/error state management
 *
 * **Usage**:
 * ```tsx
 * function TaskDetails({ taskId }: { taskId: string }) {
 *   const { items: relatedNotes, isLoading } = useRelatedItems<Note>(
 *     taskId,
 *     'task-note'
 *   );
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h3>Related Notes</h3>
 *       {relatedNotes.map(note => (
 *         <NoteCard key={note.id} note={note} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * **Auto-refetch Example**:
 * ```tsx
 * // Refetch every 30 seconds
 * const { items, refetch } = useRelatedItems<Note>(
 *   taskId,
 *   'task-note',
 *   { refetchInterval: 30000 }
 * );
 * ```
 *
 * **Manual Refetch Example**:
 * ```tsx
 * const { items, refetch, isRefetching } = useRelatedItems<Note>(taskId);
 *
 * const handleRefresh = async () => {
 *   await refetch();
 *   console.log('Refreshed!');
 * };
 * ```
 *
 * @param entityId - ID of entity to get related items for
 * @param relationshipType - Optional relationship type filter
 * @param options - Hook options
 * @returns Hook result with items, loading state, and refetch function
 */
export function useRelatedItems<T extends EntityWithRelationships = EntityWithRelationships>(
  entityId: string,
  relationshipType?: RelationshipType,
  options: UseRelatedItemsOptions = {}
): UseRelatedItemsResult<T> {
  const { autoLoad = true, refetchInterval = 0 } = options;

  // Get relationship context
  const { getRelatedEntities, getRelationships } = useRelationships();

  // State
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load related entities
   */
  const loadItems = useCallback(
    async (isInitialLoad = false) => {
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsRefetching(true);
      }
      setError(null);

      try {
        const entities = await getRelatedEntities<T>(entityId, relationshipType);
        setItems(entities);
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to load related items');
        setError(errorObj);
        console.error('[useRelatedItems] Error loading items:', errorObj);
      } finally {
        if (isInitialLoad) {
          setIsLoading(false);
        } else {
          setIsRefetching(false);
        }
      }
    },
    [entityId, relationshipType, getRelatedEntities]
  );

  /**
   * Manual refetch function
   */
  const refetch = useCallback(async () => {
    await loadItems(false);
  }, [loadItems]);

  // Initial load
  useEffect(() => {
    if (autoLoad) {
      loadItems(true);
    }
  }, [autoLoad, loadItems]);

  // Auto-refetch on relationship changes
  // We track relationships for this entity to detect changes
  const relationships = getRelationships(entityId, relationshipType);
  useEffect(() => {
    // Don't refetch on initial load (handled by autoLoad logic)
    if (!autoLoad && items.length === 0) return;

    // Refetch when relationships change (but not on initial load)
    if (items.length > 0 || !autoLoad) {
      loadItems(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationships.length]); // Only trigger when relationship count changes

  // Periodic refetch
  useEffect(() => {
    if (refetchInterval > 0) {
      const intervalId = setInterval(() => {
        loadItems(false);
      }, refetchInterval);

      return () => clearInterval(intervalId);
    }
  }, [refetchInterval, loadItems]);

  return {
    items,
    isLoading,
    isRefetching,
    error,
    refetch,
  };
}

/**
 * Export type for external use
 */
export type { UseRelatedItemsResult, UseRelatedItemsOptions };
