import React from 'react';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import type { GlassSelectOption as Option } from './types';

interface GlassSelectOptionProps<T> {
  option: Option<T>;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  renderOption?: (option: Option<T>) => React.ReactNode;
}

export function GlassSelectOption<T>({
  option,
  isSelected,
  isHighlighted,
  onClick,
  onMouseEnter,
  renderOption,
}: GlassSelectOptionProps<T>) {
  const Icon = option.icon;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      disabled={option.disabled}
      className={`
        w-full flex items-center gap-3 px-4 py-2.5
        rounded-xl text-sm text-left
        transition-all duration-200
        ${
          option.disabled
            ? 'opacity-40 cursor-not-allowed'
            : 'cursor-pointer'
        }
        ${
          isSelected
            ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-700 font-semibold'
            : 'text-gray-700'
        }
        ${
          isHighlighted && !option.disabled
            ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-700'
            : ''
        }
        ${
          !isSelected && !isHighlighted && !option.disabled
            ? 'hover:bg-gray-50/50'
            : ''
        }
      `.trim()}
      whileHover={!option.disabled ? { x: 4 } : {}}
      transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
      role="option"
      aria-selected={isSelected}
      aria-disabled={option.disabled}
    >
      {renderOption ? (
        renderOption(option)
      ) : (
        <>
          {/* Icon */}
          {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}

          {/* Label and Description */}
          <div className="flex-1 min-w-0">
            <div className="truncate">{option.label}</div>
            {option.description && (
              <div className="text-xs text-gray-500 truncate mt-0.5">
                {option.description}
              </div>
            )}
          </div>

          {/* Badge */}
          {option.badge !== undefined && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full flex-shrink-0">
              {option.badge}
            </span>
          )}

          {/* Check Mark */}
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <Check className="w-4 h-4 text-cyan-600 flex-shrink-0" />
            </motion.div>
          )}
        </>
      )}
    </motion.button>
  );
}
