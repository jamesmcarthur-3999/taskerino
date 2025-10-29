import { useState } from 'react';
import { ChevronDown, ChevronRight, Edit2, Trash2, X, Check, AlertCircle, Sparkles, FileText, CheckSquare } from 'lucide-react';
import type { AIProcessResult } from '../../types';
import {
  getGlassClasses,
  getRadiusClass,
  TYPOGRAPHY,
  TEXT_COLORS,
  SHADOWS,
  TRANSITIONS,
  SCALE,
} from '../../design-system/theme';

// Props for note card
export interface NoteCardProps {
  note: AIProcessResult['notes'][0];
  onEdit: (note: AIProcessResult['notes'][0]) => void;
  onDelete: () => void;
  isDeleted?: boolean;
}

// Props for task card
export interface TaskCardProps {
  task: AIProcessResult['tasks'][0];
  onEdit: (task: AIProcessResult['tasks'][0]) => void;
  onDelete: () => void;
  isDeleted?: boolean;
}

/**
 * Card for displaying and editing notes from capture results
 */
export function NoteCard({ note, onEdit, onDelete, isDeleted = false }: NoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNote, setEditedNote] = useState(note);

  const handleSaveEdit = () => {
    onEdit(editedNote);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedNote(note);
    setIsEditing(false);
  };

  return (
    <div
      className={`
        ${getGlassClasses('medium')} ${getRadiusClass('card')}
        border-2 ${isDeleted ? 'border-red-300 opacity-50' : 'border-white/60'}
        ${SHADOWS.card} ${TRANSITIONS.standard}
        ${SCALE.subtleHover}
        p-5
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 text-left w-full group"
          >
            <div className={`flex-shrink-0 p-2 ${getRadiusClass('element')} bg-gradient-to-br from-amber-100 to-yellow-100 group-hover:from-amber-200 group-hover:to-yellow-200 transition-all`}>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-amber-700" />
              ) : (
                <ChevronRight className="w-4 h-4 text-amber-700" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`${TYPOGRAPHY.body.large} font-semibold ${TEXT_COLORS.primary} group-hover:text-cyan-600 ${TRANSITIONS.fast}`}>
                {note.summary}
              </h3>
              {!isExpanded && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary} flex items-center gap-1`}>
                    <FileText className="w-3 h-3" />
                    {note.topicName}
                  </span>
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {note.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className={`px-2 py-0.5 ${getRadiusClass('pill')} ${TYPOGRAPHY.caption} bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-700 font-medium`}
                        >
                          #{tag}
                        </span>
                      ))}
                      {note.tags.length > 3 && (
                        <span className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary}`}>
                          +{note.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isDeleted ? (
            <span className={`px-3 py-1.5 ${getRadiusClass('pill')} ${TYPOGRAPHY.caption} bg-red-100 text-red-700 font-semibold`}>
              Marked for deletion
            </span>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`p-2 ${getRadiusClass('element')} ${getGlassClasses('subtle')} hover:bg-white/80 ${TEXT_COLORS.secondary} hover:text-cyan-600 ${TRANSITIONS.fast} ${SCALE.iconButtonHover} ${SCALE.iconButtonActive}`}
                title="Edit note"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className={`p-2 ${getRadiusClass('element')} bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-900 ${TRANSITIONS.fast} ${SCALE.iconButtonHover} ${SCALE.iconButtonActive}`}
                title="Delete note"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-5 space-y-4 pl-12">
          {isEditing ? (
            // Edit mode
            <div className="space-y-4">
              <div>
                <label className={`block ${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} font-semibold uppercase tracking-wide mb-2`}>
                  Summary
                </label>
                <input
                  type="text"
                  value={editedNote.summary}
                  onChange={(e) => setEditedNote({ ...editedNote, summary: e.target.value })}
                  className={`w-full px-4 py-2.5 ${getRadiusClass('field')} ${getGlassClasses('subtle')} border-2 border-white/60 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 ${TYPOGRAPHY.body.default} ${TRANSITIONS.fast} outline-none`}
                />
              </div>

              <div>
                <label className={`block ${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} font-semibold uppercase tracking-wide mb-2`}>
                  Content
                </label>
                <textarea
                  value={editedNote.content}
                  onChange={(e) => setEditedNote({ ...editedNote, content: e.target.value })}
                  rows={8}
                  className={`w-full px-4 py-3 ${getRadiusClass('field')} ${getGlassClasses('subtle')} border-2 border-white/60 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 ${TYPOGRAPHY.body.default} ${TRANSITIONS.fast} outline-none font-mono leading-relaxed`}
                />
              </div>

              <div>
                <label className={`block ${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} font-semibold uppercase tracking-wide mb-2`}>
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={editedNote.tags?.join(', ') || ''}
                  onChange={(e) => setEditedNote({ ...editedNote, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  placeholder="tag1, tag2, tag3"
                  className={`w-full px-4 py-2.5 ${getRadiusClass('field')} ${getGlassClasses('subtle')} border-2 border-white/60 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 ${TYPOGRAPHY.body.default} ${TRANSITIONS.fast} outline-none`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveEdit}
                  className={`px-5 py-2.5 ${getRadiusClass('field')} ${TYPOGRAPHY.label.default} bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold ${SHADOWS.button} shadow-cyan-200/30 ${TRANSITIONS.standard} ${SCALE.buttonHover} ${SCALE.buttonActive} flex items-center gap-2`}
                >
                  <Check className="w-4 h-4" />
                  Save Changes
                </button>
                <button
                  onClick={handleCancelEdit}
                  className={`px-5 py-2.5 ${getRadiusClass('field')} ${TYPOGRAPHY.label.default} ${getGlassClasses('medium')} hover:${getGlassClasses('strong')} ${TEXT_COLORS.primary} font-semibold border-2 border-white/60 ${TRANSITIONS.standard} ${SCALE.buttonHover} ${SCALE.buttonActive} flex items-center gap-2`}
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // View mode
            <>
              <div>
                <div className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} font-semibold uppercase tracking-wide mb-2`}>
                  Content
                </div>
                <div className={`${TYPOGRAPHY.body.default} ${TEXT_COLORS.secondary} whitespace-pre-wrap leading-relaxed`}>
                  {note.content}
                </div>
              </div>

              {note.keyPoints && note.keyPoints.length > 0 && (
                <div className={`p-4 ${getRadiusClass('field')} bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-200/60`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-cyan-600" />
                    <div className={`${TYPOGRAPHY.caption} font-semibold uppercase tracking-wide text-cyan-900`}>
                      Key Points
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {note.keyPoints.map((point, i) => (
                      <li key={i} className={`${TYPOGRAPHY.body.default} text-cyan-900 flex items-start gap-2`}>
                        <span className="text-cyan-600 font-bold mt-0.5">•</span>
                        <span className="flex-1">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {note.tags.map((tag, i) => (
                    <span
                      key={i}
                      className={`px-3 py-1.5 ${getRadiusClass('pill')} ${TYPOGRAPHY.caption} bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-700 font-medium`}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {note.sentiment && (
                <div className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary} flex items-center gap-2`}>
                  <span className="font-semibold">Sentiment:</span>
                  <span className={`px-2 py-0.5 ${getRadiusClass('pill')} ${
                    note.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                    note.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  } capitalize font-medium`}>
                    {note.sentiment}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Card for displaying and editing tasks from capture results
 */
export function TaskCard({ task, onEdit, onDelete, isDeleted = false }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState(task);

  const handleSaveEdit = () => {
    onEdit(editedTask);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedTask(task);
    setIsEditing(false);
  };

  const priorityColors = {
    urgent: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', gradient: 'from-red-100 to-rose-100' },
    high: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', gradient: 'from-orange-100 to-amber-100' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', gradient: 'from-yellow-100 to-amber-100' },
    low: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', gradient: 'from-green-100 to-emerald-100' },
  };

  const formatDueDate = (date?: string, time?: string) => {
    if (!date) return null;
    const dateObj = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dateStr = '';
    if (dateObj.toDateString() === today.toDateString()) {
      dateStr = 'Today';
    } else if (dateObj.toDateString() === tomorrow.toDateString()) {
      dateStr = 'Tomorrow';
    } else {
      dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    if (time) {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      dateStr += ` at ${displayHour}:${minutes} ${ampm}`;
    }

    return dateStr;
  };

  const dueDateFormatted = formatDueDate(task.dueDate, task.dueTime);
  const colors = priorityColors[task.priority];

  return (
    <div
      className={`
        ${getGlassClasses('medium')} ${getRadiusClass('card')}
        border-2 ${isDeleted ? 'border-red-300 opacity-50' : `border-l-4 ${colors.border} border-t-2 border-r-2 border-b-2 border-t-white/60 border-r-white/60 border-b-white/60`}
        ${SHADOWS.card} ${TRANSITIONS.standard}
        ${SCALE.subtleHover}
        p-5
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 text-left w-full group"
          >
            <div className={`flex-shrink-0 p-2 ${getRadiusClass('element')} bg-gradient-to-br ${colors.gradient} group-hover:opacity-80 transition-all`}>
              {isExpanded ? (
                <ChevronDown className={`w-4 h-4 ${colors.text}`} />
              ) : (
                <ChevronRight className={`w-4 h-4 ${colors.text}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`${TYPOGRAPHY.body.large} font-semibold ${TEXT_COLORS.primary} group-hover:text-cyan-600 ${TRANSITIONS.fast}`}>
                {task.title}
              </h3>
              {!isExpanded && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`px-2.5 py-1 ${getRadiusClass('pill')} ${TYPOGRAPHY.caption} ${colors.bg} ${colors.text} capitalize font-semibold`}>
                    {task.priority}
                  </span>
                  {dueDateFormatted && (
                    <span className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary} flex items-center gap-1`}>
                      <CheckSquare className="w-3 h-3" />
                      {dueDateFormatted}
                    </span>
                  )}
                </div>
              )}
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isDeleted ? (
            <span className={`px-3 py-1.5 ${getRadiusClass('pill')} ${TYPOGRAPHY.caption} bg-red-100 text-red-700 font-semibold`}>
              Marked for deletion
            </span>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`p-2 ${getRadiusClass('element')} ${getGlassClasses('subtle')} hover:bg-white/80 ${TEXT_COLORS.secondary} hover:text-cyan-600 ${TRANSITIONS.fast} ${SCALE.iconButtonHover} ${SCALE.iconButtonActive}`}
                title="Edit task"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className={`p-2 ${getRadiusClass('element')} bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-900 ${TRANSITIONS.fast} ${SCALE.iconButtonHover} ${SCALE.iconButtonActive}`}
                title="Delete task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-5 space-y-4 pl-12">
          {isEditing ? (
            // Edit mode
            <div className="space-y-4">
              <div>
                <label className={`block ${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} font-semibold uppercase tracking-wide mb-2`}>
                  Title
                </label>
                <input
                  type="text"
                  value={editedTask.title}
                  onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                  className={`w-full px-4 py-2.5 ${getRadiusClass('field')} ${getGlassClasses('subtle')} border-2 border-white/60 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 ${TYPOGRAPHY.body.default} ${TRANSITIONS.fast} outline-none`}
                />
              </div>

              <div>
                <label className={`block ${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} font-semibold uppercase tracking-wide mb-2`}>
                  Description
                </label>
                <textarea
                  value={editedTask.description || ''}
                  onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                  rows={4}
                  className={`w-full px-4 py-3 ${getRadiusClass('field')} ${getGlassClasses('subtle')} border-2 border-white/60 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 ${TYPOGRAPHY.body.default} ${TRANSITIONS.fast} outline-none leading-relaxed`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block ${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} font-semibold uppercase tracking-wide mb-2`}>
                    Priority
                  </label>
                  <select
                    value={editedTask.priority}
                    onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value as any })}
                    className={`w-full px-4 py-2.5 ${getRadiusClass('field')} ${getGlassClasses('subtle')} border-2 border-white/60 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 ${TYPOGRAPHY.body.default} ${TRANSITIONS.fast} outline-none`}
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className={`block ${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} font-semibold uppercase tracking-wide mb-2`}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editedTask.dueDate || ''}
                    onChange={(e) => setEditedTask({ ...editedTask, dueDate: e.target.value })}
                    className={`w-full px-4 py-2.5 ${getRadiusClass('field')} ${getGlassClasses('subtle')} border-2 border-white/60 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 ${TYPOGRAPHY.body.default} ${TRANSITIONS.fast} outline-none`}
                  />
                </div>
              </div>

              <div>
                <label className={`block ${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} font-semibold uppercase tracking-wide mb-2`}>
                  Due Time
                </label>
                <input
                  type="time"
                  value={editedTask.dueTime || ''}
                  onChange={(e) => setEditedTask({ ...editedTask, dueTime: e.target.value })}
                  className={`w-full px-4 py-2.5 ${getRadiusClass('field')} ${getGlassClasses('subtle')} border-2 border-white/60 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 ${TYPOGRAPHY.body.default} ${TRANSITIONS.fast} outline-none`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveEdit}
                  className={`px-5 py-2.5 ${getRadiusClass('field')} ${TYPOGRAPHY.label.default} bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold ${SHADOWS.button} shadow-cyan-200/30 ${TRANSITIONS.standard} ${SCALE.buttonHover} ${SCALE.buttonActive} flex items-center gap-2`}
                >
                  <Check className="w-4 h-4" />
                  Save Changes
                </button>
                <button
                  onClick={handleCancelEdit}
                  className={`px-5 py-2.5 ${getRadiusClass('field')} ${TYPOGRAPHY.label.default} ${getGlassClasses('medium')} hover:${getGlassClasses('strong')} ${TEXT_COLORS.primary} font-semibold border-2 border-white/60 ${TRANSITIONS.standard} ${SCALE.buttonHover} ${SCALE.buttonActive} flex items-center gap-2`}
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // View mode
            <>
              {task.description && (
                <div>
                  <div className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} font-semibold uppercase tracking-wide mb-2`}>
                    Description
                  </div>
                  <p className={`${TYPOGRAPHY.body.default} ${TEXT_COLORS.secondary} leading-relaxed`}>
                    {task.description}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 items-center">
                <span className={`px-3 py-1.5 ${getRadiusClass('pill')} ${TYPOGRAPHY.caption} ${colors.bg} ${colors.text} capitalize font-semibold`}>
                  {task.priority} priority
                </span>
                {dueDateFormatted && (
                  <span className={`px-3 py-1.5 ${getRadiusClass('pill')} ${TYPOGRAPHY.caption} ${getGlassClasses('subtle')} ${TEXT_COLORS.secondary} border border-white/60`}>
                    Due: {dueDateFormatted}
                  </span>
                )}
              </div>

              {task.suggestedSubtasks && task.suggestedSubtasks.length > 0 && (
                <div className={`p-4 ${getRadiusClass('field')} bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200/60`}>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckSquare className="w-4 h-4 text-purple-600" />
                    <div className={`${TYPOGRAPHY.caption} font-semibold uppercase tracking-wide text-purple-900`}>
                      Suggested Subtasks
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {task.suggestedSubtasks.map((subtask, i) => (
                      <li key={i} className={`${TYPOGRAPHY.body.default} text-purple-900 flex items-start gap-2`}>
                        <span className="text-purple-600 font-bold mt-0.5">•</span>
                        <span className="flex-1">{subtask}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {task.dueDateReasoning && (
                <div className={`p-3 ${getRadiusClass('field')} bg-amber-50 border-2 border-amber-200/60 flex items-start gap-2`}>
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className={`${TYPOGRAPHY.caption} text-amber-900`}>
                    {task.dueDateReasoning}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
