/**
 * End-to-End Session Flow Test
 *
 * This test verifies the complete session lifecycle from start to finish,
 * integrating all Phase 1 components:
 * - State machine (sessionMachine)
 * - Contexts (SessionList, ActiveSession, Recording)
 * - Storage queue (PersistenceQueue)
 * - Recording services (screenshots, audio, video)
 * - Transaction support
 *
 * Test Flow:
 * 1. Start session (state machine validation → permissions → starting → active)
 * 2. Start recording services (screenshots + audio)
 * 3. Capture data (screenshots, audio segments, metadata updates)
 * 4. Update session metadata (description, tags, etc.)
 * 5. End session (state machine ending → completed)
 * 6. Verify data persisted correctly (storage queue flush)
 * 7. Verify session appears in list (SessionListContext)
 * 8. Verify enrichment can run (if configured)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { SessionListProvider, useSessionList } from '../../context/SessionListContext';
import { ActiveSessionProvider, useActiveSession } from '../../context/ActiveSessionContext';
import { RecordingProvider, useRecording } from '../../context/RecordingContext';
import { getPersistenceQueue, resetPersistenceQueue } from '../../services/storage/PersistenceQueue';
import { getStorage } from '../../services/storage';
import type { Session, SessionScreenshot, SessionAudioSegment } from '../../types';

// ============================================================================
// Mocks
// ============================================================================

// Mock attachment storage using factory function (hoisted)
vi.mock('../../services/attachmentStorage', () => ({
  attachmentStorage: {
    createAttachment: vi.fn((data) =>
      Promise.resolve({
        id: 'attachment-' + Date.now() + '-' + Math.random().toString(36).substring(7),
        ...data,
      })
    ),
    loadAttachment: vi.fn(() => Promise.resolve('base64-data')),
    deleteAttachments: vi.fn(() => Promise.resolve()),
  },
}));

// Create mock storage with proper state management
const createMockStorage = () => {
  const collections = new Map<string, any>();

  return {
    load: vi.fn((key: string) => {
      const record = collections.get(key);
      return Promise.resolve(record || null);
    }),
    save: vi.fn((key: string, data: any) => {
      collections.set(key, data);
      return Promise.resolve();
    }),
    delete: vi.fn((key: string) => {
      collections.delete(key);
      return Promise.resolve();
    }),
    beginTransaction: vi.fn(() => {
      const pendingOps: Array<{ type: 'save' | 'delete'; key: string; data?: any }> = [];

      return Promise.resolve({
        save: vi.fn((key: string, data: any) => {
          pendingOps.push({ type: 'save', key, data });
        }),
        delete: vi.fn((key: string) => {
          pendingOps.push({ type: 'delete', key });
        }),
        commit: vi.fn(() => {
          // Apply all pending operations atomically
          pendingOps.forEach((op) => {
            if (op.type === 'save') {
              collections.set(op.key, op.data);
            } else {
              collections.delete(op.key);
            }
          });
          return Promise.resolve();
        }),
        rollback: vi.fn(() => Promise.resolve()),
        getPendingOperations: vi.fn(() => pendingOps.length),
      });
    }),
    _collections: collections, // For test inspection
  };
};

let mockStorageInstance = createMockStorage();

// Mock storage using factory function (hoisted)
vi.mock('../../services/storage', () => ({
  getStorage: vi.fn(() => Promise.resolve(mockStorageInstance)),
}));

// Mock screenshot service using factory function (hoisted)
vi.mock('../../services/screenshotCaptureService', () => {
  const mockService = {
    startCapture: vi.fn((session, callback) => {
      // Store callback for manual triggering
      mockService._callback = callback;
    }),
    stopCapture: vi.fn(),
    pauseCapture: vi.fn(),
    resumeCapture: vi.fn(),
    _callback: null as any,
  };
  return {
    screenshotCaptureService: mockService,
  };
});

// Mock audio service using factory function (hoisted)
vi.mock('../../services/audioRecordingService', () => {
  const mockService = {
    startRecording: vi.fn((session, callback) => {
      mockService._callback = callback;
      return Promise.resolve();
    }),
    stopRecording: vi.fn(() => Promise.resolve()),
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn(),
    _callback: null as any,
  };
  return {
    audioRecordingService: mockService,
  };
});

// Mock video service using factory function (hoisted)
vi.mock('../../services/videoRecordingService', () => ({
  videoRecordingService: {
    startRecording: vi.fn(() => Promise.resolve()),
    stopRecording: vi.fn(() =>
      Promise.resolve({
        fullVideoAttachmentId: 'video-attachment-1',
        duration: 120,
      })
    ),
  },
}));

// Import mocked services to access them in tests
const { attachmentStorage: mockAttachmentStorage } = await import('../../services/attachmentStorage');
const { screenshotCaptureService: mockScreenshotService } = await import('../../services/screenshotCaptureService');
const { audioRecordingService: mockAudioService } = await import('../../services/audioRecordingService');
const { videoRecordingService: mockVideoService } = await import('../../services/videoRecordingService');

// ============================================================================
// Test Helpers
// ============================================================================

function AllProvidersWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionListProvider>
      <ActiveSessionProvider>
        <RecordingProvider>{children}</RecordingProvider>
      </ActiveSessionProvider>
    </SessionListProvider>
  );
}

function useAllContexts() {
  const sessionList = useSessionList();
  const activeSession = useActiveSession();
  const recording = useRecording();

  return { sessionList, activeSession, recording };
}

async function waitForQueueEmpty(timeout = 2000): Promise<void> {
  const queue = getPersistenceQueue();
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const stats = queue.getStats();
    if (stats.pending === 0 && stats.processing === 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error('Queue did not empty in time');
}

// ============================================================================
// E2E Tests
// ============================================================================

describe('End-to-End Session Flow', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetPersistenceQueue();

    // Reset storage instance with fresh collections
    mockStorageInstance = createMockStorage();
    vi.mocked(getStorage).mockResolvedValue(mockStorageInstance);

    mockScreenshotService._callback = null;
    mockAudioService._callback = null;
  });

  afterEach(async () => {
    const queue = getPersistenceQueue();
    await queue.shutdown();
    resetPersistenceQueue();
  });

  it('should complete full session lifecycle end-to-end', async () => {
    const { result } = renderHook(() => useAllContexts(), {
      wrapper: AllProvidersWrapper,
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.sessionList.loading).toBe(false);
    });

    // ========================================
    // STEP 1: Start Session
    // ========================================
    console.log('[E2E] Step 1: Starting session...');

    act(() => {
      result.current.activeSession.startSession({
        name: 'E2E Test Session',
        description: 'Complete end-to-end test',
        status: 'active',
        tags: ['test', 'e2e'],
        category: 'Development',
        subCategory: 'Testing',
        screenshotInterval: 30,
        audioRecording: true,
        audioConfig: {
          sourceType: 'microphone',
          micDeviceId: 'test-mic-device',
          micVolume: 1.0,
        },
        videoRecording: true,
        videoConfig: {
          sourceType: 'display',
          displayIds: ['test-display-1'],
          quality: 'high',
          fps: 30,
        },
      });
    });

    expect(result.current.activeSession.activeSession).toBeDefined();
    const sessionId = result.current.activeSession.activeSession!.id;
    console.log(`[E2E] Session started: ${sessionId}`);

    // ========================================
    // STEP 2: Start Recording Services
    // ========================================
    console.log('[E2E] Step 2: Starting recording services...');

    const screenshotCallback = vi.fn();
    const audioCallback = vi.fn();

    act(() => {
      result.current.recording.startScreenshots(
        result.current.activeSession.activeSession!,
        screenshotCallback
      );
    });

    expect(mockScreenshotService.startCapture).toHaveBeenCalled();
    expect(result.current.recording.recordingState.screenshots).toBe('active');
    console.log('[E2E] Screenshot service started');

    await act(async () => {
      await result.current.recording.startAudio(
        result.current.activeSession.activeSession!,
        audioCallback
      );
    });

    expect(mockAudioService.startRecording).toHaveBeenCalled();
    expect(result.current.recording.recordingState.audio).toBe('active');
    console.log('[E2E] Audio service started');

    await act(async () => {
      await result.current.recording.startVideo(result.current.activeSession.activeSession!);
    });

    expect(mockVideoService.startRecording).toHaveBeenCalled();
    expect(result.current.recording.recordingState.video).toBe('active');
    console.log('[E2E] Video service started');

    // ========================================
    // STEP 3: Capture Data (Screenshots + Audio)
    // ========================================
    console.log('[E2E] Step 3: Capturing session data...');

    // Simulate 5 screenshots
    for (let i = 0; i < 5; i++) {
      const screenshot: SessionScreenshot = {
        id: `screenshot-${i}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        attachmentId: `attachment-screenshot-${i}`,
        analysisStatus: 'pending',
      };

      act(() => {
        result.current.activeSession.addScreenshot(screenshot);
      });

      console.log(`[E2E] Screenshot ${i + 1}/5 captured`);
    }

    expect(result.current.activeSession.activeSession!.screenshots).toHaveLength(5);

    // Simulate 3 audio segments
    for (let i = 0; i < 3; i++) {
      const audioSegment: SessionAudioSegment = {
        id: `audio-segment-${i}`,
        sessionId: sessionId,
        startTime: new Date(Date.now() + i * 30000).toISOString(),
        endTime: new Date(Date.now() + (i + 1) * 30000).toISOString(),
        duration: 30,
        attachmentId: `attachment-audio-${i}`,
      };

      act(() => {
        result.current.activeSession.addAudioSegment(audioSegment);
      });

      console.log(`[E2E] Audio segment ${i + 1}/3 captured`);
    }

    expect(result.current.activeSession.activeSession!.audioSegments).toHaveLength(3);

    // ========================================
    // STEP 4: Update Session Metadata
    // ========================================
    console.log('[E2E] Step 4: Updating session metadata...');

    act(() => {
      result.current.activeSession.updateActiveSession({
        description: 'Updated description with progress notes',
        tags: ['test', 'e2e', 'completed'],
      });
    });

    expect(result.current.activeSession.activeSession!.description).toBe(
      'Updated description with progress notes'
    );
    expect(result.current.activeSession.activeSession!.tags).toContain('completed');

    // Add some extracted tasks and notes
    act(() => {
      result.current.activeSession.addExtractedTask('task-1');
      result.current.activeSession.addExtractedTask('task-2');
      result.current.activeSession.addExtractedNote('note-1');
    });

    await waitFor(() => {
      expect(result.current.activeSession.activeSession!.extractedTaskIds).toHaveLength(2);
      expect(result.current.activeSession.activeSession!.extractedNoteIds).toHaveLength(1);
    });

    // ========================================
    // STEP 5: Stop Recording Services
    // ========================================
    console.log('[E2E] Step 5: Stopping recording services...');

    await act(async () => {
      await result.current.recording.stopAll();
    });

    expect(mockScreenshotService.stopCapture).toHaveBeenCalled();
    expect(mockAudioService.stopRecording).toHaveBeenCalled();
    expect(mockVideoService.stopRecording).toHaveBeenCalled();

    expect(result.current.recording.recordingState.screenshots).toBe('stopped');
    expect(result.current.recording.recordingState.audio).toBe('stopped');
    expect(result.current.recording.recordingState.video).toBe('stopped');

    console.log('[E2E] All recording services stopped');

    // ========================================
    // STEP 6: End Session
    // ========================================
    console.log('[E2E] Step 6: Ending session...');

    await act(async () => {
      await result.current.activeSession.endSession();
    });

    expect(result.current.activeSession.activeSession).toBeNull();
    console.log('[E2E] Session ended');

    // ========================================
    // STEP 7: Verify Data Persistence
    // ========================================
    console.log('[E2E] Step 7: Verifying data persistence...');

    // Wait for queue to process
    await waitForQueueEmpty();

    // Verify storage.save was called
    const storage = await getStorage();
    expect(vi.mocked(storage.save)).toHaveBeenCalled();

    // Get the saved session
    const saveCalls = vi.mocked(storage.save).mock.calls.filter((call) => call[0] === 'sessions');
    expect(saveCalls.length).toBeGreaterThan(0);

    const lastSaveCall = saveCalls[saveCalls.length - 1];
    const savedSessions = lastSaveCall[1] as Session[];

    expect(Array.isArray(savedSessions)).toBe(true);

    const savedSession = savedSessions.find((s) => s.id === sessionId);
    expect(savedSession).toBeDefined();

    console.log('[E2E] Verifying saved session data...');

    // Verify session metadata
    expect(savedSession!.name).toBe('E2E Test Session');
    expect(savedSession!.description).toBe('Updated description with progress notes');
    expect(savedSession!.status).toBe('completed');
    expect(savedSession!.tags).toContain('completed');
    expect(savedSession!.category).toBe('Development');
    expect(savedSession!.subCategory).toBe('Testing');

    // Verify timestamps
    expect(savedSession!.startTime).toBeDefined();
    expect(savedSession!.endTime).toBeDefined();
    expect(savedSession!.totalDuration).toBeDefined();

    // Verify captured data
    expect(savedSession!.screenshots).toHaveLength(5);
    expect(savedSession!.audioSegments).toHaveLength(3);
    expect(savedSession!.extractedTaskIds).toHaveLength(2);
    expect(savedSession!.extractedNoteIds).toHaveLength(1);

    // Verify recording configs
    expect(savedSession!.screenshotConfig).toBeDefined();
    expect(savedSession!.audioConfig).toBeDefined();
    expect(savedSession!.videoConfig).toBeDefined();

    console.log('[E2E] All data verified successfully!');

    // ========================================
    // STEP 8: Verify Session Appears in List
    // ========================================
    console.log('[E2E] Step 8: Verifying session appears in list...');

    // The saved session should already be in storage from the save operations
    // Just refresh the session list to pick it up
    await act(async () => {
      await result.current.sessionList.refreshSessions();
    });

    const listedSession = result.current.sessionList.getSessionById(sessionId);
    expect(listedSession).toBeDefined();
    expect(listedSession!.id).toBe(sessionId);
    expect(listedSession!.status).toBe('completed');

    console.log('[E2E] Session found in list!');

    // ========================================
    // STEP 9: Verify Filtering and Sorting
    // ========================================
    console.log('[E2E] Step 9: Testing filtering and sorting...');

    act(() => {
      result.current.sessionList.setFilter({
        status: ['completed'],
        category: 'Development',
      });
    });

    expect(result.current.sessionList.filteredSessions).toHaveLength(1);
    expect(result.current.sessionList.filteredSessions[0].id).toBe(sessionId);

    act(() => {
      result.current.sessionList.setSortBy('startTime-desc');
    });

    expect(result.current.sessionList.filteredSessions[0].id).toBe(sessionId);

    console.log('[E2E] Filtering and sorting work correctly!');

    // ========================================
    // SUCCESS!
    // ========================================
    console.log('[E2E] ✅ Complete session lifecycle test PASSED');
  });

  it('should handle pause/resume in session flow', async () => {
    const { result } = renderHook(() => useAllContexts(), {
      wrapper: AllProvidersWrapper,
    });

    await waitFor(() => {
      expect(result.current.sessionList.loading).toBe(false);
    });

    // Start session and recording
    act(() => {
      result.current.activeSession.startSession({
        name: 'Pause Resume Test',
        description: '',
        status: 'active',
        screenshotInterval: 30,
        audioRecording: false,
        videoRecording: false,
      });
    });

    act(() => {
      result.current.recording.startScreenshots(
        result.current.activeSession.activeSession!,
        vi.fn()
      );
    });

    await act(async () => {
      await result.current.recording.startAudio(
        result.current.activeSession.activeSession!,
        vi.fn()
      );
    });

    // Capture some data
    act(() => {
      result.current.activeSession.addScreenshot({
        id: 'screenshot-before-pause',
        timestamp: new Date().toISOString(),
        attachmentId: 'attachment-1',
        analysisStatus: 'complete',
      });
    });

    // Pause
    act(() => {
      result.current.activeSession.pauseSession();
      result.current.recording.pauseAll();
    });

    expect(result.current.activeSession.activeSession!.status).toBe('paused');
    expect(result.current.recording.recordingState.screenshots).toBe('paused');
    expect(result.current.recording.recordingState.audio).toBe('paused');

    const pausedAt = result.current.activeSession.activeSession!.pausedAt;
    expect(pausedAt).toBeDefined();

    // Wait a bit to accumulate pause time
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Resume
    act(() => {
      result.current.activeSession.resumeSession();
      result.current.recording.resumeAll();
    });

    expect(result.current.activeSession.activeSession!.status).toBe('active');
    expect(result.current.activeSession.activeSession!.pausedAt).toBeUndefined();
    expect(result.current.activeSession.activeSession!.totalPausedTime).toBeGreaterThan(0);

    // Capture more data after resume
    act(() => {
      result.current.activeSession.addScreenshot({
        id: 'screenshot-after-resume',
        timestamp: new Date().toISOString(),
        attachmentId: 'attachment-2',
        analysisStatus: 'complete',
      });
    });

    expect(result.current.activeSession.activeSession!.screenshots).toHaveLength(2);

    // End session
    await act(async () => {
      await result.current.recording.stopAll();
      await result.current.activeSession.endSession();
    });

    await waitForQueueEmpty();

    // Verify paused time was calculated
    const storage = await getStorage();
    const savedSessions = vi.mocked(storage.save).mock.calls
      .filter((call) => call[0] === 'sessions')
      .map((call) => call[1])
      .flat() as Session[];

    const savedSession = savedSessions[savedSessions.length - 1];
    expect(savedSession.totalPausedTime).toBeGreaterThan(0);
  });

  it('should handle errors gracefully without data loss', async () => {
    const { result } = renderHook(() => useAllContexts(), {
      wrapper: AllProvidersWrapper,
    });

    await waitFor(() => {
      expect(result.current.sessionList.loading).toBe(false);
    });

    // Start session
    act(() => {
      result.current.activeSession.startSession({
        name: 'Error Handling Test',
        description: '',
        status: 'active',
        screenshotInterval: 30,
        audioRecording: false,
        videoRecording: false,
      });
    });

    // Add data
    act(() => {
      result.current.activeSession.addScreenshot({
        id: 'screenshot-1',
        timestamp: new Date().toISOString(),
        attachmentId: 'attachment-1',
        analysisStatus: 'complete',
      });
    });

    // Mock screenshot service to fail
    mockScreenshotService.stopCapture.mockImplementation(() => {
      throw new Error('Screenshot service error');
    });

    // Try to stop (should handle error)
    await act(async () => {
      try {
        await result.current.recording.stopAll();
      } catch (error) {
        // Expected to throw
      }
    });

    // Session data should still be intact
    expect(result.current.activeSession.activeSession!.screenshots).toHaveLength(1);

    // Should still be able to end session
    mockScreenshotService.stopCapture.mockRestore();

    await act(async () => {
      await result.current.activeSession.endSession();
    });

    await waitForQueueEmpty();

    // Verify data was saved despite error
    const storage = await getStorage();
    const savedSessions = vi.mocked(storage.save).mock.calls
      .filter((call) => call[0] === 'sessions')
      .map((call) => call[1])
      .flat() as Session[];

    expect(savedSessions.length).toBeGreaterThan(0);
    const savedSession = savedSessions[savedSessions.length - 1];
    expect(savedSession.screenshots).toHaveLength(1);
  });
});
