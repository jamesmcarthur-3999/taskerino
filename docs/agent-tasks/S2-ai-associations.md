# AGENT TASK S2: AI Association Improvements

**Objective:** Enhance AI association logic with better deduplication and confidence scoring using the relationship system.

**Priority:** P1 (Core Service)

**Dependencies:** S1 (Relationship Manager)

**Complexity:** Medium-High

**Estimated Time:** 8-10 hours

---

## Detailed Requirements

### 1. Update Claude Service to Use RelationshipManager

**File:** `src/services/claudeService.ts`

Update the AI processing pipeline to create relationships through RelationshipManager instead of direct field assignments.

**Before (Legacy):**
```typescript
task.noteId = note.id;
task.sourceSessionId = session?.id;
```

**After (New):**
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
    reasoning: 'Task extracted from note content',
  },
});
```

### 2. Implement Enhanced Deduplication

**File:** `src/services/aiDeduplication.ts`

Create a new service for AI-powered deduplication that uses relationship metadata:

```typescript
export interface DeduplicationResult {
  isDuplicate: boolean;
  existingEntityId?: string;
  similarityScore: number;
  reason: string;
}

export class AIDeduplicationService {
  constructor(
    private relationshipManager: RelationshipManager,
    private storage: StorageService
  ) {}

  /**
   * Check if a proposed task is a duplicate
   * Uses semantic similarity + relationship context
   */
  async isTaskDuplicate(
    taskTitle: string,
    taskDescription: string,
    contextNoteId?: string
  ): Promise<DeduplicationResult> {
    // Step 1: Load existing tasks
    const allTasks = await this.storage.load<Task>('tasks');

    // Step 2: Filter to related tasks if context provided
    let candidateTasks = allTasks;
    if (contextNoteId) {
      const relatedTasks = await this.relationshipManager.getRelatedEntities<Task>(
        contextNoteId,
        RelationshipType.TASK_NOTE
      );
      candidateTasks = relatedTasks;
    }

    // Step 3: Calculate similarity scores
    const similarities = candidateTasks.map(task => ({
      task,
      score: this.calculateSimilarity(
        taskTitle,
        taskDescription,
        task.title,
        task.description
      ),
    }));

    // Step 4: Find best match
    const bestMatch = similarities.reduce((best, current) =>
      current.score > best.score ? current : best
    , { task: null, score: 0 });

    // Step 5: Determine if duplicate (threshold: 0.85)
    const isDuplicate = bestMatch.score >= 0.85;

    return {
      isDuplicate,
      existingEntityId: isDuplicate ? bestMatch.task?.id : undefined,
      similarityScore: bestMatch.score,
      reason: isDuplicate
        ? `Similar task found: "${bestMatch.task?.title}" (${Math.round(bestMatch.score * 100)}% match)`
        : 'No similar task found',
    };
  }

  /**
   * Calculate semantic similarity between two task descriptions
   * Uses embeddings or fuzzy matching
   */
  private calculateSimilarity(
    title1: string,
    desc1: string,
    title2: string,
    desc2: string
  ): number {
    // Implementation: Use embeddings API or fuzzy matching
    // For now, simple string similarity
    const titleSim = this.stringSimilarity(title1, title2);
    const descSim = this.stringSimilarity(desc1 || '', desc2 || '');

    // Weighted average (title more important)
    return titleSim * 0.7 + descSim * 0.3;
  }

  /**
   * Simple string similarity (Levenshtein-based)
   */
  private stringSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(s1: string, s2: string): number {
    // Standard Levenshtein implementation
    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  /**
   * Check if a proposed note is a duplicate
   */
  async isNoteDuplicate(
    noteSummary: string,
    noteContent: string
  ): Promise<DeduplicationResult> {
    // Similar to isTaskDuplicate but for notes
    const allNotes = await this.storage.load<Note>('notes');

    const similarities = allNotes.map(note => ({
      note,
      score: this.calculateSimilarity(
        noteSummary,
        noteContent,
        note.summary,
        note.content
      ),
    }));

    const bestMatch = similarities.reduce((best, current) =>
      current.score > best.score ? current : best
    , { note: null, score: 0 });

    const isDuplicate = bestMatch.score >= 0.80; // Lower threshold for notes

    return {
      isDuplicate,
      existingEntityId: isDuplicate ? bestMatch.note?.id : undefined,
      similarityScore: bestMatch.score,
      reason: isDuplicate
        ? `Similar note found: "${bestMatch.note?.summary}" (${Math.round(bestMatch.score * 100)}% match)`
        : 'No similar note found',
    };
  }
}
```

### 3. Update Sessions Agent Service

**File:** `src/services/sessionsAgentService.ts`

Update to use RelationshipManager and enhanced deduplication:

```typescript
// When extracting tasks from session
const deduplicationResult = await deduplicationService.isTaskDuplicate(
  task.title,
  task.description,
  note?.id // Context from current screenshot analysis
);

if (deduplicationResult.isDuplicate) {
  // Link to existing task instead of creating new one
  await relationshipManager.addRelationship({
    sourceType: EntityType.TASK,
    sourceId: deduplicationResult.existingEntityId!,
    targetType: EntityType.SESSION,
    targetId: session.id,
    type: RelationshipType.TASK_SESSION,
    metadata: {
      source: 'ai',
      confidence: deduplicationResult.similarityScore,
      reasoning: `Linked existing task (${deduplicationResult.reason})`,
    },
  });
} else {
  // Create new task
  const newTask = await createTask(task);

  // Create relationship with metadata
  await relationshipManager.addRelationship({
    sourceType: EntityType.TASK,
    sourceId: newTask.id,
    targetType: EntityType.SESSION,
    targetId: session.id,
    type: RelationshipType.TASK_SESSION,
    metadata: {
      source: 'ai',
      confidence: 0.90,
      reasoning: 'Task extracted from session screenshot',
    },
  });
}
```

### 4. Add Confidence-Based Filtering

**File:** `src/services/relationshipFilters.ts`

Create utilities for filtering relationships by confidence:

```typescript
export class RelationshipFilters {
  /**
   * Filter relationships by minimum confidence
   */
  static byMinConfidence(
    relationships: Relationship[],
    minConfidence: number = 0.7
  ): Relationship[] {
    return relationships.filter(rel => {
      if (rel.metadata.source !== 'ai') {
        return true; // Always include non-AI relationships
      }
      return (rel.metadata.confidence || 0) >= minConfidence;
    });
  }

  /**
   * Filter relationships by source
   */
  static bySource(
    relationships: Relationship[],
    source: RelationshipSource
  ): Relationship[] {
    return relationships.filter(rel => rel.metadata.source === source);
  }

  /**
   * Sort relationships by confidence (descending)
   */
  static sortByConfidence(relationships: Relationship[]): Relationship[] {
    return [...relationships].sort((a, b) => {
      const aConf = a.metadata.confidence || 0;
      const bConf = b.metadata.confidence || 0;
      return bConf - aConf;
    });
  }
}
```

---

## Deliverables

1. **Updated `src/services/claudeService.ts`** - Use RelationshipManager
2. **`src/services/aiDeduplication.ts`** - Enhanced deduplication (300-400 lines)
3. **Updated `src/services/sessionsAgentService.ts`** - Use deduplication + RelationshipManager
4. **`src/services/relationshipFilters.ts`** - Confidence-based filtering utilities
5. **`tests/services/aiDeduplication.test.ts`** - Comprehensive tests (300+ lines)
6. **`docs/architecture/ai-associations.md`** - Architecture documentation

---

## Acceptance Criteria

- [ ] Deduplication reduces duplicate tasks by >80% (measured on test data)
- [ ] All AI-created relationships have confidence scores
- [ ] Confidence scores are accurate (validated manually on sample)
- [ ] Relationship metadata includes reasoning
- [ ] Filtering by confidence works correctly
- [ ] No regressions in existing AI quality
- [ ] Test coverage >85%

---

## Testing Requirements

```typescript
describe('AI Deduplication', () => {
  it('should detect exact duplicate tasks', async () => {
    const result = await deduplicationService.isTaskDuplicate(
      'Fix login bug',
      'The login form is broken',
      'note-1'
    );

    expect(result.isDuplicate).toBe(true);
    expect(result.similarityScore).toBeGreaterThan(0.9);
  });

  it('should detect similar tasks', async () => {
    const result = await deduplicationService.isTaskDuplicate(
      'Repair authentication issue',
      'Login not working',
      'note-1'
    );

    expect(result.isDuplicate).toBe(true);
    expect(result.similarityScore).toBeGreaterThan(0.85);
  });

  it('should not flag different tasks', async () => {
    const result = await deduplicationService.isTaskDuplicate(
      'Update documentation',
      'Write new docs',
      'note-1'
    );

    expect(result.isDuplicate).toBe(false);
  });
});
```

---

**Task Complete When:**
- All AI services use RelationshipManager
- Deduplication significantly improved
- All tests passing
- Documentation complete
