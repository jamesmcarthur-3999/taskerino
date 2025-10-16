/**
 * IntervalControl Component
 *
 * Compact selector for screenshot intervals with glassmorphism design.
 * Used in advanced settings panel of active session card.
 */

import React from 'react';
import { Clock } from 'lucide-react';

interface IntervalOption {
  value: number;
  label: string;
}

interface IntervalControlProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const INTERVAL_OPTIONS: IntervalOption[] = [
  { value: -1, label: 'Adaptive' },
  { value: 10/60, label: '10s' },
  { value: 0.5, label: '30s' },
  { value: 1, label: '1m' },
  { value: 2, label: '2m' },
  { value: 3, label: '3m' },
  { value: 5, label: '5m' },
];

export function IntervalControl({ value, onChange, disabled = false }: IntervalControlProps) {
  return (
    <div className="space-y-2">
      {/* Label */}
      <div className="flex items-center gap-2 text-gray-700">
        <Clock size={14} />
        <span className="text-xs font-semibold uppercase tracking-wide">Screenshot Interval</span>
      </div>

      {/* Interval Options */}
      <div className="flex gap-2">
        {INTERVAL_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={`
              flex-1 px-3 py-2 rounded-[12px] text-sm font-semibold
              transition-all duration-200 transform
              ${value === option.value
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20 scale-105'
                : 'bg-white/40 backdrop-blur-sm text-gray-700 hover:bg-white/60 border border-white/60'
              }
              ${disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:scale-105 active:scale-95 cursor-pointer'
              }
            `}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Help Text */}
      <p className="text-xs text-gray-600">
        {value === -1
          ? 'AI adjusts capture rate based on activity & context (10s-5min)'
          : 'How often screenshots are captured'}
      </p>
    </div>
  );
}
