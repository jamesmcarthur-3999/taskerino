# TopicPillManager Example

**Last Updated**: October 26, 2025

## Purpose

This example demonstrates the TopicPillManager component, a single-select topic picker with search, dropdown, and visual pill display. Topics are displayed with an amber gradient and pin emoji (📌).

## Use Case

Use TopicPillManager when you need to:
- Associate a single topic with a task or note
- Display the selected topic as a visual pill
- Provide a searchable dropdown for topic selection
- Allow users to remove topic associations
- Support both editable and read-only modes
- Show topic metadata (note count)

## Example Code

```typescript
/**
 * TopicPillManager - Usage Example
 *
 * This file demonstrates how to use the TopicPillManager component.
 * You can temporarily add this to your zone components for testing.
 */

import React, { useState } from 'react';
import { TopicPillManager } from './TopicPillManager';
import { useEntities } from '../context/EntitiesContext';

/**
 * Example 1: Basic usage in a task/note form
 */
export function ExampleTaskForm() {
  const { state: entitiesState } = useEntities();
  const [topicId, setTopicId] = useState<string | undefined>(undefined);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">Task Form Example</h2>

      <div>
        <label className="block text-sm font-medium mb-1">Topic</label>
        <TopicPillManager
          topicId={topicId}
          onTopicChange={setTopicId}
          allTopics={entitiesState.topics}
          editable={true}
        />
      </div>

      <div className="text-sm text-gray-600">
        Selected topic ID: {topicId || 'None'}
      </div>
    </div>
  );
}

/**
 * Example 2: Read-only display in a task card
 */
export function ExampleTaskCard() {
  const { state: entitiesState } = useEntities();
  const topicId = 'topic-123'; // From task.topicId

  return (
    <div className="p-4 bg-white/30 rounded-xl space-y-2">
      <h3 className="font-semibold">Task Title</h3>
      <p className="text-sm">Task description goes here...</p>

      <div className="flex items-center gap-2">
        <TopicPillManager
          topicId={topicId}
          onTopicChange={() => {}} // No-op for read-only
          allTopics={entitiesState.topics}
          editable={false}
        />
      </div>
    </div>
  );
}

/**
 * Example 3: Integration with TaskDetailInline
 *
 * To integrate into TaskDetailInline.tsx, add this near the existing tags section:
 */
export function TaskDetailInlineIntegration() {
  return `
  // In TaskDetailInline.tsx, around line 400-500:

  import { TopicPillManager } from './TopicPillManager';
  import { useEntities } from '../context/EntitiesContext';

  // Inside component:
  const { state: entitiesState } = useEntities();

  // Add this section in the render:
  <div className="flex items-start gap-4 pb-4">
    <span className="text-xs text-gray-600 font-semibold uppercase tracking-wider min-w-[80px] pt-1">
      Topic
    </span>
    <TopicPillManager
      topicId={editedTask.topicId}
      onTopicChange={(newTopicId) => {
        handleInputChange({ target: { name: 'topicId', value: newTopicId } });
      }}
      allTopics={entitiesState.topics}
      editable={isEditing}
    />
  </div>
  `;
}

/**
 * Example 4: Integration with NoteDetailInline
 *
 * To integrate into NoteDetailInline.tsx:
 */
export function NoteDetailInlineIntegration() {
  return `
  // In NoteDetailInline.tsx:

  import { TopicPillManager } from './TopicPillManager';
  import { useEntities } from '../context/EntitiesContext';

  // Inside component:
  const { state: entitiesState } = useEntities();

  // Note: Notes support multiple topics via topicIds array
  // This shows how to handle the first topic (or you could show multiple pills)

  const firstTopicId = note.topicIds?.[0];

  // Add this section in the render:
  <div className="flex items-start gap-4 pb-4">
    <span className="text-xs text-gray-600 font-semibold uppercase tracking-wider min-w-[80px] pt-1">
      Topic
    </span>
    <TopicPillManager
      topicId={firstTopicId}
      onTopicChange={(newTopicId) => {
        // Update note's topicIds array
        const newTopicIds = newTopicId ? [newTopicId] : [];
        // Call your update function with newTopicIds
      }}
      allTopics={entitiesState.topics}
      editable={isEditing}
    />
  </div>
  `;
}
```

## Manual Testing Checklist

### 1. Empty State
- [ ] "+ Add topic" button displays correctly
- [ ] Hover shows amber border
- [ ] Click opens dropdown

### 2. Topic Selection
- [ ] All topics appear in dropdown
- [ ] Search filters topics correctly
- [ ] Clicking a topic selects it
- [ ] Pill displays with amber gradient
- [ ] Emoji (📌) displays correctly

### 3. Topic Removal
- [ ] Hover shows remove (×) button
- [ ] Click × removes topic
- [ ] Returns to empty state

### 4. Keyboard Navigation
- [ ] Tab focuses the pill
- [ ] Enter/Space opens dropdown
- [ ] Type to search in dropdown
- [ ] Escape closes dropdown

### 5. Read-Only Mode
- [ ] Pill is not clickable
- [ ] No hover effects
- [ ] No remove button

### 6. Edge Cases
- [ ] Empty topics list shows "No topics found"
- [ ] Note count displays correctly
- [ ] Long topic names don't break layout
- [ ] Click outside closes dropdown

## Key Points

- **Single Selection**: Only one topic can be selected at a time (unlike CompanyPillManager/ContactPillManager which support multiple)
- **Amber Gradient**: Topics use amber/yellow gradient for visual distinction
- **Pin Emoji**: 📌 emoji indicates topics
- **Searchable Dropdown**: Type to filter topics in real-time
- **Remove on Hover**: Hover over pill to show remove (×) button
- **Empty State**: "+ Add topic" button when no topic selected
- **Read-Only Support**: Non-interactive display when editable={false}
- **Note Count**: Displays number of notes associated with each topic
- **Keyboard Accessible**: Full keyboard navigation support

## Props

```typescript
interface TopicPillManagerProps {
  topicId: string | undefined;         // Currently selected topic ID
  onTopicChange: (topicId: string | undefined) => void;
  allTopics: Topic[];                  // All available topics
  editable?: boolean;                  // Enable/disable editing (default: true)
}
```

## Integration Examples

### In TaskDetailInline.tsx
```tsx
<TopicPillManager
  topicId={editedTask.topicId}
  onTopicChange={(newTopicId) => {
    handleInputChange({ target: { name: 'topicId', value: newTopicId } });
  }}
  allTopics={entitiesState.topics}
  editable={isEditing}
/>
```

### In NoteDetailInline.tsx (handling multiple topics)
```tsx
const firstTopicId = note.topicIds?.[0];

<TopicPillManager
  topicId={firstTopicId}
  onTopicChange={(newTopicId) => {
    const newTopicIds = newTopicId ? [newTopicId] : [];
    // Update note with new topicIds array
  }}
  allTopics={entitiesState.topics}
  editable={isEditing}
/>
```

## Related Documentation

- Main Component: `/src/components/TopicPillManager.tsx`
- Entities Context: `/src/context/EntitiesContext.tsx`
- Multi-Select Variants: `/src/components/CompanyPillManager.tsx`, `/src/components/ContactPillManager.tsx`
- Task Types: `/src/types.ts`
