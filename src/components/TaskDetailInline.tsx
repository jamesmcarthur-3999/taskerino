import { useState, useEffect } from 'react';
import { useTasks } from '../context/TasksContext';
import { useNotes } from '../context/NotesContext';
import { useUI } from '../context/UIContext';
import { Calendar, Clock, CheckSquare, Circle, Plus, X, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Task, SubTask } from '../types';
import { formatRelativeTime, isTaskOverdue, isTaskDueToday, generateId } from '../utils/helpers';
import { getRadiusClass } from '../design-system/theme';

interface TaskDetailInlineProps {
  taskId: string;
  onClose?: () => void;
}

export function TaskDetailInline({ taskId, onClose }: TaskDetailInlineProps) {
  const { state: tasksState, dispatch: tasksDispatch } = useTasks();
  const { state: notesState } = useNotes();
  const { dispatch: uiDispatch } = useUI();
  const task = tasksState.tasks.find(t => t.id === taskId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [status, setStatus] = useState<Task['status']>('todo');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

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
    }
  }, [task]);

  useEffect(() => {
    if (!task) return;

    const hasChanges =
      title !== task.title ||
      description !== (task.description || '') ||
      priority !== task.priority ||
      status !== task.status ||
      dueDate !== (task.dueDate || '') ||
      dueTime !== (task.dueTime || '') ||
      JSON.stringify(tags) !== JSON.stringify(task.tags || []) ||
      JSON.stringify(subtasks) !== JSON.stringify(task.subtasks || []);

    if (hasChanges) {
      setSaveStatus('unsaved');
      const timer = setTimeout(() => {
        setSaveStatus('saving');
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
        setTimeout(() => setSaveStatus('saved'), 500);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [title, description, priority, status, dueDate, dueTime, tags, subtasks, task, tasksDispatch]);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
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

  const handleDelete = () => {
    if (confirm('Delete this task?')) {
      tasksDispatch({ type: 'DELETE_TASK', payload: taskId });
    }
  };

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Task not found</p>
        </div>
      </div>
    );
  }

  const isOverdue = isTaskOverdue(task);
  const isDueToday = isTaskDueToday(task);
  const completedSubtasks = subtasks.filter(st => st.done).length;
  const totalSubtasks = subtasks.length;
  const progress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  const getStatusIcon = (s: Task['status']) => {
    switch (s) {
      case 'done': return <CheckCircle2 className="w-5 h-5" />;
      case 'in-progress': return <Clock className="w-5 h-5" />;
      case 'blocked': return <AlertCircle className="w-5 h-5" />;
      case 'todo': return <Circle className="w-5 h-5" />;
    }
  };

  return (
    <div className="h-full overflow-y-auto relative">
      {/* Main Content Area */}
      <div className="px-8 py-6 max-w-5xl mx-auto space-y-4">
        {/* Close Button - Top Right */}
        {onClose && (
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 p-2 hover:bg-white/60 ${getRadiusClass('element')} transition-all hover:scale-105 active:scale-95 z-10`}
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        )}

        {/* Metadata Pills - Inline at Top */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Status */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Task['status'])}
            className={`inline-flex items-center gap-1 font-medium ${getRadiusClass('element')} px-2 py-1 border transition-all ${
              status === 'done' ? 'text-green-700 bg-green-50 border-green-200' :
              status === 'in-progress' ? 'text-cyan-700 bg-cyan-50 border-cyan-200' :
              status === 'blocked' ? 'text-red-700 bg-red-50 border-red-200' :
              'text-gray-700 bg-gray-100 border-gray-200'
            }`}
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
            className={`inline-flex items-center gap-1 font-medium ${getRadiusClass('element')} px-2 py-1 border transition-all ${
              priority === 'urgent' ? 'text-red-700 bg-red-50 border-red-200' :
              priority === 'high' ? 'text-orange-700 bg-orange-50 border-orange-200' :
              priority === 'medium' ? 'text-yellow-700 bg-yellow-50 border-yellow-200' :
              'text-blue-700 bg-blue-50 border-blue-200'
            }`}
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
            <option value="urgent">Urgent</option>
          </select>

          {/* Created */}
          <span className={`inline-flex items-center gap-1 font-medium text-gray-700 bg-gray-100 border border-gray-200 ${getRadiusClass('element')} px-2 py-1`}>
            <Clock className="w-3 h-3" />
            <span>Created {formatRelativeTime(task.createdAt)}</span>
          </span>

          {/* Completed */}
          {task.completedAt && (
            <span className={`inline-flex items-center gap-1 font-medium text-green-700 bg-green-100 border border-green-200 ${getRadiusClass('element')} px-2 py-1`}>
              <CheckCircle2 className="w-3 h-3" />
              <span>Completed {formatRelativeTime(task.completedAt)}</span>
            </span>
          )}

          {/* Save Status */}
          <span className={`inline-flex items-center gap-1 font-medium ${getRadiusClass('element')} px-2 py-1 ml-auto ${
            saveStatus === 'saved' ? 'text-green-700 bg-green-50' :
            saveStatus === 'saving' ? 'text-blue-700 bg-blue-50' :
            'text-gray-700 bg-gray-50'
          }`}>
            {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? '⋯ Saving' : '● Unsaved'}
          </span>

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            className={`inline-flex items-center gap-1 font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 ${getRadiusClass('element')} px-2 py-1 transition-all`}
            title="Delete task"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Task Title - Large, Editable */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-3xl font-bold text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-0 w-full placeholder-gray-300"
            placeholder="Task title..."
          />
        </div>

        {/* Due Date & Time */}
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

        {/* Progress Bar (if subtasks exist) */}
        {totalSubtasks > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Progress</span>
              <span>{completedSubtasks}/{totalSubtasks} subtasks</span>
            </div>
            <div className={`h-2 bg-gray-100 ${getRadiusClass('element')} overflow-hidden`}>
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className={`w-full px-4 py-3 text-sm text-gray-700 bg-white/60 backdrop-blur-sm border-2 border-white/60 ${getRadiusClass('field')} focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 transition-all resize-none`}
            placeholder="Add task description..."
          />
        </div>

        {/* Subtasks */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Subtasks
          </label>
          <div className="space-y-2">
            {subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className={`flex items-center gap-2 p-2 bg-white/60 backdrop-blur-sm ${getRadiusClass('element')} border border-white/60 group hover:border-cyan-200 transition-all`}
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
                <span className={`flex-1 text-sm ${subtask.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
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
                className={`flex-1 px-3 py-2 text-sm bg-white/60 backdrop-blur-sm border-2 border-white/60 ${getRadiusClass('element')} focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 transition-all`}
              />
              <button
                onClick={handleAddSubtask}
                disabled={!newSubtask.trim()}
                className={`px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white ${getRadiusClass('element')} hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 px-2.5 py-1 bg-violet-100 text-violet-700 ${getRadiusClass('element')} text-xs font-medium`}
              >
                #{tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-violet-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Add a tag..."
              className={`flex-1 px-3 py-2 text-sm bg-white/60 backdrop-blur-sm border-2 border-white/60 ${getRadiusClass('element')} focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 transition-all`}
            />
            <button
              onClick={handleAddTag}
              disabled={!newTag.trim()}
              className={`px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white ${getRadiusClass('element')} hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* AI Context (if present) */}
        {task.aiContext && (
          <div className={`p-4 bg-purple-50/60 backdrop-blur-sm border border-purple-200 ${getRadiusClass('field')}`}>
            <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">
              AI Context
            </div>
            <div className="text-sm text-purple-900 space-y-1">
              {task.aiContext.extractedFrom && (
                <p className="italic">"{task.aiContext.extractedFrom}"</p>
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
                  className="text-xs text-purple-600 hover:text-purple-800 underline"
                >
                  View source note
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
