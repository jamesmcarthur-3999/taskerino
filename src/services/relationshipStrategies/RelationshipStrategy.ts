/**
 * Relationship Strategy Pattern
 *
 * Provides a flexible, extensible way to add type-specific logic to relationship operations.
 * Each relationship type can have its own strategy that defines:
 * - Validation rules beyond basic type checking
 * - Pre/post operation hooks (beforeAdd, afterAdd, beforeRemove, afterRemove)
 * - Cascade delete behavior
 * - Type-specific metadata requirements
 *
 * @module services/relationshipStrategies/RelationshipStrategy
 * @since 2.0.0
 */

import type { Relationship } from '@/types/relationships';

/**
 * Validation result from strategy validation
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Additional validation details */
  details?: unknown;
}

/**
 * RelationshipStrategy interface
 *
 * Defines the contract that all relationship strategies must implement.
 * Provides hooks for relationship lifecycle events:
 * - validate: Check if relationship is valid (beyond basic type checking)
 * - beforeAdd: Execute logic before relationship is added
 * - afterAdd: Execute logic after relationship is added
 * - beforeRemove: Execute logic before relationship is removed
 * - afterRemove: Execute logic after relationship is removed
 * - shouldCascadeDelete: Determine if removing this relationship should cascade delete the target
 *
 * **Execution Order**:
 * ```
 * addRelationship():
 *   1. validate()
 *   2. beforeAdd()
 *   3. <transaction begins>
 *   4. <entities updated>
 *   5. <transaction commits>
 *   6. afterAdd()
 *   7. <event emitted>
 *
 * removeRelationship():
 *   1. beforeRemove()
 *   2. <transaction begins>
 *   3. <entities updated>
 *   4. <transaction commits>
 *   5. afterRemove()
 *   6. <event emitted>
 * ```
 *
 * @example
 * ```typescript
 * class TaskNoteStrategy extends BaseRelationshipStrategy {
 *   validate(relationship: Relationship): ValidationResult {
 *     // Custom validation logic
 *     if (!relationship.metadata.source) {
 *       return {
 *         valid: false,
 *         error: 'Task-note relationships require a source metadata field'
 *       };
 *     }
 *     return { valid: true };
 *   }
 *
 *   async afterAdd(relationship: Relationship): Promise<void> {
 *     // Update note's task count
 *     console.log('Task linked to note:', relationship.targetId);
 *   }
 * }
 * ```
 */
export interface RelationshipStrategy {
  /**
   * Validate a relationship before it's added
   *
   * Called during addRelationship() before any database operations.
   * Use this to enforce type-specific validation rules beyond the
   * basic type checking done by RELATIONSHIP_CONFIGS.
   *
   * @param relationship - The relationship to validate
   * @returns Validation result
   *
   * @example
   * ```typescript
   * validate(relationship: Relationship): ValidationResult {
   *   if (relationship.metadata.confidence && relationship.metadata.confidence < 0.5) {
   *     return {
   *       valid: false,
   *       error: 'AI confidence too low for automatic relationship creation',
   *       details: { confidence: relationship.metadata.confidence }
   *     };
   *   }
   *   return { valid: true };
   * }
   * ```
   */
  validate(relationship: Relationship): ValidationResult;

  /**
   * Execute logic before a relationship is added
   *
   * Called after validation passes but before the transaction begins.
   * Use this to:
   * - Prepare data for the relationship
   * - Check preconditions
   * - Throw errors to prevent the relationship from being created
   *
   * **Important**: If this method throws an error, the relationship will NOT be created.
   *
   * @param relationship - The relationship being added
   * @throws Error to prevent relationship creation
   *
   * @example
   * ```typescript
   * async beforeAdd(relationship: Relationship): Promise<void> {
   *   // Check if target entity has space for more relationships
   *   const existingCount = await this.getRelationshipCount(relationship.targetId);
   *   if (existingCount >= MAX_RELATIONSHIPS) {
   *     throw new Error('Target entity has reached maximum relationship count');
   *   }
   * }
   * ```
   */
  beforeAdd(relationship: Relationship): Promise<void>;

  /**
   * Execute logic after a relationship is added
   *
   * Called after the transaction commits successfully but before the event is emitted.
   * Use this to:
   * - Update derived data (counts, caches, etc.)
   * - Trigger side effects
   * - Log analytics
   *
   * **Important**: This runs after the transaction commits, so the relationship
   * is already persisted. If this method throws, the relationship will still exist.
   *
   * @param relationship - The relationship that was added
   *
   * @example
   * ```typescript
   * async afterAdd(relationship: Relationship): Promise<void> {
   *   // Update related entity's metadata
   *   await this.updateRelationshipCount(relationship.targetId);
   *
   *   // Log analytics event
   *   analytics.track('relationship_created', {
   *     type: relationship.type,
   *     source: relationship.metadata.source
   *   });
   * }
   * ```
   */
  afterAdd(relationship: Relationship): Promise<void>;

  /**
   * Execute logic before a relationship is removed
   *
   * Called before the transaction begins.
   * Use this to:
   * - Check if removal is allowed
   * - Prepare for cascading operations
   * - Throw errors to prevent removal
   *
   * **Important**: If this method throws an error, the relationship will NOT be removed.
   *
   * @param relationship - The relationship being removed
   * @throws Error to prevent relationship removal
   *
   * @example
   * ```typescript
   * async beforeRemove(relationship: Relationship): Promise<void> {
   *   // Prevent removal of system-created relationships
   *   if (relationship.metadata.source === 'system') {
   *     throw new Error('Cannot remove system-created relationships');
   *   }
   * }
   * ```
   */
  beforeRemove(relationship: Relationship): Promise<void>;

  /**
   * Execute logic after a relationship is removed
   *
   * Called after the transaction commits successfully but before the event is emitted.
   * Use this to:
   * - Clean up derived data
   * - Trigger side effects
   * - Log analytics
   *
   * **Important**: This runs after the transaction commits, so the relationship
   * is already removed. If this method throws, the relationship is still gone.
   *
   * @param relationship - The relationship that was removed
   *
   * @example
   * ```typescript
   * async afterRemove(relationship: Relationship): Promise<void> {
   *   // Update related entity's metadata
   *   await this.updateRelationshipCount(relationship.targetId);
   *
   *   // Clean up orphaned data
   *   await this.cleanupOrphanedData(relationship);
   * }
   * ```
   */
  afterRemove(relationship: Relationship): Promise<void>;

  /**
   * Determine if removing this relationship should cascade delete the target entity
   *
   * Called during relationship removal to decide if the target entity should
   * also be deleted. Use with caution - cascade deletes can cause data loss.
   *
   * **Default**: Most relationships should NOT cascade delete (return false)
   *
   * @param relationship - The relationship being removed
   * @returns True if target entity should be deleted
   *
   * @example
   * ```typescript
   * shouldCascadeDelete(relationship: Relationship): boolean {
   *   // Only cascade if this is an "owned" relationship
   *   return relationship.metadata.extra?.owned === true;
   * }
   * ```
   */
  shouldCascadeDelete(relationship: Relationship): boolean;
}

/**
 * Base implementation of RelationshipStrategy
 *
 * Provides default no-op implementations for all strategy methods.
 * Extend this class and override only the methods you need.
 *
 * **Default Behavior**:
 * - validate(): Always returns valid
 * - beforeAdd/afterAdd/beforeRemove/afterRemove: No-op (do nothing)
 * - shouldCascadeDelete(): Always returns false (safe default)
 *
 * @example
 * ```typescript
 * class MyCustomStrategy extends BaseRelationshipStrategy {
 *   // Only override the methods you need
 *   async afterAdd(relationship: Relationship): Promise<void> {
 *     console.log('Relationship added:', relationship.id);
 *   }
 * }
 * ```
 */
export abstract class BaseRelationshipStrategy implements RelationshipStrategy {
  /**
   * Default validation - always passes
   *
   * Override this method to add custom validation logic.
   *
   * @param relationship - Relationship to validate
   * @returns Validation result (always valid by default)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validate(_relationship: Relationship): ValidationResult {
    return { valid: true };
  }

  /**
   * Default beforeAdd hook - no-op
   *
   * Override this method to add pre-add logic.
   *
   * @param relationship - Relationship being added
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async beforeAdd(_relationship: Relationship): Promise<void> {
    // No-op by default
  }

  /**
   * Default afterAdd hook - no-op
   *
   * Override this method to add post-add logic.
   *
   * @param relationship - Relationship that was added
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async afterAdd(_relationship: Relationship): Promise<void> {
    // No-op by default
  }

  /**
   * Default beforeRemove hook - no-op
   *
   * Override this method to add pre-remove logic.
   *
   * @param relationship - Relationship being removed
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async beforeRemove(_relationship: Relationship): Promise<void> {
    // No-op by default
  }

  /**
   * Default afterRemove hook - no-op
   *
   * Override this method to add post-remove logic.
   *
   * @param relationship - Relationship that was removed
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async afterRemove(_relationship: Relationship): Promise<void> {
    // No-op by default
  }

  /**
   * Default cascade delete behavior - never cascade
   *
   * This is the safe default. Override only if you need cascade delete behavior.
   *
   * @param relationship - Relationship being removed
   * @returns False (never cascade delete by default)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shouldCascadeDelete(_relationship: Relationship): boolean {
    return false;
  }
}
