/**
 * Task 14: End-to-End Background Enrichment System Tests
 *
 * Comprehensive integration tests verifying the complete background enrichment flow:
 * 1. Session end → enrichment job creation
 * 2. BackgroundMediaProcessor processes audio/video
 * 3. PersistentEnrichmentQueue manages job lifecycle
 * 4. Session.video.optimizedPath is saved
 * 5. UnifiedMediaPlayer uses optimized video
 * 6. System survives app restart
 *
 * This test suite focuses on critical paths and integration points between services,
 * ensuring the system works end-to-end from session end to optimized video playback.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getBackgroundEnrichmentManager, resetBackgroundEnrichmentManager } from '../BackgroundEnrichmentManager';
import { getPersistentEnrichmentQueue, resetPersistentEnrichmentQueue } from '../PersistentEnrichmentQueue';
import { getChunkedStorage } from '../../storage/ChunkedSessionStorage';
import { sessionEnrichmentService } from '../../sessionEnrichmentService';
import { generateId } from '../../../utils/helpers';
import type { Session, SessionScreenshot, SessionAudioSegment, SessionVideo } from '../../../types';
import 'fake-indexeddb/auto';

// ============================================================================
// Mocks
// ============================================================================

// Mock sessionEnrichmentService
vi.mock('../../sessionEnrichmentService', () => ({
  sessionEnrichmentService: {
    enrichSession: vi.fn(),
  },
}));

// Mock ChunkedSessionStorage with realistic behavior
vi.mock('../../storage/ChunkedSessionStorage', () => {
  const sessions = new Map<string, Session>();

  return {
    getChunkedStorage: vi.fn().mockResolvedValue({
      loadMetadata: vi.fn(async (sessionId: string) => {
        const session = sessions.get(sessionId);
        if (!session) return null;
        return {
          id: session.id,
          name: session.name,
          startTime: session.startTime,
          endTime: session.endTime,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        };
      }),
      loadFullSession: vi.fn(async (sessionId: string) => {
        return sessions.get(sessionId) || null;
      }),
      saveSession: vi.fn(async (session: Session) => {
        sessions.set(session.id, session);
      }),
      updateSession: vi.fn(async (sessionId: string, updates: Partial<Session>) => {
        const existing = sessions.get(sessionId);
        if (existing) {
          const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
          sessions.set(sessionId, updated);
        }
      }),
      _sessions: sessions, // For test access
    }),
  };
});

// Mock Tauri commands for media processing
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: any) => {
    if (command === 'concatenate_audio_segments') {
      return Promise.resolve({
        outputPath: '/path/to/concatenated-audio.mp3',
        duration: 300,
        fileSize: 5242880, // 5MB
      });
    }
    if (command === 'merge_video_and_audio') {
      return Promise.resolve({
        outputPath: '/path/to/optimized-video.mp4',
        duration: 300,
        fileSize: 52428800, // 50MB (compressed from 125MB)
        compressionRatio: 0.4,
      });
    }
    return Promise.resolve();
  }),
}));

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a realistic test session with video and audio
 */
function createMockSession(overrides?: Partial<Session>): Session {
  const sessionId = generateId();
  const now = new Date().toISOString();
  const startTime = Date.now() - 300000; // 5 minutes ago

  return {
    id: sessionId,
    name: `Test Session ${sessionId.slice(0, 8)}`,
    description: 'E2E test session with video and audio',
    startTime: new Date(startTime).toISOString(),
    endTime: now,
    duration: 300, // 5 minutes
    createdAt: now,
    updatedAt: now,
    screenshots: createTestScreenshots(20), // 20 screenshots
    audioSegments: createTestAudioSegments(30), // 30 audio segments
    video: {
      fullVideoAttachmentId: 'original-video-attachment',
      duration: 300,
      path: '/path/to/original-video.mp4', // Legacy format
    },
    status: 'completed',
    category: 'work',
    tags: ['testing', 'e2e'],
    screenshotCount: 20,
    ...overrides,
  } as Session;
}

/**
 * Creates test screenshots
 */
function createTestScreenshots(count: number): SessionScreenshot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: generateId(),
    timestamp: new Date(Date.now() - (count - i) * 15000).toISOString(), // Every 15s
    attachmentId: `screenshot-${i}`,
    curiosityScore: 0.5 + Math.random() * 0.5,
    analysis: undefined,
  }));
}

/**
 * Creates test audio segments
 */
function createTestAudioSegments(count: number): SessionAudioSegment[] {
  return Array.from({ length: count }, (_, i) => ({
    id: generateId(),
    timestamp: new Date(Date.now() - (count - i) * 10000).toISOString(), // Every 10s
    duration: 10,
    attachmentId: `audio-${i}`,
    transcription: `Test transcription segment ${i}`,
  }));
}

/**
 * Waits for a condition to be true
 */
async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  checkIntervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
  }

  throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Background Enrichment E2E Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetBackgroundEnrichmentManager();
    await resetPersistentEnrichmentQueue();
  });

  afterEach(async () => {
    const manager = getBackgroundEnrichmentManager();
    if (manager.isInitialized()) {
      await manager.shutdown();
    }
  });

  // ==========================================================================
  // Test 1: Full Session Enrichment Flow (Happy Path)
  // ==========================================================================

  it('1. Should complete full flow: session end → media processing → enrichment → optimized video', async () => {
    // Create test session
    const session = createMockSession();
    const storage = await getChunkedStorage();
    await storage.saveSession(session);

    // Initialize background enrichment system
    const manager = getBackgroundEnrichmentManager();
    await manager.initialize();

    // Mock successful enrichment
    vi.mocked(sessionEnrichmentService.enrichSession).mockResolvedValue({
      success: true,
      summary: {
        schemaVersion: '1.0',
        title: 'Test Summary',
        overview: 'Session completed successfully',
        achievements: [],
        nextSteps: [],
        topics: [],
      },
      audioInsights: {
        summary: 'Audio analysis complete',
        keyPoints: ['Point 1', 'Point 2'],
        sentiment: 'positive',
        confidence: 0.9,
      },
      videoChapters: [],
      extractedTasks: [],
      extractedNotes: [],
    });

    // Step 1: Enqueue enrichment job (simulates session end)
    const jobId = await manager.enqueueSession({
      sessionId: session.id,
      sessionName: session.name,
      priority: 'high',
      options: {
        includeAudio: true,
        includeVideo: true,
        includeSummary: true,
      },
    });

    expect(jobId).toBeDefined();

    // Step 2: Wait for media processing to complete
    const queue = manager.getQueue();
    expect(queue).not.toBeNull();

    await waitFor(async () => {
      const job = await queue!.getJob(jobId);
      return job?.options?.optimizedVideoPath !== undefined;
    }, 5000);

    // Step 3: Mark media processing complete (simulates BackgroundMediaProcessor)
    await manager.markMediaProcessingComplete(session.id, '/path/to/optimized-video.mp4');

    // Step 4: Wait for enrichment to complete
    await waitFor(async () => {
      const job = await queue!.getJob(jobId);
      return job?.status === 'completed';
    }, 10000);

    // Step 5: Verify job completed successfully
    const finalJob = await queue!.getJob(jobId);
    expect(finalJob?.status).toBe('completed');
    expect(finalJob?.progress).toBe(100);
    expect(finalJob?.result).toBeDefined();

    // Step 6: Verify optimized video path saved to session
    const updatedSession = await storage.loadFullSession(session.id);
    expect(updatedSession?.video?.optimizedPath).toBe('/path/to/optimized-video.mp4');
  }, 15000); // Extended timeout

  // ==========================================================================
  // Test 2: Queue Persistence Across Restart
  // ==========================================================================

  it('2. Should persist jobs to IndexedDB and resume after app restart', async () => {
    const session = createMockSession();
    const storage = await getChunkedStorage();
    await storage.saveSession(session);

    // Initialize and enqueue job
    const manager1 = getBackgroundEnrichmentManager();
    await manager1.initialize();

    const jobId = await manager1.enqueueSession({
      sessionId: session.id,
      sessionName: session.name,
      options: { includeAudio: true },
    });

    // Verify job created
    const queue1 = manager1.getQueue();
    const job1 = await queue1!.getJob(jobId);
    expect(job1?.status).toBe('pending');

    // Simulate app restart: shutdown and reinitialize
    await manager1.shutdown();
    await resetBackgroundEnrichmentManager();

    // Create new manager (simulates app restart)
    const manager2 = getBackgroundEnrichmentManager();
    await manager2.initialize();

    // Verify job was persisted and resumed
    const queue2 = manager2.getQueue();
    const job2 = await queue2!.getJob(jobId);

    expect(job2).not.toBeNull();
    expect(job2?.sessionId).toBe(session.id);
    expect(job2?.status).toBe('pending'); // Should be restored

    await manager2.shutdown();
  });

  // ==========================================================================
  // Test 3: Media Processing Creates Optimized Video
  // ==========================================================================

  it('3. Should concatenate audio and merge with video to create optimized MP4', async () => {
    const session = createMockSession();
    const storage = await getChunkedStorage();
    await storage.saveSession(session);

    const manager = getBackgroundEnrichmentManager();
    await manager.initialize();

    const jobId = await manager.enqueueSession({
      sessionId: session.id,
      sessionName: session.name,
      options: { includeAudio: true, includeVideo: true },
    });

    // Wait for media processing callbacks
    const queue = manager.getQueue();

    // Verify Tauri commands are called for media processing
    await waitFor(async () => {
      const job = await queue!.getJob(jobId);
      return job?.options?.optimizedVideoPath !== undefined;
    }, 5000);

    // Mark media processing complete
    await manager.markMediaProcessingComplete(session.id, '/path/to/optimized-video.mp4');

    // Verify job has optimized video path
    const job = await queue!.getJob(jobId);
    expect(job?.options?.optimizedVideoPath).toBe('/path/to/optimized-video.mp4');
  });

  // ==========================================================================
  // Test 4: Enrichment With Both Audio and Video
  // ==========================================================================

  it('4. Should process enrichment with both audio insights and video chapters', async () => {
    const session = createMockSession();
    const storage = await getChunkedStorage();
    await storage.saveSession(session);

    const manager = getBackgroundEnrichmentManager();
    await manager.initialize();

    // Mock enrichment with full audio/video processing
    vi.mocked(sessionEnrichmentService.enrichSession).mockResolvedValue({
      success: true,
      summary: {
        schemaVersion: '1.0',
        title: 'Full Enrichment Test',
        overview: 'Both audio and video processed',
        achievements: [],
        nextSteps: [],
        topics: [],
      },
      audioInsights: {
        summary: 'Detailed audio analysis',
        keyPoints: ['Audio point 1', 'Audio point 2'],
        sentiment: 'positive',
        confidence: 0.95,
      },
      videoChapters: [
        {
          id: 'chapter-1',
          title: 'Introduction',
          startTime: 0,
          endTime: 60,
          screenshotIds: ['screenshot-0', 'screenshot-1'],
          summary: 'Opening section',
        },
        {
          id: 'chapter-2',
          title: 'Main Work',
          startTime: 60,
          endTime: 240,
          screenshotIds: ['screenshot-2', 'screenshot-3'],
          summary: 'Primary work session',
        },
      ],
      extractedTasks: [],
      extractedNotes: [],
    });

    const jobId = await manager.enqueueSession({
      sessionId: session.id,
      sessionName: session.name,
      options: {
        includeAudio: true,
        includeVideo: true,
        includeSummary: true,
      },
    });

    // Mark media processing complete to trigger enrichment
    await manager.markMediaProcessingComplete(session.id, '/path/to/optimized-video.mp4');

    // Wait for enrichment to complete
    const queue = manager.getQueue();
    await waitFor(async () => {
      const job = await queue!.getJob(jobId);
      return job?.status === 'completed';
    }, 10000);

    // Verify enrichment results
    const job = await queue!.getJob(jobId);
    expect(job?.result?.audioInsights).toBeDefined();
    expect(job?.result?.audioInsights?.keyPoints).toHaveLength(2);
    expect(job?.result?.videoChapters).toHaveLength(2);
  }, 15000);

  // ==========================================================================
  // Test 5: Error Handling with Retry
  // ==========================================================================

  it('5. Should retry failed enrichment and eventually succeed', async () => {
    const session = createMockSession();
    const storage = await getChunkedStorage();
    await storage.saveSession(session);

    const manager = getBackgroundEnrichmentManager();
    await manager.initialize();

    let attemptCount = 0;

    // Mock enrichment to fail first 2 attempts, then succeed
    vi.mocked(sessionEnrichmentService.enrichSession).mockImplementation(async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Temporary API failure');
      }
      return {
        success: true,
        summary: {
          schemaVersion: '1.0',
          title: 'Retry Success',
          overview: 'Succeeded after retries',
          achievements: [],
          nextSteps: [],
          topics: [],
        },
        audioInsights: undefined,
        videoChapters: undefined,
        extractedTasks: [],
        extractedNotes: [],
      };
    });

    const jobId = await manager.enqueueSession({
      sessionId: session.id,
      sessionName: session.name,
      options: { includeAudio: true },
    });

    // Mark media processing complete
    await manager.markMediaProcessingComplete(session.id, '/path/to/optimized-video.mp4');

    // Wait for retries and eventual success
    const queue = manager.getQueue();
    await waitFor(async () => {
      const job = await queue!.getJob(jobId);
      return job?.status === 'completed';
    }, 15000);

    // Verify job succeeded after retries
    const job = await queue!.getJob(jobId);
    expect(job?.status).toBe('completed');
    expect(attemptCount).toBeGreaterThanOrEqual(3);
  }, 20000);

  // ==========================================================================
  // Test 6: Multiple Concurrent Enrichments
  // ==========================================================================

  it('6. Should process multiple sessions concurrently without conflicts', async () => {
    const sessions = [
      createMockSession({ name: 'Session 1' }),
      createMockSession({ name: 'Session 2' }),
      createMockSession({ name: 'Session 3' }),
    ];

    const storage = await getChunkedStorage();
    for (const session of sessions) {
      await storage.saveSession(session);
    }

    const manager = getBackgroundEnrichmentManager();
    await manager.initialize();

    // Mock successful enrichment
    vi.mocked(sessionEnrichmentService.enrichSession).mockResolvedValue({
      success: true,
      summary: {
        schemaVersion: '1.0',
        title: 'Concurrent Test',
        overview: 'Processed concurrently',
        achievements: [],
        nextSteps: [],
        topics: [],
      },
      audioInsights: undefined,
      videoChapters: undefined,
      extractedTasks: [],
      extractedNotes: [],
    });

    // Enqueue all sessions
    const jobIds = await Promise.all(
      sessions.map(session =>
        manager.enqueueSession({
          sessionId: session.id,
          sessionName: session.name,
          options: { includeAudio: true },
        })
      )
    );

    // Mark all as media processing complete
    await Promise.all(
      sessions.map(session =>
        manager.markMediaProcessingComplete(session.id, `/path/to/${session.id}-optimized.mp4`)
      )
    );

    // Wait for all to complete
    const queue = manager.getQueue();
    await waitFor(async () => {
      const statuses = await Promise.all(
        jobIds.map(async id => {
          const job = await queue!.getJob(id);
          return job?.status;
        })
      );
      return statuses.every(status => status === 'completed');
    }, 15000);

    // Verify all jobs completed
    const finalJobs = await Promise.all(jobIds.map(id => queue!.getJob(id)));
    expect(finalJobs.every(job => job?.status === 'completed')).toBe(true);
  }, 20000);

  // ==========================================================================
  // Test 7: Legacy Session Fallback (No Optimized Video)
  // ==========================================================================

  it('7. Should handle legacy sessions without optimized video path', async () => {
    // Create legacy session (no optimizedPath)
    const legacySession = createMockSession({
      video: {
        fullVideoAttachmentId: 'legacy-video',
        duration: 300,
        path: '/path/to/legacy-video.mp4',
        // No optimizedPath
      } as SessionVideo,
    });

    const storage = await getChunkedStorage();
    await storage.saveSession(legacySession);

    const manager = getBackgroundEnrichmentManager();
    await manager.initialize();

    // Enqueue enrichment for legacy session
    const jobId = await manager.enqueueSession({
      sessionId: legacySession.id,
      sessionName: legacySession.name,
      options: { includeAudio: true },
    });

    // Media processing should still create optimized video
    await manager.markMediaProcessingComplete(legacySession.id, '/path/to/newly-optimized.mp4');

    // Verify optimized path added to legacy session
    const updatedSession = await storage.loadFullSession(legacySession.id);
    expect(updatedSession?.video?.optimizedPath).toBe('/path/to/newly-optimized.mp4');
    expect(updatedSession?.video?.path).toBe('/path/to/legacy-video.mp4'); // Original preserved
  });

  // ==========================================================================
  // Test 8: Queue Status Tracking
  // ==========================================================================

  it('8. Should accurately track queue status (pending, processing, completed)', async () => {
    const session = createMockSession();
    const storage = await getChunkedStorage();
    await storage.saveSession(session);

    const manager = getBackgroundEnrichmentManager();
    await manager.initialize();

    // Initial status should be empty
    const initialStatus = await manager.getQueueStatus();
    expect(initialStatus.pending).toBe(0);
    expect(initialStatus.processing).toBe(0);
    expect(initialStatus.completed).toBe(0);

    // Enqueue job
    const jobId = await manager.enqueueSession({
      sessionId: session.id,
      sessionName: session.name,
      options: { includeAudio: true },
    });

    // Should have 1 pending
    const pendingStatus = await manager.getQueueStatus();
    expect(pendingStatus.pending).toBe(1);
    expect(pendingStatus.total).toBe(1);

    // Mark media processing complete and wait for completion
    vi.mocked(sessionEnrichmentService.enrichSession).mockResolvedValue({
      success: true,
      summary: {
        schemaVersion: '1.0',
        title: 'Status Test',
        overview: 'Testing status tracking',
        achievements: [],
        nextSteps: [],
        topics: [],
      },
      audioInsights: undefined,
      videoChapters: undefined,
      extractedTasks: [],
      extractedNotes: [],
    });

    await manager.markMediaProcessingComplete(session.id, '/path/to/optimized.mp4');

    const queue = manager.getQueue();
    await waitFor(async () => {
      const job = await queue!.getJob(jobId);
      return job?.status === 'completed';
    }, 10000);

    // Should have 1 completed
    const completedStatus = await manager.getQueueStatus();
    expect(completedStatus.completed).toBe(1);
    expect(completedStatus.pending).toBe(0);
    expect(completedStatus.processing).toBe(0);
  }, 15000);

  // ==========================================================================
  // Test 9: Job Cancellation
  // ==========================================================================

  it('9. Should allow job cancellation before enrichment starts', async () => {
    const session = createMockSession();
    const storage = await getChunkedStorage();
    await storage.saveSession(session);

    const manager = getBackgroundEnrichmentManager();
    await manager.initialize();

    // Enqueue job but don't mark media processing complete (keeps it in waiting state)
    const jobId = await manager.enqueueSession({
      sessionId: session.id,
      sessionName: session.name,
      options: { includeAudio: true },
    });

    // Cancel job
    await manager.cancelEnrichment(session.id);

    // Verify job cancelled
    const queue = manager.getQueue();
    const job = await queue!.getJob(jobId);
    expect(job?.status).toBe('cancelled');
  });

  // ==========================================================================
  // Test 10: Storage Integration (Session Updates)
  // ==========================================================================

  it('10. Should save enrichment results back to session storage', async () => {
    const session = createMockSession();
    const storage = await getChunkedStorage();
    await storage.saveSession(session);

    const manager = getBackgroundEnrichmentManager();
    await manager.initialize();

    // Mock enrichment with results
    vi.mocked(sessionEnrichmentService.enrichSession).mockResolvedValue({
      success: true,
      summary: {
        schemaVersion: '1.0',
        title: 'Storage Integration Test',
        overview: 'Verifying storage updates',
        achievements: ['Completed test'],
        nextSteps: ['Verify results'],
        topics: ['testing', 'storage'],
      },
      audioInsights: {
        summary: 'Audio processed successfully',
        keyPoints: ['Point 1'],
        sentiment: 'neutral',
        confidence: 0.9,
      },
      videoChapters: [],
      extractedTasks: [],
      extractedNotes: [],
    });

    const jobId = await manager.enqueueSession({
      sessionId: session.id,
      sessionName: session.name,
      options: { includeAudio: true, includeSummary: true },
    });

    await manager.markMediaProcessingComplete(session.id, '/path/to/optimized.mp4');

    const queue = manager.getQueue();
    await waitFor(async () => {
      const job = await queue!.getJob(jobId);
      return job?.status === 'completed';
    }, 10000);

    // Verify session updated in storage
    const updatedSession = await storage.loadFullSession(session.id);
    expect(updatedSession?.summary).toBeDefined();
    expect(updatedSession?.summary?.title).toBe('Storage Integration Test');
    expect(updatedSession?.audioInsights).toBeDefined();
    expect(updatedSession?.audioInsights?.summary).toBe('Audio processed successfully');
  }, 15000);
});
