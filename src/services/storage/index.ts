/**
 * Storage Service
 *
 * Auto-detects environment and provides appropriate storage adapter:
 * - Tauri (Desktop): File system storage (unlimited)
 * - Web Browser: IndexedDB storage (100s of MB)
 */

import { StorageAdapter } from './StorageAdapter';
import { TauriFileSystemAdapter } from './TauriFileSystemAdapter';
import { IndexedDBAdapter } from './IndexedDBAdapter';
import type { StorageTransaction } from './types';

export * from './StorageAdapter';
export * from './types';
export { TauriFileSystemAdapter } from './TauriFileSystemAdapter';
export { IndexedDBAdapter } from './IndexedDBAdapter';

/**
 * Check if running in Tauri environment
 *
 * Uses multiple detection methods for reliability:
 * 1. window.__TAURI__ (primary)
 * 2. window.__TAURI_INTERNALS__ (fallback for dev mode)
 * 3. User agent check (backup detection)
 */
export function isTauriApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Primary: Check for Tauri global
  if ('__TAURI__' in window) {
    return true;
  }

  // Fallback: Check for Tauri internals (available in dev mode)
  if ('__TAURI_INTERNALS__' in window) {
    return true;
  }

  // Backup: Check user agent for Tauri
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return navigator.userAgent.includes('Tauri');
  }

  return false;
}

/**
 * Create appropriate storage adapter based on environment
 */
export async function createStorageAdapter(): Promise<StorageAdapter> {
  console.log('[Storage] Detecting environment...');
  console.log('[Storage] window.__TAURI__:', typeof window !== 'undefined' && '__TAURI__' in window);
  console.log('[Storage] window.__TAURI_INTERNALS__:', typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  console.log('[Storage] navigator.userAgent:', typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A');

  const isTauri = isTauriApp();
  console.log('[Storage] isTauriApp():', isTauri);

  // Try Tauri first (desktop app)
  if (isTauri) {
    console.log('[Storage] Attempting to initialize TauriFileSystemAdapter...');
    try {
      const tauriAdapter = new TauriFileSystemAdapter();
      const available = await tauriAdapter.isAvailable();
      console.log('[Storage] TauriFileSystemAdapter.isAvailable():', available);

      if (available) {
        console.log('🖥️  ✅ Using Tauri file system storage (unlimited)');
        return tauriAdapter;
      } else {
        console.warn('[Storage] ⚠️ TauriFileSystemAdapter not available, falling back to IndexedDB');
      }
    } catch (error) {
      console.error('[Storage] ❌ TauriFileSystemAdapter initialization failed:', error);
      console.warn('[Storage] Falling back to IndexedDB');
    }
  } else {
    console.log('[Storage] Not running in Tauri, using IndexedDB');
  }

  // Fall back to IndexedDB (web browser)
  console.log('[Storage] Initializing IndexedDBAdapter...');
  const indexedDBAdapter = new IndexedDBAdapter();
  const available = await indexedDBAdapter.isAvailable();

  if (available) {
    console.log('🌐 Using IndexedDB storage (100s of MB)');
    return indexedDBAdapter;
  }

  // This shouldn't happen in modern browsers, but just in case
  throw new Error('No storage adapter available. IndexedDB is required for web version.');
}

/**
 * Singleton storage instance
 * Initialized lazily on first access
 */
let storageInstance: StorageAdapter | null = null;
let storagePromise: Promise<StorageAdapter> | null = null;

/**
 * Get the storage adapter instance
 * Creates and initializes on first call
 */
export async function getStorage(): Promise<StorageAdapter> {
  if (storageInstance) {
    return storageInstance;
  }

  // If initialization is already in progress, wait for it
  if (storagePromise) {
    return storagePromise;
  }

  // Start initialization
  storagePromise = (async () => {
    const adapter = await createStorageAdapter();
    await adapter.init();
    storageInstance = adapter;
    return adapter;
  })();

  return storagePromise;
}

/**
 * Reset storage instance (useful for testing)
 */
export function resetStorage(): void {
  storageInstance = null;
  storagePromise = null;
}

/**
 * Check if storage has been initialized
 */
export function isStorageInitialized(): boolean {
  return storageInstance !== null;
}

/**
 * Get storage type without initializing
 */
export function getStorageType(): 'filesystem' | 'indexeddb' | 'unknown' {
  if (isTauriApp()) {
    return 'filesystem';
  }

  if (typeof indexedDB !== 'undefined') {
    return 'indexeddb';
  }

  return 'unknown';
}

/**
 * Get a storage transaction for atomic multi-key operations
 *
 * @example
 * ```typescript
 * const tx = await getStorageTransaction();
 * try {
 *   tx.save('sessions', updatedSessions);
 *   tx.save('settings', updatedSettings);
 *   tx.save('cache', updatedCache);
 *   await tx.commit();
 * } catch (error) {
 *   await tx.rollback();
 *   throw error;
 * }
 * ```
 */
export async function getStorageTransaction(): Promise<StorageTransaction> {
  const storage = await getStorage();
  return storage.beginTransaction();
}
