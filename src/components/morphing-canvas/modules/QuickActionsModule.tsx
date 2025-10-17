/**
 * Quick Actions Module
 *
 * Displays a grid of quick action buttons
 */

import type { LucideIcon } from 'lucide-react';
import { Plus, FileText, Calendar, Clock, Settings } from 'lucide-react';
import type { ModuleProps, ModuleAction } from '../types';
import { motion } from 'framer-motion';
import { springPresets } from '../animations/transitions';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color?: string;
  action: string;
}

interface QuickActionsSettings {
  actions?: QuickAction[];
  columns?: number;
}

const iconMap: Record<string, LucideIcon> = {
  plus: Plus,
  fileText: FileText,
  calendar: Calendar,
  clock: Clock,
  settings: Settings,
};

const defaultActions: QuickAction[] = [
  { id: '1', label: 'New Task', icon: 'plus', color: 'blue', action: 'create-task' },
  { id: '2', label: 'New Note', icon: 'fileText', color: 'green', action: 'create-note' },
  { id: '3', label: 'Schedule', icon: 'calendar', color: 'purple', action: 'open-calendar' },
  { id: '4', label: 'Timer', icon: 'clock', color: 'orange', action: 'start-timer' },
];

export function QuickActionsModule({ config, onAction }: ModuleProps) {
  const settings = (config.settings || {}) as QuickActionsSettings;
  const actions = settings.actions || defaultActions;
  const columns = settings.columns || 2;

  const handleActionClick = (action: QuickAction) => {
    if (onAction) {
      onAction({
        type: 'quick-action',
        payload: { actionId: action.id, action: action.action },
        moduleId: config.id,
      });
    }
  };

  const getColorClasses = (color?: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-500 hover:bg-blue-600',
      green: 'bg-green-500 hover:bg-green-600',
      purple: 'bg-purple-500 hover:bg-purple-600',
      orange: 'bg-orange-500 hover:bg-orange-600',
      red: 'bg-red-500 hover:bg-red-600',
    };

    return colorMap[color || 'blue'] || colorMap.blue;
  };

  return (
    <div className="p-6">
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {actions.map((action, index) => {
          const Icon = iconMap[action.icon] || Plus;

          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                ...springPresets.gentle,
                delay: index * 0.05,
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleActionClick(action)}
              className={`
                ${getColorClasses(action.color)}
                text-white rounded-card p-6
                flex flex-col items-center justify-center gap-3
                transition-colors duration-200
                shadow-lg hover:shadow-xl
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
              `}
            >
              <Icon className="w-8 h-8" />
              <span className="text-sm font-medium">{action.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

QuickActionsModule.displayName = 'QuickActionsModule';
