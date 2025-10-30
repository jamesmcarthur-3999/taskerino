/**
 * VideoStorageService
 *
 * Handles storage and retrieval of video files.
 * - Creates Attachment entities for video files (stored on disk by Rust)
 * - Generates thumbnails for video preview
 * - Manages video metadata (duration, size)
 * - Handles video file cleanup
 */

import type { Attachment, Session, SessionVideo } from '../types';
import { getCAStorage } from './storage/ContentAddressableStorage';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { stat } from '@tauri-apps/plugin-fs';

class VideoStorageService {
  /**
   * Create an Attachment entity for a video file
   *
   * @param filePath - Path to the video file on disk
   * @param sessionId - Session ID
   * @returns Attachment entity
   */
  async createVideoAttachment(
    filePath: string,
    sessionId: string
  ): Promise<Attachment> {
    console.log(`🎥 [VIDEO STORAGE] Creating attachment for video: ${filePath}`);

    // CRITICAL VALIDATION: Ensure filePath is actually a file path, not an attachment ID
    // This prevents the path corruption bug where attachment IDs get stored as paths
    if (!filePath || typeof filePath !== 'string') {
      throw new Error(`CRITICAL BUG: Invalid filePath (not a string): ${filePath}`);
    }

    if (filePath.startsWith('video-') && !filePath.includes('/')) {
      const error = new Error(`CRITICAL BUG: Attempted to create attachment with ID as path: ${filePath}`);
      console.error('❌ [VIDEO STORAGE] CRITICAL ERROR:', error.message);
      console.error('❌ [VIDEO STORAGE] This is a bug - filePath should be a file system path, not an attachment ID!');
      console.error('❌ [VIDEO STORAGE] Stack trace:', new Error().stack);
      throw error;
    }

    // Additional validation: file path must contain a directory separator
    if (!filePath.includes('/') && !filePath.includes('\\')) {
      throw new Error(`CRITICAL BUG: filePath does not look like a file path (no directory separators): ${filePath}`);
    }

    // Additional validation: file path should be absolute
    if (!filePath.startsWith('/') && !filePath.match(/^[A-Z]:\\/)) {
      console.warn(`⚠️ [VIDEO STORAGE] Warning: filePath is not absolute: ${filePath}`);
    }

    // Get file size using Tauri file system
    const metadata = await this.getVideoMetadata(filePath);

    const attachment: Attachment = {
      id: `video-${sessionId}-${Date.now()}`,
      type: 'video',
      name: `Session Recording.mp4`,
      mimeType: 'video/mp4',
      size: metadata.size,
      createdAt: new Date().toISOString(),
      path: filePath, // Store file path (file is on disk)
      duration: metadata.duration,
      dimensions: metadata.dimensions,
      thumbnail: metadata.thumbnail, // Generated thumbnail
    };

    // Final validation before saving
    if (!attachment.path || !attachment.path.includes('/')) {
      throw new Error(`CRITICAL BUG: attachment.path is invalid before save: ${attachment.path}`);
    }

    // VIDEO FILES: Do NOT save to CA storage (too large, already on disk)
    // Video attachments only store metadata (path, duration, size)
    // The actual video file remains on disk at attachment.path

    // Generate a stable hash based on the file path for reference tracking
    // (NOT content-addressable since we're not storing the video content)
    const encoder = new TextEncoder();
    const data = encoder.encode(filePath + sessionId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    attachment.hash = hash;

    console.log(`✅ [VIDEO STORAGE] Video attachment created: ${attachment.id} (hash: ${hash.substring(0, 8)}...)`);
    console.log(`✅ [VIDEO STORAGE] Attachment path: ${attachment.path}`);
    console.log(`✅ [VIDEO STORAGE] Path validation: ${attachment.path?.includes('/') ? 'VALID (contains /)' : 'INVALID (no / found)'}`);
    console.log(`🎥 [VIDEO STORAGE] Video file remains on disk (not stored in CA storage)`);

    return attachment;
  }

  /**
   * Get video metadata (size, duration, dimensions)
   */
  private async getVideoMetadata(filePath: string): Promise<{
    size: number;
    duration: number;
    dimensions?: { width: number; height: number };
    thumbnail?: string;
  }> {
    try {
      // Get file size using Tauri fs
      const fileStats = await stat(filePath);
      const fileSize = fileStats.size;

      console.log(`📊 [VIDEO STORAGE] Video file size: ${this.formatBytes(fileSize)}`);

      // Get video duration using AVFoundation
      let duration = 0;
      try {
        duration = await invoke<number>('get_video_duration', { videoPath: filePath });
        console.log(`⏱️ [VIDEO STORAGE] Video duration: ${duration} seconds`);
      } catch (error) {
        console.error('❌ [VIDEO STORAGE] Failed to get video duration:', error);
      }

      // Wait for video file to be ready for reading (moov atom finalized)
      console.log('🔍 [VIDEO STORAGE] Checking if video is ready for thumbnail generation...');
      let isReady = false;
      const maxAttempts = 20; // 20 attempts * 500ms = 10 seconds max wait

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          isReady = await invoke<boolean>('is_video_ready', { videoPath: filePath });
          if (isReady) {
            console.log(`✅ [VIDEO STORAGE] Video is ready (attempt ${attempt}/${maxAttempts})`);
            break;
          }

          if (attempt < maxAttempts) {
            console.log(`⏳ [VIDEO STORAGE] Video not ready yet, waiting 500ms (attempt ${attempt}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`❌ [VIDEO STORAGE] Failed to check video readiness (attempt ${attempt}):`, error);
          break;
        }
      }

      // Generate thumbnail at 1 second into video
      let thumbnail: string | undefined;
      if (isReady) {
        try {
          thumbnail = await invoke<string>('generate_video_thumbnail', {
            videoPath: filePath,
            time: 1.0
          });
          console.log(`🖼️ [VIDEO STORAGE] Generated thumbnail (${thumbnail?.length || 0} chars)`);
        } catch (error) {
          console.error('❌ [VIDEO STORAGE] Failed to generate thumbnail:', error);
        }
      } else {
        console.error('❌ [VIDEO STORAGE] Video file not ready after 10 seconds - skipping thumbnail generation');
      }

      return {
        size: fileSize,
        duration,
        dimensions: { width: 1280, height: 720 },
        thumbnail
      };
    } catch (error) {
      console.error('❌ [VIDEO STORAGE] Failed to get video metadata:', error);
      return {
        size: 0,
        duration: 0,
        dimensions: { width: 1280, height: 720 }
      };
    }
  }

  /**
   * Generate video thumbnail (first frame or middle frame)
   *
   * TODO: Implement thumbnail generation using canvas + video element or Rust FFmpeg
   */
  async generateThumbnail(filePath: string): Promise<string | undefined> {
    console.log(`🖼️  [VIDEO STORAGE] Generating thumbnail for: ${filePath}`);

    // TODO: Implement thumbnail generation
    // Options:
    // 1. Use HTML5 video element + canvas (browser-side)
    // 2. Use Rust FFmpeg to extract frame (backend-side)

    return undefined;
  }

  /**
   * Get video attachment by ID or hash (Phase 4)
   */
  async getVideoAttachment(identifier: string): Promise<Attachment | undefined> {
    const caStorage = await getCAStorage();
    const attachment = await caStorage.loadAttachment(identifier);
    return attachment ?? undefined;
  }

  /**
   * Delete video file (videos are NOT in CA storage - they're disk files)
   */
  async deleteVideo(filePath: string, sessionId: string, attachmentId: string): Promise<void> {
    console.log(`🗑️  [VIDEO STORAGE] Deleting video: ${attachmentId}`);
    console.log(`🗑️  [VIDEO STORAGE] File path: ${filePath}`);

    // Video files are stored on disk, not in CA storage
    // Delete the actual file from disk using Tauri fs
    // TODO: Implement file deletion when ready
    // await invoke('delete_file', { path: filePath });

    console.log(`✅ [VIDEO STORAGE] Video marked for deletion: ${attachmentId}`);
    console.log(`⚠️  [VIDEO STORAGE] Note: File deletion not yet implemented`);
  }

  /**
   * Get total storage size for session video
   * Videos are stored on disk, so we use the file system to get size
   */
  async getSessionVideoSize(session: Session): Promise<number> {
    if (!session.video) {
      return 0;
    }

    let totalSize = 0;

    // Get video file path from session
    // Video metadata should have the file path stored
    if (session.video.path) {
      try {
        const fileStats = await stat(session.video.path);
        totalSize += fileStats.size;
      } catch (error) {
        console.error('❌ [VIDEO STORAGE] Failed to get video file size:', error);
      }
    }

    // Note: Chunks are stored in CA storage (via attachmentId), not as separate files
    // Chunk sizes would need to be retrieved from CA storage if needed

    return totalSize;
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format duration to human-readable string (MM:SS)
   */
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get video file URL for playback
   *
   * Converts Tauri file path to asset protocol URL for <video> element
   */
  async getVideoUrl(attachment: Attachment): Promise<string | undefined> {
    if (!attachment.path) {
      console.error('❌ [VIDEO STORAGE] No file path in attachment');
      return undefined;
    }

    // Tauri uses the asset protocol for local file access
    // Convert file path to asset:// URL
    try {
      console.log('🎥 [VIDEO STORAGE] Converting path to asset URL:', attachment.path);
      const assetUrl = convertFileSrc(attachment.path);
      console.log('✅ [VIDEO STORAGE] Converted to asset URL:', assetUrl);
      return assetUrl;
    } catch (error) {
      console.error('❌ [VIDEO STORAGE] Failed to convert file path to URL:', error);
      return undefined;
    }
  }
}

export const videoStorageService = new VideoStorageService();
