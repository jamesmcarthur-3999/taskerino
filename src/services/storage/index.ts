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

export * from './StorageAdapter';
export { TauriFileSystemAdapter } from './TauriFileSystemAdapter';
export { IndexedDBAdapter } from './IndexedDBAdapter';

/**
 * Check if running in Tauri environment
 */
export function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Create appropriate storage adapter based on environment
 */
export async function createStorageAdapter(): Promise<StorageAdapter> {
  // Try Tauri first (desktop app)
  if (isTauriApp()) {
    const tauriAdapter = new TauriFileSystemAdapter();
    const available = await tauriAdapter.isAvailable();

    if (available) {
      console.log('🖥️  Using Tauri file system storage (unlimited)');
      return tauriAdapter;
    }
  }

  // Fall back to IndexedDB (web browser)
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
