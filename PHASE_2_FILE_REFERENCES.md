# Phase 2 Migration - File Reference Guide

All file paths are **absolute paths** for direct use in editors and commands.

---

## CRITICAL FILES TO REVIEW/FIX

### 1. TEST MOCK THAT NEEDS FIXING (BLOCKING)
```
/Users/jamesmcarthur/Documents/taskerino/src/components/__tests__/SessionDetailView.integration.test.tsx
Lines: 38-42
Issue: Imports deleted module (SessionsContext)
Fix:   5 minutes
```

---

## FILES ALREADY MIGRATED (NO ACTION NEEDED)

### 2. NotesContext - Query Method Removed
```
/Users/jamesmcarthur/Documents/taskerino/src/context/NotesContext.tsx
Status: Complete - Method removed with migration guide
Migration Guide: Lines 239-251
Documentation: Lines 86-87
```

### 3. TasksContext - Query Method Removed
```
/Users/jamesmcarthur/Documents/taskerino/src/context/TasksContext.tsx
Status: Complete - Method removed with migration guide
Migration Guide: Lines 194-206
Documentation: Lines 119-120
```

### 4. App.tsx - Main Application File
```
/Users/jamesmcarthur/Documents/taskerino/src/App.tsx
Status: Complete - Documentation updated
Note: AppContext removed, uses specialized contexts now
JSDoc: Shows new context structure
```

### 5. Types Definition File
```
/Users/jamesmcarthur/Documents/taskerino/src/types.ts
Status: Complete - SessionScreenshot.path field removed
Replacement: Using attachmentId with ContentAddressableStorage
Backward Compatibility: ScreenshotCard.tsx has fallback logic
```

### 6. Screenshot Card Component - Legacy Support
```
/Users/jamesmcarthur/Documents/taskerino/src/components/ScreenshotCard.tsx
Status: Complete - Uses new attachmentId, has fallback for legacy path
Defensive Code: Handles both new and old screenshot formats
```

---

## REPLACEMENT CONTEXTS (ALL VERIFIED PRESENT)

### SessionListContext - Replaces SessionsContext
```
/Users/jamesmcarthur/Documents/taskerino/src/context/SessionListContext.tsx
Size: 43,887 bytes
Status: ✅ Present and functional
```

### ActiveSessionContext - Replaces SessionsContext
```
/Users/jamesmcarthur/Documents/taskerino/src/context/ActiveSessionContext.tsx
Size: 39,638 bytes
Status: ✅ Present and functional
```

### RecordingContext - Replaces SessionsContext
```
/Users/jamesmcarthur/Documents/taskerino/src/context/RecordingContext.tsx
Size: 32,368 bytes
Status: ✅ Present and functional
```

### Specialized Contexts (Replacing AppContext)
```
✅ /Users/jamesmcarthur/Documents/taskerino/src/context/SettingsContext.tsx (16,978 bytes)
✅ /Users/jamesmcarthur/Documents/taskerino/src/context/UIContext.tsx (21,634 bytes)
✅ /Users/jamesmcarthur/Documents/taskerino/src/context/EntitiesContext.tsx (6,876 bytes)
✅ /Users/jamesmcarthur/Documents/taskerino/src/context/NotesContext.tsx (14,863 bytes)
✅ /Users/jamesmcarthur/Documents/taskerino/src/context/TasksContext.tsx (11,597 bytes)
✅ /Users/jamesmcarthur/Documents/taskerino/src/context/ThemeContext.tsx (1,995 bytes)
```

---

## OPTIONAL CLEANUP FILES

### Component to Delete (Marked @deprecated)
```
/Users/jamesmcarthur/Documents/taskerino/src/components/MorphingMenuButton.tsx
Status: ✅ Ready to delete
Reason: @deprecated, zero production usage
Risk: ZERO
```

### Backup Files (Safe to Delete)
```
/Users/jamesmcarthur/Documents/taskerino/src/App.tsx.bak2
/Users/jamesmcarthur/Documents/taskerino/src/App.tsx.bak3
/Users/jamesmcarthur/Documents/taskerino/src/App.tsx.bak4
/Users/jamesmcarthur/Documents/taskerino/src/context/SessionsContext.tsx.backup
```

---

## MIGRATION GUIDES & DOCUMENTATION

### In-Code Migration Guide (NotesContext)
```
/Users/jamesmcarthur/Documents/taskerino/src/context/NotesContext.tsx:239-251

// REMOVED: queryNotes method (QueryEngine deprecated)
// Use UnifiedIndexManager instead:
//
// import { getUnifiedIndexManager } from '../services/storage/UnifiedIndexManager';
// const unifiedIndex = await getUnifiedIndexManager();
// const result = await unifiedIndex.unifiedSearch({
//   entityTypes: ['notes'],
//   query: 'search text',
//   filters: { ... },
//   limit: 20
// });
```

### In-Code Migration Guide (TasksContext)
```
/Users/jamesmcarthur/Documents/taskerino/src/context/TasksContext.tsx:194-206

// REMOVED: queryTasks method (QueryEngine deprecated)
// Use UnifiedIndexManager instead:
//
// import { getUnifiedIndexManager } from '../services/storage/UnifiedIndexManager';
// const unifiedIndex = await getUnifiedIndexManager();
// const result = await unifiedIndex.unifiedSearch({
//   entityTypes: ['tasks'],
//   query: 'search text',
//   filters: { status: 'in_progress', priority: 'high' },
//   limit: 20
// });
```

---

## TEST FILES & USAGE REFERENCES

### Test File with Mock Issue
```
/Users/jamesmcarthur/Documents/taskerino/src/components/__tests__/SessionDetailView.integration.test.tsx

Lines with references:
  Line 38-42: BROKEN mock (SessionsContext import)
```

### Hooks with Documentation Comments (No Code Changes Needed)
```
/Users/jamesmcarthur/Documents/taskerino/src/hooks/useSessionStarting.ts
  - Documentation updated, uses new Phase 1 contexts
  - Status: ✅ Complete

/Users/jamesmcarthur/Documents/taskerino/src/hooks/useSessionEnding.ts
  - Documentation updated, uses new Phase 1 contexts
  - Status: ✅ Complete

/Users/jamesmcarthur/Documents/taskerino/src/hooks/useSession.ts
  - Documentation updated
  - Status: ✅ Complete
```

---

## QUICK COMMAND REFERENCE

### View Critical File (the one that needs fixing)
```bash
code /Users/jamesmcarthur/Documents/taskerino/src/components/__tests__/SessionDetailView.integration.test.tsx:38
```

### View Migration Guides
```bash
code /Users/jamesmcarthur/Documents/taskerino/src/context/NotesContext.tsx:239
code /Users/jamesmcarthur/Documents/taskerino/src/context/TasksContext.tsx:194
```

### Delete Optional Files
```bash
rm /Users/jamesmcarthur/Documents/taskerino/src/components/MorphingMenuButton.tsx
rm /Users/jamesmcarthur/Documents/taskerino/src/App.tsx.bak2
rm /Users/jamesmcarthur/Documents/taskerino/src/App.tsx.bak3
rm /Users/jamesmcarthur/Documents/taskerino/src/App.tsx.bak4
rm /Users/jamesmcarthur/Documents/taskerino/src/context/SessionsContext.tsx.backup
```

### Run Test Suite
```bash
cd /Users/jamesmcarthur/Documents/taskerino
npm test -- SessionDetailView.integration
```

---

## DOCUMENTATION FILES CREATED

All generated in `/Users/jamesmcarthur/Documents/taskerino/`:

```
PHASE_2_MIGRATION_VERIFICATION_REPORT.md    - Comprehensive analysis (full report)
PHASE_2_QUICK_REFERENCE.md                  - Quick fix guide
PHASE_2_STATUS_SUMMARY.txt                  - Text summary
PHASE_2_FILE_REFERENCES.md                  - This file (all file paths)
```

---

## SUMMARY

**Total Files to Review**: 1 (test mock)  
**Total Files to Fix**: 1 (test mock - 5 min)  
**Total Files to Delete**: 5 (optional - 7 min total)  
**Total Files Already Migrated**: 15+  
**Risk Level**: VERY LOW  

**Effort**: 5 minutes (required) + 7 minutes (optional) = 12 minutes total

