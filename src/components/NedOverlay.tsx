/**
 * Ned Overlay
 *
 * Global floating overlay for Ned AI assistant
 * - Portal rendered at root level
 * - Right-aligned, appears from navigation island
 * - Input at TOP, conversation flows DOWN
 * - Spring physics animations
 * - Minimized pill state
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minimize2, MessageCircle } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { NedChat } from './ned/NedChat';
import { getGlassClasses } from '../design-system/theme';

export const NedOverlay: React.FC = () => {
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { isOpen } = uiState.nedOverlay;
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        uiDispatch({ type: 'CLOSE_NED_OVERLAY' });
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, uiDispatch]);

  if (!isOpen) return null;

  // Overlay - non-blocking, persistent like navigation island
  return createPortal(
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      }}
      className={`fixed top-20 right-6 w-[480px] h-[calc(100vh-140px)] z-[60] flex flex-col ${getGlassClasses('strong')} rounded-[40px] shadow-2xl ring-1 ring-black/5 overflow-hidden pointer-events-auto`}
    >
        {/* Ned Chat - Full height, input on top */}
        <div className="flex-1 min-h-0 flex flex-col">
          <NedChat />
        </div>
      </motion.div>,
    document.body
  );
};
