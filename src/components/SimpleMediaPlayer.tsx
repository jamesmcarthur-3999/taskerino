/**
 * SimpleMediaPlayer - Unified media playback for all session types
 *
 * Handles three cases with a single HTML5 video element:
 * 1. Video + Audio → Optimized MP4 (merged video + audio)
 * 2. Video Only → Optimized MP4 (video only)
 * 3. Audio Only → Optimized MP3 (concatenated audio)
 *
 * All new sessions produce session.video.optimizedPath from background processing.
 * The browser's <video> element handles both MP4 and MP3 files natively.
 */

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Session } from '../types';

interface SimpleMediaPlayerProps {
  session: Session;
  onTimeUpdate?: (time: number) => void;
}

export interface SimpleMediaPlayerRef {
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
}

export const SimpleMediaPlayer = forwardRef<SimpleMediaPlayerRef, SimpleMediaPlayerProps>(
  ({ session, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Check if we have optimized media
    const optimizedPath = session.video?.optimizedPath;
    const hasMedia = !!optimizedPath;

    // Determine if this is audio-only (MP3) or has video (MP4)
    const isAudioOnly = optimizedPath?.endsWith('.mp3');

    // Convert Tauri file path to browser-compatible URL
    const mediaUrl = optimizedPath ? convertFileSrc(optimizedPath) : null;

    // Expose playback controls to parent
    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      play: () => {
        videoRef.current?.play();
      },
      pause: () => {
        videoRef.current?.pause();
      },
    }));

    // Handle time updates for transcript syncing
    const handleTimeUpdate = () => {
      if (videoRef.current && onTimeUpdate) {
        onTimeUpdate(videoRef.current.currentTime);
      }
    };

    // Log media info
    useEffect(() => {
      if (hasMedia) {
        console.log('[SIMPLE PLAYER] Media detected:', {
          type: isAudioOnly ? 'audio-only (MP3)' : 'video (MP4)',
          path: optimizedPath,
          url: mediaUrl,
        });
      } else {
        console.warn('[SIMPLE PLAYER] No optimized media found. Session needs background processing.');
      }
    }, [hasMedia, isAudioOnly, optimizedPath, mediaUrl]);

    // No media available
    if (!hasMedia || !mediaUrl) {
      return (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <div className="text-gray-600 mb-2">Media Not Available</div>
          <div className="text-sm text-gray-500">
            This session needs to be processed. Background processing will create optimized media.
          </div>
        </div>
      );
    }

    return (
      <div className="bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={mediaUrl}
          controls
          controlsList="nodownload"
          onTimeUpdate={handleTimeUpdate}
          className={`w-full ${isAudioOnly ? 'h-16' : 'h-auto'}`}
          style={isAudioOnly ? { aspectRatio: 'auto' } : { aspectRatio: '16/9' }}
        >
          Your browser does not support the video element.
        </video>
      </div>
    );
  }
);

SimpleMediaPlayer.displayName = 'SimpleMediaPlayer';
