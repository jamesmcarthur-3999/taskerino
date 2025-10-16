/**
 * Storage Migration Service
 *
 * Handles automatic migration from localStorage to new storage system
 * (Tauri file system or IndexedDB)
 */

import { StorageAdapter } from './StorageAdapter';
import type { MigrationStatus } from './StorageAdapter';
import { getStorage, getStorageType } from './index';
import type { AppState } from '../../types';

const LOCALSTORAGE_KEY = 'taskerino-v3-state';
const MIGRATION_STATUS_KEY = 'migration-status';
const MIGRATION_BACKUP_KEY = 'taskerino-migration-backup';
const MIGRATION_DATE_KEY = 'taskerino-migration-date';

/**
 * Check if migration is needed
 */
export async function needsMigration(): Promise<boolean> {
  try {
    // Check if there's data in localStorage
    const hasLocalStorageData = localStorage.getItem(LOCALSTORAGE_KEY) !== null;

    if (!hasLocalStorageData) {
      return false;
    }

    // Check if migration was already completed
    const storage = await getStorage();
    const migrationStatus = await storage.load<MigrationStatus>(MIGRATION_STATUS_KEY);

    if (migrationStatus?.completed) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}

/**
 * Perform migration from localStorage to new storage system
 */
export async function migrateFromLocalStorage(
  onProgress?: (message: string) => void
): Promise<boolean> {
  const storage = await getStorage();

  try {
    console.log('🔄 Starting migration from localStorage...');
    onProgress?.('Loading data from localStorage...');

    // Load data from localStorage
    const localStorageData = localStorage.getItem(LOCALSTORAGE_KEY);

    if (!localStorageData) {
      console.log('ℹ️  No localStorage data found, skipping migration');
      return false;
    }

    let oldState: Partial<AppState>;

    try {
      oldState = JSON.parse(localStorageData);
    } catch (error) {
      console.error('❌ Failed to parse localStorage data:', error);
      throw new Error('localStorage data is corrupted');
    }

    onProgress?.('Validating data...');

    // Validate data structure
    if (typeof oldState !== 'object' || oldState === null) {
      throw new Error('Invalid localStorage data structure');
    }

    console.log('📊 Found data to migrate:', {
      companies: oldState.companies?.length || 0,
      contacts: oldState.contacts?.length || 0,
      topics: oldState.topics?.length || 0,
      notes: oldState.notes?.length || 0,
      tasks: oldState.tasks?.length || 0,
      sessions: oldState.sessions?.length || 0
    });

    onProgress?.('Migrating companies...');

    // Migrate each collection
    if (oldState.companies && oldState.companies.length > 0) {
      await storage.save('companies', oldState.companies);
      console.log(`✅ Migrated ${oldState.companies.length} companies`);
    }

    onProgress?.('Migrating contacts...');

    if (oldState.contacts && oldState.contacts.length > 0) {
      await storage.save('contacts', oldState.contacts);
      console.log(`✅ Migrated ${oldState.contacts.length} contacts`);
    }

    onProgress?.('Migrating topics...');

    if (oldState.topics && oldState.topics.length > 0) {
      await storage.save('topics', oldState.topics);
      console.log(`✅ Migrated ${oldState.topics.length} topics`);
    }

    onProgress?.('Migrating notes...');

    if (oldState.notes && oldState.notes.length > 0) {
      await storage.save('notes', oldState.notes);
      console.log(`✅ Migrated ${oldState.notes.length} notes`);
    }

    onProgress?.('Migrating tasks...');

    if (oldState.tasks && oldState.tasks.length > 0) {
      await storage.save('tasks', oldState.tasks);
      console.log(`✅ Migrated ${oldState.tasks.length} tasks`);
    }

    onProgress?.('Migrating sessions...');

    if (oldState.sessions && oldState.sessions.length > 0) {
      await storage.save('sessions', oldState.sessions);
      console.log(`✅ Migrated ${oldState.sessions.length} sessions`);
    }

    onProgress?.('Migrating settings...');

    // Migrate settings as a single collection
    const settings = {
      aiSettings: oldState.aiSettings,
      learningSettings: oldState.learningSettings,
      userProfile: oldState.userProfile,
      learnings: oldState.learnings,
      nedSettings: oldState.nedSettings,
      ui: oldState.ui,
      searchHistory: oldState.searchHistory,
      activeSessionId: oldState.activeSessionId
    };

    await storage.save('settings', settings);
    console.log('✅ Migrated settings');

    onProgress?.('Verifying migration...');

    // Verify migration by loading back
    const verifyCompanies = await storage.load('companies');
    const verifyNotes = await storage.load('notes');
    const verifyTasks = await storage.load('tasks');

    if (verifyCompanies === null && oldState.companies && oldState.companies.length > 0) {
      throw new Error('Migration verification failed: companies not found');
    }

    if (verifyNotes === null && oldState.notes && oldState.notes.length > 0) {
      throw new Error('Migration verification failed: notes not found');
    }

    if (verifyTasks === null && oldState.tasks && oldState.tasks.length > 0) {
      throw new Error('Migration verification failed: tasks not found');
    }

    console.log('✅ Migration verification passed');

    onProgress?.('Saving migration status...');

    // Mark migration as completed
    const migrationStatus: MigrationStatus = {
      completed: true,
      timestamp: Date.now(),
      from: 'localStorage',
      to: getStorageType()
    };

    await storage.save(MIGRATION_STATUS_KEY, migrationStatus);

    // Keep localStorage data as backup for 7 days
    localStorage.setItem(MIGRATION_BACKUP_KEY, localStorageData);
    localStorage.setItem(MIGRATION_DATE_KEY, Date.now().toString());

    console.log('✅ Migration completed successfully');
    console.log('ℹ️  localStorage backup will be kept for 7 days');

    onProgress?.('Migration completed!');

    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);

    // Save error status
    const migrationStatus: MigrationStatus = {
      completed: false,
      timestamp: Date.now(),
      error: String(error)
    };

    try {
      await storage.save(MIGRATION_STATUS_KEY, migrationStatus);
    } catch (saveError) {
      console.error('Failed to save migration error status:', saveError);
    }

    throw error;
  }
}

/**
 * Get migration status
 */
export async function getMigrationStatus(): Promise<MigrationStatus | null> {
  try {
    const storage = await getStorage();
    return await storage.load<MigrationStatus>(MIGRATION_STATUS_KEY);
  } catch (error) {
    console.error('Failed to get migration status:', error);
    return null;
  }
}

/**
 * Cleanup old localStorage data after migration
 * Should be called after migration has been verified (e.g., after 7 days)
 */
export function cleanupOldLocalStorage(): void {
  try {
    const migrationDate = localStorage.getItem(MIGRATION_DATE_KEY);

    if (!migrationDate) {
      return;
    }

    const daysSince = (Date.now() - parseInt(migrationDate)) / (24 * 60 * 60 * 1000);

    if (daysSince > 7) {
      console.log('🧹 Cleaning up old localStorage data (migration completed > 7 days ago)');

      localStorage.removeItem(LOCALSTORAGE_KEY);
      localStorage.removeItem(MIGRATION_BACKUP_KEY);
      localStorage.removeItem(MIGRATION_DATE_KEY);

      console.log('✅ localStorage cleanup complete');
    }
  } catch (error) {
    console.warn('Failed to cleanup old localStorage:', error);
    // Non-critical, continue
  }
}

/**
 * Rollback migration (restore from backup)
 * Only available if backup still exists
 */
export async function rollbackMigration(): Promise<boolean> {
  try {
    const backup = localStorage.getItem(MIGRATION_BACKUP_KEY);

    if (!backup) {
      console.error('❌ No migration backup found');
      return false;
    }

    console.log('🔄 Rolling back migration...');

    // Restore localStorage
    localStorage.setItem(LOCALSTORAGE_KEY, backup);

    // Clear migration status
    const storage = await getStorage();
    await storage.delete(MIGRATION_STATUS_KEY);

    // Clear all migrated data
    await storage.clear();

    console.log('✅ Migration rolled back successfully');
    console.log('ℹ️  Please refresh the app to use localStorage again');

    return true;
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    return false;
  }
}

/**
 * Check if localStorage backup exists
 */
export function hasLocalStorageBackup(): boolean {
  return localStorage.getItem(MIGRATION_BACKUP_KEY) !== null;
}

/**
 * Get days since migration
 */
export function getDaysSinceMigration(): number | null {
  const migrationDate = localStorage.getItem(MIGRATION_DATE_KEY);

  if (!migrationDate) {
    return null;
  }

  return (Date.now() - parseInt(migrationDate)) / (24 * 60 * 60 * 1000);
}
