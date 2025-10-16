/**
 * FeatureTooltip Component
 *
 * Contextual tooltip for onboarding that teaches users about features as they encounter them.
 * Features:
 * - Positioned relative to target element
 * - Glassmorphic design matching app aesthetic
 * - Primary and secondary action buttons
 * - Auto-dismissal after delay (optional)
 * - Prevents showing the same tooltip twice
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface FeatureTooltipProps {
  show: boolean;
  onDismiss: () => void;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'bottom-right' | 'center';
  title: string;
  message: string | React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  delay?: number; // Delay before showing tooltip (ms)
  autoDismiss?: boolean; // Auto-dismiss after timeout
  autoDismissDelay?: number; // Delay before auto-dismiss (ms)
}

export const FeatureTooltip: React.FC<FeatureTooltipProps> = ({
  show,
  onDismiss,
  position = 'bottom',
  title,
  message,
  primaryAction,
  secondaryAction,
  delay = 0,
  autoDismiss = false,
  autoDismissDelay = 10000,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Handle delay before showing
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show, delay]);

  // Handle auto-dismiss
  useEffect(() => {
    if (isVisible && autoDismiss) {
      const timer = setTimeout(() => {
        onDismiss();
      }, autoDismissDelay);
      return () => clearTimeout(timer);
    }
  }, [isVisible, autoDismiss, autoDismissDelay, onDismiss]);

  // Position classes for the tooltip
  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      case 'bottom-right':
        return 'top-full right-0 mt-2';
      case 'center':
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
      default:
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
    }
  };

  // Animation variants
  const variants = {
    hidden: {
      opacity: 0,
      scale: 0.9,
      y: position === 'top' ? 10 : position === 'bottom' || position === 'bottom-right' ? -10 : 0,
      x: position === 'left' ? 10 : position === 'right' ? -10 : 0,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      x: 0,
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: position === 'top' ? 10 : position === 'bottom' || position === 'bottom-right' ? -10 : 0,
      x: position === 'left' ? 10 : position === 'right' ? -10 : 0,
    },
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={variants}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
            mass: 0.8,
          }}
          className={`absolute z-[100] ${getPositionClasses()}`}
          style={{ pointerEvents: 'auto' }}
        >
          {/* Arrow indicator */}
          {position !== 'center' && (
            <div
              className={`absolute ${
                position === 'top'
                  ? 'top-full left-1/2 -translate-x-1/2 -mt-1'
                  : position === 'bottom' || position === 'bottom-right'
                  ? 'bottom-full left-1/2 -translate-x-1/2 mb-1'
                  : position === 'left'
                  ? 'left-full top-1/2 -translate-y-1/2 -ml-1'
                  : 'right-full top-1/2 -translate-y-1/2 mr-1'
              }`}
            >
              <div
                className={`w-3 h-3 bg-white/90 backdrop-blur-2xl border-2 border-white/60 transform rotate-45 ${
                  position === 'bottom-right' ? 'translate-x-[200%]' : ''
                }`}
              />
            </div>
          )}

          {/* Tooltip card */}
          <div className="bg-white/90 backdrop-blur-2xl border-2 border-white/60 rounded-[24px] shadow-2xl shadow-cyan-200/30 p-5 max-w-sm">
            {/* Close button */}
            <button
              onClick={onDismiss}
              className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors rounded-full hover:bg-gray-100/50"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title */}
            <h3 className="text-base font-bold text-gray-900 mb-2 pr-6">
              {title}
            </h3>

            {/* Message */}
            <div className="text-sm text-gray-700 leading-relaxed mb-4">
              {typeof message === 'string' ? <p>{message}</p> : message}
            </div>

            {/* Actions */}
            {(primaryAction || secondaryAction) && (
              <div className="flex items-center gap-2">
                {primaryAction && (
                  <Button
                    onClick={() => {
                      primaryAction.onClick();
                      onDismiss();
                    }}
                    variant="primary"
                    size="sm"
                  >
                    {primaryAction.label}
                  </Button>
                )}
                {secondaryAction && (
                  <Button
                    onClick={() => {
                      secondaryAction.onClick();
                      onDismiss();
                    }}
                    variant="secondary"
                    size="sm"
                  >
                    {secondaryAction.label}
                  </Button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
