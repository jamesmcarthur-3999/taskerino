# AGENT TASK C1: Relationship Context

**Objective:** Create React context for relationship state management with optimistic updates.

**Priority:** P1 (State Management)

**Dependencies:** S1 (Relationship Manager)

**Complexity:** Medium

**Estimated Time:** 6-8 hours

---

## Detailed Requirements

### 1. Create Relationship Context

**File:** `src/context/RelationshipContext.tsx`

Create a new React context that wraps the RelationshipManager service and provides React-friendly hooks and state management.

**Core Implementation:**

```typescript
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Relationship, RelationshipType, EntityType } from '@/types/relationships';
import { RelationshipManager } from '@/services/relationshipManager';
import { getStorage } from '@/services/storage';
import { eventBus } from '@/services/eventBus';

interface RelationshipContextValue {
  // Core operations
  addRelationship: (params: AddRelationshipParams) => Promise<Relationship>;
  removeRelationship: (relationshipId: string) => Promise<void>;
  getRelationships: (entityId: string, type?: RelationshipType) => Relationship[];
  getRelatedEntities: <T>(entityId: string, type?: RelationshipType) => Promise<T[]>;

  // Loading/error state
  isLoading: boolean;
  error: Error | null;

  // Optimistic updates
  optimisticRelationships: Map<string, Relationship>; // Pending relationships

  // Stats
  stats: {
    totalRelationships: number;
    aiRelationships: number;
    manualRelationships: number;
  };
}

const RelationshipContext = createContext<RelationshipContextValue | undefined>(undefined);

export function RelationshipProvider({ children }: { children: React.ReactNode }) {
  const [manager] = useState(() => new RelationshipManager(getStorage(), eventBus));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [optimisticRelationships, setOptimisticRelationships] = useState<Map<string, Relationship>>(new Map());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Listen for relationship events
  useEffect(() => {
    const handleAdded = () => setRefreshTrigger(prev => prev + 1);
    const handleRemoved = () => setRefreshTrigger(prev => prev + 1);

    eventBus.on('RELATIONSHIP_ADDED', handleAdded);
    eventBus.on('RELATIONSHIP_REMOVED', handleRemoved);

    return () => {
      eventBus.off('RELATIONSHIP_ADDED', handleAdded);
      eventBus.off('RELATIONSHIP_REMOVED', handleRemoved);
    };
  }, []);

  // Add relationship with optimistic update
  const addRelationship = useCallback(async (params: AddRelationshipParams) => {
    const optimisticId = `optimistic-${Date.now()}`;

    // Create optimistic relationship
    const optimisticRel: Relationship = {
      id: optimisticId,
      type: params.type,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: {
        source: params.metadata?.source || 'manual',
        createdAt: new Date().toISOString(),
        ...params.metadata,
      },
      canonical: true,
    };

    // Add to optimistic map
    setOptimisticRelationships(prev => new Map(prev).set(optimisticId, optimisticRel));

    try {
      setIsLoading(true);
      setError(null);

      // Perform actual operation
      const relationship = await manager.addRelationship(params);

      // Remove optimistic relationship
      setOptimisticRelationships(prev => {
        const newMap = new Map(prev);
        newMap.delete(optimisticId);
        return newMap;
      });

      return relationship;
    } catch (err) {
      // Remove optimistic relationship on error
      setOptimisticRelationships(prev => {
        const newMap = new Map(prev);
        newMap.delete(optimisticId);
        return newMap;
      });

      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [manager]);

  // Remove relationship with optimistic update
  const removeRelationship = useCallback(async (relationshipId: string) => {
    // Mark as being removed (optimistic)
    setOptimisticRelationships(prev => {
      const newMap = new Map(prev);
      newMap.set(relationshipId, { ...prev.get(relationshipId), _removing: true } as any);
      return newMap;
    });

    try {
      setIsLoading(true);
      setError(null);

      await manager.removeRelationship({ relationshipId });

      // Clear optimistic state
      setOptimisticRelationships(prev => {
        const newMap = new Map(prev);
        newMap.delete(relationshipId);
        return newMap;
      });
    } catch (err) {
      // Restore on error
      setOptimisticRelationships(prev => {
        const newMap = new Map(prev);
        newMap.delete(relationshipId);
        return newMap;
      });

      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [manager]);

  // Get relationships for an entity
  const getRelationships = useCallback((entityId: string, type?: RelationshipType) => {
    const actualRels = manager.getRelationships({ entityId, relationshipType: type });

    // Merge with optimistic relationships
    const optimisticRels = Array.from(optimisticRelationships.values()).filter(
      rel => (rel.sourceId === entityId || rel.targetId === entityId) && (!type || rel.type === type)
    );

    return [...actualRels, ...optimisticRels];
  }, [manager, optimisticRelationships, refreshTrigger]);

  // Get related entities
  const getRelatedEntities = useCallback(async <T,>(entityId: string, type?: RelationshipType) => {
    return manager.getRelatedEntities<T>(entityId, type);
  }, [manager]);

  // Calculate stats
  const stats = useMemo(() => {
    const allRels = manager.getRelationships({ entityId: '' }); // Get all

    return {
      totalRelationships: allRels.length,
      aiRelationships: allRels.filter(r => r.metadata.source === 'ai').length,
      manualRelationships: allRels.filter(r => r.metadata.source === 'manual').length,
    };
  }, [manager, refreshTrigger]);

  const value: RelationshipContextValue = {
    addRelationship,
    removeRelationship,
    getRelationships,
    getRelatedEntities,
    isLoading,
    error,
    optimisticRelationships,
    stats,
  };

  return (
    <RelationshipContext.Provider value={value}>
      {children}
    </RelationshipContext.Provider>
  );
}

export function useRelationships() {
  const context = useContext(RelationshipContext);
  if (!context) {
    throw new Error('useRelationships must be used within RelationshipProvider');
  }
  return context;
}
```

### 2. Create Custom Hooks

**File:** `src/hooks/useRelatedItems.ts`

```typescript
/**
 * Hook to get related items for a specific entity
 */
export function useRelatedItems<T>(
  entityId: string,
  relationshipType?: RelationshipType
) {
  const { getRelationships, getRelatedEntities } = useRelationships();
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadItems() {
      setIsLoading(true);
      try {
        const entities = await getRelatedEntities<T>(entityId, relationshipType);
        setItems(entities);
      } finally {
        setIsLoading(false);
      }
    }

    loadItems();
  }, [entityId, relationshipType]);

  return { items, isLoading };
}
```

**File:** `src/hooks/useRelationshipActions.ts`

```typescript
/**
 * Hook for relationship actions (add/remove)
 */
export function useRelationshipActions(entityId: string, entityType: EntityType) {
  const { addRelationship, removeRelationship } = useRelationships();

  const linkTo = useCallback(async (
    targetId: string,
    targetType: EntityType,
    type: RelationshipType,
    metadata?: Partial<RelationshipMetadata>
  ) => {
    return addRelationship({
      sourceType: entityType,
      sourceId: entityId,
      targetType,
      targetId,
      type,
      metadata,
    });
  }, [addRelationship, entityId, entityType]);

  const unlink = useCallback(async (relationshipId: string) => {
    return removeRelationship(relationshipId);
  }, [removeRelationship]);

  return { linkTo, unlink };
}
```

---

## Deliverables

1. **`src/context/RelationshipContext.tsx`** - Complete context implementation (300-400 lines)
2. **`src/hooks/useRelatedItems.ts`** - Hook for fetching related items
3. **`src/hooks/useRelationshipActions.ts`** - Hook for relationship actions
4. **`tests/context/RelationshipContext.test.tsx`** - Comprehensive tests (200+ lines)
5. **`docs/architecture/relationship-context.md`** - Context architecture documentation

---

## Acceptance Criteria

- [ ] Optimistic updates work correctly (UI updates immediately)
- [ ] Error handling rolls back optimistic updates
- [ ] Context triggers re-renders when relationships change
- [ ] Cross-window sync works (multiple tabs)
- [ ] No memory leaks (event listeners cleaned up)
- [ ] Performance: No unnecessary re-renders
- [ ] Test coverage >85%

---

## Testing Requirements

```typescript
describe('RelationshipContext', () => {
  it('should add relationship with optimistic update', async () => {
    const { result } = renderHook(() => useRelationships(), {
      wrapper: RelationshipProvider,
    });

    // Start adding
    const promise = result.current.addRelationship({
      sourceType: EntityType.TASK,
      sourceId: 'task-1',
      targetType: EntityType.NOTE,
      targetId: 'note-1',
      type: RelationshipType.TASK_NOTE,
    });

    // Should have optimistic relationship
    const rels = result.current.getRelationships('task-1');
    expect(rels.length).toBeGreaterThan(0);

    // Wait for completion
    await promise;

    // Should still have relationship
    const finalRels = result.current.getRelationships('task-1');
    expect(finalRels.length).toBeGreaterThan(0);
  });

  it('should rollback on error', async () => {
    // Simulate error
    // Verify optimistic update rolled back
  });
});
```

---

**Task Complete When:**
- All deliverables created
- Optimistic updates working smoothly
- All tests passing
- Documentation complete
