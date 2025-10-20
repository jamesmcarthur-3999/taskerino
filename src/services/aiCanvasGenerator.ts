import { invoke } from '@tauri-apps/api/core';
import type { Session, SessionSummary, SessionScreenshot, SessionAudioSegment, VideoChapter } from '../types';
import type { ClaudeChatResponse, ClaudeMessage } from '../types/tauri-ai-commands';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CanvasSpec {
  theme: CanvasTheme;
  layout: CanvasLayout;
  metadata: {
    generatedAt: string;
    sessionType: string;
    confidence: number;
  };
}

export interface CanvasTheme {
  primary: string;
  secondary: string;
  mood: 'energetic' | 'calm' | 'focused' | 'celebratory';
  explanation: string;
}

export interface CanvasLayout {
  type: 'timeline' | 'story' | 'dashboard' | 'grid' | 'flow';
  sections: CanvasSection[];
  emphasis: 'chronological' | 'thematic' | 'achievement-focused';
}

export interface CanvasSection {
  id: string;
  type: 'hero' | 'timeline' | 'achievements' | 'blockers' | 'insights' | 'gallery' | 'split' | 'media';
  emphasis: 'low' | 'medium' | 'high';
  position: number;
  content?: any;
  left?: CanvasSection;
  right?: CanvasSection;
}

export interface AICanvasSessionCharacteristics {
  screenshotCount: number;
  audioSegmentCount: number;
  videoChapterCount: number;
  achievementCount: number;
  blockerCount: number;
  insightCount: number;
  duration: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'late-night';
  type: 'coding' | 'meeting' | 'learning' | 'mixed' | 'research';
  intensity: 'light' | 'moderate' | 'heavy';
  mood: 'productive' | 'challenging' | 'exploratory' | 'breakthrough';
  hasAudio: boolean;
  hasVideo: boolean;
  hasSummary: boolean;
  hasNarrative: boolean;
}

/**
 * Temporal analysis of session flow and rhythm
 */
export interface TemporalAnalysis {
  /** Overall session arc pattern (e.g., "steady-climb", "rollercoaster", "plateau") */
  sessionArc: string;

  /** Peak moments of high activity or achievement */
  peakMoments: Moment[];

  /** Valley moments of low activity or struggle */
  valleys: Moment[];

  /** Rhythm pattern (e.g., "steady", "burst-and-pause", "chaotic") */
  rhythm: string;

  /** Screenshots per hour */
  screenshotDensity: number;

  /** Number of significant context switches */
  contextSwitches: number;
}

/**
 * Content richness indicators
 */
export interface ContentRichness {
  /** Audio transcript word count */
  audioWordCount: number;

  /** Video chapter count */
  videoChapterCount: number;

  /** Code activity detected from screenshots */
  hasCodeActivity: boolean;

  /** Written notes or documentation detected */
  hasNotesActivity: boolean;

  /** Total OCR text extracted */
  ocrTextLength: number;

  /** Diversity of detected activities */
  activityDiversity: number; // 0-1 score
}

/**
 * Achievement profile for the session
 */
export interface AchievementProfile {
  /** Major milestones reached */
  milestones: Milestone[];

  /** Breakthrough moments */
  breakthroughs: Learning[];

  /** Key learnings extracted */
  learnings: Learning[];

  /** Problems solved count */
  problemsSolved: number;

  /** Blocker analysis */
  blockerAnalysis: string;
}

/**
 * Energy and focus analysis
 */
export interface EnergyAnalysis {
  /** Overall intensity level (0-100) */
  intensity: number;

  /** Focus quality (0-100) */
  focusQuality: number;

  /** Struggle level (0-100) */
  struggleLevel: number;

  /** Breakthrough moment if detected */
  breakthroughMoment: Moment | null;

  /** Inferred mood */
  mood: string;
}

/**
 * Narrative structure for storytelling
 */
export interface NarrativeStructure {
  /** Story type classification */
  storyType: StoryType;

  /** Primary goal of the session */
  goal: string | null;

  /** Main conflict or challenge */
  conflict: string | null;

  /** Resolution or outcome */
  resolution: string | null;

  /** Transformation or learning */
  transformation: string | null;
}

/**
 * Enriched session characteristics with all analysis dimensions
 */
export interface EnrichedSessionCharacteristics extends AICanvasSessionCharacteristics {
  temporal: TemporalAnalysis;
  richness: ContentRichness;
  achievements: AchievementProfile;
  energy: EnergyAnalysis;
  narrative: NarrativeStructure;
}

/**
 * A significant moment in the session
 */
export interface Moment {
  timestamp: string;
  description: string;
  importance: 'low' | 'medium' | 'high';
  screenshotIds?: string[];
}

/**
 * A milestone achievement
 */
export interface Milestone {
  title: string;
  timestamp: string;
  description: string;
  screenshotIds?: string[];
}

/**
 * A learning or insight
 */
export interface Learning {
  insight: string;
  timestamp: string;
  context?: string;
}

/**
 * Story classification types
 */
export type StoryType =
  | 'hero-journey'      // Started with goal, faced challenges, achieved victory
  | 'problem-solving'   // Encountered issue, debugged, resolved
  | 'exploration'       // Learning and discovering new territory
  | 'building'          // Creating something from scratch
  | 'optimization'      // Improving existing work
  | 'collaboration'     // Working with others
  | 'struggle'          // Facing challenges without clear resolution
  | 'mixed';            // Multiple story threads

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
    onProgress?.(0.0, 'Starting analysis');

    const characteristics = this.analyzeSession(session);
    const summary = session.summary;

    // Stage 2: Session analyzed (20%)
    onProgress?.(0.2, 'Session analyzed');

    // Stage 3: Building prompt (40%)
    onProgress?.(0.4, 'Building design prompt');

    try {
      const spec = await this.designCanvas(characteristics, session, summary, onProgress);

      // Stage 6: Complete (100%)
      onProgress?.(1.0, 'Canvas ready');

      return spec;
    } catch (error) {
      console.error('[AICanvasGenerator] AI design failed, using fallback:', error);
      onProgress?.(0.9, 'Using fallback design');
      const fallback = this.createFallbackSpec(characteristics, session);
      onProgress?.(1.0, 'Canvas ready');
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
   */
  private async designCanvas(
    characteristics: EnrichedSessionCharacteristics,
    session: Session,
    summary?: SessionSummary,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<CanvasSpec> {
    const prompt = this.buildDesignPrompt(characteristics, session, summary);

    const messages: ClaudeMessage[] = [
      { role: 'user', content: prompt }
    ];

    // Stage 4: Requesting AI design (60%)
    onProgress?.(0.6, 'Requesting AI design');

    const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
      request: {
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 4000,
        messages,
        system: undefined,
        temperature: undefined,
      }
    });

    // Stage 5: Parsing response (80%)
    onProgress?.(0.8, 'Parsing AI response');

    return this.parseCanvasSpec(response);
  }

  /**
   * Build comprehensive design prompt for Claude with rich context
   */
  private buildDesignPrompt(
    c: EnrichedSessionCharacteristics,
    session: Session,
    summary?: SessionSummary
  ): string {
    // Build peak moments list
    const peakMomentsList = c.temporal.peakMoments.length > 0
      ? c.temporal.peakMoments.map(m => `  - ${m.description} (${m.importance})`).join('\n')
      : '  (none detected)';

    // Build valleys list
    const valleysList = c.temporal.valleys.length > 0
      ? c.temporal.valleys.map(v => `  - ${v.description} (${v.importance})`).join('\n')
      : '  (none detected)';

    // Build milestones list
    const milestonesList = c.achievements.milestones.length > 0
      ? c.achievements.milestones.map(m => `  - ${m.title}: ${m.description}`).join('\n')
      : '  (none detected)';

    // Build breakthroughs list
    const breakthroughsList = c.achievements.breakthroughs.length > 0
      ? c.achievements.breakthroughs.map(b => `  - ${b.insight}`).join('\n')
      : '  (none detected)';

    // Build learnings list
    const learningsList = c.achievements.learnings.length > 0
      ? c.achievements.learnings.map(l => `  - ${l.insight}`).join('\n')
      : '  (none detected)';

    // Build available building blocks
    const availableHeros = [
      'timeline-hero: Visual timeline spanning full session with key moments',
      'achievement-hero: Celebration of major accomplishment with triumphant imagery',
      'story-hero: Narrative arc with beginning/middle/end structure',
      'snapshot-hero: Frozen moment in time with rich contextual detail',
      'journey-hero: Transformation from start to finish with before/after emphasis',
      'struggle-hero: Honest acknowledgment of challenges faced',
      'breakthrough-hero: Moment of clarity or major realization',
    ];

    const availableCards = [
      'timeline-card: Chronological event list with time markers',
      'achievement-card: Highlighted accomplishment with celebration tone',
      'blocker-card: Challenge or obstacle faced with severity indicator',
      'insight-card: Key learning or realization with context',
      'gallery-card: Screenshot collection in grid or carousel',
      'media-card: Audio/video content with playback controls',
      'metrics-card: Stats and numbers with visual emphasis',
      'quote-card: Notable quote from audio transcript',
      'peak-moment-card: Highlight a specific high-impact moment',
      'valley-card: Acknowledge low points or struggles',
      'code-snippet-card: Code activity with syntax highlighting',
      'notes-card: Documentation or written content',
    ];

    const availableModules = [
      'split-layout: Side-by-side comparison or parallel threads',
      'flow-diagram: Sequential process visualization with arrows',
      'grid-gallery: Multi-image showcase in responsive grid',
      'rich-timeline: Enhanced timeline with branches and annotations',
      'stats-panel: Metrics dashboard with charts and graphs',
      'audio-waveform: Audio visualization with transcript',
      'video-chapters: Chapter navigation with thumbnails',
      'energy-graph: Energy/focus visualization over time',
    ];

    // Session start and end times
    const startTime = new Date(session.startTime).toLocaleString();
    const endTime = session.endTime ? new Date(session.endTime).toLocaleString() : 'In progress';

    return `You are a visual designer creating a BESPOKE summary canvas for a work session.
This canvas MUST tell the unique story of THIS session through thoughtful layout and design.

========================================
# SESSION PROFILE
========================================

**Session Name:** ${session.name}
**Description:** ${session.description || 'No description provided'}
**Duration:** ${c.duration} minutes (${c.timeOfDay})
**Status:** ${session.status}
**Started:** ${startTime}
**Ended:** ${endTime}

The session took place during **${c.timeOfDay}** hours, which may influence energy levels and work style.

========================================
# SESSION CHARACTERISTICS
========================================

**Type & Mood:**
- **Session Type:** ${c.type} (coding, meeting, learning, research, or mixed)
- **Mood:** ${c.mood} (productive, challenging, exploratory, or breakthrough)
- **Overall Intensity:** ${c.intensity} (light, moderate, or heavy)

**Content Counts:**
- **Screenshots:** ${c.screenshotCount} captured moments
- **Audio Segments:** ${c.audioSegmentCount} recordings
- **Video Chapters:** ${c.videoChapterCount} chapters
- **Achievements:** ${c.achievementCount} wins
- **Blockers:** ${c.blockerCount} obstacles
- **Insights:** ${c.insightCount} learnings

**Content Availability:**
- Has Audio: ${c.hasAudio ? 'YES' : 'NO'}
- Has Video: ${c.hasVideo ? 'YES' : 'NO'}
- Has Summary: ${c.hasSummary ? 'YES' : 'NO'}
- Has Narrative: ${c.hasNarrative ? 'YES' : 'NO'}

========================================
# TEMPORAL ANALYSIS
========================================

Understand the session's rhythm and flow over time:

**Session Arc:** ${c.temporal.sessionArc}
  - This describes the overall shape of the session (e.g., steady-climb, rollercoaster, plateau)
  - Use this to inform the visual storytelling approach

**Rhythm Pattern:** ${c.temporal.rhythm}
  - steady-rhythm: Consistent pacing
  - chaotic-bursts: Irregular activity spikes
  - varied-pacing: Mix of focused and scattered moments

**Screenshot Density:** ${c.temporal.screenshotDensity.toFixed(1)} screenshots per hour
  - High density (>10/hr) suggests intense, fast-paced work
  - Low density (<5/hr) suggests deep focus or slower exploration

**Context Switches:** ${c.temporal.contextSwitches}
  - Number of times the user changed activities
  - High switches may indicate multitasking or fragmented work

**Peak Moments (High Activity/Achievement):**
${peakMomentsList}

**Valley Moments (Low Activity/Struggle):**
${valleysList}

========================================
# CONTENT RICHNESS
========================================

Assess the depth and diversity of session content:

**Audio Content:**
- Available: ${c.hasAudio ? 'YES' : 'NO'}
- Word Count: ${c.richness.audioWordCount} words transcribed
- Rich audio suggests verbal processing, meetings, or narration

**Video Content:**
- Available: ${c.hasVideo ? 'YES' : 'NO'}
- Chapter Count: ${c.richness.videoChapterCount} chapters
- Video chapters provide natural segmentation for timeline layouts

**Activity Detection:**
- Code Activity: ${c.richness.hasCodeActivity ? 'DETECTED' : 'NOT DETECTED'}
- Documentation Activity: ${c.richness.hasNotesActivity ? 'DETECTED' : 'NOT DETECTED'}
- OCR Text Extracted: ${c.richness.ocrTextLength} characters
- Activity Diversity Score: ${(c.richness.activityDiversity * 100).toFixed(0)}%

**Content Implications:**
- High diversity (>50%) → Use varied card types to reflect multiple activities
- Single activity dominance → Focus layout on that primary activity
- Rich OCR text → Text-heavy screenshots provide context for cards
- Limited content → Emphasize narrative and insights over raw content

========================================
# ACHIEVEMENT PROFILE
========================================

Catalog the session's accomplishments and learnings:

**Major Milestones:**
${milestonesList}

**Breakthroughs (Eureka Moments):**
${breakthroughsList}

**Key Learnings:**
${learningsList}

**Problems Solved:** ${c.achievements.problemsSolved}
  - Ratio of resolved to total blockers indicates session success

**Blocker Analysis:** ${c.achievements.blockerAnalysis}
  - Summary of obstacles encountered and their resolution status

**Achievement Implications:**
- High achievements (>3) → Celebration-focused canvas with achievement-hero
- No achievements + high blockers → Empathetic canvas acknowledging struggle
- Balanced achievements/blockers → Problem-solving narrative with journey-hero
- Many learnings → Insight-focused layout with insight cards prominent

========================================
# ENERGY & FOCUS
========================================

Understand the user's mental state and engagement:

**Intensity Level:** ${c.energy.intensity}/100
  - 0-30: Light, exploratory work
  - 31-70: Moderate, steady productivity
  - 71-100: Heavy, intense focus or effort

**Focus Quality:** ${c.energy.focusQuality}/100
  - 0-30: Scattered, frequent context switches
  - 31-70: Moderate focus with some interruptions
  - 71-100: Deep focus, minimal distractions

**Struggle Level:** ${c.energy.struggleLevel}/100
  - 0-30: Smooth sailing, few obstacles
  - 31-70: Some challenges, manageable difficulty
  - 71-100: High difficulty, significant struggle

**Mood Inference:** ${c.energy.mood}

**Breakthrough Moment:**
${c.energy.breakthroughMoment ? `YES - ${c.energy.breakthroughMoment.description}` : 'None detected'}

**Energy Implications:**
- High intensity + high focus → Productive flow state, use energetic colors (orange, green)
- High struggle + low achievements → Challenging session, use empathetic tone (softer blues)
- Breakthrough moment → Emphasize climax in narrative arc, use breakthrough-hero
- Low energy session → Calm, reflective design with muted colors

========================================
# NARRATIVE STRUCTURE
========================================

Every session tells a story. Understand the narrative arc:

**Story Type:** ${c.narrative.storyType}
  - hero-journey: Overcame challenges, achieved victory
  - problem-solving: Encountered issue, debugged, resolved
  - exploration: Learning and discovering new territory
  - building: Creating something from scratch
  - optimization: Improving existing work
  - collaboration: Working with others
  - struggle: Facing challenges without clear resolution
  - mixed: Multiple story threads

**Goal (What They Set Out To Do):**
${c.narrative.goal || 'Not explicitly stated - infer from session content'}

**Conflict (Main Challenge):**
${c.narrative.conflict || 'No major conflict detected'}

**Resolution (How It Ended):**
${c.narrative.resolution || 'Session ended without clear resolution'}

**Transformation (What Changed):**
${c.narrative.transformation || 'No transformation detected'}

**Narrative Implications:**
- Clear goal/conflict/resolution → Use story-hero with 3-act structure
- Multiple conflicts → Split-layout or parallel timelines
- No clear narrative → Dashboard or grid layout focusing on content
- Transformation present → Journey-hero showing before/after

========================================
# FULL NARRATIVE TEXT
========================================

${summary?.narrative || 'No narrative summary available. Use the data above to infer the session story.'}

${summary?.achievements && summary.achievements.length > 0 ? `
**Achievements List:**
${summary.achievements.map((a, i) => `${i + 1}. ${a}`).join('\n')}
` : ''}

${summary?.blockers && summary.blockers.length > 0 ? `
**Blockers List:**
${summary.blockers.map((b, i) => `${i + 1}. ${b}`).join('\n')}
` : ''}

${summary?.keyInsights && summary.keyInsights.length > 0 ? `
**Key Insights:**
${summary.keyInsights.map((ki) => `- ${ki.insight}`).join('\n')}
` : ''}

========================================
# AVAILABLE BUILDING BLOCKS
========================================

Choose components that best tell THIS session's unique story:

**Hero Components (choose ONE for top of canvas):**
${availableHeros.map(h => '- ' + h).join('\n')}

**Card Components (choose 2-5 for main content):**
${availableCards.map(c => '- ' + c).join('\n')}

**Module Components (optional, for complex layouts):**
${availableModules.map(m => '- ' + m).join('\n')}

========================================
# DESIGN GUIDANCE - 5 PRINCIPLES
========================================

Apply these principles to create a UNIQUE, BESPOKE canvas:

**1. VISUAL HIERARCHY** - What should dominate the canvas?
   - High achievement session → Hero celebrates the win, achievements prominent
   - Struggle session → Hero acknowledges the challenge with empathy
   - Mixed session → Balance multiple story threads with split layouts
   - Breakthrough session → Hero emphasizes the eureka moment
   - Exploration session → Gallery or grid to showcase diverse discoveries

**2. EMOTIONAL RESONANCE** - Match the emotional tone precisely
   - Celebratory (high achievements): Bright colors, triumphant hero, achievement-hero
   - Reflective (insights-heavy): Muted tones, thoughtful layout, insight cards
   - Intense (high energy/struggle): Bold contrasts, dynamic sections, energy-focused
   - Exploratory (diverse activities): Soft gradients, discovery theme, varied cards
   - Challenging (high blockers): Supportive tone, acknowledge struggle, empathetic colors

**3. STORY FLOW** - How should the narrative unfold?
   - Chronological: Timeline-based with clear beginning/middle/end (use timeline-hero)
   - Thematic: Grouped by topic or activity type (use dashboard layout)
   - Achievement-focused: Build toward climax/resolution (use story-hero)
   - Non-linear: Multiple parallel threads (use split-layout)
   - Comparative: Before/after transformation (use journey-hero)

**4. COLOR PSYCHOLOGY** - Choose colors that enhance the story emotionally
   - Blue (#3b82f6, #60a5fa): Focus, productivity, calm, trust
   - Purple (#8b5cf6, #a78bfa): Creativity, learning, insight, wisdom
   - Green (#10b981, #34d399): Growth, achievement, progress, success
   - Orange (#f59e0b, #fbbf24): Energy, breakthrough, excitement, warmth
   - Red (#ef4444, #f87171): Urgency, struggle, intensity, passion
   - Teal (#14b8a6, #2dd4bf): Balance, clarity, innovation
   - Indigo (#6366f1, #818cf8): Deep focus, concentration, flow
   - **Always combine 2 colors** for depth, visual interest, and narrative nuance

**5. CONTENT UTILIZATION** - Leverage what's available intelligently
   - Rich audio (>500 words) → Include audio insights, quotes, or waveform module
   - Many screenshots (>10) → Gallery emphasis, grid-gallery, or rich timeline
   - Video chapters (>3) → Chapter-based navigation with video-chapters module
   - Few assets (<5 screenshots) → Focus on narrative, insights, and text-heavy cards
   - Code activity → Include code-snippet-card or terminal visuals
   - Documentation activity → Notes-card or written content emphasis

========================================
# OUTPUT FORMAT
========================================

Return a JSON object with this EXACT structure:

\`\`\`json
{
  "theme": {
    "primary": "#HEX_COLOR",
    "secondary": "#HEX_COLOR",
    "mood": "energetic|calm|focused|celebratory",
    "explanation": "Brief explanation of why these colors fit this session (1-2 sentences)"
  },
  "layout": {
    "type": "timeline|story|dashboard|grid|flow",
    "emphasis": "chronological|thematic|achievement-focused",
    "sections": [
      {
        "id": "hero",
        "type": "hero",
        "emphasis": "high",
        "position": 1,
        "content": {
          "heroType": "timeline-hero|achievement-hero|story-hero|snapshot-hero|journey-hero|struggle-hero|breakthrough-hero",
          "title": "Hero section title",
          "subtitle": "Hero section subtitle (optional)"
        }
      },
      {
        "id": "section2",
        "type": "timeline|achievements|blockers|insights|gallery|media",
        "emphasis": "low|medium|high",
        "position": 2,
        "content": {}
      }
    ]
  },
  "metadata": {
    "sessionType": "${c.type}",
    "confidence": 0.8
  },
  "narrative": {
    "hook": "Opening line that captures the session essence (1 sentence)",
    "arc": "Brief narrative arc summary (2-3 sentences)",
    "climax": "Peak moment or turning point (1 sentence)",
    "resolution": "How it ended or what was learned (1 sentence)"
  }
}
\`\`\`

========================================
# FINAL INSTRUCTIONS
========================================

Remember:
- This is NOT a template - design uniquely for THIS session's story
- Use the narrative structure (goal/conflict/resolution) to inform visual design
- Let peak moments and energy levels guide section emphasis
- Match colors to the emotional journey (not generic defaults)
- Create a cohesive story from hero to final section
- Consider time of day, duration, and rhythm when choosing layout type
- Celebrate achievements, acknowledge struggles, highlight learnings
- Every design choice should serve the session's unique narrative

Design the canvas now.`;
  }

  /**
   * Parse Claude response into CanvasSpec
   */
  private parseCanvasSpec(response: ClaudeChatResponse): CanvasSpec {
    let jsonText = response.content[0].text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) jsonText = jsonMatch[1].trim();

    const parsed = JSON.parse(jsonText);

    return {
      theme: parsed.theme,
      layout: {
        type: parsed.layout.type,
        emphasis: parsed.layout.emphasis || 'chronological',
        sections: parsed.layout.sections,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        sessionType: parsed.metadata?.sessionType || 'unknown',
        confidence: parsed.metadata?.confidence || 0.5,
      },
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
  private extractLearnings(session: Session): Learning[] {
    const learnings: Learning[] = [];

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
          timestamp: new Date(session.startTime).getTime() + (km.timestamp * 1000),
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

    // Collaboration: Meeting indicators
    if (session.type === 'meeting' || (session.audioSegments?.length || 0) > 5) {
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
