import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface StandardSelectOption {
  value: string;
  label: string;
}

interface StandardSelectProps {
  value: string;
  options: StandardSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export const StandardSelect = forwardRef<HTMLSelectElement, StandardSelectProps>(
  ({ value, options, onChange, disabled = false, label, className = '' }, ref) => {
    return (
      <div className="flex items-center gap-2">
        {label && (
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {label}:
          </span>
        )}
        <div className="relative">
          <select
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`
              pl-3 pr-8 py-2 text-sm font-semibold
              bg-white/50 backdrop-blur-sm
              border-2 border-white/60 rounded-full
              focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300
              outline-none transition-all duration-300
              appearance-none cursor-pointer
              h-[38px]
              leading-[22px]
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/70 hover:border-cyan-300 hover:shadow-md'}
              ${className}
            `.trim()}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors
              ${disabled ? 'text-gray-400' : 'text-gray-600'}`}
          />
        </div>
      </div>
    );
  }
);

StandardSelect.displayName = 'StandardSelect';
