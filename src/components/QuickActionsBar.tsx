/**
 * QuickActionsBar Component
 *
 * Hover-revealed action bar for timeline cards (screenshots, audio, notes).
 * Displays quick action buttons with smooth slide-up animation.
 *
 * Features:
 * - Slide-up animation on parent hover
 * - Icon buttons with tooltips
 * - Glassmorphism background
 * - Activity-specific gradient border
 */

import React from 'react';
import { Maximize2, CheckSquare, FileText, Flag } from 'lucide-react';
import { RADIUS, TRANSITIONS } from '../design-system/theme';

interface QuickActionsBarProps {
  /** Called when expand/view action is clicked */
  onExpand?: () => void;
  /** Called when create task action is clicked */
  onCreateTask?: () => void;
  /** Called when save note action is clicked */
  onSaveNote?: () => void;
  /** Called when flag action is clicked */
  onFlag?: () => void;
  /** Whether the item is flagged */
  isFlagged?: boolean;
  /** Activity color for gradient border (e.g., 'blue-500') */
  activityColor?: string;
}

export function QuickActionsBar({
  onExpand,
  onCreateTask,
  onSaveNote,
  onFlag,
  isFlagged = false,
  activityColor = 'cyan-500',
}: QuickActionsBarProps) {
  return (
    <div
      className={`
        absolute bottom-0 left-0 right-0
        translate-y-full opacity-0
        group-hover:translate-y-0 group-hover:opacity-100
        ${TRANSITIONS.standard}
        flex items-center justify-center gap-2
        py-2 px-3
        bg-white/90 backdrop-blur-xl
        border-t-2 border-${activityColor}/40
        rounded-b-[${RADIUS.card}px]
        shadow-lg
      `}
    >
      {onExpand && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className={`
            p-2 rounded-lg
            bg-white/50 hover:bg-white
            text-gray-600 hover:text-${activityColor}
            ${TRANSITIONS.fast}
            group/btn
          `}
          title="Expand"
        >
          <Maximize2 size={16} />
        </button>
      )}

      {onCreateTask && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreateTask();
          }}
          className={`
            p-2 rounded-lg
            bg-white/50 hover:bg-white
            text-gray-600 hover:text-green-600
            ${TRANSITIONS.fast}
            group/btn
          `}
          title="Create Task"
        >
          <CheckSquare size={16} />
        </button>
      )}

      {onSaveNote && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSaveNote();
          }}
          className={`
            p-2 rounded-lg
            bg-white/50 hover:bg-white
            text-gray-600 hover:text-amber-600
            ${TRANSITIONS.fast}
            group/btn
          `}
          title="Save as Note"
        >
          <FileText size={16} />
        </button>
      )}

      {onFlag && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFlag();
          }}
          className={`
            p-2 rounded-lg
            ${isFlagged
              ? 'bg-red-100 text-red-600'
              : 'bg-white/50 hover:bg-white text-gray-600 hover:text-red-600'
            }
            ${TRANSITIONS.fast}
            group/btn
          `}
          title={isFlagged ? 'Unflag' : 'Flag Important'}
        >
          <Flag size={16} className={isFlagged ? 'fill-current' : ''} />
        </button>
      )}
    </div>
  );
}
