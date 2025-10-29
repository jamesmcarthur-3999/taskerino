import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ActiveSessionProvider, useActiveSession } from '../ActiveSessionContext';
import type { Session, SessionScreenshot, SessionAudioSegment } from '../../types';

// Mock dependencies
const mockStopAll = vi.fn();
const mockUpdateSession = vi.fn();
const mockAddSession = vi.fn();

// Mock ChunkedSessionStorage
const mockSaveFullSession = vi.fn();
const mockLoadFullSession = vi.fn();
const mockAppendScreenshot = vi.fn();
const mockAppendAudioSegment = vi.fn();

vi.mock('../../services/storage/ChunkedSessionStorage', () => ({
  getChunkedStorage: vi.fn(() => Promise.resolve({
    saveFullSession: mockSaveFullSession,
    loadFullSession: mockLoadFullSession,
    appendScreenshot: mockAppendScreenshot,
    appendAudioSegment: mockAppendAudioSegment,
  })),
}));

// Mock storage (for transaction)
const mockSave = vi.fn();
const mockLoad = vi.fn();
const mockCommit = vi.fn();
const mockRollback = vi.fn();

vi.mock('../../services/storage', () => ({
  getStorage: vi.fn(() => Promise.resolve({
    load: mockLoad,
    save: mockSave,
    beginTransaction: vi.fn(() => Promise.resolve({
      save: mockSave,
      commit: mockCommit,
      rollback: mockRollback,
    })),
  })),
}));

// Mock SessionListContext
vi.mock('../SessionListContext', () => ({
  useSessionList: () => ({
    updateSession: mockUpdateSession,
    addSession: mockAddSession,
  }),
}));

// Mock RecordingContext
vi.mock('../RecordingContext', () => ({
  useRecording: () => ({
    stopAll: mockStopAll,
  }),
}));

// Mock EnrichmentContext (required by ActiveSessionContext for auto-enrichment)
const mockStartTracking = vi.fn();
const mockStopTracking = vi.fn();
const mockUpdateProgress = vi.fn();

vi.mock('../EnrichmentContext', () => ({
  useEnrichmentContext: () => ({
    startTracking: mockStartTracking,
    stopTracking: mockStopTracking,
    updateProgress: mockUpdateProgress,
    activeEnrichments: {},
    completedEnrichments: {},
  }),
  EnrichmentProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock UIContext (required by ActiveSessionContext for auto-scroll flag)
vi.mock('../UIContext', () => ({
  useUI: () => ({
    autoScrollNewSession: false,
    setAutoScrollNewSession: vi.fn(),
  }),
  UIProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock session validation
vi.mock('../../utils/sessionValidation', () => ({
  validateAudioConfig: vi.fn(() => ({ valid: true, errors: [] })),
  validateVideoConfig: vi.fn(() => ({ valid: true, errors: [] })),
  validateSession: vi.fn(() => ({ valid: true, errors: [] })),
}));

// Mock helpers
vi.mock('../../utils/helpers', () => ({
  generateId: vi.fn(() => 'generated-id-123'),
}));

// Mock video recording service
vi.mock('../../services/videoRecordingService', async () => ({
  videoRecordingService: {
    getActiveSessionId: vi.fn(() => null),
    stopRecording: vi.fn(() => Promise.resolve(null)),
  },
}));

// Mock permissions
vi.mock('../../utils/permissions', () => ({
  checkScreenRecordingPermission: vi.fn(() => Promise.resolve(true)),
  showMacOSPermissionInstructions: vi.fn(),
}));

// Mock XState machine hook
const mockSend = vi.fn();
const mockMachineState = {
  matches: vi.fn((state: string) => {
    // Default to idle state
    if (state === 'idle') return true;
    return false;
  }),
};
const mockMachineContext = {
  sessionId: null,
  config: null,
  startTime: null,
  errors: [],
  recordingState: {
    screenshots: 'idle' as const,
    audio: 'idle' as const,
    video: 'idle' as const,
  },
};

// Machine state is mutable for tests - using object so changes are reflected
const machineState = {
  value: 'idle' as 'idle' | 'active' | 'paused' | 'error',
  isIdle: true,
  isActive: false,
  isPaused: false,
};

vi.mock('../../hooks/useSessionMachine', () => ({
  useSessionMachine: vi.fn(() => ({
    state: {
      matches: (state: string) => state === machineState.value,
    },
    context: mockMachineContext,
    send: mockSend,
    get isIdle() { return machineState.isIdle; },
    get isActive() { return machineState.isActive; },
    get isPaused() { return machineState.isPaused; },
    isValidating: false,
    isCheckingPermissions: false,
    isStarting: false,
    isEnding: false,
    isError: false,
    get currentState() { return machineState.value; },
  })),
}));

// Helper to set machine state for tests
function setMachineState(state: 'idle' | 'active' | 'paused' | 'error') {
  machineState.value = state;
  machineState.isIdle = state === 'idle';
  machineState.isActive = state === 'active';
  machineState.isPaused = state === 'paused';
}

describe('ActiveSessionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset machine state to idle
    setMachineState('idle');

    // Default mock implementations
    mockSaveFullSession.mockResolvedValue(undefined);
    mockLoadFullSession.mockResolvedValue(null);
    mockAppendScreenshot.mockResolvedValue(undefined);
    mockAppendAudioSegment.mockResolvedValue(undefined);
    mockLoad.mockResolvedValue({});
    mockCommit.mockResolvedValue(undefined);
    mockRollback.mockResolvedValue(undefined);
    mockStopAll.mockResolvedValue(undefined);
    mockUpdateSession.mockResolvedValue(undefined);
    mockAddSession.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Wrapper now includes EnrichmentProvider (required by ActiveSessionContext)
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ActiveSessionProvider>{children}</ActiveSessionProvider>
  );

  describe('Provider', () => {
    it('should provide context value', () => {
      const { result } = renderHook(() => useActiveSession(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.activeSession).toBeNull();
      expect(result.current.activeSessionId).toBeUndefined();
      expect(typeof result.current.startSession).toBe('function');
      expect(typeof result.current.endSession).toBe('function');
    });

    it('should throw error when used outside provider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useActiveSession());
      }).toThrow('useActiveSession must be used within ActiveSessionProvider');

      consoleError.mockRestore();
    });
  });

  describe('Session Lifecycle', () => {
    describe('startSession', () => {
      it('should create session with correct structure', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: 'Test description',
            tags: ['tag1', 'tag2'],
            screenshotInterval: 60000,
            autoAnalysis: true,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        // Session should be set immediately after startSession completes
        expect(result.current.activeSession).not.toBeNull();

        const session = result.current.activeSession!;
        expect(session.id).toBe('generated-id-123');
        expect(session.name).toBe('Test Session');
        expect(session.description).toBe('Test description');
        expect(session.status).toBe('active');
        expect(session.screenshots).toEqual([]);
        expect(session.extractedTaskIds).toEqual([]);
        expect(session.extractedNoteIds).toEqual([]);
        expect(session.relationshipVersion).toBe(1);
      });

      it('should save session metadata immediately', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        expect(mockSaveFullSession).toHaveBeenCalledTimes(1);
      });

      it('should add session to SessionListContext', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        expect(mockAddSession).toHaveBeenCalledTimes(1);

        const addedSession = mockAddSession.mock.calls[0][0];
        expect(addedSession.screenshots).toEqual([]);
        expect(addedSession.audioSegments).toEqual([]);
        expect(addedSession.contextItems).toEqual([]);
      });

      it('should reject session with empty name', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await expect(async () => {
          await act(async () => {
            await result.current.startSession({
              name: '',
              description: '',
              tags: [],
              screenshotInterval: 60000,
              autoAnalysis: false,
              enableScreenshots: true,
              audioMode: 'none',
            });
          });
        }).rejects.toThrow('Session name is required');

        expect(result.current.activeSession).toBeNull();
        expect(consoleError).toHaveBeenCalledWith(
          expect.stringContaining('Validation failed: Session name is required')
        );

        consoleError.mockRestore();
      });

      it('should reject session with whitespace-only name', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await expect(async () => {
          await act(async () => {
            await result.current.startSession({
              name: '   ',
              description: '',
              tags: [],
              screenshotInterval: 60000,
              autoAnalysis: false,
              enableScreenshots: true,
              audioMode: 'none',
            });
          });
        }).rejects.toThrow('Session name is required');

        expect(result.current.activeSession).toBeNull();
        consoleError.mockRestore();
      });

      it('should validate audioConfig when provided', async () => {
        const { validateAudioConfig } = await import('../../utils/sessionValidation');
        const mockValidateAudio = vi.mocked(validateAudioConfig);

        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'microphone',
            audioConfig: {
              source: 'microphone',
              audioDeviceId: 'device-1',
              chunkDurationMs: 30000,
            },
          });
        });

        expect(mockValidateAudio).toHaveBeenCalled();
      });

      it('should validate videoConfig when provided', async () => {
        const { validateVideoConfig } = await import('../../utils/sessionValidation');
        const mockValidateVideo = vi.mocked(validateVideoConfig);

        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
            videoRecording: true,
            videoConfig: {
              resolution: '1080p',
              fps: 30,
            },
          });
        });

        expect(mockValidateVideo).toHaveBeenCalled();
      });
    });

    describe('pauseSession', () => {
      it('should update session status to paused', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        // Start session first
        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        expect(result.current.activeSession).not.toBeNull();

        // Set machine state to active (session started successfully)
        setMachineState('active');

        // Pause session
        act(() => {
          result.current.pauseSession();
        });

        expect(result.current.activeSession?.status).toBe('paused');
        expect(result.current.activeSession?.pausedAt).toBeDefined();
        expect(mockSend).toHaveBeenCalledWith({ type: 'PAUSE' });
      });

      it('should warn when pausing with no active session', () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        act(() => {
          result.current.pauseSession();
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Cannot pause: no active session')
        );

        consoleWarn.mockRestore();
      });

      it('should set pausedAt timestamp', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        const beforePause = new Date();

        act(() => {
          result.current.pauseSession();
        });

        const pausedAt = new Date(result.current.activeSession!.pausedAt!);
        expect(pausedAt.getTime()).toBeGreaterThanOrEqual(beforePause.getTime());
      });
    });

    describe('resumeSession', () => {
      it('should update status to active and clear pausedAt', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        // Start and pause session
        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        // Set machine to active, then pause
        setMachineState('active');

        act(() => {
          result.current.pauseSession();
        });

        expect(result.current.activeSession?.status).toBe('paused');

        // Set machine to paused
        setMachineState('paused');

        // Resume session
        act(() => {
          result.current.resumeSession();
        });

        expect(result.current.activeSession?.status).toBe('active');
        expect(result.current.activeSession?.pausedAt).toBeUndefined();
        expect(mockSend).toHaveBeenCalledWith({ type: 'RESUME' });
      });

      it('should calculate and accumulate paused time', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        // First pause
        act(() => {
          result.current.pauseSession();
        });

        vi.advanceTimersByTime(5000); // 5 seconds

        act(() => {
          result.current.resumeSession();
        });

        const firstPausedTime = result.current.activeSession?.totalPausedTime || 0;
        expect(firstPausedTime).toBeGreaterThan(0);

        // Second pause
        act(() => {
          result.current.pauseSession();
        });

        vi.advanceTimersByTime(3000); // 3 seconds

        act(() => {
          result.current.resumeSession();
        });

        const totalPausedTime = result.current.activeSession?.totalPausedTime || 0;
        expect(totalPausedTime).toBeGreaterThan(firstPausedTime);
      });

      it('should warn when resuming with no active session', () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        act(() => {
          result.current.resumeSession();
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Cannot resume: no active session')
        );

        consoleWarn.mockRestore();
      });
    });

    describe('endSession', () => {
      it('should mark session as completed', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        await act(async () => {
          await result.current.endSession();
        });

        expect(mockSaveFullSession).toHaveBeenCalled();
        const savedSession = mockSaveFullSession.mock.calls[mockSaveFullSession.mock.calls.length - 1][0];
        expect(savedSession.status).toBe('completed');
        expect(savedSession.endTime).toBeDefined();
      });

      it('should stop all recording services', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        await act(async () => {
          await result.current.endSession();
        });

        expect(mockStopAll).toHaveBeenCalled();
      });

      it('should calculate total duration excluding paused time', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        // Pause for 5 seconds
        act(() => {
          result.current.pauseSession();
        });

        vi.advanceTimersByTime(5000);

        act(() => {
          result.current.resumeSession();
        });

        // Wait some active time
        vi.advanceTimersByTime(10000);

        await act(async () => {
          await result.current.endSession();
        });

        const savedSession = mockSaveFullSession.mock.calls[mockSaveFullSession.mock.calls.length - 1][0];
        expect(savedSession.totalDuration).toBeDefined();
      });

      it('should clear activeSessionId in settings', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        await act(async () => {
          await result.current.endSession();
        });

        expect(mockSave).toHaveBeenCalledWith(
          'settings',
          expect.objectContaining({ activeSessionId: undefined })
        );
      });

      it('should update SessionListContext with completed session', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        await act(async () => {
          await result.current.endSession();
        });

        expect(mockUpdateSession).toHaveBeenCalled();
        const [sessionId, updatedSession] = mockUpdateSession.mock.calls[mockUpdateSession.mock.calls.length - 1];
        expect(sessionId).toBe('generated-id-123');
        expect(updatedSession.status).toBe('completed');
      });

      it('should set activeSession to null after ending', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        expect(result.current.activeSession).not.toBeNull();

        await act(async () => {
          await result.current.endSession();
        });

        expect(result.current.activeSession).toBeNull();
      });

      it('should prevent double-ending', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        // Try to end twice simultaneously
        await act(async () => {
          const promise1 = result.current.endSession();
          const promise2 = result.current.endSession();
          await Promise.all([promise1, promise2]);
        });

        // Should only save once (twice total: startSession + endSession)
        expect(mockSaveFullSession).toHaveBeenCalledTimes(2);
      });

      it('should warn when ending with no active session', async () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.endSession();
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Cannot end: no active session')
        );

        consoleWarn.mockRestore();
      });

      it('should warn when ending already-completed session', async () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        await act(async () => {
          await result.current.endSession();
        });

        // Manually set a completed session (simulating edge case)
        await act(async () => {
          await result.current.startSession({
            name: 'Test Session 2',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        // Force status to completed
        act(() => {
          result.current.updateActiveSession({ status: 'completed' });
        });

        // Try to end again
        await act(async () => {
          await result.current.endSession();
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Attempted to end already-completed session')
        );

        consoleWarn.mockRestore();
      });

      it('should rollback transaction on error', async () => {
        mockCommit.mockRejectedValueOnce(new Error('Storage error'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        await act(async () => {
          try {
            await result.current.endSession();
          } catch (error) {
            // Expected to throw
          }
        });

        expect(mockRollback).toHaveBeenCalled();
        consoleError.mockRestore();
      });
    });

    describe('loadSession', () => {
      it('should load full session from storage', async () => {
        const mockSession: Session = {
          id: 'session-1',
          name: 'Loaded Session',
          description: 'Test',
          startTime: new Date().toISOString(),
          status: 'completed',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
          screenshotInterval: 60000,
          autoAnalysis: false,
          enableScreenshots: true,
          audioMode: 'none',
        };

        mockLoadFullSession.mockResolvedValue(mockSession);

        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.loadSession('session-1');
        });

        expect(mockLoadFullSession).toHaveBeenCalledWith('session-1');
        expect(result.current.activeSession?.id).toBe('session-1');
        expect(result.current.activeSession?.name).toBe('Loaded Session');
      });

      it('should handle session not found', async () => {
        mockLoadFullSession.mockResolvedValue(null);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.loadSession('non-existent');
        });

        expect(consoleError).toHaveBeenCalledWith(
          '[ActiveSessionContext] Session not found:',
          'non-existent'
        );
        expect(result.current.activeSession).toBeNull();

        consoleError.mockRestore();
      });

      it('should throw on storage error', async () => {
        mockLoadFullSession.mockRejectedValue(new Error('Storage error'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await expect(async () => {
          await act(async () => {
            await result.current.loadSession('session-1');
          });
        }).rejects.toThrow('Storage error');

        consoleError.mockRestore();
      });
    });
  });

  describe('Screenshot Management', () => {
    describe('addScreenshot', () => {
      it('should append screenshot to active session', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        const screenshot: SessionScreenshot = {
          id: 'screenshot-1',
          timestamp: new Date().toISOString(),
          attachmentId: 'attachment-1',
        };

        await act(async () => {
          await result.current.addScreenshot(screenshot);
        });

        expect(result.current.activeSession?.screenshots).toHaveLength(1);
        expect(result.current.activeSession?.screenshots[0].id).toBe('screenshot-1');
      });

      it('should save screenshot to chunked storage', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        const screenshot: SessionScreenshot = {
          id: 'screenshot-1',
          timestamp: new Date().toISOString(),
          attachmentId: 'attachment-1',
        };

        await act(async () => {
          await result.current.addScreenshot(screenshot);
        });

        expect(mockAppendScreenshot).toHaveBeenCalledWith('generated-id-123', screenshot);
      });

      it('should maintain chronological order', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        const screenshot1: SessionScreenshot = {
          id: 'screenshot-1',
          timestamp: new Date(Date.now() - 2000).toISOString(),
          attachmentId: 'attachment-1',
        };

        const screenshot2: SessionScreenshot = {
          id: 'screenshot-2',
          timestamp: new Date(Date.now() - 1000).toISOString(),
          attachmentId: 'attachment-2',
        };

        const screenshot3: SessionScreenshot = {
          id: 'screenshot-3',
          timestamp: new Date().toISOString(),
          attachmentId: 'attachment-3',
        };

        await act(async () => {
          await result.current.addScreenshot(screenshot1);
        });

        await act(async () => {
          await result.current.addScreenshot(screenshot2);
        });

        await act(async () => {
          await result.current.addScreenshot(screenshot3);
        });

        const screenshots = result.current.activeSession?.screenshots || [];
        expect(screenshots).toHaveLength(3);
        expect(screenshots[0].id).toBe('screenshot-1');
        expect(screenshots[1].id).toBe('screenshot-2');
        expect(screenshots[2].id).toBe('screenshot-3');
      });

      it('should update lastScreenshotTime', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        const timestamp = new Date().toISOString();
        const screenshot: SessionScreenshot = {
          id: 'screenshot-1',
          timestamp,
          attachmentId: 'attachment-1',
        };

        await act(async () => {
          await result.current.addScreenshot(screenshot);
        });

        expect(result.current.activeSession?.lastScreenshotTime).toBe(timestamp);
      });

      it('should warn when adding screenshot without active session', async () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        const screenshot: SessionScreenshot = {
          id: 'screenshot-1',
          timestamp: new Date().toISOString(),
          attachmentId: 'attachment-1',
        };

        await act(async () => {
          await result.current.addScreenshot(screenshot);
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Cannot add screenshot: no active session')
        );

        consoleWarn.mockRestore();
      });

      it('should handle storage error when appending screenshot', async () => {
        mockAppendScreenshot.mockRejectedValueOnce(new Error('Storage error'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        const screenshot: SessionScreenshot = {
          id: 'screenshot-1',
          timestamp: new Date().toISOString(),
          attachmentId: 'attachment-1',
        };

        await expect(async () => {
          await act(async () => {
            await result.current.addScreenshot(screenshot);
          });
        }).rejects.toThrow('Storage error');

        consoleError.mockRestore();
      });
    });

    describe('updateScreenshotAnalysis', () => {
      it('should update screenshot with analysis results', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        const screenshot: SessionScreenshot = {
          id: 'screenshot-1',
          timestamp: new Date().toISOString(),
          attachmentId: 'attachment-1',
          analysisStatus: 'pending',
        };

        await act(async () => {
          await result.current.addScreenshot(screenshot);
        });

        const analysis = {
          activity: 'Coding',
          context: 'Working on tests',
          keyPoints: ['Writing unit tests'],
        };

        act(() => {
          result.current.updateScreenshotAnalysis('screenshot-1', analysis, 'completed');
        });

        const updatedScreenshot = result.current.activeSession?.screenshots[0];
        expect(updatedScreenshot?.aiAnalysis).toEqual(analysis);
        expect(updatedScreenshot?.analysisStatus).toBe('completed');
      });

      it('should set analysis error when provided', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        const screenshot: SessionScreenshot = {
          id: 'screenshot-1',
          timestamp: new Date().toISOString(),
          attachmentId: 'attachment-1',
        };

        await act(async () => {
          await result.current.addScreenshot(screenshot);
        });

        act(() => {
          result.current.updateScreenshotAnalysis(
            'screenshot-1',
            undefined,
            'failed',
            'Analysis failed: API error'
          );
        });

        const updatedScreenshot = result.current.activeSession?.screenshots[0];
        expect(updatedScreenshot?.analysisStatus).toBe('failed');
        expect(updatedScreenshot?.analysisError).toBe('Analysis failed: API error');
      });

      it('should warn when updating screenshot without active session', () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        act(() => {
          result.current.updateScreenshotAnalysis('screenshot-1', undefined, 'completed');
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Cannot update screenshot analysis: no active session')
        );

        consoleWarn.mockRestore();
      });
    });

    describe('addScreenshotComment', () => {
      it('should add comment to screenshot', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        const screenshot: SessionScreenshot = {
          id: 'screenshot-1',
          timestamp: new Date().toISOString(),
          attachmentId: 'attachment-1',
        };

        await act(async () => {
          await result.current.addScreenshot(screenshot);
        });

        act(() => {
          result.current.addScreenshotComment('screenshot-1', 'Important bug found here');
        });

        const updatedScreenshot = result.current.activeSession?.screenshots[0];
        expect(updatedScreenshot?.userComment).toBe('Important bug found here');
      });

      it('should warn when adding comment without active session', () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        act(() => {
          result.current.addScreenshotComment('screenshot-1', 'Comment');
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Cannot add comment: no active session')
        );

        consoleWarn.mockRestore();
      });
    });

    describe('toggleScreenshotFlag', () => {
      it('should toggle screenshot flag from false to true', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        const screenshot: SessionScreenshot = {
          id: 'screenshot-1',
          timestamp: new Date().toISOString(),
          attachmentId: 'attachment-1',
          flagged: false,
        };

        await act(async () => {
          await result.current.addScreenshot(screenshot);
        });

        act(() => {
          result.current.toggleScreenshotFlag('screenshot-1');
        });

        expect(result.current.activeSession?.screenshots[0].flagged).toBe(true);
      });

      it('should toggle screenshot flag from true to false', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        const screenshot: SessionScreenshot = {
          id: 'screenshot-1',
          timestamp: new Date().toISOString(),
          attachmentId: 'attachment-1',
          flagged: true,
        };

        await act(async () => {
          await result.current.addScreenshot(screenshot);
        });

        act(() => {
          result.current.toggleScreenshotFlag('screenshot-1');
        });

        expect(result.current.activeSession?.screenshots[0].flagged).toBe(false);
      });

      it('should warn when toggling flag without active session', () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        act(() => {
          result.current.toggleScreenshotFlag('screenshot-1');
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Cannot toggle flag: no active session')
        );

        consoleWarn.mockRestore();
      });
    });
  });

  describe('Audio Management', () => {
    describe('addAudioSegment', () => {
      it('should append audio segment to active session', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'microphone',
          });
        });

        const audioSegment: SessionAudioSegment = {
          id: 'audio-1',
          timestamp: new Date().toISOString(),
          duration: 30000,
          attachmentId: 'audio-attachment-1',
        };

        await act(async () => {
          await result.current.addAudioSegment(audioSegment);
        });

        expect(result.current.activeSession?.audioSegments).toHaveLength(1);
        expect(result.current.activeSession?.audioSegments?.[0].id).toBe('audio-1');
      });

      it('should save audio segment to chunked storage', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'microphone',
          });
        });

        const audioSegment: SessionAudioSegment = {
          id: 'audio-1',
          timestamp: new Date().toISOString(),
          duration: 30000,
          attachmentId: 'audio-attachment-1',
        };

        await act(async () => {
          await result.current.addAudioSegment(audioSegment);
        });

        expect(mockAppendAudioSegment).toHaveBeenCalledWith('generated-id-123', audioSegment);
      });

      it('should prevent duplicate audio segments', async () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'microphone',
          });
        });

        const audioSegment: SessionAudioSegment = {
          id: 'audio-1',
          timestamp: new Date().toISOString(),
          duration: 30000,
          attachmentId: 'audio-attachment-1',
        };

        await act(async () => {
          await result.current.addAudioSegment(audioSegment);
        });

        // Try to add same segment again
        await act(async () => {
          await result.current.addAudioSegment(audioSegment);
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          '[ActiveSessionContext] Duplicate audio segment detected:',
          'audio-1'
        );
        expect(result.current.activeSession?.audioSegments).toHaveLength(1);

        consoleWarn.mockRestore();
      });

      it('should warn when adding audio without active session', async () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        const audioSegment: SessionAudioSegment = {
          id: 'audio-1',
          timestamp: new Date().toISOString(),
          duration: 30000,
          attachmentId: 'audio-attachment-1',
        };

        await act(async () => {
          await result.current.addAudioSegment(audioSegment);
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Cannot add audio: no active session')
        );

        consoleWarn.mockRestore();
      });

      it('should handle storage error when appending audio', async () => {
        mockAppendAudioSegment.mockRejectedValueOnce(new Error('Storage error'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'microphone',
          });
        });

        const audioSegment: SessionAudioSegment = {
          id: 'audio-1',
          timestamp: new Date().toISOString(),
          duration: 30000,
          attachmentId: 'audio-attachment-1',
        };

        await expect(async () => {
          await act(async () => {
            await result.current.addAudioSegment(audioSegment);
          });
        }).rejects.toThrow('Storage error');

        consoleError.mockRestore();
      });
    });

    describe('deleteAudioSegmentFile', () => {
      it('should clear filePath from audio segment', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'microphone',
          });
        });

        const audioSegment: SessionAudioSegment = {
          id: 'audio-1',
          timestamp: new Date().toISOString(),
          duration: 30000,
          attachmentId: 'audio-attachment-1',
          filePath: '/path/to/audio.wav',
        };

        await act(async () => {
          await result.current.addAudioSegment(audioSegment);
        });

        act(() => {
          result.current.deleteAudioSegmentFile('audio-1');
        });

        const updatedSegment = result.current.activeSession?.audioSegments?.[0];
        expect(updatedSegment?.filePath).toBeUndefined();
        expect(updatedSegment?.id).toBe('audio-1');
      });

      it('should only affect specified audio segment', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'microphone',
          });
        });

        const audioSegment1: SessionAudioSegment = {
          id: 'audio-1',
          timestamp: new Date().toISOString(),
          duration: 30000,
          attachmentId: 'audio-attachment-1',
          filePath: '/path/to/audio1.wav',
        };

        const audioSegment2: SessionAudioSegment = {
          id: 'audio-2',
          timestamp: new Date().toISOString(),
          duration: 30000,
          attachmentId: 'audio-attachment-2',
          filePath: '/path/to/audio2.wav',
        };

        await act(async () => {
          await result.current.addAudioSegment(audioSegment1);
        });

        await act(async () => {
          await result.current.addAudioSegment(audioSegment2);
        });

        act(() => {
          result.current.deleteAudioSegmentFile('audio-1');
        });

        const segments = result.current.activeSession?.audioSegments || [];
        expect(segments).toHaveLength(2);
        expect(segments[0].filePath).toBeUndefined();
        expect(segments[1].filePath).toBe('/path/to/audio2.wav');
      });

      it('should warn when deleting audio file without active session', () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        act(() => {
          result.current.deleteAudioSegmentFile('audio-1');
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Cannot delete audio file: no active session')
        );

        consoleWarn.mockRestore();
      });
    });
  });

  describe('Session Updates', () => {
    describe('updateActiveSession', () => {
      it('should update active session with partial updates', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: 'Original description',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        act(() => {
          result.current.updateActiveSession({
            description: 'Updated description',
            tags: ['tag1', 'tag2'],
          });
        });

        expect(result.current.activeSession?.description).toBe('Updated description');
        expect(result.current.activeSession?.tags).toEqual(['tag1', 'tag2']);
        expect(result.current.activeSession?.name).toBe('Test Session'); // Unchanged
      });

      it('should warn when updating without active session', () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        act(() => {
          result.current.updateActiveSession({ description: 'New description' });
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Cannot update: no active session')
        );

        consoleWarn.mockRestore();
      });
    });

    describe('addExtractedTask', () => {
      it('should add task ID to extractedTaskIds', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        act(() => {
          result.current.addExtractedTask('task-1');
        });

        expect(result.current.activeSession?.extractedTaskIds).toContain('task-1');
      });

      it('should allow multiple task IDs', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        expect(result.current.activeSession).not.toBeNull();

        act(() => {
          result.current.addExtractedTask('task-1');
        });

        act(() => {
          result.current.addExtractedTask('task-2');
        });

        expect(result.current.activeSession?.extractedTaskIds).toEqual(['task-1', 'task-2']);
      });

      it('should warn when adding task without active session', () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        act(() => {
          result.current.addExtractedTask('task-1');
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Cannot add task: no active session')
        );

        consoleWarn.mockRestore();
      });
    });

    describe('addExtractedNote', () => {
      it('should add note ID to extractedNoteIds', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        act(() => {
          result.current.addExtractedNote('note-1');
        });

        expect(result.current.activeSession?.extractedNoteIds).toContain('note-1');
      });

      it('should allow multiple note IDs', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        expect(result.current.activeSession).not.toBeNull();

        act(() => {
          result.current.addExtractedNote('note-1');
        });

        act(() => {
          result.current.addExtractedNote('note-2');
        });

        expect(result.current.activeSession?.extractedNoteIds).toEqual(['note-1', 'note-2']);
      });

      it('should warn when adding note without active session', () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        act(() => {
          result.current.addExtractedNote('note-1');
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Cannot add note: no active session')
        );

        consoleWarn.mockRestore();
      });
    });

    describe('addContextItem', () => {
      it('should add context item to session', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        const contextItem = {
          type: 'note' as const,
          id: 'note-1',
          timestamp: new Date().toISOString(),
        };

        act(() => {
          result.current.addContextItem(contextItem);
        });

        expect(result.current.activeSession?.contextItems).toContainEqual(contextItem);
      });

      it('should allow multiple context items', async () => {
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        await act(async () => {
          await result.current.startSession({
            name: 'Test Session',
            description: '',
            tags: [],
            screenshotInterval: 60000,
            autoAnalysis: false,
            enableScreenshots: true,
            audioMode: 'none',
          });
        });

        expect(result.current.activeSession).not.toBeNull();

        const item1 = {
          type: 'note' as const,
          id: 'note-1',
          timestamp: new Date().toISOString(),
        };

        const item2 = {
          type: 'task' as const,
          id: 'task-1',
          timestamp: new Date().toISOString(),
        };

        act(() => {
          result.current.addContextItem(item1);
        });

        act(() => {
          result.current.addContextItem(item2);
        });

        expect(result.current.activeSession?.contextItems).toHaveLength(2);
      });

      it('should warn when adding context item without active session', () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useActiveSession(), { wrapper });

        const contextItem = {
          type: 'note' as const,
          id: 'note-1',
          timestamp: new Date().toISOString(),
        };

        act(() => {
          result.current.addContextItem(contextItem);
        });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Cannot add context item: no active session')
        );

        consoleWarn.mockRestore();
      });
    });
  });

  describe('Session Syncing', () => {
    it('should sync active session changes to SessionListContext', async () => {
      const { result } = renderHook(() => useActiveSession(), { wrapper });

      await act(async () => {
        await result.current.startSession({
          name: 'Test Session',
          description: '',
          tags: [],
          screenshotInterval: 60000,
          autoAnalysis: false,
          enableScreenshots: true,
          audioMode: 'none',
        });
      });

      // Clear previous calls
      mockUpdateSession.mockClear();

      // Update the session
      act(() => {
        result.current.updateActiveSession({ description: 'New description' });
      });

      // Fast-forward past debounce timeout (1000ms)
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockUpdateSession).toHaveBeenCalledWith(
        'generated-id-123',
        expect.objectContaining({ description: 'New description' })
      );
    });

    it('should debounce session updates to avoid excessive writes', async () => {
      const { result } = renderHook(() => useActiveSession(), { wrapper });

      await act(async () => {
        await result.current.startSession({
          name: 'Test Session',
          description: '',
          tags: [],
          screenshotInterval: 60000,
          autoAnalysis: false,
          enableScreenshots: true,
          audioMode: 'none',
        });
      });

      mockUpdateSession.mockClear();

      // Make multiple rapid updates
      act(() => {
        result.current.updateActiveSession({ description: 'Update 1' });
      });

      act(() => {
        result.current.updateActiveSession({ description: 'Update 2' });
      });

      act(() => {
        result.current.updateActiveSession({ description: 'Update 3' });
      });

      // Before timeout, no updates should be sent
      expect(mockUpdateSession).not.toHaveBeenCalled();

      // Fast-forward past debounce timeout
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should only update once with final value
      expect(mockUpdateSession).toHaveBeenCalledTimes(1);
      expect(mockUpdateSession).toHaveBeenCalledWith(
        'generated-id-123',
        expect.objectContaining({ description: 'Update 3' })
      );
    });

    it('should not sync paused or completed sessions', async () => {
      const { result } = renderHook(() => useActiveSession(), { wrapper });

      await act(async () => {
        await result.current.startSession({
          name: 'Test Session',
          description: '',
          tags: [],
          screenshotInterval: 60000,
          autoAnalysis: false,
          enableScreenshots: true,
          audioMode: 'none',
        });
      });

      mockUpdateSession.mockClear();

      // Pause session
      act(() => {
        result.current.pauseSession();
      });

      // Update while paused
      act(() => {
        result.current.updateActiveSession({ description: 'Update while paused' });
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should not sync paused sessions
      expect(mockUpdateSession).not.toHaveBeenCalled();
    });
  });
});
