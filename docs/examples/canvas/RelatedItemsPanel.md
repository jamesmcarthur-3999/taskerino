# RelatedItemsPanel Example

**Last Updated**: October 26, 2025

## Purpose

This example demonstrates the RelatedItemsPanel component, which displays AI-suggested related tasks and notes with optional update suggestions. The panel is used in session reviews to show contextually relevant items.

## Use Case

Use the RelatedItemsPanel when you need to:
- Display session-related tasks and notes in AI-generated canvas layouts
- Show AI-suggested updates to existing tasks/notes based on session content
- Provide relevance explanations for why items are related
- Handle large lists with "Show More" functionality
- Display empty states when no related items exist
- Support read-only and interactive modes

## Example Code

```typescript
/**
 * RelatedItemsPanel - Usage Examples
 *
 * This file demonstrates how to use the RelatedItemsPanel component
 * in different scenarios.
 */

import React from 'react';
import { RelatedItemsPanel } from './RelatedItemsPanel';
import type { RelatedItem } from '../types';

// Example 1: Basic usage with tasks and notes
export function BasicExample() {
  const items: RelatedItem[] = [
    {
      type: 'task',
      id: 'task-1',
      title: 'Implement user authentication',
      relevance: 'This task is related to the login flow you were working on',
      status: 'in-progress',
      priority: 'high',
      tags: ['backend', 'auth', 'security'],
      createdAt: '2025-01-15T10:00:00Z',
      lastModified: '2025-01-20T14:30:00Z',
    },
    {
      type: 'note',
      id: 'note-1',
      title: 'API Design Decisions',
      relevance: 'Contains important context about the authentication API you mentioned',
      tags: ['api', 'architecture'],
      createdAt: '2025-01-10T09:00:00Z',
    },
  ];

  return <RelatedItemsPanel items={items} title="Related Work" />;
}

// Example 2: With suggested updates
export function WithSuggestedUpdates() {
  const items: RelatedItem[] = [
    {
      type: 'task',
      id: 'task-2',
      title: 'Fix login bug',
      relevance: 'You mentioned fixing this bug in your recent session',
      status: 'todo',
      priority: 'urgent',
      suggestedUpdate: {
        type: 'update_task',
        label: 'Mark as completed',
        updateTask: {
          taskId: 'task-2',
          existingTitle: 'Fix login bug',
          updates: {
            status: 'done',
            notes: 'Bug fixed during session on 2025-01-20',
          },
          reasoning: 'You mentioned completing this task during your work session',
        },
        metadata: {
          reasoning: 'Session screenshots show the bug being resolved',
          confidence: 0.85,
        },
      },
    },
    {
      type: 'note',
      id: 'note-2',
      title: 'Project Requirements',
      relevance: 'Contains requirements that align with your current work',
      tags: ['requirements', 'planning'],
      suggestedUpdate: {
        type: 'update_note',
        label: 'Add new insights',
        updateNote: {
          noteId: 'note-2',
          existingTitle: 'Project Requirements',
          updates: {
            content: 'New requirement discovered: Support for OAuth2 providers',
          },
          reasoning: 'Session revealed need for third-party OAuth support',
        },
      },
    },
  ];

  return (
    <RelatedItemsPanel
      items={items}
      title="Items with Suggested Updates"
      showItemsWithoutUpdates={false}
      theme="info"
    />
  );
}

// Example 3: Large list with "Show More" functionality
export function LargeListExample() {
  const items: RelatedItem[] = Array.from({ length: 25 }, (_, i) => ({
    type: i % 2 === 0 ? ('task' as const) : ('note' as const),
    id: `item-${i}`,
    title: `Item ${i + 1}`,
    relevance: `This item is relevant because of reason ${i + 1}`,
    status: i % 2 === 0 ? (['todo', 'in-progress', 'done'] as const)[i % 3] : undefined,
    priority: i % 2 === 0 ? (['low', 'medium', 'high'] as const)[i % 3] : undefined,
    tags: [`tag${i}`, `category${i % 5}`],
  }));

  return (
    <RelatedItemsPanel
      items={items}
      maxItems={5}
      title="All Related Items"
    />
  );
}

// Example 4: Empty state
export function EmptyStateExample() {
  return (
    <RelatedItemsPanel
      items={[]}
      title="Related Items"
    />
  );
}

// Example 5: Using with ComponentTree (for AI-generated layouts)
export const exampleComponentTree = {
  component: 'RelatedItemsPanel' as const,
  props: {
    items: [
      {
        type: 'task',
        id: 'task-1',
        title: 'Complete project documentation',
        relevance: 'You worked on documentation during this session',
        status: 'in-progress',
        priority: 'medium',
        suggestedUpdate: {
          type: 'update_task',
          label: 'Update progress',
          updateTask: {
            taskId: 'task-1',
            existingTitle: 'Complete project documentation',
            updates: {
              notes: 'Made significant progress on API documentation',
            },
            reasoning: 'Session screenshots show API docs being written',
          },
        },
      },
    ],
    title: 'Related Tasks',
    showItemsWithoutUpdates: true,
    maxItems: 10,
    theme: 'default',
  },
};
```

## Key Points

- **Mixed Content**: Displays both tasks and notes in a unified panel
- **Relevance Explanations**: Shows why each item is related to the session
- **Suggested Updates**: AI can suggest updates to tasks/notes based on session content
- **Status Indicators**: Shows task status (todo, in-progress, done, blocked) with color badges
- **Priority Badges**: Displays task priority (low, medium, high, urgent)
- **Show More**: Automatically handles large lists with "Show More" button (default: 10 items)
- **Empty State**: Gracefully displays message when no related items exist
- **Filtering**: Can hide items without suggested updates via showItemsWithoutUpdates prop
- **Theme Support**: Supports 'default' and 'info' themes for different visual styles
- **Tags Display**: Shows tags for both tasks and notes

## Props

```typescript
interface RelatedItemsPanelProps {
  items: RelatedItem[];
  title?: string;                      // Panel title (default: "Related Items")
  maxItems?: number;                   // Items to show before "Show More" (default: 10)
  showItemsWithoutUpdates?: boolean;   // Show items with no suggestedUpdate (default: true)
  theme?: 'default' | 'info';          // Visual theme (default: 'default')
}
```

## RelatedItem Structure

```typescript
interface RelatedItem {
  type: 'task' | 'note';
  id: string;
  title: string;
  relevance: string;                   // Why this item is related
  status?: TaskStatus;                 // For tasks: 'todo' | 'in-progress' | 'done' | 'blocked'
  priority?: TaskPriority;             // For tasks: 'low' | 'medium' | 'high' | 'urgent'
  tags?: string[];
  createdAt?: string;
  lastModified?: string;
  suggestedUpdate?: {                  // Optional AI-suggested update
    type: 'update_task' | 'update_note';
    label: string;
    updateTask?: { ... };
    updateNote?: { ... };
    metadata?: {
      reasoning: string;
      confidence: number;
    };
  };
}
```

## Related Documentation

- Main Component: `/src/components/canvas/primitives/RelatedItemsPanel.tsx`
- Canvas Types: `/src/components/canvas/types.ts`
- Morphing Canvas: `/src/components/morphing-canvas/`
- Session Enrichment: `/src/services/sessionEnrichmentService.ts`
