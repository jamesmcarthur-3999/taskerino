import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Loader2, AlertCircle, Save, X, Bot, FileText } from 'lucide-react';
import type { CaptureResult, RefinementRequest, RefinementResponse } from '../../types/captureProcessing';
import type { AIProcessResult, Task, Note } from '../../types';
import { savePendingReview, deletePendingReview } from '../../services/captureReviewStorage';
import type { PersistedReviewJob } from '../../types/captureProcessing';
import { generateId } from '../../utils/helpers';
import { CaptureRefinementInput } from './CaptureRefinementInput';
import { TaskCard } from './CaptureResultCard';
import { NoteReviewCard } from './NoteReviewCard';
import { NoteDiffCard } from './NoteDiffCard';
import { MergePreviewCard } from './MergePreviewCard';
import { TaskChangeCard } from './TaskChangeCard';
import { useNotes } from '../../context/NotesContext';
import { useTasks } from '../../context/TasksContext';
import { useEntities } from '../../context/EntitiesContext';
import { useRelationships } from '../../context/RelationshipContext';
import { EntityType, RelationshipType } from '../../types/relationships';
import { ENTITY_GRADIENTS } from '../../design-system/theme';
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
  getInfoGradient,
  ICON_SIZES,
} from '../../design-system/theme';
import { SpaceMenuBar } from '../SpaceMenuBar';
import { motion } from 'framer-motion';

export interface CaptureReviewProps {
  result: CaptureResult;
  jobId?: string;  // Optional job ID for persistence (prevents duplicate reviews)
  onSave: (noteIds: string[], editedTasks: Task[], removedTaskIndexes: number[]) => void;
  onCancel: () => void;
  onRefine: (request: RefinementRequest) => Promise<RefinementResponse>;
}

/**
 * Full-page review interface for capture results
 * Uses NoteDetailInline for note editing with TipTap
 * Notes are already created in NotesContext with status='draft'
 */
export function CaptureReview({
  result,
  jobId,
  onSave,
  onCancel,
  onRefine,
}: CaptureReviewProps) {
  const { updateNote, deleteNote, state: notesState } = useNotes();
  const { state: tasksState } = useTasks();
  const { state: entitiesState } = useEntities();
  const { addRelationship } = useRelationships();
  const [currentResult, setCurrentResult] = useState(result);
  const [deletedNoteIds, setDeletedNoteIds] = useState<Set<string>>(new Set());
  const [deletedTaskIndices, setDeletedTaskIndices] = useState<Set<number>>(new Set());
  const [editedTasks, setEditedTasks] = useState<Map<number, AIProcessResult['tasks'][0]>>(new Map());
  const [isRefining, setIsRefining] = useState(false);
  const [refinementError, setRefinementError] = useState<string | null>(null);
  const [showRefinementInput, setShowRefinementInput] = useState(false);

  // Sync result prop to currentResult state (fixes notes disappearing on reopen)
  useEffect(() => {
    console.log('[CaptureReview] Result prop changed, syncing to state. createdNoteIds:', result.createdNoteIds);
    setCurrentResult(result);
    // Reset deletion/edit state when opening a different review
    setDeletedNoteIds(new Set());
    setDeletedTaskIndices(new Set());
    setEditedTasks(new Map());
  }, [result]);

  // Auto-save review state to storage (survives hot reload)
  useEffect(() => {
    if (!currentResult || !jobId) return;  // Skip if no jobId provided (prevents duplicate reviews)

    // Debounce auto-save to avoid excessive writes
    const timer = setTimeout(async () => {
      try {
        const persistedReview: PersistedReviewJob = {
          id: jobId,  // Use provided jobId (not generated) to prevent duplicates
          createdAt: (currentResult as any).createdAt || new Date().toISOString(),
          result: currentResult,
          draftNoteIds: currentResult.createdNoteIds || [],
          status: 'pending_review',
          lastModified: new Date().toISOString(),
        };

        await savePendingReview(persistedReview);
        console.log('[CaptureReview] Auto-saved review state:', jobId);
      } catch (error) {
        console.error('[CaptureReview] Failed to auto-save review:', error);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [currentResult, deletedNoteIds, deletedTaskIndices, editedTasks, jobId]);

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
        setDeletedNoteIds(new Set());
        setDeletedTaskIndices(new Set());
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

  const handleSaveAll = async () => {
    // Get active note IDs (exclude deleted ones)
    const activeNoteIds = (currentResult.createdNoteIds || [])
      .filter(noteId => !deletedNoteIds.has(noteId));

    // Update all active notes to 'approved' status
    await Promise.all(
      activeNoteIds.map(async (noteId) => {
        const note = notesState.notes.find(n => n.id === noteId);
        if (note) {
          await updateNote({
            ...note,
            status: 'approved',
            lastUpdated: new Date().toISOString(),
          });
        }
      })
    );

    // Create relationships from AI suggestions for notes
    const relationshipsForNotes = (currentResult.relationships || []).filter(
      rel => rel.from.type === 'note' && activeNoteIds.includes(rel.from.id)
    );

    await Promise.all(
      relationshipsForNotes.map(async (rel) => {
        if (!rel.to.id) return; // Skip new entities (will be created separately)

        let relType: RelationshipType;
        let targetType: EntityType;

        if (rel.to.type === 'topic') {
          relType = RelationshipType.NOTE_TOPIC;
          targetType = EntityType.TOPIC;
        } else if (rel.to.type === 'company') {
          relType = RelationshipType.NOTE_COMPANY;
          targetType = EntityType.COMPANY;
        } else if (rel.to.type === 'contact') {
          relType = RelationshipType.NOTE_CONTACT;
          targetType = EntityType.CONTACT;
        } else if (rel.to.type === 'note' && rel.to.id) {
          relType = RelationshipType.NOTE_PARENT;
          targetType = EntityType.NOTE;
        } else {
          return;
        }

        await addRelationship({
          sourceType: EntityType.NOTE,
          sourceId: rel.from.id,
          targetType,
          targetId: rel.to.id,
          type: relType,
          metadata: { source: 'ai', createdAt: new Date().toISOString() }
        });
      })
    );

    // Delete the notes marked for deletion
    deletedNoteIds.forEach(noteId => {
      deleteNote(noteId);
    });

    // Get active tasks (apply edits and filter deleted)
    const activeTasks = (currentResult.tasks
      ?.filter((_, idx) => !deletedTaskIndices.has(idx))
      .map((task, idx) => editedTasks.get(idx) || task) || []) as Task[];

    // Create relationships from AI suggestions for tasks
    const relationshipsForTasks = (currentResult.relationships || []).filter(
      rel => rel.from.type === 'task' && activeTasks.some(t => t.id === rel.from.id)
    );

    await Promise.all(
      relationshipsForTasks.map(async (rel) => {
        if (!rel.to.id) return; // Skip new entities (will be created separately)

        let relType: RelationshipType;
        let targetType: EntityType;

        if (rel.to.type === 'topic') {
          relType = RelationshipType.TASK_TOPIC;
          targetType = EntityType.TOPIC;
        } else if (rel.to.type === 'note') {
          relType = RelationshipType.TASK_NOTE;
          targetType = EntityType.NOTE;
        } else if (rel.to.type === 'task') {
          relType = RelationshipType.TASK_TASK;
          targetType = EntityType.TASK;
        } else {
          return;
        }

        await addRelationship({
          sourceType: EntityType.TASK,
          sourceId: rel.from.id,
          targetType,
          targetId: rel.to.id,
          type: relType,
          metadata: { source: 'ai', createdAt: new Date().toISOString() }
        });
      })
    );

    // Get removed task indices
    const removedTaskIndexes = Array.from(deletedTaskIndices);

    // Delete the persisted review from storage (review is complete)
    const jobId = (currentResult as any).jobId;
    if (jobId) {
      try {
        await deletePendingReview(jobId);
        console.log('[CaptureReview] Deleted persisted review on save:', jobId);
      } catch (error) {
        console.error('[CaptureReview] Failed to delete persisted review:', error);
      }
    }

    // Call onSave with new signature
    onSave(activeNoteIds, activeTasks, removedTaskIndexes);
  };

  const handleCancelWithCleanup = async () => {
    // Just close the modal - don't delete notes or persisted review
    // This allows users to close and reopen pending reviews
    onCancel();
  };

  // Check both createdNoteIds (preferred) and notes array (fallback) to handle all code paths
  const hasNotes = (currentResult.createdNoteIds && currentResult.createdNoteIds.length > 0) ||
                   (currentResult.notes && currentResult.notes.length > 0);
  const hasTasks = currentResult.tasks && currentResult.tasks.length > 0;
  // For active count, prioritize createdNoteIds if available, otherwise fall back to notes array
  const activeNoteCount = currentResult.createdNoteIds
    ? currentResult.createdNoteIds.length - deletedNoteIds.size
    : (currentResult.notes?.length || 0) - deletedNoteIds.size;
  const activeTaskCount = currentResult.tasks?.length ? currentResult.tasks.length - deletedTaskIndices.size : 0;

  // Extract all unique relationship IDs from relationships array
  const extractedRelationships = useMemo(() => {
    const topicIds = new Set<string>();
    const companyIds = new Set<string>();
    const contactIds = new Set<string>();

    // Parse relationships array from AI
    (currentResult.relationships || []).forEach(rel => {
      if (rel.to.type === 'topic' && rel.to.id) {
        topicIds.add(rel.to.id);
      }
      if (rel.to.type === 'company' && rel.to.id) {
        companyIds.add(rel.to.id);
      }
      if (rel.to.type === 'contact' && rel.to.id) {
        contactIds.add(rel.to.id);
      }
    });

    return {
      topics: Array.from(topicIds).map(id => entitiesState.topics.find(t => t.id === id)).filter((t): t is NonNullable<typeof t> => t !== null && t !== undefined),
      companies: Array.from(companyIds).map(id => entitiesState.companies.find(c => c.id === id)).filter((c): c is NonNullable<typeof c> => c !== null && c !== undefined),
      contacts: Array.from(contactIds).map(id => entitiesState.contacts.find(c => c.id === id)).filter((c): c is NonNullable<typeof c> => c !== null && c !== undefined),
    };
  }, [currentResult.relationships, entitiesState.topics, entitiesState.companies, entitiesState.contacts]);

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
                gradient: 'purple',
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
                onClick={handleCancelWithCleanup}
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
            {/* AI Message Header - Rich & Engaging */}
            <motion.div
              className={`flex-shrink-0 border-b-2 border-white/30 px-8 py-6`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div className="max-w-5xl mx-auto">
                <div className="flex items-start gap-4">
                  {/* AI Avatar */}
                  <motion.div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 via-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-200/40 flex-shrink-0`}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Bot size={24} className="text-white" />
                  </motion.div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0 space-y-4">
                    {/* AI Summary - Direct from Claude */}
                    <p className={`${TYPOGRAPHY.body.large} ${TEXT_COLORS.primary} leading-relaxed font-medium`}>
                      {currentResult.aiSummary}
                    </p>

                    {/* Relationships Section - Show what AI is connecting */}
                    {(extractedRelationships.topics.length > 0 ||
                      extractedRelationships.companies.length > 0 ||
                      extractedRelationships.contacts.length > 0) && (
                      <div className="space-y-3">
                        <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.secondary} font-semibold`}>
                          Detected relationships:
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {/* Topics */}
                          {extractedRelationships.topics.map((topic: any) => (
                            <span
                              key={topic.id}
                              className={`
                                inline-flex items-center gap-1.5 px-3 py-1.5
                                bg-gradient-to-r ${ENTITY_GRADIENTS.topic.from} ${ENTITY_GRADIENTS.topic.to}
                                border ${ENTITY_GRADIENTS.topic.border}
                                ${getRadiusClass('pill')} text-xs font-semibold ${ENTITY_GRADIENTS.topic.text}
                                ${TRANSITIONS.fast}
                              `}
                            >
                              <span>📌</span>
                              <span>{topic.name}</span>
                            </span>
                          ))}

                          {/* Companies */}
                          {extractedRelationships.companies.map((company: any) => (
                            <span
                              key={company.id}
                              className={`
                                inline-flex items-center gap-1.5 px-3 py-1.5
                                bg-gradient-to-r ${ENTITY_GRADIENTS.company.from} ${ENTITY_GRADIENTS.company.to}
                                border ${ENTITY_GRADIENTS.company.border}
                                ${getRadiusClass('pill')} text-xs font-semibold ${ENTITY_GRADIENTS.company.text}
                                ${TRANSITIONS.fast}
                              `}
                            >
                              <span>🏢</span>
                              <span>{company.name}</span>
                            </span>
                          ))}

                          {/* Contacts */}
                          {extractedRelationships.contacts.map((contact: any) => (
                            <span
                              key={contact.id}
                              className={`
                                inline-flex items-center gap-1.5 px-3 py-1.5
                                bg-gradient-to-r ${ENTITY_GRADIENTS.contact.from} ${ENTITY_GRADIENTS.contact.to}
                                border ${ENTITY_GRADIENTS.contact.border}
                                ${getRadiusClass('pill')} text-xs font-semibold ${ENTITY_GRADIENTS.contact.text}
                                ${TRANSITIONS.fast}
                              `}
                            >
                              <span>👤</span>
                              <span>{contact.name}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Refinement Badge Only */}
                    {currentResult.conversationContext.iterationCount > 0 && (
                      <div className="flex items-center">
                        <span className={`px-3 py-1.5 ${getRadiusClass('pill')} ${TYPOGRAPHY.label.small} bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border border-purple-200/60 shadow-sm flex items-center gap-1`}>
                          <Sparkles size={12} />
                          Refined {currentResult.conversationContext.iterationCount}x
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Scrollable Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="px-8 py-6 max-w-5xl mx-auto space-y-6">
              {/* Notes Section */}
              {hasNotes && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className={`${TYPOGRAPHY.heading.h2} ${TEXT_COLORS.primary}`}>
                      Notes ({activeNoteCount})
                    </h2>
                    <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.secondary}`}>
                      Click to expand and edit with TipTap editor
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Route based on whether we have notes array with action metadata */}
                    {currentResult.notes && currentResult.notes.length > 0 ? (
                      // Has notes array - use sophisticated routing logic
                      currentResult.notes.map((aiNote, index) => {
                        const noteId = currentResult.createdNoteIds?.[index];
                        const note = noteId ? notesState.notes.find(n => n.id === noteId) : undefined;
                        const isDeleted = noteId ? deletedNoteIds.has(noteId) : false;

                        const handleDelete = () => {
                          if (!noteId) return;
                          const newDeleted = new Set(deletedNoteIds);
                          if (newDeleted.has(noteId)) {
                            newDeleted.delete(noteId);
                          } else {
                            newDeleted.add(noteId);
                          }
                          setDeletedNoteIds(newDeleted);
                        };

                        // Route to appropriate card based on action type
                        if (aiNote.action === 'update') {
                          // UPDATE: Show diff card
                          const existingNote = aiNote.targetId ? notesState.notes.find(n => n.id === aiNote.targetId) : undefined;
                          return (
                            <NoteDiffCard
                              key={index}
                              aiNote={aiNote}
                              existingNote={existingNote}
                              onApprove={() => {
                                // Approved - keep in active notes
                              }}
                              onReject={handleDelete}
                            />
                          );
                        } else if (aiNote.action === 'merge') {
                          // MERGE: Show merge preview card
                          const sourceNotes: Note[] = (aiNote.mergeWith || [])
                            .map(id => notesState.notes.find(n => n.id === id))
                            .filter((n): n is Note => n !== undefined);
                          const targetNote = aiNote.targetId ? notesState.notes.find(n => n.id === aiNote.targetId) : note;

                          if (!targetNote) return null;

                          return (
                            <MergePreviewCard
                              key={index}
                              aiNote={aiNote}
                              sourceNotes={sourceNotes}
                              targetNote={targetNote}
                              onApprove={() => {
                                // Approved - keep in active notes
                              }}
                              onReject={handleDelete}
                            />
                          );
                        } else {
                          // CREATE (default): Show standard review card
                          if (!noteId) return null;
                          return (
                            <NoteReviewCard
                              key={noteId}
                              noteId={noteId}
                              onDelete={handleDelete}
                              isDeleted={isDeleted}
                              isRefining={isRefining}
                            />
                          );
                        }
                      })
                    ) : currentResult.createdNoteIds && currentResult.createdNoteIds.length > 0 ? (
                      // No notes array but has createdNoteIds - show simple review cards
                      currentResult.createdNoteIds
                        .filter(noteId => !deletedNoteIds.has(noteId))
                        .map((noteId) => (
                          <NoteReviewCard
                            key={noteId}
                            noteId={noteId}
                            onDelete={() => {
                              const newDeleted = new Set(deletedNoteIds);
                              if (newDeleted.has(noteId)) {
                                newDeleted.delete(noteId);
                              } else {
                                newDeleted.add(noteId);
                              }
                              setDeletedNoteIds(newDeleted);
                            }}
                            isDeleted={deletedNoteIds.has(noteId)}
                            isRefining={isRefining}
                          />
                        ))
                    ) : null}
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
                    {currentResult.tasks!.map((aiTask, index) => {
                      const isDeleted = deletedTaskIndices.has(index);

                      const handleDelete = () => {
                        const newDeleted = new Set(deletedTaskIndices);
                        if (newDeleted.has(index)) {
                          newDeleted.delete(index);
                        } else {
                          newDeleted.add(index);
                        }
                        setDeletedTaskIndices(newDeleted);
                      };

                      const handleEdit = (editedTask: AIProcessResult['tasks'][0]) => {
                        const newEditedTasks = new Map(editedTasks);
                        newEditedTasks.set(index, editedTask);
                        setEditedTasks(newEditedTasks);
                      };

                      // Route to appropriate card based on action type
                      if (aiTask.action === 'update' || aiTask.action === 'complete') {
                        // UPDATE or COMPLETE: Show TaskChangeCard
                        const existingTask = aiTask.targetId ?
                          tasksState.tasks.find(t => t.id === aiTask.targetId) : undefined;

                        return (
                          <TaskChangeCard
                            key={index}
                            aiTask={aiTask}
                            existingTask={existingTask}
                            onApprove={() => {
                              // Approved - keep in active tasks
                            }}
                            onReject={handleDelete}
                          />
                        );
                      } else {
                        // CREATE (default): Show standard task card
                        return (
                          <TaskCard
                            key={index}
                            task={aiTask}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            isDeleted={isDeleted}
                          />
                        );
                      }
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
