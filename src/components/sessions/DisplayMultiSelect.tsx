import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Check, Star } from 'lucide-react';
import type { DisplayInfo } from '../../types';
import { getGlassClasses, getRadiusClass, TRANSITIONS } from '../../design-system/theme';

interface DisplayMultiSelectProps {
  displays: DisplayInfo[];
  selectedDisplayIds: string[];
  onChange: (displayIds: string[]) => void;
  disabled?: boolean;
  minRequired?: number;
}

/**
 * DisplayMultiSelect - Multi-select grid for choosing displays to record
 *
 * Features:
 * - 2-column grid layout for displays
 * - Multi-select with checkboxes (can record multiple displays)
 * - Display names and resolutions
 * - Primary display star badge
 * - Live preview refresh (every 5s)
 * - Selection animation (scale + glow)
 * - Validation: at least 1 display required
 * - Glassmorphism styling matching design system
 *
 * IMPORTANT LIMITATION (2025-10-23):
 * While this UI allows selecting multiple displays, the current Swift recording layer
 * (ScreenRecorder.swift:664-677) only uses the FIRST display from the array via .first().
 * Multi-display recording requires architectural changes to the recording pipeline.
 * For now, only the first selected display will be recorded.
 */
export function DisplayMultiSelect({
  displays,
  selectedDisplayIds,
  onChange,
  disabled = false,
  minRequired = 1,
}: DisplayMultiSelectProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-select first display if none selected and displays available
  // Note: Intentionally omit `onChange` from deps to prevent infinite loops
  // The onChange callback can change on every parent render, triggering unwanted re-selections
  useEffect(() => {
    if (selectedDisplayIds.length === 0 && displays.length > 0) {
      onChange([displays[0].displayId]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displays, selectedDisplayIds]);

  // Live preview refresh every 5 seconds
  useEffect(() => {
    if (displays.length === 0 || disabled) return;

    refreshIntervalRef.current = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 5000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [displays.length, disabled]);

  const handleToggleDisplay = (displayId: string) => {
    if (disabled) return;

    const isSelected = selectedDisplayIds.includes(displayId);

    if (isSelected) {
      // Don't allow deselecting if it would go below minimum
      if (selectedDisplayIds.length <= minRequired) {
        return;
      }
      onChange(selectedDisplayIds.filter(id => id !== displayId));
    } else {
      onChange([...selectedDisplayIds, displayId]);
    }
  };

  const handleSelectAll = () => {
    if (disabled) return;
    onChange(displays.map(d => d.displayId));
  };

  const handleClearAll = () => {
    if (disabled) return;
    // Keep at least minRequired
    if (displays.length >= minRequired) {
      onChange([displays[0].displayId]);
    }
  };

  if (displays.length === 0) {
    return (
      <div className={`p-6 ${getGlassClasses('subtle')} ${getRadiusClass('card')} text-center`}>
        <Monitor size={32} className="mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600 font-medium">No displays found</p>
        <p className="text-xs text-gray-500 mt-1">
          Please check your display connections
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with Select All / Clear */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor size={14} className="text-gray-600" />
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
            Select Displays ({selectedDisplayIds.length}/{displays.length})
          </label>
        </div>
        <div className="flex items-center gap-2">
          {selectedDisplayIds.length < displays.length && (
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={disabled}
              className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select All
            </button>
          )}
          {selectedDisplayIds.length > minRequired && (
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

      {/* Display Grid */}
      <div className="grid grid-cols-2 gap-3">
        {displays.map((display) => {
          const isSelected = selectedDisplayIds.includes(display.displayId);
          const canDeselect = selectedDisplayIds.length > minRequired;

          return (
            <motion.button
              key={`${display.displayId}-${refreshKey}`}
              type="button"
              onClick={() => handleToggleDisplay(display.displayId)}
              disabled={disabled || (isSelected && !canDeselect)}
              className={`
                relative group
                ${getRadiusClass('field')}
                overflow-hidden
                ${TRANSITIONS.fast}
                ${disabled || (isSelected && !canDeselect)
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer hover:scale-[1.02]'
                }
                ${isSelected
                  ? 'ring-2 ring-cyan-500 ring-offset-2 shadow-lg shadow-cyan-500/30'
                  : 'ring-2 ring-gray-300 hover:ring-cyan-300'
                }
              `}
              whileHover={!disabled && (canDeselect || !isSelected) ? { scale: 1.02 } : {}}
              whileTap={!disabled && (canDeselect || !isSelected) ? { scale: 0.98 } : {}}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 25,
              }}
            >
              {/* Thumbnail Background */}
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative">
                {display.thumbnailDataUri || display.thumbnail ? (
                  <img
                    src={display.thumbnailDataUri || display.thumbnail}
                    alt={display.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Monitor size={32} className="text-gray-400" />
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

                {/* Primary Badge with Star */}
                {display.isPrimary && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center gap-1 shadow-md">
                    <Star size={10} className="text-white fill-white" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wide">
                      Primary
                    </span>
                  </div>
                )}
              </div>

              {/* Display Info */}
              <div className={`p-3 ${getGlassClasses('medium')} border-t border-white/40`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${
                      isSelected ? 'text-cyan-900' : 'text-gray-900'
                    }`}>
                      {display.displayName}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {display.width} × {display.height}
                    </p>
                  </div>

                  {/* Checkbox */}
                  <div className={`
                    flex-shrink-0 ml-2 w-5 h-5 rounded border-2 flex items-center justify-center ${TRANSITIONS.fast}
                    ${isSelected
                      ? 'bg-cyan-500 border-cyan-500'
                      : 'bg-white border-gray-300 group-hover:border-cyan-400'
                    }
                  `}>
                    {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Validation Message */}
      {minRequired > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          {minRequired === 1
            ? 'At least 1 display must be selected'
            : `At least ${minRequired} displays must be selected`
          }
        </p>
      )}

      {/* Live Preview Info */}
      <div className="flex items-center gap-2 text-[10px] text-gray-500">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span>Previews refresh every 5 seconds</span>
      </div>
    </div>
  );
}
