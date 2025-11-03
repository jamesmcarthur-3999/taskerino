# Relationship System - Developer Guide

**Last Updated**: November 2, 2025
**Version**: 1.0 (Phase 7 - 90% Complete)
**Status**: Production-Ready Foundation

---

## Quick Start

### For New Developers

**Need to add a relationship?**
```typescript
import { useRelationships } from '@/context/RelationshipsContext';

const { addRelationship } = useRelationships();

// Link task to note
await addRelationship({
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note',
  targetId: 'note-456',
  relationshipType: 'references'
});
// Automatically bidirectional - note now references task too!
```

**Need to show relationships in UI?**
```typescript
import { RelationshipPills } from '@/components/relationships/RelationshipPills';

<RelationshipPills
  entityType="task"
  entityId="task-123"
  onAdd={() => setShowModal(true)}
/>
```

**Need to query relationships?**
```typescript
import { useRelationships } from '@/context/RelationshipsContext';

const { getRelationships } = useRelationships();

// Get all notes related to this task
const relatedNotes = getRelationships({
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note'
});
```

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Concepts](#core-concepts)
3. [API Reference](#api-reference)
4. [UI Components](#ui-components)
5. [Implementation Status](#implementation-status)
6. [Best Practices](#best-practices)
7. [Migration Guide](#migration-guide)
8. [Advanced Topics](#advanced-topics)

---

## Architecture Overview

### Design Principles

1. **Automatic Bidirectional Sync** - Add A→B, automatically get B→A
2. **Type-Safe** - Full TypeScript support with branded types
3. **Atomic** - All operations use transactions (all succeed or all fail)
4. **Scalable** - Plugin architecture for new entity types
5. **Performance** - O(1) lookups via RelationshipIndex

### System Components

```
┌─────────────────────────────────────────────────┐
│           RelationshipsContext                   │
│  - Bidirectional sync                           │
│  - Transaction management                       │
│  - Event emission                               │
└─────────────┬───────────────────────────────────┘
              │
              ├──→ RelationshipIndex (O(1) lookups)
              ├──→ RelationshipManager (CRUD + sync)
              ├──→ TransactionManager (ACID guarantees)
              └──→ Storage Adapters (IndexedDB/Tauri FS)
```

### Entity Types

Currently supported:
- `task` ↔ `note`, `session`, `task` (subtasks)
- `note` ↔ `task`, `session`, `note` (linked notes)
- `session` ↔ `task`, `note`
- `topic` ↔ `task`, `note`, `session` (metadata anchor)
- `company` ↔ `task`, `note`, `session` (metadata anchor)
- `contact` ↔ `task`, `note`, `session` (metadata anchor)

### Relationship Types

- `references` - Generic reference (default)
- `blocks` - Task A blocks Task B
- `blocked_by` - Task A blocked by Task B (auto-inverse of `blocks`)
- `related_to` - Generic relation
- `child_of` - Subtask relationship
- `parent_of` - Parent task (auto-inverse of `child_of`)

---

## Core Concepts

### 1. Bidirectional Sync

**The Golden Rule**: Every relationship is automatically bidirectional.

```typescript
// Add A→B
await addRelationship({
  sourceType: 'task',
  sourceId: 'A',
  targetType: 'note',
  targetId: 'B',
  relationshipType: 'references'
});

// B→A is automatically created!
const reverseRel = getRelationships({
  sourceType: 'note',
  sourceId: 'B',
  targetType: 'task'
});
// Returns: [{ sourceId: 'B', targetId: 'A', ... }]
```

**Auto-Inverse Types**:
- `blocks` ↔ `blocked_by`
- `child_of` ↔ `parent_of`
- `references` ↔ `references` (symmetric)

### 2. Transactions

All relationship operations are atomic:

```typescript
const tx = await relationshipManager.beginTransaction();
try {
  await tx.addRelationship(rel1);
  await tx.addRelationship(rel2);
  await tx.removeRelationship(rel3);

  await tx.commit(); // All succeed or all fail
} catch (error) {
  await tx.rollback(); // Restore previous state
}
```

**Built-in Rollback**: The context handles this automatically for you.

### 3. Type Safety

```typescript
import { EntityType, RelationshipType, Relationship } from '@/types/relationships';

// Branded types prevent mixing IDs
type TaskId = string & { __brand: 'TaskId' };
type NoteId = string & { __brand: 'NoteId' };

// TypeScript catches this at compile time:
const taskId: TaskId = 'task-123' as TaskId;
const noteId: NoteId = taskId; // ❌ Type error!
```

### 4. Performance

**RelationshipIndex** provides O(1) lookups:

```typescript
// Instant - no array filtering!
const taskNotes = index.getBySource('task', 'task-123', 'note');
const noteTasks = index.getByTarget('note', 'note-456', 'task');
```

**Indexing Structure**:
```
bySource: Map<'task:123:note', Set<Relationship>>
byTarget: Map<'note:456:task', Set<Relationship>>
byType: Map<'references', Set<Relationship>>
```

---

## API Reference

### RelationshipsContext

```typescript
import { useRelationships } from '@/context/RelationshipsContext';

const {
  // State
  relationships,        // All relationships
  loading,             // Loading state
  error,               // Error state

  // CRUD Operations
  addRelationship,     // Add bidirectional relationship
  removeRelationship,  // Remove bidirectional relationship
  updateRelationship,  // Update metadata (preserves sync)

  // Queries
  getRelationships,    // Query with filters
  getRelatedEntities,  // Get full entity objects

  // Utilities
  hasRelationship,     // Check if relationship exists
  getRelationshipCount // Count relationships for entity
} = useRelationships();
```

### addRelationship

```typescript
await addRelationship({
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note',
  targetId: 'note-456',
  relationshipType: 'references', // optional, defaults to 'references'
  metadata: {                     // optional
    createdBy: 'user',
    confidence: 0.95,
    source: 'manual'
  }
});
```

**Returns**: `Promise<void>`
**Throws**: `RelationshipError` if validation fails
**Side Effects**: Creates bidirectional relationship, emits `relationship-added` event

### removeRelationship

```typescript
await removeRelationship({
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note',
  targetId: 'note-456'
});
```

**Side Effects**: Removes both directions, emits `relationship-removed` event

### getRelationships

```typescript
const results = getRelationships({
  sourceType: 'task',      // optional
  sourceId: 'task-123',    // optional
  targetType: 'note',      // optional
  targetId: 'note-456',    // optional
  relationshipType: 'references' // optional
});
```

**Returns**: `Relationship[]`
**Performance**: O(1) if sourceId or targetId provided, O(n) otherwise

### getRelatedEntities

```typescript
const notes = await getRelatedEntities({
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note'
});
// Returns: Note[] (full note objects, not just IDs)
```

**Returns**: `Promise<Entity[]>`
**Performance**: O(1) index lookup + O(k) entity fetches (k = # of relationships)

---

## UI Components

### RelationshipPills

Display inline pills with add/remove functionality:

```typescript
import { RelationshipPills } from '@/components/relationships/RelationshipPills';

<RelationshipPills
  entityType="task"
  entityId="task-123"
  targetType="note"              // optional - show all if omitted
  onAdd={() => setShowModal(true)}
  onRemove={(relId) => handleRemove(relId)}
  maxPills={5}                   // optional - show "and X more"
/>
```

**Features**:
- Click to navigate to related entity
- Hover shows entity preview
- Add button opens modal
- Remove button (X) with confirmation
- "and 3 more" overflow handling

### RelationshipModal

Full relationship management modal:

```typescript
import { RelationshipModal } from '@/components/relationships/RelationshipModal';

<RelationshipModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  entityType="task"
  entityId="task-123"
  initialTab="notes"             // optional - 'notes' | 'tasks' | 'sessions'
/>
```

**Features**:
- Tabbed interface (Notes, Tasks, Sessions)
- Search with autocomplete
- Create new entity inline
- Bulk add/remove
- Relationship type selector
- Real-time sync

### RelationshipCardSection

Embedded card section for detail views:

```typescript
import { RelationshipCardSection } from '@/components/relationships/RelationshipCardSection';

<RelationshipCardSection
  entityType="task"
  entityId="task-123"
  sectionTitle="Related Notes"
  targetType="note"
  emptyMessage="No related notes"
  showAddButton={true}
/>
```

**Features**:
- Compact card layout
- Inline add button
- Entity previews
- Quick navigation

---

## Implementation Status

### Phase 0: Foundation (Complete ✅)
- RelationshipsContext with bidirectional sync
- RelationshipIndex for O(1) lookups
- TransactionManager for ACID guarantees
- 71 tests passing

### Phase 1: Core UI (Complete ✅)
- RelationshipPills component
- RelationshipModal component
- RelationshipCardSection component
- Integration with TaskDetailView, NoteDetailView

### Phase 2: AI Integration (Complete ✅)
- AIDeduplicationService integration
- Automatic relationship suggestions
- Confidence scoring
- Smart merge detection

### Phase 3: Advanced Features (In Progress - 60%)
- Subtask relationships (✅ Complete)
- Blocked/blocking relationships (✅ Complete)
- Circular dependency detection (⏳ In Progress)
- Relationship strength scoring (⏳ In Progress)

### Phase 4: Migration (Pending)
- Backward-compatible data migration
- Relationship validation and repair
- Performance optimization
- Documentation updates

### Phase 5: Polish (Pending)
- Accessibility improvements
- Keyboard shortcuts
- Undo/redo support
- Advanced filtering

---

## Best Practices

### 1. Always Use Transactions for Bulk Operations

```typescript
// ❌ BAD - Multiple separate transactions
await addRelationship(rel1);
await addRelationship(rel2);
await addRelationship(rel3);

// ✅ GOOD - Single atomic transaction
await relationshipManager.batchAdd([rel1, rel2, rel3]);
```

### 2. Use Type-Specific Queries for Performance

```typescript
// ❌ SLOW - O(n) filter
const all = getRelationships({});
const taskNotes = all.filter(r =>
  r.sourceType === 'task' && r.targetType === 'note'
);

// ✅ FAST - O(1) index lookup
const taskNotes = getRelationships({
  sourceType: 'task',
  targetType: 'note'
});
```

### 3. Handle Relationship Events for Real-Time UI

```typescript
useEffect(() => {
  const handleAdded = (event: RelationshipEvent) => {
    if (event.relationship.sourceId === currentTaskId) {
      refreshRelatedNotes();
    }
  };

  eventBus.on('relationship-added', handleAdded);
  return () => eventBus.off('relationship-added', handleAdded);
}, [currentTaskId]);
```

### 4. Validate Before Adding Relationships

```typescript
// ✅ GOOD - Check existence first
const exists = hasRelationship({
  sourceType: 'task',
  sourceId: taskId,
  targetType: 'note',
  targetId: noteId
});

if (!exists) {
  await addRelationship({ ... });
}
```

### 5. Use Relationship Metadata for Context

```typescript
await addRelationship({
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note',
  targetId: 'note-456',
  metadata: {
    createdBy: 'ai',           // 'user' | 'ai' | 'system'
    confidence: 0.85,          // AI confidence score
    source: 'deduplication',   // How was this created?
    createdAt: Date.now()
  }
});
```

---

## Migration Guide

### From Old Relationship System (Pre-Phase 7)

**Old Pattern** (Array-based, manual sync):
```typescript
// ❌ OLD
const task = await getTask(taskId);
task.noteIds.push(noteId);
await updateTask(task);

// Manual reverse sync
const note = await getNote(noteId);
note.taskIds.push(taskId);
await updateNote(note);
```

**New Pattern** (Automatic bidirectional):
```typescript
// ✅ NEW
await addRelationship({
  sourceType: 'task',
  sourceId: taskId,
  targetType: 'note',
  targetId: noteId
});
// Reverse sync is automatic!
```

### Accessing Relationships

**Old**:
```typescript
const task = await getTask(taskId);
const noteIds = task.noteIds;
const notes = await Promise.all(noteIds.map(id => getNote(id)));
```

**New**:
```typescript
const notes = await getRelatedEntities({
  sourceType: 'task',
  sourceId: taskId,
  targetType: 'note'
});
```

### Compatibility Layer

For gradual migration, both systems currently coexist:

```typescript
// Old fields still populated for backward compatibility
task.noteIds = [...]  // Populated from relationships
task.sessionId = '...' // Populated from relationships

// New system (preferred)
const notes = await getRelatedEntities({ ... });
```

**Timeline**: Old fields will be removed in v2.0 (6+ months).

---

## Advanced Topics

### Custom Relationship Types

Add new relationship types in `/src/types/relationships.ts`:

```typescript
export type RelationshipType =
  | 'references'
  | 'blocks'
  | 'blocked_by'
  | 'my_custom_type';  // Add here

// Define inverse if bidirectional
export const INVERSE_RELATIONSHIPS: Record<RelationshipType, RelationshipType> = {
  blocks: 'blocked_by',
  blocked_by: 'blocks',
  my_custom_type: 'my_custom_type', // Symmetric
};
```

### Extending Entity Types

Add support for new entities (e.g., `project`):

1. Update type definitions:
```typescript
// types/relationships.ts
export type EntityType = 'task' | 'note' | 'session' | 'project';
```

2. Implement entity adapter:
```typescript
// adapters/ProjectRelationshipAdapter.ts
export class ProjectRelationshipAdapter implements RelationshipAdapter {
  async getEntity(id: string): Promise<Project> { ... }
  async updateRelationships(id: string, relationships: Relationship[]): Promise<void> { ... }
}
```

3. Register adapter:
```typescript
// context/RelationshipsContext.tsx
const adapters = {
  task: new TaskRelationshipAdapter(),
  note: new NoteRelationshipAdapter(),
  session: new SessionRelationshipAdapter(),
  project: new ProjectRelationshipAdapter(),
};
```

### Relationship Strength Scoring

Coming in Phase 3 - Automatic scoring based on:
- Frequency of interaction
- Recency of updates
- User confirmation
- AI confidence

```typescript
// Future API
const strongRelationships = getRelationships({
  sourceType: 'task',
  sourceId: taskId,
  minStrength: 0.7 // Only strong relationships
});
```

---

## Detailed Documentation

For comprehensive implementation details, see:

- **Master Plan**: `/docs/RELATIONSHIP_SYSTEM_MASTER_PLAN.md` (2,754 lines)
  - Complete phase breakdown (Phases 0-5)
  - Agent task specifications
  - Risk management
  - Progress tracking

- **Card Specifications**: `/docs/RELATIONSHIP_CARD_SPECIFICATIONS.md` (1,735 lines)
  - Detailed UI component specs
  - Interaction patterns
  - Visual design guidelines

- **UI Integration**: `/docs/RELATIONSHIP_UI_INTEGRATION.md` (317 lines)
  - Integration points
  - Component usage examples
  - Migration patterns

---

## Quick Reference

### Common Operations

| Operation | Code |
|-----------|------|
| Link task to note | `addRelationship({ sourceType: 'task', sourceId, targetType: 'note', targetId })` |
| Get task's notes | `getRelatedEntities({ sourceType: 'task', sourceId, targetType: 'note' })` |
| Remove relationship | `removeRelationship({ sourceType, sourceId, targetType, targetId })` |
| Check if exists | `hasRelationship({ sourceType, sourceId, targetType, targetId })` |
| Count relationships | `getRelationshipCount({ entityType: 'task', entityId })` |

### Event Names

- `relationship-added`
- `relationship-removed`
- `relationship-updated`
- `relationships-synced`

### File Locations

- Context: `/src/context/RelationshipsContext.tsx`
- Types: `/src/types/relationships.ts`
- Index: `/src/services/relationships/RelationshipIndex.ts`
- Manager: `/src/services/relationships/RelationshipManager.ts`
- UI: `/src/components/relationships/`

---

## Support

**Questions?** Check the detailed docs:
- [Master Plan](./RELATIONSHIP_SYSTEM_MASTER_PLAN.md)
- [Card Specs](./RELATIONSHIP_CARD_SPECIFICATIONS.md)
- [UI Integration](./RELATIONSHIP_UI_INTEGRATION.md)

**Found a bug?** See `/docs/developer/TODO_TRACKER.md`

**Contributing?** Read [CLAUDE.md](./CLAUDE.md) first
