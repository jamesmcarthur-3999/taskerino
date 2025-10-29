/**
 * RelationshipManager Performance Benchmarks
 *
 * Performance tests using Vitest's benchmark API.
 * Measures execution time for critical operations.
 *
 * Performance Targets:
 * - addRelationship: <10ms per operation
 * - removeRelationship: <10ms per operation
 * - getRelationships: <5ms per query
 * - getRelatedEntities: <50ms for 10 entities
 * - Bulk operations (100 items): <100ms total
 */

import { describe, bench, beforeAll, afterAll } from 'vitest';
import { RelationshipManager } from '@/services/relationshipManager';
import { EventBus } from '@/services/eventBus';
import { createMockStorage, MockStorageAdapter } from '../mocks/mockStorage';
import { generateTasks, generateNotes } from '../fixtures/relationships';

describe('RelationshipManager Performance Benchmarks', () => {
  let manager: RelationshipManager;
  let storage: MockStorageAdapter;
  let eventBus: EventBus;
  let tasks: any[];
  let notes: any[];

  beforeAll(async () => {
    storage = createMockStorage();
    eventBus = new EventBus();
    manager = new RelationshipManager();

    // Generate test data
    tasks = generateTasks(100);
    notes = generateNotes(100);

    await storage.init();
    await storage.save('tasks', tasks);
    await storage.save('notes', notes);

    await manager.init();
  });

  afterAll(() => {
    eventBus.clear();
    storage.reset();
  });

  // ===== BASIC OPERATIONS =====

  bench(
    'addRelationship (single operation)',
    async () => {
      const taskId = tasks[Math.floor(Math.random() * tasks.length)].id;
      const noteId = notes[Math.floor(Math.random() * notes.length)].id;

      await manager.addRelationship({
        sourceType: 'task',
        sourceId: taskId,
        targetType: 'note',
        targetId: noteId,
        type: 'task-note',
      });
    },
    {
      time: 1000,
    }
  );

  bench(
    'getRelationships (index lookup)',
    () => {
      const taskId = tasks[Math.floor(Math.random() * tasks.length)].id;
      manager.getRelationships({ entityId: taskId });
    },
    {
      time: 1000,
    }
  );

  bench(
    'getRelationships with filters',
    () => {
      const taskId = tasks[Math.floor(Math.random() * tasks.length)].id;
      manager.getRelationships({
        entityId: taskId,
        relationshipType: 'task-note',
        entityType: 'task',
      });
    },
    {
      time: 1000,
    }
  );

  bench(
    'getRelatedEntities (load from storage)',
    async () => {
      const taskId = tasks[Math.floor(Math.random() * tasks.length)].id;
      await manager.getRelatedEntities(taskId, 'task-note');
    },
    {
      time: 1000,
    }
  );

  bench(
    'removeRelationship (single operation)',
    async () => {
      // Add a relationship first
      const taskId = tasks[0].id;
      const noteId = notes[0].id;

      const rel = await manager.addRelationship({
        sourceType: 'task',
        sourceId: taskId,
        targetType: 'note',
        targetId: noteId,
        type: 'task-note',
      });

      // Benchmark removal
      await manager.removeRelationship({ relationshipId: rel.id });
    },
    {
      time: 1000,
    }
  );

  // ===== BULK OPERATIONS =====

  bench(
    'bulk addRelationship (100 operations)',
    async () => {
      const promises = [];

      for (let i = 0; i < 100; i++) {
        const taskId = tasks[i % tasks.length].id;
        const noteId = notes[i % notes.length].id;

        promises.push(
          manager.addRelationship({
            sourceType: 'task',
            sourceId: taskId,
            targetType: 'note',
            targetId: noteId,
            type: 'task-note',
          })
        );
      }

      await Promise.all(promises);
    },
    {
      time: 5000,
    }
  );

  bench(
    'bulk getRelationships (100 queries)',
    () => {
      for (let i = 0; i < 100; i++) {
        const taskId = tasks[i % tasks.length].id;
        manager.getRelationships({ entityId: taskId });
      }
    },
    {
      time: 5000,
    }
  );

  // ===== COMPLEX SCENARIOS =====

  bench(
    'bidirectional relationship creation',
    async () => {
      const taskId = tasks[Math.floor(Math.random() * tasks.length)].id;
      const noteId = notes[Math.floor(Math.random() * notes.length)].id;

      await manager.addRelationship({
        sourceType: 'task',
        sourceId: taskId,
        targetType: 'note',
        targetId: noteId,
        type: 'task-note',
      });
    },
    {
      time: 1000,
    }
  );

  bench(
    'query entity with many relationships (10+)',
    () => {
      // Assume tasks[0] has many relationships from bulk operations
      manager.getRelationships({ entityId: tasks[0].id });
    },
    {
      time: 1000,
    }
  );

  bench(
    'load 10 related entities',
    async () => {
      // Assume tasks[0] has at least 10 relationships
      await manager.getRelatedEntities(tasks[0].id);
    },
    {
      time: 2000,
    }
  );

  // ===== STRESS TESTS =====

  bench(
    'index lookup with 1000+ relationships',
    async () => {
      // Add 1000 relationships
      for (let i = 0; i < 1000; i++) {
        const taskId = tasks[i % tasks.length].id;
        const noteId = notes[i % notes.length].id;

        await manager.addRelationship({
          sourceType: 'task',
          sourceId: taskId,
          targetType: 'note',
          targetId: noteId,
          type: 'task-note',
        });
      }

      // Benchmark lookup
      manager.getRelationships({ entityId: tasks[0].id });
    },
    {
      time: 10000,
    }
  );
});
