# Migrations

Production-grade database migrations for Taskerino.

## Enrichment Status Migration (V1)

Adds `enrichmentStatus` and `enrichmentConfig` fields to all existing sessions for backward compatibility with the new enrichment pipeline.

### Features

- **Automatic Backup**: Creates timestamped backup before any changes
- **Dry Run Mode**: Test migration without making changes
- **Rollback Capability**: Restore from backup if needed
- **Progress Tracking**: Real-time progress updates
- **Comprehensive Validation**: Validates all migrated data
- **Error Recovery**: Handles errors gracefully, preserves original data
- **Smart Detection**: Detects existing enrichment state from legacy fields

### Usage

#### Option 1: Browser Console (Recommended)

1. Open your app in the browser
2. Open DevTools Console (F12)
3. Run migration commands:

```javascript
// Test migration first (dry run - no changes)
await runEnrichmentMigration({ dryRun: true, verbose: true });

// If dry run looks good, apply changes
await runEnrichmentMigration({ verbose: true });

// Check status
await showMigrationStatus();

// Rollback if needed (requires confirmation)
await rollbackEnrichmentMigration('backup-path-here', true);
```

#### Option 2: Programmatic Usage

```typescript
import {
  migrateSessionsToEnrichmentV1,
  rollbackMigration,
  getMigrationStatus,
} from './migrations/addEnrichmentStatus';

// Run migration
const result = await migrateSessionsToEnrichmentV1({
  dryRun: false,
  verbose: true,
  onProgress: (message, progress) => {
    console.log(`[${progress}%] ${message}`);
  },
});

if (result.success) {
  console.log(`Migrated ${result.migratedCount} sessions`);
} else {
  console.error('Migration failed:', result.errors);
}

// Rollback if needed
if (result.backupPath) {
  await rollbackMigration(result.backupPath);
}
```

### Migration Logic

#### 1. Detection of Existing Enrichment State

For each session, the migration detects the current enrichment state:

**Audio Review:**
- ✅ Completed: If `audioReviewCompleted === true`
- ⏳ Pending: Otherwise

**Video Chapters:**
- ✅ Completed: If `video.chapters` exists and has items
- ⏭️ Skipped: Otherwise (no video)

**Summary:**
- ✅ Exists: If `summary` field is present
- ⏳ Pending: Otherwise

#### 2. Overall Status Determination

- **Idle**: Nothing has been enriched yet
- **Partial**: Some enrichment completed (e.g., audio done, video pending)
- **Completed**: All applicable enrichment completed

#### 3. Progress Calculation

- Audio Review: 40% of total enrichment
- Video Chapters: 30% of total enrichment
- Summary Generation: 30% of total enrichment

#### 4. Default Configuration

All sessions receive safe default enrichment configuration:

```typescript
{
  includeAudioReview: true,      // Enable audio review
  includeVideoChapters: true,    // Enable video chapters
  autoEnrichOnComplete: false,   // Don't auto-enrich (user must trigger)
  maxCostThreshold: 10.0         // Max $10 per enrichment
}
```

### Safety Features

1. **Backup Before Migration**: Creates timestamped backup before any changes
2. **Dry Run Mode**: Test migration without saving (`dryRun: true`)
3. **Validation**: Validates each migrated session
4. **Error Isolation**: One session failing doesn't stop the entire migration
5. **Data Preservation**: Original sessions preserved if validation fails
6. **Rollback**: Can restore from backup at any time

### Migration Result

```typescript
{
  success: boolean;           // Overall success/failure
  migratedCount: number;      // Number of sessions migrated
  skippedCount: number;       // Number already migrated (skipped)
  errors: string[];           // Array of error messages
  backupPath?: string;        // Path to backup (for rollback)
  dryRun?: boolean;          // Whether this was a dry run
}
```

### Validation Rules

Each migrated session must have:

1. ✅ `enrichmentStatus` object with:
   - Valid `status` ('idle' | 'pending' | 'in-progress' | 'completed' | 'failed' | 'partial')
   - Valid `progress` (0-100)
   - Valid `currentStage` ('audio' | 'video' | 'summary' | 'complete')
   - Valid stage objects (`audio`, `video`, `summary`)
   - Valid stage statuses

2. ✅ `enrichmentConfig` object with:
   - Boolean `includeAudioReview`
   - Boolean `includeVideoChapters`
   - Boolean `autoEnrichOnComplete`
   - Optional number `maxCostThreshold`

### Backward Compatibility

The migration preserves all existing session fields and adds new ones:

- ✅ All existing fields preserved
- ✅ Legacy fields kept (`audioReviewCompleted`, `video.chapters`, etc.)
- ✅ New fields added (`enrichmentStatus`, `enrichmentConfig`)
- ✅ Cost set to 0 for legacy sessions (unknown)
- ✅ Timestamps inferred from session `endTime` if available

### Troubleshooting

**Migration already completed:**
```javascript
// Check status
await showMigrationStatus();

// To re-run, first rollback:
await rollbackEnrichmentMigration('backup-path', true);

// Then run again:
await runEnrichmentMigration();
```

**Migration failed:**
```javascript
// Check the error messages in the result
const result = await runEnrichmentMigration({ verbose: true });
console.log(result.errors);

// Your data is safe - original sessions are preserved
```

**Need to rollback:**
```javascript
// Get backup path from migration status
await showMigrationStatus();

// Rollback (requires confirmation)
await rollbackEnrichmentMigration('sessions-backup-enrichment-migration-2025-10-14T12-30-00-000Z', true);
```

### Testing

Always test with dry run first:

```javascript
// 1. Test migration (no changes)
const dryRunResult = await runEnrichmentMigration({
  dryRun: true,
  verbose: true
});

// 2. Review results
console.log('Would migrate:', dryRunResult.migratedCount);
console.log('Would skip:', dryRunResult.skippedCount);
console.log('Errors:', dryRunResult.errors);

// 3. If looks good, apply changes
if (dryRunResult.success && dryRunResult.errors.length === 0) {
  await runEnrichmentMigration({ verbose: true });
}
```

## Future Migrations

Add new migrations here following the same pattern:

1. Create migration file: `src/migrations/yourMigration.ts`
2. Implement required interfaces:
   - `MigrationResult`
   - Main migration function
   - Rollback function
3. Add comprehensive logging and error handling
4. Create backup before changes
5. Validate all migrated data
6. Document in this README
