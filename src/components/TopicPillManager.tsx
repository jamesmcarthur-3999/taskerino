/**
 * TopicPillManager - Single-select topic picker with inline editing
 *
 * Features:
 * - Single-select topic (not multi-select like tags)
 * - Inline editable pill display
 * - Dropdown with autocomplete/filter
 * - Empty state with "+ Add topic" prompt
 * - Keyboard accessible
 * - Glass morphism design
 *
 * @module components/TopicPillManager
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, ChevronDown } from 'lucide-react';
import { getRadiusClass, TRANSITIONS, Z_INDEX } from '../design-system/theme';
import type { Topic } from '../types';

export interface TopicPillManagerProps {
  /** Current topic ID (single value, not array) */
  topicId?: string;

  /** Callback when topic changes (undefined = removed) */
  onTopicChange: (topicId: string | undefined) => void;

  /** All available topics */
  allTopics: Topic[];

  /** Can user edit? */
  editable: boolean;

  /** Custom CSS classes */
  className?: string;

  /** Optional callback when a new topic is created */
  onCreateTopic?: (name: string) => Promise<Topic>;
}

/**
 * TopicPillManager component
 */
export function TopicPillManager({
  topicId,
  onTopicChange,
  allTopics,
  editable,
  className = '',
  onCreateTopic,
}: TopicPillManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get current topic
  const currentTopic = allTopics.find(t => t.id === topicId);

  // Filter topics by search query
  const filteredTopics = searchQuery
    ? allTopics.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allTopics;

  // Check if search query matches an existing topic (for create prompt)
  const exactMatch = allTopics.some(t =>
    t.name.toLowerCase() === searchQuery.toLowerCase()
  );
  const showCreatePrompt = searchQuery.trim().length > 0 && !exactMatch && onCreateTopic;

  // Calculate dropdown position when entering edit mode
  useEffect(() => {
    if (isEditing && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isEditing) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEditing(false);
        setSearchQuery('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing]);

  // Handle topic selection
  const handleSelectTopic = (topic: Topic) => {
    onTopicChange(topic.id);
    setIsEditing(false);
    setSearchQuery('');
  };

  // Handle topic removal
  const handleRemoveTopic = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTopicChange(undefined);
  };

  // Handle create new topic
  const handleCreateTopic = async () => {
    if (!onCreateTopic || !searchQuery.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const newTopic = await onCreateTopic(searchQuery.trim());
      // Select the new topic
      onTopicChange(newTopic.id);
      setSearchQuery('');
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to create topic:', error);
      // Error handling could be improved with toast notifications
    } finally {
      setIsCreating(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setSearchQuery('');
    } else if (e.key === 'Enter' && showCreatePrompt && !isCreating) {
      e.preventDefault();
      handleCreateTopic();
    }
  };

  // Render current topic pill
  const renderTopicPill = () => {
    if (!currentTopic) {
      // Empty state
      return (
        <button
          onClick={() => editable && setIsEditing(true)}
          disabled={!editable}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5
            bg-white/40 hover:bg-white/60 border border-dashed border-gray-400 hover:border-amber-400
            ${getRadiusClass('pill')} text-xs text-gray-500 hover:text-amber-700 font-medium
            ${TRANSITIONS.fast}
            ${editable ? 'cursor-pointer' : 'cursor-default'}
            focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1
          `}
          aria-label="Add topic"
        >
          <Plus size={12} />
          <span>Add topic</span>
        </button>
      );
    }

    // Topic selected
    return (
      <div
        className={`
          group
          inline-flex items-center gap-1.5 px-3 py-1.5
          bg-gradient-to-r from-amber-100/80 to-yellow-100/80 border border-amber-300/60
          ${getRadiusClass('pill')} text-xs font-semibold text-amber-800
          ${TRANSITIONS.fast}
          ${editable ? 'hover:from-amber-200/90 hover:to-yellow-200/90 cursor-pointer' : ''}
        `}
        onClick={() => editable && setIsEditing(true)}
        role="button"
        tabIndex={editable ? 0 : -1}
        aria-label={`Topic: ${currentTopic.name}. Click to change.`}
      >
        <span>📌</span>
        <span>{currentTopic.name}</span>
        {editable && (
          <>
            <ChevronDown size={12} className="opacity-60" />
            <button
              onClick={handleRemoveTopic}
              className="opacity-0 group-hover:opacity-100 hover:bg-amber-900/10 rounded-full p-0.5 transition-opacity"
              aria-label="Remove topic"
            >
              <X size={12} />
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`relative inline-block overflow-visible ${className}`} ref={triggerRef}>
      {/* Topic Pill */}
      {renderTopicPill()}

      {/* Dropdown (when editing) - Rendered via Portal */}
      {isEditing && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            minWidth: `${Math.max(dropdownPosition.width, 256)}px`,
            zIndex: 9999,
          }}
          className={`
            max-h-64 overflow-y-auto
            bg-white border border-gray-200 shadow-lg ${getRadiusClass('field')}
          `}
          role="listbox"
          aria-label="Select topic"
        >
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or create topic..."
              className={`
                w-full px-3 py-2 text-sm border border-gray-200 ${getRadiusClass('element')}
                focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400
              `}
              aria-label="Search topics"
            />
          </div>

          {/* Create new topic prompt */}
          {showCreatePrompt && (
            <div className="p-2 border-b border-gray-100 bg-amber-50/50">
              <button
                onClick={handleCreateTopic}
                disabled={isCreating}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                  bg-gradient-to-r from-amber-500 to-yellow-500 text-white
                  ${getRadiusClass('element')}
                  hover:from-amber-600 hover:to-yellow-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${TRANSITIONS.fast}
                `}
                aria-label={`Create new topic: ${searchQuery}`}
              >
                <Plus size={14} />
                <span>{isCreating ? 'Creating...' : `Create "${searchQuery}"`}</span>
              </button>
            </div>
          )}

          {/* Topic list */}
          <div className="py-1">
            {filteredTopics.length === 0 && !showCreatePrompt ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No topics found
              </div>
            ) : (
              filteredTopics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => handleSelectTopic(topic)}
                  className={`
                    w-full px-3 py-2 text-left text-sm hover:bg-amber-50
                    ${topic.id === topicId ? 'bg-amber-100 font-semibold' : ''}
                    ${TRANSITIONS.fast}
                  `}
                  role="option"
                  aria-selected={topic.id === topicId}
                >
                  <span className="mr-2">📌</span>
                  {topic.name}
                  {topic.noteCount && topic.noteCount > 0 && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({topic.noteCount} notes)
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default TopicPillManager;
