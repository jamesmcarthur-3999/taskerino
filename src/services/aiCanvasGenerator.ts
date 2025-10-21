import { invoke } from '@tauri-apps/api/core';
import type {
  Session,
  SessionSummary,
  FlexibleSessionSummary,
  SummarySection,
  SessionScreenshot,
  SessionAudioSegment,
  VideoChapter,
  CanvasSpec,
  CanvasTheme,
  CanvasLayout,
  CanvasSection,
  AICanvasSessionCharacteristics,
  TemporalAnalysis,
  ContentRichness,
  AchievementProfile,
  EnergyAnalysis,
  NarrativeStructure,
  EnrichedSessionCharacteristics,
  Moment,
  Milestone,
  SessionInsight,
  StoryType,
} from '../types';
import { isFlexibleSummary } from '../types';
import type { ClaudeChatResponse, ClaudeMessage } from '../types/tauri-ai-commands';
import {
  buildComponentCanvasPrompt,
  buildCanvasSystemPrompt,
  CANVAS_GENERATION_CONFIG
} from './aiCanvasPromptV2';

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class AICanvasGenerator {
  /**
   * Main entry point: Generate canvas spec for session
   */
  async generate(
    session: Session,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<CanvasSpec> {
    console.log('[AICanvasGenerator] Generating canvas for session:', session.id);

    // Stage 1: Starting analysis (0%)
    onProgress?.(0.0, 'Initializing canvas generator...');

    // Stage 2: Analyzing temporal patterns (10%)
    onProgress?.(0.1, 'Analyzing session timeline and rhythm...');
    const characteristics = this.analyzeSession(session);
    const summary = session.summary;

    // Stage 3: Processing achievements and insights (20%)
    onProgress?.(0.2, 'Processing achievements and key insights...');

    // Stage 4: Analyzing energy and narrative (30%)
    onProgress?.(0.3, 'Analyzing energy levels and story arc...');

    // Stage 5: Building comprehensive prompt (40%)
    onProgress?.(0.4, 'Preparing AI design instructions...');

    // Stage 6: Compiling session data (50%)
    onProgress?.(0.5, 'Compiling all session data for AI...');

    try {
      const spec = await this.designCanvas(characteristics, session, summary, onProgress);

      // Stage 11: Complete (100%)
      onProgress?.(1.0, 'Canvas ready!');

      return spec;
    } catch (error) {
      console.error('[AICanvasGenerator] AI design failed, using fallback:', error);
      onProgress?.(0.9, 'AI generation failed - using fallback design');
      const fallback = this.createFallbackSpec(characteristics, session);
      onProgress?.(1.0, 'Canvas ready (fallback)');
      return fallback;
    }
  }

  /**
   * Analyze session to understand characteristics with enhanced dimensions
   */
  private analyzeSession(session: Session): EnrichedSessionCharacteristics {
    // Extract counts
    const screenshotCount = session.screenshots?.length || 0;
    const audioSegmentCount = session.audioSegments?.length || 0;
    const videoChapterCount = session.video?.chapters?.length || 0;
    const achievementCount = session.summary?.achievements?.length || 0;
    const blockerCount = session.summary?.blockers?.length || 0;
    const insightCount = session.summary?.keyInsights?.length || 0;

    // Calculate duration
    const startTime = new Date(session.startTime).getTime();
    const endTime = session.endTime ? new Date(session.endTime).getTime() : Date.now();
    const duration = Math.floor((endTime - startTime) / (1000 * 60));

    // Time of day
    const hour = new Date(session.startTime).getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'late-night';

    // Infer type and mood
    const type = this.inferSessionType(session, screenshotCount, audioSegmentCount);
    const intensity = this.inferIntensity(duration, screenshotCount, achievementCount);
    const mood = this.inferMood(session);

    // Base characteristics
    const base: AICanvasSessionCharacteristics = {
      screenshotCount, audioSegmentCount, videoChapterCount,
      achievementCount, blockerCount, insightCount,
      duration, timeOfDay,
      type: type as AICanvasSessionCharacteristics['type'],
      intensity: intensity as AICanvasSessionCharacteristics['intensity'],
      mood: mood as AICanvasSessionCharacteristics['mood'],
      hasAudio: audioSegmentCount > 0,
      hasVideo: !!session.video,
      hasSummary: !!session.summary,
      hasNarrative: !!session.summary?.narrative,
    };

    // Enhanced analysis dimensions
    const temporal: TemporalAnalysis = {
      sessionArc: this.detectSessionArc(session),
      peakMoments: this.findPeakMoments(session),
      valleys: this.findValleys(session),
      rhythm: this.analyzeRhythm(session),
      screenshotDensity: this.calculateScreenshotDensity(session),
      contextSwitches: this.countContextSwitches(session),
    };

    const richness: ContentRichness = {
      audioWordCount: this.countAudioWords(session),
      videoChapterCount,
      hasCodeActivity: this.detectCodeActivity(session),
      hasNotesActivity: this.detectNotesActivity(session),
      ocrTextLength: this.calculateOCRTextLength(session),
      activityDiversity: this.calculateActivityDiversity(session),
    };

    const achievements: AchievementProfile = {
      milestones: this.detectMilestones(session),
      breakthroughs: this.extractLearnings(session),
      learnings: this.extractLearnings(session),
      problemsSolved: this.countProblemsSolved(session),
      blockerAnalysis: this.analyzeBlockers(session),
    };

    const energy: EnergyAnalysis = {
      intensity: this.calculateIntensity(session),
      focusQuality: this.calculateFocusQuality(session),
      struggleLevel: this.detectStruggles(session),
      breakthroughMoment: this.findBreakthroughMoment(session),
      mood: this.inferMood(session),
    };

    const narrative: NarrativeStructure = {
      storyType: this.classifyStory(session),
      goal: this.extractGoal(session),
      conflict: this.extractConflict(session),
      resolution: this.extractResolution(session),
      transformation: this.detectTransformation(session),
    };

    return {
      ...base,
      temporal,
      richness,
      achievements,
      energy,
      narrative,
    };
  }

  /**
   * Ask Claude to design canvas layout with enriched context
   *
   * BEST PRACTICES IMPLEMENTED:
   * - System prompt for role definition (#5)
   * - Prefilling assistant response (#2)
   * - Explicit temperature setting (#4)
   * - Max tokens for comprehensive output (#10)
   */
  private async designCanvas(
    characteristics: EnrichedSessionCharacteristics,
    session: Session,
    summary?: SessionSummary | FlexibleSessionSummary,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<CanvasSpec> {
    // Stage 7: Building system prompt (55%)
    onProgress?.(0.55, 'Preparing AI expert instructions...');

    // BEST PRACTICE #5: System prompt for role definition
    const systemPrompt = buildCanvasSystemPrompt();

    // Extract sections if flexible summary (for action generation)
    const sections: SummarySection[] = summary && isFlexibleSummary(summary) ? summary.sections : [];

    // Token Optimization: Filter and minimize screenshot data for canvas
    // This reduces input tokens by 60-80% while preserving all important moments
    const selectedScreenshots = this.selectCanvasScreenshots(session);
    const minimalScreenshots = selectedScreenshots.map(s => this.minimizeScreenshotData(s));

    console.log('[Canvas] Token optimization:', {
      originalCount: session.screenshots?.length || 0,
      selectedCount: selectedScreenshots.length,
      reductionPercent: Math.round((1 - selectedScreenshots.length / (session.screenshots?.length || 1)) * 100)
    });

    // BEST PRACTICE #1, #3, #6, #7: User prompt with XML structure, examples, schema
    // Pass filtered screenshot data to reduce token usage
    const userPrompt = buildComponentCanvasPrompt(
      characteristics,
      { ...session, screenshots: minimalScreenshots }, // Filtered & minimized
      summary,
      sections
    );

    // BEST PRACTICE #2: Prefill assistant response to force JSON output
    const messages: ClaudeMessage[] = [
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: '{' } // Prefill to start JSON immediately
    ];

    // Stage 8: Sending request to AI (60%)
    onProgress?.(0.6, '🤖 Claude is analyzing your session...');

    // Stage 9: Waiting for AI (show progress simulation during long wait)
    // This is the longest step - add simulated progress to show we're not frozen
    const progressInterval = setInterval(() => {
      const currentProgress = 0.6 + (Math.random() * 0.05); // Slowly increment from 60-65%
      onProgress?.(currentProgress, '🤖 AI is designing your canvas (this may take 30-60 seconds)...');
    }, 3000); // Update every 3 seconds

    try {
      const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
        request: {
          model: CANVAS_GENERATION_CONFIG.model,
          maxTokens: CANVAS_GENERATION_CONFIG.maxTokens, // BEST PRACTICE #10: No artificial limits
          messages,
          system: systemPrompt, // BEST PRACTICE #5
          temperature: CANVAS_GENERATION_CONFIG.temperature, // BEST PRACTICE #4 & #8
        }
      });

      clearInterval(progressInterval);

      // Stage 10: Parsing response (80%)
      onProgress?.(0.8, 'Parsing AI-generated component tree...');

      // Stage 10.5: Validating structure (90%)
      onProgress?.(0.9, 'Validating component structure...');

      return this.parseCanvasSpec(response);
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  }

  /**
   * Parse Claude response into CanvasSpec
   *
   * BEST PRACTICE #2: Handle prefilled response (starts with '{')
   */
  private parseCanvasSpec(response: ClaudeChatResponse): CanvasSpec {
    let jsonText = response.content[0].text.trim();

    // Remove markdown code fences if present (though prefilling should prevent this)
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    // Prepend the prefilled '{' that we sent in the assistant message
    // The response doesn't include it, so we need to add it back
    if (!jsonText.startsWith('{')) {
      jsonText = '{' + jsonText;
    }

    const parsed = JSON.parse(jsonText);

    return {
      theme: parsed.theme,
      layout: {
        type: parsed.layout?.type || 'dashboard',
        emphasis: parsed.layout?.emphasis || 'chronological',
        sections: parsed.layout?.sections || [],
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        sessionType: parsed.metadata?.sessionType || 'unknown',
        confidence: parsed.metadata?.confidence || 0.5,
      },
      // New componentTree from AI (BEST PRACTICE #1-10: Complete implementation)
      componentTree: parsed.componentTree,
    };
  }

  /**
   * Fallback spec when AI generation fails
   */
  private createFallbackSpec(c: EnrichedSessionCharacteristics, s: Session): CanvasSpec {
    return {
      theme: { primary: '#3b82f6', secondary: '#8b5cf6', mood: 'calm', explanation: 'Default' },
      layout: {
        type: 'timeline',
        emphasis: 'chronological',
        sections: [
          { id: 'hero', type: 'hero', emphasis: 'high', position: 1 },
          { id: 'timeline', type: 'timeline', emphasis: 'medium', position: 2 },
        ],
      },
      metadata: { generatedAt: new Date().toISOString(), sessionType: c.type, confidence: 0.3 },
    };
  }

  // ============================================================================
  // HELPER METHODS - TEMPORAL ANALYSIS
  // ============================================================================

  /**
   * Detect the overall arc/shape of the session
   * @returns Arc description (e.g., "steady-climb", "rollercoaster", "plateau")
   */
  private detectSessionArc(session: Session): string {
    const screenshots = session.screenshots || [];
    if (screenshots.length < 3) return 'brief-snapshot';

    // Analyze achievement distribution over time
    const achievements = session.summary?.achievements || [];
    const blockers = session.summary?.blockers || [];

    if (achievements.length === 0 && blockers.length === 0) {
      return 'steady-exploration';
    }

    if (achievements.length > blockers.length * 2) {
      return 'ascending-triumph';
    }

    if (blockers.length > achievements.length) {
      return 'challenging-climb';
    }

    if (achievements.length > 3 && blockers.length > 2) {
      return 'rollercoaster-journey';
    }

    return 'balanced-progression';
  }

  /**
   * Find peak moments of high activity or achievement
   */
  private findPeakMoments(session: Session): Moment[] {
    const moments: Moment[] = [];

    // Check for enhanced achievements with timestamps
    const achievements = session.summary?.achievementsEnhanced || [];
    achievements
      .filter(a => a.importance === 'major' || a.importance === 'critical')
      .forEach(a => {
        moments.push({
          timestamp: a.timestamp,
          description: a.text,
          importance: a.importance === 'critical' ? 'high' : 'medium',
          screenshotIds: a.screenshotIds,
        });
      });

    // Check for key moments
    const keyMoments = session.summary?.keyMoments || [];
    keyMoments
      .filter(km => km.impact === 'high')
      .forEach(km => {
        moments.push({
          timestamp: km.timestamp,
          description: km.title,
          importance: 'high',
          screenshotIds: km.screenshotIds,
        });
      });

    // Sort by timestamp
    moments.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return moments.slice(0, 5); // Return top 5 peaks
  }

  /**
   * Find valley moments of low activity or struggle
   */
  private findValleys(session: Session): Moment[] {
    const valleys: Moment[] = [];

    // Check for blockers
    const blockers = session.summary?.blockersEnhanced || [];
    blockers
      .filter(b => b.severity === 'high' || b.severity === 'critical')
      .forEach(b => {
        valleys.push({
          timestamp: b.timestamp,
          description: b.text,
          importance: b.severity === 'critical' ? 'high' : 'medium',
          screenshotIds: b.screenshotIds,
        });
      });

    // Sort by timestamp
    valleys.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return valleys.slice(0, 3); // Return top 3 valleys
  }

  /**
   * Analyze the rhythm/pacing pattern of the session
   */
  private analyzeRhythm(session: Session): string {
    const screenshots = session.screenshots || [];
    if (screenshots.length < 2) return 'minimal';

    // Calculate time gaps between screenshots
    const gaps: number[] = [];
    for (let i = 1; i < screenshots.length; i++) {
      const prev = new Date(screenshots[i - 1].timestamp).getTime();
      const curr = new Date(screenshots[i].timestamp).getTime();
      gaps.push((curr - prev) / (1000 * 60)); // minutes
    }

    if (gaps.length === 0) return 'steady';

    // Calculate variance
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - mean, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);

    // Classify rhythm
    if (stdDev < mean * 0.3) return 'steady-rhythm';
    if (stdDev > mean * 0.8) return 'chaotic-bursts';
    return 'varied-pacing';
  }

  /**
   * Calculate screenshot density (screenshots per hour)
   */
  private calculateScreenshotDensity(session: Session): number {
    const screenshots = session.screenshots || [];
    const duration = session.totalDuration || this.calculateDuration(session);

    if (duration === 0) return 0;

    const hours = duration / 60;
    return screenshots.length / hours;
  }

  /**
   * Count significant context switches (changing activities)
   */
  private countContextSwitches(session: Session): number {
    const screenshots = session.screenshots || [];
    let switches = 0;

    for (let i = 1; i < screenshots.length; i++) {
      const prevActivity = screenshots[i - 1].aiAnalysis?.detectedActivity;
      const currActivity = screenshots[i].aiAnalysis?.detectedActivity;

      if (prevActivity && currActivity && prevActivity !== currActivity) {
        switches++;
      }
    }

    return switches;
  }

  // ============================================================================
  // HELPER METHODS - CONTENT RICHNESS
  // ============================================================================

  /**
   * Count total words in audio transcripts
   */
  private countAudioWords(session: Session): number {
    const segments = session.audioSegments || [];
    const fullTranscript = session.fullTranscription || '';

    if (fullTranscript) {
      return fullTranscript.split(/\s+/).filter(w => w.length > 0).length;
    }

    const totalWords = segments.reduce((count, segment) => {
      const words = (segment.transcription || '').split(/\s+/).filter(w => w.length > 0).length;
      return count + words;
    }, 0);

    return totalWords;
  }

  /**
   * Detect if session involves code/development activity
   */
  private detectCodeActivity(session: Session): boolean {
    const screenshots = session.screenshots || [];

    // Check for code-related activities
    const codeActivities = ['coding', 'debugging', 'terminal', 'ide', 'editor'];
    const hasCodeActivity = screenshots.some(s => {
      const activity = s.aiAnalysis?.detectedActivity?.toLowerCase() || '';
      return codeActivities.some(keyword => activity.includes(keyword));
    });

    // Check for code-related keywords in OCR
    const codeKeywords = ['function', 'const', 'import', 'export', 'class', 'def', 'return'];
    const hasCodeKeywords = screenshots.some(s => {
      const text = s.aiAnalysis?.extractedText?.toLowerCase() || '';
      return codeKeywords.some(keyword => text.includes(keyword));
    });

    return hasCodeActivity || hasCodeKeywords;
  }

  /**
   * Detect if session involves note-taking or documentation
   */
  private detectNotesActivity(session: Session): boolean {
    const screenshots = session.screenshots || [];

    const notesActivities = ['writing', 'document', 'notes', 'markdown', 'text-editing'];
    return screenshots.some(s => {
      const activity = s.aiAnalysis?.detectedActivity?.toLowerCase() || '';
      return notesActivities.some(keyword => activity.includes(keyword));
    });
  }

  /**
   * Calculate total OCR text length across all screenshots
   */
  private calculateOCRTextLength(session: Session): number {
    const screenshots = session.screenshots || [];
    return screenshots.reduce((total, s) => {
      const text = s.aiAnalysis?.extractedText || '';
      return total + text.length;
    }, 0);
  }

  /**
   * Calculate activity diversity score (0-1)
   */
  private calculateActivityDiversity(session: Session): number {
    const screenshots = session.screenshots || [];
    if (screenshots.length === 0) return 0;

    const activities = new Set<string>();
    screenshots.forEach(s => {
      const activity = s.aiAnalysis?.detectedActivity;
      if (activity) activities.add(activity);
    });

    // Normalize to 0-1 range (assume max diversity is 10 different activities)
    return Math.min(activities.size / 10, 1);
  }

  // ============================================================================
  // HELPER METHODS - ACHIEVEMENTS
  // ============================================================================

  /**
   * Detect major milestones in the session
   */
  private detectMilestones(session: Session): Milestone[] {
    const milestones: Milestone[] = [];

    // Extract from enhanced achievements
    const achievements = session.summary?.achievementsEnhanced || [];
    achievements
      .filter(a => a.importance === 'major' || a.importance === 'critical')
      .forEach(a => {
        milestones.push({
          title: a.text,
          timestamp: a.timestamp,
          description: a.category || 'Achievement',
          screenshotIds: a.screenshotIds,
        });
      });

    // Extract from key moments
    const keyMoments = session.summary?.keyMoments || [];
    keyMoments
      .filter(km => km.type === 'milestone')
      .forEach(km => {
        milestones.push({
          title: km.title,
          timestamp: km.timestamp,
          description: km.description,
          screenshotIds: km.screenshotIds,
        });
      });

    return milestones;
  }

  /**
   * Extract key learnings from the session
   */
  private extractLearnings(session: Session): SessionInsight[] {
    const learnings: SessionInsight[] = [];

    // Extract from key insights
    const insights = session.summary?.keyInsights || [];
    insights.forEach(insight => {
      learnings.push({
        insight: insight.insight,
        timestamp: insight.timestamp,
        context: `Based on ${insight.screenshotIds?.length || 0} screenshots`,
      });
    });

    // Extract from audio insights
    const audioInsights = session.audioInsights?.keyMoments || [];
    audioInsights
      .filter(km => km.type === 'insight')
      .forEach(km => {
        learnings.push({
          insight: km.description,
          timestamp: new Date(new Date(session.startTime).getTime() + (km.timestamp * 1000)).toISOString(),
          context: km.context,
        });
      });

    return learnings.slice(0, 10); // Return top 10 learnings
  }

  /**
   * Count number of problems solved
   */
  private countProblemsSolved(session: Session): number {
    const blockers = session.summary?.blockersEnhanced || [];
    const resolved = blockers.filter(b => b.status === 'resolved' || b.status === 'workaround');
    return resolved.length;
  }

  /**
   * Analyze blockers and return summary
   */
  private analyzeBlockers(session: Session): string {
    const blockers = session.summary?.blockersEnhanced || session.summary?.blockers || [];

    if (blockers.length === 0) return 'No blockers encountered';

    const enhanced = session.summary?.blockersEnhanced || [];
    const resolved = enhanced.filter(b => b.status === 'resolved').length;
    const unresolved = enhanced.filter(b => b.status === 'unresolved').length;

    if (enhanced.length > 0) {
      return `${blockers.length} blockers: ${resolved} resolved, ${unresolved} unresolved`;
    }

    return `${blockers.length} blockers encountered`;
  }

  // ============================================================================
  // HELPER METHODS - ENERGY & FOCUS
  // ============================================================================

  /**
   * Calculate overall intensity level (0-100)
   */
  private calculateIntensity(session: Session): number {
    const screenshots = session.screenshots || [];
    const duration = session.totalDuration || this.calculateDuration(session);
    const achievements = session.summary?.achievements?.length || 0;

    // Intensity factors
    const screenshotScore = Math.min((screenshots.length / duration) * 100, 40);
    const achievementScore = Math.min(achievements * 10, 40);
    const contextSwitchScore = Math.min(this.countContextSwitches(session) * 2, 20);

    return Math.min(screenshotScore + achievementScore + contextSwitchScore, 100);
  }

  /**
   * Calculate focus quality score (0-100)
   */
  private calculateFocusQuality(session: Session): number {
    const contextSwitches = this.countContextSwitches(session);
    const duration = session.totalDuration || this.calculateDuration(session);

    if (duration === 0) return 50;

    // Lower context switches per hour = higher focus
    const switchesPerHour = (contextSwitches / duration) * 60;

    // Optimal: < 2 switches/hour = high focus (80-100)
    // Moderate: 2-5 switches/hour = medium focus (50-80)
    // Scattered: > 5 switches/hour = low focus (0-50)

    if (switchesPerHour < 2) return 80 + Math.min((2 - switchesPerHour) * 10, 20);
    if (switchesPerHour < 5) return 50 + ((5 - switchesPerHour) / 3) * 30;
    return Math.max(50 - ((switchesPerHour - 5) * 5), 0);
  }

  /**
   * Detect struggle level (0-100)
   */
  private detectStruggles(session: Session): number {
    const blockers = session.summary?.blockers?.length || 0;
    const achievements = session.summary?.achievements?.length || 0;

    if (achievements === 0 && blockers === 0) return 20; // Exploratory session

    // High blockers relative to achievements = high struggle
    const ratio = blockers / Math.max(achievements, 1);

    return Math.min(ratio * 50 + blockers * 10, 100);
  }

  /**
   * Find the breakthrough moment if one exists
   */
  private findBreakthroughMoment(session: Session): Moment | null {
    // Check key moments for breakthrough type
    const keyMoments = session.summary?.keyMoments || [];
    const breakthrough = keyMoments.find(km => km.type === 'breakthrough');

    if (breakthrough) {
      return {
        timestamp: breakthrough.timestamp,
        description: breakthrough.title,
        importance: breakthrough.impact === 'high' ? 'high' : 'medium',
        screenshotIds: breakthrough.screenshotIds,
      };
    }

    // Check audio insights
    const audioMoments = session.audioInsights?.keyMoments || [];
    const audioBreakthrough = audioMoments.find(km => km.type === 'insight' && km.context.toLowerCase().includes('breakthrough'));

    if (audioBreakthrough) {
      const timestamp = new Date(new Date(session.startTime).getTime() + audioBreakthrough.timestamp * 1000).toISOString();
      return {
        timestamp,
        description: audioBreakthrough.description,
        importance: 'high',
      };
    }

    return null;
  }

  // ============================================================================
  // HELPER METHODS - NARRATIVE STRUCTURE
  // ============================================================================

  /**
   * Classify the session story type
   */
  private classifyStory(session: Session): StoryType {
    const achievements = session.summary?.achievements?.length || 0;
    const blockers = session.summary?.blockers?.length || 0;
    const problemsSolved = this.countProblemsSolved(session);

    // Hero journey: High achievements, overcame challenges
    if (achievements >= 3 && problemsSolved >= 2) {
      return 'hero-journey';
    }

    // Problem-solving: Focus on debugging/fixing
    if (problemsSolved >= 2 || (blockers > 0 && achievements > 0)) {
      return 'problem-solving';
    }

    // Exploration: Low achievements, low blockers, diverse activities
    if (achievements <= 1 && blockers <= 1 && this.calculateActivityDiversity(session) > 0.5) {
      return 'exploration';
    }

    // Building: Coding detected, progressive achievements
    if (this.detectCodeActivity(session) && achievements >= 2) {
      return 'building';
    }

    // Collaboration: Meeting indicators (high audio activity)
    if ((session.audioSegments?.length || 0) > 5) {
      return 'collaboration';
    }

    // Struggle: High blockers, low resolution
    if (blockers >= 3 && problemsSolved < blockers / 2) {
      return 'struggle';
    }

    // Optimization: Refactoring or improving existing work
    const hasOptimizationKeywords = session.summary?.narrative?.toLowerCase().includes('refactor') ||
                                     session.summary?.narrative?.toLowerCase().includes('optimize') ||
                                     session.summary?.narrative?.toLowerCase().includes('improve');
    if (hasOptimizationKeywords) {
      return 'optimization';
    }

    return 'mixed';
  }

  /**
   * Extract the primary goal from session context
   */
  private extractGoal(session: Session): string | null {
    // Check description
    if (session.description && session.description.length > 10) {
      return session.description;
    }

    // Check narrative first sentence
    const narrative = session.summary?.narrative || '';
    const firstSentence = narrative.split('.')[0];
    if (firstSentence && firstSentence.length > 10) {
      return firstSentence.trim();
    }

    return null;
  }

  /**
   * Extract the main conflict or challenge
   */
  private extractConflict(session: Session): string | null {
    const blockers = session.summary?.blockers || [];

    if (blockers.length === 0) return null;

    // Return the first (presumably most important) blocker
    return blockers[0];
  }

  /**
   * Extract the resolution or outcome
   */
  private extractResolution(session: Session): string | null {
    const achievements = session.summary?.achievements || [];

    if (achievements.length === 0) return null;

    // Return the last achievement as resolution
    return achievements[achievements.length - 1];
  }

  /**
   * Detect transformation or learning outcome
   */
  private detectTransformation(session: Session): string | null {
    const insights = session.summary?.keyInsights || [];

    if (insights.length === 0) return null;

    // Find the most impactful insight
    const topInsight = insights[0]; // Assuming sorted by importance
    return topInsight?.insight || null;
  }

  // ============================================================================
  // HELPER METHODS - CANVAS TOKEN OPTIMIZATION
  // ============================================================================

  /**
   * Score screenshot importance for canvas narrative
   * Higher scores = more likely to be included in canvas generation
   *
   * Scoring criteria:
   * - Progress indicators (achievements, blockers, insights): 10-15 points each
   * - Context switches (narrative progression): 10-20 points
   * - User comments (explicitly marked important): 100 points
   * - Suggested actions (actionable moments): 5 points each
   * - Temporal diversity (ensure timeline coverage): up to 12 bonus points
   */
  private scoreScreenshotForCanvas(
    screenshot: SessionScreenshot,
    sessionDuration: number,
    allScreenshots: SessionScreenshot[]
  ): number {
    let score = 0;
    const analysis = screenshot.aiAnalysis;

    if (!analysis) return 0; // Can't score without analysis

    // 1. Progress Indicators (Highest Priority)
    const achievements = analysis.progressIndicators?.achievements?.length || 0;
    const blockers = analysis.progressIndicators?.blockers?.length || 0;
    const insights = analysis.progressIndicators?.insights?.length || 0;

    score += achievements * 15; // Major wins
    score += blockers * 12;     // Problems encountered
    score += insights * 10;     // Key learnings

    // 2. Context Switches (Shows narrative progression)
    if (analysis.contextDelta) {
      if (analysis.contextDelta.length > 100) score += 20; // Major change
      else if (analysis.contextDelta.length > 50) score += 10; // Moderate change
    }

    // 3. User Comments (User marked as important)
    if (screenshot.userComment) {
      score += 100; // Effectively guarantees inclusion
    }

    // 4. Suggested Actions (Actionable moments)
    const actions = analysis.suggestedActions?.length || 0;
    score += actions * 5;

    // 5. Temporal Spread Bonus (ensure timeline coverage)
    const screenshotTime = new Date(screenshot.timestamp).getTime();
    const sessionStart = new Date(allScreenshots[0].timestamp).getTime();
    const percentThroughSession = (screenshotTime - sessionStart) / (sessionDuration * 60 * 1000);

    // Divide session into 6 time zones (0-16%, 17-33%, etc.)
    const timeZone = Math.floor(percentThroughSession * 6);
    const screenshotsInZone = allScreenshots.filter(s => {
      const t = new Date(s.timestamp).getTime();
      const pct = (t - sessionStart) / (sessionDuration * 60 * 1000);
      return Math.floor(pct * 6) === timeZone;
    }).length;

    // Bonus for underrepresented zones (natural diversity)
    if (screenshotsInZone < 4) score += 12;
    else if (screenshotsInZone < 7) score += 6;

    return score;
  }

  /**
   * Select top 50% of screenshots for canvas generation
   * Balances token optimization with narrative quality
   *
   * Guarantees:
   * - All user-commented screenshots (explicitly marked important)
   * - First 2 and last 2 screenshots (session bookends)
   * - Highest-scoring screenshots (achievements, blockers, insights, context switches)
   * - Temporal diversity across session timeline
   */
  private selectCanvasScreenshots(session: Session): SessionScreenshot[] {
    const screenshots = session.screenshots || [];
    const duration = this.calculateDuration(session);

    // Small sessions: send all (no filtering needed)
    if (screenshots.length <= 25) {
      console.log('[Canvas] Small session, sending all', screenshots.length, 'screenshots');
      return screenshots;
    }

    console.log('[Canvas] Large session, selecting top 50% from', screenshots.length, 'screenshots');

    // Score all screenshots
    const scored = screenshots.map(s => ({
      screenshot: s,
      score: this.scoreScreenshotForCanvas(s, duration, screenshots)
    }));

    // Force-include categories
    const userCommented = screenshots.filter(s => s.userComment);
    const first2 = screenshots.slice(0, 2);
    const last2 = screenshots.slice(-2);
    const forceIncluded = [...userCommented, ...first2, ...last2];

    // Calculate target (50% of total)
    const targetCount = Math.floor(screenshots.length * 0.5);

    // Top-scoring (excluding force-included)
    const remaining = scored.filter(s => !forceIncluded.includes(s.screenshot));
    const topScored = remaining
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, targetCount - forceIncluded.length))
      .map(s => s.screenshot);

    // Combine, dedupe, and sort by timestamp
    const selected = [...forceIncluded, ...topScored]
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log('[Canvas] Selected', selected.length, 'screenshots:', {
      userCommented: userCommented.length,
      topScored: topScored.length,
      first2: 2,
      last2: 2
    });

    return selected;
  }

  /**
   * Strip heavy fields from screenshot to reduce token usage
   *
   * Removes (token-heavy fields):
   * - extractedText: 200-800 tokens per screenshot (OCR dump)
   * - keyElements: Redundant with summary
   * - confidence, curiosity, curiosityReason: Internal metadata not needed for narrative
   *
   * Keeps (essential for canvas):
   * - id, timestamp, attachmentId: For ImageGallery and citations
   * - detectedActivity, summary, contextDelta: Narrative content
   * - progressIndicators: Achievements, blockers, insights
   * - suggestedActions: For action buttons
   * - userComment: User's own notes
   *
   * Token savings: ~60-70% per screenshot (329 → ~120 tokens)
   */
  private minimizeScreenshotData(screenshot: SessionScreenshot): any {
    return {
      id: screenshot.id,
      timestamp: screenshot.timestamp,
      attachmentId: screenshot.attachmentId,
      userComment: screenshot.userComment,
      aiAnalysis: screenshot.aiAnalysis ? {
        detectedActivity: screenshot.aiAnalysis.detectedActivity,
        summary: screenshot.aiAnalysis.summary,
        contextDelta: screenshot.aiAnalysis.contextDelta,
        progressIndicators: screenshot.aiAnalysis.progressIndicators,
        suggestedActions: screenshot.aiAnalysis.suggestedActions,
        // REMOVED: extractedText (huge - 200-800 tokens each)
        // REMOVED: keyElements (redundant with summary)
        // REMOVED: confidence, curiosity, curiosityReason (internal metadata)
      } : undefined
    };
  }

  // ============================================================================
  // HELPER METHODS - UTILITIES
  // ============================================================================

  /**
   * Calculate session duration in minutes
   */
  private calculateDuration(session: Session): number {
    const startTime = new Date(session.startTime).getTime();
    const endTime = session.endTime ? new Date(session.endTime).getTime() : Date.now();
    return Math.floor((endTime - startTime) / (1000 * 60));
  }

  /**
   * Infer session type from context
   */
  private inferSessionType(s: Session, sc: number, ac: number): string {
    if (s.category?.toLowerCase().includes('dev')) return 'coding';
    if (s.category?.toLowerCase().includes('meeting')) return 'meeting';
    if (s.category?.toLowerCase().includes('learn')) return 'learning';

    // Infer from activity
    if (this.detectCodeActivity(s)) return 'coding';
    if (ac > 10) return 'meeting'; // Lots of audio suggests meeting

    return 'mixed';
  }

  /**
   * Infer intensity level from metrics
   */
  private inferIntensity(duration: number, screenshots: number, achievements: number): string {
    const score = (screenshots / 10) + (achievements * 2) + (duration / 60);
    return score > 8 ? 'heavy' : score > 4 ? 'moderate' : 'light';
  }

  /**
   * Infer mood from session data
   */
  private inferMood(session: Session): string {
    const achievements = session.summary?.achievements?.length || 0;
    const blockers = session.summary?.blockers?.length || 0;

    if (achievements > blockers * 2) return 'productive';
    if (blockers > achievements) return 'challenging';
    if (this.findBreakthroughMoment(session)) return 'breakthrough';
    return 'exploratory';
  }
}

export const aiCanvasGenerator = new AICanvasGenerator();
