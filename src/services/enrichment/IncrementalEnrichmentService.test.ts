/**
 * IncrementalEnrichmentService Tests - Phase 5 Wave 1 Task 5.2
 *
 * Comprehensive test suite for incremental enrichment functionality:
 * - Checkpoint creation and retrieval
 * - Delta detection accuracy
 * - Hash generation and validation
 * - Incremental processing logic
 * - Fallback scenarios
 * - Cost savings estimation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  IncrementalEnrichmentService,
  getIncrementalEnrichmentService,
  resetIncrementalEnrichmentService,
  type EnrichmentCheckpoint,
  type EnrichmentDelta,
} from './IncrementalEnrichmentService';
import type { Session, SessionScreenshot, SessionAudioSegment } from '../../types';
// Mock storage
vi.mock('../storage', () => ({
  getStorage: vi.fn(() => ({
    load: vi.fn(),
    save: vi.fn(),
  })),
}));

describe('IncrementalEnrichmentService', () => {
  let service: IncrementalEnrichmentService;
  let mockStorage: any;

  beforeEach(async () => {
    // Reset service instance
    resetIncrementalEnrichmentService();
    service = getIncrementalEnrichmentService();

    // Setup mock storage
    const { getStorage } = await import('../storage');
    mockStorage = await getStorage();

    // Clear mock calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Checkpoint Creation & Retrieval
  // ============================================================================

  describe('getCheckpoint', () => {
    it('should return null if no checkpoint exists', async () => {
      mockStorage.load.mockResolvedValue(null);

      const checkpoint = await service.getCheckpoint('session-123');

      expect(checkpoint).toBeNull();
      expect(mockStorage.load).toHaveBeenCalledWith(
        'sessions/session-123/enrichment-checkpoint'
      );
    });

    it('should return checkpoint if exists', async () => {
      const mockCheckpoint: EnrichmentCheckpoint = {
        sessionId: 'session-123',
        lastEnrichmentTime: '2025-10-26T12:00:00Z',
        lastScreenshotIndex: 10,
        lastAudioSegmentIndex: 5,
        audioHash: 'abc123',
        videoHash: 'def456',
        modelVersion: 'gpt-4o-audio-preview-2024-10-01',
        enrichmentVersion: 1,
        totalCost: 0.5,
        screenshotsProcessed: 11,
        audioSegmentsProcessed: 6,
      };

      mockStorage.load.mockResolvedValue(mockCheckpoint);

      const checkpoint = await service.getCheckpoint('session-123');

      expect(checkpoint).toEqual(mockCheckpoint);
    });

    it('should handle errors gracefully and return null', async () => {
      mockStorage.load.mockRejectedValue(new Error('Storage error'));

      const checkpoint = await service.getCheckpoint('session-123');

      expect(checkpoint).toBeNull();
    });
  });

  describe('createCheckpoint', () => {
    it('should create initial checkpoint with correct data', async () => {
      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: [
          { id: 'shot-1', timestamp: '2025-10-26T12:00:00Z', attachmentId: 'att-1' },
          { id: 'shot-2', timestamp: '2025-10-26T12:05:00Z', attachmentId: 'att-2' },
        ] as SessionScreenshot[],
        audioSegments: [
          { id: 'audio-1', startTime: 0, duration: 60 },
        ] as SessionAudioSegment[],
      };

      await service.createCheckpoint('session-123', session as Session, 0.5);

      expect(mockStorage.save).toHaveBeenCalled();
      const savedCheckpoint = mockStorage.save.mock.calls[0][1] as EnrichmentCheckpoint;

      expect(savedCheckpoint.sessionId).toBe('session-123');
      expect(savedCheckpoint.lastScreenshotIndex).toBe(1); // 2 screenshots, index 1
      expect(savedCheckpoint.lastAudioSegmentIndex).toBe(0); // 1 segment, index 0
      expect(savedCheckpoint.totalCost).toBe(0.5);
      expect(savedCheckpoint.screenshotsProcessed).toBe(2);
      expect(savedCheckpoint.audioSegmentsProcessed).toBe(1);
      expect(savedCheckpoint.enrichmentVersion).toBe(1);
    });

    it('should handle session with no audio segments', async () => {
      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: [
          { id: 'shot-1', timestamp: '2025-10-26T12:00:00Z', attachmentId: 'att-1' },
        ] as SessionScreenshot[],
        audioSegments: undefined,
      };

      await service.createCheckpoint('session-123', session as Session, 0.2);

      const savedCheckpoint = mockStorage.save.mock.calls[0][1] as EnrichmentCheckpoint;

      expect(savedCheckpoint.lastAudioSegmentIndex).toBe(-1);
      expect(savedCheckpoint.audioSegmentsProcessed).toBe(0);
      expect(savedCheckpoint.audioHash).toBe('');
    });
  });

  describe('updateCheckpoint', () => {
    it('should update existing checkpoint with new data', async () => {
      const existingCheckpoint: EnrichmentCheckpoint = {
        sessionId: 'session-123',
        lastEnrichmentTime: '2025-10-26T12:00:00Z',
        lastScreenshotIndex: 5,
        lastAudioSegmentIndex: 3,
        audioHash: 'old-hash',
        videoHash: 'old-video-hash',
        modelVersion: 'gpt-4o-audio-preview-2024-10-01',
        enrichmentVersion: 1,
        totalCost: 0.5,
        screenshotsProcessed: 6,
        audioSegmentsProcessed: 4,
      };

      mockStorage.load.mockResolvedValue(existingCheckpoint);

      await service.updateCheckpoint('session-123', {
        lastScreenshotIndex: 10,
        lastAudioSegmentIndex: 7,
        audioHash: 'new-hash',
        videoHash: 'new-video-hash',
        additionalCost: 0.3,
        additionalScreenshots: 5,
        additionalAudioSegments: 4,
      });

      const savedCheckpoint = mockStorage.save.mock.calls[0][1] as EnrichmentCheckpoint;

      expect(savedCheckpoint.lastScreenshotIndex).toBe(10);
      expect(savedCheckpoint.lastAudioSegmentIndex).toBe(7);
      expect(savedCheckpoint.audioHash).toBe('new-hash');
      expect(savedCheckpoint.videoHash).toBe('new-video-hash');
      expect(savedCheckpoint.totalCost).toBe(0.8); // 0.5 + 0.3
      expect(savedCheckpoint.screenshotsProcessed).toBe(11); // 6 + 5
      expect(savedCheckpoint.audioSegmentsProcessed).toBe(8); // 4 + 4
    });

    it('should throw error if checkpoint not found', async () => {
      mockStorage.load.mockResolvedValue(null);

      await expect(
        service.updateCheckpoint('session-123', {
          lastScreenshotIndex: 10,
        })
      ).rejects.toThrow('Checkpoint not found');
    });
  });

  // ============================================================================
  // Delta Detection
  // ============================================================================

  describe('detectDelta', () => {
    it('should detect new screenshots correctly', async () => {
      const checkpoint: EnrichmentCheckpoint = {
        sessionId: 'session-123',
        lastEnrichmentTime: '2025-10-26T12:00:00Z',
        lastScreenshotIndex: 1, // Last processed: index 1 (2 screenshots)
        lastAudioSegmentIndex: 0,
        audioHash: 'abc123',
        videoHash: 'def456',
        modelVersion: 'gpt-4o-audio-preview-2024-10-01',
        enrichmentVersion: 1,
        totalCost: 0.5,
        screenshotsProcessed: 2,
        audioSegmentsProcessed: 1,
      };

      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: [
          { id: 'shot-1', timestamp: '2025-10-26T12:00:00Z', attachmentId: 'att-1' },
          { id: 'shot-2', timestamp: '2025-10-26T12:05:00Z', attachmentId: 'att-2' },
          { id: 'shot-3', timestamp: '2025-10-26T12:10:00Z', attachmentId: 'att-3' }, // NEW
          { id: 'shot-4', timestamp: '2025-10-26T12:15:00Z', attachmentId: 'att-4' }, // NEW
        ] as SessionScreenshot[],
        audioSegments: [
          { id: 'audio-1', startTime: 0, duration: 60 },
        ] as SessionAudioSegment[],
      };

      const delta = await service.detectDelta(session as Session, checkpoint);

      expect(delta.newScreenshots).toHaveLength(2);
      expect(delta.newScreenshots[0].id).toBe('shot-3');
      expect(delta.newScreenshots[1].id).toBe('shot-4');
    });

    it('should detect new audio segments correctly', async () => {
      const checkpoint: EnrichmentCheckpoint = {
        sessionId: 'session-123',
        lastEnrichmentTime: '2025-10-26T12:00:00Z',
        lastScreenshotIndex: 1,
        lastAudioSegmentIndex: 0, // Last processed: index 0 (1 segment)
        audioHash: 'abc123',
        videoHash: 'def456',
        modelVersion: 'gpt-4o-audio-preview-2024-10-01',
        enrichmentVersion: 1,
        totalCost: 0.5,
        screenshotsProcessed: 2,
        audioSegmentsProcessed: 1,
      };

      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: [
          { id: 'shot-1', timestamp: '2025-10-26T12:00:00Z', attachmentId: 'att-1' },
          { id: 'shot-2', timestamp: '2025-10-26T12:05:00Z', attachmentId: 'att-2' },
        ] as SessionScreenshot[],
        audioSegments: [
          { id: 'audio-1', startTime: 0, duration: 60 },
          { id: 'audio-2', startTime: 60, duration: 60 }, // NEW
          { id: 'audio-3', startTime: 120, duration: 60 }, // NEW
        ] as SessionAudioSegment[],
      };

      const delta = await service.detectDelta(session as Session, checkpoint);

      expect(delta.newAudioSegments).toHaveLength(2);
      expect(delta.newAudioSegments[0].id).toBe('audio-2');
      expect(delta.newAudioSegments[1].id).toBe('audio-3');
    });

    it('should require full regeneration if audio hash changed', async () => {
      const checkpoint: EnrichmentCheckpoint = {
        sessionId: 'session-123',
        lastEnrichmentTime: '2025-10-26T12:00:00Z',
        lastScreenshotIndex: 1,
        lastAudioSegmentIndex: 0,
        audioHash: 'OLD_HASH', // Different from current
        videoHash: 'def456',
        modelVersion: 'gpt-4o-audio-preview-2024-10-01',
        enrichmentVersion: 1,
        totalCost: 0.5,
        screenshotsProcessed: 2,
        audioSegmentsProcessed: 1,
      };

      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: [
          { id: 'shot-1', timestamp: '2025-10-26T12:00:00Z', attachmentId: 'att-1' },
          { id: 'shot-2', timestamp: '2025-10-26T12:05:00Z', attachmentId: 'att-2' },
        ] as SessionScreenshot[],
        audioSegments: [
          { id: 'audio-1', startTime: 0, duration: 60 }, // Same segment but hash will be different
        ] as SessionAudioSegment[],
      };

      const delta = await service.detectDelta(session as Session, checkpoint);

      expect(delta.audioChanged).toBe(true);
      expect(delta.requiresFullRegeneration).toBe(true);
      expect(delta.fullRegenerationReasons).toContain('Audio data changed (hash mismatch)');
    });

    it('should require full regeneration if model upgraded', async () => {
      const checkpoint: EnrichmentCheckpoint = {
        sessionId: 'session-123',
        lastEnrichmentTime: '2025-10-26T12:00:00Z',
        lastScreenshotIndex: 1,
        lastAudioSegmentIndex: 0,
        audioHash: 'abc123',
        videoHash: 'def456',
        modelVersion: 'gpt-3.5-turbo', // OLD MODEL
        enrichmentVersion: 1,
        totalCost: 0.5,
        screenshotsProcessed: 2,
        audioSegmentsProcessed: 1,
      };

      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: [
          { id: 'shot-1', timestamp: '2025-10-26T12:00:00Z', attachmentId: 'att-1' },
        ] as SessionScreenshot[],
        audioSegments: [],
      };

      const delta = await service.detectDelta(session as Session, checkpoint);

      expect(delta.modelUpgraded).toBe(true);
      expect(delta.requiresFullRegeneration).toBe(true);
      expect(delta.fullRegenerationReasons.length).toBeGreaterThan(0);
    });

    it('should require full regeneration if enrichment version upgraded', async () => {
      const checkpoint: EnrichmentCheckpoint = {
        sessionId: 'session-123',
        lastEnrichmentTime: '2025-10-26T12:00:00Z',
        lastScreenshotIndex: 1,
        lastAudioSegmentIndex: 0,
        audioHash: 'abc123',
        videoHash: 'def456',
        modelVersion: 'gpt-4o-audio-preview-2024-10-01',
        enrichmentVersion: 0, // OLD VERSION
        totalCost: 0.5,
        screenshotsProcessed: 2,
        audioSegmentsProcessed: 1,
      };

      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: [
          { id: 'shot-1', timestamp: '2025-10-26T12:00:00Z', attachmentId: 'att-1' },
        ] as SessionScreenshot[],
        audioSegments: [],
      };

      const delta = await service.detectDelta(session as Session, checkpoint);

      expect(delta.requiresFullRegeneration).toBe(true);
      expect(delta.fullRegenerationReasons.some(r => r.includes('schema upgraded'))).toBe(true);
    });

    it('should not require full regeneration if only new data added', async () => {
      const checkpoint: EnrichmentCheckpoint = {
        sessionId: 'session-123',
        lastEnrichmentTime: '2025-10-26T12:00:00Z',
        lastScreenshotIndex: 1,
        lastAudioSegmentIndex: 0,
        audioHash: '', // Will match empty
        videoHash: '', // Will be recalculated
        modelVersion: 'gpt-4o-audio-preview-2024-10-01',
        enrichmentVersion: 1,
        totalCost: 0.5,
        screenshotsProcessed: 2,
        audioSegmentsProcessed: 1,
      };

      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: [
          { id: 'shot-1', timestamp: '2025-10-26T12:00:00Z', attachmentId: 'att-1' },
          { id: 'shot-2', timestamp: '2025-10-26T12:05:00Z', attachmentId: 'att-2' },
          { id: 'shot-3', timestamp: '2025-10-26T12:10:00Z', attachmentId: 'att-3' }, // NEW
        ] as SessionScreenshot[],
        audioSegments: [],
      };

      const delta = await service.detectDelta(session as Session, checkpoint);

      expect(delta.newScreenshots).toHaveLength(1);
      expect(delta.requiresFullRegeneration).toBe(false);
    });
  });

  // ============================================================================
  // Incremental Enrichment Capability
  // ============================================================================

  describe('canEnrichIncrementally', () => {
    it('should return false if no checkpoint exists', async () => {
      mockStorage.load.mockResolvedValue(null);

      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: [],
        audioSegments: [],
      };

      const canEnrich = await service.canEnrichIncrementally(session as Session);

      expect(canEnrich).toBe(false);
    });

    it('should return true if checkpoint exists and no full regeneration needed', async () => {
      const checkpoint: EnrichmentCheckpoint = {
        sessionId: 'session-123',
        lastEnrichmentTime: '2025-10-26T12:00:00Z',
        lastScreenshotIndex: 1,
        lastAudioSegmentIndex: 0,
        audioHash: '',
        videoHash: '',
        modelVersion: 'gpt-4o-audio-preview-2024-10-01',
        enrichmentVersion: 1,
        totalCost: 0.5,
        screenshotsProcessed: 2,
        audioSegmentsProcessed: 1,
      };

      mockStorage.load.mockResolvedValue(checkpoint);

      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: [
          { id: 'shot-1', timestamp: '2025-10-26T12:00:00Z', attachmentId: 'att-1' },
          { id: 'shot-2', timestamp: '2025-10-26T12:05:00Z', attachmentId: 'att-2' },
          { id: 'shot-3', timestamp: '2025-10-26T12:10:00Z', attachmentId: 'att-3' }, // NEW
        ] as SessionScreenshot[],
        audioSegments: [],
      };

      const canEnrich = await service.canEnrichIncrementally(session as Session);

      expect(canEnrich).toBe(true);
    });

    it('should return false if full regeneration is required', async () => {
      const checkpoint: EnrichmentCheckpoint = {
        sessionId: 'session-123',
        lastEnrichmentTime: '2025-10-26T12:00:00Z',
        lastScreenshotIndex: 1,
        lastAudioSegmentIndex: 0,
        audioHash: 'abc123',
        videoHash: 'def456',
        modelVersion: 'gpt-3.5-turbo', // OLD MODEL
        enrichmentVersion: 1,
        totalCost: 0.5,
        screenshotsProcessed: 2,
        audioSegmentsProcessed: 1,
      };

      mockStorage.load.mockResolvedValue(checkpoint);

      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: [
          { id: 'shot-1', timestamp: '2025-10-26T12:00:00Z', attachmentId: 'att-1' },
        ] as SessionScreenshot[],
        audioSegments: [],
      };

      const canEnrich = await service.canEnrichIncrementally(session as Session);

      expect(canEnrich).toBe(false);
    });
  });

  // ============================================================================
  // Cost Savings Estimation
  // ============================================================================

  describe('estimateCostSavings', () => {
    it('should return 0 if full regeneration required', () => {
      const delta: EnrichmentDelta = {
        newScreenshots: [],
        newAudioSegments: [],
        audioChanged: false,
        videoChanged: false,
        modelUpgraded: true,
        requiresFullRegeneration: true,
        fullRegenerationReasons: ['Model upgraded'],
      };

      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: [
          { id: 'shot-1', timestamp: '2025-10-26T12:00:00Z', attachmentId: 'att-1' },
        ] as SessionScreenshot[],
        audioSegments: [],
      };

      const savings = service.estimateCostSavings(session as Session, delta);

      expect(savings).toBe(0);
    });

    it('should estimate savings for skipped screenshots', () => {
      const delta: EnrichmentDelta = {
        newScreenshots: [
          { id: 'shot-11', timestamp: '2025-10-26T12:00:00Z', attachmentId: 'att-11' },
        ] as SessionScreenshot[], // 1 new screenshot
        newAudioSegments: [],
        audioChanged: false,
        videoChanged: false,
        modelUpgraded: false,
        requiresFullRegeneration: false,
        fullRegenerationReasons: [],
      };

      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: Array(11).fill(null).map((_, i) => ({
          id: `shot-${i + 1}`,
          timestamp: '2025-10-26T12:00:00Z',
          attachmentId: `att-${i + 1}`,
        })) as SessionScreenshot[], // 11 total screenshots
        audioSegments: [],
      };

      const savings = service.estimateCostSavings(session as Session, delta);

      // 10 screenshots skipped * $0.002 per screenshot = $0.02
      expect(savings).toBeCloseTo(0.02, 4);
    });

    it('should estimate savings for skipped audio segments', () => {
      const delta: EnrichmentDelta = {
        newScreenshots: [],
        newAudioSegments: [
          { id: 'audio-6', startTime: 300, duration: 60 }, // 1 new segment
        ] as SessionAudioSegment[],
        audioChanged: false,
        videoChanged: false,
        modelUpgraded: false,
        requiresFullRegeneration: false,
        fullRegenerationReasons: [],
      };

      const session: Partial<Session> = {
        id: 'session-123',
        screenshots: [],
        audioSegments: Array(6).fill(null).map((_, i) => ({
          id: `audio-${i + 1}`,
          startTime: i * 60,
          duration: 60, // 60 seconds each
        })) as SessionAudioSegment[], // 6 segments total, 6 minutes
      };

      const savings = service.estimateCostSavings(session as Session, delta);

      // 5 segments skipped * 1 minute each * $0.026 per minute = $0.13
      expect(savings).toBeCloseTo(0.13, 2);
    });
  });

  // ============================================================================
  // Singleton Pattern
  // ============================================================================

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getIncrementalEnrichmentService();
      const instance2 = getIncrementalEnrichmentService();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton correctly', () => {
      const instance1 = getIncrementalEnrichmentService();
      resetIncrementalEnrichmentService();
      const instance2 = getIncrementalEnrichmentService();

      expect(instance1).not.toBe(instance2);
    });
  });
});
