import { invoke } from '@tauri-apps/api/core';
import type { Session, SessionSummary } from '../types';
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
   * Analyze session to understand characteristics
   */
  private analyzeSession(session: Session): AICanvasSessionCharacteristics {
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
    const mood = this.inferMood(achievementCount, blockerCount);

    return {
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
  }

  /**
   * Ask Claude to design canvas layout
   */
  private async designCanvas(
    characteristics: AICanvasSessionCharacteristics,
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
   * Build prompt for Claude
   */
  private buildDesignPrompt(
    characteristics: AICanvasSessionCharacteristics,
    session: Session,
    summary?: SessionSummary
  ): string {
    return `You are a visual designer creating a BESPOKE summary canvas for a work session.

**Session:** ${session.name}
**Type:** ${characteristics.type}
**Duration:** ${characteristics.duration} minutes (${characteristics.timeOfDay})
**Mood:** ${characteristics.mood} (intensity: ${characteristics.intensity})

**Content:**
- Screenshots: ${characteristics.screenshotCount}
- Achievements: ${characteristics.achievementCount}
- Blockers: ${characteristics.blockerCount}
- Insights: ${characteristics.insightCount}

**Summary:** ${summary?.narrative || 'No narrative'}

Design a UNIQUE canvas (not a template). Consider:
1. Visual hierarchy - What dominates?
2. Emotional tone - Celebratory? Reflective? Focused?
3. Story flow - Chronological? Thematic?
4. Color scheme - Match the mood

Return JSON:
{
  "theme": {
    "primary": "#HEX",
    "secondary": "#HEX",
    "mood": "energetic|calm|focused|celebratory",
    "explanation": "Why these colors"
  },
  "layout": {
    "type": "timeline|story|dashboard|grid",
    "emphasis": "chronological|thematic|achievement-focused",
    "sections": [
      {"id": "hero", "type": "hero", "emphasis": "high", "position": 1},
      {"id": "timeline", "type": "timeline", "emphasis": "medium", "position": 2}
    ]
  }
}`;
  }

  /**
   * Parse Claude response
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
   * Fallback spec
   */
  private createFallbackSpec(c: AICanvasSessionCharacteristics, s: Session): CanvasSpec {
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

  private inferSessionType(s: Session, sc: number, ac: number): string {
    if (s.category?.toLowerCase().includes('dev')) return 'coding';
    if (s.category?.toLowerCase().includes('meeting')) return 'meeting';
    if (s.category?.toLowerCase().includes('learn')) return 'learning';
    return 'mixed';
  }

  private inferIntensity(duration: number, screenshots: number, achievements: number): string {
    const score = (screenshots / 10) + (achievements * 2) + (duration / 60);
    return score > 8 ? 'heavy' : score > 4 ? 'moderate' : 'light';
  }

  private inferMood(achievements: number, blockers: number): string {
    if (achievements > blockers * 2) return 'productive';
    if (blockers > achievements) return 'challenging';
    if (achievements > 0) return 'breakthrough';
    return 'exploratory';
  }
}

export const aiCanvasGenerator = new AICanvasGenerator();
