import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit, ChevronDown, ChevronUp, Check, X, Sparkles } from 'lucide-react';
import { getGlassClasses, getRadiusClass, SHADOWS, TYPOGRAPHY, TEXT_COLORS, TRANSITIONS } from '../../design-system/theme';
import type { Note, AIProcessResult } from '../../types';

interface NoteDiffCardProps {
  aiNote: AIProcessResult['notes'][0];
  existingNote?: Note;
  onApprove: () => void;
  onReject: () => void;
}

/**
 * NoteDiffCard - Shows before/after diff for note updates
 *
 * Features:
 * - Side-by-side layout (old content | new content)
 * - Highlights added/removed text
 * - AI reasoning displayed in bubble
 * - Collapsed by default, expands on click
 * - Glass morphism styling
 */
export function NoteDiffCard({
  aiNote,
  existingNote,
  onApprove,
  onReject,
}: NoteDiffCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine if this is an update or create
  const isUpdate = aiNote.action === 'update' && existingNote;

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
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} note diff`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Edit size={16} className="text-blue-600" />
          </div>
          <div className="text-left">
            <p className={`${TYPOGRAPHY.label.default} ${TEXT_COLORS.primary} font-semibold`}>
              {isUpdate ? 'Update Note' : 'Create Note'}
            </p>
            <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.secondary}`}>
              {aiNote.summary || 'No summary available'}
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

            {/* Content Diff */}
            <div className="px-4 py-4">
              {isUpdate ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Old Content */}
                  <div>
                    <p className={`${TYPOGRAPHY.label.small} ${TEXT_COLORS.secondary} mb-2 uppercase tracking-wide`}>
                      Current
                    </p>
                    <div className={`
                      ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                      p-3 border-2 border-red-200/60
                      bg-red-50/30
                    `}>
                      <div className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.primary} whitespace-pre-wrap`}>
                        {existingNote?.content || ''}
                      </div>
                      {existingNote?.tags && existingNote.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-red-200/40">
                          {existingNote.tags.map((tag, i) => (
                            <span
                              key={i}
                              className={`
                                px-2 py-0.5 ${getRadiusClass('pill')}
                                bg-red-100/60 text-red-800
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

                  {/* New Content */}
                  <div>
                    <p className={`${TYPOGRAPHY.label.small} ${TEXT_COLORS.secondary} mb-2 uppercase tracking-wide`}>
                      Proposed
                    </p>
                    <div className={`
                      ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                      p-3 border-2 border-green-200/60
                      bg-green-50/30
                    `}>
                      <div className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.primary} whitespace-pre-wrap`}>
                        {aiNote.content}
                      </div>
                      {aiNote.tags && aiNote.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-green-200/40">
                          {aiNote.tags.map((tag, i) => (
                            <span
                              key={i}
                              className={`
                                px-2 py-0.5 ${getRadiusClass('pill')}
                                bg-green-100/60 text-green-800
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
                </div>
              ) : (
                // Create (no diff, just show new content)
                <div>
                  <p className={`${TYPOGRAPHY.label.small} ${TEXT_COLORS.secondary} mb-2 uppercase tracking-wide`}>
                    New Note
                  </p>
                  <div className={`
                    ${getGlassClasses('subtle')} ${getRadiusClass('element')}
                    p-3 border-2 border-green-200/60
                    bg-green-50/30
                  `}>
                    <div className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.primary} whitespace-pre-wrap`}>
                      {aiNote.content}
                    </div>
                    {aiNote.tags && aiNote.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-green-200/40">
                        {aiNote.tags.map((tag, i) => (
                          <span
                            key={i}
                            className={`
                              px-2 py-0.5 ${getRadiusClass('pill')}
                              bg-green-100/60 text-green-800
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
              )}

              {/* Metadata Changes */}
              {isUpdate && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* Sentiment */}
                  {(existingNote?.metadata?.sentiment || aiNote.sentiment) && (
                    <div>
                      <p className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary} mb-1`}>
                        Sentiment
                      </p>
                      <div className="flex items-center gap-2">
                        {existingNote?.metadata?.sentiment && (
                          <span className="px-2 py-1 bg-red-100/60 text-red-800 rounded">
                            {existingNote.metadata.sentiment}
                          </span>
                        )}
                        {aiNote.sentiment && existingNote?.metadata?.sentiment !== aiNote.sentiment && (
                          <>
                            <span>→</span>
                            <span className="px-2 py-1 bg-green-100/60 text-green-800 rounded">
                              {aiNote.sentiment}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Source */}
                  {aiNote.source && (
                    <div>
                      <p className={`${TYPOGRAPHY.caption} ${TEXT_COLORS.tertiary} mb-1`}>
                        Source
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-green-100/60 text-green-800 rounded">
                          {aiNote.source}
                        </span>
                      </div>
                    </div>
                  )}
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
                aria-label="Keep original note"
              >
                <X size={16} />
                Keep Original
              </button>
              <button
                onClick={onApprove}
                className={`
                  px-4 py-2 ${getRadiusClass('field')}
                  bg-gradient-to-r from-green-500 to-emerald-500
                  hover:from-green-600 hover:to-emerald-600
                  text-white ${TYPOGRAPHY.button.default}
                  ${SHADOWS.button} ${TRANSITIONS.standard}
                  flex items-center gap-2
                  min-w-[44px] min-h-[44px]
                `}
                aria-label="Approve update"
              >
                <Check size={16} />
                Approve Update
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
