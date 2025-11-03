/**
 * ChunkedSessionStorage Performance Tests
 *
 * Verifies performance targets:
 * - Metadata load <10ms
 * - Full session load improved vs legacy
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChunkedSessionStorage } from '../ChunkedSessionStorage';
import type { StorageAdapter } from '../StorageAdapter';
import type { Session, SessionScreenshot, SessionAudioSegment } from '../../../types';

// ============================================================================
// MOCK STORAGE ADAPTER
// ============================================================================

class MockStorageAdapter implements Partial<StorageAdapter> {
  private storage = new Map<string, any>();

  async init(): Promise<void> {}

  async save<T>(collection: string, data: T): Promise<void> {
    // Simulate serialization cost
    const json = JSON.stringify(data);
    this.storage.set(collection, JSON.parse(json));
  }

  async load<T>(collection: string): Promise<T | null> {
    const data = this.storage.get(collection);
    if (!data) return null;

    // Simulate deserialization cost
    return JSON.parse(JSON.stringify(data));
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
      summary: `Screenshot ${index}`.repeat(50), // Larger text
      detectedActivity: 'coding',
      extractedText: `Extracted text ${index}`.repeat(100), // ~10KB per screenshot
      keyElements: Array.from({ length: 20 }, (_, i) => `Element ${i}`),
      confidence: 0.9,
      curiosity: 0.5,
      curiosityReason: 'Interesting activity detected',
      progressIndicators: {
        achievements: ['Achievement 1', 'Achievement 2'],
        blockers: ['Blocker 1'],
        insights: ['Insight 1', 'Insight 2'],
      },
    },
  };
}

function createMockAudioSegment(sessionId: string, index: number): SessionAudioSegment {
  return {
    id: `audio-${index}`,
    sessionId,
    timestamp: new Date(Date.now() + index * 1000).toISOString(),
    duration: 10,
    transcription: `Transcription ${index}`.repeat(50), // ~2KB per segment
    attachmentId: `audio-attachment-${index}`,
    hash: `mock-sha256-hash-audio-${index.toString().padStart(3, '0')}`, // Mock CA storage hash
    keyPhrases: ['phrase1', 'phrase2', 'phrase3'],
    sentiment: 'positive',
    containsTask: false,
    containsBlocker: false,
  };
}

function createLargeSession(id: string, screenshotCount: number, audioSegmentCount: number): Session {
  const screenshots = Array.from({ length: screenshotCount }, (_, i) =>
    createMockScreenshot(id, i)
  );

  const audioSegments =
    audioSegmentCount > 0
      ? Array.from({ length: audioSegmentCount }, (_, i) => createMockAudioSegment(id, i))
      : undefined;

  return {
    id,
    name: 'Large Test Session',
    description: 'Performance test session',
    status: 'completed',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 7200000).toISOString(), // 2 hours
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'transcription',
    audioRecording: true,
    extractedTaskIds: Array.from({ length: 50 }, (_, i) => `task-${i}`),
    extractedNoteIds: Array.from({ length: 30 }, (_, i) => `note-${i}`),
    screenshots,
    audioSegments,
    tags: ['performance', 'test', 'large-session'],
    category: 'Deep Work',
    subCategory: 'Development',
    totalDuration: 120,
    audioReviewCompleted: true,
    fullAudioAttachmentId: 'full-audio-1',
    summary: {
      schemaVersion: '2.0',
      id: 'summary-1',
      generatedAt: new Date().toISOString(),
      sessionContext: {
        sessionId: id,
        sessionName: 'Large Test Session',
        startTime: new Date().toISOString(),
        duration: 120,
        screenshotCount,
        audioSegmentCount,
      },
      narrative: 'This is a large session used for performance testing. '.repeat(100), // ~5KB
      sections: [],
      generationMetadata: {
        reasoning: 'Performance test session',
        confidence: 0.95,
        detectedSessionType: 'deep-work',
        primaryTheme: 'development',
        emphasis: 'achievement-focused',
        dataSources: {
          screenshots: true,
          audio: true,
          video: false,
          audioInsights: true,
          videoChapters: false,
        },
      },
    },
  };
}

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('ChunkedSessionStorage Performance', () => {
  let adapter: MockStorageAdapter;
  let storage: ChunkedSessionStorage;

  beforeEach(() => {
    adapter = new MockStorageAdapter();
    storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
  });

  describe('Metadata loading performance', () => {
    it('should load metadata in <10ms (target)', async () => {
      // Create a large session (120 screenshots, 200 audio segments)
      const session = createLargeSession('perf-test-1', 120, 200);
      await storage.saveFullSession(session);

      // Clear cache to ensure fresh load
      storage.clearCache();

      // Measure metadata load time
      const startTime = performance.now();
      const metadata = await storage.loadMetadata('perf-test-1');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(metadata).not.toBeNull();
      expect(duration).toBeLessThan(10); // <10ms target

      console.log(`✓ Metadata loaded in ${duration.toFixed(2)}ms (target: <10ms)`);
    });

    it('should benefit from caching on subsequent loads', async () => {
      const session = createLargeSession('perf-test-2', 100, 150);
      await storage.saveFullSession(session);

      // First load (cache miss)
      const start1 = performance.now();
      await storage.loadMetadata('perf-test-2');
      const duration1 = performance.now() - start1;

      // Second load (cache hit)
      const start2 = performance.now();
      await storage.loadMetadata('perf-test-2');
      const duration2 = performance.now() - start2;

      // Cache hit should be significantly faster
      expect(duration2).toBeLessThan(duration1);
      expect(duration2).toBeLessThan(1); // Should be sub-millisecond from cache

      console.log(`✓ First load: ${duration1.toFixed(2)}ms, Cached load: ${duration2.toFixed(2)}ms`);
    });
  });

  describe('Full session loading performance', () => {
    it('should load full session in <1s (target)', async () => {
      // Large session: 100 screenshots + 150 audio segments
      const session = createLargeSession('perf-test-3', 100, 150);
      await storage.saveFullSession(session);

      // Clear cache
      storage.clearCache();

      // Measure full session load time
      const startTime = performance.now();
      const loaded = await storage.loadFullSession('perf-test-3');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(loaded).not.toBeNull();
      expect(loaded!.screenshots.length).toBe(100);
      expect(loaded!.audioSegments?.length).toBe(150);
      expect(duration).toBeLessThan(1000); // <1s target

      console.log(`✓ Full session loaded in ${duration.toFixed(2)}ms (target: <1000ms)`);
    });

    it('should parallelize chunk loading efficiently', async () => {
      // Very large session: 200 screenshots (10 chunks)
      const session = createLargeSession('perf-test-4', 200, 0);
      await storage.saveFullSession(session);

      storage.clearCache();

      const startTime = performance.now();
      const screenshots = await storage.loadAllScreenshots('perf-test-4');
      const duration = performance.now() - startTime;

      expect(screenshots.length).toBe(200);

      // 10 chunks loaded in parallel should be much faster than sequential
      // Even with overhead, should be well under 100ms
      expect(duration).toBeLessThan(100);

      console.log(`✓ 10 chunks loaded in parallel in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory efficiency', () => {
    it('should not load entire session when only metadata is needed', async () => {
      const session = createLargeSession('perf-test-5', 150, 200);
      await storage.saveFullSession(session);

      storage.clearCache();

      // Load only metadata
      const metadata = await storage.loadMetadata('perf-test-5');

      expect(metadata).not.toBeNull();
      expect(metadata!.chunks.screenshots.count).toBe(150);
      expect(metadata!.chunks.audioSegments.count).toBe(200);

      // Verify screenshots and audio were NOT loaded
      // (we can't directly measure memory, but we can verify cache size)
      const stats = storage.getCacheStats();
      expect(stats.entryCount).toBe(1); // Only metadata cached
    });
  });

  describe('Chunk size validation', () => {
    it('should keep metadata under 10KB', async () => {
      const session = createLargeSession('perf-test-6', 500, 500);
      await storage.saveFullSession(session);

      storage.clearCache();

      // Get metadata from adapter directly to measure size
      const metadata = await adapter.load(`sessions/perf-test-6/metadata`);
      const metadataJson = JSON.stringify(metadata);
      const sizeInBytes = new Blob([metadataJson]).size;
      const sizeInKB = sizeInBytes / 1024;

      expect(sizeInKB).toBeLessThan(10);

      console.log(`✓ Metadata size: ${sizeInKB.toFixed(2)} KB (target: <10 KB)`);
    });

    it('should keep individual chunks reasonably sized', async () => {
      // 20 screenshots with AI analysis data
      const session = createLargeSession('perf-test-7', 20, 0);
      await storage.saveFullSession(session);

      // Get chunk from adapter
      const chunk = await adapter.load(`sessions/perf-test-7/screenshots/chunk-000`);
      const chunkJson = JSON.stringify(chunk);
      const sizeInBytes = new Blob([chunkJson]).size;
      const sizeInKB = sizeInBytes / 1024;

      // Chunk should be reasonable size (not too large)
      // In real usage with actual screenshots, this would be ~1MB
      // For mock data, we just verify it's chunked properly
      expect(sizeInKB).toBeGreaterThan(10); // At least 10KB
      expect(sizeInKB).toBeLessThan(5000); // Less than 5MB

      console.log(`✓ Screenshot chunk size: ${sizeInKB.toFixed(2)} KB`);
    });
  });
});
