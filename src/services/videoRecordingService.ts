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

// New multi-source recording types (Task 2.10)
export interface RecordingSource {
  type: 'display' | 'window' | 'webcam';
  id: string;
  name?: string; // For UI display
}

export interface RecordingConfig {
  sessionId: string;
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  compositor: 'passthrough' | 'grid' | 'sidebyside';
  sources: RecordingSource[];
}

export interface RecordingStats {
  framesProcessed: number;
  framesDropped: number;
  isRecording: boolean;
}

export class VideoRecordingService {
  private activeSessionId: string | null = null;
  private isRecording: boolean = false;
  private recordingStartTime: number | null = null; // Timestamp when recording started
  private usedMultiSourceCommand: boolean = false; // Track which start command was used
  private currentOutputPath: string | null = null; // Store output path for multi-source recordings

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

    // Check screen recording permission before starting
    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      console.warn('⚠️ [VIDEO SERVICE] Screen recording permission not granted, requesting...');
      try {
        const granted = await invoke<boolean>('request_screen_recording_permission');
        if (!granted) {
          throw new Error(
            'Screen recording permission denied. Please grant screen recording access in System Settings > Privacy & Security > Screen Recording, then restart the app.'
          );
        }
        console.log('✅ [VIDEO SERVICE] Screen recording permission granted - please restart the app for it to take effect');
        throw new Error(
          'Screen recording permission was just granted. Please restart the app for it to take effect.'
        );
      } catch (error) {
        console.error('❌ [VIDEO SERVICE] Screen recording permission request failed:', error);
        throw error;
      }
    }

    // If using webcam, check camera permission
    const usesWebcam =
      !!session.videoConfig?.webcamDeviceId ||
      (session.videoConfig?.multiSourceConfig?.sources?.some(s => s.type === 'webcam') ?? false);

    console.log(`🎬 [VIDEO SERVICE] Webcam detection: usesWebcam=${usesWebcam}, webcamDeviceId=${session.videoConfig?.webcamDeviceId}, multiSourceConfig=${!!session.videoConfig?.multiSourceConfig}`);

    if (usesWebcam) {
      try {
        const hasCameraPermission = await invoke<boolean>('check_camera_permission');
        console.log(`🎬 [VIDEO SERVICE] Camera permission check result: ${hasCameraPermission}`);
        if (!hasCameraPermission) {
          console.warn('⚠️ [VIDEO SERVICE] Camera permission not granted, requesting...');
          const granted = await invoke<boolean>('request_camera_permission');
          if (!granted) {
            throw new Error(
              'Camera permission denied. Please grant camera access in System Settings > Privacy & Security > Camera, then restart the app.'
            );
          }
          console.log('✅ [VIDEO SERVICE] Camera permission granted - please restart the app for it to take effect');
          throw new Error(
            'Camera permission was just granted. Please restart the app for it to take effect.'
          );
        }
      } catch (error) {
        console.error('❌ [VIDEO SERVICE] Camera permission check failed:', error);
        throw error; // Re-throw to preserve the error message
      }
    }

    if (session.videoConfig) {
      console.log('🎬 [VIDEO SERVICE] Using videoConfig:', JSON.stringify(session.videoConfig, null, 2));
      return this.startRecordingWithConfig(session);
    }

    console.log('🎬 [VIDEO SERVICE] Starting video recording (simple mode, no videoConfig)...');

    await this.ensureVideoDir();

    // Enumerate displays and validate at least one exists
    console.log('🖥️ [VIDEO SERVICE] Enumerating available displays...');
    const displays = await this.enumerateDisplays();

    if (displays.length === 0) {
      throw new Error('No displays available for recording. Please ensure at least one display is connected.');
    }

    // Use first available display (not hardcoded 0)
    const displayId = parseInt(displays[0].displayId, 10);
    console.log(`🖥️ [VIDEO SERVICE] Using display ID ${displayId}: "${displays[0].displayName}" (${displays[0].width}x${displays[0].height})`);

    const appDataDir = await path.appDataDir();
    const videoFileName = `session-${session.id}-${Date.now()}.mp4`;
    const outputPath = await path.join(appDataDir, 'videos', videoFileName);

    console.log(`🎬 [VIDEO SERVICE] Output path: ${outputPath}`);

    const defaultQuality: VideoQuality = {
      width: 1280,
      height: 720,
      fps: 15
    };

    const qualityToUse = quality || defaultQuality;
    console.log(`🎬 [VIDEO SERVICE] Invoking start_video_recording with: sessionId=${session.id}, displayId=${displayId}, width=${qualityToUse.width}, height=${qualityToUse.height}, fps=${qualityToUse.fps}`);

    try {
      await invoke('start_video_recording', {
        sessionId: session.id,       // Tauri v2: camelCase in TS → snake_case in Rust
        outputPath: outputPath,       // Tauri v2: camelCase in TS → snake_case in Rust
        quality: qualityToUse,
        displayId: displayId          // ✅ Pass validated display ID
      });

      // ✅ FIX: Set state AFTER backend confirms success (prevents state desync)
      this.activeSessionId = session.id;
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.currentOutputPath = outputPath; // Store output path for stop command
      this.usedMultiSourceCommand = false; // Using simple recording mode

      console.log('✅ [VIDEO SERVICE] Video recording started successfully');
    } catch (error) {
      // State was never set, so no need to reset
      // (defensive cleanup in case of race conditions)
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

    const sessionId = this.activeSessionId;
    let outputPath: string | null = null;

    try {
      // ✅ SAFETY CHECK: Verify session exists in backend before stopping
      const backendHasSession = await invoke<boolean>('is_recording', { sessionId });
      if (!backendHasSession) {
        console.warn(`⚠️ [VIDEO SERVICE] Backend has no recording for session ${sessionId} - state desync`);
        console.warn(`⚠️ [VIDEO SERVICE] Resetting frontend state without attempting stop`);

        // Reset state and return null gracefully
        this.isRecording = false;
        this.activeSessionId = null;
        this.recordingStartTime = null;
        this.usedMultiSourceCommand = false;
        this.currentOutputPath = null;

        return null;
      }

      // Use the appropriate stop command based on which start command was used
      if (this.usedMultiSourceCommand) {
        // Multi-source command returns void, use stored output path
        await invoke('stop_multi_source_recording', {
          appHandle: undefined,  // Tauri will inject this
          sessionId: sessionId
        });
        outputPath = this.currentOutputPath; // Use stored path
        console.log(`✅ [VIDEO SERVICE] Multi-source recording stopped, saved to: ${outputPath}`);
      } else {
        // Simple command returns the output file path
        outputPath = await invoke<string>('stop_video_recording', {
          sessionId: sessionId
        });

        // Fallback: if backend returns null, use stored path (defensive)
        if (!outputPath && this.currentOutputPath) {
          console.warn('⚠️ [VIDEO SERVICE] Backend returned null path, using stored path as fallback');
          outputPath = this.currentOutputPath;
        }

        console.log(`✅ [VIDEO SERVICE] Video recording stopped, saved to: ${outputPath}`);
      }

      // Validate outputPath before proceeding
      if (!outputPath) {
        console.warn('⚠️ [VIDEO SERVICE] Backend returned null/empty output path - recording may not have been started properly');
        console.warn('⚠️ [VIDEO SERVICE] Resetting state and returning null gracefully');

        // Reset state
        this.isRecording = false;
        this.activeSessionId = null;
        this.recordingStartTime = null;
        this.usedMultiSourceCommand = false;
        this.currentOutputPath = null;

        // Return null instead of throwing - let the caller handle it
        return null;
      }

      // Create Attachment for the video file
      console.log('🎥 [VIDEO SERVICE] Creating video attachment...');
      const attachment = await videoStorageService.createVideoAttachment(outputPath, sessionId);
      console.log(`✅ [VIDEO SERVICE] Video attachment created: ${attachment.id}`);

      // Create SessionVideo entity
      const videoId = generateId();
      const sessionVideo: SessionVideo = {
        id: videoId,
        sessionId: sessionId,
        path: attachment.path, // Store video file path for playback and chaptering
        duration: attachment.duration || 0,
        chunkingStatus: 'pending'
      };

      // Reset state only after successful attachment creation
      this.isRecording = false;
      this.activeSessionId = null;
      this.recordingStartTime = null;
      this.usedMultiSourceCommand = false;
      this.currentOutputPath = null;

      console.log(`✅ [VIDEO SERVICE] SessionVideo created:`, sessionVideo);
      return sessionVideo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if this is a "session not found" error (state desync)
      if (errorMessage.includes('Session not found')) {
        console.warn(`⚠️ [VIDEO SERVICE] Session not found in backend - state desync detected for session: ${sessionId}`);
        console.warn(`⚠️ [VIDEO SERVICE] This likely means the recording was never started or already stopped`);

        // Reset state and return null gracefully (don't throw)
        this.isRecording = false;
        this.activeSessionId = null;
        this.recordingStartTime = null;
        this.usedMultiSourceCommand = false;
        this.currentOutputPath = null;

        return null;
      }

      console.error('❌ [VIDEO SERVICE] Failed to stop video recording:', error);

      // CRITICAL: Delete orphaned output file if attachment creation failed
      if (outputPath) {
        try {
          console.log('🧹 [VIDEO SERVICE] Deleting orphaned output file after attachment failure:', outputPath);
          const { remove } = await import('@tauri-apps/plugin-fs');
          await remove(outputPath);
          console.log('✅ [VIDEO SERVICE] Orphaned output file deleted');
        } catch (deleteError) {
          console.error('❌ [VIDEO SERVICE] Failed to delete orphaned output file:', deleteError);
          // Log but don't throw - original error is more important
        }
      }

      // Reset state in ALL error paths
      this.isRecording = false;
      this.activeSessionId = null;
      this.recordingStartTime = null;
      this.usedMultiSourceCommand = false;
      this.currentOutputPath = null;

      throw error;
    }
  }

  /**
   * Switch recording source during active recording (hot-swap)
   * Supports switching displays, windows, and webcams on the fly
   */
  async switchSource(
    oldSourceId: string,
    sourceType: 'display' | 'window' | 'webcam',
    newSourceId: string
  ): Promise<void> {
    if (!this.isRecording || !this.activeSessionId) {
      console.warn('⚠️ [VIDEO SERVICE] Cannot switch source: no active recording');
      throw new Error('No active recording to switch source');
    }

    console.log(`🔄 [VIDEO SERVICE] Switching ${sourceType} source: ${oldSourceId} → ${newSourceId}`);

    try {
      await invoke('switch_recording_source', {
        sessionId: this.activeSessionId,
        oldSourceId,
        sourceType,
        newSourceId,
        appHandle: undefined, // Tauri will inject this
      });

      console.log(`✅ [VIDEO SERVICE] Source switched successfully`);
    } catch (error) {
      console.error(`❌ [VIDEO SERVICE] Failed to switch source:`, error);
      throw error;
    }
  }

  /**
   * Check if currently recording (read-only query, does not modify state)
   *
   * IMPORTANT: This method queries backend state but does NOT overwrite local state.
   * This prevents race conditions during state transitions (e.g., backend starting async
   * while local state is already set).
   */
  async isCurrentlyRecording(): Promise<boolean> {
    try {
      const recording = await invoke<boolean>('is_recording');

      // ✅ FIX: Compare but don't overwrite (prevents race condition)
      if (recording !== this.isRecording) {
        console.warn(`⚠️ [VIDEO SERVICE] State desync detected: local=${this.isRecording}, backend=${recording}`);
        console.warn(`⚠️ [VIDEO SERVICE] This may indicate a state transition in progress or a stuck state`);
      }

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
   *
   * IMPORTANT: This method only updates local state as a recovery mechanism
   * when local state is null but backend has an active session. It does NOT
   * silently overwrite valid local state with backend state.
   */
  async getCurrentRecordingSession(): Promise<string | null> {
    try {
      const sessionId = await invoke<string | null>('get_current_recording_session');

      // ✅ FIX: Only update state if it's currently null (recovery path)
      if (sessionId && !this.activeSessionId) {
        console.warn(`⚠️ [VIDEO SERVICE] Recovering session state from backend: ${sessionId}`);
        console.warn(`⚠️ [VIDEO SERVICE] Local state was null but backend has active session`);
        this.activeSessionId = sessionId;
        this.isRecording = true;
      } else if (sessionId && sessionId !== this.activeSessionId) {
        console.error(`❌ [VIDEO SERVICE] State mismatch detected!`);
        console.error(`   Local sessionId: ${this.activeSessionId}`);
        console.error(`   Backend sessionId: ${sessionId}`);
        console.error(`   This indicates a serious state desync issue`);
      } else if (!sessionId && this.activeSessionId) {
        console.warn(`⚠️ [VIDEO SERVICE] Local state has session ${this.activeSessionId} but backend has none`);
        console.warn(`⚠️ [VIDEO SERVICE] This may indicate the backend session was cleaned up`);
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

    try {
      if (!session.videoConfig) {
        throw new Error('Video config is required for advanced recording');
      }

      // DETECT MULTI-SOURCE MODE (Wave 1.3)
      if (session.videoConfig.sourceType === 'multi-source' && session.videoConfig.multiSourceConfig) {
        // Use new multi-source recording API
        const multiConfig = session.videoConfig.multiSourceConfig;

        const recordingConfig: RecordingConfig = {
          sessionId: session.id,
          outputPath,
          width: session.videoConfig.resolution?.width || 1920,
          height: session.videoConfig.resolution?.height || 1080,
          fps: session.videoConfig.fps || 30,
          compositor: multiConfig.compositor || 'passthrough',
          sources: multiConfig.sources
        };

        console.log('🎬 [VIDEO SERVICE] Using multi-source recording:', recordingConfig);
        await this.startMultiSourceRecording(recordingConfig);

        // Set flags only after successful start
        this.activeSessionId = session.id;
        this.isRecording = true;
        this.recordingStartTime = Date.now();
        return;
      }

      // FIXED: Use start_multi_source_recording when displayIds are specified
      // Extract all source types from videoConfig
      const width = session.videoConfig?.resolution?.width || 1280;
      const height = session.videoConfig?.resolution?.height || 720;
      const fps = session.videoConfig?.fps || 15;
      const displayIds = session.videoConfig?.displayIds;
      const windowIds = session.videoConfig?.windowIds;
      const webcamDeviceId = session.videoConfig?.webcamDeviceId;

      // Convert string IDs to numbers (Rust expects Vec<u32>)
      const numericDisplayIds = displayIds?.map(id => parseInt(id, 10));
      const numericWindowIds = windowIds?.map(id => parseInt(id, 10));

      console.log(`🎬 [VIDEO SERVICE] Starting recording with sources:`, {
        width,
        height,
        fps,
        displayIds: numericDisplayIds,
        windowIds: numericWindowIds,
        webcamDeviceId,
      });

      // Route to appropriate recording command based on source type
      // Track which command type we used for later (but don't set state yet)
      let usedMultiSource = false;

      if (numericDisplayIds && numericDisplayIds.length > 0) {
        // DISPLAY RECORDING PATH (can include webcam)
        console.log(`🎬 [VIDEO SERVICE] Using start_multi_source_recording for ${numericDisplayIds.length} display(s)${webcamDeviceId ? ' + webcam' : ''}`);
        await invoke('start_multi_source_recording', {
          appHandle: undefined,  // Tauri will inject this
          sessionId: session.id,
          outputPath: outputPath,
          width,
          height,
          fps,
          displayIds: numericDisplayIds,
          windowIds: null,
          webcamDeviceIds: webcamDeviceId ? [webcamDeviceId] : null,
          compositorType: null,  // Default: passthrough (no composition)
        });
        usedMultiSource = true;

      } else if (numericWindowIds && numericWindowIds.length > 0) {
        // WINDOW RECORDING PATH (can include webcam)
        console.log(`🎬 [VIDEO SERVICE] Using start_multi_source_recording for ${numericWindowIds.length} window(s)${webcamDeviceId ? ' + webcam' : ''}`);
        await invoke('start_multi_source_recording', {
          appHandle: undefined,  // Tauri will inject this
          sessionId: session.id,
          outputPath: outputPath,
          width,
          height,
          fps,
          displayIds: null,
          windowIds: numericWindowIds,
          webcamDeviceIds: webcamDeviceId ? [webcamDeviceId] : null,
          compositorType: null,  // Default: passthrough (no composition)
        });
        usedMultiSource = true;

      } else if (webcamDeviceId) {
        // WEBCAM-ONLY RECORDING PATH
        console.log(`🎬 [VIDEO SERVICE] Using start_multi_source_recording for webcam-only: ${webcamDeviceId}`);
        await invoke('start_multi_source_recording', {
          appHandle: undefined,  // Tauri will inject this
          sessionId: session.id,
          outputPath: outputPath,
          width,
          height,
          fps,
          displayIds: null,
          windowIds: null,
          webcamDeviceIds: [webcamDeviceId],
          compositorType: null,  // Default: passthrough (no composition)
        });
        usedMultiSource = true;

      } else {
        // NO SOURCE SELECTED - ERROR
        throw new Error('No video source selected. Please select at least one display, window, or webcam.');
      }

      // ✅ FIX: Set ALL state flags AFTER backend confirms success (prevents state desync)
      this.activeSessionId = session.id;
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.usedMultiSourceCommand = usedMultiSource; // Set based on which path was taken
      this.currentOutputPath = outputPath; // Store for stop command

      console.log('✅ [VIDEO SERVICE] Recording started successfully');
    } catch (error) {
      // State was never set since we only set it after success
      // (defensive cleanup in case of any race conditions)
      this.isRecording = false;
      this.activeSessionId = null;
      this.recordingStartTime = null;
      this.usedMultiSourceCommand = false;
      this.currentOutputPath = null;
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

  /**
   * Start multi-source recording (Task 2.10 - Phase 2)
   *
   * Supports recording from multiple displays/windows simultaneously with configurable composition.
   *
   * @param config - Recording configuration with sources and compositor
   * @returns Promise that resolves when recording starts
   * @throws Error if no sources specified or recording fails
   */
  async startMultiSourceRecording(config: RecordingConfig): Promise<void> {
    console.log('🎬 [VIDEO SERVICE] Starting multi-source recording', config);

    // Validate configuration
    if (!config.sources || config.sources.length === 0) {
      throw new Error('At least one source must be specified');
    }

    // Ensure video directory exists
    await this.ensureVideoDir();

    // Separate sources by type
    const displayIds = config.sources
      .filter(s => s.type === 'display')
      .map(s => parseInt(s.id, 10));

    const windowIds = config.sources
      .filter(s => s.type === 'window')
      .map(s => parseInt(s.id, 10));

    try {
      await invoke('start_multi_source_recording', {
        sessionId: config.sessionId,
        outputPath: config.outputPath,
        width: config.width,
        height: config.height,
        fps: config.fps,
        displayIds: displayIds.length > 0 ? displayIds : null,
        windowIds: windowIds.length > 0 ? windowIds : null,
        compositorType: config.compositor,
      });

      // ✅ FIX: Store output path and flag for stop command
      this.usedMultiSourceCommand = true;
      this.currentOutputPath = config.outputPath;

      // ✅ FIX: Set core state flags (CRITICAL - required for stop, status checks)
      this.activeSessionId = config.sessionId;
      this.isRecording = true;
      this.recordingStartTime = Date.now();

      console.log('✅ [VIDEO SERVICE] Multi-source recording started successfully');
    } catch (error) {
      // Reset flags defensively (in case caller set them prematurely)
      this.isRecording = false;
      this.activeSessionId = null;
      this.recordingStartTime = null;
      this.usedMultiSourceCommand = false;
      this.currentOutputPath = null;
      console.error('❌ [VIDEO SERVICE] Failed to start multi-source recording:', error);
      throw error;
    }
  }

  /**
   * Get recording statistics for the active session
   *
   * Returns real-time stats including frame count and drop rate.
   *
   * @returns Recording stats or null if no active recording
   * @throws Error if stats retrieval fails
   */
  async getStats(): Promise<RecordingStats | null> {
    // Check both activeSessionId and isRecording flag to avoid spurious errors
    if (!this.activeSessionId || !this.isRecording) {
      return null;
    }

    try {
      const stats = await invoke<RecordingStats>('get_recording_stats', {
        sessionId: this.activeSessionId,
      });

      return {
        framesProcessed: stats.framesProcessed,
        framesDropped: stats.framesDropped,
        isRecording: stats.isRecording,
      };
    } catch (error) {
      // Suppress "Session not found" errors for the first 3 seconds after recording starts
      // The Rust backend needs time to fully initialize the session
      const GRACE_PERIOD_MS = 3000;
      const timeSinceStart = this.recordingStartTime ? Date.now() - this.recordingStartTime : Infinity;
      const isGracePeriod = timeSinceStart < GRACE_PERIOD_MS;

      // Only log errors if we expect recording to be active AND we're past the grace period
      if (this.isRecording && this.activeSessionId && !isGracePeriod) {
        console.error('❌ [VIDEO SERVICE] Failed to get recording stats:', error);
      }

      // Return null instead of throwing - stats are non-critical
      return null;
    }
  }
}

// Export singleton instance
export const videoRecordingService = new VideoRecordingService();
