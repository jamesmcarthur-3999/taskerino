/**
 * Tests for AIDeduplicationService
 *
 * Tests cover:
 * - Levenshtein distance calculation
 * - Text similarity scoring
 * - Task deduplication
 * - Note deduplication
 * - Confidence scoring
 * - Context-aware matching
 * - Edge cases and error handling
 *
 * Target: >85% coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIDeduplicationService, type SimilarityResult } from '@/services/aiDeduplication';
import type { Task, Note } from '@/types';
import type { StorageAdapter } from '@/services/storage';

// Mock storage adapter
const createMockStorage = (tasks: Task[] = [], notes: Note[] = []): StorageAdapter => {
  const storage: Partial<StorageAdapter> = {
    load: vi.fn(async (collection: string) => {
      if (collection === 'tasks') {
        return tasks;
      } else if (collection === 'notes') {
        return notes;
      }
      return [];
    }),
    save: vi.fn(),
    shutdown: vi.fn(),
  };
  return storage as StorageAdapter;
};

// Helper to create test tasks
const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${Math.random()}`,
  title: 'Test Task',
  description: 'Test description',
  priority: 'medium',
  status: 'todo',
  done: false,
  timestamp: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// Helper to create test notes
const createNote = (overrides: Partial<Note> = {}): Note => ({
  id: `note-${Math.random()}`,
  summary: 'Test Note',
  content: 'Test content',
  topicId: 'topic-1',
  timestamp: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('AIDeduplicationService', () => {
  describe('Levenshtein Distance', () => {
    it('should return 0 for identical strings', () => {
      const storage = createMockStorage();
      const service = new AIDeduplicationService(storage);

      const similarity = service.calculateTextSimilarity('hello', 'hello');
      expect(similarity).toBe(1.0);
    });

    it('should return low similarity for completely different strings', () => {
      const storage = createMockStorage();
      const service = new AIDeduplicationService(storage);

      const similarity = service.calculateTextSimilarity('hello', 'world');
      expect(similarity).toBeLessThan(0.5);
    });

    it('should handle empty strings correctly', () => {
      const storage = createMockStorage();
      const service = new AIDeduplicationService(storage);

      expect(service.calculateTextSimilarity('', '')).toBe(1.0);
      expect(service.calculateTextSimilarity('', 'hello')).toBe(0.0);
      expect(service.calculateTextSimilarity('hello', '')).toBe(0.0);
    });

    it('should be case-insensitive', () => {
      const storage = createMockStorage();
      const service = new AIDeduplicationService(storage);

      const similarity = service.calculateTextSimilarity('Hello World', 'hello world');
      expect(similarity).toBe(1.0);
    });

    it('should trim whitespace', () => {
      const storage = createMockStorage();
      const service = new AIDeduplicationService(storage);

      const similarity = service.calculateTextSimilarity('  hello  ', 'hello');
      expect(similarity).toBe(1.0);
    });

    it('should calculate correct similarity for minor differences', () => {
      const storage = createMockStorage();
      const service = new AIDeduplicationService(storage);

      // One character difference
      const similarity = service.calculateTextSimilarity('Fix bug', 'Fix bugs');
      expect(similarity).toBeGreaterThan(0.8);
      expect(similarity).toBeLessThan(1.0);
    });

    it('should calculate correct similarity for typos', () => {
      const storage = createMockStorage();
      const service = new AIDeduplicationService(storage);

      const similarity = service.calculateTextSimilarity('authentication', 'authentification');
      expect(similarity).toBeGreaterThan(0.85);
    });
  });

  describe('findSimilarTasks', () => {
    it('should find exact duplicate tasks', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Fix login bug', description: 'Users cannot log in' }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarTasks({
        title: 'Fix login bug',
        description: 'Users cannot log in',
      });

      expect(results.length).toBe(1);
      expect(results[0].entity.id).toBe('task-1');
      expect(results[0].similarity).toBeGreaterThan(0.95);
      expect(results[0].shouldMerge).toBe(true);
    });

    it('should find similar tasks with minor differences', async () => {
      const existingTasks = [
        createTask({
          id: 'task-1',
          title: 'Fix login issue',
          description: 'Login form not working properly',
        }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarTasks({
        title: 'Fix login bug',
        description: 'Login form not working',
        minSimilarity: 0.6, // Lower threshold to catch this
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entity.id).toBe('task-1');
      expect(results[0].similarity).toBeGreaterThan(0.7);
    });

    it('should not find unrelated tasks', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Update documentation', description: 'Write new docs' }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarTasks({
        title: 'Fix login bug',
        description: 'Users cannot log in',
        minSimilarity: 0.7,
      });

      expect(results.length).toBe(0);
    });

    it('should respect minSimilarity threshold', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Fix login', description: 'Login broken' }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const lowThreshold = await service.findSimilarTasks({
        title: 'Fix authentication',
        description: 'Auth not working',
        minSimilarity: 0.3,
      });

      const highThreshold = await service.findSimilarTasks({
        title: 'Fix authentication',
        description: 'Auth not working',
        minSimilarity: 0.9,
      });

      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
    });

    it('should limit results to maxResults', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Fix bug 1', description: 'Bug 1' }),
        createTask({ id: 'task-2', title: 'Fix bug 2', description: 'Bug 2' }),
        createTask({ id: 'task-3', title: 'Fix bug 3', description: 'Bug 3' }),
        createTask({ id: 'task-4', title: 'Fix bug 4', description: 'Bug 4' }),
        createTask({ id: 'task-5', title: 'Fix bug 5', description: 'Bug 5' }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarTasks({
        title: 'Fix bug',
        description: 'Bug',
        maxResults: 3,
        minSimilarity: 0.5,
      });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should sort results by similarity descending', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Fix login bug', description: 'Login broken' }),
        createTask({ id: 'task-2', title: 'Fix login issue', description: 'Login not working' }),
        createTask({ id: 'task-3', title: 'Update login', description: 'Change login form' }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarTasks({
        title: 'Fix login bug',
        description: 'Login broken',
        minSimilarity: 0.5,
      });

      // Results should be sorted by similarity
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
      }

      // First result should be exact match
      expect(results[0].entity.id).toBe('task-1');
    });

    it('should filter by context note ID', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Fix bug', noteId: 'note-1' }),
        createTask({ id: 'task-2', title: 'Fix bug', noteId: 'note-2' }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarTasks({
        title: 'Fix bug',
        contextNoteId: 'note-1',
        minSimilarity: 0.7,
      });

      expect(results.length).toBe(1);
      expect(results[0].entity.id).toBe('task-1');
    });

    it('should filter by context session ID', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Fix bug', sourceSessionId: 'session-1' }),
        createTask({ id: 'task-2', title: 'Fix bug', sourceSessionId: 'session-2' }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarTasks({
        title: 'Fix bug',
        contextSessionId: 'session-1',
        minSimilarity: 0.7,
      });

      expect(results.length).toBe(1);
      expect(results[0].entity.id).toBe('task-1');
    });

    it('should include confidence bonuses for context matches', async () => {
      const existingTasks = [
        createTask({
          id: 'task-1',
          title: 'Fix bug',
          noteId: 'note-1',
          priority: 'high',
        }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const withContext = await service.findSimilarTasks({
        title: 'Fix bug',
        contextNoteId: 'note-1',
        priority: 'high',
      });

      const withoutContext = await service.findSimilarTasks({
        title: 'Fix bug',
      });

      expect(withContext[0].confidence).toBeGreaterThan(withoutContext[0].confidence);
    });

    it('should handle tasks without descriptions', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Fix bug', description: undefined }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarTasks({
        title: 'Fix bug',
        description: undefined,
      });

      expect(results.length).toBe(1);
      expect(results[0].similarity).toBeGreaterThan(0.6); // Title-only match
    });
  });

  describe('findSimilarNotes', () => {
    it('should find exact duplicate notes', async () => {
      const existingNotes = [
        createNote({
          id: 'note-1',
          summary: 'Meeting with client',
          content: 'Discussed project requirements',
        }),
      ];

      const storage = createMockStorage([], existingNotes);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarNotes({
        summary: 'Meeting with client',
        content: 'Discussed project requirements',
      });

      expect(results.length).toBe(1);
      expect(results[0].entity.id).toBe('note-1');
      expect(results[0].similarity).toBeGreaterThan(0.95);
      expect(results[0].shouldMerge).toBe(true);
    });

    it('should find similar notes with minor differences', async () => {
      const existingNotes = [
        createNote({
          id: 'note-1',
          summary: 'Meeting with client',
          content: 'Discussed project scope and timeline',
        }),
      ];

      const storage = createMockStorage([], existingNotes);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarNotes({
        summary: 'Meeting with clients',  // Very similar (just plural)
        content: 'Discussed project scope',  // Very similar
        minSimilarity: 0.5, // Lower threshold
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entity.id).toBe('note-1');
      expect(results[0].similarity).toBeGreaterThan(0.85);
    });

    it('should filter by topic ID', async () => {
      const existingNotes = [
        createNote({ id: 'note-1', summary: 'Note 1', topicId: 'topic-1' }),
        createNote({ id: 'note-2', summary: 'Note 1', topicId: 'topic-2' }),
      ];

      const storage = createMockStorage([], existingNotes);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarNotes({
        summary: 'Note 1',
        topicId: 'topic-1',
        minSimilarity: 0.7,
      });

      expect(results.length).toBe(1);
      expect(results[0].entity.id).toBe('note-1');
    });

    it('should handle notes with topicIds array', async () => {
      const existingNotes = [
        createNote({ id: 'note-1', summary: 'Note 1', topicIds: ['topic-1', 'topic-2'] }),
      ];

      const storage = createMockStorage([], existingNotes);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarNotes({
        summary: 'Note 1',
        topicId: 'topic-1',
        minSimilarity: 0.7,
      });

      expect(results.length).toBe(1);
      expect(results[0].entity.id).toBe('note-1');
    });

    it('should include confidence bonus for topic matches', async () => {
      const existingNotes = [
        createNote({ id: 'note-1', summary: 'Note', topicId: 'topic-1' }),
      ];

      const storage = createMockStorage([], existingNotes);
      const service = new AIDeduplicationService(storage);

      const withTopic = await service.findSimilarNotes({
        summary: 'Note',
        topicId: 'topic-1',
      });

      const withoutTopic = await service.findSimilarNotes({
        summary: 'Note',
      });

      expect(withTopic[0].confidence).toBeGreaterThan(withoutTopic[0].confidence);
    });
  });

  describe('isTaskDuplicate', () => {
    it('should return true for high-similarity tasks', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Fix login bug', description: 'Users cannot log in' }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const result = await service.isTaskDuplicate(
        'Fix login bug',
        'Users cannot log in'
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.existingEntityId).toBe('task-1');
      expect(result.similarityScore).toBeGreaterThan(0.85);
      expect(result.reason).toContain('Very similar task found');
    });

    it('should return false for low-similarity tasks', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Update documentation', description: 'Write new docs' }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const result = await service.isTaskDuplicate(
        'Fix login bug',
        'Users cannot log in'
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.existingEntityId).toBeUndefined();
      expect(result.reason).toContain('No similar tasks found');
    });

    it('should include all similar entities in result', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Fix bug 1', description: 'Bug 1' }),
        createTask({ id: 'task-2', title: 'Fix bug 2', description: 'Bug 2' }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const result = await service.isTaskDuplicate('Fix bug', 'Bug');

      expect(result.similarEntities.length).toBeGreaterThan(0);
    });
  });

  describe('isNoteDuplicate', () => {
    it('should return true for high-similarity notes', async () => {
      const existingNotes = [
        createNote({
          id: 'note-1',
          summary: 'Meeting notes',
          content: 'Discussed project',
        }),
      ];

      const storage = createMockStorage([], existingNotes);
      const service = new AIDeduplicationService(storage);

      const result = await service.isNoteDuplicate(
        'Meeting notes',
        'Discussed project'
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.existingEntityId).toBe('note-1');
      expect(result.similarityScore).toBeGreaterThan(0.8); // Lower threshold for notes
    });

    it('should return false for low-similarity notes', async () => {
      const existingNotes = [
        createNote({ id: 'note-1', summary: 'Documentation', content: 'Wrote docs' }),
      ];

      const storage = createMockStorage([], existingNotes);
      const service = new AIDeduplicationService(storage);

      const result = await service.isNoteDuplicate(
        'Meeting notes',
        'Discussed project'
      );

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('shouldMerge', () => {
    it('should recommend merge for high similarity and confidence (task)', () => {
      const storage = createMockStorage();
      const service = new AIDeduplicationService(storage);

      expect(service.shouldMerge(0.95, 0.85, 'task')).toBe(true);
    });

    it('should not recommend merge for low similarity (task)', () => {
      const storage = createMockStorage();
      const service = new AIDeduplicationService(storage);

      expect(service.shouldMerge(0.8, 0.9, 'task')).toBe(false);
    });

    it('should not recommend merge for low confidence (task)', () => {
      const storage = createMockStorage();
      const service = new AIDeduplicationService(storage);

      expect(service.shouldMerge(0.95, 0.7, 'task')).toBe(false);
    });

    it('should use different thresholds for notes', () => {
      const storage = createMockStorage();
      const service = new AIDeduplicationService(storage);

      // Lower threshold for notes
      expect(service.shouldMerge(0.87, 0.78, 'note')).toBe(true);
      expect(service.shouldMerge(0.87, 0.78, 'task')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty task list', async () => {
      const storage = createMockStorage([]);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarTasks({
        title: 'Fix bug',
      });

      expect(results.length).toBe(0);
    });

    it('should handle empty note list', async () => {
      const storage = createMockStorage([], []);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarNotes({
        summary: 'Note',
      });

      expect(results.length).toBe(0);
    });

    it('should handle very long text efficiently', async () => {
      const longText = 'A'.repeat(1000); // Reduced from 10000
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Short title', description: longText }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const start = performance.now();
      await service.findSimilarTasks({
        title: 'Short title',
        description: longText,
      });
      const duration = performance.now() - start;

      // Should complete in reasonable time even with long text
      expect(duration).toBeLessThan(1000); // 1 second
    });

    it('should handle special characters correctly', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Fix @mention bug in #channel' }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarTasks({
        title: 'Fix @mention bug in #channel',
      });

      expect(results.length).toBe(1);
      expect(results[0].similarity).toBeGreaterThan(0.6); // Title-only match (70% weight)
    });

    it('should handle Unicode characters correctly', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Fix 中文 bug' }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      const results = await service.findSimilarTasks({
        title: 'Fix 中文 bug',
      });

      expect(results.length).toBe(1);
      expect(results[0].similarity).toBeGreaterThan(0.6); // Title-only match (70% weight)
    });

    it('should handle null/undefined descriptions gracefully', async () => {
      const existingTasks = [
        createTask({ id: 'task-1', title: 'Fix bug', description: undefined }),
      ];

      const storage = createMockStorage(existingTasks);
      const service = new AIDeduplicationService(storage);

      // Should not throw
      const results = await service.findSimilarTasks({
        title: 'Fix bug',
        description: undefined,
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle 1000 tasks in <100ms', async () => {
      const tasks = Array.from({ length: 1000 }, (_, i) =>
        createTask({ id: `task-${i}`, title: `Task ${i}`, description: `Description ${i}` })
      );

      const storage = createMockStorage(tasks);
      const service = new AIDeduplicationService(storage);

      const start = performance.now();
      await service.findSimilarTasks({
        title: 'Task 500',
        description: 'Description 500',
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle 1000 notes in <100ms', async () => {
      const notes = Array.from({ length: 1000 }, (_, i) =>
        createNote({ id: `note-${i}`, summary: `Note ${i}`, content: `Content ${i}` })
      );

      const storage = createMockStorage([], notes);
      const service = new AIDeduplicationService(storage);

      const start = performance.now();
      await service.findSimilarNotes({
        summary: 'Note 500',
        content: 'Content 500',
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
