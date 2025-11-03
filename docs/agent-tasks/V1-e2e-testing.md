# AGENT TASK V1: End-to-End Testing

**Objective:** Create comprehensive E2E test suite covering all critical user workflows.

**Priority:** P1 (Testing & Validation)

**Dependencies:** All previous tasks (F1-F3, S1-S2, C1-C2, U1-U3)

**Complexity:** High

**Estimated Time:** 12-15 hours

---

## Detailed Requirements

### 1. Set Up E2E Testing Framework

**File:** `tests/e2e/setup.ts`

Configure Playwright or Cypress for E2E testing:

```typescript
import { test as base, expect } from '@playwright/test';

// Extend base test with custom fixtures
export const test = base.extend({
  // Custom fixtures for common setups
});

export { expect };
```

### 2. Create E2E Test Suites

#### Test Suite 1: Task-Note Relationship Workflow

**File:** `tests/e2e/task-note-relationship.spec.ts`

```typescript
import { test, expect } from './setup';

test.describe('Task-Note Relationship Workflow', () => {
  test('should create task from note and link automatically', async ({ page }) => {
    // 1. Navigate to app
    await page.goto('http://localhost:5173');

    // 2. Create a note
    await page.click('[data-testid="new-note-button"]');
    await page.fill('[data-testid="note-title"]', 'Test Note');
    await page.fill('[data-testid="note-content"]', 'This note contains a task: Fix the bug');
    await page.click('[data-testid="save-note"]');

    // 3. Wait for AI processing
    await page.waitForSelector('[data-testid="note-saved"]');

    // 4. Verify note created
    const noteTitle = await page.textContent('[data-testid="note-title"]');
    expect(noteTitle).toBe('Test Note');

    // 5. Extract task from note (manual or AI)
    await page.click('[data-testid="extract-tasks-button"]');
    await page.waitForSelector('[data-testid="extracted-task"]');

    // 6. Verify task created and linked to note
    await page.click('[data-testid="tasks-zone"]');
    await page.click('[data-testid="task-item"]:first-child');

    // 7. Check relationships in task detail
    const relationships = await page.textContent('[data-testid="relationship-pills"]');
    expect(relationships).toContain('Test Note');

    // 8. Click relationship pill to open modal
    await page.click('[data-testid="relationship-pill"]:first-child');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // 9. Verify modal shows correct relationship
    await expect(page.locator('[data-testid="current-relationships"]')).toContainText('Test Note');
  });

  test('should manually link task to note via modal', async ({ page }) => {
    // 1. Navigate and create task
    await page.goto('http://localhost:5173');
    await page.click('[data-testid="new-task-button"]');
    await page.fill('[data-testid="task-title"]', 'Manual Task');
    await page.click('[data-testid="save-task"]');

    // 2. Open task detail
    await page.click('[data-testid="task-item"]:first-child');

    // 3. Open relationship modal
    await page.click('[data-testid="manage-relationships"]');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // 4. Switch to notes tab
    await page.click('[data-testid="tab-notes"]');

    // 5. Search for note
    await page.fill('[data-testid="search-input"]', 'Test Note');
    await page.waitForTimeout(300); // Debounce

    // 6. Link to note
    await page.click('[data-testid="link-button"]:first-child');

    // 7. Verify optimistic update
    await expect(page.locator('[data-testid="current-relationships"]')).toContainText('Test Note');

    // 8. Close modal
    await page.click('[data-testid="close-modal"]');

    // 9. Verify relationship persisted
    await expect(page.locator('[data-testid="relationship-pills"]')).toContainText('Test Note');
  });

  test('should remove task-note relationship', async ({ page }) => {
    // Setup: Create task with linked note
    // ...

    // 1. Open task detail
    await page.click('[data-testid="task-item"]:first-child');

    // 2. Click remove on relationship pill
    await page.click('[data-testid="relationship-pill-remove"]:first-child');

    // 3. Verify optimistic removal
    await expect(page.locator('[data-testid="relationship-pills"]')).not.toContainText('Test Note');

    // 4. Refresh page
    await page.reload();

    // 5. Verify removal persisted
    await page.click('[data-testid="task-item"]:first-child');
    await expect(page.locator('[data-testid="relationship-pills"]')).not.toContainText('Test Note');
  });
});
```

#### Test Suite 2: Session-Task Relationship Workflow

**File:** `tests/e2e/session-task-relationship.spec.ts`

```typescript
test.describe('Session-Task Relationship Workflow', () => {
  test('should extract tasks from session and link automatically', async ({ page }) => {
    // 1. Start a session
    // 2. Simulate screenshots with task content
    // 3. End session
    // 4. Verify tasks extracted and linked to session
    // 5. Verify bidirectional relationship (task shows session, session shows tasks)
  });

  test('should manually link session to existing task', async ({ page }) => {
    // Similar to task-note manual link test
  });
});
```

#### Test Suite 3: Migration Workflow

**File:** `tests/e2e/migration.spec.ts`

```typescript
test.describe('Migration Workflow', () => {
  test('should migrate legacy data to relationship system', async ({ page }) => {
    // 1. Load app with legacy data (pre-migration)
    // 2. Trigger migration (if automatic or manual)
    // 3. Verify all legacy relationships converted
    // 4. Verify no data loss
    // 5. Verify bidirectional consistency
  });

  test('should handle orphaned references during migration', async ({ page }) => {
    // Test migration with invalid references
  });
});
```

#### Test Suite 4: Bulk Operations

**File:** `tests/e2e/bulk-operations.spec.ts`

```typescript
test.describe('Bulk Operations', () => {
  test('should bulk link multiple tasks to note', async ({ page }) => {
    // 1. Create note
    // 2. Create 5 tasks
    // 3. Open relationship modal on note
    // 4. Select all 5 tasks
    // 5. Click bulk link
    // 6. Verify all 5 tasks linked
  });

  test('should bulk unlink multiple relationships', async ({ page }) => {
    // Similar but for unlinking
  });
});
```

#### Test Suite 5: Performance & Edge Cases

**File:** `tests/e2e/performance.spec.ts`

```typescript
test.describe('Performance & Edge Cases', () => {
  test('should handle 1000+ relationships without lag', async ({ page }) => {
    // 1. Create entity with 1000 relationships (via test fixture)
    // 2. Open relationship modal
    // 3. Measure time to open and render
    // 4. Verify <1s load time
  });

  test('should handle concurrent relationship operations', async ({ page, context }) => {
    // 1. Open same entity in two tabs
    // 2. Add relationship in tab 1
    // 3. Verify it appears in tab 2 (cross-window sync)
  });
});
```

### 3. Create Test Helpers

**File:** `tests/e2e/helpers.ts`

```typescript
export async function createTestNote(page, data) {
  // Helper to create note via UI
}

export async function createTestTask(page, data) {
  // Helper to create task via UI
}

export async function linkEntities(page, sourceId, targetId) {
  // Helper to link two entities via modal
}

export async function verifyRelationship(page, entityId, expectedTarget) {
  // Helper to verify relationship exists
}
```

---

## Deliverables

1. **`tests/e2e/task-note-relationship.spec.ts`** - Task-note E2E tests (400+ lines)
2. **`tests/e2e/session-task-relationship.spec.ts`** - Session-task E2E tests
3. **`tests/e2e/migration.spec.ts`** - Migration E2E tests
4. **`tests/e2e/bulk-operations.spec.ts`** - Bulk operations E2E tests
5. **`tests/e2e/performance.spec.ts`** - Performance E2E tests
6. **`tests/e2e/helpers.ts`** - Test helpers and utilities
7. **`docs/testing/e2e-testing.md`** - E2E testing documentation

---

## Acceptance Criteria

- [ ] All critical user workflows covered
- [ ] Tests run reliably (no flakiness)
- [ ] Tests use proper data-testid attributes (not brittle selectors)
- [ ] Tests clean up after themselves (no test pollution)
- [ ] Performance tests meet benchmarks (<1s for modal open, <100ms for add/remove)
- [ ] Cross-window sync tests pass
- [ ] Migration tests verify 100% data preservation
- [ ] All tests pass on CI/CD pipeline
- [ ] Test coverage includes happy path and error cases

---

## Test Data Management

Create test fixtures for consistent data:

**File:** `tests/e2e/fixtures.ts`

```typescript
export const testData = {
  notes: [
    { id: 'note-1', title: 'Test Note 1', ... },
    { id: 'note-2', title: 'Test Note 2', ... },
  ],
  tasks: [
    { id: 'task-1', title: 'Test Task 1', ... },
  ],
  sessions: [
    { id: 'session-1', name: 'Test Session', ... },
  ],
};

export async function seedTestData(storage) {
  // Load test data into storage
}

export async function clearTestData(storage) {
  // Clear all test data
}
```

---

## CI/CD Integration

**File:** `.github/workflows/e2e-tests.yml`

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: test-results/
```

---

**Task Complete When:**
- All test suites created
- All tests passing (100%)
- No flaky tests
- CI/CD integration working
- Documentation complete
