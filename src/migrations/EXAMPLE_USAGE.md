# Migration Usage Examples

## Quick Start

### Step 1: Test with Dry Run

Open your browser console and run:

```javascript
// Test migration without making any changes
await runEnrichmentMigration({ dryRun: true, verbose: true });
```

Expected output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Enrichment Status Migration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  DRY RUN MODE - No changes will be saved

🔄 Starting enrichment status migration...
⏭️  Skipping backup (dry run)
📊 Found 15 sessions to process
  ✅ Migrated session-1: { status: 'completed', progress: '100%', ... }
  ✅ Migrated session-2: { status: 'partial', progress: '40%', ... }
  ...
⏭️  Skipping save (dry run)
✅ Migration completed: { migrated: 15, skipped: 0, errors: 0 }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Migration Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: ✅ Success
Migrated: 15
Skipped: 0
Errors: 0

✅ Dry run completed successfully!

💡 To apply changes, run without dryRun flag:
   runEnrichmentMigration({ verbose: true })
```

### Step 2: Apply Migration

If dry run looks good:

```javascript
// Apply the migration
await runEnrichmentMigration({ verbose: true });
```

Expected output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Enrichment Status Migration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 Starting enrichment status migration...
📊 Found 15 sessions to process
💾 Created backup: sessions-backup-enrichment-migration-2025-10-14T19-30-00-000Z
  ✅ Migrated session-1: { status: 'completed', progress: '100%', ... }
  ✅ Migrated session-2: { status: 'partial', progress: '40%', ... }
  ...
💾 Saved migrated sessions to storage
✅ Migration completed: { migrated: 15, skipped: 0, errors: 0 }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Migration Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: ✅ Success
Migrated: 15
Skipped: 0
Errors: 0
Backup: sessions-backup-enrichment-migration-2025-10-14T19-30-00-000Z

✅ Migration completed successfully!

💡 If something went wrong, you can rollback using:
   rollbackEnrichmentMigration('sessions-backup-enrichment-migration-2025-10-14T19-30-00-000Z', true)
```

### Step 3: Verify

Check migration status:

```javascript
await showMigrationStatus();
```

Expected output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Migration Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Completed: ✅ Yes
Timestamp: 2025-10-14T19:30:00.000Z
Migrated: 15
Skipped: 0
Total: 15
Backup: sessions-backup-enrichment-migration-2025-10-14T19-30-00-000Z

💡 To rollback:
   rollbackEnrichmentMigration('sessions-backup-enrichment-migration-2025-10-14T19-30-00-000Z', true)
```

## Rollback Example

If something goes wrong:

```javascript
// Rollback requires confirmation (safety feature)
await rollbackEnrichmentMigration('sessions-backup-enrichment-migration-2025-10-14T19-30-00-000Z', true);
```

Expected output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Rollback Migration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  This will restore sessions from backup:
   sessions-backup-enrichment-migration-2025-10-14T19-30-00-000Z

🔄 Rolling back migration from backup: sessions-backup-enrichment-migration-2025-10-14T19-30-00-000Z
📦 Found backup with 15 sessions from 2025-10-14T19:30:00.000Z
✅ Restored sessions from backup
✅ Cleared migration status
✅ Rollback completed successfully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Rollback completed successfully!

💡 Refresh the app to see the restored data.
```

## Programmatic Usage

### In Your Application Code

```typescript
import { migrateSessionsToEnrichmentV1 } from './migrations';

async function runMigration() {
  const result = await migrateSessionsToEnrichmentV1({
    dryRun: false,
    verbose: true,
    onProgress: (message, progress) => {
      console.log(`[${progress}%] ${message}`);
      // Update UI progress bar here
    },
  });

  if (result.success) {
    console.log('Migration successful!');
    console.log(`Migrated: ${result.migratedCount}`);
    console.log(`Skipped: ${result.skippedCount}`);

    // Save backup path for potential rollback
    if (result.backupPath) {
      localStorage.setItem('lastMigrationBackup', result.backupPath);
    }
  } else {
    console.error('Migration failed:', result.errors);
    // Show error to user
  }
}
```

### With React Component

```typescript
import React, { useState } from 'react';
import { migrateSessionsToEnrichmentV1, type MigrationResult } from './migrations';

function MigrationButton() {
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<MigrationResult | null>(null);

  const handleMigrate = async () => {
    setMigrating(true);
    setProgress(0);

    const migrationResult = await migrateSessionsToEnrichmentV1({
      dryRun: false,
      verbose: true,
      onProgress: (message, prog) => {
        setProgress(prog);
        console.log(message);
      },
    });

    setResult(migrationResult);
    setMigrating(false);
  };

  return (
    <div>
      <button onClick={handleMigrate} disabled={migrating}>
        {migrating ? `Migrating... ${progress}%` : 'Run Migration'}
      </button>

      {result && (
        <div>
          {result.success ? (
            <p>✅ Migrated {result.migratedCount} sessions</p>
          ) : (
            <p>❌ Migration failed: {result.errors.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

## Edge Cases

### Case 1: Session with Audio Review Completed

**Input Session:**
```typescript
{
  id: 'session-1',
  name: 'Morning Work Session',
  audioReviewCompleted: true,
  fullAudioAttachmentId: 'audio-123',
  audioInsights: { /* ... */ },
  summary: { /* ... */ },
  // ... other fields
}
```

**After Migration:**
```typescript
{
  // All original fields preserved
  id: 'session-1',
  name: 'Morning Work Session',
  audioReviewCompleted: true,
  fullAudioAttachmentId: 'audio-123',
  audioInsights: { /* ... */ },
  summary: { /* ... */ },

  // New fields added
  enrichmentStatus: {
    status: 'completed',
    progress: 100,
    currentStage: 'complete',
    audio: {
      status: 'completed',
      completedAt: '2025-10-14T12:00:00.000Z',
      cost: 0,
    },
    video: {
      status: 'skipped',
      cost: 0,
    },
    summary: {
      status: 'completed',
    },
    totalCost: 0,
    errors: [],
    warnings: [],
    canResume: false,
  },
  enrichmentConfig: {
    includeAudioReview: true,
    includeVideoChapters: true,
    autoEnrichOnComplete: false,
    maxCostThreshold: 10.0,
  },
}
```

### Case 2: Session with Partial Enrichment

**Input Session:**
```typescript
{
  id: 'session-2',
  name: 'Coding Session',
  audioReviewCompleted: true,
  fullAudioAttachmentId: 'audio-456',
  audioInsights: { /* ... */ },
  // No summary, no video
}
```

**After Migration:**
```typescript
{
  // All original fields preserved
  id: 'session-2',
  name: 'Coding Session',
  audioReviewCompleted: true,
  fullAudioAttachmentId: 'audio-456',
  audioInsights: { /* ... */ },

  // New fields added
  enrichmentStatus: {
    status: 'partial',
    progress: 40,  // Only audio (40%) is complete
    currentStage: 'summary',  // Next stage to process
    audio: {
      status: 'completed',
      completedAt: '2025-10-14T12:00:00.000Z',
      cost: 0,
    },
    video: {
      status: 'skipped',
      cost: 0,
    },
    summary: {
      status: 'pending',
    },
    totalCost: 0,
    errors: [],
    warnings: [],
    canResume: true,  // Can resume enrichment
  },
  enrichmentConfig: {
    includeAudioReview: true,
    includeVideoChapters: true,
    autoEnrichOnComplete: false,
    maxCostThreshold: 10.0,
  },
}
```

### Case 3: Fresh Session (No Enrichment)

**Input Session:**
```typescript
{
  id: 'session-3',
  name: 'New Session',
  status: 'completed',
  endTime: '2025-10-14T12:00:00.000Z',
  // No audio review, no video, no summary
}
```

**After Migration:**
```typescript
{
  // All original fields preserved
  id: 'session-3',
  name: 'New Session',
  status: 'completed',
  endTime: '2025-10-14T12:00:00.000Z',

  // New fields added
  enrichmentStatus: {
    status: 'idle',
    progress: 0,
    currentStage: 'audio',  // First stage to process
    audio: {
      status: 'pending',
      cost: 0,
    },
    video: {
      status: 'pending',
      cost: 0,
    },
    summary: {
      status: 'pending',
    },
    totalCost: 0,
    errors: [],
    warnings: [],
    canResume: false,  // Nothing to resume
  },
  enrichmentConfig: {
    includeAudioReview: true,
    includeVideoChapters: true,
    autoEnrichOnComplete: false,
    maxCostThreshold: 10.0,
  },
}
```

## Troubleshooting

### Already Migrated

```javascript
await runEnrichmentMigration();
// Output: ℹ️  Migration already completed
```

**Solution:** Check status first, rollback if needed to re-run

```javascript
await showMigrationStatus();
// Shows when migration was completed

// If you need to re-run:
await rollbackEnrichmentMigration('backup-path-here', true);
await runEnrichmentMigration();
```

### Migration Fails Halfway

The migration is designed to handle partial failures:

- ✅ Sessions successfully migrated are saved
- ✅ Failed sessions keep their original data
- ✅ Errors are logged in the result
- ✅ You can review and fix issues, then re-run

```javascript
const result = await runEnrichmentMigration({ verbose: true });

if (!result.success) {
  console.log('Failed sessions:', result.errors);

  // Review errors, fix data issues, then re-run
  // The migration will skip already-migrated sessions
}
```

### Rollback Accidentally Confirmed

No problem! Just run the migration again:

```javascript
// Oops, rolled back by accident
await rollbackEnrichmentMigration('backup-path', true);

// Just run migration again
await runEnrichmentMigration({ verbose: true });
```

## Best Practices

1. **Always test with dry run first**
   ```javascript
   await runEnrichmentMigration({ dryRun: true, verbose: true });
   ```

2. **Keep backup paths**
   ```javascript
   const result = await runEnrichmentMigration();
   console.log('Backup:', result.backupPath);
   // Save this somewhere safe!
   ```

3. **Monitor progress in production**
   ```javascript
   await runEnrichmentMigration({
     verbose: true,
     onProgress: (msg, prog) => {
       // Log to monitoring service
       console.log(`[${prog}%] ${msg}`);
     },
   });
   ```

4. **Handle errors gracefully**
   ```javascript
   try {
     const result = await runEnrichmentMigration();
     if (!result.success) {
       // Alert user, but app continues to work
       alert('Migration had some issues, but your data is safe');
     }
   } catch (error) {
     // Critical error, show user
     console.error('Migration failed completely:', error);
   }
   ```
