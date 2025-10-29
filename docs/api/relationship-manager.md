# RelationshipManager API Reference

**Version**: 2.0.0
**Module**: `@/services/relationshipManager`
**Status**: Production Ready

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Core Methods](#core-methods)
- [Interfaces](#interfaces)
- [Error Handling](#error-handling)
- [Events](#events)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

The `RelationshipManager` is the core service for managing relationships between entities in the Taskerino application. It provides:

- **Automatic Bidirectional Synchronization**: Maintains relationships on both entities automatically
- **Atomic Transactions**: All operations use ACID-compliant transactions
- **Fast Lookups**: O(1) relationship queries via RelationshipIndex
- **Extensible**: Strategy pattern for type-specific behavior
- **Event-Driven**: Emits events for reactive updates
- **Idempotent**: Safe to call operations multiple times

### Performance Targets

| Operation | Target | Typical |
|-----------|--------|---------|
| addRelationship | <10ms | 3-5ms |
| removeRelationship | <10ms | 3-5ms |
| getRelationships | <5ms | 1-2ms |
| getRelatedEntities (10 entities) | <50ms | 20-30ms |

---

## Getting Started

### Installation

The RelationshipManager is included in the core application. No additional installation required.

### Initialization

```typescript
import { relationshipManager } from '@/services/relationshipManager';

// Initialize before use (typically in app startup)
await relationshipManager.init();
```

### Basic Usage

```typescript
// Add a relationship
const relationship = await relationshipManager.addRelationship({
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note',
  targetId: 'note-456',
  type: 'task-note',
  metadata: {
    source: 'manual',
    createdBy: 'user-1'
  }
});

// Query relationships
const relationships = relationshipManager.getRelationships({
  entityId: 'task-123'
});

// Remove a relationship
await relationshipManager.removeRelationship({
  relationshipId: relationship.id
});
```

---

## Core Methods

### init()

Initialize the RelationshipManager. Must be called before using any other methods.

```typescript
async init(): Promise<void>
```

**Returns**: `Promise<void>`

**Throws**: `Error` if storage adapter is not available

**Example**:
```typescript
try {
  await relationshipManager.init();
  console.log('RelationshipManager initialized');
} catch (error) {
  console.error('Failed to initialize:', error);
}
```

---

### addRelationship()

Add a new relationship between two entities. Automatically creates bidirectional relationships if configured.

```typescript
async addRelationship(params: AddRelationshipParams): Promise<Relationship>
```

**Parameters**:
- `params.sourceType` (EntityType): Source entity type
- `params.sourceId` (string): Source entity ID
- `params.targetType` (EntityType): Target entity type
- `params.targetId` (string): Target entity ID
- `params.type` (RelationshipType): Relationship type
- `params.metadata` (Partial<RelationshipMetadata>): Optional metadata

**Returns**: `Promise<Relationship>` - The created relationship

**Throws**:
- `ValidationError` - Invalid relationship type or entity types
- `EntityNotFoundError` - Source or target entity not found
- `TransactionError` - Transaction failed

**Idempotency**: If an identical relationship already exists, returns the existing relationship.

**Example**:
```typescript
// Manual relationship
const rel = await relationshipManager.addRelationship({
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note',
  targetId: 'note-456',
  type: 'task-note',
  metadata: {
    source: 'manual',
    createdBy: 'user-1'
  }
});

// AI-suggested relationship
const aiRel = await relationshipManager.addRelationship({
  sourceType: 'task',
  sourceId: 'task-789',
  targetType: 'note',
  targetId: 'note-101',
  type: 'task-note',
  metadata: {
    source: 'ai',
    confidence: 0.92,
    reasoning: 'Task mentions key points from note'
  }
});
```

---

### removeRelationship()

Remove a relationship between two entities. Automatically removes bidirectional relationships.

```typescript
async removeRelationship(params: RemoveRelationshipParams): Promise<void>
```

**Parameters**:
- `params.relationshipId` (string): Relationship ID to remove

**Returns**: `Promise<void>`

**Throws**:
- `TransactionError` - Transaction failed

**Idempotency**: Safe to call with non-existent relationship IDs. No error thrown.

**Example**:
```typescript
try {
  await relationshipManager.removeRelationship({
    relationshipId: 'rel-abc123'
  });
  console.log('Relationship removed');
} catch (error) {
  console.error('Failed to remove:', error);
}
```

---

### getRelationships()

Get all relationships for an entity. Returns relationships where the entity is either source or target.

```typescript
getRelationships(params: GetRelationshipsParams): Relationship[]
```

**Parameters**:
- `params.entityId` (string): Entity ID to query
- `params.entityType` (EntityType, optional): Filter by entity type
- `params.relationshipType` (RelationshipType, optional): Filter by relationship type

**Returns**: `Relationship[]` - Array of relationships (empty if none found)

**Performance**: O(1) lookup via index

**Example**:
```typescript
// Get all relationships
const all = relationshipManager.getRelationships({
  entityId: 'task-123'
});

// Filter by relationship type
const notes = relationshipManager.getRelationships({
  entityId: 'task-123',
  relationshipType: 'task-note'
});

// Filter by entity type (where task is source)
const outgoing = relationshipManager.getRelationships({
  entityId: 'task-123',
  entityType: 'task'
});
```

---

### getRelatedEntities()

Get related entities for an entity. Returns the actual entity objects, not just relationships.

```typescript
async getRelatedEntities<T>(
  entityId: string,
  relationshipType?: RelationshipType
): Promise<T[]>
```

**Parameters**:
- `entityId` (string): Entity to get related entities for
- `relationshipType` (RelationshipType, optional): Filter by relationship type

**Returns**: `Promise<T[]>` - Array of related entities

**Generic Type**: Use type parameter to specify expected entity type

**Example**:
```typescript
// Get all related notes for a task
const notes = await relationshipManager.getRelatedEntities<Note>(
  'task-123',
  'task-note'
);

// Get all related entities (any type)
const related = await relationshipManager.getRelatedEntities(
  'task-123'
);
```

---

### registerStrategy()

Register a custom strategy for a relationship type.

```typescript
registerStrategy(type: RelationshipType, strategy: RelationshipStrategy): void
```

**Parameters**:
- `type` (RelationshipType): Relationship type
- `strategy` (RelationshipStrategy): Strategy instance

**Returns**: `void`

**Example**:
```typescript
import { TaskNoteStrategy } from '@/services/relationshipStrategies/TaskNoteStrategy';

const strategy = new TaskNoteStrategy();
relationshipManager.registerStrategy('task-note', strategy);
```

---

## Interfaces

### AddRelationshipParams

Parameters for adding a new relationship.

```typescript
interface AddRelationshipParams {
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  type: RelationshipType;
  metadata?: Partial<RelationshipMetadata>;
}
```

### RemoveRelationshipParams

Parameters for removing a relationship.

```typescript
interface RemoveRelationshipParams {
  relationshipId: string;
}
```

### GetRelationshipsParams

Parameters for querying relationships.

```typescript
interface GetRelationshipsParams {
  entityId: string;
  entityType?: EntityType;
  relationshipType?: RelationshipType;
}
```

### Relationship

Core relationship object.

```typescript
interface Relationship {
  id: string;
  type: RelationshipType;
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  metadata: RelationshipMetadata;
  canonical: boolean;
}
```

### RelationshipMetadata

Metadata attached to each relationship.

```typescript
interface RelationshipMetadata {
  source: 'ai' | 'manual' | 'migration' | 'system';
  confidence?: number;
  reasoning?: string;
  createdAt: string;
  createdBy?: string;
  extra?: Record<string, unknown>;
}
```

---

## Error Handling

### Error Classes

#### RelationshipError

Base error class for all relationship errors.

```typescript
class RelationshipError extends Error {
  code: string;
  details?: unknown;
}
```

#### ValidationError

Thrown when validation fails.

```typescript
class ValidationError extends RelationshipError {
  code: 'VALIDATION_ERROR';
}
```

**Common Causes**:
- Invalid relationship type
- Invalid source/target entity types
- Missing required metadata
- Strategy validation failed

**Example**:
```typescript
try {
  await relationshipManager.addRelationship({
    sourceType: 'invalid', // Invalid entity type
    sourceId: 'id',
    targetType: 'note',
    targetId: 'id',
    type: 'task-note'
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation failed:', error.message);
    console.log('Details:', error.details);
  }
}
```

#### EntityNotFoundError

Thrown when an entity referenced in a relationship cannot be found.

```typescript
class EntityNotFoundError extends RelationshipError {
  code: 'ENTITY_NOT_FOUND';
}
```

#### TransactionError

Thrown when a transaction operation fails.

```typescript
class TransactionError extends RelationshipError {
  code: 'TRANSACTION_ERROR';
}
```

### Error Handling Best Practices

```typescript
try {
  const rel = await relationshipManager.addRelationship(params);
  // Success
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors (show to user)
    showError('Invalid relationship: ' + error.message);
  } else if (error instanceof EntityNotFoundError) {
    // Handle missing entity (refresh data)
    await refreshEntities();
    retry();
  } else if (error instanceof TransactionError) {
    // Handle transaction errors (retry or report)
    logError(error);
    showError('Failed to save relationship. Please try again.');
  } else {
    // Unknown error
    logError(error);
    showError('An unexpected error occurred');
  }
}
```

---

## Events

The RelationshipManager emits events for reactive updates using the EventBus.

### RELATIONSHIP_ADDED

Emitted after a relationship is successfully added.

**Payload**:
```typescript
{
  relationship: Relationship;
  reverseRelationship?: Relationship; // For bidirectional relationships
}
```

**Example**:
```typescript
import { eventBus } from '@/services/eventBus';

const subscriptionId = eventBus.on('RELATIONSHIP_ADDED', (data) => {
  console.log('New relationship:', data.data.relationship);
  // Update UI, invalidate caches, etc.
});

// Unsubscribe when done
eventBus.off(subscriptionId);
```

### RELATIONSHIP_REMOVED

Emitted after a relationship is successfully removed.

**Payload**:
```typescript
{
  relationship: Relationship;
  reverseRelationship?: Relationship; // For bidirectional relationships
}
```

**Example**:
```typescript
eventBus.on('RELATIONSHIP_REMOVED', (data) => {
  console.log('Relationship removed:', data.data.relationship.id);
  // Update UI, invalidate caches, etc.
});
```

---

## Best Practices

### 1. Always Initialize

Initialize the RelationshipManager before use:

```typescript
// In app startup (e.g., App.tsx or main.ts)
await relationshipManager.init();
```

### 2. Use Type Guards

Check entity and relationship types before operations:

```typescript
import { validateRelationshipTypes } from '@/types/relationships';

const valid = validateRelationshipTypes(
  'task-note',
  'task',
  'note'
);

if (valid) {
  await relationshipManager.addRelationship({ ... });
}
```

### 3. Handle Errors Gracefully

Always wrap relationship operations in try-catch:

```typescript
try {
  await relationshipManager.addRelationship(params);
} catch (error) {
  if (error instanceof ValidationError) {
    // Show validation error to user
  } else {
    // Log and show generic error
  }
}
```

### 4. Use Events for UI Updates

Subscribe to events for reactive UI updates:

```typescript
useEffect(() => {
  const id = eventBus.on('RELATIONSHIP_ADDED', () => {
    // Refresh UI
    refreshRelationships();
  });

  return () => eventBus.off(id);
}, []);
```

### 5. Provide Metadata

Always provide meaningful metadata:

```typescript
await relationshipManager.addRelationship({
  // ...entity IDs and types
  metadata: {
    source: 'manual',
    createdBy: currentUserId,
    createdAt: new Date().toISOString(),
    extra: {
      context: 'Added from task detail view'
    }
  }
});
```

### 6. Leverage Idempotency

Don't worry about duplicate calls - operations are idempotent:

```typescript
// Safe to call multiple times
await relationshipManager.addRelationship(params);
await relationshipManager.addRelationship(params); // Returns existing

// Safe to remove non-existent relationships
await relationshipManager.removeRelationship({
  relationshipId: 'non-existent'
}); // No error
```

---

## Examples

### Example 1: Link Task to Note

```typescript
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
        extra: {
          action: 'user_click'
        }
      }
    });

    console.log('Task linked to note:', relationship.id);
    return relationship;
  } catch (error) {
    if (error instanceof ValidationError) {
      showError('Cannot link task to this note: ' + error.message);
    } else {
      showError('Failed to link task to note');
    }
    throw error;
  }
}
```

### Example 2: Display Related Notes for a Task

```typescript
async function displayRelatedNotes(taskId: string) {
  try {
    // Get all note relationships
    const relationships = relationshipManager.getRelationships({
      entityId: taskId,
      relationshipType: 'task-note'
    });

    // Load actual note entities
    const notes = await relationshipManager.getRelatedEntities<Note>(
      taskId,
      'task-note'
    );

    // Display notes with relationship metadata
    notes.forEach(note => {
      const rel = relationships.find(r =>
        r.targetId === note.id || r.sourceId === note.id
      );

      console.log('Note:', note.summary);
      if (rel?.metadata.source === 'ai') {
        console.log('AI Confidence:', rel.metadata.confidence);
        console.log('Reasoning:', rel.metadata.reasoning);
      }
    });

    return notes;
  } catch (error) {
    console.error('Failed to load related notes:', error);
    return [];
  }
}
```

### Example 3: Remove All Relationships for an Entity

```typescript
async function removeAllRelationships(entityId: string) {
  const relationships = relationshipManager.getRelationships({ entityId });

  for (const rel of relationships) {
    try {
      await relationshipManager.removeRelationship({
        relationshipId: rel.id
      });
    } catch (error) {
      console.error('Failed to remove relationship:', rel.id, error);
    }
  }

  console.log(`Removed ${relationships.length} relationships`);
}
```

### Example 4: Custom Strategy

```typescript
import { BaseRelationshipStrategy } from '@/services/relationshipStrategies/RelationshipStrategy';

class CustomTaskStrategy extends BaseRelationshipStrategy {
  validate(relationship: Relationship): ValidationResult {
    // Custom validation
    if (relationship.metadata.confidence && relationship.metadata.confidence < 0.8) {
      return {
        valid: false,
        error: 'Confidence too low for automatic linking'
      };
    }
    return { valid: true };
  }

  async afterAdd(relationship: Relationship): Promise<void> {
    // Update task metadata
    console.log('Updating task after relationship added');
    // await updateTaskMetadata(relationship.sourceId);
  }
}

// Register strategy
const strategy = new CustomTaskStrategy();
relationshipManager.registerStrategy('task-note', strategy);
```

### Example 5: Bulk Operations

```typescript
async function bulkLinkTasksToSession(
  taskIds: string[],
  sessionId: string
): Promise<Relationship[]> {
  const relationships: Relationship[] = [];

  for (const taskId of taskIds) {
    try {
      const rel = await relationshipManager.addRelationship({
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
      relationships.push(rel);
    } catch (error) {
      console.error('Failed to link task:', taskId, error);
    }
  }

  console.log(`Linked ${relationships.length}/${taskIds.length} tasks`);
  return relationships;
}
```

---

## See Also

- [Architecture Documentation](../architecture/relationship-manager.md)
- [Usage Examples](../examples/relationship-manager-usage.md)
- [Type System Reference](../../src/types/relationships.ts)
- [Strategy Pattern Guide](../../src/services/relationshipStrategies/README.md)
