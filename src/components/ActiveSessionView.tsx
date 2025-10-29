/**
 * ActiveSessionView - Redesigned Phase 1
 *
 * New design matching SessionDetailView with 3 tabs:
 * - Monitor: Split-panel (screenshots + transcript) + notes (Phase 2)
 * - Summary: Live AI-generated insights (Phase 3)
 * - Timeline: Old timeline view (deprecated, will be removed)
 *
 * Phase 1: Foundation - Header + tab structure
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Camera, Mic, CheckSquare, Clock, Pause, Play, Square, Columns, AlertCircle, Activity } from 'lucide-react';
import type { Session, SessionContextItem } from '../types';
import { SessionTimeline } from './SessionTimeline';
import { ScreenshotsList } from './sessions/ScreenshotsList';
import { LiveTranscriptPanel } from './sessions/LiveTranscriptPanel';
import { SessionNotes } from './sessions/SessionNotes';
import { adaptiveScreenshotScheduler } from '../services/adaptiveScreenshotScheduler';
import { RecordingStats } from './sessions/RecordingStats';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useScrollAnimation } from '../contexts/ScrollAnimationContext';
import {
  BACKGROUND_GRADIENT,
  getGlassClasses,
  getRadiusClass,
  getStatusBadgeClasses,
  getActivityGradient,
  TRANSITIONS,
} from '../design-system/theme';

interface ActiveSessionViewProps {
  session: Session;
}

export function ActiveSessionView({ session }: ActiveSessionViewProps) {
  const {
    addScreenshotComment,
    toggleScreenshotFlag,
    addContextItem,
    pauseSession,
    resumeSession,
    endSession,
  } = useActiveSession();

  const { scrollY, isScrolled, registerScrollContainer, unregisterScrollContainer } = useScrollAnimation();
  const contentRef = useRef<HTMLDivElement>(null);

  // Tab state
  const [activeView, setActiveView] = useState<'monitor' | 'summary' | 'timeline'>('monitor');

  // Live stats state
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const isPaused = session.status === 'paused';

  // Delayed progress for animations (after header collapse at 150px)
  const delayedProgress = useMemo(() => {
    if (scrollY < 150) return 0;
    if (scrollY >= 300) return 1;
    return (scrollY - 150) / 150;
  }, [scrollY]);

  // Register content container with ScrollAnimationContext
  useEffect(() => {
    const container = contentRef.current;
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
        const schedulerState = adaptiveScreenshotScheduler.getState();
        if (schedulerState.nextCaptureTime) {
          nextShot = schedulerState.nextCaptureTime;
        } else {
          setCountdown(0);
          return;
        }
      } else {
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

  // Format elapsed time
  const formatElapsed = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle context item addition
  const handleAddContext = (contextItem: SessionContextItem) => {
    addContextItem(contextItem);
  };

  // Handle pause/resume
  const handlePauseResume = () => {
    if (isPaused) {
      resumeSession();
    } else {
      pauseSession();
    }
  };

  // Handle end session
  const handleEndSession = () => {
    if (confirm('End this session? You can review it afterwards.')) {
      endSession();
    }
  };

  return (
    <div className={`h-full w-full ${BACKGROUND_GRADIENT.primary} ${getRadiusClass('card')} shadow-xl overflow-hidden relative flex flex-col`}>
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 via-cyan-500/10 to-teal-500/10 animate-gradient-reverse pointer-events-none" />

      {/* Header */}
      <div
        className={`relative z-10 flex-shrink-0 ${getGlassClasses('medium')} border-b-2 shadow-xl ${TRANSITIONS.standard}`}
        style={{
          paddingLeft: '1.5rem',
          paddingRight: '1.5rem',
          paddingTop: scrollY >= 150 ? `${1.5 - (delayedProgress * 0.5)}rem` : '1.5rem',
          paddingBottom: scrollY >= 150 ? `${1.5 - (delayedProgress * 0.5)}rem` : '1.5rem',
        }}
      >
        <div className="max-w-7xl mx-auto flex items-start justify-between gap-8">
          {/* Left: Title & Stats */}
          <div
            className={`flex-1 min-w-0 ${TRANSITIONS.standard}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: isScrolled ? '0.25rem' : '0.375rem',
            }}
          >
            {/* Title & Status */}
            <div className="flex items-center gap-3">
              <h1 className={`font-bold text-gray-900 truncate ${TRANSITIONS.standard} ${
                isScrolled ? 'text-xl' : 'text-2xl'
              }`}>
                {session.name}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm flex-shrink-0 ${getStatusBadgeClasses(session.status as any)}`}>
                {isPaused ? 'Paused' : 'Recording'}
              </span>
            </div>

            {/* Description - hide when scrolled */}
            {session.description && (
              <div
                className={TRANSITIONS.standard}
                style={{
                  maxHeight: isScrolled ? '0px' : '80px',
                  opacity: isScrolled ? 0 : 1,
                  overflow: isScrolled ? 'hidden' : 'visible',
                }}
              >
                <p className="text-sm text-gray-600">{session.description}</p>
              </div>
            )}

            {/* Live Stats Row - Always visible */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Live Timer */}
              <div className={`px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 ${getGlassClasses('subtle')} ${getRadiusClass('field')} flex items-center gap-2`}>
                <Clock size={18} className="text-blue-600" />
                <span className="text-lg font-bold text-gray-900 font-mono tracking-wider">
                  {formatElapsed(liveElapsed)}
                </span>
              </div>

              {/* Next Capture Countdown */}
              {session.enableScreenshots && !isPaused && countdown > 0 && (() => {
                const isAdaptiveMode = session.screenshotInterval === -1;
                const schedulerState = isAdaptiveMode ? adaptiveScreenshotScheduler.getState() : null;
                const activityLevel = schedulerState?.lastActivityScore || 0;
                const urgency = schedulerState?.lastUrgency || 0;

                const activityType = isAdaptiveMode
                  ? urgency > 0.7 ? 'meeting'
                    : urgency > 0.4 ? 'browser'
                    : 'email'
                  : 'browser';

                const gradient = getActivityGradient(activityType);

                return (
                  <div className={`px-4 py-2 ${gradient.background} ${getGlassClasses('subtle')} ${getRadiusClass('field')} flex items-center gap-2 ${isAdaptiveMode ? 'animate-pulse' : ''}`}>
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

              {/* Screenshot Count */}
              {session.enableScreenshots && (
                <div className={`px-4 py-2 ${getGlassClasses('medium')} ${getRadiusClass('field')} flex items-center gap-2`}>
                  <Camera size={16} className="text-cyan-600" />
                  <span className="text-sm font-bold text-gray-900">{session.screenshots?.length || 0} shots</span>
                </div>
              )}

              {/* Audio Count */}
              {session.audioRecording && (
                <div className={`px-4 py-2 ${getGlassClasses('medium')} ${getRadiusClass('field')} flex items-center gap-2`}>
                  <Mic size={16} className="text-red-600" />
                  <span className="text-sm font-bold text-gray-900">{session.audioSegments?.length || 0}</span>
                  {!isPaused && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                </div>
              )}

              {/* Tasks Count */}
              <div className={`px-4 py-2 ${getGlassClasses('medium')} ${getRadiusClass('field')} flex items-center gap-2`}>
                <CheckSquare size={16} className="text-purple-600" />
                <span className="text-sm font-bold text-gray-900">{session.extractedTaskIds?.length || 0}</span>
              </div>
            </div>

            {/* Video Recording Stats */}
            {session.videoRecording && !isPaused && (
              <div className="mt-2">
                <RecordingStats />
              </div>
            )}
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-start gap-2 flex-shrink-0">
            {/* Pause/Resume Button */}
            <button
              onClick={handlePauseResume}
              className={`px-6 py-3 rounded-xl font-semibold text-white shadow-lg ${TRANSITIONS.standard} ${
                isPaused
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-xl'
                  : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:shadow-xl'
              }`}
            >
              {isPaused ? (
                <><Play size={18} className="inline mr-2" />Resume</>
              ) : (
                <><Pause size={18} className="inline mr-2" />Pause</>
              )}
            </button>

            {/* End Session Button */}
            <button
              onClick={handleEndSession}
              className={`px-6 py-3 bg-gradient-to-r from-red-500 to-rose-500 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl ${TRANSITIONS.standard}`}
            >
              <Square size={18} className="inline mr-2" />
              End Session
            </button>
          </div>
        </div>
      </div>

      {/* Floating View Tabs - Appears when scrolled */}
      <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-20 ${TRANSITIONS.standard} ${
        isScrolled ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
      }`}>
        <div className={`flex gap-2 ${getGlassClasses('subtle')} ${getRadiusClass('pill')} p-1.5 shadow-2xl`}>
          <button
            onClick={() => setActiveView('monitor')}
            className={`px-6 py-2 rounded-full font-semibold text-sm ${TRANSITIONS.standard} ${
              activeView === 'monitor'
                ? 'bg-white/90 shadow-lg text-gray-900'
                : 'text-white hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            Monitor
          </button>
          <button
            onClick={() => setActiveView('summary')}
            className={`px-6 py-2 rounded-full font-semibold text-sm ${TRANSITIONS.standard} ${
              activeView === 'summary'
                ? 'bg-white/90 shadow-lg text-gray-900'
                : 'text-white hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveView('timeline')}
            className={`px-6 py-2 rounded-full font-semibold text-sm ${TRANSITIONS.standard} relative ${
              activeView === 'timeline'
                ? 'bg-white/90 shadow-lg text-gray-900'
                : 'text-white hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            Timeline
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-yellow-400 text-yellow-900 rounded">
              ⚠️
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="relative z-0 flex-1 overflow-y-auto transition-all duration-300"
        style={{
          paddingLeft: '2rem',
          paddingRight: '2rem',
          paddingTop: scrollY >= 150 ? `${2 - (delayedProgress * 0.5)}rem` : '2rem',
          paddingBottom: '2rem',
        }}
      >
        {/* Static View Tabs */}
        <div className="mb-8 flex justify-center">
          <div className={`flex gap-2 ${getGlassClasses('medium')} ${getRadiusClass('field')} p-1.5 inline-flex shadow-lg`}>
            <button
              onClick={() => setActiveView('monitor')}
              className={`px-8 py-2.5 ${getRadiusClass('element')} font-semibold text-sm ${TRANSITIONS.standard} ${
                activeView === 'monitor'
                  ? 'bg-white shadow-lg text-gray-900'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              Monitor
            </button>
            <button
              onClick={() => setActiveView('summary')}
              className={`px-8 py-2.5 ${getRadiusClass('element')} font-semibold text-sm ${TRANSITIONS.standard} ${
                activeView === 'summary'
                  ? 'bg-white shadow-lg text-gray-900'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveView('timeline')}
              className={`px-8 py-2.5 ${getRadiusClass('element')} font-semibold text-sm ${TRANSITIONS.standard} relative ${
                activeView === 'timeline'
                  ? 'bg-white shadow-lg text-gray-900'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              Timeline
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-yellow-400 text-yellow-900 rounded uppercase tracking-wide">
                ⚠️ Deprecated
              </span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeView === 'monitor' ? (
          <div className="max-w-7xl mx-auto flex flex-col gap-6" style={{ height: 'calc(100vh - 320px)' }}>
            {/* Split Panel: Screenshots (2/3) + Transcript (1/3) */}
            <div className="flex gap-6 flex-1 min-h-0">
              {/* Left: Screenshots List (2/3) */}
              <div className={`w-2/3 ${getGlassClasses('medium')} ${getRadiusClass('card')} overflow-hidden shadow-xl`}>
                <ScreenshotsList
                  session={session}
                  onAddComment={addScreenshotComment}
                  onToggleFlag={toggleScreenshotFlag}
                />
              </div>

              {/* Right: Live Transcript (1/3) */}
              <div className={`w-1/3 ${getGlassClasses('medium')} ${getRadiusClass('card')} overflow-hidden shadow-xl`}>
                <LiveTranscriptPanel session={session} />
              </div>
            </div>

            {/* Notes Section (Full Width Below) */}
            <div className={`h-72 flex-shrink-0 ${getGlassClasses('medium')} ${getRadiusClass('card')} overflow-hidden shadow-xl`}>
              <SessionNotes
                session={session}
                onAddContext={handleAddContext}
              />
            </div>
          </div>
        ) : activeView === 'summary' ? (
          <div className="max-w-7xl mx-auto space-y-4">
            {session.summary ? (
              <>
                {/* Live Snapshot (Current Focus) */}
                {session.summary.liveSnapshot && (
                  <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-6 shadow-xl`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-cyan-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xs font-semibold text-cyan-700 uppercase tracking-wide mb-2">
                          Right Now
                        </h3>
                        <p className="text-base text-gray-900 leading-relaxed mb-4">
                          {session.summary.liveSnapshot.currentFocus}
                        </p>

                        {/* Progress Today */}
                        {session.summary.liveSnapshot.progressToday && session.summary.liveSnapshot.progressToday.length > 0 && (
                          <div className="space-y-2 mb-4">
                            {session.summary.liveSnapshot.progressToday.map((item, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <CheckSquare className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-gray-700">{item}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Momentum Indicator */}
                        {session.summary.liveSnapshot.momentum && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Momentum:</span>
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-16 rounded-full ${TRANSITIONS.standard} ${
                                session.summary.liveSnapshot.momentum === 'high'
                                  ? 'bg-gradient-to-r from-green-400 to-green-500'
                                  : session.summary.liveSnapshot.momentum === 'medium'
                                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                                  : 'bg-gradient-to-r from-gray-300 to-gray-400'
                              }`} />
                              <span className={`text-xs font-semibold ${
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
                  </div>
                )}

                {/* Two Column Layout: Achievements & Blockers */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Achievements */}
                  <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-5 shadow-xl`}>
                    <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <CheckSquare size={16} className="text-green-600" />
                      Achievements
                    </h3>
                    {session.summary.achievements && session.summary.achievements.length > 0 ? (
                      <ul className="space-y-2">
                        {session.summary.achievements.map((achievement, i) => (
                          <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-green-500 mt-1">✓</span>
                            <span>{achievement}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-500 italic">No achievements recorded yet</p>
                    )}
                  </div>

                  {/* Blockers */}
                  <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-5 shadow-xl`}>
                    <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <AlertCircle size={16} className="text-orange-600" />
                      Blockers
                    </h3>
                    {session.summary.blockers && session.summary.blockers.length > 0 ? (
                      <ul className="space-y-2">
                        {session.summary.blockers.map((blocker, i) => (
                          <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-orange-500 mt-1">⚠</span>
                            <span>{blocker}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-500 italic">No blockers identified</p>
                    )}
                  </div>
                </div>

                {/* Recommended Tasks */}
                {session.summary.recommendedTasks && session.summary.recommendedTasks.length > 0 && (
                  <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-5 shadow-xl`}>
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <CheckSquare size={16} className="text-purple-600" />
                      Recommended Tasks
                    </h3>
                    <div className="space-y-3">
                      {session.summary.recommendedTasks.map((task, i) => (
                        <div key={i} className={`p-3 ${getGlassClasses('subtle')} ${getRadiusClass('field')}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-gray-900">{task.title}</h4>
                            <span className={`px-2 py-0.5 ${getRadiusClass('pill')} text-xs font-semibold ${
                              task.priority === 'urgent'
                                ? 'bg-red-500/20 text-red-700'
                                : task.priority === 'high'
                                ? 'bg-orange-500/20 text-orange-700'
                                : task.priority === 'medium'
                                ? 'bg-yellow-500/20 text-yellow-700'
                                : 'bg-gray-500/20 text-gray-700'
                            }`}>
                              {task.priority.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">{task.context}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Insights */}
                {session.summary.keyInsights && session.summary.keyInsights.length > 0 && (
                  <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-5 shadow-xl`}>
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Columns size={16} className="text-cyan-600" />
                      Key Insights
                    </h3>
                    <div className="space-y-3">
                      {session.summary.keyInsights.map((insight, i) => (
                        <div key={i} className={`p-3 ${getGlassClasses('subtle')} ${getRadiusClass('field')}`}>
                          <p className="text-sm text-gray-800 mb-1">{insight.insight}</p>
                          <span className="text-xs text-gray-500">
                            {new Date(insight.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Focus Areas */}
                {session.summary.focusAreas && session.summary.focusAreas.length > 0 && (
                  <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-5 shadow-xl`}>
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Time Breakdown</h3>
                    <div className="space-y-3">
                      {session.summary.focusAreas.map((area, i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">{area.area}</span>
                            <span className="text-xs text-gray-600">
                              {area.duration}min ({area.percentage}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                              style={{ width: `${area.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-12 text-center shadow-xl`}>
                <Activity size={64} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Summary Generating...
                </h3>
                <p className="text-gray-600">
                  AI insights will appear here as your session progresses
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            {/* Deprecation Warning */}
            <div className={`mb-4 p-4 bg-yellow-100 border-2 border-yellow-400 ${getRadiusClass('card')}`}>
              <div className="flex items-center gap-2">
                <AlertCircle className="text-yellow-700 flex-shrink-0" size={20} />
                <div>
                  <strong className="text-yellow-900">This view will be removed soon.</strong>
                  <p className="text-yellow-800 text-sm">Please use the Monitor tab for the new split-panel experience.</p>
                </div>
              </div>
            </div>

            {/* Old Timeline */}
            <SessionTimeline
              session={session}
              onAddComment={addScreenshotComment}
              onToggleFlag={toggleScreenshotFlag}
              onAddContext={handleAddContext}
            />
          </div>
        )}
      </div>
    </div>
  );
}
