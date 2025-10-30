import React, { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { DropdownTrigger } from '../DropdownTrigger';
import { getGlassmorphism, getRadiusClass, SHADOWS } from '../../design-system/theme';

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
        <div className={`absolute top-full left-0 mt-2 w-48 bg-white/80 backdrop-blur-2xl ${getRadiusClass('modal')} border-2 border-cyan-400/80 ${SHADOWS.modal} z-[9999]`}>
          <div className="p-4 space-y-1.5">
            {/* Sort Options */}
            <button
              onClick={() => { onSortChange('date-desc'); setShowDropdown(false); }}
              className={`w-full text-left px-3 py-2 ${getRadiusClass('element')} text-sm font-medium transition-all ${
                sortBy === 'date-desc'
                  ? 'bg-cyan-100 text-cyan-900'
                  : 'text-gray-800 hover:bg-cyan-50'
              }`}
            >
              Recent First
            </button>
            <button
              onClick={() => { onSortChange('date-asc'); setShowDropdown(false); }}
              className={`w-full text-left px-3 py-2 ${getRadiusClass('element')} text-sm font-medium transition-all ${
                sortBy === 'date-asc'
                  ? 'bg-cyan-100 text-cyan-900'
                  : 'text-gray-800 hover:bg-cyan-50'
              }`}
            >
              Oldest First
            </button>
            <button
              onClick={() => { onSortChange('duration-desc'); setShowDropdown(false); }}
              className={`w-full text-left px-3 py-2 ${getRadiusClass('element')} text-sm font-medium transition-all ${
                sortBy === 'duration-desc'
                  ? 'bg-cyan-100 text-cyan-900'
                  : 'text-gray-800 hover:bg-cyan-50'
              }`}
            >
              Longest First
            </button>
            <button
              onClick={() => { onSortChange('duration-asc'); setShowDropdown(false); }}
              className={`w-full text-left px-3 py-2 ${getRadiusClass('element')} text-sm font-medium transition-all ${
                sortBy === 'duration-asc'
                  ? 'bg-cyan-100 text-cyan-900'
                  : 'text-gray-800 hover:bg-cyan-50'
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
