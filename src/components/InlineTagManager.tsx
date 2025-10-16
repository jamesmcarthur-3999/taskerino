import React, { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';

interface InlineTagManagerProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  allTags?: string[];
  onTagClick?: (tag: string) => void;
  maxDisplayed?: number;
  editable?: boolean;
  className?: string;
}

export const InlineTagManager = React.memo(function InlineTagManager({
  tags,
  onTagsChange,
  allTags = [],
  onTagClick,
  maxDisplayed,
  editable = true,
  className = '',
}: InlineTagManagerProps) {
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when adding mode is activated
  useEffect(() => {
    if (isAddingTag && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingTag]);

  // Normalize tag (remove # prefix, trim, lowercase)
  const normalizeTag = (tag: string): string => {
    return tag.trim().toLowerCase().replace(/^#/, '');
  };

  // Handle adding a new tag
  const handleAddTag = () => {
    const normalized = normalizeTag(inputValue);

    // Validate: non-empty and not a duplicate
    if (normalized && !tags.map(t => normalizeTag(t)).includes(normalized)) {
      // Limit tag length to prevent UI issues
      if (normalized.length > 50) {
        return;
      }

      onTagsChange([...tags, normalized]);
    }

    // Reset state
    setInputValue('');
    setIsAddingTag(false);
  };

  // Handle removing a tag
  const handleRemoveTag = (tagToRemove: string, event: React.MouseEvent) => {
    // Stop propagation so onTagClick doesn't fire
    event.stopPropagation();
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  // Handle tag click (for filtering)
  const handleTagClick = (tag: string, event: React.MouseEvent) => {
    // Only trigger if handler is provided
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  // Handle keyboard events on input
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddTag();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setInputValue('');
      setIsAddingTag(false);
    }
  };

  // Handle input blur
  const handleBlur = () => {
    // Add tag if there's content, otherwise just close
    if (inputValue.trim()) {
      handleAddTag();
    } else {
      setIsAddingTag(false);
    }
  };

  // Calculate displayed tags
  const displayedTags = maxDisplayed && tags.length > maxDisplayed
    ? tags.slice(0, maxDisplayed)
    : tags;

  const remainingCount = maxDisplayed && tags.length > maxDisplayed
    ? tags.length - maxDisplayed
    : 0;

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Horizontal scrollable container for tags with fade-out effect */}
      <div className="relative max-w-full overflow-hidden">
        <div
          className="flex items-center gap-2 overflow-x-auto max-w-full"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div className="flex items-center gap-2 flex-nowrap" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Display tags */}
            {displayedTags.map((tag) => (
              <button
                key={tag}
                onClick={(e) => handleTagClick(tag, e)}
                disabled={!onTagClick}
                className={`
                  group
                  inline-flex items-center gap-1.5 flex-shrink-0
                  bg-violet-100/60 hover:bg-violet-200/80
                  text-violet-700
                  border border-violet-300/60
                  rounded-full
                  px-3 py-1.5
                  text-xs font-semibold
                  transition-all duration-200
                  ${onTagClick ? 'cursor-pointer' : 'cursor-default'}
                  ${editable ? 'pr-2' : 'pr-3'}
                `}
                aria-label={onTagClick ? `Filter by tag ${tag}` : `Tag ${tag}`}
              >
                <span>#{tag}</span>

                {/* Remove button - appears on hover if editable */}
                {editable && (
                  <span
                    onClick={(e) => handleRemoveTag(tag, e)}
                    className="
                      opacity-0 group-hover:opacity-100
                      transition-opacity duration-200
                      hover:text-violet-900
                      cursor-pointer
                      flex items-center justify-center
                      w-4 h-4
                      rounded-full
                      hover:bg-violet-300/60
                    "
                    aria-label={`Remove tag ${tag}`}
                    role="button"
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}

            {/* Show "N more" if tags exceed maxDisplayed */}
            {remainingCount > 0 && (
              <span
                className="
                  inline-flex items-center flex-shrink-0
                  text-xs text-violet-600 font-medium
                  px-2 py-1
                "
              >
                +{remainingCount} more
              </span>
            )}

            {/* Add tag interface at the end - only shown if editable */}
            {editable && (
              <>
                {isAddingTag ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    list={allTags.length > 0 ? 'tag-suggestions' : undefined}
                    placeholder="tag name..."
                    className="
                      bg-white/60
                      border-2 border-cyan-400
                      rounded-full
                      text-xs
                      w-32
                      outline-none
                      px-3 py-1.5
                      transition-all duration-200
                      flex-shrink-0
                    "
                    aria-label="Add new tag"
                  />
                ) : (
                  <button
                    onClick={() => setIsAddingTag(true)}
                    className="
                      inline-flex items-center gap-1 flex-shrink-0
                      bg-white/40 hover:bg-white/60
                      border border-dashed border-gray-400 hover:border-cyan-400
                      rounded-full
                      px-3 py-1.5
                      text-xs text-gray-600 hover:text-cyan-700
                      font-medium
                      transition-all duration-200
                      hover:scale-105 active:scale-95
                    "
                    aria-label="Add tag"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tag</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Subtle fade-out gradient at the right edge */}
        {displayedTags.length > 2 && (
          <div
            className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none"
            style={{
              background: 'linear-gradient(to left, rgba(255, 255, 255, 0.95), transparent)',
            }}
          />
        )}
      </div>

      {/* Datalist for autocomplete suggestions */}
      {editable && allTags.length > 0 && (
        <datalist id="tag-suggestions">
          {allTags
            .filter(tag => !tags.map(t => normalizeTag(t)).includes(normalizeTag(tag)))
            .map(tag => (
              <option key={tag} value={tag} />
            ))}
        </datalist>
      )}
    </div>
  );
});
