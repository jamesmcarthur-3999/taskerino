import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { GlassSelectTrigger } from './GlassSelectTrigger';
import { GlassSelectMenu } from './GlassSelectMenu';
import type { GlassSelectProps, GlassSelectOption } from './types';
import { useClickOutside } from '../../hooks/useClickOutside';

export function GlassSelect<T = string>({
  value,
  options,
  onChange,
  label,
  placeholder = 'Select option...',
  variant = 'primary',
  showLabel = true,
  showChevron = true,
  triggerIcon,
  disabled = false,
  searchable = false,
  clearable = false,
  closeOnSelect = true,
  menuPosition = 'auto',
  menuWidth = 'trigger',
  maxHeight = 320,
  renderOption,
  renderTrigger,
  className = '',
  menuClassName = '',
}: GlassSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Find selected option
  const selectedOption = options.find((opt) => opt.value === value) || null;

  // Filter options based on search
  const filteredOptions =
    searchable && searchQuery
      ? options.filter(
          (opt) =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            opt.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : options;

  // Close on click outside
  useClickOutside([triggerRef, menuRef], () => {
    if (isOpen) setIsOpen(false);
  });

  // Handle option selection
  const handleSelect = (option: GlassSelectOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    setSearchQuery('');
    if (closeOnSelect) {
      setIsOpen(false);
    }
  };

  // Handle clear
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null as any);
    setIsOpen(false);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            Math.min(prev + 1, filteredOptions.length - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
        case 'Home':
          e.preventDefault();
          setHighlightedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setHighlightedIndex(filteredOptions.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, filteredOptions]);

  // Reset highlighted index when options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Return focus to trigger when menu closes
  useEffect(() => {
    if (!isOpen && triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className={`relative ${className}`}>
      <GlassSelectTrigger
        ref={triggerRef}
        label={label}
        selectedOption={selectedOption}
        placeholder={placeholder}
        variant={variant}
        showLabel={showLabel}
        showChevron={showChevron}
        icon={triggerIcon}
        isOpen={isOpen}
        disabled={disabled}
        clearable={clearable && !!selectedOption}
        onToggle={() => !disabled && setIsOpen(!isOpen)}
        onClear={handleClear}
        renderTrigger={renderTrigger}
      />

      <AnimatePresence>
        {isOpen && (
          <GlassSelectMenu
            ref={menuRef}
            triggerRef={triggerRef}
            options={filteredOptions}
            selectedValue={value}
            highlightedIndex={highlightedIndex}
            searchable={searchable}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelect={handleSelect}
            onHighlightChange={setHighlightedIndex}
            position={menuPosition}
            width={menuWidth}
            maxHeight={maxHeight}
            renderOption={renderOption}
            className={menuClassName}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Export types for consumers
export type { GlassSelectProps, GlassSelectOption } from './types';
