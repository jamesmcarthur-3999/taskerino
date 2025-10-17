import { invoke } from '@tauri-apps/api/core';
import type {
  ClaudeMessage,
  ClaudeChatResponse
} from '../types/tauri-ai-commands';
import type { Session, SessionSummary, SessionScreenshot, SessionAudioSegment, SessionContextItem } from '../types';

/**
 * Synthesize session analyses into a comprehensive summary
 * Uses text-to-text AI (no images) to create the narrative
 */
export async function synthesizeSessionSummary(
  session: Session,
  apiKey: string
): Promise<SessionSummary> {
  // Store API key in Tauri backend
  await invoke('set_claude_api_key', { apiKey: apiKey.trim() });

  // Merge screenshots, audio segments, and user context chronologically
  type TimelineItem =
    | { type: 'screenshot'; timestamp: string; data: SessionScreenshot }
    | { type: 'audio'; timestamp: string; data: SessionAudioSegment }
    | { type: 'context'; timestamp: string; data: SessionContextItem };

  const timelineItems: TimelineItem[] = [
    ...(session.screenshots || [])
      .filter(s => s.aiAnalysis)
      .map(s => ({ type: 'screenshot' as const, timestamp: s.timestamp, data: s })),
    ...(session.audioSegments || [])
      .map(a => ({ type: 'audio' as const, timestamp: a.timestamp, data: a })),
    ...(session.contextItems || [])
      .map(c => ({ type: 'context' as const, timestamp: c.timestamp, data: c }))
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Collect all analyses (screenshots + audio transcripts + user context)
  const analyses = timelineItems
    .map((item, index) => {
      if (item.type === 'screenshot') {
        const screenshot = item.data as SessionScreenshot;
        const analysis = screenshot.aiAnalysis!;
        return `
**Screenshot ${index + 1}** (${new Date(screenshot.timestamp).toLocaleTimeString()})
- **Activity**: ${analysis.detectedActivity}
- **Summary**: ${analysis.summary}
- **Context**: ${analysis.contextDelta || 'N/A'}
- **Key Elements**: ${analysis.keyElements?.join(', ') || 'None'}
${analysis.progressIndicators?.achievements?.length ? `- **Achievements**: ${analysis.progressIndicators.achievements.join('; ')}` : ''}
${analysis.progressIndicators?.blockers?.length ? `- **Blockers**: ${analysis.progressIndicators.blockers.join('; ')}` : ''}
${analysis.progressIndicators?.insights?.length ? `- **Insights**: ${analysis.progressIndicators.insights.join('; ')}` : ''}
${analysis.suggestedActions?.length ? `- **Suggested Actions**: ${analysis.suggestedActions.join('; ')}` : ''}
${screenshot.userComment ? `- **User Comment**: ${screenshot.userComment}` : ''}
`;
      } else if (item.type === 'audio') {
        const audioSegment = item.data as SessionAudioSegment;
        return `
**Audio Segment ${index + 1}** (${new Date(audioSegment.timestamp).toLocaleTimeString()}, ${audioSegment.duration}s)
- **Mode**: ${audioSegment.mode === 'transcription' ? 'Voice Transcription' : 'Audio Description'}
- **Content**: "${audioSegment.transcription}"
${audioSegment.description ? `- **Environment**: ${audioSegment.description}` : ''}
`;
      } else {
        const contextItem = item.data as SessionContextItem;
        return `
**User Context ${index + 1}** (${new Date(contextItem.timestamp).toLocaleTimeString()})
- **Note from User**: "${contextItem.content}"
`;
      }
    })
    .join('\n');

  const duration = calculateSessionDuration(session);

  const audioCount = session.audioSegments?.length || 0;
  const screenshotCount = session.screenshots?.length || 0;
  const contextCount = session.contextItems?.length || 0;
  const isLiveSession = session.status === 'active';

  // Session-aware prompt
  const sessionStatusContext = isLiveSession
    ? `**SESSION STATUS: LIVE & ONGOING** 🔴
This session is currently IN PROGRESS. The user is actively working RIGHT NOW.

**Important Live Session Guidelines:**
- Use PRESENT TENSE for current activities ("Working on...", "Building...", "Debugging...")
- Use "so far" language for achievements ("Completed X so far", "Made progress on Y")
- Focus on momentum and current focus
- Include a \`liveSnapshot\` field with:
  - \`currentFocus\`: One sentence about what they're doing RIGHT NOW (present tense)
  - \`progressToday\`: Up to 3 key achievements SO FAR (not comprehensive, just highlights)
  - \`momentum\`: "high" (deep focus, making progress), "medium" (working but interrupted), or "low" (frequent context switches)
- Keep it energizing and forward-looking`
    : `**SESSION STATUS: COMPLETED** ✓
This session is complete. Provide a full retrospective summary.

**Important Completed Session Guidelines:**
- Use PAST TENSE for all activities
- Provide comprehensive achievements and blockers
- DO NOT include a \`liveSnapshot\` field (this is only for live sessions)
- Focus on lessons learned and outcomes`;

  const prompt = `You are synthesizing a work session into a ${isLiveSession ? 'LIVE' : 'comprehensive'} summary.

**Session: "${session.name}"**
**Description**: ${session.description || 'No description provided'}
**Duration**: ${duration} minutes ${isLiveSession ? '(and counting...)' : ''}
**Data Captured**: ${screenshotCount} screenshots, ${audioCount} audio segments, ${contextCount} user notes

${sessionStatusContext}

**Timeline Data (chronological order):**
${analyses}

**Your Task:**
Synthesize the timeline data into a cohesive session summary. ${isLiveSession ? 'Remember: this is a LIVE session - focus on current activity and momentum.' : 'Think of this as telling the complete story of the work session.'}

**Focus on:**
1. **Narrative Flow**: ${isLiveSession ? 'What is the user doing now? What have they accomplished so far?' : 'What did the user accomplish? How did the work progress from start to finish?'}
2. **Achievements**: ${isLiveSession ? 'What has been completed or accomplished SO FAR?' : 'What was completed, fixed, or accomplished?'}
3. **Blockers**: What obstacles or issues were encountered?
4. **Consolidated Tasks**: Extract unique, actionable tasks (avoid duplicates from multiple sources)
5. **Key Insights**: Important discoveries, learnings, or observations worth preserving
6. **Focus Areas**: What activities took the most time?

**Guidelines:**
- Write a narrative that flows chronologically
- User notes are direct input from the user - treat them as important context
- PRESERVE temporal context: Include timestamps for achievements and blockers
- Extract achievements/blockers per screenshot if they represent distinct progress
- Identify KEY MOMENTS: transitions, breakthroughs, context switches
- Create enriched versions (achievementsEnhanced, blockersEnhanced) alongside flat arrays
- Extract only unique, high-value tasks (not every suggestion)
- Prioritize tasks based on context and urgency
- Identify patterns in how time was spent
- Be concise but informative

Return a comprehensive session summary as JSON with these fields:

**CORE FIELDS (required - unchanged for backward compatibility):**
- **narrative**: 1-2 paragraph story of what was accomplished
- **achievements**: Array of strings (simple format for backward compatibility)
- **blockers**: Array of strings (simple format for backward compatibility)
- **recommendedTasks**: Array of task objects
- **keyInsights**: Array of insight objects
- **focusAreas**: Array of focus area objects
- **category**, **subCategory**, **tags**: Classification fields
- **lastUpdated**: Current timestamp
- **screenshotCount**: ${screenshotCount}
- **audioSegmentCount**: ${audioCount}

**NEW OPTIONAL FIELDS (add these for richer visualization):**
- **achievementsEnhanced**: Array of objects with:
  - id: unique identifier
  - text: achievement description
  - timestamp: ISO 8601 timestamp when it occurred
  - screenshotIds: array of related screenshot IDs
  - importance: "minor" | "moderate" | "major" | "critical"
  - category: "feature" | "bugfix" | "optimization" | "deployment" | "other"

- **blockersEnhanced**: Array of objects with:
  - id: unique identifier
  - text: blocker description
  - timestamp: ISO 8601 timestamp when encountered
  - screenshotIds: array of related screenshot IDs
  - severity: "low" | "medium" | "high" | "critical"
  - status: "unresolved" | "resolved" | "workaround"
  - resolvedAt: (optional) timestamp if resolved
  - resolution: (optional) how it was resolved

- **keyMoments**: Array of significant moments:
  - id: unique identifier
  - type: "transition" | "breakthrough" | "context_switch" | "milestone" | "decision"
  - timestamp: ISO 8601 timestamp
  - title: brief title
  - description: 1-2 sentence description
  - screenshotIds: (optional) related screenshots
  - impact: "low" | "medium" | "high"

- **dynamicInsights**: Array of session-specific insights:
  - type: descriptive category (e.g., "flow-state", "error-pattern", "learning-trajectory")
  - title: brief title
  - description: detailed description
  - timestamp: (optional) when this was observed
  - confidence: 0-1 confidence score
  - metadata: (optional) any additional structured data

- **generationMetadata**: AI reasoning:
  - reasoning: Why you structured the summary this way
  - confidence: 0-1 overall confidence in summary
  - detectedSessionType: "deep-work" | "exploratory" | "collaborative" | "learning" | "troubleshooting" | "creative" | "routine" | "mixed"
  - primaryTheme: Brief theme description
  - warnings: (optional) array of caveats

**EXTRACTION GUIDELINES:**
- When extracting achievements/blockers, note WHEN they happened (use screenshot timestamps)
- Create a keyMoment for:
  - Transitions: "Switched from research to implementation"
  - Breakthroughs: "Identified root cause of bug"
  - Context switches: "Moved from feature A to feature B"
  - Milestones: "Completed major component"
- Use dynamicInsights for:
  - Detected patterns (e.g., "User entered flow state for 90 minutes")
  - Unusual observations (e.g., "High screenshot frequency during debugging")
  - Session-specific insights that don't fit elsewhere
- Assign importance/severity based on impact and urgency signals
- Generate BOTH flat arrays (achievements, blockers) AND enhanced versions

Return ONLY valid JSON (no markdown):
{
  "narrative": "${isLiveSession ? 'Present-tense story of what the user is working on. Example: Currently building an OAuth login flow after spending time researching libraries. Made good progress implementing the core flow, but now debugging CORS issues that are blocking progress.' : '2-3 paragraph past-tense story of the session. Example: Started by researching authentication libraries, spending 20 minutes comparing options. Implemented OAuth flow using library X, which took most of the session. Encountered CORS issues that blocked progress. Finally resolved by configuring proxy settings.'}",
  ${isLiveSession ? `"liveSnapshot": {
    "currentFocus": "One sentence about what they're doing RIGHT NOW (present tense, e.g., 'Debugging CORS errors in the authentication flow')",
    "progressToday": [
      "First achievement so far",
      "Second achievement so far",
      "Third achievement so far"
    ],
    "momentum": "high|medium|low (assess current work momentum based on activity patterns)"
  },` : ''}
  "achievements": [
    "Implemented OAuth login flow",
    "Fixed CORS configuration",
    "Added error handling for 401 responses"
  ],
  "blockers": [
    "Missing production API credentials - blocked deployment",
    "CORS errors in production environment"
  ],
  "achievementsEnhanced": [
    {
      "id": "ach-1",
      "text": "Implemented OAuth login flow",
      "timestamp": "2024-01-15T14:20:00Z",
      "screenshotIds": ["screenshot-id-3", "screenshot-id-4"],
      "importance": "major",
      "category": "feature"
    },
    {
      "id": "ach-2",
      "text": "Fixed CORS configuration",
      "timestamp": "2024-01-15T15:10:00Z",
      "screenshotIds": ["screenshot-id-7"],
      "importance": "critical",
      "category": "bugfix"
    }
  ],
  "blockersEnhanced": [
    {
      "id": "block-1",
      "text": "Missing production API credentials - blocked deployment",
      "timestamp": "2024-01-15T14:45:00Z",
      "screenshotIds": ["screenshot-id-5"],
      "severity": "high",
      "status": "unresolved"
    },
    {
      "id": "block-2",
      "text": "CORS errors in production environment",
      "timestamp": "2024-01-15T15:00:00Z",
      "screenshotIds": ["screenshot-id-6", "screenshot-id-7"],
      "severity": "critical",
      "status": "resolved",
      "resolvedAt": "2024-01-15T15:10:00Z",
      "resolution": "Updated proxy configuration to allow cross-origin requests"
    }
  ],
  "keyMoments": [
    {
      "id": "moment-1",
      "type": "transition",
      "timestamp": "2024-01-15T14:15:00Z",
      "title": "Switched from research to implementation",
      "description": "After evaluating authentication libraries for 20 minutes, made decision to use Library X and began implementing OAuth flow.",
      "screenshotIds": ["screenshot-id-2", "screenshot-id-3"],
      "impact": "medium"
    },
    {
      "id": "moment-2",
      "type": "breakthrough",
      "timestamp": "2024-01-15T15:05:00Z",
      "title": "Identified root cause of CORS errors",
      "description": "Discovered that production proxy configuration was missing CORS headers, leading to immediate fix.",
      "screenshotIds": ["screenshot-id-6"],
      "impact": "high"
    }
  ],
  "dynamicInsights": [
    {
      "type": "flow-state",
      "title": "Deep focus period during implementation",
      "description": "User maintained consistent focus for 45 minutes during OAuth implementation with minimal context switching, indicating strong flow state.",
      "timestamp": "2024-01-15T14:15:00Z",
      "confidence": 0.85,
      "metadata": {
        "duration": 45,
        "screenshotFrequency": "regular",
        "contextSwitches": 0
      }
    },
    {
      "type": "error-pattern",
      "title": "Recurring CORS issues across environments",
      "description": "Multiple screenshots show CORS-related errors, suggesting this is a systemic configuration issue rather than isolated problem.",
      "confidence": 0.9
    }
  ],
  "generationMetadata": {
    "reasoning": "This session shows a clear progression from research to implementation to debugging. The high screenshot frequency during debugging indicated this was a critical blocker. The successful resolution of CORS issues was identified as a breakthrough moment.",
    "confidence": 0.88,
    "detectedSessionType": "troubleshooting",
    "primaryTheme": "Authentication implementation with focus on resolving production deployment blockers",
    "warnings": ["Limited audio context available - summary primarily based on screenshot analyses"]
  },
  "recommendedTasks": [
    {
      "title": "Request production API credentials from DevOps",
      "priority": "high",
      "context": "Required for deployment - currently blocking release",
      "relatedScreenshotIds": ["screenshot-id-1", "screenshot-id-3"]
    },
    {
      "title": "Write tests for authentication flow",
      "priority": "medium",
      "context": "New feature needs test coverage before merging",
      "relatedScreenshotIds": ["screenshot-id-5"]
    }
  ],
  "keyInsights": [
    {
      "insight": "Token refresh fails when user is offline - needs edge case handling",
      "timestamp": "2024-01-15T14:30:00Z",
      "screenshotIds": ["screenshot-id-4"]
    },
    {
      "insight": "Library X has better TypeScript support than alternatives",
      "timestamp": "2024-01-15T14:10:00Z",
      "screenshotIds": ["screenshot-id-1", "screenshot-id-2"]
    }
  ],
  "focusAreas": [
    {
      "area": "Authentication Development",
      "duration": 45,
      "percentage": 60
    },
    {
      "area": "Debugging CORS Issues",
      "duration": 20,
      "percentage": 27
    },
    {
      "area": "Research & Documentation",
      "duration": 10,
      "percentage": 13
    }
  ],
  "lastUpdated": "${new Date().toISOString()}",
  "screenshotCount": ${screenshotCount},
  "audioSegmentCount": ${audioCount}
}

**Important:**
- ${isLiveSession ? 'Use PRESENT TENSE and "so far" language throughout' : 'Use PAST TENSE throughout'}
- ${isLiveSession ? 'MUST include liveSnapshot field' : 'DO NOT include liveSnapshot field'}
- Ensure the narrative tells a coherent story
- PRESERVE timestamps: Include temporal context in enhanced fields (achievementsEnhanced, blockersEnhanced, keyMoments)
- Generate BOTH flat arrays (achievements, blockers) AND enhanced versions with timestamps
- For flat arrays: Consolidate duplicate items (if 3 screenshots mention "fix CORS", that's ONE achievement)
- For enhanced arrays: Preserve separate entries with timestamps if they represent distinct progress moments
- Only extract tasks that are truly actionable and valuable
- Use actual screenshot IDs from the analyses
- Focus areas should sum to 100% and reflect actual time distribution
- Be specific and actionable
- Be creative with dynamicInsights - include any interesting patterns or observations
- Include keyMoments for transitions, breakthroughs, and context switches`;

  try {
    console.log('📊 SessionSynthesis: Synthesizing session summary...');

    const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
      request: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        messages: [{ role: 'user', content: prompt }],
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

    const summary: SessionSummary = JSON.parse(jsonText);

    console.log('✅ SessionSynthesis: Summary generated', {
      achievements: summary.achievements?.length || 0,
      blockers: summary.blockers?.length || 0,
      tasks: summary.recommendedTasks?.length || 0,
      insights: summary.keyInsights?.length || 0,
    });

    return summary;
  } catch (error) {
    console.error('❌ SessionSynthesis: Failed to synthesize summary:', error);
    throw error;
  }
}

/**
 * Calculate session duration in minutes
 */
function calculateSessionDuration(session: Session): number {
  if (!session.startTime) return 0;
  const endTime = session.endTime ? new Date(session.endTime) : new Date();
  return Math.floor(
    (endTime.getTime() - new Date(session.startTime).getTime()) / (1000 * 60)
  );
}
