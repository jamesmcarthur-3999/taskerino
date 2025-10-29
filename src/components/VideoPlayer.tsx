/**
 * VideoPlayer Component
 *
 * Displays recorded session video with playback controls.
 * Uses HTML5 video element with Tauri's convertFileSrc for local file access.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, Camera } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Session, Attachment, SessionScreenshot, VideoChapter } from '../types';
import { videoStorageService } from '../services/videoStorageService';
import { getCAStorage } from '../services/storage/ContentAddressableStorage';
import { getGlassClasses, RADIUS, SCALE, TRANSITIONS, SHADOWS } from '../design-system/theme';

interface VideoPlayerProps {
  session: Session;
  screenshots?: SessionScreenshot[];
  onTimeUpdate?: (time: number) => void;
  onScreenshotClick?: (screenshot: SessionScreenshot) => void;
  muteByDefault?: boolean; // Mute video audio when used alongside audio player
  externalPlayPauseControl?: boolean; // If true, don't auto-play on user interaction
}

export type VideoPlayerRef = {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  isPlaying: () => boolean;
};

interface ChapterChipProps {
  chapter: VideoChapter;
  isActive: boolean;
  onClick: () => void;
}

function ChapterChip({ chapter, isActive, onClick }: ChapterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium ${TRANSITIONS.standard} ${
        isActive
          ? `bg-gradient-to-r from-cyan-500 to-blue-500 text-white ${SHADOWS.button}`
          : `${getGlassClasses('medium')} text-gray-700 hover:bg-white/80`
      }`}
    >
      {chapter.title}
    </button>
  );
}

export const VideoPlayer = React.forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ session, screenshots = [], onTimeUpdate, onScreenshotClick, muteByDefault = false, externalPlayPauseControl = false }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muteByDefault);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Expose ref methods for external control
  React.useImperativeHandle(ref, () => ({
    play: () => {
      if (videoRef.current && !isPlaying) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    },
    pause: () => {
      if (videoRef.current && isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    },
    seekTo: (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
    },
    getCurrentTime: () => {
      return videoRef.current?.currentTime || 0;
    },
    isPlaying: () => {
      return isPlaying;
    },
  }), [isPlaying]);

  // Load video URL
  useEffect(() => {
    console.log('🎥 [VIDEO PLAYER] useEffect triggered', {
      hasVideo: !!session.video,
      fullVideoAttachmentId: session.video?.fullVideoAttachmentId,
    });

    const loadVideo = async () => {
      if (!session.video?.fullVideoAttachmentId) {
        setError('No video attachment found');
        setIsLoading(false);
        return;
      }

      try {
        console.log('🎥 [VIDEO PLAYER] Loading video from file system');

        // Videos are stored on file system (NOT in CAS - too large)
        // Primary: Use direct file path (current architecture)
        // Fallback: Try CAS for legacy videos (backwards compatibility)

        let videoPath: string | null = null;

        // Try direct file path first (modern videos)
        if (session.video.path) {
          console.log('🎥 [VIDEO PLAYER] Using direct file path:', session.video.path);
          videoPath = session.video.path;
        }
        // Fallback: Try CAS for legacy videos
        else if (session.video.hash) {
          console.log('🎥 [VIDEO PLAYER] Fallback: Trying CAS lookup for legacy video');
          try {
            const caStorage = await getCAStorage();
            const attachment = await caStorage.loadAttachment(session.video.hash);

            if (attachment?.path) {
              console.log('🎥 [VIDEO PLAYER] Legacy video found in CAS');
              videoPath = attachment.path;
            }
          } catch (casError) {
            console.warn('⚠️ [VIDEO PLAYER] CAS lookup failed:', casError);
          }
        }

        if (!videoPath) {
          const errorMsg = `Video file path not found.\n\nThis session's video may have been recorded with an older version or the file may have been deleted.\n\nSession ID: ${session.id}`;
          console.error('❌ [VIDEO PLAYER]', errorMsg);
          setError(errorMsg);
          setIsLoading(false);
          return;
        }

        // CRITICAL: Detect path corruption bug (attachment ID stored as path)
        if (videoPath.startsWith('video-') && !videoPath.includes('/')) {
          const errorMsg = `VIDEO PATH CORRUPTION DETECTED!\n\nThe video path contains an attachment ID instead of a file path.\n\nCorrupted path: ${videoPath}\n\nThis is a known bug. Please restart the app to trigger automatic repair.`;
          console.error('❌ [VIDEO PLAYER] CRITICAL BUG:', errorMsg);
          console.error('❌ [VIDEO PLAYER] Corrupted path:', videoPath);
          setError(errorMsg);
          setIsLoading(false);
          return;
        }

        // Convert file path to Tauri asset URL
        const url = convertFileSrc(videoPath);

        if (!url) {
          const errorMsg = `Failed to convert file path to playable URL.\n\nFile path: ${videoPath}\n\nThis may indicate:\n- File permissions issue\n- Invalid file path format\n- Tauri asset protocol configuration problem`;
          console.error('❌ [VIDEO PLAYER]', errorMsg);
          setError(errorMsg);
          setIsLoading(false);
          return;
        }

        console.log('✅ [VIDEO PLAYER] Video URL loaded successfully');
        console.log('📍 [VIDEO PLAYER] File path:', videoPath);
        console.log('🔗 [VIDEO PLAYER] Asset URL:', url);

        setVideoUrl(url);
        setIsLoading(false);
      } catch (err) {
        console.error('❌ [VIDEO PLAYER] Failed to load video:', err);
        console.error('❌ [VIDEO PLAYER] Error stack:', err instanceof Error ? err.stack : 'No stack');
        console.error('❌ [VIDEO PLAYER] Session:', session);
        console.error('❌ [VIDEO PLAYER] Video attachment ID:', session.video?.fullVideoAttachmentId);

        const errorMsg = err instanceof Error
          ? `Error loading video: ${err.message}\n\nSee console for details.`
          : 'Failed to load video due to unknown error';
        setError(errorMsg);
        setIsLoading(false);
      }
    };

    loadVideo();
  }, [session.video?.fullVideoAttachmentId]);

  // Apply mute state when video loads
  useEffect(() => {
    if (videoRef.current && muteByDefault) {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  }, [videoUrl, muteByDefault]);

  // Handle video metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      console.log('✅ [VIDEO PLAYER] Video metadata loaded, duration:', videoRef.current.duration);
    }
  };

  // Handle time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  };

  // Play/pause toggle
  const togglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Seek to specific time (from timeline scrubber)
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Seek to specific time (programmatic)
  const seekToTime = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  // Change volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  // Enter fullscreen
  const enterFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  // Restart video
  const restartVideo = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-gradient-to-br from-purple-500/20 via-blue-500/20 to-cyan-500/20 ${getGlassClasses('strong')} rounded-[${RADIUS.card}px] p-12 text-center`}>
        <div className={`inline-flex items-center gap-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-4 rounded-[${RADIUS.field}px] ${SHADOWS.elevated}`}>
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div className="text-left">
            <div className="font-semibold">Getting your video ready...</div>
            <div className="text-sm text-white/90">Loading session recording</div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !videoUrl) {
    return (
      <div className={`${getGlassClasses('medium')} rounded-[${RADIUS.card}px] p-12`}>
        <div className="text-red-600 mb-4 text-center">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-bold text-gray-900 mb-4">Video Unavailable</h3>
          <div className="max-w-2xl mx-auto text-left bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
              {error || 'Video file could not be loaded'}
            </pre>
          </div>
          {error?.includes('restart the app') && (
            <div className="mt-4 text-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 font-medium"
              >
                Restart App Now
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${getGlassClasses('medium')} rounded-[${RADIUS.card}px] overflow-hidden ${SHADOWS.elevated}`}>
      {/* Video Container */}
      <div className="relative bg-black aspect-video">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => {
            const target = e.currentTarget;
            const mediaError = target.error;

            // Map MediaError codes to user-friendly messages
            let errorMessage = 'Unknown playback error';
            let technicalDetails = '';

            if (mediaError) {
              switch (mediaError.code) {
                case 1: // MEDIA_ERR_ABORTED
                  errorMessage = 'Video loading was aborted';
                  technicalDetails = 'The video download was stopped before completion';
                  break;
                case 2: // MEDIA_ERR_NETWORK
                  errorMessage = 'Network error while loading video';
                  technicalDetails = 'Failed to download the video file from storage';
                  break;
                case 3: // MEDIA_ERR_DECODE
                  errorMessage = 'Video decoding failed';
                  technicalDetails = 'The video file may be corrupted or in an unsupported format';
                  break;
                case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                  errorMessage = 'Video source not found or format not supported';
                  technicalDetails = 'The video file could not be found at the specified path, or the browser cannot play this video format';
                  break;
                default:
                  errorMessage = mediaError.message || 'Unknown playback error';
                  technicalDetails = `MediaError code: ${mediaError.code}`;
              }
            }

            console.error('❌ [VIDEO PLAYER] Video element error:', {
              error: mediaError,
              code: mediaError?.code,
              message: mediaError?.message,
              src: videoUrl,
              errorMessage,
              technicalDetails
            });

            setError(`${errorMessage}\n\n${technicalDetails}\n\nVideo URL: ${videoUrl}`);
          }}
        />

        {/* Play Overlay (shown when paused) */}
        {!isPlaying && (
          <div className={`absolute inset-0 flex items-center justify-center ${getGlassClasses('subtle')}`}>
            <button
              onClick={togglePlayPause}
              className={`w-20 h-20 bg-white/90 hover:bg-white rounded-full flex items-center justify-center ${SHADOWS.modal} ${TRANSITIONS.standard} ${SCALE.iconButtonHover} ${SCALE.iconButtonActive}`}
            >
              <Play size={40} className="text-gray-900 ml-1" />
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={`p-4 ${getGlassClasses('medium')}`}>
        {/* Timeline Scrubber */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, rgb(34, 197, 94) 0%, rgb(34, 197, 94) ${(currentTime / duration) * 100}%, rgb(229, 231, 235) ${(currentTime / duration) * 100}%, rgb(229, 231, 235) 100%)`
              }}
            />

            {/* Screenshot Markers */}
            {screenshots.length > 0 && duration > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {screenshots.map((screenshot) => {
                  const sessionStart = new Date(session.startTime).getTime();
                  const screenshotTime = new Date(screenshot.timestamp).getTime();
                  const relativeTime = (screenshotTime - sessionStart) / 1000; // seconds
                  const position = (relativeTime / duration) * 100;

                  if (position < 0 || position > 100) return null;

                  return (
                    <button
                      key={screenshot.id}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md hover:scale-150 transition-transform pointer-events-auto cursor-pointer z-10"
                      style={{ left: `${position}%` }}
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = relativeTime;
                          setCurrentTime(relativeTime);
                        }
                        onScreenshotClick?.(screenshot);
                      }}
                      title={`Screenshot at ${formatTime(relativeTime)}`}
                    >
                      <Camera size={8} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>{formatTime(currentTime)}</span>
            {screenshots.length > 0 && (
              <span className="text-blue-600 flex items-center gap-1">
                <Camera size={12} />
                {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''}
              </span>
            )}
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className={`w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full flex items-center justify-center ${SHADOWS.button} ${TRANSITIONS.standard} ${SCALE.buttonHover} ${SCALE.buttonActive}`}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>

            {/* Restart */}
            <button
              onClick={restartVideo}
              className={`w-10 h-10 ${getGlassClasses('strong')} rounded-full flex items-center justify-center ${SHADOWS.button} ${TRANSITIONS.standard} ${SCALE.buttonHover} ${SCALE.buttonActive}`}
              title="Restart"
            >
              <RotateCcw size={18} className="text-gray-700" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className={`w-10 h-10 ${getGlassClasses('strong')} rounded-full flex items-center justify-center ${SHADOWS.button} ${TRANSITIONS.standard} ${SCALE.buttonHover} ${SCALE.buttonActive}`}
              >
                {isMuted ? <VolumeX size={18} className="text-gray-700" /> : <Volume2 size={18} className="text-gray-700" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Fullscreen */}
          <button
            onClick={enterFullscreen}
            className={`w-10 h-10 ${getGlassClasses('strong')} rounded-full flex items-center justify-center ${SHADOWS.button} ${TRANSITIONS.standard} ${SCALE.buttonHover} ${SCALE.buttonActive}`}
            title="Fullscreen"
          >
            <Maximize size={18} className="text-gray-700" />
          </button>
        </div>

        {/* Chapter Navigation */}
        {session.video?.chapters && session.video.chapters.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-gray-500 mb-2">
              {session.video.chapters.length} {session.video.chapters.length === 1 ? 'chapter' : 'chapters'}
            </div>
            <div className="flex flex-wrap gap-2">
              {session.video.chapters.map(chapter => {
                const isActive =
                  currentTime >= chapter.startTime &&
                  currentTime < chapter.endTime;

                return (
                  <ChapterChip
                    key={chapter.id}
                    chapter={chapter}
                    isActive={isActive}
                    onClick={() => seekToTime(chapter.startTime)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
