import React, { useEffect, type ElementType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, TRANSITIONS, SCALE, getModalClasses, getGlassClasses, getRadiusClass } from '../design-system/theme';
import { Button } from './Button';
import {
  modalBackdropVariants,
  modalConfirmationVariants,
  modalSectionVariants
} from '../animations/variants';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  icon?: ElementType;
}

export const ConfirmDialog = React.memo(function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'info',
  icon: CustomIcon,
}: ConfirmDialogProps) {
  const { colorScheme, glassStrength } = useTheme();

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Get icon based on variant
  const IconComponent = CustomIcon || (
    variant === 'danger' ? AlertCircle :
    variant === 'warning' ? AlertTriangle :
    Info
  );

  // Get icon color based on variant
  const getIconColor = () => {
    switch (variant) {
      case 'danger':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'info':
        return colorScheme === 'ocean' ? 'text-cyan-600' :
               colorScheme === 'sunset' ? 'text-orange-600' :
               colorScheme === 'forest' ? 'text-emerald-600' :
               colorScheme === 'lavender' ? 'text-purple-600' :
               'text-gray-600';
    }
  };

  // Get confirm button variant
  const getConfirmVariant = () => {
    switch (variant) {
      case 'danger':
        return 'danger';
      case 'warning':
        return 'primary';
      case 'info':
        return 'primary';
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const modalClasses = getModalClasses(colorScheme, glassStrength);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Animated Backdrop */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalBackdropVariants.critical}
            className={modalClasses.overlay}
            onClick={onClose}
          />

          {/* Animated Modal Content */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalConfirmationVariants}
            className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-[100]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`${modalClasses.content} max-w-md w-full p-8`}>
              {/* Close button */}
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.2 }}
                onClick={onClose}
                className={`absolute top-6 right-6 p-2 hover:bg-white/40 ${getRadiusClass('element')} ${TRANSITIONS.fast} hover:scale-110 active:scale-95 text-gray-600 hover:text-gray-900`}
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </motion.button>

              {/* Icon with pop animation */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05, type: 'spring', stiffness: 300, damping: 20 }}
                className="flex justify-center mb-6"
              >
                <div className={`p-4 ${getRadiusClass('element')} ${getGlassClasses('subtle')}`}>
                  <IconComponent className={`w-12 h-12 ${getIconColor()}`} />
                </div>
              </motion.div>

              {/* Title with stagger */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.25 }}
                className="text-2xl font-bold text-gray-900 text-center mb-4"
              >
                {title}
              </motion.h2>

              {/* Message with stagger */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.25 }}
                className="text-gray-700 text-center mb-8 leading-relaxed"
              >
                {message}
              </motion.p>

              {/* Actions with stagger */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.25 }}
                className="flex gap-3 justify-end"
              >
                <Button
                  variant="secondary"
                  onClick={onClose}
                  colorScheme={colorScheme}
                >
                  {cancelLabel}
                </Button>
                <Button
                  variant={getConfirmVariant()}
                  onClick={handleConfirm}
                  colorScheme={colorScheme}
                >
                  {confirmLabel}
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
