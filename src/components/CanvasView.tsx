/**
 * CanvasView Component
 *
 * AI-powered session summary canvas that generates bespoke layouts
 */

import React, { useState, useEffect } from 'react';
import { DemoCanvas } from './AICanvas/DemoCanvas';
import { AICanvasRenderer } from './AICanvas/AICanvasRenderer';
import { FlexibleCanvasRenderer } from './AICanvas/FlexibleCanvasRenderer';
import { aiCanvasGenerator } from '../services/aiCanvasGenerator';
import type { CanvasSpec } from '../services/aiCanvasGenerator';
import type { Session, SessionSummary, FlexibleSessionSummary } from '../types';
import { isFlexibleSummary } from '../types';
import { AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { getRadiusClass, getGlassClasses } from '../design-system/theme';
import { CanvasMatrix } from './matrix/CanvasMatrix';
import { useSessions } from '../context/SessionsContext';
import { CanvasFreshnessBadge } from './canvas/CanvasFreshnessBadge';

interface CanvasViewProps {
  session: Session;
}

/**
 * Get the lastUpdated timestamp from a summary (handles both legacy and flexible summaries)
 */
function getSummaryLastUpdated(
  summary: SessionSummary | FlexibleSessionSummary | null | undefined
): string | undefined {
  if (!summary) return undefined;
  if (isFlexibleSummary(summary)) {
    return summary.generatedAt;
  }
  return summary.lastUpdated;
}

/**
 * Check if cached canvas is still fresh (newer than summary)
 */
function isCanvasFresh(
  canvasSpec: CanvasSpec | null | undefined,
  summary: SessionSummary | FlexibleSessionSummary | null | undefined
): boolean {
  if (!canvasSpec || !summary) return false;

  const canvasTime = new Date(canvasSpec.metadata.generatedAt);
  const summaryLastUpdated = getSummaryLastUpdated(summary);
  if (!summaryLastUpdated) return false;

  const summaryTime = new Date(summaryLastUpdated);

  return canvasTime >= summaryTime;
}

/**
 * Main CanvasView component
 */
export function CanvasView({ session }: CanvasViewProps) {
  const { updateSession } = useSessions();
  const [canvasSpec, setCanvasSpec] = useState<CanvasSpec | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState({ progress: 0, stage: '' });
  const [lastSessionId, setLastSessionId] = useState<string>(session.id);

  // Check if session has summary data
  const hasSummary = session.summary && session.summary.narrative;

  // Handler for manual canvas regeneration
  const handleRegenerateCanvas = () => {
    console.log('[CanvasView] Manual canvas regeneration requested');
    setCanvasSpec(null);
    updateSession({ ...session, canvasSpec: undefined });
  };

  // Reset state when session changes
  useEffect(() => {
    if (session.id !== lastSessionId) {
      console.log('[CanvasView] Session changed, resetting state');
      setCanvasSpec(null);
      setIsGenerating(false);
      setGenerationError(null);
      setLastSessionId(session.id);
    }
  }, [session.id, lastSessionId]);

  // Debug logging
  useEffect(() => {
    console.log('[CanvasView] Session debug:', {
      sessionId: session.id,
      hasSummary,
      summaryExists: !!session.summary,
      narrativeExists: !!session.summary?.narrative,
      canvasSpecExists: !!session.canvasSpec,
      enrichmentStatus: session.enrichmentStatus?.status,
    });
  }, [session.id, hasSummary, session.summary, session.canvasSpec, session.enrichmentStatus]);

  // Initialize canvasSpec from session on mount and when session.canvasSpec changes
  useEffect(() => {
    if (session.canvasSpec && !canvasSpec) {
      if (isCanvasFresh(session.canvasSpec, session.summary)) {
        console.log('[CanvasView] Loading fresh cached canvas');
        setCanvasSpec(session.canvasSpec);
      } else {
        console.log('[CanvasView] Cached canvas is stale (summary updated), will regenerate');
        // Don't load stale cache - let generation useEffect handle it
      }
    }
  }, [session.canvasSpec, canvasSpec, session.summary]);

  // Generate canvas spec if needed (only runs once per session)
  useEffect(() => {
    if (!hasSummary) {
      console.log('[CanvasView] No summary available - showing placeholder');
      return;
    }

    // Skip if we already have a spec (either in state or being generated)
    if (canvasSpec || isGenerating) {
      return;
    }

    // Check if session has cached spec AND it's still fresh
    if (session.canvasSpec) {
      if (isCanvasFresh(session.canvasSpec, session.summary)) {
        console.log('[CanvasView] Using fresh cached canvas spec');
        setCanvasSpec(session.canvasSpec);
        return;
      } else {
        console.log('[CanvasView] Cached canvas is stale, regenerating');
        // Continue to generation
      }
    }

    // Generate new spec if not cached
    const generateCanvas = async () => {
      setIsGenerating(true);
      setGenerationError(null);
      setGenerationProgress({ progress: 0, stage: 'Starting' });

      try {
        console.log('[CanvasView] Generating new canvas spec...');
        const spec = await aiCanvasGenerator.generate(session, (progress, stage) => {
          setGenerationProgress({ progress, stage });
        });
        setCanvasSpec(spec);

        // Save the generated spec to session for future use
        console.log('[CanvasView] Saving canvas spec to session');
        updateSession({ ...session, canvasSpec: spec });
      } catch (error) {
        console.error('[CanvasView] Failed to generate canvas:', error);
        setGenerationError(error instanceof Error ? error.message : 'Unknown error');
        // Fallback to demo canvas on error
      } finally {
        setIsGenerating(false);
      }
    };

    generateCanvas();
  }, [session.id, hasSummary, canvasSpec, isGenerating, session.canvasSpec, updateSession]);

  // Auto-invalidate canvas when summary updates
  useEffect(() => {
    if (canvasSpec && session.summary) {
      if (!isCanvasFresh(session.canvasSpec, session.summary)) {
        console.log('[CanvasView] Summary updated since canvas generation, clearing cache');
        setCanvasSpec(null);
        updateSession({ ...session, canvasSpec: undefined });
      }
    }
  }, [getSummaryLastUpdated(session.summary)]);

  // No summary state
  if (!hasSummary) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className={`text-center max-w-md ${getGlassClasses('medium')} ${getRadiusClass('card')} p-8`}>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Summary Available
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            This session hasn't been enriched with AI yet. Complete the session and run enrichment to see a beautiful AI-generated summary canvas.
          </p>
        </div>
      </div>
    );
  }

  // Loading state - WITH MATRIX ANIMATION
  if (isGenerating) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center max-w-md">
          {/* Icon at top */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-6">
            <Sparkles className="w-8 h-8 text-purple-600" />
          </div>

          {/* MATRIX ANIMATION - NOW SYNCED WITH REAL PROGRESS */}
          <CanvasMatrix
            progress={generationProgress.progress}
            colorScheme="lavender"
            className="mb-6"
          />

          {/* Title and description */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            AI is Designing Your Canvas...
          </h3>
          <p className="text-sm text-gray-600">
            {generationProgress.stage || 'Creating a bespoke layout based on your session\'s unique characteristics.'}
          </p>
        </div>
      </div>
    );
  }

  // Render AI-generated canvas
  console.log('[CanvasView] Rendering canvas:', {
    hasCanvasSpec: !!canvasSpec,
    hasGenerationError: !!generationError,
    isFlexible: session.summary ? isFlexibleSummary(session.summary) : false,
    renderPath: canvasSpec && !generationError ?
      (session.summary && isFlexibleSummary(session.summary) ? 'FlexibleCanvasRenderer' : 'AICanvasRenderer') :
      'DemoCanvas'
  });

  return (
    <div className="h-full w-full overflow-y-auto p-6">
      {/* Canvas Controls Header */}
      {canvasSpec && !generationError && (
        <div className="flex items-center justify-between mb-4">
          <CanvasFreshnessBadge
            canvasGeneratedAt={canvasSpec.metadata.generatedAt}
            summaryLastUpdated={getSummaryLastUpdated(session.summary)}
            isGenerating={isGenerating}
          />

          <button
            onClick={handleRegenerateCanvas}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Regenerate canvas with latest data"
          >
            <RefreshCw className="w-4 h-4" />
            Regenerate
          </button>
        </div>
      )}

      {/* Canvas Content */}
      {canvasSpec && !generationError ? (
        session.summary && isFlexibleSummary(session.summary) ? (
          <FlexibleCanvasRenderer
            session={session}
            summary={session.summary}
            spec={canvasSpec}
          />
        ) : (
          <AICanvasRenderer session={session} spec={canvasSpec} />
        )
      ) : (
        <DemoCanvas session={session} />
      )}
    </div>
  );
}
