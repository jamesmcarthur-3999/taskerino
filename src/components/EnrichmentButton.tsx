/**
 * EnrichmentButton
 *
 * Production-grade call-to-action button for initiating unified session enrichment.
 * Shows cost estimates, enrichment details, and provides comprehensive feedback on
 * why enrichment may not be available.
 *
 * Features:
 * - Real-time cost estimation
 * - Detailed cost breakdown tooltip
 * - Smart disabled states with explanatory messages
 * - Loading states for async operations
 * - Gradient styling matching ChapterGenerator
 * - Full keyboard and accessibility support
 */

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import type { Session } from '../types';
import { sessionEnrichmentService, type CostEstimate, type EnrichmentCapability } from '../services/sessionEnrichmentService';

interface EnrichmentButtonProps {
  session: Session;
  onEnrich: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function EnrichmentButton({
  session,
  onEnrich,
  disabled = false,
  className = '',
}: EnrichmentButtonProps) {
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [capability, setCapability] = useState<EnrichmentCapability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [enriching, setEnriching] = useState(false);

  // Load cost estimate and capability on mount
  useEffect(() => {
    async function loadEstimate() {
      setLoading(true);
      setError(null);

      try {
        // Check what can be enriched
        const cap = await sessionEnrichmentService.canEnrich(session);
        setCapability(cap);

        // Get cost estimate
        const estimate = await sessionEnrichmentService.estimateCost(session, {
          includeAudio: cap.audio,
          includeVideo: cap.video,
          includeSummary: true,
        });
        setCostEstimate(estimate);
      } catch (err: any) {
        console.error('Failed to load enrichment estimate:', err);
        setError(err.message || 'Failed to estimate enrichment cost');
      } finally {
        setLoading(false);
      }
    }

    loadEstimate();
  }, [session.id]); // Reload if session ID changes

  // Handle enrichment trigger
  const handleEnrich = async () => {
    setEnriching(true);
    try {
      await onEnrich();
    } catch (err: any) {
      console.error('Enrichment failed:', err);
      setError(err.message || 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  // Determine if button should be disabled
  const isDisabled = disabled || enriching || loading || error !== null || !canEnrich();

  // Check if enrichment is possible
  function canEnrich(): boolean {
    if (!capability) return false;
    return capability.audio || capability.video;
  }

  // Get disabled reason message
  function getDisabledReason(): string | null {
    if (enriching) return null;
    if (loading) return null;
    if (error) return error;

    // Check if already enriched
    if (session.audioReviewCompleted && session.video?.chapters && session.video.chapters.length > 0) {
      return 'Session fully enriched';
    }

    if (session.audioReviewCompleted) {
      return 'Only video chapters remaining';
    }

    if (session.video?.chapters && session.video.chapters.length > 0) {
      return 'Only audio review remaining';
    }

    // Check capability reasons
    if (!capability?.audio && !capability?.video) {
      const reasons = [
        ...(capability?.reasons.audio || []),
        ...(capability?.reasons.video || []),
      ];
      return reasons[0] || 'No enrichment available';
    }

    return null;
  }

  // Get enrichment details text (what will be enriched)
  function getEnrichmentDetails(): string {
    if (!capability || !costEstimate) return '';

    const parts: string[] = [];

    // Audio details
    if (capability.audio && costEstimate.breakdown.audio) {
      const minutes = Math.round(costEstimate.breakdown.audio.duration);
      parts.push(`${minutes} min audio`);
    }

    // Video details
    if (capability.video && costEstimate.breakdown.video) {
      const frames = costEstimate.breakdown.video.frameCount;
      parts.push(`${frames} video frames`);
    }

    return parts.join(' + ');
  }

  // formatCost function removed - no longer needed after cost UI removal

  return (
    <div className="relative inline-block">
      {/* Main Button */}
      <button
        onClick={handleEnrich}
        disabled={isDisabled}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={`
          px-6 py-3
          bg-gradient-to-r from-cyan-500 to-blue-500
          text-white rounded-xl font-semibold text-sm
          shadow-lg shadow-cyan-200/50
          hover:shadow-xl hover:shadow-cyan-300/60
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
          flex items-center gap-3
          ${className}
        `}
        aria-label="Enrich session with AI analysis"
        aria-describedby={isDisabled ? 'enrichment-disabled-reason' : undefined}
      >
        {/* Icon */}
        {loading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : enriching ? (
          <Loader2 size={18} className="animate-spin" />
        ) : error ? (
          <AlertCircle size={18} />
        ) : (
          <Sparkles size={18} />
        )}

        {/* Button Text */}
        <div className="flex flex-col items-start">
          <span className="font-bold">
            {loading
              ? 'Loading...'
              : enriching
              ? 'Enriching...'
              : error
              ? 'Error'
              : 'Enrich Session'}
          </span>

          {/* Subtext */}
          {!loading && !enriching && !error && costEstimate && (
            <span className="text-xs font-normal opacity-90">
              {getEnrichmentDetails()} {/* Cost estimate removed - users should feel free to enrich */}
            </span>
          )}
        </div>
      </button>

      {/* Disabled Reason Message */}
      {isDisabled && getDisabledReason() && (
        <div
          id="enrichment-disabled-reason"
          className="absolute top-full mt-2 left-0 right-0 text-center text-xs text-gray-600"
        >
          {getDisabledReason()}
        </div>
      )}

      {/* Tooltip - Enrichment Details (NO COST) */}
      {showTooltip && !loading && !error && costEstimate && canEnrich() && (
        <div
          className="
            absolute bottom-full mb-3 left-1/2 -translate-x-1/2
            w-64 p-4
            bg-white/95 backdrop-blur-xl
            rounded-xl border-2 border-white/60
            shadow-xl
            text-sm text-gray-900
            z-50
            pointer-events-none
          "
          role="tooltip"
        >
          {/* Tooltip Arrow */}
          <div
            className="
              absolute top-full left-1/2 -translate-x-1/2 -mt-px
              w-3 h-3
              bg-white/95 border-r-2 border-b-2 border-white/60
              rotate-45
            "
          />

          <div className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles size={14} className="text-cyan-500" />
            Enrichment Details
          </div>

          <div className="space-y-2 text-xs">
            {/* Audio Line */}
            {capability?.audio && costEstimate.breakdown.audio && (
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-cyan-500 flex-shrink-0" />
                <span className="text-gray-700">
                  Audio Analysis: {Math.round(costEstimate.breakdown.audio.duration)} min
                </span>
              </div>
            )}

            {/* Video Line */}
            {capability?.video && costEstimate.breakdown.video && (
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-cyan-500 flex-shrink-0" />
                <span className="text-gray-700">
                  Video Chapters: {costEstimate.breakdown.video.frameCount} frames
                </span>
              </div>
            )}

            {/* Summary Line */}
            {costEstimate.breakdown.summary && (
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-cyan-500 flex-shrink-0" />
                <span className="text-gray-700">
                  Summary Update
                </span>
              </div>
            )}
          </div>

          {/* Cost breakdown removed - violates NO COST UI philosophy */}

          {/* Info Text */}
          <div className="mt-3 text-xs text-gray-500 leading-relaxed">
            One-time enrichment with comprehensive audio and video analysis
          </div>
        </div>
      )}
    </div>
  );
}
