/**
 * Example Usage of useRelationshipCard and useRelationshipCardActions
 *
 * This file demonstrates how to use the relationship card hooks together.
 * NOT imported anywhere - purely for documentation and testing purposes.
 */

import React from 'react';
import type { Relationship } from '@/types/relationships';
import type { Task, Note, Session } from '@/types';
import { useRelationshipCard } from './useRelationshipCard';
import { useRelationshipCardActions } from './useRelationshipCardActions';

/**
 * Example: TaskRelationshipCard component
 *
 * Shows how to combine both hooks to create a rich relationship card
 */
export function ExampleTaskRelationshipCard({
  relationship,
}: {
  relationship: Relationship;
}) {
  // Hook 1: Manage card state and fetch entity data
  const {
    entity: task,
    isLoading,
    error,
    isHovered,
    setIsHovered,
    isExpanded,
    toggleExpanded,
  } = useRelationshipCard<Task>(relationship);

  // Hook 2: Get action handlers
  const actions = useRelationshipCardActions({
    onSuccess: (action, id) => {
      console.log(`Action ${action} succeeded for ${id}`);
    },
    onError: (action, error) => {
      console.error(`Action ${action} failed:`, error);
    },
  });

  // Loading state
  if (isLoading) {
    return <div>Loading task...</div>;
  }

  // Error state
  if (error) {
    return <div>Error: {error.message}</div>;
  }

  // No entity found
  if (!task) {
    return null;
  }

  return (
    <div
      className="relationship-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Title with completion checkbox */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => actions.task.toggleComplete(task.id)}
          aria-label={task.done ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {task.done ? '✓' : '○'}
        </button>
        <h3 className={task.done ? 'line-through' : ''}>{task.title}</h3>
      </div>

      {/* Metadata */}
      <div className="metadata">
        <span>Priority: {task.priority}</span>
        <span>Status: {task.status}</span>
        {task.dueDate && <span>Due: {task.dueDate}</span>}
      </div>

      {/* Hover actions */}
      {isHovered && (
        <div className="actions">
          <button onClick={() => actions.view(task.id, 'task')}>View</button>
          <button onClick={() => actions.edit(task.id, 'task')}>Edit</button>
          <button onClick={() => actions.task.reschedule(task.id)}>
            Reschedule
          </button>
          <button onClick={() => actions.remove(relationship)}>Remove</button>
        </div>
      )}

      {/* Expandable details */}
      {isExpanded && task.description && (
        <div className="description">{task.description}</div>
      )}

      {/* Expand toggle */}
      <button onClick={toggleExpanded}>
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}

/**
 * Example: Using hooks independently
 *
 * Shows that hooks can be used separately if needed
 */
export function ExampleSimpleCard({ relationship }: { relationship: Relationship }) {
  // Just need entity data, no actions
  const { entity: task, isLoading } = useRelationshipCard<Task>(relationship);

  if (isLoading || !task) return null;

  return <div>{task.title}</div>;
}

export function ExampleActionButtons({ relationship }: { relationship: Relationship }) {
  // Just need actions, already have entity data
  const actions = useRelationshipCardActions();

  return (
    <div>
      <button onClick={() => actions.view(relationship.targetId, relationship.targetType)}>
        View
      </button>
      <button onClick={() => actions.remove(relationship)}>Remove</button>
    </div>
  );
}

/**
 * Example: Note relationship card
 */
export function ExampleNoteRelationshipCard({
  relationship,
}: {
  relationship: Relationship;
}) {
  const { entity: note, isLoading, isHovered, setIsHovered } =
    useRelationshipCard<Note>(relationship); // Type assertion

  const actions = useRelationshipCardActions();

  if (isLoading || !note) return null;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <h3>{note.summary}</h3>
      <p>{note.content}</p>

      {isHovered && (
        <div>
          <button onClick={() => actions.view(note.id, 'note')}>View</button>
          <button onClick={() => actions.note.addUpdate(note.id)}>Add Update</button>
          <button onClick={() => actions.remove(relationship)}>Remove</button>
        </div>
      )}
    </div>
  );
}

/**
 * Example: Session relationship card
 */
export function ExampleSessionRelationshipCard({
  relationship,
}: {
  relationship: Relationship;
}) {
  const { entity: session, isLoading } = useRelationshipCard<Session>(relationship); // Type assertion
  const actions = useRelationshipCardActions();

  if (isLoading || !session) return null;

  return (
    <div>
      <h3>{session.name}</h3>
      <p>{session.description}</p>

      <div>
        <button onClick={() => actions.view(session.id, 'session')}>View</button>
        <button onClick={() => actions.session.enrich(session.id)}>Enrich</button>
        <button onClick={() => actions.session.exportSession(session.id)}>
          Export
        </button>
        <button onClick={() => actions.remove(relationship)}>Remove</button>
      </div>
    </div>
  );
}
