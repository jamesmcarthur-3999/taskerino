interface EnrichmentLock {
  sessionId: string;
  lockedBy: string; // Process identifier
  lockedAt: number; // timestamp
  expiresAt: number; // timestamp
}

/**
 * Production-grade service for managing enrichment locks to prevent concurrent
 * enrichment of the same session, avoiding race conditions and data corruption.
 */
export class EnrichmentLockService {
  private locks: Map<string, EnrichmentLock>;
  private defaultTimeout: number; // Default 10 minutes in milliseconds
  private cleanupIntervalId: NodeJS.Timeout | null;
  private readonly cleanupIntervalMs: number = 30000; // 30 seconds
  private processId: string;

  constructor(defaultTimeoutMinutes: number = 10) {
    this.locks = new Map<string, EnrichmentLock>();
    this.defaultTimeout = defaultTimeoutMinutes * 60 * 1000;
    this.cleanupIntervalId = null;
    this.processId = this.getProcessId();

    console.log('🔒 [ENRICHMENT LOCK] Service initialized', {
      processId: this.processId,
      defaultTimeoutMinutes,
      cleanupIntervalMs: this.cleanupIntervalMs,
    });

    // Start automatic cleanup
    this.startCleanupInterval();
  }

  /**
   * Attempts to acquire a lock for a session.
   * Returns true if lock was acquired, false if session is already locked.
   */
  async acquireLock(sessionId: string, timeout?: number): Promise<boolean> {
    try {
      // Clean up expired locks before checking
      this.cleanupExpiredLocks();

      const existingLock = this.locks.get(sessionId);
      const now = Date.now();

      // Check if session is already locked and lock hasn't expired
      if (existingLock) {
        if (existingLock.expiresAt > now) {
          console.warn('⚠️ [ENRICHMENT LOCK] Lock acquisition failed - session already locked', {
            sessionId,
            lockedBy: existingLock.lockedBy,
            lockedAt: new Date(existingLock.lockedAt).toISOString(),
            expiresAt: new Date(existingLock.expiresAt).toISOString(),
            requestedBy: this.processId,
          });
          return false;
        } else {
          // Lock has expired, log and proceed to acquire
          console.log('🔒 [ENRICHMENT LOCK] Removing expired lock', {
            sessionId,
            lockedBy: existingLock.lockedBy,
            expiredAt: new Date(existingLock.expiresAt).toISOString(),
          });
        }
      }

      // Acquire the lock
      const lockTimeout = timeout !== undefined ? timeout : this.defaultTimeout;
      const lock: EnrichmentLock = {
        sessionId,
        lockedBy: this.processId,
        lockedAt: now,
        expiresAt: now + lockTimeout,
      };

      this.locks.set(sessionId, lock);

      console.log('✅ [ENRICHMENT LOCK] Lock acquired successfully', {
        sessionId,
        lockedBy: this.processId,
        lockedAt: new Date(lock.lockedAt).toISOString(),
        expiresAt: new Date(lock.expiresAt).toISOString(),
        timeoutMs: lockTimeout,
      });

      return true;
    } catch (error) {
      console.error('❌ [ENRICHMENT LOCK] Error acquiring lock', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Releases a lock for a session.
   * Only the process that acquired the lock can release it.
   */
  async releaseLock(sessionId: string): Promise<void> {
    try {
      const lock = this.locks.get(sessionId);

      if (!lock) {
        console.warn('⚠️ [ENRICHMENT LOCK] Lock release attempted but no lock exists', {
          sessionId,
          requestedBy: this.processId,
        });
        return;
      }

      // Verify the lock belongs to this process
      if (lock.lockedBy !== this.processId) {
        console.warn('⚠️ [ENRICHMENT LOCK] Lock release failed - lock owned by different process', {
          sessionId,
          lockOwner: lock.lockedBy,
          requestedBy: this.processId,
        });
        throw new Error(
          `Cannot release lock for session ${sessionId} - lock owned by ${lock.lockedBy}`
        );
      }

      this.locks.delete(sessionId);

      console.log('✅ [ENRICHMENT LOCK] Lock released successfully', {
        sessionId,
        lockedBy: this.processId,
        lockDuration: Date.now() - lock.lockedAt,
      });
    } catch (error) {
      console.error('❌ [ENRICHMENT LOCK] Error releasing lock', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Checks if a session is currently locked.
   * Automatically considers expired locks as unlocked.
   */
  async isLocked(sessionId: string): Promise<boolean> {
    try {
      const lock = this.locks.get(sessionId);

      if (!lock) {
        return false;
      }

      const now = Date.now();
      const isLocked = lock.expiresAt > now;

      // Clean up if expired
      if (!isLocked) {
        console.log('🔒 [ENRICHMENT LOCK] Lock expired during check', {
          sessionId,
          lockedBy: lock.lockedBy,
          expiredAt: new Date(lock.expiresAt).toISOString(),
        });
        this.locks.delete(sessionId);
      }

      return isLocked;
    } catch (error) {
      console.error('❌ [ENRICHMENT LOCK] Error checking lock status', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Extends the expiration time of an existing lock.
   * Only the process that owns the lock can extend it.
   */
  async extendLock(sessionId: string, additionalTime: number): Promise<boolean> {
    try {
      const lock = this.locks.get(sessionId);

      if (!lock) {
        console.warn('⚠️ [ENRICHMENT LOCK] Lock extension failed - no lock exists', {
          sessionId,
          requestedBy: this.processId,
        });
        return false;
      }

      // Verify the lock belongs to this process
      if (lock.lockedBy !== this.processId) {
        console.warn('⚠️ [ENRICHMENT LOCK] Lock extension failed - lock owned by different process', {
          sessionId,
          lockOwner: lock.lockedBy,
          requestedBy: this.processId,
        });
        return false;
      }

      const now = Date.now();

      // Check if lock has already expired
      if (lock.expiresAt <= now) {
        console.warn('⚠️ [ENRICHMENT LOCK] Lock extension failed - lock already expired', {
          sessionId,
          expiredAt: new Date(lock.expiresAt).toISOString(),
        });
        this.locks.delete(sessionId);
        return false;
      }

      // Extend the lock
      const oldExpiresAt = lock.expiresAt;
      lock.expiresAt = now + additionalTime;

      console.log('✅ [ENRICHMENT LOCK] Lock extended successfully', {
        sessionId,
        lockedBy: this.processId,
        oldExpiresAt: new Date(oldExpiresAt).toISOString(),
        newExpiresAt: new Date(lock.expiresAt).toISOString(),
        additionalTimeMs: additionalTime,
      });

      return true;
    } catch (error) {
      console.error('❌ [ENRICHMENT LOCK] Error extending lock', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Force releases a lock regardless of ownership.
   * Should only be used for administrative purposes or error recovery.
   */
  async forceReleaseLock(sessionId: string): Promise<void> {
    try {
      const lock = this.locks.get(sessionId);

      if (!lock) {
        console.warn('⚠️ [ENRICHMENT LOCK] Force release attempted but no lock exists', {
          sessionId,
          requestedBy: this.processId,
        });
        return;
      }

      console.warn('⚠️ [ENRICHMENT LOCK] Lock force released', {
        sessionId,
        originalOwner: lock.lockedBy,
        releasedBy: this.processId,
        lockAge: Date.now() - lock.lockedAt,
        wasExpired: lock.expiresAt <= Date.now(),
      });

      this.locks.delete(sessionId);
    } catch (error) {
      console.error('❌ [ENRICHMENT LOCK] Error force releasing lock', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Removes all expired locks from the map.
   */
  private cleanupExpiredLocks(): void {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [sessionId, lock] of this.locks.entries()) {
        if (lock.expiresAt <= now) {
          this.locks.delete(sessionId);
          cleanedCount++;

          console.log('🔒 [ENRICHMENT LOCK] Expired lock cleaned up', {
            sessionId,
            lockedBy: lock.lockedBy,
            lockedAt: new Date(lock.lockedAt).toISOString(),
            expiredAt: new Date(lock.expiresAt).toISOString(),
            age: now - lock.lockedAt,
          });
        }
      }

      if (cleanedCount > 0) {
        console.log('🔒 [ENRICHMENT LOCK] Cleanup completed', {
          cleanedCount,
          remainingLocks: this.locks.size,
        });
      }
    } catch (error) {
      console.error('❌ [ENRICHMENT LOCK] Error during lock cleanup', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Starts the periodic cleanup interval.
   */
  private startCleanupInterval(): void {
    if (this.cleanupIntervalId) {
      console.warn('⚠️ [ENRICHMENT LOCK] Cleanup interval already running');
      return;
    }

    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredLocks();
    }, this.cleanupIntervalMs);

    console.log('🔒 [ENRICHMENT LOCK] Cleanup interval started', {
      intervalMs: this.cleanupIntervalMs,
    });
  }

  /**
   * Stops the periodic cleanup interval.
   * Should be called when shutting down the service.
   */
  public stopCleanupInterval(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      console.log('🔒 [ENRICHMENT LOCK] Cleanup interval stopped');
    }
  }

  /**
   * Generates a unique process identifier using timestamp and random value.
   */
  private getProcessId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
  }

  /**
   * Returns the current number of active locks.
   */
  public getActiveLockCount(): number {
    this.cleanupExpiredLocks();
    return this.locks.size;
  }

  /**
   * Returns information about all active locks (for monitoring/debugging).
   */
  public getActiveLocks(): Array<EnrichmentLock & { timeRemaining: number }> {
    this.cleanupExpiredLocks();
    const now = Date.now();

    return Array.from(this.locks.values()).map((lock) => ({
      ...lock,
      timeRemaining: Math.max(0, lock.expiresAt - now),
    }));
  }

  /**
   * Cleans up all resources.
   * Should be called when shutting down the application.
   */
  public destroy(): void {
    this.stopCleanupInterval();
    const lockCount = this.locks.size;
    this.locks.clear();

    console.log('🔒 [ENRICHMENT LOCK] Service destroyed', {
      clearedLocks: lockCount,
    });
  }
}

// Singleton instance for application-wide use
let lockServiceInstance: EnrichmentLockService | null = null;

/**
 * Gets or creates the singleton instance of EnrichmentLockService.
 */
export function getEnrichmentLockService(
  defaultTimeoutMinutes: number = 10
): EnrichmentLockService {
  if (!lockServiceInstance) {
    lockServiceInstance = new EnrichmentLockService(defaultTimeoutMinutes);
  }
  return lockServiceInstance;
}

/**
 * Destroys the singleton instance (mainly for testing or shutdown).
 */
export function destroyEnrichmentLockService(): void {
  if (lockServiceInstance) {
    lockServiceInstance.destroy();
    lockServiceInstance = null;
  }
}
