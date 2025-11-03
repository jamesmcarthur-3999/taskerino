# Legacy Cleanup Plan - AI-Driven Relationships

**Date**: November 1, 2025
**Status**: Ready to Execute
**Data Loss**: Acceptable (test data only)
**UI Impact**: Zero (backend changes only)

---

## Executive Summary

**Goal**: Remove 8 legacy relationship fields, replace with single `relationships[]` array, let AI fully control relationship creation.

**Impact**:
- ✅ 40-50% fewer AI output tokens
- ✅ Codebase cut in half (800 → 150 lines per context)
- ✅ One way to do things (not 3 different patterns)
- ✅ AI-driven relationships (not hardcoded logic)
- ✅ Zero UI changes (backend only)

**Timeline**: 11-14 days

**Risk**: Low (no data to preserve, UI unchanged)

---

## What's Being Removed

### Legacy Fields (DELETE)

**Note:**
- `topicId?: string` - Single topic link
- `topicIds?: string[]` - Multiple topic links (inconsistent!)
- `companyIds?: string[]` - Company links
- `contactIds?: string[]` - Contact links
- `sourceSessionId?: string` - Session origin
- `relationshipVersion?: number` - Migration tracking

**Task:**
- `topicId?: string` - Single topic link
- `noteId?: string` - Note origin
- `sourceSessionId?: string` - Session origin
- `sourceNoteId?: string` - Duplicate of noteId
- `relationshipVersion?: number` - Migration tracking

**Session:**
- `extractedTaskIds?: string[]` - Tasks created from session
- `extractedNoteIds?: string[]` - Notes created from session
- `relationshipVersion?: number` - Migration tracking

### Legacy Code (DELETE)

**In Contexts:**
- Manual relationship creation logic (150+ lines per context)
- Cross-context entity count updates (100+ lines per context)
- Manual debouncing (50+ lines per context)
- Legacy field handling (50+ lines per context)
- Migration-related checks and fallbacks

**In Components:**
- CaptureZone manual entity creation (200+ lines)
- Topic matching/creation logic (duplicated in multiple places)
- ID assignment logic (duplicated)

**Total Deletion**: ~1,500+ lines of code

---

## What's Being Added

### New Services

**1. EntityService** (`src/services/EntityService.ts`)
- Unified CRUD API for all entities
- Automatic relationship creation
- Automatic entity count updates
- Cascade delete with cleanup
- Transaction support

**2. AIIntegrationService** (`src/services/AIIntegrationService.ts`)
- Converts AI output to entities
- Resolves temp IDs to real IDs
- Creates relationships as AI specifies
- Creates new topics/companies/contacts
- One function call replaces 200 lines

### Updated AI Output Format

**OLD Format:**
```json
{
  "notes": [{
    "content": "...",
    "topicAssociation": "Sarah",
    "tags": [...]
  }]
}
```

**NEW Format:**
```json
{
  "notes": [{
    "id": "note-1",
    "content": "...",
    "summary": "..."
  }],
  "tasks": [{
    "id": "task-1",
    "title": "..."
  }],
  "relationships": [
    {
      "from": { "type": "note", "id": "note-1" },
      "to": { "type": "topic", "name": "Sarah" },
      "relationType": "note-topic",
      "metadata": {
        "confidence": 0.95,
        "reasoning": "Note discusses meeting with Sarah"
      }
    },
    {
      "from": { "type": "task", "id": "task-1" },
      "to": { "type": "note", "id": "note-1" },
      "relationType": "task-note",
      "metadata": {
        "confidence": 0.9,
        "reasoning": "Task is follow-up from note"
      }
    }
  ],
  "newEntities": {
    "topics": [{ "name": "Sarah", "type": "person" }],
    "companies": [],
    "contacts": []
  }
}
```

**Benefits:**
- AI has full control over relationships
- Explicit, structured data (not vague associations)
- Can create ANY relationship type
- 40-50% fewer tokens (no verbose descriptions)

---

## Replacement Strategy

### Before (8 Fields):
```typescript
{
  topicId: "sarah",
  topicIds: ["sarah", "pricing"],
  companyIds: ["acme"],
  contactIds: ["john"],
  sourceSessionId: "session-456",
  noteId: "note-789",
  extractedTaskIds: ["task-1", "task-2"]
}
```

### After (1 Field):
```typescript
{
  relationships: [
    { type: "note-topic", targetId: "sarah", metadata: { source: "ai" } },
    { type: "note-topic", targetId: "pricing", metadata: { source: "ai" } },
    { type: "note-company", targetId: "acme", metadata: { source: "ai" } },
    { type: "note-contact", targetId: "john", metadata: { source: "ai" } },
    { type: "note-session", targetId: "session-456", metadata: { source: "system" } },
    { type: "task-note", targetId: "note-789", metadata: { source: "ai" } }
  ]
}
```

**All bidirectional** - RelationshipManager automatically creates inverse relationships.

---

## Implementation Phases

### Phase 1: Update AI Output Format (1 day)

**File**: `src/services/claudeService.ts`

**Tasks**:
1. Update system prompt to output new format
2. Add explicit relationship array to output schema
3. Add newEntities section for topic/company/contact creation
4. Update TypeScript types for new format
5. Test with sample input

**Outcome**: ClaudeService outputs new format (backward compatible - not used yet)

---

### Phase 2: Create AIIntegrationService (2 days)

**File**: `src/services/AIIntegrationService.ts` (NEW)

**Tasks**:
1. Create service class skeleton
2. Implement `processAIResult()` main function
3. Implement entity creation (topics, companies, contacts)
4. Implement temp ID → real ID mapping
5. Implement relationship creation from AI specs
6. Add comprehensive error handling
7. Write unit tests (>90% coverage)

**API**:
```typescript
const processed = await aiIntegrationService.processAIResult(aiResult);
// Returns: { notes: Note[], tasks: Task[], aiSummary: string }
```

**Outcome**: Service ready but not integrated yet

---

### Phase 3: Create EntityService (2-3 days)

**File**: `src/services/EntityService.ts` (NEW)

**Tasks**:
1. Create service class skeleton
2. Implement `createNote()` with relationship support
3. Implement `createTask()` with relationship support
4. Implement `createSession()` with relationship support
5. Implement `updateNote/Task/Session()`
6. Implement `deleteNote/Task/Session()` with cascade cleanup
7. Implement entity count updates
8. Add transaction support
9. Write unit tests (>90% coverage)

**API**:
```typescript
const note = await entityService.createNote({
  content: "...",
  summary: "...",
  relationships: [{ toType: "topic", toId: "123", type: "note-topic" }]
});

await entityService.deleteNote(noteId);  // Auto-cleanup
```

**Outcome**: Service ready but not integrated yet

---

### Phase 4: Delete Legacy Fields from Types (1 day)

**File**: `src/types.ts`

**Tasks**:
1. Remove legacy fields from Note interface
2. Remove legacy fields from Task interface
3. Remove legacy fields from Session interface
4. Make `relationships` required (not optional)
5. Remove `relationshipVersion` field
6. Remove `ManualNoteData.topicId` and related fields
7. Remove `ManualTaskData.topicId` and related fields
8. Update all type exports

**Expected**: TypeScript errors everywhere (good - we'll fix them)

**Outcome**: Types are clean, errors guide our refactoring

---

### Phase 5: Update CaptureZone Integration (1 day)

**File**: `src/components/CaptureZone.tsx`

**Tasks**:
1. Replace manual entity creation with `aiIntegrationService.processAIResult()`
2. Remove topic matching/creation logic (200+ lines)
3. Remove ID assignment logic
4. Remove manual relationship creation
5. Keep UI exactly as is
6. Test end-to-end (capture → AI → entities → display)

**Before**: 200+ lines of manual integration
**After**: 1 line service call

**Outcome**: CaptureZone uses new services, UI unchanged

---

### Phase 6: Simplify NotesContext (1 day)

**File**: `src/context/NotesContext.tsx`

**Tasks**:
1. Replace `addNote()` implementation with `entityService.createNote()`
2. Replace `deleteNote()` implementation with `entityService.deleteNote()`
3. Remove manual relationship creation logic (150+ lines)
4. Remove cross-context entity count updates (100+ lines)
5. Remove manual debouncing (use PersistenceQueue)
6. Remove legacy field handling
7. Keep PUBLIC API identical (same function signatures)
8. Test all operations

**Before**: 814 lines
**After**: ~150 lines

**Outcome**: Simpler context, same API, uses EntityService

---

### Phase 7: Simplify TasksContext (1 day)

**File**: `src/context/TasksContext.tsx`

**Tasks**:
1. Replace `addTask()` implementation with `entityService.createTask()`
2. Replace `deleteTask()` implementation with `entityService.deleteTask()`
3. Remove manual relationship creation logic (150+ lines)
4. Remove manual debouncing
5. Remove legacy field handling
6. Keep PUBLIC API identical
7. Test all operations

**Before**: 392 lines
**After**: ~120 lines

**Outcome**: Simpler context, same API, uses EntityService

---

### Phase 8: Simplify SessionListContext (1 day)

**File**: `src/context/SessionListContext.tsx`

**Tasks**:
1. Replace `addSession()` implementation with `entityService.createSession()`
2. Replace `deleteSession()` implementation with `entityService.deleteSession()`
3. Add automatic relationship creation (currently missing)
4. Remove legacy field handling
5. Keep PUBLIC API identical
6. Keep ChunkedSessionStorage integration (it's good!)
7. Test all operations

**Outcome**: Simpler context, consistent with Notes/Tasks

---

### Phase 9: Update ActiveSessionContext (1 day)

**File**: `src/context/ActiveSessionContext.tsx`

**Tasks**:
1. Remove legacy field assignments during session creation
2. Update session end logic to use EntityService
3. Remove extractedTaskIds/extractedNoteIds management
4. Keep all existing functionality
5. Test session lifecycle (start → pause → resume → end)

**Outcome**: Uses clean types, same behavior

---

### Phase 10: Clean Up Migration Code (1 day)

**Files**: Multiple

**Tasks**:
1. Remove all `relationshipVersion` checks
2. Remove all `@deprecated` comments
3. Delete migration scripts in `src/migrations/`
4. Update CLAUDE.md to remove migration sections
5. Remove RelationshipContext fallback checks ("may not be available")
6. Remove try-catch blocks for missing RelationshipContext
7. Clean up code comments referencing "legacy" or "migration"

**Outcome**: No traces of old system

---

### Phase 11: Testing & Validation (2 days)

**Tasks**:
1. Wipe IndexedDB completely
2. Test note creation via capture
3. Test task creation via capture
4. Test manual note creation
5. Test manual task creation
6. Test session creation and enrichment
7. Test relationship creation (all types)
8. Test cascade delete (verify cleanup)
9. Test entity counts stay in sync
10. Test AI integration end-to-end
11. Performance testing (ensure no regressions)
12. Check for any console errors

**Outcome**: Everything works, database clean, no errors

---

## Files Modified (Complete List)

### New Files (2)
- `src/services/EntityService.ts` (NEW)
- `src/services/AIIntegrationService.ts` (NEW)

### Modified Files (8)
- `src/types.ts` (remove legacy fields)
- `src/services/claudeService.ts` (update AI output format)
- `src/context/NotesContext.tsx` (simplify using EntityService)
- `src/context/TasksContext.tsx` (simplify using EntityService)
- `src/context/SessionListContext.tsx` (add relationships, use EntityService)
- `src/context/ActiveSessionContext.tsx` (remove legacy fields)
- `src/components/CaptureZone.tsx` (use AIIntegrationService)
- `CLAUDE.md` (remove migration documentation)

### Deleted Files (?)
- Any migration scripts in `src/migrations/` (if they exist)

---

## Rollback Plan

**If things go wrong:**

1. **Git branch**: All work done in feature branch `legacy-cleanup`
2. **Revert**: `git checkout main` to restore old system
3. **Database**: Already wiped, no data to restore

**Risk**: Low (no production data, can always revert code)

---

## Success Metrics

**Code Quality**:
- ✅ Single CRUD API (EntityService) for all entities
- ✅ Zero legacy fields in types
- ✅ Contexts reduced from 800 → 150 lines
- ✅ CaptureZone reduced by 200+ lines
- ✅ One way to create relationships (not 3)

**Data Integrity**:
- ✅ All relationships created via RelationshipManager
- ✅ All deletes cascade cleanup properly
- ✅ Entity counts always accurate
- ✅ No orphaned data

**AI Efficiency**:
- ✅ 40-50% fewer output tokens
- ✅ Explicit relationship control
- ✅ No vague associations

**User Experience**:
- ✅ Zero UI changes
- ✅ Everything works as before
- ✅ Actually more reliable (relationships always correct)

---

## Timeline

| Phase | Days | Files | Lines Changed |
|-------|------|-------|---------------|
| 1. AI Output Format | 1 | 1 | +100 |
| 2. AIIntegrationService | 2 | 1 (new) | +400 |
| 3. EntityService | 2-3 | 1 (new) | +600 |
| 4. Delete Legacy Fields | 1 | 1 | -50 |
| 5. Update CaptureZone | 1 | 1 | -200, +20 |
| 6. Simplify NotesContext | 1 | 1 | -650, +150 |
| 7. Simplify TasksContext | 1 | 1 | -270, +120 |
| 8. Simplify SessionListContext | 1 | 1 | -200, +50 |
| 9. Update ActiveSessionContext | 1 | 1 | -50 |
| 10. Clean Up Migration Code | 1 | Multiple | -200 |
| 11. Testing & Validation | 2 | - | - |
| **TOTAL** | **13-14 days** | **10 files** | **-1,520 / +1,440** |

**Net Result**: ~80 fewer lines, massively simpler code

---

## Key Principles

1. **AI Decides Relationships** - No hardcoded logic, AI specifies exactly what to link
2. **UI Unchanged** - Zero visual or behavioral changes from user perspective
3. **One Way to Do Things** - EntityService for all CRUD, no exceptions
4. **Complete Cleanup** - Delete ALL legacy code, no half-measures
5. **Data Loss Acceptable** - Wipe database, start fresh

---

## Next Steps

1. Create detailed todo list from this plan
2. Create feature branch: `git checkout -b legacy-cleanup`
3. Execute phases 1-11 in order
4. Test thoroughly
5. Merge to main
6. Delete feature branch

---

**Plan Status**: ✅ READY TO EXECUTE

**Estimated Completion**: November 15, 2025 (2 weeks from start)
