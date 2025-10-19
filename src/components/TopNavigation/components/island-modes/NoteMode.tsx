/**
 * NoteMode - Note Capture Island Mode
 *
 * Extracted from TopNavigation.tsx (lines 1176-1215)
 * Provides a quick note capture interface with save and AI processing options
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - React.memo to prevent re-renders when props haven't changed
 */

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save } from 'lucide-react';
import type { NoteModeProps } from '../../types';
import { getRadiusClass } from '../../../../design-system/theme';
import { modeContentVariants, contentSpring } from '../../utils/islandAnimations';
import { useReducedMotion } from '../../../../lib/animations';

function NoteModeComponent({
  noteInput,
  onNoteInputChange,
  onSaveNote,
  onSendToAI,
  onClose,
}: NoteModeProps) {
  const [isFocused, setIsFocused] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={modeContentVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Textarea with Focus Scale Effect */}
      <div className="relative px-2 pt-2">
        <AnimatePresence>
          {isFocused && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 to-purple-400/5 rounded-xl pointer-events-none"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </AnimatePresence>
        <textarea
          value={noteInput}
          onChange={(e) => onNoteInputChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Capture your thoughts..."
          className="relative w-full px-4 py-3 bg-transparent border-0 focus:outline-none focus:ring-0 text-base min-h-[100px] resize-none placeholder-gray-400"
          autoFocus
        />
      </div>

      {noteInput.trim() && (
        <motion.div
          className="px-4 pb-4 pt-2 flex gap-2"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
        >
          <motion.button
            onClick={onSaveNote}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSaveNote();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 bg-white/60 hover:bg-white/80 backdrop-blur-sm ${getRadiusClass('element')} transition-all text-sm font-semibold text-gray-700 hover:text-cyan-600`}
            whileHover={!prefersReducedMotion ? { scale: 1.02 } : undefined}
            whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
            transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
          >
            <Save className="w-4 h-4" />
            Save Note
          </motion.button>
          <motion.button
            onClick={onSendToAI}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSendToAI();
              }
            }}
            className={`flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white ${getRadiusClass('field')} font-bold hover:shadow-xl transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600`}
            whileHover={!prefersReducedMotion ? { scale: 1.02 } : undefined}
            whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
            transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
          >
            Process & File
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * PERFORMANCE OPTIMIZATION:
 * Memoize the component to prevent unnecessary re-renders.
 */
export const NoteMode = memo(NoteModeComponent);
