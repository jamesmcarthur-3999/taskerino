import React from 'react';
import { CheckSquare, CheckCircle2, Trash2, Tag, Flag } from 'lucide-react';
import { getGlassClasses, getRadiusClass } from '../../design-system/theme';

interface TaskBulkOperationsBarProps {
  selectedCount: number;
  totalFilteredCount: number;
  onSelectAll: () => void;
  onMarkComplete: () => void;
  onMarkIncomplete: () => void;
  onDelete: () => void;
  onSetPriority: () => void;
  onAddTags: () => void;
}

export function TaskBulkOperationsBar({
  selectedCount,
  totalFilteredCount,
  onSelectAll,
  onMarkComplete,
  onMarkIncomplete,
  onDelete,
  onSetPriority,
  onAddTags,
}: TaskBulkOperationsBarProps) {
  return (
    <div className={`mb-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 ${getGlassClasses('medium')} ${getRadiusClass('element')} border-2 border-cyan-400/60 p-4 shadow-lg animate-in slide-in-from-top-2 duration-200`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-cyan-700" />
          <span className="text-sm font-bold text-gray-900">
            {selectedCount} task{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>
        <button
          onClick={onSelectAll}
          className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 underline"
        >
          Select All ({totalFilteredCount})
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onMarkComplete}
          className={`px-3 py-2 ${getGlassClasses('subtle')} ${getRadiusClass('element')} text-xs font-semibold text-gray-700 hover:text-gray-900 border-2 border-white/60 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2`}
        >
          <CheckCircle2 size={14} />
          Complete
        </button>
        <button
          onClick={onSetPriority}
          className={`px-3 py-2 ${getGlassClasses('subtle')} ${getRadiusClass('element')} text-xs font-semibold text-gray-700 hover:text-gray-900 border-2 border-white/60 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2`}
        >
          <Flag size={14} />
          Priority
        </button>
        <button
          onClick={onAddTags}
          className={`px-3 py-2 ${getGlassClasses('subtle')} ${getRadiusClass('element')} text-xs font-semibold text-gray-700 hover:text-gray-900 border-2 border-white/60 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2`}
        >
          <Tag size={14} />
          Add Tags
        </button>
        <button
          onClick={onMarkIncomplete}
          className={`px-3 py-2 ${getGlassClasses('subtle')} ${getRadiusClass('element')} text-xs font-semibold text-gray-700 hover:text-gray-900 border-2 border-white/60 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2`}
        >
          <CheckSquare size={14} />
          Incomplete
        </button>
        <button
          onClick={onDelete}
          className={`px-3 py-2 bg-red-100 hover:bg-red-200 ${getGlassClasses('subtle')} ${getRadiusClass('element')} text-xs font-semibold text-red-700 hover:text-red-900 border-2 border-red-200 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 col-span-2`}
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </div>
  );
}
