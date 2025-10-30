/**
 * Relationship Migration Service
 *
 * Migrates legacy relationship fields (noteId, sourceSessionId, etc.) to the
 * unified relationship system. This is a CRITICAL service - it handles user data
 * migration and must preserve 100% of existing data.
 *
 * **Key Features**:
 * - 100% data preservation (every legacy relationship becomes a Relationship)
 * - Bidirectional consistency validation
 * - Orphaned reference detection and reporting
 * - Dry-run mode for testing
 * - Rollback support for safety
 * - Comprehensive reporting
 *
 * @module services/relationshipMigration
 * @since 2.0.0
 */

import type { Task, Note, Session } from '@/types';
import {
  type Relationship,
  RelationshipType,
  EntityType,
  type RelationshipMetadata,
} from '@/types/relationships';
import { getStorage } from '@/services/storage';
import { generateId } from '@/utils/helpers';

/**
 * Migration issue severity levels
 */
export type MigrationIssueSeverity = 'error' | 'warning' | 'info';

/**
 * Action taken for orphaned references
 */
export type OrphanedReferenceAction = 'removed' | 'kept' | 'created_placeholder';

/**
 * Migration issue details
 *
 * Represents a problem detected during migration (orphaned refs, validation failures, etc.)
 */
export interface MigrationIssue {
  /** Severity level - determines user action required */
  severity: MigrationIssueSeverity;

  /** Entity type where issue was found */
  entityType: EntityType;

  /** Entity ID where issue was found */
  entityId: string;

  /** Legacy field that caused the issue */
  field: string;

  /** Human-readable description of the issue */
  message: string;
}

/**
 * Orphaned reference details
 *
 * Tracks references to non-existent entities (e.g., task.noteId pointing to deleted note)
 */
export interface OrphanedReference {
  /** Entity type that has the orphaned reference */
  sourceType: EntityType;

  /** Entity ID that has the orphaned reference */
  sourceId: string;

  /** Legacy field containing the orphaned reference */
  field: string;

  /** Entity type that was expected to exist */
  targetType: EntityType;

  /** Entity ID that doesn't exist */
  targetId: string;

  /** What action was taken */
  action: OrphanedReferenceAction;
}

/**
 * Comprehensive migration report
 *
 * Provides complete transparency into what the migration did, found, and any issues.
 * This report is returned to the caller and should be logged/displayed to users.
 */
export interface MigrationReport {
  /** Did the migration complete successfully? */
  success: boolean;

  /** Total entities processed across all types */
  totalEntities: number;

  /** Count of entities scanned by type */
  entitiesScanned: {
    tasks: number;
    notes: number;
    sessions: number;
  };

  /** Count of relationships created by type */
  relationshipsCreated: {
    taskNote: number;
    taskSession: number;
    noteSession: number;
    noteTopic: number;
    noteCompany: number;
    noteContact: number;
    noteParent: number;
  };

  /** Count of entities that were actually migrated (had changes) */
  entitiesMigrated: number;

  /** Issues detected during migration */
  issues: MigrationIssue[];

  /** Orphaned references found */
  orphanedReferences: OrphanedReference[];

  /** Migration duration in milliseconds */
  duration: number;

  /** ID of backup created before migration (for rollback) */
  backupId?: string;

  /** Was this a dry run (no data modified)? */
  dryRun: boolean;
}

/**
 * Relationship Migration Service
 *
 * Handles the complete migration process from legacy fields to unified relationships.
 *
 * **Usage**:
 * ```typescript
 * const service = new RelationshipMigrationService();
 *
 * // Dry run first (no data modified)
 * const dryReport = await service.migrate(true);
 * console.log('Would migrate:', dryReport.entitiesMigrated);
 * console.log('Issues:', dryReport.issues);
 *
 * // If dry run looks good, run for real
 * if (dryReport.issues.filter(i => i.severity === 'error').length === 0) {
 *   const report = await service.migrate(false);
 *   console.log('Migrated:', report.entitiesMigrated, 'entities');
 * }
 *
 * // Rollback if needed
 * if (somethingWentWrong) {
 *   await service.rollback(report.backupId);
 * }
 * ```
 */
export class RelationshipMigrationService {
  private storage = getStorage();

  /**
   * Perform migration from legacy fields to unified relationships
   *
   * @param dryRun - If true, analyze and report but don't modify data
   * @returns Comprehensive migration report
   *
   * @throws Error if migration fails catastrophically (data corruption, etc.)
   */
  async migrate(dryRun: boolean = false): Promise<MigrationReport> {
    const startTime = Date.now();

    // Initialize report
    const report: MigrationReport = {
      success: false,
      totalEntities: 0,
      entitiesScanned: { tasks: 0, notes: 0, sessions: 0 },
      relationshipsCreated: {
        taskNote: 0,
        taskSession: 0,
        noteSession: 0,
        noteTopic: 0,
        noteCompany: 0,
        noteContact: 0,
        noteParent: 0,
      },
      entitiesMigrated: 0,
      issues: [],
      orphanedReferences: [],
      duration: 0,
      dryRun,
    };

    try {
      const storage = await this.storage;

      // Step 1: Create backup (if not dry run)
      if (!dryRun) {
        console.log('[Migration] Creating backup before migration...');
        const backupId = await this.createBackup();
        report.backupId = backupId;
        console.log(`[Migration] Backup created: ${backupId}`);
      }

      // Step 2: Load all entities
      console.log('[Migration] Loading entities for migration...');
      const tasksRaw = (await storage.load<Task[]>('tasks')) || [];
      const notesRaw = (await storage.load<Note[]>('notes')) || [];
      const sessionsRaw = (await storage.load<Session[]>('sessions')) || [];

      // In dry run, work on deep copies to avoid modifying original data
      const tasks = dryRun ? JSON.parse(JSON.stringify(tasksRaw)) : tasksRaw;
      const notes = dryRun ? JSON.parse(JSON.stringify(notesRaw)) : notesRaw;
      const sessions = dryRun ? JSON.parse(JSON.stringify(sessionsRaw)) : sessionsRaw;

      report.entitiesScanned = {
        tasks: tasks.length,
        notes: notes.length,
        sessions: sessions.length,
      };
      report.totalEntities = tasks.length + notes.length + sessions.length;

      console.log(
        `[Migration] Loaded ${tasks.length} tasks, ${notes.length} notes, ${sessions.length} sessions`
      );

      // Step 3: Create entity maps for validation
      const taskMap = new Map<string, Task>(tasks.map((t: Task) => [t.id, t]));
      const noteMap = new Map<string, Note>(notes.map((n: Note) => [n.id, n]));
      const sessionMap = new Map<string, Session>(sessions.map((s: Session) => [s.id, s]));

      // Step 4: Migrate tasks
      console.log(`[Migration] Migrating ${tasks.length} tasks...`);
      for (const task of tasks) {
        this.migrateTask(task, { noteMap, sessionMap, report });
      }

      // Step 5: Migrate notes
      console.log(`[Migration] Migrating ${notes.length} notes...`);
      for (const note of notes) {
        this.migrateNote(note, { sessionMap, report });
      }

      // Step 6: Migrate sessions
      console.log(`[Migration] Migrating ${sessions.length} sessions...`);
      for (const session of sessions) {
        this.migrateSession(session, { taskMap, noteMap, report });
      }

      // Step 7: Validate bidirectional consistency
      console.log('[Migration] Validating bidirectional consistency...');
      const inconsistencies = this.validateBidirectional(tasks, notes, sessions);
      if (inconsistencies.length > 0) {
        report.issues.push(...inconsistencies);
        console.warn(`[Migration] Found ${inconsistencies.length} bidirectional inconsistencies`);
      }

      // Step 8: Save changes (if not dry run)
      if (!dryRun) {
        console.log('[Migration] Saving migrated entities...');
        const tx = await storage.beginTransaction();

        try {
          tx.save('tasks', tasks);
          tx.save('notes', notes);
          tx.save('sessions', sessions);
          await tx.commit();
          console.log('[Migration] Changes committed successfully');
        } catch (error) {
          await tx.rollback();
          throw new Error(`Failed to commit migration: ${error}`);
        }
      } else {
        console.log('[Migration] Dry run - no changes saved');
      }

      report.success = true;
      report.duration = Date.now() - startTime;

      console.log(
        `[Migration] Completed in ${report.duration}ms. Migrated ${report.entitiesMigrated} entities.`
      );

      return report;
    } catch (error) {
      console.error('[Migration] Migration failed:', error);
      report.success = false;
      report.duration = Date.now() - startTime;

      // Add error to issues
      report.issues.push({
        severity: 'error',
        entityType: EntityType.TASK, // Arbitrary
        entityId: 'migration',
        field: 'system',
        message: `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
      });

      throw error;
    }
  }

  /**
   * Migrate a single task
   *
   * Converts legacy fields (noteId, sourceNoteId, sourceSessionId) to relationships
   */
  private migrateTask(
    task: Task,
    context: {
      noteMap: Map<string, Note>;
      sessionMap: Map<string, Session>;
      report: MigrationReport;
    }
  ): void {
    const { noteMap, sessionMap, report } = context;

    // Skip if already migrated
    if (task.relationshipVersion === 1) {
      return;
    }

    const relationships: Relationship[] = task.relationships || [];

    // Migrate noteId (primary note relationship)
    if (task.noteId) {
      if (noteMap.has(task.noteId)) {
        relationships.push(
          this.createRelationship({
            type: RelationshipType.TASK_NOTE,
            sourceType: EntityType.TASK,
            sourceId: task.id,
            targetType: EntityType.NOTE,
            targetId: task.noteId,
            metadata: {
              source: 'migration',
              createdAt: task.createdAt,
            },
          })
        );
        report.relationshipsCreated.taskNote++;
      } else {
        // Orphaned reference
        report.orphanedReferences.push({
          sourceType: EntityType.TASK,
          sourceId: task.id,
          field: 'noteId',
          targetType: EntityType.NOTE,
          targetId: task.noteId,
          action: 'removed',
        });
        report.issues.push({
          severity: 'warning',
          entityType: EntityType.TASK,
          entityId: task.id,
          field: 'noteId',
          message: `References non-existent note: ${task.noteId}`,
        });
      }
    }

    // Migrate sourceNoteId (only if different from noteId to avoid duplicates)
    if (task.sourceNoteId && task.sourceNoteId !== task.noteId) {
      if (noteMap.has(task.sourceNoteId)) {
        relationships.push(
          this.createRelationship({
            type: RelationshipType.TASK_NOTE,
            sourceType: EntityType.TASK,
            sourceId: task.id,
            targetType: EntityType.NOTE,
            targetId: task.sourceNoteId,
            metadata: {
              source: 'migration',
              createdAt: task.createdAt,
            },
          })
        );
        report.relationshipsCreated.taskNote++;
      } else {
        report.orphanedReferences.push({
          sourceType: EntityType.TASK,
          sourceId: task.id,
          field: 'sourceNoteId',
          targetType: EntityType.NOTE,
          targetId: task.sourceNoteId,
          action: 'removed',
        });
        report.issues.push({
          severity: 'warning',
          entityType: EntityType.TASK,
          entityId: task.id,
          field: 'sourceNoteId',
          message: `References non-existent note: ${task.sourceNoteId}`,
        });
      }
    }

    // Migrate sourceSessionId
    if (task.sourceSessionId) {
      if (sessionMap.has(task.sourceSessionId)) {
        relationships.push(
          this.createRelationship({
            type: RelationshipType.TASK_SESSION,
            sourceType: EntityType.TASK,
            sourceId: task.id,
            targetType: EntityType.SESSION,
            targetId: task.sourceSessionId,
            metadata: {
              source: 'migration',
              createdAt: task.createdAt,
            },
          })
        );
        report.relationshipsCreated.taskSession++;
      } else {
        report.orphanedReferences.push({
          sourceType: EntityType.TASK,
          sourceId: task.id,
          field: 'sourceSessionId',
          targetType: EntityType.SESSION,
          targetId: task.sourceSessionId,
          action: 'removed',
        });
      }
    }

    // Update task with relationships
    if (relationships.length > 0 || task.relationshipVersion !== 1) {
      task.relationships = relationships;
      task.relationshipVersion = 1;
      report.entitiesMigrated++;
    }
  }

  /**
   * Migrate a single note
   *
   * Converts legacy fields (topicId, topicIds, companyIds, contactIds, sourceSessionId, parentNoteId) to relationships
   */
  private migrateNote(
    note: Note,
    context: {
      sessionMap: Map<string, Session>;
      report: MigrationReport;
    }
  ): void {
    const { sessionMap, report } = context;

    // Skip if already migrated
    if (note.relationshipVersion === 1) {
      return;
    }

    const relationships: Relationship[] = note.relationships || [];

    // Migrate topicId/topicIds (combine both fields)
    const topicIds = note.topicIds || (note.topicId ? [note.topicId] : []);
    for (const topicId of topicIds) {
      relationships.push(
        this.createRelationship({
          type: RelationshipType.NOTE_TOPIC,
          sourceType: EntityType.NOTE,
          sourceId: note.id,
          targetType: EntityType.TOPIC,
          targetId: topicId,
          metadata: {
            source: 'migration',
            createdAt: note.timestamp,
          },
        })
      );
      report.relationshipsCreated.noteTopic++;
    }

    // Migrate companyIds
    for (const companyId of note.companyIds || []) {
      relationships.push(
        this.createRelationship({
          type: RelationshipType.NOTE_COMPANY,
          sourceType: EntityType.NOTE,
          sourceId: note.id,
          targetType: EntityType.COMPANY,
          targetId: companyId,
          metadata: {
            source: 'migration',
            createdAt: note.timestamp,
          },
        })
      );
      report.relationshipsCreated.noteCompany++;
    }

    // Migrate contactIds
    for (const contactId of note.contactIds || []) {
      relationships.push(
        this.createRelationship({
          type: RelationshipType.NOTE_CONTACT,
          sourceType: EntityType.NOTE,
          sourceId: note.id,
          targetType: EntityType.CONTACT,
          targetId: contactId,
          metadata: {
            source: 'migration',
            createdAt: note.timestamp,
          },
        })
      );
      report.relationshipsCreated.noteContact++;
    }

    // Migrate sourceSessionId
    if (note.sourceSessionId) {
      if (sessionMap.has(note.sourceSessionId)) {
        relationships.push(
          this.createRelationship({
            type: RelationshipType.NOTE_SESSION,
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.SESSION,
            targetId: note.sourceSessionId,
            metadata: {
              source: 'migration',
              createdAt: note.timestamp,
            },
          })
        );
        report.relationshipsCreated.noteSession++;
      } else {
        report.orphanedReferences.push({
          sourceType: EntityType.NOTE,
          sourceId: note.id,
          field: 'sourceSessionId',
          targetType: EntityType.SESSION,
          targetId: note.sourceSessionId,
          action: 'removed',
        });
      }
    }

    // Migrate parentNoteId
    if (note.parentNoteId) {
      relationships.push(
        this.createRelationship({
          type: RelationshipType.NOTE_PARENT,
          sourceType: EntityType.NOTE,
          sourceId: note.id,
          targetType: EntityType.NOTE,
          targetId: note.parentNoteId,
          metadata: {
            source: 'migration',
            createdAt: note.timestamp,
          },
        })
      );
      report.relationshipsCreated.noteParent++;
    }

    // Update note with relationships
    note.relationships = relationships;
    note.relationshipVersion = 1;
    if (relationships.length > 0) {
      report.entitiesMigrated++;
    }
  }

  /**
   * Migrate a single session
   *
   * Converts legacy fields (extractedTaskIds, extractedNoteIds) to relationships
   */
  private migrateSession(
    session: Session,
    context: {
      taskMap: Map<string, Task>;
      noteMap: Map<string, Note>;
      report: MigrationReport;
    }
  ): void {
    const { taskMap, noteMap, report } = context;

    // Skip if already migrated
    if (session.relationshipVersion === 1) {
      return;
    }

    const relationships: Relationship[] = session.relationships || [];

    // Migrate extractedTaskIds
    for (const taskId of session.extractedTaskIds || []) {
      if (taskMap.has(taskId)) {
        relationships.push(
          this.createRelationship({
            type: RelationshipType.TASK_SESSION,
            sourceType: EntityType.SESSION,
            sourceId: session.id,
            targetType: EntityType.TASK,
            targetId: taskId,
            metadata: {
              source: 'migration',
              createdAt: session.startTime,
            },
          })
        );
        report.relationshipsCreated.taskSession++;
      } else {
        report.orphanedReferences.push({
          sourceType: EntityType.SESSION,
          sourceId: session.id,
          field: 'extractedTaskIds',
          targetType: EntityType.TASK,
          targetId: taskId,
          action: 'removed',
        });
      }
    }

    // Migrate extractedNoteIds
    for (const noteId of session.extractedNoteIds || []) {
      if (noteMap.has(noteId)) {
        relationships.push(
          this.createRelationship({
            type: RelationshipType.NOTE_SESSION,
            sourceType: EntityType.SESSION,
            sourceId: session.id,
            targetType: EntityType.NOTE,
            targetId: noteId,
            metadata: {
              source: 'migration',
              createdAt: session.startTime,
            },
          })
        );
        report.relationshipsCreated.noteSession++;
      } else {
        report.orphanedReferences.push({
          sourceType: EntityType.SESSION,
          sourceId: session.id,
          field: 'extractedNoteIds',
          targetType: EntityType.NOTE,
          targetId: noteId,
          action: 'removed',
        });
      }
    }

    // Update session with relationships
    session.relationships = relationships;
    session.relationshipVersion = 1;
    if (relationships.length > 0) {
      report.entitiesMigrated++;
    }
  }

  /**
   * Validate bidirectional consistency
   *
   * Ensures that if A→B exists, then B→A also exists (for bidirectional relationships)
   */
  private validateBidirectional(
    tasks: Task[],
    notes: Note[],
    sessions: Session[]
  ): MigrationIssue[] {
    const issues: MigrationIssue[] = [];

    // Build relationship index: "sourceType:sourceId:targetType:targetId" -> count
    const relationshipIndex = new Map<string, number>();

    const indexRelationship = (rel: Relationship) => {
      const key = `${rel.sourceType}:${rel.sourceId}:${rel.targetType}:${rel.targetId}`;
      relationshipIndex.set(key, (relationshipIndex.get(key) || 0) + 1);
    };

    // Index all relationships
    for (const task of tasks) {
      for (const rel of task.relationships || []) {
        indexRelationship(rel);
      }
    }
    for (const note of notes) {
      for (const rel of note.relationships || []) {
        indexRelationship(rel);
      }
    }
    for (const session of sessions) {
      for (const rel of session.relationships || []) {
        indexRelationship(rel);
      }
    }

    // Check for missing inverse relationships
    const checkInverse = (rel: Relationship, entityType: EntityType, entityId: string) => {
      // Only check bidirectional relationship types
      const bidirectionalTypes: RelationshipType[] = [
        RelationshipType.TASK_NOTE,
        RelationshipType.TASK_SESSION,
        RelationshipType.NOTE_SESSION,
        RelationshipType.TASK_TOPIC,
        RelationshipType.NOTE_TOPIC,
        RelationshipType.NOTE_COMPANY,
        RelationshipType.NOTE_CONTACT,
      ];

      if (!bidirectionalTypes.includes(rel.type)) {
        return;
      }

      // Check if inverse exists
      const inverseKey = `${rel.targetType}:${rel.targetId}:${rel.sourceType}:${rel.sourceId}`;
      if (!relationshipIndex.has(inverseKey)) {
        issues.push({
          severity: 'warning',
          entityType,
          entityId,
          field: 'relationships',
          message: `Missing inverse relationship: ${rel.targetType}:${rel.targetId} → ${rel.sourceType}:${rel.sourceId}`,
        });
      }
    };

    // Validate all relationships
    for (const task of tasks) {
      for (const rel of task.relationships || []) {
        checkInverse(rel, EntityType.TASK, task.id);
      }
    }
    for (const note of notes) {
      for (const rel of note.relationships || []) {
        checkInverse(rel, EntityType.NOTE, note.id);
      }
    }
    for (const session of sessions) {
      for (const rel of session.relationships || []) {
        checkInverse(rel, EntityType.SESSION, session.id);
      }
    }

    return issues;
  }

  /**
   * Create a relationship object
   *
   * Helper to create properly formatted Relationship objects with all required fields
   */
  private createRelationship(params: {
    type: RelationshipType;
    sourceType: EntityType;
    sourceId: string;
    targetType: EntityType;
    targetId: string;
    metadata: Partial<RelationshipMetadata>;
  }): Relationship {
    return {
      id: generateId(),
      type: params.type,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: {
        source: params.metadata.source || 'migration',
        createdAt: params.metadata.createdAt || new Date().toISOString(),
        ...params.metadata,
      } as RelationshipMetadata,
      canonical: true,
    };
  }

  /**
   * Create backup before migration
   *
   * Creates a complete backup of all entity data for rollback safety
   *
   * @returns Backup ID for use with rollback()
   */
  private async createBackup(): Promise<string> {
    const storage = await this.storage;
    const backupId = await storage.createBackup();
    return backupId;
  }

  /**
   * Rollback migration
   *
   * Restores entities to pre-migration state from backup
   *
   * @param backupId - Backup ID from migration report
   */
  async rollback(backupId?: string): Promise<void> {
    if (!backupId) {
      throw new Error('No backup ID provided for rollback');
    }

    console.warn(`[Migration] Rolling back to backup: ${backupId}`);
    const storage = await this.storage;
    await storage.restoreBackup(backupId);
    console.log('[Migration] Rollback complete');
  }
}
