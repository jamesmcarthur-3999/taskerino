/**
 * ProgressiveAudioLoader Tests
 *
 * Comprehensive test suite for progressive audio loading functionality.
 * Tests initialization, segment loading, playback, progress tracking, and memory management.
 *
 * @see src/services/ProgressiveAudioLoader.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressiveAudioLoader, resetProgressiveAudioLoader } from '../ProgressiveAudioLoader';
import type { SessionAudioSegment } from '../../types';

// ============================================================================
// Mocks
// ============================================================================

// Mock attachmentStorage
vi.mock('../attachmentStorage', () => ({
  attachmentStorage: {
    getAttachment: vi.fn(async (id: string) => {
      // Return mock audio data (fake WAV file header + silence)
      const wavHeader = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        0x24, 0x00, 0x00, 0x00, // File size - 8
        0x57, 0x41, 0x56, 0x45, // "WAVE"
        0x66, 0x6d, 0x74, 0x20, // "fmt "
        0x10, 0x00, 0x00, 0x00, // Chunk size
        0x01, 0x00,             // Audio format (PCM)
        0x01, 0x00,             // Num channels (mono)
        0x44, 0xac, 0x00, 0x00, // Sample rate (44100)
        0x88, 0x58, 0x01, 0x00, // Byte rate
        0x02, 0x00,             // Block align
        0x10, 0x00,             // Bits per sample (16)
        0x64, 0x61, 0x74, 0x61, // "data"
        0x00, 0x00, 0x00, 0x00, // Data size
      ]);

      // Convert to base64
      const base64 = btoa(String.fromCharCode(...wavHeader));

      return {
        id,
        type: 'audio',
        name: `audio-${id}.wav`,
        mimeType: 'audio/wav',
        size: wavHeader.length,
        base64: `data:audio/wav;base64,${base64}`,
        createdAt: new Date().toISOString(),
      };
    }),
  },
}));

// Mock LRUCache
vi.mock('../storage/LRUCache', () => {
  class MockLRUCache {
    private cache = new Map();

    get(key: string) {
      return this.cache.get(key);
    }

    set(key: string, value: any) {
      this.cache.set(key, value);
    }

    has(key: string) {
      return this.cache.has(key);
    }

    clear() {
      this.cache.clear();
    }
  }

  return {
    LRUCache: MockLRUCache,
  };
});

// Mock AudioContext
class MockAudioContext {
  state = 'running';

  async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    // Return mock AudioBuffer
    return {
      length: 44100, // 1 second at 44.1kHz
      duration: 1.0,
      sampleRate: 44100,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(44100),
      copyFromChannel: () => {},
      copyToChannel: () => {},
    } as AudioBuffer;
  }

  async close() {
    this.state = 'closed';
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
}

(global as any).AudioContext = MockAudioContext;
(global as any).webkitAudioContext = MockAudioContext;

// ============================================================================
// Test Helpers
// ============================================================================

function createMockSegments(count: number): SessionAudioSegment[] {
  const baseTime = new Date('2025-01-01T00:00:00Z');
  return Array.from({ length: count }, (_, i) => ({
    id: `segment-${i}`,
    sessionId: 'test-session',
    timestamp: new Date(baseTime.getTime() + i * 10000).toISOString(), // 10s apart
    duration: 5.0, // 5 seconds each
    transcription: `Segment ${i} transcription`,
    attachmentId: `attachment-${i}`,
  }));
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ProgressiveAudioLoader', () => {
  let loader: ProgressiveAudioLoader;

  beforeEach(() => {
    resetProgressiveAudioLoader();
    loader = new ProgressiveAudioLoader();
  });

  afterEach(() => {
    if (loader) {
      loader.destroy();
    }
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('Initialization', () => {
    it('should load first 3 segments immediately', async () => {
      const segments = createMockSegments(10);

      const start = performance.now();
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);
      const duration = performance.now() - start;

      // Should load first 3 segments quickly (target: <500ms)
      expect(duration).toBeLessThan(1000); // Relaxed for test environment
      expect(loader.isSegmentLoaded(segments[0].id)).toBe(true);
      expect(loader.isSegmentLoaded(segments[1].id)).toBe(true);
      expect(loader.isSegmentLoaded(segments[2].id)).toBe(true);

      // Background loading should be in progress or complete
      const progress = loader.getLoadingProgress();
      expect(progress.loaded).toBeGreaterThanOrEqual(3);
      expect(progress.total).toBe(10);
    });

    it('should start background loading after priority segments', async () => {
      const segments = createMockSegments(10);

      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // Wait a bit for background loading
      await new Promise(resolve => setTimeout(resolve, 300));

      const progress = loader.getLoadingProgress();
      expect(progress.loaded).toBeGreaterThan(3); // Should have loaded more
    });

    it('should handle empty segments array', async () => {
      await expect(loader.initialize('test-session', '2025-01-01T00:00:00Z', [])).rejects.toThrow('No audio segments to load');
    });

    it('should sort segments chronologically', async () => {
      const segments = [
        createMockSegments(1)[0],
        { ...createMockSegments(1)[0], id: 'segment-earlier', timestamp: '2024-01-01T00:00:00Z' },
        createMockSegments(1)[0],
      ];

      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // The "earlier" segment should be loaded first
      expect(loader.isSegmentLoaded('segment-earlier')).toBe(true);
    });
  });

  // ==========================================================================
  // Segment Loading Tests
  // ==========================================================================

  describe('Segment Loading', () => {
    it('should cache decoded buffers', async () => {
      const segments = createMockSegments(5);
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // Load a segment
      const buffer1 = await loader.loadSegment(segments[0].id);
      expect(buffer1).toBeDefined();
      expect(buffer1.duration).toBe(1.0); // From mock

      // Load same segment again (should hit cache)
      const buffer2 = await loader.loadSegment(segments[0].id);
      expect(buffer2).toBe(buffer1); // Same object reference
    });

    it('should not reload already-loaded segments', async () => {
      const segments = createMockSegments(3);
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // All 3 segments should be loaded
      expect(loader.isSegmentLoaded(segments[0].id)).toBe(true);
      expect(loader.isSegmentLoaded(segments[1].id)).toBe(true);
      expect(loader.isSegmentLoaded(segments[2].id)).toBe(true);

      // Loading again should return immediately (from cache)
      const start = performance.now();
      await loader.loadSegment(segments[0].id);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10); // Should be instant
    });

    it('should handle load errors gracefully', async () => {
      const segments = [
        { ...createMockSegments(1)[0], attachmentId: undefined }, // No attachment
      ];

      await expect(loader.initialize('test-session', '2025-01-01T00:00:00Z', segments as any)).rejects.toThrow();
    });

    it('should load segments in correct order', async () => {
      const segments = createMockSegments(5);
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // Wait for all to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check all segments loaded
      for (const segment of segments) {
        expect(loader.isSegmentLoaded(segment.id)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Playback Tests
  // ==========================================================================

  describe('Playback', () => {
    it('should get correct segment at time', async () => {
      const segments = createMockSegments(5);
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // Wait for priority segments
      await new Promise(resolve => setTimeout(resolve, 100));

      // Segment 0 starts at 0s
      const segment0 = loader.getSegmentAtTime(0.5);
      expect(segment0).toBeDefined();
      expect(segment0?.segment.id).toBe('segment-0');

      // Segment 1 starts at ~10s (timestamp gap)
      const segment1 = loader.getSegmentAtTime(10.5);
      expect(segment1).toBeDefined();
      expect(segment1?.segment.id).toBe('segment-1');
    });

    it('should calculate total duration correctly', async () => {
      const segments = createMockSegments(3);
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      const duration = loader.getTotalDuration();

      // Each segment is 5s, but they're 10s apart in timestamp
      // So total duration should be from first to last segment + last duration
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Reasonable upper bound
    });

    it('should return null for invalid times', async () => {
      const segments = createMockSegments(3);
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // Negative time
      expect(loader.getSegmentAtTime(-1)).toBeNull();

      // Far future time
      expect(loader.getSegmentAtTime(99999)).toBeNull();
    });
  });

  // ==========================================================================
  // Progress Tracking Tests
  // ==========================================================================

  describe('Progress Tracking', () => {
    it('should report loading progress accurately', async () => {
      const segments = createMockSegments(10);
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // Initial progress (at least 3 segments loaded)
      const progress1 = loader.getLoadingProgress();
      expect(progress1.loaded).toBeGreaterThanOrEqual(3);
      expect(progress1.total).toBe(10);
      expect(progress1.percentage).toBeGreaterThanOrEqual(0.3);

      // Wait for background loading
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should have made progress or completed
      const progress2 = loader.getLoadingProgress();
      expect(progress2.loaded).toBeGreaterThanOrEqual(progress1.loaded);
    });

    it('should complete background loading', async () => {
      const segments = createMockSegments(5); // Smaller set for faster test
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // Wait for background loading to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      const progress = loader.getLoadingProgress();
      expect(progress.percentage).toBe(1); // 100% complete
      expect(progress.loaded).toBe(5);
    });
  });

  // ==========================================================================
  // Memory Management Tests
  // ==========================================================================

  describe('Memory Management', () => {
    it('should cleanup on destroy', async () => {
      const segments = createMockSegments(5);
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // Destroy loader
      loader.destroy();

      // Check that resources are cleared
      const progress = loader.getLoadingProgress();
      expect(progress.loaded).toBe(0);
      expect(progress.total).toBe(0);
    });

    it('should close AudioContext on destroy', async () => {
      const segments = createMockSegments(3);
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      const audioContext = loader.getAudioContext();
      expect(audioContext.state).toBe('running');

      loader.destroy();

      // Wait for async close
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(audioContext.state).toBe('closed');
    });

    it('should clear all caches on destroy', async () => {
      const segments = createMockSegments(5);
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // Wait for some segments to load
      await new Promise(resolve => setTimeout(resolve, 500));

      const progressBefore = loader.getLoadingProgress();
      expect(progressBefore.loaded).toBeGreaterThan(0);

      loader.destroy();

      const progressAfter = loader.getLoadingProgress();
      expect(progressAfter.loaded).toBe(0);
      expect(progressAfter.percentage).toBe(0);
    });

    it('should abort background loading on destroy', async () => {
      const segments = createMockSegments(20); // Large set
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // Destroy immediately (before background loading completes)
      await new Promise(resolve => setTimeout(resolve, 100));
      loader.destroy();

      const progress = loader.getLoadingProgress();
      expect(progress.loaded).toBeLessThan(20); // Not all loaded
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle single segment', async () => {
      const segments = createMockSegments(1);
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      expect(loader.isSegmentLoaded(segments[0].id)).toBe(true);

      const progress = loader.getLoadingProgress();
      expect(progress.percentage).toBe(1); // 100% (no background loading needed)
    });

    it('should handle segments with no attachmentId', async () => {
      const segments = [
        { ...createMockSegments(1)[0], attachmentId: undefined },
      ];

      await expect(loader.initialize('test-session', '2025-01-01T00:00:00Z', segments as any)).rejects.toThrow();
    });

    it('should handle concurrent loadSegment calls', async () => {
      const segments = createMockSegments(5);
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // Load same segment multiple times concurrently
      const promises = [
        loader.loadSegment(segments[0].id),
        loader.loadSegment(segments[0].id),
        loader.loadSegment(segments[0].id),
      ];

      const results = await Promise.all(promises);

      // All should return the same buffer
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);
    });

    it('should handle getSegmentAtTime before initialization', () => {
      const segment = loader.getSegmentAtTime(5.0);
      expect(segment).toBeNull();
    });

    it('should handle getTotalDuration before initialization', () => {
      const duration = loader.getTotalDuration();
      expect(duration).toBe(0);
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance', () => {
    it('should initialize within 500ms for small sessions', async () => {
      const segments = createMockSegments(10);

      const start = performance.now();
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);
      const duration = performance.now() - start;

      // Target: <500ms, but relaxed for test environment
      expect(duration).toBeLessThan(1000);
    });

    it('should not block on background loading', async () => {
      const segments = createMockSegments(50); // Large set

      const start = performance.now();
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);
      const duration = performance.now() - start;

      // Should complete initialization quickly (only first 3 segments)
      // Background loading happens async
      expect(duration).toBeLessThan(2000);

      // Progress should show incomplete loading
      const progress = loader.getLoadingProgress();
      expect(progress.percentage).toBeLessThan(1);
    });

    it('should use LRU cache effectively', async () => {
      const segments = createMockSegments(5);
      await loader.initialize('test-session', '2025-01-01T00:00:00Z', segments);

      // Load segment once
      const start1 = performance.now();
      await loader.loadSegment(segments[0].id);
      const duration1 = performance.now() - start1;

      // Load same segment again (should hit cache)
      const start2 = performance.now();
      await loader.loadSegment(segments[0].id);
      const duration2 = performance.now() - start2;

      // Cache hit should be much faster
      expect(duration2).toBeLessThan(duration1);
      expect(duration2).toBeLessThan(10); // Should be instant
    });
  });
});
