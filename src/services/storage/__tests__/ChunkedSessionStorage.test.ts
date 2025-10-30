/**
 * ChunkedSessionStorage Tests
 *
 * Comprehensive test suite for chunked session storage system.
 * Tests metadata loading, chunk splitting, reconstruction, append operations,
 * and migration from legacy format.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChunkedSessionStorage, SessionMetadata, CacheStats } from '../ChunkedSessionStorage';
import type { StorageAdapter } from '../StorageAdapter';
import type {
  Session,
  SessionScreenshot,
  SessionAudioSegment,
  SessionVideoChunk,
  SessionSummary,
  AudioInsights,
  CanvasSpec,
  SessionContextItem,
} from '../../../types';

// ============================================================================
// MOCK STORAGE ADAPTER
// ============================================================================

class MockStorageAdapter implements Partial<StorageAdapter> {
  private storage = new Map<string, any>();

  async init(): Promise<void> {
    // No-op
  }

  async save<T>(collection: string, data: T): Promise<void> {
    this.storage.set(collection, JSON.parse(JSON.stringify(data)));
  }

  async load<T>(collection: string): Promise<T | null> {
    const data = this.storage.get(collection);
    return data ? JSON.parse(JSON.stringify(data)) : null;
  }

  async delete(collection: string): Promise<void> {
    this.storage.delete(collection);
  }

  async exists(collection: string): Promise<boolean> {
    return this.storage.has(collection);
  }

  clear(): void {
    this.storage.clear();
  }

  getAll(): Map<string, any> {
    return new Map(this.storage);
  }
}

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

function createMockScreenshot(sessionId: string, index: number): SessionScreenshot {
  return {
    id: `screenshot-${index}`,
    sessionId,
    timestamp: new Date(Date.now() + index * 1000).toISOString(),
    attachmentId: `attachment-${index}`,
    analysisStatus: 'complete',
    aiAnalysis: {
      summary: `Screenshot ${index}`,
      detectedActivity: 'coding',
      extractedText: `Text ${index}`,
      keyElements: [`Element ${index}`],
      confidence: 0.9,
    },
  };
}

function createMockAudioSegment(sessionId: string, index: number): SessionAudioSegment {
  return {
    id: `audio-${index}`,
    sessionId,
    timestamp: new Date(Date.now() + index * 1000).toISOString(),
    duration: 10,
    transcription: `Transcription ${index}`,
    attachmentId: `audio-attachment-${index}`,
    hash: `mock-sha256-hash-audio-${index.toString().padStart(3, '0')}`, // Mock CA storage hash
  };
}

function createMockVideoChunk(sessionId: string, index: number): SessionVideoChunk {
  return {
    id: `video-chunk-${index}`,
    videoId: 'video-1',
    sessionId,
    attachmentId: `video-attachment-${index}`,
    startTime: index * 30,
    endTime: (index + 1) * 30,
    topic: `Topic ${index}`,
    description: `Description ${index}`,
    transcriptExcerpt: `Transcript ${index}`,
    relatedScreenshotIds: [],
    relatedAudioSegmentIds: [],
    analyzed: false,
  };
}

function createMockSession(options: {
  id?: string;
  screenshotCount?: number;
  audioSegmentCount?: number;
  videoChunkCount?: number;
  hasSummary?: boolean;
  hasAudioInsights?: boolean;
  hasCanvasSpec?: boolean;
  hasTranscription?: boolean;
  hasContextItems?: boolean;
}): Session {
  const id = options.id || 'session-1';
  const screenshotCount = options.screenshotCount || 0;
  const audioSegmentCount = options.audioSegmentCount || 0;
  const videoChunkCount = options.videoChunkCount || 0;

  const screenshots = Array.from({ length: screenshotCount }, (_, i) =>
    createMockScreenshot(id, i)
  );

  const audioSegments =
    audioSegmentCount > 0
      ? Array.from({ length: audioSegmentCount }, (_, i) => createMockAudioSegment(id, i))
      : undefined;

  const videoChunks =
    videoChunkCount > 0
      ? Array.from({ length: videoChunkCount }, (_, i) => createMockVideoChunk(id, i))
      : undefined;

  const session: Session = {
    id,
    name: 'Test Session',
    description: 'Test Description',
    status: 'completed',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'transcription',
    audioRecording: false,
    extractedTaskIds: [],
    extractedNoteIds: [],
    screenshots,
    audioSegments,
    tags: [],
    audioReviewCompleted: false,
  };

  if (options.hasSummary) {
    session.summary = {
      schemaVersion: '2.0',
      id: 'summary-1',
      generatedAt: new Date().toISOString(),
      sessionContext: {
        sessionId: id,
        sessionName: 'Test Session',
        startTime: session.startTime,
        duration: 60,
        screenshotCount,
      },
      narrative: 'Test narrative',
      sections: [],
      generationMetadata: {
        reasoning: 'Test',
        confidence: 0.9,
        detectedSessionType: 'deep-work',
        primaryTheme: 'coding',
        emphasis: 'achievement-focused',
        dataSources: {
          screenshots: true,
          audio: false,
          video: false,
          audioInsights: false,
          videoChapters: false,
        },
      },
    };
  }

  if (options.hasAudioInsights) {
    session.audioInsights = {
      overallNarrative: 'Test audio narrative',
      emotionalJourney: [],
      keyMoments: [],
      workPatterns: {
        focusPeriods: [],
        interruptionCount: 0,
        totalFocusTime: 0,
        averageFocusDuration: 0,
      },
      vocabulary: {
        technicalTerms: [],
        domainConcepts: [],
        jargonLevel: 'medium',
      },
      summary: {
        predominantEmotion: 'neutral',
        energyLevel: 'medium',
        overallSentiment: 'neutral',
        keyTakeaways: [],
      },
    };
  }

  if (options.hasCanvasSpec) {
    session.canvasSpec = {
      layout: 'default',
      modules: [],
    };
  }

  if (options.hasTranscription) {
    session.fullTranscription = 'Full transcription text goes here...';
  }

  if (options.hasContextItems) {
    session.contextItems = [
      {
        type: 'note',
        content: 'Test context item',
        timestamp: new Date().toISOString(),
        attachments: [],
      },
    ];
  }

  if (videoChunks && videoChunks.length > 0) {
    session.video = {
      id: 'video-1',
      sessionId: id,
      fullVideoAttachmentId: 'video-attachment-full',
      chunks: videoChunks,
      duration: videoChunks.length * 30,
      chunkingStatus: 'complete',
    };
  }

  return session;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('ChunkedSessionStorage', () => {
  let adapter: MockStorageAdapter;
  let storage: ChunkedSessionStorage;

  beforeEach(() => {
    adapter = new MockStorageAdapter();
    storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
  });

  // ==========================================================================
  // METADATA OPERATIONS
  // ==========================================================================

  describe('Metadata save/load cycle', () => {
    it('should save and load metadata', async () => {
      const session = createMockSession({ id: 'test-1', screenshotCount: 10 });
      await storage.saveFullSession(session);

      const metadata = await storage.loadMetadata('test-1');
      expect(metadata).not.toBeNull();
      expect(metadata!.id).toBe('test-1');
      expect(metadata!.name).toBe('Test Session');
      expect(metadata!.storageVersion).toBe(1);
      expect(metadata!.chunks.screenshots.count).toBe(10);
    });

    it('should return null for non-existent session', async () => {
      const metadata = await storage.loadMetadata('non-existent');
      expect(metadata).toBeNull();
    });

    it('should cache metadata after first load', async () => {
      const session = createMockSession({ id: 'test-1' });
      await storage.saveFullSession(session);

      // First load
      await storage.loadMetadata('test-1');

      // Clear adapter storage to test cache
      adapter.clear();

      // Second load should hit cache
      const metadata = await storage.loadMetadata('test-1');
      expect(metadata).not.toBeNull();

      const stats = storage.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should update metadata timestamps', async () => {
      const session = createMockSession({ id: 'test-1' });
      await storage.saveFullSession(session);

      const metadata1 = await storage.loadMetadata('test-1');
      const updatedAt1 = metadata1!.updatedAt;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update and save again
      await storage.saveMetadata(metadata1!);

      const metadata2 = await storage.loadMetadata('test-1');
      const updatedAt2 = metadata2!.updatedAt;

      expect(new Date(updatedAt2).getTime()).toBeGreaterThan(
        new Date(updatedAt1).getTime()
      );
    });
  });

  // ==========================================================================
  // CHUNK SPLITTING LOGIC
  // ==========================================================================

  describe('Screenshot chunking', () => {
    it('should split 40 screenshots into 2 chunks of 20', async () => {
      const session = createMockSession({ screenshotCount: 40 });
      await storage.saveFullSession(session);

      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.chunks.screenshots.chunkCount).toBe(2);
      expect(metadata!.chunks.screenshots.count).toBe(40);
      expect(metadata!.chunks.screenshots.chunkSize).toBe(20);

      const chunk0 = await storage.loadScreenshotsChunk(session.id, 0);
      expect(chunk0.length).toBe(20);

      const chunk1 = await storage.loadScreenshotsChunk(session.id, 1);
      expect(chunk1.length).toBe(20);
    });

    it('should handle partial last chunk (25 screenshots → 2 chunks)', async () => {
      const session = createMockSession({ screenshotCount: 25 });
      await storage.saveFullSession(session);

      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.chunks.screenshots.chunkCount).toBe(2);

      const chunk0 = await storage.loadScreenshotsChunk(session.id, 0);
      expect(chunk0.length).toBe(20);

      const chunk1 = await storage.loadScreenshotsChunk(session.id, 1);
      expect(chunk1.length).toBe(5);
    });

    it('should create single chunk for < 20 screenshots', async () => {
      const session = createMockSession({ screenshotCount: 10 });
      await storage.saveFullSession(session);

      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.chunks.screenshots.chunkCount).toBe(1);

      const chunk0 = await storage.loadScreenshotsChunk(session.id, 0);
      expect(chunk0.length).toBe(10);
    });

    it('should handle zero screenshots', async () => {
      const session = createMockSession({ screenshotCount: 0 });
      await storage.saveFullSession(session);

      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.chunks.screenshots.chunkCount).toBe(0);
      expect(metadata!.chunks.screenshots.count).toBe(0);

      const screenshots = await storage.loadAllScreenshots(session.id);
      expect(screenshots).toEqual([]);
    });
  });

  describe('Audio segment chunking', () => {
    it('should split 200 segments into 2 chunks of 100', async () => {
      const session = createMockSession({ audioSegmentCount: 200 });
      await storage.saveFullSession(session);

      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.chunks.audioSegments.chunkCount).toBe(2);
      expect(metadata!.chunks.audioSegments.count).toBe(200);

      const chunk0 = await storage.loadAudioSegmentsChunk(session.id, 0);
      expect(chunk0.length).toBe(100);

      const chunk1 = await storage.loadAudioSegmentsChunk(session.id, 1);
      expect(chunk1.length).toBe(100);
    });

    it('should handle partial last chunk (150 segments → 2 chunks)', async () => {
      const session = createMockSession({ audioSegmentCount: 150 });
      await storage.saveFullSession(session);

      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.chunks.audioSegments.chunkCount).toBe(2);

      const chunk0 = await storage.loadAudioSegmentsChunk(session.id, 0);
      expect(chunk0.length).toBe(100);

      const chunk1 = await storage.loadAudioSegmentsChunk(session.id, 1);
      expect(chunk1.length).toBe(50);
    });
  });

  describe('Video chunk chunking', () => {
    it('should split 200 video chunks into 2 chunks of 100', async () => {
      const session = createMockSession({ videoChunkCount: 200 });
      await storage.saveFullSession(session);

      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.chunks.videoChunks.chunkCount).toBe(2);
      expect(metadata!.chunks.videoChunks.count).toBe(200);

      const chunk0 = await storage.loadVideoChunksChunk(session.id, 0);
      expect(chunk0.length).toBe(100);

      const chunk1 = await storage.loadVideoChunksChunk(session.id, 1);
      expect(chunk1.length).toBe(100);
    });
  });

  // ==========================================================================
  // CHUNK RECONSTRUCTION
  // ==========================================================================

  describe('Chunk reconstruction', () => {
    it('should reconstruct all screenshots from chunks', async () => {
      const session = createMockSession({ screenshotCount: 50 });
      await storage.saveFullSession(session);

      const screenshots = await storage.loadAllScreenshots(session.id);
      expect(screenshots.length).toBe(50);

      // Verify order is preserved
      for (let i = 0; i < 50; i++) {
        expect(screenshots[i].id).toBe(`screenshot-${i}`);
      }
    });

    it('should reconstruct all audio segments from chunks', async () => {
      const session = createMockSession({ audioSegmentCount: 250 });
      await storage.saveFullSession(session);

      const segments = await storage.loadAllAudioSegments(session.id);
      expect(segments.length).toBe(250);

      // Verify order is preserved
      for (let i = 0; i < 250; i++) {
        expect(segments[i].id).toBe(`audio-${i}`);
      }
    });

    it('should reconstruct all video chunks from chunks', async () => {
      const session = createMockSession({ videoChunkCount: 150 });
      await storage.saveFullSession(session);

      const videoChunks = await storage.loadAllVideoChunks(session.id);
      expect(videoChunks.length).toBe(150);

      // Verify order is preserved
      for (let i = 0; i < 150; i++) {
        expect(videoChunks[i].id).toBe(`video-chunk-${i}`);
      }
    });
  });

  // ==========================================================================
  // APPEND OPERATIONS
  // ==========================================================================

  describe('Append screenshot', () => {
    it('should append screenshot to existing chunk', async () => {
      const session = createMockSession({ screenshotCount: 10 });
      await storage.saveFullSession(session);

      const newScreenshot = createMockScreenshot(session.id, 10);
      await storage.appendScreenshot(session.id, newScreenshot);

      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.chunks.screenshots.count).toBe(11);
      expect(metadata!.chunks.screenshots.chunkCount).toBe(1);

      const chunk = await storage.loadScreenshotsChunk(session.id, 0);
      expect(chunk.length).toBe(11);
      expect(chunk[10].id).toBe('screenshot-10');
    });

    it('should create new chunk when appending to full chunk', async () => {
      const session = createMockSession({ screenshotCount: 20 });
      await storage.saveFullSession(session);

      const newScreenshot = createMockScreenshot(session.id, 20);
      await storage.appendScreenshot(session.id, newScreenshot);

      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.chunks.screenshots.count).toBe(21);
      expect(metadata!.chunks.screenshots.chunkCount).toBe(2);

      const chunk0 = await storage.loadScreenshotsChunk(session.id, 0);
      expect(chunk0.length).toBe(20);

      const chunk1 = await storage.loadScreenshotsChunk(session.id, 1);
      expect(chunk1.length).toBe(1);
      expect(chunk1[0].id).toBe('screenshot-20');
    });
  });

  describe('Append audio segment', () => {
    it('should append segment to existing chunk', async () => {
      const session = createMockSession({ audioSegmentCount: 50 });
      await storage.saveFullSession(session);

      const newSegment = createMockAudioSegment(session.id, 50);
      await storage.appendAudioSegment(session.id, newSegment);

      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.chunks.audioSegments.count).toBe(51);
      expect(metadata!.chunks.audioSegments.chunkCount).toBe(1);
    });

    it('should create new chunk when appending to full chunk', async () => {
      const session = createMockSession({ audioSegmentCount: 100 });
      await storage.saveFullSession(session);

      const newSegment = createMockAudioSegment(session.id, 100);
      await storage.appendAudioSegment(session.id, newSegment);

      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.chunks.audioSegments.count).toBe(101);
      expect(metadata!.chunks.audioSegments.chunkCount).toBe(2);

      const chunk1 = await storage.loadAudioSegmentsChunk(session.id, 1);
      expect(chunk1.length).toBe(1);
      expect(chunk1[0].id).toBe('audio-100');
    });
  });

  // ==========================================================================
  // OPTIONAL LARGE OBJECTS
  // ==========================================================================

  describe('Optional large objects', () => {
    it('should save and load summary', async () => {
      const session = createMockSession({ id: 'test-1', hasSummary: true });
      await storage.saveFullSession(session);

      const summary = await storage.loadSummary('test-1');
      expect(summary).not.toBeNull();
      expect(summary!.narrative).toBe('Test narrative');
    });

    it('should save and load audio insights', async () => {
      const session = createMockSession({ id: 'test-1', hasAudioInsights: true });
      await storage.saveFullSession(session);

      const insights = await storage.loadAudioInsights('test-1');
      expect(insights).not.toBeNull();
      expect(insights!.overallNarrative).toBe('Test audio narrative');
    });

    it('should save and load canvas spec', async () => {
      const session = createMockSession({ id: 'test-1', hasCanvasSpec: true });
      await storage.saveFullSession(session);

      const spec = await storage.loadCanvasSpec('test-1');
      expect(spec).not.toBeNull();
      expect(spec!.layout).toBe('default');
    });

    it('should save and load transcription', async () => {
      const session = createMockSession({ id: 'test-1', hasTranscription: true });
      await storage.saveFullSession(session);

      const transcript = await storage.loadTranscription('test-1');
      expect(transcript).not.toBeNull();
      expect(transcript).toContain('Full transcription');
    });

    it('should save and load context items', async () => {
      const session = createMockSession({ id: 'test-1', hasContextItems: true });
      await storage.saveFullSession(session);

      const items = await storage.loadContextItems('test-1');
      expect(items).not.toBeNull();
      expect(items!.length).toBe(1);
      expect(items![0].content).toBe('Test context item');
    });

    it('should return null for non-existent optional objects', async () => {
      const session = createMockSession({ id: 'test-1' });
      await storage.saveFullSession(session);

      const summary = await storage.loadSummary('test-1');
      const insights = await storage.loadAudioInsights('test-1');
      const spec = await storage.loadCanvasSpec('test-1');
      const transcript = await storage.loadTranscription('test-1');

      expect(summary).toBeNull();
      expect(insights).toBeNull();
      expect(spec).toBeNull();
      expect(transcript).toBeNull();
    });
  });

  // ==========================================================================
  // FULL SESSION SAVE/LOAD CYCLE
  // ==========================================================================

  describe('Full session save/load cycle', () => {
    it('should save and load complete session', async () => {
      const session = createMockSession({
        id: 'test-1',
        screenshotCount: 30,
        audioSegmentCount: 50,
        videoChunkCount: 10,
        hasSummary: true,
        hasAudioInsights: true,
      });

      await storage.saveFullSession(session);
      const loaded = await storage.loadFullSession('test-1');

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe('test-1');
      expect(loaded!.screenshots.length).toBe(30);
      expect(loaded!.audioSegments?.length).toBe(50);
      expect(loaded!.video?.chunks?.length).toBe(10);
      expect(loaded!.summary).not.toBeUndefined();
      expect(loaded!.audioInsights).not.toBeUndefined();
    });

    it('should preserve all metadata fields', async () => {
      const session = createMockSession({ id: 'test-1' });
      session.category = 'Deep Work';
      session.subCategory = 'Coding';
      session.tags = ['typescript', 'testing'];
      session.totalDuration = 120;

      await storage.saveFullSession(session);
      const loaded = await storage.loadFullSession('test-1');

      expect(loaded!.category).toBe('Deep Work');
      expect(loaded!.subCategory).toBe('Coding');
      expect(loaded!.tags).toEqual(['typescript', 'testing']);
      expect(loaded!.totalDuration).toBe(120);
    });

    it('should handle session with no arrays', async () => {
      const session = createMockSession({
        id: 'test-1',
        screenshotCount: 0,
        audioSegmentCount: 0,
        videoChunkCount: 0,
      });

      await storage.saveFullSession(session);
      const loaded = await storage.loadFullSession('test-1');

      expect(loaded).not.toBeNull();
      expect(loaded!.screenshots.length).toBe(0);
      expect(loaded!.audioSegments).toBeUndefined();
      expect(loaded!.video).toBeUndefined();
    });

    it('should return null for non-existent session', async () => {
      const loaded = await storage.loadFullSession('non-existent');
      expect(loaded).toBeNull();
    });
  });

  // ==========================================================================
  // MIGRATION FROM LEGACY FORMAT
  // ==========================================================================

  describe('Migration from legacy format', () => {
    it('should migrate legacy session to chunked format', async () => {
      const legacySession = createMockSession({
        id: 'legacy-1',
        screenshotCount: 40,
      });

      await storage.migrateFromLegacy(legacySession);

      // Verify chunked storage was created
      const metadata = await storage.loadMetadata('legacy-1');
      expect(metadata).not.toBeNull();
      expect(metadata!.storageVersion).toBe(1);
      expect(metadata!.chunks.screenshots.chunkCount).toBe(2);

      // Verify data is accessible
      const loaded = await storage.loadFullSession('legacy-1');
      expect(loaded).not.toBeNull();
      expect(loaded!.screenshots.length).toBe(40);
    });

    it('should detect chunked vs legacy storage', async () => {
      const session = createMockSession({ id: 'test-1' });
      await storage.saveFullSession(session);

      const isChunked = await storage.isChunked('test-1');
      expect(isChunked).toBe(true);

      const isLegacyChunked = await storage.isChunked('non-existent');
      expect(isLegacyChunked).toBe(false);
    });
  });

  // ==========================================================================
  // CACHE HIT/MISS SCENARIOS
  // ==========================================================================

  describe('Cache hit/miss scenarios', () => {
    it('should track cache hits and misses', async () => {
      const session = createMockSession({ id: 'test-1', screenshotCount: 10 });
      await storage.saveFullSession(session);

      // Clear cache to start fresh
      storage.clearCache();

      // First load - cache miss
      await storage.loadMetadata('test-1');

      let stats = storage.getCacheStats();
      expect(stats.misses).toBeGreaterThan(0);

      // Second load - cache hit
      await storage.loadMetadata('test-1');

      stats = storage.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should cache screenshot chunks', async () => {
      const session = createMockSession({ screenshotCount: 40 });
      await storage.saveFullSession(session);

      // Load chunk 0 twice
      await storage.loadScreenshotsChunk(session.id, 0);
      await storage.loadScreenshotsChunk(session.id, 0);

      const stats = storage.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should provide accurate cache statistics', async () => {
      const session = createMockSession({ id: 'test-1' });
      await storage.saveFullSession(session);

      storage.clearCache();
      const initialStats = storage.getCacheStats();
      expect(initialStats.hits).toBe(0);
      expect(initialStats.misses).toBe(0);

      await storage.loadMetadata('test-1');
      await storage.loadMetadata('test-1');

      const finalStats = storage.getCacheStats();
      expect(finalStats.hits).toBe(1);
      expect(finalStats.misses).toBe(1);
    });
  });

  // ==========================================================================
  // SESSION DELETION
  // ==========================================================================

  describe('Session deletion', () => {
    it('should delete all session chunks', async () => {
      const session = createMockSession({
        id: 'test-1',
        screenshotCount: 40,
        audioSegmentCount: 150,
        hasSummary: true,
      });

      await storage.saveFullSession(session);

      // Verify session exists
      const before = await storage.loadMetadata('test-1');
      expect(before).not.toBeNull();

      // Delete session
      await storage.deleteSession('test-1');

      // Clear cache to force adapter reads
      storage.clearCache();

      // Verify all data is deleted
      const metadata = await storage.loadMetadata('test-1');
      expect(metadata).toBeNull();

      const summary = await storage.loadSummary('test-1');
      expect(summary).toBeNull();

      const screenshots = await storage.loadScreenshotsChunk('test-1', 0);
      expect(screenshots.length).toBe(0);
    });

    it('should clear cache for deleted session', async () => {
      const session = createMockSession({ id: 'test-1' });
      await storage.saveFullSession(session);

      // Load to cache
      await storage.loadMetadata('test-1');

      // Delete session
      await storage.deleteSession('test-1');

      // Cache should be cleared
      adapter.clear(); // Clear adapter to force cache check

      const metadata = await storage.loadMetadata('test-1');
      expect(metadata).toBeNull();
    });

    it('should handle deletion of non-existent session gracefully', async () => {
      await expect(storage.deleteSession('non-existent')).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // CONCURRENT CHUNK LOADS
  // ==========================================================================

  describe('Concurrent chunk loads', () => {
    it('should load multiple chunks in parallel', async () => {
      const session = createMockSession({ screenshotCount: 100 });
      await storage.saveFullSession(session);

      const startTime = Date.now();

      // Load all chunks in parallel
      const screenshots = await storage.loadAllScreenshots(session.id);

      const duration = Date.now() - startTime;

      expect(screenshots.length).toBe(100);

      // Parallel loading should be faster than sequential
      // (This is a heuristic test - actual timing will vary)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent saves correctly', async () => {
      const session1 = createMockSession({ id: 'test-1', screenshotCount: 20 });
      const session2 = createMockSession({ id: 'test-2', screenshotCount: 30 });

      // Save both in parallel
      await Promise.all([
        storage.saveFullSession(session1),
        storage.saveFullSession(session2),
      ]);

      // Verify both saved correctly
      const loaded1 = await storage.loadFullSession('test-1');
      const loaded2 = await storage.loadFullSession('test-2');

      expect(loaded1!.screenshots.length).toBe(20);
      expect(loaded2!.screenshots.length).toBe(30);
    });
  });

  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================

  describe('Cache management', () => {
    it('should clear specific session cache', async () => {
      const session1 = createMockSession({ id: 'test-1' });
      const session2 = createMockSession({ id: 'test-2' });

      await storage.saveFullSession(session1);
      await storage.saveFullSession(session2);

      // Load both to cache
      await storage.loadMetadata('test-1');
      await storage.loadMetadata('test-2');

      // Clear session 1 cache
      storage.clearSessionCache('test-1');

      // Session 2 should still be cached
      adapter.clear(); // Clear adapter
      const meta1 = await storage.loadMetadata('test-1');
      expect(meta1).toBeNull();

      // Note: Session 2 would still be in cache if adapter had data
      // This test verifies clearSessionCache works
    });

    it('should clear all cache', async () => {
      const session = createMockSession({ id: 'test-1' });
      await storage.saveFullSession(session);

      await storage.loadMetadata('test-1');

      const statsBefore = storage.getCacheStats();
      expect(statsBefore.hits).toBeGreaterThanOrEqual(0);

      storage.clearCache();

      const statsAfter = storage.getCacheStats();
      expect(statsAfter.hits).toBe(0);
      expect(statsAfter.misses).toBe(0);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge cases', () => {
    it('should handle exactly chunk size items', async () => {
      const session = createMockSession({ screenshotCount: 20 });
      await storage.saveFullSession(session);

      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.chunks.screenshots.chunkCount).toBe(1);

      const chunk = await storage.loadScreenshotsChunk(session.id, 0);
      expect(chunk.length).toBe(20);
    });

    it('should handle very large sessions', async () => {
      const session = createMockSession({
        screenshotCount: 500,
        audioSegmentCount: 1000,
      });

      await storage.saveFullSession(session);

      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.chunks.screenshots.chunkCount).toBe(25); // 500/20
      expect(metadata!.chunks.audioSegments.chunkCount).toBe(10); // 1000/100

      const screenshots = await storage.loadAllScreenshots(session.id);
      expect(screenshots.length).toBe(500);
    });

    it('should handle empty chunk load', async () => {
      const session = createMockSession({ screenshotCount: 0 });
      await storage.saveFullSession(session);

      const chunk = await storage.loadScreenshotsChunk(session.id, 0);
      expect(chunk).toEqual([]);
    });

    it('should handle metadata without optional fields', async () => {
      const session = createMockSession({ id: 'test-1' });
      delete session.category;
      delete session.subCategory;
      delete session.endTime;

      await storage.saveFullSession(session);
      const loaded = await storage.loadFullSession('test-1');

      expect(loaded).not.toBeNull();
      expect(loaded!.category).toBeUndefined();
      expect(loaded!.endTime).toBeUndefined();
    });
  });
});
