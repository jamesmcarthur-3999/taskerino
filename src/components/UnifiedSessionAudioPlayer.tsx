/**
 * Unified Session Audio Player - Simplified HTML5 Audio Version
 *
 * Uses pre-concatenated audio file for simple, reliable playback
 * - Single audio file generated on load
 * - Standard HTML5 audio element
 * - Timeline mapping for transcript sync
 * - Variable playback speed
 * - Smooth scrubbing
 */

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Search, Camera, Mic, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Session, SessionAudioSegment, SessionScreenshot, AudioKeyMoment } from '../types';
import { audioConcatenationService } from '../services/audioConcatenationService';
import { getGlassClasses, getRadiusClass } from '../design-system/theme';

interface UnifiedSessionAudioPlayerProps {
  session: Session;
  audioSegments: SessionAudioSegment[];
  screenshots: SessionScreenshot[];
  keyMoments?: AudioKeyMoment[];
  onSeekToTime?: (sessionTime: number) => void;
  onScreenshotClick?: (screenshot: SessionScreenshot) => void;
  onTimeUpdate?: (currentTime: number) => void;
}

export type UnifiedSessionAudioPlayerRef = {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
};

export const UnifiedSessionAudioPlayer = forwardRef<UnifiedSessionAudioPlayerRef, UnifiedSessionAudioPlayerProps>(({
  session,
  audioSegments,
  screenshots,
  keyMoments = [],
  onSeekToTime,
  onScreenshotClick,
  onTimeUpdate,
}, ref) => {
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ segmentId: string; time: number; excerpt: string }>>([]);

  // Tooltip state
  const [hoveredMoment, setHoveredMoment] = useState<{ moment: AudioKeyMoment; x: number; y: number } | null>(null);

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  /**
   * Generate concatenated audio file on mount (with caching)
   */
  useEffect(() => {
    let isMounted = true;

    const generateAudio = async () => {
      if (audioSegments.length === 0) return;

      setLoading(true);

      try {
        // Build timeline for time mapping (always needed for search/navigation)
        audioConcatenationService.buildTimeline(audioSegments);
        const totalDuration = audioConcatenationService.getTotalDuration();

        // Check if we have a cached URL first
        let url = audioConcatenationService.getCachedWAVUrl(session.id);

        if (url) {
          // Use cached audio URL
          console.log(`✅ [AUDIO PLAYER] Using cached audio for session ${session.id}`);
        } else {
          // Generate concatenated WAV file with caching
          console.log(`🎵 [AUDIO PLAYER] Generating concatenated audio from ${audioSegments.length} segments...`);
          const wavBlob = await audioConcatenationService.exportAsWAV(audioSegments, {}, session.id);
          url = URL.createObjectURL(wavBlob);
          console.log(`✅ [AUDIO PLAYER] Audio ready: ${totalDuration.toFixed(1)}s, ${(wavBlob.size / 1024 / 1024).toFixed(1)}MB`);
        }

        if (isMounted) {
          setAudioUrl(url);
          setDuration(totalDuration);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ [AUDIO PLAYER] Failed to generate audio:', error);
        setLoading(false);
      }
    };

    generateAudio();

    return () => {
      isMounted = false;
      // Note: We don't clear the cache here anymore - it's managed globally
      // This allows the cache to persist across component mounts/unmounts
    };
  }, [session.id, audioSegments]);

  /**
   * Sync current time from audio element
   */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      if (onTimeUpdate) {
        onTimeUpdate(time);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleLoadedMetadata = () => {
      console.log(`🎵 [AUDIO PLAYER] Audio loaded, duration: ${audio.duration.toFixed(1)}s`);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [audioUrl, onTimeUpdate]);

  /**
   * Toggle play/pause
   */
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  /**
   * Seek to specific time
   */
  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = Math.max(0, Math.min(duration, time));
    audio.currentTime = newTime;
    setCurrentTime(newTime);

    if (onSeekToTime) {
      onSeekToTime(newTime);
    }
  }, [duration, onSeekToTime]);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    seekTo,
    getCurrentTime: () => currentTime,
  }), [seekTo, currentTime]);

  /**
   * Skip forward/backward
   */
  const skip = (seconds: number) => {
    seekTo(currentTime + seconds);
  };

  /**
   * Jump to next/previous key moment
   */
  const jumpToNextMoment = () => {
    const sortedMoments = [...keyMoments].sort((a, b) => a.timestamp - b.timestamp);
    const nextMoment = sortedMoments.find(m => m.timestamp > currentTime);
    if (nextMoment) seekTo(nextMoment.timestamp);
  };

  const jumpToPrevMoment = () => {
    const sortedMoments = [...keyMoments].sort((a, b) => b.timestamp - a.timestamp);
    const prevMoment = sortedMoments.find(m => m.timestamp < currentTime - 0.5);
    if (prevMoment) seekTo(prevMoment.timestamp);
  };

  /**
   * Change playback speed
   */
  const cyclePlaybackSpeed = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];

    setPlaybackRate(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  /**
   * Handle volume change
   */
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  /**
   * Get color for key moment type
   */
  const getMomentColor = (type: string) => {
    switch (type) {
      case 'achievement':
        return { bg: 'bg-green-500', text: 'text-green-600' };
      case 'blocker':
        return { bg: 'bg-red-500', text: 'text-red-600' };
      case 'decision':
        return { bg: 'bg-purple-500', text: 'text-purple-600' };
      case 'insight':
        return { bg: 'bg-blue-500', text: 'text-blue-600' };
      default:
        return { bg: 'bg-amber-500', text: 'text-amber-600' };
    }
  };

  /**
   * Handle slider click for scrubbing
   */
  const handleSliderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const slider = sliderRef.current;
    if (!slider || duration === 0) return;

    const rect = slider.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percent * duration;

    seekTo(newTime);
  };

  /**
   * Handle slider mouse move for tooltips
   */
  const handleSliderMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const slider = sliderRef.current;
    if (!slider || duration === 0) return;

    const rect = slider.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const hoverRadius = 12;
    for (const moment of keyMoments) {
      const markerX = (moment.timestamp / duration) * rect.width;
      const distance = Math.abs(x - markerX);

      if (distance <= hoverRadius) {
        setHoveredMoment({ moment, x: e.clientX, y: e.clientY });
        return;
      }
    }

    setHoveredMoment(null);
  };

  const handleSliderMouseLeave = () => {
    setHoveredMoment(null);
  };

  /**
   * Search transcriptions
   */
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const results: Array<{ segmentId: string; time: number; excerpt: string }> = [];
    const query = searchQuery.toLowerCase();

    audioSegments.forEach(segment => {
      if (segment.transcription.toLowerCase().includes(query)) {
        const sessionTime = audioConcatenationService.segmentTimeToSessionTime(segment.id, 0);
        results.push({
          segmentId: segment.id,
          time: sessionTime,
          excerpt: segment.transcription.substring(0, 100),
        });
      }
    });

    setSearchResults(results);
  };

  /**
   * Format time
   */
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (audioSegments.length === 0) {
    return (
      <div className={`${getGlassClasses('subtle')} ${getRadiusClass('element')} p-12 text-center`}>
        <Mic size={64} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Audio Recorded</h3>
        <p className="text-gray-600">This session has no audio segments</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${getGlassClasses('subtle')} ${getRadiusClass('element')} p-12 text-center`}>
        <Mic size={64} className="mx-auto text-cyan-500 mb-4 animate-pulse" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Preparing Audio...</h3>
        <p className="text-gray-600">Concatenating {audioSegments.length} segments</p>
      </div>
    );
  }

  return (
    <div className={`${getGlassClasses('subtle')} ${getRadiusClass('element')} p-6 shadow-xl`}>
      {/* Hidden HTML5 Audio Element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Mic className="w-5 h-5 text-cyan-600" />
            Full Session Audio
          </h3>
          <p className="text-sm text-gray-600">
            {audioSegments.length} segments • {formatTime(duration)}
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-gray-600">
            <Camera size={16} />
            <span>{screenshots.length} screenshots</span>
          </div>
          {keyMoments.length > 0 && (
            <div className="flex items-center gap-1 text-gray-600">
              <MessageSquare size={16} />
              <span>{keyMoments.length} key moments</span>
            </div>
          )}
        </div>
      </div>

      {/* Glassy Scrubbing Slider */}
      <div className="relative mb-4 px-1">
        {/* Key Moment Markers Row */}
        <div className="relative h-6 mb-1">
          {keyMoments.map((moment) => {
            const position = (moment.timestamp / duration) * 100;
            const colors = getMomentColor(moment.type);

            return (
              <div
                key={moment.id}
                className="absolute top-0"
                style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
              >
                <div className={`w-2 h-2 rounded-full ${colors.bg} shadow-md`} />
              </div>
            );
          })}
        </div>

        {/* Slider Track */}
        <div
          ref={sliderRef}
          onClick={handleSliderClick}
          onMouseMove={handleSliderMouseMove}
          onMouseLeave={handleSliderMouseLeave}
          className={`relative h-4 ${getGlassClasses('subtle')} ${getRadiusClass('pill')} shadow-inner cursor-pointer group hover:bg-white/50 transition-colors`}
        >
          {/* Progress Fill */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full pointer-events-none"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />

          {/* Screenshot Markers */}
          {screenshots.map((screenshot, index) => {
            const screenshotTime = (new Date(screenshot.timestamp).getTime() - new Date(session.startTime).getTime()) / 1000;
            const position = (screenshotTime / duration) * 100;

            return (
              <div
                key={screenshot.id || index}
                className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full shadow-sm pointer-events-none z-10"
                style={{ left: `${position}%`, transform: 'translate(-50%, -50%)' }}
              />
            );
          })}

          {/* Playhead */}
          <div
            className={`absolute w-6 h-6 ${getGlassClasses('strong')} ${getRadiusClass('pill')} shadow-2xl border-2 transition-opacity pointer-events-none z-20 ${
              isPlaying
                ? 'opacity-100 border-cyan-500'
                : 'opacity-0 group-hover:opacity-100 border-cyan-400'
            }`}
            style={{
              left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              top: '50%',
              transform: `translate(-50%, -50%) ${isPlaying ? 'scale(1)' : 'scale(0.9)'}`
            }}
          >
            {isPlaying && (
              <div className="absolute inset-0 bg-cyan-400/30 rounded-full animate-pulse" />
            )}
          </div>
        </div>

        {/* Tooltip */}
        {hoveredMoment && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: `${hoveredMoment.x + 12}px`,
              top: `${hoveredMoment.y - 10}px`,
            }}
          >
            <div className={`bg-gray-900 text-white px-3 py-2 ${getRadiusClass('element')} shadow-xl max-w-xs`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded">
                  {formatTime(hoveredMoment.moment.timestamp)}
                </span>
                <span className="text-xs font-semibold capitalize">{hoveredMoment.moment.type}</span>
              </div>
              <p className="text-sm font-semibold">{hoveredMoment.moment.label}</p>
              {hoveredMoment.moment.excerpt && (
                <p className="text-xs text-gray-300 mt-1 line-clamp-2">"{hoveredMoment.moment.excerpt}"</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => skip(-10)} className={`p-2 hover:bg-gray-200/50 ${getRadiusClass('element')} transition-colors`} title="Skip back 10s">
          <SkipBack size={20} />
        </button>

        <button
          onClick={togglePlayPause}
          className="p-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-full transition-all shadow-lg"
        >
          {isPlaying ? <Pause size={28} /> : <Play size={28} />}
        </button>

        <button onClick={() => skip(10)} className={`p-2 hover:bg-gray-200/50 ${getRadiusClass('element')} transition-colors`} title="Skip forward 10s">
          <SkipForward size={20} />
        </button>

        {keyMoments.length > 0 && (
          <>
            <div className="w-px h-8 bg-gray-300 mx-1" />
            <button
              onClick={jumpToPrevMoment}
              className={`p-2 hover:bg-purple-100 ${getRadiusClass('element')} transition-colors text-purple-600 disabled:opacity-30`}
              disabled={!keyMoments.some(m => m.timestamp < currentTime - 0.5)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={jumpToNextMoment}
              className={`p-2 hover:bg-purple-100 ${getRadiusClass('element')} transition-colors text-purple-600 disabled:opacity-30`}
              disabled={!keyMoments.some(m => m.timestamp > currentTime)}
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        <div className="flex-1 text-sm font-mono text-gray-700">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        <button
          onClick={cyclePlaybackSpeed}
          className={`px-3 py-1 bg-white/60 hover:bg-white/80 ${getRadiusClass('element')} text-sm font-semibold transition-colors`}
        >
          {playbackRate}x
        </button>

        <div className="flex items-center gap-2">
          <Volume2 size={20} className="text-gray-600" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-20"
          />
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search transcriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className={`w-full pl-10 pr-4 py-2 bg-white/40 border border-white/60 ${getRadiusClass('element')} focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 outline-none transition-all`}
          />
        </div>
        <button
          onClick={handleSearch}
          className={`px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white ${getRadiusClass('element')} font-semibold transition-all`}
        >
          Search
        </button>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700">{searchResults.length} results found:</p>
          {searchResults.map((result, index) => (
            <button
              key={index}
              onClick={() => seekTo(result.time)}
              className={`w-full text-left px-4 py-2 bg-white/40 hover:bg-white/60 ${getRadiusClass('element')} transition-all`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-cyan-600">{formatTime(result.time)}</span>
              </div>
              <p className="text-sm text-gray-700 line-clamp-2">{result.excerpt}...</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

UnifiedSessionAudioPlayer.displayName = 'UnifiedSessionAudioPlayer';
