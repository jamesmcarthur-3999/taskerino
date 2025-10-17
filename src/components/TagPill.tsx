/**
 * TagPill Component
 *
 * Small pill-styled component for displaying tags, hashtags, and mentions.
 * Used in UserNoteCard and other timeline components.
 *
 * Features:
 * - Customizable colors
 * - Click handler for filtering
 * - Smooth hover transitions
 * - Compact design
 */

import React from 'react';
import { RADIUS, TRANSITIONS } from '../design-system/theme';

export type TagType = 'hashtag' | 'mention' | 'default';

interface TagPillProps {
  /** Tag text (without prefix like # or @) */
  text: string;
  /** Type of tag for styling */
  type?: TagType;
  /** Click handler for filtering by tag */
  onClick?: (tag: string) => void;
  /** Custom className */
  className?: string;
}

/**
 * Get color classes based on tag type
 */
function getTagColors(type: TagType): {
  bg: string;
  text: string;
  border: string;
  hover: string;
} {
  switch (type) {
    case 'hashtag':
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-300',
        hover: 'hover:bg-amber-200',
      };
    case 'mention':
      return {
        bg: 'bg-cyan-100',
        text: 'text-cyan-700',
        border: 'border-cyan-300',
        hover: 'hover:bg-cyan-200',
      };
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        border: 'border-gray-300',
        hover: 'hover:bg-gray-200',
      };
  }
}

export function TagPill({ text, type = 'default', onClick, className = '' }: TagPillProps) {
  const colors = getTagColors(type);
  const prefix = type === 'hashtag' ? '#' : type === 'mention' ? '@' : '';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onClick?.(text);
  };

  return (
    <span
      className={`
        inline-flex items-center
        px-2 py-0.5
        rounded-full
        text-[10px] font-semibold
        ${colors.bg} ${colors.text}
        border ${colors.border}
        ${onClick ? `cursor-pointer ${colors.hover}` : ''}
        ${TRANSITIONS.fast}
        ${className}
      `}
      onClick={onClick ? handleClick : undefined}
      title={onClick ? `Filter by ${prefix}${text}` : undefined}
    >
      {prefix}{text}
    </span>
  );
}
