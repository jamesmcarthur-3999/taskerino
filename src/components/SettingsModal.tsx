import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useUI } from '../context/UIContext';
import { useSessions } from '../context/SessionsContext';
import { useTheme } from '../context/ThemeContext';
import { X, Save, Key, Camera, Volume2, Palette } from 'lucide-react';
import { audioCompressionService, type AudioQualityPreset } from '../services/audioCompressionService';
import { openAIService } from '../services/openAIService';
import { claudeService } from '../services/claudeService';
import { COLOR_SCHEMES, GLASS_PATTERNS, type ColorScheme, type GlassStrength, getModalClasses, getModalHeaderClasses, getInputContainerClasses, MODAL_SECTIONS, getGlassClasses, getRadiusClass } from '../design-system/theme';
import { Input } from './Input';
import { Button } from './Button';
import { validateOpenAIKey, validateAnthropicKey } from '../utils/validation';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { sessions, activeSessionId, updateSession } = useSessions();
  const { colorScheme, setColorScheme, glassStrength, setGlassStrength } = useTheme();

  // API Keys
  const [openAIKey, setOpenAIKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openAIKeyError, setOpenAIKeyError] = useState('');
  const [anthropicKeyError, setAnthropicKeyError] = useState('');

  // Audio Settings
  const [audioQuality, setAudioQuality] = useState<AudioQualityPreset>('optimized');

  // Screenshot Settings
  const [screenshotInterval, setScreenshotInterval] = useState(2);
  const [useAdaptiveMode, setUseAdaptiveMode] = useState(false);

  // Theme Settings
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [localColorScheme, setLocalColorScheme] = useState<ColorScheme>(colorScheme);
  const [localGlassStrength, setLocalGlassStrength] = useState<GlassStrength>(glassStrength);

  // Save status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load current settings on mount
  useEffect(() => {
    if (isOpen) {
      const loadKeys = async () => {
        // Load API keys from Tauri secure storage
        const savedOpenAIKey = await invoke<string | null>('get_openai_api_key');
        const savedAnthropicKey = await invoke<string | null>('get_claude_api_key');
        setOpenAIKey(savedOpenAIKey || '');
        setAnthropicKey(savedAnthropicKey || '');
      };
      loadKeys();

      // Load audio quality
      const savedAudioQuality = audioCompressionService.getQualityPreset();
      setAudioQuality(savedAudioQuality);

      // Load screenshot settings from active session
      const activeSession = sessions.find(s => s.id === activeSessionId);
      if (activeSession) {
        const interval = activeSession.screenshotInterval || 2;
        setScreenshotInterval(interval === -1 ? 2 : interval);
        setUseAdaptiveMode(interval === -1);
      }

      // Load theme
      setTheme(uiState.preferences.theme);
      setLocalColorScheme(colorScheme);
      setLocalGlassStrength(glassStrength);
    }
  }, [isOpen, activeSessionId, sessions, uiState.preferences.theme, colorScheme, glassStrength]);

  const handleClose = () => {
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  const handleSave = async () => {
    // Validate API keys before saving
    let hasErrors = false;

    if (openAIKey.trim()) {
      const openAIValidation = validateOpenAIKey(openAIKey);
      if (!openAIValidation.isValid) {
        setOpenAIKeyError(openAIValidation.error || 'Invalid OpenAI API key');
        hasErrors = true;
      }
    }

    if (anthropicKey.trim()) {
      const anthropicValidation = validateAnthropicKey(anthropicKey);
      if (!anthropicValidation.isValid) {
        setAnthropicKeyError(anthropicValidation.error || 'Invalid Anthropic API key');
        hasErrors = true;
      }
    }

    if (hasErrors) {
      return;
    }

    setSaveStatus('saving');

    // Save API keys
    if (openAIKey.trim()) {
      await invoke('set_openai_api_key', { apiKey: openAIKey.trim() });
      openAIService.setApiKey(openAIKey.trim());
    }
    if (anthropicKey.trim()) {
      await invoke('set_claude_api_key', { apiKey: anthropicKey.trim() });
      claudeService.setApiKey(anthropicKey.trim());
    }

    // Save audio quality
    audioCompressionService.setQualityPreset(audioQuality);

    // Save screenshot settings (update active session if exists)
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (activeSession) {
      const newInterval = useAdaptiveMode ? -1 : screenshotInterval;
      updateSession({
        ...activeSession,
        screenshotInterval: newInterval,
      });
    }

    // Save theme preference
    uiDispatch({
      type: 'UPDATE_PREFERENCES',
      payload: { theme },
    });

    // Save color scheme and glass strength
    setColorScheme(localColorScheme);
    setGlassStrength(localGlassStrength);

    // Show saved status
    setSaveStatus('saved');
    setTimeout(() => {
      setSaveStatus('idle');
    }, 2000);
  };

  if (!isOpen) return null;

  const modalClasses = getModalClasses(colorScheme, glassStrength);

  return (
    <div
      className={modalClasses.overlay}
      onClick={handleClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`${modalClasses.content} ${modalClasses.container} max-h-[90vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${getModalHeaderClasses(colorScheme)} flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Settings
            </h2>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="sm"
              className={`${getRadiusClass('element')} p-2`}
              aria-label="Close settings"
              title="Close settings (Esc)"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* API Keys Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">API Keys</h3>
            </div>

            {/* OpenAI API Key */}
            <div className={getInputContainerClasses('default')}>
              <Input
                variant="password"
                label="OpenAI API Key"
                value={openAIKey}
                onChange={(e) => {
                  setOpenAIKey(e.target.value);
                  if (openAIKeyError) setOpenAIKeyError('');
                }}
                placeholder="sk-..."
                helperText="Used for Whisper transcription and GPT-4o audio analysis"
                error={openAIKeyError}
              />
            </div>

            {/* Anthropic API Key */}
            <div className={getInputContainerClasses('default')}>
              <Input
                variant="password"
                label="Anthropic API Key"
                value={anthropicKey}
                onChange={(e) => {
                  setAnthropicKey(e.target.value);
                  if (anthropicKeyError) setAnthropicKeyError('');
                }}
                placeholder="sk-ant-..."
                helperText="Used for Claude Sonnet 4.5 processing and analysis"
                error={anthropicKeyError}
              />
            </div>
          </div>

          {/* Audio Settings Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Audio Settings</h3>
            </div>

            <div className={getInputContainerClasses('default')}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Audio Quality Preset
              </label>
              <select
                value={audioQuality}
                onChange={(e) => setAudioQuality(e.target.value as AudioQualityPreset)}
                className={`w-full px-4 py-2 ${getGlassClasses('medium')} border border-white/60 ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all shadow-sm`}
              >
                <option value="optimized">Optimized (16kHz, 64kbps) - Best for speech</option>
                <option value="balanced">Balanced (22kHz, 96kbps) - Good quality</option>
                <option value="high">High (44kHz, 128kbps) - Maximum quality</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Higher quality uses more API credits but provides better transcription accuracy
              </p>
            </div>
          </div>

          {/* Screenshot Settings Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Screenshot Settings</h3>
            </div>

            <div className={`${getInputContainerClasses('default')} space-y-4`}>
              {/* Adaptive Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label htmlFor="adaptive-mode-toggle" className="block text-sm font-medium text-gray-700">
                    Adaptive Mode
                  </label>
                  <p className="text-xs text-gray-500 mt-1" id="adaptive-mode-description">
                    AI-driven screenshot timing based on activity and curiosity
                  </p>
                </div>
                <button
                  id="adaptive-mode-toggle"
                  type="button"
                  role="switch"
                  aria-checked={useAdaptiveMode}
                  aria-describedby="adaptive-mode-description"
                  aria-label="Toggle adaptive screenshot mode"
                  onClick={() => setUseAdaptiveMode(!useAdaptiveMode)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    useAdaptiveMode ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      useAdaptiveMode ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Fixed Interval (only show when adaptive mode is off) */}
              {!useAdaptiveMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Screenshot Interval (minutes)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={screenshotInterval}
                    onChange={(e) => setScreenshotInterval(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-600">1 min</span>
                    <span className="text-sm font-medium text-purple-600">{screenshotInterval} min</span>
                    <span className="text-sm text-gray-600">10 min</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Captures automatically every {screenshotInterval} minute{screenshotInterval !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Theme Settings Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Appearance</h3>
            </div>

            {/* Color Scheme */}
            <div className={getInputContainerClasses('default')}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color Scheme
              </label>
              <select
                value={localColorScheme}
                onChange={(e) => setLocalColorScheme(e.target.value as ColorScheme)}
                className={`w-full px-4 py-2 ${getGlassClasses('medium')} border border-white/60 ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all shadow-sm`}
              >
                <option value="ocean">Ocean (Cyan & Blue)</option>
                <option value="sunset">Sunset (Orange & Pink)</option>
                <option value="forest">Forest (Emerald & Teal)</option>
                <option value="lavender">Lavender (Purple & Pink)</option>
                <option value="monochrome">Monochrome (Gray)</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Choose your preferred color palette for the interface
              </p>
            </div>

            {/* Glass Strength */}
            <div className={getInputContainerClasses('default')}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Glass Strength
              </label>
              <select
                value={localGlassStrength}
                onChange={(e) => setLocalGlassStrength(e.target.value as GlassStrength)}
                className={`w-full px-4 py-2 ${getGlassClasses('medium')} border border-white/60 ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all shadow-sm`}
              >
                <option value="subtle">Subtle (Light blur & transparency)</option>
                <option value="medium">Medium (Balanced appearance)</option>
                <option value="strong">Strong (Rich glass effect)</option>
                <option value="extra-strong">Extra Strong (Maximum depth)</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Adjust the intensity of the glass morphism effect
              </p>
            </div>

            {/* Light/Dark Mode */}
            <div className={getInputContainerClasses('default')}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Theme Mode
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'auto')}
                className={`w-full px-4 py-2 ${getGlassClasses('medium')} border border-white/60 ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all shadow-sm`}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto (System)</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Choose light or dark mode preference
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`${MODAL_SECTIONS.footer} flex items-center justify-between flex-shrink-0`}>
          <p className="text-sm text-gray-600">
            {saveStatus === 'saved' && (
              <span className="text-green-600 font-medium">Settings saved successfully</span>
            )}
            {saveStatus === 'saving' && (
              <span className="text-blue-600">Saving...</span>
            )}
          </p>
          <div className="flex gap-3">
            <Button
              onClick={handleClose}
              variant="secondary"
              size="md"
              className={getRadiusClass('element')}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              variant="primary"
              size="md"
              icon={<Save className="w-4 h-4" />}
              className={getRadiusClass('element')}
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
