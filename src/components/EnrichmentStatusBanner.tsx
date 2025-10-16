/**
 * EnrichmentStatusBanner
 *
 * Production-grade status banner showing enrichment state and providing entry point
 * for session enrichment workflow. Replaces AudioReviewStatusBanner with comprehensive
 * audio + video enrichment tracking.
 *
 * Visual States:
 * 1. Not Enriched (Call-to-Action) - Inviting amber/orange gradient with EnrichmentButton
 * 2. Fully Enriched (Success) - Green gradient showing what was enriched and when
 * 3. Partially Enriched (Informational) - Blue/cyan gradient showing partial completion
 * 4. Enriching (In Progress) - Cyan gradient with loading spinner and progress
 * 5. Enrichment Failed (Error) - Red gradient with error details and retry option
 *
 * Features:
 * - Detects enrichment status from session.enrichmentStatus
 * - Shows EnrichmentButton for not-enriched sessions
 * - Re-enrichment dropdown for completed sessions (audio-only, video-only, both)
 * - Format timestamps nicely
 * - Handles all states gracefully with proper error recovery
 * - Opens EnrichmentProgressModal when enrichment starts
 * - Updates session after enrichment completes
 */

import React, { useState } from 'react';
import { Sparkles, CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import type { Session } from '../types';
import { EnrichmentButton } from './EnrichmentButton';
import { sessionEnrichmentService, type EnrichmentProgress } from '../services/sessionEnrichmentService';
import { useUI } from '../context/UIContext';
import { getStorage } from '../services/storage';
import {
  RADIUS,
  ICON_SIZES,
  getSuccessGradient,
  getDangerGradient,
  getWarningGradient,
  getInfoGradient,
} from '../design-system/theme';

interface EnrichmentStatusBannerProps {
  session: Session;
  onEnrichmentStart?: () => void;
  onSessionUpdate?: (session: Session) => void;
}

export function EnrichmentStatusBanner({
  session,
  onEnrichmentStart,
  onSessionUpdate,
}: EnrichmentStatusBannerProps) {
  const { addNotification } = useUI();
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress | null>(null);

  // Check if session has audio or video data
  const hasAudio = session.audioSegments && session.audioSegments.length > 0;
  const hasVideo = session.video?.fullVideoAttachmentId;

  // Don't show banner if no enrichable content
  if (!hasAudio && !hasVideo) {
    return null;
  }

  // Determine enrichment status
  const enrichmentStatus = session.enrichmentStatus?.status || 'idle';
  const audioCompleted = session.audioReviewCompleted || false;
  const videoCompleted = session.video?.chapters && session.video.chapters.length > 0;

  // Calculate audio duration for display
  const audioDuration = session.audioSegments?.reduce((total, seg) => total + seg.duration, 0) || 0;
  const durationMinutes = Math.floor(audioDuration / 60);

  // Calculate frame count for display
  const frameCount = session.screenshots?.length || 0;

  /**
   * Start enrichment process
   */
  const handleEnrichment = async () => {
    setIsEnriching(true);
    setEnrichmentProgress(null);

    // Notify parent that enrichment is starting
    if (onEnrichmentStart) {
      onEnrichmentStart();
    }

    try {
      console.log('✨ [ENRICHMENT BANNER] Starting session enrichment...');

      // Start enrichment with progress tracking
      const result = await sessionEnrichmentService.enrichSession(session, {
        includeAudio: hasAudio && !audioCompleted ? true : false,
        includeVideo: hasVideo && !videoCompleted ? true : false,
        includeSummary: true,
        forceRegenerate: false,
        onProgress: (progress) => {
          setEnrichmentProgress(progress);
          console.log(`✨ [ENRICHMENT BANNER] ${progress.stage}: ${progress.message} (${progress.progress}%)`);
        },
      });

      console.log('✅ [ENRICHMENT BANNER] Enrichment complete:', result);

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Enrichment Complete',
        message: `Session enriched successfully. Total cost: $${result.totalCost.toFixed(1)}`,
      });

      // Notify parent of session update (reload from storage for fresh data)
      if (onSessionUpdate) {
        // ✅ FIX: Reload session directly from storage to avoid stale React state
        const storage = await getStorage();
        const sessions = await storage.load<Session[]>('sessions') || [];

        if (Array.isArray(sessions)) {
          const freshSession = sessions.find((s) => s.id === session.id);
          if (freshSession) {
            console.log('✅ [ENRICHMENT BANNER] Reloaded fresh session from storage after enrichment');
            onSessionUpdate(freshSession);
          } else {
            console.error('❌ [ENRICHMENT BANNER] Session not found in storage after enrichment');
          }
        }
      }
    } catch (error: any) {
      console.error('❌ [ENRICHMENT BANNER] Enrichment failed:', error);

      addNotification({
        type: 'error',
        title: 'Enrichment Failed',
        message: error.message || 'Failed to enrich session',
      });
    } finally {
      setIsEnriching(false);
      setEnrichmentProgress(null);
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return 'Unknown time';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Relative time for recent events
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    // Absolute time for older events
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // ============================================================================
  // STATE 4: ENRICHING (IN PROGRESS)
  // ============================================================================

  if (isEnriching || enrichmentStatus === 'in-progress') {
    const progress = enrichmentProgress?.progress || session.enrichmentStatus?.progress || 0;
    const message = enrichmentProgress?.message || 'Enriching session...';
    const infoGradient = getInfoGradient('medium');

    return (
      <div className={`${infoGradient.container} rounded-[${RADIUS.card}px] p-6`}>
        <div className="flex items-center gap-4">
          <div className={`flex-shrink-0 w-12 h-12 ${infoGradient.iconBg} rounded-full flex items-center justify-center`}>
            <Loader2 size={ICON_SIZES.lg} className={`${infoGradient.iconColor} animate-spin`} />
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-bold ${infoGradient.textPrimary} mb-1`}>
              Enriching Session...
            </h3>
            <p className={`text-sm ${infoGradient.textSecondary} mb-3`}>
              {message}
            </p>
            {/* Progress bar */}
            <div className="h-2 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full overflow-hidden shadow-inner border border-gray-200/50">
              <div
                className="h-full rounded-full transition-all shadow-sm bg-gradient-to-r from-cyan-500 to-blue-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className="text-right">
              <div className={`text-2xl font-bold ${infoGradient.textPrimary}`}>
                {Math.round(progress)}%
              </div>
              <div className={`text-xs ${infoGradient.textSecondary} uppercase tracking-wide`}>
                Progress
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STATE 5: ENRICHMENT FAILED (ERROR)
  // ============================================================================

  if (enrichmentStatus === 'failed') {
    const errorMessage = session.enrichmentStatus?.errors?.[0] || 'Enrichment failed';
    const dangerGradient = getDangerGradient('medium');

    return (
      <div className={`${dangerGradient.container} rounded-[${RADIUS.card}px] p-6`}>
        <div className="flex items-center gap-4">
          <div className={`flex-shrink-0 w-12 h-12 ${dangerGradient.iconBg} rounded-full flex items-center justify-center`}>
            <AlertCircle size={ICON_SIZES.lg} className={dangerGradient.iconColor} />
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-bold ${dangerGradient.textPrimary} mb-1`}>
              Enrichment Failed
            </h3>
            <p className={`text-sm ${dangerGradient.textSecondary}`}>
              {errorMessage}
            </p>
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={handleEnrichment}
              className={`px-4 py-2 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-[${RADIUS.element}px] font-semibold transition-all hover:scale-105 active:scale-95 shadow-md flex items-center gap-2`}
            >
              <RefreshCw size={ICON_SIZES.sm} />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STATE 2: ENRICHMENT COMPLETED (SUCCESS) - Compact Version
  // ============================================================================
  // Compact banner showing enrichment status without the Re-Enrich button
  // (Re-Enrich button has been moved to the top toolbar)

  if (enrichmentStatus === 'completed') {
    const enrichedAt = session.enrichmentStatus?.completedAt;
    const totalCost = session.enrichmentStatus?.totalCost || 0;
    const successGradient = getSuccessGradient('light');

    // Build a compact summary line
    const summaryParts = [];
    if (videoCompleted) {
      summaryParts.push(`${session.video?.chapters?.length || 0} video chapters`);
    }
    if (audioCompleted) {
      summaryParts.push(`${durationMinutes} min audio`);
    }
    if (session.summary) {
      summaryParts.push('session summary');
    }
    const summaryText = summaryParts.length > 0
      ? summaryParts.join(' • ')
      : 'Session enriched';

    return (
      <div className={`${successGradient.container} rounded-[${RADIUS.field}px] px-4 py-3`}>
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 w-8 h-8 ${successGradient.iconBg} rounded-full flex items-center justify-center`}>
            <CheckCircle2 size={ICON_SIZES.sm} className={successGradient.iconColor} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className={`text-sm font-bold ${successGradient.textPrimary}`}>
                Session Enriched
              </h3>
              <span className={`text-xs ${successGradient.textSecondary}`}>
                {summaryText}
              </span>
            </div>
            <p className={`text-xs ${successGradient.textSecondary} mt-0.5`}>
              Enriched {formatTimestamp(enrichedAt)}
              {totalCost > 0 && ` • $${totalCost.toFixed(1)}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STATE 1: NOT ENRICHED (CALL-TO-ACTION)
  // ============================================================================

  const warningGradient = getWarningGradient('medium');

  return (
    <div className={`${warningGradient.container} rounded-[${RADIUS.card}px] p-6`}>
      <div className="flex items-center gap-4">
        <div className={`flex-shrink-0 w-12 h-12 ${warningGradient.iconBg} rounded-full flex items-center justify-center`}>
          <Sparkles size={ICON_SIZES.lg} className={warningGradient.iconColor} />
        </div>
        <div className="flex-1">
          <h3 className={`text-lg font-bold ${warningGradient.textPrimary} mb-1`}>
            Session Ready for Enrichment
          </h3>
          <p className={`text-sm ${warningGradient.textSecondary}`}>
            Let Ned analyze{' '}
            {hasAudio && `${durationMinutes} min audio`}
            {hasAudio && hasVideo && ' + '}
            {hasVideo && `${frameCount} frames`}
            {' '}to extract insights and chapters
          </p>
        </div>
        <div className="flex-shrink-0">
          <EnrichmentButton session={session} onEnrich={handleEnrichment} />
        </div>
      </div>
    </div>
  );
}
