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
