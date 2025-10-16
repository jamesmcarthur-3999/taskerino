/**
 * TypeScript types for Tauri Rust backend performance commands (Task 3A)
 *
 * These types match the Rust structs in:
 * - session_models.rs
 * - session_storage.rs
 * - attachment_loader.rs
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Session Types (matching Rust session_models.rs)
// ============================================================================

export interface SessionSummary {
  id: string;
  name: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  category?: string;
  screenshotCount: number;
  audioSegmentCount: number;
  hasVideo: boolean;
  hasNotes: boolean;
  hasTranscript: boolean;
}

export interface Session {
  id: string;
  name: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  category?: string;
  screenshots?: Screenshot[];
  audioSegments?: AudioSegment[];
  video?: Video;
  notes?: string;
  transcript?: string;
}

export interface Screenshot {
  id: string;
  attachmentId: string;
  timestamp: string;
  relativeTime?: number;
}

export interface AudioSegment {
  id: string;
  attachmentId: string;
  timestamp: string;
  duration: number;
  startTime?: number;
}

export interface Video {
  fullVideoAttachmentId: string;
  duration?: number;
}

export interface AttachmentMeta {
  id: string;
  type: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface AttachmentCounts {
  total: number;
  images: number;
  audio: number;
  video: number;
  other: number;
}

// ============================================================================
// Session Storage Commands (Rust backend - parallel processing)
// ============================================================================

/**
 * Load session summaries from Rust backend (parallel processing with rayon)
 * Much faster than loading in JavaScript for large session counts
 * Only loads metadata, not full session data
 */
export async function loadSessionSummaries(): Promise<SessionSummary[]> {
  console.log('🦀 [RUST] Loading session summaries from Rust backend...');
  const startTime = performance.now();

  try {
    const summaries = await invoke<SessionSummary[]>('load_session_summaries');
    const loadTime = performance.now() - startTime;
    console.log(`✅ [RUST] Loaded ${summaries.length} session summaries in ${loadTime.toFixed(0)}ms`);
    return summaries;
  } catch (error) {
    console.error('❌ [RUST] Failed to load session summaries:', error);
    throw error;
  }
}

/**
 * Load single session detail on-demand
 * Avoids loading all sessions into memory
 */
export async function loadSessionDetail(sessionId: string): Promise<Session> {
  console.log(`🦀 [RUST] Loading session ${sessionId} from Rust backend...`);

  try {
    const session = await invoke<Session>('load_session_detail', { sessionId });
    console.log(`✅ [RUST] Loaded session ${sessionId}`);
    return session;
  } catch (error) {
    console.error(`❌ [RUST] Failed to load session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Search sessions using Rust backend (parallel full-text search)
 * Searches across name, category, and notes fields
 */
export async function searchSessions(query: string): Promise<SessionSummary[]> {
  if (!query.trim()) {
    return [];
  }

  console.log(`🦀 [RUST] Searching sessions for "${query}"...`);
  const startTime = performance.now();

  try {
    const results = await invoke<SessionSummary[]>('search_sessions', { query });
    const searchTime = performance.now() - startTime;
    console.log(`✅ [RUST] Found ${results.length} matches in ${searchTime.toFixed(0)}ms`);
    return results;
  } catch (error) {
    console.error('❌ [RUST] Search failed:', error);
    throw error;
  }
}

/**
 * Get session count (fast, no full parsing)
 */
export async function getSessionCount(): Promise<number> {
  try {
    const count = await invoke<number>('get_session_count');
    return count;
  } catch (error) {
    console.error('❌ [RUST] Failed to get session count:', error);
    throw error;
  }
}

// ============================================================================
// Attachment Loader Commands (Rust backend - parallel processing)
// ============================================================================

/**
 * Load attachment metadata in parallel (no base64 data)
 * Fast for building UI lists without loading full attachments
 * Uses rayon for multi-core processing
 */
export async function loadAttachmentsMetadataParallel(
  attachmentIds: string[]
): Promise<AttachmentMeta[]> {
  console.log(`🦀 [RUST] Loading ${attachmentIds.length} attachment metadata in parallel...`);
  const startTime = performance.now();

  try {
    const metadata = await invoke<AttachmentMeta[]>(
      'load_attachments_metadata_parallel',
      { attachmentIds }
    );
    const loadTime = performance.now() - startTime;
    console.log(`✅ [RUST] Loaded ${metadata.length} metadata files in ${loadTime.toFixed(0)}ms`);
    return metadata;
  } catch (error) {
    console.error('❌ [RUST] Failed to load attachment metadata:', error);
    throw error;
  }
}

/**
 * Check if attachments exist (fast batch check)
 * Returns list of IDs that exist on disk
 */
export async function checkAttachmentsExist(
  attachmentIds: string[]
): Promise<string[]> {
  try {
    const existing = await invoke<string[]>('check_attachments_exist', { attachmentIds });
    return existing;
  } catch (error) {
    console.error('❌ [RUST] Failed to check attachments:', error);
    throw error;
  }
}

/**
 * Get total size of all attachments (for storage analytics)
 */
export async function getAttachmentsTotalSize(): Promise<number> {
  try {
    const size = await invoke<number>('get_attachments_total_size');
    return size;
  } catch (error) {
    console.error('❌ [RUST] Failed to get total size:', error);
    throw error;
  }
}

/**
 * Count attachments by type (analytics)
 * Uses parallel processing for fast results
 */
export async function countAttachmentsByType(): Promise<AttachmentCounts> {
  console.log('🦀 [RUST] Counting attachments by type...');

  try {
    const counts = await invoke<AttachmentCounts>('count_attachments_by_type');
    console.log(`✅ [RUST] Total attachments: ${counts.total} (${counts.images} images, ${counts.audio} audio, ${counts.video} video)`);
    return counts;
  } catch (error) {
    console.error('❌ [RUST] Failed to count attachments:', error);
    throw error;
  }
}
