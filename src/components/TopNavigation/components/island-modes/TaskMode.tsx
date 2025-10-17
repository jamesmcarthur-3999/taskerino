/**
 * TaskMode Component
 *
 * Quick task creation mode for the navigation island
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from 'lucide-react';
import type { TaskModeProps } from '../../types';
import { getRadiusClass } from '../../../../design-system/theme';
import { modeContentVariants, contentSpring } from '../../utils/islandAnimations';
import { useReducedMotion } from '../../../../lib/animations';

export function TaskMode({
  taskTitle,
  taskDueDate,
  showSuccess,
  onTaskTitleChange,
  onTaskDueDateChange,
  onCreateTask,
  onViewTask,
  onClose,
}: TaskModeProps) {
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isDateFocused, setIsDateFocused] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={modeContentVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
      className="px-6 pb-5 pt-4"
    >
      <AnimatePresence mode="wait">
        {!showSuccess ? (
          <div key="task-form" className="space-y-3">
          {/* Task Title Input with Focus Glow */}
          <div className="relative">
            <AnimatePresence>
              {isTitleFocused && (
                <motion.div
                  className="absolute inset-0 bg-cyan-400/10 rounded-xl pointer-events-none"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </AnimatePresence>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => onTaskTitleChange(e.target.value)}
              onFocus={() => setIsTitleFocused(true)}
              onBlur={() => setIsTitleFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && taskTitle.trim()) onCreateTask();
                if (e.key === 'Escape') onClose();
              }}
              placeholder="What needs to be done?"
              className={`relative w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-white/50 ${getRadiusClass('element')} focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:bg-white/80 transition-all placeholder-gray-400`}
              autoFocus
            />
          </div>

          {/* Date Input with Focus Glow */}
          <div className="relative flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500 ml-1 z-10" />
            <div className="relative flex-1">
              <AnimatePresence>
                {isDateFocused && (
                  <motion.div
                    className="absolute inset-0 bg-cyan-400/10 rounded-xl pointer-events-none"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </AnimatePresence>
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => onTaskDueDateChange(e.target.value)}
                onFocus={() => setIsDateFocused(true)}
                onBlur={() => setIsDateFocused(false)}
                className={`relative w-full px-3 py-2 bg-white/60 backdrop-blur-sm border-2 border-white/50 ${getRadiusClass('element')} focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:bg-white/80 transition-all text-sm`}
              />
            </div>
          </div>

          {taskTitle.trim() && (
            <motion.button
              onClick={onCreateTask}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onCreateTask();
                }
              }}
              className={`w-full px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white ${getRadiusClass('field')} font-bold hover:shadow-xl transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600`}
              whileHover={!prefersReducedMotion ? { scale: 1.02 } : undefined}
              whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
              transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            >
              Create Task
            </motion.button>
          )}
          </div>
        ) : (
          <motion.div
            key="success-state"
            className="text-center py-3"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : {
            type: 'spring',
            stiffness: 260,
            damping: 15,
            mass: 0.6
          }}
        >
          {/* Celebration Animation */}
          <motion.div
            className="text-3xl mb-2"
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0, rotate: -180 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, rotate: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : {
              type: 'spring',
              stiffness: 200,
              damping: 10,
              delay: 0.1
            }}
          >
            ✅
          </motion.div>
          <motion.p
            className="text-sm font-semibold text-gray-700 mb-3"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.2 }}
          >
            Task Created
          </motion.p>
          <motion.div
            className="flex gap-2"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.3 }}
          >
            <motion.button
              onClick={onViewTask}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onViewTask();
                }
              }}
              className={`flex-1 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white ${getRadiusClass('element')} text-sm font-semibold hover:shadow-lg transition-all`}
              whileHover={!prefersReducedMotion ? { scale: 1.02 } : undefined}
              whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
              transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
            >
              View
            </motion.button>
            <motion.button
              onClick={onClose}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClose();
                }
              }}
              className={`flex-1 px-3 py-2 bg-white/60 hover:bg-white/80 text-gray-700 ${getRadiusClass('element')} text-sm font-semibold transition-all`}
              whileHover={!prefersReducedMotion ? { scale: 1.02 } : undefined}
              whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
              transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
            >
              Done
            </motion.button>
          </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
