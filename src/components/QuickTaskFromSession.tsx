import { useState, useEffect } from 'react';
import { useTasks } from '../context/TasksContext';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useUI } from '../context/UIContext';
import { X, Calendar, Flag, Zap } from 'lucide-react';
import type { Task } from '../types';
import { EntityType, RelationshipType } from '../types/relationships';
import { generateId } from '../utils/helpers';
import { getGlassClasses, getRadiusClass, MODAL_SECTIONS } from '../design-system/theme';

interface QuickTaskFromSessionProps {
  isOpen: boolean;
  onClose: () => void;
  suggestedAction: string;
  sessionId: string;
  sessionName: string;
  screenshotId?: string;
  suggestedPriority?: Task['priority'];
  suggestedContext?: string;
}

export function QuickTaskFromSession({
  isOpen,
  onClose,
  suggestedAction,
  sessionId,
  sessionName,
  screenshotId,
  suggestedPriority,
  suggestedContext,
}: QuickTaskFromSessionProps) {
  const { addTask } = useTasks();
  const { addExtractedTask } = useActiveSession();
  const { addNotification } = useUI();
  const [title, setTitle] = useState(suggestedAction);
  const [priority, setPriority] = useState<Task['priority']>(suggestedPriority || 'medium');
  const [dueDate, setDueDate] = useState<string>('');
  const [description, setDescription] = useState(suggestedContext || '');

  // Sync state with prop when modal opens or suggestedAction changes
  useEffect(() => {
    if (isOpen) {
      setTitle(suggestedAction);
      setPriority(suggestedPriority || 'medium');
      setDueDate('');
      setDescription(suggestedContext || '');
    }
  }, [isOpen, suggestedAction, suggestedPriority, suggestedContext]);

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!title.trim()) return;

    const taskId = generateId();
    const now = new Date().toISOString();
    const newTask: Task = {
      id: taskId,
      relationships: [
        {
          id: generateId(),
          sourceType: EntityType.TASK,
          sourceId: taskId,
          targetType: EntityType.SESSION,
          targetId: sessionId,
          type: RelationshipType.TASK_SESSION,
          canonical: true,
          metadata: { source: 'ai' as const, createdAt: now },
        },
      ],
      title: title.trim(),
      done: false,
      priority,
      dueDate: dueDate || undefined,
      status: 'todo',
      createdBy: 'ai', // AI-suggested from session analysis
      createdAt: now,

      // Rich context for AI agents
      description: description.trim() || `Extracted from session: ${sessionName}`,

      // Tags from session
      tags: [],
    };

    addTask(newTask);

    // Add task ID to session's extractedTaskIds
    addExtractedTask(newTask.id);

    addNotification({
      type: 'success',
      title: 'Task Created',
      message: `Task added from session "${sessionName}"`,
    });

    handleClose();
  };

  const handleClose = () => {
    setTitle(suggestedAction);
    setPriority(suggestedPriority || 'medium');
    setDueDate('');
    setDescription(suggestedContext || '');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCreate();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className={`${getGlassClasses('strong')} ${getRadiusClass('modal')} max-w-xl w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${MODAL_SECTIONS.header} bg-gradient-to-r from-purple-500/10 to-cyan-500/10`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-2">
                <Zap className="w-6 h-6 text-purple-600" />
                Add Task from Session
              </h2>
              <p className="text-sm text-gray-600 mt-1">From: {sessionName}</p>
            </div>
            <button
              onClick={handleClose}
              className={`p-2 ${getGlassClasses('medium')} hover:${getGlassClasses('extra-strong')} rounded-xl transition-all duration-300 hover:scale-110 active:scale-95`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Title
            </label>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              className={`w-full px-4 py-3 ${getGlassClasses('medium')} ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all resize-none`}
              autoFocus
            />
          </div>

          {/* Description/Context */}
          {description && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Context
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={`w-full px-4 py-3 ${getGlassClasses('medium')} ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all resize-none`}
              />
            </div>
          )}

          {/* Grid: Priority and Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <Flag className="w-4 h-4" />
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task['priority'])}
                className={`w-full px-3 py-2 ${getGlassClasses('medium')} ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full px-3 py-2 ${getGlassClasses('medium')} ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all`}
              />
            </div>
          </div>

          {/* Info */}
          <div className={`bg-purple-50/50 backdrop-blur-sm border border-purple-200/50 ${getRadiusClass('field')} p-3`}>
            <p className="text-xs text-purple-700">
              <span className="font-semibold">💡 Context preserved:</span> This task will link back to the session and screenshot where it was suggested.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`${MODAL_SECTIONS.footer} flex items-center justify-between`}>
          <p className="text-sm text-gray-600">
            Press <kbd className={`px-2 py-1 ${getGlassClasses('medium')} rounded text-xs font-mono`}>⌘↵</kbd> to create
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className={`px-4 py-2 text-gray-700 ${getGlassClasses('medium')} hover:${getGlassClasses('extra-strong')} rounded-xl transition-all duration-300 hover:scale-105 active:scale-95`}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim()}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-xl hover:shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-purple-200/50"
            >
              Create Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
