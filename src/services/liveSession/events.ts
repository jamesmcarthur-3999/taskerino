/**
 * Live Session Events
 *
 * Defines events that external AI services should listen to for
 * real-time session intelligence updates.
 *
 * Usage:
 * ```typescript
 * import { EventBus } from '@/services/eventBus';
 * import type { LiveSessionEvent } from './events';
 *
 * EventBus.on('screenshot-analyzed', (event: ScreenshotAnalyzedEvent) => {
 *   // AI decides if this is significant enough to update summary
 *   if (event.analysis.curiosity > 0.7 || event.analysis.progressIndicators?.blockers) {
 *     // Trigger summary update
 *   }
 * });
 * ```
 */

import type { SessionScreenshot, SessionAudioSegment } from '../../types';

// ============================================================================
// Event Types
// ============================================================================

/**
 * Screenshot analyzed event
 *
 * Fired when a screenshot has been captured and analyzed by AI.
 * This is the primary trigger for live session intelligence updates.
 */
export interface ScreenshotAnalyzedEvent {
  type: 'screenshot-analyzed';
  sessionId: string;
  screenshot: SessionScreenshot;
  timestamp: string;  // ISO 8601
  changeType: 'new-screenshot';
}

/**
 * Audio processed event
 *
 * Fired when an audio segment has been transcribed.
 * May contain important verbal context not visible in screenshots.
 */
export interface AudioProcessedEvent {
  type: 'audio-processed';
  sessionId: string;
  audioSegment: SessionAudioSegment;
  timestamp: string;  // ISO 8601
  changeType: 'new-audio';
}

/**
 * Context changed event
 *
 * Fired when significant context changes occur (activity switch, focus change, etc.)
 * AI can use this to trigger summary updates even without new screenshots.
 */
export interface ContextChangedEvent {
  type: 'context-changed';
  sessionId: string;
  changeType: 'activity-switch' | 'focus-change' | 'blocker-detected' | 'achievement-detected';
  previousContext?: string;
  newContext?: string;
  timestamp: string;  // ISO 8601
  metadata?: Record<string, any>;
}

/**
 * Summary requested event
 *
 * Fired when user explicitly requests a summary update (e.g., via UI button).
 * AI should prioritize this over automatic triggers.
 */
export interface SummaryRequestedEvent {
  type: 'summary-requested';
  sessionId: string;
  requestedBy: 'user' | 'system';
  timestamp: string;  // ISO 8601
}

/**
 * User question answered event
 *
 * Fired when user responds to an AI question (via ask_user_question tool).
 * AI can incorporate this answer into its next summary update.
 * answer is null if the question timed out without user response.
 */
export interface UserQuestionAnsweredEvent {
  type: 'user-question-answered';
  sessionId: string;
  questionId: string;
  question: string;
  answer: string | null;
  timestamp: string;  // ISO 8601
}

/**
 * Summary updated event
 *
 * Fired when the live session summary has been updated.
 * UI components can listen to this to refresh displays.
 */
export interface SummaryUpdatedEvent {
  type: 'summary-updated';
  sessionId: string;
  summary: any;  // Updated summary object
  updatedBy: 'ai' | 'user';
  timestamp: string;  // ISO 8601
}

/**
 * Union type of all live session events
 */
export type LiveSessionEvent =
  | ScreenshotAnalyzedEvent
  | AudioProcessedEvent
  | ContextChangedEvent
  | SummaryRequestedEvent
  | UserQuestionAnsweredEvent
  | SummaryUpdatedEvent;

// ============================================================================
// Event Emitter
// ============================================================================

/**
 * Live session event emitter
 *
 * Wrapper around EventBus for type-safe live session event emission.
 * Used internally by RecordingContext and SessionsZone.
 */
export class LiveSessionEventEmitter {
  /**
   * Emit screenshot-analyzed event
   */
  static emitScreenshotAnalyzed(
    sessionId: string,
    screenshot: SessionScreenshot
  ): void {
    const event: ScreenshotAnalyzedEvent = {
      type: 'screenshot-analyzed',
      sessionId,
      screenshot,
      timestamp: new Date().toISOString(),
      changeType: 'new-screenshot'
    };

    // Use existing EventBus instance
    import('@/services/eventBus').then(({ eventBus }) => {
      eventBus.emit('screenshot-analyzed', event);
    });
  }

  /**
   * Emit audio-processed event
   */
  static emitAudioProcessed(
    sessionId: string,
    audioSegment: SessionAudioSegment
  ): void {
    const event: AudioProcessedEvent = {
      type: 'audio-processed',
      sessionId,
      audioSegment,
      timestamp: new Date().toISOString(),
      changeType: 'new-audio'
    };

    import('@/services/eventBus').then(({ eventBus }) => {
      eventBus.emit('audio-processed', event);
    });
  }

  /**
   * Emit context-changed event
   */
  static emitContextChanged(
    sessionId: string,
    changeType: ContextChangedEvent['changeType'],
    previousContext?: string,
    newContext?: string,
    metadata?: Record<string, any>
  ): void {
    const event: ContextChangedEvent = {
      type: 'context-changed',
      sessionId,
      changeType,
      previousContext,
      newContext,
      timestamp: new Date().toISOString(),
      metadata
    };

    import('@/services/eventBus').then(({ eventBus }) => {
      eventBus.emit('context-changed', event);
    });
  }

  /**
   * Emit summary-requested event
   */
  static emitSummaryRequested(
    sessionId: string,
    requestedBy: 'user' | 'system'
  ): void {
    const event: SummaryRequestedEvent = {
      type: 'summary-requested',
      sessionId,
      requestedBy,
      timestamp: new Date().toISOString()
    };

    import('@/services/eventBus').then(({ eventBus }) => {
      eventBus.emit('summary-requested', event);
    });
  }

  /**
   * Emit user-question-answered event
   */
  static emitUserQuestionAnswered(
    sessionId: string,
    questionId: string,
    question: string,
    answer: string | null
  ): void {
    const event: UserQuestionAnsweredEvent = {
      type: 'user-question-answered',
      sessionId,
      questionId,
      question,
      answer,
      timestamp: new Date().toISOString()
    };

    import('@/services/eventBus').then(({ eventBus }) => {
      eventBus.emit('user-question-answered', event);
    });
  }

  /**
   * Emit summary-updated event
   */
  static emitSummaryUpdated(
    sessionId: string,
    summary: any,
    updatedBy: 'ai' | 'user'
  ): void {
    const event: SummaryUpdatedEvent = {
      type: 'summary-updated',
      sessionId,
      summary,
      updatedBy,
      timestamp: new Date().toISOString()
    };

    import('@/services/eventBus').then(({ eventBus }) => {
      eventBus.emit('summary-updated', event);
    });
  }
}

// ============================================================================
// Event Listener Helpers
// ============================================================================

/**
 * Subscribe to live session events
 *
 * Type-safe wrapper for EventBus.on()
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToLiveSessionEvents(
 *   'screenshot-analyzed',
 *   async (event) => {
 *     console.log(`New screenshot: ${event.screenshot.id}`);
 *     // Trigger AI update...
 *   }
 * );
 *
 * // Cleanup
 * unsubscribe();
 * ```
 */
export function subscribeToLiveSessionEvents<T extends LiveSessionEvent['type']>(
  eventType: T,
  handler: (event: Extract<LiveSessionEvent, { type: T }>) => void | Promise<void>
): () => void {
  // Import EventBus dynamically to avoid circular dependencies
  let unsubscribe: (() => void) | null = null;

  import('@/services/eventBus').then(({ eventBus }) => {
    const subscriptionId = eventBus.on(eventType, handler);
    unsubscribe = () => eventBus.off(subscriptionId);
  });

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

/**
 * Subscribe to all live session events
 *
 * Useful for debugging or comprehensive AI orchestrators.
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToAllLiveSessionEvents((event) => {
 *   console.log(`Event: ${event.type}`, event);
 * });
 * ```
 */
export function subscribeToAllLiveSessionEvents(
  handler: (event: LiveSessionEvent) => void | Promise<void>
): () => void {
  const eventTypes: LiveSessionEvent['type'][] = [
    'screenshot-analyzed',
    'audio-processed',
    'context-changed',
    'summary-requested',
    'user-question-answered',
    'summary-updated'
  ];

  const unsubscribers = eventTypes.map(eventType =>
    subscribeToLiveSessionEvents(eventType, handler as any)
  );

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}
