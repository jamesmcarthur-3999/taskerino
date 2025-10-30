/**
 * Phase 4 Storage Benchmarks - Comprehensive Performance Verification
 *
 * Verifies ALL Phase 4 performance targets:
 * - Session load time: <1s (target)
 * - Search time: <100ms (target)
 * - Storage size: 50% reduction (target)
 * - UI blocking: 0ms (target)
 * - Cache hit rate: >90% (target)
 * - Compression ratio: 60-70% (target)
 *
 * Scalability testing:
 * - 100 sessions: <100ms
 * - 500 sessions: <300ms
 * - 1000 sessions: <500ms
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChunkedSessionStorage, type SessionMetadata } from '../ChunkedSessionStorage';
import { ContentAddressableStorage } from '../ContentAddressableStorage';
import { InvertedIndexManager } from '../InvertedIndexManager';
import { PersistenceQueue, getPersistenceQueue, resetPersistenceQueue } from '../PersistenceQueue';
import { LRUCache } from '../LRUCache';
import type { StorageAdapter } from '../StorageAdapter';
import type { Session, SessionScreenshot, SessionAudioSegment, Attachment } from '../../../types';

// ============================================================================
// MOCK STORAGE ADAPTER
// ============================================================================

class MockStorageAdapter implements Partial<StorageAdapter> {
  private storage = new Map<string, any>();
  private readLatency = 0; // Simulate read latency (ms)
  private writeLatency = 0; // Simulate write latency (ms)

  async init(): Promise<void> {}

  async save<T>(collection: string, data: T): Promise<void> {
    // Simulate write latency
    if (this.writeLatency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.writeLatency));
    }

    const json = JSON.stringify(data);
    this.storage.set(collection, JSON.parse(json));
  }

  async load<T>(collection: string): Promise<T | null> {
    // Simulate read latency
    if (this.readLatency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.readLatency));
    }

    const data = this.storage.get(collection);
    if (!data) return null;
    return JSON.parse(JSON.stringify(data));
  }

  async delete(collection: string): Promise<void> {
    this.storage.delete(collection);
  }

  async exists(collection: string): Promise<boolean> {
    return this.storage.has(collection);
  }

  async beginTransaction(): Promise<any> {
    const operations: Array<{ type: 'save' | 'delete'; collection: string; data?: any }> = [];

    return {
      save: (collection: string, data: any) => {
        operations.push({ type: 'save', collection, data });
      },
      delete: (collection: string) => {
        operations.push({ type: 'delete', collection });
      },
      commit: async () => {
        for (const op of operations) {
          if (op.type === 'save') {
            await this.save(op.collection, op.data);
          } else {
            await this.delete(op.collection);
          }
        }
      },
      rollback: async () => {
        // No-op for mock
      },
    };
  }

  clear(): void {
    this.storage.clear();
  }

  setLatency(read: number, write: number): void {
    this.readLatency = read;
    this.writeLatency = write;
  }

  getStorageSize(): number {
    let size = 0;
    for (const value of this.storage.values()) {
      size += JSON.stringify(value).length;
    }
    return size;
  }
}

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

function createMockScreenshot(sessionId: string, index: number): SessionScreenshot {
  return {
    id: `screenshot-${sessionId}-${index}`,
    sessionId,
    timestamp: new Date(Date.now() + index * 30000).toISOString(),
    attachmentId: `attachment-screenshot-${sessionId}-${index}`,
    analysisStatus: 'complete',
    aiAnalysis: {
      summary: `Analysis for screenshot ${index}. This is a detailed summary of what was happening. `.repeat(10),
      detectedActivity: index % 3 === 0 ? 'coding' : index % 3 === 1 ? 'meeting' : 'research',
      extractedText: `Extracted text from screenshot ${index}. Lorem ipsum dolor sit amet. `.repeat(20),
      keyElements: Array.from({ length: 15 }, (_, i) => `Element-${i}`),
      confidence: 0.85 + Math.random() * 0.1,
      curiosity: 0.5 + Math.random() * 0.3,
      curiosityReason: 'Interesting activity detected',
      progressIndicators: {
        achievements: index % 5 === 0 ? [`Achievement at screenshot ${index}`] : [],
        blockers: index % 7 === 0 ? [`Blocker at screenshot ${index}`] : [],
        insights: index % 4 === 0 ? [`Insight from screenshot ${index}`] : [],
      },
    },
  };
}

function createMockAudioSegment(sessionId: string, index: number): SessionAudioSegment {
  return {
    id: `audio-${sessionId}-${index}`,
    sessionId,
    timestamp: new Date(Date.now() + index * 60000).toISOString(),
    duration: 30,
    transcription: `Audio segment ${index} transcription. This is what was said during this time. `.repeat(15),
    attachmentId: `audio-attachment-${sessionId}-${index}`,
    hash: `mock-sha256-hash-${sessionId}-${index.toString().padStart(3, '0')}`, // Mock CA storage hash
    keyPhrases: ['coding', 'debugging', 'implementation', 'testing'],
    sentiment: index % 3 === 0 ? 'positive' : index % 3 === 1 ? 'neutral' : 'negative',
    containsTask: index % 5 === 0,
    containsBlocker: index % 8 === 0,
  };
}

function createMockAttachment(id: string, type: 'image' | 'audio', size: number): Attachment {
  // Create realistic base64 data (using repeated pattern to simulate size)
  const pattern = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const base64 = pattern.repeat(Math.ceil(size / pattern.length));

  return {
    id,
    type,
    name: `${type}-${id}`,
    mimeType: type === 'image' ? 'image/png' : 'audio/wav',
    size,
    createdAt: new Date().toISOString(),
    base64: base64.slice(0, size),
  };
}

/**
 * Generate realistic benchmark data
 * - Varied session sizes (10-200 screenshots)
 * - 30% duplicate attachments (for CA storage testing)
 * - Realistic topics/tags for search testing
 * - Mixed compressed/uncompressed states
 */
function generateBenchmarkData(count: number): Session[] {
  const sessions: Session[] = [];
  const topics = ['Development', 'Meeting', 'Research', 'Design', 'Documentation'];
  const tags = ['urgent', 'review', 'planning', 'implementation', 'debugging', 'testing'];

  // Pre-generate some common attachment IDs (30% will be duplicates)
  const commonAttachmentIds = Array.from({ length: Math.ceil(count * 0.3) }, (_, i) => `common-attachment-${i}`);

  for (let i = 0; i < count; i++) {
    const sessionId = `session-${i}`;
    const screenshotCount = 10 + Math.floor(Math.random() * 190); // 10-200
    const audioSegmentCount = Math.floor(screenshotCount / 3); // ~1 audio per 3 screenshots
    const hasAudio = i % 3 !== 0; // 66% have audio

    const screenshots = Array.from({ length: screenshotCount }, (_, j) => {
      const screenshot = createMockScreenshot(sessionId, j);

      // 30% chance of using a common attachment (deduplication)
      if (Math.random() < 0.3) {
        screenshot.attachmentId = commonAttachmentIds[Math.floor(Math.random() * commonAttachmentIds.length)];
      }

      return screenshot;
    });

    const audioSegments = hasAudio
      ? Array.from({ length: audioSegmentCount }, (_, j) => createMockAudioSegment(sessionId, j))
      : undefined;

    const session: Session = {
      id: sessionId,
      name: `${topics[i % topics.length]} Session ${i}`,
      description: `This is a ${topics[i % topics.length].toLowerCase()} session for testing. Contains ${screenshotCount} screenshots.`,
      status: i % 4 === 0 ? 'active' : 'completed',
      startTime: new Date(Date.now() - (count - i) * 86400000).toISOString(), // Spread over time
      endTime: new Date(Date.now() - (count - i) * 86400000 + 7200000).toISOString(),
      screenshotInterval: 2,
      autoAnalysis: true,
      enableScreenshots: true,
      audioMode: hasAudio ? 'transcription' : 'off',
      audioRecording: hasAudio,
      extractedTaskIds: Array.from({ length: Math.floor(Math.random() * 20) }, (_, j) => `task-${i}-${j}`),
      extractedNoteIds: Array.from({ length: Math.floor(Math.random() * 10) }, (_, j) => `note-${i}-${j}`),
      screenshots,
      audioSegments,
      tags: Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => tags[Math.floor(Math.random() * tags.length)]),
      category: topics[i % topics.length],
      subCategory: i % 2 === 0 ? 'Deep Work' : 'Collaboration',
      totalDuration: 120 + Math.floor(Math.random() * 240),
      audioReviewCompleted: hasAudio && i % 2 === 0,
      fullAudioAttachmentId: hasAudio ? `full-audio-${sessionId}` : undefined,
    };

    sessions.push(session);
  }

  return sessions;
}

// ============================================================================
// BENCHMARK TESTS
// ============================================================================

describe('Phase 4 Storage Benchmarks', () => {
  let adapter: MockStorageAdapter;

  beforeEach(() => {
    adapter = new MockStorageAdapter();
  });

  afterEach(() => {
    adapter.clear();
    resetPersistenceQueue();
  });

  describe('Session Load Performance', () => {
    it('should load session list in <100ms (target: <100ms)', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);

      // Create 100 sessions with varied sizes
      const sessions = generateBenchmarkData(100);

      // Save all sessions
      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      // Clear cache to ensure fresh load
      storage.clearCache();

      // Benchmark: Load all metadata
      const startTime = performance.now();
      const metadataList = await storage.listAllMetadata();
      const duration = performance.now() - startTime;

      expect(metadataList.length).toBe(100);
      expect(duration).toBeLessThan(100);

      console.log(`✓ Loaded 100 session metadata in ${duration.toFixed(2)}ms (target: <100ms)`);
    });

    it('should load full session in <1s (target: <1s)', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);

      // Create one very large session (200 screenshots, 70 audio segments)
      const sessions = generateBenchmarkData(1);
      const largeSession = sessions[0];
      largeSession.screenshots = Array.from({ length: 200 }, (_, i) => createMockScreenshot(largeSession.id, i));
      largeSession.audioSegments = Array.from({ length: 70 }, (_, i) => createMockAudioSegment(largeSession.id, i));

      await storage.saveFullSession(largeSession);
      storage.clearCache();

      // Benchmark: Load full session
      const startTime = performance.now();
      const loaded = await storage.loadFullSession(largeSession.id);
      const duration = performance.now() - startTime;

      expect(loaded).not.toBeNull();
      expect(loaded!.screenshots.length).toBe(200);
      expect(loaded!.audioSegments?.length).toBe(70);
      expect(duration).toBeLessThan(1000);

      console.log(`✓ Loaded full session (200 screenshots, 70 audio) in ${duration.toFixed(2)}ms (target: <1000ms)`);
    });

    it('should load metadata only in <10ms (target: <100ms)', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const sessions = generateBenchmarkData(1);
      const session = sessions[0];
      session.screenshots = Array.from({ length: 200 }, (_, i) => createMockScreenshot(session.id, i));

      await storage.saveFullSession(session);
      storage.clearCache();

      // Benchmark: Load metadata only
      const startTime = performance.now();
      const metadata = await storage.loadMetadata(session.id);
      const duration = performance.now() - startTime;

      expect(metadata).not.toBeNull();
      expect(duration).toBeLessThan(10);

      console.log(`✓ Loaded metadata in ${duration.toFixed(2)}ms (target: <10ms)`);
    });
  });

  describe('Search Performance', () => {
    it('should search 1000 sessions in <100ms (target: <100ms)', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);

      // Create 1000 sessions
      const sessions = generateBenchmarkData(1000);
      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      // Build indexes
      const metadataList = await storage.listAllMetadata();
      await indexManager.buildIndexes(metadataList);

      // Benchmark: Search by text
      const startTime = performance.now();
      const results = await indexManager.search({ text: 'Development' });
      const duration = performance.now() - startTime;

      expect(results.sessionIds.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);

      console.log(`✓ Searched 1000 sessions in ${duration.toFixed(2)}ms (target: <100ms, found ${results.sessionIds.length} results)`);
    });

    it('should search by topic in <50ms (target: <100ms)', async () => {
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);

      const sessions = generateBenchmarkData(500);
      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      const metadataList = await storage.listAllMetadata();
      await indexManager.buildIndexes(metadataList);

      // Benchmark: Search by category
      const startTime = performance.now();
      const results = await indexManager.search({ category: 'Development' });
      const duration = performance.now() - startTime;

      expect(results.sessionIds.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(50);

      console.log(`✓ Searched by topic in ${duration.toFixed(2)}ms (target: <50ms, found ${results.sessionIds.length} results)`);
    });

    it('should search by date in <50ms (target: <100ms)', async () => {
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);

      const sessions = generateBenchmarkData(500);
      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      const metadataList = await storage.listAllMetadata();
      await indexManager.buildIndexes(metadataList);

      // Benchmark: Search by date range
      const now = Date.now();
      const startTime = performance.now();
      const results = await indexManager.search({
        dateRange: {
          start: now - 30 * 86400000, // Last 30 days
          end: now,
        },
      });
      const duration = performance.now() - startTime;

      expect(results.sessionIds.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(50);

      console.log(`✓ Searched by date in ${duration.toFixed(2)}ms (target: <50ms, found ${results.sessionIds.length} results)`);
    });

    it('should perform complex query in <100ms (target: <100ms)', async () => {
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);

      const sessions = generateBenchmarkData(500);
      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      const metadataList = await storage.listAllMetadata();
      await indexManager.buildIndexes(metadataList);

      // Benchmark: Complex query (text + category + tags + date)
      const now = Date.now();
      const startTime = performance.now();
      const results = await indexManager.search({
        text: 'session',
        category: 'Development',
        tags: ['implementation'],
        dateRange: {
          start: now - 60 * 86400000,
          end: now,
        },
        operator: 'AND',
      });
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100);

      console.log(`✓ Complex query in ${duration.toFixed(2)}ms (target: <100ms, found ${results.sessionIds.length} results)`);
    });
  });

  describe('Storage Size', () => {
    it('should achieve 50%+ storage reduction (target: 50%)', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const caStorage = new ContentAddressableStorage(adapter as unknown as StorageAdapter);

      // Create 50 sessions with duplicate attachments
      const sessions = generateBenchmarkData(50);

      // Measure baseline size (before CA storage)
      let baselineSize = 0;
      for (const session of sessions) {
        const json = JSON.stringify(session);
        baselineSize += json.length;
      }

      // Save with chunked storage + CA storage
      for (const session of sessions) {
        await storage.saveFullSession(session);

        // Save attachments to CA storage
        for (const screenshot of session.screenshots) {
          const attachment = createMockAttachment(screenshot.attachmentId, 'image', 50 * 1024); // 50KB each
          await caStorage.saveAttachment(attachment);
          await caStorage.addReference(await caStorage.saveAttachment(attachment), session.id, screenshot.attachmentId);
        }
      }

      // Measure actual storage size
      const actualSize = adapter.getStorageSize();
      const reduction = ((baselineSize - actualSize) / baselineSize) * 100;

      expect(reduction).toBeGreaterThan(50);

      console.log(`✓ Storage reduction: ${reduction.toFixed(1)}% (target: >50%, baseline: ${(baselineSize / 1024 / 1024).toFixed(2)}MB, actual: ${(actualSize / 1024 / 1024).toFixed(2)}MB)`);
    });

    it('should deduplicate 30-50% of attachments (target: 30-50%)', async () => {
      const caStorage = new ContentAddressableStorage(adapter as unknown as StorageAdapter);

      // Create 100 attachments with 30% duplicates
      const totalAttachments = 100;
      const uniqueAttachments = 70; // 30% duplicates
      const attachments: Attachment[] = [];

      // Create unique attachments
      for (let i = 0; i < uniqueAttachments; i++) {
        attachments.push(createMockAttachment(`unique-${i}`, 'image', 50 * 1024));
      }

      // Add duplicates
      for (let i = 0; i < totalAttachments - uniqueAttachments; i++) {
        const duplicate = { ...attachments[i % uniqueAttachments] };
        duplicate.id = `duplicate-${i}`;
        attachments.push(duplicate);
      }

      // Save all attachments
      const hashes = new Set<string>();
      for (const attachment of attachments) {
        const hash = await caStorage.saveAttachment(attachment);
        hashes.add(hash);
      }

      const deduplicationRate = ((totalAttachments - hashes.size) / totalAttachments) * 100;

      expect(deduplicationRate).toBeGreaterThanOrEqual(30);
      expect(deduplicationRate).toBeLessThanOrEqual(50);

      console.log(`✓ Deduplication rate: ${deduplicationRate.toFixed(1)}% (target: 30-50%, unique: ${hashes.size}/${totalAttachments})`);
    });

    it('should compress sessions 60-70% (target: 60-70%)', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);

      // Create a large session
      const sessions = generateBenchmarkData(1);
      const session = sessions[0];
      session.screenshots = Array.from({ length: 100 }, (_, i) => createMockScreenshot(session.id, i));

      await storage.saveFullSession(session);

      // Compress the session
      const compressionResult = await storage.compressSession(session.id);
      const compressionPercentage = (1 - compressionResult.ratio) * 100;

      expect(compressionPercentage).toBeGreaterThanOrEqual(60);
      expect(compressionPercentage).toBeLessThanOrEqual(70);

      console.log(`✓ Compression: ${compressionPercentage.toFixed(1)}% reduction (target: 60-70%, ${(compressionResult.originalSize / 1024).toFixed(2)}KB → ${(compressionResult.compressedSize / 1024).toFixed(2)}KB)`);
    });
  });

  describe('UI Responsiveness', () => {
    it('should maintain 0ms UI blocking (target: 0ms)', async () => {
      const queue = getPersistenceQueue();
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);

      // Queue 50 critical saves (should be immediate, no batching)
      const startTime = performance.now();
      for (let i = 0; i < 50; i++) {
        queue.enqueue(`test-key-${i}`, { data: 'test' }, 'critical');
      }
      const enqueueDuration = performance.now() - startTime;

      // Enqueue should be instant (no blocking)
      expect(enqueueDuration).toBeLessThan(10);

      console.log(`✓ Enqueued 50 critical items in ${enqueueDuration.toFixed(2)}ms (target: <10ms, no UI blocking)`);
    });

    it('should save in background (target: 0ms blocking)', async () => {
      const queue = getPersistenceQueue();

      // Enqueue normal priority items (batched at 100ms)
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        queue.enqueue(`test-${i}`, { data: `value-${i}` }, 'normal');
      }
      const enqueueDuration = performance.now() - startTime;

      // Enqueue should be instant
      expect(enqueueDuration).toBeLessThan(10);

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 150));

      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThan(0);

      console.log(`✓ Background save: enqueued in ${enqueueDuration.toFixed(2)}ms, processed ${stats.completed} items in background`);
    });

    it('should batch chunk writes (target: <50ms per batch)', async () => {
      const queue = getPersistenceQueue();
      const sessionId = 'batch-test-session';

      // Enqueue 20 chunk writes
      const startTime = performance.now();
      for (let i = 0; i < 20; i++) {
        queue.enqueueChunk(sessionId, `chunk-${i}`, { data: `chunk-${i}` }, 'normal');
      }
      const enqueueDuration = performance.now() - startTime;

      expect(enqueueDuration).toBeLessThan(10);

      // Wait for batching
      await new Promise(resolve => setTimeout(resolve, 150));

      const stats = queue.getStats();
      expect(stats.batching?.chunksCollapsed).toBeGreaterThan(0);

      console.log(`✓ Batched chunk writes: enqueued in ${enqueueDuration.toFixed(2)}ms, collapsed ${stats.batching?.chunksCollapsed} chunks`);
    });
  });

  describe('Cache Performance', () => {
    it('should achieve >90% hit rate for hot data (target: >90%)', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter, {
        maxSizeBytes: 10 * 1024 * 1024, // 10MB cache
        ttl: 60 * 1000, // 1 minute TTL
      });

      // Create and save 10 sessions
      const sessions = generateBenchmarkData(10);
      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      // Clear cache
      storage.resetCacheStats();

      // Simulate hot access pattern (80% of requests to 20% of data)
      const hotSessionIds = sessions.slice(0, 2).map(s => s.id);
      const requests = 1000;
      const hotRequests = Math.floor(requests * 0.8);

      for (let i = 0; i < requests; i++) {
        if (i < hotRequests) {
          // Hot data (first 2 sessions)
          const sessionId = hotSessionIds[i % hotSessionIds.length];
          await storage.loadMetadata(sessionId);
        } else {
          // Cold data (remaining sessions)
          const sessionId = sessions[2 + (i % (sessions.length - 2))].id;
          await storage.loadMetadata(sessionId);
        }
      }

      const stats = storage.getCacheStats();
      const hitRate = stats.hitRate * 100;

      expect(hitRate).toBeGreaterThan(90);

      console.log(`✓ Cache hit rate: ${hitRate.toFixed(1)}% (target: >90%, ${stats.hits} hits, ${stats.misses} misses)`);
    });

    it('should load cached metadata in <1ms (target: <1ms)', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const sessions = generateBenchmarkData(1);
      await storage.saveFullSession(sessions[0]);

      // First load (cache miss)
      await storage.loadMetadata(sessions[0].id);

      // Second load (cache hit)
      const startTime = performance.now();
      const metadata = await storage.loadMetadata(sessions[0].id);
      const duration = performance.now() - startTime;

      expect(metadata).not.toBeNull();
      expect(duration).toBeLessThan(1);

      console.log(`✓ Cached metadata load: ${duration.toFixed(3)}ms (target: <1ms)`);
    });

    it('should respect 100MB memory limit (target: <100MB)', async () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 100 * 1024 * 1024, // 100MB
      });

      // Add 200 items of ~1MB each (should evict)
      const itemSize = 1024 * 1024; // 1MB
      for (let i = 0; i < 200; i++) {
        const data = { value: 'x'.repeat(itemSize) };
        cache.set(`key-${i}`, data);
      }

      const stats = cache.getStats();
      const sizeMB = stats.size / 1024 / 1024;

      expect(sizeMB).toBeLessThan(100);
      expect(stats.evictions).toBeGreaterThan(0);

      console.log(`✓ Cache size: ${sizeMB.toFixed(2)}MB (target: <100MB, evictions: ${stats.evictions})`);
    });
  });

  describe('Compression Performance', () => {
    it('should compress JSON 60-70% (target: 60-70%)', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const sessions = generateBenchmarkData(1);
      const session = sessions[0];
      session.screenshots = Array.from({ length: 100 }, (_, i) => createMockScreenshot(session.id, i));

      await storage.saveFullSession(session);

      const result = await storage.compressSession(session.id);
      const reductionPercent = (1 - result.ratio) * 100;

      expect(reductionPercent).toBeGreaterThanOrEqual(60);
      expect(reductionPercent).toBeLessThanOrEqual(70);

      console.log(`✓ JSON compression: ${reductionPercent.toFixed(1)}% (target: 60-70%)`);
    });

    it('should maintain 0ms UI blocking with Web Worker (target: 0ms)', async () => {
      // Note: Web Worker compression is tested in integration tests
      // Here we verify that the compression queue doesn't block

      const queue = getPersistenceQueue();
      const startTime = performance.now();

      // Enqueue 10 compression tasks
      for (let i = 0; i < 10; i++) {
        queue.enqueue(`compress-${i}`, { data: 'x'.repeat(100000) }, 'low');
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(10);

      console.log(`✓ Compression enqueue: ${duration.toFixed(2)}ms (target: <10ms, no blocking)`);
    });
  });

  describe('Scalability', () => {
    it('should handle 100 sessions in <100ms', async () => {
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);

      const sessions = generateBenchmarkData(100);
      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      const metadataList = await storage.listAllMetadata();
      await indexManager.buildIndexes(metadataList);

      const startTime = performance.now();
      const results = await indexManager.search({ text: 'session' });
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100);

      console.log(`✓ 100 sessions: ${duration.toFixed(2)}ms (target: <100ms)`);
    });

    it('should handle 500 sessions in <300ms', async () => {
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);

      const sessions = generateBenchmarkData(500);
      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      const metadataList = await storage.listAllMetadata();
      await indexManager.buildIndexes(metadataList);

      const startTime = performance.now();
      const results = await indexManager.search({ text: 'Development' });
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(300);

      console.log(`✓ 500 sessions: ${duration.toFixed(2)}ms (target: <300ms)`);
    });

    it('should handle 1000 sessions in <500ms', async () => {
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);

      const sessions = generateBenchmarkData(1000);
      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      const metadataList = await storage.listAllMetadata();
      await indexManager.buildIndexes(metadataList);

      const startTime = performance.now();
      const results = await indexManager.search({ category: 'Development' });
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(500);

      console.log(`✓ 1000 sessions: ${duration.toFixed(2)}ms (target: <500ms)`);
    });
  });
});
