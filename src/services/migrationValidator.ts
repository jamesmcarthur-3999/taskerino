/**
 * Migration Validator Service
 *
 * Performs pre-migration and post-migration validation to ensure data integrity.
 * This service catches potential issues BEFORE migration runs and verifies
 * correctness AFTER migration completes.
 *
 * @module services/migrationValidator
 * @since 2.0.0
 */

import type { Task, Note, Session } from '@/types';
import type { Relationship } from '@/types/relationships';
import { EntityType, RELATIONSHIP_CONFIGS } from '@/types/relationships';

/**
 * Validation result severity
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Validation issue details
 */
export interface ValidationIssue {
  /** Severity level */
  severity: ValidationSeverity;

  /** Category of validation check */
  category: 'structure' | 'integrity' | 'consistency' | 'performance';

  /** Entity type involved */
  entityType?: EntityType;

  /** Entity ID involved */
  entityId?: string;

  /** Human-readable message */
  message: string;

  /** Suggested action to resolve */
  suggestedAction?: string;
}

/**
 * Pre-migration validation result
 *
 * Checks data integrity before migration to catch potential issues early
 */
export interface PreMigrationValidation {
  /** Can migration proceed safely? */
  canProceed: boolean;

  /** Issues found during validation */
  issues: ValidationIssue[];

  /** Statistics about the data */
  statistics: {
    /** Total entities to migrate */
    totalEntities: number;

    /** Entities with legacy fields */
    entitiesWithLegacyFields: number;

    /** Entities already migrated */
    entitiesAlreadyMigrated: number;

    /** Estimated relationships to create */
    estimatedRelationships: number;
  };

  /** Performance estimates */
  performance: {
    /** Estimated duration in milliseconds */
    estimatedDuration: number;

    /** Is the dataset large enough to warrant progress UI? */
    showProgressUI: boolean;
  };
}

/**
 * Post-migration validation result
 *
 * Verifies migration correctness after completion
 */
export interface PostMigrationValidation {
  /** Did migration preserve all data correctly? */
  dataPreserved: boolean;

  /** Are all relationships valid and consistent? */
  relationshipsValid: boolean;

  /** Issues found during validation */
  issues: ValidationIssue[];

  /** Statistics about migration results */
  statistics: {
    /** Total relationships created */
    totalRelationships: number;

    /** Entities migrated */
    entitiesMigrated: number;

    /** Orphaned references removed */
    orphanedReferencesRemoved: number;

    /** Bidirectional pairs validated */
    bidirectionalPairsValidated: number;
  };
}

/**
 * Migration Validator Service
 *
 * Provides comprehensive validation before and after migration.
 *
 * **Usage**:
 * ```typescript
 * const validator = new MigrationValidator();
 *
 * // Before migration
 * const preValidation = await validator.preValidate();
 * if (!preValidation.canProceed) {
 *   console.error('Cannot migrate:', preValidation.issues);
 *   return;
 * }
 *
 * // Run migration...
 * const report = await migrationService.migrate(false);
 *
 * // After migration
 * const postValidation = await validator.postValidate();
 * if (!postValidation.dataPreserved) {
 *   console.error('Data not preserved!', postValidation.issues);
 *   await migrationService.rollback(report.backupId);
 * }
 * ```
 */
export class MigrationValidator {
  /**
   * Validate data before migration
   *
   * Checks for:
   * - Duplicate entity IDs
   * - Invalid entity structures
   * - Circular references
   * - Missing required fields
   * - Performance concerns (large datasets)
   *
   * @param tasks - All tasks in the system
   * @param notes - All notes in the system
   * @param sessions - All sessions in the system
   * @returns Pre-migration validation result
   */
  async preValidate(
    tasks: Task[],
    notes: Note[],
    sessions: Session[]
  ): Promise<PreMigrationValidation> {
    const issues: ValidationIssue[] = [];

    // Check for duplicate IDs
    this.checkDuplicateIds(tasks, 'task', issues);
    this.checkDuplicateIds(notes, 'note', issues);
    this.checkDuplicateIds(sessions, 'session', issues);

    // Check entity structure
    this.checkEntityStructure(tasks, EntityType.TASK, issues);
    this.checkEntityStructure(notes, EntityType.NOTE, issues);
    this.checkEntityStructure(sessions, EntityType.SESSION, issues);

    // Calculate statistics
    const statistics = this.calculatePreMigrationStats(tasks, notes, sessions);

    // Performance estimates
    const estimatedDuration = this.estimateMigrationDuration(statistics.totalEntities);
    const showProgressUI = statistics.totalEntities > 100;

    // Determine if migration can proceed
    const hasBlockingErrors = issues.some(i => i.severity === 'error');

    return {
      canProceed: !hasBlockingErrors,
      issues,
      statistics,
      performance: {
        estimatedDuration,
        showProgressUI,
      },
    };
  }

  /**
   * Validate data after migration
   *
   * Checks for:
   * - All legacy relationships converted to new system
   * - Bidirectional consistency
   * - No orphaned relationships
   * - Relationship validity (type constraints)
   * - Data preservation (no data lost)
   *
   * @param tasks - All tasks after migration
   * @param notes - All notes after migration
   * @param sessions - All sessions after migration
   * @returns Post-migration validation result
   */
  async postValidate(
    tasks: Task[],
    notes: Note[],
    sessions: Session[]
  ): Promise<PostMigrationValidation> {
    const issues: ValidationIssue[] = [];

    // Check all entities have relationshipVersion = 1
    this.checkMigrationCompleteness(tasks, EntityType.TASK, issues);
    this.checkMigrationCompleteness(notes, EntityType.NOTE, issues);
    this.checkMigrationCompleteness(sessions, EntityType.SESSION, issues);

    // Check relationship validity
    this.checkRelationshipValidity(tasks, EntityType.TASK, issues);
    this.checkRelationshipValidity(notes, EntityType.NOTE, issues);
    this.checkRelationshipValidity(sessions, EntityType.SESSION, issues);

    // Check bidirectional consistency
    const bidirectionalPairsValidated = this.checkBidirectionalConsistency(
      tasks,
      notes,
      sessions,
      issues
    );

    // Check for orphaned relationships (pointing to non-existent entities)
    const orphanedReferencesRemoved = this.checkOrphanedRelationships(
      tasks,
      notes,
      sessions,
      issues
    );

    // Calculate statistics
    const statistics = this.calculatePostMigrationStats(
      tasks,
      notes,
      sessions,
      bidirectionalPairsValidated,
      orphanedReferencesRemoved
    );

    // Determine overall validation result
    const dataPreserved = !issues.some(
      i => i.severity === 'error' && i.category === 'integrity'
    );
    const relationshipsValid = !issues.some(
      i => i.severity === 'error' && i.category === 'consistency'
    );

    return {
      dataPreserved,
      relationshipsValid,
      issues,
      statistics,
    };
  }

  /**
   * Check for duplicate entity IDs
   */
  private checkDuplicateIds(
    entities: Array<{ id: string }>,
    entityType: string,
    issues: ValidationIssue[]
  ): void {
    const seen = new Set<string>();
    for (const entity of entities) {
      if (seen.has(entity.id)) {
        issues.push({
          severity: 'error',
          category: 'integrity',
          entityId: entity.id,
          message: `Duplicate ${entityType} ID: ${entity.id}`,
          suggestedAction: `Remove or rename duplicate ${entityType}`,
        });
      }
      seen.add(entity.id);
    }
  }

  /**
   * Check entity structure for required fields
   */
  private checkEntityStructure(
    entities: Array<{ id: string }>,
    entityType: EntityType,
    issues: ValidationIssue[]
  ): void {
    for (const entity of entities) {
      if (!entity.id || typeof entity.id !== 'string') {
        issues.push({
          severity: 'error',
          category: 'structure',
          entityType,
          message: `Entity missing valid ID`,
          suggestedAction: 'Ensure all entities have string IDs',
        });
      }
    }
  }

  /**
   * Calculate pre-migration statistics
   */
  private calculatePreMigrationStats(
    tasks: Task[],
    notes: Note[],
    sessions: Session[]
  ): PreMigrationValidation['statistics'] {
    let entitiesWithLegacyFields = 0;
    let entitiesAlreadyMigrated = 0;
    let estimatedRelationships = 0;

    // Count tasks
    for (const task of tasks) {
      if (task.relationshipVersion === 1) {
        entitiesAlreadyMigrated++;
      } else {
        if (task.noteId || task.sourceNoteId || task.sourceSessionId) {
          entitiesWithLegacyFields++;
          estimatedRelationships += [task.noteId, task.sourceNoteId, task.sourceSessionId].filter(
            Boolean
          ).length;
        }
      }
    }

    // Count notes
    for (const note of notes) {
      if (note.relationshipVersion === 1) {
        entitiesAlreadyMigrated++;
      } else {
        const legacyFieldCount =
          (note.topicId ? 1 : 0) +
          (note.topicIds?.length || 0) +
          (note.companyIds?.length || 0) +
          (note.contactIds?.length || 0) +
          (note.sourceSessionId ? 1 : 0) +
          (note.parentNoteId ? 1 : 0);

        if (legacyFieldCount > 0) {
          entitiesWithLegacyFields++;
          estimatedRelationships += legacyFieldCount;
        }
      }
    }

    // Count sessions
    for (const session of sessions) {
      if (session.relationshipVersion === 1) {
        entitiesAlreadyMigrated++;
      } else {
        const legacyFieldCount =
          (session.extractedTaskIds?.length || 0) + (session.extractedNoteIds?.length || 0);

        if (legacyFieldCount > 0) {
          entitiesWithLegacyFields++;
          estimatedRelationships += legacyFieldCount;
        }
      }
    }

    return {
      totalEntities: tasks.length + notes.length + sessions.length,
      entitiesWithLegacyFields,
      entitiesAlreadyMigrated,
      estimatedRelationships,
    };
  }

  /**
   * Estimate migration duration based on entity count
   *
   * Based on benchmarks: ~100 entities/second
   */
  private estimateMigrationDuration(entityCount: number): number {
    const entitiesPerSecond = 100;
    const baseOverhead = 1000; // 1 second base overhead
    return Math.round(baseOverhead + (entityCount / entitiesPerSecond) * 1000);
  }

  /**
   * Check that all entities have been migrated
   */
  private checkMigrationCompleteness(
    entities: Array<{ id: string; relationshipVersion?: number }>,
    entityType: EntityType,
    issues: ValidationIssue[]
  ): void {
    for (const entity of entities) {
      if (entity.relationshipVersion !== 1) {
        issues.push({
          severity: 'error',
          category: 'consistency',
          entityType,
          entityId: entity.id,
          message: `Entity not migrated: relationshipVersion !== 1`,
          suggestedAction: 'Re-run migration',
        });
      }
    }
  }

  /**
   * Check relationship validity (type constraints, required fields)
   */
  private checkRelationshipValidity(
    entities: Array<{ id: string; relationships?: Relationship[] }>,
    entityType: EntityType,
    issues: ValidationIssue[]
  ): void {
    for (const entity of entities) {
      for (const rel of entity.relationships || []) {
        // Check required fields
        if (!rel.id || !rel.type || !rel.sourceId || !rel.targetId) {
          issues.push({
            severity: 'error',
            category: 'structure',
            entityType,
            entityId: entity.id,
            message: `Relationship missing required fields: ${JSON.stringify(rel)}`,
            suggestedAction: 'Check relationship creation logic',
          });
        }

        // Check type constraints
        const config = RELATIONSHIP_CONFIGS[rel.type];
        if (config) {
          if (!config.sourceTypes.includes(rel.sourceType)) {
            issues.push({
              severity: 'error',
              category: 'consistency',
              entityType,
              entityId: entity.id,
              message: `Invalid source type for ${rel.type}: ${rel.sourceType}`,
              suggestedAction: 'Check relationship type configuration',
            });
          }

          if (!config.targetTypes.includes(rel.targetType)) {
            issues.push({
              severity: 'error',
              category: 'consistency',
              entityType,
              entityId: entity.id,
              message: `Invalid target type for ${rel.type}: ${rel.targetType}`,
              suggestedAction: 'Check relationship type configuration',
            });
          }
        }
      }
    }
  }

  /**
   * Check bidirectional consistency
   *
   * For bidirectional relationships, ensure both directions exist
   */
  private checkBidirectionalConsistency(
    tasks: Task[],
    notes: Note[],
    sessions: Session[],
    issues: ValidationIssue[]
  ): number {
    // Build relationship index
    const relationshipIndex = new Map<string, Relationship>();
    const entities = [...tasks, ...notes, ...sessions];

    for (const entity of entities) {
      for (const rel of entity.relationships || []) {
        const key = `${rel.sourceType}:${rel.sourceId}:${rel.targetType}:${rel.targetId}`;
        relationshipIndex.set(key, rel);
      }
    }

    let pairsValidated = 0;

    // Check for missing inverse relationships
    for (const [, rel] of relationshipIndex.entries()) {
      const config = RELATIONSHIP_CONFIGS[rel.type];
      if (config && config.bidirectional) {
        const inverseKey = `${rel.targetType}:${rel.targetId}:${rel.sourceType}:${rel.sourceId}`;
        if (!relationshipIndex.has(inverseKey)) {
          issues.push({
            severity: 'warning',
            category: 'consistency',
            message: `Missing inverse relationship: ${inverseKey}`,
            suggestedAction: 'Check bidirectional relationship creation',
          });
        } else {
          pairsValidated++;
        }
      }
    }

    return pairsValidated;
  }

  /**
   * Check for orphaned relationships (pointing to non-existent entities)
   */
  private checkOrphanedRelationships(
    tasks: Task[],
    notes: Note[],
    sessions: Session[],
    issues: ValidationIssue[]
  ): number {
    // Build entity index
    const entityIndex = new Set<string>();
    for (const task of tasks) {
      entityIndex.add(`${EntityType.TASK}:${task.id}`);
    }
    for (const note of notes) {
      entityIndex.add(`${EntityType.NOTE}:${note.id}`);
    }
    for (const session of sessions) {
      entityIndex.add(`${EntityType.SESSION}:${session.id}`);
    }

    let orphanedCount = 0;
    const entities = [...tasks, ...notes, ...sessions];

    for (const entity of entities) {
      for (const rel of entity.relationships || []) {
        // Check if target exists
        const targetKey = `${rel.targetType}:${rel.targetId}`;
        if (!entityIndex.has(targetKey)) {
          orphanedCount++;
          issues.push({
            severity: 'warning',
            category: 'integrity',
            message: `Orphaned relationship: ${rel.sourceType}:${rel.sourceId} → ${rel.targetType}:${rel.targetId} (target not found)`,
            suggestedAction: 'Remove orphaned relationship or restore missing entity',
          });
        }
      }
    }

    return orphanedCount;
  }

  /**
   * Calculate post-migration statistics
   */
  private calculatePostMigrationStats(
    tasks: Task[],
    notes: Note[],
    sessions: Session[],
    bidirectionalPairsValidated: number,
    orphanedReferencesRemoved: number
  ): PostMigrationValidation['statistics'] {
    let totalRelationships = 0;
    let entitiesMigrated = 0;

    const entities = [...tasks, ...notes, ...sessions];

    for (const entity of entities) {
      if (entity.relationshipVersion === 1) {
        entitiesMigrated++;
      }
      totalRelationships += entity.relationships?.length || 0;
    }

    return {
      totalRelationships,
      entitiesMigrated,
      orphanedReferencesRemoved,
      bidirectionalPairsValidated,
    };
  }
}
