# Context Integration Architecture

**Phase:** C2 - Context Integration
**Status:** Complete
**Version:** 1.0.0
**Last Updated:** 2025-10-24

This document describes the integration of RelationshipContext with the existing TasksContext, NotesContext, SessionListContext, and ActiveSessionContext. This integration enables relationship management across all entity types in the Taskerino application.

---

## Table of Contents

1. [Overview](#overview)
2. [Provider Hierarchy](#provider-hierarchy)
3. [Integration Patterns](#integration-patterns)
4. [API Reference](#api-reference)
5. [Usage Examples](#usage-examples)
6. [Migration Guide](#migration-guide)
7. [Backward Compatibility](#backward-compatibility)
8. [Troubleshooting](#troubleshooting)
9. [Testing Guide](#testing-guide)

---

## Overview

The Context Integration layer connects the relationship management system with the existing entity contexts (tasks, notes, sessions). This enables:

- **Automatic relationship creation** when entities are linked
- **Cascade deletion** of relationships when entities are removed
- **Helper methods** for manual relationship management
- **Backward compatibility** with legacy field-based linking (noteId, sourceSessionId, etc.)

### Design Principles

1. **Non-Breaking**: All existing code continues to work during migration
2. **Gradual Adoption**: Relationships created alongside legacy fields
3. **Fail-Safe**: RelationshipContext unavailability doesn't break app
4. **Transparent**: Users don't see the migration happening

---

## Provider Hierarchy

The provider hierarchy determines the order in which contexts are initialized and their dependencies on each other.

```
SettingsProvider
  └─ UIProvider
      └─ ScrollAnimationProvider
          └─ RelationshipProvider ← NEW (Phase C2)
              └─ EntitiesProvider
                  └─ NotesProvider
                      └─ TasksProvider
                          └─ EnrichmentProvider
                              └─ SessionListProvider
                                  └─ ActiveSessionProvider
                                      └─ RecordingProvider
                                          └─ SessionsProvider (DEPRECATED)
                                              └─ AppProvider (DEPRECATED)
                                                  └─ AppContent
```

### Key Positioning

- **RelationshipProvider** is placed **before EntitiesProvider** so that all entity contexts can access relationships
- **After UIProvider** to ensure settings and UI state are available
- **Before SessionListProvider** so session operations can create relationships

### Implementation

```typescript
// src/App.tsx
export default function App() {
  return (
    <SettingsProvider>
      <UIProvider>
        <ScrollAnimationProvider>
          {/* Phase C2: Add RelationshipProvider before EntitiesProvider */}
          <RelationshipProvider>
            <EntitiesProvider>
              <NotesProvider>
                <TasksProvider>
                  {/* ... other providers */}
                </TasksProvider>
              </NotesProvider>
            </EntitiesProvider>
          </RelationshipProvider>
        </ScrollAnimationProvider>
      </UIProvider>
    </SettingsProvider>
  );
}
```

---

## Integration Patterns

### Pattern 1: Automatic Relationship Creation

When entities are created with legacy link fields, relationships are automatically created.

```typescript
// In TasksContext
const addTask = async (task: Task) => {
  // Add task to state
  context.dispatch({ type: 'ADD_TASK', payload: task });

  // Create relationships if specified
  if (relationshipsContext && task.noteId) {
    await relationshipsContext.addRelationship({
      sourceType: EntityType.TASK,
      sourceId: task.id,
      targetType: EntityType.NOTE,
      targetId: task.noteId,
      type: RelationshipType.TASK_NOTE,
      metadata: { source: 'manual', createdAt: new Date().toISOString() },
    });
  }
};
```

### Pattern 2: Cascade Deletion

When entities are deleted, all their relationships are removed first.

```typescript
// In TasksContext
const deleteTask = async (taskId: string) => {
  // Delete relationships first
  if (relationshipsContext) {
    const relationships = relationshipsContext.getRelationships(taskId);
    for (const rel of relationships) {
      await relationshipsContext.removeRelationship(rel.id);
    }
  }

  // Then delete task
  context.dispatch({ type: 'DELETE_TASK', payload: taskId });
};
```

### Pattern 3: Graceful Degradation

All contexts handle RelationshipContext unavailability gracefully.

```typescript
// In NotesContext
let relationshipsContext;
try {
  relationshipsContext = useRelationships();
} catch {
  // RelationshipContext not available yet - that's OK during migration
  relationshipsContext = null;
}

// Later...
if (relationshipsContext) {
  // Create relationships
} else {
  console.warn('[NotesContext] RelationshipContext not available - skipping relationship creation');
}
```

---

## API Reference

### TasksContext

#### New Methods

**`linkTaskToNote(taskId: string, noteId: string): Promise<void>`**

Manually create a TASK_NOTE relationship.

```typescript
await linkTaskToNote('task-123', 'note-456');
```

**`unlinkTaskFromNote(taskId: string, noteId: string): Promise<void>`**

Remove a TASK_NOTE relationship.

```typescript
await unlinkTaskFromNote('task-123', 'note-456');
```

**`linkTaskToSession(taskId: string, sessionId: string): Promise<void>`**

Manually create a TASK_SESSION relationship.

```typescript
await linkTaskToSession('task-123', 'session-789');
```

**`unlinkTaskFromSession(taskId: string, sessionId: string): Promise<void>`**

Remove a TASK_SESSION relationship.

```typescript
await unlinkTaskFromSession('task-123', 'session-789');
```

#### Updated Methods

**`addTask(task: Task): Promise<void>`**

Now automatically creates relationships if `noteId` or `sourceSessionId` are present.

**`deleteTask(taskId: string): Promise<void>`**

Now cascades deletion to all related relationships.

---

### NotesContext

#### New Methods

**`linkNoteToTopic(noteId: string, topicId: string): Promise<void>`**

Manually create a NOTE_TOPIC relationship.

```typescript
await linkNoteToTopic('note-123', 'topic-456');
```

**`unlinkNoteFromTopic(noteId: string, topicId: string): Promise<void>`**

Remove a NOTE_TOPIC relationship.

**`linkNoteToCompany(noteId: string, companyId: string): Promise<void>`**

Manually create a NOTE_COMPANY relationship.

**`unlinkNoteFromCompany(noteId: string, companyId: string): Promise<void>`**

Remove a NOTE_COMPANY relationship.

**`linkNoteToContact(noteId: string, contactId: string): Promise<void>`**

Manually create a NOTE_CONTACT relationship.

**`unlinkNoteFromContact(noteId: string, contactId: string): Promise<void>`**

Remove a NOTE_CONTACT relationship.

#### Updated Methods

**`addNote(note: Note): Promise<void>`**

Now automatically creates relationships for:
- `topicIds` → NOTE_TOPIC
- `companyIds` → NOTE_COMPANY
- `contactIds` → NOTE_CONTACT
- `sourceSessionId` → NOTE_SESSION

**`deleteNote(noteId: string): Promise<void>`**

Now cascades deletion to all related relationships.

---

### SessionListContext

#### New Methods

**`linkSessionToTask(sessionId: string, taskId: string, metadata?: { confidence?: number; reasoning?: string }): Promise<void>`**

Create a TASK_SESSION relationship with optional AI metadata.

```typescript
await linkSessionToTask('session-123', 'task-456', {
  confidence: 0.9,
  reasoning: 'Task extracted from session discussion about authentication',
});
```

**`linkSessionToNote(sessionId: string, noteId: string, metadata?: { confidence?: number; reasoning?: string }): Promise<void>`**

Create a NOTE_SESSION relationship with optional AI metadata.

```typescript
await linkSessionToNote('session-123', 'note-789', {
  confidence: 0.85,
  reasoning: 'Note contains key decisions from session',
});
```

---

### ActiveSessionContext

#### Updated Behavior

**`startSession(config): Promise<void>`**

Now marks sessions with `relationshipVersion: 1` to indicate they use the new relationship system.

**`addExtractedTask(taskId: string): void`**

Still maintains backward compatibility with `extractedTaskIds` array. The actual relationship should be created using `SessionListContext.linkSessionToTask()`.

**`addExtractedNote(noteId: string): void`**

Still maintains backward compatibility with `extractedNoteIds` array. The actual relationship should be created using `SessionListContext.linkSessionToNote()`.

---

## Usage Examples

### Example 1: Creating a Task from a Note

```typescript
import { useTasks } from '@/context/TasksContext';
import { generateId } from '@/utils/helpers';

function MyComponent() {
  const { addTask } = useTasks();

  const handleCreateTaskFromNote = async (noteId: string) => {
    const task = {
      id: generateId(),
      title: 'Follow up on meeting notes',
      description: 'Review and action items from discussion',
      priority: 'high',
      status: 'todo',
      done: false,
      noteId: noteId, // Link to note
      createdBy: 'manual',
      createdAt: new Date().toISOString(),
    };

    // Relationship will be created automatically
    await addTask(task);
  };

  return (
    <button onClick={() => handleCreateTaskFromNote('note-123')}>
      Create Task from Note
    </button>
  );
}
```

### Example 2: Linking Note to Multiple Entities

```typescript
import { useNotes } from '@/context/NotesContext';
import { generateId } from '@/utils/helpers';

function MyComponent() {
  const { addNote } = useNotes();

  const handleCreateNote = async () => {
    const note = {
      id: generateId(),
      content: 'Meeting with Acme Corp about Q4 strategy...',
      summary: 'Q4 Strategy Meeting',
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      source: 'manual',
      topicIds: ['topic-strategy', 'topic-q4-planning'],
      companyIds: ['company-acme'],
      contactIds: ['contact-john-doe'],
    };

    // Multiple relationships will be created automatically
    await addNote(note);
  };

  return <button onClick={handleCreateNote}>Create Note</button>;
}
```

### Example 3: Session Extracting Tasks

```typescript
import { useSessionList } from '@/context/SessionListContext';
import { useTasks } from '@/context/TasksContext';

function EnrichmentComponent({ sessionId }: { sessionId: string }) {
  const { linkSessionToTask } = useSessionList();
  const { addTask } = useTasks();

  const handleExtractTasks = async () => {
    // AI extracts tasks from session
    const extractedTasks = [
      {
        id: generateId(),
        title: 'Implement OAuth flow',
        description: 'Based on architecture discussion',
        priority: 'high',
        status: 'todo',
        done: false,
        createdBy: 'ai',
        createdAt: new Date().toISOString(),
      },
    ];

    for (const task of extractedTasks) {
      // Add task
      await addTask(task);

      // Link to session with AI metadata
      await linkSessionToTask(sessionId, task.id, {
        confidence: 0.9,
        reasoning: 'Task mentioned multiple times during architecture discussion',
      });
    }
  };

  return <button onClick={handleExtractTasks}>Extract Tasks</button>;
}
```

### Example 4: Manual Relationship Management

```typescript
import { useTasks } from '@/context/TasksContext';

function TaskDetailPanel({ taskId }: { taskId: string }) {
  const { linkTaskToNote, unlinkTaskFromNote } = useTasks();

  const handleLinkNote = async (noteId: string) => {
    await linkTaskToNote(taskId, noteId);
    console.log('Task linked to note');
  };

  const handleUnlinkNote = async (noteId: string) => {
    await unlinkTaskFromNote(taskId, noteId);
    console.log('Task unlinked from note');
  };

  return (
    <div>
      <button onClick={() => handleLinkNote('note-123')}>
        Link to Note
      </button>
      <button onClick={() => handleUnlinkNote('note-123')}>
        Unlink from Note
      </button>
    </div>
  );
}
```

### Example 5: Cross-Context Operations

```typescript
import { useTasks } from '@/context/TasksContext';
import { useNotes } from '@/context/NotesContext';
import { useRelationships } from '@/context/RelationshipContext';
import { RelationshipType } from '@/types/relationships';

function LinkedTasksView({ noteId }: { noteId: string }) {
  const { state: tasksState } = useTasks();
  const { getRelationships } = useRelationships();

  // Get all tasks linked to this note
  const linkedTaskRelationships = getRelationships(noteId, RelationshipType.TASK_NOTE);
  const linkedTasks = tasksState.tasks.filter(task =>
    linkedTaskRelationships.some(rel => rel.sourceId === task.id)
  );

  return (
    <div>
      <h3>Linked Tasks ({linkedTasks.length})</h3>
      <ul>
        {linkedTasks.map(task => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Migration Guide

### For Existing Code

**No changes required!** All existing code that uses legacy fields (`noteId`, `sourceSessionId`, `extractedTaskIds`, etc.) continues to work. Relationships are created automatically alongside the legacy fields.

### For New Code

**Best Practice:** Use the relationship system for new features:

```typescript
// OLD (still works, but deprecated)
const task = {
  id: generateId(),
  title: 'Task',
  noteId: 'note-123', // Legacy field
};
await addTask(task);

// NEW (preferred for new code)
const task = {
  id: generateId(),
  title: 'Task',
  relationshipVersion: 1, // Explicitly mark as using new system
};
await addTask(task);
await linkTaskToNote(task.id, 'note-123'); // Create relationship explicitly
```

### Migration Timeline

- **Phase C2 (Current)**: Both systems active, relationships created alongside legacy fields
- **Phase 7**: Legacy fields deprecated but still readable
- **Phase 8**: Legacy fields removed, full migration to relationships

---

## Backward Compatibility

### Legacy Field Support

The following legacy fields are still supported during migration:

**Tasks:**
- `noteId` → Creates TASK_NOTE relationship
- `sourceSessionId` → Creates TASK_SESSION relationship

**Notes:**
- `topicId` → Creates NOTE_TOPIC relationship
- `topicIds` → Creates NOTE_TOPIC relationships
- `companyIds` → Creates NOTE_COMPANY relationships
- `contactIds` → Creates NOTE_CONTACT relationships
- `sourceSessionId` → Creates NOTE_SESSION relationship

**Sessions:**
- `extractedTaskIds` → Used by legacy code, relationships created via `linkSessionToTask()`
- `extractedNoteIds` → Used by legacy code, relationships created via `linkSessionToNote()`

### Version Marker

Entities created with the new system have `relationshipVersion: 1` set. This helps identify which entities have been migrated:

```typescript
if (task.relationshipVersion === 1) {
  // Use relationship system
  const relationships = getRelationships(task.id);
} else {
  // Use legacy fields
  const noteId = task.noteId;
}
```

---

## Troubleshooting

### Issue: Relationships Not Being Created

**Symptom:** Creating entities with legacy fields doesn't create relationships.

**Diagnosis:**
1. Check if RelationshipProvider is in the provider hierarchy
2. Verify RelationshipProvider is **before** the entity context
3. Check browser console for "RelationshipContext not available" warnings

**Solution:**
```typescript
// Ensure correct hierarchy in App.tsx
<RelationshipProvider>
  <EntitiesProvider>
    <NotesProvider>
      <TasksProvider>
        {/* ... */}
      </TasksProvider>
    </NotesProvider>
  </EntitiesProvider>
</RelationshipProvider>
```

### Issue: Relationships Not Deleted on Entity Deletion

**Symptom:** Deleting an entity leaves orphaned relationships.

**Diagnosis:**
1. Check if `deleteTask`/`deleteNote` is being called (not just dispatch)
2. Verify RelationshipContext is available
3. Check for errors in console

**Solution:**
```typescript
// Use the helper method, not dispatch directly
const { deleteTask } = useTasks();
await deleteTask(taskId); // This handles relationship cleanup
```

### Issue: "useRelationships must be used within RelationshipProvider" Error

**Symptom:** App crashes with hook error.

**Diagnosis:** RelationshipProvider is missing or in wrong position.

**Solution:** Ensure RelationshipProvider wraps all contexts that need relationships.

---

## Testing Guide

### Unit Testing Contexts

```typescript
import { renderHook, act } from '@testing-library/react';
import { useTasks } from '@/context/TasksContext';
import { RelationshipProvider } from '@/context/RelationshipContext';

describe('TasksContext with Relationships', () => {
  it('should create relationship when adding task with noteId', async () => {
    const { result } = renderHook(() => useTasks(), {
      wrapper: ({ children }) => (
        <RelationshipProvider>
          <TasksProvider>{children}</TasksProvider>
        </RelationshipProvider>
      ),
    });

    await act(async () => {
      await result.current.addTask({
        id: 'task-1',
        title: 'Test',
        noteId: 'note-1',
      });
    });

    // Verify relationship created
    // ...
  });
});
```

### Integration Testing

```typescript
import { render, waitFor } from '@testing-library/react';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <RelationshipProvider>
      <EntitiesProvider>
        <NotesProvider>
          <TasksProvider>
            <SessionListProvider>
              {children}
            </SessionListProvider>
          </TasksProvider>
        </NotesProvider>
      </EntitiesProvider>
    </RelationshipProvider>
  );
}

describe('Cross-Context Integration', () => {
  it('should link task to note across contexts', async () => {
    // Test implementation
  });
});
```

### Testing Backward Compatibility

```typescript
it('should work with legacy noteId field', async () => {
  const task = {
    id: 'task-1',
    title: 'Legacy Task',
    noteId: 'note-1', // Legacy field
  };

  await addTask(task);

  // Should still create relationship
  expect(relationshipManager.addRelationship).toHaveBeenCalled();
});
```

---

## Summary

The Context Integration layer successfully bridges the relationship system with existing entity contexts, enabling:

- Automatic relationship creation on entity operations
- Cascade deletion of relationships
- Helper methods for manual relationship management
- Full backward compatibility with legacy fields
- Graceful degradation when RelationshipContext is unavailable

This integration provides a smooth migration path from field-based linking to the new relationship system, ensuring existing code continues to work while enabling new relationship-based features.

---

**Next Steps:**
- Phase D: UI Integration - Add relationship visualizations to UI
- Phase E: Query & Search - Implement relationship-based queries
- Phase 7: Deprecate legacy fields
- Phase 8: Remove legacy fields, complete migration
