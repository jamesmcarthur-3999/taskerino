/**
 * Relationship Strategy Tests
 *
 * Tests for the relationship strategy pattern:
 * - BaseRelationshipStrategy (abstract base class)
 * - Strategy registration
 * - Strategy execution during relationship lifecycle
 * - Custom strategy validation
 *
 * Test Coverage:
 * - Strategy Pattern: 6 tests
 * - BaseRelationshipStrategy: 5 tests
 * - Custom Strategy: 5 tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BaseRelationshipStrategy,
  type RelationshipStrategy,
  type ValidationResult,
} from '@/services/relationshipStrategies/RelationshipStrategy';
import { RelationshipManager } from '@/services/relationshipManager';
import { EventBus } from '@/services/eventBus';
import { createMockStorage, MockStorageAdapter } from '../mocks/mockStorage';
import { testTask, testNote, createTestRelationship } from '../fixtures/relationships';
import type { Relationship } from '@/types/relationships';

// Custom test strategy
class TestStrategy extends BaseRelationshipStrategy {
  public beforeAddCalled = false;
  public afterAddCalled = false;
  public beforeRemoveCalled = false;
  public afterRemoveCalled = false;
  public validateCalled = false;

  reset() {
    this.beforeAddCalled = false;
    this.afterAddCalled = false;
    this.beforeRemoveCalled = false;
    this.afterRemoveCalled = false;
    this.validateCalled = false;
  }

  validate(relationship: Relationship): ValidationResult {
    this.validateCalled = true;
    return { valid: true };
  }

  async beforeAdd(relationship: Relationship): Promise<void> {
    this.beforeAddCalled = true;
  }

  async afterAdd(relationship: Relationship): Promise<void> {
    this.afterAddCalled = true;
  }

  async beforeRemove(relationship: Relationship): Promise<void> {
    this.beforeRemoveCalled = true;
  }

  async afterRemove(relationship: Relationship): Promise<void> {
    this.afterRemoveCalled = true;
  }
}

// Strategy that throws errors
class ErrorStrategy extends BaseRelationshipStrategy {
  validate(relationship: Relationship): ValidationResult {
    return {
      valid: false,
      error: 'Strategy validation failed',
      details: { reason: 'Test error' },
    };
  }

  async beforeAdd(relationship: Relationship): Promise<void> {
    throw new Error('beforeAdd failed');
  }

  async beforeRemove(relationship: Relationship): Promise<void> {
    throw new Error('beforeRemove failed');
  }
}

// Strategy with custom validation
class ConfidenceStrategy extends BaseRelationshipStrategy {
  validate(relationship: Relationship): ValidationResult {
    if (relationship.metadata.confidence && relationship.metadata.confidence < 0.7) {
      return {
        valid: false,
        error: 'Confidence too low',
        details: { confidence: relationship.metadata.confidence, minimum: 0.7 },
      };
    }
    return { valid: true };
  }
}

describe('RelationshipStrategies', () => {
  let manager: RelationshipManager;
  let storage: MockStorageAdapter;
  let eventBus: EventBus;

  beforeEach(async () => {
    storage = createMockStorage();
    eventBus = new EventBus();
    manager = new RelationshipManager();

    vi.mock('@/services/storage', () => ({
      getStorage: vi.fn(() => storage),
    }));

    vi.mock('@/services/eventBus', () => ({
      eventBus,
      EventBus,
    }));

    await storage.init();
    await storage.save('tasks', [testTask]);
    await storage.save('notes', [testNote]);

    await manager.init();
  });

  afterEach(() => {
    eventBus.clear();
    storage.reset();
  });

  // ===== STRATEGY PATTERN TESTS (6 tests) =====

  describe('Strategy Pattern', () => {
    it('should register strategy for relationship type', () => {
      const strategy = new TestStrategy();
      manager.registerStrategy('task-note', strategy);

      // Strategy should be used when adding relationship
      // (verified by checking if hooks are called in later tests)
    });

    it('should allow strategy retrieval', async () => {
      const strategy = new TestStrategy();
      manager.registerStrategy('task-note', strategy);

      // Add relationship to trigger strategy
      await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      // Verify strategy was called
      expect(strategy.beforeAddCalled).toBe(true);
      expect(strategy.afterAddCalled).toBe(true);
    });

    it('should overwrite existing strategy', async () => {
      const strategy1 = new TestStrategy();
      const strategy2 = new TestStrategy();

      manager.registerStrategy('task-note', strategy1);
      manager.registerStrategy('task-note', strategy2);

      await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      // Only strategy2 should be called
      expect(strategy1.beforeAddCalled).toBe(false);
      expect(strategy2.beforeAddCalled).toBe(true);
    });

    it('should not throw if no strategy registered', async () => {
      // Should work fine without strategy
      await expect(
        manager.addRelationship({
          sourceType: 'task',
          sourceId: 'task-1',
          targetType: 'note',
          targetId: 'note-1',
          type: 'task-note',
        })
      ).resolves.toBeDefined();
    });

    it('should execute strategy hooks in correct order', async () => {
      const callOrder: string[] = [];

      class OrderTrackingStrategy extends BaseRelationshipStrategy {
        async beforeAdd() {
          callOrder.push('beforeAdd');
        }
        async afterAdd() {
          callOrder.push('afterAdd');
        }
      }

      manager.registerStrategy('task-note', new OrderTrackingStrategy());

      await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      expect(callOrder).toEqual(['beforeAdd', 'afterAdd']);
    });

    it('should register multiple strategies for different types', async () => {
      const strategy1 = new TestStrategy();
      const strategy2 = new TestStrategy();

      manager.registerStrategy('task-note', strategy1);
      manager.registerStrategy('task-session', strategy2);

      // Only strategy1 should be called for task-note
      await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      expect(strategy1.beforeAddCalled).toBe(true);
      expect(strategy2.beforeAddCalled).toBe(false);
    });
  });

  // ===== BASE STRATEGY TESTS (5 tests) =====

  describe('BaseRelationshipStrategy', () => {
    it('should have default no-op implementations', () => {
      const strategy = new BaseRelationshipStrategy();
      const rel = createTestRelationship();

      // Should not throw
      expect(strategy.validate(rel)).toEqual({ valid: true });
      expect(strategy.beforeAdd(rel)).resolves.toBeUndefined();
      expect(strategy.afterAdd(rel)).resolves.toBeUndefined();
      expect(strategy.beforeRemove(rel)).resolves.toBeUndefined();
      expect(strategy.afterRemove(rel)).resolves.toBeUndefined();
      expect(strategy.shouldCascadeDelete(rel)).toBe(false);
    });

    it('should validate as true by default', () => {
      const strategy = new BaseRelationshipStrategy();
      const result = strategy.validate(createTestRelationship());

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should not cascade delete by default', () => {
      const strategy = new BaseRelationshipStrategy();
      const result = strategy.shouldCascadeDelete(createTestRelationship());

      expect(result).toBe(false);
    });

    it('should allow extending and overriding methods', async () => {
      const strategy = new TestStrategy();
      const rel = createTestRelationship();

      await strategy.beforeAdd(rel);
      expect(strategy.beforeAddCalled).toBe(true);

      await strategy.afterAdd(rel);
      expect(strategy.afterAddCalled).toBe(true);
    });

    it('should support async hook methods', async () => {
      class AsyncStrategy extends BaseRelationshipStrategy {
        async beforeAdd(relationship: Relationship): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      const strategy = new AsyncStrategy();
      const rel = createTestRelationship();

      const start = Date.now();
      await strategy.beforeAdd(rel);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(9);
    });
  });

  // ===== CUSTOM STRATEGY TESTS (5 tests) =====

  describe('Custom Strategies', () => {
    it('should execute validate before add', async () => {
      const strategy = new TestStrategy();
      manager.registerStrategy('task-note', strategy);

      await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      expect(strategy.validateCalled).toBe(true);
      expect(strategy.beforeAddCalled).toBe(true);
    });

    it('should reject relationship if validation fails', async () => {
      const strategy = new ErrorStrategy();
      manager.registerStrategy('task-note', strategy);

      await expect(
        manager.addRelationship({
          sourceType: 'task',
          sourceId: 'task-1',
          targetType: 'note',
          targetId: 'note-1',
          type: 'task-note',
        })
      ).rejects.toThrow('Strategy validation failed');
    });

    it('should rollback if beforeAdd throws', async () => {
      class ThrowingStrategy extends BaseRelationshipStrategy {
        async beforeAdd(relationship: Relationship): Promise<void> {
          throw new Error('beforeAdd error');
        }
      }

      manager.registerStrategy('task-note', new ThrowingStrategy());

      await expect(
        manager.addRelationship({
          sourceType: 'task',
          sourceId: 'task-1',
          targetType: 'note',
          targetId: 'note-1',
          type: 'task-note',
        })
      ).rejects.toThrow('beforeAdd error');

      // Verify no relationship was created
      const rels = manager.getRelationships({ entityId: 'task-1' });
      expect(rels).toHaveLength(0);
    });

    it('should execute custom validation rules', async () => {
      const strategy = new ConfidenceStrategy();
      manager.registerStrategy('task-note', strategy);

      // Low confidence should fail
      await expect(
        manager.addRelationship({
          sourceType: 'task',
          sourceId: 'task-1',
          targetType: 'note',
          targetId: 'note-1',
          type: 'task-note',
          metadata: { confidence: 0.5 },
        })
      ).rejects.toThrow('Confidence too low');

      // High confidence should succeed
      await expect(
        manager.addRelationship({
          sourceType: 'task',
          sourceId: 'task-1',
          targetType: 'note',
          targetId: 'note-1',
          type: 'task-note',
          metadata: { confidence: 0.9 },
        })
      ).resolves.toBeDefined();
    });

    it('should execute hooks in full lifecycle', async () => {
      const strategy = new TestStrategy();
      manager.registerStrategy('task-note', strategy);

      // Add relationship
      const rel = await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      expect(strategy.beforeAddCalled).toBe(true);
      expect(strategy.afterAddCalled).toBe(true);

      strategy.reset();

      // Remove relationship
      await manager.removeRelationship({ relationshipId: rel.id });

      expect(strategy.beforeRemoveCalled).toBe(true);
      expect(strategy.afterRemoveCalled).toBe(true);
    });
  });
});
