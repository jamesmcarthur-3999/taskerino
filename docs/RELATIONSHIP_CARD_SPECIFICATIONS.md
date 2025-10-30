# Relationship Card Design Specifications

**Date**: October 26, 2025
**Version**: 1.0.0
**Status**: Ready for Implementation
**Context**: Upgrading relationship pills to rich interactive cards

---

## Table of Contents

1. [Overview](#overview)
2. [Design System Foundation](#design-system-foundation)
3. [Component Specifications](#component-specifications)
   - [TaskRelationshipCard](#taskrelationshipcard)
   - [NoteRelationshipCard](#noterelationshipcard)
   - [SessionRelationshipCard](#sessionrelationshipcard)
4. [Animation Specifications](#animation-specifications)
5. [Accessibility Specifications](#accessibility-specifications)
6. [Implementation Guide](#implementation-guide)

---

## Overview

### Goals

Transform lightweight relationship pills into **rich, informative cards** that:
- Display comprehensive entity information without requiring navigation
- Provide quick actions (view, edit, toggle complete, remove)
- Show contextual metadata (due dates, progress, activity type)
- Maintain visual consistency with existing card designs
- Support keyboard navigation and screen readers

### Design Philosophy

**From UX Review Report** (docs/reviews/ux-review-relationships.md):
- **P1 Issue**: Low contrast pills (20% opacity → 30% opacity)
- **P1 Issue**: Weak hover states (opacity-only → scale + shadow)
- **Recommendation**: Enhanced visual hierarchy
- **Recommendation**: More pronounced affordances

**From Existing Card Designs**:
- **TaskCard**: Expandable sections, priority colors, hover actions
- **NoteCard**: Entity chips, smart highlights, collapsible content
- **SessionCard**: Status indicators, activity badges, metadata display
- **ScreenshotCard**: Horizontal layout, compact thumbnail, rich content area

### Key Improvements Over Pills

| Feature | Current Pills | New Cards |
|---------|--------------|-----------|
| **Information Density** | Entity name only | Full metadata (dates, progress, status) |
| **Visual Weight** | 20% opacity, 40% border | 30% opacity, 60% border, shadows |
| **Interactions** | Click → Modal, X → Remove | View, Edit, Toggle, Remove, Expand |
| **Context** | None | Show excerpt, related counts, AI confidence |
| **Layout** | Inline horizontal pills | Vertical stacked cards |
| **Hover State** | opacity-80 | scale-[1.02] + shadow-xl |

---

## Design System Foundation

### Colors and Gradients

**From `/src/design-system/theme.ts`**:

```typescript
// Relationship type colors (from RELATIONSHIP_CONFIGS)
export const RELATIONSHIP_CARD_COLORS = {
  TASK_NOTE: {
    primary: '#3B82F6',      // blue-600
    bg: 'bg-blue-500/30',    // 30% opacity (upgraded from 20%)
    border: 'border-blue-300/60',  // 60% opacity (upgraded from 40%)
    text: 'text-blue-900',
    icon: 'text-blue-600',
  },
  TASK_SESSION: {
    primary: '#8B5CF6',      // purple-600
    bg: 'bg-purple-500/30',
    border: 'border-purple-300/60',
    text: 'text-purple-900',
    icon: 'text-purple-600',
  },
  NOTE_SESSION: {
    primary: '#8B5CF6',      // purple-600
    bg: 'bg-purple-500/30',
    border: 'border-purple-300/60',
    text: 'text-purple-900',
    icon: 'text-purple-600',
  },
  TASK_TOPIC: {
    primary: '#10B981',      // green-600
    bg: 'bg-green-500/30',
    border: 'border-green-300/60',
    text: 'text-green-900',
    icon: 'text-green-600',
  },
  NOTE_TOPIC: {
    primary: '#10B981',      // green-600
    bg: 'bg-green-500/30',
    border: 'border-green-300/60',
    text: 'text-green-900',
    icon: 'text-green-600',
  },
  NOTE_COMPANY: {
    primary: '#F59E0B',      // amber-600
    bg: 'bg-amber-500/30',
    border: 'border-amber-300/60',
    text: 'text-amber-900',
    icon: 'text-amber-600',
  },
  NOTE_CONTACT: {
    primary: '#EC4899',      // pink-600
    bg: 'bg-pink-500/30',
    border: 'border-pink-300/60',
    text: 'text-pink-900',
    icon: 'text-pink-600',
  },
  NOTE_PARENT: {
    primary: '#6366F1',      // indigo-600
    bg: 'bg-indigo-500/30',
    border: 'border-indigo-300/60',
    text: 'text-indigo-900',
    icon: 'text-indigo-600',
  },
};
```

### Glass Morphism

```typescript
// Card base (from theme.ts)
const CARD_BASE = `
  bg-white/70 backdrop-blur-xl
  ${getRadiusClass('card')}  // rounded-[16px]
  ${TRANSITIONS.standard}     // transition-all duration-300
  ${SCALE.cardHover}          // hover:scale-[1.02]
  shadow-lg hover:shadow-xl
`;

// Border left accent (relationship type indicator)
const ACCENT_BORDER = `
  border-l-4
  border-2 border-white/60
`;
```

### Typography Scale

```typescript
// From theme.ts TYPOGRAPHY
const CARD_TYPOGRAPHY = {
  title: 'text-base font-semibold leading-normal',        // 16px, 600 weight
  subtitle: 'text-sm font-medium leading-normal',         // 14px, 500 weight
  metadata: 'text-xs font-normal leading-normal',         // 12px, 400 weight
  badge: 'text-xs font-semibold uppercase leading-normal', // 12px, 600 weight
};
```

### Spacing and Sizing

```typescript
// From theme.ts SPACING
const CARD_SPACING = {
  padding: 'p-4',           // 16px all sides
  gap: 'gap-3',             // 12px between elements
  iconSize: ICON_SIZES.md,  // 20px
  badgeSize: ICON_SIZES.sm, // 16px
};
```

### Icons

```typescript
// Lucide React icons used in relationship cards
import {
  FileText,      // Tasks, Notes
  Video,         // Sessions
  Tag,           // Topics
  Building2,     // Companies
  User,          // Contacts
  CheckCircle2,  // Complete task
  Circle,        // Incomplete task
  Clock,         // Due date
  Flag,          // Priority
  Calendar,      // Session date
  Camera,        // Screenshot count
  ExternalLink,  // View action
  Edit2,         // Edit action
  Trash2,        // Remove action
  Sparkles,      // AI confidence
} from 'lucide-react';
```

---

## Component Specifications

### TaskRelationshipCard

**Purpose**: Display a related task with priority, status, and completion actions.

#### Props Interface

```typescript
interface TaskRelationshipCardProps {
  relationship: Relationship;
  task: Task;
  variant?: 'compact' | 'default' | 'expanded';
  onView?: (taskId: string) => void;
  onToggleComplete?: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
  onRemove?: () => void;
  showActions?: boolean;
  showExcerpt?: boolean;
  showRelatedCounts?: boolean;
}
```

#### Layout Structure

```tsx
<motion.div
  className={`
    relative group
    bg-white/70 backdrop-blur-xl
    rounded-[16px]
    border-l-4 border-2 border-white/60
    ${STATUS_BORDER_COLORS[task.status]}  // border-l-cyan-500 for in-progress
    ${PRIORITY_BG[task.priority]}         // bg-orange-50/50 for high priority
    shadow-lg hover:shadow-xl hover:shadow-cyan-200/40
    transition-all duration-300
    hover:scale-[1.02]
    p-4
  `}
>
  {/* Header Row: Checkbox + Title + AI Badge */}
  <div className="flex items-start gap-3">
    {/* Checkbox */}
    <button
      onClick={() => onToggleComplete?.(task.id)}
      className="flex-shrink-0 mt-0.5 hover:scale-110 transition-transform"
      aria-label={task.done ? 'Mark as incomplete' : 'Mark as complete'}
    >
      {task.done ? (
        <CheckCircle2 className="w-5 h-5 text-green-600" />
      ) : (
        <Circle className="w-5 h-5 text-gray-400" />
      )}
    </button>

    {/* Title */}
    <div className="flex-1 min-w-0">
      <h3 className={`text-base font-semibold leading-normal ${
        task.done ? 'line-through text-gray-500' : 'text-gray-900'
      }`}>
        {task.title}
      </h3>

      {/* AI Confidence Badge (if AI-created) */}
      {task.createdBy === 'ai' && task.aiContext && (
        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs mt-1"
          title={`AI created (${Math.round(task.aiContext.confidence * 100)}% confidence)`}
        >
          <Sparkles className="w-3 h-3" />
          <span>{Math.round(task.aiContext.confidence * 100)}%</span>
        </div>
      )}
    </div>

    {/* Action Buttons (visible on hover) */}
    <div className="flex items-center gap-1 flex-shrink-0">
      <AnimatePresence>
        {isHovered && (
          <>
            {onView && (
              <motion.button
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                onClick={() => onView(task.id)}
                className="p-1.5 rounded-[12px] hover:bg-white/80 transition-all duration-300 hover:shadow-md"
                aria-label="View task"
              >
                <ExternalLink className="w-4 h-4 text-gray-600" />
              </motion.button>
            )}
            {onEdit && (
              <motion.button
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ delay: 0.05 }}
                onClick={() => onEdit(task.id)}
                className="p-1.5 rounded-[12px] hover:bg-white/80 transition-all duration-300 hover:shadow-md"
                aria-label="Edit task"
              >
                <Edit2 className="w-4 h-4 text-gray-600" />
              </motion.button>
            )}
            {onRemove && (
              <motion.button
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ delay: 0.1 }}
                onClick={onRemove}
                className="p-1.5 rounded-[12px] hover:bg-red-100 transition-all duration-300 hover:shadow-md"
                aria-label="Remove relationship"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </motion.button>
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  </div>

  {/* Metadata Row: Priority + Due Date + Status */}
  <div className="flex flex-wrap items-center gap-3 mt-3">
    {/* Priority Badge */}
    <div className={`flex items-center gap-1 text-xs font-medium ${PRIORITY_COLORS[task.priority].text}`}>
      <Flag className="w-3 h-3" />
      <span className="capitalize">{task.priority}</span>
    </div>

    {/* Due Date */}
    {task.dueDate && (
      <div className={`flex items-center gap-1 text-xs ${
        isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'
      }`}>
        <Clock className="w-3 h-3" />
        <span>{formatDueDate(task.dueDate, task.dueTime)}</span>
      </div>
    )}

    {/* Status Badge */}
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClasses(task.status)}`}>
      {task.status}
    </span>
  </div>

  {/* Progress Bar (if subtasks exist) */}
  {task.subtasks && task.subtasks.length > 0 && (
    <div className="mt-3">
      <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
        <span>{task.subtasks.filter(st => st.done).length}/{task.subtasks.length} subtasks</span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${subtaskProgress}%` }}
          className="h-full bg-cyan-500 rounded-full"
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  )}

  {/* Excerpt (if showExcerpt) */}
  {showExcerpt && task.description && (
    <div className="mt-3 px-3 py-2 rounded-[12px] bg-white/50 border border-white/60">
      <p className="text-sm text-gray-700 leading-snug line-clamp-2">
        {task.description}
      </p>
    </div>
  )}

  {/* Related Counts (if showRelatedCounts) */}
  {showRelatedCounts && relatedNotesCount > 0 && (
    <div className="mt-3 flex items-center gap-1 text-xs text-gray-600">
      <FileText className="w-3 h-3" />
      <span>{relatedNotesCount} related note{relatedNotesCount > 1 ? 's' : ''}</span>
    </div>
  )}
</motion.div>
```

#### CSS Classes (Exact Tailwind)

**Base Card:**
```css
relative group
bg-white/70 backdrop-blur-xl
rounded-[16px]
border-l-4 border-2 border-white/60
shadow-lg hover:shadow-xl hover:shadow-cyan-200/40
transition-all duration-300
hover:scale-[1.02]
p-4
```

**Status Border Colors:**
```typescript
const STATUS_BORDER_COLORS = {
  todo: 'border-l-gray-400',
  'in-progress': 'border-l-cyan-500',
  done: 'border-l-green-500',
  blocked: 'border-l-red-500',
};
```

**Priority Backgrounds:**
```typescript
const PRIORITY_BG = {
  low: 'bg-gray-50/50',
  medium: 'bg-cyan-50/50',
  high: 'bg-orange-50/50',
  urgent: 'bg-red-50/50',
};
```

**Action Buttons:**
```css
p-1.5 rounded-[12px]
hover:bg-white/80 transition-all duration-300 hover:shadow-md
```

**Remove Button (red variant):**
```css
p-1.5 rounded-[12px]
hover:bg-red-100 transition-all duration-300 hover:shadow-md
```

#### Interaction States

**Default:**
- Border: `border-white/60`
- Shadow: `shadow-lg`
- Scale: `scale-100`

**Hover:**
- Border: `border-white/60` (unchanged)
- Shadow: `shadow-xl shadow-cyan-200/40`
- Scale: `scale-[1.02]`
- Action buttons: Fade in from left (`x: -5 → 0`)

**Active/Pressed:**
- Scale: `scale-[0.99]` (subtle press effect)

**Focus (keyboard):**
- Ring: `focus:ring-2 focus:ring-cyan-400 focus:outline-none`

#### Metadata Display

**Priority:**
- Icon: `<Flag className="w-3 h-3" />`
- Text: `text-xs font-medium`
- Color: `PRIORITY_COLORS[task.priority].text`

**Due Date:**
- Icon: `<Clock className="w-3 h-3" />`
- Text: `text-xs`
- Color: Overdue = `text-red-600 font-medium`, Normal = `text-gray-600`
- Format: `formatDueDate(task.dueDate, task.dueTime)`

**Status:**
- Pill: `px-2 py-0.5 rounded-full text-xs font-semibold border`
- Classes: `getStatusBadgeClasses(task.status)`

**Subtasks Progress:**
- Bar container: `w-full h-1.5 bg-gray-200 rounded-full overflow-hidden`
- Progress fill: `h-full bg-cyan-500 rounded-full`
- Animation: Framer Motion `width: 0 → ${progress}%`, duration 300ms

#### Variants

**Compact:**
- Remove: Excerpt, Related Counts
- Keep: Title, Checkbox, Priority, Due Date

**Default:**
- Show: All metadata
- Hide: Excerpt (unless expanded)

**Expanded:**
- Show: All metadata, Excerpt, Related Counts
- Expand: Subtasks list (if any)

---

### NoteRelationshipCard

**Purpose**: Display a related note with entity chips, content preview, and key insights.

#### Props Interface

```typescript
interface NoteRelationshipCardProps {
  relationship: Relationship;
  note: Note;
  variant?: 'compact' | 'default' | 'expanded';
  onView?: (noteId: string) => void;
  onEdit?: (noteId: string) => void;
  onRemove?: () => void;
  showActions?: boolean;
  showExcerpt?: boolean;
  showKeyPoints?: boolean;
  showEntities?: boolean;
  companies?: Array<{ id: string; name: string }>;
  contacts?: Array<{ id: string; name: string }>;
}
```

#### Layout Structure

```tsx
<motion.div
  className={`
    relative group
    bg-white/70 backdrop-blur-xl
    rounded-[16px]
    border-l-4 border-2 border-white/60
    ${RELATIONSHIP_CARD_COLORS[relationship.type].border}
    ${RELATIONSHIP_CARD_COLORS[relationship.type].bg}
    shadow-lg hover:shadow-xl hover:shadow-cyan-200/40
    transition-all duration-300
    hover:scale-[1.02]
    p-4
  `}
>
  {/* Header Row: Icon + Title + Actions */}
  <div className="flex items-start gap-3">
    {/* Icon Badge */}
    <div className="flex-shrink-0 p-2 rounded-[12px] bg-cyan-100">
      <FileText className="w-4 h-4 text-cyan-600" />
    </div>

    {/* Title + Metadata */}
    <div className="flex-1 min-w-0">
      <h3 className="text-base font-semibold leading-normal text-gray-900">
        {note.summary}
      </h3>

      {/* Date + Source */}
      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(note.timestamp)}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLORS[note.source]}`}>
          {note.source}
        </span>
      </div>
    </div>

    {/* Action Buttons (hover) */}
    <div className="flex items-center gap-1 flex-shrink-0">
      <AnimatePresence>
        {isHovered && (
          <>
            {onView && (
              <motion.button
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                onClick={() => onView(note.id)}
                className="p-1.5 rounded-[12px] hover:bg-white/80 transition-all duration-300 hover:shadow-md"
                aria-label="View note"
              >
                <ExternalLink className="w-4 h-4 text-gray-600" />
              </motion.button>
            )}
            {onEdit && (
              <motion.button
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ delay: 0.05 }}
                onClick={() => onEdit(note.id)}
                className="p-1.5 rounded-[12px] hover:bg-white/80 transition-all duration-300 hover:shadow-md"
                aria-label="Edit note"
              >
                <Edit2 className="w-4 h-4 text-gray-600" />
              </motion.button>
            )}
            {onRemove && (
              <motion.button
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ delay: 0.1 }}
                onClick={onRemove}
                className="p-1.5 rounded-[12px] hover:bg-red-100 transition-all duration-300 hover:shadow-md"
                aria-label="Remove relationship"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </motion.button>
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  </div>

  {/* Entity Chips (Companies + Contacts) */}
  {showEntities && (companies.length > 0 || contacts.length > 0) && (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {companies.map((company) => (
        <span
          key={company.id}
          className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${getEntityPillClasses('company')} hover:bg-blue-200 transition-colors cursor-pointer`}
        >
          <Building2 className="w-3 h-3" />
          <span>{company.name}</span>
        </span>
      ))}
      {contacts.map((contact) => (
        <span
          key={contact.id}
          className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${getEntityPillClasses('contact')} hover:bg-emerald-200 transition-colors cursor-pointer`}
        >
          <User className="w-3 h-3" />
          <span>{contact.name}</span>
        </span>
      ))}
    </div>
  )}

  {/* Content Excerpt */}
  {showExcerpt && note.content && (
    <div className="mt-3">
      <p className="text-sm text-gray-700 leading-snug line-clamp-2">
        {note.content}
      </p>
    </div>
  )}

  {/* Key Points Callout */}
  {showKeyPoints && note.metadata?.keyPoints && note.metadata.keyPoints.length > 0 && (
    <div className="mt-3 p-3 rounded-[12px] bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200">
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Key Insights</span>
      </div>
      <ul className="space-y-1.5">
        {note.metadata.keyPoints.slice(0, 3).map((point, idx) => (
          <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
            <span className="w-1 h-1 bg-cyan-500 rounded-full mt-1.5 flex-shrink-0" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  )}

  {/* Tags */}
  {note.tags && note.tags.length > 0 && (
    <div className="flex items-center gap-2 flex-wrap mt-3">
      <Tag className="w-3 h-3 text-gray-500 flex-shrink-0" />
      {note.tags.slice(0, 3).map((tag) => (
        <span
          key={tag}
          className="px-2 py-0.5 text-xs rounded-full bg-cyan-100 text-cyan-800 hover:bg-cyan-200 transition-colors cursor-pointer"
        >
          {tag}
        </span>
      ))}
      {note.tags.length > 3 && (
        <span className="text-xs text-gray-600">+{note.tags.length - 3}</span>
      )}
    </div>
  )}
</motion.div>
```

#### CSS Classes (Exact Tailwind)

**Base Card:**
```css
relative group
bg-white/70 backdrop-blur-xl
rounded-[16px]
border-l-4 border-2 border-white/60
shadow-lg hover:shadow-xl hover:shadow-cyan-200/40
transition-all duration-300
hover:scale-[1.02]
p-4
```

**Icon Badge:**
```css
flex-shrink-0 p-2 rounded-[12px] bg-cyan-100
```

**Entity Chips:**
```typescript
// Companies (blue)
const COMPANY_CHIP = `
  flex items-center gap-1 px-2 py-0.5 text-xs rounded-full
  bg-gradient-to-r from-blue-100/80 to-cyan-100/80
  border border-blue-300/60
  text-blue-800
  hover:bg-blue-200 transition-colors cursor-pointer
`;

// Contacts (green)
const CONTACT_CHIP = `
  flex items-center gap-1 px-2 py-0.5 text-xs rounded-full
  bg-gradient-to-r from-emerald-100/80 to-green-100/80
  border border-emerald-300/60
  text-emerald-800
  hover:bg-emerald-200 transition-colors cursor-pointer
`;
```

**Key Points Callout:**
```css
mt-3 p-3 rounded-[12px]
bg-gradient-to-br from-cyan-50 to-blue-50
border border-cyan-200
```

**Tag Pills:**
```css
px-2 py-0.5 text-xs rounded-full
bg-cyan-100 text-cyan-800
hover:bg-cyan-200 transition-colors cursor-pointer
```

#### Metadata Display

**Date:**
- Icon: `<Calendar className="w-3 h-3" />`
- Text: `text-xs text-gray-600`
- Format: Relative (e.g., "2 hours ago", "Yesterday")

**Source Badge:**
```typescript
const SOURCE_COLORS = {
  call: 'bg-blue-100 text-blue-800',
  email: 'bg-cyan-100 text-cyan-800',
  thought: 'bg-emerald-100 text-emerald-800',
  other: 'bg-gray-100 text-gray-700',
};
```

**Key Points:**
- Header icon: `<Sparkles className="w-3.5 h-3.5" />`
- Bullet: `w-1 h-1 bg-cyan-500 rounded-full`
- Text: `text-xs text-gray-700`
- Max display: 3 points (show first 3)

---

### SessionRelationshipCard

**Purpose**: Display a related session with activity type, duration, and screenshot count.

#### Props Interface

```typescript
interface SessionRelationshipCardProps {
  relationship: Relationship;
  session: Session;
  variant?: 'compact' | 'default' | 'expanded';
  onView?: (sessionId: string) => void;
  onRemove?: () => void;
  showActions?: boolean;
  showActivities?: boolean;
  showExcerpt?: boolean;
}
```

#### Layout Structure

```tsx
<motion.div
  className={`
    relative group
    bg-white/70 backdrop-blur-xl
    rounded-[16px]
    border-l-4 border-2 border-white/60
    ${STATUS_COLORS[session.status]}  // border-l-green-500 for active
    shadow-lg hover:shadow-xl hover:shadow-cyan-200/40
    transition-all duration-300
    hover:scale-[1.02]
    p-4
  `}
>
  {/* Header Row: Status Icon + Title + Actions */}
  <div className="flex items-start gap-3">
    {/* Status Icon Badge */}
    <div className={`flex-shrink-0 p-2 rounded-[12px] ${
      session.status === 'active' ? 'bg-green-100' :
      session.status === 'paused' ? 'bg-yellow-100' :
      session.status === 'completed' ? 'bg-gray-100' :
      'bg-red-100'
    }`}>
      {session.status === 'active' && <PlayCircle className="w-4 h-4 text-green-600" />}
      {session.status === 'paused' && <PauseCircle className="w-4 h-4 text-yellow-600" />}
      {session.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-gray-600" />}
      {session.status === 'interrupted' && <AlertCircle className="w-4 h-4 text-red-600" />}
    </div>

    {/* Title + Metadata */}
    <div className="flex-1 min-w-0">
      <h3 className="text-base font-semibold leading-normal text-gray-900">
        {session.name}
      </h3>

      {/* Date + Duration + Screenshots */}
      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-600">
        {/* Date/Time */}
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{formatDateTime(session.startTime)}</span>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{formatDuration(duration)}</span>
        </div>

        {/* Screenshot Count */}
        <div className="flex items-center gap-1">
          <Camera className="w-3 h-3" />
          <span>{session.screenshots.length} screenshots</span>
        </div>

        {/* Activity Type Badge (if set) */}
        {session.activityType && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            ACTIVITY_COLORS[session.activityType as keyof typeof ACTIVITY_COLORS] || ACTIVITY_COLORS.other
          }`}>
            {session.activityType}
          </span>
        )}
      </div>
    </div>

    {/* Action Buttons (hover) */}
    <div className="flex items-center gap-1 flex-shrink-0">
      <AnimatePresence>
        {isHovered && (
          <>
            {onView && (
              <motion.button
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                onClick={() => onView(session.id)}
                className="p-1.5 rounded-[12px] hover:bg-white/80 transition-all duration-300 hover:shadow-md"
                aria-label="View session"
              >
                <ExternalLink className="w-4 h-4 text-gray-600" />
              </motion.button>
            )}
            {onRemove && (
              <motion.button
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ delay: 0.05 }}
                onClick={onRemove}
                className="p-1.5 rounded-[12px] hover:bg-red-100 transition-all duration-300 hover:shadow-md"
                aria-label="Remove relationship"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </motion.button>
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  </div>

  {/* Recent Activities (if showActivities) */}
  {showActivities && recentActivities.length > 0 && (
    <div className="mt-3 space-y-1.5">
      {recentActivities.map((activity, idx) => (
        <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
          <span className="w-1 h-1 bg-cyan-500 rounded-full mt-1.5 flex-shrink-0" />
          <span>{activity}</span>
        </div>
      ))}
    </div>
  )}

  {/* Excerpt (summary from AI) */}
  {showExcerpt && session.summary?.brief && (
    <div className="mt-3 px-3 py-2 rounded-[12px] bg-white/50 border border-white/60">
      <p className="text-sm text-gray-700 leading-snug line-clamp-2">
        {session.summary.brief}
      </p>
    </div>
  )}

  {/* Tags */}
  {session.tags && session.tags.length > 0 && (
    <div className="flex items-center gap-2 flex-wrap mt-3">
      <Tag className="w-3 h-3 text-gray-500 flex-shrink-0" />
      {session.tags.slice(0, 3).map((tag) => (
        <span
          key={tag}
          className="px-2 py-0.5 text-xs rounded-full bg-cyan-100 text-cyan-800 hover:bg-cyan-200 transition-colors cursor-pointer"
        >
          {tag}
        </span>
      ))}
      {session.tags.length > 3 && (
        <span className="text-xs text-gray-600">+{session.tags.length - 3}</span>
      )}
    </div>
  )}
</motion.div>
```

#### CSS Classes (Exact Tailwind)

**Base Card:**
```css
relative group
bg-white/70 backdrop-blur-xl
rounded-[16px]
border-l-4 border-2 border-white/60
shadow-lg hover:shadow-xl hover:shadow-cyan-200/40
transition-all duration-300
hover:scale-[1.02]
p-4
```

**Status Border + Background:**
```typescript
const STATUS_COLORS = {
  active: 'border-l-green-500 bg-green-50/50',
  paused: 'border-l-yellow-500 bg-yellow-50/50',
  completed: 'border-l-gray-500 bg-white/50',
  interrupted: 'border-l-red-500 bg-red-50/50',
};
```

**Status Icon Backgrounds:**
```typescript
const STATUS_ICON_BG = {
  active: 'bg-green-100',
  paused: 'bg-yellow-100',
  completed: 'bg-gray-100',
  interrupted: 'bg-red-100',
};
```

**Activity Type Badges:**
```typescript
const ACTIVITY_COLORS = {
  coding: 'bg-blue-100 text-blue-800',
  meeting: 'bg-purple-100 text-purple-800',
  research: 'bg-cyan-100 text-cyan-800',
  design: 'bg-pink-100 text-pink-800',
  email: 'bg-emerald-100 text-emerald-800',
  other: 'bg-gray-100 text-gray-700',
};
```

#### Metadata Display

**Date/Time:**
- Icon: `<Calendar className="w-3 h-3" />`
- Text: `text-xs text-gray-600`
- Format: Relative (e.g., "Today at 2:30 PM")

**Duration:**
- Icon: `<Clock className="w-3 h-3" />`
- Text: `text-xs text-gray-600`
- Format: `formatDuration(minutes)` → "2h 35m"

**Screenshot Count:**
- Icon: `<Camera className="w-3 h-3" />`
- Text: `text-xs text-gray-600`
- Format: "{count} screenshots"

**Recent Activities:**
- Bullet: `w-1 h-1 bg-cyan-500 rounded-full`
- Text: `text-xs text-gray-700`
- Max display: 3 activities (most recent)

---

## Animation Specifications

### Entry Animations

**Card Entrance** (stagger when multiple cards):

```typescript
// Framer Motion variants
const cardVariants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
      duration: 0.3,
    },
  },
  exit: {
    opacity: 0,
    y: -5,
    transition: {
      duration: 0.2,
    },
  },
};

// Usage
<motion.div
  variants={cardVariants}
  initial="hidden"
  animate="visible"
  exit="exit"
>
```

**Stagger Delay** (for lists of cards):

```typescript
const containerVariants = {
  visible: {
    transition: {
      staggerChildren: 0.1, // 100ms between each card
    },
  },
};

// Usage
<motion.div variants={containerVariants}>
  {cards.map(card => (
    <motion.div key={card.id} variants={cardVariants}>
      {/* Card content */}
    </motion.div>
  ))}
</motion.div>
```

### Hover State Transitions

**Card Hover:**

```typescript
// Tailwind classes (applied directly)
hover:scale-[1.02]
hover:shadow-xl hover:shadow-cyan-200/40
transition-all duration-300
```

**Action Buttons Reveal:**

```typescript
// Framer Motion for action buttons
const actionButtonVariants = {
  hidden: { opacity: 0, x: -5 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -5 },
};

// Stagger delays
<motion.button
  variants={actionButtonVariants}
  transition={{ delay: 0 }}      // First button: no delay
/>
<motion.button
  variants={actionButtonVariants}
  transition={{ delay: 0.05 }}   // Second button: 50ms delay
/>
<motion.button
  variants={actionButtonVariants}
  transition={{ delay: 0.1 }}    // Third button: 100ms delay
/>
```

### Expand/Collapse Animations

**Expandable Sections** (e.g., key points, activities):

```typescript
const expandVariants = {
  collapsed: {
    opacity: 0,
    height: 0,
  },
  expanded: {
    opacity: 1,
    height: 'auto',
    transition: {
      height: {
        duration: 0.3,
      },
      opacity: {
        duration: 0.25,
        delay: 0.1, // Opacity fades in after height expands
      },
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      height: {
        duration: 0.3,
        delay: 0.1, // Height collapses after opacity fades
      },
      opacity: {
        duration: 0.2,
      },
    },
  },
};

// Usage
<AnimatePresence>
  {isExpanded && (
    <motion.div
      variants={expandVariants}
      initial="collapsed"
      animate="expanded"
      exit="exit"
    >
      {/* Expandable content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Progress Bar Animations

**Subtask Progress Bar:**

```typescript
// Framer Motion for smooth progress fill
<motion.div
  initial={{ width: 0 }}
  animate={{ width: `${subtaskProgress}%` }}
  className="h-full bg-cyan-500 rounded-full"
  transition={{
    duration: 0.3,
    ease: 'easeOut',
  }}
/>
```

### Press/Active States

**Button Press:**

```css
/* Tailwind class */
active:scale-95
```

**Card Press (when clickable):**

```css
/* Tailwind class */
active:scale-[0.99]
```

---

## Accessibility Specifications

### ARIA Attributes

**Card Container:**

```tsx
<div
  role="article"
  aria-labelledby={`card-title-${id}`}
  aria-describedby={`card-meta-${id}`}
>
  <h3 id={`card-title-${id}`}>{title}</h3>
  <div id={`card-meta-${id}`}>{metadata}</div>
</div>
```

**Action Buttons:**

```tsx
<button
  aria-label="View task"
  aria-describedby={`task-title-${taskId}`}
>
  <ExternalLink className="w-4 h-4" aria-hidden="true" />
</button>

<button
  aria-label="Edit task"
  aria-describedby={`task-title-${taskId}`}
>
  <Edit2 className="w-4 h-4" aria-hidden="true" />
</button>

<button
  aria-label="Remove relationship"
  aria-describedby={`task-title-${taskId}`}
>
  <Trash2 className="w-4 h-4" aria-hidden="true" />
</button>
```

**Toggle Complete Button (Tasks):**

```tsx
<button
  aria-label={task.done ? 'Mark as incomplete' : 'Mark as complete'}
  aria-pressed={task.done}
  role="checkbox"
  tabIndex={0}
>
  {task.done ? <CheckCircle2 /> : <Circle />}
</button>
```

**Expandable Sections:**

```tsx
<button
  aria-expanded={isExpanded}
  aria-controls={`expandable-section-${id}`}
  onClick={() => setIsExpanded(!isExpanded)}
>
  Show {isExpanded ? 'less' : 'more'}
  {isExpanded ? <ChevronUp /> : <ChevronDown />}
</button>

<div
  id={`expandable-section-${id}`}
  aria-hidden={!isExpanded}
>
  {/* Expandable content */}
</div>
```

### Keyboard Shortcuts

**Card Focus:**
- Tab: Focus card
- Enter: Trigger primary action (view)
- Space: Same as Enter

**Action Buttons:**
- Tab: Cycle through visible action buttons
- Enter/Space: Trigger button action
- Escape: Close any expanded sections

**Checkbox (Tasks):**
- Space: Toggle complete status
- Enter: Toggle complete status

### Focus Management

**Focus Visible:**

```css
/* Tailwind classes */
focus:outline-none
focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2
```

**Focus Trap (in modals):**
- When card is part of a modal, focus should stay within modal
- Use `focus-trap-react` library if needed

**Skip Links:**
- Provide skip link to bypass card list: "Skip to next section"

### Screen Reader Announcements

**Live Regions:**

```tsx
{/* Announce when relationship is removed */}
<div role="status" aria-live="polite" className="sr-only">
  {announceText}
</div>
```

**Example Announcements:**
- "Relationship removed"
- "Task marked as complete"
- "Note expanded"
- "Related content loaded"

**Hidden Text for Icons:**

```tsx
<span className="sr-only">Priority: High</span>
<Flag className="w-3 h-3" aria-hidden="true" />
```

### Color Contrast

**WCAG AA Compliance:**

All text must meet **4.5:1** contrast ratio:

**Background Combinations:**
- Text `text-gray-900` (#111827) on `bg-white/70` ✓
- Text `text-gray-600` (#4B5563) on `bg-white/70` ✓
- Icon `text-cyan-600` (#0891B2) on `bg-cyan-100` ✓

**Border Contrast:**
- Border `border-blue-300/60` on `bg-white/70` ✓
- Border `border-white/60` on gradients ✓

**Colorblind-Safe:**
- Icons differentiate entities (not just color)
- Status uses both color AND icon (✓ checkmark, ○ circle)

---

## Implementation Guide

### File Structure

```
src/components/relationships/
├── TaskRelationshipCard.tsx
├── NoteRelationshipCard.tsx
├── SessionRelationshipCard.tsx
├── RelationshipCardBase.tsx        // Shared base component (optional)
└── index.ts                         // Barrel export
```

### Shared Base Component (Optional)

```tsx
// RelationshipCardBase.tsx
interface RelationshipCardBaseProps {
  children: React.ReactNode;
  relationshipType: RelationshipType;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  className?: string;
}

export const RelationshipCardBase: React.FC<RelationshipCardBaseProps> = ({
  children,
  relationshipType,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  className = '',
}) => {
  const colors = RELATIONSHIP_CARD_COLORS[relationshipType];

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`
        relative group
        bg-white/70 backdrop-blur-xl
        rounded-[16px]
        border-l-4 border-2 border-white/60
        ${colors.border} ${colors.bg}
        shadow-lg hover:shadow-xl hover:shadow-cyan-200/40
        transition-all duration-300
        hover:scale-[1.02]
        p-4
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
};
```

### Usage Example

```tsx
// In RelatedContentSection.tsx
import {
  TaskRelationshipCard,
  NoteRelationshipCard,
  SessionRelationshipCard,
} from '@/components/relationships';

const renderCard = (relationship: Relationship) => {
  switch (relationship.targetType) {
    case EntityType.TASK:
      return (
        <TaskRelationshipCard
          key={relationship.id}
          relationship={relationship}
          task={task}
          onView={handleViewTask}
          onToggleComplete={handleToggleComplete}
          onEdit={handleEditTask}
          onRemove={() => handleRemove(relationship.id)}
          showActions={true}
          showExcerpt={true}
        />
      );

    case EntityType.NOTE:
      return (
        <NoteRelationshipCard
          key={relationship.id}
          relationship={relationship}
          note={note}
          onView={handleViewNote}
          onEdit={handleEditNote}
          onRemove={() => handleRemove(relationship.id)}
          showActions={true}
          showKeyPoints={true}
          showEntities={true}
          companies={companies}
          contacts={contacts}
        />
      );

    case EntityType.SESSION:
      return (
        <SessionRelationshipCard
          key={relationship.id}
          relationship={relationship}
          session={session}
          onView={handleViewSession}
          onRemove={() => handleRemove(relationship.id)}
          showActions={true}
          showActivities={true}
        />
      );

    default:
      return null;
  }
};
```

### Performance Considerations

**React.memo:**

```tsx
export const TaskRelationshipCard = React.memo<TaskRelationshipCardProps>(
  ({ relationship, task, ...props }) => {
    // Component implementation
  },
  // Custom comparison function (optional)
  (prevProps, nextProps) => {
    return (
      prevProps.relationship.id === nextProps.relationship.id &&
      prevProps.task.done === nextProps.task.done &&
      prevProps.task.title === nextProps.task.title
      // Add other equality checks as needed
    );
  }
);
```

**Lazy Loading:**

```tsx
// Only render cards when visible (if in a long list)
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: relationships.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 120, // Estimated card height
  overscan: 5,
});
```

### Testing Checklist

**Visual Regression:**
- [ ] Card renders correctly for each entity type
- [ ] Hover states work (scale, shadow, actions reveal)
- [ ] Colors match design system
- [ ] Typography sizes correct
- [ ] Spacing consistent with existing cards

**Interaction:**
- [ ] View button navigates to entity
- [ ] Edit button opens edit form
- [ ] Remove button removes relationship
- [ ] Toggle complete works (tasks only)
- [ ] Expand/collapse works (if implemented)

**Accessibility:**
- [ ] Screen reader announces card content
- [ ] Keyboard navigation works (Tab, Enter, Space, Escape)
- [ ] Focus visible on all interactive elements
- [ ] ARIA attributes correct
- [ ] Color contrast meets WCAG AA

**Performance:**
- [ ] No jank when rendering 20+ cards
- [ ] Animations smooth (60fps)
- [ ] No unnecessary re-renders
- [ ] Virtual scrolling works (if implemented)

---

## Appendix A: Complete Code Template

**TaskRelationshipCard.tsx** (Skeleton):

```tsx
/**
 * TaskRelationshipCard Component
 *
 * Rich card display for related tasks with:
 * - Priority and status indicators
 * - Completion checkbox
 * - Due date with overdue highlighting
 * - Subtask progress bar
 * - Hover actions (view, edit, remove)
 * - AI confidence badge
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Clock,
  Flag,
  Trash2,
  Edit2,
  ExternalLink,
  Sparkles,
  FileText,
} from 'lucide-react';
import type { Task, Relationship } from '@/types';
import {
  getRadiusClass,
  TRANSITIONS,
  SCALE,
  PRIORITY_COLORS,
  getStatusBadgeClasses,
} from '@/design-system/theme';

export interface TaskRelationshipCardProps {
  relationship: Relationship;
  task: Task;
  variant?: 'compact' | 'default' | 'expanded';
  onView?: (taskId: string) => void;
  onToggleComplete?: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
  onRemove?: () => void;
  showActions?: boolean;
  showExcerpt?: boolean;
  showRelatedCounts?: boolean;
}

const STATUS_BORDER_COLORS = {
  todo: 'border-l-gray-400',
  'in-progress': 'border-l-cyan-500',
  done: 'border-l-green-500',
  blocked: 'border-l-red-500',
};

const PRIORITY_BG = {
  low: 'bg-gray-50/50',
  medium: 'bg-cyan-50/50',
  high: 'bg-orange-50/50',
  urgent: 'bg-red-50/50',
};

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
  exit: { opacity: 0, y: -5, transition: { duration: 0.2 } },
};

export const TaskRelationshipCard = React.memo<TaskRelationshipCardProps>(({
  relationship,
  task,
  variant = 'default',
  onView,
  onToggleComplete,
  onEdit,
  onRemove,
  showActions = true,
  showExcerpt = false,
  showRelatedCounts = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Format due date
  const formatDueDate = (date?: string, time?: string) => {
    // Implementation from TaskCard.tsx
  };

  // Calculate subtask progress
  const subtaskProgress = useMemo(() => {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    return (task.subtasks.filter(st => st.done).length / task.subtasks.length) * 100;
  }, [task.subtasks]);

  const dueText = formatDueDate(task.dueDate, task.dueTime);
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.done;

  if (variant === 'compact') {
    // Compact variant (minimal display)
    return (
      <motion.div
        variants={cardVariants}
        className="flex items-center gap-2 px-3 py-2 rounded-[12px] bg-white/50 backdrop-blur-xl hover:shadow-md transition-all duration-300"
      >
        {/* Compact implementation */}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative group
        bg-white/70 backdrop-blur-xl
        ${getRadiusClass('card')}
        border-l-4 border-2 border-white/60
        ${STATUS_BORDER_COLORS[task.status]}
        ${PRIORITY_BG[task.priority]}
        shadow-lg hover:shadow-xl hover:shadow-cyan-200/40
        ${TRANSITIONS.standard}
        hover:scale-[1.02]
        p-4
      `}
      role="article"
      aria-labelledby={`task-title-${task.id}`}
    >
      {/* Card content - see Layout Structure above */}
    </motion.div>
  );
});

TaskRelationshipCard.displayName = 'TaskRelationshipCard';
```

---

## Appendix B: Migration from Pills

**Before (Pills):**

```tsx
<RelationshipPills
  entityId={task.id}
  entityType={EntityType.TASK}
  filterTypes={[RelationshipType.TASK_NOTE]}
  maxVisible={5}
  showRemoveButton={true}
  onPillClick={() => setModalOpen(true)}
/>
```

**After (Cards):**

```tsx
<RelatedContentSection
  entityId={task.id}
  entityType={EntityType.TASK}
  title="Related Notes"
  filterTypes={[RelationshipType.TASK_NOTE]}
  renderCard={(rel, note) => (
    <NoteRelationshipCard
      relationship={rel}
      note={note}
      onView={handleViewNote}
      onEdit={handleEditNote}
      onRemove={() => handleRemove(rel.id)}
      showActions={true}
      showKeyPoints={true}
    />
  )}
  onAddClick={() => setModalOpen(true)}
/>
```

**Key Changes:**
- Pills → Cards (richer information)
- Horizontal inline → Vertical stacked
- maxVisible → No limit (scroll if needed)
- showRemoveButton → showActions (more actions available)
- onPillClick → renderCard (custom rendering)

---

## Document Metadata

**Author**: Claude Code (Sonnet 4.5)
**Created**: October 26, 2025
**Version**: 1.0.0
**Review Status**: Ready for Implementation
**Dependencies**:
- `/src/design-system/theme.ts` (design tokens)
- `/src/types.ts` (TypeScript types)
- `lucide-react` (icons)
- `framer-motion` (animations)
- `@tanstack/react-virtual` (optional, for large lists)

**Related Documents**:
- `/docs/reviews/ux-review-relationships.md` (design review)
- `/docs/RELATIONSHIP_UI_INTEGRATION.md` (integration guide)
- `/src/components/ned/TaskCard.tsx` (reference implementation)
- `/src/components/ned/NoteCard.tsx` (reference implementation)
- `/src/components/ned/SessionCard.tsx` (reference implementation)

**Next Steps**:
1. Create `TaskRelationshipCard.tsx` component
2. Create `NoteRelationshipCard.tsx` component
3. Create `SessionRelationshipCard.tsx` component
4. Update `RelatedContentSection.tsx` to use cards instead of pills
5. Add Storybook stories for visual documentation
6. Write unit tests for each card component
7. Perform accessibility audit (screen reader, keyboard, color contrast)
8. Conduct visual regression testing
9. Update `RELATIONSHIP_UI_INTEGRATION.md` with card migration guide
