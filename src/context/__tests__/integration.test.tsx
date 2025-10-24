/**
 * Context Integration Tests
 *
 * Tests that verify all Phase 1 contexts work together correctly:
 * - SessionListContext
 * - ActiveSessionContext
 * - RecordingContext
 *
 * These tests verify the complete session lifecycle and data flow between contexts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { SessionListProvider, useSessionList } from '../SessionListContext';
import { ActiveSessionProvider, useActiveSession } from '../ActiveSessionContext';
import { RecordingProvider, useRecording } from '../RecordingContext';
import type { Session, SessionScreenshot, SessionAudioSegment } from '../../types';

// ============================================================================
// Mocks
// ============================================================================

// Mock storage
const mockStorage = {
  load: vi.fn(() => Promise.resolve([])),
  save: vi.fn(() => Promise.resolve()),
};

vi.mock('../../services/storage', () => ({
  getStorage: vi.fn(() => Promise.resolve(mockStorage)),
}));

// Mock attachment storage
const mockAttachmentStorage = {
  deleteAttachments: vi.fn(() => Promise.resolve()),
  createAttachment: vi.fn((data) => Promise.resolve({ id: 'attachment-' + Date.now(), ...data })),
};

vi.mock('../../services/attachmentStorage', () => ({
  attachmentStorage: mockAttachmentStorage,
}));

// Mock recording services
const mockScreenshotService = {
  startCapture: vi.fn(),
  stopCapture: vi.fn(),
  pauseCapture: vi.fn(),
  resumeCapture: vi.fn(),
};

const mockAudioService = {
  startRecording: vi.fn(() => Promise.resolve()),
  stopRecording: vi.fn(() => Promise.resolve()),
  pauseRecording: vi.fn(),
  resumeRecording: vi.fn(),
};

const mockVideoService = {
  startRecording: vi.fn(() => Promise.resolve()),
  stopRecording: vi.fn(() => Promise.resolve()),
};

vi.mock('../../services/screenshotCaptureService', () => ({
  screenshotCaptureService: mockScreenshotService,
}));

vi.mock('../../services/audioRecordingService', () => ({
  audioRecordingService: mockAudioService,
}));

vi.mock('../../services/videoRecordingService', () => ({
  videoRecordingService: mockVideoService,
}));

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Wrapper that provides all three contexts
 */
function AllProvidersWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionListProvider>
      <ActiveSessionProvider>
        <RecordingProvider>
          {children}
        </RecordingProvider>
      </ActiveSessionProvider>
    </SessionListProvider>
  );
}

/**
 * Create a complete hook that uses all three contexts
 */
function useAllContexts() {
  const sessionList = useSessionList();
  const activeSession = useActiveSession();
  const recording = useRecording();

  return { sessionList, activeSession, recording };
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Context Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.load.mockResolvedValue([]);
    mockStorage.save.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Session Lifecycle', () => {
    it('should complete full session flow: Start → Record → End → List', async () => {
      const { result } = renderHook(() => useAllContexts(), {
        wrapper: AllProvidersWrapper,
      });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.sessionList.loading).toBe(false);
      });

      // STEP 1: Start session via ActiveSessionContext
      act(() => {
        result.current.activeSession.startSession({
          name: 'Integration Test Session',
          description: 'Testing full session flow',
          status: 'active',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
        });
      });

      expect(result.current.activeSession.activeSession).toBeDefined();
      expect(result.current.activeSession.activeSession?.name).toBe('Integration Test Session');
      const sessionId = result.current.activeSession.activeSession?.id;

      // STEP 2: Start recording services via RecordingContext
      const mockScreenshotCallback = vi.fn();
      const mockAudioCallback = vi.fn();

      act(() => {
        result.current.recording.startScreenshots(
          result.current.activeSession.activeSession!,
          mockScreenshotCallback
        );
      });

      expect(mockScreenshotService.startCapture).toHaveBeenCalled();
      expect(result.current.recording.recordingState.screenshots).toBe('active');

      await act(async () => {
        await result.current.recording.startAudio(
          result.current.activeSession.activeSession!,
          mockAudioCallback
        );
      });

      expect(mockAudioService.startRecording).toHaveBeenCalled();
      expect(result.current.recording.recordingState.audio).toBe('active');

      // STEP 3: Simulate data capture (screenshots and audio)
      const screenshot: SessionScreenshot = {
        id: 'screenshot-1',
        timestamp: new Date().toISOString(),
        attachmentId: 'attachment-1',
        analysisStatus: 'pending',
      };

      act(() => {
        result.current.activeSession.addScreenshot(screenshot);
      });

      expect(result.current.activeSession.activeSession?.screenshots).toHaveLength(1);

      const audioSegment: SessionAudioSegment = {
        id: 'audio-1',
        sessionId: sessionId!,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 30,
        attachmentId: 'attachment-audio-1',
      };

      act(() => {
        result.current.activeSession.addAudioSegment(audioSegment);
      });

      expect(result.current.activeSession.activeSession?.audioSegments).toHaveLength(1);

      // STEP 4: Stop recording services
      await act(async () => {
        await result.current.recording.stopAll();
      });

      expect(mockScreenshotService.stopCapture).toHaveBeenCalled();
      expect(mockAudioService.stopRecording).toHaveBeenCalled();

      // STEP 5: End session (should move to SessionListContext)
      await act(async () => {
        await result.current.activeSession.endSession();
      });

      expect(result.current.activeSession.activeSession).toBeNull();

      // STEP 6: Verify session appears in SessionList
      await waitFor(() => {
        expect(mockStorage.save).toHaveBeenCalled();
      });

      // Verify the saved session has correct data
      const savedSession = mockStorage.save.mock.calls[mockStorage.save.mock.calls.length - 1][1];
      expect(savedSession).toBeDefined();
      expect(Array.isArray(savedSession)).toBe(true);

      if (Array.isArray(savedSession)) {
        const session = savedSession.find((s: Session) => s.id === sessionId);
        expect(session).toBeDefined();
        expect(session?.status).toBe('completed');
        expect(session?.screenshots).toHaveLength(1);
        expect(session?.audioSegments).toHaveLength(1);
        expect(session?.endTime).toBeDefined();
        expect(session?.totalDuration).toBeDefined();
      }
    });

    it('should handle pause/resume correctly', async () => {
      const { result } = renderHook(() => useAllContexts(), {
        wrapper: AllProvidersWrapper,
      });

      await waitFor(() => {
        expect(result.current.sessionList.loading).toBe(false);
      });

      // Start session
      act(() => {
        result.current.activeSession.startSession({
          name: 'Pause Resume Test',
          description: '',
          status: 'active',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
        });
      });

      // Start recording
      act(() => {
        result.current.recording.startScreenshots(
          result.current.activeSession.activeSession!,
          vi.fn()
        );
      });

      // Pause both session and recording
      act(() => {
        result.current.activeSession.pauseSession();
        result.current.recording.pauseAll();
      });

      expect(result.current.activeSession.activeSession?.status).toBe('paused');
      expect(result.current.recording.recordingState.screenshots).toBe('paused');

      // Resume both
      act(() => {
        result.current.activeSession.resumeSession();
        result.current.recording.resumeAll();
      });

      expect(result.current.activeSession.activeSession?.status).toBe('active');
      expect(result.current.recording.recordingState.screenshots).toBe('active');
    });
  });

  describe('Error Handling Across Contexts', () => {
    it('should handle recording service errors gracefully', async () => {
      // Mock screenshot service to fail
      mockScreenshotService.startCapture.mockImplementation(() => {
        throw new Error('Screenshot permission denied');
      });

      const { result } = renderHook(() => useAllContexts(), {
        wrapper: AllProvidersWrapper,
      });

      await waitFor(() => {
        expect(result.current.sessionList.loading).toBe(false);
      });

      // Start session
      act(() => {
        result.current.activeSession.startSession({
          name: 'Error Test Session',
          description: '',
          status: 'active',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
        });
      });

      // Try to start screenshots (should fail gracefully)
      expect(() => {
        act(() => {
          result.current.recording.startScreenshots(
            result.current.activeSession.activeSession!,
            vi.fn()
          );
        });
      }).toThrow('Screenshot permission denied');

      expect(result.current.recording.recordingState.screenshots).toBe('error');

      // Session should still be active
      expect(result.current.activeSession.activeSession).toBeDefined();
      expect(result.current.activeSession.activeSession?.status).toBe('active');

      // Should still be able to end session
      await act(async () => {
        await result.current.activeSession.endSession();
      });

      expect(result.current.activeSession.activeSession).toBeNull();
    });

    it('should prevent data loss during rapid updates', async () => {
      const { result } = renderHook(() => useAllContexts(), {
        wrapper: AllProvidersWrapper,
      });

      await waitFor(() => {
        expect(result.current.sessionList.loading).toBe(false);
      });

      // Start session
      act(() => {
        result.current.activeSession.startSession({
          name: 'Rapid Update Test',
          description: '',
          status: 'active',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
        });
      });

      // Rapidly add multiple screenshots
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.activeSession.addScreenshot({
            id: `screenshot-${i}`,
            timestamp: new Date().toISOString(),
            attachmentId: `attachment-${i}`,
            analysisStatus: 'pending',
          });
        }
      });

      // All screenshots should be preserved
      expect(result.current.activeSession.activeSession?.screenshots).toHaveLength(10);

      // Verify each screenshot is unique
      const screenshotIds = result.current.activeSession.activeSession?.screenshots.map(s => s.id);
      const uniqueIds = new Set(screenshotIds);
      expect(uniqueIds.size).toBe(10);
    });

    it('should handle duplicate audio segments gracefully', async () => {
      const { result } = renderHook(() => useAllContexts(), {
        wrapper: AllProvidersWrapper,
      });

      await waitFor(() => {
        expect(result.current.sessionList.loading).toBe(false);
      });

      // Start session
      act(() => {
        result.current.activeSession.startSession({
          name: 'Duplicate Audio Test',
          description: '',
          status: 'active',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
        });
      });

      const audioSegment: SessionAudioSegment = {
        id: 'audio-duplicate',
        sessionId: result.current.activeSession.activeSession!.id,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 30,
        attachmentId: 'attachment-audio',
      };

      // Add same segment twice
      act(() => {
        result.current.activeSession.addAudioSegment(audioSegment);
        result.current.activeSession.addAudioSegment(audioSegment);
      });

      // Should only have one segment (duplicate prevented)
      expect(result.current.activeSession.activeSession?.audioSegments).toHaveLength(1);
    });
  });

  describe('Session Deletion with Attachment Cleanup', () => {
    it('should clean up all attachments when deleting a session', async () => {
      // Pre-populate storage with a session
      const sessionToDelete: Session = {
        id: 'session-delete',
        name: 'Session to Delete',
        description: '',
        startTime: new Date().toISOString(),
        status: 'completed',
        screenshots: [
          {
            id: 'screenshot-1',
            timestamp: new Date().toISOString(),
            attachmentId: 'attachment-screenshot-1',
            analysisStatus: 'complete',
          },
          {
            id: 'screenshot-2',
            timestamp: new Date().toISOString(),
            attachmentId: 'attachment-screenshot-2',
            analysisStatus: 'complete',
          },
        ],
        audioSegments: [
          {
            id: 'audio-1',
            sessionId: 'session-delete',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            duration: 60,
            attachmentId: 'attachment-audio-1',
          },
        ],
        video: {
          fullVideoAttachmentId: 'attachment-video-1',
          duration: 120,
        },
        extractedTaskIds: [],
        extractedNoteIds: [],
      };

      mockStorage.load.mockResolvedValue([sessionToDelete]);

      const { result } = renderHook(() => useAllContexts(), {
        wrapper: AllProvidersWrapper,
      });

      await waitFor(() => {
        expect(result.current.sessionList.sessions).toHaveLength(1);
      });

      // Delete the session
      await act(async () => {
        await result.current.sessionList.deleteSession('session-delete');
      });

      // Verify attachment cleanup was called with all attachment IDs
      expect(mockAttachmentStorage.deleteAttachments).toHaveBeenCalledWith([
        'attachment-screenshot-1',
        'attachment-screenshot-2',
        'attachment-audio-1',
        'attachment-video-1',
      ]);

      // Verify session was removed from list
      expect(result.current.sessionList.sessions).toHaveLength(0);
    });

    it('should prevent deletion during active enrichment', async () => {
      const sessionWithEnrichment: Session = {
        id: 'session-enriching',
        name: 'Session with Enrichment',
        description: '',
        startTime: new Date().toISOString(),
        status: 'completed',
        screenshots: [],
        extractedTaskIds: [],
        extractedNoteIds: [],
        enrichmentStatus: {
          status: 'in-progress',
          progress: 50,
          currentStage: 'audio',
        },
      };

      mockStorage.load.mockResolvedValue([sessionWithEnrichment]);

      const { result } = renderHook(() => useAllContexts(), {
        wrapper: AllProvidersWrapper,
      });

      await waitFor(() => {
        expect(result.current.sessionList.sessions).toHaveLength(1);
      });

      // Try to delete (should throw)
      await expect(
        act(async () => {
          await result.current.sessionList.deleteSession('session-enriching');
        })
      ).rejects.toThrow('Cannot delete session while enrichment is in progress');

      // Session should still exist
      expect(result.current.sessionList.sessions).toHaveLength(1);
    });
  });

  describe('Context Data Consistency', () => {
    it('should maintain data consistency between active and list contexts', async () => {
      const { result } = renderHook(() => useAllContexts(), {
        wrapper: AllProvidersWrapper,
      });

      await waitFor(() => {
        expect(result.current.sessionList.loading).toBe(false);
      });

      // Start session
      act(() => {
        result.current.activeSession.startSession({
          name: 'Consistency Test',
          description: 'Testing data consistency',
          status: 'active',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
        });
      });

      const sessionId = result.current.activeSession.activeSession?.id;

      // Add some data
      act(() => {
        result.current.activeSession.addScreenshot({
          id: 'screenshot-1',
          timestamp: new Date().toISOString(),
          attachmentId: 'attachment-1',
          analysisStatus: 'complete',
        });
      });

      // End session
      await act(async () => {
        await result.current.activeSession.endSession();
      });

      // Mock the load to return the saved session
      const savedData = mockStorage.save.mock.calls[mockStorage.save.mock.calls.length - 1][1];
      mockStorage.load.mockResolvedValue(savedData);

      // Refresh session list
      await act(async () => {
        await result.current.sessionList.refreshSessions();
      });

      // Verify data consistency
      const savedSession = result.current.sessionList.getSessionById(sessionId!);
      expect(savedSession).toBeDefined();
      expect(savedSession?.screenshots).toHaveLength(1);
      expect(savedSession?.screenshots[0].id).toBe('screenshot-1');
    });

    it('should handle multiple sessions without data mixing', async () => {
      const { result } = renderHook(() => useAllContexts(), {
        wrapper: AllProvidersWrapper,
      });

      await waitFor(() => {
        expect(result.current.sessionList.loading).toBe(false);
      });

      // Create first session
      act(() => {
        result.current.activeSession.startSession({
          name: 'Session 1',
          description: '',
          status: 'active',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
        });
      });

      const session1Id = result.current.activeSession.activeSession?.id;

      act(() => {
        result.current.activeSession.addScreenshot({
          id: 'screenshot-session1',
          timestamp: new Date().toISOString(),
          attachmentId: 'attachment-session1',
          analysisStatus: 'pending',
        });
      });

      await act(async () => {
        await result.current.activeSession.endSession();
      });

      // Create second session
      act(() => {
        result.current.activeSession.startSession({
          name: 'Session 2',
          description: '',
          status: 'active',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
        });
      });

      const session2Id = result.current.activeSession.activeSession?.id;

      act(() => {
        result.current.activeSession.addScreenshot({
          id: 'screenshot-session2',
          timestamp: new Date().toISOString(),
          attachmentId: 'attachment-session2',
          analysisStatus: 'pending',
        });
      });

      await act(async () => {
        await result.current.activeSession.endSession();
      });

      // Verify both sessions are separate
      expect(session1Id).not.toBe(session2Id);

      // Mock storage to return both sessions
      const allSessions = mockStorage.save.mock.calls
        .filter(call => call[0] === 'sessions')
        .map(call => call[1])
        .flat();

      mockStorage.load.mockResolvedValue(allSessions);

      await act(async () => {
        await result.current.sessionList.refreshSessions();
      });

      // Verify both sessions exist with correct data
      const savedSession1 = result.current.sessionList.getSessionById(session1Id!);
      const savedSession2 = result.current.sessionList.getSessionById(session2Id!);

      expect(savedSession1?.screenshots[0]?.id).toBe('screenshot-session1');
      expect(savedSession2?.screenshots[0]?.id).toBe('screenshot-session2');
    });
  });

  describe('Recording Service State Management', () => {
    it('should track recording service states correctly', async () => {
      const { result } = renderHook(() => useAllContexts(), {
        wrapper: AllProvidersWrapper,
      });

      await waitFor(() => {
        expect(result.current.sessionList.loading).toBe(false);
      });

      // Initial state
      expect(result.current.recording.recordingState.screenshots).toBe('idle');
      expect(result.current.recording.recordingState.audio).toBe('idle');
      expect(result.current.recording.recordingState.video).toBe('idle');

      // Start session
      act(() => {
        result.current.activeSession.startSession({
          name: 'Recording State Test',
          description: '',
          status: 'active',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
        });
      });

      // Start services one by one
      act(() => {
        result.current.recording.startScreenshots(
          result.current.activeSession.activeSession!,
          vi.fn()
        );
      });

      expect(result.current.recording.recordingState.screenshots).toBe('active');
      expect(result.current.recording.recordingState.audio).toBe('idle');

      await act(async () => {
        await result.current.recording.startAudio(
          result.current.activeSession.activeSession!,
          vi.fn()
        );
      });

      expect(result.current.recording.recordingState.audio).toBe('active');

      await act(async () => {
        await result.current.recording.startVideo(
          result.current.activeSession.activeSession!
        );
      });

      expect(result.current.recording.recordingState.video).toBe('active');

      // Stop all
      await act(async () => {
        await result.current.recording.stopAll();
      });

      expect(result.current.recording.recordingState.screenshots).toBe('stopped');
      expect(result.current.recording.recordingState.audio).toBe('stopped');
      expect(result.current.recording.recordingState.video).toBe('stopped');
    });
  });
});
