import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Edit, ChevronDown, ChevronUp, Check, X, Sparkles, AlertCircle, Calendar, Clock } from 'lucide-react';
import { getGlassClasses, getRadiusClass, SHADOWS, TYPOGRAPHY, TEXT_COLORS, TRANSITIONS, PRIORITY_COLORS } from '../../design-system/theme';
import type { Task, AIProcessResult } from '../../types';

interface TaskChangeCardProps {
  aiTask: AIProcessResult['tasks'][0];
  existingTask?: Task;
  onApprove: () => void;
  onReject: () => void;
}

/**
 * TaskChangeCard - Shows task update/completion preview
 *
 * Features:
 * - Shows existing task with changes highlighted
 * - Strike-through if completing
 * - Shows what fields will change if updating
 * - AI reasoning displayed
 * - Uses task priority colors
 */
export function TaskChangeCard({
  aiTask,
  existingTask,
  onApprove,
  onReject,
}: TaskChangeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isComplete = aiTask.action === 'complete';
  const isUpdate = aiTask.action === 'update';
  const isCreate = aiTask.action === 'create';

  // Get priority colors
  const priorityColors = PRIORITY_COLORS[
    aiTask.priority === 'urgent' ? 'critical' :
    aiTask.priority === 'high' ? 'important' :
    aiTask.priority === 'low' ? 'low' :
    'normal'
  ];

  const existingPriorityColors = existingTask ? PRIORITY_COLORS[
    existingTask.priority === 'urgent' ? 'critical' :
    existingTask.priority === 'high' ? 'important' :
    existingTask.priority === 'low' ? 'low' :
    'normal'
  ] : null;

  return (
    <motion.div
      className={`${getGlassClasses('medium')} ${getRadiusClass('card')} ${SHADOWS.card} overflow-hidden`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          w-full flex items-center justify-between
          px-4 py-3 ${TRANSITIONS.standard}
          hover:bg-white/40
        `}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} task change`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`p-2 ${isComplete ? 'bg-green-100' : 'bg-blue-100'} rounded-lg flex-shrink-0`}>
            {isComplete ? (
              <CheckCircle size={16} className="text-green-600" />
            ) : (
              <Edit size={16} className="text-blue-600" />
            )}
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className={`${TYPOGRAPHY.label.default} ${TEXT_COLORS.primary} font-semibold truncate`}>
              {isComplete && 'Complete Task: '}
              {isUpdate && 'Update Task: '}
              {isCreate && 'Create Task: '}
              {aiTask.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`
                px-2 py-0.5 ${getRadiusClass('pill')}
                ${priorityColors.bg} ${priorityColors.text} border ${priorityColors.border}
                ${TYPOGRAPHY.badge}
              `}>
                {aiTask.priority}
              </span>
              {aiTask.dueDate && (
                <span className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.tertiary} flex items-center gap-1`}>
                  <Calendar size={12} />
                  {new Date(aiTask.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t-2 border-white/30"
          >
            {/* AI Reasoning */}
            {aiTask.reasoning && (
              <div className="px-4 py-3 bg-gradient-to-r from-violet-50/60 to-purple-50/60">
                <div className="flex items-start gap-2">
                  <Sparkles size={16} className="text-violet-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`${TYPOGRAPHY.label.small} text-violet-900 font-semibold mb-1`}>
                      AI Reasoning
                    </p>
                    <p className={`${TYPOGRAPHY.body.small} text-violet-800`}>
                      {aiTask.reasoning}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="px-4 py-4 space-y-4">
              {/* Task Content */}
              {isComplete && existingTask ? (
                // Completion View
                <div>
                  <p className={`${TYPOGRAPHY.label.small} ${TEXT_COLORS.secondary} mb-2 uppercase tracking-wide`}>
                    Task to Complete
                  </p>
                  <div className={`
                    ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                    p-3 border-2 border-green-200/60
                    bg-green-50/30
                  `}>
                    <p className={`${TYPOGRAPHY.body.default} ${TEXT_COLORS.primary} font-semibold line-through`}>
                      {existingTask.title}
                    </p>
                    {existingTask.description && (
                      <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.secondary} mt-2 line-through`}>
                        {existingTask.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-green-200/40">
                      <span className={`
                        px-2 py-0.5 ${getRadiusClass('pill')}
                        ${existingPriorityColors?.bg} ${existingPriorityColors?.text}
                        ${TYPOGRAPHY.badge}
                      `}>
                        {existingTask.priority}
                      </span>
                      <span className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.tertiary}`}>
                        Status: {existingTask.status}
                      </span>
                    </div>
                  </div>
                </div>
              ) : isUpdate && existingTask ? (
                // Update View (side-by-side)
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Current Task */}
                  <div>
                    <p className={`${TYPOGRAPHY.label.small} ${TEXT_COLORS.secondary} mb-2 uppercase tracking-wide`}>
                      Current
                    </p>
                    <div className={`
                      ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                      p-3 border-2 border-red-200/60
                      bg-red-50/30
                    `}>
                      <p className={`${TYPOGRAPHY.body.default} ${TEXT_COLORS.primary} font-semibold`}>
                        {existingTask.title}
                      </p>
                      {existingTask.description && (
                        <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.secondary} mt-2`}>
                          {existingTask.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-red-200/40">
                        <span className={`
                          px-2 py-0.5 ${getRadiusClass('pill')}
                          ${existingPriorityColors?.bg} ${existingPriorityColors?.text}
                          ${TYPOGRAPHY.badge}
                        `}>
                          {existingTask.priority}
                        </span>
                        {existingTask.dueDate && (
                          <span className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.tertiary} flex items-center gap-1`}>
                            <Calendar size={12} />
                            {new Date(existingTask.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Proposed Task */}
                  <div>
                    <p className={`${TYPOGRAPHY.label.small} ${TEXT_COLORS.secondary} mb-2 uppercase tracking-wide`}>
                      Proposed
                    </p>
                    <div className={`
                      ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                      p-3 border-2 border-green-200/60
                      bg-green-50/30
                    `}>
                      <p className={`${TYPOGRAPHY.body.default} ${TEXT_COLORS.primary} font-semibold`}>
                        {aiTask.title}
                      </p>
                      {aiTask.description && (
                        <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.secondary} mt-2`}>
                          {aiTask.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-green-200/40">
                        <span className={`
                          px-2 py-0.5 ${getRadiusClass('pill')}
                          ${priorityColors.bg} ${priorityColors.text} border ${priorityColors.border}
                          ${TYPOGRAPHY.badge}
                        `}>
                          {aiTask.priority}
                        </span>
                        {aiTask.dueDate && (
                          <span className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.tertiary} flex items-center gap-1`}>
                            <Calendar size={12} />
                            {new Date(aiTask.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        {aiTask.dueTime && (
                          <span className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.tertiary} flex items-center gap-1`}>
                            <Clock size={12} />
                            {aiTask.dueTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Create View
                <div>
                  <p className={`${TYPOGRAPHY.label.small} ${TEXT_COLORS.secondary} mb-2 uppercase tracking-wide`}>
                    New Task
                  </p>
                  <div className={`
                    ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                    p-3 border-2 border-green-200/60
                    bg-green-50/30
                  `}>
                    <p className={`${TYPOGRAPHY.body.default} ${TEXT_COLORS.primary} font-semibold`}>
                      {aiTask.title}
                    </p>
                    {aiTask.description && (
                      <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.secondary} mt-2`}>
                        {aiTask.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-green-200/40">
                      <span className={`
                        px-2 py-0.5 ${getRadiusClass('pill')}
                        ${priorityColors.bg} ${priorityColors.text} border ${priorityColors.border}
                        ${TYPOGRAPHY.badge}
                      `}>
                        {aiTask.priority}
                      </span>
                      {aiTask.dueDate && (
                        <span className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.tertiary} flex items-center gap-1`}>
                          <Calendar size={12} />
                          {new Date(aiTask.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      {aiTask.dueTime && (
                        <span className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.tertiary} flex items-center gap-1`}>
                          <Clock size={12} />
                          {aiTask.dueTime}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Due Date Reasoning */}
              {aiTask.dueDateReasoning && (
                <div className={`
                  ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                  p-3 border border-blue-200/60
                  bg-blue-50/30
                `}>
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={`${TYPOGRAPHY.label.small} text-blue-900 font-semibold mb-1`}>
                        Due Date Reasoning
                      </p>
                      <p className={`${TYPOGRAPHY.body.small} text-blue-800`}>
                        {aiTask.dueDateReasoning}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Suggested Subtasks */}
              {aiTask.suggestedSubtasks && aiTask.suggestedSubtasks.length > 0 && (
                <div>
                  <p className={`${TYPOGRAPHY.label.small} ${TEXT_COLORS.secondary} mb-2 uppercase tracking-wide`}>
                    Suggested Subtasks
                  </p>
                  <div className={`
                    ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                    p-3 border border-gray-200/60
                  `}>
                    <ul className="space-y-1">
                      {aiTask.suggestedSubtasks.map((subtask, i) => (
                        <li key={i} className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.primary} flex items-start gap-2`}>
                          <span className={`${TEXT_COLORS.tertiary} mt-0.5`}>•</span>
                          <span>{subtask}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Source Excerpt */}
              {aiTask.sourceExcerpt && (
                <div>
                  <p className={`${TYPOGRAPHY.label.small} ${TEXT_COLORS.secondary} mb-2 uppercase tracking-wide`}>
                    Source Text
                  </p>
                  <div className={`
                    ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                    p-3 border border-gray-200/60
                    bg-gray-50/30
                  `}>
                    <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.secondary} italic`}>
                      "{aiTask.sourceExcerpt}"
                    </p>
                  </div>
                </div>
              )}

              {/* Tags */}
              {aiTask.tags && aiTask.tags.length > 0 && (
                <div>
                  <p className={`${TYPOGRAPHY.label.small} ${TEXT_COLORS.secondary} mb-2 uppercase tracking-wide`}>
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {aiTask.tags.map((tag, i) => (
                      <span
                        key={i}
                        className={`
                          px-2 py-0.5 ${getRadiusClass('pill')}
                          bg-gray-100 text-gray-700 border border-gray-300
                          ${TYPOGRAPHY.badge}
                        `}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="px-4 py-3 border-t-2 border-white/30 bg-white/30 flex gap-2 justify-end">
              <button
                onClick={onReject}
                className={`
                  px-4 py-2 ${getRadiusClass('field')}
                  bg-white/80 hover:bg-white
                  border-2 border-gray-300/60 hover:border-gray-400/80
                  ${TEXT_COLORS.primary} ${TYPOGRAPHY.button.default}
                  ${TRANSITIONS.standard}
                  flex items-center gap-2
                  min-w-[44px] min-h-[44px]
                `}
                aria-label="Keep task unchanged"
              >
                <X size={16} />
                Keep Unchanged
              </button>
              <button
                onClick={onApprove}
                className={`
                  px-4 py-2 ${getRadiusClass('field')}
                  bg-gradient-to-r ${isComplete ? 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600' : 'from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'}
                  text-white ${TYPOGRAPHY.button.default}
                  ${SHADOWS.button} ${TRANSITIONS.standard}
                  flex items-center gap-2
                  min-w-[44px] min-h-[44px]
                `}
                aria-label={isComplete ? 'Approve completion' : 'Approve task'}
              >
                <Check size={16} />
                {isComplete ? 'Mark Complete' : 'Approve'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
