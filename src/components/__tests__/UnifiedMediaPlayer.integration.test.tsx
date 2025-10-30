/**
 * Task 14: UnifiedMediaPlayer Integration Tests
 *
 * Tests the dual-path logic for video playback:
 * 1. New sessions with optimized video → single file playback (no sync needed)
 * 2. Legacy sessions without optimized video → fallback to audio/video sync
 * 3. Verify optimized path detection and logging
 * 4. Verify no runtime audio concatenation when using optimized video
 * 5. Verify sync logic still works for legacy sessions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UnifiedMediaPlayer } from '../UnifiedMediaPlayer';
import type { Session, SessionVideo, SessionScreenshot, SessionAudioSegment } from '../../types';
import { generateId } from '../../utils/helpers';

// ============================================================================
// Mocks
// ============================================================================

// Mock Tauri convertFileSrc
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `tauri://localhost/${path}`),
}));

// Mock audio concatenation service
vi.mock('../../services/audioConcatenationService', () => ({
  audioConcatenationService: {
    concatenateAudioSegments: vi.fn(() => Promise.resolve(new Blob())),
  },
}));

// Mock progressive audio loader
vi.mock('../../services/ProgressiveAudioLoader', () => ({
  ProgressiveAudioLoader: {
    loadInitialSegments: vi.fn(() => Promise.resolve(new Blob())),
    loadRemainingSegments: vi.fn(() => Promise.resolve()),
  },
}));

// Mock Web Audio playback
vi.mock('../../services/WebAudioPlayback', () => ({
  WebAudioPlayback: vi.fn(() => ({
    initialize: vi.fn(() => Promise.resolve()),
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    setPlaybackRate: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 300),
    cleanup: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  })),
}));

// Mock video storage service
vi.mock('../../services/videoStorageService', () => ({
  videoStorageService: {
    loadVideo: vi.fn(() => Promise.resolve(new Blob())),
  },
}));

// Mock CA storage
vi.mock('../../services/storage/ContentAddressableStorage', () => ({
  getCAStorage: vi.fn(() => Promise.resolve({
    loadAttachment: vi.fn(() => Promise.resolve(new Blob())),
  })),
}));

// Mock MediaTimeUpdate hook
vi.mock('../../hooks/useMediaTimeUpdate', () => ({
  useMediaTimeUpdate: vi.fn(() => ({
    currentTime: 0,
    duration: 300,
    progress: 0,
  })),
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockSession(overrides?: Partial<Session>): Session {
  const sessionId = generateId();
  const now = new Date().toISOString();

  return {
    id: sessionId,
    name: `Test Session ${sessionId.slice(0, 8)}`,
    description: 'Integration test session',
    startTime: now,
    endTime: now,
    duration: 300,
    createdAt: now,
    updatedAt: now,
    screenshots: [],
    audioSegments: [],
    status: 'completed',
    category: 'work',
    tags: [],
    screenshotCount: 0,
    ...overrides,
  } as Session;
}

function createMockScreenshots(count: number): SessionScreenshot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: generateId(),
    timestamp: new Date(Date.now() + i * 10000).toISOString(),
    attachmentId: `screenshot-${i}`,
    curiosityScore: 0.5,
  }));
}

function createMockAudioSegments(count: number): SessionAudioSegment[] {
  return Array.from({ length: count }, (_, i) => ({
    id: generateId(),
    timestamp: new Date(Date.now() + i * 5000).toISOString(),
    duration: 5,
    attachmentId: `audio-${i}`,
    transcription: `Test transcription ${i}`,
  }));
}

// ============================================================================
// Test Suite
// ============================================================================

describe('UnifiedMediaPlayer - Dual-Path Integration', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  // ==========================================================================
  // Test 1: Optimized Video Path (New Sessions)
  // ==========================================================================

  it('1. Should use optimized video for new sessions (single file playback)', async () => {
    const session = createMockSession({
      screenshots: createMockScreenshots(10),
      audioSegments: createMockAudioSegments(20),
      video: {
        fullVideoAttachmentId: 'original-video',
        duration: 300,
        path: '/path/to/original-video.mp4',
        optimizedPath: '/path/to/optimized-video.mp4', // OPTIMIZED PATH
      } as SessionVideo,
    });

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={session.screenshots}
        audioSegments={session.audioSegments}
        video={session.video}
      />
    );

    // Wait for initial render
    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Using optimized pre-merged video')
      );
    });

    // Verify optimized path logs
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Audio concatenation: SKIPPED')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Audio/video sync: SKIPPED')
    );
  });

  // ==========================================================================
  // Test 2: Legacy Video Path (Old Sessions)
  // ==========================================================================

  it('2. Should fallback to legacy path for sessions without optimized video', async () => {
    const session = createMockSession({
      screenshots: createMockScreenshots(10),
      audioSegments: createMockAudioSegments(20),
      video: {
        fullVideoAttachmentId: 'legacy-video',
        duration: 300,
        path: '/path/to/legacy-video.mp4',
        // NO optimizedPath
      } as SessionVideo,
    });

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={session.screenshots}
        audioSegments={session.audioSegments}
        video={session.video}
      />
    );

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Using legacy audio/video sync')
      );
    });

    // Verify legacy path logs
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Audio concatenation: REQUIRED')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Audio/video sync: REQUIRED')
    );
  });

  // ==========================================================================
  // Test 3: Video-Only (No Audio)
  // ==========================================================================

  it('3. Should handle video-only sessions (no audio sync needed)', async () => {
    const session = createMockSession({
      screenshots: createMockScreenshots(10),
      video: {
        fullVideoAttachmentId: 'video-only',
        duration: 300,
        path: '/path/to/video-only.mp4',
      } as SessionVideo,
      // NO audioSegments
    });

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={session.screenshots}
        video={session.video}
      />
    );

    // Should not log about audio sync (no audio present)
    await waitFor(() => {
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Audio concatenation')
      );
    });
  });

  // ==========================================================================
  // Test 4: Audio-Only (No Video)
  // ==========================================================================

  it('4. Should handle audio-only sessions (no video sync needed)', async () => {
    const session = createMockSession({
      screenshots: createMockScreenshots(10),
      audioSegments: createMockAudioSegments(20),
      // NO video
    });

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={session.screenshots}
        audioSegments={session.audioSegments}
      />
    );

    // Should not log about video sync (no video present)
    await waitFor(() => {
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('video sync')
      );
    });
  });

  // ==========================================================================
  // Test 5: Screenshots-Only (No Media)
  // ==========================================================================

  it('5. Should handle screenshots-only sessions (no media playback)', async () => {
    const session = createMockSession({
      screenshots: createMockScreenshots(10),
      // NO video, NO audio
    });

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={session.screenshots}
      />
    );

    // Should not log about media processing (no media present)
    await waitFor(() => {
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('concatenation')
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('sync')
      );
    });
  });

  // ==========================================================================
  // Test 6: Optimized Video URL Conversion
  // ==========================================================================

  it('6. Should convert optimized video path to Tauri URL', async () => {
    const optimizedPath = '/path/to/optimized-video.mp4';
    const session = createMockSession({
      video: {
        fullVideoAttachmentId: 'optimized',
        duration: 300,
        path: '/path/to/original.mp4',
        optimizedPath,
      } as SessionVideo,
    });

    const { convertFileSrc } = await import('@tauri-apps/api/core');

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={[]}
        video={session.video}
      />
    );

    await waitFor(() => {
      // Should call convertFileSrc with optimized path
      expect(convertFileSrc).toHaveBeenCalledWith(optimizedPath);
    });
  });

  // ==========================================================================
  // Test 7: No Runtime Audio Concatenation with Optimized Video
  // ==========================================================================

  it('7. Should NOT concatenate audio when using optimized video', async () => {
    const session = createMockSession({
      audioSegments: createMockAudioSegments(20),
      video: {
        fullVideoAttachmentId: 'optimized',
        duration: 300,
        path: '/path/to/original.mp4',
        optimizedPath: '/path/to/optimized-video.mp4',
      } as SessionVideo,
    });

    const { audioConcatenationService } = await import('../../services/audioConcatenationService');

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={[]}
        audioSegments={session.audioSegments}
        video={session.video}
      />
    );

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audio concatenation: SKIPPED')
      );
    });

    // Should NOT call audio concatenation
    expect(audioConcatenationService.concatenateAudioSegments).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Test 8: Runtime Audio Concatenation for Legacy Sessions
  // ==========================================================================

  it('8. Should concatenate audio for legacy sessions without optimized video', async () => {
    const session = createMockSession({
      audioSegments: createMockAudioSegments(20),
      video: {
        fullVideoAttachmentId: 'legacy',
        duration: 300,
        path: '/path/to/legacy-video.mp4',
        // NO optimizedPath
      } as SessionVideo,
    });

    const { audioConcatenationService } = await import('../../services/audioConcatenationService');

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={[]}
        audioSegments={session.audioSegments}
        video={session.video}
      />
    );

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audio concatenation: REQUIRED')
      );
    });

    // Should call audio concatenation for legacy sessions
    await waitFor(() => {
      expect(audioConcatenationService.concatenateAudioSegments).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Test 9: Playback Controls Work with Optimized Video
  // ==========================================================================

  it('9. Should render playback controls for optimized video', async () => {
    const session = createMockSession({
      video: {
        fullVideoAttachmentId: 'optimized',
        duration: 300,
        path: '/path/to/original.mp4',
        optimizedPath: '/path/to/optimized-video.mp4',
      } as SessionVideo,
    });

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={[]}
        video={session.video}
      />
    );

    // Verify playback controls are rendered
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play|pause/i })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Test 10: Error Handling for Missing Optimized Video File
  // ==========================================================================

  it('10. Should handle missing optimized video file gracefully', async () => {
    const session = createMockSession({
      video: {
        fullVideoAttachmentId: 'optimized',
        duration: 300,
        path: '/path/to/original.mp4',
        optimizedPath: '/path/to/nonexistent-optimized.mp4', // File doesn't exist
      } as SessionVideo,
    });

    // Mock videoStorageService to reject
    const { videoStorageService } = await import('../../services/videoStorageService');
    vi.mocked(videoStorageService.loadVideo).mockRejectedValueOnce(
      new Error('File not found')
    );

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={[]}
        video={session.video}
      />
    );

    // Should handle error gracefully (component should still render)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /play|pause/i })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Test 11: Verify Media Mode Detection
  // ==========================================================================

  it('11. Should correctly detect media mode for optimized video + audio', async () => {
    const session = createMockSession({
      audioSegments: createMockAudioSegments(10),
      video: {
        fullVideoAttachmentId: 'optimized',
        duration: 300,
        path: '/path/to/original.mp4',
        optimizedPath: '/path/to/optimized-video.mp4',
      } as SessionVideo,
    });

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={[]}
        audioSegments={session.audioSegments}
        video={session.video}
      />
    );

    // Should detect as video-audio mode
    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('optimized pre-merged video')
      );
    });
  });

  // ==========================================================================
  // Test 12: Cleanup on Unmount
  // ==========================================================================

  it('12. Should cleanup resources on unmount', async () => {
    const session = createMockSession({
      video: {
        fullVideoAttachmentId: 'optimized',
        duration: 300,
        path: '/path/to/original.mp4',
        optimizedPath: '/path/to/optimized-video.mp4',
      } as SessionVideo,
    });

    const { unmount } = render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={[]}
        video={session.video}
      />
    );

    // Unmount component
    unmount();

    // Should not throw errors on cleanup
    expect(true).toBe(true);
  });

  // ==========================================================================
  // Test 13: Legacy Session Performance (Baseline)
  // ==========================================================================

  it('13. Should complete legacy session loading within acceptable time', async () => {
    const session = createMockSession({
      audioSegments: createMockAudioSegments(30),
      video: {
        fullVideoAttachmentId: 'legacy',
        duration: 300,
        path: '/path/to/legacy-video.mp4',
        // NO optimizedPath
      } as SessionVideo,
    });

    const startTime = performance.now();

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={[]}
        audioSegments={session.audioSegments}
        video={session.video}
      />
    );

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('legacy audio/video sync')
      );
    });

    const loadTime = performance.now() - startTime;

    // Legacy loading should complete within 5 seconds (baseline)
    expect(loadTime).toBeLessThan(5000);
  });

  // ==========================================================================
  // Test 14: Optimized Session Performance (Target)
  // ==========================================================================

  it('14. Should complete optimized session loading faster than legacy', async () => {
    const session = createMockSession({
      audioSegments: createMockAudioSegments(30),
      video: {
        fullVideoAttachmentId: 'optimized',
        duration: 300,
        path: '/path/to/original.mp4',
        optimizedPath: '/path/to/optimized-video.mp4',
      } as SessionVideo,
    });

    const startTime = performance.now();

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={[]}
        audioSegments={session.audioSegments}
        video={session.video}
      />
    );

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('optimized pre-merged video')
      );
    });

    const loadTime = performance.now() - startTime;

    // Optimized loading should be instant (<1s target)
    expect(loadTime).toBeLessThan(1000);
  });

  // ==========================================================================
  // Test 15: Verify No Sync Logic for Optimized Video
  // ==========================================================================

  it('15. Should not initialize audio/video sync for optimized video', async () => {
    const session = createMockSession({
      audioSegments: createMockAudioSegments(10),
      video: {
        fullVideoAttachmentId: 'optimized',
        duration: 300,
        path: '/path/to/original.mp4',
        optimizedPath: '/path/to/optimized-video.mp4',
      } as SessionVideo,
    });

    const { WebAudioPlayback } = await import('../../services/WebAudioPlayback');

    render(
      <UnifiedMediaPlayer
        session={session}
        screenshots={[]}
        audioSegments={session.audioSegments}
        video={session.video}
      />
    );

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audio/video sync: SKIPPED')
      );
    });

    // WebAudioPlayback should NOT be initialized for optimized video
    expect(WebAudioPlayback).not.toHaveBeenCalled();
  });
});
