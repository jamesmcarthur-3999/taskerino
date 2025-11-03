/**
 * ChunkedSessionStorage - High-performance chunked storage for sessions
 *
 * Splits large sessions into small, independently loadable chunks for:
 * - Instant metadata loading (<10ms target)
 * - Progressive data loading (load only what's needed)
 * - Memory efficiency (don't load entire session into memory)
 *
 * Storage structure:
 * ```
 * /sessions/{session-id}/
 *   metadata.json           # Core fields (~10 KB)
 *   summary.json            # AI summary (~50 KB)
 *   audio-insights.json     # Audio analysis (~30 KB)
 *   canvas-spec.json        # Canvas rendering (~40 KB)
 *   transcription.json      # Full transcript (~100 KB)
 *   screenshots/
 *     chunk-001.json        # ~1 MB - 20 screenshots
 *     chunk-002.json
 *   audio-segments/
 *     chunk-001.json        # ~1 MB - 100 segments
 *   video-chunks/
 *     chunk-001.json        # ~1 MB - 100 chunks
 *   context-items.json      # User context items
 * ```
 *
 * @see docs/sessions-rewrite/CHUNKED_STORAGE_DESIGN.md
 */

import type { StorageAdapter } from './StorageAdapter';
import type {
  Session,
  SessionScreenshot,
  SessionAudioSegment,
  SessionVideoChunk,
  SessionSummary,
  AudioInsights,
  CanvasSpec,
  SessionContextItem,
  SessionVideo,
  AudioDeviceConfig,
  VideoRecordingConfig,
  AudioMode,
} from '../../types';
import type { Relationship } from '../../types/relationships';
import { LRUCache, type CacheStats as LRUCacheStats } from './LRUCache';
import { sanitizeSessionMetadata } from '../../utils/serializationUtils';
import { getPersistenceQueue } from './PersistenceQueue';
import { checkDiskSpaceForData, openStorageLocation } from '../diskSpaceService';
import { StorageFullError } from '@/types/storage';
import { toast } from 'sonner';

/**
 * Session metadata - core fields without large arrays
 * Designed to be <10 KB for instant loading
 */
export interface SessionMetadata {
  // Core identity
  id: string;
  name: string;
  description: string;

  // Lifecycle
  status: 'active' | 'paused' | 'completed' | 'interrupted';
  startTime: string;
  endTime?: string;
  lastScreenshotTime?: string;
  pausedAt?: string;
  totalPausedTime?: number;

  // Configuration
  screenshotInterval: number;
  autoAnalysis: boolean;
  enableScreenshots: boolean;
  audioMode: AudioMode;
  audioRecording: boolean;
  videoRecording?: boolean;

  // References (IDs only)
  trackingNoteId?: string;
  extractedTaskIds: string[];
  extractedNoteIds: string[];
  relationships?: Relationship[];
  relationshipVersion?: number;

  // Chunk manifests
  chunks: {
    screenshots: {
      count: number;
      chunkCount: number;
      chunkSize: number;
    };
    audioSegments: {
      count: number;
      chunkCount: number;
      chunkSize: number;
    };
    videoChunks: {
      count: number;
      chunkCount: number;
      chunkSize: number;
    };
  };

  // Metadata
  tags: string[];
  category?: string;
  subCategory?: string;
  activityType?: string;
  totalDuration?: number;

  // Feature flags
  hasSummary: boolean;
  hasAudioInsights: boolean;
  hasCanvasSpec: boolean;
  hasTranscription: boolean;
  hasVideo: boolean;
  hasFullAudio: boolean;

  // Video metadata
  video?: {
    id: string;
    sessionId: string;
    fullVideoAttachmentId?: string; // Optional: audio-only sessions won't have this
    duration: number;
    chunkingStatus: 'pending' | 'processing' | 'complete' | 'error';
    processedAt?: string;
    chunkingError?: string;
    startTime?: number;
    endTime?: number;
    chapters?: import('../../types').VideoChapter[];
  };

  // Audio review metadata
  audioReviewCompleted: boolean;
  fullAudioAttachmentId?: string;
  transcriptUpgradeCompleted?: boolean;

  // Enrichment tracking (inline types from Session interface)
  enrichmentStatus?: Session['enrichmentStatus'];
  enrichmentConfig?: Session['enrichmentConfig'];
  enrichmentLock?: Session['enrichmentLock'];

  // Audio/video config
  audioConfig?: AudioDeviceConfig;
  videoConfig?: VideoRecordingConfig;

  // Version for optimistic locking
  version?: number;

  // Storage metadata
  storageVersion: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Screenshots chunk
 */
interface ScreenshotsChunk {
  sessionId: string;
  chunkIndex: number;
  screenshots: SessionScreenshot[];
}

/**
 * Audio segments chunk
 */
interface AudioSegmentsChunk {
  sessionId: string;
  chunkIndex: number;
  segments: SessionAudioSegment[];
}

/**
 * Video chunks chunk
 */
interface VideoChunksChunk {
  sessionId: string;
  chunkIndex: number;
  chunks: SessionVideoChunk[];
}

/**
 * Cache statistics (exposed to UI)
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  items: number;
  evictions: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

/**
 * Compression result
 */
export interface CompressionResult {
  sessionId: string;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  bytesSaved: number;
  durationMs: number;
}

/**
 * ChunkedSessionStorage - Main class
 */
export class ChunkedSessionStorage {
  private adapter: StorageAdapter;
  private cache: LRUCache<string, any>;
  private queue = getPersistenceQueue();

  // Chunking configuration
  private readonly SCREENSHOTS_PER_CHUNK = 20;
  private readonly AUDIO_SEGMENTS_PER_CHUNK = 100;
  private readonly VIDEO_CHUNKS_PER_CHUNK = 100;
  private readonly STORAGE_VERSION = 1;

  constructor(
    adapter: StorageAdapter,
    cacheConfig?: { maxSizeBytes?: number; ttl?: number }
  ) {
    this.adapter = adapter;
    this.cache = new LRUCache({
      maxSizeBytes: cacheConfig?.maxSizeBytes ?? 100 * 1024 * 1024, // 100MB default
      ttl: cacheConfig?.ttl ?? 5 * 60 * 1000, // 5 minutes default
    });
  }

  // ========================================
  // METADATA OPERATIONS
  // ========================================

  /**
   * Load session metadata only (10 KB, <10ms target)
   */
  async loadMetadata(sessionId: string): Promise<SessionMetadata | null> {
    const cacheKey = `metadata:${sessionId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const metadata = await this.adapter.load<SessionMetadata>(`sessions/${sessionId}/metadata`);
      if (metadata) {
        this.cache.set(cacheKey, metadata);
      }
      return metadata;
    } catch (error) {
      console.error(`[ChunkedStorage] Failed to load metadata for ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Save session metadata
   */
  async saveMetadata(metadata: SessionMetadata): Promise<void> {
    const startTime = Date.now();

    metadata.updatedAt = new Date().toISOString();
    metadata.storageVersion = this.STORAGE_VERSION;

    // Sanitize metadata to ensure it's JSON-serializable
    // This handles problematic fields like enrichmentStatus, enrichmentLock, etc.
    const sanitized = sanitizeSessionMetadata(metadata);

    // Check disk space BEFORE saving metadata
    try {
      await checkDiskSpaceForData(sanitized);
    } catch (error) {
      if (error instanceof StorageFullError) {
        console.error(`[ChunkedStorage] Storage full, cannot save metadata for session: ${metadata.id}`);
        // Show user-friendly error
        toast.error('Storage Full', {
          description: error.message,
          duration: Infinity,
          action: {
            label: 'Free Space',
            onClick: async () => {
              await openStorageLocation();
            },
          },
        });
      }
      throw error; // Re-throw so caller knows save failed
    }

    // Critical write - use saveImmediate() to bypass adapter's internal queue
    // Metadata is small (~10KB) and critical for session operations
    if ('saveImmediate' in this.adapter) {
      // Use immediate save for TauriFS/IndexedDB (bypasses WriteQueue)
      await (this.adapter as any).saveImmediate(`sessions/${metadata.id}/metadata`, sanitized);
    } else {
      // Fallback for adapters without saveImmediate() method
      console.warn('[ChunkedStorage] Adapter does not support saveImmediate, using regular save');
      await this.adapter.save(`sessions/${metadata.id}/metadata`, sanitized);
    }

    // Invalidate cache to ensure consistency
    this.cache.invalidate(`metadata:${metadata.id}`);

    // Re-cache the fresh sanitized metadata
    this.cache.set(`metadata:${metadata.id}`, sanitized);

    // Update session index (also critical)
    const sessionIndex = await this.adapter.load<string[]>('session-index') || [];
    if (!sessionIndex.includes(metadata.id)) {
      sessionIndex.push(metadata.id);

      // Use immediate save for session-index (skip backup to avoid circular backups)
      if ('saveImmediate' in this.adapter) {
        await (this.adapter as any).saveImmediate('session-index', sessionIndex, true);
      } else {
        console.warn('[ChunkedStorage] Adapter does not support saveImmediate, using regular save for session-index');
        await this.adapter.save('session-index', sessionIndex);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [ChunkedStorage] SAVE METADATA COMPLETE: ${metadata.id} (${duration}ms)`);
  }

  /**
   * List all session metadata (for session list)
   */
  async listAllMetadata(): Promise<SessionMetadata[]> {
    // Load session index (list of session IDs)
    const sessionIndex = await this.adapter.load<string[]>('session-index') || [];

    // Load metadata for each session
    const metadataList: SessionMetadata[] = [];
    for (const sessionId of sessionIndex) {
      const metadata = await this.loadMetadata(sessionId);
      if (metadata) {
        metadataList.push(metadata);
      }
    }

    return metadataList;
  }

  // ========================================
  // OPTIONAL LARGE OBJECTS
  // ========================================

  /**
   * Load session summary (~50 KB)
   */
  async loadSummary(sessionId: string): Promise<SessionSummary | null> {
    const cacheKey = `summary:${sessionId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const summary = await this.adapter.load<SessionSummary>(`sessions/${sessionId}/summary`);
    if (summary) {
      this.cache.set(cacheKey, summary);
    }
    return summary;
  }

  /**
   * Save session summary
   */
  async saveSummary(sessionId: string, summary: SessionSummary): Promise<void> {
    // Check disk space before saving (fire and forget - queue handles errors)
    try {
      await checkDiskSpaceForData(summary);
    } catch (error) {
      if (error instanceof StorageFullError) {
        console.error(`[ChunkedStorage] Storage full, cannot save summary for session: ${sessionId}`);
      }
      throw error;
    }

    this.queue.enqueue(`sessions/${sessionId}/summary`, summary, 'normal');

    // Invalidate and re-cache
    this.cache.invalidate(`summary:${sessionId}`);
    this.cache.set(`summary:${sessionId}`, summary);
  }

  /**
   * Load audio insights (~30 KB)
   */
  async loadAudioInsights(sessionId: string): Promise<AudioInsights | null> {
    const cacheKey = `audioInsights:${sessionId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const insights = await this.adapter.load<AudioInsights>(`sessions/${sessionId}/audio-insights`);
    if (insights) {
      this.cache.set(cacheKey, insights);
    }
    return insights;
  }

  /**
   * Save audio insights
   */
  async saveAudioInsights(sessionId: string, insights: AudioInsights): Promise<void> {
    this.queue.enqueue(`sessions/${sessionId}/audio-insights`, insights, 'normal');

    // Invalidate and re-cache
    this.cache.invalidate(`audioInsights:${sessionId}`);
    this.cache.set(`audioInsights:${sessionId}`, insights);
  }

  /**
   * Load canvas spec (~40 KB)
   */
  async loadCanvasSpec(sessionId: string): Promise<CanvasSpec | null> {
    const cacheKey = `canvasSpec:${sessionId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const spec = await this.adapter.load<CanvasSpec>(`sessions/${sessionId}/canvas-spec`);
    if (spec) {
      this.cache.set(cacheKey, spec);
    }
    return spec;
  }

  /**
   * Save canvas spec
   */
  async saveCanvasSpec(sessionId: string, spec: CanvasSpec): Promise<void> {
    // Use critical priority for canvas - ensure it persists immediately
    // Canvas is important for session reviews and must survive page refreshes
    this.queue.enqueue(`sessions/${sessionId}/canvas-spec`, spec, 'critical');

    // Invalidate and re-cache
    this.cache.invalidate(`canvasSpec:${sessionId}`);
    this.cache.set(`canvasSpec:${sessionId}`, spec);
  }

  /**
   * Load full audio transcription (~100 KB)
   */
  async loadTranscription(sessionId: string): Promise<string | null> {
    const cacheKey = `transcription:${sessionId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const transcript = await this.adapter.load<string>(`sessions/${sessionId}/transcription`);
    if (transcript) {
      this.cache.set(cacheKey, transcript);
    }
    return transcript;
  }

  /**
   * Save full audio transcription
   */
  async saveTranscription(sessionId: string, transcript: string): Promise<void> {
    this.queue.enqueue(`sessions/${sessionId}/transcription`, transcript, 'normal');

    // Invalidate and re-cache
    this.cache.invalidate(`transcription:${sessionId}`);
    this.cache.set(`transcription:${sessionId}`, transcript);
  }

  /**
   * Load context items
   */
  async loadContextItems(sessionId: string): Promise<SessionContextItem[] | null> {
    const items = await this.adapter.load<SessionContextItem[]>(`sessions/${sessionId}/context-items`);
    return items || [];
  }

  /**
   * Save context items
   */
  async saveContextItems(sessionId: string, items: SessionContextItem[]): Promise<void> {
    this.queue.enqueue(`sessions/${sessionId}/context-items`, items, 'normal');
  }

  // ========================================
  // CHUNKED ARRAYS - Screenshots
  // ========================================

  /**
   * Load screenshots chunk by chunk
   */
  async loadScreenshotsChunk(sessionId: string, chunkIndex: number): Promise<SessionScreenshot[]> {
    const cacheKey = `screenshots:${sessionId}:${chunkIndex}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const chunkKey = `sessions/${sessionId}/screenshots/chunk-${String(chunkIndex).padStart(3, '0')}`;
    const chunk = await this.adapter.load<ScreenshotsChunk>(chunkKey);

    if (chunk) {
      // FIX: Cache only metadata (without base64 data) to prevent 15GB memory leak
      // Base64 screenshot data is 50-100MB per image - caching this causes OOM
      const metadataOnly = chunk.screenshots.map(s => ({
        ...s,
        base64: undefined, // Strip base64 data from cache
      }));
      this.cache.set(cacheKey, metadataOnly);

      // Return full screenshots (with base64) to caller
      return chunk.screenshots;
    }

    return [];
  }

  /**
   * Load all screenshots (loads all chunks in parallel)
   */
  async loadAllScreenshots(sessionId: string): Promise<SessionScreenshot[]> {
    const metadata = await this.loadMetadata(sessionId);
    if (!metadata || metadata.chunks.screenshots.chunkCount === 0) {
      return [];
    }

    const chunkCount = metadata.chunks.screenshots.chunkCount;
    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, i) => this.loadScreenshotsChunk(sessionId, i))
    );

    return chunks.flat();
  }

  /**
   * Save screenshots (automatically chunks them)
   */
  async saveScreenshots(sessionId: string, screenshots: SessionScreenshot[]): Promise<void> {
    const chunkSize = this.SCREENSHOTS_PER_CHUNK;
    const chunkCount = Math.ceil(screenshots.length / chunkSize);

    // Save chunks
    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSize;
      const end = Math.min((i + 1) * chunkSize, screenshots.length);
      const chunkScreenshots = screenshots.slice(start, end);

      const chunk: ScreenshotsChunk = {
        sessionId,
        chunkIndex: i,
        screenshots: chunkScreenshots,
      };

      const chunkName = `screenshots/chunk-${String(i).padStart(3, '0')}`;
      this.queue.enqueueChunk(sessionId, chunkName, chunk, 'normal');

      // Invalidate and re-cache (metadata only - no base64)
      this.cache.invalidate(`screenshots:${sessionId}:${i}`);
      const metadataOnly = chunkScreenshots.map(s => ({
        ...s,
        base64: undefined, // Strip base64 data from cache
      }));
      this.cache.set(`screenshots:${sessionId}:${i}`, metadataOnly);
    }

    // Update metadata with chunk manifest
    const metadata = await this.loadMetadata(sessionId);
    if (metadata) {
      metadata.chunks.screenshots = {
        count: screenshots.length,
        chunkCount,
        chunkSize,
      };
      await this.saveMetadata(metadata);
    }
  }

  /**
   * Append single screenshot (updates appropriate chunk)
   */
  async appendScreenshot(sessionId: string, screenshot: SessionScreenshot): Promise<void> {
    // Check disk space BEFORE appending screenshot
    try {
      await checkDiskSpaceForData(screenshot);
    } catch (error) {
      if (error instanceof StorageFullError) {
        console.error(`[ChunkedStorage] Storage full, cannot append screenshot to session: ${sessionId}`);
        // Show specific error for screenshot capture
        toast.error('Cannot Capture Screenshot', {
          description: 'Your disk is full. Free up space to continue recording.',
          duration: Infinity,
          action: {
            label: 'Free Space',
            onClick: async () => {
              await openStorageLocation();
            },
          },
        });
      }
      throw error; // Re-throw so caller knows append failed
    }

    // Load metadata to find which chunk to update
    const metadata = await this.loadMetadata(sessionId);
    if (!metadata) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const currentCount = metadata.chunks.screenshots.count;
    const chunkIndex = Math.floor(currentCount / this.SCREENSHOTS_PER_CHUNK);

    // Load current chunk
    const screenshots = await this.loadScreenshotsChunk(sessionId, chunkIndex);
    screenshots.push(screenshot);

    // Save updated chunk
    const chunk: ScreenshotsChunk = {
      sessionId,
      chunkIndex,
      screenshots,
    };

    const chunkName = `screenshots/chunk-${String(chunkIndex).padStart(3, '0')}`;
    this.queue.enqueueChunk(sessionId, chunkName, chunk, 'normal');

    // Invalidate and re-cache (metadata only - no base64)
    this.cache.invalidate(`screenshots:${sessionId}:${chunkIndex}`);
    const metadataOnly = screenshots.map(s => ({
      ...s,
      base64: undefined, // Strip base64 data from cache
    }));
    this.cache.set(`screenshots:${sessionId}:${chunkIndex}`, metadataOnly);

    // Update metadata
    metadata.chunks.screenshots.count = currentCount + 1;
    metadata.chunks.screenshots.chunkCount = Math.ceil((currentCount + 1) / this.SCREENSHOTS_PER_CHUNK);
    await this.saveMetadata(metadata);
  }

  // ========================================
  // CHUNKED ARRAYS - Audio Segments
  // ========================================

  /**
   * Load audio segments chunk by chunk
   */
  async loadAudioSegmentsChunk(sessionId: string, chunkIndex: number): Promise<SessionAudioSegment[]> {
    const cacheKey = `audioSegments:${sessionId}:${chunkIndex}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const chunkKey = `sessions/${sessionId}/audio-segments/chunk-${String(chunkIndex).padStart(3, '0')}`;
    const chunk = await this.adapter.load<AudioSegmentsChunk>(chunkKey);

    if (chunk) {
      this.cache.set(cacheKey, chunk.segments);
      return chunk.segments;
    }

    return [];
  }

  /**
   * Load all audio segments
   */
  async loadAllAudioSegments(sessionId: string): Promise<SessionAudioSegment[]> {
    const metadata = await this.loadMetadata(sessionId);
    if (!metadata || metadata.chunks.audioSegments.chunkCount === 0) {
      return [];
    }

    const chunkCount = metadata.chunks.audioSegments.chunkCount;
    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, i) => this.loadAudioSegmentsChunk(sessionId, i))
    );

    return chunks.flat();
  }

  /**
   * Save audio segments (automatically chunks them)
   */
  async saveAudioSegments(sessionId: string, segments: SessionAudioSegment[]): Promise<void> {
    const chunkSize = this.AUDIO_SEGMENTS_PER_CHUNK;
    const chunkCount = Math.ceil(segments.length / chunkSize);

    // Save chunks
    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSize;
      const end = Math.min((i + 1) * chunkSize, segments.length);
      const chunkSegments = segments.slice(start, end);

      const chunk: AudioSegmentsChunk = {
        sessionId,
        chunkIndex: i,
        segments: chunkSegments,
      };

      const chunkName = `audio-segments/chunk-${String(i).padStart(3, '0')}`;
      this.queue.enqueueChunk(sessionId, chunkName, chunk, 'normal');

      // Invalidate and re-cache
      this.cache.invalidate(`audioSegments:${sessionId}:${i}`);
      this.cache.set(`audioSegments:${sessionId}:${i}`, chunkSegments);
    }

    // Update metadata
    const metadata = await this.loadMetadata(sessionId);
    if (metadata) {
      metadata.chunks.audioSegments = {
        count: segments.length,
        chunkCount,
        chunkSize,
      };
      await this.saveMetadata(metadata);
    }
  }

  /**
   * Append single audio segment
   */
  async appendAudioSegment(sessionId: string, segment: SessionAudioSegment): Promise<void> {
    // Check disk space BEFORE appending audio segment
    try {
      await checkDiskSpaceForData(segment);
    } catch (error) {
      if (error instanceof StorageFullError) {
        console.error(`[ChunkedStorage] Storage full, cannot append audio segment to session: ${sessionId}`);
        // Show error for audio recording
        toast.error('Cannot Record Audio', {
          description: 'Your disk is full. Free up space to continue recording.',
          duration: Infinity,
          action: {
            label: 'Free Space',
            onClick: async () => {
              await openStorageLocation();
            },
          },
        });
      }
      throw error;
    }

    const metadata = await this.loadMetadata(sessionId);
    if (!metadata) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const currentCount = metadata.chunks.audioSegments.count;
    const chunkIndex = Math.floor(currentCount / this.AUDIO_SEGMENTS_PER_CHUNK);

    // Load current chunk
    const segments = await this.loadAudioSegmentsChunk(sessionId, chunkIndex);
    segments.push(segment);

    // Save updated chunk
    const chunk: AudioSegmentsChunk = {
      sessionId,
      chunkIndex,
      segments,
    };

    const chunkName = `audio-segments/chunk-${String(chunkIndex).padStart(3, '0')}`;
    this.queue.enqueueChunk(sessionId, chunkName, chunk, 'normal');

    // Invalidate and re-cache
    this.cache.invalidate(`audioSegments:${sessionId}:${chunkIndex}`);
    this.cache.set(`audioSegments:${sessionId}:${chunkIndex}`, segments);

    // Update metadata
    metadata.chunks.audioSegments.count = currentCount + 1;
    metadata.chunks.audioSegments.chunkCount = Math.ceil((currentCount + 1) / this.AUDIO_SEGMENTS_PER_CHUNK);
    await this.saveMetadata(metadata);
  }

  // ========================================
  // CHUNKED ARRAYS - Video Chunks
  // ========================================

  /**
   * Load video chunks chunk by chunk
   */
  async loadVideoChunksChunk(sessionId: string, chunkIndex: number): Promise<SessionVideoChunk[]> {
    const cacheKey = `videoChunks:${sessionId}:${chunkIndex}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const chunkKey = `sessions/${sessionId}/video-chunks/chunk-${String(chunkIndex).padStart(3, '0')}`;
    const chunk = await this.adapter.load<VideoChunksChunk>(chunkKey);

    if (chunk) {
      this.cache.set(cacheKey, chunk.chunks);
      return chunk.chunks;
    }

    return [];
  }

  /**
   * Load all video chunks
   */
  async loadAllVideoChunks(sessionId: string): Promise<SessionVideoChunk[]> {
    const metadata = await this.loadMetadata(sessionId);
    if (!metadata || metadata.chunks.videoChunks.chunkCount === 0) {
      return [];
    }

    const chunkCount = metadata.chunks.videoChunks.chunkCount;
    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, i) => this.loadVideoChunksChunk(sessionId, i))
    );

    return chunks.flat();
  }

  /**
   * Save video chunks
   */
  async saveVideoChunks(sessionId: string, chunks: SessionVideoChunk[]): Promise<void> {
    const chunkSize = this.VIDEO_CHUNKS_PER_CHUNK;
    const chunkCount = Math.ceil(chunks.length / chunkSize);

    // Save chunks
    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSize;
      const end = Math.min((i + 1) * chunkSize, chunks.length);
      const chunkChunks = chunks.slice(start, end);

      const chunk: VideoChunksChunk = {
        sessionId,
        chunkIndex: i,
        chunks: chunkChunks,
      };

      const chunkName = `video-chunks/chunk-${String(i).padStart(3, '0')}`;
      this.queue.enqueueChunk(sessionId, chunkName, chunk, 'normal');

      // Invalidate and re-cache
      this.cache.invalidate(`videoChunks:${sessionId}:${i}`);
      this.cache.set(`videoChunks:${sessionId}:${i}`, chunkChunks);
    }

    // Update metadata
    const metadata = await this.loadMetadata(sessionId);
    if (metadata) {
      metadata.chunks.videoChunks = {
        count: chunks.length,
        chunkCount,
        chunkSize,
      };
      await this.saveMetadata(metadata);
    }
  }

  // ========================================
  // FULL SESSION OPERATIONS
  // ========================================

  /**
   * Load complete session (loads all chunks)
   */
  async loadFullSession(sessionId: string): Promise<Session | null> {
    const metadata = await this.loadMetadata(sessionId);
    if (!metadata) {
      return null;
    }

    // Load optional large objects in parallel
    const [summary, audioInsights, canvasSpec, transcription, contextItems] = await Promise.all([
      this.loadSummary(sessionId),
      this.loadAudioInsights(sessionId),
      this.loadCanvasSpec(sessionId),
      this.loadTranscription(sessionId),
      this.loadContextItems(sessionId),
    ]);

    // Load all chunks in parallel
    const [screenshots, audioSegments, videoChunks] = await Promise.all([
      this.loadAllScreenshots(sessionId),
      this.loadAllAudioSegments(sessionId),
      this.loadAllVideoChunks(sessionId),
    ]);

    // Reconstruct full session
    const session: Session = {
      ...this.metadataToSession(metadata),
      summary: summary || undefined,
      audioInsights: audioInsights || undefined,
      canvasSpec: canvasSpec || undefined,
      fullTranscription: transcription || undefined,
      contextItems: contextItems || undefined,
      screenshots,
      audioSegments: audioSegments.length > 0 ? audioSegments : undefined,
      video: metadata.video && videoChunks.length > 0 ? {
        ...metadata.video,
        chunks: videoChunks,
      } : undefined,
    };

    return session;
  }

  /**
   * Get cached session (cache-only, no storage reads)
   *
   * Returns the full session if all components are in cache (optimistic data).
   * Returns null if any component is missing from cache.
   *
   * Use this for enrichment to get the freshest data immediately after session end,
   * before queued writes complete. Falls back to loadFullSession() if cache miss.
   */
  getCachedSession(sessionId: string): Session | null {
    // Try to get metadata from cache
    const metadata = this.cache.get(`metadata:${sessionId}`);
    if (!metadata) {
      return null; // Cache miss - metadata not available
    }

    // Try to get optional large objects from cache
    const summary = this.cache.get(`summary:${sessionId}`);
    const audioInsights = this.cache.get(`audioInsights:${sessionId}`);
    const canvasSpec = this.cache.get(`canvasSpec:${sessionId}`);
    const transcription = this.cache.get(`transcription:${sessionId}`);
    const contextItems = this.cache.get(`contextItems:${sessionId}`);

    // Try to get all chunks from cache
    const screenshots: SessionScreenshot[] = [];
    const screenshotChunkCount = metadata.chunks.screenshots.chunkCount;
    for (let i = 0; i < screenshotChunkCount; i++) {
      const chunk = this.cache.get(`screenshots:${sessionId}:${i}`);
      if (chunk) {
        screenshots.push(...chunk);
      } else {
        // Partial cache miss - return null to trigger full load
        return null;
      }
    }

    const audioSegments: SessionAudioSegment[] = [];
    const audioChunkCount = metadata.chunks.audioSegments.chunkCount;
    for (let i = 0; i < audioChunkCount; i++) {
      const chunk = this.cache.get(`audioSegments:${sessionId}:${i}`);
      if (chunk) {
        audioSegments.push(...chunk);
      } else {
        // Partial cache miss - return null to trigger full load
        return null;
      }
    }

    const videoChunks: SessionVideoChunk[] = [];
    const videoChunkCount = metadata.chunks.videoChunks.chunkCount;
    for (let i = 0; i < videoChunkCount; i++) {
      const chunk = this.cache.get(`videoChunks:${sessionId}:${i}`);
      if (chunk) {
        videoChunks.push(chunk);
      } else {
        // Partial cache miss - return null to trigger full load
        return null;
      }
    }

    // All components cached - reconstruct session
    const session: Session = {
      ...this.metadataToSession(metadata),
      summary: summary || undefined,
      audioInsights: audioInsights || undefined,
      canvasSpec: canvasSpec || undefined,
      fullTranscription: transcription || undefined,
      contextItems: contextItems || undefined,
      screenshots,
      audioSegments: audioSegments.length > 0 ? audioSegments : undefined,
      video: metadata.video && videoChunks.length > 0 ? {
        ...metadata.video,
        chunks: videoChunks,
      } : undefined,
    };

    return session;
  }

  /**
   * Save complete session (splits into chunks automatically)
   */
  async saveFullSession(session: Session): Promise<void> {
    // Convert session to metadata
    const metadata = this.sessionToMetadata(session);

    // Save metadata first
    await this.saveMetadata(metadata);

    // Save optional large objects in parallel
    const savePromises: Promise<void>[] = [];

    if (session.summary) {
      savePromises.push(this.saveSummary(session.id, session.summary));
    }

    if (session.audioInsights) {
      savePromises.push(this.saveAudioInsights(session.id, session.audioInsights));
    }

    if (session.canvasSpec) {
      savePromises.push(this.saveCanvasSpec(session.id, session.canvasSpec));
    }

    if (session.fullTranscription) {
      savePromises.push(this.saveTranscription(session.id, session.fullTranscription));
    }

    if (session.contextItems) {
      savePromises.push(this.saveContextItems(session.id, session.contextItems));
    }

    // Save chunked arrays
    savePromises.push(this.saveScreenshots(session.id, session.screenshots));

    if (session.audioSegments && session.audioSegments.length > 0) {
      savePromises.push(this.saveAudioSegments(session.id, session.audioSegments));
    }

    // SessionVideo no longer has chunks property
    // Video chunks are handled separately via SessionVideoChunk entities

    await Promise.all(savePromises);
  }

  /**
   * Delete session and all its chunks
   */
  async deleteSession(sessionId: string): Promise<void> {
    const metadata = await this.loadMetadata(sessionId);
    if (!metadata) {
      return;
    }

    // Delete all chunks
    const deletePromises: Promise<void>[] = [];

    // Delete screenshot chunks
    for (let i = 0; i < metadata.chunks.screenshots.chunkCount; i++) {
      const chunkKey = `sessions/${sessionId}/screenshots/chunk-${String(i).padStart(3, '0')}`;
      deletePromises.push(this.adapter.delete(chunkKey));
    }

    // Delete audio segment chunks
    for (let i = 0; i < metadata.chunks.audioSegments.chunkCount; i++) {
      const chunkKey = `sessions/${sessionId}/audio-segments/chunk-${String(i).padStart(3, '0')}`;
      deletePromises.push(this.adapter.delete(chunkKey));
    }

    // Delete video chunk chunks
    for (let i = 0; i < metadata.chunks.videoChunks.chunkCount; i++) {
      const chunkKey = `sessions/${sessionId}/video-chunks/chunk-${String(i).padStart(3, '0')}`;
      deletePromises.push(this.adapter.delete(chunkKey));
    }

    // Delete optional large objects
    deletePromises.push(this.adapter.delete(`sessions/${sessionId}/summary`));
    deletePromises.push(this.adapter.delete(`sessions/${sessionId}/audio-insights`));
    deletePromises.push(this.adapter.delete(`sessions/${sessionId}/canvas-spec`));
    deletePromises.push(this.adapter.delete(`sessions/${sessionId}/transcription`));
    deletePromises.push(this.adapter.delete(`sessions/${sessionId}/context-items`));

    // Delete metadata
    deletePromises.push(this.adapter.delete(`sessions/${sessionId}/metadata`));

    await Promise.all(deletePromises);

    // Remove from session index (critical - use adapter directly)
    const sessionIndex = await this.adapter.load<string[]>('session-index') || [];
    const updatedIndex = sessionIndex.filter(id => id !== sessionId);
    await this.adapter.save('session-index', updatedIndex);

    // Clear cache
    this.clearSessionCache(sessionId);
  }

  // ========================================
  // MIGRATION UTILITIES
  // ========================================

  /**
   * Migrate legacy session to chunked format
   */
  async migrateFromLegacy(session: Session): Promise<void> {
    console.log(`[ChunkedStorage] Migrating session ${session.id} to chunked format...`);
    await this.saveFullSession(session);
    console.log(`[ChunkedStorage] ✓ Migration complete for ${session.id}`);
  }

  /**
   * Check if session is using chunked storage
   */
  async isChunked(sessionId: string): Promise<boolean> {
    const metadata = await this.loadMetadata(sessionId);
    return metadata !== null && metadata.storageVersion === this.STORAGE_VERSION;
  }

  // ========================================
  // CACHE MANAGEMENT
  // ========================================

  /**
   * Clear cache for specific session
   * Uses pattern-based invalidation for efficient cleanup
   */
  clearSessionCache(sessionId: string): void {
    // Use pattern invalidation to clear all session-related entries
    // This will match: metadata:sessionId, summary:sessionId, screenshots:sessionId:*, etc.
    const patterns = [
      `metadata:${sessionId}`,
      `summary:${sessionId}`,
      `audioInsights:${sessionId}`,
      `canvasSpec:${sessionId}`,
      `transcription:${sessionId}`,
      `screenshots:${sessionId}:`,
      `audioSegments:${sessionId}:`,
      `videoChunks:${sessionId}:`,
    ];

    let totalInvalidated = 0;
    for (const pattern of patterns) {
      totalInvalidated += this.cache.invalidatePattern(pattern);
    }

    console.log(`[ChunkedStorage] Invalidated ${totalInvalidated} cache entries for session ${sessionId}`);
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[ChunkedStorage] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Reset cache statistics counters
   */
  resetCacheStats(): void {
    this.cache.resetStats();
    console.log('[ChunkedStorage] Cache statistics reset');
  }

  /**
   * Prune expired or oversized cache entries
   */
  pruneCache(): void {
    this.cache.prune();
    console.log('[ChunkedStorage] Cache pruned');
  }

  /**
   * Configure cache size limit
   */
  setCacheSize(maxSizeBytes: number): void {
    // Note: This requires recreating the cache instance
    const currentStats = this.cache.getStats();
    console.log(`[ChunkedStorage] Changing cache size from ${currentStats.maxSize} to ${maxSizeBytes} bytes`);

    // Create new cache with new size
    this.cache = new LRUCache({
      maxSizeBytes,
      ttl: 5 * 60 * 1000, // Keep 5 minute TTL
    });
  }

  // ========================================
  // COMPRESSION SUPPORT
  // ========================================

  /**
   * Compress a session (all chunks and large objects)
   * Returns compression statistics
   */
  async compressSession(sessionId: string): Promise<CompressionResult> {
    const metadata = await this.loadMetadata(sessionId);
    if (!metadata) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const startTime = Date.now();
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    // Compress screenshot chunks
    for (let i = 0; i < metadata.chunks.screenshots.chunkCount; i++) {
      const chunkKey = `sessions/${sessionId}/screenshots/chunk-${String(i).padStart(3, '0')}`;
      const chunk = await this.adapter.load<ScreenshotsChunk>(chunkKey);

      if (chunk) {
        const originalData = JSON.stringify(chunk);
        const originalSize = originalData.length;

        // Compress chunk data
        const compressed = await this.compressData(originalData);
        const compressedSize = compressed.length;

        // Save compressed version (low priority - not time critical)
        this.queue.enqueue(`${chunkKey}.compressed`, compressed, 'low');

        totalOriginalSize += originalSize;
        totalCompressedSize += compressedSize;
      }
    }

    // Compress audio segment chunks
    for (let i = 0; i < metadata.chunks.audioSegments.chunkCount; i++) {
      const chunkKey = `sessions/${sessionId}/audio-segments/chunk-${String(i).padStart(3, '0')}`;
      const chunk = await this.adapter.load<AudioSegmentsChunk>(chunkKey);

      if (chunk) {
        const originalData = JSON.stringify(chunk);
        const originalSize = originalData.length;

        const compressed = await this.compressData(originalData);
        const compressedSize = compressed.length;

        this.queue.enqueue(`${chunkKey}.compressed`, compressed, 'low');

        totalOriginalSize += originalSize;
        totalCompressedSize += compressedSize;
      }
    }

    // Compress video chunk chunks
    for (let i = 0; i < metadata.chunks.videoChunks.chunkCount; i++) {
      const chunkKey = `sessions/${sessionId}/video-chunks/chunk-${String(i).padStart(3, '0')}`;
      const chunk = await this.adapter.load<VideoChunksChunk>(chunkKey);

      if (chunk) {
        const originalData = JSON.stringify(chunk);
        const originalSize = originalData.length;

        const compressed = await this.compressData(originalData);
        const compressedSize = compressed.length;

        this.queue.enqueue(`${chunkKey}.compressed`, compressed, 'low');

        totalOriginalSize += originalSize;
        totalCompressedSize += compressedSize;
      }
    }

    // Compress large objects
    if (metadata.hasSummary) {
      const summary = await this.loadSummary(sessionId);
      if (summary) {
        const originalData = JSON.stringify(summary);
        const originalSize = originalData.length;

        const compressed = await this.compressData(originalData);
        const compressedSize = compressed.length;

        this.queue.enqueue(`sessions/${sessionId}/summary.compressed`, compressed, 'low');

        totalOriginalSize += originalSize;
        totalCompressedSize += compressedSize;
      }
    }

    if (metadata.hasTranscription) {
      const transcription = await this.loadTranscription(sessionId);
      if (transcription) {
        const originalSize = transcription.length;

        const compressed = await this.compressData(transcription);
        const compressedSize = compressed.length;

        this.queue.enqueue(`sessions/${sessionId}/transcription.compressed`, compressed, 'low');

        totalOriginalSize += originalSize;
        totalCompressedSize += compressedSize;
      }
    }

    // Update metadata to mark as compressed
    metadata.updatedAt = new Date().toISOString();
    await this.saveMetadata(metadata);

    const durationMs = Date.now() - startTime;
    const ratio = totalCompressedSize / totalOriginalSize;

    const result: CompressionResult = {
      sessionId,
      originalSize: totalOriginalSize,
      compressedSize: totalCompressedSize,
      ratio,
      bytesSaved: totalOriginalSize - totalCompressedSize,
      durationMs,
    };

    console.log(
      `[ChunkedStorage] Compressed session ${sessionId}: ${this.formatBytes(totalOriginalSize)} → ${this.formatBytes(totalCompressedSize)} ` +
        `(${((1 - ratio) * 100).toFixed(1)}% reduction) in ${durationMs}ms`
    );

    return result;
  }

  /**
   * Check if session is compressed
   */
  async isSessionCompressed(sessionId: string): Promise<boolean> {
    // Check if any compressed chunks exist
    const metadata = await this.loadMetadata(sessionId);
    if (!metadata) return false;

    // Check for compressed screenshot chunk
    if (metadata.chunks.screenshots.chunkCount > 0) {
      const chunkKey = `sessions/${sessionId}/screenshots/chunk-000.compressed`;
      const exists = await this.adapter.exists(chunkKey);
      return exists;
    }

    return false;
  }

  /**
   * Get compression statistics for a session
   */
  async getSessionCompressionStats(sessionId: string): Promise<{
    compressed: boolean;
    originalSize: number;
    compressedSize: number;
    ratio: number;
  }> {
    const metadata = await this.loadMetadata(sessionId);
    if (!metadata) {
      return {
        compressed: false,
        originalSize: 0,
        compressedSize: 0,
        ratio: 1,
      };
    }

    const compressed = await this.isSessionCompressed(sessionId);

    if (!compressed) {
      // Calculate uncompressed size
      const size = await this.calculateSessionSize(sessionId);
      return {
        compressed: false,
        originalSize: size,
        compressedSize: size,
        ratio: 1,
      };
    }

    // Calculate compressed and uncompressed sizes
    let originalSize = 0;
    let compressedSize = 0;

    // Check screenshot chunks
    for (let i = 0; i < metadata.chunks.screenshots.chunkCount; i++) {
      const chunkKey = `sessions/${sessionId}/screenshots/chunk-${String(i).padStart(3, '0')}`;
      const compressedKey = `${chunkKey}.compressed`;

      const chunk = await this.adapter.load<ScreenshotsChunk>(chunkKey);
      const compressedChunk = await this.adapter.load<string>(compressedKey);

      if (chunk) {
        originalSize += JSON.stringify(chunk).length;
      }
      if (compressedChunk) {
        compressedSize += compressedChunk.length;
      }
    }

    return {
      compressed: true,
      originalSize,
      compressedSize,
      ratio: compressedSize / originalSize,
    };
  }

  /**
   * Calculate total session size (uncompressed)
   */
  private async calculateSessionSize(sessionId: string): Promise<number> {
    const metadata = await this.loadMetadata(sessionId);
    if (!metadata) return 0;

    let size = 0;

    // Metadata
    size += JSON.stringify(metadata).length;

    // Chunks
    for (let i = 0; i < metadata.chunks.screenshots.chunkCount; i++) {
      const chunkKey = `sessions/${sessionId}/screenshots/chunk-${String(i).padStart(3, '0')}`;
      const chunk = await this.adapter.load<ScreenshotsChunk>(chunkKey);
      if (chunk) {
        size += JSON.stringify(chunk).length;
      }
    }

    // Large objects
    if (metadata.hasSummary) {
      const summary = await this.loadSummary(sessionId);
      if (summary) {
        size += JSON.stringify(summary).length;
      }
    }

    if (metadata.hasTranscription) {
      const transcription = await this.loadTranscription(sessionId);
      if (transcription) {
        size += transcription.length;
      }
    }

    return size;
  }

  /**
   * Compress data using gzip (uses existing compressionUtils)
   */
  private async compressData(data: string): Promise<string> {
    const { compressData } = await import('./compressionUtils');
    return compressData(data);
  }

  /**
   * Format bytes for logging
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  // ========================================
  // PRIVATE HELPERS
  // ========================================

  /**
   * Convert Session to SessionMetadata
   */
  private sessionToMetadata(session: Session): SessionMetadata {
    const metadata: SessionMetadata = {
      // Core identity
      id: session.id,
      name: session.name,
      description: session.description,

      // Lifecycle
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      lastScreenshotTime: session.lastScreenshotTime,
      pausedAt: session.pausedAt,
      totalPausedTime: session.totalPausedTime,

      // Configuration
      screenshotInterval: session.screenshotInterval,
      autoAnalysis: session.autoAnalysis,
      enableScreenshots: session.enableScreenshots,
      audioMode: session.audioMode,
      audioRecording: session.audioRecording,
      videoRecording: session.videoRecording,

      // References
      trackingNoteId: session.trackingNoteId,
      extractedTaskIds: session.extractedTaskIds,
      extractedNoteIds: session.extractedNoteIds,
      relationships: session.relationships,
      relationshipVersion: session.relationshipVersion,

      // Chunk manifests (will be updated when chunks are saved)
      chunks: {
        screenshots: {
          count: session.screenshots.length,
          chunkCount: Math.ceil(session.screenshots.length / this.SCREENSHOTS_PER_CHUNK),
          chunkSize: this.SCREENSHOTS_PER_CHUNK,
        },
        audioSegments: {
          count: session.audioSegments?.length || 0,
          chunkCount: Math.ceil((session.audioSegments?.length || 0) / this.AUDIO_SEGMENTS_PER_CHUNK),
          chunkSize: this.AUDIO_SEGMENTS_PER_CHUNK,
        },
        videoChunks: {
          count: 0, // SessionVideo no longer has chunks (SessionVideoChunk is separate entity)
          chunkCount: 0,
          chunkSize: this.VIDEO_CHUNKS_PER_CHUNK,
        },
      },

      // Metadata
      tags: session.tags,
      category: session.category,
      subCategory: session.subCategory,
      activityType: session.activityType,
      totalDuration: session.totalDuration,

      // Feature flags
      hasSummary: !!session.summary,
      hasAudioInsights: !!session.audioInsights,
      hasCanvasSpec: !!session.canvasSpec,
      hasTranscription: !!session.fullTranscription,
      hasVideo: !!session.video,
      hasFullAudio: !!session.fullAudioAttachmentId,

      // Video metadata
      video: session.video ? {
        id: session.video.id,
        sessionId: session.video.sessionId,
        path: session.video.path,
        optimizedPath: session.video.optimizedPath,
        duration: session.video.duration,
        chunkingStatus: session.video.chunkingStatus,
        processedAt: session.video.processedAt,
        chunkingError: session.video.chunkingError,
      } : undefined,

      // Audio review
      audioReviewCompleted: session.audioReviewCompleted,
      fullAudioAttachmentId: session.fullAudioAttachmentId,
      transcriptUpgradeCompleted: session.transcriptUpgradeCompleted,

      // Enrichment
      enrichmentStatus: session.enrichmentStatus,
      enrichmentConfig: session.enrichmentConfig,
      enrichmentLock: session.enrichmentLock,

      // Audio/video config
      audioConfig: session.audioConfig,
      videoConfig: session.videoConfig,

      // Version
      version: session.version,

      // Storage metadata
      storageVersion: this.STORAGE_VERSION,
      createdAt: session.startTime,
      updatedAt: new Date().toISOString(),
    };

    return metadata;
  }

  /**
   * Convert SessionMetadata back to partial Session
   * (without large arrays - those are loaded separately)
   */
  private metadataToSession(metadata: SessionMetadata): Pick<Session, 'id' | 'name' | 'description' | 'status' | 'startTime' | 'endTime' | 'lastScreenshotTime' | 'pausedAt' | 'totalPausedTime' | 'screenshotInterval' | 'autoAnalysis' | 'enableScreenshots' | 'audioMode' | 'audioRecording' | 'videoRecording' | 'trackingNoteId' | 'extractedTaskIds' | 'extractedNoteIds' | 'relationships' | 'relationshipVersion' | 'tags' | 'category' | 'subCategory' | 'activityType' | 'totalDuration' | 'audioReviewCompleted' | 'fullAudioAttachmentId' | 'transcriptUpgradeCompleted' | 'enrichmentStatus' | 'enrichmentConfig' | 'enrichmentLock' | 'audioConfig' | 'videoConfig' | 'version'> {
    return {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      status: metadata.status,
      startTime: metadata.startTime,
      endTime: metadata.endTime,
      lastScreenshotTime: metadata.lastScreenshotTime,
      pausedAt: metadata.pausedAt,
      totalPausedTime: metadata.totalPausedTime,
      screenshotInterval: metadata.screenshotInterval,
      autoAnalysis: metadata.autoAnalysis,
      enableScreenshots: metadata.enableScreenshots,
      audioMode: metadata.audioMode,
      audioRecording: metadata.audioRecording,
      videoRecording: metadata.videoRecording,
      trackingNoteId: metadata.trackingNoteId,
      extractedTaskIds: metadata.extractedTaskIds,
      extractedNoteIds: metadata.extractedNoteIds,
      relationships: metadata.relationships,
      relationshipVersion: metadata.relationshipVersion,
      tags: metadata.tags,
      category: metadata.category,
      subCategory: metadata.subCategory,
      activityType: metadata.activityType,
      totalDuration: metadata.totalDuration,
      audioReviewCompleted: metadata.audioReviewCompleted,
      fullAudioAttachmentId: metadata.fullAudioAttachmentId,
      transcriptUpgradeCompleted: metadata.transcriptUpgradeCompleted,
      enrichmentStatus: metadata.enrichmentStatus,
      enrichmentConfig: metadata.enrichmentConfig,
      enrichmentLock: metadata.enrichmentLock,
      audioConfig: metadata.audioConfig,
      videoConfig: metadata.videoConfig,
      version: metadata.version,
    };
  }
}

/**
 * Get singleton instance (for convenience)
 */
let instance: ChunkedSessionStorage | null = null;

export async function getChunkedStorage(): Promise<ChunkedSessionStorage> {
  if (instance) {
    return instance;
  }

  const { getStorage } = await import('./index');
  const adapter = await getStorage();
  instance = new ChunkedSessionStorage(adapter);
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetChunkedStorage(): void {
  instance = null;
}
