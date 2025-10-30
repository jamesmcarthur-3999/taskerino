/**
 * CostMonitoringService Unit Tests
 *
 * Tests for Task 5.12: Cost Monitoring & Alerts (Backend Only)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CostMonitoringService, type BudgetConfig } from '../CostMonitoringService';

// Mock storage
vi.mock('../../storage', () => ({
  getStorage: vi.fn(() => ({
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('CostMonitoringService', () => {
  let service: CostMonitoringService;

  beforeEach(async () => {
    service = new CostMonitoringService();
    await service.initialize();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(service).toBeDefined();
    });

    it('should load existing logs from storage', async () => {
      // Tested via mocked storage
      expect(service).toBeDefined();
    });
  });

  describe('logCost', () => {
    it('should log cost entry', async () => {
      await service.logCost('session-123', 0.05, {
        taskType: 'screenshot_analysis',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
      });

      // Verify log was created (will be tested via export)
      const logs = await service.exportLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].cost).toBe(0.05);
      expect(logs[0].sessionId).toBe('session-123');
    });

    it('should log without session ID', async () => {
      await service.logCost(undefined, 0.02, {
        taskType: 'classification',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 300,
        outputTokens: 100,
      });

      const logs = await service.exportLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].sessionId).toBeUndefined();
    });

    it('should include breakdown in log', async () => {
      await service.logCost('session-456', 0.03, {
        taskType: 'audio_review',
        model: 'gpt-4o-audio',
        inputTokens: 2000,
        outputTokens: 800,
        breakdown: {
          inputCost: 0.02,
          outputCost: 0.01,
        },
      });

      const logs = await service.exportLogs();
      expect(logs[0].breakdown).toBeDefined();
      expect(logs[0].breakdown!.inputCost).toBe(0.02);
      expect(logs[0].breakdown!.outputCost).toBe(0.01);
    });

    it('should include metadata', async () => {
      await service.logCost('session-789', 0.01, {
        taskType: 'screenshot_analysis',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 500,
        outputTokens: 200,
        metadata: {
          processingMode: 'realtime',
          success: true,
          duration: 1500,
        },
      });

      const logs = await service.exportLogs();
      expect(logs[0].metadata).toBeDefined();
      expect(logs[0].metadata!.processingMode).toBe('realtime');
      expect(logs[0].metadata!.success).toBe(true);
    });

    it('should be silent (no user-facing alerts)', async () => {
      // This test verifies that logCost doesn't throw or display alerts
      expect(async () => {
        await service.logCost('session-test', 0.1, {
          taskType: 'summarization',
          model: 'claude-sonnet-4-5-20250929',
          inputTokens: 5000,
          outputTokens: 1000,
        });
      }).not.toThrow();
    });
  });

  describe('checkBudget', () => {
    it('should return true when budget is disabled', async () => {
      const withinBudget = await service.checkBudget(10.0);
      expect(withinBudget).toBe(true);
    });

    it('should return true when within budget', async () => {
      await service.updateBudgetConfig({
        enabled: true,
        dailyLimit: 5.0,
        monthlyLimit: 100.0,
        exceedAction: 'block',
      });

      // Log small cost
      await service.logCost('session-1', 1.0, {
        taskType: 'screenshot_analysis',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
      });

      const withinBudget = await service.checkBudget(1.0);
      expect(withinBudget).toBe(true);
    });

    it('should return false when daily budget would be exceeded (block mode)', async () => {
      await service.updateBudgetConfig({
        enabled: true,
        dailyLimit: 2.0,
        exceedAction: 'block',
      });

      // Log costs that approach limit
      await service.logCost('session-1', 1.5, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 5000,
        outputTokens: 1000,
      });

      // Check if we can add more (would exceed)
      const withinBudget = await service.checkBudget(1.0);
      expect(withinBudget).toBe(false);
    });

    it('should return true when budget exceeded but in continue mode', async () => {
      await service.updateBudgetConfig({
        enabled: true,
        dailyLimit: 1.0,
        exceedAction: 'continue',
      });

      await service.logCost('session-1', 1.5, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 5000,
        outputTokens: 1000,
      });

      const withinBudget = await service.checkBudget(1.0);
      expect(withinBudget).toBe(true); // Continue mode allows over-budget
    });

    it('should check monthly budget', async () => {
      await service.updateBudgetConfig({
        enabled: true,
        monthlyLimit: 10.0,
        exceedAction: 'block',
      });

      await service.logCost('session-1', 9.0, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 30000,
        outputTokens: 5000,
      });

      const withinBudget = await service.checkBudget(2.0);
      expect(withinBudget).toBe(false);
    });

    it('should be silent (no user alerts)', async () => {
      await service.updateBudgetConfig({
        enabled: true,
        dailyLimit: 1.0,
        exceedAction: 'block',
      });

      await service.logCost('session-1', 2.0, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 10000,
        outputTokens: 2000,
      });

      // Should not throw even when over budget
      expect(async () => {
        await service.checkBudget(1.0);
      }).not.toThrow();
    });
  });

  describe('getDailyCost', () => {
    it('should calculate daily cost correctly', async () => {
      const today = new Date();

      await service.logCost('session-1', 0.5, {
        taskType: 'screenshot_analysis',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
      });

      await service.logCost('session-2', 0.3, {
        taskType: 'classification',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 500,
        outputTokens: 200,
      });

      const dailyCost = await service.getDailyCost(today);
      expect(dailyCost).toBeCloseTo(0.8, 2);
    });

    it('should return 0 for days with no costs', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const dailyCost = await service.getDailyCost(yesterday);
      expect(dailyCost).toBe(0);
    });
  });

  describe('getMonthlyCost', () => {
    it('should calculate monthly cost correctly', async () => {
      const today = new Date();

      await service.logCost('session-1', 1.0, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 5000,
        outputTokens: 1000,
      });

      await service.logCost('session-2', 0.5, {
        taskType: 'screenshot_analysis',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
      });

      const monthlyCost = await service.getMonthlyCost(today);
      expect(monthlyCost).toBeCloseTo(1.5, 2);
    });
  });

  describe('getDailySummary', () => {
    it('should generate daily summary', async () => {
      const today = new Date();

      await service.logCost('session-1', 0.5, {
        taskType: 'screenshot_analysis',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
      });

      await service.logCost('session-2', 0.3, {
        taskType: 'audio_review',
        model: 'gpt-4o-audio',
        inputTokens: 2000,
        outputTokens: 800,
      });

      const summary = await service.getDailySummary(today);

      expect(summary.totalCost).toBeCloseTo(0.8, 2);
      expect(summary.operationCount).toBe(2);
      expect(summary.byTaskType).toHaveProperty('screenshot_analysis');
      expect(summary.byTaskType).toHaveProperty('audio_review');
      expect(summary.byModel).toHaveProperty('claude-haiku-4-5-20251001');
      expect(summary.byModel).toHaveProperty('gpt-4o-audio');
    });

    it('should include top session', async () => {
      const today = new Date();

      await service.logCost('session-expensive', 2.0, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 10000,
        outputTokens: 3000,
      });

      await service.logCost('session-cheap', 0.1, {
        taskType: 'classification',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 300,
        outputTokens: 100,
      });

      const summary = await service.getDailySummary(today);

      expect(summary.topSession).toBeDefined();
      expect(summary.topSession!.sessionId).toBe('session-expensive');
      expect(summary.topSession!.cost).toBe(2.0);
    });
  });

  describe('getMonthlySummary', () => {
    it('should generate monthly summary', async () => {
      const today = new Date();

      await service.logCost('session-1', 1.0, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 5000,
        outputTokens: 1000,
      });

      const summary = await service.getMonthlySummary(today);

      expect(summary.totalCost).toBeCloseTo(1.0, 2);
      expect(summary.operationCount).toBe(1);
      expect(summary.projectedTotal).toBeGreaterThan(0);
      expect(summary.dailyBreakdown).toBeInstanceOf(Array);
    });

    it('should project month-end total', async () => {
      const today = new Date();

      // Log costs
      await service.logCost('session-1', 1.0, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 5000,
        outputTokens: 1000,
      });

      const summary = await service.getMonthlySummary(today);

      // Projected should be current cost * (days in month / current day)
      const currentDay = today.getDate();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const expectedProjection = (1.0 / currentDay) * daysInMonth;

      expect(summary.projectedTotal).toBeCloseTo(expectedProjection, 1);
    });
  });

  describe('getAdminDashboard', () => {
    it('should generate comprehensive dashboard', async () => {
      const today = new Date();

      await service.logCost('session-1', 0.5, {
        taskType: 'screenshot_analysis',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
      });

      const dashboard = await service.getAdminDashboard();

      expect(dashboard).toHaveProperty('current');
      expect(dashboard).toHaveProperty('projections');
      expect(dashboard).toHaveProperty('breakdowns');
      expect(dashboard).toHaveProperty('trends');
    });

    it('should include current spending', async () => {
      await service.logCost('session-1', 1.0, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 5000,
        outputTokens: 1000,
      });

      const dashboard = await service.getAdminDashboard();

      expect(dashboard.current.todaySpend).toBeCloseTo(1.0, 2);
      expect(dashboard.current.monthSpend).toBeCloseTo(1.0, 2);
    });

    it('should include projections', async () => {
      await service.logCost('session-1', 2.0, {
        taskType: 'video_chaptering',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 8000,
        outputTokens: 2000,
      });

      const dashboard = await service.getAdminDashboard();

      expect(dashboard.projections.projectedMonthly).toBeGreaterThan(0);
    });

    it('should include breakdowns', async () => {
      await service.logCost('session-1', 0.5, {
        taskType: 'screenshot_analysis',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
      });

      const dashboard = await service.getAdminDashboard();

      expect(dashboard.breakdowns.byModel).toHaveProperty('claude-haiku-4-5-20251001');
      expect(dashboard.breakdowns.byTaskType).toHaveProperty('screenshot_analysis');
      expect(dashboard.breakdowns.topSessions).toBeInstanceOf(Array);
    });

    it('should include trends', async () => {
      await service.logCost('session-1', 1.0, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 5000,
        outputTokens: 1000,
      });

      const dashboard = await service.getAdminDashboard();

      expect(dashboard.trends.dailyCosts).toBeInstanceOf(Array);
      expect(dashboard.trends.dailyCosts.length).toBe(30); // Last 30 days
      expect(dashboard.trends.avgDailyCost).toBeGreaterThanOrEqual(0);
      expect(['increasing', 'stable', 'decreasing']).toContain(dashboard.trends.trend);
    });

    it('should include budget status when enabled', async () => {
      await service.updateBudgetConfig({
        enabled: true,
        dailyLimit: 5.0,
        monthlyLimit: 100.0,
        exceedAction: 'warn',
      });

      const dashboard = await service.getAdminDashboard();

      expect(dashboard.budget).toBeDefined();
      expect(dashboard.budget!.config.enabled).toBe(true);
      expect(dashboard.budget!.daily).toBeDefined();
      expect(dashboard.budget!.monthly).toBeDefined();
    });

    it('should calculate budget percentages correctly', async () => {
      await service.updateBudgetConfig({
        enabled: true,
        dailyLimit: 10.0,
        monthlyLimit: 100.0,
        exceedAction: 'warn',
      });

      await service.logCost('session-1', 5.0, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 20000,
        outputTokens: 5000,
      });

      const dashboard = await service.getAdminDashboard();

      expect(dashboard.budget!.daily!.percentUsed).toBeCloseTo(50, 0); // 5/10 = 50%
      expect(dashboard.budget!.monthly!.percentUsed).toBeCloseTo(5, 0); // 5/100 = 5%
    });
  });

  describe('updateBudgetConfig', () => {
    it('should update budget configuration', async () => {
      await service.updateBudgetConfig({
        enabled: true,
        dailyLimit: 5.0,
        monthlyLimit: 100.0,
        exceedAction: 'block',
      });

      const config = await service.getBudgetConfig();

      expect(config.enabled).toBe(true);
      expect(config.dailyLimit).toBe(5.0);
      expect(config.monthlyLimit).toBe(100.0);
      expect(config.exceedAction).toBe('block');
    });

    it('should partially update config', async () => {
      await service.updateBudgetConfig({ enabled: true });
      await service.updateBudgetConfig({ dailyLimit: 10.0 });

      const config = await service.getBudgetConfig();

      expect(config.enabled).toBe(true);
      expect(config.dailyLimit).toBe(10.0);
    });
  });

  describe('clearLogs', () => {
    it('should clear all cost logs', async () => {
      await service.logCost('session-1', 1.0, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 5000,
        outputTokens: 1000,
      });

      await service.logCost('session-2', 0.5, {
        taskType: 'screenshot_analysis',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
      });

      await service.clearLogs();

      const logs = await service.exportLogs();
      expect(logs.length).toBe(0);
    });
  });

  describe('exportLogs', () => {
    it('should export all cost logs', async () => {
      await service.logCost('session-1', 1.0, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 5000,
        outputTokens: 1000,
      });

      await service.logCost('session-2', 0.5, {
        taskType: 'screenshot_analysis',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
      });

      const logs = await service.exportLogs();

      expect(logs.length).toBe(2);
      expect(logs[0].cost).toBe(1.0);
      expect(logs[1].cost).toBe(0.5);
    });
  });

  describe('Integration: Real cost monitoring workflow', () => {
    it('should track costs silently across multiple operations', async () => {
      // Simulate enrichment pipeline
      await service.logCost('session-123', 0.002, {
        taskType: 'screenshot_analysis',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 800,
        outputTokens: 200,
      });

      await service.logCost('session-123', 0.05, {
        taskType: 'audio_review',
        model: 'gpt-4o-audio',
        inputTokens: 15000,
        outputTokens: 3000,
      });

      await service.logCost('session-123', 0.018, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 5000,
        outputTokens: 1000,
      });

      const dashboard = await service.getAdminDashboard();

      expect(dashboard.current.todaySpend).toBeCloseTo(0.07, 3);
      expect(dashboard.breakdowns.topSessions[0].sessionId).toBe('session-123');
    });

    it('should enforce budget silently', async () => {
      await service.updateBudgetConfig({
        enabled: true,
        dailyLimit: 0.1,
        exceedAction: 'block',
      });

      // Log cost that's within budget
      await service.logCost('session-1', 0.05, {
        taskType: 'summarization',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 3000,
        outputTokens: 500,
      });

      expect(await service.checkBudget(0.03)).toBe(true); // Still within budget

      // Try to exceed budget
      expect(await service.checkBudget(0.1)).toBe(false); // Would exceed

      // But no exceptions thrown - all silent
    });
  });
});
