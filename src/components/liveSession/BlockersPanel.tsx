/**
 * BlockersPanel
 *
 * Display current blockers with dismiss/resolve actions.
 * Shows blockers from summary with context and related screenshots.
 *
 * @example
 * ```tsx
 * <BlockersPanel
 *   blockers={["Waiting on API key", "Database connection timeout"]}
 *   sessionId="session-123"
 *   onBlockerResolved={(id) => console.log('Resolved:', id)}
 * />
 * ```
 */

import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, X, CheckCircle2, Loader2, Smile } from 'lucide-react';
import { getGlassClasses, getRadiusClass } from '@/design-system/theme';
import { updateLiveSessionSummary } from '@/services/liveSession/updateApi';

type Blocker = string | {
  id: string;
  text: string;
  timestamp: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'unresolved' | 'resolved' | 'workaround';
  resolvedAt?: string;
  resolution?: string;
};

interface BlockersPanelProps {
  blockers: Blocker[];
  sessionId?: string;
  onBlockerResolved?: (blockerId: string) => void;
}

export const BlockersPanel: React.FC<BlockersPanelProps> = ({
  blockers,
  sessionId,
  onBlockerResolved
}) => {
  const [dismissedBlockers, setDismissedBlockers] = useState<Set<string>>(new Set());
  const [resolvingBlocker, setResolvingBlocker] = useState<string | null>(null);

  const severityConfig = {
    critical: { bg: 'bg-red-100', icon: 'text-red-600', border: 'border-red-300' },
    high: { bg: 'bg-orange-100', icon: 'text-orange-600', border: 'border-orange-300' },
    medium: { bg: 'bg-amber-100', icon: 'text-amber-600', border: 'border-amber-300' },
    low: { bg: 'bg-gray-100', icon: 'text-gray-600', border: 'border-gray-300' }
  };

  const handleDismiss = (blockerId: string) => {
    setDismissedBlockers((prev) => new Set(prev).add(blockerId));
  };

  const handleResolve = async (blockerId: string) => {
    if (!sessionId) {
      console.warn('[BlockersPanel] Cannot resolve blocker: no sessionId');
      return;
    }

    setResolvingBlocker(blockerId);

    try {
      // Find the blocker and mark it as resolved
      const updatedBlockers = blockers
        .filter((b) => {
          const id = typeof b === 'string' ? `blocker-${b}` : b.id;
          return id !== blockerId;
        })
        .map((b) => (typeof b === 'string' ? b : b.text));

      // Update session summary
      await updateLiveSessionSummary(sessionId, {
        blockers: updatedBlockers
      });

      onBlockerResolved?.(blockerId);

      // Also dismiss from local state
      handleDismiss(blockerId);
    } catch (error) {
      console.error('[BlockersPanel] Failed to resolve blocker:', error);
    } finally {
      setResolvingBlocker(null);
    }
  };

  // Filter out dismissed blockers
  const visibleBlockers = blockers.filter((b) => {
    const id = typeof b === 'string' ? `blocker-${b}` : b.id;
    return !dismissedBlockers.has(id);
  });

  return (
    <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-4 border-2 border-red-300/60`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="text-red-600" size={20} />
        <h3 className="font-semibold text-gray-900">
          Blockers
          {visibleBlockers.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
              {visibleBlockers.length}
            </span>
          )}
        </h3>
      </div>

      {/* Blockers List */}
      {visibleBlockers.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <Smile size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No blockers detected</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleBlockers.map((blocker, idx) => {
            const isEnhanced = typeof blocker === 'object';
            const blockerId = isEnhanced ? blocker.id : `blocker-${idx}`;
            const text = isEnhanced ? blocker.text : blocker;
            const severity = isEnhanced ? blocker.severity || 'medium' : 'medium';
            const status = isEnhanced ? blocker.status || 'unresolved' : 'unresolved';
            const isResolved = status === 'resolved';
            const config = severityConfig[severity];

            return (
              <li
                key={blockerId}
                className={`${getGlassClasses('subtle')} rounded-xl p-3 border-2 transition-all relative group ${
                  isResolved
                    ? 'border-green-300 bg-green-50/30 opacity-60'
                    : config.border
                } ${dismissedBlockers.has(blockerId) ? 'animate-out fade-out slide-out-to-top duration-300' : ''}`}
                role="listitem"
              >
                {/* Dismiss Button */}
                {!isResolved && (
                  <button
                    onClick={() => handleDismiss(blockerId)}
                    className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 rounded"
                    aria-label="Dismiss blocker"
                  >
                    <X size={14} className="text-gray-400 hover:text-gray-600" />
                  </button>
                )}

                {/* Blocker Content */}
                <div className="flex items-start gap-3">
                  {/* Severity Icon */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${config.bg}`}>
                    <AlertTriangle className={config.icon} size={16} />
                  </div>

                  {/* Text & Metadata */}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isResolved ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {text}
                    </p>
                    {isEnhanced && blocker.timestamp && (
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(blocker.timestamp).toLocaleString()}
                      </p>
                    )}
                    {isResolved && isEnhanced && blocker.resolution && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ {blocker.resolution}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {!isResolved && sessionId && (
                    <button
                      onClick={() => handleResolve(blockerId)}
                      disabled={resolvingBlocker === blockerId}
                      className="flex-shrink-0 px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1"
                      aria-label="Resolve blocker"
                    >
                      {resolvingBlocker === blockerId ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 size={12} />
                          Resolve
                        </>
                      )}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
