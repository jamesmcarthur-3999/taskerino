/**
 * EXAMPLE AI AGENT - Complete Working Implementation
 *
 * This is a fully functional AI agent that demonstrates all capabilities
 * of the Live Session Intelligence system.
 *
 * Features Demonstrated:
 * - Event subscription (screenshot-analyzed, audio-processed, etc.)
 * - Context retrieval (summary, delta, full)
 * - Significance filtering
 * - Generating task/note suggestions
 * - Updating summaries
 * - Asking questions
 * - Error handling
 * - Cleanup
 *
 * Usage:
 * ```typescript
 * import { ExampleAIAgent } from '@/services/liveSession/EXAMPLE_AI_AGENT';
 *
 * const agent = new ExampleAIAgent();
 * agent.start('session-123');
 *
 * // Later...
 * agent.stop();
 * ```
 */

import { subscribeToLiveSessionEvents, LiveSessionEventEmitter } from './events';
import type {
  ScreenshotAnalyzedEvent,
  AudioProcessedEvent,
  ContextChangedEvent,
  SummaryRequestedEvent,
  UserQuestionAnsweredEvent,
  SummaryUpdatedEvent
} from './events';
import { getSessionContext, type SummaryContext } from './contextBuilder';
import { updateLiveSessionSummary } from './updateApi';
import type { TaskSuggestion, NoteSuggestion } from './toolExecutor';

/**
 * Example AI Agent
 *
 * Demonstrates a complete AI agent implementation with all Live Session
 * Intelligence features.
 */
export class ExampleAIAgent {
  private sessionId: string | null = null;
  private unsubscribers: Array<() => void> = [];
  private isRunning: boolean = false;
  private isUpdating: boolean = false; // Prevent update loops
  private lastActivity: string = '';
  private audioBuffer: any[] = [];
  private audioTimer: NodeJS.Timeout | null = null;
  private lastUpdateTime: string | null = null;

  /**
   * Start monitoring a session
   */
  async start(sessionId: string): Promise<void> {
    if (this.isRunning) {
      console.warn('[ExampleAgent] Already running');
      return;
    }

    this.sessionId = sessionId;
    this.isRunning = true;
    console.log('[ExampleAgent] Starting for session:', sessionId);

    // Subscribe to all events
    this.unsubscribers.push(
      subscribeToLiveSessionEvents('screenshot-analyzed', this.handleScreenshot.bind(this))
    );
    this.unsubscribers.push(
      subscribeToLiveSessionEvents('audio-processed', this.handleAudio.bind(this))
    );
    this.unsubscribers.push(
      subscribeToLiveSessionEvents('context-changed', this.handleContextChange.bind(this))
    );
    this.unsubscribers.push(
      subscribeToLiveSessionEvents('summary-requested', this.handleSummaryRequest.bind(this))
    );
    this.unsubscribers.push(
      subscribeToLiveSessionEvents('user-question-answered', this.handleUserAnswer.bind(this))
    );
    this.unsubscribers.push(
      subscribeToLiveSessionEvents('summary-updated', this.handleSummaryUpdate.bind(this))
    );

    // Initial summary update
    await this.generateInitialSummary();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log('[ExampleAgent] Stopping');

    // Clear audio timer
    if (this.audioTimer) {
      clearTimeout(this.audioTimer);
      this.audioTimer = null;
    }

    // Unsubscribe from all events
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    // Reset state
    this.sessionId = null;
    this.isRunning = false;
    this.isUpdating = false;
    this.lastActivity = '';
    this.audioBuffer = [];
    this.lastUpdateTime = null;
  }

  /**
   * Handle screenshot analysis
   */
  private async handleScreenshot(event: ScreenshotAnalyzedEvent): Promise<void> {
    if (event.sessionId !== this.sessionId) return;

    try {
      const { curiosity, progressIndicators, detectedActivity } = event.screenshot.aiAnalysis || {};

      // Filter by significance
      if (!this.isSignificant(event)) {
        console.log('[ExampleAgent] Low significance, skipping screenshot');
        return;
      }

      console.log('[ExampleAgent] Processing significant screenshot:', {
        curiosity,
        detectedActivity,
        progressIndicators
      });

      // Handle blockers
      if (progressIndicators?.blockers?.length) {
        await this.handleBlockers(progressIndicators.blockers);
      }

      // Handle achievements
      if (progressIndicators?.achievements?.length) {
        await this.handleAchievements(progressIndicators.achievements);
      }

      // Update focus if activity changed
      if (detectedActivity && detectedActivity !== this.lastActivity) {
        await this.handleActivityChange(detectedActivity);
        this.lastActivity = detectedActivity;
      }

      // Generate suggestions based on context
      await this.generateSuggestions();

    } catch (error) {
      console.error('[ExampleAgent] Error processing screenshot:', error);
    }
  }

  /**
   * Handle audio processing
   */
  private async handleAudio(event: AudioProcessedEvent): Promise<void> {
    if (event.sessionId !== this.sessionId) return;

    // Batch audio segments to reduce API calls
    this.audioBuffer.push(event.audioSegment);

    // Clear existing timer
    if (this.audioTimer) {
      clearTimeout(this.audioTimer);
    }

    // Process batch after 30 seconds of no new audio
    this.audioTimer = setTimeout(async () => {
      await this.processAudioBatch();
      this.audioBuffer = [];
      this.audioTimer = null;
    }, 30000);
  }

  /**
   * Handle context changes
   */
  private async handleContextChange(event: ContextChangedEvent): Promise<void> {
    if (event.sessionId !== this.sessionId) return;

    console.log('[ExampleAgent] Context changed:', event.changeType);

    switch (event.changeType) {
      case 'activity-switch':
        await this.handleActivitySwitch(event);
        break;
      case 'blocker-detected':
        await this.handleBlockerDetected(event);
        break;
      case 'achievement-detected':
        await this.handleAchievementDetected(event);
        break;
      case 'focus-change':
        await this.handleFocusChange(event);
        break;
    }
  }

  /**
   * Handle summary refresh request
   */
  private async handleSummaryRequest(event: SummaryRequestedEvent): Promise<void> {
    if (event.sessionId !== this.sessionId) return;

    console.log('[ExampleAgent] Refresh requested by:', event.reason);

    // Force full update (bypass filters)
    await this.generateCompleteSummary();
  }

  /**
   * Handle user question answer
   */
  private async handleUserAnswer(event: UserQuestionAnsweredEvent): Promise<void> {
    if (event.sessionId !== this.sessionId) return;

    console.log('[ExampleAgent] User answered:', event.answer);

    if (event.answer === null) {
      console.log('[ExampleAgent] Question timed out, using default');
      // Use default/fallback answer
    } else if (event.answer === '') {
      console.log('[ExampleAgent] User skipped question');
      // Continue without clarification
    } else {
      // Incorporate answer into summary
      await this.updateWithUserAnswer(event.question, event.answer);
    }
  }

  /**
   * Handle summary updates (avoid loops)
   */
  private async handleSummaryUpdate(event: SummaryUpdatedEvent): Promise<void> {
    if (event.sessionId !== this.sessionId) return;
    if (this.isUpdating) return; // Prevent loop

    console.log('[ExampleAgent] Summary updated by:', event.updatedBy);

    // Only react if updated by user or another agent
    if (event.updatedBy === 'user') {
      // Could analyze user changes and adapt
    }
  }

  /**
   * Check if screenshot is significant
   */
  private isSignificant(event: ScreenshotAnalyzedEvent): boolean {
    const { aiAnalysis } = event.screenshot;
    if (!aiAnalysis) return false;

    return (
      aiAnalysis.curiosity > 0.7 ||
      aiAnalysis.progressIndicators?.blockers?.length > 0 ||
      aiAnalysis.progressIndicators?.achievements?.length > 0 ||
      aiAnalysis.detectedActivity !== this.lastActivity
    );
  }

  /**
   * Generate initial summary
   */
  private async generateInitialSummary(): Promise<void> {
    if (!this.sessionId) return;

    try {
      const context = await getSessionContext(this.sessionId, 'summary');

      await this.updateSummary({
        currentFocus: "Getting started...",
        momentum: "medium",
        progressToday: []
      });

      console.log('[ExampleAgent] Initial summary generated');
    } catch (error) {
      console.error('[ExampleAgent] Error generating initial summary:', error);
    }
  }

  /**
   * Generate complete summary (full context)
   */
  private async generateCompleteSummary(): Promise<void> {
    if (!this.sessionId) return;

    try {
      const context = await getSessionContext(this.sessionId, 'full');

      // Analyze all data
      const focus = this.analyzeFocus(context);
      const progress = this.analyzeProgress(context);
      const momentum = this.analyzeMomentum(context);
      const suggestions = this.generateSuggestionsFromContext(context);

      await this.updateSummary({
        currentFocus: focus,
        progressToday: progress,
        momentum,
        ...suggestions
      });

      console.log('[ExampleAgent] Complete summary generated');
    } catch (error) {
      console.error('[ExampleAgent] Error generating complete summary:', error);
    }
  }

  /**
   * Generate suggestions based on current context
   */
  private async generateSuggestions(): Promise<void> {
    if (!this.sessionId) return;

    try {
      const context = await getSessionContext(this.sessionId, 'delta', this.lastUpdateTime || undefined);

      if (context.changeCount === 0) {
        console.log('[ExampleAgent] No changes since last update');
        return;
      }

      const suggestions = this.generateSuggestionsFromContext(context);

      if (suggestions.suggestedTasks?.length || suggestions.suggestedNotes?.length) {
        await this.updateSummary(suggestions);
        console.log('[ExampleAgent] Generated suggestions:', suggestions);
      }

      this.lastUpdateTime = new Date().toISOString();
    } catch (error) {
      console.error('[ExampleAgent] Error generating suggestions:', error);
    }
  }

  /**
   * Process batched audio
   */
  private async processAudioBatch(): Promise<void> {
    if (!this.sessionId || this.audioBuffer.length === 0) return;

    console.log(`[ExampleAgent] Processing ${this.audioBuffer.length} audio segments`);

    try {
      // Concatenate transcriptions
      const fullTranscription = this.audioBuffer
        .map(seg => seg.transcription)
        .join(' ');

      // Detect keywords and generate notes
      const keywords = ['oauth', 'authentication', 'bug', 'error', 'important'];
      const foundKeywords = keywords.filter(kw =>
        fullTranscription.toLowerCase().includes(kw)
      );

      if (foundKeywords.length > 0) {
        const noteSuggestion: NoteSuggestion = {
          content: `## Audio Notes\n\n${fullTranscription.slice(0, 500)}...`,
          context: `Detected keywords: ${foundKeywords.join(', ')}`,
          confidence: 0.80,
          relevance: 0.85,
          tags: foundKeywords
        };

        await this.updateSummary({
          suggestedNotes: [noteSuggestion]
        });
      }
    } catch (error) {
      console.error('[ExampleAgent] Error processing audio batch:', error);
    }
  }

  /**
   * Handle blockers
   */
  private async handleBlockers(blockers: string[]): Promise<void> {
    if (!this.sessionId) return;

    console.log('[ExampleAgent] Handling blockers:', blockers);

    // Add to summary
    const context = await getSessionContext(this.sessionId, 'summary');
    const currentBlockers = context.currentSummary.blockers || [];

    await this.updateSummary({
      blockers: [...currentBlockers, ...blockers]
    });

    // Emit event for UI
    for (const blocker of blockers) {
      LiveSessionEventEmitter.emitContextChanged(
        this.sessionId,
        'blocker-detected',
        null,
        null,
        { blocker }
      );
    }
  }

  /**
   * Handle achievements
   */
  private async handleAchievements(achievements: string[]): Promise<void> {
    if (!this.sessionId) return;

    console.log('[ExampleAgent] Handling achievements:', achievements);

    // Add to summary
    const context = await getSessionContext(this.sessionId, 'summary');
    const currentAchievements = context.currentSummary.achievements || [];

    await this.updateSummary({
      achievements: [...currentAchievements, ...achievements]
    });

    // Emit events for celebration
    for (const achievement of achievements) {
      LiveSessionEventEmitter.emitContextChanged(
        this.sessionId,
        'achievement-detected',
        null,
        null,
        { achievement }
      );
    }
  }

  /**
   * Handle activity change
   */
  private async handleActivityChange(newActivity: string): Promise<void> {
    if (!this.sessionId) return;

    console.log('[ExampleAgent] Activity changed:', newActivity);

    // Update focus
    await this.updateSummary({
      currentFocus: newActivity
    });

    // Emit event
    LiveSessionEventEmitter.emitContextChanged(
      this.sessionId,
      'activity-switch',
      { activity: this.lastActivity },
      { activity: newActivity },
      { from: this.lastActivity, to: newActivity }
    );
  }

  /**
   * Handle activity switch event
   */
  private async handleActivitySwitch(event: ContextChangedEvent): Promise<void> {
    console.log('[ExampleAgent] Activity switch detected');
    // Could ask clarifying questions here
  }

  /**
   * Handle blocker detection event
   */
  private async handleBlockerDetected(event: ContextChangedEvent): Promise<void> {
    console.log('[ExampleAgent] Blocker detected:', event.metadata?.blocker);
    // Could suggest tasks to resolve blocker
  }

  /**
   * Handle achievement detection event
   */
  private async handleAchievementDetected(event: ContextChangedEvent): Promise<void> {
    console.log('[ExampleAgent] Achievement detected:', event.metadata?.achievement);
    // Could celebrate or suggest related next steps
  }

  /**
   * Handle focus change event
   */
  private async handleFocusChange(event: ContextChangedEvent): Promise<void> {
    console.log('[ExampleAgent] Focus changed');
    // Could update UI or ask questions
  }

  /**
   * Update summary with user answer
   */
  private async updateWithUserAnswer(question: string, answer: string): Promise<void> {
    if (!this.sessionId) return;

    // Example: Update focus based on answer
    if (question.includes('working on')) {
      await this.updateSummary({
        currentFocus: answer
      });
    }
  }

  /**
   * Analyze focus from context
   */
  private analyzeFocus(context: SummaryContext): string {
    const recent = context.recentScreenshots[0];
    if (!recent?.aiAnalysis) return "Working...";

    return recent.aiAnalysis.detectedActivity || "Working...";
  }

  /**
   * Analyze progress from context
   */
  private analyzeProgress(context: SummaryContext): string[] {
    const progress: string[] = [];

    // Extract achievements from screenshots
    context.recentScreenshots.forEach(screenshot => {
      const achievements = screenshot.aiAnalysis?.progressIndicators?.achievements || [];
      progress.push(...achievements);
    });

    return progress.slice(0, 5); // Top 5
  }

  /**
   * Analyze momentum from context
   */
  private analyzeMomentum(context: SummaryContext): 'high' | 'medium' | 'low' {
    const screenshotCount = context.recentScreenshots.length;
    const avgCuriosity = context.recentScreenshots
      .filter(s => s.aiAnalysis?.curiosity)
      .reduce((sum, s) => sum + (s.aiAnalysis?.curiosity || 0), 0) / screenshotCount;

    if (screenshotCount > 10 && avgCuriosity > 0.7) return 'high';
    if (screenshotCount > 5 || avgCuriosity > 0.5) return 'medium';
    return 'low';
  }

  /**
   * Generate suggestions from context
   */
  private generateSuggestionsFromContext(context: any): {
    suggestedTasks?: TaskSuggestion[];
    suggestedNotes?: NoteSuggestion[];
  } {
    const suggestions: {
      suggestedTasks?: TaskSuggestion[];
      suggestedNotes?: NoteSuggestion[];
    } = {};

    // Example: Generate task from blocker
    const blockers = context.progressIndicators?.blockers || [];
    if (blockers.length > 0) {
      suggestions.suggestedTasks = blockers.map((blocker: string) => ({
        title: `Resolve: ${blocker}`,
        priority: 'high' as const,
        context: 'Detected blocker in screenshot',
        confidence: 0.85,
        relevance: 0.90,
        tags: ['blocker']
      }));
    }

    // Example: Generate note from insights
    const insights = context.progressIndicators?.insights || [];
    if (insights.length > 0) {
      suggestions.suggestedNotes = [{
        content: `## Insights\n\n${insights.join('\n- ')}`,
        context: 'Key insights detected during session',
        confidence: 0.80,
        relevance: 0.85,
        tags: ['insights']
      }];
    }

    return suggestions;
  }

  /**
   * Update summary (with loop prevention)
   */
  private async updateSummary(update: any): Promise<void> {
    if (!this.sessionId || this.isUpdating) return;

    this.isUpdating = true;
    try {
      await updateLiveSessionSummary(this.sessionId, update);
      console.log('[ExampleAgent] Summary updated:', update);
    } catch (error) {
      console.error('[ExampleAgent] Error updating summary:', error);
    } finally {
      this.isUpdating = false;
    }
  }
}

/**
 * Singleton instance for easy usage
 */
let agentInstance: ExampleAIAgent | null = null;

/**
 * Get or create agent instance
 */
export function getExampleAgent(): ExampleAIAgent {
  if (!agentInstance) {
    agentInstance = new ExampleAIAgent();
  }
  return agentInstance;
}

/**
 * Start example agent for session
 */
export async function startExampleAgent(sessionId: string): Promise<void> {
  const agent = getExampleAgent();
  await agent.start(sessionId);
}

/**
 * Stop example agent
 */
export function stopExampleAgent(): void {
  if (agentInstance) {
    agentInstance.stop();
  }
}
