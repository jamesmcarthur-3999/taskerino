# TaskModule Example

**Last Updated**: October 26, 2025

## Purpose

This example demonstrates the TaskModule component, which displays tasks with multiple view variants (compact, default, expanded, kanban) for session reviews in the Morphing Canvas system.

## Use Case

Use the TaskModule when you need to:
- Display session-related tasks in canvas layouts
- Show task lists with varying levels of detail (compact, default, expanded)
- Present tasks in kanban board format grouped by status
- Handle task actions (toggle completion, edit, delete)
- Display loading, empty, and error states gracefully
- Filter completed/incomplete tasks dynamically

## Example Code

```typescript
/**
 * TaskModule Example Usage
 *
 * This file demonstrates how to use the TaskModule component
 * with different variants and configurations.
 */

import { TaskModule } from './TaskModule';
import type { Task } from '../../../types';

// Sample task data
const sampleTasks: Task[] = [
  {
    id: '1',
    title: 'Complete project proposal',
    description: 'Finish the Q4 project proposal and send to stakeholders',
    done: false,
    priority: 'high',
    status: 'in-progress',
    dueDate: new Date().toISOString(),
    dueTime: '17:00',
    createdAt: new Date().toISOString(),
    createdBy: 'manual',
    tags: ['work', 'proposal'],
    subtasks: [
      { id: 's1', title: 'Research competitors', done: true, createdAt: new Date().toISOString() },
      { id: 's2', title: 'Draft outline', done: true, createdAt: new Date().toISOString() },
      { id: 's3', title: 'Review with team', done: false, createdAt: new Date().toISOString() },
    ],
  },
  {
    id: '2',
    title: 'Fix authentication bug',
    description: 'Users are getting logged out unexpectedly',
    done: false,
    priority: 'urgent',
    status: 'blocked',
    dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    createdAt: new Date().toISOString(),
    createdBy: 'ai',
    tags: ['bug', 'urgent'],
  },
  {
    id: '3',
    title: 'Review pull requests',
    done: false,
    priority: 'medium',
    status: 'todo',
    createdAt: new Date().toISOString(),
    createdBy: 'manual',
  },
  {
    id: '4',
    title: 'Update documentation',
    description: 'Add examples to the API documentation',
    done: true,
    priority: 'low',
    status: 'done',
    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    completedAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'manual',
    tags: ['docs'],
  },
];

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * Example 1: Compact Variant
 */
export function CompactVariantExample() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Compact Variant</h2>
      <TaskModule
        data={{ tasks: sampleTasks }}
        variant="compact"
        config={{
          showCompleted: true,
          sortBy: 'priority',
          compactSpacing: true,
        }}
        onAction={(action, task) => {
          console.log('Action:', action, 'Task:', task);
        }}
      />
    </div>
  );
}

/**
 * Example 2: Default Variant
 */
export function DefaultVariantExample() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Default Variant</h2>
      <TaskModule
        data={{ tasks: sampleTasks }}
        variant="default"
        config={{
          showCompleted: true,
          sortBy: 'dueDate',
        }}
        onAction={(action, task) => {
          console.log('Action:', action, 'Task:', task);
        }}
      />
    </div>
  );
}

/**
 * Example 3: Expanded Variant
 */
export function ExpandedVariantExample() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Expanded Variant</h2>
      <TaskModule
        data={{ tasks: sampleTasks }}
        variant="expanded"
        config={{
          showCompleted: true,
          sortBy: 'priority',
        }}
        onAction={(action, task) => {
          console.log('Action:', action, 'Task:', task);
        }}
      />
    </div>
  );
}

/**
 * Example 4: Kanban Variant
 */
export function KanbanVariantExample() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Kanban Variant</h2>
      <TaskModule
        data={{ tasks: sampleTasks }}
        variant="kanban"
        config={{
          showCompleted: true,
        }}
        onAction={(action, task) => {
          console.log('Action:', action, 'Task:', task);
        }}
      />
    </div>
  );
}

/**
 * Example 5: Loading State
 */
export function LoadingStateExample() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Loading State</h2>
      <TaskModule
        data={{ tasks: [] }}
        variant="default"
        isLoading={true}
      />
    </div>
  );
}

/**
 * Example 6: Empty State
 */
export function EmptyStateExample() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Empty State</h2>
      <TaskModule
        data={{ tasks: [] }}
        variant="default"
        config={{
          showCompleted: false,
        }}
      />
    </div>
  );
}

/**
 * Example 7: Error State
 */
export function ErrorStateExample() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Error State</h2>
      <TaskModule
        data={{ tasks: [] }}
        variant="default"
        error="Failed to load tasks from the server"
      />
    </div>
  );
}

/**
 * Example 8: Hide Completed Tasks
 */
export function HideCompletedExample() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Hide Completed Tasks</h2>
      <TaskModule
        data={{ tasks: sampleTasks }}
        variant="default"
        config={{
          showCompleted: false,
          sortBy: 'priority',
        }}
        onAction={(action, task) => {
          console.log('Action:', action, 'Task:', task);
        }}
      />
    </div>
  );
}

/**
 * All Examples Demo
 */
export function AllExamplesDemo() {
  return (
    <div className="space-y-8">
      <CompactVariantExample />
      <DefaultVariantExample />
      <ExpandedVariantExample />
      <KanbanVariantExample />
      <LoadingStateExample />
      <EmptyStateExample />
      <ErrorStateExample />
      <HideCompletedExample />
    </div>
  );
}
```

## Key Points

- **Four Variants**: Compact (minimal), Default (standard), Expanded (detailed), Kanban (board view)
- **Task Actions**: Toggle completion, edit, delete via onAction callback
- **Sorting Options**: Sort by priority, dueDate, createdAt, or status
- **Filtering**: Show/hide completed tasks with showCompleted config
- **Subtasks Support**: Expanded variant shows subtask progress
- **Priority Indicators**: Visual badges for low/medium/high/urgent priorities
- **Status States**: todo, in-progress, blocked, done with color coding
- **Loading/Error/Empty States**: Graceful handling of all states
- **AI-Created Indicator**: Shows badge for tasks created by AI (createdBy: 'ai')
- **Due Date Highlighting**: Overdue tasks highlighted in red

## Configuration Options

```typescript
config: {
  showCompleted: boolean;      // Show/hide completed tasks
  sortBy: 'priority' | 'dueDate' | 'createdAt' | 'status';
  compactSpacing?: boolean;    // Tighter spacing for compact variant
}
```

## Action Types

- `'toggle'` - Toggle task completion status
- `'edit'` - Edit task details
- `'delete'` - Delete task

## Related Documentation

- Main Component: `/src/components/morphing-canvas/modules/TaskModule.tsx`
- Task Types: `/src/types.ts`
- Morphing Canvas: `/src/components/morphing-canvas/`
- Task Context: `/src/context/TasksContext.tsx`
