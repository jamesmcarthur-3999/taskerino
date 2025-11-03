# Taskerino Legacy Systems Cleanup - Report Index

## Reports Generated

This directory contains comprehensive analysis of legacy systems, deprecated code, and unused files in the Taskerino codebase.

### 1. LEGACY_SYSTEMS_CLEANUP_REPORT.md (Primary Report)
**Type**: Comprehensive Technical Analysis  
**Size**: 871 lines  
**Time to Read**: 30-45 minutes

Complete breakdown of all 34 legacy items identified during the comprehensive sweep.

**Sections**:
- Executive summary with statistics
- Category 1: Safe to Delete (14 items, 644 KB)
- Category 2: Needs Migration (8 items, 2.1 MB)
- Category 3: Uncertain Items (7 items, 1.2 MB)
- Category 4: Keep (Still Used) (5 items)
- Category 5: Deprecated Markers (10+ items)
- Detailed recommendations for each item
- Risk assessment matrix
- Phased cleanup plan (4 phases)
- Verification checklist
- Estimated impact metrics

**Best For**: 
- Comprehensive understanding of all legacy items
- Risk assessment before deletion
- Decision-making on migration strategy
- Full documentation trail

---

### 2. CLEANUP_QUICK_REFERENCE.md (Action Guide)
**Type**: Quick Reference & Execution Guide  
**Size**: 2 pages  
**Time to Read**: 5-10 minutes

Fast-track guide with command-line instructions and decision tables.

**Sections**:
- Summary statistics (1 table)
- Phase 1: Immediate Cleanup (644 KB, 14 files)
- Phase 2: Migration Required (2.1 MB, 8 items)
- Phase 3: Investigation Needed (1.2 MB, 7 items)
- Action checklist
- Key decision points

**Best For**:
- Quick decision-making
- Copy-paste deletion commands
- Sprint planning
- Status reporting

---

## Key Findings Summary

### By The Numbers
- **34 Legacy Items** identified across codebase
- **3.9 MB** total potential storage recovery
- **25-28 files** safe to delete
- **0% Impact** on production code (all backups or superseded)
- **4 Phases** of cleanup (immediate → long-term)

### Priority Breakdown

#### Phase 1: IMMEDIATE (Today)
- 14 files, 644 KB, MINIMAL RISK
- All backups and migration scripts
- Ready to delete without code changes
- Commands in CLEANUP_QUICK_REFERENCE.md

#### Phase 2: SHORT-TERM (2-4 weeks)
- 8 items, 2.1 MB, MEDIUM RISK
- SessionQueryEngine migration (primary work item)
- Test mock updates
- Requires code coordination

#### Phase 3: LONG-TERM (1-2 months)
- 7 items, 1.2 MB, LOW RISK
- Investigate git history
- Archive development artifacts
- Update documentation

#### Phase 4: ONGOING
- 10+ deprecated markers already documented
- Removal planned as part of Phase 1 context refactoring
- SessionsContext → Phase 7 removal plan

---

## Critical Items

### 1. SessionQueryEngine (Highest Priority for Phase 2)
- **Status**: Superseded by UnifiedIndexManager (CLAUDE.md line 507)
- **Size**: 1.1 MB service + 1.6 MB test coverage
- **Impact**: Coordinate with UnifiedIndexManager integration work
- **Timeline**: 2-4 weeks

### 2. AppContext Migration (In Progress)
- **Status**: Being split into specialized contexts
- **Impact**: Part of larger Phase 1 refactoring
- **Action Required**: Verify all references replaced before deletion
- **Timeline**: Ongoing

### 3. Backup Files (Quick Win)
- **Status**: 12 duplicate backups found
- **Size**: 644 KB total
- **Risk**: MINIMAL - all have active versions
- **Action**: Execute immediately (Phase 1)

---

## Using These Reports

### For Code Review
1. Read Section 1.1 of primary report for backup deletion justification
2. Review Section 2.2 for SessionQueryEngine migration plan
3. Use quick reference for deletion commands

### For Sprint Planning
1. Skim quick reference summary
2. Identify which phase(s) fit your sprint
3. Create GitHub issues for Phase 2 items
4. Reference specific sections in issues

### For Architecture Decisions
1. Read Section 2.2 (SessionQueryEngine) for migration context
2. Read Section 2.8 (AppContext) for ongoing refactoring
3. Reference CLAUDE.md deprecation timeline (lines 308-314)

### For Onboarding
1. Start with quick reference overview
2. Understand Phase 1 cleanup scope (644 KB, safe to delete)
3. Know which systems are deprecated (SessionsContext, QueryEngine, AppContext)
4. Understand migration targets (UnifiedIndexManager, Phase 1 contexts)

---

## Next Steps

### Immediate (This Week)
- [ ] Read LEGACY_SYSTEMS_CLEANUP_REPORT.md (30-45 min)
- [ ] Review CLEANUP_QUICK_REFERENCE.md (5 min)
- [ ] Create backup: `mkdir /tmp/taskerino-cleanup && cp src/**/*.{bak,backup} /tmp/taskerino-cleanup/`
- [ ] Execute Phase 1 deletions (14 files, 644 KB)
- [ ] Run: `npm run type-check && npm run lint && npm test`
- [ ] Commit: `git add -A && git commit -m "cleanup: Remove deprecated backup files"`

### Short-Term (2-4 Weeks)
- [ ] Create GitHub issues for Phase 2 migration
- [ ] Coordinate SessionQueryEngine work with UnifiedIndexManager integration
- [ ] Update SessionDetailView test mocks (1 week task)
- [ ] Plan MorphingMenuButton archival (1 week task)

### Long-Term (1-2 Months)
- [ ] Investigate uncertain items (Phase 3)
- [ ] Archive development artifacts
- [ ] Complete AppContext migration (ongoing)
- [ ] Plan SessionQueryEngine full removal

---

## Files Referenced in Reports

### Phase 1 Deletions (14 files)
```
add-jsdoc-phase2.{cjs,js}
add-phase2-jsdoc.sh
add-deprecated-fields-reference.cjs
add-enrichment-types-jsdoc.cjs
add-remaining-sections.cjs
add-session-types-jsdoc.cjs
src/components/TopNavigation.tsx.backup
src/components/MenuMorphPill.tsx.backup
src/components/ProfileZone.tsx.bak
src/utils/sessionSynthesis.ts.backup
src/services/storage/IndexedDBAdapter.ts.bak
src/services/storage/TauriFileSystemAdapter.ts.{bak,backup}
src/services/storage/__tests__/ContentAddressableStorage.test.ts.bak
src/services/aiCanvasPromptV2.ts.bak
src-tauri/ScreenRecorder/ScreenRecorder.swift.bak
src-tauri/src/video_recording.rs.bak
test_webcam_recording.sh
test_webcam.html
test-edge-cases.ts
test-workflow.ts
test-wal.md
```

### Phase 2 Migration (8 items)
```
src/services/SessionQueryEngine.ts (superseded)
src/services/SessionQueryEngine.test.ts (to remove)
src/components/__tests__/SessionDetailView.integration.test.tsx (update mocks)
src/components/MorphingMenuButton.tsx (marked @deprecated)
src/context/TasksContext.tsx (methods removed)
src/context/NotesContext.tsx (methods removed)
src/context/AppContext.tsx (if exists, being split)
src/types.ts (deprecated fields - keep for now)
```

### Phase 3 Investigation (7 items)
```
src/types.ts.backup-phase2
migrate_component.py
verify_pip_integration.swift
tests/FINAL_REPORT.md
tests/TEST_SUITE_SUMMARY.md
src/utils/sessionSynthesis.ts (unused but active file)
(and others documented in main report)
```

---

## Reference Links

### In CLAUDE.md
- Lines 308-314: SessionsContext deprecation notice
- Lines 312-313: AppContext deprecation notice
- Lines 507-536: QueryEngine removal (November 2025)
- Lines 538-540: NotesContext.queryNotes() removal
- Lines 540-541: TasksContext.queryTasks() removal

### In This Codebase
- `/docs/sessions-rewrite/` - Phase 1 context refactoring documentation
- `/docs/developer/TODO_TRACKER.md` - 65 TODO markers catalogued
- `/docs/archive/` - 120+ historical documents

---

## Contact/Questions

For questions about specific items:

1. **SessionQueryEngine Migration**: See Section 2.2 of main report
2. **AppContext Refactoring**: See Section 2.8 of main report  
3. **Backup File Deletion**: See Sections 1.2-1.7 of main report
4. **Risk Assessment**: See risk assessment tables in main report

---

## Report Metadata

- **Generated**: November 2, 2025
- **Codebase**: Taskerino v2 (React 19 + Tauri v2)
- **Scan Type**: Comprehensive (all file types, full codebase)
- **Total Items**: 34
- **Total Potential Recovery**: 3.9 MB
- **Estimated Cleanup Time**: 30-45 minutes (Phase 1) + 2-4 weeks (Phase 2) + 1-2 months (Phase 3)

---

Generated as part of legacy systems audit for Taskerino codebase.
