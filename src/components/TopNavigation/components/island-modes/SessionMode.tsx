/**
 * SessionMode Component
 *
 * Session control mode for the navigation island
 */

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Activity, Play, Pause, Square, ArrowRight } from 'lucide-react';
import type { SessionModeProps } from '../../types';
import { loadLastSessionSettings } from '../../../../utils/lastSessionSettings';
import { getRadiusClass } from '../../../../design-system/theme';
import { modeContentVariants, contentSpring } from '../../utils/islandAnimations';
import { useReducedMotion } from '../../../../lib/animations';

export function SessionMode({
  activeSession,
  isSessionActive,
  isSessionPaused,
  isStarting,
  countdown,
  sessionDescription,
  onSessionDescriptionChange,
  onPauseSession,
  onResumeSession,
  onEndSession,
  onStartSession,
  onNavigateToSessions,
  onClose,
}: SessionModeProps) {
  // Ref for live time updates (direct DOM manipulation for performance)
  const sessionTimeRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Format elapsed time helper
  const formatElapsedTime = (startTime: string) => {
    const start = new Date(startTime).getTime();
    const now = new Date().getTime();
    const diff = now - start;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format relative time helper
  const formatRelativeTime = (timestamp: string) => {
    const now = new Date().getTime();
    const then = new Date(timestamp).getTime();
    const diff = now - then;

    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  // Live time update for session elapsed time - using ref to avoid re-renders
  useEffect(() => {
    // Update DOM directly every second when session is active (no re-render needed)
    if (activeSession) {
      const interval = setInterval(() => {
        if (sessionTimeRef.current) {
          sessionTimeRef.current.textContent = formatElapsedTime(activeSession.startTime);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeSession]);

  // Handle session start with countdown
  const handleStartClick = async () => {
    const savedSettings = loadLastSessionSettings();
    const sessionName = `Session - ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

    await onStartSession({
      name: sessionName,
      description: sessionDescription,
      status: 'active',
      screenshotInterval: savedSettings.screenshotInterval,
      autoAnalysis: savedSettings.autoAnalysis,
      tags: [],
      audioRecording: savedSettings.audioRecording,
      enableScreenshots: savedSettings.enableScreenshots,
      videoRecording: savedSettings.videoRecording,
      audioMode: savedSettings.audioRecording ? 'transcription' : 'off',
      audioReviewCompleted: false,
    });

    // Clean up UI after countdown completes
    setTimeout(() => {
      onClose();
      onSessionDescriptionChange('');
    }, 500);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && sessionDescription.trim()) {
      e.preventDefault();
      handleStartClick();
    }
  };

  return (
    <motion.div
      variants={modeContentVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
      className="px-4 py-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-900 text-sm">
          {activeSession ? 'Session Control' : 'Start New Session'}
        </h3>
        <button
          onClick={onClose}
          className={`p-1 hover:bg-white/60 ${getRadiusClass('element')} transition-all`}
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {activeSession ? (
        <>
          {/* Session Info Card */}
          <div className={`bg-gradient-to-r from-orange-50/40 to-red-50/40 border-2 border-white/50 ${getRadiusClass('element')} p-4 mb-4`}>
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 ${getRadiusClass('element')} flex items-center justify-center flex-shrink-0`}>
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 text-base">{activeSession.name}</h4>
                <p className="text-sm text-gray-600 mt-0.5">{activeSession.description}</p>
              </div>
            </div>

            {/* Session Stats */}
            <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t-2 border-white/30">
              <div className="text-center">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Duration</div>
                <div ref={sessionTimeRef} className="text-lg font-bold text-gray-900">{formatElapsedTime(activeSession.startTime)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Screenshots</div>
                <div className="text-lg font-bold text-gray-900">{activeSession.screenshots.length}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Last Capture</div>
                <div className="text-sm font-semibold text-gray-700">
                  {activeSession.lastScreenshotTime
                    ? formatRelativeTime(activeSession.lastScreenshotTime)
                    : 'None yet'}
                </div>
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-3 mb-3">
            <button
              onClick={() => {
                if (isSessionActive) {
                  onPauseSession();
                } else {
                  onResumeSession();
                }
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white ${getRadiusClass('element')} font-semibold hover:shadow-lg transition-all text-sm`}
            >
              {isSessionActive ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause Session
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Resume Session
                </>
              )}
            </button>
            <button
              onClick={() => {
                if (window.confirm('Stop this session? You can view the results in the Sessions page.')) {
                  onEndSession();
                  onClose();
                }
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white ${getRadiusClass('element')} font-semibold hover:shadow-lg transition-all text-sm`}
            >
              <Square className="w-4 h-4" />
              Stop Session
            </button>
          </div>

          {/* View All Button */}
          <button
            onClick={() => {
              onNavigateToSessions();
              onClose();
            }}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 backdrop-blur-sm ${getRadiusClass('element')} transition-all border-2 border-white/60 text-gray-700 hover:text-orange-600 font-medium text-sm`}
          >
            View All Screenshots
            <ArrowRight className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          {!isStarting ? (
            <div className="space-y-3">
              <textarea
                value={sessionDescription}
                onChange={(e) => onSessionDescriptionChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What are you working on?"
                className={`w-full px-4 py-3 bg-white/60 backdrop-blur-sm border-2 border-white/50 ${getRadiusClass('element')} focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white/80 transition-all placeholder-gray-400 min-h-[100px] resize-none`}
                autoFocus
              />

              {sessionDescription.trim() && (
                <button
                  onClick={handleStartClick}
                  className={`w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white ${getRadiusClass('element')} font-bold hover:shadow-xl transition-all text-sm flex items-center justify-center gap-2`}
                >
                  <Play className="w-4 h-4" />
                  Start Session
                </button>
              )}

              <p className="text-xs text-gray-500 text-center">
                Press ⌘Enter to start
              </p>
            </div>
          ) : (
            <div className="text-center py-3">
              {countdown !== null && countdown > 0 ? (
                <>
                  <div className="text-5xl font-bold text-orange-600 mb-2">{countdown}</div>
                  <p className="text-sm font-semibold text-gray-700">Starting session...</p>
                </>
              ) : countdown === 0 ? (
                <>
                  <div className="text-3xl mb-2">🎬</div>
                  <p className="text-sm font-semibold text-gray-700">Recording!</p>
                </>
              ) : (
                <>
                  <div className="text-3xl mb-2">🎬</div>
                  <p className="text-sm font-semibold text-gray-700">Starting...</p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
