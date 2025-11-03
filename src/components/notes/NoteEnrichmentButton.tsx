/**
 * NoteEnrichmentButton
 *
 * Circular button for triggering AI enrichment of notes.
 * Shows loading states and provides feedback on enrichment status.
 *
 * Features:
 * - Gradient circular design matching EnrichmentButton
 * - Loading animations
 * - Smart disabled states with explanatory messages
 * - Tooltip with enrichment details
 * - Full keyboard and accessibility support
 */

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { Note } from '../../types';
import { getNoteEnrichmentService } from '../../services/noteEnrichmentService';

interface NoteEnrichmentButtonProps {
  note: Note;
  onEnrich: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function NoteEnrichmentButton({
  note,
  onEnrich,
  disabled = false,
  className = '',
}: NoteEnrichmentButtonProps) {
  const [enriching, setEnriching] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const enrichmentService = getNoteEnrichmentService();

  // Check if note can be enriched
  const canEnrichResult = enrichmentService.canEnrich(note);
  const canEnrichNote = canEnrichResult.success;

  // Determine if button should be disabled
  const isDisabled = disabled || enriching || !canEnrichNote;

  // Get disabled reason message
  function getDisabledReason(): string | null {
    if (enriching) return null;
    if (!canEnrichResult.success) return canEnrichResult.reason || 'Cannot enrich note';
    return null;
  }

  // Handle enrichment trigger
  const handleEnrich = async () => {
    if (isDisabled) return;

    setEnriching(true);
    try {
      await onEnrich();
    } catch (err: any) {
      console.error('[NOTE ENRICHMENT] Enrichment failed:', err);
    } finally {
      setEnriching(false);
    }
  };

  // Get tooltip text
  function getTooltipText(): string {
    const disabledReason = getDisabledReason();
    if (disabledReason) {
      return disabledReason;
    }

    if (note.metadata?.aiEnrichment) {
      return 'Re-run AI enrichment';
    }

    return 'Enrich note with AI';
  }

  return (
    <div className="relative inline-block">
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap z-50 pointer-events-none">
          {getTooltipText()}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
        </div>
      )}

      {/* Circular Button */}
      <button
        onClick={handleEnrich}
        disabled={isDisabled}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={`
          w-10 h-10
          rounded-full
          flex items-center justify-center
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500
          ${
            isDisabled
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:scale-110 hover:shadow-lg active:scale-95'
          }
          ${className}
        `}
        aria-label={getTooltipText()}
        title={getTooltipText()}
      >
        {enriching ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Sparkles className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
