# AGENT TASK C2: Context Integration

**Objective:** Integrate RelationshipContext with existing TasksContext, NotesContext, and SessionsContext.

**Priority:** P1 (State Management)

**Dependencies:** C1 (Relationship Context)

**Complexity:** Medium

**Estimated Time:** 6-8 hours

---

## Detailed Requirements

### 1. Update TasksContext

**File:** `src/context/TasksContext.tsx`

Integrate relationship management into task operations:

```typescript
export function TasksProvider({ children }: { children: React.ReactNode }) {
  const { addRelationship, removeRelationship } = useRelationships();

  // Existing state...

  // Updated createTask to use relationships
  const createTask = useCallback(async (taskData: Partial<Task>) => {
    const task: Task = {
      id: generateId(),
      ...taskData,
      relationships: [], // Initialize empty
      relationshipVersion: 1, // Mark as new system
    };

    // Save task
    await storage.save('tasks', task);

    // Create relationships if specified
    if (taskData.noteId) {
      await addRelationship({
        sourceType: EntityType.TASK,
        sourceId: task.id,
        targetType: EntityType.NOTE,
        targetId: taskData.noteId,
        type: RelationshipType.TASK_NOTE,
        metadata: { source: 'manual' },
      });
    }

    if (taskData.sourceSessionId) {
      await addRelationship({
        sourceType: EntityType.TASK,
        sourceId: task.id,
        targetType: EntityType.SESSION,
        targetId: taskData.sourceSessionId,
        type: RelationshipType.TASK_SESSION,
        metadata: { source: 'manual' },
      });
    }

    setTasks(prev => [...prev, task]);
    return task;
  }, [addRelationship]);

  // Updated deleteTask to handle cascade
  const deleteTask = useCallback(async (taskId: string) => {
    // Get all relationships for this task
    const relationships = getRelationships(taskId);

    // Remove all relationships
    for (const rel of relationships) {
      await removeRelationship(rel.id);
    }

    // Delete task
    await storage.delete('tasks', taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, [removeRelationship, getRelationships]);

  // Add helper method: linkTaskToNote
  const linkTaskToNote = useCallback(async (taskId: string, noteId: string) => {
    return addRelationship({
      sourceType: EntityType.TASK,
      sourceId: taskId,
      targetType: EntityType.NOTE,
      targetId: noteId,
      type: RelationshipType.TASK_NOTE,
      metadata: { source: 'manual' },
    });
  }, [addRelationship]);

  // Add helper method: unlinkTaskFromNote
  const unlinkTaskFromNote = useCallback(async (taskId: string, noteId: string) => {
    const relationships = getRelationships(taskId, RelationshipType.TASK_NOTE);
    const rel = relationships.find(r => r.targetId === noteId);
    if (rel) {
      await removeRelationship(rel.id);
    }
  }, [removeRelationship, getRelationships]);

  // Updated context value
  const value = {
    // ... existing methods
    linkTaskToNote,
    unlinkTaskFromNote,
  };

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}
```

### 2. Update NotesContext

**File:** `src/context/NotesContext.tsx`

Similar integration for notes:

```typescript
export function NotesProvider({ children }: { children: React.ReactNode }) {
  const { addRelationship, removeRelationship, getRelationships } = useRelationships();

  // Updated createNote
  const createNote = useCallback(async (noteData: Partial<Note>) => {
    const note: Note = {
      id: generateId(),
      ...noteData,
      relationships: [],
      relationshipVersion: 1,
    };

    await storage.save('notes', note);

    // Create relationships for topics
    if (noteData.topicIds) {
      for (const topicId of noteData.topicIds) {
        await addRelationship({
          sourceType: EntityType.NOTE,
          sourceId: note.id,
          targetType: EntityType.TOPIC,
          targetId: topicId,
          type: RelationshipType.NOTE_TOPIC,
          metadata: { source: 'manual' },
        });
      }
    }

    // Create relationships for companies
    if (noteData.companyIds) {
      for (const companyId of noteData.companyIds) {
        await addRelationship({
          sourceType: EntityType.NOTE,
          sourceId: note.id,
          targetType: EntityType.COMPANY,
          targetId: companyId,
          type: RelationshipType.NOTE_COMPANY,
          metadata: { source: 'manual' },
        });
      }
    }

    // Create relationships for contacts
    if (noteData.contactIds) {
      for (const contactId of noteData.contactIds) {
        await addRelationship({
          sourceType: EntityType.NOTE,
          sourceId: note.id,
          targetType: EntityType.CONTACT,
          targetId: contactId,
          type: RelationshipType.NOTE_CONTACT,
          metadata: { source: 'manual' },
        });
      }
    }

    setNotes(prev => [...prev, note]);
    return note;
  }, [addRelationship]);

  // Helper methods
  const linkNoteToTopic = useCallback(async (noteId: string, topicId: string) => {
    return addRelationship({
      sourceType: EntityType.NOTE,
      sourceId: noteId,
      targetType: EntityType.TOPIC,
      targetId: topicId,
      type: RelationshipType.NOTE_TOPIC,
      metadata: { source: 'manual' },
    });
  }, [addRelationship]);

  const unlinkNoteFromTopic = useCallback(async (noteId: string, topicId: string) => {
    const relationships = getRelationships(noteId, RelationshipType.NOTE_TOPIC);
    const rel = relationships.find(r => r.targetId === topicId);
    if (rel) {
      await removeRelationship(rel.id);
    }
  }, [removeRelationship, getRelationships]);

  // ... similar for companies and contacts

  const value = {
    // ... existing methods
    linkNoteToTopic,
    unlinkNoteFromTopic,
    linkNoteToCompany,
    unlinkNoteFromCompany,
    linkNoteToContact,
    unlinkNoteFromContact,
  };

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}
```

### 3. Update SessionsContext

**File:** `src/context/SessionsContext.tsx`

Integrate with session operations:

```typescript
export function SessionsProvider({ children }: { children: React.ReactNode }) {
  const { addRelationship, removeRelationship, getRelationships } = useRelationships();

  // When session ends and tasks/notes extracted
  const endSession = useCallback(async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Extract tasks/notes...
    const extractedTasks = await extractTasksFromSession(session);
    const extractedNotes = await extractNotesFromSession(session);

    // Create relationships using new system
    for (const task of extractedTasks) {
      await addRelationship({
        sourceType: EntityType.TASK,
        sourceId: task.id,
        targetType: EntityType.SESSION,
        targetId: sessionId,
        type: RelationshipType.TASK_SESSION,
        metadata: {
          source: 'ai',
          confidence: 0.9,
          reasoning: 'Task extracted from session',
        },
      });
    }

    for (const note of extractedNotes) {
      await addRelationship({
        sourceType: EntityType.NOTE,
        sourceId: note.id,
        targetType: EntityType.SESSION,
        targetId: sessionId,
        type: RelationshipType.NOTE_SESSION,
        metadata: {
          source: 'ai',
          confidence: 0.9,
          reasoning: 'Note extracted from session',
        },
      });
    }

    // Update session
    session.status = 'completed';
    session.endedAt = new Date().toISOString();
    session.relationships = getRelationships(sessionId);
    session.relationshipVersion = 1;

    await storage.save('sessions', session);
    setSessions(prev => prev.map(s => s.id === sessionId ? session : s));
  }, [addRelationship, getRelationships]);

  const value = {
    // ... existing methods
    endSession,
  };

  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>;
}
```

### 4. Update App.tsx Provider Hierarchy

**File:** `src/App.tsx`

Ensure RelationshipProvider is available to all contexts:

```typescript
function App() {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <RelationshipProvider> {/* Add this */}
          <EntitiesProvider>
            <NotesProvider>
              <TasksProvider>
                <SessionsProvider>
                  <EnrichmentProvider>
                    <UIProvider>
                      {/* App content */}
                    </UIProvider>
                  </EnrichmentProvider>
                </SessionsProvider>
              </TasksProvider>
            </NotesProvider>
          </EntitiesProvider>
        </RelationshipProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}
```

---

## Deliverables

1. **Updated `src/context/TasksContext.tsx`** - Integrate relationship operations
2. **Updated `src/context/NotesContext.tsx`** - Integrate relationship operations
3. **Updated `src/context/SessionsContext.tsx`** - Integrate relationship operations
4. **Updated `src/App.tsx`** - Add RelationshipProvider to hierarchy
5. **`tests/context/integration.test.tsx`** - Integration tests (300+ lines)
6. **`docs/architecture/context-integration.md`** - Integration documentation

---

## Acceptance Criteria

- [ ] All existing task/note/session operations work with new relationship system
- [ ] Legacy operations (noteId, sourceSessionId) still work during transition
- [ ] No regressions in existing functionality
- [ ] Helper methods make relationship management easy
- [ ] Context hierarchy correct (RelationshipProvider accessible)
- [ ] Cross-context operations work correctly (e.g., task created from note)
- [ ] Test coverage >80%

---

## Testing Requirements

```typescript
describe('Context Integration', () => {
  it('should create task with note relationship', async () => {
    const { result: tasks } = renderHook(() => useTasks());
    const { result: relationships } = renderHook(() => useRelationships());

    const task = await tasks.current.createTask({
      title: 'Test',
      noteId: 'note-1',
    });

    const rels = relationships.current.getRelationships(task.id);
    expect(rels).toHaveLength(1);
    expect(rels[0].type).toBe(RelationshipType.TASK_NOTE);
  });

  it('should delete task and remove relationships', async () => {
    // Create task with relationships
    // Delete task
    // Verify relationships removed
  });

  it('should link/unlink helpers work', async () => {
    const { result } = renderHook(() => useTasks());

    await result.current.linkTaskToNote('task-1', 'note-1');
    // Verify relationship created

    await result.current.unlinkTaskFromNote('task-1', 'note-1');
    // Verify relationship removed
  });
});
```

---

**Task Complete When:**
- All contexts integrated
- All existing operations working
- All tests passing
- Documentation complete
