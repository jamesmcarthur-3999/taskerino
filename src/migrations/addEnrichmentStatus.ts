/**
 * Session Enrichment Status Migration
 *
 * Production-grade migration to add enrichmentStatus and enrichmentConfig
 * to all existing sessions with backward compatibility and safety features.
 *
 * Features:
 * - Automatic backup before migration
 * - Dry-run mode for safe testing
 * - Rollback capability
 * - Comprehensive error handling and logging
 * - Progress tracking and reporting
 * - Validation of migrated data
 * - Detection of existing enrichment fields
 */

import { getStorage } from '../services/storage';
import type { Session } from '../types';

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
  backupPath?: string;
  dryRun?: boolean;
}

export interface MigrationOptions {
  dryRun?: boolean;
  verbose?: boolean;
  onProgress?: (message: string, progress: number) => void;
}

const MIGRATION_BACKUP_PREFIX = 'sessions-backup-enrichment-migration';
const MIGRATION_STATUS_KEY = 'migration-enrichment-status-v1';

/**
 * Detect the current enrichment state of a session based on legacy fields
 */
function detectEnrichmentState(session: Session): {
  audioStatus: 'completed' | 'pending';
  videoStatus: 'completed' | 'skipped';
  audioCost: number;
  videoCost: number;
} {
  // Audio Review: Check if audioReviewCompleted flag is set
  const audioStatus = session.audioReviewCompleted ? 'completed' : 'pending';
  const audioCost = 0; // Unknown for legacy sessions

  // Video Chapters: Check if video.chapters exists and has items
  const hasVideoChapters = session.video?.chapters && session.video.chapters.length > 0;
  const videoStatus = hasVideoChapters ? 'completed' : 'skipped';
  const videoCost = 0; // Unknown for legacy sessions

  return {
    audioStatus,
    videoStatus,
    audioCost,
    videoCost,
  };
}

/**
 * Determine overall enrichment status based on individual stage statuses
 */
function determineOverallStatus(
  audioStatus: string,
  videoStatus: string,
  summaryExists: boolean
): 'idle' | 'completed' | 'partial' {
  // If nothing is done, it's idle
  if (audioStatus === 'pending' && videoStatus === 'skipped' && !summaryExists) {
    return 'idle';
  }

  // If everything that should be done is completed
  const audioComplete = audioStatus === 'completed';
  const videoComplete = videoStatus === 'completed' || videoStatus === 'skipped';
  const summaryComplete = summaryExists;

  if (audioComplete && videoComplete && summaryComplete) {
    return 'completed';
  }

  // Otherwise, it's partial (some enrichment has been done)
  return 'partial';
}

/**
 * Check if a session already has enrichment status fields
 */
function hasEnrichmentStatus(session: Session): boolean {
  return session.enrichmentStatus !== undefined;
}

/**
 * Validate a migrated session
 */
function validateMigratedSession(session: Session): { valid: boolean; error?: string } {
  // Must have enrichmentStatus
  if (!session.enrichmentStatus) {
    return { valid: false, error: 'Missing enrichmentStatus' };
  }

  const status = session.enrichmentStatus;

  // Validate required fields
  if (!status.status) {
    return { valid: false, error: 'Missing enrichmentStatus.status' };
  }

  if (typeof status.progress !== 'number' || status.progress < 0 || status.progress > 100) {
    return { valid: false, error: 'Invalid enrichmentStatus.progress' };
  }

  if (!status.currentStage) {
    return { valid: false, error: 'Missing enrichmentStatus.currentStage' };
  }

  // Validate stage objects
  if (!status.audio || !status.video || !status.summary) {
    return { valid: false, error: 'Missing stage status objects' };
  }

  // Validate stage status values
  const validStageStatuses = ['pending', 'processing', 'completed', 'failed', 'skipped'];
  if (!validStageStatuses.includes(status.audio.status)) {
    return { valid: false, error: 'Invalid audio.status' };
  }
  if (!validStageStatuses.includes(status.video.status)) {
    return { valid: false, error: 'Invalid video.status' };
  }
  if (!validStageStatuses.includes(status.summary.status)) {
    return { valid: false, error: 'Invalid summary.status' };
  }

  // Must have enrichmentConfig
  if (!session.enrichmentConfig) {
    return { valid: false, error: 'Missing enrichmentConfig' };
  }

  const config = session.enrichmentConfig;

  // Validate config fields
  if (typeof config.includeAudioReview !== 'boolean') {
    return { valid: false, error: 'Invalid enrichmentConfig.includeAudioReview' };
  }
  if (typeof config.includeVideoChapters !== 'boolean') {
    return { valid: false, error: 'Invalid enrichmentConfig.includeVideoChapters' };
  }
  if (typeof config.autoEnrichOnComplete !== 'boolean') {
    return { valid: false, error: 'Invalid enrichmentConfig.autoEnrichOnComplete' };
  }

  return { valid: true };
}

/**
 * Migrate a single session to add enrichment status fields
 */
function migrateSession(session: Session, verbose: boolean = false): Session {
  // Skip if already has enrichment status
  if (hasEnrichmentStatus(session)) {
    if (verbose) {
      console.log(`  ⏭️  Skipping session ${session.id} - already has enrichmentStatus`);
    }
    return session;
  }

  // Detect enrichment state from legacy fields
  const { audioStatus, videoStatus, audioCost, videoCost } = detectEnrichmentState(session);
  const summaryExists = session.summary !== undefined;
  const overallStatus = determineOverallStatus(audioStatus, videoStatus, summaryExists);

  // Calculate progress
  let progress = 0;
  if (audioStatus === 'completed') progress += 40; // Audio is 40% of enrichment
  if (videoStatus === 'completed') progress += 30; // Video is 30% of enrichment
  if (summaryExists) progress += 30; // Summary is 30% of enrichment

  // Determine current stage
  let currentStage: 'audio' | 'video' | 'summary' | 'complete' = 'complete';
  if (overallStatus === 'idle') {
    currentStage = 'audio';
  } else if (overallStatus === 'partial') {
    if (audioStatus !== 'completed') {
      currentStage = 'audio';
    } else if (videoStatus !== 'completed' && videoStatus !== 'skipped') {
      currentStage = 'video';
    } else {
      currentStage = 'summary';
    }
  }

  // Create enrichmentStatus
  const enrichmentStatus: Session['enrichmentStatus'] = {
    status: overallStatus,
    progress,
    currentStage,
    audio: {
      status: audioStatus,
      cost: audioCost,
    },
    video: {
      status: videoStatus,
      cost: videoCost,
    },
    summary: {
      status: summaryExists ? 'completed' : 'pending',
    },
    totalCost: audioCost + videoCost,
    errors: [],
    warnings: [],
    canResume: overallStatus === 'partial',
  };

  // Add timestamps if enrichment was completed
  if (audioStatus === 'completed' && session.audioReviewCompleted) {
    // We don't have exact timestamps for legacy sessions, use session endTime or current time
    const timestamp = session.endTime || new Date().toISOString();
    enrichmentStatus.audio.completedAt = timestamp;
    if (!enrichmentStatus.startedAt) {
      enrichmentStatus.startedAt = timestamp;
    }
  }

  if (videoStatus === 'completed' && session.video?.chapters) {
    const timestamp = session.endTime || new Date().toISOString();
    enrichmentStatus.video.completedAt = timestamp;
    if (!enrichmentStatus.startedAt) {
      enrichmentStatus.startedAt = timestamp;
    }
  }

  if (overallStatus === 'completed') {
    enrichmentStatus.completedAt = session.endTime || new Date().toISOString();
  }

  // Create enrichmentConfig with safe defaults
  const enrichmentConfig: Session['enrichmentConfig'] = {
    includeAudioReview: true,
    includeVideoChapters: true,
    autoEnrichOnComplete: false,
    maxCostThreshold: 10.0,
  };

  if (verbose) {
    console.log(`  ✅ Migrated session ${session.id}:`, {
      status: overallStatus,
      progress: `${progress}%`,
      audio: audioStatus,
      video: videoStatus,
      summary: summaryExists ? 'exists' : 'pending',
    });
  }

  // Return migrated session (preserve all existing fields)
  return {
    ...session,
    enrichmentStatus,
    enrichmentConfig,
  };
}

/**
 * Main migration function - migrates all sessions to enrichment V1
 */
export async function migrateSessionsToEnrichmentV1(
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const { dryRun = false, verbose = false, onProgress } = options;

  const result: MigrationResult = {
    success: false,
    migratedCount: 0,
    skippedCount: 0,
    errors: [],
    dryRun,
  };

  try {
    // Step 1: Load sessions from storage
    onProgress?.('Loading sessions from storage...', 0);
    console.log('🔄 Starting enrichment status migration...');
    if (dryRun) {
      console.log('⚠️  DRY RUN MODE - No changes will be saved');
    }

    const storage = await getStorage();
    const sessions = await storage.load<Session[]>('sessions');

    if (!sessions || !Array.isArray(sessions)) {
      console.log('ℹ️  No sessions found in storage');
      result.success = true;
      return result;
    }

    console.log(`📊 Found ${sessions.length} sessions to process`);

    // Step 2: Create backup
    if (!dryRun) {
      onProgress?.('Creating backup...', 5);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupKey = `${MIGRATION_BACKUP_PREFIX}-${timestamp}`;

      try {
        await storage.save(backupKey, {
          timestamp,
          sessions,
          count: sessions.length,
        });
        result.backupPath = backupKey;
        console.log(`💾 Created backup: ${backupKey}`);
      } catch (backupError) {
        const errorMsg = `Failed to create backup: ${backupError}`;
        console.error(`❌ ${errorMsg}`);
        result.errors.push(errorMsg);
        return result;
      }
    } else {
      console.log('⏭️  Skipping backup (dry run)');
    }

    // Step 3: Migrate each session
    onProgress?.('Migrating sessions...', 10);
    const migratedSessions: Session[] = [];
    let processedCount = 0;

    for (const session of sessions) {
      try {
        // Check if already has enrichment status
        if (hasEnrichmentStatus(session)) {
          result.skippedCount++;
          migratedSessions.push(session);
          if (verbose) {
            console.log(`  ⏭️  Skipped ${session.name || session.id} (already migrated)`);
          }
          continue;
        }

        // Migrate the session
        const migratedSession = migrateSession(session, verbose);

        // Validate the migrated session
        const validation = validateMigratedSession(migratedSession);
        if (!validation.valid) {
          const errorMsg = `Validation failed for session ${session.id}: ${validation.error}`;
          console.error(`❌ ${errorMsg}`);
          result.errors.push(errorMsg);
          // Include original session to avoid data loss
          migratedSessions.push(session);
          continue;
        }

        migratedSessions.push(migratedSession);
        result.migratedCount++;

        if (!verbose) {
          // Show progress for every 10 sessions
          if (result.migratedCount % 10 === 0) {
            console.log(`  ✅ Migrated ${result.migratedCount} sessions...`);
          }
        }

        processedCount++;
        const progress = 10 + Math.floor((processedCount / sessions.length) * 80);
        onProgress?.(`Migrating sessions (${processedCount}/${sessions.length})...`, progress);
      } catch (error) {
        const errorMsg = `Failed to migrate session ${session.id}: ${error}`;
        console.error(`❌ ${errorMsg}`);
        result.errors.push(errorMsg);
        // Include original session to avoid data loss
        migratedSessions.push(session);
      }
    }

    // Step 4: Save migrated sessions
    if (!dryRun) {
      onProgress?.('Saving migrated sessions...', 90);
      try {
        await storage.save('sessions', migratedSessions);
        console.log('💾 Saved migrated sessions to storage');
      } catch (saveError) {
        const errorMsg = `Failed to save migrated sessions: ${saveError}`;
        console.error(`❌ ${errorMsg}`);
        result.errors.push(errorMsg);
        return result;
      }

      // Step 5: Save migration status
      onProgress?.('Saving migration status...', 95);
      try {
        await storage.save(MIGRATION_STATUS_KEY, {
          completed: true,
          timestamp: new Date().toISOString(),
          migratedCount: result.migratedCount,
          skippedCount: result.skippedCount,
          totalCount: sessions.length,
          backupPath: result.backupPath,
        });
      } catch (statusError) {
        console.warn('⚠️  Failed to save migration status:', statusError);
        // Non-critical, continue
      }
    } else {
      console.log('⏭️  Skipping save (dry run)');
    }

    // Final result
    result.success = result.errors.length === 0;
    onProgress?.('Migration complete!', 100);

    console.log('✅ Migration completed:', {
      migrated: result.migratedCount,
      skipped: result.skippedCount,
      errors: result.errors.length,
      dryRun,
    });

    if (result.errors.length > 0) {
      console.warn('⚠️  Migration completed with errors:', result.errors);
    }

    return result;
  } catch (error) {
    const errorMsg = `Migration failed: ${error}`;
    console.error(`❌ ${errorMsg}`);
    result.errors.push(errorMsg);
    result.success = false;
    return result;
  }
}

/**
 * Rollback migration by restoring from backup
 */
export async function rollbackMigration(backupPath: string): Promise<boolean> {
  try {
    console.log(`🔄 Rolling back migration from backup: ${backupPath}`);

    const storage = await getStorage();

    // Load backup
    const backup = await storage.load<{
      timestamp: string;
      sessions: Session[];
      count: number;
    }>(backupPath);

    if (!backup || !backup.sessions) {
      console.error('❌ Backup not found or invalid');
      return false;
    }

    console.log(`📦 Found backup with ${backup.count} sessions from ${backup.timestamp}`);

    // Restore sessions
    await storage.save('sessions', backup.sessions);
    console.log('✅ Restored sessions from backup');

    // Clear migration status
    try {
      await storage.delete(MIGRATION_STATUS_KEY);
      console.log('✅ Cleared migration status');
    } catch (statusError) {
      console.warn('⚠️  Failed to clear migration status:', statusError);
      // Non-critical
    }

    console.log('✅ Rollback completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    return false;
  }
}

/**
 * Check if migration has been completed
 */
export async function isMigrationCompleted(): Promise<boolean> {
  try {
    const storage = await getStorage();
    const status = await storage.load<{
      completed: boolean;
      timestamp: string;
    }>(MIGRATION_STATUS_KEY);

    return status?.completed === true;
  } catch (error) {
    console.error('Failed to check migration status:', error);
    return false;
  }
}

/**
 * Get migration status
 */
export async function getMigrationStatus(): Promise<{
  completed: boolean;
  timestamp?: string;
  migratedCount?: number;
  skippedCount?: number;
  totalCount?: number;
  backupPath?: string;
} | null> {
  try {
    const storage = await getStorage();
    return await storage.load(MIGRATION_STATUS_KEY);
  } catch (error) {
    console.error('Failed to get migration status:', error);
    return null;
  }
}

/**
 * List available migration backups
 */
export async function listMigrationBackups(): Promise<string[]> {
  try {
    const storage = await getStorage();

    // This is a simplified version - actual implementation would need
    // to query the storage for keys matching the backup prefix
    // For now, we'll return empty array as this requires storage adapter enhancement
    console.warn('⚠️  listMigrationBackups not fully implemented - requires storage adapter enhancement');
    return [];
  } catch (error) {
    console.error('Failed to list migration backups:', error);
    return [];
  }
}

/**
 * Clean up old migration backups (keep only the most recent 3)
 */
export async function cleanupOldBackups(): Promise<number> {
  try {
    console.log('🧹 Cleaning up old migration backups...');

    const backups = await listMigrationBackups();

    if (backups.length <= 3) {
      console.log(`ℹ️  No cleanup needed (${backups.length} backups)`);
      return 0;
    }

    // Sort by timestamp (newest first) and delete oldest
    const sortedBackups = backups.sort().reverse();
    const toDelete = sortedBackups.slice(3);

    const storage = await getStorage();
    let deletedCount = 0;

    for (const backupKey of toDelete) {
      try {
        await storage.delete(backupKey);
        deletedCount++;
      } catch (deleteError) {
        console.warn(`⚠️  Failed to delete backup ${backupKey}:`, deleteError);
      }
    }

    console.log(`✅ Cleaned up ${deletedCount} old backups`);
    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old backups:', error);
    return 0;
  }
}
