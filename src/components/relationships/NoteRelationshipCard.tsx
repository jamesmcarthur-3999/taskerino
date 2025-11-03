/**
 * NoteRelationshipCard Component
 *
 * Rich card display for related notes with:
 * - Entity chips for linked companies/contacts (using existing pill patterns)
 * - Content preview with excerpt
 * - Tags display
 * - Source badge (call, email, thought, other)
 * - Hover actions (view, edit, remove)
 * - Key insights callout (from metadata.keyPoints)
 * - 3 variants: compact, default, expanded
 * - Smooth animations via Framer Motion
 * - Full accessibility support
 *
 * @module components/relationships/NoteRelationshipCard
 * @since 2.0.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Calendar,
  Tag,
  ExternalLink,
  Edit2,
  Trash2,
  Building2,
  User,
  Sparkles,
} from 'lucide-react';
import type { Note, Company, Contact } from '@/types';
import type { Relationship } from '@/types/relationships';
import {
  getRadiusClass,
  TRANSITIONS,
  SCALE,
  ENTITY_GRADIENTS,
} from '@/design-system/theme';
import { useRelationshipActions } from '@/hooks/useRelationshipActions';

// ============================================================================
// INTERFACES
// ============================================================================

export interface NoteRelationshipCardProps {
  /** Relationship metadata */
  relationship: Relationship;

  /** Note entity to display */
  note: Note;

  /** Card variant (compact, default, expanded) */
  variant?: 'compact' | 'default' | 'expanded';

  /** Callback when user clicks "View" */
  onView?: (noteId: string) => void;

  /** Callback when user clicks "Edit" */
  onEdit?: (noteId: string) => void;

  /** Callback when user clicks "Remove relationship" */
  onRemove?: () => void;

  /** Show action buttons (view, edit, remove) */
  showActions?: boolean;

  /** Show content excerpt */
  showExcerpt?: boolean;

  /** Show key points callout */
  showKeyPoints?: boolean;

  /** Show entity chips (companies, contacts) */
  showEntities?: boolean;

  /** Companies linked to this note */
  companies?: Array<{ id: string; name: string }>;

  /** Contacts linked to this note */
  contacts?: Array<{ id: string; name: string }>;

  /** Optional custom CSS classes */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Source badge colors
 */
const SOURCE_COLORS = {
  call: 'bg-blue-100 text-blue-800',
  email: 'bg-cyan-100 text-cyan-800',
  thought: 'bg-emerald-100 text-emerald-800',
  other: 'bg-gray-100 text-gray-700',
} as const;

/**
 * Framer Motion variants for card animation
 */
const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 25,
      duration: 0.3,
    },
  },
  exit: { opacity: 0, y: -5, transition: { duration: 0.2 } },
};

// ============================================================================
// COMPONENT
// ============================================================================

export const NoteRelationshipCard = React.memo<NoteRelationshipCardProps>(
  ({
    relationship,
    note,
    variant = 'default',
    onView,
    onEdit,
    onRemove,
    showActions = true,
    showExcerpt = false,
    showKeyPoints = false,
    showEntities = true,
    companies = [],
    contacts = [],
    className = '',
  }) => {
    const [isHovered, setIsHovered] = useState(false);

    // Format date (relative time)
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const dateText = formatDate(note.timestamp);

    // Excerpt text (if enabled)
    const excerptText = useMemo(() => {
      if (!showExcerpt || !note.content) return null;
      const maxLength = variant === 'compact' ? 100 : 200;
      if (note.content.length <= maxLength) return note.content;
      return note.content.substring(0, maxLength) + '...';
    }, [showExcerpt, note.content, variant]);

    // Key points (if enabled)
    const keyPoints = useMemo(() => {
      if (!showKeyPoints || !note.metadata?.keyPoints) return [];
      const maxPoints = variant === 'expanded' ? 5 : 3;
      return note.metadata.keyPoints.slice(0, maxPoints);
    }, [showKeyPoints, note.metadata?.keyPoints, variant]);

    // Compact variant (minimal)
    if (variant === 'compact') {
      return (
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={`
            flex items-center gap-3 px-3 py-2
            ${getRadiusClass('field')}
            bg-white/50 backdrop-blur-xl border border-white/60
            hover:border-cyan-300/60 hover:shadow-md
            ${TRANSITIONS.standard}
            cursor-pointer
            ${className}
          `}
          onClick={() => onView?.(note.id)}
          role="button"
          aria-label={`View note: ${note.summary}`}
        >
          <div className={`p-2 ${getRadiusClass('element')} bg-cyan-100 flex-shrink-0`}>
            <FileText className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {note.summary}
            </p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-600">
              <Calendar className="w-3 h-3" />
              <span>{dateText}</span>
              <span className={`px-2 py-0.5 ${getRadiusClass('pill')} ${SOURCE_COLORS[note.source]}`}>
                {note.source}
              </span>
            </div>
          </div>
        </motion.div>
      );
    }

    // Default and Expanded variants (full card)
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative group
          bg-white/70 backdrop-blur-xl
          ${getRadiusClass('card')}
          border-l-4 border-2 border-white/60
          border-l-cyan-500
          shadow-lg hover:shadow-xl hover:shadow-cyan-200/40
          ${TRANSITIONS.standard}
          ${SCALE.cardHover}
          p-4
          ${className}
        `}
        role="article"
        aria-labelledby={`note-title-${note.id}`}
        aria-describedby={`note-meta-${note.id}`}
      >
        {/* Header Row: Icon + Title */}
        <div className="flex items-start gap-3">
          {/* Icon Badge */}
          <div className={`flex-shrink-0 p-2 ${getRadiusClass('field')} bg-cyan-100`}>
            <FileText className="w-4 h-4 text-cyan-600" />
          </div>

          {/* Title + Metadata */}
          <div className="flex-1 min-w-0">
            <h3
              id={`note-title-${note.id}`}
              className="text-base font-semibold leading-normal text-gray-900"
            >
              {note.summary}
            </h3>

            {/* Date + Source */}
            <div
              id={`note-meta-${note.id}`}
              className="flex items-center gap-3 mt-1.5 text-xs text-gray-600"
            >
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{dateText}</span>
              </div>
              <span
                className={`px-2 py-0.5 ${getRadiusClass('pill')} text-xs font-medium ${SOURCE_COLORS[note.source]}`}
              >
                {note.source}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons (overlay on hover) */}
        {showActions && (
          <div className="absolute top-3 right-3 z-10">
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-1"
                >
                  {onView && (
                    <button
                      onClick={() => onView(note.id)}
                      className={`p-1.5 ${getRadiusClass('field')} bg-white/90 hover:bg-white ${TRANSITIONS.standard} hover:shadow-md shadow-sm`}
                      aria-label="View note"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => onEdit(note.id)}
                      className={`p-1.5 ${getRadiusClass('field')} bg-white/90 hover:bg-white ${TRANSITIONS.standard} hover:shadow-md shadow-sm`}
                      aria-label="Edit note"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                  {onRemove && (
                    <button
                      onClick={onRemove}
                      className={`p-1.5 ${getRadiusClass('field')} bg-white/90 hover:bg-red-100 ${TRANSITIONS.standard} hover:shadow-md shadow-sm`}
                      aria-label="Remove relationship"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Entity Chips (Companies + Contacts) */}
        {showEntities && (companies.length > 0 || contacts.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {companies.map((company) => (
              <span
                key={company.id}
                className={`
                  flex items-center gap-1 px-2 py-0.5 text-xs ${getRadiusClass('pill')}
                  bg-gradient-to-r ${ENTITY_GRADIENTS.company.from} ${ENTITY_GRADIENTS.company.to}
                  border ${ENTITY_GRADIENTS.company.border}
                  ${ENTITY_GRADIENTS.company.text}
                  hover:bg-blue-200 ${TRANSITIONS.colors} cursor-pointer
                `}
              >
                <Building2 className="w-3 h-3" />
                <span>{company.name}</span>
              </span>
            ))}
            {contacts.map((contact) => (
              <span
                key={contact.id}
                className={`
                  flex items-center gap-1 px-2 py-0.5 text-xs ${getRadiusClass('pill')}
                  bg-gradient-to-r ${ENTITY_GRADIENTS.contact.from} ${ENTITY_GRADIENTS.contact.to}
                  border ${ENTITY_GRADIENTS.contact.border}
                  ${ENTITY_GRADIENTS.contact.text}
                  hover:bg-emerald-200 ${TRANSITIONS.colors} cursor-pointer
                `}
              >
                <User className="w-3 h-3" />
                <span>{contact.name}</span>
              </span>
            ))}
          </div>
        )}

        {/* Content Excerpt */}
        {excerptText && (
          <div className="mt-3">
            <p className="text-sm text-gray-700 leading-snug line-clamp-2">
              {excerptText}
            </p>
          </div>
        )}

        {/* Key Points Callout */}
        {keyPoints.length > 0 && (
          <div
            className={`mt-3 p-3 ${getRadiusClass('field')} bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200`}
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Key Insights</span>
            </div>
            <ul className="space-y-1.5">
              {keyPoints.map((point, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-xs text-gray-700"
                >
                  <span className="w-1 h-1 bg-cyan-500 rounded-full mt-1.5 flex-shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <Tag className="w-3 h-3 text-gray-500 flex-shrink-0" />
            {note.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className={`
                  px-2 py-0.5 text-xs ${getRadiusClass('pill')}
                  bg-cyan-100 text-cyan-800
                  hover:bg-cyan-200 ${TRANSITIONS.colors} cursor-pointer
                `}
              >
                {tag}
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className="text-xs text-gray-600">
                +{note.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </motion.div>
    );
  }
);

NoteRelationshipCard.displayName = 'NoteRelationshipCard';

export default NoteRelationshipCard;
