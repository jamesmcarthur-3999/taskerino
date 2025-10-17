/**
 * Note Card - Enhanced
 *
 * Interactive note display in Ned's chat with rich features:
 * - Entity chips for linked companies/contacts
 * - Related tasks inline
 * - Ask Ned button
 * - Smart content highlights
 * - Expandable key points callouts
 * - Updates timeline
 * - Enhanced hover states
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Calendar,
  Tag,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  ExternalLink,
  MessageCircle,
  Building2,
  User,
  CheckCircle2,
  Circle,
  Clock,
  Lightbulb,
  History
} from 'lucide-react';
import type { Note, Task } from '../../types';
import { getGlassClasses, getRadiusClass, TRANSITIONS, SCALE, getEntityPillClasses } from '../../design-system/theme';

interface NoteCardProps {
  note: Note;
  onView?: (noteId: string) => void;
  onEdit?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
  onAskNed?: (context: string) => void;
  companies?: Array<{ id: string; name: string }>;
  contacts?: Array<{ id: string; name: string }>;
  relatedTasks?: Task[];
  compact?: boolean;
}

const SOURCE_COLORS = {
  call: 'bg-blue-100 text-blue-800',
  email: 'bg-cyan-100 text-cyan-800',
  thought: 'bg-emerald-100 text-emerald-800',
  other: 'bg-gray-100 text-gray-700',
};

// Smart highlighter function
const highlightContent = (content: string) => {
  const parts: Array<{ text: string; type: 'text' | 'date' | 'action' | 'entity' }> = [];

  // Patterns for different types
  const datePattern = /\b(tomorrow|today|yesterday|next week|this week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}\/\d{2,4})\b/gi;
  const actionPattern = /\b(TODO|FIXME|NOTE|IMPORTANT|URGENT|ACTION|FOLLOW UP|DEADLINE):/gi;

  let lastIndex = 0;
  const matches: Array<{ index: number; length: number; type: 'date' | 'action' }> = [];

  // Find all matches
  let match;
  while ((match = datePattern.exec(content)) !== null) {
    matches.push({ index: match.index, length: match[0].length, type: 'date' });
  }
  while ((match = actionPattern.exec(content)) !== null) {
    matches.push({ index: match.index, length: match[0].length, type: 'action' });
  }

  // Sort matches by index
  matches.sort((a, b) => a.index - b.index);

  // Build parts array
  matches.forEach((match) => {
    if (match.index > lastIndex) {
      parts.push({ text: content.slice(lastIndex, match.index), type: 'text' });
    }
    parts.push({ text: content.slice(match.index, match.index + match.length), type: match.type });
    lastIndex = match.index + match.length;
  });

  if (lastIndex < content.length) {
    parts.push({ text: content.slice(lastIndex), type: 'text' });
  }

  return parts.length > 0 ? parts : [{ text: content, type: 'text' as const }];
};

export const NoteCard = React.memo<NoteCardProps>(({
  note,
  onView,
  onEdit,
  onDelete,
  onAskNed,
  companies = [],
  contacts = [],
  relatedTasks = [],
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showKeyPoints, setShowKeyPoints] = useState(true);
  const [showRelatedTasks, setShowRelatedTasks] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleAskNed = () => {
    if (!onAskNed) return;
    onAskNed(`Tell me more about this note: "${note.summary}"`);
  };

  // Highlight content
  const highlightedParts = useMemo(() => {
    return isExpanded ? highlightContent(note.content) : highlightContent(note.content.substring(0, 200));
  }, [note.content, isExpanded]);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`px-3 py-2 ${getRadiusClass('field')} ${getGlassClasses('medium')} cursor-pointer hover:border-cyan-300/60 hover:shadow-cyan-200/40 ${TRANSITIONS.standard}`}
        onClick={() => onView?.(note.id)}
      >
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-cyan-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 line-clamp-1">
              {note.summary}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {formatDate(note.timestamp)}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  const canExpand = note.content.length > 200;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`${getRadiusClass('card')} ${getGlassClasses('medium')} overflow-hidden shadow-lg shadow-cyan-100/30 hover:shadow-xl hover:shadow-cyan-200/40 ${TRANSITIONS.standard}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 border-b border-white/60">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`p-2 ${getRadiusClass('field')} bg-cyan-100 flex-shrink-0`}>
            <FileText className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900">
              {note.summary}
            </h3>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(note.timestamp)}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLORS[note.source]}`}>
                {note.source}
              </span>
            </div>

            {/* Entity Chips */}
            {(companies.length > 0 || contacts.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {companies.map((company) => (
                  <span
                    key={company.id}
                    className={`flex items-center gap-1 px-2 py-0.5 text-xs ${getRadiusClass('pill')} ${getEntityPillClasses('company')} hover:bg-blue-200 ${TRANSITIONS.colors} cursor-pointer`}
                  >
                    <Building2 className="w-3 h-3" />
                    <span>{company.name}</span>
                  </span>
                ))}
                {contacts.map((contact) => (
                  <span
                    key={contact.id}
                    className={`flex items-center gap-1 px-2 py-0.5 text-xs ${getRadiusClass('pill')} ${getEntityPillClasses('contact')} hover:bg-emerald-200 ${TRANSITIONS.colors} cursor-pointer`}
                  >
                    <User className="w-3 h-3" />
                    <span>{contact.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions - Enhanced on Hover */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <AnimatePresence>
            {isHovered && (
              <>
                {onAskNed && (
                  <motion.button
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    onClick={handleAskNed}
                    className={`p-1.5 ${getRadiusClass('field')} hover:bg-purple-100 ${TRANSITIONS.standard} hover:shadow-md`}
                    title="Ask Ned about this note"
                  >
                    <MessageCircle className="w-4 h-4 text-purple-600" />
                  </motion.button>
                )}
                {onView && (
                  <motion.button
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ delay: 0.05 }}
                    onClick={() => onView(note.id)}
                    className={`p-1.5 ${getRadiusClass('field')} hover:bg-white/80 ${TRANSITIONS.standard} hover:shadow-md`}
                    title="View full note"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-600" />
                  </motion.button>
                )}
                {onEdit && (
                  <motion.button
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ delay: 0.1 }}
                    onClick={() => onEdit(note.id)}
                    className={`p-1.5 ${getRadiusClass('field')} hover:bg-white/80 ${TRANSITIONS.standard} hover:shadow-md`}
                    title="Edit note"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </motion.button>
                )}
                {onDelete && (
                  <motion.button
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ delay: 0.15 }}
                    onClick={() => onDelete(note.id)}
                    className={`p-1.5 ${getRadiusClass('field')} hover:bg-red-100 ${TRANSITIONS.standard} hover:shadow-md`}
                    title="Delete note"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </motion.button>
                )}
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content with Smart Highlights */}
      <div className="p-4">
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700 whitespace-pre-wrap">
            {highlightedParts.map((part, idx) => {
              if (part.type === 'date') {
                return (
                  <span key={idx} className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                    {part.text}
                  </span>
                );
              } else if (part.type === 'action') {
                return (
                  <span key={idx} className="px-1 py-0.5 bg-orange-100 text-orange-800 rounded font-medium">
                    {part.text}
                  </span>
                );
              }
              return <span key={idx}>{part.text}</span>;
            })}
            {canExpand && !isExpanded && '...'}
          </p>
        </div>

        {canExpand && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-1 mt-3 text-sm text-cyan-600 hover:text-cyan-700 ${TRANSITIONS.colors}`}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Show less</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Show more</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Enhanced Key Points - Callout Style */}
      {note.metadata?.keyPoints && note.metadata.keyPoints.length > 0 && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowKeyPoints(!showKeyPoints)}
            className={`flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-cyan-600 ${TRANSITIONS.colors} mb-2`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Key Insights</span>
            {showKeyPoints ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          <AnimatePresence>
            {showKeyPoints && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-3 ${getRadiusClass('field')} bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200`}
              >
                <ul className="space-y-1.5">
                  {note.metadata.keyPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="w-1 h-1 bg-cyan-500 rounded-full mt-1.5 flex-shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Related Tasks */}
      {relatedTasks.length > 0 && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowRelatedTasks(!showRelatedTasks)}
            className={`flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-cyan-600 ${TRANSITIONS.colors} mb-2`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{relatedTasks.length} Related Task{relatedTasks.length > 1 ? 's' : ''}</span>
            {showRelatedTasks ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          <AnimatePresence>
            {showRelatedTasks && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5"
              >
                {relatedTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-2 px-3 py-2 ${getRadiusClass('field')} bg-white/50 border border-white/60 hover:border-cyan-300/60 ${TRANSITIONS.standard} text-xs`}
                  >
                    {task.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className={`flex-1 ${task.done ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                      {task.title}
                    </span>
                    {task.dueDate && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">
                          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Tags */}
      {note.tags && note.tags.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-3 h-3 text-gray-500 flex-shrink-0" />
            {note.tags.map((tag) => (
              <span
                key={tag}
                className={`px-2 py-0.5 text-xs ${getRadiusClass('pill')} bg-cyan-100 text-cyan-800 hover:bg-cyan-200 ${TRANSITIONS.colors} cursor-pointer`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Updates Timeline */}
      {note.updates && note.updates.length > 0 && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowUpdates(!showUpdates)}
            className={`flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-cyan-600 ${TRANSITIONS.colors} mb-2`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{note.updates.length} Update{note.updates.length > 1 ? 's' : ''}</span>
            {showUpdates ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          <AnimatePresence>
            {showUpdates && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                {note.updates.slice(0, 3).map((update) => (
                  <div
                    key={update.id}
                    className={`flex gap-2 px-3 py-2 ${getRadiusClass('field')} bg-white/50 border border-white/60`}
                  >
                    <div className="flex-shrink-0 w-1 bg-cyan-500 rounded-full" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700">{update.summary || update.content.substring(0, 100)}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>{formatDate(update.timestamp)}</span>
                        <span>•</span>
                        <span className="capitalize">{update.source}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {note.updates.length > 3 && (
                  <p className="text-xs text-gray-600 pl-3">
                    +{note.updates.length - 3} more update{note.updates.length - 3 > 1 ? 's' : ''}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Sentiment */}
      {note.metadata?.sentiment && note.metadata.sentiment !== 'neutral' && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-600">Sentiment:</span>
            <span className={`px-2 py-0.5 ${getRadiusClass('pill')} font-medium ${
              note.metadata.sentiment === 'positive'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {note.metadata.sentiment}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
});
