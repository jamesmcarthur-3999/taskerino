/**
 * CanvasActionToolbar - Interactive Component
 *
 * Grouped action buttons with optional sticky positioning.
 */

import React from 'react';
import type { ActionToolbarProps } from '../types';
import { CanvasButton } from './CanvasButton';

export function CanvasActionToolbar({
  actions,
  layout = 'horizontal',
  spacing = 'normal',
  sticky = false,
}: ActionToolbarProps) {
  // Map spacing to gap classes
  const spacingClasses = {
    tight: 'gap-2',
    normal: 'gap-3',
    relaxed: 'gap-4',
    loose: 'gap-6',
  };

  const containerClassName = [
    'flex',
    layout === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
    spacingClasses[spacing],
    sticky ? 'sticky bottom-0 bg-white/95 backdrop-blur-lg p-4 border-t-2 border-gray-200 shadow-lg' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClassName}>
      {actions.map((action, index) => (
        <CanvasButton
          key={index}
          label={action.label}
          icon={action.icon}
          variant={action.type === 'create_task' || action.type === 'create_note' ? 'primary' : 'secondary'}
          action={action}
        />
      ))}
    </div>
  );
}
