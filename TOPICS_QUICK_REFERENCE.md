# Taskerino Topics - Quick Reference Guide

## Key Files at a Glance

```
Type Definition
  /src/types.ts                          547-553        Topic interface

Storage & Context
  /src/context/EntitiesContext.tsx       1-247          Manage topics + companies + contacts
    - useEntities() hook
    - Actions: ADD_TOPIC, UPDATE_TOPIC, DELETE_TOPIC, CREATE_MANUAL_TOPIC
    - Storage: load/save via 'topics' key, debounced 5 seconds

Topic Association
  /src/context/NotesContext.tsx          554-612        createManualNote with topic creation
                                         146-276        addNote with topic linking
                                         667-704        linkNoteToTopic / unlinkNoteFromTopic
  /src/context/TasksContext.tsx          95             topicId field in tasks

Relationships (Phase 2.0)
  /src/types/relationships.ts            35-58          RelationshipType.NOTE_TOPIC, TASK_TOPIC
  /src/context/RelationshipContext.tsx   476            useRelationships() hook

UI Components
  /src/components/TopicPillManager.tsx   1-310          Single-select topic picker
  /src/components/TaskDetailInline.tsx   516            Usage of TopicPillManager

AI Processing
  /src/services/claudeService.ts         816-869        Topic detection & matching
                                         71             Existing topics passed to Claude

AI Result Structure
  /src/types.ts                          718-778        AIProcessResult with detectedTopics
```

## Quick Code Examples

### Creating a Topic Manually

```typescript
import { useEntities } from '../context/EntitiesContext';

const { state, addTopic } = useEntities();

const newTopic: Topic = {
  id: generateId(),
  name: 'My Topic',
  createdAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  noteCount: 0,
};

addTopic(newTopic);
```

### Linking a Note to a Topic

```typescript
import { useNotes } from '../context/NotesContext';

const { linkNoteToTopic } = useNotes();

await linkNoteToTopic(noteId, topicId);
// Creates relationship: NOTE -> TOPIC with type 'note-topic'
```

### Creating a Note with a New Topic

```typescript
import { useNotes } from '../context/NotesContext';

const { createManualNote } = useNotes();

createManualNote({
  content: 'My note content',
  source: 'thought',
  newTopicName: 'New Topic Name',
  newTopicType: 'other',  // or 'company' or 'person'
});
// Automatically creates topic and links it to the note
```

### Using TopicPillManager in UI

```typescript
import { TopicPillManager } from './TopicPillManager';
import { useEntities } from '../context/EntitiesContext';

const { state: { topics }, addTopic } = useEntities();

<TopicPillManager
  topicId={selectedTopicId}
  onTopicChange={(topicId) => {
    // Update selected topic
  }}
  allTopics={topics}
  editable={true}
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

## Migration Path: topicId → relationships

### Current (Legacy)
```typescript
note.topicId = 'topic-123'
```

### Transition (Phase 2.0)
```typescript
note.topicId = 'topic-123'              // Still available for backward compat
note.topicIds = ['topic-123']           // New array format
note.relationships = [                  // Unified relationship system
  {
    id: 'rel-1',
    sourceId: 'note-1',
    sourceType: 'note',
    targetId: 'topic-123',
    targetType: 'topic',
    type: 'note-topic',
    metadata: { source: 'manual' }
  }
]
note.relationshipVersion = 1            // Indicates migration status
```

### Future (v2.0+)
```typescript
// topicId deprecated
// topicIds deprecated
// Only relationships array used
note.relationships = [...]
note.relationshipVersion = 1
```

## Topic Data Flow: AI Capture

1. **User Input** → Claude API
   - File: `claudeService.ts` processInput()

2. **Topic Detection** → Lines 816-869
   - Claude detects `primaryTopic` + `secondaryTopics`
   - Fuzzy matching against `existingTopics`
   - Returns confidence scores

3. **Result Structure** → `AIProcessResult.detectedTopics`
   - name, type, confidence, existingTopicId

4. **UI Review** → `CaptureReview` component
   - User can review detected topics

5. **Save** → Topics created + Notes linked
   - Creates new topics if needed
   - Links notes to primary topic
   - Creates tasks linked to primary topic

## Topic noteCount Tracking

Topics maintain a count of linked notes for display:

```typescript
// When note added with topicId:
topic.noteCount++

// When note deleted with topicId:
topic.noteCount--

// Updated in EntitiesContext via:
entitiesContext.dispatch({
  type: 'UPDATE_TOPIC',
  payload: {
    ...topic,
    noteCount: topic.noteCount + 1,
    lastUpdated: timestamp
  }
})
```

## Important Implementation Details

1. **Default Fallback**: If no topic provided, "Uncategorized" topic auto-created
2. **Single vs Array**:
   - Notes: `topicId` (single) + `topicIds` (array) + `relationships`
   - Tasks: `topicId` (single optional)
3. **Type Flexibility**: Topics can represent companies, people, or other categories via `type` field
4. **RelationshipContext is Optional**: Graceful degradation if not available
5. **Storage**: Debounced 5-second save in EntitiesContext

## Testing Notes

- Topic creation tested via `createManualNote` in NotesContext
- Topic linking tested via `linkNoteToTopic` / `unlinkNoteFromTopic`
- AI topic detection tested via claudeService with mock data
- UI component tested via TopicPillManager tests
- Migration status tracked via `relationshipVersion` field

## Common Queries

**Q: How do I get all notes for a topic?**
A: Filter `notes.topicId === topicId` or query relationships with `type='note-topic'` and `targetId=topicId`

**Q: Can a note have multiple topics?**
A: Legacy: one `topicId`. New: `topicIds[]` array. Future: `relationships[]`

**Q: Where are topics persisted?**
A: In storage under key `'topics'` via EntitiesContext, debounced 5 seconds

**Q: Can AI create topics?**
A: Yes, Claude detects topics and they're created on-demand during capture

**Q: Do topics have hierarchies?**
A: No, topics are flat. Use companies/contacts for organizational hierarchy

**Q: What's the difference between Topic, Company, Contact?**
A: All are entities managed by EntitiesContext. Topics are lightweight, Companies/Contacts have profiles
