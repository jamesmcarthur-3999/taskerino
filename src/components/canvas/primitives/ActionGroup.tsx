/**
 * ActionGroup - Grouped Related Actions Component
 *
 * Displays multiple related actions with batch execution capability.
 * Actions are shown in a collapsible group with progress tracking.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, PlayCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { ActionGroupProps } from '../types';
import { ActionCard } from './ActionCard';
import { getGlassClasses, getRadiusClass, CANVAS_COMPONENTS, TRANSITIONS } from '../../../design-system/theme';

export function ActionGroup({
  title,
  description,
  actions,
  allowBatch = false,
  defaultCollapsed = false,
  theme = 'default',
  onAllComplete,
}: ActionGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [executionStates, setExecutionStates] = useState<Record<number, 'pending' | 'executing' | 'completed' | 'failed'>>({});
  const [isBatchExecuting, setIsBatchExecuting] = useState(false);

  const themeClasses = CANVAS_COMPONENTS.themes[theme];

  // Calculate progress
  const completedCount = Object.values(executionStates).filter(state => state === 'completed').length;
  const totalCount = actions.length;
  const allCompleted = completedCount === totalCount && totalCount > 0;
  const hasStarted = completedCount > 0;

  // Handle individual action completion
  const handleActionComplete = (index: number) => {
    setExecutionStates(prev => ({
      ...prev,
      [index]: 'completed',
    }));

    // Check if all actions are now complete
    const newStates = { ...executionStates, [index]: 'completed' as const };
    const allDone = Object.keys(newStates).length === totalCount &&
                    Object.values(newStates).every(state => state === 'completed');

    if (allDone && onAllComplete) {
      onAllComplete();
    }
  };

  // Handle batch execution
  const handleBatchExecute = async () => {
    setIsBatchExecuting(true);

    // Execute actions sequentially
    for (let i = 0; i < actions.length; i++) {
      // Skip already completed actions
      if (executionStates[i] === 'completed') {
        continue;
      }

      // Mark as executing
      setExecutionStates(prev => ({
        ...prev,
        [i]: 'executing',
      }));

      try {
        // Simulate execution (in real implementation, this would call the actual action handler)
        await new Promise(resolve => setTimeout(resolve, 800));

        // Mark as completed
        setExecutionStates(prev => ({
          ...prev,
          [i]: 'completed',
        }));
      } catch (error) {
        console.error(`[ActionGroup] Failed to execute action ${i}:`, error);

        // Mark as failed
        setExecutionStates(prev => ({
          ...prev,
          [i]: 'failed',
        }));
      }
    }

    setIsBatchExecuting(false);

    // Call completion callback if all succeeded
    const allSucceeded = Object.values(executionStates).every(
      state => state === 'completed'
    );
    if (allSucceeded && onAllComplete) {
      onAllComplete();
    }
  };

  // Build group container className
  const groupClassName = [
    getGlassClasses('medium'),
    getRadiusClass('card'),
    'border-2',
    themeClasses.border,
    'overflow-hidden',
    TRANSITIONS.standard,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={groupClassName}>
      {/* Group Header */}
      <div
        className={`flex items-center justify-between p-4 border-b-2 ${themeClasses.border} ${themeClasses.bg} backdrop-blur-sm cursor-pointer hover:bg-opacity-80 ${TRANSITIONS.fast}`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

            {/* Progress Badge */}
            {hasStarted && (
              <span
                className={`px-2 py-1 text-xs font-semibold ${getRadiusClass('element')} ${
                  allCompleted
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {completedCount} / {totalCount} completed
              </span>
            )}

            {/* Batch Executing Indicator */}
            {isBatchExecuting && (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            )}

            {/* All Complete Icon */}
            {allCompleted && (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            )}
          </div>

          {description && (
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          )}
        </div>

        {/* Collapse Toggle */}
        <div className="flex items-center gap-2 ml-4">
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          )}
        </div>
      </div>

      {/* Group Content */}
      {!isCollapsed && (
        <div className={`p-4 ${themeClasses.text}`}>
          {/* Batch Execute Button */}
          {allowBatch && !allCompleted && (
            <div className="mb-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBatchExecute();
                }}
                disabled={isBatchExecuting}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-purple-600 ${getRadiusClass('element')} hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed ${TRANSITIONS.fast} shadow-md hover:shadow-lg`}
              >
                {isBatchExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Executing All...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4" />
                    Execute All ({totalCount - completedCount} remaining)
                  </>
                )}
              </button>
            </div>
          )}

          {/* Action Cards */}
          <div className="space-y-3">
            {actions.map((action, index) => {
              const state = executionStates[index];
              const isExecuting = state === 'executing' || isBatchExecuting;
              const isCompleted = state === 'completed';
              const isFailed = state === 'failed';

              return (
                <div key={index} className="relative">
                  {/* Execution State Overlay */}
                  {isExecuting && (
                    <div className="absolute inset-0 bg-blue-50/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-[20px]">
                      <div className="flex items-center gap-2 text-blue-700">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-medium">Executing...</span>
                      </div>
                    </div>
                  )}

                  {/* Success State Overlay */}
                  {isCompleted && (
                    <div className={`absolute top-2 right-2 z-10 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold ${getRadiusClass('element')} border border-green-300 flex items-center gap-1`}>
                      <CheckCircle2 className="w-3 h-3" />
                      Completed
                    </div>
                  )}

                  {/* Failed State Overlay */}
                  {isFailed && (
                    <div className={`absolute top-2 right-2 z-10 px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold ${getRadiusClass('element')} border border-red-300 flex items-center gap-1`}>
                      <XCircle className="w-3 h-3" />
                      Failed
                    </div>
                  )}

                  {/* Action Card */}
                  <ActionCard
                    action={action}
                    expanded={false}
                    editable={!isExecuting && !isCompleted}
                    onComplete={() => handleActionComplete(index)}
                    theme={theme}
                  />
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {actions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No actions in this group</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
