# Relationship Migration Guide

**Version**: 2.0.0
**Last Updated**: 2025-10-24

## Overview

Taskerino 2.0 introduces a **unified relationship system** that replaces legacy relationship fields with a flexible, extensible relationship model. This guide explains:

- **What** the migration does
- **Why** it's necessary
- **How** to run it safely
- **What** to expect during and after migration
- **How** to rollback if needed

---

## What Does the Migration Do?

The migration converts **legacy relationship fields** into the new **unified relationship system**:

### Legacy Fields → Unified Relationships

| Entity | Legacy Fields | New System |
|--------|--------------|------------|
| **Task** | `noteId`, `sourceNoteId`, `sourceSessionId` | `relationships[]` array with `TASK_NOTE`, `TASK_SESSION` relationships |
| **Note** | `topicId`, `topicIds[]`, `companyIds[]`, `contactIds[]`, `sourceSessionId`, `parentNoteId` | `relationships[]` array with `NOTE_TOPIC`, `NOTE_COMPANY`, `NOTE_CONTACT`, `NOTE_SESSION`, `NOTE_PARENT` relationships |
| **Session** | `extractedTaskIds[]`, `extractedNoteIds[]` | `relationships[]` array with `TASK_SESSION`, `NOTE_SESSION` relationships |

### Data Preservation Guarantee

**100% of valid legacy relationships are preserved**. The migration:

✅ Converts every valid legacy field to a `Relationship` object
✅ Preserves all legacy fields for backward compatibility
✅ Marks migrated entities with `relationshipVersion: 1`
✅ Detects and reports orphaned references (references to deleted entities)
✅ Creates backups before any changes

---

## Why Is This Migration Necessary?

The unified relationship system provides:

1. **Flexibility**: Easily add new relationship types (task dependencies, project links, etc.) without changing entity schemas
2. **Consistency**: All relationships stored in a single, standardized format
3. **Metadata**: Rich metadata on every relationship (source, confidence, reasoning)
4. **Bidirectional**: Automatic inverse relationship creation for bidirectional types
5. **Validation**: Type-safe relationship creation with automatic validation

---

## Before You Start

### Prerequisites

1. **Backup Your Data** (automatic, but good to know)
   - The migration creates a backup automatically before any changes
   - You can manually create a backup via Settings → Data → Create Backup

2. **Check API Keys**
   - Ensure your Claude API key is configured (Settings → AI Settings)
   - The migration doesn't use AI, but you'll want it working after migration

3. **Close Other Instances**
   - Close all other Taskerino windows to prevent conflicts

### Recommended: Run Dry Run First

**Always run a dry run before the real migration**. This shows you:
- How many entities will be migrated
- What relationships will be created
- Any issues (orphaned references, etc.)
- Estimated duration

---

## Running the Migration

### Option 1: Via UI (Recommended)

1. **Open Settings** → **Data** → **Migration**
2. **Click "Preview Migration" (Dry Run)**
   - This analyzes your data without making changes
   - Review the migration report carefully
3. **If dry run looks good, click "Run Migration"**
   - Progress bar shows real-time status
   - You can cancel at any time (before commit)
4. **Review Migration Report**
   - Check for any warnings or issues
   - Verify relationship counts match expectations

### Option 2: Via Code

```typescript
import { RelationshipMigrationService } from '@/services/relationshipMigration';
import { MigrationValidator } from '@/services/migrationValidator';

const migrationService = new RelationshipMigrationService();
const validator = new MigrationValidator();

// Step 1: Pre-validate
const storage = await getStorage();
const tasks = await storage.load<Task[]>('tasks') || [];
const notes = await storage.load<Note[]>('notes') || [];
const sessions = await storage.load<Session[]>('sessions') || [];

const preValidation = await validator.preValidate(tasks, notes, sessions);

if (!preValidation.canProceed) {
  console.error('Cannot migrate:', preValidation.issues);
  return;
}

// Step 2: Dry run
const dryReport = await migrationService.migrate(true);
console.log('Dry run completed:', dryReport);

if (dryReport.issues.filter(i => i.severity === 'error').length > 0) {
  console.error('Migration has errors:', dryReport.issues);
  return;
}

// Step 3: Run migration
const report = await migrationService.migrate(false);
console.log('Migration completed:', report);

// Step 4: Post-validate
const tasksAfter = await storage.load<Task[]>('tasks') || [];
const notesAfter = await storage.load<Note[]>('notes') || [];
const sessionsAfter = await storage.load<Session[]>('sessions') || [];

const postValidation = await validator.postValidate(tasksAfter, notesAfter, sessionsAfter);

if (!postValidation.dataPreserved) {
  console.error('Data not preserved!', postValidation.issues);
  await migrationService.rollback(report.backupId);
}
```

---

## What to Expect

### Migration Progress

The migration runs in these steps:

1. **Creating Backup** (0-10%)
   - Automatic backup of all data for rollback safety

2. **Loading Entities** (10-20%)
   - Loads all tasks, notes, and sessions from storage

3. **Migrating Tasks** (20-40%)
   - Converts `noteId`, `sourceNoteId`, `sourceSessionId` to relationships

4. **Migrating Notes** (40-70%)
   - Converts `topicId`, `topicIds`, `companyIds`, `contactIds`, `sourceSessionId`, `parentNoteId` to relationships

5. **Migrating Sessions** (70-90%)
   - Converts `extractedTaskIds`, `extractedNoteIds` to relationships

6. **Validating Consistency** (90-95%)
   - Checks bidirectional relationships for consistency

7. **Saving Changes** (95-100%)
   - Commits all changes atomically (all succeed or all fail)

### Performance

- **Small datasets** (<1000 entities): <5 seconds
- **Medium datasets** (1000-5000 entities): 5-15 seconds
- **Large datasets** (5000-10000 entities): 15-30 seconds

**Benchmark**: Migration processes ~100 entities/second.

### Orphaned References

**What are orphaned references?**

Orphaned references are legacy relationship fields that point to entities that no longer exist. For example:
- `task.noteId = 'note-123'` but note-123 was deleted
- `session.extractedTaskIds = ['task-456']` but task-456 doesn't exist

**How are they handled?**

- **Detected**: Migration finds all orphaned references
- **Reported**: Shown in migration report as warnings
- **Not Migrated**: Orphaned references are NOT converted to relationships (since the target doesn't exist)
- **Legacy Field Kept**: The legacy field remains in place for reference

**Example Migration Report**:

```json
{
  "success": true,
  "entitiesMigrated": 150,
  "relationshipsCreated": {
    "taskNote": 45,
    "taskSession": 12,
    "noteSession": 8,
    "noteTopic": 67,
    "noteCompany": 15,
    "noteContact": 23,
    "noteParent": 3
  },
  "orphanedReferences": [
    {
      "sourceType": "task",
      "sourceId": "task-123",
      "field": "noteId",
      "targetType": "note",
      "targetId": "note-nonexistent",
      "action": "removed"
    }
  ],
  "issues": [
    {
      "severity": "warning",
      "entityType": "task",
      "entityId": "task-123",
      "field": "noteId",
      "message": "References non-existent note: note-nonexistent"
    }
  ],
  "duration": 2347
}
```

---

## After Migration

### What Changed?

1. **All entities have `relationshipVersion: 1`**
   - This marks them as migrated
   - Future migrations can check this field

2. **All entities have `relationships[]` arrays**
   - Contains `Relationship` objects
   - Each relationship has metadata (source, createdAt, etc.)

3. **Legacy fields are still present**
   - For backward compatibility during transition
   - Will be removed in a future major version

### Verifying Migration Success

**Check 1: Relationship Version**

All entities should have `relationshipVersion: 1`:

```typescript
const tasks = await storage.load<Task[]>('tasks');
const allMigrated = tasks.every(t => t.relationshipVersion === 1);
console.log('All tasks migrated:', allMigrated);
```

**Check 2: Relationship Counts**

Verify relationship counts match expectations:

```typescript
const totalRelationships = tasks.reduce(
  (sum, task) => sum + (task.relationships?.length || 0),
  0
);
console.log('Total task relationships:', totalRelationships);
```

**Check 3: No Data Loss**

Compare entity counts before/after:

```typescript
// Before migration
const taskCountBefore = tasks.length;

// After migration
const tasksAfter = await storage.load<Task[]>('tasks');
const taskCountAfter = tasksAfter.length;

console.log('Data preserved:', taskCountBefore === taskCountAfter);
```

---

## Rollback

If something goes wrong, you can rollback to the pre-migration state.

### Automatic Rollback

The migration automatically rolls back if:
- Storage transaction fails
- Catastrophic error occurs during migration

### Manual Rollback

```typescript
import { RelationshipMigrationService } from '@/services/relationshipMigration';

const migrationService = new RelationshipMigrationService();

// Use the backupId from the migration report
await migrationService.rollback(report.backupId);
```

### Via UI

1. Open Settings → Data → Migration
2. Click "View Backups"
3. Select the backup from before migration
4. Click "Restore Backup"

**Note**: Rollback restores the **exact** state from before migration. Any changes made after migration will be lost.

---

## Common Issues

### Issue: "Duplicate entity ID"

**Cause**: Your data has duplicate entity IDs (should never happen)
**Solution**: Contact support or manually fix in data export

### Issue: "Migration already ran"

**Cause**: Entities already have `relationshipVersion: 1`
**Solution**: Migration is idempotent - safe to run again (it will skip already-migrated entities)

### Issue: "Transaction commit failed"

**Cause**: Storage system error during save
**Solution**: Migration auto-rolls back. Check storage system and retry.

### Issue: "Many orphaned references"

**Cause**: You've deleted many entities that were referenced by others
**Solution**: This is just a warning. Orphaned references are reported but don't block migration.

---

## FAQ

### Q: Will migration delete any of my data?

**A**: No. Migration preserves 100% of your data. Legacy fields remain in place, and new relationships are added alongside them.

### Q: Can I run migration multiple times?

**A**: Yes. Migration is **idempotent** - running it multiple times is safe. Already-migrated entities (with `relationshipVersion: 1`) are skipped.

### Q: What if I cancel mid-migration?

**A**: If you cancel before the final "Saving Changes" step, no data is modified. If you cancel during save, the transaction rolls back automatically.

### Q: How long does migration take?

**A**: Typically <30 seconds for most users. Large datasets (10k+ entities) may take up to 1 minute.

### Q: Will my app work during migration?

**A**: No. The app should not be used during migration (UI prevents this). Migration runs quickly, so downtime is minimal.

### Q: What happens to orphaned references?

**A**: They're detected, reported, and left in legacy fields. They are NOT converted to relationships (since the target doesn't exist).

### Q: Can I still use legacy fields after migration?

**A**: Yes. Legacy fields are preserved for backward compatibility. However, new code should use the `relationships[]` array.

### Q: When will legacy fields be removed?

**A**: Not before Taskerino 3.0 (earliest). We'll provide plenty of warning before removal.

---

## Support

If you encounter issues during migration:

1. **Check the migration report** for detailed error messages
2. **Review orphaned references** - these are usually harmless warnings
3. **Try dry run first** to identify issues before real migration
4. **Rollback if needed** using the backup created before migration

For additional help:
- GitHub Issues: https://github.com/yourusername/taskerino/issues
- Discord: https://discord.gg/taskerino

---

## Technical Details

For developers who want to understand the migration internals:

### Relationship Schema

```typescript
interface Relationship {
  id: string;                      // Unique relationship ID
  type: RelationshipType;          // e.g., "task-note", "note-topic"
  sourceType: EntityType;          // e.g., "task", "note"
  sourceId: string;                // Source entity ID
  targetType: EntityType;          // e.g., "note", "topic"
  targetId: string;                // Target entity ID
  metadata: {
    source: 'ai' | 'manual' | 'migration' | 'system';
    createdAt: string;             // ISO 8601 timestamp
    confidence?: number;           // AI confidence (0-1)
    reasoning?: string;            // AI reasoning
  };
  canonical: boolean;              // Is this the primary direction?
}
```

### Migration Algorithm

1. **Load all entities** (tasks, notes, sessions)
2. **Create entity maps** for O(1) lookups during validation
3. **For each entity**:
   - Skip if `relationshipVersion === 1`
   - For each legacy field:
     - Validate target entity exists
     - If exists: Create `Relationship` object
     - If missing: Report as orphaned reference
   - Set `relationshipVersion = 1`
   - Add all relationships to `relationships[]` array
4. **Validate bidirectional consistency**
5. **Commit all changes atomically**

### Atomic Transactions

The migration uses **atomic transactions** to ensure data integrity:

```typescript
const tx = await storage.beginTransaction();
try {
  tx.save('tasks', migratedTasks);
  tx.save('notes', migratedNotes);
  tx.save('sessions', migratedSessions);
  await tx.commit();  // All succeed or all fail
} catch (error) {
  await tx.rollback();  // Restore original state
  throw error;
}
```

This guarantees no partial state - your data is either fully migrated or unchanged.

---

**End of Migration Guide**
