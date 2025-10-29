import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotes } from '../context/NotesContext';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useUI } from '../context/UIContext';
import { X, FileText, Sparkles } from 'lucide-react';
import type { Note } from '../types';
import { generateId } from '../utils/helpers';
import { getGlassClasses, getRadiusClass, MODAL_SECTIONS } from '../design-system/theme';
import {
  modalBackdropVariants,
  modalFormVariants,
  modalSectionVariants
} from '../animations/variants';

interface QuickNoteFromSessionProps {
  isOpen: boolean;
  onClose: () => void;
  suggestedContent: string;
  sessionId: string;
  sessionName: string;
  screenshotId?: string;
}

export function QuickNoteFromSession({
  isOpen,
  onClose,
  suggestedContent,
  sessionId,
  sessionName,
  screenshotId,
}: QuickNoteFromSessionProps) {
  const { addNote } = useNotes();
  const { addExtractedNote } = useActiveSession();
  const { addNotification } = useUI();
  const [content, setContent] = useState(suggestedContent);
  const [summary, setSummary] = useState('');

  // Sync state with prop when modal opens or suggestedContent changes
  useEffect(() => {
    if (isOpen) {
      setContent(suggestedContent);
      setSummary('');
    }
  }, [isOpen, suggestedContent]);

  const handleCreate = () => {
    if (!content.trim()) return;

    const now = new Date().toISOString();
    const newNote: Note = {
      id: generateId(),
      content: content.trim(),
      summary: summary.trim() || content.trim().split('\n')[0].substring(0, 100),
      timestamp: now,
      lastUpdated: now,
      source: 'thought',
      tags: [],
      sourceSessionId: sessionId,

      // Rich metadata following capture box pattern
      metadata: {
        keyPoints: [summary.trim() || content.trim().split('\n')[0].substring(0, 100)],
        relatedTopics: [sessionName],
      },
    };

    addNote(newNote);

    // Add note ID to session's extractedNoteIds
    addExtractedNote(newNote.id);

    addNotification({
      type: 'success',
      title: 'Note Created',
      message: `Note captured from session "${sessionName}"`,
    });

    handleClose();
  };

  const handleClose = () => {
    setContent(suggestedContent);
    setSummary('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCreate();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Animated Backdrop */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalBackdropVariants.standard}
            className={`fixed inset-0 z-[60] bg-black/50 ${getGlassClasses('subtle').split(' ').find(c => c.startsWith('backdrop-blur'))}`}
            onClick={handleClose}
          />

          {/* Animated Modal Content */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalFormVariants}
            className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-[60]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`${getGlassClasses('strong')} ${getRadiusClass('modal')} max-w-2xl w-full`}>
        {/* Header - Animated */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.2 }}
          className={`${MODAL_SECTIONS.header} bg-gradient-to-r from-violet-500/10 to-purple-500/10`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-violet-600" />
                Save Note from Session
              </h2>
              <p className="text-sm text-gray-600 mt-1">From: {sessionName}</p>
            </div>
            <button
              onClick={handleClose}
              className={`p-2 hover:bg-white/60 ${getGlassClasses('medium').split(' ').find(c => c.startsWith('backdrop-blur'))} rounded-xl transition-all duration-300 hover:scale-110 active:scale-95`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* Content - Staggered */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.25 }}
          className="p-6 space-y-4"
        >
          {/* Summary (optional) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.2 }}
          >
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <FileText className="w-4 h-4" />
              Summary (optional)
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary of this note..."
              className={`w-full px-4 py-2 ${getGlassClasses('medium')} ${getRadiusClass('element')} focus:ring-2 focus:ring-violet-500 focus:border-violet-400 transition-all`}
            />
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.17, duration: 0.2 }}
          >
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={10}
              className={`w-full px-4 py-3 ${getGlassClasses('medium')} ${getRadiusClass('element')} focus:ring-2 focus:ring-violet-500 focus:border-violet-400 transition-all resize-none font-mono text-sm`}
              autoFocus
            />
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.2 }}
            className={`bg-violet-50/50 ${getGlassClasses('subtle').split(' ').find(c => c.startsWith('backdrop-blur'))} border border-violet-200/50 ${getRadiusClass('element')} p-3`}
          >
            <p className="text-xs text-violet-700">
              <span className="font-semibold">💡 Context preserved:</span> This note will link back to the session and screenshot where it was captured.
            </p>
          </motion.div>
        </motion.div>

        {/* Footer - Animated */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.2 }}
          className={`${MODAL_SECTIONS.footer} flex items-center justify-between`}
        >
          <p className="text-sm text-gray-600">
            Press <kbd className={`px-2 py-1 ${getGlassClasses('medium')} rounded text-xs font-mono`}>⌘↵</kbd> to save
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className={`px-4 py-2 text-gray-700 ${getGlassClasses('medium')} hover:bg-white/80 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95`}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!content.trim()}
              className="px-6 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-violet-200/50"
            >
              Save Note
            </button>
          </div>
        </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
