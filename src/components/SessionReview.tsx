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

import React, { useState, useRef, useEffect } from 'react';
import { ImageIcon, Mic, Video } from 'lucide-react';
import type { Session, SessionContextItem, AudioKeyMoment } from '../types';
import { ReviewTimeline } from './ReviewTimeline';
import { keyMomentsDetectionService } from '../services/keyMomentsDetectionService';
import { UnifiedMediaPlayer } from './UnifiedMediaPlayer';
import type { UnifiedMediaPlayerRef } from './UnifiedMediaPlayer';

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
  const [keyMoments, setKeyMoments] = useState<AudioKeyMoment[]>([]);
  const mediaPlayerRef = useRef<UnifiedMediaPlayerRef>(null);

  // Detect what media is available
  const hasScreenshots = session.screenshots && session.screenshots.length > 0;
  const hasAudio = session.audioSegments && session.audioSegments.length > 0;
  const hasVideo = session.video && session.video.fullVideoAttachmentId;

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

  // Detect key moments for audio
  useEffect(() => {
    const detectMoments = async () => {
      if (session.audioSegments && session.audioSegments.length > 0) {
        const moments = await keyMomentsDetectionService.detectKeyMoments(session);
        setKeyMoments(moments);
      }
    };
    detectMoments();
  }, [session]);

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

    // Seek unified media player
    if (mediaPlayerRef.current) {
      mediaPlayerRef.current.seekTo(newTime);
    }
  };

  // Handle chapters saved - notify parent to refresh session data
  const handleChaptersSaved = () => {
    if (onSessionUpdate) {
      // Parent component should re-fetch session data to get updated chapters
      // We pass the current session as a signal that it needs to be refreshed
      onSessionUpdate(session);
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
      {/* Unified Media Player - handles all 7 media combinations */}
      <UnifiedMediaPlayer
        ref={mediaPlayerRef}
        session={session}
        screenshots={session.screenshots || []}
        audioSegments={session.audioSegments}
        video={session.video}
        keyMoments={keyMoments}
        onTimeUpdate={setCurrentTime}
        onChaptersGenerated={handleChaptersSaved}
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
