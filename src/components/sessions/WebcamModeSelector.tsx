import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, VideoOff } from 'lucide-react';
import { getGlassClasses, getRadiusClass } from '../../design-system/theme';

export interface WebcamMode {
  mode: 'off' | 'pip' | 'standalone';
  pipConfig?: {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    size: 'small' | 'medium' | 'large';
  };
}

export interface WebcamModeSelectorProps {
  value: WebcamMode;
  onChange: (mode: WebcamMode) => void;
  disabled?: boolean;
}

/**
 * WebcamModeSelector - 3-way toggle for webcam recording modes
 *
 * Features:
 * - Off / PiP / Standalone mode selection
 * - PiP position selector (4 corners with visual layout)
 * - Size selector: Small/Medium/Large
 * - Smooth Framer Motion transitions
 * - Conditional rendering (position/size only for PiP mode)
 * - Glassmorphism styling matching design system
 */
export function WebcamModeSelector({
  value,
  onChange,
  disabled = false,
}: WebcamModeSelectorProps) {
  const handleModeChange = (mode: 'off' | 'pip' | 'standalone') => {
    if (disabled) return;

    if (mode === 'off') {
      onChange({ mode: 'off' });
    } else if (mode === 'standalone') {
      onChange({ mode: 'standalone' });
    } else {
      // PiP mode - initialize with default config if not set
      onChange({
        mode: 'pip',
        pipConfig: value.pipConfig || {
          position: 'bottom-right',
          size: 'medium',
        },
      });
    }
  };

  const handlePositionChange = (position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    if (disabled || value.mode !== 'pip') return;

    onChange({
      mode: 'pip',
      pipConfig: {
        ...value.pipConfig!,
        position,
      },
    });
  };

  const handleSizeChange = (size: 'small' | 'medium' | 'large') => {
    if (disabled || value.mode !== 'pip') return;

    onChange({
      mode: 'pip',
      pipConfig: {
        ...value.pipConfig!,
        size,
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-900">Webcam Mode</label>
        <div className="flex gap-2" role="group" aria-label="Webcam recording mode selection">
          {/* Off Button */}
          <button
            type="button"
            onClick={() => handleModeChange('off')}
            disabled={disabled}
            className={`
              flex-1 px-4 py-3 rounded-xl text-sm font-semibold
              transition-all duration-200
              ${value.mode === 'off'
                ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-lg shadow-gray-500/30'
                : 'bg-white/50 text-gray-700 border border-white/40 hover:bg-white/70'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              flex items-center justify-center gap-2
            `}
            aria-label="Disable webcam recording"
            aria-pressed={value.mode === 'off'}
          >
            <VideoOff size={16} />
            Off
          </button>

          {/* PiP Button */}
          <button
            type="button"
            onClick={() => handleModeChange('pip')}
            disabled={disabled}
            className={`
              flex-1 px-4 py-3 rounded-xl text-sm font-semibold
              transition-all duration-200
              ${value.mode === 'pip'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
                : 'bg-white/50 text-gray-700 border border-white/40 hover:bg-white/70'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              flex items-center justify-center gap-2
            `}
            aria-label="Enable picture-in-picture webcam recording"
            aria-pressed={value.mode === 'pip'}
            aria-controls={value.mode === 'pip' ? 'pip-configuration' : undefined}
          >
            <Camera size={16} />
            PiP
          </button>

          {/* Standalone Button */}
          <button
            type="button"
            onClick={() => handleModeChange('standalone')}
            disabled={disabled}
            className={`
              flex-1 px-4 py-3 rounded-xl text-sm font-semibold
              transition-all duration-200
              ${value.mode === 'standalone'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
                : 'bg-white/50 text-gray-700 border border-white/40 hover:bg-white/70'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              flex items-center justify-center gap-2
            `}
            aria-label="Enable standalone webcam recording"
            aria-pressed={value.mode === 'standalone'}
          >
            <Camera size={16} />
            Standalone
          </button>
        </div>
      </div>

      {/* PiP Configuration - Only show when PiP mode is selected */}
      <AnimatePresence>
        {value.mode === 'pip' && (
          <motion.div
            id="pip-configuration"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0.0, 0.2, 1] }}
            className="overflow-hidden"
            role="region"
            aria-label="Picture-in-picture configuration"
          >
            <div className={`p-4 ${getGlassClasses('medium')} rounded-xl space-y-4`}>
              {/* Position Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase">Position</label>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Picture-in-picture position selection">
                  {/* Top Left */}
                  <button
                    type="button"
                    onClick={() => handlePositionChange('top-left')}
                    disabled={disabled}
                    className={`
                      aspect-video rounded-lg border-2 transition-all
                      ${value.pipConfig?.position === 'top-left'
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-300 bg-white/50 hover:border-cyan-300'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      relative overflow-hidden
                    `}
                    aria-label="Position webcam at top left"
                    aria-pressed={value.pipConfig?.position === 'top-left'}
                  >
                    {/* Visual representation of PiP position */}
                    <div className="absolute inset-0 p-1">
                      <div className={`
                        w-1/3 h-1/3 rounded-sm
                        ${value.pipConfig?.position === 'top-left' ? 'bg-cyan-500' : 'bg-gray-400'}
                      `} />
                    </div>
                  </button>

                  {/* Top Right */}
                  <button
                    type="button"
                    onClick={() => handlePositionChange('top-right')}
                    disabled={disabled}
                    className={`
                      aspect-video rounded-lg border-2 transition-all
                      ${value.pipConfig?.position === 'top-right'
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-300 bg-white/50 hover:border-cyan-300'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      relative overflow-hidden
                    `}
                    aria-label="Position webcam at top right"
                    aria-pressed={value.pipConfig?.position === 'top-right'}
                  >
                    <div className="absolute inset-0 p-1 flex justify-end">
                      <div className={`
                        w-1/3 h-1/3 rounded-sm
                        ${value.pipConfig?.position === 'top-right' ? 'bg-cyan-500' : 'bg-gray-400'}
                      `} />
                    </div>
                  </button>

                  {/* Bottom Left */}
                  <button
                    type="button"
                    onClick={() => handlePositionChange('bottom-left')}
                    disabled={disabled}
                    className={`
                      aspect-video rounded-lg border-2 transition-all
                      ${value.pipConfig?.position === 'bottom-left'
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-300 bg-white/50 hover:border-cyan-300'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      relative overflow-hidden
                    `}
                    aria-label="Position webcam at bottom left"
                    aria-pressed={value.pipConfig?.position === 'bottom-left'}
                  >
                    <div className="absolute inset-0 p-1 flex items-end">
                      <div className={`
                        w-1/3 h-1/3 rounded-sm
                        ${value.pipConfig?.position === 'bottom-left' ? 'bg-cyan-500' : 'bg-gray-400'}
                      `} />
                    </div>
                  </button>

                  {/* Bottom Right */}
                  <button
                    type="button"
                    onClick={() => handlePositionChange('bottom-right')}
                    disabled={disabled}
                    className={`
                      aspect-video rounded-lg border-2 transition-all
                      ${value.pipConfig?.position === 'bottom-right'
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-300 bg-white/50 hover:border-cyan-300'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      relative overflow-hidden
                    `}
                    aria-label="Position webcam at bottom right"
                    aria-pressed={value.pipConfig?.position === 'bottom-right'}
                  >
                    <div className="absolute inset-0 p-1 flex items-end justify-end">
                      <div className={`
                        w-1/3 h-1/3 rounded-sm
                        ${value.pipConfig?.position === 'bottom-right' ? 'bg-cyan-500' : 'bg-gray-400'}
                      `} />
                    </div>
                  </button>
                </div>
              </div>

              {/* Size Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase">Size</label>
                <div className="flex gap-3" role="group" aria-label="Picture-in-picture size selection">
                  {/* Small */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pip-size"
                      checked={value.pipConfig?.size === 'small'}
                      onChange={() => handleSizeChange('small')}
                      disabled={disabled}
                      className="w-4 h-4 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-gray-900">Small</span>
                  </label>

                  {/* Medium */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pip-size"
                      checked={value.pipConfig?.size === 'medium'}
                      onChange={() => handleSizeChange('medium')}
                      disabled={disabled}
                      className="w-4 h-4 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-gray-900">Medium</span>
                  </label>

                  {/* Large */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pip-size"
                      checked={value.pipConfig?.size === 'large'}
                      onChange={() => handleSizeChange('large')}
                      disabled={disabled}
                      className="w-4 h-4 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-gray-900">Large</span>
                  </label>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
