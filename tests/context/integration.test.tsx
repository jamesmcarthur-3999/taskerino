/**
 * Integration tests for Context-Relationship integration
 *
 * Tests the integration of RelationshipContext with TasksContext, NotesContext,
 * SessionListContext, and ActiveSessionContext.
 *
 * @module tests/context/integration.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import React from 'react';
import { RelationshipProvider } from '../../src/context/RelationshipContext';
import { TasksProvider, useTasks } from '../../src/context/TasksContext';
import { NotesProvider, useNotes } from '../../src/context/NotesContext';
import { EntitiesProvider, useEntities } from '../../src/context/EntitiesContext';
import { SessionListProvider, useSessionList } from '../../src/context/SessionListContext';
import { ActiveSessionProvider, useActiveSession } from '../../src/context/ActiveSessionContext';
import { EntityType, RelationshipType } from '../../src/types/relationships';
import type { Task, Note, Session, Topic, Company, Contact } from '../../src/types';
import { generateId } from '../../src/utils/helpers';

// Mock storage
vi.mock('../../src/services/storage', () => ({
  getStorage: vi.fn().mockResolvedValue({
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    beginTransaction: vi.fn().mockResolvedValue({
      save: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    }),
    createBackup: vi.fn().mockResolvedValue('backup-id'),
    shutdown: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock chunked storage
vi.mock('../../src/services/storage/ChunkedSessionStorage', () => ({
  getChunkedStorage: vi.fn().mockResolvedValue({
    listAllMetadata: vi.fn().mockResolvedValue([]),
    loadMetadata: vi.fn().mockResolvedValue(null),
    saveMetadata: vi.fn().mockResolvedValue(undefined),
    saveFullSession: vi.fn().mockResolvedValue(undefined),
    loadFullSession: vi.fn().mockResolvedValue(null),
    appendScreenshot: vi.fn().mockResolvedValue(undefined),
    appendAudioSegment: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock persistence queue
vi.mock('../../src/services/storage/PersistenceQueue', () => ({
  getPersistenceQueue: vi.fn(() => ({
    enqueue: vi.fn(),
    flush: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

// Mock relationship manager
vi.mock('../../src/services/relationshipManager', () => ({
  relationshipManager: {
    init: vi.fn().mockResolvedValue(undefined),
    addRelationship: vi.fn().mockImplementation((params) => ({
      id: `rel-${Date.now()}`,
      ...params,
      canonical: true,
      metadata: {
        ...params.metadata,
        createdAt: params.metadata?.createdAt || new Date().toISOString(),
      },
    })),
    removeRelationship: vi.fn().mockResolvedValue(undefined),
    getRelationships: vi.fn().mockReturnValue([]),
    getRelatedEntities: vi.fn().mockResolvedValue([]),
  },
}));

// Mock event bus
vi.mock('../../src/services/eventBus', () => ({
  eventBus: {
    on: vi.fn().mockReturnValue('listener-id'),
    off: vi.fn(),
    emit: vi.fn(),
  },
}));

// Helper component to access all contexts
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <RelationshipProvider>
      <EntitiesProvider>
        <NotesProvider>
          <TasksProvider>
            <SessionListProvider>
              <ActiveSessionProvider>
                {children}
              </ActiveSessionProvider>
            </SessionListProvider>
          </TasksProvider>
        </NotesProvider>
      </EntitiesProvider>
    </RelationshipProvider>
  );
}

describe('Context Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TasksContext Integration', () => {
    it('should create TASK_NOTE relationship when adding task with noteId', async () => {
      const { relationshipManager } = await import('../../src/services/relationshipManager');

      let taskMethods: ReturnType<typeof useTasks> | null = null;

      function TestComponent() {
        taskMethods = useTasks();
        return null;
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(taskMethods).not.toBeNull();
      });

      const task: Task = {
        id: generateId(),
        title: 'Test Task',
        description: 'Test description',
        priority: 'medium',
        status: 'todo',
        done: false,
        noteId: 'note-123',
        createdBy: 'manual',
        createdAt: new Date().toISOString(),
      };

      await act(async () => {
        await taskMethods!.addTask(task);
      });

      // Verify relationship was created
      expect(relationshipManager.addRelationship).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: EntityType.TASK,
          sourceId: task.id,
          targetType: EntityType.NOTE,
          targetId: 'note-123',
          type: RelationshipType.TASK_NOTE,
        })
      );
    });

    it('should create TASK_SESSION relationship when adding task with sourceSessionId', async () => {
      const { relationshipManager } = await import('../../src/services/relationshipManager');

      let taskMethods: ReturnType<typeof useTasks> | null = null;

      function TestComponent() {
        taskMethods = useTasks();
        return null;
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(taskMethods).not.toBeNull();
      });

      const task: Task = {
        id: generateId(),
        title: 'Test Task',
        description: 'Test description',
        priority: 'medium',
        status: 'todo',
        done: false,
        sourceSessionId: 'session-456',
        createdBy: 'ai',
        createdAt: new Date().toISOString(),
      };

      await act(async () => {
        await taskMethods!.addTask(task);
      });

      // Verify relationship was created
      expect(relationshipManager.addRelationship).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: EntityType.TASK,
          sourceId: task.id,
          targetType: EntityType.SESSION,
          targetId: 'session-456',
          type: RelationshipType.TASK_SESSION,
          metadata: expect.objectContaining({
            source: 'ai',
          }),
        })
      );
    });

    it('should remove all relationships when deleting task', async () => {
      const { relationshipManager } = await import('../../src/services/relationshipManager');

      // Mock existing relationships
      relationshipManager.getRelationships = vi.fn().mockReturnValue([
        {
          id: 'rel-1',
          type: RelationshipType.TASK_NOTE,
          sourceType: EntityType.TASK,
          sourceId: 'task-123',
          targetType: EntityType.NOTE,
          targetId: 'note-456',
          metadata: { source: 'manual', createdAt: new Date().toISOString() },
          canonical: true,
        },
      ]);

      let taskMethods: ReturnType<typeof useTasks> | null = null;

      function TestComponent() {
        taskMethods = useTasks();
        return null;
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(taskMethods).not.toBeNull();
      });

      await act(async () => {
        await taskMethods!.deleteTask('task-123');
      });

      // Verify relationships were deleted
      expect(relationshipManager.getRelationships).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'task-123'
        })
      );
      expect(relationshipManager.removeRelationship).toHaveBeenCalledWith({ relationshipId: 'rel-1' });
    });

    it('should link and unlink task to note using helper methods', async () => {
      const { relationshipManager } = await import('../../src/services/relationshipManager');

      let taskMethods: ReturnType<typeof useTasks> | null = null;

      function TestComponent() {
        const methods = useTasks();
        taskMethods = methods;
        return null;
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(taskMethods).not.toBeNull();
      });

      // Link task to note
      await act(async () => {
        await taskMethods!.linkTaskToNote('task-123', 'note-456');
      });

      expect(relationshipManager.addRelationship).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: EntityType.TASK,
          sourceId: 'task-123',
          targetType: EntityType.NOTE,
          targetId: 'note-456',
          type: RelationshipType.TASK_NOTE,
        })
      );

      // Mock relationship for unlinking
      relationshipManager.getRelationships = vi.fn().mockReturnValue([
        {
          id: 'rel-123',
          type: RelationshipType.TASK_NOTE,
          sourceType: EntityType.TASK,
          sourceId: 'task-123',
          targetType: EntityType.NOTE,
          targetId: 'note-456',
          metadata: { source: 'manual', createdAt: new Date().toISOString() },
          canonical: true,
        },
      ]);

      // Unlink task from note
      await act(async () => {
        await taskMethods!.unlinkTaskFromNote('task-123', 'note-456');
      });

      expect(relationshipManager.removeRelationship).toHaveBeenCalledWith({ relationshipId: 'rel-123' });
    });
  });

  describe('NotesContext Integration', () => {
    it('should create NOTE_TOPIC relationships when adding note with topicIds', async () => {
      const { relationshipManager } = await import('../../src/services/relationshipManager');

      let noteMethods: ReturnType<typeof useNotes> | null = null;
      let entityMethods: ReturnType<typeof useEntities> | null = null;

      function TestComponent() {
        noteMethods = useNotes();
        entityMethods = useEntities();
        return null;
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(noteMethods).not.toBeNull();
        expect(entityMethods).not.toBeNull();
      });

      // Add topics first
      const topic: Topic = {
        id: 'topic-1',
        name: 'Test Topic',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        noteCount: 0,
      };

      act(() => {
        entityMethods!.dispatch({ type: 'ADD_TOPIC', payload: topic });
      });

      const note: Note = {
        id: generateId(),
        content: 'Test note content',
        summary: 'Test note',
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        source: 'manual',
        topicIds: ['topic-1'],
      };

      await act(async () => {
        await noteMethods!.addNote(note);
      });

      // Verify relationship was created
      expect(relationshipManager.addRelationship).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: EntityType.NOTE,
          sourceId: note.id,
          targetType: EntityType.TOPIC,
          targetId: 'topic-1',
          type: RelationshipType.NOTE_TOPIC,
        })
      );
    });

    it('should create NOTE_COMPANY relationships when adding note with companyIds', async () => {
      const { relationshipManager } = await import('../../src/services/relationshipManager');

      let noteMethods: ReturnType<typeof useNotes> | null = null;
      let entityMethods: ReturnType<typeof useEntities> | null = null;

      function TestComponent() {
        noteMethods = useNotes();
        entityMethods = useEntities();
        return null;
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(noteMethods).not.toBeNull();
      });

      // Add company first
      const company: Company = {
        id: 'company-1',
        name: 'Test Company',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        noteCount: 0,
        profile: {},
      };

      act(() => {
        entityMethods!.dispatch({ type: 'ADD_COMPANY', payload: company });
      });

      const note: Note = {
        id: generateId(),
        content: 'Test note content',
        summary: 'Test note',
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        source: 'manual',
        companyIds: ['company-1'],
      };

      await act(async () => {
        await noteMethods!.addNote(note);
      });

      // Verify relationship was created
      expect(relationshipManager.addRelationship).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: EntityType.NOTE,
          sourceId: note.id,
          targetType: EntityType.COMPANY,
          targetId: 'company-1',
          type: RelationshipType.NOTE_COMPANY,
        })
      );
    });

    it('should remove all relationships when deleting note', async () => {
      const { relationshipManager } = await import('../../src/services/relationshipManager');

      // Mock existing relationships
      relationshipManager.getRelationships = vi.fn().mockReturnValue([
        {
          id: 'rel-1',
          type: RelationshipType.NOTE_TOPIC,
          sourceType: EntityType.NOTE,
          sourceId: 'note-123',
          targetType: EntityType.TOPIC,
          targetId: 'topic-456',
          metadata: { source: 'manual', createdAt: new Date().toISOString() },
          canonical: true,
        },
      ]);

      let noteMethods: ReturnType<typeof useNotes> | null = null;
      let entityMethods: ReturnType<typeof useEntities> | null = null;

      function TestComponent() {
        noteMethods = useNotes();
        entityMethods = useEntities();
        return null;
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(noteMethods).not.toBeNull();
      });

      // Add topic first
      const topic: Topic = {
        id: 'topic-456',
        name: 'Test Topic',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        noteCount: 1,
      };

      act(() => {
        entityMethods!.dispatch({ type: 'ADD_TOPIC', payload: topic });
      });

      // Add note to state
      const note: Note = {
        id: 'note-123',
        content: 'Test note',
        summary: 'Test',
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        source: 'manual',
        topicIds: ['topic-456'],
      };

      act(() => {
        noteMethods!.dispatch({ type: 'ADD_NOTE', payload: note });
      });

      await act(async () => {
        await noteMethods!.deleteNote('note-123');
      });

      // Verify relationships were deleted
      expect(relationshipManager.getRelationships).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'note-123'
        })
      );
      expect(relationshipManager.removeRelationship).toHaveBeenCalledWith({ relationshipId: 'rel-1' });
    });
  });

  describe('SessionListContext Integration', () => {
    it('should provide helper methods for linking sessions to tasks', async () => {
      const { relationshipManager } = await import('../../src/services/relationshipManager');

      let sessionMethods: ReturnType<typeof useSessionList> | null = null;

      function TestComponent() {
        sessionMethods = useSessionList();
        return null;
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(sessionMethods).not.toBeNull();
      });

      await act(async () => {
        await sessionMethods!.linkSessionToTask('session-123', 'task-456', {
          confidence: 0.9,
          reasoning: 'Task extracted from session',
        });
      });

      // Verify relationship was created with AI metadata
      expect(relationshipManager.addRelationship).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: EntityType.TASK,
          sourceId: 'task-456',
          targetType: EntityType.SESSION,
          targetId: 'session-123',
          type: RelationshipType.TASK_SESSION,
          metadata: expect.objectContaining({
            source: 'ai',
            confidence: 0.9,
            reasoning: 'Task extracted from session',
          }),
        })
      );
    });

    it('should provide helper methods for linking sessions to notes', async () => {
      const { relationshipManager } = await import('../../src/services/relationshipManager');

      let sessionMethods: ReturnType<typeof useSessionList> | null = null;

      function TestComponent() {
        sessionMethods = useSessionList();
        return null;
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(sessionMethods).not.toBeNull();
      });

      await act(async () => {
        await sessionMethods!.linkSessionToNote('session-123', 'note-789', {
          confidence: 0.85,
          reasoning: 'Note created during session',
        });
      });

      // Verify relationship was created with AI metadata
      expect(relationshipManager.addRelationship).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: EntityType.NOTE,
          sourceId: 'note-789',
          targetType: EntityType.SESSION,
          targetId: 'session-123',
          type: RelationshipType.NOTE_SESSION,
          metadata: expect.objectContaining({
            source: 'ai',
            confidence: 0.85,
            reasoning: 'Note created during session',
          }),
        })
      );
    });
  });

  describe('Cross-Context Integration', () => {
    it('should maintain backward compatibility with legacy fields', async () => {
      let taskMethods: ReturnType<typeof useTasks> | null = null;

      function TestComponent() {
        taskMethods = useTasks();
        return null;
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(taskMethods).not.toBeNull();
      });

      // Create task with legacy noteId field
      const task: Task = {
        id: generateId(),
        title: 'Legacy Task',
        description: 'Test',
        priority: 'medium',
        status: 'todo',
        done: false,
        noteId: 'note-legacy',
        createdBy: 'manual',
        createdAt: new Date().toISOString(),
      };

      await act(async () => {
        await taskMethods!.addTask(task);
      });

      // Should still create relationship
      const { relationshipManager } = await import('../../src/services/relationshipManager');
      expect(relationshipManager.addRelationship).toHaveBeenCalled();
    });
  });
});
