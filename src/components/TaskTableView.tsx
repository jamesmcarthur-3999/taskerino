import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  GripVertical,
  CheckSquare,
  Circle,
  Calendar,
  Tag,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Trash2,
  Copy,
  ExternalLink,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { Task } from '../types';
import { formatRelativeTime, isTaskOverdue, isTaskDueToday, isTaskDueSoon, generateId } from '../utils/helpers';
import { TaskDetailInline } from './TaskDetailInline';

interface TaskTableViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string | undefined) => void;
  selectedTaskId?: string;
  groupBy: GroupByOption;
}

type GroupByOption = 'due-date' | 'status' | 'priority' | 'topic' | 'tag' | 'none';
type ColumnId = 'status' | 'title' | 'priority' | 'due-date' | 'tags' | 'topic';

interface ColumnConfig {
  id: ColumnId;
  label: string;
  width: string;
  sortable: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'status', label: 'Status', width: '60px', sortable: false },
  { id: 'title', label: 'Task', width: 'flex-1', sortable: true },
  { id: 'priority', label: 'Priority', width: '100px', sortable: true },
  { id: 'due-date', label: 'Due', width: '140px', sortable: true },
  { id: 'tags', label: 'Tags', width: '180px', sortable: false },
  { id: 'topic', label: 'Topic', width: '140px', sortable: false },
];

export function TaskTableView({ tasks, onTaskClick, selectedTaskId, groupBy }: TaskTableViewProps) {
  const { state, dispatch } = useApp();
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnId | null>(null);
  const [sortBy, setSortBy] = useState<ColumnId | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [panelWidth, setPanelWidth] = useState(550);
  const [isResizing, setIsResizing] = useState(false);
  const [newTaskGroupKey, setNewTaskGroupKey] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: ColumnId } | null>(null);

  // Group tasks based on selected grouping
  const groupedTasks = useMemo(() => {
    const groups: Record<string, { label: string; tasks: Task[]; order: number }> = {};

    tasks.forEach(task => {
      let groupKey = '';
      let groupLabel = '';
      let groupOrder = 0;

      switch (groupBy) {
        case 'due-date':
          if (!task.dueDate) {
            groupKey = 'no-date';
            groupLabel = 'No Due Date';
            groupOrder = 999;
          } else if (isTaskOverdue(task)) {
            groupKey = 'overdue';
            groupLabel = '⚠️ Overdue';
            groupOrder = 0;
          } else if (isTaskDueToday(task)) {
            groupKey = 'today';
            groupLabel = '📅 Today';
            groupOrder = 1;
          } else if (isTaskDueSoon(task)) {
            groupKey = 'this-week';
            groupLabel = '📆 This Week';
            groupOrder = 2;
          } else {
            groupKey = 'later';
            groupLabel = '🗓️ Later';
            groupOrder = 3;
          }
          break;

        case 'status':
          groupKey = task.status;
          groupLabel = task.status === 'todo' ? '📋 To Do' :
                      task.status === 'in-progress' ? '🔄 In Progress' :
                      task.status === 'blocked' ? '🚫 Blocked' : '✅ Done';
          groupOrder = task.status === 'todo' ? 0 : task.status === 'in-progress' ? 1 : task.status === 'blocked' ? 2 : 3;
          break;

        case 'priority':
          groupKey = task.priority;
          groupLabel = task.priority === 'urgent' ? '🔴 Urgent' :
                      task.priority === 'high' ? '🟠 High' :
                      task.priority === 'medium' ? '🟡 Medium' : '🔵 Low';
          groupOrder = task.priority === 'urgent' ? 0 : task.priority === 'high' ? 1 : task.priority === 'medium' ? 2 : 3;
          break;

        case 'topic':
          const topic = state.topics.find(t => t.id === task.topicId);
          groupKey = task.topicId || 'no-topic';
          groupLabel = topic ? `📌 ${topic.name}` : 'No Topic';
          groupOrder = topic ? 0 : 999;
          break;

        case 'tag':
          if (!task.tags || task.tags.length === 0) {
            groupKey = 'no-tags';
            groupLabel = 'No Tags';
            groupOrder = 999;
          } else {
            groupKey = task.tags[0];
            groupLabel = `#${task.tags[0]}`;
            groupOrder = 0;
          }
          break;

        case 'none':
          groupKey = 'all';
          groupLabel = 'All Tasks';
          groupOrder = 0;
          break;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { label: groupLabel, tasks: [], order: groupOrder };
      }
      groups[groupKey].tasks.push(task);
    });

    // Sort tasks within each group if sortBy is set
    if (sortBy) {
      Object.values(groups).forEach(group => {
        group.tasks.sort((a, b) => {
          let aVal: any;
          let bVal: any;

          switch (sortBy) {
            case 'title':
              aVal = a.title.toLowerCase();
              bVal = b.title.toLowerCase();
              break;
            case 'priority':
              const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
              aVal = priorityOrder[a.priority];
              bVal = priorityOrder[b.priority];
              break;
            case 'due-date':
              aVal = a.dueDate || '9999-12-31';
              bVal = b.dueDate || '9999-12-31';
              break;
            default:
              return 0;
          }

          if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        });
      });
    }

    // Sort groups by order
    return Object.entries(groups)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([key, value]) => ({ key, ...value }));
  }, [tasks, groupBy, state.topics, sortBy, sortDirection]);

  const toggleGroup = (groupKey: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(groupKey)) {
      newCollapsed.delete(groupKey);
    } else {
      newCollapsed.add(groupKey);
    }
    setCollapsedGroups(newCollapsed);
  };

  const handleTaskToggle = (taskId: string) => {
    dispatch({ type: 'TOGGLE_TASK', payload: taskId });
  };

  const handleDeleteTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this task?')) {
      dispatch({ type: 'DELETE_TASK', payload: taskId });
    }
  };

  const handleDuplicateTask = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTask: Task = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: `${task.title} (Copy)`,
      done: false,
      createdAt: new Date().toISOString(),
      completedAt: undefined,
    };
    dispatch({ type: 'ADD_TASK', payload: newTask });
  };

  const handleColumnDragStart = (columnId: ColumnId) => {
    setDraggedColumn(columnId);
  };

  const handleColumnDrop = (targetColumnId: ColumnId) => {
    if (!draggedColumn || draggedColumn === targetColumnId) {
      setDraggedColumn(null);
      return;
    }

    const newColumns = [...columns];
    const draggedIndex = newColumns.findIndex(c => c.id === draggedColumn);
    const targetIndex = newColumns.findIndex(c => c.id === targetColumnId);

    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    setColumns(newColumns);
    setDraggedColumn(null);
  };

  const handleTaskDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleTaskDrop = (targetTask: Task, groupKey: string) => {
    if (!draggedTask) return;

    // If dropped on same task, ignore
    if (draggedTask.id === targetTask.id) {
      setDraggedTask(null);
      return;
    }

    // Update task based on group it was dropped into
    let updates: Partial<Task> = {};

    if (groupBy === 'status' && targetTask.status !== draggedTask.status) {
      updates.status = targetTask.status;
      updates.done = targetTask.status === 'done';
    } else if (groupBy === 'priority' && targetTask.priority !== draggedTask.priority) {
      updates.priority = targetTask.priority;
    }

    if (Object.keys(updates).length > 0) {
      dispatch({
        type: 'UPDATE_TASK',
        payload: { ...draggedTask, ...updates }
      });
    }

    setDraggedTask(null);
  };

  const handleColumnSort = (columnId: ColumnId) => {
    const column = columns.find(c => c.id === columnId);
    if (!column?.sortable) return;

    if (sortBy === columnId) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column
      setSortBy(columnId);
      setSortDirection('asc');
    }
  };

  const handleCreateInlineTask = (groupKey: string) => {
    if (!newTaskTitle.trim()) {
      setNewTaskGroupKey(null);
      setNewTaskTitle('');
      return;
    }

    const newTask: Task = {
      id: generateId(),
      title: newTaskTitle.trim(),
      done: false,
      priority: 'medium',
      status: 'todo',
      createdBy: 'manual',
      createdAt: new Date().toISOString(),
    };

    // Set properties based on the group
    if (groupBy === 'status' && groupKey !== 'all') {
      newTask.status = groupKey as Task['status'];
    } else if (groupBy === 'priority' && groupKey !== 'all') {
      newTask.priority = groupKey as Task['priority'];
    }

    dispatch({ type: 'ADD_TASK', payload: newTask });
    setNewTaskGroupKey(null);
    setNewTaskTitle('');
  };

  // Resize handlers
  const handleResizeStart = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const container = document.querySelector('.table-view-container');
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      const maxWidth = containerRect.width * 0.5; // 50% max
      const minWidth = 400;

      setPanelWidth(Math.max(minWidth, Math.min(newWidth, maxWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent': return 'text-red-700 bg-red-100';
      case 'high': return 'text-orange-700 bg-orange-100';
      case 'medium': return 'text-yellow-700 bg-yellow-100';
      case 'low': return 'text-blue-700 bg-blue-100';
    }
  };

  const getStatusIcon = (task: Task) => {
    if (task.done) return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (task.status === 'in-progress') return <Clock className="w-4 h-4 text-cyan-600" />;
    if (task.status === 'blocked') return <AlertCircle className="w-4 h-4 text-red-600" />;
    return <Circle className="w-4 h-4 text-gray-400" />;
  };

  const renderCellContent = (task: Task, columnId: ColumnId) => {
    const isEditing = editingCell?.taskId === task.id && editingCell?.field === columnId;

    const updateTask = (updates: Partial<Task>) => {
      dispatch({
        type: 'UPDATE_TASK',
        payload: { ...task, ...updates }
      });
      setEditingCell(null);
    };

    switch (columnId) {
      case 'status':
        return (
          <select
            value={task.status}
            onChange={(e) => {
              e.stopPropagation();
              const newStatus = e.target.value as Task['status'];
              updateTask({
                status: newStatus,
                done: newStatus === 'done',
                completedAt: newStatus === 'done' && !task.completedAt ? new Date().toISOString() : task.completedAt
              });
            }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full text-xs font-medium rounded pl-1 pr-6 py-0.5 border-0 cursor-pointer transition-all hover:bg-white/60 ${
              task.status === 'done' ? 'text-green-700 bg-green-50' :
              task.status === 'in-progress' ? 'text-cyan-700 bg-cyan-50' :
              task.status === 'blocked' ? 'text-red-700 bg-red-50' :
              'text-gray-700 bg-gray-50'
            }`}
          >
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </select>
        );

      case 'title':
        const isOverdue = isTaskOverdue(task);
        const isDueToday = isTaskDueToday(task);

        if (isEditing) {
          return (
            <input
              type="text"
              defaultValue={task.title}
              onBlur={(e) => updateTask({ title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateTask({ title: e.currentTarget.value });
                } else if (e.key === 'Escape') {
                  setEditingCell(null);
                }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="w-full bg-white/60 border-0 focus:outline-none text-sm font-medium px-1 py-0.5 rounded"
            />
          );
        }

        return (
          <div
            className="flex-1 min-w-0"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingCell({ taskId: task.id, field: 'title' });
            }}
          >
            <div className={`font-medium truncate ${
              task.done ? 'line-through text-gray-500' :
              isOverdue ? 'text-red-700' :
              isDueToday ? 'text-cyan-700' :
              'text-gray-900'
            }`}>
              {task.title}
            </div>
            {task.description && (
              <div className="text-xs text-gray-500 truncate mt-0.5">{task.description}</div>
            )}
          </div>
        );

      case 'priority':
        return (
          <select
            value={task.priority}
            onChange={(e) => {
              e.stopPropagation();
              updateTask({ priority: e.target.value as Task['priority'] });
            }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full text-xs font-semibold rounded pl-2 pr-6 py-1 border-0 cursor-pointer transition-all hover:opacity-80 ${getPriorityColor(task.priority)}`}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        );

      case 'due-date':
        if (isEditing) {
          return (
            <input
              type="date"
              defaultValue={task.dueDate || ''}
              onBlur={(e) => updateTask({ dueDate: e.target.value || undefined })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateTask({ dueDate: e.currentTarget.value || undefined });
                } else if (e.key === 'Escape') {
                  setEditingCell(null);
                }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="w-full text-xs bg-white/60 border-0 rounded px-1 py-0.5"
            />
          );
        }

        if (!task.dueDate) {
          return (
            <span
              className="text-xs text-gray-400 hover:text-gray-600"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingCell({ taskId: task.id, field: 'due-date' });
              }}
            >
              Set date
            </span>
          );
        }

        const overdue = isTaskOverdue(task);
        const today = isTaskDueToday(task);
        return (
          <div
            className={`flex items-center gap-1 text-xs hover:opacity-80 ${
              overdue ? 'text-red-600 font-semibold' :
              today ? 'text-cyan-600 font-semibold' :
              'text-gray-600'
            }`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingCell({ taskId: task.id, field: 'due-date' });
            }}
          >
            <Calendar className="w-3 h-3" />
            {formatRelativeTime(task.dueDate)}
          </div>
        );

      case 'tags':
        if (isEditing) {
          return (
            <input
              type="text"
              defaultValue={task.tags?.join(', ') || ''}
              onBlur={(e) => {
                const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                updateTask({ tags });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const tags = e.currentTarget.value.split(',').map(t => t.trim()).filter(Boolean);
                  updateTask({ tags });
                } else if (e.key === 'Escape') {
                  setEditingCell(null);
                }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="tag1, tag2"
              autoFocus
              className="w-full text-xs bg-white/60 border-0 rounded px-1 py-0.5"
            />
          );
        }

        if (!task.tags || task.tags.length === 0) {
          return (
            <span
              className="text-xs text-gray-400 hover:text-gray-600"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingCell({ taskId: task.id, field: 'tags' });
              }}
            >
              Add tags
            </span>
          );
        }

        return (
          <div
            className="flex gap-1 flex-wrap"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingCell({ taskId: task.id, field: 'tags' });
            }}
          >
            {task.tags.slice(0, 2).map(tag => (
              <span key={tag} className="inline-flex items-center px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px] font-medium">
                #{tag}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-[10px] text-gray-400">+{task.tags.length - 2}</span>
            )}
          </div>
        );

      case 'topic':
        return (
          <select
            value={task.topicId || ''}
            onChange={(e) => {
              e.stopPropagation();
              updateTask({ topicId: e.target.value || undefined });
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-xs text-gray-600 bg-transparent border-0 cursor-pointer rounded pl-1 pr-6 py-0.5 hover:bg-white/60"
          >
            <option value="">No topic</option>
            {state.topics.map(topic => (
              <option key={topic.id} value={topic.id}>{topic.name}</option>
            ))}
          </select>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex gap-4 overflow-hidden table-view-container">
      {/* LEFT PANEL - Table */}
      <div className="flex-1 flex flex-col bg-white/70 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl overflow-hidden">
        {/* Column Headers */}
        <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-white/50 bg-white/30 backdrop-blur-sm">
          {columns.map((column) => (
            <div
              key={column.id}
              draggable
              onDragStart={() => handleColumnDragStart(column.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleColumnDrop(column.id)}
              onClick={() => handleColumnSort(column.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all group ${
                column.width === 'flex-1' ? 'flex-1' : ''
              } ${column.sortable ? 'cursor-pointer hover:bg-white/40' : 'cursor-move hover:bg-white/40'}`}
              style={{ width: column.width !== 'flex-1' ? column.width : undefined }}
            >
              <GripVertical className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{column.label}</span>
              {column.sortable && (
                <span className="ml-auto">
                  {sortBy === column.id ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3 h-3 text-cyan-600" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-cyan-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </span>
              )}
            </div>
          ))}
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wider px-2" style={{ width: '80px' }}>Actions</div>
        </div>

        {/* Task Groups */}
        <div className="flex-1 overflow-y-auto">
          {groupedTasks.map(({ key, label, tasks: groupTasks }) => (
            <div key={key} className="border-b border-white/30 last:border-b-0">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(key)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-white/30 to-white/20 hover:from-white/40 hover:to-white/30 transition-all text-left border-b border-white/30"
              >
                <div className="flex items-center gap-2.5">
                  {collapsedGroups.has(key) ? (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                  <span className="font-semibold text-sm text-gray-900">{label}</span>
                  <span className="text-xs font-medium text-gray-500 bg-white/60 px-2 py-0.5 rounded-full">{groupTasks.length}</span>
                </div>
              </button>

              {/* Group Tasks */}
              {!collapsedGroups.has(key) && (
                <div>
                  {groupTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleTaskDragStart(task)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleTaskDrop(task, key)}
                      onClick={() => onTaskClick(task.id)}
                      className={`group flex items-center gap-2 px-4 py-2 cursor-pointer border-b border-white/20 last:border-b-0 transition-all hover:bg-white/30 ${
                        selectedTaskId === task.id ? 'bg-cyan-50/50 border-l-4 border-l-cyan-500' : ''
                      }`}
                    >
                      {columns.map((column) => (
                        <div
                          key={column.id}
                          className={column.width === 'flex-1' ? 'flex-1 min-w-0' : ''}
                          style={{ width: column.width !== 'flex-1' ? column.width : undefined }}
                        >
                          {renderCellContent(task, column.id)}
                        </div>
                      ))}

                      {/* Quick Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: '80px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'task', itemId: task.id, label: task.title } });
                          }}
                          className="p-1 hover:bg-white/60 rounded transition-all"
                          title="Open in modal"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <button
                          onClick={(e) => handleDuplicateTask(task, e)}
                          className="p-1 hover:bg-white/60 rounded transition-all"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteTask(task.id, e)}
                          className="p-1 hover:bg-red-100 rounded transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add Task Row */}
                  {newTaskGroupKey === key ? (
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-white/20 bg-white/20">
                      {columns.map((column) => (
                        <div
                          key={column.id}
                          className={column.width === 'flex-1' ? 'flex-1 min-w-0' : ''}
                          style={{ width: column.width !== 'flex-1' ? column.width : undefined }}
                        >
                          {column.id === 'title' ? (
                            <input
                              type="text"
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCreateInlineTask(key);
                                } else if (e.key === 'Escape') {
                                  setNewTaskGroupKey(null);
                                  setNewTaskTitle('');
                                }
                              }}
                              onBlur={() => {
                                if (newTaskTitle.trim()) {
                                  handleCreateInlineTask(key);
                                } else {
                                  setNewTaskGroupKey(null);
                                  setNewTaskTitle('');
                                }
                              }}
                              placeholder="Task title..."
                              autoFocus
                              className="w-full bg-transparent border-0 focus:outline-none text-sm text-gray-700 placeholder-gray-400"
                            />
                          ) : column.id === 'status' ? (
                            <Circle className="w-4 h-4 text-gray-400" />
                          ) : null}
                        </div>
                      ))}
                      <div style={{ width: '80px' }} />
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setNewTaskGroupKey(key);
                        setNewTaskTitle('');
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-500 hover:bg-white/20 transition-all border-b border-white/20"
                    >
                      <Circle className="w-4 h-4" />
                      <span className="text-gray-400">Add task...</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Resize Handle */}
      {selectedTaskId && (
        <div
          onMouseDown={handleResizeStart}
          className={`w-1 flex-shrink-0 cursor-col-resize hover:bg-cyan-400 transition-colors relative group ${
            isResizing ? 'bg-cyan-400' : 'bg-transparent'
          }`}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {/* RIGHT PANEL - Task Detail */}
      <div
        className={`flex-shrink-0 bg-white/70 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl flex flex-col overflow-hidden ${
          selectedTaskId ? 'opacity-100' : 'w-0 opacity-0 border-0'
        } ${isResizing ? '' : 'transition-all duration-300 ease-in-out'}`}
        style={{ width: selectedTaskId ? `${panelWidth}px` : 0 }}
      >
        {selectedTaskId && (
          <TaskDetailInline
            taskId={selectedTaskId}
            onClose={() => onTaskClick(undefined)}
          />
        )}
      </div>
    </div>
  );
}
