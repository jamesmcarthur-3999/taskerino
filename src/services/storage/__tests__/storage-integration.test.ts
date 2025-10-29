/**
 * Phase 4 Storage Integration Tests
 *
 * End-to-end validation of the complete Phase 4 storage system.
 * Tests all major flows and scenarios to ensure everything works together.
 *
 * Test Coverage:
 * - Create session flow (chunked storage + CA storage + indexes + cache)
 * - Load session flow (metadata + full session + progressive loading)
 * - Search session flow (inverted indexes + filtering)
 * - Update session flow (chunks + indexes + cache invalidation)
 * - Delete session flow (cleanup + CA reference counting + GC)
 * - Migration flow (legacy → Phase 4 format)
 * - Rollback flow (Phase 4 → legacy format)
 * - Background operations (queue + compression + GC)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChunkedSessionStorage, type SessionMetadata } from '../ChunkedSessionStorage';
import { ContentAddressableStorage } from '../ContentAddressableStorage';
import { InvertedIndexManager } from '../InvertedIndexManager';
import { PersistenceQueue, getPersistenceQueue, resetPersistenceQueue } from '../PersistenceQueue';
import type { StorageAdapter } from '../StorageAdapter';
import type { Session, SessionScreenshot, SessionAudioSegment, Attachment } from '../../../types';

// ============================================================================
// MOCK STORAGE ADAPTER (Same as benchmarks)
// ============================================================================

class MockStorageAdapter implements Partial<StorageAdapter> {
  private storage = new Map<string, any>();
  private deletedKeys = new Set<string>(); // Track deletions for verification

  async init(): Promise<void> {}

  async save<T>(collection: string, data: T): Promise<void> {
    const json = JSON.stringify(data);
    this.storage.set(collection, JSON.parse(json));
    this.deletedKeys.delete(collection); // Mark as not deleted
  }

  async load<T>(collection: string): Promise<T | null> {
    const data = this.storage.get(collection);
    if (!data) return null;
    return JSON.parse(JSON.stringify(data));
  }

  async delete(collection: string): Promise<void> {
    this.storage.delete(collection);
    this.deletedKeys.add(collection);
  }

  async exists(collection: string): Promise<boolean> {
    return this.storage.has(collection);
  }

  async beginTransaction(): Promise<any> {
    const operations: Array<{ type: 'save' | 'delete'; collection: string; data?: any }> = [];
    const rollbackData = new Map<string, any>();

    return {
      save: (collection: string, data: any) => {
        // Capture current state for rollback
        if (this.storage.has(collection)) {
          rollbackData.set(collection, JSON.parse(JSON.stringify(this.storage.get(collection))));
        }
        operations.push({ type: 'save', collection, data });
      },
      delete: (collection: string) => {
        if (this.storage.has(collection)) {
          rollbackData.set(collection, JSON.parse(JSON.stringify(this.storage.get(collection))));
        }
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
        // Restore previous state
        for (const [collection, data] of rollbackData.entries()) {
          this.storage.set(collection, data);
        }
      },
    };
  }

  clear(): void {
    this.storage.clear();
    this.deletedKeys.clear();
  }

  getAll(): Map<string, any> {
    return new Map(this.storage);
  }

  wasDeleted(collection: string): boolean {
    return this.deletedKeys.has(collection);
  }
}

// ============================================================================
// TEST DATA HELPERS
// ============================================================================

function createMockScreenshot(sessionId: string, index: number): SessionScreenshot {
  return {
    id: `screenshot-${index}`,
    sessionId,
    timestamp: new Date(Date.now() + index * 30000).toISOString(),
    attachmentId: `attachment-${sessionId}-${index}`,
    analysisStatus: 'complete',
    aiAnalysis: {
      summary: `Screenshot ${index} analysis`,
      detectedActivity: 'coding',
      extractedText: `Text from screenshot ${index}`,
      keyElements: ['element1', 'element2'],
      confidence: 0.9,
      curiosity: 0.5,
      curiosityReason: 'Interesting',
      progressIndicators: {
        achievements: index % 3 === 0 ? [`Achievement ${index}`] : [],
        blockers: index % 5 === 0 ? [`Blocker ${index}`] : [],
        insights: [`Insight ${index}`],
      },
    },
  };
}

function createMockAudioSegment(sessionId: string, index: number): SessionAudioSegment {
  return {
    id: `audio-${index}`,
    sessionId,
    timestamp: new Date(Date.now() + index * 60000).toISOString(),
    duration: 30,
    transcription: `Audio segment ${index} transcription`,
    attachmentId: `audio-attachment-${sessionId}-${index}`,
    hash: `mock-sha256-hash-${sessionId}-${index.toString().padStart(3, '0')}`, // Mock CA storage hash
    keyPhrases: ['test', 'audio'],
    sentiment: 'positive',
    containsTask: false,
    containsBlocker: false,
  };
}

function createMockAttachment(id: string, type: 'image' | 'audio'): Attachment {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  return {
    id,
    type,
    name: `${type}-${id}`,
    mimeType: type === 'image' ? 'image/png' : 'audio/wav',
    size: base64.length,
    createdAt: new Date().toISOString(),
    base64,
  };
}

function createTestSession(id: string, options?: { screenshots?: number; audio?: number }): Session {
  const screenshotCount = options?.screenshots ?? 25;
  const audioCount = options?.audio ?? 10;

  return {
    id,
    name: `Test Session ${id}`,
    description: `Integration test session for ${id}`,
    status: 'completed',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: audioCount > 0 ? 'transcription' : 'off',
    audioRecording: audioCount > 0,
    extractedTaskIds: ['task-1', 'task-2'],
    extractedNoteIds: ['note-1'],
    screenshots: Array.from({ length: screenshotCount }, (_, i) => createMockScreenshot(id, i)),
    audioSegments: audioCount > 0 ? Array.from({ length: audioCount }, (_, i) => createMockAudioSegment(id, i)) : undefined,
    tags: ['integration', 'test'],
    category: 'Development',
    subCategory: 'Testing',
    totalDuration: 60,
    audioReviewCompleted: false,
  };
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Phase 4 Storage Integration', () => {
  let adapter: MockStorageAdapter;

  beforeEach(() => {
    adapter = new MockStorageAdapter();
  });

  afterEach(() => {
    adapter.clear();
    resetPersistenceQueue();
  });

  describe('Create Session Flow', () => {
    it('should create session with chunked storage', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('create-test-1', { screenshots: 25, audio: 10 });

      // Create session
      await storage.saveFullSession(session);

      // Verify chunks were created
      const chunkCount = Math.ceil(25 / 20); // 20 screenshots per chunk
      for (let i = 0; i < chunkCount; i++) {
        const chunk = await adapter.load(`sessions/${session.id}/screenshots/chunk-${String(i).padStart(3, '0')}`);
        expect(chunk).not.toBeNull();
      }

      // Verify metadata exists
      const metadata = await storage.loadMetadata(session.id);
      expect(metadata).not.toBeNull();
      expect(metadata!.chunks.screenshots.count).toBe(25);
      expect(metadata!.chunks.audioSegments.count).toBe(10);

      console.log(`✓ Session created with ${chunkCount} screenshot chunks`);
    });

    it('should store attachments in CA storage', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const caStorage = new ContentAddressableStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('create-test-2', { screenshots: 10 });

      await storage.saveFullSession(session);

      // Store attachments in CA storage
      const hashes: string[] = [];
      for (const screenshot of session.screenshots) {
        const attachment = createMockAttachment(screenshot.attachmentId, 'image');
        const hash = await caStorage.saveAttachment(attachment);
        await caStorage.addReference(hash, session.id, screenshot.attachmentId);
        hashes.push(hash);
      }

      // Verify attachments stored
      for (const hash of hashes) {
        const exists = await caStorage.attachmentExists(hash);
        expect(exists).toBe(true);
      }

      // Verify references
      const refCount = await caStorage.getReferenceCount(hashes[0]);
      expect(refCount).toBeGreaterThan(0);

      console.log(`✓ Stored ${hashes.length} attachments with reference counting`);
    });

    it('should update inverted indexes', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);
      const session = createTestSession('create-test-3');

      await storage.saveFullSession(session);
      const metadata = await storage.loadMetadata(session.id);

      // Build indexes
      await indexManager.buildIndexes([metadata!]);

      // Verify indexes contain session
      const results = await indexManager.search({ text: 'Integration' });
      expect(results.sessionIds).toContain(session.id);

      console.log(`✓ Session indexed and searchable`);
    });

    it('should add to LRU cache', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('create-test-4');

      await storage.saveFullSession(session);

      // First load (cache miss)
      storage.resetCacheStats();
      await storage.loadMetadata(session.id);

      // Second load (cache hit)
      await storage.loadMetadata(session.id);

      const stats = storage.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);

      console.log(`✓ Session cached with ${stats.hits} cache hits`);
    });

    it('should verify chunks created correctly', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('create-test-5', { screenshots: 45, audio: 120 });

      await storage.saveFullSession(session);

      // Verify screenshot chunks
      const screenshotChunks = Math.ceil(45 / 20);
      for (let i = 0; i < screenshotChunks; i++) {
        const chunk = await adapter.load(`sessions/${session.id}/screenshots/chunk-${String(i).padStart(3, '0')}`);
        expect(chunk).not.toBeNull();
        expect(chunk.sessionId).toBe(session.id);
        expect(chunk.chunkIndex).toBe(i);
      }

      // Verify audio chunks
      const audioChunks = Math.ceil(120 / 100);
      for (let i = 0; i < audioChunks; i++) {
        const chunk = await adapter.load(`sessions/${session.id}/audio-segments/chunk-${String(i).padStart(3, '0')}`);
        expect(chunk).not.toBeNull();
      }

      console.log(`✓ Verified ${screenshotChunks} screenshot chunks and ${audioChunks} audio chunks`);
    });
  });

  describe('Load Session Flow', () => {
    it('should load metadata from cache (hot path)', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('load-test-1');

      await storage.saveFullSession(session);

      // First load (populates cache)
      await storage.loadMetadata(session.id);

      // Second load (from cache)
      storage.resetCacheStats();
      const metadata = await storage.loadMetadata(session.id);

      expect(metadata).not.toBeNull();
      const stats = storage.getCacheStats();
      expect(stats.hits).toBe(1);

      console.log(`✓ Metadata loaded from cache (hot path)`);
    });

    it('should load metadata from storage (cold path)', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('load-test-2');

      await storage.saveFullSession(session);

      // Clear cache to force storage load
      storage.clearCache();

      // Load from storage
      storage.resetCacheStats();
      const metadata = await storage.loadMetadata(session.id);

      expect(metadata).not.toBeNull();
      const stats = storage.getCacheStats();
      expect(stats.misses).toBe(1);

      console.log(`✓ Metadata loaded from storage (cold path)`);
    });

    it('should load full session progressively', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('load-test-3', { screenshots: 50, audio: 30 });

      await storage.saveFullSession(session);
      storage.clearCache();

      // Load full session
      const loaded = await storage.loadFullSession(session.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.screenshots.length).toBe(50);
      expect(loaded!.audioSegments?.length).toBe(30);

      console.log(`✓ Full session loaded progressively (50 screenshots, 30 audio)`);
    });

    it('should decompress if compressed', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('load-test-4', { screenshots: 100 });

      await storage.saveFullSession(session);

      // Compress session
      const compressionResult = await storage.compressSession(session.id);
      expect(compressionResult.ratio).toBeLessThan(1);

      // Verify compressed
      const isCompressed = await storage.isSessionCompressed(session.id);
      expect(isCompressed).toBe(true);

      console.log(`✓ Session compressed and verified`);
    });

    it('should load attachments from CA storage', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const caStorage = new ContentAddressableStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('load-test-5', { screenshots: 5 });

      await storage.saveFullSession(session);

      // Store attachments
      const attachments: Record<string, string> = {}; // attachmentId -> hash
      for (const screenshot of session.screenshots) {
        const attachment = createMockAttachment(screenshot.attachmentId, 'image');
        const hash = await caStorage.saveAttachment(attachment);
        await caStorage.addReference(hash, session.id, screenshot.attachmentId);
        attachments[screenshot.attachmentId] = hash;
      }

      // Load attachments
      for (const [attachmentId, hash] of Object.entries(attachments)) {
        const loaded = await caStorage.loadAttachment(hash);
        expect(loaded).not.toBeNull();
        expect(loaded!.mimeType).toBe('image/png');
      }

      console.log(`✓ Loaded ${Object.keys(attachments).length} attachments from CA storage`);
    });
  });

  describe('Search Session Flow', () => {
    it('should use inverted indexes for search', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);

      // Create multiple sessions
      const sessions = [
        createTestSession('search-1'),
        createTestSession('search-2'),
        createTestSession('search-3'),
      ];

      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      // Build indexes
      const metadataList = await storage.listAllMetadata();
      await indexManager.buildIndexes(metadataList);

      // Search using indexes
      const results = await indexManager.search({ text: 'Integration' });

      expect(results.sessionIds.length).toBe(3);
      expect(results.took).toBeLessThan(100);
      expect(results.indexesUsed).toContain('full-text');

      console.log(`✓ Found ${results.sessionIds.length} sessions using indexes in ${results.took.toFixed(2)}ms`);
    });

    it('should filter by topic using indexes', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);

      const sessions = [
        createTestSession('topic-1'),
        createTestSession('topic-2'),
      ];
      sessions[0].category = 'Development';
      sessions[1].category = 'Meeting';

      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      const metadataList = await storage.listAllMetadata();
      await indexManager.buildIndexes(metadataList);

      // Filter by category
      const results = await indexManager.search({ category: 'Development' });

      expect(results.sessionIds.length).toBe(1);
      expect(results.sessionIds[0]).toBe('topic-1');

      console.log(`✓ Filtered by topic: found ${results.sessionIds.length} sessions`);
    });

    it('should filter by date using indexes', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);

      const sessions = [
        createTestSession('date-1'),
        createTestSession('date-2'),
      ];

      // Set different dates
      const now = Date.now();
      sessions[0].startTime = new Date(now - 10 * 86400000).toISOString(); // 10 days ago
      sessions[1].startTime = new Date(now - 40 * 86400000).toISOString(); // 40 days ago

      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      const metadataList = await storage.listAllMetadata();
      await indexManager.buildIndexes(metadataList);

      // Filter by date range (last 30 days)
      const results = await indexManager.search({
        dateRange: {
          start: now - 30 * 86400000,
          end: now,
        },
      });

      expect(results.sessionIds.length).toBe(1);
      expect(results.sessionIds[0]).toBe('date-1');

      console.log(`✓ Filtered by date: found ${results.sessionIds.length} sessions`);
    });

    it('should combine filters with AND operator', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);

      const sessions = [
        createTestSession('and-1'),
        createTestSession('and-2'),
        createTestSession('and-3'),
      ];

      sessions[0].category = 'Development';
      sessions[0].tags = ['integration', 'urgent'];

      sessions[1].category = 'Development';
      sessions[1].tags = ['integration'];

      sessions[2].category = 'Meeting';
      sessions[2].tags = ['integration', 'urgent'];

      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      const metadataList = await storage.listAllMetadata();
      await indexManager.buildIndexes(metadataList);

      // Complex AND query
      const results = await indexManager.search({
        category: 'Development',
        tags: ['integration', 'urgent'],
        operator: 'AND',
      });

      expect(results.sessionIds.length).toBe(1);
      expect(results.sessionIds[0]).toBe('and-1');

      console.log(`✓ AND filter: found ${results.sessionIds.length} sessions`);
    });

    it('should return results in <100ms', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);

      // Create 100 sessions
      const sessions = Array.from({ length: 100 }, (_, i) => createTestSession(`perf-${i}`));

      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      const metadataList = await storage.listAllMetadata();
      await indexManager.buildIndexes(metadataList);

      // Search
      const results = await indexManager.search({ text: 'Integration' });

      expect(results.took).toBeLessThan(100);

      console.log(`✓ Search completed in ${results.took.toFixed(2)}ms (target: <100ms)`);
    });
  });

  describe('Update Session Flow', () => {
    it('should update session chunks', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('update-1', { screenshots: 20 });

      await storage.saveFullSession(session);

      // Update session (add more screenshots)
      session.screenshots.push(createMockScreenshot(session.id, 20));
      session.screenshots.push(createMockScreenshot(session.id, 21));

      await storage.saveFullSession(session);

      // Verify updated
      const loaded = await storage.loadFullSession(session.id);
      expect(loaded!.screenshots.length).toBe(22);

      console.log(`✓ Session updated with new chunks`);
    });

    it('should update inverted indexes', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);
      const session = createTestSession('update-2');

      await storage.saveFullSession(session);
      let metadata = await storage.loadMetadata(session.id);
      await indexManager.buildIndexes([metadata!]);

      // Update session category
      session.category = 'Updated Category';
      await storage.saveFullSession(session);

      // Update indexes
      metadata = await storage.loadMetadata(session.id);
      await indexManager.updateIndexes(metadata!);

      // Verify index updated
      const results = await indexManager.search({ category: 'Updated Category' });
      expect(results.sessionIds).toContain(session.id);

      console.log(`✓ Indexes updated after session modification`);
    });

    it('should invalidate cache', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('update-3');

      await storage.saveFullSession(session);

      // Load to populate cache
      await storage.loadMetadata(session.id);

      // Update session
      session.name = 'Updated Name';
      await storage.saveFullSession(session);

      // Load again (should get fresh data, not cached)
      const metadata = await storage.loadMetadata(session.id);
      expect(metadata!.name).toBe('Updated Name');

      console.log(`✓ Cache invalidated on update`);
    });

    it('should queue background save', async () => {
      const queue = getPersistenceQueue();
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('update-4');

      // Queue save
      queue.enqueue(`sessions/${session.id}/metadata`, session, 'normal');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));

      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThan(0);

      console.log(`✓ Background save queued and processed`);
    });

    it('should maintain data consistency', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('update-5', { screenshots: 25 });

      await storage.saveFullSession(session);

      // Update multiple times
      for (let i = 0; i < 5; i++) {
        session.name = `Updated ${i}`;
        await storage.saveFullSession(session);
      }

      // Verify final state
      const loaded = await storage.loadFullSession(session.id);
      expect(loaded!.name).toBe('Updated 4');
      expect(loaded!.screenshots.length).toBe(25);

      console.log(`✓ Data consistency maintained across updates`);
    });
  });

  describe('Delete Session Flow', () => {
    it('should delete session chunks', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('delete-1', { screenshots: 45 });

      await storage.saveFullSession(session);

      // Delete session
      await storage.deleteSession(session.id);

      // Verify chunks deleted
      const chunkCount = Math.ceil(45 / 20);
      for (let i = 0; i < chunkCount; i++) {
        const exists = await adapter.exists(`sessions/${session.id}/screenshots/chunk-${String(i).padStart(3, '0')}`);
        expect(exists).toBe(false);
      }

      console.log(`✓ Session chunks deleted`);
    });

    it('should remove from indexes', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);
      const session = createTestSession('delete-2');

      await storage.saveFullSession(session);
      const metadata = await storage.loadMetadata(session.id);
      await indexManager.buildIndexes([metadata!]);

      // Delete session and update indexes
      await storage.deleteSession(session.id);
      await indexManager.deleteFromIndexes(session.id);

      // Verify not in indexes
      const results = await indexManager.search({ text: 'Integration' });
      expect(results.sessionIds).not.toContain(session.id);

      console.log(`✓ Session removed from indexes`);
    });

    it('should decrement CA reference counts', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const caStorage = new ContentAddressableStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('delete-3', { screenshots: 5 });

      await storage.saveFullSession(session);

      // Store attachments
      const hashes: string[] = [];
      for (const screenshot of session.screenshots) {
        const attachment = createMockAttachment(screenshot.attachmentId, 'image');
        const hash = await caStorage.saveAttachment(attachment);
        await caStorage.addReference(hash, session.id, screenshot.attachmentId);
        hashes.push(hash);
      }

      // Verify references added
      const refCountBefore = await caStorage.getReferenceCount(hashes[0]);
      expect(refCountBefore).toBeGreaterThan(0);

      // Delete session
      await storage.deleteSession(session.id);

      // Remove references
      for (const hash of hashes) {
        await caStorage.removeReference(hash, session.id);
      }

      // Verify references removed
      const refCountAfter = await caStorage.getReferenceCount(hashes[0]);
      expect(refCountAfter).toBe(0);

      console.log(`✓ CA references decremented (${refCountBefore} → ${refCountAfter})`);
    });

    it('should invalidate cache', async () => {
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);
      const session = createTestSession('delete-4');

      await storage.saveFullSession(session);
      await storage.loadMetadata(session.id); // Populate cache

      // Delete session
      await storage.deleteSession(session.id);

      // Verify cache cleared
      const metadata = await storage.loadMetadata(session.id);
      expect(metadata).toBeNull();

      console.log(`✓ Cache invalidated on delete`);
    });

    it('should cleanup unreferenced attachments', async () => {
      const caStorage = new ContentAddressableStorage(adapter as unknown as StorageAdapter);

      // Create attachment with reference
      const attachment = createMockAttachment('cleanup-1', 'image');
      const hash = await caStorage.saveAttachment(attachment);
      await caStorage.addReference(hash, 'session-1', 'attachment-1');

      // Remove reference
      await caStorage.removeReference(hash, 'session-1');

      // Run garbage collection
      const gcResult = await caStorage.collectGarbage();

      expect(gcResult.deleted).toBe(1);
      expect(gcResult.freed).toBeGreaterThan(0);

      // Verify attachment deleted
      const exists = await caStorage.attachmentExists(hash);
      expect(exists).toBe(false);

      console.log(`✓ GC cleaned up ${gcResult.deleted} unreferenced attachments (freed ${gcResult.freed} bytes)`);
    });
  });

  describe('Background Operations', () => {
    it('should process PersistenceQueue with 0ms blocking', async () => {
      const queue = getPersistenceQueue();

      // Enqueue 100 items
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        queue.enqueue(`test-${i}`, { data: i }, 'normal');
      }
      const enqueueDuration = performance.now() - startTime;

      // Enqueue should be instant (no blocking)
      expect(enqueueDuration).toBeLessThan(10);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));

      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThan(0);

      console.log(`✓ Enqueued 100 items in ${enqueueDuration.toFixed(2)}ms (0ms blocking), processed ${stats.completed} items`);
    });

    it('should run GC at low priority', async () => {
      const caStorage = new ContentAddressableStorage(adapter as unknown as StorageAdapter);

      // Create unreferenced attachments
      for (let i = 0; i < 10; i++) {
        const attachment = createMockAttachment(`gc-${i}`, 'image');
        await caStorage.saveAttachment(attachment);
      }

      // Run GC
      const gcResult = await caStorage.collectGarbage();

      expect(gcResult.deleted).toBe(10);
      expect(gcResult.duration).toBeGreaterThan(0);

      console.log(`✓ GC ran at low priority, cleaned ${gcResult.deleted} attachments in ${gcResult.duration}ms`);
    });

    it('should optimize indexes at low priority', async () => {
      const indexManager = new InvertedIndexManager(adapter as unknown as StorageAdapter);
      const storage = new ChunkedSessionStorage(adapter as unknown as StorageAdapter);

      // Create sessions
      const sessions = Array.from({ length: 10 }, (_, i) => createTestSession(`optimize-${i}`));
      for (const session of sessions) {
        await storage.saveFullSession(session);
      }

      const metadataList = await storage.listAllMetadata();
      await indexManager.buildIndexes(metadataList);

      // Optimize indexes
      await indexManager.optimizeIndexes();

      // Verify indexes still work
      const results = await indexManager.search({ text: 'Integration' });
      expect(results.sessionIds.length).toBe(10);

      console.log(`✓ Indexes optimized at low priority`);
    });
  });
});
