import React, { forwardRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { GlassSelectOption } from './GlassSelectOption';
import type { GlassSelectOption as Option } from './types';

interface GlassSelectMenuProps<T> {
  triggerRef: React.RefObject<HTMLElement>;
  options: Option<T>[];
  selectedValue: T;
  highlightedIndex: number;
  searchable: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (option: Option<T>) => void;
  onHighlightChange: (index: number) => void;
  position: 'left' | 'right' | 'auto';
  width: 'trigger' | 'content' | number;
  maxHeight: number;
  renderOption?: (option: Option<T>) => React.ReactNode;
  className?: string;
}

export const GlassSelectMenu = forwardRef<
  HTMLDivElement,
  GlassSelectMenuProps<any>
>(function GlassSelectMenu(
  {
    triggerRef,
    options,
    selectedValue,
    highlightedIndex,
    searchable,
    searchQuery,
    onSearchChange,
    onSelect,
    onHighlightChange,
    position,
    width,
    maxHeight,
    renderOption,
    className = '',
  },
  ref
) {
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  // Calculate position dynamically
  useEffect(() => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    let calculatedLeft = triggerRect.left;
    let calculatedWidth = triggerRect.width;

    // Handle width
    if (width === 'trigger') {
      calculatedWidth = triggerRect.width;
    } else if (width === 'content') {
      calculatedWidth = Math.max(triggerRect.width, 200); // Min 200px
    } else if (typeof width === 'number') {
      calculatedWidth = width;
    }

    // Handle position
    if (position === 'right') {
      calculatedLeft = triggerRect.right - calculatedWidth;
    } else if (position === 'auto') {
      // Check if menu would overflow right edge
      if (triggerRect.left + calculatedWidth > viewportWidth - 16) {
        calculatedLeft = triggerRect.right - calculatedWidth;
      }
    }

    setMenuPosition({
      top: triggerRect.bottom + 8,
      left: Math.max(16, calculatedLeft), // Min 16px from edge
      width: calculatedWidth,
    });
  }, [triggerRef, position, width]);

  const menuContent = (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{
        duration: 0.25,
        ease: [0.34, 1.56, 0.64, 1], // Bouncy easing
      }}
      style={{
        position: 'fixed',
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        width: `${menuPosition.width}px`,
        maxHeight: `${maxHeight}px`,
        zIndex: 9999,
      }}
      className={`
        bg-white/98 backdrop-blur-xl
        border-2 border-cyan-400/80
        rounded-[20px]
        shadow-2xl shadow-cyan-200/20
        ring-1 ring-cyan-400/30
        overflow-hidden flex flex-col
        ${className}
      `.trim()}
      role="listbox"
      aria-label="Options"
    >
      {/* Search Input */}
      {searchable && (
        <div className="p-3 border-b-2 border-gray-200/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search options..."
              className="
                w-full pl-10 pr-3 py-2 text-sm
                bg-white/50 backdrop-blur-sm
                border border-white/60 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400
                transition-all
              "
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Options List */}
      <div className="overflow-y-auto p-2">
        {options.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No options found
          </div>
        ) : (
          options.map((option, index) => (
            <GlassSelectOption
              key={String(option.value)}
              option={option}
              isSelected={option.value === selectedValue}
              isHighlighted={index === highlightedIndex}
              onClick={() => onSelect(option)}
              onMouseEnter={() => onHighlightChange(index)}
              renderOption={renderOption}
            />
          ))
        )}
      </div>
    </motion.div>
  );

  return createPortal(menuContent, document.body);
});
