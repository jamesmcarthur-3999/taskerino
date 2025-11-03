/**
 * EnrichmentContext
 *
 * In-memory tracking of active enrichments for real-time UI updates.
 * Avoids storage thrashing by keeping progress state in React Context.
 *
 * Pattern:
 * - Track multiple concurrent enrichments using Map<sessionId, ActiveEnrichment>
 * - Throttle progress updates to 100ms for smooth animations
 * - No storage writes during enrichment (only on completion via SessionsContext)
 * - Follows React Context pattern used throughout codebase
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { EnrichmentProgress } from '../services/sessionEnrichmentService';

export interface ActiveEnrichment {
  sessionId: string;
  sessionName: string;
  progress: number; // 0-100
  stage: 'validating' | 'estimating' | 'locking' | 'checkpointing' | 'audio' | 'video' | 'canvas' | 'summary' | 'complete' | 'failed';
  startTime: number;
  lastUpdate: number;
}

interface EnrichmentContextType {
  // Get all active enrichments
  activeEnrichments: Map<string, ActiveEnrichment>;

  // Start tracking an enrichment
  startTracking: (sessionId: string, sessionName: string) => void;

  // Update progress for an enrichment (throttled)
  updateProgress: (sessionId: string, progress: EnrichmentProgress) => void;

  // Stop tracking an enrichment (on completion or failure)
  stopTracking: (sessionId: string) => void;

  // Get a specific active enrichment
  getActiveEnrichment: (sessionId: string) => ActiveEnrichment | undefined;

  // Check if any enrichments are active
  hasActiveEnrichments: boolean;
}

const EnrichmentContext = createContext<EnrichmentContextType | undefined>(undefined);

/**
 * Hook to access enrichment tracking context
 */
export function useEnrichmentContext(): EnrichmentContextType {
  const context = useContext(EnrichmentContext);
  if (!context) {
    throw new Error('useEnrichmentContext must be used within EnrichmentProvider');
  }
  return context;
}

interface EnrichmentProviderProps {
  children: React.ReactNode;
}

/**
 * Provider for enrichment tracking
 */
export function EnrichmentProvider({ children }: EnrichmentProviderProps) {
  const [activeEnrichments, setActiveEnrichments] = useState<Map<string, ActiveEnrichment>>(
    new Map()
  );

  // Throttle tracking: Track last update time per session to throttle updates
  const lastUpdateTimesRef = useRef<Map<string, number>>(new Map());

  // Pending updates: Buffer progress updates during throttle period
  const pendingUpdatesRef = useRef<Map<string, EnrichmentProgress>>(new Map());

  // Throttle interval: 100ms (smooth 10 updates/sec)
  const THROTTLE_MS = 100;

  /**
   * Start tracking an enrichment
   */
  const startTracking = useCallback((sessionId: string, sessionName: string) => {
    console.log(`🌈 [ENRICHMENT CONTEXT] Started tracking: ${sessionName} (${sessionId})`);

    const now = Date.now();

    setActiveEnrichments((prev) => {
      const newMap = new Map(prev);
      newMap.set(sessionId, {
        sessionId,
        sessionName,
        progress: 0,
        stage: 'audio',
        startTime: now,
        lastUpdate: now,
      });
      return newMap;
    });

    lastUpdateTimesRef.current.set(sessionId, now);
  }, []);

  /**
   * Update progress for an enrichment (throttled)
   */
  const updateProgress = useCallback((sessionId: string, progress: EnrichmentProgress) => {
    const now = Date.now();
    const lastUpdate = lastUpdateTimesRef.current.get(sessionId) || 0;
    const timeSinceLastUpdate = now - lastUpdate;

    // Buffer the update
    pendingUpdatesRef.current.set(sessionId, progress);

    // Throttle: Only update if enough time has passed
    if (timeSinceLastUpdate >= THROTTLE_MS) {
      // Apply the pending update
      const pendingProgress = pendingUpdatesRef.current.get(sessionId);
      if (pendingProgress) {
        setActiveEnrichments((prev) => {
          const existing = prev.get(sessionId);
          if (!existing) {
            console.warn(`🌈 [ENRICHMENT CONTEXT] Received update for non-tracked session: ${sessionId}`);
            return prev;
          }

          const newMap = new Map(prev);
          newMap.set(sessionId, {
            ...existing,
            progress: pendingProgress.progress,
            stage: pendingProgress.stage,
            lastUpdate: now,
          });
          return newMap;
        });

        lastUpdateTimesRef.current.set(sessionId, now);
        pendingUpdatesRef.current.delete(sessionId);

        // Log progress updates (throttled to console as well)
        console.log(
          `🌈 [ENRICHMENT CONTEXT] ${sessionId.slice(0, 8)}: ${progress.stage} ${progress.progress}%`
        );
      }
    }
    // If throttled, the pending update will be applied by the flush effect
  }, []);

  /**
   * Stop tracking an enrichment
   */
  const stopTracking = useCallback((sessionId: string) => {
    console.log(`🌈 [ENRICHMENT CONTEXT] Stopped tracking: ${sessionId}`);

    setActiveEnrichments((prev) => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });

    lastUpdateTimesRef.current.delete(sessionId);
    pendingUpdatesRef.current.delete(sessionId);
  }, []);

  /**
   * Get a specific active enrichment
   */
  const getActiveEnrichment = useCallback(
    (sessionId: string): ActiveEnrichment | undefined => {
      return activeEnrichments.get(sessionId);
    },
    [activeEnrichments]
  );

  /**
   * Flush pending updates periodically
   * This ensures the last progress update is always applied even if throttled
   */
  useEffect(() => {
    const flushInterval = setInterval(() => {
      const now = Date.now();

      pendingUpdatesRef.current.forEach((pendingProgress, sessionId) => {
        const lastUpdate = lastUpdateTimesRef.current.get(sessionId) || 0;
        const timeSinceLastUpdate = now - lastUpdate;

        // Flush if throttle period has passed
        if (timeSinceLastUpdate >= THROTTLE_MS) {
          setActiveEnrichments((prev) => {
            const existing = prev.get(sessionId);
            if (!existing) return prev;

            const newMap = new Map(prev);
            newMap.set(sessionId, {
              ...existing,
              progress: pendingProgress.progress,
              stage: pendingProgress.stage,
              lastUpdate: now,
            });
            return newMap;
          });

          lastUpdateTimesRef.current.set(sessionId, now);
          pendingUpdatesRef.current.delete(sessionId);
        }
      });
    }, THROTTLE_MS);

    return () => clearInterval(flushInterval);
  }, []);

  const hasActiveEnrichments = activeEnrichments.size > 0;

  const value: EnrichmentContextType = {
    activeEnrichments,
    startTracking,
    updateProgress,
    stopTracking,
    getActiveEnrichment,
    hasActiveEnrichments,
  };

  return (
    <EnrichmentContext.Provider value={value}>
      {children}
    </EnrichmentContext.Provider>
  );
}
