# Unified Relationship Type System

**Version:** 2.0.0
**Status:** Phase 1 Complete
**Last Updated:** October 24, 2025

## Overview

The unified relationship type system is the foundational architecture for managing connections between entities in Taskerino. It replaces the previous fragmented approach (where relationships were stored as individual ID fields like `noteId`, `sourceSessionId`, etc.) with a unified, extensible, graph-based relationship model.

### Key Goals

1. **Unification**: Single system for all entity relationships
2. **Extensibility**: Easy to add new relationship types and entity types
3. **Transparency**: Rich metadata showing how/why relationships were created
4. **Migration Safety**: Backward compatible with legacy field structure
5. **Type Safety**: Compile-time validation of relationship rules

## Architecture Principles

### 1. Graph-Based Model

Relationships are modeled as **directed edges** in a graph:

```
Task ──[TASK_NOTE]──> Note
  │
  └──[TASK_SESSION]──> Session
```

Each relationship has:
- **Source** (origin entity)
- **Target** (destination entity)
- **Type** (semantic meaning)
- **Metadata** (provenance, confidence, reasoning)
- **Canonical flag** (for bidirectional relationships)

### 2. Type-Driven Configuration

Every relationship type is defined in `RELATIONSHIP_CONFIGS`, which acts as the single source of truth for:

- **Validation**: Which entity types can participate
- **Behavior**: Bidirectional support, cascade delete rules
- **Display**: UI colors, icons, display names

This configuration-driven approach means:
- ✅ Adding new relationship types is straightforward (just add a config entry)
- ✅ UI automatically adapts to new relationship types
- ✅ Validation rules are centralized and consistent

### 3. Bidirectional Relationships

Many relationships are semantically bidirectional (e.g., Task→Note also implies Note→Task). The system handles this through:

- **Canonical direction**: One direction is marked `canonical=true`
- **Inverse direction**: Auto-generated with `canonical=false`
- **Automatic creation**: Creating A→B automatically creates B→A if `bidirectional=true`

Example:
```typescript
// User creates: Task → Note (canonical=true)
{
  id: 'rel_1',
  type: 'task-note',
  sourceType: 'task',
  sourceId: 'task_123',
  targetType: 'note',
  targetId: 'note_456',
  canonical: true,  // This is the primary relationship
}

// System auto-creates: Note → Task (canonical=false)
{
  id: 'rel_2',
  type: 'task-note',
  sourceType: 'note',
  sourceId: 'note_456',
  targetType: 'task',
  targetId: 'task_123',
  canonical: false,  // This is the inverse
}
```

### 4. Rich Metadata for AI Transparency

Every relationship includes metadata explaining its creation:

```typescript
metadata: {
  source: 'ai' | 'manual' | 'migration' | 'system',
  confidence?: number,      // AI confidence (0-1)
  reasoning?: string,       // Why AI created this
  createdAt: string,        // ISO 8601 timestamp
  createdBy?: string,       // User ID for manual creation
  extra?: Record<string, unknown>,  // Extensible metadata
}
```

This transparency is critical for:
- **User trust**: Users can see why AI suggested a relationship
- **Debugging**: Track down why incorrect relationships were created
- **Learning**: ML models can learn from user feedback (confirm/reject)

## Core Types

### RelationshipType Enum

Defines all possible relationship types. Currently includes:

**Phase 1 (Current)**:
- `TASK_NOTE` - Task created from or linked to a note
- `TASK_SESSION` - Task extracted from a session
- `NOTE_SESSION` - Note created during a session
- `TASK_TOPIC` - Task categorized under a topic
- `NOTE_TOPIC` - Note categorized under a topic
- `NOTE_COMPANY` - Note linked to a company
- `NOTE_CONTACT` - Note linked to a contact/person
- `NOTE_PARENT` - Note is a child of another note (threading)

**Phase 2+ (Future)**:
- `TASK_FILE` - Task linked to a file attachment
- `NOTE_FILE` - Note linked to a file attachment
- `SESSION_FILE` - Session linked to a file attachment
- `TASK_TASK` - Task depends on another task (dependency graph)
- `PROJECT_TASK` - Project contains a task
- `PROJECT_NOTE` - Project contains a note
- `GOAL_TASK` - Goal tracks a task

### EntityType Enum

Defines all entity types that can participate in relationships:

**Current**: `TASK`, `NOTE`, `SESSION`, `TOPIC`, `COMPANY`, `CONTACT`
**Future**: `FILE`, `PROJECT`, `GOAL`

### Relationship Interface

The core relationship data structure:

```typescript
interface Relationship {
  id: string;                    // Unique relationship ID
  type: RelationshipType;        // Type of relationship
  sourceType: EntityType;        // Source entity type
  sourceId: string;              // Source entity ID
  targetType: EntityType;        // Target entity type
  targetId: string;              // Target entity ID
  metadata: RelationshipMetadata; // Provenance and context
  canonical: boolean;            // Is this the primary direction?
}
```

### RelationshipTypeConfig Interface

Configuration for each relationship type:

```typescript
interface RelationshipTypeConfig {
  type: RelationshipType;
  sourceTypes: EntityType[];     // Allowed source types
  targetTypes: EntityType[];     // Allowed target types
  bidirectional: boolean;        // Auto-create inverse?
  cascadeDelete: boolean;        // Delete target when source deleted?
  displayName: string;           // UI display name
  icon?: string;                 // Lucide icon name
  color?: string;                // Tailwind color (hex)
}
```

## Migration Strategy

The type system supports **zero-downtime migration** from legacy fields:

### Phase 1: Add New Fields (✅ Complete)

```typescript
interface Task {
  // NEW: Unified relationship system
  relationships?: Relationship[];
  relationshipVersion?: number;  // 0=legacy, 1=migrated

  // LEGACY: Deprecated but still functional
  noteId?: string;               // @deprecated
  sourceNoteId?: string;         // @deprecated
  sourceSessionId?: string;      // @deprecated
}
```

### Phase 2: Dual-Write (Planned)

When creating/updating entities:
1. Write to **both** legacy fields AND relationships array
2. Set `relationshipVersion = 1` to mark as migrated
3. Old code continues to work with legacy fields
4. New code prefers relationships array

### Phase 3: Migrate Data (Planned)

Background job to migrate existing data:
```typescript
// Convert legacy fields to relationships
if (task.noteId && !task.relationships) {
  task.relationships = [
    createRelationship({
      type: RelationshipType.TASK_NOTE,
      source: { type: EntityType.TASK, id: task.id },
      target: { type: EntityType.NOTE, id: task.noteId },
      metadata: { source: 'migration', ... },
    })
  ];
  task.relationshipVersion = 1;
}
```

### Phase 4: Remove Legacy Fields (Future)

Once all data is migrated and old code is updated:
1. Remove `@deprecated` fields from types
2. Clean up legacy storage

## Usage Examples

### Creating a Relationship

```typescript
import { RelationshipType, EntityType } from '@/types/relationships';

const relationship: Relationship = {
  id: crypto.randomUUID(),
  type: RelationshipType.TASK_NOTE,
  sourceType: EntityType.TASK,
  sourceId: task.id,
  targetType: EntityType.NOTE,
  targetId: note.id,
  metadata: {
    source: 'ai',
    confidence: 0.95,
    reasoning: 'Task title matches note content',
    createdAt: new Date().toISOString(),
  },
  canonical: true,
};

task.relationships = [...(task.relationships || []), relationship];
```

### Querying Relationships

```typescript
// Get all notes related to a task
function getRelatedNotes(task: Task): string[] {
  if (!task.relationships) return [];

  return task.relationships
    .filter(rel =>
      rel.type === RelationshipType.TASK_NOTE &&
      rel.targetType === EntityType.NOTE
    )
    .map(rel => rel.targetId);
}

// Get canonical relationships only
function getCanonicalRelationships(entity: Task | Note | Session) {
  return entity.relationships?.filter(rel => rel.canonical) || [];
}
```

### Validating Relationships

```typescript
import { validateRelationshipTypes } from '@/types/relationships';

const valid = validateRelationshipTypes(
  RelationshipType.TASK_NOTE,
  EntityType.TASK,
  EntityType.NOTE
);

if (!valid) {
  throw new Error('Invalid relationship type combination');
}
```

### Using Display Configuration

```typescript
import { getDisplayConfig } from '@/types/relationships';

const display = getDisplayConfig(RelationshipType.TASK_NOTE);

// In React component:
<div style={{ color: display.color }}>
  <Icon name={display.icon} />
  <span>{display.displayName}</span>
</div>
```

## Design Decisions

### 1. Why Directed Graphs?

**Decision**: Use directed edges (source→target) instead of undirected.

**Rationale**:
- Many relationships have natural directionality (Task "created from" Note)
- Allows expressing asymmetric relationships (parent→child)
- Easier to reason about and query
- Bidirectional support is opt-in via config

### 2. Why Canonical Flag?

**Decision**: Mark one direction as "canonical" for bidirectional relationships.

**Rationale**:
- Prevents duplicate data in UI listings
- Determines which metadata is authoritative
- Simplifies queries ("show me canonical relationships only")
- Allows efficient indexing

### 3. Why Rich Metadata?

**Decision**: Include extensive metadata (source, confidence, reasoning) in every relationship.

**Rationale**:
- **User Trust**: Users need to understand AI decisions
- **Debugging**: Essential for tracking down bad relationships
- **Learning**: ML models need feedback data
- **Compliance**: May be required for audit trails

### 4. Why Config-Driven?

**Decision**: Store relationship rules in `RELATIONSHIP_CONFIGS` instead of hardcoding logic.

**Rationale**:
- **Extensibility**: Adding new types is trivial
- **Consistency**: All relationship types follow same patterns
- **UI Automation**: Display properties drive rendering
- **Validation**: Type checking ensures configs are complete

### 5. Why No Cascade Delete?

**Decision**: Set `cascadeDelete=false` for all Phase 1 relationships.

**Rationale**:
- **Safety**: Accidental deletes could lose important data
- **User Expectation**: Users don't expect deleting a task to delete the note
- **Reversibility**: Non-destructive operations are safer
- **Future Flexibility**: Can enable per-type later if needed

## Extensibility

### Adding a New Relationship Type

To add a new relationship type (e.g., `NOTE_FILE`):

1. **Add to enum** (already done for future types):
```typescript
export enum RelationshipType {
  // ...existing types...
  NOTE_FILE = 'note-file',
}
```

2. **Add config entry**:
```typescript
export const RELATIONSHIP_CONFIGS = {
  // ...existing configs...
  [RelationshipType.NOTE_FILE]: {
    type: RelationshipType.NOTE_FILE,
    sourceTypes: [EntityType.NOTE],
    targetTypes: [EntityType.FILE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'File',
    icon: 'File',
    color: '#64748B',
  },
};
```

3. **UI automatically adapts** - no other changes needed!

### Adding a New Entity Type

To add a new entity type (e.g., `PROJECT`):

1. **Add to enum**:
```typescript
export enum EntityType {
  // ...existing types...
  PROJECT = 'project',
}
```

2. **Create interface** (in `src/types.ts`):
```typescript
export interface Project {
  id: string;
  // ...other fields...
  relationships?: Relationship[];
  relationshipVersion?: number;
}
```

3. **Add relationship types** that use the new entity (see above).

## Performance Considerations

### Indexing

For efficient queries, index relationships by:
- `sourceId` - Find all relationships originating from an entity
- `targetId` - Find all relationships pointing to an entity
- `type` - Filter by relationship type
- `canonical` - Query only canonical relationships

### Storage

Relationships are stored:
- **In-memory**: As arrays on entity objects (`task.relationships`)
- **Persisted**: Alongside entity data in storage (IndexedDB/filesystem)
- **Denormalized**: Each entity has its own relationship array (no separate table)

This denormalized approach trades some storage space for:
- ✅ Fast queries (no joins needed)
- ✅ Simple persistence (save entity = save relationships)
- ✅ Easy migrations (copy relationships with entity)

## Testing Strategy

Tests cover:

1. **Type Inference**: Verify TypeScript correctly infers types
2. **Config Validation**: Every RelationshipType has a config
3. **Helper Functions**: Validate, query, and display helpers work correctly
4. **Backward Compatibility**: Legacy Task/Note/Session structures still work
5. **Edge Cases**: Empty metadata, self-referential relationships, etc.

Target: **>85% coverage** for type system code.

## Future Enhancements

### Phase 2: Graph Queries

Implement graph traversal utilities:
```typescript
// Find all entities connected to this task (any relationship type)
const connected = graphQuery(task)
  .traverse({ maxDepth: 2 })
  .exclude([EntityType.TOPIC])
  .execute();
```

### Phase 3: Relationship History

Track relationship changes over time:
```typescript
interface RelationshipHistory {
  relationshipId: string;
  event: 'created' | 'deleted' | 'modified';
  timestamp: string;
  actor: string;
}
```

### Phase 4: Smart Suggestions

Use ML to suggest relationships based on:
- Content similarity
- User behavior patterns
- Relationship graph structure

### Phase 5: Relationship Strength

Add `strength` field to represent relationship importance:
```typescript
interface Relationship {
  // ...existing fields...
  strength?: number;  // 0-1, how important is this relationship?
}
```

## Appendix: Complete Type Definitions

See `src/types/relationships.ts` for the complete, authoritative type definitions.

Key files:
- `src/types/relationships.ts` - Core relationship type system
- `src/types.ts` - Entity types with relationship fields
- `src/types/__tests__/relationships.test.ts` - Comprehensive test suite

## References

- **Task Specification**: `/docs/agent-tasks/F1-type-system.md`
- **Migration Guide**: (To be created in Phase 2)
- **API Documentation**: Generated via TypeDoc from JSDoc comments
