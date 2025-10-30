/**
 * ProgressiveAudioLoader - Stream-based audio loading for instant playback
 *
 * Loads first 3 segments immediately, then background-loads remaining segments.
 * Uses Web Audio API for gapless playback and precise synchronization.
 *
 * Performance Targets:
 * - First playback: <500ms
 * - Background loading: Transparent to user
 * - Memory usage: <100MB (via LRU cache)
 * - Zero audio gaps: Gapless playback
 *
 * Integration:
 * - Phase 4 LRUCache for decoded AudioBuffers
 * - Task 6.3 memory cleanup support (destroy method)
 *
 * @see docs/sessions-rewrite/PHASE_6_VALIDATED_PLAN.md - Task 6.1
 */

import type { SessionAudioSegment } from '../types';
import { getCAStorage } from './storage/ContentAddressableStorage';
import { LRUCache } from './storage/LRUCache';

// ============================================================================
// Types
// ============================================================================

interface SegmentBuffer {
  segment: SessionAudioSegment;
  audioBuffer: AudioBuffer;
  startTime: number;  // Seconds from session start
  duration: number;   // Seconds
}

interface LoadingProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// ============================================================================
// ProgressiveAudioLoader Class
// ============================================================================

export class ProgressiveAudioLoader {
  private audioContext: AudioContext;
  private segments: SessionAudioSegment[] = [];
  private sessionStartTime: number = 0;  // Session start time in ms since epoch
  private loadedBuffers: Map<string, SegmentBuffer> = new Map();
  private bufferCache: LRUCache<string, AudioBuffer>;
  private loadingPromises: Map<string, Promise<AudioBuffer>> = new Map();
  private isLoading = false;
  private currentSourceNode: AudioBufferSourceNode | null = null;
  private backgroundLoadAborted = false;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Phase 4 LRUCache integration for decoded audio buffers
    this.bufferCache = new LRUCache<string, AudioBuffer>({
      maxSizeBytes: 100 * 1024 * 1024,  // 100MB limit
      maxItems: 50,  // Max 50 decoded audio buffers
      ttl: 600000,  // 10 minutes TTL
    });

    console.log('🎵 [PROGRESSIVE AUDIO] Initialized with LRU cache (100MB, 50 buffers, 10min TTL)');
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Initialize with session audio segments
   * Loads first 3 segments immediately for instant playback (<500ms target)
   * Then background-loads remaining segments transparently
   *
   * @param sessionId - Session ID for logging
   * @param sessionStartTime - Session start timestamp (ISO string) for timeline calculation
   * @param segments - Audio segments to load
   * @throws Error if no segments provided
   */
  async initialize(sessionId: string, sessionStartTime: string, segments: SessionAudioSegment[]): Promise<void> {
    const startTime = performance.now();

    // Store session start time for timeline calculations
    this.sessionStartTime = new Date(sessionStartTime).getTime();
    console.log(`🎵 [PROGRESSIVE AUDIO] Session start time: ${sessionStartTime} (${this.sessionStartTime}ms)`);

    // Sort segments chronologically
    this.segments = [...segments].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (this.segments.length === 0) {
      throw new Error('No audio segments to load');
    }

    console.log(`🎵 [PROGRESSIVE AUDIO] Initializing session ${sessionId} with ${this.segments.length} segments`);

    // Load first 3 segments (priority - blocking)
    const priorityCount = Math.min(3, this.segments.length);
    const prioritySegments = this.segments.slice(0, priorityCount);

    console.log(`📦 [PROGRESSIVE AUDIO] Loading first ${priorityCount} segments (priority)...`);

    try {
      await Promise.all(prioritySegments.map(seg => this.loadSegment(seg.id)));

      const loadTime = performance.now() - startTime;
      console.log(`✅ [PROGRESSIVE AUDIO] Priority segments loaded in ${loadTime.toFixed(0)}ms`);

      if (loadTime > 500) {
        console.warn(`⚠️ [PROGRESSIVE AUDIO] Priority load took ${loadTime.toFixed(0)}ms (target: <500ms)`);
      }

      // Start background loading (non-blocking)
      if (this.segments.length > priorityCount) {
        this.loadRemainingInBackground().catch(error => {
          console.error('❌ [PROGRESSIVE AUDIO] Background loading failed:', error);
        });
      }
    } catch (error) {
      console.error('❌ [PROGRESSIVE AUDIO] Priority segment loading failed:', error);
      throw error;
    }
  }

  /**
   * Load a single segment (checks cache first)
   *
   * @param segmentId - Segment ID to load
   * @returns Decoded AudioBuffer
   * @throws Error if segment not found or loading fails
   */
  async loadSegment(segmentId: string): Promise<AudioBuffer> {
    // Check if already loading
    if (this.loadingPromises.has(segmentId)) {
      return this.loadingPromises.get(segmentId)!;
    }

    // Check cache first (Phase 4 integration)
    const cached = this.bufferCache.get(segmentId);
    if (cached) {
      console.log(`💾 [PROGRESSIVE AUDIO] Cache hit for segment ${segmentId}`);

      // Still need to populate loadedBuffers for playback
      if (!this.loadedBuffers.has(segmentId)) {
        const segment = this.segments.find(s => s.id === segmentId);
        if (segment) {
          const startTime = this._calculateSegmentStartTime(segment);
          this.loadedBuffers.set(segmentId, {
            segment,
            audioBuffer: cached,
            startTime,
            duration: cached.duration,
          });
          console.log(`💾 [PROGRESSIVE AUDIO] Using cached segment ${segmentId}: ${startTime}s to ${startTime + cached.duration}s`);
        }
      }

      return cached;
    }

    // Load from storage
    const loadPromise = this._loadSegmentFromStorage(segmentId);
    this.loadingPromises.set(segmentId, loadPromise);

    try {
      const buffer = await loadPromise;

      // Cache the decoded buffer (Phase 4 LRUCache)
      this.bufferCache.set(segmentId, buffer);
      this.loadingPromises.delete(segmentId);

      // Store segment metadata for playback
      const segment = this.segments.find(s => s.id === segmentId);
      if (segment) {
        const startTime = this._calculateSegmentStartTime(segment);
        this.loadedBuffers.set(segmentId, {
          segment,
          audioBuffer: buffer,
          startTime,
          duration: buffer.duration,
        });

        console.log(`✅ [PROGRESSIVE AUDIO] Loaded segment ${segmentId}: ${startTime}s to ${startTime + buffer.duration}s (duration: ${buffer.duration.toFixed(1)}s)`);
      }

      return buffer;
    } catch (error) {
      this.loadingPromises.delete(segmentId);
      console.error(`❌ [PROGRESSIVE AUDIO] Failed to load segment ${segmentId}:`, error);
      throw error;
    }
  }

  /**
   * Get the first available segment (earliest start time)
   *
   * @returns SegmentBuffer if any segments loaded, null otherwise
   */
  getFirstAvailableSegment(): SegmentBuffer | null {
    if (this.loadedBuffers.size === 0) {
      return null;
    }

    let earliest: SegmentBuffer | null = null;
    for (const [_, segmentBuffer] of this.loadedBuffers) {
      if (!earliest || segmentBuffer.startTime < earliest.startTime) {
        earliest = segmentBuffer;
      }
    }

    return earliest;
  }

  /**
   * Get segment at specific time (for playback)
   *
   * @param currentTime - Time in seconds from session start
   * @returns SegmentBuffer if found, null otherwise
   */
  getSegmentAtTime(currentTime: number): SegmentBuffer | null {
    console.log(`[PROGRESSIVE AUDIO] Looking for segment at time ${currentTime}s, have ${this.loadedBuffers.size} loaded buffers`);

    // Log all loaded segments for debugging
    const segments = Array.from(this.loadedBuffers.values());
    if (segments.length > 0) {
      console.log('[PROGRESSIVE AUDIO] Loaded segments timeline:');
      segments.forEach(buf => {
        console.log(`  - Segment ${buf.segment.id}: ${buf.startTime}s to ${buf.startTime + buf.duration}s (duration: ${buf.duration}s)`);
      });
    }

    for (const [_, segmentBuffer] of this.loadedBuffers) {
      const start = segmentBuffer.startTime;
      const end = start + segmentBuffer.duration;

      if (currentTime >= start && currentTime < end) {
        console.log(`[PROGRESSIVE AUDIO] Found segment at time ${currentTime}s: ${segmentBuffer.segment.id} (${start}s-${end}s)`);
        return segmentBuffer;
      }
    }

    console.warn(`[PROGRESSIVE AUDIO] No segment found at time ${currentTime}s`);
    return null;
  }

  /**
   * Get total duration of all segments
   * Calculates from loaded segments or estimates if not fully loaded
   *
   * @returns Total duration in seconds
   */
  getTotalDuration(): number {
    if (this.segments.length === 0) return 0;

    // If all segments loaded, calculate from last segment
    const lastSegment = this.segments[this.segments.length - 1];
    const lastBuffer = this.loadedBuffers.get(lastSegment.id);

    if (lastBuffer) {
      return lastBuffer.startTime + lastBuffer.duration;
    }

    // Estimate based on segment durations
    let totalDuration = 0;
    for (const segment of this.segments) {
      totalDuration += segment.duration;
    }
    return totalDuration;
  }

  /**
   * Check if segment is loaded
   *
   * @param segmentId - Segment ID to check
   * @returns True if segment is loaded and ready for playback
   */
  isSegmentLoaded(segmentId: string): boolean {
    return this.loadedBuffers.has(segmentId);
  }

  /**
   * Get loading progress (0-1)
   *
   * @returns Loading progress as fraction (0.0 to 1.0)
   */
  getLoadingProgress(): LoadingProgress {
    const loaded = this.loadedBuffers.size;
    const total = this.segments.length;
    const percentage = total > 0 ? loaded / total : 0;

    return { loaded, total, percentage };
  }

  /**
   * Get AudioContext (for external audio operations)
   *
   * @returns The Web Audio API context
   */
  getAudioContext(): AudioContext {
    return this.audioContext;
  }

  /**
   * Cleanup (CRITICAL for Task 6.3)
   * Releases all resources and closes AudioContext
   * Must be called on component unmount to prevent memory leaks
   */
  destroy(): void {
    console.log('🗑️ [PROGRESSIVE AUDIO] Destroying loader...');

    // Abort background loading
    this.backgroundLoadAborted = true;

    // Stop any playing audio
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
        this.currentSourceNode.disconnect();
      } catch (e) {
        // Already stopped, ignore
      }
      this.currentSourceNode = null;
    }

    // Clear all data structures
    this.loadedBuffers.clear();
    this.loadingPromises.clear();
    this.segments = [];

    // Clear cache (Phase 4 LRUCache)
    this.bufferCache.clear();

    // Close AudioContext
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close().then(() => {
        console.log('✅ [PROGRESSIVE AUDIO] AudioContext closed');
      }).catch(error => {
        console.error('❌ [PROGRESSIVE AUDIO] Failed to close AudioContext:', error);
      });
    }

    console.log('✅ [PROGRESSIVE AUDIO] Loader destroyed');
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Load segment from storage and decode
   *
   * @param segmentId - Segment ID to load
   * @returns Decoded AudioBuffer
   * @throws Error if segment not found or decoding fails
   */
  private async _loadSegmentFromStorage(segmentId: string): Promise<AudioBuffer> {
    const segment = this.segments.find(s => s.id === segmentId);
    if (!segment) {
      throw new Error(`Segment ${segmentId} not found in timeline`);
    }

    if (!segment.attachmentId) {
      throw new Error(`Segment ${segmentId} has no attachment ID`);
    }

    // Load attachment from CA storage using hash (Phase 4 only - no legacy support)
    if (!segment.hash) {
      console.error(`❌ [PROGRESSIVE AUDIO] Segment ${segmentId} has no hash!`, {
        attachmentId: segment.attachmentId,
        timestamp: segment.timestamp,
      });
      throw new Error(`Segment ${segmentId} missing hash - old session format not supported`);
    }

    const caStorage = await getCAStorage();
    const attachment = await caStorage.loadAttachment(segment.hash);

    if (!attachment || !attachment.base64) {
      console.error(`❌ [PROGRESSIVE AUDIO] CA storage lookup failed for segment ${segmentId}`, {
        hash: segment.hash.substring(0, 16),
        hasAttachment: !!attachment,
      });
      throw new Error(`Audio data not found for segment ${segmentId} (hash: ${segment.hash.substring(0, 8)})`);
    }

    // Decode base64 to ArrayBuffer
    const base64String = attachment.base64.split(',')[1] || attachment.base64;
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decode audio data with Web Audio API
    try {
      const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
      return audioBuffer;
    } catch (error) {
      console.error(`❌ [PROGRESSIVE AUDIO] Failed to decode audio for segment ${segmentId}:`, error);
      throw new Error(`Failed to decode audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Background load remaining segments (non-blocking)
   * Loads 2 segments at a time to avoid overwhelming the system
   * Uses setTimeout() to yield to main thread
   */
  private async loadRemainingInBackground(): Promise<void> {
    if (this.isLoading) {
      console.log('⚠️ [PROGRESSIVE AUDIO] Background loading already in progress');
      return;
    }

    this.isLoading = true;
    this.backgroundLoadAborted = false;

    const remaining = this.segments.slice(3);
    console.log(`📦 [PROGRESSIVE AUDIO] Starting background load of ${remaining.length} remaining segments...`);

    const startTime = performance.now();
    let loadedCount = 0;

    // Load 2 at a time to avoid overwhelming system
    for (let i = 0; i < remaining.length; i += 2) {
      // Check if aborted
      if (this.backgroundLoadAborted) {
        console.log('🛑 [PROGRESSIVE AUDIO] Background loading aborted');
        break;
      }

      const batch = remaining.slice(i, i + 2);

      try {
        await Promise.all(batch.map(seg => this.loadSegment(seg.id)));
        loadedCount += batch.length;

        // Log progress every 10 segments
        if (loadedCount % 10 === 0 || loadedCount === remaining.length) {
          const progress = (loadedCount / remaining.length * 100).toFixed(0);
          console.log(`📦 [PROGRESSIVE AUDIO] Background progress: ${progress}% (${loadedCount}/${remaining.length})`);
        }
      } catch (error) {
        console.error(`❌ [PROGRESSIVE AUDIO] Failed to load batch starting at index ${i}:`, error);
        // Continue loading remaining batches
      }

      // Yield to main thread (100ms)
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const loadTime = performance.now() - startTime;
    console.log(`✅ [PROGRESSIVE AUDIO] Background loading complete in ${(loadTime / 1000).toFixed(1)}s (${loadedCount}/${remaining.length} segments)`);

    this.isLoading = false;
  }

  /**
   * Calculate segment start time relative to session start
   *
   * IMPORTANT: segment.timestamp represents when the segment was CAPTURED (end of recording period),
   * so we need to subtract the duration to get the actual start time in the timeline.
   *
   * @param segment - Segment to calculate start time for
   * @returns Start time in seconds from session start
   */
  private _calculateSegmentStartTime(segment: SessionAudioSegment): number {
    // Validate session start time is initialized
    if (this.sessionStartTime === 0) {
      console.error('❌ [PROGRESSIVE AUDIO] Session start time not initialized');
      return 0;
    }

    // Calculate when the segment was captured (end of recording period)
    const segmentCaptureTime = new Date(segment.timestamp).getTime();
    const captureOffset = (segmentCaptureTime - this.sessionStartTime) / 1000;

    // Subtract duration to get actual start time
    // Example: segment captured at 10s with 10s duration = starts at 0s
    const startTime = captureOffset - segment.duration;

    // Validation: segment should be after or at session start
    if (startTime < 0) {
      console.warn(`⚠️ [PROGRESSIVE AUDIO] Segment ${segment.id} calculated start (${startTime.toFixed(2)}s) is before session start. Clamping to 0s.`);
      return 0;
    }

    return startTime;
  }
}

// ============================================================================
// Singleton Management (Optional)
// ============================================================================

let _progressiveAudioLoader: ProgressiveAudioLoader | null = null;

/**
 * Get singleton instance of ProgressiveAudioLoader
 * Useful for reusing the same AudioContext across components
 *
 * @returns Singleton instance
 */
export function getProgressiveAudioLoader(): ProgressiveAudioLoader {
  if (!_progressiveAudioLoader) {
    _progressiveAudioLoader = new ProgressiveAudioLoader();
  }
  return _progressiveAudioLoader;
}

/**
 * Reset singleton (for testing)
 *
 * @internal
 */
export function resetProgressiveAudioLoader(): void {
  if (_progressiveAudioLoader) {
    _progressiveAudioLoader.destroy();
    _progressiveAudioLoader = null;
  }
}
