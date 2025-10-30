/**
 * EnrichmentStatusIndicator - Compact Status Badge for TopNavigation
 *
 * Task 9: Background Enrichment Plan
 * Displays enrichment job count with spinner, expandable to EnrichmentPanel.
 *
 * Key Features:
 * - **Status Polling**: Updates every 5 seconds (fallback mechanism)
 * - **Auto-Hide**: Hidden when no active jobs (pending + processing = 0)
 * - **Click to Expand**: Opens EnrichmentPanel with full job details
 * - **Animations**: Smooth framer-motion animations (spinner, fade, scale)
 * - **Job Count**: Shows total active jobs (pending + processing)
 *
 * Usage:
 * ```tsx
 * <TopNavigation>
 *   <EnrichmentStatusIndicator />
 * </TopNavigation>
 * ```
 *
 * @see docs/sessions-rewrite/BACKGROUND_ENRICHMENT_PLAN.md - Task 9
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { getBackgroundEnrichmentManager } from '@/services/enrichment/BackgroundEnrichmentManager';
import type { QueueStatus } from '@/services/enrichment/PersistentEnrichmentQueue';
import { EnrichmentPanel } from '@/components/enrichment/EnrichmentPanel';

// ============================================================================
// Types
// ============================================================================

interface EnrichmentStatusIndicatorProps {
  /** Polling interval in milliseconds (default: 5000ms) */
  pollingInterval?: number;

  /** Custom className for styling */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function EnrichmentStatusIndicator({
  pollingInterval = 5000,
  className = '',
}: EnrichmentStatusIndicatorProps) {
  // ========================================
  // State
  // ========================================

  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ========================================
  // Derived State
  // ========================================

  // Active jobs = pending + processing
  const activeJobs = status ? status.pending + status.processing : 0;

  // Should show indicator (hide when no active jobs)
  const shouldShow = activeJobs > 0;

  // ========================================
  // Polling Effect - MEMORY LEAK FIX
  // ========================================
  // FIX: Moved fetch logic inside effect to prevent interval accumulation
  // caused by unstable useCallback dependencies

  useEffect(() => {
    console.log('[EnrichmentStatusIndicator] Starting status polling');

    // Define fetch function inside effect (no external dependencies)
    const fetchStatus = async () => {
      try {
        const manager = getBackgroundEnrichmentManager();

        // Check if manager is initialized
        if (!manager.isInitialized()) {
          console.warn('[EnrichmentStatusIndicator] Manager not initialized');
          setError('Manager not initialized');
          return;
        }

        // Get queue status
        const queueStatus = await manager.getQueueStatus();
        setStatus(queueStatus);
        setError(null);
        setIsLoading(false);

        console.log('[EnrichmentStatusIndicator] Status updated:', {
          pending: queueStatus.pending,
          processing: queueStatus.processing,
          completed: queueStatus.completed,
          failed: queueStatus.failed,
          totalJobs: queueStatus.pending + queueStatus.processing + queueStatus.completed + queueStatus.failed,
        });
      } catch (err) {
        console.error('[EnrichmentStatusIndicator] Failed to fetch status:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchStatus();

    // Set up polling interval
    const interval = setInterval(fetchStatus, pollingInterval);

    // Cleanup on unmount - CRITICAL: prevents interval accumulation
    return () => {
      console.log('[EnrichmentStatusIndicator] Stopping status polling');
      clearInterval(interval);
    };
  }, [pollingInterval]); // Only depend on pollingInterval (stable prop)

  // ========================================
  // Event Handlers
  // ========================================

  /**
   * Toggle expanded state (open/close panel)
   */
  const handleClick = useCallback(() => {
    console.log('[EnrichmentStatusIndicator] Toggling panel:', !expanded);
    setExpanded((prev) => !prev);
  }, [expanded]);

  /**
   * Close panel (called by EnrichmentPanel)
   */
  const handleClose = useCallback(() => {
    console.log('[EnrichmentStatusIndicator] Closing panel');
    setExpanded(false);
  }, []);

  // ========================================
  // Render
  // ========================================

  // Don't render if error or no active jobs
  if (error || !shouldShow) {
    return null;
  }

  // Don't render during initial loading
  if (isLoading) {
    return null;
  }

  return (
    <>
      {/* Compact Badge */}
      <AnimatePresence mode="wait">
        {shouldShow && (
          <motion.button
            key="enrichment-indicator"
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{
              duration: 0.2,
              ease: 'easeOut',
            }}
            onClick={handleClick}
            className={`
              pointer-events-auto
              flex items-center gap-2
              px-3 py-1.5
              rounded-full
              backdrop-blur-xl
              bg-blue-500/20
              border border-blue-400/30
              text-blue-600
              text-sm font-medium
              shadow-lg
              hover:bg-blue-500/30
              transition-colors duration-200
              ${className}
            `}
            title={`${activeJobs} session${activeJobs > 1 ? 's' : ''} enriching`}
          >
            {/* Animated Spinner */}
            <Loader2 className="h-4 w-4 animate-spin" />

            {/* Job Count Text */}
            <span>
              Enriching {activeJobs} session{activeJobs > 1 ? 's' : ''}...
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expandable Panel */}
      <AnimatePresence>
        {expanded && (
          <EnrichmentPanel
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </>
  );
}
