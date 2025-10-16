import React, { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { DropdownTrigger } from '../DropdownTrigger';

export type SortOption = 'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc';

interface SessionsSortMenuProps {
  sortBy: SortOption;
  onSortChange: (sortBy: SortOption) => void;
}

export function SessionsSortMenu({ sortBy, onSortChange }: SessionsSortMenuProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const sortLabel =
    sortBy === 'date-desc' ? 'Recent' :
    sortBy === 'date-asc' ? 'Oldest' :
    sortBy === 'duration-desc' ? 'Longest' :
    sortBy === 'duration-asc' ? 'Shortest' : 'Recent';

  return (
    <div className="relative">
      <DropdownTrigger
        icon={ArrowUpDown}
        label={sortLabel}
        active={showDropdown}
        onClick={() => setShowDropdown(!showDropdown)}
      />

      {showDropdown && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white backdrop-blur-xl rounded-[20px] border-2 border-cyan-400/80 shadow-2xl z-[9999]">
          <div className="p-3 space-y-1">
            {/* Sort Options */}
            <button
              onClick={() => { onSortChange('date-desc'); setShowDropdown(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'date-desc'
                  ? 'bg-cyan-100 text-cyan-900'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Recent First
            </button>
            <button
              onClick={() => { onSortChange('date-asc'); setShowDropdown(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'date-asc'
                  ? 'bg-cyan-100 text-cyan-900'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Oldest First
            </button>
            <button
              onClick={() => { onSortChange('duration-desc'); setShowDropdown(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'duration-desc'
                  ? 'bg-cyan-100 text-cyan-900'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Longest First
            </button>
            <button
              onClick={() => { onSortChange('duration-asc'); setShowDropdown(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'duration-asc'
                  ? 'bg-cyan-100 text-cyan-900'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Shortest First
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
