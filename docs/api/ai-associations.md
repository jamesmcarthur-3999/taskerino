# AI Associations API Reference

**Status:** Phase 1 Complete (S2)
**Version:** 2.0.0
**Last Updated:** 2025-10-24

This document provides complete API reference for the AI Associations system, including:
- AIDeduplicationService - Semantic duplicate detection
- Relationship Filters - Query and filter relationships
- Integration patterns with RelationshipManager

---

## Table of Contents

1. [AIDeduplicationService](#aideduplicationservice)
2. [Relationship Filters](#relationship-filters)
3. [Integration Patterns](#integration-patterns)
4. [Type Definitions](#type-definitions)
5. [Examples](#examples)

---

## AIDeduplicationService

The `AIDeduplicationService` provides semantic similarity scoring and duplicate detection for tasks and notes using Levenshtein distance.

### Constructor

```typescript
constructor(storage: StorageAdapter)
```

**Parameters:**
- `storage` - Storage adapter instance (IndexedDB or Tauri FS)

**Example:**
```typescript
import { getStorage } from '@/services/storage';
import { AIDeduplicationService } from '@/services/aiDeduplication';

const storage = await getStorage();
const dedupService = new AIDeduplicationService(storage);
```

---

### findSimilarTasks

Find tasks similar to the given task data.

```typescript
async findSimilarTasks(params: FindSimilarTasksParams): Promise<SimilarityResult<Task>[]>
```

**Parameters:**
```typescript
interface FindSimilarTasksParams {
  title: string;                    // Task title to compare
  description?: string;             // Task description (optional)
  priority?: 'low' | 'medium' | 'high'; // Priority (for weighted matching)
  contextNoteId?: string;           // Scope to tasks from this note
  contextSessionId?: string;        // Scope to tasks from this session
  minSimilarity?: number;           // Minimum threshold (0-1, default 0.7)
  maxResults?: number;              // Maximum results (default 10)
}
```

**Returns:**
```typescript
interface SimilarityResult<Task> {
  entity: Task;          // The similar task
  similarity: number;    // Similarity score (0-1)
  confidence: number;    // Confidence score (0-1)
  reason: string;        // Human-readable explanation
  shouldMerge: boolean;  // Recommended merge?
}
```

**Example:**
```typescript
const similar = await dedupService.findSimilarTasks({
  title: 'Fix login bug',
  description: 'Users cannot log in with email',
  contextNoteId: 'note-123',
  minSimilarity: 0.8
});

if (similar.length > 0) {
  console.log(`Found ${similar.length} similar tasks`);
  console.log(`Best match: ${similar[0].entity.title} (${similar[0].similarity * 100}%)`);
}
```

**Performance:** <100ms for 1000 tasks

---

### findSimilarNotes

Find notes similar to the given note data.

```typescript
async findSimilarNotes(params: FindSimilarNotesParams): Promise<SimilarityResult<Note>[]>
```

**Parameters:**
```typescript
interface FindSimilarNotesParams {
  summary: string;        // Note summary to compare
  content?: string;       // Note content (optional)
  topicId?: string;       // Scope to notes from this topic
  minSimilarity?: number; // Minimum threshold (0-1, default 0.7)
  maxResults?: number;    // Maximum results (default 10)
}
```

**Returns:** `SimilarityResult<Note>[]`

**Example:**
```typescript
const similar = await dedupService.findSimilarNotes({
  summary: 'Meeting with client',
  content: 'Discussed project timeline',
  topicId: 'topic-client-a'
});
```

**Performance:** <100ms for 1000 notes

---

### isTaskDuplicate

Check if a task is a duplicate of an existing task.

```typescript
async isTaskDuplicate(
  title: string,
  description?: string,
  contextNoteId?: string
): Promise<DeduplicationResult>
```

**Returns:**
```typescript
interface DeduplicationResult {
  isDuplicate: boolean;           // Is this a duplicate?
  existingEntityId?: string;      // ID of existing entity (if duplicate)
  similarityScore: number;        // Similarity score (0-1)
  reason: string;                 // Human-readable explanation
  similarEntities: SimilarityResult[]; // All similar entities found
}
```

**Example:**
```typescript
const result = await dedupService.isTaskDuplicate(
  'Fix authentication',
  'Login form not working'
);

if (result.isDuplicate) {
  console.log(`Duplicate of task ${result.existingEntityId}`);
  console.log(`Similarity: ${result.similarityScore * 100}%`);
  // Link to existing task instead of creating new one
} else {
  // Safe to create new task
}
```

**Thresholds:**
- `isDuplicate = true` if similarity >= 0.85

---

### isNoteDuplicate

Check if a note is a duplicate of an existing note.

```typescript
async isNoteDuplicate(
  summary: string,
  content?: string,
  topicId?: string
): Promise<DeduplicationResult>
```

**Example:**
```typescript
const result = await dedupService.isNoteDuplicate(
  'Meeting notes',
  'Discussed project scope',
  'topic-project-a'
);

if (result.isDuplicate) {
  // Update existing note instead of creating new one
}
```

**Thresholds:**
- `isDuplicate = true` if similarity >= 0.8 (lower than tasks)

---

### calculateTextSimilarity

Calculate similarity between two text strings using Levenshtein distance.

```typescript
calculateTextSimilarity(text1: string, text2: string): number
```

**Returns:** Similarity score (0-1) where:
- 1.0 = identical
- 0.9+ = very similar
- 0.7-0.9 = similar
- <0.7 = different

**Example:**
```typescript
const similarity = dedupService.calculateTextSimilarity(
  'Fix login bug',
  'Fix authentication bug'
);
console.log(`Similarity: ${similarity * 100}%`); // ~75%
```

**Performance:** <10ms per comparison

---

### shouldMerge

Determine if two entities should be merged based on similarity and confidence.

```typescript
shouldMerge(
  similarity: number,
  confidence: number,
  entityType: 'task' | 'note' = 'task'
): boolean
```

**Merge Thresholds:**
- **Tasks:** similarity >= 0.9 AND confidence >= 0.8
- **Notes:** similarity >= 0.85 AND confidence >= 0.75

**Example:**
```typescript
const similar = await dedupService.findSimilarTasks({ title: 'Fix bug' });

if (similar.length > 0) {
  const shouldMerge = dedupService.shouldMerge(
    similar[0].similarity,
    similar[0].confidence,
    'task'
  );

  if (shouldMerge) {
    // Automatically merge - very confident
  } else {
    // Show user confirmation dialog
  }
}
```

---

## Relationship Filters

Functions for filtering and sorting relationships based on various criteria.

### filterByConfidence

Filter relationships by minimum confidence threshold.

```typescript
function filterByConfidence(
  relationships: Relationship[],
  minConfidence: number
): Relationship[]
```

**Behavior:**
- AI relationships with confidence >= `minConfidence` are included
- Non-AI relationships (manual, migration, system) are always included

**Example:**
```typescript
import { filterByConfidence } from '@/services/relationshipFilters';

const allRels = relationshipManager.getRelationships({ entityId: 'task-123' });
const highConfidence = filterByConfidence(allRels, 0.8);

console.log(`${highConfidence.length} high-confidence relationships`);
```

---

### filterBySource

Filter relationships by creation source.

```typescript
function filterBySource(
  relationships: Relationship[],
  source: RelationshipSource // 'ai' | 'manual' | 'migration' | 'system'
): Relationship[]
```

**Example:**
```typescript
const aiRels = filterBySource(allRels, 'ai');
const manualRels = filterBySource(allRels, 'manual');
```

---

### filterByDateRange

Filter relationships created within a date range.

```typescript
function filterByDateRange(
  relationships: Relationship[],
  start: Date | string,
  end: Date | string
): Relationship[]
```

**Example:**
```typescript
const today = new Date();
const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

const thisWeek = filterByDateRange(allRels, weekAgo, today);
```

---

### filterByEntity

Filter relationships by entity ID and type.

```typescript
function filterByEntity(
  relationships: Relationship[],
  entityId: string,
  entityType?: EntityType
): Relationship[]
```

**Example:**
```typescript
// All relationships for task-123 (source or target)
const taskRels = filterByEntity(allRels, 'task-123');

// Only relationships where task-123 is the source
const taskAsSource = filterByEntity(allRels, 'task-123', EntityType.TASK);
```

---

### filterCanonical / filterNonCanonical

Filter to only canonical or non-canonical relationships.

```typescript
function filterCanonical(relationships: Relationship[]): Relationship[]
function filterNonCanonical(relationships: Relationship[]): Relationship[]
```

**Example:**
```typescript
// For bidirectional relationships, only get the canonical direction
const canonical = filterCanonical(allRels);
```

---

### sortByConfidence

Sort relationships by confidence score (descending).

```typescript
function sortByConfidence(relationships: Relationship[]): Relationship[]
```

**Example:**
```typescript
const sorted = sortByConfidence([...allRels]);
// Highest confidence first
console.log(sorted[0].metadata.confidence); // e.g., 0.95
```

---

### sortByDate / sortByDateAsc

Sort relationships by creation date.

```typescript
function sortByDate(relationships: Relationship[]): Relationship[] // Newest first
function sortByDateAsc(relationships: Relationship[]): Relationship[] // Oldest first
```

**Example:**
```typescript
const newest = sortByDate([...allRels]);
const oldest = sortByDateAsc([...allRels]);
```

---

### combineFilters

Apply multiple filters in sequence.

```typescript
function combineFilters(
  relationships: Relationship[],
  filters: Array<(rels: Relationship[]) => Relationship[]>
): Relationship[]
```

**Example:**
```typescript
const filtered = combineFilters(allRels, [
  (rels) => filterBySource(rels, 'ai'),
  (rels) => filterByConfidence(rels, 0.8),
  (rels) => filterByDateRange(rels, weekAgo, today),
  (rels) => sortByConfidence(rels)
]);
// AI relationships, high confidence, from this week, sorted
```

---

### getRelationshipStats

Get statistics about a set of relationships.

```typescript
function getRelationshipStats(relationships: Relationship[]): {
  total: number;
  aiCount: number;
  manualCount: number;
  migrationCount: number;
  systemCount: number;
  canonicalCount: number;
  avgConfidence: number;
  minConfidence: number;
  maxConfidence: number;
}
```

**Example:**
```typescript
const stats = getRelationshipStats(allRels);
console.log(`${stats.total} relationships`);
console.log(`${stats.aiCount} AI (avg confidence: ${stats.avgConfidence})`);
console.log(`${stats.manualCount} manual`);
```

---

### groupBySource

Group relationships by source.

```typescript
function groupBySource(
  relationships: Relationship[]
): Map<RelationshipSource, Relationship[]>
```

**Example:**
```typescript
const grouped = groupBySource(allRels);
console.log(`AI: ${grouped.get('ai')?.length || 0}`);
console.log(`Manual: ${grouped.get('manual')?.length || 0}`);
```

---

### groupByEntityType

Group relationships by entity type.

```typescript
function groupByEntityType(
  relationships: Relationship[]
): Map<EntityType, Relationship[]>
```

**Example:**
```typescript
const byType = groupByEntityType(allRels);
console.log(`Task relationships: ${byType.get(EntityType.TASK)?.length || 0}`);
```

---

## Integration Patterns

### Pattern 1: Duplicate Detection Before Creating Task

```typescript
import { relationshipManager } from '@/services/relationshipManager';
import { AIDeduplicationService } from '@/services/aiDeduplication';
import { getStorage } from '@/services/storage';

async function createTaskWithDeduplication(
  taskData: { title: string; description?: string },
  noteId: string
) {
  const storage = await getStorage();
  const dedupService = new AIDeduplicationService(storage);

  // Check for duplicates
  const dedupResult = await dedupService.isTaskDuplicate(
    taskData.title,
    taskData.description,
    noteId
  );

  if (dedupResult.isDuplicate) {
    // Link existing task instead of creating new one
    console.log('Duplicate found, linking to existing task');

    await relationshipManager.addRelationship({
      sourceType: EntityType.TASK,
      sourceId: dedupResult.existingEntityId!,
      targetType: EntityType.NOTE,
      targetId: noteId,
      type: RelationshipType.TASK_NOTE,
      metadata: {
        source: 'ai',
        confidence: dedupResult.similarityScore,
        reasoning: `Linked to existing task (${dedupResult.reason})`,
      },
    });

    return { taskId: dedupResult.existingEntityId, wasDeduped: true };
  }

  // Create new task
  const newTask = await createTask(taskData);

  // Create relationship
  await relationshipManager.addRelationship({
    sourceType: EntityType.TASK,
    sourceId: newTask.id,
    targetType: EntityType.NOTE,
    targetId: noteId,
    type: RelationshipType.TASK_NOTE,
    metadata: {
      source: 'ai',
      confidence: 0.9,
      reasoning: 'Task extracted from note',
    },
  });

  return { taskId: newTask.id, wasDeduped: false };
}
```

---

### Pattern 2: Querying High-Confidence AI Relationships

```typescript
import { filterBySource, filterByConfidence, sortByConfidence } from '@/services/relationshipFilters';

function getHighConfidenceAIRelationships(entityId: string, minConfidence = 0.8) {
  // Get all relationships for entity
  const allRels = relationshipManager.getRelationships({ entityId });

  // Filter to high-confidence AI relationships
  const aiRels = filterBySource(allRels, 'ai');
  const highConfidence = filterByConfidence(aiRels, minConfidence);
  const sorted = sortByConfidence(highConfidence);

  return sorted;
}
```

---

### Pattern 3: Batch Task Extraction with Deduplication

```typescript
async function extractTasksFromNote(
  noteId: string,
  extractedTasks: Array<{ title: string; description: string }>
) {
  const storage = await getStorage();
  const dedupService = new AIDeduplicationService(storage);

  const results = {
    created: [] as string[],
    linked: [] as string[],
    skipped: [] as string[],
  };

  for (const extracted of extractedTasks) {
    const dedupResult = await dedupService.isTaskDuplicate(
      extracted.title,
      extracted.description,
      noteId
    );

    if (dedupResult.isDuplicate) {
      // Link to existing task
      await relationshipManager.addRelationship({
        sourceType: EntityType.TASK,
        sourceId: dedupResult.existingEntityId!,
        targetType: EntityType.NOTE,
        targetId: noteId,
        type: RelationshipType.TASK_NOTE,
        metadata: {
          source: 'ai',
          confidence: dedupResult.similarityScore,
          reasoning: dedupResult.reason,
        },
      });

      results.linked.push(dedupResult.existingEntityId!);
    } else {
      // Create new task
      const newTask = await createTask(extracted);

      await relationshipManager.addRelationship({
        sourceType: EntityType.TASK,
        sourceId: newTask.id,
        targetType: EntityType.NOTE,
        targetId: noteId,
        type: RelationshipType.TASK_NOTE,
        metadata: {
          source: 'ai',
          confidence: 0.9,
          reasoning: 'Extracted from note',
        },
      });

      results.created.push(newTask.id);
    }
  }

  return results;
}
```

---

## Type Definitions

### SimilarityResult<T>

```typescript
interface SimilarityResult<T = Task | Note> {
  entity: T;
  similarity: number;    // 0-1
  confidence: number;    // 0-1
  reason: string;
  shouldMerge: boolean;
}
```

### DeduplicationResult

```typescript
interface DeduplicationResult {
  isDuplicate: boolean;
  existingEntityId?: string;
  similarityScore: number;
  reason: string;
  similarEntities: SimilarityResult[];
}
```

### FindSimilarTasksParams

```typescript
interface FindSimilarTasksParams {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  contextNoteId?: string;
  contextSessionId?: string;
  minSimilarity?: number;   // Default: 0.7
  maxResults?: number;      // Default: 10
}
```

### FindSimilarNotesParams

```typescript
interface FindSimilarNotesParams {
  summary: string;
  content?: string;
  topicId?: string;
  minSimilarity?: number;   // Default: 0.7
  maxResults?: number;      // Default: 10
}
```

---

## Performance Targets

| Operation | Target | Measured |
|-----------|--------|----------|
| Similarity calculation | <10ms per comparison | ✓ |
| findSimilarTasks (1000 tasks) | <100ms | ✓ |
| findSimilarNotes (1000 notes) | <100ms | ✓ |
| filterByConfidence (10k rels) | <5ms | ✓ |
| sortByConfidence (10k rels) | <5ms | ✓ |

---

## Error Handling

### Common Errors

**Invalid confidence value:**
```typescript
filterByConfidence(rels, 1.5); // Error: minConfidence must be between 0 and 1
```

**Storage not initialized:**
```typescript
// Ensure storage is initialized before creating service
const storage = await getStorage();
const dedupService = new AIDeduplicationService(storage);
```

---

## Best Practices

1. **Always check for duplicates before creating AI-suggested tasks**
   ```typescript
   const dedupResult = await dedupService.isTaskDuplicate(title, description);
   if (!dedupResult.isDuplicate) {
     // Safe to create
   }
   ```

2. **Use context-aware matching when possible**
   ```typescript
   findSimilarTasks({ title, contextNoteId }); // More accurate
   ```

3. **Capture AI confidence and reasoning in metadata**
   ```typescript
   metadata: {
     source: 'ai',
     confidence: 0.95,
     reasoning: 'Task mentions same bug report',
   }
   ```

4. **Filter by confidence threshold in UI**
   ```typescript
   const highConfidence = filterByConfidence(allRels, 0.8);
   // Show these prominently
   ```

5. **Combine filters for complex queries**
   ```typescript
   combineFilters(allRels, [
     (r) => filterBySource(r, 'ai'),
     (r) => filterByConfidence(r, 0.75),
     (r) => sortByDate(r),
   ]);
   ```

---

## Migration Notes

### From Legacy System

**Before (Legacy):**
```typescript
task.noteId = note.id;
task.sourceSessionId = session.id;
```

**After (New System):**
```typescript
await relationshipManager.addRelationship({
  sourceType: EntityType.TASK,
  sourceId: task.id,
  targetType: EntityType.NOTE,
  targetId: note.id,
  type: RelationshipType.TASK_NOTE,
  metadata: {
    source: 'ai',
    confidence: 0.95,
    reasoning: 'Task extracted from note',
  },
});
```

---

## See Also

- [Architecture: AI Deduplication](../architecture/ai-deduplication.md)
- [Usage Examples](../examples/ai-associations-usage.md)
- [Relationship System Master Plan](../RELATIONSHIP_SYSTEM_MASTER_PLAN.md)
- [S1: Relationship Manager](../agent-tasks/S1-relationship-manager.md)
- [S2: AI Associations](../agent-tasks/S2-ai-associations.md)
