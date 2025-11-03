/**
 * CurrentFocusCard
 *
 * Displays current work focus, momentum, and recent progress.
 * Can be displayed in full mode (with progress list) or compact mode (badge only).
 *
 * @example
 * ```tsx
 * <CurrentFocusCard
 *   focus="Writing customer email about API integration"
 *   progress={["Fixed authentication bug", "Deployed to staging"]}
 *   momentum="high"
 *   compact={false}
 *   showProgress={true}
 * />
 * ```
 */

import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2 } from 'lucide-react';
import { getGlassClasses, getRadiusClass } from '@/design-system/theme';
import { LiveSnapshotBadge } from './LiveSnapshotBadge';
import { subscribeToLiveSessionEvents } from '@/services/liveSession/events';

interface CurrentFocusCardProps {
  focus: string; // Present tense sentence
  progress: string[]; // Array of achievements so far (max 3)
  momentum: 'high' | 'medium' | 'low';
  compact?: boolean; // Compact mode for top nav badge
  showProgress?: boolean; // Show progress list (default: true)
  sessionId?: string; // For event subscription
}

export const CurrentFocusCard: React.FC<CurrentFocusCardProps> = ({
  focus,
  progress,
  momentum,
  compact = false,
  showProgress = true,
  sessionId
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  // Subscribe to summary updates for animation
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = subscribeToLiveSessionEvents('summary-updated', (event) => {
      if (event.sessionId === sessionId) {
        // Trigger gentle pulse animation
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 800);
      }
    });

    return unsubscribe;
  }, [sessionId]);

  // Compact mode (for top nav badge)
  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 ${getGlassClasses(
          'medium'
        )} rounded-full border border-cyan-300/60 cursor-pointer hover:border-cyan-400 transition-colors`}
        title={focus}
      >
        <div
          className={`w-2 h-2 rounded-full ${
            momentum === 'high'
              ? 'bg-green-500 animate-pulse'
              : momentum === 'medium'
              ? 'bg-amber-500'
              : 'bg-gray-400'
          }`}
        />
        <span className="text-sm font-medium text-gray-900 max-w-[200px] truncate">
          {focus}
        </span>
      </div>
    );
  }

  // Full mode
  return (
    <div
      className={`${getGlassClasses('medium')} ${getRadiusClass(
        'card'
      )} p-4 border-2 border-cyan-300/60 ${isAnimating ? 'animate-pulse' : ''}`}
    >
      {/* Header with Momentum Badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="text-cyan-600" size={18} />
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Current Focus
          </h3>
        </div>
        <LiveSnapshotBadge momentum={momentum} showLabel={true} size="sm" />
      </div>

      {/* Focus Statement */}
      <p className="text-lg font-medium text-gray-900 mb-4 leading-relaxed">{focus}</p>

      {/* Progress Today */}
      {showProgress && progress && progress.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Progress Today
          </h4>
          <ul className="space-y-2">
            {progress.slice(0, 3).map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2
                  size={16}
                  className="text-green-500 flex-shrink-0 mt-0.5"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
