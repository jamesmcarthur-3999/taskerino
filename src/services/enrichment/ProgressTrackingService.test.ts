/**
 * ProgressTrackingService Unit Tests
 *
 * Comprehensive test suite for progress tracking with real-time updates and ETA calculation.
 *
 * Test Coverage:
 * - Progress lifecycle (start, update, complete)
 * - Stage tracking (audio, video, summary, canvas)
 * - ETA calculation (time-based, NO COST)
 * - Batch progress tracking
 * - Event system
 *
 * @see docs/sessions-rewrite/PHASE_5_KICKOFF.md - Task 5.7 specification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ProgressTrackingService,
  resetProgressTrackingService,
  getProgressTrackingService,
  type EnrichmentProgress,
  type BatchProgress,
} from './ProgressTrackingService';

describe('ProgressTrackingService', () => {
  let progressService: ProgressTrackingService;

  beforeEach(() => {
    resetProgressTrackingService();
    progressService = new ProgressTrackingService();
  });

  afterEach(() => {
    if (progressService) {
      progressService.shutdown();
    }
    resetProgressTrackingService();
  });

  // ========================================
  // Progress Lifecycle Tests
  // ========================================

  describe('Progress Lifecycle', () => {
    it('should start progress tracking with initial state', () => {
      progressService.startProgress('session-1', {
        includeAudio: true,
        includeVideo: true,
        includeSummary: true,
        includeCanvas: false,
      });

      const progress = progressService.getProgress('session-1');

      expect(progress).toBeDefined();
      expect(progress!.sessionId).toBe('session-1');
      expect(progress!.stage).toBe('audio');
      expect(progress!.progress).toBe(0);
      expect(progress!.stages.audio.status).toBe('pending');
      expect(progress!.stages.video.status).toBe('pending');
      expect(progress!.stages.summary.status).toBe('pending');
      expect(progress!.stages.canvas.status).toBe('skipped');
    });

    it('should emit started event', () => {
      const listener = vi.fn();
      progressService.on('started', listener);

      progressService.startProgress('session-1');

      expect(listener).toHaveBeenCalledWith('session-1', expect.any(Object));
    });

    it('should update progress', () => {
      progressService.startProgress('session-1');

      progressService.updateProgress('session-1', {
        progress: 50,
        message: 'Processing audio...',
      });

      const progress = progressService.getProgress('session-1');
      expect(progress!.progress).toBe(50);
      expect(progress!.message).toBe('Processing audio...');
    });

    it('should emit progress event on update', () => {
      const listener = vi.fn();
      progressService.on('progress', listener);

      progressService.startProgress('session-1');
      progressService.updateProgress('session-1', {
        progress: 50,
        message: 'Processing...',
      });

      expect(listener).toHaveBeenCalledWith('session-1', expect.objectContaining({
        progress: 50,
      }));
    });

    it('should complete progress tracking', () => {
      progressService.startProgress('session-1');

      progressService.completeProgress('session-1', true, 'Enrichment complete!');

      const progress = progressService.getProgress('session-1');
      expect(progress!.stage).toBe('complete');
      expect(progress!.progress).toBe(100);
      expect(progress!.message).toBe('Enrichment complete!');
    });

    it('should emit completed event', () => {
      const listener = vi.fn();
      progressService.on('completed', listener);

      progressService.startProgress('session-1');
      progressService.completeProgress('session-1', true);

      expect(listener).toHaveBeenCalledWith('session-1', expect.any(Object));
    });

    it('should emit failed event on failure', () => {
      const listener = vi.fn();
      progressService.on('failed', listener);

      progressService.startProgress('session-1');
      progressService.completeProgress('session-1', false, 'Enrichment failed');

      expect(listener).toHaveBeenCalledWith('session-1', expect.any(Object));
    });
  });

  // ========================================
  // Stage Tracking Tests
  // ========================================

  describe('Stage Tracking', () => {
    it('should transition between stages', () => {
      progressService.startProgress('session-1');

      // Move to video stage
      progressService.updateProgress('session-1', {
        stage: 'video',
      });

      const progress = progressService.getProgress('session-1');
      expect(progress!.stage).toBe('video');
      expect(progress!.stages.audio.status).toBe('completed');
      expect(progress!.stages.video.status).toBe('processing');
    });

    it('should emit stage event on transition', () => {
      const listener = vi.fn();
      progressService.on('stage', listener);

      progressService.startProgress('session-1');
      progressService.updateProgress('session-1', {
        stage: 'video',
      });

      expect(listener).toHaveBeenCalledWith('session-1', 'video', expect.any(Object));
    });

    it('should update stage progress', () => {
      progressService.startProgress('session-1');

      progressService.updateStage('session-1', 'audio', {
        status: 'processing',
        progress: 75,
      });

      const progress = progressService.getProgress('session-1');
      expect(progress!.stages.audio.status).toBe('processing');
      expect(progress!.stages.audio.progress).toBe(75);
    });

    it('should mark previous stage as completed on transition', () => {
      progressService.startProgress('session-1');

      progressService.updateProgress('session-1', { stage: 'video' });

      const progress = progressService.getProgress('session-1');
      expect(progress!.stages.audio.status).toBe('completed');
      expect(progress!.stages.audio.progress).toBe(100);
    });
  });

  // ========================================
  // ETA Calculation Tests (NO COST)
  // ========================================

  describe('ETA Calculation', () => {
    it('should return null for ETA with no historical data', () => {
      progressService.startProgress('session-1');

      const eta = progressService.calculateETA('session-1');
      expect(eta).toBeNull();
    });

    it('should calculate ETA based on historical durations', async () => {
      // Complete a session to establish history
      progressService.startProgress('session-1');
      await new Promise((resolve) => setTimeout(resolve, 100));
      progressService.completeProgress('session-1', true);

      // Start new session
      progressService.startProgress('session-2');
      progressService.updateProgress('session-2', { progress: 50 });

      const eta = progressService.calculateETA('session-2');
      expect(eta).toBeGreaterThan(0);
    });

    it('should return 0 ETA for completed session', () => {
      progressService.startProgress('session-1');
      progressService.completeProgress('session-1', true);

      const eta = progressService.calculateETA('session-1');
      expect(eta).toBe(0);
    });
  });

  // ========================================
  // Batch Progress Tests
  // ========================================

  describe('Batch Progress Tracking', () => {
    it('should start batch tracking', () => {
      progressService.startBatch(['session-1', 'session-2', 'session-3']);

      const batch = progressService.getBatchProgress();
      expect(batch).toBeDefined();
      expect(batch!.total).toBe(3);
      expect(batch!.pending).toBe(3);
    });

    it('should update batch progress as sessions complete', () => {
      progressService.startBatch(['session-1', 'session-2']);

      progressService.startProgress('session-1');
      progressService.completeProgress('session-1', true);

      const batch = progressService.getBatchProgress();
      expect(batch!.completed).toBe(1);
      expect(batch!.pending).toBe(1);
      expect(batch!.progress).toBeGreaterThan(0);
    });

    it('should emit batch-update event', () => {
      const listener = vi.fn();
      progressService.on('batch-update', listener);

      progressService.startBatch(['session-1']);
      progressService.startProgress('session-1');
      progressService.completeProgress('session-1', true);

      expect(listener).toHaveBeenCalled();
    });

    it('should calculate batch ETA', async () => {
      // Complete one session for history
      progressService.startProgress('session-0');
      await new Promise((resolve) => setTimeout(resolve, 100));
      progressService.completeProgress('session-0', true);

      // Start batch
      progressService.startBatch(['session-1', 'session-2']);
      progressService.startProgress('session-1');

      const batch = progressService.getBatchProgress();
      expect(batch!.estimatedTimeRemaining).toBeGreaterThan(0);
    });

    it('should generate user-friendly batch messages (NO COST)', () => {
      progressService.startBatch(['session-1', 'session-2', 'session-3']);

      progressService.startProgress('session-1');

      const batch = progressService.getBatchProgress();
      expect(batch!.message).toContain('Enriching');
      expect(batch!.message).not.toContain('$'); // NO cost
      expect(batch!.message).not.toContain('cost');
    });
  });

  // ========================================
  // Progress Retrieval Tests
  // ========================================

  describe('Progress Retrieval', () => {
    it('should get all progress entries', () => {
      progressService.startProgress('session-1');
      progressService.startProgress('session-2');
      progressService.startProgress('session-3');

      const allProgress = progressService.getAllProgress();
      expect(allProgress).toHaveLength(3);
    });

    it('should return null for non-existent session', () => {
      const progress = progressService.getProgress('non-existent');
      expect(progress).toBeNull();
    });

    it('should clear progress for session', () => {
      progressService.startProgress('session-1');
      progressService.clearProgress('session-1');

      const progress = progressService.getProgress('session-1');
      expect(progress).toBeNull();
    });

    it('should clear all progress', () => {
      progressService.startProgress('session-1');
      progressService.startProgress('session-2');

      progressService.clearAllProgress();

      const allProgress = progressService.getAllProgress();
      expect(allProgress).toHaveLength(0);
    });
  });

  // ========================================
  // Singleton Tests
  // ========================================

  describe('Singleton Pattern', () => {
    it('should return same instance from getProgressTrackingService', () => {
      const service1 = getProgressTrackingService();
      const service2 = getProgressTrackingService();

      expect(service1).toBe(service2);
    });

    it('should create new instance after reset', () => {
      const service1 = getProgressTrackingService();
      service1.shutdown();
      resetProgressTrackingService();

      const service2 = getProgressTrackingService();
      expect(service2).not.toBe(service1);
    });
  });
});
