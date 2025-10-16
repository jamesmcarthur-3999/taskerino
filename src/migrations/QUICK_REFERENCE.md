# Enrichment Status Migration - Quick Reference

## Quick Commands (Browser Console)

### Run Migration

```javascript
// Test first (recommended)
await runEnrichmentMigration({ dryRun: true, verbose: true });

// Apply changes
await runEnrichmentMigration({ verbose: true });
```

### Check Status

```javascript
await showMigrationStatus();
```

### Rollback

```javascript
// Get backup path from status, then:
await rollbackEnrichmentMigration('backup-path-here', true);
```

## Migration Result

```typescript
{
  success: boolean;           // Did it work?
  migratedCount: number;      // How many sessions migrated
  skippedCount: number;       // How many already done
  errors: string[];           // Any errors
  backupPath?: string;        // For rollback
}
```

## What Gets Added to Sessions

### enrichmentStatus

```typescript
{
  status: 'idle' | 'partial' | 'completed',  // Overall status
  progress: 0-100,                           // Percentage complete
  currentStage: 'audio' | 'video' | 'summary' | 'complete',

  audio: {
    status: 'pending' | 'completed' | 'skipped',
    cost: 0  // USD
  },

  video: {
    status: 'pending' | 'completed' | 'skipped',
    cost: 0  // USD
  },

  summary: {
    status: 'pending' | 'completed'
  },

  totalCost: 0,    // USD
  errors: [],
  warnings: [],
  canResume: boolean
}
```

### enrichmentConfig

```typescript
{
  includeAudioReview: true,      // Enable audio review
  includeVideoChapters: true,    // Enable video chapters
  autoEnrichOnComplete: false,   // Manual trigger only
  maxCostThreshold: 10.0        // Max $10 per enrichment
}
```

## Detection Logic

| Legacy Field | New Status |
|-------------|------------|
| `audioReviewCompleted: true` | `audio.status: 'completed'` |
| `video.chapters` exists | `video.status: 'completed'` |
| `summary` exists | `summary.status: 'completed'` |

## Overall Status

| Condition | Status |
|-----------|--------|
| Nothing enriched | `idle` |
| Some enrichment done | `partial` |
| All enrichment done | `completed` |

## Progress Calculation

- Audio: 40% of total
- Video: 30% of total
- Summary: 30% of total

## Safety Features

✅ Automatic backup before changes
✅ Dry-run mode
✅ Rollback capability
✅ Data validation
✅ Error isolation

## Common Issues

### Already Migrated

```javascript
// Check when it was done
await showMigrationStatus();

// To re-run, first rollback
await rollbackEnrichmentMigration('backup-path', true);
```

### Migration Failed

```javascript
// Check errors
const result = await runEnrichmentMigration({ verbose: true });
console.log(result.errors);

// Your data is safe - originals preserved
```

### Need to Rollback

```javascript
// Requires confirmation (safety)
await rollbackEnrichmentMigration('backup-path', true);

// Then refresh app
window.location.reload();
```

## Best Practices

1. ✅ Always dry-run first
2. ✅ Keep backup path safe
3. ✅ Monitor progress
4. ✅ Verify results
5. ✅ Test enrichment pipeline

## Files Created

- `addEnrichmentStatus.ts` - Core migration logic
- `runMigration.ts` - CLI interface
- `index.ts` - Public API
- `README.md` - Full documentation
- `EXAMPLE_USAGE.md` - Examples
- `MIGRATION_SUMMARY.md` - Detailed summary
- `QUICK_REFERENCE.md` - This file

## Need Help?

1. Check `README.md` for full docs
2. Check `EXAMPLE_USAGE.md` for examples
3. Review error messages
4. Check browser console logs
