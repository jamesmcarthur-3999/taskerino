/**
 * ActionReviewDashboard - Bulk Action Management Interface
 *
 * Aggregates all actions for bulk review and execution.
 * Shows summary stats, allows selective execution, and tracks progress.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  Square,
  FileText,
  ListTodo,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  TrendingUp,
  Package,
} from 'lucide-react';
import type { ActionReviewDashboardProps, Action } from '../types';
import { getGlassClasses, getRadiusClass, CANVAS_COMPONENTS, TRANSITIONS } from '../../../design-system/theme';

interface ActionState {
  action: Action;
  selected: boolean;
  status: 'pending' | 'executing' | 'success' | 'error';
  error?: string;
}

interface ActionGroup {
  type: 'create_task' | 'create_note' | 'update_task' | 'update_note';
  label: string;
  icon: React.ReactNode;
  actions: ActionState[];
  color: string;
}

export function ActionReviewDashboard({
  collectAllActions = false,
  actions = [],
  showStats = true,
  allowBulk = true,
  title = 'Action Review Dashboard',
  theme = 'default',
  onBulkComplete,
}: ActionReviewDashboardProps) {
  const [actionStates, setActionStates] = useState<ActionState[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentExecutingIndex, setCurrentExecutingIndex] = useState(-1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const themeClasses = CANVAS_COMPONENTS.themes[theme];

  // Initialize action states
  useEffect(() => {
    const initialStates: ActionState[] = actions.map((action) => ({
      action,
      selected: true, // Default to all selected
      status: 'pending',
    }));
    setActionStates(initialStates);

    // Expand all groups by default
    const types = new Set(actions.map((a) => a.type));
    setExpandedGroups(new Set(Array.from(types)));
  }, [actions]);

  // Group actions by type
  const groupedActions = useMemo<ActionGroup[]>(() => {
    const groups: Record<string, ActionGroup> = {
      create_task: {
        type: 'create_task',
        label: 'Create Tasks',
        icon: <ListTodo className="w-5 h-5" />,
        actions: [],
        color: 'blue',
      },
      create_note: {
        type: 'create_note',
        label: 'Create Notes',
        icon: <FileText className="w-5 h-5" />,
        actions: [],
        color: 'cyan',
      },
      update_task: {
        type: 'update_task',
        label: 'Update Tasks',
        icon: <RefreshCw className="w-5 h-5" />,
        actions: [],
        color: 'purple',
      },
      update_note: {
        type: 'update_note',
        label: 'Update Notes',
        icon: <RefreshCw className="w-5 h-5" />,
        actions: [],
        color: 'purple',
      },
    };

    actionStates.forEach((state) => {
      const type = state.action.type;
      if (type in groups) {
        groups[type].actions.push(state);
      }
    });

    return Object.values(groups).filter((g) => g.actions.length > 0);
  }, [actionStates]);

  // Calculate stats
  const stats = useMemo(() => {
    const selected = actionStates.filter((s) => s.selected);
    const completed = actionStates.filter((s) => s.status === 'success');
    const failed = actionStates.filter((s) => s.status === 'error');

    return {
      totalTasks: actionStates.filter((s) => s.action.type === 'create_task').length,
      totalNotes: actionStates.filter((s) => s.action.type === 'create_note').length,
      totalUpdates:
        actionStates.filter((s) => s.action.type === 'update_task').length +
        actionStates.filter((s) => s.action.type === 'update_note').length,
      selectedCount: selected.length,
      completedCount: completed.length,
      failedCount: failed.length,
      totalCount: actionStates.length,
    };
  }, [actionStates]);

  // Toggle action selection
  const toggleAction = (index: number) => {
    setActionStates((prev) =>
      prev.map((state, i) =>
        i === index ? { ...state, selected: !state.selected } : state
      )
    );
  };

  // Select/Deselect all
  const toggleSelectAll = () => {
    const allSelected = actionStates.every((s) => s.selected);
    setActionStates((prev) => prev.map((state) => ({ ...state, selected: !allSelected })));
  };

  // Toggle group selection
  const toggleGroupSelection = (groupType: string) => {
    const groupActions = actionStates.filter((s) => s.action.type === groupType);
    const allSelected = groupActions.every((s) => s.selected);

    setActionStates((prev) =>
      prev.map((state) =>
        state.action.type === groupType ? { ...state, selected: !allSelected } : state
      )
    );
  };

  // Toggle group expansion
  const toggleGroupExpansion = (groupType: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupType)) {
        next.delete(groupType);
      } else {
        next.add(groupType);
      }
      return next;
    });
  };

  // Execute selected actions
  const executeSelected = async () => {
    setIsExecuting(true);
    const selectedIndices = actionStates
      .map((state, index) => ({ state, index }))
      .filter(({ state }) => state.selected && state.status === 'pending')
      .map(({ index }) => index);

    for (let i = 0; i < selectedIndices.length; i++) {
      const index = selectedIndices[i];
      const state = actionStates[index];

      setCurrentExecutingIndex(index);

      // Update status to executing
      setActionStates((prev) =>
        prev.map((s, idx) => (idx === index ? { ...s, status: 'executing' as const } : s))
      );

      try {
        // Simulate execution (in real implementation, this would call actual execution logic)
        console.log('[ActionReviewDashboard] Executing:', state.action.type, state.action);
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Update status to success
        setActionStates((prev) =>
          prev.map((s, idx) => (idx === index ? { ...s, status: 'success' as const } : s))
        );
      } catch (error) {
        // Update status to error
        setActionStates((prev) =>
          prev.map((s, idx) =>
            idx === index
              ? { ...s, status: 'error' as const, error: error instanceof Error ? error.message : 'Unknown error' }
              : s
          )
        );
      }
    }

    setCurrentExecutingIndex(-1);
    setIsExecuting(false);
    onBulkComplete?.();
  };

  // Execute actions of specific type
  const executeGroup = async (groupType: string) => {
    setIsExecuting(true);
    const groupIndices = actionStates
      .map((state, index) => ({ state, index }))
      .filter(({ state }) => state.action.type === groupType && state.selected && state.status === 'pending')
      .map(({ index }) => index);

    for (let i = 0; i < groupIndices.length; i++) {
      const index = groupIndices[i];
      const state = actionStates[index];

      setCurrentExecutingIndex(index);

      setActionStates((prev) =>
        prev.map((s, idx) => (idx === index ? { ...s, status: 'executing' as const } : s))
      );

      try {
        console.log('[ActionReviewDashboard] Executing:', state.action.type, state.action);
        await new Promise((resolve) => setTimeout(resolve, 800));

        setActionStates((prev) =>
          prev.map((s, idx) => (idx === index ? { ...s, status: 'success' as const } : s))
        );
      } catch (error) {
        setActionStates((prev) =>
          prev.map((s, idx) =>
            idx === index
              ? { ...s, status: 'error' as const, error: error instanceof Error ? error.message : 'Unknown error' }
              : s
          )
        );
      }
    }

    setCurrentExecutingIndex(-1);
    setIsExecuting(false);
    onBulkComplete?.();
  };

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (stats.selectedCount === 0) return 0;
    return Math.round((stats.completedCount / stats.selectedCount) * 100);
  }, [stats]);

  const getStatusIcon = (status: ActionState['status']) => {
    switch (status) {
      case 'pending':
        return <Square className="w-4 h-4 text-gray-400" />;
      case 'executing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getGroupColor = (color: string) => {
    const colors = {
      blue: {
        bg: 'bg-blue-50/50',
        border: 'border-blue-200',
        text: 'text-blue-900',
        badge: 'bg-blue-100 text-blue-700',
      },
      cyan: {
        bg: 'bg-cyan-50/50',
        border: 'border-cyan-200',
        text: 'text-cyan-900',
        badge: 'bg-cyan-100 text-cyan-700',
      },
      purple: {
        bg: 'bg-purple-50/50',
        border: 'border-purple-200',
        text: 'text-purple-900',
        badge: 'bg-purple-100 text-purple-700',
      },
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} border-2 ${themeClasses.border} overflow-hidden`}>
      {/* Header */}
      <div className={`p-6 border-b-2 ${themeClasses.border} ${themeClasses.bg}`}>
        <div className="flex items-center gap-3 mb-4">
          <Package className="w-6 h-6 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        </div>

        {/* Summary Stats */}
        {showStats && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            {/* Tasks to Create */}
            <div className={`${getGlassClasses('subtle')} ${getRadiusClass('element')} p-4 border border-blue-200`}>
              <div className="flex items-center gap-2 mb-1">
                <ListTodo className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Tasks to Create</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">{stats.totalTasks}</div>
            </div>

            {/* Notes to Create */}
            <div className={`${getGlassClasses('subtle')} ${getRadiusClass('element')} p-4 border border-cyan-200`}>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-cyan-600" />
                <span className="text-xs font-medium text-cyan-700">Notes to Create</span>
              </div>
              <div className="text-2xl font-bold text-cyan-900">{stats.totalNotes}</div>
            </div>

            {/* Updates */}
            <div className={`${getGlassClasses('subtle')} ${getRadiusClass('element')} p-4 border border-purple-200`}>
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-700">Updates</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">{stats.totalUpdates}</div>
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar (shown during execution) */}
      {isExecuting && (
        <div className={`p-4 border-b-2 ${themeClasses.border} bg-blue-50/50`}>
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-blue-900">
              Executing actions... ({stats.completedCount} / {stats.selectedCount})
            </span>
          </div>
          <div className={`w-full h-3 bg-gray-200 ${getRadiusClass('element')} overflow-hidden`}>
            <div
              className={`h-full bg-gradient-to-r from-blue-500 to-blue-600 ${TRANSITIONS.standard}`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Success/Error Summary (shown after execution) */}
      {!isExecuting && (stats.completedCount > 0 || stats.failedCount > 0) && (
        <div className={`p-4 border-b-2 ${themeClasses.border}`}>
          {stats.completedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-700 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-medium">{stats.completedCount} action(s) completed successfully</span>
            </div>
          )}
          {stats.failedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">{stats.failedCount} action(s) failed</span>
            </div>
          )}
        </div>
      )}

      {/* Action Groups */}
      <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
        {groupedActions.map((group) => {
          const isExpanded = expandedGroups.has(group.type);
          const groupColors = getGroupColor(group.color);
          const selectedInGroup = group.actions.filter((a) => a.selected).length;
          const allSelected = selectedInGroup === group.actions.length;

          return (
            <div
              key={group.type}
              className={`${getGlassClasses('subtle')} ${getRadiusClass('card')} border-2 ${groupColors.border} overflow-hidden`}
            >
              {/* Group Header */}
              <div className={`p-4 ${groupColors.bg} border-b-2 ${groupColors.border}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleGroupExpansion(group.type)}
                      className={`p-1 hover:bg-white/50 ${getRadiusClass('element')} ${TRANSITIONS.fast}`}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      )}
                    </button>
                    <div className={groupColors.text}>{group.icon}</div>
                    <div>
                      <h3 className={`text-lg font-semibold ${groupColors.text}`}>{group.label}</h3>
                      <p className="text-xs text-gray-600">
                        {selectedInGroup} of {group.actions.length} selected
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleGroupSelection(group.type)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium ${getRadiusClass('element')} border ${TRANSITIONS.fast} ${
                        allSelected
                          ? `bg-white/90 ${groupColors.border} ${groupColors.text}`
                          : `bg-white/50 border-gray-300 text-gray-700 hover:bg-white/80`
                      }`}
                    >
                      {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>

                    {allowBulk && selectedInGroup > 0 && (
                      <button
                        onClick={() => executeGroup(group.type)}
                        disabled={isExecuting}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 ${getRadiusClass('element')} hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${TRANSITIONS.fast} shadow-md hover:shadow-lg`}
                      >
                        <Play className="w-4 h-4" />
                        Execute {selectedInGroup}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Group Actions */}
              {isExpanded && (
                <div className="p-2 space-y-2">
                  {group.actions.map((state, idx) => {
                    const globalIndex = actionStates.indexOf(state);
                    const isCurrentlyExecuting = globalIndex === currentExecutingIndex;

                    return (
                      <div
                        key={globalIndex}
                        className={`flex items-start gap-3 p-3 ${getGlassClasses('subtle')} ${getRadiusClass('element')} border ${
                          isCurrentlyExecuting
                            ? 'border-blue-400 bg-blue-50/50'
                            : state.status === 'success'
                            ? 'border-green-200 bg-green-50/30'
                            : state.status === 'error'
                            ? 'border-red-200 bg-red-50/30'
                            : 'border-white/60'
                        } ${TRANSITIONS.fast}`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleAction(globalIndex)}
                          disabled={state.status !== 'pending'}
                          className="mt-0.5"
                        >
                          {state.selected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900 truncate">
                              {state.action.label}
                            </span>
                            {state.action.metadata?.confidence && (
                              <span className={`px-2 py-0.5 text-xs font-medium ${groupColors.badge} ${getRadiusClass('element')}`}>
                                {Math.round(state.action.metadata.confidence * 100)}%
                              </span>
                            )}
                          </div>

                          {state.action.metadata?.reasoning && (
                            <p className="text-xs text-gray-600 line-clamp-2">{state.action.metadata.reasoning}</p>
                          )}

                          {state.error && (
                            <div className="mt-2 flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-red-700">{state.error}</span>
                            </div>
                          )}
                        </div>

                        {/* Status Icon */}
                        <div className="flex-shrink-0 mt-0.5">{getStatusIcon(state.status)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer with Bulk Actions */}
      {allowBulk && (
        <div className={`p-6 border-t-2 ${themeClasses.border} ${themeClasses.bg} flex items-center justify-between`}>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSelectAll}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white/90 border-2 border-gray-300 ${getRadiusClass('element')} hover:bg-white ${TRANSITIONS.fast}`}
            >
              {actionStates.every((s) => s.selected) ? (
                <>
                  <Square className="w-4 h-4" />
                  Deselect All
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4" />
                  Select All
                </>
              )}
            </button>

            <span className="text-sm text-gray-600">
              {stats.selectedCount} of {stats.totalCount} selected
            </span>
          </div>

          <button
            onClick={executeSelected}
            disabled={isExecuting || stats.selectedCount === 0}
            className={`inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 ${getRadiusClass('element')} hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${TRANSITIONS.fast} shadow-lg hover:shadow-xl`}
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5" />
                Execute All Selected
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
