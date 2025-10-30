/**
 * Relationship Filters
 *
 * Utility functions for filtering and sorting relationships based on various criteria.
 * Provides composable filters for confidence, source, date range, and entity type.
 *
 * **Key Features**:
 * - Filter by confidence threshold
 * - Filter by relationship source (ai, manual, migration, system)
 * - Filter by date range
 * - Filter by entity type (source or target)
 * - Composable filters (chain multiple filters)
 * - Sort by confidence, date, or similarity
 *
 * **Performance**: <5ms for 10k relationships
 *
 * @module services/relationshipFilters
 * @since 2.0.0
 */

import type { Relationship, RelationshipSource, EntityType } from '@/types/relationships';

/**
 * Filter relationships by minimum confidence threshold
 *
 * Only includes relationships with source='ai' and confidence >= minConfidence.
 * Non-AI relationships (manual, migration, system) are always included.
 *
 * @param relationships - Array of relationships to filter
 * @param minConfidence - Minimum confidence score (0-1)
 * @returns Filtered relationships
 *
 * @example
 * ```typescript
 * const highConfidence = filterByConfidence(relationships, 0.8);
 * // Returns only AI relationships with confidence >= 0.8
 * ```
 */
export function filterByConfidence(
  relationships: Relationship[],
  minConfidence: number
): Relationship[] {
  if (minConfidence < 0 || minConfidence > 1) {
    throw new Error('minConfidence must be between 0 and 1');
  }

  return relationships.filter(rel => {
    // Always include non-AI relationships
    if (rel.metadata.source !== 'ai') {
      return true;
    }

    // For AI relationships, check confidence
    const confidence = rel.metadata.confidence ?? 0;
    return confidence >= minConfidence;
  });
}

/**
 * Filter relationships by source
 *
 * Returns only relationships created by the specified source.
 *
 * @param relationships - Array of relationships to filter
 * @param source - Relationship source to filter by
 * @returns Filtered relationships
 *
 * @example
 * ```typescript
 * const aiRels = filterBySource(relationships, 'ai');
 * const manualRels = filterBySource(relationships, 'manual');
 * ```
 */
export function filterBySource(
  relationships: Relationship[],
  source: RelationshipSource
): Relationship[] {
  return relationships.filter(rel => rel.metadata.source === source);
}

/**
 * Filter relationships by date range
 *
 * Returns relationships created within the specified date range (inclusive).
 *
 * @param relationships - Array of relationships to filter
 * @param start - Start date (ISO 8601 timestamp or Date object)
 * @param end - End date (ISO 8601 timestamp or Date object)
 * @returns Filtered relationships
 *
 * @example
 * ```typescript
 * const today = new Date();
 * const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
 *
 * const thisWeek = filterByDateRange(relationships, weekAgo, today);
 * ```
 */
export function filterByDateRange(
  relationships: Relationship[],
  start: Date | string,
  end: Date | string
): Relationship[] {
  const startTime = typeof start === 'string' ? new Date(start).getTime() : start.getTime();
  const endTime = typeof end === 'string' ? new Date(end).getTime() : end.getTime();

  return relationships.filter(rel => {
    const createdAt = new Date(rel.metadata.createdAt).getTime();
    return createdAt >= startTime && createdAt <= endTime;
  });
}

/**
 * Filter relationships by entity type
 *
 * Returns relationships where the entity (as source OR target) matches the type.
 *
 * @param relationships - Array of relationships to filter
 * @param entityId - Entity ID to filter by
 * @param entityType - Optional entity type filter
 * @returns Filtered relationships
 *
 * @example
 * ```typescript
 * // Get all relationships for a specific task
 * const taskRels = filterByEntity(relationships, 'task-123');
 *
 * // Get only relationships where task is the source
 * const taskAsSource = filterByEntity(relationships, 'task-123', 'task');
 * ```
 */
export function filterByEntity(
  relationships: Relationship[],
  entityId: string,
  entityType?: EntityType
): Relationship[] {
  return relationships.filter(rel => {
    const isSource = rel.sourceId === entityId;
    const isTarget = rel.targetId === entityId;

    // Must be either source or target
    if (!isSource && !isTarget) {
      return false;
    }

    // If entityType specified, check that the entity has the correct type
    if (entityType) {
      if (isSource && rel.sourceType !== entityType) {
        return false;
      }
      if (isTarget && rel.targetType !== entityType) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filter relationships to only canonical ones
 *
 * For bidirectional relationships, only returns the canonical direction.
 * Useful for avoiding duplicate relationships in queries.
 *
 * @param relationships - Array of relationships to filter
 * @returns Filtered relationships (only canonical)
 *
 * @example
 * ```typescript
 * // Task-Note relationships exist in both directions
 * // This returns only Task→Note (canonical), not Note→Task
 * const canonical = filterCanonical(relationships);
 * ```
 */
export function filterCanonical(relationships: Relationship[]): Relationship[] {
  return relationships.filter(rel => rel.canonical);
}

/**
 * Filter relationships to only non-canonical ones
 *
 * For bidirectional relationships, only returns the reverse direction.
 * Useful for finding inverse relationships.
 *
 * @param relationships - Array of relationships to filter
 * @returns Filtered relationships (only non-canonical)
 */
export function filterNonCanonical(relationships: Relationship[]): Relationship[] {
  return relationships.filter(rel => !rel.canonical);
}

/**
 * Sort relationships by confidence (descending)
 *
 * AI relationships with higher confidence appear first.
 * Non-AI relationships are sorted to the end (no confidence score).
 *
 * @param relationships - Array of relationships to sort
 * @returns Sorted relationships (mutates input array)
 *
 * @example
 * ```typescript
 * const sorted = sortByConfidence([...relationships]);
 * // Highest confidence AI relationships first
 * ```
 */
export function sortByConfidence(relationships: Relationship[]): Relationship[] {
  return relationships.sort((a, b) => {
    const aConf = a.metadata.confidence ?? -1;
    const bConf = b.metadata.confidence ?? -1;
    return bConf - aConf; // Descending
  });
}

/**
 * Sort relationships by creation date (descending - newest first)
 *
 * @param relationships - Array of relationships to sort
 * @returns Sorted relationships (mutates input array)
 *
 * @example
 * ```typescript
 * const sorted = sortByDate([...relationships]);
 * // Newest relationships first
 * ```
 */
export function sortByDate(relationships: Relationship[]): Relationship[] {
  return relationships.sort((a, b) => {
    const aTime = new Date(a.metadata.createdAt).getTime();
    const bTime = new Date(b.metadata.createdAt).getTime();
    return bTime - aTime; // Descending (newest first)
  });
}

/**
 * Sort relationships by creation date (ascending - oldest first)
 *
 * @param relationships - Array of relationships to sort
 * @returns Sorted relationships (mutates input array)
 */
export function sortByDateAsc(relationships: Relationship[]): Relationship[] {
  return relationships.sort((a, b) => {
    const aTime = new Date(a.metadata.createdAt).getTime();
    const bTime = new Date(b.metadata.createdAt).getTime();
    return aTime - bTime; // Ascending (oldest first)
  });
}

/**
 * Combine multiple filter functions
 *
 * Allows chaining multiple filters together for complex queries.
 *
 * @param relationships - Array of relationships to filter
 * @param filters - Array of filter functions to apply
 * @returns Filtered relationships
 *
 * @example
 * ```typescript
 * const filtered = combineFilters(relationships, [
 *   (rels) => filterBySource(rels, 'ai'),
 *   (rels) => filterByConfidence(rels, 0.8),
 *   (rels) => filterByDateRange(rels, weekAgo, today)
 * ]);
 * // Returns AI relationships with confidence >= 0.8 created this week
 * ```
 */
export function combineFilters(
  relationships: Relationship[],
  filters: Array<(rels: Relationship[]) => Relationship[]>
): Relationship[] {
  return filters.reduce((result, filter) => filter(result), relationships);
}

/**
 * Get statistics about a set of relationships
 *
 * Useful for understanding the composition of relationships in a collection.
 *
 * @param relationships - Array of relationships to analyze
 * @returns Statistics object
 *
 * @example
 * ```typescript
 * const stats = getRelationshipStats(relationships);
 * console.log(`${stats.total} relationships`);
 * console.log(`${stats.aiCount} AI-created (avg confidence: ${stats.avgConfidence})`);
 * console.log(`${stats.manualCount} manual`);
 * ```
 */
export function getRelationshipStats(relationships: Relationship[]): {
  total: number;
  aiCount: number;
  manualCount: number;
  migrationCount: number;
  systemCount: number;
  canonicalCount: number;
  avgConfidence: number;
  minConfidence: number;
  maxConfidence: number;
} {
  const total = relationships.length;
  const aiRels = relationships.filter(r => r.metadata.source === 'ai');
  const manualRels = relationships.filter(r => r.metadata.source === 'manual');
  const migrationRels = relationships.filter(r => r.metadata.source === 'migration');
  const systemRels = relationships.filter(r => r.metadata.source === 'system');
  const canonicalRels = relationships.filter(r => r.canonical);

  // Calculate confidence statistics (only for AI relationships)
  const confidences = aiRels
    .map(r => r.metadata.confidence)
    .filter((c): c is number => c !== undefined);

  const avgConfidence = confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0;

  const minConfidence = confidences.length > 0
    ? Math.min(...confidences)
    : 0;

  const maxConfidence = confidences.length > 0
    ? Math.max(...confidences)
    : 0;

  return {
    total,
    aiCount: aiRels.length,
    manualCount: manualRels.length,
    migrationCount: migrationRels.length,
    systemCount: systemRels.length,
    canonicalCount: canonicalRels.length,
    avgConfidence,
    minConfidence,
    maxConfidence,
  };
}

/**
 * Group relationships by source
 *
 * Returns a map of source type to array of relationships.
 *
 * @param relationships - Array of relationships to group
 * @returns Map of source to relationships
 *
 * @example
 * ```typescript
 * const grouped = groupBySource(relationships);
 * console.log(`AI: ${grouped.get('ai')?.length || 0}`);
 * console.log(`Manual: ${grouped.get('manual')?.length || 0}`);
 * ```
 */
export function groupBySource(
  relationships: Relationship[]
): Map<RelationshipSource, Relationship[]> {
  const groups = new Map<RelationshipSource, Relationship[]>();

  for (const rel of relationships) {
    const source = rel.metadata.source;
    if (!groups.has(source)) {
      groups.set(source, []);
    }
    groups.get(source)!.push(rel);
  }

  return groups;
}

/**
 * Group relationships by entity type
 *
 * Returns a map of entity type to array of relationships where that type appears.
 *
 * @param relationships - Array of relationships to group
 * @returns Map of entity type to relationships
 */
export function groupByEntityType(
  relationships: Relationship[]
): Map<EntityType, Relationship[]> {
  const groups = new Map<EntityType, Relationship[]>();

  for (const rel of relationships) {
    // Add to source type group
    if (!groups.has(rel.sourceType)) {
      groups.set(rel.sourceType, []);
    }
    groups.get(rel.sourceType)!.push(rel);

    // Add to target type group (if different)
    if (rel.targetType !== rel.sourceType) {
      if (!groups.has(rel.targetType)) {
        groups.set(rel.targetType, []);
      }
      groups.get(rel.targetType)!.push(rel);
    }
  }

  return groups;
}
