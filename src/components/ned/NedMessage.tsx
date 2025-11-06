/**
 * Ned Message - Enhanced
 *
 * Main message component for Ned's chat.
 * Renders different content types: text, task lists, note lists, tool use, etc.
 * Now supports all enhanced card features.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Copy, Check, Edit2 } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { NoteCard } from './NoteCard';
import { SessionCard } from './SessionCard';
import ReactMarkdown from 'react-markdown';
import type { Task, Note, Session, Company, Contact } from '../../types';
import { EntityType } from '../../types/relationships';
import { getGlassClasses, getRadiusClass, TRANSITIONS, getInfoGradient, getSuccessGradient } from '../../design-system/theme';
import { TOOL_DESCRIPTIONS } from '../../services/nedTools';

// Snippet component for copyable text content (NOT code)
const TextSnippet = ({ children }: { children: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3">
      <div className={`${getGlassClasses('extra-strong')} ${getRadiusClass('field')} shadow-xl shadow-cyan-100/20 hover:shadow-2xl hover:shadow-cyan-200/30 ${TRANSITIONS.standard} overflow-hidden group ring-1 ring-black/5`}>
        {/* Header with copy button */}
        <div className={`flex items-center justify-between px-5 py-3 ${getInfoGradient('light').container} border-b-2 border-white/50`}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent uppercase tracking-wide">Snippet</span>
          </div>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95
                     ${copied
                       ? `bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-200/50`
                       : `${getGlassClasses('medium')} text-cyan-700 hover:border-cyan-200/80 shadow-md hover:shadow-lg hover:shadow-cyan-100/30`
                     }`}
          >
            {copied ? (
              <>
                <Check size={13} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={13} />
                Copy
              </>
            )}
          </button>
        </div>

        {/* Content */}
        <div className={`p-5 ${getGlassClasses('medium')}`}>
          <div className="text-gray-800 whitespace-pre-wrap leading-relaxed text-[15px] font-medium">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// Inline code component
const InlineCode = ({ children }: { children: string }) => {
  const infoGradient = getInfoGradient('light');
  return (
    <code className={`px-2 py-0.5 ${getRadiusClass('field')} ${infoGradient.container} ${infoGradient.textPrimary} text-sm font-mono font-semibold ring-1 ring-black/5`}>
      {children}
    </code>
  );
};

// Sources section - collapsible container for tasks, notes, and sessions
const SourcesSection = ({
  children,
  taskCount = 0,
  noteCount = 0,
  sessionCount = 0,
  defaultExpanded = false,
}: {
  children: React.ReactNode;
  taskCount?: number;
  noteCount?: number;
  sessionCount?: number;
  defaultExpanded?: boolean;
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const parts = [];
  if (taskCount > 0) parts.push(`${taskCount} task${taskCount !== 1 ? 's' : ''}`);
  if (noteCount > 0) parts.push(`${noteCount} note${noteCount !== 1 ? 's' : ''}`);
  if (sessionCount > 0) parts.push(`${sessionCount} session${sessionCount !== 1 ? 's' : ''}`);
  const summary = parts.join(' · ') || 'No items';

  return (
    <div className="my-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 ${getRadiusClass('element')}
                 ${getGlassClasses('medium')} hover:from-slate-100 hover:to-slate-100
                 hover:border-white/80
                 ${TRANSITIONS.standard} group shadow-lg shadow-slate-100/30 hover:shadow-xl hover:shadow-slate-200/40 ring-1 ring-black/5`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 via-cyan-400 to-blue-600
                        flex items-center justify-center shadow-md group-hover:shadow-lg transition-all group-hover:scale-105">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-900">Sources</div>
            <div className="text-xs font-medium text-gray-500">{summary}</div>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-300 group-hover:text-cyan-600 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 pl-2 animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  );
};

// Change Card - shows what was updated (compact, matches TaskCard/NoteCard style)
const ChangeCard = ({
  type,
  title,
  changes,
  timestamp,
  itemId,
  onUndo,
  onView,
}: {
  type: 'task' | 'note';
  title: string;
  changes: { field: string; label: string; oldValue: any; newValue: any }[];
  timestamp: string;
  itemId: string;
  onUndo?: (itemId: string, changes: any[]) => void;
  onView?: (itemId: string) => void;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    if (value === '') return 'Empty';
    return String(value);
  };

  // Get primary change for compact display
  const primaryChange = changes[0];
  const hasMoreChanges = changes.length > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`my-2 ${getRadiusClass('card')} ${getGlassClasses('medium')} overflow-hidden shadow-lg shadow-green-100/30 hover:shadow-xl hover:shadow-green-200/40 ${TRANSITIONS.standard}`}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Icon */}
        <div className={`flex-shrink-0 p-1.5 ${getRadiusClass('field')} bg-green-100`}>
          <Check className="w-4 h-4 text-green-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title and badge */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900 truncate">{title}</span>
            <span className={`px-2 py-0.5 text-xs font-medium ${getRadiusClass('pill')} bg-green-100 text-green-800 flex-shrink-0`}>
              Updated
            </span>
          </div>

          {/* Primary change - inline */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">{primaryChange.label}:</span>
            <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-mono line-through">
              {formatValue(primaryChange.oldValue)}
            </span>
            <span className="text-gray-400">→</span>
            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-mono font-medium">
              {formatValue(primaryChange.newValue)}
            </span>
          </div>

          {/* More changes indicator */}
          {hasMoreChanges && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="mt-1.5 text-xs text-cyan-600 hover:text-cyan-700 transition-colors"
            >
              {showDetails ? 'Hide' : `+${changes.length - 1} more change${changes.length - 1 > 1 ? 's' : ''}`}
            </button>
          )}

          {/* Expanded changes */}
          <AnimatePresence>
            {showDetails && hasMoreChanges && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 space-y-1.5"
              >
                {changes.slice(1).map((change, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs pl-2 border-l-2 border-green-200">
                    <span className="text-gray-500 w-16 flex-shrink-0">{change.label}:</span>
                    <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-mono text-xs line-through">
                      {formatValue(change.oldValue)}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-mono text-xs font-medium">
                      {formatValue(change.newValue)}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions on hover */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <AnimatePresence>
            {isHovered && (
              <>
                {onView && (
                  <motion.button
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    onClick={() => onView(itemId)}
                    className="p-1.5 rounded-lg hover:bg-white/80 transition-all hover:shadow-md"
                    title={`View ${type}`}
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </motion.button>
                )}
                {onUndo && (
                  <motion.button
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ delay: 0.05 }}
                    onClick={() => onUndo(itemId, changes)}
                    className="p-1.5 rounded-lg hover:bg-red-100/70 transition-all hover:shadow-md"
                    title="Undo changes"
                  >
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </motion.button>
                )}
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

// Created Card - shows newly created task or note (compact, matches TaskCard/NoteCard style)
const CreatedCard = ({
  type,
  item,
  onView,
}: {
  type: 'task' | 'note';
  item: Task | Note;
  onView?: (itemId: string) => void;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const title = type === 'task' ? (item as Task).title : (item as Note).summary;
  const description = type === 'task' ? (item as Task).description : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`my-2 ${getRadiusClass('card')} ${getGlassClasses('medium')} overflow-hidden shadow-lg shadow-blue-100/30 hover:shadow-xl hover:shadow-blue-200/40 ${TRANSITIONS.standard}`}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Icon */}
        <div className={`flex-shrink-0 p-1.5 ${getRadiusClass('field')} bg-blue-100`}>
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title and badge */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900 truncate">{title}</span>
            <span className={`px-2 py-0.5 text-xs font-medium ${getRadiusClass('pill')} bg-blue-100 text-blue-800 flex-shrink-0`}>
              Created
            </span>
          </div>

          {/* Description if available */}
          {description && (
            <p className="text-xs text-gray-600 line-clamp-1">{description}</p>
          )}
        </div>

        {/* Actions on hover */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <AnimatePresence>
            {isHovered && onView && (
              <motion.button
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                onClick={() => onView(item.id)}
                className="p-1.5 rounded-lg hover:bg-white/80 transition-all hover:shadow-md"
                title={`View ${type}`}
              >
                <Edit2 className="w-4 h-4 text-gray-600" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

// Collapsible list wrapper
const CollapsibleList = ({ children, limit = 3 }: { children: React.ReactNode[]; limit?: number }) => {
  const [expanded, setExpanded] = useState(false);

  const childArray = React.Children.toArray(children);
  const hasMore = childArray.length > limit;
  const displayedChildren = expanded ? childArray : childArray.slice(0, limit);
  const remainingCount = childArray.length - limit;

  return (
    <>
      {displayedChildren}
      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className={`mt-3 px-5 py-2.5 ${getRadiusClass('element')} ${getInfoGradient('light').container} hover:from-cyan-100 hover:to-blue-100
                   text-cyan-800 text-sm font-semibold ${TRANSITIONS.standard} w-full shadow-md hover:shadow-lg hover:shadow-cyan-100/30
                   flex items-center justify-center gap-2 group ring-1 ring-black/5`}
        >
          <span>Show {remainingCount} more</span>
          <svg className="w-4 h-4 transition-transform group-hover:translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
      {hasMore && expanded && (
        <button
          onClick={() => setExpanded(false)}
          className={`mt-3 px-5 py-2.5 ${getRadiusClass('element')} ${getGlassClasses('medium')} hover:from-gray-100 hover:to-slate-100
                   text-gray-600 text-sm font-semibold ${TRANSITIONS.standard} w-full shadow-md hover:shadow-lg
                   flex items-center justify-center gap-2 group ring-1 ring-black/5`}
        >
          <span>Show less</span>
          <svg className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </>
  );
};

// Tool Call Box - collapsed by default, shows both arguments and results
const ToolCallBox = ({
  toolName,
  toolArguments,
  toolResult,
  toolStatus,
}: {
  toolName: string;
  toolArguments?: Record<string, unknown>;
  toolResult?: string;
  toolStatus?: 'pending' | 'success' | 'error';
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 ${getRadiusClass('element')}
                 ${getGlassClasses('medium')} hover:from-slate-100 hover:to-slate-100
                 hover:border-white/80
                 ${TRANSITIONS.standard} group shadow-lg shadow-slate-100/30 hover:shadow-xl hover:shadow-slate-200/40 ring-1 ring-black/5`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 via-cyan-400 to-blue-600
                        flex items-center justify-center shadow-md group-hover:shadow-lg transition-all group-hover:scale-105`}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-900">
              {TOOL_DESCRIPTIONS[toolName] || toolName}
            </div>
            <div className="text-xs font-medium text-gray-500">
              {toolStatus === 'pending' ? 'Executing...' : toolStatus === 'error' ? 'Error' : 'Completed'}
            </div>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-300 group-hover:text-cyan-600 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className={`mt-3 ${getRadiusClass('element')} ${getGlassClasses('medium')} overflow-hidden shadow-lg`}>
          {/* Arguments Section */}
          {toolArguments && Object.keys(toolArguments).length > 0 && (
            <div className="px-5 py-3 border-b border-white/30">
              <div className="text-xs font-semibold text-cyan-700 mb-2 uppercase tracking-wide">Arguments</div>
              <div className="text-xs text-cyan-600/70 font-mono bg-white/50 px-3 py-2 rounded overflow-x-auto">
                <pre className="whitespace-pre-wrap">{JSON.stringify(toolArguments, null, 2)}</pre>
              </div>
            </div>
          )}
          
          {/* Result Section */}
          {toolResult && (
            <div className="px-5 py-3">
              <div className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wide">Result</div>
              <div className="text-xs text-green-600/70 font-mono bg-white/50 px-3 py-2 rounded overflow-x-auto max-h-64 overflow-y-auto">
                <pre className="whitespace-pre-wrap">{toolResult}</pre>
              </div>
            </div>
          )}
          
          {toolStatus === 'pending' && !toolResult && (
            <div className="px-5 py-3 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
              <span className="text-xs text-cyan-600">Executing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface FieldChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
}

interface MessageContent {
  type: 'text' | 'task-list' | 'note-list' | 'session-list' | 'task-update' | 'note-update' | 'task-created' | 'note-created' | 'tool-use' | 'tool-result' | 'error' | 'thinking';
  content?: string;
  tasks?: Task[];
  notes?: Note[];
  sessions?: Session[];
  // For updates
  taskId?: string;
  noteId?: string;
  taskTitle?: string;
  noteSummary?: string;
  changes?: FieldChange[];
  timestamp?: string;
  // For created items
  task?: Task;
  note?: Note;
  // Tool use
  toolName?: string;
  toolStatus?: 'pending' | 'success' | 'error';
  toolArguments?: Record<string, unknown>;
  toolResult?: string; // Tool result content when combined with tool-use
}

interface NedMessageProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    contents: MessageContent[];
    timestamp: string;
  };
  // Task handlers
  onTaskComplete?: (taskId: string) => void;
  onTaskEdit?: (taskId: string) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskPriorityChange?: (taskId: string, priority: Task['priority']) => void;
  onTaskSubtaskToggle?: (taskId: string, subtaskId: string) => void;
  onTaskReschedule?: (taskId: string, date: string) => void;
  // Note handlers
  onNoteView?: (noteId: string) => void;
  onNoteEdit?: (noteId: string) => void;
  onNoteDelete?: (noteId: string) => void;
  // Session handlers
  onSessionView?: (sessionId: string) => void;
  // Universal
  onAskNed?: (context: string) => void;
  // Data for enrichment (live data from context)
  allNotes?: Note[];
  allTasks?: Task[];
  allSessions?: Session[];
  companies?: Company[];
  contacts?: Contact[];
}

export const NedMessage: React.FC<NedMessageProps> = ({
  message,
  onTaskComplete,
  onTaskEdit,
  onTaskDelete,
  onTaskPriorityChange,
  onTaskSubtaskToggle,
  onTaskReschedule,
  onNoteView,
  onNoteEdit,
  onNoteDelete,
  onSessionView,
  onAskNed,
  allNotes = [],
  allTasks = [],
  allSessions = [],
  companies = [],
  contacts = [],
}) => {
  const isUser = message.role === 'user';
  const infoGradient = getInfoGradient();
  const successGradient = getSuccessGradient();

  // Helper to find source note for a task
  const findSourceNote = (task: Task) => {
    const noteRel = task.relationships.find(r => r.targetType === EntityType.NOTE);
    if (!noteRel) return null;
    const note = allNotes.find(n => n.id === noteRel.targetId);
    return note ? { id: note.id, summary: note.summary } : null;
  };

  // Helper to find related tasks for a note
  const findRelatedTasks = (note: Note) => {
    return allTasks.filter(t =>
      t.relationships.some(r => r.targetType === EntityType.NOTE && r.targetId === note.id)
    );
  };

  // Helper to find linked entities for a note
  const findLinkedEntities = (note: Note) => {
    const noteCompanies = note.relationships
      .filter(r => r.targetType === EntityType.COMPANY)
      .map(r => companies.find(c => c.id === r.targetId))
      .filter(Boolean) as Company[];
    const noteContacts = note.relationships
      .filter(r => r.targetType === EntityType.CONTACT)
      .map(r => contacts.find(c => c.id === r.targetId))
      .filter(Boolean) as Contact[];
    return {
      companies: noteCompanies.map(c => ({ id: c.id, name: c.name })),
      contacts: noteContacts.map(c => ({ id: c.id, name: c.name })),
    };
  };

  // Helper to count related notes for a task
  const countRelatedNotes = (task: Task) => {
    const topicRel = task.relationships.find(r => r.targetType === EntityType.TOPIC);
    if (!topicRel) return 0;
    return allNotes.filter(n =>
      n.relationships.some(r => r.targetType === EntityType.TOPIC && r.targetId === topicRel.targetId)
    ).length;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar - using info gradient theme colors */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-xl ring-2 ring-white/60 transition-all duration-300 hover:scale-110 ${
        isUser
          ? 'bg-gradient-to-br from-cyan-600 via-cyan-500 to-blue-600 shadow-cyan-200/50 hover:shadow-cyan-300/60'
          : 'bg-gradient-to-br from-cyan-500 via-teal-400 to-teal-500 shadow-cyan-200/50 hover:shadow-teal-300/60'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-white drop-shadow-sm" />
        ) : (
          <Bot className="w-4 h-4 text-white drop-shadow-sm" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-3xl space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
        {message.contents.map((content, idx) => (
          <div key={idx}>
            {content.type === 'text' && content.content && (
              <div className={`rounded-[20px] px-5 py-3.5 shadow-xl transition-all duration-300 ${
                isUser
                  ? 'bg-gradient-to-br from-cyan-600 via-cyan-500 to-blue-600 text-white ml-auto shadow-cyan-200/40 hover:shadow-cyan-300/50 ring-1 ring-white/20 rounded-tr-sm'
                  : `${getGlassClasses('medium')} shadow-cyan-100/20 hover:shadow-cyan-200/30 ring-1 ring-black/5 rounded-tl-sm`
              }`}>
                <div className={`prose prose-sm ${isUser ? 'prose-invert' : ''} max-w-none prose-p:leading-relaxed prose-p:text-[15px] prose-headings:font-bold prose-headings:tracking-tight prose-a:text-cyan-600 prose-a:no-underline hover:prose-a:underline prose-strong:font-bold prose-strong:text-gray-900 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-pre:p-0 prose-pre:m-0 prose-pre:bg-transparent prose-code:bg-transparent prose-code:text-current prose-code:before:content-none prose-code:after:content-none`}>
                  <ReactMarkdown
                    components={{
                      code({ node, className, children, ...props }: any) {
                        const codeContent = String(children).replace(/\n$/, '');
                        const inline = (props as any).inline;

                        // Inline code
                        if (inline) {
                          return <InlineCode>{codeContent}</InlineCode>;
                        }

                        // Block code - render as copyable text snippet
                        return <TextSnippet>{codeContent}</TextSnippet>;
                      },
                    }}
                  >
                    {content.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {content.type === 'thinking' && content.content && (
              <div className={`flex items-center gap-3 px-5 py-3 ${getRadiusClass('element')} ${getInfoGradient('light').container} shadow-lg shadow-cyan-100/20 ring-1 ring-black/5`}>
                <div className="flex gap-1.5">
                  <span className={`w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 ${getRadiusClass('pill')} animate-bounce [animation-delay:0ms] shadow-sm`} />
                  <span className={`w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 ${getRadiusClass('pill')} animate-bounce [animation-delay:150ms] shadow-sm`} />
                  <span className={`w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 ${getRadiusClass('pill')} animate-bounce [animation-delay:300ms] shadow-sm`} />
                </div>
                <span className="text-sm font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  {content.content}
                </span>
              </div>
            )}

            {/* Tool use - display with tool description (combined with result if available) */}
            {content.type === 'tool-use' && content.toolName && (
              <ToolCallBox
                toolName={content.toolName}
                toolArguments={content.toolArguments}
                toolResult={content.toolResult}
                toolStatus={content.toolStatus || 'pending'}
              />
            )}

            {/* Tool result - display result from tool execution (only if not combined with tool-use) */}
            {content.type === 'tool-result' && content.content && content.toolName === 'tool_result' && (
              <div className={`px-5 py-3 ${getRadiusClass('element')} ${getGlassClasses('medium')} bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-lg shadow-green-100/20 ring-1 ring-green-100/50`}>
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-5 h-5 bg-gradient-to-br from-green-500 to-emerald-600 ${getRadiusClass('field')} flex items-center justify-center shadow-md`}>
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-700 mb-1">Tool Result</p>
                    <div className="text-xs text-green-600/70 font-mono bg-white/50 px-2 py-1 rounded mt-1 overflow-x-auto max-h-32 overflow-y-auto">
                      {content.content}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {content.type === 'error' && content.content && (
              <div className={`px-5 py-3.5 ${getRadiusClass('element')} ${getGlassClasses('medium')} bg-gradient-to-r from-red-50 to-rose-50 border-red-200 shadow-xl shadow-red-100/30 ring-1 ring-red-100/50`}>
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-5 h-5 bg-gradient-to-br from-red-500 to-rose-600 ${getRadiusClass('field')} flex items-center justify-center shadow-md`}>
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-red-700 flex-1 leading-relaxed">
                    {content.content}
                  </p>
                </div>
              </div>
            )}

            {content.type === 'task-list' && content.tasks && content.tasks.length > 0 && (
              <SourcesSection taskCount={content.tasks.length} defaultExpanded={false}>
                {content.content && (
                  <p className="text-sm text-gray-600 mb-3">
                    {content.content}
                  </p>
                )}
                <div className="space-y-1.5">
                  <CollapsibleList limit={3}>
                    {content.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={onTaskComplete}
                        onEdit={onTaskEdit}
                        onDelete={onTaskDelete}
                        onPriorityChange={onTaskPriorityChange}
                        onSubtaskToggle={onTaskSubtaskToggle}
                        onReschedule={onTaskReschedule}
                        onAskNed={onAskNed}
                        sourceNote={findSourceNote(task)}
                        relatedNotesCount={countRelatedNotes(task)}
                      />
                    ))}
                  </CollapsibleList>
                </div>
              </SourcesSection>
            )}

            {content.type === 'note-list' && content.notes && content.notes.length > 0 && (
              <SourcesSection noteCount={content.notes.length} defaultExpanded={false}>
                {content.content && (
                  <p className="text-sm text-gray-600 mb-3">
                    {content.content}
                  </p>
                )}
                <div className="space-y-1.5">
                  <CollapsibleList limit={3}>
                    {content.notes.map((note) => {
                      const entities = findLinkedEntities(note);
                      const relatedTasks = findRelatedTasks(note);
                      return (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onView={onNoteView}
                          onEdit={onNoteEdit}
                          onDelete={onNoteDelete}
                          onAskNed={onAskNed}
                          companies={entities.companies}
                          contacts={entities.contacts}
                          relatedTasks={relatedTasks}
                        />
                      );
                    })}
                  </CollapsibleList>
                </div>
              </SourcesSection>
            )}

            {content.type === 'session-list' && content.sessions && content.sessions.length > 0 && (
              <SourcesSection sessionCount={content.sessions.length} defaultExpanded={false}>
                {content.content && (
                  <p className="text-sm text-gray-600 mb-3">
                    {content.content}
                  </p>
                )}
                <div className="space-y-1.5">
                  <CollapsibleList limit={3}>
                    {content.sessions.map((session) => {
                      // CRITICAL FIX: Use live session data from allSessions to get real-time enrichmentStatus updates
                      const liveSession = allSessions.find(s => s.id === session.id) || session;
                      return (
                        <SessionCard
                          key={session.id}
                          session={liveSession}
                          onView={onSessionView}
                          onAskNed={onAskNed}
                        />
                      );
                    })}
                  </CollapsibleList>
                </div>
              </SourcesSection>
            )}

            {content.type === 'task-update' && content.taskId && content.changes && (
              <ChangeCard
                type="task"
                title={content.taskTitle || 'Task'}
                changes={content.changes}
                timestamp={content.timestamp || new Date().toISOString()}
                itemId={content.taskId}
                onView={onTaskEdit}
                onUndo={(itemId, changes) => {
                  // Undo functionality - revert changes
                  console.log('Undo task changes:', itemId, changes);
                }}
              />
            )}

            {content.type === 'note-update' && content.noteId && content.changes && (
              <ChangeCard
                type="note"
                title={content.noteSummary || 'Note'}
                changes={content.changes}
                timestamp={content.timestamp || new Date().toISOString()}
                itemId={content.noteId}
                onView={onNoteView}
                onUndo={(itemId, changes) => {
                  // Undo functionality - revert changes
                  console.log('Undo note changes:', itemId, changes);
                }}
              />
            )}

            {content.type === 'task-created' && content.task && (
              <CreatedCard
                type="task"
                item={content.task}
                onView={onTaskEdit}
              />
            )}

            {content.type === 'note-created' && content.note && (
              <CreatedCard
                type="note"
                item={content.note}
                onView={onNoteView}
              />
            )}
          </div>
        ))}

        {/* Timestamp */}
        <div className={`text-xs font-medium text-gray-400 px-2 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </div>
      </div>
    </motion.div>
  );
};
