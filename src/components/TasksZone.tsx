import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
  Rows3,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { Task } from '../types';
import {
  formatRelativeTime,
  isTaskOverdue,
  isTaskDueToday,
} from '../utils/helpers';
import { TaskTableView } from './TaskTableView';

export function TasksZone() {
  const { state, dispatch } = useApp();

  // UI State
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [selectedTaskIdForInline, setSelectedTaskIdForInline] = useState<string | undefined>();
  const [groupBy, setGroupBy] = useState<'due-date' | 'status' | 'priority' | 'topic' | 'tag' | 'none'>('due-date');
  const [showFilters, setShowFilters] = useState(false);

  // Filter State
  const [showCompleted, setShowCompleted] = useState(true);
  const [filterPriority, setFilterPriority] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
  const [filterDueDate, setFilterDueDate] = useState<'all' | 'overdue' | 'today' | 'week'>('all');

  // Apply filters
  const displayedTasks = state.tasks.filter(task => {
    // Completed filter
    if (!showCompleted && task.done) return false;

    // Priority filter
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;

    // Due date filter
    if (filterDueDate === 'overdue' && !isTaskOverdue(task)) return false;
    if (filterDueDate === 'today' && !isTaskDueToday(task)) return false;
    if (filterDueDate === 'week' && !task.dueDate) return false;
    if (filterDueDate === 'week') {
      const today = new Date();
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const taskDate = new Date(task.dueDate!);
      if (taskDate > weekFromNow) return false;
    }

    return true;
  });


  const handleToggleTask = (taskId: string) => {
    dispatch({ type: 'TOGGLE_TASK', payload: taskId });
  };

  const handleSelectTask = (taskId: string) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
      dispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'task', itemId: taskId, label: task.title } });
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'in-progress': return <Clock className="w-5 h-5 text-cyan-600" />;
      case 'blocked': return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'todo': return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  // Kanban Components
  const KanbanColumn = ({
    title,
    status,
    tasks,
    onToggle,
    onSelect
  }: {
    title: string;
    status: Task['status'];
    tasks: Task[];
    onToggle: (id: string) => void;
    onSelect: (id: string) => void;
  }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const topic = (task: Task) => state.topics.find(t => t.id === task.topicId);

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    };

    const handleDragLeave = () => {
      setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const taskId = e.dataTransfer.getData('taskId');
      const task = state.tasks.find(t => t.id === taskId);

      if (task && task.status !== status) {
        dispatch({
          type: 'UPDATE_TASK',
          payload: {
            ...task,
            status: status,
            done: status === 'done',
            completedAt: status === 'done' ? new Date().toISOString() : task.completedAt
          }
        });
      }
    };

    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-white/70 backdrop-blur-2xl rounded-2xl border-2 overflow-hidden flex flex-col h-full transition-all duration-300 shadow-lg hover:shadow-xl ${
          isDragOver ? 'border-cyan-400/80 bg-cyan-50/30 shadow-2xl scale-[1.02]' : 'border-white/60 hover:border-cyan-200/60'
        }`}
        style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <div className="px-3 py-2.5 border-b border-white/60 bg-white/30 backdrop-blur-sm">
          <h3 className="font-semibold text-sm text-gray-900 flex items-center justify-between">
            <span>{title}</span>
            <span className="text-xs text-gray-500 font-medium">({tasks.length})</span>
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {tasks.map(task => {
            const taskTopic = topic(task);
            const isOverdue = isTaskOverdue(task);
            const isDueToday = isTaskDueToday(task);
            const isUrgent = task.priority === 'urgent' || task.priority === 'high';

            return (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('taskId', task.id);
                }}
                onClick={() => onSelect(task.id)}
                className={`group relative bg-white/70 backdrop-blur-lg rounded-xl p-2 shadow-sm cursor-grab active:cursor-grabbing border transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-95 ${
                  isOverdue ? 'border-red-200/60 hover:border-red-300/80 hover:shadow-red-100/30' :
                  isDueToday ? 'border-cyan-200/60 hover:border-cyan-300/80 hover:shadow-cyan-100/30' :
                  'border-white/60 hover:border-cyan-300/60 hover:shadow-cyan-100/20'
                }`}
                style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              >
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 transition-opacity duration-300 pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-start gap-2 mb-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle(task.id);
                      }}
                      className="mt-0.5 transition-transform duration-200 hover:scale-110"
                    >
                      {getStatusIcon(task.status)}
                    </button>
                    <h4 className={`text-sm font-semibold flex-1 leading-tight ${
                      task.done ? 'line-through opacity-50 text-gray-500' :
                      isOverdue ? 'text-red-700' :
                      isDueToday ? 'text-cyan-700' :
                      'text-gray-900'
                    }`}>
                      {task.title}
                    </h4>
                  </div>
                  <div className="flex flex-col gap-1 text-[11px] text-gray-500 mt-1.5">
                    {task.dueDate && (
                      <div className={`flex items-center gap-1 ${
                        isOverdue ? 'text-red-600 font-semibold' :
                        isDueToday ? 'text-cyan-600 font-semibold' :
                        'text-gray-500'
                      }`}>
                        <Calendar className="w-3 h-3" />
                        {formatRelativeTime(task.dueDate)}
                      </div>
                    )}
                    {taskTopic && (
                      <div className="text-gray-400 truncate">{taskTopic.name}</div>
                    )}
                    {isUrgent && !task.done && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold inline-block w-fit ${
                        task.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {task.priority.toUpperCase()}
                      </span>
                    )}
                    {task.subtasks && task.subtasks.length > 0 && (
                      <div className="text-[10px] text-gray-400">
                        {task.subtasks.filter(st => st.done).length}/{task.subtasks.length} done
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-xs">
              Drop tasks here
            </div>
          )}
        </div>
      </div>
    );
  };

  // Table View (NEW DEFAULT)
  if (viewMode === 'table') {
    return (
      <div className="h-full w-full relative flex flex-col bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-teal-500/20">
        {/* Secondary animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 via-cyan-500/10 to-teal-500/10 animate-gradient-reverse pointer-events-none" />

        <div className="relative z-10 flex-1 flex flex-col pt-24 px-6 pb-6 overflow-hidden">
          {/* Header - Menu Bar */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-xl border-2 border-white/50 rounded-xl p-1.5 shadow-lg">
              {/* View Switchers */}
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md font-medium text-sm"
                title="Table view (active)"
              >
                <Rows3 className="w-4 h-4" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:bg-white/80 transition-all font-medium text-sm"
                title="Kanban board"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Kanban</span>
              </button>

              {/* Divider */}
              <div className="h-8 w-px bg-white/30"></div>

              {/* Group By Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Group:</span>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as any)}
                  className="px-3 py-1.5 text-sm font-medium bg-white/60 backdrop-blur-sm border-2 border-white/60 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 transition-all hover:bg-white/80"
                >
                  <option value="due-date">Due Date</option>
                  <option value="status">Status</option>
                  <option value="priority">Priority</option>
                  <option value="topic">Topic</option>
                  <option value="tag">Tag</option>
                  <option value="none">None</option>
                </select>
              </div>

              {/* Divider */}
              <div className="h-8 w-px bg-white/30"></div>

              {/* Filters Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  showFilters || !showCompleted || filterPriority !== 'all' || filterDueDate !== 'all'
                    ? 'bg-cyan-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-white/80'
                }`}
                title="Filter tasks"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filters</span>
                {(!showCompleted || filterPriority !== 'all' || filterDueDate !== 'all') && (
                  <span className="px-1.5 py-0.5 bg-white/30 rounded-full text-xs font-bold">
                    {[!showCompleted, filterPriority !== 'all', filterDueDate !== 'all'].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/60">
              <span>{state.tasks.length} total</span>
              <span className="text-gray-300">•</span>
              <span>{displayedTasks.length} shown</span>
            </div>
          </div>

          {/* Filters Panel */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              showFilters ? 'max-h-96 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'
            }`}
          >
            <div className="bg-white/70 backdrop-blur-xl border-2 border-white/50 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-cyan-600" />
                  Filters
                </h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-1.5 hover:bg-white/60 rounded-lg transition-all hover:scale-110"
                  title="Close filters"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Status Filter */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2.5 block">
                    Completion Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowCompleted(true)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        showCompleted
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                          : 'bg-white/60 text-gray-600 hover:bg-white/80'
                      }`}
                    >
                      All Tasks
                    </button>
                    <button
                      onClick={() => setShowCompleted(false)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        !showCompleted
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                          : 'bg-white/60 text-gray-600 hover:bg-white/80'
                      }`}
                    >
                      Active Only
                    </button>
                  </div>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2.5 block">
                    Priority Level
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={() => setFilterPriority('all')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterPriority === 'all'
                          ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-md'
                          : 'bg-white/60 text-gray-600 hover:bg-white/80'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterPriority('urgent')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterPriority === 'urgent'
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md'
                          : 'bg-white/60 text-red-600 hover:bg-red-50'
                      }`}
                    >
                      Urgent
                    </button>
                    <button
                      onClick={() => setFilterPriority('high')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterPriority === 'high'
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md'
                          : 'bg-white/60 text-orange-600 hover:bg-orange-50'
                      }`}
                    >
                      High
                    </button>
                    <button
                      onClick={() => setFilterPriority('medium')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterPriority === 'medium'
                          ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-md'
                          : 'bg-white/60 text-yellow-600 hover:bg-yellow-50'
                      }`}
                    >
                      Medium
                    </button>
                    <button
                      onClick={() => setFilterPriority('low')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterPriority === 'low'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                          : 'bg-white/60 text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      Low
                    </button>
                  </div>
                </div>

                {/* Due Date Filter */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2.5 block">
                    Due Date Range
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => setFilterDueDate('all')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterDueDate === 'all'
                          ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-md'
                          : 'bg-white/60 text-gray-600 hover:bg-white/80'
                      }`}
                    >
                      All Dates
                    </button>
                    <button
                      onClick={() => setFilterDueDate('overdue')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterDueDate === 'overdue'
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md'
                          : 'bg-white/60 text-red-600 hover:bg-red-50'
                      }`}
                    >
                      ⚠️ Overdue
                    </button>
                    <button
                      onClick={() => setFilterDueDate('today')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterDueDate === 'today'
                          ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-md'
                          : 'bg-white/60 text-cyan-600 hover:bg-cyan-50'
                      }`}
                    >
                      📅 Today
                    </button>
                    <button
                      onClick={() => setFilterDueDate('week')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterDueDate === 'week'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                          : 'bg-white/60 text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      📆 This Week
                    </button>
                  </div>
                </div>

                {/* Clear Filters */}
                {(!showCompleted || filterPriority !== 'all' || filterDueDate !== 'all') && (
                  <div className="pt-2 border-t-2 border-white/50">
                    <button
                      onClick={() => {
                        setShowCompleted(true);
                        setFilterPriority('all');
                        setFilterDueDate('all');
                      }}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-white/60 hover:bg-white/80 transition-all hover:scale-102 flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table View Component */}
          <TaskTableView
            tasks={displayedTasks}
            onTaskClick={setSelectedTaskIdForInline}
            selectedTaskId={selectedTaskIdForInline}
            groupBy={groupBy}
          />
        </div>
      </div>
    );
  }

  // Kanban View
  if (viewMode === 'kanban') {
    return (
      <div className="h-full w-full relative flex flex-col bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-teal-500/20">
        {/* Secondary animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 via-cyan-500/10 to-teal-500/10 animate-gradient-reverse pointer-events-none" />

        <div className="relative z-10 flex-1 flex flex-col pt-24 px-6 pb-6 overflow-hidden">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-xl border-2 border-white/50 rounded-xl p-1.5 shadow-lg">
              <button
                onClick={() => setViewMode('table')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:bg-white/80 transition-all font-medium text-sm"
                title="Table view"
              >
                <Rows3 className="w-4 h-4" />
                <span>Table</span>
              </button>
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md font-medium text-sm"
                title="Kanban board (active)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Kanban</span>
              </button>

              {/* Divider */}
              <div className="h-8 w-px bg-white/30"></div>

              {/* Filters Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  showFilters || !showCompleted || filterPriority !== 'all' || filterDueDate !== 'all'
                    ? 'bg-cyan-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-white/80'
                }`}
                title="Filter tasks"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filters</span>
                {(!showCompleted || filterPriority !== 'all' || filterDueDate !== 'all') && (
                  <span className="px-1.5 py-0.5 bg-white/30 rounded-full text-xs font-bold">
                    {[!showCompleted, filterPriority !== 'all', filterDueDate !== 'all'].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/60">
              <span>{state.tasks.length} total</span>
              <span className="text-gray-300">•</span>
              <span>{displayedTasks.length} shown</span>
            </div>
          </div>

          {/* Filters Panel */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              showFilters ? 'max-h-96 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'
            }`}
          >
            <div className="bg-white/70 backdrop-blur-xl border-2 border-white/50 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-cyan-600" />
                  Filters
                </h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-1.5 hover:bg-white/60 rounded-lg transition-all hover:scale-110"
                  title="Close filters"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Status Filter */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2.5 block">
                    Completion Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowCompleted(true)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        showCompleted
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                          : 'bg-white/60 text-gray-600 hover:bg-white/80'
                      }`}
                    >
                      All Tasks
                    </button>
                    <button
                      onClick={() => setShowCompleted(false)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        !showCompleted
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                          : 'bg-white/60 text-gray-600 hover:bg-white/80'
                      }`}
                    >
                      Active Only
                    </button>
                  </div>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2.5 block">
                    Priority Level
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={() => setFilterPriority('all')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterPriority === 'all'
                          ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-md'
                          : 'bg-white/60 text-gray-600 hover:bg-white/80'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterPriority('urgent')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterPriority === 'urgent'
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md'
                          : 'bg-white/60 text-red-600 hover:bg-red-50'
                      }`}
                    >
                      Urgent
                    </button>
                    <button
                      onClick={() => setFilterPriority('high')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterPriority === 'high'
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md'
                          : 'bg-white/60 text-orange-600 hover:bg-orange-50'
                      }`}
                    >
                      High
                    </button>
                    <button
                      onClick={() => setFilterPriority('medium')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterPriority === 'medium'
                          ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-md'
                          : 'bg-white/60 text-yellow-600 hover:bg-yellow-50'
                      }`}
                    >
                      Medium
                    </button>
                    <button
                      onClick={() => setFilterPriority('low')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterPriority === 'low'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                          : 'bg-white/60 text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      Low
                    </button>
                  </div>
                </div>

                {/* Due Date Filter */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2.5 block">
                    Due Date Range
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => setFilterDueDate('all')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterDueDate === 'all'
                          ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-md'
                          : 'bg-white/60 text-gray-600 hover:bg-white/80'
                      }`}
                    >
                      All Dates
                    </button>
                    <button
                      onClick={() => setFilterDueDate('overdue')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterDueDate === 'overdue'
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md'
                          : 'bg-white/60 text-red-600 hover:bg-red-50'
                      }`}
                    >
                      ⚠️ Overdue
                    </button>
                    <button
                      onClick={() => setFilterDueDate('today')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterDueDate === 'today'
                          ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-md'
                          : 'bg-white/60 text-cyan-600 hover:bg-cyan-50'
                      }`}
                    >
                      📅 Today
                    </button>
                    <button
                      onClick={() => setFilterDueDate('week')}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                        filterDueDate === 'week'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                          : 'bg-white/60 text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      📆 This Week
                    </button>
                  </div>
                </div>

                {/* Clear Filters */}
                {(!showCompleted || filterPriority !== 'all' || filterDueDate !== 'all') && (
                  <div className="pt-2 border-t-2 border-white/50">
                    <button
                      onClick={() => {
                        setShowCompleted(true);
                        setFilterPriority('all');
                        setFilterDueDate('all');
                      }}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-white/60 hover:bg-white/80 transition-all hover:scale-102 flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Kanban Board */}
          <div className="grid grid-cols-4 gap-4 flex-1 overflow-hidden">
            <KanbanColumn title="📋 To Do" status="todo" tasks={displayedTasks.filter(t => t.status === 'todo')} onToggle={handleToggleTask} onSelect={handleSelectTask} />
            <KanbanColumn title="🔄 In Progress" status="in-progress" tasks={displayedTasks.filter(t => t.status === 'in-progress')} onToggle={handleToggleTask} onSelect={handleSelectTask} />
            <KanbanColumn title="🚫 Blocked" status="blocked" tasks={displayedTasks.filter(t => t.status === 'blocked')} onToggle={handleToggleTask} onSelect={handleSelectTask} />
            <KanbanColumn title="✅ Done" status="done" tasks={displayedTasks.filter(t => t.status === 'done')} onToggle={handleToggleTask} onSelect={handleSelectTask} />
          </div>
        </div>
      </div>
    );
  }

}
