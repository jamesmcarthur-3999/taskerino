import { invoke } from '@tauri-apps/api/core';
import type { Session, SessionScreenshot, SessionAudioSegment, Note, VideoChapter, AudioInsights } from '../types';
import type {
  ClaudeChatResponse,
  ClaudeMessage,
  ClaudeContentBlock,
  ClaudeImageSource,
} from '../types/tauri-ai-commands';
import { stripHtmlTags } from '../utils/helpers';
import { debug } from "../utils/debug";


/**
 * SessionsAgentService
 *
 * Background AI worker that analyzes screenshots during sessions.
 * - Uses Claude's vision API to understand what the user is doing
 * - Maintains sliding window context (last 5 screenshots + summaries)
 * - Extracts tasks, notes, and insights from screenshots
 * - Updates session tracking note with cumulative information
 */
export class SessionsAgentService {
  private hasApiKey: boolean = false;
  private contextWindow: SessionScreenshot[] = [];
  private contextWindowSize: number = 5;
  private sessionSummaries: Map<string, string> = new Map();

  constructor() {
    console.log('🚀 SessionsAgent: Constructor called');
    this.loadApiKeyFromStorage();
  }

  private async loadApiKeyFromStorage() {
    try {
      const savedKey = await invoke<string | null>('get_claude_api_key');
      console.log('📦 SessionsAgent: Loading API key from Tauri storage', {
        hasKey: !!savedKey,
        keyPrefix: savedKey?.substring(0, 7),
        keyLength: savedKey?.length
      });

      if (savedKey && savedKey.trim()) {
        this.hasApiKey = true;
        debug.log(debug.log(console.log('✅ SessionsAgent: Loaded API key from storage')));
      } else {
        console.warn('⚠️  SessionsAgent: No API key found in storage');
      }
    } catch (error) {
      console.error('❌ SessionsAgent: Failed to load API key from storage:', error);
    }
  }

  async setApiKey(apiKey: string) {
    if (!apiKey || !apiKey.trim()) {
      console.error('❌ SessionsAgent: Attempted to set empty API key');
      return;
    }

    console.log('🔑 SessionsAgent: Setting API key...', {
      keyPrefix: apiKey.substring(0, 7),
      keyLength: apiKey.length,
      startsWithSkAnt: apiKey.startsWith('sk-ant-')
    });

    try {
      await invoke('set_claude_api_key', { apiKey: apiKey.trim() });
      this.hasApiKey = true;
      debug.log(console.log('✅ SessionsAgent: API key set successfully'));
    } catch (error) {
      console.error('❌ SessionsAgent: Failed to set API key:', error);
      throw error;
    }
  }

  /**
   * Analyze a screenshot and return insights
   *
   * OPTIMIZED: Now uses Smart API Usage service for:
   * - Image compression (WebP @ 80%, 40-60% size reduction)
   * - Model selection (Haiku 4.5 for real-time)
   * - Cost tracking (backend logging)
   * - 1.5-2.5s latency per screenshot
   */
  async analyzeScreenshot(
    screenshot: SessionScreenshot,
    session: Session,
    screenshotBase64: string,
    mimeType: string = 'image/jpeg'
  ): Promise<SessionScreenshot['aiAnalysis']> {
    console.log('🔍 SessionsAgent: analyzeScreenshot called', {
      hasApiKey: this.hasApiKey,
      screenshotId: screenshot.id,
      hasBase64Data: !!screenshotBase64 && screenshotBase64.length > 0,
      mimeType
    });

    if (!this.hasApiKey) {
      console.error('❌ SessionsAgent: API key not set');
      throw new Error('API key not set. Please configure your Claude API key in Settings.');
    }

    try {
      console.log(`🔍 SessionsAgent: Analyzing screenshot ${screenshot.id}...`);

      // Add to context window
      this.addToContextWindow(screenshot);

      // Get session context for Smart API
      const sessionContext = {
        sessionId: session.id,
        sessionName: session.name,
        description: session.description,
        recentActivity: this.buildSessionContext(session),
      };

      // Use Smart API Usage service for optimized analysis
      // This handles:
      // - Image compression (WebP @ 80%)
      // - Model selection (Haiku 4.5)
      // - Cost tracking
      const { smartAPIUsage } = await import('./smartAPIUsage');

      const analysis = await smartAPIUsage.analyzeScreenshotRealtime(
        screenshot,
        sessionContext,
        screenshotBase64,
        mimeType
      );

      console.log('✅ SessionsAgent: Screenshot analysis complete (via Smart API)', {
        activity: analysis.detectedActivity,
        confidence: analysis.confidence,
        keyElements: analysis.keyElements?.length || 0,
        achievements: analysis.progressIndicators?.achievements?.length || 0,
        blockers: analysis.progressIndicators?.blockers?.length || 0,
      });

      // Store summary for context
      this.sessionSummaries.set(screenshot.id, analysis.summary);

      // Return in SessionScreenshot['aiAnalysis'] format
      return {
        summary: analysis.summary,
        detectedActivity: analysis.detectedActivity,
        extractedText: analysis.extractedText,
        keyElements: analysis.keyElements,
        suggestedActions: analysis.suggestedActions,
        contextDelta: analysis.contextDelta,
        confidence: analysis.confidence,
        curiosity: analysis.curiosity,
        curiosityReason: analysis.curiosityReason,
        progressIndicators: analysis.progressIndicators,
      };
    } catch (error) {
      console.error('❌ SessionsAgent: Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Generate a cumulative session summary with enhanced video chapters and audio insights
   *
   * This method synthesizes data from multiple sources to create a comprehensive session summary:
   * - Screenshots: Visual snapshots of the user's work
   * - Audio segments: Transcribed speech and ambient audio
   * - Video chapters: AI-detected narrative structure and key topic boundaries
   * - Audio insights: Deep analysis of emotional journey, work patterns, and key moments
   *
   * @param session - The session to analyze
   * @param screenshots - Array of session screenshots with AI analysis
   * @param audioSegments - Array of audio transcriptions and descriptions (default: [])
   * @param context - Optional context for enhanced analysis
   * @param context.existingCategories - Existing category labels for consistency
   * @param context.existingSubCategories - Existing sub-category labels for consistency
   * @param context.existingTags - Existing tags for consistency
   * @param context.videoChapters - AI-detected video chapters showing narrative structure (default: undefined)
   * @param context.audioInsights - Comprehensive audio analysis including emotional journey and key moments (default: undefined)
   *
   * @returns Enhanced session summary with narrative structure and work context
   *
   * @example
   * ```typescript
   * const summary = await sessionsAgentService.generateSessionSummary(
   *   session,
   *   screenshots,
   *   audioSegments,
   *   {
   *     videoChapters: chapters,
   *     audioInsights: insights,
   *     existingTags: ['development', 'debugging']
   *   }
   * );
   * console.log(summary.narrativeStructure?.overallArc);
   * console.log(summary.workContext?.emotionalState);
   * ```
   */
  async generateSessionSummary(
    session: Session,
    screenshots: SessionScreenshot[],
    audioSegments: SessionAudioSegment[] = [],
    context?: {
      existingCategories?: string[];
      existingSubCategories?: string[];
      existingTags?: string[];
      videoChapters?: VideoChapter[];
      audioInsights?: AudioInsights;
    }
  ): Promise<{
    narrative: string;
    achievements: string[];
    blockers: string[];
    recommendedTasks: Array<{
      title: string;
      context: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      relatedScreenshotIds: string[];
    }>;
    keyInsights: Array<{
      insight: string;
      timestamp: string;
      screenshotIds: string[];
    }>;
    focusAreas: Array<{
      area: string;
      duration: number; // minutes
      percentage: number;
    }>;
    lastUpdated: string;
    screenshotCount: number;
    category: string;
    subCategory: string;
    tags: string[];
    narrativeStructure?: {
      chapters: Array<{
        title: string;
        timeRange: string;
        summary: string;
        keyTopics: string[];
      }>;
      overallArc: string;
    };
    workContext?: {
      emotionalState: string;
      focusQuality: string;
      keyMoments: Array<{
        time: string;
        type: string;
        description: string;
      }>;
    };
  }> {
    if (!this.hasApiKey) {
      throw new Error('API key not set. Please configure your Claude API key in Settings.');
    }

    console.log(`📊 SessionsAgent: Generating session summary for "${session.name}"...`);

    try {
      // Merge screenshots and audio segments chronologically
      type TimelineItem =
        | { type: 'screenshot'; timestamp: string; data: SessionScreenshot }
        | { type: 'audio'; timestamp: string; data: SessionAudioSegment };

      const timelineItems: TimelineItem[] = [
        ...screenshots
          .filter(s => s.aiAnalysis)
          .map(s => ({ type: 'screenshot' as const, timestamp: s.timestamp, data: s })),
        ...audioSegments
          .map(a => ({ type: 'audio' as const, timestamp: a.timestamp, data: a }))
      ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Collect all analyses (screenshots + audio transcripts)
      const analyses = timelineItems
        .map((item, index) => {
          if (item.type === 'screenshot') {
            const s = item.data as SessionScreenshot;
            return `
**Screenshot ${index + 1}** (${new Date(s.timestamp).toLocaleTimeString()})
- Activity: ${s.aiAnalysis?.detectedActivity || 'Unknown'}
- Summary: ${s.aiAnalysis?.summary || 'No summary'}
- Key Elements: ${s.aiAnalysis?.keyElements?.join(', ') || 'None'}
${s.userComment ? `- User Comment: ${s.userComment}` : ''}
`;
          } else {
            const a = item.data as SessionAudioSegment;
            return `
**Audio Segment ${index + 1}** (${new Date(a.timestamp).toLocaleTimeString()}, ${a.duration}s)
- Mode: ${a.mode === 'transcription' ? 'Voice Transcription' : 'Audio Description'}
- Content: "${a.transcription}"
${a.description ? `- Environment: ${a.description}` : ''}
`;
          }
        })
        .join('\n');

      const audioCount = audioSegments.length;
      const screenshotCount = screenshots.length;

      // Build context strings for AI
      const standardCategories = ['Deep Work', 'Meetings', 'Research', 'Quick Tasks', 'Documentation', 'Collaboration', 'Mixed Work'];
      const existingSubCategories = context?.existingSubCategories || [];
      const existingTags = context?.existingTags || [];

      // Format video chapters if available
      const videoChapters = context?.videoChapters || [];
      const hasVideoChapters = videoChapters.length > 0;
      const videoChaptersSection = hasVideoChapters ? `

**Video Chapter Timeline (AI-detected narrative segments):**
${videoChapters.map((chapter, index) => {
  const startMin = Math.floor(chapter.startTime / 60);
  const endMin = Math.floor(chapter.endTime / 60);
  const duration = endMin - startMin;
  return `
Chapter ${index + 1}: "${chapter.title}"
- Time Range: ${startMin}:${String(Math.floor(chapter.startTime % 60)).padStart(2, '0')} - ${endMin}:${String(Math.floor(chapter.endTime % 60)).padStart(2, '0')} (${duration} min)
- Summary: ${chapter.summary || 'No summary'}
- Key Topics: ${chapter.keyTopics?.join(', ') || 'None'}
- Confidence: ${((chapter.confidence || 0) * 100).toFixed(1)}%`;
}).join('\n')}

**Chapter Analysis Context:**
These chapters represent AI-detected narrative boundaries in the session, showing when the user shifted between major topics or activities. Use them to understand the high-level structure and flow of the session.` : '';

      // Format audio insights if available
      const audioInsights = context?.audioInsights;
      const hasAudioInsights = !!audioInsights;
      const audioInsightsSection = hasAudioInsights && audioInsights ? `

**Audio Insights (Comprehensive audio analysis):**

**Overall Narrative:** ${audioInsights.narrative || 'No narrative available'}

**Emotional Journey:**
${(audioInsights.emotionalJourney || []).map(e => {
  const min = Math.floor(e.timestamp / 60);
  const sec = Math.floor(e.timestamp % 60);
  return `- ${min}:${String(sec).padStart(2, '0')} - ${e.emotion}: ${e.description}`;
}).join('\n') || 'No emotional journey data available'}

**Key Moments:**
${(audioInsights.keyMoments || []).map(m => {
  const min = Math.floor(m.timestamp / 60);
  const sec = Math.floor(m.timestamp % 60);
  return `- ${min}:${String(sec).padStart(2, '0')} [${m.type}] ${m.description}
  Context: ${m.context}
  User said: "${m.excerpt}"`;
}).join('\n\n') || 'No key moments identified'}

**Work Patterns:**
- Focus Level: ${audioInsights.workPatterns?.focusLevel || 'Unknown'}
- Interruptions: ${audioInsights.workPatterns?.interruptions ?? 0}
- Flow States: ${(audioInsights.workPatterns?.flowStates || []).map(f => {
  const startMin = Math.floor(f.start / 60);
  const endMin = Math.floor(f.end / 60);
  return `${startMin}:${String(Math.floor(f.start % 60)).padStart(2, '0')}-${endMin}:${String(Math.floor(f.end % 60)).padStart(2, '0')} (${f.description})`;
}).join(', ') || 'No flow states detected'}

**Environmental Context:**
- Work Setting: ${audioInsights.environmentalContext?.workSetting || 'Unknown'}
- Ambient Noise: ${audioInsights.environmentalContext?.ambientNoise || 'Not analyzed'}
- Time of Day: ${audioInsights.environmentalContext?.timeOfDay || 'Unknown'}` : '';

      const prompt = `You are analyzing a work session titled "${session.name}".

**Session Description:** ${session.description || 'No description provided'}

**Session Duration:** ${this.calculateDuration(session)} minutes

**Data Captured:** ${screenshotCount} screenshots, ${audioCount} audio segments${hasVideoChapters ? `, ${videoChapters.length} video chapters` : ''}${hasAudioInsights ? ', audio insights' : ''}

**Timeline Data (chronological - screenshots + audio transcripts):**
${analyses}${videoChaptersSection}${audioInsightsSection}

**Your Task:**
Create a comprehensive summary of this work session by synthesizing ALL available data sources. Tell the complete story of what the user accomplished.

**Data Source Synthesis Guide:**
You have up to 4 complementary data sources to analyze:

1. **Screenshots (Visual Evidence):** What the user was looking at and working on
2. **Audio Transcripts (Voice & Ambient Sound):** What the user said, discussed, or was exposed to
3. **Video Chapters (Narrative Structure):** ${hasVideoChapters ? 'HIGH-LEVEL narrative boundaries showing when major topic shifts occurred' : 'Not available for this session'}
4. **Audio Insights (Deep Analysis):** ${hasAudioInsights ? 'COMPREHENSIVE emotional journey, key moments, and work patterns extracted from audio' : 'Not available for this session'}

**How to Synthesize:**
- Use screenshots as the PRIMARY source for what was accomplished visually
- Use audio transcripts to understand intent, frustrations, goals, and verbal context
${hasVideoChapters ? '- Use video chapters to understand the overall narrative arc and major transitions' : ''}
${hasAudioInsights ? '- Use audio insights to understand emotional state, work quality, and critical moments' : ''}
- Cross-reference all sources to build a complete picture (e.g., emotional frustration in audio + error message in screenshot = blocker)
- Filter out irrelevant audio (background noise, off-topic discussions) using your judgment

**Important Context:**
- Audio transcripts come from Whisper, which does NOT identify different speakers - all speech appears in one continuous stream
- Audio may not always match on-screen activity (e.g., discussing future plans while working on current tasks, or participating in calls about unrelated projects)
- Background noise and irrelevant conversations may appear in transcripts - use your judgment to filter these out
${hasVideoChapters ? '- Video chapters provide structural overview but may not capture all micro-activities' : ''}
${hasAudioInsights ? '- Audio insights provide emotional and pattern context that screenshots alone cannot reveal' : ''}

Return a session summary as JSON with these fields:
- **narrative**: 1-2 paragraph story of what was accomplished
- **achievements**: Completed milestones (array of strings)
- **blockers**: Obstacles or blockers encountered (array of strings)
- **recommendedTasks**: Follow-up actions (array: {title, context, priority, relatedScreenshotIds})
- **keyInsights**: Key learnings (array: {insight, timestamp, screenshotIds}) - NO HTML tags, plain text/markdown only
- **focusAreas**: Time breakdown (array: {area, duration in minutes, percentage})
- **category**: Primary work type - choose ONE: ${standardCategories.join(', ')}
- **subCategory**: Specific work description (title case, 2-4 words)${existingSubCategories.length > 0 ? ` - prefer: ${existingSubCategories.join(', ')}` : ''}
- **tags**: 2-5 searchable keywords (lowercase-hyphenated)${existingTags.length > 0 ? ` - prefer: ${existingTags.join(', ')}` : ''}
- **lastUpdated**: Current timestamp (ISO 8601)
- **screenshotCount**: ${screenshotCount}${hasVideoChapters ? `
- **narrativeStructure** (optional): {chapters: [{title, timeRange, summary, keyTopics}], overallArc}` : ''}${hasAudioInsights ? `
- **workContext** (optional): {emotionalState, focusQuality, keyMoments: [{time, type, description}]}` : ''}

Return ONLY valid JSON.`;

      // Build messages
      const messages: ClaudeMessage[] = [
        { role: 'user', content: prompt }
      ];

      // Call Claude API via Tauri
      const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
        request: {
          model: 'claude-sonnet-4-5-20250929',
          maxTokens: 64000, // Claude Sonnet 4.5 max output limit (2025)
          messages,
          system: undefined,
          temperature: undefined,
        }
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const responseText = content.text.trim();
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      let result: any;
      try {
        result = JSON.parse(jsonText);
      } catch (parseError) {
        throw new Error(`Failed to parse session summary JSON: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}. Raw text: ${jsonText.substring(0, 200)}`);
      }

      // Validate required fields
      if (!result || typeof result !== 'object') {
        throw new Error('Parsed JSON is not a valid object');
      }

      // CRITICAL: Strip HTML tags from all key insights to ensure clean markdown/plain text
      if (result.keyInsights && Array.isArray(result.keyInsights)) {
        result.keyInsights = result.keyInsights.map((insight: any) => ({
          ...insight,
          insight: stripHtmlTags(insight.insight || ''),
        }));
      }

      console.log('✅ SessionsAgent: Session summary generated', {
        narrativeLength: result.narrative?.length || 0,
        achievements: result.achievements?.length || 0,
        blockers: result.blockers?.length || 0,
        recommendedTasks: result.recommendedTasks?.length || 0,
        keyInsights: result.keyInsights?.length || 0,
        focusAreas: result.focusAreas?.length || 0,
        category: result.category,
        subCategory: result.subCategory,
        tags: result.tags?.length || 0,
        hasNarrativeStructure: !!result.narrativeStructure,
        narrativeChapters: result.narrativeStructure?.chapters?.length || 0,
        hasWorkContext: !!result.workContext,
        workContextKeyMoments: result.workContext?.keyMoments?.length || 0,
      });

      return result;
    } catch (error) {
      console.error('❌ SessionsAgent: Failed to generate session summary:', error);
      throw error;
    }
  }

  /**
   * Generate tracking note for session (can be updated incrementally)
   */
  async generateTrackingNote(
    session: Session,
    screenshots: SessionScreenshot[],
    audioSegments: SessionAudioSegment[] = []
  ): Promise<{
    content: string;
    summary: string;
    tags: string[];
  }> {
    const sessionSummary = await this.generateSessionSummary(session, screenshots, audioSegments);

    const content = `# Session: ${session.name}

**Date:** ${new Date(session.startTime).toLocaleDateString()} at ${new Date(session.startTime).toLocaleTimeString()}
**Duration:** ${this.calculateDuration(session)} minutes
**Status:** ${session.status}

## Summary

${sessionSummary.narrative}

## Achievements

${sessionSummary.achievements && sessionSummary.achievements.length > 0
  ? sessionSummary.achievements.map(a => `- ${a}`).join('\n')
  : '_No achievements recorded_'}

## Focus Areas

${sessionSummary.focusAreas && sessionSummary.focusAreas.length > 0
  ? sessionSummary.focusAreas.map(f => `- **${f.area}**: ${f.duration} minutes (${f.percentage}%)`).join('\n')
  : '_No focus areas tracked_'}

## Recommended Tasks

${sessionSummary.recommendedTasks && sessionSummary.recommendedTasks.length > 0
      ? sessionSummary.recommendedTasks.map((t, i) => `
### ${i + 1}. ${t.title}

${t.context}

**Priority:** ${t.priority}
`).join('\n')
      : '_No tasks recommended_'}

## Key Insights

${sessionSummary.keyInsights && sessionSummary.keyInsights.length > 0
      ? sessionSummary.keyInsights.map((insight, i) => `
### Insight ${i + 1}

${insight.insight}

**Time:** ${new Date(insight.timestamp).toLocaleTimeString()}
`).join('\n')
      : '_No insights captured_'}

## Screenshots

Captured ${screenshots.length} screenshots during this session.

${screenshots.slice(0, 5).map((s, i) => `
**${i + 1}.** ${new Date(s.timestamp).toLocaleTimeString()} - ${s.aiAnalysis?.detectedActivity || 'Unknown activity'}
${s.aiAnalysis?.summary || 'No summary'}
${s.userComment ? `> User note: ${s.userComment}` : ''}
`).join('\n')}

${screenshots.length > 5 ? `\n_... and ${screenshots.length - 5} more screenshots_` : ''}
`;

    // Extract tags from session and summary
    const allTags = new Set<string>();
    allTags.add('session');
    allTags.add(session.activityType || 'work');
    if (sessionSummary.tags && Array.isArray(sessionSummary.tags)) {
      sessionSummary.tags.forEach(tag => allTags.add(tag));
    }
    session.tags?.forEach(tag => allTags.add(tag));

    return {
      content,
      summary: `Session: ${session.name} - ${sessionSummary.achievements && sessionSummary.achievements[0] || 'Work session'}`,
      tags: Array.from(allTags),
    };
  }

  /**
   * Add screenshot to context window (sliding window of last N screenshots)
   */
  private addToContextWindow(screenshot: SessionScreenshot): void {
    this.contextWindow.push(screenshot);

    // Keep only last N screenshots
    if (this.contextWindow.length > this.contextWindowSize) {
      const removed = this.contextWindow.shift();
      // Remove summary from memory to save space
      if (removed) {
        this.sessionSummaries.delete(removed.id);
      }
    }
  }

  /**
   * Build session context from recent screenshots
   */
  private buildSessionContext(session: Session): string {
    if (this.contextWindow.length === 0) {
      return 'This is the first screenshot of the session.';
    }

    const recentContext = this.contextWindow
      .slice(-3) // Last 3 screenshots
      .map((s, i) => {
        const summary = this.sessionSummaries.get(s.id);
        const timeAgo = Math.floor(
          (Date.now() - new Date(s.timestamp).getTime()) / (1000 * 60)
        );
        return `${i + 1}. (${timeAgo}min ago) ${summary || 'No summary yet'}`;
      })
      .join('\n');

    return `**Recent Activity in this Session:**
${recentContext}

**Session Goal:** ${session.description || 'No specific goal'}
`;
  }

  /**
   * Build analysis prompt for screenshot
   */
  private buildAnalysisPrompt(session: Session, sessionContext: string): string {
    return `<goal>
Analyze this screenshot to track work progress and extract actionable information for session synthesis.
</goal>

<session_context>
Session: "${session.name}"
${sessionContext}
</session_context>

<task>
Identify and extract:
1. Current activity (what's happening now)
2. Progress signals (completions, achievements, milestones)
3. Blockers (errors, obstacles, waiting states)
4. Context shifts (task/tool switches)
5. Actionable items (tasks, follow-ups, TODOs)
6. Insights (learnings, discoveries, observations)
7. Key text (names, URLs, error messages, data)
</task>

<output_format>
Return ONLY valid JSON (no markdown):
{
  "summary": "1-2 sentences: what was accomplished or attempted",
  "detectedActivity": "Specific activity (e.g., 'Debugging auth flow')",
  "extractedText": "Important text: error messages, URLs, names, data",
  "keyElements": ["Element 1", "Element 2", "Element 3"],
  "suggestedActions": ["Action 1", "Action 2"],
  "contextDelta": "What changed or progressed",
  "confidence": 0.9,
  "curiosity": 0.5,
  "curiosityReason": "Brief reason for curiosity score",
  "progressIndicators": {
    "achievements": ["Achievement 1", "Achievement 2"],
    "blockers": ["Blocker 1", "Blocker 2"],
    "insights": ["Insight 1", "Insight 2"]
  },
  "detectedEntities": {
    "topics": [{ "name": "API Development", "confidence": 0.9 }],
    "companies": [{ "name": "Acme Corp", "confidence": 0.8 }],
    "contacts": [{ "name": "Sarah", "confidence": 0.7 }]
  }
}
</output_format>

<guidelines>
- Focus on outcomes and progress, not just what's visible
- Identify blockers explicitly (crucial for understanding)
- Track context shifts (they show work narrative)
- Extract insights valuable in retrospect
- confidence: 0-1 based on image clarity
- Be specific and actionable in suggestedActions
- **curiosity: 0.0-1.0 score indicating how much you would benefit from seeing the next screenshot sooner:**
  - 0.0-0.3: Clear, steady work. Context is well understood. Low priority for next screenshot.
  - 0.4-0.6: Normal work progress. Moderate interest in next screenshot.
  - 0.7-1.0: High uncertainty, error messages, blockers, or context changes detected. Would greatly benefit from seeing next screenshot sooner to understand resolution or progression.
- curiosityReason: Brief explanation (1 sentence) for the curiosity score

**Entity Extraction (detectedEntities):**
- **Topics**: Extract subjects/projects/concepts visible in the screenshot (e.g., "API Development", "Database Migration", "UI Design")
  - Look for project names, feature names, technical concepts
  - confidence: 0.9 if clearly visible, 0.5-0.8 if inferred from context
- **Companies**: Extract organization names mentioned or visible (e.g., "Acme Corp", "AWS", "Stripe")
  - Look for company logos, URLs, app names, service names
  - confidence: 0.9 if logo/name visible, 0.5-0.7 if inferred
- **Contacts**: Extract people's names mentioned or visible (e.g., "Sarah", "John Smith")
  - Look for names in emails, Slack messages, calendar events, code comments
  - confidence: 0.8 if name clearly visible, 0.5-0.7 if partial match
- Keep detectedEntities arrays EMPTY if nothing clearly identifiable
- Only extract entities with confidence >= 0.5
</guidelines>`;
  }

  /**
   * Calculate session duration in minutes
   */
  private calculateDuration(session: Session): number {
    if (!session.startTime) return 0;
    const endTime = session.endTime || new Date().toISOString();
    return Math.floor(
      (new Date(endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60)
    );
  }

  /**
   * Generate evolving session title and description based on recent activity
   * This creates a "living" session that updates as the AI understands more
   */
  async generateSessionMetadata(
    session: Session,
    screenshots: SessionScreenshot[],
    audioSegments: SessionAudioSegment[] = []
  ): Promise<{
    title: string;
    description: string;
  }> {
    if (!this.hasApiKey) {
      throw new Error('API key not set');
    }

    // Get recent screenshots with analysis
    const analyzedScreenshots = screenshots
      .filter(s => s.aiAnalysis)
      .slice(-5); // Last 5 screenshots

    // Get recent audio segments
    const recentAudio = audioSegments.slice(-5); // Last 5 audio segments

    if (analyzedScreenshots.length === 0 && recentAudio.length === 0) {
      return {
        title: session.name,
        description: session.description
      };
    }

    // Merge recent screenshots and audio chronologically
    type ActivityItem =
      | { type: 'screenshot'; timestamp: string; data: SessionScreenshot }
      | { type: 'audio'; timestamp: string; data: SessionAudioSegment };

    const recentItems: ActivityItem[] = [
      ...analyzedScreenshots.map(s => ({ type: 'screenshot' as const, timestamp: s.timestamp, data: s })),
      ...recentAudio.map(a => ({ type: 'audio' as const, timestamp: a.timestamp, data: a }))
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
     .slice(-5); // Keep only last 5 items total

    const activities = recentItems
      .map((item, i) => {
        if (item.type === 'screenshot') {
          const s = item.data as SessionScreenshot;
          return `${i + 1}. [Screenshot] ${s.aiAnalysis?.detectedActivity || 'Unknown'}: ${s.aiAnalysis?.summary || ''}`;
        } else {
          const a = item.data as SessionAudioSegment;
          return `${i + 1}. [Audio] "${a.transcription.substring(0, 100)}${a.transcription.length > 100 ? '...' : ''}"`;
        }
      })
      .join('\n');

    const audioCount = audioSegments.length;
    const screenshotCount = screenshots.length;

    const prompt = `You are analyzing an ongoing work session.

**Current Title:** "${session.name}"
**Current Description:** "${session.description}"
**Data Captured:** ${screenshotCount} screenshots, ${audioCount} audio segments
**Duration:** ${this.calculateDuration(session)} minutes

**Recent Activities (screenshots + audio transcripts):**
${activities}

**Your Task:**
Based on what you've learned from BOTH the screenshots and audio transcripts, generate an evolving session title and description that captures what the user is ACTUALLY doing.

Audio transcripts often reveal the user's intent, frustrations, and goals more clearly than screenshots alone.

**Guidelines:**
- Title should be 3-6 words, specific and descriptive (e.g., "Customer Dashboard Email Campaign" not just "Work Session")
- Description should be 1-2 sentences capturing the core activity and goal
- Use audio transcripts to understand the user's stated goals and thought process
- If early in session (1-2 data points), be more general but hint at direction
- As more data comes in, make it more specific
- Focus on the actual work, not the tools (e.g., "Debugging authentication flow" not "Working in VS Code")

Return ONLY valid JSON (no markdown):
{
  "title": "Specific descriptive title of actual work",
  "description": "1-2 sentence narrative describing what's happening in this session"
}`;

    try {
      // Build messages
      const messages: ClaudeMessage[] = [
        { role: 'user', content: prompt }
      ];

      // Call Claude API via Tauri
      const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
        request: {
          model: 'claude-sonnet-4-5-20250929',
          maxTokens: 64000, // Claude Sonnet 4.5 max output limit (2025)
          messages,
          system: undefined,
          temperature: undefined,
        }
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format');
      }

      const responseText = content.text.trim();
      let jsonText = responseText;

      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      // Clean up common JSON issues from AI responses
      jsonText = jsonText
        .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Quote unquoted property names
        .trim();

      let result;
      try {
        result = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('❌ SessionsAgent: JSON parse failed, raw response:', responseText);
        console.error('❌ SessionsAgent: Attempted to parse:', jsonText);
        throw parseError;
      }

      console.log('📝 SessionsAgent: Generated session metadata', {
        title: result.title,
        descriptionLength: result.description?.length
      });

      return {
        title: result.title || session.name,
        description: result.description || session.description
      };
    } catch (error) {
      console.error('❌ SessionsAgent: Failed to generate session metadata:', error);
      return {
        title: session.name,
        description: session.description
      };
    }
  }

  /**
   * Clear context for a session (when session ends)
   */
  clearSessionContext(sessionId: string): void {
    this.contextWindow = [];
    // Clear all summaries for this session
    this.sessionSummaries.clear();
    console.log(`🗑️  SessionsAgent: Cleared context for session ${sessionId}`);
  }

  /**
   * Get current context window size
   */
  getContextWindowSize(): number {
    return this.contextWindow.length;
  }

  /**
   * Debug method to check current state
   */
  async getDebugInfo(): Promise<{
    hasApiKey: boolean;
    apiKeyPrefix?: string;
  }> {
    try {
      const savedKey = await invoke<string | null>('get_claude_api_key');
      return {
        hasApiKey: !!savedKey,
        apiKeyPrefix: savedKey?.substring(0, 7)
      };
    } catch (error) {
      console.error('Failed to get debug info:', error);
      return {
        hasApiKey: false
      };
    }
  }

  /**
   * Force reload API key from storage
   */
  async reloadApiKey(): Promise<void> {
    console.log('🔄 SessionsAgent: Force reloading API key...');
    await this.loadApiKeyFromStorage();
  }
}

// Export singleton instance
export const sessionsAgentService = new SessionsAgentService();
