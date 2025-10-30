import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Monitor, Camera, Settings2 } from 'lucide-react';
import type { DisplayInfo } from '../../types';
import { DisplayMultiSelect } from './DisplayMultiSelect';
import { validateVideoConfig, type ValidationResult } from '../../utils/sessionValidation';

interface AdvancedCaptureModalProps {
  show: boolean;
  onClose: () => void;

  // Webcam PiP settings
  pipPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom';
  onPipPositionChange: (position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom') => void;
  pipSize: 'small' | 'medium' | 'large' | 'custom';
  onPipSizeChange: (size: 'small' | 'medium' | 'large' | 'custom') => void;
  pipCustomPosition?: { x: number; y: number }; // percentage
  onPipCustomPositionChange: (position: { x: number; y: number }) => void;
  pipBorderEnabled: boolean;
  onPipBorderToggle: (enabled: boolean) => void;

  // Multi-display settings
  displays: DisplayInfo[];
  selectedDisplayIds: string[];
  onDisplayIdsChange: (displayIds: string[]) => void;
}

/**
 * AdvancedCaptureModal - Simplified capture settings
 *
 * Design Philosophy:
 * - Focus on essential settings: Display selection and PiP overlay
 * - We handle technical details (codec, bitrate, quality) automatically
 * - Simple tabbed layout for organization
 * - Users shouldn't worry about video/audio encoding settings
 */
export function AdvancedCaptureModal({
  show,
  onClose,
  pipPosition,
  onPipPositionChange,
  pipSize,
  onPipSizeChange,
  pipCustomPosition,
  onPipCustomPositionChange,
  pipBorderEnabled,
  onPipBorderToggle,
  displays,
  selectedDisplayIds,
  onDisplayIdsChange,
}: AdvancedCaptureModalProps) {
  const [activeTab, setActiveTab] = useState<'display' | 'pip'>('display');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Handle save: validate settings, call onChange callbacks, then close
  const handleSave = () => {
    // Build video config for validation (minimal config for display selection validation)
    const videoConfig = {
      sourceType: 'display' as const,
      displayIds: selectedDisplayIds,
      quality: 'medium' as const,
      fps: 30,
    };

    // Validate using centralized validation
    const validation: ValidationResult = validateVideoConfig(videoConfig);

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return; // Don't close if validation fails
    }

    // Validation passed - now call all onChange callbacks to persist settings
    // Note: These callbacks should already be called during user interaction,
    // but we ensure they're all applied here before closing the modal
    onDisplayIdsChange(selectedDisplayIds);
    onPipPositionChange(pipPosition);
    onPipSizeChange(pipSize);
    if (pipCustomPosition) {
      onPipCustomPositionChange(pipCustomPosition);
    }
    onPipBorderToggle(pipBorderEnabled);

    // Clear errors and close
    setValidationErrors([]);
    onClose();
  };

  if (!show) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-8"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b-2 border-gray-200/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500">
                <Settings2 size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Capture Settings</h2>
                <p className="text-sm text-gray-500">Display selection and webcam overlay</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 px-6 pt-4 border-b border-gray-200/50">
            <TabButton
              icon={<Monitor size={16} />}
              label="Display Selection"
              active={activeTab === 'display'}
              onClick={() => setActiveTab('display')}
            />
            <TabButton
              icon={<Camera size={16} />}
              label="Webcam Overlay"
              active={activeTab === 'pip'}
              onClick={() => setActiveTab('pip')}
            />
          </div>

          {/* Tab Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-200px)]">
            {activeTab === 'display' && (
              <DisplayTab
                displays={displays}
                selectedDisplayIds={selectedDisplayIds}
                onDisplayIdsChange={onDisplayIdsChange}
              />
            )}

            {activeTab === 'pip' && (
              <PiPTab
                position={pipPosition}
                onPositionChange={onPipPositionChange}
                size={pipSize}
                onSizeChange={onPipSizeChange}
                customPosition={pipCustomPosition}
                onCustomPositionChange={onPipCustomPositionChange}
                borderEnabled={pipBorderEnabled}
                onBorderToggle={onPipBorderToggle}
              />
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200/50 bg-gray-50/50 space-y-3">
            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 space-y-2 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <div className="text-red-600 font-bold text-lg">⚠️</div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold text-red-900">Invalid Capture Settings</p>
                    {validationErrors.map((error, idx) => (
                      <p key={idx} className="text-xs text-red-800">• {error}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg"
              >
                Save Changes
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}

// ============================================================================
// TAB BUTTON COMPONENT
// ============================================================================

interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ icon, label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-semibold text-sm transition-all
        ${active
          ? 'bg-white text-cyan-600 border-t-2 border-x-2 border-cyan-400 -mb-[1px]'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

// ============================================================================
// DISPLAY TAB
// ============================================================================

interface DisplayTabProps {
  displays: DisplayInfo[];
  selectedDisplayIds: string[];
  onDisplayIdsChange: (displayIds: string[]) => void;
}

function DisplayTab({ displays, selectedDisplayIds, onDisplayIdsChange }: DisplayTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Screen Selection">
        {displays.length > 0 ? (
          <DisplayMultiSelect
            displays={displays}
            selectedDisplayIds={selectedDisplayIds}
            onChange={onDisplayIdsChange}
          />
        ) : (
          <div className="p-4 rounded-xl border-2 border-gray-200 text-center text-gray-500">
            No displays detected. Please check your system settings.
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Select which displays to capture during your session. You can record multiple displays simultaneously.
        </p>
      </Section>

      <Section title="Recording Quality">
        <div className="p-4 rounded-xl bg-cyan-50 border-2 border-cyan-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-cyan-500">
              <Settings2 size={16} className="text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Automatic Optimization</h4>
              <p className="text-sm text-gray-600 mt-1">
                We automatically optimize video quality, codec (H.264), and bitrate (5000 kbps) for the best balance of quality and file size. Screenshots are saved as WebP at 80% quality for efficient AI analysis.
              </p>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ============================================================================
// PIP TAB
// ============================================================================

interface PiPTabProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom';
  onPositionChange: (position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom') => void;
  size: 'small' | 'medium' | 'large' | 'custom';
  onSizeChange: (size: 'small' | 'medium' | 'large' | 'custom') => void;
  customPosition?: { x: number; y: number };
  onCustomPositionChange: (position: { x: number; y: number }) => void;
  borderEnabled: boolean;
  onBorderToggle: (enabled: boolean) => void;
}

function PiPTab({
  position,
  onPositionChange,
  size,
  onSizeChange,
  customPosition,
  onCustomPositionChange,
  borderEnabled,
  onBorderToggle,
}: PiPTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Position">
        <RadioGrid
          options={[
            { value: 'top-left', label: 'Top Left', description: null },
            { value: 'top-right', label: 'Top Right', description: null },
            { value: 'bottom-left', label: 'Bottom Left', description: null },
            { value: 'bottom-right', label: 'Bottom Right', description: null },
            { value: 'custom', label: 'Custom', description: 'Manual position' },
          ]}
          value={position}
          onChange={(v) => onPositionChange(v as typeof position)}
        />
      </Section>

      {position === 'custom' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-4"
        >
          <Section title="Custom Position (%)">
            <div className="grid grid-cols-2 gap-4">
              <Slider
                label="Horizontal"
                value={customPosition?.x || 10}
                onChange={(x) => onCustomPositionChange({ x, y: customPosition?.y || 10 })}
                min={0}
                max={100}
                step={1}
                suffix="%"
              />
              <Slider
                label="Vertical"
                value={customPosition?.y || 10}
                onChange={(y) => onCustomPositionChange({ x: customPosition?.x || 10, y })}
                min={0}
                max={100}
                step={1}
                suffix="%"
              />
            </div>
          </Section>
        </motion.div>
      )}

      <Section title="Size">
        <RadioGrid
          options={[
            { value: 'small', label: 'Small', description: '15% of screen' },
            { value: 'medium', label: 'Medium', description: '25% of screen' },
            { value: 'large', label: 'Large', description: '40% of screen' },
          ]}
          value={size}
          onChange={(v) => onSizeChange(v as typeof size)}
        />
      </Section>

      <Section title="Border">
        <ToggleSwitch
          label="Show Border"
          checked={borderEnabled}
          onChange={onBorderToggle}
        />
      </Section>
    </div>
  );
}


// ============================================================================
// REUSABLE UI PRIMITIVES
// ============================================================================

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

interface RadioGridProps {
  options: Array<{ value: string; label: string; description: string | null }>;
  value: string;
  onChange: (value: string) => void;
}

function RadioGrid({ options, value, onChange }: RadioGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`
            p-4 rounded-xl border-2 transition-all text-left
            ${value === option.value
              ? 'border-cyan-400 bg-cyan-50'
              : 'border-gray-200 hover:border-gray-300'
            }
          `}
        >
          <div className="font-semibold text-gray-900">{option.label}</div>
          {option.description && (
            <div className="text-xs text-gray-500 mt-1">{option.description}</div>
          )}
        </button>
      ))}
    </div>
  );
}


interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}

function Slider({ label, value, onChange, min, max, step, suffix }: SliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-600">{label}</label>
        <span className="text-sm font-bold text-cyan-600">
          {value}{suffix || ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer
          bg-gradient-to-r from-cyan-200 to-blue-200
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-gradient-to-r
          [&::-webkit-slider-thumb]:from-cyan-500
          [&::-webkit-slider-thumb]:to-blue-500
          [&::-webkit-slider-thumb]:shadow-lg
          [&::-webkit-slider-thumb]:cursor-pointer
        "
      />
    </div>
  );
}


interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ label, checked, onChange }: ToggleSwitchProps) {
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
