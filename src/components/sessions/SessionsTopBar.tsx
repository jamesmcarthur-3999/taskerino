import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, Square, Clock, CheckCircle2, CheckCheck, Camera as CameraIcon, Mic, Video, ChevronDown, CalendarDays, Timer, TrendingDown, TrendingUp, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Session, AudioDevice, DisplayInfo, WindowInfo, WebcamInfo } from '../../types';
import type { LastSessionSettings } from '../../utils/lastSessionSettings';
import { ToggleButton } from './ToggleButton';
import { DropdownTrigger } from '../DropdownTrigger';
import { StandardFilterPanel } from '../StandardFilterPanel';
import { GlassSelect } from '../GlassSelect';
import { ArrowUpDown } from 'lucide-react';
import { StartSessionModal, type SessionStartConfig } from './StartSessionModal';
import { DeviceSelector } from './DeviceSelector';
import { audioRecordingService } from '../../services/audioRecordingService';
import { videoRecordingService } from '../../services/videoRecordingService';
import { getWarningGradient, getSuccessGradient, getDangerGradient, getGradientClasses, getRadiusClass } from '../../design-system/theme';
import { useTheme } from '../../context/ThemeContext';
import { CaptureQuickSettings } from './CaptureQuickSettings';
import { AudioQuickSettings } from './AudioQuickSettings';
import { AdvancedCaptureModal } from './AdvancedCaptureModal';
import { AdvancedAudioModal } from './AdvancedAudioModal';

interface SessionsTopBarProps {
  // Session state
  activeSession: Session | undefined;
  sessions: Session[];
  allPastSessions: Session[];

  // Session controls
  isStarting: boolean;
  isEnding: boolean;
  countdown: number | null;
  handleQuickStart: () => void;
  startSession: (config: Partial<Session>) => void;
  handleEndSession: (sessionId: string) => void;
  pauseSession: (sessionId: string) => void;
  resumeSession: (sessionId: string) => void;

  // Settings
  currentSettings: LastSessionSettings;
  updateScreenshots: (enabled: boolean) => void;
  updateAudio: (enabled: boolean) => void;
  updateVideo: (enabled: boolean) => void;
  updateInterval: (interval: number) => void;

  // Filter/Sort/Select state
  sortBy: 'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc';
  onSortChange: (sortBy: 'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc') => void;
  selectedCategories: string[];
  selectedSubCategories: string[];
  selectedTags: string[];
  onCategoriesChange: (categories: string[]) => void;
  onSubCategoriesChange: (subCategories: string[]) => void;
  onTagsChange: (tags: string[]) => void;
  bulkSelectMode: boolean;
  selectedSessionIds: Set<string>;
  onBulkSelectModeChange: (enabled: boolean) => void;
  onSelectedSessionIdsChange: (ids: Set<string>) => void;

  // Device enumeration (passed from parent to avoid duplicate calls)
  audioDevices: AudioDevice[];
  displays: DisplayInfo[];
  windows: WindowInfo[];
  webcams: WebcamInfo[];
  loadingDevices: boolean;
  onLoadDevices?: () => void; // Lazy load devices when modal opens

  // Responsive compact mode
  compactMode?: boolean;
}

export function SessionsTopBar({
  activeSession,
  sessions,
  allPastSessions,
  isStarting,
  isEnding,
  countdown,
  handleQuickStart,
  startSession,
  handleEndSession,
  pauseSession,
  resumeSession,
  currentSettings,
  updateScreenshots,
  updateAudio,
  updateVideo,
  updateInterval,
  sortBy,
  onSortChange,
  selectedCategories,
  selectedSubCategories,
  selectedTags,
  onCategoriesChange,
  onSubCategoriesChange,
  onTagsChange,
  bulkSelectMode,
  selectedSessionIds,
  onBulkSelectModeChange,
  onSelectedSessionIdsChange,
  audioDevices,
  displays,
  windows,
  webcams,
  loadingDevices,
  onLoadDevices,
  compactMode = false,
}: SessionsTopBarProps) {
  // Local state for interval dropdown and modal
  const [showIntervalDropdown, setShowIntervalDropdown] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);

  // Filter panel state
  const [showFilters, setShowFilters] = useState(false);
  const filterButtonRef = React.useRef<HTMLButtonElement>(null);

  // Quick settings dropdown states
  const [showCaptureQuickSettings, setShowCaptureQuickSettings] = useState(false);
  const [showAudioQuickSettings, setShowAudioQuickSettings] = useState(false);

  // Advanced modal states
  const [showAdvancedCaptureModal, setShowAdvancedCaptureModal] = useState(false);
  const [showAdvancedAudioModal, setShowAdvancedAudioModal] = useState(false);

  // CAPTURE SETTINGS STATE
  // Video settings
  const [videoEnabled, setVideoEnabled] = useState(currentSettings.videoRecording || false);
  const [videoQuality, setVideoQuality] = useState<'low' | 'medium' | 'high' | 'ultra' | 'custom'>('medium');
  const [customResolution, setCustomResolution] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 });
  const [customFrameRate, setCustomFrameRate] = useState(30);

  // Screenshot settings
  const [screenshotTiming, setScreenshotTiming] = useState<'adaptive' | 'fixed'>(
    currentSettings.screenshotInterval === -1 ? 'adaptive' : 'fixed'
  );
  const [screenshotInterval, setScreenshotInterval] = useState(currentSettings.screenshotInterval === -1 ? 1 : currentSettings.screenshotInterval);
  const [screenshotFormat, setScreenshotFormat] = useState<'png' | 'jpg' | 'webp'>('png');
  const [screenshotQuality, setScreenshotQuality] = useState(90);

  // Source settings
  const [captureSource, setCaptureSource] = useState<'screen' | 'window' | 'webcam'>('screen');
  const [selectedDisplayIds, setSelectedDisplayIds] = useState<string[]>([]);
  const [selectedWindowIds, setSelectedWindowIds] = useState<string[]>([]);
  const [selectedWebcam, setSelectedWebcam] = useState<string>();

  // Webcam PiP settings
  const [webcamPipEnabled, setWebcamPipEnabled] = useState(false);
  const [pipPosition, setPipPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom'>('bottom-right');
  const [pipSize, setPipSize] = useState<'small' | 'medium' | 'large' | 'custom'>('small');
  const [pipCustomPosition, setPipCustomPosition] = useState<{ x: number; y: number }>({ x: 10, y: 10 });
  const [pipBorderEnabled, setPipBorderEnabled] = useState(true);

  // Advanced video settings
  const [codec, setCodec] = useState<'h264' | 'h265' | 'vp9'>('h264');
  const [bitrate, setBitrate] = useState(5000);
  const [storageLocation, setStorageLocation] = useState('~/Taskerino/sessions');
  const [fileNamingPattern, setFileNamingPattern] = useState('session-{date}-{time}');

  // AUDIO SETTINGS STATE
  // Device selection
  const [selectedMicDevice, setSelectedMicDevice] = useState<string>();
  const [selectedSystemAudioDevice, setSelectedSystemAudioDevice] = useState<string>();

  // Audio enable/disable
  const [micEnabled, setMicEnabled] = useState(currentSettings.audioRecording);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(false);

  // Balance and gain
  const [micBalance, setMicBalance] = useState(50); // 0-100, 50 = balanced
  const [micGain, setMicGain] = useState(100); // 0-200, 100 = unity
  const [systemAudioGain, setSystemAudioGain] = useState(100);

  // Audio processing
  const [micNoiseReduction, setMicNoiseReduction] = useState(true);
  const [micEchoCancellation, setMicEchoCancellation] = useState(true);
  const [autoLevelingEnabled, setAutoLevelingEnabled] = useState(true);
  const [compressionEnabled, setCompressionEnabled] = useState(false);
  const [compressionThreshold, setCompressionThreshold] = useState(-20);
  const [sampleRate, setSampleRate] = useState<44100 | 48000 | 96000>(48000);
  const [bitDepth, setBitDepth] = useState<16 | 24 | 32>(24);

  // Per-app audio routing
  const [perAppAudioEnabled, setPerAppAudioEnabled] = useState(false);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [availableApps] = useState<Array<{ bundleId: string; name: string; icon?: string }>>([
    // TODO: Populate from Tauri command
  ]);

  // Get semantic gradients from design system
  const warningGradient = getWarningGradient('light');
  const successGradient = getSuccessGradient('strong');
  const dangerGradient = getDangerGradient('strong');
  const resumeGradient = getSuccessGradient('strong');
  const pauseGradient = getWarningGradient('strong');
  const { colorScheme } = useTheme();

  // Prepare filter sections for StandardFilterPanel
  const filterSections = useMemo(() => {
    const uniqueCategories = new Set<string>();
    const uniqueSubCategories = new Set<string>();
    const uniqueTags = new Set<string>();

    sessions.forEach(s => {
      if (s.category) uniqueCategories.add(s.category);
      if (s.subCategory) uniqueSubCategories.add(s.subCategory);
      if (s.tags) {
        s.tags.forEach(tag => uniqueTags.add(tag));
      }
    });

    const sections = [];

    if (uniqueCategories.size > 0) {
      sections.push({
        title: 'CATEGORIES',
        items: Array.from(uniqueCategories).sort().map(cat => ({ id: cat, label: cat })),
        selectedIds: selectedCategories,
        onToggle: (id: string) => {
          if (selectedCategories.includes(id)) {
            onCategoriesChange(selectedCategories.filter(c => c !== id));
          } else {
            onCategoriesChange([...selectedCategories, id]);
          }
        },
        multiSelect: true,
      });
    }

    if (uniqueSubCategories.size > 0) {
      sections.push({
        title: 'SUB-CATEGORIES',
        items: Array.from(uniqueSubCategories).sort().map(subCat => ({ id: subCat, label: subCat })),
        selectedIds: selectedSubCategories,
        onToggle: (id: string) => {
          if (selectedSubCategories.includes(id)) {
            onSubCategoriesChange(selectedSubCategories.filter(sc => sc !== id));
          } else {
            onSubCategoriesChange([...selectedSubCategories, id]);
          }
        },
        multiSelect: true,
      });
    }

    if (uniqueTags.size > 0) {
      sections.push({
        title: 'TAGS',
        items: Array.from(uniqueTags).sort().map(tag => ({ id: tag, label: `#${tag}` })),
        selectedIds: selectedTags,
        onToggle: (id: string) => {
          if (selectedTags.includes(id)) {
            onTagsChange(selectedTags.filter(t => t !== id));
          } else {
            onTagsChange([...selectedTags, id]);
          }
        },
        multiSelect: true,
      });
    }

    return sections;
  }, [sessions, selectedCategories, selectedSubCategories, selectedTags, onCategoriesChange, onSubCategoriesChange, onTagsChange]);

  const activeFilterCount = selectedCategories.length + selectedSubCategories.length + selectedTags.length;

  // Permission request handlers
  const handleRequestScreenPermission = async () => {
    try {
      console.log('🔒 [SESSIONS TOPBAR] Requesting screen recording permission...');

      // Check if we already have permission
      const hasPermission = await videoRecordingService.checkPermission();

      if (hasPermission) {
        console.log('✅ [SESSIONS TOPBAR] Permission already granted, reloading devices...');
        // Force reload to pick up any newly available devices
        if (typeof onLoadDevices === 'function') {
          (onLoadDevices as (forceReload?: boolean) => void)(true);
        }
        return;
      }

      // Request permission (will trigger macOS dialog or open System Settings)
      await videoRecordingService.requestPermission();

      console.log('⚠️ [SESSIONS TOPBAR] Permission requested. Please grant permission in System Settings if prompted.');
      console.log('💡 [SESSIONS TOPBAR] After granting permission, devices will reload automatically in 3 seconds...');

      // After requesting, reload devices to check if permission was granted
      setTimeout(() => {
        console.log('🔄 [SESSIONS TOPBAR] Reloading devices after permission request...');
        // Force reload to bypass cache
        if (typeof onLoadDevices === 'function') {
          (onLoadDevices as (forceReload?: boolean) => void)(true);
        }
      }, 3000); // Give user time to grant permission
    } catch (error) {
      console.error('❌ [SESSIONS TOPBAR] Failed to request screen permission:', error);
    }
  };

  const handleRequestCameraPermission = async () => {
    try {
      console.log('🔒 [SESSIONS TOPBAR] Requesting camera permission...');
      console.log('💡 [SESSIONS TOPBAR] Attempting to enumerate webcams (this will trigger macOS permission dialog)...');

      // This will trigger macOS to show the permission dialog automatically
      // By attempting to access the camera via AVCaptureDevice, macOS will prompt
      await videoRecordingService.enumerateWebcams();

      console.log('✅ [SESSIONS TOPBAR] Camera enumeration attempted. If permission dialog appeared, grant permission.');
      console.log('💡 [SESSIONS TOPBAR] Devices will reload automatically in 2 seconds...');

      // Reload devices after attempting enumeration
      setTimeout(() => {
        console.log('🔄 [SESSIONS TOPBAR] Reloading devices after camera permission request...');
        // Force reload to bypass cache
        if (typeof onLoadDevices === 'function') {
          (onLoadDevices as (forceReload?: boolean) => void)(true);
        }
      }, 2000);
    } catch (error) {
      console.error('⚠️ [SESSIONS TOPBAR] Camera permission request triggered (error expected if no permission)');
      // Even if it fails, we tried to trigger the permission dialog
      console.log('💡 [SESSIONS TOPBAR] Reloading devices in 2 seconds...');
      setTimeout(() => {
        if (typeof onLoadDevices === 'function') {
          (onLoadDevices as (forceReload?: boolean) => void)(true);
        }
      }, 2000);
    }
  };

  // Handler to immediately start session with current settings
  const handleStartSession = () => {
    // Validate audio device availability before starting
    if (micEnabled) {
      const hasInputDevices = audioDevices.some(d => d.deviceType === 'Input');
      if (!hasInputDevices) {
        console.error('[START_SESSION] Microphone enabled but no input devices available');
        // Optionally show a toast notification here
        return;
      }
    }
    if (systemAudioEnabled) {
      const hasOutputDevices = audioDevices.some(d => d.deviceType === 'Output');
      if (!hasOutputDevices) {
        console.error('[START_SESSION] System audio enabled but no output devices available');
        // Optionally show a toast notification here
        return;
      }
    }

    // Build comprehensive session data from all 50+ state variables
    const sessionData: Partial<Session> = {
      name: `Session ${new Date().toLocaleString()}`,
      status: 'active',
      enableScreenshots: currentSettings.enableScreenshots,
      screenshotInterval: screenshotTiming === 'adaptive' ? -1 : screenshotInterval,
      audioRecording: micEnabled || systemAudioEnabled,
      videoRecording: videoEnabled,
      startTime: new Date().toISOString(),
      screenshots: [],
      extractedTaskIds: [],
      extractedNoteIds: [],
      tags: [],
      autoAnalysis: true,
      audioMode: (micEnabled || systemAudioEnabled) ? 'transcription' : 'off',
      audioReviewCompleted: false,
    };

    // Build audio config from audio settings
    if (micEnabled || systemAudioEnabled) {
      const sourceType = micEnabled && systemAudioEnabled
        ? 'both'
        : micEnabled
          ? 'microphone'
          : 'system-audio';

      // Get device IDs with fallbacks to first available device
      const micId = selectedMicDevice || audioDevices.find(d => d.deviceType === 'Input')?.id || '';
      const systemAudioId = selectedSystemAudioDevice || audioDevices.find(d => d.deviceType === 'Output')?.id || '';

      sessionData.audioConfig = {
        sourceType,
        ...(sourceType === 'microphone' || sourceType === 'both' ? { micDeviceId: micId } : {}),
        ...(sourceType === 'system-audio' || sourceType === 'both' ? { systemAudioDeviceId: systemAudioId } : {}),
        balance: micBalance,
        micVolume: micGain / 100,
        systemVolume: systemAudioGain / 100,
      };
    }

    // Build video config from video settings
    if (videoEnabled) {
      // Map quality preset to resolution and frame rate
      let resolution: { width: number; height: number };
      let fps: number;

      switch (videoQuality) {
        case 'low':
          resolution = { width: 1280, height: 720 };
          fps = 15;
          break;
        case 'medium':
          resolution = { width: 1920, height: 1080 };
          fps = 30;
          break;
        case 'high':
          resolution = { width: 2560, height: 1440 };
          fps = 30;
          break;
        case 'ultra':
          resolution = { width: 3840, height: 2160 };
          fps = 60;
          break;
        case 'custom':
          resolution = customResolution;
          fps = customFrameRate;
          break;
      }

      sessionData.videoConfig = {
        sourceType: captureSource === 'screen' ? 'display' : captureSource === 'window' ? 'window' : 'webcam',
        displayIds: captureSource === 'screen' && selectedDisplayIds.length > 0 ? selectedDisplayIds : undefined,
        windowIds: captureSource === 'window' && selectedWindowIds.length > 0 ? selectedWindowIds : undefined,
        webcamDeviceId: captureSource === 'webcam' && selectedWebcam ? selectedWebcam : undefined,
        quality: videoQuality === 'custom' ? 'medium' : videoQuality,
        fps,
        resolution,
        pipConfig: webcamPipEnabled ? {
          enabled: true,
          position: pipPosition === 'custom' ? 'bottom-right' : pipPosition,
          size: pipSize === 'custom' ? 'small' : pipSize,
        } : undefined,
      };
    }

    // Call startSession with the complete configuration
    startSession(sessionData);
  };

  // Helper function to render session controls
  const renderSessionControls = () => (
    <>
      {activeSession ? (
        <>
          {/* Active Session Indicator - Dot always visible, name hides in compact mode */}
          <motion.div
            layout
            className="flex items-center px-3 py-2"
            style={{
              maxWidth: compactMode ? '48px' : '220px',
            }}
            transition={{
              layout: {
                type: "spring",
                stiffness: 400,
                damping: 30,
              }
            }}
          >
            <motion.div
              layout="position"
              className={`w-3 h-3 rounded-full flex-shrink-0 ${
                activeSession.status === 'paused'
                  ? `${warningGradient.iconBg} shadow-lg shadow-yellow-400/50`
                  : `${successGradient.iconBg} animate-pulse shadow-lg shadow-green-500/50`
              }`}
            />
            <AnimatePresence mode="wait" initial={false}>
              {!compactMode && (
                <motion.span
                  key="session-name"
                  className="text-sm font-bold text-gray-900 truncate"
                  title={activeSession.name}
                  initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                  animate={{
                    opacity: 1,
                    width: 'auto',
                    marginLeft: '8px',
                    transition: {
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }
                  }}
                  exit={{
                    opacity: 0,
                    width: 0,
                    marginLeft: 0,
                    transition: {
                      type: "spring",
                      stiffness: 500,
                      damping: 35,
                    }
                  }}
                >
                  {activeSession.name}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>

          <div className="h-8 w-px bg-white/30"></div>

          {/* Pause/Resume Button */}
          {activeSession.status === 'paused' ? (
            <motion.button
              layout
              onClick={() => resumeSession(activeSession.id)}
              className={`flex items-center ${getRadiusClass('pill')} ${resumeGradient.container} text-white shadow-md font-semibold text-sm transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 border-2 border-transparent`}
              style={{
                paddingLeft: '16px',
                paddingRight: '16px',
                paddingTop: '8px',
                paddingBottom: '8px',
              }}
              transition={{
                layout: {
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }
              }}
            >
              <motion.div layout="position">
                <Play size={16} />
              </motion.div>
              <AnimatePresence mode="wait" initial={false}>
                {!compactMode && (
                  <motion.span
                    key="resume-label"
                    initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                    animate={{
                      opacity: 1,
                      width: 'auto',
                      marginLeft: '8px',
                      transition: {
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }
                    }}
                    exit={{
                      opacity: 0,
                      width: 0,
                      marginLeft: 0,
                      transition: {
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                      }
                    }}
                  >
                    Resume
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          ) : (
            <motion.button
              layout
              onClick={() => pauseSession(activeSession.id)}
              className={`flex items-center ${getRadiusClass('pill')} ${pauseGradient.container} text-white shadow-md font-semibold text-sm transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 border-2 border-transparent`}
              style={{
                paddingLeft: '16px',
                paddingRight: '16px',
                paddingTop: '8px',
                paddingBottom: '8px',
              }}
              transition={{
                layout: {
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }
              }}
            >
              <motion.div layout="position">
                <Pause size={16} />
              </motion.div>
              <AnimatePresence mode="wait" initial={false}>
                {!compactMode && (
                  <motion.span
                    key="pause-label"
                    initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                    animate={{
                      opacity: 1,
                      width: 'auto',
                      marginLeft: '8px',
                      transition: {
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }
                    }}
                    exit={{
                      opacity: 0,
                      width: 0,
                      marginLeft: 0,
                      transition: {
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                      }
                    }}
                  >
                    Pause
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}

          {/* Stop Button - with delightful UX */}
          <motion.button
            layout
            onClick={() => handleEndSession(activeSession.id)}
            disabled={isEnding}
            className={`flex items-center ${getRadiusClass('pill')} ${dangerGradient.container} text-white shadow-md font-semibold text-sm transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 border-2 border-transparent disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100`}
            style={{
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '8px',
              paddingBottom: '8px',
            }}
            transition={{
              layout: {
                type: "spring",
                stiffness: 400,
                damping: 30,
              }
            }}
          >
            {isEnding ? (
              <>
                <motion.div layout="position">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </motion.div>
                <motion.span
                  layout="position"
                  style={{ marginLeft: '8px' }}
                >
                  Saving...
                </motion.span>
              </>
            ) : (
              <>
                <motion.div layout="position">
                  <Square size={16} />
                </motion.div>
                <AnimatePresence mode="wait" initial={false}>
                  {!compactMode && (
                    <motion.span
                      key="stop-label"
                      initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                      animate={{
                        opacity: 1,
                        width: 'auto',
                        marginLeft: '8px',
                        transition: {
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }
                      }}
                      exit={{
                        opacity: 0,
                        width: 0,
                        marginLeft: 0,
                        transition: {
                          type: "spring",
                          stiffness: 500,
                          damping: 35,
                        }
                      }}
                    >
                      Stop
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.button>
        </>
      ) : (
        <>
          {/* Start Session Button - Now starts immediately with configured settings */}
          <motion.button
            layout
            onClick={handleStartSession}
            disabled={isStarting}
            className={`flex items-center ${getRadiusClass('pill')} ${getGradientClasses(colorScheme, 'primary')} text-white shadow-md font-semibold text-sm transition-all border-2 border-transparent disabled:cursor-not-allowed ${
              isStarting
                ? 'animate-pulse shadow-lg shadow-cyan-500/50'
                : 'hover:shadow-lg hover:scale-[1.02] active:scale-95'
            }`}
            style={{
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '8px',
              paddingBottom: '8px',
            }}
            transition={{
              layout: {
                type: "spring",
                stiffness: 400,
                damping: 30,
              }
            }}
          >
            {isStarting ? (
              countdown !== null && countdown > 0 ? (
                <>
                  <motion.div layout="position">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center border border-white/40">
                      <span className="text-sm font-bold">{countdown}</span>
                    </div>
                  </motion.div>
                  <motion.span
                    layout="position"
                    style={{ marginLeft: '8px' }}
                  >
                    Starting in {countdown}...
                  </motion.span>
                </>
              ) : countdown === 0 ? (
                <>
                  <motion.div layout="position">
                    <CheckCircle2 size={16} className="animate-pulse" />
                  </motion.div>
                  <motion.span
                    layout="position"
                    style={{ marginLeft: '8px' }}
                  >
                    Recording!
                  </motion.span>
                </>
              ) : (
                <>
                  <motion.div layout="position">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </motion.div>
                  <motion.span
                    layout="position"
                    style={{ marginLeft: '8px' }}
                  >
                    Starting...
                  </motion.span>
                </>
              )
            ) : (
              <>
                <motion.div layout="position">
                  <Play size={16} />
                </motion.div>
                <AnimatePresence mode="wait" initial={false}>
                  {!compactMode && (
                    <motion.span
                      key="start-label"
                      initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                      animate={{
                        opacity: 1,
                        width: 'auto',
                        marginLeft: '8px',
                        transition: {
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }
                      }}
                      exit={{
                        opacity: 0,
                        width: 0,
                        marginLeft: 0,
                        transition: {
                          type: "spring",
                          stiffness: 500,
                          damping: 35,
                        }
                      }}
                    >
                      Start Session
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.button>
        </>
      )}

      <div className="h-8 w-px bg-white/30"></div>

      {/* CAPTURE Toggle with Quick Settings (merged Screenshots + Video) */}
      <div className="relative flex items-center">
        <ToggleButton
          icon={Video}
          label="Capture"
          active={currentSettings.enableScreenshots}
          onChange={updateScreenshots}
          size="sm"
          showLabel={!compactMode}
        />

        {/* Dropdown arrow button - opens quick settings */}
        <button
          onClick={() => setShowCaptureQuickSettings(!showCaptureQuickSettings)}
          className="ml-1 p-1.5 rounded-lg bg-white/30 hover:bg-white/50 transition-colors border border-white/40"
        >
          <ChevronDown size={12} className={`text-gray-700 transition-transform ${showCaptureQuickSettings ? 'rotate-180' : ''}`} />
        </button>

        {/* Capture Quick Settings Dropdown */}
        <CaptureQuickSettings
          show={showCaptureQuickSettings}
          onClose={() => setShowCaptureQuickSettings(false)}
          videoEnabled={videoEnabled}
          onVideoToggle={setVideoEnabled}
          quality={videoQuality}
          onQualityChange={setVideoQuality}
          screenshotTiming={screenshotTiming}
          onTimingChange={setScreenshotTiming}
          screenshotInterval={screenshotInterval}
          onIntervalChange={setScreenshotInterval}
          source={captureSource}
          onSourceChange={setCaptureSource}
          selectedDisplayIds={selectedDisplayIds}
          onDisplayIdsChange={setSelectedDisplayIds}
          displays={displays}
          selectedWindowIds={selectedWindowIds}
          onWindowIdsChange={setSelectedWindowIds}
          windows={windows}
          selectedWebcam={selectedWebcam}
          onWebcamChange={setSelectedWebcam}
          webcams={webcams}
          webcamPipEnabled={webcamPipEnabled}
          onWebcamPipToggle={setWebcamPipEnabled}
          onOpenAdvanced={() => setShowAdvancedCaptureModal(true)}
          onRequestScreenPermission={handleRequestScreenPermission}
          onRequestCameraPermission={handleRequestCameraPermission}
        />
      </div>

      {/* AUDIO Toggle with Quick Settings */}
      <div className="relative flex items-center">
        <ToggleButton
          icon={Mic}
          label="Audio"
          active={micEnabled || systemAudioEnabled}
          onChange={(enabled) => {
            setMicEnabled(enabled);
            updateAudio(enabled);
          }}
          size="sm"
          showLabel={!compactMode}
        />

        {/* Dropdown arrow button - opens quick settings */}
        <button
          onClick={() => setShowAudioQuickSettings(!showAudioQuickSettings)}
          className="ml-1 p-1.5 rounded-lg bg-white/30 hover:bg-white/50 transition-colors border border-white/40"
        >
          <ChevronDown size={12} className={`text-gray-700 transition-transform ${showAudioQuickSettings ? 'rotate-180' : ''}`} />
        </button>

        {/* Audio Quick Settings Dropdown */}
        <AudioQuickSettings
          show={showAudioQuickSettings}
          onClose={() => setShowAudioQuickSettings(false)}
          micEnabled={micEnabled}
          onMicToggle={setMicEnabled}
          selectedMicDevice={selectedMicDevice}
          onMicDeviceChange={setSelectedMicDevice}
          micDevices={audioDevices.filter(d => d.deviceType === 'Input')}
          systemAudioEnabled={systemAudioEnabled}
          onSystemAudioToggle={setSystemAudioEnabled}
          selectedSystemAudioDevice={selectedSystemAudioDevice}
          onSystemAudioDeviceChange={setSelectedSystemAudioDevice}
          systemAudioDevices={audioDevices.filter(d => d.deviceType === 'Output')}
          micBalance={micBalance}
          onBalanceChange={setMicBalance}
          onOpenAdvanced={() => setShowAdvancedAudioModal(true)}
        />
      </div>

  {/* Filter, Sort, Select Controls - Always visible */}
      {allPastSessions.length > 0 && (
        <>
          <div className="h-8 w-px bg-white/30"></div>

          {/* Filters Button */}
          <DropdownTrigger
            ref={filterButtonRef}
            icon={SlidersHorizontal}
            label="Filter"
            active={showFilters}
            onClick={() => setShowFilters(!showFilters)}
            badge={activeFilterCount > 0 ? activeFilterCount : undefined}
          />

          {/* Filter Panel */}
          {showFilters && (
            <StandardFilterPanel
              sections={filterSections}
              title="Filter Sessions"
              buttonRef={filterButtonRef}
              searchable={true}
              searchPlaceholder="Search filters..."
              onClearAll={() => {
                onCategoriesChange([]);
                onSubCategoriesChange([]);
                onTagsChange([]);
              }}
            />
          )}

          {/* Sort Dropdown */}
          <GlassSelect
            value={sortBy}
            options={[
              { value: 'date-desc', label: 'Recent First', icon: TrendingDown },
              { value: 'date-asc', label: 'Oldest First', icon: TrendingUp },
              { value: 'duration-desc', label: 'Longest First', icon: Timer },
              { value: 'duration-asc', label: 'Shortest First', icon: Clock },
            ]}
            onChange={onSortChange}
            variant="primary"
            triggerIcon={ArrowUpDown}
            searchable={false}
            placeholder="Sort by..."
          />

          {/* Select Button */}
          <motion.button
            layout
            onClick={() => {
              onBulkSelectModeChange(!bulkSelectMode);
              if (bulkSelectMode) {
                onSelectedSessionIdsChange(new Set());
              }
            }}
            className={`backdrop-blur-sm border-2 rounded-full text-sm font-semibold transition-all flex items-center ${
              bulkSelectMode
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md border-transparent'
                : 'bg-white/50 border-white/60 text-gray-700 hover:bg-white/70 hover:border-cyan-300'
            } focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 outline-none`}
            style={{
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '8px',
              paddingBottom: '8px',
            }}
            transition={{
              layout: {
                type: "spring",
                stiffness: 400,
                damping: 30,
              }
            }}
            title="Select multiple sessions"
          >
            <motion.div layout="position">
              <CheckCheck size={16} />
            </motion.div>
            <AnimatePresence mode="wait" initial={false}>
              {!compactMode && (
                <motion.span
                  key="select-label"
                  initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                  animate={{
                    opacity: 1,
                    width: 'auto',
                    marginLeft: '8px',
                    transition: {
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }
                  }}
                  exit={{
                    opacity: 0,
                    width: 0,
                    marginLeft: 0,
                    transition: {
                      type: "spring",
                      stiffness: 500,
                      damping: 35,
                    }
                  }}
                >
                  {bulkSelectMode ? 'Cancel' : 'Select'}
                </motion.span>
              )}
            </AnimatePresence>
            {selectedSessionIds.size > 0 && (
              <motion.span
                layout="position"
                className="ml-1 px-1.5 py-0.5 bg-white/30 text-white text-[10px] font-bold rounded-full"
              >
                {selectedSessionIds.size}
              </motion.span>
            )}
          </motion.button>
        </>
      )}
    </>
  );

  return (
    <>
      <div className="flex items-center gap-3">
        {renderSessionControls()}
      </div>

      {/* Start Session Modal */}
      <StartSessionModal
        show={showStartModal}
        onClose={() => setShowStartModal(false)}
        onStartSession={(config) => {
          const sessionData: Partial<Session> = {
            name: config.name,
            description: config.description,
            status: 'active',
            enableScreenshots: config.enableScreenshots,
            audioRecording: config.audioRecording,
            videoRecording: config.videoRecording,
            screenshotInterval: config.screenshotInterval,
            startTime: new Date().toISOString(),
            screenshots: [],
            extractedTaskIds: [],
            extractedNoteIds: [],
            tags: [],
            autoAnalysis: true,
            audioMode: config.audioRecording ? 'transcription' : 'off',
            audioReviewCompleted: false,
          };

          // Use devices from modal if provided, otherwise use TopBar selections
          if (config.audioConfig) {
            sessionData.audioConfig = config.audioConfig;
          } else if (config.audioRecording && selectedMicDevice) {
            // Use TopBar selection
            sessionData.audioConfig = {
              micDeviceId: selectedMicDevice,
              sourceType: 'microphone',
              balance: 50,
              micVolume: 1.0,
            };
          }

          if (config.videoConfig) {
            sessionData.videoConfig = config.videoConfig;
          } else if (config.videoRecording && selectedDisplayIds.length > 0) {
            // Use TopBar selection
            sessionData.videoConfig = {
              sourceType: 'display',
              displayIds: selectedDisplayIds,
              quality: 'medium',
              fps: 15,
            };
          }

          startSession(sessionData);
          setShowStartModal(false);
        }}
        lastSettings={{
          enableScreenshots: currentSettings?.enableScreenshots,
          audioRecording: currentSettings?.audioRecording,
          videoRecording: currentSettings?.videoRecording,
          screenshotInterval: currentSettings?.screenshotInterval,
        }}
        initialAudioDevice={selectedMicDevice}
        initialVideoDevice={selectedDisplayIds[0]}
      />

      {/* Advanced Capture Modal */}
      <AdvancedCaptureModal
        show={showAdvancedCaptureModal}
        onClose={() => setShowAdvancedCaptureModal(false)}
        quality={videoQuality}
        onQualityChange={setVideoQuality}
        customResolution={customResolution}
        onCustomResolutionChange={setCustomResolution}
        customFrameRate={customFrameRate}
        onCustomFrameRateChange={setCustomFrameRate}
        codec={codec}
        onCodecChange={setCodec}
        bitrate={bitrate}
        onBitrateChange={setBitrate}
        screenshotFormat={screenshotFormat}
        onScreenshotFormatChange={setScreenshotFormat}
        screenshotQuality={screenshotQuality}
        onScreenshotQualityChange={setScreenshotQuality}
        pipPosition={pipPosition}
        onPipPositionChange={setPipPosition}
        pipSize={pipSize}
        onPipSizeChange={setPipSize}
        pipCustomPosition={pipCustomPosition}
        onPipCustomPositionChange={setPipCustomPosition}
        pipBorderEnabled={pipBorderEnabled}
        onPipBorderToggle={setPipBorderEnabled}
        displays={displays}
        selectedDisplayIds={selectedDisplayIds}
        onDisplayIdsChange={setSelectedDisplayIds}
        storageLocation={storageLocation}
        onStorageLocationChange={setStorageLocation}
        fileNamingPattern={fileNamingPattern}
        onFileNamingPatternChange={setFileNamingPattern}
      />

      {/* Advanced Audio Modal */}
      <AdvancedAudioModal
        show={showAdvancedAudioModal}
        onClose={() => setShowAdvancedAudioModal(false)}
        micDevices={audioDevices.filter(d => d.deviceType === 'Input')}
        selectedMicDevice={selectedMicDevice}
        onMicDeviceChange={setSelectedMicDevice}
        micGain={micGain}
        onMicGainChange={setMicGain}
        micNoiseReduction={micNoiseReduction}
        onMicNoiseReductionToggle={setMicNoiseReduction}
        micEchoCancellation={micEchoCancellation}
        onMicEchoCancellationToggle={setMicEchoCancellation}
        systemAudioDevices={audioDevices.filter(d => d.deviceType === 'Output')}
        selectedSystemAudioDevice={selectedSystemAudioDevice}
        onSystemAudioDeviceChange={setSelectedSystemAudioDevice}
        systemAudioGain={systemAudioGain}
        onSystemAudioGainChange={setSystemAudioGain}
        perAppAudioEnabled={perAppAudioEnabled}
        onPerAppAudioToggle={setPerAppAudioEnabled}
        selectedApps={selectedApps}
        onSelectedAppsChange={setSelectedApps}
        availableApps={availableApps}
        autoLevelingEnabled={autoLevelingEnabled}
        onAutoLevelingToggle={setAutoLevelingEnabled}
        compressionEnabled={compressionEnabled}
        onCompressionToggle={setCompressionEnabled}
        compressionThreshold={compressionThreshold}
        onCompressionThresholdChange={setCompressionThreshold}
        sampleRate={sampleRate}
        onSampleRateChange={setSampleRate}
        bitDepth={bitDepth}
        onBitDepthChange={setBitDepth}
      />
    </>
  );
}
