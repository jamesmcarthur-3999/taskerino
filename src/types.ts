// Core Data Types

// ============================================================================
// UNIFIED RELATIONSHIP SYSTEM (Phase 2.0)
// ============================================================================
//
// Replaces legacy fields (topicId, noteId, sourceSessionId, etc.) with a
// flexible relationship array that can represent any entity-to-entity connection.
//
// EXAMPLES:
// - Task → Note: { fromId: taskId, fromType: 'task', toId: noteId, toType: 'note', type: 'TASK_NOTE' }
// - Session → Task: { fromId: sessionId, fromType: 'session', toId: taskId, toType: 'task', type: 'SESSION_TASK' }
// - Note → Company: { fromId: noteId, fromType: 'note', toId: companyId, toType: 'company', type: 'NOTE_COMPANY' }
//
// MIGRATION:
// - Legacy fields are marked @deprecated throughout this file
// - Migration tracked via relationshipVersion field (0 = legacy, 1 = migrated)
// - All entities will be migrated to relationshipVersion: 1
//
// SEE: /src/types/relationships.ts for Relationship interface and helpers
//
import type { Relationship } from './types/relationships';

// ============================================================================
// MIGRATION STATUS (as of October 2025)
// ============================================================================
//
// ACTIVE MIGRATIONS:
//
// 1. Unified Relationships (Phase 2.0)
//    Status: In progress, check relationshipVersion field
//    Old: topicId, noteId, sourceSessionId, sourceNoteId, extractedTaskIds, extractedNoteIds
//    New: relationships[] array
//    Search: grep "@deprecated.*Use relationships" src/types.ts
//
// 2. Content-Addressable Storage (Phase 4)
//    Status: Complete for new data, migrating old screenshots
//    Old: SessionScreenshot.path
//    New: SessionScreenshot.attachmentId
//    Search: grep "@deprecated.*path" src/types.ts
//    Migration: Screenshot path migration script (runs on startup)
//
// 3. Flexible Summaries (Phase 2)
//    Status: Both formats supported
//    Old: SessionSummary (fixed template)
//    New: FlexibleSessionSummary (AI-chosen sections)
//    Check: session.summary?.schemaVersion === '2.0'
//
// DEPRECATED FIELDS COUNT: 10+
// Run: grep -c "@deprecated" src/types.ts

// ============================================================================
// DEPRECATED FIELDS REFERENCE
// ============================================================================
//
// All deprecated fields are marked with @deprecated JSDoc tags.
// This section provides a centralized guide for migration.
//
// SEARCH PATTERN: grep "@deprecated" src/types.ts
//
// DEPRECATED RELATIONSHIP FIELDS:
//
// 1. Session.extractedTaskIds: string[]
//    Deprecated: October 2025
//    Replacement: relationships[] with type='SESSION_TASK'
//    Migration: Run relationship migration script
//    Remove: v2.0 (when relationshipVersion migration complete)
//
// 2. Session.extractedNoteIds: string[]
//    Deprecated: October 2025
//    Replacement: relationships[] with type='SESSION_NOTE'
//    Migration: Run relationship migration script
//    Remove: v2.0 (when relationshipVersion migration complete)
//
// 3. Note.topicId?: string
//    Deprecated: October 2025
//    Replacement: relationships[] with toType='topic'
//    Usage: Widely used (175 occurrences across 31 files)
//    Migration: Gradual migration via relationshipVersion field
//    Remove: After full migration (2-3 months)
//
// 4. Note.sourceSessionId?: string
//    Deprecated: October 2025
//    Replacement: relationships[] with type='NOTE_SESSION'
//    Migration: Automatic during relationship migration
//    Remove: v2.0
//
// 5. Task.noteId?: string
//    Deprecated: October 2025
//    Replacement: relationships[] with toType='note'
//    Usage: Check TasksContext for active usage
//    Migration: Automatic during relationship migration
//    Remove: v2.0
//
// 6. Task.sourceNoteId?: string
//    Deprecated: October 2025
//    Replacement: relationships[] with type='TASK_NOTE'
//    Migration: Automatic during relationship migration
//    Remove: v2.0
//
// 7. Task.sourceSessionId?: string
//    Deprecated: October 2025
//    Replacement: relationships[] with toType='session'
//    Migration: Automatic during relationship migration
//    Remove: v2.0
//
// DEPRECATED STORAGE FIELDS:
//
// 8. SessionScreenshot.path?: string
//    Deprecated: October 2025 (Phase 4 ContentAddressableStorage)
//    Replacement: attachmentId with CAS lookup
//    Usage: 4 occurrences as backward compatibility fallback
//    Migration: Screenshot path migration script (runs on startup)
//    Remove: v1.0 after migration completes
//
// DEPRECATED DATA FIELDS:
//
// 9. Session.audioKeyMoments?: AudioKeyMoment[]
//    Deprecated: October 2025
//    Replacement: audioInsights.keyMoments
//    Reason: Consolidated into AudioInsights structure
//    Migration: One-time data copy during enrichment
//    Remove: v1.0
//
// DEPRECATED TYPES:
//
// 10. AudioMode: 'off' | 'transcription' | 'description'
//     Deprecated: October 2025
//     Replacement: audioConfig.enabled boolean
//     Status: No longer used in codebase
//     Remove: Immediately (already unused)
//
// DEPRECATED CONTEXT ITEMS FIELDS:
//
// 11. SessionContextItem.noteId?: string
//     Deprecated: October 2025
//     Replacement: linkedItemId with type detection
//     Migration: Automatic when creating new context items
//     Remove: v2.0
//
// 12. SessionContextItem.taskId?: string
//     Deprecated: October 2025
//     Replacement: linkedItemId with type detection
//     Migration: Automatic when creating new context items
//     Remove: v2.0
//
// TOTAL DEPRECATED FIELDS: 12
// Migration Priority: High (unified relationships), Medium (storage), Low (data)
// Estimated Migration Timeline: 2-3 months for full completion
//
// ============================================================================
//
// ============================================================================

// ============================================================================
// STATUS ENUMS (Typed String Literals)
// ============================================================================

/**
 * Session Lifecycle Status
 * - active: Currently recording (screenshots/audio/video)
 * - paused: Recording paused, can resume
 * - completed: Ended normally by user
 * - interrupted: Ended due to crash/error
 */
export type SessionStatus = 'active' | 'paused' | 'completed' | 'interrupted';

/**
 * Screenshot AI Analysis Status
 * - pending: Queued for analysis
 * - analyzing: Currently being analyzed by Claude Vision
 * - complete: Analysis finished successfully
 * - error: Analysis failed (rate limit, API error, etc.)
 */
export type ScreenshotAnalysisStatus = 'pending' | 'analyzing' | 'complete' | 'error';

/**
 * Task Lifecycle Status
 * - todo: Not started
 * - in-progress: Currently being worked on
 * - done: Completed
 * - blocked: Blocked by dependencies or issues
 */
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked';

/**
 * Enrichment Pipeline Status
 * - idle: No enrichment started (default for new sessions)
 * - pending: Queued for enrichment
 * - in-progress: Currently enriching (audio/video/summary stages)
 * - completed: All enabled stages completed successfully
 * - failed: Enrichment failed with unrecoverable error
 * - partial: Some stages completed, others failed/skipped
 */
export type EnrichmentStatus = 'idle' | 'pending' | 'in-progress' | 'completed' | 'failed' | 'partial';

/**
 * Individual Enrichment Stage Status
 * - pending: Not started
 * - processing: Currently running
 * - completed: Stage completed successfully
 * - failed: Stage failed with error
 * - skipped: Stage skipped (user preference or no data available)
 */
export type EnrichmentStageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

/**
 * Task Priority Level
 * - low: Nice to have, do when time permits
 * - medium: Should do soon
 * - high: Important, do ASAP
 * - urgent: Critical, blocking work
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// ============================================================================
// AI Canvas Types
// ============================================================================

export interface CanvasSpec {
  theme: CanvasTheme;
  layout: CanvasLayout;
  metadata: {
    generatedAt: string;
    sessionType: string;
    confidence: number;
  };
  // New flexible component tree (v2 Canvas System)
  componentTree?: import('./components/canvas').ComponentTree;
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

/**
 * Source citation for tracing Canvas claims back to original session data
 */
export interface SourceCitation {
  type: 'screenshot' | 'audio' | 'video' | 'agent_analysis';
  timestamp: string; // ISO timestamp of when this source occurred

  // Reference IDs for different media types
  screenshotIds?: string[];
  audioSegmentId?: string;
  videoChapterId?: string;

  // Context excerpts
  excerpt?: string; // Quote from audio transcript or OCR text from screenshot
  confidence?: number; // 0-1, how relevant this source is to the claim

  // Display hint
  label?: string; // Optional label like "From design discussion" or "Debugging session"
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
  breakthroughs: SessionInsight[];

  /** Key learnings extracted */
  learnings: SessionInsight[];

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
 * A learning or insight from a session
 */
export interface SessionInsight {
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
// Attachment Types
// ============================================================================
export type AttachmentType = 'image' | 'video' | 'file' | 'link' | 'screenshot' | 'audio';

/**
 * Tracks references to physical attachment files
 * Used for deduplication and reference counting
 */
export interface AttachmentRef {
  hash: string; // SHA-256 hash of file content
  physicalPath: string; // Actual file location on disk
  refCount: number; // Number of Attachment records pointing to this file
  size: number; // File size in bytes
  attachmentIds: string[]; // IDs of Attachment records using this file
  createdAt: number;
  lastAccessedAt: number;
}

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

  // Deduplication
  hash?: string;                   // SHA-256 hash for deduplication

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

  /**
   * Unified relationship system
   * @since 2.0.0
   */
  relationships?: Relationship[];

  /**
   * Migration tracking: 0 = legacy, 1 = migrated to unified relationships
   * @since 2.0.0
   */
  relationshipVersion?: number;

  /**
   * @deprecated Use relationships array instead
   * Legacy field for migration (will be removed after migration)
   */
  topicId?: string;

  content: string; // The actual note content (markdown) - most recent or combined
  summary: string; // AI-generated summary
  sourceText?: string; // Original input text (for validation)
  timestamp: string; // Original creation time
  lastUpdated: string; // Most recent update time
  source: 'call' | 'email' | 'thought' | 'other';
  tags: string[]; // Auto-extracted by AI
  parentNoteId?: string; // For threading/nesting
  /**
   * @deprecated Use relationships array instead
   * Link back to originating session
   */
  sourceSessionId?: string;
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
  priority: TaskPriority;
  dueDate?: string;
  dueTime?: string; // NEW: Specific time in 24h format (e.g., "18:00")
  topicId?: string; // Optional link to topic
  companyIds?: string[]; // Links to Company entities
  contactIds?: string[]; // Links to Contact entities
  /**
   * @deprecated Use relationships array instead
   * Which note created this task
   */
  noteId?: string;
  createdAt: string;
  completedAt?: string;

  // Phase 1 - Enhanced fields
  description?: string; // Rich text description
  status: TaskStatus;
  subtasks?: SubTask[]; // Checklist items
  tags?: string[]; // Task-specific tags
  createdBy: 'ai' | 'manual'; // Creation source
  attachments?: Attachment[]; // Multi-modal attachments

  /**
   * Unified relationship system
   * @since 2.0.0
   */
  relationships?: Relationship[];

  /**
   * Migration tracking: 0 = legacy, 1 = migrated to unified relationships
   * @since 2.0.0
   */
  relationshipVersion?: number;

  // Source tracking (for agent capabilities)
  /**
   * @deprecated Use relationships array instead
   * Link back to originating note
   */
  sourceNoteId?: string;
  /**
   * @deprecated Use relationships array instead
   * Link back to originating session
   */
  sourceSessionId?: string;
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
 * Session Summary Context
 *
 * Additional context provided to the AI when generating session summaries.
 * This data helps the AI create more informed summaries by providing access
 * to related items and enrichment data from various sources.
 *
 * All fields are optional for backward compatibility and to support
 * incremental enrichment (not all data may be available for every session).
 */
export interface SessionSummaryContext {
  /** Existing categories from the system (for tag consistency) */
  existingCategories?: string[];

  /** Existing sub-categories from the system (for tag consistency) */
  existingSubCategories?: string[];

  /** Existing tags from the system (for tag consistency) */
  existingTags?: string[];

  /** Video chapters from AI-detected semantic boundaries (if video recording enabled) */
  videoChapters?: VideoChapter[];

  /** Audio insights from comprehensive GPT-4o audio review (if audio recording enabled) */
  audioInsights?: AudioInsights;

  /**
   * Related items discovered through context search
   *
   * When present, the AI can use this to:
   * - Link to existing work instead of suggesting duplicates
   * - Understand the broader project context
   * - Make more informed recommendations
   *
   * Set to null when no search was performed or no results found.
   */
  relatedContext?: {
    /** Related tasks found in the system */
    tasks: Task[];

    /** Related notes found in the system */
    notes: Note[];

    /** Search query used to find related items */
    searchQuery: string;

    /** Brief summary of search results */
    searchSummary: string;
  } | null;
}

/**
 * Flexible Session Summary (Phase 2 - Section-Based Architecture)
 *
 * A dynamic, AI-driven summary system where the AI chooses which sections to include
 * based on what's actually meaningful for each specific session.
 *
 * WHY FLEXIBLE SUMMARIES?
 * Instead of forcing every session into the same template (achievements, blockers, etc.),
 * this allows the AI to compose summaries from a variety of section types. A debugging
 * session might emphasize problem-solving-journey + technical-discoveries, while a
 * learning session highlights breakthrough-moments + learning-highlights.
 *
 * ARCHITECTURE:
 * - schemaVersion: '2.0' (distinguishes from legacy SessionSummary)
 * - narrative: Core story of the session (always present)
 * - sections: Dynamic array of section types chosen by AI
 * - generationMetadata: AI's reasoning for section selection
 *
 * SECTION TYPES (15+ available):
 * - AchievementsSection: What was completed
 * - BlockersSection: What blocked progress
 * - BreakthroughMomentsSection: Key insights and discoveries
 * - ProblemSolvingSection: Step-by-step problem resolution
 * - TechnicalDiscoveriesSection: New learnings about technology
 * - LearningHighlightsSection: Educational takeaways
 * - FlowStateSection: Deep work periods
 * - FocusAreasSection: Where time was spent
 * - EmotionalJourneySection: Emotional progression
 * - CollaborationSection: Team interactions
 * - CreativeSolutionsSection: Novel approaches
 * - TimelineSection: Chronological event flow
 * - RecommendedTasksSection: AI-suggested next steps
 * - KeyInsightsSection: Important observations
 * - RelatedContextSection: Links to existing tasks/notes
 * - TaskBreakdownSection: Subtask breakdown
 * - CustomSection: AI-defined custom sections
 *
 * USAGE:
 * ```typescript
 * import { isFlexibleSummary, getSectionByType } from '@/types';
 *
 * if (isFlexibleSummary(session.summary)) {
 *   // Access sections
 *   const achievements = getSectionByType(session.summary, 'achievements');
 *   const timeline = getSectionByType(session.summary, 'timeline');
 *
 *   // Check what AI detected
 *   console.log(session.summary.generationMetadata.detectedSessionType);
 *   // → 'deep-work', 'exploratory', 'troubleshooting', etc.
 * }
 * ```
 *
 * BACKWARD COMPATIBILITY:
 * - Legacy SessionSummary (fixed template) still supported
 * - Use isFlexibleSummary() type guard to distinguish
 * - quickAccess field provides common fields for backward compat
 *
 * COST OPTIMIZATION:
 * - AI chooses only relevant sections (reduces token usage)
 * - Sections can be cached independently
 * - Progressive enrichment (add sections over time)
 *
 * @see SessionSummary for legacy fixed-template format
 * @see SummarySection for all available section types
 * @see isFlexibleSummary() type guard
 * @see getSectionByType() helper for section retrieval
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
  | TaskBreakdownSection
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

/**
 * Achievements Section - Notable accomplishments during session
 *
 * Used when AI detects completed work, milestones reached, or goals achieved.
 * Common in deep-work, coding, and building sessions.
 *
 * FIELDS:
 * - achievements: List of accomplishments with timestamps and impact level
 * - summary: Optional overview of all achievements
 *
 * RENDERING:
 * - emphasis: Controls visual prominence (low/medium/high)
 * - position: Order in summary (lower = earlier)
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'achievements',
 *   title: 'Major Wins',
 *   emphasis: 'high',
 *   position: 1,
 *   data: {
 *     achievements: [{
 *       title: 'Completed OAuth integration',
 *       timestamp: '2025-10-26T14:30:00Z',
 *       impact: 'major'
 *     }]
 *   }
 * }
 * ```
 */
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

/**
 * Breakthrough Moments Section - Sudden insights or problem-solving victories
 *
 * Used when AI detects "aha!" moments, debugging breakthroughs, or key realizations.
 * Common in troubleshooting, learning, and exploratory sessions.
 *
 * FIELDS:
 * - moments: Array of breakthrough events with full context
 * - title: Name of the breakthrough
 * - description: What happened
 * - context: Why this was significant
 *
 * RENDERING:
 * - emphasis: Usually 'high' for impactful moments
 * - position: Often early in summary (highlights)
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'breakthrough-moments',
 *   title: 'Key Breakthroughs',
 *   emphasis: 'high',
 *   position: 2,
 *   data: {
 *     moments: [{
 *       title: 'Found the memory leak',
 *       description: 'Discovered unclosed event listeners',
 *       timestamp: '2025-10-26T15:45:00Z',
 *       context: 'After 2 hours of debugging'
 *     }]
 *   }
 * }
 * ```
 */
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

/**
 * Blockers Section - Obstacles and challenges encountered
 *
 * Used when AI detects errors, roadblocks, or unresolved issues.
 * Common in debugging, troubleshooting, and complex implementation sessions.
 *
 * FIELDS:
 * - blockers: Array of obstacles with resolution status
 * - status: Whether blocker was resolved, worked around, or remains open
 * - resolution: How the blocker was addressed (if resolved/workaround)
 *
 * RENDERING:
 * - emphasis: Usually 'medium' or 'high' for critical blockers
 * - position: Often near achievements to show full picture
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'blockers',
 *   title: 'Challenges',
 *   emphasis: 'medium',
 *   position: 3,
 *   data: {
 *     blockers: [{
 *       title: 'API rate limiting errors',
 *       description: 'Hitting 429 responses after 100 requests',
 *       status: 'workaround',
 *       resolution: 'Added exponential backoff'
 *     }]
 *   }
 * }
 * ```
 */
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

/**
 * Learning Highlights Section - New knowledge gained during session
 *
 * Used when AI detects educational content, skill development, or discoveries.
 * Common in learning, research, and exploratory sessions.
 *
 * FIELDS:
 * - learnings: Array of insights with categorization
 * - topic: What area the learning relates to
 * - insight: The actual knowledge gained
 * - category: Type of learning (technical, process, tool, domain, other)
 *
 * RENDERING:
 * - emphasis: Usually 'medium' to highlight growth
 * - position: Often mid-summary after achievements
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'learning-highlights',
 *   title: 'What I Learned',
 *   emphasis: 'medium',
 *   data: {
 *     learnings: [{
 *       topic: 'React Context',
 *       insight: 'Context re-renders all consumers. Use split contexts.',
 *       category: 'technical'
 *     }]
 *   }
 * }
 * ```
 */
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

/**
 * Creative Solutions Section - Innovative problem-solving approaches
 *
 * Used when AI detects novel solutions, clever workarounds, or unconventional approaches.
 * Common in creative, optimization, and problem-solving sessions.
 *
 * FIELDS:
 * - solutions: Array of problem-solution pairs
 * - problem: The challenge that needed solving
 * - solution: The creative approach taken
 * - approach: Methodology or reasoning behind solution
 *
 * RENDERING:
 * - emphasis: Usually 'high' to showcase ingenuity
 * - position: Often highlighted early in summary
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'creative-solutions',
 *   title: 'Clever Solutions',
 *   emphasis: 'high',
 *   data: {
 *     solutions: [{
 *       problem: 'Need to cache without LRU library overhead',
 *       solution: 'Built custom Map-based LRU with O(1) operations',
 *       approach: 'Used doubly-linked list pattern'
 *     }]
 *   }
 * }
 * ```
 */
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

/**
 * Collaboration Wins Section - Team interactions and shared achievements
 *
 * Used when AI detects pair programming, meetings, code reviews, or team discussions.
 * Common in collaborative, meeting, and code review sessions.
 *
 * FIELDS:
 * - collaborations: Array of team interactions
 * - participants: Who was involved
 * - outcome: Result of the collaboration
 *
 * RENDERING:
 * - emphasis: Usually 'medium' for team context
 * - position: Often mid-summary after individual work
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'collaboration-wins',
 *   title: 'Team Wins',
 *   emphasis: 'medium',
 *   data: {
 *     collaborations: [{
 *       title: 'Architecture review with Sarah',
 *       description: 'Discussed database schema migration strategy',
 *       participants: ['Sarah Chen', 'You'],
 *       outcome: 'Agreed on phased migration with feature flags'
 *     }]
 *   }
 * }
 * ```
 */
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

/**
 * Technical Discoveries Section - Technology-specific findings and insights
 *
 * Used when AI detects exploration of new APIs, frameworks, or technical patterns.
 * Common in research, prototyping, and learning sessions.
 *
 * FIELDS:
 * - discoveries: Array of technical findings
 * - technology: Specific tool/framework/API explored
 * - finding: What was discovered about it
 *
 * RENDERING:
 * - emphasis: Usually 'medium' for technical context
 * - position: Often grouped with learning highlights
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'technical-discoveries',
 *   title: 'Technical Findings',
 *   emphasis: 'medium',
 *   data: {
 *     discoveries: [{
 *       title: 'IndexedDB transaction performance',
 *       technology: 'IndexedDB API',
 *       finding: 'Single transaction for 100 writes is 20x faster than 100 individual transactions'
 *     }]
 *   }
 * }
 * ```
 */
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

/**
 * Timeline Section - Chronological flow of session events
 *
 * Used when AI wants to emphasize temporal progression and session arc.
 * Common in long sessions with distinct phases or when chronology matters.
 *
 * FIELDS:
 * - events: Chronological list of key moments
 * - type: Event classification (start, milestone, blocker, breakthrough, end)
 * - narrative: Optional story-like description of session flow
 *
 * RENDERING:
 * - emphasis: Usually 'low' or 'medium' (provides context, not highlights)
 * - position: Often early for orientation, or late for retrospective
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'timeline',
 *   title: 'Session Flow',
 *   emphasis: 'low',
 *   data: {
 *     events: [
 *       {
 *         time: '2025-10-26T09:00:00Z',
 *         title: 'Started debugging',
 *         type: 'start'
 *       },
 *       {
 *         time: '2025-10-26T11:30:00Z',
 *         title: 'Found root cause',
 *         type: 'breakthrough'
 *       }
 *     ]
 *   }
 * }
 * ```
 */
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

/**
 * Flow State Section - Deep work and concentration analysis
 *
 * Used when AI detects sustained focus periods and work rhythm patterns.
 * Common in deep-work, coding, and creative sessions with minimal interruptions.
 *
 * FIELDS:
 * - flowPeriods: Distinct periods of focused work
 * - quality: Depth of focus (deep/moderate/shallow)
 * - totalFlowTime: Sum of all flow periods
 * - flowPercentage: Proportion of session spent in flow
 *
 * RENDERING:
 * - emphasis: Usually 'medium' for productivity context
 * - position: Often late in summary as meta-analysis
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'flow-states',
 *   title: 'Focus Analysis',
 *   emphasis: 'medium',
 *   data: {
 *     flowPeriods: [{
 *       startTime: '2025-10-26T09:00:00Z',
 *       endTime: '2025-10-26T11:30:00Z',
 *       duration: 150,
 *       activity: 'Implementing authentication logic',
 *       quality: 'deep'
 *     }],
 *     totalFlowTime: 150,
 *     flowPercentage: 75
 *   }
 * }
 * ```
 */
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

/**
 * Emotional Journey Section - Emotional arc throughout session
 *
 * Used when AI detects emotional patterns in audio/transcription or activity shifts.
 * Common in sessions with audio recording enabled and significant mood changes.
 *
 * FIELDS:
 * - journey: Emotional checkpoints throughout session
 * - emotion: Detected feeling (frustrated, excited, focused, confused, etc.)
 * - overallSentiment: Summary of entire session's emotional tone
 * - narrative: Story-like description of emotional progression
 *
 * RENDERING:
 * - emphasis: Usually 'low' or 'medium' (adds human context)
 * - position: Often late in summary as reflection
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'emotional-journey',
 *   title: 'How It Felt',
 *   emphasis: 'low',
 *   data: {
 *     journey: [
 *       {
 *         timestamp: '2025-10-26T09:00:00Z',
 *         emotion: 'focused',
 *         description: 'Deep concentration on problem'
 *       },
 *       {
 *         timestamp: '2025-10-26T10:30:00Z',
 *         emotion: 'frustrated',
 *         description: 'Hitting unexpected errors'
 *       }
 *     ],
 *     overallSentiment: 'positive'
 *   }
 * }
 * ```
 */
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

/**
 * Problem Solving Journey Section - Step-by-step debugging or problem resolution
 *
 * Used when AI detects methodical troubleshooting, systematic debugging, or multi-step solutions.
 * Common in troubleshooting, debugging, and complex problem-solving sessions.
 *
 * FIELDS:
 * - problem: The challenge being addressed
 * - approach: Ordered steps taken to solve it
 * - resolution: Final outcome or solution
 * - lessonsLearned: Key takeaways from the process
 *
 * RENDERING:
 * - emphasis: Usually 'high' for narrative-driven sessions
 * - position: Often early as main story arc
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'problem-solving-journey',
 *   title: 'Debugging Journey',
 *   emphasis: 'high',
 *   data: {
 *     problem: 'Memory leak causing browser crashes after 30 minutes',
 *     approach: [
 *       {
 *         step: 1,
 *         action: 'Used Chrome DevTools heap snapshots',
 *         outcome: 'Found growing array of event listeners'
 *       },
 *       {
 *         step: 2,
 *         action: 'Traced listener registration',
 *         outcome: 'Discovered missing cleanup in useEffect'
 *       }
 *     ],
 *     resolution: 'Fixed by adding proper effect cleanup',
 *     lessonsLearned: ['Always clean up observers in useEffect']
 *   }
 * }
 * ```
 */
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

/**
 * Focus Areas Section - Time allocation across different activities
 *
 * Used when AI wants to show how time was distributed across work areas.
 * Common in mixed sessions with multiple distinct activities.
 *
 * FIELDS:
 * - areas: Different work domains/activities
 * - duration: Minutes spent on each area
 * - percentage: Proportion of total session time
 * - activities: Specific tasks within each area
 *
 * RENDERING:
 * - emphasis: Usually 'low' or 'medium' (provides context)
 * - position: Often late in summary as time analysis
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'focus-areas',
 *   title: 'Time Breakdown',
 *   emphasis: 'low',
 *   data: {
 *     areas: [
 *       {
 *         area: 'Backend Development',
 *         duration: 90,
 *         percentage: 60,
 *         activities: ['API endpoints', 'Database queries', 'Testing']
 *       },
 *       {
 *         area: 'Code Review',
 *         duration: 30,
 *         percentage: 20
 *       }
 *     ]
 *   }
 * }
 * ```
 */
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

/**
 * Recommended Tasks Section - AI-extracted action items
 *
 * Used when AI detects TODO comments, unfinished work, or natural next steps.
 * Common in all session types - AI suggests follow-up actions.
 *
 * FIELDS:
 * - tasks: Suggested tasks with priority and context
 * - priority: Urgency level based on session context
 * - context: Why this task matters or where it came from
 * - estimatedDuration: AI's guess at time needed
 * - category: Type of task (bug, feature, refactor, etc.)
 *
 * RENDERING:
 * - emphasis: Usually 'medium' or 'high' (actionable next steps)
 * - position: Often late in summary (after reviewing what was done)
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'recommended-tasks',
 *   title: 'Next Steps',
 *   emphasis: 'medium',
 *   data: {
 *     tasks: [
 *       {
 *         title: 'Add error handling to auth flow',
 *         priority: 'high',
 *         context: 'Left TODO comment during implementation',
 *         estimatedDuration: 30,
 *         category: 'bug'
 *       }
 *     ]
 *   }
 * }
 * ```
 */
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

/**
 * Key Insights Section - Important observations and realizations
 *
 * Used when AI detects significant learnings, patterns, or meta-observations.
 * Common in reflective, analytical, and discovery sessions.
 *
 * FIELDS:
 * - insights: Array of notable observations
 * - importance: Significance level of the insight
 * - category: Type of insight (performance, architecture, UX, etc.)
 *
 * RENDERING:
 * - emphasis: Usually 'medium' or 'high' based on importance
 * - position: Often mid-summary after concrete work
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'key-insights',
 *   title: 'Key Insights',
 *   emphasis: 'medium',
 *   data: {
 *     insights: [
 *       {
 *         insight: 'Our current architecture makes real-time features difficult',
 *         timestamp: '2025-10-26T14:00:00Z',
 *         importance: 'major',
 *         category: 'architecture'
 *       }
 *     ]
 *   }
 * }
 * ```
 */
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

/**
 * Task Breakdown Section - Hierarchical task decomposition
 *
 * Used when AI detects a main task being broken down into subtasks.
 * Common in planning, project kickoff, and complex implementation sessions.
 *
 * FIELDS:
 * - mainTask: The overarching goal
 * - subtasks: Component tasks with status tracking
 * - progress: Overall completion percentage
 * - totalEstimatedTime: Sum of subtask estimates
 * - dependencies: Subtask ordering constraints
 *
 * RENDERING:
 * - emphasis: Usually 'medium' for project planning context
 * - position: Often early for planning sessions, late for retrospectives
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: 'task-breakdown',
 *   title: 'Implementation Plan',
 *   emphasis: 'medium',
 *   data: {
 *     mainTask: 'Implement user authentication',
 *     description: 'OAuth 2.0 with JWT tokens',
 *     subtasks: [
 *       {
 *         id: 'auth-1',
 *         title: 'Set up OAuth provider',
 *         status: 'done',
 *         estimatedDuration: 30
 *       },
 *       {
 *         id: 'auth-2',
 *         title: 'Implement token validation',
 *         status: 'in-progress',
 *         estimatedDuration: 60,
 *         dependencies: ['auth-1']
 *       }
 *     ],
 *     progress: 33,
 *     totalEstimatedTime: 135
 *   }
 * }
 * ```
 */
export interface TaskBreakdownSection extends BaseSummarySection {
  type: 'task-breakdown';
  data: {
    mainTask: string;
    description?: string;
    subtasks: Array<{
      id?: string;
      title: string;
      status: 'todo' | 'in-progress' | 'done';
      estimatedDuration?: number;
      dependencies?: string[];
      screenshotIds?: string[];
    }>;
    progress?: number; // percentage complete (0-100)
    totalEstimatedTime?: number; // sum of all subtask durations
  };
}

export interface CustomSection extends BaseSummarySection {
  type: 'custom';
  customType: string;
  data: Record<string, any>;
}

export interface Session {
  // ========================================
  // CORE IDENTITY
  // ========================================
  id: string;
  name: string; // User-provided or AI-generated
  description: string; // What user is working on

  // ========================================
  // LIFECYCLE & STATUS
  // ========================================
  status: SessionStatus;
  startTime: string;
  endTime?: string;
  lastScreenshotTime?: string;

  // Pause tracking
  pausedAt?: string; // Timestamp when session was last paused
  totalPausedTime?: number; // Total paused time in milliseconds

  // ========================================
  // RECORDING CONFIGURATION
  // ========================================
  screenshotInterval: number; // Minutes (default: 2), or -1 for adaptive mode
  autoAnalysis: boolean; // Auto-analyze screenshots
  enableScreenshots: boolean; // Enable/disable screenshot capture (default: true)
  audioMode: AudioMode; // Audio recording mode (default: 'off')
  audioRecording: boolean; // Currently recording audio

  // ========================================
  // CAPTURED DATA
  // ========================================
  trackingNoteId?: string; // Session tracking note
  screenshots: SessionScreenshot[];
  audioSegments?: SessionAudioSegment[]; // Real-time audio recordings (Whisper-1 transcripts)
  contextItems?: SessionContextItem[]; // User-added context during session

  // ========================================
  // RELATIONSHIPS (Phase 2.0 Unified System)
  // ========================================
  /**
   * Unified relationship system
   * @since 2.0.0
   */
  relationships?: Relationship[];

  /**
   * Migration tracking: 0 = legacy, 1 = migrated to unified relationships
   * @since 2.0.0
   */
  relationshipVersion?: number;

  /**
   * @deprecated Use relationships array instead
   * Task IDs created from this session
   */
  extractedTaskIds: string[];
  /**
   * @deprecated Use relationships array instead
   * Note IDs created from this session
   */
  extractedNoteIds: string[];

  // ========================================
  // AUDIO ANALYSIS (ONE-TIME, CACHED)
  // ========================================
  audioReviewCompleted: boolean; // Has comprehensive audio review been done?
  fullAudioAttachmentId?: string; // Complete concatenated audio file (downsampled)
  fullTranscription?: string; // Full transcript from GPT-4o-audio-preview
  audioInsights?: AudioInsights; // Comprehensive audio analysis (emotions, patterns, context)
  transcriptUpgradeCompleted?: boolean; // Has word-level transcript upgrade been done?

  // DEPRECATED: Legacy audio fields
  audioKeyMoments?: AudioKeyMoment[]; // Replaced by audioInsights.keyMoments

  // ========================================
  // AI-GENERATED ARTIFACTS (CACHED)
  // ========================================
  summary?: SessionSummary; // Synthesized every 5 min + on session end
  canvasSpec?: CanvasSpec; // Cached for fast rendering, avoids regeneration costs

  // ========================================
  // METADATA & CLASSIFICATION
  // ========================================
  tags: string[];
  category?: string; // AI-assigned primary category: "Deep Work", "Meetings", "Research", etc.
  subCategory?: string; // AI-assigned sub-category: "API Development", "Client Presentation", etc.
  activityType?: string; // "email-writing", "presentation", "coding", etc.
  totalDuration?: number; // Total minutes (calculated)
  companyIds?: string[]; // Links to Company entities
  contactIds?: string[]; // Links to Contact entities

  // ========================================
  // VIDEO RECORDING (Phase 1)
  // ========================================
  video?: SessionVideo;
  videoRecording?: boolean; // Enable/disable video recording (user setting)

  // ========================================
  // ENRICHMENT PIPELINE (POST-SESSION)
  // ========================================
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
    status: EnrichmentStatus;

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
      status: EnrichmentStageStatus;

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
      status: EnrichmentStageStatus;

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
      status: EnrichmentStageStatus;

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

  // ========================================
  // DEVICE CONFIGURATION
  // ========================================
  /** Audio device configuration (optional, defaults to system default mic) */
  audioConfig?: AudioDeviceConfig;

  /** Video recording configuration (optional, defaults to main display) */
  videoConfig?: VideoRecordingConfig;

  // ========================================
  // CONCURRENCY CONTROL
  // ========================================
  /** Version number for optimistic locking (incremented on every update) */
  version?: number;
}

// Video Frame - Extracted frame from video for AI analysis
export interface VideoFrame {
  timestamp: number; // Seconds from session start
  dataUri: string; // Base64 PNG data URI
  width: number;
  height: number;
}

// Video Chapter - Semantic segment of a session video
/**
 * Video Chapter - Semantic segment of a session video
 *
 * AI-detected topic boundaries in session recordings. Each chapter represents
 * a distinct phase of work (e.g., "Implementing feature X", "Debugging issue Y").
 *
 * DETECTION:
 * - AI analyzes video frames for context switches
 * - Detects app changes, file switches, topic transitions
 * - Confidence score (0-1) indicates boundary certainty
 *
 * PURPOSE:
 * - Navigate long recordings quickly
 * - Jump to specific work phases
 * - Understand session structure at a glance
 *
 * @see SessionVideo for parent video
 * @see EnrichmentPipeline for chapter generation
 *
 * @example
 * ```typescript
 * {
 *   id: 'chapter-abc123',
 *   sessionId: 'session-456',
 *   startTime: 600,   // 10 minutes from session start
 *   endTime: 1200,    // 20 minutes (10-minute chapter)
 *   title: 'Implementing OAuth callback handler',
 *   summary: 'Created callback endpoint and validated tokens',
 *   keyTopics: ['OAuth', 'callback', 'token validation'],
 *   thumbnail: 'data:image/png;base64,...',  // First frame of chapter
 *   confidence: 0.92,  // High confidence in this boundary
 *   createdAt: '2025-10-26T15:00:00Z'
 * }
 * ```
 */
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
/**
 * Session Video - Full session screen recording with intelligent chunking
 *
 * Records the entire session as a single video file, then optionally chunks it
 * into topic-aligned segments for easier navigation and on-demand analysis.
 *
 * STORAGE:
 * - Full video stored via Content-Addressable Storage
 * - fullVideoAttachmentId references complete recording
 * - chunks[] are separate video files for each topic segment
 *
 * VIDEO CHAPTERS:
 * - AI-detected semantic boundaries in the recording
 * - chapters[] provides thumbnail + summary for each topic change
 * - Generated during enrichment pipeline (optional, user-configurable)
 *
 * CHUNKING STATUS:
 * - pending: Not yet processed
 * - processing: Currently analyzing and splitting video
 * - complete: All chunks generated
 * - error: Chunking failed (see chunkingError)
 *
 * @see VideoChapter for chapter structure
 * @see SessionVideoChunk for chunked segment details
 * @see EnrichmentPipeline for video chapter generation
 *
 * @example
 * ```typescript
 * {
 *   id: 'video-123',
 *   sessionId: 'session-456',
 *   fullVideoAttachmentId: 'att-video-789',
 *   duration: 3600,  // 1 hour
 *   chunkingStatus: 'complete',
 *   chapters: [
 *     {
 *       id: 'chapter-1',
 *       startTime: 0,
 *       endTime: 900,
 *       title: 'Setting up authentication flow',
 *       summary: 'Configured OAuth provider and created login endpoint',
 *       keyTopics: ['OAuth', 'login', 'backend']
 *     },
 *     {
 *       id: 'chapter-2',
 *       startTime: 900,
 *       endTime: 1800,
 *       title: 'Debugging token validation',
 *       summary: 'Fixed JWT expiration handling issues',
 *       keyTopics: ['JWT', 'debugging', 'tokens']
 *     }
 *   ]
 * }
 * ```
 */
export interface SessionVideo {
  id: string;
  sessionId: string;
  /**
   * Complete session recording file attachment ID
   * Optional: For audio-only sessions (no video recording), this will be empty
   * For sessions with video recording, this references the full video file
   */
  fullVideoAttachmentId?: string;

  /**
   * Video file path on disk
   * Required for video playback and chaptering analysis
   * Video files are NOT stored in CA storage (too large)
   * Use this field directly for video playback (via convertFileSrc)
   */
  path?: string;

  /**
   * TASK 11: Optimized video/audio path (background processed media)
   * Created by BackgroundMediaProcessor after session ends
   *
   * For sessions with video: Contains merged video + audio in optimized H.264+AAC MP4 format
   * For audio-only sessions: Contains concatenated MP3 audio file
   *
   * Prefer this over `path` for instant playback (no runtime audio concatenation)
   * @since Task 11 - Background Enrichment
   */
  optimizedPath?: string;

  /**
   * Video identifier hash (SHA-256 of filePath + sessionId)
   * NOTE: This is NOT a content hash and NOT used for CAS lookup
   * Videos are stored on the file system, not in ContentAddressableStorage
   * Use the `path` field for video playback
   */
  hash?: string;

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

/**
 * Session Screenshot - Captured screen image with AI analysis
 *
 * Screenshots are automatically captured at intervals (default: 2 min, or adaptive).
 * Each screenshot is analyzed by Claude Vision API to extract:
 * - Activity detection (coding, email, slides, etc.)
 * - OCR text extraction
 * - Context changes (what changed since last screenshot)
 * - Suggested actions (TODOs noticed by AI)
 *
 * STORAGE:
 * - Stored via Content-Addressable Storage (CAS) using attachment hash
 * - attachmentId references deduplicated file in /attachments-ca/
 * - path field is DEPRECATED - use attachmentId instead
 *
 * AI ANALYSIS:
 * - Powered by Sessions Agent (sessionsAgentService.ts)
 * - Adaptive scheduling based on curiosity score (0-1)
 * - Progress tracking (achievements, blockers, insights)
 *
 * @see SessionsAgentService for analysis implementation
 * @see ContentAddressableStorage for storage system
 *
 * @example
 * ```typescript
 * {
 *   id: 'screenshot-123',
 *   sessionId: 'session-456',
 *   timestamp: '2025-10-26T14:30:00Z',
 *   attachmentId: 'att-789',  // ✅ New (CAS reference)
 *   path: '/screenshots/img.png',  // ❌ Deprecated
 *   analysisStatus: 'complete',
 *   aiAnalysis: {
 *     summary: 'Writing authentication logic in VS Code',
 *     detectedActivity: 'coding',
 *     extractedText: 'function validateToken(token: string) {...}',
 *     keyElements: ['VS Code', 'TypeScript', 'auth.ts'],
 *     confidence: 0.95,
 *     curiosity: 0.7,  // High interest - next screenshot sooner
 *     curiosityReason: 'Implementing new feature - want to see progress'
 *   }
 * }
 * ```
 */
export interface SessionScreenshot {
  id: string;
  sessionId: string;
  timestamp: string;
  attachmentId: string; // Reference to Attachment entity

  /**
   * Phase 4: SHA-256 hash for content-addressable storage
   * Used to load attachment data from ContentAddressableStorage
   */
  hash?: string;

  /**
   * @deprecated Use attachmentId instead. This field is maintained for backward compatibility
   * and will be removed in a future version. The path is now managed through the
   * ContentAddressableStorage system via attachmentId references.
   */
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
  analysisStatus: ScreenshotAnalysisStatus;
  analysisError?: string;
}

// Audio Recording Types
/**
 * @deprecated AudioMode is deprecated and will be removed in v2.0.
 * Use audioConfig.enabled boolean instead.
 *
 * Migration:
 * - 'off' → audioConfig: undefined or enabled: false
 * - 'transcription' | 'description' → audioConfig: { enabled: true, ... }
 *
 * Current usage: Session interface, ChunkedSessionStorage, openAIService
 * Will be removed after audioConfig migration is complete.
 *
 * @see AudioDeviceConfig for replacement
 */
export type AudioMode = 'off' | 'transcription' | 'description';

// ============================================================================
// Media Device Configuration
// ============================================================================

/**
 * Audio source types for recording
 */
export type AudioSourceType = 'microphone' | 'system-audio' | 'both';

/**
 * Audio device information returned from backend
 */
export interface AudioDevice {
  /** Unique device identifier from cpal/CoreAudio */
  id: string;

  /** Human-readable device name */
  name: string;

  /** Device type (input for mics, output for system audio loopback) */
  deviceType: 'Input' | 'Output';

  /** Whether this is the system default device */
  isDefault: boolean;

  /** Native sample rate in Hz */
  sampleRate: number;

  /** Number of audio channels */
  channels: number;
}

/**
 * Audio device configuration for a session
 */
/**
 * Audio Device Configuration - Audio input settings for session
 *
 * Configures which audio sources to record during a session:
 * - Microphone only (voice narration)
 * - System audio only (app sounds, music)
 * - Both (mixed with configurable balance)
 *
 * DEVICE SELECTION:
 * - micDeviceId: Specific microphone (from AudioDevice list)
 * - systemAudioDeviceId: System audio loopback device
 * - undefined values = use system default
 *
 * MIXING:
 * - balance: 0 = all mic, 100 = all system audio, 50 = equal mix
 * - micVolume/systemVolume: Individual volume controls (0.0-1.0)
 *
 * @see AudioDevice for available devices
 * @see Session.audioConfig for per-session configuration
 *
 * @example
 * ```typescript
 * {
 *   sourceType: 'both',  // Record mic + system audio
 *   micDeviceId: 'mic-device-123',
 *   systemAudioDeviceId: 'loopback-device-456',
 *   balance: 30,  // 30% mic, 70% system audio
 *   micVolume: 0.8,
 *   systemVolume: 0.5
 * }
 * ```
 */
export interface AudioDeviceConfig {
  /** Selected microphone device ID */
  micDeviceId?: string;

  /** Selected system audio device ID (for computer audio capture) */
  systemAudioDeviceId?: string;

  /** Audio source type */
  sourceType: AudioSourceType;

  /** Balance between mic and system audio (0-100)
   * 0 = all microphone, 100 = all system audio, 50 = equal mix
   * Only applicable when sourceType is 'both'
   */
  balance?: number;

  /** Individual volume for microphone (0.0-1.0) */
  micVolume?: number;

  /** Individual volume for system audio (0.0-1.0) */
  systemVolume?: number;

  /** Voice Activity Detection enabled
   * When true, silent audio segments are detected and skipped for transcription (cost savings)
   * When false, all audio is transcribed regardless of voice activity
   * Default: false (disabled for testing)
   */
  vadEnabled?: boolean;

  /** Voice Activity Detection threshold in decibels (-50 to -20)
   * Lower values (e.g., -50) are more sensitive and catch quieter speech
   * Higher values (e.g., -30) are more aggressive and filter out more audio
   * Default: -45 (catches most speech while filtering background noise)
   */
  vadThreshold?: number;
}

/**
 * Video source types for recording
 */
export type VideoSourceType = 'display' | 'window' | 'webcam' | 'display-with-webcam';

/**
 * Display information returned from backend
 */
export interface DisplayInfo {
  /** Display ID from ScreenCaptureKit */
  displayId: string;

  /** Display name (e.g., "Built-in Retina Display") */
  displayName: string;

  /** Display width in pixels */
  width: number;

  /** Display height in pixels */
  height: number;

  /** Whether this is the primary/main display */
  isPrimary: boolean;

  /** Optional thumbnail preview (base64 PNG) */
  thumbnail?: string;

  /** Thumbnail data URI (base64 PNG with data:image/png;base64, prefix) */
  thumbnailDataUri?: string;
}

/**
 * Window information returned from backend
 */
export interface WindowInfo {
  /** Window ID from ScreenCaptureKit */
  windowId: string;

  /** Window title */
  title: string;

  /** Owning application name */
  owningApp: string;

  /** Application bundle identifier */
  bundleId: string;

  /** Window bounds */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Window layer (z-order) */
  layer: number;

  /** Thumbnail data URI (base64 PNG with data:image/png;base64, prefix) */
  thumbnailDataUri?: string;
}

/**
 * Webcam device information returned from backend
 */
export interface WebcamInfo {
  /** Camera device ID from AVFoundation */
  deviceId: string;

  /** Camera name (e.g., "FaceTime HD Camera") */
  deviceName: string;

  /** Camera position */
  position: 'front' | 'back' | 'unspecified';

  /** Device manufacturer */
  manufacturer: string;
}

/**
 * Picture-in-Picture configuration
 */
export interface PiPConfig {
  /** Whether PiP is enabled */
  enabled: boolean;

  /** Position of webcam overlay */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  /** Size of webcam overlay */
  size: 'small' | 'medium' | 'large';

  /** Border radius in pixels */
  borderRadius?: number;
}

/**
 * Video recording configuration for a session
 */
/**
 * Video Recording Configuration - Screen recording settings for session
 *
 * Configures what to record during a session:
 * - Which display(s) to capture
 * - Whether to include webcam (Picture-in-Picture)
 * - Video quality and frame rate
 *
 * SOURCE TYPES:
 * - display: Record one or more displays
 * - window: Record specific application windows
 * - webcam: Record webcam only
 * - display-with-webcam: Display + webcam overlay (PiP)
 * - multi-source: Multiple sources with compositing (Wave 1.3)
 *
 * QUALITY PRESETS:
 * - low: 720p @ 15fps (~200MB/hour)
 * - medium: 1080p @ 30fps (~500MB/hour)
 * - high: 1080p @ 60fps (~1GB/hour)
 * - ultra: 4K @ 60fps (~3GB/hour)
 *
 * PICTURE-IN-PICTURE:
 * - pipConfig.position: Where to overlay webcam
 * - pipConfig.size: Webcam overlay size
 * - pipConfig.borderRadius: Rounded corners
 *
 * @see DisplayInfo for available displays
 * @see WindowInfo for available windows
 * @see WebcamInfo for available cameras
 * @see PiPConfig for overlay configuration
 *
 * @example
 * ```typescript
 * {
 *   sourceType: 'display-with-webcam',
 *   displayIds: ['display-main'],
 *   webcamDeviceId: 'facetime-camera',
 *   pipConfig: {
 *     enabled: true,
 *     position: 'bottom-right',
 *     size: 'small',
 *     borderRadius: 8
 *   },
 *   quality: 'medium',  // 1080p @ 30fps
 *   fps: 30
 * }
 * ```
 */
export interface VideoRecordingConfig {
  /** Video source type (now includes 'multi-source' for Wave 1.3) */
  sourceType: VideoSourceType | 'multi-source';

  /** Selected display IDs (for display recording) */
  displayIds?: string[];

  /** Selected window IDs (for window-specific recording) */
  windowIds?: string[];

  /** Selected webcam device ID */
  webcamDeviceId?: string;

  /** Multi-source recording configuration (Wave 1.3) */
  multiSourceConfig?: {
    sources: Array<{
      type: 'display' | 'window' | 'webcam';
      id: string;
      name?: string;
    }>;
    compositor: 'passthrough' | 'grid' | 'sidebyside';
  };

  /** Picture-in-Picture configuration (when using webcam with display) */
  pipConfig?: PiPConfig;

  /** Video quality preset */
  quality: 'low' | 'medium' | 'high' | 'ultra';

  /** Frame rate (10-60 fps) */
  fps: number;

  /** Resolution override (optional, defaults to native) */
  resolution?: {
    width: number;
    height: number;
  };
}

/**
 * Session recording configuration for XState machine
 * Used to configure what gets recorded during a session
 */
export interface SessionRecordingConfig {
  /** Session name */
  name: string;

  /** Session description (optional) */
  description?: string;

  /** Enable screenshot capture */
  screenshotsEnabled: boolean;

  /** Audio recording configuration (optional) */
  audioConfig?: {
    enabled: boolean;
    sourceType: AudioSourceType;
    micDeviceId?: string;
    systemAudioDeviceId?: string;
    balance?: number;
    micVolume?: number;
    systemVolume?: number;
  };

  /** Video recording configuration (optional) */
  videoConfig?: {
    enabled: boolean;
    sourceType: VideoSourceType;
    displayIds?: string[];
    windowIds?: string[];
    webcamDeviceId?: string;
    quality?: 'low' | 'medium' | 'high' | 'ultra';
    fps?: number;
    resolution?: {
      width: number;
      height: number;
    };
  };
}

/**
 * Session Audio Segment - Recorded audio chunk with transcription
 *
 * Audio is recorded in 10-second segments and transcribed using OpenAI Whisper-1.
 * Segments are later upgraded to word-level transcripts during ONE-TIME audio review.
 *
 * STORAGE:
 * - Audio WAV file stored via Content-Addressable Storage
 * - attachmentId references deduplicated audio in /attachments-ca/
 * - Compressed MP3 version available in attachment.compressed field
 *
 * TRANSCRIPTION QUALITY:
 * - draft: Initial 10s chunk transcript from Whisper-1 (real-time)
 * - final: Word-accurate transcript from full session re-transcription (ONE-TIME review)
 *
 * AI METADATA:
 * - keyPhrases: Important phrases extracted from this segment
 * - sentiment: Emotional tone (positive/neutral/negative)
 * - containsTask/containsBlocker: AI-detected flags for summary generation
 *
 * @see OpenAI Whisper-1 for transcription
 * @see AudioInsights for ONE-TIME comprehensive audio review
 *
 * @example
 * ```typescript
 * {
 *   id: 'audio-123',
 *   sessionId: 'session-456',
 *   timestamp: '2025-10-26T14:30:00Z',
 *   duration: 10,
 *   transcription: 'Okay so I need to implement OAuth authentication...',
 *   attachmentId: 'att-audio-789',
 *   transcriptionQuality: 'draft',  // Will become 'final' after ONE-TIME review
 *   enrichedTranscription: 'Okay, so I need to implement OAuth authentication.',  // Word-accurate
 *   keyPhrases: ['OAuth', 'authentication', 'implement'],
 *   sentiment: 'neutral',
 *   containsTask: true
 * }
 * ```
 */
export interface SessionAudioSegment {
  id: string;
  sessionId: string;
  timestamp: string;
  duration: number; // seconds
  transcription: string; // Speech-to-text (always from Whisper-1)
  attachmentId?: string; // Reference to audio WAV file in storage

  /**
   * Phase 4: SHA-256 hash for content-addressable storage
   * Used to load attachment data from ContentAddressableStorage
   */
  hash?: string;

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
/**
 * Audio Key Moment - AI-identified important timestamp in audio
 *
 * DEPRECATED: This type is deprecated in favor of AudioInsights.keyMoments.
 * Kept for backward compatibility with sessions recorded before October 2025.
 *
 * Represents a single significant moment detected in session audio:
 * - Achievements: "Completed the feature"
 * - Blockers: "Hit an error I can't figure out"
 * - Decisions: "Going with approach B instead"
 * - Insights: "Oh, I see the pattern now"
 *
 * DETECTION:
 * - AI analyzes audio transcription for semantic significance
 * - Timestamps relative to session start (in seconds)
 * - excerpt contains actual spoken words
 *
 * @deprecated Use AudioInsights.keyMoments instead
 * @see AudioInsights for comprehensive audio analysis
 * @see Session.audioKeyMoments for legacy usage
 *
 * @example
 * ```typescript
 * {
 *   id: 'moment-123',
 *   timestamp: 1245,  // 20 minutes 45 seconds from session start
 *   label: 'Completed authentication flow',
 *   type: 'achievement',
 *   segmentId: 'audio-segment-789',
 *   excerpt: 'Okay, auth flow is working now. Users can log in.'
 * }
 * ```
 */
export interface AudioKeyMoment {
  id: string;
  timestamp: number; // Seconds from session start
  label: string; // "Started debugging", "Completed feature", etc.
  type: 'achievement' | 'blocker' | 'decision' | 'insight';
  segmentId: string; // Which audio segment this came from
  excerpt: string; // What the user said
}

/**
 * Audio Insights - Comprehensive Post-Session Audio Analysis
 *
 * Deep audio analysis using GPT-4o audio preview model. This is a ONE-TIME operation
 * performed after session ends, never re-processed (cached permanently).
 *
 * WHY AUDIO INSIGHTS?
 * Audio captures the emotional journey, work patterns, and environmental context that
 * screenshots cannot. The AI listens to the entire session audio and extracts:
 * - Emotional progression (frustration → breakthrough → satisfaction)
 * - Key moments (decisions, achievements, blockers, insights)
 * - Work patterns (flow states, interruptions, focus level)
 * - Environmental context (ambient noise, work setting)
 *
 * PROCESSING:
 * 1. All audio segments concatenated into single file
 * 2. Downsampled to 16kHz mono for efficient processing
 * 3. Sent to GPT-4o audio preview (entire session in one call)
 * 4. AI returns structured insights (emotional journey, key moments, patterns)
 * 5. Results cached in audioInsights field (never re-processed)
 *
 * COST CONSIDERATIONS:
 * - GPT-4o audio preview: ~$0.10/minute of audio
 * - ONE-TIME only (never re-run, always cached)
 * - User can opt-out via enrichmentConfig.includeAudioReview: false
 * - Cost tracked in enrichmentStatus.audio.cost
 *
 * DATA STRUCTURE:
 * - narrative: Overall story from audio perspective
 * - emotionalJourney: Emotion timeline (timestamp + emotion + description)
 * - keyMoments: Critical events (timestamp + type + description + context)
 * - workPatterns: Focus level, interruptions, flow states
 * - environmentalContext: Ambient noise, work setting, time of day
 *
 * USAGE:
 * ```typescript
 * if (session.audioReviewCompleted && session.audioInsights) {
 *   // Access emotional journey
 *   const emotions = session.audioInsights.emotionalJourney;
 *   console.log(emotions[0].emotion); // "focused"
 *
 *   // Find key moments
 *   const breakthroughs = session.audioInsights.keyMoments
 *     .filter(m => m.type === 'achievement');
 *
 *   // Check work patterns
 *   const flowStates = session.audioInsights.workPatterns.flowStates;
 *   console.log(`Flow state: ${flowStates[0].description}`);
 * }
 * ```
 *
 * BACKWARD COMPATIBILITY:
 * - Legacy fields (summary, extractedTasks, etc.) retained for old sessions
 * - New sessions use structured fields (emotionalJourney, keyMoments, etc.)
 *
 * KEY DIFFERENCES vs. REAL-TIME TRANSCRIPTION:
 * - Real-time: Whisper-1, 10-second chunks, draft quality
 * - Audio review: GPT-4o audio, full session, comprehensive analysis
 * - Real-time: Transcription only
 * - Audio review: Emotion, patterns, context, meaning
 *
 * @see Session.audioReviewCompleted to check if review is done
 * @see Session.fullAudioAttachmentId for concatenated audio file
 * @see Session.audioSegments for real-time transcription chunks
 * @see enrichmentStatus.audio for processing status and cost
 */
/**
 * Audio Insights - Comprehensive post-session audio analysis
 *
 * ONE-TIME PROCESSING: This analysis is performed exactly once after session ends.
 * Never re-run - too expensive (~$2-5 per session depending on length).
 *
 * Powered by GPT-4o audio-preview model which analyzes the FULL session audio
 * (not just transcription) to extract:
 * - Emotional journey throughout session
 * - Key moments (achievements, blockers, decisions, insights)
 * - Work patterns (focus level, interruptions, flow states)
 * - Environmental context (noise, setting, time of day)
 *
 * COST TRACKING:
 * - Processing cost tracked in enrichmentStatus.audio.cost
 * - Typical cost: $2-5 per hour of audio
 * - User can disable via enrichmentConfig.includeAudioReview = false
 *
 * WORKFLOW:
 * 1. Session ends
 * 2. All audio segments concatenated + downsampled to 16kHz mono
 * 3. ONE-TIME GPT-4o audio analysis
 * 4. Results cached in this structure
 * 5. Never re-processed (even if prompt changes)
 *
 * @see Session.audioInsights for stored results
 * @see EnrichmentPipeline for processing workflow
 * @see Session.enrichmentStatus.audio for cost tracking
 *
 * @example
 * ```typescript
 * {
 *   narrative: 'Started focused on implementing OAuth, hit frustrating bugs mid-session, ended with breakthrough understanding of token flow',
 *   emotionalJourney: [
 *     {
 *       timestamp: 0,
 *       emotion: 'focused',
 *       description: 'Deep concentration at session start'
 *     },
 *     {
 *       timestamp: 1800,
 *       emotion: 'frustrated',
 *       description: 'Struggling with unexpected token expiration errors'
 *     },
 *     {
 *       timestamp: 3200,
 *       emotion: 'relieved',
 *       description: 'Finally understood the problem'
 *     }
 *   ],
 *   keyMoments: [
 *     {
 *       timestamp: 3245,
 *       type: 'insight',
 *       description: 'Realized tokens were expiring because of timezone mismatch',
 *       context: 'This was the breakthrough that solved 2 hours of debugging',
 *       excerpt: 'Oh wait, the timestamp is in UTC but we are checking it in local time'
 *     }
 *   ],
 *   workPatterns: {
 *     focusLevel: 'high',
 *     interruptions: 2,
 *     flowStates: [
 *       {
 *         start: 0,
 *         end: 2100,
 *         description: 'Deep focus on implementation'
 *       }
 *     ]
 *   },
 *   environmentalContext: {
 *     ambientNoise: 'Quiet, occasional keyboard typing',
 *     workSetting: 'Home office',
 *     timeOfDay: 'Morning (inferred from energy level and "good morning" greeting)'
 *   },
 *   processedAt: '2025-10-26T15:30:00Z',
 *   modelUsed: 'gpt-4o-audio-preview',
 *   processingDuration: 45  // 45 seconds to analyze 1 hour of audio
 * }
 * ```
 */
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
/**
 * Session Context Item - User-added notes/markers during session
 *
 * Manual context added by user while session is active:
 * - Quick notes about what they're doing
 * - Markers for important moments
 * - Links to existing tasks/notes
 *
 * TYPES:
 * - note: Free-form text note
 * - task: Action item (can create Task later)
 * - marker: Timestamp marker (e.g., "Started debugging here")
 *
 * LINKING:
 * - linkedItemId: References existing Note or Task
 * - Allows associating session work with existing items
 *
 * DEPRECATED FIELDS:
 * - noteId/taskId: Legacy linking (use linkedItemId instead)
 *
 * @see Session.contextItems for all context in a session
 *
 * @example
 * ```typescript
 * {
 *   id: 'context-123',
 *   sessionId: 'session-456',
 *   timestamp: '2025-10-26T14:30:00Z',
 *   type: 'note',
 *   content: 'Discovered that token expiration handling was broken',
 *   linkedItemId: 'note-789'  // Links to existing note
 * }
 * ```
 */
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

// Legacy types removed - now using named exports at top of file
// See: TaskStatus, TaskPriority (lines 83, 113)

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

// ============================================================================
// Recording Error Types (matches Rust RecordingError from Phase 1)
// ============================================================================

export type RecordingErrorType =
  | 'PermissionDenied'
  | 'DeviceNotFound'
  | 'DeviceInUse'
  | 'SystemError'
  | 'InvalidConfiguration'
  | 'Timeout'
  | 'PlatformUnsupported'
  | 'Internal';

export type RecordingPermissionType =
  | 'screenRecording'
  | 'microphone'
  | 'systemAudio'
  | 'camera';

export type RecordingDeviceType =
  | 'microphone'
  | 'systemAudio'
  | 'camera'
  | 'display'
  | 'window';

export type RecordingErrorSource =
  | 'screenCaptureKit'
  | 'avFoundation'
  | 'coreAudio'
  | 'cpal'
  | 'ffi'
  | 'codeSignature';

// Discriminated union matching Rust #[serde(tag = "type", content = "data")]
export type RecordingError =
  | {
      type: 'PermissionDenied';
      data: {
        permission: RecordingPermissionType;
        canRetry: boolean;
        systemMessage?: string;
      };
    }
  | {
      type: 'DeviceNotFound';
      data: {
        deviceType: RecordingDeviceType;
        deviceId?: string;
      };
    }
  | {
      type: 'DeviceInUse';
      data: {
        deviceType: RecordingDeviceType;
        deviceId: string;
      };
    }
  | {
      type: 'SystemError';
      data: {
        source: RecordingErrorSource;
        message: string;
        isRecoverable: boolean;
      };
    }
  | {
      type: 'InvalidConfiguration';
      data: {
        field: string;
        reason: string;
      };
    }
  | {
      type: 'Timeout';
      data: {
        operation: string;
        timeoutMs: number;
      };
    }
  | {
      type: 'PlatformUnsupported';
      data: {
        feature: string;
        requiredVersion: string;
      };
    }
  | {
      type: 'Internal';
      data: {
        message: string;
      };
    };

// Type guards
export function isRecordingError(error: unknown): error is RecordingError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'data' in error
  );
}

export function isPermissionError(error: unknown): error is RecordingError & { type: 'PermissionDenied' } {
  return isRecordingError(error) && error.type === 'PermissionDenied';
}

// User-friendly error messages
export function formatRecordingError(error: RecordingError): string {
  switch (error.type) {
    case 'PermissionDenied':
      return error.data.systemMessage ||
        `${error.data.permission} permission denied. Please enable in System Settings.`;
    case 'DeviceNotFound':
      return `${error.data.deviceType} device not found.`;
    case 'DeviceInUse':
      return `${error.data.deviceType} is already in use by another application.`;
    case 'SystemError':
      return error.data.message || 'A system error occurred.';
    case 'InvalidConfiguration':
      return `Invalid ${error.data.field}: ${error.data.reason}`;
    case 'Timeout':
      return `${error.data.operation} timed out after ${error.data.timeoutMs}ms.`;
    case 'PlatformUnsupported':
      return `${error.data.feature} requires ${error.data.requiredVersion}.`;
    case 'Internal':
      return error.data.message || 'An internal error occurred.';
  }
}

// Get permission display name
export function getPermissionDisplayName(permission: RecordingPermissionType): string {
  const names: Record<RecordingPermissionType, string> = {
    screenRecording: 'Screen Recording',
    microphone: 'Microphone',
    systemAudio: 'System Audio',
    camera: 'Camera'
  };
  return names[permission];
}
