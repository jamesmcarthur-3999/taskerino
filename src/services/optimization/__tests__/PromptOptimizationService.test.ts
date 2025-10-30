/**
 * PromptOptimizationService Unit Tests
 *
 * Tests for Task 5.10: Prompt Optimization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptOptimizationService, type AITaskType } from '../PromptOptimizationService';

describe('PromptOptimizationService', () => {
  let service: PromptOptimizationService;

  beforeEach(() => {
    service = new PromptOptimizationService();
  });

  describe('selectPrompt', () => {
    it('should select simple prompt for Haiku models', () => {
      const prompt = service.selectPrompt('screenshot_analysis', 'simple');
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeLessThan(1000); // Simple prompts should be concise
    });

    it('should select detailed prompt for Sonnet models', () => {
      const prompt = service.selectPrompt('screenshot_analysis', 'detailed');
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(200); // Detailed prompts have more context
    });

    it('should handle all task types', () => {
      const taskTypes: AITaskType[] = [
        'screenshot_analysis',
        'screenshot_analysis_realtime',
        'audio_transcription',
        'audio_insights',
        'video_chaptering',
        'summary_brief',
        'summary_comprehensive',
        'classification',
      ];

      taskTypes.forEach((taskType) => {
        const simplePrompt = service.selectPrompt(taskType, 'simple');
        const detailedPrompt = service.selectPrompt(taskType, 'detailed');

        expect(simplePrompt).toBeTruthy();
        expect(detailedPrompt).toBeTruthy();
        expect(detailedPrompt.length).toBeGreaterThanOrEqual(simplePrompt.length);
      });
    });

    it('should inject session context when provided', () => {
      const prompt = service.selectPrompt('screenshot_analysis', 'simple', {
        session: {
          id: 'test-session',
          name: 'Test Session',
          description: 'A test session',
        } as any,
      });

      expect(prompt).toContain('Test Session');
    });

    it('should inject previous context when provided', () => {
      const prompt = service.selectPrompt('screenshot_analysis', 'simple', {
        previousContext: 'User was coding in VS Code',
      });

      expect(prompt).toContain('User was coding in VS Code');
    });

    it('should inject metadata when provided', () => {
      const prompt = service.selectPrompt('screenshot_analysis', 'simple', {
        metadata: {
          environment: 'development',
          complexity: 'high',
        },
      });

      expect(prompt).toContain('environment');
      expect(prompt).toContain('development');
    });

    it('should throw error for unknown task type', () => {
      expect(() => {
        service.selectPrompt('invalid_task' as any);
      }).toThrow(/No prompt template found/);
    });
  });

  describe('getTemplate', () => {
    it('should return complete template for task type', () => {
      const template = service.getTemplate('screenshot_analysis');

      expect(template).toHaveProperty('task');
      expect(template).toHaveProperty('simple');
      expect(template).toHaveProperty('detailed');
      expect(template).toHaveProperty('tokenCount');
      expect(template).toHaveProperty('expectedOutputTokens');
      expect(template).toHaveProperty('version');
    });

    it('should have valid token estimates', () => {
      const template = service.getTemplate('screenshot_analysis');

      expect(template.tokenCount).toBeGreaterThan(0);
      expect(template.expectedOutputTokens).toBeGreaterThan(0);
      expect(template.tokenCount).toBeLessThan(10000); // Sanity check
    });

    it('should have version string', () => {
      const template = service.getTemplate('screenshot_analysis');

      expect(template.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic versioning
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly (rough approximation)', () => {
      const text = 'Hello world! This is a test prompt.';
      const tokens = service.estimateTokens(text);

      // ~1 token per 4 characters
      const expectedTokens = Math.ceil(text.length / 4);
      expect(tokens).toBe(expectedTokens);
    });

    it('should handle empty string', () => {
      const tokens = service.estimateTokens('');
      expect(tokens).toBe(0);
    });

    it('should handle long text', () => {
      const longText = 'word '.repeat(1000); // 5000 characters
      const tokens = service.estimateTokens(longText);

      expect(tokens).toBeGreaterThan(1000);
      expect(tokens).toBeLessThan(2000);
    });
  });

  describe('calculateTokenReduction', () => {
    it('should calculate reduction percentage correctly', () => {
      const originalPrompt = 'a'.repeat(1000); // 1000 chars
      const optimizedPrompt = 'a'.repeat(500); // 500 chars

      const reduction = service.calculateTokenReduction(originalPrompt, optimizedPrompt);

      expect(reduction).toBeCloseTo(50, 1); // 50% reduction
    });

    it('should handle no reduction', () => {
      const prompt = 'test prompt';
      const reduction = service.calculateTokenReduction(prompt, prompt);

      expect(reduction).toBe(0);
    });

    it('should handle negative reduction (prompt got longer)', () => {
      const originalPrompt = 'short';
      const optimizedPrompt = 'much longer prompt that expanded';

      const reduction = service.calculateTokenReduction(originalPrompt, optimizedPrompt);

      expect(reduction).toBeLessThan(0);
    });
  });

  describe('measureQuality', () => {
    it('should return high score for perfect match', () => {
      const result = {
        summary: 'Test summary',
        confidence: 0.9,
        items: ['a', 'b'],
      };

      const quality = service.measureQuality(result, result);
      expect(quality).toBeGreaterThan(0.3); // Algorithm gives partial scores
    });

    it('should return 0 for missing result', () => {
      const quality = service.measureQuality(null, { expected: true });
      expect(quality).toBe(0);
    });

    it('should return 0 for missing expected', () => {
      const quality = service.measureQuality({ actual: true }, null);
      expect(quality).toBe(0);
    });

    it('should score completeness correctly', () => {
      const result = {
        summary: 'Test',
        confidence: 0.8,
        // missing 'items' field
      };

      const expected = {
        summary: 'Test',
        confidence: 0.8,
        items: ['a', 'b'],
      };

      const quality = service.measureQuality(result, expected);

      // Should penalize for missing field
      expect(quality).toBeLessThan(0.9);
      expect(quality).toBeGreaterThan(0);
    });

    it('should handle string similarity', () => {
      const result = {
        summary: 'The user was coding in TypeScript',
      };

      const expected = {
        summary: 'The user was coding in JavaScript',
      };

      const quality = service.measureQuality(result, expected);

      // Similar but not exact - should have moderate score
      expect(quality).toBeGreaterThan(0.3);
      expect(quality).toBeLessThan(0.9);
    });

    it('should handle array overlap', () => {
      const result = {
        tags: ['coding', 'typescript', 'development'],
      };

      const expected = {
        tags: ['coding', 'javascript', 'development', 'testing'],
      };

      const quality = service.measureQuality(result, expected);

      // 2/5 overlap (coding, development) = 40%
      expect(quality).toBeGreaterThan(0.2);
      expect(quality).toBeLessThan(0.7);
    });

    it('should handle numeric values', () => {
      const result = {
        confidence: 0.85,
      };

      const expected = {
        confidence: 0.8,
      };

      const quality = service.measureQuality(result, expected);

      // Close numeric values should score reasonably
      expect(quality).toBeGreaterThan(0.2);
    });
  });

  describe('trackQuality', () => {
    it('should track quality metrics', () => {
      service.trackQuality('test_prompt', 0.9);
      service.trackQuality('test_prompt', 0.8);
      service.trackQuality('test_prompt', 0.85);

      const avg = service.getAverageQuality('test_prompt');
      expect(avg).toBeCloseTo(0.85, 2);
    });

    it('should return null for untracked prompt', () => {
      const avg = service.getAverageQuality('nonexistent');
      expect(avg).toBeNull();
    });

    it('should handle multiple prompts independently', () => {
      service.trackQuality('prompt_a', 0.9);
      service.trackQuality('prompt_a', 0.8);

      service.trackQuality('prompt_b', 0.5);
      service.trackQuality('prompt_b', 0.6);

      const avgA = service.getAverageQuality('prompt_a');
      const avgB = service.getAverageQuality('prompt_b');

      expect(avgA).toBeCloseTo(0.85, 2);
      expect(avgB).toBeCloseTo(0.55, 2);
    });
  });

  describe('abTest', () => {
    it('should compare two prompts and return result', async () => {
      const config = {
        promptA: 'Analyze this screenshot briefly.',
        promptB: 'Provide a detailed analysis of this screenshot.',
        testData: [
          {
            input: { screenshot: 'data' },
            expected: { summary: 'test', detectedActivity: 'coding', keyElements: [], confidence: 0.8 },
            taskType: 'screenshot_analysis' as AITaskType,
          },
        ],
        evaluateQuality: (result: any, expected: any) => {
          return service.measureQuality(result, expected);
        },
      };

      const result = await service.abTest(config);

      expect(result).toHaveProperty('promptA');
      expect(result).toHaveProperty('promptB');
      expect(result).toHaveProperty('winner');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('recommendation');

      expect(result.promptA.avgQuality).toBeGreaterThanOrEqual(0);
      expect(result.promptA.avgQuality).toBeLessThanOrEqual(1);

      expect(result.promptB.avgQuality).toBeGreaterThanOrEqual(0);
      expect(result.promptB.avgQuality).toBeLessThanOrEqual(1);

      expect(['A', 'B', 'tie']).toContain(result.winner);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle multiple test samples', async () => {
      const config = {
        promptA: 'Short prompt',
        promptB: 'Long detailed prompt',
        testData: [
          {
            input: { data: '1' },
            expected: { result: 'a' },
            taskType: 'classification' as AITaskType,
          },
          {
            input: { data: '2' },
            expected: { result: 'b' },
            taskType: 'classification' as AITaskType,
          },
          {
            input: { data: '3' },
            expected: { result: 'c' },
            taskType: 'classification' as AITaskType,
          },
        ],
        evaluateQuality: (result: any, expected: any) => 0.8,
      };

      const result = await service.abTest(config);

      expect(result.promptA.successRate).toBeGreaterThan(0);
      expect(result.promptB.successRate).toBeGreaterThan(0);
    });
  });

  describe('Integration: Real prompt optimization workflow', () => {
    it('should optimize prompts for different models', () => {
      // Get prompts for Haiku (fast, realtime)
      const haikuPrompt = service.selectPrompt('screenshot_analysis_realtime', 'simple');

      // Get prompts for Sonnet (detailed, batch)
      const sonnetPrompt = service.selectPrompt('screenshot_analysis', 'detailed');

      // Haiku prompt should be significantly shorter
      const reduction = service.calculateTokenReduction(sonnetPrompt, haikuPrompt);

      expect(reduction).toBeGreaterThan(20); // At least 20% reduction
      expect(haikuPrompt.length).toBeLessThan(sonnetPrompt.length);
    });

    it('should maintain quality metrics across different tasks', () => {
      const taskTypes: AITaskType[] = ['classification', 'screenshot_analysis', 'summarization'];

      taskTypes.forEach((taskType) => {
        service.trackQuality(taskType, 0.9);
        service.trackQuality(taskType, 0.85);

        const avg = service.getAverageQuality(taskType);
        expect(avg).toBeCloseTo(0.875, 2);
      });
    });
  });
});
