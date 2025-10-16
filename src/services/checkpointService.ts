/**
 * Checkpoint Service for Enrichment Recovery
 *
 * Production-grade service for saving and resuming failed enrichments.
 * Allows recovery from audio, video, or summary stages with partial results.
 *
 * Key Features:
 * - Persistent checkpoint storage across sessions
 * - Automatic retry management with configurable limits
 * - Progress tracking (0-100%)
 * - Partial results preservation
 * - Type-safe interfaces with comprehensive error handling
 * - Detailed logging for debugging
 *
 * Usage:
 * ```typescript
 * const checkpointService = new CheckpointService();
 *
 * // Create checkpoint before enrichment
 * const checkpoint = await checkpointService.createCheckpoint(sessionId, {
 *   stage: 'audio',
 *   progress: 0
 * });
 *
 * // Update as enrichment progresses
 * await checkpointService.updateCheckpoint(checkpoint.id, {
 *   progress: 50,
 *   partialResults: { audio: { partialTranscription: '...' } }
 * });
 *
 * // Resume from last checkpoint
 * const lastCheckpoint = await checkpointService.loadCheckpoint(sessionId);
 * if (lastCheckpoint && lastCheckpoint.canResume) {
 *   // Resume from lastCheckpoint.stage with lastCheckpoint.partialResults
 * }
 * ```
 */

import { getStorage } from './storage';
import type { VideoFrame } from '../types';

/**
 * Enrichment stages in order of execution
 */
export type EnrichmentStage = 'audio' | 'video' | 'summary';

/**
 * Checkpoint data structure for enrichment recovery
 */
export interface EnrichmentCheckpoint {
  /** Unique checkpoint identifier */
  id: string;

  /** Session ID this checkpoint belongs to */
  sessionId: string;

  /** Timestamp when checkpoint was created */
  createdAt: string;

  /** Timestamp when checkpoint was last updated */
  updatedAt: string;

  /** Current enrichment stage */
  stage: EnrichmentStage;

  /** Progress percentage (0-100) */
  progress: number;

  /** Partial results from completed or in-progress stages */
  partialResults: {
    audio?: {
      /** ID of the full audio attachment if created */
      fullAudioAttachmentId?: string;
      /** Partial transcription if processing was interrupted */
      partialTranscription?: string;
      /** Time spent processing audio (milliseconds) */
      processingTime?: number;
    };
    video?: {
      /** Extracted video frames if processing was interrupted */
      extractedFrames?: VideoFrame[];
      /** Time spent processing video (milliseconds) */
      processingTime?: number;
    };
    summary?: any;
  };

  /** Whether this checkpoint can be used for resuming */
  canResume: boolean;

  /** Number of retry attempts made */
  retryCount: number;

  /** Maximum retry attempts allowed */
  maxRetries: number;
}

/**
 * Error class for checkpoint-related errors
 */
export class CheckpointError extends Error {
  code: string;
  details?: any;

  constructor(
    message: string,
    code: string,
    details?: any
  ) {
    super(message);
    this.name = 'CheckpointError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Checkpoint Service
 *
 * Manages enrichment checkpoints for recovery and resumption.
 */
export class CheckpointService {
  private readonly STORAGE_KEY_PREFIX = 'enrichment_checkpoint_';
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly logger = this.createLogger();

  /**
   * Create a new enrichment checkpoint
   *
   * @param sessionId - Session ID to create checkpoint for
   * @param data - Initial checkpoint data
   * @returns Created checkpoint
   * @throws CheckpointError if creation fails
   */
  async createCheckpoint(
    sessionId: string,
    data: Partial<EnrichmentCheckpoint>
  ): Promise<EnrichmentCheckpoint> {
    this.logger.info(`Creating checkpoint for session: ${sessionId}`, data);

    try {
      // Validate session ID
      if (!sessionId || typeof sessionId !== 'string') {
        throw new CheckpointError(
          'Invalid session ID',
          'INVALID_SESSION_ID',
          { sessionId }
        );
      }

      // Check if checkpoint already exists
      const existing = await this.loadCheckpoint(sessionId);
      if (existing) {
        this.logger.warn(`Checkpoint already exists for session: ${sessionId}. Overwriting.`);
      }

      // Generate unique checkpoint ID
      const checkpointId = this.generateCheckpointId(sessionId);
      const now = new Date().toISOString();

      // Create checkpoint with defaults
      const checkpoint: EnrichmentCheckpoint = {
        id: checkpointId,
        sessionId,
        createdAt: now,
        updatedAt: now,
        stage: data.stage || 'audio',
        progress: data.progress ?? 0,
        partialResults: data.partialResults || {},
        canResume: data.canResume ?? true,
        retryCount: data.retryCount ?? 0,
        maxRetries: data.maxRetries ?? this.DEFAULT_MAX_RETRIES,
        ...data,
      };

      // Validate checkpoint
      this.validateCheckpoint(checkpoint);

      // Save to storage
      await this.saveCheckpoint(checkpoint);

      this.logger.info(`Checkpoint created successfully: ${checkpointId}`);
      return checkpoint;
    } catch (error) {
      this.logger.error('Failed to create checkpoint', error);
      if (error instanceof CheckpointError) {
        throw error;
      }
      throw new CheckpointError(
        'Failed to create checkpoint',
        'CREATE_FAILED',
        { sessionId, error: (error as Error).message }
      );
    }
  }

  /**
   * Load existing checkpoint for a session
   *
   * @param sessionId - Session ID to load checkpoint for
   * @returns Checkpoint if found, null otherwise
   * @throws CheckpointError if load fails
   */
  async loadCheckpoint(sessionId: string): Promise<EnrichmentCheckpoint | null> {
    this.logger.info(`Loading checkpoint for session: ${sessionId}`);

    try {
      // Validate session ID
      if (!sessionId || typeof sessionId !== 'string') {
        throw new CheckpointError(
          'Invalid session ID',
          'INVALID_SESSION_ID',
          { sessionId }
        );
      }

      const storage = await getStorage();
      const storageKey = this.getStorageKey(sessionId);

      let checkpoint = await storage.load<EnrichmentCheckpoint>(storageKey);

      if (!checkpoint) {
        this.logger.info(`No checkpoint found for session: ${sessionId}`);
        return null;
      }

      // Validate loaded checkpoint
      this.validateCheckpoint(checkpoint);

      // Check if checkpoint uses old format and migrate if necessary
      if (this.isOldFormatCheckpointId(checkpoint.id)) {
        this.logger.warn(`Detected old-format checkpoint ID: ${checkpoint.id}. Auto-migrating...`, {
          sessionId: checkpoint.sessionId,
          oldId: checkpoint.id,
        });

        // Migrate checkpoint to new format
        checkpoint = await this.migrateCheckpointId(checkpoint);

        this.logger.info(`Checkpoint automatically migrated to new format: ${checkpoint.id}`);
      }

      this.logger.info(`Checkpoint loaded successfully: ${checkpoint.id}`);
      return checkpoint;
    } catch (error) {
      this.logger.error('Failed to load checkpoint', error);
      if (error instanceof CheckpointError) {
        throw error;
      }
      throw new CheckpointError(
        'Failed to load checkpoint',
        'LOAD_FAILED',
        { sessionId, error: (error as Error).message }
      );
    }
  }

  /**
   * Update an existing checkpoint
   *
   * @param checkpointId - Checkpoint ID to update
   * @param updates - Fields to update
   * @throws CheckpointError if update fails
   */
  async updateCheckpoint(
    checkpointId: string,
    updates: Partial<EnrichmentCheckpoint>
  ): Promise<void> {
    this.logger.info(`Updating checkpoint: ${checkpointId}`, updates);

    try {
      // Validate checkpoint ID
      if (!checkpointId || typeof checkpointId !== 'string') {
        throw new CheckpointError(
          'Invalid checkpoint ID',
          'INVALID_CHECKPOINT_ID',
          { checkpointId }
        );
      }

      // Load existing checkpoint
      const checkpoint = await this.loadCheckpointById(checkpointId);

      if (!checkpoint) {
        throw new CheckpointError(
          'Checkpoint not found',
          'CHECKPOINT_NOT_FOUND',
          { checkpointId }
        );
      }

      // Merge updates
      const updatedCheckpoint: EnrichmentCheckpoint = {
        ...checkpoint,
        ...updates,
        id: checkpoint.id, // Prevent ID changes
        sessionId: checkpoint.sessionId, // Prevent session ID changes
        createdAt: checkpoint.createdAt, // Prevent creation time changes
        updatedAt: new Date().toISOString(), // Update timestamp
        partialResults: {
          ...checkpoint.partialResults,
          ...updates.partialResults,
        },
      };

      // Validate updated checkpoint
      this.validateCheckpoint(updatedCheckpoint);

      // Save updated checkpoint
      await this.saveCheckpoint(updatedCheckpoint);

      this.logger.info(`Checkpoint updated successfully: ${checkpointId}`);
    } catch (error) {
      this.logger.error('Failed to update checkpoint', error);
      if (error instanceof CheckpointError) {
        throw error;
      }
      throw new CheckpointError(
        'Failed to update checkpoint',
        'UPDATE_FAILED',
        { checkpointId, error: (error as Error).message }
      );
    }
  }

  /**
   * Delete a checkpoint
   *
   * @param checkpointId - Checkpoint ID to delete
   * @throws CheckpointError if deletion fails
   */
  async deleteCheckpoint(checkpointId: string): Promise<void> {
    this.logger.info(`Deleting checkpoint: ${checkpointId}`);

    try {
      // Validate checkpoint ID
      if (!checkpointId || typeof checkpointId !== 'string') {
        throw new CheckpointError(
          'Invalid checkpoint ID',
          'INVALID_CHECKPOINT_ID',
          { checkpointId }
        );
      }

      // Load checkpoint to get session ID
      const checkpoint = await this.loadCheckpointById(checkpointId);

      if (!checkpoint) {
        this.logger.warn(`Checkpoint not found, nothing to delete: ${checkpointId}`);
        return;
      }

      // Delete from storage
      const storage = await getStorage();
      const storageKey = this.getStorageKey(checkpoint.sessionId);
      await storage.delete(storageKey);

      this.logger.info(`Checkpoint deleted successfully: ${checkpointId}`);
    } catch (error) {
      this.logger.error('Failed to delete checkpoint', error);
      if (error instanceof CheckpointError) {
        throw error;
      }
      throw new CheckpointError(
        'Failed to delete checkpoint',
        'DELETE_FAILED',
        { checkpointId, error: (error as Error).message }
      );
    }
  }

  /**
   * Check if a session can resume from checkpoint
   *
   * @param sessionId - Session ID to check
   * @returns True if resumable checkpoint exists
   */
  async canResumeFromCheckpoint(sessionId: string): Promise<boolean> {
    this.logger.info(`Checking if session can resume: ${sessionId}`);

    try {
      const checkpoint = await this.loadCheckpoint(sessionId);

      if (!checkpoint) {
        this.logger.info(`No checkpoint found for session: ${sessionId}`);
        return false;
      }

      // Check if checkpoint is resumable
      const canResume = checkpoint.canResume && checkpoint.retryCount < checkpoint.maxRetries;

      this.logger.info(`Session ${sessionId} can resume: ${canResume}`);
      return canResume;
    } catch (error) {
      this.logger.error('Failed to check resume capability', error);
      return false;
    }
  }

  /**
   * Increment retry count for a checkpoint
   *
   * @param checkpointId - Checkpoint ID
   * @throws CheckpointError if operation fails
   */
  async incrementRetryCount(checkpointId: string): Promise<void> {
    this.logger.info(`Incrementing retry count for checkpoint: ${checkpointId}`);

    try {
      const checkpoint = await this.loadCheckpointById(checkpointId);

      if (!checkpoint) {
        throw new CheckpointError(
          'Checkpoint not found',
          'CHECKPOINT_NOT_FOUND',
          { checkpointId }
        );
      }

      const newRetryCount = checkpoint.retryCount + 1;
      const canResume = newRetryCount < checkpoint.maxRetries;

      await this.updateCheckpoint(checkpointId, {
        retryCount: newRetryCount,
        canResume,
      });

      this.logger.info(
        `Retry count incremented to ${newRetryCount}/${checkpoint.maxRetries}. Can resume: ${canResume}`
      );
    } catch (error) {
      this.logger.error('Failed to increment retry count', error);
      if (error instanceof CheckpointError) {
        throw error;
      }
      throw new CheckpointError(
        'Failed to increment retry count',
        'INCREMENT_RETRY_FAILED',
        { checkpointId, error: (error as Error).message }
      );
    }
  }

  /**
   * Mark checkpoint as completed (no longer resumable)
   *
   * @param checkpointId - Checkpoint ID
   */
  async markCompleted(checkpointId: string): Promise<void> {
    this.logger.info(`Marking checkpoint as completed: ${checkpointId}`);

    try {
      await this.updateCheckpoint(checkpointId, {
        progress: 100,
        canResume: false,
      });

      this.logger.info(`Checkpoint marked as completed: ${checkpointId}`);
    } catch (error) {
      this.logger.error('Failed to mark checkpoint as completed', error);
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Generate unique checkpoint ID
   *
   * @param sessionId - Session ID to embed in the checkpoint ID
   * @returns Checkpoint ID in format: checkpoint_${sessionId}_${timestamp}_${random}
   */
  private generateCheckpointId(sessionId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `checkpoint_${sessionId}_${timestamp}_${random}`;
  }

  /**
   * Extract session ID from checkpoint ID
   *
   * Parses checkpoint IDs in the format: checkpoint_${sessionId}_${timestamp}_${random}
   * Handles session IDs that may contain underscores by treating the last two parts
   * as timestamp and random string.
   *
   * Supports both old and new checkpoint ID formats:
   * - Old format: checkpoint_${timestamp}_${random} (2 parts)
   * - New format: checkpoint_${sessionId}_${timestamp}_${random} (3+ parts)
   *
   * @param checkpointId - Checkpoint ID to parse
   * @returns Session ID extracted from checkpoint ID
   * @throws CheckpointError if checkpoint ID uses old format or is invalid
   *
   * @example
   * extractSessionIdFromCheckpointId('checkpoint_session123_1234567890_abc123') // 'session123'
   * extractSessionIdFromCheckpointId('checkpoint_my_session_id_1234567890_abc123') // 'my_session_id'
   */
  private extractSessionIdFromCheckpointId(checkpointId: string): string {
    if (!checkpointId || typeof checkpointId !== 'string') {
      throw new CheckpointError(
        'Invalid checkpoint ID',
        'INVALID_CHECKPOINT_ID',
        { checkpointId }
      );
    }

    // Remove 'checkpoint_' prefix
    const withoutPrefix = checkpointId.replace(/^checkpoint_/, '');
    const parts = withoutPrefix.split('_');

    // Old format: checkpoint_${timestamp}_${random} = 2 parts after prefix
    // New format: checkpoint_${sessionId}_${timestamp}_${random} = 3+ parts after prefix
    if (parts.length === 2) {
      throw new CheckpointError(
        'Checkpoint ID uses old format (checkpoint_${timestamp}_${random}). ' +
        'This checkpoint needs to be migrated to the new format (checkpoint_${sessionId}_${timestamp}_${random}). ' +
        'The checkpoint will be automatically migrated when loaded.',
        'OLD_CHECKPOINT_FORMAT',
        {
          checkpointId,
          detectedFormat: 'old',
          expectedFormat: 'new',
          migrationRequired: true
        }
      );
    }

    if (parts.length < 3) {
      throw new CheckpointError(
        'Invalid checkpoint ID format',
        'INVALID_CHECKPOINT_FORMAT',
        { checkpointId, parts }
      );
    }

    // Last two parts are timestamp and random
    const random = parts[parts.length - 1];
    const timestamp = parts[parts.length - 2];

    // Validate timestamp (should be numeric)
    if (!/^\d+$/.test(timestamp)) {
      throw new CheckpointError(
        'Invalid checkpoint ID format: timestamp must be numeric',
        'INVALID_CHECKPOINT_ID_FORMAT',
        {
          checkpointId,
          timestamp,
          expected: 'numeric timestamp',
        }
      );
    }

    // Validate random part (should be alphanumeric)
    if (!/^[a-z0-9]+$/.test(random)) {
      throw new CheckpointError(
        'Invalid checkpoint ID format: random part must be alphanumeric',
        'INVALID_CHECKPOINT_ID_FORMAT',
        {
          checkpointId,
          random,
          expected: 'alphanumeric string',
        }
      );
    }

    // Session ID is everything except the last two parts
    const sessionIdParts = parts.slice(0, parts.length - 2);
    const sessionId = sessionIdParts.join('_');

    // Validate session ID is not empty
    if (!sessionId) {
      throw new CheckpointError(
        'Invalid checkpoint ID format: session ID cannot be empty',
        'INVALID_CHECKPOINT_ID_FORMAT',
        { checkpointId }
      );
    }

    this.logger.info(`Extracted session ID: ${sessionId} from checkpoint: ${checkpointId}`);
    return sessionId;
  }

  /**
   * Detect if a checkpoint ID uses the old format
   *
   * @param checkpointId - Checkpoint ID to check
   * @returns True if checkpoint uses old format
   */
  private isOldFormatCheckpointId(checkpointId: string): boolean {
    if (!checkpointId || typeof checkpointId !== 'string') {
      return false;
    }

    const withoutPrefix = checkpointId.replace(/^checkpoint_/, '');
    const parts = withoutPrefix.split('_');

    // Old format has exactly 2 parts: timestamp and random
    return parts.length === 2;
  }

  /**
   * Migrate a checkpoint from old format to new format
   *
   * This method regenerates the checkpoint ID to include the session ID,
   * while preserving all other checkpoint data.
   *
   * @param checkpoint - Checkpoint to migrate
   * @returns Migrated checkpoint with new ID format
   */
  private async migrateCheckpointId(checkpoint: EnrichmentCheckpoint): Promise<EnrichmentCheckpoint> {
    this.logger.info(`Migrating checkpoint from old format: ${checkpoint.id}`);

    // Generate new checkpoint ID with session ID embedded
    const newCheckpointId = this.generateCheckpointId(checkpoint.sessionId);

    // Create migrated checkpoint with new ID
    const migratedCheckpoint: EnrichmentCheckpoint = {
      ...checkpoint,
      id: newCheckpointId,
      updatedAt: new Date().toISOString(),
    };

    // Save migrated checkpoint to storage
    await this.saveCheckpoint(migratedCheckpoint);

    this.logger.info(`Checkpoint migrated successfully`, {
      oldId: checkpoint.id,
      newId: newCheckpointId,
      sessionId: checkpoint.sessionId,
    });

    return migratedCheckpoint;
  }

  /**
   * Get storage key for a session
   */
  private getStorageKey(sessionId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${sessionId}`;
  }

  /**
   * Save checkpoint to storage
   */
  private async saveCheckpoint(checkpoint: EnrichmentCheckpoint): Promise<void> {
    const storage = await getStorage();
    const storageKey = this.getStorageKey(checkpoint.sessionId);
    await storage.save(storageKey, checkpoint);
  }

  /**
   * Load checkpoint by ID (searches all checkpoints)
   *
   * This method attempts to extract the session ID from the checkpoint ID
   * and then load the checkpoint from storage.
   *
   * @param checkpointId - Checkpoint ID to load
   * @returns Checkpoint if found, null otherwise
   */
  private async loadCheckpointById(checkpointId: string): Promise<EnrichmentCheckpoint | null> {
    try {
      // Try to extract session ID from checkpoint ID (new format only)
      const sessionId = this.extractSessionIdFromCheckpointId(checkpointId);

      // Load checkpoint using session ID
      const checkpoint = await this.loadCheckpoint(sessionId);

      // Verify the checkpoint ID matches (in case there are multiple checkpoints)
      if (checkpoint && checkpoint.id !== checkpointId) {
        this.logger.warn(`Checkpoint ID mismatch: expected ${checkpointId}, found ${checkpoint.id}`);
        return null;
      }

      return checkpoint;
    } catch (error) {
      if (error instanceof CheckpointError && error.code === 'OLD_CHECKPOINT_FORMAT') {
        // Old format checkpoint IDs cannot be loaded by ID alone
        // They require the session ID to be known beforehand
        this.logger.warn(
          `Cannot load checkpoint by ID - old format detected: ${checkpointId}. ` +
          `Old format checkpoints require session ID for lookup.`
        );
        return null;
      }

      this.logger.error('Failed to load checkpoint by ID', error);
      return null;
    }
  }

  /**
   * Validate checkpoint structure and data
   */
  private validateCheckpoint(checkpoint: EnrichmentCheckpoint): void {
    // Required fields
    if (!checkpoint.id) {
      throw new CheckpointError('Missing checkpoint ID', 'VALIDATION_FAILED', { checkpoint });
    }

    if (!checkpoint.sessionId) {
      throw new CheckpointError('Missing session ID', 'VALIDATION_FAILED', { checkpoint });
    }

    if (!checkpoint.createdAt) {
      throw new CheckpointError('Missing createdAt', 'VALIDATION_FAILED', { checkpoint });
    }

    if (!checkpoint.updatedAt) {
      throw new CheckpointError('Missing updatedAt', 'VALIDATION_FAILED', { checkpoint });
    }

    // Validate stage
    const validStages: EnrichmentStage[] = ['audio', 'video', 'summary'];
    if (!validStages.includes(checkpoint.stage)) {
      throw new CheckpointError(
        `Invalid stage: ${checkpoint.stage}`,
        'VALIDATION_FAILED',
        { checkpoint }
      );
    }

    // Validate progress
    if (typeof checkpoint.progress !== 'number' || checkpoint.progress < 0 || checkpoint.progress > 100) {
      throw new CheckpointError(
        `Invalid progress: ${checkpoint.progress}`,
        'VALIDATION_FAILED',
        { checkpoint }
      );
    }

    // Validate retry counts
    if (typeof checkpoint.retryCount !== 'number' || checkpoint.retryCount < 0) {
      throw new CheckpointError(
        `Invalid retryCount: ${checkpoint.retryCount}`,
        'VALIDATION_FAILED',
        { checkpoint }
      );
    }

    if (typeof checkpoint.maxRetries !== 'number' || checkpoint.maxRetries < 0) {
      throw new CheckpointError(
        `Invalid maxRetries: ${checkpoint.maxRetries}`,
        'VALIDATION_FAILED',
        { checkpoint }
      );
    }

    // Validate partial results structure
    if (!checkpoint.partialResults || typeof checkpoint.partialResults !== 'object') {
      throw new CheckpointError('Invalid partialResults', 'VALIDATION_FAILED', { checkpoint });
    }
  }

  /**
   * Create a logger for checkpoint operations
   */
  private createLogger() {
    const prefix = '[CheckpointService]';

    return {
      info: (message: string, data?: any) => {
        console.log(`${prefix} ${message}`, data || '');
      },
      warn: (message: string, data?: any) => {
        console.warn(`${prefix} ${message}`, data || '');
      },
      error: (message: string, error?: any) => {
        console.error(`${prefix} ${message}`, error || '');
      },
    };
  }
}

/**
 * Export singleton instance for convenience
 */
let checkpointServiceInstance: CheckpointService | null = null;

/**
 * Get the checkpoint service singleton instance
 */
export function getCheckpointService(): CheckpointService {
  if (!checkpointServiceInstance) {
    checkpointServiceInstance = new CheckpointService();
  }
  return checkpointServiceInstance;
}

/**
 * Reset checkpoint service instance (useful for testing)
 */
export function resetCheckpointService(): void {
  checkpointServiceInstance = null;
}
