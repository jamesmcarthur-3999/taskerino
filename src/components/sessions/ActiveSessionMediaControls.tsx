import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, ChevronDown, Mic, Volume2, Monitor, Camera } from 'lucide-react';
import type { Session, AudioDeviceConfig, VideoRecordingConfig, AudioDevice, DisplayInfo, WebcamInfo } from '../../types';
import { getGlassClasses, getRadiusClass } from '../../design-system/theme';
import { DeviceSelector } from './DeviceSelector';
import { AudioBalanceSlider } from './AudioBalanceSlider';
import { WebcamModeSelector } from './WebcamModeSelector';
import { AudioLevelMeter } from './AudioLevelMeter';
import type { WebcamMode } from './WebcamModeSelector';
import { audioRecordingService } from '../../services/audioRecordingService';
import { videoRecordingService } from '../../services/videoRecordingService';

interface ActiveSessionMediaControlsProps {
  session: Session;
  onAudioConfigChange: (config: AudioDeviceConfig) => void;
  onVideoConfigChange: (config: VideoRecordingConfig) => void;
}

/**
 * ActiveSessionMediaControls - Collapsible panel for mid-session device changes
 *
 * Allows users to change audio/video devices and settings DURING an active recording
 * session without stopping. Features smooth expand/collapse animation, device selectors,
 * audio balance slider, and webcam mode controls.
 *
 * Design:
 * - Trigger: "Device Settings" button with Settings icon
 * - Expand/collapse animation (height transition)
 * - Two subsections: Audio / Video
 * - Glassmorphism: getGlassClasses('strong')
 *
 * TODO Phase 2:
 * - Visual level meters for audio
 * - Warning indicators for disconnected devices
 */
export function ActiveSessionMediaControls({
  session,
  onAudioConfigChange,
  onVideoConfigChange,
}: ActiveSessionMediaControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [webcams, setWebcams] = useState<WebcamInfo[]>([]);

  // Current configurations (derived from session)
  const audioConfig: AudioDeviceConfig = session.audioConfig || {
    sourceType: 'microphone',
    balance: 50,
  };

  const videoConfig: VideoRecordingConfig = session.videoConfig || {
    sourceType: 'display',
    quality: 'medium',
    fps: 15,
  };

  // Load devices on mount
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const [audioDevs, displayList, webcamList] = await Promise.all([
        audioRecordingService.getAudioDevices(),
        videoRecordingService.enumerateDisplays(),
        videoRecordingService.enumerateWebcams(),
      ]);

      setAudioDevices(audioDevs);
      setDisplays(displayList);
      setWebcams(webcamList);
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  // Audio device handlers - MEMOIZED to prevent infinite loops in DeviceSelector
  const handleMicDeviceChange = useCallback((deviceId: string) => {
    onAudioConfigChange({
      ...audioConfig,
      micDeviceId: deviceId,
    });
  }, [audioConfig, onAudioConfigChange]);

  const handleSystemAudioDeviceChange = useCallback((deviceId: string) => {
    onAudioConfigChange({
      ...audioConfig,
      systemAudioDeviceId: deviceId,
    });
  }, [audioConfig, onAudioConfigChange]);

  const handleBalanceChange = useCallback((balance: number) => {
    onAudioConfigChange({
      ...audioConfig,
      balance,
    });
  }, [audioConfig, onAudioConfigChange]);

  // Video device handlers - MEMOIZED to prevent infinite loops in DeviceSelector
  const handleDisplayChange = useCallback((displayId: string) => {
    onVideoConfigChange({
      ...videoConfig,
      displayIds: [displayId],
    });
  }, [videoConfig, onVideoConfigChange]);

  const handleWebcamChange = useCallback((deviceId: string) => {
    onVideoConfigChange({
      ...videoConfig,
      webcamDeviceId: deviceId,
    });
  }, [videoConfig, onVideoConfigChange]);

  const handleWebcamModeChange = useCallback((mode: WebcamMode) => {
    if (mode.mode === 'off') {
      onVideoConfigChange({
        ...videoConfig,
        sourceType: 'display',
        webcamDeviceId: undefined,
        pipConfig: undefined,
      });
    } else if (mode.mode === 'standalone') {
      // Ensure webcamDeviceId is set (use existing or default to first available)
      const webcamDeviceId = videoConfig.webcamDeviceId || (webcams.length > 0 ? webcams[0].deviceId : undefined);

      if (!webcamDeviceId) {
        console.warn('⚠️ [Media Controls] Cannot switch to webcam mode: no webcam devices available');
        // TODO: Show error toast to user
        return;
      }

      onVideoConfigChange({
        ...videoConfig,
        sourceType: 'webcam',
        webcamDeviceId,
        pipConfig: undefined,
      });
    } else {
      // PiP mode - ensure webcamDeviceId is set
      const webcamDeviceId = videoConfig.webcamDeviceId || (webcams.length > 0 ? webcams[0].deviceId : undefined);

      if (!webcamDeviceId) {
        console.warn('⚠️ [Media Controls] Cannot switch to PiP mode: no webcam devices available');
        // TODO: Show error toast to user
        return;
      }

      onVideoConfigChange({
        ...videoConfig,
        sourceType: 'display-with-webcam',
        webcamDeviceId,
        pipConfig: mode.pipConfig ? {
          enabled: true,
          position: mode.pipConfig.position,
          size: mode.pipConfig.size,
        } : undefined,
      });
    }
  }, [videoConfig, onVideoConfigChange, webcams]);

  // Derive webcam mode from videoConfig - MEMOIZED to avoid recalculation on every render
  const webcamMode = useMemo((): WebcamMode => {
    if (videoConfig.sourceType === 'webcam') {
      return { mode: 'standalone' };
    } else if (videoConfig.sourceType === 'display-with-webcam') {
      return {
        mode: 'pip',
        pipConfig: videoConfig.pipConfig ? {
          position: videoConfig.pipConfig.position,
          size: videoConfig.pipConfig.size,
        } : {
          position: 'bottom-right',
          size: 'medium',
        },
      };
    }
    return { mode: 'off' };
  }, [videoConfig.sourceType, videoConfig.pipConfig]);

  // Filter devices by type
  const micDevices = audioDevices.filter(d => d.deviceType === 'Input');
  const systemAudioDevices = audioDevices.filter(d => d.deviceType === 'Output');

  // Only show when session is active
  if (session.status !== 'active') {
    return null;
  }

  return (
    <div className="px-6 py-3 border-b-2 border-white/40">
      {/* Trigger Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          w-full flex items-center justify-between
          px-4 py-3 rounded-xl transition-all duration-300
          ${isExpanded
            ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-2 border-cyan-400/40'
            : 'bg-white/30 border-2 border-white/40 hover:bg-white/50'
          }
        `}
      >
        <div className="flex items-center gap-2">
          <Settings
            size={18}
            className={`transition-colors ${isExpanded ? 'text-cyan-600' : 'text-gray-600'}`}
          />
          <span className={`text-sm font-bold ${isExpanded ? 'text-cyan-900' : 'text-gray-900'}`}>
            Device Settings
          </span>
        </div>
        <ChevronDown
          size={18}
          className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-cyan-600' : 'text-gray-600'}`}
        />
      </button>

      {/* Expandable Panel */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0.0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className={`mt-3 p-6 ${getGlassClasses('strong')} ${getRadiusClass('card')} space-y-6`}>
              {/* Audio Settings Section */}
              {session.audioRecording && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/40">
                    <Mic size={16} className="text-gray-700" />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                      Audio Settings
                    </h3>
                  </div>

                  {/* Microphone Selector */}
                  <DeviceSelector
                    type="audio-input"
                    label="Microphone"
                    value={audioConfig.micDeviceId}
                    onChange={handleMicDeviceChange}
                    devices={micDevices}
                  />

                  {/* System Audio Selector */}
                  {audioConfig.sourceType === 'both' && (
                    <DeviceSelector
                      type="audio-output"
                      label="System Audio"
                      value={audioConfig.systemAudioDeviceId}
                      onChange={handleSystemAudioDeviceChange}
                      devices={systemAudioDevices}
                    />
                  )}

                  {/* Balance Slider (only for 'both' mode) */}
                  {audioConfig.sourceType === 'both' && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-900">Audio Balance</label>
                      <AudioBalanceSlider
                        balance={audioConfig.balance || 50}
                        onChange={handleBalanceChange}
                      />
                    </div>
                  )}

                  {/* Audio Level Meters */}
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                      Audio Levels
                    </div>

                    {/* Microphone Level Meter */}
                    {(audioConfig.sourceType === 'microphone' || audioConfig.sourceType === 'both') && (
                      <AudioLevelMeter
                        label="Microphone"
                        deviceId={audioConfig.micDeviceId}
                        muted={false}
                      />
                    )}

                    {/* System Audio Level Meter */}
                    {(audioConfig.sourceType === 'system-audio' || audioConfig.sourceType === 'both') && (
                      <AudioLevelMeter
                        label="System Audio"
                        deviceId={audioConfig.systemAudioDeviceId}
                        muted={false}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Video Settings Section */}
              {session.videoRecording && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/40">
                    <Monitor size={16} className="text-gray-700" />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                      Video Settings
                    </h3>
                  </div>

                  {/* Display Selector */}
                  {(videoConfig.sourceType === 'display' || videoConfig.sourceType === 'display-with-webcam') && (
                    <DeviceSelector
                      type="display"
                      label="Display"
                      value={videoConfig.displayIds?.[0]}
                      onChange={handleDisplayChange}
                      devices={displays}
                    />
                  )}

                  {/* Webcam Selector */}
                  {webcams.length > 0 && (
                    <>
                      {(videoConfig.sourceType === 'webcam' || videoConfig.sourceType === 'display-with-webcam') && (
                        <DeviceSelector
                          type="webcam"
                          label="Webcam"
                          value={videoConfig.webcamDeviceId}
                          onChange={handleWebcamChange}
                          devices={webcams}
                        />
                      )}

                      {/* Webcam Mode Selector */}
                      <WebcamModeSelector
                        value={webcamMode}
                        onChange={handleWebcamModeChange}
                      />
                    </>
                  )}
                </div>
              )}

              {/* Info message if no recording active */}
              {!session.audioRecording && !session.videoRecording && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-600">
                    No audio or video recording is currently active.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
