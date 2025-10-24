import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Mic2, Volume2, ChevronDown } from 'lucide-react';
import type { AudioDevice } from '../../types';
import { AudioLevelMeter } from './AudioLevelMeter';
import { getRadiusClass, TRANSITIONS, SHADOWS, COLOR_SCHEMES, getGlassmorphism } from '../../design-system/theme';
import { useTheme } from '../../context/ThemeContext';

interface AudioQuickSettingsProps {
  show: boolean;
  onClose: () => void;

  // Microphone settings
  micEnabled: boolean;
  onMicToggle: (enabled: boolean) => void;
  selectedMicDevice?: string;
  onMicDeviceChange: (deviceId: string) => void;
  micDevices: AudioDevice[];

  // System audio settings
  systemAudioEnabled: boolean;
  onSystemAudioToggle: (enabled: boolean) => void;
  selectedSystemAudioDevice?: string;
  onSystemAudioDeviceChange: (deviceId: string) => void;
  systemAudioDevices: AudioDevice[];

  // Balance slider (when both enabled)
  micBalance: number; // 0-100, where 0 = all system audio, 100 = all mic
  onBalanceChange: (balance: number) => void;

  // Advanced modal
  onOpenAdvanced: () => void;
}

/**
 * AudioQuickSettings - Professional audio configuration dropdown
 *
 * Features:
 * - Real-time audio level meters
 * - Device selection with visual feedback
 * - Balance control for mixed audio
 * - Design system integration
 * - Smooth animations
 */
export function AudioQuickSettings({
  show,
  onClose,
  micEnabled,
  onMicToggle,
  selectedMicDevice,
  onMicDeviceChange,
  micDevices,
  systemAudioEnabled,
  onSystemAudioToggle,
  selectedSystemAudioDevice,
  onSystemAudioDeviceChange,
  systemAudioDevices,
  micBalance,
  onBalanceChange,
  onOpenAdvanced,
}: AudioQuickSettingsProps) {
  const { colorScheme } = useTheme();
  const colors = COLOR_SCHEMES[colorScheme];

  if (!show) return null;

  const bothEnabled = micEnabled && systemAudioEnabled;
  const hasDeviceSelection = (micEnabled && micDevices.length > 0) || (systemAudioEnabled && systemAudioDevices.length > 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={onClose}
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
          className={`absolute top-full left-0 mt-2 w-[420px] bg-white/80 backdrop-blur-2xl ${getRadiusClass('modal')} border-2 border-cyan-400/80 ${SHADOWS.modal} z-[9999]`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b-2 border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Volume2 size={20} className={`text-${colors.focus}`} />
              Audio Settings
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
            {/* SECTION: Microphone */}
            <div className="space-y-3">
                {/* Mic Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic2 size={16} className={micEnabled ? `text-${colors.focus}` : 'text-gray-400'} />
                    <span className="text-sm font-semibold text-gray-900">Microphone</span>
                  </div>
                  <Toggle
                    checked={micEnabled}
                    onChange={onMicToggle}
                    colorScheme={colorScheme}
                  />
                </div>

                {/* Mic Device Selector & Level Meter */}
                <AnimatePresence mode="wait">
                  {micEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      {/* Device Selector */}
                      {micDevices.length > 0 ? (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Input Device
                          </label>
                          <DeviceSelect
                            value={selectedMicDevice || micDevices[0]?.id || ''}
                            onChange={onMicDeviceChange}
                            options={micDevices.map(d => ({
                              value: d.id,
                              label: d.name,
                              isDefault: d.isDefault
                            }))}
                            icon={<Mic2 size={14} />}
                            colorScheme={colorScheme}
                          />
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 italic py-2">
                          No microphone devices found
                        </div>
                      )}

                      {/* Level Meter */}
                      <AudioLevelMeter
                        label="Microphone"
                        deviceId={selectedMicDevice}
                        muted={!micEnabled}
                        compact={true}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>

            {/* SECTION: System Audio */}
            <div className="space-y-3">
                {/* System Audio Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 size={16} className={systemAudioEnabled ? `text-${colors.focus}` : 'text-gray-400'} />
                    <span className="text-sm font-semibold text-gray-900">System Audio</span>
                  </div>
                  <Toggle
                    checked={systemAudioEnabled}
                    onChange={onSystemAudioToggle}
                    colorScheme={colorScheme}
                  />
                </div>

                {/* System Audio Device Selector & Level Meter */}
                <AnimatePresence mode="wait">
                  {systemAudioEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      {/* Device Selector */}
                      {systemAudioDevices.length > 0 ? (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Output Device
                          </label>
                          <DeviceSelect
                            value={selectedSystemAudioDevice || systemAudioDevices[0]?.id || ''}
                            onChange={onSystemAudioDeviceChange}
                            options={systemAudioDevices.map(d => ({
                              value: d.id,
                              label: d.name,
                              isDefault: d.isDefault
                            }))}
                            icon={<Volume2 size={14} />}
                            colorScheme={colorScheme}
                          />
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 italic py-2">
                          No system audio devices found
                        </div>
                      )}

                      {/* Level Meter */}
                      <AudioLevelMeter
                        label="System Audio"
                        deviceId={selectedSystemAudioDevice}
                        muted={!systemAudioEnabled}
                        compact={true}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>

            {/* SECTION: Balance (only when both enabled) */}
            <AnimatePresence>
              {bothEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  <BalanceSlider
                    value={micBalance}
                    onChange={onBalanceChange}
                    colorScheme={colorScheme}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer: Advanced Settings */}
          <div className="px-5 pb-5 pt-4 border-t-2 border-white/30">
            <button
              onClick={() => {
                onClose();
                onOpenAdvanced();
              }}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 ${getRadiusClass('field')} bg-white/60 backdrop-blur-lg hover:bg-white/70 border-2 border-white/50 hover:border-cyan-400/60 text-cyan-700 font-semibold text-sm transition-all`}
            >
              <Settings size={16} />
              Advanced Audio Settings...
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// ============================================================================
// REUSABLE UI PRIMITIVES - Using Design System
// ============================================================================

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  colorScheme: string;
}

function Toggle({ checked, onChange, colorScheme }: ToggleProps) {
  const colors = COLOR_SCHEMES[colorScheme as keyof typeof COLOR_SCHEMES];

  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full ${TRANSITIONS.fast} ${
        checked
          ? `bg-gradient-to-r from-${colors.primary.from} to-${colors.primary.to}`
          : 'bg-gray-300'
      }`}
      aria-label={checked ? 'Enabled' : 'Disabled'}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

interface DeviceSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; isDefault?: boolean }>;
  icon: React.ReactNode;
  colorScheme: string;
}

function DeviceSelect({ value, onChange, options, icon, colorScheme }: DeviceSelectProps) {
  const colors = COLOR_SCHEMES[colorScheme as keyof typeof COLOR_SCHEMES];
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2.5 ${getRadiusClass('field')} bg-white/50 backdrop-blur-md border border-white/50 hover:border-${colors.focus}/50 focus:border-${colors.focus} focus:outline-none ${TRANSITIONS.fast}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`text-${colors.focus}`}>
            {icon}
          </div>
          <span className="text-sm font-medium text-gray-900 truncate">
            {selectedOption?.label}
            {selectedOption?.isDefault && (
              <span className="ml-2 text-xs text-gray-500">(Default)</span>
            )}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop to close dropdown */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Menu */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className={`absolute top-full left-0 right-0 mt-1 bg-white/80 backdrop-blur-2xl ${getRadiusClass('element')} border-2 border-white/50 ${SHADOWS.elevated} z-20 overflow-hidden`}
            >
              <div className="max-h-48 overflow-y-auto">
                {options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all ${
                      option.value === value
                        ? 'bg-cyan-100 text-cyan-900 font-semibold'
                        : 'text-gray-800 hover:bg-cyan-50'
                    }`}
                  >
                    <div className={option.value === value ? `text-${colors.focus}` : 'text-gray-400'}>
                      {icon}
                    </div>
                    <span className="text-sm flex-1 truncate">{option.label}</span>
                    {option.isDefault && (
                      <span className="text-xs text-gray-500">Default</span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

interface BalanceSliderProps {
  value: number; // 0-100
  onChange: (value: number) => void;
  colorScheme: string;
}

function BalanceSlider({ value, onChange, colorScheme }: BalanceSliderProps) {
  const colors = COLOR_SCHEMES[colorScheme as keyof typeof COLOR_SCHEMES];

  const getBalanceLabel = () => {
    if (value < 40) return 'Mostly System';
    if (value > 60) return 'Mostly Mic';
    return 'Balanced';
  };

  const getBalanceIcon = () => {
    if (value < 40) return <Volume2 size={14} />;
    if (value > 60) return <Mic2 size={14} />;
    return <div className="w-3.5 h-3.5 rounded-full bg-current" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`text-${colors.focus}`}>
            {getBalanceIcon()}
          </div>
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Audio Balance
          </span>
        </div>
        <span className={`text-xs font-bold text-${colors.focus} px-2 py-1 ${getRadiusClass('element')} bg-${colors.focus}/10`}>
          {getBalanceLabel()}
        </span>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-cyan-200 via-gray-200 to-${colors.accent.from}/30
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-gradient-to-r
          [&::-webkit-slider-thumb]:from-${colors.primary.from}
          [&::-webkit-slider-thumb]:to-${colors.primary.to}
          [&::-webkit-slider-thumb]:shadow-lg
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:transition-transform
          [&::-webkit-slider-thumb]:hover:scale-110
          [&::-moz-range-thumb]:w-5
          [&::-moz-range-thumb]:h-5
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-gradient-to-r
          [&::-moz-range-thumb]:from-${colors.primary.from}
          [&::-moz-range-thumb]:to-${colors.primary.to}
          [&::-moz-range-thumb]:shadow-lg
          [&::-moz-range-thumb]:cursor-pointer
          [&::-moz-range-thumb]:border-0
        `}
      />

      <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium">
        <div className="flex items-center gap-1">
          <Volume2 size={12} />
          <span>System</span>
        </div>
        <span className="text-gray-400">50/50</span>
        <div className="flex items-center gap-1">
          <span>Mic</span>
          <Mic2 size={12} />
        </div>
      </div>
    </div>
  );
}
