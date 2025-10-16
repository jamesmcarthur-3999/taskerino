/**
 * Adaptive Scheduler Debug Panel
 *
 * Shows real-time activity monitoring and adaptive timing calculations
 * Helps users understand what triggers screenshots and how timing adjusts
 */

import React, { useState, useEffect } from 'react';
import { Activity, Brain, Clock, TrendingUp, Eye } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { adaptiveScreenshotScheduler } from '../../services/adaptiveScreenshotScheduler';

interface ActivityMetrics {
  appSwitches: number;
  mouseClicks: number;
  keyboardEvents: number;
  windowFocusChanges: number;
  timestamp: string;
}

interface AdaptiveSchedulerDebugProps {
  isActive: boolean;
}

// Thresholds for normalization (from adaptiveScreenshotScheduler.ts)
const MAX_APP_SWITCHES = 10;
const MAX_MOUSE_CLICKS = 50;
const MAX_WINDOW_FOCUS = 8;
const APP_SWITCH_WEIGHT = 0.5;
const MOUSE_CLICK_WEIGHT = 0.3;
const WINDOW_FOCUS_WEIGHT = 0.2;
const ACTIVITY_WEIGHT = 0.65;
const CURIOSITY_WEIGHT = 0.35;

export function AdaptiveSchedulerDebug({ isActive }: AdaptiveSchedulerDebugProps) {
  const [schedulerState, setSchedulerState] = useState(() => adaptiveScreenshotScheduler.getState());
  const [liveMetrics, setLiveMetrics] = useState<ActivityMetrics | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Poll BOTH scheduler state AND live metrics from Rust every 500ms
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(async () => {
      // Get scheduler state (for curiosity, next capture time, etc.)
      setSchedulerState(adaptiveScreenshotScheduler.getState());

      // Get LIVE activity metrics directly from Rust
      try {
        const metrics = await invoke<ActivityMetrics>('get_activity_metrics', {
          windowSeconds: 60,
        });
        setLiveMetrics(metrics);
      } catch (error) {
        console.error('Failed to get live activity metrics:', error);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  // Calculate LIVE activity score from real-time metrics
  const liveActivityScore = liveMetrics ? (() => {
    const appSwitchScore = Math.min(liveMetrics.appSwitches / MAX_APP_SWITCHES, 1.0);
    const mouseClickScore = Math.min(liveMetrics.mouseClicks / MAX_MOUSE_CLICKS, 1.0);
    const windowFocusScore = Math.min(liveMetrics.windowFocusChanges / MAX_WINDOW_FOCUS, 1.0);

    return appSwitchScore * APP_SWITCH_WEIGHT +
           mouseClickScore * MOUSE_CLICK_WEIGHT +
           windowFocusScore * WINDOW_FOCUS_WEIGHT;
  })() : 0;

  // Use live activity score for display
  const activityPercent = Math.round(liveActivityScore * 100);
  const curiosityPercent = Math.round(schedulerState.lastCuriosityScore * 100);

  // Calculate live urgency
  const liveUrgency = liveActivityScore * ACTIVITY_WEIGHT + schedulerState.lastCuriosityScore * CURIOSITY_WEIGHT;
  const urgencyPercent = Math.round(liveUrgency * 100);

  // Calculate next screenshot time
  const timeUntilNext = schedulerState.nextCaptureTime
    ? Math.max(0, Math.ceil((schedulerState.nextCaptureTime - Date.now()) / 1000))
    : 0;

  // Determine urgency color (use live urgency for real-time feedback)
  const getUrgencyColor = (urgency: number) => {
    if (urgency > 0.7) return 'from-orange-500/20 to-red-500/20 border-orange-400/50';
    if (urgency > 0.4) return 'from-cyan-500/20 to-blue-500/20 border-cyan-400/50';
    return 'from-teal-500/20 to-emerald-500/20 border-teal-400/50';
  };

  const getUrgencyLabel = (urgency: number) => {
    if (urgency > 0.7) return 'High Activity';
    if (urgency > 0.4) return 'Moderate Activity';
    return 'Low Activity';
  };

  // Show raw event counts for debugging
  const rawCounts = liveMetrics ? {
    appSwitches: liveMetrics.appSwitches,
    mouseClicks: liveMetrics.mouseClicks,
    windowFocus: liveMetrics.windowFocusChanges,
  } : null;

  return (
    <div className="mt-4">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-white/30 backdrop-blur-sm rounded-[12px] border-2 border-white/40 hover:bg-white/40 transition-all"
      >
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-cyan-600" />
          <span className="text-sm font-semibold text-gray-700">Adaptive Timing</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
            urgencyPercent > 70 ? 'bg-orange-100 text-orange-700' :
            urgencyPercent > 40 ? 'bg-cyan-100 text-cyan-700' :
            'bg-teal-100 text-teal-700'
          }`}>
            {getUrgencyLabel(liveUrgency)}
          </span>
          {rawCounts && (
            <span className="text-xs text-gray-500 font-mono">
              ({rawCounts.appSwitches}a {rawCounts.mouseClicks}c {rawCounts.windowFocus}f)
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {isExpanded ? '▼' : '▶'}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-2 space-y-3 p-4 bg-white/20 backdrop-blur-sm rounded-[12px] border-2 border-white/30">
          {/* Next Screenshot Timer */}
          <div className={`p-3 bg-gradient-to-r ${getUrgencyColor(liveUrgency)} backdrop-blur-sm rounded-[12px] border-2`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-700" />
                <span className="text-sm font-semibold text-gray-700">Next Screenshot</span>
              </div>
              <span className="text-2xl font-bold text-gray-900 font-mono">{timeUntilNext}s</span>
            </div>
            <div className="text-xs text-gray-600">
              Capture #{schedulerState.captureCount + 1} • Run ID: {schedulerState.isActive ? 'Active' : 'Inactive'}
            </div>
          </div>

          {/* Urgency Breakdown */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Urgency Calculation</div>

            {/* Activity Score */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-cyan-600" />
                  <span className="font-medium text-gray-700">User Activity</span>
                </div>
                <span className="font-bold text-gray-900">{activityPercent}%</span>
              </div>
              <div className="w-full bg-gray-200/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
                  style={{ width: `${activityPercent}%` }}
                />
              </div>
              <div className="text-xs text-gray-500">
                65% weight • Based on app switches, clicks, focus changes
              </div>
              {rawCounts && (
                <div className="text-xs font-mono text-gray-600 bg-white/40 rounded px-2 py-1 mt-1">
                  📊 Raw counts (last 60s): {rawCounts.appSwitches} apps • {rawCounts.mouseClicks} clicks • {rawCounts.windowFocus} focus
                </div>
              )}
            </div>

            {/* AI Curiosity Score */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Brain size={14} className="text-purple-600" />
                  <span className="font-medium text-gray-700">AI Curiosity</span>
                </div>
                <span className="font-bold text-gray-900">{curiosityPercent}%</span>
              </div>
              <div className="w-full bg-gray-200/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
                  style={{ width: `${curiosityPercent}%` }}
                />
              </div>
              <div className="text-xs text-gray-500">
                35% weight • How interested AI is in next screenshot
              </div>
            </div>

            {/* Combined Urgency */}
            <div className="space-y-1 pt-2 border-t-2 border-white/30">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-gray-700" />
                  <span className="font-bold text-gray-800">Combined Urgency</span>
                </div>
                <span className="font-bold text-gray-900">{urgencyPercent}%</span>
              </div>
              <div className="w-full bg-gray-200/60 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    urgencyPercent > 70 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                    urgencyPercent > 40 ? 'bg-gradient-to-r from-cyan-500 to-blue-500' :
                    'bg-gradient-to-r from-teal-500 to-emerald-500'
                  }`}
                  style={{ width: `${urgencyPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Timing Range Info */}
          <div className="p-3 bg-white/40 backdrop-blur-sm rounded-[12px] border-2 border-white/40">
            <div className="flex items-center gap-2 mb-1">
              <Eye size={14} className="text-gray-600" />
              <span className="text-xs font-semibold text-gray-700">Adaptive Range</span>
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              <div>• <span className="font-semibold">Min:</span> 10 seconds (maximum capture rate)</div>
              <div>• <span className="font-semibold">Max:</span> 5 minutes (safety net)</div>
              <div>• <span className="font-semibold">Current:</span> {Math.round(schedulerState.lastDelay / 1000)} seconds until next</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
