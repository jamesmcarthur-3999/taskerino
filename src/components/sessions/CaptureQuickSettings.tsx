import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Video } from 'lucide-react';
import type { DisplayInfo, WindowInfo, WebcamInfo } from '../../types';
import { DisplayMultiSelect } from './DisplayMultiSelect';
import { WindowMultiSelect } from './WindowMultiSelect';
import { WebcamPreview } from './WebcamPreview';
import { getGlassmorphism, getRadiusClass, SHADOWS } from '../../design-system/theme';

interface CaptureQuickSettingsProps {
  show: boolean;
  onClose: () => void;

  // Video settings
  videoEnabled: boolean;
  onVideoToggle: (enabled: boolean) => void;
  quality: 'low' | 'medium' | 'high' | 'ultra' | 'custom';
  onQualityChange: (quality: 'low' | 'medium' | 'high' | 'ultra' | 'custom') => void;

  // Screenshot settings
  screenshotTiming: 'adaptive' | 'fixed';
  onTimingChange: (timing: 'adaptive' | 'fixed') => void;
  screenshotInterval: number; // minutes
  onIntervalChange: (interval: number) => void;

  // Source settings
  source: 'screen' | 'window' | 'webcam';
  onSourceChange: (source: 'screen' | 'window' | 'webcam') => void;
  selectedDisplayIds: string[];
  onDisplayIdsChange: (displayIds: string[]) => void;
  displays: DisplayInfo[];
  selectedWindowIds: string[];
  onWindowIdsChange: (windowIds: string[]) => void;
  windows: WindowInfo[];
  selectedWebcam?: string;
  onWebcamChange: (webcamId: string) => void;
  webcams: WebcamInfo[];

  // Webcam PiP
  webcamPipEnabled: boolean;
  onWebcamPipToggle: (enabled: boolean) => void;

  // Advanced modal
  onOpenAdvanced: () => void;

  // Permission requests
  onRequestScreenPermission?: () => void;
  onRequestCameraPermission?: () => void;
}

/**
 * CaptureQuickSettings - Dropdown for quick capture configuration
 *
 * Design Philosophy:
 * - Modular sections that can be easily reordered
 * - Props-driven to allow easy customization
 * - Clear visual hierarchy
 * - "Advanced Settings" link at bottom
 */
export function CaptureQuickSettings({
  show,
  onClose,
  videoEnabled,
  onVideoToggle,
  quality,
  onQualityChange,
  screenshotTiming,
  onTimingChange,
  screenshotInterval,
  onIntervalChange,
  source,
  onSourceChange,
  selectedDisplayIds,
  onDisplayIdsChange,
  displays,
  selectedWindowIds,
  onWindowIdsChange,
  windows,
  selectedWebcam,
  onWebcamChange,
  webcams,
  webcamPipEnabled,
  onWebcamPipToggle,
  onOpenAdvanced,
  onRequestScreenPermission,
  onRequestCameraPermission,
}: CaptureQuickSettingsProps) {
  // Click outside to close
  const handleBackdropClick = () => {
    onClose();
  };

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={handleBackdropClick}
      />

      {/* Dropdown */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -5, scale: 0.98 }}
          transition={{
            type: 'spring',
            damping: 25,
            stiffness: 300,
          }}
          className={`absolute top-full left-0 mt-2 w-96 bg-white/80 backdrop-blur-2xl ${getRadiusClass('modal')} border-2 border-cyan-400/80 ${SHADOWS.modal} z-[9999]`}
          onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b-2 border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Video size={20} className="text-cyan-600" />
              Capture Settings
            </h3>
            <button
              onClick={onClose}
              className={`p-1.5 ${getRadiusClass('element')} hover:bg-white/60 transition-colors`}
              aria-label="Close"
            >
              <X size={18} className="text-gray-600" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* SECTION: Video Recording */}
            <Section label="Recording">
            <Toggle
              label="Video Recording"
              checked={videoEnabled}
              onChange={onVideoToggle}
            />

            {videoEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pl-6 space-y-3"
              >
                <Select
                  label="Quality"
                  value={quality}
                  onChange={(v) => onQualityChange(v as typeof quality)}
                  options={[
                    { value: 'low', label: 'Low (720p @ 15fps)' },
                    { value: 'medium', label: 'Medium (1080p @ 30fps)' },
                    { value: 'high', label: 'High (1080p @ 60fps)' },
                    { value: 'ultra', label: 'Ultra (4K @ 30fps)' },
                  ]}
                />
              </motion.div>
            )}
          </Section>

          {/* SECTION: Screenshot Timing */}
          <Section label="Screenshot Analysis">
            <RadioGroup
              options={[
                { value: 'adaptive', label: 'Adaptive (AI)', description: 'Smart intervals based on activity' },
                { value: 'fixed', label: 'Fixed Interval', description: null },
              ]}
              value={screenshotTiming}
              onChange={(v) => onTimingChange(v as typeof screenshotTiming)}
            />

            {screenshotTiming === 'fixed' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pl-6 pt-2"
              >
                <Select
                  label="Every"
                  value={String(screenshotInterval)}
                  onChange={(val) => onIntervalChange(Number(val))}
                  options={[
                    { value: '0.5', label: '30 seconds' },
                    { value: '1', label: '1 minute' },
                    { value: '2', label: '2 minutes' },
                    { value: '3', label: '3 minutes' },
                    { value: '5', label: '5 minutes' },
                  ]}
                />
              </motion.div>
            )}
          </Section>

          {/* SECTION: Capture Source */}
          <Section label="Capture Source">
            <RadioGroup
              options={[
                { value: 'screen', label: 'Screen', description: null },
                { value: 'window', label: 'Window/App', description: null },
                { value: 'webcam', label: 'Webcam Only', description: null },
              ]}
              value={source}
              onChange={(v) => onSourceChange(v as typeof source)}
            />

            {source === 'screen' && (
              displays.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pl-6 pt-3"
                >
                  <DisplayMultiSelect
                    displays={displays}
                    selectedDisplayIds={selectedDisplayIds}
                    onChange={onDisplayIdsChange}
                  />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pl-6 pt-2"
                >
                  <div className="p-3 bg-yellow-50/60 backdrop-blur-lg rounded-xl border-2 border-yellow-300/60 space-y-2">
                    <p className="text-xs text-yellow-900 font-semibold">⚠️ No displays detected</p>
                    <p className="text-xs text-yellow-800">Screen Recording permission is required to capture displays.</p>
                    {onRequestScreenPermission && (
                      <button
                        onClick={onRequestScreenPermission}
                        className={`w-full px-3 py-1.5 bg-yellow-500/90 hover:bg-yellow-600 text-white text-xs font-semibold ${getRadiusClass('element')} transition-colors`}
                      >
                        Request Permission
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            )}

            {source === 'window' && (
              windows.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pl-6 pt-3"
                >
                  <WindowMultiSelect
                    windows={windows}
                    selectedWindowIds={selectedWindowIds}
                    onChange={onWindowIdsChange}
                    allowMultiple={true}
                  />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pl-6 pt-2"
                >
                  <div className="p-3 bg-yellow-50/60 backdrop-blur-lg rounded-xl border-2 border-yellow-300/60 space-y-2">
                    <p className="text-xs text-yellow-900 font-semibold">⚠️ No windows detected</p>
                    <p className="text-xs text-yellow-800">Screen Recording permission is required to see available windows.</p>
                    {onRequestScreenPermission && (
                      <button
                        onClick={onRequestScreenPermission}
                        className={`w-full px-3 py-1.5 bg-yellow-500/90 hover:bg-yellow-600 text-white text-xs font-semibold ${getRadiusClass('element')} transition-colors`}
                      >
                        Request Permission
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            )}

            {source === 'webcam' && (
              webcams.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pl-6 pt-2"
                >
                  <Select
                    label="Camera"
                    value={selectedWebcam || webcams[0]?.deviceId || ''}
                    onChange={onWebcamChange}
                    options={webcams.map(c => ({
                      value: c.deviceId,
                      label: `${c.deviceName}${c.position !== 'unspecified' ? ` (${c.position})` : ''}`
                    }))}
                  />

                  {/* Live Webcam Preview */}
                  <div className="mt-3">
                    <label className="text-xs font-semibold text-gray-600 mb-2 block">Live Preview</label>
                    <WebcamPreview
                      webcamDeviceId={selectedWebcam || webcams[0]?.deviceId}
                      className="aspect-video"
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pl-6 pt-2"
                >
                  <div className="p-3 bg-yellow-50/60 backdrop-blur-lg rounded-xl border-2 border-yellow-300/60 space-y-2">
                    <p className="text-xs text-yellow-900 font-semibold">⚠️ No webcams detected</p>
                    <p className="text-xs text-yellow-800">Camera permission is required to access webcams.</p>
                    {onRequestCameraPermission && (
                      <button
                        onClick={onRequestCameraPermission}
                        className={`w-full px-3 py-1.5 bg-yellow-500/90 hover:bg-yellow-600 text-white text-xs font-semibold ${getRadiusClass('element')} transition-colors`}
                      >
                        Request Permission
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            )}
          </Section>

          {/* SECTION: Webcam PiP */}
          {source !== 'webcam' && (
            <Section label="Webcam Overlay">
              <Toggle
                label="Picture-in-Picture"
                checked={webcamPipEnabled}
                onChange={onWebcamPipToggle}
              />
            </Section>
          )}
          </div>

          {/* Footer: Advanced Settings Link */}
          <div className="px-5 pb-5 pt-4 border-t-2 border-white/30">
            <button
              onClick={() => {
                onClose();
                onOpenAdvanced();
              }}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 ${getRadiusClass('field')} bg-white/60 backdrop-blur-lg hover:bg-white/70 border-2 border-white/50 hover:border-cyan-400/60 text-cyan-700 font-semibold text-sm transition-all`}
            >
              <Settings size={16} />
              Advanced Settings...
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// ============================================================================
// REUSABLE UI PRIMITIVES
// These can be easily modified without touching parent component logic
// ============================================================================

interface SectionProps {
  label: string;
  children: React.ReactNode;
}

function Section({ label, children }: SectionProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
        {label}
      </h4>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <div
        className={`
          relative w-11 h-6 rounded-full transition-colors
          ${checked ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-300'}
        `}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`
            absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </div>
    </label>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 ${getRadiusClass('field')} bg-white/50 backdrop-blur-md border border-white/50 focus:border-cyan-400 focus:outline-none text-sm font-medium text-gray-900`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface RadioGroupProps {
  options: Array<{ value: string; label: string; description: string | null }>;
  value: string;
  onChange: (value: string) => void;
}

function RadioGroup({ options, value, onChange }: RadioGroupProps) {
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex items-start gap-3 cursor-pointer group"
        >
          <div className="relative flex items-center justify-center w-5 h-5 mt-0.5">
            <input
              type="radio"
              name="radio-group"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <div
              className={`
                w-5 h-5 rounded-full border-2 transition-all
                ${value === option.value
                  ? 'border-cyan-500 bg-cyan-50/30'
                  : 'border-gray-300 bg-transparent group-hover:border-cyan-300'
                }
              `}
            >
              {value === option.value && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                </div>
              )}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">{option.label}</div>
            {option.description && (
              <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}
