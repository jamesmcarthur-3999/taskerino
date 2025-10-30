import React, { forwardRef } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { LucideProps } from 'lucide-react';
import type { GlassSelectOption } from './types';

interface GlassSelectTriggerProps<T> {
  label?: string;
  selectedOption: GlassSelectOption<T> | null;
  placeholder: string;
  variant: 'primary' | 'secondary' | 'compact' | 'filter';
  showLabel: boolean;
  showChevron: boolean;
  icon?: React.ComponentType<LucideProps>;
  isOpen: boolean;
  disabled: boolean;
  clearable: boolean;
  onToggle: () => void;
  onClear: (e: React.MouseEvent) => void;
  renderTrigger?: (selected: GlassSelectOption<T> | null) => React.ReactNode;
}

export const GlassSelectTrigger = forwardRef<
  HTMLButtonElement,
  GlassSelectTriggerProps<any>
>(function GlassSelectTrigger(
  {
    label,
    selectedOption,
    placeholder,
    variant,
    showLabel,
    showChevron,
    icon: Icon,
    isOpen,
    disabled,
    clearable,
    onToggle,
    onClear,
    renderTrigger,
  },
  ref
) {
  // Variant-specific styles with beautiful glass morphism
  const variantStyles = {
    primary: `
      bg-white/50 backdrop-blur-xl
      border-2 border-white/60
      px-4 py-2 h-[38px]
      ${
        isOpen
          ? 'bg-white/95 border-cyan-400/80 shadow-lg shadow-cyan-200/30'
          : 'hover:bg-white/70 hover:border-cyan-300 hover:shadow-md'
      }
    `,
    secondary: `
      bg-white/40 backdrop-blur-sm
      border-2 border-white/50
      px-4 py-2 h-[38px]
      ${isOpen ? 'bg-white/60 border-white/70' : 'hover:bg-white/55'}
    `,
    compact: `
      bg-white/30 backdrop-blur-sm
      border border-white/40
      p-2 min-w-[40px] w-auto
      ${isOpen ? 'bg-white/50' : 'hover:bg-white/45'}
    `,
    filter: `
      ${
        isOpen || selectedOption
          ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border-2 border-cyan-400/60'
          : 'bg-white/40 backdrop-blur-sm border-2 border-white/50'
      }
      px-4 py-2 h-[38px]
      ${isOpen ? 'shadow-md shadow-cyan-200/30' : 'hover:bg-white/55'}
    `,
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onToggle}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`
        relative flex items-center gap-2
        rounded-full text-sm font-semibold
        transition-all duration-300
        focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${variantStyles[variant]}
      `.trim()}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-disabled={disabled}
    >
      {/* Custom render or default */}
      {renderTrigger ? (
        renderTrigger(selectedOption)
      ) : (
        <>
          {/* Label (optional, left side) */}
          {label && variant !== 'compact' && (
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
              {label}:
            </span>
          )}

          {/* Icon (optional, left side) */}
          {Icon && <Icon className="w-4 h-4 text-gray-600 flex-shrink-0" />}

          {/* Selected value or placeholder */}
          {showLabel && variant !== 'compact' && (
            <span
              className={`flex-1 text-left truncate ${
                selectedOption ? 'text-gray-900' : 'text-gray-500'
              }`}
            >
              {selectedOption?.label || placeholder}
            </span>
          )}

          {/* Clear button */}
          {clearable && !disabled && (
            <motion.button
              type="button"
              onClick={onClear}
              className="p-0.5 rounded-full hover:bg-gray-200/50 transition-colors flex-shrink-0"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Clear selection"
            >
              <X className="w-3.5 h-3.5 text-gray-500" />
            </motion.button>
          )}

          {/* Chevron indicator */}
          {showChevron && (
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
              className="flex-shrink-0"
            >
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </motion.div>
          )}
        </>
      )}
    </motion.button>
  );
});
