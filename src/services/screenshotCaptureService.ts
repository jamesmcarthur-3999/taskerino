import { invoke } from '@tauri-apps/api/core';
import type { Session, SessionScreenshot, Attachment } from '../types';
import { generateId } from '../utils/helpers';
import { createThumbnail, getBase64Size } from '../utils/imageCompression';
import { attachmentStorage } from './attachmentStorage';
import { adaptiveScreenshotScheduler } from './adaptiveScreenshotScheduler';

/**
 * ScreenshotCaptureService
 *
 * Manages automatic screenshot capture during active sessions.
 * - Captures screens at configured intervals
 * - Stores screenshots as attachments (uses Tauri file system APIs)
 * - Triggers AI analysis via SessionsAgentService
 */
export class ScreenshotCaptureService {
  private captureInterval: NodeJS.Timeout | null = null;
  private activeSessionId: string | null = null;
  private intervalMinutes: number = 2;
  private isAdaptiveMode: boolean = false; // Track if using adaptive scheduler
  private permissionChecked: boolean = false;

  /**
   * Check if screen recording permission is granted (macOS)
   */
  async checkScreenRecordingPermission(): Promise<boolean> {
    try {
      const hasPermission = await invoke<boolean>('check_screen_recording_permission');
      return hasPermission;
    } catch (error) {
      console.error('Failed to check screen recording permission:', error);
      return false;
    }
  }

  /**
   * Request screen recording permission (macOS)
   * This will show the system permission dialog if not already granted
   */
  async requestScreenRecordingPermission(): Promise<boolean> {
    try {
      console.log('🔐 Requesting screen recording permission...');
      const granted = await invoke<boolean>('request_screen_recording_permission');

      if (granted) {
        console.log('✅ Screen recording permission granted');
        this.permissionChecked = true;
      } else {
        console.warn('⚠️ Screen recording permission denied. Please grant permission in System Settings > Privacy & Security > Screen Recording');
      }

      return granted;
    } catch (error) {
      console.error('❌ Failed to request screen recording permission:', error);
      return false;
    }
  }

  /**
   * Start automatic screenshot capture for a session
   */
  async startCapture(session: Session, onScreenshotCaptured: (screenshot: SessionScreenshot) => void): Promise<void> {
    console.log(`🔵 [CAPTURE SERVICE] startCapture() called for session: ${session.id}`);

    // Check if using adaptive mode
    const isAdaptiveMode = session.screenshotInterval === -1;
    const effectiveInterval = isAdaptiveMode ? 2 : (session.screenshotInterval || 2);

    console.log(`📸 [CAPTURE SERVICE] Mode: ${isAdaptiveMode ? 'ADAPTIVE' : 'FIXED'} (interval: ${effectiveInterval}m)`);

    // Start menu bar countdown
    try {
      const lastScreenshotTime = session.lastScreenshotTime || new Date().toISOString();
      await invoke('start_menubar_countdown', {
        intervalMinutes: effectiveInterval,
        lastScreenshotTime,
        sessionId: session.id,
      });
      console.log('📊 [CAPTURE SERVICE] Menu bar countdown started');
    } catch (error) {
      console.error('❌ [CAPTURE SERVICE] Failed to start menu bar countdown:', error);
    }

    // Check and request screen recording permission first
    if (!this.permissionChecked) {
      const hasPermission = await this.checkScreenRecordingPermission();

      if (!hasPermission) {
        console.log('🔐 [CAPTURE SERVICE] Screen recording permission not granted. Requesting permission...');
        const granted = await this.requestScreenRecordingPermission();

        if (!granted) {
          console.error('❌ [CAPTURE SERVICE] Screen recording permission denied. Screenshots will not work properly.');
          console.warn('⚠️ Please grant permission in System Settings > Privacy & Security > Screen Recording, then restart the app.');
          // Continue anyway - the user might grant permission later
        }
      } else {
        console.log('✅ [CAPTURE SERVICE] Screen recording permission already granted');
        this.permissionChecked = true;
      }
    }

    // Stop any existing capture (but don't stop menubar countdown - we'll restart it)
    this.stopCapture(true);

    this.activeSessionId = session.id;
    this.intervalMinutes = effectiveInterval;
    this.isAdaptiveMode = isAdaptiveMode; // Track mode for menubar sync

    // Route to appropriate scheduler
    if (isAdaptiveMode) {
      console.log('🧠 [CAPTURE SERVICE] Using ADAPTIVE scheduler with AI-driven timing');

      // Start adaptive scheduling
      await adaptiveScreenshotScheduler.startScheduling(
        session.id,
        () => {
          // Capture and notify - the adaptive scheduler triggers this callback
          // After capture, the AI analysis will feed curiosity back to the scheduler
          this.captureAndProcess(onScreenshotCaptured);
        }
      );

      console.log('✅ [CAPTURE SERVICE] Adaptive scheduler started');
    } else {
      console.log(`📸 [CAPTURE SERVICE] Using FIXED interval: every ${this.intervalMinutes} minutes for session "${session.name}"`);
      console.log(`🔵 [CAPTURE SERVICE] Active session ID set to: ${this.activeSessionId}`);

      // Delay first screenshot by 3 seconds to give user time to navigate away
      console.log(`⏱️ [CAPTURE SERVICE] Setting 3-second timeout for first screenshot...`);
      setTimeout(() => {
        if (this.activeSessionId === session.id) {
          console.log('📸 [CAPTURE SERVICE] Capturing first screenshot (delayed 3s)...');
          this.captureAndProcess(onScreenshotCaptured);
        } else {
          console.log('⚠️ [CAPTURE SERVICE] Session ID changed, skipping first screenshot');
        }
      }, 3000);

      // Set up interval for subsequent captures
      console.log(`⏱️ [CAPTURE SERVICE] Setting up interval timer...`);
      this.captureInterval = setInterval(() => {
        console.log('⏰ [CAPTURE SERVICE] Interval fired, capturing screenshot...');
        this.captureAndProcess(onScreenshotCaptured);
      }, this.intervalMinutes * 60 * 1000);

      console.log(`✅ [CAPTURE SERVICE] Fixed interval capture started. Interval ID: ${this.captureInterval}`);
    }
  }

  /**
   * Stop automatic screenshot capture
   */
  stopCapture(skipMenubarUpdate: boolean = false): void {
    // Stop fixed interval if active
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
      console.log('📸 Stopped fixed interval screenshot capture');
    }

    // Stop adaptive scheduler if active
    if (adaptiveScreenshotScheduler.isActive()) {
      adaptiveScreenshotScheduler.stopScheduling();
      console.log('🧠 Stopped adaptive screenshot scheduler');
    }

    this.activeSessionId = null;
    this.isAdaptiveMode = false;

    // Stop menu bar countdown (unless we're restarting)
    if (!skipMenubarUpdate) {
      try {
        invoke('stop_menubar_countdown');
        console.log('📊 Menu bar countdown stopped');
      } catch (error) {
        console.error('❌ Failed to stop menu bar countdown:', error);
      }
    }
  }

  /**
   * Pause automatic screenshot capture (keeps session ID)
   */
  pauseCapture(): void {
    // Pause fixed interval if active
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
      console.log('⏸️  Paused fixed interval screenshot capture');
    }

    // Pause adaptive scheduler if active
    if (adaptiveScreenshotScheduler.isActive()) {
      adaptiveScreenshotScheduler.pause();
      console.log('⏸️  Paused adaptive screenshot scheduler');
    }

    // Stop menu bar countdown while paused
    try {
      invoke('stop_menubar_countdown');
      console.log('📊 Menu bar countdown paused');
    } catch (error) {
      console.error('❌ Failed to pause menu bar countdown:', error);
    }
  }

  /**
   * Resume automatic screenshot capture
   */
  resumeCapture(session: Session, onScreenshotCaptured: (screenshot: SessionScreenshot) => void): void {
    const isAdaptiveMode = session.screenshotInterval === -1;

    if (this.activeSessionId === session.id) {
      console.log('▶️  Resuming automatic screenshot capture');

      // Restart menu bar countdown
      try {
        const lastScreenshotTime = session.lastScreenshotTime || new Date().toISOString();
        const effectiveInterval = isAdaptiveMode ? 2 : (session.screenshotInterval || 2);
        invoke('start_menubar_countdown', {
          intervalMinutes: effectiveInterval,
          lastScreenshotTime,
          sessionId: session.id,
        });
        console.log('📊 Menu bar countdown resumed');
      } catch (error) {
        console.error('❌ Failed to resume menu bar countdown:', error);
      }

      if (isAdaptiveMode) {
        // Resume adaptive scheduler
        adaptiveScreenshotScheduler.resume();
        console.log('▶️  Resumed adaptive scheduler');
      } else if (!this.captureInterval) {
        // Resume fixed interval
        // Capture immediately on resume
        this.captureAndProcess(onScreenshotCaptured);

        // Restart interval
        this.captureInterval = setInterval(() => {
          this.captureAndProcess(onScreenshotCaptured);
        }, this.intervalMinutes * 60 * 1000);
        console.log('▶️  Resumed fixed interval capture');
      }
    }
  }

  /**
   * Manually capture a screenshot
   */
  async captureManual(sessionId: string): Promise<SessionScreenshot> {
    console.log('📸 Manually capturing composite screenshot of all screens...');

    try {
      // Call Tauri command - returns already-compressed JPEG from Rust
      const compressedBase64 = await invoke<string>('capture_all_screens_composite');
      const size = getBase64Size(compressedBase64);
      console.log(`📊 Compressed screenshot from Rust: ${Math.round(size / 1024)}KB`);

      // Create thumbnail only (no further compression needed)
      const thumbnailBase64 = await createThumbnail(compressedBase64);

      const timestamp = new Date().toISOString();
      const attachmentId = generateId();

      // Create attachment for the screenshot (already compressed JPEG from Rust)
      const attachment: Attachment = {
        id: attachmentId,
        type: 'screenshot',
        name: `Screenshot ${new Date().toLocaleTimeString()}.jpg`,
        mimeType: 'image/jpeg',
        size: getBase64Size(compressedBase64),
        createdAt: timestamp,
        base64: compressedBase64,
        thumbnail: thumbnailBase64,
      };

      // Save attachment to file system (not localStorage!)
      await attachmentStorage.saveAttachment(attachment);

      // Create screenshot record (WITHOUT base64 data)
      const screenshot: SessionScreenshot = {
        id: generateId(),
        sessionId,
        timestamp,
        attachmentId,
        analysisStatus: 'pending',
        flagged: false,
      };

      console.log('✅ Composite screenshot captured and saved (Rust-compressed, no JS blocking)');

      return screenshot;
    } catch (error) {
      console.error('❌ Failed to capture screenshot:', error);
      throw new Error(`Screenshot capture failed: ${error}`);
    }
  }

  /**
   * Get information about available screens
   */
  async getScreenInfo(): Promise<any[]> {
    try {
      return await invoke<any[]>('get_screen_info');
    } catch (error) {
      console.error('❌ Failed to get screen info:', error);
      return [];
    }
  }

  /**
   * Private method to capture and process a screenshot
   */
  private async captureAndProcess(onScreenshotCaptured: (screenshot: SessionScreenshot) => void): Promise<void> {
    if (!this.activeSessionId) return;

    try {
      console.log('📸 Auto-capturing composite screenshot of all screens...');

      // Call Tauri command - returns already-compressed JPEG from Rust
      const compressedBase64 = await invoke<string>('capture_all_screens_composite');
      const size = getBase64Size(compressedBase64);
      console.log(`📊 Compressed screenshot from Rust: ${Math.round(size / 1024)}KB`);

      // Create thumbnail only (no further compression needed - Rust already did it)
      const thumbnailBase64 = await createThumbnail(compressedBase64);

      const timestamp = new Date().toISOString();
      const screenshotId = generateId();
      const attachmentId = generateId();

      // Create attachment for the screenshot (already compressed JPEG from Rust)
      const attachment: Attachment = {
        id: attachmentId,
        type: 'screenshot',
        name: `Screenshot ${new Date().toLocaleTimeString()}.jpg`,
        mimeType: 'image/jpeg',
        size: getBase64Size(compressedBase64),
        createdAt: timestamp,
        base64: compressedBase64,
        thumbnail: thumbnailBase64,
      };

      // Save attachment to file system (not localStorage!)
      await attachmentStorage.saveAttachment(attachment);

      // Create screenshot record (WITHOUT base64 data)
      const screenshot: SessionScreenshot = {
        id: screenshotId,
        sessionId: this.activeSessionId,
        timestamp,
        attachmentId,
        analysisStatus: 'pending',
        flagged: false,
      };

      console.log('✅ Composite screenshot captured and saved (Rust-compressed, no JS blocking)');

      // Update menu bar countdown with new timestamp (ONLY for fixed interval mode)
      // In adaptive mode, the scheduler handles menubar updates with dynamic timing
      if (!this.isAdaptiveMode) {
        try {
          await invoke('update_menubar_countdown', {
            intervalMinutes: this.intervalMinutes,
            lastScreenshotTime: timestamp,
            sessionStatus: 'active',
          });
          console.log('📊 [CAPTURE SERVICE] Menubar updated for fixed interval mode');
        } catch (error) {
          console.error('❌ Failed to update menu bar countdown:', error);
        }
      } else {
        console.log('🧠 [CAPTURE SERVICE] Skipping menubar update - adaptive scheduler handles timing');
      }

      // Notify caller (screenshot object has NO base64 data, keeping localStorage small)
      onScreenshotCaptured(screenshot);
    } catch (error) {
      console.error('❌ Auto-capture failed:', error);

      // Don't throw - just log the error and continue with next capture
      // This prevents the interval from stopping due to temporary failures
    }
  }

  /**
   * Update the screenshot interval for the current session
   * Note: This method is called when the interval changes, but the actual restart
   * is handled by the SessionsZone useEffect which calls startCapture() with the new session data.
   * This method only updates the menubar countdown.
   */
  async updateInterval(newIntervalMinutes: number, lastScreenshotTime: string, sessionStatus: string = 'active'): Promise<void> {
    if (!this.activeSessionId) {
      console.warn('⚠️  Cannot update interval - no active session');
      return;
    }

    const isAdaptiveMode = newIntervalMinutes === -1;
    const effectiveInterval = isAdaptiveMode ? 2 : newIntervalMinutes;

    console.log(`🔄 [CAPTURE SERVICE] Interval change detected: ${isAdaptiveMode ? 'ADAPTIVE' : effectiveInterval + 'm'}`);

    // Update menu bar countdown with new interval
    try {
      await invoke('update_menubar_countdown', {
        intervalMinutes: effectiveInterval,
        lastScreenshotTime,
        sessionStatus,
      });
      console.log(`📊 Menu bar countdown interval updated to ${effectiveInterval}m`);
    } catch (error) {
      console.error('❌ Failed to update menu bar countdown interval:', error);
    }

    // Note: We don't restart capture here - the SessionsZone useEffect will handle that
    // by calling startCapture() when it detects the screenshotInterval dependency changed.
    // This prevents race conditions and ensures proper cleanup/restart.
  }

  /**
   * Check if capture is currently active (either fixed interval or adaptive)
   */
  isCapturing(): boolean {
    return this.captureInterval !== null || adaptiveScreenshotScheduler.isActive();
  }

  /**
   * Get the active session ID
   */
  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }
}

// Export singleton instance
export const screenshotCaptureService = new ScreenshotCaptureService();
