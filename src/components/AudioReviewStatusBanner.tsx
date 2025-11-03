/**
 * Audio Review Status Banner
 *
 * Shows the status of the one-time audio review for a session.
 * Displays on the summary page (overview tab) to indicate:
 * - Review not started (with button to start)
 * - Review in progress
 * - Review completed
 * - No audio available
 */

import React, { useState } from 'react';
import { Music, CheckCircle2, Loader2 } from 'lucide-react';
import type { Session } from '../types';
import { audioReviewService } from '../services/audioReviewService';
import { sessionsAgentService } from '../services/sessionsAgentService';
import { useSessionList } from '../context/SessionListContext';
import { useUI } from '../context/UIContext';
import { useNotes } from '../context/NotesContext';

interface AudioReviewStatusBannerProps {
  session: Session;
  onReviewComplete?: (session: Session) => void;
  onSummaryRegenerationStart?: () => void;
  onSummaryRegenerationComplete?: (session: Session) => void;
}

export function AudioReviewStatusBanner({
  session,
  onReviewComplete,
  onSummaryRegenerationStart,
  onSummaryRegenerationComplete,
}: AudioReviewStatusBannerProps) {
  const { sessions, updateSession } = useSessionList();
  const { addNotification } = useUI();
  const { state: notesState } = useNotes();
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<string>('');

  const needsReview = audioReviewService.needsReview(session);
  const hasAudio = session.audioSegments && session.audioSegments.length > 0;

  // Calculate duration for display
  const audioDuration = session.audioSegments?.reduce((total, seg) => total + seg.duration, 0) || 0;
  const durationMinutes = Math.floor(audioDuration / 60);

  const handleStartReview = async () => {
    if (!needsReview) return;

    // Show simple confirmation
    const confirmMessage = `Ned will analyze ${durationMinutes} minutes of session audio to:\n\n• Clean up transcripts for better readability\n• Extract comprehensive insights and key moments\n• Identify work patterns and emotional journey\n\nThis may take a moment. Proceed?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsReviewing(true);
    setReviewProgress(0);
    setCurrentStage('Preparing...');

    try {
      console.log('🎧 [AUDIO REVIEW BANNER] Starting audio review...');

      const result = await audioReviewService.reviewSession(session, (progress) => {
        setReviewProgress(progress.progress || 0);
        setCurrentStage(progress.message || '');
        console.log(`🎧 [AUDIO REVIEW BANNER] ${progress.stage}: ${progress.message} (${progress.progress}%)`);
      });

      console.log('✅ [AUDIO REVIEW BANNER] Review complete:', result);

      // Update session with review results and upgraded transcripts
      const updatedSession: Session = {
        ...session,
        audioReviewCompleted: true,
        transcriptUpgradeCompleted: result.upgradedSegments !== undefined,
        fullAudioAttachmentId: result.fullAudioAttachmentId,
        fullTranscription: result.fullTranscription,
        audioInsights: result.insights,
        // Replace audio segments with upgraded versions if available
        audioSegments: result.upgradedSegments || session.audioSegments,
      };

      // Save to database
      updateSession(updatedSession.id, updatedSession);

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Audio Review Complete',
        message: `Extracted comprehensive insights from ${durationMinutes} minutes of audio`,
      });

      // Automatically regenerate summary with audio insights
      console.log('🔄 [AUDIO REVIEW BANNER] Triggering summary regeneration with audio insights...');
      setCurrentStage('Updating summary with audio insights...');
      setReviewProgress(95);

      // Notify parent that summary regeneration is starting
      if (onSummaryRegenerationStart) {
        onSummaryRegenerationStart();
      }

      try {
        const screenshots = updatedSession.screenshots || [];
        const audioSegments = updatedSession.audioSegments || [];

        // Gather context from existing sessions and notes for categorization
        const existingCategories = Array.from(new Set(sessions.map(s => s.category).filter(Boolean))) as string[];
        const existingSubCategories = Array.from(new Set(sessions.map(s => s.subCategory).filter(Boolean))) as string[];
        const existingTags = Array.from(
          new Set([
            ...sessions.flatMap(s => s.tags || []),
            ...notesState.notes.flatMap(n => n.tags || [])
          ])
        );

        const summaryResult = await sessionsAgentService.generateSessionSummary(
          updatedSession,
          screenshots,
          audioSegments,
          {
            existingCategories,
            existingSubCategories,
            existingTags
          }
        );

        console.log('✅ [AUDIO REVIEW BANNER] Summary regenerated with audio insights');

        // Update session with new summary and categorization
        const sessionWithSummary = {
          ...updatedSession,
          category: summaryResult.category,
          subCategory: summaryResult.subCategory,
          tags: summaryResult.tags,
          summary: {
            narrative: summaryResult.narrative || '',
            achievements: summaryResult.achievements || [],
            blockers: summaryResult.blockers || [],
            recommendedTasks: summaryResult.recommendedTasks || [],
            keyInsights: summaryResult.keyInsights || [],
            focusAreas: summaryResult.focusAreas || [],
            lastUpdated: new Date().toISOString(),
            screenshotCount: screenshots.length,
          },
        };

        updateSession(sessionWithSummary.id, sessionWithSummary);

        addNotification({
          type: 'success',
          title: 'Summary Updated',
          message: 'Session summary now includes audio insights and key moments',
        });

        // Notify parent that summary regeneration is complete
        if (onSummaryRegenerationComplete) {
          onSummaryRegenerationComplete(sessionWithSummary);
        } else if (onReviewComplete) {
          onReviewComplete(sessionWithSummary);
        }
      } catch (summaryError: any) {
        console.error('❌ [AUDIO REVIEW BANNER] Failed to regenerate summary:', summaryError);
        // Don't show error to user - audio review still succeeded
        // Notify parent that regeneration is done (even if it failed)
        if (onSummaryRegenerationComplete) {
          onSummaryRegenerationComplete(updatedSession);
        } else if (onReviewComplete) {
          onReviewComplete(updatedSession);
        }
      }
    } catch (error: any) {
      console.error('❌ [AUDIO REVIEW BANNER] Review failed:', error);

      addNotification({
        type: 'error',
        title: 'Audio Review Failed',
        message: error.message || 'Failed to analyze session audio',
      });
    } finally {
      setIsReviewing(false);
      setReviewProgress(0);
      setCurrentStage('');
    }
  };

  // No audio available
  if (!hasAudio) {
    return null; // Don't show banner if no audio
  }

  // Review completed
  if (session.audioReviewCompleted) {
    return (
      <div className="bg-gradient-to-r from-green-500/20 via-emerald-500/10 to-green-400/20 backdrop-blur-xl rounded-[24px] border-2 border-green-300/50 p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-green-900 mb-1">
              Audio Insights Available
            </h3>
            <p className="text-sm text-green-700">
              Ned analyzed {durationMinutes} minutes of audio, cleaned up the transcripts, and extracted key moments, emotional journey, and work patterns
            </p>
          </div>
          <div className="flex-shrink-0">
            <div className="text-right">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Review in progress
  if (isReviewing) {
    return (
      <div className="bg-gradient-to-r from-cyan-500/20 via-blue-500/10 to-cyan-400/20 backdrop-blur-xl rounded-[24px] border-2 border-cyan-300/50 p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-cyan-900 mb-1">
              Ned is reviewing your work...
            </h3>
            <p className="text-sm text-cyan-700 mb-3">
              {currentStage}
            </p>
            {/* Progress bar */}
            <div className="h-2 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full overflow-hidden shadow-inner border border-gray-200/50">
              <div
                className="h-full rounded-full transition-all shadow-sm bg-gradient-to-r from-cyan-500 to-blue-500"
                style={{ width: `${reviewProgress}%` }}
              />
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className="text-right">
              <div className="text-2xl font-bold text-cyan-900">
                {reviewProgress}%
              </div>
              <div className="text-xs text-cyan-700 uppercase tracking-wide">
                Progress
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Needs review (show call-to-action)
  return (
    <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-amber-400/20 backdrop-blur-xl rounded-[24px] border-2 border-amber-300/50 p-6 shadow-lg">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
          <Music className="w-6 h-6 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-amber-900 mb-1">
            Audio Review Available
          </h3>
          <p className="text-sm text-amber-700">
            Ned can analyze {durationMinutes} minutes of session audio to clean up the transcripts and extract comprehensive insights, key moments, and work patterns
          </p>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={handleStartReview}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-[16px] font-semibold transition-all hover:scale-105 active:scale-95 shadow-md flex items-center gap-2"
          >
            <Music size={18} />
            Review Audio
          </button>
        </div>
      </div>
    </div>
  );
}
