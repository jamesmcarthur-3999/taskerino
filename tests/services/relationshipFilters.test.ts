/**
 * Tests for Relationship Filters
 *
 * Tests cover:
 * - Confidence filtering
 * - Source filtering
 * - Date range filtering
 * - Entity filtering
 * - Canonical filtering
 * - Sorting functions
 * - Filter composition
 * - Statistics generation
 * - Grouping functions
 *
 * Target: >85% coverage
 */

import { describe, it, expect } from 'vitest';
import {
  filterByConfidence,
  filterBySource,
  filterByDateRange,
  filterByEntity,
  filterCanonical,
  filterNonCanonical,
  sortByConfidence,
  sortByDate,
  sortByDateAsc,
  combineFilters,
  getRelationshipStats,
  groupBySource,
  groupByEntityType,
} from '@/services/relationshipFilters';
import type { Relationship } from '@/types/relationships';
import { RelationshipType, EntityType } from '@/types/relationships';

// Helper to create test relationships
const createRelationship = (overrides: Partial<Relationship> = {}): Relationship => ({
  id: `rel-${Math.random()}`,
  type: RelationshipType.TASK_NOTE,
  sourceType: EntityType.TASK,
  sourceId: 'task-1',
  targetType: EntityType.NOTE,
  targetId: 'note-1',
  metadata: {
    source: 'manual',
    createdAt: new Date().toISOString(),
  },
  canonical: true,
  ...overrides,
});

describe('Relationship Filters', () => {
  describe('filterByConfidence', () => {
    it('should include AI relationships above threshold', () => {
      const relationships = [
        createRelationship({
          id: 'rel-1',
          metadata: { source: 'ai', confidence: 0.9, createdAt: new Date().toISOString() },
        }),
        createRelationship({
          id: 'rel-2',
          metadata: { source: 'ai', confidence: 0.7, createdAt: new Date().toISOString() },
        }),
        createRelationship({
          id: 'rel-3',
          metadata: { source: 'ai', confidence: 0.5, createdAt: new Date().toISOString() },
        }),
      ];

      const filtered = filterByConfidence(relationships, 0.7);

      expect(filtered.length).toBe(2);
      expect(filtered.find(r => r.id === 'rel-1')).toBeDefined();
      expect(filtered.find(r => r.id === 'rel-2')).toBeDefined();
      expect(filtered.find(r => r.id === 'rel-3')).toBeUndefined();
    });

    it('should always include non-AI relationships', () => {
      const relationships = [
        createRelationship({
          id: 'rel-1',
          metadata: { source: 'manual', createdAt: new Date().toISOString() },
        }),
        createRelationship({
          id: 'rel-2',
          metadata: { source: 'migration', createdAt: new Date().toISOString() },
        }),
        createRelationship({
          id: 'rel-3',
          metadata: { source: 'system', createdAt: new Date().toISOString() },
        }),
      ];

      const filtered = filterByConfidence(relationships, 0.9);

      expect(filtered.length).toBe(3);
    });

    it('should handle AI relationships without confidence', () => {
      const relationships = [
        createRelationship({
          id: 'rel-1',
          metadata: { source: 'ai', createdAt: new Date().toISOString() },
          // No confidence field
        }),
      ];

      const filtered = filterByConfidence(relationships, 0.5);

      // Should be excluded (confidence defaults to 0)
      expect(filtered.length).toBe(0);
    });

    it('should throw error for invalid confidence values', () => {
      const relationships = [createRelationship()];

      expect(() => filterByConfidence(relationships, -0.1)).toThrow();
      expect(() => filterByConfidence(relationships, 1.1)).toThrow();
    });
  });

  describe('filterBySource', () => {
    it('should filter by AI source', () => {
      const relationships = [
        createRelationship({ id: 'rel-1', metadata: { source: 'ai', createdAt: new Date().toISOString() } }),
        createRelationship({ id: 'rel-2', metadata: { source: 'manual', createdAt: new Date().toISOString() } }),
        createRelationship({ id: 'rel-3', metadata: { source: 'ai', createdAt: new Date().toISOString() } }),
      ];

      const filtered = filterBySource(relationships, 'ai');

      expect(filtered.length).toBe(2);
      expect(filtered.every(r => r.metadata.source === 'ai')).toBe(true);
    });

    it('should filter by manual source', () => {
      const relationships = [
        createRelationship({ id: 'rel-1', metadata: { source: 'manual', createdAt: new Date().toISOString() } }),
        createRelationship({ id: 'rel-2', metadata: { source: 'ai', createdAt: new Date().toISOString() } }),
      ];

      const filtered = filterBySource(relationships, 'manual');

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('rel-1');
    });

    it('should filter by migration source', () => {
      const relationships = [
        createRelationship({ id: 'rel-1', metadata: { source: 'migration', createdAt: new Date().toISOString() } }),
        createRelationship({ id: 'rel-2', metadata: { source: 'manual', createdAt: new Date().toISOString() } }),
      ];

      const filtered = filterBySource(relationships, 'migration');

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('rel-1');
    });

    it('should filter by system source', () => {
      const relationships = [
        createRelationship({ id: 'rel-1', metadata: { source: 'system', createdAt: new Date().toISOString() } }),
        createRelationship({ id: 'rel-2', metadata: { source: 'manual', createdAt: new Date().toISOString() } }),
      ];

      const filtered = filterBySource(relationships, 'system');

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('rel-1');
    });
  });

  describe('filterByDateRange', () => {
    it('should filter by date range (Date objects)', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const relationships = [
        createRelationship({ id: 'rel-1', metadata: { source: 'manual', createdAt: weekAgo.toISOString() } }),
        createRelationship({ id: 'rel-2', metadata: { source: 'manual', createdAt: yesterday.toISOString() } }),
        createRelationship({ id: 'rel-3', metadata: { source: 'manual', createdAt: now.toISOString() } }),
        createRelationship({ id: 'rel-4', metadata: { source: 'manual', createdAt: tomorrow.toISOString() } }),
      ];

      const filtered = filterByDateRange(relationships, yesterday, tomorrow);

      expect(filtered.length).toBe(3); // yesterday, now, tomorrow
      expect(filtered.find(r => r.id === 'rel-1')).toBeUndefined(); // Too old
    });

    it('should filter by date range (ISO strings)', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const relationships = [
        createRelationship({ id: 'rel-1', metadata: { source: 'manual', createdAt: yesterday.toISOString() } }),
        createRelationship({ id: 'rel-2', metadata: { source: 'manual', createdAt: now.toISOString() } }),
      ];

      const filtered = filterByDateRange(
        relationships,
        yesterday.toISOString(),
        tomorrow.toISOString()
      );

      expect(filtered.length).toBe(2);
    });

    it('should be inclusive of boundaries', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-01-31T23:59:59Z');

      const relationships = [
        createRelationship({
          id: 'rel-1',
          metadata: { source: 'manual', createdAt: '2025-01-01T00:00:00Z' },
        }),
        createRelationship({
          id: 'rel-2',
          metadata: { source: 'manual', createdAt: '2025-01-31T23:59:59Z' },
        }),
      ];

      const filtered = filterByDateRange(relationships, start, end);

      expect(filtered.length).toBe(2);
    });
  });

  describe('filterByEntity', () => {
    it('should filter by entity ID (source or target)', () => {
      const relationships = [
        createRelationship({ id: 'rel-1', sourceId: 'task-1', targetId: 'note-1' }),
        createRelationship({ id: 'rel-2', sourceId: 'task-2', targetId: 'note-1' }),
        createRelationship({ id: 'rel-3', sourceId: 'task-3', targetId: 'note-2' }),
      ];

      const filtered = filterByEntity(relationships, 'note-1');

      expect(filtered.length).toBe(2);
      expect(filtered.find(r => r.id === 'rel-1')).toBeDefined();
      expect(filtered.find(r => r.id === 'rel-2')).toBeDefined();
    });

    it('should filter by entity ID and type', () => {
      const relationships = [
        createRelationship({
          id: 'rel-1',
          sourceType: EntityType.TASK,
          sourceId: 'task-1',
          targetType: EntityType.NOTE,
          targetId: 'note-1',
        }),
        createRelationship({
          id: 'rel-2',
          sourceType: EntityType.NOTE,
          sourceId: 'note-1',
          targetType: EntityType.TASK,
          targetId: 'task-1',
        }),
      ];

      const filtered = filterByEntity(relationships, 'task-1', EntityType.TASK);

      // Both relationships have task-1 as entity with type TASK
      // rel-1: task-1 is source with type TASK ✓
      // rel-2: task-1 is target with type TASK ✓
      expect(filtered.length).toBe(2);
      expect(filtered.find(r => r.id === 'rel-1')).toBeDefined();
      expect(filtered.find(r => r.id === 'rel-2')).toBeDefined();
    });

    it('should return empty array for non-matching entity', () => {
      const relationships = [
        createRelationship({ id: 'rel-1', sourceId: 'task-1', targetId: 'note-1' }),
      ];

      const filtered = filterByEntity(relationships, 'task-999');

      expect(filtered.length).toBe(0);
    });
  });

  describe('filterCanonical', () => {
    it('should filter to only canonical relationships', () => {
      const relationships = [
        createRelationship({ id: 'rel-1', canonical: true }),
        createRelationship({ id: 'rel-2', canonical: false }),
        createRelationship({ id: 'rel-3', canonical: true }),
      ];

      const filtered = filterCanonical(relationships);

      expect(filtered.length).toBe(2);
      expect(filtered.every(r => r.canonical)).toBe(true);
    });
  });

  describe('filterNonCanonical', () => {
    it('should filter to only non-canonical relationships', () => {
      const relationships = [
        createRelationship({ id: 'rel-1', canonical: true }),
        createRelationship({ id: 'rel-2', canonical: false }),
        createRelationship({ id: 'rel-3', canonical: false }),
      ];

      const filtered = filterNonCanonical(relationships);

      expect(filtered.length).toBe(2);
      expect(filtered.every(r => !r.canonical)).toBe(true);
    });
  });

  describe('sortByConfidence', () => {
    it('should sort by confidence descending', () => {
      const relationships = [
        createRelationship({
          id: 'rel-1',
          metadata: { source: 'ai', confidence: 0.5, createdAt: new Date().toISOString() },
        }),
        createRelationship({
          id: 'rel-2',
          metadata: { source: 'ai', confidence: 0.9, createdAt: new Date().toISOString() },
        }),
        createRelationship({
          id: 'rel-3',
          metadata: { source: 'ai', confidence: 0.7, createdAt: new Date().toISOString() },
        }),
      ];

      const sorted = sortByConfidence([...relationships]);

      expect(sorted[0].id).toBe('rel-2'); // 0.9
      expect(sorted[1].id).toBe('rel-3'); // 0.7
      expect(sorted[2].id).toBe('rel-1'); // 0.5
    });

    it('should sort non-AI relationships to the end', () => {
      const relationships = [
        createRelationship({
          id: 'rel-1',
          metadata: { source: 'ai', confidence: 0.8, createdAt: new Date().toISOString() },
        }),
        createRelationship({
          id: 'rel-2',
          metadata: { source: 'manual', createdAt: new Date().toISOString() },
        }),
      ];

      const sorted = sortByConfidence([...relationships]);

      expect(sorted[0].id).toBe('rel-1'); // AI with confidence
      expect(sorted[1].id).toBe('rel-2'); // Manual (no confidence)
    });
  });

  describe('sortByDate', () => {
    it('should sort by date descending (newest first)', () => {
      const relationships = [
        createRelationship({
          id: 'rel-1',
          metadata: { source: 'manual', createdAt: '2025-01-01T00:00:00Z' },
        }),
        createRelationship({
          id: 'rel-2',
          metadata: { source: 'manual', createdAt: '2025-01-03T00:00:00Z' },
        }),
        createRelationship({
          id: 'rel-3',
          metadata: { source: 'manual', createdAt: '2025-01-02T00:00:00Z' },
        }),
      ];

      const sorted = sortByDate([...relationships]);

      expect(sorted[0].id).toBe('rel-2'); // Jan 3 (newest)
      expect(sorted[1].id).toBe('rel-3'); // Jan 2
      expect(sorted[2].id).toBe('rel-1'); // Jan 1 (oldest)
    });
  });

  describe('sortByDateAsc', () => {
    it('should sort by date ascending (oldest first)', () => {
      const relationships = [
        createRelationship({
          id: 'rel-1',
          metadata: { source: 'manual', createdAt: '2025-01-03T00:00:00Z' },
        }),
        createRelationship({
          id: 'rel-2',
          metadata: { source: 'manual', createdAt: '2025-01-01T00:00:00Z' },
        }),
        createRelationship({
          id: 'rel-3',
          metadata: { source: 'manual', createdAt: '2025-01-02T00:00:00Z' },
        }),
      ];

      const sorted = sortByDateAsc([...relationships]);

      expect(sorted[0].id).toBe('rel-2'); // Jan 1 (oldest)
      expect(sorted[1].id).toBe('rel-3'); // Jan 2
      expect(sorted[2].id).toBe('rel-1'); // Jan 3 (newest)
    });
  });

  describe('combineFilters', () => {
    it('should apply multiple filters in sequence', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const relationships = [
        createRelationship({
          id: 'rel-1',
          metadata: {
            source: 'ai',
            confidence: 0.9,
            createdAt: now.toISOString(),
          },
        }),
        createRelationship({
          id: 'rel-2',
          metadata: {
            source: 'ai',
            confidence: 0.6,
            createdAt: now.toISOString(),
          },
        }),
        createRelationship({
          id: 'rel-3',
          metadata: {
            source: 'manual',
            createdAt: now.toISOString(),
          },
        }),
        createRelationship({
          id: 'rel-4',
          metadata: {
            source: 'ai',
            confidence: 0.9,
            createdAt: yesterday.toISOString(),
          },
        }),
      ];

      const filtered = combineFilters(relationships, [
        (rels) => filterBySource(rels, 'ai'),
        (rels) => filterByConfidence(rels, 0.8),
        (rels) => filterByDateRange(rels, yesterday, tomorrow),
      ]);

      // Should be AI, confidence >= 0.8, within date range
      expect(filtered.length).toBe(2);
      expect(filtered.find(r => r.id === 'rel-1')).toBeDefined();
      expect(filtered.find(r => r.id === 'rel-4')).toBeDefined();
    });

    it('should handle empty filter array', () => {
      const relationships = [createRelationship()];

      const filtered = combineFilters(relationships, []);

      expect(filtered).toEqual(relationships);
    });
  });

  describe('getRelationshipStats', () => {
    it('should calculate correct statistics', () => {
      const relationships = [
        createRelationship({
          metadata: {
            source: 'ai',
            confidence: 0.9,
            createdAt: new Date().toISOString(),
          },
          canonical: true,
        }),
        createRelationship({
          metadata: {
            source: 'ai',
            confidence: 0.7,
            createdAt: new Date().toISOString(),
          },
          canonical: false,
        }),
        createRelationship({
          metadata: {
            source: 'manual',
            createdAt: new Date().toISOString(),
          },
          canonical: true,
        }),
        createRelationship({
          metadata: {
            source: 'migration',
            createdAt: new Date().toISOString(),
          },
          canonical: true,
        }),
        createRelationship({
          metadata: {
            source: 'system',
            createdAt: new Date().toISOString(),
          },
          canonical: true,
        }),
      ];

      const stats = getRelationshipStats(relationships);

      expect(stats.total).toBe(5);
      expect(stats.aiCount).toBe(2);
      expect(stats.manualCount).toBe(1);
      expect(stats.migrationCount).toBe(1);
      expect(stats.systemCount).toBe(1);
      expect(stats.canonicalCount).toBe(4);
      expect(stats.avgConfidence).toBeCloseTo(0.8, 1); // (0.9 + 0.7) / 2
      expect(stats.minConfidence).toBe(0.7);
      expect(stats.maxConfidence).toBe(0.9);
    });

    it('should handle empty array', () => {
      const stats = getRelationshipStats([]);

      expect(stats.total).toBe(0);
      expect(stats.aiCount).toBe(0);
      expect(stats.avgConfidence).toBe(0);
    });

    it('should handle relationships without confidence', () => {
      const relationships = [
        createRelationship({
          metadata: {
            source: 'manual',
            createdAt: new Date().toISOString(),
          },
        }),
      ];

      const stats = getRelationshipStats(relationships);

      expect(stats.avgConfidence).toBe(0);
      expect(stats.minConfidence).toBe(0);
      expect(stats.maxConfidence).toBe(0);
    });
  });

  describe('groupBySource', () => {
    it('should group relationships by source', () => {
      const relationships = [
        createRelationship({ id: 'rel-1', metadata: { source: 'ai', createdAt: new Date().toISOString() } }),
        createRelationship({ id: 'rel-2', metadata: { source: 'ai', createdAt: new Date().toISOString() } }),
        createRelationship({ id: 'rel-3', metadata: { source: 'manual', createdAt: new Date().toISOString() } }),
        createRelationship({ id: 'rel-4', metadata: { source: 'migration', createdAt: new Date().toISOString() } }),
      ];

      const grouped = groupBySource(relationships);

      expect(grouped.size).toBe(3);
      expect(grouped.get('ai')?.length).toBe(2);
      expect(grouped.get('manual')?.length).toBe(1);
      expect(grouped.get('migration')?.length).toBe(1);
    });

    it('should handle empty array', () => {
      const grouped = groupBySource([]);

      expect(grouped.size).toBe(0);
    });
  });

  describe('groupByEntityType', () => {
    it('should group relationships by entity type', () => {
      const relationships = [
        createRelationship({
          id: 'rel-1',
          sourceType: EntityType.TASK,
          targetType: EntityType.NOTE,
        }),
        createRelationship({
          id: 'rel-2',
          sourceType: EntityType.TASK,
          targetType: EntityType.SESSION,
        }),
        createRelationship({
          id: 'rel-3',
          sourceType: EntityType.NOTE,
          targetType: EntityType.COMPANY,
        }),
      ];

      const grouped = groupByEntityType(relationships);

      expect(grouped.get(EntityType.TASK)?.length).toBe(2);
      expect(grouped.get(EntityType.NOTE)?.length).toBe(2); // rel-1 and rel-3
      expect(grouped.get(EntityType.SESSION)?.length).toBe(1);
      expect(grouped.get(EntityType.COMPANY)?.length).toBe(1);
    });

    it('should handle relationships with same source and target type', () => {
      const relationships = [
        createRelationship({
          id: 'rel-1',
          sourceType: EntityType.NOTE,
          targetType: EntityType.NOTE,
        }),
      ];

      const grouped = groupByEntityType(relationships);

      // Should only add once (not duplicate)
      expect(grouped.get(EntityType.NOTE)?.length).toBe(1);
    });

    it('should handle empty array', () => {
      const grouped = groupByEntityType([]);

      expect(grouped.size).toBe(0);
    });
  });
});
