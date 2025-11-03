# AGENT TASK F3: Migration Service

**Objective:** Build backward-compatible migration from legacy relationship fields to unified system.

**Priority:** P0 (Foundation)

**Dependencies:** F1 (Type System), F2 (Storage Layer)

**Complexity:** High

**Estimated Time:** 8-10 hours

---

## Detailed Requirements

### 1. Create Migration Service

**File:** `src/services/relationshipMigration.ts`

This service handles the complete migration process with validation, rollback support, and comprehensive reporting.

**Core Implementation:**

```typescript
import { Task, Note, Session } from '@/types';
import { Relationship, RelationshipType, EntityType } from '@/types/relationships';
import { StorageService } from '@/services/storage';
import { generateId } from '@/utils/helpers';

export interface MigrationReport {
  success: boolean;
  totalEntities: number;
  entitiesScanned: {
    tasks: number;
    notes: number;
    sessions: number;
  };
  relationshipsCreated: {
    taskNote: number;
    taskSession: number;
    noteSession: number;
    noteTopic: number;
    noteCompany: number;
    noteContact: number;
  };
  entitiesMigrated: number;
  issues: MigrationIssue[];
  orphanedReferences: OrphanedReference[];
  duration: number; // milliseconds
}

export interface MigrationIssue {
  severity: 'error' | 'warning' | 'info';
  entityType: EntityType;
  entityId: string;
  field: string;
  message: string;
}

export interface OrphanedReference {
  sourceType: EntityType;
  sourceId: string;
  field: string;
  targetType: EntityType;
  targetId: string;
  action: 'removed' | 'kept' | 'created_placeholder';
}

export class RelationshipMigrationService {
  constructor(
    private storage: StorageService,
    private logger: Logger
  ) {}

  /**
   * Perform migration from legacy fields to unified relationships
   * @param dryRun - If true, don't actually modify data, just report
   */
  async migrate(dryRun: boolean = false): Promise<MigrationReport> {
    const startTime = Date.now();
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
      },
      entitiesMigrated: 0,
      issues: [],
      orphanedReferences: [],
      duration: 0,
    };

    try {
      // Step 1: Create backup
      if (!dryRun) {
        this.logger.info('Creating backup before migration...');
        await this.createBackup();
      }

      // Step 2: Load all entities
      this.logger.info('Loading entities for migration...');
      const tasks = await this.storage.load<Task>('tasks');
      const notes = await this.storage.load<Note>('notes');
      const sessions = await this.storage.load<Session>('sessions');

      report.entitiesScanned = {
        tasks: tasks.length,
        notes: notes.length,
        sessions: sessions.length,
      };
      report.totalEntities = tasks.length + notes.length + sessions.length;

      // Step 3: Create entity maps for validation
      const taskMap = new Map(tasks.map(t => [t.id, t]));
      const noteMap = new Map(notes.map(n => [n.id, n]));
      const sessionMap = new Map(sessions.map(s => [s.id, s]));

      // Step 4: Migrate tasks
      this.logger.info(`Migrating ${tasks.length} tasks...`);
      for (const task of tasks) {
        if (task.relationshipVersion === 1) {
          // Already migrated
          continue;
        }

        const relationships: Relationship[] = [];

        // Migrate noteId
        if (task.noteId) {
          if (noteMap.has(task.noteId)) {
            relationships.push(this.createRelationship({
              type: RelationshipType.TASK_NOTE,
              sourceType: EntityType.TASK,
              sourceId: task.id,
              targetType: EntityType.NOTE,
              targetId: task.noteId,
              metadata: {
                source: 'migration',
                createdAt: task.createdAt,
              },
            }));
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

        // Migrate sourceNoteId (prioritize over noteId if different)
        if (task.sourceNoteId && task.sourceNoteId !== task.noteId) {
          if (noteMap.has(task.sourceNoteId)) {
            relationships.push(this.createRelationship({
              type: RelationshipType.TASK_NOTE,
              sourceType: EntityType.TASK,
              sourceId: task.id,
              targetType: EntityType.NOTE,
              targetId: task.sourceNoteId,
              metadata: {
                source: 'migration',
                createdAt: task.createdAt,
              },
            }));
            report.relationshipsCreated.taskNote++;
          }
        }

        // Migrate sourceSessionId
        if (task.sourceSessionId) {
          if (sessionMap.has(task.sourceSessionId)) {
            relationships.push(this.createRelationship({
              type: RelationshipType.TASK_SESSION,
              sourceType: EntityType.TASK,
              sourceId: task.id,
              targetType: EntityType.SESSION,
              targetId: task.sourceSessionId,
              metadata: {
                source: 'migration',
                createdAt: task.createdAt,
              },
            }));
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

      // Step 5: Migrate notes
      this.logger.info(`Migrating ${notes.length} notes...`);
      for (const note of notes) {
        if (note.relationshipVersion === 1) continue;

        const relationships: Relationship[] = [];

        // Migrate topicId/topicIds
        const topicIds = note.topicIds || (note.topicId ? [note.topicId] : []);
        for (const topicId of topicIds) {
          relationships.push(this.createRelationship({
            type: RelationshipType.NOTE_TOPIC,
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.TOPIC,
            targetId: topicId,
            metadata: {
              source: 'migration',
              createdAt: note.createdAt,
            },
          }));
          report.relationshipsCreated.noteTopic++;
        }

        // Migrate companyIds
        for (const companyId of note.companyIds || []) {
          relationships.push(this.createRelationship({
            type: RelationshipType.NOTE_COMPANY,
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.COMPANY,
            targetId: companyId,
            metadata: {
              source: 'migration',
              createdAt: note.createdAt,
            },
          }));
          report.relationshipsCreated.noteCompany++;
        }

        // Migrate contactIds
        for (const contactId of note.contactIds || []) {
          relationships.push(this.createRelationship({
            type: RelationshipType.NOTE_CONTACT,
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.CONTACT,
            targetId: contactId,
            metadata: {
              source: 'migration',
              createdAt: note.createdAt,
            },
          }));
          report.relationshipsCreated.noteContact++;
        }

        // Migrate sourceSessionId
        if (note.sourceSessionId && sessionMap.has(note.sourceSessionId)) {
          relationships.push(this.createRelationship({
            type: RelationshipType.NOTE_SESSION,
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.SESSION,
            targetId: note.sourceSessionId,
            metadata: {
              source: 'migration',
              createdAt: note.createdAt,
            },
          }));
          report.relationshipsCreated.noteSession++;
        }

        note.relationships = relationships;
        note.relationshipVersion = 1;
        if (relationships.length > 0) {
          report.entitiesMigrated++;
        }
      }

      // Step 6: Migrate sessions
      this.logger.info(`Migrating ${sessions.length} sessions...`);
      for (const session of sessions) {
        if (session.relationshipVersion === 1) continue;

        const relationships: Relationship[] = [];

        // Migrate extractedTaskIds
        for (const taskId of session.extractedTaskIds || []) {
          if (taskMap.has(taskId)) {
            relationships.push(this.createRelationship({
              type: RelationshipType.TASK_SESSION,
              sourceType: EntityType.TASK,
              sourceId: taskId,
              targetType: EntityType.SESSION,
              targetId: session.id,
              metadata: {
                source: 'migration',
                createdAt: session.createdAt,
              },
            }));
            report.relationshipsCreated.taskSession++;
          }
        }

        // Migrate extractedNoteIds
        for (const noteId of session.extractedNoteIds || []) {
          if (noteMap.has(noteId)) {
            relationships.push(this.createRelationship({
              type: RelationshipType.NOTE_SESSION,
              sourceType: EntityType.NOTE,
              sourceId: noteId,
              targetType: EntityType.SESSION,
              targetId: session.id,
              metadata: {
                source: 'migration',
                createdAt: session.createdAt,
              },
            }));
            report.relationshipsCreated.noteSession++;
          }
        }

        session.relationships = relationships;
        session.relationshipVersion = 1;
        if (relationships.length > 0) {
          report.entitiesMigrated++;
        }
      }

      // Step 7: Validate bidirectional consistency
      this.logger.info('Validating bidirectional consistency...');
      const inconsistencies = this.validateBidirectional(tasks, notes, sessions);
      if (inconsistencies.length > 0) {
        report.issues.push(...inconsistencies);
      }

      // Step 8: Save changes (if not dry run)
      if (!dryRun) {
        this.logger.info('Saving migrated entities...');
        const txId = this.storage.beginTransaction();

        this.storage.addOperation(txId, {
          type: 'write',
          collection: 'tasks',
          data: tasks,
        });
        this.storage.addOperation(txId, {
          type: 'write',
          collection: 'notes',
          data: notes,
        });
        this.storage.addOperation(txId, {
          type: 'write',
          collection: 'sessions',
          data: sessions,
        });

        await this.storage.commitTransaction(txId);
      } else {
        this.logger.info('Dry run - no changes saved');
      }

      report.success = true;
      report.duration = Date.now() - startTime;

      return report;
    } catch (error) {
      this.logger.error('Migration failed:', error);
      report.success = false;
      report.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Validate bidirectional consistency
   */
  private validateBidirectional(
    tasks: Task[],
    notes: Note[],
    sessions: Session[]
  ): MigrationIssue[] {
    const issues: MigrationIssue[] = [];
    // Validation logic
    return issues;
  }

  /**
   * Create a relationship object
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
      },
      canonical: true,
    };
  }

  /**
   * Create backup before migration
   */
  private async createBackup(): Promise<void> {
    // Implementation: backup all collections
  }

  /**
   * Rollback migration
   * Restores entities to pre-migration state
   */
  async rollback(): Promise<void> {
    this.logger.warn('Rolling back migration...');
    // Implementation: restore from backup
  }
}
```

### 2. Create Migration Validator

**File:** `src/services/migrationValidator.ts`

### 3. Create Migration UI Component

**File:** `src/components/MigrationProgress.tsx`

---

## Deliverables

1. **`src/services/relationshipMigration.ts`** - Complete migration service (600-800 lines)
2. **`src/services/migrationValidator.ts`** - Pre/post validation (200-300 lines)
3. **`src/components/MigrationProgress.tsx`** - Migration UI
4. **`tests/migration/relationshipMigration.test.ts`** - Extensive migration tests (400+ lines)
5. **`tests/migration/fixtures/`** - Test data fixtures (various scenarios)
6. **`docs/migration/migration-guide.md`** - User-facing documentation

---

## Acceptance Criteria

- [ ] 100% of legacy relationships preserved in test fixtures
- [ ] Bidirectional consistency validated and enforced
- [ ] Orphaned references detected and reported (not silently ignored)
- [ ] Migration completes in <30 seconds for 10k entities (benchmarked)
- [ ] Rollback restores exact original state (tested)
- [ ] Migration is idempotent - safe to run multiple times
- [ ] Dry-run mode works correctly (no data modified)
- [ ] Progress UI shows real-time updates
- [ ] Migration report is comprehensive and actionable

---

## Testing Requirements

### 1. Create Test Fixtures

```typescript
// tests/migration/fixtures/legacyData.ts
export const legacyTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Test task',
    noteId: 'note-1',  // Valid reference
    sourceSessionId: 'session-1',
  },
  {
    id: 'task-2',
    title: 'Orphaned task',
    noteId: 'note-nonexistent', // Orphaned reference
  },
];
```

### 2. Migration Tests

```typescript
describe('Relationship Migration', () => {
  it('should migrate all valid relationships', async () => {
    const service = new RelationshipMigrationService(storage, logger);
    const report = await service.migrate(false);

    expect(report.success).toBe(true);
    expect(report.relationshipsCreated.taskNote).toBeGreaterThan(0);
  });

  it('should detect orphaned references', async () => {
    const report = await service.migrate(true);
    expect(report.orphanedReferences.length).toBeGreaterThan(0);
  });

  it('should be idempotent', async () => {
    const report1 = await service.migrate(false);
    const report2 = await service.migrate(false);
    expect(report2.entitiesMigrated).toBe(0); // Already migrated
  });
});
```

---

## Notes

- Migration is high-risk - test extensively
- Provide clear feedback to users during migration
- Document all edge cases and how they're handled

---

**Task Complete When:**
- All deliverables created
- 100% test coverage for migration logic
- Migration validated on test fixtures
- Documentation complete
