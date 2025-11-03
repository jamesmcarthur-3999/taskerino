# 🎯 Tasks System Redesign - Implementation Plan

**Date:** October 1, 2025
**Status:** Phase 1 - In Progress

---

## 📋 Overview

Transforming tasks from a sidebar feature into a **first-class citizen** with dedicated UI, advanced features, and smart integrations.

---

## 🎨 Design Philosophy

1. **Tasks deserve equal focus** - Dedicated zone alongside Capture and Library
2. **Flexibility** - Multiple views for different workflows (List, Kanban, Calendar, Today)
3. **Context preservation** - Maintain AI extraction context and note relationships
4. **Progressive disclosure** - Simple by default, powerful when needed
5. **Keyboard-first** - Everything accessible via shortcuts

---

## 🏗️ Architecture Changes

### Zone Structure (Before → After)

**Before:**
```
[Capture] [Library with task sidebar] [Assistant]
```

**After:**
```
[Capture] [Tasks] [Library] [Assistant]
```

---

## 📊 Data Model Evolution

### Enhanced Task Interface

```typescript
interface SubTask {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;              // Every N days/weeks/months/years
  endsAfter?: number;            // Number of occurrences
  endsOn?: string;               // End date
}

interface TaskComment {
  id: string;
  text: string;
  timestamp: string;
}

interface Task {
  // EXISTING FIELDS
  id: string;
  title: string;
  done: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  topicId?: string;
  noteId?: string;              // Source note
  createdAt: string;
  completedAt?: string;

  // NEW FIELDS - Phase 1
  description?: string;          // Rich text description
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  subtasks?: SubTask[];          // Checklist items
  tags?: string[];               // Task-specific tags
  createdBy: 'ai' | 'manual';    // Creation source

  // NEW FIELDS - Phase 2
  timeEstimate?: number;         // Estimated minutes
  timeSpent?: number;            // Actual minutes tracked
  dueTime?: string;              // Specific time (HH:MM format)

  // NEW FIELDS - Phase 3
  reminderBefore?: number;       // Minutes before due
  recurrence?: RecurrencePattern;
  dependencies?: string[];       // Task IDs this depends on

  // NEW FIELDS - Phase 4
  assignee?: string;             // For team features
  attachments?: string[];        // File references
  comments?: TaskComment[];      // Discussion/updates

  // AI Context (when created by AI)
  aiContext?: {
    sourceNoteId: string;
    extractedFrom: string;       // Text snippet from note
    confidence: number;          // 0-1
    reasoning?: string;          // Why AI created this task
  };
}
```

---

## 🎯 Implementation Phases

### Phase 1: Foundation ✅ (Current)

**Goal:** Solid task management basics

**Features:**
- ✅ Dedicated Tasks zone with navigation
- ✅ Enhanced Task model (status, subtasks, description, tags)
- ✅ List view with filters (status, priority, topic, tag)
- ✅ Manual task creation flow (modal + quick add)
- ✅ Task detail modal with full CRUD
- ✅ Subtasks/checklist support
- ✅ Task search functionality
- ✅ Keyboard shortcuts (⌘N for new task)

**Files to Create:**
- `src/components/TasksZone.tsx` - Main tasks view
- `src/components/TaskDetailModal.tsx` - Task details/edit
- `src/components/TaskQuickAdd.tsx` - Quick task creation

**Files to Modify:**
- `src/types.ts` - Enhanced Task interface
- `src/components/ZoneLayout.tsx` - Add Tasks zone
- `src/context/AppContext.tsx` - Task actions
- `src/utils/helpers.ts` - Task helper functions

---

### Phase 2: Organization 📅 (Next Up)

**Goal:** Multiple views and better organization

**Features:**
- 📊 Kanban board view (Todo/In Progress/Done)
- ⭐ Today view (focus on today's tasks)
- 📆 Upcoming view (next 7 days)
- 🎯 By Topic view (group by project)
- ⏱️ Time estimates and tracking
- 🏷️ Advanced tag management
- 🔍 Saved filter views
- 📱 Responsive mobile layout

**Estimated Time:** 6-8 hours

---

### Phase 3: Advanced Features 🚀 (Future)

**Goal:** Power user features

**Features:**
- 📅 Calendar view with drag-to-reschedule
- 🔁 Recurring tasks
- ⏲️ Time tracking (start/stop timer)
- 🔗 Task dependencies
- 🔔 Reminders and notifications
- 📋 Task templates
- 📊 Progress tracking per topic
- 🎨 Custom task colors/icons

**Estimated Time:** 10-12 hours

---

### Phase 4: Integrations 🌐 (Long-term)

**Goal:** Connect with external systems

**Features:**
- 📅 Google Calendar sync
- 📅 Outlook Calendar sync
- 🤖 AI scheduling assistant
- 👥 Team features (assign, collaborate)
- 📊 Analytics and insights
- 📤 Export tasks (CSV, JSON, iCal)
- 🔗 API for integrations

**Estimated Time:** 15-20 hours

---

## 🎨 UI/UX Design Specs

### Tasks Zone Layout

```
┌──────────────────────────────────────────────────┐
│  🎯 Tasks                    [⊕ New Task] [⚙️]  │
├──────────────────────────────────────────────────┤
│  [📋 List] [📊 Board] [⭐ Today] [📆 Upcoming]  │
│  ─────────────────────────────────────────────   │
│  🔍 Search tasks...              Sort: Due Date ▾│
│  [Filters ▾]                                     │
├──────────────────────────────────────────────────┤
│  ☐ High Priority (3)                             │
│    ⬜ Call Katie about renewal      🔴 Tomorrow │
│    ⬜ Review Q4 roadmap              🔴 Today   │
│    ⬜ Finalize pricing               🟠 Fri     │
│                                                   │
│  ☐ This Week (5)                                 │
│    ⬜ Update documentation           🟡 Mon     │
│    ⬜ Team sync                      🔵 Wed     │
│    ...                                           │
│                                                   │
│  ☐ Later (8)                                     │
│    ⬜ Research alternatives          🔵 No date │
│    ...                                           │
└──────────────────────────────────────────────────┘
```

### Task Card Design (List View)

```
┌────────────────────────────────────────────────┐
│ ⬜ Call Katie about renewal               [⋮] │
│    📁 Starburst Data • 🔴 High Priority       │
│    📅 Tomorrow 2:00 PM • ⏱️ Est. 30min        │
│    ✓ 2/5 checklist items • 💬 3 comments      │
│    #renewal #urgent #q4                        │
└────────────────────────────────────────────────┘
```

### Task Detail Modal

```
┌─────────────────────────────────────────────────┐
│  ✏️ Call Katie about renewal              [×]  │
├─────────────────────────────────────────────────┤
│  Status: ⚡ In Progress    Priority: 🔴 High   │
│  Topic: 📁 Starburst Data  Tags: #renewal      │
│  Due: 📅 Tomorrow 2:00 PM  Est: ⏱️ 30min       │
├─────────────────────────────────────────────────┤
│  Description                                    │
│  [Rich text editor with formatting]             │
│                                                  │
├─────────────────────────────────────────────────┤
│  ✓ Checklist (2/5 complete)                    │
│  ☑ Review previous call notes                  │
│  ☑ Check contract terms                        │
│  ☐ Prepare pricing options                     │
│  ☐ Draft follow-up email                       │
│  ☐ Schedule next check-in                      │
│  [+ Add item]                                   │
├─────────────────────────────────────────────────┤
│  🤖 AI Context                                  │
│  Created from note: "Starburst Data renewal"   │
│  "Katie mentioned pricing concerns during..."   │
│  [View source note →]                           │
├─────────────────────────────────────────────────┤
│  💬 Comments (3)                                │
│  You • 2 hours ago                              │
│  "Finance approved new pricing structure..."    │
│  [View all comments]                            │
├─────────────────────────────────────────────────┤
│  [🗑️ Delete]           [Save] [Mark Complete] │
└─────────────────────────────────────────────────┘
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘N` | New task (quick add) |
| `⌘⇧N` | New task (full form) |
| `⌘F` | Focus search |
| `⌘1-4` | Switch view (List/Board/Today/Upcoming) |
| `⌘↵` | Mark task complete |
| `⌘E` | Edit selected task |
| `⌘D` | Duplicate task |
| `⌘⌫` | Delete task |
| `⌘A` | Select all tasks |
| `↑↓` | Navigate tasks |
| `Space` | Toggle task checkbox |
| `/` | Focus filters |

---

## 🔄 Integration Points

### With Notes
- **AI → Task:** Extract tasks from notes with context
- **Task → Note:** View source note from task
- **Bidirectional:** Show tasks in note detail, notes in task detail

### With Topics
- **Group by Topic:** Filter/view tasks by project
- **Topic Stats:** Show task count per topic
- **Smart Suggestions:** AI suggests topic based on task content

### With Command Palette
- Search tasks via ⌘K
- Quick actions: Create task, Mark complete, Change priority
- Jump to task detail

### With Timeline (Notes)
- Show when task was created from note
- Track task status changes in note timeline

---

## 🎨 Design System

### Priority Colors
- 🔴 **Urgent:** Red gradient (red-500 → rose-500)
- 🟠 **High:** Orange gradient (orange-500 → amber-500)
- 🟡 **Medium:** Yellow gradient (yellow-500 → amber-400)
- 🔵 **Low:** Blue gradient (blue-500 → cyan-500)

### Status Colors
- 📝 **Todo:** Gray (gray-400)
- ⚡ **In Progress:** Violet (violet-500)
- ✅ **Done:** Green (green-500)
- 🚫 **Blocked:** Red (red-500)

### Source Badges
- 🤖 **AI Created:** Purple badge
- ✏️ **Manual:** Blue badge

---

## 📊 Success Metrics

**Phase 1 Success Criteria:**
- ✅ Can create tasks manually in <5 seconds
- ✅ Task list loads with 100+ tasks in <500ms
- ✅ All filters work correctly
- ✅ Subtasks save and display properly
- ✅ No data loss on task updates
- ✅ Keyboard shortcuts work reliably

**User Experience Goals:**
- Tasks feel as important as notes
- Easy to see what's urgent vs. what can wait
- Quick task creation doesn't interrupt flow
- AI-extracted tasks have clear context
- Natural progression: Capture → Process → Task → Done

---

## 🚀 Migration Strategy

### Handling Existing Tasks

1. **Backward Compatibility:**
   - Old tasks work with new fields optional
   - Default `status = done ? 'done' : 'todo'`
   - Default `createdBy = noteId ? 'ai' : 'manual'`

2. **Data Migration:**
   - No migration needed (additive changes)
   - New fields populate as tasks are edited

3. **UI Transition:**
   - Keep TasksSidebar for now (deprecated)
   - Add "Open in Tasks Zone" link
   - Phase out sidebar in Phase 2

---

## 📝 Testing Plan

### Manual Testing Checklist

**Task Creation:**
- [ ] Create task via quick add
- [ ] Create task via full modal
- [ ] AI extracts task from note
- [ ] Task saves all fields correctly

**Task Management:**
- [ ] Edit task details
- [ ] Change status/priority
- [ ] Add/remove subtasks
- [ ] Add/remove tags
- [ ] Mark complete/incomplete
- [ ] Delete task (with confirmation)

**Filtering & Search:**
- [ ] Filter by status
- [ ] Filter by priority
- [ ] Filter by topic
- [ ] Filter by tag
- [ ] Search by title/description
- [ ] Multiple filters combine (AND logic)

**Integration:**
- [ ] Task shows in Command Palette
- [ ] Task links to source note
- [ ] Note shows extracted tasks
- [ ] Topic shows related tasks

**Keyboard Shortcuts:**
- [ ] All shortcuts work as documented
- [ ] No conflicts with browser shortcuts

---

## 🐛 Known Issues & Limitations

**Phase 1:**
- No time tracking yet (Phase 2)
- No calendar view (Phase 3)
- No recurring tasks (Phase 3)
- No dependencies (Phase 3)
- No reminders (Phase 3)
- No calendar sync (Phase 4)

---

## 📚 Technical Decisions

### Why Dedicated Zone?
- Tasks deserve equal UX focus as notes
- Separate concerns (note-taking vs. task management)
- Room for multiple views (List, Kanban, Calendar)
- Better mobile experience

### Why Rich Task Model?
- Support diverse workflows (simple → complex)
- Room for growth (time tracking, dependencies, etc.)
- Better AI context preservation
- Competitive with dedicated task apps

### Why Status + Done?
- `done` boolean for backward compatibility
- `status` enum for richer state (in-progress, blocked)
- Both needed: done = completed, status = current state

---

## 🎯 Next Steps

1. ✅ Create documentation (this file)
2. 🔄 Update Task type in types.ts
3. 🔄 Create TasksZone component
4. 🔄 Create TaskDetailModal component
5. 🔄 Update ZoneLayout for Tasks zone
6. 🔄 Implement manual task creation
7. 🔄 Add subtasks support
8. 🔄 Add filters and search
9. ✅ Test thoroughly
10. ✅ Ship Phase 1!

---

**Built with ❤️ for productivity**
