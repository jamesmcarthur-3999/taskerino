/**
 * Migration Runner Script
 *
 * Simple CLI tool to run the enrichment status migration.
 * Can be executed in the browser console or as a standalone script.
 *
 * Usage in browser console:
 * ```
 * import { runEnrichmentMigration } from './migrations/runMigration';
 * await runEnrichmentMigration({ dryRun: true, verbose: true });
 * ```
 */

import {
  migrateSessionsToEnrichmentV1,
  rollbackMigration,
  getMigrationStatus,
  isMigrationCompleted,
  type MigrationResult,
} from './addEnrichmentStatus';

/**
 * Run enrichment migration with progress logging
 */
export async function runEnrichmentMigration(options: {
  dryRun?: boolean;
  verbose?: boolean;
} = {}): Promise<MigrationResult> {
  const { dryRun = false, verbose = false } = options;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Enrichment Status Migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be saved');
    console.log('');
  }

  // Check if already migrated
  const alreadyMigrated = await isMigrationCompleted();
  if (alreadyMigrated) {
    const status = await getMigrationStatus();
    console.log('ℹ️  Migration already completed:');
    console.log('  Timestamp:', status?.timestamp);
    console.log('  Migrated:', status?.migratedCount);
    console.log('  Skipped:', status?.skippedCount);
    console.log('  Total:', status?.totalCount);
    console.log('');
    console.log('💡 To re-run migration, first rollback or clear migration status.');
    console.log('');

    return {
      success: true,
      migratedCount: 0,
      skippedCount: 0,
      errors: ['Migration already completed'],
    };
  }

  // Run migration with progress callback
  let lastProgress = 0;
  const result = await migrateSessionsToEnrichmentV1({
    dryRun,
    verbose,
    onProgress: (message, progress) => {
      if (progress - lastProgress >= 10 || progress === 100) {
        console.log(`[${progress}%] ${message}`);
        lastProgress = progress;
      }
    },
  });

  // Print results
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Migration Results');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Status:', result.success ? '✅ Success' : '❌ Failed');
  console.log('Migrated:', result.migratedCount);
  console.log('Skipped:', result.skippedCount);
  console.log('Errors:', result.errors.length);

  if (result.backupPath) {
    console.log('Backup:', result.backupPath);
  }

  if (result.errors.length > 0) {
    console.log('');
    console.log('Errors:');
    result.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
  }

  console.log('');

  if (result.success && !dryRun) {
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('💡 If something went wrong, you can rollback using:');
    console.log(`   rollbackEnrichmentMigration('${result.backupPath}')`);
  } else if (dryRun) {
    console.log('✅ Dry run completed successfully!');
    console.log('');
    console.log('💡 To apply changes, run without dryRun flag:');
    console.log('   runEnrichmentMigration({ verbose: true })');
  } else {
    console.log('❌ Migration failed. See errors above.');
    console.log('');
    console.log('💡 Your data has not been changed.');
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  return result;
}

/**
 * Rollback migration with confirmation
 */
export async function rollbackEnrichmentMigration(
  backupPath: string,
  confirm: boolean = false
): Promise<boolean> {
  if (!confirm) {
    console.error('⚠️  Rollback requires confirmation!');
    console.log('');
    console.log('💡 To confirm rollback, call:');
    console.log(`   rollbackEnrichmentMigration('${backupPath}', true)`);
    console.log('');
    return false;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Rollback Migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('⚠️  This will restore sessions from backup:');
  console.log(`   ${backupPath}`);
  console.log('');

  const success = await rollbackMigration(backupPath);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  if (success) {
    console.log('✅ Rollback completed successfully!');
    console.log('');
    console.log('💡 Refresh the app to see the restored data.');
  } else {
    console.log('❌ Rollback failed. See errors above.');
  }

  console.log('');

  return success;
}

/**
 * Show migration status
 */
export async function showMigrationStatus(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Migration Status');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const status = await getMigrationStatus();

  if (!status) {
    console.log('ℹ️  No migration has been run yet.');
    console.log('');
    console.log('💡 To run migration:');
    console.log('   runEnrichmentMigration({ dryRun: true })  // Test first');
    console.log('   runEnrichmentMigration()                 // Apply changes');
  } else {
    console.log('Completed:', status.completed ? '✅ Yes' : '❌ No');
    console.log('Timestamp:', status.timestamp || 'N/A');
    console.log('Migrated:', status.migratedCount || 0);
    console.log('Skipped:', status.skippedCount || 0);
    console.log('Total:', status.totalCount || 0);
    if (status.backupPath) {
      console.log('Backup:', status.backupPath);
      console.log('');
      console.log('💡 To rollback:');
      console.log(`   rollbackEnrichmentMigration('${status.backupPath}', true)`);
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

// Make functions available globally in development
if (typeof window !== 'undefined') {
  (window as any).runEnrichmentMigration = runEnrichmentMigration;
  (window as any).rollbackEnrichmentMigration = rollbackEnrichmentMigration;
  (window as any).showMigrationStatus = showMigrationStatus;
}
