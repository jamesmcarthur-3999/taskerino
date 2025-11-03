/**
 * InlineRelationshipSearch Component
 *
 * Portal-based dropdown search for adding relationships to a specific entity type.
 * Follows the pattern established by CompanyPillManager, ContactPillManager, TopicPillManager.
 *
 * Features:
 * - Portal rendering to escape stacking contexts
 * - Fixed positioning from trigger button
 * - Search/filter by entity name
 * - Entity-specific metadata display (status, priority, etc.)
 * - "Create new" option for Tasks and Notes
 * - Keyboard navigation (Escape, Enter)
 * - Outside click detection
 *
 * @module components/relationships/InlineRelationshipSearch
 * @since 2.0.0
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Search,
  CheckCircle2,
  Circle,
  Flag,
  Calendar,
  Building2,
  User,
  FileText,
  PlayCircle,
  Clock,
  Camera,
  Sparkles,
} from 'lucide-react';
import { EntityType, RelationshipType } from '@/types/relationships';
import type { Task, Note, Session } from '@/types';
import { useTasks } from '@/context/TasksContext';
import { useNotes } from '@/context/NotesContext';
import { useSessionList } from '@/context/SessionListContext';
import { useEntities } from '@/context/EntitiesContext';
import { getRadiusClass, TRANSITIONS, PRIORITY_COLORS, STATUS_COLORS } from '@/design-system/theme';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format duration from milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 1000 / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format date to short string (e.g., "Jan 15" or "Today")
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// TYPES
// ============================================================================

export interface InlineRelationshipSearchProps {
  /** Source entity (what we're adding relationships TO) */
  sourceEntityId: string;
  sourceEntityType: EntityType;

  /** Target entity type (what we're searching FOR) */
  targetEntityType: EntityType;

  /** Relationship type to create */
  relationshipType: RelationshipType;

  /** IDs of already linked entities (to exclude from search) */
  existingRelationshipIds: string[];

  /** Trigger button rect for positioning */
  triggerRect: DOMRect;

  /** Callback when relationship is created */
  onAddRelationship: (targetEntityId: string) => Promise<void>;

  /** Callback when dropdown closes */
  onClose: () => void;

  /** Allow creating new entities (not applicable for Sessions) */
  allowCreate?: boolean;

  /** Show recent items at top */
  showRecent?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const InlineRelationshipSearch: React.FC<InlineRelationshipSearchProps> = ({
  sourceEntityId,
  sourceEntityType,
  targetEntityType,
  relationshipType,
  existingRelationshipIds,
  triggerRect,
  onAddRelationship,
  onClose,
  allowCreate = true,
  showRecent = true,
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCreatingRef = useRef(false); // Ref to prevent race conditions

  // Contexts
  const { state: tasksState, dispatch: tasksDispatch } = useTasks();
  const { state: notesState, dispatch: notesDispatch } = useNotes();
  const { sessions: allSessions } = useSessionList();
  const { state: entitiesState } = useEntities();

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Get all entities of target type
  const allEntities = useMemo(() => {
    if (targetEntityType === EntityType.TASK) {
      return tasksState.tasks;
    }
    if (targetEntityType === EntityType.NOTE) {
      return notesState.notes;
    }
    if (targetEntityType === EntityType.SESSION) {
      return allSessions;
    }
    return [];
  }, [targetEntityType, tasksState.tasks, notesState.notes, allSessions]);

  // Filter out already linked entities
  const availableEntities = useMemo(() => {
    return allEntities.filter(entity => !existingRelationshipIds.includes(entity.id));
  }, [allEntities, existingRelationshipIds]);

  // Filter entities by search query
  const filteredEntities = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) return availableEntities;

    return availableEntities.filter(entity => {
      // Tasks: Match title or description
      if (targetEntityType === EntityType.TASK) {
        const task = entity as Task;
        return (
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query)
        );
      }

      // Notes: Match summary or content
      if (targetEntityType === EntityType.NOTE) {
        const note = entity as Note;
        return (
          note.summary.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query)
        );
      }

      // Sessions: Match name or summary
      if (targetEntityType === EntityType.SESSION) {
        const session = entity as Session;
        return (
          session.name.toLowerCase().includes(query) ||
          session.summary?.narrative?.toLowerCase().includes(query)
        );
      }

      return false;
    });
  }, [searchQuery, availableEntities, targetEntityType]);

  // Recent entities (last 5, sorted by date)
  const recentEntities = useMemo(() => {
    if (!showRecent) return [];

    const sorted = [...availableEntities].sort((a, b) => {
      // Get the most recent date for each entity type
      let dateA: number;
      let dateB: number;

      // Handle different entity types with different date properties
      if ('lastUpdated' in a) {
        // Note has lastUpdated and timestamp
        dateA = new Date((a as Note).lastUpdated).getTime();
      } else if ('completedAt' in a && a.completedAt) {
        // Task has completedAt or createdAt
        dateA = new Date(a.completedAt).getTime();
      } else if ('createdAt' in a) {
        dateA = new Date((a as Task).createdAt).getTime();
      } else if ('endTime' in a && a.endTime) {
        // Session has endTime or startTime
        dateA = new Date(a.endTime).getTime();
      } else if ('startTime' in a) {
        dateA = new Date((a as Session).startTime).getTime();
      } else {
        dateA = 0;
      }

      if ('lastUpdated' in b) {
        dateB = new Date((b as Note).lastUpdated).getTime();
      } else if ('completedAt' in b && b.completedAt) {
        dateB = new Date(b.completedAt).getTime();
      } else if ('createdAt' in b) {
        dateB = new Date((b as Task).createdAt).getTime();
      } else if ('endTime' in b && b.endTime) {
        dateB = new Date(b.endTime).getTime();
      } else if ('startTime' in b) {
        dateB = new Date((b as Session).startTime).getTime();
      } else {
        dateB = 0;
      }

      return dateB - dateA;
    });

    return sorted.slice(0, 5);
  }, [availableEntities, showRecent]);

  // Check if search query matches an existing entity (for create prompt)
  const exactMatch = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return false;

    return allEntities.some(entity => {
      if (targetEntityType === EntityType.TASK) {
        return (entity as Task).title.toLowerCase() === query;
      }
      if (targetEntityType === EntityType.NOTE) {
        return (entity as Note).summary.toLowerCase() === query;
      }
      if (targetEntityType === EntityType.SESSION) {
        return (entity as Session).name.toLowerCase() === query;
      }
      return false;
    });
  }, [searchQuery, allEntities, targetEntityType]);

  const showCreatePrompt =
    allowCreate &&
    searchQuery.trim().length > 0 &&
    !exactMatch &&
    targetEntityType !== EntityType.SESSION;

  // Handle entity selection
  const handleSelectEntity = useCallback(
    async (entityId: string) => {
      if (isAdding) return;

      setIsAdding(true);
      try {
        await onAddRelationship(entityId);
        onClose();
      } catch (error) {
        console.error('Failed to add relationship:', error);
        // Could show toast notification here
      } finally {
        setIsAdding(false);
      }
    },
    [isAdding, onAddRelationship, onClose]
  );

  // Handle create new entity
  const handleCreateEntity = useCallback(async () => {
    // Guard against duplicate calls using ref
    if (!allowCreate || !searchQuery.trim() || isCreatingRef.current) return;

    isCreatingRef.current = true;
    setIsCreating(true);

    // Close dropdown immediately to prevent double-clicks
    const query = searchQuery.trim();
    setSearchQuery('');
    onClose();

    try {
      let newEntityId: string | undefined;

      // Create Task
      if (targetEntityType === EntityType.TASK) {
        const newTask: Partial<Task> = {
          title: query,
          done: false,
          priority: 'medium',
        };

        // Dispatch returns the action, but we need to wait for state update
        tasksDispatch({ type: 'ADD_TASK', payload: newTask as Task });

        // Wait a bit longer for state update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get the newly created task (should be last in array)
        const tasks = tasksState.tasks;
        const newTask_ = tasks.find(t => t.title === newTask.title && !t.done);
        newEntityId = newTask_?.id;
      }

      // Create Note
      if (targetEntityType === EntityType.NOTE) {
        const newNote: Partial<Note> = {
          content: query,
          summary: query,
        };

        notesDispatch({ type: 'ADD_NOTE', payload: newNote as Note });

        // Wait a bit longer for state update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get the newly created note
        const notes = notesState.notes;
        const newNote_ = notes.find(n => n.summary === newNote.summary);
        newEntityId = newNote_?.id;
      }

      if (newEntityId) {
        await onAddRelationship(newEntityId);
      }
    } catch (error) {
      console.error('Failed to create entity:', error);
    } finally {
      isCreatingRef.current = false;
      setIsCreating(false);
    }
  }, [
    allowCreate,
    searchQuery,
    targetEntityType,
    tasksDispatch,
    notesDispatch,
    tasksState.tasks,
    notesState.notes,
    onAddRelationship,
    onClose,
  ]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && showCreatePrompt && !isCreatingRef.current) {
        e.preventDefault();
        handleCreateEntity();
      }
    },
    [showCreatePrompt, handleCreateEntity, onClose]
  );

  // Render entity item (type-specific)
  const renderEntityItem = useCallback(
    (entity: Task | Note | Session) => {
      // Render Task
      if (targetEntityType === EntityType.TASK) {
        const task = entity as Task;
        return (
          <button
            key={task.id}
            onClick={() => handleSelectEntity(task.id)}
            disabled={isAdding}
            className={`
              w-full flex items-start gap-3 px-3 py-2.5 text-left
              hover:bg-cyan-50 ${TRANSITIONS.fast}
              ${isAdding ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {/* Status Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {task.done ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <Circle className="w-4 h-4 text-gray-400" />
              )}
            </div>

            {/* Task Info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 truncate">
                {task.title}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs">
                {/* Status */}
                <span
                  className={`px-2 py-0.5 ${getRadiusClass('pill')} ${
                    STATUS_COLORS[task.status]?.bg || 'bg-gray-100'
                  } ${STATUS_COLORS[task.status]?.text || 'text-gray-700'}`}
                >
                  {task.status}
                </span>

                {/* Priority */}
                {task.priority !== 'low' && (
                  <div className="flex items-center gap-1">
                    <Flag
                      className={`w-3 h-3 ${
                        PRIORITY_COLORS[
                          task.priority === 'urgent'
                            ? 'critical'
                            : task.priority === 'high'
                            ? 'important'
                            : task.priority === 'medium'
                            ? 'normal'
                            : 'low'
                        ]?.text || 'text-gray-500'
                      }`}
                    />
                  </div>
                )}

                {/* Due Date */}
                {task.dueDate && (
                  <div className="flex items-center gap-1 text-gray-500">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(task.dueDate)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Add Icon */}
            <Plus className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
          </button>
        );
      }

      // Render Note
      if (targetEntityType === EntityType.NOTE) {
        const note = entity as Note;

        // Get linked companies and contacts from relationships
        const companyIds = note.relationships
          .filter(r => r.targetType === EntityType.COMPANY)
          .map(r => r.targetId);
        const companies = companyIds
          .map((id: string) => entitiesState.companies.find(c => c.id === id))
          .filter(Boolean)
          .slice(0, 2);

        const contactIds = note.relationships
          .filter(r => r.targetType === EntityType.CONTACT)
          .map(r => r.targetId);
        const contacts = contactIds
          .map((id: string) => entitiesState.contacts.find(c => c.id === id))
          .filter(Boolean)
          .slice(0, 2);

        return (
          <button
            key={note.id}
            onClick={() => handleSelectEntity(note.id)}
            disabled={isAdding}
            className={`
              w-full flex items-start gap-3 px-3 py-2.5 text-left
              hover:bg-cyan-50 ${TRANSITIONS.fast}
              ${isAdding ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {/* Note Icon */}
            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />

            {/* Note Info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 truncate">
                {note.summary}
              </div>

              {/* Entities */}
              {(companies.length > 0 || contacts.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {companies.map(company => (
                    <span
                      key={company!.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"
                    >
                      <Building2 className="w-3 h-3" />
                      {company!.name}
                    </span>
                  ))}
                  {contacts.map(contact => (
                    <span
                      key={contact!.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full"
                    >
                      <User className="w-3 h-3" />
                      {contact!.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Preview */}
              {note.content && (
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {note.content.substring(0, 100)}
                  {note.content.length > 100 ? '...' : ''}
                </div>
              )}
            </div>

            {/* Add Icon */}
            <Plus className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
          </button>
        );
      }

      // Render Session
      if (targetEntityType === EntityType.SESSION) {
        const session = entity as Session;
        const duration = session.endTime
          ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
          : Date.now() - new Date(session.startTime).getTime();

        return (
          <button
            key={session.id}
            onClick={() => handleSelectEntity(session.id)}
            disabled={isAdding}
            className={`
              w-full flex items-start gap-3 px-3 py-2.5 text-left
              hover:bg-cyan-50 ${TRANSITIONS.fast}
              ${isAdding ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {/* Session Icon */}
            <PlayCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />

            {/* Session Info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 truncate">
                {session.name}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                {/* Duration */}
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDuration(duration)}</span>
                </div>

                {/* Screenshots */}
                {session.screenshots && session.screenshots.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Camera className="w-3 h-3" />
                    <span>{session.screenshots.length}</span>
                  </div>
                )}

                {/* AI Summary */}
                {session.summary && (
                  <div className="flex items-center gap-1 text-cyan-600">
                    <Sparkles className="w-3 h-3" />
                  </div>
                )}
              </div>
            </div>

            {/* Add Icon */}
            <Plus className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
          </button>
        );
      }

      return null;
    },
    [targetEntityType, entitiesState, handleSelectEntity, isAdding]
  );

  // Calculate dropdown position with viewport collision detection
  const dropdownStyle: React.CSSProperties = useMemo(() => {
    const DROPDOWN_MIN_WIDTH = Math.max(triggerRect.width, 320);
    const DROPDOWN_MAX_WIDTH = 480;
    const DROPDOWN_MAX_HEIGHT = 384; // max-h-96 = 24rem = 384px
    const SPACING = 4; // Gap between trigger and dropdown

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate dropdown width (use max width if there's space, otherwise use min width)
    const dropdownWidth = Math.min(DROPDOWN_MAX_WIDTH, DROPDOWN_MIN_WIDTH);

    // Horizontal positioning: Check if dropdown would overflow right edge
    let left = triggerRect.left;
    let right: number | undefined;

    const wouldOverflowRight = triggerRect.left + dropdownWidth > viewportWidth - 20;

    if (wouldOverflowRight) {
      // Align to right edge of trigger
      right = viewportWidth - triggerRect.right;
      left = undefined as any; // TypeScript hack - will be removed by spreading
    }

    // Vertical positioning: Check if dropdown would overflow bottom edge
    let top = triggerRect.bottom + SPACING;
    let bottom: number | undefined;

    const wouldOverflowBottom = triggerRect.bottom + SPACING + DROPDOWN_MAX_HEIGHT > viewportHeight - 20;

    if (wouldOverflowBottom) {
      // Position above trigger
      bottom = viewportHeight - triggerRect.top + SPACING;
      top = undefined as any; // TypeScript hack - will be removed by spreading
    }

    const style: React.CSSProperties = {
      position: 'fixed',
      minWidth: `${DROPDOWN_MIN_WIDTH}px`,
      maxWidth: `${DROPDOWN_MAX_WIDTH}px`,
      zIndex: 9999,
    };

    // Add positioning properties (only one of top/bottom and left/right)
    if (top !== undefined) {
      style.top = `${top}px`;
    }
    if (bottom !== undefined) {
      style.bottom = `${bottom}px`;
    }
    if (left !== undefined) {
      style.left = `${left}px`;
    }
    if (right !== undefined) {
      style.right = `${right}px`;
    }

    return style;
  }, [triggerRect]);

  // Get entity type label
  const entityLabel = useMemo(() => {
    if (targetEntityType === EntityType.TASK) return 'tasks';
    if (targetEntityType === EntityType.NOTE) return 'notes';
    if (targetEntityType === EntityType.SESSION) return 'sessions';
    return 'items';
  }, [targetEntityType]);

  // Render dropdown content
  return createPortal(
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className={`
        max-h-96 overflow-y-auto
        bg-white border border-gray-200 shadow-xl ${getRadiusClass('field')}
      `}
      role="listbox"
      aria-label={`Select ${entityLabel}`}
    >
      {/* Search Input */}
      <div className="sticky top-0 bg-white p-2 border-b border-gray-100 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Search ${entityLabel}...`}
            className={`
              w-full pl-9 pr-3 py-2 text-sm border border-gray-200 ${getRadiusClass('element')}
              focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400
            `}
            aria-label={`Search ${entityLabel}`}
          />
        </div>
      </div>

      {/* Create New Prompt */}
      {showCreatePrompt && (
        <div className="p-2 border-b border-gray-100 bg-cyan-50/50">
          <button
            onClick={(e) => {
              e.preventDefault();
              handleCreateEntity();
            }}
            disabled={isCreating}
            className={`
              w-full flex items-center gap-2 px-3 py-2 text-left text-sm
              bg-gradient-to-r from-cyan-500 to-blue-500 text-white
              ${getRadiusClass('element')}
              hover:from-cyan-600 hover:to-blue-600
              disabled:opacity-50 disabled:cursor-not-allowed
              ${TRANSITIONS.fast}
            `}
            aria-label={`Create new ${entityLabel.slice(0, -1)}: ${searchQuery}`}
          >
            <Plus size={14} />
            <span>
              {isCreating ? 'Creating...' : `Create "${searchQuery}"`}
            </span>
          </button>
        </div>
      )}

      {/* Recent Section */}
      {!searchQuery && showRecent && recentEntities.length > 0 && (
        <div className="py-2">
          <div className="px-3 py-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Recent
          </div>
          {recentEntities.map(renderEntityItem)}
        </div>
      )}

      {/* All Entities Section */}
      <div className="py-1">
        {!searchQuery && showRecent && (
          <div className="px-3 py-1 text-xs font-semibold text-gray-600 uppercase tracking-wide border-t border-gray-100 mt-1">
            All {entityLabel} ({filteredEntities.length})
          </div>
        )}

        {/* Entity List */}
        {filteredEntities.length === 0 && !showCreatePrompt ? (
          <div className="px-3 py-4 text-center text-sm text-gray-500">
            {searchQuery
              ? `No ${entityLabel} found`
              : `No available ${entityLabel}`}
          </div>
        ) : (
          filteredEntities.map(renderEntityItem)
        )}
      </div>
    </div>,
    document.body
  );
};

InlineRelationshipSearch.displayName = 'InlineRelationshipSearch';
