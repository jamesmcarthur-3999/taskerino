/**
 * Notes Module
 *
 * Simple note-taking module with list view
 */

import { useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import type { ModuleProps } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants } from '../animations/transitions';
import { getRadiusClass } from '../../../design-system/theme';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

interface NotesData {
  notes: Note[];
}

export function NotesModule({ config, data }: ModuleProps<NotesData>) {
  const [notes, setNotes] = useState<Note[]>(data?.notes || []);
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');

  const handleAddNote = () => {
    if (!newNoteTitle.trim()) return;

    const newNote: Note = {
      id: Date.now().toString(),
      title: newNoteTitle,
      content: '',
      createdAt: new Date().toISOString(),
    };

    setNotes([newNote, ...notes]);
    setNewNoteTitle('');
    setIsAdding(false);
  };

  const handleDeleteNote = (id: string) => {
    setNotes(notes.filter((note) => note.id !== id));
  };

  if (notes.length === 0 && !isAdding) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-500 dark:text-gray-400 mb-4">No notes yet</p>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-field hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-lg">Notes</h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-800 ${getRadiusClass('element')} transition-colors`}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {isAdding && (
            <motion.div
              variants={slideUpVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-gray-50 dark:bg-gray-800 rounded-card p-4"
            >
              <input
                type="text"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddNote();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
                placeholder="Note title..."
                autoFocus
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-field focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleAddNote}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded-element hover:bg-blue-600 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1 bg-gray-300 dark:bg-gray-700 text-sm rounded-element hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}

          {notes.map((note) => (
            <motion.div
              key={note.id}
              layout
              variants={slideUpVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white dark:bg-gray-800 rounded-card p-4 shadow-sm border border-gray-200 dark:border-gray-700 group hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {note.title}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

NotesModule.displayName = 'NotesModule';
