import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface DropdownSelectOption {
  value: string;
  label: string;
}

interface DropdownSelectProps {
  value: string;
  options: DropdownSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function DropdownSelect({
  value,
  options,
  onChange,
  disabled = false,
  label,
  className = ''
}: DropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Update position when dropdown opens
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const dropdownMenu = isOpen && !disabled && (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 99999
      }}
      className="
        min-w-[160px] w-max
        bg-white backdrop-blur-xl rounded-[20px]
        border-2 border-cyan-400/80 shadow-2xl
        max-h-64 overflow-y-auto
        py-2
      "
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => handleSelect(option.value)}
          className={`
            w-full px-4 py-2 text-sm font-semibold text-left
            transition-all duration-200
            ${option.value === value
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
              : 'text-gray-700 hover:bg-cyan-50'
            }
          `.trim()}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {label}:
        </span>
      )}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            pl-3 pr-8 py-2 text-sm font-semibold
            bg-white/50 backdrop-blur-sm
            border-2 border-white/60 rounded-full
            focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300
            outline-none transition-all duration-300
            h-[38px]
            leading-[22px]
            flex items-center
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/70 hover:border-cyan-300 hover:shadow-md cursor-pointer'}
            ${className}
          `.trim()}
        >
          {selectedOption?.label || 'Select...'}
        </button>
        <ChevronDown
          className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-all duration-300
            ${disabled ? 'text-gray-400' : 'text-gray-600'}
            ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Render dropdown menu in a portal */}
      {dropdownMenu && createPortal(dropdownMenu, document.body)}
    </div>
  );
}
