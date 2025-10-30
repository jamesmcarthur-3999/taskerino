# AI Associations Usage Examples

**Version:** 1.0
**Date:** 2025-10-24
**Status:** Complete (S2)

This document provides practical, copy-paste-ready examples for using the AI Associations system in Taskerino.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Basic Deduplication](#basic-deduplication)
3. [Advanced Filtering](#advanced-filtering)
4. [Integration Patterns](#integration-patterns)
5. [Real-World Scenarios](#real-world-scenarios)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)

---

## Quick Start

### Setup

```typescript
import { getStorage } from '@/services/storage';
import { AIDeduplicationService } from '@/services/aiDeduplication';
import { relationshipManager } from '@/services/relationshipManager';
import {
  filterByConfidence,
  filterBySource,
  sortByConfidence,
} from '@/services/relationshipFilters';

// Initialize
const storage = await getStorage();
const dedupService = new AIDeduplicationService(storage);
await relationshipManager.init();
```

---

## Basic Deduplication

### Example 1: Check if Task is Duplicate

```typescript
async function checkTaskDuplicate() {
  const result = await dedupService.isTaskDuplicate(
    'Fix login bug',
    'Users cannot log in with email'
  );

  if (result.isDuplicate) {
    console.log(`✓ Duplicate found!`);
    console.log(`  Existing task: ${result.existingEntityId}`);
    console.log(`  Similarity: ${(result.similarityScore * 100).toFixed(1)}%`);
    console.log(`  Reason: ${result.reason}`);
  } else {
    console.log('✗ Not a duplicate - safe to create');
  }
}
```

**Output:**
```
✓ Duplicate found!
  Existing task: task-abc123
  Similarity: 95.2%
  Reason: Very similar task found: "Fix login bug" (95% match)
```

---

### Example 2: Find All Similar Tasks

```typescript
async function findSimilarTasks() {
  const similar = await dedupService.findSimilarTasks({
    title: 'Fix authentication',
    description: 'Login form not working',
    minSimilarity: 0.7,
    maxResults: 5,
  });

  console.log(`Found ${similar.length} similar tasks:`);

  similar.forEach((result, i) => {
    console.log(`\n${i + 1}. ${result.entity.title}`);
    console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   Reason: ${result.reason}`);
    console.log(`   Should merge? ${result.shouldMerge ? 'YES' : 'NO'}`);
  });
}
```

**Output:**
```
Found 3 similar tasks:

1. Fix login bug
   Similarity: 87.5%
   Confidence: 92.0%
   Reason: Very similar to "Fix login bug" (87% match)
   Should merge? NO (similarity too low)

2. Fix authentication issue
   Similarity: 78.3%
   Confidence: 78.3%
   Reason: Similar to "Fix authentication issue" (78% match)
   Should merge? NO

3. Update login form
   Similarity: 71.2%
   Confidence: 71.2%
   Reason: Similar to "Update login form" (71% match)
   Should merge? NO
```

---

### Example 3: Context-Aware Matching

```typescript
async function contextAwareDeduplication(noteId: string) {
  // Without context - searches all tasks globally
  const globalResults = await dedupService.findSimilarTasks({
    title: 'Fix bug',
  });

  // With context - only searches tasks from same note
  const contextResults = await dedupService.findSimilarTasks({
    title: 'Fix bug',
    contextNoteId: noteId,
  });

  console.log(`Global search: ${globalResults.length} results`);
  console.log(`Context search: ${contextResults.length} results`);

  if (contextResults.length > 0) {
    console.log(`\nContext match has higher confidence:`);
    console.log(`  Global: ${(globalResults[0].confidence * 100).toFixed(1)}%`);
    console.log(`  Context: ${(contextResults[0].confidence * 100).toFixed(1)}%`);
  }
}
```

---

## Advanced Filtering

### Example 4: Filter High-Confidence AI Relationships

```typescript
function getHighConfidenceRelationships(taskId: string) {
  // Get all relationships for task
  const allRels = relationshipManager.getRelationships({ entityId: taskId });

  // Filter to AI relationships only
  const aiRels = filterBySource(allRels, 'ai');

  // Filter to high confidence (>80%)
  const highConfidence = filterByConfidence(aiRels, 0.8);

  // Sort by confidence (highest first)
  const sorted = sortByConfidence(highConfidence);

  console.log(`Task ${taskId}:`);
  console.log(`  Total relationships: ${allRels.length}`);
  console.log(`  AI relationships: ${aiRels.length}`);
  console.log(`  High confidence: ${highConfidence.length}`);

  sorted.forEach(rel => {
    console.log(`\n  → ${rel.targetType} ${rel.targetId}`);
    console.log(`    Confidence: ${(rel.metadata.confidence! * 100).toFixed(1)}%`);
    console.log(`    Reasoning: ${rel.metadata.reasoning}`);
  });

  return sorted;
}
```

**Output:**
```
Task task-123:
  Total relationships: 5
  AI relationships: 3
  High confidence: 2

  → note note-456
    Confidence: 95.0%
    Reasoning: Task extracted from note content

  → session session-789
    Confidence: 87.5%
    Reasoning: Task mentioned in session screenshot
```

---

### Example 5: Filter by Date Range

```typescript
import { filterByDateRange } from '@/services/relationshipFilters';

function getRecentAIRelationships(entityId: string) {
  const allRels = relationshipManager.getRelationships({ entityId });

  // Last 7 days
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // AI relationships from this week
  const recentAI = combineFilters(allRels, [
    (rels) => filterBySource(rels, 'ai'),
    (rels) => filterByDateRange(rels, weekAgo, today),
    (rels) => sortByDate(rels),
  ]);

  console.log(`Recent AI relationships (last 7 days): ${recentAI.length}`);

  recentAI.forEach(rel => {
    const date = new Date(rel.metadata.createdAt);
    console.log(`  ${date.toLocaleDateString()}: ${rel.targetType} ${rel.targetId}`);
  });

  return recentAI;
}
```

---

### Example 6: Combine Multiple Filters

```typescript
import { combineFilters } from '@/services/relationshipFilters';

function advancedFiltering(noteId: string) {
  const allRels = relationshipManager.getRelationships({ entityId: noteId });

  // Complex query: AI relationships, high confidence, last 30 days, sorted
  const filtered = combineFilters(allRels, [
    (rels) => filterBySource(rels, 'ai'),
    (rels) => filterByConfidence(rels, 0.75),
    (rels) => filterByDateRange(
      rels,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date()
    ),
    (rels) => sortByConfidence(rels),
  ]);

  return filtered;
}
```

---

## Integration Patterns

### Example 7: AI Task Extraction with Deduplication

```typescript
async function extractTasksFromNote(
  noteId: string,
  aiExtractedTasks: Array<{ title: string; description: string; priority: string }>
) {
  const results = {
    created: [] as string[],
    linked: [] as string[],
    skipped: [] as string[],
  };

  for (const taskData of aiExtractedTasks) {
    // Step 1: Check for duplicates
    const dedupResult = await dedupService.isTaskDuplicate(
      taskData.title,
      taskData.description,
      noteId // Context: same note
    );

    if (dedupResult.isDuplicate) {
      // Step 2a: Link to existing task
      console.log(`⏭️  Skipping duplicate: "${taskData.title}"`);
      console.log(`   Linking to existing task: ${dedupResult.existingEntityId}`);

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

      results.linked.push(dedupResult.existingEntityId!);
    } else {
      // Step 2b: Create new task
      console.log(`✓ Creating new task: "${taskData.title}"`);

      const newTask = await createTask({
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority as 'low' | 'medium' | 'high',
      });

      // Create AI relationship
      await relationshipManager.addRelationship({
        sourceType: EntityType.TASK,
        sourceId: newTask.id,
        targetType: EntityType.NOTE,
        targetId: noteId,
        type: RelationshipType.TASK_NOTE,
        metadata: {
          source: 'ai',
          confidence: 0.9,
          reasoning: 'Task extracted from note content',
        },
      });

      results.created.push(newTask.id);
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   Created: ${results.created.length}`);
  console.log(`   Linked: ${results.linked.length}`);
  console.log(`   Total: ${results.created.length + results.linked.length}`);

  return results;
}
```

---

### Example 8: Show Similar Tasks in UI

```typescript
async function showSimilarTasksInUI(
  taskData: { title: string; description: string }
) {
  const similar = await dedupService.findSimilarTasks({
    title: taskData.title,
    description: taskData.description,
    minSimilarity: 0.7,
    maxResults: 3,
  });

  if (similar.length === 0) {
    return null; // No similar tasks - proceed with creation
  }

  // Show UI dialog
  return {
    type: 'similar-tasks-found',
    similar: similar.map(result => ({
      taskId: result.entity.id,
      title: result.entity.title,
      similarity: result.similarity,
      confidence: result.confidence,
      reason: result.reason,
      shouldMerge: result.shouldMerge,
    })),
    actions: {
      createAnyway: () => {
        // User chose to create despite duplicates
      },
      linkToExisting: (taskId: string) => {
        // User chose to link to existing task
      },
      cancel: () => {
        // User cancelled
      },
    },
  };
}
```

---

## Real-World Scenarios

### Scenario 1: Meeting Notes → Tasks

```typescript
async function processMeetingNotes(meetingNoteId: string) {
  // 1. AI extracts tasks from meeting note
  const aiResponse = await claudeService.processInput(meetingNoteContent);

  // 2. Deduplicate extracted tasks
  const extractResult = await extractTasksFromNote(
    meetingNoteId,
    aiResponse.tasks
  );

  // 3. Get all AI relationships for the note
  const noteRels = relationshipManager.getRelationships({
    entityId: meetingNoteId,
  });

  const aiTaskRels = combineFilters(noteRels, [
    (rels) => filterBySource(rels, 'ai'),
    (rels) => rels.filter(r => r.type === RelationshipType.TASK_NOTE),
  ]);

  // 4. Show summary
  console.log(`\n📝 Meeting note processed:`);
  console.log(`   Tasks created: ${extractResult.created.length}`);
  console.log(`   Tasks linked: ${extractResult.linked.length}`);
  console.log(`   AI relationships: ${aiTaskRels.length}`);

  return {
    noteId: meetingNoteId,
    taskIds: [...extractResult.created, ...extractResult.linked],
    relationships: aiTaskRels,
  };
}
```

---

### Scenario 2: Session Screenshots → Tasks

```typescript
async function processSessionScreenshots(sessionId: string) {
  // 1. Analyze screenshots and extract tasks
  const screenshots = await getSessionScreenshots(sessionId);
  const allExtractedTasks = [];

  for (const screenshot of screenshots) {
    const analysis = await sessionsAgentService.analyzeScreenshot(screenshot);
    const tasks = analysis.progressIndicators?.achievements || [];
    allExtractedTasks.push(...tasks);
  }

  // 2. Deduplicate across all screenshots in session
  const results = {
    created: [] as string[],
    linked: [] as string[],
  };

  for (const taskData of allExtractedTasks) {
    const dedupResult = await dedupService.isTaskDuplicate(
      taskData.title,
      taskData.description,
      sessionId // Context: same session
    );

    if (dedupResult.isDuplicate) {
      // Link to existing task
      await relationshipManager.addRelationship({
        sourceType: EntityType.TASK,
        sourceId: dedupResult.existingEntityId!,
        targetType: EntityType.SESSION,
        targetId: sessionId,
        type: RelationshipType.TASK_SESSION,
        metadata: {
          source: 'ai',
          confidence: dedupResult.similarityScore,
          reasoning: `Detected in session screenshot (${dedupResult.reason})`,
        },
      });

      results.linked.push(dedupResult.existingEntityId!);
    } else {
      // Create new task
      const newTask = await createTask(taskData);

      await relationshipManager.addRelationship({
        sourceType: EntityType.TASK,
        sourceId: newTask.id,
        targetType: EntityType.SESSION,
        targetId: sessionId,
        type: RelationshipType.TASK_SESSION,
        metadata: {
          source: 'ai',
          confidence: 0.85,
          reasoning: 'Task extracted from session screenshots',
        },
      });

      results.created.push(newTask.id);
    }
  }

  console.log(`\n🎥 Session processed:`);
  console.log(`   Screenshots analyzed: ${screenshots.length}`);
  console.log(`   Tasks extracted: ${allExtractedTasks.length}`);
  console.log(`   Tasks created: ${results.created.length}`);
  console.log(`   Tasks linked: ${results.linked.length}`);

  return results;
}
```

---

### Scenario 3: Show AI Confidence in UI

```typescript
function TaskCard({ taskId }: { taskId: string }) {
  const [aiRelationships, setAIRelationships] = useState<Relationship[]>([]);

  useEffect(() => {
    const rels = relationshipManager.getRelationships({ entityId: taskId });
    const aiRels = combineFilters(rels, [
      (r) => filterBySource(r, 'ai'),
      (r) => sortByConfidence(r),
    ]);
    setAIRelationships(aiRels);
  }, [taskId]);

  return (
    <div className="task-card">
      <h3>{task.title}</h3>

      {aiRelationships.length > 0 && (
        <div className="ai-badge">
          <span className="icon">🤖</span>
          <span className="text">AI-suggested</span>
          <span className="confidence">
            {(aiRelationships[0].metadata.confidence! * 100).toFixed(0)}% confidence
          </span>

          <Tooltip>
            <p>{aiRelationships[0].metadata.reasoning}</p>
            <p className="note">Click to see details</p>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
```

---

## Error Handling

### Example 9: Graceful Degradation

```typescript
async function safeDeduplication(taskData: any) {
  try {
    const dedupResult = await dedupService.isTaskDuplicate(
      taskData.title,
      taskData.description
    );

    return dedupResult;
  } catch (error) {
    console.error('Deduplication failed:', error);

    // Fallback: proceed without deduplication
    return {
      isDuplicate: false,
      similarityScore: 0,
      reason: 'Deduplication service unavailable',
      similarEntities: [],
    };
  }
}
```

---

### Example 10: Validation

```typescript
function validateTaskData(taskData: any): boolean {
  if (!taskData.title || taskData.title.trim().length === 0) {
    console.error('Invalid task: title is required');
    return false;
  }

  if (taskData.title.length > 1000) {
    console.error('Invalid task: title too long (max 1000 chars)');
    return false;
  }

  return true;
}

async function createTaskWithValidation(taskData: any) {
  if (!validateTaskData(taskData)) {
    throw new Error('Invalid task data');
  }

  const dedupResult = await dedupService.isTaskDuplicate(
    taskData.title,
    taskData.description
  );

  if (dedupResult.isDuplicate) {
    // Handle duplicate
  }

  // Proceed with creation
}
```

---

## Best Practices

### ✅ DO

1. **Always check for duplicates before creating AI-suggested tasks**
   ```typescript
   const dedupResult = await dedupService.isTaskDuplicate(...);
   if (!dedupResult.isDuplicate) {
     // Safe to create
   }
   ```

2. **Use context-aware matching when available**
   ```typescript
   findSimilarTasks({ title, contextNoteId }); // More accurate
   ```

3. **Capture AI confidence and reasoning in metadata**
   ```typescript
   metadata: {
     source: 'ai',
     confidence: 0.95,
     reasoning: 'Task extracted from note content',
   }
   ```

4. **Show AI confidence to users**
   ```typescript
   <span>AI-suggested (95% confidence)</span>
   ```

5. **Filter by confidence threshold in UI**
   ```typescript
   const highConfidence = filterByConfidence(allRels, 0.8);
   ```

---

### ❌ DON'T

1. **Don't create tasks without deduplication check**
   ```typescript
   // ❌ Bad
   const task = await createTask(taskData);

   // ✅ Good
   const dedupResult = await dedupService.isTaskDuplicate(...);
   if (!dedupResult.isDuplicate) {
     const task = await createTask(taskData);
   }
   ```

2. **Don't ignore similarity scores**
   ```typescript
   // ❌ Bad
   if (dedupResult.isDuplicate) { /* always link */ }

   // ✅ Good
   if (dedupResult.isDuplicate && dedupResult.similarityScore > 0.9) {
     // Auto-link high confidence
   } else {
     // Show user confirmation
   }
   ```

3. **Don't hardcode confidence thresholds**
   ```typescript
   // ❌ Bad
   const highConfidence = rels.filter(r => r.metadata.confidence! > 0.8);

   // ✅ Good
   const highConfidence = filterByConfidence(rels, 0.8);
   ```

4. **Don't skip context when available**
   ```typescript
   // ❌ Bad
   findSimilarTasks({ title });

   // ✅ Good
   findSimilarTasks({ title, contextNoteId });
   ```

---

## Summary

The AI Associations system provides:
- **Deduplication:** Prevent duplicate tasks/notes
- **Confidence Scoring:** Know how confident the AI is
- **Relationship Filtering:** Query relationships by confidence, source, date
- **Context-Awareness:** Scope searches to relevant entities

**Key Takeaways:**
1. Always check for duplicates before creating AI-suggested entities
2. Use context-aware matching for better accuracy
3. Capture and display AI confidence to users
4. Filter relationships by confidence threshold
5. Handle errors gracefully with fallbacks

---

## See Also

- [API Reference: AI Associations](../api/ai-associations.md)
- [Architecture: AI Deduplication](../architecture/ai-deduplication.md)
- [S2: AI Associations Task Spec](../agent-tasks/S2-ai-associations.md)
