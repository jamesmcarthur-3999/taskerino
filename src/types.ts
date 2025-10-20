// Core Data Types

import type { CanvasSpec } from './services/aiCanvasGenerator';

// Attachment Types
export type AttachmentType = 'image' | 'video' | 'file' | 'link' | 'screenshot' | 'audio';

export interface Attachment {
  id: string;
  type: AttachmentType;
  name: string;                    // Original filename or generated name
  mimeType: string;                // 'image/png', 'video/mp4', etc.
  size: number;                    // File size in bytes
  createdAt: string;

  // Storage reference
  path?: string;                   // Local file path (Tauri)
  base64?: string;                 // Inline data for smaller files
  url?: string;                    // For link attachments

  // Metadata
  thumbnail?: string;              // Base64 thumbnail for videos/large images
  dimensions?: { width: number; height: number };
  duration?: number;               // For videos (seconds)

  // AI Processing
  aiAnalysis?: {
    description: string;           // What Claude sees in the image
    extractedText?: string;        // OCR or text from image
    detectedObjects?: string[];
    confidence: number;
  };

  // Audio-specific fields
  waveform?: number[];             // Simplified waveform data for visualization (0-1 normalized)
  compressed?: string;             // Compressed audio (MP3 base64) for AI processing
}

// Company profile with detailed information
export interface Company {
  id: string;
  name: string;
  createdAt: string;
  lastUpdated: string;
  noteCount: number;

  // Profile information (to be fleshed out later)
  profile?: {
    industry?: string;
    size?: string;
    website?: string;
    description?: string;
    logoUrl?: string;
    // More fields to be added
  };
}

// Contact (person) profile with detailed information
export interface Contact {
  id: string;
  name: string;
  createdAt: string;
  lastUpdated: string;
  noteCount: number;

  // Profile information (to be fleshed out later)
  profile?: {
    role?: string;
    companyId?: string; // Link to Company
    email?: string;
    phone?: string;
    photoUrl?: string;
    // More fields to be added
  };
}

// Simple topic for "other" category
export interface Topic {
  id: string;
  name: string;
  createdAt: string;
  lastUpdated: string;
  noteCount: number;
}

export interface NoteUpdate {
  id: string;
  content: string;
  timestamp: string;
  source: 'call' | 'email' | 'thought' | 'other';
  summary?: string;
  sourceText?: string;
  tags?: string[];
}

export interface Note {
  id: string;

  // Multiple relationship support
  companyIds?: string[]; // Links to Company entities
  contactIds?: string[]; // Links to Contact (person) entities
  topicIds?: string[]; // Links to Topic entities (for "other" category)

  // Legacy field for migration (will be removed after migration)
  topicId?: string;

  content: string; // The actual note content (markdown) - most recent or combined
  summary: string; // AI-generated summary
  sourceText?: string; // Original input text (for validation)
  timestamp: string; // Original creation time
  lastUpdated: string; // Most recent update time
  source: 'call' | 'email' | 'thought' | 'other';
  tags: string[]; // Auto-extracted by AI
  parentNoteId?: string; // For threading/nesting
  sourceSessionId?: string; // Link back to originating session
  updates?: NoteUpdate[]; // History of additions/updates (newest first)
  attachments?: Attachment[]; // Multi-modal attachments
  metadata?: {
    // Optional metadata
    sentiment?: 'positive' | 'neutral' | 'negative';
    keyPoints?: string[];
    relatedTopics?: string[];
  };
}

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

export interface Task {
  // Core fields
  id: string;
  title: string;
  done: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  dueTime?: string; // NEW: Specific time in 24h format (e.g., "18:00")
  topicId?: string; // Optional link to topic
  noteId?: string; // Which note created this task
  createdAt: string;
  completedAt?: string;

  // Phase 1 - Enhanced fields
  description?: string; // Rich text description
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  subtasks?: SubTask[]; // Checklist items
  tags?: string[]; // Task-specific tags
  createdBy: 'ai' | 'manual'; // Creation source
  attachments?: Attachment[]; // Multi-modal attachments

  // Source tracking (for agent capabilities)
  sourceNoteId?: string; // NEW: Link back to originating note
  sourceSessionId?: string; // Link back to originating session
  sourceExcerpt?: string; // NEW: Exact text that triggered this task
  contextForAgent?: string; // NEW: AI-generated context for future agents

  // AI Context (when created by AI)
  aiContext?: {
    sourceNoteId: string;
    extractedFrom: string; // Text snippet from note
    confidence: number; // 0-1
    reasoning?: string; // Why AI created this task
  };
}

// AI Processing Types

export interface AIProcessResult {
  // What the AI detected
  detectedTopics: {
    name: string;
    type: 'company' | 'person' | 'other';
    confidence: number; // 0-1
    existingTopicId?: string; // If matched to existing
  }[];

  // What was created/updated
  notes: {
    topicId: string;
    topicName: string;
    content: string;
    summary: string;
    sourceText: string; // Original input text
    isNew: boolean; // true if new note, false if merged
    mergedWith?: string; // Note ID if merged
    tags?: string[]; // Auto-extracted tags
    source?: 'call' | 'email' | 'thought' | 'other'; // Input type
    sentiment?: 'positive' | 'neutral' | 'negative';
    keyPoints?: string[]; // Bullet points of key info
    relatedTopics?: string[]; // Related topic names
  }[];

  tasks: {
    title: string;
    priority: Task['priority'];
    dueDate?: string; // AI-inferred due date
    dueTime?: string; // AI-inferred time (24h format, e.g., "18:00")
    dueDateReasoning?: string; // Why this date was chosen
    description?: string; // Task context from note
    tags?: string[]; // Relevant tags
    suggestedSubtasks?: string[]; // Multi-step breakdown
    topicId?: string;
    noteId?: string; // Link to the note that generated this task
    sourceExcerpt?: string; // Exact text from input that triggered this task
    contextForAgent?: string; // Context for future agent execution
  }[];

  // Duplicate/skipped tasks
  skippedTasks?: {
    title: string;
    reason: 'duplicate' | 'already_exists';
    existingTaskTitle?: string; // Title of the existing task
    sourceExcerpt?: string; // What triggered this detection
  }[];

  // Overall analysis
  sentiment?: 'positive' | 'neutral' | 'negative';
  keyTopics: string[];
  processingSteps: string[]; // For showing progress
}

export interface AIQueryResponse {
  answer: string;
  sources: {
    type: 'note' | 'task' | 'topic';
    id: string;
    excerpt: string;
    topicName?: string;
  }[];
  relatedTopics: string[]; // Topic IDs
  suggestedFollowUps?: string[]; // Suggested next questions
}

// UI & Navigation Types

export type TabType = 'capture' | 'tasks' | 'notes' | 'sessions' | 'assistant' | 'profile';

export interface ProcessingJob {
  id: string;
  type: 'note' | 'task';
  input: string;
  status: 'queued' | 'processing' | 'complete' | 'error';
  progress: number;
  currentStep?: string;
  processingSteps?: string[];
  result?: AIProcessResult;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export type NotificationType = 'success' | 'info' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  createdAt: string;
  read: boolean;
  autoDismiss?: boolean;
  dismissAfter?: number; // milliseconds
}

export interface UserPreferences {
  defaultView: {
    tasks: 'list' | 'grid' | 'kanban';
    notes: 'grid' | 'list';
  };
  filters: {
    tasks: {
      status?: Task['status'] | 'all';
      priority?: Task['priority'] | 'all';
      topicId?: string;
      tags?: string[];
    };
    notes: {
      topicId?: string;
      tags?: string[];
      sortBy?: 'recent' | 'oldest' | 'alphabetical';
    };
  };
  theme: 'light' | 'dark' | 'auto';
  compactMode: boolean;
  defaultTab: TabType;
  showReferencePanel: boolean;
  referencePanelWidth: number; // percentage
  dateFormat: '12h' | '24h';
  timezone: string; // IANA timezone string
  weekStartsOn: 'sunday' | 'monday';
  zoomLevel?: number; // zoom percentage (50-200, default: 100)
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  type: 'note' | 'task' | 'topic' | 'all';
  timestamp: string;
  resultCount: number;
}

export interface OnboardingState {
  completed: boolean;
  currentStep: number;
  dismissedTooltips: string[];
  featureIntroductions: {
    captureBox: boolean;
    toggles: boolean;
    quickAdd: boolean;
    filters: boolean;
    inlineEdit: boolean;
    cmdK: boolean;
    backgroundProcessing: boolean;
    nedAssistant: boolean;
    referencePanel: boolean;
    sessions: boolean;
    taskDetailSidebar: boolean;
    taskViews: boolean;
  };
  stats: {
    captureCount: number;
    taskCount: number;
    sessionCount: number;
    noteCount: number;
    nedQueryCount: number;
    tooltipsShown: number;
    tooltipsDismissed: number;
    lastActiveDate: string;
  };
  firstCaptureCompleted: boolean;
  interactiveTutorialShown: boolean;
}

export interface UIState {
  activeTab: TabType;
  referencePanelOpen: boolean;
  pinnedNotes: string[]; // Note IDs
  backgroundProcessing: {
    active: boolean;
    queue: ProcessingJob[];
    completed: ProcessingJob[];
  };
  notifications: Notification[];
  quickCaptureOpen: boolean;
  preferences: UserPreferences;
  bulkSelectionMode: boolean;
  selectedTasks: string[]; // Task IDs
  showCommandPalette: boolean;
  onboarding: OnboardingState;
  pendingReviewJobId?: string; // Job ID to open for review in CaptureZone
  nedOverlay: {
    isOpen: boolean;
  };
}

// AI Settings Type
export interface AISettings {
  systemInstructions: string;
  autoMergeNotes: boolean;
  autoExtractTasks: boolean;
}

// Learning System Settings Type
export interface LearningSettings {
  enabled: boolean;
  confirmationPoints: number;       // Points added per confirmation (default: 10)
  rejectionPenalty: number;         // Points removed per rejection (default: 20)
  applicationBonus: number;         // Points added per application (default: 1)
  flagMultiplier: number;           // Multiplier for flagged learnings (default: 1.5)
  timeDecayDays: number;            // Days before decay starts (default: 30)
  timeDecayRate: number;            // Decay rate per day (default: 0.5)
  thresholds: {
    deprecated: number;             // Below this = deprecated (default: 10)
    active: number;                 // Above this = active pattern (default: 50)
    rule: number;                   // Above this = strong rule (default: 80)
  };
}

// Ned AI Assistant Settings
export interface NedSettings {
  chattiness: 'concise' | 'balanced' | 'detailed';
  showThinking: boolean;
  permissions: NedPermission[];
  sessionPermissions: NedPermission[]; // Cleared on app restart
  tokenUsage: {
    total: number;
    thisMonth: number;
    estimatedCost: number;
  };
}

export interface NedPermission {
  toolName: string;
  level: 'forever' | 'session' | 'always-ask';
  grantedAt: string;
}

// Ned Conversation
export interface NedMessageContent {
  type: 'text' | 'task-list' | 'note-list' | 'tool-use' | 'tool-result' | 'error' | 'thinking' | 'task-update' | 'note-update' | 'task-created' | 'note-created' | 'session-list';
  content?: string;
  tasks?: Task[];
  notes?: Note[];
  toolName?: string;
  toolStatus?: 'pending' | 'success' | 'error';
}

export interface NedMessage {
  id: string;
  role: 'user' | 'assistant';
  contents: NedMessageContent[];
  timestamp: string;
}

export interface NedConversation {
  messages: NedMessage[];
}

// Application State

export interface AppState {
  companies: Company[];
  contacts: Contact[];
  topics: Topic[];
  notes: Note[];
  tasks: Task[];

  // Sessions State - NEW
  sessions: Session[];
  activeSessionId?: string; // Currently active session

  // UI State - NEW
  ui: UIState;

  // Legacy zone state (keep for migration)
  currentZone: 'capture' | 'tasks' | 'notes' | 'sessions' | 'assistant' | 'profile';
  activeTopicId?: string;
  activeNoteId?: string;

  // Search History
  searchHistory: SearchHistoryItem[];

  // User Profile
  userProfile: {
    name: string;
  };

  // AI Settings
  aiSettings: AISettings;

  // Learning System Settings
  learningSettings: LearningSettings;

  // Learning System
  learnings: UserLearnings;

  // Ned AI Assistant Settings
  nedSettings: NedSettings;

  // Ned Conversation
  nedConversation: NedConversation;

  // Sidebar State
  sidebar: {
    isOpen: boolean;
    type: 'task' | 'note' | 'settings' | null;
    itemId?: string; // task or note ID
    width: number; // Percentage
    history: Array<{
      type: 'task' | 'note' | 'settings';
      itemId?: string;
      label: string;
    }>;
  };
}

// Learning System Types

export type LearningCategory =
  | 'task-creation'    // How to create tasks
  | 'task-timing'      // Due date inference
  | 'task-priority'    // Priority assignment
  | 'topic-detection'  // Topic matching
  | 'note-merging'     // When to merge notes
  | 'tagging'          // Tag patterns
  | 'formatting';      // Content formatting

export type LearningStatus = 'active' | 'experimental' | 'deprecated';

export interface LearningEvidence {
  id: string;
  timestamp: string;
  context: string;           // What triggered this
  userAction: 'confirm' | 'modify' | 'reject' | 'ignore';
  details?: {
    before?: any;            // What AI did
    after?: any;             // What user changed it to
  };
}

export interface Learning {
  id: string;
  category: LearningCategory;
  pattern: string;           // What pattern was observed (e.g., "end of week")
  action: string;            // What AI should do (e.g., "Set due to Friday")
  strength: number;          // 0-100: observation → pattern → rule
  evidence: LearningEvidence[];
  createdAt: string;
  lastReinforced: string;
  timesApplied: number;      // How many times AI used this
  timesConfirmed: number;    // How many times user kept it
  timesRejected: number;     // How many times user changed it
  status: LearningStatus;
  isFlag: boolean;           // User-flagged for faster promotion
}

export interface UserLearnings {
  userId: string;            // For profile support
  profileName: string;       // "Sales Team", "Engineering", etc.
  learnings: Learning[];
  stats: {
    totalLearnings: number;
    activeRules: number;
    experimentalPatterns: number;
    observations: number;
  };
}

// Capture Draft (multi-modal input before processing)
export interface CaptureDraft {
  text: string;
  attachments: Attachment[];
  createdAt: string;
}

// Manual Creation Types

export interface ManualNoteData {
  content: string;
  topicId?: string;
  newTopicName?: string;
  newTopicType?: 'company' | 'person' | 'other';
  tags?: string[];
  source?: Note['source'];
  processWithAI?: boolean;
}

export interface ManualTopicData {
  name: string;
  type: 'company' | 'person' | 'other';
  description?: string;
}

export interface ManualTaskData {
  title: string;
  description?: string;
  priority?: Task['priority'];
  status?: Task['status'];
  dueDate?: string;
  topicId?: string;
  tags?: string[];
}

// Sessions Feature Types

// Session Summary - AI-generated synthesis of session activity
export interface SessionSummary {
  // The story
  narrative: string; // "Started by researching X, then built Y feature, encountered Z issue..."

  // Live session snapshot (only for active sessions)
  liveSnapshot?: {
    currentFocus: string; // What they're doing RIGHT NOW (1 sentence, present tense)
    progressToday: string[]; // Up to 3 achievements SO FAR (e.g., "Set up OAuth", "Fixed login bug")
    momentum: 'high' | 'medium' | 'low'; // Current work momentum
  };

  // Key outcomes
  achievements: string[]; // ["Completed login flow", "Fixed 3 critical bugs"]
  blockers: string[]; // ["Waiting on API key", "Build errors in CI"]

  // Actionable items (consolidated from all screenshots)
  recommendedTasks: Array<{
    title: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    context: string; // Why this task matters
    relatedScreenshotIds: string[]; // Which screenshots led to this
  }>;

  // Important observations
  keyInsights: Array<{
    insight: string;
    timestamp: string;
    screenshotIds: string[];
  }>;

  // Patterns & productivity
  focusAreas: Array<{
    area: string;
    duration: number; // minutes
    percentage: number;
  }>;

  // Metadata
  lastUpdated: string;
  screenshotCount: number; // How many screenshots were analyzed

  // DEPRECATED: Legacy properties for backward compatibility
  summary?: string;
  extractedTasks?: Array<{title: string; priority: string; context: string}>;
  extractedNotes?: Array<{content: string; tags: string[]}>;
  timeBreakdown?: Array<{activity: string; duration: number; percentage: number}>;
  keyActivities?: string[];

  // ========================================================================
  // NEW OPTIONAL FIELDS (Phase 1 - Temporal Context Enhancement)
  // ========================================================================

  /**
   * Enhanced achievements with temporal context
   * If present, these override the flat `achievements` array for richer visualization
   * OPTIONAL - system falls back to achievements[] if missing
   */
  achievementsEnhanced?: Array<{
    id: string;
    text: string;
    timestamp: string; // ISO 8601
    screenshotIds?: string[];
    importance?: 'minor' | 'moderate' | 'major' | 'critical';
    category?: string; // e.g., "feature", "bugfix", "optimization"
  }>;

  /**
   * Enhanced blockers with temporal context and resolution tracking
   * If present, these override the flat `blockers` array
   * OPTIONAL - system falls back to blockers[] if missing
   */
  blockersEnhanced?: Array<{
    id: string;
    text: string;
    timestamp: string; // ISO 8601
    screenshotIds?: string[];
    severity?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'unresolved' | 'resolved' | 'workaround';
    resolvedAt?: string; // ISO 8601
    resolution?: string; // How it was resolved
  }>;

  /**
   * Key moments during the session (transitions, breakthroughs, context switches)
   * These enable rich timeline visualization
   * OPTIONAL - canvas shows basic timeline if missing
   */
  keyMoments?: Array<{
    id: string;
    type: 'transition' | 'breakthrough' | 'context_switch' | 'milestone' | 'decision';
    timestamp: string; // ISO 8601
    title: string;
    description: string;
    screenshotIds?: string[];
    impact?: 'low' | 'medium' | 'high';
  }>;

  /**
   * Dynamic insights that don't fit standard categories
   * Allows AI to report session-specific discoveries
   * OPTIONAL - ignored if missing
   */
  dynamicInsights?: Array<{
    type: string; // AI-generated category (e.g., "flow-state", "error-pattern")
    title: string;
    description: string;
    timestamp?: string; // ISO 8601
    confidence: number; // 0-1
    metadata?: Record<string, any>; // Flexible additional data
  }>;

  /**
   * AI generation metadata (reasoning, confidence, detected patterns)
   * Provides transparency about how summary was generated
   * OPTIONAL - UI can show/hide this
   */
  generationMetadata?: {
    reasoning?: string; // Why AI chose this structure
    confidence?: number; // 0-1 overall confidence
    detectedSessionType?:
      | 'deep-work'
      | 'exploratory'
      | 'collaborative'
      | 'learning'
      | 'troubleshooting'
      | 'creative'
      | 'routine'
      | 'mixed';
    primaryTheme?: string;
    warnings?: string[]; // Any caveats about summary quality
  };
}

// ============================================================================
// FLEXIBLE SESSION SUMMARY (Phase 2 - Section-Based Architecture)
// ============================================================================

/**
 * Flexible session summary where AI chooses relevant sections
 *
 * Instead of forcing every session into the same template (achievements, blockers, etc.),
 * this allows the AI to compose summaries from a variety of section types based on
 * what's actually meaningful for THIS specific session.
 *
 * A debugging session might have: problem-solving-journey + technical-discoveries
 * A learning session might have: breakthrough-moments + learning-highlights
 * A meeting might have: collaboration-wins + emotional-journey
 *
 * The AI explains its choices via generationMetadata.
 */
export interface FlexibleSessionSummary {
  /** Schema version for migration */
  schemaVersion: '2.0';

  /** Unique identifier */
  id: string;

  /** When this summary was generated */
  generatedAt: string;

  /** Session metadata */
  sessionContext: {
    sessionId: string;
    sessionName: string;
    startTime: string;
    endTime?: string;
    duration: number; // minutes
    screenshotCount: number;
    audioSegmentCount?: number;
    videoChapterCount?: number;
  };

  /** Core narrative (required) */
  narrative: string;

  /** Dynamic sections chosen by AI */
  sections: SummarySection[];

  /** AI generation metadata */
  generationMetadata: {
    reasoning: string;
    confidence: number;
    detectedSessionType:
      | 'deep-work'
      | 'exploratory'
      | 'collaborative'
      | 'learning'
      | 'troubleshooting'
      | 'creative'
      | 'routine'
      | 'mixed';
    primaryTheme: string;
    emphasis:
      | 'achievement-focused'
      | 'journey-focused'
      | 'learning-focused'
      | 'problem-focused'
      | 'exploratory';
    dataSources: {
      screenshots: boolean;
      audio: boolean;
      video: boolean;
      audioInsights: boolean;
      videoChapters: boolean;
    };
    warnings?: string[];
  };

  /** Quick access to common fields (computed from sections for backward compatibility) */
  quickAccess?: {
    achievements?: string[];
    blockers?: string[];
    tasks?: Array<{ title: string; priority: string; context: string }>;
    insights?: Array<{ insight: string; timestamp: string }>;
  };
}

/**
 * Section types available for flexible summaries
 */
export type SummarySection =
  | AchievementsSection
  | BreakthroughMomentsSection
  | BlockersSection
  | LearningHighlightsSection
  | CreativeSolutionsSection
  | CollaborationSection
  | TechnicalDiscoveriesSection
  | TimelineSection
  | FlowStateSection
  | EmotionalJourneySection
  | ProblemSolvingSection
  | FocusAreasSection
  | RecommendedTasksSection
  | KeyInsightsSection
  | RelatedContextSection
  | CustomSection;

/** Base section interface */
interface BaseSummarySection {
  type: string;
  title: string;
  emphasis: 'low' | 'medium' | 'high';
  position: number;
  icon?: string;
  colorTheme?: 'success' | 'warning' | 'info' | 'error' | 'neutral' | 'creative';
}

export interface AchievementsSection extends BaseSummarySection {
  type: 'achievements';
  data: {
    achievements: Array<{
      title: string;
      timestamp?: string;
      screenshotIds?: string[];
      impact?: 'minor' | 'moderate' | 'major';
    }>;
    summary?: string;
  };
}

export interface BreakthroughMomentsSection extends BaseSummarySection {
  type: 'breakthrough-moments';
  data: {
    moments: Array<{
      title: string;
      description: string;
      timestamp: string;
      context: string;
      screenshotIds?: string[];
    }>;
  };
}

export interface BlockersSection extends BaseSummarySection {
  type: 'blockers';
  data: {
    blockers: Array<{
      title: string;
      description: string;
      status: 'unresolved' | 'resolved' | 'workaround';
      timestamp?: string;
      screenshotIds?: string[];
      resolution?: string;
    }>;
  };
}

export interface LearningHighlightsSection extends BaseSummarySection {
  type: 'learning-highlights';
  data: {
    learnings: Array<{
      topic: string;
      insight: string;
      timestamp?: string;
      screenshotIds?: string[];
      category?: 'technical' | 'process' | 'tool' | 'domain' | 'other';
    }>;
  };
}

export interface CreativeSolutionsSection extends BaseSummarySection {
  type: 'creative-solutions';
  data: {
    solutions: Array<{
      problem: string;
      solution: string;
      approach: string;
      timestamp?: string;
      screenshotIds?: string[];
    }>;
  };
}

export interface CollaborationSection extends BaseSummarySection {
  type: 'collaboration-wins';
  data: {
    collaborations: Array<{
      title: string;
      description: string;
      participants?: string[];
      timestamp?: string;
      outcome?: string;
    }>;
  };
}

export interface TechnicalDiscoveriesSection extends BaseSummarySection {
  type: 'technical-discoveries';
  data: {
    discoveries: Array<{
      title: string;
      technology: string;
      finding: string;
      timestamp?: string;
      screenshotIds?: string[];
    }>;
  };
}

export interface TimelineSection extends BaseSummarySection {
  type: 'timeline';
  data: {
    events: Array<{
      time: string;
      title: string;
      description: string;
      type: 'start' | 'milestone' | 'blocker' | 'breakthrough' | 'end';
      screenshotIds?: string[];
    }>;
    narrative?: string;
  };
}

export interface FlowStateSection extends BaseSummarySection {
  type: 'flow-states';
  data: {
    flowPeriods: Array<{
      startTime: string;
      endTime: string;
      duration: number;
      activity: string;
      quality: 'deep' | 'moderate' | 'shallow';
    }>;
    totalFlowTime: number;
    flowPercentage: number;
  };
}

export interface EmotionalJourneySection extends BaseSummarySection {
  type: 'emotional-journey';
  data: {
    journey: Array<{
      timestamp: string;
      emotion: string;
      description: string;
      context: string;
    }>;
    overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    narrative?: string;
  };
}

export interface ProblemSolvingSection extends BaseSummarySection {
  type: 'problem-solving-journey';
  data: {
    problem: string;
    approach: Array<{
      step: number;
      action: string;
      outcome: string;
      timestamp?: string;
    }>;
    resolution?: string;
    lessonsLearned?: string[];
  };
}

export interface FocusAreasSection extends BaseSummarySection {
  type: 'focus-areas';
  data: {
    areas: Array<{
      area: string;
      duration: number;
      percentage: number;
      activities?: string[];
    }>;
  };
}

export interface RecommendedTasksSection extends BaseSummarySection {
  type: 'recommended-tasks';
  data: {
    tasks: Array<{
      title: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      context: string;
      relatedScreenshotIds?: string[];
      estimatedDuration?: number;
      category?: string;
    }>;
  };
}

export interface KeyInsightsSection extends BaseSummarySection {
  type: 'key-insights';
  data: {
    insights: Array<{
      insight: string;
      timestamp: string;
      screenshotIds?: string[];
      importance: 'minor' | 'moderate' | 'major';
      category?: string;
    }>;
  };
}

/**
 * Related Context Section
 *
 * Links this session to existing tasks and notes in the system.
 * Helps avoid duplicate suggestions and provides continuity across sessions.
 *
 * This section is AI-generated during flexible summary enrichment when
 * related tasks/notes are discovered through intelligent search.
 */
export interface RelatedContextSection extends BaseSummarySection {
  type: 'related-context';
  title: string; // e.g., "Related Work"
  data: {
    /** Existing tasks that relate to this session's work */
    relatedTasks: Array<{
      taskId: string;
      title: string;
      relevance: string;      // AI explanation of why it's related
      status: 'todo' | 'in-progress' | 'done' | 'blocked';
      priority: 'low' | 'medium' | 'high' | 'urgent';
      dueDate?: string;
      screenshotIds?: string[];  // Screenshots that reference this task
    }>;

    /** Existing notes that provide context for this session */
    relatedNotes: Array<{
      noteId: string;
      summary: string;
      relevance: string;      // AI explanation of why it's related
      tags: string[];
      createdAt: string;
      screenshotIds?: string[]; // Screenshots that reference this note
    }>;

    /** Tasks AI almost suggested but found existing duplicates */
    duplicatePrevention?: Array<{
      suggestedTitle: string;
      existingTaskId: string;
      existingTaskTitle: string;
      similarity: number;     // 0-1 confidence score
      reason: string;         // Why considered duplicate
    }>;

    /** Summary of search used to find related items */
    searchMetadata?: {
      query: string;
      tasksFound: number;
      notesFound: number;
      searchDuration: number;
    };
  };
  metadata: {
    itemCount: number;        // Total tasks + notes
    hasTaskLinks: boolean;
    hasNoteLinks: boolean;
    hasDuplicatePrevention: boolean;
  };
}

export interface CustomSection extends BaseSummarySection {
  type: 'custom';
  customType: string;
  data: Record<string, any>;
}

export interface Session {
  id: string;
  name: string; // User-provided or AI-generated
  description: string; // What user is working on

  // Lifecycle
  status: 'active' | 'paused' | 'completed' | 'interrupted';
  startTime: string;
  endTime?: string;
  lastScreenshotTime?: string;

  // Pause tracking
  pausedAt?: string; // Timestamp when session was last paused
  totalPausedTime?: number; // Total paused time in milliseconds

  // Configuration
  screenshotInterval: number; // Minutes (default: 2), or -1 for adaptive mode
  autoAnalysis: boolean; // Auto-analyze screenshots
  enableScreenshots: boolean; // Enable/disable screenshot capture (default: true)
  audioMode: AudioMode; // Audio recording mode (default: 'off')
  audioRecording: boolean; // Currently recording audio

  // References
  trackingNoteId?: string; // Session tracking note
  screenshots: SessionScreenshot[];
  audioSegments?: SessionAudioSegment[]; // Real-time audio recordings (Whisper-1 transcripts)
  extractedTaskIds: string[]; // Task IDs created from this session
  extractedNoteIds: string[]; // Note IDs created from this session
  contextItems?: SessionContextItem[]; // User-added context during session

  // ONE-TIME Audio Review (cached, never re-processed)
  audioReviewCompleted: boolean; // Has comprehensive audio review been done?
  fullAudioAttachmentId?: string; // Complete concatenated audio file (downsampled)
  fullTranscription?: string; // Full transcript from GPT-4o-audio-preview
  audioInsights?: AudioInsights; // Comprehensive audio analysis (emotions, patterns, context)
  transcriptUpgradeCompleted?: boolean; // Has word-level transcript upgrade been done?

  // AI-Generated Summary (synthesized every 5 min + on session end)
  summary?: SessionSummary;

  // AI-Generated Canvas Specification (cached for fast rendering, avoids regeneration costs)
  canvasSpec?: CanvasSpec;

  // DEPRECATED: Legacy audio fields
  audioKeyMoments?: AudioKeyMoment[]; // Replaced by audioInsights.keyMoments

  // Metadata
  tags: string[];
  category?: string; // AI-assigned primary category: "Deep Work", "Meetings", "Research", etc.
  subCategory?: string; // AI-assigned sub-category: "API Development", "Client Presentation", etc.
  activityType?: string; // "email-writing", "presentation", "coding", etc.
  totalDuration?: number; // Total minutes (calculated)

  // Video Recording (Phase 1)
  video?: SessionVideo;
  videoRecording?: boolean; // Enable/disable video recording (user setting)

  /**
   * Enrichment Status - Comprehensive tracking of post-session enrichment pipeline
   *
   * Tracks the state of audio review, video chapter generation, and summary creation.
   * Each stage can be independently processed, retried, or skipped. All fields are optional
   * for backward compatibility with existing sessions.
   *
   * Status lifecycle:
   * - idle: No enrichment has been started
   * - pending: Enrichment is queued/waiting to start
   * - in-progress: Currently processing one or more stages
   * - completed: All enabled stages successfully completed
   * - failed: One or more stages failed critically
   * - partial: Some stages completed, others skipped or failed
   */
  enrichmentStatus?: {
    /** Overall enrichment pipeline status */
    status: 'idle' | 'pending' | 'in-progress' | 'completed' | 'failed' | 'partial';

    /** When enrichment pipeline was first initiated (ISO 8601) */
    startedAt?: string;

    /** When all enrichment stages finished (ISO 8601) */
    completedAt?: string;

    /** Overall progress percentage (0-100) across all enabled stages */
    progress: number;

    /** Current stage being processed */
    currentStage: 'validating' | 'estimating' | 'locking' | 'checkpointing' | 'audio' | 'video' | 'summary' | 'complete' | 'error';

    /**
     * Audio Review Stage - GPT-4o audio analysis for emotional journey and key moments
     *
     * This stage processes the full session audio to extract emotional patterns,
     * key moments, and work patterns. It's a ONE-TIME operation that's never re-run.
     */
    audio: {
      /** Status of audio review processing */
      status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

      /** When audio review started (ISO 8601) */
      startedAt?: string;

      /** When audio review completed (ISO 8601) */
      completedAt?: string;

      /** Error message if audio review failed */
      error?: string;

      /** Cost of audio review in USD (GPT-4o audio API pricing) */
      cost?: number;
    };

    /**
     * Video Chapter Generation Stage - AI-detected semantic boundaries in session video
     *
     * Analyzes video frames to identify topic changes and create navigable chapters.
     * Helps users quickly find relevant parts of long session recordings.
     */
    video: {
      /** Status of video chapter generation */
      status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

      /** When video chapter generation started (ISO 8601) */
      startedAt?: string;

      /** When video chapter generation completed (ISO 8601) */
      completedAt?: string;

      /** Error message if video processing failed */
      error?: string;

      /** Cost of video analysis in USD (vision API pricing) */
      cost?: number;
    };

    /**
     * Summary Generation Stage - Comprehensive session summary synthesis
     *
     * Combines data from screenshots, audio, video, and user actions to create
     * a narrative summary of the session. Always runs last after other stages.
     */
    summary: {
      /** Status of summary generation */
      status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

      /** Error message if summary generation failed */
      error?: string;
    };

    /** Total cost across all enrichment stages in USD */
    totalCost: number;

    /** Array of error messages from any failed stages */
    errors: string[];

    /** Array of non-critical warnings (e.g., "No audio available for review") */
    warnings: string[];

    /** Whether enrichment can be resumed from current state (e.g., after failure or interruption) */
    canResume: boolean;
  };

  /**
   * Enrichment Configuration - User preferences for post-session enrichment
   *
   * Controls which enrichment stages should run and under what conditions.
   * All fields optional for backward compatibility. Defaults are applied at runtime.
   */
  enrichmentConfig?: {
    /** Whether to perform comprehensive audio review (GPT-4o audio analysis) */
    includeAudioReview: boolean;

    /** Whether to generate video chapter markers for navigation */
    includeVideoChapters: boolean;

    /** Whether to automatically start enrichment when session is completed */
    autoEnrichOnComplete: boolean;

    /** Maximum total cost threshold in USD - enrichment stops if this is exceeded */
    maxCostThreshold?: number;
  };

  /**
   * Enrichment Lock - Prevents concurrent enrichment processing
   *
   * Ensures only one enrichment process runs at a time for this session.
   * Lock expires automatically after timeout to prevent orphaned locks.
   */
  enrichmentLock?: {
    /** Identifier of the process/worker that acquired the lock */
    lockedBy: string;

    /** When the lock was acquired (ISO 8601) */
    lockedAt: string;

    /** When the lock will expire if not released (ISO 8601) */
    expiresAt: string;
  };
}

// Video Frame - Extracted frame from video for AI analysis
export interface VideoFrame {
  timestamp: number; // Seconds from session start
  dataUri: string; // Base64 PNG data URI
  width: number;
  height: number;
}

// Video Chapter - Semantic segment of a session video
export interface VideoChapter {
  id: string;
  sessionId: string;
  startTime: number; // Seconds from session start
  endTime: number; // Seconds from session start
  title: string; // e.g., "Setting Up Development Environment"
  summary?: string; // AI-generated summary
  keyTopics?: string[]; // ["git", "npm install", "VS Code setup"]
  thumbnail?: string; // Base64 data URI from first frame
  confidence?: number; // 0-1, how confident AI is about this boundary
  createdAt: string;
}

// Session Video - Full session screen recording with intelligent chunking
export interface SessionVideo {
  id: string;
  sessionId: string;
  fullVideoAttachmentId: string; // Complete session recording file
  chunks?: SessionVideoChunk[]; // Topic-aligned video segments
  chapters?: VideoChapter[]; // AI-detected chapter markers
  duration: number; // Total duration in seconds
  chunkingStatus: 'pending' | 'processing' | 'complete' | 'error';
  processedAt?: string; // When chunking completed
  chunkingError?: string; // Error message if chunking failed

  // DEPRECATED: Legacy properties for backward compatibility
  startTime?: number;
  endTime?: number;
}

// Session Video Chunk - Topic-aligned video segment (30s-5min)
export interface SessionVideoChunk {
  id: string;
  videoId: string;
  sessionId: string;
  attachmentId: string; // Chunked video file
  startTime: number; // Seconds from session start
  endTime: number; // Seconds from session start
  topic: string; // AI-detected topic (e.g., "Authentication Development")
  description: string; // Brief description of what happened
  transcriptExcerpt: string; // Audio transcript for this time range
  relatedScreenshotIds: string[]; // Screenshots within this time range
  relatedAudioSegmentIds: string[]; // Audio segments within this time range

  // On-demand analysis tracking
  analyzed: boolean; // Has this chunk been analyzed by video agent?
  analysisCache?: string; // Cached analysis from video agent
  lastAnalyzedAt?: string; // When last analyzed
}

export interface SessionScreenshot {
  id: string;
  sessionId: string;
  timestamp: string;
  attachmentId: string; // Reference to Attachment entity

  // DEPRECATED: Legacy property for backward compatibility
  path?: string;

  // AI Analysis (from Sessions Agent)
  aiAnalysis?: {
    summary: string; // What's happening in this screenshot
    detectedActivity: string; // "writing-email", "editing-slides", etc.
    extractedText?: string; // OCR results
    keyElements: string[]; // ["Gmail", "Draft to customer", etc.]
    suggestedActions?: string[]; // Tasks the agent noticed
    contextDelta?: string; // What changed since last screenshot
    confidence: number;
    curiosity?: number; // 0-1 score: how much AI wants to see next screenshot sooner (for adaptive scheduling)
    curiosityReason?: string; // Brief explanation for curiosity score
    progressIndicators?: {
      achievements?: string[]; // Things completed or accomplished
      blockers?: string[]; // Issues or obstacles encountered
      insights?: string[]; // Important learnings or observations
    };
  };

  // User interaction
  userComment?: string;
  flagged?: boolean; // User can flag important moments

  // Status
  analysisStatus: 'pending' | 'analyzing' | 'complete' | 'error';
  analysisError?: string;
}

// Audio Recording Types
export type AudioMode = 'off' | 'transcription' | 'description'; // DEPRECATED: Will be removed

export interface SessionAudioSegment {
  id: string;
  sessionId: string;
  timestamp: string;
  duration: number; // seconds
  transcription: string; // Speech-to-text (always from Whisper-1)
  attachmentId?: string; // Reference to audio WAV file in storage

  // DEPRECATED: Legacy property for backward compatibility
  startTime?: number;

  // Transcript quality tracking
  transcriptionQuality?: 'draft' | 'final'; // draft = 10s chunk, final = word-level upgrade
  draftTranscription?: string; // Original 10s chunk transcript (for comparison)
  enrichedTranscription?: string; // Word-accurate transcript from full session re-transcription

  // AI-extracted metadata
  keyPhrases?: string[]; // Important phrases from this segment
  sentiment?: 'positive' | 'neutral' | 'negative';
  containsTask?: boolean; // AI detected action item
  containsBlocker?: boolean; // AI detected problem

  // DEPRECATED: Legacy fields for migration compatibility
  description?: string; // No longer used
  mode?: 'transcription' | 'description'; // No longer used
  model?: string; // No longer used
}

// Audio key moment - AI-identified important timestamp
export interface AudioKeyMoment {
  id: string;
  timestamp: number; // Seconds from session start
  label: string; // "Started debugging", "Completed feature", etc.
  type: 'achievement' | 'blocker' | 'decision' | 'insight';
  segmentId: string; // Which audio segment this came from
  excerpt: string; // What the user said
}

// Audio Insights - Comprehensive post-session audio analysis
export interface AudioInsights {
  // Overall narrative
  narrative: string; // Story of the session from audio perspective

  // Emotional journey over time
  emotionalJourney: Array<{
    timestamp: number; // Seconds from session start
    emotion: string; // "focused", "frustrated", "excited", "confused", etc.
    description: string; // Context for the emotion
  }>;

  // Key moments identified by GPT-4o
  keyMoments: Array<{
    timestamp: number; // Seconds from session start
    type: 'achievement' | 'blocker' | 'decision' | 'insight';
    description: string; // What happened
    context: string; // Why it matters
    excerpt: string; // What the user said
  }>;

  // Work patterns observed
  workPatterns: {
    focusLevel: 'high' | 'medium' | 'low';
    interruptions: number;
    flowStates: Array<{
      start: number; // Timestamp in seconds
      end: number; // Timestamp in seconds
      description: string; // What they were doing
    }>;
  };

  // Environmental context
  environmentalContext: {
    ambientNoise: string; // Description of background sounds
    workSetting: string; // "quiet office", "busy café", etc.
    timeOfDay: string; // Inferred from audio cues
  };

  // AI processing metadata
  processedAt: string; // ISO timestamp
  modelUsed: string; // e.g., "gpt-4o-audio-preview"
  processingDuration: number; // Seconds taken to analyze

  // DEPRECATED: Legacy properties for backward compatibility
  summary?: string;
  extractedTasks?: Array<{title: string; priority: string; context: string}>;
  extractedNotes?: Array<{content: string; tags: string[]}>;
  timeBreakdown?: Array<{activity: string; duration: number; percentage: number}>;
  keyActivities?: string[];
}

// Session Context Item - user-added context during session
export interface SessionContextItem {
  id: string;
  sessionId: string;
  timestamp: string;
  type: 'note' | 'task' | 'marker';
  content: string;

  // NEW: Link to existing note/task (when user associates existing item)
  linkedItemId?: string; // ID of existing Note or Task

  // DEPRECATED: Legacy fields (will be removed)
  // If type === 'note', this links to created Note
  noteId?: string;

  // If type === 'task', this links to created Task
  taskId?: string;
}

// Activity Monitoring Types (for Adaptive Screenshots)

// Activity metrics from Rust activity monitor
export interface ActivityMetrics {
  appSwitches: number;           // Number of app switches in time window
  mouseClicks: number;           // Number of mouse clicks in time window
  keyboardEvents: number;        // Number of keyboard events in time window
  windowFocusChanges: number;    // Number of window focus changes in time window
  timestamp: string;             // ISO 8601 timestamp of measurement
}

// Legacy types (for backward compatibility during refactor)
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// ============================================================================
// TYPE GUARDS & UTILITIES
// ============================================================================

/**
 * Type guard to check if summary is flexible (Phase 2)
 */
export function isFlexibleSummary(
  summary: SessionSummary | FlexibleSessionSummary | null | undefined
): summary is FlexibleSessionSummary {
  return !!summary && 'schemaVersion' in summary && summary.schemaVersion === '2.0';
}

/**
 * Type guard to check if summary is legacy (Phase 1)
 */
export function isLegacySummary(
  summary: SessionSummary | FlexibleSessionSummary | null | undefined
): summary is SessionSummary {
  return !!summary && !('schemaVersion' in summary);
}

/**
 * Extract section by type from flexible summary
 */
export function getSectionByType<T extends SummarySection['type']>(
  summary: FlexibleSessionSummary,
  type: T
): Extract<SummarySection, { type: T }> | undefined {
  return summary.sections.find(s => s.type === type) as Extract<SummarySection, { type: T }> | undefined;
}

/**
 * Get all sections of a specific type (some sessions might have multiple)
 */
export function getSectionsByType<T extends SummarySection['type']>(
  summary: FlexibleSessionSummary,
  type: T
): Array<Extract<SummarySection, { type: T }>> {
  return summary.sections.filter(s => s.type === type) as Array<Extract<SummarySection, { type: T }>>;
}
