/**
 * AudioPlayer Component
 *
 * Full-featured audio player with:
 * - Play/pause controls
 * - Playback speed: 0.5x, 1x, 1.5x, 2x, 3x
 * - Timeline scrubbing
 * - Waveform visualization
 * - Time markers for key moments
 * - Volume control
 * - Current time / total duration display
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import type { AudioKeyMoment } from '../types';

interface AudioPlayerProps {
  audioBase64: string;
  waveform?: number[];
  duration: number;
  keyMoments?: AudioKeyMoment[];
  onSeek?: (time: number) => void;
}

export function AudioPlayer({
  audioBase64,
  waveform,
  duration,
  keyMoments = [],
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);

  // Playback speed options
  const speedOptions = [0.5, 1, 1.5, 2, 3];

  // Update current time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Play/pause toggle
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Seek to time
  const seekTo = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  };

  // Skip backward/forward
  const skip = (seconds: number) => {
    seekTo(Math.max(0, Math.min(duration, currentTime + seconds)));
  };

  // Change playback speed
  const changeSpeed = () => {
    const currentIndex = speedOptions.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % speedOptions.length;
    const newRate = speedOptions[nextIndex];
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  // Format time as MM:SS or HH:MM:SS
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white/40 backdrop-blur-sm rounded-[20px] p-4 border border-white/60">
      {/* Audio element */}
      <audio ref={audioRef} src={audioBase64} />

      {/* Waveform with timeline */}
      <div className="relative h-20 mb-4 bg-gray-100/50 rounded-lg overflow-hidden">
        {/* Waveform bars */}
        <div className="absolute inset-0 flex items-center justify-center gap-[2px] px-2">
          {waveform && waveform.length > 0 ? (
            waveform.map((amplitude, i) => (
              <div
                key={i}
                className="flex-1 bg-cyan-500 rounded-full transition-all"
                style={{
                  height: `${Math.max(4, amplitude * 100)}%`,
                  opacity: (i / waveform.length) <= (currentTime / duration) ? 1 : 0.3,
                }}
              />
            ))
          ) : (
            // Fallback: simple waveform
            Array.from({ length: 200 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-cyan-500 rounded-full"
                style={{
                  height: '50%',
                  opacity: (i / 200) <= (currentTime / duration) ? 1 : 0.3,
                }}
              />
            ))
          )}
        </div>

        {/* Key moment markers */}
        {keyMoments.map((moment) => (
          <button
            key={moment.id}
            className="absolute top-0 w-1 h-full bg-yellow-500 hover:bg-yellow-600 cursor-pointer z-10 group"
            style={{ left: `${(moment.timestamp / duration) * 100}%` }}
            onClick={() => seekTo(moment.timestamp)}
            title={moment.label}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {moment.label}
            </div>
          </button>
        ))}

        {/* Progress indicator */}
        <div
          className="absolute top-0 left-0 h-full bg-cyan-500/20 pointer-events-none"
          style={{ width: `${(currentTime / duration) * 100}%` }}
        />

        {/* Clickable scrubber */}
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            seekTo(percent * duration);
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Skip back */}
        <button
          onClick={() => skip(-10)}
          className="p-2 hover:bg-gray-200/50 rounded-lg transition-colors"
          title="Skip back 10s"
        >
          <SkipBack size={20} />
        </button>

        {/* Play/Pause */}
        <button
          onClick={togglePlayPause}
          className="p-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-full transition-all shadow-lg"
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>

        {/* Skip forward */}
        <button
          onClick={() => skip(10)}
          className="p-2 hover:bg-gray-200/50 rounded-lg transition-colors"
          title="Skip forward 10s"
        >
          <SkipForward size={20} />
        </button>

        {/* Time display */}
        <div className="flex-1 text-sm font-mono text-gray-700">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Playback speed */}
        <button
          onClick={changeSpeed}
          className="px-3 py-1 bg-white/60 hover:bg-white/80 rounded-lg text-sm font-semibold transition-colors"
          title="Change playback speed"
        >
          {playbackRate}x
        </button>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <Volume2 size={20} className="text-gray-600" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => {
              const newVolume = parseFloat(e.target.value);
              setVolume(newVolume);
              if (audioRef.current) {
                audioRef.current.volume = newVolume;
              }
            }}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
}
