import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Edit2, Trash2, X, Check, AlertCircle, Sparkles, FileText, CheckSquare, Hash, Clock, AlertOctagon, ChevronUp } from 'lucide-react';
import type { AIProcessResult } from '../../types';
import {
  getGlassClasses,
  getRadiusClass,
  TYPOGRAPHY,
  TEXT_COLORS,
  SHADOWS,
  TRANSITIONS,
  SCALE,
  ICON_SIZES,
  PRIORITY_COLORS,
} from '../../design-system/theme';

// Color system for sentiment and priority
const sentimentColors = {
  positive: {
    border: 'border-l-green-400 dark:border-l-green-500',
    bg: 'bg-green-50/30 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-400'
  },
  neutral: {
    border: 'border-l-blue-400 dark:border-l-blue-500',
    bg: 'bg-blue-50/30 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-400'
  },
  negative: {
    border: 'border-l-red-400 dark:border-l-red-500',
    bg: 'bg-red-50/30 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-400'
  }
};

const priorityGradients = {
  urgent: 'bg-gradient-to-r from-red-500/10 to-transparent dark:from-red-500/20 dark:to-transparent',
  high: 'bg-gradient-to-r from-orange-500/10 to-transparent dark:from-orange-500/20 dark:to-transparent',
  medium: 'bg-gradient-to-r from-yellow-500/10 to-transparent dark:from-yellow-500/20 dark:to-transparent',
  low: 'bg-gradient-to-r from-green-500/10 to-transparent dark:from-green-500/20 dark:to-transparent'
};

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

  // Get sentiment colors
  const sentiment = note.sentiment || 'neutral';
  const colors = sentimentColors[sentiment as keyof typeof sentimentColors] || sentimentColors.neutral;

  return (
    <div
      className={`
        ${getGlassClasses('medium')} ${getRadiusClass('card')}
        border-l-4 ${colors.border}
        border-t-2 border-r-2 border-b-2
        ${isDeleted ? 'border-t-red-300 border-r-red-300 border-b-red-300 opacity-50' : 'border-t-white/60 border-r-white/60 border-b-white/60 dark:border-t-gray-700/60 dark:border-r-gray-700/60 dark:border-b-gray-700/60'}
        ${SHADOWS.card} ${TRANSITIONS.standard}
        hover:scale-[1.01] transition-transform duration-200
        p-5
        dark:bg-gray-900/50
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 text-left w-full group"
          >
            <div className={`flex-shrink-0 p-2 ${getRadiusClass('element')} bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/40 group-hover:from-amber-200 group-hover:to-yellow-200 dark:group-hover:from-amber-800/60 dark:group-hover:to-yellow-800/60 transition-all shadow-sm group-hover:shadow-md`}>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`${TYPOGRAPHY.body.large} font-semibold ${TEXT_COLORS.primary} dark:text-gray-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 ${TRANSITIONS.fast}`}>
                {note.summary}
              </h3>
              {!isExpanded && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {note.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className={`px-3 py-1 ${getRadiusClass('pill')} ${TYPOGRAPHY.caption} bg-gradient-to-r from-cyan-400/20 to-blue-400/20 dark:from-cyan-500/30 dark:to-blue-500/30 text-cyan-700 dark:text-cyan-300 font-medium border border-cyan-300/40 dark:border-cyan-600/40`}
                        >
                          #{tag}
                        </span>
                      ))}
                      {note.tags.length > 3 && (
                        <span className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary} dark:text-gray-400`}>
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
            <span className={`px-3 py-1.5 ${getRadiusClass('pill')} ${TYPOGRAPHY.caption} bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-semibold border border-red-200 dark:border-red-800/60`}>
              Marked for deletion
            </span>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`p-2 ${getRadiusClass('element')} ${getGlassClasses('subtle')} hover:bg-white/80 dark:hover:bg-gray-700/60 ${TEXT_COLORS.secondary} dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 ${TRANSITIONS.fast} ${SCALE.iconButtonHover} ${SCALE.iconButtonActive} border border-white/40 dark:border-gray-700/60`}
                title="Edit note"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className={`p-2 ${getRadiusClass('element')} bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/60 text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 ${TRANSITIONS.fast} ${SCALE.iconButtonHover} ${SCALE.iconButtonActive} border border-red-200 dark:border-red-800/60`}
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
                <label className={`block ${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} dark:text-gray-400 font-semibold uppercase tracking-wide mb-2`}>
                  Summary
                </label>
                <input
                  type="text"
                  value={editedNote.summary}
                  onChange={(e) => setEditedNote({ ...editedNote, summary: e.target.value })}
                  className={`w-full px-4 py-2.5 ${getRadiusClass('field')} ${getGlassClasses('subtle')} dark:bg-gray-800/50 border-2 border-white/60 dark:border-gray-700 focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-400/30 dark:focus:ring-cyan-500/30 ${TYPOGRAPHY.body.default} dark:text-gray-100 ${TRANSITIONS.fast} outline-none`}
                />
              </div>

              <div>
                <label className={`block ${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} dark:text-gray-400 font-semibold uppercase tracking-wide mb-2`}>
                  Content
                </label>
                <textarea
                  value={editedNote.content}
                  onChange={(e) => setEditedNote({ ...editedNote, content: e.target.value })}
                  rows={8}
                  className={`w-full px-4 py-3 ${getRadiusClass('field')} ${getGlassClasses('subtle')} dark:bg-gray-800/50 border-2 border-white/60 dark:border-gray-700 focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-400/30 dark:focus:ring-cyan-500/30 ${TYPOGRAPHY.body.default} dark:text-gray-100 ${TRANSITIONS.fast} outline-none font-mono leading-relaxed`}
                />
              </div>

              <div>
                <label className={`block ${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} dark:text-gray-400 font-semibold uppercase tracking-wide mb-2`}>
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={editedNote.tags?.join(', ') || ''}
                  onChange={(e) => setEditedNote({ ...editedNote, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  placeholder="tag1, tag2, tag3"
                  className={`w-full px-4 py-2.5 ${getRadiusClass('field')} ${getGlassClasses('subtle')} dark:bg-gray-800/50 border-2 border-white/60 dark:border-gray-700 focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-400/30 dark:focus:ring-cyan-500/30 ${TYPOGRAPHY.body.default} dark:text-gray-100 ${TRANSITIONS.fast} outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveEdit}
                  className={`px-6 py-3 ${getRadiusClass('field')} ${TYPOGRAPHY.label.default} bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 dark:from-cyan-600 dark:to-blue-700 dark:hover:from-cyan-700 dark:hover:to-blue-800 text-white font-bold ${SHADOWS.button} shadow-cyan-200/30 dark:shadow-cyan-900/30 ${TRANSITIONS.standard} ${SCALE.buttonHover} ${SCALE.buttonActive} flex items-center gap-2`}
                >
                  <Check className="w-5 h-5" />
                  Save Changes
                </button>
                <button
                  onClick={handleCancelEdit}
                  className={`px-6 py-3 ${getRadiusClass('field')} ${TYPOGRAPHY.label.default} ${getGlassClasses('medium')} dark:bg-gray-800/50 hover:${getGlassClasses('strong')} dark:hover:bg-gray-700/60 ${TEXT_COLORS.primary} dark:text-gray-100 font-bold border-2 border-white/60 dark:border-gray-700 ${TRANSITIONS.standard} ${SCALE.buttonHover} ${SCALE.buttonActive} flex items-center gap-2`}
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // View mode
            <>
              <div>
                <div className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.secondary} dark:text-gray-400 font-bold uppercase tracking-wide mb-2`}>
                  Content
                </div>
                <div className={`${TYPOGRAPHY.body.default} ${TEXT_COLORS.secondary} dark:text-gray-300 whitespace-pre-wrap leading-relaxed`}>
                  {note.content}
                </div>
              </div>

              {note.keyPoints && note.keyPoints.length > 0 && (
                <div className={`p-4 ${getRadiusClass('field')} bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border-2 border-cyan-200/60 dark:border-cyan-700/40`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    <div className={`${TYPOGRAPHY.caption} font-bold uppercase tracking-wide text-cyan-900 dark:text-cyan-300`}>
                      Key Points
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {note.keyPoints.map((point, i) => (
                      <li key={i} className={`${TYPOGRAPHY.body.default} text-cyan-900 dark:text-cyan-200 flex items-start gap-2`}>
                        <span className="text-cyan-600 dark:text-cyan-400 font-bold mt-0.5">•</span>
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
                      className={`px-3 py-1.5 ${getRadiusClass('pill')} ${TYPOGRAPHY.caption} bg-gradient-to-r from-cyan-400/20 to-blue-400/20 dark:from-cyan-500/30 dark:to-blue-500/30 text-cyan-700 dark:text-cyan-300 font-medium border border-cyan-300/40 dark:border-cyan-600/40`}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {note.sentiment && (
                <div className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary} dark:text-gray-400 flex items-center gap-2`}>
                  <span className="font-semibold">Sentiment:</span>
                  <span className={`px-3 py-1 ${getRadiusClass('pill')} ${
                    note.sentiment === 'positive' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700/60' :
                    note.sentiment === 'negative' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700/60' :
                    'bg-gray-100 dark:bg-gray-800/40 text-gray-700 dark:text-gray-400 border border-gray-300 dark:border-gray-700/60'
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
 * Redesigned to match TaskChangeCard elegance with Framer Motion
 */
export function TaskCard({ task, onEdit, onDelete, isDeleted = false }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get priority colors using design system
  const priorityColors = PRIORITY_COLORS[
    task.priority === 'urgent' ? 'critical' :
    task.priority === 'high' ? 'important' :
    task.priority === 'low' ? 'low' :
    'normal'
  ];

  const formatDueDate = (date?: string) => {
    if (!date) return null;
    const dateObj = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateObj.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (dateObj.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const dueDateFormatted = formatDueDate(task.dueDate);

  return (
    <motion.div
      className={`${getGlassClasses('medium')} ${getRadiusClass('card')} ${SHADOWS.card} overflow-hidden ${isDeleted ? 'opacity-50' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        role="button"
        tabIndex={0}
        className={`
          w-full flex items-center justify-between
          px-4 py-3 ${TRANSITIONS.standard}
          hover:bg-white/40 cursor-pointer
        `}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} task`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`p-2 ${priorityColors.bg} rounded-lg flex-shrink-0`}>
            <CheckSquare size={16} className={priorityColors.text} />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className={`${TYPOGRAPHY.label.default} ${TEXT_COLORS.primary} font-semibold truncate`}>
              {task.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`
                px-2 py-0.5 ${getRadiusClass('pill')}
                ${priorityColors.bg} ${priorityColors.text} border ${priorityColors.border}
                ${TYPOGRAPHY.badge}
              `}>
                {task.priority}
              </span>
              {dueDateFormatted && (
                <span className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.tertiary} flex items-center gap-1`}>
                  <Clock size={12} />
                  {dueDateFormatted}
                </span>
              )}
              {task.suggestedSubtasks && task.suggestedSubtasks.length > 0 && (
                <span className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.tertiary} flex items-center gap-1`}>
                  • {task.suggestedSubtasks.length} subtask{task.suggestedSubtasks.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isDeleted ? (
            <span className={`px-3 py-1 ${getRadiusClass('pill')} ${TYPOGRAPHY.caption} bg-red-100 text-red-700 font-semibold border border-red-200`}>
              Deleted
            </span>
          ) : (
            <>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className={`p-2 ${getRadiusClass('element')} bg-red-100 hover:bg-red-200 text-red-700 ${TRANSITIONS.fast} border border-red-200`}
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={18} className={TEXT_COLORS.tertiary} />
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/30 pt-3">
              {task.description && (
                <div>
                  <p className={`${TYPOGRAPHY.body.default} ${TEXT_COLORS.secondary} leading-relaxed`}>
                    {task.description}
                  </p>
                </div>
              )}

              {task.suggestedSubtasks && task.suggestedSubtasks.length > 0 && (
                <div className={`p-3 ${getRadiusClass('field')} bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200/60`}>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckSquare size={14} className="text-purple-600" />
                    <div className={`${TYPOGRAPHY.caption} font-semibold text-purple-900`}>
                      Suggested Subtasks
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {task.suggestedSubtasks.map((subtask, i) => (
                      <li key={i} className={`${TYPOGRAPHY.body.small} text-purple-900 flex items-start gap-2`}>
                        <span className="text-purple-600 font-bold mt-0.5">•</span>
                        <span className="flex-1">{subtask}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {task.dueDateReasoning && (
                <div className={`p-2.5 ${getRadiusClass('field')} bg-amber-50 border border-amber-200/60 flex items-start gap-2`}>
                  <Sparkles size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className={`${TYPOGRAPHY.caption} text-amber-900`}>
                    {task.dueDateReasoning}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
