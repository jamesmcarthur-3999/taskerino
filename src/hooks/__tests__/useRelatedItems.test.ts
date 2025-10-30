/**
 * useRelatedItems Tests
 *
 * Comprehensive test suite for useRelatedItems hook.
 * Tests fetching, refreshing, error handling, and enable/disable functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRelatedItems } from '../useRelatedItems';
import type { Relationship } from '@/types/relationships';

// Mock the relationships context
const mockGetRelatedEntities = vi.fn();
const mockGetRelationships = vi.fn();

vi.mock('@/context/RelationshipContext', () => ({
  useRelationships: () => ({
    getRelatedEntities: mockGetRelatedEntities,
    getRelationships: mockGetRelationships,
  }),
}));

// Test data
interface TestNote {
  id: string;
  content: string;
}

const testNotes: TestNote[] = [
  { id: 'note-1', content: 'First note' },
  { id: 'note-2', content: 'Second note' },
];

const createTestRelationship = (id: string): Relationship => ({
  id,
  type: 'task-note',
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note',
  targetId: id.replace('rel-', 'note-'),
  metadata: {
    source: 'manual',
    createdAt: new Date().toISOString(),
  },
  canonical: true,
});

describe('useRelatedItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRelatedEntities.mockResolvedValue(testNotes);
    mockGetRelationships.mockReturnValue([
      createTestRelationship('rel-note-1'),
      createTestRelationship('rel-note-2'),
    ]);
  });

  // ===== BASIC FUNCTIONALITY TESTS =====

  describe('Basic Functionality', () => {
    it('should fetch items on mount', async () => {
      const { result } = renderHook(() =>
        useRelatedItems<TestNote>('task-123', 'task-note')
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.items).toEqual(testNotes);
      expect(result.current.error).toBeNull();
      expect(mockGetRelatedEntities).toHaveBeenCalledWith('task-123', 'task-note');
    });

    it('should not fetch when autoLoad is false', async () => {
      const { result } = renderHook(() =>
        useRelatedItems<TestNote>('task-123', 'task-note', { autoLoad: false })
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(result.current.isLoading).toBe(false);
      expect(mockGetRelatedEntities).not.toHaveBeenCalled();
    });

    it('should fetch items without relationship type filter', async () => {
      const { result } = renderHook(() => useRelatedItems<TestNote>('task-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetRelatedEntities).toHaveBeenCalledWith('task-123', undefined);
    });
  });

  // ===== LOADING STATE TESTS =====

  describe('Loading State', () => {
    it('should set isLoading during initial fetch', async () => {
      const { result } = renderHook(() => useRelatedItems<TestNote>('task-123'));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should set isRefetching during manual refetch', async () => {
      const { result } = renderHook(() => useRelatedItems<TestNote>('task-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.refetch();
      });

      expect(result.current.isRefetching).toBe(true);

      await waitFor(() => {
        expect(result.current.isRefetching).toBe(false);
      });
    });

    it('should not set isLoading for refetch', async () => {
      const { result } = renderHook(() => useRelatedItems<TestNote>('task-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.refetch();
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ===== ERROR HANDLING TESTS =====

  describe('Error Handling', () => {
    it('should handle fetch errors', async () => {
      const error = new Error('Failed to fetch entities');
      mockGetRelatedEntities.mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useRelatedItems<TestNote>('task-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toEqual(error);
      expect(result.current.items).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should clear error on successful refetch', async () => {
      const error = new Error('Failed to fetch');
      mockGetRelatedEntities.mockRejectedValueOnce(error).mockResolvedValueOnce(testNotes);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useRelatedItems<TestNote>('task-123'));

      await waitFor(() => {
        expect(result.current.error).toEqual(error);
      });

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.items).toEqual(testNotes);
      });

      consoleSpy.mockRestore();
    });

    it('should convert non-Error exceptions to Error objects', async () => {
      mockGetRelatedEntities.mockRejectedValue('String error');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useRelatedItems<TestNote>('task-123'));

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe('Failed to load related items');
      });

      consoleSpy.mockRestore();
    });
  });

  // ===== REFETCH TESTS =====

  describe('Refetch', () => {
    it('should refetch items on manual refetch', async () => {
      const { result } = renderHook(() => useRelatedItems<TestNote>('task-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockGetRelatedEntities.mock.calls.length;

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockGetRelatedEntities.mock.calls.length).toBe(initialCallCount + 1);
    });

    it('should refetch when relationships change', async () => {
      const { result, rerender } = renderHook(() =>
        useRelatedItems<TestNote>('task-123', 'task-note')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockGetRelatedEntities.mock.calls.length;

      // Change relationships
      mockGetRelationships.mockReturnValue([
        createTestRelationship('rel-note-1'),
        createTestRelationship('rel-note-2'),
        createTestRelationship('rel-note-3'), // New relationship
      ]);

      rerender();

      await waitFor(() => {
        expect(mockGetRelatedEntities.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('should return updated items after refetch', async () => {
      const updatedNotes: TestNote[] = [
        { id: 'note-1', content: 'Updated first note' },
        { id: 'note-2', content: 'Updated second note' },
        { id: 'note-3', content: 'New note' },
      ];

      mockGetRelatedEntities.mockResolvedValueOnce(testNotes).mockResolvedValueOnce(updatedNotes);

      const { result } = renderHook(() => useRelatedItems<TestNote>('task-123'));

      await waitFor(() => {
        expect(result.current.items).toEqual(testNotes);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.items).toEqual(updatedNotes);
    });
  });

  // ===== PERIODIC REFETCH TESTS =====

  describe('Periodic Refetch', () => {
    it('should refetch at specified interval', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useRelatedItems<TestNote>('task-123', 'task-note', { refetchInterval: 1000 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockGetRelatedEntities.mock.calls.length;

      // Advance time by 1 second and wait for the async call
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockGetRelatedEntities.mock.calls.length).toBeGreaterThanOrEqual(initialCallCount + 1);
      });

      vi.useRealTimers();
    });

    it('should cleanup interval on unmount', async () => {
      vi.useFakeTimers();

      const { unmount } = renderHook(() =>
        useRelatedItems<TestNote>('task-123', 'task-note', { refetchInterval: 1000 })
      );

      await waitFor(() => {
        expect(mockGetRelatedEntities).toHaveBeenCalled();
      });

      const callCountBeforeUnmount = mockGetRelatedEntities.mock.calls.length;

      unmount();

      // Advance time after unmount
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should not call getRelatedEntities after unmount
      expect(mockGetRelatedEntities.mock.calls.length).toBe(callCountBeforeUnmount);

      vi.useRealTimers();
    });

    it('should not setup interval when refetchInterval is 0', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useRelatedItems<TestNote>('task-123', 'task-note', { refetchInterval: 0 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockGetRelatedEntities.mock.calls.length;

      // Advance time
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Should not trigger additional fetches
      expect(mockGetRelatedEntities.mock.calls.length).toBe(initialCallCount);

      vi.useRealTimers();
    });
  });

  // ===== DEPENDENCY CHANGE TESTS =====

  describe('Dependency Changes', () => {
    it('should refetch when entityId changes', async () => {
      const { result, rerender } = renderHook(
        ({ entityId }) => useRelatedItems<TestNote>(entityId, 'task-note'),
        {
          initialProps: { entityId: 'task-123' },
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockGetRelatedEntities.mock.calls.length;

      // Change entityId
      rerender({ entityId: 'task-456' });

      await waitFor(() => {
        expect(mockGetRelatedEntities.mock.calls.length).toBeGreaterThan(initialCallCount);
        expect(mockGetRelatedEntities).toHaveBeenCalledWith('task-456', 'task-note');
      });
    });

    it('should refetch when relationshipType changes', async () => {
      const { result, rerender } = renderHook(
        ({ type }) => useRelatedItems<TestNote>('task-123', type),
        {
          initialProps: { type: 'task-note' as const },
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockGetRelatedEntities.mock.calls.length;

      // Change relationship type
      rerender({ type: 'task-session' as const });

      await waitFor(() => {
        expect(mockGetRelatedEntities.mock.calls.length).toBeGreaterThan(initialCallCount);
        expect(mockGetRelatedEntities).toHaveBeenCalledWith('task-123', 'task-session');
      });
    });
  });

  // ===== EDGE CASES =====

  describe('Edge Cases', () => {
    it('should handle empty results', async () => {
      mockGetRelatedEntities.mockResolvedValue([]);

      const { result } = renderHook(() => useRelatedItems<TestNote>('task-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.items).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle multiple concurrent refetches gracefully', async () => {
      const { result } = renderHook(() => useRelatedItems<TestNote>('task-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Trigger multiple refetches concurrently
      await act(async () => {
        await Promise.all([
          result.current.refetch(),
          result.current.refetch(),
          result.current.refetch(),
        ]);
      });

      expect(result.current.items).toEqual(testNotes);
      expect(result.current.error).toBeNull();
    });
  });
});
