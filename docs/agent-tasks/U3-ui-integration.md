# AGENT TASK U3: UI Integration

**Objective:** Integrate relationship pills and modal into existing Task, Note, and Session views.

**Priority:** P1 (UI Components)

**Dependencies:** U1 (Relationship Pills), U2 (Relationship Modal)

**Complexity:** Medium

**Estimated Time:** 6-8 hours

---

## Detailed Requirements

### 1. Integrate into TaskDetailSidebar

**File:** `src/components/tasks/TaskDetailSidebar.tsx`

Add relationship pills to task detail view:

```typescript
import { RelationshipPills } from '@/components/relationships/RelationshipPills';
import { RelationshipModal } from '@/components/relationships/RelationshipModal';
import { EntityType } from '@/types/relationships';

export function TaskDetailSidebar({ task }: { task: Task }) {
  const [relationshipModalOpen, setRelationshipModalOpen] = useState(false);

  return (
    <div className="task-detail-sidebar">
      {/* Existing content ... */}

      {/* Relationships Section */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Relationships</h3>
          <button
            onClick={() => setRelationshipModalOpen(true)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Manage
          </button>
        </div>

        <RelationshipPills
          entityId={task.id}
          entityType={EntityType.TASK}
          maxVisible={5}
          showRemoveButton
          onPillClick={() => setRelationshipModalOpen(true)}
        />

        {/* Empty state */}
        {!task.relationships || task.relationships.length === 0 ? (
          <button
            onClick={() => setRelationshipModalOpen(true)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            + Add relationships
          </button>
        ) : null}
      </div>

      {/* Relationship Modal */}
      <RelationshipModal
        open={relationshipModalOpen}
        onClose={() => setRelationshipModalOpen(false)}
        entityId={task.id}
        entityType={EntityType.TASK}
      />
    </div>
  );
}
```

### 2. Integrate into NoteDetailSidebar

**File:** `src/components/notes/NoteDetailSidebar.tsx`

Similar integration for notes:

```typescript
export function NoteDetailSidebar({ note }: { note: Note }) {
  const [relationshipModalOpen, setRelationshipModalOpen] = useState(false);

  return (
    <div className="note-detail-sidebar">
      {/* Existing content ... */}

      {/* Relationships Section */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Relationships</h3>
          <button
            onClick={() => setRelationshipModalOpen(true)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Manage
          </button>
        </div>

        <RelationshipPills
          entityId={note.id}
          entityType={EntityType.NOTE}
          maxVisible={5}
          showRemoveButton
          onPillClick={() => setRelationshipModalOpen(true)}
        />
      </div>

      <RelationshipModal
        open={relationshipModalOpen}
        onClose={() => setRelationshipModalOpen(false)}
        entityId={note.id}
        entityType={EntityType.NOTE}
      />
    </div>
  );
}
```

### 3. Integrate into SessionDetailView

**File:** `src/components/sessions/SessionDetailView.tsx`

Add relationships to session detail view:

```typescript
export function SessionDetailView({ session }: { session: Session }) {
  const [relationshipModalOpen, setRelationshipModalOpen] = useState(false);

  return (
    <div className="session-detail-view">
      {/* Existing content ... */}

      {/* Extracted Items Section (use relationships now) */}
      <div className="mt-6">
        <h3 className="text-lg font-medium mb-4">Extracted from Session</h3>

        {/* Tasks */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Tasks</h4>
            <button
              onClick={() => setRelationshipModalOpen(true)}
              className="text-xs text-blue-600"
            >
              Manage
            </button>
          </div>

          <RelationshipPills
            entityId={session.id}
            entityType={EntityType.SESSION}
            filterTypes={[RelationshipType.TASK_SESSION]}
            onPillClick={() => setRelationshipModalOpen(true)}
          />
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Notes</h4>
          </div>

          <RelationshipPills
            entityId={session.id}
            entityType={EntityType.SESSION}
            filterTypes={[RelationshipType.NOTE_SESSION]}
            onPillClick={() => setRelationshipModalOpen(true)}
          />
        </div>
      </div>

      <RelationshipModal
        open={relationshipModalOpen}
        onClose={() => setRelationshipModalOpen(false)}
        entityId={session.id}
        entityType={EntityType.SESSION}
      />
    </div>
  );
}
```

### 4. Add to List Views (Optional)

**File:** `src/components/tasks/TaskCard.tsx`

Add compact pills to list view cards:

```typescript
export function TaskCard({ task }: { task: Task }) {
  return (
    <div className="task-card">
      <h3>{task.title}</h3>
      <p>{task.description}</p>

      {/* Compact relationship pills */}
      <div className="mt-2">
        <CompactRelationshipPills
          entityId={task.id}
          entityType={EntityType.TASK}
          maxVisible={3}
        />
      </div>
    </div>
  );
}
```

### 5. Add Visual Indicators in Lists

Update list views to show relationship indicators:

```typescript
// In TaskList, show icon if task has relationships
export function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <div className="task-list">
      {tasks.map(task => (
        <div key={task.id} className="task-list-item">
          {task.title}

          {/* Relationship indicator */}
          {task.relationships && task.relationships.length > 0 && (
            <span className="ml-2 text-xs text-gray-500" title={`${task.relationships.length} relationships`}>
              <Link size={14} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## Deliverables

1. **Updated `src/components/tasks/TaskDetailSidebar.tsx`** - Add relationships section
2. **Updated `src/components/notes/NoteDetailSidebar.tsx`** - Add relationships section
3. **Updated `src/components/sessions/SessionDetailView.tsx`** - Add relationships section
4. **Updated `src/components/tasks/TaskCard.tsx`** - Add compact pills (optional)
5. **Updated `src/components/notes/NoteCard.tsx`** - Add compact pills (optional)
6. **`tests/integration/ui-integration.test.tsx`** - Integration tests (300+ lines)
7. **`docs/components/ui-integration.md`** - Integration documentation

---

## Acceptance Criteria

- [ ] Relationships visible in all detail views (Task, Note, Session)
- [ ] "Manage" button opens relationship modal
- [ ] Pills are clickable and open modal
- [ ] Removing relationship from pill works
- [ ] Empty state shows "Add relationships" button
- [ ] No visual regressions (existing UI still works)
- [ ] Responsive on all screen sizes
- [ ] Accessible (keyboard navigation works)
- [ ] Performance: No slowdown in list views with many items

---

## Testing Requirements

```typescript
describe('UI Integration', () => {
  it('should show relationships in task detail', () => {
    const task = createTestTask({
      relationships: [createTestRelationship()],
    });

    render(<TaskDetailSidebar task={task} />);

    expect(screen.getByText(/relationships/i)).toBeInTheDocument();
  });

  it('should open modal when clicking manage', async () => {
    render(<TaskDetailSidebar task={task} />);

    const manageBtn = screen.getByText(/manage/i);
    await userEvent.click(manageBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should show empty state when no relationships', () => {
    const task = createTestTask({ relationships: [] });

    render(<TaskDetailSidebar task={task} />);

    expect(screen.getByText(/add relationships/i)).toBeInTheDocument();
  });

  it('should not break existing functionality', () => {
    // Verify existing UI elements still render
    // Verify existing interactions still work
  });
});
```

---

## Visual Regression Testing

Use visual regression testing tools (e.g., Percy, Chromatic) to ensure no visual regressions:

- [ ] Task detail view - before/after
- [ ] Note detail view - before/after
- [ ] Session detail view - before/after
- [ ] List views - before/after

---

**Task Complete When:**
- All deliverables created
- Relationships integrated in all views
- No visual regressions
- All tests passing
- Documentation complete
