# Phase 2 Migration - Quick Reference

## Status at a Glance

```
COMPLETE ✅ (6 items)
├── QueryEngine Service
├── NotesContext.queryNotes()
├── TasksContext.queryTasks()
├── AppContext Migration
├── SessionScreenshot.path Field
└── MorphingMenuButton marked @deprecated

NEEDS WORK ⚠️ (1 item)
└── SessionDetailView test mock
    └── Location: src/components/__tests__/SessionDetailView.integration.test.tsx:38-42
    └── Fix: 5 minutes
    └── Impact: Test suite will fail until fixed

READY TO DELETE ✅ (1 item)
└── MorphingMenuButton.tsx
    └── File: src/components/MorphingMenuButton.tsx
    └── Risk: ZERO (no references)
```

---

## The ONE Thing You Need to Fix

### Location
File: `/src/components/__tests__/SessionDetailView.integration.test.tsx`  
Lines: 38-42

### Current (Broken)
```typescript
vi.mock('../../context/SessionsContext', () => ({
  useSessions: () => ({
    sessions: [],
    updateSession: vi.fn(),
  }),
}));
```

### Problem
- Module `../../context/SessionsContext` doesn't exist (deleted in Phase 1)
- Test will fail when run

### How to Fix (Pick One)

#### Option 1: Use SessionListContext
```typescript
vi.mock('../../context/SessionListContext', () => ({
  useSessionList: () => ({
    sessions: [],
    updateSession: vi.fn(),
  }),
}));
```

#### Option 2: Use ActiveSessionContext
```typescript
vi.mock('../../context/ActiveSessionContext', () => ({
  useActiveSession: () => ({
    activeSession: null,
    updateSession: vi.fn(),
    endSession: vi.fn(),
  }),
}));
```

#### Option 3: Remove Test
If test functionality is now redundant (covered elsewhere)

**Recommendation**: Option 1 (SessionListContext) is easiest

---

## Optional Cleanup

### Delete MorphingMenuButton.tsx
- **File**: `src/components/MorphingMenuButton.tsx`
- **Why**: Marked @deprecated, zero usage
- **Risk**: ZERO
- **Effort**: 2 minutes

---

## What's Already Done (No Action Needed)

- ✅ QueryEngine service removed
- ✅ NotesContext.queryNotes() removed (with migration guide)
- ✅ TasksContext.queryTasks() removed (with migration guide)
- ✅ AppContext replaced by 6 specialized contexts
- ✅ SessionScreenshot.path field removed
- ✅ SessionListContext, ActiveSessionContext, RecordingContext implemented
- ✅ All production code migrated
- ✅ No other breaking changes

---

## Testing Commands

```bash
# Run the broken test to see the issue
npm test -- SessionDetailView.integration

# After fixing, re-run to confirm
npm test -- SessionDetailView.integration
```

---

## Migration Summary by the Numbers

- **8** Phase 2 items verified
- **6** items fully complete
- **1** item needs fixing (5 minutes)
- **1** item ready to delete (optional)
- **0** production code breaking changes
- **0** runtime crashes from migration

---

## Files Involved

### Critical (Must Fix)
- `src/components/__tests__/SessionDetailView.integration.test.tsx` (Lines 38-42)

### Optional (Can Delete)
- `src/components/MorphingMenuButton.tsx`

### No Action Needed
- `src/context/NotesContext.tsx` - Method removed, documented
- `src/context/TasksContext.tsx` - Method removed, documented
- `src/types.ts` - Field removed, backward compatible fallback in place
- `src/App.tsx` - Documentation updated
- All backup files (`*.bak*`, `*.backup`)

---

## Completion Checklist

- [ ] Read full report (PHASE_2_MIGRATION_VERIFICATION_REPORT.md)
- [ ] Fix SessionDetailView test mock (5 min)
- [ ] Verify test passes: `npm test -- SessionDetailView.integration`
- [ ] (Optional) Delete MorphingMenuButton.tsx (2 min)
- [ ] (Optional) Delete backup files (5 min)

---

## Questions?

Refer to the full report: `PHASE_2_MIGRATION_VERIFICATION_REPORT.md`

All items documented with:
- Exact file locations
- Line numbers
- Evidence/verification results
- Recommended fixes with code examples
- Risk assessment
