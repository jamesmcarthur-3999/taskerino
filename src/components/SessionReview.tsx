/**
 * SessionReview Component
 *
 * Unified review experience that adapts to available media:
 * - Screenshots only: Screenshot scrubber + timeline
 * - Audio only: Audio waveform + timeline with transcripts
 * - Screenshots + Audio: Screenshot scrubber + audio playback + timeline
 * - Future: Video player + timeline (video takes precedence when available)
 *
 * This replaces both the Timeline and Audio tabs with a single, more powerful Review tab.
 */

import React, { useState, useRef } from 'react';
import { ImageIcon } from 'lucide-react';
import type { Session, SessionContextItem } from '../types';
import { ReviewTimeline } from './ReviewTimeline';
import { SimpleMediaPlayer } from './SimpleMediaPlayer';
import type { SimpleMediaPlayerRef } from './SimpleMediaPlayer';

interface SessionReviewProps {
  session: Session;
  onAddComment?: (screenshotId: string, comment: string) => void;
  onToggleFlag?: (screenshotId: string) => void;
  onAddContext?: (contextItem: SessionContextItem) => void;
  showContextCapture?: boolean;
  onSessionUpdate?: (updatedSession: Session) => void;
}

export function SessionReview({
  session,
  onAddComment,
  onToggleFlag,
  onAddContext,
  showContextCapture,
  onSessionUpdate,
}: SessionReviewProps) {
  const [currentTime, setCurrentTime] = useState(0); // Current playback position in seconds
  const mediaPlayerRef = useRef<SimpleMediaPlayerRef>(null);

  // Detect what media is available
  const hasScreenshots = session.screenshots && session.screenshots.length > 0;
  const hasAudio = session.audioSegments && session.audioSegments.length > 0;
  // hasVideo is true if there's either a video recording OR an optimized media file (audio or video+audio)
  const hasVideo = session.video && (session.video.fullVideoAttachmentId || session.video.optimizedPath);

  console.log('📺 [SESSION REVIEW] Media detection:', {
    sessionId: session.id,
    hasScreenshots,
    hasAudio,
    hasVideo,
    video: session.video,
    screenshots: session.screenshots?.length || 0,
    audioSegments: session.audioSegments?.length || 0
  });

  // Calculate total session duration in seconds
  const sessionDurationMs = session.endTime
    ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
    : Date.now() - new Date(session.startTime).getTime();
  const sessionDurationSeconds = sessionDurationMs / 1000;

  console.log('📺 [SESSION REVIEW] Media detected:', {
    hasScreenshots,
    hasAudio,
    hasVideo,
  });

  // Handle timeline item click - seek to that time
  const handleTimelineSeek = (timestamp: string) => {
    const sessionStart = new Date(session.startTime).getTime();
    const itemTime = new Date(timestamp).getTime();
    const seekTime = (itemTime - sessionStart) / 1000; // Convert to seconds
    const newTime = Math.max(0, Math.min(seekTime, sessionDurationSeconds));
    setCurrentTime(newTime);

    // Seek media player
    if (mediaPlayerRef.current) {
      mediaPlayerRef.current.seekTo(newTime);
    }
  };

  const hasAnyMedia = hasScreenshots || hasAudio || hasVideo;

  if (!hasAnyMedia) {
    return (
      <div className="bg-white/40 backdrop-blur-xl rounded-[24px] border-2 border-white/50 p-12 text-center">
        <ImageIcon size={64} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Media Captured</h3>
        <p className="text-gray-600">
          This session has no screenshots or audio recordings to review
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Simple Media Player - plays optimized MP4/MP3 from session.video.optimizedPath */}
      <SimpleMediaPlayer
        ref={mediaPlayerRef}
        session={session}
        onTimeUpdate={setCurrentTime}
      />

      {/* Unified Timeline - Always shown, syncs with player above */}
      <ReviewTimeline
        session={session}
        currentTime={currentTime}
        onSeek={handleTimelineSeek}
        onAddComment={onAddComment}
        onToggleFlag={onToggleFlag}
        onAddContext={onAddContext}
        showContextCapture={showContextCapture}
      />
    </div>
  );
}
