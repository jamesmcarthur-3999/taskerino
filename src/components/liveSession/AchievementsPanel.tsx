/**
 * AchievementsPanel
 *
 * List of achievements with celebration animations.
 * Shows achievements from summary with importance levels and categories.
 *
 * @example
 * ```tsx
 * <AchievementsPanel
 *   achievements={["Completed login flow", "Fixed API timeout bug"]}
 *   showCelebration={true}
 * />
 * ```
 */

import React, { useState, useEffect } from 'react';
import { Award, Trophy, Star, CheckCircle2, Zap, Sparkles } from 'lucide-react';
import { getGlassClasses, getRadiusClass } from '@/design-system/theme';
import { subscribeToLiveSessionEvents } from '@/services/liveSession/events';

type Achievement = string | {
  id: string;
  text: string;
  timestamp: string;
  importance?: 'minor' | 'moderate' | 'major' | 'critical';
  category?: string;
};

interface AchievementsPanelProps {
  achievements: Achievement[];
  showCelebration?: boolean; // Enable celebration animation (default: true)
  sessionId?: string; // For event subscription
}

export const AchievementsPanel: React.FC<AchievementsPanelProps> = ({
  achievements,
  showCelebration = true,
  sessionId
}) => {
  const [celebratingAchievement, setCelebratingAchievement] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | 'major' | 'critical'>('all');

  // Subscribe to achievement detection events
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = subscribeToLiveSessionEvents('context-changed', (event) => {
      if (event.sessionId === sessionId && event.changeType === 'achievement-detected') {
        // Trigger celebration animation for new achievement
        const achievementId = event.metadata?.achievementId as string | undefined;
        if (achievementId && showCelebration) {
          setCelebratingAchievement(achievementId);
          setTimeout(() => setCelebratingAchievement(null), 3000);
        }
      }
    });

    return unsubscribe;
  }, [sessionId, showCelebration]);

  const importanceConfig = {
    critical: { bg: 'bg-yellow-100', icon: 'text-yellow-600', component: Trophy },
    major: { bg: 'bg-green-100', icon: 'text-green-600', component: Star },
    moderate: { bg: 'bg-emerald-50', icon: 'text-emerald-600', component: CheckCircle2 },
    minor: { bg: 'bg-emerald-50', icon: 'text-emerald-600', component: CheckCircle2 }
  };

  const handleCelebrate = (achievementId: string) => {
    if (!showCelebration) return;
    setCelebratingAchievement(achievementId);
    setTimeout(() => setCelebratingAchievement(null), 3000);
  };

  // Filter achievements
  const filteredAchievements = achievements.filter((a) => {
    if (viewFilter === 'all') return true;
    if (typeof a === 'string') return false; // String achievements can't be filtered
    return a.importance === viewFilter;
  });

  const hasImportanceFiltering = achievements.some(
    (a) => typeof a === 'object' && a.importance
  );

  return (
    <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-4 border-2 border-green-300/60 relative overflow-hidden`}>
      {/* Simple celebration animation (CSS-based) */}
      {celebratingAchievement && showCelebration && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping">
            <Sparkles size={48} className="text-yellow-400 opacity-70" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className="text-green-600" size={20} />
          <h3 className="font-semibold text-gray-900">
            Achievements
            {filteredAchievements.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                {filteredAchievements.length}
              </span>
            )}
          </h3>
        </div>
        {hasImportanceFiltering && (
          <select
            value={viewFilter}
            onChange={(e) => setViewFilter(e.target.value as any)}
            className="px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white/60 focus:ring-2 focus:ring-green-400 focus:border-transparent"
            aria-label="Filter achievements by importance"
          >
            <option value="all">All</option>
            <option value="major">Major Only</option>
            <option value="critical">Critical Only</option>
          </select>
        )}
      </div>

      {/* Achievements List */}
      {filteredAchievements.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <Zap size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No achievements yet - keep working!</p>
        </div>
      ) : (
        <ul className="space-y-3" role="list" aria-label="Session achievements">
          {filteredAchievements.map((achievement, idx) => {
            const isEnhanced = typeof achievement === 'object';
            const achievementId = isEnhanced ? achievement.id : `achievement-${idx}`;
            const text = isEnhanced ? achievement.text : achievement;
            const importance = isEnhanced ? achievement.importance || 'moderate' : 'moderate';
            const category = isEnhanced ? achievement.category : undefined;
            const timestamp = isEnhanced ? achievement.timestamp : undefined;
            const isCelebrating = celebratingAchievement === achievementId;
            const config = importanceConfig[importance];
            const IconComponent = config.component;

            return (
              <li
                key={achievementId}
                className={`${getGlassClasses('subtle')} rounded-xl p-3 border-2 border-green-300 transition-all group ${
                  isCelebrating ? 'animate-bounce shadow-lg' : ''
                }`}
                role="listitem"
              >
                <div className="flex items-start gap-3">
                  {/* Importance Icon */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${config.bg}`}>
                    <IconComponent className={config.icon} size={16} />
                  </div>

                  {/* Text & Metadata */}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{text}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {category && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                          {category}
                        </span>
                      )}
                      {timestamp && (
                        <span className="text-xs text-gray-500">
                          {new Date(timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Celebrate Button */}
                  <button
                    onClick={() => handleCelebrate(achievementId)}
                    className="flex-shrink-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-yellow-100 rounded-lg"
                    title="Celebrate!"
                    aria-label="Celebrate achievement"
                  >
                    <Sparkles className="text-yellow-600" size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
