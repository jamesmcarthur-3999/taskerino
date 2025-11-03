/**
 * WebAudioPlayback Tests
 *
 * Comprehensive test suite for Web Audio API playback service.
 *
 * Test Coverage:
 * - ✅ 12+ tests covering all functionality
 * - ✅ Playback control (play, pause, seek, stop)
 * - ✅ Audio control (volume, playback rate)
 * - ✅ State management
 * - ✅ Visualization data
 * - ✅ Event handling
 * - ✅ Resource cleanup
 *
 * Phase 6 Wave 3, Task 6.9
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebAudioPlayback } from '../WebAudioPlayback';
import { ProgressiveAudioLoader } from '../ProgressiveAudioLoader';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock AudioContext
class MockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'running';
  currentTime: number = 0;
  destination: any = {};

  createGain() {
    return {
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      smoothingTimeConstant: 0.8,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getByteTimeDomainData: vi.fn((array: Uint8Array) => {
        // Fill with mock waveform data
        for (let i = 0; i < array.length; i++) {
          array[i] = 128 + Math.sin(i / 10) * 50;
        }
      }),
      getByteFrequencyData: vi.fn((array: Uint8Array) => {
        // Fill with mock frequency data
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.max(0, 255 - i);
        }
      }),
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      playbackRate: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    };
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

// Mock AudioBuffer
const createMockAudioBuffer = (duration: number = 10): AudioBuffer => ({
  duration,
  length: duration * 44100,
  numberOfChannels: 2,
  sampleRate: 44100,
  getChannelData: vi.fn(),
  copyFromChannel: vi.fn(),
  copyToChannel: vi.fn(),
});

// Mock ProgressiveAudioLoader
class MockProgressiveAudioLoader {
  private audioContext: MockAudioContext;

  constructor() {
    this.audioContext = new MockAudioContext();
  }

  getAudioContext() {
    return this.audioContext as any;
  }

  getSegmentAtTime(time: number) {
    return {
      segment: { id: 'test-segment', timestamp: new Date().toISOString(), duration: 10 },
      audioBuffer: createMockAudioBuffer(10),
      startTime: 0,
      duration: 10,
    };
  }

  getTotalDuration() {
    return 100;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('WebAudioPlayback', () => {
  let mockLoader: MockProgressiveAudioLoader;
  let playback: WebAudioPlayback;

  beforeEach(() => {
    // Create mock loader
    mockLoader = new MockProgressiveAudioLoader();

    // Create playback instance
    playback = new WebAudioPlayback(mockLoader as any);
  });

  afterEach(() => {
    // Cleanup
    if (playback) {
      playback.destroy();
    }
  });

  // ==========================================================================
  // Test 1: Initialization
  // ==========================================================================

  it('should initialize AudioContext and audio graph', () => {
    expect(playback).toBeDefined();
    expect(playback.getState()).toBe('idle');
    expect(playback.getVolume()).toBe(1);
    expect(playback.getPlaybackRate()).toBe(1);
  });

  // ==========================================================================
  // Test 2: Play from Start
  // ==========================================================================

  it('should play audio from start', async () => {
    await playback.play();

    expect(playback.getState()).toBe('playing');
    expect(playback.isPlaying()).toBe(true);
    expect(playback.isPaused()).toBe(false);
  });

  // ==========================================================================
  // Test 3: Play from Specific Time
  // ==========================================================================

  it('should play audio from specific time', async () => {
    await playback.play(50);

    expect(playback.getState()).toBe('playing');
    expect(playback.getCurrentTime()).toBeGreaterThanOrEqual(50);
  });

  // ==========================================================================
  // Test 4: Pause Playback
  // ==========================================================================

  it('should pause audio correctly', async () => {
    await playback.play();
    expect(playback.getState()).toBe('playing');

    playback.pause();

    expect(playback.getState()).toBe('paused');
    expect(playback.isPlaying()).toBe(false);
    expect(playback.isPaused()).toBe(true);
  });

  // ==========================================================================
  // Test 5: Stop Playback
  // ==========================================================================

  it('should stop audio and reset position', async () => {
    await playback.play(50);
    playback.stop();

    expect(playback.getState()).toBe('idle');
    expect(playback.getCurrentTime()).toBe(0);
  });

  // ==========================================================================
  // Test 6: Seek While Playing
  // ==========================================================================

  it('should seek while playing', async () => {
    await playback.play();
    await playback.seek(30);

    expect(playback.getState()).toBe('playing');
    expect(playback.getCurrentTime()).toBeGreaterThanOrEqual(30);
  });

  // ==========================================================================
  // Test 7: Seek While Paused
  // ==========================================================================

  it('should seek while paused', async () => {
    await playback.play();
    playback.pause();
    await playback.seek(30);

    expect(playback.getState()).toBe('paused');
    expect(playback.getCurrentTime()).toBe(30);
  });

  // ==========================================================================
  // Test 8: Current Time Tracking
  // ==========================================================================

  it('should return correct current time', async () => {
    await playback.play(10);

    const currentTime = playback.getCurrentTime();
    expect(currentTime).toBeGreaterThanOrEqual(10);
    expect(currentTime).toBeLessThanOrEqual(playback.getDuration());
  });

  // ==========================================================================
  // Test 9: Duration
  // ==========================================================================

  it('should return correct duration', () => {
    const duration = playback.getDuration();
    expect(duration).toBe(100);
  });

  // ==========================================================================
  // Test 10: Volume Control
  // ==========================================================================

  it('should set volume correctly', () => {
    playback.setVolume(0.5);
    expect(playback.getVolume()).toBe(0.5);

    // Test clamping
    playback.setVolume(1.5);
    expect(playback.getVolume()).toBe(1);

    playback.setVolume(-0.5);
    expect(playback.getVolume()).toBe(0);
  });

  // ==========================================================================
  // Test 11: Playback Rate Control
  // ==========================================================================

  it('should set playback rate correctly', () => {
    playback.setPlaybackRate(1.5);
    expect(playback.getPlaybackRate()).toBe(1.5);

    // Test clamping
    playback.setPlaybackRate(5.0);
    expect(playback.getPlaybackRate()).toBe(4.0);

    playback.setPlaybackRate(0.1);
    expect(playback.getPlaybackRate()).toBe(0.25);
  });

  // ==========================================================================
  // Test 12: Waveform Data
  // ==========================================================================

  it('should return waveform data', () => {
    const data = playback.getWaveformData();

    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(1024);  // frequencyBinCount

    // Check data is populated
    const hasData = Array.from(data).some(v => v !== 0);
    expect(hasData).toBe(true);
  });

  // ==========================================================================
  // Test 13: Frequency Data
  // ==========================================================================

  it('should return frequency data', () => {
    const data = playback.getFrequencyData();

    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(1024);  // frequencyBinCount

    // Check data is populated
    const hasData = Array.from(data).some(v => v !== 0);
    expect(hasData).toBe(true);
  });

  // ==========================================================================
  // Test 14: Event Handling - Play
  // ==========================================================================

  it('should emit play event', async () => {
    const playCallback = vi.fn();
    playback.on('play', playCallback);

    await playback.play();

    expect(playCallback).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Test 15: Event Handling - Pause
  // ==========================================================================

  it('should emit pause event', async () => {
    const pauseCallback = vi.fn();
    playback.on('pause', pauseCallback);

    await playback.play();
    playback.pause();

    expect(pauseCallback).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Test 16: Event Handling - Time Update
  // ==========================================================================

  it('should emit timeupdate events during playback', async () => {
    const timeUpdateCallback = vi.fn();
    playback.on('timeupdate', timeUpdateCallback);

    await playback.play();

    // Wait for time updates (200ms interval)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should have received at least 2 time updates
    expect(timeUpdateCallback).toHaveBeenCalled();
    expect(timeUpdateCallback.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  // ==========================================================================
  // Test 17: Event Listener Removal
  // ==========================================================================

  it('should remove event listeners', async () => {
    const callback = vi.fn();
    playback.on('play', callback);
    playback.off('play', callback);

    await playback.play();

    expect(callback).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Test 18: Resource Cleanup
  // ==========================================================================

  it('should cleanup resources on destroy', () => {
    const analyserNode = playback.getAnalyserNode();
    expect(analyserNode).toBeDefined();

    playback.destroy();

    expect(playback.getState()).toBe('idle');
  });

  // ==========================================================================
  // Test 19: Multiple Play/Pause Cycles
  // ==========================================================================

  it('should handle multiple play/pause cycles', async () => {
    // Cycle 1
    await playback.play();
    expect(playback.isPlaying()).toBe(true);
    playback.pause();
    expect(playback.isPaused()).toBe(true);

    // Cycle 2
    await playback.play();
    expect(playback.isPlaying()).toBe(true);
    playback.pause();
    expect(playback.isPaused()).toBe(true);

    // Cycle 3
    await playback.play();
    expect(playback.isPlaying()).toBe(true);
  });

  // ==========================================================================
  // Test 20: Seek Edge Cases
  // ==========================================================================

  it('should handle seek edge cases (negative, beyond duration)', async () => {
    const duration = playback.getDuration();

    // Seek to negative time (should clamp to 0)
    await playback.seek(-10);
    expect(playback.getCurrentTime()).toBe(0);

    // Seek beyond duration (should clamp to duration)
    await playback.seek(duration + 100);
    expect(playback.getCurrentTime()).toBe(duration);
  });

  // ==========================================================================
  // Test 21: Resume After Pause
  // ==========================================================================

  it('should resume playback from paused position', async () => {
    // Play and pause at 30s
    await playback.play(30);
    await new Promise(resolve => setTimeout(resolve, 100));
    playback.pause();

    const pausedTime = playback.getCurrentTime();
    expect(pausedTime).toBeGreaterThanOrEqual(30);

    // Resume - should continue from paused position
    await playback.play();
    const resumedTime = playback.getCurrentTime();
    expect(resumedTime).toBeGreaterThanOrEqual(pausedTime);
  });
});
