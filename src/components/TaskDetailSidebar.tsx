import { useState, useEffect, useMemo, useRef } from 'react';
import { useTasks } from '../context/TasksContext';
import { useNotes } from '../context/NotesContext';
import { useUI } from '../context/UIContext';
import { Calendar, Clock, Circle, Plus, X, Trash2, CheckCircle2, Settings } from 'lucide-react';
import type { Task, SubTask } from '../types';
import { formatRelativeTime, isTaskOverdue, isTaskDueToday, generateId } from '../utils/helpers';
import { InlineTagManager } from './InlineTagManager';
import { tagUtils } from '../utils/tagUtils';
import { ConfirmDialog } from './ConfirmDialog';
import {
  MODAL_OVERLAY,
  getGlassClasses,
  getRadiusClass,
  getStatusBadgeClasses,
  PRIORITY_COLORS,
  getDangerGradient,
} from '../design-system/theme';
import { useTheme } from '../context/ThemeContext';
import { RelationshipPills } from './relationships/RelationshipPills';
import { RelationshipModal } from './relationships/RelationshipModal';
import { EntityType } from '../types/relationships';

interface TaskDetailSidebarProps {
  taskId: string | undefined;
}

export function TaskDetailSidebar({ taskId }: TaskDetailSidebarProps) {
  const { state: tasksState, dispatch: tasksDispatch } = useTasks();
  const { state: notesState } = useNotes();
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const task = tasksState.tasks.find(t => t.id === taskId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [status, setStatus] = useState<Task['status']>('todo');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'saving'>('saved');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [relationshipModalOpen, setRelationshipModalOpen] = useState(false);
  const isInitialMount = useRef(true);

  // Get all available tags for suggestions
  const allTags = useMemo(() => {
    return tagUtils.getTopTags(tasksState.tasks, (task) => task.tags || [], 20);
  }, [tasksState.tasks]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setStatus(task.status);
      setDueDate(task.dueDate || '');
      setDueTime(task.dueTime || '');
      setTags(task.tags || []);
      setSubtasks(task.subtasks || []);
      isInitialMount.current = true; // Reset on task change
    }
  }, [task?.id]);

  useEffect(() => {
    if (!task || !taskId) return;

    // Skip auto-save on initial load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const hasChanges =
      title !== task.title ||
      description !== (task.description || '') ||
      priority !== task.priority ||
      status !== task.status ||
      dueDate !== (task.dueDate || '') ||
      dueTime !== (task.dueTime || '') ||
      JSON.stringify(tags) !== JSON.stringify(task.tags || []) ||
      JSON.stringify(subtasks) !== JSON.stringify(task.subtasks || []);

    if (!hasChanges) {
      setSaveStatus('idle');
      return;
    }

    setSaveStatus('saving');

    const timer = setTimeout(() => {
      tasksDispatch({
        type: 'UPDATE_TASK',
        payload: {
          ...task,
          title,
          description,
          priority,
          status,
          dueDate: dueDate || undefined,
          dueTime: dueTime || undefined,
          tags,
          subtasks,
          done: status === 'done',
          completedAt: status === 'done' && !task.completedAt ? new Date().toISOString() : task.completedAt,
        }
      });
      setSaveStatus('saved');

      // Reset to idle after showing "saved" for 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);

    return () => clearTimeout(timer);
  }, [title, description, priority, status, dueDate, dueTime, tags, subtasks, taskId, tasksDispatch]);

  if (!task || !taskId) return null;

  const handleClose = () => {
    uiDispatch({ type: 'CLOSE_SIDEBAR' });
  };

  const handleDelete = () => {
    if (!task) return;
    tasksDispatch({ type: 'DELETE_TASK', payload: task.id });
    uiDispatch({ type: 'CLOSE_SIDEBAR' });
  };

  const handleAddSubtask = () => {
    if (newSubtask.trim()) {
      const newSubtaskItem: SubTask = {
        id: generateId(),
        title: newSubtask.trim(),
        done: false,
        createdAt: new Date().toISOString(),
      };
      setSubtasks([...subtasks, newSubtaskItem]);
      setNewSubtask('');
    }
  };

  const handleToggleSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.map(st =>
      st.id === subtaskId ? { ...st, done: !st.done } : st
    ));
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.filter(st => st.id !== subtaskId));
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && uiState.sidebar.isOpen) {
        uiDispatch({ type: 'CLOSE_SIDEBAR' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiState.sidebar.isOpen, uiDispatch]);

  // Render save status indicator
  const renderSaveStatus = () => {
    if (saveStatus === 'saving') {
      return <span className="text-xs text-cyan-600 font-medium">Saving...</span>;
    }
    if (saveStatus === 'saved') {
      return <span className="text-xs text-green-600 font-medium">✓ Saved</span>;
    }
    return null;
  };

  const isOverdue = isTaskOverdue(task);
  const isDueToday = isTaskDueToday(task);
  const completedSubtasks = subtasks.filter(st => st.done).length;
  const totalSubtasks = subtasks.length;
  const progress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${MODAL_OVERLAY} z-40 transition-opacity duration-300 ${
          uiState.sidebar.isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => uiDispatch({ type: 'CLOSE_SIDEBAR' })}
      />

      {/* Modal - Beautiful Glass Sheet */}
      <div
        className={`fixed top-0 right-0 h-screen w-[35%] z-50 transition-transform duration-300 ease-out ${
          uiState.sidebar.isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className={`h-full ${getGlassClasses('extra-strong')} border-l border-white/40 shadow-2xl flex flex-col overflow-hidden`}>
          {/* Header Section - Glass Morphism */}
          <div className={`flex-shrink-0 ${getGlassClasses('medium')} border-b border-gray-200/50 px-6 py-5`}>
            {/* Close Button - Top Right */}
            <button
              onClick={() => uiDispatch({ type: 'CLOSE_SIDEBAR' })}
              className={`absolute top-6 right-6 p-2 hover:bg-white/80 ${getRadiusClass('field')} transition-all hover:scale-105 active:scale-95 z-10`}
              aria-label="Close"
              title="Close (Esc)"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            {/* Metadata Row: Status, Priority, Timestamps, Save Status */}
            <div className="flex items-center justify-between gap-2 mb-2 pr-12">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Status */}
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Task['status'])}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium shadow-sm transition-all ${getStatusBadgeClasses(status as any)}`}
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>

                {/* Priority */}
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Task['priority'])}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium shadow-sm transition-all ${
                    PRIORITY_COLORS[priority === 'urgent' ? 'critical' : priority === 'high' ? 'important' : priority === 'medium' ? 'normal' : 'low']?.bg || 'bg-gray-100'
                  } ${
                    PRIORITY_COLORS[priority === 'urgent' ? 'critical' : priority === 'high' ? 'important' : priority === 'medium' ? 'normal' : 'low']?.text || 'text-gray-700'
                  } border ${
                    PRIORITY_COLORS[priority === 'urgent' ? 'critical' : priority === 'high' ? 'important' : priority === 'medium' ? 'normal' : 'low']?.border || 'border-gray-300'
                  }`}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>

                {/* Created */}
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/60 text-gray-600 font-medium shadow-sm">
                  Created {formatRelativeTime(task.createdAt)}
                </span>

                {/* Completed */}
                {task.completedAt && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-green-100/80 text-green-700 font-medium shadow-sm">
                    ✓ Completed {formatRelativeTime(task.completedAt)}
                  </span>
                )}
              </div>

              {/* Save status - Top Right */}
              {renderSaveStatus()}
            </div>

            {/* Task Title - Large and editable */}
            <div className="mb-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-3xl font-bold text-gray-900 w-full border-b-2 border-transparent hover:border-cyan-300 focus:border-cyan-500 focus:outline-none pb-2 bg-transparent transition-all"
                placeholder="Task title..."
              />
            </div>

            {/* Tags - Inline Manager */}
            <div className="mb-0">
              <InlineTagManager
                tags={tags}
                onTagsChange={setTags}
                allTags={allTags}
                editable={true}
                className="min-h-[32px]"
              />
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Due Date & Time */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Due Date</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={`px-3 py-1.5 text-sm ${getRadiusClass('element')} border transition-all ${
                      isOverdue ? 'border-red-300 bg-red-50 text-red-700' :
                      isDueToday ? 'border-cyan-300 bg-cyan-50 text-cyan-700' :
                      'border-gray-200 bg-white'
                    }`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className={`px-3 py-1.5 text-sm ${getRadiusClass('element')} border border-gray-200 bg-white`}
                  />
                </div>
                {dueDate && (
                  <button
                    onClick={() => {
                      setDueDate('');
                      setDueTime('');
                    }}
                    className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar (if subtasks exist) */}
            {totalSubtasks > 0 && (
              <div className={`bg-gradient-to-r from-cyan-50 to-blue-50 ${getRadiusClass('field')} border border-gray-200/60 p-4 shadow-sm`}>
                <div className="flex items-center justify-between text-xs text-gray-700 mb-2 font-semibold">
                  <span>Progress</span>
                  <span>{completedSubtasks}/{totalSubtasks} subtasks</span>
                </div>
                <div className={`h-2.5 bg-white ${getRadiusClass('pill')} overflow-hidden border border-gray-200`}>
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</h3>
              <div className={`bg-white/90 ${getRadiusClass('card')} border border-gray-200/60 shadow-sm hover:border-cyan-300 transition-all`}>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 text-sm text-gray-900 bg-transparent focus:outline-none resize-none"
                  placeholder="Add task description..."
                />
              </div>
            </div>

            {/* Subtasks */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Subtasks</h3>
              <div className="space-y-2">
                {subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className={`flex items-center gap-2 p-3 bg-white/90 ${getRadiusClass('field')} border border-gray-200/60 group hover:border-cyan-300 transition-all shadow-sm`}
                  >
                    <button
                      onClick={() => handleToggleSubtask(subtask.id)}
                      className="flex-shrink-0"
                    >
                      {subtask.done ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${subtask.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {subtask.title}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(subtask.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                    }}
                    placeholder="Add a subtask..."
                    className={`flex-1 px-3 py-2 text-sm bg-white/90 border border-gray-200/60 ${getRadiusClass('field')} focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 transition-all focus:outline-none`}
                  />
                  <button
                    onClick={handleAddSubtask}
                    disabled={!newSubtask.trim()}
                    className={`px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white ${getRadiusClass('element')} hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Relationships Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Relationships</h3>
                <button
                  onClick={() => setRelationshipModalOpen(true)}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
                >
                  <Settings className="w-4 h-4" />
                  Manage
                </button>
              </div>

              <RelationshipPills
                entityId={task.id}
                entityType={EntityType.TASK}
                maxVisible={5}
                showRemoveButton={true}
                onPillClick={() => setRelationshipModalOpen(true)}
              />
            </div>

            {/* AI Context (if present) */}
            {task.aiContext && (
              <div className={`bg-gradient-to-br from-purple-50 to-violet-50 ${getRadiusClass('card')} border border-purple-200/60 p-4 shadow-sm`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-sm font-bold text-purple-900 uppercase tracking-wide">AI Context</div>
                </div>
                <div className="text-sm text-purple-900 space-y-2">
                  {task.aiContext.extractedFrom && (
                    <p className="italic text-purple-700">"{task.aiContext.extractedFrom}"</p>
                  )}
                  {task.aiContext.reasoning && (
                    <p className="text-xs text-purple-600">{task.aiContext.reasoning}</p>
                  )}
                  {task.aiContext.sourceNoteId && (
                    <button
                      onClick={() => {
                        const note = notesState.notes.find(n => n.id === task.aiContext?.sourceNoteId);
                        if (note) {
                          uiDispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'note', itemId: note.id, label: note.summary } });
                        }
                      }}
                      className="text-xs text-purple-600 hover:text-purple-800 underline font-semibold"
                    >
                      View source note
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Bottom padding for comfortable scrolling */}
            <div className="h-4" />
          </div>

          {/* Footer Actions - Glass Effect */}
          <div className={`flex-shrink-0 ${getGlassClasses('medium')} border-t border-gray-200/50 p-4 flex gap-2`}>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className={`px-4 py-2 ${getDangerGradient('light').container} hover:bg-red-200 ${getRadiusClass('pill')} border-2 hover:scale-105 active:scale-95 transition-all text-red-700 font-semibold text-sm flex items-center gap-2 shadow-md`}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>

            <button
              onClick={() => uiDispatch({ type: 'CLOSE_SIDEBAR' })}
              className={`flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white ${getRadiusClass('pill')} shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all font-semibold text-sm`}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Task?"
        message="This will permanently delete this task. This action cannot be undone."
        confirmLabel="Delete Task"
        variant="danger"
      />

      {/* Relationship Modal */}
      <RelationshipModal
        open={relationshipModalOpen}
        onClose={() => setRelationshipModalOpen(false)}
        entityId={task.id}
        entityType={EntityType.TASK}
      />
    </>
  );
}
