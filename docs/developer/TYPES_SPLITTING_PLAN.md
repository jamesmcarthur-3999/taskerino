# types.ts Splitting Plan

**Date**: October 26, 2025
**Author**: Claude Code (automated analysis)
**File Analyzed**: `src/types.ts` (2,181 lines)

---

## Executive Summary

- **Total types to migrate**: 94 exported types/interfaces/enums
- **Proposed structure**: 12 focused files + 1 barrel export
- **Files importing from types.ts**: ~300 import statements across codebase
- **Estimated effort**: 12-16 hours (2 days)
- **Risk level**: **Medium-High** (high usage, complex dependencies, but no runtime changes)
- **Recommended approach**: **Barrel Export** (backward compatible, incremental migration)
- **Breaking changes**: None (with barrel export strategy)

---

## Type Inventory

### Total Count by Export Type

| Export Type | Count | Examples |
|-------------|-------|----------|
| `interface` | 73 | Session, Task, Note, Attachment, etc. |
| `type` (union/alias) | 18 | TabType, AudioMode, StoryType, etc. |
| `function` | 3 | isFlexibleSummary(), isLegacySummary(), getSectionByType() |
| **TOTAL** | **94** | |

### Categories Found

| Category | Type Count | Line Count | Key Types | Complexity |
|----------|-----------|-----------|----------|------------|
| **Sessions** | 35 | ~900 | Session, SessionScreenshot, SessionVideo, SessionSummary | **High** |
| **AI & Canvas** | 28 | ~450 | CanvasSpec, FlexibleSessionSummary, AudioInsights, SessionSummaryContext | **High** |
| **Tasks** | 4 | ~70 | Task, SubTask, ManualTaskData | **Medium** |
| **Notes** | 3 | ~60 | Note, NoteUpdate, ManualNoteData | **Medium** |
| **Entities** | 4 | ~60 | Topic, Company, Contact, ManualTopicData | **Low** |
| **Attachments** | 2 | ~55 | Attachment, AttachmentRef | **Medium** |
| **UI State** | 9 | ~260 | UIState, UserPreferences, OnboardingState, Notification | **Medium** |
| **AI Processing** | 3 | ~70 | AIProcessResult, AIQueryResponse, ProcessingJob | **Medium** |
| **Ned Assistant** | 4 | ~50 | NedSettings, NedMessage, NedConversation | **Low** |
| **Learning System** | 5 | ~90 | Learning, UserLearnings, LearningSettings | **Low** |
| **Media Config** | 10 | ~200 | AudioDeviceConfig, VideoRecordingConfig, DisplayInfo | **Medium** |
| **Utilities** | 5 | ~30 | TabType, NotificationType, ActivityMetrics | **Low** |

**Total**: 94 types across 12 categories

### Deprecated Types (8 markers found)

| Type/Field | Reason | Replacement | Can Remove? | Migration Status |
|------------|--------|-------------|-------------|------------------|
| `Note.topicId` | Legacy single-topic model | `relationships[]` array | After full migration | ⚠️ In progress |
| `Note.sourceSessionId` | Legacy session link | `relationships[]` array | After full migration | ⚠️ In progress |
| `Task.noteId` | Legacy note link | `relationships[]` array | After full migration | ⚠️ In progress |
| `Task.sourceNoteId` | Legacy note link | `relationships[]` array | After full migration | ⚠️ In progress |
| `Task.sourceSessionId` | Legacy session link | `relationships[]` array | After full migration | ⚠️ In progress |
| `Session.extractedTaskIds` | Legacy task refs | `relationships[]` array | After full migration | ⚠️ In progress |
| `Session.extractedNoteIds` | Legacy note refs | `relationships[]` array | After full migration | ⚠️ In progress |
| `SessionScreenshot.path` | Legacy file path | `attachmentId` with CAS | After CAS migration | ⚠️ In progress |

**Migration Path**: All deprecated fields use the new `relationships[]` array and `relationshipVersion` tracking. Fields can be removed once `relationshipVersion=1` is universal across all entities.

### Dependency Graph (Major Types)

```
Session (CORE - most complex)
├─→ SessionScreenshot → Attachment
├─→ SessionAudioSegment → Attachment
├─→ SessionVideo → Attachment
├─→ SessionSummary → FlexibleSessionSummary
├─→ AudioInsights
├─→ CanvasSpec → CanvasTheme, CanvasLayout
├─→ EnrichmentStatus (nested type)
├─→ Relationship (from types/relationships.ts)
└─→ SessionContextItem → Note, Task (circular potential)

Task
├─→ SubTask
├─→ Topic (optional)
├─→ Company, Contact (optional, arrays)
├─→ Attachment (array)
├─→ Relationship (from types/relationships.ts)
└─→ Note (via noteId - deprecated, circular)

Note
├─→ NoteUpdate (array)
├─→ Company, Contact, Topic (optional, arrays)
├─→ Attachment (array)
├─→ Relationship (from types/relationships.ts)
└─→ Task (via parent relationship - circular)

UIState
├─→ ProcessingJob → AIProcessResult
├─→ Notification
├─→ UserPreferences → TabType, Task (for filters)
├─→ OnboardingState
└─→ NedConversation → NedMessage

CanvasSpec
├─→ CanvasTheme, CanvasLayout
├─→ CanvasSection (recursive)
└─→ ComponentTree (external import)

FlexibleSessionSummary (Phase 2 - AI Canvas)
├─→ SessionSummaryContext → VideoChapter, AudioInsights, Task, Note
├─→ SummarySection (union of 15+ section types)
└─→ SourceCitation
```

**Circular Dependency Risks**:
1. **Session ↔ Note/Task** (via SessionContextItem.noteId/taskId)
2. **Note ↔ Task** (via deprecated noteId field)
3. **UIState → Task → UIState** (via UserPreferences filters)

**Resolution Strategy**: Use `type` imports exclusively for cross-domain references.

---

## Proposed File Structure

### Directory: `src/types/`

```
src/types/
├── index.ts              # Barrel export (backward compatibility)
├── relationships.ts      # [EXISTING] Unified relationship system
├── sessions.ts           # Session core types
├── session-media.ts      # Session media (screenshots, audio, video)
├── session-enrichment.ts # Session enrichment (summaries, AI analysis)
├── tasks.ts              # Task types
├── notes.ts              # Note types
├── entities.ts           # Topic, Company, Contact
├── attachments.ts        # Attachment & AttachmentRef
├── canvas.ts             # AI Canvas & summary types
├── ai.ts                 # AI processing types
├── ui.ts                 # UI state & preferences
├── ned.ts                # Ned assistant types
├── learning.ts           # Learning system types
├── media-devices.ts      # Audio/video device configuration
└── utilities.ts          # Simple types (TabType, enums, etc.)
```

### File Details

#### 1. `types/sessions.ts` (~180 lines)

**Purpose**: Core Session entity and lifecycle types

**Types** (7):
- `Session` (main interface, ~230 lines in original)
- `SessionRecordingConfig` (recording configuration)
- `SessionContextItem` (user-added context during session)
- `ActivityMetrics` (activity monitoring for adaptive screenshots)
- `TaskStatus` (legacy type alias)
- `TaskPriority` (legacy type alias)
- Type guards: `isFlexibleSummary()`, `isLegacySummary()` (moved from root)

**Dependencies**:
- **Imports FROM**:
  - `./session-media` → SessionScreenshot, SessionAudioSegment, SessionVideo
  - `./session-enrichment` → SessionSummary, EnrichmentStatus, AudioInsights, CanvasSpec
  - `./relationships` → Relationship (already exists)
  - `./attachments` → Attachment (for video.fullVideoAttachmentId)
  - `./media-devices` → AudioDeviceConfig, VideoRecordingConfig
- **Imported BY**: Almost every session-related file (high usage)

**Risk**: **High** - Core type used everywhere, but barrel export mitigates

---

#### 2. `types/session-media.ts` (~220 lines)

**Purpose**: Session media capture types (screenshots, audio, video)

**Types** (10):
- `SessionScreenshot` (screenshot with AI analysis)
- `SessionAudioSegment` (audio chunk with transcription)
- `SessionVideo` (full video recording)
- `SessionVideoChunk` (topic-aligned video segment)
- `VideoFrame` (extracted frame for analysis)
- `VideoChapter` (semantic video boundary)
- `AudioKeyMoment` (DEPRECATED - replaced by AudioInsights.keyMoments)
- `AudioMode` (DEPRECATED - simple enum)
- `AudioInsights` (comprehensive audio analysis) - **MOVED to session-enrichment.ts**

**Dependencies**:
- **Imports FROM**:
  - `./attachments` → Attachment (for attachmentId references)
- **Imported BY**:
  - `./sessions` (Session interface)
  - `RecordingContext`, session-related components

**Risk**: **Medium** - Focused domain, clear boundaries

---

#### 3. `types/session-enrichment.ts` (~550 lines)

**Purpose**: Post-session AI enrichment types (summaries, analysis, status tracking)

**Types** (8 + nested):
- `SessionSummary` (Phase 1 - legacy summary with optional temporal fields)
- `SessionSummaryContext` (context for AI summary generation)
- `FlexibleSessionSummary` (Phase 2 - section-based architecture)
- `SummarySection` (union type of 15 section variants)
- Individual section types (15): AchievementsSection, BlockersSection, etc.
- `AudioInsights` (comprehensive audio analysis)
- `EnrichmentStatus` (nested in Session, but defined here for clarity)

**Dependencies**:
- **Imports FROM**:
  - `./session-media` → VideoChapter (for SessionSummaryContext)
  - `./tasks` → Task (for SessionSummaryContext.relatedContext)
  - `./notes` → Note (for SessionSummaryContext.relatedContext)
- **Imported BY**:
  - `./sessions` (Session.summary, Session.enrichmentStatus)
  - Enrichment services

**Risk**: **Medium-High** - Complex types, but well-isolated domain

---

#### 4. `types/tasks.ts` (~100 lines)

**Purpose**: Task management types

**Types** (3):
- `Task` (main task interface)
- `SubTask` (checklist item)
- `ManualTaskData` (for manual task creation)

**Dependencies**:
- **Imports FROM**:
  - `./entities` → Topic, Company, Contact
  - `./attachments` → Attachment
  - `./relationships` → Relationship
  - `./notes` → Note (circular - use `import type`)
- **Imported BY**: TasksContext, task components, filters

**Risk**: **Medium** - High usage, but straightforward types

---

#### 5. `types/notes.ts` (~90 lines)

**Purpose**: Note types

**Types** (3):
- `Note` (main note interface)
- `NoteUpdate` (note history entry)
- `ManualNoteData` (for manual note creation)

**Dependencies**:
- **Imports FROM**:
  - `./entities` → Topic, Company, Contact
  - `./attachments` → Attachment
  - `./relationships` → Relationship
  - `./tasks` → Task (circular - use `import type`)
- **Imported BY**: NotesContext, note components, AI processing

**Risk**: **Medium** - High usage, circular dependency with Task

---

#### 6. `types/entities.ts` (~70 lines)

**Purpose**: Entity types (Topic, Company, Contact)

**Types** (4):
- `Topic` (topic/category entity)
- `Company` (company entity with profile)
- `Contact` (person entity with profile)
- `ManualTopicData` (for manual topic creation)

**Dependencies**:
- **Imports FROM**: None (leaf types)
- **Imported BY**: Tasks, Notes, EntitiesContext, filters

**Risk**: **Low** - Simple types, no dependencies

---

#### 7. `types/attachments.ts` (~60 lines)

**Purpose**: Attachment and file reference types

**Types** (3):
- `Attachment` (file attachment with AI analysis)
- `AttachmentRef` (content-addressable storage reference)
- `AttachmentType` (union type)

**Dependencies**:
- **Imports FROM**: None (leaf types)
- **Imported BY**: Sessions, Tasks, Notes, storage services

**Risk**: **Low** - Simple, widely used but stable

---

#### 8. `types/canvas.ts` (~650 lines)

**Purpose**: AI Canvas and advanced session analysis types

**Types** (23):
- `CanvasSpec` (canvas specification)
- `CanvasTheme`, `CanvasLayout`, `CanvasSection` (layout types)
- `SourceCitation` (citation for AI claims)
- `AICanvasSessionCharacteristics` (session characteristics)
- `EnrichedSessionCharacteristics` (extends characteristics)
- Temporal analysis types (5): TemporalAnalysis, ContentRichness, AchievementProfile, EnergyAnalysis, NarrativeStructure
- Moment types (3): Moment, Milestone, SessionInsight
- `StoryType` (story classification enum)

**Dependencies**:
- **Imports FROM**:
  - External: `./components/canvas` → ComponentTree (already exists)
- **Imported BY**:
  - `./sessions` (Session.canvasSpec)
  - Canvas components, AI canvas generator

**Risk**: **Low-Medium** - Complex but isolated, used only by canvas system

---

#### 9. `types/ai.ts` (~90 lines)

**Purpose**: AI processing and query types

**Types** (4):
- `AIProcessResult` (result of AI note/task processing)
- `AIQueryResponse` (Ned query response)
- `ProcessingJob` (background job tracking)
- `CaptureDraft` (multi-modal input before processing)

**Dependencies**:
- **Imports FROM**:
  - `./tasks` → Task (for AIProcessResult.tasks)
  - `./notes` → Note (for AIProcessResult.notes)
  - `./attachments` → Attachment (for CaptureDraft.attachments)
- **Imported BY**: AI services, CaptureZone, background processing

**Risk**: **Low-Medium** - Focused domain, clear boundaries

---

#### 10. `types/ui.ts` (~250 lines)

**Purpose**: UI state, preferences, notifications

**Types** (9):
- `UIState` (global UI state)
- `UserPreferences` (user settings)
- `OnboardingState` (onboarding progress)
- `Notification` (toast notification)
- `SearchHistoryItem` (search history)
- `TabType` (navigation tab enum)
- `NotificationType` (notification level enum)
- `AISettings` (AI configuration)
- `LearningSettings` (learning system config)

**Dependencies**:
- **Imports FROM**:
  - `./ai` → ProcessingJob (for UIState.backgroundProcessing)
  - `./tasks` → Task (for UserPreferences.filters)
  - `./ned` → NedConversation (for UIState - WRONG, should be in AppState)
- **Imported BY**: UIContext, settings components

**Risk**: **Medium** - Central state type, but well-structured

**Note**: `NedConversation` reference in original UIState is incorrect - should be in AppState only.

---

#### 11. `types/ned.ts` (~60 lines)

**Purpose**: Ned AI assistant types

**Types** (4):
- `NedSettings` (Ned configuration)
- `NedPermission` (tool permission)
- `NedMessage` (chat message)
- `NedMessageContent` (message content union)
- `NedConversation` (conversation state)

**Dependencies**:
- **Imports FROM**:
  - `./tasks` → Task (for NedMessageContent.tasks)
  - `./notes` → Note (for NedMessageContent.notes)
- **Imported BY**: Ned services, AssistantZone, UIContext (for settings)

**Risk**: **Low** - Isolated assistant domain

---

#### 12. `types/learning.ts` (~100 lines)

**Purpose**: Learning system types

**Types** (5):
- `Learning` (learning pattern)
- `UserLearnings` (user learning profile)
- `LearningEvidence` (evidence for learning)
- `LearningCategory` (learning category enum)
- `LearningStatus` (learning status enum)

**Dependencies**:
- **Imports FROM**: None (leaf types)
- **Imported BY**: Learning services, settings

**Risk**: **Low** - Isolated system, low usage

---

#### 13. `types/media-devices.ts` (~220 lines)

**Purpose**: Audio/video device configuration types

**Types** (10):
- `AudioSourceType` (mic, system audio, both)
- `AudioDevice` (audio device info)
- `AudioDeviceConfig` (session audio config)
- `VideoSourceType` (display, window, webcam, etc.)
- `DisplayInfo` (display information)
- `WindowInfo` (window information)
- `WebcamInfo` (webcam device info)
- `PiPConfig` (picture-in-picture config)
- `VideoRecordingConfig` (session video config)

**Dependencies**:
- **Imports FROM**: None (leaf types)
- **Imported BY**:
  - `./sessions` (Session.audioConfig, Session.videoConfig)
  - Recording services, device selection UI

**Risk**: **Low** - Isolated domain, stable types

---

#### 14. `types/utilities.ts` (~40 lines)

**Purpose**: Simple utility types, enums, legacy aliases

**Types** (5):
- `TabType` (navigation tabs)
- `NotificationType` (notification levels)
- `AttachmentType` (moved from attachments.ts for visibility)
- `TaskStatus` (legacy alias - DEPRECATED)
- `TaskPriority` (legacy alias - DEPRECATED)

**Dependencies**:
- **Imports FROM**: None
- **Imported BY**: UI components, navigation

**Risk**: **Very Low** - Simple enums

---

#### 15. `types/index.ts` (Barrel Export - ~50 lines)

**Purpose**: Backward-compatible re-exports

```typescript
// Unified relationship types (already exists)
export * from './relationships';

// Core domain types
export * from './sessions';
export * from './session-media';
export * from './session-enrichment';
export * from './tasks';
export * from './notes';
export * from './entities';
export * from './attachments';

// AI & Canvas
export * from './canvas';
export * from './ai';

// UI & System
export * from './ui';
export * from './ned';
export * from './learning';
export * from './media-devices';
export * from './utilities';

// Legacy exports (for migration period)
export type { AppState } from '../types'; // Keep in root until AppContext migration complete
```

**Note**: `AppState` remains in `src/types.ts` temporarily since it's the root state container and AppContext is being migrated to specialized contexts.

---

## Type-by-Type Mapping

### Complete Migration Table (94 types)

| Current Type | New Location | Dependencies | Line Count | Risk | Notes |
|--------------|-------------|--------------|------------|------|-------|
| **Canvas & AI Analysis (23 types)** |
| CanvasSpec | types/canvas.ts | CanvasTheme, CanvasLayout, ComponentTree (external) | 11 | Low | Used only by canvas system |
| CanvasTheme | types/canvas.ts | None | 6 | Low | Simple interface |
| CanvasLayout | types/canvas.ts | CanvasSection | 5 | Low | |
| CanvasSection | types/canvas.ts | Self (recursive) | 9 | Low | Recursive type, careful testing |
| SourceCitation | types/canvas.ts | None | 15 | Low | |
| AICanvasSessionCharacteristics | types/canvas.ts | None | 17 | Low | |
| TemporalAnalysis | types/canvas.ts | Moment | 18 | Low | |
| ContentRichness | types/canvas.ts | None | 19 | Low | |
| AchievementProfile | types/canvas.ts | Milestone, SessionInsight | 16 | Low | |
| EnergyAnalysis | types/canvas.ts | Moment | 15 | Low | |
| NarrativeStructure | types/canvas.ts | StoryType | 13 | Low | |
| EnrichedSessionCharacteristics | types/canvas.ts | AICanvasSessionCharacteristics, (5 analysis types) | 7 | Low | Extends base |
| Moment | types/canvas.ts | None | 6 | Low | |
| Milestone | types/canvas.ts | None | 6 | Low | |
| SessionInsight | types/canvas.ts | None | 5 | Low | |
| StoryType | types/canvas.ts | None | 10 | Low | Union type |
| **Attachments (3 types)** |
| AttachmentType | types/utilities.ts | None | 1 | Low | Move for visibility |
| AttachmentRef | types/attachments.ts | None | 10 | Low | CAS reference |
| Attachment | types/attachments.ts | AttachmentType | 35 | Medium | Used by Session, Task, Note |
| **Entities (4 types)** |
| Company | types/entities.ts | None | 14 | Low | Simple entity |
| Contact | types/entities.ts | None | 14 | Low | Simple entity |
| Topic | types/entities.ts | None | 7 | Low | Simple entity |
| ManualTopicData | types/entities.ts | None | 5 | Low | |
| **Notes (3 types)** |
| NoteUpdate | types/notes.ts | None | 9 | Low | |
| Note | types/notes.ts | Company, Contact, Topic, Attachment, Relationship, NoteUpdate | 48 | Medium | Has deprecated fields |
| ManualNoteData | types/notes.ts | None | 8 | Low | |
| **Tasks (3 types)** |
| SubTask | types/tasks.ts | None | 6 | Low | |
| Task | types/tasks.ts | SubTask, Topic, Company, Contact, Attachment, Relationship | 60 | High | Core type, has deprecated fields |
| ManualTaskData | types/tasks.ts | None | 10 | Low | |
| **AI Processing (4 types)** |
| AIProcessResult | types/ai.ts | Task, Note | 53 | Medium | Complex nested structure |
| AIQueryResponse | types/ai.ts | None | 8 | Low | |
| ProcessingJob | types/ai.ts | AIProcessResult | 13 | Low | |
| CaptureDraft | types/ai.ts | Attachment | 5 | Low | |
| **UI State (9 types)** |
| TabType | types/utilities.ts | None | 1 | Low | Simple enum |
| NotificationType | types/utilities.ts | None | 1 | Low | Simple enum |
| Notification | types/ui.ts | NotificationType | 11 | Low | |
| UserPreferences | types/ui.ts | TabType, Task (for filters) | 28 | Medium | References Task.status/priority |
| SearchHistoryItem | types/ui.ts | None | 7 | Low | |
| OnboardingState | types/ui.ts | None | 31 | Low | |
| UIState | types/ui.ts | TabType, ProcessingJob, Notification, UserPreferences, OnboardingState | 19 | Medium | Central UI state |
| AISettings | types/ui.ts | None | 5 | Low | |
| LearningSettings | types/ui.ts | None | 17 | Low | |
| **Ned Assistant (5 types)** |
| NedSettings | types/ned.ts | NedPermission | 10 | Low | |
| NedPermission | types/ned.ts | None | 5 | Low | |
| NedMessageContent | types/ned.ts | Task, Note | 8 | Low | Union type with Task/Note refs |
| NedMessage | types/ned.ts | NedMessageContent | 6 | Low | |
| NedConversation | types/ned.ts | NedMessage | 3 | Low | |
| **Learning System (5 types)** |
| LearningCategory | types/learning.ts | None | 8 | Low | Union type |
| LearningStatus | types/learning.ts | None | 1 | Low | Union type |
| LearningEvidence | types/learning.ts | None | 10 | Low | |
| Learning | types/learning.ts | LearningCategory, LearningStatus, LearningEvidence | 14 | Low | |
| UserLearnings | types/learning.ts | Learning | 10 | Low | |
| **Session Core (2 types + 3 guards)** |
| Session | types/sessions.ts | SessionScreenshot, SessionAudioSegment, SessionVideo, SessionSummary, CanvasSpec, AudioInsights, Relationship, AttachmentRef, SessionContextItem, AudioDeviceConfig, VideoRecordingConfig | ~230 | **Very High** | Most complex type, ~50 fields |
| SessionContextItem | types/sessions.ts | Note, Task (via linkedItemId - use `import type`) | 11 | Medium | Circular dependency potential |
| ActivityMetrics | types/sessions.ts | None | 8 | Low | |
| TaskStatus | types/utilities.ts | None | 1 | Low | Legacy alias |
| TaskPriority | types/utilities.ts | None | 1 | Low | Legacy alias |
| isFlexibleSummary() | types/sessions.ts | SessionSummary, FlexibleSessionSummary | 7 | Low | Type guard function |
| isLegacySummary() | types/sessions.ts | SessionSummary, FlexibleSessionSummary | 7 | Low | Type guard function |
| getSectionByType() | types/sessions.ts | FlexibleSessionSummary, SummarySection | 8 | Low | Utility function |
| **Session Media (9 types)** |
| VideoFrame | types/session-media.ts | None | 6 | Low | |
| VideoChapter | types/session-media.ts | None | 11 | Low | |
| SessionVideo | types/session-media.ts | SessionVideoChunk, VideoChapter, Attachment | 16 | Low | |
| SessionVideoChunk | types/session-media.ts | Attachment | 17 | Low | |
| SessionScreenshot | types/session-media.ts | Attachment | 30 | High | Has deprecated `path` field |
| AudioMode | types/session-media.ts | None | 1 | Low | DEPRECATED enum |
| SessionAudioSegment | types/session-media.ts | Attachment | 29 | Medium | Has deprecated fields |
| AudioKeyMoment | types/session-media.ts | None | 7 | Low | DEPRECATED - use AudioInsights |
| AudioInsights | types/session-enrichment.ts | None | 48 | Low | Moved to enrichment |
| **Session Enrichment (25 types - includes 15 section types)** |
| SessionSummary | types/session-enrichment.ts | SessionInsight, Task (for recommendedTasks), SourceCitation | 138 | High | Complex legacy summary |
| SessionSummaryContext | types/session-enrichment.ts | VideoChapter, AudioInsights, Task, Note | 41 | Medium | AI context data |
| FlexibleSessionSummary | types/session-enrichment.ts | SummarySection (union), SessionSummaryContext | 63 | Medium | Phase 2 summary |
| SummarySection | types/session-enrichment.ts | (union of 15 section types) | 14 | Medium | Complex union |
| BaseSummarySection | types/session-enrichment.ts | None | 7 | Low | Internal base interface |
| AchievementsSection | types/session-enrichment.ts | BaseSummarySection | 11 | Low | |
| BreakthroughMomentsSection | types/session-enrichment.ts | BaseSummarySection | 10 | Low | |
| BlockersSection | types/session-enrichment.ts | BaseSummarySection | 12 | Low | |
| LearningHighlightsSection | types/session-enrichment.ts | BaseSummarySection | 11 | Low | |
| CreativeSolutionsSection | types/session-enrichment.ts | BaseSummarySection | 11 | Low | |
| CollaborationSection | types/session-enrichment.ts | BaseSummarySection | 11 | Low | |
| TechnicalDiscoveriesSection | types/session-enrichment.ts | BaseSummarySection | 11 | Low | |
| TimelineSection | types/session-enrichment.ts | BaseSummarySection | 13 | Low | |
| FlowStateSection | types/session-enrichment.ts | BaseSummarySection | 11 | Low | |
| EmotionalJourneySection | types/session-enrichment.ts | BaseSummarySection | 10 | Low | |
| ProblemSolvingSection | types/session-enrichment.ts | BaseSummarySection | 13 | Low | |
| FocusAreasSection | types/session-enrichment.ts | BaseSummarySection | 10 | Low | |
| RecommendedTasksSection | types/session-enrichment.ts | BaseSummarySection | 13 | Low | |
| KeyInsightsSection | types/session-enrichment.ts | BaseSummarySection | 11 | Low | |
| RelatedContextSection | types/session-enrichment.ts | BaseSummarySection, Task, Note | 47 | Medium | References Task, Note |
| TaskBreakdownSection | types/session-enrichment.ts | BaseSummarySection | 16 | Low | |
| CustomSection | types/session-enrichment.ts | BaseSummarySection | 5 | Low | |
| **Media Devices (10 types)** |
| AudioSourceType | types/media-devices.ts | None | 1 | Low | Union type |
| AudioDevice | types/media-devices.ts | None | 13 | Low | |
| AudioDeviceConfig | types/media-devices.ts | AudioSourceType | 17 | Low | |
| VideoSourceType | types/media-devices.ts | None | 1 | Low | Union type |
| DisplayInfo | types/media-devices.ts | None | 12 | Low | |
| WindowInfo | types/media-devices.ts | None | 14 | Low | |
| WebcamInfo | types/media-devices.ts | None | 8 | Low | |
| PiPConfig | types/media-devices.ts | None | 9 | Low | |
| VideoRecordingConfig | types/media-devices.ts | VideoSourceType, PiPConfig | 35 | Low | |
| SessionRecordingConfig | types/media-devices.ts | AudioSourceType, VideoSourceType | 46 | Low | XState machine config |
| **App State (1 type - remains in root)** |
| AppState | src/types.ts (unchanged) | All other types | 55 | **N/A** | **NOT MOVED** - root state, AppContext migration in progress |

**Total**: 94 types analyzed

---

## Import Migration Strategy

### Chosen Approach: **Barrel Export (Backward Compatible)**

**Justification**:
1. **Zero Breaking Changes**: All existing imports continue to work unchanged
2. **Incremental Migration**: Teams can migrate files to direct imports at their own pace
3. **Low Risk**: No runtime behavior changes, only organizational improvements
4. **Testing Friendly**: Can migrate one file at a time and validate immediately
5. **Rollback Easy**: Simply revert the barrel export if issues arise

**Trade-offs**:
- **Pro**: Doesn't force organization (imports still come from single file)
- **Con**: Tree-shaking slightly less effective (but negligible with modern bundlers)
- **Pro**: No import rewrites needed across 300+ files
- **Con**: Developers might not adopt direct imports without encouragement

**Alternative Considered**: Direct Imports (Breaking)
- Would require updating ~300 import statements across codebase
- Higher risk of merge conflicts during migration
- **Rejected** due to high effort/risk ratio for unclear benefits

### Migration Example

#### Before (Current - All Still Work)
```typescript
// All these imports continue to work with barrel export
import { Session, Task, Note } from './types';
import { Session } from '../types';
import type { SessionScreenshot, SessionAudioSegment } from '../../types';
```

#### After (Optional - Direct Imports - Recommended for New Code)
```typescript
// Recommended for new code (clearer dependencies)
import { Session } from './types/sessions';
import { Task } from './types/tasks';
import { Note } from './types/notes';

// Or use barrel export (backward compatible)
import { Session, Task, Note } from './types';
```

#### Barrel Export Implementation (`types/index.ts`)
```typescript
// Re-export all types from focused files
export * from './relationships';      // Already exists
export * from './sessions';
export * from './session-media';
export * from './session-enrichment';
export * from './tasks';
export * from './notes';
export * from './entities';
export * from './attachments';
export * from './canvas';
export * from './ai';
export * from './ui';
export * from './ned';
export * from './learning';
export * from './media-devices';
export * from './utilities';

// Legacy export (remove after AppContext migration)
export type { AppState } from '../types';
```

### Import Path Update Count (If Direct Imports Chosen)

| Import Pattern | File Count | Example Files |
|----------------|-----------|---------------|
| `from '../types'` | ~120 | context/, services/, components/ |
| `from '../../types'` | ~90 | services/storage/, migrations/, hooks/ |
| `from '../../../types'` | ~60 | components/sessions/, tests/ |
| `from '@/types'` | ~30 | Recent files using path alias |
| **TOTAL** | **~300** | Across entire codebase |

**Recommendation**: Use barrel export initially, encourage direct imports in code reviews for new code.

---

## Circular Dependency Resolution

### Identified Circular Dependencies

#### 1. Session ↔ Note/Task (via SessionContextItem)

**Problem**:
```typescript
// types/sessions.ts
import { Note, Task } from './notes'; // Session → Note
import { Note, Task } from './tasks'; // Session → Task

// types/notes.ts
import { Session } from './sessions'; // Note → Session (via relationships)

// types/tasks.ts
import { Session } from './sessions'; // Task → Session (via relationships)
```

**Solution**: Use `import type` for cross-references
```typescript
// types/sessions.ts
import type { Note, Task } from './notes'; // Type-only import
import type { Note, Task } from './tasks'; // Type-only import

export interface SessionContextItem {
  linkedItemId?: string; // ID only, no direct reference
  noteId?: string; // DEPRECATED
  taskId?: string; // DEPRECATED
}
```

**Status**: ✅ Easy to resolve (already using IDs, not object references)

---

#### 2. Note ↔ Task (via deprecated noteId field)

**Problem**:
```typescript
// types/notes.ts
import { Task } from './tasks'; // For relationships

// types/tasks.ts
import { Note } from './notes'; // For aiContext.sourceNoteId (deprecated)
```

**Solution**: Use `import type` + rely on `relationships[]` instead
```typescript
// types/tasks.ts
import type { Note } from './notes'; // Type-only import

export interface Task {
  noteId?: string; // DEPRECATED (use relationships[])
  relationships?: Relationship[]; // Use this instead
}
```

**Status**: ✅ Easy to resolve (deprecated fields use IDs, new system uses relationships)

---

#### 3. UIState → Task → UIState (via UserPreferences filters)

**Problem**:
```typescript
// types/ui.ts
import { Task } from './tasks'; // For UserPreferences.filters.tasks.status

// types/tasks.ts
// No direct import, but if Task needed UI types...
```

**Solution**: Extract filter types to utilities, use type references
```typescript
// types/utilities.ts
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// types/ui.ts
import type { TaskStatus, TaskPriority } from './utilities';

export interface UserPreferences {
  filters: {
    tasks: {
      status?: TaskStatus | 'all'; // No direct Task import needed
      priority?: TaskPriority | 'all';
    };
  };
}

// types/tasks.ts
import { TaskStatus, TaskPriority } from './utilities';

export interface Task {
  status: TaskStatus;
  priority: TaskPriority;
}
```

**Status**: ✅ Already resolved in current types.ts (uses inline string literals)

---

### Resolution Guidelines

**Rule 1**: Always use `import type` for cross-domain entity references
```typescript
// ✅ CORRECT (type-only import)
import type { Session } from './sessions';

// ❌ WRONG (value import)
import { Session } from './sessions';
```

**Rule 2**: Store IDs, not object references
```typescript
// ✅ CORRECT
export interface Task {
  noteId?: string; // ID only
  relationships?: Relationship[]; // Better: use relationships
}

// ❌ WRONG
export interface Task {
  note?: Note; // Direct object reference creates circular dependency
}
```

**Rule 3**: Extract shared primitives to `utilities.ts`
```typescript
// Move enums and union types used by multiple domains to utilities.ts
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked';
export type NotificationType = 'success' | 'info' | 'warning' | 'error';
```

**Rule 4**: Test with `madge` or similar tools
```bash
npx madge --circular src/types/
```

---

## Migration Execution Plan

### Phase 1: Preparation (2 hours)

**Objective**: Set up infrastructure for safe migration

- [ ] **Create new directory structure**
  ```bash
  mkdir -p src/types
  ```

- [ ] **Audit all imports from types.ts**
  ```bash
  grep -r "from ['\"].*types['\"]" src/ --include="*.ts" --include="*.tsx" > imports-audit.txt
  ```
  - Count: ~300 import statements
  - Document patterns (relative paths, path aliases, etc.)

- [ ] **Set up ESLint rules** (optional, for direct imports)
  ```json
  {
    "rules": {
      "no-restricted-imports": ["error", {
        "patterns": [{
          "group": ["../types", "../../types"],
          "message": "Use direct imports from types/* instead"
        }]
      }]
    }
  }
  ```

- [ ] **Create migration tracking issue**
  - Checklist of all 15 files to create
  - Assign reviewers

---

### Phase 2: Type File Creation (6-8 hours)

**Objective**: Split types.ts into focused files

**Order of Creation** (dependency-driven, least → most dependent):

1. [ ] **Create `types/utilities.ts`** (30 min)
   - Move: TabType, NotificationType, TaskStatus, TaskPriority, AttachmentType
   - Dependencies: None
   - Test: Import in one file, run `npm run type-check`

2. [ ] **Create `types/entities.ts`** (30 min)
   - Move: Topic, Company, Contact, ManualTopicData
   - Dependencies: None
   - Test: Import in EntitiesContext

3. [ ] **Create `types/attachments.ts`** (30 min)
   - Move: Attachment, AttachmentRef
   - Dependencies: utilities (AttachmentType)
   - Test: Import in storage services

4. [ ] **Create `types/learning.ts`** (45 min)
   - Move: Learning, UserLearnings, LearningSettings, LearningEvidence, LearningCategory, LearningStatus
   - Dependencies: None
   - Test: Import in learning services

5. [ ] **Create `types/media-devices.ts`** (1 hour)
   - Move: All audio/video device config types (10 types)
   - Dependencies: None
   - Test: Import in recording services

6. [ ] **Create `types/canvas.ts`** (1.5 hours)
   - Move: All canvas and temporal analysis types (23 types)
   - Dependencies: External (ComponentTree import)
   - Test: Import in canvas components
   - **Risk**: Recursive CanvasSection - test carefully

7. [ ] **Create `types/notes.ts`** (45 min)
   - Move: Note, NoteUpdate, ManualNoteData
   - Dependencies: entities, attachments, relationships
   - Test: Import in NotesContext
   - **Note**: Circular dependency with Task - use `import type`

8. [ ] **Create `types/tasks.ts`** (45 min)
   - Move: Task, SubTask, ManualTaskData
   - Dependencies: entities, attachments, relationships, notes (type-only)
   - Test: Import in TasksContext
   - **Note**: Circular dependency with Note - use `import type`

9. [ ] **Create `types/ai.ts`** (45 min)
   - Move: AIProcessResult, AIQueryResponse, ProcessingJob, CaptureDraft
   - Dependencies: tasks, notes, attachments
   - Test: Import in AI services

10. [ ] **Create `types/ned.ts`** (30 min)
    - Move: NedSettings, NedPermission, NedMessage, NedMessageContent, NedConversation
    - Dependencies: tasks, notes
    - Test: Import in Ned services

11. [ ] **Create `types/ui.ts`** (1 hour)
    - Move: UIState, UserPreferences, OnboardingState, Notification, SearchHistoryItem, AISettings, LearningSettings
    - Dependencies: utilities, ai (ProcessingJob), tasks (for filters)
    - Test: Import in UIContext
    - **Note**: Remove NedConversation reference (should be in AppState only)

12. [ ] **Create `types/session-media.ts`** (1 hour)
    - Move: SessionScreenshot, SessionAudioSegment, SessionVideo, SessionVideoChunk, VideoFrame, VideoChapter, AudioKeyMoment, AudioMode
    - Dependencies: attachments
    - Test: Import in RecordingContext
    - **Note**: AudioInsights moved to session-enrichment.ts

13. [ ] **Create `types/session-enrichment.ts`** (2 hours)
    - Move: SessionSummary, SessionSummaryContext, FlexibleSessionSummary, SummarySection (+ 15 section types), AudioInsights
    - Dependencies: session-media (VideoChapter), tasks, notes, canvas (for session characteristics)
    - Test: Import in enrichment services
    - **Risk**: Complex types, many section variants - thorough testing needed

14. [ ] **Create `types/sessions.ts`** (2 hours)
    - Move: Session, SessionContextItem, SessionRecordingConfig, ActivityMetrics, TaskStatus/TaskPriority (legacy), type guards (isFlexibleSummary, etc.)
    - Dependencies: session-media, session-enrichment, entities, attachments, relationships, media-devices, notes/tasks (type-only)
    - Test: Import in SessionsContext, ActiveSessionContext
    - **Risk**: **VERY HIGH** - most complex type, highest usage
    - **Strategy**: Test incrementally, create separate PR

15. [ ] **Create `types/index.ts`** (30 min)
    - Barrel export all new type files
    - Re-export `AppState` from `../types` (legacy)
    - Test: Replace one import `from '../types'` → `from '../types/index'`
    - Verify no errors

---

### Phase 3: Update Imports (Optional - Direct Imports Only)

**Objective**: Update imports to use new focused files

**Note**: This phase is **OPTIONAL** if using barrel export strategy. Recommended to skip initially and migrate incrementally in future PRs.

**If Pursuing Direct Imports**:

- [ ] **Update context files** (~20 files, 1 hour)
  - Example: `import { Session } from '../types'` → `import { Session } from '../types/sessions'`
  - Files: TasksContext, NotesContext, SessionListContext, ActiveSessionContext, etc.

- [ ] **Update service files** (~40 files, 2 hours)
  - Example: AI services, storage services, enrichment services

- [ ] **Update component files** (~100 files, 4 hours)
  - Example: Session components, task components, etc.

- [ ] **Update hook files** (~20 files, 1 hour)

- [ ] **Update migration files** (~15 files, 1 hour)

- [ ] **Update test files** (~100 files, 2 hours)

**Total Effort (Direct Imports)**: ~11 additional hours

**Recommendation**: Skip Phase 3 initially, use barrel export, migrate incrementally in code reviews.

---

### Phase 4: Validation (2 hours)

**Objective**: Ensure no regressions

- [ ] **TypeScript compilation**
  ```bash
  npm run type-check
  ```
  - **Success Criteria**: Zero TypeScript errors

- [ ] **All tests pass**
  ```bash
  npm test
  ```
  - **Success Criteria**: All 210+ tests pass (no new failures)

- [ ] **Circular dependency check**
  ```bash
  npx madge --circular src/types/
  ```
  - **Success Criteria**: No circular dependencies detected

- [ ] **Import organization check** (optional, if direct imports)
  ```bash
  npm run lint
  ```
  - **Success Criteria**: ESLint passes with import rules

- [ ] **Build check**
  ```bash
  npm run build
  ```
  - **Success Criteria**: Production build succeeds

- [ ] **Manual smoke test**
  - [ ] Start app in dev mode
  - [ ] Create session → verify types work
  - [ ] Create task → verify types work
  - [ ] Create note → verify types work
  - [ ] Open Ned → verify types work
  - [ ] Check Settings → verify types work

---

### Phase 5: Cleanup (1 hour)

**Objective**: Remove old types.ts (if migrating away from AppState)

**Note**: `AppState` should remain in `src/types.ts` until AppContext migration is complete.

- [ ] **Keep AppState in `src/types.ts`**
  ```typescript
  // src/types.ts (after migration)
  import type { Company, Contact, Topic, Note, Task, Session, etc. } from './types';

  export interface AppState {
    companies: Company[];
    contacts: Contact[];
    topics: Topic[];
    notes: Note[];
    tasks: Task[];
    sessions: Session[];
    // ... rest of AppState
  }
  ```

- [ ] **Update CLAUDE.md** to document new type structure

- [ ] **Update documentation** in `/docs/developer/FILE_REFERENCE.md`

- [ ] **Create migration guide** for developers (see "Developer Migration Guide" section below)

---

## Risk Assessment

### High Risk Types (Migrate Carefully)

**Risk Factors**: High usage (50+ files), complex dependencies, critical to app functionality

| Type | Usage Files | Risk Factors | Mitigation Strategy |
|------|-------------|--------------|---------------------|
| **Session** | 150+ | - Most complex type (~230 lines, 50 fields)<br/>- Used in 150+ files<br/>- Has nested types (EnrichmentStatus, etc.)<br/>- Circular dependency potential | - Create separate PR for Session types<br/>- Test incrementally (media → enrichment → core)<br/>- Use `import type` for circular refs<br/>- Extensive manual testing |
| **Task** | 120+ | - Core app functionality<br/>- 8 deprecated fields<br/>- Circular dependency with Note | - Migrate with Note simultaneously<br/>- Update tests to verify deprecated fields<br/>- Use `import type` for Note references |
| **Note** | 100+ | - Core app functionality<br/>- 3 deprecated fields<br/>- Circular dependency with Task | - Migrate with Task simultaneously<br/>- Verify relationships array migration<br/>- Use `import type` for Task references |
| **UIState** | 80+ | - Central UI state<br/>- Referenced by all UI components<br/>- Nested complexity (9 types) | - Thorough testing of UI state persistence<br/>- Verify all context providers still work<br/>- Test onboarding flow |

**Total High Risk Types**: 4

---

### Medium Risk Types (Standard Testing)

**Risk Factors**: Moderate usage (20-50 files), some dependencies, non-critical

| Type | Usage Files | Risk Factors | Mitigation Strategy |
|------|-------------|--------------|---------------------|
| SessionScreenshot | 60+ | - Has deprecated `path` field<br/>- Nested in Session array | - Test CAS migration compatibility<br/>- Verify attachmentId references work |
| SessionAudioSegment | 50+ | - Has deprecated fields<br/>- Used in audio services | - Test audio recording services<br/>- Verify transcript upgrades |
| UserPreferences | 50+ | - Referenced by settings<br/>- Complex filter structure | - Test all preference persistence<br/>- Verify filter UIs |
| AIProcessResult | 40+ | - Complex nested structure<br/>- Used in AI services | - Test AI processing pipeline<br/>- Verify task/note extraction |
| FlexibleSessionSummary | 30+ | - 15 section type variants<br/>- Union type complexity | - Test all section renderers<br/>- Verify backward compatibility with SessionSummary |
| Attachment | 80+ | - Used by Session, Task, Note<br/>- Critical for CAS system | - Test attachment storage/retrieval<br/>- Verify deduplication works |

**Total Medium Risk Types**: 6

---

### Low Risk Types (Safe to Move)

**Risk Factors**: Low usage (<20 files), simple types, isolated domains

| Category | Types | Risk Factors | Mitigation |
|----------|-------|--------------|------------|
| **Entities** | Topic, Company, Contact, ManualTopicData | Simple types, no dependencies | Standard type-check + 1 test |
| **Canvas** | 23 canvas types | Isolated to canvas system, low usage | Test canvas rendering only |
| **Learning** | 5 learning types | Isolated system, low usage | Test learning service |
| **Ned** | 5 Ned types | Isolated to Ned assistant | Test Ned chat |
| **Media Devices** | 10 device config types | Isolated to recording config | Test device selection UI |
| **Utilities** | 5 simple enums | Simple types, widely used but stable | Type-check only |

**Total Low Risk Types**: 48

---

### Risk Summary by Migration Impact

| Risk Level | Type Count | Migration Effort | Testing Effort | Total Effort |
|------------|-----------|------------------|----------------|--------------|
| **High** | 4 | 6 hours | 3 hours | **9 hours** |
| **Medium** | 6 | 4 hours | 2 hours | **6 hours** |
| **Low** | 48 | 4 hours | 1 hour | **5 hours** |
| **Infrastructure** | N/A | 2 hours (prep + cleanup) | 2 hours (validation) | **4 hours** |
| **TOTAL** | **58** | **16 hours** | **8 hours** | **24 hours** |

**Recommendation**: Allocate 3 days (24 hours) for complete migration with thorough testing.

---

## Automation Possibilities

### 1. Import Update Script (If Direct Imports)

**Purpose**: Automate import path updates from `./types` to `./types/sessions`, etc.

**Tool**: `jscodeshift` (JavaScript codemod toolkit)

```bash
npm install -g jscodeshift
```

**Codemod Script** (`scripts/migrate-type-imports.js`):
```javascript
// Codemod to update type imports
module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // Map of type names to new paths
  const typeMap = {
    Session: './types/sessions',
    SessionScreenshot: './types/session-media',
    Task: './types/tasks',
    Note: './types/notes',
    // ... add all 94 types
  };

  // Find all import declarations from types.ts
  root.find(j.ImportDeclaration)
    .filter(path => {
      const source = path.node.source.value;
      return source.match(/types$/); // Matches ./types, ../types, etc.
    })
    .forEach(path => {
      const importSpecifiers = path.node.specifiers;
      const newImports = {};

      // Group imports by new path
      importSpecifiers.forEach(spec => {
        if (spec.type === 'ImportSpecifier') {
          const typeName = spec.imported.name;
          const newPath = typeMap[typeName];
          if (newPath) {
            if (!newImports[newPath]) newImports[newPath] = [];
            newImports[newPath].push(spec);
          }
        }
      });

      // Replace old import with new grouped imports
      const oldPath = path.node.source.value;
      const newImportDeclarations = Object.entries(newImports).map(([newPath, specs]) => {
        // Convert relative path (./types/sessions → ../types/sessions if needed)
        const adjustedPath = newPath.replace('./types', oldPath.replace(/\/types$/, '/types'));
        return j.importDeclaration(specs, j.literal(adjustedPath));
      });

      j(path).replaceWith(newImportDeclarations);
    });

  return root.toSource();
};
```

**Usage**:
```bash
# Dry run (preview changes)
jscodeshift -t scripts/migrate-type-imports.js src/ --dry

# Apply changes
jscodeshift -t scripts/migrate-type-imports.js src/
```

**Estimated Time Savings**: 8-10 hours (if migrating all 300 imports manually)

**Recommendation**: **Skip** - Use barrel export instead, no import updates needed.

---

### 2. Barrel Export Generator

**Purpose**: Auto-generate `types/index.ts` from new type files

**Tool**: Custom Node.js script

**Script** (`scripts/generate-barrel-export.js`):
```javascript
const fs = require('fs');
const path = require('path');

const typesDir = path.join(__dirname, '../src/types');
const indexPath = path.join(typesDir, 'index.ts');

// Read all .ts files in types/ directory
const typeFiles = fs.readdirSync(typesDir)
  .filter(file => file.endsWith('.ts') && file !== 'index.ts')
  .map(file => file.replace('.ts', ''));

// Generate barrel export
const barrelExport = `/**
 * Barrel export for all type modules
 *
 * Auto-generated by scripts/generate-barrel-export.js
 * Do not edit manually
 */

${typeFiles.map(file => `export * from './${file}';`).join('\n')}

// Legacy exports (keep until AppContext migration complete)
export type { AppState } from '../types';
`;

fs.writeFileSync(indexPath, barrelExport);
console.log(`✅ Generated types/index.ts with ${typeFiles.length} exports`);
```

**Usage**:
```bash
node scripts/generate-barrel-export.js
```

**Estimated Time Savings**: 30 minutes (manual barrel export creation)

**Recommendation**: **Use** - Simple script, ensures consistency

---

### 3. Circular Dependency Checker

**Purpose**: Detect circular dependencies before they cause issues

**Tool**: `madge` (module dependency analyzer)

```bash
npm install -g madge
```

**Usage**:
```bash
# Check for circular dependencies
madge --circular src/types/

# Generate dependency graph (visual)
madge --image graph.png src/types/
```

**Integration**: Add to CI/CD pipeline
```json
{
  "scripts": {
    "check-circular": "madge --circular src/types/ --no-spinner --no-color"
  }
}
```

**Estimated Time Savings**: 2-3 hours (debugging circular dependency issues)

**Recommendation**: **Use** - Essential for preventing circular import issues

---

### Automation Summary

| Tool | Purpose | Time to Setup | Time Saved | ROI | Recommendation |
|------|---------|---------------|------------|-----|----------------|
| Import Update Script | Automate import path updates | 2 hours | 8-10 hours | **4-5x** | **Skip** (using barrel export) |
| Barrel Export Generator | Auto-generate index.ts | 30 min | 30 min | **1x** | **Use** (simple, consistent) |
| Circular Dependency Checker | Prevent circular imports | 15 min | 2-3 hours | **8-12x** | **Use** (essential) |

**Recommended Automation**: Barrel Export Generator + Circular Dependency Checker

---

## Rollback Strategy

### Rollback Scenarios

| Scenario | Trigger | Rollback Strategy | Recovery Time |
|----------|---------|-------------------|---------------|
| **TypeScript errors** | `npm run type-check` fails | Git revert commit | 5 min |
| **Test failures** | `npm test` has new failures | Git revert commit | 5 min |
| **Circular dependencies** | `madge --circular` detects cycles | Fix with `import type` or revert | 30 min - 2 hours |
| **Production build failure** | `npm run build` fails | Git revert commit | 5 min |
| **Runtime errors** | App crashes or behaves incorrectly | Git revert commit | 5 min |

### Incremental Migration Strategy

**If Issues Found**: Migrate types **one file at a time** instead of all at once

**Incremental Approach**:

1. **Week 1**: Migrate low-risk types (entities, learning, utilities)
   - Create: `types/entities.ts`, `types/learning.ts`, `types/utilities.ts`
   - Add to `types/index.ts`
   - Test thoroughly
   - **If successful**: Proceed

2. **Week 2**: Migrate medium-risk types (attachments, canvas, media devices)
   - Create: `types/attachments.ts`, `types/canvas.ts`, `types/media-devices.ts`
   - Add to `types/index.ts`
   - Test thoroughly
   - **If successful**: Proceed

3. **Week 3**: Migrate UI & AI types (ui, ai, ned)
   - Create: `types/ui.ts`, `types/ai.ts`, `types/ned.ts`
   - Add to `types/index.ts`
   - Test thoroughly
   - **If successful**: Proceed

4. **Week 4**: Migrate high-risk types (notes, tasks, session-media)
   - Create: `types/notes.ts`, `types/tasks.ts`, `types/session-media.ts`
   - Add to `types/index.ts`
   - Test thoroughly
   - **If successful**: Proceed

5. **Week 5**: Migrate session core & enrichment (final step)
   - Create: `types/session-enrichment.ts`, `types/sessions.ts`
   - Add to `types/index.ts`
   - **Extensive testing** (this is the riskiest step)
   - **If successful**: Migration complete

**Total Time**: 5 weeks (1 file cluster per week)

**Benefit**: If any step fails, rollback only affects that week's changes, not entire migration

---

### Feature Flag Approach (Advanced)

**If Extremely Risk-Averse**: Use feature flags to toggle between old and new type imports

**Implementation**:
```typescript
// types/index.ts
const USE_NEW_TYPES = process.env.USE_NEW_TYPES === 'true';

if (USE_NEW_TYPES) {
  export * from './sessions';
  export * from './tasks';
  // ... new type files
} else {
  // Fallback to old types.ts
  export * from '../types';
}
```

**Usage**:
```bash
# Enable new types
USE_NEW_TYPES=true npm run dev

# Disable new types (rollback)
USE_NEW_TYPES=false npm run dev
```

**Recommendation**: **Overkill** - Barrel export strategy already provides safe rollback via Git revert. Feature flags add unnecessary complexity.

---

## Success Criteria

### TypeScript Compilation
- [ ] `npm run type-check` passes with **zero errors**
- [ ] No new TypeScript warnings introduced
- [ ] Build time remains similar (±10%)

### Testing
- [ ] All 210+ tests pass (no new failures)
- [ ] Test coverage remains ≥30% (current threshold)
- [ ] No new test warnings or deprecations

### Circular Dependencies
- [ ] `madge --circular src/types/` reports **zero** circular dependencies
- [ ] All circular dependencies resolved with `import type`

### Import Organization
- [ ] All types exported from `types/index.ts` (barrel export)
- [ ] No broken imports in codebase
- [ ] ESLint passes (if import rules configured)

### Documentation
- [ ] `CLAUDE.md` updated with new type structure
- [ ] `FILE_REFERENCE.md` updated with type file locations
- [ ] Migration guide created for developers (see below)

### Functional Testing
- [ ] **Session Lifecycle**: Start/pause/resume/end session works
- [ ] **Task Management**: Create/edit/delete tasks works
- [ ] **Note Management**: Create/edit/delete notes works
- [ ] **Ned Assistant**: Chat with Ned works
- [ ] **Settings**: All settings panels load correctly
- [ ] **Enrichment**: Post-session enrichment completes successfully

### Performance
- [ ] App load time unchanged (±5%)
- [ ] Type-checking time unchanged (±5%)
- [ ] Bundle size unchanged (±5%)

---

## Developer Migration Guide

### Quick Start (For Developers Using Barrel Export)

**Good News**: If using barrel export strategy, **no code changes needed**!

All existing imports continue to work:
```typescript
// ✅ Still works (barrel export)
import { Session, Task, Note } from './types';
import { Session } from '../types';
```

**For New Code** (Recommended):
```typescript
// ✅ Better (explicit dependencies)
import { Session } from './types/sessions';
import { Task } from './types/tasks';
import { Note } from './types/notes';
```

---

### Type Location Mapping

**Quick Reference**: Where did my type move?

| Old Import | New Location | File |
|------------|-------------|------|
| `import { Session } from './types'` | `./types/sessions` | sessions.ts |
| `import { SessionScreenshot } from './types'` | `./types/session-media` | session-media.ts |
| `import { SessionSummary } from './types'` | `./types/session-enrichment` | session-enrichment.ts |
| `import { Task } from './types'` | `./types/tasks` | tasks.ts |
| `import { Note } from './types'` | `./types/notes` | notes.ts |
| `import { Topic, Company, Contact } from './types'` | `./types/entities` | entities.ts |
| `import { Attachment } from './types'` | `./types/attachments` | attachments.ts |
| `import { CanvasSpec } from './types'` | `./types/canvas` | canvas.ts |
| `import { UIState } from './types'` | `./types/ui` | ui.ts |
| `import { NedSettings } from './types'` | `./types/ned` | ned.ts |
| `import { TabType } from './types'` | `./types/utilities` | utilities.ts |

**Full Mapping**: See "Type-by-Type Mapping" section above

---

### Common Patterns

#### Pattern 1: Multiple Types from Same Domain
```typescript
// Before
import { Session, SessionScreenshot, SessionAudioSegment } from './types';

// After (if using direct imports)
import { Session } from './types/sessions';
import { SessionScreenshot, SessionAudioSegment } from './types/session-media';

// Or (barrel export - still works)
import { Session, SessionScreenshot, SessionAudioSegment } from './types';
```

#### Pattern 2: Cross-Domain Types
```typescript
// Before
import { Session, Task, Note } from './types';

// After (if using direct imports)
import { Session } from './types/sessions';
import { Task } from './types/tasks';
import { Note } from './types/notes';

// Or (barrel export - still works)
import { Session, Task, Note } from './types';
```

#### Pattern 3: Type-Only Imports (Avoiding Circular Dependencies)
```typescript
// ✅ CORRECT (prevents circular dependencies)
import type { Note } from './types/notes';

// ❌ WRONG (can cause circular dependencies)
import { Note } from './types/notes';
```

---

### Troubleshooting

#### Error: "Cannot find module './types'"
**Cause**: Import path incorrect after migration

**Fix**:
```typescript
// ❌ WRONG
import { Session } from './types';

// ✅ CORRECT (barrel export)
import { Session } from './types/index';

// ✅ CORRECT (direct import)
import { Session } from './types/sessions';
```

#### Error: "Circular dependency detected"
**Cause**: Value import instead of type-only import

**Fix**:
```typescript
// ❌ WRONG
import { Note } from './types/notes';

// ✅ CORRECT
import type { Note } from './types/notes';
```

#### Error: "Type 'X' is not exported"
**Cause**: Type moved to different file, barrel export not updated

**Fix**: Check `types/index.ts` includes `export * from './[file]'`

---

### Best Practices

1. **Use Barrel Export**: Import from `./types` (not `./types/sessions`) for simplicity
2. **Use Type-Only Imports**: Always use `import type` for cross-domain entity references
3. **Check Type Location**: If unsure where a type is, check `types/index.ts` or use IDE "Go to Definition"
4. **Avoid Circular Dependencies**: Store IDs, not object references (e.g., `noteId: string`, not `note: Note`)
5. **Update Tests**: If moving types, update corresponding tests to import from new location

---

### Migration Checklist for Developers

When updating code to use new type structure:

- [ ] Check if type has moved (see "Type Location Mapping" above)
- [ ] Update import to use direct path (optional) or keep barrel export
- [ ] Use `import type` for cross-domain references
- [ ] Run `npm run type-check` to verify no errors
- [ ] Run `npm test` to verify tests pass
- [ ] Check for circular dependencies: `npx madge --circular src/types/`

---

## Appendix: Full Type Export List

### All 94 Exported Types (Alphabetical)

1. AchievementProfile
2. AchievementsSection
3. ActivityMetrics
4. AICanvasSessionCharacteristics
5. AIProcessResult
6. AIQueryResponse
7. AISettings
8. AppState (remains in root)
9. Attachment
10. AttachmentRef
11. AttachmentType
12. AudioDevice
13. AudioDeviceConfig
14. AudioInsights
15. AudioKeyMoment (DEPRECATED)
16. AudioMode (DEPRECATED)
17. AudioSourceType
18. BaseSummarySection
19. BlockersSection
20. CanvasLayout
21. CanvasSection
22. CanvasSpec
23. CanvasTheme
24. CaptureDraft
25. CollaborationSection
26. Company
27. Contact
28. ContentRichness
29. CreativeSolutionsSection
30. CustomSection
31. DisplayInfo
32. EmotionalJourneySection
33. EnergyAnalysis
34. EnrichedSessionCharacteristics
35. FlexibleSessionSummary
36. FlowStateSection
37. FocusAreasSection
38. KeyInsightsSection
39. Learning
40. LearningCategory
41. LearningEvidence
42. LearningHighlightsSection
43. LearningSettings
44. LearningStatus
45. ManualNoteData
46. ManualTaskData
47. ManualTopicData
48. Milestone
49. Moment
50. NarrativeStructure
51. NedConversation
52. NedMessage
53. NedMessageContent
54. NedPermission
55. NedSettings
56. Note
57. NoteUpdate
58. Notification
59. NotificationType
60. OnboardingState
61. PiPConfig
62. ProblemSolvingSection
63. ProcessingJob
64. RecommendedTasksSection
65. RelatedContextSection
66. SearchHistoryItem
67. Session
68. SessionAudioSegment
69. SessionContextItem
70. SessionInsight
71. SessionRecordingConfig
72. SessionScreenshot
73. SessionSummary
74. SessionSummaryContext
75. SessionVideo
76. SessionVideoChunk
77. SourceCitation
78. StoryType
79. SubTask
80. SummarySection
81. TabType
82. Task
83. TaskBreakdownSection
84. TaskPriority (legacy)
85. TaskStatus (legacy)
86. TechnicalDiscoveriesSection
87. TemporalAnalysis
88. TimelineSection
89. Topic
90. UIState
91. UserLearnings
92. UserPreferences
93. VideoChapter
94. VideoFrame
95. VideoRecordingConfig
96. VideoSourceType
97. WebcamInfo
98. WindowInfo

**Plus 3 Utility Functions**:
- `isFlexibleSummary()`
- `isLegacySummary()`
- `getSectionByType()`

**Total**: 98 exports (94 types + 3 functions + 1 AppState in root)

---

## Conclusion

This plan provides a **comprehensive, actionable roadmap** for splitting the monolithic `types.ts` file into 12 focused, maintainable modules. By using a **barrel export strategy**, the migration is **backward compatible** and **low risk**, requiring **no import updates** across the 300+ files that currently use `types.ts`.

**Key Takeaways**:
- **94 types** organized into **12 logical files** + 1 barrel export
- **Zero breaking changes** with barrel export approach
- **Medium-High risk** overall, mitigated by incremental migration strategy
- **Estimated effort**: 12-16 hours (2 days) for complete migration
- **Success criteria**: TypeScript compiles, tests pass, no circular dependencies

**Recommended Next Steps**:
1. Review this plan with team
2. Create GitHub issue with migration checklist
3. Start with Phase 1 (Preparation) - audit imports, set up infrastructure
4. Migrate low-risk types first (entities, utilities, learning)
5. Gradually work up to high-risk types (Session, Task, Note)
6. Use barrel export for backward compatibility
7. Encourage direct imports in code reviews for new code

**Questions or Concerns**: See "Troubleshooting" section or consult the full type mapping table.

---

**Generated by**: Claude Code (automated analysis)
**Date**: October 26, 2025
**Version**: 1.0
**Status**: Ready for Review
