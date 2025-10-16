# AppContext Split - Executive Summary

## Problem
The current monolithic AppContext contains ALL application state (145+ actions, 20+ state fields). Every state change triggers re-renders across the ENTIRE app, even in completely unrelated zones.

**Performance Impact:**
- Changing a task re-renders NotesZone, LibraryZone, SessionsZone (unnecessary)
- Changing a note re-renders TasksZone, SessionsZone (unnecessary)
- Opening sidebar re-renders all data zones (unnecessary)
- Settings changes re-render everything (unnecessary)

**Estimated waste:** 70-85% of re-renders are unnecessary.

---

## Solution
Split AppContext into 6 specialized contexts, each responsible for one domain:

1. **SettingsContext** - AI settings, learning settings, user profile, Ned settings
2. **UIContext** - Navigation, modals, sidebar, notifications, onboarding, Ned conversation
3. **EntitiesContext** - Companies, contacts, topics (entities only)
4. **NotesContext** - Notes management
5. **TasksContext** - Tasks management
6. **SessionsContext** - Recording sessions, screenshots, audio

**Benefits:**
- 70-85% reduction in unnecessary re-renders
- Changing tasks only re-renders TasksZone
- Changing notes only re-renders LibraryZone/NotesZone
- UI changes (sidebar, modals) don't re-render data zones
- Settings changes only re-render SettingsModal

---

## Context Hierarchy & Dependencies

```
SettingsProvider           ← No dependencies
  ↓
UIProvider                 ← Can use Settings
  ↓
EntitiesProvider           ← Independent
  ↓
NotesProvider              ← Uses Entities (to update noteCounts)
  ↓
TasksProvider              ← Can use Entities (optional)
  ↓
SessionsProvider           ← Can use Tasks/Notes (optional)
  ↓
<App />
```

**Why this order matters:**
- Inner providers can access outer providers
- Outer providers CANNOT access inner providers
- This prevents circular dependencies

---

## High-Level Implementation Steps

### Phase 1: Create Contexts (11.5 hours)
1. Create SettingsContext (1 hr)
2. Create UIContext (1.5 hrs)
3. Rename AppContext → EntitiesContext (1.5 hrs)
4. Create TasksContext (2 hrs)
5. Create NotesContext (2 hrs)
6. Create SessionsContext (3 hrs)

### Phase 2: Provider Nesting (30 min)
Nest all providers in correct order in App.tsx

### Phase 3: Component Migration (10 hours)
Migrate 36+ components from `useApp()` to specialized hooks:
- `useSettings()`
- `useUI()`
- `useEntities()`
- `useTasks()`
- `useNotes()`
- `useSessions()`

### Phase 4: Testing & Validation (2 hours)
- Test all features work
- Measure re-render reduction with React DevTools Profiler
- Validate data persistence
- Check for regressions

**Total Time:** 24 hours (ideal), 28-30 hours (realistic with debugging)

---

## Critical Success Factors

### Must Do Right:
1. **Provider order** - Must match dependency tree or app crashes
2. **Storage compatibility** - Must work with existing localStorage data
3. **Cross-context updates** - Notes must update entity noteCounts correctly
4. **Critical saves** - Screenshots/audio must save immediately (no data loss)

### Testing Priorities:
1. **Data integrity** - No data loss on crash/reload
2. **Re-render reduction** - Measure with React DevTools (target: 70-85% reduction)
3. **Feature completeness** - All features still work
4. **Performance** - No degradation, only improvement

---

## Risk Assessment

### Medium Risk:
- Cross-context updates (Notes updating Entity noteCounts)
- Storage migration from old format
- Provider nesting order

### Low Risk:
- Individual context creation
- Most component migrations
- UI state separation

### Mitigation:
- Git tag `before-context-split` for instant rollback
- Validate after each context creation
- Test each component immediately after migration
- Use same storage keys (backwards compatible)

---

## Expected Results

### Before:
```
User creates task → 50+ components re-render
User edits note → 50+ components re-render
User toggles sidebar → 50+ components re-render
```

### After:
```
User creates task → Only TasksZone components re-render (~7 components)
User edits note → Only LibraryZone components re-render (~5 components)
User toggles sidebar → Only UI components re-render (~3 components)
```

**Performance improvement:** 70-85% reduction in re-renders

---

## Timeline

| Week | Tasks | Hours |
|------|-------|-------|
| Week 1 | Create all contexts + provider nesting | 12 hrs |
| Week 2 | Migrate Priority 1 & 2 components | 6 hrs |
| Week 3 | Migrate Priority 3 components + testing | 6 hrs |

**Total:** 3 weeks part-time OR 3-4 days full-time

---

## Go/No-Go Decision

### Go if:
- [ ] You have 24+ hours available
- [ ] You're comfortable with React Context API
- [ ] You can afford potential bugs during migration
- [ ] Performance is a priority

### No-Go if:
- [ ] You're under tight deadline
- [ ] The app is in production with no backup
- [ ] You're not familiar with Context API
- [ ] Current performance is acceptable

---

## Next Steps

1. Read the full implementation plan: `APPCONTEXT_SPLIT_IMPLEMENTATION_PLAN.md`
2. Set up git branch: `git checkout -b perf/split-app-context`
3. Create git tag: `git tag before-context-split`
4. Start with Phase 1: Create SettingsContext
5. Follow the plan step-by-step
6. Validate after each step
7. Test thoroughly before merging

**Remember:** This is a marathon, not a sprint. Take it slow and test thoroughly.

Good luck! 🚀
