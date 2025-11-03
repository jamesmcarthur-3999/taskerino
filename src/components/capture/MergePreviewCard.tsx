import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitMerge, ChevronDown, ChevronUp, Check, X, Sparkles, FileText, ArrowRight } from 'lucide-react';
import { getGlassClasses, getRadiusClass, SHADOWS, TYPOGRAPHY, TEXT_COLORS, TRANSITIONS } from '../../design-system/theme';
import type { Note, AIProcessResult } from '../../types';

interface MergePreviewCardProps {
  aiNote: AIProcessResult['notes'][0];
  sourceNotes: Note[];
  targetNote: Note;
  onApprove: () => void;
  onReject: () => void;
}

/**
 * MergePreviewCard - Shows merge operation preview
 *
 * Features:
 * - Lists source notes that will be deleted
 * - Shows target note receiving merged content
 * - Preview of merged result
 * - Displays merge strategy (append/replace)
 * - AI reasoning prominently displayed
 */
export function MergePreviewCard({
  aiNote,
  sourceNotes,
  targetNote,
  onApprove,
  onReject,
}: MergePreviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const mergeStrategy = aiNote.mergeStrategy || 'append';

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
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} merge preview`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <GitMerge size={16} className="text-purple-600" />
          </div>
          <div className="text-left">
            <p className={`${TYPOGRAPHY.label.default} ${TEXT_COLORS.primary} font-semibold`}>
              Merge {sourceNotes.length} {sourceNotes.length === 1 ? 'Note' : 'Notes'}
            </p>
            <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.secondary}`}>
              Strategy: {mergeStrategy === 'append' ? 'Append content' : 'Replace content'}
            </p>
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
            {aiNote.reasoning && (
              <div className="px-4 py-3 bg-gradient-to-r from-violet-50/60 to-purple-50/60">
                <div className="flex items-start gap-2">
                  <Sparkles size={16} className="text-violet-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`${TYPOGRAPHY.label.small} text-violet-900 font-semibold mb-1`}>
                      AI Reasoning
                    </p>
                    <p className={`${TYPOGRAPHY.body.small} text-violet-800`}>
                      {aiNote.reasoning}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="px-4 py-4 space-y-4">
              {/* Merge Flow Diagram */}
              <div className="flex items-center gap-3 justify-center">
                {/* Source Notes */}
                <div className="flex-1">
                  <p className={`${TYPOGRAPHY.label.small} ${TEXT_COLORS.secondary} mb-2 uppercase tracking-wide text-center`}>
                    Source Notes (Will be deleted)
                  </p>
                  <div className="space-y-2">
                    {sourceNotes.map((note, i) => (
                      <div
                        key={note.id}
                        className={`
                          ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                          p-2 border border-red-200/60
                          bg-red-50/30
                        `}
                      >
                        <div className="flex items-start gap-2">
                          <FileText size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.primary} font-medium truncate`}>
                              {note.summary || `Note ${i + 1}`}
                            </p>
                            <p className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary} line-clamp-2`}>
                              {note.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0 pt-6">
                  <ArrowRight size={24} className="text-purple-600" />
                </div>

                {/* Target Note */}
                <div className="flex-1">
                  <p className={`${TYPOGRAPHY.label.small} ${TEXT_COLORS.secondary} mb-2 uppercase tracking-wide text-center`}>
                    Target Note
                  </p>
                  <div className={`
                    ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                    p-2 border-2 border-green-200/60
                    bg-green-50/30
                  `}>
                    <div className="flex items-start gap-2">
                      <FileText size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.primary} font-medium truncate`}>
                          {targetNote.summary || 'Target note'}
                        </p>
                        <p className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary} line-clamp-2`}>
                          {targetNote.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Merged Result Preview */}
              <div>
                <p className={`${TYPOGRAPHY.label.small} ${TEXT_COLORS.secondary} mb-2 uppercase tracking-wide`}>
                  Merged Result Preview
                </p>
                <div className={`
                  ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                  p-3 border-2 border-purple-200/60
                  bg-purple-50/30
                  max-h-64 overflow-y-auto
                `}>
                  <div className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.primary} whitespace-pre-wrap`}>
                    {aiNote.content}
                  </div>
                  {aiNote.tags && aiNote.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-purple-200/40">
                      {aiNote.tags.map((tag, i) => (
                        <span
                          key={i}
                          className={`
                            px-2 py-0.5 ${getRadiusClass('pill')}
                            bg-purple-100/60 text-purple-800
                            ${TYPOGRAPHY.badge}
                          `}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Strategy Info */}
              <div className={`
                ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                p-3 border border-blue-200/60
                bg-blue-50/30
              `}>
                <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.primary}`}>
                  <strong>Merge Strategy:</strong>{' '}
                  {mergeStrategy === 'append'
                    ? 'New content will be appended to the target note'
                    : 'Target note content will be replaced with merged content'}
                </p>
                <p className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary} mt-1`}>
                  {sourceNotes.length} source {sourceNotes.length === 1 ? 'note' : 'notes'} will be permanently deleted after merge
                </p>
              </div>
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
                aria-label="Keep notes separate"
              >
                <X size={16} />
                Keep Separate
              </button>
              <button
                onClick={onApprove}
                className={`
                  px-4 py-2 ${getRadiusClass('field')}
                  bg-gradient-to-r from-purple-500 to-pink-500
                  hover:from-purple-600 hover:to-pink-600
                  text-white ${TYPOGRAPHY.button.default}
                  ${SHADOWS.button} ${TRANSITIONS.standard}
                  flex items-center gap-2
                  min-w-[44px] min-h-[44px]
                `}
                aria-label="Approve merge"
              >
                <Check size={16} />
                Approve Merge
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
