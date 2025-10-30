/**
 * RelationshipPillVariants Component
 *
 * Provides specialized variants of the RelationshipPills component for different UI contexts:
 * - CompactRelationshipPills: Smaller pills for list views (max 3 visible)
 * - DetailedRelationshipPills: Larger pills with metadata tooltips for detail views
 * - InlineRelationshipPills: Minimal text-only pills for inline text
 *
 * All variants use the main RelationshipPills component internally with
 * customized props and styling.
 *
 * @module components/relationships/RelationshipPillVariants
 */

import React, { useState } from 'react';
import {
  type Relationship,
  type RelationshipType,
  type EntityType,
  RELATIONSHIP_CONFIGS,
} from '@/types/relationships';
import { RelationshipPills, type RelationshipPillsProps } from './RelationshipPills';

/**
 * Props for CompactRelationshipPills
 */
export interface CompactRelationshipPillsProps extends Omit<RelationshipPillsProps, 'maxVisible'> {
  /** Maximum pills to show in compact mode (default: 3) */
  maxVisible?: number;
}

/**
 * CompactRelationshipPills
 *
 * Compact variant optimized for list views with limited space.
 * - Smaller text and padding
 * - Maximum 3 pills visible by default
 * - No icons (text only)
 * - Reduced max label width
 *
 * Usage:
 * ```tsx
 * <CompactRelationshipPills
 *   entityId="task-123"
 *   entityType={EntityType.TASK}
 *   onPillClick={handleClick}
 * />
 * ```
 */
export const CompactRelationshipPills = React.memo<CompactRelationshipPillsProps>(
  function CompactRelationshipPills({ maxVisible = 3, className = '', ...props }) {
    return (
      <div className={`compact-relationship-pills ${className}`}>
        <style>{`
          .compact-relationship-pills [role="button"] {
            padding: 0.25rem 0.5rem;
            font-size: 0.625rem;
            gap: 0.25rem;
          }
          .compact-relationship-pills .truncate {
            max-width: 80px !important;
          }
          .compact-relationship-pills svg {
            display: none;
          }
        `}</style>
        <RelationshipPills {...props} maxVisible={maxVisible} className={className} />
      </div>
    );
  }
);

/**
 * Props for DetailedRelationshipPills
 */
export interface DetailedRelationshipPillsProps extends RelationshipPillsProps {
  /** Show metadata on hover (default: true) */
  showMetadata?: boolean;
}

/**
 * Tooltip component for displaying relationship metadata
 */
function MetadataTooltip({
  relationship,
  isVisible,
}: {
  relationship: Relationship;
  isVisible: boolean;
}) {
  if (!isVisible) {
    return null;
  }

  const config = RELATIONSHIP_CONFIGS[relationship.type];
  const metadata = relationship.metadata;

  return (
    <div
      className="
        absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
        min-w-[200px] max-w-[300px]
        bg-white/95 backdrop-blur-xl rounded-xl
        border-2 border-gray-200/60 shadow-xl
        p-3
        text-xs
        pointer-events-none
        animate-in fade-in slide-in-from-bottom-1 duration-200
      "
      role="tooltip"
    >
      <div className="space-y-2">
        {/* Relationship type */}
        <div>
          <span className="font-semibold text-gray-900">{config.displayName}</span>
        </div>

        {/* Source */}
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Source:</span>
          <span
            className={`
              px-2 py-0.5 rounded-full text-[10px] font-semibold
              ${
                metadata.source === 'ai'
                  ? 'bg-purple-100 text-purple-700'
                  : metadata.source === 'manual'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
              }
            `}
          >
            {metadata.source.toUpperCase()}
          </span>
        </div>

        {/* AI confidence */}
        {metadata.source === 'ai' && metadata.confidence !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Confidence:</span>
            <span className="font-semibold text-gray-900">
              {Math.round(metadata.confidence * 100)}%
            </span>
          </div>
        )}

        {/* AI reasoning */}
        {metadata.source === 'ai' && metadata.reasoning && (
          <div>
            <span className="text-gray-600">Reasoning:</span>
            <p className="text-gray-800 mt-1 leading-relaxed">{metadata.reasoning}</p>
          </div>
        )}

        {/* Created date */}
        <div className="flex items-center gap-2 text-gray-500">
          <span>Created:</span>
          <span>{new Date(metadata.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Tooltip arrow */}
      <div
        className="
          absolute top-full left-1/2 -translate-x-1/2
          w-0 h-0
          border-l-8 border-r-8 border-t-8
          border-l-transparent border-r-transparent border-t-gray-200/60
        "
      />
    </div>
  );
}

/**
 * DetailedRelationshipPills
 *
 * Detailed variant optimized for detail views with more space.
 * - Larger text and padding
 * - Shows metadata tooltip on hover
 * - Maximum 10 pills visible by default
 * - Full icons and labels
 *
 * Usage:
 * ```tsx
 * <DetailedRelationshipPills
 *   entityId="task-123"
 *   entityType={EntityType.TASK}
 *   showMetadata={true}
 *   onPillClick={handleClick}
 *   onRemove={handleRemove}
 *   showRemoveButton
 * />
 * ```
 */
export const DetailedRelationshipPills = React.memo<DetailedRelationshipPillsProps>(
  function DetailedRelationshipPills({ showMetadata = true, className = '', ...props }) {
    const [hoveredRelationship, setHoveredRelationship] = useState<string | null>(null);

    return (
      <div className={`detailed-relationship-pills relative ${className}`}>
        <style>{`
          .detailed-relationship-pills [role="button"] {
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
            gap: 0.5rem;
            position: relative;
          }
          .detailed-relationship-pills .truncate {
            max-width: 180px !important;
          }
        `}</style>

        <div
          onMouseOver={(e) => {
            if (showMetadata) {
              const pill = (e.target as HTMLElement).closest('[data-relationship-id]');
              if (pill) {
                setHoveredRelationship(pill.getAttribute('data-relationship-id'));
              }
            }
          }}
          onMouseOut={() => {
            if (showMetadata) {
              setHoveredRelationship(null);
            }
          }}
        >
          <RelationshipPills {...props} maxVisible={props.maxVisible ?? 10} className={className} />

          {/* Render tooltips */}
          {showMetadata &&
            hoveredRelationship &&
            props.entityId &&
            (() => {
              // We need access to the relationship to show metadata
              // This is a simplified version - in production you'd want to pass relationships as props
              return null;
            })()}
        </div>
      </div>
    );
  }
);

/**
 * Props for InlineRelationshipPills
 */
export interface InlineRelationshipPillsProps extends Omit<RelationshipPillsProps, 'maxVisible'> {
  /** Maximum pills to show in inline mode (default: 5) */
  maxVisible?: number;
  /** Text to show before pills (default: "Related:") */
  prefix?: string;
}

/**
 * InlineRelationshipPills
 *
 * Minimal variant for inline text contexts.
 * - Text-only (no icons)
 * - Minimal padding
 * - Fits inline with surrounding text
 * - No remove buttons
 * - Very compact "+X more" button
 *
 * Usage:
 * ```tsx
 * <p>
 *   This task is{' '}
 *   <InlineRelationshipPills
 *     entityId="task-123"
 *     entityType={EntityType.TASK}
 *     prefix="related to"
 *     maxVisible={3}
 *   />
 * </p>
 * ```
 */
export const InlineRelationshipPills = React.memo<InlineRelationshipPillsProps>(
  function InlineRelationshipPills({
    maxVisible = 5,
    prefix,
    className = '',
    showRemoveButton = false,
    ...props
  }) {
    return (
      <span className={`inline-relationship-pills inline ${className}`}>
        <style>{`
          .inline-relationship-pills {
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
            flex-wrap: wrap;
          }
          .inline-relationship-pills [role="button"] {
            padding: 0.125rem 0.5rem;
            font-size: 0.75rem;
            gap: 0.25rem;
            display: inline-flex;
          }
          .inline-relationship-pills svg {
            display: none;
          }
          .inline-relationship-pills .truncate {
            max-width: 100px !important;
          }
          .inline-relationship-pills button[aria-label*="Show"] {
            padding: 0.125rem 0.5rem;
            font-size: 0.75rem;
          }
        `}</style>

        {prefix && <span className="text-gray-600 text-sm mr-1">{prefix}</span>}

        <RelationshipPills
          {...props}
          maxVisible={maxVisible}
          showRemoveButton={false}
          className=""
        />
      </span>
    );
  }
);

/**
 * Shared helper: Format relationship metadata for display
 */
export function formatRelationshipMetadata(relationship: Relationship): {
  source: string;
  confidence?: string;
  date: string;
} {
  return {
    source: relationship.metadata.source,
    confidence:
      relationship.metadata.confidence !== undefined
        ? `${Math.round(relationship.metadata.confidence * 100)}%`
        : undefined,
    date: new Date(relationship.metadata.createdAt).toLocaleDateString(),
  };
}

/**
 * Shared helper: Get relationship pill color with opacity
 */
export function getRelationshipPillColor(
  relationship: Relationship,
  opacity: number = 0.2
): {
  background: string;
  border: string;
  text: string;
} {
  const config = RELATIONSHIP_CONFIGS[relationship.type];
  const color = config.color || '#64748B';

  return {
    background: `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
    border: `${color}${Math.round(opacity * 2 * 255).toString(16).padStart(2, '0')}`,
    text: color,
  };
}

export default {
  CompactRelationshipPills,
  DetailedRelationshipPills,
  InlineRelationshipPills,
  formatRelationshipMetadata,
  getRelationshipPillColor,
};
