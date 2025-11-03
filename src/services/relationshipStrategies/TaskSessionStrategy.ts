/**
 * TaskSessionStrategy - Strategy for Task-Session relationships
 *
 * Manages the lifecycle of task-session relationships where tasks are
 * extracted from work sessions.
 *
 * **Use Cases**:
 * - Tasks extracted from session recordings (AI-generated)
 * - Tasks manually created during a session
 * - Tasks linked to sessions for time tracking
 *
 * @module services/relationshipStrategies/TaskSessionStrategy
 * @since 2.0.0
 */

import { BaseRelationshipStrategy } from './RelationshipStrategy';
import type { Relationship } from '@/types/relationships';
import type { ValidationResult } from './RelationshipStrategy';

/**
 * Task-Session relationship strategy
 *
 * **Validation Rules**:
 * - Source must be task or session
 * - Target must be session or task (bidirectional)
 * - For AI-extracted tasks, confidence and reasoning should be present
 *
 * **Behavior**:
 * - Logs relationship creation for session analytics
 * - Does not cascade delete (sessions are historical records)
 *
 * @example
 * ```typescript
 * import { TaskSessionStrategy } from '@/services/relationshipStrategies/TaskSessionStrategy';
 *
 * const strategy = new TaskSessionStrategy();
 * relationshipManager.registerStrategy('task-session', strategy);
 * ```
 */
export class TaskSessionStrategy extends BaseRelationshipStrategy {
  /**
   * Validate task-session relationship
   *
   * Ensures the relationship has appropriate metadata for task extraction scenarios.
   *
   * @param relationship - Relationship to validate
   * @returns Validation result
   */
  validate(relationship: Relationship): ValidationResult {
    // Ensure metadata.source is present
    if (!relationship.metadata.source) {
      return {
        valid: false,
        error: 'Task-session relationships require a source metadata field',
        details: { relationshipId: relationship.id },
      };
    }

    // For AI-extracted tasks, validate confidence
    if (relationship.metadata.source === 'ai') {
      if (typeof relationship.metadata.confidence !== 'number') {
        return {
          valid: false,
          error: 'AI-extracted tasks must include confidence score',
          details: { relationshipId: relationship.id },
        };
      }

      // Optionally check for reasoning
      if (!relationship.metadata.reasoning) {
        // This is a warning, not a blocker
        console.warn('[TaskSessionStrategy] AI-extracted task missing reasoning:', relationship.id);
      }
    }

    return { valid: true };
  }

  /**
   * Execute before adding task-session relationship
   *
   * @param relationship - Relationship being added
   */
  async beforeAdd(relationship: Relationship): Promise<void> {
    console.debug('[TaskSessionStrategy] Adding task-session relationship:', {
      id: relationship.id,
      source: relationship.sourceId,
      target: relationship.targetId,
      extractionSource: relationship.metadata.source,
      confidence: relationship.metadata.confidence,
    });
  }

  /**
   * Execute after adding task-session relationship
   *
   * Logs the extraction for analytics. Future enhancements could:
   * - Update session's extracted task count
   * - Trigger session summary regeneration
   * - Update task's source context
   *
   * @param relationship - Relationship that was added
   */
  async afterAdd(relationship: Relationship): Promise<void> {
    console.debug('[TaskSessionStrategy] Task-session relationship created:', {
      id: relationship.id,
      canonical: relationship.canonical,
      confidence: relationship.metadata.confidence,
    });

    // Future: Update session statistics
    // await this.updateSessionStats(relationship.targetId);
  }

  /**
   * Execute before removing task-session relationship
   *
   * @param relationship - Relationship being removed
   */
  async beforeRemove(relationship: Relationship): Promise<void> {
    console.debug('[TaskSessionStrategy] Removing task-session relationship:', {
      id: relationship.id,
      source: relationship.sourceId,
      target: relationship.targetId,
    });
  }

  /**
   * Execute after removing task-session relationship
   *
   * @param relationship - Relationship that was removed
   */
  async afterRemove(relationship: Relationship): Promise<void> {
    console.debug('[TaskSessionStrategy] Task-session relationship removed:', {
      id: relationship.id,
    });

    // Future: Update session statistics
    // await this.updateSessionStats(relationship.targetId);
  }

  /**
   * Task-session relationships should NOT cascade delete
   *
   * Sessions are historical records and should be preserved even if
   * extracted tasks are deleted. Similarly, if a session is deleted,
   * extracted tasks remain as independent entities.
   *
   * @returns Always false (no cascade delete)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shouldCascadeDelete(_relationship: Relationship): boolean {
    return false;
  }
}
