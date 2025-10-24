import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mic, CheckSquare, CheckCircle2, Clock } from 'lucide-react';
import type { Session, SessionContextItem, AudioDeviceConfig, VideoRecordingConfig } from '../types';
import { SessionTimeline } from './SessionTimeline';
import { adaptiveScreenshotScheduler } from '../services/adaptiveScreenshotScheduler';
import { AdaptiveSchedulerDebug } from './sessions/AdaptiveSchedulerDebug';
import { ActiveSessionMediaControls } from './sessions/ActiveSessionMediaControls';
import { Sparkles } from 'lucide-react';
import { useSessions } from '../context/SessionsContext';
import { useUI } from '../context/UIContext';
import { getGlassClasses, getRadiusClass, getStatusBadgeClasses, getActivityGradient } from '../design-system/theme';
import { useScrollAnimation } from '../contexts/ScrollAnimationContext';
import { audioRecordingService } from '../services/audioRecordingService';
import { videoRecordingService } from '../services/videoRecordingService';

interface ActiveSessionViewProps {
  session: Session;
}

export function ActiveSessionView({ session }: ActiveSessionViewProps) {
  const { addScreenshotComment, toggleScreenshotFlag, addContextItem, updateSession } = useSessions();
  const { addNotification } = useUI();
  const { registerScrollContainer, unregisterScrollContainer } = useScrollAnimation();
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const isPaused = session.status === 'paused';

  // Register timeline as scroll container for menu morphing
  useEffect(() => {
    const container = timelineScrollRef.current;
    if (!container) return;

    registerScrollContainer(container);
    return () => unregisterScrollContainer(container);
  }, [registerScrollContainer, unregisterScrollContainer]);

  // Live timer
  useEffect(() => {
    if (isPaused) return;

    const updateElapsed = () => {
      if (session.startTime) {
        const elapsed = Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000);
        setLiveElapsed(elapsed);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [session.startTime, isPaused]);

  // Format elapsed time
  const formatElapsed = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Countdown timer for next screenshot
  useEffect(() => {
    if (isPaused || !session.enableScreenshots) {
      setCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      let nextShot: number;

      // Check if using adaptive mode
      if (session.screenshotInterval === -1 && adaptiveScreenshotScheduler.isActive()) {
        // Adaptive mode - use scheduler's actual next capture time
        const schedulerState = adaptiveScreenshotScheduler.getState();
        if (schedulerState.nextCaptureTime) {
          nextShot = schedulerState.nextCaptureTime;
        } else {
          // Scheduler hasn't set next capture time yet
          setCountdown(0);
          return;
        }
      } else {
        // Fixed interval mode - calculate based on last screenshot + interval
        if (!session.lastScreenshotTime) {
          setCountdown(0);
          return;
        }
        const lastShot = new Date(session.lastScreenshotTime).getTime();
        const intervalMs = session.screenshotInterval === -1 ? 2 * 60 * 1000 : session.screenshotInterval * 60 * 1000;
        nextShot = lastShot + intervalMs;
      }

      const remaining = Math.max(0, Math.ceil((nextShot - now) / 1000));
      setCountdown(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [session.lastScreenshotTime, session.screenshotInterval, isPaused, session.enableScreenshots]);

  const handleAddContext = (contextItem: SessionContextItem) => {
    addContextItem(session.id, contextItem);
  };

  // Handle audio configuration changes during active session
  const handleAudioConfigChange = async (config: AudioDeviceConfig) => {
    // Update session in context
    updateSession({ ...session, audioConfig: config });

    // Hot-swap devices if recording is active
    if (session.audioRecording) {
      try {
        // Set mix configuration (includes device IDs, balance, volumes)
        await audioRecordingService.setMixConfig(config);

        // Show success notification
        addNotification({
          type: 'success',
          title: 'Audio Settings Updated',
          message: 'Audio device configuration changed successfully',
        });
      } catch (error) {
        console.error('Failed to update audio config:', error);
        addNotification({
          type: 'error',
          title: 'Failed to Update Audio',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    }
  };

  // Handle video configuration changes during active session
  const handleVideoConfigChange = async (config: VideoRecordingConfig) => {
    // Update session in context
    updateSession({ ...session, videoConfig: config });

    // Note: Video device hot-swapping is not yet supported by backend
    // The new config will be saved but won't take effect until next session
    // TODO: Implement hot-swap support in videoRecordingService

    if (session.videoRecording) {
      addNotification({
        type: 'info',
        title: 'Video Settings Saved',
        message: 'Video configuration updated. Changes will take effect in the next session.',
      });
    }
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Header with live stats */}
      <div className="p-6 border-b-2 border-white/40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{session.name}</h2>
            <p className="text-sm text-gray-600">{session.description}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Live Duration Timer */}
            <div className={`px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 ${getGlassClasses('subtle')} ${getRadiusClass('field')} flex items-center gap-2`}>
              <Clock size={18} className="text-blue-600" />
              <span className="text-lg font-bold text-gray-900 font-mono tracking-wider">
                {formatElapsed(liveElapsed)}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Next Capture Countdown */}
          {session.enableScreenshots && !isPaused && countdown > 0 && (() => {
            const isAdaptiveMode = session.screenshotInterval === -1;
            const schedulerState = isAdaptiveMode ? adaptiveScreenshotScheduler.getState() : null;
            const activityLevel = schedulerState?.lastActivityScore || 0;
            const urgency = schedulerState?.lastUrgency || 0;

            // Determine activity type based on urgency for gradient selection
            const activityType = isAdaptiveMode
              ? urgency > 0.7 ? 'meeting'    // High urgency -> red/orange
                : urgency > 0.4 ? 'browser'   // Medium urgency -> cyan/blue
                : 'email'                     // Low urgency -> green/teal
              : 'browser';                    // Default -> cyan

            const gradient = getActivityGradient(activityType);
            const glassClasses = getGlassClasses('subtle');

            return (
              <div className={`px-4 py-2 ${gradient.background} ${glassClasses} ${getRadiusClass('field')} flex items-center gap-2 ${isAdaptiveMode ? 'animate-pulse' : ''}`}>
                <Camera size={16} className={gradient.text} />
                <span className={`text-sm font-bold ${gradient.text}`}>
                  {isAdaptiveMode && <span className="mr-1">🧠</span>}
                  Next in <span className="font-mono">{countdown}s</span>
                  {isAdaptiveMode && schedulerState && (
                    <span className="ml-2 text-xs opacity-75">
                      ({Math.round(activityLevel * 100)}% active)
                    </span>
                  )}
                </span>
              </div>
            );
          })()}

          {/* Screenshots Count */}
          {session.enableScreenshots && (
            <div className={`px-4 py-2 ${getGlassClasses('medium')} ${getRadiusClass('field')} flex items-center gap-2`}>
              <Camera size={16} className="text-cyan-600" />
              <span className="text-sm font-bold text-gray-900">{session.screenshots?.length || 0} shots</span>
            </div>
          )}

          {/* Audio */}
          {session.audioRecording && (
            <div className={`px-4 py-2 ${getGlassClasses('medium')} ${getRadiusClass('field')} flex items-center gap-2`}>
              <Mic size={16} className="text-red-600" />
              <span className="text-sm font-bold text-gray-900">{session.audioSegments?.length || 0}</span>
              {!isPaused && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            </div>
          )}

          {/* Tasks */}
          <div className={`px-4 py-2 ${getGlassClasses('medium')} ${getRadiusClass('field')} flex items-center gap-2`}>
            <CheckSquare size={16} className="text-purple-600" />
            <span className="text-sm font-bold text-gray-900">{session.extractedTaskIds?.length || 0}</span>
          </div>

          {/* AI Learning Indicator */}
          {session.screenshots?.some(s => s.analysisStatus === 'analyzing') && (
            <div className={`px-3 py-1.5 ${getStatusBadgeClasses('in-progress')} ${getRadiusClass('pill')} flex items-center gap-2`}>
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-xs font-bold">AI Learning</span>
            </div>
          )}
        </div>

        {/* Adaptive Scheduler Debug Panel */}
        {session.screenshotInterval === -1 && session.enableScreenshots && !isPaused && (
          <AdaptiveSchedulerDebug isActive={true} />
        )}
      </div>

      {/* Device Settings Panel - Collapsible mid-session controls */}
      <ActiveSessionMediaControls
        session={session}
        onAudioConfigChange={handleAudioConfigChange}
        onVideoConfigChange={handleVideoConfigChange}
      />

      {/* AI Summary Section */}
      {session.summary?.liveSnapshot && (
        <div className="px-6 pt-4 pb-6 border-b-2 border-white/40">
          <div className={`bg-gradient-to-br from-cyan-500/10 to-blue-500/10 ${getGlassClasses('subtle')} ${getRadiusClass('field')} p-4`}>
            <div className="flex items-start gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-cyan-700 uppercase tracking-wide mb-1">
                  Right Now
                </p>
                <p className="text-sm text-gray-800 leading-relaxed">
                  {session.summary.liveSnapshot.currentFocus}
                </p>
              </div>
            </div>

            {/* Progress Bullets */}
            {session.summary.liveSnapshot.progressToday && session.summary.liveSnapshot.progressToday.length > 0 && (
              <div className="ml-6 space-y-1 mb-3">
                {session.summary.liveSnapshot.progressToday.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Momentum Indicator */}
            {session.summary.liveSnapshot.momentum && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Momentum:</span>
                <div className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-12 rounded-full transition-all ${
                    session.summary.liveSnapshot.momentum === 'high'
                      ? 'bg-gradient-to-r from-green-400 to-green-500'
                      : session.summary.liveSnapshot.momentum === 'medium'
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                      : 'bg-gradient-to-r from-gray-300 to-gray-400'
                  }`} />
                  <span className={`text-[10px] font-semibold ${
                    session.summary.liveSnapshot.momentum === 'high'
                      ? 'text-green-600'
                      : session.summary.liveSnapshot.momentum === 'medium'
                      ? 'text-yellow-600'
                      : 'text-gray-600'
                  }`}>
                    {session.summary.liveSnapshot.momentum.toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline - Scrollable */}
      <div ref={timelineScrollRef} className="flex-1 overflow-y-auto p-6">
        <SessionTimeline
          session={session}
          onAddComment={(screenshotId, comment) => {
            addScreenshotComment(screenshotId, comment);
          }}
          onToggleFlag={(screenshotId) => {
            toggleScreenshotFlag(screenshotId);
          }}
          onAddContext={handleAddContext}
        />
      </div>
    </div>
  );
}
