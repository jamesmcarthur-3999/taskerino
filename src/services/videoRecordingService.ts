/**
 * VideoRecordingService
 *
 * Manages screen recording during active sessions using ScreenCaptureKit (macOS 12.3+).
 * - Records full screen video throughout session
 * - Creates SessionVideo entity with attachment reference
 * - Integrates with existing Review tab
 *
 * Recording Flow:
 * 1. Check screen recording permission
 * 2. Start recording when session starts (if enabled)
 * 3. Stop recording when session ends
 * 4. Create SessionVideo with attachment reference
 */

import { invoke } from '@tauri-apps/api/core';
import type { Session, SessionVideo } from '../types';
import { generateId } from '../utils/helpers';
import { path } from '@tauri-apps/api';
import { videoStorageService } from './videoStorageService';
import { BaseDirectory, mkdir, exists } from '@tauri-apps/plugin-fs';

export interface VideoQuality {
  width: number;
  height: number;
  fps: number;
}

export class VideoRecordingService {
  private activeSessionId: string | null = null;
  private isRecording: boolean = false;

  /**
   * Ensure the videos directory exists
   */
  private async ensureVideoDir(): Promise<void> {
    const videoDir = 'videos';
    const dirExists = await exists(videoDir, { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
      await mkdir(videoDir, { baseDir: BaseDirectory.AppData, recursive: true });
    }
  }

  /**
   * Check if screen recording permission is granted
   */
  async checkPermission(): Promise<boolean> {
    try {
      const hasPermission = await invoke<boolean>('check_screen_recording_permission');
      return hasPermission;
    } catch (error) {
      console.error('❌ [VIDEO SERVICE] Failed to check permission:', error);
      return false;
    }
  }

  /**
   * Request screen recording permission (opens System Settings)
   */
  async requestPermission(): Promise<void> {
    try {
      await invoke('request_screen_recording_permission');
      console.log('⚠️  [VIDEO SERVICE] Permission request initiated. User must grant in System Settings.');
    } catch (error) {
      console.error('❌ [VIDEO SERVICE] Failed to request permission:', error);
      throw error;
    }
  }

  /**
   * Start video recording for a session
   */
  async startRecording(
    session: Session,
    quality?: VideoQuality
  ): Promise<void> {
    console.log(`🎬 [VIDEO SERVICE] startRecording() called for session: ${session.id}`);
    console.log(`🎬 [VIDEO SERVICE] session.videoRecording = ${session.videoRecording}`);

    if (!session.videoRecording) {
      console.log('⚠️ [VIDEO SERVICE] Video recording is OFF (session.videoRecording = false), skipping recording');
      return;
    }

    console.log('🎬 [VIDEO SERVICE] Starting video recording (permission will be checked by macOS)...');

    // Ensure video directory exists
    await this.ensureVideoDir();

    // Generate output path
    const appDataDir = await path.appDataDir();
    const videoFileName = `session-${session.id}-${Date.now()}.mp4`;
    const outputPath = await path.join(appDataDir, 'videos', videoFileName);

    console.log(`🎬 [VIDEO SERVICE] Output path: ${outputPath}`);

    this.activeSessionId = session.id;
    this.isRecording = true;

    const defaultQuality: VideoQuality = {
      width: 1280,
      height: 720,
      fps: 15
    };

    try {
      await invoke('start_video_recording', {
        sessionId: session.id,
        outputPath,
        quality: quality || defaultQuality
      });

      console.log('✅ [VIDEO SERVICE] Video recording started');
    } catch (error) {
      this.isRecording = false;
      this.activeSessionId = null;
      console.error('❌ [VIDEO SERVICE] Failed to start video recording:', error);

      // Provide user-friendly error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('permission') || errorMessage.includes('denied') || errorMessage.includes('not granted')) {
        throw new Error('Screen recording permission required. The system will prompt you to grant permission. After granting, please restart Taskerino and try again.');
      }

      throw error;
    }
  }

  /**
   * Stop video recording and create SessionVideo entity
   */
  async stopRecording(): Promise<SessionVideo | null> {
    if (!this.isRecording || !this.activeSessionId) {
      console.log('⚠️  [VIDEO SERVICE] No active recording to stop');
      return null;
    }

    console.log('🛑 [VIDEO SERVICE] Stopping video recording');

    try {
      // Stop recording and get the output file path
      const outputPath = await invoke<string>('stop_video_recording');

      console.log(`✅ [VIDEO SERVICE] Video recording stopped, saved to: ${outputPath}`);

      const sessionId = this.activeSessionId;

      // Create Attachment for the video file
      console.log('🎥 [VIDEO SERVICE] Creating video attachment...');
      const attachment = await videoStorageService.createVideoAttachment(outputPath, sessionId);
      console.log(`✅ [VIDEO SERVICE] Video attachment created: ${attachment.id}`);

      // Create SessionVideo entity
      const videoId = generateId();
      const sessionVideo: SessionVideo = {
        id: videoId,
        sessionId: sessionId,
        fullVideoAttachmentId: attachment.id, // Store attachment ID (not path!)
        duration: attachment.duration || 0,
        chunkingStatus: 'pending'
      };

      this.isRecording = false;
      this.activeSessionId = null;

      console.log(`✅ [VIDEO SERVICE] SessionVideo created:`, sessionVideo);
      return sessionVideo;
    } catch (error) {
      console.error('❌ [VIDEO SERVICE] Failed to stop video recording:', error);
      this.isRecording = false;
      this.activeSessionId = null;
      throw error;
    }
  }

  /**
   * Check if currently recording
   */
  async isCurrentlyRecording(): Promise<boolean> {
    try {
      const recording = await invoke<boolean>('is_recording');
      this.isRecording = recording;
      return recording;
    } catch (error) {
      console.error('❌ [VIDEO SERVICE] Failed to check recording status:', error);
      return false;
    }
  }

  /**
   * Get active session ID
   */
  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * Get current recording session from backend
   */
  async getCurrentRecordingSession(): Promise<string | null> {
    try {
      const sessionId = await invoke<string | null>('get_current_recording_session');
      if (sessionId) {
        this.activeSessionId = sessionId;
        this.isRecording = true;
      }
      return sessionId;
    } catch (error) {
      console.error('❌ [VIDEO SERVICE] Failed to get current recording session:', error);
      return null;
    }
  }
}

// Export singleton instance
export const videoRecordingService = new VideoRecordingService();
