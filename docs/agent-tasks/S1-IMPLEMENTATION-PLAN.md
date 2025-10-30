# S1 RelationshipManager - DETAILED IMPLEMENTATION PLAN

## Executive Summary

**Service**: RelationshipManager (Core relationship CRUD with bidirectional sync and strategy pattern)
**Priority**: P0 (Critical Path - Core Service)
**Dependencies**: F1 (Type System) ✅, F2 (Storage Layer) ✅, F3 (Migration Service) ✅
**Estimated Time**: 14 hours (conservative)
**Complexity**: HIGH
**Risk Level**: MEDIUM (well-defined interfaces, proven patterns)

**Foundation Status**:
- ✅ F1 Complete: `/Users/jamesmcarthur/Documents/taskerino/src/types/relationships.ts` (600 lines, fully documented)
- ✅ F2 Complete: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/relationshipIndex.ts` (436 lines, O(1) lookups)
- ✅ F2 Complete: Transaction support in both IndexedDB and Tauri adapters
- ⚠️ F3 Status: Migration service exists but needs integration testing

**Blockers**: NONE - All dependencies met

---

## 1. Requirements Analysis

### 1.1 Core Methods (from S1 spec)

#### Public API (6 methods)

1. **`addRelationship(params: AddRelationshipParams): Promise<Relationship>`**
   - Validates relationship type and entity types
   - Creates bidirectional relationships automatically (if configured)
   - Executes before/after strategies
   - Uses atomic transactions
   - Updates relationship index
   - Emits RELATIONSHIP_ADDED event
   - Idempotent (duplicate detection)

2. **`removeRelationship(params: RemoveRelationshipParams): Promise<void>`**
   - Removes bidirectional relationships automatically
   - Executes before/after strategies
   - Uses atomic transactions
   - Updates relationship index
   - Emits RELATIONSHIP_REMOVED event
   - Idempotent (safe if already removed)

3. **`getRelationships(params: GetRelationshipsParams): Relationship[]`**
   - Queries by entity ID (required)
   - Filters by entity type (optional)
   - Filters by relationship type (optional)
   - O(1) lookup via index
   - Synchronous (no I/O)

4. **`getRelatedEntities<T>(entityId: string, relationshipType?: RelationshipType): Promise<T[]>`**
   - Returns actual entity objects (not just relationships)
   - Loads entities from storage
   - Handles both source and target relationships
   - Generic return type for type safety

5. **`registerStrategy(type: RelationshipType, strategy: RelationshipStrategy): void`**
   - Registers custom relationship-specific logic
   - Overwrites existing strategy if present
   - Used for AI associations, auto-linking, etc.

6. **`getCollectionName(entityType: EntityType): string`** (private, but critical)
   - Maps entity types to storage collection names
   - Used for loading entities

#### Private Helper Methods (4 methods)

1. **`addToEntity(txId: string, entityType: EntityType, entityId: string, relationship: Relationship): Promise<void>`**
   - Loads entity from storage
   - Adds relationship to entity.relationships array
   - Adds operation to transaction (does not commit)
   - Throws if entity not found

2. **`removeFromEntity(txId: string, entityType: EntityType, entityId: string, relationshipId: string): Promise<void>`**
   - Loads entity from storage
   - Removes relationship from entity.relationships array
   - Adds operation to transaction (does not commit)
   - Safe if entity or relationship not found

3. **`registerDefaultStrategies(): void`**
   - Registers built-in strategies for common relationship types
   - Called in constructor
   - Can be overridden later with registerStrategy()

4. **`createRelationship(...): Relationship`** (utility, not in spec but needed)
   - Creates a properly formatted Relationship object
   - Generates unique ID
   - Sets metadata defaults
   - Sets canonical flag

### 1.2 Required Interfaces (from S1 spec)

```typescript
export interface AddRelationshipParams {
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  type: RelationshipType;
  metadata?: Partial<RelationshipMetadata>;
}

export interface RemoveRelationshipParams {
  relationshipId: string;
}

export interface GetRelationshipsParams {
  entityId: string;
  entityType?: EntityType;
  relationshipType?: RelationshipType;
}

export interface RelationshipStrategy {
  beforeAdd(relationship: Relationship): Promise<void>;
  afterAdd(relationship: Relationship): Promise<void>;
  beforeRemove(relationship: Relationship): Promise<void>;
  afterRemove(relationship: Relationship): Promise<void>;
}

export abstract class BaseRelationshipStrategy implements RelationshipStrategy {
  async beforeAdd(relationship: Relationship): Promise<void> {}
  async afterAdd(relationship: Relationship): Promise<void> {}
  async beforeRemove(relationship: Relationship): Promise<void> {}
  async afterRemove(relationship: Relationship): Promise<void> {}
}
```

### 1.3 Dependencies

**From Foundation (F1-F3)**:
- `Relationship`, `RelationshipType`, `EntityType`, `RELATIONSHIP_CONFIGS` from `@/types/relationships`
- `Task`, `Note`, `Session` from `@/types`
- `StorageAdapter` from `@/services/storage` (provides beginTransaction, load, save)
- `RelationshipIndex` from `@/services/storage/relationshipIndex`
- `generateId` from `@/utils/helpers`

**Missing/To Create**:
- ✅ `EventBus` - **Does NOT exist in codebase** - need to create simple event emitter
- Strategy implementations (TaskNoteStrategy, etc.)

### 1.4 Acceptance Criteria (from S1 spec)

- [ ] All relationship operations are atomic (transaction-based)
- [ ] Bidirectional relationships maintained automatically
- [ ] No orphaned relationships after delete operations
- [ ] Strategy pattern allows customization per relationship type
- [ ] Event system emits events for add/remove operations
- [ ] Index stays synchronized with storage
- [ ] Validation prevents invalid relationship types
- [ ] Idempotent operations (safe to call multiple times)
- [ ] Test coverage >90% for core service

---

## 2. Architecture Design

### 2.1 Class Structure

```typescript
export class RelationshipManager {
  // ===== PROPERTIES =====
  private index: RelationshipIndex;
  private strategies: Map<RelationshipType, RelationshipStrategy>;
  private storage: StorageAdapter;
  private eventBus: EventBus;

  // ===== CONSTRUCTOR =====
  constructor(storage: StorageAdapter, eventBus: EventBus) {
    this.storage = storage;
    this.eventBus = eventBus;
    this.index = storage.getRelationshipIndex();
    this.strategies = new Map();
    this.registerDefaultStrategies();
  }

  // ===== PUBLIC API (6 methods) =====
  async addRelationship(params: AddRelationshipParams): Promise<Relationship>
  async removeRelationship(params: RemoveRelationshipParams): Promise<void>
  getRelationships(params: GetRelationshipsParams): Relationship[]
  async getRelatedEntities<T>(entityId: string, relationshipType?: RelationshipType): Promise<T[]>
  registerStrategy(type: RelationshipType, strategy: RelationshipStrategy): void

  // ===== PRIVATE HELPERS (4 methods) =====
  private async addToEntity(txId: string, entityType: EntityType, entityId: string, relationship: Relationship): Promise<void>
  private async removeFromEntity(txId: string, entityType: EntityType, entityId: string, relationshipId: string): Promise<void>
  private getCollectionName(entityType: EntityType): string
  private registerDefaultStrategies(): void
}
```

**Estimated Lines**: 600-800 lines (excluding strategies)

### 2.2 Method Signatures (Detailed)

#### addRelationship()

```typescript
/**
 * Add a new relationship between two entities
 *
 * Automatically creates bidirectional relationships if configured.
 * Uses atomic transactions to ensure consistency.
 * Emits RELATIONSHIP_ADDED event on success.
 *
 * @param params - Relationship parameters
 * @returns The created relationship
 * @throws Error if validation fails or transaction fails
 *
 * @example
 * ```typescript
 * const rel = await manager.addRelationship({
 *   sourceType: EntityType.TASK,
 *   sourceId: 'task-123',
 *   targetType: EntityType.NOTE,
 *   targetId: 'note-456',
 *   type: RelationshipType.TASK_NOTE,
 *   metadata: {
 *     source: 'manual',
 *     createdBy: 'user-1',
 *   },
 * });
 * ```
 */
async addRelationship(params: AddRelationshipParams): Promise<Relationship>
```

**Algorithm**:
1. Validate relationship type exists in RELATIONSHIP_CONFIGS → throw if invalid
2. Validate source type is allowed → throw if invalid
3. Validate target type is allowed → throw if invalid
4. Check if relationship already exists (idempotency) → return existing if found
5. Create canonical Relationship object
6. Execute strategy.beforeAdd() (if registered)
7. Begin transaction
8. Try:
   - Add relationship to source entity
   - If bidirectional: create and add reverse relationship to target entity
   - Commit transaction
   - Update index with canonical relationship
   - If bidirectional: update index with reverse relationship
   - Execute strategy.afterAdd()
   - Emit RELATIONSHIP_ADDED event
   - Return canonical relationship
9. Catch:
   - Rollback transaction
   - Re-throw error

**Time Complexity**: O(1) for index check, O(1) for entity load/save (IndexedDB), O(1) for index update
**Space Complexity**: O(1) - fixed overhead per relationship

#### removeRelationship()

```typescript
/**
 * Remove a relationship between two entities
 *
 * Automatically removes bidirectional relationships.
 * Uses atomic transactions to ensure consistency.
 * Emits RELATIONSHIP_REMOVED event on success.
 *
 * @param params - Relationship removal parameters
 * @throws Error if transaction fails
 *
 * @example
 * ```typescript
 * await manager.removeRelationship({
 *   relationshipId: 'rel-abc123',
 * });
 * ```
 */
async removeRelationship(params: RemoveRelationshipParams): Promise<void>
```

**Algorithm**:
1. Lookup relationship by ID in index → return early if not found (idempotent)
2. Get config to check if bidirectional
3. Execute strategy.beforeRemove() (if registered)
4. Begin transaction
5. Try:
   - Remove relationship from source entity
   - If bidirectional: find and remove reverse relationship from target entity
   - Commit transaction
   - Remove canonical relationship from index
   - If bidirectional: remove reverse relationship from index
   - Execute strategy.afterRemove()
   - Emit RELATIONSHIP_REMOVED event
6. Catch:
   - Rollback transaction
   - Re-throw error

#### getRelationships()

```typescript
/**
 * Get all relationships for an entity
 *
 * Filters by entity type and relationship type if provided.
 * Uses O(1) index lookup.
 *
 * @param params - Query parameters
 * @returns Array of matching relationships (empty if none found)
 *
 * @example
 * ```typescript
 * // Get all relationships for a task
 * const rels = manager.getRelationships({ entityId: 'task-123' });
 *
 * // Get only task-note relationships
 * const taskNotes = manager.getRelationships({
 *   entityId: 'task-123',
 *   relationshipType: RelationshipType.TASK_NOTE,
 * });
 * ```
 */
getRelationships(params: GetRelationshipsParams): Relationship[]
```

**Algorithm**:
1. Lookup relationships by entity ID in index (O(1))
2. Filter by entity type if provided
3. Filter by relationship type if provided
4. Return filtered array

**Time Complexity**: O(n) where n = relationships for entity (typically small)
**Space Complexity**: O(n) for filtered array

#### getRelatedEntities()

```typescript
/**
 * Get related entities for an entity
 *
 * Returns the actual entity objects, not just relationships.
 * Loads entities from storage.
 *
 * @param entityId - Entity to get related entities for
 * @param relationshipType - Optional filter by relationship type
 * @returns Array of related entities
 *
 * @example
 * ```typescript
 * // Get all notes related to a task
 * const notes = await manager.getRelatedEntities<Note>(
 *   'task-123',
 *   RelationshipType.TASK_NOTE
 * );
 * ```
 */
async getRelatedEntities<T>(
  entityId: string,
  relationshipType?: RelationshipType
): Promise<T[]>
```

**Algorithm**:
1. Get relationships using getRelationships()
2. For each relationship:
   - Determine target entity ID (could be sourceId or targetId)
   - Determine target entity type
   - Load entity from storage
   - Add to results array if found
3. Return results

**Time Complexity**: O(n * k) where n = relationships, k = storage load time (typically O(1))
**Space Complexity**: O(n) for results array

### 2.3 Dependencies

**Direct Dependencies**:
1. `StorageAdapter` - For loading/saving entities, transactions
   - Methods used: `beginTransaction()`, `load()`, `save()`
   - Already has `getRelationshipIndex()` method (confirmed in F2)
2. `RelationshipIndex` - For O(1) relationship lookups
   - Methods used: `add()`, `remove()`, `getByEntity()`, `getById()`, `exists()`, `getBetween()`
3. `EventBus` - For emitting events (DOES NOT EXIST - need to create)
   - Methods needed: `emit(event: string, data: any)`

**Indirect Dependencies**:
- Type definitions from `@/types/relationships`
- Entity types from `@/types`
- ID generator from `@/utils/helpers`

### 2.4 Error Handling Strategy

**Error Categories**:
1. **Validation Errors** - Invalid relationship type, invalid entity types
   - Throw immediately before any I/O
   - Message format: `"Invalid relationship type: {type}"`, `"Invalid source type {sourceType} for relationship {type}"`
2. **Not Found Errors** - Entity not found during add/remove
   - Throw from `addToEntity()` with message: `"Entity {entityType}:{entityId} not found"`
   - Safe in `removeFromEntity()` - just return early
3. **Transaction Errors** - Commit failure, rollback failure
   - Rollback transaction in catch block
   - Re-throw original error
4. **Strategy Errors** - Strategy throws during before/after hooks
   - Catch and rollback transaction
   - Wrap in RelationshipError with original error
   - Re-throw

**Error Wrapping**:
```typescript
export class RelationshipError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'RelationshipError';
  }
}
```

### 2.5 Event Emission Points

**Events to Emit**:
1. `RELATIONSHIP_ADDED` - After successful add
   - Payload: `{ relationship: Relationship }`
2. `RELATIONSHIP_REMOVED` - After successful remove
   - Payload: `{ relationship: Relationship }`

**Event Bus Interface** (to create):
```typescript
export interface EventBus {
  emit(event: string, data: any): void;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

export class SimpleEventBus implements EventBus {
  private listeners: Map<string, Set<(data: any) => void>>;

  constructor() {
    this.listeners = new Map();
  }

  emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: (data: any) => void): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }
}
```

**Location**: `/Users/jamesmcarthur/Documents/taskerino/src/services/EventBus.ts`

---

## 3. Implementation Steps

### Phase 1: Setup & Infrastructure (2 hours)

#### Step 1.1: Create EventBus service (30 min)
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/EventBus.ts`

**Tasks**:
- [ ] Define EventBus interface
- [ ] Implement SimpleEventBus class with Map-based storage
- [ ] Add emit(), on(), off() methods
- [ ] Add clear() method for testing
- [ ] Export singleton instance

**Lines to write**: ~80 lines
**Tests**: Create `/Users/jamesmcarthur/Documents/taskerino/tests/services/EventBus.test.ts` (5 tests)

**Test Cases**:
1. Should emit event to registered listener
2. Should emit to multiple listeners
3. Should not emit to removed listener
4. Should handle no listeners gracefully
5. Should isolate different event types

#### Step 1.2: Create RelationshipError class (15 min)
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/relationshipManager/errors.ts`

**Tasks**:
- [ ] Define RelationshipError class extending Error
- [ ] Add code, details properties
- [ ] Export error codes enum

**Lines to write**: ~40 lines
**Tests**: Include in relationshipManager tests

#### Step 1.3: Create base RelationshipManager class (45 min)
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/relationshipManager.ts`

**Tasks**:
- [ ] Import all dependencies
- [ ] Define class structure with properties
- [ ] Implement constructor
- [ ] Implement getCollectionName() helper
- [ ] Add JSDoc comments
- [ ] Export interfaces (AddRelationshipParams, etc.)

**Lines to write**: ~120 lines
**Tests**: Create `/Users/jamesmcarthur/Documents/taskerino/tests/services/relationshipManager.test.ts` with setup

**Test Setup**:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipManager } from '@/services/relationshipManager';
import { StorageAdapter } from '@/services/storage';
import { EventBus } from '@/services/EventBus';
import { RelationshipIndex } from '@/services/storage/relationshipIndex';

describe('RelationshipManager', () => {
  let manager: RelationshipManager;
  let storage: StorageAdapter;
  let eventBus: EventBus;
  let index: RelationshipIndex;

  beforeEach(async () => {
    // Create mock storage
    storage = createMockStorage();
    eventBus = new EventBus();
    index = new RelationshipIndex();

    // Stub storage.getRelationshipIndex()
    vi.spyOn(storage, 'getRelationshipIndex').mockReturnValue(index);

    manager = new RelationshipManager(storage, eventBus);
  });

  // Tests go here
});
```

#### Step 1.4: Create strategy base classes (30 min)
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/relationshipStrategies/RelationshipStrategy.ts`

**Tasks**:
- [ ] Define RelationshipStrategy interface
- [ ] Implement BaseRelationshipStrategy abstract class
- [ ] Add no-op default implementations

**Lines to write**: ~60 lines
**Tests**: Create `/Users/jamesmcarthur/Documents/taskerino/tests/services/relationshipStrategies/RelationshipStrategy.test.ts` (3 tests)

---

### Phase 2: Core CRUD - addRelationship() (4 hours)

#### Step 2.1: Implement validation logic (45 min)

**Tasks**:
- [ ] Validate relationship type exists
- [ ] Validate source type is allowed
- [ ] Validate target type is allowed
- [ ] Check for duplicate relationships (idempotency)
- [ ] Throw descriptive errors

**Lines to add**: ~30 lines
**Tests**: 6 validation test cases

**Test Cases**:
1. Should throw error for invalid relationship type
2. Should throw error for invalid source type
3. Should throw error for invalid target type
4. Should return existing relationship if duplicate
5. Should validate against RELATIONSHIP_CONFIGS
6. Should allow valid combinations

#### Step 2.2: Implement relationship creation (30 min)

**Tasks**:
- [ ] Create canonical Relationship object
- [ ] Generate unique ID
- [ ] Set metadata defaults
- [ ] Set canonical=true

**Lines to add**: ~25 lines
**Tests**: 4 creation test cases

**Test Cases**:
1. Should create relationship with all required fields
2. Should generate unique ID
3. Should set canonical=true for primary direction
4. Should merge provided metadata with defaults

#### Step 2.3: Implement bidirectional creation (45 min)

**Tasks**:
- [ ] Check if relationship type is bidirectional
- [ ] Create reverse relationship
- [ ] Set canonical=false for reverse
- [ ] Swap source/target

**Lines to add**: ~30 lines
**Tests**: 5 bidirectional test cases

**Test Cases**:
1. Should create reverse relationship for bidirectional types
2. Should not create reverse for unidirectional types
3. Should set canonical=false on reverse relationship
4. Should swap source/target correctly
5. Should preserve metadata on reverse

#### Step 2.4: Implement addToEntity() helper (1 hour)

**Tasks**:
- [ ] Load entity from storage using getCollectionName()
- [ ] Throw if entity not found
- [ ] Initialize relationships array if missing
- [ ] Push relationship to array
- [ ] Add write operation to transaction (do NOT commit)
- [ ] Store previous data for rollback

**Lines to add**: ~40 lines
**Tests**: 8 test cases

**Test Cases**:
1. Should load entity from correct collection
2. Should throw if entity not found
3. Should initialize relationships array if undefined
4. Should append to existing relationships
5. Should add operation to transaction
6. Should store previous data for rollback
7. Should handle all entity types (task, note, session)
8. Should not commit transaction (deferred to caller)

#### Step 2.5: Implement transaction commit with index update (45 min)

**Tasks**:
- [ ] Begin transaction
- [ ] Call addToEntity() for source
- [ ] Call addToEntity() for target (if bidirectional)
- [ ] Commit transaction
- [ ] Update index with canonical relationship
- [ ] Update index with reverse relationship (if bidirectional)
- [ ] Rollback on error

**Lines to add**: ~50 lines
**Tests**: 8 transaction test cases

**Test Cases**:
1. Should commit transaction with both entities
2. Should update index after commit
3. Should rollback on entity not found
4. Should rollback on storage error
5. Should not update index if rollback
6. Should handle bidirectional correctly
7. Should leave no partial state on error
8. Should be atomic (all or nothing)

#### Step 2.6: Implement strategy execution (30 min)

**Tasks**:
- [ ] Execute beforeAdd() before transaction
- [ ] Execute afterAdd() after commit
- [ ] Handle strategy errors

**Lines to add**: ~20 lines
**Tests**: 5 strategy test cases

**Test Cases**:
1. Should execute beforeAdd() before transaction
2. Should execute afterAdd() after commit
3. Should rollback if beforeAdd() throws
4. Should not call afterAdd() if commit fails
5. Should handle missing strategy gracefully

#### Step 2.7: Implement event emission (15 min)

**Tasks**:
- [ ] Emit RELATIONSHIP_ADDED after afterAdd()
- [ ] Include relationship in payload

**Lines to add**: ~5 lines
**Tests**: 2 event test cases

**Test Cases**:
1. Should emit RELATIONSHIP_ADDED event with relationship
2. Should not emit event if rollback

**Total for addRelationship()**: ~200 lines, 38 test cases

---

### Phase 3: Core CRUD - removeRelationship() (2.5 hours)

#### Step 3.1: Implement relationship lookup (30 min)

**Tasks**:
- [ ] Lookup relationship by ID in index
- [ ] Return early if not found (idempotent)
- [ ] Get config to check bidirectional

**Lines to add**: ~15 lines
**Tests**: 3 lookup test cases

**Test Cases**:
1. Should return early if relationship not found (idempotent)
2. Should lookup relationship from index
3. Should check bidirectional config

#### Step 3.2: Implement removeFromEntity() helper (1 hour)

**Tasks**:
- [ ] Load entity from storage
- [ ] Return early if entity not found (safe)
- [ ] Return early if no relationships array
- [ ] Filter out relationship by ID
- [ ] Add write operation to transaction
- [ ] Store previous data for rollback

**Lines to add**: ~35 lines
**Tests**: 7 test cases

**Test Cases**:
1. Should load entity from correct collection
2. Should return early if entity not found
3. Should return early if no relationships array
4. Should filter out relationship by ID
5. Should preserve other relationships
6. Should add operation to transaction
7. Should store previous data for rollback

#### Step 3.3: Implement bidirectional removal (45 min)

**Tasks**:
- [ ] Find reverse relationship in index
- [ ] Call removeFromEntity() for reverse
- [ ] Handle missing reverse gracefully

**Lines to add**: ~25 lines
**Tests**: 5 bidirectional test cases

**Test Cases**:
1. Should remove reverse relationship for bidirectional types
2. Should not remove anything for unidirectional types
3. Should handle missing reverse gracefully
4. Should find reverse using index.getByEntity()
5. Should match source/target correctly

#### Step 3.4: Implement transaction commit with index update (30 min)

**Tasks**:
- [ ] Begin transaction
- [ ] Call removeFromEntity() for source
- [ ] Call removeFromEntity() for target (if bidirectional)
- [ ] Commit transaction
- [ ] Remove from index
- [ ] Rollback on error

**Lines to add**: ~40 lines
**Tests**: 6 transaction test cases

**Test Cases**:
1. Should commit transaction
2. Should remove from index after commit
3. Should rollback on storage error
4. Should not update index if rollback
5. Should handle bidirectional correctly
6. Should be atomic

#### Step 3.5: Implement strategy execution and event emission (15 min)

**Tasks**:
- [ ] Execute beforeRemove() before transaction
- [ ] Execute afterRemove() after commit
- [ ] Emit RELATIONSHIP_REMOVED event

**Lines to add**: ~20 lines
**Tests**: 4 test cases

**Test Cases**:
1. Should execute beforeRemove() before transaction
2. Should execute afterRemove() after commit
3. Should emit RELATIONSHIP_REMOVED event
4. Should rollback if beforeRemove() throws

**Total for removeRelationship()**: ~135 lines, 25 test cases

---

### Phase 4: Query Methods (1.5 hours)

#### Step 4.1: Implement getRelationships() (30 min)

**Tasks**:
- [ ] Lookup by entity ID in index
- [ ] Filter by entity type (if provided)
- [ ] Filter by relationship type (if provided)
- [ ] Return filtered array

**Lines to add**: ~25 lines
**Tests**: 8 test cases

**Test Cases**:
1. Should get all relationships for entity
2. Should return empty array if no relationships
3. Should filter by entity type
4. Should filter by relationship type
5. Should filter by both entity type and relationship type
6. Should use O(1) index lookup
7. Should handle bidirectional relationships
8. Should include both source and target relationships

#### Step 4.2: Implement getRelatedEntities() (1 hour)

**Tasks**:
- [ ] Call getRelationships() with filters
- [ ] For each relationship, determine target entity
- [ ] Load entity from storage
- [ ] Filter out not found entities
- [ ] Return typed array

**Lines to add**: ~30 lines
**Tests**: 10 test cases

**Test Cases**:
1. Should load related entities from storage
2. Should return empty array if no relationships
3. Should filter by relationship type
4. Should handle both source and target relationships
5. Should skip entities not found
6. Should return correct entity type
7. Should work with generic type parameter
8. Should load from correct collection
9. Should handle multiple relationships
10. Should handle bidirectional relationships

**Total for query methods**: ~55 lines, 18 test cases

---

### Phase 5: Strategy System (2 hours)

#### Step 5.1: Implement registerStrategy() (15 min)

**Tasks**:
- [ ] Add strategy to strategies Map
- [ ] Overwrite if already exists

**Lines to add**: ~5 lines
**Tests**: 3 test cases

**Test Cases**:
1. Should register strategy for relationship type
2. Should overwrite existing strategy
3. Should allow retrieval of registered strategy

#### Step 5.2: Implement registerDefaultStrategies() (15 min)

**Tasks**:
- [ ] Create placeholder for future strategies
- [ ] Document where strategies will be registered

**Lines to add**: ~10 lines
**Tests**: 1 test case

**Test Case**:
1. Should initialize with no default strategies (to be added in S2)

#### Step 5.3: Create TaskNoteStrategy (30 min)

**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/relationshipStrategies/TaskNoteStrategy.ts`

**Tasks**:
- [ ] Extend BaseRelationshipStrategy
- [ ] Implement placeholder afterAdd() (log for now)
- [ ] Implement placeholder afterRemove() (log for now)
- [ ] Add JSDoc

**Lines to write**: ~50 lines
**Tests**: Create `/Users/jamesmcarthur/Documents/taskerino/tests/services/relationshipStrategies/TaskNoteStrategy.test.ts` (4 tests)

**Test Cases**:
1. Should extend BaseRelationshipStrategy
2. Should implement afterAdd()
3. Should implement afterRemove()
4. Should not throw errors

#### Step 5.4: Create TaskSessionStrategy (30 min)

**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/relationshipStrategies/TaskSessionStrategy.ts`

**Same as TaskNoteStrategy** - placeholder implementation

**Lines to write**: ~50 lines
**Tests**: 4 test cases

#### Step 5.5: Create NoteSessionStrategy (30 min)

**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/relationshipStrategies/NoteSessionStrategy.ts`

**Same as above** - placeholder implementation

**Lines to write**: ~50 lines
**Tests**: 4 test cases

**Total for strategy system**: ~165 lines, 16 test cases

---

### Phase 6: Integration & Edge Cases (2 hours)

#### Step 6.1: Integration tests (1 hour)

**File**: `/Users/jamesmcarthur/Documents/taskerino/tests/services/relationshipManager.integration.test.ts`

**Test Cases** (10 integration tests):
1. Should add relationship → query returns it
2. Should remove relationship → query returns empty
3. Should create bidirectional → both entities have relationship
4. Should remove bidirectional → both entities updated
5. Should load related entities → returns actual objects
6. Should handle multiple relationships on same entity
7. Should prevent duplicate relationships (idempotency)
8. Should rollback on entity not found
9. Should execute strategies in order
10. Should emit events for add and remove

#### Step 6.2: Edge case tests (30 min)

**Test Cases** (8 edge case tests):
1. Should handle entity with no relationships
2. Should handle removing non-existent relationship
3. Should handle concurrent operations (last write wins)
4. Should handle very large relationship counts (100+ per entity)
5. Should handle circular relationships (note-parent)
6. Should handle self-referencing relationships (task-task)
7. Should handle entity not found gracefully
8. Should handle storage failure gracefully

#### Step 6.3: Performance benchmarks (30 min)

**File**: `/Users/jamesmcarthur/Documents/taskerino/tests/services/relationshipManager.bench.ts`

**Benchmarks** (5 benchmarks):
1. Add relationship (should be <10ms)
2. Remove relationship (should be <10ms)
3. Get relationships (should be <5ms)
4. Get related entities (should be <50ms for 10 entities)
5. Bulk add 1000 relationships (should be <5 seconds)

**Total for integration**: ~300 lines of tests, 23 test cases

---

### Phase 7: Documentation (2 hours)

#### Step 7.1: API Reference Documentation (1 hour)

**File**: `/Users/jamesmcarthur/Documents/taskerino/docs/architecture/relationship-manager.md`

**Sections**:
- Overview
- Architecture diagram
- Public API reference
- Strategy pattern guide
- Event system
- Transaction guarantees
- Performance characteristics
- Migration from legacy fields

**Lines to write**: ~400 lines markdown

#### Step 7.2: Code Documentation (JSDoc) (30 min)

**Tasks**:
- [ ] Add JSDoc to all public methods
- [ ] Add @param, @returns, @throws tags
- [ ] Add @example code snippets
- [ ] Add @since tags

**Lines to add**: ~150 lines JSDoc comments

#### Step 7.3: Usage Examples (30 min)

**File**: `/Users/jamesmcarthur/Documents/taskerino/docs/examples/relationship-manager-usage.md`

**Examples**:
1. Basic add/remove
2. Querying relationships
3. Loading related entities
4. Custom strategies
5. Event listening
6. Error handling

**Lines to write**: ~200 lines markdown

**Total for documentation**: ~750 lines

---

## 4. Test Plan

### 4.1 Unit Tests (90+ tests)

#### addRelationship() Tests (38 tests)
**Category: Validation (6 tests)**
1. ✓ Should throw error for invalid relationship type
2. ✓ Should throw error for invalid source type
3. ✓ Should throw error for invalid target type
4. ✓ Should return existing relationship if duplicate (idempotent)
5. ✓ Should validate against RELATIONSHIP_CONFIGS
6. ✓ Should allow valid combinations

**Category: Creation (4 tests)**
7. ✓ Should create relationship with all required fields
8. ✓ Should generate unique ID
9. ✓ Should set canonical=true for primary direction
10. ✓ Should merge provided metadata with defaults

**Category: Bidirectional (5 tests)**
11. ✓ Should create reverse relationship for bidirectional types
12. ✓ Should not create reverse for unidirectional types
13. ✓ Should set canonical=false on reverse relationship
14. ✓ Should swap source/target correctly
15. ✓ Should preserve metadata on reverse

**Category: Entity Updates (8 tests)**
16. ✓ Should load entity from correct collection
17. ✓ Should throw if entity not found
18. ✓ Should initialize relationships array if undefined
19. ✓ Should append to existing relationships
20. ✓ Should add operation to transaction
21. ✓ Should store previous data for rollback
22. ✓ Should handle all entity types (task, note, session)
23. ✓ Should not commit transaction prematurely

**Category: Transactions (8 tests)**
24. ✓ Should commit transaction with both entities
25. ✓ Should update index after commit
26. ✓ Should rollback on entity not found
27. ✓ Should rollback on storage error
28. ✓ Should not update index if rollback
29. ✓ Should handle bidirectional correctly in transaction
30. ✓ Should leave no partial state on error
31. ✓ Should be atomic (all or nothing)

**Category: Strategies (5 tests)**
32. ✓ Should execute beforeAdd() before transaction
33. ✓ Should execute afterAdd() after commit
34. ✓ Should rollback if beforeAdd() throws
35. ✓ Should not call afterAdd() if commit fails
36. ✓ Should handle missing strategy gracefully

**Category: Events (2 tests)**
37. ✓ Should emit RELATIONSHIP_ADDED event with relationship
38. ✓ Should not emit event if rollback

#### removeRelationship() Tests (25 tests)
**Category: Lookup (3 tests)**
1. ✓ Should return early if relationship not found (idempotent)
2. ✓ Should lookup relationship from index
3. ✓ Should check bidirectional config

**Category: Entity Updates (7 tests)**
4. ✓ Should load entity from correct collection
5. ✓ Should return early if entity not found
6. ✓ Should return early if no relationships array
7. ✓ Should filter out relationship by ID
8. ✓ Should preserve other relationships
9. ✓ Should add operation to transaction
10. ✓ Should store previous data for rollback

**Category: Bidirectional (5 tests)**
11. ✓ Should remove reverse relationship for bidirectional types
12. ✓ Should not remove anything for unidirectional types
13. ✓ Should handle missing reverse gracefully
14. ✓ Should find reverse using index.getByEntity()
15. ✓ Should match source/target correctly

**Category: Transactions (6 tests)**
16. ✓ Should commit transaction
17. ✓ Should remove from index after commit
18. ✓ Should rollback on storage error
19. ✓ Should not update index if rollback
20. ✓ Should handle bidirectional correctly in transaction
21. ✓ Should be atomic

**Category: Strategies & Events (4 tests)**
22. ✓ Should execute beforeRemove() before transaction
23. ✓ Should execute afterRemove() after commit
24. ✓ Should emit RELATIONSHIP_REMOVED event
25. ✓ Should rollback if beforeRemove() throws

#### getRelationships() Tests (8 tests)
1. ✓ Should get all relationships for entity
2. ✓ Should return empty array if no relationships
3. ✓ Should filter by entity type
4. ✓ Should filter by relationship type
5. ✓ Should filter by both entity type and relationship type
6. ✓ Should use O(1) index lookup
7. ✓ Should handle bidirectional relationships
8. ✓ Should include both source and target relationships

#### getRelatedEntities() Tests (10 tests)
1. ✓ Should load related entities from storage
2. ✓ Should return empty array if no relationships
3. ✓ Should filter by relationship type
4. ✓ Should handle both source and target relationships
5. ✓ Should skip entities not found
6. ✓ Should return correct entity type
7. ✓ Should work with generic type parameter
8. ✓ Should load from correct collection
9. ✓ Should handle multiple relationships
10. ✓ Should handle bidirectional relationships

#### Strategy System Tests (16 tests)
**registerStrategy() (3 tests)**
1. ✓ Should register strategy for relationship type
2. ✓ Should overwrite existing strategy
3. ✓ Should allow retrieval of registered strategy

**registerDefaultStrategies() (1 test)**
4. ✓ Should initialize with no default strategies

**TaskNoteStrategy (4 tests)**
5. ✓ Should extend BaseRelationshipStrategy
6. ✓ Should implement afterAdd()
7. ✓ Should implement afterRemove()
8. ✓ Should not throw errors

**TaskSessionStrategy (4 tests)**
9-12. Same as TaskNoteStrategy

**NoteSessionStrategy (4 tests)**
13-16. Same as TaskNoteStrategy

### 4.2 Integration Tests (10 tests)

**File**: `tests/services/relationshipManager.integration.test.ts`

1. ✓ Should add relationship → query returns it
2. ✓ Should remove relationship → query returns empty
3. ✓ Should create bidirectional → both entities have relationship
4. ✓ Should remove bidirectional → both entities updated
5. ✓ Should load related entities → returns actual objects
6. ✓ Should handle multiple relationships on same entity
7. ✓ Should prevent duplicate relationships (idempotency)
8. ✓ Should rollback on entity not found
9. ✓ Should execute strategies in order
10. ✓ Should emit events for add and remove

### 4.3 Edge Case Tests (8 tests)

1. ✓ Should handle entity with no relationships
2. ✓ Should handle removing non-existent relationship
3. ✓ Should handle concurrent operations (last write wins)
4. ✓ Should handle very large relationship counts (100+ per entity)
5. ✓ Should handle circular relationships (note-parent)
6. ✓ Should handle self-referencing relationships (task-task)
7. ✓ Should handle entity not found gracefully
8. ✓ Should handle storage failure gracefully

### 4.4 Performance Benchmarks (5 benchmarks)

**File**: `tests/services/relationshipManager.bench.ts`

1. ✓ Add relationship (target: <10ms)
2. ✓ Remove relationship (target: <10ms)
3. ✓ Get relationships (target: <5ms)
4. ✓ Get related entities (target: <50ms for 10 entities)
5. ✓ Bulk add 1000 relationships (target: <5 seconds)

### 4.5 Test Coverage Target

**Overall**: >90% line coverage
**Breakdown**:
- `relationshipManager.ts`: >95% (core service, critical)
- `EventBus.ts`: >90%
- `RelationshipStrategy.ts`: >90%
- Strategy implementations: >85% (mostly placeholders for now)
- Integration tests: 100% coverage of critical paths

---

## 5. Quality Gates

### 5.1 Code Quality Checks

- [ ] **TypeScript Compilation**: Zero errors in strict mode
- [ ] **ESLint**: Zero errors, zero warnings
- [ ] **Type Coverage**: 100% (no `any` types except in EventBus payload)
- [ ] **Cyclomatic Complexity**: <15 for all methods
- [ ] **Max Method Length**: <100 lines per method
- [ ] **JSDoc Coverage**: 100% for public API

**Verification**:
```bash
npm run type-check
npm run lint
npx vitest run tests/services/relationshipManager.test.ts
```

### 5.2 Testing Quality Gates

- [ ] **Unit Test Coverage**: >90% lines, >85% branches
- [ ] **Integration Test Coverage**: 100% of critical paths
- [ ] **Test Execution Time**: All tests pass in <5 seconds
- [ ] **No Flaky Tests**: All tests deterministic, no random failures
- [ ] **Test Isolation**: Each test can run independently

**Verification**:
```bash
npm run test:coverage -- tests/services/relationshipManager
```

### 5.3 Performance Quality Gates

- [ ] **Add Relationship**: <10ms per operation (avg)
- [ ] **Remove Relationship**: <10ms per operation (avg)
- [ ] **Get Relationships**: <5ms per query (avg)
- [ ] **Get Related Entities**: <50ms for 10 entities (avg)
- [ ] **Memory**: No memory leaks (test with 10k relationships)

**Verification**:
```bash
npx vitest run tests/services/relationshipManager.bench.ts
```

### 5.4 Documentation Quality Gates

- [ ] **API Reference**: Complete with examples
- [ ] **Architecture Diagram**: Visual representation of system
- [ ] **Usage Examples**: At least 6 examples
- [ ] **Migration Guide**: Legacy → unified system
- [ ] **Error Catalog**: All errors documented

**Verification**: Manual review by separate agent

---

## 6. Acceptance Criteria Verification

### From S1 Spec:

- [ ] **AC1**: All relationship operations are atomic (transaction-based)
  - **How to Verify**: Run integration test "should rollback on entity not found"
  - **File**: `tests/services/relationshipManager.integration.test.ts`
  - **Command**: `npx vitest run tests/services/relationshipManager.integration.test.ts -t "rollback"`

- [ ] **AC2**: Bidirectional relationships maintained automatically
  - **How to Verify**: Run test "should create reverse relationship for bidirectional types"
  - **File**: `tests/services/relationshipManager.test.ts`
  - **Command**: `npx vitest run tests/services/relationshipManager.test.ts -t "bidirectional"`

- [ ] **AC3**: No orphaned relationships after delete operations
  - **How to Verify**: Run test "should remove bidirectional → both entities updated"
  - **File**: `tests/services/relationshipManager.integration.test.ts`
  - **Command**: `npx vitest run tests/services/relationshipManager.integration.test.ts -t "remove bidirectional"`

- [ ] **AC4**: Strategy pattern allows customization per relationship type
  - **How to Verify**: Run strategy tests + register custom strategy
  - **File**: `tests/services/relationshipStrategies/*.test.ts`
  - **Command**: `npx vitest run tests/services/relationshipStrategies/`

- [ ] **AC5**: Event system emits events for add/remove operations
  - **How to Verify**: Run test "should emit RELATIONSHIP_ADDED/REMOVED event"
  - **File**: `tests/services/relationshipManager.test.ts`
  - **Command**: `npx vitest run tests/services/relationshipManager.test.ts -t "emit"`

- [ ] **AC6**: Index stays synchronized with storage
  - **How to Verify**: Run test "should update index after commit"
  - **File**: `tests/services/relationshipManager.test.ts`
  - **Command**: `npx vitest run tests/services/relationshipManager.test.ts -t "index"`

- [ ] **AC7**: Validation prevents invalid relationship types
  - **How to Verify**: Run validation tests
  - **File**: `tests/services/relationshipManager.test.ts`
  - **Command**: `npx vitest run tests/services/relationshipManager.test.ts -t "validation"`

- [ ] **AC8**: Idempotent operations (safe to call multiple times)
  - **How to Verify**: Run test "should prevent duplicate relationships"
  - **File**: `tests/services/relationshipManager.integration.test.ts`
  - **Command**: `npx vitest run tests/services/relationshipManager.integration.test.ts -t "idempotent"`

- [ ] **AC9**: Test coverage >90% for core service
  - **How to Verify**: Run coverage report
  - **Command**: `npm run test:coverage -- tests/services/relationshipManager`
  - **Expected**: Lines >90%, Branches >85%

---

## 7. Timeline & Estimates

### Detailed Breakdown

| Phase | Task | Est. Time | Actual | Status |
|-------|------|-----------|--------|--------|
| **Phase 1: Setup** | | **2h** | | |
| 1.1 | Create EventBus | 30m | | ⬜ |
| 1.2 | Create RelationshipError | 15m | | ⬜ |
| 1.3 | Create base class | 45m | | ⬜ |
| 1.4 | Create strategy base | 30m | | ⬜ |
| **Phase 2: addRelationship** | | **4h** | | |
| 2.1 | Validation logic | 45m | | ⬜ |
| 2.2 | Relationship creation | 30m | | ⬜ |
| 2.3 | Bidirectional creation | 45m | | ⬜ |
| 2.4 | addToEntity() helper | 1h | | ⬜ |
| 2.5 | Transaction commit | 45m | | ⬜ |
| 2.6 | Strategy execution | 30m | | ⬜ |
| 2.7 | Event emission | 15m | | ⬜ |
| **Phase 3: removeRelationship** | | **2.5h** | | |
| 3.1 | Relationship lookup | 30m | | ⬜ |
| 3.2 | removeFromEntity() helper | 1h | | ⬜ |
| 3.3 | Bidirectional removal | 45m | | ⬜ |
| 3.4 | Transaction commit | 30m | | ⬜ |
| 3.5 | Strategy & events | 15m | | ⬜ |
| **Phase 4: Query Methods** | | **1.5h** | | |
| 4.1 | getRelationships() | 30m | | ⬜ |
| 4.2 | getRelatedEntities() | 1h | | ⬜ |
| **Phase 5: Strategy System** | | **2h** | | |
| 5.1 | registerStrategy() | 15m | | ⬜ |
| 5.2 | registerDefaultStrategies() | 15m | | ⬜ |
| 5.3 | TaskNoteStrategy | 30m | | ⬜ |
| 5.4 | TaskSessionStrategy | 30m | | ⬜ |
| 5.5 | NoteSessionStrategy | 30m | | ⬜ |
| **Phase 6: Integration** | | **2h** | | |
| 6.1 | Integration tests | 1h | | ⬜ |
| 6.2 | Edge case tests | 30m | | ⬜ |
| 6.3 | Performance benchmarks | 30m | | ⬜ |
| **Phase 7: Documentation** | | **2h** | | |
| 7.1 | API reference | 1h | | ⬜ |
| 7.2 | Code documentation | 30m | | ⬜ |
| 7.3 | Usage examples | 30m | | ⬜ |
| **TOTAL** | | **16h** | | |

**Buffer**: 2 hours for unexpected issues
**Realistic Total**: **14 hours** (without major blockers)

### Critical Path

```
Phase 1 (Setup) → Phase 2 (addRelationship) → Phase 3 (removeRelationship) → Phase 6 (Integration Tests) → Phase 7 (Documentation)

Parallel Tracks:
- Phase 4 (Query Methods) can be done in parallel with Phase 3
- Phase 5 (Strategy System) can be done in parallel with Phase 4
```

---

## 8. Risk Mitigation

### Risk 1: Transaction Rollback Complexity
**Severity**: MEDIUM
**Likelihood**: MEDIUM
**Impact**: Could cause data corruption if not handled correctly

**Mitigation**:
- Follow established patterns from F2 transaction tests
- Test extensively with simulated failures
- Add integration test that forces rollback at each step
- Review F2 transaction implementation before starting

### Risk 2: Event Bus Not Existing
**Severity**: LOW
**Likelihood**: HIGH (confirmed - does not exist)
**Impact**: Need to create simple implementation

**Mitigation**:
- ✅ Already planned in Phase 1.1
- Use simple Map-based implementation (proven pattern)
- Only 80 lines to implement
- Low risk - straightforward implementation

### Risk 3: Index Synchronization Bugs
**Severity**: HIGH
**Likelihood**: LOW
**Impact**: Index out of sync with storage could cause data integrity issues

**Mitigation**:
- Update index ONLY after successful transaction commit
- Never update index before commit
- Add integration test that verifies index state after rollback
- Add test that compares index contents to storage contents

### Risk 4: Bidirectional Relationship Complexity
**Severity**: MEDIUM
**Likelihood**: MEDIUM
**Impact**: Could create orphaned reverse relationships

**Mitigation**:
- Always create/remove reverse relationships in same transaction
- Add integration test that verifies both directions
- Add test that verifies reverse relationship has canonical=false
- Document bidirectional logic clearly in code comments

### Risk 5: Strategy Execution Timing Bugs
**Severity**: LOW
**Likelihood**: LOW
**Impact**: Strategies executing at wrong time could cause issues

**Mitigation**:
- beforeAdd() executes BEFORE transaction begins
- afterAdd() executes AFTER transaction commits
- Document execution order in JSDoc
- Add test that verifies execution order

### Risk 6: Performance Degradation with Large Relationship Counts
**Severity**: LOW
**Likelihood**: LOW
**Impact**: Slow queries if index not working correctly

**Mitigation**:
- Use RelationshipIndex for O(1) lookups (already validated in F2)
- Add performance benchmark with 10k relationships
- Monitor memory usage with large relationship counts
- Document performance characteristics in API docs

---

## 9. Next Steps After S1

### Immediate Next Steps (After S1 Validation)

1. **S2: AI Associations** - Auto-detect and suggest relationships
2. **Integration Testing** - Test with real Note/Task/Session data
3. **UI Integration** - Hook up RelationshipManager to existing contexts

### Long-term Next Steps (Phase 2+)

1. **Cascade Delete** - Implement cascade delete for specific relationship types
2. **Advanced Strategies** - Implement full logic in TaskNoteStrategy, etc.
3. **Relationship Queries** - Complex graph queries (e.g., "Find all notes related to tasks in project X")
4. **Relationship Visualization** - Graph view of entity relationships
5. **Relationship History** - Track relationship creation/deletion over time

---

## 10. Deliverables Checklist

### Code Deliverables

- [ ] `/Users/jamesmcarthur/Documents/taskerino/src/services/EventBus.ts` (~80 lines)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/src/services/relationshipManager/errors.ts` (~40 lines)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/src/services/relationshipManager.ts` (~700 lines)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/src/services/relationshipStrategies/RelationshipStrategy.ts` (~60 lines)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/src/services/relationshipStrategies/TaskNoteStrategy.ts` (~50 lines)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/src/services/relationshipStrategies/TaskSessionStrategy.ts` (~50 lines)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/src/services/relationshipStrategies/NoteSessionStrategy.ts` (~50 lines)

**Total Code**: ~1,130 lines

### Test Deliverables

- [ ] `/Users/jamesmcarthur/Documents/taskerino/tests/services/EventBus.test.ts` (5 tests)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/tests/services/relationshipManager.test.ts` (81 tests)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/tests/services/relationshipManager.integration.test.ts` (10 tests)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/tests/services/relationshipManager.bench.ts` (5 benchmarks)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/tests/services/relationshipStrategies/RelationshipStrategy.test.ts` (3 tests)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/tests/services/relationshipStrategies/TaskNoteStrategy.test.ts` (4 tests)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/tests/services/relationshipStrategies/TaskSessionStrategy.test.ts` (4 tests)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/tests/services/relationshipStrategies/NoteSessionStrategy.test.ts` (4 tests)

**Total Tests**: 116 tests + 5 benchmarks

### Documentation Deliverables

- [ ] `/Users/jamesmcarthur/Documents/taskerino/docs/architecture/relationship-manager.md` (~400 lines)
- [ ] `/Users/jamesmcarthur/Documents/taskerino/docs/examples/relationship-manager-usage.md` (~200 lines)
- [ ] JSDoc comments in all source files (~150 lines)

**Total Documentation**: ~750 lines

---

## 11. Success Metrics

### Quantitative Metrics

- **Code Quality**: 0 TypeScript errors, 0 ESLint errors
- **Test Coverage**: >90% line coverage, >85% branch coverage
- **Test Count**: 116 unit/integration tests, 5 performance benchmarks
- **Performance**: All operations <10ms (except bulk operations)
- **Documentation**: 100% public API documented with examples

### Qualitative Metrics

- **Code Clarity**: All methods <100 lines, clear separation of concerns
- **Type Safety**: 100% type coverage, no `any` types (except EventBus payload)
- **Error Handling**: All errors have descriptive messages and error codes
- **Testability**: All tests can run independently, no flaky tests
- **Maintainability**: Clear architecture, well-documented, easy to extend

### Acceptance

- **Automated**: All quality gates pass (`npm run type-check && npm run lint && npm run test:coverage`)
- **Manual**: Separate agent reviews code and documentation
- **Integration**: Service can be used in existing Note/Task/Session workflows

---

## 12. Implementation Notes

### Key Design Decisions

1. **EventBus Implementation**: Simple Map-based event emitter (not React context)
   - Rationale: Decouples RelationshipManager from React, testable
   - Alternative: Use existing React context system (rejected - adds React dependency)

2. **Strategy Pattern**: Use Map for strategy registry
   - Rationale: O(1) lookup, easy to extend, type-safe
   - Alternative: Class inheritance (rejected - less flexible)

3. **Transaction Scope**: Create reverse relationships in same transaction
   - Rationale: Ensures atomic bidirectional updates
   - Alternative: Separate transactions (rejected - could cause orphans)

4. **Index Update Timing**: Update index AFTER transaction commit
   - Rationale: Prevents index from being out of sync on rollback
   - Alternative: Update before commit (rejected - rollback complexity)

5. **Error Handling**: Throw descriptive errors, rollback on failure
   - Rationale: Clear error messages, no partial state
   - Alternative: Return error objects (rejected - async/await pattern)

### Reference Implementations

- **Transaction Pattern**: See `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/__tests__/transactions.integration.test.ts`
- **Index Pattern**: See `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/relationshipIndex.ts`
- **Type System**: See `/Users/jamesmcarthur/Documents/taskerino/src/types/relationships.ts`

### Development Tips

1. **Start Simple**: Implement addRelationship() with unidirectional relationships first
2. **Test as You Go**: Write tests immediately after implementing each method
3. **Use Type Guards**: Leverage TypeScript for compile-time validation
4. **Mock Storage**: Create lightweight mock for unit tests
5. **Real Storage**: Use real storage adapter for integration tests

---

## APPENDIX A: Test Case Matrix

### addRelationship() - 38 Test Cases

| # | Category | Test Name | Input | Expected Output | Assertions |
|---|----------|-----------|-------|-----------------|------------|
| 1 | Validation | Invalid relationship type | type='invalid' | Throws error | Error message includes type |
| 2 | Validation | Invalid source type | sourceType='invalid' | Throws error | Error message includes sourceType |
| 3 | Validation | Invalid target type | targetType='invalid' | Throws error | Error message includes targetType |
| 4 | Validation | Duplicate relationship | Same params twice | Returns existing | Same ID, no new relationship |
| 5 | Validation | Valid config check | Valid params | Success | Uses RELATIONSHIP_CONFIGS |
| 6 | Validation | Valid combination | Valid task-note | Success | Creates relationship |
| 7 | Creation | All required fields | Valid params | Relationship | Has id, type, source, target |
| 8 | Creation | Unique ID generation | Multiple adds | Unique IDs | All IDs different |
| 9 | Creation | Canonical flag | Add relationship | canonical=true | Canonical field set |
| 10 | Creation | Metadata merge | Partial metadata | Merged metadata | Defaults + provided |
| 11 | Bidirectional | Create reverse | Bidirectional type | 2 relationships | Source and target |
| 12 | Bidirectional | No reverse | Unidirectional type | 1 relationship | Only canonical |
| 13 | Bidirectional | Canonical flag | Reverse relationship | canonical=false | Reverse not canonical |
| 14 | Bidirectional | Swap source/target | Reverse relationship | Swapped | Source↔target |
| 15 | Bidirectional | Preserve metadata | Reverse relationship | Same metadata | metadata matches |
| 16 | Entity Updates | Load from collection | Add to task | Loads task | getCollectionName('task') |
| 17 | Entity Updates | Entity not found | Invalid entity ID | Throws error | Error message includes ID |
| 18 | Entity Updates | Initialize array | No relationships | Array created | relationships=[] |
| 19 | Entity Updates | Append to existing | Existing relationships | Appended | Length increased |
| 20 | Entity Updates | Add to transaction | Add operation | Operation added | tx.operations.length |
| 21 | Entity Updates | Store previous data | Before update | Stored | previousData exists |
| 22 | Entity Updates | All entity types | Task, Note, Session | All work | Correct collections |
| 23 | Entity Updates | No premature commit | Add operation | Not committed | Transaction pending |
| 24 | Transactions | Commit with both | Source + target | Both saved | Storage has both |
| 25 | Transactions | Update index | After commit | Index updated | index.getById() works |
| 26 | Transactions | Rollback on not found | Entity not found | Rolled back | No changes in storage |
| 27 | Transactions | Rollback on error | Storage error | Rolled back | No partial state |
| 28 | Transactions | No index update on rollback | Rollback | Index unchanged | index.getById() returns undefined |
| 29 | Transactions | Bidirectional transaction | Bidirectional add | Both in tx | 2 operations |
| 30 | Transactions | No partial state | Mid-transaction error | Clean rollback | Storage unchanged |
| 31 | Transactions | Atomic | All or nothing | Committed | All changes or none |
| 32 | Strategies | beforeAdd() timing | Add relationship | Before transaction | Called before tx |
| 33 | Strategies | afterAdd() timing | Add relationship | After commit | Called after commit |
| 34 | Strategies | beforeAdd() error | Strategy throws | Rolled back | Transaction rolled back |
| 35 | Strategies | No afterAdd() on fail | Commit fails | Not called | afterAdd() not called |
| 36 | Strategies | Missing strategy | No strategy | Works | No error |
| 37 | Events | RELATIONSHIP_ADDED | Add relationship | Event emitted | eventBus.emit() called |
| 38 | Events | No event on rollback | Rollback | No event | eventBus.emit() not called |

### removeRelationship() - 25 Test Cases

| # | Category | Test Name | Input | Expected Output | Assertions |
|---|----------|-----------|-------|-----------------|------------|
| 1 | Lookup | Not found (idempotent) | Invalid ID | No error | Returns early |
| 2 | Lookup | Lookup from index | Valid ID | Found | index.getById() |
| 3 | Lookup | Check bidirectional | Valid relationship | Config loaded | Uses RELATIONSHIP_CONFIGS |
| 4 | Entity Updates | Load from collection | Remove from task | Loads task | Correct collection |
| 5 | Entity Updates | Entity not found | Invalid entity | No error | Safe return |
| 6 | Entity Updates | No relationships array | Entity without rels | No error | Safe return |
| 7 | Entity Updates | Filter by ID | Remove relationship | Filtered | Only target removed |
| 8 | Entity Updates | Preserve others | Multiple rels | Others kept | Other rels intact |
| 9 | Entity Updates | Add to transaction | Remove operation | Operation added | tx.operations.length |
| 10 | Entity Updates | Store previous | Before update | Stored | previousData exists |
| 11 | Bidirectional | Remove reverse | Bidirectional type | Both removed | Source and target |
| 12 | Bidirectional | No reverse removal | Unidirectional | Only one removed | Only canonical |
| 13 | Bidirectional | Missing reverse | Reverse not found | No error | Safe handling |
| 14 | Bidirectional | Find reverse | Use index | Found | index.getByEntity() |
| 15 | Bidirectional | Match source/target | Reverse lookup | Correct match | IDs match |
| 16 | Transactions | Commit | Remove operation | Committed | Storage updated |
| 17 | Transactions | Update index | After commit | Index updated | index.getById() undefined |
| 18 | Transactions | Rollback on error | Storage error | Rolled back | No changes |
| 19 | Transactions | No index update | Rollback | Index unchanged | getById() still works |
| 20 | Transactions | Bidirectional transaction | Remove bidirectional | Both in tx | 2 operations |
| 21 | Transactions | Atomic | All or nothing | Committed | All or none |
| 22 | Strategies | beforeRemove() timing | Remove relationship | Before transaction | Called before tx |
| 23 | Strategies | afterRemove() timing | Remove relationship | After commit | Called after commit |
| 24 | Events | RELATIONSHIP_REMOVED | Remove relationship | Event emitted | eventBus.emit() called |
| 25 | Strategies | beforeRemove() error | Strategy throws | Rolled back | Transaction rolled back |

### getRelationships() - 8 Test Cases

| # | Test Name | Input | Expected Output | Assertions |
|---|-----------|-------|-----------------|------------|
| 1 | Get all for entity | entityId='task-1' | All rels | All relationships returned |
| 2 | Empty array | entityId='none' | [] | Empty array |
| 3 | Filter by entity type | entityType='task' | Filtered | Only task relationships |
| 4 | Filter by rel type | relationshipType='task-note' | Filtered | Only task-note |
| 5 | Filter by both | Both filters | Filtered | Intersection |
| 6 | O(1) lookup | Any entity | Fast | Uses index.getByEntity() |
| 7 | Bidirectional handling | Bidirectional rel | Both directions | Source and target |
| 8 | Include both roles | Entity as source/target | Both | All relationships |

### getRelatedEntities() - 10 Test Cases

| # | Test Name | Input | Expected Output | Assertions |
|---|-----------|-------|-----------------|------------|
| 1 | Load related entities | entityId='task-1' | Array of entities | Entities loaded |
| 2 | Empty array | No relationships | [] | Empty array |
| 3 | Filter by type | relationshipType | Filtered | Only specified type |
| 4 | Both source and target | Bidirectional | Both directions | All related |
| 5 | Skip not found | Missing entity | Skipped | No error |
| 6 | Correct entity type | Type parameter | Typed array | Correct types |
| 7 | Generic type parameter | getRelatedEntities<Note> | Note[] | TypeScript inference |
| 8 | Correct collection | Various types | Correct loads | Right collections |
| 9 | Multiple relationships | Multiple rels | All entities | All loaded |
| 10 | Bidirectional relationships | Bidirectional | Both directions | Source and target |

---

## APPENDIX B: Method Signature Reference

```typescript
// ===== PUBLIC API =====

/**
 * Add a new relationship between two entities
 */
async addRelationship(params: AddRelationshipParams): Promise<Relationship>

/**
 * Remove a relationship between two entities
 */
async removeRelationship(params: RemoveRelationshipParams): Promise<void>

/**
 * Get all relationships for an entity
 */
getRelationships(params: GetRelationshipsParams): Relationship[]

/**
 * Get related entities for an entity
 */
async getRelatedEntities<T>(
  entityId: string,
  relationshipType?: RelationshipType
): Promise<T[]>

/**
 * Register a custom strategy for a relationship type
 */
registerStrategy(type: RelationshipType, strategy: RelationshipStrategy): void

// ===== PRIVATE HELPERS =====

/**
 * Add relationship to entity's relationships array
 */
private async addToEntity(
  txId: string,
  entityType: EntityType,
  entityId: string,
  relationship: Relationship
): Promise<void>

/**
 * Remove relationship from entity's relationships array
 */
private async removeFromEntity(
  txId: string,
  entityType: EntityType,
  entityId: string,
  relationshipId: string
): Promise<void>

/**
 * Get storage collection name for entity type
 */
private getCollectionName(entityType: EntityType): string

/**
 * Register default strategies
 */
private registerDefaultStrategies(): void
```

---

## APPENDIX C: Integration Checklist

### Pre-Implementation Checklist

- [x] F1 (Type System) complete and validated
- [x] F2 (Storage Layer) complete and validated
- [x] F3 (Migration Service) exists (needs integration testing)
- [ ] Review F2 transaction implementation
- [ ] Review RelationshipIndex API
- [ ] Identify EventBus requirements

### Post-Implementation Checklist

- [ ] All acceptance criteria verified
- [ ] All quality gates passed
- [ ] Documentation complete and reviewed
- [ ] Performance benchmarks met
- [ ] Integration tests passing
- [ ] Code reviewed by separate agent
- [ ] Merged to main branch
- [ ] Ready for S2 (AI Associations)

---

## CONCLUSION

This implementation plan provides **zero ambiguity** for building the RelationshipManager service. Every method, test case, and deliverable is specified in detail. An implementing agent can follow this plan step-by-step to build a production-quality service with >90% test coverage.

**Key Success Factors**:
1. ✅ All dependencies (F1-F3) are complete
2. ✅ Clear separation of concerns (strategy pattern, transactions, index)
3. ✅ Comprehensive test plan (116 tests + 5 benchmarks)
4. ✅ Detailed error handling strategy
5. ✅ Performance targets defined
6. ✅ Documentation requirements specified

**Estimated Time**: 14 hours (conservative estimate with buffer)

**Next Steps**: Assign to implementing agent, track progress against timeline, validate against acceptance criteria.
