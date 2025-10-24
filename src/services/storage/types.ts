/**
 * Storage Transaction Types
 *
 * Provides atomic multi-key storage writes to prevent data corruption
 * during power loss or crashes.
 */

/**
 * Storage transaction interface for atomic multi-key operations
 *
 * Allows queuing multiple save/delete operations that are committed
 * atomically - all succeed or all fail together.
 *
 * @example
 * ```typescript
 * const tx = await storage.beginTransaction();
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
export interface StorageTransaction {
  /**
   * Queue a save operation (not executed until commit)
   * @param key - Collection key to save to
   * @param value - Data to save
   * @throws Error if transaction already committed or rolled back
   */
  save(key: string, value: any): void;

  /**
   * Queue a delete operation (not executed until commit)
   * @param key - Collection key to delete
   * @throws Error if transaction already committed or rolled back
   */
  delete(key: string): void;

  /**
   * Execute all queued operations atomically
   * All operations succeed together or all fail together
   * @throws Error if any operation fails (no partial state)
   */
  commit(): Promise<void>;

  /**
   * Cancel all queued operations
   * Clears the operation queue without executing anything
   */
  rollback(): Promise<void>;

  /**
   * Get the number of queued operations
   * Useful for debugging and validation
   * @returns Number of pending operations
   */
  getPendingOperations(): number;
}
