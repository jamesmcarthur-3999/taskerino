// Core Data Types

// Attachment Types
export type AttachmentType = 'image' | 'video' | 'file' | 'link' | 'screenshot';

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

export type TabType = 'capture' | 'tasks' | 'library' | 'assistant' | 'profile';

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
  };
  stats: {
    captureCount: number;
    taskCount: number;
    sessionCount: number;
  };
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
  type: 'text' | 'task-list' | 'note-list' | 'tool-use' | 'tool-result' | 'error' | 'thinking';
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

  // UI State - NEW
  ui: UIState;

  // Legacy zone state (keep for migration)
  currentZone: 'capture' | 'tasks' | 'library' | 'assistant' | 'profile';
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

// Legacy types (for backward compatibility during refactor)
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
