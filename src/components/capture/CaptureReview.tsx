import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, Save, X } from 'lucide-react';
import type { CaptureResult, RefinementRequest, RefinementResponse } from '../../types/captureProcessing';
import type { AIProcessResult } from '../../types';
import { CaptureRefinementInput } from './CaptureRefinementInput';
import { NoteCard, TaskCard } from './CaptureResultCard';
import {
  BACKGROUND_GRADIENT,
  getGlassClasses,
  getRadiusClass,
  TYPOGRAPHY,
  TEXT_COLORS,
  SHADOWS,
  TRANSITIONS,
  SCALE,
  CONTROL_SIZES,
  BORDER_STYLES,
  GLASS_STYLES,
} from '../../design-system/theme';
import { SpaceMenuBar } from '../SpaceMenuBar';
import { motion } from 'framer-motion';

export interface CaptureReviewProps {
  result: CaptureResult;
  onSave: (editedResult: CaptureResult) => void;
  onCancel: () => void;
  onRefine: (request: RefinementRequest) => Promise<RefinementResponse>;
}

/**
 * Full-page review interface for capture results
 * Matches LibraryZone / NoteDetailInline structure
 */
export function CaptureReview({
  result,
  onSave,
  onCancel,
  onRefine,
}: CaptureReviewProps) {
  const [currentResult, setCurrentResult] = useState(result);
  const [deletedNoteIndices, setDeletedNoteIndices] = useState<Set<number>>(new Set());
  const [deletedTaskIndices, setDeletedTaskIndices] = useState<Set<number>>(new Set());
  const [editedNotes, setEditedNotes] = useState<Map<number, AIProcessResult['notes'][0]>>(new Map());
  const [editedTasks, setEditedTasks] = useState<Map<number, AIProcessResult['tasks'][0]>>(new Map());
  const [isRefining, setIsRefining] = useState(false);
  const [refinementError, setRefinementError] = useState<string | null>(null);
  const [showRefinementInput, setShowRefinementInput] = useState(false);

  const handleRefinementRequest = async (message: string) => {
    setIsRefining(true);
    setRefinementError(null);

    try {
      const response = await onRefine({
        userMessage: message,
        currentResult: currentResult,
      });

      if (response.success && response.updatedResult) {
        setCurrentResult(response.updatedResult);
        setDeletedNoteIndices(new Set());
        setDeletedTaskIndices(new Set());
        setEditedNotes(new Map());
        setEditedTasks(new Map());
      } else {
        setRefinementError(response.error || 'Failed to process request');
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Maximum refinement iterations')) {
          setRefinementError('Maximum refinement attempts reached. Please save or cancel.');
        } else {
          setRefinementError('Unable to process refinement. Please try again.');
        }
      }
    } finally {
      setIsRefining(false);
    }
  };

  const handleSaveAll = () => {
    const finalNotes = currentResult.notes
      ?.filter((_, idx) => !deletedNoteIndices.has(idx))
      .map((note, idx) => editedNotes.get(idx) || note) || [];

    const finalTasks = currentResult.tasks
      ?.filter((_, idx) => !deletedTaskIndices.has(idx))
      .map((task, idx) => editedTasks.get(idx) || task) || [];

    onSave({
      ...currentResult,
      notes: finalNotes.length > 0 ? finalNotes : currentResult.notes,
      tasks: finalTasks.length > 0 ? finalTasks : currentResult.tasks,
    });
  };

  const hasNotes = currentResult.notes && currentResult.notes.length > 0;
  const hasTasks = currentResult.tasks && currentResult.tasks.length > 0;
  const activeNoteCount = currentResult.notes?.length ? currentResult.notes.length - deletedNoteIndices.size : 0;
  const activeTaskCount = currentResult.tasks?.length ? currentResult.tasks.length - deletedTaskIndices.size : 0;

  return (
    <div className={`h-full w-full relative flex flex-col ${BACKGROUND_GRADIENT.primary}`}>
      {/* Background gradient overlay */}
      <div className={`absolute inset-0 ${BACKGROUND_GRADIENT.secondary} pointer-events-none will-change-transform`} />

      <div className="relative z-10 flex-1 min-h-0 flex flex-col px-6 pb-6" style={{ paddingTop: '110px' }}>
        {/* Top Menu Bar (matches LibraryZone structure) */}
        <motion.div
          className="flex items-center justify-between gap-4 mb-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={`${GLASS_STYLES.menuBar} rounded-[9999px] ${BORDER_STYLES.menuBar} ${SHADOWS.elevated} px-4 py-2`}>
            <SpaceMenuBar
              primaryAction={{
                label: 'Request Changes',
                icon: <Sparkles size={16} />,
                onClick: () => setShowRefinementInput(!showRefinementInput),
                gradient: 'ocean',
              }}
              glassDropdowns={undefined}
              filters={undefined}
              stats={undefined}
              className=""
            >
              {/* Save Button */}
              <motion.button
                layout
                onClick={handleSaveAll}
                disabled={isRefining || (activeNoteCount === 0 && activeTaskCount === 0)}
                className={`${CONTROL_SIZES.menuBar.button.primary} ${BORDER_STYLES.menuBar} rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                  isRefining || (activeNoteCount === 0 && activeTaskCount === 0)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 shadow-cyan-200/40'
                } ${SHADOWS.button} focus:ring-2 focus:ring-cyan-400 outline-none`}
                transition={{
                  layout: { type: "spring", stiffness: 400, damping: 30 }
                }}
              >
                <Save size={16} />
                <span>Save {activeNoteCount + activeTaskCount > 0 && `${activeNoteCount + activeTaskCount}`}</span>
              </motion.button>

              {/* Cancel Button */}
              <motion.button
                layout
                onClick={onCancel}
                disabled={isRefining}
                className={`${CONTROL_SIZES.menuBar.button.secondary} ${GLASS_STYLES.menuBar} ${BORDER_STYLES.menuBar} rounded-full text-sm font-semibold text-gray-700 hover:bg-white/70 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-gray-400 outline-none`}
                transition={{
                  layout: { type: "spring", stiffness: 400, damping: 30 }
                }}
              >
                <X size={16} />
                <span>Cancel</span>
              </motion.button>
            </SpaceMenuBar>
          </div>

          {/* Stats pill */}
          <div className={`flex items-center gap-2 ${TYPOGRAPHY.body.small} ${TEXT_COLORS.secondary} ${GLASS_STYLES.control} px-4 py-2 rounded-[9999px] border border-white/60`}>
            <span>{activeNoteCount + activeTaskCount} total</span>
          </div>
        </motion.div>

        {/* Refinement Input Area (collapsible) */}
        {showRefinementInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 space-y-2"
          >
            <CaptureRefinementInput
              onSubmit={handleRefinementRequest}
              isLoading={isRefining}
            />

            {refinementError && (
              <div className={`p-3 ${getRadiusClass('field')} bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300/60 flex items-start gap-2`}>
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className={`${TYPOGRAPHY.body.small} text-red-700`}>
                  {refinementError}
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Main Content Area - Wrapped in rounded card */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className={`flex-1 min-h-0 flex flex-col ${getGlassClasses('medium')} ${getRadiusClass('card')} border-2 border-white/60 ${SHADOWS.card} overflow-hidden`}>
            {/* Compact Header */}
            <div className={`flex-shrink-0 border-b-2 border-white/30 px-8 py-6`}>
              <div className="max-w-5xl mx-auto flex items-start justify-between gap-8">
                <div className="flex-1 min-w-0 space-y-3">
                  {/* AI Summary Title - Friendly welcome message */}
                  <h1 className={`${TYPOGRAPHY.heading.h1} ${TEXT_COLORS.primary}`}>
                    {currentResult.aiSummary}
                  </h1>

                  {/* Metadata Badges */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-3 py-1 ${getRadiusClass('pill')} ${TYPOGRAPHY.label.small} ${getGlassClasses('subtle')} ${TEXT_COLORS.secondary} border border-white/40`}>
                      {currentResult.modelUsed}
                    </span>
                    <span className={`px-3 py-1 ${getRadiusClass('pill')} ${TYPOGRAPHY.label.small} ${getGlassClasses('subtle')} ${TEXT_COLORS.secondary} border border-white/40`}>
                      {currentResult.processingTimeMs}ms
                    </span>
                    {currentResult.conversationContext.iterationCount > 0 && (
                      <span className={`px-3 py-1 ${getRadiusClass('pill')} ${TYPOGRAPHY.label.small} bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-700 border border-cyan-300/60`}>
                        {currentResult.conversationContext.iterationCount} refinement{currentResult.conversationContext.iterationCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="px-8 py-6 max-w-5xl mx-auto space-y-6">
              {/* Notes Section */}
              {hasNotes && (
                <div className="space-y-4">
                  <h2 className={`${TYPOGRAPHY.heading.h2} ${TEXT_COLORS.primary}`}>
                    Notes ({activeNoteCount})
                  </h2>

                  <div className="space-y-3">
                    {currentResult.notes!.map((note, index) => {
                      const isDeleted = deletedNoteIndices.has(index);

                      return (
                        <NoteCard
                          key={index}
                          note={note}
                          onEdit={(editedNote) => {
                            const newEditedNotes = new Map(editedNotes);
                            newEditedNotes.set(index, editedNote);
                            setEditedNotes(newEditedNotes);
                          }}
                          onDelete={() => {
                            const newDeleted = new Set(deletedNoteIndices);
                            if (newDeleted.has(index)) {
                              newDeleted.delete(index);
                            } else {
                              newDeleted.add(index);
                            }
                            setDeletedNoteIndices(newDeleted);
                          }}
                          isDeleted={isDeleted}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tasks Section */}
              {hasTasks && (
                <div className="space-y-4">
                  <h2 className={`${TYPOGRAPHY.heading.h2} ${TEXT_COLORS.primary}`}>
                    Tasks ({activeTaskCount})
                  </h2>

                  <div className="space-y-3">
                    {currentResult.tasks!.map((task, index) => {
                      const isDeleted = deletedTaskIndices.has(index);

                      return (
                        <TaskCard
                          key={index}
                          task={task}
                          onEdit={(editedTask) => {
                            const newEditedTasks = new Map(editedTasks);
                            newEditedTasks.set(index, editedTask);
                            setEditedTasks(newEditedTasks);
                          }}
                          onDelete={() => {
                            const newDeleted = new Set(deletedTaskIndices);
                            if (newDeleted.has(index)) {
                              newDeleted.delete(index);
                            } else {
                              newDeleted.add(index);
                            }
                            setDeletedTaskIndices(newDeleted);
                          }}
                          isDeleted={isDeleted}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!hasNotes && !hasTasks && (
                <div className="p-12 text-center">
                  <p className={`${TYPOGRAPHY.body.large} ${TEXT_COLORS.tertiary}`}>
                    No notes or tasks were created from this capture.
                  </p>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading overlay during refinement */}
      {isRefining && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`p-6 ${getRadiusClass('card')} ${getGlassClasses('strong')} ${SHADOWS.modal} flex items-center gap-3`}>
            <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
            <p className={`${TYPOGRAPHY.body.default} ${TEXT_COLORS.primary} font-medium`}>
              Processing your request...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
