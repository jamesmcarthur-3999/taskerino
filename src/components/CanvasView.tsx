/**
 * CanvasView Component
 *
 * AI-powered session summary canvas that generates bespoke layouts
 */

import React, { useState, useEffect } from 'react';
import { DemoCanvas } from './AICanvas/DemoCanvas';
import { AICanvasRenderer } from './AICanvas/AICanvasRenderer';
import { FlexibleCanvasRenderer } from './AICanvas/FlexibleCanvasRenderer';
import { ComponentRenderer } from './canvas';
import { aiCanvasGenerator } from '../services/aiCanvasGenerator';
import type { Session, SessionSummary, FlexibleSessionSummary, CanvasSpec, SourceCitation } from '../types';
import { isFlexibleSummary } from '../types';
import { AlertCircle, Sparkles, RefreshCw, Beaker } from 'lucide-react';
import { getRadiusClass, getGlassClasses } from '../design-system/theme';
import { CanvasMatrix } from './matrix/CanvasMatrix';
import { useSessions } from '../context/SessionsContext';
import { CanvasFreshnessBadge } from './canvas/CanvasFreshnessBadge';
import { CanvasNavigationProvider } from '../context/CanvasNavigationContext';
import { ActionExecutionProvider } from './canvas/ActionExecutionContext';

interface CanvasViewProps {
  session: Session;
  onNavigateToSource?: (citation: SourceCitation) => void;
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
 * Format elapsed time (seconds) into readable format
 */
function formatElapsedTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) {
    return `${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

/**
 * Get context-aware message based on elapsed time
 */
function getTimeBasedMessage(seconds: number): string {
  if (seconds < 30) {
    return '🤖 AI is analyzing your session...';
  } else if (seconds < 120) {
    return '🤖 Processing timeline and insights...';
  } else if (seconds < 300) {
    return '🤖 Designing comprehensive canvas (large session)...';
  } else if (seconds < 600) {
    return '🤖 Complex session - this may take up to 10 minutes...';
  } else {
    return '🤖 Almost done, finalizing design...';
  }
}

/**
 * Main CanvasView component
 */
export function CanvasView({ session, onNavigateToSource }: CanvasViewProps) {
  const { updateSession, sessions } = useSessions();
  const [canvasSpec, setCanvasSpec] = useState<CanvasSpec | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState({ progress: 0, stage: '' });
  const [lastSessionId, setLastSessionId] = useState<string>(session.id);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Helper to get the latest session data from context (avoids stale closure issues)
  const getLatestSession = React.useCallback(() => {
    return sessions.find(s => s.id === session.id) || session;
  }, [sessions, session.id, session]);

  // Check if session has summary data
  const hasSummary = session.summary && session.summary.narrative;

  // Handler for manual canvas regeneration
  const handleRegenerateCanvas = () => {
    console.log('[CanvasView] Manual canvas regeneration requested');
    setCanvasSpec(null);
    const latestSession = getLatestSession();
    updateSession({ ...latestSession, canvasSpec: undefined });
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
    // Only load if we don't already have a spec in state
    if (!canvasSpec && session.canvasSpec) {
      if (isCanvasFresh(session.canvasSpec, session.summary)) {
        console.log('[CanvasView] Loading fresh cached canvas from session');
        setCanvasSpec(session.canvasSpec);
      } else {
        console.log('[CanvasView] Cached canvas is stale (summary updated), will regenerate');
        // Don't load stale cache - let generation useEffect handle it
      }
    }
  }, [
    session.id, // Re-run when session changes
    session.canvasSpec?.metadata.generatedAt, // Re-run when canvas changes (use timestamp, not object)
    canvasSpec, // Re-run when local state changes
    // Don't depend on session.summary object - use timestamp instead (checked in isCanvasFresh)
  ]);

  // Track elapsed time during generation
  useEffect(() => {
    if (!isGenerating) {
      setElapsedTime(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  // Generate canvas spec if needed (only runs once per session)
  useEffect(() => {
    if (!hasSummary) {
      console.log('[CanvasView] No summary available - showing placeholder');
      return;
    }

    // Skip if we already have a spec (either in state or being generated)
    if (canvasSpec || isGenerating) {
      console.log('[CanvasView] Skipping generation - already have spec or generating');
      return;
    }

    // Check if session has cached spec AND it's still fresh
    if (session.canvasSpec) {
      if (isCanvasFresh(session.canvasSpec, session.summary)) {
        console.log('[CanvasView] Using fresh cached canvas spec from session');
        setCanvasSpec(session.canvasSpec);
        return;
      } else {
        console.log('[CanvasView] Cached canvas is stale, will regenerate');
        // Continue to generation
      }
    }

    // Generate new spec if not cached
    console.log('[CanvasView] No cached canvas found, generating new one...');
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
        const latestSession = getLatestSession();
        const updatedSession = { ...latestSession, canvasSpec: spec };
        updateSession(updatedSession);

        // CRITICAL: Save immediately to storage, bypassing the 5-second debounce
        // This ensures the canvas persists even if the user navigates away immediately
        console.log('[CanvasView] Force-saving canvas to storage (bypass debounce)');
        try {
          const { getStorage } = await import('../services/storage');
          const storage = await getStorage();
          const allSessions = await storage.load<Session[]>('sessions');
          if (allSessions) {
            const sessionIndex = allSessions.findIndex(s => s.id === session.id);
            if (sessionIndex !== -1) {
              allSessions[sessionIndex] = updatedSession;
              await storage.save('sessions', allSessions);
              console.log('[CanvasView] ✅ Canvas saved immediately to storage');
            }
          }
        } catch (saveError) {
          console.error('[CanvasView] ⚠️ Immediate save failed (will rely on debounced save):', saveError);
          // Non-fatal: debounced save will catch it eventually
        }
      } catch (error) {
        console.error('[CanvasView] Failed to generate canvas:', error);

        // Provide user-friendly error messages
        let userMessage = 'Unknown error';
        if (error instanceof Error) {
          const errorMsg = error.message.toLowerCase();

          if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
            userMessage = 'Canvas generation timed out. Your session has a lot of data! Try viewing it again - the second attempt is usually faster.';
          } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
            userMessage = 'Network error. Please check your connection and try again.';
          } else if (errorMsg.includes('api key')) {
            userMessage = 'API key issue. Please check your Claude API key in Settings.';
          } else {
            userMessage = error.message;
          }
        }

        setGenerationError(userMessage);
        console.error('[CanvasView] Error details:', { error, userMessage });
        // Fallback to demo canvas on error
      } finally {
        setIsGenerating(false);
      }
    };

    generateCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session.id, // Re-run when session changes
    hasSummary, // Re-run when summary becomes available
    canvasSpec, // Re-run when local canvas state changes
    isGenerating, // Re-run when generation state changes
    // Use timestamp instead of object reference to avoid unnecessary re-runs
    session.canvasSpec?.metadata.generatedAt,
  ]);

  // Auto-invalidate canvas when summary updates
  useEffect(() => {
    // Only check if we have both a canvas and a summary
    if (!canvasSpec || !session.summary) {
      return;
    }

    // Get the summary's last updated timestamp (handles both legacy and flexible summaries)
    const summaryLastUpdated = getSummaryLastUpdated(session.summary);
    if (!summaryLastUpdated) return;

    // Compare timestamps
    const canvasGeneratedAt = canvasSpec.metadata.generatedAt;
    const canvasTime = new Date(canvasGeneratedAt);
    const summaryTime = new Date(summaryLastUpdated);

    // If summary was updated after canvas was generated, invalidate the canvas
    if (summaryTime > canvasTime) {
      console.log('[CanvasView] Summary updated since canvas generation, clearing cache');
      setCanvasSpec(null);
      const latestSession = getLatestSession();
      updateSession({ ...latestSession, canvasSpec: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Watch the actual timestamp values that matter
    session.summary && isFlexibleSummary(session.summary)
      ? (session.summary as FlexibleSessionSummary)?.generatedAt
      : session.summary ? (session.summary as SessionSummary)?.lastUpdated : undefined,
    canvasSpec?.metadata.generatedAt
  ]);

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
    const timeBasedMessage = getTimeBasedMessage(elapsedTime);

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
            stage={generationProgress.stage}
            colorScheme="lavender"
            className="mb-6"
          />

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            AI is Designing Your Canvas...
          </h3>

          {/* Elapsed Time */}
          <p className="text-sm text-gray-600 mb-2">
            {timeBasedMessage}
          </p>

          {/* Time counter */}
          <p className="text-xs text-gray-500">
            Elapsed: {formatElapsedTime(elapsedTime)}
          </p>

          {/* Helpful message for large sessions */}
          {elapsedTime > 120 && (
            <p className="text-xs text-gray-500 mt-4 italic">
              For sessions with lots of data, this can take 5-10 minutes
            </p>
          )}
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
    <div className="w-full p-8">
      <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-6 border border-white/30`}>
        {/* Beta Banner */}
        <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-blue-50/50 border border-blue-200/50 rounded-lg">
          <Beaker className="w-5 h-5 text-blue-600" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Canvas (Beta)</span>
              <span className="px-2 py-1 text-[10px] font-semibold bg-blue-600 text-white rounded uppercase tracking-wide">
                In Development
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              AI-powered session visualization is in active development. Layouts and features may change.
            </p>
          </div>
        </div>

        {/* Canvas Controls Header */}
        {canvasSpec && !generationError && (
          <div className="flex items-center justify-between mb-6">
            <CanvasFreshnessBadge
              canvasGeneratedAt={canvasSpec.metadata.generatedAt}
              summaryLastUpdated={getSummaryLastUpdated(session.summary)}
              isGenerating={isGenerating}
            />

            <button
              onClick={handleRegenerateCanvas}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white/80 backdrop-blur-sm border border-gray-300 ${getRadiusClass('field')} hover:bg-white transition-colors`}
              title="Regenerate canvas with latest data"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </button>
          </div>
        )}

        {/* Canvas Content */}
        {canvasSpec && !generationError ? (
          // Prioritize new component tree system
          canvasSpec.componentTree ? (
            <ActionExecutionProvider>
              <CanvasNavigationProvider
                onNavigateToSource={onNavigateToSource || (() => console.warn('No navigation handler provided'))}
              >
                <ComponentRenderer tree={canvasSpec.componentTree} />
              </CanvasNavigationProvider>
            </ActionExecutionProvider>
          ) : session.summary && isFlexibleSummary(session.summary) ? (
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
    </div>
  );
}
