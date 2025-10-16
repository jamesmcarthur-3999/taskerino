/**
 * ToggleButton Component
 *
 * Elegant glassmorphism toggle control for session settings.
 * Used for screenshot/audio controls in active session card.
 */

import React from 'react';
import type { LucideProps } from 'lucide-react';

interface ToggleButtonProps {
  icon: React.ComponentType<LucideProps>;
  label: string;
  active: boolean;
  onChange: (active: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ToggleButton = React.memo(function ToggleButton({
  icon: Icon,
  label,
  active,
  onChange,
  disabled = false,
  size = 'md',
}: ToggleButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 gap-1.5',
    md: 'px-4 py-2.5 gap-2',
    lg: 'px-5 py-3 gap-2.5',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <button
      onClick={(e) => {
        console.log(`🔘 [TOGGLE BUTTON ${label}] onClick fired - disabled: ${disabled}, active: ${active}`);
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
          console.log(`🔘 [TOGGLE BUTTON ${label}] Calling onChange with: ${!active}`);
          onChange(!active);
        } else {
          console.log(`🔘 [TOGGLE BUTTON ${label}] Button is disabled, not calling onChange`);
        }
      }}
      disabled={disabled}
      className={`
        flex items-center ${sizeClasses[size]} rounded-full font-semibold
        transition-all duration-300 transform
        ${active
          ? 'bg-gradient-to-r from-cyan-500/90 to-blue-500/90 backdrop-blur-md text-white shadow-lg shadow-cyan-500/20 scale-105'
          : 'bg-white/50 backdrop-blur-sm text-gray-700 hover:bg-white/70 border-2 border-white/60'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer'}
      `}
      title={`${active ? 'Disable' : 'Enable'} ${label}`}
    >
      <Icon
        size={iconSizes[size]}
        className={`transition-transform duration-300 ${active ? 'scale-110' : ''}`}
      />
      <span className={textSizes[size]}>{label}</span>

      {/* Active indicator dot */}
      {active && (
        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-lg" />
      )}
    </button>
  );
});
