/**
 * Adaptive Screenshot Scheduler
 *
 * Intelligently schedules screenshot captures based on:
 * 1. User activity metrics (app switches, mouse clicks, keyboard events)
 * 2. AI curiosity score (from previous screenshot analysis)
 *
 * Algorithm:
 * - Activity Score (0-1): Weighted combination of activity metrics
 *   - App switches: 50% weight (>10 switches in 60s = max)
 *   - Mouse clicks: 30% weight (>50 clicks in 30s = max)
 *   - Window focus: 20% weight (>8 changes in 60s = max)
 *
 * - AI Curiosity Score (0-1): From previous screenshot analysis
 *   - 0.0-0.3: Clear understanding, low priority
 *   - 0.4-0.6: Normal interest
 *   - 0.7-1.0: High uncertainty, errors, or blockers detected
 *
 * - Final Urgency = (activityScore × 0.65) + (aiCuriosityScore × 0.35)
 *
 * - Next Delay (ms) = maxDelay - (urgency × (maxDelay - minDelay))
 *   - Min: 10000ms (10 seconds) - maximum capture rate
 *   - Max: 300000ms (5 minutes) - minimum capture rate (safety net)
 *
 * Cost Optimization:
 * - Deep focus work: ~15-20 screenshots/hour (50% reduction vs fixed 2min)
 * - Mixed activity: ~20-25 screenshots/hour (25% reduction)
 * - High-context work: ~30-36 screenshots/hour (max 6/min at peak activity)
 */

import { invoke } from '@tauri-apps/api/core';
import type { ActivityMetrics, SessionScreenshot } from '../types';

// Configuration
const MIN_DELAY_MS = 10000;       // 10 seconds - maximum capture rate
const MAX_DELAY_MS = 300000;      // 5 minutes - safety net minimum rate
const ACTIVITY_WINDOW_SECONDS = 60; // Look back 60 seconds for activity
const ACTIVITY_WEIGHT = 0.65;     // Activity contributes 65% to urgency
const CURIOSITY_WEIGHT = 0.35;    // AI curiosity contributes 35% to urgency

// Normalization thresholds (events that = max score)
const MAX_APP_SWITCHES = 10;      // >10 switches in 60s = max activity
const MAX_MOUSE_CLICKS = 50;      // >50 clicks in 30s = max activity
const MAX_WINDOW_FOCUS = 8;       // >8 focus changes in 60s = max activity

// Weights within activity score
const APP_SWITCH_WEIGHT = 0.5;    // 50% of activity score
const MOUSE_CLICK_WEIGHT = 0.3;   // 30% of activity score
const WINDOW_FOCUS_WEIGHT = 0.2;  // 20% of activity score

interface SchedulerState {
  isActive: boolean;
  sessionId: string | null;
  timeoutId: NodeJS.Timeout | null;
  monitorIntervalId: NodeJS.Timeout | null; // Continuous activity monitoring interval
  runId: number; // Unique ID for each scheduling run to prevent race conditions
  lastCaptureTime: number | null; // Timestamp (ms) of last capture
  lastMetrics: ActivityMetrics | null; // Previous metrics to detect NEW events
  lastCuriosityScore: number;
  lastActivityScore: number;
  lastUrgency: number;
  lastDelay: number;
  nextCaptureTime: number | null; // Timestamp (ms) when next capture will occur
  captureCount: number;
  onCaptureTriggered: (() => void) | null;
}

/**
 * Adaptive Screenshot Scheduler Service
 */
export class AdaptiveScreenshotScheduler {
  private state: SchedulerState = {
    isActive: false,
    sessionId: null,
    timeoutId: null,
    monitorIntervalId: null,
    runId: 0, // Incremented on each start to detect stale async operations
    lastCaptureTime: null,
    lastMetrics: null,
    lastCuriosityScore: 0.5, // Start with moderate curiosity
    lastActivityScore: 0,
    lastUrgency: 0,
    lastDelay: MAX_DELAY_MS,
    nextCaptureTime: null,
    captureCount: 0,
    onCaptureTriggered: null,
  };

  private debugMode: boolean = true; // Enable debug logging by default for troubleshooting

  /**
   * Enable debug logging
   */
  enableDebug(): void {
    this.debugMode = true;
    console.log('🔍 [ADAPTIVE SCHEDULER] Debug mode enabled');
  }

  /**
   * Disable debug logging
   */
  disableDebug(): void {
    this.debugMode = false;
  }

  /**
   * Start adaptive screenshot scheduling
   */
  async startScheduling(
    sessionId: string,
    onCaptureTriggered: () => void
  ): Promise<void> {
    console.log('🔔 [ADAPTIVE SCHEDULER] startScheduling() called for session:', sessionId);
    console.log('🔔 [ADAPTIVE SCHEDULER] Current state:', {
      isActive: this.state.isActive,
      currentSessionId: this.state.sessionId,
      runId: this.state.runId,
      captureCount: this.state.captureCount
    });

    if (this.state.isActive) {
      console.warn('⚠️  [ADAPTIVE SCHEDULER] Already active, stopping previous session');
      this.stopScheduling();
    }

    // Increment runId to invalidate any in-flight async operations
    this.state.runId++;
    const currentRunId = this.state.runId;
    console.log(`🔔 [ADAPTIVE SCHEDULER] Starting new run with ID: ${currentRunId}`);

    this.state.isActive = true;
    this.state.sessionId = sessionId;
    this.state.onCaptureTriggered = onCaptureTriggered;
    this.state.captureCount = 0;
    this.state.lastCuriosityScore = 0.5; // Reset to moderate

    // Start activity monitoring in Rust
    try {
      await invoke('start_activity_monitoring');
      this.log('✅ Activity monitoring started');
    } catch (error) {
      console.error('❌ [ADAPTIVE SCHEDULER] Failed to start activity monitoring:', error);
    }

    // Check if still the same run after async operation
    if (this.state.runId !== currentRunId) {
      console.warn(`⚠️  [ADAPTIVE SCHEDULER] Run ${currentRunId} aborted - scheduler was restarted`);
      return;
    }

    // Schedule first capture with a short delay (3 seconds)
    this.log('⏱️  Scheduling first capture (3s delay)...');
    const firstCaptureDelay = 3000;
    this.state.nextCaptureTime = Date.now() + firstCaptureDelay;
    this.state.timeoutId = setTimeout(() => {
      this.captureAndScheduleNext(currentRunId);
    }, firstCaptureDelay);

    // Sync menubar with first capture time
    await this.syncMenubarCountdown();

    // Start continuous activity monitoring for smart interrupts
    this.startContinuousMonitoring(currentRunId);
  }

  /**
   * Stop adaptive screenshot scheduling
   */
  stopScheduling(): void {
    this.log('🛑 Stopping adaptive screenshot scheduling');

    if (this.state.timeoutId) {
      clearTimeout(this.state.timeoutId);
      this.state.timeoutId = null;
    }

    if (this.state.monitorIntervalId) {
      clearInterval(this.state.monitorIntervalId);
      this.state.monitorIntervalId = null;
    }

    this.state.isActive = false;
    this.state.sessionId = null;
    this.state.onCaptureTriggered = null;

    // Stop activity monitoring in Rust
    invoke('stop_activity_monitoring').catch((error) => {
      console.error('❌ [ADAPTIVE SCHEDULER] Failed to stop activity monitoring:', error);
    });

    this.log(`📊 Session stats: ${this.state.captureCount} screenshots captured`);
  }

  /**
   * Pause scheduling (keeps state but stops timers)
   */
  pause(): void {
    if (this.state.timeoutId) {
      clearTimeout(this.state.timeoutId);
      this.state.timeoutId = null;
    }
    this.log('⏸️  Paused scheduling');
  }

  /**
   * Resume scheduling (restarts with current state)
   */
  resume(): void {
    if (!this.state.isActive || !this.state.sessionId) {
      console.warn('⚠️  [ADAPTIVE SCHEDULER] Cannot resume - not active');
      return;
    }

    this.log('▶️  Resuming scheduling');
    const currentRunId = this.state.runId;
    this.captureAndScheduleNext(currentRunId);
  }

  /**
   * Update AI curiosity score from last screenshot analysis
   */
  updateCuriosityScore(curiosityScore: number): void {
    // Clamp to 0-1 range
    this.state.lastCuriosityScore = Math.max(0, Math.min(1, curiosityScore));
    this.log(`🤖 AI curiosity updated: ${this.state.lastCuriosityScore.toFixed(1)}`);
  }

  /**
   * Get current scheduler state (for UI/debugging)
   */
  getState() {
    return {
      isActive: this.state.isActive,
      sessionId: this.state.sessionId,
      lastActivityScore: this.state.lastActivityScore,
      lastCuriosityScore: this.state.lastCuriosityScore,
      lastUrgency: this.state.lastUrgency,
      lastDelay: this.state.lastDelay,
      nextCaptureTime: this.state.nextCaptureTime, // Actual timestamp when next capture will occur
      captureCount: this.state.captureCount,
    };
  }

  /**
   * Capture screenshot and schedule next capture
   * This is the core loop of the adaptive scheduler
   * @param runId - The run ID this capture belongs to (prevents race conditions)
   */
  private async captureAndScheduleNext(runId: number): Promise<void> {
    console.log(`📸 [ADAPTIVE SCHEDULER] captureAndScheduleNext() called for run ${runId}`);

    // Check if this run is still valid
    if (this.state.runId !== runId) {
      console.warn(`⚠️  [ADAPTIVE SCHEDULER] Run ${runId} aborted - scheduler was restarted (current: ${this.state.runId})`);
      return;
    }

    if (!this.state.isActive || !this.state.sessionId) {
      console.warn(`⚠️  [ADAPTIVE SCHEDULER] Run ${runId} aborted - scheduler not active`);
      return;
    }

    this.log(`📸 Triggering screenshot capture for run ${runId}...`);

    try {
      // 1. Get activity metrics from Rust BEFORE capture
      const activityScore = await this.calculateActivityScore();

      // Check runId after async operation
      if (this.state.runId !== runId) {
        console.warn(`⚠️  [ADAPTIVE SCHEDULER] Run ${runId} aborted after activity check - scheduler was restarted`);
        return;
      }

      this.state.lastActivityScore = activityScore;

      // 2. Calculate urgency (activity + curiosity)
      const urgency = this.calculateUrgency(activityScore, this.state.lastCuriosityScore);
      this.state.lastUrgency = urgency;

      // 3. Calculate next delay
      const nextDelay = this.calculateDelay(urgency);
      this.state.lastDelay = nextDelay;

      console.log(`📊 [ADAPTIVE SCHEDULER] Run ${runId}: Activity: ${activityScore.toFixed(1)}, Curiosity: ${this.state.lastCuriosityScore.toFixed(1)}, Urgency: ${urgency.toFixed(1)}`);
      console.log(`⏱️  [ADAPTIVE SCHEDULER] Run ${runId}: Next capture in ${(nextDelay / 1000).toFixed(1)}s (${this.formatDuration(nextDelay)})`);

      // 4. Trigger actual screenshot capture via callback
      if (this.state.onCaptureTriggered && this.state.runId === runId) {
        this.state.captureCount++;
        this.state.lastCaptureTime = Date.now(); // Track when we took the screenshot
        console.log(`📸 [ADAPTIVE SCHEDULER] Run ${runId}: Triggering capture #${this.state.captureCount}`);
        // The screenshot will be captured by screenshotCaptureService
        // After AI analysis, curiosity score will be fed back via updateCuriosityScore()
        this.state.onCaptureTriggered();
      }

      // 5. Schedule next capture - CRITICAL: Check runId again before scheduling
      if (this.state.isActive && this.state.runId === runId) {
        this.state.nextCaptureTime = Date.now() + nextDelay;
        this.state.timeoutId = setTimeout(() => {
          this.captureAndScheduleNext(runId);
        }, nextDelay);
        console.log(`⏱️  [ADAPTIVE SCHEDULER] Run ${runId}: Next timeout scheduled`);

        // Sync menubar with new timing
        this.syncMenubarCountdown();
      } else {
        console.warn(`⚠️  [ADAPTIVE SCHEDULER] Run ${runId} NOT scheduling next - run ended or scheduler restarted`);
      }
    } catch (error) {
      console.error(`❌ [ADAPTIVE SCHEDULER] Run ${runId} capture failed:`, error);

      // On error, try again with max delay (5 min) - but only if still same run
      if (this.state.isActive && this.state.runId === runId) {
        this.log('⚠️  Error occurred, retrying in 5 minutes...');
        this.state.nextCaptureTime = Date.now() + MAX_DELAY_MS;
        this.state.timeoutId = setTimeout(() => {
          this.captureAndScheduleNext(runId);
        }, MAX_DELAY_MS);
      }
    }
  }

  /**
   * Calculate activity score from Rust metrics
   * Returns 0-1 score based on weighted activity metrics
   */
  private async calculateActivityScore(): Promise<number> {
    try {
      const metrics = await invoke<ActivityMetrics>('get_activity_metrics', {
        windowSeconds: ACTIVITY_WINDOW_SECONDS,
      });

      // Normalize each metric to 0-1
      const appSwitchScore = Math.min(metrics.appSwitches / MAX_APP_SWITCHES, 1.0);
      const mouseClickScore = Math.min(metrics.mouseClicks / MAX_MOUSE_CLICKS, 1.0);
      const windowFocusScore = Math.min(metrics.windowFocusChanges / MAX_WINDOW_FOCUS, 1.0);

      // Weighted combination
      const activityScore =
        appSwitchScore * APP_SWITCH_WEIGHT +
        mouseClickScore * MOUSE_CLICK_WEIGHT +
        windowFocusScore * WINDOW_FOCUS_WEIGHT;

      this.log(
        `📈 Activity breakdown: apps=${metrics.appSwitches}/${MAX_APP_SWITCHES} (${(appSwitchScore * 100).toFixed(1)}%), ` +
        `clicks=${metrics.mouseClicks}/${MAX_MOUSE_CLICKS} (${(mouseClickScore * 100).toFixed(1)}%), ` +
        `focus=${metrics.windowFocusChanges}/${MAX_WINDOW_FOCUS} (${(windowFocusScore * 100).toFixed(1)}%)`
      );

      return activityScore;
    } catch (error) {
      console.error('❌ [ADAPTIVE SCHEDULER] Failed to get activity metrics:', error);
      // On error, return moderate activity (0.5)
      return 0.5;
    }
  }

  /**
   * Calculate final urgency score
   * Combines activity score and AI curiosity score with weights
   */
  private calculateUrgency(activityScore: number, curiosityScore: number): number {
    const urgency = activityScore * ACTIVITY_WEIGHT + curiosityScore * CURIOSITY_WEIGHT;
    return Math.max(0, Math.min(1, urgency)); // Clamp to 0-1
  }

  /**
   * Calculate next capture delay based on urgency
   * Higher urgency = shorter delay (more frequent captures)
   */
  private calculateDelay(urgency: number): number {
    const delay = MAX_DELAY_MS - urgency * (MAX_DELAY_MS - MIN_DELAY_MS);
    return Math.round(delay);
  }

  /**
   * Start continuous activity monitoring to enable smart interrupts
   * Detects NEW app switches and window changes, responding intelligently:
   * - If ≥10s since last capture: capture immediately
   * - If <10s since last capture: schedule capture for exactly the 10s mark
   */
  private startContinuousMonitoring(runId: number): void {
    // Clear any existing monitor
    if (this.state.monitorIntervalId) {
      clearInterval(this.state.monitorIntervalId);
    }

    console.log('🔍 [ADAPTIVE SCHEDULER] Starting continuous activity monitoring for context-aware interrupts');

    this.state.monitorIntervalId = setInterval(async () => {
      // Only monitor if this run is still active
      if (this.state.runId !== runId || !this.state.isActive) {
        return;
      }

      try {
        // Get current activity metrics
        const currentMetrics = await invoke<ActivityMetrics>('get_activity_metrics', {
          windowSeconds: ACTIVITY_WINDOW_SECONDS,
        });

        // Detect NEW events by comparing with previous metrics
        if (this.state.lastMetrics) {
          const newAppSwitches = currentMetrics.appSwitches > this.state.lastMetrics.appSwitches;
          const newWindowFocus = currentMetrics.windowFocusChanges > this.state.lastMetrics.windowFocusChanges;

          // Significant context change detected
          if (newAppSwitches || newWindowFocus) {
            const eventType = newAppSwitches ? 'app switch' : 'window focus change';
            console.log(`🔄 [ADAPTIVE SCHEDULER] NEW ${eventType} detected!`);

            // Calculate time since last capture
            const timeSinceLastCapture = this.state.lastCaptureTime
              ? Date.now() - this.state.lastCaptureTime
              : Infinity; // No capture yet, so any time is valid

            if (timeSinceLastCapture >= MIN_DELAY_MS) {
              // ✅ Enough time has passed - CAPTURE NOW
              console.log(`⚡ [ADAPTIVE SCHEDULER] ≥10s elapsed (${(timeSinceLastCapture / 1000).toFixed(1)}s) - capturing NOW`);

              // Cancel existing timeout and capture immediately
              if (this.state.timeoutId) {
                clearTimeout(this.state.timeoutId);
                this.state.timeoutId = null;
              }
              this.captureAndScheduleNext(runId);
              // Note: syncMenubarCountdown() will be called after capture schedules next
            } else {
              // ⏱️ Too soon - schedule for exactly the 10s mark
              const timeUntil10s = MIN_DELAY_MS - timeSinceLastCapture;
              console.log(`⏰ [ADAPTIVE SCHEDULER] Only ${(timeSinceLastCapture / 1000).toFixed(1)}s elapsed - scheduling capture in ${(timeUntil10s / 1000).toFixed(1)}s (at 10s mark)`);

              // Cancel existing timeout and reschedule for 10s mark
              if (this.state.timeoutId) {
                clearTimeout(this.state.timeoutId);
                this.state.timeoutId = null;
              }

              this.state.nextCaptureTime = Date.now() + timeUntil10s;
              this.state.timeoutId = setTimeout(() => {
                this.captureAndScheduleNext(runId);
              }, timeUntil10s);

              // Sync menubar with new 10s timing
              this.syncMenubarCountdown();
            }
          }
        }

        // Store current metrics for next comparison
        this.state.lastMetrics = currentMetrics;
      } catch (error) {
        // Silently fail - monitoring is best-effort
        console.error('❌ [ADAPTIVE SCHEDULER] Monitor check failed:', error);
      }
    }, 3000); // Check every 3 seconds
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  /**
   * Debug logging helper
   */
  private log(...args: any[]): void {
    if (this.debugMode) {
      console.log('[ADAPTIVE SCHEDULER]', ...args);
    }
  }

  /**
   * Check if scheduler is currently active
   */
  isActive(): boolean {
    return this.state.isActive;
  }

  /**
   * Sync menubar countdown with adaptive scheduler's actual timing
   * Updates the menubar to show the correct countdown for the next capture
   */
  private async syncMenubarCountdown(): Promise<void> {
    if (!this.state.nextCaptureTime || !this.state.isActive) {
      return;
    }

    try {
      const secondsUntilNext = Math.max(0, (this.state.nextCaptureTime - Date.now()) / 1000);
      const minutesUntilNext = secondsUntilNext / 60;

      // Use "now" as last screenshot time and the calculated minutes as interval
      // This makes the menubar countdown show the actual time until next capture
      await invoke('update_menubar_countdown', {
        intervalMinutes: minutesUntilNext,
        lastScreenshotTime: new Date().toISOString(),
        sessionStatus: 'active',
      });

      this.log(`📊 Menubar synced: ${secondsUntilNext.toFixed(1)}s until next capture`);
    } catch (error) {
      console.error('❌ [ADAPTIVE SCHEDULER] Failed to sync menubar countdown:', error);
    }
  }
}

// Export singleton instance
export const adaptiveScreenshotScheduler = new AdaptiveScreenshotScheduler();
