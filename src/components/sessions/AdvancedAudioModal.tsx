import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, Volume2, Settings2, Sliders } from 'lucide-react';
import type { AudioDevice } from '../../types';
import { GlassSelect } from '../GlassSelect';

interface AdvancedAudioModalProps {
  show: boolean;
  onClose: () => void;

  // Microphone advanced settings
  micDevices: AudioDevice[];
  selectedMicDevice?: string;
  onMicDeviceChange: (deviceId: string) => void;
  micGain: number; // 0-200 (100 = unity)
  onMicGainChange: (gain: number) => void;
  micNoiseReduction: boolean;
  onMicNoiseReductionToggle: (enabled: boolean) => void;
  micEchoCancellation: boolean;
  onMicEchoCancellationToggle: (enabled: boolean) => void;

  // System audio advanced settings
  systemAudioDevices: AudioDevice[];
  selectedSystemAudioDevice?: string;
  onSystemAudioDeviceChange: (deviceId: string) => void;
  systemAudioGain: number; // 0-200 (100 = unity)
  onSystemAudioGainChange: (gain: number) => void;

  // Per-app audio routing
  perAppAudioEnabled: boolean;
  onPerAppAudioToggle: (enabled: boolean) => void;
  selectedApps: string[]; // Bundle IDs
  onSelectedAppsChange: (apps: string[]) => void;
  availableApps: Array<{ bundleId: string; name: string; icon?: string }>;

  // Audio processing
  autoLevelingEnabled: boolean;
  onAutoLevelingToggle: (enabled: boolean) => void;
  compressionEnabled: boolean;
  onCompressionToggle: (enabled: boolean) => void;
  compressionThreshold: number; // dB
  onCompressionThresholdChange: (threshold: number) => void;

  // Sample rate & format
  sampleRate: 44100 | 48000 | 96000;
  onSampleRateChange: (rate: 44100 | 48000 | 96000) => void;
  bitDepth: 16 | 24 | 32;
  onBitDepthChange: (depth: 16 | 24 | 32) => void;
}

/**
 * AdvancedAudioModal - Full-screen modal for power-user audio settings
 *
 * Design Philosophy:
 * - Tabbed layout for organization (Microphone, System Audio, Processing, Routing)
 * - Professional audio controls (gain, compression, etc.)
 * - Per-app audio routing for macOS
 * - Modular structure for easy modification
 */
export function AdvancedAudioModal({
  show,
  onClose,
  micDevices,
  selectedMicDevice,
  onMicDeviceChange,
  micGain,
  onMicGainChange,
  micNoiseReduction,
  onMicNoiseReductionToggle,
  micEchoCancellation,
  onMicEchoCancellationToggle,
  systemAudioDevices,
  selectedSystemAudioDevice,
  onSystemAudioDeviceChange,
  systemAudioGain,
  onSystemAudioGainChange,
  perAppAudioEnabled,
  onPerAppAudioToggle,
  selectedApps,
  onSelectedAppsChange,
  availableApps,
  autoLevelingEnabled,
  onAutoLevelingToggle,
  compressionEnabled,
  onCompressionToggle,
  compressionThreshold,
  onCompressionThresholdChange,
  sampleRate,
  onSampleRateChange,
  bitDepth,
  onBitDepthChange,
}: AdvancedAudioModalProps) {
  const [activeTab, setActiveTab] = useState<'mic' | 'system' | 'processing' | 'routing'>('mic');

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
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                <Settings2 size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Advanced Audio Settings</h2>
                <p className="text-sm text-gray-500">Professional audio configuration</p>
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
              icon={<Mic size={16} />}
              label="Microphone"
              active={activeTab === 'mic'}
              onClick={() => setActiveTab('mic')}
            />
            <TabButton
              icon={<Volume2 size={16} />}
              label="System Audio"
              active={activeTab === 'system'}
              onClick={() => setActiveTab('system')}
            />
            <TabButton
              icon={<Sliders size={16} />}
              label="Processing"
              active={activeTab === 'processing'}
              onClick={() => setActiveTab('processing')}
            />
            <TabButton
              icon={<Settings2 size={16} />}
              label="Per-App Routing"
              active={activeTab === 'routing'}
              onClick={() => setActiveTab('routing')}
            />
          </div>

          {/* Tab Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-200px)]">
            {activeTab === 'mic' && (
              <MicrophoneTab
                devices={micDevices}
                selectedDevice={selectedMicDevice}
                onDeviceChange={onMicDeviceChange}
                gain={micGain}
                onGainChange={onMicGainChange}
                noiseReduction={micNoiseReduction}
                onNoiseReductionToggle={onMicNoiseReductionToggle}
                echoCancellation={micEchoCancellation}
                onEchoCancellationToggle={onMicEchoCancellationToggle}
              />
            )}

            {activeTab === 'system' && (
              <SystemAudioTab
                devices={systemAudioDevices}
                selectedDevice={selectedSystemAudioDevice}
                onDeviceChange={onSystemAudioDeviceChange}
                gain={systemAudioGain}
                onGainChange={onSystemAudioGainChange}
              />
            )}

            {activeTab === 'processing' && (
              <ProcessingTab
                autoLevelingEnabled={autoLevelingEnabled}
                onAutoLevelingToggle={onAutoLevelingToggle}
                compressionEnabled={compressionEnabled}
                onCompressionToggle={onCompressionToggle}
                compressionThreshold={compressionThreshold}
                onCompressionThresholdChange={onCompressionThresholdChange}
                sampleRate={sampleRate}
                onSampleRateChange={onSampleRateChange}
                bitDepth={bitDepth}
                onBitDepthChange={onBitDepthChange}
              />
            )}

            {activeTab === 'routing' && (
              <RoutingTab
                enabled={perAppAudioEnabled}
                onToggle={onPerAppAudioToggle}
                selectedApps={selectedApps}
                onSelectedAppsChange={onSelectedAppsChange}
                availableApps={availableApps}
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
              className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
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
          ? 'bg-white text-purple-600 border-t-2 border-x-2 border-purple-400 -mb-[1px]'
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
// MICROPHONE TAB
// ============================================================================

interface MicrophoneTabProps {
  devices: AudioDevice[];
  selectedDevice?: string;
  onDeviceChange: (deviceId: string) => void;
  gain: number;
  onGainChange: (gain: number) => void;
  noiseReduction: boolean;
  onNoiseReductionToggle: (enabled: boolean) => void;
  echoCancellation: boolean;
  onEchoCancellationToggle: (enabled: boolean) => void;
}

function MicrophoneTab({
  devices,
  selectedDevice,
  onDeviceChange,
  gain,
  onGainChange,
  noiseReduction,
  onNoiseReductionToggle,
  echoCancellation,
  onEchoCancellationToggle,
}: MicrophoneTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Input Device">
        <GlassSelect
          value={selectedDevice || devices[0]?.id || ''}
          onChange={onDeviceChange}
          options={devices.map((device) => ({
            value: device.id,
            label: device.name,
            icon: Mic,
          }))}
          variant="secondary"
          showLabel={false}
          className="w-full"
        />
      </Section>

      <Section title="Input Gain">
        <GainSlider
          value={gain}
          onChange={onGainChange}
          min={0}
          max={200}
          step={5}
        />
        <p className="text-xs text-gray-500 mt-2">
          Adjust microphone input level. 100% = unity gain (no change)
        </p>
      </Section>

      <Section title="Noise Reduction">
        <ToggleSwitch
          label="Enable Noise Reduction"
          description="Reduces background noise using AI processing"
          checked={noiseReduction}
          onChange={onNoiseReductionToggle}
        />
      </Section>

      <Section title="Echo Cancellation">
        <ToggleSwitch
          label="Enable Echo Cancellation"
          description="Removes feedback from speakers"
          checked={echoCancellation}
          onChange={onEchoCancellationToggle}
        />
      </Section>
    </div>
  );
}

// ============================================================================
// SYSTEM AUDIO TAB
// ============================================================================

interface SystemAudioTabProps {
  devices: AudioDevice[];
  selectedDevice?: string;
  onDeviceChange: (deviceId: string) => void;
  gain: number;
  onGainChange: (gain: number) => void;
}

function SystemAudioTab({
  devices,
  selectedDevice,
  onDeviceChange,
  gain,
  onGainChange,
}: SystemAudioTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Output Device">
        <GlassSelect
          value={selectedDevice || devices[0]?.id || ''}
          onChange={onDeviceChange}
          options={devices.map((device) => ({
            value: device.id,
            label: device.name,
            icon: Volume2,
          }))}
          variant="secondary"
          showLabel={false}
          className="w-full"
        />
      </Section>

      <Section title="Capture Gain">
        <GainSlider
          value={gain}
          onChange={onGainChange}
          min={0}
          max={200}
          step={5}
        />
        <p className="text-xs text-gray-500 mt-2">
          Adjust system audio capture level. 100% = unity gain (no change)
        </p>
      </Section>

      <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
        <p className="text-sm text-purple-900 font-medium">
          💡 Tip: Use Per-App Routing to capture specific applications only
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// PROCESSING TAB
// ============================================================================

interface ProcessingTabProps {
  autoLevelingEnabled: boolean;
  onAutoLevelingToggle: (enabled: boolean) => void;
  compressionEnabled: boolean;
  onCompressionToggle: (enabled: boolean) => void;
  compressionThreshold: number;
  onCompressionThresholdChange: (threshold: number) => void;
  sampleRate: 44100 | 48000 | 96000;
  onSampleRateChange: (rate: 44100 | 48000 | 96000) => void;
  bitDepth: 16 | 24 | 32;
  onBitDepthChange: (depth: 16 | 24 | 32) => void;
}

function ProcessingTab({
  autoLevelingEnabled,
  onAutoLevelingToggle,
  compressionEnabled,
  onCompressionToggle,
  compressionThreshold,
  onCompressionThresholdChange,
  sampleRate,
  onSampleRateChange,
  bitDepth,
  onBitDepthChange,
}: ProcessingTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Auto Leveling">
        <ToggleSwitch
          label="Automatic Level Control"
          description="Maintains consistent audio levels automatically"
          checked={autoLevelingEnabled}
          onChange={onAutoLevelingToggle}
        />
      </Section>

      <Section title="Compression">
        <ToggleSwitch
          label="Enable Compression"
          description="Reduces dynamic range for consistent volume"
          checked={compressionEnabled}
          onChange={onCompressionToggle}
        />

        {compressionEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 space-y-3"
          >
            <Slider
              label="Threshold"
              value={compressionThreshold}
              onChange={onCompressionThresholdChange}
              min={-40}
              max={0}
              step={1}
              suffix=" dB"
            />
            <p className="text-xs text-gray-500">
              Audio above this level will be compressed. Typical: -20dB to -10dB
            </p>
          </motion.div>
        )}
      </Section>

      <Section title="Sample Rate">
        <RadioGrid
          options={[
            { value: '44100', label: '44.1 kHz', description: 'CD quality' },
            { value: '48000', label: '48 kHz', description: 'Pro standard' },
            { value: '96000', label: '96 kHz', description: 'High resolution' },
          ]}
          value={String(sampleRate)}
          onChange={(v) => onSampleRateChange(Number(v) as 44100 | 48000 | 96000)}
        />
      </Section>

      <Section title="Bit Depth">
        <RadioGrid
          options={[
            { value: '16', label: '16-bit', description: 'CD quality' },
            { value: '24', label: '24-bit', description: 'Pro standard' },
            { value: '32', label: '32-bit', description: 'Maximum quality' },
          ]}
          value={String(bitDepth)}
          onChange={(v) => onBitDepthChange(Number(v) as 16 | 24 | 32)}
        />
      </Section>
    </div>
  );
}

// ============================================================================
// ROUTING TAB
// ============================================================================

interface RoutingTabProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  selectedApps: string[];
  onSelectedAppsChange: (apps: string[]) => void;
  availableApps: Array<{ bundleId: string; name: string; icon?: string }>;
}

function RoutingTab({
  enabled,
  onToggle,
  selectedApps,
  onSelectedAppsChange,
  availableApps,
}: RoutingTabProps) {
  const handleAppToggle = (bundleId: string) => {
    if (selectedApps.includes(bundleId)) {
      onSelectedAppsChange(selectedApps.filter((id) => id !== bundleId));
    } else {
      onSelectedAppsChange([...selectedApps, bundleId]);
    }
  };

  return (
    <div className="space-y-6">
      <Section title="Per-Application Audio Routing">
        <ToggleSwitch
          label="Enable Per-App Audio"
          description="Capture audio from specific applications only (macOS 13+)"
          checked={enabled}
          onChange={onToggle}
        />
      </Section>

      {enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-4"
        >
          <Section title="Select Applications">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableApps.map((app) => (
                <button
                  key={app.bundleId}
                  onClick={() => handleAppToggle(app.bundleId)}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                    ${selectedApps.includes(app.bundleId)
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  {app.icon && (
                    <img src={app.icon} alt={app.name} className="w-8 h-8 rounded-lg" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{app.name}</div>
                    <div className="text-xs text-gray-500">{app.bundleId}</div>
                  </div>
                  {selectedApps.includes(app.bundleId) && (
                    <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </Section>

          {selectedApps.length === 0 && (
            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <p className="text-sm text-yellow-900 font-medium">
                ⚠️ No apps selected. System will capture all audio.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {!enabled && (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-600">
            Enable per-app routing to select specific applications to capture audio from.
            When disabled, all system audio will be captured.
          </p>
        </div>
      )}
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

interface ToggleSwitchProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ label, description, checked, onChange }: ToggleSwitchProps) {
  return (
    <label className="flex items-start gap-4 cursor-pointer group p-4 rounded-xl hover:bg-gray-50 transition-colors">
      <div className="flex-1">
        <div className="font-semibold text-gray-900">{label}</div>
        <div className="text-sm text-gray-500 mt-1">{description}</div>
      </div>
      <div
        className={`
          relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-1
          ${checked ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-300'}
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

interface GainSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}

function GainSlider({ value, onChange, min, max, step }: GainSliderProps) {
  const getGainColor = () => {
    if (value < 80) return 'from-yellow-400 to-orange-400';
    if (value > 120) return 'from-orange-400 to-red-400';
    return 'from-green-400 to-cyan-400';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-600">Gain Level</label>
        <span className={`text-sm font-bold bg-gradient-to-r ${getGainColor()} bg-clip-text text-transparent`}>
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`
          w-full h-2 rounded-full appearance-none cursor-pointer
          bg-gradient-to-r ${getGainColor()} opacity-30
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-gradient-to-r
          [&::-webkit-slider-thumb]:${getGainColor()}
          [&::-webkit-slider-thumb]:shadow-lg
          [&::-webkit-slider-thumb]:cursor-pointer
        `}
      />
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>0%</span>
        <span className="font-semibold text-green-600">100% (Unity)</span>
        <span>200%</span>
      </div>
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
        <span className="text-sm font-bold text-purple-600">
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
          bg-gradient-to-r from-purple-200 to-pink-200
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-gradient-to-r
          [&::-webkit-slider-thumb]:from-purple-500
          [&::-webkit-slider-thumb]:to-pink-500
          [&::-webkit-slider-thumb]:shadow-lg
          [&::-webkit-slider-thumb]:cursor-pointer
        "
      />
    </div>
  );
}

interface RadioGridProps {
  options: Array<{ value: string; label: string; description: string }>;
  value: string;
  onChange: (value: string) => void;
}

function RadioGrid({ options, value, onChange }: RadioGridProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`
            p-4 rounded-xl border-2 transition-all text-left
            ${value === option.value
              ? 'border-purple-400 bg-purple-50'
              : 'border-gray-200 hover:border-gray-300'
            }
          `}
        >
          <div className="font-semibold text-gray-900">{option.label}</div>
          <div className="text-xs text-gray-500 mt-1">{option.description}</div>
        </button>
      ))}
    </div>
  );
}
