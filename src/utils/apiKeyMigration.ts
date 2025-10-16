import { invoke } from '@tauri-apps/api/core';

const MIGRATION_VERSION_KEY = 'api-keys-migrated-v1';
const OPENAI_KEY = 'openai-api-key';
const CLAUDE_KEY = 'claude-api-key';

interface MigrationResult {
  migrated: boolean;
  openaiMigrated: boolean;
  claudeMigrated: boolean;
}

/**
 * Migrates API keys from localStorage to Tauri's secure storage.
 * This function will only run once per version. After successful migration,
 * it sets a flag in localStorage to prevent re-running.
 */
export async function migrateApiKeysToTauri(): Promise<MigrationResult> {
  const result: MigrationResult = {
    migrated: false,
    openaiMigrated: false,
    claudeMigrated: false,
  };

  // Check if migration has already been completed
  const migrationComplete = localStorage.getItem(MIGRATION_VERSION_KEY);
  if (migrationComplete === 'true') {
    console.log('[API Key Migration] Migration already completed, skipping');
    return result;
  }

  console.log('[API Key Migration] Starting API key migration to Tauri secure storage');

  // Attempt to migrate OpenAI key
  const openaiKey = localStorage.getItem(OPENAI_KEY);
  if (openaiKey) {
    console.log('[API Key Migration] Found OpenAI API key in localStorage, attempting migration');
    try {
      await invoke('set_openai_api_key', { apiKey: openaiKey });
      localStorage.removeItem(OPENAI_KEY);
      result.openaiMigrated = true;
      console.log('[API Key Migration] Successfully migrated OpenAI API key');
    } catch (error) {
      console.error('[API Key Migration] Failed to migrate OpenAI API key:', error);
    }
  } else {
    console.log('[API Key Migration] No OpenAI API key found in localStorage');
  }

  // Attempt to migrate Claude key
  const claudeKey = localStorage.getItem(CLAUDE_KEY);
  if (claudeKey) {
    console.log('[API Key Migration] Found Claude API key in localStorage, attempting migration');
    try {
      await invoke('set_claude_api_key', { apiKey: claudeKey });
      localStorage.removeItem(CLAUDE_KEY);
      result.claudeMigrated = true;
      console.log('[API Key Migration] Successfully migrated Claude API key');
    } catch (error) {
      console.error('[API Key Migration] Failed to migrate Claude API key:', error);
    }
  } else {
    console.log('[API Key Migration] No Claude API key found in localStorage');
  }

  // Mark migration as complete if at least one key was migrated
  if (result.openaiMigrated || result.claudeMigrated) {
    result.migrated = true;
    localStorage.setItem(MIGRATION_VERSION_KEY, 'true');
    console.log('[API Key Migration] Migration completed successfully');
  } else {
    // Even if no keys were found, mark migration as complete to avoid repeated checks
    localStorage.setItem(MIGRATION_VERSION_KEY, 'true');
    console.log('[API Key Migration] No keys to migrate, marking migration as complete');
  }

  return result;
}

/**
 * Force re-run the migration by clearing the migration flag.
 * Useful for testing or manual re-migration.
 */
export function resetMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_VERSION_KEY);
  console.log('[API Key Migration] Migration flag reset');
}
