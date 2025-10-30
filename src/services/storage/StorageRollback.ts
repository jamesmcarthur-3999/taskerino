/**
 * StorageRollback - Rollback mechanism for Phase 4 storage migration
 *
 * Provides safe rollback to pre-Phase-4 storage with:
 * - Rollback points (snapshots of storage state)
 * - One-click rollback
 * - Data integrity verification
 * - Automatic rollback on critical errors
 * - Retention management (keep rollback data for 30 days)
 *
 * Usage:
 * ```typescript
 * import {
 *   createRollbackPoint,
 *   rollbackToPhase3Storage,
 *   listRollbackPoints
 * } from './services/storage/StorageRollback';
 *
 * // Create rollback point before migration
 * const point = await createRollbackPoint('pre-phase4-migration');
 *
 * // If something goes wrong, rollback
 * await rollbackToPhase3Storage(true);
 *
 * // List available rollback points
 * const points = await listRollbackPoints();
 * ```
 */

import type { Session } from '../../types';
import { getStorage } from './index';
import { getChunkedStorage } from './ChunkedSessionStorage';
import { getCAStorage } from './ContentAddressableStorage';
import { getInvertedIndexManager } from './InvertedIndexManager';

// ============================================================================
// Types
// ============================================================================

/**
 * Rollback point metadata
 */
export interface RollbackPoint {
  /** Unique ID for this rollback point */
  id: string;

  /** Human-readable name */
  name: string;

  /** When this point was created */
  createdAt: number;

  /** Expires at (for auto-cleanup) */
  expiresAt: number;

  /** Storage snapshot metadata */
  snapshot: {
    totalSessions: number;
    totalAttachments: number;
    totalSize: number;
    storageVersion: 'phase3' | 'phase4';
  };

  /** Verification checksum (for integrity) */
  checksum: string;
}

/**
 * Rollback result
 */
export interface RollbackResult {
  /** Success status */
  success: boolean;

  /** Sessions restored */
  sessionsRestored: number;

  /** Attachments restored */
  attachmentsRestored: number;

  /** Duration in milliseconds */
  duration: number;

  /** Errors encountered */
  errors: string[];

  /** Warnings */
  warnings: string[];

  /** Data integrity verified */
  verified: boolean;
}

/**
 * Rollback verification result
 */
export interface RollbackVerification {
  /** Rollback point is valid */
  valid: boolean;

  /** Errors found */
  errors: string[];

  /** Warnings */
  warnings: string[];

  /** Expected vs actual session count */
  sessionCount: {
    expected: number;
    actual: number;
  };
}

// ============================================================================
// Rollback Point Management
// ============================================================================

/**
 * Create a rollback point
 *
 * Creates a snapshot of current storage state that can be used
 * to rollback the Phase 4 migration.
 *
 * @param name - Human-readable name for this rollback point
 * @param retentionDays - How long to keep this rollback point (default: 30)
 * @returns Rollback point metadata
 */
export async function createRollbackPoint(
  name: string,
  retentionDays: number = 30
): Promise<RollbackPoint> {
  console.log(`[Rollback] Creating rollback point: ${name}`);

  const storage = await getStorage();
  const now = Date.now();

  // Generate unique ID
  const id = `rollback-${now}`;

  // Load current sessions
  const sessions = await storage.load<Session[]>('sessions') || [];

  // Calculate total size (approximate)
  const totalSize = JSON.stringify(sessions).length;

  // Create snapshot
  const snapshot = {
    totalSessions: sessions.length,
    totalAttachments: 0, // Would need to count attachments
    totalSize,
    storageVersion: 'phase3' as const,
  };

  // Create rollback point
  const point: RollbackPoint = {
    id,
    name,
    createdAt: now,
    expiresAt: now + (retentionDays * 24 * 60 * 60 * 1000),
    snapshot,
    checksum: await calculateChecksum(sessions),
  };

  // Save rollback point metadata
  await storage.save(`rollback-points/${id}/metadata`, point);

  // Save session snapshot
  await storage.save(`rollback-points/${id}/sessions`, sessions);

  // Update rollback points index
  const rollbackIndex = await storage.load<string[]>('rollback-points-index') || [];
  if (!rollbackIndex.includes(id)) {
    rollbackIndex.push(id);
    await storage.save('rollback-points-index', rollbackIndex);
  }

  console.log(`[Rollback] ✓ Created rollback point: ${id} (${sessions.length} sessions)`);

  return point;
}

/**
 * List all available rollback points
 *
 * @returns Array of rollback points, sorted by creation date (newest first)
 */
export async function listRollbackPoints(): Promise<RollbackPoint[]> {
  const storage = await getStorage();

  try {
    // Load rollback points index
    const rollbackIndex = await storage.load<string[]>('rollback-points-index') || [];

    // Load each rollback point
    const points: RollbackPoint[] = [];
    for (const id of rollbackIndex) {
      const metadata = await storage.load<RollbackPoint>(`rollback-points/${id}/metadata`);
      if (metadata) {
        points.push(metadata);
      }
    }

    // Sort by creation date (newest first)
    points.sort((a, b) => b.createdAt - a.createdAt);

    return points;

  } catch (error) {
    console.error('[Rollback] Failed to list rollback points:', error);
    return [];
  }
}

/**
 * Get a specific rollback point
 *
 * @param pointId - Rollback point ID
 * @returns Rollback point metadata or null if not found
 */
export async function getRollbackPoint(pointId: string): Promise<RollbackPoint | null> {
  const storage = await getStorage();

  try {
    const metadata = await storage.load<RollbackPoint>(`rollback-points/${pointId}/metadata`);
    return metadata;
  } catch (error) {
    console.error(`[Rollback] Failed to get rollback point ${pointId}:`, error);
    return null;
  }
}

/**
 * Delete a rollback point
 *
 * Removes the rollback point and frees up storage.
 *
 * @param pointId - Rollback point ID to delete
 */
export async function deleteRollbackPoint(pointId: string): Promise<void> {
  console.log(`[Rollback] Deleting rollback point: ${pointId}`);

  const storage = await getStorage();

  try {
    // Delete rollback point data
    await storage.delete(`rollback-points/${pointId}/metadata`);
    await storage.delete(`rollback-points/${pointId}/sessions`);

    // Update rollback points index
    const rollbackIndex = await storage.load<string[]>('rollback-points-index') || [];
    const updatedIndex = rollbackIndex.filter(id => id !== pointId);
    await storage.save('rollback-points-index', updatedIndex);

    console.log(`[Rollback] ✓ Deleted rollback point: ${pointId}`);

  } catch (error) {
    console.error(`[Rollback] Failed to delete rollback point ${pointId}:`, error);
    throw error;
  }
}

/**
 * Clean up expired rollback points
 *
 * Deletes rollback points that have passed their expiration date.
 *
 * @returns Number of rollback points deleted
 */
export async function cleanupExpiredRollbackPoints(): Promise<number> {
  console.log('[Rollback] Cleaning up expired rollback points...');

  const points = await listRollbackPoints();
  const now = Date.now();
  let deleted = 0;

  for (const point of points) {
    if (point.expiresAt < now) {
      await deleteRollbackPoint(point.id);
      deleted++;
    }
  }

  console.log(`[Rollback] ✓ Deleted ${deleted} expired rollback points`);

  return deleted;
}

// ============================================================================
// Rollback Execution
// ============================================================================

/**
 * Rollback to Phase 3 storage
 *
 * Restores storage to pre-Phase-4 state using the most recent rollback point.
 * This will:
 * - Restore sessions from rollback point
 * - Delete Phase 4 storage (chunked, CA, indexes)
 * - Verify data integrity
 *
 * @param confirm - Must be true to proceed (safety check)
 * @param pointId - Optional specific rollback point ID (uses latest if not specified)
 * @returns Rollback result
 */
export async function rollbackToPhase3Storage(
  confirm: boolean,
  pointId?: string
): Promise<RollbackResult> {
  if (!confirm) {
    throw new Error('Rollback requires confirmation. Pass confirm=true to proceed.');
  }

  console.log('[Rollback] ========================================');
  console.log('[Rollback] ROLLING BACK TO PHASE 3 STORAGE');
  console.log('[Rollback] ========================================');

  const startTime = Date.now();
  const result: RollbackResult = {
    success: false,
    sessionsRestored: 0,
    attachmentsRestored: 0,
    duration: 0,
    errors: [],
    warnings: [],
    verified: false,
  };

  try {
    const storage = await getStorage();

    // Find rollback point
    let rollbackPoint: RollbackPoint | null = null;

    if (pointId) {
      // Use specific rollback point
      rollbackPoint = await getRollbackPoint(pointId);
      if (!rollbackPoint) {
        throw new Error(`Rollback point not found: ${pointId}`);
      }
    } else {
      // Use most recent rollback point
      const points = await listRollbackPoints();
      if (points.length === 0) {
        throw new Error('No rollback points available');
      }
      rollbackPoint = points[0];
    }

    console.log(`[Rollback] Using rollback point: ${rollbackPoint.name} (${rollbackPoint.id})`);

    // Verify rollback point integrity
    console.log('[Rollback] Verifying rollback point integrity...');
    const verification = await verifyRollbackPoint(rollbackPoint.id);

    if (!verification.valid) {
      result.errors.push('Rollback point integrity check failed');
      result.errors.push(...verification.errors);
      throw new Error('Rollback point is invalid');
    }

    result.warnings.push(...verification.warnings);

    // Load session snapshot
    console.log('[Rollback] Loading session snapshot...');
    const sessions = await storage.load<Session[]>(`rollback-points/${rollbackPoint.id}/sessions`);

    if (!sessions) {
      throw new Error('Session snapshot not found');
    }

    console.log(`[Rollback] Loaded ${sessions.length} sessions from snapshot`);

    // Backup current state (just in case)
    console.log('[Rollback] Creating safety backup of current state...');
    await createRollbackPoint('pre-rollback-backup', 7); // Keep for 7 days

    // Delete Phase 4 storage
    console.log('[Rollback] Deleting Phase 4 storage...');

    // Delete session index
    await storage.delete('session-index');

    // Delete all chunked sessions
    const chunkedStorage = await getChunkedStorage();
    for (const session of sessions) {
      try {
        await chunkedStorage.deleteSession(session.id);
      } catch (error) {
        result.warnings.push(`Failed to delete chunked session ${session.id}: ${error}`);
      }
    }

    // Delete CA storage
    const caStorage = await getCAStorage();
    const allHashes = await caStorage.getAllHashes();
    for (const hash of allHashes) {
      try {
        await caStorage.deleteAttachment(hash);
      } catch (error) {
        result.warnings.push(`Failed to delete CA attachment ${hash}: ${error}`);
      }
    }

    // Delete indexes
    const indexManager = await getInvertedIndexManager();
    await indexManager.clearIndexes();

    // Restore sessions
    console.log('[Rollback] Restoring sessions...');
    await storage.save('sessions', sessions);
    result.sessionsRestored = sessions.length;

    // Verify restored data
    console.log('[Rollback] Verifying restored data...');
    const restoredSessions = await storage.load<Session[]>('sessions') || [];

    if (restoredSessions.length !== sessions.length) {
      result.errors.push(`Session count mismatch: expected ${sessions.length}, got ${restoredSessions.length}`);
    } else {
      result.verified = true;
    }

    // Calculate checksum
    const restoredChecksum = await calculateChecksum(restoredSessions);
    if (restoredChecksum !== rollbackPoint.checksum) {
      result.warnings.push('Checksum mismatch (data may have minor differences)');
    }

    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;

    console.log('[Rollback] ========================================');
    console.log(`[Rollback] ROLLBACK ${result.success ? 'COMPLETE' : 'FAILED'}`);
    console.log('[Rollback] ========================================');
    console.log(`[Rollback] Sessions restored: ${result.sessionsRestored}`);
    console.log(`[Rollback] Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`[Rollback] Errors: ${result.errors.length}`);
    console.log(`[Rollback] Warnings: ${result.warnings.length}`);

    return result;

  } catch (error) {
    result.success = false;
    result.duration = Date.now() - startTime;
    result.errors.push(error instanceof Error ? error.message : String(error));
    console.error('[Rollback] Rollback failed:', error);
    return result;
  }
}

/**
 * Verify rollback point integrity
 *
 * Checks that the rollback point is valid and can be used for rollback.
 *
 * @param pointId - Rollback point ID to verify
 * @returns Verification result
 */
export async function verifyRollbackPoint(pointId: string): Promise<RollbackVerification> {
  const result: RollbackVerification = {
    valid: false,
    errors: [],
    warnings: [],
    sessionCount: {
      expected: 0,
      actual: 0,
    },
  };

  try {
    const storage = await getStorage();

    // Load rollback point metadata
    const point = await getRollbackPoint(pointId);
    if (!point) {
      result.errors.push('Rollback point not found');
      return result;
    }

    result.sessionCount.expected = point.snapshot.totalSessions;

    // Load session snapshot
    const sessions = await storage.load<Session[]>(`rollback-points/${pointId}/sessions`);

    if (!sessions) {
      result.errors.push('Session snapshot not found');
      return result;
    }

    result.sessionCount.actual = sessions.length;

    // Verify session count
    if (sessions.length !== point.snapshot.totalSessions) {
      result.errors.push(`Session count mismatch: expected ${point.snapshot.totalSessions}, got ${sessions.length}`);
    }

    // Verify checksum
    const checksum = await calculateChecksum(sessions);
    if (checksum !== point.checksum) {
      result.warnings.push('Checksum mismatch (data integrity may be compromised)');
    }

    // Check expiration
    const now = Date.now();
    if (point.expiresAt < now) {
      result.warnings.push('Rollback point has expired');
    }

    // Overall validity
    result.valid = result.errors.length === 0;

    return result;

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    return result;
  }
}

/**
 * Automatic rollback on critical error
 *
 * Called when a critical migration error is detected.
 * Automatically rolls back to the most recent rollback point.
 *
 * @param error - The error that triggered the rollback
 * @returns Rollback result
 */
export async function autoRollback(error: Error): Promise<RollbackResult> {
  console.error('[Rollback] Critical error detected, initiating automatic rollback:', error);

  try {
    // Find most recent rollback point
    const points = await listRollbackPoints();
    if (points.length === 0) {
      console.error('[Rollback] No rollback points available for auto-rollback');
      throw new Error('No rollback points available');
    }

    const latestPoint = points[0];
    console.log(`[Rollback] Using rollback point: ${latestPoint.name}`);

    // Execute rollback
    return await rollbackToPhase3Storage(true, latestPoint.id);

  } catch (rollbackError) {
    console.error('[Rollback] Auto-rollback failed:', rollbackError);
    throw rollbackError;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate checksum for sessions
 *
 * Simple checksum based on session IDs and modification times.
 * Used to verify data integrity.
 */
async function calculateChecksum(sessions: Session[]): Promise<string> {
  // Create checksum from session IDs and key fields
  const data = sessions.map(s => ({
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    screenshotCount: s.screenshots.length,
  }));

  // Simple hash (in production, use crypto.subtle.digest)
  const str = JSON.stringify(data);
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(36);
}

/**
 * Get storage size estimate
 */
export async function getStorageSize(): Promise<{
  phase3Size: number;
  phase4Size: number;
  rollbackSize: number;
  totalSize: number;
}> {
  const storage = await getStorage();

  // Estimate Phase 3 size
  const sessions = await storage.load<Session[]>('sessions') || [];
  const phase3Size = JSON.stringify(sessions).length;

  // Estimate Phase 4 size (would need to scan all chunked files)
  const phase4Size = 0; // Placeholder

  // Estimate rollback size
  const rollbackIndex = await storage.load<string[]>('rollback-points-index') || [];
  let rollbackSize = 0;
  for (const id of rollbackIndex) {
    const point = await getRollbackPoint(id);
    if (point) {
      rollbackSize += point.snapshot.totalSize;
    }
  }

  return {
    phase3Size,
    phase4Size,
    rollbackSize,
    totalSize: phase3Size + phase4Size + rollbackSize,
  };
}
