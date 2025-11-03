# STORAGE LAYER QUICK REFERENCE

## What Gets Persisted and Where

### Collections Stored
```
notes          → Note[]
tasks          → Task[]
sessions       → Session[]
companies      → Company[]
contacts       → Contact[]
topics         → Topic[]
```

### How Each Is Saved

**Notes, Tasks, Sessions, Companies, Contacts, Topics:**
- Saved as complete arrays to storage
- Debounced 5 seconds from context state changes
- Compressed with Gzip (50-70% reduction)
- Persisted to Tauri file system OR IndexedDB

## Relationships: THE KEY INSIGHT

**Relationships are NOT in a separate collection!**

Instead:
- Each entity has a `relationships: Relationship[]` array
- Both directions of bidirectional relationships are stored
- RelationshipManager scans all 6 entity collections at startup to rebuild index

```typescript
// WHEN YOU CREATE A NOTE-TOPIC RELATIONSHIP:

// On the Note:
note.relationships = [
  {
    id: 'rel-1',
    type: 'note-topic',
    sourceType: 'note',
    sourceId: 'note-123',
    targetType: 'topic',
    targetId: 'topic-1',
    canonical: true,
    metadata: { source: 'ai', confidence: 0.92 }
  }
]

// On the Topic:
topic.relationships = [
  {
    id: 'rel-2',  // Different ID!
    type: 'note-topic',
    sourceType: 'topic',
    sourceId: 'topic-1',
    targetType: 'note',
    targetId: 'note-123',
    canonical: false,  // Reverse direction
    metadata: { source: 'ai', confidence: 0.92 }
  }
]

// BOTH get saved when you call:
await storage.save('notes', state.notes);
await storage.save('topics', state.topics);
```

## Tags vs Relationships

**Tags:** Simple string arrays
```typescript
task.tags = ['backend', 'security', 'urgent']
```

**Relationships:** Rich links with metadata
```typescript
task.relationships = [
  {
    type: 'task-note',
    targetId: 'note-123',
    metadata: {
      source: 'ai',
      confidence: 0.88,
      reasoning: 'Task extracted from note'
    }
  }
]
```

## File Persistence Format

All data stored in this format:

```typescript
{
  version: 1,
  checksum: "abc123...",        // SHA-256 for integrity
  timestamp: 1730459000,
  compressed: true,             // Is the data gzipped?
  data: "H4sIAAAA..."           // Actual data (compressed)
}
```

## Critical Gaps Found

1. **No relationships collection** - Scattered across all entities
   - On startup: O(n) scan of all entities to rebuild relationship index
   - No dedicated 'relationships' collection

2. **Implicit relationship persistence**
   - RelationshipManager updates entity in storage
   - But NotesContext/TasksContext must save for persistence
   - If context save fails, relationship is lost

3. **No inter-context notification**
   - When RelationshipManager adds a relationship
   - NotesContext/TasksContext doesn't know about it
   - Might miss the save if entity wasn't modified

## Files to Check

| Task | File | Lines |
|------|------|-------|
| Understand storage adapters | `src/services/storage/index.ts` | 27-95 |
| See how Tauri saves | `src/services/storage/TauriFileSystemAdapter.ts` | 97-335 |
| See how web saves | `src/services/storage/IndexedDBAdapter.ts` | 345-1300 |
| See relationship types | `src/types/relationships.ts` | 1-648 |
| See relationship manager | `src/services/relationshipManager.ts` | 180-407 |
| See note saving | `src/context/NotesContext.tsx` | 129-144 |
| See task saving | `src/context/TasksContext.tsx` | 162-185 |
| See entity saving | `src/context/EntitiesContext.tsx` | 186-213 |

## Summary Table

| What | Where | Format | Linked To |
|------|-------|--------|-----------|
| Notes | `notes` collection | Note[] with relationships[] | Topics, Companies, Contacts via relationships[] OR topicIds/companyIds/contactIds |
| Tasks | `tasks` collection | Task[] with relationships[] | Notes, Topics, Sessions via relationships[] OR topicId |
| Topics | `topics` collection | Topic[] | NO direct note references (use relationships[]) |
| Companies | `companies` collection | Company[] | NO direct note references (use relationships[]) |
| Contacts | `contacts` collection | Contact[] | NO direct note references (use relationships[]) |

## The Bottom Line

Everything gets saved as **Gzip-compressed JSON arrays** to either:
- **Desktop:** Tauri file system (unlimited space)
- **Web:** IndexedDB (100s of MB)

Relationships are **embedded in entities**, making the system resilient but with startup indexing overhead.

