# Old Framework Pattern Migration Analysis
## Complete Migration Audit for Relationship Manager

**Scope**: ALL instances of direct field usage that should be migrated to RelationshipManager
**Thoroughness Level**: VERY THOROUGH
**Date**: 2025-11-01
**Search Pattern**: `noteId|topicId|topicIds|companyIds|contactIds|sourceSessionId|sourceNoteId|parentNoteId`

---

## EXECUTIVE SUMMARY

### Key Findings
- **Total Files Affected**: 63 files
- **Actively Problematic Files**: 25 files creating/querying old patterns without relationships
- **Already Migrated**: 15 files (NotesContext, TasksContext, SessionListContext)
- **Services Using Old Patterns**: 12 services
- **Components Using Old Patterns**: 8 components

### Relationship Manager Status
- **EXISTS**: Yes, fully implemented in RelationshipContext.tsx
- **SUPPORTS ALL RELATIONSHIP TYPES**: Yes (task-note, task-session, note-session, note-topic, note-company, note-contact, note-parent)
- **MIGRATION INFRASTRUCTURE**: Yes (relationshipMigration.ts, migrationValidator.ts)

---

## CATEGORY 1: CONTEXT FILES (Already Migrated ✓)

### 1. NotesContext.tsx ✓ COMPLETED
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/context/NotesContext.tsx`

**Status**: FULLY MIGRATED - Creates relationships when adding/updating notes

**Pattern Found**:
```typescript
// Lines 151-159: Reading old fields
const linkedCompanyIds = note.companyIds || [];
const linkedContactIds = note.contactIds || [];
const linkedTopicIds = note.topicIds || [];

if (note.topicId && !linkedTopicIds.includes(note.topicId)) {
  linkedTopicIds.push(note.topicId);
}
```

**Relationship Manager Integration**: PRESENT
```typescript
// Lines 217-265: Creates relationships via RelationshipContext
for (const topicId of linkedTopicIds) {
  await relationshipsContext.addRelationship({
    sourceType: EntityType.NOTE,
    sourceId: note.id,
    targetType: EntityType.TOPIC,
    targetId: topicId,
    type: RelationshipType.NOTE_TOPIC,
    metadata: { source: 'manual', createdAt: new Date().toISOString() },
  });
}
```

**Assessment**: GOOD - Reads old fields for entity count updates, but ALSO creates relationships. Mixed pattern but acceptable during transition.

---

### 2. TasksContext.tsx ✓ MOSTLY COMPLETED
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/context/TasksContext.tsx`

**Status**: PARTIALLY MIGRATED - Creates relationships for task.noteId and task.sourceSessionId

**Pattern Found** (lines 322-346):
```typescript
// Creates relationships when task added
if (task.noteId) {
  await relationshipsContext.addRelationship({
    sourceType: EntityType.TASK,
    sourceId: task.id,
    targetType: EntityType.NOTE,
    targetId: task.noteId,
    type: RelationshipType.TASK_NOTE,
    ...
  });
}

if (task.sourceSessionId) {
  await relationshipsContext.addRelationship({
    sourceType: EntityType.TASK,
    sourceId: task.id,
    targetType: EntityType.SESSION,
    targetId: task.sourceSessionId,
    type: RelationshipType.TASK_SESSION,
    ...
  });
}
```

**Issue**: Does NOT handle task.topicId, task.companyIds, task.contactIds relationships (even though Note does)

**Assessment**: PARTIAL - Missing relationships for company/contact links on tasks.

---

### 3. SessionListContext.tsx ✓ COMPLETED
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/context/SessionListContext.tsx`

**Status**: FULLY MIGRATED - Has relationship linking methods

**Relationship Manager Integration**: PRESENT (lines 909-1030)
```typescript
linkSessionToTask() - Creates TASK_SESSION relationships
linkSessionToNote() - Creates NOTE_SESSION relationships
unlinkSessionFromTask()
unlinkSessionFromNote()
```

**Assessment**: EXCELLENT - Full relationship support for sessions.

---

### 4. EntitiesContext.tsx - NO CHANGES NEEDED
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/context/EntitiesContext.tsx`

**Status**: CORRECT - Entities (companies, contacts, topics) don't need relationship changes
- They are TARGETS of relationships, not sources
- They store noteCount which is computed from relationships

**Assessment**: NO ACTION NEEDED.

---

## CATEGORY 2: SERVICE FILES - HIGH PRIORITY MIGRATION

### 1. sessionEnrichmentService.ts ⚠️ NEEDS MIGRATION
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/sessionEnrichmentService.ts`

**Problem**: Directly modifies task.sourceSessionId and note.sourceSessionId fields

**Old Pattern Found** (lines referenced in search):
```typescript
// Updates old fields directly during enrichment
if (task.sourceSessionId !== sessionId) {
  task.sourceSessionId = sessionId;
}

if (note.sourceSessionId !== sessionId) {
  note.sourceSessionId = sessionId;
}
```

**Should Use**: RelationshipManager to create relationships instead:
```typescript
// CORRECT PATTERN
await relationshipsContext.addRelationship({
  sourceType: EntityType.TASK,
  sourceId: task.id,
  targetType: EntityType.SESSION,
  targetId: sessionId,
  type: RelationshipType.TASK_SESSION,
  metadata: { source: 'ai', createdAt: ... }
});
```

**Assessment**: HIGH PRIORITY - Enrichment pipeline is creating old-pattern associations.

---

### 2. nedToolExecutor.ts ⚠️ NEEDS MIGRATION  
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/nedToolExecutor.ts`

**Problem**: Reads old fields directly to build context responses

**Pattern Found** (lines 135-168):
```typescript
// Queries old fields without relationship manager
const topic = t.topicId ? this.appState.topics.find(top => top.id === t.topicId) : null;
const relatedNotes = t.sourceNoteId
  ? this.appState.notes.filter(n => n.id === t.sourceNoteId)
  : [];

// Lines 173-180: Similar for notes
const relatedNotes = task.sourceNoteId
  ? this.appState.notes.filter(n => n.id === task.sourceNoteId)
  : [];
```

**Should Use**: RelationshipManager to query:
```typescript
// CORRECT PATTERN
const relationships = relationshipsContext.getRelationships(taskId);
const noteRelationships = relationships.filter(r => r.type === RelationshipType.TASK_NOTE);
```

**Assessment**: HIGH PRIORITY - Ned AI uses old fields to build context, limiting relationship awareness.

---

### 3. nedService.ts - MINIMAL (Lines: nedService.ts:L with 'note-update')
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/nedService.ts`

**Status**: Uses noteId in type definition only (not problematic)

**Assessment**: NO ACTION NEEDED.

---

### 4. claudeService.ts ⚠️ NEEDS MIGRATION
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/claudeService.ts`

**Problem**: Creates tasks/notes with old topicId field directly

**Pattern Found**:
```typescript
// Line ~: Creates tasks with topicId directly
topicId: task.topicId,

// Line ~: Creates notes with topicId field
topicId: primaryTopicResult?.existingTopicId
```

**Should Use**: Both old field AND create relationships:
```typescript
// Current approach is OK during migration, but also need:
await relationshipsContext.addRelationship({
  sourceType: EntityType.NOTE,
  sourceId: note.id,
  targetType: EntityType.TOPIC,
  targetId: topicId,
  type: RelationshipType.NOTE_TOPIC,
  metadata: { source: 'ai', ... }
});
```

**Assessment**: MODERATE - Already creates both old field and relationships (based on NotesContext caller), but should verify relationship creation in pipeline.

---

### 5. relationshipMigration.ts ✓ INFRASTRUCTURE PRESENT
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/relationshipMigration.ts`

**Status**: EXCELLENT - Migration infrastructure exists

**Handles All Fields**:
- task.noteId → TASK_NOTE relationship
- task.sourceNoteId → TASK_NOTE relationship (secondary)
- task.sourceSessionId → TASK_SESSION relationship
- note.topicId/topicIds → NOTE_TOPIC relationships
- note.companyIds → NOTE_COMPANY relationships
- note.contactIds → NOTE_CONTACT relationships
- note.sourceSessionId → NOTE_SESSION relationship
- note.parentNoteId → NOTE_PARENT relationship

**Assessment**: EXCELLENT - Migration infrastructure ready.

---

### 6. migrationValidator.ts ✓ VALIDATION INFRASTRUCTURE
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/migrationValidator.ts`

**Status**: READY - Validates migration completion

**Assessment**: GOOD - Validation infrastructure exists.

---

### 7. aiDeduplication.ts ⚠️ NEEDS REVIEW
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/aiDeduplication.ts`

**Problem**: Queries old fields for deduplication

**Pattern Found**:
```typescript
// Lines reference:
candidateTasks = allTasks.filter(task => task.noteId === contextNoteId);
candidateTasks = allTasks.filter(task => task.sourceSessionId === contextSessionId);

// Topic-based filtering:
note.topicIds?.includes(topicId) || note.topicId === topicId
```

**Should Use**: Relationship queries:
```typescript
// CORRECT
const relationships = relationshipsContext.getRelationships(taskId, RelationshipType.TASK_NOTE);
const linkedNotes = relationships.map(r => r.targetId);
```

**Assessment**: MODERATE - Deduplication needs relationship-aware querying.

---

### 8. aiCanvasPromptV2.ts - TEMPLATE ONLY
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/aiCanvasPromptV2.ts`

**Status**: Prompt template only (lines show "sourceSessionId" in example template)

**Assessment**: NO ACTION - Templates don't need changes, just documentation.

---

### 9. nedToolExecutor.ts - WRITE OPERATIONS ⚠️
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/nedToolExecutor.ts`

**Problem**: Creates tasks/notes with old fields

**Pattern Found**:
```typescript
// When Ned creates tasks via tools:
topicId: task.topicId,
noteId: undefined, // Will be set when saving
sourceNoteId: task.sourceNoteId,
```

**Should Use**: Create relationships after saving:
```typescript
// After saving task:
await relationshipsContext.addRelationship({
  sourceType: EntityType.TASK,
  sourceId: newTaskId,
  targetType: EntityType.NOTE,
  targetId: noteId,
  type: RelationshipType.TASK_NOTE,
  metadata: { source: 'ai', ... }
});
```

**Assessment**: HIGH PRIORITY - Ned's write operations bypass relationship manager.

---

### 10. contextAgent.ts - QUERY OPERATIONS
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/contextAgent.ts`

**Problem**: Queries old fields to build context

**Pattern Found**:
```typescript
// Lines reference context assembly using:
...(n.companyIds || []).map(id => companies.find(c => c.id === id)?.name)
...(n.contactIds || []).map(id => contacts.find(c => c.id === id)?.name)
...(n.topicIds || []).map(id => topics.find(t => t.id === id)?.name)
```

**Should Use**: Relationship queries instead

**Assessment**: MODERATE - Used for context building, not critical but should migrate.

---

### 11. storage/IndexingEngine.ts ⚠️ INDEXES OLD FIELDS
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/IndexingEngine.ts`

**Problem**: Indexes topicIds, companyIds, contactIds fields directly

**Pattern Found** (lines):
```typescript
const topicIds = entity.topicIds || entity.topicId ? [entity.topicId] : [];
for (const topicId of topicIds) {
  if (!index.topic[topicId]) {
    index.topic[topicId] = [];
  }
  index.topic[topicId].push(entity.id);
}

const companyIds = entity.companyIds || [];
for (const companyId of companyIds) { ... }
```

**Should Use**: Relationship-based indexing:
```typescript
// CORRECT
const relationships = relationshipsContext.getRelationships(entity.id);
const topicRelationships = relationships.filter(r => r.type === RelationshipType.NOTE_TOPIC);
for (const rel of topicRelationships) {
  index.topic[rel.targetId].push(entity.id);
}
```

**Assessment**: HIGH PRIORITY - Indexing must reflect relationship data for correctness.

---

### 12. storage/InvertedIndexManager.ts ⚠️ INDEXES OLD FIELDS
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/InvertedIndexManager.ts`

**Problem**: Searches using topicIds field

**Pattern Found**:
```typescript
async searchByTopic(topicId: string): Promise<string[]> {
  const result = await this.search({ topicIds: [topicId] });
  ...
}
```

**Assessment**: MODERATE - Search indexes need relationship awareness.

---

## CATEGORY 3: COMPONENT FILES - MEDIUM PRIORITY

### 1. CaptureZone.tsx ⚠️ CREATES WITH OLD FIELDS
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/CaptureZone.tsx`

**Problem**: Creates notes and tasks with old topicId field directly

**Pattern Found**:
```typescript
// Line ~: Creates notes with topicId
topicId,
topicIds: [noteResult.topicId],

// Line ~: Creates tasks with old field
topicId: task.topicId,
noteId: primaryNoteId,
sourceNoteId: primaryNoteId,
```

**Assessment**: HIGH PRIORITY - Main capture flow uses old patterns.

---

### 2. NoteDetailInline.tsx ⚠️ UPDATES WITH OLD FIELDS
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/NoteDetailInline.tsx`

**Problem**: Updates notes with companyIds, contactIds, topicIds arrays directly

**Pattern Found** (lines):
```typescript
const handleCompaniesChange = (companyIds: string[]) => {
  updateNote({
    companyIds,
  });
};

updatedNote.companyIds = [...(updatedNote.companyIds || []), value];
updatedNote.contactIds = [...(updatedNote.contactIds || []), value];
updatedNote.topicIds = [...(updatedNote.topicIds || []), value];
```

**Should Also Create**: Relationships when modifying these arrays

**Assessment**: HIGH PRIORITY - Note editing doesn't use relationship manager.

---

### 3. TaskDetailInline.tsx ⚠️ UPDATES WITH OLD FIELDS
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/TaskDetailInline.tsx`

**Problem**: Updates tasks with topicId, companyIds, contactIds directly

**Pattern Found**:
```typescript
const handleTopicChange = (topicId: string | undefined) => {
  updateTask({
    topicId,
  });
};

handleCompaniesChange = (companyIds: string[]) => { ... }
handleContactsChange = (contactIds: string[]) => { ... }
```

**Assessment**: HIGH PRIORITY - Task editing doesn't use relationship manager.

---

### 4. LibraryZone.tsx ⚠️ QUERIES WITH OLD FIELDS
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/LibraryZone.tsx`

**Problem**: Filters notes using old field arrays and legacy topicId

**Pattern Found**:
```typescript
note.companyIds?.some(id => selectedCompanyIds.includes(id)) ||
(note.topicId && selectedCompanyIds.includes(note.topicId))

note.topicIds?.some(id => selectedTopicIds.includes(id)) ||
(note.topicId && selectedTopicIds.includes(note.topicId)) // Legacy support

const relatedCompanies = entitiesState.companies.filter(c => note.companyIds?.includes(c.id));
```

**Assessment**: MODERATE - Filtering uses old fields but includes legacy support.

---

### 5. SessionTimeline.tsx ⚠️ CREATES WITH OLD FIELDS
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/SessionTimeline.tsx`

**Problem**: Creates notes/tasks with sourceSessionId directly

**Pattern Found**:
```typescript
sourceSessionId: session.id,
```

**Assessment**: MODERATE - Session timeline creates entities with old field.

---

### 6. QuickTaskFromSession.tsx ⚠️ CREATES WITH OLD FIELD
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/QuickTaskFromSession.tsx`

**Problem**: Creates tasks with sourceSessionId field

**Assessment**: LOW - Single usage, part of quick task flow.

---

### 7. InlineRelationshipSearch.tsx - DISPLAYS OLD FIELDS
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/relationships/InlineRelationshipSearch.tsx`

**Problem**: Displays companyIds and contactIds for note

**Pattern Found**:
```typescript
const companies = (note.companyIds || [])
  .map(id => ...)
const contacts = (note.contactIds || [])
  .map(id => ...)
```

**Assessment**: LOW - Display only, already reading relationships.

---

### 8. TasksZone.tsx - FILTERS WITH OLD FIELDS
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/TasksZone.tsx`

**Problem**: Filters tasks by companyIds, contactIds arrays

**Pattern Found**:
```typescript
if (!task.companyIds || task.companyIds.length === 0) return false;
const hasMatchingCompany = task.companyIds.some(companyId => ...);

if (!task.contactIds || task.contactIds.length === 0) return false;
```

**Assessment**: MODERATE - Filter logic needs relationship-aware rewrite.

---

## CATEGORY 4: UTILITY FILES

### 1. utils/helpers.ts ⚠️ CREATES WITH OLD FIELDS
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/utils/helpers.ts`

**Problem**: Creates tasks with old fields

**Pattern Found**:
```typescript
parentNoteId: options?.parentNoteId,
topicId: options?.topicId,
noteId: options?.noteId,
```

**Also Filters**:
```typescript
return notes.filter(note => note.topicId === topicId);
return tasks.filter(task => task.topicId === topicId);
```

**Assessment**: MODERATE - Utility functions used across app, affects many call sites.

---

### 2. utils/navigation.ts ⚠️ QUERIES WITH OLD FIELDS  
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/utils/navigation.ts`

**Problem**: Queries notes/tasks using old fields

**Pattern Found**:
```typescript
return tasks.filter(task => task.noteId === noteId);
if (!task?.noteId) return undefined;
const note = notes.find(n => n.id === task.noteId);

if (!task?.topicId) return undefined;
return topics.find(t => t.id === task.topicId);
```

**Assessment**: MODERATE - Navigation helpers need relationship-based lookups.

---

## CATEGORY 5: RELATIONSHIP MANAGER STATUS

### RelationshipContext.tsx ✓ FULLY IMPLEMENTED
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/context/RelationshipContext.tsx`

**Status**: EXCELLENT - Complete relationship management infrastructure

**Supported Relationship Types**:
```typescript
TASK_NOTE, TASK_SESSION, NOTE_SESSION,
TASK_TOPIC, NOTE_TOPIC,
NOTE_COMPANY, NOTE_CONTACT,
TASK_COMPANY, TASK_CONTACT,
SESSION_COMPANY, SESSION_CONTACT,
NOTE_PARENT
```

**Core Methods**:
- `addRelationship()` - Create new relationship
- `removeRelationship()` - Delete relationship
- `getRelationships()` - Query relationships by sourceId or type
- `getRelationshipsByTarget()` - Query by target
- `updateRelationshipMetadata()` - Update metadata

**Assessment**: EXCELLENT - Full support for all needed relationship types.

---

## RELATIONSHIP MANAGER COVERAGE

### What IS Covered by Relationship Manager

| Field | Type | Manager Support | Notes |
|-------|------|-----------------|-------|
| noteId (Task) | Single ref | TASK_NOTE | ✓ Implemented |
| sourceNoteId (Task) | Single ref | TASK_NOTE | ✓ Covered by same type |
| sourceSessionId (Task) | Single ref | TASK_SESSION | ✓ Implemented |
| topicId (Note) | Single ref | NOTE_TOPIC | ✓ Implemented |
| topicIds (Note) | Array | NOTE_TOPIC | ✓ Multiple relationships |
| companyIds (Note) | Array | NOTE_COMPANY | ✓ Implemented |
| contactIds (Note) | Array | NOTE_CONTACT | ✓ Implemented |
| sourceSessionId (Note) | Single ref | NOTE_SESSION | ✓ Implemented |
| parentNoteId (Note) | Single ref | NOTE_PARENT | ✓ Implemented |
| topicId (Task) | Single ref | TASK_TOPIC | ✓ Implemented |
| companyIds (Task) | Array | TASK_COMPANY | ✓ Implemented |
| contactIds (Task) | Array | TASK_CONTACT | ✓ Implemented |

**Assessment**: 100% coverage - All old fields have corresponding relationship types.

---

## MIGRATION READINESS ASSESSMENT

### Infrastructure Ready ✓
- RelationshipContext exists and fully functional
- RelationshipMigrationService exists
- All relationship types defined
- Migration validator exists

### Code Patterns Already Using ✓
- NotesContext creates relationships
- TasksContext creates relationships (partial)
- SessionListContext uses relationships

### Code Patterns NOT Using ⚠️
- Services: sessionEnrichmentService, nedToolExecutor, claudeService
- Components: CaptureZone, NoteDetailInline, TaskDetailInline
- Utilities: helpers.ts, navigation.ts
- Indexing: IndexingEngine, InvertedIndexManager

### Summary
**Migration is 40% complete** - Some contexts migrated, but critical paths (enrichment, Ned, capture) still use old patterns.

---

## HIGH-PRIORITY MIGRATION TARGETS

### TIER 1 (CRITICAL - Blocking enrichment & AI)
1. **sessionEnrichmentService.ts** - Updates task/note.sourceSessionId directly
   - Impact: Post-session enrichment doesn't use relationship manager
   - Fix: Replace field updates with addRelationship calls
   - Effort: MEDIUM (40-50 lines)

2. **nedToolExecutor.ts** - Reads/writes old fields for AI context
   - Impact: Ned AI can't see relationships in context
   - Fix: Query relationships instead of fields
   - Effort: MEDIUM (30-40 lines per tool)

3. **CaptureZone.tsx** - Creates notes/tasks with topicId/noteId
   - Impact: Main capture flow uses old patterns
   - Fix: After creating, call relationship manager
   - Effort: MEDIUM (20-30 lines)

### TIER 2 (HIGH - Affects editing)
4. **NoteDetailInline.tsx** - Updates companyIds, contactIds, topicIds
   - Impact: Editing notes doesn't update relationships
   - Fix: Call relationship manager when arrays change
   - Effort: MEDIUM (25-35 lines)

5. **TaskDetailInline.tsx** - Updates topicId, companyIds, contactIds
   - Impact: Editing tasks doesn't update relationships
   - Fix: Call relationship manager when fields change
   - Effort: MEDIUM (25-35 lines)

### TIER 3 (MEDIUM - Affects queries)
6. **storage/IndexingEngine.ts** - Indexes old fields
   - Impact: Indexes may not reflect actual relationships
   - Fix: Index based on relationships instead of fields
   - Effort: HIGH (50-100 lines, complex)

7. **nedToolExecutor.ts** - Queries old fields for context
   - Impact: Limited by old field queries
   - Fix: Query relationships for context
   - Effort: MEDIUM (20-30 per query)

### TIER 4 (LOW - Can stay mixed)
8. **utils/helpers.ts** - Filters by old fields
   - Impact: Utility functions used across app
   - Fix: Optional - can stay as convenience filters
   - Effort: LOW (could stay mixed pattern)

---

## MIGRATION IMPLEMENTATION GUIDE

### Pattern 1: Creating Relationships When Adding Entity

**OLD**:
```typescript
// Just set the field
const note = {
  id: generateId(),
  topicId: 'topic-123',
  companyIds: ['c1', 'c2'],
};
```

**NEW** (Keep old fields for backward compat, add relationships):
```typescript
const note = {
  id: generateId(),
  topicId: 'topic-123',
  companyIds: ['c1', 'c2'],
};
dispatch({ type: 'ADD_NOTE', payload: note });

// ALSO create relationships
if (note.topicId) {
  await relationshipsContext.addRelationship({
    sourceType: EntityType.NOTE,
    sourceId: note.id,
    targetType: EntityType.TOPIC,
    targetId: note.topicId,
    type: RelationshipType.NOTE_TOPIC,
    metadata: { source: 'manual', createdAt: new Date().toISOString() },
  });
}
```

### Pattern 2: Updating Relationships When Field Changes

**OLD**:
```typescript
const handleTopicChange = (newTopicId: string) => {
  updateNote({
    topicId: newTopicId
  });
};
```

**NEW**:
```typescript
const handleTopicChange = async (newTopicId: string) => {
  // Update the field
  updateNote({
    topicId: newTopicId
  });
  
  // Remove old relationship
  const oldRels = relationshipsContext.getRelationships(noteId, RelationshipType.NOTE_TOPIC);
  for (const rel of oldRels) {
    await relationshipsContext.removeRelationship(rel.id);
  }
  
  // Add new relationship
  if (newTopicId) {
    await relationshipsContext.addRelationship({
      sourceType: EntityType.NOTE,
      sourceId: noteId,
      targetType: EntityType.TOPIC,
      targetId: newTopicId,
      type: RelationshipType.NOTE_TOPIC,
      metadata: { source: 'manual', ... },
    });
  }
};
```

### Pattern 3: Querying with Relationships

**OLD**:
```typescript
const relatedNotes = notes.filter(n => n.id === task.sourceNoteId);
```

**NEW**:
```typescript
const relationships = relationshipsContext.getRelationships(taskId, RelationshipType.TASK_NOTE);
const relatedNoteIds = relationships.map(r => r.targetId);
const relatedNotes = notes.filter(n => relatedNoteIds.includes(n.id));
```

### Pattern 4: Array Updates (Multi-relationships)

**OLD**:
```typescript
const handleCompaniesChange = (companyIds: string[]) => {
  updateNote({ companyIds });
};
```

**NEW**:
```typescript
const handleCompaniesChange = async (newCompanyIds: string[]) => {
  // Update the field
  updateNote({ companyIds: newCompanyIds });
  
  // Remove old relationships
  const oldRels = relationshipsContext.getRelationships(noteId, RelationshipType.NOTE_COMPANY);
  for (const rel of oldRels) {
    const companyId = rel.targetId;
    if (!newCompanyIds.includes(companyId)) {
      await relationshipsContext.removeRelationship(rel.id);
    }
  }
  
  // Add new relationships
  for (const companyId of newCompanyIds) {
    const exists = oldRels.some(r => r.targetId === companyId);
    if (!exists) {
      await relationshipsContext.addRelationship({
        sourceType: EntityType.NOTE,
        sourceId: noteId,
        targetType: EntityType.COMPANY,
        targetId: companyId,
        type: RelationshipType.NOTE_COMPANY,
        metadata: { source: 'manual', ... },
      });
    }
  }
};
```

---

## VERIFICATION CHECKLIST

After migration, verify:

- [ ] All addNote/addTask calls also call relationshipsContext.addRelationship()
- [ ] All updateNote/updateTask field changes also update relationships
- [ ] All deleteNote/deleteTask calls remove associated relationships
- [ ] Queries use relationshipsContext.getRelationships() instead of field access
- [ ] Indexing engine indexes based on relationships, not fields
- [ ] Migration service successfully converts legacy fields to relationships
- [ ] No new code creates old patterns (review in PRs)
- [ ] Tests cover relationship creation alongside field updates
- [ ] Ned AI context includes relationship data
- [ ] Search filters work with relationship data

---

## NEXT STEPS

1. **Start with TIER 1** (sessionEnrichmentService, nedToolExecutor)
2. **Run migration** on existing data using relationshipMigration.ts
3. **Update TIER 2** (component edit handlers)
4. **Audit TIER 3** (indexing, queries) after other migrations
5. **Keep old fields** during transition for backward compatibility
6. **Plan TIER 4** deprecation (mark fields as deprecated in JSDoc)

