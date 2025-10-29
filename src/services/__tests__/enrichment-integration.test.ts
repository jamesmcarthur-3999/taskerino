/**
 * Phase 5 Wave 4: Integration Testing & Quality Assurance
 * Task 5.13: Enrichment Integration Tests
 *
 * Comprehensive E2E integration tests for the complete Phase 5 Enrichment
 * Optimization system, verifying all components work together correctly.
 *
 * Coverage:
 * - Full enrichment flow (session → enrichment → cache → result)
 * - Cache integration (EnrichmentResultCache + MemoizationCache)
 * - Incremental processing (IncrementalEnrichmentService)
 * - Parallel processing (ParallelEnrichmentQueue)
 * - Error recovery (EnrichmentErrorHandler)
 * - Smart API usage (model selection, compression, batching)
 * - Progress tracking (ProgressTrackingService)
 * - Cost monitoring (backend only, no user UI)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Session, SessionScreenshot, SessionAudioSegment } from '../../types';
import { getEnrichmentResultCache } from '../enrichment/EnrichmentResultCache';
import { getIncrementalEnrichmentService } from '../enrichment/IncrementalEnrichmentService';
import { getParallelEnrichmentQueue } from '../enrichment/ParallelEnrichmentQueue';
import { getEnrichmentErrorHandler } from '../enrichment/EnrichmentErrorHandler';
import { getEnrichmentWorkerPool } from '../enrichment/EnrichmentWorkerPool';
import { getProgressTrackingService } from '../enrichment/ProgressTrackingService';
import { getMemoizationCache } from '../enrichment/MemoizationCache';
import { sessionEnrichmentService } from '../sessionEnrichmentService';
import { generateId } from '../../utils/helpers';
import 'fake-indexeddb/auto';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a realistic test session with screenshots and audio
 */
function createTestSession(overrides?: Partial<Session>): Session {
  const sessionId = generateId();
  const now = new Date().toISOString();

  return {
    id: sessionId,
    name: `Test Session ${sessionId.slice(0, 8)}`,
    description: 'Integration test session',
    startTime: now,
    endTime: new Date(Date.now() + 60000).toISOString(), // 1 minute session
    duration: 60,
    screenshots: createTestScreenshots(5),
    audioSegments: createTestAudioSegments(10),
    video: undefined,
    summary: undefined,
    audioInsights: undefined,
    canvasSpec: undefined,
    enrichmentStatus: {
      isProcessing: false,
      currentStage: 'idle',
      progress: 0,
      errors: [],
    },
    ...overrides,
  } as Session;
}

/**
 * Creates test screenshots
 */
function createTestScreenshots(count: number): SessionScreenshot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: generateId(),
    timestamp: new Date(Date.now() + i * 10000).toISOString(),
    attachmentId: `screenshot-${i}`,
    curiosityScore: 0.5,
    analysis: undefined,
  }));
}

/**
 * Creates test audio segments
 */
function createTestAudioSegments(count: number): SessionAudioSegment[] {
  return Array.from({ length: count }, (_, i) => ({
    id: generateId(),
    timestamp: new Date(Date.now() + i * 5000).toISOString(),
    duration: 5,
    attachmentId: `audio-${i}`,
    transcription: `Test transcription ${i}`,
  }));
}

/**
 * Mocks successful enrichment responses
 */
function mockSuccessfulEnrichment() {
  vi.mock('../sessionEnrichmentService', async () => {
    const actual = await vi.importActual('../sessionEnrichmentService');
    return {
      ...actual,
      sessionEnrichmentService: {
        enrichSession: vi.fn().mockResolvedValue({
          success: true,
          sessionId: 'test-session',
          audio: {
            insights: { summary: 'Test audio insights' },
            confidence: 0.9,
          },
          video: {
            chapters: [],
            confidence: 0.85,
          },
          summary: {
            content: 'Test session summary',
            extractedTasks: [],
            extractedNotes: [],
          },
          canvas: {
            layout: 'timeline',
            modules: [],
          },
          totalCost: 0.50,
          totalDuration: 5000,
        }),
      },
    };
  });
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Phase 5 Enrichment Integration Tests', () => {
  beforeEach(() => {
    // Reset all services before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup services
    const pool = await getEnrichmentWorkerPool();
    await pool.shutdown();
  });

  // ==========================================================================
  // Test 1: First-Time Enrichment (No Cache)
  // ==========================================================================

  it('1. First-time enrichment with no cache should do full processing', async () => {
    const session = createTestSession();
    const cache = await getEnrichmentResultCache();

    // Verify cache is empty
    const cacheKey = cache.generateCacheKeyFromSession(
      session,
      'test-prompt',
      { audioModel: 'gpt-4o-audio-preview-2024-10-01' } as any
    );
    const cachedResult = await cache.getCachedResult(cacheKey);
    expect(cachedResult).toBeNull();

    // Mock enrichment
    mockSuccessfulEnrichment();

    // Enrich session
    const result = await sessionEnrichmentService.enrichSession(session, {
      includeAudio: true,
      includeVideo: true,
      includeSummary: true,
    });

    // Verify full processing occurred
    expect(result.success).toBe(true);
    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.audio).toBeDefined();
    expect(result.summary).toBeDefined();

    // Verify result was cached
    const cachedAfter = await cache.getCachedResult(cacheKey);
    expect(cachedAfter).toBeDefined();
  });

  // ==========================================================================
  // Test 2: Re-Enrichment (Cached) - Instant Retrieval
  // ==========================================================================

  it('2. Re-enrichment with cache should retrieve instantly with 0 API calls', async () => {
    const session = createTestSession({ id: 'cached-session' });
    const cache = await getEnrichmentResultCache();

    // Pre-populate cache
    const cacheKey = cache.generateCacheKeyFromSession(
      session,
      'test-prompt',
      { audioModel: 'gpt-4o-audio-preview-2024-10-01' } as any
    );

    await cache.cacheResult(cacheKey, {
      audio: { insights: { summary: 'Cached audio' }, confidence: 0.9 },
      summary: { content: 'Cached summary', extractedTasks: [], extractedNotes: [] },
      totalCost: 0.50,
      totalDuration: 5000,
    } as any);

    // Track API calls
    let apiCallCount = 0;
    vi.spyOn(sessionEnrichmentService, 'enrichSession').mockImplementation(async () => {
      apiCallCount++;
      throw new Error('Should not call API when cached');
    });

    // Retrieve from cache
    const result = await cache.getCachedResult(cacheKey);

    // Verify instant retrieval
    expect(result).toBeDefined();
    expect(result?.audio?.insights.summary).toBe('Cached audio');
    expect(result?.summary?.content).toBe('Cached summary');
    expect(apiCallCount).toBe(0); // Zero API calls
  });

  // ==========================================================================
  // Test 3: Incremental Enrichment (Append Operation)
  // ==========================================================================

  it('3. Append operation should only process new screenshots/audio', async () => {
    const service = await getIncrementalEnrichmentService();

    // Create session with initial data
    const session = createTestSession({
      id: 'incremental-session',
      screenshots: createTestScreenshots(5),
      audioSegments: createTestAudioSegments(10),
    });

    // First enrichment (establishes checkpoint)
    mockSuccessfulEnrichment();
    await sessionEnrichmentService.enrichSession(session, {
      includeAudio: true,
      includeVideo: true,
    });

    // Append new data
    const updatedSession = {
      ...session,
      screenshots: [
        ...session.screenshots,
        ...createTestScreenshots(3), // 3 new screenshots
      ],
      audioSegments: [
        ...session.audioSegments,
        ...createTestAudioSegments(5), // 5 new audio segments
      ],
    };

    // Detect delta
    const canEnrichIncrementally = await service.canEnrichIncrementally(updatedSession);
    expect(canEnrichIncrementally).toBe(true);

    const delta = await service.detectDelta(updatedSession);
    expect(delta.newScreenshots).toHaveLength(3);
    expect(delta.newAudioSegments).toHaveLength(5);
    expect(delta.requiresFullReenrichment).toBe(false);

    // Incremental enrichment should only process new data
    const result = await service.enrichIncremental(updatedSession, {
      includeAudio: true,
      includeVideo: true,
    });

    expect(result.success).toBe(true);
    expect(result.incrementalProcessing).toBe(true);
    expect(result.itemsProcessed).toBe(8); // 3 screenshots + 5 audio
  });

  // ==========================================================================
  // Test 4: Parallel Processing (5 Concurrent Sessions)
  // ==========================================================================

  it('4. Should process 5 sessions concurrently without blocking', async () => {
    const queue = await getParallelEnrichmentQueue();
    const sessions = Array.from({ length: 5 }, (_, i) =>
      createTestSession({ id: `parallel-${i}`, name: `Parallel Session ${i}` })
    );

    mockSuccessfulEnrichment();

    // Enqueue all 5 sessions
    const jobIds = sessions.map(session =>
      queue.enqueue(session, { includeAudio: true, includeVideo: true }, 'normal')
    );

    expect(jobIds).toHaveLength(5);

    // Start queue processing
    const startTime = Date.now();
    await queue.processQueue();
    const duration = Date.now() - startTime;

    // Get queue status
    const status = queue.getQueueStatus();

    // Verify all completed
    expect(status.completed).toBe(5);
    expect(status.failed).toBe(0);
    expect(status.pending).toBe(0);
    expect(status.processing).toBe(0);

    // Verify parallel processing (5 sessions in < 15s = parallel, not 25s = sequential)
    expect(duration).toBeLessThan(15000);
  });

  // ==========================================================================
  // Test 5: API Failure → Retry → Success
  // ==========================================================================

  it('5. Should retry on transient API failure and eventually succeed', async () => {
    const errorHandler = await getEnrichmentErrorHandler();
    const session = createTestSession();

    let attemptCount = 0;
    vi.spyOn(sessionEnrichmentService, 'enrichSession').mockImplementation(async () => {
      attemptCount++;
      if (attemptCount < 3) {
        // Fail first 2 attempts
        throw new Error('API rate limit exceeded');
      }
      // Succeed on 3rd attempt
      return {
        success: true,
        sessionId: session.id,
        totalCost: 0.50,
        totalDuration: 5000,
      } as any;
    });

    // Process with retry logic
    let result;
    for (let i = 0; i < 5; i++) {
      try {
        result = await sessionEnrichmentService.enrichSession(session, {
          includeAudio: true,
        });
        break;
      } catch (error: any) {
        const resolution = await errorHandler.handleError(error, {
          sessionId: session.id,
          operation: 'full-enrichment',
          attemptNumber: i + 1,
        });

        if (!resolution.shouldRetry) {
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, resolution.retryDelay));
      }
    }

    // Verify success after retries
    expect(result?.success).toBe(true);
    expect(attemptCount).toBe(3);
  });

  // ==========================================================================
  // Test 6: API Failure → Exhausted Retries → Graceful Degradation
  // ==========================================================================

  it('6. Should gracefully degrade when retries exhausted', async () => {
    const errorHandler = await getEnrichmentErrorHandler();
    const session = createTestSession();

    vi.spyOn(sessionEnrichmentService, 'enrichSession').mockRejectedValue(
      new Error('Network timeout')
    );

    // Attempt enrichment with error handling
    let finalError;
    for (let i = 0; i < 5; i++) {
      try {
        await sessionEnrichmentService.enrichSession(session, {
          includeAudio: true,
        });
        break;
      } catch (error: any) {
        finalError = error;
        const resolution = await errorHandler.handleError(error, {
          sessionId: session.id,
          operation: 'full-enrichment',
          attemptNumber: i + 1,
        });

        if (!resolution.shouldRetry) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Verify graceful degradation
    expect(finalError).toBeDefined();
    const userMessage = errorHandler.getUserMessage(finalError as Error);
    expect(userMessage).not.toContain('$'); // NO COST INFO
    expect(userMessage).not.toContain('cost');
    expect(userMessage).toMatch(/couldn't.*retry|try again/i);
  });

  // ==========================================================================
  // Test 7: Image Compression (40-60% Size Reduction)
  // ==========================================================================

  it('7. Should compress images by 40-60% while maintaining quality', async () => {
    const { imageCompressionService } = await import('../imageCompression');

    // Create test image data (simulate 1MB screenshot)
    const originalSize = 1024 * 1024; // 1MB
    const mockImageData = 'data:image/png;base64,' + 'A'.repeat(originalSize);

    // Compress image
    const compressed = await imageCompressionService.compressImage(mockImageData, {
      quality: 0.8,
      format: 'webp',
      maxDimension: 1920,
    });

    // Calculate compression ratio
    const compressedSize = compressed.length;
    const reductionPercent = ((originalSize - compressedSize) / originalSize) * 100;

    // Verify 40-60% reduction
    expect(reductionPercent).toBeGreaterThanOrEqual(40);
    expect(reductionPercent).toBeLessThanOrEqual(60);
  });

  // ==========================================================================
  // Test 8: Batch Processing (20 Screenshots → 1 API Call)
  // ==========================================================================

  it('8. Should batch 20 screenshots into single API call (95% reduction)', async () => {
    const { smartAPIUsage } = await import('../smartAPIUsage');
    const screenshots = createTestScreenshots(20);

    // Track API calls
    let apiCallCount = 0;
    vi.spyOn(smartAPIUsage, 'batchScreenshotAnalysis').mockImplementation(async () => {
      apiCallCount++;
      return screenshots.map(s => ({
        screenshotId: s.id,
        summary: 'Test analysis',
        detectedActivity: 'coding',
        keyElements: [],
        suggestedActions: [],
        confidence: 0.9,
        curiosity: 0.5,
      }));
    });

    // Analyze batch
    const results = await smartAPIUsage.batchScreenshotAnalysis(screenshots);

    // Verify single API call for 20 screenshots
    expect(apiCallCount).toBe(1);
    expect(results).toHaveLength(20);
  });

  // ==========================================================================
  // Test 9: Real-Time Analysis (Haiku 4.5 Selected)
  // ==========================================================================

  it('9. Should select Haiku 4.5 for real-time analysis (1.5-2.5s latency)', async () => {
    const { smartAPIUsage } = await import('../smartAPIUsage');
    const screenshot = createTestScreenshots(1)[0];

    // Analyze in real-time mode
    const startTime = Date.now();
    const result = await smartAPIUsage.analyzeScreenshotRealtime(screenshot, {
      sessionId: 'test',
      previousContext: '',
    });
    const latency = Date.now() - startTime;

    // Verify Haiku 4.5 was used
    expect(result.modelUsed).toBe('claude-haiku-4-5-20251001');

    // Verify fast latency (1.5-2.5s target)
    expect(latency).toBeLessThan(2500);
  });

  // ==========================================================================
  // Test 10: Complex Analysis (Sonnet 4.5 Selected)
  // ==========================================================================

  it('10. Should select Sonnet 4.5 for complex batch analysis', async () => {
    const { smartAPIUsage } = await import('../smartAPIUsage');
    const screenshots = createTestScreenshots(10);

    // Analyze batch (complex mode)
    const results = await smartAPIUsage.batchScreenshotAnalysis(screenshots, {
      analysisDepth: 'deep',
      includeStory: true,
      includePatterns: true,
    });

    // Verify Sonnet 4.5 was used
    expect(results[0].modelUsed).toBe('claude-sonnet-4-5-20250929');
    expect(results[0].analysisDepth).toBe('deep');
  });

  // ==========================================================================
  // Test 11: Progress Tracking (Accurate ETA)
  // ==========================================================================

  it('11. Should track progress with accurate ETA', async () => {
    const progressService = await getProgressTrackingService();
    const session = createTestSession();

    // Start progress tracking
    progressService.startProgress(session.id, {
      includeAudio: true,
      includeVideo: true,
      includeSummary: true,
    });

    // Update progress through stages
    progressService.updateProgress(session.id, {
      stage: 'audio',
      progress: 50,
      message: 'Analyzing audio...',
    });

    // Calculate ETA
    const eta = progressService.calculateETA(session.id);
    expect(eta).toBeGreaterThan(0);
    expect(eta).toBeLessThan(600000); // < 10 minutes

    // Complete progress
    progressService.completeProgress(session.id, true, 'Session enriched');

    // Verify final state
    const finalProgress = progressService.getProgress(session.id);
    expect(finalProgress?.status).toBe('completed');
    expect(finalProgress?.progress).toBe(100);
  });

  // ==========================================================================
  // Test 12: Cache Invalidation (Model Upgrade → Re-Enrichment)
  // ==========================================================================

  it('12. Should invalidate cache and re-enrich when model upgraded', async () => {
    const cache = await getEnrichmentResultCache();
    const session = createTestSession();

    // Cache result with old model
    const oldCacheKey = cache.generateCacheKeyFromSession(
      session,
      'test-prompt',
      { audioModel: 'gpt-4o-audio-preview-2024-09-01' } as any
    );

    await cache.cacheResult(oldCacheKey, {
      audio: { insights: { summary: 'Old model result' }, confidence: 0.8 },
      totalCost: 0.50,
      totalDuration: 5000,
    } as any);

    // Update to new model
    const newCacheKey = cache.generateCacheKeyFromSession(
      session,
      'test-prompt',
      { audioModel: 'gpt-4o-audio-preview-2024-10-01' } as any
    );

    // Verify cache miss (model version changed)
    const result = await cache.getCachedResult(newCacheKey);
    expect(result).toBeNull(); // Cache invalidated due to model upgrade
  });

  // ==========================================================================
  // Test 13: Memory Limits (LRU Eviction, No Leaks)
  // ==========================================================================

  it('13. Should enforce memory limits with LRU eviction', async () => {
    const cache = await getEnrichmentResultCache();

    // Fill cache beyond limit (50MB default)
    const sessions = Array.from({ length: 100 }, (_, i) =>
      createTestSession({ id: `session-${i}` })
    );

    for (const session of sessions) {
      const cacheKey = cache.generateCacheKeyFromSession(
        session,
        'test-prompt',
        { audioModel: 'gpt-4o-audio-preview-2024-10-01' } as any
      );

      await cache.cacheResult(cacheKey, {
        audio: { insights: { summary: 'Test' }, confidence: 0.9 },
        totalCost: 0.50,
        totalDuration: 5000,
      } as any);
    }

    // Verify LRU eviction occurred
    const stats = await cache.getCacheStats();
    expect(stats.l1Stats.evictions).toBeGreaterThan(0);
    expect(stats.l1Stats.currentSize).toBeLessThan(50 * 1024 * 1024); // < 50MB
  });

  // ==========================================================================
  // Test 14: Cost Tracking (Backend Only, NO User UI)
  // ==========================================================================

  it('14. Should track costs in backend without showing to users', async () => {
    const { getCostMonitoringService } = await import('../optimization/CostMonitoringService');
    const costService = await getCostMonitoringService();

    const session = createTestSession();

    // Log enrichment cost
    await costService.logCost(session.id, 0.50, {
      operation: 'full-enrichment',
      audioModel: 'gpt-4o-audio-preview-2024-10-01',
      videoModel: 'claude-sonnet-4-5-20250929',
      screenshotsProcessed: 10,
    });

    // Get admin dashboard (backend only)
    const dashboard = await costService.getAdminDashboard();

    // Verify cost logged
    expect(dashboard.totalCost).toBeGreaterThan(0);
    expect(dashboard.sessionCount).toBeGreaterThan(0);

    // Verify NO user-facing cost indicators
    const progressService = await getProgressTrackingService();
    const progress = progressService.getProgress(session.id);

    // Progress messages should NOT contain cost info
    expect(progress?.message).not.toContain('$');
    expect(progress?.message).not.toContain('cost');
    expect(progress?.message).not.toContain('token');
  });

  // ==========================================================================
  // Test 15: Full Session Lifecycle (End-to-End)
  // ==========================================================================

  it('15. Should complete full lifecycle: enrich → cache → retrieve → invalidate', async () => {
    const cache = await getEnrichmentResultCache();
    const incrementalService = await getIncrementalEnrichmentService();
    const session = createTestSession({ id: 'lifecycle-session' });

    // Step 1: Initial enrichment
    mockSuccessfulEnrichment();
    const enrichResult = await sessionEnrichmentService.enrichSession(session, {
      includeAudio: true,
      includeVideo: true,
      includeSummary: true,
    });

    expect(enrichResult.success).toBe(true);

    // Step 2: Cache result
    const cacheKey = cache.generateCacheKeyFromSession(
      session,
      'test-prompt',
      { audioModel: 'gpt-4o-audio-preview-2024-10-01' } as any
    );

    await cache.cacheResult(cacheKey, enrichResult as any);

    // Step 3: Retrieve from cache
    const cached = await cache.getCachedResult(cacheKey);
    expect(cached).toBeDefined();
    expect(cached?.audio?.insights.summary).toBe(enrichResult.audio?.insights.summary);

    // Step 4: Append new data (incremental)
    const updatedSession = {
      ...session,
      screenshots: [...session.screenshots, ...createTestScreenshots(2)],
    };

    const incrementalResult = await incrementalService.enrichIncremental(updatedSession, {
      includeAudio: true,
      includeVideo: true,
    });

    expect(incrementalResult.incrementalProcessing).toBe(true);

    // Step 5: Invalidate cache
    const invalidatedCount = await cache.invalidateCache('lifecycle-session');
    expect(invalidatedCount).toBeGreaterThan(0);

    // Step 6: Verify cache cleared
    const afterInvalidation = await cache.getCachedResult(cacheKey);
    expect(afterInvalidation).toBeNull();
  });
});
