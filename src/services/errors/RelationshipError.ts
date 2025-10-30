/**
 * Relationship Error Classes
 *
 * Provides typed error classes for relationship management operations.
 * Each error class includes a code for programmatic error handling and
 * optional details for debugging and logging.
 *
 * @module services/errors/RelationshipError
 * @since 2.0.0
 */

/**
 * Base class for all relationship-related errors
 *
 * Extends the standard Error class with additional metadata:
 * - code: Machine-readable error code for programmatic handling
 * - details: Optional object with additional debugging information
 *
 * @example
 * ```typescript
 * throw new RelationshipError(
 *   'Failed to create relationship',
 *   'OPERATION_FAILED',
 *   { sourceId: 'task-123', targetId: 'note-456' }
 * );
 * ```
 */
export class RelationshipError extends Error {
  /**
   * Machine-readable error code
   * Used for programmatic error handling and routing
   */
  public readonly code: string;

  /**
   * Optional additional details about the error
   * Can contain any relevant debugging information
   */
  public readonly details?: unknown;

  /**
   * Create a new RelationshipError
   *
   * @param message - Human-readable error message
   * @param code - Machine-readable error code
   * @param details - Optional additional error details
   */
  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'RelationshipError';
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RelationshipError);
    }
  }
}

/**
 * ValidationError - Thrown when relationship validation fails
 *
 * Used for:
 * - Invalid relationship types
 * - Invalid source/target entity types
 * - Missing required metadata
 * - Type mismatches
 *
 * @example
 * ```typescript
 * throw new ValidationError(
 *   'Invalid source type "project" for relationship type "task-note"',
 *   {
 *     relationshipType: 'task-note',
 *     providedSourceType: 'project',
 *     allowedSourceTypes: ['task']
 *   }
 * );
 * ```
 */
export class ValidationError extends RelationshipError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * DuplicateRelationshipError - Thrown when attempting to create a duplicate relationship
 *
 * Note: This is usually not thrown due to idempotency - the existing relationship
 * is returned instead. However, it can be thrown in contexts where duplicates
 * should be explicitly rejected.
 *
 * @example
 * ```typescript
 * throw new DuplicateRelationshipError(
 *   'Relationship already exists between task-123 and note-456',
 *   {
 *     existingRelationshipId: 'rel-abc',
 *     sourceId: 'task-123',
 *     targetId: 'note-456'
 *   }
 * );
 * ```
 */
export class DuplicateRelationshipError extends RelationshipError {
  constructor(message: string, details?: unknown) {
    super(message, 'DUPLICATE_RELATIONSHIP', details);
    this.name = 'DuplicateRelationshipError';
  }
}

/**
 * RelationshipNotFoundError - Thrown when a relationship cannot be found
 *
 * Used for:
 * - Attempting to remove a non-existent relationship
 * - Querying for a relationship by ID that doesn't exist
 * - Invalid relationship references
 *
 * @example
 * ```typescript
 * throw new RelationshipNotFoundError(
 *   'Relationship rel-xyz not found',
 *   { relationshipId: 'rel-xyz' }
 * );
 * ```
 */
export class RelationshipNotFoundError extends RelationshipError {
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND', details);
    this.name = 'RelationshipNotFoundError';
  }
}

/**
 * EntityNotFoundError - Thrown when an entity referenced in a relationship cannot be found
 *
 * Used for:
 * - Adding a relationship to a non-existent entity
 * - Loading related entities that have been deleted
 *
 * @example
 * ```typescript
 * throw new EntityNotFoundError(
 *   'Entity task:task-123 not found',
 *   {
 *     entityType: 'task',
 *     entityId: 'task-123',
 *     operation: 'addRelationship'
 *   }
 * );
 * ```
 */
export class EntityNotFoundError extends RelationshipError {
  constructor(message: string, details?: unknown) {
    super(message, 'ENTITY_NOT_FOUND', details);
    this.name = 'EntityNotFoundError';
  }
}

/**
 * TransactionError - Thrown when a transaction operation fails
 *
 * Used for:
 * - Transaction commit failures
 * - Rollback failures
 * - Concurrent transaction conflicts
 * - Storage errors during transaction
 *
 * @example
 * ```typescript
 * throw new TransactionError(
 *   'Failed to commit transaction tx-123',
 *   {
 *     transactionId: 'tx-123',
 *     operationCount: 3,
 *     error: originalError
 *   }
 * );
 * ```
 */
export class TransactionError extends RelationshipError {
  constructor(message: string, details?: unknown) {
    super(message, 'TRANSACTION_ERROR', details);
    this.name = 'TransactionError';
  }
}

/**
 * Error code constants
 *
 * Use these constants instead of string literals for type safety
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_RELATIONSHIP: 'DUPLICATE_RELATIONSHIP',
  NOT_FOUND: 'NOT_FOUND',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  OPERATION_FAILED: 'OPERATION_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  INVALID_STATE: 'INVALID_STATE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
