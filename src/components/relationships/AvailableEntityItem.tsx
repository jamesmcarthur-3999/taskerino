/**
 * AvailableEntityItem - Component to display a single available entity in the "Available to Link" list
 *
 * Features:
 * - Checkbox for bulk selection
 * - Entity icon and label
 * - Entity metadata (e.g., task status, note summary preview)
 * - Link button
 * - Keyboard accessible
 * - Screen reader friendly
 * - Memoized for performance
 *
 * @module components/relationships/AvailableEntityItem
 * @since 2.0.0
 */

import React, { memo, useCallback } from 'react';
import type { EntityType } from '@/types/relationships';
import type { Task, Note, Session, Topic, Company, Contact } from '@/types';
import { Link2, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/Button';
import { Badge } from '@/components/ui/badge';

/**
 * Props for AvailableEntityItem component
 */
export interface AvailableEntityItemProps {
  /** Entity to display */
  entity: Task | Note | Session | Topic | Company | Contact;
  /** Type of entity */
  entityType: EntityType;
  /** Display label for entity */
  label: string;
  /** Metadata string for entity */
  metadata: string;
  /** Callback when link button is clicked */
  onLink: () => void;
  /** Is this item selected for bulk operations? */
  selected: boolean;
  /** Callback when selection changes */
  onSelect: (selected: boolean) => void;
}

/**
 * Get icon for entity type (Lucide icon name)
 */
function getEntityIcon(type: EntityType): React.ReactNode {
  // Using simple text for now - could be replaced with actual icons
  const iconMap: Record<EntityType, string> = {
    task: '✓',
    note: '📝',
    session: '🎥',
    topic: '🏷️',
    company: '🏢',
    contact: '👤',
    file: '📎',
    project: '📁',
    goal: '🎯',
  };

  return <span className="text-lg">{iconMap[type] || '•'}</span>;
}

/**
 * Get color for entity type
 */
function getEntityColor(type: EntityType): string {
  const colorMap: Record<EntityType, string> = {
    task: 'bg-blue-100 text-blue-700',
    note: 'bg-purple-100 text-purple-700',
    session: 'bg-green-100 text-green-700',
    topic: 'bg-yellow-100 text-yellow-700',
    company: 'bg-orange-100 text-orange-700',
    contact: 'bg-pink-100 text-pink-700',
    file: 'bg-gray-100 text-gray-700',
    project: 'bg-teal-100 text-teal-700',
    goal: 'bg-red-100 text-red-700',
  };

  return colorMap[type] || 'bg-gray-100 text-gray-700';
}

/**
 * Get task-specific metadata badges
 */
function getTaskMetadata(task: Task): React.ReactNode[] {
  const badges: React.ReactNode[] = [];

  // Status badge
  const statusColors: Record<Task['status'], string> = {
    'todo': 'bg-gray-100 text-gray-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    'done': 'bg-green-100 text-green-700',
    'blocked': 'bg-red-100 text-red-700',
  };

  badges.push(
    <Badge key="status" className={statusColors[task.status]}>
      {task.status}
    </Badge>
  );

  // Priority badge
  const priorityColors: Record<Task['priority'], string> = {
    'low': 'bg-gray-100 text-gray-600',
    'medium': 'bg-yellow-100 text-yellow-700',
    'high': 'bg-orange-100 text-orange-700',
    'urgent': 'bg-red-100 text-red-700',
  };

  badges.push(
    <Badge key="priority" className={priorityColors[task.priority]}>
      {task.priority}
    </Badge>
  );

  return badges;
}

/**
 * Get note-specific metadata badges
 */
function getNoteMetadata(note: Note): React.ReactNode[] {
  const badges: React.ReactNode[] = [];

  // Tags (first 2)
  if (note.tags && note.tags.length > 0) {
    note.tags.slice(0, 2).forEach((tag, i) => {
      badges.push(
        <Badge key={`tag-${i}`} className="bg-purple-100 text-purple-700">
          {tag}
        </Badge>
      );
    });
  }

  // Source badge
  if (note.source) {
    badges.push(
      <Badge key="source" className="bg-gray-100 text-gray-600">
        {note.source}
      </Badge>
    );
  }

  return badges;
}

/**
 * Get session-specific metadata badges
 */
function getSessionMetadata(session: Session): React.ReactNode[] {
  const badges: React.ReactNode[] = [];

  // Status badge
  const statusColors: Record<Session['status'], string> = {
    'active': 'bg-green-100 text-green-700',
    'paused': 'bg-yellow-100 text-yellow-700',
    'completed': 'bg-blue-100 text-blue-700',
    'interrupted': 'bg-red-100 text-red-700',
  };

  badges.push(
    <Badge key="status" className={statusColors[session.status]}>
      {session.status}
    </Badge>
  );

  // Screenshots count
  if (session.screenshots && session.screenshots.length > 0) {
    badges.push(
      <Badge key="screenshots" className="bg-gray-100 text-gray-600">
        {session.screenshots.length} screenshots
      </Badge>
    );
  }

  return badges;
}

/**
 * Get entity-specific metadata badges
 */
function getEntityMetadataBadges(
  entity: Task | Note | Session | Topic | Company | Contact,
  type: EntityType
): React.ReactNode[] {
  switch (type) {
    case 'task':
      return getTaskMetadata(entity as Task);
    case 'note':
      return getNoteMetadata(entity as Note);
    case 'session':
      return getSessionMetadata(entity as Session);
    case 'topic':
    case 'company':
    case 'contact': {
      const topicLike = entity as Topic | Company | Contact;
      return [
        <Badge key="noteCount" className="bg-gray-100 text-gray-600">
          {topicLike.noteCount} notes
        </Badge>,
      ];
    }
    default:
      return [];
  }
}

/**
 * AvailableEntityItem - Displays a single available entity with metadata and link button
 *
 * @example
 * ```tsx
 * <AvailableEntityItem
 *   entity={task}
 *   entityType="task"
 *   label={task.title}
 *   metadata="todo • high priority"
 *   onLink={() => handleLink(task.id)}
 *   selected={isSelected}
 *   onSelect={setIsSelected}
 * />
 * ```
 */
export const AvailableEntityItem = memo(function AvailableEntityItem({
  entity,
  entityType,
  label,
  onLink,
  selected,
  onSelect,
}: AvailableEntityItemProps) {
  // Handle checkbox toggle
  const handleCheckboxChange = useCallback(() => {
    onSelect(!selected);
  }, [selected, onSelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCheckboxChange();
      }
    },
    [handleCheckboxChange]
  );

  // Get metadata badges
  const metadataBadges = getEntityMetadataBadges(entity, entityType);

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors
        ${selected ? 'bg-blue-50 hover:bg-blue-100' : ''}
        border-b border-gray-100 last:border-b-0
      `}
      role="listitem"
    >
      {/* Checkbox */}
      <button
        onClick={handleCheckboxChange}
        onKeyDown={handleKeyDown}
        className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        aria-label={selected ? 'Deselect entity' : 'Select entity'}
        aria-checked={selected}
        role="checkbox"
        tabIndex={0}
      >
        {selected ? (
          <CheckSquare className="w-5 h-5 text-blue-600" />
        ) : (
          <Square className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Entity icon */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
        {getEntityIcon(entityType)}
      </div>

      {/* Entity info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{label}</p>

          {/* Entity type badge */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getEntityColor(entityType)}`}
          >
            {entityType}
          </span>
        </div>

        {/* Metadata badges */}
        {metadataBadges.length > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {metadataBadges}
          </div>
        )}
      </div>

      {/* Link button */}
      <Button
        variant="primary"
        size="sm"
        onClick={onLink}
        icon={<Link2 className="w-4 h-4" />}
        className="flex-shrink-0"
        aria-label={`Link to ${label}`}
      >
        Link
      </Button>
    </div>
  );
});

/**
 * Display name for React DevTools
 */
AvailableEntityItem.displayName = 'AvailableEntityItem';
