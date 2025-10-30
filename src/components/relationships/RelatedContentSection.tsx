/**
 * RelatedContentSection - Focused relationship section for one entity type
 *
 * Features:
 * - Shows only specified relationship types (e.g., only tasks)
 * - Clear section title ("Related Notes", "Related Tasks", etc.)
 * - "+ Add" button for discoverability
 * - Empty state with helpful message
 * - Reusable across all detail views
 *
 * @module components/relationships/RelatedContentSection
 */

import React from 'react';
import { Plus } from 'lucide-react';
import { RelationshipPills } from './RelationshipPills';
import type { EntityType, RelationshipType } from '@/types/relationships';
import { getRadiusClass, TRANSITIONS } from '@/design-system/theme';

export interface RelatedContentSectionProps {
  /** Entity ID to fetch relationships for */
  entityId: string;

  /** Entity type (for fetching relationships) */
  entityType: EntityType;

  /** Section title (e.g., "Related Notes", "Related Tasks") */
  title: string;

  /** Which relationship types to show (e.g., [RelationshipType.TASK_NOTE]) */
  filterTypes: RelationshipType[];

  /** Maximum number of pills to show before "+X more" (default: 8) */
  maxVisible?: number;

  /** Show remove button on pills? (default: true) */
  showRemoveButton?: boolean;

  /** Callback when "+ Add" button clicked (opens modal) */
  onAddClick?: () => void;

  /** Message to show when no relationships (default: "No relationships yet") */
  emptyMessage?: string;

  /** Custom CSS classes */
  className?: string;
}

/**
 * RelatedContentSection component
 *
 * Displays a focused section showing only one type of relationship.
 * This is a thin wrapper around RelationshipPills that adds:
 * - Clear section title
 * - "+ Add" button for discoverability
 * - Consistent spacing and layout
 */
export function RelatedContentSection({
  entityId,
  entityType,
  title,
  filterTypes,
  maxVisible = 8,
  showRemoveButton = true,
  onAddClick,
  emptyMessage = 'No relationships yet',
  className = '',
}: RelatedContentSectionProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Title Row with "+ Add" button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {title}
        </h3>
        {onAddClick && (
          <button
            onClick={onAddClick}
            className={`
              inline-flex items-center gap-1 px-2 py-1
              text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300
              font-semibold
              hover:bg-blue-50 dark:hover:bg-blue-900/20
              ${getRadiusClass('element')}
              ${TRANSITIONS.fast}
              focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
              dark:focus:ring-blue-500 dark:focus:ring-offset-gray-900
            `}
            aria-label={`Add ${title.toLowerCase()}`}
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Relationship Pills (filtered) */}
      <div className="min-h-[32px]">
        <RelationshipPills
          entityId={entityId}
          entityType={entityType}
          filterTypes={filterTypes}
          maxVisible={maxVisible}
          showRemoveButton={showRemoveButton}
          onPillClick={onAddClick}
        />
      </div>
    </div>
  );
}

export default RelatedContentSection;
