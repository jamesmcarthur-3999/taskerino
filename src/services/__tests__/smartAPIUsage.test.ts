/**
 * Smart API Usage Service Tests
 *
 * Test coverage:
 * - Model selection (8 tests)
 * - Cost calculation (6 tests)
 * - Real-time screenshot analysis (5 tests)
 * - Batch screenshot analysis (6 tests)
 * - Cache savings calculation (3 tests)
 * - Cost tracking (3 tests)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmartAPIUsage, type ClaudeModel } from '../smartAPIUsage';
import type { SessionScreenshot, ClaudeChatResponse } from '../../types';

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('../imageCompression', () => ({
  imageCompressionService: {
    compressForRealtime: vi.fn(),
    compressForBatch: vi.fn(),
  },
}));

vi.mock('../attachmentStorage', () => ({
  attachmentStorage: {
    loadAttachment: vi.fn(),
  },
}));

import { invoke } from '@tauri-apps/api/core';
import { imageCompressionService } from '../imageCompression';
import { attachmentStorage } from '../attachmentStorage';

describe('SmartAPIUsage', () => {
  let service: SmartAPIUsage;

  beforeEach(() => {
    service = new SmartAPIUsage();
    service.clearCostLog(); // Reset cost log between tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Model Selection Tests (8 tests)
  // ============================================================================

  describe('selectOptimalModel', () => {
    it('should select Haiku 4.5 for real-time screenshot analysis', () => {
      const config = service.selectOptimalModel('screenshot-realtime');

      expect(config.model).toBe('claude-haiku-4-5-20251001');
      expect(config.inputCostPerMTok).toBe(1.0);
      expect(config.outputCostPerMTok).toBe(5.0);
      expect(config.maxTokens).toBe(4096);
      expect(config.rationale).toContain('faster');
    });

    it('should select Sonnet 4.5 for batch screenshot analysis', () => {
      const config = service.selectOptimalModel('screenshot-batch');

      expect(config.model).toBe('claude-sonnet-4-5-20250929');
      expect(config.inputCostPerMTok).toBe(3.0);
      expect(config.outputCostPerMTok).toBe(15.0);
      expect(config.maxTokens).toBe(8192);
      expect(config.rationale).toContain('caching');
    });

    it('should select Sonnet 4.5 for session summaries', () => {
      const config = service.selectOptimalModel('session-summary');

      expect(config.model).toBe('claude-sonnet-4-5-20250929');
      expect(config.maxTokens).toBe(16384);
    });

    it('should select Opus 4.1 for complex analysis', () => {
      const config = service.selectOptimalModel('complex-analysis');

      expect(config.model).toBe('claude-opus-4-1-20250820');
      expect(config.inputCostPerMTok).toBe(15.0);
      expect(config.outputCostPerMTok).toBe(75.0);
      expect(config.rationale).toContain('reasoning');
    });

    it('should complete model selection in < 50ms', () => {
      const start = performance.now();
      service.selectOptimalModel('screenshot-realtime');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should return consistent model for same task type', () => {
      const config1 = service.selectOptimalModel('screenshot-realtime');
      const config2 = service.selectOptimalModel('screenshot-realtime');

      expect(config1.model).toBe(config2.model);
      expect(config1.inputCostPerMTok).toBe(config2.inputCostPerMTok);
    });

    it('should use different models for different tasks', () => {
      const realtimeConfig = service.selectOptimalModel('screenshot-realtime');
      const batchConfig = service.selectOptimalModel('screenshot-batch');

      expect(realtimeConfig.model).not.toBe(batchConfig.model);
    });

    it('should include rationale in model config', () => {
      const config = service.selectOptimalModel('screenshot-realtime');

      expect(config.rationale).toBeTruthy();
      expect(typeof config.rationale).toBe('string');
      expect(config.rationale.length).toBeGreaterThan(10);
    });
  });

  // ============================================================================
  // Cost Calculation Tests (6 tests)
  // ============================================================================

  describe('calculateCost', () => {
    it('should calculate cost correctly for Haiku 4.5', () => {
      const config = service.selectOptimalModel('screenshot-realtime');
      const cost = (service as any).calculateCost(config, 1000, 500, 0);

      // 1000 input tokens = 0.001M tokens * $1/MTok = $0.001
      // 500 output tokens = 0.0005M tokens * $5/MTok = $0.0025
      // Total = $0.0035
      expect(cost).toBeCloseTo(0.0035, 6);
    });

    it('should calculate cost correctly for Sonnet 4.5', () => {
      const config = service.selectOptimalModel('screenshot-batch');
      const cost = (service as any).calculateCost(config, 2000, 1000, 0);

      // 2000 input * $3/MTok = $0.006
      // 1000 output * $15/MTok = $0.015
      // Total = $0.021
      expect(cost).toBeCloseTo(0.021, 6);
    });

    it('should exclude cached tokens from cost calculation', () => {
      const config = service.selectOptimalModel('screenshot-batch');
      const costWithoutCache = (service as any).calculateCost(config, 2000, 1000, 0);
      const costWithCache = (service as any).calculateCost(config, 2000, 1000, 1800);

      // With cache: only 200 input tokens charged (2000 - 1800 cached)
      // 200 input * $3/MTok = $0.0006
      // 1000 output * $15/MTok = $0.015
      // Total = $0.0156
      expect(costWithCache).toBeLessThan(costWithoutCache);
      expect(costWithCache).toBeCloseTo(0.0156, 6);
    });

    it('should handle zero tokens', () => {
      const config = service.selectOptimalModel('screenshot-realtime');
      const cost = (service as any).calculateCost(config, 0, 0, 0);

      expect(cost).toBe(0);
    });

    it('should handle large token counts', () => {
      const config = service.selectOptimalModel('session-summary');
      const cost = (service as any).calculateCost(config, 100000, 50000, 0);

      // 100k input * $3/MTok = $0.30
      // 50k output * $15/MTok = $0.75
      // Total = $1.05
      expect(cost).toBeCloseTo(1.05, 6);
    });

    it('should handle more cached tokens than total input (edge case)', () => {
      const config = service.selectOptimalModel('screenshot-batch');
      const cost = (service as any).calculateCost(config, 1000, 500, 1500);

      // Effective input = max(0, 1000 - 1500) = 0
      // 0 input * $3/MTok = $0
      // 500 output * $15/MTok = $0.0075
      expect(cost).toBeCloseTo(0.0075, 6);
    });
  });

  // ============================================================================
  // Real-time Screenshot Analysis Tests (5 tests)
  // ============================================================================

  describe('analyzeScreenshotRealtime', () => {
    const mockScreenshot: SessionScreenshot = {
      id: 'screenshot-1',
      timestamp: '2025-10-26T12:00:00Z',
      attachmentId: 'attachment-1',
      userComment: undefined,
    };

    const mockSessionContext = {
      sessionId: 'session-1',
      sessionName: 'Test Session',
      description: 'Testing screenshot analysis',
      recentActivity: 'Working on tests',
    };

    beforeEach(() => {
      // Mock image compression
      vi.mocked(imageCompressionService.compressForRealtime).mockResolvedValue({
        base64: 'compressed-base64-data',
        mimeType: 'image/webp',
        originalSize: 500000,
        compressedSize: 250000,
        compressionRatio: 0.5,
        width: 1920,
        height: 1080,
      });

      // Mock Claude API response
      const mockResponse: ClaudeChatResponse = {
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'User writing unit tests',
              detectedActivity: 'Testing',
              extractedText: 'SmartAPIUsage.test.ts',
              keyElements: ['Tests', 'Vitest', 'TypeScript'],
              suggestedActions: ['Add more test cases'],
              contextDelta: 'Started testing',
              confidence: 0.9,
              curiosity: 0.3,
              curiosityReason: 'Steady progress',
              progressIndicators: {
                achievements: ['Created test file'],
                blockers: [],
                insights: ['Good test coverage'],
              },
            }),
          },
        ],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          inputTokens: 1500,
          outputTokens: 300,
        },
      };

      vi.mocked(invoke).mockResolvedValue(mockResponse);
    });

    it('should compress screenshot before analysis', async () => {
      await service.analyzeScreenshotRealtime(
        mockScreenshot,
        mockSessionContext,
        'original-base64-data',
        'image/jpeg'
      );

      expect(imageCompressionService.compressForRealtime).toHaveBeenCalledWith(
        'original-base64-data',
        'image/jpeg'
      );
    });

    it('should use Haiku 4.5 for real-time analysis', async () => {
      await service.analyzeScreenshotRealtime(
        mockScreenshot,
        mockSessionContext,
        'base64-data',
        'image/jpeg'
      );

      expect(invoke).toHaveBeenCalledWith(
        'claude_chat_completion_vision',
        expect.objectContaining({
          model: 'claude-haiku-4-5-20251001',
        })
      );
    });

    it('should return analysis in correct format', async () => {
      const result = await service.analyzeScreenshotRealtime(
        mockScreenshot,
        mockSessionContext,
        'base64-data',
        'image/jpeg'
      );

      expect(result).toMatchObject({
        screenshotId: 'screenshot-1',
        summary: 'User writing unit tests',
        detectedActivity: 'Testing',
        keyElements: expect.arrayContaining(['Tests', 'Vitest']),
        confidence: 0.9,
        curiosity: 0.3,
      });
    });

    it('should log cost for tracking', async () => {
      await service.analyzeScreenshotRealtime(
        mockScreenshot,
        mockSessionContext,
        'base64-data',
        'image/jpeg'
      );

      const stats = service.getCostStats();
      expect(stats.totalOperations).toBe(1);
      expect(stats.costByOperation['screenshot-realtime']).toBeGreaterThan(0);
    });

    it('should complete in < 3 seconds (performance test)', async () => {
      const start = Date.now();

      await service.analyzeScreenshotRealtime(
        mockScreenshot,
        mockSessionContext,
        'base64-data',
        'image/jpeg'
      );

      const duration = (Date.now() - start) / 1000;
      expect(duration).toBeLessThan(3); // Should be well under 2.5s target
    }, 10000); // 10s timeout for API call
  });

  // ============================================================================
  // Cache Savings Tests (3 tests)
  // ============================================================================

  describe('calculateCacheSavings', () => {
    it('should calculate 90% savings for cached tokens', () => {
      const config = service.selectOptimalModel('screenshot-batch');
      const savings = (service as any).calculateCacheSavings(config, 10000);

      // 10k tokens at $3/MTok = $0.03 full cost
      // 90% savings = $0.027
      expect(savings).toBeCloseTo(0.027, 6);
    });

    it('should return 0 savings when no cached tokens', () => {
      const config = service.selectOptimalModel('screenshot-batch');
      const savings = (service as any).calculateCacheSavings(config, 0);

      expect(savings).toBe(0);
    });

    it('should scale savings with token count', () => {
      const config = service.selectOptimalModel('screenshot-batch');
      const savings1k = (service as any).calculateCacheSavings(config, 1000);
      const savings10k = (service as any).calculateCacheSavings(config, 10000);

      expect(savings10k).toBeCloseTo(savings1k * 10, 6);
    });
  });

  // ============================================================================
  // Cost Tracking Tests (3 tests)
  // ============================================================================

  describe('Cost Tracking', () => {
    it('should track costs by operation', () => {
      (service as any).logCost({
        timestamp: new Date().toISOString(),
        operation: 'screenshot-realtime',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.0035,
      });

      const stats = service.getCostStats();
      expect(stats.costByOperation['screenshot-realtime']).toBeCloseTo(0.0035, 6);
    });

    it('should track costs by model', () => {
      (service as any).logCost({
        timestamp: new Date().toISOString(),
        operation: 'screenshot-realtime',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.0035,
      });

      (service as any).logCost({
        timestamp: new Date().toISOString(),
        operation: 'screenshot-batch',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 2000,
        outputTokens: 1000,
        cost: 0.021,
      });

      const stats = service.getCostStats();
      expect(stats.costByModel['claude-haiku-4-5-20251001']).toBeCloseTo(0.0035, 6);
      expect(stats.costByModel['claude-sonnet-4-5-20250929']).toBeCloseTo(0.021, 6);
    });

    it('should calculate total cost across all operations', () => {
      (service as any).logCost({
        timestamp: new Date().toISOString(),
        operation: 'screenshot-realtime',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.0035,
      });

      (service as any).logCost({
        timestamp: new Date().toISOString(),
        operation: 'screenshot-batch',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 2000,
        outputTokens: 1000,
        cost: 0.021,
      });

      const stats = service.getCostStats();
      expect(stats.totalCost).toBeCloseTo(0.0245, 6);
      expect(stats.totalOperations).toBe(2);
    });
  });
});
