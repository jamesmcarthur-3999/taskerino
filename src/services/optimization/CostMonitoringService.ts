/**
 * Cost Monitoring & Alerts Service (Task 5.12)
 *
 * Backend-only cost tracking with optional Settings UI for admins.
 *
 * CRITICAL CONSTRAINTS:
 * - NO cost indicators in main Sessions UI
 * - NO cost alerts/popups during normal usage
 * - ALL enforcement happens silently in backend
 * - Settings UI hidden under Advanced section (admin-only viewing)
 *
 * Features:
 * - Real-time cost logging per session and task
 * - Daily/monthly aggregation
 * - Silent budget enforcement
 * - Breakdown by model, task type, session
 * - Admin dashboard data (opt-in viewing only)
 * - < 1 minute reporting latency
 * - 100% accurate cost attribution
 *
 * Target: Zero user-facing cost anxiety, 100% silent enforcement
 */

import { getStorage } from '../storage';
import type { ClaudeModel } from './AdaptiveModelSelector';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CostLogEntry {
  /** Unique log entry ID */
  id: string;

  /** Timestamp of cost event */
  timestamp: string;

  /** Session ID (if applicable) */
  sessionId?: string;

  /** Task type that incurred cost */
  taskType:
    | 'screenshot_analysis'
    | 'audio_review'
    | 'video_chaptering'
    | 'summarization'
    | 'other';

  /** Model used */
  model: ClaudeModel | 'gpt-4o-audio';

  /** Input tokens */
  inputTokens: number;

  /** Output tokens */
  outputTokens: number;

  /** Total cost in USD */
  cost: number;

  /** Cost breakdown */
  breakdown?: {
    inputCost: number;
    outputCost: number;
    additionalCosts?: number; // e.g., image processing
  };

  /** Additional metadata */
  metadata?: {
    /** Realtime vs batch processing */
    processingMode?: 'realtime' | 'batch';

    /** Success or failure */
    success?: boolean;

    /** Error if failed */
    error?: string;

    /** Duration in ms */
    duration?: number;
  };
}

export interface DailyCostSummary {
  /** Date (YYYY-MM-DD) */
  date: string;

  /** Total cost for the day */
  totalCost: number;

  /** Number of operations */
  operationCount: number;

  /** Breakdown by task type */
  byTaskType: Record<string, { cost: number; count: number }>;

  /** Breakdown by model */
  byModel: Record<string, { cost: number; count: number }>;

  /** Most expensive session */
  topSession?: { sessionId: string; sessionName: string; cost: number };
}

export interface MonthlyCostSummary {
  /** Month (YYYY-MM) */
  month: string;

  /** Total cost for the month */
  totalCost: number;

  /** Number of operations */
  operationCount: number;

  /** Daily breakdown */
  dailyBreakdown: DailyCostSummary[];

  /** Breakdown by task type */
  byTaskType: Record<string, { cost: number; count: number }>;

  /** Breakdown by model */
  byModel: Record<string, { cost: number; count: number }>;

  /** Projected month-end total (based on daily average) */
  projectedTotal: number;
}

export interface BudgetConfig {
  /** Daily budget limit (USD) */
  dailyLimit?: number;

  /** Monthly budget limit (USD) */
  monthlyLimit?: number;

  /** Action when budget exceeded */
  exceedAction: 'warn' | 'block' | 'continue';

  /** Alert thresholds (% of budget) */
  alertThresholds?: number[]; // e.g., [50, 75, 90, 100]

  /** Whether budget enforcement is enabled */
  enabled: boolean;
}

export interface CostDashboard {
  /** Current spending */
  current: {
    /** Today's spend */
    todaySpend: number;

    /** This month's spend */
    monthSpend: number;

    /** Yesterday's spend (for comparison) */
    yesterdaySpend: number;

    /** Last month's spend (for comparison) */
    lastMonthSpend: number;
  };

  /** Projections */
  projections: {
    /** Projected month-end total */
    projectedMonthly: number;

    /** Budget remaining (if budget set) */
    budgetRemaining?: number;

    /** Days until budget exhausted (if current rate continues) */
    daysUntilBudgetExhausted?: number;
  };

  /** Breakdowns */
  breakdowns: {
    /** Cost by model (all-time) */
    byModel: Record<string, number>;

    /** Cost by task type (all-time) */
    byTaskType: Record<string, number>;

    /** Top 10 most expensive sessions */
    topSessions: Array<{ sessionId: string; sessionName: string; cost: number }>;
  };

  /** Trends */
  trends: {
    /** Daily costs for last 30 days */
    dailyCosts: Array<{ date: string; cost: number }>;

    /** Average daily cost (last 30 days) */
    avgDailyCost: number;

    /** Cost trend (increasing/stable/decreasing) */
    trend: 'increasing' | 'stable' | 'decreasing';
  };

  /** Budget status (if configured) */
  budget?: {
    /** Budget config */
    config: BudgetConfig;

    /** Daily budget status */
    daily?: {
      limit: number;
      spent: number;
      remaining: number;
      percentUsed: number;
    };

    /** Monthly budget status */
    monthly?: {
      limit: number;
      spent: number;
      remaining: number;
      percentUsed: number;
    };
  };
}

// ============================================================================
// Cost Monitoring Service
// ============================================================================

export class CostMonitoringService {
  private costLogs: CostLogEntry[] = [];
  private budgetConfig: BudgetConfig = {
    enabled: false,
    exceedAction: 'continue',
  };

  private initialized = false;
  private storageKey = 'cost_monitoring_logs';
  private budgetConfigKey = 'cost_budget_config';

  /**
   * Initialize service (load from storage)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const storage = await getStorage();

      // Load cost logs
      const logs = await storage.load<CostLogEntry[]>(this.storageKey);
      if (logs) {
        this.costLogs = logs;
      }

      // Load budget config
      const config = await storage.load<BudgetConfig>(this.budgetConfigKey);
      if (config) {
        this.budgetConfig = config;
      }

      this.initialized = true;
      console.log(`[CostMonitoring] Initialized with ${this.costLogs.length} cost entries`);
    } catch (error) {
      console.error('[CostMonitoring] Failed to initialize:', error);
    }
  }

  /**
   * Log a cost event
   *
   * IMPORTANT: This is silent - no user-facing alerts
   */
  async logCost(
    sessionId: string | undefined,
    cost: number,
    metadata: {
      taskType: CostLogEntry['taskType'];
      model: CostLogEntry['model'];
      inputTokens: number;
      outputTokens: number;
      breakdown?: CostLogEntry['breakdown'];
      metadata?: CostLogEntry['metadata'];
    }
  ): Promise<void> {
    await this.initialize();

    const entry: CostLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      sessionId,
      taskType: metadata.taskType,
      model: metadata.model,
      inputTokens: metadata.inputTokens,
      outputTokens: metadata.outputTokens,
      cost,
      breakdown: metadata.breakdown,
      metadata: metadata.metadata,
    };

    this.costLogs.push(entry);

    // Persist to storage (async, non-blocking)
    this.persistLogs();

    console.log(`[CostMonitoring] Logged cost: $${cost.toFixed(4)} (${metadata.taskType}, ${metadata.model})`);
  }

  /**
   * Check if estimated cost is within budget
   *
   * IMPORTANT: Returns true/false silently - no user alerts
   *
   * @param estimatedCost - Estimated cost in USD
   * @returns Whether cost is within budget
   */
  async checkBudget(estimatedCost: number): Promise<boolean> {
    await this.initialize();

    if (!this.budgetConfig.enabled) {
      return true; // No budget enforcement
    }

    // Check daily budget
    if (this.budgetConfig.dailyLimit) {
      const todaySpend = await this.getDailyCost(new Date());
      if (todaySpend + estimatedCost > this.budgetConfig.dailyLimit) {
        console.warn(
          `[CostMonitoring] Daily budget would be exceeded: $${todaySpend.toFixed(2)} + $${estimatedCost.toFixed(2)} > $${this.budgetConfig.dailyLimit}`
        );

        if (this.budgetConfig.exceedAction === 'block') {
          return false;
        }
      }
    }

    // Check monthly budget
    if (this.budgetConfig.monthlyLimit) {
      const monthSpend = await this.getMonthlyCost(new Date());
      if (monthSpend + estimatedCost > this.budgetConfig.monthlyLimit) {
        console.warn(
          `[CostMonitoring] Monthly budget would be exceeded: $${monthSpend.toFixed(2)} + $${estimatedCost.toFixed(2)} > $${this.budgetConfig.monthlyLimit}`
        );

        if (this.budgetConfig.exceedAction === 'block') {
          return false;
        }
      }
    }

    return true; // Within budget or configured to continue
  }

  /**
   * Get total cost for a specific day
   */
  async getDailyCost(date: Date): Promise<number> {
    await this.initialize();

    const dateStr = this.formatDate(date);
    return this.costLogs
      .filter((log) => log.timestamp.startsWith(dateStr))
      .reduce((sum, log) => sum + log.cost, 0);
  }

  /**
   * Get total cost for a specific month
   */
  async getMonthlyCost(date: Date): Promise<number> {
    await this.initialize();

    const monthStr = this.formatMonth(date);
    return this.costLogs
      .filter((log) => log.timestamp.startsWith(monthStr))
      .reduce((sum, log) => sum + log.cost, 0);
  }

  /**
   * Get daily cost summary
   */
  async getDailySummary(date: Date): Promise<DailyCostSummary> {
    await this.initialize();

    const dateStr = this.formatDate(date);
    const logs = this.costLogs.filter((log) => log.timestamp.startsWith(dateStr));

    const byTaskType: Record<string, { cost: number; count: number }> = {};
    const byModel: Record<string, { cost: number; count: number }> = {};
    const sessionCosts: Map<string, { name: string; cost: number }> = new Map();

    logs.forEach((log) => {
      // By task type
      if (!byTaskType[log.taskType]) {
        byTaskType[log.taskType] = { cost: 0, count: 0 };
      }
      byTaskType[log.taskType].cost += log.cost;
      byTaskType[log.taskType].count++;

      // By model
      if (!byModel[log.model]) {
        byModel[log.model] = { cost: 0, count: 0 };
      }
      byModel[log.model].cost += log.cost;
      byModel[log.model].count++;

      // Session costs
      if (log.sessionId) {
        const existing = sessionCosts.get(log.sessionId) || { name: 'Unknown', cost: 0 };
        existing.cost += log.cost;
        sessionCosts.set(log.sessionId, existing);
      }
    });

    // Find top session
    let topSession: DailyCostSummary['topSession'];
    if (sessionCosts.size > 0) {
      const sorted = Array.from(sessionCosts.entries()).sort((a, b) => b[1].cost - a[1].cost);
      const [sessionId, data] = sorted[0];
      topSession = { sessionId, sessionName: data.name, cost: data.cost };
    }

    return {
      date: dateStr,
      totalCost: logs.reduce((sum, log) => sum + log.cost, 0),
      operationCount: logs.length,
      byTaskType,
      byModel,
      topSession,
    };
  }

  /**
   * Get monthly cost summary
   */
  async getMonthlySummary(date: Date): Promise<MonthlyCostSummary> {
    await this.initialize();

    const monthStr = this.formatMonth(date);
    const logs = this.costLogs.filter((log) => log.timestamp.startsWith(monthStr));

    const byTaskType: Record<string, { cost: number; count: number }> = {};
    const byModel: Record<string, { cost: number; count: number }> = {};

    logs.forEach((log) => {
      // By task type
      if (!byTaskType[log.taskType]) {
        byTaskType[log.taskType] = { cost: 0, count: 0 };
      }
      byTaskType[log.taskType].cost += log.cost;
      byTaskType[log.taskType].count++;

      // By model
      if (!byModel[log.model]) {
        byModel[log.model] = { cost: 0, count: 0 };
      }
      byModel[log.model].cost += log.cost;
      byModel[log.model].count++;
    });

    // Calculate daily breakdown
    const dailyBreakdown: DailyCostSummary[] = [];
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(date.getFullYear(), date.getMonth(), day);
      const summary = await this.getDailySummary(dayDate);
      dailyBreakdown.push(summary);
    }

    // Project month-end total
    const currentDay = date.getDate();
    const totalCost = logs.reduce((sum, log) => sum + log.cost, 0);
    const avgDailyCost = totalCost / currentDay;
    const projectedTotal = avgDailyCost * daysInMonth;

    return {
      month: monthStr,
      totalCost,
      operationCount: logs.length,
      dailyBreakdown,
      byTaskType,
      byModel,
      projectedTotal,
    };
  }

  /**
   * Get admin dashboard data
   *
   * IMPORTANT: This is opt-in viewing only - no automatic alerts
   */
  async getAdminDashboard(): Promise<CostDashboard> {
    await this.initialize();

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Current spending
    const todaySpend = await this.getDailyCost(now);
    const monthSpend = await this.getMonthlyCost(now);
    const yesterdaySpend = await this.getDailyCost(yesterday);
    const lastMonthSpend = await this.getMonthlyCost(lastMonth);

    // Projections
    const currentDay = now.getDate();
    const avgDailyCost = monthSpend / currentDay;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthly = avgDailyCost * daysInMonth;

    // Budget remaining
    let budgetRemaining: number | undefined;
    let daysUntilBudgetExhausted: number | undefined;

    if (this.budgetConfig.monthlyLimit) {
      budgetRemaining = this.budgetConfig.monthlyLimit - monthSpend;
      if (avgDailyCost > 0) {
        daysUntilBudgetExhausted = Math.floor(budgetRemaining / avgDailyCost);
      }
    }

    // Breakdowns (all-time)
    const byModel: Record<string, number> = {};
    const byTaskType: Record<string, number> = {};
    const sessionCosts: Map<string, { name: string; cost: number }> = new Map();

    this.costLogs.forEach((log) => {
      // By model
      byModel[log.model] = (byModel[log.model] || 0) + log.cost;

      // By task type
      byTaskType[log.taskType] = (byTaskType[log.taskType] || 0) + log.cost;

      // Session costs
      if (log.sessionId) {
        const existing = sessionCosts.get(log.sessionId) || { name: 'Unknown', cost: 0 };
        existing.cost += log.cost;
        sessionCosts.set(log.sessionId, existing);
      }
    });

    // Top 10 sessions
    const topSessions = Array.from(sessionCosts.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 10)
      .map(([sessionId, data]) => ({
        sessionId,
        sessionName: data.name,
        cost: data.cost,
      }));

    // Daily costs for last 30 days
    const dailyCosts: Array<{ date: string; cost: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const cost = await this.getDailyCost(date);
      dailyCosts.push({ date: this.formatDate(date), cost });
    }

    // Calculate trend
    const last7Days = dailyCosts.slice(-7);
    const prev7Days = dailyCosts.slice(-14, -7);
    const last7Avg = last7Days.reduce((sum, d) => sum + d.cost, 0) / 7;
    const prev7Avg = prev7Days.reduce((sum, d) => sum + d.cost, 0) / 7;

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (last7Avg > prev7Avg * 1.1) {
      trend = 'increasing';
    } else if (last7Avg < prev7Avg * 0.9) {
      trend = 'decreasing';
    }

    // Budget status
    let budget: CostDashboard['budget'];
    if (this.budgetConfig.enabled) {
      budget = { config: this.budgetConfig };

      if (this.budgetConfig.dailyLimit) {
        budget.daily = {
          limit: this.budgetConfig.dailyLimit,
          spent: todaySpend,
          remaining: this.budgetConfig.dailyLimit - todaySpend,
          percentUsed: (todaySpend / this.budgetConfig.dailyLimit) * 100,
        };
      }

      if (this.budgetConfig.monthlyLimit) {
        budget.monthly = {
          limit: this.budgetConfig.monthlyLimit,
          spent: monthSpend,
          remaining: this.budgetConfig.monthlyLimit - monthSpend,
          percentUsed: (monthSpend / this.budgetConfig.monthlyLimit) * 100,
        };
      }
    }

    return {
      current: {
        todaySpend,
        monthSpend,
        yesterdaySpend,
        lastMonthSpend,
      },
      projections: {
        projectedMonthly,
        budgetRemaining,
        daysUntilBudgetExhausted,
      },
      breakdowns: {
        byModel,
        byTaskType,
        topSessions,
      },
      trends: {
        dailyCosts,
        avgDailyCost,
        trend,
      },
      budget,
    };
  }

  /**
   * Update budget configuration
   */
  async updateBudgetConfig(config: Partial<BudgetConfig>): Promise<void> {
    await this.initialize();

    this.budgetConfig = { ...this.budgetConfig, ...config };

    // Persist to storage
    const storage = await getStorage();
    await storage.save(this.budgetConfigKey, this.budgetConfig);

    console.log('[CostMonitoring] Budget config updated:', this.budgetConfig);
  }

  /**
   * Get current budget configuration
   */
  async getBudgetConfig(): Promise<BudgetConfig> {
    await this.initialize();
    return { ...this.budgetConfig };
  }

  /**
   * Clear all cost logs (admin action)
   */
  async clearLogs(): Promise<void> {
    this.costLogs = [];
    await this.persistLogs();
    console.log('[CostMonitoring] All cost logs cleared');
  }

  /**
   * Export cost logs as JSON (for analysis)
   */
  async exportLogs(): Promise<CostLogEntry[]> {
    await this.initialize();
    return [...this.costLogs];
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Persist cost logs to storage (non-blocking)
   */
  private async persistLogs(): Promise<void> {
    try {
      const storage = await getStorage();
      await storage.save(this.storageKey, this.costLogs);
    } catch (error) {
      console.error('[CostMonitoring] Failed to persist logs:', error);
    }
  }

  /**
   * Generate unique ID for cost entry
   */
  private generateId(): string {
    return `cost-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Format date as YYYY-MM
   */
  private formatMonth(date: Date): string {
    return date.toISOString().substring(0, 7);
  }
}

/**
 * Export singleton instance
 */
export const costMonitoringService = new CostMonitoringService();
