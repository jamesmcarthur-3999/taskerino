# RelationshipManager Usage Examples

**Version**: 2.0.0
**Last Updated**: 2025-10-24

This guide provides practical, real-world examples of using the RelationshipManager in the Taskerino application.

## Table of Contents

- [Basic Examples](#basic-examples)
- [React Integration](#react-integration)
- [Common Patterns](#common-patterns)
- [Advanced Use Cases](#advanced-use-cases)
- [Error Handling](#error-handling)
- [Testing](#testing)

---

## Basic Examples

### Example 1: Initialize RelationshipManager

```typescript
import { relationshipManager } from '@/services/relationshipManager';

// In app initialization (App.tsx or main.ts)
async function initializeApp() {
  try {
    await relationshipManager.init();
    console.log('RelationshipManager initialized');
  } catch (error) {
    console.error('Failed to initialize RelationshipManager:', error);
    throw error;
  }
}
```

### Example 2: Link Task to Note

```typescript
import { relationshipManager } from '@/services/relationshipManager';

async function linkTaskToNote(taskId: string, noteId: string) {
  try {
    const relationship = await relationshipManager.addRelationship({
      sourceType: 'task',
      sourceId: taskId,
      targetType: 'note',
      targetId: noteId,
      type: 'task-note',
      metadata: {
        source: 'manual',
        createdBy: 'user-123',
        createdAt: new Date().toISOString()
      }
    });

    console.log('Relationship created:', relationship.id);
    return relationship;
  } catch (error) {
    console.error('Failed to link task to note:', error);
    throw error;
  }
}
```

### Example 3: Get All Relationships for a Task

```typescript
import { relationshipManager } from '@/services/relationshipManager';

function getTaskRelationships(taskId: string) {
  const relationships = relationshipManager.getRelationships({
    entityId: taskId
  });

  console.log(`Task has ${relationships.length} relationships:`);
  relationships.forEach(rel => {
    console.log(`- ${rel.type}: ${rel.targetId}`);
  });

  return relationships;
}
```

### Example 4: Remove a Relationship

```typescript
import { relationshipManager } from '@/services/relationshipManager';

async function unlinkTaskFromNote(relationshipId: string) {
  try {
    await relationshipManager.removeRelationship({ relationshipId });
    console.log('Relationship removed');
  } catch (error) {
    console.error('Failed to remove relationship:', error);
    throw error;
  }
}
```

---

## React Integration

### Example 5: Display Related Notes in a Task Detail View

```tsx
import { useState, useEffect } from 'react';
import { relationshipManager } from '@/services/relationshipManager';
import { eventBus } from '@/services/eventBus';
import type { Note } from '@/types';

interface TaskNotesProps {
  taskId: string;
}

function TaskNotes({ taskId }: TaskNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotes();

    // Listen for relationship changes
    const addId = eventBus.on('RELATIONSHIP_ADDED', (data) => {
      if (data.data.relationship.sourceId === taskId ||
          data.data.relationship.targetId === taskId) {
        loadNotes();
      }
    });

    const removeId = eventBus.on('RELATIONSHIP_REMOVED', (data) => {
      if (data.data.relationship.sourceId === taskId ||
          data.data.relationship.targetId === taskId) {
        loadNotes();
      }
    });

    return () => {
      eventBus.off(addId);
      eventBus.off(removeId);
    };
  }, [taskId]);

  async function loadNotes() {
    try {
      setLoading(true);
      const relatedNotes = await relationshipManager.getRelatedEntities<Note>(
        taskId,
        'task-note'
      );
      setNotes(relatedNotes);
    } catch (error) {
      console.error('Failed to load related notes:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading notes...</div>;

  return (
    <div>
      <h3>Related Notes ({notes.length})</h3>
      {notes.map(note => (
        <NoteCard key={note.id} note={note} />
      ))}
    </div>
  );
}
```

### Example 6: Link Task to Note with UI Feedback

```tsx
import { useState } from 'react';
import { relationshipManager } from '@/services/relationshipManager';
import { ValidationError } from '@/services/errors/RelationshipError';

interface LinkTaskButtonProps {
  taskId: string;
  noteId: string;
}

function LinkTaskButton({ taskId, noteId }: LinkTaskButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLink() {
    try {
      setLoading(true);
      setError(null);

      await relationshipManager.addRelationship({
        sourceType: 'task',
        sourceId: taskId,
        targetType: 'note',
        targetId: noteId,
        type: 'task-note',
        metadata: {
          source: 'manual',
          createdAt: new Date().toISOString()
        }
      });

      // Success feedback
      showToast('Task linked to note successfully');
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(`Invalid: ${err.message}`);
      } else {
        setError('Failed to link task to note');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleLink} disabled={loading}>
        {loading ? 'Linking...' : 'Link to Note'}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

### Example 7: Custom Hook for Relationship Management

```tsx
import { useState, useEffect, useCallback } from 'react';
import { relationshipManager } from '@/services/relationshipManager';
import { eventBus } from '@/services/eventBus';
import type { Relationship } from '@/types/relationships';

export function useRelationships(entityId: string) {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);

  // Load relationships
  const load = useCallback(() => {
    try {
      setLoading(true);
      const rels = relationshipManager.getRelationships({ entityId });
      setRelationships(rels);
    } catch (error) {
      console.error('Failed to load relationships:', error);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  // Subscribe to events
  useEffect(() => {
    load();

    const addId = eventBus.on('RELATIONSHIP_ADDED', (data) => {
      if (data.data.relationship.sourceId === entityId ||
          data.data.relationship.targetId === entityId) {
        load();
      }
    });

    const removeId = eventBus.on('RELATIONSHIP_REMOVED', (data) => {
      if (data.data.relationship.sourceId === entityId ||
          data.data.relationship.targetId === entityId) {
        load();
      }
    });

    return () => {
      eventBus.off(addId);
      eventBus.off(removeId);
    };
  }, [entityId, load]);

  // Add relationship helper
  const add = useCallback(async (params: Omit<AddRelationshipParams, 'sourceId'>) => {
    return await relationshipManager.addRelationship({
      ...params,
      sourceId: entityId
    });
  }, [entityId]);

  // Remove relationship helper
  const remove = useCallback(async (relationshipId: string) => {
    await relationshipManager.removeRelationship({ relationshipId });
  }, []);

  return {
    relationships,
    loading,
    add,
    remove,
    refresh: load
  };
}

// Usage in component
function MyComponent({ taskId }: { taskId: string }) {
  const { relationships, loading, add, remove } = useRelationships(taskId);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {relationships.map(rel => (
        <div key={rel.id}>
          {rel.type}: {rel.targetId}
          <button onClick={() => remove(rel.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}
```

---

## Common Patterns

### Example 8: Bulk Link Tasks to Session

```typescript
import { relationshipManager } from '@/services/relationshipManager';

async function bulkLinkTasksToSession(
  taskIds: string[],
  sessionId: string
): Promise<{
  successful: string[];
  failed: Array<{ taskId: string; error: string }>;
}> {
  const results = {
    successful: [] as string[],
    failed: [] as Array<{ taskId: string; error: string }>
  };

  for (const taskId of taskIds) {
    try {
      await relationshipManager.addRelationship({
        sourceType: 'task',
        sourceId: taskId,
        targetType: 'session',
        targetId: sessionId,
        type: 'task-session',
        metadata: {
          source: 'manual',
          extra: {
            bulk: true,
            timestamp: Date.now()
          }
        }
      });
      results.successful.push(taskId);
    } catch (error) {
      results.failed.push({
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  console.log(`Linked ${results.successful.length}/${taskIds.length} tasks`);
  if (results.failed.length > 0) {
    console.warn('Failed to link some tasks:', results.failed);
  }

  return results;
}
```

### Example 9: Display Relationship History with AI Confidence

```tsx
import { relationshipManager } from '@/services/relationshipManager';
import type { Relationship } from '@/types/relationships';

interface RelationshipHistoryProps {
  entityId: string;
}

function RelationshipHistory({ entityId }: RelationshipHistoryProps) {
  const relationships = relationshipManager.getRelationships({ entityId });

  // Sort by creation date
  const sorted = [...relationships].sort((a, b) => {
    return new Date(b.metadata.createdAt).getTime() -
           new Date(a.metadata.createdAt).getTime();
  });

  return (
    <div className="relationship-history">
      <h3>Relationship History</h3>
      {sorted.map(rel => (
        <div key={rel.id} className="relationship-item">
          <div className="type">{rel.type}</div>
          <div className="target">{rel.targetId}</div>
          <div className="metadata">
            <span className="source">
              {rel.metadata.source === 'ai' ? '🤖 AI' : '👤 Manual'}
            </span>
            {rel.metadata.confidence && (
              <span className="confidence">
                {(rel.metadata.confidence * 100).toFixed(0)}% confident
              </span>
            )}
            {rel.metadata.reasoning && (
              <div className="reasoning">{rel.metadata.reasoning}</div>
            )}
            <span className="date">
              {new Date(rel.metadata.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Example 10: Remove All Relationships for an Entity

```typescript
import { relationshipManager } from '@/services/relationshipManager';

async function removeAllRelationships(
  entityId: string
): Promise<{
  removed: number;
  failed: number;
}> {
  const relationships = relationshipManager.getRelationships({ entityId });
  let removed = 0;
  let failed = 0;

  for (const rel of relationships) {
    try {
      await relationshipManager.removeRelationship({
        relationshipId: rel.id
      });
      removed++;
    } catch (error) {
      console.error('Failed to remove relationship:', rel.id, error);
      failed++;
    }
  }

  console.log(`Removed ${removed}/${relationships.length} relationships`);
  if (failed > 0) {
    console.warn(`Failed to remove ${failed} relationships`);
  }

  return { removed, failed };
}
```

---

## Advanced Use Cases

### Example 11: Graph Visualization of Relationships

```tsx
import { useEffect, useState } from 'react';
import { relationshipManager } from '@/services/relationshipManager';
import type { Relationship } from '@/types/relationships';

interface GraphNode {
  id: string;
  type: string;
  label: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

function RelationshipGraph({ entityId }: { entityId: string }) {
  const [graph, setGraph] = useState<{
    nodes: GraphNode[];
    edges: GraphEdge[];
  }>({ nodes: [], edges: [] });

  useEffect(() => {
    buildGraph();
  }, [entityId]);

  function buildGraph() {
    const relationships = relationshipManager.getRelationships({ entityId });
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const seen = new Set<string>();

    // Add center node
    nodes.push({
      id: entityId,
      type: 'center',
      label: entityId
    });
    seen.add(entityId);

    // Add related nodes and edges
    relationships.forEach(rel => {
      const otherId = rel.sourceId === entityId ? rel.targetId : rel.sourceId;
      const otherType = rel.sourceId === entityId ? rel.targetType : rel.sourceType;

      if (!seen.has(otherId)) {
        nodes.push({
          id: otherId,
          type: otherType,
          label: otherId
        });
        seen.add(otherId);
      }

      edges.push({
        source: rel.sourceId,
        target: rel.targetId,
        type: rel.type
      });
    });

    setGraph({ nodes, edges });
  }

  return (
    <div>
      <h3>Relationship Graph</h3>
      <svg width="800" height="600">
        {/* Render nodes and edges using D3 or custom SVG */}
      </svg>
    </div>
  );
}
```

### Example 12: Smart Relationship Suggestions

```typescript
import { relationshipManager } from '@/services/relationshipManager';
import type { Note, Task } from '@/types';

interface RelationshipSuggestion {
  targetId: string;
  targetType: string;
  confidence: number;
  reasoning: string;
}

async function suggestRelationships(
  taskId: string,
  allNotes: Note[]
): Promise<RelationshipSuggestion[]> {
  const task = await loadTask(taskId);
  const existingRels = relationshipManager.getRelationships({
    entityId: taskId,
    relationshipType: 'task-note'
  });

  const existingNoteIds = new Set(
    existingRels.map(rel =>
      rel.sourceId === taskId ? rel.targetId : rel.sourceId
    )
  );

  const suggestions: RelationshipSuggestion[] = [];

  for (const note of allNotes) {
    // Skip if already linked
    if (existingNoteIds.has(note.id)) continue;

    // Calculate similarity (simplified)
    const confidence = calculateSimilarity(task.summary, note.summary);

    if (confidence > 0.7) {
      suggestions.push({
        targetId: note.id,
        targetType: 'note',
        confidence,
        reasoning: `Task and note have similar content (${(confidence * 100).toFixed(0)}% match)`
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

function calculateSimilarity(text1: string, text2: string): number {
  // Simplified similarity calculation
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set(
    [...words1].filter(word => words2.has(word))
  );

  return intersection.size / Math.max(words1.size, words2.size);
}
```

### Example 13: Cascade Delete with Confirmation

```tsx
import { useState } from 'react';
import { relationshipManager } from '@/services/relationshipManager';

interface DeleteEntityButtonProps {
  entityId: string;
  entityType: string;
}

function DeleteEntityButton({ entityId, entityType }: DeleteEntityButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [relCount, setRelCount] = useState(0);

  function handleDeleteClick() {
    const rels = relationshipManager.getRelationships({ entityId });
    setRelCount(rels.length);
    setShowConfirm(true);
  }

  async function handleConfirm() {
    try {
      // Remove all relationships first
      await removeAllRelationships(entityId);

      // Then delete the entity
      await deleteEntity(entityType, entityId);

      showToast('Entity and relationships deleted');
    } catch (error) {
      console.error('Failed to delete:', error);
      showError('Failed to delete entity');
    } finally {
      setShowConfirm(false);
    }
  }

  return (
    <>
      <button onClick={handleDeleteClick}>Delete</button>

      {showConfirm && (
        <ConfirmDialog
          title="Delete Entity"
          message={`This will delete the ${entityType} and ${relCount} relationships. Continue?`}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
```

---

## Error Handling

### Example 14: Comprehensive Error Handling

```typescript
import { relationshipManager } from '@/services/relationshipManager';
import {
  ValidationError,
  EntityNotFoundError,
  TransactionError
} from '@/services/errors/RelationshipError';

async function safeAddRelationship(
  sourceId: string,
  targetId: string
): Promise<Relationship | null> {
  try {
    const relationship = await relationshipManager.addRelationship({
      sourceType: 'task',
      sourceId,
      targetType: 'note',
      targetId,
      type: 'task-note',
      metadata: {
        source: 'manual'
      }
    });

    return relationship;
  } catch (error) {
    if (error instanceof ValidationError) {
      // Handle validation errors
      console.error('Validation failed:', error.message);
      showToast(`Invalid: ${error.message}`, 'error');
      return null;
    } else if (error instanceof EntityNotFoundError) {
      // Handle missing entity
      console.error('Entity not found:', error.details);
      showToast('One of the items no longer exists', 'error');
      // Optionally refresh data
      await refreshEntities();
      return null;
    } else if (error instanceof TransactionError) {
      // Handle transaction errors
      console.error('Transaction failed:', error.message);
      showToast('Failed to save. Please try again.', 'error');
      // Optionally retry
      return await retryWithBackoff(() => safeAddRelationship(sourceId, targetId));
    } else {
      // Unknown error
      console.error('Unexpected error:', error);
      logErrorToService(error);
      showToast('An unexpected error occurred', 'error');
      return null;
    }
  }
}
```

### Example 15: Retry with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('All retry attempts failed');
}
```

---

## Testing

### Example 16: Unit Testing RelationshipManager

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { relationshipManager } from '@/services/relationshipManager';
import { ValidationError } from '@/services/errors/RelationshipError';

describe('RelationshipManager', () => {
  beforeEach(async () => {
    await relationshipManager.init();
  });

  it('should add a relationship', async () => {
    const rel = await relationshipManager.addRelationship({
      sourceType: 'task',
      sourceId: 'task-1',
      targetType: 'note',
      targetId: 'note-1',
      type: 'task-note',
      metadata: { source: 'manual' }
    });

    expect(rel).toBeDefined();
    expect(rel.type).toBe('task-note');
    expect(rel.canonical).toBe(true);
  });

  it('should throw ValidationError for invalid type', async () => {
    await expect(
      relationshipManager.addRelationship({
        sourceType: 'invalid' as any,
        sourceId: 'id',
        targetType: 'note',
        targetId: 'id',
        type: 'task-note',
        metadata: { source: 'manual' }
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should get relationships for entity', async () => {
    await relationshipManager.addRelationship({
      sourceType: 'task',
      sourceId: 'task-1',
      targetType: 'note',
      targetId: 'note-1',
      type: 'task-note',
      metadata: { source: 'manual' }
    });

    const rels = relationshipManager.getRelationships({
      entityId: 'task-1'
    });

    expect(rels.length).toBeGreaterThan(0);
  });

  it('should remove a relationship', async () => {
    const rel = await relationshipManager.addRelationship({
      sourceType: 'task',
      sourceId: 'task-1',
      targetType: 'note',
      targetId: 'note-1',
      type: 'task-note',
      metadata: { source: 'manual' }
    });

    await relationshipManager.removeRelationship({
      relationshipId: rel.id
    });

    const rels = relationshipManager.getRelationships({
      entityId: 'task-1'
    });

    expect(rels.find(r => r.id === rel.id)).toBeUndefined();
  });
});
```

### Example 17: Testing with Event Subscriptions

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { relationshipManager } from '@/services/relationshipManager';
import { eventBus } from '@/services/eventBus';

describe('RelationshipManager Events', () => {
  beforeEach(async () => {
    await relationshipManager.init();
    eventBus.clear();
  });

  it('should emit RELATIONSHIP_ADDED event', async () => {
    const handler = vi.fn();
    const subId = eventBus.on('RELATIONSHIP_ADDED', handler);

    await relationshipManager.addRelationship({
      sourceType: 'task',
      sourceId: 'task-1',
      targetType: 'note',
      targetId: 'note-1',
      type: 'task-note',
      metadata: { source: 'manual' }
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].data.relationship).toBeDefined();

    eventBus.off(subId);
  });
});
```

---

## See Also

- [API Reference](../api/relationship-manager.md)
- [Architecture Documentation](../architecture/relationship-manager.md)
- [Type System Reference](../../src/types/relationships.ts)
