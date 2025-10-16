/**
 * Key Moments Panel
 *
 * Displays interactive list of key moments detected in the session
 * - Questions, eureka moments, frustration, activity changes
 * - Click to jump to each moment
 * - Visual categorization with icons and colors
 */

import React from 'react';
import { Lightbulb, HelpCircle, Frown, ArrowRightLeft, Sparkles } from 'lucide-react';
import type { AudioKeyMoment } from '../types';

interface KeyMomentsPanelProps {
  keyMoments: AudioKeyMoment[];
  currentTime: number;
  onSeekToTime: (time: number) => void;
}

export function KeyMomentsPanel({
  keyMoments,
  currentTime,
  onSeekToTime,
}: KeyMomentsPanelProps) {
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get icon and color for moment type
  const getMomentStyle = (type: string) => {
    switch (type) {
      case 'achievement':
        return {
          icon: Lightbulb,
          bgColor: 'from-green-500/20 to-emerald-500/20',
          borderColor: 'border-green-400',
          iconColor: 'text-green-600',
          badgeColor: 'bg-green-500',
          emoji: '🎉',
        };
      case 'insight':
        return {
          icon: HelpCircle,
          bgColor: 'from-blue-500/20 to-cyan-500/20',
          borderColor: 'border-blue-400',
          iconColor: 'text-blue-600',
          badgeColor: 'bg-blue-500',
          emoji: '❓',
        };
      case 'blocker':
        return {
          icon: Frown,
          bgColor: 'from-red-500/20 to-orange-500/20',
          borderColor: 'border-red-400',
          iconColor: 'text-red-600',
          badgeColor: 'bg-red-500',
          emoji: '😤',
        };
      case 'decision':
        return {
          icon: ArrowRightLeft,
          bgColor: 'from-purple-500/20 to-pink-500/20',
          borderColor: 'border-purple-400',
          iconColor: 'text-purple-600',
          badgeColor: 'bg-purple-500',
          emoji: '🔄',
        };
      default:
        return {
          icon: Sparkles,
          bgColor: 'from-gray-500/20 to-slate-500/20',
          borderColor: 'border-gray-400',
          iconColor: 'text-gray-600',
          badgeColor: 'bg-gray-500',
          emoji: '✨',
        };
    }
  };

  // Group moments by type
  const momentsByType = keyMoments.reduce((acc, moment) => {
    if (!acc[moment.type]) {
      acc[moment.type] = [];
    }
    acc[moment.type].push(moment);
    return acc;
  }, {} as Record<string, AudioKeyMoment[]>);

  // Get statistics
  const stats = {
    total: keyMoments.length,
    achievement: momentsByType.achievement?.length || 0,
    insight: momentsByType.insight?.length || 0,
    blocker: momentsByType.blocker?.length || 0,
    decision: momentsByType.decision?.length || 0,
  };

  if (keyMoments.length === 0) {
    return (
      <div className="bg-white/40 backdrop-blur-xl rounded-[24px] border-2 border-white/50 p-8 text-center">
        <Sparkles size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">No key moments detected</p>
        <p className="text-xs text-gray-500 mt-2">
          Key moments are automatically detected from your audio transcription
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/40 backdrop-blur-xl rounded-[24px] border-2 border-white/50 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/30 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Key Moments
            </h3>
            <span className="text-xs text-gray-600 bg-white/40 px-3 py-1 rounded-full">
              {stats.total} detected
            </span>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="px-6 py-3 bg-gradient-to-r from-white/30 to-white/10 border-b border-white/20">
        <div className="flex items-center justify-around text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-700">{stats.achievement} Achievements</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-gray-700">{stats.insight} Questions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-gray-700">{stats.blocker} Blockers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-gray-700">{stats.decision} Changes</span>
          </div>
        </div>
      </div>

      {/* Moments List */}
      <div className="max-h-[600px] overflow-y-auto p-4 space-y-3">
        {keyMoments.map((moment) => {
          const style = getMomentStyle(moment.type);
          const Icon = style.icon;
          const isNearCurrent = Math.abs(moment.timestamp - currentTime) < 5;

          return (
            <div
              key={moment.id}
              onClick={() => onSeekToTime(moment.timestamp)}
              className={`p-4 rounded-[16px] border-2 cursor-pointer transition-all ${
                isNearCurrent
                  ? `bg-gradient-to-r ${style.bgColor} ${style.borderColor} shadow-lg scale-[1.02]`
                  : 'bg-white/40 border-white/60 hover:bg-white/60 hover:border-white/80 hover:scale-[1.01]'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${style.bgColor} flex items-center justify-center border-2 ${style.borderColor}`}
                >
                  <Icon size={20} className={style.iconColor} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Label and Time */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                      <span>{style.emoji}</span>
                      {moment.label}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full ${
                        isNearCurrent
                          ? `${style.badgeColor} text-white`
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {formatTime(moment.timestamp)}
                    </span>
                  </div>

                  {/* Excerpt */}
                  {moment.excerpt && (
                    <p className="text-sm text-gray-700 line-clamp-2">
                      "{moment.excerpt}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
