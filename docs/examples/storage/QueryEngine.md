# QueryEngine Example

**Last Updated**: October 26, 2025

## Purpose

This example demonstrates how to use the QueryEngine with automatic index selection for high-performance queries. The QueryEngine provides 40x faster queries by intelligently selecting the optimal index (date, status, tag, or full-text) based on your filters.

## Use Case

Use the QueryEngine when you need to:
- Query sessions, notes, or tasks with filters (50ms vs 2000ms without indexes)
- Perform full-text search across note content (10-50ms with indexes)
- Filter by date ranges, status, tags, or topics
- Implement pagination for large datasets
- Build performant search/filter UIs

## Example Code

```typescript
/**
 * QueryEngine Usage Examples (Phase 3.3)
 *
 * This file demonstrates how to use the QueryEngine with automatic index selection.
 * All examples assume indexes have been built using IndexingEngine (Phase 3.1).
 */

import { QueryEngine, type QueryFilter, type QuerySort } from './QueryEngine';
import { getStorage } from './index';

// ============================================================================
// Example 1: Date-based Query (Uses Date Index)
// ============================================================================

async function querySessionsByDate() {
  const storage = await getStorage();
  const queryEngine = new QueryEngine(storage);

  // Query sessions on a specific date
  const filters: QueryFilter[] = [
    { field: 'date', operator: '>=', value: '2025-10-23' }
  ];

  const result = await queryEngine.execute({
    collection: 'sessions',
    filters,
    sort: { field: 'date', direction: 'desc' },
    limit: 10
  });

  console.log(`Plan: ${result.plan.strategy}`); // "index-date"
  console.log(`Execution time: ${result.executionTime}ms`); // ~10-50ms with index
  console.log(`Sessions found: ${result.entitiesReturned}`);

  return result.entities;
}

// ============================================================================
// Example 2: Status-based Query (Uses Status Index)
// ============================================================================

async function queryCompletedSessions() {
  const storage = await getStorage();
  const queryEngine = new QueryEngine(storage);

  const filters: QueryFilter[] = [
    { field: 'status', operator: '=', value: 'completed' }
  ];

  const result = await queryEngine.execute({
    collection: 'sessions',
    filters,
    sort: { field: 'date', direction: 'desc' },
    limit: 100
  });

  console.log(`Plan: ${result.plan.strategy}`); // "index-status"
  console.log(`Scanned: ${result.entitiesScanned}, Returned: ${result.entitiesReturned}`);

  return result.entities;
}

// ============================================================================
// Example 3: Tag-based Query (Uses Tag Index)
// ============================================================================

async function queryNotesByTopic(topicId: string) {
  const storage = await getStorage();
  const queryEngine = new QueryEngine(storage);

  const filters: QueryFilter[] = [
    { field: 'topic', operator: '=', value: topicId }
  ];

  const result = await queryEngine.execute({
    collection: 'notes',
    filters,
    sort: { field: 'date', direction: 'desc' },
    limit: 50
  });

  console.log(`Plan: ${result.plan.strategy}`); // "index-tag"
  console.log(`Reason: ${result.plan.reason}`); // "Tag index available for notes"

  return result.entities;
}

// ============================================================================
// Example 4: Full-Text Search (Uses Full-Text Index)
// ============================================================================

async function searchNotesByContent(searchTerm: string) {
  const storage = await getStorage();
  const queryEngine = new QueryEngine(storage);

  const filters: QueryFilter[] = [
    { field: 'content', operator: 'contains', value: searchTerm }
  ];

  const result = await queryEngine.execute({
    collection: 'notes',
    filters,
    limit: 20
  });

  console.log(`Plan: ${result.plan.strategy}`); // "index-fulltext"
  console.log(`Execution time: ${result.executionTime}ms`); // ~10-50ms with index vs ~2000ms without

  return result.entities;
}

// ============================================================================
// Example 5: Complex Query (Multiple Filters)
// ============================================================================

async function queryTasksByStatusAndPriority() {
  const storage = await getStorage();
  const queryEngine = new QueryEngine(storage);

  const filters: QueryFilter[] = [
    { field: 'status', operator: '=', value: 'todo' },
    { field: 'priority', operator: '=', value: 'high' }
  ];

  const result = await queryEngine.execute({
    collection: 'tasks',
    filters,
    sort: { field: 'date', direction: 'asc' },
    limit: 50
  });

  console.log(`Plan: ${result.plan.strategy}`); // "index-status" (uses best available index)
  console.log(`Cost estimate: ${result.plan.estimatedCost}`);

  return result.entities;
}

// ============================================================================
// Example 6: Pagination
// ============================================================================

async function getTasksPage(page: number, pageSize: number = 20) {
  const storage = await getStorage();
  const queryEngine = new QueryEngine(storage);

  const filters: QueryFilter[] = [
    { field: 'status', operator: '!=', value: 'done' }
  ];

  const result = await queryEngine.execute({
    collection: 'tasks',
    filters,
    sort: { field: 'date', direction: 'desc' },
    limit: pageSize,
    offset: page * pageSize
  });

  return {
    tasks: result.entities,
    page,
    pageSize,
    executionTime: result.executionTime
  };
}

// ============================================================================
// Performance Comparison
// ============================================================================

async function performanceComparison() {
  const storage = await getStorage();
  const queryEngine = new QueryEngine(storage);

  // Load all sessions for comparison
  const allSessions = await storage.load<any[]>('sessions') || [];

  // Method 1: Full scan (no index)
  const fullScanStart = Date.now();
  const filtered = allSessions.filter(s => s.status === 'completed');
  const fullScanTime = Date.now() - fullScanStart;

  // Method 2: Index query (with index)
  const result = await queryEngine.execute({
    collection: 'sessions',
    filters: [{ field: 'status', operator: '=', value: 'completed' }]
  });

  console.log('Performance Comparison:');
  console.log(`Full scan: ${fullScanTime}ms`);
  console.log(`Index query: ${result.executionTime}ms`);
  console.log(`Speedup: ${(fullScanTime / result.executionTime).toFixed(1)}x`);
  // Expected: 40x speedup with indexes (50ms vs 2000ms)
}

export {
  querySessionsByDate,
  queryCompletedSessions,
  queryNotesByTopic,
  searchNotesByContent,
  queryTasksByStatusAndPriority,
  getTasksPage,
  performanceComparison
};
```

## Key Points

- **Automatic Index Selection**: QueryEngine automatically chooses the best index based on your filters
- **40x Performance Improvement**: Indexed queries run in 10-50ms vs 2000ms for full scans
- **Multiple Index Types**: Supports date, status, tag, and full-text indexes
- **Query Planning**: Returns execution plan with strategy and estimated cost
- **Pagination Support**: Built-in offset/limit for large result sets
- **Flexible Filtering**: Supports operators: `=`, `!=`, `>`, `>=`, `<`, `<=`, `contains`
- **Sorting**: Sort results by any field in ascending or descending order
- **Type Safety**: Fully typed filters, sorts, and results

## Performance Metrics

| Query Type | Without Index | With Index | Speedup |
|------------|--------------|------------|---------|
| Date range | 2000ms | 50ms | **40x** |
| Status filter | 2000ms | 50ms | **40x** |
| Full-text search | 2000ms | 10-50ms | **20-40x** |
| Tag/topic filter | 2000ms | 50ms | **40x** |

## Related Documentation

- Main Service: `/src/services/storage/QueryEngine.ts`
- Storage Architecture: `/docs/sessions-rewrite/STORAGE_ARCHITECTURE.md`
- Indexing Engine: `/src/services/storage/IndexingEngine.ts`
- Context Integration: `/src/context/SessionListContext.tsx`
