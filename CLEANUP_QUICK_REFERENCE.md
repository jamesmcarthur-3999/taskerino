# TASKERINO LEGACY CLEANUP - QUICK REFERENCE

## Summary Statistics

| Category | Count | Size | Priority | Timeline |
|----------|-------|------|----------|----------|
| Safe to Delete | 14 files | 644 KB | HIGH | Immediate |
| Needs Migration | 8 items | 2.1 MB | MEDIUM | 2-4 weeks |
| Uncertain | 7 items | 1.2 MB | LOW | 1-2 months |
| **TOTAL RECOVERY** | **29 items** | **3.9 MB** | - | **Phased** |

---

## Phase 1: IMMEDIATE CLEANUP (644 KB)

### 1. Migration Scripts (7 files, 49 KB)
All Phase 2 JSDoc scripts - already executed, safe to delete:
```bash
rm add-jsdoc-phase2.{cjs,js}
rm add-phase2-jsdoc.sh
rm add-deprecated-fields-reference.cjs
rm add-enrichment-types-jsdoc.cjs
rm add-remaining-sections.cjs
rm add-session-types-jsdoc.cjs
```

### 2. Component Backups (4 files, 176 KB)
```bash
rm src/components/TopNavigation.tsx.backup
rm src/components/MenuMorphPill.tsx.backup
rm src/components/ProfileZone.tsx.bak
rm src/utils/sessionSynthesis.ts.backup
```

### 3. Storage Adapter Backups (3 files, 176 KB)
```bash
rm src/services/storage/IndexedDBAdapter.ts.bak
rm src/services/storage/TauriFileSystemAdapter.ts.{bak,backup}
```

### 4. Test Backups & Ad-Hoc Files (8 files, 107 KB)
```bash
# Test backup
rm src/services/storage/__tests__/ContentAddressableStorage.test.ts.bak

# One-time test files
rm test_webcam_recording.sh test_webcam.html
rm test-edge-cases.ts test-workflow.ts test-wal.md

# Canvas prompt backup
rm src/services/aiCanvasPromptV2.ts.bak

# Tauri backups
rm src-tauri/ScreenRecorder/ScreenRecorder.swift.bak
rm src-tauri/src/video_recording.rs.bak
```

**Risk**: MINIMAL - No active references, all backups
**Testing**: `npm run type-check && npm run lint && npm test`

---

## Phase 2: MIGRATION REQUIRED (2.1 MB)

### 1. SessionQueryEngine (1.1 MB service + 1.6 MB test)
- Status: SUPERSEDED by UnifiedIndexManager
- Test file uses SessionQueryEngine in tests
- Action: Add @deprecated marker, update tests, then delete test file
- Timeline: 2-4 weeks (coordinate with UnifiedIndexManager migration)

### 2. SessionDetailView Integration Test (376 lines)
- Issue: Mocks deprecated SessionsContext
- Action: Update to mock Phase 1 contexts (SessionListContext, ActiveSessionContext)
- Timeline: 1 week

### 3. MorphingMenuButton.tsx (373 lines)
- Status: Already marked @deprecated
- No active references
- Action: Check git history, delete if >3 months unchanged
- Timeline: 1 week

### 4. AppContext (if exists)
- Status: Being split into specialized contexts
- Action: Verify references, migrate to specialized contexts
- Timeline: 2-4 weeks (part of larger refactoring)

### 5. NotesContext.queryNotes() & TasksContext.queryTasks()
- Status: Already removed from code
- Action: Clean up related code comments/references
- Timeline: 1 week

---

## Phase 3: INVESTIGATION NEEDED (1.2 MB)

### Files Needing Git History Check:
1. `src/types.ts.backup-phase2` (72 KB) - If types.ts stable, delete
2. `migrate_component.py` (7 KB) - Check last usage date
3. `verify_pip_integration.swift` (175 lines) - Determine if development artifact
4. Test documentation files - Move to docs/archive/ or keep

---

## Action Checklist

- [ ] Create backup: `mkdir /tmp/taskerino-cleanup && cp src/**/*.{bak,backup} /tmp/taskerino-cleanup/`
- [ ] Phase 1: Delete all 14 files
- [ ] Run: `npm run type-check && npm run lint && npm test`
- [ ] Commit: `git add -A && git commit -m "cleanup: Remove deprecated backup files and migration scripts"`
- [ ] Phase 2: Plan SessionQueryEngine migration with UnifiedIndexManager work
- [ ] Phase 2: Update SessionDetailView test mocks
- [ ] Phase 3: Investigate uncertain files and archive as needed

---

## Key Points

1. **No Code Functionality Affected** - All items are backups, scripts, or deprecated code
2. **SessionQueryEngine** - Main migration target, coordinate with UnifiedIndexManager
3. **AppContext** - Part of ongoing Phase 1 context refactoring
4. **Safety First** - Backup everything, test thoroughly, commit frequently

## Full Report

See `/Users/jamesmcarthur/Documents/taskerino/LEGACY_SYSTEMS_CLEANUP_REPORT.md` for:
- Detailed analysis of each item
- Risk assessment and mitigation strategies
- Complete deletion commands with explanations
- Phased cleanup plan with timelines
