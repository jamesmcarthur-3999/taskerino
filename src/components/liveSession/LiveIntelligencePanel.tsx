/**
 * LiveIntelligencePanel
 *
 * Main orchestrating panel that displays the current live snapshot (focus, progress, momentum)
 * and organizes all sub-components (questions, suggestions, blockers, achievements).
 *
 * This is the primary UI component for the Live Session Intelligence system.
 * It subscribes to summary-updated events and refreshes display in real-time.
 *
 * @example
 * ```tsx
 * <LiveIntelligencePanel
 *   sessionId="session-123"
 *   isActive={true}
 *   position="sidebar"
 * />
 * ```
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { getGlassClasses } from '@/design-system/theme';
import { subscribeToLiveSessionEvents } from '@/services/liveSession/events';
import { LiveSessionEventEmitter } from '@/services/liveSession/events';
import { getSessionContext } from '@/services/liveSession/contextApi';
import { CurrentFocusCard } from './CurrentFocusCard';
import { AIQuestionBar } from './AIQuestionBar';
import { SuggestionsList } from './SuggestionsList';
import { BlockersPanel } from './BlockersPanel';
import { AchievementsPanel } from './AchievementsPanel';
import { ManualRefreshButton } from './ManualRefreshButton';
import type { SessionSummary } from '../../types';

interface LiveIntelligencePanelProps {
  sessionId: string;
  isActive: boolean; // Only show for active sessions
  position?: 'overlay' | 'sidebar' | 'inline'; // Default: 'sidebar'
  onClose?: () => void;
}

export const LiveIntelligencePanel: React.FC<LiveIntelligencePanelProps> = ({
  sessionId,
  isActive,
  position = 'sidebar',
  onClose
}) => {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial summary
  useEffect(() => {
    if (!isActive) return;

    const loadInitialSummary = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get summary context
        const context = await getSessionContext(sessionId, 'summary');
        setSummary(context.currentSummary as SessionSummary);
        setLastUpdated(new Date().toISOString());
      } catch (err) {
        console.error('[LiveIntelligencePanel] Failed to load summary:', err);
        setError(err instanceof Error ? err.message : 'Failed to load summary');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialSummary();
  }, [sessionId, isActive]);

  // Subscribe to summary updates
  useEffect(() => {
    if (!isActive) return;

    const unsubscribe = subscribeToLiveSessionEvents('summary-updated', (event) => {
      if (event.sessionId === sessionId) {
        console.log('[LiveIntelligencePanel] Summary updated:', event.summary);
        setSummary(event.summary);
        setLastUpdated(event.timestamp);
      }
    });

    return unsubscribe;
  }, [sessionId, isActive]);

  // Subscribe to context changes for loading indication
  useEffect(() => {
    if (!isActive) return;

    const unsubscribe = subscribeToLiveSessionEvents('context-changed', (event) => {
      if (event.sessionId === sessionId && event.changeType === 'focus-change') {
        // Trigger subtle loading animation
        setIsLoading(true);
        setTimeout(() => setIsLoading(false), 500);
      }
    });

    return unsubscribe;
  }, [sessionId, isActive]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`liveIntelligence.expanded.${sessionId}`);
    if (saved !== null) {
      setIsExpanded(saved === 'true');
    }
  }, [sessionId]);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(`liveIntelligence.expanded.${sessionId}`, String(isExpanded));
  }, [sessionId, isExpanded]);

  const handleManualRefresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Emit manual refresh request
      LiveSessionEventEmitter.emitSummaryRequested(sessionId, 'user');

      // Wait for summary-updated event (with timeout)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Refresh timed out'));
        }, 30000); // 30 second timeout

        const unsubscribe = subscribeToLiveSessionEvents('summary-updated', (event) => {
          if (event.sessionId === sessionId) {
            clearTimeout(timeout);
            unsubscribe();
            resolve();
          }
        });
      });
    } catch (err) {
      console.error('[LiveIntelligencePanel] Manual refresh failed:', err);
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionActioned = (suggestionId: string, type: 'task' | 'note') => {
    console.log('[LiveIntelligencePanel] Suggestion actioned:', suggestionId, type);
    // Suggestion is automatically removed from display by the card component
  };

  if (!isActive) return null;

  // Calculate momentum from summary
  const momentum =
    summary?.liveSnapshot?.momentum ||
    (summary?.achievements && summary.achievements.length > 2
      ? 'high'
      : summary?.blockers && summary.blockers.length > 0
      ? 'low'
      : 'medium');

  // Format time since last update
  const timeSinceUpdate = lastUpdated
    ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000 / 60)
    : null;

  return (
    <div
      className={`${getGlassClasses('medium')} rounded-[24px] p-6 ${
        position === 'overlay'
          ? 'fixed top-20 right-6 w-96 max-h-[80vh] overflow-y-auto z-50 shadow-2xl'
          : 'w-full'
      }`}
      role="region"
      aria-label="Live session intelligence"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {/* Momentum Indicator */}
          <div
            className={`w-3 h-3 rounded-full ${
              momentum === 'high'
                ? 'bg-green-500 animate-pulse'
                : momentum === 'medium'
                ? 'bg-amber-500'
                : 'bg-gray-400'
            }`}
            aria-label={`Momentum: ${momentum}`}
          />
          <h2 className="text-xl font-bold text-gray-900">Live Intelligence</h2>
        </div>
        <div className="flex items-center gap-2">
          <ManualRefreshButton
            onRefresh={handleManualRefresh}
            isLoading={isLoading}
            size="sm"
            variant="minimal"
          />
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
            aria-expanded={isExpanded}
          >
            <ChevronDown
              className={`transition-transform ${isExpanded ? '' : 'rotate-180'}`}
              size={20}
            />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close panel"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Content (Collapsible) */}
      {isExpanded && (
        <div className="space-y-6">
          {/* Live Snapshot / Current Focus */}
          {summary?.liveSnapshot && (
            <CurrentFocusCard
              focus={summary.liveSnapshot.currentFocus}
              progress={summary.liveSnapshot.progressToday || []}
              momentum={momentum}
              sessionId={sessionId}
            />
          )}

          {/* AI Question Bar */}
          <AIQuestionBar sessionId={sessionId} />

          {/* Suggestions */}
          {((summary?.suggestedTasks && summary.suggestedTasks.length > 0) ||
            (summary?.suggestedNotes && summary.suggestedNotes.length > 0)) && (
            <SuggestionsList
              sessionId={sessionId}
              taskSuggestions={summary.suggestedTasks}
              noteSuggestions={summary.suggestedNotes}
              maxDisplayed={10}
              onSuggestionActioned={handleSuggestionActioned}
            />
          )}

          {/* Blockers & Achievements */}
          {((summary?.blockers && summary.blockers.length > 0) ||
            (summary?.achievements && summary.achievements.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary?.blockers && summary.blockers.length > 0 && (
                <BlockersPanel
                  blockers={summary.blockers}
                  sessionId={sessionId}
                  onBlockerResolved={(id) => console.log('Blocker resolved:', id)}
                />
              )}
              {summary?.achievements && summary.achievements.length > 0 && (
                <AchievementsPanel
                  achievements={summary.achievements}
                  showCelebration={true}
                  sessionId={sessionId}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-xs text-gray-500 mt-4 text-center">
          Last updated{' '}
          {timeSinceUpdate !== null
            ? timeSinceUpdate === 0
              ? 'just now'
              : `${timeSinceUpdate} minute${timeSinceUpdate > 1 ? 's' : ''} ago`
            : 'recently'}
        </div>
      )}
    </div>
  );
};
