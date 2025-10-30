/**
 * Audio Concatenation Service
 *
 * Creates virtual continuous audio stream from individual audio segments.
 * Handles time mapping between segment-relative and session-absolute time.
 * Manages audio loading, caching, and playback coordination.
 */

import type { SessionAudioSegment } from '../types';
import { getCAStorage } from './storage/ContentAddressableStorage';

interface SegmentTimeMapping {
  segmentId: string;
  segmentIndex: number;
  startTime: number; // Session-absolute time (seconds from session start)
  endTime: number;   // Session-absolute time
  duration: number;
  audioBuffer?: AudioBuffer;
  attachmentId: string;
  hash?: string; // Phase 4: Content-addressable storage hash
}

interface ConcatenationOptions {
  gapDuration?: number;  // Silence between segments (ms), default: 200ms
  fadeInOut?: boolean;   // Crossfade between segments, default: false
  preloadNext?: boolean; // Preload next segment for smooth playback, default: true
}

export class AudioConcatenationService {
  private audioContext: AudioContext | null = null;
  private segmentMappings: Map<string, SegmentTimeMapping> = new Map();
  private totalDuration: number = 0;

  // ❌ REMOVED: Unbounded caches caused 15GB memory leak
  // private loadedBuffers: Map<string, AudioBuffer> = new Map();
  // private sessionWAVCache: Map<string, { blob: Blob; url: string; timestamp: number }> = new Map();

  // FUTURE: Consider LRU cache (100MB limit) for performance optimization
  // Currently using on-demand loading (no caching) to prevent memory leaks

  /**
   * Initialize audio context
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Get the shared audio context (for playback components)
   */
  getSharedAudioContext(): AudioContext {
    return this.getAudioContext();
  }

  /**
   * Creates time mappings for all segments
   * This builds a virtual timeline without loading audio
   */
  buildTimeline(segments: SessionAudioSegment[], options: ConcatenationOptions = {}): void {
    const gapDuration = (options.gapDuration ?? 200) / 1000; // Convert to seconds
    this.segmentMappings.clear();
    this.totalDuration = 0;

    // DEBUG: Log segments received by buildTimeline
    const segmentsWithHash = segments.filter(s => s.hash).length;
    const segmentsWithoutHash = segments.filter(s => !s.hash).length;
    console.log(`🎵 [AUDIO CONCAT] buildTimeline: ${segments.length} segments (${segmentsWithHash} with hash, ${segmentsWithoutHash} WITHOUT hash)`);

    if (segments.length > 0) {
      console.log(`🔍 [DEBUG] First segment:`, {
        id: segments[0].id,
        attachmentId: segments[0].attachmentId || 'MISSING',
        hash: segments[0].hash ? segments[0].hash.substring(0, 16) + '...' : 'MISSING',
        timestamp: segments[0].timestamp,
      });

      if (segmentsWithoutHash > 0) {
        const noHashExample = segments.find(s => !s.hash);
        console.error(`❌ [AUDIO CONCAT] Example segment WITHOUT hash:`, {
          id: noHashExample!.id,
          attachmentId: noHashExample!.attachmentId || 'none',
          timestamp: noHashExample!.timestamp,
          keys: Object.keys(noHashExample!),
        });
      }
    }

    // Sort segments by timestamp
    const sortedSegments = [...segments].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sortedSegments.forEach((segment, index) => {
      const startTime = this.totalDuration;
      const duration = segment.duration;
      const endTime = startTime + duration;

      // DEBUG: Log segment structure to diagnose missing attachmentIds
      if (!segment.attachmentId) {
        console.warn(`⚠️  [AUDIO CONCAT] Segment ${segment.id} has no attachmentId!`, {
          id: segment.id,
          duration: segment.duration,
          timestamp: segment.timestamp,
          hasAttachmentId: !!segment.attachmentId,
          segmentKeys: Object.keys(segment),
        });
      }

      this.segmentMappings.set(segment.id, {
        segmentId: segment.id,
        segmentIndex: index,
        startTime,
        endTime,
        duration,
        attachmentId: segment.attachmentId || '',
        hash: segment.hash, // Phase 4: Preserve hash for CA storage lookup
      });

      this.totalDuration = endTime;

      // Add gap (except after last segment)
      if (index < sortedSegments.length - 1) {
        this.totalDuration += gapDuration;
      }
    });

    const missingCount = sortedSegments.filter(s => !s.attachmentId).length;
    console.log(`🎵 [AUDIO CONCAT] Timeline built: ${sortedSegments.length} segments, ${this.totalDuration.toFixed(1)}s total${missingCount > 0 ? ` (${missingCount} missing attachmentIds!)` : ''}`);
  }

  /**
   * Maps segment-relative time to session-absolute time
   */
  segmentTimeToSessionTime(segmentId: string, segmentTime: number): number {
    const mapping = this.segmentMappings.get(segmentId);
    if (!mapping) {
      console.warn(`⚠️  [AUDIO CONCAT] Segment not found: ${segmentId}`);
      return 0;
    }
    return mapping.startTime + segmentTime;
  }

  /**
   * Maps session-absolute time to segment + offset
   */
  sessionTimeToSegment(sessionTime: number): { segmentId: string; offset: number } | null {
    for (const [segmentId, mapping] of this.segmentMappings.entries()) {
      if (sessionTime >= mapping.startTime && sessionTime < mapping.endTime) {
        return {
          segmentId,
          offset: sessionTime - mapping.startTime,
        };
      }
    }
    return null;
  }

  /**
   * Get total duration of virtual continuous stream
   */
  getTotalDuration(): number {
    return this.totalDuration;
  }

  /**
   * Get all segment mappings (for timeline visualization)
   */
  getSegmentMappings(): SegmentTimeMapping[] {
    return Array.from(this.segmentMappings.values()).sort((a, b) => a.segmentIndex - b.segmentIndex);
  }

  /**
   * Load audio buffer for a specific segment
   *
   * NOTE: Caching removed to fix 15GB memory leak. Audio is loaded from storage on-demand.
   * FUTURE: Consider LRU cache (100MB limit) for performance optimization.
   */
  async loadSegmentAudio(segmentId: string): Promise<AudioBuffer | null> {
    // ❌ REMOVED: Cache check (caused memory leak)
    // Always load from storage now (no unbounded caching)

    const mapping = this.segmentMappings.get(segmentId);
    if (!mapping || !mapping.attachmentId) {
      console.warn(`⚠️  [AUDIO CONCAT] Cannot load audio for segment ${segmentId}: no attachment ID`, {
        hasMapping: !!mapping,
        attachmentId: mapping?.attachmentId || 'MISSING',
        mapping: mapping,
      });
      return null;
    }

    try {
      // Phase 4: Load from CA storage using hash
      if (!mapping.hash) {
        console.error(`❌ [AUDIO CONCAT] Segment ${segmentId} has no hash - cannot load from CA storage!`, {
          attachmentId: mapping.attachmentId,
          segmentKeys: Object.keys(mapping),
        });
        return null;
      }

      const caStorage = await getCAStorage();
      console.log(`[AUDIO CONCAT] Loading segment ${segmentId} from CA storage (hash: ${mapping.hash.substring(0, 16)}...)`);
      const attachment = await caStorage.loadAttachment(mapping.hash);

      if (!attachment || !attachment.base64) {
        console.error(`❌ [AUDIO CONCAT] CA storage lookup failed for segment ${segmentId}`, {
          hash: mapping.hash,
          hashPrefix: mapping.hash.substring(0, 8),
          attachmentId: mapping.attachmentId,
          hasAttachment: !!attachment,
          hasBase64: attachment?.base64 ? true : false,
        });
        return null;
      }

      const audioContext = this.getAudioContext();
      const arrayBuffer = this.base64ToArrayBuffer(attachment.base64);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // ❌ REMOVED: Cache storage (caused memory leak)
      // Audio will be re-loaded if needed (trade-off: performance vs memory)

      console.log(`✅ [AUDIO CONCAT] Loaded segment ${segmentId}: ${audioBuffer.duration.toFixed(1)}s (no caching)`);

      return audioBuffer;
    } catch (error) {
      console.error(`❌ [AUDIO CONCAT] Failed to load segment ${segmentId}:`, error);
      return null;
    }
  }

  /**
   * Preload audio for segments around current time (deprecated method, now a no-op)
   *
   * NOTE: Unbounded caches were removed to fix 15GB memory leak.
   * Preloading is no longer effective without caching. This method is kept
   * for backward compatibility but does nothing.
   *
   * @param sessionTime - Current playback time
   * @param windowSeconds - Time window to preload (ignored)
   * @deprecated Caching removed in Phase 4, preloading no longer effective
   */
  async preloadAroundTime(sessionTime: number, windowSeconds: number = 30): Promise<void> {
    // ❌ REMOVED: Preloading (no cache to preload into)
    console.log('ℹ️  [AUDIO CONCAT] preloadAroundTime() is now a no-op (caches removed in Phase 4)');
  }

  /**
   * Create audio source for playback at given session time
   * Returns AudioBufferSourceNode ready to play
   */
  async createAudioSourceAtTime(
    sessionTime: number
  ): Promise<{ source: AudioBufferSourceNode; offset: number } | null> {
    const segmentInfo = this.sessionTimeToSegment(sessionTime);
    if (!segmentInfo) {
      console.warn(`⚠️  [AUDIO CONCAT] No segment at session time ${sessionTime.toFixed(1)}s`);
      return null;
    }

    const audioBuffer = await this.loadSegmentAudio(segmentInfo.segmentId);
    if (!audioBuffer) {
      return null;
    }

    const audioContext = this.getAudioContext();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    return {
      source,
      offset: segmentInfo.offset,
    };
  }

  /**
   * Export concatenated audio as single WAV file
   * Loads all segments and concatenates them into one audio buffer
   *
   * NOTE: Session-based caching was removed to fix 15GB memory leak.
   * Consider LRU caching in future (Phase 2).
   *
   * @param segments - Audio segments to concatenate
   * @param options - Concatenation options
   * @param sessionId - Optional session ID (currently unused, reserved for future caching)
   */
  async exportAsWAV(segments: SessionAudioSegment[], options: ConcatenationOptions = {}, sessionId?: string): Promise<Blob> {
    // ❌ REMOVED: Cache check (caused memory leak)
    // Always generate fresh WAV now (no unbounded caching)

    console.log(`🎵 [AUDIO CONCAT] Exporting ${segments.length} segments as WAV...`);

    this.buildTimeline(segments, options);
    const audioContext = this.getAudioContext();
    const gapDuration = (options.gapDuration ?? 200) / 1000;

    // Load all segment buffers IN PARALLEL (Task 1C optimization)
    console.log(`📦 [AUDIO CONCAT] Loading ${segments.length} audio segments in parallel...`);
    const startTime = performance.now();

    const bufferPromises = segments.map(async (segment, index) => {
      try {
        console.log(`[${index + 1}/${segments.length}] Loading segment ${segment.id}...`);
        const buffer = await this.loadSegmentAudio(segment.id);
        return { buffer, segment, index };
      } catch (error) {
        console.error(`❌ Failed to load segment ${segment.id}:`, error);
        return { buffer: null, segment, index };
      }
    });

    // Wait for all segments to load in parallel
    const results = await Promise.all(bufferPromises);

    // Extract buffers in original order
    const segmentBuffers: AudioBuffer[] = [];
    for (const result of results) {
      if (result.buffer) {
        segmentBuffers.push(result.buffer);
      } else {
        console.warn(`⚠️  Segment ${result.segment.id} failed to load, skipping`);
      }
    }

    const loadTime = performance.now() - startTime;
    console.log(`✅ [AUDIO CONCAT] Loaded ${segmentBuffers.length}/${segments.length} segments in ${loadTime.toFixed(0)}ms (parallel)`);
    console.log(`⚡ [PERFORMANCE] Average load time per segment: ${(loadTime / segments.length).toFixed(0)}ms`);

    if (segmentBuffers.length === 0) {
      throw new Error('No audio segments to export');
    }

    // Calculate total samples needed
    const sampleRate = audioContext.sampleRate;
    const gapSamples = Math.floor(gapDuration * sampleRate);
    const totalSamples = segmentBuffers.reduce((sum, buffer, index) => {
      const gap = index < segmentBuffers.length - 1 ? gapSamples : 0;
      return sum + buffer.length + gap;
    }, 0);

    // Create output buffer (mono for simplicity)
    const outputBuffer = audioContext.createBuffer(1, totalSamples, sampleRate);
    const outputChannel = outputBuffer.getChannelData(0);

    // Copy all segments into output buffer
    let offset = 0;
    for (let i = 0; i < segmentBuffers.length; i++) {
      const buffer = segmentBuffers[i];
      const inputChannel = buffer.getChannelData(0);

      // Copy samples
      outputChannel.set(inputChannel, offset);
      offset += buffer.length;

      // Add gap (silence)
      if (i < segmentBuffers.length - 1) {
        offset += gapSamples;
      }
    }

    // Convert to WAV blob
    const wavBlob = this.audioBufferToWAV(outputBuffer);
    console.log(`✅ [AUDIO CONCAT] Exported WAV: ${(wavBlob.size / 1024 / 1024).toFixed(1)}MB`);

    // ❌ REMOVED: Cache storage (caused memory leak)
    // No longer caching concatenated WAV to prevent 15GB RAM usage
    // Future: Implement LRU cache with 100MB limit (Phase 2)

    return wavBlob;
  }

  /**
   * Export concatenated audio as downsampled WAV (for GPT-4o audio review)
   * Reduces file size by lowering sample rate (e.g., 16kHz → 8kHz)
   *
   * @param segments - Audio segments to concatenate
   * @param targetSampleRate - Target sample rate (default: 8000 Hz for smaller file size)
   * @param options - Concatenation options
   * @returns Downsampled WAV blob
   */
  async exportDownsampledWAV(
    segments: SessionAudioSegment[],
    targetSampleRate: number = 8000,
    options: ConcatenationOptions = {}
  ): Promise<Blob> {
    console.log(`🎵 [AUDIO CONCAT] Exporting downsampled WAV at ${targetSampleRate}Hz...`);

    this.buildTimeline(segments, options);
    const audioContext = this.getAudioContext();
    const gapDuration = (options.gapDuration ?? 200) / 1000;

    // Load all segment buffers IN PARALLEL (Task 1C optimization)
    console.log(`📦 [AUDIO CONCAT] Loading ${segments.length} audio segments in parallel...`);
    const startTime = performance.now();

    const bufferPromises = segments.map(async (segment, index) => {
      try {
        console.log(`[${index + 1}/${segments.length}] Loading segment ${segment.id}...`);
        const buffer = await this.loadSegmentAudio(segment.id);
        return { buffer, segment, index };
      } catch (error) {
        console.error(`❌ Failed to load segment ${segment.id}:`, error);
        return { buffer: null, segment, index };
      }
    });

    // Wait for all segments to load in parallel
    const results = await Promise.all(bufferPromises);

    // Extract buffers in original order
    const segmentBuffers: AudioBuffer[] = [];
    for (const result of results) {
      if (result.buffer) {
        segmentBuffers.push(result.buffer);
      } else {
        console.warn(`⚠️  Segment ${result.segment.id} failed to load, skipping`);
      }
    }

    const loadTime = performance.now() - startTime;
    console.log(`✅ [AUDIO CONCAT] Loaded ${segmentBuffers.length}/${segments.length} segments in ${loadTime.toFixed(0)}ms (parallel)`);
    console.log(`⚡ [PERFORMANCE] Average load time per segment: ${(loadTime / segments.length).toFixed(0)}ms`);

    if (segmentBuffers.length === 0) {
      throw new Error('No audio segments to export');
    }

    // Calculate total samples needed at TARGET sample rate
    const gapSamples = Math.floor(gapDuration * targetSampleRate);

    // Calculate downsampled duration for each buffer
    const downsampleRatio = targetSampleRate / audioContext.sampleRate;

    const totalSamples = segmentBuffers.reduce((sum, buffer, index) => {
      const gap = index < segmentBuffers.length - 1 ? gapSamples : 0;
      const downsampledLength = Math.floor(buffer.length * downsampleRatio);
      return sum + downsampledLength + gap;
    }, 0);

    // Create output buffer at target sample rate (mono for smaller file size)
    const outputBuffer = audioContext.createBuffer(1, totalSamples, targetSampleRate);
    const outputChannel = outputBuffer.getChannelData(0);

    // Downsample and copy all segments into output buffer
    let offset = 0;
    for (let i = 0; i < segmentBuffers.length; i++) {
      const buffer = segmentBuffers[i];
      const inputChannel = buffer.getChannelData(0); // Use first channel (mono)

      // Simple decimation downsampling
      const step = 1 / downsampleRatio;
      const downsampledLength = Math.floor(buffer.length * downsampleRatio);

      for (let j = 0; j < downsampledLength; j++) {
        const sourceIndex = Math.floor(j * step);
        outputChannel[offset + j] = inputChannel[sourceIndex];
      }

      offset += downsampledLength;

      // Add gap (silence)
      if (i < segmentBuffers.length - 1) {
        // Gap is already silence (zeros)
        offset += gapSamples;
      }
    }

    // Convert to WAV blob
    const wavBlob = this.audioBufferToWAV(outputBuffer);
    console.log(`✅ [AUDIO CONCAT] Exported downsampled WAV: ${(wavBlob.size / 1024 / 1024).toFixed(1)}MB at ${targetSampleRate}Hz`);

    return wavBlob;
  }

  /**
   * Export concatenated audio as MP3 (deprecated method)
   *
   * DEPRECATED: This method is obsolete. Use the new MP3 concatenation workflow:
   * 1. Load MP3 attachments from ContentAddressableStorage
   * 2. Write to temp files
   * 3. Call `concatenate_mp3_files` Tauri command (ffmpeg stream copy)
   *
   * See: BackgroundMediaProcessor.concatenateAudio() for the new implementation
   *
   * @deprecated Use MP3 concatenation via ffmpeg instead (see BackgroundMediaProcessor)
   */
  async exportAsMP3(segments: SessionAudioSegment[], options: ConcatenationOptions = {}): Promise<Blob> {
    // Create WAV (old approach - inefficient)
    const wavBlob = await this.exportAsWAV(segments, options);

    // Return WAV (caller should handle MP3 conversion if needed)
    console.warn('⚠️  [AUDIO CONCAT] exportAsMP3() is deprecated - use ffmpeg concatenation instead');
    return wavBlob;
  }

  /**
   * Get cached WAV URL for a session (deprecated method, always returns null)
   *
   * NOTE: Unbounded caches were removed to fix 15GB memory leak.
   * This method is kept for backward compatibility but always returns null.
   *
   * @param sessionId - Session ID (ignored)
   * @returns Always null (no more caching)
   * @deprecated Caching removed in Phase 4
   */
  getCachedWAVUrl(sessionId: string): string | null {
    // ❌ REMOVED: Cache retrieval (no more caches)
    return null;
  }

  /**
   * Get cached WAV duration from timeline
   */
  getCachedDuration(): number {
    return this.totalDuration;
  }

  /**
   * Clear cached audio buffers (deprecated method, now a no-op)
   *
   * NOTE: Unbounded caches were removed to fix 15GB memory leak.
   * This method is kept for backward compatibility but does nothing.
   *
   * @param sessionId - Optional session ID (ignored)
   * @deprecated Use memory-efficient on-demand loading instead
   */
  clearCache(sessionId?: string): void {
    // ❌ REMOVED: Cache clearing (no more caches to clear)
    console.log('ℹ️  [AUDIO CONCAT] clearCache() is now a no-op (caches removed in Phase 4)');
  }

  /**
   * Get cache statistics (deprecated method, returns zeros)
   *
   * NOTE: Unbounded caches were removed to fix 15GB memory leak.
   * This method is kept for backward compatibility but always returns 0.
   *
   * @deprecated Caching removed in Phase 4
   */
  getCacheStats(): { segmentsCached: number; sessionsCached: number; totalSize: number } {
    // ❌ REMOVED: Cache statistics (no more caches to report)
    return {
      segmentsCached: 0,
      sessionsCached: 0,
      totalSize: 0,
    };
  }

  /**
   * Utility: Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Strip data URL prefix if present (e.g., "data:audio/wav;base64,")
    let base64Data = base64;
    if (base64.startsWith('data:') && base64.includes(',')) {
      base64Data = base64.split(',')[1];
      console.log('[AUDIO CONCAT] Stripped data URL prefix from base64 string');
    }

    // Additional validation: Check if string contains only valid base64 characters
    const validBase64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!validBase64Regex.test(base64Data.replace(/\s/g, ''))) {
      console.warn('[AUDIO CONCAT] Base64 string contains invalid characters, attempting cleanup');
      // Remove any whitespace or newlines
      base64Data = base64Data.replace(/\s/g, '');
    }

    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      console.error('[AUDIO CONCAT] Failed to decode base64:', error);
      throw new Error(`Invalid base64 audio data: ${error}`);
    }
  }

  /**
   * Utility: Convert AudioBuffer to WAV Blob
   */
  private audioBufferToWAV(buffer: AudioBuffer): Blob {
    const length = buffer.length * buffer.numberOfChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    const sampleRate = buffer.sampleRate;
    const numChannels = buffer.numberOfChannels;
    const bitsPerSample = 16;

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');

    // fmt chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // byte rate
    view.setUint16(32, numChannels * (bitsPerSample / 8), true); // block align
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // Write audio data
    const offset = 44;
    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let pos = 0;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset + pos, intSample, true);
        pos += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}

// Export singleton instance
export const audioConcatenationService = new AudioConcatenationService();
