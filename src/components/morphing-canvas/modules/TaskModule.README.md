# TaskModule Component

A flexible, beautiful task display module for the Morphing Canvas system. Supports multiple viewing modes, interactive task management, and smooth animations.

## Features

- **Multiple Variants**: compact, default, expanded, and kanban views
- **Interactive**: Click to toggle task completion, view details, and more
- **Priority Badges**: Color-coded priority indicators (high=red, medium=yellow, low=green, urgent=red)
- **Status Indicators**: Visual status badges with icons (todo, in-progress, done, blocked)
- **Responsive**: Automatically adapts to mobile with stacking layout
- **States**: Loading skeleton, empty state, and error handling
- **Animations**: Smooth Framer Motion animations with staggered entry
- **TypeScript**: Fully typed with comprehensive interfaces

## Installation

The TaskModule is part of the morphing-canvas system and requires:

```bash
# Dependencies (already included in package.json)
- react ^19.1.1
- framer-motion ^12.23.22
- lucide-react ^0.544.0
```

## Basic Usage

```tsx
import { TaskModule } from './components/morphing-canvas/modules/TaskModule';
import type { Task } from './types';

const tasks: Task[] = [
  {
    id: '1',
    title: 'Complete project proposal',
    description: 'Finish the Q4 project proposal',
    done: false,
    priority: 'high',
    status: 'in-progress',
    dueDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: 'manual',
  },
];

function MyComponent() {
  return (
    <TaskModule
      data={{ tasks }}
      variant="default"
      config={{ showCompleted: true, sortBy: 'priority' }}
      onAction={(action, task) => {
        console.log('Action:', action, 'Task:', task);
      }}
    />
  );
}
```

## Props

### TaskModuleProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `TaskModuleData` | Yes | Object containing array of tasks |
| `variant` | `TaskVariant` | Yes | Display variant: 'compact', 'default', 'expanded', 'kanban' |
| `config` | `TaskModuleConfig` | No | Configuration options |
| `onAction` | `(action, task) => void` | No | Callback for task actions |
| `isLoading` | `boolean` | No | Shows loading spinner |
| `error` | `string \| null` | No | Shows error state with message |

### TaskModuleConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sortBy` | `'priority' \| 'dueDate' \| 'createdAt' \| 'status'` | `'priority'` | How to sort tasks |
| `groupBy` | `'none' \| 'priority' \| 'status' \| 'topic'` | `'none'` | Group tasks by field |
| `showCompleted` | `boolean` | `true` | Show completed tasks |
| `enableInlineEdit` | `boolean` | `false` | Enable inline editing |
| `compactSpacing` | `boolean` | `false` | Reduce spacing between items |

### TaskAction Types

Actions passed to `onAction` callback:

- `'toggle-complete'` - User toggled task completion checkbox
- `'edit'` - User clicked edit button
- `'delete'` - User clicked delete button
- `'view-details'` - User clicked to view full task details
- `'change-priority'` - User changed task priority
- `'change-status'` - User changed task status

## Variants

### Compact Variant

Dense list with checkboxes, title, and priority badge only.

```tsx
<TaskModule
  data={{ tasks }}
  variant="compact"
  config={{ compactSpacing: true }}
/>
```

**Best for:**
- Quick task lists
- Sidebar displays
- Mobile views
- High task counts

### Default Variant

Card-based view with title, description, priority, status, and due date.

```tsx
<TaskModule
  data={{ tasks }}
  variant="default"
  config={{ sortBy: 'dueDate' }}
/>
```

**Best for:**
- Main task dashboard
- Balanced information display
- General-purpose task viewing

### Expanded Variant

Full cards with all metadata, subtasks, and tags visible.

```tsx
<TaskModule
  data={{ tasks }}
  variant="expanded"
  config={{ showCompleted: true }}
/>
```

**Best for:**
- Detailed task review
- Project management views
- When screen space is abundant
- Complex tasks with subtasks

### Kanban Variant

Columns organized by task status (todo, in-progress, done, blocked).

```tsx
<TaskModule
  data={{ tasks }}
  variant="kanban"
/>
```

**Best for:**
- Project tracking
- Sprint boards
- Visual workflow management
- Team collaboration views

## Examples

### Hide Completed Tasks

```tsx
<TaskModule
  data={{ tasks }}
  variant="default"
  config={{
    showCompleted: false,
    sortBy: 'priority',
  }}
/>
```

### Sort by Due Date

```tsx
<TaskModule
  data={{ tasks }}
  variant="default"
  config={{
    sortBy: 'dueDate',
  }}
/>
```

### Handle Task Actions

```tsx
<TaskModule
  data={{ tasks }}
  variant="default"
  onAction={(action, task) => {
    switch (action) {
      case 'toggle-complete':
        // Update task completion status
        updateTask(task.id, { done: !task.done });
        break;
      case 'view-details':
        // Open task detail sidebar
        openTaskDetails(task.id);
        break;
      case 'delete':
        // Delete task with confirmation
        confirmDelete(task.id);
        break;
    }
  }}
/>
```

### Loading State

```tsx
<TaskModule
  data={{ tasks: [] }}
  variant="default"
  isLoading={true}
/>
```

### Error State

```tsx
<TaskModule
  data={{ tasks: [] }}
  variant="default"
  error="Failed to load tasks from the server"
/>
```

## Styling

The TaskModule uses the existing design system components:

- **Card**: Glass morphism cards with hover effects
- **Badge**: Color-coded priority and status badges
- **Button**: Interactive buttons with animations

### Priority Colors

- **Low**: Green gradient (`bg-gradient-to-r from-green-100 to-emerald-100`)
- **Medium**: Yellow/Orange gradient (`bg-gradient-to-r from-yellow-100 to-orange-100`)
- **High**: Orange/Red gradient (`bg-gradient-to-r from-orange-100 to-red-100`)
- **Urgent**: Red/Rose gradient (`bg-gradient-to-r from-red-100 to-rose-100`)

### Status Colors

- **To Do**: Gray (`text-gray-500`)
- **In Progress**: Blue (`text-blue-500`)
- **Done**: Green (`text-green-500`)
- **Blocked**: Red (`text-red-500`)

## Animations

The module uses Framer Motion for smooth animations:

- **Staggered Entry**: Items animate in with a 50ms delay between each
- **Hover Effects**: Cards scale and lift on hover
- **Checkbox**: Spring animation on toggle with scale effect
- **Exit Animation**: Fade and scale down when items are removed

## Accessibility

- Semantic HTML with proper ARIA labels
- Keyboard navigation support
- Focus indicators on interactive elements
- Screen reader friendly task status announcements

## Performance

- Memoized sorting and filtering
- AnimatePresence for efficient list updates
- Callback memoization with useCallback
- Lightweight animations with GPU acceleration

## TypeScript Types

All types are exported from `../types/module`:

```tsx
import type {
  TaskModuleProps,
  TaskModuleData,
  TaskModuleConfig,
  TaskVariant,
  TaskAction,
} from '../types/module';
```

## Related Components

- **Card**: `/src/components/Card.tsx`
- **Badge**: `/src/components/Badge.tsx`
- **Button**: `/src/components/Button.tsx`

## Task Type Reference

The `Task` type from `/src/types.ts` includes:

```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  done: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  dueDate?: string;
  dueTime?: string;
  createdAt: string;
  completedAt?: string;
  subtasks?: SubTask[];
  tags?: string[];
  createdBy: 'ai' | 'manual';
  // ... more fields
}
```

## Browser Support

- Chrome/Edge: 90+
- Firefox: 88+
- Safari: 14+
- Mobile browsers: iOS Safari 14+, Chrome Mobile 90+

## License

Part of the Taskerino application.
