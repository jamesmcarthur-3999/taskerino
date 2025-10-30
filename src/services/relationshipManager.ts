/**
 * RelationshipManager - Core Relationship Management Service
 *
 * Provides CRUD operations for relationships between entities with:
 * - Automatic bidirectional synchronization
 * - Atomic transactions (ACID guarantees)
 * - Strategy pattern for type-specific behavior
 * - Event emission for reactive updates
 * - O(1) relationship lookups via index
 * - Idempotent operations (safe to call multiple times)
 *
 * @module services/relationshipManager
 * @since 2.0.0
 */

import { nanoid } from 'nanoid';
import type { StorageAdapter } from '@/services/storage';
import { getStorage } from '@/services/storage';
import { eventBus } from '@/services/eventBus';
import { RelationshipIndex } from '@/services/storage/relationshipIndex';
import type {
  Relationship,
  RelationshipType,
  EntityType,
  RelationshipMetadata,
} from '@/types/relationships';
import { RELATIONSHIP_CONFIGS, validateRelationshipTypes } from '@/types/relationships';
import type { RelationshipStrategy } from '@/services/relationshipStrategies/RelationshipStrategy';
import {
  ValidationError,
  EntityNotFoundError,
  TransactionError,
} from '@/services/errors/RelationshipError';

/**
 * Parameters for adding a new relationship
 */
export interface AddRelationshipParams {
  /** Source entity type */
  sourceType: EntityType;
  /** Source entity ID */
  sourceId: string;
  /** Target entity type */
  targetType: EntityType;
  /** Target entity ID */
  targetId: string;
  /** Type of relationship */
  type: RelationshipType;
  /** Optional metadata (will be merged with defaults) */
  metadata?: Partial<RelationshipMetadata>;
}

/**
 * Parameters for removing a relationship
 */
export interface RemoveRelationshipParams {
  /** Relationship ID to remove */
  relationshipId: string;
}

/**
 * Parameters for querying relationships
 */
export interface GetRelationshipsParams {
  /** Entity ID to get relationships for */
  entityId: string;
  /** Optional filter by entity type */
  entityType?: EntityType;
  /** Optional filter by relationship type */
  relationshipType?: RelationshipType;
}

/**
 * Entity with relationships array
 */
export interface EntityWithRelationships {
  id: string;
  relationships?: Relationship[];
  [key: string]: unknown;
}

/**
 * RelationshipManager - Core service for managing entity relationships
 *
 * **Key Features**:
 * - **Bidirectional Sync**: Automatically maintains relationships on both entities
 * - **Atomic Operations**: All operations use transactions (all-or-nothing)
 * - **Fast Lookups**: O(1) relationship queries via RelationshipIndex
 * - **Extensible**: Strategy pattern for type-specific logic
 * - **Event-Driven**: Emits events for reactive updates
 * - **Idempotent**: Safe to call operations multiple times
 *
 * **Performance**:
 * - addRelationship: <10ms (target)
 * - removeRelationship: <10ms (target)
 * - getRelationships: <5ms (target)
 * - getRelatedEntities: <50ms for 10 entities (target)
 *
 * @example Basic Usage
 * ```typescript
 * import { relationshipManager } from '@/services/relationshipManager';
 *
 * // Add a relationship
 * const rel = await relationshipManager.addRelationship({
 *   sourceType: 'task',
 *   sourceId: 'task-123',
 *   targetType: 'note',
 *   targetId: 'note-456',
 *   type: 'task-note',
 *   metadata: {
 *     source: 'manual',
 *     createdBy: 'user-1'
 *   }
 * });
 *
 * // Query relationships
 * const rels = relationshipManager.getRelationships({ entityId: 'task-123' });
 *
 * // Remove a relationship
 * await relationshipManager.removeRelationship({ relationshipId: rel.id });
 * ```
 *
 * @example With Custom Strategy
 * ```typescript
 * import { TaskNoteStrategy } from '@/services/relationshipStrategies/TaskNoteStrategy';
 *
 * // Register custom strategy
 * relationshipManager.registerStrategy('task-note', new TaskNoteStrategy());
 *
 * // Now all task-note relationships will use custom logic
 * await relationshipManager.addRelationship({
 *   sourceType: 'task',
 *   sourceId: 'task-123',
 *   targetType: 'note',
 *   targetId: 'note-456',
 *   type: 'task-note'
 * });
 * ```
 */
export class RelationshipManager {
  private storage: StorageAdapter | null = null;
  private index: RelationshipIndex | null = null;
  private strategies: Map<RelationshipType, RelationshipStrategy>;
  private initialized = false;

  constructor() {
    this.strategies = new Map();
  }

  /**
   * Initialize the RelationshipManager
   *
   * Must be called before using any other methods.
   * Loads the storage adapter and builds the relationship index.
   *
   * @example
   * ```typescript
   * await relationshipManager.init();
   * ```
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.storage = await getStorage();

    // Build the relationship index by loading all relationships from all entities
    this.index = await this.buildRelationshipIndex();

    this.registerDefaultStrategies();
    this.initialized = true;
  }

  /**
   * Build the relationship index from all entities in storage
   *
   * @returns RelationshipIndex populated with all relationships
   */
  private async buildRelationshipIndex(): Promise<RelationshipIndex> {
    const allRelationships: Relationship[] = [];

    // Entity types that can have relationships
    const entityCollections = ['tasks', 'notes', 'sessions', 'topics', 'companies', 'contacts'];

    // Load relationships from each entity collection
    for (const collection of entityCollections) {
      try {
        const entities = await this.storage!.load<EntityWithRelationships[]>(collection);
        if (entities && Array.isArray(entities)) {
          entities.forEach(entity => {
            if (entity.relationships && Array.isArray(entity.relationships)) {
              allRelationships.push(...entity.relationships);
            }
          });
        }
      } catch (error) {
        // Collection might not exist yet - that's okay
        console.debug(`Collection ${collection} not found, skipping`, error);
      }
    }

    // Remove duplicates (bidirectional relationships are stored on both entities)
    const uniqueRelationships = new Map<string, Relationship>();
    allRelationships.forEach(rel => {
      uniqueRelationships.set(rel.id, rel);
    });

    // Create and populate index
    return new RelationshipIndex(Array.from(uniqueRelationships.values()));
  }

  /**
   * Ensure the manager is initialized
   *
   * @throws Error if not initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.storage || !this.index) {
      throw new Error('RelationshipManager not initialized. Call init() first.');
    }
  }

  /**
   * Add a new relationship between two entities
   *
   * Creates a relationship from source→target and automatically creates
   * the reverse relationship if the type is configured as bidirectional.
   *
   * **Algorithm**:
   * 1. Validate relationship type and entity types
   * 2. Check for duplicates (idempotency)
   * 3. Create canonical relationship
   * 4. Execute strategy.beforeAdd() if registered
   * 5. Begin transaction
   * 6. Add relationship to source entity
   * 7. If bidirectional: add reverse relationship to target entity
   * 8. Commit transaction
   * 9. Update index
   * 10. Execute strategy.afterAdd()
   * 11. Emit RELATIONSHIP_ADDED event
   * 12. Return canonical relationship
   *
   * **Transaction Guarantees**:
   * - All operations succeed or all fail
   * - No partial state on error
   * - Automatic rollback on failure
   *
   * **Idempotency**:
   * - If relationship already exists, returns existing relationship
   * - Safe to call multiple times with same parameters
   *
   * @param params - Relationship parameters
   * @returns The created (or existing) relationship
   * @throws ValidationError if validation fails
   * @throws EntityNotFoundError if source/target entity not found
   * @throws TransactionError if transaction fails
   *
   * @example
   * ```typescript
   * const rel = await manager.addRelationship({
   *   sourceType: 'task',
   *   sourceId: 'task-123',
   *   targetType: 'note',
   *   targetId: 'note-456',
   *   type: 'task-note',
   *   metadata: {
   *     source: 'ai',
   *     confidence: 0.95,
   *     reasoning: 'Task mentions note topic'
   *   }
   * });
   * ```
   */
  async addRelationship(params: AddRelationshipParams): Promise<Relationship> {
    this.ensureInitialized();

    const { sourceType, sourceId, targetType, targetId, type, metadata } = params;

    // Step 1: Validate relationship type exists
    const config = RELATIONSHIP_CONFIGS[type];
    if (!config) {
      throw new ValidationError(`Invalid relationship type: ${type}`, {
        type,
        validTypes: Object.keys(RELATIONSHIP_CONFIGS),
      });
    }

    // Step 2: Validate source and target types
    const typesValid = validateRelationshipTypes(type, sourceType, targetType);
    if (!typesValid) {
      throw new ValidationError(
        `Invalid entity types for relationship ${type}. Source: ${sourceType}, Target: ${targetType}`,
        {
          type,
          sourceType,
          targetType,
          allowedSourceTypes: config.sourceTypes,
          allowedTargetTypes: config.targetTypes,
        }
      );
    }

    // Step 3: Check for duplicates (idempotency)
    const existing = this.index!.getBetween(sourceId, targetId);
    if (existing && existing.type === type) {
      return existing;
    }

    // Step 4: Create canonical relationship
    const relationship: Relationship = {
      id: nanoid(),
      type,
      sourceType,
      sourceId,
      targetType,
      targetId,
      metadata: {
        ...metadata,
        source: metadata?.source || 'manual',
        createdAt: metadata?.createdAt || new Date().toISOString(),
      } as RelationshipMetadata,
      canonical: true,
    };

    // Step 5: Execute strategy beforeAdd (if registered)
    const strategy = this.strategies.get(type);
    if (strategy) {
      // Validate with strategy
      const validationResult = strategy.validate(relationship);
      if (!validationResult.valid) {
        throw new ValidationError(
          validationResult.error || 'Strategy validation failed',
          validationResult.details
        );
      }

      // Execute beforeAdd hook
      await strategy.beforeAdd(relationship);
    }

    // Step 6: Begin transaction
    const txId = this.storage!.beginPhase24Transaction();

    try {
      // Step 7: Add relationship to source entity
      await this.addToEntity(txId, sourceType, sourceId, relationship);

      // Step 8: If bidirectional, create and add reverse relationship
      let reverseRelationship: Relationship | undefined;
      if (config.bidirectional) {
        reverseRelationship = {
          ...relationship,
          id: nanoid(),
          sourceType: targetType,
          sourceId: targetId,
          targetType: sourceType,
          targetId: sourceId,
          canonical: false, // Mark as non-canonical
        };

        await this.addToEntity(txId, targetType, targetId, reverseRelationship);
      }

      // Step 9: Commit transaction
      await this.storage!.commitPhase24Transaction(txId);

      // Step 10: Update index (after successful commit)
      // Only index the canonical relationship - it gets indexed under both entities
      // for bidirectional relationships, so we don't need the non-canonical one
      this.index!.add(relationship);

      // Step 11: Execute strategy afterAdd
      if (strategy) {
        await strategy.afterAdd(relationship);
      }

      // Step 12: Emit event
      eventBus.emit(
        'RELATIONSHIP_ADDED',
        {
          relationship,
          reverseRelationship,
        },
        'RelationshipManager'
      );

      return relationship;
    } catch (error) {
      // Rollback transaction on any error
      await this.storage!.rollbackPhase24Transaction(txId);

      if (error instanceof ValidationError || error instanceof EntityNotFoundError) {
        throw error;
      }

      throw new TransactionError(
        `Failed to add relationship: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          sourceId,
          targetId,
          type,
          originalError: error,
        }
      );
    }
  }

  /**
   * Remove a relationship between two entities
   *
   * Removes the specified relationship and automatically removes the
   * reverse relationship if the type is bidirectional.
   *
   * **Algorithm**:
   * 1. Lookup relationship by ID
   * 2. Return early if not found (idempotency)
   * 3. Execute strategy.beforeRemove() if registered
   * 4. Begin transaction
   * 5. Remove relationship from source entity
   * 6. If bidirectional: find and remove reverse relationship from target entity
   * 7. Commit transaction
   * 8. Remove from index
   * 9. Execute strategy.afterRemove()
   * 10. Emit RELATIONSHIP_REMOVED event
   *
   * **Idempotency**:
   * - If relationship doesn't exist, returns successfully
   * - Safe to call multiple times with same ID
   *
   * @param params - Removal parameters
   * @throws TransactionError if transaction fails
   *
   * @example
   * ```typescript
   * await manager.removeRelationship({ relationshipId: 'rel-abc123' });
   * ```
   */
  async removeRelationship(params: RemoveRelationshipParams): Promise<void> {
    this.ensureInitialized();

    const { relationshipId } = params;

    // Step 1: Lookup relationship by ID
    const relationship = this.index!.getById(relationshipId);

    // Step 2: Return early if not found (idempotent)
    if (!relationship) {
      return;
    }

    // Get config to check if bidirectional
    const config = RELATIONSHIP_CONFIGS[relationship.type];

    // Step 3: Execute strategy beforeRemove (if registered)
    const strategy = this.strategies.get(relationship.type);
    if (strategy) {
      await strategy.beforeRemove(relationship);
    }

    // Step 4: Begin transaction
    const txId = this.storage!.beginPhase24Transaction();

    try {
      // Step 5: Remove from source entity
      await this.removeFromEntity(
        txId,
        relationship.sourceType,
        relationship.sourceId,
        relationshipId
      );

      // Step 6: If bidirectional, find and remove reverse relationship
      let reverseRelationship: Relationship | undefined;
      if (config.bidirectional) {
        // Find reverse relationship
        const targetRels = this.index!.getByEntity(relationship.targetId);
        reverseRelationship = targetRels.find(
          r =>
            r.sourceId === relationship.targetId &&
            r.targetId === relationship.sourceId &&
            r.type === relationship.type &&
            !r.canonical
        );

        if (reverseRelationship) {
          await this.removeFromEntity(
            txId,
            relationship.targetType,
            relationship.targetId,
            reverseRelationship.id
          );
        }
      }

      // Step 7: Commit transaction
      await this.storage!.commitPhase24Transaction(txId);

      // Step 8: Remove from index (after successful commit)
      // Only the canonical relationship is in the index, so only remove that
      this.index!.remove(relationshipId);

      // Step 9: Execute strategy afterRemove
      if (strategy) {
        await strategy.afterRemove(relationship);
      }

      // Step 10: Emit event
      eventBus.emit(
        'RELATIONSHIP_REMOVED',
        {
          relationship,
          reverseRelationship,
        },
        'RelationshipManager'
      );
    } catch (error) {
      // Rollback transaction on any error
      await this.storage!.rollbackPhase24Transaction(txId);

      throw new TransactionError(
        `Failed to remove relationship: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          relationshipId,
          originalError: error,
        }
      );
    }
  }

  /**
   * Get relationships for an entity
   *
   * Returns all relationships where the entity is either source or target.
   * For bidirectional relationships, both directions are included.
   *
   * **Performance**: O(1) lookup via index
   *
   * @param params - Query parameters
   * @returns Array of relationships (empty if none found)
   *
   * @example
   * ```typescript
   * // Get all relationships for a task
   * const allRels = manager.getRelationships({ entityId: 'task-123' });
   *
   * // Get only task-note relationships
   * const taskNotes = manager.getRelationships({
   *   entityId: 'task-123',
   *   relationshipType: 'task-note'
   * });
   *
   * // Get relationships where task is the source
   * const outgoing = manager.getRelationships({
   *   entityId: 'task-123',
   *   entityType: 'task'
   * });
   * ```
   */
  getRelationships(params: GetRelationshipsParams): Relationship[] {
    this.ensureInitialized();

    const { entityId, entityType, relationshipType } = params;

    // Get all relationships for entity (O(1) lookup)
    let relationships = this.index!.getByEntity(entityId);

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
   * Get related entities for an entity
   *
   * Returns the actual entity objects, not just relationships.
   * Loads entities from storage for all relationships.
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
   *   'task-note'
   * );
   * ```
   */
  async getRelatedEntities<T extends EntityWithRelationships>(
    entityId: string,
    relationshipType?: RelationshipType
  ): Promise<T[]> {
    this.ensureInitialized();

    const relationships = this.getRelationships({ entityId, relationshipType });

    const entities: T[] = [];
    for (const rel of relationships) {
      // Determine which entity to fetch
      const targetId = rel.sourceId === entityId ? rel.targetId : rel.sourceId;
      const targetType = rel.sourceId === entityId ? rel.targetType : rel.sourceType;

      // Load entity
      const collectionName = this.getCollectionName(targetType);
      const data = await this.storage!.load<T[]>(collectionName);

      if (data) {
        const entity = data.find(e => e.id === targetId);
        if (entity) {
          entities.push(entity);
        }
      }
    }

    return entities;
  }

  /**
   * Register a custom strategy for a relationship type
   *
   * Strategies allow you to add type-specific logic for validation,
   * pre/post hooks, and cascade delete behavior.
   *
   * @param type - Relationship type
   * @param strategy - Strategy instance
   *
   * @example
   * ```typescript
   * import { TaskNoteStrategy } from '@/services/relationshipStrategies/TaskNoteStrategy';
   *
   * manager.registerStrategy('task-note', new TaskNoteStrategy());
   * ```
   */
  registerStrategy(type: RelationshipType, strategy: RelationshipStrategy): void {
    this.strategies.set(type, strategy);
  }

  /**
   * Register default strategies for built-in relationship types
   *
   * Called automatically during initialization.
   * Can be overridden by calling registerStrategy() afterward.
   */
  private registerDefaultStrategies(): void {
    // Default strategies will be registered here
    // For now, no default strategies (can be added later)
  }

  /**
   * Add relationship to entity's relationships array
   *
   * @param txId - Transaction ID
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param relationship - Relationship to add
   * @throws EntityNotFoundError if entity not found
   */
  private async addToEntity(
    txId: string,
    entityType: EntityType,
    entityId: string,
    relationship: Relationship
  ): Promise<void> {
    const collectionName = this.getCollectionName(entityType);
    const data = await this.storage!.load<EntityWithRelationships[]>(collectionName);

    if (!data) {
      throw new EntityNotFoundError(
        `Entity collection ${collectionName} not found`,
        { entityType, entityId }
      );
    }

    const entity = data.find(e => e.id === entityId);
    if (!entity) {
      throw new EntityNotFoundError(
        `Entity ${entityType}:${entityId} not found`,
        { entityType, entityId }
      );
    }

    // Add relationship to entity
    if (!entity.relationships) {
      entity.relationships = [];
    }
    entity.relationships.push(relationship);

    // Add operation to transaction
    this.storage!.addOperation(txId, {
      type: 'write',
      collection: collectionName,
      data,
      entityId,
    });

    // Store previous data for potential rollback
    // (This is handled internally by the storage adapter)
  }

  /**
   * Remove relationship from entity's relationships array
   *
   * @param txId - Transaction ID
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param relationshipId - Relationship ID to remove
   */
  private async removeFromEntity(
    txId: string,
    entityType: EntityType,
    entityId: string,
    relationshipId: string
  ): Promise<void> {
    const collectionName = this.getCollectionName(entityType);
    const data = await this.storage!.load<EntityWithRelationships[]>(collectionName);

    if (!data) {
      return; // Safe if entity/collection not found
    }

    const entity = data.find(e => e.id === entityId);
    if (!entity || !entity.relationships) {
      return; // Safe if entity or relationships not found
    }

    // Remove relationship from entity
    entity.relationships = entity.relationships.filter(r => r.id !== relationshipId);

    // Add operation to transaction
    this.storage!.addOperation(txId, {
      type: 'write',
      collection: collectionName,
      data,
      entityId,
    });
  }

  /**
   * Get storage collection name for entity type
   *
   * @param entityType - Entity type
   * @returns Collection name
   */
  private getCollectionName(entityType: EntityType): string {
    const map: Record<string, string> = {
      task: 'tasks',
      note: 'notes',
      session: 'sessions',
      topic: 'topics',
      company: 'companies',
      contact: 'contacts',
      file: 'files',
      project: 'projects',
      goal: 'goals',
    };
    return map[entityType] || entityType;
  }
}

/**
 * Singleton instance of RelationshipManager
 *
 * Use this instance throughout your application.
 *
 * @example
 * ```typescript
 * import { relationshipManager } from '@/services/relationshipManager';
 *
 * await relationshipManager.init();
 * await relationshipManager.addRelationship({ ... });
 * ```
 */
export const relationshipManager = new RelationshipManager();

/**
 * Export class for testing or custom instances
 */
export default relationshipManager;
