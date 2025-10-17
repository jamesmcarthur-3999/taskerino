/**
 * UserNoteCard Component
 *
 * Premium sticky note card for user-created notes in the timeline.
 * Replaces the basic context item rendering with a rich, interactive experience.
 *
 * Features:
 * - Animated gradient border (amber/yellow gradient)
 * - Inline editing (double-click to edit, Enter to save, Escape to cancel)
 * - Priority markers (Critical, Important, Normal) with colored dots
 * - Tag extraction (#hashtags and @mentions from content)
 * - Convert to task action button
 * - Large prominent text (sticky note aesthetic)
 * - Glassmorphism background with warm amber tones
 * - Quick action buttons on hover (Edit, Delete, Convert, Copy)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Edit3,
  Trash2,
  CheckSquare,
  Copy,
  Check,
} from 'lucide-react';
import type { SessionContextItem } from '../types';
import { GradientIconBadge } from './GradientIconBadge';
import { TagPill } from './TagPill';
import {
  RADIUS,
  TRANSITIONS,
  NOTE_GRADIENTS,
  PRIORITY_COLORS,
} from '../design-system/theme';

export type NotePriority = 'critical' | 'important' | 'normal';

interface UserNoteCardProps {
  /** Context item data */
  contextItem: SessionContextItem;
  /** Session start time for timestamp formatting */
  sessionStartTime: string;
  /** Whether this note is currently active in playback */
  isActive?: boolean;
  /** Click handler for seeking to this timestamp */
  onClick?: () => void;
  /** Edit handler - called when user saves edited content */
  onEdit?: (id: string, newContent: string) => void;
  /** Delete handler */
  onDelete?: (id: string) => void;
  /** Convert to task handler */
  onConvertToTask?: (content: string) => void;
  /** Optional priority level */
  priority?: NotePriority;
}

/**
 * Extract hashtags from text content
 */
function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  if (!matches) return [];
  return [...new Set(matches.map(tag => tag.slice(1)))]; // Remove # and dedupe
}

/**
 * Extract @mentions from text content
 */
function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = text.match(mentionRegex);
  if (!matches) return [];
  return [...new Set(matches.map(mention => mention.slice(1)))]; // Remove @ and dedupe
}

/**
 * Format timestamp relative to session start
 */
function formatRelativeTime(timestamp: string, sessionStart: string): string {
  const noteTime = new Date(timestamp).getTime();
  const startTime = new Date(sessionStart).getTime();
  const diffSeconds = Math.floor((noteTime - startTime) / 1000);

  if (diffSeconds < 60) {
    return `${diffSeconds}s`;
  }
  const mins = Math.floor(diffSeconds / 60);
  const secs = diffSeconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function UserNoteCard({
  contextItem,
  sessionStartTime,
  isActive = false,
  onClick,
  onEdit,
  onDelete,
  onConvertToTask,
  priority = 'normal',
}: UserNoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(contextItem.content);
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Extract tags from content
  const hashtags = extractHashtags(contextItem.content);
  const mentions = extractMentions(contextItem.content);
  const hasTags = hashtags.length > 0 || mentions.length > 0;

  // Get priority styling
  const priorityConfig = PRIORITY_COLORS[priority];

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      textareaRef.current.selectionEnd = textareaRef.current.value.length;
    }
  }, [isEditing]);

  // Handle double-click to edit
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!onEdit) return;
    e.stopPropagation();
    setIsEditing(true);
    setEditedContent(contextItem.content);
  };

  // Handle save (Enter key)
  const handleSave = () => {
    if (editedContent.trim() && editedContent !== contextItem.content) {
      onEdit?.(contextItem.id, editedContent.trim());
    }
    setIsEditing(false);
  };

  // Handle cancel (Escape key)
  const handleCancel = () => {
    setEditedContent(contextItem.content);
    setIsEditing(false);
  };

  // Handle keyboard shortcuts in edit mode
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // Handle copy to clipboard
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(contextItem.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle delete
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this note?')) {
      onDelete?.(contextItem.id);
    }
  };

  // Handle convert to task
  const handleConvertToTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConvertToTask?.(contextItem.content);
  };

  // Handle edit button click
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditedContent(contextItem.content);
  };

  return (
    <div
      className={`
        relative group
        ${TRANSITIONS.standard}
        ${isActive ? 'scale-[1.02]' : ''}
      `}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={onClick}
    >
      {/* Animated gradient border wrapper */}
      <div
        className={`
          relative
          rounded-[16px]
          bg-gradient-to-r ${NOTE_GRADIENTS.border}
          p-[2px]
          ${isActive ? 'animate-border-pulse' : ''}
          ${TRANSITIONS.standard}
        `}
      >
        {/* Card content */}
        <div
          className={`
            relative
            bg-gradient-to-br ${NOTE_GRADIENTS.background}
            backdrop-blur-xl
            rounded-[14px]
            p-4
            ${NOTE_GRADIENTS.shadow}
            ${isActive ? 'shadow-lg shadow-amber-300/40' : ''}
            ${TRANSITIONS.standard}
          `}
        >
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            {/* Icon badge */}
            <GradientIconBadge
              icon={Edit3}
              iconSize={16}
              gradientFrom={NOTE_GRADIENTS.iconBg.split(' ')[0].replace('from-', '')}
              gradientTo={NOTE_GRADIENTS.iconBg.split(' ')[1].replace('to-', '')}
              iconColor={NOTE_GRADIENTS.textPrimary}
              size={40}
              pulse={isActive}
            />

            <div className="flex-1 min-w-0">
              {/* Title and priority */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold ${NOTE_GRADIENTS.textPrimary} uppercase tracking-wide`}>
                  User Note
                </span>

                {/* Priority indicator */}
                {priority !== 'normal' && (
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${priorityConfig.dot}`} />
                    <span className={`text-[9px] font-bold ${priorityConfig.text} uppercase`}>
                      {priority}
                    </span>
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <div className={`text-[10px] ${NOTE_GRADIENTS.textSecondary}`}>
                {formatRelativeTime(contextItem.timestamp, sessionStartTime)}
              </div>
            </div>
          </div>

          {/* Content - Edit mode or view mode */}
          {isEditing ? (
            <div className="mb-3">
              <textarea
                ref={textareaRef}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`
                  w-full
                  px-3 py-2
                  bg-white/80
                  border-2 border-amber-400
                  rounded-[16px]
                  text-base text-gray-900
                  placeholder:text-gray-500
                  focus:outline-none
                  focus:ring-2 focus:ring-amber-500
                  resize-none
                  min-h-[80px]
                  ${TRANSITIONS.fast}
                `}
                placeholder="Edit your note..."
                rows={3}
              />
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancel();
                  }}
                  className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Cancel (Esc)
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSave();
                  }}
                  className={`
                    px-3 py-1
                    bg-gradient-to-r from-amber-500 to-amber-600
                    text-white text-xs font-bold
                    rounded-[16px]
                    hover:from-amber-600 hover:to-amber-700
                    ${TRANSITIONS.fast}
                  `}
                >
                  Save (Enter)
                </button>
              </div>
            </div>
          ) : (
            <p
              className={`
                text-base leading-relaxed
                text-gray-900
                mb-3
                whitespace-pre-wrap
                break-words
                cursor-text
              `}
              onDoubleClick={handleDoubleClick}
              title={onEdit ? 'Double-click to edit' : undefined}
            >
              {contextItem.content}
            </p>
          )}

          {/* Tags */}
          {hasTags && !isEditing && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {hashtags.map((tag) => (
                <TagPill key={`hashtag-${tag}`} text={tag} type="hashtag" />
              ))}
              {mentions.map((mention) => (
                <TagPill key={`mention-${mention}`} text={mention} type="mention" />
              ))}
            </div>
          )}

          {/* Quick actions (hover reveal) */}
          {!isEditing && (
            <div
              className={`
                flex items-center gap-2
                transition-all duration-200
                ${showActions ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}
              `}
            >
              {/* Edit */}
              {onEdit && (
                <button
                  onClick={handleEditClick}
                  className={`
                    flex items-center gap-1.5
                    px-2 py-1
                    bg-white/80
                    border border-amber-300
                    rounded-[16px]
                    text-[10px] font-semibold
                    text-amber-700
                    hover:bg-amber-50
                    ${TRANSITIONS.fast}
                  `}
                  title="Edit note"
                >
                  <Edit3 size={11} />
                  Edit
                </button>
              )}

              {/* Convert to Task */}
              {onConvertToTask && (
                <button
                  onClick={handleConvertToTask}
                  className={`
                    flex items-center gap-1.5
                    px-2 py-1
                    bg-white/80
                    border border-blue-300
                    rounded-[16px]
                    text-[10px] font-semibold
                    text-blue-700
                    hover:bg-blue-50
                    ${TRANSITIONS.fast}
                  `}
                  title="Convert to task"
                >
                  <CheckSquare size={11} />
                  Task
                </button>
              )}

              {/* Copy */}
              <button
                onClick={handleCopy}
                className={`
                  flex items-center gap-1.5
                  px-2 py-1
                  bg-white/80
                  border border-gray-300
                  rounded-[16px]
                  text-[10px] font-semibold
                  text-gray-700
                  hover:bg-gray-50
                  ${TRANSITIONS.fast}
                `}
                title="Copy to clipboard"
              >
                {copied ? (
                  <>
                    <Check size={11} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    Copy
                  </>
                )}
              </button>

              {/* Delete */}
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className={`
                    flex items-center gap-1.5
                    px-2 py-1
                    bg-white/80
                    border border-red-300
                    rounded-[16px]
                    text-[10px] font-semibold
                    text-red-700
                    hover:bg-red-50
                    ${TRANSITIONS.fast}
                  `}
                  title="Delete note"
                >
                  <Trash2 size={11} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
