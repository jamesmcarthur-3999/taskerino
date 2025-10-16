/**
 * UnifiedMediaPlayer Component - YouTube-Style Overlay Controls
 *
 * Clean, professional media player with controls overlaying the video viewport
 *
 * Features:
 * - Overlay controls INSIDE video viewport (YouTube style)
 * - Auto-hiding controls with smooth fade transitions
 * - Clean, professional UI design
 * - Tasteful hover effects and transitions
 * - Professional speed and volume controls
 * - Master-slave sync: Video/audio is master, everything follows
 * - Unified timeline with all markers
 * - Adapts to 7 media combinations
 * - Massive vertical space savings
 */

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Camera, MessageSquare, Maximize, Minimize, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Session, SessionScreenshot, SessionAudioSegment, SessionVideo, AudioKeyMoment } from '../types';
import { audioConcatenationService } from '../services/audioConcatenationService';
import { videoStorageService } from '../services/videoStorageService';
import { attachmentStorage } from '../services/attachmentStorage';
import { ChaptersPanel } from './ChaptersPanel';
import {
  RADIUS,
  SHADOWS,
  ICON_SIZES,
  TRANSITIONS,
  getGlassmorphism,
  getSuccessGradient,
  getInfoGradient
} from '../design-system/theme';

// ============================================================================
// Component Interfaces
// ============================================================================

export interface UnifiedMediaPlayerProps {
  session: Session;
  screenshots: SessionScreenshot[];
  audioSegments?: SessionAudioSegment[];
  video?: SessionVideo;
  keyMoments?: AudioKeyMoment[];
  onTimeUpdate?: (time: number) => void;
  onChaptersGenerated?: () => void;
}

export interface UnifiedMediaPlayerRef {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  play: () => void;
  pause: () => void;
}

// ============================================================================
// Media Mode Detection
// ============================================================================

type MediaMode = 'none' | 'screenshots' | 'audio' | 'video' | 'screenshots-audio' | 'video-audio' | 'video-screenshots-audio';

function detectMediaMode(
  hasScreenshots: boolean,
  hasAudio: boolean,
  hasVideo: boolean
): MediaMode {
  if (hasVideo && hasAudio) {
    return 'video-audio';
  } else if (hasVideo) {
    return 'video';
  } else if (hasScreenshots && hasAudio) {
    return 'screenshots-audio';
  } else if (hasScreenshots) {
    return 'screenshots';
  } else if (hasAudio) {
    return 'audio';
  }
  return 'none';
}

// ============================================================================
// Main Component
// ============================================================================

export const UnifiedMediaPlayer = forwardRef<UnifiedMediaPlayerRef, UnifiedMediaPlayerProps>(
  ({ session, screenshots = [], audioSegments = [], video, keyMoments = [], onTimeUpdate, onChaptersGenerated }, ref) => {
    // Media detection
    const hasScreenshots = screenshots.length > 0;
    const hasAudio = audioSegments.length > 0;
    const hasVideo = !!video?.fullVideoAttachmentId;
    const mediaMode = detectMediaMode(hasScreenshots, hasAudio, hasVideo);

    // Playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // UI state for auto-hiding controls
    const [showControls, setShowControls] = useState(true);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [transcriptExpanded, setTranscriptExpanded] = useState(true);
    const [activeTab, setActiveTab] = useState<'transcript' | 'chapters'>('transcript');
    const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Loading state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Media URLs
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    // Refs for media elements
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const transcriptPanelRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync lock to prevent ping-pong effect
    const syncLockRef = useRef(false);
    const SYNC_THRESHOLD = 0.15;

    // Calculate session duration
    const sessionDurationMs = session.endTime
      ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
      : Date.now() - new Date(session.startTime).getTime();
    const sessionDurationSeconds = sessionDurationMs / 1000;

    // ============================================================================
    // Auto-hiding Controls Logic
    // ============================================================================

    const scheduleHideControls = useCallback(() => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }

      if (isPlaying) {
        hideControlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 2000);
      }
    }, [isPlaying]);

    const handleMouseMove = useCallback(() => {
      setShowControls(true);
      scheduleHideControls();
    }, [scheduleHideControls]);

    const handleMouseLeave = useCallback(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, [isPlaying]);

    // Show controls when paused, hide when playing
    useEffect(() => {
      if (!isPlaying) {
        setShowControls(true);
        if (hideControlsTimeoutRef.current) {
          clearTimeout(hideControlsTimeoutRef.current);
        }
      } else {
        scheduleHideControls();
      }
    }, [isPlaying, scheduleHideControls]);

    // ============================================================================
    // Media Loading
    // ============================================================================

    // Load video URL
    useEffect(() => {
      if (!hasVideo || !video?.fullVideoAttachmentId) return;

      const loadVideo = async () => {
        setLoading(true);
        try {
          const attachment = await attachmentStorage.getAttachment(video.fullVideoAttachmentId);
          if (!attachment) {
            throw new Error('Video attachment not found');
          }

          const url = await videoStorageService.getVideoUrl(attachment);
          if (!url) {
            throw new Error('Failed to convert video file to URL');
          }

          setVideoUrl(url);
          setLoading(false);
        } catch (err) {
          console.error('[UNIFIED PLAYER] Failed to load video:', err);
          setError(err instanceof Error ? err.message : 'Failed to load video');
          setLoading(false);
        }
      };

      loadVideo();
    }, [hasVideo, video?.fullVideoAttachmentId]);

    // Load audio URL
    useEffect(() => {
      if (!hasAudio) return;

      const loadAudio = async () => {
        if (!hasVideo) {
          setLoading(true);
        }

        try {
          audioConcatenationService.buildTimeline(audioSegments);
          const totalDuration = audioConcatenationService.getTotalDuration();

          let url = audioConcatenationService.getCachedWAVUrl(session.id);

          if (!url) {
            const wavBlob = await audioConcatenationService.exportAsWAV(audioSegments, {}, session.id);
            url = URL.createObjectURL(wavBlob);
          }

          setAudioUrl(url);

          if (!hasVideo) {
            setDuration(totalDuration);
          }

          setLoading(false);
        } catch (err) {
          console.error('[UNIFIED PLAYER] Failed to load audio:', err);
          setError(err instanceof Error ? err.message : 'Failed to load audio');
          setLoading(false);
        }
      };

      loadAudio();
    }, [hasAudio, hasVideo, audioSegments, session.id]);

    // Set duration from session for non-media modes
    useEffect(() => {
      if (!hasAudio && !hasVideo) {
        setDuration(sessionDurationSeconds);
      }
    }, [hasAudio, hasVideo, sessionDurationSeconds]);

    // ============================================================================
    // Master-Slave Sync Logic
    // ============================================================================

    const handleVideoTimeUpdate = useCallback(() => {
      if (!videoRef.current) return;

      const time = videoRef.current.currentTime;

      setCurrentTime(time);
      onTimeUpdate?.(time);

      if (audioRef.current && hasAudio && !syncLockRef.current) {
        const audioCurrent = audioRef.current.currentTime;
        const drift = Math.abs(audioCurrent - time);

        if (drift > SYNC_THRESHOLD) {
          syncLockRef.current = true;
          audioRef.current.currentTime = time;
          setTimeout(() => {
            syncLockRef.current = false;
          }, 100);
        }
      }
    }, [hasAudio, onTimeUpdate]);

    const handleAudioTimeUpdate = useCallback(() => {
      if (!audioRef.current || hasVideo) return;

      const time = audioRef.current.currentTime;

      setCurrentTime(time);
      onTimeUpdate?.(time);
    }, [hasVideo, onTimeUpdate]);

    // Attach time update listeners
    useEffect(() => {
      const video = videoRef.current;
      const audio = audioRef.current;

      if (video && hasVideo) {
        video.addEventListener('timeupdate', handleVideoTimeUpdate);
        return () => {
          video.removeEventListener('timeupdate', handleVideoTimeUpdate);
        };
      } else if (audio && hasAudio) {
        audio.addEventListener('timeupdate', handleAudioTimeUpdate);
        return () => {
          audio.removeEventListener('timeupdate', handleAudioTimeUpdate);
        };
      }
    }, [hasVideo, hasAudio, handleVideoTimeUpdate, handleAudioTimeUpdate]);

    // ============================================================================
    // Playback Controls
    // ============================================================================

    const togglePlayPause = useCallback(() => {
      const video = videoRef.current;
      const audio = audioRef.current;

      if (isPlaying) {
        video?.pause();
        audio?.pause();
        setIsPlaying(false);
      } else {
        video?.play();
        audio?.play();
        setIsPlaying(true);
      }
    }, [isPlaying]);

    const seekTo = useCallback((time: number) => {
      const newTime = Math.max(0, Math.min(duration, time));

      syncLockRef.current = true;

      if (videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
      }

      setCurrentTime(newTime);

      setTimeout(() => {
        syncLockRef.current = false;
      }, 100);
    }, [duration]);

    const skip = useCallback((seconds: number) => {
      seekTo(currentTime + seconds);
    }, [currentTime, seekTo]);

    const handleVolumeChange = useCallback((newVolume: number) => {
      setVolume(newVolume);
      if (videoRef.current) videoRef.current.volume = newVolume;
      if (audioRef.current) audioRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }, []);

    const toggleMute = useCallback(() => {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      if (videoRef.current) videoRef.current.muted = newMuted;
      if (audioRef.current) audioRef.current.muted = newMuted;
    }, [isMuted]);

    const setSpeed = useCallback((speed: number) => {
      setPlaybackRate(speed);
      if (videoRef.current) videoRef.current.playbackRate = speed;
      if (audioRef.current) audioRef.current.playbackRate = speed;
      setShowSpeedMenu(false);
    }, []);

    const toggleFullscreen = useCallback(async () => {
      if (!containerRef.current) return;

      try {
        if (!isFullscreen) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        } else {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      } catch (err) {
        console.error('[UNIFIED PLAYER] Fullscreen error:', err);
      }
    }, [isFullscreen]);

    // Listen for fullscreen changes
    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };

      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
      };
    }, []);

    // ============================================================================
    // External Control Interface
    // ============================================================================

    useImperativeHandle(ref, () => ({
      seekTo,
      getCurrentTime: () => currentTime,
      play: () => {
        videoRef.current?.play();
        audioRef.current?.play();
        setIsPlaying(true);
      },
      pause: () => {
        videoRef.current?.pause();
        audioRef.current?.pause();
        setIsPlaying(false);
      },
    }), [seekTo, currentTime]);

    // ============================================================================
    // Transcript Auto-Scroll
    // ============================================================================

    const lastScrolledSegmentRef = useRef<string | null>(null);

    useEffect(() => {
      if (!transcriptPanelRef.current || !hasAudio) return;

      const activeSegment = audioSegments.find((segment, index) => {
        const segmentTime = (new Date(segment.timestamp).getTime() - new Date(session.startTime).getTime()) / 1000;
        const nextSegment = audioSegments[index + 1];
        const nextTime = nextSegment
          ? (new Date(nextSegment.timestamp).getTime() - new Date(session.startTime).getTime()) / 1000
          : duration;

        return currentTime >= segmentTime && currentTime < nextTime;
      });

      if (activeSegment && activeSegment.id !== lastScrolledSegmentRef.current) {
        const element = document.getElementById(`segment-${activeSegment.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          lastScrolledSegmentRef.current = activeSegment.id;
        }
      }
    }, [currentTime, audioSegments, hasAudio, duration, session.startTime]);

    // ============================================================================
    // Helper Functions
    // ============================================================================

    const formatTime = (seconds: number): string => {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);

      if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getCurrentScreenshot = (): SessionScreenshot | null => {
      if (!hasScreenshots) return null;

      const sessionStart = new Date(session.startTime).getTime();
      let closestScreenshot: SessionScreenshot | null = null;
      let minDiff = Infinity;

      for (const screenshot of screenshots) {
        const screenshotTime = (new Date(screenshot.timestamp).getTime() - sessionStart) / 1000;
        const diff = Math.abs(screenshotTime - currentTime);

        if (diff < minDiff) {
          minDiff = diff;
          closestScreenshot = screenshot;
        }
      }

      return closestScreenshot;
    };

    // ============================================================================
    // Render States
    // ============================================================================

    if (mediaMode === 'none') {
      return (
        <div className="bg-white rounded-[12px] p-12 text-center shadow-md shadow-cyan-100/20 border border-white/40">
          <Camera size={ICON_SIZES['3xl']} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Media Available</h3>
          <p className="text-gray-600">This session has no video, audio, or screenshots</p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="bg-white backdrop-blur-xl rounded-[12px] border border-white/40 p-12 text-center shadow-md shadow-cyan-100/20">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-6 py-4 rounded-[20px] shadow-md">
            <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="text-left">
              <div className="font-semibold">Loading media...</div>
              <div className="text-sm text-white/90">Preparing {mediaMode}</div>
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-white rounded-[12px] p-12 text-center shadow-md shadow-cyan-100/20 border border-white/40">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Media Error</h3>
            <div className="max-w-2xl mx-auto text-left bg-red-50 border-2 border-red-200 rounded-[16px] p-4">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">{error}</pre>
            </div>
          </div>
        </div>
      );
    }

    // ============================================================================
    // Main Layout Render
    // ============================================================================

    const showTranscript = hasAudio && (mediaMode === 'video-audio' || mediaMode === 'screenshots-audio' || mediaMode === 'audio');
    const showChapters = hasVideo; // Show chapters tab for all videos, even if no chapters yet
    const showSidePanel = showTranscript || showChapters;
    const currentScreenshot = getCurrentScreenshot();

    return (
      <div
        ref={containerRef}
        className="bg-white rounded-[12px] overflow-hidden shadow-md shadow-cyan-100/20 border border-white/40"
      >
        {/* Responsive Layout: Vertical on small screens, Side-by-side on xl screens */}
        <div className="flex flex-col xl:flex-row">
          {/* Media Viewport with Integrated Overlay Controls */}
          <div className="w-full xl:w-[75%]">
            <MediaViewport
              mediaMode={mediaMode}
              videoUrl={videoUrl}
              videoRef={videoRef}
              audioUrl={audioUrl}
              audioRef={audioRef}
              currentScreenshot={currentScreenshot}
              session={session}
              isPlaying={isPlaying}
              togglePlayPause={togglePlayPause}
              onDurationChange={setDuration}
              showControls={showControls}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              currentTime={currentTime}
              duration={duration}
              screenshots={screenshots}
              audioSegments={audioSegments}
              keyMoments={keyMoments}
              onSeek={seekTo}
              volume={volume}
              isMuted={isMuted}
              playbackRate={playbackRate}
              isFullscreen={isFullscreen}
              showSpeedMenu={showSpeedMenu}
              setShowSpeedMenu={setShowSpeedMenu}
              showVolumeSlider={showVolumeSlider}
              setShowVolumeSlider={setShowVolumeSlider}
              onSkip={skip}
              onVolumeChange={handleVolumeChange}
              onToggleMute={toggleMute}
              onSetSpeed={setSpeed}
              onToggleFullscreen={toggleFullscreen}
              formatTime={formatTime}
            />
          </div>

          {/* Side Panel with Tabs - Transcript & Chapters */}
          {showSidePanel && (
            <div className="border-t xl:border-t-0 xl:border-l border-gray-200 w-full xl:w-[25%] flex flex-col xl:h-[700px]">
              {/* Tab Header - Only show tabs if both transcript and chapters are available */}
              {showTranscript && showChapters ? (
                <div className="flex items-center bg-white border-b border-gray-200 flex-shrink-0">
                  <button
                    onClick={() => setActiveTab('transcript')}
                    className={`flex-1 px-4 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      activeTab === 'transcript'
                        ? 'text-cyan-600 border-b-2 border-cyan-500 bg-cyan-50/50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <MessageSquare size={ICON_SIZES.sm} />
                    Transcript
                  </button>
                  <button
                    onClick={() => setActiveTab('chapters')}
                    className={`flex-1 px-4 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      activeTab === 'chapters'
                        ? 'text-cyan-600 border-b-2 border-cyan-500 bg-cyan-50/50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <BookOpen size={ICON_SIZES.sm} />
                    Chapters
                  </button>
                </div>
              ) : null}

              {/* Tab Content */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'transcript' && showTranscript ? (
                  <TranscriptPanel
                    ref={transcriptPanelRef}
                    audioSegments={audioSegments}
                    currentTime={currentTime}
                    session={session}
                    onSeek={seekTo}
                    isExpanded={transcriptExpanded}
                    onToggleExpanded={() => setTranscriptExpanded(!transcriptExpanded)}
                  />
                ) : activeTab === 'chapters' ? (
                  <ChaptersPanel
                    chapters={video?.chapters || []}
                    currentTime={currentTime}
                    onSeekToTime={seekTo}
                    session={session}
                    onChaptersGenerated={onChaptersGenerated}
                  />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

UnifiedMediaPlayer.displayName = 'UnifiedMediaPlayer';

// ============================================================================
// Media Viewport Component with Overlay Controls
// ============================================================================

interface MediaViewportProps {
  mediaMode: MediaMode;
  videoUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  audioUrl: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentScreenshot: SessionScreenshot | null;
  session: Session;
  isPlaying: boolean;
  togglePlayPause: () => void;
  onDurationChange: (duration: number) => void;
  showControls: boolean;
  onMouseMove: () => void;
  onMouseLeave: () => void;
  currentTime: number;
  duration: number;
  screenshots: SessionScreenshot[];
  audioSegments: SessionAudioSegment[];
  keyMoments: AudioKeyMoment[];
  onSeek: (time: number) => void;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  showSpeedMenu: boolean;
  setShowSpeedMenu: (show: boolean) => void;
  showVolumeSlider: boolean;
  setShowVolumeSlider: (show: boolean) => void;
  onSkip: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onSetSpeed: (speed: number) => void;
  onToggleFullscreen: () => void;
  formatTime: (seconds: number) => string;
}

function MediaViewport({
  mediaMode,
  videoUrl,
  videoRef,
  audioUrl,
  audioRef,
  currentScreenshot,
  session,
  isPlaying,
  togglePlayPause,
  onDurationChange,
  showControls,
  onMouseMove,
  onMouseLeave,
  currentTime,
  duration,
  screenshots,
  audioSegments,
  keyMoments,
  onSeek,
  volume,
  isMuted,
  playbackRate,
  isFullscreen,
  showSpeedMenu,
  setShowSpeedMenu,
  showVolumeSlider,
  setShowVolumeSlider,
  onSkip,
  onVolumeChange,
  onToggleMute,
  onSetSpeed,
  onToggleFullscreen,
  formatTime,
}: MediaViewportProps) {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  // Load current screenshot
  useEffect(() => {
    if (!currentScreenshot) {
      setScreenshotUrl(null);
      return;
    }

    const loadScreenshot = async () => {
      try {
        const attachment = await attachmentStorage.getAttachment(currentScreenshot.attachmentId);
        if (attachment?.path) {
          const url = convertFileSrc(attachment.path);
          setScreenshotUrl(url);
        }
      } catch (err) {
        console.error('[UNIFIED PLAYER] Failed to load screenshot:', err);
      }
    };

    loadScreenshot();
  }, [currentScreenshot]);

  // Render video with overlay controls
  if (mediaMode === 'video' || mediaMode === 'video-audio') {
    return (
      <div
        className="relative bg-black w-full h-[500px] xl:h-[700px] flex items-center justify-center"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <video
          ref={videoRef}
          src={videoUrl || undefined}
          className="w-full h-full object-contain"
          muted={mediaMode === 'video-audio'}
          playsInline
          preload="metadata"
          onClick={togglePlayPause}
          onLoadedMetadata={(e) => {
            const duration = e.currentTarget.duration;
            if (duration && !isNaN(duration)) {
              console.log('[UNIFIED PLAYER] Video loaded, setting duration:', duration);
              onDurationChange(duration);
            }
          }}
          onTimeUpdate={() => {
            // Handled by event listener in parent
          }}
        />

        {/* Audio element for video-audio mode */}
        {mediaMode === 'video-audio' && audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            style={{ display: 'none' }}
          />
        )}

        {/* Center Play Button Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-opacity duration-300">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="w-20 h-20 bg-white hover:bg-gray-50 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 active:scale-95"
            >
              <Play size={ICON_SIZES['2xl']} className="text-gray-900 ml-1.5" fill="currentColor" />
            </button>
          </div>
        )}

        {/* Controls Overlay - YouTube Style */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/50 to-transparent px-4 pb-3 pt-6 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Timeline */}
          <div className="mb-2">
            <UnifiedTimeline
              currentTime={currentTime}
              duration={duration}
              screenshots={screenshots}
              audioSegments={audioSegments}
              keyMoments={keyMoments}
              session={session}
              onSeek={onSeek}
            />
          </div>

          {/* Control Buttons Row */}
          <div className="flex items-center justify-between gap-3">
            {/* Left side: Play controls */}
            <div className="flex items-center gap-2">
              {/* Skip Back */}
              <button
                onClick={() => onSkip(-10)}
                className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                title="Skip back 10s"
              >
                <SkipBack size={ICON_SIZES.md} />
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                className="w-9 h-9 bg-white hover:bg-gray-100 text-gray-900 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105 active:scale-95"
              >
                {isPlaying ? <Pause size={ICON_SIZES.md} fill="currentColor" /> : <Play size={ICON_SIZES.md} fill="currentColor" className="ml-0.5" />}
              </button>

              {/* Skip Forward */}
              <button
                onClick={() => onSkip(10)}
                className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                title="Skip forward 10s"
              >
                <SkipForward size={ICON_SIZES.md} />
              </button>

              {/* Time Display */}
              <div className="ml-1 text-xs font-mono text-white font-medium">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Right side: Settings controls */}
            <div className="flex items-center gap-2">
              {/* Playback Speed */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-[12px] text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95 min-w-[45px]"
                >
                  {playbackRate}x
                </button>

                {showSpeedMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-gray-900 backdrop-blur-xl rounded-[12px] shadow-xl border border-gray-700 overflow-hidden transition-all">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => onSetSpeed(speed)}
                        className={`block w-full px-4 py-1.5 text-xs font-medium text-left transition-all ${
                          playbackRate === speed
                            ? 'bg-white/20 text-white font-semibold'
                            : 'text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Volume Controls */}
              <div
                className="relative flex items-center gap-2"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button
                  onClick={onToggleMute}
                  className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                >
                  {isMuted ? <VolumeX size={ICON_SIZES.md} /> : <Volume2 size={ICON_SIZES.md} />}
                </button>

                {/* Vertical Volume Slider */}
                <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${showVolumeSlider ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <div className="bg-gray-900 backdrop-blur-xl rounded-[12px] shadow-xl border border-gray-700 p-2.5">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                      className="h-20 w-1.5 appearance-none bg-gray-700 rounded-full cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                      style={{
                        background: `linear-gradient(to top, rgb(255 255 255) 0%, rgb(255 255 255) ${volume * 100}%, rgb(55 65 81) ${volume * 100}%, rgb(55 65 81) 100%)`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Fullscreen Toggle */}
              <button
                onClick={onToggleFullscreen}
                className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <Minimize size={ICON_SIZES.md} /> : <Maximize size={ICON_SIZES.md} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render screenshots-only mode with controls
  if (mediaMode === 'screenshots') {
    return (
      <div
        className="relative bg-gray-900 w-full max-h-[600px] xl:max-h-[700px] flex items-center justify-center"
        style={{ aspectRatio: '16/9' }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {screenshotUrl ? (
          <img
            src={screenshotUrl}
            alt="Session screenshot"
            className="max-w-full max-h-full object-contain transition-opacity duration-300"
          />
        ) : (
          <Camera size={ICON_SIZES['3xl']} className="text-gray-500" />
        )}

        {/* Center Play Button Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-opacity duration-300">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="w-20 h-20 bg-white hover:bg-gray-50 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 active:scale-95"
            >
              <Play size={ICON_SIZES['2xl']} className="text-gray-900 ml-1.5" fill="currentColor" />
            </button>
          </div>
        )}

        {/* Controls Overlay - Without Volume Controls */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/50 to-transparent px-4 pb-3 pt-6 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Timeline */}
          <div className="mb-2">
            <UnifiedTimeline
              currentTime={currentTime}
              duration={duration}
              screenshots={screenshots}
              audioSegments={audioSegments}
              keyMoments={keyMoments}
              session={session}
              onSeek={onSeek}
            />
          </div>

          {/* Control Buttons Row */}
          <div className="flex items-center justify-between gap-3">
            {/* Left side: Play controls */}
            <div className="flex items-center gap-2">
              {/* Skip Back */}
              <button
                onClick={() => onSkip(-10)}
                className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                title="Skip back 10s"
              >
                <SkipBack size={ICON_SIZES.md} />
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                className="w-9 h-9 bg-white hover:bg-gray-100 text-gray-900 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105 active:scale-95"
              >
                {isPlaying ? <Pause size={ICON_SIZES.md} fill="currentColor" /> : <Play size={ICON_SIZES.md} fill="currentColor" className="ml-0.5" />}
              </button>

              {/* Skip Forward */}
              <button
                onClick={() => onSkip(10)}
                className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                title="Skip forward 10s"
              >
                <SkipForward size={ICON_SIZES.md} />
              </button>

              {/* Time Display */}
              <div className="ml-1 text-xs font-mono text-white font-medium">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Right side: Settings controls */}
            <div className="flex items-center gap-2">
              {/* Playback Speed */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-[12px] text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95 min-w-[45px]"
                >
                  {playbackRate}x
                </button>

                {showSpeedMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-gray-900 backdrop-blur-xl rounded-[12px] shadow-xl border border-gray-700 overflow-hidden transition-all">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => onSetSpeed(speed)}
                        className={`block w-full px-4 py-1.5 text-xs font-medium text-left transition-all ${
                          playbackRate === speed
                            ? 'bg-white/20 text-white font-semibold'
                            : 'text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen Toggle */}
              <button
                onClick={onToggleFullscreen}
                className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <Minimize size={ICON_SIZES.md} /> : <Maximize size={ICON_SIZES.md} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render screenshots-audio mode with full controls
  if (mediaMode === 'screenshots-audio') {
    return (
      <div
        className="relative bg-gray-900 w-full max-h-[600px] xl:max-h-[700px] flex items-center justify-center"
        style={{ aspectRatio: '16/9' }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {screenshotUrl ? (
          <img
            src={screenshotUrl}
            alt="Session screenshot"
            className="max-w-full max-h-full object-contain transition-opacity duration-300"
          />
        ) : (
          <Camera size={ICON_SIZES['3xl']} className="text-gray-500" />
        )}

        {/* Hidden Audio Element */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            style={{ display: 'none' }}
          />
        )}

        {/* Center Play Button Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-opacity duration-300">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="w-20 h-20 bg-white hover:bg-gray-50 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 active:scale-95"
            >
              <Play size={ICON_SIZES['2xl']} className="text-gray-900 ml-1.5" fill="currentColor" />
            </button>
          </div>
        )}

        {/* Controls Overlay - With Volume Controls */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/50 to-transparent px-4 pb-3 pt-6 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Timeline */}
          <div className="mb-2">
            <UnifiedTimeline
              currentTime={currentTime}
              duration={duration}
              screenshots={screenshots}
              audioSegments={audioSegments}
              keyMoments={keyMoments}
              session={session}
              onSeek={onSeek}
            />
          </div>

          {/* Control Buttons Row */}
          <div className="flex items-center justify-between gap-3">
            {/* Left side: Play controls */}
            <div className="flex items-center gap-2">
              {/* Skip Back */}
              <button
                onClick={() => onSkip(-10)}
                className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                title="Skip back 10s"
              >
                <SkipBack size={ICON_SIZES.md} />
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                className="w-9 h-9 bg-white hover:bg-gray-100 text-gray-900 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105 active:scale-95"
              >
                {isPlaying ? <Pause size={ICON_SIZES.md} fill="currentColor" /> : <Play size={ICON_SIZES.md} fill="currentColor" className="ml-0.5" />}
              </button>

              {/* Skip Forward */}
              <button
                onClick={() => onSkip(10)}
                className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                title="Skip forward 10s"
              >
                <SkipForward size={ICON_SIZES.md} />
              </button>

              {/* Time Display */}
              <div className="ml-1 text-xs font-mono text-white font-medium">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Right side: Settings controls */}
            <div className="flex items-center gap-2">
              {/* Playback Speed */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-[12px] text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95 min-w-[45px]"
                >
                  {playbackRate}x
                </button>

                {showSpeedMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-gray-900 backdrop-blur-xl rounded-[12px] shadow-xl border border-gray-700 overflow-hidden transition-all">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => onSetSpeed(speed)}
                        className={`block w-full px-4 py-1.5 text-xs font-medium text-left transition-all ${
                          playbackRate === speed
                            ? 'bg-white/20 text-white font-semibold'
                            : 'text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Volume Controls */}
              <div
                className="relative flex items-center gap-2"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button
                  onClick={onToggleMute}
                  className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                >
                  {isMuted ? <VolumeX size={ICON_SIZES.md} /> : <Volume2 size={ICON_SIZES.md} />}
                </button>

                {/* Vertical Volume Slider */}
                <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${showVolumeSlider ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <div className="bg-gray-900 backdrop-blur-xl rounded-[12px] shadow-xl border border-gray-700 p-2.5">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                      className="h-20 w-1.5 appearance-none bg-gray-700 rounded-full cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                      style={{
                        background: `linear-gradient(to top, rgb(255 255 255) 0%, rgb(255 255 255) ${volume * 100}%, rgb(55 65 81) ${volume * 100}%, rgb(55 65 81) 100%)`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Fullscreen Toggle */}
              <button
                onClick={onToggleFullscreen}
                className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <Minimize size={ICON_SIZES.md} /> : <Maximize size={ICON_SIZES.md} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render audio-only mode with full controls
  if (mediaMode === 'audio') {
    return (
      <div
        className="relative bg-gradient-to-br from-cyan-50 to-blue-50 w-full h-[300px] flex items-center justify-center"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <audio ref={audioRef} src={audioUrl || undefined} />
        <div className="text-center">
          <MessageSquare size={ICON_SIZES['3xl']} className="mx-auto text-cyan-600 mb-4" />
          <h3 className="text-xl font-bold text-gray-900">Audio Only</h3>
          <p className="text-gray-600">See transcript panel for details</p>
        </div>

        {/* Center Play Button Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-opacity duration-300">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="w-20 h-20 bg-white hover:bg-gray-50 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 active:scale-95"
            >
              <Play size={ICON_SIZES['2xl']} className="text-gray-900 ml-1.5" fill="currentColor" />
            </button>
          </div>
        )}

        {/* Controls Overlay - With Volume Controls */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/40 to-transparent px-4 pb-3 pt-6 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Timeline */}
          <div className="mb-2">
            <UnifiedTimeline
              currentTime={currentTime}
              duration={duration}
              screenshots={screenshots}
              audioSegments={audioSegments}
              keyMoments={keyMoments}
              session={session}
              onSeek={onSeek}
            />
          </div>

          {/* Control Buttons Row */}
          <div className="flex items-center justify-between gap-3">
            {/* Left side: Play controls */}
            <div className="flex items-center gap-2">
              {/* Skip Back */}
              <button
                onClick={() => onSkip(-10)}
                className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                title="Skip back 10s"
              >
                <SkipBack size={ICON_SIZES.md} />
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                className="w-9 h-9 bg-white hover:bg-gray-100 text-gray-900 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105 active:scale-95"
              >
                {isPlaying ? <Pause size={ICON_SIZES.md} fill="currentColor" /> : <Play size={ICON_SIZES.md} fill="currentColor" className="ml-0.5" />}
              </button>

              {/* Skip Forward */}
              <button
                onClick={() => onSkip(10)}
                className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                title="Skip forward 10s"
              >
                <SkipForward size={ICON_SIZES.md} />
              </button>

              {/* Time Display */}
              <div className="ml-1 text-xs font-mono text-white font-medium">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Right side: Settings controls */}
            <div className="flex items-center gap-2">
              {/* Playback Speed */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-[12px] text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95 min-w-[45px]"
                >
                  {playbackRate}x
                </button>

                {showSpeedMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-gray-900 backdrop-blur-xl rounded-[12px] shadow-xl border border-gray-700 overflow-hidden transition-all">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => onSetSpeed(speed)}
                        className={`block w-full px-4 py-1.5 text-xs font-medium text-left transition-all ${
                          playbackRate === speed
                            ? 'bg-white/20 text-white font-semibold'
                            : 'text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Volume Controls */}
              <div
                className="relative flex items-center gap-2"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button
                  onClick={onToggleMute}
                  className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                >
                  {isMuted ? <VolumeX size={ICON_SIZES.md} /> : <Volume2 size={ICON_SIZES.md} />}
                </button>

                {/* Vertical Volume Slider */}
                <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${showVolumeSlider ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <div className="bg-gray-900 backdrop-blur-xl rounded-[12px] shadow-xl border border-gray-700 p-2.5">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                      className="h-20 w-1.5 appearance-none bg-gray-700 rounded-full cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                      style={{
                        background: `linear-gradient(to top, rgb(255 255 255) 0%, rgb(255 255 255) ${volume * 100}%, rgb(55 65 81) ${volume * 100}%, rgb(55 65 81) 100%)`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Fullscreen Toggle */}
              <button
                onClick={onToggleFullscreen}
                className="p-1.5 hover:bg-white/20 rounded-[12px] transition-all hover:scale-105 active:scale-95 text-white"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <Minimize size={ICON_SIZES.md} /> : <Maximize size={ICON_SIZES.md} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================================
// Transcript Panel Component
// ============================================================================

interface TranscriptPanelProps {
  audioSegments: SessionAudioSegment[];
  currentTime: number;
  session: Session;
  onSeek: (time: number) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

const TranscriptPanel = forwardRef<HTMLDivElement, TranscriptPanelProps>(
  ({ audioSegments, currentTime, session, onSeek, isExpanded, onToggleExpanded }, ref) => {
    return (
      <div className="bg-gray-50 h-full xl:flex xl:flex-col xl:h-[700px]">
        {/* Header with collapse/expand button */}
        <div className="flex items-center justify-between p-4 sticky top-0 bg-white border-b border-gray-200 z-10 xl:flex-shrink-0">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare size={ICON_SIZES.md} className="text-cyan-600" />
            Transcript
            <span className="text-sm font-normal text-gray-600">({audioSegments.length})</span>
          </h3>
          <button
            onClick={onToggleExpanded}
            className="p-2 hover:bg-gray-100 rounded-[16px] transition-all hover:scale-105 active:scale-95 text-gray-700 xl:hidden"
            title={isExpanded ? 'Collapse transcript' : 'Expand transcript'}
          >
            {isExpanded ? <ChevronUp size={ICON_SIZES.md} /> : <ChevronDown size={ICON_SIZES.md} />}
          </button>
        </div>

        {/* Transcript content - collapsible on small screens, always visible on xl screens */}
        <div
          ref={ref}
          className={`overflow-y-auto transition-all duration-300 xl:flex-1 ${isExpanded ? 'max-h-[400px] xl:max-h-none' : 'max-h-0 overflow-hidden'}`}
        >
          <div className="p-5 space-y-2">
            {audioSegments.map((segment, index) => {
              const segmentTime = (new Date(segment.timestamp).getTime() - new Date(session.startTime).getTime()) / 1000;
              const nextSegment = audioSegments[index + 1];
              const nextTime = nextSegment
                ? (new Date(nextSegment.timestamp).getTime() - new Date(session.startTime).getTime()) / 1000
                : Infinity;

              const isActive = currentTime >= segmentTime && currentTime < nextTime;

              return (
                <button
                  key={segment.id}
                  id={`segment-${segment.id}`}
                  onClick={() => onSeek(segmentTime)}
                  className={`w-full text-left p-3 rounded-[16px] transition-all ${
                    isActive
                      ? 'bg-cyan-50 border-2 border-cyan-500 shadow-sm scale-[1.01]'
                      : 'bg-white hover:bg-gray-50 border-2 border-transparent hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-cyan-600 font-semibold">
                      {formatTimeSimple(segmentTime)}
                    </span>
                    {isActive && (
                      <span className="text-xs font-bold text-cyan-600 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></span>
                        Playing
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed">{segment.transcription}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

TranscriptPanel.displayName = 'TranscriptPanel';

// ============================================================================
// Timeline Tooltip Component
// ============================================================================

interface TimelineTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  content: React.ReactNode;
}

function TimelineTooltip({ visible, x, y, content }: TimelineTooltipProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed z-50 pointer-events-none transition-all duration-200"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="mb-2 bg-gray-900 text-white px-3 py-2 rounded-[12px] shadow-xl border border-gray-700 max-w-xs">
        {content}
      </div>
    </div>
  );
}

// ============================================================================
// Unified Timeline Component - Compact for Overlay
// ============================================================================

interface UnifiedTimelineProps {
  currentTime: number;
  duration: number;
  screenshots: SessionScreenshot[];
  audioSegments: SessionAudioSegment[];
  keyMoments: AudioKeyMoment[];
  session: Session;
  onSeek: (time: number) => void;
}

function UnifiedTimeline({
  currentTime,
  duration,
  screenshots,
  audioSegments,
  keyMoments,
  session,
  onSeek,
}: UnifiedTimelineProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredScreenshot, setHoveredScreenshot] = useState<SessionScreenshot | null>(null);
  const [hoveredMoment, setHoveredMoment] = useState<AudioKeyMoment | null>(null);
  const [screenshotThumbnails, setScreenshotThumbnails] = useState<Map<string, string>>(new Map());

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  // Load screenshot thumbnail on hover
  useEffect(() => {
    if (!hoveredScreenshot) return;

    const loadThumbnail = async () => {
      if (screenshotThumbnails.has(hoveredScreenshot.id)) return;

      try {
        const attachment = await attachmentStorage.getAttachment(hoveredScreenshot.attachmentId);
        if (attachment?.path) {
          const url = convertFileSrc(attachment.path);
          setScreenshotThumbnails((prev) => new Map(prev).set(hoveredScreenshot.id, url));
        }
      } catch (err) {
        console.error('[TIMELINE] Failed to load screenshot thumbnail:', err);
      }
    };

    loadThumbnail();
  }, [hoveredScreenshot, screenshotThumbnails]);

  const getTimeFromMouseEvent = (e: React.MouseEvent<HTMLDivElement> | MouseEvent): number => {
    const slider = sliderRef.current;
    if (!slider || duration === 0) return 0;

    const rect = slider.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    return percent * duration;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    const time = getTimeFromMouseEvent(e);
    onSeek(time);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const slider = sliderRef.current;
    if (!slider) return;

    const rect = slider.getBoundingClientRect();
    const time = getTimeFromMouseEvent(e);

    setPreviewTime(time);
    setHoverPosition({
      x: e.clientX,
      y: rect.top,
    });

    if (isDragging) {
      onSeek(time);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setPreviewTime(null);
    setHoverPosition(null);
    setHoveredScreenshot(null);
    setHoveredMoment(null);
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  const getMomentColor = (type: string) => {
    switch (type) {
      case 'achievement':
        return 'bg-green-500';
      case 'blocker':
        return 'bg-red-500';
      case 'decision':
        return 'bg-purple-500';
      case 'insight':
        return 'bg-blue-500';
      default:
        return 'bg-amber-500';
    }
  };

  const getMomentColorBorder = (type: string) => {
    switch (type) {
      case 'achievement':
        return 'border-green-500';
      case 'blocker':
        return 'border-red-500';
      case 'decision':
        return 'border-purple-500';
      case 'insight':
        return 'border-blue-500';
      default:
        return 'border-amber-500';
    }
  };

  const getMomentTypeLabel = (type: string) => {
    switch (type) {
      case 'achievement':
        return 'Achievement';
      case 'blocker':
        return 'Blocker';
      case 'decision':
        return 'Decision';
      case 'insight':
        return 'Insight';
      default:
        return type;
    }
  };

  return (
    <div className="relative">
      {/* Clean Slider Track - Compact for overlay */}
      <div
        ref={sliderRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative h-1 bg-white/30 rounded-full cursor-pointer hover:h-1.5 transition-all duration-200 group"
      >
        {/* Progress Fill */}
        <div
          className="absolute inset-y-0 left-0 bg-white rounded-full pointer-events-none will-change-[width] transition-all duration-100"
          style={{
            width: `${progressPercent}%`,
          }}
        />

        {/* Preview Line */}
        {previewTime !== null && !isDragging && (
          <div
            className="absolute inset-y-0 w-0.5 bg-white/60 pointer-events-none z-10"
            style={{ left: `${(previewTime / duration) * 100}%` }}
          />
        )}

        {/* Screenshot Markers */}
        {screenshots.map((screenshot) => {
          const sessionStart = new Date(session.startTime).getTime();
          const screenshotTime = (new Date(screenshot.timestamp).getTime() - sessionStart) / 1000;
          const position = (screenshotTime / duration) * 100;

          if (position < 0 || position > 100) return null;

          const isHovered = hoveredScreenshot?.id === screenshot.id;

          return (
            <div
              key={screenshot.id}
              className={`absolute top-1/2 bg-blue-400 rounded-full shadow-sm cursor-pointer transition-all duration-200 z-10 ${
                isHovered ? 'w-2.5 h-2.5 scale-110' : 'w-1.5 h-1.5'
              }`}
              style={{ left: `${position}%`, transform: 'translate(-50%, -50%)' }}
              onMouseEnter={(e) => {
                setHoveredScreenshot(screenshot);
                setHoverPosition({ x: e.clientX, y: e.currentTarget.getBoundingClientRect().top });
              }}
              onMouseLeave={() => setHoveredScreenshot(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(screenshotTime);
              }}
            />
          );
        })}

        {/* Key Moment Markers */}
        {keyMoments.map((moment) => {
          const position = (moment.timestamp / duration) * 100;
          const colorClass = getMomentColor(moment.type);
          const isHovered = hoveredMoment?.id === moment.id;

          return (
            <div
              key={moment.id}
              className={`absolute top-1/2 ${colorClass} rounded-full shadow-sm cursor-pointer transition-all duration-200 z-10 ${
                isHovered ? 'w-2.5 h-2.5 scale-110' : 'w-1.5 h-1.5'
              }`}
              style={{ left: `${position}%`, transform: 'translate(-50%, -50%)' }}
              onMouseEnter={(e) => {
                setHoveredMoment(moment);
                setHoverPosition({ x: e.clientX, y: e.currentTarget.getBoundingClientRect().top });
              }}
              onMouseLeave={() => setHoveredMoment(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(moment.timestamp);
              }}
            />
          );
        })}

        {/* Playhead */}
        <div
          className="absolute w-3 h-3 bg-white rounded-full shadow-md pointer-events-none z-20 will-change-[left] group-hover:scale-110 transition-all duration-200"
          style={{
            left: `${progressPercent}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* Tooltips */}
      {hoveredScreenshot && hoverPosition && (
        <TimelineTooltip
          visible={true}
          x={hoverPosition.x}
          y={hoverPosition.y}
          content={
            <div className="space-y-2">
              <div className="text-xs font-mono text-cyan-400">
                {formatTimeSimple(
                  (new Date(hoveredScreenshot.timestamp).getTime() - new Date(session.startTime).getTime()) / 1000
                )}
              </div>
              {screenshotThumbnails.has(hoveredScreenshot.id) && (
                <img
                  src={screenshotThumbnails.get(hoveredScreenshot.id)}
                  alt="Screenshot preview"
                  className="w-48 h-auto rounded-lg border border-gray-700"
                />
              )}
              {hoveredScreenshot.aiAnalysis?.summary && (
                <div className="text-xs text-gray-300 max-w-48">
                  {hoveredScreenshot.aiAnalysis.summary}
                </div>
              )}
              <div className="text-xs text-gray-400">Click to seek</div>
            </div>
          }
        />
      )}

      {hoveredMoment && hoverPosition && (
        <TimelineTooltip
          visible={true}
          x={hoverPosition.x}
          y={hoverPosition.y}
          content={
            <div className="space-y-1">
              <div className="text-xs font-mono text-cyan-400">
                {formatTimeSimple(hoveredMoment.timestamp)}
              </div>
              <div className={`text-xs font-semibold px-2 py-0.5 rounded border ${getMomentColorBorder(hoveredMoment.type)} inline-block`}>
                {getMomentTypeLabel(hoveredMoment.type)}
              </div>
              <div className="text-sm font-semibold">{hoveredMoment.label}</div>
              {hoveredMoment.excerpt && (
                <div className="text-xs text-gray-300 max-w-48 mt-1">
                  {hoveredMoment.excerpt}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">Click to seek</div>
            </div>
          }
        />
      )}

      {previewTime !== null && !hoveredScreenshot && !hoveredMoment && hoverPosition && (
        <TimelineTooltip
          visible={true}
          x={hoverPosition.x}
          y={hoverPosition.y}
          content={
            <div className="text-xs font-mono">
              {formatTimeSimple(previewTime)}
            </div>
          }
        />
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeSimple(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
