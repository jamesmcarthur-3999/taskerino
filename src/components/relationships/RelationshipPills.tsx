/**
 * RelationshipPills Component
 *
 * Displays entity relationships as compact, colored pills with icons, entity labels,
 * AI confidence indicators, and optional remove buttons.
 *
 * Features:
 * - Fetches and displays entity labels asynchronously (not just IDs)
 * - Displays pills with colors and icons from RELATIONSHIP_CONFIGS
 * - Shows AI confidence indicator (sparkle emoji) for low-confidence relationships
 * - Supports maxVisible prop with "+X more" overflow button
 * - Keyboard accessible with proper ARIA labels
 * - Performance optimized with React.memo and batched entity fetching
 * - Responsive design with flex-wrap
 *
 * @module components/relationships/RelationshipPills
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  type Relationship,
  type RelationshipType,
  type EntityType,
  RELATIONSHIP_CONFIGS,
  EntityType as EntityTypeEnum,
} from '@/types/relationships';
import { useRelationships } from '@/context/RelationshipContext';
import { getStorage } from '@/services/storage';
import { X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { RADIUS, TRANSITIONS } from '@/design-system/theme';

/**
 * Props for RelationshipPills component
 */
export interface RelationshipPillsProps {
  /** Entity ID to fetch relationships for */
  entityId: string;
  /** Entity type (for fetching relationships) */
  entityType: EntityType;
  /** Maximum number of pills to show (default: 5) */
  maxVisible?: number;
  /** Click handler when a pill is clicked */
  onPillClick?: (relationship: Relationship) => void;
  /** Remove handler when remove button is clicked */
  onRemove?: (relationship: Relationship) => void;
  /** Show remove button on pills */
  showRemoveButton?: boolean;
  /** Filter to show only certain relationship types */
  filterTypes?: RelationshipType[];
  /** Custom className */
  className?: string;
}

/**
 * Props for individual RelationshipPill component
 */
interface RelationshipPillProps {
  /** The relationship to display */
  relationship: Relationship;
  /** Entity label to display */
  label: string;
  /** Is the label still loading? */
  isLoading: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Remove handler */
  onRemove?: () => void;
}

/**
 * Entity label cache to avoid redundant fetches
 */
const entityLabelCache = new Map<string, string>();

/**
 * Get the collection name for an entity type
 */
function getCollectionName(entityType: EntityType): string {
  switch (entityType) {
    case EntityTypeEnum.TASK:
      return 'tasks';
    case EntityTypeEnum.NOTE:
      return 'notes';
    case EntityTypeEnum.SESSION:
      return 'sessions';
    case EntityTypeEnum.TOPIC:
      return 'topics';
    case EntityTypeEnum.COMPANY:
      return 'companies';
    case EntityTypeEnum.CONTACT:
      return 'contacts';
    case EntityTypeEnum.FILE:
      return 'files';
    case EntityTypeEnum.PROJECT:
      return 'projects';
    case EntityTypeEnum.GOAL:
      return 'goals';
    default:
      return 'unknown';
  }
}

/**
 * Extract display label from an entity
 */
function getEntityLabel(entity: any, entityType: EntityType): string {
  if (!entity) {
    return 'Unknown';
  }

  switch (entityType) {
    case EntityTypeEnum.TASK:
      return entity.title || 'Untitled Task';
    case EntityTypeEnum.NOTE:
      return entity.summary || entity.title || 'Untitled Note';
    case EntityTypeEnum.SESSION:
      return entity.name || 'Unnamed Session';
    case EntityTypeEnum.TOPIC:
      return entity.name || 'Unnamed Topic';
    case EntityTypeEnum.COMPANY:
      return entity.name || 'Unnamed Company';
    case EntityTypeEnum.CONTACT:
      return entity.name || 'Unnamed Contact';
    case EntityTypeEnum.FILE:
      return entity.name || 'Unnamed File';
    case EntityTypeEnum.PROJECT:
      return entity.name || 'Unnamed Project';
    case EntityTypeEnum.GOAL:
      return entity.title || entity.name || 'Unnamed Goal';
    default:
      return 'Unknown';
  }
}

/**
 * Load entity label from storage
 */
async function loadEntityLabel(entityType: EntityType, entityId: string): Promise<string> {
  const cacheKey = `${entityType}:${entityId}`;

  // Check cache first
  if (entityLabelCache.has(cacheKey)) {
    return entityLabelCache.get(cacheKey)!;
  }

  try {
    const storage = await getStorage();
    const collectionName = getCollectionName(entityType);

    // Load the entire collection (array of entities)
    const entities = await storage.load(collectionName);

    // Find the specific entity by ID
    const entity = Array.isArray(entities)
      ? entities.find((e: any) => e.id === entityId)
      : null;

    const label = getEntityLabel(entity, entityType);

    // Cache the result
    entityLabelCache.set(cacheKey, label);

    return label;
  } catch (error) {
    console.error(`[RelationshipPills] Failed to load entity label for ${entityType}:${entityId}:`, error);
    return 'Unknown';
  }
}

/**
 * Get Lucide icon component by name
 */
function getLucideIcon(iconName?: string): React.ComponentType<{ size?: number; className?: string }> | null {
  if (!iconName) {
    return null;
  }

  // @ts-ignore - Dynamic icon lookup
  const IconComponent = LucideIcons[iconName];
  return IconComponent || null;
}

/**
 * Individual relationship pill component
 */
const RelationshipPill = React.memo<RelationshipPillProps>(function RelationshipPill({
  relationship,
  label,
  isLoading,
  onClick,
  onRemove,
}) {
  const config = RELATIONSHIP_CONFIGS[relationship.type];
  const IconComponent = getLucideIcon(config.icon);

  // Determine if this is an AI-generated relationship with low confidence
  const isLowConfidenceAI =
    relationship.metadata.source === 'ai' &&
    (relationship.metadata.confidence ?? 1) < 0.8;

  // Determine target entity for proper labeling
  const isSource = relationship.canonical;
  const displayLabel = isLoading ? 'Loading...' : label;

  // Accessibility label
  const ariaLabel = `${config.displayName}: ${displayLabel}${
    isLowConfidenceAI ? ' (AI suggested)' : ''
  }${onClick ? ', click to view' : ''}${onRemove ? ', click X to remove' : ''}`;

  return (
    <div
      role="button"
      tabIndex={onClick ? 0 : -1}
      aria-label={ariaLabel}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
        cursor-${onClick ? 'pointer' : 'default'}
        ${TRANSITIONS.fast}
        ${onClick ? 'hover:opacity-80 focus:ring-2 focus:ring-offset-1' : ''}
        focus:outline-none
        border-2
      `}
      style={{
        backgroundColor: `${config.color}30`,
        color: config.color,
        borderColor: `${config.color}40`,
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Icon */}
      {IconComponent && (
        <IconComponent size={14} className="flex-shrink-0" aria-hidden="true" />
      )}

      {/* Label */}
      <span className="truncate max-w-[120px]" title={displayLabel}>
        {displayLabel}
      </span>

      {/* AI confidence indicator */}
      {isLowConfidenceAI && (
        <span
          className="opacity-60 flex-shrink-0"
          title={`AI suggested (${Math.round((relationship.metadata.confidence ?? 0) * 100)}% confidence)`}
          aria-label="AI suggested with low confidence"
        >
          ✨
        </span>
      )}

      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          className="
            hover:bg-black/10 rounded-full p-0.5 ml-0.5
            transition-colors flex-shrink-0
            focus:outline-none focus:ring-1 focus:ring-current
          "
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
          aria-label={`Remove relationship to ${displayLabel}`}
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

/**
 * Main RelationshipPills component
 *
 * Fetches relationships for an entity and displays them as colored pills.
 */
export const RelationshipPills = React.memo<RelationshipPillsProps>(function RelationshipPills({
  entityId,
  entityType,
  maxVisible = 5,
  onPillClick,
  onRemove,
  showRemoveButton = false,
  filterTypes,
  className = '',
}) {
  const { getRelationships } = useRelationships();
  const [entityLabels, setEntityLabels] = useState<Map<string, string>>(new Map());
  const [loadingLabels, setLoadingLabels] = useState<Set<string>>(new Set());

  // Get relationships for this entity
  const allRelationships = useMemo(() => {
    let relationships = getRelationships(entityId);

    // Filter by types if specified
    if (filterTypes && filterTypes.length > 0) {
      relationships = relationships.filter((r) => filterTypes.includes(r.type));
    }

    return relationships;
  }, [getRelationships, entityId, filterTypes]);

  // Split into visible and hidden
  const visibleRelationships = useMemo(() => {
    return allRelationships.slice(0, maxVisible);
  }, [allRelationships, maxVisible]);

  const hiddenCount = Math.max(0, allRelationships.length - maxVisible);

  // Fetch entity labels for visible relationships
  useEffect(() => {
    const labelsToFetch = visibleRelationships.filter((rel) => {
      const targetId = rel.targetId;
      const cacheKey = `${rel.targetType}:${targetId}`;
      return !entityLabelCache.has(cacheKey) && !loadingLabels.has(targetId);
    });

    if (labelsToFetch.length === 0) {
      return;
    }

    // Mark as loading
    setLoadingLabels((prev) => {
      const next = new Set(prev);
      labelsToFetch.forEach((rel) => next.add(rel.targetId));
      return next;
    });

    // Batch fetch all labels
    Promise.all(
      labelsToFetch.map(async (rel) => {
        const label = await loadEntityLabel(rel.targetType, rel.targetId);
        return { targetId: rel.targetId, label };
      })
    ).then((results) => {
      setEntityLabels((prev) => {
        const next = new Map(prev);
        results.forEach(({ targetId, label }) => {
          next.set(targetId, label);
        });
        return next;
      });

      setLoadingLabels((prev) => {
        const next = new Set(prev);
        results.forEach(({ targetId }) => next.delete(targetId));
        return next;
      });
    });
  }, [visibleRelationships]);

  // Handlers
  const handlePillClick = useCallback(
    (relationship: Relationship) => {
      onPillClick?.(relationship);
    },
    [onPillClick]
  );

  const handleRemove = useCallback(
    (relationship: Relationship) => {
      onRemove?.(relationship);
    },
    [onRemove]
  );

  const handleMoreClick = useCallback(() => {
    // When "+X more" is clicked, trigger click on first visible relationship
    // This is a hint to open a modal or expand view
    if (visibleRelationships.length > 0 && onPillClick) {
      onPillClick(visibleRelationships[0]);
    }
  }, [visibleRelationships, onPillClick]);

  // Empty state - show helpful message instead of hiding
  if (allRelationships.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <p>No relationships yet.</p>
        {onPillClick && (
          <button
            onClick={() => {
              // Trigger the pill click handler (which opens the modal)
              if (visibleRelationships.length === 0) {
                // No relationships exist, so we can't pass one. Just call it with undefined
                // The modal will open anyway since we're clicking the section
                onPillClick(undefined as any);
              }
            }}
            className="text-blue-600 hover:text-blue-700 mt-1"
          >
            + Add relationship
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap gap-2 ${className}`}
      role="group"
      aria-label="Related entities"
    >
      {/* Visible pills */}
      {visibleRelationships.map((rel) => {
        const label = entityLabels.get(rel.targetId) ?? 'Loading...';
        const isLoading = loadingLabels.has(rel.targetId);

        return (
          <RelationshipPill
            key={rel.id}
            relationship={rel}
            label={label}
            isLoading={isLoading}
            onClick={onPillClick ? () => handlePillClick(rel) : undefined}
            onRemove={showRemoveButton ? () => handleRemove(rel) : undefined}
          />
        );
      })}

      {/* "+X more" button */}
      {hiddenCount > 0 && (
        <button
          type="button"
          className={`
            inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium
            bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400
            hover:bg-gray-200 dark:hover:bg-gray-700
            ${TRANSITIONS.fast}
            focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1
          `}
          onClick={handleMoreClick}
          aria-label={`Show ${hiddenCount} more relationships`}
        >
          +{hiddenCount} more
        </button>
      )}
    </div>
  );
});

export default RelationshipPills;
