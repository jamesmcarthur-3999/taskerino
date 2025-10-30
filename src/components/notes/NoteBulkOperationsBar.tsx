import React from 'react';
import { CheckSquare, Tag, Trash2, FolderPlus, Archive } from 'lucide-react';
import { getGlassClasses, getRadiusClass } from '../../design-system/theme';

interface NoteBulkOperationsBarProps {
  selectedCount: number;
  totalFilteredCount: number;
  onSelectAll: () => void;
  onDelete: () => void;
  onAddToTopic: () => void;
  onAddTags: () => void;
  onArchive: () => void;
}

export function NoteBulkOperationsBar({
  selectedCount,
  totalFilteredCount,
  onSelectAll,
  onDelete,
  onAddToTopic,
  onAddTags,
  onArchive,
}: NoteBulkOperationsBarProps) {
  return (
    <div className={`mb-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 ${getGlassClasses('medium')} ${getRadiusClass('element')} border-2 border-purple-400/60 p-4 shadow-lg animate-in slide-in-from-top-2 duration-200`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-purple-700" />
          <span className="text-sm font-bold text-gray-900">
            {selectedCount} note{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>
        <button
          onClick={onSelectAll}
          className="text-xs font-semibold text-purple-700 hover:text-purple-900 underline"
        >
          Select All ({totalFilteredCount})
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onAddToTopic}
          className={`px-3 py-2 ${getGlassClasses('subtle')} ${getRadiusClass('element')} text-xs font-semibold text-gray-700 hover:text-gray-900 border-2 border-white/60 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2`}
        >
          <FolderPlus size={14} />
          Add to Topic
        </button>
        <button
          onClick={onAddTags}
          className={`px-3 py-2 ${getGlassClasses('subtle')} ${getRadiusClass('element')} text-xs font-semibold text-gray-700 hover:text-gray-900 border-2 border-white/60 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2`}
        >
          <Tag size={14} />
          Add Tags
        </button>
        <button
          onClick={onArchive}
          className={`px-3 py-2 ${getGlassClasses('subtle')} ${getRadiusClass('element')} text-xs font-semibold text-gray-700 hover:text-gray-900 border-2 border-white/60 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2`}
        >
          <Archive size={14} />
          Archive
        </button>
        <button
          onClick={onDelete}
          className={`px-3 py-2 bg-red-100 hover:bg-red-200 ${getGlassClasses('subtle')} ${getRadiusClass('element')} text-xs font-semibold text-red-700 hover:text-red-900 border-2 border-red-200 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2`}
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </div>
  );
}
