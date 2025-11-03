# Taskerino Topics Investigation - Very Thorough Report

## Executive Summary

Topics in Taskerino are first-class entities (alongside Companies and Contacts) that organize notes, tasks, and sessions. The system uses a **dual approach**: legacy `topicId` fields for backward compatibility + modern `topicIds` arrays, with a planned migration to the unified **Relationship Manager** system.

---

## 1. TOPIC TYPE DEFINITIONS

### Location: `/Users/jamesmcarthur/Documents/taskerino/src/types.ts` (lines 547-553)

```typescript
// Line 547
export interface Topic {
  id: string;
  name: string;
  createdAt: string;
  lastUpdated: string;
  noteCount: number;  // Tracked for "Other" category display
}
```

**Key Characteristics:**
- **Simple Structure**: Only core metadata (id, name, timestamps, noteCount)
- **Single Entity Type**: Unlike Companies (with profiles) and Contacts (with roles), Topics are lightweight
- **Note Counting**: Maintains `noteCount` for aggregate displays
- **No Hierarchy**: No parent/child relationships or nesting

---

## 2. TOPIC STORAGE & PERSISTENCE

### Storage Location: Managed by EntitiesContext

**Storage File**: `/Users/jamesmcarthur/Documents/taskerino/src/context/EntitiesContext.tsx` (lines 152-213)

#### Loading Topics from Storage (lines 158-184)
```typescript
useEffect(() => {
  async function loadEntities() {
    try {
      const storage = await getStorage();
      const [companies, contacts, topics] = await Promise.all([
        storage.load<Company[]>('companies'),
        storage.load<Contact[]>('contacts'),
        storage.load<Topic[]>('topics'),  // Load topics
      ]);

      dispatch({
        type: 'LOAD_ENTITIES',
        payload: {
          companies: Array.isArray(companies) ? companies : [],
          contacts: Array.isArray(contacts) ? contacts : [],
          topics: Array.isArray(topics) ? topics : [],  // Initialize state
        },
      });

      setHasLoaded(true);
    } catch (error) {
      console.error('Failed to load entities:', error);
      setHasLoaded(true);
    }
  }
  loadEntities();
}, []);
```

#### Saving Topics to Storage (lines 186-213)
```typescript
// Debounced 5-second save on changes
useEffect(() => {
  if (!hasLoaded) return;

  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }

  saveTimeoutRef.current = setTimeout(async () => {
    try {
      const storage = await getStorage();
      await Promise.all([
        storage.save('companies', state.companies),
        storage.save('contacts', state.contacts),
        storage.save('topics', state.topics),  // Save topics
      ]);
      console.log('Entities saved to storage');
    } catch (error) {
      console.error('Failed to save entities:', error);
    }
  }, 5000);

  return () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  };
}, [hasLoaded, state.companies, state.contacts, state.topics]);
```

**Key Points:**
- Topics are stored as a simple array under key `'topics'`
- Changes are debounced with 5-second delay
- Shared with Companies and Contacts in a single save operation
- Uses the unified storage adapter pattern (IndexedDB for browser, Tauri FS for desktop)

---

## 3. HOW TOPICS ARE CREATED & ASSOCIATED

### 3.1 Creation in NotesContext

**File**: `/Users/jamesmcarthur/Documents/taskerino/src/context/NotesContext.tsx` (lines 554-612)

#### Manual Topic Creation via createManualNote (lines 554-612)
```typescript
const createManualNote = (noteData: ManualNoteData) => {
  // Create entity if needed
  let topicId = noteData.topicId;

  if (!topicId && noteData.newTopicName) {
    const newId = generateId();
    const timestamp = new Date().toISOString();
    const entityType = noteData.newTopicType || 'other';

    if (entityType === 'company') {
      const newCompany: Company = { /* ... */ };
      entitiesContext.dispatch({ type: 'ADD_COMPANY', payload: newCompany });
      topicId = newId;
    } else if (entityType === 'person') {
      const newContact: Contact = { /* ... */ };
      entitiesContext.dispatch({ type: 'ADD_CONTACT', payload: newContact });
      topicId = newId;
    } else {
      // DEFAULT CASE: Creates a Topic for 'other' type
      const newTopic: Topic = {
        id: newId,
        name: noteData.newTopicName,
        createdAt: timestamp,
        lastUpdated: timestamp,
        noteCount: 0,
      };
      entitiesContext.dispatch({ type: 'ADD_TOPIC', payload: newTopic });
      topicId = newId;
    }
  }

  // Fallback: Create 'Uncategorized' topic if no topic provided
  if (!topicId) {
    const defaultId = generateId();
    const timestamp = new Date().toISOString();
    const defaultTopic: Topic = {
      id: defaultId,
      name: 'Uncategorized',
      createdAt: timestamp,
      lastUpdated: timestamp,
      noteCount: 0,
    };
    entitiesContext.dispatch({ type: 'ADD_TOPIC', payload: defaultTopic });
    topicId = defaultId;
  }

  // Create note with topicId
  const newNote: Note = {
    id: generateId(),
    topicId: topicId!,
    content: noteData.content,
    summary,
    timestamp,
    lastUpdated: timestamp,
    source: noteData.source || 'thought',
    tags: noteData.tags || [],
  };

  addNote(newNote);
};
```

**Key Points:**
- Topics are created ON-DEMAND when a note needs one
- Default fallback: `'Uncategorized'` topic created automatically
- Topic type determined by `noteData.newTopicType` ('company', 'person', or 'other')
- Newly created topic immediately dispatched to EntitiesContext
- Topic ID stored in `note.topicId` (legacy field)

### 3.2 Association with Notes

**Note Interface**: `/Users/jamesmcarthur/Documents/taskerino/src/types.ts` (lines 565-643)

```typescript
export interface Note {
  id: string;

  // Multiple relationship support
  companyIds?: string[];      // Links to Company entities
  contactIds?: string[];      // Links to Contact (person) entities
  topicIds?: string[];        // Links to Topic entities (for "other" category)  <- NEW ARRAY

  /**
   * @deprecated Use relationships array instead
   * Legacy field for migration
   */
  topicId?: string;           // Single legacy topic link                        <- OLD FIELD

  // ... rest of fields
}
```

**Association Flow**:
1. Note is created with `topicId` (legacy, single)
2. Later migrated to `topicIds` array (Phase 2.0)
3. Eventually replaced by Relationship system (`relationships[]`)

### 3.3 Association with Tasks

**Task Interface**: `/Users/jamesmcarthur/Documents/taskerino/src/types.ts` (lines 654-714)

```typescript
export interface Task {
  // Core fields
  id: string;
  title: string;
  topicId?: string;          // Optional link to topic (line 662)
  companyIds?: string[];     // Links to Company entities
  contactIds?: string[];     // Links to Contact entities
  
  /**
   * @deprecated Use relationships array instead
   * Relationship system (future)
   */
  relationships?: Relationship[];
  relationshipVersion?: number;
  
  // ... rest of fields
}
```

**Key Points:**
- Tasks have **optional** single `topicId`
- Unlike notes (which often have topics), tasks link to topics conditionally
- Task-Topic links created during AI processing if primary topic detected

---

## 4. RELATIONSHIP MANAGER INTEGRATION

### Location: `/Users/jamesmcarthur/Documents/taskerino/src/types/relationships.ts` (comprehensive relationship system)

#### Relationship Types for Topics (lines 35-58)
```typescript
export const RelationshipType = {
  // Current types - Phase 1
  TASK_NOTE: 'task-note',
  TASK_SESSION: 'task-session',
  NOTE_SESSION: 'note-session',
  TASK_TOPIC: 'task-topic',          // Tasks → Topics
  NOTE_TOPIC: 'note-topic',          // Notes → Topics
  NOTE_COMPANY: 'note-company',
  NOTE_CONTACT: 'note-contact',
  NOTE_PARENT: 'note-parent',
  TASK_COMPANY: 'task-company',
  TASK_CONTACT: 'task-contact',
  SESSION_COMPANY: 'session-company',
  SESSION_CONTACT: 'session-contact',
  // ... future types
};
```

#### Relationship Creation in NotesContext

**File**: `/Users/jamesmcarthur/Documents/taskerino/src/context/NotesContext.tsx` (lines 214-226)

```typescript
// When adding a note, create relationships for linked topics
if (relationshipsContext && note.status !== 'draft') {
  try {
    // Create relationships for topics
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

#### Linking/Unlinking Topics to Notes

**File**: `/Users/jamesmcarthur/Documents/taskerino/src/context/NotesContext.tsx` (lines 667-704)

```typescript
const linkNoteToTopic = React.useCallback(async (noteId: string, topicId: string) => {
  if (!relationshipsContext) {
    console.warn('[NotesContext] RelationshipContext not available - skipping linkNoteToTopic');
    return;
  }

  try {
    await relationshipsContext.addRelationship({
      sourceType: EntityType.NOTE,
      sourceId: noteId,
      targetType: EntityType.TOPIC,
      targetId: topicId,
      type: RelationshipType.NOTE_TOPIC,
      metadata: { source: 'manual', createdAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[NotesContext] Failed to link note to topic:', error);
    throw error;
  }
}, [relationshipsContext]);

const unlinkNoteFromTopic = React.useCallback(async (noteId: string, topicId: string) => {
  if (!relationshipsContext) {
    console.warn('[NotesContext] RelationshipContext not available - skipping unlinkNoteFromTopic');
    return;
  }

  try {
    const relationships = relationshipsContext.getRelationships(noteId, RelationshipType.NOTE_TOPIC);
    const rel = relationships.find(r => r.targetId === topicId);
    if (rel) {
      await relationshipsContext.removeRelationship(rel.id);
    }
  } catch (error) {
    console.error('[NotesContext] Failed to unlink note from topic:', error);
    throw error;
  }
}, [relationshipsContext]);
```

**Key Points:**
- Relationship Manager is optional (graceful fallback if unavailable)
- Topics use `NOTE_TOPIC` relationship type for notes
- Topics use `TASK_TOPIC` relationship type for tasks
- Full metadata tracking (source, createdAt)
- Bidirectional linking supported (link/unlink)

---

## 5. TOPIC MANAGEMENT UI COMPONENTS

### 5.1 TopicPillManager Component

**Location**: `/Users/jamesmcarthur/Documents/taskerino/src/components/TopicPillManager.tsx` (310 lines)

**Features**:
- Single-select topic picker (unlike multi-select ContactPillManager)
- Inline editable pill display
- Dropdown with autocomplete/filter
- Empty state with "+ Add topic" prompt
- Glass morphism design
- Keyboard accessible

#### Interface (lines 21-39)
```typescript
export interface TopicPillManagerProps {
  /** Current topic ID (single value, not array) */
  topicId?: string;

  /** Callback when topic changes (undefined = removed) */
  onTopicChange: (topicId: string | undefined) => void;

  /** All available topics */
  allTopics: Topic[];

  /** Can user edit? */
  editable: boolean;

  /** Custom CSS classes */
  className?: string;

  /** Optional callback when a new topic is created */
  onCreateTopic?: (name: string) => Promise<Topic>;
}
```

#### Key Functions (lines 44-310)
```typescript
export function TopicPillManager({
  topicId,
  onTopicChange,
  allTopics,
  editable,
  className = '',
  onCreateTopic,
}: TopicPillManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Get current topic
  const currentTopic = allTopics.find(t => t.id === topicId);

  // Filter topics by search query
  const filteredTopics = searchQuery
    ? allTopics.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allTopics;

  // Handle topic selection
  const handleSelectTopic = (topic: Topic) => {
    onTopicChange(topic.id);
    setIsEditing(false);
    setSearchQuery('');
  };

  // Handle topic removal
  const handleRemoveTopic = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTopicChange(undefined);
  };

  // Handle create new topic
  const handleCreateTopic = async () => {
    if (!onCreateTopic || !searchQuery.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const newTopic = await onCreateTopic(searchQuery.trim());
      // Select the new topic
      onTopicChange(newTopic.id);
      setSearchQuery('');
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to create topic:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Render current topic pill or empty state
  // ...
}
```

### 5.2 Usage in TaskDetailInline

**Location**: `/Users/jamesmcarthur/Documents/taskerino/src/components/TaskDetailInline.tsx` (lines 16, 27, 516)

```typescript
import { useEntities } from '../context/EntitiesContext';

// In component:
const { state: entitiesState, addCompany, addContact, addTopic } = useEntities();

// Render:
<TopicPillManager
  topicId={task.topicId}
  onTopicChange={(topicId) => {
    updateTask({ ...task, topicId });
  }}
  allTopics={entitiesState.topics}
  editable={isEditing}
  onCreateTopic={async (name) => {
    const newTopic: Topic = {
      id: generateId(),
      name,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      noteCount: 0,
    };
    addTopic(newTopic);
    return newTopic;
  }}
/>
```

---

## 6. AI CAPTURE SYSTEM - TOPIC CREATION

### 6.1 AI Processing Pipeline

**Location**: `/Users/jamesmcarthur/Documents/taskerino/src/services/claudeService.ts` (1000+ lines)

#### Topic Detection in AI (lines 816-869)
```typescript
// Step 2: Process PRIMARY topic first (most important)
processingSteps.push('Identifying primary topic...');

const topicResults = [];
let primaryTopicResult = null;

if (aiResponse.primaryTopic) {
  const primary = aiResponse.primaryTopic;
  const matchedTopic = findMatchingTopic(primary.name, existingTopics);

  if (matchedTopic) {
    // Existing topic found via fuzzy matching
    const confidence = calculateMatchConfidence(primary.name, matchedTopic);
    primaryTopicResult = {
      name: matchedTopic.name,
      type: primary.type || 'company',
      confidence,
      existingTopicId: matchedTopic.id,  // Link to existing
    };
  } else {
    // New topic to create
    primaryTopicResult = {
      name: primary.name,
      type: primary.type || 'company',
      confidence: 1.0,
    };
  }

  topicResults.push(primaryTopicResult);
}

// Step 3: Process SECONDARY topics (people, features, etc.)
processingSteps.push('Detecting related topics...');

if (aiResponse.secondaryTopics) {
  for (const secondary of aiResponse.secondaryTopics) {
    const matchedTopic = findMatchingTopic(secondary.name, existingTopics);

    if (matchedTopic) {
      topicResults.push({
        name: matchedTopic.name,
        type: secondary.type || 'other',
        confidence: calculateMatchConfidence(secondary.name, matchedTopic),
        existingTopicId: matchedTopic.id,
      });
    } else {
      // Create secondary topic
      topicResults.push({
        name: secondary.name,
        type: secondary.type || 'other',
        confidence: 1.0,
      });
    }
  }
}
```

#### AI Response Structure (lines 89-105)
```typescript
// Topic list provided to Claude
const topicList = existingTopics.map(t => t.name).join(', ') || 'None yet';

// In prompt:
const existingNotesText = existingNotes
  .map(n => {
    const topic = existingTopics.find(t => t.id === n.topicId);
    return `[${topic?.name || 'Unknown'}] ${n.summary}`;
  })
  .join('\n');

// Prompt includes:
Topics: ${topicList}
```

### 6.2 AIProcessResult Structure

**Location**: `/Users/jamesmcarthur/Documents/taskerino/src/types.ts` (lines 718-778)

```typescript
export interface AIProcessResult {
  // AI guidance
  aiSummary?: string;

  // What the AI detected
  detectedTopics: {
    name: string;
    type: 'company' | 'person' | 'other';
    confidence: number; // 0-1
    existingTopicId?: string; // If matched to existing
  }[];

  // What was created/updated
  notes: {
    topicId: string;        // PRIMARY topic ID for this note
    topicName: string;
    content: string;
    summary: string;
    // ...
    relatedTopics?: string[]; // Related topic names
  }[];

  tasks: {
    title: string;
    // ...
    topicId?: string;        // Link to primary topic
    // ...
  }[];

  // Overall analysis
  keyTopics: string[];       // Tags/keywords (not entity IDs)
  processingSteps: string[];
}
```

### 6.3 Topic Creation in CaptureZone

**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/CaptureZone.tsx`

The flow is:
1. User input → Claude API
2. AI detects `primaryTopic` and `secondaryTopics`
3. Claude matches against existing topics (fuzzy matching)
4. `AIProcessResult.detectedTopics` contains results
5. CaptureReview UI shows detected topics
6. User saves → Topics created in EntitiesContext if new
7. Notes/Tasks linked to primary topic

---

## 7. CONTEXT IMPLEMENTATION

### 7.1 EntitiesContext

**Location**: `/Users/jamesmcarthur/Documents/taskerino/src/context/EntitiesContext.tsx` (247 lines)

**State Structure** (lines 8-12):
```typescript
interface EntitiesState {
  companies: Company[];
  contacts: Contact[];
  topics: Topic[];
}
```

**Actions** (lines 14-32):
```typescript
type EntitiesAction =
  // Topic actions
  | { type: 'ADD_TOPIC'; payload: Topic }
  | { type: 'UPDATE_TOPIC'; payload: Topic }
  | { type: 'DELETE_TOPIC'; payload: string }
  | { type: 'CREATE_MANUAL_TOPIC'; payload: ManualTopicData }

  // Company/Contact actions
  // ...

  // Data management
  | { type: 'LOAD_ENTITIES'; payload: Partial<EntitiesState> };
```

**Topic Reducer Logic** (lines 81-96):
```typescript
case 'ADD_TOPIC':
  return { ...state, topics: [...state.topics, action.payload] };

case 'UPDATE_TOPIC':
  return {
    ...state,
    topics: state.topics.map(topic =>
      topic.id === action.payload.id ? action.payload : topic
    ),
  };

case 'DELETE_TOPIC':
  return {
    ...state,
    topics: state.topics.filter(topic => topic.id !== action.payload),
  };

case 'CREATE_MANUAL_TOPIC': {
  const topicData = action.payload;
  const timestamp = new Date().toISOString();
  const id = generateId();

  const newTopic: Topic = {
    id,
    name: topicData.name,
    createdAt: timestamp,
    lastUpdated: timestamp,
    noteCount: 0,
  };
  return { ...state, topics: [...state.topics, newTopic] };
}
```

**Hook Usage** (lines 223-247):
```typescript
export function useEntities() {
  const context = useContext(EntitiesContext);
  if (!context) {
    throw new Error('useEntities must be used within EntitiesProvider');
  }

  const addTopic = (topic: Topic) => {
    context.dispatch({ type: 'ADD_TOPIC', payload: topic });
  };

  return {
    ...context,
    addTopic,  // Exposed helper method
    // addCompany, addContact, ...
  };
}
```

### 7.2 RelationshipContext (Phase 2.0)

**Location**: `/Users/jamesmcarthur/Documents/taskerino/src/context/RelationshipContext.tsx`

**Key Relationship Types for Topics** (from types/relationships.ts):
- `NOTE_TOPIC`: Note → Topic link
- `TASK_TOPIC`: Task → Topic link

**Usage Pattern**:
```typescript
const { addRelationship, getRelationships, removeRelationship } = useRelationships();

// Create relationship
await addRelationship({
  sourceType: EntityType.NOTE,
  sourceId: noteId,
  targetType: EntityType.TOPIC,
  targetId: topicId,
  type: RelationshipType.NOTE_TOPIC,
  metadata: { source: 'manual', createdAt: new Date().toISOString() }
});
```

---

## 8. LEGACY vs NEW SYSTEMS

### Migration Status

**File**: `/Users/jamesmcarthur/Documents/taskerino/src/types.ts` (lines 3-84)

#### Legacy Fields (Currently Active)
```typescript
// In Note
topicId?: string;           // DEPRECATED but still widely used (175 occurrences, 31 files)
topicIds?: string[];        // New plural array (Phase 2)

// In Task
topicId?: string;           // Single optional topic link

// In ManualNoteData
topicId?: string;
newTopicName?: string;
newTopicType?: 'company' | 'person' | 'other';

// In ManualTaskData
topicId?: string;
```

#### New System (Phase 2.0+)
```typescript
// In Note & Task
relationships?: Relationship[];     // Unified relationship array
relationshipVersion?: number;       // 0 = legacy, 1 = migrated
```

#### Migration Timeline
- **Status**: In progress, check `relationshipVersion` field
- **Deprecated Since**: October 2025
- **Migration Pattern**: Gradual via relationshipVersion field
- **Estimated Removal**: 2-3 months (v2.0 when complete)

---

## 9. KEY FINDINGS

### Topics DO Use Relationship Manager
- ✅ RelationshipContext supports `NOTE_TOPIC` and `TASK_TOPIC` relationship types
- ✅ NotesContext creates relationships when notes are approved
- ✅ Relationship metadata includes source (ai/manual), confidence, reasoning
- ✅ Full link/unlink methods provided in NotesContext

### Topics Are NOT Just Arrays
- ✅ Topics are proper entities with their own storage
- ✅ Maintained separately in EntitiesContext
- ✅ Each topic tracks `noteCount` for aggregate displays
- ✅ Can be created, updated, deleted independently

### AI Capture Creates Topics Intelligently
- ✅ Claude detects primary + secondary topics
- ✅ Fuzzy matching against existing topics
- ✅ Confidence scoring for matches
- ✅ New topics created on-demand
- ✅ Topics associated with notes and tasks

### Dual Association Approach
- ✅ Notes support `topicId` (legacy) and `topicIds[]` (new) and `relationships[]` (future)
- ✅ Tasks support `topicId` (single optional link)
- ✅ Relationship manager handles both
- ✅ Graceful fallback if RelationshipContext unavailable

---

## 10. FILE REFERENCE SUMMARY

| Component | Location | Lines | Purpose |
|-----------|----------|-------|---------|
| Topic Interface | `/src/types.ts` | 547-553 | Type definition |
| AIProcessResult | `/src/types.ts` | 718-778 | AI processing output structure |
| ManualTopicData | `/src/types.ts` | 1110-1114 | Manual topic creation input |
| RelationshipType | `/src/types/relationships.ts` | 35-58 | Defines NOTE_TOPIC, TASK_TOPIC |
| EntitiesContext | `/src/context/EntitiesContext.tsx` | 1-247 | Topic state management |
| NotesContext | `/src/context/NotesContext.tsx` | 1-800+ | Topic association with notes |
| TasksContext | `/src/context/TasksContext.tsx` | 1-200+ | Topic association with tasks |
| TopicPillManager | `/src/components/TopicPillManager.tsx` | 1-310 | Topic selection UI component |
| TaskDetailInline | `/src/components/TaskDetailInline.tsx` | 1-600+ | Task topic editor (uses TopicPillManager) |
| claudeService | `/src/services/claudeService.ts` | 816-869 | AI topic detection and processing |
| CaptureReview | `/src/components/capture/CaptureReview.tsx` | 1-400+ | AI result review interface |

---

## 11. RELATIONSHIPS TO OTHER SYSTEMS

### Topics ↔ Notes
- Notes have `topicId` (single, legacy) OR `topicIds[]` (array, new)
- Topics track `noteCount` for aggregate displays
- NotesContext updates topic `noteCount` when notes added/removed
- Relationship system: `NOTE_TOPIC` type

### Topics ↔ Tasks
- Tasks have `topicId` (optional single link)
- Tasks linked to primary topic during AI processing
- Relationship system: `TASK_TOPIC` type

### Topics ↔ Sessions
- Sessions don't directly link to topics
- Session recommendations suggest tasks/notes that relate to topics
- Indirect via notes/tasks extracted from sessions

### Topics ↔ Companies/Contacts
- Topics are separate from Company and Contact entities
- All three are managed by EntitiesContext
- Different relationship types: `NOTE_TOPIC` vs `NOTE_COMPANY` vs `NOTE_CONTACT`

---

## 12. CRITICAL IMPLEMENTATION DETAILS

### noteCount Tracking
Topics maintain a `noteCount` that is updated whenever notes are added or deleted:
```typescript
// In NotesContext.addNote():
linkedTopicIds.forEach(id => {
  const topic = topicsMap.get(id);
  if (topic) {
    entitiesContext.dispatch({
      type: 'UPDATE_TOPIC',
      payload: {
        ...topic,
        noteCount: topic.noteCount + 1,
        lastUpdated: timestamp,
      },
    });
  }
});
```

### Fuzzy Topic Matching
AI uses fuzzy matching to find existing topics:
```typescript
const matchedTopic = findMatchingTopic(primary.name, existingTopics);
if (matchedTopic) {
  const confidence = calculateMatchConfidence(primary.name, matchedTopic);
  // Use existing topic with confidence score
}
```

### Default Fallback Topic
If no topic provided, "Uncategorized" topic is created automatically.

### RelationshipContext Graceful Degradation
Relationship creation is wrapped in try-catch and skipped if RelationshipContext unavailable:
```typescript
if (relationshipsContext && note.status !== 'draft') {
  try {
    // Create relationships
  } catch (error) {
    console.error('[NotesContext] Failed to create note relationships:', error);
  }
}
```

