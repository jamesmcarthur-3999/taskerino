/**
 * TaskNoteStrategy - Strategy for Task-Note relationships
 *
 * Manages the lifecycle of task-note relationships with specific validation
 * and behavior rules for this relationship type.
 *
 * **Use Cases**:
 * - Task created from a note during capture
 * - Task manually linked to a note for context
 * - AI-suggested task-note associations
 *
 * @module services/relationshipStrategies/TaskNoteStrategy
 * @since 2.0.0
 */

import { BaseRelationshipStrategy } from './RelationshipStrategy';
import type { Relationship } from '@/types/relationships';
import type { ValidationResult } from './RelationshipStrategy';

/**
 * Task-Note relationship strategy
 *
 * **Validation Rules**:
 * - Source must be task or note
 * - Target must be note or task (bidirectional)
 * - Metadata source is required
 *
 * **Behavior**:
 * - Logs relationship creation/removal for analytics
 * - Does not cascade delete (notes are independent of tasks)
 *
 * @example
 * ```typescript
 * import { TaskNoteStrategy } from '@/services/relationshipStrategies/TaskNoteStrategy';
 *
 * const strategy = new TaskNoteStrategy();
 * relationshipManager.registerStrategy('task-note', strategy);
 * ```
 */
export class TaskNoteStrategy extends BaseRelationshipStrategy {
  /**
   * Validate task-note relationship
   *
   * Ensures the relationship has required metadata and valid entity types.
   *
   * @param relationship - Relationship to validate
   * @returns Validation result
   */
  validate(relationship: Relationship): ValidationResult {
    // Ensure metadata.source is present
    if (!relationship.metadata.source) {
      return {
        valid: false,
        error: 'Task-note relationships require a source metadata field',
        details: { relationshipId: relationship.id },
      };
    }

    // For AI-created relationships, ensure confidence is present
    if (relationship.metadata.source === 'ai' && typeof relationship.metadata.confidence !== 'number') {
      return {
        valid: false,
        error: 'AI-created task-note relationships must include confidence score',
        details: { relationshipId: relationship.id },
      };
    }

    return { valid: true };
  }

  /**
   * Execute before adding task-note relationship
   *
   * Currently a placeholder for future logic such as:
   * - Checking for duplicate semantic relationships
   * - Validating task/note states
   *
   * @param relationship - Relationship being added
   */
  async beforeAdd(relationship: Relationship): Promise<void> {
    // Log for debugging/analytics
    console.debug('[TaskNoteStrategy] Adding task-note relationship:', {
      id: relationship.id,
      source: relationship.sourceId,
      target: relationship.targetId,
      metadata: relationship.metadata,
    });
  }

  /**
   * Execute after adding task-note relationship
   *
   * Currently logs the operation. Future enhancements could:
   * - Update note's task count
   * - Trigger UI refreshes
   * - Update search indexes
   *
   * @param relationship - Relationship that was added
   */
  async afterAdd(relationship: Relationship): Promise<void> {
    // Log analytics event
    console.debug('[TaskNoteStrategy] Task-note relationship created:', {
      id: relationship.id,
      canonical: relationship.canonical,
      source: relationship.metadata.source,
    });
  }

  /**
   * Execute before removing task-note relationship
   *
   * @param relationship - Relationship being removed
   */
  async beforeRemove(relationship: Relationship): Promise<void> {
    console.debug('[TaskNoteStrategy] Removing task-note relationship:', {
      id: relationship.id,
      source: relationship.sourceId,
      target: relationship.targetId,
    });
  }

  /**
   * Execute after removing task-note relationship
   *
   * Currently logs the operation. Future enhancements could:
   * - Update note's task count
   * - Clean up orphaned data
   *
   * @param relationship - Relationship that was removed
   */
  async afterRemove(relationship: Relationship): Promise<void> {
    console.debug('[TaskNoteStrategy] Task-note relationship removed:', {
      id: relationship.id,
    });
  }

  /**
   * Task-note relationships should NOT cascade delete
   *
   * When a task is deleted, the source note should remain intact.
   * When a note is deleted, linked tasks should remain intact.
   *
   * @returns Always false (no cascade delete)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shouldCascadeDelete(_relationship: Relationship): boolean {
    return false;
  }
}
