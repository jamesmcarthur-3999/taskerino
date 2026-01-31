// src/bots/types.ts
import { z } from 'zod';

// ============================================================================
// SCREENSHOT ANALYSIS TYPES
// ============================================================================

export const ProgressIndicatorsSchema = z.object({
  achievements: z.array(z.string()).describe('Completed milestones'),
  blockers: z.array(z.string()).describe('Errors or obstacles encountered'),
  insights: z.array(z.string()).describe('Learnings discovered'),
});

export const ScreenshotAnalysisSchema = z.object({
  summary: z.string().describe('1-2 sentences of what was accomplished'),
  detectedActivity: z.string().describe('Activity type, e.g., "Debugging auth flow"'),
  extractedText: z.string().describe('Important text: URLs, errors, data'),
  keyElements: z.array(z.string()).describe('Key UI elements or actions'),
  suggestedActions: z.array(z.string()).describe('Actionable items'),
  contextDelta: z.string().describe('What changed or progressed since last screenshot'),
  confidence: z.number().min(0).max(1).describe('Confidence based on image clarity'),
  curiosity: z.number().min(0).max(1).describe('Interest score for next screenshot timing'),
  curiosityReason: z.string().describe('Why this curiosity score'),
  progressIndicators: ProgressIndicatorsSchema,
});

export type ScreenshotAnalysis = z.infer<typeof ScreenshotAnalysisSchema>;

// ============================================================================
// SESSION SUMMARY TYPES
// ============================================================================

export const RecommendedTaskSchema = z.object({
  title: z.string(),
  context: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  relatedScreenshotIds: z.array(z.string()),
});

export const KeyInsightSchema = z.object({
  insight: z.string(),
  timestamp: z.string().describe('ISO timestamp'),
  screenshotIds: z.array(z.string()),
});

export const FocusAreaSchema = z.object({
  area: z.string(),
  duration: z.number().describe('Duration in minutes'),
  percentage: z.number(),
});

export const SessionSummarySchema = z.object({
  narrative: z.string().describe('1-2 paragraph story of the session'),
  achievements: z.array(z.string()),
  blockers: z.array(z.string()),
  recommendedTasks: z.array(RecommendedTaskSchema),
  keyInsights: z.array(KeyInsightSchema),
  focusAreas: z.array(FocusAreaSchema),
  category: z.string().describe('Work category'),
  subCategory: z.string().describe('Specific work type'),
  tags: z.array(z.string()).describe('Searchable keywords'),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

// ============================================================================
// AUDIO REVIEW TYPES
// ============================================================================

export const EmotionalMomentSchema = z.object({
  timestamp: z.number().describe('Seconds from start'),
  emotion: z.string(),
  description: z.string(),
});

export const KeyMomentSchema = z.object({
  timestamp: z.number().describe('Seconds from start'),
  type: z.string().describe('Type of moment: breakthrough, blocker, decision'),
  description: z.string(),
  context: z.string(),
  excerpt: z.string().describe('Direct quote from audio'),
});

export const FlowStateSchema = z.object({
  start: z.number(),
  end: z.number(),
  description: z.string(),
});

export const AudioInsightsSchema = z.object({
  narrative: z.string().describe('Overall audio narrative'),
  emotionalJourney: z.array(EmotionalMomentSchema),
  keyMoments: z.array(KeyMomentSchema),
  workPatterns: z.object({
    focusLevel: z.enum(['high', 'medium', 'low']),
    interruptions: z.number(),
    flowStates: z.array(FlowStateSchema),
  }),
  environmentalContext: z.object({
    workSetting: z.string(),
    ambientNoise: z.string(),
    timeOfDay: z.string(),
  }),
});

export type AudioInsights = z.infer<typeof AudioInsightsSchema>;

// ============================================================================
// CAPTURE PROCESSING TYPES
// ============================================================================

export const DetectedTopicSchema = z.object({
  name: z.string(),
  type: z.enum(['company', 'person', 'other']),
  confidence: z.number().min(0).max(1),
  existingTopicId: z.string().optional(),
});

export const ExtractedNoteSchema = z.object({
  topicId: z.string().describe('"new" if creating new topic'),
  topicName: z.string(),
  content: z.string().describe('Markdown content'),
  summary: z.string(),
  sourceText: z.string(),
  isNew: z.boolean(),
  mergedWith: z.string().optional(),
  tags: z.array(z.string()),
  source: z.enum(['call', 'email', 'thought', 'other']),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  keyPoints: z.array(z.string()),
  relatedTopics: z.array(z.string()),
});

export const ExtractedTaskSchema = z.object({
  title: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueDate: z.string().optional().describe('YYYY-MM-DD format'),
  dueTime: z.string().optional().describe('HH:MM format'),
  dueDateReasoning: z.string(),
  description: z.string(),
  sourceExcerpt: z.string(),
  tags: z.array(z.string()),
  suggestedSubtasks: z.array(z.string()),
  topicId: z.string().optional(),
});

export const CaptureResultSchema = z.object({
  detectedTopics: z.array(DetectedTopicSchema),
  notes: z.array(ExtractedNoteSchema),
  tasks: z.array(ExtractedTaskSchema),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  keyTopics: z.array(z.string()),
});

export type CaptureResult = z.infer<typeof CaptureResultSchema>;

// ============================================================================
// SEARCH TYPES
// ============================================================================

export const SearchResultSchema = z.object({
  noteIds: z.array(z.string()).describe('IDs of matching notes'),
  taskIds: z.array(z.string()).describe('IDs of matching tasks'),
  summary: z.string().describe('Text summary of results'),
  suggestions: z.array(z.string()).optional().describe('Follow-up search suggestions'),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SessionSearchResultSchema = z.object({
  sessionIds: z.array(z.string()).describe('IDs of matching sessions'),
  summary: z.string().describe('Text summary of results'),
  suggestions: z.array(z.string()).optional(),
});

export type SessionSearchResult = z.infer<typeof SessionSearchResultSchema>;
