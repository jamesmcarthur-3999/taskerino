/**
 * Ned Message - Enhanced
 *
 * Main message component for Ned's chat.
 * Renders different content types: text, task lists, note lists, tool use, etc.
 * Now supports all enhanced card features.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { NoteCard } from './NoteCard';
import ReactMarkdown from 'react-markdown';
import type { Task, Note, Company, Contact } from '../../types';

interface MessageContent {
  type: 'text' | 'task-list' | 'note-list' | 'tool-use' | 'tool-result' | 'error' | 'thinking';
  content?: string;
  tasks?: Task[];
  notes?: Note[];
  toolName?: string;
  toolStatus?: 'pending' | 'success' | 'error';
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
  // Universal
  onAskNed?: (context: string) => void;
  // Data for enrichment
  allNotes?: Note[];
  allTasks?: Task[];
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
  onAskNed,
  allNotes = [],
  allTasks = [],
  companies = [],
  contacts = [],
}) => {
  const isUser = message.role === 'user';

  // Helper to find source note for a task
  const findSourceNote = (task: Task) => {
    if (!task.sourceNoteId) return null;
    const note = allNotes.find(n => n.id === task.sourceNoteId);
    return note ? { id: note.id, summary: note.summary } : null;
  };

  // Helper to find related tasks for a note
  const findRelatedTasks = (note: Note) => {
    return allTasks.filter(t => t.sourceNoteId === note.id);
  };

  // Helper to find linked entities for a note
  const findLinkedEntities = (note: Note) => {
    const noteCompanies = note.companyIds?.map(id => companies.find(c => c.id === id)).filter(Boolean) as Company[] || [];
    const noteContacts = note.contactIds?.map(id => contacts.find(c => c.id === id)).filter(Boolean) as Contact[] || [];
    return {
      companies: noteCompanies.map(c => ({ id: c.id, name: c.name })),
      contacts: noteContacts.map(c => ({ id: c.id, name: c.name })),
    };
  };

  // Helper to count related notes for a task
  const countRelatedNotes = (task: Task) => {
    if (!task.topicId) return 0;
    return allNotes.filter(n =>
      n.companyIds?.includes(task.topicId || '') ||
      n.contactIds?.includes(task.topicId || '') ||
      n.topicIds?.includes(task.topicId || '')
    ).length;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
        isUser
          ? 'bg-gradient-to-br from-cyan-600 to-blue-600 shadow-cyan-200/50'
          : 'bg-gradient-to-br from-cyan-500 to-teal-500 shadow-cyan-200/50'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-3xl space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
        {message.contents.map((content, idx) => (
          <div key={idx}>
            {content.type === 'text' && content.content && (
              <div className={`rounded-2xl px-4 py-3 shadow-lg transition-all duration-200 ${
                isUser
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white ml-auto shadow-cyan-200/50 rounded-tr-sm'
                  : 'bg-white/70 backdrop-blur-xl border-2 border-white/60 shadow-cyan-100/30 rounded-tl-sm'
              }`}>
                <div className={`prose prose-sm ${isUser ? 'prose-invert' : ''} max-w-none`}>
                  <ReactMarkdown>{content.content}</ReactMarkdown>
                </div>
              </div>
            )}

            {content.type === 'thinking' && content.content && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-cyan-50/50 border border-cyan-100">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                <span className="text-sm text-cyan-600 font-medium">
                  {content.content}
                </span>
              </div>
            )}

            {/* Tool use - completely hidden from UI */}
            {content.type === 'tool-use' && null}

            {content.type === 'error' && content.content && (
              <div className="px-4 py-3 rounded-xl bg-red-50/70 backdrop-blur-xl border-2 border-red-100 shadow-lg shadow-red-100/30">
                <p className="text-sm text-red-700">
                  {content.content}
                </p>
              </div>
            )}

            {content.type === 'task-list' && content.tasks && content.tasks.length > 0 && (
              <div className="space-y-1.5">
                {content.content && (
                  <p className="text-sm text-gray-600 mb-2">
                    {content.content}
                  </p>
                )}
                {content.tasks.slice(0, 5).map((task) => (
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
                {content.tasks.length > 5 && (
                  <p className="text-xs text-gray-500 italic px-3 py-2">
                    +{content.tasks.length - 5} more tasks (use filters to see all)
                  </p>
                )}
              </div>
            )}

            {content.type === 'note-list' && content.notes && content.notes.length > 0 && (
              <div className="space-y-1.5">
                {content.content && (
                  <p className="text-sm text-gray-600 mb-2">
                    {content.content}
                  </p>
                )}
                {content.notes.slice(0, 5).map((note) => {
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
                {content.notes.length > 5 && (
                  <p className="text-xs text-gray-500 italic px-3 py-2">
                    +{content.notes.length - 5} more notes (use filters to see all)
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Timestamp */}
        <div className={`text-xs text-gray-400 px-2 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </div>
      </div>
    </motion.div>
  );
};
