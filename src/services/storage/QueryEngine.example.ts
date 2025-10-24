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
// Example 7: Using with React Context
// ============================================================================

/*
import { useSessions } from '../context/SessionsContext';

function MyComponent() {
  const { querySessions } = useSessions();

  async function loadRecentSessions() {
    // Query automatically uses date index for 40x speedup
    const filters: QueryFilter[] = [
      { field: 'date', operator: '>=', value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
    ];

    const sessions = await querySessions(
      filters,
      { field: 'date', direction: 'desc' },
      10
    );

    console.log(`Loaded ${sessions.length} sessions from last 7 days`);
    return sessions;
  }

  // ... use loadRecentSessions in useEffect or event handler
}
*/

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
