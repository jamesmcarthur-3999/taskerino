/**
 * UnifiedIndexManager Tests
 *
 * Comprehensive test suite for unified search across sessions, notes, and tasks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedIndexManager, resetUnifiedIndexManager } from '../UnifiedIndexManager';
import type { Note, Task } from '../../../types';
import type { SessionMetadata } from '../ChunkedSessionStorage';
import type { Relationship } from '../../../types/relationships';
import type { StorageAdapter } from '../StorageAdapter';

// ============================================================================
// Mock Storage Adapter
// ============================================================================

class MockStorageAdapter implements Partial<StorageAdapter> {
  private store = new Map<string, any>();

  async init(): Promise<void> {}

  async save<T>(key: string, data: T): Promise<void> {
    this.store.set(key, JSON.parse(JSON.stringify(data)));
  }

  async load<T>(key: string): Promise<T | null> {
    const data = this.store.get(key);
    return data ? JSON.parse(JSON.stringify(data)) : null;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('UnifiedIndexManager', () => {
  let storage: MockStorageAdapter;
  let manager: UnifiedIndexManager;

  // Sample data
  const mockSessions: SessionMetadata[] = [
    {
      id: 'session-1',
      name: 'Bug fixing session',
      description: 'Fixed authentication bugs',
      status: 'completed',
      startTime: '2024-01-15T10:00:00Z',
      tags: ['backend', 'security'],
      category: 'development',
      screenshotInterval: 30000,
      autoAnalysis: true,
      enableScreenshots: true,
      audioMode: 'transcription',
      audioRecording: true,
      extractedTaskIds: [],
      extractedNoteIds: [],
      chunks: {
        screenshots: { count: 0, chunkCount: 0, chunkSize: 20 },
        audioSegments: { count: 0, chunkCount: 0, chunkSize: 100 },
        videoChunks: { count: 0, chunkCount: 0, chunkSize: 100 }
      },
      hasSummary: false,
      hasAudioInsights: false,
      hasCanvasSpec: false,
      hasTranscription: false,
      hasVideo: false,
      hasFullAudio: false,
      audioReviewCompleted: false,
      storageVersion: 1,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z'
    },
    {
      id: 'session-2',
      name: 'Feature development',
      description: 'Added new dashboard',
      status: 'completed',
      startTime: '2024-01-16T14:00:00Z',
      tags: ['frontend', 'ui'],
      category: 'development',
      screenshotInterval: 30000,
      autoAnalysis: true,
      enableScreenshots: true,
      audioMode: 'transcription',
      audioRecording: true,
      extractedTaskIds: [],
      extractedNoteIds: [],
      chunks: {
        screenshots: { count: 0, chunkCount: 0, chunkSize: 20 },
        audioSegments: { count: 0, chunkCount: 0, chunkSize: 100 },
        videoChunks: { count: 0, chunkCount: 0, chunkSize: 100 }
      },
      hasSummary: false,
      hasAudioInsights: false,
      hasCanvasSpec: false,
      hasTranscription: false,
      hasVideo: false,
      hasFullAudio: false,
      audioReviewCompleted: false,
      storageVersion: 1,
      createdAt: '2024-01-16T14:00:00Z',
      updatedAt: '2024-01-16T14:00:00Z'
    }
  ];

  const mockNotes: Note[] = [
    {
      id: 'note-1',
      content: 'Authentication flow needs refactoring',
      summary: 'Auth refactor needed',
      timestamp: '2024-01-15T10:30:00Z',
      lastUpdated: '2024-01-15T10:30:00Z',
      source: 'thought',
      relationships: [
        {
          id: 'rel-1',
          sourceId: 'note-1',
          sourceType: 'note',
          targetId: 'topic-auth',
          targetType: 'topic',
          type: 'NOTE_TOPIC',
          createdAt: '2024-01-15T10:30:00Z'
        },
        {
          id: 'rel-2',
          sourceId: 'note-1',
          sourceType: 'note',
          targetId: 'session-1',
          targetType: 'session',
          type: 'NOTE_SESSION',
          createdAt: '2024-01-15T10:30:00Z'
        }
      ],
      attachments: [],
      updates: []
    },
    {
      id: 'note-2',
      content: 'Dashboard design mockups completed',
      summary: 'UI mockups ready',
      timestamp: '2024-01-16T15:00:00Z',
      lastUpdated: '2024-01-16T15:00:00Z',
      source: 'thought',
      relationships: [
        {
          id: 'rel-3',
          sourceId: 'note-2',
          sourceType: 'note',
          targetId: 'topic-ui',
          targetType: 'topic',
          type: 'NOTE_TOPIC',
          createdAt: '2024-01-16T15:00:00Z'
        },
        {
          id: 'rel-4',
          sourceId: 'note-2',
          sourceType: 'note',
          targetId: 'company-acme',
          targetType: 'company',
          type: 'NOTE_COMPANY',
          createdAt: '2024-01-16T15:00:00Z'
        }
      ],
      attachments: [],
      updates: []
    }
  ];

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Fix login bug',
      description: 'Users cannot login with 2FA enabled',
      status: 'in_progress',
      priority: 'high',
      completed: false,
      createdAt: '2024-01-15T11:00:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
      relationships: [
        {
          id: 'rel-5',
          sourceId: 'task-1',
          sourceType: 'task',
          targetId: 'topic-auth',
          targetType: 'topic',
          type: 'TASK_TOPIC',
          createdAt: '2024-01-15T11:00:00Z'
        },
        {
          id: 'rel-6',
          sourceId: 'task-1',
          sourceType: 'task',
          targetId: 'session-1',
          targetType: 'session',
          type: 'TASK_SESSION',
          createdAt: '2024-01-15T11:00:00Z'
        }
      ],
      subtasks: [],
      attachments: []
    },
    {
      id: 'task-2',
      title: 'Create dashboard widgets',
      description: 'Implement analytics widgets for dashboard',
      status: 'todo',
      priority: 'medium',
      completed: false,
      createdAt: '2024-01-16T16:00:00Z',
      updatedAt: '2024-01-16T16:00:00Z',
      relationships: [
        {
          id: 'rel-7',
          sourceId: 'task-2',
          sourceType: 'task',
          targetId: 'topic-ui',
          targetType: 'topic',
          type: 'TASK_TOPIC',
          createdAt: '2024-01-16T16:00:00Z'
        }
      ],
      subtasks: [],
      attachments: []
    }
  ];

  const mockRelationships: Relationship[] = [
    ...mockNotes.flatMap(n => n.relationships),
    ...mockTasks.flatMap(t => t.relationships)
  ];

  beforeEach(() => {
    resetUnifiedIndexManager();
    storage = new MockStorageAdapter();
    manager = new UnifiedIndexManager(storage as any, mockRelationships);
  });

  // ============================================================================
  // Index Building Tests
  // ============================================================================

  describe('Index Building', () => {
    it('should build notes indexes', async () => {
      await manager.buildNotesIndexes(mockNotes);

      const stats = await manager.getUnifiedStats();
      expect(stats.notes.count).toBe(2);
      expect(stats.notes.indexes).toContain('fullText');
      expect(stats.notes.indexes).toContain('byTopic');
    });

    it('should build tasks indexes', async () => {
      await manager.buildTasksIndexes(mockTasks);

      const stats = await manager.getUnifiedStats();
      expect(stats.tasks.count).toBe(2);
      expect(stats.tasks.indexes).toContain('fullText');
      expect(stats.tasks.indexes).toContain('byStatus');
    });

    it('should handle empty data', async () => {
      await manager.buildNotesIndexes([]);
      await manager.buildTasksIndexes([]);

      const stats = await manager.getUnifiedStats();
      expect(stats.notes.count).toBe(0);
      expect(stats.tasks.count).toBe(0);
    });

    it('should build relationship index', async () => {
      const stats = await manager.getUnifiedStats();
      expect(stats.relationships.count).toBe(mockRelationships.length);
    });
  });

  // ============================================================================
  // Full-Text Search Tests
  // ============================================================================

  describe('Full-Text Search', () => {
    beforeEach(async () => {
      await manager.buildNotesIndexes(mockNotes);
      await manager.buildTasksIndexes(mockTasks);
    });

    it('should search notes by text', async () => {
      const result = await manager.search({
        query: 'authentication',
        entityTypes: ['notes']
      });

      expect(result.counts.notes).toBe(1);
      expect(result.results.notes[0].id).toBe('note-1');
      expect(result.took).toBeGreaterThan(0);
    });

    it('should search tasks by text', async () => {
      const result = await manager.search({
        query: 'dashboard',
        entityTypes: ['tasks']
      });

      expect(result.counts.tasks).toBe(1);
      expect(result.results.tasks[0].id).toBe('task-2');
    });

    it('should search across multiple entity types', async () => {
      const result = await manager.search({
        query: 'dashboard',
        entityTypes: ['notes', 'tasks']
      });

      expect(result.counts.notes).toBe(1);
      expect(result.counts.tasks).toBe(1);
      expect(result.counts.total).toBe(2);
    });

    it('should return empty results for no matches', async () => {
      const result = await manager.search({
        query: 'nonexistent',
        entityTypes: ['notes', 'tasks']
      });

      expect(result.counts.total).toBe(0);
    });
  });

  // ============================================================================
  // Relationship-Based Search Tests
  // ============================================================================

  describe('Relationship-Based Search', () => {
    beforeEach(async () => {
      await manager.buildNotesIndexes(mockNotes);
      await manager.buildTasksIndexes(mockTasks);
    });

    it('should find notes by topic', async () => {
      const result = await manager.search({
        entityTypes: ['notes'],
        relatedTo: {
          entityType: 'topic',
          entityId: 'topic-auth'
        }
      });

      expect(result.counts.notes).toBe(1);
      expect(result.results.notes[0].id).toBe('note-1');
    });

    it('should find tasks by topic', async () => {
      const result = await manager.search({
        entityTypes: ['tasks'],
        relatedTo: {
          entityType: 'topic',
          entityId: 'topic-auth'
        }
      });

      expect(result.counts.tasks).toBe(1);
      expect(result.results.tasks[0].id).toBe('task-1');
    });

    it('should find all entities related to topic', async () => {
      const result = await manager.search({
        entityTypes: ['notes', 'tasks'],
        relatedTo: {
          entityType: 'topic',
          entityId: 'topic-auth'
        }
      });

      expect(result.counts.notes).toBe(1);
      expect(result.counts.tasks).toBe(1);
      expect(result.counts.total).toBe(2);
    });

    it('should find notes by company', async () => {
      const result = await manager.search({
        entityTypes: ['notes'],
        relatedTo: {
          entityType: 'company',
          entityId: 'company-acme'
        }
      });

      expect(result.counts.notes).toBe(1);
      expect(result.results.notes[0].id).toBe('note-2');
    });

    it('should find entities in session', async () => {
      const result = await manager.search({
        entityTypes: ['notes', 'tasks'],
        relatedTo: {
          entityType: 'session',
          entityId: 'session-1'
        }
      });

      expect(result.counts.notes).toBe(1);
      expect(result.counts.tasks).toBe(1);
    });
  });

  // ============================================================================
  // Filter Tests
  // ============================================================================

  describe('Filters', () => {
    beforeEach(async () => {
      await manager.buildNotesIndexes(mockNotes);
      await manager.buildTasksIndexes(mockTasks);
    });

    it('should filter tasks by status', async () => {
      const result = await manager.search({
        entityTypes: ['tasks'],
        filters: {
          status: 'in_progress'
        }
      });

      expect(result.counts.tasks).toBe(1);
      expect(result.results.tasks[0].id).toBe('task-1');
    });

    it('should filter tasks by priority', async () => {
      const result = await manager.search({
        entityTypes: ['tasks'],
        filters: {
          priority: 'high'
        }
      });

      expect(result.counts.tasks).toBe(1);
      expect(result.results.tasks[0].id).toBe('task-1');
    });

    it('should filter tasks by completed status', async () => {
      const result = await manager.search({
        entityTypes: ['tasks'],
        filters: {
          completed: false
        }
      });

      expect(result.counts.tasks).toBe(2);
    });

    it('should combine multiple filters', async () => {
      const result = await manager.search({
        entityTypes: ['tasks'],
        filters: {
          status: 'in_progress',
          priority: 'high'
        }
      });

      expect(result.counts.tasks).toBe(1);
      expect(result.results.tasks[0].id).toBe('task-1');
    });

    it('should filter by topic IDs', async () => {
      const result = await manager.search({
        entityTypes: ['notes'],
        filters: {
          topicIds: ['topic-auth']
        }
      });

      expect(result.counts.notes).toBe(1);
      expect(result.results.notes[0].id).toBe('note-1');
    });
  });

  // ============================================================================
  // Combined Query Tests
  // ============================================================================

  describe('Combined Queries', () => {
    beforeEach(async () => {
      await manager.buildNotesIndexes(mockNotes);
      await manager.buildTasksIndexes(mockTasks);
    });

    it('should combine text search with relationship filter', async () => {
      const result = await manager.search({
        query: 'authentication',
        entityTypes: ['notes'],
        relatedTo: {
          entityType: 'topic',
          entityId: 'topic-auth'
        }
      });

      expect(result.counts.notes).toBe(1);
      expect(result.results.notes[0].id).toBe('note-1');
    });

    it('should combine text search with filters', async () => {
      const result = await manager.search({
        query: 'dashboard',
        entityTypes: ['tasks'],
        filters: {
          status: 'todo'
        }
      });

      expect(result.counts.tasks).toBe(1);
      expect(result.results.tasks[0].id).toBe('task-2');
    });

    it('should combine relationship filter with entity filters', async () => {
      const result = await manager.search({
        entityTypes: ['tasks'],
        relatedTo: {
          entityType: 'session',
          entityId: 'session-1'
        },
        filters: {
          status: 'in_progress'
        }
      });

      expect(result.counts.tasks).toBe(1);
      expect(result.results.tasks[0].id).toBe('task-1');
    });
  });

  // ============================================================================
  // Incremental Updates Tests
  // ============================================================================

  describe('Incremental Updates', () => {
    beforeEach(async () => {
      await manager.buildNotesIndexes(mockNotes);
      await manager.buildTasksIndexes(mockTasks);
    });

    it('should update note in index', async () => {
      const updatedNote: Note = {
        ...mockNotes[0],
        content: 'Updated authentication documentation',
        summary: 'Auth docs updated'
      };

      await manager.updateNote(updatedNote);

      const result = await manager.search({
        query: 'documentation',
        entityTypes: ['notes']
      });

      expect(result.counts.notes).toBe(1);
      expect(result.results.notes[0].id).toBe('note-1');
    });

    it('should update task in index', async () => {
      const updatedTask: Task = {
        ...mockTasks[0],
        status: 'done',
        completed: true
      };

      await manager.updateTask(updatedTask);

      const result = await manager.search({
        entityTypes: ['tasks'],
        filters: {
          status: 'done'
        }
      });

      expect(result.counts.tasks).toBe(1);
      expect(result.results.tasks[0].id).toBe('task-1');
    });

    it('should remove note from index', async () => {
      await manager.removeNote('note-1');

      const result = await manager.search({
        query: 'authentication',
        entityTypes: ['notes']
      });

      expect(result.counts.notes).toBe(0);
    });

    it('should remove task from index', async () => {
      await manager.removeTask('task-1');

      const result = await manager.search({
        query: 'login',
        entityTypes: ['tasks']
      });

      expect(result.counts.tasks).toBe(0);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should search 1000 notes in <100ms', async () => {
      // Generate 1000 notes
      const largeNoteSet: Note[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `note-${i}`,
        content: `Test content ${i} about ${i % 10 === 0 ? 'authentication' : 'other'}`,
        summary: `Summary ${i}`,
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        source: 'thought',
        relationships: [],
        attachments: [],
        updates: []
      }));

      await manager.buildNotesIndexes(largeNoteSet);

      const start = performance.now();
      const result = await manager.search({
        query: 'authentication',
        entityTypes: ['notes']
      });
      const took = performance.now() - start;

      expect(took).toBeLessThan(100);
      expect(result.counts.notes).toBeGreaterThan(0);
    });

    it('should search 1000 tasks in <100ms', async () => {
      // Generate 1000 tasks
      const largeTaskSet: Task[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        description: `Description ${i}`,
        status: i % 3 === 0 ? 'in_progress' : 'todo',
        priority: 'medium',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        relationships: [],
        subtasks: [],
        attachments: []
      }));

      await manager.buildTasksIndexes(largeTaskSet);

      const start = performance.now();
      const result = await manager.search({
        entityTypes: ['tasks'],
        filters: {
          status: 'in_progress'
        }
      });
      const took = performance.now() - start;

      expect(took).toBeLessThan(100);
      expect(result.counts.tasks).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('Statistics', () => {
    beforeEach(async () => {
      await manager.buildNotesIndexes(mockNotes);
      await manager.buildTasksIndexes(mockTasks);
    });

    it('should return unified statistics', async () => {
      const stats = await manager.getUnifiedStats();

      expect(stats.notes.count).toBe(2);
      expect(stats.tasks.count).toBe(2);
      expect(stats.relationships.count).toBe(mockRelationships.length);
      expect(stats.version).toBe(1);
      expect(stats.lastBuilt).toBeGreaterThan(0);
    });

    it('should list index types', async () => {
      const stats = await manager.getUnifiedStats();

      expect(stats.notes.indexes).toContain('fullText');
      expect(stats.notes.indexes).toContain('byTopic');
      expect(stats.tasks.indexes).toContain('byStatus');
      expect(stats.tasks.indexes).toContain('byPriority');
    });
  });
});
