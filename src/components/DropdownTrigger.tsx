import React from 'react';
import type { LucideProps } from 'lucide-react';

interface DropdownTriggerProps {
  label: string;
  icon: React.ComponentType<LucideProps>;
  active: boolean;
  onClick: () => void;
  badge?: number;
  disabled?: boolean;
  className?: string;
}

export function DropdownTrigger({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
  disabled = false,
  className = '',
}: DropdownTriggerProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-4 py-2 backdrop-blur-sm border-2 rounded-full text-sm font-semibold
        transition-all flex items-center gap-2
        ${active
          ? 'bg-cyan-100 border-cyan-400 text-cyan-800'
          : 'bg-white/50 border-white/60 text-gray-700 hover:bg-white/70 hover:border-cyan-300'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 outline-none
        ${className}
      `.trim()}
      title={label}
    >
      <Icon size={16} />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 px-1.5 py-0.5 bg-cyan-500 text-white rounded-full text-[10px] font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}
