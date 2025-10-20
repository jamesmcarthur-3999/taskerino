import { useState, useMemo, useEffect, useRef } from 'react';
import { useTasks } from '../context/TasksContext';
import { useUI } from '../context/UIContext';
import { useEntities } from '../context/EntitiesContext';
import { useScrollAnimation } from '../contexts/ScrollAnimationContext';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
  Rows3,
  Plus,
  Trash2,
  ExternalLink,
  Flag,
  Columns3,
  GripVertical,
} from 'lucide-react';
import type { Task } from '../types';
import {
  formatRelativeTime,
  isTaskOverdue,
  isTaskDueToday,
  generateId,
} from '../utils/helpers';
import { TaskTableView } from './TaskTableView';
import { SpaceMenuBar } from './SpaceMenuBar';
import { StandardFilterPanel } from './StandardFilterPanel';
import { InlineTagManager } from './InlineTagManager';
import { tagUtils } from '../utils/tagUtils';
import { Button } from './Button';
import { FeatureTooltip } from './FeatureTooltip';
import { getTaskCardClasses, KANBAN } from '../design-system/theme';

export default function TasksZone() {
  const { state: tasksState, dispatch: tasksDispatch } = useTasks();
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { state: entitiesState } = useEntities();
  const { registerScrollContainer, unregisterScrollContainer, scrollY } = useScrollAnimation();

  // Scroll container refs (using callback refs for proper registration)
  const [tableScrollContainer, setTableScrollContainer] = useState<HTMLDivElement | null>(null);
  const kanbanColumnRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Content container refs for scroll-driven expansion
  const tableContentRef = useRef<HTMLDivElement>(null);
  const kanbanContentRef = useRef<HTMLDivElement>(null);

  // Ref for main container to apply dynamic top padding
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // UI State
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [selectedTaskIdForInline, setSelectedTaskIdForInline] = useState<string | undefined>();
  const [groupBy, setGroupBy] = useState<'due-date' | 'status' | 'priority' | 'topic' | 'tag' | 'none'>('due-date');
  const [showFilters, setShowFilters] = useState(false);

  // Tooltip State
  const [showTaskViewsTooltip, setShowTaskViewsTooltip] = useState(false);
  const [showTaskDetailTooltip, setShowTaskDetailTooltip] = useState(false);
  const [hasClickedTask, setHasClickedTask] = useState(false);

  // Filter State
  const [showCompleted, setShowCompleted] = useState(true);
  const [filterPriority, setFilterPriority] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
  const [filterDueDate, setFilterDueDate] = useState<'all' | 'overdue' | 'today' | 'week'>('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // Apply filters with useMemo for performance
  const displayedTasks = useMemo(() => {
    return tasksState.tasks.filter(task => {
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

      // Tag filter (tasks must have at least one of the selected tags)
      if (filterTags.length > 0) {
        if (!task.tags || task.tags.length === 0) return false;
        const hasMatchingTag = task.tags.some(tag =>
          filterTags.some(filterTag => tagUtils.normalize(tag) === tagUtils.normalize(filterTag))
        );
        if (!hasMatchingTag) return false;
      }

      return true;
    });
  }, [tasksState.tasks, showCompleted, filterPriority, filterDueDate, filterTags]);


  const handleToggleTask = (taskId: string) => {
    tasksDispatch({ type: 'TOGGLE_TASK', payload: taskId });
  };

  const handleSelectTask = (taskId: string) => {
    const task = tasksState.tasks.find(t => t.id === taskId);
    if (task) {
      uiDispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'task', itemId: taskId, label: task.title } });

      // Show task detail tooltip on first click
      if (!hasClickedTask && !uiState.onboarding.featureIntroductions.taskDetailSidebar) {
        setHasClickedTask(true);
        setShowTaskDetailTooltip(true);
      }
    }
  };

  // Register/unregister table scroll container
  useEffect(() => {
    if (viewMode === 'table' && tableScrollContainer) {
      registerScrollContainer(tableScrollContainer);
      return () => {
        unregisterScrollContainer(tableScrollContainer);
      };
    }
  }, [viewMode, tableScrollContainer, registerScrollContainer, unregisterScrollContainer]);

  // Register/unregister kanban column scroll containers
  useEffect(() => {
    if (viewMode === 'kanban') {
      kanbanColumnRefs.current.forEach(ref => {
        if (ref) {
          registerScrollContainer(ref);
        }
      });
      return () => {
        kanbanColumnRefs.current.forEach(ref => {
          if (ref) {
            unregisterScrollContainer(ref);
          }
        });
      };
    }
  }, [viewMode, registerScrollContainer, unregisterScrollContainer]);

  // Show task views tooltip when user first opens Tasks zone with tasks
  useEffect(() => {
    if (
      !uiState.onboarding.featureIntroductions.taskViews &&
      tasksState.tasks.length > 0 &&
      !showTaskViewsTooltip
    ) {
      // Delay to let user see interface first
      const timer = setTimeout(() => {
        setShowTaskViewsTooltip(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [tasksState.tasks.length, uiState.onboarding.featureIntroductions.taskViews, showTaskViewsTooltip]);

  const handleDismissTaskViewsTooltip = () => {
    setShowTaskViewsTooltip(false);
    uiDispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: 'taskViews' });
  };

  const handleDismissTaskDetailTooltip = () => {
    setShowTaskDetailTooltip(false);
    uiDispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: 'taskDetailSidebar' });
  };

  const handleShowMeTaskViews = () => {
    setViewMode('kanban');
  };

  /**
   * Scroll-driven content expansion
   * Reduces top padding as the menu bar scrolls away to fill the space naturally
   */
  useEffect(() => {
    if (!mainContainerRef.current) return;

    const container = mainContainerRef.current;

    // Initial padding is pt-24 (96px)
    const initialPadding = 96;
    // Menu bar scrolls away over 200px (same as SpaceMenuBar transform)
    const scrollRange = 200;

    // Calculate reduced padding based on scroll
    // As scrollY goes from 0 to 200, padding goes from 96 to ~20px (keeping some minimum)
    const minPadding = 20;
    const paddingReduction = Math.min(scrollY, scrollRange) / scrollRange * (initialPadding - minPadding);
    const newPadding = initialPadding - paddingReduction;

    container.style.paddingTop = `${newPadding}px`;
  }, [scrollY]);

  // Get top tags for filter panel
  const topTags = useMemo(() => {
    return tagUtils.getTopTags(tasksState.tasks, (task) => task.tags || [], 8);
  }, [tasksState.tasks]);

  const handleToggleTagFilter = (tagId: string) => {
    if (filterTags.includes(tagId)) {
      setFilterTags(filterTags.filter(t => t !== tagId));
    } else {
      setFilterTags([...filterTags, tagId]);
    }
  };

  const handleCreateNewTask = (initialStatus?: Task['status']) => {
    const newTask: Task = {
      id: generateId(),
      title: 'New Task',
      done: false,
      priority: 'medium',
      status: initialStatus || 'todo',
      createdBy: 'manual',
      createdAt: new Date().toISOString(),
    };

    tasksDispatch({ type: 'ADD_TASK', payload: newTask });
    uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'taskCount' });

    // In Kanban view, open the task modal immediately
    if (viewMode === 'kanban') {
      uiDispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'task', itemId: newTask.id, label: newTask.title } });
    } else {
      // In table view, use inline editing
      setSelectedTaskIdForInline(newTask.id);
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

  const handleDeleteTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this task?')) {
      tasksDispatch({ type: 'DELETE_TASK', payload: taskId });
    }
  };

  const handleCyclePriority = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const priorities: Task['priority'][] = ['low', 'medium', 'high', 'urgent'];
    const currentIndex = priorities.indexOf(task.priority);
    const nextPriority = priorities[(currentIndex + 1) % priorities.length];

    tasksDispatch({
      type: 'UPDATE_TASK',
      payload: {
        ...task,
        priority: nextPriority,
      }
    });
  };

  // Kanban Components
  const KanbanColumn = ({
    title,
    status,
    tasks,
    onToggle,
    onSelect,
    scrollRef
  }: {
    title: string;
    status: Task['status'];
    tasks: Task[];
    onToggle: (id: string) => void;
    onSelect: (id: string) => void;
    scrollRef?: (ref: HTMLDivElement | null) => void;
  }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const topic = (task: Task) => entitiesState.topics.find(t => t.id === task.topicId);

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      // Only clear isDragOver if we're actually leaving the column, not just entering a child
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX >= rect.right ||
        e.clientY < rect.top ||
        e.clientY >= rect.bottom
      ) {
        setIsDragOver(false);
      }
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const taskId = e.dataTransfer.getData('text/plain');
      const task = tasksState.tasks.find(t => t.id === taskId);

      if (task && task.status !== status) {
        tasksDispatch({
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

    const handleStartEditTitle = (task: Task, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingTaskId(task.id);
      setEditingTitle(task.title);
    };

    const handleSaveTitle = (task: Task) => {
      if (editingTitle.trim() && editingTitle !== task.title) {
        tasksDispatch({
          type: 'UPDATE_TASK',
          payload: {
            ...task,
            title: editingTitle.trim(),
          }
        });
      }
      setEditingTaskId(null);
      setEditingTitle('');
    };

    const handleCancelEdit = () => {
      setEditingTaskId(null);
      setEditingTitle('');
    };

    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`overflow-hidden flex flex-col h-full ${
          isDragOver ? KANBAN.column.dragOver : KANBAN.column.default
        }`}
        style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <div className={KANBAN.header}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-900">
              {title}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-semibold px-2 py-0.5 bg-gray-100/80 rounded-full">
                {tasks.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => handleCreateNewTask(status)}
                title="Add task to this column"
                className="!p-1.5"
              />
            </div>
          </div>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-2 space-y-2"
          onDragOver={(e) => e.preventDefault()}
        >
          {tasks.map(task => {
            const taskTopic = topic(task);
            const isOverdue = isTaskOverdue(task);
            const isDueToday = isTaskDueToday(task);
            const isUrgent = task.priority === 'urgent' || task.priority === 'high';

            const isEditing = editingTaskId === task.id;

            const cardState = isOverdue ? 'overdue' : isDueToday ? 'dueToday' : 'default';
            const cardClasses = getTaskCardClasses(task.priority, cardState);

            return (
              <div
                key={task.id}
                draggable={!isEditing}
                onDragStart={(e) => {
                  // Prevent drag if clicking on interactive elements
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
                    e.preventDefault();
                    return;
                  }
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', task.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault(); // Allow dropping over cards
                }}
                onClick={() => !isEditing && onSelect(task.id)}
                className={`${cardClasses} select-none ${isEditing ? 'ring-2 ring-cyan-400 !cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
                style={{
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                {/* Quick Actions - Show on Hover */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200 flex items-center gap-1 z-20">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Flag className="w-3.5 h-3.5" />}
                    onClick={(e) => handleCyclePriority(task, e)}
                    title="Change priority"
                    className="!p-1.5"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<ExternalLink className="w-3.5 h-3.5" />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(task.id);
                    }}
                    title="Open details"
                    className="!p-1.5"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={(e) => handleDeleteTask(task.id, e)}
                    title="Delete task"
                    className="!p-1.5"
                  />
                </div>

                <div className="relative z-10 p-3">
                  <div className="flex items-start gap-2 mb-2 pr-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle(task.id);
                      }}
                      className="mt-0.5 transition-transform duration-300 hover:scale-110 flex-shrink-0"
                    >
                      {getStatusIcon(task.status)}
                    </button>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleSaveTitle(task)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveTitle(task);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="text-sm font-semibold flex-1 leading-tight bg-white border border-cyan-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      />
                    ) : (
                      <h4
                        onDoubleClick={(e) => handleStartEditTitle(task, e)}
                        className={`text-sm font-semibold flex-1 leading-tight cursor-text ${
                          task.done ? 'line-through opacity-50 text-gray-500' :
                          isOverdue ? 'text-red-800' :
                          isDueToday ? 'text-cyan-800' :
                          'text-gray-900'
                        }`}
                        title="Double-click to edit"
                      >
                        {task.title}
                      </h4>
                    )}
                  </div>
                  {/* Description Preview */}
                  {task.description && task.description.trim() && (
                    <div className="mb-2 pb-2 border-b border-gray-100">
                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    </div>
                  )}

                  {/* Metadata Section */}
                  <div className="flex flex-col gap-1.5">
                    {/* Priority Badge & Creation Date */}
                    <div className="flex items-center justify-between gap-2">
                      {isUrgent && !task.done ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                          task.priority === 'urgent' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-orange-100 text-orange-700 border border-orange-200'
                        }`}>
                          {task.priority.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 capitalize">
                          {task.priority} priority
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {formatRelativeTime(task.createdAt)}
                      </span>
                    </div>

                    {/* Due Date */}
                    {task.dueDate && (
                      <div className={`flex items-center gap-1.5 text-xs ${
                        isOverdue ? 'text-red-700 font-semibold' :
                        isDueToday ? 'text-cyan-700 font-semibold' :
                        'text-gray-600'
                      }`}>
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatRelativeTime(task.dueDate)}</span>
                      </div>
                    )}

                    {/* Subtasks Progress */}
                    {task.subtasks && task.subtasks.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
                            style={{ width: `${(task.subtasks.filter(st => st.done).length / task.subtasks.length) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 font-medium">
                          {task.subtasks.filter(st => st.done).length}/{task.subtasks.length}
                        </span>
                      </div>
                    )}

                    {/* Tags */}
                    {task.tags && task.tags.length > 0 && (
                      <div className="mt-1">
                        <InlineTagManager
                          tags={task.tags}
                          onTagsChange={() => {}}
                          onTagClick={(tag) => {
                            setFilterTags([tag]);
                            setShowFilters(true);
                          }}
                          maxDisplayed={2}
                          editable={false}
                          className="text-[10px]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="text-4xl mb-2 opacity-40">📋</div>
              <p className="text-xs font-medium">Drop tasks here</p>
              <p className="text-[10px] mt-1">or click + above</p>
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
        <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 via-cyan-500/10 to-teal-500/10 animate-gradient-reverse pointer-events-none will-change-transform" />

        <div ref={mainContainerRef} className="relative z-10 flex-1 min-h-0 flex flex-col px-6 pb-6" style={{ paddingTop: '96px' }}>
          <div className="bg-white/40 backdrop-blur-2xl rounded-[9999px] border-2 border-white/50 shadow-xl px-4 py-2 mb-4">
            <SpaceMenuBar
              primaryAction={{
                label: 'New Task',
                icon: <Plus size={16} />,
                onClick: handleCreateNewTask,
                gradient: 'cyan',
              }}
              viewControls={{
                views: [
                  { id: 'table', label: 'Table', icon: <Rows3 size={16} /> },
                  { id: 'kanban', label: 'Kanban', icon: <Columns3 size={16} /> },
                ],
                activeView: 'table',
                onViewChange: (id) => id === 'kanban' && setViewMode('kanban'),
              }}
              dropdowns={[
                {
                  label: 'Group',
                  value: groupBy,
                  options: [
                    { value: 'due-date', label: 'Due Date' },
                    { value: 'status', label: 'Status' },
                    { value: 'priority', label: 'Priority' },
                    { value: 'topic', label: 'Topic' },
                    { value: 'tag', label: 'Tag' },
                    { value: 'none', label: 'None' },
                  ],
                  onChange: (value) => setGroupBy(value as typeof groupBy),
                },
              ]}
              filters={{
                active: showFilters,
                count: [!showCompleted, filterPriority !== 'all', filterDueDate !== 'all', filterTags.length > 0].filter(Boolean).length,
                onToggle: () => setShowFilters(!showFilters),
                panel: showFilters ? (
                  <StandardFilterPanel
                    title="Filter Tasks"
                    sections={[
                      {
                        title: 'COMPLETION STATUS',
                        items: [
                          { id: 'all', label: 'All Tasks' },
                          { id: 'active', label: 'Active Only' },
                        ],
                        selectedIds: showCompleted ? ['all'] : ['active'],
                        onToggle: (id) => setShowCompleted(id === 'all'),
                        multiSelect: false,
                      },
                      {
                        title: 'PRIORITY LEVEL',
                        items: [
                          { id: 'all', label: 'All' },
                          { id: 'urgent', label: 'Urgent' },
                          { id: 'high', label: 'High' },
                          { id: 'medium', label: 'Medium' },
                          { id: 'low', label: 'Low' },
                        ],
                        selectedIds: filterPriority !== 'all' ? [filterPriority] : ['all'],
                        onToggle: (id) => setFilterPriority(id as typeof filterPriority),
                        multiSelect: false,
                      },
                      {
                        title: 'DUE DATE RANGE',
                        items: [
                          { id: 'all', label: 'All Dates' },
                          { id: 'overdue', label: '⚠️ Overdue' },
                          { id: 'today', label: '📅 Today' },
                          { id: 'week', label: '📆 This Week' },
                        ],
                        selectedIds: filterDueDate !== 'all' ? [filterDueDate] : ['all'],
                        onToggle: (id) => setFilterDueDate(id as typeof filterDueDate),
                        multiSelect: false,
                      },
                      ...(topTags.length > 0 ? [{
                        title: 'TAGS',
                        items: topTags.map(tag => ({
                          id: tag,
                          label: `#${tag}`,
                        })),
                        selectedIds: filterTags,
                        onToggle: handleToggleTagFilter,
                        multiSelect: true,
                      }] : []),
                    ]}
                    onClearAll={() => {
                      setShowCompleted(true);
                      setFilterPriority('all');
                      setFilterDueDate('all');
                      setFilterTags([]);
                    }}
                  />
                ) : undefined,
              }}
              stats={{
                total: tasksState.tasks.length,
                filtered: displayedTasks.length,
              }}
            />
          </div>

          {/* Task Views Tooltip */}
          <FeatureTooltip
              show={showTaskViewsTooltip}
              onDismiss={handleDismissTaskViewsTooltip}
              position="bottom-right"
              title="💡 Tip: Two Ways to View Tasks"
              message={
                <div>
                  <ul className="list-disc list-inside space-y-1 mb-2">
                    <li><strong>Table</strong> - Sortable spreadsheet view</li>
                    <li><strong>Kanban</strong> - Drag-and-drop cards</li>
                  </ul>
                  <p className="text-xs text-gray-600">Try clicking the view toggle above ↗</p>
                </div>
              }
              primaryAction={{
                label: 'Show me',
                onClick: handleShowMeTaskViews,
              }}
              secondaryAction={{
                label: 'Dismiss',
                onClick: () => {},
              }}
              delay={500}
            />

          {/* Task Detail Sidebar Tooltip - positioned in sidebar when it opens */}
          {uiState.sidebar.isOpen && uiState.sidebar.type === 'task' && (
            <FeatureTooltip
              show={showTaskDetailTooltip}
              onDismiss={handleDismissTaskDetailTooltip}
              position="left"
              title="💡 Tip: Task Details"
              message="Click any task to see full details, subtasks, source note, tags, and more. You can edit everything inline!"
              primaryAction={{
                label: 'Got it',
                onClick: () => {},
              }}
            />
          )}

          {/* Table View Component */}
          <div ref={tableContentRef} className="flex-1 min-h-0 flex">
            <TaskTableView
              tasks={displayedTasks}
              onTaskClick={setSelectedTaskIdForInline}
              selectedTaskId={selectedTaskIdForInline}
              groupBy={groupBy}
              scrollRef={setTableScrollContainer}
            />
          </div>
        </div>
      </div>
    );
  }

  // Kanban View
  if (viewMode === 'kanban') {
    return (
      <div className="h-full w-full relative flex flex-col bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-teal-500/20">
        {/* Secondary animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 via-cyan-500/10 to-teal-500/10 animate-gradient-reverse pointer-events-none will-change-transform" />

        <div ref={mainContainerRef} className="relative z-10 flex-1 min-h-0 flex flex-col px-6 pb-6" style={{ paddingTop: '96px' }}>
          <div className="bg-white/40 backdrop-blur-2xl rounded-[9999px] border-2 border-white/50 shadow-xl px-4 py-2 mb-4">
            <SpaceMenuBar
              primaryAction={{
                label: 'New Task',
                icon: <Plus size={16} />,
                onClick: handleCreateNewTask,
                gradient: 'cyan',
              }}
              viewControls={{
                views: [
                  { id: 'table', label: 'Table', icon: <Rows3 size={16} /> },
                  { id: 'kanban', label: 'Kanban', icon: <Columns3 size={16} /> },
                ],
                activeView: 'kanban',
                onViewChange: (id) => id === 'table' && setViewMode('table'),
              }}
              dropdowns={[
                {
                  label: 'Group',
                  value: groupBy,
                  options: [
                    { value: 'due-date', label: 'Due Date' },
                    { value: 'status', label: 'Status' },
                    { value: 'priority', label: 'Priority' },
                    { value: 'topic', label: 'Topic' },
                    { value: 'tag', label: 'Tag' },
                    { value: 'none', label: 'None' },
                  ],
                  onChange: (value) => setGroupBy(value as typeof groupBy),
                },
              ]}
              filters={{
                active: showFilters,
                count: [!showCompleted, filterPriority !== 'all', filterDueDate !== 'all', filterTags.length > 0].filter(Boolean).length,
                onToggle: () => setShowFilters(!showFilters),
                panel: showFilters ? (
                  <StandardFilterPanel
                    title="Filter Tasks"
                    sections={[
                      {
                        title: 'COMPLETION STATUS',
                        items: [
                          { id: 'all', label: 'All Tasks' },
                          { id: 'active', label: 'Active Only' },
                        ],
                        selectedIds: showCompleted ? ['all'] : ['active'],
                        onToggle: (id) => setShowCompleted(id === 'all'),
                        multiSelect: false,
                      },
                      {
                        title: 'PRIORITY LEVEL',
                        items: [
                          { id: 'all', label: 'All' },
                          { id: 'urgent', label: 'Urgent' },
                          { id: 'high', label: 'High' },
                          { id: 'medium', label: 'Medium' },
                          { id: 'low', label: 'Low' },
                        ],
                        selectedIds: filterPriority !== 'all' ? [filterPriority] : ['all'],
                        onToggle: (id) => setFilterPriority(id as typeof filterPriority),
                        multiSelect: false,
                      },
                      {
                        title: 'DUE DATE RANGE',
                        items: [
                          { id: 'all', label: 'All Dates' },
                          { id: 'overdue', label: '⚠️ Overdue' },
                          { id: 'today', label: '📅 Today' },
                          { id: 'week', label: '📆 This Week' },
                        ],
                        selectedIds: filterDueDate !== 'all' ? [filterDueDate] : ['all'],
                        onToggle: (id) => setFilterDueDate(id as typeof filterDueDate),
                        multiSelect: false,
                      },
                      ...(topTags.length > 0 ? [{
                        title: 'TAGS',
                        items: topTags.map(tag => ({
                          id: tag,
                          label: `#${tag}`,
                        })),
                        selectedIds: filterTags,
                        onToggle: handleToggleTagFilter,
                        multiSelect: true,
                      }] : []),
                    ]}
                    onClearAll={() => {
                      setShowCompleted(true);
                      setFilterPriority('all');
                      setFilterDueDate('all');
                      setFilterTags([]);
                    }}
                  />
                ) : undefined,
              }}
              stats={{
                total: tasksState.tasks.length,
                filtered: displayedTasks.length,
              }}
            />
          </div>

          {/* Task Views Tooltip */}
          <FeatureTooltip
              show={showTaskViewsTooltip}
              onDismiss={handleDismissTaskViewsTooltip}
              position="bottom-right"
              title="💡 Tip: Two Ways to View Tasks"
              message={
                <div>
                  <ul className="list-disc list-inside space-y-1 mb-2">
                    <li><strong>Table</strong> - Sortable spreadsheet view</li>
                    <li><strong>Kanban</strong> - Drag-and-drop cards</li>
                  </ul>
                  <p className="text-xs text-gray-600">Try clicking the view toggle above ↗</p>
                </div>
              }
              primaryAction={{
                label: 'Show me',
                onClick: handleShowMeTaskViews,
              }}
              secondaryAction={{
                label: 'Dismiss',
                onClick: () => {},
              }}
              delay={500}
            />

            {/* Task Detail Sidebar Tooltip - positioned in sidebar when it opens */}
            {uiState.sidebar.isOpen && uiState.sidebar.type === 'task' && (
              <FeatureTooltip
                show={showTaskDetailTooltip}
                onDismiss={handleDismissTaskDetailTooltip}
                position="left"
                title="💡 Tip: Task Details"
                message="Click any task to see full details, subtasks, source note, tags, and more. You can edit everything inline!"
                primaryAction={{
                  label: 'Got it',
                  onClick: () => {},
                }}
              />
            )}

          {/* Kanban Board */}
          <div
            ref={kanbanContentRef}
            className="flex gap-4 flex-1 overflow-x-auto overflow-y-hidden"
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="flex-shrink-0 w-full sm:w-80 min-w-[300px] h-full" onDragOver={(e) => e.preventDefault()}>
              <KanbanColumn
                title="To Do"
                status="todo"
                tasks={displayedTasks.filter(t => t.status === 'todo')}
                onToggle={handleToggleTask}
                onSelect={handleSelectTask}
                scrollRef={(ref) => kanbanColumnRefs.current[0] = ref}
              />
            </div>
            <div className="flex-shrink-0 w-full sm:w-80 min-w-[300px] h-full" onDragOver={(e) => e.preventDefault()}>
              <KanbanColumn
                title="In Progress"
                status="in-progress"
                tasks={displayedTasks.filter(t => t.status === 'in-progress')}
                onToggle={handleToggleTask}
                onSelect={handleSelectTask}
                scrollRef={(ref) => kanbanColumnRefs.current[1] = ref}
              />
            </div>
            <div className="flex-shrink-0 w-full sm:w-80 min-w-[300px] h-full" onDragOver={(e) => e.preventDefault()}>
              <KanbanColumn
                title="Blocked"
                status="blocked"
                tasks={displayedTasks.filter(t => t.status === 'blocked')}
                onToggle={handleToggleTask}
                onSelect={handleSelectTask}
                scrollRef={(ref) => kanbanColumnRefs.current[2] = ref}
              />
            </div>
            <div className="flex-shrink-0 w-full sm:w-80 min-w-[300px] h-full" onDragOver={(e) => e.preventDefault()}>
              <KanbanColumn
                title="Done"
                status="done"
                tasks={displayedTasks.filter(t => t.status === 'done')}
                onToggle={handleToggleTask}
                onSelect={handleSelectTask}
                scrollRef={(ref) => kanbanColumnRefs.current[3] = ref}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

}
