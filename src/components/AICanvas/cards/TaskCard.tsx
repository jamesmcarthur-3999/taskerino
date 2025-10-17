/**
 * Task Card Component
 *
 * Glass card with cyan left border for displaying AI-suggested tasks
 */

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';

export interface TaskCardProps {
  task: {
    title: string;
    context: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  };
  onAddToTasks?: () => void;
  theme?: ThemeConfig;
}

interface ThemeConfig {
  colorScheme?: 'ocean' | 'sunset' | 'forest' | 'lavender' | 'monochrome';
  mode?: 'light' | 'dark';
  primaryColor?: string;
}

export function TaskCard({
  task,
  onAddToTasks,
  theme,
}: TaskCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Priority badge styles
  const priorityStyles = {
    urgent: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'Urgent',
    },
    high: {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      label: 'High',
    },
    medium: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      label: 'Medium',
    },
    low: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      label: 'Low',
    },
  };

  const priorityStyle = priorityStyles[task.priority];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 border-l-4 border-cyan-500 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default relative overflow-hidden`}
    >
      {/* Content */}
      <div className="space-y-2">
        {/* Priority Badge */}
        <div className="flex items-center justify-between">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorityStyle.bg} ${priorityStyle.text}`}>
            {priorityStyle.label}
          </span>
        </div>

        {/* Task Title */}
        <h3 className="text-gray-900 font-bold leading-snug">
          {task.title}
        </h3>

        {/* Context */}
        <p className="text-sm text-gray-700 leading-relaxed">
          {task.context}
        </p>
      </div>

      {/* Add Button (appears on hover) */}
      {onAddToTasks && (
        <motion.button
          initial={{ opacity: 0, y: 5 }}
          animate={{
            opacity: isHovered ? 1 : 0,
            y: isHovered ? 0 : 5,
          }}
          transition={{ duration: 0.2 }}
          onClick={onAddToTasks}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-md transition-all duration-200 text-sm font-semibold"
        >
          <Plus size={16} />
          Add to Tasks
        </motion.button>
      )}
    </motion.div>
  );
}
