# Chunked Session Storage - Design Document

**Phase**: 4 - Storage Rewrite
**Task**: 4.1 - Chunked Session Storage
**Status**: Design Complete → Implementation Ready
**Author**: Claude Code
**Date**: 2025-10-24

---

## Executive Summary

Rewrite session storage to use a **chunked architecture** that splits large sessions into small, independently loadable chunks. This enables:
- **Instant metadata loading** (<10ms instead of 5-10s)
- **Progressive data loading** (load only what's needed)
- **Memory efficiency** (don't load entire session into memory)
- **Better caching** (cache hot chunks, evict cold ones)

---

## Problem Analysis

### Current Storage Model

**Problem**: Monolithic session JSON files
```typescript
// Current: Load entire session at once
const session = await storage.load<Session>('sessions/' + sessionId);

// Session = 50MB+ JSON blob with:
// - 100+ screenshots (each with AI analysis, OCR text)
// - Audio segments with transcripts
// - Video chunks
// - Full transcription
// - Canvas spec
// - Summary
```

**Impact**:
- **Load time**: 5-10 seconds for large sessions
- **Memory**: 300-500MB per session in memory
- **UI blocking**: 200-500ms freezes when saving (FIXED in Phase 1, must maintain!)
- **Network**: Can't use in browser (IndexedDB 100MB+ storage limit)

### Session Size Analysis

Analyzed typical session after 2-hour work period:

```
Metadata:              ~10 KB   (id, name, timestamps, config)
Summary:               ~50 KB   (narrative, achievements, insights)
Audio Insights:        ~30 KB   (emotions, patterns, key moments)
Canvas Spec:           ~40 KB   (AI-generated layout)
Full Transcription:   ~100 KB   (2 hours of audio transcript)
Screenshots (120):   ~6,000 KB  (~50KB each with AI analysis)
Audio Segments (40): ~400 KB    (~10KB each)
Video Chunks (20):   ~200 KB    (~10KB metadata each)
Context Items (10):  ~10 KB

TOTAL:               ~6,840 KB  (~6.7 MB for 2-hour session)
```

**Problem**: Loading 6.7MB when you only need the 10KB metadata for the session list!

---

## Proposed Solution: Chunked Storage

### Design Principles

1. **Metadata-First**: Always load tiny metadata first (instant load)
2. **Progressive Loading**: Load chunks only when needed
3. **Chunk Size**: ~1MB per chunk (good balance for I/O)
4. **Backward Compatible**: Existing code continues to work
5. **Zero UI Blocking**: Maintain Phase 1 achievement

### Storage Structure

```
/sessions/
  {session-id}/
    metadata.json           # 10 KB - Core fields (ALWAYS loaded first)
    summary.json            # 50 KB - AI summary (load on detail view)
    audio-insights.json     # 30 KB - Audio analysis (load on demand)
    canvas-spec.json        # 40 KB - Canvas rendering (load on canvas view)
    transcription.json      # 100 KB - Full audio transcript (load on demand)
    screenshots/
      chunk-001.json        # ~1 MB - 20 screenshots
      chunk-002.json        # ~1 MB - 20 screenshots
      chunk-003.json        # ~1 MB - 20 screenshots
      ...
    audio-segments/
      chunk-001.json        # ~1 MB - 100 segments
      chunk-002.json        # ~1 MB - 100 segments
    video-chunks/
      chunk-001.json        # ~1 MB - 100 chunks
    context-items.json      # ~10 KB - User context items
```

### Metadata Structure

**metadata.json** - Always loaded, never chunked:
```typescript
interface SessionMetadata {
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

  // References (IDs only, not full objects)
  trackingNoteId?: string;
  extractedTaskIds: string[];
  extractedNoteIds: string[];
  relationships?: Relationship[];

  // Chunk manifests (tells us what chunks exist)
  chunks: {
    screenshots: {
      count: number;        // Total screenshot count
      chunkCount: number;   // Number of chunks (e.g., 6)
      chunkSize: number;    // Items per chunk (e.g., 20)
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

  // Feature flags (tells us what optional data exists)
  hasSummary: boolean;
  hasAudioInsights: boolean;
  hasCanvasSpec: boolean;
  hasTranscription: boolean;
  hasVideo: boolean;

  // Enrichment tracking
  enrichmentStatus?: EnrichmentStatus;
  enrichmentConfig?: EnrichmentConfig;
  enrichmentLock?: EnrichmentLock;

  // Audio/video config
  audioConfig?: AudioDeviceConfig;
  videoConfig?: VideoRecordingConfig;

  // Version for optimistic locking
  version?: number;

  // Storage metadata
  storageVersion: number;  // Version of storage format (1 = chunked)
  createdAt: string;
  updatedAt: string;
}
```

### Chunk Structures

**screenshots/chunk-NNN.json**:
```typescript
interface ScreenshotsChunk {
  sessionId: string;
  chunkIndex: number;       // 0-based chunk index
  screenshots: SessionScreenshot[];  // 20 screenshots
}
```

**audio-segments/chunk-NNN.json**:
```typescript
interface AudioSegmentsChunk {
  sessionId: string;
  chunkIndex: number;
  segments: SessionAudioSegment[];  // ~100 segments
}
```

### Full Session Reconstruction

When you need the complete session (e.g., for enrichment):
```typescript
// 1. Load metadata first
const metadata = await chunkedStorage.loadMetadata(sessionId);

// 2. Load optional large objects on demand
const summary = await chunkedStorage.loadSummary(sessionId);
const audioInsights = await chunkedStorage.loadAudioInsights(sessionId);
const canvasSpec = await chunkedStorage.loadCanvasSpec(sessionId);
const transcription = await chunkedStorage.loadTranscription(sessionId);

// 3. Load all chunks in parallel
const [screenshots, audioSegments, videoChunks] = await Promise.all([
  chunkedStorage.loadAllScreenshots(sessionId),
  chunkedStorage.loadAllAudioSegments(sessionId),
  chunkedStorage.loadAllVideoChunks(sessionId),
]);

// 4. Reconstruct full session
const session: Session = {
  ...metadata,
  summary,
  audioInsights,
  canvasSpec,
  fullTranscription: transcription,
  screenshots,
  audioSegments,
  video: videoChunks.length > 0 ? {
    ...metadata.video, // Video metadata from metadata.json
    chunks: videoChunks,
  } : undefined,
};
```

---

## API Design

### ChunkedSessionStorage Class

```typescript
/**
 * ChunkedSessionStorage - High-performance chunked storage for sessions
 *
 * Splits large sessions into small, independently loadable chunks for:
 * - Instant metadata loading (<10ms)
 * - Progressive data loading (load only what's needed)
 * - Memory efficiency (don't load entire session)
 */
class ChunkedSessionStorage {
  private adapter: StorageAdapter;
  private cache: LRUCache<string, any>;

  constructor(adapter: StorageAdapter, cacheSize?: number);

  // ========================================
  // METADATA OPERATIONS (always fast)
  // ========================================

  /**
   * Load session metadata only (10 KB, <10ms)
   * Use this for session lists, previews, etc.
   */
  async loadMetadata(sessionId: string): Promise<SessionMetadata>;

  /**
   * Save session metadata
   */
  async saveMetadata(metadata: SessionMetadata): Promise<void>;

  /**
   * List all session metadata (for session list)
   */
  async listAllMetadata(): Promise<SessionMetadata[]>;

  // ========================================
  // OPTIONAL LARGE OBJECTS (load on demand)
  // ========================================

  /**
   * Load session summary (~50 KB)
   */
  async loadSummary(sessionId: string): Promise<SessionSummary | null>;

  /**
   * Save session summary
   */
  async saveSummary(sessionId: string, summary: SessionSummary): Promise<void>;

  /**
   * Load audio insights (~30 KB)
   */
  async loadAudioInsights(sessionId: string): Promise<AudioInsights | null>;

  /**
   * Save audio insights
   */
  async saveAudioInsights(sessionId: string, insights: AudioInsights): Promise<void>;

  /**
   * Load canvas spec (~40 KB)
   */
  async loadCanvasSpec(sessionId: string): Promise<CanvasSpec | null>;

  /**
   * Save canvas spec
   */
  async saveCanvasSpec(sessionId: string, spec: CanvasSpec): Promise<void>;

  /**
   * Load full audio transcription (~100 KB)
   */
  async loadTranscription(sessionId: string): Promise<string | null>;

  /**
   * Save full audio transcription
   */
  async saveTranscription(sessionId: string, transcript: string): Promise<void>;

  // ========================================
  // CHUNKED ARRAYS (progressive loading)
  // ========================================

  /**
   * Load screenshots chunk by chunk
   * @param chunkIndex - 0-based chunk index
   */
  async loadScreenshotsChunk(sessionId: string, chunkIndex: number): Promise<SessionScreenshot[]>;

  /**
   * Load all screenshots (loads all chunks in parallel)
   */
  async loadAllScreenshots(sessionId: string): Promise<SessionScreenshot[]>;

  /**
   * Save screenshots (automatically chunks them)
   */
  async saveScreenshots(sessionId: string, screenshots: SessionScreenshot[]): Promise<void>;

  /**
   * Append single screenshot (updates appropriate chunk)
   */
  async appendScreenshot(sessionId: string, screenshot: SessionScreenshot): Promise<void>;

  /**
   * Load audio segments chunk by chunk
   */
  async loadAudioSegmentsChunk(sessionId: string, chunkIndex: number): Promise<SessionAudioSegment[]>;

  /**
   * Load all audio segments
   */
  async loadAllAudioSegments(sessionId: string): Promise<SessionAudioSegment[]>;

  /**
   * Save audio segments (automatically chunks them)
   */
  async saveAudioSegments(sessionId: string, segments: SessionAudioSegment[]): Promise<void>;

  /**
   * Append single audio segment
   */
  async appendAudioSegment(sessionId: string, segment: SessionAudioSegment): Promise<void>;

  /**
   * Load video chunks
   */
  async loadVideoChunksChunk(sessionId: string, chunkIndex: number): Promise<SessionVideoChunk[]>;

  /**
   * Load all video chunks
   */
  async loadAllVideoChunks(sessionId: string): Promise<SessionVideoChunk[]>;

  /**
   * Save video chunks
   */
  async saveVideoChunks(sessionId: string, chunks: SessionVideoChunk[]): Promise<void>;

  // ========================================
  // FULL SESSION OPERATIONS
  // ========================================

  /**
   * Load complete session (loads all chunks)
   * Use sparingly - prefer loading only what you need
   */
  async loadFullSession(sessionId: string): Promise<Session>;

  /**
   * Save complete session (splits into chunks automatically)
   */
  async saveFullSession(session: Session): Promise<void>;

  /**
   * Delete session and all its chunks
   */
  async deleteSession(sessionId: string): Promise<void>;

  // ========================================
  // MIGRATION UTILITIES
  // ========================================

  /**
   * Migrate legacy session to chunked format
   */
  async migrateFromLegacy(session: Session): Promise<void>;

  /**
   * Check if session is using chunked storage
   */
  async isChunked(sessionId: string): Promise<boolean>;

  // ========================================
  // CACHE MANAGEMENT
  // ========================================

  /**
   * Clear cache for specific session
   */
  clearSessionCache(sessionId: string): void;

  /**
   * Clear entire cache
   */
  clearCache(): void;

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats;
}
```

---

## Performance Targets

| Operation | Current | Target | Improvement |
|-----------|---------|--------|-------------|
| Load metadata (list view) | 5-10s | <10ms | **500-1000x faster** |
| Load full session | 5-10s | <1s | **5-10x faster** |
| Save session (append screenshot) | 0ms (queued) | 0ms | Maintain ✅ |
| Memory usage (1 session) | 300-500MB | <50MB | **6-10x reduction** |
| Search sessions | 2-3s | <100ms | **20-30x faster** (with indexes) |

---

## Implementation Plan

### Phase 1: Core ChunkedSessionStorage (1 day)
- Create `src/services/storage/ChunkedSessionStorage.ts`
- Implement metadata load/save
- Implement chunking logic for arrays
- Implement full session reconstruction

**Deliverables**:
- `ChunkedSessionStorage.ts` (~500 lines)
- Unit tests (~300 lines)

### Phase 2: Context Integration (1 day)
- Update `SessionListContext` to use `loadMetadata()` for list view
- Update `ActiveSessionContext` to use progressive loading
- Maintain backward compatibility with existing sessions

**Deliverables**:
- Updated `SessionListContext.tsx`
- Updated `ActiveSessionContext.tsx`
- Integration tests (~200 lines)

### Phase 3: Migration (0.5 days)
- Create migration script to convert existing sessions
- Add background migration with progress UI (Task 4.8)

**Deliverables**:
- `migrate-to-chunked-storage.ts` (~200 lines)
- Migration tests (~100 lines)

---

## Backward Compatibility

### Legacy Session Detection

```typescript
// Check if session is already chunked
const isChunked = await chunkedStorage.isChunked(sessionId);

if (!isChunked) {
  // Load legacy session
  const session = await storage.load<Session>('sessions/' + sessionId);

  // Migrate to chunked format
  await chunkedStorage.migrateFromLegacy(session);
}
```

### Gradual Migration

- Keep existing sessions in monolithic format
- Migrate on-demand when session is opened
- Background migration for unopened sessions (Task 4.8)

---

## Cache Integration

ChunkedSessionStorage will integrate with LRU cache (Task 4.6):

```typescript
// Cache keys
metadata:{sessionId}        // Always cached (10 KB)
summary:{sessionId}          // Cached if accessed
screenshots:{sessionId}:{chunkIndex}  // Hot chunks cached
audioSegments:{sessionId}:{chunkIndex}
```

**Cache Strategy**:
- **Metadata**: Always cache (tiny, accessed frequently)
- **Chunks**: LRU eviction (cache hot chunks, evict cold)
- **Max size**: 100 MB cache (configurable)

---

## PersistenceQueue Integration

Maintain Phase 1's zero UI blocking:

```typescript
// Append screenshot (background save)
await chunkedStorage.appendScreenshot(sessionId, screenshot);
// ↓
// Internally: queue.enqueue(`screenshots:${sessionId}:${chunkIndex}`, chunk, 'normal');
```

**Benefits**:
- Small chunk writes (1MB) instead of full session (50MB)
- Better batching (multiple screenshots → single chunk write)
- Maintains 0ms UI blocking ✅

---

## Testing Strategy

### Unit Tests
- Chunk splitting logic
- Chunk reconstruction logic
- Metadata save/load
- Individual chunk save/load
- Cache hit/miss scenarios

### Integration Tests
- Full session save → load cycle
- Progressive loading scenarios
- Migration from legacy format
- Concurrent access patterns

### Performance Tests
- Metadata load time (<10ms target)
- Full session load time (<1s target)
- Memory usage (<50MB target)
- Chunk write throughput

---

## Success Criteria

✅ **Task 4.1 Complete When**:
1. ChunkedSessionStorage class implemented (~500 lines)
2. All unit tests passing (80%+ coverage)
3. SessionListContext loads metadata only (<10ms)
4. ActiveSessionContext loads progressively
5. Migration script working
6. Backward compatibility maintained
7. Zero UI blocking maintained (Phase 1)

---

## Next Tasks

After Task 4.1:
- **Task 4.2**: Enhance content-addressable attachments (already has SHA-256)
- **Task 4.3**: Inverted indexes for fast search (<100ms target)
- **Task 4.4**: Optimize PersistenceQueue for chunk writes
- **Task 4.6**: LRU cache for hot chunks (100MB limit)

---

**Document Status**: ✅ Complete → Ready for Implementation
**Next Step**: Implement ChunkedSessionStorage class
**Estimated Time**: 1-2 days for core + integration
**Author**: Claude Code
**Last Updated**: 2025-10-24
