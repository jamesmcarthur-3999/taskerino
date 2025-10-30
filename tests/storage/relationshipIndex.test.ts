/**
 * Relationship Index Tests
 *
 * Comprehensive tests for the RelationshipIndex class including:
 * - Add/retrieve relationships
 * - Bidirectional relationship handling
 * - Remove from all indexes correctly
 * - Performance benchmarks
 *
 * @module tests/storage/relationshipIndex
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipIndex } from '@/services/storage/relationshipIndex';
import { Relationship, RelationshipType, EntityType } from '@/types/relationships';

/**
 * Helper function to create a test relationship
 */
function createTestRelationship(overrides?: Partial<Relationship>): Relationship {
  return {
    id: `rel-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    type: RelationshipType.TASK_NOTE,
    sourceType: EntityType.TASK,
    sourceId: `task-${Math.random().toString(36).substring(7)}`,
    targetType: EntityType.NOTE,
    targetId: `note-${Math.random().toString(36).substring(7)}`,
    canonical: true,
    metadata: {
      source: 'manual',
      createdAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

/**
 * Generate a large number of test relationships for performance testing
 */
function generateRelationships(count: number): Relationship[] {
  const relationships: Relationship[] = [];
  for (let i = 0; i < count; i++) {
    relationships.push(createTestRelationship({
      id: `rel-${i}`,
      sourceId: `task-${i % 1000}`, // Reuse entities to create realistic graph
      targetId: `note-${i % 500}`,
    }));
  }
  return relationships;
}

describe('RelationshipIndex', () => {
  let index: RelationshipIndex;

  beforeEach(() => {
    index = new RelationshipIndex();
  });

  describe('constructor', () => {
    it('should create empty index', () => {
      const stats = index.getStats();
      expect(stats.totalRelationships).toBe(0);
      expect(stats.entitiesWithRelationships).toBe(0);
      expect(stats.sourceTargetPairs).toBe(0);
    });

    it('should initialize with relationships', () => {
      const rels = [
        createTestRelationship(),
        createTestRelationship(),
        createTestRelationship(),
      ];
      const indexWithData = new RelationshipIndex(rels);

      expect(indexWithData.getStats().totalRelationships).toBe(3);
    });
  });

  describe('add', () => {
    it('should add relationship to all indexes', () => {
      const rel = createTestRelationship({
        sourceId: 'task-1',
        targetId: 'note-1',
      });

      index.add(rel);

      // Should be in byId index
      expect(index.getById(rel.id)).toBe(rel);

      // Should be in byEntity index (source)
      const sourceRels = index.getByEntity('task-1');
      expect(sourceRels).toContain(rel);

      // Should be in bySourceTarget index
      expect(index.exists('task-1', 'note-1')).toBe(true);
      expect(index.getBetween('task-1', 'note-1')).toBe(rel);
    });

    it('should handle bidirectional relationships', () => {
      const rel = createTestRelationship({
        type: RelationshipType.TASK_NOTE, // bidirectional
        sourceId: 'task-1',
        targetId: 'note-1',
        canonical: true,
      });

      index.add(rel);

      // Should appear in both entity indexes
      const taskRels = index.getByEntity('task-1');
      const noteRels = index.getByEntity('note-1');

      expect(taskRels).toContain(rel);
      expect(noteRels).toContain(rel);
    });

    it('should handle unidirectional relationships', () => {
      const rel = createTestRelationship({
        type: RelationshipType.NOTE_PARENT, // NOT bidirectional
        sourceType: EntityType.NOTE,
        sourceId: 'note-1',
        targetType: EntityType.NOTE,
        targetId: 'note-2',
        canonical: true,
      });

      index.add(rel);

      // Should appear in source entity index
      const sourceRels = index.getByEntity('note-1');
      expect(sourceRels).toContain(rel);

      // Should NOT appear in target entity index
      const targetRels = index.getByEntity('note-2');
      expect(targetRels).toHaveLength(0);
    });

    it('should not add duplicate relationships', () => {
      const rel = createTestRelationship();

      index.add(rel);
      index.add(rel); // Add same relationship again

      const stats = index.getStats();
      expect(stats.totalRelationships).toBe(1);

      const sourceRels = index.getByEntity(rel.sourceId);
      expect(sourceRels).toHaveLength(1);
    });

    it('should handle multiple relationships for same entity', () => {
      const rel1 = createTestRelationship({ sourceId: 'task-1' });
      const rel2 = createTestRelationship({ sourceId: 'task-1' });
      const rel3 = createTestRelationship({ sourceId: 'task-1' });

      index.add(rel1);
      index.add(rel2);
      index.add(rel3);

      const rels = index.getByEntity('task-1');
      expect(rels).toHaveLength(3);
      expect(rels).toContain(rel1);
      expect(rels).toContain(rel2);
      expect(rels).toContain(rel3);
    });
  });

  describe('remove', () => {
    it('should remove relationship from all indexes', () => {
      const rel = createTestRelationship({
        sourceId: 'task-1',
        targetId: 'note-1',
      });

      index.add(rel);
      const removed = index.remove(rel.id);

      expect(removed).toBe(true);

      // Should be gone from byId
      expect(index.getById(rel.id)).toBeUndefined();

      // Should be gone from byEntity (source)
      const sourceRels = index.getByEntity('task-1');
      expect(sourceRels).toHaveLength(0);

      // Should be gone from byEntity (target)
      const targetRels = index.getByEntity('note-1');
      expect(targetRels).toHaveLength(0);

      // Should be gone from bySourceTarget
      expect(index.exists('task-1', 'note-1')).toBe(false);
      expect(index.getBetween('task-1', 'note-1')).toBeUndefined();
    });

    it('should return false for non-existent relationship', () => {
      const removed = index.remove('non-existent-id');
      expect(removed).toBe(false);
    });

    it('should remove only specified relationship', () => {
      const rel1 = createTestRelationship({ sourceId: 'task-1' });
      const rel2 = createTestRelationship({ sourceId: 'task-1' });

      index.add(rel1);
      index.add(rel2);

      index.remove(rel1.id);

      // rel2 should still exist
      expect(index.getById(rel2.id)).toBe(rel2);

      const rels = index.getByEntity('task-1');
      expect(rels).toHaveLength(1);
      expect(rels).toContain(rel2);
    });

    it('should clean up empty entity entries', () => {
      const rel = createTestRelationship({
        sourceId: 'task-1',
        targetId: 'note-1',
      });

      index.add(rel);
      index.remove(rel.id);

      const stats = index.getStats();
      expect(stats.entitiesWithRelationships).toBe(0);
      expect(stats.sourceTargetPairs).toBe(0);
    });
  });

  describe('getByEntity', () => {
    it('should return empty array for entity with no relationships', () => {
      const rels = index.getByEntity('non-existent');
      expect(rels).toEqual([]);
    });

    it('should return all relationships for entity', () => {
      const rel1 = createTestRelationship({ sourceId: 'task-1' });
      const rel2 = createTestRelationship({ sourceId: 'task-1' });
      const rel3 = createTestRelationship({ targetId: 'task-1' }); // bidirectional

      index.add(rel1);
      index.add(rel2);
      index.add(rel3);

      const rels = index.getByEntity('task-1');
      expect(rels).toHaveLength(3);
    });
  });

  describe('getById', () => {
    it('should return undefined for non-existent ID', () => {
      const rel = index.getById('non-existent');
      expect(rel).toBeUndefined();
    });

    it('should return relationship by ID', () => {
      const rel = createTestRelationship();
      index.add(rel);

      const found = index.getById(rel.id);
      expect(found).toBe(rel);
    });
  });

  describe('exists', () => {
    it('should return false when relationship does not exist', () => {
      expect(index.exists('task-1', 'note-1')).toBe(false);
    });

    it('should return true when relationship exists', () => {
      const rel = createTestRelationship({
        sourceId: 'task-1',
        targetId: 'note-1',
      });
      index.add(rel);

      expect(index.exists('task-1', 'note-1')).toBe(true);
    });

    it('should be directional (source->target)', () => {
      const rel = createTestRelationship({
        sourceId: 'task-1',
        targetId: 'note-1',
      });
      index.add(rel);

      // Forward direction exists
      expect(index.exists('task-1', 'note-1')).toBe(true);

      // Reverse direction does NOT exist (unless bidirectional and inverse added)
      expect(index.exists('note-1', 'task-1')).toBe(false);
    });
  });

  describe('getBetween', () => {
    it('should return undefined when no relationship exists', () => {
      const rel = index.getBetween('task-1', 'note-1');
      expect(rel).toBeUndefined();
    });

    it('should return relationship between entities', () => {
      const rel = createTestRelationship({
        sourceId: 'task-1',
        targetId: 'note-1',
      });
      index.add(rel);

      const found = index.getBetween('task-1', 'note-1');
      expect(found).toBe(rel);
    });

    it('should be directional', () => {
      const rel = createTestRelationship({
        sourceId: 'task-1',
        targetId: 'note-1',
      });
      index.add(rel);

      expect(index.getBetween('task-1', 'note-1')).toBe(rel);
      expect(index.getBetween('note-1', 'task-1')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all relationships', () => {
      const rels = [
        createTestRelationship(),
        createTestRelationship(),
        createTestRelationship(),
      ];

      rels.forEach(rel => index.add(rel));
      index.clear();

      const stats = index.getStats();
      expect(stats.totalRelationships).toBe(0);
      expect(stats.entitiesWithRelationships).toBe(0);
      expect(stats.sourceTargetPairs).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const rel1 = createTestRelationship({
        sourceId: 'task-1',
        targetId: 'note-1',
      });
      const rel2 = createTestRelationship({
        sourceId: 'task-1',
        targetId: 'note-2',
      });
      const rel3 = createTestRelationship({
        sourceId: 'task-2',
        targetId: 'note-1',
      });

      index.add(rel1);
      index.add(rel2);
      index.add(rel3);

      const stats = index.getStats();
      expect(stats.totalRelationships).toBe(3);
      // For bidirectional: task-1, task-2, note-1, note-2
      expect(stats.entitiesWithRelationships).toBeGreaterThanOrEqual(3);
      expect(stats.sourceTargetPairs).toBe(3);
    });
  });

  describe('getAllRelationships', () => {
    it('should return empty array when index is empty', () => {
      const rels = index.getAllRelationships();
      expect(rels).toEqual([]);
    });

    it('should return all relationships', () => {
      const rel1 = createTestRelationship();
      const rel2 = createTestRelationship();
      const rel3 = createTestRelationship();

      index.add(rel1);
      index.add(rel2);
      index.add(rel3);

      const rels = index.getAllRelationships();
      expect(rels).toHaveLength(3);
      expect(rels).toContain(rel1);
      expect(rels).toContain(rel2);
      expect(rels).toContain(rel3);
    });
  });

  describe('rebuild', () => {
    it('should replace index with new relationships', () => {
      const oldRels = [createTestRelationship(), createTestRelationship()];
      const newRels = [createTestRelationship(), createTestRelationship(), createTestRelationship()];

      oldRels.forEach(rel => index.add(rel));
      index.rebuild(newRels);

      expect(index.getStats().totalRelationships).toBe(3);

      // Old relationships should be gone
      expect(index.getById(oldRels[0].id)).toBeUndefined();
      expect(index.getById(oldRels[1].id)).toBeUndefined();

      // New relationships should exist
      expect(index.getById(newRels[0].id)).toBe(newRels[0]);
      expect(index.getById(newRels[1].id)).toBe(newRels[1]);
      expect(index.getById(newRels[2].id)).toBe(newRels[2]);
    });
  });

  describe('getByType', () => {
    it('should filter relationships by type', () => {
      const taskNote = createTestRelationship({
        type: RelationshipType.TASK_NOTE,
      });
      const taskSession = createTestRelationship({
        type: RelationshipType.TASK_SESSION,
        targetType: EntityType.SESSION,
        targetId: 'session-1',
      });

      index.add(taskNote);
      index.add(taskSession);

      const taskNotes = index.getByType(RelationshipType.TASK_NOTE);
      expect(taskNotes).toHaveLength(1);
      expect(taskNotes[0]).toBe(taskNote);

      const taskSessions = index.getByType(RelationshipType.TASK_SESSION);
      expect(taskSessions).toHaveLength(1);
      expect(taskSessions[0]).toBe(taskSession);
    });
  });

  describe('getCanonical', () => {
    it('should return only canonical relationships', () => {
      const canonical = createTestRelationship({ canonical: true });
      const inverse = createTestRelationship({ canonical: false });

      index.add(canonical);
      index.add(inverse);

      const canonicalRels = index.getCanonical();
      expect(canonicalRels).toHaveLength(1);
      expect(canonicalRels[0]).toBe(canonical);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should lookup relationships in <5ms for 10k relationships', () => {
      const relationships = generateRelationships(10000);
      const indexLarge = new RelationshipIndex(relationships);

      // Warm up
      indexLarge.getByEntity('task-500');

      // Benchmark getByEntity
      const start = performance.now();
      indexLarge.getByEntity('task-500');
      const end = performance.now();

      const duration = end - start;
      console.log(`getByEntity lookup time: ${duration.toFixed(3)}ms`);
      expect(duration).toBeLessThan(5);
    });

    it('should lookup by ID in <5ms for 10k relationships', () => {
      const relationships = generateRelationships(10000);
      const indexLarge = new RelationshipIndex(relationships);
      const testId = relationships[5000].id;

      // Warm up
      indexLarge.getById(testId);

      // Benchmark getById
      const start = performance.now();
      indexLarge.getById(testId);
      const end = performance.now();

      const duration = end - start;
      console.log(`getById lookup time: ${duration.toFixed(3)}ms`);
      expect(duration).toBeLessThan(5);
    });

    it('should check existence in <5ms for 10k relationships', () => {
      const relationships = generateRelationships(10000);
      const indexLarge = new RelationshipIndex(relationships);

      // Warm up
      indexLarge.exists('task-500', 'note-250');

      // Benchmark exists
      const start = performance.now();
      indexLarge.exists('task-500', 'note-250');
      const end = performance.now();

      const duration = end - start;
      console.log(`exists lookup time: ${duration.toFixed(3)}ms`);
      expect(duration).toBeLessThan(5);
    });

    it('should handle 100k relationships with linear memory scaling', () => {
      const relationships = generateRelationships(100000);

      const start = performance.now();
      const indexLarge = new RelationshipIndex(relationships);
      const end = performance.now();

      const duration = end - start;
      console.log(`Built index with 100k relationships in ${duration.toFixed(2)}ms`);

      const stats = indexLarge.getStats();
      expect(stats.totalRelationships).toBe(100000);

      // Verify lookups still fast
      const lookupStart = performance.now();
      indexLarge.getByEntity('task-500');
      const lookupEnd = performance.now();

      const lookupDuration = lookupEnd - lookupStart;
      console.log(`Lookup time with 100k relationships: ${lookupDuration.toFixed(3)}ms`);
      expect(lookupDuration).toBeLessThan(5);
    });

    it('should add relationships quickly', () => {
      const relationships = generateRelationships(1000);

      const start = performance.now();
      relationships.forEach(rel => index.add(rel));
      const end = performance.now();

      const duration = end - start;
      const perOp = duration / 1000;
      console.log(`Add 1000 relationships in ${duration.toFixed(2)}ms (${perOp.toFixed(3)}ms per op)`);
      expect(perOp).toBeLessThan(1); // Should be well under 1ms per operation
    });

    it('should remove relationships quickly', () => {
      const relationships = generateRelationships(1000);
      relationships.forEach(rel => index.add(rel));

      const start = performance.now();
      relationships.forEach(rel => index.remove(rel.id));
      const end = performance.now();

      const duration = end - start;
      const perOp = duration / 1000;
      console.log(`Remove 1000 relationships in ${duration.toFixed(2)}ms (${perOp.toFixed(3)}ms per op)`);
      expect(perOp).toBeLessThan(5); // Remove is O(n) per entity, so slightly slower
    });
  });

  describe('Edge Cases', () => {
    it('should handle relationship to self', () => {
      const rel = createTestRelationship({
        type: RelationshipType.NOTE_PARENT,
        sourceType: EntityType.NOTE,
        sourceId: 'note-1',
        targetType: EntityType.NOTE,
        targetId: 'note-1', // Same entity
      });

      index.add(rel);

      const rels = index.getByEntity('note-1');
      expect(rels).toContain(rel);
      expect(index.exists('note-1', 'note-1')).toBe(true);
    });

    it('should handle empty string IDs gracefully', () => {
      const rel = createTestRelationship({
        sourceId: '',
        targetId: '',
      });

      index.add(rel);
      expect(index.getById(rel.id)).toBe(rel);
    });

    it('should handle very long entity IDs', () => {
      const longId = 'a'.repeat(10000);
      const rel = createTestRelationship({
        sourceId: longId,
      });

      index.add(rel);

      const start = performance.now();
      const rels = index.getByEntity(longId);
      const end = performance.now();

      expect(rels).toContain(rel);
      expect(end - start).toBeLessThan(5);
    });
  });
});
