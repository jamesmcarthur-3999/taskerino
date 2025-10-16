import React, { useState, useMemo } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { Session } from '../../types';
import { DropdownTrigger } from '../DropdownTrigger';

interface SessionsFilterMenuProps {
  sessions: Session[];
  selectedCategories: string[];
  selectedSubCategories: string[];
  selectedTags: string[];
  onCategoriesChange: (categories: string[]) => void;
  onSubCategoriesChange: (subCategories: string[]) => void;
  onTagsChange: (tags: string[]) => void;
}

export const SessionsFilterMenu: React.FC<SessionsFilterMenuProps> = ({
  sessions,
  selectedCategories,
  selectedSubCategories,
  selectedTags,
  onCategoriesChange,
  onSubCategoriesChange,
  onTagsChange,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  // Extract unique tags
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    sessions.forEach(s => {
      if (s.tags) {
        s.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }, [sessions]);

  // Extract unique categories
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    sessions.forEach(s => {
      if (s.category) categories.add(s.category);
    });
    return Array.from(categories).sort();
  }, [sessions]);

  // Extract unique sub-categories
  const uniqueSubCategories = useMemo(() => {
    const subCategories = new Set<string>();
    sessions.forEach(s => {
      if (s.subCategory) subCategories.add(s.subCategory);
    });
    return Array.from(subCategories).sort();
  }, [sessions]);

  // Calculate active filter count
  const activeFilterCount = selectedCategories.length + selectedSubCategories.length + selectedTags.length;

  // Handle clear all
  const handleClearAll = () => {
    onCategoriesChange([]);
    onSubCategoriesChange([]);
    onTagsChange([]);
  };

  // Handle category toggle
  const handleCategoryToggle = (category: string, checked: boolean) => {
    if (checked) {
      onCategoriesChange([...selectedCategories, category]);
    } else {
      onCategoriesChange(selectedCategories.filter(c => c !== category));
    }
  };

  // Handle sub-category toggle
  const handleSubCategoryToggle = (subCategory: string, checked: boolean) => {
    if (checked) {
      onSubCategoriesChange([...selectedSubCategories, subCategory]);
    } else {
      onSubCategoriesChange(selectedSubCategories.filter(sc => sc !== subCategory));
    }
  };

  // Handle tag toggle
  const handleTagToggle = (tag: string, checked: boolean) => {
    if (checked) {
      onTagsChange([...selectedTags, tag]);
    } else {
      onTagsChange(selectedTags.filter(t => t !== tag));
    }
  };

  return (
    <div className="relative">
      <DropdownTrigger
        icon={SlidersHorizontal}
        label="Filter"
        active={showDropdown}
        onClick={() => setShowDropdown(!showDropdown)}
        badge={activeFilterCount > 0 ? activeFilterCount : undefined}
      />

      {/* Filter Dropdown Panel */}
      {showDropdown && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white backdrop-blur-xl rounded-[20px] border-2 border-cyan-400/80 shadow-2xl z-[9999] max-h-96 overflow-y-auto">
          <div className="p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Filter Sessions</h3>
              {activeFilterCount > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-cyan-600 hover:text-cyan-800 font-bold underline transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Categories Section */}
            {uniqueCategories.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Categories</h4>
                <div className="space-y-2">
                  {uniqueCategories.map(category => (
                    <label key={category} className="flex items-center gap-3 cursor-pointer group py-1 px-2 -mx-2 rounded-lg hover:bg-cyan-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category)}
                        onChange={(e) => handleCategoryToggle(category, e.target.checked)}
                        className="w-4 h-4 rounded border-2 border-gray-300 text-cyan-600 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 cursor-pointer transition-all"
                      />
                      <span className="text-sm font-medium text-gray-800 group-hover:text-cyan-700 transition-colors">
                        {category}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-Categories Section */}
            {uniqueSubCategories.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Sub-Categories</h4>
                <div className="space-y-2">
                  {uniqueSubCategories.map(subCategory => (
                    <label key={subCategory} className="flex items-center gap-3 cursor-pointer group py-1 px-2 -mx-2 rounded-lg hover:bg-cyan-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedSubCategories.includes(subCategory)}
                        onChange={(e) => handleSubCategoryToggle(subCategory, e.target.checked)}
                        className="w-4 h-4 rounded border-2 border-gray-300 text-cyan-600 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 cursor-pointer transition-all"
                      />
                      <span className="text-sm font-medium text-gray-800 group-hover:text-cyan-700 transition-colors">
                        {subCategory}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Tags Section */}
            {uniqueTags.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Tags</h4>
                <div className="space-y-2">
                  {uniqueTags.map(tag => (
                    <label key={tag} className="flex items-center gap-3 cursor-pointer group py-1 px-2 -mx-2 rounded-lg hover:bg-purple-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={(e) => handleTagToggle(tag, e.target.checked)}
                        className="w-4 h-4 rounded border-2 border-gray-300 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 cursor-pointer transition-all"
                      />
                      <span className="text-sm font-medium text-gray-800 group-hover:text-purple-700 transition-colors">
                        {tag}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
