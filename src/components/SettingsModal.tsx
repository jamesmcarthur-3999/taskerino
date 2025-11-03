import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../context/UIContext';
import { useSessionList } from '../context/SessionListContext';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useTheme } from '../context/ThemeContext';
import { X, Save, Key, Camera, Volume2, Palette, Database, Trash2, Archive, Play, Pause, Settings } from 'lucide-react';
import { audioCompressionService, type AudioQualityPreset } from '../services/audioCompressionService';
import { openAIService } from '../services/openAIService';
import { claudeService } from '../services/claudeService';
import { getChunkedStorage, type CacheStats } from '../services/storage/ChunkedSessionStorage';
import { getCompressionQueue, type CompressionSettings, type CompressionStats } from '../services/compression/CompressionQueue';
import { COLOR_SCHEMES, GLASS_PATTERNS, type ColorScheme, type GlassStrength, getModalClasses, getModalHeaderClasses, getInputContainerClasses, MODAL_SECTIONS, getGlassClasses, getRadiusClass } from '../design-system/theme';
import { Input } from './Input';
import { Button } from './Button';
import { validateOpenAIKey, validateAnthropicKey } from '../utils/validation';
import { modalBackdropVariants, modalSettingsVariants } from '../animations/variants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { sessions, updateSession } = useSessionList();
  const { activeSessionId } = useActiveSession();
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

  // Cache Statistics
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheSize, setCacheSize] = useState(100); // MB

  // Compression Settings
  const [compressionEnabled, setCompressionEnabled] = useState(false);
  const [compressionMode, setCompressionMode] = useState<'auto' | 'manual'>('auto');
  const [maxCPU, setMaxCPU] = useState(20);
  const [ageThresholdDays, setAgeThresholdDays] = useState(7);
  const [compressScreenshots, setCompressScreenshots] = useState(true);
  const [compressionStats, setCompressionStats] = useState<CompressionStats | null>(null);
  const [compressionActive, setCompressionActive] = useState(false);

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

      // Load cache statistics
      const loadCacheStats = async () => {
        try {
          const storage = await getChunkedStorage();
          const stats = storage.getCacheStats();
          setCacheStats(stats);
          setCacheSize(Math.round(stats.maxSize / (1024 * 1024))); // Convert bytes to MB
        } catch (error) {
          console.error('[SettingsModal] Failed to load cache stats:', error);
        }
      };
      loadCacheStats();

      // Load compression settings
      const loadCompressionSettings = async () => {
        try {
          const queue = getCompressionQueue();
          const settings = queue.getSettings();
          const stats = queue.getStats();

          setCompressionEnabled(settings.enabled);
          setCompressionMode(settings.mode);
          setMaxCPU(settings.maxCPU);
          setAgeThresholdDays(settings.ageThresholdDays);
          setCompressScreenshots(settings.compressScreenshots);
          setCompressionStats(stats);
          setCompressionActive(stats.inProgress.length > 0);
        } catch (error) {
          console.error('[SettingsModal] Failed to load compression settings:', error);
        }
      };
      loadCompressionSettings();

      // Auto-refresh cache and compression stats every 2 seconds while modal is open
      const interval = setInterval(() => {
        loadCacheStats();
        loadCompressionSettings();
      }, 2000);
      return () => clearInterval(interval);
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
      updateSession(activeSession.id, {
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

    // Save cache size
    const storage = await getChunkedStorage();
    storage.setCacheSize(cacheSize * 1024 * 1024); // Convert MB to bytes

    // Save compression settings
    const queue = getCompressionQueue();
    queue.updateSettings({
      enabled: compressionEnabled,
      mode: compressionMode,
      maxCPU,
      ageThresholdDays,
      compressScreenshots,
      processOldestFirst: true, // Always process oldest first
    });

    // Show saved status
    setSaveStatus('saved');
    setTimeout(() => {
      setSaveStatus('idle');
    }, 2000);
  };

  const handleClearCache = async () => {
    try {
      const storage = await getChunkedStorage();
      storage.clearCache();

      // Refresh stats
      const stats = storage.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('[SettingsModal] Failed to clear cache:', error);
    }
  };

  const handleResetCacheStats = async () => {
    try {
      const storage = await getChunkedStorage();
      storage.resetCacheStats();

      // Refresh stats
      const stats = storage.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('[SettingsModal] Failed to reset cache stats:', error);
    }
  };

  const handleStartCompression = async () => {
    try {
      const queue = getCompressionQueue();
      queue.resume();
      setCompressionActive(true);
    } catch (error) {
      console.error('[SettingsModal] Failed to start compression:', error);
    }
  };

  const handlePauseCompression = async () => {
    try {
      const queue = getCompressionQueue();
      queue.pause();
      setCompressionActive(false);
    } catch (error) {
      console.error('[SettingsModal] Failed to pause compression:', error);
    }
  };

  const handleCancelCompression = async () => {
    try {
      const queue = getCompressionQueue();
      await queue.cancelAll();
      setCompressionActive(false);

      // Refresh stats
      const stats = queue.getStats();
      setCompressionStats(stats);
    } catch (error) {
      console.error('[SettingsModal] Failed to cancel compression:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const modalClasses = getModalClasses(colorScheme, glassStrength);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={modalBackdropVariants.standard}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={modalClasses.overlay}
            onClick={handleClose}
            onKeyDown={handleKeyDown}
          />

          {/* Content */}
          <motion.div
            variants={modalSettingsVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div
              className={`${modalClasses.content} ${modalClasses.container} max-h-[90vh] overflow-hidden pointer-events-auto`}
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

          {/* Cache Statistics Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Cache Statistics</h3>
            </div>

            {cacheStats && (
              <div className={`${getInputContainerClasses('default')} space-y-4`}>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Hit Rate</p>
                    <p className="text-lg font-semibold text-purple-600">
                      {(cacheStats.hitRate * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-400">
                      {cacheStats.hits} hits / {cacheStats.misses} misses
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Memory Usage</p>
                    <p className="text-lg font-semibold text-blue-600">
                      {formatBytes(cacheStats.size)}
                    </p>
                    <p className="text-xs text-gray-400">
                      of {formatBytes(cacheStats.maxSize)} max
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Cached Items</p>
                    <p className="text-lg font-semibold text-green-600">
                      {cacheStats.items}
                    </p>
                    <p className="text-xs text-gray-400">
                      {cacheStats.items === 0 ? 'empty' : `${((cacheStats.size / cacheStats.maxSize) * 100).toFixed(1)}% full`}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Evictions</p>
                    <p className="text-lg font-semibold text-orange-600">
                      {cacheStats.evictions}
                    </p>
                    <p className="text-xs text-gray-400">
                      LRU evictions
                    </p>
                  </div>
                </div>

                {/* Cache Age */}
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Cache Entry Age</p>
                  <div className="space-y-1 text-xs">
                    <p className="text-gray-600">
                      <span className="font-medium">Oldest:</span> {formatTimestamp(cacheStats.oldestEntry)}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Newest:</span> {formatTimestamp(cacheStats.newestEntry)}
                    </p>
                  </div>
                </div>

                {/* Cache Size Slider */}
                <div className="pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Cache Size
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={cacheSize}
                    onChange={(e) => setCacheSize(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-600">10 MB</span>
                    <span className="text-sm font-medium text-purple-600">{cacheSize} MB</span>
                    <span className="text-sm text-gray-600">500 MB</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Maximum memory for caching session data (higher = faster loads, more memory)
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <Button
                    onClick={handleClearCache}
                    variant="secondary"
                    size="sm"
                    icon={<Trash2 className="w-4 h-4" />}
                    className={getRadiusClass('element')}
                  >
                    Clear Cache
                  </Button>
                  <Button
                    onClick={handleResetCacheStats}
                    variant="ghost"
                    size="sm"
                    className={getRadiusClass('element')}
                  >
                    Reset Stats
                  </Button>
                </div>
              </div>
            )}

            {!cacheStats && (
              <div className={getInputContainerClasses('default')}>
                <p className="text-sm text-gray-500">Loading cache statistics...</p>
              </div>
            )}
          </div>

          {/* Background Compression Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Archive className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Background Compression</h3>
            </div>

            <div className={`${getInputContainerClasses('default')} space-y-4`}>
              {/* Enable Compression Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label htmlFor="compression-enabled-toggle" className="block text-sm font-medium text-gray-700">
                    Enable Automatic Compression
                  </label>
                  <p className="text-xs text-gray-500 mt-1" id="compression-enabled-description">
                    Compress old sessions in background to save storage (60-80% reduction)
                  </p>
                </div>
                <button
                  id="compression-enabled-toggle"
                  type="button"
                  role="switch"
                  aria-checked={compressionEnabled}
                  aria-describedby="compression-enabled-description"
                  aria-label="Toggle background compression"
                  onClick={() => setCompressionEnabled(!compressionEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    compressionEnabled ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      compressionEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {compressionEnabled && (
                <>
                  {/* Compression Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Compression Mode
                    </label>
                    <select
                      value={compressionMode}
                      onChange={(e) => setCompressionMode(e.target.value as 'auto' | 'manual')}
                      className={`w-full px-4 py-2 ${getGlassClasses('medium')} border border-white/60 ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all shadow-sm`}
                    >
                      <option value="auto">Automatic (during idle time)</option>
                      <option value="manual">Manual (user triggered)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                      {compressionMode === 'auto'
                        ? 'Compresses sessions automatically when your computer is idle'
                        : 'Compression only runs when you manually start it'}
                    </p>
                  </div>

                  {/* Max CPU Usage */}
                  {compressionMode === 'auto' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max CPU Usage
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="10"
                        value={maxCPU}
                        onChange={(e) => setMaxCPU(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-gray-600">10%</span>
                        <span className="text-sm font-medium text-purple-600">{maxCPU}%</span>
                        <span className="text-sm text-gray-600">100%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Compression pauses if CPU usage exceeds this threshold
                      </p>
                    </div>
                  )}

                  {/* Age Threshold */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Compress sessions older than (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={ageThresholdDays}
                      onChange={(e) => setAgeThresholdDays(parseInt(e.target.value))}
                      className={`w-full px-4 py-2 ${getGlassClasses('medium')} border border-white/60 ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all shadow-sm`}
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Only compress sessions older than {ageThresholdDays} day{ageThresholdDays !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Compress Screenshots */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label htmlFor="compress-screenshots-toggle" className="block text-sm font-medium text-gray-700">
                        Compress Screenshots
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Convert screenshots to WebP format (20-40% reduction)
                      </p>
                    </div>
                    <button
                      id="compress-screenshots-toggle"
                      type="button"
                      role="switch"
                      aria-checked={compressScreenshots}
                      aria-label="Toggle screenshot compression"
                      onClick={() => setCompressScreenshots(!compressScreenshots)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        compressScreenshots ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          compressScreenshots ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Compression Statistics */}
                  {compressionStats && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-3">Compression Statistics</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Sessions Processed</p>
                          <p className="text-lg font-semibold text-purple-600">
                            {compressionStats.sessionsProcessed}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Storage Saved</p>
                          <p className="text-lg font-semibold text-green-600">
                            {formatBytes(compressionStats.bytesSaved)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Avg Compression</p>
                          <p className="text-lg font-semibold text-blue-600">
                            {((1 - compressionStats.compressionRatio) * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">In Progress</p>
                          <p className="text-lg font-semibold text-orange-600">
                            {compressionStats.inProgress.length}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {compressionMode === 'manual' && (
                        <div className="flex gap-3 pt-4">
                          {!compressionActive ? (
                            <Button
                              onClick={handleStartCompression}
                              variant="primary"
                              size="sm"
                              icon={<Play className="w-4 h-4" />}
                              className={getRadiusClass('element')}
                            >
                              Start Compression
                            </Button>
                          ) : (
                            <>
                              <Button
                                onClick={handlePauseCompression}
                                variant="secondary"
                                size="sm"
                                icon={<Pause className="w-4 h-4" />}
                                className={getRadiusClass('element')}
                              >
                                Pause
                              </Button>
                              <Button
                                onClick={handleCancelCompression}
                                variant="ghost"
                                size="sm"
                                className={getRadiusClass('element')}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
