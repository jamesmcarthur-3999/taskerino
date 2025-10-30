import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Check, AppWindow } from 'lucide-react';
import type { WindowInfo } from '../../types';
import { getGlassClasses, getRadiusClass, TRANSITIONS } from '../../design-system/theme';

interface WindowMultiSelectProps {
  windows: WindowInfo[];
  selectedWindowIds: string[];
  onChange: (windowIds: string[]) => void;
  disabled?: boolean;
  minRequired?: number;
  allowMultiple?: boolean;
}

/**
 * WindowMultiSelect - Multi-select grid for choosing windows to record
 *
 * Features:
 * - Grid layout with app icons and window titles
 * - Multi-select with checkboxes (can record multiple windows)
 * - Window titles and app names
 * - Selection animation (scale + glow)
 * - Validation: at least 1 window required
 * - Glassmorphism styling matching design system
 *
 * IMPORTANT LIMITATION (2025-10-23):
 * While this UI allows selecting multiple windows, the current Swift recording layer
 * (ScreenRecorder.swift:664-677) only uses the FIRST window from the array via .first().
 * Multi-window recording requires architectural changes to the recording pipeline.
 * For now, only the first selected window will be recorded.
 */
export function WindowMultiSelect({
  windows,
  selectedWindowIds,
  onChange,
  disabled = false,
  minRequired = 1,
  allowMultiple = true,
}: WindowMultiSelectProps) {
  // Auto-select first window if none selected and windows available
  useEffect(() => {
    if (selectedWindowIds.length === 0 && windows.length > 0) {
      onChange([windows[0].windowId]);
    }
  }, [windows, selectedWindowIds, onChange]);

  const handleToggleWindow = (windowId: string) => {
    if (disabled) return;

    const isSelected = selectedWindowIds.includes(windowId);

    if (!allowMultiple) {
      // Single select mode
      onChange([windowId]);
      return;
    }

    if (isSelected) {
      // Don't allow deselecting if it would go below minimum
      if (selectedWindowIds.length <= minRequired) {
        return;
      }
      onChange(selectedWindowIds.filter(id => id !== windowId));
    } else {
      onChange([...selectedWindowIds, windowId]);
    }
  };

  const handleSelectAll = () => {
    if (disabled || !allowMultiple) return;
    onChange(windows.map(w => w.windowId));
  };

  const handleClearAll = () => {
    if (disabled || !allowMultiple) return;
    // Keep at least minRequired
    if (windows.length >= minRequired) {
      onChange([windows[0].windowId]);
    }
  };

  if (windows.length === 0) {
    return (
      <div className={`p-6 ${getGlassClasses('subtle')} ${getRadiusClass('card')} text-center`}>
        <AppWindow size={32} className="mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600 font-medium">No windows found</p>
        <p className="text-xs text-gray-500 mt-1">
          Check Screen Recording permissions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with Select All / Clear */}
      {allowMultiple && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AppWindow size={14} className="text-gray-600" />
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Select Windows ({selectedWindowIds.length}/{windows.length})
            </label>
          </div>
          <div className="flex items-center gap-2">
            {selectedWindowIds.length < windows.length && (
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={disabled}
                className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Select All
              </button>
            )}
            {selectedWindowIds.length > minRequired && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={disabled}
                className="text-xs font-semibold text-gray-600 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Window Grid */}
      <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
        {windows.map((window) => {
          const isSelected = selectedWindowIds.includes(window.windowId);
          const canDeselect = allowMultiple ? selectedWindowIds.length > minRequired : false;

          return (
            <motion.button
              key={window.windowId}
              type="button"
              onClick={() => handleToggleWindow(window.windowId)}
              disabled={disabled || (isSelected && !canDeselect && allowMultiple)}
              className={`
                relative group
                ${getRadiusClass('field')}
                overflow-hidden
                ${TRANSITIONS.fast}
                ${disabled || (isSelected && !canDeselect && allowMultiple)
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer hover:scale-[1.02]'
                }
                ${isSelected
                  ? 'ring-2 ring-cyan-500 ring-offset-2 shadow-lg shadow-cyan-500/30'
                  : 'ring-2 ring-gray-300 hover:ring-cyan-300'
                }
              `}
              whileHover={!disabled && (canDeselect || !isSelected || !allowMultiple) ? { scale: 1.02 } : {}}
              whileTap={!disabled && (canDeselect || !isSelected || !allowMultiple) ? { scale: 0.98 } : {}}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 25,
              }}
            >
              {/* Window Preview/Placeholder */}
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative">
                {window.thumbnailDataUri ? (
                  <img
                    src={window.thumbnailDataUri}
                    alt={window.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                    <AppWindow size={32} className="text-gray-400 mb-2" />
                    <p className="text-xs font-semibold text-gray-700 line-clamp-2">
                      {window.title || 'Untitled Window'}
                    </p>
                  </div>
                )}

                {/* Selection Overlay */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 bg-cyan-500/20 backdrop-blur-[1px] flex items-center justify-center"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 20,
                        }}
                        className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg"
                      >
                        <Check size={24} className="text-white" strokeWidth={3} />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Window Info Bar */}
              <div className="px-3 py-2 bg-white/90 backdrop-blur-sm border-t-2 border-gray-200">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {window.owningApp}
                </p>
                <p className="text-xs text-gray-600 truncate">
                  {window.bounds.width}×{window.bounds.height}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
