/**
 * RelationshipManager Integration Tests
 *
 * End-to-end tests for the RelationshipManager service.
 * Tests full lifecycle workflows and complex scenarios.
 *
 * Test Coverage:
 * - Full lifecycle flows (10+ tests)
 * - Real-world scenarios
 * - Complex bidirectional operations
 * - Event chains and propagation
 * - Large dataset handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RelationshipManager } from '@/services/relationshipManager';
import { EventBus } from '@/services/eventBus';
import { createMockStorage, MockStorageAdapter } from '../mocks/mockStorage';
import {
  testTask,
  testTask2,
  testNote,
  testNote2,
  testSession,
  testTopic,
  generateTasks,
  generateNotes,
  createTestTask,
  createTestNote,
} from '../fixtures/relationships';
import {
  waitForEvent,
  expectNoActiveTransactions,
  measureTime,
  sleep,
} from '../utils/testHelpers';
import { BaseRelationshipStrategy } from '@/services/relationshipStrategies/RelationshipStrategy';
import type { Relationship } from '@/types/relationships';

describe('RelationshipManager Integration Tests', () => {
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
    await storage.save('tasks', [testTask, testTask2]);
    await storage.save('notes', [testNote, testNote2]);
    await storage.save('sessions', [testSession]);
    await storage.save('topics', [testTopic]);

    await manager.init();
  });

  afterEach(() => {
    eventBus.clear();
    storage.reset();
  });

  // ===== END-TO-END FLOW TESTS =====

  describe('End-to-End Workflows', () => {
    it('should complete full relationship lifecycle', async () => {
      // Initialize manager
      expect(manager).toBeDefined();

      // Add relationship
      const rel = await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
        metadata: {
          source: 'manual',
          confidence: 0.95,
        },
      });

      expect(rel.id).toBeDefined();

      // Query relationships
      const rels = manager.getRelationships({ entityId: 'task-1' });
      expect(rels.length).toBeGreaterThan(0);

      // Query related entities
      const notes = await manager.getRelatedEntities<any>('task-1', 'task-note');
      expect(notes.length).toBeGreaterThan(0);

      // Remove relationship
      await manager.removeRelationship({ relationshipId: rel.id });

      // Verify removal
      const relsAfter = manager.getRelationships({ entityId: 'task-1' });
      expect(relsAfter).toHaveLength(0);

      // Verify storage is clean
      const tasks = await storage.load<any[]>('tasks');
      const task = tasks?.find((t) => t.id === 'task-1');
      expect(task?.relationships || []).toHaveLength(0);
    });

    it('should handle bidirectional consistency across full lifecycle', async () => {
      // Add bidirectional relationship
      const rel = await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      // Verify both directions exist
      const taskRels = manager.getRelationships({ entityId: 'task-1' });
      const noteRels = manager.getRelationships({ entityId: 'note-1' });

      expect(taskRels.length).toBeGreaterThan(0);
      expect(noteRels.length).toBeGreaterThan(0);

      // Query from both sides
      const notesFromTask = await manager.getRelatedEntities<any>('task-1', 'task-note');
      const tasksFromNote = await manager.getRelatedEntities<any>('note-1', 'task-note');

      expect(notesFromTask.length).toBeGreaterThan(0);
      expect(tasksFromNote.length).toBeGreaterThan(0);

      // Remove from one side
      await manager.removeRelationship({ relationshipId: rel.id });

      // Verify both removed
      expect(manager.getRelationships({ entityId: 'task-1' })).toHaveLength(0);
      expect(manager.getRelationships({ entityId: 'note-1' })).toHaveLength(0);
    });

    it('should maintain transaction atomicity in complex operations', async () => {
      // Simulate failure mid-operation
      let addCount = 0;
      const originalCommit = storage.commitPhase24Transaction.bind(storage);

      vi.spyOn(storage, 'commitPhase24Transaction').mockImplementation(async (txId) => {
        addCount++;
        if (addCount === 2) {
          throw new Error('Simulated failure');
        }
        return originalCommit(txId);
      });

      // First add should succeed
      await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      // Second add should fail
      await expect(
        manager.addRelationship({
          sourceType: 'task',
          sourceId: 'task-2',
          targetType: 'note',
          targetId: 'note-2',
          type: 'task-note',
        })
      ).rejects.toThrow('Simulated failure');

      // Verify only first relationship exists
      const task1Rels = manager.getRelationships({ entityId: 'task-1' });
      const task2Rels = manager.getRelationships({ entityId: 'task-2' });

      expect(task1Rels.length).toBeGreaterThan(0);
      expect(task2Rels).toHaveLength(0);

      // Verify no partial state
      expectNoActiveTransactions(storage);
    });

    it('should emit events in correct order during lifecycle', async () => {
      const events: string[] = [];

      eventBus.on('RELATIONSHIP_ADDED', () => events.push('ADDED'));
      eventBus.on('RELATIONSHIP_REMOVED', () => events.push('REMOVED'));

      const rel = await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      await manager.removeRelationship({ relationshipId: rel.id });

      // Wait for async events
      await sleep(50);

      expect(events).toEqual(['ADDED', 'REMOVED']);
    });

    it('should persist relationships across manager instances', async () => {
      // Add relationship
      await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      // Create new manager instance
      const newManager = new RelationshipManager();
      await newManager.init();

      // Should find existing relationship
      const rels = newManager.getRelationships({ entityId: 'task-1' });
      expect(rels.length).toBeGreaterThan(0);
    });

    it('should handle index synchronization during operations', async () => {
      // Add 100 relationships
      const tasks = generateTasks(10);
      const notes = generateNotes(10);

      await storage.save('tasks', tasks);
      await storage.save('notes', notes);

      // Reinitialize to pick up new entities
      await manager.init();

      const relationships: Relationship[] = [];

      for (let i = 0; i < 100; i++) {
        const taskId = tasks[i % 10].id;
        const noteId = notes[i % 10].id;

        const rel = await manager.addRelationship({
          sourceType: 'task',
          sourceId: taskId,
          targetType: 'note',
          targetId: noteId,
          type: 'task-note',
        });

        relationships.push(rel);
      }

      // Verify index has all relationships
      let totalRels = 0;
      for (const task of tasks) {
        const rels = manager.getRelationships({ entityId: task.id });
        totalRels += rels.length;
      }

      expect(totalRels).toBeGreaterThanOrEqual(100);

      // Remove 50 relationships
      for (let i = 0; i < 50; i++) {
        await manager.removeRelationship({ relationshipId: relationships[i].id });
      }

      // Verify index updated
      let totalRelsAfter = 0;
      for (const task of tasks) {
        const rels = manager.getRelationships({ entityId: task.id });
        totalRelsAfter += rels.length;
      }

      expect(totalRelsAfter).toBeLessThan(totalRels);

      // Query performance should still be fast
      const queryTime = await measureTime(async () => {
        manager.getRelationships({ entityId: tasks[0].id });
      });

      expect(queryTime).toBeLessThan(5); // <5ms
    });

    it('should execute strategy hooks throughout lifecycle', async () => {
      const hooksCalled: string[] = [];

      class LifecycleStrategy extends BaseRelationshipStrategy {
        async beforeAdd() {
          hooksCalled.push('beforeAdd');
        }
        async afterAdd() {
          hooksCalled.push('afterAdd');
        }
        async beforeRemove() {
          hooksCalled.push('beforeRemove');
        }
        async afterRemove() {
          hooksCalled.push('afterRemove');
        }
      }

      manager.registerStrategy('task-note', new LifecycleStrategy());

      const rel = await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      expect(hooksCalled).toEqual(['beforeAdd', 'afterAdd']);

      hooksCalled.length = 0;

      await manager.removeRelationship({ relationshipId: rel.id });

      expect(hooksCalled).toEqual(['beforeRemove', 'afterRemove']);
    });

    it('should handle errors gracefully with proper propagation', async () => {
      // Trigger validation error
      let errorCaught = false;

      try {
        await manager.addRelationship({
          sourceType: 'task',
          sourceId: 'task-1',
          targetType: 'note',
          targetId: 'note-1',
          type: 'invalid-type' as any,
        });
      } catch (error) {
        errorCaught = true;
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Invalid relationship type');
      }

      expect(errorCaught).toBe(true);

      // Trigger storage error
      vi.spyOn(storage, 'commitPhase24Transaction').mockRejectedValueOnce(
        new Error('Storage failure')
      );

      errorCaught = false;

      try {
        await manager.addRelationship({
          sourceType: 'task',
          sourceId: 'task-1',
          targetType: 'note',
          targetId: 'note-1',
          type: 'task-note',
        });
      } catch (error) {
        errorCaught = true;
        expect(error).toBeDefined();
      }

      expect(errorCaught).toBe(true);
    });

    it('should handle concurrent operations without race conditions', async () => {
      // Add 10 relationships concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          manager.addRelationship({
            sourceType: 'task',
            sourceId: i % 2 === 0 ? 'task-1' : 'task-2',
            targetType: 'note',
            targetId: `note-${i}`,
            type: 'task-note',
          })
        );
      }

      // Create dummy notes for the concurrent operations
      const extraNotes = [];
      for (let i = 2; i < 10; i++) {
        extraNotes.push(createTestNote({ id: `note-${i}` }));
      }
      await storage.save('notes', [testNote, testNote2, ...extraNotes]);

      // Reinitialize to pick up new notes
      await manager.init();

      // Run concurrent adds again
      const results = await Promise.all(promises);

      // Verify all succeeded
      expect(results).toHaveLength(10);
      results.forEach((rel) => expect(rel.id).toBeDefined());

      // Verify final state is consistent
      const task1Rels = manager.getRelationships({ entityId: 'task-1' });
      const task2Rels = manager.getRelationships({ entityId: 'task-2' });

      expect(task1Rels.length + task2Rels.length).toBeGreaterThanOrEqual(10);

      // No active transactions
      expectNoActiveTransactions(storage);
    });

    it('should handle large datasets efficiently', async () => {
      // Create 100 tasks and 100 notes
      const tasks = generateTasks(100);
      const notes = generateNotes(100);

      await storage.save('tasks', tasks);
      await storage.save('notes', notes);

      // Reinitialize
      await manager.init();

      // Add 1000 relationships
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        const taskId = tasks[i % 100].id;
        const noteId = notes[(i + 1) % 100].id;

        await manager.addRelationship({
          sourceType: 'task',
          sourceId: taskId,
          targetType: 'note',
          targetId: noteId,
          type: 'task-note',
        });
      }

      const addTime = Date.now() - startTime;

      // Should complete in reasonable time (<5s for 1000 relationships)
      expect(addTime).toBeLessThan(5000);

      // Query performance should be fast
      const queryTime = await measureTime(async () => {
        manager.getRelationships({ entityId: tasks[0].id });
      });

      expect(queryTime).toBeLessThan(10); // <10ms

      // Remove 500 relationships
      const allRels = manager.getRelationships({ entityId: tasks[0].id });
      const toRemove = allRels.slice(0, Math.min(500, allRels.length));

      const removeStartTime = Date.now();

      for (const rel of toRemove) {
        await manager.removeRelationship({ relationshipId: rel.id });
      }

      const removeTime = Date.now() - removeStartTime;

      // Removal should also be fast
      expect(removeTime).toBeLessThan(5000);

      // Memory usage should be acceptable (just verify it doesn't crash)
      expect(manager).toBeDefined();
    });
  });

  // ===== REAL-WORLD SCENARIOS =====

  describe('Real-World Scenarios', () => {
    it('should handle multi-entity relationship graph', async () => {
      // Create a graph: Task -> Note -> Topic -> Company
      await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      await manager.addRelationship({
        sourceType: 'note',
        sourceId: 'note-1',
        targetType: 'topic',
        targetId: 'topic-1',
        type: 'note-topic',
      });

      // Traverse graph
      const notesFromTask = await manager.getRelatedEntities<any>('task-1', 'task-note');
      expect(notesFromTask).toHaveLength(1);

      const topicsFromNote = await manager.getRelatedEntities<any>('note-1', 'note-topic');
      expect(topicsFromNote).toHaveLength(1);
    });

    it('should handle note threading (parent-child relationships)', async () => {
      // Create parent-child note relationships
      await manager.addRelationship({
        sourceType: 'note',
        sourceId: 'note-1',
        targetType: 'note',
        targetId: 'note-2',
        type: 'note-parent',
      });

      // Verify unidirectional
      const note1Rels = manager.getRelationships({ entityId: 'note-1' });
      const note2Rels = manager.getRelationships({ entityId: 'note-2' });

      expect(note1Rels.length).toBeGreaterThan(0);
      expect(note2Rels).toHaveLength(0); // Unidirectional, so note-2 has no relationships
    });

    it('should prevent duplicate relationships (idempotency)', async () => {
      // Add same relationship multiple times
      const rel1 = await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      const rel2 = await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      const rel3 = await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      // Should all return the same relationship
      expect(rel1.id).toBe(rel2.id);
      expect(rel2.id).toBe(rel3.id);

      // Only one relationship should exist
      const rels = manager.getRelationships({ entityId: 'task-1' });
      const taskNoteRels = rels.filter((r) => r.type === 'task-note' && r.targetId === 'note-1');
      expect(taskNoteRels).toHaveLength(1);
    });

    it('should handle entity not found gracefully during queries', async () => {
      // Add relationship
      const rel = await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      // Delete note from storage
      await storage.save('notes', []);

      // Query should still work, just skip missing entity
      const entities = await manager.getRelatedEntities('task-1');
      // Should not throw, entities will be empty or exclude the missing note
      expect(entities).toBeDefined();
    });

    it('should handle mixed relationship types for same entity', async () => {
      // Add multiple types of relationships for task-1
      await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'note',
        targetId: 'note-1',
        type: 'task-note',
      });

      await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'session',
        targetId: 'session-1',
        type: 'task-session',
      });

      await manager.addRelationship({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'topic',
        targetId: 'topic-1',
        type: 'task-topic',
      });

      // Query all relationships
      const allRels = manager.getRelationships({ entityId: 'task-1' });
      expect(allRels.length).toBeGreaterThanOrEqual(3);

      // Query by type
      const taskNoteRels = manager.getRelationships({
        entityId: 'task-1',
        relationshipType: 'task-note',
      });
      expect(taskNoteRels.length).toBeGreaterThanOrEqual(1);
    });
  });
});
