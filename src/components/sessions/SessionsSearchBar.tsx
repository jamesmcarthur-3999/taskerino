import React from 'react';
import { Search } from 'lucide-react';

interface SessionsSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SessionsSearchBar({
  value,
  onChange,
  placeholder = 'Search sessions...'
}: SessionsSearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-10 py-2 bg-white/40 backdrop-blur-xl border-2 border-white/50 rounded-[20px] focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 outline-none transition-all text-sm text-gray-900 placeholder:text-gray-500"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          title="Clear search"
        >
          <span className="text-sm font-bold">✕</span>
        </button>
      )}
    </div>
  );
}
