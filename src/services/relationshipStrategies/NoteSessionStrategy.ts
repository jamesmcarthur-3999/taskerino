/**
 * NoteSessionStrategy - Strategy for Note-Session relationships
 *
 * Manages the lifecycle of note-session relationships where notes are
 * created during or extracted from work sessions.
 *
 * **Use Cases**:
 * - Notes created during a work session
 * - Notes extracted from session transcripts (AI-generated)
 * - Manual linking of notes to sessions for context
 *
 * @module services/relationshipStrategies/NoteSessionStrategy
 * @since 2.0.0
 */

import { BaseRelationshipStrategy } from './RelationshipStrategy';
import type { Relationship } from '@/types/relationships';
import type { ValidationResult } from './RelationshipStrategy';

/**
 * Note-Session relationship strategy
 *
 * **Validation Rules**:
 * - Source must be note or session
 * - Target must be session or note (bidirectional)
 * - Metadata source is required
 *
 * **Behavior**:
 * - Logs relationship creation for session analytics
 * - Does not cascade delete (sessions and notes are independent)
 *
 * @example
 * ```typescript
 * import { NoteSessionStrategy } from '@/services/relationshipStrategies/NoteSessionStrategy';
 *
 * const strategy = new NoteSessionStrategy();
 * relationshipManager.registerStrategy('note-session', strategy);
 * ```
 */
export class NoteSessionStrategy extends BaseRelationshipStrategy {
  /**
   * Validate note-session relationship
   *
   * Ensures the relationship has required metadata.
   *
   * @param relationship - Relationship to validate
   * @returns Validation result
   */
  validate(relationship: Relationship): ValidationResult {
    // Ensure metadata.source is present
    if (!relationship.metadata.source) {
      return {
        valid: false,
        error: 'Note-session relationships require a source metadata field',
        details: { relationshipId: relationship.id },
      };
    }

    // For AI-created relationships, ensure confidence is present
    if (relationship.metadata.source === 'ai' && typeof relationship.metadata.confidence !== 'number') {
      return {
        valid: false,
        error: 'AI-created note-session relationships must include confidence score',
        details: { relationshipId: relationship.id },
      };
    }

    return { valid: true };
  }

  /**
   * Execute before adding note-session relationship
   *
   * @param relationship - Relationship being added
   */
  async beforeAdd(relationship: Relationship): Promise<void> {
    console.debug('[NoteSessionStrategy] Adding note-session relationship:', {
      id: relationship.id,
      source: relationship.sourceId,
      target: relationship.targetId,
      metadata: relationship.metadata,
    });
  }

  /**
   * Execute after adding note-session relationship
   *
   * Logs the operation. Future enhancements could:
   * - Update session's note count
   * - Update note's session context
   * - Trigger UI refreshes
   *
   * @param relationship - Relationship that was added
   */
  async afterAdd(relationship: Relationship): Promise<void> {
    console.debug('[NoteSessionStrategy] Note-session relationship created:', {
      id: relationship.id,
      canonical: relationship.canonical,
      source: relationship.metadata.source,
    });

    // Future: Update session statistics
    // await this.updateSessionStats(relationship);
  }

  /**
   * Execute before removing note-session relationship
   *
   * @param relationship - Relationship being removed
   */
  async beforeRemove(relationship: Relationship): Promise<void> {
    console.debug('[NoteSessionStrategy] Removing note-session relationship:', {
      id: relationship.id,
      source: relationship.sourceId,
      target: relationship.targetId,
    });
  }

  /**
   * Execute after removing note-session relationship
   *
   * @param relationship - Relationship that was removed
   */
  async afterRemove(relationship: Relationship): Promise<void> {
    console.debug('[NoteSessionStrategy] Note-session relationship removed:', {
      id: relationship.id,
    });

    // Future: Update session statistics
    // await this.updateSessionStats(relationship);
  }

  /**
   * Note-session relationships should NOT cascade delete
   *
   * Notes and sessions are both primary entities that should persist
   * independently of each other.
   *
   * @returns Always false (no cascade delete)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shouldCascadeDelete(_relationship: Relationship): boolean {
    return false;
  }
}
