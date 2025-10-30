/**
 * RelationshipListItem - Component to display a single relationship in the "Current Relationships" list
 *
 * Features:
 * - Checkbox for bulk selection
 * - Entity icon and label
 * - Relationship type badge
 * - AI metadata (confidence, reasoning) on hover if AI-generated
 * - Created date
 * - Unlink button
 * - Keyboard accessible
 * - Screen reader friendly
 * - Memoized for performance
 *
 * @module components/relationships/RelationshipListItem
 * @since 2.0.0
 */

import React, { memo, useState, useCallback, useEffect } from 'react';
import type { Relationship, EntityType } from '@/types/relationships';
import { RELATIONSHIP_CONFIGS } from '@/types/relationships';
import type { Task, Note, Session, Topic, Company, Contact } from '@/types';
import { getStorage } from '@/services/storage';
import { Unlink, CheckSquare, Square, Sparkles, Info } from 'lucide-react';
import { Button } from '@/components/Button';
import { formatDistanceToNow } from 'date-fns';

/**
 * Props for RelationshipListItem component
 */
export interface RelationshipListItemProps {
  /** Relationship to display */
  relationship: Relationship;
  /** ID of the entity viewing this relationship (to determine target) */
  entityId: string;
  /** Callback when unlink button is clicked */
  onUnlink: () => void;
  /** Is this item selected for bulk operations? */
  selected: boolean;
  /** Callback when selection changes */
  onSelect: (selected: boolean) => void;
}

/**
 * Entity union type
 */
type AnyEntity = Task | Note | Session | Topic | Company | Contact;

/**
 * Get display label for an entity
 */
function getEntityLabel(entity: AnyEntity | null, type: EntityType): string {
  if (!entity) return 'Unknown';

  switch (type) {
    case 'task':
      return (entity as Task).title;
    case 'note':
      return (entity as Note).summary || (entity as Note).content.substring(0, 100);
    case 'session':
      return (entity as Session).name;
    case 'topic':
    case 'company':
    case 'contact':
      return (entity as Topic | Company | Contact).name;
    default:
      return 'Unknown';
  }
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
 * RelationshipListItem - Displays a single relationship with metadata and actions
 *
 * @example
 * ```tsx
 * <RelationshipListItem
 *   relationship={relationship}
 *   entityId={taskId}
 *   onUnlink={() => handleUnlink(relationship.id)}
 *   selected={isSelected}
 *   onSelect={setIsSelected}
 * />
 * ```
 */
export const RelationshipListItem = memo(function RelationshipListItem({
  relationship,
  entityId,
  onUnlink,
  selected,
  onSelect,
}: RelationshipListItemProps) {
  // State for loading target entity
  const [targetEntity, setTargetEntity] = useState<AnyEntity | null>(null);
  const [isLoadingEntity, setIsLoadingEntity] = useState(false);
  const [showAIMetadata, setShowAIMetadata] = useState(false);

  // Determine which entity is the target (the one we're showing)
  const isSource = relationship.sourceId === entityId;
  const targetId = isSource ? relationship.targetId : relationship.sourceId;
  const targetType = isSource ? relationship.targetType : relationship.sourceType;

  // Get relationship config
  const config = RELATIONSHIP_CONFIGS[relationship.type];

  // Load target entity
  useEffect(() => {
    async function loadTargetEntity() {
      setIsLoadingEntity(true);
      try {
        const storage = await getStorage();

        // Determine collection name
        const collectionMap: Record<EntityType, string> = {
          task: 'tasks',
          note: 'notes',
          session: 'sessions',
          topic: 'topics',
          company: 'companies',
          contact: 'contacts',
          file: 'files',
          project: 'projects',
          goal: 'goals',
        };

        const collectionName = collectionMap[targetType];
        if (!collectionName) {
          console.warn(`[RelationshipListItem] Unknown entity type: ${targetType}`);
          return;
        }

        const entities = await storage.load<AnyEntity[]>(collectionName);
        const entity = (entities || []).find((e: AnyEntity) => e.id === targetId);

        setTargetEntity(entity || null);
      } catch (err) {
        console.error('[RelationshipListItem] Failed to load target entity:', err);
      } finally {
        setIsLoadingEntity(false);
      }
    }

    loadTargetEntity();
  }, [targetId, targetType]);

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

  // Format created date
  const createdDate = relationship.metadata.createdAt
    ? formatDistanceToNow(new Date(relationship.metadata.createdAt), { addSuffix: true })
    : 'Unknown';

  // Check if AI-generated
  const isAIGenerated = relationship.metadata.source === 'ai';
  const hasAIMetadata = isAIGenerated && (relationship.metadata.confidence !== undefined || relationship.metadata.reasoning);

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
        aria-label={selected ? 'Deselect relationship' : 'Select relationship'}
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
        {getEntityIcon(targetType)}
      </div>

      {/* Entity info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {isLoadingEntity ? (
              <span className="text-gray-400">Loading...</span>
            ) : (
              getEntityLabel(targetEntity, targetType)
            )}
          </p>

          {/* Relationship type badge */}
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
            style={{ backgroundColor: config.color ? `${config.color}20` : undefined }}
          >
            {config.displayName}
          </span>

          {/* AI indicator */}
          {isAIGenerated && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowAIMetadata(true)}
                onMouseLeave={() => setShowAIMetadata(false)}
                className="text-purple-600 hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
                aria-label="AI-generated relationship - hover for details"
              >
                <Sparkles className="w-4 h-4" />
              </button>

              {/* AI metadata tooltip */}
              {showAIMetadata && hasAIMetadata && (
                <div
                  className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10"
                  role="tooltip"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1">AI-Generated Relationship</p>
                      {relationship.metadata.confidence !== undefined && (
                        <p className="text-gray-300">
                          Confidence: {Math.round(relationship.metadata.confidence * 100)}%
                        </p>
                      )}
                      {relationship.metadata.reasoning && (
                        <p className="text-gray-300 mt-1">{relationship.metadata.reasoning}</p>
                      )}
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Created date */}
        <p className="text-xs text-gray-500 mt-0.5">Created {createdDate}</p>
      </div>

      {/* Unlink button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onUnlink}
        icon={<Unlink className="w-4 h-4" />}
        className="flex-shrink-0"
        aria-label={`Unlink ${getEntityLabel(targetEntity, targetType)}`}
      >
        Unlink
      </Button>
    </div>
  );
});

/**
 * Display name for React DevTools
 */
RelationshipListItem.displayName = 'RelationshipListItem';
