# RelationshipManager Architecture

**Version**: 2.0.0
**Last Updated**: 2025-10-24
**Status**: Production Ready

## Table of Contents

- [Overview](#overview)
- [Design Principles](#design-principles)
- [Architecture Diagram](#architecture-diagram)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [Transaction System](#transaction-system)
- [Strategy Pattern](#strategy-pattern)
- [Performance Characteristics](#performance-characteristics)
- [Design Decisions](#design-decisions)
- [Migration Strategy](#migration-strategy)

---

## Overview

The RelationshipManager is the core service for managing relationships between entities in the Taskerino application. It provides a unified, type-safe, and performant way to create, query, and remove relationships between Tasks, Notes, Sessions, and other entity types.

### Key Features

1. **Automatic Bidirectional Synchronization**
   - Maintains consistency across both entities automatically
   - No manual sync required
   - Configurable per relationship type

2. **Atomic Transactions**
   - ACID-compliant multi-entity updates
   - Automatic rollback on failures
   - No partial state ever

3. **O(1) Lookups**
   - Fast relationship queries via RelationshipIndex
   - Three-index structure for different query patterns
   - Scales to 100k+ relationships

4. **Extensible via Strategy Pattern**
   - Custom logic per relationship type
   - Validation, pre/post hooks
   - Cascade delete control

5. **Event-Driven Updates**
   - Emits events for reactive UI updates
   - Decoupled from UI layer
   - Perfect for cross-window sync

---

## Design Principles

### 1. Separation of Concerns

```
┌─────────────────────────────────────────────┐
│              UI Layer                        │
│  (React Components, Contexts, Hooks)        │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         Service Layer                        │
│     (RelationshipManager)                    │
└────────────────┬────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│Storage Adapter│  │  EventBus    │
└──────────────┘  └──────────────┘
```

- **UI Layer**: Presentation and user interaction only
- **Service Layer**: Business logic and coordination
- **Storage Layer**: Data persistence and transactions
- **Event Layer**: Cross-component communication

### 2. Immutability Where Possible

Relationships are immutable once created. To "update" a relationship, remove and re-add.

**Rationale**: Simplifies reasoning about state, enables time-travel debugging, makes caching trivial.

### 3. Type Safety Throughout

```typescript
// Compile-time validation
const rel: Relationship = { ... };

// Runtime validation
const config = RELATIONSHIP_CONFIGS[type];
validateRelationshipTypes(type, sourceType, targetType);
```

**Rationale**: Catch errors at compile-time, prevent invalid states.

### 4. Performance by Default

- O(1) lookups via index
- Lazy loading of related entities
- Bulk operations supported
- No N+1 query problems

**Rationale**: Fast by default, no need to "optimize later"

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    RelationshipManager                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Validation   │  │ Transaction  │  │  Strategy    │     │
│  │   Logic      │  │   Manager    │  │  Executor    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────┐     │
│  │         Public API                                │     │
│  │  - addRelationship()                             │     │
│  │  - removeRelationship()                          │     │
│  │  - getRelationships()                            │     │
│  │  - getRelatedEntities()                          │     │
│  │  - registerStrategy()                            │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│RelationshipIndex│  │StorageAdapter│  │  EventBus    │
│                │  │              │  │              │
│ - byEntity     │  │ - load()     │  │ - emit()     │
│ - byId         │  │ - save()     │  │ - on()       │
│ - bySourceTarget│  │ - transaction│  │ - off()      │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Core Components

### 1. RelationshipManager

**Responsibilities**:
- Coordinate relationship operations
- Enforce validation rules
- Manage transactions
- Execute strategies
- Emit events

**Key Methods**:
- `addRelationship()`: Create new relationships
- `removeRelationship()`: Delete relationships
- `getRelationships()`: Query relationships
- `getRelatedEntities()`: Load related entities

### 2. RelationshipIndex

**Responsibilities**:
- Fast O(1) relationship lookups
- Maintain three index structures
- Sync with storage

**Index Structures**:
```typescript
{
  byEntity: Map<entityId, Relationship[]>,
  byId: Map<relationshipId, Relationship>,
  bySourceTarget: Map<sourceId, Map<targetId, Relationship>>
}
```

**Performance**:
- Add: O(1)
- Remove: O(n) where n = relationships for entity (typically <10)
- GetByEntity: O(1)
- GetById: O(1)
- Exists: O(1)

### 3. Storage Adapter

**Responsibilities**:
- Persist relationships to disk/database
- Provide atomic transactions
- Handle rollback on failure

**Transaction API**:
```typescript
const txId = storage.beginPhase24Transaction();
storage.addOperation(txId, operation);
await storage.commitPhase24Transaction(txId);
// OR
await storage.rollbackPhase24Transaction(txId);
```

### 4. Strategy System

**Responsibilities**:
- Type-specific validation
- Pre/post operation hooks
- Cascade delete logic

**Interface**:
```typescript
interface RelationshipStrategy {
  validate(relationship): ValidationResult;
  beforeAdd(relationship): Promise<void>;
  afterAdd(relationship): Promise<void>;
  beforeRemove(relationship): Promise<void>;
  afterRemove(relationship): Promise<void>;
  shouldCascadeDelete(relationship): boolean;
}
```

### 5. EventBus

**Responsibilities**:
- Emit relationship events
- Allow subscriptions
- Isolate errors

**Events**:
- `RELATIONSHIP_ADDED`
- `RELATIONSHIP_REMOVED`

---

## Data Flow

### Add Relationship Flow

```
User Action (addRelationship)
        │
        ▼
┌────────────────────┐
│  1. Validation     │  Validate types, check configs
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  2. Duplicate Check│  Check index for existing
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  3. Create Objects │  Create Relationship objects
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  4. Strategy Before│  Execute beforeAdd hook
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  5. Begin Tx       │  Start atomic transaction
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  6. Update Source  │  Add rel to source entity
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  7. Update Target  │  Add reverse rel if bidirectional
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  8. Commit Tx      │  Persist all changes atomically
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  9. Update Index   │  Add to in-memory index
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ 10. Strategy After │  Execute afterAdd hook
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ 11. Emit Event     │  Notify subscribers
└────────┬───────────┘
         │
         ▼
     Return relationship
```

**Error Handling**: If any step fails:
1. Transaction is rolled back
2. Index is not updated
3. No event is emitted
4. Error is propagated to caller

### Remove Relationship Flow

```
User Action (removeRelationship)
        │
        ▼
┌────────────────────┐
│  1. Lookup by ID   │  Find in index
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  2. Check Exists   │  Return early if not found
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  3. Strategy Before│  Execute beforeRemove hook
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  4. Begin Tx       │  Start atomic transaction
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  5. Remove Source  │  Remove from source entity
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  6. Remove Target  │  Remove reverse if bidirectional
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  7. Commit Tx      │  Persist all changes atomically
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  8. Update Index   │  Remove from in-memory index
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  9. Strategy After │  Execute afterRemove hook
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ 10. Emit Event     │  Notify subscribers
└────────┬───────────┘
         │
         ▼
       Success
```

---

## Transaction System

### ACID Properties

**Atomicity**: All operations in a transaction succeed or all fail. No partial state.

**Consistency**: Relationships maintain bidirectional consistency. Indexes stay in sync.

**Isolation**: (Not applicable - single-threaded JavaScript)

**Durability**: Once committed, changes persist across app restarts.

### Implementation

The transaction system uses a staging pattern:

```typescript
// Phase 1: Begin transaction (create staging area)
const txId = storage.beginPhase24Transaction();

// Phase 2: Stage operations
storage.addOperation(txId, {
  type: 'write',
  collection: 'tasks',
  data: modifiedTasks
});

storage.addOperation(txId, {
  type: 'write',
  collection: 'notes',
  data: modifiedNotes
});

// Phase 3: Commit (atomic write)
await storage.commitPhase24Transaction(txId);
// OR rollback on error
await storage.rollbackPhase24Transaction(txId);
```

### Rollback Strategy

On error:
1. **IndexedDB**: Use native IDBTransaction rollback
2. **Tauri FS**: Restore from staging directory backup
3. **Index**: Not updated (still reflects pre-transaction state)
4. **Events**: Not emitted

Result: System returns to exact pre-transaction state.

---

## Strategy Pattern

The Strategy pattern allows customization of relationship behavior without modifying core logic.

### When to Use Strategies

1. **Type-Specific Validation**: Enforce rules beyond basic type checking
2. **Side Effects**: Update derived data, trigger analytics
3. **Cascade Logic**: Control what happens when relationships are removed
4. **Integration Points**: Hook into external systems

### Built-in Strategies

#### TaskNoteStrategy

```typescript
class TaskNoteStrategy extends BaseRelationshipStrategy {
  validate(rel: Relationship): ValidationResult {
    // Require source metadata
    if (!rel.metadata.source) {
      return { valid: false, error: 'source required' };
    }
    return { valid: true };
  }

  async afterAdd(rel: Relationship): Promise<void> {
    // Log for analytics
    console.debug('Task-note relationship created');
  }
}
```

**Use Cases**:
- Task created from note
- Manual task-note linking
- AI-suggested associations

#### TaskSessionStrategy

Handles task-session relationships (tasks extracted from sessions).

#### NoteSessionStrategy

Handles note-session relationships (notes created during sessions).

### Creating Custom Strategies

```typescript
import { BaseRelationshipStrategy } from '@/services/relationshipStrategies/RelationshipStrategy';

class CustomStrategy extends BaseRelationshipStrategy {
  validate(relationship: Relationship): ValidationResult {
    // Custom validation logic
    if (condition) {
      return { valid: false, error: 'reason' };
    }
    return { valid: true };
  }

  async beforeAdd(relationship: Relationship): Promise<void> {
    // Check preconditions
    const canAdd = await checkSomething();
    if (!canAdd) {
      throw new Error('Cannot add relationship');
    }
  }

  async afterAdd(relationship: Relationship): Promise<void> {
    // Update derived data
    await updateCounts(relationship);
  }

  shouldCascadeDelete(relationship: Relationship): boolean {
    // Control cascade behavior
    return relationship.metadata.extra?.owned === true;
  }
}

// Register
relationshipManager.registerStrategy('custom-type', new CustomStrategy());
```

---

## Performance Characteristics

### Time Complexity

| Operation | Time Complexity | Notes |
|-----------|----------------|-------|
| addRelationship | O(1) + O(n) | O(n) for entity load, typically small |
| removeRelationship | O(1) + O(n) | O(n) for entity load |
| getRelationships | O(1) | Index lookup |
| getRelatedEntities | O(n * k) | n = rels, k = entity load time |
| registerStrategy | O(1) | Map insertion |

### Space Complexity

| Component | Space Complexity | Notes |
|-----------|------------------|-------|
| RelationshipIndex | O(3r) | r = relationship count, 3 indexes |
| Storage | O(r) | Persistent storage |
| Strategies | O(s) | s = number of registered strategies |

### Performance Benchmarks

Measured on MacBook Pro M1, Chrome 120:

| Operation | Target | Typical | Max (99th percentile) |
|-----------|--------|---------|---------------------|
| addRelationship | <10ms | 3-5ms | 8ms |
| removeRelationship | <10ms | 3-5ms | 7ms |
| getRelationships | <5ms | 1-2ms | 3ms |
| getRelatedEntities (10) | <50ms | 20-30ms | 45ms |

**Scalability**: Tested up to 100,000 relationships with acceptable performance.

---

## Design Decisions

### Decision 1: Bidirectional by Configuration

**Context**: Should all relationships be bidirectional, or should it vary by type?

**Decision**: Configuration-driven bidirectionality (per relationship type).

**Rationale**:
- Some relationships are naturally one-way (e.g., note-parent)
- Flexibility for future relationship types
- Configuration is declarative and easy to understand

**Trade-offs**:
- More complex logic (must check config)
- Potential for misconfiguration
- But: Better matches real-world semantics

### Decision 2: Store Relationships on Entities

**Context**: Where should relationships be stored?

**Options**:
1. Separate relationships collection
2. Embedded in entity objects
3. Hybrid (both)

**Decision**: Store on entities + maintain separate index.

**Rationale**:
- Fast queries via index
- Easy entity portability (relationships travel with entity)
- Simpler transaction logic (fewer collections to update)
- No join queries needed

**Trade-offs**:
- Duplication (relationships stored twice)
- Must keep index in sync
- But: Index can be rebuilt from entities if needed

### Decision 3: Transactions Over Eventual Consistency

**Context**: Should operations be atomic or eventually consistent?

**Decision**: Atomic transactions (ACID).

**Rationale**:
- Data integrity is critical
- User expectations (if operation succeeds, data is saved)
- Simpler reasoning (no "pending" states)
- Desktop app (no network latency concerns)

**Trade-offs**:
- Slightly slower (commit overhead)
- More complex implementation
- But: Worth it for data safety

### Decision 4: Strategy Pattern for Extensibility

**Context**: How to add relationship-specific logic without bloating core?

**Decision**: Strategy pattern with optional registration.

**Rationale**:
- Open/Closed Principle (open for extension, closed for modification)
- Easy to test strategies in isolation
- No impact on core logic if strategy not registered
- Familiar pattern for developers

**Trade-offs**:
- More files/classes
- Indirection (must look up strategy)
- But: Much more maintainable long-term

### Decision 5: Idempotent Operations

**Context**: Should duplicate operations throw errors?

**Decision**: Idempotent (safe to call multiple times).

**Rationale**:
- Simplifies client code (no need to check before calling)
- Handles race conditions gracefully
- Matches HTTP PUT semantics
- Less error handling needed

**Trade-offs**:
- Must check for duplicates on every call
- Can mask programming errors
- But: Makes API much easier to use

---

## Migration Strategy

### From Legacy Fields to Unified System

The RelationshipManager replaces several legacy fields:

**Legacy**:
```typescript
interface Task {
  noteId?: string;
  sourceNoteId?: string;
  sourceSessionId?: string;
}

interface Note {
  topicId?: string;
  sourceSessionId?: string;
}

interface Session {
  extractedTaskIds?: string[];
  extractedNoteIds?: string[];
}
```

**New**:
```typescript
interface Task {
  relationships?: Relationship[];
}

interface Note {
  relationships?: Relationship[];
}

interface Session {
  relationships?: Relationship[];
}
```

### Migration Process

See `/docs/agent-tasks/F3-migration-service.md` for full migration plan.

**Key Points**:
1. Non-destructive (legacy fields kept temporarily)
2. Idempotent (safe to run multiple times)
3. Validates bidirectional consistency
4. Detects and reports orphaned references
5. Provides dry-run mode
6. Includes rollback capability

---

## Future Enhancements

### Phase 2 (Planned)

1. **Relationship Metadata Enrichment**
   - Automatic confidence decay over time
   - User feedback integration (upvote/downvote)
   - Relationship strength scoring

2. **Advanced Queries**
   - Graph traversal (find all tasks related to notes in topic X)
   - Path finding (shortest path between entities)
   - Similarity queries (find similar relationship patterns)

3. **Cascade Operations**
   - Configurable cascade delete
   - Cascade update (propagate changes)
   - Orphan cleanup utilities

4. **Performance Optimizations**
   - Batch operations API
   - Relationship caching layer
   - Lazy index loading

5. **Analytics & Insights**
   - Relationship density metrics
   - Unused relationship detection
   - Relationship quality scoring

### Phase 3 (Future)

1. **Multi-User Support**
   - Collaborative relationship management
   - Conflict resolution
   - Merge strategies

2. **Real-Time Sync**
   - Cross-device relationship sync
   - Optimistic updates with rollback
   - Offline-first with sync queue

3. **AI-Powered Features**
   - Automatic relationship suggestions
   - Relationship cleanup recommendations
   - Anomaly detection

---

## See Also

- [API Reference](../api/relationship-manager.md)
- [Usage Examples](../examples/relationship-manager-usage.md)
- [Migration Guide](../migration/relationship-migration.md)
- [Type System Documentation](../../src/types/relationships.ts)
