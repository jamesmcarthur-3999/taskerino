/**
 * SuggestionsList
 *
 * Container that renders multiple suggestion cards (tasks and notes) in a unified layout.
 * Provides filtering, sorting, and management of suggestions.
 *
 * @example
 * ```tsx
 * <SuggestionsList
 *   sessionId="session-123"
 *   suggestions={[
 *     { type: 'task', title: "Fix bug", priority: "high", ... },
 *     { type: 'note', content: "Meeting notes...", ... }
 *   ]}
 *   maxDisplayed={10}
 *   onSuggestionActioned={(id, type) => console.log('Actioned:', id, type)}
 * />
 * ```
 */

import React, { useState, useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import { getGlassClasses } from '@/design-system/theme';
import { TaskSuggestionCard } from './TaskSuggestionCard';
import { NoteSuggestionCard } from './NoteSuggestionCard';
import type { TaskSuggestion, NoteSuggestion } from '@/services/liveSession/toolExecutor';

type Suggestion = (TaskSuggestion & { type: 'task' }) | (NoteSuggestion & { type: 'note' });

interface SuggestionsListProps {
  sessionId: string;
  taskSuggestions?: TaskSuggestion[];
  noteSuggestions?: NoteSuggestion[];
  maxDisplayed?: number; // Default: 10
  onSuggestionActioned?: (suggestionId: string, type: 'task' | 'note') => void;
}

export const SuggestionsList: React.FC<SuggestionsListProps> = ({
  sessionId,
  taskSuggestions = [],
  noteSuggestions = [],
  maxDisplayed = 10,
  onSuggestionActioned
}) => {
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'all' | 'tasks' | 'notes'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'recent'>('priority');
  const [displayLimit, setDisplayLimit] = useState(maxDisplayed);

  // Combine and tag suggestions
  const allSuggestions: Suggestion[] = useMemo(() => {
    const tasks = taskSuggestions.map((s) => ({ ...s, type: 'task' as const }));
    const notes = noteSuggestions.map((s) => ({ ...s, type: 'note' as const }));
    return [...tasks, ...notes];
  }, [taskSuggestions, noteSuggestions]);

  // Filter and sort suggestions
  const visibleSuggestions = useMemo(() => {
    let filtered = allSuggestions.filter((s) => {
      // Generate unique ID for filtering
      const id = `${s.type}-${Date.now()}-${Math.random()}`;
      if (dismissedSuggestions.has(id)) return false;

      // View mode filter
      if (viewMode === 'tasks' && s.type !== 'task') return false;
      if (viewMode === 'notes' && s.type !== 'note') return false;

      return true;
    });

    // Sort
    if (sortBy === 'priority') {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      filtered.sort((a, b) => {
        if (a.type === 'task' && b.type === 'task') {
          const aPriority = a.priority || 'medium';
          const bPriority = b.priority || 'medium';
          return priorityOrder[aPriority] - priorityOrder[bPriority];
        }
        // Tasks before notes
        return a.type === 'task' ? -1 : 1;
      });
    } else {
      // Recent (reverse order, assuming newer suggestions are later in array)
      filtered = filtered.reverse();
    }

    return filtered.slice(0, displayLimit);
  }, [allSuggestions, dismissedSuggestions, viewMode, sortBy, displayLimit]);

  const handleDismiss = (suggestionId: string) => {
    setDismissedSuggestions((prev) => new Set(prev).add(suggestionId));
  };

  const handleSuggestionActioned = (suggestionId: string, type: 'task' | 'note') => {
    onSuggestionActioned?.(suggestionId, type);
    // Also dismiss it from the list
    handleDismiss(suggestionId);
  };

  const totalCount = allSuggestions.length - dismissedSuggestions.size;
  const hasMore = totalCount > displayLimit;

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
          Suggestions
          {totalCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-xs font-bold">
              {totalCount}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {/* View Mode Tabs */}
          <div className={`flex ${getGlassClasses('medium')} rounded-lg p-1`}>
            {(['all', 'tasks', 'notes'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-white text-cyan-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                aria-pressed={viewMode === mode}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'priority' | 'recent')}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white/60 focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
            aria-label="Sort suggestions"
          >
            <option value="priority">Priority</option>
            <option value="recent">Recent</option>
          </select>
        </div>
      </div>

      {/* Suggestions Grid */}
      {visibleSuggestions.length === 0 ? (
        <div className={`${getGlassClasses('subtle')} rounded-2xl p-8 text-center`}>
          <Lightbulb size={48} className="mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600 font-medium">No suggestions yet</p>
          <p className="text-sm text-gray-500 mt-1">The AI will make suggestions as you work</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleSuggestions.map((suggestion, idx) => {
              const suggestionId = `${suggestion.type}-${idx}`;
              return suggestion.type === 'task' ? (
                <TaskSuggestionCard
                  key={suggestionId}
                  suggestion={suggestion}
                  sessionId={sessionId}
                  onTaskCreated={() => handleSuggestionActioned(suggestionId, 'task')}
                  onDismiss={() => handleDismiss(suggestionId)}
                />
              ) : (
                <NoteSuggestionCard
                  key={suggestionId}
                  suggestion={suggestion}
                  sessionId={sessionId}
                  onNoteCreated={() => handleSuggestionActioned(suggestionId, 'note')}
                  onDismiss={() => handleDismiss(suggestionId)}
                />
              );
            })}
          </div>

          {/* Show More Button */}
          {hasMore && (
            <button
              onClick={() => setDisplayLimit((prev) => prev + 10)}
              className="w-full py-2 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Show More ({totalCount - displayLimit} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
};
