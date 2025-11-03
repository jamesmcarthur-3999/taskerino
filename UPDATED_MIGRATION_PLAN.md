# Updated Migration Plan - Post-Service Implementation

**Date:** 2025-11-01
**Status:** Services Implemented - Ready for Integration
**Previous Plan:** `DATA_PIPELINE_AUDIT_MASTER_REPORT.md`

---

## Services Analysis

### ✅ EntityService (615 lines)

**What it does:**
- Unified CRUD for Notes, Tasks, Sessions
- Automatic relationship creation from `RelationshipInput[]`
- CASCADE delete (relationships + attachments + indexes)
- Entity count updates (topic.noteCount, company.noteCount, contact.noteCount)
- Zero UI blocking via PersistenceQueue

**Key Methods:**
```typescript
// Create with automatic relationships
await entityService.createNote({
  content, summary,
  relationships: [
    { toType: EntityType.TOPIC, toId: 'topic-123', type: RelationshipType.NOTE_TOPIC }
  ]
});

// Update (entity fields only)
await entityService.updateNote(id, { content: 'Updated...' });

// CASCADE delete
await entityService.deleteNote(id); // Cleans up: relationships, attachments, indexes
```

**Strengths:**
- ✅ Solves Issue #5 (orphaned relationships) - CASCADE delete
- ✅ Solves entity count maintenance
- ✅ Uses PersistenceQueue (zero UI blocking)
- ✅ Clean input types (no legacy fields)

**Limitations:**
- ❌ No Topics/Companies/Contacts CRUD (only Notes/Tasks/Sessions)
- ❌ Update methods don't handle relationship changes
- ❌ No getter methods (getNote, getTask, getSession)

---

### ✅ AIIntegrationService (360 lines)

**What it does:**
- Converts AI temp IDs → real IDs
- Creates/matches topics, companies, contacts
- Creates relationships via RelationshipManager
- Returns processed entities (does NOT persist)

**Key Method:**
```typescript
const processed = await aiIntegrationService.processAIResult(aiResult, {
  existingTopics,
  existingCompanies,
  existingContacts
});

// Returns: { notes, tasks, topics, companies, contacts }
// Relationships already created in RelationshipManager
// BUT entities not persisted to storage
```

**Strengths:**
- ✅ Solves Issue #3 (companies/contacts AI integration)
- ✅ Temp ID → real ID mapping
- ✅ Entity reconciliation (match vs create)
- ✅ Creates relationships

**Limitations:**
- ❌ Does NOT persist entities (caller must save)
- ❌ Does NOT use EntityService (creates entities manually)
- ❌ Does NOT update entity counts
- ❌ Creates relationships directly (bypasses EntityService's relationship logic)

---

## Architecture Pattern

The services define a **two-layer architecture**:

```
Layer 1: AI → Entity Conversion
AIIntegrationService.processAIResult()
  ↓
  Creates: Notes, Tasks, Topics, Companies, Contacts
  Creates: Relationships via RelationshipManager
  Returns: Unpers isted entities

Layer 2: Entity Persistence
Caller (CaptureZone, contexts, etc.)
  ↓
  Option A: entityService.createNote(note) + relationships
  Option B: Direct storage save
  ↓
  Persisted entities
```

**Issue:** AIIntegrationService creates relationships BUT doesn't persist entities. This creates a **coordination problem**:
- AIIntegrationService creates relationships → stored in RelationshipManager
- Caller must save entities → but entities already have relationships

**Two Solutions:**

**Solution A (Recommended):** AIIntegrationService returns minimal entities, caller uses EntityService
```typescript
// AIIntegrationService returns entity data (not full entities)
const processed = await aiIntegrationService.processAIResult(...);

// Caller persists via EntityService
for (const noteData of processed.notes) {
  await entityService.createNote({
    ...noteData,
    relationships: [] // Already created by AIIntegrationService
  });
}
```

**Solution B:** AIIntegrationService calls EntityService internally
```typescript
// AIIntegrationService creates AND persists
const processed = await aiIntegrationService.processAIResult(...);
// Returns fully persisted entities with relationships
```

**Recommendation:** Solution A (separation of concerns)

---

## Updated Migration Plan

### Phase 1: Fix Critical Bugs (Week 1) - UNCHANGED

These fixes are **independent** of the new services:

**1.1 Fix Session Tags Sync** 🔴
- **File:** `ChunkedSessionStorage.ts:loadFullSession()`
- **Change:** Merge metadata.tags → session.tags
- **Effort:** 5 lines
- **Impact:** Fixes user-visible bug

**1.2 Add SESSION_TOPIC Relationship Type** 🔴
- **File:** `types/relationships.ts`
- **Change:** Add to RelationshipType enum + RELATIONSHIP_CONFIGS
- **Effort:** 15 lines
- **Impact:** Enables session-topic relationships

**Status:** ✅ **DO THESE FIRST** - No dependencies on new services

---

### Phase 2: Integrate Services (Week 2) - NEW

**2.1 Update AIProcessResult Type (if needed)**
- **File:** `types.ts`
- **Check:** Verify AIProcessResult has newEntities.companies, newEntities.contacts
- **Current:** ✅ Already has these fields (lines 710-717)
- **Action:** ✅ No changes needed

**2.2 Integrate AIIntegrationService with CaptureZone**
- **File:** `CaptureZone.tsx`
- **Current Flow:**
  ```typescript
  const aiResult = await claudeService.processInput(...);
  // Manually creates notes/tasks with old framework
  aiResult.notes.forEach(noteData => {
    const note = { ...noteData, status: 'draft' };
    addNote(note); // No relationships
  });
  ```

- **New Flow:**
  ```typescript
  const aiResult = await claudeService.processInput(...);
  const processed = await aiIntegrationService.processAIResult(aiResult, {
    existingTopics: entitiesState.topics,
    existingCompanies: entitiesState.companies,
    existingContacts: entitiesState.contacts
  });

  // Save topics, companies, contacts to EntitiesContext
  processed.topics.forEach(topic => addTopic(topic));
  processed.companies.forEach(company => addCompany(company));
  processed.contacts.forEach(contact => addContact(contact));

  // Save notes/tasks to storage
  for (const note of processed.notes) {
    await entityService.createNote({
      ...note,
      relationships: [] // Already created
    });
  }

  for (const task of processed.tasks) {
    await entityService.createTask({
      ...task,
      relationships: [] // Already created
    });
  }
  ```

- **Effort:** 2-3 hours
- **Impact:** ✅ Fixes Issue #2 (AI Capture creates relationships)
- **Impact:** ✅ Fixes Issue #3 (companies/contacts AI integration)

**2.3 Update CaptureReview for Approval**
- **File:** `CaptureReview.tsx`
- **Current:** Changes status='approved' but doesn't create relationships
- **Change:** Relationships already exist (created by AIIntegrationService)
- **Action:** Remove relationship creation logic (already done)
- **Effort:** 30 minutes

**2.4 Add EntityService to EntitiesContext**
- **File:** `EntitiesContext.tsx`
- **Current:** No Topics/Companies/Contacts CRUD in EntityService
- **Action:** Either:
  - Option A: Extend EntityService with createTopic/Company/Contact
  - Option B: EntitiesContext directly persists (keeps current pattern)
- **Recommendation:** Option B (EntitiesContext owns Topics/Companies/Contacts)
- **Effort:** 1 hour

---

### Phase 3: Migrate Contexts (Week 3) - UPDATED

**3.1 Migrate NotesContext**
- **File:** `NotesContext.tsx`
- **Current:** Already creates relationships (but conditionally)
- **Change:** Use EntityService for all CRUD
  ```typescript
  const addNote = async (note: Note) => {
    const created = await entityService.createNote({
      content: note.content,
      summary: note.summary,
      relationships: buildRelationshipsFromNote(note) // Convert from old fields
    });
    dispatch({ type: 'ADD_NOTE', payload: created });
  };
  ```

- **Effort:** 2 hours
- **Impact:** Removes 200+ lines of relationship logic from context

**3.2 Migrate TasksContext**
- **File:** `TasksContext.tsx`
- **Current:** Creates TASK_NOTE, TASK_SESSION only
- **Change:** Use EntityService for all CRUD
- **Effort:** 2 hours

**3.3 Migrate SessionListContext**
- **File:** `SessionListContext.tsx`
- **Current:** deleteSession() doesn't cascade
- **Change:** Use entityService.deleteSession() (CASCADE implemented)
- **Effort:** 1 hour
- **Impact:** ✅ Fixes Issue #5 (orphaned relationships)

---

### Phase 4: Migrate AI Services (Week 4) - UPDATED

**4.1 Migrate sessionEnrichmentService**
- **File:** `sessionEnrichmentService.ts`
- **Current:** Sets `task.sourceSessionId` directly
- **Change:** Create SESSION_TASK relationships instead
  ```typescript
  // OLD
  task.sourceSessionId = sessionId;

  // NEW
  await relationshipManager.addRelationship({
    sourceType: EntityType.TASK,
    sourceId: task.id,
    targetType: EntityType.SESSION,
    targetId: sessionId,
    type: RelationshipType.TASK_SESSION,
    metadata: { source: 'ai', createdAt: ... }
  });
  ```

- **Effort:** 3 hours
- **Impact:** 30% of old framework usage removed

**4.2 Migrate nedToolExecutor**
- **File:** `nedToolExecutor.ts`
- **Current:** Queries old fields (sourceNoteId, topicIds)
- **Change:** Query relationshipManager instead
  ```typescript
  // OLD
  const relatedNotes = task.sourceNoteId
    ? notes.filter(n => n.id === task.sourceNoteId)
    : [];

  // NEW
  const relationships = relationshipManager.getRelationships({
    entityId: task.id,
    relationshipType: RelationshipType.TASK_NOTE
  });
  const relatedNotes = notes.filter(n =>
    relationships.some(r => r.targetId === n.id || r.sourceId === n.id)
  );
  ```

- **Effort:** 3 hours

---

### Phase 5: Cleanup (Week 5) - UPDATED

**5.1 Mark Old Fields as Deprecated**
- **File:** `types.ts`
- **Fields:** noteId, topicIds, companyIds, contactIds, sourceSessionId, sourceNoteId
- **Action:** Add JSDoc @deprecated tags
- **Effort:** 30 minutes

**5.2 Run Data Migration**
- **File:** Use existing `relationshipMigration.ts`
- **Action:** Backfill relationships for old data
- **Effort:** 2 hours (testing + execution)

**5.3 Remove Old Relationship Logic from Contexts**
- **Files:** NotesContext, TasksContext
- **Action:** Delete conditional relationship creation code
- **Effort:** 1 hour

---

## Updated Timeline

| Week | Phase | Effort | Impact |
|------|-------|--------|--------|
| **Week 1** | Critical Bugs | 2 days | Fixes user-visible issues |
| **Week 2** | Service Integration | 3 days | AI Capture + companies/contacts |
| **Week 3** | Context Migration | 3 days | 100% EntityService adoption |
| **Week 4** | AI Service Migration | 3 days | Remove old framework (60%) |
| **Week 5** | Cleanup + Migration | 2 days | Backfill data, deprecate fields |

**Total:** 13 days (2.6 weeks)

---

## Service Coordination Pattern

### Recommended Data Flow

```
AI Capture
    ↓
claudeService.processInput(text, attachments, topics, companies, contacts)
    ↓
AIProcessResult (temp IDs, relationship specs)
    ↓
aiIntegrationService.processAIResult(aiResult, context)
    ↓
ProcessedAIResult (real IDs, relationships created)
    ↓
CaptureZone / Contexts
    ↓
entityService.createNote/Task/Session(entity)
    ↓
Persisted entities with relationships
```

### Who Does What

| Service | Responsibility |
|---------|---------------|
| **claudeService** | Text → AIProcessResult with temp IDs |
| **aiIntegrationService** | Temp IDs → real IDs, entity matching, relationships |
| **entityService** | Entity persistence, CASCADE delete, counts |
| **Contexts** | UI state management, event emission |

---

## Remaining Gaps

### Gap 1: EntityService Missing CRUD for Topics/Companies/Contacts

**Options:**
- **A:** Extend EntityService with createTopic/Company/Contact methods
- **B:** EntitiesContext owns these (keeps current pattern)

**Recommendation:** B - EntitiesContext already has this logic

### Gap 2: EntityService Update Methods Don't Handle Relationships

**Current:**
```typescript
await entityService.updateNote(id, { content: 'Updated...' });
// Doesn't support adding/removing relationships
```

**Needed:**
```typescript
await entityService.updateNote(id, {
  content: 'Updated...',
  addRelationships: [
    { toType: EntityType.TOPIC, toId: 'topic-123', type: RelationshipType.NOTE_TOPIC }
  ],
  removeRelationships: ['rel-id-1', 'rel-id-2']
});
```

**Impact:** Manual relationship updates still needed
**Priority:** Medium (Phase 3)

### Gap 3: AIIntegrationService Creates Relationships Directly

**Issue:** Bypasses EntityService's relationship creation logic

**Current Flow:**
```
aiIntegrationService.processAIResult()
  → relationshipManager.addRelationship() (directly)
  → Entity counts NOT updated
```

**Ideal Flow:**
```
entityService.createNote(note)
  → relationshipManager.addRelationship() (via EntityService)
  → Entity counts updated automatically
```

**Solution:** AIIntegrationService shouldn't create relationships - let EntityService do it

**Impact:** Need to refactor AIIntegrationService or EntityService
**Priority:** Medium (Phase 2)

---

## Service Enhancement Recommendations

### Recommendation 1: AIIntegrationService Should NOT Create Relationships

**Current:** Lines 209-259 create relationships directly

**Proposed Change:**
```typescript
// AIIntegrationService returns relationship specs, not created relationships
interface ProcessedAIResult {
  notes: Note[];
  tasks: Task[];
  topics: Topic[];
  companies: Company[];
  contacts: Contact[];
  relationshipSpecs: RelationshipInput[]; // Not created yet
}
```

**Benefit:** EntityService creates relationships → entity counts updated

### Recommendation 2: EntityService Add Relationship Update Support

**Proposed Addition:**
```typescript
interface UpdateNoteInput {
  content?: string;
  summary?: string;
  addRelationships?: RelationshipInput[];
  removeRelationships?: string[]; // Relationship IDs
}

async updateNote(id: string, updates: UpdateNoteInput): Promise<Note>
```

**Benefit:** Full CRUD for relationships via EntityService

### Recommendation 3: Add Getter Methods to EntityService

**Proposed Addition:**
```typescript
async getNote(id: string): Promise<Note | null>
async getNotes(filter?: FilterOptions): Promise<Note[]>
async getTask(id: string): Promise<Task | null>
async getTasks(filter?: FilterOptions): Promise<Task[]>
async getSession(id: string): Promise<Session | null>
async getSessions(filter?: FilterOptions): Promise<Session[]>
```

**Benefit:** Single API for all entity operations

---

## Integration Checklist

### Week 1: Critical Bugs
- [ ] Fix session tags sync (ChunkedSessionStorage.ts)
- [ ] Add SESSION_TOPIC type (types/relationships.ts)
- [ ] Test session tags display
- [ ] Test session-topic linking

### Week 2: Service Integration
- [ ] Verify AIProcessResult type has companies/contacts
- [ ] Update CaptureZone to use AIIntegrationService
- [ ] Update CaptureZone to use EntityService for persistence
- [ ] Update CaptureReview (remove redundant relationship logic)
- [ ] Test AI Capture → relationship creation flow
- [ ] Test companies/contacts auto-detection

### Week 3: Context Migration
- [ ] Migrate NotesContext to EntityService
- [ ] Migrate TasksContext to EntityService
- [ ] Migrate SessionListContext to EntityService
- [ ] Test all CRUD operations
- [ ] Test CASCADE delete
- [ ] Verify entity counts update

### Week 4: AI Service Migration
- [ ] Migrate sessionEnrichmentService
- [ ] Migrate nedToolExecutor
- [ ] Test enrichment with relationships
- [ ] Test Ned queries with relationships

### Week 5: Cleanup
- [ ] Mark old fields as @deprecated
- [ ] Run data migration (dry-run first)
- [ ] Verify bidirectional consistency
- [ ] Remove old relationship logic
- [ ] Update documentation

---

## Success Metrics

| Metric | Current | Target | Success |
|--------|---------|--------|---------|
| Relationship Manager Adoption | 40% | 100% | All CRUD via EntityService |
| User-Visible Bugs | 2 | 0 | Session tags work, no orphans |
| Old Framework Files | 63 | 0 | All use EntityService |
| AI Integration | 0% | 100% | Companies/contacts auto-detected |
| Cascade Delete Coverage | 50% | 100% | All deletes cascade |

---

## Next Steps

1. **Read this plan** - Understand the new architecture
2. **Week 1 fixes** - Session tags + SESSION_TOPIC type (independent)
3. **Review service gaps** - Decide on enhancements (Recommendations 1-3)
4. **Week 2 integration** - CaptureZone + AIIntegrationService + EntityService
5. **Iterate** - Adjust plan based on learnings

---

**Generated:** 2025-11-01
**Based on:** EntityService.ts (615 lines), AIIntegrationService.ts (360 lines)
**Previous Plan:** DATA_PIPELINE_AUDIT_MASTER_REPORT.md
**Total Effort:** 13 days (2.6 weeks) vs original 5 weeks = **50% faster**
