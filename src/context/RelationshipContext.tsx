/**
 * RelationshipContext - React context for relationship state management
 *
 * Wraps the RelationshipManager service with React-friendly hooks and provides:
 * - Optimistic updates for immediate UI feedback
 * - Error handling with automatic rollback
 * - Event-driven updates (cross-window sync via eventBus)
 * - Loading/error state management
 * - Performance optimizations (proper memoization)
 *
 * @module context/RelationshipContext
 * @since 2.0.0
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import type {
  Relationship,
  RelationshipType,
  EntityType,
  RelationshipMetadata,
} from '@/types/relationships';
import { relationshipManager } from '@/services/relationshipManager';
import type {
  AddRelationshipParams,
  RemoveRelationshipParams,
  GetRelationshipsParams,
  EntityWithRelationships,
} from '@/services/relationshipManager';
import { eventBus } from '@/services/eventBus';

/**
 * Context value interface
 */
interface RelationshipContextValue {
  // Core operations
  /**
   * Add a new relationship with optimistic update
   * @param params - Relationship parameters
   * @returns Promise resolving to the created relationship
   */
  addRelationship: (params: AddRelationshipParams) => Promise<Relationship>;

  /**
   * Remove a relationship with optimistic update
   * @param relationshipId - ID of relationship to remove
   */
  removeRelationship: (relationshipId: string) => Promise<void>;

  /**
   * Get relationships for an entity (includes optimistic relationships)
   * @param entityId - Entity ID
   * @param type - Optional relationship type filter
   * @returns Array of relationships
   */
  getRelationships: (entityId: string, type?: RelationshipType) => Relationship[];

  /**
   * Get related entities for an entity
   * @param entityId - Entity ID
   * @param type - Optional relationship type filter
   * @returns Promise resolving to array of related entities
   */
  getRelatedEntities: <T extends EntityWithRelationships>(entityId: string, type?: RelationshipType) => Promise<T[]>;

  // Loading/error state
  /** Is a relationship operation in progress? */
  isLoading: boolean;

  /** Last error that occurred (null if no error) */
  error: Error | null;

  /** Clear the current error */
  clearError: () => void;

  // Optimistic updates
  /** Map of optimistic relationships (pending confirmation) */
  optimisticRelationships: Map<string, Relationship>;

  // Stats
  /** Relationship statistics */
  stats: {
    totalRelationships: number;
    aiRelationships: number;
    manualRelationships: number;
  };
}

/**
 * Internal optimistic relationship state
 */
interface OptimisticRelationship extends Relationship {
  /** Is this relationship being removed? */
  _removing?: boolean;
}

// Create context
const RelationshipContext = createContext<RelationshipContextValue | undefined>(undefined);

/**
 * RelationshipProvider - Provides relationship state management to child components
 *
 * **Features**:
 * - Optimistic updates for immediate UI feedback
 * - Automatic rollback on error
 * - Event-driven updates (cross-window sync)
 * - Proper cleanup (no memory leaks)
 *
 * **Usage**:
 * ```tsx
 * <RelationshipProvider>
 *   <YourApp />
 * </RelationshipProvider>
 * ```
 *
 * @param props - Provider props
 */
export function RelationshipProvider({ children }: { children: ReactNode }) {
  // Initialize relationship manager once
  const initializedRef = useRef(false);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [optimisticRelationships, setOptimisticRelationships] = useState<
    Map<string, OptimisticRelationship>
  >(new Map());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Initialize relationship manager
  useEffect(() => {
    if (initializedRef.current) return;

    async function init() {
      console.log('[RelationshipContext] Starting initialization...');
      setIsLoading(true);
      try {
        await relationshipManager.init();
        initializedRef.current = true;
        console.log('[RelationshipContext] Initialization complete');
      } catch (err) {
        console.error('[RelationshipContext] Failed to initialize manager:', err);
        setError(
          err instanceof Error ? err : new Error('Failed to initialize relationship manager')
        );
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  // Listen for relationship events from eventBus
  useEffect(() => {
    const handleAdded = () => {
      setRefreshTrigger(prev => prev + 1);
    };

    const handleRemoved = () => {
      setRefreshTrigger(prev => prev + 1);
    };

    const handleUpdated = () => {
      setRefreshTrigger(prev => prev + 1);
    };

    // Subscribe to events
    const addedId = eventBus.on('RELATIONSHIP_ADDED', handleAdded);
    const removedId = eventBus.on('RELATIONSHIP_REMOVED', handleRemoved);
    const updatedId = eventBus.on('RELATIONSHIP_UPDATED', handleUpdated);

    // Cleanup on unmount
    return () => {
      eventBus.off(addedId);
      eventBus.off(removedId);
      eventBus.off(updatedId);
    };
  }, []);

  /**
   * Add a relationship with optimistic update
   */
  const addRelationship = useCallback(async (params: AddRelationshipParams) => {
    // Guard: Don't proceed if not initialized
    if (!initializedRef.current) {
      throw new Error('RelationshipManager not initialized yet');
    }

    const optimisticId = `optimistic-${Date.now()}-${Math.random()}`;

    // Create optimistic relationship
    const optimisticRel: OptimisticRelationship = {
      id: optimisticId,
      type: params.type,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: {
        source: params.metadata?.source || 'manual',
        createdAt: params.metadata?.createdAt || new Date().toISOString(),
        ...params.metadata,
      } as RelationshipMetadata,
      canonical: true,
    };

    // Add to optimistic map (immediate UI update)
    setOptimisticRelationships(prev => {
      const newMap = new Map(prev);
      newMap.set(optimisticId, optimisticRel);
      return newMap;
    });

    try {
      setIsLoading(true);
      setError(null);

      // Perform actual operation
      const relationship = await relationshipManager.addRelationship(params);

      // Remove optimistic relationship (real one appears via event)
      setOptimisticRelationships(prev => {
        const newMap = new Map(prev);
        newMap.delete(optimisticId);
        return newMap;
      });

      return relationship;
    } catch (err) {
      // Rollback optimistic update on error
      setOptimisticRelationships(prev => {
        const newMap = new Map(prev);
        newMap.delete(optimisticId);
        return newMap;
      });

      const errorObj = err instanceof Error ? err : new Error('Failed to add relationship');
      setError(errorObj);
      throw errorObj;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Remove a relationship with optimistic update
   */
  const removeRelationship = useCallback(async (relationshipId: string) => {
    // Guard: Don't proceed if not initialized
    if (!initializedRef.current) {
      throw new Error('RelationshipManager not initialized yet');
    }

    // Get current relationship (if it exists)
    const existingRel = relationshipManager.getRelationships({ entityId: '' }).find(
      r => r.id === relationshipId
    );

    // Mark as being removed (optimistic)
    if (existingRel) {
      setOptimisticRelationships(prev => {
        const newMap = new Map(prev);
        newMap.set(relationshipId, { ...existingRel, _removing: true });
        return newMap;
      });
    }

    try {
      setIsLoading(true);
      setError(null);

      await relationshipManager.removeRelationship({ relationshipId });

      // Clear optimistic state (actual removal happens via event)
      setOptimisticRelationships(prev => {
        const newMap = new Map(prev);
        newMap.delete(relationshipId);
        return newMap;
      });
    } catch (err) {
      // Restore on error (remove optimistic removal flag)
      setOptimisticRelationships(prev => {
        const newMap = new Map(prev);
        newMap.delete(relationshipId);
        return newMap;
      });

      const errorObj = err instanceof Error ? err : new Error('Failed to remove relationship');
      setError(errorObj);
      throw errorObj;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get relationships for an entity (includes optimistic relationships)
   */
  const getRelationships = useCallback(
    (entityId: string, type?: RelationshipType) => {
      // Guard: Return empty array if not initialized yet
      if (!initializedRef.current) {
        return [];
      }

      // Get actual relationships from manager
      const params: GetRelationshipsParams = {
        entityId,
        relationshipType: type,
      };
      const actualRels = relationshipManager.getRelationships(params);

      // Get optimistic relationships for this entity
      const optimisticRels = Array.from(optimisticRelationships.values()).filter(rel => {
        // Filter by entity (source or target)
        const matchesEntity = rel.sourceId === entityId || rel.targetId === entityId;
        // Filter by type (if specified)
        const matchesType = !type || rel.type === type;
        // Exclude relationships marked as being removed
        const notRemoving = !rel._removing;

        return matchesEntity && matchesType && notRemoving;
      });

      // Filter out actual relationships that are being removed
      const removingIds = new Set(
        Array.from(optimisticRelationships.values())
          .filter(r => r._removing)
          .map(r => r.id)
      );

      const filteredActualRels = actualRels.filter(r => !removingIds.has(r.id));

      // Deduplicate bidirectional relationships (canonical + non-canonical represent same link)
      // Create normalized signatures: sort entity IDs so both directions have same signature
      const seenPairs = new Set<string>();
      const deduplicatedActualRels = filteredActualRels.filter(r => {
        // Create signature with sorted entity IDs (so both directions match)
        const ids = [r.sourceId, r.targetId].sort();
        const pairSignature = `${ids[0]}|${ids[1]}|${r.type}`;

        if (seenPairs.has(pairSignature)) {
          return false; // Skip duplicate (non-canonical)
        }

        seenPairs.add(pairSignature);
        return true; // Keep first occurrence (canonical)
      });

      // Create content signatures for deduplicated actual relationships to filter optimistic ones
      // This prevents duplicates when the real relationship arrives before optimistic is removed
      const actualSignatures = new Set(
        deduplicatedActualRels.map(r => {
          const ids = [r.sourceId, r.targetId].sort();
          return `${ids[0]}|${ids[1]}|${r.type}`;
        })
      );

      // Filter out optimistic relationships that match actual relationships by content
      const uniqueOptimisticRels = optimisticRels.filter(r => {
        const ids = [r.sourceId, r.targetId].sort();
        const signature = `${ids[0]}|${ids[1]}|${r.type}`;
        return !actualSignatures.has(signature);
      });

      // Merge deduplicated actual + deduplicated optimistic relationships
      return [...deduplicatedActualRels, ...uniqueOptimisticRels];
    },
    [optimisticRelationships, refreshTrigger] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * Get related entities for an entity
   */
  const getRelatedEntities = useCallback(
    async <T extends EntityWithRelationships>(entityId: string, type?: RelationshipType) => {
      return relationshipManager.getRelatedEntities<T>(entityId, type);
    },
    []
  );

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Calculate relationship statistics
   */
  const stats = useMemo(() => {
    // Guard: Don't calculate stats until manager is initialized
    if (!initializedRef.current) {
      return {
        totalRelationships: 0,
        aiRelationships: 0,
        manualRelationships: 0,
      };
    }

    // Get all relationships from manager
    const allRels = relationshipManager.getRelationships({ entityId: '' });

    return {
      totalRelationships: allRels.length,
      aiRelationships: allRels.filter(r => r.metadata.source === 'ai').length,
      manualRelationships: allRels.filter(r => r.metadata.source === 'manual').length,
    };
  }, [refreshTrigger]);

  // Construct context value
  const value: RelationshipContextValue = useMemo(
    () => ({
      addRelationship,
      removeRelationship,
      getRelationships,
      getRelatedEntities,
      isLoading,
      error,
      clearError,
      optimisticRelationships,
      stats,
    }),
    [
      addRelationship,
      removeRelationship,
      getRelationships,
      getRelatedEntities,
      isLoading,
      error,
      clearError,
      optimisticRelationships,
      stats,
    ]
  );

  return <RelationshipContext.Provider value={value}>{children}</RelationshipContext.Provider>;
}

/**
 * useRelationships - Hook to access relationship context
 *
 * **Usage**:
 * ```tsx
 * function MyComponent() {
 *   const { addRelationship, getRelationships, isLoading } = useRelationships();
 *
 *   const handleLink = async () => {
 *     await addRelationship({
 *       sourceType: 'task',
 *       sourceId: 'task-123',
 *       targetType: 'note',
 *       targetId: 'note-456',
 *       type: 'task-note',
 *     });
 *   };
 *
 *   const relationships = getRelationships('task-123');
 *
 *   return <div>...</div>;
 * }
 * ```
 *
 * @throws Error if used outside of RelationshipProvider
 */
export function useRelationships() {
  const context = useContext(RelationshipContext);

  if (!context) {
    throw new Error('useRelationships must be used within a RelationshipProvider');
  }

  return context;
}

// Export types
export type { RelationshipContextValue };
