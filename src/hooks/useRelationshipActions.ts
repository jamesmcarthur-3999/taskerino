/**
 * useRelationshipActions - Hook for convenient relationship operations
 *
 * Provides simplified functions for creating and removing relationships
 * from a specific entity's perspective.
 *
 * @module hooks/useRelationshipActions
 * @since 2.0.0
 */

import { useCallback } from 'react';
import type {
  EntityType,
  RelationshipType,
  RelationshipMetadata,
  Relationship,
} from '@/types/relationships';
import { useRelationships } from '@/context/RelationshipContext';

/**
 * Hook return value
 */
interface UseRelationshipActionsResult {
  /**
   * Link this entity to another entity
   * @param targetId - ID of entity to link to
   * @param targetType - Type of entity to link to
   * @param type - Type of relationship to create
   * @param metadata - Optional relationship metadata
   * @returns Promise resolving to created relationship
   */
  linkTo: (
    targetId: string,
    targetType: EntityType,
    type: RelationshipType,
    metadata?: Partial<RelationshipMetadata>
  ) => Promise<Relationship>;

  /**
   * Unlink a relationship by ID
   * @param relationshipId - ID of relationship to remove
   */
  unlink: (relationshipId: string) => Promise<void>;

  /**
   * Unlink this entity from another entity
   * @param targetId - ID of entity to unlink from
   * @param targetType - Type of entity to unlink from
   * @param type - Type of relationship to remove
   * @returns Promise resolving to true if relationship was removed, false if not found
   */
  unlinkFrom: (
    targetId: string,
    targetType: EntityType,
    type: RelationshipType
  ) => Promise<boolean>;

  /**
   * Check if this entity is linked to another entity
   * @param targetId - ID of entity to check
   * @param type - Optional relationship type filter
   * @returns True if linked, false otherwise
   */
  isLinkedTo: (targetId: string, type?: RelationshipType) => boolean;

  /**
   * Get all relationships for this entity
   * @param type - Optional relationship type filter
   * @returns Array of relationships
   */
  getLinks: (type?: RelationshipType) => Relationship[];
}

/**
 * useRelationshipActions - Convenient relationship operations for a specific entity
 *
 * **Features**:
 * - Simplified API (no need to specify source entity repeatedly)
 * - Helper functions for common operations (isLinkedTo, unlinkFrom)
 * - Type-safe operations
 * - Optimistic updates (via RelationshipContext)
 *
 * **Usage**:
 * ```tsx
 * function TaskCard({ task }: { task: Task }) {
 *   const { linkTo, unlink, isLinkedTo } = useRelationshipActions(
 *     task.id,
 *     'task'
 *   );
 *
 *   const handleLinkNote = async (noteId: string) => {
 *     await linkTo(noteId, 'note', 'task-note', {
 *       source: 'manual',
 *     });
 *   };
 *
 *   const isLinked = isLinkedTo('note-123');
 *
 *   return <div>...</div>;
 * }
 * ```
 *
 * **Unlinking Example**:
 * ```tsx
 * const { unlink, unlinkFrom } = useRelationshipActions(taskId, 'task');
 *
 * // Option 1: Unlink by relationship ID
 * await unlink('rel-abc123');
 *
 * // Option 2: Unlink by target entity
 * const removed = await unlinkFrom('note-456', 'note', 'task-note');
 * if (removed) {
 *   console.log('Relationship removed');
 * }
 * ```
 *
 * **Check Link Status**:
 * ```tsx
 * const { isLinkedTo } = useRelationshipActions(taskId, 'task');
 *
 * const isLinked = isLinkedTo('note-123', 'task-note');
 * console.log(isLinked); // true or false
 * ```
 *
 * @param entityId - ID of entity to perform operations from
 * @param entityType - Type of entity
 * @returns Hook result with action functions
 */
export function useRelationshipActions(
  entityId: string,
  entityType: EntityType
): UseRelationshipActionsResult {
  // Get relationship context
  const { addRelationship, removeRelationship, getRelationships } = useRelationships();

  /**
   * Link this entity to another entity
   */
  const linkTo = useCallback(
    async (
      targetId: string,
      targetType: EntityType,
      type: RelationshipType,
      metadata?: Partial<RelationshipMetadata>
    ) => {
      return addRelationship({
        sourceType: entityType,
        sourceId: entityId,
        targetType,
        targetId,
        type,
        metadata,
      });
    },
    [addRelationship, entityId, entityType]
  );

  /**
   * Unlink a relationship by ID
   */
  const unlink = useCallback(
    async (relationshipId: string) => {
      return removeRelationship(relationshipId);
    },
    [removeRelationship]
  );

  /**
   * Unlink this entity from another entity
   */
  const unlinkFrom = useCallback(
    async (targetId: string, targetType: EntityType, type: RelationshipType) => {
      // Find the relationship
      const relationships = getRelationships(entityId, type);
      const relationship = relationships.find(
        r =>
          ((r.sourceId === entityId && r.targetId === targetId) ||
            (r.sourceId === targetId && r.targetId === entityId)) &&
          ((r.sourceType === entityType && r.targetType === targetType) ||
            (r.sourceType === targetType && r.targetType === entityType))
      );

      if (!relationship) {
        return false;
      }

      await removeRelationship(relationship.id);
      return true;
    },
    [entityId, entityType, getRelationships, removeRelationship]
  );

  /**
   * Check if this entity is linked to another entity
   */
  const isLinkedTo = useCallback(
    (targetId: string, type?: RelationshipType) => {
      const relationships = getRelationships(entityId, type);
      return relationships.some(
        r =>
          (r.sourceId === entityId && r.targetId === targetId) ||
          (r.sourceId === targetId && r.targetId === entityId)
      );
    },
    [entityId, getRelationships]
  );

  /**
   * Get all relationships for this entity
   */
  const getLinks = useCallback(
    (type?: RelationshipType) => {
      return getRelationships(entityId, type);
    },
    [entityId, getRelationships]
  );

  return {
    linkTo,
    unlink,
    unlinkFrom,
    isLinkedTo,
    getLinks,
  };
}

/**
 * Export type for external use
 */
export type { UseRelationshipActionsResult };
