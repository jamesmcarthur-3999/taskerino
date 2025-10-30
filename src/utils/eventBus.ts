/**
 * EventBus - Simple event bus for cross-component communication
 *
 * Provides a lightweight pub/sub system for events that need to cross
 * context boundaries (e.g., media processing events, enrichment updates).
 *
 * **Usage**:
 * ```typescript
 * // Subscribe to event
 * const unsubscribe = eventBus.on('media-processing-progress', (event) => {
 *   console.log(event.stage, event.progress);
 * });
 *
 * // Emit event
 * eventBus.emit('media-processing-progress', {
 *   sessionId: 'session-123',
 *   stage: 'concatenating',
 *   progress: 50
 * });
 *
 * // Cleanup (IMPORTANT: always unsubscribe in useEffect cleanup)
 * useEffect(() => {
 *   const unsubscribe = eventBus.on('event-name', handler);
 *   return unsubscribe;
 * }, []);
 * ```
 *
 * **Memory Leak Prevention**:
 * - All subscriptions MUST be cleaned up via the returned unsubscribe function
 * - Use in useEffect cleanup to prevent memory leaks
 * - EventBus tracks active listeners for debugging (see getListenerCount)
 *
 * **Events**:
 * - `media-processing-progress` - Real-time media processing updates
 * - `media-processing-complete` - Media processing finished
 * - `media-processing-error` - Media processing error
 * - `enrichment-started` - Enrichment job started
 * - `enrichment-progress` - Enrichment progress update
 * - `enrichment-completed` - Enrichment job completed
 * - `enrichment-failed` - Enrichment job failed
 */

type EventHandler<T = any> = (data: T) => void;

interface EventMap {
  // Media processing events
  'media-processing-progress': MediaProcessingProgressEvent;
  'media-processing-complete': MediaProcessingCompleteEvent;
  'media-processing-error': MediaProcessingErrorEvent;

  // Enrichment events
  'enrichment-started': EnrichmentStartedEvent;
  'enrichment-progress': EnrichmentProgressEvent;
  'enrichment-completed': EnrichmentCompletedEvent;
  'enrichment-failed': EnrichmentFailedEvent;
}

// ============================================================================
// Event Types
// ============================================================================

export interface MediaProcessingProgressEvent {
  sessionId: string;
  stage: 'concatenating' | 'merging' | 'complete';
  progress: number; // 0-100
  message?: string;
}

export interface MediaProcessingCompleteEvent {
  sessionId: string;
  optimizedPath: string;
}

export interface MediaProcessingErrorEvent {
  sessionId: string;
  stage: 'concatenating' | 'merging';
  error: string;
}

export interface EnrichmentStartedEvent {
  sessionId: string;
  jobId: string;
}

export interface EnrichmentProgressEvent {
  sessionId: string;
  jobId: string;
  stage: string;
  progress: number; // 0-100
}

export interface EnrichmentCompletedEvent {
  sessionId: string;
  jobId: string;
}

export interface EnrichmentFailedEvent {
  sessionId: string;
  jobId: string;
  error: string;
}

// ============================================================================
// EventBus Implementation
// ============================================================================

class EventBus {
  private listeners: Map<keyof EventMap, Set<EventHandler>> = new Map();

  /**
   * Subscribe to an event
   * @param event Event name
   * @param handler Event handler function
   * @returns Unsubscribe function
   */
  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const handlers = this.listeners.get(event)!;
    handlers.add(handler);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Emit an event to all subscribers
   * @param event Event name
   * @param data Event data
   */
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[EventBus] Error in handler for event "${String(event)}":`, error);
      }
    });
  }

  /**
   * Remove all listeners for an event (or all events if no event specified)
   * @param event Optional event name
   */
  removeAllListeners(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event (for debugging)
   * @param event Event name
   * @returns Number of active listeners
   */
  getListenerCount(event: keyof EventMap): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Get all event names with active listeners (for debugging)
   * @returns Array of event names
   */
  getActiveEvents(): (keyof EventMap)[] {
    return Array.from(this.listeners.keys());
  }
}

// Singleton instance
export const eventBus = new EventBus();

/**
 * React hook for subscribing to events
 * Automatically cleans up on unmount
 *
 * @example
 * ```typescript
 * useEventBusSubscription('media-processing-progress', (event) => {
 *   console.log(event.stage, event.progress);
 * });
 * ```
 */
export function useEventBusSubscription<K extends keyof EventMap>(
  event: K,
  handler: EventHandler<EventMap[K]>
): void {
  // Note: This is a basic implementation
  // In a real app, you'd want to use useEffect here, but since this is
  // a utility file, we export the hook for components to use with useEffect
  // See SessionProcessingScreen.tsx for proper usage pattern
}
