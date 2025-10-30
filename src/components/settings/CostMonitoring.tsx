/**
 * Cost Monitoring Settings Component (Task 5.12 UI)
 *
 * Admin-only cost monitoring dashboard hidden under Settings → Advanced.
 *
 * CRITICAL: NO cost indicators in main UI, NO alerts during normal usage.
 * This is opt-in viewing only for admins/developers.
 *
 * Features:
 * - Current spend (today, this month)
 * - Projections and budget status
 * - Breakdowns by model and task type
 * - Trends visualization
 * - Budget configuration
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  BarChart3,
  Settings,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { costMonitoringService, type CostDashboard, type BudgetConfig } from '../../services/optimization/CostMonitoringService';
import { Button } from '../Button';
import { Input } from '../Input';

export function CostMonitoringSettings() {
  const [dashboard, setDashboard] = useState<CostDashboard | null>(null);
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig | null>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [loading, setLoading] = useState(true);

  // Budget form state
  const [dailyLimit, setDailyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [exceedAction, setExceedAction] = useState<'warn' | 'block' | 'continue'>('continue');
  const [budgetEnabled, setBudgetEnabled] = useState(false);

  // Load dashboard data
  useEffect(() => {
    loadDashboard();

    // Refresh every 30 seconds
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await costMonitoringService.getAdminDashboard();
      const config = await costMonitoringService.getBudgetConfig();

      setDashboard(data);
      setBudgetConfig(config);

      // Initialize budget form
      if (config.dailyLimit) setDailyLimit(config.dailyLimit.toString());
      if (config.monthlyLimit) setMonthlyLimit(config.monthlyLimit.toString());
      setExceedAction(config.exceedAction);
      setBudgetEnabled(config.enabled);
    } catch (error) {
      console.error('[CostMonitoring] Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBudget = async () => {
    try {
      const config: Partial<BudgetConfig> = {
        enabled: budgetEnabled,
        exceedAction,
      };

      if (dailyLimit) {
        config.dailyLimit = parseFloat(dailyLimit);
      }

      if (monthlyLimit) {
        config.monthlyLimit = parseFloat(monthlyLimit);
      }

      await costMonitoringService.updateBudgetConfig(config);
      await loadDashboard();
      setIsEditingBudget(false);
    } catch (error) {
      console.error('[CostMonitoring] Failed to save budget config:', error);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  if (loading || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400 dark:text-gray-500">Loading cost data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Cost Monitoring Dashboard
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Track AI API costs for session enrichment. This data is for admin use only and never shown to users.
        </p>
      </div>

      {/* Current Spending */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Today</span>
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(dashboard.current.todaySpend)}
          </div>
          {dashboard.current.yesterdaySpend > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Yesterday: {formatCurrency(dashboard.current.yesterdaySpend)}
            </div>
          )}
        </div>

        <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">This Month</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(dashboard.current.monthSpend)}
          </div>
          {dashboard.current.lastMonthSpend > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Last month: {formatCurrency(dashboard.current.lastMonthSpend)}
            </div>
          )}
        </div>
      </div>

      {/* Projections */}
      <div className="bg-blue-50/50 dark:bg-blue-900/20 backdrop-blur-sm rounded-lg p-4 border border-blue-200/50 dark:border-blue-700/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Projections</span>
          <TrendingUp className="w-4 h-4 text-blue-500" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-700 dark:text-blue-300">Projected Month-End</span>
            <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              {formatCurrency(dashboard.projections.projectedMonthly)}
            </span>
          </div>
          {dashboard.projections.budgetRemaining !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-700 dark:text-blue-300">Budget Remaining</span>
              <span className={`text-sm font-semibold ${dashboard.projections.budgetRemaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {formatCurrency(dashboard.projections.budgetRemaining)}
              </span>
            </div>
          )}
          {dashboard.projections.daysUntilBudgetExhausted !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-700 dark:text-blue-300">Days Until Budget Exhausted</span>
              <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                {dashboard.projections.daysUntilBudgetExhausted} days
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Trend */}
      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">30-Day Trend</span>
          {dashboard.trends.trend === 'increasing' && (
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Increasing</span>
            </div>
          )}
          {dashboard.trends.trend === 'decreasing' && (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Decreasing</span>
            </div>
          )}
          {dashboard.trends.trend === 'stable' && (
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <Minus className="w-4 h-4" />
              <span className="text-xs font-medium">Stable</span>
            </div>
          )}
        </div>
        <div className="text-xs text-gray-500 mb-2">
          Avg daily: {formatCurrency(dashboard.trends.avgDailyCost)}
        </div>
        {/* Mini chart - simplified bars */}
        <div className="flex items-end gap-0.5 h-16">
          {dashboard.trends.dailyCosts.slice(-30).map((day, index) => {
            const maxCost = Math.max(...dashboard.trends.dailyCosts.map(d => d.cost), 0.01);
            const heightPercent = (day.cost / maxCost) * 100;
            return (
              <div
                key={day.date}
                className="flex-1 bg-blue-500/30 rounded-t"
                style={{ height: `${heightPercent}%` }}
                title={`${day.date}: ${formatCurrency(day.cost)}`}
              />
            );
          })}
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-2 gap-4">
        {/* By Model */}
        <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">By Model</span>
            <BarChart3 className="w-4 h-4 text-gray-400" />
          </div>
          <div className="space-y-2">
            {Object.entries(dashboard.breakdowns.byModel)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([model, cost]) => (
                <div key={model} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate" title={model}>
                    {model.split('-').slice(0, 2).join(' ')}
                  </span>
                  <span className="text-xs font-medium text-gray-900 dark:text-white">
                    {formatCurrency(cost)}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* By Task Type */}
        <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">By Task</span>
            <BarChart3 className="w-4 h-4 text-gray-400" />
          </div>
          <div className="space-y-2">
            {Object.entries(dashboard.breakdowns.byTaskType)
              .sort((a, b) => b[1] - a[1])
              .map(([taskType, cost]) => (
                <div key={taskType} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {taskType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-medium text-gray-900 dark:text-white">
                    {formatCurrency(cost)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Top Sessions */}
      {dashboard.breakdowns.topSessions.length > 0 && (
        <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Top 10 Most Expensive Sessions
            </span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {dashboard.breakdowns.topSessions.map((session, index) => (
              <div key={session.sessionId} className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs text-gray-400 w-5">#{index + 1}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate" title={session.sessionName}>
                    {session.sessionName}
                  </span>
                </div>
                <span className="text-xs font-medium text-gray-900 dark:text-white ml-2">
                  {formatCurrency(session.cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Configuration */}
      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Budget Configuration
            </span>
          </div>
          <button
            onClick={() => setIsEditingBudget(!isEditingBudget)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isEditingBudget ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {!isEditingBudget ? (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Status</span>
              <span className={`font-medium ${budgetConfig?.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                {budgetConfig?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {budgetConfig?.dailyLimit && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Daily Limit</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(budgetConfig.dailyLimit)}
                </span>
              </div>
            )}
            {budgetConfig?.monthlyLimit && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Monthly Limit</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(budgetConfig.monthlyLimit)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Exceed Action</span>
              <span className="font-medium text-gray-900 dark:text-white capitalize">
                {budgetConfig?.exceedAction || 'continue'}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={budgetEnabled}
                onChange={(e) => setBudgetEnabled(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <label className="text-xs text-gray-700 dark:text-gray-300">Enable Budget Enforcement</label>
            </div>

            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                Daily Limit (USD)
              </label>
              <Input
                type="number"
                step="0.01"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                placeholder="e.g., 5.00"
                className="text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                Monthly Limit (USD)
              </label>
              <Input
                type="number"
                step="0.01"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                placeholder="e.g., 100.00"
                className="text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                When Budget Exceeded
              </label>
              <select
                value={exceedAction}
                onChange={(e) => setExceedAction(e.target.value as 'warn' | 'block' | 'continue')}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
              >
                <option value="continue">Continue (log warning)</option>
                <option value="warn">Warn in console</option>
                <option value="block">Block operation</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleSaveBudget} size="sm" className="flex-1">
                <Check className="w-3 h-3 mr-1" />
                Save Budget
              </Button>
              <Button
                onClick={() => setIsEditingBudget(false)}
                size="sm"
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Budget Status (if enabled) */}
      {dashboard.budget && (
        <div className="space-y-3">
          {dashboard.budget.daily && (
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Daily Budget</span>
                {dashboard.budget.daily.percentUsed >= 100 && (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {formatCurrency(dashboard.budget.daily.spent)} / {formatCurrency(dashboard.budget.daily.limit)}
                  </span>
                  <span className={`font-medium ${dashboard.budget.daily.percentUsed >= 100 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    {formatPercent(dashboard.budget.daily.percentUsed)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${dashboard.budget.daily.percentUsed >= 100 ? 'bg-red-500' : dashboard.budget.daily.percentUsed >= 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, dashboard.budget.daily.percentUsed)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {dashboard.budget.monthly && (
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Monthly Budget</span>
                {dashboard.budget.monthly.percentUsed >= 100 && (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {formatCurrency(dashboard.budget.monthly.spent)} / {formatCurrency(dashboard.budget.monthly.limit)}
                  </span>
                  <span className={`font-medium ${dashboard.budget.monthly.percentUsed >= 100 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    {formatPercent(dashboard.budget.monthly.percentUsed)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${dashboard.budget.monthly.percentUsed >= 100 ? 'bg-red-500' : dashboard.budget.monthly.percentUsed >= 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, dashboard.budget.monthly.percentUsed)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Note */}
      <div className="bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-lg p-3 border border-gray-200/50 dark:border-gray-700/50">
        <p className="text-xs text-gray-600 dark:text-gray-400 italic">
          <strong>Note:</strong> This dashboard is for admin/developer use only. Cost data is never displayed
          to end users and all budget enforcement happens silently in the background.
        </p>
      </div>
    </div>
  );
}
