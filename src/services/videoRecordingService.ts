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
import type { Session, SessionVideo, DisplayInfo, WindowInfo, WebcamInfo } from '../types';
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

  // Caching for enumeration methods (5-second TTL as per implementation plan)
  private displayCache: { data: DisplayInfo[], timestamp: number } | null = null;
  private windowCache: { data: WindowInfo[], timestamp: number } | null = null;
  private webcamCache: { data: WebcamInfo[], timestamp: number } | null = null;
  private readonly CACHE_TTL = 5000; // 5 seconds

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

    if (session.videoConfig) {
      return this.startRecordingWithConfig(session);
    }

    console.log('🎬 [VIDEO SERVICE] Starting video recording (permission will be checked by macOS)...');

    await this.ensureVideoDir();

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

  /**
   * Enumerate all available displays
   * Results are cached for 5 seconds to reduce system calls
   * @returns Array of display information objects
   * @throws Error if enumeration fails
   */
  async enumerateDisplays(): Promise<DisplayInfo[]> {
    // Check cache first
    if (this.displayCache && Date.now() - this.displayCache.timestamp < this.CACHE_TTL) {
      console.log('🖥️ [VIDEO SERVICE] Returning cached displays');
      return this.displayCache.data;
    }

    try {
      console.log('🖥️ [VIDEO SERVICE] Enumerating displays...');
      const displays = await invoke<DisplayInfo[]>('enumerate_displays');

      // Validate response
      if (!Array.isArray(displays)) {
        throw new Error('Invalid response from enumerate_displays - expected array');
      }

      // Cache results
      this.displayCache = { data: displays, timestamp: Date.now() };

      console.log(`🖥️ [VIDEO SERVICE] Found ${displays.length} display(s)`);
      return displays;
    } catch (error) {
      console.error('❌ [VIDEO SERVICE] Failed to enumerate displays:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to enumerate displays: ${errorMessage}`);
    }
  }

  /**
   * Enumerate all capturable windows
   * Results are cached for 5 seconds to reduce system calls
   * @returns Array of window information objects
   * @throws Error if enumeration fails
   */
  async enumerateWindows(): Promise<WindowInfo[]> {
    // Check cache first
    if (this.windowCache && Date.now() - this.windowCache.timestamp < this.CACHE_TTL) {
      console.log('🪟 [VIDEO SERVICE] Returning cached windows');
      return this.windowCache.data;
    }

    try {
      console.log('🪟 [VIDEO SERVICE] Enumerating windows...');
      const windows = await invoke<WindowInfo[]>('enumerate_windows');

      // Validate response
      if (!Array.isArray(windows)) {
        throw new Error('Invalid response from enumerate_windows - expected array');
      }

      // Cache results
      this.windowCache = { data: windows, timestamp: Date.now() };

      console.log(`🪟 [VIDEO SERVICE] Found ${windows.length} window(s)`);
      return windows;
    } catch (error) {
      console.error('❌ [VIDEO SERVICE] Failed to enumerate windows:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to enumerate windows: ${errorMessage}`);
    }
  }

  /**
   * Enumerate all available webcams
   * Results are cached for 5 seconds to reduce system calls
   * @returns Array of webcam information objects
   * @throws Error if enumeration fails
   */
  async enumerateWebcams(): Promise<WebcamInfo[]> {
    // Check cache first
    if (this.webcamCache && Date.now() - this.webcamCache.timestamp < this.CACHE_TTL) {
      console.log('📹 [VIDEO SERVICE] Returning cached webcams');
      return this.webcamCache.data;
    }

    try {
      console.log('📹 [VIDEO SERVICE] Enumerating webcams...');
      const webcams = await invoke<WebcamInfo[]>('enumerate_webcams');

      // Validate response
      if (!Array.isArray(webcams)) {
        throw new Error('Invalid response from enumerate_webcams - expected array');
      }

      // Cache results
      this.webcamCache = { data: webcams, timestamp: Date.now() };

      console.log(`📹 [VIDEO SERVICE] Found ${webcams.length} webcam(s)`);
      return webcams;
    } catch (error) {
      console.error('❌ [VIDEO SERVICE] Failed to enumerate webcams:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to enumerate webcams: ${errorMessage}`);
    }
  }

  /**
   * Switch display during active recording
   * Allows changing the display being captured without stopping the recording
   * @param displayId - ID of the new display to capture
   * @throws Error if display switch fails or display ID is invalid
   */
  async switchDisplay(displayId: string): Promise<void> {
    if (!displayId || displayId.trim() === '') {
      throw new Error('Display ID is required and cannot be empty');
    }

    try {
      console.log('[VIDEO] Switching display to:', displayId);
      await invoke('switch_display', { displayId });
      console.log('[VIDEO] Display switched successfully');
    } catch (error) {
      console.error('[VIDEO] Failed to switch display:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to switch display: ${errorMessage}`);
    }
  }

  /**
   * Update webcam mode (PiP configuration) during active recording
   * Allows changing webcam overlay position, size, and appearance without stopping
   * @param mode - New PiP configuration settings
   * @throws Error if webcam mode update fails or config is invalid
   */
  async updateWebcamMode(mode: import('../types').PiPConfig): Promise<void> {
    if (!mode) {
      throw new Error('PiP config is required and cannot be null or undefined');
    }

    try {
      console.log('[VIDEO] Updating webcam mode:', mode);
      await invoke('update_webcam_mode', { pipConfig: mode });
      console.log('[VIDEO] Webcam mode updated successfully');
    } catch (error) {
      console.error('[VIDEO] Failed to update webcam mode:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to update webcam mode: ${errorMessage}`);
    }
  }

  /**
   * Start recording with specific video configuration
   * Note: Advanced features (window-specific, webcam, PiP) will be implemented in future stages
   */
  async startRecordingWithConfig(session: Session): Promise<void> {
    console.log('🎬 [VIDEO SERVICE] Starting recording with config:', session.videoConfig);

    await this.ensureVideoDir();

    const appDataDir = await path.appDataDir();
    const videoFileName = `session-${session.id}-${Date.now()}.mp4`;
    const outputPath = await path.join(appDataDir, 'videos', videoFileName);

    this.activeSessionId = session.id;
    this.isRecording = true;

    try {
      if (!session.videoConfig) {
        throw new Error('Video config is required for advanced recording');
      }

      // Use start_video_recording_advanced to pass full VideoRecordingConfig
      await invoke('start_video_recording_advanced', {
        sessionId: session.id,
        outputPath,
        config: session.videoConfig,
      });

      console.log('✅ [VIDEO SERVICE] Recording started successfully');
    } catch (error) {
      this.isRecording = false;
      this.activeSessionId = null;
      console.error('❌ [VIDEO SERVICE] Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Map quality preset to VideoQuality dimensions
   */
  private mapQualityToVideoQuality(quality: string): { width: number; height: number; fps: number } {
    const presets: Record<string, { width: number; height: number; fps: number }> = {
      low: { width: 854, height: 480, fps: 10 },
      medium: { width: 1280, height: 720, fps: 15 },
      high: { width: 1920, height: 1080, fps: 30 },
      ultra: { width: 2560, height: 1440, fps: 60 },
    };
    return presets[quality] || presets.medium;
  }
}

// Export singleton instance
export const videoRecordingService = new VideoRecordingService();
