# Developer Quick-Start Guide

**Last Updated**: November 2, 2025
**Version**: v0.85 (approaching v1.0)
**Time to First Contribution**: ~30 minutes

---

## Welcome to Taskerino!

This guide gets you from zero to productive in 30 minutes. After reading this, you'll understand:
- ✅ Core architecture (contexts, storage, AI)
- ✅ How to add features
- ✅ Where to find detailed docs
- ✅ Common patterns and best practices

---

## Table of Contents

1. [5-Minute Overview](#5-minute-overview)
2. [Development Setup](#development-setup)
3. [Architecture at a Glance](#architecture-at-a-glance)
4. [Common Tasks](#common-tasks)
5. [System Guides](#system-guides)
6. [Best Practices](#best-practices)
7. [Getting Help](#getting-help)

---

## 5-Minute Overview

### What is Taskerino?

**AI-powered productivity app** that combines:
- 📝 **Notes & Tasks** - Smart capture with AI processing
- 🎥 **Sessions** - Record work sessions (screenshots, audio, video)
- 🤖 **Ned AI Assistant** - Chat with AI about your work
- 🔗 **Relationships** - Link everything together
- 📊 **Insights** - AI-generated summaries and analysis

### Tech Stack

```
Frontend: React 19 + TypeScript + Vite
Desktop: Tauri v2 (Rust backend, web frontend)
Styling: Tailwind CSS v3
AI: Claude API (Sonnet 4.5), OpenAI (Whisper, GPT-4o)
Storage: IndexedDB (browser) + Tauri FS (desktop)
Recording: Swift ScreenCaptureKit (macOS)
Testing: Vitest + React Testing Library
```

### Project Status

- ✅ **Phases 1-6 Complete** (contexts, recording, audio, storage, enrichment, background)
- 🟡 **Phase 7 In Progress** (90% - relationship system rebuild)
- 🎯 **Next**: v1.0 Release

---

## Development Setup

### Prerequisites

```bash
# Required
- Node.js 18+
- Rust (for Tauri)
- macOS 12.3+ (for screen recording)

# Optional
- Claude API key (for AI features)
- OpenAI API key (for audio transcription)
```

### Installation

```bash
# Clone repo
git clone https://github.com/your-org/taskerino.git
cd taskerino

# Install dependencies
npm install

# Start development
npm run dev              # Vite dev server + Tauri
npm run tauri:dev        # Alternative (same as above)

# Type checking
npm run type-check       # TypeScript validation

# Tests
npm test                 # Run all tests
npm run test:ui          # Vitest UI (recommended!)
npm run test:coverage    # Coverage report

# Build
npm run build            # Production build
npm run tauri:build      # Desktop app build
```

### First Run

1. App launches → Shows onboarding
2. Configure API keys (Settings → API Keys)
3. Create your first note or start a session
4. Explore the 6 zones (Capture, Tasks, Library, Sessions, Assistant, Profile)

---

## Architecture at a Glance

### 6 Navigation Zones

```
TopNavigation (tabs)
├── Capture     - Quick note/task entry
├── Tasks       - Task management (list/kanban/table)
├── Library     - Notes by topic
├── Sessions    - Work session tracking
├── Assistant   - Ned AI chat
└── Profile     - Settings & configuration
```

### Core Contexts (State Management)

```typescript
// Specialized contexts (Phase 1 - Current)
import { useActiveSession } from '@/context/ActiveSessionContext';
import { useSessionList } from '@/context/SessionListContext';
import { useRecording } from '@/context/RecordingContext';
import { useTasks } from '@/context/TasksContext';
import { useNotes } from '@/context/NotesContext';
import { useRelationships } from '@/context/RelationshipsContext';
import { useEntities } from '@/context/EntitiesContext';
import { useUI } from '@/context/UIContext';
import { useSettings } from '@/context/SettingsContext';
```

**Deprecated** (DO NOT USE):
- ❌ `SessionsContext` → Use `useActiveSession()` + `useSessionList()` + `useRecording()`
- ❌ `AppContext` → Use specialized contexts

### 3 Major Systems

**1. Storage System** (Phase 4):
- ChunkedSessionStorage - Fast metadata loading
- ContentAddressableStorage - Deduplication
- InvertedIndexManager - O(log n) search

**2. Enrichment System** (Phases 5-6):
- BackgroundEnrichmentManager - Persistent job queue
- Cost optimization - 78% reduction
- Media processing - Optimized video/audio

**3. Relationship System** (Phase 7):
- Automatic bidirectional sync
- Type-safe relationships
- O(1) lookups

---

## Common Tasks

### Task 1: Add a New Note

```typescript
import { useNotes } from '@/context/NotesContext';

function MyComponent() {
  const { addNote } = useNotes();

  const handleCreate = async () => {
    await addNote({
      content: '# My Note\n\nSome content here',
      topicIds: ['topic-123'],  // Link to topic
      tags: ['important'],
      attachments: []
    });
  };
}
```

### Task 2: Start a Recording Session

```typescript
import { useActiveSession } from '@/context/ActiveSessionContext';
import { useRecording } from '@/context/RecordingContext';

function SessionControls() {
  const { startSession, activeSessionId } = useActiveSession();
  const { startScreenshots, startAudio } = useRecording();

  const handleStart = async () => {
    // 1. Create session
    await startSession({
      name: 'Work Session',
      screenshotInterval: 120,
      audioMode: 'transcription'
    });

    // 2. Start recording services
    await startScreenshots(activeSessionId!, 120);
    await startAudio(activeSessionId!, 'default');
  };
}
```

### Task 3: Search Sessions

```typescript
import { getInvertedIndexManager } from '@/services/storage/InvertedIndexManager';

const indexManager = await getInvertedIndexManager();

const results = await indexManager.search({
  text: 'authentication bug',
  tags: ['backend'],
  dateRange: {
    start: new Date('2025-11-01'),
    end: new Date('2025-11-02')
  },
  operator: 'AND'
});
```

### Task 4: Link Task to Note (Relationships)

```typescript
import { useRelationships } from '@/context/RelationshipsContext';

const { addRelationship } = useRelationships();

await addRelationship({
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note',
  targetId: 'note-456',
  relationshipType: 'references'
});
// Automatically bidirectional - note now references task!
```

### Task 5: Enrich a Session

```typescript
import { getBackgroundEnrichmentManager } from '@/services/enrichment/BackgroundEnrichmentManager';

const manager = await getBackgroundEnrichmentManager();

const jobId = await manager.enqueueSession({
  sessionId: 'session-123',
  sessionName: 'Work Session',
  options: {
    includeAudio: true,
    includeVideo: true
  }
});

// Monitor progress
manager.on('job-progress', (job) => {
  console.log(`${job.progress}% - ${job.stage}`);
});
```

### Task 6: Add UI Notification

```typescript
import { useUI } from '@/context/UIContext';

const { addNotification } = useUI();

addNotification({
  type: 'success',  // 'success' | 'error' | 'warning' | 'info'
  title: 'Task Completed',
  message: 'Great work!',
  autoDismiss: true,
  dismissAfter: 3000
});
```

---

## System Guides

### Need to work with...

**Relationships?** → Read [`RELATIONSHIP_SYSTEM_GUIDE.md`](./RELATIONSHIP_SYSTEM_GUIDE.md)
- Bidirectional sync
- UI components (pills, modal, cards)
- Type-safe API
- Migration guide

**Enrichment?** → Read [`ENRICHMENT_SYSTEM_GUIDE.md`](./ENRICHMENT_SYSTEM_GUIDE.md)
- Background processing
- Cost optimization (78% reduction)
- AI integration
- Performance metrics

**Storage?** → Read [`STORAGE_SYSTEM_GUIDE.md`](./STORAGE_SYSTEM_GUIDE.md)
- Chunked loading (3-5x faster)
- Content-addressable deduplication
- Inverted indexes (O(log n) search)
- LRU cache (>90% hit rate)

**Recording?** → Read [`CLAUDE.md`](./CLAUDE.md#recording-architecture-phase-2---complete)
- Swift ScreenCaptureKit integration
- Pause/resume, hot-swap
- Actor-based thread safety
- Multi-source composition

**Contexts?** → Read [`ARCHITECTURE_GUIDE.md`](./ARCHITECTURE_GUIDE.md)
- When to use which context
- Migration from old patterns
- Common patterns
- Testing contexts

**AI Integration?** → Read [`developer/AI_ARCHITECTURE.md`](./developer/AI_ARCHITECTURE.md)
- Claude API integration
- OpenAI Whisper + GPT-4o
- Ned AI assistant
- Tool execution

---

## Best Practices

### 1. Follow the Zone Pattern

Each zone has:
- Main component (`SessionsZone.tsx`)
- Sub-menu (`SpaceMenuBar.tsx` in `MenuMorphPill`)
- Detail views (sidebar or modal)

```typescript
<MenuMorphPill resetKey={selectedItemId}>
  <SpaceMenuBar
    primaryAction={...}
    viewControls={...}
    filters={...}
  />
</MenuMorphPill>
```

### 2. Use Specialized Contexts

```typescript
// ✅ CORRECT
import { useActiveSession } from '@/context/ActiveSessionContext';
import { useTasks } from '@/context/TasksContext';

// ❌ WRONG (deprecated)
import { useSessions } from '@/context/SessionsContext';
import { useApp } from '@/context/AppContext';
```

### 3. Handle Async Operations

```typescript
// ✅ CORRECT - Proper async/await
const handleStart = async () => {
  try {
    await startSession({ ... });
    await startScreenshots(sessionId, 120);
  } catch (error) {
    addNotification({
      type: 'error',
      title: 'Failed to start session',
      message: error.message
    });
  }
};

// ❌ WRONG - Missing await
const handleStart = () => {
  startSession({ ... }); // Fire and forget (loses errors!)
};
```

### 4. Use Design System Tokens

```typescript
import {
  getGlassClasses,
  getRadiusClass,
  TRANSITIONS,
  Z_INDEX
} from '@/design-system/theme';

// ✅ CORRECT - Use design tokens
<div className={`${getGlassClasses('medium')} ${getRadiusClass('card')}`}>
  ...
</div>

// ❌ WRONG - Hardcoded values
<div className="backdrop-blur-lg bg-white/80 rounded-2xl">
  ...
</div>
```

### 5. Write Tests

```typescript
// Component tests
describe('TaskCard', () => {
  it('should display task title', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Fix bug')).toBeInTheDocument();
  });
});

// Integration tests
describe('Sessions Integration', () => {
  it('should start and end session', async () => {
    const { startSession, endSession } = renderHook(() => useActiveSession());
    await startSession({ name: 'Test' });
    expect(activeSession).toBeTruthy();
    await endSession();
    expect(activeSession).toBeNull();
  });
});
```

### 6. Type Everything

```typescript
// ✅ CORRECT - Full types
interface MyComponentProps {
  taskId: string;
  onComplete: (taskId: string) => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ taskId, onComplete }) => {
  // ...
};

// ❌ WRONG - Any types
export const MyComponent = ({ taskId, onComplete }: any) => {
  // ...
};
```

---

## Getting Help

### Documentation Map

**Essential Reading**:
1. **This Guide** - You are here! (30 min)
2. [`CLAUDE.md`](./CLAUDE.md) - Comprehensive codebase guide (60 min)
3. [`INDEX.md`](./INDEX.md) - Master documentation index (10 min)

**System-Specific**:
- [`RELATIONSHIP_SYSTEM_GUIDE.md`](./RELATIONSHIP_SYSTEM_GUIDE.md) - Relationships
- [`ENRICHMENT_SYSTEM_GUIDE.md`](./ENRICHMENT_SYSTEM_GUIDE.md) - Enrichment
- [`STORAGE_SYSTEM_GUIDE.md`](./STORAGE_SYSTEM_GUIDE.md) - Storage
- [`ARCHITECTURE_GUIDE.md`](./ARCHITECTURE_GUIDE.md) - Contexts

**API Reference**:
- [`developer/API_REFERENCE_GUIDE.md`](./developer/API_REFERENCE_GUIDE.md)
- [`developer/FILE_REFERENCE.md`](./developer/FILE_REFERENCE.md)
- [`developer/TODO_TRACKER.md`](./developer/TODO_TRACKER.md) - Known issues

**Detailed Implementations**:
- [`sessions-rewrite/MASTER_PLAN.md`](./sessions-rewrite/MASTER_PLAN.md) - Phase breakdown
- [`sessions-rewrite/ARCHITECTURE.md`](./sessions-rewrite/ARCHITECTURE.md) - Technical specs
- [`7_PHASE_FINAL_AUDIT.md`](./7_PHASE_FINAL_AUDIT.md) - Phase 1-7 verification

### Common Questions

**Q: Where do I add a new feature?**
A: Depends on the feature:
- Note/Task CRUD → Context + UI component
- Recording feature → Rust/Swift + Tauri command
- AI processing → Service + Context integration

**Q: How do I test my changes?**
A:
```bash
npm run type-check   # TypeScript errors
npm test             # Unit/integration tests
npm run dev          # Manual testing
```

**Q: Where are the types defined?**
A:
- Main types: `/src/types.ts`
- Relationships: `/src/types/relationships.ts`
- Tauri types: `/src/types/*.d.ts`

**Q: How do I debug?**
A:
- Frontend: Chrome DevTools
- Rust: `println!` debugging or `dbg!` macro
- Swift: Xcode debugger or `print()` statements

**Q: What's the branching strategy?**
A: (Check with team - common pattern is feature branches → main)

### Getting Unstuck

1. **Check CLAUDE.md** - Most answers are there
2. **Search codebase** - `grep -r "pattern" src/`
3. **Read tests** - See how features are used
4. **Ask in chat** - Team is here to help!

---

## Next Steps

### Your First Contribution

1. **Pick a good first issue**:
   - Check `/docs/developer/TODO_TRACKER.md`
   - Look for "good first issue" label
   - Ask team for recommendations

2. **Read relevant system guide**:
   - Feature in Sessions? → Read enrichment/storage guides
   - Feature in Relationships? → Read relationship guide
   - Feature in UI? → Read CLAUDE.md navigation section

3. **Write your code**:
   - Follow patterns in existing code
   - Use specialized contexts
   - Add types
   - Write tests

4. **Test thoroughly**:
   ```bash
   npm run type-check  # Zero errors
   npm test            # All passing
   npm run dev         # Manual testing
   ```

5. **Submit PR**:
   - Clear description
   - Link to issue
   - Screenshots if UI change

### Advanced Topics

Once comfortable with basics:
- **XState Machines** - `src/machines/sessionMachine.ts`
- **Scroll Animations** - `contexts/ScrollAnimationContext.tsx`
- **Morphing Canvas** - `src/components/morphing-canvas/`
- **AI Tool Execution** - `src/services/nedToolExecutor.ts`
- **Rust FFI** - `src-tauri/src/recording/ffi.rs`

---

## Quick Reference Card

### File Structure
```
src/
├── components/        # React components
├── context/          # State management (contexts)
├── services/         # Business logic
├── hooks/            # Custom React hooks
├── utils/            # Helper functions
├── types.ts          # Main type definitions
└── design-system/    # Design tokens

src-tauri/
├── src/              # Rust source
└── ScreenRecorder/   # Swift recording module
```

### Key Commands
```bash
npm run dev           # Start development
npm run type-check    # TypeScript validation
npm test              # Run tests
npm run build         # Production build
```

### Import Patterns
```typescript
// Contexts
import { useActiveSession } from '@/context/ActiveSessionContext';

// Services
import { getChunkedStorage } from '@/services/storage/ChunkedSessionStorage';

// Components
import { TaskCard } from '@/components/TaskCard';

// Utils
import { generateId } from '@/utils/helpers';

// Theme
import { getGlassClasses } from '@/design-system/theme';
```

### Testing
```typescript
// Unit test
import { describe, it, expect } from 'vitest';

// Component test
import { render, screen } from '@testing-library/react';

// Integration test
import { renderHook } from '@testing-library/react';
```

---

## Welcome Aboard! 🚀

You now have everything you need to start contributing to Taskerino. Remember:

- ✅ Read [`CLAUDE.md`](./CLAUDE.md) for deep dives
- ✅ Use system guides for specific features
- ✅ Follow existing patterns
- ✅ Write tests
- ✅ Ask questions

**Happy coding!**
