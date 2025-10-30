/**
 * useRelationshipActions Tests
 *
 * Comprehensive test suite for useRelationshipActions hook.
 * Tests linkTo, unlink, unlinkFrom, isLinkedTo, and getLinks functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRelationshipActions } from '../useRelationshipActions';
import type { Relationship } from '@/types/relationships';

// Mock the relationships context
const mockAddRelationship = vi.fn();
const mockRemoveRelationship = vi.fn();
const mockGetRelationships = vi.fn();

vi.mock('@/context/RelationshipContext', () => ({
  useRelationships: () => ({
    addRelationship: mockAddRelationship,
    removeRelationship: mockRemoveRelationship,
    getRelationships: mockGetRelationships,
  }),
}));

// Test data
const createTestRelationship = (overrides?: Partial<Relationship>): Relationship => ({
  id: 'rel-test-123',
  type: 'task-note',
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note',
  targetId: 'note-456',
  metadata: {
    source: 'manual',
    createdAt: new Date().toISOString(),
  },
  canonical: true,
  ...overrides,
});

describe('useRelationshipActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddRelationship.mockResolvedValue(createTestRelationship());
    mockRemoveRelationship.mockResolvedValue(undefined);
    mockGetRelationships.mockReturnValue([]);
  });

  // ===== LINK TO TESTS =====

  describe('linkTo', () => {
    it('should create relationship with correct parameters', async () => {
      const testRel = createTestRelationship();
      mockAddRelationship.mockResolvedValue(testRel);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      let relationship: Relationship;

      await act(async () => {
        relationship = await result.current.linkTo('note-456', 'note', 'task-note');
      });

      expect(mockAddRelationship).toHaveBeenCalledWith({
        sourceType: 'task',
        sourceId: 'task-123',
        targetType: 'note',
        targetId: 'note-456',
        type: 'task-note',
        metadata: undefined,
      });

      expect(relationship!).toEqual(testRel);
    });

    it('should pass metadata to addRelationship', async () => {
      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      const metadata = {
        source: 'ai' as const,
        confidence: 0.95,
        reasoning: 'Task mentions note',
      };

      await act(async () => {
        await result.current.linkTo('note-456', 'note', 'task-note', metadata);
      });

      expect(mockAddRelationship).toHaveBeenCalledWith({
        sourceType: 'task',
        sourceId: 'task-123',
        targetType: 'note',
        targetId: 'note-456',
        type: 'task-note',
        metadata,
      });
    });

    it('should handle errors from addRelationship', async () => {
      const error = new Error('Failed to add relationship');
      mockAddRelationship.mockRejectedValue(error);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      await expect(
        act(async () => {
          await result.current.linkTo('note-456', 'note', 'task-note');
        })
      ).rejects.toThrow('Failed to add relationship');
    });

    it('should work with different entity types', async () => {
      const { result } = renderHook(() => useRelationshipActions('note-123', 'note'));

      await act(async () => {
        await result.current.linkTo('session-456', 'session', 'note-session');
      });

      expect(mockAddRelationship).toHaveBeenCalledWith({
        sourceType: 'note',
        sourceId: 'note-123',
        targetType: 'session',
        targetId: 'session-456',
        type: 'note-session',
        metadata: undefined,
      });
    });
  });

  // ===== UNLINK TESTS =====

  describe('unlink', () => {
    it('should remove relationship by ID', async () => {
      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      await act(async () => {
        await result.current.unlink('rel-test-123');
      });

      expect(mockRemoveRelationship).toHaveBeenCalledWith('rel-test-123');
    });

    it('should handle errors from removeRelationship', async () => {
      const error = new Error('Failed to remove relationship');
      mockRemoveRelationship.mockRejectedValue(error);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      await expect(
        act(async () => {
          await result.current.unlink('rel-test-123');
        })
      ).rejects.toThrow('Failed to remove relationship');
    });
  });

  // ===== UNLINK FROM TESTS =====

  describe('unlinkFrom', () => {
    it('should find and remove relationship', async () => {
      const testRel = createTestRelationship();
      mockGetRelationships.mockReturnValue([testRel]);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      let removed: boolean;

      await act(async () => {
        removed = await result.current.unlinkFrom('note-456', 'note', 'task-note');
      });

      expect(mockGetRelationships).toHaveBeenCalledWith('task-123', 'task-note');
      expect(mockRemoveRelationship).toHaveBeenCalledWith('rel-test-123');
      expect(removed!).toBe(true);
    });

    it('should return false if relationship not found', async () => {
      mockGetRelationships.mockReturnValue([]);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      let removed: boolean;

      await act(async () => {
        removed = await result.current.unlinkFrom('note-456', 'note', 'task-note');
      });

      expect(mockRemoveRelationship).not.toHaveBeenCalled();
      expect(removed!).toBe(false);
    });

    it('should handle bidirectional relationships (source→target)', async () => {
      const testRel = createTestRelationship({
        sourceType: 'task',
        sourceId: 'task-123',
        targetType: 'note',
        targetId: 'note-456',
      });

      mockGetRelationships.mockReturnValue([testRel]);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      let removed: boolean;

      await act(async () => {
        removed = await result.current.unlinkFrom('note-456', 'note', 'task-note');
      });

      expect(removed!).toBe(true);
      expect(mockRemoveRelationship).toHaveBeenCalledWith('rel-test-123');
    });

    it('should handle bidirectional relationships (target→source)', async () => {
      const testRel = createTestRelationship({
        sourceType: 'note',
        sourceId: 'note-456',
        targetType: 'task',
        targetId: 'task-123',
      });

      mockGetRelationships.mockReturnValue([testRel]);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      let removed: boolean;

      await act(async () => {
        removed = await result.current.unlinkFrom('note-456', 'note', 'task-note');
      });

      expect(removed!).toBe(true);
      expect(mockRemoveRelationship).toHaveBeenCalledWith('rel-test-123');
    });

    it('should only match exact entity types', async () => {
      const testRel = createTestRelationship({
        sourceType: 'task',
        sourceId: 'task-123',
        targetType: 'session', // Wrong type
        targetId: 'note-456',
      });

      mockGetRelationships.mockReturnValue([testRel]);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      let removed: boolean;

      await act(async () => {
        removed = await result.current.unlinkFrom('note-456', 'note', 'task-note');
      });

      expect(removed!).toBe(false);
      expect(mockRemoveRelationship).not.toHaveBeenCalled();
    });
  });

  // ===== IS LINKED TO TESTS =====

  describe('isLinkedTo', () => {
    it('should return true when entities are linked', () => {
      const testRel = createTestRelationship();
      mockGetRelationships.mockReturnValue([testRel]);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      const isLinked = result.current.isLinkedTo('note-456');

      expect(isLinked).toBe(true);
      expect(mockGetRelationships).toHaveBeenCalledWith('task-123', undefined);
    });

    it('should return false when entities are not linked', () => {
      mockGetRelationships.mockReturnValue([]);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      const isLinked = result.current.isLinkedTo('note-456');

      expect(isLinked).toBe(false);
    });

    it('should filter by relationship type', () => {
      const testRel = createTestRelationship({ type: 'task-note' });
      mockGetRelationships.mockReturnValue([testRel]);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      const isLinked = result.current.isLinkedTo('note-456', 'task-note');

      expect(isLinked).toBe(true);
      expect(mockGetRelationships).toHaveBeenCalledWith('task-123', 'task-note');
    });

    it('should return false when linked with different relationship type', () => {
      const testRel = createTestRelationship({ type: 'task-note' });
      // Mock should return empty array when filtering by 'task-session' type
      mockGetRelationships.mockImplementation((entityId, type) => {
        if (type === 'task-session') {
          return [];
        }
        return [testRel];
      });

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      const isLinked = result.current.isLinkedTo('note-456', 'task-session');

      expect(isLinked).toBe(false);
      expect(mockGetRelationships).toHaveBeenCalledWith('task-123', 'task-session');
    });

    it('should handle bidirectional relationships (source→target)', () => {
      const testRel = createTestRelationship({
        sourceId: 'task-123',
        targetId: 'note-456',
      });

      mockGetRelationships.mockReturnValue([testRel]);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      expect(result.current.isLinkedTo('note-456')).toBe(true);
    });

    it('should handle bidirectional relationships (target→source)', () => {
      const testRel = createTestRelationship({
        sourceId: 'note-456',
        targetId: 'task-123',
      });

      mockGetRelationships.mockReturnValue([testRel]);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      expect(result.current.isLinkedTo('note-456')).toBe(true);
    });
  });

  // ===== GET LINKS TESTS =====

  describe('getLinks', () => {
    it('should return all relationships for entity', () => {
      const testRels = [
        createTestRelationship({ id: 'rel-1' }),
        createTestRelationship({ id: 'rel-2' }),
      ];

      mockGetRelationships.mockReturnValue(testRels);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      const links = result.current.getLinks();

      expect(links).toEqual(testRels);
      expect(mockGetRelationships).toHaveBeenCalledWith('task-123', undefined);
    });

    it('should filter by relationship type', () => {
      const testRels = [createTestRelationship({ type: 'task-note' })];

      mockGetRelationships.mockReturnValue(testRels);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      const links = result.current.getLinks('task-note');

      expect(links).toEqual(testRels);
      expect(mockGetRelationships).toHaveBeenCalledWith('task-123', 'task-note');
    });

    it('should return empty array when no relationships exist', () => {
      mockGetRelationships.mockReturnValue([]);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      const links = result.current.getLinks();

      expect(links).toEqual([]);
    });
  });

  // ===== MEMOIZATION TESTS =====

  describe('Memoization', () => {
    it('should memoize linkTo function', () => {
      const { result, rerender } = renderHook(() =>
        useRelationshipActions('task-123', 'task')
      );

      const linkToRef1 = result.current.linkTo;

      rerender();

      const linkToRef2 = result.current.linkTo;

      expect(linkToRef1).toBe(linkToRef2);
    });

    it('should recreate linkTo when entityId changes', () => {
      const { result, rerender } = renderHook(
        ({ entityId }) => useRelationshipActions(entityId, 'task'),
        { initialProps: { entityId: 'task-123' } }
      );

      const linkToRef1 = result.current.linkTo;

      rerender({ entityId: 'task-456' });

      const linkToRef2 = result.current.linkTo;

      expect(linkToRef1).not.toBe(linkToRef2);
    });

    it('should recreate linkTo when entityType changes', () => {
      const { result, rerender } = renderHook(
        ({ entityType }) => useRelationshipActions('entity-123', entityType),
        { initialProps: { entityType: 'task' as const } }
      );

      const linkToRef1 = result.current.linkTo;

      rerender({ entityType: 'note' as const });

      const linkToRef2 = result.current.linkTo;

      expect(linkToRef1).not.toBe(linkToRef2);
    });
  });

  // ===== EDGE CASES =====

  describe('Edge Cases', () => {
    it('should handle multiple relationships to same entity', () => {
      const testRels = [
        createTestRelationship({ id: 'rel-1', type: 'task-note' }),
        createTestRelationship({ id: 'rel-2', type: 'task-session' }),
      ];

      mockGetRelationships.mockReturnValue(testRels);

      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      expect(result.current.isLinkedTo('note-456')).toBe(true);
      expect(result.current.isLinkedTo('note-456', 'task-note')).toBe(true);
      expect(result.current.isLinkedTo('note-456', 'task-session')).toBe(true);
    });

    it('should handle empty entity ID gracefully', () => {
      const { result } = renderHook(() => useRelationshipActions('', 'task'));

      expect(result.current.isLinkedTo('note-456')).toBe(false);
      expect(result.current.getLinks()).toEqual([]);
    });

    it('should handle concurrent link operations', async () => {
      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      await act(async () => {
        await Promise.all([
          result.current.linkTo('note-1', 'note', 'task-note'),
          result.current.linkTo('note-2', 'note', 'task-note'),
          result.current.linkTo('note-3', 'note', 'task-note'),
        ]);
      });

      expect(mockAddRelationship).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent unlink operations', async () => {
      const { result } = renderHook(() => useRelationshipActions('task-123', 'task'));

      await act(async () => {
        await Promise.all([
          result.current.unlink('rel-1'),
          result.current.unlink('rel-2'),
          result.current.unlink('rel-3'),
        ]);
      });

      expect(mockRemoveRelationship).toHaveBeenCalledTimes(3);
    });
  });
});
