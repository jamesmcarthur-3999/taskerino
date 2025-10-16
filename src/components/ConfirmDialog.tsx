import React, { useEffect, type ElementType } from 'react';
import { X, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, TRANSITIONS, SCALE, getModalClasses } from '../design-system/theme';
import { Button } from './Button';

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

  if (!isOpen) return null;

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
    <div
      className={modalClasses.overlay}
      onClick={onClose}
    >
      <div
        className={`${modalClasses.content} max-w-md w-full p-8 ${TRANSITIONS.standard} ${SCALE.subtleHover}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-6 right-6 p-2 hover:bg-white/40 ${RADIUS.element} ${TRANSITIONS.fast} hover:scale-110 active:scale-95 text-gray-600 hover:text-gray-900`}
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className={`p-4 ${RADIUS.element} bg-white/40 backdrop-blur-sm`}>
            <IconComponent className={`w-12 h-12 ${getIconColor()}`} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
          {title}
        </h2>

        {/* Message */}
        <p className="text-gray-700 text-center mb-8 leading-relaxed">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
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
        </div>
      </div>
    </div>
  );
});
