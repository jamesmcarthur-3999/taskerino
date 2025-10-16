import React from 'react';

interface ActiveFiltersDisplayProps {
  selectedCategories: string[];
  selectedSubCategories: string[];
  selectedTags: string[];
  onRemoveCategory: (category: string) => void;
  onRemoveSubCategory: (subCategory: string) => void;
  onRemoveTag: (tag: string) => void;
  onClearAll: () => void;
}

export function ActiveFiltersDisplay({
  selectedCategories,
  selectedSubCategories,
  selectedTags,
  onRemoveCategory,
  onRemoveSubCategory,
  onRemoveTag,
  onClearAll,
}: ActiveFiltersDisplayProps) {
  // Don't render if no filters active
  if (selectedCategories.length === 0 &&
      selectedSubCategories.length === 0 &&
      selectedTags.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Active Filters:</span>

        {/* Category pills */}
        {selectedCategories.map(category => (
          <div
            key={category}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-100 to-blue-100 border border-cyan-300 rounded-full text-xs font-semibold text-cyan-800"
          >
            <span>{category}</span>
            <button
              onClick={() => onRemoveCategory(category)}
              className="hover:text-cyan-900 transition-colors"
              title="Remove filter"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Sub-category pills */}
        {selectedSubCategories.map(subCategory => (
          <div
            key={subCategory}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/60 border border-gray-300 rounded-full text-xs font-semibold text-gray-700"
          >
            <span>{subCategory}</span>
            <button
              onClick={() => onRemoveSubCategory(subCategory)}
              className="hover:text-gray-900 transition-colors"
              title="Remove filter"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Tag pills */}
        {selectedTags.map(tag => (
          <div
            key={tag}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 border border-purple-300 rounded-full text-xs font-semibold text-purple-700"
          >
            <span>{tag}</span>
            <button
              onClick={() => onRemoveTag(tag)}
              className="hover:text-purple-900 transition-colors"
              title="Remove filter"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Clear all button */}
        <button
          onClick={onClearAll}
          className="text-xs text-gray-500 hover:text-gray-700 font-semibold underline ml-2"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}
