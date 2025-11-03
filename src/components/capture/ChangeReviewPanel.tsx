import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit, GitMerge, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { getGlassClasses, getRadiusClass, SHADOWS, TYPOGRAPHY, TEXT_COLORS, TRANSITIONS } from '../../design-system/theme';
import type { Note, Task, AIProcessResult } from '../../types';
import { NoteDiffCard } from './NoteDiffCard';
import { MergePreviewCard } from './MergePreviewCard';
import { TaskChangeCard } from './TaskChangeCard';

interface ChangeReviewPanelProps {
  notes: AIProcessResult['notes'];
  tasks: AIProcessResult['tasks'];
  onApproveNote: (noteId: string) => void;
  onRejectNote: (noteId: string) => void;
  onApproveTask: (taskId: string) => void;
  onRejectTask: (taskId: string) => void;
  onApproveAll: () => void;
  onRejectAll: () => void;
  existingNotes?: Note[];
  existingTasks?: Task[];
}

/**
 * ChangeReviewPanel - Main orchestrator for AI-proposed changes
 *
 * Groups changes by action type and allows bulk approve/reject.
 * Uses Framer Motion for smooth expand/collapse animations.
 */
export function ChangeReviewPanel({
  notes,
  tasks,
  onApproveNote,
  onRejectNote,
  onApproveTask,
  onRejectTask,
  onApproveAll,
  onRejectAll,
  existingNotes = [],
  existingTasks = [],
}: ChangeReviewPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['updates', 'merges', 'completions', 'skipped'])
  );

  // Group notes by action type
  const noteUpdates = notes.filter(n => n.action === 'update');
  const noteMerges = notes.filter(n => n.action === 'merge');
  const noteCreates = notes.filter(n => n.action === 'create');
  const noteSkips = notes.filter(n => n.action === 'skip');

  // Group tasks by action type
  const taskUpdates = tasks.filter(t => t.action === 'update');
  const taskCompletions = tasks.filter(t => t.action === 'complete');
  const taskCreates = tasks.filter(t => t.action === 'create');
  const taskSkips = tasks.filter(t => t.action === 'skip');

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const totalChanges = noteUpdates.length + noteMerges.length + taskUpdates.length + taskCompletions.length;

  return (
    <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} ${SHADOWS.card} p-6 space-y-6`}>
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`${TYPOGRAPHY.heading.h2} ${TEXT_COLORS.primary}`}>
            Review AI Suggestions
          </h2>
          <p className={`${TYPOGRAPHY.body.default} ${TEXT_COLORS.secondary} mt-1`}>
            {totalChanges} {totalChanges === 1 ? 'change' : 'changes'} detected
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRejectAll}
            className={`
              px-4 py-2 ${getRadiusClass('field')}
              bg-white/60 hover:bg-white/80
              border-2 border-red-300/60 hover:border-red-400/80
              ${TEXT_COLORS.primary} ${TYPOGRAPHY.button.default}
              ${TRANSITIONS.standard}
              flex items-center gap-2
            `}
            aria-label="Reject all changes"
          >
            <XCircle size={16} />
            Reject All
          </button>
          <button
            onClick={onApproveAll}
            className={`
              px-4 py-2 ${getRadiusClass('field')}
              bg-gradient-to-r from-cyan-500 to-blue-500
              hover:from-cyan-600 hover:to-blue-600
              text-white ${TYPOGRAPHY.button.default}
              ${SHADOWS.button} ${TRANSITIONS.standard}
              flex items-center gap-2
            `}
            aria-label="Approve all changes"
          >
            <CheckCircle size={16} />
            Approve All
          </button>
        </div>
      </div>

      {/* Updates Section */}
      {(noteUpdates.length > 0 || taskUpdates.length > 0) && (
        <Section
          title="Updates"
          icon={Edit}
          count={noteUpdates.length + taskUpdates.length}
          expanded={expandedSections.has('updates')}
          onToggle={() => toggleSection('updates')}
          color="blue"
        >
          <div className="space-y-3">
            {noteUpdates.map(note => {
              const existingNote = existingNotes.find(n => n.id === note.targetId);
              return (
                <NoteDiffCard
                  key={note.id}
                  aiNote={note}
                  existingNote={existingNote}
                  onApprove={() => onApproveNote(note.id)}
                  onReject={() => onRejectNote(note.id)}
                />
              );
            })}
            {taskUpdates.map(task => {
              const existingTask = existingTasks.find(t => t.id === task.targetId);
              return (
                <TaskChangeCard
                  key={task.id}
                  aiTask={task}
                  existingTask={existingTask}
                  onApprove={() => onApproveTask(task.id)}
                  onReject={() => onRejectTask(task.id)}
                />
              );
            })}
          </div>
        </Section>
      )}

      {/* Merges Section */}
      {noteMerges.length > 0 && (
        <Section
          title="Merges"
          icon={GitMerge}
          count={noteMerges.length}
          expanded={expandedSections.has('merges')}
          onToggle={() => toggleSection('merges')}
          color="purple"
        >
          <div className="space-y-3">
            {noteMerges.map(note => {
              const targetNote = existingNotes.find(n => n.id === note.targetId);
              const sourceNotes = (note.mergeWith || [])
                .map(id => existingNotes.find(n => n.id === id))
                .filter((n): n is Note => n !== undefined);

              if (!targetNote) return null;

              return (
                <MergePreviewCard
                  key={note.id}
                  aiNote={note}
                  sourceNotes={sourceNotes}
                  targetNote={targetNote}
                  onApprove={() => onApproveNote(note.id)}
                  onReject={() => onRejectNote(note.id)}
                />
              );
            })}
          </div>
        </Section>
      )}

      {/* Completions Section */}
      {taskCompletions.length > 0 && (
        <Section
          title="Completions"
          icon={CheckCircle}
          count={taskCompletions.length}
          expanded={expandedSections.has('completions')}
          onToggle={() => toggleSection('completions')}
          color="green"
        >
          <div className="space-y-3">
            {taskCompletions.map(task => {
              const existingTask = existingTasks.find(t => t.id === task.targetId);
              return (
                <TaskChangeCard
                  key={task.id}
                  aiTask={task}
                  existingTask={existingTask}
                  onApprove={() => onApproveTask(task.id)}
                  onReject={() => onRejectTask(task.id)}
                />
              );
            })}
          </div>
        </Section>
      )}

      {/* Skipped Section */}
      {(noteSkips.length > 0 || taskSkips.length > 0) && (
        <Section
          title="Skipped"
          icon={XCircle}
          count={noteSkips.length + taskSkips.length}
          expanded={expandedSections.has('skipped')}
          onToggle={() => toggleSection('skipped')}
          color="gray"
        >
          <div className="space-y-3">
            {noteSkips.map(note => (
              <SkippedItem
                key={note.id}
                type="note"
                content={note.content}
                reasoning={note.reasoning}
              />
            ))}
            {taskSkips.map(task => (
              <SkippedItem
                key={task.id}
                type="task"
                content={task.title}
                reasoning={task.reasoning}
              />
            ))}
          </div>
        </Section>
      )}

      {/* New creates (no action needed, just FYI) */}
      {(noteCreates.length > 0 || taskCreates.length > 0) && (
        <div className={`${getGlassClasses('subtle')} ${getRadiusClass('element')} p-4 border-2 border-green-300/40`}>
          <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.secondary}`}>
            {noteCreates.length + taskCreates.length} new {noteCreates.length + taskCreates.length === 1 ? 'item' : 'items'} will be created
          </p>
        </div>
      )}
    </div>
  );
}

// Section Header Component
interface SectionProps {
  title: string;
  icon: React.ElementType;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  color: 'blue' | 'purple' | 'green' | 'gray';
  children: React.ReactNode;
}

function Section({ title, icon: Icon, count, expanded, onToggle, color, children }: SectionProps) {
  const colorClasses = {
    blue: 'bg-blue-100/60 border-blue-300/60 text-blue-900',
    purple: 'bg-purple-100/60 border-purple-300/60 text-purple-900',
    green: 'bg-green-100/60 border-green-300/60 text-green-900',
    gray: 'bg-gray-100/60 border-gray-300/60 text-gray-900',
  };

  return (
    <div className="space-y-2">
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center justify-between
          px-4 py-3 ${getRadiusClass('element')}
          ${colorClasses[color]}
          border-2 ${TRANSITIONS.standard}
          hover:shadow-md
        `}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title} section`}
      >
        <div className="flex items-center gap-3">
          <Icon size={20} />
          <span className={`${TYPOGRAPHY.label.default} font-semibold`}>
            {title}
          </span>
          <span className={`
            px-2 py-0.5 ${getRadiusClass('pill')}
            bg-white/60 ${TYPOGRAPHY.badge}
          `}>
            {count}
          </span>
        </div>
        {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Skipped Item Component
interface SkippedItemProps {
  type: 'note' | 'task';
  content: string;
  reasoning?: string;
}

function SkippedItem({ type, content, reasoning }: SkippedItemProps) {
  return (
    <div className={`${getGlassClasses('subtle')} ${getRadiusClass('element')} p-3 border border-gray-300/40`}>
      <div className="flex items-start gap-2">
        <XCircle size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.primary} font-medium`}>
            {type === 'note' ? 'Note' : 'Task'}: {content}
          </p>
          {reasoning && (
            <p className={`${TYPOGRAPHY.body.small} ${TEXT_COLORS.tertiary} mt-1`}>
              {reasoning}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
