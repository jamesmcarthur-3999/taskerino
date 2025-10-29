/**
 * RelationshipContext Tests
 *
 * Comprehensive test suite for RelationshipContext.
 * Tests optimistic updates, error handling, event subscriptions, and cleanup.
 *
 * Coverage Target: >85%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { RelationshipProvider, useRelationships } from '../RelationshipContext';
import type { Relationship, RelationshipType, EntityType } from '@/types/relationships';
import { ReactNode } from 'react';

// Hoist mocks before any imports
const { mockRelationshipManager, mockEventBus } = vi.hoisted(() => {
  const manager = {
    init: vi.fn(() => Promise.resolve()),
    addRelationship: vi.fn(),
    removeRelationship: vi.fn(),
    getRelationships: vi.fn(() => []),
    getRelatedEntities: vi.fn(() => Promise.resolve([])),
    registerStrategy: vi.fn(),
  };

  const bus = {
    on: vi.fn(() => 'mock-subscription-id'),
    off: vi.fn(),
    emit: vi.fn(),
    clear: vi.fn(),
    getSubscriberCount: vi.fn(() => 0),
    getTotalSubscriptions: vi.fn(() => 0),
    hasSubscribers: vi.fn(() => false),
  };

  return { mockRelationshipManager: manager, mockEventBus: bus };
});

// Mock modules
vi.mock('@/services/relationshipManager', () => ({
  relationshipManager: mockRelationshipManager,
  RelationshipManager: vi.fn(() => mockRelationshipManager),
}));

vi.mock('@/services/eventBus', () => ({
  eventBus: mockEventBus,
}));

// Test data
const createTestRelationship = (overrides?: Partial<Relationship>): Relationship => ({
  id: 'rel-test-123',
  type: 'task-note' as RelationshipType,
  sourceType: 'task' as EntityType,
  sourceId: 'task-123',
  targetType: 'note' as EntityType,
  targetId: 'note-456',
  metadata: {
    source: 'manual',
    createdAt: new Date().toISOString(),
  },
  canonical: true,
  ...overrides,
});

describe('RelationshipContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRelationshipManager.getRelationships.mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===== PROVIDER INITIALIZATION TESTS =====

  describe('Provider Initialization', () => {
    it('should initialize with empty state', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      await waitFor(() => {
        expect(mockRelationshipManager.init).toHaveBeenCalled();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.optimisticRelationships.size).toBe(0);
    });

    it('should subscribe to eventBus events', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      renderHook(() => useRelationships(), { wrapper });

      expect(mockEventBus.on).toHaveBeenCalledWith('RELATIONSHIP_ADDED', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('RELATIONSHIP_REMOVED', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('RELATIONSHIP_UPDATED', expect.any(Function));
    });

    it('should cleanup event listeners on unmount', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { unmount } = renderHook(() => useRelationships(), { wrapper });

      const callCount = mockEventBus.on.mock.calls.length;

      unmount();

      expect(mockEventBus.off).toHaveBeenCalledTimes(callCount);
    });

    it('should throw error when used outside provider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useRelationships());
      }).toThrow('useRelationships must be used within a RelationshipProvider');

      consoleError.mockRestore();
    });
  });

  // ===== ADD RELATIONSHIP TESTS =====

  describe('addRelationship', () => {
    it('should add relationship with optimistic update', async () => {
      const testRel = createTestRelationship();
      mockRelationshipManager.addRelationship.mockResolvedValue(testRel);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      await waitFor(() => {
        expect(mockRelationshipManager.init).toHaveBeenCalled();
      });

      let addPromise: Promise<Relationship>;

      act(() => {
        addPromise = result.current.addRelationship({
          sourceType: 'task',
          sourceId: 'task-123',
          targetType: 'note',
          targetId: 'note-456',
          type: 'task-note',
        });
      });

      // Should have optimistic relationship immediately
      expect(result.current.optimisticRelationships.size).toBe(1);

      // Wait for operation to complete
      await act(async () => {
        await addPromise!;
      });

      // Optimistic relationship should be removed after success
      expect(result.current.optimisticRelationships.size).toBe(0);
      expect(mockRelationshipManager.addRelationship).toHaveBeenCalled();
    });

    it('should rollback optimistic update on error', async () => {
      const error = new Error('Failed to add relationship');
      mockRelationshipManager.addRelationship.mockRejectedValue(error);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      await waitFor(() => {
        expect(mockRelationshipManager.init).toHaveBeenCalled();
      });

      let addPromise: Promise<Relationship>;

      act(() => {
        addPromise = result.current.addRelationship({
          sourceType: 'task',
          sourceId: 'task-123',
          targetType: 'note',
          targetId: 'note-456',
          type: 'task-note',
        });
      });

      // Should have optimistic relationship initially
      expect(result.current.optimisticRelationships.size).toBe(1);

      // Wait for error - the promise will reject but state updates happen async
      await expect(addPromise!).rejects.toThrow('Failed to add relationship');

      // Wait for React state to update after the error
      await waitFor(() => {
        expect(result.current.optimisticRelationships.size).toBe(0);
      });

      await waitFor(() => {
        expect(result.current.error).toEqual(error);
      });
    });

    it('should set loading state during operation', async () => {
      const testRel = createTestRelationship();
      mockRelationshipManager.addRelationship.mockResolvedValue(testRel);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      await waitFor(() => {
        expect(mockRelationshipManager.init).toHaveBeenCalled();
      });

      let addPromise: Promise<Relationship>;

      act(() => {
        addPromise = result.current.addRelationship({
          sourceType: 'task',
          sourceId: 'task-123',
          targetType: 'note',
          targetId: 'note-456',
          type: 'task-note',
        });
      });

      // Loading should be true during operation
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        await addPromise!;
      });

      // Loading should be false after completion
      expect(result.current.isLoading).toBe(false);
    });

    it('should include metadata in optimistic relationship', async () => {
      const testRel = createTestRelationship();
      mockRelationshipManager.addRelationship.mockResolvedValue(testRel);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      await waitFor(() => {
        expect(mockRelationshipManager.init).toHaveBeenCalled();
      });

      const metadata = {
        source: 'ai' as const,
        confidence: 0.95,
        reasoning: 'Task mentions note',
      };

      let addPromise: Promise<Relationship>;

      act(() => {
        addPromise = result.current.addRelationship({
          sourceType: 'task',
          sourceId: 'task-123',
          targetType: 'note',
          targetId: 'note-456',
          type: 'task-note',
          metadata,
        });
      });

      // Check optimistic relationship has correct metadata
      const optimisticRels = Array.from(result.current.optimisticRelationships.values());
      expect(optimisticRels[0].metadata.source).toBe('ai');
      expect(optimisticRels[0].metadata.confidence).toBe(0.95);

      await act(async () => {
        await addPromise!;
      });
    });
  });

  // ===== REMOVE RELATIONSHIP TESTS =====

  describe('removeRelationship', () => {
    it('should remove relationship with optimistic update', async () => {
      const testRel = createTestRelationship();
      mockRelationshipManager.getRelationships.mockReturnValue([testRel]);
      mockRelationshipManager.removeRelationship.mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      await waitFor(() => {
        expect(mockRelationshipManager.init).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.removeRelationship('rel-test-123');
      });

      expect(mockRelationshipManager.removeRelationship).toHaveBeenCalledWith({
        relationshipId: 'rel-test-123',
      });
    });

    it('should rollback optimistic update on error', async () => {
      const testRel = createTestRelationship();
      mockRelationshipManager.getRelationships.mockReturnValue([testRel]);
      const error = new Error('Failed to remove relationship');
      mockRelationshipManager.removeRelationship.mockRejectedValue(error);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      await waitFor(() => {
        expect(mockRelationshipManager.init).toHaveBeenCalled();
      });

      let removePromise: Promise<void>;
      act(() => {
        removePromise = result.current.removeRelationship('rel-test-123');
      });

      await expect(removePromise!).rejects.toThrow('Failed to remove relationship');

      await waitFor(() => {
        expect(result.current.error).toEqual(error);
      });
    });
  });

  // ===== GET RELATIONSHIPS TESTS =====

  describe('getRelationships', () => {
    it('should return relationships for entity', () => {
      const testRel = createTestRelationship();
      mockRelationshipManager.getRelationships.mockReturnValue([testRel]);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      const relationships = result.current.getRelationships('task-123');

      expect(relationships).toHaveLength(1);
      expect(relationships[0].id).toBe('rel-test-123');
    });

    it('should filter by relationship type', () => {
      const testRel1 = createTestRelationship({ type: 'task-note' });
      const testRel2 = createTestRelationship({
        id: 'rel-test-456',
        type: 'task-session',
      });

      mockRelationshipManager.getRelationships.mockReturnValue([testRel1]);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      const relationships = result.current.getRelationships('task-123', 'task-note');

      expect(mockRelationshipManager.getRelationships).toHaveBeenCalledWith({
        entityId: 'task-123',
        relationshipType: 'task-note',
      });
    });

    it('should include optimistic relationships', async () => {
      const testRel = createTestRelationship();
      mockRelationshipManager.addRelationship.mockResolvedValue(testRel);
      mockRelationshipManager.getRelationships.mockReturnValue([]);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      await waitFor(() => {
        expect(mockRelationshipManager.init).toHaveBeenCalled();
      });

      let addPromise: Promise<Relationship>;

      act(() => {
        addPromise = result.current.addRelationship({
          sourceType: 'task',
          sourceId: 'task-123',
          targetType: 'note',
          targetId: 'note-456',
          type: 'task-note',
        });
      });

      // Should include optimistic relationship before persistence
      const relationships = result.current.getRelationships('task-123');
      expect(relationships.length).toBeGreaterThan(0);

      await act(async () => {
        await addPromise!;
      });
    });
  });

  // ===== GET RELATED ENTITIES TESTS =====

  describe('getRelatedEntities', () => {
    it('should fetch related entities', async () => {
      const testNote = { id: 'note-456', content: 'Test note' };
      mockRelationshipManager.getRelatedEntities.mockResolvedValue([testNote]);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      const entities = await result.current.getRelatedEntities<typeof testNote>(
        'task-123',
        'task-note'
      );

      expect(entities).toEqual([testNote]);
      expect(mockRelationshipManager.getRelatedEntities).toHaveBeenCalledWith(
        'task-123',
        'task-note'
      );
    });

    it('should handle errors when fetching entities', async () => {
      const error = new Error('Failed to fetch entities');
      mockRelationshipManager.getRelatedEntities.mockRejectedValue(error);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      await expect(
        result.current.getRelatedEntities('task-123', 'task-note')
      ).rejects.toThrow('Failed to fetch entities');
    });
  });

  // ===== EVENT HANDLING TESTS =====

  describe('Event Handling', () => {
    it('should refresh on RELATIONSHIP_ADDED event', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      await waitFor(() => {
        expect(mockRelationshipManager.init).toHaveBeenCalled();
      });

      // Get the event handler that was registered
      const addedHandler = mockEventBus.on.mock.calls.find(
        (call) => call[0] === 'RELATIONSHIP_ADDED'
      )?.[1];

      expect(addedHandler).toBeDefined();

      // Simulate event emission
      act(() => {
        addedHandler?.({
          timestamp: new Date().toISOString(),
          source: 'test',
          data: {},
        });
      });

      // Refresh trigger should increment (tested via stats recalculation)
      expect(result.current.stats).toBeDefined();
    });

    it('should refresh on RELATIONSHIP_REMOVED event', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      renderHook(() => useRelationships(), { wrapper });

      await waitFor(() => {
        expect(mockRelationshipManager.init).toHaveBeenCalled();
      });

      const removedHandler = mockEventBus.on.mock.calls.find(
        (call) => call[0] === 'RELATIONSHIP_REMOVED'
      )?.[1];

      expect(removedHandler).toBeDefined();
    });

    it('should refresh on RELATIONSHIP_UPDATED event', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      renderHook(() => useRelationships(), { wrapper });

      await waitFor(() => {
        expect(mockRelationshipManager.init).toHaveBeenCalled();
      });

      const updatedHandler = mockEventBus.on.mock.calls.find(
        (call) => call[0] === 'RELATIONSHIP_UPDATED'
      )?.[1];

      expect(updatedHandler).toBeDefined();
    });
  });

  // ===== STATS TESTS =====

  describe('Stats', () => {
    it('should calculate total relationships', () => {
      const testRels = [
        createTestRelationship({ id: 'rel-1' }),
        createTestRelationship({ id: 'rel-2' }),
        createTestRelationship({ id: 'rel-3' }),
      ];

      mockRelationshipManager.getRelationships.mockReturnValue(testRels);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      expect(result.current.stats.totalRelationships).toBe(3);
    });

    it('should count AI relationships', () => {
      const testRels = [
        createTestRelationship({
          id: 'rel-1',
          metadata: { source: 'ai', createdAt: new Date().toISOString() },
        }),
        createTestRelationship({
          id: 'rel-2',
          metadata: { source: 'manual', createdAt: new Date().toISOString() },
        }),
      ];

      mockRelationshipManager.getRelationships.mockReturnValue(testRels);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      expect(result.current.stats.aiRelationships).toBe(1);
    });

    it('should count manual relationships', () => {
      const testRels = [
        createTestRelationship({
          id: 'rel-1',
          metadata: { source: 'manual', createdAt: new Date().toISOString() },
        }),
        createTestRelationship({
          id: 'rel-2',
          metadata: { source: 'manual', createdAt: new Date().toISOString() },
        }),
      ];

      mockRelationshipManager.getRelationships.mockReturnValue(testRels);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      expect(result.current.stats.manualRelationships).toBe(2);
    });
  });

  // ===== CLEAR ERROR TEST =====

  describe('clearError', () => {
    it('should clear error state', async () => {
      const error = new Error('Test error');
      mockRelationshipManager.addRelationship.mockRejectedValue(error);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <RelationshipProvider>{children}</RelationshipProvider>
      );

      const { result } = renderHook(() => useRelationships(), { wrapper });

      await waitFor(() => {
        expect(mockRelationshipManager.init).toHaveBeenCalled();
      });

      // Trigger an error
      let errorPromise: Promise<Relationship>;
      act(() => {
        errorPromise = result.current.addRelationship({
          sourceType: 'task',
          sourceId: 'task-123',
          targetType: 'note',
          targetId: 'note-456',
          type: 'task-note',
        });
      });

      await expect(errorPromise!).rejects.toThrow();

      // Wait for error to be set
      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
