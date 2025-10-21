/**
 * CanvasToggleGroup - Interactive Component
 *
 * Mutually exclusive toggle options (pills or buttons style).
 */

import React from 'react';
import type { ToggleGroupProps } from '../types';
import { getRadiusClass } from '../../../design-system/theme';

export function CanvasToggleGroup({
  options,
  selected,
  onChange,
  variant = 'pills',
}: ToggleGroupProps) {
  if (variant === 'buttons') {
    // Button style: Individual buttons
    return (
      <div className="inline-flex gap-2">
        {options.map((option) => {
          const isSelected = option.id === selected;
          return (
            <button
              key={option.id}
              onClick={() => onChange(option.id)}
              className={[
                'px-4 py-2',
                getRadiusClass('field'),
                'text-sm font-medium',
                'transition-all duration-200',
                'flex items-center gap-2',
                isSelected
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                  : 'bg-white/80 hover:bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {option.icon && <span>{option.icon}</span>}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Pills style: Connected group
  return (
    <div className="inline-flex bg-gray-100 p-1 rounded-full">
      {options.map((option, index) => {
        const isSelected = option.id === selected;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;

        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={[
              'px-4 py-1.5',
              isFirst && isLast ? 'rounded-full' : isFirst ? 'rounded-l-full' : isLast ? 'rounded-r-full' : '',
              'text-sm font-medium',
              'transition-all duration-200',
              'flex items-center gap-2',
              isSelected
                ? 'bg-white text-gray-900 shadow-md'
                : 'text-gray-600 hover:text-gray-900',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {option.icon && <span>{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
