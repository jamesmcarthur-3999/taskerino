import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, ChevronDown, Mic, Camera, Clock, Monitor, Video, Settings as SettingsIcon } from 'lucide-react';
import { DeviceSelector } from './DeviceSelector';
import { AudioBalanceSlider } from './AudioBalanceSlider';
import { DisplayMultiSelect } from './DisplayMultiSelect';
import { WebcamModeSelector } from './WebcamModeSelector';
import type { WebcamMode } from './WebcamModeSelector';
import { audioRecordingService } from '../../services/audioRecordingService';
import { videoRecordingService } from '../../services/videoRecordingService';
import type { AudioDevice, DisplayInfo, WindowInfo, WebcamInfo, AudioDeviceConfig, VideoRecordingConfig } from '../../types';
import { GlassSelect } from '../GlassSelect';

interface StartSessionModalProps {
  show: boolean;
  onClose: () => void;
  onStartSession: (config: SessionStartConfig) => void;
  lastSettings?: {
    enableScreenshots?: boolean;
    audioRecording?: boolean;
    videoRecording?: boolean;
    screenshotInterval?: number;
  };
  initialAudioDevice?: string;
  initialVideoDevice?: string;
}

export interface SessionStartConfig {
  name: string;
  description: string;
  enableScreenshots: boolean;
  audioRecording: boolean;
  videoRecording: boolean;
  screenshotInterval: number;
  audioConfig?: AudioDeviceConfig;
  videoConfig?: VideoRecordingConfig;
}

export function StartSessionModal({
  show,
  onClose,
  onStartSession,
  lastSettings,
  initialAudioDevice,
  initialVideoDevice,
}: StartSessionModalProps) {
  const [sessionName, setSessionName] = useState('');
  const [description, setDescription] = useState('');
  const [enableScreenshots, setEnableScreenshots] = useState(lastSettings?.enableScreenshots ?? true);
  const [audioRecording, setAudioRecording] = useState(lastSettings?.audioRecording ?? false);
  const [videoRecording, setVideoRecording] = useState(lastSettings?.videoRecording ?? false);
  const [screenshotInterval, setScreenshotInterval] = useState(lastSettings?.screenshotInterval ?? 30);

  // Device enumeration states
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [webcams, setWebcams] = useState<WebcamInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // Device selection states - initialize from TopBar if provided
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string | undefined>(initialAudioDevice);
  const [selectedDisplayIds, setSelectedDisplayIds] = useState<string[]>(
    initialVideoDevice ? [initialVideoDevice] : []
  );

  // System audio states
  const [enableSystemAudio, setEnableSystemAudio] = useState(false);
  const [selectedSystemAudioDevice, setSelectedSystemAudioDevice] = useState<string | undefined>();
  const [audioBalance, setAudioBalance] = useState(50); // 0 = mic only, 100 = system only

  // Video configuration states
  const [recordWindow, setRecordWindow] = useState(false);
  const [selectedWindowId, setSelectedWindowId] = useState<string | undefined>();
  const [selectedWebcamId, setSelectedWebcamId] = useState<string | undefined>();
  const [webcamMode, setWebcamMode] = useState<WebcamMode>({ mode: 'off' });
  const [qualityPreset, setQualityPreset] = useState<'low' | 'medium' | 'high' | 'ultra'>('medium');

  // Advanced settings states
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [customResolution, setCustomResolution] = useState({ width: '', height: '' });
  const [customFps, setCustomFps] = useState(30);
  const [codec, setCodec] = useState<'h264' | 'h265'>('h264');

  // Test audio states
  const [isTestingAudio, setIsTestingAudio] = useState(false);

  // Validation states
  const [validationErrors, setValidationErrors] = useState<{
    sessionName?: string;
    recordingMethod?: string;
    audioDevice?: string;
    systemAudioDevice?: string;
    videoSource?: string;
    webcam?: string;
  }>({});
  const [showValidation, setShowValidation] = useState(false);

  // Update device selections when props change
  useEffect(() => {
    if (initialAudioDevice !== undefined) {
      setSelectedAudioDevice(initialAudioDevice);
    }
  }, [initialAudioDevice]);

  useEffect(() => {
    if (initialVideoDevice !== undefined) {
      setSelectedDisplayIds([initialVideoDevice]);
    }
  }, [initialVideoDevice]);

  // Load devices when modal opens
  useEffect(() => {
    if (show) {
      loadDevices();
    }
  }, [show]);

  const loadDevices = async () => {
    setLoading(true);
    setDeviceError(null); // Clear previous errors
    try {
      const [audio, disp, wins, cams] = await Promise.all([
        audioRecordingService.getAudioDevices(),
        videoRecordingService.enumerateDisplays(),
        videoRecordingService.enumerateWindows(),
        videoRecordingService.enumerateWebcams(),
      ]);
      setAudioDevices(audio);
      setDisplays(disp);
      setWindows(wins);
      setWebcams(cams);

      // Auto-select default devices if not already set
      if (!selectedAudioDevice && audio.length > 0) {
        const defaultInput = audio.find(d => d.deviceType === 'Input' && d.isDefault);
        const firstInput = audio.find(d => d.deviceType === 'Input');
        setSelectedAudioDevice((defaultInput || firstInput)?.id);
      }

      if (selectedDisplayIds.length === 0 && disp.length > 0) {
        const primary = disp.find(d => d.isPrimary);
        setSelectedDisplayIds(primary ? [primary.displayId] : [disp[0].displayId]);
      }

      if (!selectedWebcamId && cams.length > 0) {
        setSelectedWebcamId(cams[0].deviceId);
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if it's a permission error
      if (errorMessage.toLowerCase().includes('permission')) {
        setDeviceError('Permission denied. Please grant Screen Recording and Microphone access in System Settings > Privacy & Security.');
      } else {
        setDeviceError(`Failed to load devices: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestAudio = async () => {
    if (!selectedAudioDevice || isTestingAudio) return;

    setIsTestingAudio(true);
    try {
      // Simple audio test: record for 3 seconds then play back
      // This is a basic implementation - in production you'd use proper audio APIs
      console.log('Testing audio from device:', selectedAudioDevice);

      // Simulate 3-second test
      await new Promise(resolve => setTimeout(resolve, 3000));

      // TODO: Implement actual audio recording and playback
      // This would involve using the audioRecordingService to capture a short sample
      // and then playing it back through the system audio
    } catch (error) {
      console.error('Audio test failed:', error);
    } finally {
      setIsTestingAudio(false);
    }
  };

  const getFpsForQuality = (quality: 'low' | 'medium' | 'high' | 'ultra'): number => {
    const fpsMap = {
      low: 15,
      medium: 15,
      high: 30,
      ultra: 30,
    };
    return fpsMap[quality];
  };

  const getEstimatedFileSizePerHour = (quality: 'low' | 'medium' | 'high' | 'ultra'): string => {
    const sizeMap = {
      low: '0.5-1 GB',
      medium: '1-2 GB',
      high: '2-4 GB',
      ultra: '4-8 GB',
    };
    return sizeMap[quality];
  };

  const validateForm = (): boolean => {
    const errors: typeof validationErrors = {};

    // Validate session name (optional, but if provided should be reasonable)
    if (sessionName && sessionName.length > 100) {
      errors.sessionName = 'Session name is too long (max 100 characters)';
    }

    // At least one recording method must be enabled
    if (!enableScreenshots && !audioRecording && !videoRecording) {
      errors.recordingMethod = 'At least one recording method must be enabled';
    }

    // Audio recording validation
    if (audioRecording) {
      if (!selectedAudioDevice && !enableSystemAudio) {
        errors.audioDevice = 'Please select a microphone or enable system audio';
      }
      if (enableSystemAudio && !selectedSystemAudioDevice) {
        errors.systemAudioDevice = 'Please select a system audio device';
      }
    }

    // Video recording validation
    if (videoRecording) {
      if (recordWindow) {
        if (!selectedWindowId) {
          errors.videoSource = 'Please select a window to record';
        }
      } else {
        if (selectedDisplayIds.length === 0) {
          errors.videoSource = 'Please select at least one display to record';
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStart = () => {
    // Validate form
    setShowValidation(true);
    if (!validateForm()) {
      return;
    }

    const config: SessionStartConfig = {
      name: sessionName || `Session ${new Date().toLocaleString()}`,
      description,
      enableScreenshots,
      audioRecording,
      videoRecording,
      screenshotInterval,
    };

    // Add audio config if audio recording is enabled
    if (audioRecording) {
      // Determine source type based on what's enabled
      let sourceType: 'microphone' | 'system-audio' | 'both' = 'microphone';
      if (selectedAudioDevice && enableSystemAudio && selectedSystemAudioDevice) {
        sourceType = 'both';
      } else if (enableSystemAudio && selectedSystemAudioDevice) {
        sourceType = 'system-audio';
      }

      config.audioConfig = {
        micDeviceId: selectedAudioDevice,
        systemAudioDeviceId: selectedSystemAudioDevice,
        sourceType,
        balance: audioBalance,
        micVolume: 1.0,
        systemVolume: 1.0,
      };
    }

    // Add video config if video recording is enabled
    if (videoRecording) {
      const fps = customResolution.width && customResolution.height ? customFps : getFpsForQuality(qualityPreset);

      config.videoConfig = {
        sourceType: recordWindow ? 'window' : 'display',
        displayIds: recordWindow ? undefined : selectedDisplayIds,
        windowIds: recordWindow ? [selectedWindowId] : undefined,
        webcamDeviceId: webcamMode.mode !== 'off' ? selectedWebcamId : undefined,
        pipConfig: webcamMode.mode === 'pip' && webcamMode.pipConfig ? {
          enabled: true,
          position: webcamMode.pipConfig.position,
          size: webcamMode.pipConfig.size,
          borderRadius: 8,
        } : undefined,
        quality: qualityPreset,
        fps,
      };
    }

    onStartSession(config);
    onClose();
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200/50">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Start New Session</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Basic Info */}
            <div className="space-y-4 pb-6 border-b-2 border-gray-200/70">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-cyan-500 rounded-full"></div>
                <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">Basic Info</h3>
              </div>

              <div className="space-y-2">
                <label htmlFor="session-name-input" className="text-sm font-semibold text-gray-900">Session Name (Optional)</label>
                <input
                  id="session-name-input"
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g., Sprint Planning"
                  className={`w-full px-4 py-3 rounded-xl bg-white/50 backdrop-blur-sm border transition-all ${
                    showValidation && validationErrors.sessionName
                      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-400/20'
                      : 'border-white/40 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20'
                  }`}
                  aria-label="Session name"
                  aria-invalid={showValidation && !!validationErrors.sessionName}
                  aria-describedby={showValidation && validationErrors.sessionName ? 'session-name-error' : undefined}
                />
                {showValidation && validationErrors.sessionName && (
                  <p id="session-name-error" className="text-xs text-red-600 flex items-center gap-1 animate-in slide-in-from-top-1 duration-200">
                    <span className="font-bold">!</span> {validationErrors.sessionName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="session-description-input" className="text-sm font-semibold text-gray-900">Description (Optional)</label>
                <textarea
                  id="session-description-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are you working on?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 backdrop-blur-sm border border-white/40 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all resize-none"
                  aria-label="Session description"
                />
              </div>
            </div>

            {/* Recording Settings */}
            <div className="space-y-4 pb-6 border-b-2 border-gray-200/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-red-500 to-cyan-500 rounded-full"></div>
                  <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">Recording Settings</h3>
                </div>
                {showValidation && validationErrors.recordingMethod && (
                  <p className="text-xs text-red-600 flex items-center gap-1 animate-in slide-in-from-top-1 duration-200">
                    <span className="font-bold">!</span> {validationErrors.recordingMethod}
                  </p>
                )}
              </div>

              {/* Device Enumeration Error */}
              {deviceError && (
                <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start gap-3">
                    <div className="text-red-600 font-bold text-lg">⚠️</div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-semibold text-red-900">Device Loading Failed</p>
                      <p className="text-xs text-red-800">{deviceError}</p>
                      <button
                        type="button"
                        onClick={loadDevices}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {/* Screenshots Toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableScreenshots}
                    onChange={(e) => setEnableScreenshots(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                    aria-label="Enable screenshots during session"
                  />
                  <span className="text-sm font-medium text-gray-900">Enable Screenshots</span>
                </label>

                {/* Screenshot Interval */}
                {enableScreenshots && (
                  <div className="space-y-2 ml-8">
                    <label className="text-sm font-semibold text-gray-900 block mb-2">Screenshot Interval</label>
                    <GlassSelect
                      value={String(screenshotInterval)}
                      onChange={(val) => setScreenshotInterval(Number(val))}
                      options={[
                        { value: '30', label: '30 seconds', icon: Clock },
                        { value: '60', label: '1 minute', icon: Clock },
                        { value: '120', label: '2 minutes', icon: Clock },
                        { value: '300', label: '5 minutes', icon: Clock },
                      ]}
                      variant="secondary"
                      showLabel={false}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Audio Recording Toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={audioRecording}
                    onChange={(e) => setAudioRecording(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                    aria-label="Enable audio recording during session"
                    aria-controls="audio-recording-settings"
                  />
                  <span className="text-sm font-medium text-gray-900">Enable Audio Recording</span>
                </label>

                {/* Audio Recording Settings */}
                {audioRecording && (
                  <div id="audio-recording-settings" className="ml-8 space-y-4 p-5 bg-white/40 rounded-xl border-2 border-white/60 shadow-sm" role="region" aria-label="Audio recording configuration">
                    <div className="flex items-center gap-2 pb-3 border-b border-gray-300/50">
                      <Mic size={14} className="text-cyan-600" />
                      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Audio Sources</h4>
                    </div>

                    {/* Microphone Section */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-900">Microphone</label>
                      {loading ? (
                        <div className="text-xs text-gray-500 text-center py-2">Loading devices...</div>
                      ) : audioDevices.filter(d => d.deviceType === 'Input').length === 0 ? (
                        <div className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
                          No microphone found. Check system permissions.
                        </div>
                      ) : (
                        <DeviceSelector
                          type="audio-input"
                          label=""
                          value={selectedAudioDevice}
                          onChange={setSelectedAudioDevice}
                          devices={audioDevices.filter(d => d.deviceType === 'Input')}
                          loading={loading}
                        />
                      )}
                      {showValidation && validationErrors.audioDevice && (
                        <p className="text-xs text-red-600 flex items-center gap-1 animate-in slide-in-from-top-1 duration-200">
                          <span className="font-bold">!</span> {validationErrors.audioDevice}
                        </p>
                      )}
                    </div>

                    {/* System Audio Section */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableSystemAudio}
                          onChange={(e) => setEnableSystemAudio(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                          aria-label="Enable system audio recording"
                          aria-controls="system-audio-device-selector"
                        />
                        <span className="text-sm font-semibold text-gray-900">System Audio</span>
                      </label>
                      {enableSystemAudio && (
                        <div id="system-audio-device-selector" className="ml-7 space-y-2">
                          {loading ? (
                            <div className="text-xs text-gray-500 text-center py-2">Loading...</div>
                          ) : (
                            <DeviceSelector
                              type="audio-output"
                              label=""
                              value={selectedSystemAudioDevice}
                              onChange={setSelectedSystemAudioDevice}
                              devices={audioDevices.filter(d => d.deviceType === 'Output')}
                              loading={loading}
                              compact
                            />
                          )}
                          {showValidation && validationErrors.systemAudioDevice && (
                            <p className="text-xs text-red-600 flex items-center gap-1 animate-in slide-in-from-top-1 duration-200">
                              <span className="font-bold">!</span> {validationErrors.systemAudioDevice}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Balance Slider - Only show when both mic and system audio are enabled */}
                    {selectedAudioDevice && enableSystemAudio && selectedSystemAudioDevice && (
                      <div className="pt-2">
                        <AudioBalanceSlider
                          balance={audioBalance}
                          onChange={setAudioBalance}
                          showLabels={true}
                        />
                      </div>
                    )}

                    {/* Test Audio Button */}
                    {selectedAudioDevice && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleTestAudio}
                          disabled={isTestingAudio}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 transition-colors flex items-center gap-2"
                        >
                          <Mic size={16} />
                          {isTestingAudio ? 'Testing...' : 'Test Audio'}
                        </button>
                        {isTestingAudio && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex gap-1">
                              {[...Array(8)].map((_, i) => (
                                <motion.div
                                  key={i}
                                  className="w-1 bg-green-500 rounded-full"
                                  animate={{
                                    height: [4, 16, 4],
                                  }}
                                  transition={{
                                    duration: 0.6,
                                    repeat: Infinity,
                                    delay: i * 0.1,
                                  }}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-gray-600">Recording...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Video Recording Toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={videoRecording}
                    onChange={(e) => setVideoRecording(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                    aria-label="Enable video recording during session"
                    aria-controls="video-recording-settings"
                  />
                  <span className="text-sm font-medium text-gray-900">Enable Video Recording</span>
                </label>

                {/* Video Recording Settings */}
                {videoRecording && (
                  <div id="video-recording-settings" className="ml-8 space-y-4 p-5 bg-white/40 rounded-xl border-2 border-white/60 shadow-sm" role="region" aria-label="Video recording configuration">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-300/50">
                      <div className="flex items-center gap-2">
                        <Camera size={14} className="text-cyan-600" />
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Video Configuration</h4>
                      </div>
                      {showValidation && validationErrors.videoSource && (
                        <p className="text-xs text-red-600 flex items-center gap-1 animate-in slide-in-from-top-1 duration-200">
                          <span className="font-bold">!</span> {validationErrors.videoSource}
                        </p>
                      )}
                    </div>

                    {/* Window-Specific Recording Toggle */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={recordWindow}
                          onChange={(e) => setRecordWindow(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                          aria-label="Record specific window instead of full display"
                        />
                        <span className="text-sm font-semibold text-gray-900">Record specific window instead</span>
                      </label>

                      {loading ? (
                        <div className="text-xs text-gray-500 text-center py-2">Loading...</div>
                      ) : recordWindow ? (
                        /* Window Selector */
                        <div className="ml-7">
                          {windows.length > 0 ? (
                            <GlassSelect
                              value={selectedWindowId || ''}
                              onChange={setSelectedWindowId}
                              options={[
                                { value: '', label: 'Select a window', disabled: true },
                                ...windows.map((window) => ({
                                  value: window.windowId,
                                  label: window.title,
                                  description: window.owningApp,
                                  icon: Monitor,
                                }))
                              ]}
                              variant="secondary"
                              showLabel={false}
                              searchable={true}
                              placeholder="Select a window..."
                              className="w-full"
                            />
                          ) : (
                            <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                              No capturable windows found
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Display Selector */
                        <DisplayMultiSelect
                          displays={displays}
                          selectedDisplayIds={selectedDisplayIds}
                          onChange={setSelectedDisplayIds}
                          disabled={loading}
                        />
                      )}
                    </div>

                    {/* Webcam Device Selector */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-900">Webcam</label>
                      {loading ? (
                        <div className="text-xs text-gray-500 text-center py-2">Loading...</div>
                      ) : webcams.length > 0 ? (
                        <DeviceSelector
                          type="webcam"
                          label=""
                          value={selectedWebcamId}
                          onChange={(id) => {
                            setSelectedWebcamId(id);
                            // Auto-enable PiP mode when webcam is selected (if currently off)
                            if (webcamMode.mode === 'off' && id) {
                              setWebcamMode({
                                mode: 'pip',
                                pipConfig: { position: 'bottom-right', size: 'medium' },
                              });
                            }
                          }}
                          devices={webcams}
                          loading={loading}
                          compact
                        />
                      ) : (
                        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                          No webcams found
                        </div>
                      )}
                    </div>

                    {/* Webcam Mode Selector - Only show when webcam is selected */}
                    {selectedWebcamId && webcams.length > 0 && (
                      <div className="pt-2">
                        <WebcamModeSelector
                          value={webcamMode}
                          onChange={setWebcamMode}
                          disabled={loading}
                        />
                      </div>
                    )}

                    {/* Quality Preset Dropdown */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-900 block mb-2">Quality Preset</label>
                      <GlassSelect
                        value={qualityPreset}
                        onChange={(val) => setQualityPreset(val as 'low' | 'medium' | 'high' | 'ultra')}
                        options={[
                          {
                            value: 'low',
                            label: 'Low',
                            description: `720p, 15fps - ${getEstimatedFileSizePerHour('low')}/hr`,
                            icon: Video
                          },
                          {
                            value: 'medium',
                            label: 'Medium',
                            description: `1080p, 15fps - ${getEstimatedFileSizePerHour('medium')}/hr`,
                            icon: Video
                          },
                          {
                            value: 'high',
                            label: 'High',
                            description: `1080p, 30fps - ${getEstimatedFileSizePerHour('high')}/hr`,
                            icon: Video
                          },
                          {
                            value: 'ultra',
                            label: 'Ultra',
                            description: `4K, 30fps - ${getEstimatedFileSizePerHour('ultra')}/hr`,
                            icon: Video
                          },
                        ]}
                        variant="secondary"
                        showLabel={false}
                        className="w-full"
                      />
                    </div>

                    {/* Advanced Settings - Collapsible Section */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                        className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-cyan-600 transition-colors"
                        aria-expanded={showAdvancedSettings}
                        aria-controls="advanced-video-settings"
                        aria-label="Toggle advanced video settings"
                      >
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`}
                        />
                        Advanced Settings
                      </button>

                      <AnimatePresence>
                        {showAdvancedSettings && (
                          <motion.div
                            id="advanced-video-settings"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                            role="region"
                            aria-label="Advanced video settings"
                          >
                            <div className="space-y-4 pt-2 pl-6 border-l-2 border-cyan-200">
                              {/* Custom Resolution Override */}
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-700 uppercase">
                                  Custom Resolution (optional)
                                </label>
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="number"
                                    placeholder="Width"
                                    value={customResolution.width}
                                    onChange={(e) => setCustomResolution({ ...customResolution, width: e.target.value })}
                                    className="flex-1 px-3 py-2 rounded-lg bg-white/50 border border-white/40 focus:border-cyan-400 focus:outline-none text-sm"
                                    aria-label="Custom resolution width in pixels"
                                  />
                                  <span className="text-gray-600" aria-hidden="true">×</span>
                                  <input
                                    type="number"
                                    placeholder="Height"
                                    value={customResolution.height}
                                    onChange={(e) => setCustomResolution({ ...customResolution, height: e.target.value })}
                                    className="flex-1 px-3 py-2 rounded-lg bg-white/50 border border-white/40 focus:border-cyan-400 focus:outline-none text-sm"
                                    aria-label="Custom resolution height in pixels"
                                  />
                                </div>
                              </div>

                              {/* Custom FPS Slider */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label htmlFor="custom-fps-slider" className="text-xs font-bold text-gray-700 uppercase">
                                    Frame Rate
                                  </label>
                                  <span className="text-sm font-semibold text-cyan-600" aria-live="polite">{customFps} fps</span>
                                </div>
                                <input
                                  id="custom-fps-slider"
                                  type="range"
                                  min="15"
                                  max="60"
                                  step="5"
                                  value={customFps}
                                  onChange={(e) => setCustomFps(Number(e.target.value))}
                                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                  aria-label="Custom frame rate"
                                  aria-valuemin={15}
                                  aria-valuemax={60}
                                  aria-valuenow={customFps}
                                  aria-valuetext={`${customFps} frames per second`}
                                />
                                <div className="flex justify-between text-xs text-gray-500">
                                  <span>15</span>
                                  <span>30</span>
                                  <span>60</span>
                                </div>
                              </div>

                              {/* Codec Selection */}
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-700 uppercase block mb-2">Codec</label>
                                <GlassSelect
                                  value={codec}
                                  onChange={(val) => setCodec(val as 'h264' | 'h265')}
                                  options={[
                                    {
                                      value: 'h264',
                                      label: 'H.264',
                                      description: 'Better compatibility',
                                      icon: SettingsIcon
                                    },
                                    {
                                      value: 'h265',
                                      label: 'H.265',
                                      description: 'Smaller file size',
                                      icon: SettingsIcon
                                    },
                                  ]}
                                  variant="secondary"
                                  showLabel={false}
                                  className="w-full"
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200/50 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Cancel and close modal"
            >
              Cancel
            </button>
            <button
              onClick={handleStart}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/30 flex items-center gap-2"
              aria-label="Start recording session"
            >
              <Play size={16} />
              Start Recording
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
