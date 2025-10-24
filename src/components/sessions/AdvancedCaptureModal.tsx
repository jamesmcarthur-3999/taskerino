import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Monitor, Video, Camera, Settings2, FileVideo } from 'lucide-react';
import type { DisplayInfo } from '../../types';
import { DisplayMultiSelect } from './DisplayMultiSelect';

interface AdvancedCaptureModalProps {
  show: boolean;
  onClose: () => void;

  // Video quality settings
  quality: 'low' | 'medium' | 'high' | 'ultra' | 'custom';
  onQualityChange: (quality: 'low' | 'medium' | 'high' | 'ultra' | 'custom') => void;
  customResolution?: { width: number; height: number };
  onCustomResolutionChange: (resolution: { width: number; height: number }) => void;
  customFrameRate?: number;
  onCustomFrameRateChange: (fps: number) => void;

  // Codec settings
  codec: 'h264' | 'h265' | 'vp9';
  onCodecChange: (codec: 'h264' | 'h265' | 'vp9') => void;
  bitrate?: number; // kbps
  onBitrateChange: (bitrate: number) => void;

  // Screenshot settings
  screenshotFormat: 'png' | 'jpg' | 'webp';
  onScreenshotFormatChange: (format: 'png' | 'jpg' | 'webp') => void;
  screenshotQuality: number; // 0-100 for jpg/webp
  onScreenshotQualityChange: (quality: number) => void;

  // Webcam PiP advanced
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

  // Storage settings
  storageLocation: string;
  onStorageLocationChange: (path: string) => void;
  fileNamingPattern: string;
  onFileNamingPatternChange: (pattern: string) => void;
}

/**
 * AdvancedCaptureModal - Full-screen modal for power-user capture settings
 *
 * Design Philosophy:
 * - Tabbed layout for organization (Video, Screenshots, PiP, Storage)
 * - Detailed controls not needed for quick access
 * - Professional presentation with clear sections
 * - Modular structure for easy modification
 */
export function AdvancedCaptureModal({
  show,
  onClose,
  quality,
  onQualityChange,
  customResolution,
  onCustomResolutionChange,
  customFrameRate,
  onCustomFrameRateChange,
  codec,
  onCodecChange,
  bitrate,
  onBitrateChange,
  screenshotFormat,
  onScreenshotFormatChange,
  screenshotQuality,
  onScreenshotQualityChange,
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
  storageLocation,
  onStorageLocationChange,
  fileNamingPattern,
  onFileNamingPatternChange,
}: AdvancedCaptureModalProps) {
  const [activeTab, setActiveTab] = useState<'video' | 'screenshots' | 'pip' | 'storage'>('video');

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
                <h2 className="text-2xl font-bold text-gray-900">Advanced Capture Settings</h2>
                <p className="text-sm text-gray-500">Fine-tune your recording configuration</p>
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
              icon={<Video size={16} />}
              label="Video Quality"
              active={activeTab === 'video'}
              onClick={() => setActiveTab('video')}
            />
            <TabButton
              icon={<Monitor size={16} />}
              label="Screenshots"
              active={activeTab === 'screenshots'}
              onClick={() => setActiveTab('screenshots')}
            />
            <TabButton
              icon={<Camera size={16} />}
              label="PiP Overlay"
              active={activeTab === 'pip'}
              onClick={() => setActiveTab('pip')}
            />
            <TabButton
              icon={<FileVideo size={16} />}
              label="Storage"
              active={activeTab === 'storage'}
              onClick={() => setActiveTab('storage')}
            />
          </div>

          {/* Tab Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-200px)]">
            {activeTab === 'video' && (
              <VideoTab
                quality={quality}
                onQualityChange={onQualityChange}
                customResolution={customResolution}
                onCustomResolutionChange={onCustomResolutionChange}
                customFrameRate={customFrameRate}
                onCustomFrameRateChange={onCustomFrameRateChange}
                codec={codec}
                onCodecChange={onCodecChange}
                bitrate={bitrate}
                onBitrateChange={onBitrateChange}
                displays={displays}
                selectedDisplayIds={selectedDisplayIds}
                onDisplayIdsChange={onDisplayIdsChange}
              />
            )}

            {activeTab === 'screenshots' && (
              <ScreenshotsTab
                format={screenshotFormat}
                onFormatChange={onScreenshotFormatChange}
                quality={screenshotQuality}
                onQualityChange={onScreenshotQualityChange}
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

            {activeTab === 'storage' && (
              <StorageTab
                location={storageLocation}
                onLocationChange={onStorageLocationChange}
                namingPattern={fileNamingPattern}
                onNamingPatternChange={onFileNamingPatternChange}
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200/50 bg-gray-50/50">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg"
            >
              Save Changes
            </button>
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
// VIDEO TAB
// ============================================================================

interface VideoTabProps {
  quality: 'low' | 'medium' | 'high' | 'ultra' | 'custom';
  onQualityChange: (quality: 'low' | 'medium' | 'high' | 'ultra' | 'custom') => void;
  customResolution?: { width: number; height: number };
  onCustomResolutionChange: (resolution: { width: number; height: number }) => void;
  customFrameRate?: number;
  onCustomFrameRateChange: (fps: number) => void;
  codec: 'h264' | 'h265' | 'vp9';
  onCodecChange: (codec: 'h264' | 'h265' | 'vp9') => void;
  bitrate?: number;
  onBitrateChange: (bitrate: number) => void;
  displays: DisplayInfo[];
  selectedDisplayIds: string[];
  onDisplayIdsChange: (displayIds: string[]) => void;
}

function VideoTab({
  quality,
  onQualityChange,
  customResolution,
  onCustomResolutionChange,
  customFrameRate,
  onCustomFrameRateChange,
  codec,
  onCodecChange,
  bitrate,
  onBitrateChange,
  displays,
  selectedDisplayIds,
  onDisplayIdsChange,
}: VideoTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Quality Preset">
        <RadioGrid
          options={[
            { value: 'low', label: '720p @ 15fps', description: 'Low bandwidth' },
            { value: 'medium', label: '1080p @ 30fps', description: 'Balanced' },
            { value: 'high', label: '1080p @ 60fps', description: 'High quality' },
            { value: 'ultra', label: '4K @ 30fps', description: 'Maximum detail' },
            { value: 'custom', label: 'Custom', description: 'Manual config' },
          ]}
          value={quality}
          onChange={(v) => onQualityChange(v as typeof quality)}
        />
      </Section>

      {quality === 'custom' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-4"
        >
          <Section title="Custom Resolution">
            <div className="grid grid-cols-2 gap-4">
              <NumberInput
                label="Width"
                value={customResolution?.width || 1920}
                onChange={(w) => onCustomResolutionChange({ width: w, height: customResolution?.height || 1080 })}
                min={640}
                max={3840}
                step={1}
              />
              <NumberInput
                label="Height"
                value={customResolution?.height || 1080}
                onChange={(h) => onCustomResolutionChange({ width: customResolution?.width || 1920, height: h })}
                min={480}
                max={2160}
                step={1}
              />
            </div>
          </Section>

          <Section title="Frame Rate">
            <NumberInput
              label="FPS"
              value={customFrameRate || 30}
              onChange={onCustomFrameRateChange}
              min={15}
              max={120}
              step={5}
            />
          </Section>
        </motion.div>
      )}

      <Section title="Video Codec">
        <RadioGrid
          options={[
            { value: 'h264', label: 'H.264', description: 'Best compatibility' },
            { value: 'h265', label: 'H.265', description: 'Better compression' },
            { value: 'vp9', label: 'VP9', description: 'Open source' },
          ]}
          value={codec}
          onChange={(v) => onCodecChange(v as typeof codec)}
        />
      </Section>

      <Section title="Bitrate">
        <NumberInput
          label="kbps"
          value={bitrate || 5000}
          onChange={onBitrateChange}
          min={1000}
          max={50000}
          step={500}
        />
        <p className="text-xs text-gray-500 mt-2">
          Higher bitrate = better quality but larger files. Recommended: 5000-10000 kbps for 1080p
        </p>
      </Section>

      {displays.length > 0 && (
        <Section title="Display Selection">
          <DisplayMultiSelect
            displays={displays}
            selectedDisplayIds={selectedDisplayIds}
            onChange={onDisplayIdsChange}
          />
        </Section>
      )}
    </div>
  );
}

// ============================================================================
// SCREENSHOTS TAB
// ============================================================================

interface ScreenshotsTabProps {
  format: 'png' | 'jpg' | 'webp';
  onFormatChange: (format: 'png' | 'jpg' | 'webp') => void;
  quality: number;
  onQualityChange: (quality: number) => void;
}

function ScreenshotsTab({ format, onFormatChange, quality, onQualityChange }: ScreenshotsTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Image Format">
        <RadioGrid
          options={[
            { value: 'png', label: 'PNG', description: 'Lossless, larger files' },
            { value: 'jpg', label: 'JPEG', description: 'Compressed, smaller files' },
            { value: 'webp', label: 'WebP', description: 'Modern, best compression' },
          ]}
          value={format}
          onChange={(v) => onFormatChange(v as typeof format)}
        />
      </Section>

      {(format === 'jpg' || format === 'webp') && (
        <Section title="Compression Quality">
          <Slider
            label="Quality"
            value={quality}
            onChange={onQualityChange}
            min={50}
            max={100}
            step={5}
            suffix="%"
          />
          <p className="text-xs text-gray-500 mt-2">
            Higher quality = better detail but larger files. Recommended: 85-95%
          </p>
        </Section>
      )}
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
// STORAGE TAB
// ============================================================================

interface StorageTabProps {
  location: string;
  onLocationChange: (path: string) => void;
  namingPattern: string;
  onNamingPatternChange: (pattern: string) => void;
}

function StorageTab({ location, onLocationChange, namingPattern, onNamingPatternChange }: StorageTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Storage Location">
        <TextInput
          label="Path"
          value={location}
          onChange={onLocationChange}
          placeholder="/Users/you/Taskerino/sessions"
        />
        <p className="text-xs text-gray-500 mt-2">
          Location where session recordings will be saved
        </p>
      </Section>

      <Section title="File Naming Pattern">
        <TextInput
          label="Pattern"
          value={namingPattern}
          onChange={onNamingPatternChange}
          placeholder="session-{date}-{time}"
        />
        <p className="text-xs text-gray-500 mt-2">
          Available variables: {'{date}'}, {'{time}'}, {'{name}'}
        </p>
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

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}

function NumberInput({ label, value, onChange, min, max, step }: NumberInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-cyan-400 focus:outline-none text-sm font-medium text-gray-900"
      />
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

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function TextInput({ label, value, onChange, placeholder }: TextInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-cyan-400 focus:outline-none text-sm font-medium text-gray-900"
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
