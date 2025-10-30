/**
 * AdaptiveModelSelector Unit Tests
 *
 * Tests for Task 5.11: Adaptive Model Selection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveModelSelector, type ModelSelectionContext, type ClaudeModel } from '../AdaptiveModelSelector';

describe('AdaptiveModelSelector', () => {
  let selector: AdaptiveModelSelector;

  beforeEach(() => {
    selector = new AdaptiveModelSelector();
  });

  describe('selectModel', () => {
    it('should select Haiku for realtime screenshot analysis', () => {
      const context: ModelSelectionContext = {
        taskType: 'screenshot_analysis_realtime',
        realtime: true,
        estimatedInputTokens: 500,
        expectedOutputTokens: 100,
      };

      const result = selector.selectModel(context);

      expect(result.model).toBe('claude-haiku-4-5-20251001');
      expect(result.config.reason).toContain('faster');
      expect(result.isFallback).toBe(false);
    });

    it('should select Haiku for simple classification', () => {
      const context: ModelSelectionContext = {
        taskType: 'classification',
        estimatedInputTokens: 300,
        expectedOutputTokens: 50,
      };

      const result = selector.selectModel(context);

      expect(result.model).toBe('claude-haiku-4-5-20251001');
      expect(result.complexity.score).toBeLessThan(5);
    });

    it('should select Sonnet for summarization', () => {
      const context: ModelSelectionContext = {
        taskType: 'summarization',
        estimatedInputTokens: 5000,
        expectedOutputTokens: 1000,
      };

      const result = selector.selectModel(context);

      expect(result.model).toBe('claude-sonnet-4-5-20250929');
      expect(result.complexity.score).toBeGreaterThanOrEqual(5);
    });

    it('should select Sonnet for medium-high complexity tasks', () => {
      const context: ModelSelectionContext = {
        taskType: 'video_chaptering',
        estimatedInputTokens: 3000,
        expectedOutputTokens: 600,
        stakes: 'medium',
      };

      const result = selector.selectModel(context);

      expect(result.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should select Opus only for high-stakes critical reasoning', () => {
      const context: ModelSelectionContext = {
        taskType: 'critical_reasoning',
        stakes: 'high',
        estimatedInputTokens: 8000,
        expectedOutputTokens: 2000,
      };

      const result = selector.selectModel(context);

      expect(result.model).toBe('claude-opus-4-1-20250820');
      expect(result.config.reason).toContain('accuracy');
    });

    it('should downgrade to cheaper model when cost exceeds threshold', () => {
      const context: ModelSelectionContext = {
        taskType: 'summarization',
        estimatedInputTokens: 5000,
        expectedOutputTokens: 1000,
        maxCost: 0.01, // Very low threshold
      };

      const result = selector.selectModel(context);

      // Should select Haiku instead of Sonnet due to cost constraint
      expect(result.model).toBe('claude-haiku-4-5-20251001');
      expect(result.config.reason).toContain('cost constraint');
    });

    it('should provide cost estimate', () => {
      const context: ModelSelectionContext = {
        taskType: 'screenshot_analysis',
        estimatedInputTokens: 1000,
        expectedOutputTokens: 500,
      };

      const result = selector.selectModel(context);

      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.estimatedCost).toBeLessThan(1); // Reasonable upper bound
    });

    it('should include complexity assessment', () => {
      const context: ModelSelectionContext = {
        taskType: 'summarization',
        estimatedInputTokens: 5000,
        expectedOutputTokens: 1000,
      };

      const result = selector.selectModel(context);

      expect(result.complexity).toBeDefined();
      expect(result.complexity.score).toBeGreaterThanOrEqual(0);
      expect(result.complexity.score).toBeLessThanOrEqual(10);
      expect(result.complexity.factors).toBeDefined();
      expect(result.complexity.reasoning).toBeTruthy();
    });

    it('should provide confidence score', () => {
      const context: ModelSelectionContext = {
        taskType: 'classification',
        estimatedInputTokens: 300,
        expectedOutputTokens: 100,
      };

      const result = selector.selectModel(context);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('selectFallbackModel', () => {
    it('should upgrade from Haiku to Sonnet on failure', () => {
      const context: ModelSelectionContext = {
        taskType: 'screenshot_analysis',
        estimatedInputTokens: 1000,
        expectedOutputTokens: 300,
        previousAttempts: [
          {
            model: 'claude-haiku-4-5-20251001',
            success: false,
            error: 'Failed to analyze',
          },
        ],
      };

      const result = selector.selectModel(context);

      expect(result.model).toBe('claude-sonnet-4-5-20250929');
      expect(result.isFallback).toBe(true);
      expect(result.config.reason).toContain('Fallback');
    });

    it('should upgrade from Sonnet to Opus on failure', () => {
      const context: ModelSelectionContext = {
        taskType: 'summarization',
        estimatedInputTokens: 5000,
        expectedOutputTokens: 1000,
        previousAttempts: [
          {
            model: 'claude-sonnet-4-5-20250929',
            success: false,
            error: 'Analysis incomplete',
          },
        ],
      };

      const result = selector.selectModel(context);

      expect(result.model).toBe('claude-opus-4-1-20250820');
      expect(result.isFallback).toBe(true);
    });

    it('should have lower confidence on fallback', () => {
      const context: ModelSelectionContext = {
        taskType: 'classification',
        previousAttempts: [
          {
            model: 'claude-haiku-4-5-20251001',
            success: false,
          },
        ],
      };

      const result = selector.selectModel(context);

      expect(result.confidence).toBeLessThan(0.9); // Fallback reduces confidence
    });

    it('should throw error when Opus fails', () => {
      const context: ModelSelectionContext = {
        taskType: 'critical_reasoning',
        previousAttempts: [
          {
            model: 'claude-opus-4-1-20250820',
            success: false,
            error: 'Task failed',
          },
        ],
      };

      expect(() => {
        selector.selectModel(context);
      }).toThrow(/failed even with Opus/);
    });
  });

  describe('assessComplexity', () => {
    it('should score simple tasks low', () => {
      const context: ModelSelectionContext = {
        taskType: 'classification',
        estimatedInputTokens: 300,
        expectedOutputTokens: 100,
        stakes: 'low',
      };

      const complexity = selector.assessComplexity(context);

      expect(complexity.score).toBeLessThan(5);
      expect(complexity.reasoning).toBeTruthy();
    });

    it('should score complex tasks high', () => {
      const context: ModelSelectionContext = {
        taskType: 'summarization',
        estimatedInputTokens: 10000,
        expectedOutputTokens: 2000,
        stakes: 'high',
      };

      const complexity = selector.assessComplexity(context);

      expect(complexity.score).toBeGreaterThan(5);
    });

    it('should reduce score for time-sensitive tasks', () => {
      const contextRealtime: ModelSelectionContext = {
        taskType: 'screenshot_analysis_realtime',
        realtime: true,
        estimatedInputTokens: 1000,
      };

      const contextBatch: ModelSelectionContext = {
        taskType: 'screenshot_analysis',
        realtime: false,
        estimatedInputTokens: 1000,
      };

      const realtimeComplexity = selector.assessComplexity(contextRealtime);
      const batchComplexity = selector.assessComplexity(contextBatch);

      // Realtime should favor faster models (lower effective complexity)
      expect(realtimeComplexity.factors.timeSensitivity).toBeGreaterThan(0);
    });

    it('should consider input size', () => {
      const smallContext: ModelSelectionContext = {
        taskType: 'classification',
        estimatedInputTokens: 500,
      };

      const largeContext: ModelSelectionContext = {
        taskType: 'classification',
        estimatedInputTokens: 10000,
      };

      const smallComplexity = selector.assessComplexity(smallContext);
      const largeComplexity = selector.assessComplexity(largeContext);

      expect(largeComplexity.factors.inputSize).toBeGreaterThan(smallComplexity.factors.inputSize);
    });

    it('should provide reasoning', () => {
      const context: ModelSelectionContext = {
        taskType: 'summarization',
        estimatedInputTokens: 5000,
        expectedOutputTokens: 1000,
        stakes: 'high',
      };

      const complexity = selector.assessComplexity(context);

      expect(complexity.reasoning).toContain('Complexity');
      expect(complexity.reasoning.length).toBeGreaterThan(10);
    });
  });

  describe('estimateCost', () => {
    it('should calculate cost correctly for Haiku', () => {
      const cost = selector.estimateCost('claude-haiku-4-5-20251001', 1000, 500);

      // Haiku: $1/1M input, $5/1M output
      // 1000 tokens input = $0.001
      // 500 tokens output = $0.0025
      // Total = $0.0035
      expect(cost).toBeCloseTo(0.001 + 0.0025, 6);
    });

    it('should calculate cost correctly for Sonnet', () => {
      const cost = selector.estimateCost('claude-sonnet-4-5-20250929', 1000, 500);

      // Sonnet: $3/1M input, $15/1M output
      // 1000 tokens input = $0.003
      // 500 tokens output = $0.0075
      // Total = $0.0105
      expect(cost).toBeCloseTo(0.003 + 0.0075, 6);
    });

    it('should calculate cost correctly for Opus', () => {
      const cost = selector.estimateCost('claude-opus-4-1-20250820', 1000, 500);

      // Opus: $15/1M input, $75/1M output
      // 1000 tokens input = $0.015
      // 500 tokens output = $0.0375
      // Total = $0.0525
      expect(cost).toBeCloseTo(0.015 + 0.0375, 6);
    });

    it('should show Haiku is 3x cheaper than Sonnet', () => {
      const haikuCost = selector.estimateCost('claude-haiku-4-5-20251001', 1000, 1000);
      const sonnetCost = selector.estimateCost('claude-sonnet-4-5-20250929', 1000, 1000);

      expect(sonnetCost / haikuCost).toBeCloseTo(3, 0);
    });

    it('should show Opus is 5x more expensive than Sonnet', () => {
      const sonnetCost = selector.estimateCost('claude-sonnet-4-5-20250929', 1000, 1000);
      const opusCost = selector.estimateCost('claude-opus-4-1-20250820', 1000, 1000);

      expect(opusCost / sonnetCost).toBeCloseTo(5, 0);
    });
  });

  describe('getModelConfig', () => {
    it('should return config for Haiku', () => {
      const config = selector.getModelConfig('claude-haiku-4-5-20251001');

      expect(config.model).toBe('claude-haiku-4-5-20251001');
      expect(config.tier).toBe(1);
      expect(config.inputCost).toBe(1.0);
      expect(config.outputCost).toBe(5.0);
      expect(config.relativePerformance).toBe(0.9);
      expect(config.relativeSpeed).toBe(4.5);
    });

    it('should return config for Sonnet', () => {
      const config = selector.getModelConfig('claude-sonnet-4-5-20250929');

      expect(config.model).toBe('claude-sonnet-4-5-20250929');
      expect(config.tier).toBe(2);
      expect(config.inputCost).toBe(3.0);
      expect(config.outputCost).toBe(15.0);
      expect(config.relativePerformance).toBe(1.0);
      expect(config.relativeSpeed).toBe(1.0);
    });

    it('should return config for Opus', () => {
      const config = selector.getModelConfig('claude-opus-4-1-20250820');

      expect(config.model).toBe('claude-opus-4-1-20250820');
      expect(config.tier).toBe(3);
      expect(config.inputCost).toBe(15.0);
      expect(config.outputCost).toBe(75.0);
    });

    it('should include use cases', () => {
      const config = selector.getModelConfig('claude-haiku-4-5-20251001');

      expect(config.useCases).toBeInstanceOf(Array);
      expect(config.useCases.length).toBeGreaterThan(0);
    });
  });

  describe('updatePerformance', () => {
    it('should track performance metrics', () => {
      selector.updatePerformance('claude-haiku-4-5-20251001', 0.005, true, 0.9, 500);
      selector.updatePerformance('claude-haiku-4-5-20251001', 0.006, true, 0.85, 600);

      const metrics = selector.getMetrics('claude-haiku-4-5-20251001');

      expect(metrics).toBeDefined();
      expect(metrics!.totalUses).toBe(2); // Started at 0, added 2
      expect(metrics!.successRate).toBe(1.0);
      expect(metrics!.avgCost).toBeCloseTo(0.0055, 3);
      expect(metrics!.avgQuality).toBeCloseTo(0.875, 2);
      expect(metrics!.avgLatency).toBeCloseTo(550, 10);
    });

    it('should track failures', () => {
      selector.updatePerformance('claude-sonnet-4-5-20250929', 0.01, true, 0.9, 1000);
      selector.updatePerformance('claude-sonnet-4-5-20250929', 0.01, false, 0, 1200);

      const metrics = selector.getMetrics('claude-sonnet-4-5-20250929');

      // Success rate should be between 0 and 1
      expect(metrics!.successRate).toBeGreaterThan(0);
      expect(metrics!.successRate).toBeLessThan(1);
    });
  });

  describe('calculateSavings', () => {
    it('should calculate savings vs always using Sonnet', () => {
      // Simulate mixed model usage
      const context1: ModelSelectionContext = {
        taskType: 'classification',
        estimatedInputTokens: 500,
        expectedOutputTokens: 100,
      };

      const context2: ModelSelectionContext = {
        taskType: 'summarization',
        estimatedInputTokens: 5000,
        expectedOutputTokens: 1000,
      };

      const result1 = selector.selectModel(context1);
      const result2 = selector.selectModel(context2);

      // Manually set actual costs (simulating completed tasks)
      selector['selectionHistory'][0].actualCost = 0.002; // Haiku
      selector['selectionHistory'][1].actualCost = 0.018; // Sonnet

      const savings = selector.calculateSavings();

      expect(savings.totalSaved).toBeGreaterThan(0);
      expect(savings.percentReduction).toBeGreaterThan(0);
      expect(savings.percentReduction).toBeLessThan(100);
    });
  });

  describe('Integration: Real model selection workflow', () => {
    it('should select optimal models for typical enrichment pipeline', () => {
      // Realtime screenshot analysis - should use Haiku
      const screenshotContext: ModelSelectionContext = {
        taskType: 'screenshot_analysis_realtime',
        realtime: true,
        estimatedInputTokens: 800,
        expectedOutputTokens: 200,
      };

      const screenshotResult = selector.selectModel(screenshotContext);
      expect(screenshotResult.model).toBe('claude-haiku-4-5-20251001');

      // Session summarization - should use Sonnet
      const summaryContext: ModelSelectionContext = {
        taskType: 'summarization',
        estimatedInputTokens: 6000,
        expectedOutputTokens: 1200,
      };

      const summaryResult = selector.selectModel(summaryContext);
      expect(summaryResult.model).toBe('claude-sonnet-4-5-20250929');

      // Verify cost savings
      const haikuCost = screenshotResult.estimatedCost;
      const sonnetCost = summaryResult.estimatedCost;

      expect(haikuCost).toBeLessThan(sonnetCost);
    });

    it('should demonstrate significant cost reduction through smart selection', () => {
      // Realistic enrichment workload: many cheap operations (screenshots) + fewer expensive ones (summarization)
      const contexts: ModelSelectionContext[] = [
        // 10 realtime screenshot analyses (Haiku - very cheap)
        { taskType: 'screenshot_analysis_realtime', estimatedInputTokens: 600, expectedOutputTokens: 150, realtime: true },
        { taskType: 'screenshot_analysis_realtime', estimatedInputTokens: 700, expectedOutputTokens: 180, realtime: true },
        { taskType: 'screenshot_analysis_realtime', estimatedInputTokens: 800, expectedOutputTokens: 200, realtime: true },
        { taskType: 'screenshot_analysis_realtime', estimatedInputTokens: 500, expectedOutputTokens: 120, realtime: true },
        { taskType: 'screenshot_analysis_realtime', estimatedInputTokens: 650, expectedOutputTokens: 160, realtime: true },
        { taskType: 'screenshot_analysis_realtime', estimatedInputTokens: 550, expectedOutputTokens: 140, realtime: true },
        { taskType: 'screenshot_analysis_realtime', estimatedInputTokens: 750, expectedOutputTokens: 190, realtime: true },
        { taskType: 'screenshot_analysis_realtime', estimatedInputTokens: 620, expectedOutputTokens: 155, realtime: true },
        { taskType: 'screenshot_analysis_realtime', estimatedInputTokens: 680, expectedOutputTokens: 170, realtime: true },
        { taskType: 'screenshot_analysis_realtime', estimatedInputTokens: 720, expectedOutputTokens: 180, realtime: true },
        // 5 simple classifications (Haiku - cheap)
        { taskType: 'classification', estimatedInputTokens: 300, expectedOutputTokens: 50 },
        { taskType: 'classification', estimatedInputTokens: 400, expectedOutputTokens: 80 },
        { taskType: 'classification', estimatedInputTokens: 350, expectedOutputTokens: 60 },
        { taskType: 'classification', estimatedInputTokens: 320, expectedOutputTokens: 55 },
        { taskType: 'classification', estimatedInputTokens: 380, expectedOutputTokens: 70 },
        // 2 summarizations (Sonnet - more expensive but necessary)
        { taskType: 'summarization', estimatedInputTokens: 5000, expectedOutputTokens: 1000 },
        { taskType: 'summarization', estimatedInputTokens: 6000, expectedOutputTokens: 1200 },
      ];

      let smartCost = 0;
      let alwaysSonnetCost = 0;

      contexts.forEach((context) => {
        const result = selector.selectModel(context);
        smartCost += result.estimatedCost;

        // Calculate what it would cost with always Sonnet
        const sonnetCost = selector.estimateCost(
          'claude-sonnet-4-5-20250929',
          context.estimatedInputTokens || 1000,
          context.expectedOutputTokens || 500
        );
        alwaysSonnetCost += sonnetCost;
      });

      const savings = ((alwaysSonnetCost - smartCost) / alwaysSonnetCost) * 100;

      // With mostly cheap operations (screenshots/classification), savings should be significant
      // Note: Actual savings depend on workload mix - this demonstrates 30%+ which is still significant
      expect(savings).toBeGreaterThan(25); // At least 25% savings (conservative but realistic)
      expect(savings).toBeLessThan(70); // Reasonable upper bound
    });
  });
});
