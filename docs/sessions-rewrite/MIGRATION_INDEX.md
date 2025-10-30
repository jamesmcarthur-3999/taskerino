# Migration Guides Index

**Last Updated**: 2025-10-23
**Status**: Phase 1 Complete - Migration guides available

---

## Overview

This directory contains comprehensive migration guides for Phase 1 changes to the Sessions architecture. All migrations are **backward compatible** - you can migrate components gradually without breaking existing functionality.

---

## Phase 1 Migrations

### Contexts

#### 1. Context Migration Guide
**File**: [`CONTEXT_MIGRATION_GUIDE.md`](./CONTEXT_MIGRATION_GUIDE.md)

**What it covers**:
- Migrating from `useSessions()` to new contexts
- API mapping (old → new)
- Component-specific migration examples
- Common pitfalls and solutions

**When to use**:
- You're working on a component that uses `useSessions()`
- You need to understand the new context API
- You want to migrate a component to the new architecture

**Quick example**:
```typescript
// Before
const { sessions, activeSessionId, startSession } = useSessions();

// After
const { sessions } = useSessionList();
const { activeSession, startSession } = useActiveSession();
```

#### 2. Component Migration Template
**File**: Component migration template not yet created (Task 1.9)

**Status**: To be created in Task 1.9

**What it will cover**:
- Step-by-step migration checklist
- Testing requirements
- Verification steps

### Patterns

#### 3. Refs Elimination Plan
**File**: [`REFS_ELIMINATION_PLAN.md`](./REFS_ELIMINATION_PLAN.md)

**What it covers**:
- Complete audit of all refs in SessionsZone
- Which refs to eliminate vs keep
- Elimination strategies for each ref type
- Callback dependency analysis

**When to use**:
- You're eliminating refs from a component
- You're fixing stale closure issues
- You need to understand proper React dependency patterns

**Quick example**:
```typescript
// ❌ Before: Using refs for state (stale closures)
const activeSessionIdRef = useRef(activeSessionId);
const callback = useCallback(() => {
  const id = activeSessionIdRef.current;
}, []);

// ✅ After: Proper context dependencies
const { activeSession } = useActiveSession();
const callback = useCallback(() => {
  if (activeSession) {
    // activeSession is always fresh
  }
}, [activeSession]);
```

#### 4. Storage Queue Usage
**File**: [`STORAGE_QUEUE_DESIGN.md`](./STORAGE_QUEUE_DESIGN.md)

**What it covers**:
- PersistenceQueue architecture
- Priority levels (critical/normal/low)
- API usage examples
- Event system
- Performance characteristics

**When to use**:
- You're adding new storage operations
- You need to replace debounced saves
- You want to understand queue priority levels

**Quick example**:
```typescript
import { getPersistenceQueue } from '@/services/storage/PersistenceQueue';

const queue = getPersistenceQueue();

// Critical update (immediate)
queue.enqueue('activeSession', session, 'critical');

// Normal update (batched)
queue.enqueue('sessions', allSessions, 'normal');
```

#### 5. State Machine Usage
**File**: State machine documentation in code comments and tests

**Location**: `/src/machines/sessionMachine.ts`

**What it covers**:
- XState v5 session lifecycle machine
- 9 states with type-safe transitions
- Guards, actions, and context

**When to use**:
- You're working with session lifecycle
- You need type-safe state management
- You want to prevent impossible states

**Quick example**:
```typescript
import { useSessionMachine } from '@/hooks/useSessionMachine';

const { state, context, isActive, startSession } = useSessionMachine();

// Type-safe state checks
if (state.matches('active')) {
  // Session is active
}
```

---

## Quick Reference

### Migration Priority

| Old Pattern | New Pattern | Priority | Guide |
|-------------|-------------|----------|-------|
| `useSessions()` | `useSessionList()` + others | HIGH | Context Migration |
| Refs for state | Proper state/context | HIGH | Refs Elimination |
| Debounced saves | PersistenceQueue | MEDIUM | Storage Queue |
| Manual state | XState machine | MEDIUM | State Machine (in code) |
| Direct service access | RecordingContext | LOW | Context Migration |

### When to Migrate

**Migrate Now** if:
- You're creating a new component that needs session data
- You're fixing a bug in an existing component
- You're adding new features to a component
- You're experiencing stale closure issues

**Migrate Later** if:
- Component is working fine and not being actively developed
- You don't have time for thorough testing
- Component will be rewritten soon anyway

**Note**: All old APIs will continue to work until Phase 7. No rush to migrate everything immediately.

---

## Migration Checklist

### For Each Component

- [ ] **Read Context Migration Guide**
  - Understand which new contexts to use
  - Review API mapping table
  - Check component-specific examples

- [ ] **Identify Dependencies**
  - Which context methods does component use?
  - Does it manage active session, list, or recording?
  - Are there any refs being used?

- [ ] **Update Imports**
  - Replace `useSessions()` imports
  - Add new context imports

- [ ] **Update Hook Usage**
  - Destructure from appropriate contexts
  - Remove activeSessionId lookups (use activeSession directly)

- [ ] **Update Function Calls**
  - Remove sessionId parameters from active session operations
  - Update updateSession signature

- [ ] **Eliminate Refs** (if any)
  - Identify state refs vs DOM refs
  - Replace state refs with proper dependencies
  - Update callback dependencies

- [ ] **Replace Debounced Saves**
  - Use PersistenceQueue instead
  - Choose appropriate priority level

- [ ] **Test**
  - Type checking passes
  - Component renders
  - All operations work
  - No console warnings

- [ ] **Verify**
  - Create verification checklist
  - Document any issues
  - Update component documentation

---

## Component Migration Status

### Components Using SessionsContext (21 total)

#### Session Management (3)
- [ ] SessionsZone.tsx - **COMPLEX** (uses all 3 contexts)
- [ ] ActiveSessionView.tsx - **MEDIUM** (uses active session)
- [ ] SessionDetailView.tsx - **LOW** (read-only)

#### Navigation (2)
- [ ] TopNavigation/index.tsx - **LOW** (just needs activeSessionId)
- [ ] TopNavigation/useNavData.ts - **LOW**

#### Quick Actions (3)
- [ ] CaptureZone.tsx
- [ ] QuickNoteFromSession.tsx
- [ ] QuickTaskFromSession.tsx

#### UI Components (6)
- [ ] FloatingControls.tsx
- [ ] CommandPalette.tsx
- [ ] SettingsModal.tsx
- [ ] sessions/SessionCard.tsx
- [ ] AudioReviewStatusBanner.tsx
- [ ] CanvasView.tsx

#### Hooks (3)
- [ ] hooks/useSessionStarting.ts
- [ ] hooks/useSessionEnding.ts
- [ ] hooks/useSession.ts

#### Other (4)
- [ ] context/EnrichmentContext.tsx
- [ ] components/ned/NedChat.tsx
- [ ] App.tsx

**Progress**: 0/21 migrated (0%)

---

## Common Patterns

### Pattern 1: Read-Only Session List
```typescript
// Component that just displays sessions
const { sessions, filteredSessions, setFilter } = useSessionList();
```

**Complexity**: LOW
**Examples**: SessionCard, SessionList

### Pattern 2: Active Session Management
```typescript
// Component that manages active session
const { activeSession, startSession, endSession } = useActiveSession();
```

**Complexity**: MEDIUM
**Examples**: ActiveSessionView, SessionsZone

### Pattern 3: Recording Controls
```typescript
// Component that controls recording
const { recordingState, startScreenshots, stopAll } = useRecording();
```

**Complexity**: MEDIUM
**Examples**: SessionsZone, RecordingControls

### Pattern 4: All Three Contexts
```typescript
// Component that does everything
const { sessions } = useSessionList();
const { activeSession, startSession } = useActiveSession();
const { recordingState, startScreenshots } = useRecording();
```

**Complexity**: HIGH
**Examples**: SessionsZone

---

## Troubleshooting

### Issue: "Cannot read property 'id' of undefined"
**Cause**: Looking up activeSession from sessions array failed
**Solution**: Use `activeSession` from `useActiveSession()` directly

### Issue: "Too many re-renders"
**Cause**: Callback dependency changed, causing infinite loop
**Solution**: Ensure callbacks have stable dependencies or use useCallback properly

### Issue: "ESLint exhaustive-deps warning"
**Cause**: Callback is missing dependencies
**Solution**: Add all used values to dependency array, or use refs for non-reactive values (DOM refs, timers only)

### Issue: "updateSession is not a function"
**Cause**: Wrong context or old signature
**Solution**: Check you're using `useSessionList()` and new signature: `updateSession(id, updates)`

---

## Testing Guidelines

### Unit Tests
- Test each hook in isolation
- Mock context providers
- Verify all operations work

### Integration Tests
- Test component with real contexts
- Verify data flows correctly
- Test error scenarios

### Manual Testing
- Start a session
- Pause/resume works
- Screenshots/audio capture
- End session
- View past sessions
- Delete a session

---

## Resources

### Documentation
- [CONTEXT_MIGRATION_GUIDE.md](./CONTEXT_MIGRATION_GUIDE.md) - Complete API migration guide
- [REFS_ELIMINATION_PLAN.md](./REFS_ELIMINATION_PLAN.md) - Refs elimination strategies
- [STORAGE_QUEUE_DESIGN.md](./STORAGE_QUEUE_DESIGN.md) - Persistence queue design
- [ARCHITECTURE_STATUS.md](./ARCHITECTURE_STATUS.md) - Overall architecture status
- [PHASE_1_SUMMARY.md](./PHASE_1_SUMMARY.md) - Phase 1 completion summary

### Code
- `/src/context/SessionListContext.tsx` - Session list context
- `/src/context/ActiveSessionContext.tsx` - Active session context
- `/src/context/RecordingContext.tsx` - Recording context
- `/src/machines/sessionMachine.ts` - XState session machine
- `/src/services/storage/PersistenceQueue.ts` - Storage queue

### Tests
- `/src/context/__tests__/` - Context tests
- `/src/machines/__tests__/` - State machine tests
- `/src/services/storage/__tests__/` - Storage tests

---

## FAQ

### Q: Do I have to migrate everything immediately?
**A**: No. The old `useSessions()` API will continue to work until Phase 7 (week 13-14). Migrate gradually as you work on components.

### Q: What if I break something during migration?
**A**: All changes are backward compatible. If something breaks, you can revert to the old API. Make sure to test thoroughly before committing.

### Q: Can I use both old and new APIs in the same component?
**A**: Yes, but it's not recommended. It's clearer to migrate completely. If you do mix them, make sure they don't conflict.

### Q: How do I know which context to use?
**A**: Use the decision tree:
- Need session list? → `useSessionList()`
- Need active session? → `useActiveSession()`
- Need recording controls? → `useRecording()`
- Need multiple? → Use multiple hooks

### Q: What about performance?
**A**: The new contexts are more performant due to reduced re-renders. Components only re-render when their specific data changes.

### Q: Where do I get help?
**A**: Check this index, read the specific migration guides, look at test examples, or ask for help with specific issues.

---

## Next Steps

1. **Read CONTEXT_MIGRATION_GUIDE.md** to understand the API changes
2. **Pick a low-complexity component** to migrate first
3. **Follow the migration checklist** for that component
4. **Test thoroughly** before moving to the next component
5. **Document any issues** you encounter
6. **Help others** by sharing what you learned

---

**Remember**: Migration is optional during Phase 1-6. Take your time and migrate components as you work on them. The old API will be removed in Phase 7.
