# Inline Relationship Management UX Design

**Version:** 2.0
**Date:** October 26, 2025
**Status:** Design Specification
**Author:** Claude Code UX Design System

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design Philosophy](#design-philosophy)
3. [Component Architecture](#component-architecture)
4. [UI Patterns](#ui-patterns)
5. [User Flows](#user-flows)
6. [Integration Points](#integration-points)
7. [Migration Strategy](#migration-strategy)
8. [Technical Specifications](#technical-specifications)
9. [Accessibility](#accessibility)
10. [Visual Specifications](#visual-specifications)

---

## Executive Summary

### Vision

Transform relationship management from modal-heavy workflows to **seamless inline interactions** that feel natural and discoverable. Users should be able to:

1. **See** all relationship types at a glance (separate sections, not generic "Relationships")
2. **Add** relationships with 2 clicks (search bar → autocomplete → select)
3. **Remove** relationships with 1 click (X button on pill)
4. **Navigate** to related items with 1 click (click on pill)

### Key Improvements Over Current System

| Current State | New Design |
|--------------|------------|
| One generic "Relationships" section | 7 separate sections by type |
| Modal required for all operations | Inline for simple, modal for bulk |
| Pills are view-only | Pills are interactive navigation |
| "Manage" button is text-only | Search bar + quick add controls |
| No empty states | Helpful guidance when empty |
| Duplicate sections (Linked Tasks vs Relationships) | Unified, consistent pattern |

### User Impact

**Time Savings:**
- Add relationship: **10s → 3s** (70% faster)
- Remove relationship: **5s → 1s** (80% faster)
- View related item: **8s → 1s** (87% faster)

**Cognitive Load:**
- One UI pattern instead of multiple inconsistent patterns
- Clear visual hierarchy by relationship type
- Obvious how to add relationships (search bar is visible)

---

## Design Philosophy

### 1. Separation by Type

**Problem:** Generic "Relationships" section hides relationship types, making it unclear what can be connected.

**Solution:** Dedicated sections for each relationship type:

```
Task Detail View:
├── Related Notes       (tasks created from notes)
├── Related Sessions    (tasks extracted from sessions)
├── Tags               (relationship-powered tags)
├── Topics             (task categorization)
└── [Advanced] Modal for bulk operations

Note Detail View:
├── Related Tasks       (tasks created from this note)
├── Related Sessions    (sessions that referenced this note)
├── Tags               (relationship-powered tags)
├── Topics             (note categorization)
├── Companies          (entities mentioned in note)
├── Contacts           (people mentioned in note)
└── [Advanced] Modal for bulk operations

Session Detail View:
├── Extracted Tasks     (tasks created during session)
├── Extracted Notes     (notes created during session)
├── Tags               (relationship-powered tags)
└── Topics             (session categorization)
```

**Rationale:** Users think in terms of "What tasks are related?" not "What relationships exist?" Type-specific sections match mental models.

### 2. Inline-First Design

**Problem:** Modal is friction for simple operations (add one note, remove one tag).

**Solution:** Inline controls for common operations:

```typescript
// Pattern: Section with inline search + pills
<RelatedNotesSection>
  <InlineEntitySearch
    placeholder="Search notes to link..."
    onSelect={handleLink}
  />
  <RelationshipPills
    onNavigate={handleNavigate}
    onRemove={handleRemove}
  />
</RelatedNotesSection>
```

**When to use modal:**
- Bulk operations (link 10 items at once)
- Advanced filtering (show only AI-suggested)
- Relationship metadata editing (change confidence)

### 3. Progressive Disclosure

**Problem:** Overwhelming users with all options upfront.

**Solution:** Three-tier information architecture:

**Tier 1 - Always Visible:**
- Section headers
- Inline search bar (collapsed until clicked)
- First 3-5 relationship pills
- "+ Add" button (if no search bar)

**Tier 2 - Show on Interaction:**
- Autocomplete dropdown (on search typing)
- Full pill list (if >5 pills, show "+X more" button)
- Remove buttons (hover over pill)

**Tier 3 - Advanced Modal:**
- Bulk selection checkboxes
- Filtering by confidence
- Relationship metadata editing
- Cross-entity search

### 4. Consistency Across Zones

**Problem:** TaskDetailInline, NoteDetailInline, SessionDetailView all use different patterns.

**Solution:** One reusable component system:

```typescript
// All zones use the same components
<RelatedTasksSection entityId={id} entityType={type} />
<RelatedNotesSection entityId={id} entityType={type} />
<RelatedSessionsSection entityId={id} entityType={type} />
<TagsSection entityId={id} entityType={type} />
<TopicsSection entityId={id} entityType={type} />
<CompaniesSection entityId={id} entityType={type} />
<ContactsSection entityId={id} entityType={type} />
```

Each section self-configures based on entity type.

---

## Component Architecture

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│ RelationshipSection (Abstract Base)                            │
│                                                                 │
│  Props:                                                         │
│  - entityId: string                                             │
│  - entityType: EntityType                                       │
│  - relationshipType: RelationshipType                           │
│  - sectionTitle: string                                         │
│  - icon: LucideIcon                                             │
│  - color: string (from design system)                           │
│                                                                 │
│  Renders:                                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Section Header (title + icon + count badge)              │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ InlineEntitySearch (collapsed until focus)               │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ RelationshipPills (interactive, max 5 visible)           │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ EmptyState (if no relationships) or "+X more" button     │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. `RelationshipSection` (Base Component)

```typescript
interface RelationshipSectionProps {
  // Entity being viewed
  entityId: string;
  entityType: EntityType;

  // Configuration
  relationshipType: RelationshipType;
  sectionTitle: string;
  sectionIcon: LucideIcon;
  sectionColor: string; // From COLOR_SCHEMES

  // Behavior
  allowInlineAdd?: boolean; // Default: true
  allowInlineRemove?: boolean; // Default: true
  maxVisiblePills?: number; // Default: 5
  showEmptyState?: boolean; // Default: true

  // Advanced
  onOpenAdvanced?: () => void; // Open modal
}

// Usage
<RelationshipSection
  entityId={task.id}
  entityType={EntityType.TASK}
  relationshipType={RelationshipType.TASK_NOTE}
  sectionTitle="Related Notes"
  sectionIcon={FileText}
  sectionColor={COLOR_SCHEMES.ocean.primary.from}
/>
```

#### 2. `InlineEntitySearch` (Reusable Search)

```typescript
interface InlineEntitySearchProps {
  // What to search
  entityType: EntityType;
  excludeIds?: string[]; // Already linked items

  // Display
  placeholder: string;
  icon?: LucideIcon;

  // Behavior
  onSelect: (entityId: string) => void;
  autoFocus?: boolean;
  debounceMs?: number; // Default: 300

  // Filtering
  filterFn?: (entity: AnyEntity) => boolean;
}

// Internal State
interface InlineEntitySearchState {
  query: string;
  debouncedQuery: string;
  isOpen: boolean; // Dropdown visible
  results: EntitySearchResult[];
  selectedIndex: number; // Keyboard navigation
  isLoading: boolean;
}

// Visual States:
// 1. Collapsed: Show icon + placeholder in gray pill
// 2. Focused: Expand to full search input
// 3. Typing: Show loading spinner + live results
// 4. Results: Dropdown with autocomplete items
// 5. Empty: "No results found" message
```

**UI Pattern:**

```
┌──────────────────────────────────────────────────────┐
│ 🔍 Search notes to link...                          │ ← Collapsed
└──────────────────────────────────────────────────────┘
         ↓ (click to focus)
┌──────────────────────────────────────────────────────┐
│ 🔍 [meeting agen____________]                        │ ← Typing
│ ┌──────────────────────────────────────────────────┐ │
│ │ 📄 Meeting Agenda - Q4 Planning                  │ │ ← Results
│ │    Created 2 hours ago • #meeting                │ │
│ ├──────────────────────────────────────────────────┤ │
│ │ 📄 Weekly Meeting Notes                          │ │
│ │    Created yesterday • #meeting #standup         │ │
│ ├──────────────────────────────────────────────────┤ │
│ │ 📄 Team Meeting - Engineering                    │ │
│ │    Created 3 days ago • #meeting #engineering    │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

#### 3. Enhanced `RelationshipPills`

**Current Issues:**
- Pills are passive (click opens modal, not entity)
- Remove button requires hover (not obvious)
- No visual indicator for AI-suggested relationships

**New Design:**

```typescript
interface EnhancedRelationshipPillProps {
  relationship: Relationship;
  label: string;

  // Interaction
  onNavigate?: () => void; // Navigate to entity
  onRemove?: () => void; // Remove relationship
  onClick?: () => void; // Custom action (e.g., open modal)

  // Display
  variant: 'navigation' | 'action' | 'readonly';
  showConfidence?: boolean; // Show AI confidence badge
  showIcon?: boolean; // Show entity type icon
  truncateAt?: number; // Characters before truncation
}

// Variants:
// 1. 'navigation' - Click to navigate, hover shows remove X
// 2. 'action' - Click for custom action (e.g., expand details)
// 3. 'readonly' - No interactions (display only)
```

**Visual States:**

```
┌──────────────────────────────────────────────────────────────┐
│ DEFAULT STATE (navigation variant)                           │
│                                                               │
│ 📄 Meeting Agenda - Q4 Planning                              │
│    ↑ Icon  ↑ Label (truncated at 30 chars)                   │
│                                                               │
│ Background: Blue-100/30 (translucent)                         │
│ Border: Blue-400/60 (visible)                                 │
│ Cursor: pointer                                               │
│ Hover: scale-105, shadow-md                                   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ HOVER STATE                                                   │
│                                                               │
│ 📄 Meeting Agenda - Q4 Planning                          ❌  │
│    ↑ Label brightens                         ↑ Remove button  │
│                                                               │
│ Background: Blue-100/40 (more opaque)                         │
│ Border: Blue-400/80 (stronger)                                │
│ X Button: Appears with hover:bg-red-100                       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ AI-SUGGESTED STATE (low confidence)                          │
│                                                               │
│ 📄 Engineering Spec Doc                               ✨ 72% │
│    ↑ Label                    ↑ Confidence badge (sparkle)    │
│                                                               │
│ Background: Blue-100/20 (faded)                               │
│ Border: Blue-400/40 (dashed)                                  │
│ Tooltip: "AI suggested with 72% confidence"                   │
└──────────────────────────────────────────────────────────────┘
```

#### 4. `EmptyState` Component

**Current Issue:** Sections disappear when empty (discoverability problem).

**New Design:**

```typescript
interface EmptyStateProps {
  sectionType: string; // "related notes", "tags", etc.
  icon: LucideIcon;
  onAddClick?: () => void;
  helpText?: string;
}

// Visual:
// ┌────────────────────────────────────────────────┐
// │          📄                                    │
// │    No related notes yet                        │
// │    Link notes that provide context for         │
// │    this task.                                   │
// │                                                 │
// │    [🔗 Link a note]                            │
// └────────────────────────────────────────────────┘
```

### Specialized Section Components

Each relationship type gets a dedicated component that wraps `RelationshipSection`:

#### `RelatedTasksSection`

```typescript
export function RelatedTasksSection({
  entityId,
  entityType
}: { entityId: string; entityType: EntityType }) {
  return (
    <RelationshipSection
      entityId={entityId}
      entityType={entityType}
      relationshipType={determineRelType(entityType, EntityType.TASK)}
      sectionTitle="Related Tasks"
      sectionIcon={CheckSquare}
      sectionColor={COLOR_SCHEMES.ocean.primary.from}
    />
  );
}

// Helper to determine correct relationship type
function determineRelType(source: EntityType, target: EntityType): RelationshipType {
  if (source === EntityType.NOTE && target === EntityType.TASK) {
    return RelationshipType.TASK_NOTE; // Task created from note
  }
  if (source === EntityType.SESSION && target === EntityType.TASK) {
    return RelationshipType.TASK_SESSION; // Task extracted from session
  }
  // ... other combinations
}
```

#### `RelatedNotesSection`

```typescript
export function RelatedNotesSection({ entityId, entityType }) {
  return (
    <RelationshipSection
      entityId={entityId}
      entityType={entityType}
      relationshipType={determineRelType(entityType, EntityType.NOTE)}
      sectionTitle="Related Notes"
      sectionIcon={FileText}
      sectionColor={COLOR_SCHEMES.lavender.primary.from}
    />
  );
}
```

#### `RelatedSessionsSection`

```typescript
export function RelatedSessionsSection({ entityId, entityType }) {
  return (
    <RelationshipSection
      entityId={entityId}
      entityType={entityType}
      relationshipType={determineRelType(entityType, EntityType.SESSION)}
      sectionTitle="Related Sessions"
      sectionIcon={Video}
      sectionColor={COLOR_SCHEMES.sunset.primary.from}
    />
  );
}
```

#### `TagsSection` (Relationship-Powered)

**Design Decision:** Migrate tags from simple string arrays to relationships.

**Why:**
1. **Consistency:** Same UI pattern as other relationships
2. **Flexibility:** Can attach metadata to tags (confidence, source)
3. **Scalability:** Tags become first-class entities (can have descriptions, colors)
4. **Migration Path:** Existing tag arrays map to Tag entities + relationships

```typescript
export function TagsSection({ entityId, entityType }) {
  return (
    <RelationshipSection
      entityId={entityId}
      entityType={entityType}
      relationshipType={RelationshipType.NOTE_TAG} // New relationship type
      sectionTitle="Tags"
      sectionIcon={Tag}
      sectionColor={COLOR_SCHEMES.forest.primary.from}
      // Special: Allow creating new tags inline
      allowCreateNew={true}
      createNewPlaceholder="Create new tag..."
    />
  );
}
```

#### `TopicsSection`

```typescript
export function TopicsSection({ entityId, entityType }) {
  return (
    <RelationshipSection
      entityId={entityId}
      entityType={entityType}
      relationshipType={determineRelType(entityType, EntityType.TOPIC)}
      sectionTitle="Topics"
      sectionIcon={Bookmark}
      sectionColor={COLOR_SCHEMES.ocean.accent.from}
    />
  );
}
```

#### `CompaniesSection`

```typescript
export function CompaniesSection({ entityId, entityType }) {
  // Only visible on Note and Session entities
  if (entityType !== EntityType.NOTE && entityType !== EntityType.SESSION) {
    return null;
  }

  return (
    <RelationshipSection
      entityId={entityId}
      entityType={entityType}
      relationshipType={RelationshipType.NOTE_COMPANY}
      sectionTitle="Companies"
      sectionIcon={Building}
      sectionColor={COLOR_SCHEMES.sunset.accent.from}
    />
  );
}
```

#### `ContactsSection`

```typescript
export function ContactsSection({ entityId, entityType }) {
  // Only visible on Note and Session entities
  if (entityType !== EntityType.NOTE && entityType !== EntityType.SESSION) {
    return null;
  }

  return (
    <RelationshipSection
      entityId={entityId}
      entityType={entityType}
      relationshipType={RelationshipType.NOTE_CONTACT}
      sectionTitle="Contacts"
      sectionIcon={User}
      sectionColor={COLOR_SCHEMES.forest.accent.from}
    />
  );
}
```

---

## UI Patterns

### Pattern 1: Collapsed Search Bar

**Use Case:** Save space when user isn't actively adding relationships.

**Interaction:**
1. **Default:** Small pill with icon + placeholder text
2. **Focus:** Expand to full-width search input
3. **Blur (empty):** Collapse back to pill
4. **Blur (with selection):** Add relationship, then collapse

**Visual:**

```
┌─────────────────────────────────────────────────────┐
│ Related Notes                                  (3)  │
│                                                     │
│ [🔍 Search notes...]           ← Collapsed pill     │
│                                                     │
│ 📄 Meeting Agenda    📄 Engineering Spec    ❌     │
│ 📄 Design Mockups                           ❌     │
└─────────────────────────────────────────────────────┘

        ↓ Click on search pill

┌─────────────────────────────────────────────────────┐
│ Related Notes                                  (3)  │
│                                                     │
│ [🔍 _________________________________]  ← Expanded   │
│                                                     │
│ 📄 Meeting Agenda    📄 Engineering Spec    ❌     │
│ 📄 Design Mockups                           ❌     │
└─────────────────────────────────────────────────────┘

        ↓ Type "weekly"

┌─────────────────────────────────────────────────────┐
│ Related Notes                                  (3)  │
│                                                     │
│ [🔍 weekly_________________________]                │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 📄 Weekly Standup Notes                         │ │
│ │    Last updated 2h ago • #standup               │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ 📄 Weekly Planning                              │ │
│ │    Last updated yesterday • #planning           │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ 📄 Meeting Agenda    📄 Engineering Spec    ❌     │
│ 📄 Design Mockups                           ❌     │
└─────────────────────────────────────────────────────┘

        ↓ Click "Weekly Standup Notes"

┌─────────────────────────────────────────────────────┐
│ Related Notes                                  (4)  │ ← Count increased
│                                                     │
│ [🔍 Search notes...]           ← Collapsed again    │
│                                                     │
│ 📄 Meeting Agenda    📄 Engineering Spec    ❌     │
│ 📄 Design Mockups    📄 Weekly Standup      ❌     │ ← New pill
└─────────────────────────────────────────────────────┘
```

### Pattern 2: Interactive Pills (Navigation)

**Problem:** Current pills open modal (not entity).

**Solution:** Click pill → Navigate to entity. Hover pill → Show remove button.

**Behavior:**

```typescript
<Pill
  onClick={() => navigate(`/notes/${note.id}`)}  // Navigate to entity
  onRemove={() => unlinkRelationship(relId)}      // Remove relationship
>
  📄 Meeting Agenda
</Pill>

// On hover:
// - Show remove X button
// - Scale up slightly (1.05)
// - Add shadow
// - Brighten background

// On remove click:
// - Optimistic update (remove pill immediately)
// - Show toast: "Unlinked from Meeting Agenda" [Undo]
// - If storage fails, restore pill + show error
```

### Pattern 3: "+X More" Expansion

**Problem:** Too many pills clutter UI.

**Solution:** Show first 5, then "+X more" button to expand inline.

**Interaction:**

```
┌─────────────────────────────────────────────────────┐
│ Related Notes                                 (12)  │
│                                                     │
│ 📄 Note 1    📄 Note 2    📄 Note 3    📄 Note 4   │
│ 📄 Note 5    [+ 7 more]          ← Expansion button│
└─────────────────────────────────────────────────────┘

        ↓ Click "+ 7 more"

┌─────────────────────────────────────────────────────┐
│ Related Notes                                 (12)  │
│                                                     │
│ 📄 Note 1    📄 Note 2    📄 Note 3    📄 Note 4   │
│ 📄 Note 5    📄 Note 6    📄 Note 7    📄 Note 8   │
│ 📄 Note 9    📄 Note 10   📄 Note 11   📄 Note 12  │
│                                                     │
│ [Show less]          ← Collapse button             │
└─────────────────────────────────────────────────────┘
```

### Pattern 4: Empty State Guidance

**Problem:** Empty sections provide no guidance.

**Solution:** Show icon + message + action button.

```
┌─────────────────────────────────────────────────────┐
│ Related Notes                                  (0)  │
│                                                     │
│              📄                                      │
│     No related notes yet                            │
│                                                     │
│     Link notes that provide context, references,    │
│     or background information for this task.        │
│                                                     │
│     [🔗 Link a note]                                │
└─────────────────────────────────────────────────────┘

        ↓ Click "Link a note"

┌─────────────────────────────────────────────────────┐
│ Related Notes                                  (0)  │
│                                                     │
│ [🔍 Search notes to link...____________________]    │ ← Auto-focus
│ ┌─────────────────────────────────────────────────┐ │
│ │ Recent Notes:                                   │ │
│ │ 📄 Meeting Agenda - Q4 Planning                 │ │
│ │ 📄 Engineering Spec v2                          │ │
│ │ 📄 Design System Updates                        │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Pattern 5: AI Confidence Indicators

**Problem:** Users don't know which relationships are AI-suggested.

**Solution:** Visual indicators on pills + tooltip.

```
┌─────────────────────────────────────────────────────┐
│ Related Notes                                  (5)  │
│                                                     │
│ 📄 Meeting Agenda                            ❌    │ ← Manual
│ 📄 Engineering Spec                  ✨ 85% ❌    │ ← AI (high)
│ 📄 Old Spec v1                       ✨ 62% ❌    │ ← AI (low)
│                                                     │
│ Hover tooltip for ✨ 62%:                          │
│ "AI suggested with 62% confidence                  │
│  Reasoning: Both documents mention authentication  │
│  implementation."                                   │
└─────────────────────────────────────────────────────┘
```

### Pattern 6: Advanced Modal (Bulk Operations)

**Trigger:** "Advanced" button in section header (only visible when >10 relationships).

**Use Cases:**
1. Bulk link (select multiple entities at once)
2. Bulk unlink (remove multiple relationships)
3. Filter by confidence (show only AI-suggested <70%)
4. Edit relationship metadata (change confidence, add notes)

**Layout:**

```
┌───────────────────────────────────────────────────────────────┐
│ Manage Related Notes                                       [X]│
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ [🔍 Search notes...___________________________]               │
│                                                               │
│ Filters: [All] [Manual] [AI-Suggested] [Low Confidence]      │
│                                                               │
│ ┌───────────────────────────────────────────────────────────┐│
│ │ Current Links (8)                     [Select All]        ││
│ │ ┌─────────────────────────────────────────────────────────┤│
│ │ │ ☐ 📄 Meeting Agenda                            [Unlink]││
│ │ │ ☐ 📄 Engineering Spec              ✨ 85%     [Unlink]││
│ │ │ ☐ 📄 Old Spec v1                   ✨ 62%     [Unlink]││
│ │ └─────────────────────────────────────────────────────────┤│
│ └───────────────────────────────────────────────────────────┘│
│                                                               │
│ ┌───────────────────────────────────────────────────────────┐│
│ │ Available to Link (142)               [Select All]        ││
│ │ ┌─────────────────────────────────────────────────────────┤│
│ │ │ ☐ 📄 Weekly Standup Notes                      [Link]  ││
│ │ │ ☐ 📄 Design System v3                          [Link]  ││
│ │ │ ☐ 📄 Sprint Planning                           [Link]  ││
│ │ └─────────────────────────────────────────────────────────┤│
│ └───────────────────────────────────────────────────────────┘│
│                                                               │
│ Selected: 3 items   [Unlink Selected]  [Link Selected]       │
└───────────────────────────────────────────────────────────────┘
```

---

## User Flows

### Flow 1: Adding a Related Note to a Task

**Goal:** User wants to link a note that provides context for a task.

**Steps:**

1. **Open task detail view**
   - User clicks task in Tasks Zone or opens from sidebar
   - Task detail opens in main content area

2. **Locate "Related Notes" section**
   - Section is clearly labeled with 📄 icon
   - Shows count badge: "Related Notes (2)"
   - Search bar is visible (collapsed pill)

3. **Initiate search**
   - User clicks collapsed search pill
   - Pill expands to full-width search input
   - Input is auto-focused
   - Dropdown shows "Recent Notes" as suggestions

4. **Type search query**
   - User types "meeting"
   - Debounced search (300ms) filters notes
   - Results update live in dropdown
   - Each result shows: Icon, Title, Metadata (date, tags)

5. **Select note**
   - User clicks "Meeting Agenda - Q4 Planning"
   - Optimistic update: Pill appears immediately
   - Search bar collapses back to pill
   - Toast shows: "Linked to Meeting Agenda" [Undo]

6. **Verify addition**
   - New pill appears in "Related Notes" section
   - Count badge updates: (2) → (3)
   - Pill is interactive (click to navigate, hover to remove)

**Click Count:** 2 clicks (search bar + select note)
**Time:** ~3 seconds
**Friction Points:** 0

---

### Flow 2: Adding a Tag to a Task (Using New Relationship System)

**Goal:** User wants to categorize a task with tags.

**Steps:**

1. **Open task detail view**
   - Same as Flow 1

2. **Locate "Tags" section**
   - Section is labeled with 🏷️ icon
   - Shows count badge: "Tags (2)"
   - Search bar shows placeholder: "Search or create tags..."

3. **Initiate tag search**
   - User clicks search bar
   - Bar expands, shows autocomplete dropdown
   - Dropdown shows: "Popular Tags" + "Create New"

4. **Type tag name**
   - User types "urgent"
   - Autocomplete suggests existing tags:
     - #urgent (used 15 times)
     - #urgent-fix (used 3 times)
   - Also shows: "+ Create tag: urgent"

5. **Select existing tag OR create new**

   **Option A: Select existing**
   - User clicks "#urgent"
   - Tag pill appears immediately
   - Search bar collapses

   **Option B: Create new**
   - User clicks "+ Create tag: urgent"
   - New tag entity created
   - Relationship created (Task → Tag)
   - Tag pill appears
   - Tag is now available for other entities

6. **Verify addition**
   - Tag pill appears with distinctive color
   - Count updates: (2) → (3)
   - Tag is now searchable in autocomplete

**Click Count:** 2 clicks (search bar + select tag)
**Time:** ~3 seconds
**Innovation:** Creating new tags is inline, no modal required

---

### Flow 3: Viewing All Related Items for a Note

**Goal:** User wants to see all tasks, sessions, and entities connected to a note.

**Steps:**

1. **Open note detail view**
   - User opens note from Library Zone

2. **Scan relationship sections**
   - User sees clearly separated sections:
     ```
     Related Tasks (5)
     ├── Pills for 5 tasks

     Related Sessions (2)
     ├── Pills for 2 sessions

     Tags (8)
     ├── Pills for 5 tags
     └── + 3 more button

     Topics (1)
     ├── Engineering pill

     Companies (2)
     ├── Acme Corp, Startup Inc pills

     Contacts (3)
     ├── John Doe, Jane Smith, etc.
     ```

3. **Navigate to related item**
   - User clicks any pill
   - Navigation occurs (no modal)
   - Examples:
     - Click task pill → Opens task in sidebar
     - Click session pill → Opens SessionDetailView
     - Click company pill → Opens company page in Library

4. **Expand overflowed sections**
   - User clicks "+ 3 more" button in Tags section
   - Section expands inline to show all 8 tags
   - Button changes to "Show less"

**Click Count:** 1 click per navigation
**Time:** <1 second per action
**Cognitive Load:** LOW - Clear visual hierarchy, no modals

---

### Flow 4: Removing a Relationship

**Goal:** User wants to unlink a task from a note.

**Steps:**

1. **Locate relationship pill**
   - User sees pill in "Related Tasks" section

2. **Hover over pill**
   - Pill scales up slightly (1.05)
   - Remove X button appears on right side
   - Background brightens
   - Shadow appears

3. **Click remove button**
   - Pill disappears immediately (optimistic update)
   - Toast shows: "Unlinked from [Task Name]" [Undo]
   - Count badge decrements

4. **[Optional] Undo removal**
   - User clicks [Undo] in toast
   - Pill reappears
   - Relationship restored
   - Toast shows: "Relationship restored"

**Click Count:** 1 click (X button)
**Time:** <1 second
**Safety:** Undo option prevents accidental deletions

---

### Flow 5: Bulk Linking (Advanced)

**Goal:** Power user wants to link 10 notes to a task at once.

**Steps:**

1. **Open advanced modal**
   - User clicks "Advanced" button in section header
   - Only visible when section has >10 items
   - Modal opens with split view (Current / Available)

2. **Search and filter**
   - User types "engineering" in search
   - Results filter in "Available to Link" section
   - Shows 23 matching notes

3. **Select multiple items**
   - User clicks checkboxes on 10 notes
   - Selected count updates: "Selected: 10 items"
   - Bulk actions appear at bottom

4. **Execute bulk link**
   - User clicks "Link Selected" button
   - Progress indicator shows: "Linking 5/10..."
   - Toast shows: "Linked 10 notes"

5. **Close modal**
   - Pills appear in main view
   - Count updates: (3) → (13)

**Click Count:** 12+ clicks (modal + 10 checkboxes + link button)
**Time:** ~15 seconds
**Use Case:** Rare, power-user operation

---

## Integration Points

### TaskDetailInline

**Current Layout:**
```
1. Metadata Pills (status, priority, created, completed)
2. Title (large input)
3. Due Date & Time
4. Progress Bar (if subtasks exist)
5. Description (textarea)
6. Subtasks (list + add input)
7. Tags (old system: string array)
8. Relationships (generic section + modal)
9. AI Context (if present)
```

**New Layout:**
```
1. Metadata Pills (status, priority, created, completed)
2. Title (large input)
3. Due Date & Time
4. Progress Bar (if subtasks exist)
5. Description (textarea)
6. Subtasks (list + add input)

--- RELATIONSHIP SECTIONS START ---

7. Related Notes Section
   - InlineEntitySearch (collapsed)
   - RelationshipPills (max 5 visible)
   - EmptyState (if no notes)

8. Related Sessions Section
   - InlineEntitySearch (collapsed)
   - RelationshipPills (max 5 visible)
   - EmptyState (if no sessions)

9. Tags Section (NEW: relationship-powered)
   - InlineEntitySearch (with "Create new" option)
   - Tag Pills (colorful, distinctive)
   - EmptyState (if no tags)

10. Topics Section
    - InlineEntitySearch (collapsed)
    - Topic Pills (max 3 visible)
    - EmptyState (if no topics)

--- RELATIONSHIP SECTIONS END ---

11. AI Context (if present - keep as-is)
```

**Removed:**
- Old "Tags" section (string array)
- Generic "Relationships" section

**Rationale:**
- Clear separation by type
- Consistent inline pattern
- More discoverable
- Less cognitive load

---

### NoteDetailInline

**Current Layout:**
```
HEADER (non-scrolling):
1. Title (editable, scales on scroll)
2. Metadata (source, sentiment, created time)
3. InlineRelationshipManager (companies, contacts, topics)
4. InlineTagManager (tags)
5. Quick stats (linked tasks count)

SCROLLABLE CONTENT:
6. Key Takeaways (if AI-generated)
7. Main Content (RichTextEditor)
8. Linked Tasks (list with cards)
9. Relationships (generic section + modal)
10. Related Topics (metadata.relatedTopics)
11. Original Input (expandable)
```

**New Layout:**
```
HEADER (non-scrolling):
1. Title (editable, scales on scroll)
2. Metadata (source, sentiment, created time)

--- RELATIONSHIP SECTIONS IN HEADER (always visible) ---

3. Companies Section (inline pills)
4. Contacts Section (inline pills)
5. Topics Section (inline pills)
6. Tags Section (inline pills)
7. Quick stats (relationship counts)

--- END HEADER ---

SCROLLABLE CONTENT:
8. Key Takeaways (if AI-generated)
9. Main Content (RichTextEditor)

--- RELATIONSHIP SECTIONS IN CONTENT ---

10. Related Tasks Section
    - InlineEntitySearch
    - Task Pills with status badges
    - EmptyState

11. Related Sessions Section
    - InlineEntitySearch
    - Session Pills with date/duration
    - EmptyState

--- END RELATIONSHIP SECTIONS ---

12. Original Input (expandable)
```

**Removed:**
- Old InlineRelationshipManager (replaced with dedicated sections)
- Old InlineTagManager (replaced with TagsSection)
- Generic "Relationships" section
- Duplicate "Related Topics" display

**Changes:**
- Merged "Linked Tasks" into "Related Tasks Section"
- Unified all relationship management under one pattern
- Moved some relationships to header (always visible)
- Kept content relationships in scrollable area

**Rationale:**
- Eliminate duplication (3 different relationship UIs)
- One consistent pattern across all types
- Better use of header space
- Content relationships stay in flow

---

### SessionDetailView

**Current Layout:**
```
TABS: Overview | Timeline | Extracted | Raw Data

OVERVIEW TAB:
1. Session Stats (duration, screenshots, activities)
2. Activity Timeline (expandable list)
3. Quick Stats Grid
4. Activity Breakdown Chart
5. Extracted Items (Old System)
   - "Tasks Created" section
   - "Notes Created" section
   - No manual management

EXTRACTED TAB:
6. Tasks List (with filters)
7. Notes List (with filters)
```

**New Layout:**
```
TABS: Overview | Timeline | Extracted | Raw Data

OVERVIEW TAB:
1. Session Stats (duration, screenshots, activities)
2. Activity Timeline (expandable list)
3. Quick Stats Grid
4. Activity Breakdown Chart

--- RELATIONSHIP SECTIONS START ---

5. Extracted Tasks Section
   - Shows tasks created during session
   - Pills link to task detail
   - Can manually link additional tasks
   - InlineEntitySearch: "Link additional tasks..."

6. Extracted Notes Section
   - Shows notes created during session
   - Pills link to note detail
   - Can manually link additional notes
   - InlineEntitySearch: "Link additional notes..."

7. Tags Section
   - Tag pills for session categorization
   - InlineEntitySearch: "Add tags..."

8. Topics Section
   - Topic pills for session themes
   - InlineEntitySearch: "Add topics..."

--- RELATIONSHIP SECTIONS END ---

EXTRACTED TAB: (keep as-is for detailed view)
9. Tasks List (with filters)
10. Notes List (with filters)
```

**Rationale:**
- Extracted items are relationships
- Allow manual linking (not just AI)
- Consistent with task/note patterns
- Keep Extracted tab for detailed view

---

## Migration Strategy

### Phase 1: Component Development (Week 1-2)

**Build Core Components:**

1. `RelationshipSection` base component
2. `InlineEntitySearch` with autocomplete
3. Enhanced `RelationshipPills` with navigation
4. `EmptyState` component
5. Specialized section components (7 types)

**Testing:**
- Unit tests for each component
- Storybook stories for visual testing
- Accessibility audit (keyboard nav, screen readers)

**Deliverable:** Component library ready for integration

---

### Phase 2: Integration (Week 2-3)

**TaskDetailInline:**
1. Add new relationship sections
2. Migrate old "Tags" to `TagsSection`
3. Remove old "Relationships" section
4. Test all interactions

**NoteDetailInline:**
1. Replace `InlineRelationshipManager` with dedicated sections
2. Replace `InlineTagManager` with `TagsSection`
3. Merge "Linked Tasks" into `RelatedTasksSection`
4. Remove duplicate displays

**SessionDetailView:**
1. Replace "Extracted Items" with relationship sections
2. Add manual linking capability
3. Keep Extracted tab for detailed view

**Testing:**
- Integration tests for each view
- User acceptance testing
- Performance testing (100+ relationships)

**Deliverable:** All views migrated to new system

---

### Phase 3: Data Migration (Week 3)

**Migrate Legacy Data:**

1. **String Array Tags → Tag Relationships**
   ```typescript
   // Old: task.tags = ["urgent", "backend"]
   // New:
   // 1. Create Tag entities (if not exist)
   // 2. Create relationships: Task → Tag
   // 3. Delete task.tags field
   ```

2. **Legacy Fields → Relationships**
   ```typescript
   // Old: task.noteId, task.sourceNoteId
   // New: Relationship(TASK_NOTE)

   // Old: note.topicId (singular)
   // New: Relationship(NOTE_TOPIC) for each topic

   // Old: session.extractedTaskIds[]
   // New: Relationship(TASK_SESSION) for each task
   ```

3. **Count Fields → Computed**
   ```typescript
   // Old: topic.noteCount (manual)
   // New: Computed from relationships
   ```

**Migration Script:**
```typescript
async function migrateToNewRelationshipSystem() {
  const storage = await getStorage();
  const relationshipManager = getRelationshipManager();

  // 1. Migrate tags
  const tasks = await storage.load<Task[]>('tasks');
  const notes = await storage.load<Note[]>('notes');

  for (const task of tasks) {
    if (task.tags && task.tags.length > 0) {
      for (const tagName of task.tags) {
        // Create or get tag entity
        const tag = await getOrCreateTag(tagName);

        // Create relationship
        await relationshipManager.createRelationship({
          sourceId: task.id,
          sourceType: EntityType.TASK,
          targetId: tag.id,
          targetType: EntityType.TAG,
          type: RelationshipType.TASK_TAG,
          metadata: {
            source: 'migration',
            createdAt: new Date().toISOString(),
          },
        });
      }

      // Delete old field
      delete task.tags;
    }
  }

  await storage.save('tasks', tasks);

  // 2. Migrate noteId → relationships
  for (const task of tasks) {
    if (task.noteId || task.sourceNoteId) {
      const noteId = task.noteId || task.sourceNoteId;

      await relationshipManager.createRelationship({
        sourceId: task.id,
        sourceType: EntityType.TASK,
        targetId: noteId,
        targetType: EntityType.NOTE,
        type: RelationshipType.TASK_NOTE,
        metadata: {
          source: 'migration',
          createdAt: new Date().toISOString(),
        },
      });

      delete task.noteId;
      delete task.sourceNoteId;
    }
  }

  // ... similar for other legacy fields

  console.log('✓ Migration complete');
}
```

**Rollback Plan:**
- Keep old fields for 1 version (mark as deprecated)
- If migration fails, restore from backup
- Users can downgrade to previous version

---

### Phase 4: Cleanup (Week 4)

**Remove Deprecated Code:**
1. Delete old `InlineRelationshipManager` component
2. Delete old `InlineTagManager` component
3. Delete old "Linked Tasks" display logic
4. Remove legacy field handling

**Update Documentation:**
1. Update component docs
2. Update API docs (RelationshipManager)
3. Update user guide (how to manage relationships)

**Performance Optimization:**
1. Add virtual scrolling for >50 pills
2. Optimize search queries (add indexes)
3. Cache entity labels (already implemented)

**Deliverable:** Clean, production-ready system

---

## Technical Specifications

### Component Props Reference

```typescript
// Base RelationshipSection
interface RelationshipSectionProps {
  entityId: string;
  entityType: EntityType;
  relationshipType: RelationshipType;
  sectionTitle: string;
  sectionIcon: LucideIcon;
  sectionColor: string;
  allowInlineAdd?: boolean;
  allowInlineRemove?: boolean;
  maxVisiblePills?: number;
  showEmptyState?: boolean;
  onOpenAdvanced?: () => void;
}

// InlineEntitySearch
interface InlineEntitySearchProps {
  entityType: EntityType;
  excludeIds?: string[];
  placeholder: string;
  icon?: LucideIcon;
  onSelect: (entityId: string) => void;
  autoFocus?: boolean;
  debounceMs?: number;
  filterFn?: (entity: AnyEntity) => boolean;
  allowCreateNew?: boolean; // For tags
  onCreateNew?: (name: string) => void;
}

// Enhanced RelationshipPills
interface EnhancedRelationshipPillProps {
  relationship: Relationship;
  label: string;
  onNavigate?: () => void;
  onRemove?: () => void;
  onClick?: () => void;
  variant: 'navigation' | 'action' | 'readonly';
  showConfidence?: boolean;
  showIcon?: boolean;
  truncateAt?: number;
}

// EmptyState
interface EmptyStateProps {
  sectionType: string;
  icon: LucideIcon;
  onAddClick?: () => void;
  helpText?: string;
}
```

### State Management

**Local State (Component-Level):**
```typescript
// InlineEntitySearch state
const [query, setQuery] = useState('');
const [debouncedQuery, setDebouncedQuery] = useState('');
const [isOpen, setIsOpen] = useState(false);
const [results, setResults] = useState<EntitySearchResult[]>([]);
const [selectedIndex, setSelectedIndex] = useState(0);
const [isLoading, setIsLoading] = useState(false);

// RelationshipSection state
const [isExpanded, setIsExpanded] = useState(false); // For "+X more"
const [isAdvancedOpen, setIsAdvancedOpen] = useState(false); // Modal
```

**Global State (Context):**
```typescript
// RelationshipContext (existing)
const {
  getRelationships,        // Get all relationships for entity
  createRelationship,      // Add new relationship
  deleteRelationship,      // Remove relationship
  updateRelationship,      // Update metadata
} = useRelationships();

// useRelationshipActions (existing hook)
const { linkTo, unlink } = useRelationshipActions(entityId, entityType);
```

### Performance Considerations

**Optimization Techniques:**

1. **Debounced Search (300ms)**
   ```typescript
   useEffect(() => {
     const timer = setTimeout(() => {
       setDebouncedQuery(query);
     }, 300);
     return () => clearTimeout(timer);
   }, [query]);
   ```

2. **Virtual Scrolling (if >50 pills)**
   ```typescript
   import { useVirtualizer } from '@tanstack/react-virtual';

   const virtualizer = useVirtualizer({
     count: relationships.length,
     getScrollElement: () => scrollRef.current,
     estimateSize: () => 36, // Pill height
     overscan: 5,
   });
   ```

3. **Memoized Filters**
   ```typescript
   const filteredResults = useMemo(() => {
     return searchResults.filter(result =>
       !excludeIds.includes(result.id)
     );
   }, [searchResults, excludeIds]);
   ```

4. **Lazy Loading Pills**
   ```typescript
   // Only render visible pills
   const visiblePills = useMemo(() => {
     return isExpanded
       ? relationships
       : relationships.slice(0, maxVisiblePills);
   }, [relationships, isExpanded, maxVisiblePills]);
   ```

5. **Optimistic Updates**
   ```typescript
   async function handleLink(targetId: string) {
     // 1. Update UI immediately
     setRelationships(prev => [...prev, tempRelationship]);

     try {
       // 2. Persist to storage
       await relationshipManager.createRelationship(...);
     } catch (error) {
       // 3. Rollback on failure
       setRelationships(prev =>
         prev.filter(r => r.id !== tempRelationship.id)
       );
       showErrorToast('Failed to create relationship');
     }
   }
   ```

---

## Accessibility

### WCAG 2.1 AA Compliance

**Keyboard Navigation:**
- Tab through sections
- Enter/Space to activate search
- Arrow keys in dropdown
- Escape to close dropdown
- Enter to select item

**Screen Reader Support:**
```typescript
<div
  role="region"
  aria-label="Related Notes"
>
  <InlineEntitySearch
    aria-label="Search notes to link"
    role="combobox"
    aria-expanded={isOpen}
    aria-controls="search-results"
    aria-activedescendant={`result-${selectedIndex}`}
  />

  <div role="list" aria-label="Related notes">
    <Pill
      role="button"
      aria-label="Navigate to Meeting Agenda"
      tabIndex={0}
    >
      📄 Meeting Agenda
    </Pill>
  </div>
</div>
```

**Focus Management:**
- Focus search input on section click
- Restore focus after pill removal
- Trap focus in advanced modal

**Color Contrast:**
- All text meets 4.5:1 ratio
- Icons have 3:1 ratio
- Focus indicators are 3:1

**Motion Preferences:**
```typescript
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

const pillAnimation = prefersReducedMotion
  ? 'none'
  : 'scale-105 duration-200';
```

---

## Visual Specifications

### Design System Integration

**Colors (from theme.ts):**
```typescript
// Section colors by type
const SECTION_COLORS = {
  relatedTasks: COLOR_SCHEMES.ocean.primary,      // Blue
  relatedNotes: COLOR_SCHEMES.lavender.primary,   // Purple
  relatedSessions: COLOR_SCHEMES.sunset.primary,  // Orange
  tags: COLOR_SCHEMES.forest.primary,             // Green
  topics: COLOR_SCHEMES.ocean.accent,             // Cyan
  companies: COLOR_SCHEMES.sunset.accent,         // Amber
  contacts: COLOR_SCHEMES.forest.accent,          // Emerald
};
```

**Typography:**
```typescript
// Section headers
sectionHeader: TYPOGRAPHY.heading.h4 + 'uppercase tracking-wide';

// Pills
pillLabel: TYPOGRAPHY.label.small + 'truncate';

// Empty state
emptyStateTitle: TYPOGRAPHY.body.default + 'font-medium';
emptyStateHelp: TYPOGRAPHY.body.small + 'text-gray-600';
```

**Spacing:**
```typescript
// Section spacing
sectionGap: GAP.lg;      // 24px between sections
pillGap: GAP.sm;         // 12px between pills
sectionPadding: SPACING.md; // 16px internal padding

// Search bar
searchBarHeight: '40px';
searchBarPadding: '12px 16px';
```

**Border Radius:**
```typescript
// From RADIUS constants
sectionContainer: getRadiusClass('card');  // 16px
pill: getRadiusClass('pill');              // Full round
searchBar: getRadiusClass('field');        // 12px
```

**Shadows:**
```typescript
// Section elevation
sectionShadow: SHADOWS.card;         // shadow-lg
pillHover: SHADOWS.button;           // shadow-md
dropdownShadow: SHADOWS.elevated;    // shadow-xl
```

### Glass Morphism Style

**Consistency with existing design:**
```typescript
// Section containers
className={`
  ${getGlassClasses('medium')}
  ${getRadiusClass('card')}
  ${SHADOWS.card}
  border-2 border-white/60
  p-4
`}

// Search bar
className={`
  ${getGlassClasses('strong')}
  ${getRadiusClass('field')}
  ${SHADOWS.input}
  border-2 border-white/60
  focus:border-cyan-400
  ${TRANSITIONS.fast}
`}

// Pills
style={{
  backgroundColor: `${color}20`, // 20% opacity
  borderColor: `${color}40`,     // 40% opacity
  backdropFilter: 'blur(8px)',
}}
```

### Animation Specifications

**Timing Functions:**
```typescript
// Search bar expansion
transition: `width ${DURATION.normal}ms ${EASING.smooth}`;

// Pill hover
transition: `all ${DURATION.fast}ms ${EASING.snappy}`;

// Dropdown appearance
initial: { opacity: 0, y: -10, scale: 0.95 }
animate: { opacity: 1, y: 0, scale: 1 }
transition: {
  type: 'spring',
  damping: 25,
  stiffness: 300,
  duration: DURATION.normal,
}
```

**Hover Effects:**
```typescript
// Pill hover state
hover:scale-105
hover:shadow-md
hover:bg-opacity-40
transition-all duration-200

// Remove button appear
opacity-0
group-hover:opacity-100
transition-opacity duration-150
```

---

## Summary

### Implementation Checklist

**Week 1-2: Component Development**
- [ ] Build `RelationshipSection` base component
- [ ] Build `InlineEntitySearch` with autocomplete
- [ ] Enhance `RelationshipPills` with navigation
- [ ] Build `EmptyState` component
- [ ] Build 7 specialized section components
- [ ] Write unit tests (90% coverage)
- [ ] Create Storybook stories
- [ ] Accessibility audit

**Week 2-3: Integration**
- [ ] Integrate into TaskDetailInline
- [ ] Integrate into NoteDetailInline
- [ ] Integrate into SessionDetailView
- [ ] Remove old components
- [ ] Integration testing
- [ ] User acceptance testing
- [ ] Performance testing

**Week 3: Data Migration**
- [ ] Write migration script
- [ ] Test migration on sample data
- [ ] Run migration on production data
- [ ] Verify data integrity
- [ ] Rollback plan tested

**Week 4: Cleanup & Launch**
- [ ] Remove deprecated code
- [ ] Update documentation
- [ ] Performance optimization
- [ ] Final QA pass
- [ ] Launch!

### Success Metrics

**Quantitative:**
- 70% reduction in time to add relationship
- 80% reduction in time to remove relationship
- 87% reduction in time to view related item
- 100% data integrity (no lost relationships)
- <100ms search response time
- >90% user task completion rate

**Qualitative:**
- Users find relationship management intuitive
- Reduced support tickets about "how to link"
- Positive feedback on inline design
- Increased usage of relationship features

---

**Document Version:** 2.0
**Last Updated:** October 26, 2025
**Next Review:** Post-implementation (Week 5)
