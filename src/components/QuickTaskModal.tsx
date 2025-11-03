import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../context/UIContext';
import { useEntities } from '../context/EntitiesContext';
import { useTasks } from '../context/TasksContext';
import { X, Calendar, Flag, Tag, Folder } from 'lucide-react';
import type { Task } from '../types';
import { useTheme } from '../context/ThemeContext';
import { getModalClasses, getModalHeaderClasses, getInputContainerClasses, MODAL_SECTIONS } from '../design-system/theme';
import { Button } from './Button';
import { generateId } from '../utils/helpers';
import {
  modalBackdropVariants,
  modalFormVariants,
  modalStaggerContainerVariants,
  modalSectionVariants
} from '../animations/variants';

export function QuickTaskModal() {
  const { state: uiState, dispatch: uiDispatch, addNotification } = useUI();
  const { state: entitiesState } = useEntities();
  const { addTask } = useTasks();
  const { colorScheme, glassStrength } = useTheme();
  const [input, setInput] = useState('');
  const [parsedTask, setParsedTask] = useState<Partial<Task>>({
    title: '',
    priority: 'medium',
    tags: [],
  });

  const handleClose = () => {
    uiDispatch({ type: 'TOGGLE_QUICK_CAPTURE' });
    setInput('');
    setParsedTask({ title: '', priority: 'medium', tags: [] });
  };

  const parseInput = (text: string) => {
    let title = text;
    let dueDate: string | undefined;
    let priority: Task['priority'] = 'medium';
    const tags: string[] = [];

    // Extract priority (@high, @urgent, @low, @medium)
    const priorityMatch = text.match(/@(urgent|high|medium|low)/i);
    if (priorityMatch) {
      priority = priorityMatch[1].toLowerCase() as Task['priority'];
      title = title.replace(priorityMatch[0], '').trim();
    }

    // Extract tags (#tag)
    const tagMatches = text.matchAll(/#(\w+)/g);
    for (const match of tagMatches) {
      tags.push(match[1]);
      title = title.replace(match[0], '').trim();
    }

    // Extract date keywords
    const today = new Date();
    const datePatterns = [
      { pattern: /\btomorrow\b/i, getDays: () => 1 },
      { pattern: /\btoday\b/i, getDays: () => 0 },
      { pattern: /\bnext week\b/i, getDays: () => 7 },
      { pattern: /\bin (\d+) days?\b/i, getDays: (match: RegExpMatchArray) => parseInt(match[1]) },
    ];

    for (const { pattern, getDays } of datePatterns) {
      const match = title.match(pattern);
      if (match) {
        const days = getDays(match);
        const date = new Date(today);
        date.setDate(date.getDate() + days);
        dueDate = date.toISOString().split('T')[0];
        title = title.replace(match[0], '').trim();
        break;
      }
    }

    setParsedTask({
      title: title || text,
      dueDate,
      priority,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  const handleInputChange = (text: string) => {
    setInput(text);
    parseInput(text);
  };

  const handleCreate = () => {
    if (!parsedTask.title?.trim()) return;

    addTask({
      id: generateId(),
      relationships: [],
      title: parsedTask.title,
      done: false,
      priority: parsedTask.priority || 'medium',
      dueDate: parsedTask.dueDate,
      tags: parsedTask.tags,
      description: parsedTask.description,
      status: 'todo',
      createdBy: 'manual',
      createdAt: new Date().toISOString(),
    });

    addNotification({
      type: 'success',
      title: 'Task Created',
      message: `"${parsedTask.title}" has been added to your tasks`,
    });

    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCreate();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  const modalClasses = getModalClasses(colorScheme, glassStrength);

  return (
    <AnimatePresence>
      {uiState.quickCaptureOpen && (
        <>
          {/* Animated Backdrop */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalBackdropVariants.standard}
            className={modalClasses.overlay}
            onClick={handleClose}
          />

          {/* Animated Modal Content */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalFormVariants}
            className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-[100]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`${modalClasses.content} max-w-2xl w-full`}>
        {/* Header - Animated */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.2 }}
          className={getModalHeaderClasses(colorScheme)}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
              ⚡ Quick Add Task
            </h2>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="sm"
              className="rounded-xl p-2"
              aria-label="Close quick task modal"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>

        {/* Content - Staggered Animation */}
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={modalStaggerContainerVariants}
          className="p-6 space-y-6"
        >
          {/* Natural Language Input */}
          <motion.div variants={modalSectionVariants}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type naturally - we'll parse it for you
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., buy milk tomorrow @high #groceries"
              className="w-full px-4 py-3 bg-white/30 backdrop-blur-xl border border-white/60 rounded-[20px] focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 transition-all text-lg shadow-sm"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              Tips: Use @urgent/@high/@medium/@low for priority, #tags for categories, "tomorrow"/"today"/"in X days" for dates
            </p>
          </motion.div>

          {/* Parsed Fields (editable) - Staggered */}
          <motion.div
            variants={modalSectionVariants}
            className={`${getInputContainerClasses('highlighted')} space-y-4`}
          >
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span>📋 Parsed Task</span>
            </h3>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={parsedTask.title || ''}
                onChange={(e) => setParsedTask({ ...parsedTask, title: e.target.value })}
                className="w-full px-3 py-2 bg-white/70 backdrop-blur-xl border border-white/60 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 transition-all shadow-sm"
              />
            </div>

            {/* Grid: Due Date, Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={parsedTask.dueDate || ''}
                  onChange={(e) => setParsedTask({ ...parsedTask, dueDate: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-white/70 backdrop-blur-xl border border-white/60 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Flag className="w-4 h-4" />
                  Priority
                </label>
                <select
                  value={parsedTask.priority || 'medium'}
                  onChange={(e) => setParsedTask({ ...parsedTask, priority: e.target.value as Task['priority'] })}
                  className="w-full px-3 py-2 bg-white/70 backdrop-blur-xl border border-white/60 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 transition-all shadow-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Topic field removed - relationships managed separately */}

            {/* Tags */}
            {parsedTask.tags && parsedTask.tags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Tag className="w-4 h-4" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {parsedTask.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-medium flex items-center gap-1"
                    >
                      #{tag}
                      <button
                        onClick={() => setParsedTask({
                          ...parsedTask,
                          tags: parsedTask.tags?.filter(t => t !== tag)
                        })}
                        className="hover:text-cyan-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* Footer - Animated */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.2 }}
          className={`${MODAL_SECTIONS.footer} flex items-center justify-between`}
        >
          <p className="text-sm text-gray-600">
            Press <kbd className="px-2 py-1 bg-white/60 backdrop-blur-md border border-white/60 rounded text-xs font-mono shadow-sm">⌘↵</kbd> to create
          </p>
          <div className="flex gap-3">
            <Button
              onClick={handleClose}
              variant="secondary"
              size="md"
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!parsedTask.title?.trim()}
              variant="primary"
              size="md"
              colorScheme={colorScheme}
              className="rounded-xl"
            >
              Create Task
            </Button>
          </div>
        </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
