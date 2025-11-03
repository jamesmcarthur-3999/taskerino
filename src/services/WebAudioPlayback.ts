/**
 * WebAudioPlayback - Web Audio API-based audio playback service
 *
 * Provides precise, low-latency audio playback with real-time analysis capabilities.
 * Integrates with ProgressiveAudioLoader for buffer-based playback.
 *
 * Features:
 * - Sub-50ms sync precision (3x better than <audio> element)
 * - Real-time waveform visualization via AnalyserNode
 * - Volume control via GainNode
 * - Precise seek operations
 * - Proper resource cleanup
 *
 * Performance Targets:
 * - Audio sync precision: <50ms (vs ±150ms with <audio>)
 * - Seek latency: <100ms
 * - Playback latency: <50ms
 * - Memory: Proper cleanup on destroy
 *
 * Integration:
 * - Uses ProgressiveAudioLoader for buffer management
 * - Phase 6 Wave 3, Task 6.9
 *
 * @see docs/sessions-rewrite/PHASE_6_VALIDATED_PLAN.md - Task 6.9
 */

import { ProgressiveAudioLoader } from './ProgressiveAudioLoader';

// ============================================================================
// Types
// ============================================================================

/**
 * Playback state
 */
export type PlaybackState = 'idle' | 'playing' | 'paused' | 'ended';

/**
 * Audio playback events
 */
export interface PlaybackEvents {
  play: () => void;
  pause: () => void;
  ended: () => void;
  timeupdate: (currentTime: number) => void;
  error: (error: Error) => void;
}

// ============================================================================
// WebAudioPlayback Class
// ============================================================================

export class WebAudioPlayback {
  private audioContext: AudioContext;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private analyser: AnalyserNode;
  private loader: ProgressiveAudioLoader;

  private state: PlaybackState = 'idle';
  private startTime: number = 0;       // AudioContext time when playback started
  private pauseTime: number = 0;       // Playback position when paused (seconds)
  private playbackRate: number = 1.0;  // Playback speed multiplier

  // Event listeners
  private eventListeners: Map<keyof PlaybackEvents, Set<Function>> = new Map();

  // Time update interval
  private timeUpdateInterval: NodeJS.Timeout | null = null;

  /**
   * Create WebAudioPlayback instance
   *
   * @param loader - ProgressiveAudioLoader instance for buffer management
   */
  constructor(loader: ProgressiveAudioLoader) {
    // Use loader's AudioContext for compatibility
    this.audioContext = loader.getAudioContext();
    this.loader = loader;

    // Create audio graph: source → gain → analyser → destination
    this.gainNode = this.audioContext.createGain();
    this.analyser = this.audioContext.createAnalyser();

    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    // Configure analyser for waveform visualization
    // fftSize: 2048 = 1024 frequency bins (reasonable detail)
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;  // Smooth waveform transitions

    console.log('🎵 [WEB AUDIO PLAYBACK] Initialized with AnalyserNode (fftSize: 2048)');
  }

  // ==========================================================================
  // Playback Control
  // ==========================================================================

  /**
   * Start playback from a specific time
   *
   * @param fromTime - Start position in seconds (default: current position)
   * @throws Error if AudioContext fails to resume
   */
  async play(fromTime?: number): Promise<void> {
    const targetTime = fromTime !== undefined ? fromTime : this.pauseTime;

    if (this.state === 'playing') {
      console.warn('[WEB AUDIO PLAYBACK] Already playing');
      return;
    }

    // Resume AudioContext if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('[WEB AUDIO PLAYBACK] AudioContext resumed');
      } catch (error) {
        console.error('[WEB AUDIO PLAYBACK] Failed to resume AudioContext:', error);
        this._emit('error', error as Error);
        throw error;
      }
    }

    // Get audio buffer from loader
    let audioBuffer: AudioBuffer;
    let actualStartTime = targetTime;
    try {
      // Get the segment at target time
      let segment = this.loader.getSegmentAtTime(targetTime);

      // If no segment at target time, find the first available segment
      if (!segment) {
        console.warn(`[WEB AUDIO PLAYBACK] No segment at ${targetTime}s, looking for first available segment...`);

        segment = this.loader.getFirstAvailableSegment();

        if (segment) {
          actualStartTime = segment.startTime;
          console.log(`[WEB AUDIO PLAYBACK] Using first available segment at ${actualStartTime}s`);
        } else {
          const progress = this.loader.getLoadingProgress();
          throw new Error(`No audio segments available (requested: ${targetTime}s, loaded: ${progress.loaded}/${progress.total})`);
        }
      }

      audioBuffer = segment.audioBuffer;
    } catch (error) {
      console.error('[WEB AUDIO PLAYBACK] Failed to get audio buffer:', error);
      this._emit('error', error as Error);
      throw error;
    }

    // Create source node
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = audioBuffer;
    this.sourceNode.playbackRate.value = this.playbackRate;

    // Connect to audio graph
    this.sourceNode.connect(this.gainNode);

    // Handle playback end
    this.sourceNode.onended = () => {
      if (this.state === 'playing') {
        console.log('[WEB AUDIO PLAYBACK] Segment ended, checking for next segment...');

        // Get current time to find next segment
        const currentTime = this.getCurrentTime();
        const nextSegment = this.loader.getSegmentAtTime(currentTime + 0.1); // Look slightly ahead

        if (nextSegment) {
          // Seamlessly transition to next segment
          console.log(`[WEB AUDIO PLAYBACK] Transitioning to next segment at ${nextSegment.startTime.toFixed(2)}s`);

          // Clean up current source node
          if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
          }

          // Temporarily set to paused to allow play() to work
          this.state = 'paused';

          // Play next segment
          this.play(nextSegment.startTime).catch(error => {
            console.error('[WEB AUDIO PLAYBACK] Failed to transition to next segment:', error);
            this.state = 'ended';
            this._stopTimeUpdates();
            this._emit('ended');
          });
        } else {
          // No more segments, playback truly ended
          console.log('[WEB AUDIO PLAYBACK] Playback ended (no more segments)');
          this.state = 'ended';
          this._stopTimeUpdates();
          this._emit('ended');
        }
      }
    };

    // Start playback
    // Calculate offset within the segment
    // offset = how many seconds into THIS segment's buffer we should start
    const offset = targetTime - actualStartTime;

    // Safety check: clamp offset to valid range
    const clampedOffset = Math.max(0, Math.min(offset, audioBuffer.duration));

    this.sourceNode.start(0, clampedOffset);
    this.startTime = this.audioContext.currentTime;
    this.pauseTime = targetTime;  // Track the actual requested start time for time calculations
    this.state = 'playing';

    console.log(`[WEB AUDIO PLAYBACK] Playing from ${targetTime.toFixed(2)}s (segment starts at ${actualStartTime.toFixed(2)}s, offset: ${clampedOffset.toFixed(2)}s within segment)`);

    this._emit('play');
    this._startTimeUpdates();
  }

  /**
   * Pause playback
   * Saves current position for resume
   */
  pause(): void {
    if (this.state !== 'playing') {
      console.warn('[WEB AUDIO PLAYBACK] Not playing');
      return;
    }

    // Save current position
    this.pauseTime = this.getCurrentTime();

    // Stop source node
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {
        // Already stopped, ignore
      }
      this.sourceNode = null;
    }

    this.state = 'paused';
    this._stopTimeUpdates();

    console.log(`[WEB AUDIO PLAYBACK] Paused at ${this.pauseTime.toFixed(2)}s`);
    this._emit('pause');
  }

  /**
   * Stop playback and reset position
   */
  stop(): void {
    this.pause();
    this.pauseTime = 0;
    this.state = 'idle';
  }

  /**
   * Seek to a specific time
   *
   * @param time - Target position in seconds
   */
  async seek(time: number): Promise<void> {
    const duration = this.getDuration();
    const clampedTime = Math.max(0, Math.min(duration, time));
    const wasPlaying = this.state === 'playing';

    console.log(`[WEB AUDIO PLAYBACK] Seeking to ${clampedTime.toFixed(2)}s (was playing: ${wasPlaying})`);

    if (wasPlaying) {
      this.pause();
    }

    this.pauseTime = clampedTime;

    if (wasPlaying) {
      await this.play(clampedTime);
    }
  }

  // ==========================================================================
  // Playback State Queries
  // ==========================================================================

  /**
   * Get current playback time
   *
   * @returns Current time in seconds
   */
  getCurrentTime(): number {
    if (this.state === 'playing') {
      // Calculate elapsed time from AudioContext time
      const audioContextElapsed = this.audioContext.currentTime - this.startTime;
      // Add the start offset to get absolute position
      const offset = this.pauseTime;
      const currentTime = offset + (audioContextElapsed * this.playbackRate);
      return Math.min(currentTime, this.getDuration());
    } else {
      return this.pauseTime;
    }
  }

  /**
   * Get total duration
   *
   * @returns Total audio duration in seconds
   */
  getDuration(): number {
    return this.loader.getTotalDuration();
  }

  /**
   * Get current playback state
   *
   * @returns Playback state
   */
  getState(): PlaybackState {
    return this.state;
  }

  /**
   * Check if currently playing
   *
   * @returns True if playing
   */
  isPlaying(): boolean {
    return this.state === 'playing';
  }

  /**
   * Check if paused
   *
   * @returns True if paused
   */
  isPaused(): boolean {
    return this.state === 'paused';
  }

  // ==========================================================================
  // Audio Control
  // ==========================================================================

  /**
   * Set volume (0-1)
   *
   * @param volume - Volume level (0 = silent, 1 = full volume)
   */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.gainNode.gain.value = clampedVolume;
    console.log(`[WEB AUDIO PLAYBACK] Volume set to ${(clampedVolume * 100).toFixed(0)}%`);
  }

  /**
   * Get current volume
   *
   * @returns Volume level (0-1)
   */
  getVolume(): number {
    return this.gainNode.gain.value;
  }

  /**
   * Set playback rate (speed)
   *
   * @param rate - Playback rate (0.5 = half speed, 2.0 = double speed)
   */
  setPlaybackRate(rate: number): void {
    const clampedRate = Math.max(0.25, Math.min(4.0, rate));
    this.playbackRate = clampedRate;

    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = clampedRate;
    }

    console.log(`[WEB AUDIO PLAYBACK] Playback rate set to ${clampedRate}x`);
  }

  /**
   * Get current playback rate
   *
   * @returns Playback rate
   */
  getPlaybackRate(): number {
    return this.playbackRate;
  }

  // ==========================================================================
  // Visualization Data
  // ==========================================================================

  /**
   * Get waveform data for visualization
   * Time-domain data (waveform shape)
   *
   * @returns Uint8Array of waveform data (0-255)
   */
  getWaveformData(): Uint8Array {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  /**
   * Get frequency data for visualization
   * Frequency-domain data (spectrum)
   *
   * @returns Uint8Array of frequency data (0-255)
   */
  getFrequencyData(): Uint8Array {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Get analyser node (for advanced visualization)
   *
   * @returns AnalyserNode
   */
  getAnalyserNode(): AnalyserNode {
    return this.analyser;
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Add event listener
   *
   * @param event - Event name
   * @param callback - Event callback
   */
  on<K extends keyof PlaybackEvents>(event: K, callback: PlaybackEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   *
   * @param event - Event name
   * @param callback - Event callback
   */
  off<K extends keyof PlaybackEvents>(event: K, callback: PlaybackEvents[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit event to all listeners
   *
   * @param event - Event name
   * @param args - Event arguments
   */
  private _emit<K extends keyof PlaybackEvents>(event: K, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          (listener as Function)(...args);
        } catch (error) {
          console.error(`[WEB AUDIO PLAYBACK] Error in ${event} listener:`, error);
        }
      });
    }
  }

  // ==========================================================================
  // Time Updates
  // ==========================================================================

  /**
   * Start time update interval
   * Emits timeupdate events every 200ms
   */
  private _startTimeUpdates(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }

    this.timeUpdateInterval = setInterval(() => {
      if (this.state === 'playing') {
        const currentTime = this.getCurrentTime();
        this._emit('timeupdate', currentTime);
      }
    }, 200);  // 200ms = 5 updates per second (debounced)
  }

  /**
   * Stop time update interval
   */
  private _stopTimeUpdates(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Cleanup resources
   * CRITICAL: Must be called on component unmount to prevent memory leaks
   */
  destroy(): void {
    console.log('🗑️ [WEB AUDIO PLAYBACK] Destroying playback service...');

    // Stop playback
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {
        // Already stopped, ignore
      }
      this.sourceNode = null;
    }

    // Stop time updates
    this._stopTimeUpdates();

    // Disconnect audio graph
    this.gainNode.disconnect();
    this.analyser.disconnect();

    // Clear event listeners
    this.eventListeners.clear();

    // Reset state
    this.state = 'idle';
    this.startTime = 0;
    this.pauseTime = 0;

    console.log('✅ [WEB AUDIO PLAYBACK] Playback service destroyed');
  }
}
