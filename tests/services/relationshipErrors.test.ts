/**
 * Relationship Error Handling Tests
 *
 * Tests for all relationship error classes and error scenarios.
 *
 * Test Coverage:
 * - RelationshipError base class
 * - ValidationError
 * - DuplicateRelationshipError
 * - RelationshipNotFoundError
 * - EntityNotFoundError
 * - TransactionError
 * - Error codes and details
 * - Error serialization
 */

import { describe, it, expect } from 'vitest';
import {
  RelationshipError,
  ValidationError,
  DuplicateRelationshipError,
  RelationshipNotFoundError,
  EntityNotFoundError,
  TransactionError,
  ErrorCode,
} from '@/services/errors/RelationshipError';

describe('Relationship Error Classes', () => {
  // ===== BASE ERROR CLASS =====

  describe('RelationshipError', () => {
    it('should create error with message and code', () => {
      const error = new RelationshipError('Test error', 'TEST_CODE');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('RelationshipError');
    });

    it('should include optional details', () => {
      const details = { field: 'value', count: 42 };
      const error = new RelationshipError('Test error', 'TEST_CODE', details);

      expect(error.details).toEqual(details);
    });

    it('should have proper stack trace', () => {
      const error = new RelationshipError('Test error', 'TEST_CODE');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('RelationshipError');
    });

    it('should be instance of Error', () => {
      const error = new RelationshipError('Test error', 'TEST_CODE');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof RelationshipError).toBe(true);
    });

    it('should have code property', () => {
      const error = new RelationshipError('Test error', 'CUSTOM_CODE');

      expect(error.code).toBe('CUSTOM_CODE');
    });

    it('should support error details of any type', () => {
      const arrayDetails = [1, 2, 3];
      const stringDetails = 'error details';
      const objectDetails = { nested: { value: 'test' } };

      expect(new RelationshipError('', 'CODE', arrayDetails).details).toEqual(arrayDetails);
      expect(new RelationshipError('', 'CODE', stringDetails).details).toBe(stringDetails);
      expect(new RelationshipError('', 'CODE', objectDetails).details).toEqual(objectDetails);
    });
  });

  // ===== VALIDATION ERROR =====

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.name).toBe('ValidationError');
    });

    it('should include validation details', () => {
      const details = {
        field: 'sourceType',
        value: 'invalid',
        allowedValues: ['task', 'note'],
      };

      const error = new ValidationError('Invalid source type', details);

      expect(error.details).toEqual(details);
    });

    it('should extend RelationshipError', () => {
      const error = new ValidationError('Test');

      expect(error instanceof RelationshipError).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
    });

    it('should have correct error code', () => {
      const error = new ValidationError('Test');

      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ===== DUPLICATE RELATIONSHIP ERROR =====

  describe('DuplicateRelationshipError', () => {
    it('should create duplicate error', () => {
      const error = new DuplicateRelationshipError('Relationship already exists');

      expect(error.message).toBe('Relationship already exists');
      expect(error.code).toBe(ErrorCode.DUPLICATE_RELATIONSHIP);
      expect(error.name).toBe('DuplicateRelationshipError');
    });

    it('should include duplicate details', () => {
      const details = {
        existingRelationshipId: 'rel-123',
        sourceId: 'task-1',
        targetId: 'note-1',
      };

      const error = new DuplicateRelationshipError('Duplicate found', details);

      expect(error.details).toEqual(details);
    });

    it('should extend RelationshipError', () => {
      const error = new DuplicateRelationshipError('Test');

      expect(error instanceof RelationshipError).toBe(true);
      expect(error instanceof DuplicateRelationshipError).toBe(true);
    });
  });

  // ===== RELATIONSHIP NOT FOUND ERROR =====

  describe('RelationshipNotFoundError', () => {
    it('should create not found error', () => {
      const error = new RelationshipNotFoundError('Relationship not found');

      expect(error.message).toBe('Relationship not found');
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.name).toBe('RelationshipNotFoundError');
    });

    it('should include not found details', () => {
      const details = { relationshipId: 'rel-nonexistent' };

      const error = new RelationshipNotFoundError('Not found', details);

      expect(error.details).toEqual(details);
    });

    it('should extend RelationshipError', () => {
      const error = new RelationshipNotFoundError('Test');

      expect(error instanceof RelationshipError).toBe(true);
      expect(error instanceof RelationshipNotFoundError).toBe(true);
    });
  });

  // ===== ENTITY NOT FOUND ERROR =====

  describe('EntityNotFoundError', () => {
    it('should create entity not found error', () => {
      const error = new EntityNotFoundError('Entity not found');

      expect(error.message).toBe('Entity not found');
      expect(error.code).toBe(ErrorCode.ENTITY_NOT_FOUND);
      expect(error.name).toBe('EntityNotFoundError');
    });

    it('should include entity details', () => {
      const details = {
        entityType: 'task',
        entityId: 'task-nonexistent',
        operation: 'addRelationship',
      };

      const error = new EntityNotFoundError('Entity not found', details);

      expect(error.details).toEqual(details);
    });

    it('should extend RelationshipError', () => {
      const error = new EntityNotFoundError('Test');

      expect(error instanceof RelationshipError).toBe(true);
      expect(error instanceof EntityNotFoundError).toBe(true);
    });
  });

  // ===== TRANSACTION ERROR =====

  describe('TransactionError', () => {
    it('should create transaction error', () => {
      const error = new TransactionError('Transaction failed');

      expect(error.message).toBe('Transaction failed');
      expect(error.code).toBe(ErrorCode.TRANSACTION_ERROR);
      expect(error.name).toBe('TransactionError');
    });

    it('should include transaction details', () => {
      const details = {
        transactionId: 'tx-123',
        operationCount: 3,
        failedAt: 'commit',
      };

      const error = new TransactionError('Commit failed', details);

      expect(error.details).toEqual(details);
    });

    it('should extend RelationshipError', () => {
      const error = new TransactionError('Test');

      expect(error instanceof RelationshipError).toBe(true);
      expect(error instanceof TransactionError).toBe(true);
    });

    it('should wrap original error', () => {
      const originalError = new Error('Storage failure');
      const details = { originalError };

      const error = new TransactionError('Transaction failed', details);

      expect(error.details).toEqual(details);
      expect((error.details as any).originalError).toBe(originalError);
    });
  });

  // ===== ERROR CODES =====

  describe('ErrorCode', () => {
    it('should have all error codes defined', () => {
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCode.DUPLICATE_RELATIONSHIP).toBe('DUPLICATE_RELATIONSHIP');
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCode.ENTITY_NOT_FOUND).toBe('ENTITY_NOT_FOUND');
      expect(ErrorCode.TRANSACTION_ERROR).toBe('TRANSACTION_ERROR');
      expect(ErrorCode.OPERATION_FAILED).toBe('OPERATION_FAILED');
      expect(ErrorCode.STORAGE_ERROR).toBe('STORAGE_ERROR');
      expect(ErrorCode.INVALID_STATE).toBe('INVALID_STATE');
    });

    it('should use error codes consistently', () => {
      const validationError = new ValidationError('Test');
      const duplicateError = new DuplicateRelationshipError('Test');
      const notFoundError = new RelationshipNotFoundError('Test');
      const entityError = new EntityNotFoundError('Test');
      const transactionError = new TransactionError('Test');

      expect(validationError.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(duplicateError.code).toBe(ErrorCode.DUPLICATE_RELATIONSHIP);
      expect(notFoundError.code).toBe(ErrorCode.NOT_FOUND);
      expect(entityError.code).toBe(ErrorCode.ENTITY_NOT_FOUND);
      expect(transactionError.code).toBe(ErrorCode.TRANSACTION_ERROR);
    });
  });

  // ===== ERROR SERIALIZATION =====

  describe('Error Serialization', () => {
    it('should serialize error with message and code', () => {
      const error = new ValidationError('Invalid input', { field: 'sourceType' });

      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        code: error.code,
        details: error.details,
      });

      const parsed = JSON.parse(serialized);

      expect(parsed.name).toBe('ValidationError');
      expect(parsed.message).toBe('Invalid input');
      expect(parsed.code).toBe('VALIDATION_ERROR');
      expect(parsed.details).toEqual({ field: 'sourceType' });
    });

    it('should serialize error without details', () => {
      const error = new TransactionError('Transaction failed');

      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        code: error.code,
      });

      const parsed = JSON.parse(serialized);

      expect(parsed.name).toBe('TransactionError');
      expect(parsed.code).toBe('TRANSACTION_ERROR');
    });

    it('should preserve error type information', () => {
      const error = new EntityNotFoundError('Entity not found');

      expect(error.name).toBe('EntityNotFoundError');
      expect(error.code).toBe('ENTITY_NOT_FOUND');
      expect(error instanceof EntityNotFoundError).toBe(true);
    });
  });

  // ===== ERROR HANDLING PATTERNS =====

  describe('Error Handling Patterns', () => {
    it('should allow error type checking with instanceof', () => {
      const validationError = new ValidationError('Test');
      const transactionError = new TransactionError('Test');

      if (validationError instanceof ValidationError) {
        expect(validationError.code).toBe('VALIDATION_ERROR');
      }

      if (transactionError instanceof TransactionError) {
        expect(transactionError.code).toBe('TRANSACTION_ERROR');
      }
    });

    it('should allow error code-based handling', () => {
      const error = new ValidationError('Test');

      if (error.code === ErrorCode.VALIDATION_ERROR) {
        expect(error.name).toBe('ValidationError');
      }
    });

    it('should support error details for debugging', () => {
      const details = {
        operation: 'addRelationship',
        sourceId: 'task-1',
        targetId: 'note-1',
        validationFailure: 'Invalid source type',
      };

      const error = new ValidationError('Validation failed', details);

      expect(error.details).toEqual(details);
      expect((error.details as any).operation).toBe('addRelationship');
    });

    it('should maintain error hierarchy', () => {
      const error = new EntityNotFoundError('Test');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof RelationshipError).toBe(true);
      expect(error instanceof EntityNotFoundError).toBe(true);
    });
  });
});
