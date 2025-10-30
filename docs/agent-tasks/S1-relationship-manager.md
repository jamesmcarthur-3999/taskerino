# AGENT TASK S1: Relationship Manager

**Objective:** Build the core RelationshipManager service with bidirectional sync and strategy pattern.

**Priority:** P0 (Core Service)

**Dependencies:** F1 (Type System), F2 (Storage Layer), F3 (Migration Service)

**Complexity:** High

**Estimated Time:** 10-12 hours

---

## Detailed Requirements

### 1. Create Relationship Manager Service

**File:** `src/services/relationshipManager.ts`

The RelationshipManager is the core service for all relationship operations. It ensures bidirectional consistency, provides validation, and supports the strategy pattern for relationship-specific logic.

**Core Implementation:**

```typescript
import { Relationship, RelationshipType, EntityType, RELATIONSHIP_CONFIGS } from '@/types/relationships';
import { Task, Note, Session } from '@/types';
import { StorageService } from '@/services/storage';
import { RelationshipIndex } from '@/services/storage/relationshipIndex';
import { generateId } from '@/utils/helpers';

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

export class RelationshipManager {
  private index: RelationshipIndex;
  private strategies: Map<RelationshipType, RelationshipStrategy>;

  constructor(
    private storage: StorageService,
    private eventBus: EventBus
  ) {
    this.index = storage.getRelationshipIndex();
    this.strategies = new Map();
    this.registerDefaultStrategies();
  }

  /**
   * Add a new relationship
   * Automatically creates bidirectional relationships if configured
   */
  async addRelationship(params: AddRelationshipParams): Promise<Relationship> {
    const { sourceType, sourceId, targetType, targetId, type, metadata } = params;

    // Validate relationship type configuration
    const config = RELATIONSHIP_CONFIGS[type];
    if (!config) {
      throw new Error(`Invalid relationship type: ${type}`);
    }

    // Validate source and target types
    if (!config.sourceTypes.includes(sourceType)) {
      throw new Error(`Invalid source type ${sourceType} for relationship ${type}`);
    }
    if (!config.targetTypes.includes(targetType)) {
      throw new Error(`Invalid target type ${targetType} for relationship ${type}`);
    }

    // Check if relationship already exists
    const existing = this.index.getBetween(sourceId, targetId);
    if (existing && existing.type === type) {
      return existing; // Idempotent
    }

    // Create relationship
    const relationship: Relationship = {
      id: generateId(),
      type,
      sourceType,
      sourceId,
      targetType,
      targetId,
      metadata: {
        source: metadata?.source || 'manual',
        createdAt: metadata?.createdAt || new Date().toISOString(),
        ...metadata,
      },
      canonical: true,
    };

    // Execute strategy (if defined)
    const strategy = this.strategies.get(type);
    if (strategy) {
      await strategy.beforeAdd(relationship);
    }

    // Begin transaction
    const txId = this.storage.beginTransaction();

    try {
      // Add to source entity
      await this.addToEntity(txId, sourceType, sourceId, relationship);

      // Add to target entity (if bidirectional)
      if (config.bidirectional) {
        const reverseRelationship: Relationship = {
          ...relationship,
          id: generateId(),
          sourceType: targetType,
          sourceId: targetId,
          targetType: sourceType,
          targetId: sourceId,
          canonical: false, // Reverse relationship
        };
        await this.addToEntity(txId, targetType, targetId, reverseRelationship);
      }

      // Commit transaction
      await this.storage.commitTransaction(txId);

      // Update index
      this.index.add(relationship);
      if (config.bidirectional) {
        // Also add reverse to index
      }

      // Execute strategy post-add
      if (strategy) {
        await strategy.afterAdd(relationship);
      }

      // Emit event
      this.eventBus.emit('RELATIONSHIP_ADDED', { relationship });

      return relationship;
    } catch (error) {
      await this.storage.rollbackTransaction(txId);
      throw error;
    }
  }

  /**
   * Remove a relationship
   * Automatically removes bidirectional relationships
   */
  async removeRelationship(params: RemoveRelationshipParams): Promise<void> {
    const { relationshipId } = params;

    const relationship = this.index.getById(relationshipId);
    if (!relationship) {
      return; // Idempotent
    }

    const config = RELATIONSHIP_CONFIGS[relationship.type];

    // Execute strategy
    const strategy = this.strategies.get(relationship.type);
    if (strategy) {
      await strategy.beforeRemove(relationship);
    }

    // Begin transaction
    const txId = this.storage.beginTransaction();

    try {
      // Remove from source entity
      await this.removeFromEntity(txId, relationship.sourceType, relationship.sourceId, relationshipId);

      // Remove from target entity (if bidirectional)
      if (config.bidirectional) {
        // Find and remove reverse relationship
        const targetRels = this.index.getByEntity(relationship.targetId);
        const reverseRel = targetRels.find(
          r => r.sourceId === relationship.targetId && r.targetId === relationship.sourceId && r.type === relationship.type
        );
        if (reverseRel) {
          await this.removeFromEntity(txId, relationship.targetType, relationship.targetId, reverseRel.id);
        }
      }

      // Commit transaction
      await this.storage.commitTransaction(txId);

      // Update index
      this.index.remove(relationshipId);

      // Execute strategy post-remove
      if (strategy) {
        await strategy.afterRemove(relationship);
      }

      // Emit event
      this.eventBus.emit('RELATIONSHIP_REMOVED', { relationship });
    } catch (error) {
      await this.storage.rollbackTransaction(txId);
      throw error;
    }
  }

  /**
   * Get relationships for an entity
   */
  getRelationships(params: GetRelationshipsParams): Relationship[] {
    const { entityId, entityType, relationshipType } = params;

    let relationships = this.index.getByEntity(entityId);

    // Filter by entity type (source or target)
    if (entityType) {
      relationships = relationships.filter(
        r => r.sourceType === entityType || r.targetType === entityType
      );
    }

    // Filter by relationship type
    if (relationshipType) {
      relationships = relationships.filter(r => r.type === relationshipType);
    }

    return relationships;
  }

  /**
   * Get related entities
   * Returns the actual entity objects, not just relationships
   */
  async getRelatedEntities<T>(
    entityId: string,
    relationshipType?: RelationshipType
  ): Promise<T[]> {
    const relationships = this.getRelationships({ entityId, relationshipType });

    const entities: T[] = [];
    for (const rel of relationships) {
      // Determine which entity to fetch
      const targetId = rel.sourceId === entityId ? rel.targetId : rel.sourceId;
      const targetType = rel.sourceId === entityId ? rel.targetType : rel.sourceType;

      // Load entity
      const entity = await this.storage.load(this.getCollectionName(targetType), targetId);
      if (entity) {
        entities.push(entity as T);
      }
    }

    return entities;
  }

  /**
   * Add relationship to entity's relationships array
   */
  private async addToEntity(
    txId: string,
    entityType: EntityType,
    entityId: string,
    relationship: Relationship
  ): Promise<void> {
    const collectionName = this.getCollectionName(entityType);
    const entity = await this.storage.load(collectionName, entityId);

    if (!entity) {
      throw new Error(`Entity ${entityType}:${entityId} not found`);
    }

    // Add relationship to entity
    if (!entity.relationships) {
      entity.relationships = [];
    }
    entity.relationships.push(relationship);

    // Save entity (add to transaction)
    this.storage.addOperation(txId, {
      type: 'write',
      collection: collectionName,
      entityId,
      data: entity,
      previousData: { ...entity, relationships: entity.relationships.slice(0, -1) },
    });
  }

  /**
   * Remove relationship from entity's relationships array
   */
  private async removeFromEntity(
    txId: string,
    entityType: EntityType,
    entityId: string,
    relationshipId: string
  ): Promise<void> {
    const collectionName = this.getCollectionName(entityType);
    const entity = await this.storage.load(collectionName, entityId);

    if (!entity || !entity.relationships) {
      return;
    }

    // Remove relationship from entity
    const previousRelationships = [...entity.relationships];
    entity.relationships = entity.relationships.filter(r => r.id !== relationshipId);

    // Save entity (add to transaction)
    this.storage.addOperation(txId, {
      type: 'write',
      collection: collectionName,
      entityId,
      data: entity,
      previousData: { ...entity, relationships: previousRelationships },
    });
  }

  /**
   * Get collection name for entity type
   */
  private getCollectionName(entityType: EntityType): string {
    const map: Record<EntityType, string> = {
      [EntityType.TASK]: 'tasks',
      [EntityType.NOTE]: 'notes',
      [EntityType.SESSION]: 'sessions',
      [EntityType.TOPIC]: 'topics',
      [EntityType.COMPANY]: 'companies',
      [EntityType.CONTACT]: 'contacts',
      [EntityType.FILE]: 'files',
      [EntityType.PROJECT]: 'projects',
      [EntityType.GOAL]: 'goals',
    };
    return map[entityType];
  }

  /**
   * Register default strategies
   */
  private registerDefaultStrategies(): void {
    // Register strategies for each relationship type
    // (strategies can be defined in separate files)
  }

  /**
   * Register a custom strategy
   */
  registerStrategy(type: RelationshipType, strategy: RelationshipStrategy): void {
    this.strategies.set(type, strategy);
  }
}
```

### 2. Create Relationship Strategy Pattern

**File:** `src/services/relationshipStrategies/RelationshipStrategy.ts`

```typescript
export interface RelationshipStrategy {
  beforeAdd(relationship: Relationship): Promise<void>;
  afterAdd(relationship: Relationship): Promise<void>;
  beforeRemove(relationship: Relationship): Promise<void>;
  afterRemove(relationship: Relationship): Promise<void>;
}

export abstract class BaseRelationshipStrategy implements RelationshipStrategy {
  async beforeAdd(relationship: Relationship): Promise<void> {
    // Default: no-op
  }

  async afterAdd(relationship: Relationship): Promise<void> {
    // Default: no-op
  }

  async beforeRemove(relationship: Relationship): Promise<void> {
    // Default: no-op
  }

  async afterRemove(relationship: Relationship): Promise<void> {
    // Default: no-op
  }
}
```

### 3. Implement Specific Strategies

**File:** `src/services/relationshipStrategies/TaskNoteStrategy.ts`

```typescript
export class TaskNoteStrategy extends BaseRelationshipStrategy {
  async afterAdd(relationship: Relationship): Promise<void> {
    // Custom logic for task-note relationships
    // E.g., update note's task count
  }

  async afterRemove(relationship: Relationship): Promise<void> {
    // Custom cleanup logic
  }
}
```

---

## Deliverables

1. **`src/services/relationshipManager.ts`** - Complete relationship manager (600-800 lines)
2. **`src/services/relationshipStrategies/RelationshipStrategy.ts`** - Strategy interface
3. **`src/services/relationshipStrategies/TaskNoteStrategy.ts`** - Task-note strategy
4. **`src/services/relationshipStrategies/TaskSessionStrategy.ts`** - Task-session strategy
5. **`src/services/relationshipStrategies/NoteSessionStrategy.ts`** - Note-session strategy
6. **`tests/services/relationshipManager.test.ts`** - Comprehensive tests (400+ lines)
7. **`docs/architecture/relationship-manager.md`** - Architecture documentation

---

## Acceptance Criteria

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

## Testing Requirements

```typescript
describe('RelationshipManager', () => {
  it('should add bidirectional relationship', async () => {
    const manager = new RelationshipManager(storage, eventBus);

    const rel = await manager.addRelationship({
      sourceType: EntityType.TASK,
      sourceId: 'task-1',
      targetType: EntityType.NOTE,
      targetId: 'note-1',
      type: RelationshipType.TASK_NOTE,
    });

    // Verify both entities have relationship
    const taskRels = manager.getRelationships({ entityId: 'task-1' });
    const noteRels = manager.getRelationships({ entityId: 'note-1' });

    expect(taskRels).toHaveLength(1);
    expect(noteRels).toHaveLength(1);
  });

  it('should remove bidirectional relationship', async () => {
    // Add then remove
    // Verify both entities updated
  });

  it('should be idempotent', async () => {
    // Add twice, verify only one relationship created
  });

  it('should rollback on error', async () => {
    // Simulate error mid-transaction
    // Verify no partial state
  });
});
```

---

**Task Complete When:**
- All deliverables created
- All tests passing (>90% coverage)
- Documentation complete
