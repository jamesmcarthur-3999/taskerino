# Taskerino: Topics, Companies, and Contacts Architecture Analysis

**Analysis Date**: October 26, 2025  
**Status**: Complete Gap Analysis Report

## Executive Summary

Topics, Companies, and Contacts are **severely under-integrated** in Taskerino. While they're defined as first-class types with dedicated context management, they're essentially "second-class citizens" lacking:

1. **No management UI** - No way to view, edit, or manage entities directly
2. **Fragmented storage** - Old metadata system (topicIds, companyIds, contactIds) coexists alongside incomplete relationships system
3. **Incomplete relationship integration** - Relationships system exists but only partially used
4. **Filter limitations** - Only topics shown in filters, not companies/contacts
5. **No entity lifecycle** - No way to create, edit, or delete these entities except as side effects of note creation
6. **Legacy metadata still in use** - note.metadata.relatedTopics and old array fields still referenced

---

## 1. Current Entity Definitions

### Location
`/Users/jamesmcarthur/Documents/taskerino/src/types.ts` (lines 296-340)

### Topic Definition
```typescript
export interface Topic {
  id: string;
  name: string;
  createdAt: string;
  lastUpdated: string;
  noteCount: number;
  // NO FIELDS FOR: description, profile, image, tags, etc.
}
```

### Company Definition
```typescript
export interface Company {
  id: string;
  name: string;
  createdAt: string;
  lastUpdated: string;
  noteCount: number;
  
  profile?: {
    industry?: string;
    size?: string;
    website?: string;
    description?: string;
    logoUrl?: string;
    // More fields to be added later (INCOMPLETE)
  };
}
```

### Contact Definition
```typescript
export interface Contact {
  id: string;
  name: string;
  createdAt: string;
  lastUpdated: string;
  noteCount: number;
  
  profile?: {
    role?: string;
    companyId?: string;           // Link to Company
    email?: string;
    phone?: string;
    photoUrl?: string;
    // More fields to be added later (INCOMPLETE)
  };
}
```

### Gap Analysis
- **Topics**: No enrichment fields at all - just name tracking
- **Companies**: Profile object marked "(to be fleshed out later)" - essentially a stub
- **Contacts**: Profile object marked "(to be fleshed out later)" - essentia a stub
- **All three**: No metadata, description, tags, or rich profile support
- **All three**: No relationships back to notes/tasks visible in interface

---

## 2. Storage & Persistence Architecture

### Location
`/Users/jamesmcarthur/Documents/taskerino/src/context/EntitiesContext.tsx`

### Current Storage Flow

1. **Load on mount** (lines 158-184):
   ```typescript
   // Load all three entity types from storage on app start
   const [companies, contacts, topics] = await Promise.all([
     storage.load<Company[]>('companies'),
     storage.load<Contact[]>('contacts'),
     storage.load<Topic[]>('topics'),
   ]);
   ```

2. **Save on change** (lines 186-213):
   ```typescript
   // Debounced 5 seconds - saves ALL entities whenever ANY entity changes
   saveTimeoutRef.current = setTimeout(async () => {
     await Promise.all([
       storage.save('companies', state.companies),
       storage.save('contacts', state.contacts),
       storage.save('topics', state.topics),
     ]);
   }, 5000);
   ```

### Storage Strategy
- **Simple reducer** in context with CRUD actions
- **Debounced saves** to storage (5 second debounce)
- **No transactions** - if save fails, state is out of sync
- **No persistence queue** - unlike sessions which use PersistenceQueue
- **No cleanup** - deleted notes still track deleted company/contact IDs

### Storage Bucket Names
- `'companies'` - All companies as single JSON array
- `'contacts'` - All contacts as single JSON array  
- `'topics'` - All topics as single JSON array

### Gap Analysis
- **No deletion cleanup**: When a note is deleted, its companyIds/contactIds/topicIds references aren't cleaned up
- **No incremental updates**: Whole arrays re-saved even if one entity changed
- **No transactions**: State-storage inconsistency possible on failure
- **No indexing**: No way to quickly look up which notes reference a company/contact
- **No migration path**: Old topicId field must be manually migrated to new systems

---

## 3. Relationship System Integration

### Location
`/Users/jamesmcarthur/Documents/taskerino/src/types/relationships.ts`

### Current Relationship Types
```typescript
export const RelationshipType = {
  // IMPLEMENTED (Phase 1)
  TASK_NOTE: 'task-note',
  TASK_SESSION: 'task-session',
  NOTE_SESSION: 'note-session',
  TASK_TOPIC: 'task-topic',
  NOTE_TOPIC: 'note-topic',
  NOTE_COMPANY: 'note-company',        // DEFINED but NOT USED
  NOTE_CONTACT: 'note-contact',        // DEFINED but NOT USED
  NOTE_PARENT: 'note-parent',
  
  // FUTURE (Phase 2+)
  TASK_FILE, NOTE_FILE, SESSION_FILE, TASK_TASK, PROJECT_TASK, PROJECT_NOTE, GOAL_TASK
};
```

### Relationship Configuration
All defined in `RELATIONSHIP_CONFIGS`:
- **NOTE_COMPANY**: bidirectional=true, cascadeDelete=false, icon='Building', color='#F59E0B'
- **NOTE_CONTACT**: bidirectional=true, cascadeDelete=false, icon='User', color='#EC4899'
- **NOTE_TOPIC**: bidirectional=true, cascadeDelete=false, icon='Tag', color='#10B981'

### Current Usage Status

#### FULLY INTEGRATED:
- TASK_NOTE, TASK_SESSION, NOTE_SESSION, TASK_TOPIC, NOTE_TOPIC, NOTE_PARENT

#### DEFINED BUT NOT USED:
- **NOTE_COMPANY** - Type exists but no code creates these relationships
- **NOTE_CONTACT** - Type exists but no code creates these relationships

#### Evidence
In `claudeService.ts`, the AI returns:
- `primaryTopic` with type ('company' or 'person')
- `secondaryTopics` list with types

**BUT** the code then creates:
- Topic/Company/Contact entity in EntitiesContext
- Adds to `note.topicIds[]` (legacy field)
- **DOES NOT** create relationship objects

### Note Structure
```typescript
export interface Note {
  // OLD SYSTEM (Still Active):
  companyIds?: string[];              // Array of company IDs
  contactIds?: string[];              // Array of contact IDs
  topicIds?: string[];                // Array of topic IDs
  topicId?: string;                   // Legacy: deprecated, kept for migration
  
  // NEW SYSTEM (Partially Implemented):
  relationships?: Relationship[];      // Unified relationships array
  relationshipVersion?: number;        // Migration flag: 0=legacy, 1=migrated
  
  // METADATA (Old system, still in UI):
  metadata?: {
    sentiment?: string;
    keyPoints?: string[];
    relatedTopics?: string[];          // SHOWN IN UI (line 358-370)
  };
}
```

### Gap Analysis
- **Dual systems coexist**: companyIds/contactIds never migrated to relationships
- **No relationship creation**: AI processing never creates relationship objects
- **No migration code**: No code converts old arrays to relationships
- **RelationshipModal exists** but only for manual creation, not AI-driven
- **Search/filters** use old arrays (companyIds) not new relationships
- **Metadata.relatedTopics** shown in UI but stored separately, not as relationships

---

## 4. Old Metadata System Still in Use

### Location in UI
`/Users/jamesmcarthur/Documents/taskerino/src/components/NoteDetailInline.tsx` (lines 358-370)

```typescript
{/* Related Topics */}
{note.metadata?.relatedTopics && note.metadata.relatedTopics.length > 0 && (
  <div className="flex flex-wrap gap-1.5 items-center">
    <span className="text-xs text-gray-500 font-medium">Related:</span>
    {note.metadata.relatedTopics.map((relatedTopic, idx) => (
      <span key={idx} className="...">
        {relatedTopic}
      </span>
    ))}
  </div>
)}
```

### Data Flow
1. AI returns `note.relatedTopics: string[]` (topic names, not IDs)
2. Stored in `note.metadata.relatedTopics`
3. Displayed in NoteDetailInline
4. **NOT** linked to actual Topic entities or relationships

### Locations Still Using Old Arrays

**In LibraryZone.tsx** (lines 225-246):
```typescript
// Filter by company
if (selectedCompanyId) {
  notes = notes.filter(note =>
    note.companyIds?.includes(selectedCompanyId) ||
    (note.topicId === selectedCompanyId) // Legacy support
  );
}

// Filter by contact
if (selectedContactId) {
  notes = notes.filter(note =>
    note.contactIds?.includes(selectedContactId) ||
    (note.topicId === selectedContactId) // Legacy support
  );
}

// Filter by topic
if (selectedTopicId) {
  notes = notes.filter(note =>
    note.topicIds?.includes(selectedTopicId) ||
    (note.topicId === selectedTopicId) // Legacy support
  );
}
```

**In NotesContext.tsx** (shown in grep results):
```typescript
const linkedCompanyIds = note.companyIds || [];
const linkedContactIds = note.contactIds || [];
const linkedTopicIds = note.topicIds || [];
// Used in noteCount updates
(note.companyIds || []).forEach(companyId => { /* increment noteCount */ });
```

### Gap Analysis
- **Inconsistent data sources**: Some code reads from companyIds, some from topicId
- **Metadata isolation**: relatedTopics in metadata not linked to actual entities
- **No single source of truth**: Multiple ways to find note-entity relationships
- **Legacy support scattered**: Every filter has "legacy support" branches

---

## 5. Filter Implementation Gaps

### Location
`/Users/jamesmcarthur/Documents/taskerino/src/components/StandardFilterPanel.tsx` (generic filter UI)  
`/Users/jamesmcarthur/Documents/taskerino/src/components/LibraryZone.tsx` (implementation)

### Current Filters
1. **Topics** ✅ Fully implemented (shown in UI)
2. **Companies** ❌ No filter UI
3. **Contacts** ❌ No filter UI
4. **Tags** ✅ Fully implemented
5. **Sources** ✅ Fully implemented
6. **Sentiments** ✅ Fully implemented

### Why No Company/Contact Filters
In LibraryZone.tsx, only topic filter UI is created:
```typescript
// Filter sections for StandardFilterPanel
const filterSections = [
  {
    title: 'Topics',
    items: sortedTopics.map(t => ({ id: t.id, label: t.name })),
    selectedIds: selectedTopicId ? [selectedTopicId] : [],
    onToggle: (id) => setSelectedTopicId(id === selectedTopicId ? undefined : id)
  },
  // ... tags, sources, sentiments
  // NO company section
  // NO contact section
];
```

### Root Cause
Companies/Contacts are treated as subordinate to Topics:
- Topics = categories/buckets (primary organization)
- Companies/Contacts = entities within topics (secondary)
- But UI never evolved to show companies/contacts as first-class filters

### Gap Analysis
- **UI only shows topics**: Despite having companies and contacts, no UI to filter by them
- **Confusion in mental model**: Are companies/contacts primary entities or attributes?
- **Incomplete entity browsing**: Can't see "all notes about Acme Corp" easily

---

## 6. Entity Management UI

### Current State
- **TopicPillManager.tsx** - Shows topics as pills in note creation, minimal editing
- **No CompanyManager** - Companies can only be created via AI detection
- **No ContactManager** - Contacts can only be created via AI detection
- **No dedicated management view** - Unlike Notes/Tasks which have full views
- **RelationshipModal** - Exists for manual relationship creation, but not for entity CRUD

### What's Missing
1. **Companies Zone/View** - Browse all companies, edit details, see linked notes
2. **Contacts Zone/View** - Browse all contacts, edit details, see linked notes
3. **Company Detail Panel** - Rich profile editing, logo upload, industry selection
4. **Contact Detail Panel** - Role, email, phone, company affiliation, photo
5. **Bulk Operations** - Merge duplicate companies, batch tag contacts
6. **Company-Contact Relationships** - Many contacts can belong to one company
7. **Search across entities** - "Find all mentions of Acme Corp" across notes

### Evidence
No files matching:
- `*Companies*` (except EntitiesContext)
- `*Contacts*` (except EntitiesContext)  
- `Company.*` (except types.ts)
- `Contact.*` (except types.ts)

### Gap Analysis
- **First-class types, second-class citizens**: Defined in types but no management UI
- **One-way relationships**: Notes→Companies but can't browse Companies→Notes easily
- **Incomplete data model**: Profile fields marked "to be fleshed out later"
- **No data enrichment**: No way to add details to company/contact beyond name

---

## 7. Entity Creation Patterns

### How Entities Are Created

#### Via AI Detection (claudeService.ts)
1. User submits text
2. Claude detects `primaryTopic` with type ('company' or 'person')
3. If `type === 'company'`: Create Company entity
4. If `type === 'person'`: Create Contact entity
5. Existing Topic just uses existing or creates new

```typescript
// From claudeService.ts ~line 625-647
if (aiResponse.primaryTopic) {
  const primary = aiResponse.primaryTopic;
  const matchedTopic = findMatchingTopic(primary.name, existingTopics);
  
  if (matchedTopic) {
    primaryTopicResult = {
      name: matchedTopic.name,
      type: primary.type || 'company',
      confidence,
      existingTopicId: matchedTopic.id,
    };
  } else {
    // NEW primary topic (creates new Company/Contact/Topic)
    primaryTopicResult = {
      name: primary.name,
      type: primary.type || 'company',
      confidence: 1.0,
    };
  }
}
```

#### In CaptureZone (Result Processing)
Entities are created but not explicitly shown:
- AI returns detected topics with types
- CaptureZone dispatches CREATE_TOPIC actions
- **But**: No success notification, no UI feedback, just silently added

#### Manual Creation
In ManualTopicData (types.ts):
```typescript
export interface ManualTopicData {
  name: string;
  type: 'company' | 'person' | 'other';  // User picks type
  description?: string;
}
```

**But**: No UI component uses this type. EntitiesContext has CREATE_MANUAL_TOPIC action but it's unreferenced.

### Gap Analysis
- **Silent creation**: Entities created without user awareness
- **No creation UI**: Can't manually create company/contact from UI
- **No confirmation**: User doesn't see what entities were detected
- **No deduplication UI**: If "Acme Corp" and "Acme" detected, no warning
- **Type detection fragile**: Relies on AI guessing company vs person vs topic

---

## 8. Comprehensive Gap Summary

### Topics (Most Complete)
- ✅ Defined as first-class type
- ✅ Stored in EntitiesContext
- ✅ Shown in filters
- ✅ Linked in notes via topicIds array
- ✅ Relationship type defined (NOTE_TOPIC)
- ❌ Profile fields underdeveloped
- ❌ No dedicated management UI (except TopicPillManager)
- ❌ Relationships system not used, still using legacy arrays
- ❌ No way to edit topic details after creation

### Companies (Major Gaps)
- ✅ Defined as first-class type
- ✅ Stored in EntitiesContext  
- ✅ AI can detect and create
- ❌ **No filters in UI** - Can't filter notes by company
- ❌ **No management UI** - Can't browse/view all companies
- ❌ **No detail view** - Can't see company profile or linked notes
- ❌ **No profile editing** - Industry, size, website fields unused
- ❌ **Relationships not used** - companyIds array instead of relationships
- ❌ **No entity lifecycle** - Only created via AI, can't manually create or delete
- ❌ **No company-contact links** - Can't assign contacts to companies
- ❌ **metadata.relatedTopics shows topics, not companies**

### Contacts (Severe Gaps)
- ✅ Defined as first-class type
- ✅ Stored in EntitiesContext
- ✅ AI can detect and create  
- ❌ **No filters in UI** - Can't filter notes by contact
- ❌ **No management UI** - Can't browse/view all contacts
- ❌ **No detail view** - Can't see contact profile or linked notes
- ❌ **No profile editing** - Role, email, phone fields unused
- ❌ **Relationships not used** - contactIds array instead of relationships
- ❌ **No entity lifecycle** - Only created via AI, can't manually create or delete
- ❌ **No company linking** - companyId field in profile but no UI for it
- ❌ **metadata.relatedTopics shows topics, not contacts**

---

## 9. Breaking Changes & Existing Data

### Existing Data State
- **All existing notes**: Use `companyIds[]`, `contactIds[]`, `topicIds[]` arrays
- **Some notes**: Have `metadata.relatedTopics` with topic names
- **No relationships**: No relationship objects have been created yet (new system)
- **Legacy `topicId` field**: Some notes still have single topicId from very old system

### Required Migrations
1. **Old→New Array Fields**: topicId (singular) → topicIds (plural)
2. **Arrays→Relationships**: companyIds/contactIds/topicIds → Relationship objects
3. **Metadata→System**: metadata.relatedTopics → Relationship objects
4. **Bulk updates**: NotesContext tracks noteCount, needs recalculation

### Data Integrity Issues
- **Orphaned references**: If company deleted, notes still have companyIds pointing to it
- **Duplicate handling**: No deduplication if "Acme" and "Acme Corp" both exist
- **Count tracking**: noteCount manually updated, can get out of sync if notes deleted
- **No cascade delete**: Deleting a company doesn't cascade delete notes (but they reference deleted ID)

---

## 10. Recommended Architecture

### Phase 1: Complete the Existing System (Low Risk)

**Goal**: Make Topics, Companies, Contacts fully featured WITHIN current framework

**Changes**:
1. Add dedicated view/zone for each entity type (CompaniesZone, ContactsZone)
2. Add entity detail panels similar to NoteDetailInline
3. Add entity CRUD forms
4. Add companies/contacts to filter UI
5. Implement entity editing (profile fields, name, etc.)
6. Add deduplication/merge UI
7. Track company-contact relationships

**Scope**: Within EntitiesContext, minimal storage changes

### Phase 2: Migrate to Relationships System (Medium Risk)

**Goal**: Replace legacy arrays with proper relationship objects

**Steps**:
1. Create migration function: arrays → relationships
2. Update claudeService to create relationship objects instead of just noting topicIds
3. Update filters to query relationships instead of arrays
4. Update NotesContext to sync with relationships
5. Add migration UI with progress tracking
6. Keep legacy arrays as fallback for 2-3 releases
7. Eventually remove companyIds/contactIds fields

**Scope**: Cross-context changes, existing data migration

### Phase 3: Rich Entity Profiles (Lower Priority)

**Goal**: Flesh out Company and Contact profiles

**Changes**:
1. Expand Company.profile with: industry, website, employees, revenue, description
2. Expand Contact.profile with: bio, social links, availability, preferences
3. Add media storage for logos/photos
4. Add relationship types: company-contact, company-company, contact-contact
5. Add entity search/discovery
6. Add entity network visualization

**Scope**: New features, non-breaking

### Phase 4: Smart Entity Management (Future)

**Goal**: AI-assisted entity deduplication, enrichment, linking

**Features**:
1. AI detects "Acme Corp" vs "Acme" as same entity
2. Suggests merging duplicates with impact analysis
3. AI enriches companies with data (industry from context)
4. Auto-links contacts to companies based on email/context
5. Entity disambiguation for homonyms

**Scope**: AI enhancements, optional

---

## 11. Implementation Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| **Companies/Contacts Filter UI** | High | Low | **P0** |
| **Entity Detail Views** | High | Medium | **P0** |
| **Company Management Zone** | High | Medium | **P0** |
| **Contact Management Zone** | High | Medium | **P0** |
| **Manual Entity Creation** | Medium | Low | **P1** |
| **Entity Editing/Profiles** | Medium | Medium | **P1** |
| **Migrate to Relationships** | High | High | **P1** |
| **Company-Contact Linking** | Medium | Medium | **P2** |
| **Deduplication/Merging** | Medium | High | **P2** |
| **Entity Search** | Low | Medium | **P3** |
| **Rich Profiles** | Low | Medium | **P3** |
| **AI Enrichment** | Low | High | **P4** |

---

## 12. File Inventory

### Core Type Definitions
- `/src/types.ts` - Topic, Company, Contact types (lines 296-340)
- `/src/types/relationships.ts` - Relationship system definitions

### Context & State
- `/src/context/EntitiesContext.tsx` - Entity storage and CRUD
- `/src/context/NotesContext.tsx` - Note-entity linking via arrays
- `/src/context/RelationshipContext.tsx` - Relationship management (exists but not used for companies/contacts)

### UI Components
- `/src/components/StandardFilterPanel.tsx` - Generic filter UI
- `/src/components/LibraryZone.tsx` - Notes view with filters (lines 190-250)
- `/src/components/NoteDetailInline.tsx` - Note view (shows metadata.relatedTopics line 358-370)
- `/src/components/TopicPillManager.tsx` - Topic selection UI
- `/src/components/relationships/RelatedContentSection.tsx` - Relationship display
- `/src/components/relationships/RelationshipModal.tsx` - Manual relationship creation

### AI Processing
- `/src/services/claudeService.ts` - Topic/company/contact detection
- `/src/components/CaptureZone.tsx` - Result processing and entity creation

### Storage
- Uses generic storage adapter pattern (IndexedDB/Tauri FS)
- Buckets: 'companies', 'contacts', 'topics'
- No specialized storage like sessions (ChunkedSessionStorage)

---

## 13. Code Quality Notes

### Current Strengths
- Clear type definitions with discriminated unions
- Relationship configuration system is well-designed
- Context isolation prevents state sprawl
- Storage abstraction works across platforms

### Current Weaknesses
- Dual system coexistence (arrays + relationships) confusing
- No data integrity constraints (orphaned references possible)
- Silent entity creation makes for confusing UX
- Debounced saves can cause sync issues
- No transaction support for cross-entity operations
- Legacy support branches scattered through codebase

---

## 14. Conclusion

**Current State**: Topics/Companies/Contacts are **partially implemented first-class entities** with the plumbing in place (types, context, storage) but **lacking critical user-facing features** (management UI, proper filters, entity lifecycle).

**The Core Problem**: Built as "AI-detected entities" rather than "user-managed entities":
- Users can't directly create/edit companies or contacts
- Can't browse/filter by companies or contacts
- Can't see what entities exist or manage them
- Silent creation → users don't realize entities were created
- Quote from user: "Little tags I can't do shit with" - exactly right

**Migration Complexity**: **HIGH but manageable**
- Relationship system already designed
- Storage system stable
- Main effort: UI implementation + data migration
- Estimated 40-60 engineering hours for full Phase 1+2

**Recommendation**: Prioritize Phase 1 (complete the existing system) before Phase 2 (relationships migration). Give users visibility and control first, then refactor internals.

