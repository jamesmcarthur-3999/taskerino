/**
 * Migrations Module
 *
 * Central export point for all database migrations.
 */

// Enrichment Status Migration (V1)
export {
  migrateSessionsToEnrichmentV1,
  rollbackMigration,
  isMigrationCompleted,
  getMigrationStatus,
  listMigrationBackups,
  cleanupOldBackups,
  type MigrationResult,
  type MigrationOptions,
} from './addEnrichmentStatus';

// Migration Runner (CLI)
export {
  runEnrichmentMigration,
  rollbackEnrichmentMigration,
  showMigrationStatus,
} from './runMigration';

// Attachment Hash Migration (V3.5 - Deduplication)
export { migrateAttachmentHashes } from './migrateAttachmentHashes';
