/**
 * CanvasView Component
 *
 * AI-powered session summary canvas that generates bespoke layouts
 */

import React, { useState, useEffect } from 'react';
import { DemoCanvas } from './AICanvas/DemoCanvas';
import { AICanvasRenderer } from './AICanvas/AICanvasRenderer';
import { AICanvasGenerator } from '../services/aiCanvasGenerator';
import type { CanvasSpec } from '../services/aiCanvasGenerator';
import type { Session } from '../types';
import { AlertCircle, Sparkles } from 'lucide-react';
import { getRadiusClass, getGlassClasses } from '../design-system/theme';

interface CanvasViewProps {
  session: Session;
}

/**
 * Main CanvasView component
 */
export function CanvasView({ session }: CanvasViewProps) {
  const [canvasSpec, setCanvasSpec] = useState<CanvasSpec | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Check if session has summary data
  const hasSummary = session.summary && session.summary.narrative;

  // Generate canvas spec when session changes
  useEffect(() => {
    if (!hasSummary) return;

    const generateCanvas = async () => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const generator = AICanvasGenerator.getInstance();
        const spec = await generator.generate(session);
        setCanvasSpec(spec);
      } catch (error) {
        console.error('[CanvasView] Failed to generate canvas:', error);
        setGenerationError(error instanceof Error ? error.message : 'Unknown error');
        // Fallback to demo canvas on error
      } finally {
        setIsGenerating(false);
      }
    };

    generateCanvas();
  }, [session.id, hasSummary]);

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

  // Loading state
  if (isGenerating) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className={`text-center max-w-md ${getGlassClasses('medium')} ${getRadiusClass('card')} p-8`}>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4 animate-pulse">
            <Sparkles className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            AI is Designing Your Canvas...
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Creating a bespoke layout based on your session's unique characteristics.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // Render AI-generated canvas
  return (
    <div className="h-full w-full overflow-y-auto p-6">
      {canvasSpec && !generationError ? (
        <AICanvasRenderer session={session} spec={canvasSpec} />
      ) : (
        <DemoCanvas session={session} />
      )}
    </div>
  );
}
