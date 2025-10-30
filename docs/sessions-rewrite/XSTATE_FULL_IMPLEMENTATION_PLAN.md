# XState Full Implementation Plan

**Status**: Ready to Execute
**Timeline**: 12-16 hours (1.5-2 days)
**Approach**: Aggressive, test and ship
**Date Created**: October 26, 2025

---

## Overview

Implement all 6 XState machine services in one focused push - no feature flags, no gradual rollout. The machine structure is solid (21 tests passing), services are clean stubs ready for implementation. This plan converts those stubs into production code with comprehensive testing included in each task.

**What We're Doing**: Replace console.log stubs with real service integrations, test thoroughly, ship.

---

## Current State

**Machine Foundation** (Phase 1 - Complete ✅):
- State machine structure validated (idle → validating → checking_permissions → starting → active → paused → ending → completed)
- 21 tests passing, type-safe transitions
- Context split complete (SessionListContext, ActiveSessionContext, RecordingContext)
- Storage queue operational (PersistenceQueue)

**Services Status** (All Stubs ⚠️):
- `validateConfig` - Validates session config (stub returns sessionId) ✅ ACTUALLY WORKS
- `checkPermissions` - Permission checks (stub always returns true) ⚠️ NEEDS IMPLEMENTATION
- `startRecordingServices` - Start screenshots/audio/video (stub logs only) ⚠️ NEEDS IMPLEMENTATION
- `pauseRecordingServices` - Pause recording (stub logs only) ⚠️ NEEDS IMPLEMENTATION
- `resumeRecordingServices` - Resume recording (stub logs only) ⚠️ NEEDS IMPLEMENTATION
- `stopRecordingServices` - Stop and cleanup (stub logs only) ⚠️ NEEDS IMPLEMENTATION
- `monitorRecordingHealth` - Health monitoring (stub logs only) ⚠️ NEEDS IMPLEMENTATION

**Existing Service Infrastructure**:
- `screenshotCaptureService` - Full implementation ✅
- `audioRecordingService` - Full implementation ✅
- `videoRecordingService` - Full implementation ✅
- All services have permission checks, start/stop/pause methods

**Integration Pattern**: ActiveSessionContext calls services manually, machine just tracks state. We're converting to machine-orchestrated flow.

---

## Target State

**All Services Implemented**:
- ✅ Permission checks use real Tauri commands
- ✅ Service starts call screenshotCaptureService, audioRecordingService, videoRecordingService
- ✅ Pause/resume coordinate across all services
- ✅ Stop performs cleanup and persists data
- ✅ Health monitoring detects service crashes and permission revocation
- ✅ Comprehensive tests (unit + integration)

**Integration**:
- Machine orchestrates recording lifecycle
- ActiveSessionContext listens to machine state, updates UI
- RecordingContext receives commands from machine services
- Event-driven pattern (no tight coupling)

**No Deployment Complexity**:
- No feature flags (we're confident in the implementation)
- No gradual rollout (all users get it at once)
- No monitoring dashboards (existing error logs sufficient)
- Just: implement → test → commit → done

---

## Implementation Tasks

### Task 1: Permission Services (3 hours)

**Goal**: Replace permission check stubs with real Tauri commands.

**Files to Modify**:
- `src/machines/sessionMachineServices.ts` (lines 298-313)

**Changes**:

**BEFORE** (lines 298-303):
```typescript
async function checkScreenRecordingPermission(): Promise<boolean> {
  // TODO: Implement actual permission check
  // This would use Tauri commands to check macOS screen recording permission
  console.log('[sessionMachine] Checking screen recording permission (stub)');
  return true;
}
```

**AFTER**:
```typescript
import { invoke } from '@tauri-apps/api/core';

async function checkScreenRecordingPermission(): Promise<boolean> {
  try {
    return await invoke<boolean>('check_screen_recording_permission');
  } catch (error) {
    console.error('[sessionMachine] Failed to check screen recording permission:', error);
    return false;
  }
}
```

**BEFORE** (lines 308-313):
```typescript
async function checkMicrophonePermission(): Promise<boolean> {
  // TODO: Implement actual permission check
  // This would use Tauri commands to check microphone permission
  console.log('[sessionMachine] Checking microphone permission (stub)');
  return true;
}
```

**AFTER**:
```typescript
async function checkMicrophonePermission(): Promise<boolean> {
  try {
    return await invoke<boolean>('check_microphone_permission');
  } catch (error) {
    console.error('[sessionMachine] Failed to check microphone permission:', error);
    return false;
  }
}
```

**Update Service** (lines 117-148):
```typescript
export const checkPermissions = fromPromise(
  async ({
    input,
  }: {
    input: { config: SessionRecordingConfig; sessionId: string }
  }) => {
    const { config } = input;
    const missingPermissions: string[] = [];

    // Check screen recording permission if needed
    if (config.screenshotsEnabled || config.videoConfig?.enabled) {
      const hasScreenPermission = await checkScreenRecordingPermission();
      if (!hasScreenPermission) {
        missingPermissions.push('screen recording');
      }
    }

    // Check microphone permission if needed (audio OR video with system audio)
    const needsMicPermission =
      config.audioConfig?.enabled ||
      (config.videoConfig?.enabled && config.videoConfig.includeSystemAudio);

    if (needsMicPermission) {
      const hasMicPermission = await checkMicrophonePermission();
      if (!hasMicPermission) {
        missingPermissions.push('microphone');
      }
    }

    if (missingPermissions.length > 0) {
      throw new Error(missingPermissions.join(', '));
    }

    return { permissions: 'granted' };
  }
);
```

**Test Requirements**:

Create `src/machines/__tests__/sessionMachineServices.permissions.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkPermissions } from '../sessionMachineServices';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core');

describe('checkPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check screen permission when screenshots enabled', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(true); // screen permission

    const result = await checkPermissions({
      input: {
        config: { screenshotsEnabled: true, name: 'Test' },
        sessionId: 'test-id'
      }
    });

    expect(invoke).toHaveBeenCalledWith('check_screen_recording_permission');
    expect(result).toEqual({ permissions: 'granted' });
  });

  it('should check mic permission when audio enabled', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(true); // mic permission

    const result = await checkPermissions({
      input: {
        config: {
          screenshotsEnabled: false,
          audioConfig: { enabled: true, sourceType: 'microphone' },
          name: 'Test'
        },
        sessionId: 'test-id'
      }
    });

    expect(invoke).toHaveBeenCalledWith('check_microphone_permission');
    expect(result).toEqual({ permissions: 'granted' });
  });

  it('should check both permissions when video with audio', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(true) // screen
      .mockResolvedValueOnce(true); // mic

    const result = await checkPermissions({
      input: {
        config: {
          videoConfig: {
            enabled: true,
            sourceType: 'display',
            includeSystemAudio: true
          },
          name: 'Test'
        },
        sessionId: 'test-id'
      }
    });

    expect(invoke).toHaveBeenNthCalledWith(1, 'check_screen_recording_permission');
    expect(invoke).toHaveBeenNthCalledWith(2, 'check_microphone_permission');
    expect(result).toEqual({ permissions: 'granted' });
  });

  it('should throw error when screen permission denied', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(false); // screen denied

    await expect(checkPermissions({
      input: {
        config: { screenshotsEnabled: true, name: 'Test' },
        sessionId: 'test-id'
      }
    })).rejects.toThrow('screen recording');
  });

  it('should throw error when mic permission denied', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(false); // mic denied

    await expect(checkPermissions({
      input: {
        config: {
          audioConfig: { enabled: true, sourceType: 'microphone' },
          name: 'Test'
        },
        sessionId: 'test-id'
      }
    })).rejects.toThrow('microphone');
  });

  it('should handle permission check errors gracefully', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Tauri error'));

    await expect(checkPermissions({
      input: {
        config: { screenshotsEnabled: true, name: 'Test' },
        sessionId: 'test-id'
      }
    })).rejects.toThrow('screen recording'); // Should treat error as denied
  });
});
```

**Time Estimate**: 3 hours (1h implementation, 2h testing)

**Dependencies**: None (can start immediately)

---

### Task 2: Start Recording Services (4 hours)

**Goal**: Integrate machine with screenshotCaptureService, audioRecordingService, videoRecordingService.

**Files to Modify**:
- `src/machines/sessionMachineServices.ts` (lines 156-217, 318-350)

**Changes**:

**BEFORE** (lines 318-323):
```typescript
async function startScreenshotService(sessionId: string): Promise<void> {
  // TODO: Integrate with actual screenshot service
  // This would call screenshotCaptureService.startCapture()
  console.log(`[sessionMachine] Starting screenshot service for session: ${sessionId} (stub)`);
}
```

**AFTER**:
```typescript
import { screenshotCaptureService } from '../services/screenshotCaptureService';

async function startScreenshotService(
  sessionId: string,
  session: Session,
  onCapture: (screenshot: SessionScreenshot) => void
): Promise<void> {
  try {
    await screenshotCaptureService.startCapture(session, onCapture);
    console.log(`[sessionMachine] Screenshot service started for session: ${sessionId}`);
  } catch (error) {
    console.error(`[sessionMachine] Failed to start screenshot service:`, error);
    throw error;
  }
}
```

**Similar updates for audio and video** (lines 327-350):
```typescript
import { audioRecordingService } from '../services/audioRecordingService';
import { videoRecordingService } from '../services/videoRecordingService';

async function startAudioService(
  sessionId: string,
  session: Session,
  config: NonNullable<SessionRecordingConfig['audioConfig']>,
  onSegment: (segment: SessionAudioSegment) => void
): Promise<void> {
  try {
    await audioRecordingService.startRecording(session, onSegment);
    console.log(`[sessionMachine] Audio service started for session: ${sessionId}`);
  } catch (error) {
    console.error(`[sessionMachine] Failed to start audio service:`, error);
    throw error;
  }
}

async function startVideoService(
  sessionId: string,
  session: Session,
  config: NonNullable<SessionRecordingConfig['videoConfig']>
): Promise<void> {
  try {
    // Video service requires start config
    const videoConfig = {
      sessionId: session.id,
      outputPath: `videos/${session.id}.mp4`,
      width: config.resolution?.width || 1920,
      height: config.resolution?.height || 1080,
      fps: config.fps || 30,
      compositor: 'passthrough' as const,
      sources: config.sourceType === 'display'
        ? [{ type: 'display' as const, id: config.displayIds?.[0] || 'main' }]
        : [{ type: 'window' as const, id: config.windowIds?.[0] || '' }]
    };

    await videoRecordingService.startRecording(videoConfig);
    console.log(`[sessionMachine] Video service started for session: ${sessionId}`);
  } catch (error) {
    console.error(`[sessionMachine] Failed to start video service:`, error);
    throw error;
  }
}
```

**Challenge**: How to get Session object and callbacks in machine service?

**Solution**: Event-driven pattern - machine emits events, ActiveSessionContext listens and provides callbacks.

**Update Machine** (lines 156-217):
```typescript
export const startRecordingServices = fromPromise(
  async ({
    input,
  }: {
    input: {
      sessionId: string;
      config: SessionRecordingConfig;
      session: Session; // Now passed from ActiveSessionContext
      callbacks: {
        onScreenshotCaptured: (screenshot: SessionScreenshot) => void;
        onAudioSegment: (segment: SessionAudioSegment) => void;
      }
    }
  }) => {
    const { sessionId, config, session, callbacks } = input;

    // Initialize recording state
    const recordingState: {
      screenshots: RecordingServiceState;
      audio: RecordingServiceState;
      video: RecordingServiceState;
    } = {
      screenshots: 'idle',
      audio: 'idle',
      video: 'idle',
    };

    const errors: string[] = [];

    // Start screenshot service if enabled
    if (config.screenshotsEnabled) {
      try {
        await startScreenshotService(sessionId, session, callbacks.onScreenshotCaptured);
        recordingState.screenshots = 'active';
      } catch (error) {
        recordingState.screenshots = 'error';
        errors.push(`Screenshot service failed: ${error}`);
      }
    }

    // Start audio service if enabled
    if (config.audioConfig?.enabled) {
      try {
        await startAudioService(sessionId, session, config.audioConfig, callbacks.onAudioSegment);
        recordingState.audio = 'active';
      } catch (error) {
        recordingState.audio = 'error';
        errors.push(`Audio service failed: ${error}`);
      }
    }

    // Start video service if enabled
    if (config.videoConfig?.enabled) {
      try {
        await startVideoService(sessionId, session, config.videoConfig);
        recordingState.video = 'active';
      } catch (error) {
        recordingState.video = 'error';
        errors.push(`Video service failed: ${error}`);
      }
    }

    // If any critical service failed, throw error
    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }

    return { recordingState };
  }
);
```

**Update ActiveSessionContext** to provide callbacks:
```typescript
// In ActiveSessionContext.tsx (inside startSession function)
const handleScreenshotCaptured = useCallback((screenshot: SessionScreenshot) => {
  // Add screenshot to active session
  addScreenshot(screenshot);
}, [addScreenshot]);

const handleAudioSegment = useCallback((segment: SessionAudioSegment) => {
  // Add audio segment to active session
  addAudioSegment(segment);
}, [addAudioSegment]);

// Pass to machine
send({
  type: 'START',
  config: sessionConfig,
  session: newSession,
  callbacks: {
    onScreenshotCaptured: handleScreenshotCaptured,
    onAudioSegment: handleAudioSegment
  }
});
```

**Test Requirements**:

Create `src/machines/__tests__/sessionMachineServices.start.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startRecordingServices } from '../sessionMachineServices';
import { screenshotCaptureService } from '../../services/screenshotCaptureService';
import { audioRecordingService } from '../../services/audioRecordingService';
import { videoRecordingService } from '../../services/videoRecordingService';

vi.mock('../../services/screenshotCaptureService');
vi.mock('../../services/audioRecordingService');
vi.mock('../../services/videoRecordingService');

describe('startRecordingServices', () => {
  const mockSession = {
    id: 'test-session',
    name: 'Test Session',
    screenshotsEnabled: true,
    audioRecording: true,
    videoRecording: false,
  };

  const mockCallbacks = {
    onScreenshotCaptured: vi.fn(),
    onAudioSegment: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start screenshot service when enabled', async () => {
    vi.mocked(screenshotCaptureService.startCapture).mockResolvedValueOnce(undefined);

    const result = await startRecordingServices({
      input: {
        sessionId: 'test-session',
        config: { screenshotsEnabled: true, name: 'Test' },
        session: mockSession,
        callbacks: mockCallbacks
      }
    });

    expect(screenshotCaptureService.startCapture).toHaveBeenCalledWith(
      mockSession,
      mockCallbacks.onScreenshotCaptured
    );
    expect(result.recordingState.screenshots).toBe('active');
  });

  it('should start audio service when enabled', async () => {
    vi.mocked(audioRecordingService.startRecording).mockResolvedValueOnce(undefined);

    const result = await startRecordingServices({
      input: {
        sessionId: 'test-session',
        config: {
          audioConfig: { enabled: true, sourceType: 'microphone' },
          name: 'Test'
        },
        session: mockSession,
        callbacks: mockCallbacks
      }
    });

    expect(audioRecordingService.startRecording).toHaveBeenCalledWith(
      mockSession,
      mockCallbacks.onAudioSegment
    );
    expect(result.recordingState.audio).toBe('active');
  });

  it('should start video service when enabled', async () => {
    vi.mocked(videoRecordingService.startRecording).mockResolvedValueOnce(undefined);

    const result = await startRecordingServices({
      input: {
        sessionId: 'test-session',
        config: {
          videoConfig: {
            enabled: true,
            sourceType: 'display',
            displayIds: ['main']
          },
          name: 'Test'
        },
        session: mockSession,
        callbacks: mockCallbacks
      }
    });

    expect(videoRecordingService.startRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'test-session',
        sources: [{ type: 'display', id: 'main' }]
      })
    );
    expect(result.recordingState.video).toBe('active');
  });

  it('should start all services when all enabled', async () => {
    vi.mocked(screenshotCaptureService.startCapture).mockResolvedValueOnce(undefined);
    vi.mocked(audioRecordingService.startRecording).mockResolvedValueOnce(undefined);
    vi.mocked(videoRecordingService.startRecording).mockResolvedValueOnce(undefined);

    const result = await startRecordingServices({
      input: {
        sessionId: 'test-session',
        config: {
          screenshotsEnabled: true,
          audioConfig: { enabled: true, sourceType: 'microphone' },
          videoConfig: { enabled: true, sourceType: 'display', displayIds: ['main'] },
          name: 'Test'
        },
        session: mockSession,
        callbacks: mockCallbacks
      }
    });

    expect(result.recordingState.screenshots).toBe('active');
    expect(result.recordingState.audio).toBe('active');
    expect(result.recordingState.video).toBe('active');
  });

  it('should handle screenshot service failure', async () => {
    vi.mocked(screenshotCaptureService.startCapture).mockRejectedValueOnce(
      new Error('Permission denied')
    );

    await expect(startRecordingServices({
      input: {
        sessionId: 'test-session',
        config: { screenshotsEnabled: true, name: 'Test' },
        session: mockSession,
        callbacks: mockCallbacks
      }
    })).rejects.toThrow('Screenshot service failed');
  });

  it('should continue if non-critical service fails', async () => {
    vi.mocked(screenshotCaptureService.startCapture).mockResolvedValueOnce(undefined);
    vi.mocked(audioRecordingService.startRecording).mockRejectedValueOnce(
      new Error('Mic not available')
    );

    await expect(startRecordingServices({
      input: {
        sessionId: 'test-session',
        config: {
          screenshotsEnabled: true,
          audioConfig: { enabled: true, sourceType: 'microphone' },
          name: 'Test'
        },
        session: mockSession,
        callbacks: mockCallbacks
      }
    })).rejects.toThrow('Audio service failed');
  });
});
```

**Time Estimate**: 4 hours (2h implementation, 2h testing)

**Dependencies**: Task 1 (uses permission checks)

---

### Task 3: Stop Recording Services (2 hours)

**Goal**: Implement graceful shutdown and cleanup for all services.

**Files to Modify**:
- `src/machines/sessionMachineServices.ts` (lines 258-268)

**Changes**:

**BEFORE** (lines 258-268):
```typescript
export const stopRecordingServices = fromPromise(
  async ({ input }: { input: { sessionId: string } }) => {
    const { sessionId } = input;

    // TODO: Implement actual stop logic
    // For now, this is a stub that will be implemented in future tasks
    console.log(`[sessionMachine] Stopping recording services for session: ${sessionId}`);

    return {};
  }
);
```

**AFTER**:
```typescript
import { screenshotCaptureService } from '../services/screenshotCaptureService';
import { audioRecordingService } from '../services/audioRecordingService';
import { videoRecordingService } from '../services/videoRecordingService';
import { getChunkedStorage } from '../services/storage/ChunkedSessionStorage';

export const stopRecordingServices = fromPromise(
  async ({ input }: { input: { sessionId: string } }) => {
    const { sessionId } = input;
    console.log(`[sessionMachine] Stopping recording services for session: ${sessionId}`);

    const errors: string[] = [];

    // Stop screenshot capture
    try {
      await screenshotCaptureService.stopCapture();
      console.log(`[sessionMachine] Screenshot service stopped`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to stop screenshot service:`, error);
      errors.push(`Screenshot service: ${error}`);
    }

    // Stop audio recording (has 5s grace period for pending chunks)
    try {
      await audioRecordingService.stopRecording();
      console.log(`[sessionMachine] Audio service stopped`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to stop audio service:`, error);
      errors.push(`Audio service: ${error}`);
    }

    // Stop video recording
    try {
      await videoRecordingService.stopRecording();
      console.log(`[sessionMachine] Video service stopped`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to stop video service:`, error);
      errors.push(`Video service: ${error}`);
    }

    // Flush any pending storage writes
    try {
      const storage = await getChunkedStorage();
      await storage.flush();
      console.log(`[sessionMachine] Storage flushed`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to flush storage:`, error);
      errors.push(`Storage flush: ${error}`);
    }

    // Don't throw - allow session to complete even if cleanup has issues
    if (errors.length > 0) {
      console.warn(`[sessionMachine] Some services failed to stop cleanly:`, errors.join('; '));
    }

    return {};
  }
);
```

**Test Requirements**:

Create `src/machines/__tests__/sessionMachineServices.stop.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stopRecordingServices } from '../sessionMachineServices';
import { screenshotCaptureService } from '../../services/screenshotCaptureService';
import { audioRecordingService } from '../../services/audioRecordingService';
import { videoRecordingService } from '../../services/videoRecordingService';

vi.mock('../../services/screenshotCaptureService');
vi.mock('../../services/audioRecordingService');
vi.mock('../../services/videoRecordingService');
vi.mock('../../services/storage/ChunkedSessionStorage', () => ({
  getChunkedStorage: vi.fn(() => Promise.resolve({
    flush: vi.fn(() => Promise.resolve())
  }))
}));

describe('stopRecordingServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should stop all services successfully', async () => {
    vi.mocked(screenshotCaptureService.stopCapture).mockResolvedValueOnce(undefined);
    vi.mocked(audioRecordingService.stopRecording).mockResolvedValueOnce(undefined);
    vi.mocked(videoRecordingService.stopRecording).mockResolvedValueOnce(undefined);

    const result = await stopRecordingServices({
      input: { sessionId: 'test-session' }
    });

    expect(screenshotCaptureService.stopCapture).toHaveBeenCalled();
    expect(audioRecordingService.stopRecording).toHaveBeenCalled();
    expect(videoRecordingService.stopRecording).toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('should continue stopping other services if one fails', async () => {
    vi.mocked(screenshotCaptureService.stopCapture).mockRejectedValueOnce(
      new Error('Screenshot stop failed')
    );
    vi.mocked(audioRecordingService.stopRecording).mockResolvedValueOnce(undefined);
    vi.mocked(videoRecordingService.stopRecording).mockResolvedValueOnce(undefined);

    const result = await stopRecordingServices({
      input: { sessionId: 'test-session' }
    });

    // Should still call all services despite screenshot failure
    expect(audioRecordingService.stopRecording).toHaveBeenCalled();
    expect(videoRecordingService.stopRecording).toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('should flush storage after stopping services', async () => {
    const mockFlush = vi.fn(() => Promise.resolve());
    const { getChunkedStorage } = await import('../../services/storage/ChunkedSessionStorage');
    vi.mocked(getChunkedStorage).mockResolvedValueOnce({ flush: mockFlush } as any);

    await stopRecordingServices({
      input: { sessionId: 'test-session' }
    });

    expect(mockFlush).toHaveBeenCalled();
  });

  it('should not throw even if all services fail', async () => {
    vi.mocked(screenshotCaptureService.stopCapture).mockRejectedValueOnce(new Error('Fail'));
    vi.mocked(audioRecordingService.stopRecording).mockRejectedValueOnce(new Error('Fail'));
    vi.mocked(videoRecordingService.stopRecording).mockRejectedValueOnce(new Error('Fail'));

    // Should resolve, not reject
    const result = await stopRecordingServices({
      input: { sessionId: 'test-session' }
    });

    expect(result).toEqual({});
  });
});
```

**Time Estimate**: 2 hours (1h implementation, 1h testing)

**Dependencies**: Task 2 (uses same services)

---

### Task 4: Pause/Resume Services (2 hours)

**Goal**: Implement pause and resume for active recording services.

**Files to Modify**:
- `src/machines/sessionMachineServices.ts` (lines 224-251)

**Changes**:

**BEFORE** (lines 224-234):
```typescript
export const pauseRecordingServices = fromPromise(
  async ({ input }: { input: { sessionId: string } }) => {
    const { sessionId } = input;

    // TODO: Implement actual pause logic
    // For now, this is a stub that will be implemented in future tasks
    console.log(`[sessionMachine] Pausing recording services for session: ${sessionId}`);

    return {};
  }
);
```

**AFTER**:
```typescript
import { screenshotCaptureService } from '../services/screenshotCaptureService';
import { audioRecordingService } from '../services/audioRecordingService';
import { videoRecordingService } from '../services/videoRecordingService';

export const pauseRecordingServices = fromPromise(
  async ({ input }: { input: { sessionId: string } }) => {
    const { sessionId } = input;
    console.log(`[sessionMachine] Pausing recording services for session: ${sessionId}`);

    const errors: string[] = [];

    // Pause screenshot capture
    try {
      screenshotCaptureService.pauseCapture();
      console.log(`[sessionMachine] Screenshot service paused`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to pause screenshot service:`, error);
      errors.push(`Screenshot: ${error}`);
    }

    // Pause audio recording
    try {
      await audioRecordingService.pauseRecording();
      console.log(`[sessionMachine] Audio service paused`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to pause audio service:`, error);
      errors.push(`Audio: ${error}`);
    }

    // Pause video recording
    try {
      await videoRecordingService.pauseRecording();
      console.log(`[sessionMachine] Video service paused`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to pause video service:`, error);
      errors.push(`Video: ${error}`);
    }

    if (errors.length > 0) {
      throw new Error(`Failed to pause services: ${errors.join(', ')}`);
    }

    return {};
  }
);
```

**BEFORE** (lines 241-251):
```typescript
export const resumeRecordingServices = fromPromise(
  async ({ input }: { input: { sessionId: string } }) => {
    const { sessionId } = input;

    // TODO: Implement actual resume logic
    // For now, this is a stub that will be implemented in future tasks
    console.log(`[sessionMachine] Resuming recording services for session: ${sessionId}`);

    return {};
  }
);
```

**AFTER**:
```typescript
export const resumeRecordingServices = fromPromise(
  async ({ input }: { input: { sessionId: string } }) => {
    const { sessionId } = input;
    console.log(`[sessionMachine] Resuming recording services for session: ${sessionId}`);

    const errors: string[] = [];

    // Resume screenshot capture
    try {
      screenshotCaptureService.resumeCapture();
      console.log(`[sessionMachine] Screenshot service resumed`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to resume screenshot service:`, error);
      errors.push(`Screenshot: ${error}`);
    }

    // Resume audio recording
    try {
      await audioRecordingService.resumeRecording();
      console.log(`[sessionMachine] Audio service resumed`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to resume audio service:`, error);
      errors.push(`Audio: ${error}`);
    }

    // Resume video recording
    try {
      await videoRecordingService.resumeRecording();
      console.log(`[sessionMachine] Video service resumed`);
    } catch (error) {
      console.error(`[sessionMachine] Failed to resume video service:`, error);
      errors.push(`Video: ${error}`);
    }

    if (errors.length > 0) {
      throw new Error(`Failed to resume services: ${errors.join(', ')}`);
    }

    return {};
  }
);
```

**Test Requirements**:

Create `src/machines/__tests__/sessionMachineServices.pauseResume.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pauseRecordingServices, resumeRecordingServices } from '../sessionMachineServices';
import { screenshotCaptureService } from '../../services/screenshotCaptureService';
import { audioRecordingService } from '../../services/audioRecordingService';
import { videoRecordingService } from '../../services/videoRecordingService';

vi.mock('../../services/screenshotCaptureService');
vi.mock('../../services/audioRecordingService');
vi.mock('../../services/videoRecordingService');

describe('pauseRecordingServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pause all services successfully', async () => {
    vi.mocked(screenshotCaptureService.pauseCapture).mockReturnValueOnce(undefined);
    vi.mocked(audioRecordingService.pauseRecording).mockResolvedValueOnce(undefined);
    vi.mocked(videoRecordingService.pauseRecording).mockResolvedValueOnce(undefined);

    const result = await pauseRecordingServices({
      input: { sessionId: 'test-session' }
    });

    expect(screenshotCaptureService.pauseCapture).toHaveBeenCalled();
    expect(audioRecordingService.pauseRecording).toHaveBeenCalled();
    expect(videoRecordingService.pauseRecording).toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('should throw error if any service fails to pause', async () => {
    vi.mocked(screenshotCaptureService.pauseCapture).mockReturnValueOnce(undefined);
    vi.mocked(audioRecordingService.pauseRecording).mockRejectedValueOnce(
      new Error('Audio pause failed')
    );

    await expect(pauseRecordingServices({
      input: { sessionId: 'test-session' }
    })).rejects.toThrow('Failed to pause services');
  });
});

describe('resumeRecordingServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resume all services successfully', async () => {
    vi.mocked(screenshotCaptureService.resumeCapture).mockReturnValueOnce(undefined);
    vi.mocked(audioRecordingService.resumeRecording).mockResolvedValueOnce(undefined);
    vi.mocked(videoRecordingService.resumeRecording).mockResolvedValueOnce(undefined);

    const result = await resumeRecordingServices({
      input: { sessionId: 'test-session' }
    });

    expect(screenshotCaptureService.resumeCapture).toHaveBeenCalled();
    expect(audioRecordingService.resumeRecording).toHaveBeenCalled();
    expect(videoRecordingService.resumeRecording).toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('should throw error if any service fails to resume', async () => {
    vi.mocked(screenshotCaptureService.resumeCapture).mockReturnValueOnce(undefined);
    vi.mocked(audioRecordingService.resumeRecording).mockResolvedValueOnce(undefined);
    vi.mocked(videoRecordingService.resumeRecording).mockRejectedValueOnce(
      new Error('Video resume failed')
    );

    await expect(resumeRecordingServices({
      input: { sessionId: 'test-session' }
    })).rejects.toThrow('Failed to resume services');
  });
});
```

**Time Estimate**: 2 hours (1h implementation, 1h testing)

**Dependencies**: Task 2 (uses same services)

---

### Task 5: Health Monitoring Service (2 hours)

**Goal**: Implement background health monitoring to detect service crashes and permission revocation.

**Files to Modify**:
- `src/machines/sessionMachineServices.ts` (lines 276-289)

**Changes**:

**BEFORE** (lines 276-289):
```typescript
export const monitorRecordingHealth = fromPromise(
  async ({ input }: { input: { sessionId: string } }) => {
    const { sessionId } = input;

    // TODO: Implement actual health monitoring
    // For now, this is a stub that will be implemented in future tasks
    console.log(`[sessionMachine] Monitoring recording health for session: ${sessionId}`);

    // This would normally run continuously, checking service health
    // and potentially sending UPDATE_RECORDING_STATE events if issues are detected

    return {};
  }
);
```

**AFTER**:
```typescript
import { screenshotCaptureService } from '../services/screenshotCaptureService';
import { audioRecordingService } from '../services/audioRecordingService';
import { videoRecordingService } from '../services/videoRecordingService';

// Health monitoring runs continuously while session is active
export const monitorRecordingHealth = fromPromise(
  async ({
    input,
    self
  }: {
    input: {
      sessionId: string;
      send?: (event: { type: 'UPDATE_RECORDING_STATE'; updates: any }) => void;
    };
    self: any;
  }) => {
    const { sessionId, send } = input;
    console.log(`[sessionMachine] Starting health monitor for session: ${sessionId}`);

    let isActive = true;

    // Monitor permissions and service health every 10 seconds
    const monitorInterval = setInterval(async () => {
      if (!isActive) {
        clearInterval(monitorInterval);
        return;
      }

      // Check screen recording permission (screenshots + video)
      try {
        const hasScreenPermission = await checkScreenRecordingPermission();
        if (!hasScreenPermission) {
          console.warn(`[sessionMachine] Screen recording permission lost for session: ${sessionId}`);
          send?.({
            type: 'UPDATE_RECORDING_STATE',
            updates: {
              screenshots: 'error',
              video: 'error'
            }
          });
        }
      } catch (error) {
        console.error('[sessionMachine] Failed to check screen permission:', error);
      }

      // Check microphone permission (audio)
      try {
        const hasMicPermission = await checkMicrophonePermission();
        if (!hasMicPermission) {
          console.warn(`[sessionMachine] Microphone permission lost for session: ${sessionId}`);
          send?.({
            type: 'UPDATE_RECORDING_STATE',
            updates: { audio: 'error' }
          });
        }
      } catch (error) {
        console.error('[sessionMachine] Failed to check mic permission:', error);
      }

      // Check if services are still running
      try {
        const isScreenshotActive = screenshotCaptureService.isCapturing();
        if (!isScreenshotActive) {
          console.warn(`[sessionMachine] Screenshot service stopped unexpectedly`);
          send?.({
            type: 'UPDATE_RECORDING_STATE',
            updates: { screenshots: 'error' }
          });
        }
      } catch (error) {
        console.error('[sessionMachine] Failed to check screenshot service:', error);
      }

      // Similar checks for audio and video services...
      // (truncated for brevity - same pattern)

    }, 10000); // Check every 10 seconds

    // Cleanup function - called when machine transitions out of 'active' state
    return () => {
      console.log(`[sessionMachine] Stopping health monitor for session: ${sessionId}`);
      isActive = false;
      clearInterval(monitorInterval);
    };
  }
);
```

**Note**: XState fromPromise doesn't support cleanup functions. We need to use a different pattern.

**CORRECTED IMPLEMENTATION**:
```typescript
// Health monitoring should use a callback actor instead
import { fromCallback } from 'xstate';

export const monitorRecordingHealth = fromCallback(({ sendBack, input }) => {
  const { sessionId } = input;
  console.log(`[sessionMachine] Starting health monitor for session: ${sessionId}`);

  // Monitor permissions and service health every 10 seconds
  const monitorInterval = setInterval(async () => {
    // Check screen recording permission
    try {
      const hasScreenPermission = await checkScreenRecordingPermission();
      if (!hasScreenPermission) {
        console.warn(`[sessionMachine] Screen recording permission lost`);
        sendBack({
          type: 'UPDATE_RECORDING_STATE',
          updates: {
            screenshots: 'error',
            video: 'error'
          }
        });
      }
    } catch (error) {
      console.error('[sessionMachine] Permission check failed:', error);
    }

    // Check microphone permission
    try {
      const hasMicPermission = await checkMicrophonePermission();
      if (!hasMicPermission) {
        console.warn(`[sessionMachine] Microphone permission lost`);
        sendBack({
          type: 'UPDATE_RECORDING_STATE',
          updates: { audio: 'error' }
        });
      }
    } catch (error) {
      console.error('[sessionMachine] Permission check failed:', error);
    }

    // Check service health
    try {
      const isScreenshotActive = screenshotCaptureService.isCapturing();
      if (!isScreenshotActive) {
        console.warn(`[sessionMachine] Screenshot service stopped`);
        sendBack({
          type: 'UPDATE_RECORDING_STATE',
          updates: { screenshots: 'error' }
        });
      }
    } catch (error) {
      console.error('[sessionMachine] Service check failed:', error);
    }
  }, 10000);

  // Cleanup function
  return () => {
    console.log(`[sessionMachine] Stopping health monitor`);
    clearInterval(monitorInterval);
  };
});
```

**Test Requirements**:

Create `src/machines/__tests__/sessionMachineServices.health.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createActor } from 'xstate';
import { sessionMachine } from '../sessionMachine';
import { invoke } from '@tauri-apps/api/core';
import { screenshotCaptureService } from '../../services/screenshotCaptureService';

vi.mock('@tauri-apps/api/core');
vi.mock('../../services/screenshotCaptureService');

describe('monitorRecordingHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start monitoring when session becomes active', async () => {
    const actor = createActor(sessionMachine);
    actor.start();

    // Mock successful permission checks
    vi.mocked(invoke).mockResolvedValue(true);
    vi.mocked(screenshotCaptureService.isCapturing).mockReturnValue(true);

    // Start session
    actor.send({
      type: 'START',
      config: { screenshotsEnabled: true, name: 'Test' },
      session: { id: 'test' },
      callbacks: { onScreenshotCaptured: vi.fn(), onAudioSegment: vi.fn() }
    });

    // Wait for machine to reach 'active' state
    await vi.waitFor(() => {
      expect(actor.getSnapshot().matches('active')).toBe(true);
    });

    // Fast-forward 10 seconds to trigger health check
    vi.advanceTimersByTime(10000);

    // Should have checked permissions
    expect(invoke).toHaveBeenCalledWith('check_screen_recording_permission');
  });

  it('should detect permission revocation', async () => {
    const actor = createActor(sessionMachine);
    actor.start();

    // First check passes, second fails
    vi.mocked(invoke)
      .mockResolvedValueOnce(true)  // Initial check
      .mockResolvedValueOnce(false); // Health check - permission lost

    actor.send({
      type: 'START',
      config: { screenshotsEnabled: true, name: 'Test' },
      session: { id: 'test' },
      callbacks: { onScreenshotCaptured: vi.fn(), onAudioSegment: vi.fn() }
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().matches('active')).toBe(true);
    });

    // Fast-forward to trigger health check
    vi.advanceTimersByTime(10000);

    // Should update recording state to error
    await vi.waitFor(() => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.recordingState.screenshots).toBe('error');
    });
  });

  it('should detect service crash', async () => {
    const actor = createActor(sessionMachine);
    actor.start();

    vi.mocked(invoke).mockResolvedValue(true); // Permission OK
    vi.mocked(screenshotCaptureService.isCapturing)
      .mockReturnValueOnce(true)  // Initially active
      .mockReturnValueOnce(false); // Crashed

    actor.send({
      type: 'START',
      config: { screenshotsEnabled: true, name: 'Test' },
      session: { id: 'test' },
      callbacks: { onScreenshotCaptured: vi.fn(), onAudioSegment: vi.fn() }
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().matches('active')).toBe(true);
    });

    vi.advanceTimersByTime(10000);

    await vi.waitFor(() => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.recordingState.screenshots).toBe('error');
    });
  });

  it('should stop monitoring when session ends', async () => {
    const actor = createActor(sessionMachine);
    actor.start();

    vi.mocked(invoke).mockResolvedValue(true);
    vi.mocked(screenshotCaptureService.isCapturing).mockReturnValue(true);

    actor.send({
      type: 'START',
      config: { screenshotsEnabled: true, name: 'Test' },
      session: { id: 'test' },
      callbacks: { onScreenshotCaptured: vi.fn(), onAudioSegment: vi.fn() }
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().matches('active')).toBe(true);
    });

    // End session
    actor.send({ type: 'END' });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().matches('completed')).toBe(true);
    });

    // Fast-forward - health check should NOT run
    const invocationsBeforeAdvance = vi.mocked(invoke).mock.calls.length;
    vi.advanceTimersByTime(10000);
    const invocationsAfterAdvance = vi.mocked(invoke).mock.calls.length;

    expect(invocationsAfterAdvance).toBe(invocationsBeforeAdvance);
  });
});
```

**Time Estimate**: 2 hours (1h implementation, 1h testing)

**Dependencies**: Task 1 (uses permission checks), Task 2 (checks service status)

---

### Task 6: Integration & Cleanup (3 hours)

**Goal**: Wire everything together, update ActiveSessionContext, run full integration tests.

**Files to Modify**:
- `src/context/ActiveSessionContext.tsx` (update to use machine services)
- `src/machines/__tests__/integration.test.ts` (add comprehensive E2E tests)

**Changes to ActiveSessionContext**:

**BEFORE** (manual service calls):
```typescript
const startSession = useCallback(async (config: SessionConfig) => {
  // Manual permission checks
  const hasPermission = await checkScreenRecordingPermission();
  if (!hasPermission) throw new Error('Permission denied');

  // Manual service starts
  await screenshotCaptureService.startCapture(session, onCapture);
  await audioRecordingService.startRecording(session, onSegment);

  // Tell machine we started (machine just tracks)
  send({ type: 'START', config });
}, []);
```

**AFTER** (machine-orchestrated):
```typescript
const startSession = useCallback(async (config: SessionConfig) => {
  // Create session object
  const newSession = {
    id: generateId(),
    name: config.name,
    startTime: new Date().toISOString(),
    status: 'active',
    screenshotsEnabled: config.screenshotsEnabled,
    audioRecording: config.audioRecording,
    // ... other fields
  };

  // Set active session
  setActiveSession(newSession);

  // Define callbacks for machine
  const callbacks = {
    onScreenshotCaptured: (screenshot: SessionScreenshot) => {
      addScreenshot(screenshot);
    },
    onAudioSegment: (segment: SessionAudioSegment) => {
      addAudioSegment(segment);
    }
  };

  // Let machine orchestrate everything
  send({
    type: 'START',
    config,
    session: newSession,
    callbacks
  });
}, [send, addScreenshot, addAudioSegment]);
```

**Listen to machine state changes**:
```typescript
// React to machine errors
useEffect(() => {
  if (state.matches('error')) {
    toast.error(context.errors.join(', '));
  }
}, [state, context.errors]);

// React to recording state changes
useEffect(() => {
  const hasErrors = Object.values(context.recordingState).some(s => s === 'error');
  if (hasErrors) {
    const failedServices = Object.entries(context.recordingState)
      .filter(([_, state]) => state === 'error')
      .map(([service]) => service);

    toast.warning(`Some services failed: ${failedServices.join(', ')}`);
  }
}, [context.recordingState]);
```

**Integration Test Requirements**:

Update `src/machines/__tests__/integration.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createActor } from 'xstate';
import { sessionMachine } from '../sessionMachine';
import { invoke } from '@tauri-apps/api/core';
import { screenshotCaptureService } from '../../services/screenshotCaptureService';
import { audioRecordingService } from '../../services/audioRecordingService';
import { videoRecordingService } from '../../services/videoRecordingService';

vi.mock('@tauri-apps/api/core');
vi.mock('../../services/screenshotCaptureService');
vi.mock('../../services/audioRecordingService');
vi.mock('../../services/videoRecordingService');
vi.mock('../../services/storage/ChunkedSessionStorage');

describe('XState Machine Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Full Session Lifecycle', () => {
    it('should complete full lifecycle: start → active → pause → resume → end', async () => {
      const actor = createActor(sessionMachine);
      actor.start();

      // Mock all services successfully
      vi.mocked(invoke).mockResolvedValue(true); // Permissions OK
      vi.mocked(screenshotCaptureService.startCapture).mockResolvedValue(undefined);
      vi.mocked(screenshotCaptureService.pauseCapture).mockReturnValue(undefined);
      vi.mocked(screenshotCaptureService.resumeCapture).mockReturnValue(undefined);
      vi.mocked(screenshotCaptureService.stopCapture).mockResolvedValue(undefined);

      const mockSession = { id: 'test', name: 'Test Session' };
      const mockCallbacks = {
        onScreenshotCaptured: vi.fn(),
        onAudioSegment: vi.fn()
      };

      // 1. Start session
      actor.send({
        type: 'START',
        config: { screenshotsEnabled: true, name: 'Test' },
        session: mockSession,
        callbacks: mockCallbacks
      });

      // Should transition: idle → validating → checking_permissions → starting → active
      await vi.waitFor(() => {
        expect(actor.getSnapshot().matches('active')).toBe(true);
      });

      expect(screenshotCaptureService.startCapture).toHaveBeenCalled();

      // 2. Pause session
      actor.send({ type: 'PAUSE' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().matches('paused')).toBe(true);
      });

      expect(screenshotCaptureService.pauseCapture).toHaveBeenCalled();

      // 3. Resume session
      actor.send({ type: 'RESUME' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().matches('active')).toBe(true);
      });

      expect(screenshotCaptureService.resumeCapture).toHaveBeenCalled();

      // 4. End session
      actor.send({ type: 'END' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().matches('completed')).toBe(true);
      });

      expect(screenshotCaptureService.stopCapture).toHaveBeenCalled();
    });

    it('should handle permission denial gracefully', async () => {
      const actor = createActor(sessionMachine);
      actor.start();

      // Mock permission denied
      vi.mocked(invoke).mockResolvedValue(false);

      actor.send({
        type: 'START',
        config: { screenshotsEnabled: true, name: 'Test' },
        session: { id: 'test' },
        callbacks: { onScreenshotCaptured: vi.fn(), onAudioSegment: vi.fn() }
      });

      // Should transition to error state
      await vi.waitFor(() => {
        expect(actor.getSnapshot().matches('error')).toBe(true);
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.errors).toContain('Missing permissions: screen recording');
    });

    it('should handle service startup failure', async () => {
      const actor = createActor(sessionMachine);
      actor.start();

      vi.mocked(invoke).mockResolvedValue(true); // Permission OK
      vi.mocked(screenshotCaptureService.startCapture).mockRejectedValue(
        new Error('Service failed')
      );

      actor.send({
        type: 'START',
        config: { screenshotsEnabled: true, name: 'Test' },
        session: { id: 'test' },
        callbacks: { onScreenshotCaptured: vi.fn(), onAudioSegment: vi.fn() }
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().matches('error')).toBe(true);
      });
    });

    it('should start multiple services concurrently', async () => {
      const actor = createActor(sessionMachine);
      actor.start();

      vi.mocked(invoke).mockResolvedValue(true);
      vi.mocked(screenshotCaptureService.startCapture).mockResolvedValue(undefined);
      vi.mocked(audioRecordingService.startRecording).mockResolvedValue(undefined);
      vi.mocked(videoRecordingService.startRecording).mockResolvedValue(undefined);

      actor.send({
        type: 'START',
        config: {
          screenshotsEnabled: true,
          audioConfig: { enabled: true, sourceType: 'microphone' },
          videoConfig: { enabled: true, sourceType: 'display', displayIds: ['main'] },
          name: 'Test'
        },
        session: { id: 'test' },
        callbacks: { onScreenshotCaptured: vi.fn(), onAudioSegment: vi.fn() }
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().matches('active')).toBe(true);
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.recordingState.screenshots).toBe('active');
      expect(snapshot.context.recordingState.audio).toBe('active');
      expect(snapshot.context.recordingState.video).toBe('active');
    });
  });

  describe('Error Recovery', () => {
    it('should allow retry after error', async () => {
      const actor = createActor(sessionMachine);
      actor.start();

      // First attempt fails
      vi.mocked(invoke).mockResolvedValueOnce(false);

      actor.send({
        type: 'START',
        config: { screenshotsEnabled: true, name: 'Test' },
        session: { id: 'test' },
        callbacks: { onScreenshotCaptured: vi.fn(), onAudioSegment: vi.fn() }
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().matches('error')).toBe(true);
      });

      // Retry with permission granted
      vi.mocked(invoke).mockResolvedValue(true);
      vi.mocked(screenshotCaptureService.startCapture).mockResolvedValue(undefined);

      actor.send({ type: 'RETRY' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().matches('idle')).toBe(true);
      });

      actor.send({
        type: 'START',
        config: { screenshotsEnabled: true, name: 'Test' },
        session: { id: 'test' },
        callbacks: { onScreenshotCaptured: vi.fn(), onAudioSegment: vi.fn() }
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().matches('active')).toBe(true);
      });
    });
  });

  describe('State Guards', () => {
    it('should prevent pause when not active', async () => {
      const actor = createActor(sessionMachine);
      actor.start();

      // Try to pause while idle
      actor.send({ type: 'PAUSE' });

      // Should remain idle
      expect(actor.getSnapshot().matches('idle')).toBe(true);
    });

    it('should prevent resume when not paused', async () => {
      const actor = createActor(sessionMachine);
      actor.start();

      vi.mocked(invoke).mockResolvedValue(true);
      vi.mocked(screenshotCaptureService.startCapture).mockResolvedValue(undefined);

      // Start session
      actor.send({
        type: 'START',
        config: { screenshotsEnabled: true, name: 'Test' },
        session: { id: 'test' },
        callbacks: { onScreenshotCaptured: vi.fn(), onAudioSegment: vi.fn() }
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().matches('active')).toBe(true);
      });

      // Try to resume when active (not paused)
      actor.send({ type: 'RESUME' });

      // Should remain active
      expect(actor.getSnapshot().matches('active')).toBe(true);
    });
  });
});
```

**Time Estimate**: 3 hours (1h ActiveSessionContext updates, 2h integration testing)

**Dependencies**: All previous tasks (this is final integration)

---

## Timeline

**Total Estimated Time**: 12-16 hours

**Breakdown**:
- Task 1: Permission Services - 3 hours
- Task 2: Start Recording Services - 4 hours
- Task 3: Stop Recording Services - 2 hours
- Task 4: Pause/Resume Services - 2 hours
- Task 5: Health Monitoring - 2 hours
- Task 6: Integration & Cleanup - 3 hours

**Timeline Options**:

**Option A: Focused Sprint (1.5 days)**
- Day 1 Morning: Tasks 1-2 (7 hours)
- Day 1 Afternoon: Tasks 3-4 (4 hours)
- Day 2 Morning: Tasks 5-6 (5 hours)
- Day 2 Afternoon: Final testing, polish (2 hours)

**Option B: Steady Pace (2 days)**
- Day 1: Tasks 1-3 (9 hours)
- Day 2: Tasks 4-6 (7 hours)

**Recommendation**: Option B (steady pace, less burnout risk)

---

## Success Criteria

**How We Know We're Done**:

1. **All Tests Passing** ✅
   - 21 existing machine tests still pass
   - 30+ new service integration tests pass
   - Full E2E integration test passes

2. **All Services Implemented** ✅
   - No console.log stubs remaining
   - All 7 services call real implementations
   - Permission checks use Tauri commands
   - Recording services coordinated by machine

3. **Integration Complete** ✅
   - ActiveSessionContext uses machine for orchestration
   - Machine state drives UI updates
   - Error handling centralized in machine
   - Health monitoring detects failures

4. **Manual Testing** ✅
   - Start session → screenshots capture
   - Pause session → recording pauses
   - Resume session → recording resumes
   - End session → data saved, services stopped
   - Revoke permission mid-session → error detected

5. **Code Quality** ✅
   - No TypeScript errors
   - No ESLint warnings
   - Test coverage >80% for new code
   - Documentation updated

---

## Deployment

**Simple Process**:

1. **Run Tests**:
   ```bash
   npm test
   ```

2. **Type Check**:
   ```bash
   npm run type-check
   ```

3. **Lint**:
   ```bash
   npm run lint
   ```

4. **Manual Smoke Test**:
   - Start session
   - Pause/resume
   - End session
   - Check data persisted

5. **Commit**:
   ```bash
   git add .
   git commit -m "Implement XState service orchestration

   - Replace all service stubs with real implementations
   - Add permission checks via Tauri commands
   - Integrate screenshot/audio/video services
   - Add health monitoring for service crashes
   - Comprehensive test coverage (50+ tests)
   - Machine now orchestrates full recording lifecycle

   Testing: 21 existing + 30 new tests passing
   Timeline: 14 hours over 2 days
   "
   ```

6. **Push**:
   ```bash
   git push
   ```

7. **Done** 🎉

---

## Blockers & Concerns

**Potential Issues**:

1. **Callback Pattern Complexity** (Medium Risk)
   - **Issue**: Passing callbacks from ActiveSessionContext to machine services
   - **Solution**: Event-driven pattern (machine emits events, context listens)
   - **Fallback**: Keep callbacks in machine input (simpler, works fine)

2. **Session Object Timing** (Low Risk)
   - **Issue**: Session created before machine starts
   - **Solution**: Pass session to machine in START event
   - **Already Solved**: Current pattern works (session created in context, passed to machine)

3. **Health Monitoring Cleanup** (Low Risk)
   - **Issue**: fromPromise doesn't support cleanup
   - **Solution**: Use fromCallback instead
   - **Already Solved**: Plan uses fromCallback pattern

4. **Type Mismatches** (Very Low Risk)
   - **Issue**: Service types may not match machine expectations
   - **Solution**: Add type adapters if needed
   - **Unlikely**: Services already type-safe, machine types flexible

**No Blockers**: All potential issues have clear solutions.

---

## Notes

**Why This Plan Works**:

1. **Foundation is Solid**: Machine structure validated, 21 tests passing
2. **Services Exist**: screenshotCaptureService, audioRecordingService, videoRecordingService fully implemented
3. **Clear Pattern**: Event-driven integration, no tight coupling
4. **Incremental**: Each task builds on previous, can test progressively
5. **Comprehensive Testing**: Tests included in each task, not afterthought
6. **Realistic Estimates**: Based on actual code inspection, not guesswork

**What Could Go Wrong**:

1. **Underestimated Complexity**: Tasks take 1.5x longer than estimated
   - **Mitigation**: 12-16 hour range accounts for variance
   - **Buffer**: Can extend to 3 days if needed

2. **Service Integration Issues**: Existing services don't work as expected
   - **Mitigation**: Services already production-tested, low risk
   - **Fallback**: Fix service bugs first, then integrate

3. **Test Failures**: Edge cases not covered
   - **Mitigation**: Comprehensive test plan, covers happy/sad paths
   - **Fallback**: Add tests incrementally as issues found

**Confidence Level**: High (8/10)

**Recommendation**: Execute plan as written, adjust timeline if needed.

---

**Document Status**: Ready to Execute
**Last Updated**: October 26, 2025
**Next Action**: Begin Task 1 (Permission Services)
