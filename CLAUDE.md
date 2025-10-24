# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Taskerino is an AI-powered note-taking and task management desktop application built with Tauri + React. The app uses Claude AI (Sonnet 4.5) for intelligent processing of notes, automatic topic detection, task extraction, and an AI assistant named "Ned". It features a unique **Sessions** system that records screenshots and audio of work sessions, then uses AI to generate comprehensive summaries and insights.

**Key Philosophy**: Zero friction, maximum intelligence. Users capture thoughts quickly without manual organization - AI handles categorization, topic detection, and task extraction automatically.

## Development Commands

### Essential Commands
```bash
# Start development server (Vite + Tauri dev mode)
npm run dev
npm run tauri:dev

# Build for production (requires signing certificates configured)
npm run build
npm run tauri:build

# Type checking
npm run type-check

# Linting
npm run lint

# Run all tests
npm test

# Run tests in UI mode (recommended for development)
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Testing Individual Files
```bash
# Run specific test file
npx vitest run path/to/file.test.ts

# Run tests in watch mode for specific file
npx vitest watch path/to/file.test.ts

# Run all tests matching a pattern
npx vitest run --grep "SessionsContext"
```

## Architecture Overview

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Desktop**: Tauri v2 (Rust backend, web frontend)
- **Styling**: Tailwind CSS v3 with custom glass morphism effects
- **AI**: Claude API (claude-3-5-sonnet-20241022), OpenAI Whisper + GPT-4o
- **Storage**: IndexedDB (browser) + Tauri File System (desktop) with dual-adapter pattern
- **Testing**: Vitest + React Testing Library

### Zone-Based Navigation

The app uses a **six-zone navigation model** with two distinct navigation systems:

#### 1. Top Navigation Island (`TopNavigation/`)
Fixed navigation bar at the top of the screen:
- **Collapsed State**: Shows navigation tabs for all 6 zones
- **Expanded States**: Expands into mode-specific interfaces (Search, Task, Note, Processing, Session)
- Uses spring-based expansion/collapse animations
- Adapts to compact mode on narrow viewports
- Keyboard shortcuts (CMD+K for search)

**Key Files**:
- `TopNavigation/index.tsx` - Main orchestrator
- `TopNavigation/components/NavigationIsland.tsx` - Dynamic island container
- `TopNavigation/components/NavTabs.tsx` - Tab navigation

#### 2. Space Sub Menus (In-Zone Morphing Menus)
Scroll-driven morphing menus within each zone:
- **MenuMorphPill** (`MenuMorphPill.tsx`) - Morphing wrapper with scroll-driven transforms
- **SpaceMenuBar** (`SpaceMenuBar.tsx`) - Menu content with controls (primary actions, view toggles, filters)
- Starts in document flow, becomes fixed and morphs to compact "Menu" button next to logo when scrolled
- Uses MotionValues for 60fps GPU-accelerated animations
- Individual menu items exit with staggered animations

**Usage Pattern**:
```tsx
<MenuMorphPill resetKey={selectedItemId}>
  <SpaceMenuBar
    primaryAction={...}
    viewControls={...}
    filters={...}
  />
</MenuMorphPill>
```

#### 6 Zones

1. **Capture Zone** (`CaptureZone.tsx`) - Universal input for quick note capture with AI processing
2. **Tasks Zone** (`TasksZone.tsx`) - Interactive task management with views (list/kanban/table)
3. **Library Zone** (`LibraryZone.tsx`) - Browse organized notes by topic with rich entity cards
4. **Sessions Zone** (`SessionsZone.tsx`) - Work session tracking with screenshots, audio, and AI summaries
5. **Assistant Zone** (`AssistantZone.tsx`) - Chat with Ned, the AI assistant
6. **Profile Zone** (`ProfileZone.tsx`) - Settings, API configuration, and user preferences

### Context Architecture (Updated - Phase 1 Complete)

The app uses **specialized contexts** with a clear separation of concerns:

#### Core Context Providers (Preferred)
- `SettingsContext` - User settings and AI configuration
- `UIContext` - UI state, preferences, onboarding
- `EntitiesContext` - Companies, contacts, topics (entities)
- `NotesContext` - Note CRUD and filtering
- `TasksContext` - Task CRUD, subtasks, filtering
- `EnrichmentContext` - Post-session AI enrichment pipeline
- `ThemeContext` - Dark/light theme management

#### Session Management Contexts (Phase 1 - New)
- `SessionListContext` - Session CRUD, filtering, sorting (read-only operations)
- `ActiveSessionContext` - Active session lifecycle and state management
- `RecordingContext` - Recording service management (screenshots, audio, video)

#### Deprecated Context (Being Removed)
- `SessionsContext` - **DEPRECATED** - See migration guide in `/docs/sessions-rewrite/`
  - Use `useSessionList()`, `useActiveSession()`, or `useRecording()` instead
  - Will be removed in Phase 7
- `AppContext` - **DEPRECATED** - Migrating to specialized contexts

**When adding new features**: Use the specialized contexts. Do NOT extend deprecated contexts.

### State Management (Phase 1 - New)

#### XState State Machines
The app uses **XState v5** for complex state management with type-safe state machines:

- `sessionMachine` - Session lifecycle state machine
  - Location: `src/machines/sessionMachine.ts`
  - Hook: `useSessionMachine()` from `src/hooks/useSessionMachine.ts`
  - States: `idle` → `validating` → `checking_permissions` → `starting` → `active` → `pausing`/`paused` → `resuming` → `ending` → `completed`
  - Guards: Permission checks, validation, device availability
  - Actions: Service start/stop, persistence, event emission

**Usage**:
```typescript
import { useSessionMachine } from '@/hooks/useSessionMachine';

function MyComponent() {
  const {
    state,           // Current state ('idle', 'active', etc.)
    context,         // Machine context (sessionId, config, etc.)
    isActive,        // Boolean helpers
    isIdle,
    startSession,    // Type-safe action functions
    pauseSession,
    endSession
  } = useSessionMachine();

  return (
    <div>
      {isActive && <p>Session {context.sessionId} is active</p>}
      <button onClick={() => startSession({ name: 'My Session' })}>
        Start Session
      </button>
    </div>
  );
}
```

**Benefits**:
- Type-safe transitions and actions
- Impossible states prevented at compile time
- Visual state diagram (`sessionMachine.ts` exports for XState inspector)
- Comprehensive testing (21 tests covering all transitions)

### Data Model Hierarchy

```
Session (work session with recordings)
├── screenshots[] → SessionScreenshot
│   └── attachmentId → Attachment (in storage)
├── audioSegments[] → SessionAudioSegment
│   └── attachmentId → Attachment (audio WAV)
├── video? → SessionVideo
│   └── fullVideoAttachmentId → Attachment
├── summary? → SessionSummary (AI-generated)
├── canvasSpec? → CanvasSpec (for rendering)
└── enrichmentStatus? → EnrichmentStatus (pipeline tracking)

Note
├── companyIds[] → Company
├── contactIds[] → Contact
├── topicIds[] → Topic
├── attachments[] → Attachment
├── updates[] → NoteUpdate (history)
└── sourceSessionId? → Session

Task
├── topicId? → Topic
├── noteId? → Note
├── subtasks[] → SubTask
├── attachments[] → Attachment
└── sourceSessionId? → Session
```

### Storage Architecture (Dual-Adapter Pattern)

The app uses a **dual-adapter storage system** for cross-platform compatibility:

- **Browser**: `IndexedDBAdapter` - Uses IndexedDB for storage
- **Desktop (Tauri)**: `TauriFileSystemAdapter` - Uses native file system with better performance

**Key Service**: `src/services/storage/index.ts` exports `getStorage()` which auto-detects environment.

All storage operations should go through:
- `getStorage()` - For JSON data (sessions, notes, tasks, etc.)
- `attachmentStorage` - For binary attachments (images, audio, video)

#### Transaction Support (Phase 1 - New)

Both storage adapters now support **atomic multi-key transactions**:

```typescript
import { getStorage } from '@/services/storage';

const storage = getStorage();
const tx = await storage.beginTransaction();

try {
  tx.save('sessions', updatedSessions);
  tx.save('activeSessionId', sessionId);
  tx.save('settings', newSettings);
  await tx.commit();  // All writes succeed or all fail
} catch (error) {
  await tx.rollback();  // Restore previous state
}
```

**Implementation**:
- **IndexedDB**: Uses native `IDBTransaction` for atomicity
- **Tauri FS**: Staging directory pattern with atomic rename
- **Rollback**: Full state restoration on failure
- **Tests**: 25 comprehensive tests covering all scenarios

#### Persistence Queue (Phase 1 - New)

The **PersistenceQueue** provides background persistence with zero UI blocking:

```typescript
import { getPersistenceQueue } from '@/services/storage/PersistenceQueue';

const queue = getPersistenceQueue();

// Critical update (immediate - 0ms delay)
queue.enqueue('activeSession', session, 'critical');

// Normal update (batched - 100ms delay)
queue.enqueue('sessions', allSessions, 'normal');

// Low priority (idle time)
queue.enqueue('ui-preferences', prefs, 'low');
```

**Features**:
- **3 Priority Levels**: critical (immediate), normal (batched 100ms), low (idle time)
- **Zero UI Blocking**: Was 200-500ms, now 0ms
- **Automatic Retry**: Exponential backoff with priority-based limits
- **Event System**: Track enqueue, processing, completion, failure
- **Queue Size Limit**: 1000 items max (drops oldest low-priority items)
- **Statistics API**: Monitor pending, processing, completed, failed counts

**Design Doc**: See `/docs/sessions-rewrite/STORAGE_QUEUE_DESIGN.md` for full details.

### AI Processing Pipeline

#### 1. Capture Processing (`claudeService.ts`)
```
User Input (text + attachments)
  ↓
Topic Detection (fuzzy matching with confidence scoring)
  ↓
Note Creation/Merging (similarity algorithm, 30% threshold)
  ↓
Task Extraction (natural language parsing with priority inference)
  ↓
AIProcessResult
```

#### 2. Sessions Agent (`sessionsAgentService.ts`)
```
Screenshot captured
  ↓
AI Analysis (activity detection, OCR, context delta)
  ↓
Progress Tracking (achievements, blockers, insights)
  ↓
Adaptive Scheduling (curiosity score for next interval)
```

#### 3. Enrichment Pipeline (`sessionEnrichmentService.ts`)
```
Session Ends
  ↓
Validation & Cost Estimation
  ↓
Audio Review (GPT-4o audio analysis) [OPTIONAL]
  ↓
Video Chaptering (frame analysis) [OPTIONAL]
  ↓
Summary Generation (synthesize all data)
  ↓
EnrichmentStatus (tracking + cost monitoring)
```

### Ned AI Assistant

Ned is a conversational AI with **tool execution capabilities**:

- **Core Service**: `nedService.ts` - Handles streaming responses with tool use
- **Tool Execution**: `nedToolExecutor.ts` - Executes tools with permission checks
- **Memory System**: `nedMemory.ts` - Maintains conversation context
- **Available Tools**: Search, task/note CRUD, session queries, enrichment triggers

**Permission System**: Users grant permissions at three levels:
- `forever` - Always allowed
- `session` - Allowed until app restart
- `always-ask` - Prompt every time

### Morphing Canvas System

The **Morphing Canvas** is a dynamic layout engine for session reviews:

**Location**: `src/components/morphing-canvas/`

**Key Concepts**:
- **Modules** - Self-contained UI components (Timeline, Tasks, Screenshots, etc.)
- **Layouts** - Predefined grid arrangements for modules
- **Config Generator** - AI-driven layout selection based on session data
- **Session Analyzer** - Examines session content to determine optimal layout

**Usage**: See `src/components/morphing-canvas/example.tsx` for implementation patterns.

## Design System

**Location**: `src/design-system/theme.ts`

Centralized design tokens and theme constants:
- `NAVIGATION` - Navigation-specific styles (logo, island, tabs)
- `KANBAN` - Kanban board styles
- `BACKGROUND_GRADIENT` - Gradient backgrounds for zones
- `Z_INDEX` - Z-index layering constants
- Utility functions: `getGlassClasses()`, `getRadiusClass()`, `getToastClasses()`, `getTaskCardClasses()`

**Usage**: Import theme constants instead of hardcoding values to maintain consistency.

## Important Patterns

### 1. Attachment Handling
```typescript
// Always use attachmentStorage for binary data
import { attachmentStorage } from './services/attachmentStorage';

// Create attachment
const attachment = await attachmentStorage.createAttachment({
  type: 'image',
  name: 'screenshot.png',
  mimeType: 'image/png',
  size: blob.size,
  base64: await blobToBase64(blob),
});

// Load attachment data
const data = await attachmentStorage.loadAttachment(attachmentId);
```

### 2. Session Lifecycle
```typescript
// Start session
dispatch({ type: 'START_SESSION', payload: { name, description, ... } });

// End session (triggers enrichment if configured)
dispatch({ type: 'END_SESSION', payload: sessionId });

// Enrichment runs automatically based on session's enrichmentConfig
```

### 3. Context Usage (Updated - Phase 1)
```typescript
// ❌ OLD (deprecated):
import { useSessions } from './context/SessionsContext';
const { sessions, activeSessionId, startSession } = useSessions();

// ✅ NEW (Phase 1):
import { useSessionList } from './context/SessionListContext';
import { useActiveSession } from './context/ActiveSessionContext';
import { useRecording } from './context/RecordingContext';

const { sessions, filteredSessions } = useSessionList();
const { activeSession, startSession, endSession } = useActiveSession();
const { recordingState, startScreenshots, stopAll } = useRecording();
```

**Migration Guide**: See `/docs/sessions-rewrite/CONTEXT_MIGRATION_GUIDE.md` for complete API mapping.

### 4. State Machine Usage (New - Phase 1)
```typescript
import { useSessionMachine } from '@/hooks/useSessionMachine';

const { state, context, isActive, startSession } = useSessionMachine();

// Type-safe state checks
if (state.matches('active')) {
  // Session is active
}

// Access machine context
console.log(context.sessionId);  // Current session ID
console.log(context.config);     // Session configuration
```

### 5. Refs Pattern (Updated - Phase 1)
```typescript
// ❌ AVOID: Using refs for state management (causes stale closures)
const activeSessionIdRef = useRef(activeSessionId);
const callback = useCallback(() => {
  const id = activeSessionIdRef.current;  // Stale closure risk
}, []);

// ✅ CORRECT: Use proper state/context dependencies
const { activeSession } = useActiveSession();
const callback = useCallback(() => {
  if (activeSession) {
    // activeSession is always fresh from context
  }
}, [activeSession]);  // Proper dependency

// ✅ OK: Using refs for DOM elements
const scrollRef = useRef<HTMLDivElement>(null);

// ✅ OK: Using refs for timers/async guards
const timeoutRef = useRef<NodeJS.Timeout | null>(null);
const listenerActiveRef = useRef<boolean>(false);  // Prevent duplicate async listeners
```

**Fixed**: SessionsZone now uses proper state management (Phase 1) - all state refs eliminated.

### 6. AI Service Error Handling
```typescript
// All AI services throw on missing API keys
try {
  const result = await claudeService.processInput(...);
} catch (error) {
  if (error.message.includes('API key')) {
    // Prompt user to configure API key
  }
}
```

## Testing Conventions

### Test Structure
```typescript
// Use descriptive test names with context
describe('SessionsContext', () => {
  describe('START_SESSION', () => {
    it('should create new session with generated ID', () => {
      // Arrange, Act, Assert
    });
  });
});
```

### Mocking AI Services
```typescript
// Mock at the module level
vi.mock('../services/claudeService', () => ({
  claudeService: {
    processInput: vi.fn(),
    setApiKey: vi.fn(),
  },
}));
```

### Coverage Thresholds
Current thresholds (see `vitest.config.ts`):
- Lines: 30%
- Functions: 30%
- Branches: 25%
- Statements: 30%

Focus on testing **critical paths**: session lifecycle, enrichment pipeline, storage adapters.

## Tauri-Specific Notes

### Rust Commands
All Tauri commands are in `src-tauri/src/`:

- `main.rs` - App initialization, window management
- `api_keys.rs` - Secure API key storage (using tauri-plugin-store)
- `activity_monitor.rs` - Activity metrics for adaptive screenshots (macOS-specific)
- `audio_capture.rs` - Audio recording via cpal
- `video_recording.rs` - Screen recording (macOS-specific, Swift bridge)
- `claude_api.rs` - Rust-side Claude API client (streaming)
- `openai_api.rs` - Rust-side OpenAI API client
- `session_storage.rs` - High-performance session data storage

### Invoking Rust Commands
```typescript
import { invoke } from '@tauri-apps/api/core';

// Example: Get API key from secure storage
const apiKey = await invoke<string | null>('get_claude_api_key');

// Example: Start activity monitoring
await invoke('start_activity_monitoring', { intervalMs: 5000 });
```

### macOS-Specific Features
- **Activity Monitoring**: Uses Core Graphics + Accessibility APIs
- **Screen Recording**: Uses ScreenCaptureKit via Swift bridge
- **Audio Capture**: Uses Core Audio via cpal

## File Organization

```
src/
├── components/          # React components (zones, cards, etc.)
│   ├── TopNavigation/   # Top navigation island system
│   ├── MorphingMenuButton.tsx  # [UNUSED] Alternative morphing menu (not currently integrated)
│   ├── MenuMorphPill.tsx       # [ACTIVE] Zone sub-menu morphing wrapper
│   ├── SpaceMenuBar.tsx        # [ACTIVE] Zone sub-menu content component
│   ├── morphing-canvas/ # Dynamic layout system for session reviews
│   ├── sessions/        # Session-specific components
│   └── ned/             # Ned assistant components
├── context/             # React contexts (state management)
├── contexts/            # Additional contexts (ScrollAnimationContext)
├── services/            # Business logic and AI services
│   └── storage/         # Storage adapters (IndexedDB, Tauri FS)
├── hooks/               # Custom React hooks
├── utils/               # Helper functions (matching, similarity, etc.)
├── migrations/          # Data migration scripts
├── types.ts             # TypeScript type definitions
├── types/               # Tauri-specific type definitions
├── design-system/       # Design tokens and theme constants
└── App.tsx              # Root component with providers

src-tauri/
├── src/                 # Rust source code
│   ├── main.rs          # Entry point
│   ├── api_keys.rs      # Secure key storage
│   ├── activity_monitor.rs  # Activity tracking
│   ├── audio_capture.rs     # Audio recording
│   ├── video_recording.rs   # Screen recording
│   ├── claude_api.rs        # Claude API client
│   ├── openai_api.rs        # OpenAI API client
│   ├── session_storage.rs   # High-perf storage
│   └── *.rs             # Other Tauri commands
├── ScreenRecorder/      # Swift screen recording module
└── Cargo.toml           # Rust dependencies
```

## Scroll Animation System

**ScrollAnimationContext** (`contexts/ScrollAnimationContext.tsx`) coordinates scroll-driven animations:

- Provides `scrollY` (number) and `scrollYMotionValue` (Framer Motion MotionValue) to all components
- Zones register their scroll containers via `registerScrollContainer()` / `unregisterScrollContainer()`
- Multiple scroll containers supported - tracks the "active" scrolling container
- Used by both navigation systems for coordinated morphing animations

**Key Integration Points**:
- TopNavigation uses `scrollY` for compact mode threshold (activates when scrollY >= certain value based on viewport)
- MenuMorphPill uses `scrollYMotionValue` for 60fps scroll-driven transforms (150-220px range)
- Both systems respond to the same scroll position for coordinated UX

## Common Gotchas

1. **API Keys**: Always check `hasApiKey` before calling AI services
2. **Attachment Lifecycle**: Delete attachments when deleting sessions/notes/tasks
3. **Enrichment Locks**: Prevent concurrent enrichment with `enrichmentLock`
4. **Storage Shutdown**: Call `storage.shutdown()` and `queue.shutdown()` on app close to flush pending writes
5. **Context Migration**: Use new session contexts (`useSessionList`, `useActiveSession`, `useRecording`) instead of deprecated `useSessions`
6. **Screenshot Paths**: Legacy `path` field is deprecated - use `attachmentId` instead
7. **Navigation vs Space Menus**: Don't confuse NavigationIsland (top tabs) with MenuMorphPill (zone sub-menus)
8. **Scroll Container Registration**: Always register/unregister scroll containers in useEffect cleanup
9. **MenuMorphPill resetKey**: Change `resetKey` prop when layout changes (e.g., sidebar toggle, item selection) to recalculate positions
10. **State Refs**: Never use refs for state management - use proper context/state with dependencies (causes stale closures)
11. **Persistence Queue**: Use queue for background saves - don't debounce manually (causes UI blocking)
12. **XState Machine**: Check machine state with `state.matches()`, not string equality

## Performance Considerations

- **Lazy Loading**: Zones are lazy-loaded via React.lazy()
- **Virtual Scrolling**: Long lists use `@tanstack/react-virtual`
- **Image Compression**: Screenshots compressed before storage
- **Audio Compression**: Audio segments compressed to MP3 for AI processing
- **Debouncing**: Search and filter inputs are debounced (300ms)
- **Rust Parallelism**: Heavy operations use Rayon for parallel processing

## AI Cost Management

Sessions can be expensive due to:
- Screenshot analysis (vision API calls)
- Audio review (GPT-4o audio preview)
- Video chaptering (frame extraction + vision API)

**Cost Controls**:
- `enrichmentConfig.maxCostThreshold` - Stop if exceeded
- `enrichmentStatus.totalCost` - Running cost tracker
- Audio review is **ONE-TIME** only (never re-processed)

## Debugging Tips

1. **Storage Issues**: Check browser console for IndexedDB errors
2. **AI Processing**: Enable `showThinking` in Ned settings
3. **Session Enrichment**: Check `enrichmentStatus.errors` for pipeline failures
4. **Tauri Commands**: Use `tauri-plugin-log` output in terminal
5. **Context State**: Use React DevTools to inspect context values
