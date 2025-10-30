/**
 * RelationshipCardSection Component
 *
 * Section component that displays related entities as rich cards.
 * Replaces the old RelatedContentSection with new card-based UI.
 *
 * Features:
 * - Automatic entity type detection and card selection
 * - Grid layout with responsive columns
 * - Add button for creating new relationships
 * - Empty state with call-to-action
 * - Supports all three entity types: tasks, notes, sessions
 *
 * @module components/relationships/RelationshipCardSection
 * @since 2.0.0
 */

import React, { useMemo, useState, useRef, useCallback } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { EntityType, RelationshipType } from '@/types/relationships';
import { useRelationshipActions } from '@/hooks/useRelationshipActions';
import { TaskRelationshipCard } from './TaskRelationshipCard';
import { NoteRelationshipCard } from './NoteRelationshipCard';
import { SessionRelationshipCard } from './SessionRelationshipCard';
import { InlineRelationshipSearch } from './InlineRelationshipSearch';
import { useTasks } from '@/context/TasksContext';
import { useNotes } from '@/context/NotesContext';
import { useSessionList } from '@/context/SessionListContext';
import { useUI } from '@/context/UIContext';
import { useEntities } from '@/context/EntitiesContext';
import { getRadiusClass, TRANSITIONS } from '@/design-system/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface RelationshipCardSectionProps {
  /** ID of the source entity */
  entityId: string;

  /** Type of the source entity */
  entityType: EntityType;

  /** Section title */
  title: string;

  /** Relationship types to filter by */
  filterTypes: RelationshipType[];

  /** Maximum cards to show before "Show More" */
  maxVisible?: number;

  /** Display variant for cards */
  variant?: 'compact' | 'default' | 'expanded';

  /** Show action buttons on cards */
  showActions?: boolean;

  /** Show excerpts/descriptions in cards */
  showExcerpts?: boolean;

  /** Callback when add button is clicked */
  onAddClick?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const RelationshipCardSection: React.FC<RelationshipCardSectionProps> = ({
  entityId,
  entityType,
  title,
  filterTypes,
  maxVisible = 8,
  variant = 'default',
  showActions = true,
  showExcerpts = false,
  onAddClick,
}) => {
  // Contexts
  const { state: tasksState } = useTasks();
  const { state: notesState } = useNotes();
  const { sessions: allSessions } = useSessionList();
  const { dispatch: uiDispatch } = useUI();
  const { state: entitiesState } = useEntities();

  // Get relationship actions
  const { getLinks, unlink, linkTo } = useRelationshipActions(entityId, entityType);

  // State for inline search
  const [showInlineSearch, setShowInlineSearch] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Infer target entity type from filter types
  const targetEntityType = useMemo((): EntityType => {
    // Check for task relationships
    if (
      filterTypes.includes(RelationshipType.TASK_NOTE) ||
      filterTypes.includes(RelationshipType.TASK_SESSION)
    ) {
      // If source is task, target is note/session
      if (entityType === EntityType.TASK) {
        return filterTypes.includes(RelationshipType.TASK_NOTE)
          ? EntityType.NOTE
          : EntityType.SESSION;
      }
      // If source is note/session, target is task
      return EntityType.TASK;
    }

    // Check for note-session relationship
    if (filterTypes.includes(RelationshipType.NOTE_SESSION)) {
      return entityType === EntityType.NOTE ? EntityType.SESSION : EntityType.NOTE;
    }

    // Default to task (shouldn't happen)
    return EntityType.TASK;
  }, [filterTypes, entityType]);

  // Infer relationship type from source and target types
  const relationshipType = useMemo((): RelationshipType => {
    if (
      (entityType === EntityType.TASK && targetEntityType === EntityType.NOTE) ||
      (entityType === EntityType.NOTE && targetEntityType === EntityType.TASK)
    ) {
      return RelationshipType.TASK_NOTE;
    }

    if (
      (entityType === EntityType.TASK && targetEntityType === EntityType.SESSION) ||
      (entityType === EntityType.SESSION && targetEntityType === EntityType.TASK)
    ) {
      return RelationshipType.TASK_SESSION;
    }

    if (
      (entityType === EntityType.NOTE && targetEntityType === EntityType.SESSION) ||
      (entityType === EntityType.SESSION && targetEntityType === EntityType.NOTE)
    ) {
      return RelationshipType.NOTE_SESSION;
    }

    // Default (shouldn't happen)
    return RelationshipType.TASK_NOTE;
  }, [entityType, targetEntityType]);

  // Handle open inline search
  const handleOpenInlineSearch = useCallback((event?: React.MouseEvent<HTMLButtonElement>) => {
    // Use the clicked button's position, or fall back to the ref
    const targetElement = event?.currentTarget || addButtonRef.current;
    if (targetElement) {
      setTriggerRect(targetElement.getBoundingClientRect());
      setShowInlineSearch(true);
    }
  }, []);

  // Handle close inline search
  const handleCloseInlineSearch = useCallback(() => {
    setShowInlineSearch(false);
    setTriggerRect(null);
  }, []);

  // Handle add relationship from inline search
  const handleAddRelationship = useCallback(
    async (targetEntityId: string) => {
      await linkTo(targetEntityId, targetEntityType, relationshipType, {
        source: 'manual',
      });
    },
    [linkTo, targetEntityType, relationshipType]
  );

  // Filter relationships by type
  const relationships = useMemo(() => {
    const allLinks = getLinks();
    return allLinks.filter(link => filterTypes.includes(link.type));
  }, [getLinks, filterTypes]);

  // Show limited results
  const [showAll, setShowAll] = React.useState(false);
  const displayedRelationships = showAll
    ? relationships
    : relationships.slice(0, maxVisible);

  // Get entity type label for button
  const entityTypeLabel = useMemo(() => {
    if (targetEntityType === EntityType.TASK) return 'Task';
    if (targetEntityType === EntityType.NOTE) return 'Note';
    if (targetEntityType === EntityType.SESSION) return 'Session';
    return 'Item';
  }, [targetEntityType]);

  // Get existing relationship IDs for inline search
  const existingRelationshipIds = useMemo(() => {
    return relationships.map(rel =>
      rel.sourceId === entityId ? rel.targetId : rel.sourceId
    );
  }, [relationships, entityId]);

  // Handle view entity (opens sidebar)
  const handleView = (id: string) => {
    // Determine type from relationship
    const rel = relationships.find(r => r.sourceId === id || r.targetId === id);
    if (!rel) return;

    const targetId = rel.sourceId === entityId ? rel.targetId : rel.sourceId;
    const targetType = rel.sourceType === entityType ? rel.targetType : rel.sourceType;

    let sidebarType: 'task' | 'note' | 'settings' = 'task';
    let label = '';

    if (targetType === EntityType.TASK) {
      const task = tasksState.tasks.find(t => t.id === targetId);
      sidebarType = 'task';
      label = task?.title || 'Task';
    } else if (targetType === EntityType.NOTE) {
      const note = notesState.notes.find(n => n.id === targetId);
      sidebarType = 'note';
      label = note?.summary || 'Note';
    }
    // Session doesn't have a sidebar type, so we skip it

    if (sidebarType === 'task' || sidebarType === 'note') {
      uiDispatch({
        type: 'OPEN_SIDEBAR',
        payload: { type: sidebarType, itemId: targetId, label },
      });
    }
  };

  // Render empty state
  if (relationships.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {title}
          </h3>
          <div className="flex items-center gap-2">
            <button
              ref={addButtonRef}
              onClick={handleOpenInlineSearch}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium text-cyan-700 hover:text-cyan-800 ${getRadiusClass('pill')} hover:bg-cyan-100 ${TRANSITIONS.colors}`}
            >
              <Plus className="w-3 h-3" />
              Add {entityTypeLabel}
            </button>
            {onAddClick && (
              <button
                onClick={onAddClick}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 ${getRadiusClass('pill')} hover:bg-gray-100 ${TRANSITIONS.colors}`}
                title="Manage all relationships"
              >
                <Settings2 className="w-3 h-3" />
                Manage
              </button>
            )}
          </div>
        </div>
        <div
          className={`px-4 py-6 text-center ${getRadiusClass('card')} bg-white/40 backdrop-blur-sm border border-dashed border-gray-300`}
        >
          <p className="text-sm text-gray-500">
            No {title.toLowerCase()} yet.{' '}
            <button
              onClick={(e) => handleOpenInlineSearch(e)}
              className="text-cyan-600 hover:text-cyan-700 font-medium underline"
            >
              Add one
            </button>
          </p>
        </div>

        {/* Inline Search Dropdown */}
        {showInlineSearch && triggerRect && (
          <InlineRelationshipSearch
            sourceEntityId={entityId}
            sourceEntityType={entityType}
            targetEntityType={targetEntityType}
            relationshipType={relationshipType}
            existingRelationshipIds={existingRelationshipIds}
            triggerRect={triggerRect}
            onAddRelationship={handleAddRelationship}
            onClose={handleCloseInlineSearch}
            allowCreate={targetEntityType !== EntityType.SESSION}
            showRecent={true}
          />
        )}
      </div>
    );
  }

  // Render section with cards
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {title} ({relationships.length})
        </h3>
        <div className="flex items-center gap-2">
          {relationships.length > maxVisible && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-gray-600 hover:text-gray-800 font-medium"
            >
              {showAll ? 'Show Less' : `Show All (${relationships.length})`}
            </button>
          )}
          <button
            ref={addButtonRef}
            onClick={handleOpenInlineSearch}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium text-cyan-700 hover:text-cyan-800 ${getRadiusClass('pill')} hover:bg-cyan-100 ${TRANSITIONS.colors}`}
          >
            <Plus className="w-3 h-3" />
            Add {entityTypeLabel}
          </button>
          {onAddClick && (
            <button
              onClick={onAddClick}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 ${getRadiusClass('pill')} hover:bg-gray-100 ${TRANSITIONS.colors}`}
              title="Manage all relationships"
            >
              <Settings2 className="w-3 h-3" />
              Manage
            </button>
          )}
        </div>
      </div>

      {/* Cards Grid */}
      <AnimatePresence mode="sync">
        <motion.div
          layout
          className={`grid gap-3 ${
            variant === 'compact'
              ? 'grid-cols-1'
              : 'grid-cols-1 md:grid-cols-2'
          }`}
        >
          {displayedRelationships.map(relationship => {
            const relatedId = relationship.sourceId === entityId
              ? relationship.targetId
              : relationship.sourceId;

            // Determine related entity type (what the relatedId points to)
            const relatedEntityType = relationship.sourceId === entityId
              ? relationship.targetType
              : relationship.sourceType;

            // Render Task Card
            if (relatedEntityType === EntityType.TASK) {
              const task = tasksState.tasks.find(t => t.id === relatedId);
              if (!task) return null;

              return (
                <TaskRelationshipCard
                  key={relationship.id}
                  relationship={relationship}
                  task={task}
                  variant={variant}
                  onView={handleView}
                  onEdit={handleView}
                  onRemove={() => unlink(relationship.id)}
                  showActions={showActions}
                  showExcerpt={showExcerpts}
                />
              );
            }

            // Render Note Card
            if (relatedEntityType === EntityType.NOTE) {
              const note = notesState.notes.find(n => n.id === relatedId);
              if (!note) return null;

              // Get linked companies and contacts
              const companies = (note.companyIds || [])
                .map(id => entitiesState.companies.find(c => c.id === id))
                .filter(Boolean)
                .map(c => ({ id: c!.id, name: c!.name }));

              const contacts = (note.contactIds || [])
                .map(id => entitiesState.contacts.find(c => c.id === id))
                .filter(Boolean)
                .map(c => ({ id: c!.id, name: c!.name }));

              return (
                <NoteRelationshipCard
                  key={relationship.id}
                  relationship={relationship}
                  note={note}
                  variant={variant}
                  onView={handleView}
                  onEdit={handleView}
                  onRemove={() => unlink(relationship.id)}
                  showActions={showActions}
                  showExcerpt={showExcerpts}
                  showKeyPoints={variant === 'expanded'}
                  showEntities={true}
                  companies={companies}
                  contacts={contacts}
                />
              );
            }

            // Render Session Card
            if (relatedEntityType === EntityType.SESSION) {
              const session = allSessions.find(s => s.id === relatedId);
              if (!session) return null;

              return (
                <SessionRelationshipCard
                  key={relationship.id}
                  relationship={relationship}
                  session={session}
                  variant={variant}
                  onView={handleView}
                  onRemove={() => unlink(relationship.id)}
                  showActions={showActions}
                  showActivities={variant === 'expanded'}
                  showExcerpt={showExcerpts}
                />
              );
            }

            return null;
          })}
        </motion.div>
      </AnimatePresence>

      {/* Inline Search Dropdown */}
      {showInlineSearch && triggerRect && (
        <InlineRelationshipSearch
          sourceEntityId={entityId}
          sourceEntityType={entityType}
          targetEntityType={targetEntityType}
          relationshipType={relationshipType}
          existingRelationshipIds={existingRelationshipIds}
          triggerRect={triggerRect}
          onAddRelationship={handleAddRelationship}
          onClose={handleCloseInlineSearch}
          allowCreate={targetEntityType !== EntityType.SESSION}
          showRecent={true}
        />
      )}
    </div>
  );
};

RelationshipCardSection.displayName = 'RelationshipCardSection';
