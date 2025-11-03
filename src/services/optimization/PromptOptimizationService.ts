/**
 * Prompt Optimization Service (Task 5.10)
 *
 * Better prompts for lower costs and higher quality enrichment.
 *
 * Features:
 * - Optimized prompt templates for different AI tasks
 * - Model-specific prompt variants (Haiku vs Sonnet optimized)
 * - A/B testing framework for prompt comparison
 * - Quality measurement and tracking
 * - Token count estimation and optimization
 *
 * Target: 30-50% token reduction, +10-20% quality improvement
 */

import type { Session, SessionScreenshot, AudioInsights, VideoChapter } from '../../types';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface PromptTemplate {
  /** Task identifier */
  task: AITaskType;

  /** Haiku 4.5 optimized prompt (concise, direct) */
  simple: string;

  /** Sonnet 4.5 optimized prompt (detailed, nuanced) */
  detailed: string;

  /** Estimated input tokens for this prompt */
  tokenCount: number;

  /** Expected output tokens */
  expectedOutputTokens: number;

  /** Prompt version for tracking improvements */
  version: string;
}

export type AITaskType =
  | 'screenshot_analysis'
  | 'screenshot_analysis_realtime'
  | 'audio_transcription'
  | 'audio_insights'
  | 'video_chaptering'
  | 'summary_brief'
  | 'summary_comprehensive'
  | 'classification';

export interface PromptContext {
  /** Session being analyzed */
  session?: Session;

  /** Previous context (for continuation) */
  previousContext?: string;

  /** Additional data specific to task */
  metadata?: Record<string, any>;
}

export interface ABTestConfig {
  /** Prompt A to test */
  promptA: string;

  /** Prompt B to test */
  promptB: string;

  /** Test data samples */
  testData: ABTestSample[];

  /** Quality evaluation function */
  evaluateQuality: (result: any, expected: any) => number;
}

export interface ABTestSample {
  /** Input data for the test */
  input: any;

  /** Expected output (for quality evaluation) */
  expected: any;

  /** Task type */
  taskType: AITaskType;
}

export interface ABTestResult {
  /** Prompt A performance */
  promptA: {
    avgQuality: number;
    avgTokens: number;
    avgCost: number;
    successRate: number;
  };

  /** Prompt B performance */
  promptB: {
    avgQuality: number;
    avgTokens: number;
    avgCost: number;
    successRate: number;
  };

  /** Winner (A or B or tie) */
  winner: 'A' | 'B' | 'tie';

  /** Statistical confidence (0-1) */
  confidence: number;

  /** Recommendation */
  recommendation: string;
}

// ============================================================================
// Optimized Prompt Templates (Claude 4.5 Family)
// ============================================================================

const PROMPTS: Record<AITaskType, PromptTemplate> = {
  screenshot_analysis_realtime: {
    task: 'screenshot_analysis_realtime',
    simple: `Analyze this screenshot from an active work session.

Output JSON with:
- summary (1 sentence, max 120 chars)
- detectedActivity (coding|meeting|research|design|other)
- keyElements (array, max 3 items)
- confidence (0-1)

Be concise. Focus on what changed since last screenshot.`,
    detailed: `You are analyzing a screenshot from an active work session to track progress in real-time.

Analyze the screenshot and provide:
1. A brief summary (1-2 sentences) of what the user is doing
2. The detected activity type (coding, meeting, research, design, debugging, planning, or other)
3. Key elements visible (max 5 items: applications, windows, content types)
4. Your confidence level (0-1) in the analysis

Context: This is for live progress tracking, so prioritize speed and relevance over exhaustive detail.

Return JSON format:
{
  "summary": "string",
  "detectedActivity": "string",
  "keyElements": ["string"],
  "confidence": number
}`,
    tokenCount: 150,
    expectedOutputTokens: 100,
    version: '1.0.0',
  },

  screenshot_analysis: {
    task: 'screenshot_analysis',
    simple: `Analyze work session screenshot.

JSON output:
{
  "summary": "What user is doing (1-2 sentences)",
  "detectedActivity": "coding|meeting|research|design|debugging|planning|other",
  "keyElements": ["visible apps/windows", "max 5"],
  "progressIndicators": {
    "achievements": ["completed items"],
    "blockers": ["problems encountered"],
    "insights": ["notable observations"]
  },
  "contextDelta": "What changed vs previous",
  "confidence": 0.0-1.0
}

Be specific and actionable.`,
    detailed: `Analyze this screenshot from a completed work session to extract comprehensive insights.

You will receive:
- Current screenshot
- Session context (name, description, previous screenshots)
- Timeline position

Provide a detailed analysis including:

1. **Summary**: 2-3 sentences describing what the user is doing and why
2. **Detected Activity**: Primary activity type (coding, meeting, research, design, debugging, planning, collaborative, learning, other)
3. **Key Elements**: List of visible applications, windows, tools, and content (max 5 most relevant)
4. **Progress Indicators**:
   - Achievements: Completed tasks, milestones reached, problems solved
   - Blockers: Obstacles encountered, errors, stuck points
   - Insights: Notable observations, patterns, workflow insights
5. **Context Delta**: What changed since the previous screenshot (new windows, closed apps, progress made)
6. **Confidence**: Your confidence level (0-1) in this analysis

Focus on actionable information that helps understand the user's work patterns and progress.

Return JSON format only.`,
    tokenCount: 250,
    expectedOutputTokens: 300,
    version: '1.0.0',
  },

  audio_transcription: {
    task: 'audio_transcription',
    simple: `Transcribe this audio from a work session.

Requirements:
- Verbatim transcription
- Speaker diarization if multiple speakers
- Timestamps for topic changes
- Filter filler words (um, uh, like)

Output clean, readable transcript.`,
    detailed: `Transcribe the provided audio from a work session.

Guidelines:
1. Provide verbatim transcription of spoken content
2. Include speaker labels if multiple speakers detected (Speaker 1, Speaker 2, etc.)
3. Add timestamps [MM:SS] at major topic transitions
4. Remove excessive filler words (um, uh, like) while preserving natural speech
5. Preserve technical terms, code snippets, and domain-specific vocabulary
6. Indicate [inaudible] where audio is unclear
7. Note [background noise], [laughter], etc. where relevant to context

Format as a clean, readable transcript that captures the essence of the conversation or narration.`,
    tokenCount: 180,
    expectedOutputTokens: 500,
    version: '1.0.0',
  },

  audio_insights: {
    task: 'audio_insights',
    simple: `Extract insights from work session audio.

JSON output:
{
  "keyTopics": ["main discussion topics"],
  "decisions": ["decisions made"],
  "actionItems": ["tasks identified"],
  "questions": ["open questions"],
  "sentiment": "productive|frustrated|exploratory|focused",
  "speakerCount": number
}`,
    detailed: `Analyze this work session audio transcription to extract structured insights.

Provide comprehensive analysis including:

1. **Key Topics**: Main subjects discussed or narrated (prioritized by importance)
2. **Decisions Made**: Concrete decisions, conclusions, or resolutions
3. **Action Items**: Tasks, TODOs, or next steps identified
4. **Questions Raised**: Open questions, unknowns, or areas needing investigation
5. **Technical Concepts**: Code, frameworks, tools, APIs mentioned
6. **Blockers**: Problems, errors, or obstacles discussed
7. **Breakthroughs**: "Aha!" moments, solutions discovered, insights gained
8. **Sentiment**: Overall emotional tone (productive, frustrated, exploratory, focused, collaborative, confused, energized)
9. **Speaker Dynamics**: Number of speakers, interaction style if multi-speaker
10. **Summary**: 2-3 sentence overview of the audio content

Focus on extracting actionable intelligence that complements visual screenshot analysis.

Return JSON format with all fields.`,
    tokenCount: 220,
    expectedOutputTokens: 400,
    version: '1.0.0',
  },

  video_chaptering: {
    task: 'video_chaptering',
    simple: `Detect chapter boundaries in work session.

Analyze timeline (screenshots, audio, activity changes).

For each chapter:
{
  "startTime": seconds,
  "endTime": seconds,
  "title": "brief chapter title",
  "summary": "what happened (1-2 sentences)",
  "keyTopics": ["main topics"],
  "confidence": 0.0-1.0
}

Aim for 3-8 chapters. Only split on major topic/activity changes.`,
    detailed: `Analyze this work session timeline to detect meaningful chapter boundaries.

You will receive:
- Session metadata (duration, name, description)
- Timeline data (screenshots with timestamps and AI analysis)
- Audio segment summaries (if available)
- Video frame samples (if available)

Detect chapter boundaries based on:
1. Major topic transitions (e.g., "debugging" → "code review" → "documentation")
2. Activity type changes (coding → meeting → research)
3. Application switches (VS Code → Browser → Slack)
4. Natural break points (long pauses, context switches, completion moments)

For each chapter, provide:
- **Start/End Time**: Precise timestamps in seconds from session start
- **Title**: Concise, descriptive chapter title (3-6 words)
- **Summary**: 2-3 sentences describing what occurred in this chapter
- **Key Topics**: Main subjects, tasks, or activities (max 5)
- **Confidence**: How confident you are in this chapter boundary (0-1)
- **Reasoning**: Brief explanation of why this is a chapter boundary

Guidelines:
- Aim for 3-8 chapters total (balance detail vs overview)
- Minimum chapter length: 2 minutes
- Only create chapters for meaningful transitions (not minor context switches)
- Ensure chapters cover the entire session with no gaps

Return array of chapter objects in chronological order.`,
    tokenCount: 300,
    expectedOutputTokens: 600,
    version: '1.0.0',
  },

  summary_brief: {
    task: 'summary_brief',
    simple: `Generate brief session summary.

JSON:
{
  "title": "Session title (5-8 words)",
  "oneLineSummary": "What was accomplished (1 sentence)",
  "category": "Deep Work|Meeting|Research|Learning|Mixed",
  "tags": ["relevant", "tags", "max 5"],
  "achievements": ["key accomplishments"],
  "duration": "formatted duration"
}

Concise and actionable.`,
    detailed: `Generate a brief summary of this work session.

Input data:
- Session metadata (name, start/end time, description)
- Screenshots with AI analysis
- Audio insights (if available)
- Video chapters (if available)

Provide:
1. **Title**: Concise session title (5-8 words) that captures the essence
2. **One-Line Summary**: Single sentence describing what was accomplished
3. **Category**: Primary session type (Deep Work, Quick Tasks, Meeting, Research, Learning, Troubleshooting, Mixed Work)
4. **Subcategory**: More specific classification
5. **Tags**: 3-5 relevant tags for organization and search
6. **Key Achievements**: Top 3-5 accomplishments or milestones
7. **Main Topics**: Primary subjects covered
8. **Duration Summary**: Human-friendly duration (e.g., "2.5 hours of focused coding")

Keep it concise and scannable - this is for quick review.

Return JSON format.`,
    tokenCount: 200,
    expectedOutputTokens: 250,
    version: '1.0.0',
  },

  summary_comprehensive: {
    task: 'summary_comprehensive',
    simple: `Generate comprehensive session summary.

Include:
- Title, category, tags
- Detailed narrative (3-5 paragraphs)
- Timeline of activities
- Achievements and blockers
- Key insights
- Related tasks/notes
- Next steps

Make it rich and informative for later review.`,
    detailed: `Generate a comprehensive, narrative-rich summary of this completed work session.

Input data includes:
- Session metadata
- All screenshots with AI analysis
- Full audio transcription and insights
- Video chapters
- Contextual data (tasks, notes, existing sessions)

Create a multi-section summary:

## Core Metadata
- Title (5-10 words)
- Category and subcategory
- Tags (5-10 tags)
- Duration and time of day

## Executive Summary
2-3 paragraphs providing a high-level overview of the session, what was accomplished, and why it matters.

## Detailed Narrative
Chronological story of the session (4-8 paragraphs):
- What did the user set out to do?
- How did the work unfold?
- What challenges were encountered and overcome?
- What insights or breakthroughs occurred?
- How did the session conclude?

## Timeline
Key moments with timestamps and descriptions.

## Achievements
- Completed tasks
- Milestones reached
- Problems solved
- Code written/refactored
- Documents created

## Blockers & Challenges
- Obstacles encountered
- Unresolved questions
- Technical debt identified

## Key Insights
- Lessons learned
- Patterns observed
- Workflow improvements discovered

## Technical Details
- Technologies used
- APIs/frameworks explored
- Code concepts applied

## Related Context
- Linked tasks
- Related notes
- Connected sessions

## Next Steps
- Follow-up actions
- Questions to investigate
- Areas to explore further

Make this summary rich enough that reviewing it 6 months later would clearly recall the session's context and value.

Return as flexible summary format (schemaVersion 2.0) with AI-chosen sections.`,
    tokenCount: 400,
    expectedOutputTokens: 1200,
    version: '1.0.0',
  },

  classification: {
    task: 'classification',
    simple: `Classify this session.

Output:
{
  "category": "Deep Work|Quick Tasks|Meeting|Research|Learning|Troubleshooting|Mixed",
  "subCategory": "specific type",
  "tags": ["max 5 tags"],
  "confidence": 0.0-1.0
}`,
    detailed: `Classify this work session based on the provided data.

Analyze screenshots, audio, and activity patterns to determine:

1. **Primary Category**: Choose the best fit:
   - Deep Work: Extended focused work on complex tasks
   - Quick Tasks: Short, discrete tasks (< 30 min)
   - Meeting: Collaborative sessions, calls, standups
   - Research: Exploration, learning, information gathering
   - Learning: Educational content, tutorials, courses
   - Troubleshooting: Debugging, fixing issues, problem-solving
   - Mixed Work: Combination of multiple activity types

2. **Subcategory**: More specific classification within the category (e.g., "API Integration" under Deep Work)

3. **Tags**: 3-5 relevant tags for search and organization

4. **Confidence**: How confident you are in this classification (0-1)

5. **Reasoning**: Brief explanation of why you chose this classification

Return JSON format.`,
    tokenCount: 180,
    expectedOutputTokens: 150,
    version: '1.0.0',
  },
};

// ============================================================================
// Prompt Optimization Service
// ============================================================================

export class PromptOptimizationService {
  private promptCache: Map<string, PromptTemplate> = new Map();
  private qualityMetrics: Map<string, number[]> = new Map();

  constructor() {
    // Initialize cache with default prompts
    Object.values(PROMPTS).forEach((template) => {
      this.promptCache.set(template.task, template);
    });
  }

  /**
   * Select optimal prompt for a given task and model
   *
   * @param taskType - Type of AI task
   * @param modelComplexity - Complexity of model ('simple' for Haiku, 'detailed' for Sonnet)
   * @param context - Additional context for prompt customization
   * @returns Optimized prompt string
   */
  selectPrompt(
    taskType: AITaskType,
    modelComplexity: 'simple' | 'detailed' = 'detailed',
    context?: PromptContext
  ): string {
    const template = this.promptCache.get(taskType);
    if (!template) {
      throw new Error(`No prompt template found for task: ${taskType}`);
    }

    let prompt = modelComplexity === 'simple' ? template.simple : template.detailed;

    // Inject context if provided
    if (context) {
      prompt = this.injectContext(prompt, context);
    }

    return prompt;
  }

  /**
   * Get prompt template for a task
   */
  getTemplate(taskType: AITaskType): PromptTemplate {
    const template = this.promptCache.get(taskType);
    if (!template) {
      throw new Error(`No prompt template found for task: ${taskType}`);
    }
    return template;
  }

  /**
   * Estimate token count for a prompt
   *
   * Uses rough approximation: 1 token ≈ 4 characters
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate token reduction percentage
   */
  calculateTokenReduction(originalPrompt: string, optimizedPrompt: string): number {
    const originalTokens = this.estimateTokens(originalPrompt);
    const optimizedTokens = this.estimateTokens(optimizedPrompt);
    return ((originalTokens - optimizedTokens) / originalTokens) * 100;
  }

  /**
   * A/B test two prompts
   *
   * Compares prompts on quality, cost, and success rate
   */
  async abTest(config: ABTestConfig): Promise<ABTestResult> {
    const resultsA: Array<{ quality: number; tokens: number; cost: number; success: boolean }> = [];
    const resultsB: Array<{ quality: number; tokens: number; cost: number; success: boolean }> = [];

    // Run tests for each sample
    for (const sample of config.testData) {
      // Test Prompt A
      try {
        const resultA = await this.runTestSample(config.promptA, sample);
        const qualityA = config.evaluateQuality(resultA.output, sample.expected);
        resultsA.push({
          quality: qualityA,
          tokens: resultA.tokens,
          cost: resultA.cost,
          success: true,
        });
      } catch (error) {
        resultsA.push({ quality: 0, tokens: 0, cost: 0, success: false });
      }

      // Test Prompt B
      try {
        const resultB = await this.runTestSample(config.promptB, sample);
        const qualityB = config.evaluateQuality(resultB.output, sample.expected);
        resultsB.push({
          quality: qualityB,
          tokens: resultB.tokens,
          cost: resultB.cost,
          success: true,
        });
      } catch (error) {
        resultsB.push({ quality: 0, tokens: 0, cost: 0, success: false });
      }
    }

    // Calculate aggregate metrics
    const avgQualityA = this.average(resultsA.map((r) => r.quality));
    const avgTokensA = this.average(resultsA.map((r) => r.tokens));
    const avgCostA = this.average(resultsA.map((r) => r.cost));
    const successRateA = resultsA.filter((r) => r.success).length / resultsA.length;

    const avgQualityB = this.average(resultsB.map((r) => r.quality));
    const avgTokensB = this.average(resultsB.map((r) => r.tokens));
    const avgCostB = this.average(resultsB.map((r) => r.cost));
    const successRateB = resultsB.filter((r) => r.success).length / resultsB.length;

    // Determine winner
    const qualityDiff = avgQualityA - avgQualityB;
    const costDiff = avgCostB - avgCostA; // Higher is better (B saves more)

    let winner: 'A' | 'B' | 'tie' = 'tie';
    let recommendation = '';

    // Winner logic: Quality is 2x more important than cost
    const scoreA = avgQualityA * 2 + (avgCostB - avgCostA);
    const scoreB = avgQualityB * 2 + (avgCostA - avgCostB);

    if (scoreA > scoreB + 0.1) {
      winner = 'A';
      recommendation = `Prompt A wins with ${qualityDiff > 0 ? 'better' : 'slightly worse'} quality and ${costDiff > 0 ? 'lower' : 'higher'} cost.`;
    } else if (scoreB > scoreA + 0.1) {
      winner = 'B';
      recommendation = `Prompt B wins with ${qualityDiff < 0 ? 'better' : 'slightly worse'} quality and ${costDiff < 0 ? 'lower' : 'higher'} cost.`;
    } else {
      recommendation = 'Both prompts perform similarly. Choose based on specific use case.';
    }

    // Calculate statistical confidence (simplified - would use t-test in production)
    const confidence = Math.min(0.95, successRateA * successRateB);

    return {
      promptA: {
        avgQuality: avgQualityA,
        avgTokens: avgTokensA,
        avgCost: avgCostA,
        successRate: successRateA,
      },
      promptB: {
        avgQuality: avgQualityB,
        avgTokens: avgTokensB,
        avgCost: avgCostB,
        successRate: successRateB,
      },
      winner,
      confidence,
      recommendation,
    };
  }

  /**
   * Measure quality of a result against expected output
   *
   * Returns score 0-1 based on:
   * - Completeness (all expected fields present)
   * - Accuracy (values match expected)
   * - Relevance (content is on-topic)
   */
  measureQuality(result: any, expected: any): number {
    if (!result || !expected) return 0;

    let score = 0;
    let totalChecks = 0;

    // Check completeness (50% of score)
    const expectedKeys = Object.keys(expected);
    const resultKeys = Object.keys(result);

    expectedKeys.forEach((key) => {
      totalChecks++;
      if (resultKeys.includes(key) && result[key] !== undefined && result[key] !== null) {
        score += 0.5;
      }
    });

    // Check accuracy (30% of score)
    expectedKeys.forEach((key) => {
      if (result[key] !== undefined) {
        totalChecks++;
        if (typeof expected[key] === 'string') {
          // String similarity (simplified - would use Levenshtein in production)
          const similarity = this.stringSimilarity(
            String(result[key]).toLowerCase(),
            String(expected[key]).toLowerCase()
          );
          score += similarity * 0.3;
        } else if (typeof expected[key] === 'number') {
          // Numeric closeness
          const diff = Math.abs(result[key] - expected[key]);
          const closeness = Math.max(0, 1 - diff / Math.abs(expected[key]));
          score += closeness * 0.3;
        } else if (Array.isArray(expected[key])) {
          // Array overlap
          const overlap = this.arrayOverlap(result[key], expected[key]);
          score += overlap * 0.3;
        } else {
          // Exact match for other types
          score += (result[key] === expected[key] ? 1 : 0) * 0.3;
        }
      }
    });

    // Check relevance (20% of score)
    // Simplified: Check if result has reasonable content
    totalChecks++;
    if (
      resultKeys.length > 0 &&
      resultKeys.some((key) => {
        const val = result[key];
        return (
          val !== undefined &&
          val !== null &&
          val !== '' &&
          !(Array.isArray(val) && val.length === 0)
        );
      })
    ) {
      score += 0.2;
    }

    return Math.min(1, score / totalChecks);
  }

  /**
   * Track quality metrics for a prompt
   */
  trackQuality(promptKey: string, quality: number): void {
    if (!this.qualityMetrics.has(promptKey)) {
      this.qualityMetrics.set(promptKey, []);
    }
    this.qualityMetrics.get(promptKey)!.push(quality);
  }

  /**
   * Get average quality for a prompt
   */
  getAverageQuality(promptKey: string): number | null {
    const metrics = this.qualityMetrics.get(promptKey);
    if (!metrics || metrics.length === 0) return null;
    return this.average(metrics);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Inject context into a prompt template
   */
  private injectContext(prompt: string, context: PromptContext): string {
    let enrichedPrompt = prompt;

    // Add session context
    if (context.session) {
      const sessionInfo = `\nSession: ${context.session.name}${
        context.session.description ? `\nDescription: ${context.session.description}` : ''
      }`;
      enrichedPrompt = sessionInfo + '\n' + enrichedPrompt;
    }

    // Add previous context
    if (context.previousContext) {
      enrichedPrompt = `Previous context:\n${context.previousContext}\n\n` + enrichedPrompt;
    }

    // Add metadata
    if (context.metadata) {
      const metadataStr = Object.entries(context.metadata)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      enrichedPrompt = `Context:\n${metadataStr}\n\n` + enrichedPrompt;
    }

    return enrichedPrompt;
  }

  /**
   * Run a test sample (mock implementation - would call real AI in production)
   */
  private async runTestSample(
    prompt: string,
    sample: ABTestSample
  ): Promise<{ output: any; tokens: number; cost: number }> {
    // Mock implementation - in production would call actual AI API
    const tokens = this.estimateTokens(prompt);
    const cost = this.estimateCost(tokens, sample.taskType);

    // Simulate AI processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Mock output based on task type
    const output = this.mockOutput(sample.taskType, sample.input);

    return { output, tokens, cost };
  }

  /**
   * Estimate cost based on tokens and task type
   */
  private estimateCost(tokens: number, taskType: AITaskType): number {
    // Rough cost estimation (would use actual pricing in production)
    const inputCostPer1k = 0.003; // Sonnet 4.5 pricing
    const outputCostPer1k = 0.015;

    const inputCost = (tokens / 1000) * inputCostPer1k;
    const outputCost = (this.promptCache.get(taskType)?.expectedOutputTokens || 0 / 1000) * outputCostPer1k;

    return inputCost + outputCost;
  }

  /**
   * Mock output for testing (would be real AI response in production)
   */
  private mockOutput(taskType: AITaskType, input: any): any {
    // Simplified mock - return basic structure
    switch (taskType) {
      case 'screenshot_analysis':
      case 'screenshot_analysis_realtime':
        return {
          summary: 'Mock screenshot analysis',
          detectedActivity: 'coding',
          keyElements: ['VS Code', 'Terminal'],
          confidence: 0.85,
        };
      case 'classification':
        return {
          category: 'Deep Work',
          subCategory: 'Code Development',
          tags: ['typescript', 'development'],
          confidence: 0.9,
        };
      default:
        return { mock: true, taskType };
    }
  }

  /**
   * Calculate average of numbers
   */
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Calculate string similarity (simplified Jaccard)
   */
  private stringSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));
    const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.size / union.size;
  }

  /**
   * Calculate array overlap (Jaccard similarity)
   */
  private arrayOverlap(a: any[], b: any[]): number {
    if (!Array.isArray(a) || !Array.isArray(b)) return 0;
    if (a.length === 0 && b.length === 0) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }
}

/**
 * Export singleton instance
 */
export const promptOptimizationService = new PromptOptimizationService();
