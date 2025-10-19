/**
 * LogoContainer Component
 *
 * Permanent logo that stays visible at all times
 * Menu button morphs to position next to it (not replacing it)
 *
 * Supports compact mode: Shows only "T" icon when isCompact is true
 */

import { motion, AnimatePresence } from 'framer-motion';
import { NAVIGATION } from '../../../design-system/theme';
import { springs } from '../../../lib/animations';
import { useReducedMotion } from '../../../lib/animations';

interface LogoContainerProps {
  scrollY: number;
  isCompact?: boolean;
}

export function LogoContainer({ scrollY, isCompact = false }: LogoContainerProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      layout
      className={`${NAVIGATION.logo.container} transition-shadow duration-300 hover:shadow-2xl`}
      whileHover={{ scale: 1.02 }}
      transition={prefersReducedMotion ? { duration: 0 } : springs.snappy}
    >
      {/* The T icon - glassmorphic white background */}
      <div className={NAVIGATION.logo.iconBg}>
        <span className={NAVIGATION.logo.iconText}>T</span>
      </div>

      {/* Text - only show in full mode */}
      <AnimatePresence mode="wait">
        {!isCompact && (
          <motion.span
            key="logo-text"
            initial={{ opacity: 1, width: 'auto' }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
            className={NAVIGATION.logo.text}
          >
            Taskerino
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
