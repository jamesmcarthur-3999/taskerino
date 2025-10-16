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
import { attachmentStorage } from './attachmentStorage';
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

    await attachmentStorage.saveAttachment(attachment);
    console.log(`✅ [VIDEO STORAGE] Video attachment created: ${attachment.id}`);
    console.log(`✅ [VIDEO STORAGE] Attachment path: ${attachment.path}`);
    console.log(`✅ [VIDEO STORAGE] Path validation: ${attachment.path?.includes('/') ? 'VALID (contains /)' : 'INVALID (no / found)'}`);

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

      // Generate thumbnail at 1 second into video
      let thumbnail: string | undefined;
      try {
        thumbnail = await invoke<string>('generate_video_thumbnail', {
          videoPath: filePath,
          time: 1.0
        });
        console.log(`🖼️ [VIDEO STORAGE] Generated thumbnail (${thumbnail?.length || 0} chars)`);
      } catch (error) {
        console.error('❌ [VIDEO STORAGE] Failed to generate thumbnail:', error);
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
   * Get video attachment by ID
   */
  async getVideoAttachment(attachmentId: string): Promise<Attachment | undefined> {
    const attachment = await attachmentStorage.getAttachment(attachmentId);
    return attachment ?? undefined;
  }

  /**
   * Delete video file and attachment
   */
  async deleteVideo(attachmentId: string): Promise<void> {
    console.log(`🗑️  [VIDEO STORAGE] Deleting video: ${attachmentId}`);

    const attachment = await attachmentStorage.getAttachment(attachmentId);

    if (attachment?.path) {
      // TODO: Delete file from disk using Tauri fs
      // await invoke('delete_file', { path: attachment.path });
      console.log(`🗑️  [VIDEO STORAGE] File path: ${attachment.path}`);
    }

    await attachmentStorage.deleteAttachment(attachmentId);
    console.log(`✅ [VIDEO STORAGE] Video deleted: ${attachmentId}`);
  }

  /**
   * Get total storage size for session video
   */
  async getSessionVideoSize(session: Session): Promise<number> {
    if (!session.video) {
      return 0;
    }

    let totalSize = 0;

    // Full video size
    if (session.video.fullVideoAttachmentId) {
      const attachment = await attachmentStorage.getAttachment(
        session.video.fullVideoAttachmentId
      );
      if (attachment) {
        totalSize += attachment.size;
      }
    }

    // Chunk sizes (if chunking is implemented)
    if (session.video.chunks) {
      for (const chunk of session.video.chunks) {
        const attachment = await attachmentStorage.getAttachment(chunk.attachmentId);
        if (attachment) {
          totalSize += attachment.size;
        }
      }
    }

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
