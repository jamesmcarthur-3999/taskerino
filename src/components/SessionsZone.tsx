import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useSessionList } from '../context/SessionListContext';
import { useRecording } from '../context/RecordingContext';
import { useUI } from '../context/UIContext';
import { useEnrichmentContext } from '../context/EnrichmentContext';
import { useTasks } from '../context/TasksContext';
import { useEntities } from '../context/EntitiesContext';
import { Play, Pause, Square, Clock, Calendar, Tag, Activity, CheckCircle2, AlertCircle, Target, Lightbulb, Search, FileText, CheckSquare, TrendingUp, Camera, BookOpen, Trash2, Sparkles, Save, Filter, SlidersHorizontal, CheckCheck, Video, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import type { Session, SessionScreenshot, SessionAudioSegment, SessionContextItem } from '../types';
import { videoStorageService } from '../services/videoStorageService';
import { sessionsAgentService } from '../services/sessionsAgentService';
import { getCAStorage } from '../services/storage/ContentAddressableStorage';
import { LiveSessionEventEmitter } from '../services/liveSession/events';
import { SessionTimeline } from './SessionTimeline';
import { checkScreenRecordingPermission, showMacOSPermissionInstructions } from '../utils/permissions';
import { LoadingSpinner } from './LoadingSpinner';
import { useScrollAnimation } from '../contexts/ScrollAnimationContext';
import { clamp, easeOutQuart, easeOutCubic } from '../utils/easing';
import { BACKGROUND_GRADIENT, getGlassClasses, getRadiusClass, getToastClasses } from '../design-system/theme';
import { useTheme } from '../context/ThemeContext';

// Lazy load heavy components to reduce initial bundle size
const SessionDetailView = lazy(() => import('./SessionDetailView').then(module => ({ default: module.SessionDetailView })));
const ActiveSessionView = lazy(() => import('./ActiveSessionView').then(module => ({ default: module.ActiveSessionView })));
const SessionProcessingScreen = lazy(() => import('./sessions/SessionProcessingScreen').then(module => ({ default: module.SessionProcessingScreen })));
import { listen } from '@tauri-apps/api/event';
import { getTemplates, saveTemplate, type SessionTemplate } from '../utils/sessionTemplates';
import { loadLastSessionSettings, saveLastSessionSettings, getSettingsSummary, type LastSessionSettings } from '../utils/lastSessionSettings';
import { ToggleButton } from './sessions/ToggleButton';
import { IntervalControl } from './sessions/IntervalControl';
import { AdaptiveSchedulerDebug } from './sessions/AdaptiveSchedulerDebug';
import { Camera as CameraIcon, Mic } from 'lucide-react';
import { DropdownTrigger } from './DropdownTrigger';
import { InlineTagManager } from './InlineTagManager';
import { tagUtils } from '../utils/tagUtils';
import { FeatureTooltip } from './FeatureTooltip';
import { CollapsibleSidebar } from './CollapsibleSidebar';
import { useSessionEnding } from '../hooks/useSessionEnding';
import { useSessionStarting } from '../hooks/useSessionStarting';
import { SessionsStatsBar } from './sessions/SessionsStatsBar';
import { SessionsSortMenu } from './sessions/SessionsSortMenu';
import { SessionsSearchBar } from './sessions/SessionsSearchBar';
import { BulkOperationsBar } from './sessions/BulkOperationsBar';
import { ActiveFiltersDisplay } from './sessions/ActiveFiltersDisplay';
import { SessionListGroup } from './sessions/SessionListGroup';
import { SessionCard } from './sessions/SessionCard';
import { SessionsTopBar } from './sessions/SessionsTopBar';
import { SessionsListPanel } from './sessions/SessionsListPanel';
import { groupSessionsByDate, calculateTotalStats } from '../utils/sessionHelpers';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { RecordingErrorBanner } from './sessions/RecordingErrorBanner';
import { invoke } from '@tauri-apps/api/core';
import { eventBus } from '../utils/eventBus';

export default function SessionsZone() {
  // Phase 1 Contexts - specialized context hooks
  const {
    activeSession,
    activeSessionId,
    startSession,
    endSession,
    pauseSession,
    resumeSession,
    updateActiveSession,
    addScreenshot,
    addAudioSegment,
    updateScreenshotAnalysis,
    addScreenshotComment,
    toggleScreenshotFlag,
    addExtractedTask,
    addExtractedNote,
    addContextItem
  } = useActiveSession();

  const { sessions, loading, error, deleteSession, updateSession, refreshSessions } = useSessionList();

  const {
    recordingState,
    startScreenshots,
    stopScreenshots,
    pauseScreenshots,
    resumeScreenshots,
    getActiveScreenshotSessionId,
    isCapturing,
    startAudio,
    stopAudio,
    pauseAudio,
    resumeAudio,
    getActiveAudioSessionId,
    isAudioRecording,
    getAudioDevices,
    startVideo,
    stopVideo,
    getActiveVideoSessionId,
    isVideoRecording,
    checkVideoPermission,
    enumerateDisplays,
    enumerateWindows,
    enumerateWebcams,
    updateCuriosityScore,
    stopAll,
    pauseAll,
    resumeAll,
    clearError,
    clearAllErrors,
    getActiveErrors,
  } = useRecording();
  const { state: uiState, dispatch: uiDispatch, addNotification } = useUI();
  const { state: tasksState, dispatch: tasksDispatch } = useTasks();
  const { state: entitiesState, addTopic, addCompany, addContact } = useEntities();
  const { scrollY, registerScrollContainer, unregisterScrollContainer } = useScrollAnimation();
  const { activeEnrichments, hasActiveEnrichments } = useEnrichmentContext();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [lastMetadataUpdate, setLastMetadataUpdate] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [lastSynthesisUpdate, setLastSynthesisUpdate] = useState<string | null>(null);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc'>('date-desc');

  // Session ending state management
  const { isEnding, completedSessionId, shouldAutoNavigate, handleEndSession, clearAutoNavigation, isSessionNewlyCompleted } = useSessionEnding();

  // Session starting state management
  const { isStarting, countdown, startedSessionId, shouldAutoScroll, handleStartSession: startSessionWithCountdown, clearAutoScroll, isSessionNewlyStarted } = useSessionStarting();

  // Sessions Introduction Tooltip State
  const [showSessionsIntro, setShowSessionsIntro] = useState(false);

  // Filter dropdown state
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Sort dropdown state
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Interval dropdown state
  const [showIntervalDropdown, setShowIntervalDropdown] = useState(false);

  // Bulk selection state
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

  // TASK 11: Media processing screen state
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);

  // Device enumeration state (loaded once for all SessionsTopBar instances)
  const [audioDevices, setAudioDevices] = useState<import('../types').AudioDevice[]>([]);
  const [displays, setDisplays] = useState<import('../types').DisplayInfo[]>([]);
  const [windows, setWindows] = useState<import('../types').WindowInfo[]>([]);
  const [webcams, setWebcams] = useState<import('../types').WebcamInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [devicesCacheTimestamp, setDevicesCacheTimestamp] = useState<number | null>(null);

  // Device cache TTL: 5 minutes (300000ms) - prevents 1GB+ memory spike from repeated enumeration
  const DEVICE_CACHE_TTL_MS = 5 * 60 * 1000;

  // Sidebar state - control sidebar expansion from parent
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    // Initialize based on screen size
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1280;
    }
    return true;
  });

  // Track whether sidebar collapse was manual or automatic
  // This determines whether to auto-expand when screen becomes large
  const [collapseReason, setCollapseReason] = useState<'manual' | 'auto' | null>(() => {
    // Initialize based on screen size - if starting collapsed, mark as auto
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1280 ? 'auto' : null;
    }
    return null;
  });

  // Responsive sidebar behavior - auto-collapse on small screens, auto-expand on large screens
  useEffect(() => {
    const handleResize = () => {
      const isLargeScreen = window.innerWidth >= 1280;

      if (isLargeScreen) {
        // Screen became large - auto-expand ONLY if it was auto-collapsed
        if (!isSidebarExpanded && collapseReason === 'auto') {
          setIsSidebarExpanded(true);
          setCollapseReason(null); // Reset reason after auto-expanding
        }
      } else {
        // Screen became small - auto-collapse
        if (isSidebarExpanded) {
          setIsSidebarExpanded(false);
          setCollapseReason('auto'); // Mark as auto-collapsed
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarExpanded, collapseReason]);

  // Wrapper for setIsSidebarExpanded that tracks manual toggles
  const handleSidebarToggle = (expanded: boolean) => {
    setIsSidebarExpanded(expanded);
    // If user manually changes state, mark it as manual
    // This prevents auto-expand when screen becomes large
    setCollapseReason(expanded ? null : 'manual');
  };

  // Programmatic sidebar control (for auto-expand/collapse, not user-initiated)
  const handleSidebarProgrammatic = (expanded: boolean, reason: 'auto' | null = 'auto') => {
    setIsSidebarExpanded(expanded);
    setCollapseReason(reason);
  };

  // Active session is now retrieved from useActiveSession() hook above (Phase 1)
  // NOTE: Previously used activeSessionIdRef and stateRef to work around stale closures.
  // Now using ActiveSession context which provides fresh state automatically.
  // This replaces the old `const activeSession = sessions.find(...)` pattern.
  // See: /Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/REFS_ELIMINATION_PLAN.md

  // State: Track previous active session ID for detecting completion transitions
  // Converted from ref to state for proper React flow
  const [prevActiveSessionId, setPrevActiveSessionId] = useState<string | null>(null);

  // State: Track video recording initialization (prevents duplicate starts)
  // Converted from ref to state for proper React state management
  const [videoInitializedSessionId, setVideoInitializedSessionId] = useState<string | null>(null);

  // Ref for session list scroll container (enables auto-scroll to live session)
  const sessionListScrollRef = useRef<HTMLDivElement>(null);

  // LAZY LOADING: Devices are NOT loaded on mount to prevent UI freeze
  // Device enumeration can block waiting for macOS permissions (audio/screen recording)
  // Instead, devices are loaded on-demand when user opens device selector modals
  // This ensures the Sessions zone loads instantly without hanging

  // Lazy load devices with timeout protection (called by SessionsTopBar when needed)
  // NOTE: This can be called with forceReload=true to bypass cache after permission changes
  const loadDevices = useCallback(async (forceReload = false) => {
    // Check if cache is still valid (5-minute TTL)
    const now = Date.now();
    const cacheAge = devicesCacheTimestamp ? now - devicesCacheTimestamp : Infinity;
    const isCacheValid = cacheAge < DEVICE_CACHE_TTL_MS;

    if (!forceReload && isCacheValid && (audioDevices.length > 0 || displays.length > 0 || windows.length > 0 || webcams.length > 0)) {
      console.log(`📱 [SESSIONS ZONE] Using cached devices (age: ${Math.round(cacheAge / 1000)}s / ${DEVICE_CACHE_TTL_MS / 1000}s TTL)`);
      return; // Cache is still valid
    }

    if (loadingDevices) {
      console.log('📱 [SESSIONS ZONE] Device loading already in progress, skipping');
      return; // Already loading
    }

    if (forceReload) {
      console.log('🔄 [SESSIONS ZONE] Force reloading devices (permission change or cache expired)');
    }

    setLoadingDevices(true);
    try {
      console.log('📱 [SESSIONS ZONE] Starting device enumeration (lazy load)...');

      // Check screen recording permission FIRST (required for displays/windows)
      console.log('🔒 [SESSIONS ZONE] Checking screen recording permission...');
      const hasScreenPermission = await checkVideoPermission();
      console.log(`🔒 [SESSIONS ZONE] Screen recording permission: ${hasScreenPermission ? 'GRANTED' : 'DENIED'}`);

      // Timeout wrapper to prevent indefinite hangs
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Device enumeration timed out after 10s')), 10000)
      );

      const result = await Promise.race([
        Promise.all([
          // Audio devices - usually work without special permissions
          getAudioDevices().catch(err => {
            console.warn('⚠️ [SESSIONS ZONE] Audio device enumeration failed:', err);
            toast.error('Failed to load audio devices', {
              description: err.message || 'Check microphone permissions in System Settings'
            });
            return [] as import('../types').AudioDevice[];
          }),

          // Displays - requires screen recording permission
          hasScreenPermission
            ? enumerateDisplays().catch(err => {
                console.warn('⚠️ [SESSIONS ZONE] Display enumeration failed:', err);
                toast.error('Failed to load displays', {
                  description: err.message
                });
                return [] as import('../types').DisplayInfo[];
              })
            : (console.log('⚠️ [SESSIONS ZONE] Skipping display enumeration - no screen recording permission'),
               Promise.resolve([] as import('../types').DisplayInfo[])),

          // Windows - requires screen recording permission
          hasScreenPermission
            ? enumerateWindows().catch(err => {
                console.warn('⚠️ [SESSIONS ZONE] Window enumeration failed:', err);
                toast.error('Failed to load windows', {
                  description: err.message
                });
                return [] as import('../types').WindowInfo[];
              })
            : (console.log('⚠️ [SESSIONS ZONE] Skipping window enumeration - no screen recording permission'),
               Promise.resolve([] as import('../types').WindowInfo[])),

          // Webcams - requires camera permission (will fail gracefully if denied)
          enumerateWebcams().catch(err => {
            console.warn('⚠️ [SESSIONS ZONE] Webcam enumeration failed:', err);
            // Only show error if it's not a permission issue
            if (!err.message?.includes('permission') && !err.message?.includes('authorized')) {
              toast.error('Failed to load webcams', {
                description: 'Check camera permissions in System Settings'
              });
            }
            return [] as import('../types').WebcamInfo[];
          }),
        ]),
        timeoutPromise
      ]).catch(err => {
        console.error('❌ [SESSIONS ZONE] Device loading timeout:', err);
        toast.error('Device loading timed out', {
          description: 'Some devices may not be available'
        });
        return [
          [] as import('../types').AudioDevice[],
          [] as import('../types').DisplayInfo[],
          [] as import('../types').WindowInfo[],
          [] as import('../types').WebcamInfo[]
        ] as [import('../types').AudioDevice[], import('../types').DisplayInfo[], import('../types').WindowInfo[], import('../types').WebcamInfo[]];
      });

      const [audio, disp, wins, cams] = result;
      setAudioDevices(audio);
      setDisplays(disp);
      setWindows(wins);
      setWebcams(cams);
      setDevicesCacheTimestamp(Date.now()); // Update cache timestamp

      // Show permission warning if needed
      if (!hasScreenPermission && (disp.length === 0 || wins.length === 0)) {
        toast.warning('Screen Recording Permission Required', {
          description: 'Grant permission in System Settings to record displays or windows',
          duration: 8000,
        });
      }

      console.log('📱 [SESSIONS ZONE] Devices loaded:', {
        audioCount: audio.length,
        displayCount: disp.length,
        windowCount: wins.length,
        webcamCount: cams.length,
        screenPermission: hasScreenPermission
      });
    } catch (error) {
      console.error('❌ [SESSIONS ZONE] Failed to load devices:', error);
      toast.error('Failed to load recording devices', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      // Set empty arrays so UI doesn't break
      setAudioDevices([]);
      setDisplays([]);
      setWindows([]);
      setWebcams([]);
    } finally {
      setLoadingDevices(false);
    }
  }, [audioDevices.length, displays.length, windows.length, webcams.length, loadingDevices, devicesCacheTimestamp, DEVICE_CACHE_TTL_MS, checkVideoPermission, getAudioDevices, enumerateDisplays, enumerateWindows, enumerateWebcams]);

  // Register session list as scroll container for menu morphing
  useEffect(() => {
    const container = sessionListScrollRef.current;
    if (!container) return;

    registerScrollContainer(container);
    return () => unregisterScrollContainer(container);
  }, [registerScrollContainer, unregisterScrollContainer]);

  // Ref for content container (enables scroll-driven expansion)
  const contentRef = useRef<HTMLDivElement>(null);

  // Ref for main container to apply dynamic top padding
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Ref for stats pill to apply scroll-driven fade animation
  const statsPillRef = useRef<HTMLDivElement>(null);

  // Ref for menu bar wrapper to measure width for responsive compact mode
  // OPTION C: menuBarWrapperRef removed - no longer needed with flexbox layout

  // Ref for hidden measurement element (always in full mode)
  const menuBarMeasurementRef = useRef<HTMLDivElement>(null);

  // State for compact mode - enables icon-only buttons when space is constrained
  const [compactMode, setCompactMode] = useState(false);

  // Get the selected session from state by ID (always fresh, never stale)
  const selectedSessionForDetail = selectedSessionId
    ? sessions.find(s => s.id === selectedSessionId)
    : null;


  // Update prevActiveSessionId state to detect completion transitions
  // Converted from ref-based tracking to state-based for proper React flow
  useEffect(() => {
    setPrevActiveSessionId(activeSessionId ?? null);
  }, [activeSessionId]);

  // Show sessions intro tooltip when user first opens Sessions zone with no sessions
  useEffect(() => {
    if (!uiState.onboarding.featureIntroductions.sessions && sessions.length === 0) {
      const timer = setTimeout(() => setShowSessionsIntro(true), 300);
      return () => clearTimeout(timer);
    }
  }, [uiState.onboarding.featureIntroductions.sessions, sessions.length]);

  // Clean up corrupted sessions on mount (one-time cleanup)
  useEffect(() => {
    const corruptedSessions = sessions.filter(s => {
      if (!s.id || !s.name || !s.startTime) return true;
      const startDate = new Date(s.startTime);
      return isNaN(startDate.getTime());
    });

    if (corruptedSessions.length > 0) {
      console.warn('🧹 Found corrupted sessions, cleaning up:', corruptedSessions.length);
      corruptedSessions.forEach(s => {
        console.warn('🗑️ Deleting corrupted session:', s.id, s);
        deleteSession(s.id );
      });
    }
  }, []); // Only run once on mount
   

  // Get all past sessions, filtering out corrupted ones
  const allPastSessions = useMemo(() => sessions
    .filter(s => {
      // Only include completed and interrupted sessions (both represent past work)
      if (s.status !== 'completed' && s.status !== 'interrupted') return false;

      // Filter out corrupted sessions with invalid data
      if (!s.id || !s.name || !s.startTime) {
        console.warn('⚠️ Filtering out corrupted session:', s.id, 'missing required fields');
        return false;
      }

      // Check if startTime is a valid date
      const startDate = new Date(s.startTime);
      if (isNaN(startDate.getTime())) {
        console.warn('⚠️ Filtering out session with invalid date:', s.id, s.startTime);
        return false;
      }

      return true;
    })
    .sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    ), [sessions]);

  // Extract unique tags for filter options
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    allPastSessions.forEach(s => {
      if (s.tags) {
        s.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }, [allPastSessions]);

  // Extract unique categories
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    allPastSessions.forEach(s => {
      if (s.category) categories.add(s.category);
    });
    return Array.from(categories).sort();
  }, [allPastSessions]);

  // Extract unique sub-categories
  const uniqueSubCategories = useMemo(() => {
    const subCategories = new Set<string>();
    allPastSessions.forEach(s => {
      if (s.subCategory) subCategories.add(s.subCategory);
    });
    return Array.from(subCategories).sort();
  }, [allPastSessions]);

  // Apply filters, search, and sorting
  // Query Engine Integration (Phase 3.3)
  // NOTE: The query engine provides 40x faster queries when indexes are built.
  // For now, we use in-memory filtering, but the query engine can be used like this:
  //
  // const { querySessions } = useSessions();
  // const filters: QueryFilter[] = [];
  //
  // if (selectedFilter && selectedFilter !== 'all') {
  //   filters.push({ field: 'status', operator: '=', value: 'completed' });
  // }
  //
  // const results = await querySessions(
  //   filters,
  //   { field: 'date', direction: 'desc' },
  //   100
  // );
  //
  // This would use the date/status indexes automatically for 40x speedup.

  const filteredSessions = useMemo(() => {
    let filtered = allPastSessions;

    // Apply category filters
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(s =>
        s.category && selectedCategories.includes(s.category)
      );
    }

    // Apply sub-category filters
    if (selectedSubCategories.length > 0) {
      filtered = filtered.filter(s =>
        s.subCategory && selectedSubCategories.includes(s.subCategory)
      );
    }

    // Apply tag filters from dropdown
    if (selectedTags.length > 0) {
      filtered = filtered.filter(s =>
        s.tags && s.tags.some(tag => selectedTags.includes(tag))
      );
    }

    // Apply company filters (using unified relationships)
    if (selectedCompanyIds.length > 0) {
      filtered = filtered.filter(s =>
        s.relationships?.some(rel =>
          rel.targetType === 'company' &&
          selectedCompanyIds.includes(rel.targetId)
        )
      );
    }

    // Apply contact filters (using unified relationships)
    if (selectedContactIds.length > 0) {
      filtered = filtered.filter(s =>
        s.relationships?.some(rel =>
          rel.targetType === 'contact' &&
          selectedContactIds.includes(rel.targetId)
        )
      );
    }

    // Apply old tag filter (for backwards compatibility with tag pills)
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(s => s.tags?.includes(selectedFilter));
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => {
        // Search in basic fields
        const basicMatch = (
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          (s.summary?.narrative || '').toLowerCase().includes(query)
        );

        // Search in screenshot analyses (summary, activity, and key elements)
        const screenshotMatch = s.screenshots?.some(screenshot =>
          screenshot.aiAnalysis?.summary?.toLowerCase().includes(query) ||
          screenshot.aiAnalysis?.detectedActivity?.toLowerCase().includes(query) ||
          screenshot.aiAnalysis?.keyElements?.some(element =>
            element.toLowerCase().includes(query)
          )
        );

        // Search in audio transcriptions
        const audioMatch = s.audioSegments?.some(segment =>
          segment.transcription?.toLowerCase().includes(query)
        );

        return basicMatch || screenshotMatch || audioMatch;
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        case 'date-asc':
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        case 'duration-desc':
          return (b.totalDuration || 0) - (a.totalDuration || 0);
        case 'duration-asc':
          return (a.totalDuration || 0) - (b.totalDuration || 0);
        default:
          return 0;
      }
    });

    return sorted;
  }, [allPastSessions, selectedCategories, selectedSubCategories, selectedTags, selectedCompanyIds, selectedContactIds, selectedFilter, searchQuery, sortBy]);

  // Memoize grouped sessions to avoid re-calculating on every render
  const groupedSessions = useMemo(() => groupSessionsByDate(filteredSessions), [filteredSessions]);

  // Memoize stats to avoid re-calculating on every render
  const stats = useMemo(() => calculateTotalStats(sessions), [sessions]);

  // Auto-select first visible session when navigating to sessions space
  // Respects current sort order - selects whatever session appears first in the list
  useEffect(() => {
    // Don't interfere with session start auto-scroll navigation
    if (shouldAutoScroll) {
      return;
    }

    if (filteredSessions.length > 0) {
      // Check if current selection is valid:
      // - Either it's in the filtered list (completed sessions)
      // - OR it's the active session
      const isActiveSession = selectedSessionId && activeSession && selectedSessionId === activeSession.id;
      const isInFilteredList = selectedSessionId && filteredSessions.some(s => s.id === selectedSessionId);
      const isValid = isActiveSession || isInFilteredList;

      if (!isValid) {
        setSelectedSessionId(filteredSessions[0].id);
      }
    } else if (selectedSessionId && (!activeSession || selectedSessionId !== activeSession.id)) {
      // Only clear selection if it's not the active session
      setSelectedSessionId(null);
    }
  }, [filteredSessions, selectedSessionId, sortBy, activeSession, shouldAutoScroll]);

  /**
   * Auto-navigate to newly completed session detail view
   * Creates a delightful "session saved, here's what you did" experience
   *
   * PACING: Intentionally delayed to let users see the sparkle animation and NEW badge
   */
  useEffect(() => {
    if (shouldAutoNavigate && completedSessionId) {
      console.log('🎯 [Auto-Navigation] Navigating to completed session:', completedSessionId);

      // Increased delay: Let user see the sparkle animation and NEW badge first (2000ms)
      // This gives users time to:
      // - See the session appear in the list (0-500ms)
      // - Notice the sparkle animation and NEW badge (500-2000ms)
      // - Then smoothly transition to the detail view (2000ms)
      const timeoutId = setTimeout(() => {
        setSelectedSessionId(completedSessionId);
        // Expand sidebar if collapsed on mobile (programmatic, not user action)
        if (!isSidebarExpanded && window.innerWidth >= 1024) {
          handleSidebarProgrammatic(true, null);
        }
        clearAutoNavigation();
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [shouldAutoNavigate, completedSessionId, clearAutoNavigation, isSidebarExpanded]);

  /**
   * Auto-scroll to active session view when a new session starts
   * Creates a delightful "countdown finished, now you're recording" experience
   *
   * PACING: Immediate - user just saw the countdown, now show them the active session
   */
  useEffect(() => {
    console.log('🔍 [Auto-Scroll Effect] Effect fired:', {
      shouldAutoScroll,
      startedSessionId,
      activeSessionId,
      selectedSessionId
    });

    if (shouldAutoScroll && startedSessionId) {
      console.log('🎯 [Auto-Scroll] Navigating to live session:', startedSessionId);

      // Scroll left panel to top to show live session card
      sessionListScrollRef.current?.scrollTo({
        top: 0,
        behavior: 'smooth'
      });

      // Select the active session to show ActiveSessionView on right panel
      console.log('🎯 [Auto-Scroll] Selecting active session (was:', selectedSessionId, ')');
      setSelectedSessionId(startedSessionId);

      // Collapse sidebar on smaller screens to give more room for active session (programmatic)
      if (isSidebarExpanded && window.innerWidth < 1280) {
        handleSidebarProgrammatic(false, 'auto');
      }

      clearAutoScroll();
    }
  }, [shouldAutoScroll, startedSessionId, clearAutoScroll, isSidebarExpanded]);

  /**
   * Handle screenshot capture callback
   * NOTE: Previously used activeSessionIdRef and stateRef to avoid stale closures.
   * Now uses activeSession from context which provides fresh state automatically.
   * This callback will re-create when activeSession changes, which is correct behavior.
   */
  // Store activeSession in a ref so the callback can always get the fresh value
  const activeSessionRef = useRef(activeSession);
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const handleScreenshotCaptured = useCallback(async (screenshot: SessionScreenshot) => {
    console.log('📸 Screenshot captured, starting AI analysis...', screenshot.id);

    // Add screenshot to session (Phase 1 API - no sessionId needed)
    await addScreenshot(screenshot);

    // Get fresh activeSession from ref (not from closure)
    const currentSession = activeSessionRef.current;

    // Trigger AI analysis if enabled
    if (currentSession?.autoAnalysis) {
      try {
        // Update status to 'analyzing'
        updateScreenshotAnalysis(screenshot.id, undefined, 'analyzing');

        // Load the screenshot attachment from storage (Phase 4)
        console.log('📷 Loading screenshot attachment:', screenshot.attachmentId);
        const caStorage = await getCAStorage();
        const identifier = screenshot.hash || screenshot.attachmentId;
        const attachment = await caStorage.loadAttachment(identifier);

        if (!attachment || !attachment.base64) {
          throw new Error('Screenshot attachment not found or has no image data');
        }

        const screenshotData = attachment.base64;
        const mimeType = attachment.mimeType || 'image/jpeg';
        console.log('✅ Screenshot loaded:', {
          size: screenshotData.length,
          mimeType
        });

        // Analyze with AI
        const analysis = await sessionsAgentService.analyzeScreenshot(
          screenshot,
          currentSession,
          screenshotData,
          mimeType
        );

        // Update with analysis results
        updateScreenshotAnalysis(screenshot.id, analysis, 'complete');

        console.log('✅ Screenshot analysis complete');

        // Emit event for Live Session Intelligence
        LiveSessionEventEmitter.emitScreenshotAnalyzed(currentSession.id, screenshot);

        // Feed AI curiosity score back to adaptive scheduler (if active)
        if (analysis && analysis.curiosity !== undefined) {
          updateCuriosityScore(analysis.curiosity);
          console.log(`🧠 [ADAPTIVE] Curiosity score updated: ${analysis.curiosity.toFixed(1)}`);
        }

        // Auto-create lightweight entities from detected entities (topics, companies, contacts)
        // NOTE: We do NOT auto-create notes/tasks - those require user confirmation
        if (analysis && analysis.detectedEntities) {
          const { topics, companies, contacts } = analysis.detectedEntities;

          // Create topics (subjects/projects/concepts)
          topics.forEach(topic => {
            // Check if topic already exists (fuzzy match)
            const existing = entitiesState.topics.find(t =>
              t.name.toLowerCase() === topic.name.toLowerCase()
            );
            if (!existing && topic.confidence >= 0.5) {
              console.log(`🏷️ [SESSION] Auto-creating topic: ${topic.name} (confidence: ${topic.confidence.toFixed(2)})`);
              addTopic({
                id: `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: topic.name,
                noteCount: 0,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
              });
            }
          });

          // Create companies (organizations)
          companies.forEach(company => {
            const existing = entitiesState.companies.find(c =>
              c.name.toLowerCase() === company.name.toLowerCase()
            );
            if (!existing && company.confidence >= 0.5) {
              console.log(`🏢 [SESSION] Auto-creating company: ${company.name} (confidence: ${company.confidence.toFixed(2)})`);
              addCompany({
                id: `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: company.name,
                noteCount: 0,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
              });
            }
          });

          // Create contacts (people)
          contacts.forEach(contact => {
            const existing = entitiesState.contacts.find(c =>
              c.name.toLowerCase() === contact.name.toLowerCase()
            );
            if (!existing && contact.confidence >= 0.5) {
              console.log(`👤 [SESSION] Auto-creating contact: ${contact.name} (confidence: ${contact.confidence.toFixed(2)})`);
              addContact({
                id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: contact.name,
                noteCount: 0,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
              });
            }
          });
        }
      } catch (error) {
        console.error('❌ Screenshot analysis failed:', error);
        updateScreenshotAnalysis(
          screenshot.id,
          undefined,
          'error',
          error instanceof Error ? error.message : 'Analysis failed'
        );
      }
    }
  }, [addScreenshot, updateScreenshotAnalysis, updateCuriosityScore]);

  /**
   * Handle audio segment processed callback
   * NOTE: Previously used activeSessionIdRef to avoid stale closures.
   * Now uses activeSession from context which provides fresh state automatically.
   * This callback will re-create when activeSession changes, which is correct behavior.
   */
  const handleAudioSegmentProcessed = useCallback(async (segment: SessionAudioSegment) => {
    console.log('🎤 Audio segment processed:', segment.id);

    // Get current active session from context (always fresh, no stale closure)
    if (!activeSession) return;

    // Add audio segment to session (Phase 1 API - no sessionId needed)
    addAudioSegment(segment);

    console.log('✅ Audio segment added to session');
  }, [activeSession, addAudioSegment]);

  /**
   * Manage screenshot capture and audio recording lifecycle
   */
  // Minimal observer for UI state only - machine handles all service orchestration
  useEffect(() => {
    if (!activeSession) {
      console.log('⛔ [SESSIONS ZONE] No active session');
      return;
    }

    console.log(`[SESSIONS ZONE] Active session status: ${activeSession.status}`);

    // Session agent cleanup on completion
    if (activeSession.status === 'completed') {
      const cleanupTimer = setTimeout(() => {
        console.log('🧹 [SESSIONS ZONE] Clearing session context');
        sessionsAgentService.clearSessionContext(activeSession.id);
      }, 5000);

      return () => clearTimeout(cleanupTimer);
    }
  }, [activeSession?.id, activeSession?.status]);

  /**
   * Detect session completion transition and stop video recording
   *
   * This is the SINGLE SOURCE OF TRUTH for video stopping to avoid race conditions.
   * It catches the moment when a session completes and stops the video exactly once.
   */
  useEffect(() => {
    const currentSessionId = activeSessionId;

    console.log('🎬 [VIDEO COMPLETION] Checking for session completion transition');
    console.log('🎬 [VIDEO COMPLETION] prevSessionId:', prevActiveSessionId, 'currentSessionId:', currentSessionId);

    // Detect session completion: had active session, now undefined
    if (prevActiveSessionId && !currentSessionId) {
      const completedSession = sessions.find(s => s.id === prevActiveSessionId && s.status === 'completed');

      console.log('🎬 [VIDEO COMPLETION] Detected activeSessionId cleared, looking for completed session:', prevActiveSessionId);
      console.log('🎬 [VIDEO COMPLETION] Found completed session:', completedSession?.id, 'status:', completedSession?.status);

      if (completedSession) {
        console.log('⏹️ [VIDEO COMPLETION] Session completed, stopping video recording...');

        // Check if video was recording for this session
        const activeVideoSessionId = getActiveVideoSessionId();
        console.log('🎬 [VIDEO COMPLETION] activeVideoSessionId:', activeVideoSessionId, 'completedSessionId:', completedSession.id);

        if (activeVideoSessionId === completedSession.id) {
          console.log('⏹️ [VIDEO COMPLETION] Stopping video recording for completed session:', completedSession.id);

          // Stop recording - this is the ONLY place video stopping happens
          stopVideo()
            .then(async (sessionVideo) => {
              if (sessionVideo) {
                console.log('✅ [VIDEO COMPLETION] Video recording stopped, sessionVideo:', sessionVideo);

                // Get fresh session from state (not from closure) to avoid staleness
                const freshSession = sessions.find(s => s.id === completedSession.id);
                if (!freshSession) {
                  console.error('❌ [VIDEO COMPLETION] Session not found in state after video stop:', completedSession.id);
                  return;
                }

                // Update session with video data (Phase 1 API - id and updates)
                console.log('✅ [VIDEO COMPLETION] Updating session with video data for session:', freshSession.id);
                updateSession(freshSession.id, {
                  video: sessionVideo
                });
                console.log('✅ [VIDEO COMPLETION] Session updated with video');

                // Wait for save to complete (critical action triggers immediate save)
                await new Promise(resolve => requestAnimationFrame(resolve));
                console.log('✅ [VIDEO COMPLETION] Save triggered');
              } else {
                console.warn('⚠️ [VIDEO COMPLETION] stopRecording returned null sessionVideo');
              }

              // Reset initialization flag after stopping
              setVideoInitializedSessionId(null);
            })
            .catch(error => {
              console.error('❌ [VIDEO COMPLETION] Failed to stop video recording:', error);
              // Reset flag even on error to allow retry in next session
              setVideoInitializedSessionId(null);
            });
        } else {
          console.log('ℹ️ [VIDEO COMPLETION] No video to stop - activeVideoSessionId:', activeVideoSessionId, 'completedSession:', completedSession.id);
          // Reset flag since this session is ending
          setVideoInitializedSessionId(null);
        }
      }
    }

    // Update prev state for next render
    setPrevActiveSessionId(currentSessionId ?? null);
  }, [activeSessionId, sessions, updateSession, prevActiveSessionId, getActiveVideoSessionId, stopVideo]);

  /**
   * TASK 11: Listen for media processing events to show/hide processing screen
   * MEMORY LEAK FIX: Use functional setState to avoid dependency on processingSessionId
   */
  useEffect(() => {
    // Subscribe to processing start event (emitted from ActiveSessionContext)
    const unsubscribeProgress = eventBus.on('media-processing-progress', (event: any) => {
      console.log('[SessionsZone] Media processing progress:', event);
      // Show processing screen for this session (functional setState)
      setProcessingSessionId(prev => {
        if (!prev || prev !== event.sessionId) {
          return event.sessionId;
        }
        return prev;
      });
    });

    // Subscribe to complete event (hide processing screen)
    const unsubscribeComplete = eventBus.on('media-processing-complete', (event: any) => {
      console.log('[SessionsZone] Media processing complete:', event);
      // Hide processing screen after a delay (let user see "Complete!" state)
      setTimeout(() => {
        setProcessingSessionId(null);
      }, 2000);
    });

    // Subscribe to error event (hide processing screen)
    const unsubscribeError = eventBus.on('media-processing-error', (event: any) => {
      console.error('[SessionsZone] Media processing error:', event);
      // Hide processing screen on error
      setProcessingSessionId(null);
    });

    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeError();
    };
  }, []); // Stable - no dependencies, prevents listener accumulation

  /**
   * Listen for menu bar session control events
   */
  useEffect(() => {
    let unlistenPause: (() => void) | undefined;
    let unlistenResume: (() => void) | undefined;
    let unlistenStop: (() => void) | undefined;
    let unlistenQuickCapture: (() => void) | undefined;

    const setupListeners = async () => {
      // Pause session from menu bar
      unlistenPause = await listen('menubar-pause-session', () => {
        console.log('📊 [MENU BAR] Pause session requested');
        if (activeSession) {
          pauseSession();
        }
      });

      // Resume session from menu bar
      unlistenResume = await listen('menubar-resume-session', () => {
        console.log('📊 [MENU BAR] Resume session requested');
        if (activeSession) {
          resumeSession();
        }
      });

      // Stop session from menu bar
      unlistenStop = await listen('menubar-stop-session', () => {
        console.log('📊 [MENU BAR] Stop session requested');
        if (activeSession) {
          handleEndSession(activeSession.id);
        }
      });

      // Quick capture screenshot (CMD+Shift+Space)
      unlistenQuickCapture = await listen<string>('quick-capture-screenshot', (event) => {
        console.log('📸 [QUICK CAPTURE] Screenshot captured');
        if (!activeSession) {
          console.warn('⚠️ [QUICK CAPTURE] No active session - ignoring screenshot');
          return;
        }

        // Process screenshot immediately
        (async () => {
          try {
            const base64Data = event.payload;
            const timestamp = new Date().toISOString();
            const screenshotId = `screenshot-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const attachmentId = `attachment-${Date.now()}-${Math.random().toString(36).substring(7)}`;

            // Create screenshot record (will be processed by existing handleScreenshotCaptured logic)
            const screenshot: SessionScreenshot = {
              id: screenshotId,
              sessionId: activeSession.id,
              timestamp,
              attachmentId,
              analysisStatus: 'pending',
              flagged: false,
            };

            // Save screenshot to attachmentStorage
            const attachment: any = {
              id: attachmentId,
              type: 'screenshot' as const,
              name: `Quick Capture ${new Date().toLocaleTimeString()}.png`,
              mimeType: 'image/png',
              size: base64Data.length,
              createdAt: timestamp,
              base64: base64Data,
            };

            // Phase 4: Save to CA storage
            const caStorage = await getCAStorage();
            const hash = await caStorage.saveAttachment(attachment);
            attachment.hash = hash;
            await caStorage.addReference(hash, activeSession.id, attachment.id);

            // Trigger the regular screenshot handler
            handleScreenshotCaptured(screenshot);

            console.log('✅ [QUICK CAPTURE] Screenshot added to session');
          } catch (error) {
            console.error('❌ [QUICK CAPTURE] Failed to add screenshot:', error);
          }
        })();
      });
    };

    setupListeners();

    // Cleanup listeners on unmount
    return () => {
      if (unlistenPause) unlistenPause();
      if (unlistenResume) unlistenResume();
      if (unlistenStop) unlistenStop();
      if (unlistenQuickCapture) unlistenQuickCapture();
    };
  }, [activeSession, pauseSession, resumeSession, endSession, handleScreenshotCaptured]);

  /**
   * Scroll-driven content expansion
   * Reduces top padding as the menu bar scrolls away to fill the space naturally
   */
  useEffect(() => {
    if (!mainContainerRef.current) return;

    const container = mainContainerRef.current;

    // Initial padding is pt-24 (96px)
    const initialPadding = 96;
    const minPadding = 20;

    // Delay threshold: content stays at full padding until menu starts morphing
    const delayThreshold = 150;

    if (scrollY < delayThreshold) {
      // Keep full padding until menu starts morphing
      container.style.paddingTop = `${initialPadding}px`;
    } else {
      // After threshold, reduce padding over 150px range (150-300px total scroll)
      const delayedScrollY = scrollY - delayThreshold;
      const scrollRange = 150;

      // Calculate reduced padding based on delayed scroll
      const paddingReduction = Math.min(delayedScrollY, scrollRange) / scrollRange * (initialPadding - minPadding);
      const newPadding = initialPadding - paddingReduction;

      container.style.paddingTop = `${newPadding}px`;
    }
  }, [scrollY]);

  /**
   * Stats pill fade animation - SYNCHRONIZED with menu morph animation
   * Uses viewport-relative thresholds matching MenuMorphPill for coherent motion
   * Fades out gracefully as menu morphs, creating unified visual flow
   */
  useEffect(() => {
    if (!statsPillRef.current) return;

    const pill = statsPillRef.current;

    // Get viewport-relative thresholds (same calculation as MenuMorphPill)
    const viewportHeight = window.innerHeight;
    const startThreshold = Math.max(viewportHeight * 0.15, 100);
    const transitionRange = Math.max(viewportHeight * 0.12, 100);
    const endThreshold = startThreshold + transitionRange;

    // Stats fades over same range as menu morphing for synchronized motion
    const statsRawProgress = clamp((scrollY - startThreshold) / transitionRange, 0, 1);

    // Opacity fade - NO manual easing, browser handles interpolation smoothly
    const statsOpacity = 1 - statsRawProgress;

    // Subtle scale for refinement - linear is sufficient with CSS transitions
    const statsScale = 1 - (statsRawProgress * 0.03);

    // Progressive blur for depth
    const statsBlur = statsRawProgress * 3;

    pill.style.opacity = String(statsOpacity);
    pill.style.transform = `scale(${statsScale})`;
    pill.style.filter = `blur(${statsBlur}px)`;
    pill.style.transition = 'opacity 0.15s ease-out, transform 0.15s ease-out, filter 0.15s ease-out';
  }, [scrollY]);

  /**
   * Responsive compact mode detection
   * Automatically enables icon-only mode when menu bar would overlap with stats pill
   *
   * CORRECT FIX: Measures the FULL (non-compact) width using a hidden element
   * - Hidden element is always in full mode (compactMode=false)
   * - We measure that stable width and compare against available space
   * - No circular dependency: compact mode doesn't affect the measurement
   * - PHASE 2: Viewport-aware gap threshold for better responsiveness
   */
  useEffect(() => {
    // Viewport-aware compact threshold calculation
    // Smaller screens need less gap, larger screens benefit from more breathing room
    const getCompactThresholds = () => {
      const isMobile = window.innerWidth < 1024;
      const base = isMobile ? 20 : 40;
      return {
        compact: base,
        expand: base + 20  // Hysteresis band to prevent flickering
      };
    };

    const checkOverlap = () => {
      const measurementElement = menuBarMeasurementRef.current;
      const statsPill = statsPillRef.current;

      if (!measurementElement || !statsPill) {
        return;
      }

      // Measure the FULL width from the hidden element (always in full mode)
      const fullWidth = measurementElement.offsetWidth;

      // Get the visible container's position (use measurement element)
      const visibleRect = measurementElement.getBoundingClientRect();
      const statsPillRect = statsPill.getBoundingClientRect();

      // Guard against hidden elements
      if (fullWidth === 0 || statsPillRect.width === 0) {
        return;
      }

      // Calculate where the menu bar WOULD end if it were in full mode
      const fullModeRight = visibleRect.left + fullWidth;

      // Calculate the gap
      const gap = statsPillRect.left - fullModeRight;

      // Get viewport-aware thresholds (adapts to screen size)
      const thresholds = getCompactThresholds();

      let needsCompact = compactMode; // Default to current state

      if (compactMode) {
        // Currently compact - only expand if gap is comfortably large
        if (gap > thresholds.expand) {
          needsCompact = false;
        }
      } else {
        // Currently expanded - only compact if gap is too small
        if (gap < thresholds.compact) {
          needsCompact = true;
        }
      }

      // Only update if changed
      setCompactMode(needsCompact);
    };

    // Debounce to prevent excessive checks
    let timeoutId: number | undefined;
    const debouncedCheck = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(checkOverlap, 100);
    };

    // Check on mount
    checkOverlap();

    // Only observe window resize - menu bar size changes don't matter
    window.addEventListener('resize', debouncedCheck);

    return () => {
      window.removeEventListener('resize', debouncedCheck);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeSession, scrollY]); // Re-check when active session changes

  /**
   * Auto-generate session metadata with intelligent throttling
   * - Triggers every 5 screenshots OR 10 minutes (whichever comes first)
   * - Prevents race conditions by using state from Redux store
   */
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active') {
      return;
    }

    const screenshots = activeSession.screenshots || [];
    const analyzedScreenshots = screenshots.filter(s => s.analysisStatus === 'complete');
    const audioSegments = activeSession.audioSegments || [];

    // Don't generate if no data (need either screenshots OR audio)
    if (analyzedScreenshots.length === 0 && audioSegments.length === 0) {
      return;
    }

    // Throttling logic: Update metadata every 5 screenshots/audio OR 10 minutes
    const DATA_THRESHOLD = 5;
    const TIME_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

    const totalDataPoints = analyzedScreenshots.length + audioSegments.length;
    const shouldUpdateByCount = totalDataPoints % DATA_THRESHOLD === 0;
    const timeSinceLastUpdate = lastMetadataUpdate
      ? Date.now() - new Date(lastMetadataUpdate).getTime()
      : TIME_THRESHOLD_MS + 1; // Force update on first data point
    const shouldUpdateByTime = timeSinceLastUpdate >= TIME_THRESHOLD_MS;

    if (!shouldUpdateByCount && !shouldUpdateByTime) {
      return;
    }

    // Check if we've already updated for this count to prevent duplicate calls
    const expectedUpdateKey = `${activeSession.id}-${totalDataPoints}`;
    if (lastMetadataUpdate && lastMetadataUpdate.startsWith(expectedUpdateKey)) {
      return;
    }

    // Generate metadata
    const generateMetadata = async () => {
      try {
        console.log('📝 Generating evolving session metadata...', {
          screenshotCount: analyzedScreenshots.length,
          audioCount: audioSegments.length,
          totalDataPoints,
          timeSinceLastUpdate: Math.round(timeSinceLastUpdate / 1000 / 60) + 'm',
          trigger: shouldUpdateByCount ? 'data-count' : 'time-threshold'
        });

        const metadata = await sessionsAgentService.generateSessionMetadata(
          activeSession,
          screenshots,
          activeSession.audioSegments || []
        );

        // Get fresh session data to avoid overwriting concurrent updates
        const freshSession = sessions.find(s => s.id === activeSession.id);
        if (!freshSession) {
          console.warn('⚠️ Session no longer exists, skipping metadata update');
          return;
        }

        updateSession(freshSession.id, {
          name: metadata.title,
          description: metadata.description,
        });

        // Store update key with timestamp to prevent duplicates
        setLastMetadataUpdate(`${expectedUpdateKey}-${new Date().toISOString()}`);
        setMetadataError(null); // Clear any previous errors

        console.log('✅ Session metadata updated', {
          title: metadata.title,
          description: metadata.description?.substring(0, 50) + '...'
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Failed to update session metadata:', error);
        setMetadataError(errorMessage);
      }
    };

    generateMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeSession?.id,
    activeSession?.status,
    activeSession?.screenshots?.length,
    activeSession?.audioSegments?.length,
    // DO NOT add filter() here - it creates new array every render causing infinite loop
  ]);

  /**
   * Session synthesis - runs every 1 minute for active sessions
   * Also runs once when a session is completed
   */
  useEffect(() => {
    // Find the session to synthesize: active session OR most recently completed
    const sessionToSynthesize = activeSession ||
      sessions
        .filter(s => s.status === 'completed')
        .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime())[0];

    if (!sessionToSynthesize) {
      return;
    }

    // FIX: Don't auto-synthesize if session already has enrichment summary
    // OR if it already has a valid basic summary (with correct structure)
    if (sessionToSynthesize.enrichmentStatus?.status === 'completed') {
      return;
    }

    // Check if session has a valid summary with the correct structure
    // (If it has the old structure with wrong field names, regenerate it)
    const hasValidSummary = sessionToSynthesize.summary &&
                           'narrative' in sessionToSynthesize.summary;
    if (hasValidSummary) {
      return;
    }

    const screenshots = sessionToSynthesize.screenshots || [];
    const analyzedScreenshots = screenshots.filter(s => s.analysisStatus === 'complete');
    const audioSegments = sessionToSynthesize.audioSegments || [];

    // Need at least 2 analyzed screenshots OR audio segments to synthesize
    // This allows audio-only sessions to generate summaries
    const hasEnoughData = analyzedScreenshots.length >= 2 || audioSegments.length > 0;

    if (!hasEnoughData) {
      return;
    }

    // For active sessions: Run every 1 minute
    // For paused/completed sessions: Run once
    const SYNTHESIS_INTERVAL_MS = 1 * 60 * 1000; // 1 minute

    const shouldRunSynthesis = (() => {
      // Always run for paused/completed sessions (if not already done)
      if (sessionToSynthesize.status !== 'active') {
        const alreadySynthesized = lastSynthesisUpdate?.startsWith(`${sessionToSynthesize.id}-${sessionToSynthesize.status}`);
        return !alreadySynthesized;
      }

      // For active sessions: Check time threshold
      const timeSinceLastSynthesis = lastSynthesisUpdate
        ? Date.now() - new Date(lastSynthesisUpdate).getTime()
        : SYNTHESIS_INTERVAL_MS + 1; // Force synthesis on first run

      return timeSinceLastSynthesis >= SYNTHESIS_INTERVAL_MS;
    })();

    if (!shouldRunSynthesis) {
      return;
    }

    // Generate synthesis
    const generateSynthesis = async () => {
      try {
        console.log('🔄 Synthesizing session summary...', {
          sessionId: sessionToSynthesize.id,
          screenshotCount: analyzedScreenshots.length,
          audioCount: audioSegments.length,
          status: sessionToSynthesize.status
        });

        // Use backend service (no API key needed)
        const summary = await sessionsAgentService.generateSessionSummary(
          sessionToSynthesize,
          analyzedScreenshots,
          audioSegments
        );

        // Get fresh session data from state to avoid overwriting concurrent updates
        const freshSession = sessions.find(s => s.id === sessionToSynthesize.id);
        if (!freshSession) {
          console.warn('⚠️ Session no longer exists, skipping summary update');
          return;
        }

        updateSession(freshSession.id, {
          summary,
        });

        // Store update key with status to prevent duplicates
        const updateKey = sessionToSynthesize.status === 'active'
          ? new Date().toISOString()
          : `${sessionToSynthesize.id}-${sessionToSynthesize.status}`;
        setLastSynthesisUpdate(updateKey);
        setSynthesisError(null);

        console.log('✅ Session summary synthesized', {
          achievements: summary.achievements?.length || 0,
          blockers: summary.blockers?.length || 0,
          tasks: summary.recommendedTasks?.length || 0,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Failed to synthesize session summary:', error);
        setSynthesisError(errorMessage);
      }
    };

    generateSynthesis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeSession?.id,
    activeSession?.status,
    activeSession?.screenshots?.length,
    activeSession?.audioSegments?.length,
  ]);

  /**
   * Automatic transition to summary view when session completes
   * Detects when active session transitions to completed and selects it for viewing
   */
  useEffect(() => {
    // When there's no active session but there was one before, it completed
    if (!activeSession && prevActiveSessionId) {
      const completedSession = sessions.find(s => s.id === prevActiveSessionId);

      if (completedSession && completedSession.status === 'completed') {
        console.log('🎬 Session completed, transitioning to summary view:', prevActiveSessionId);
        setSelectedSessionId(completedSession.id);
      }
    }
  }, [activeSession, sessions, prevActiveSessionId]);

  // Helper to open System Settings for permissions
  const openSystemSettings = useCallback(async (permission: string) => {
    try {
      await invoke('open_system_preferences', { pane: permission });
    } catch (error) {
      console.error('Failed to open System Settings:', error);
      toast.error('Could not open System Settings', {
        description: 'Please open System Settings manually and grant the required permission.'
      });
    }
  }, []);

  const handleStartSession = (sessionData: Partial<Session>) => {
    startSession({
      name: sessionData.name || 'Untitled Session',
      description: sessionData.description || '',
      status: 'active',
      screenshotInterval: sessionData.screenshotInterval || 2,
      enableScreenshots: sessionData.enableScreenshots ?? true,
      autoAnalysis: sessionData.autoAnalysis ?? true,
      tags: sessionData.tags || [],
      activityType: sessionData.activityType,
      audioRecording: sessionData.audioRecording ?? false,
      audioMode: sessionData.audioMode || 'off',
      audioReviewCompleted: false,
      videoRecording: sessionData.videoRecording ?? false,
      audioConfig: sessionData.audioConfig, // PASS THROUGH AUDIO CONFIG
      videoConfig: sessionData.videoConfig, // PASS THROUGH VIDEO CONFIG
    }, handleScreenshotCaptured); // Pass screenshot callback for AI analysis
  };

  // Session settings state (for top controls)
  const [lastSettings, setLastSettings] = useState<LastSessionSettings>(() => loadLastSessionSettings());

  // Quick start handler for top control - with delightful countdown
  const handleQuickStart = async () => {
    saveLastSessionSettings(lastSettings);

    await startSessionWithCountdown({
      name: 'Quick Session',
      description: 'Started quickly without description',
      status: 'active',
      relationships: [],
      tags: [],
      screenshotInterval: lastSettings.screenshotInterval,
      enableScreenshots: lastSettings.enableScreenshots,
      autoAnalysis: lastSettings.autoAnalysis,
      audioRecording: lastSettings.audioRecording,
      audioMode: lastSettings.audioRecording ? 'transcription' : 'off',
      audioReviewCompleted: false,
      videoRecording: lastSettings.videoRecording,
    }, handleScreenshotCaptured); // Pass screenshot callback for AI analysis
  };

  // Wrapper to accept Partial<Session> from modal and provide all required defaults
  const handleStartSessionFromModal = useCallback(async (config: Partial<Session>) => {
    const audioRecording = config.audioRecording ?? lastSettings.audioRecording;
    const sessionData = {
      name: config.name || `Session ${new Date().toLocaleString()}`,
      description: config.description || '',
      status: 'active' as const,
      relationships: [],
      tags: config.tags || [],
      screenshotInterval: config.screenshotInterval ?? lastSettings.screenshotInterval,
      enableScreenshots: config.enableScreenshots ?? lastSettings.enableScreenshots,
      autoAnalysis: config.autoAnalysis ?? lastSettings.autoAnalysis,
      audioRecording,
      audioMode: audioRecording ? ('transcription' as const) : ('off' as const),
      audioReviewCompleted: false,
      videoRecording: config.videoRecording ?? lastSettings.videoRecording,
      ...(config.audioConfig && { audioConfig: config.audioConfig }),
      ...(config.videoConfig && { videoConfig: config.videoConfig }),
    };

    // Save settings for next time
    saveLastSessionSettings({
      screenshotInterval: sessionData.screenshotInterval,
      enableScreenshots: sessionData.enableScreenshots,
      autoAnalysis: sessionData.autoAnalysis,
      audioRecording: sessionData.audioRecording,
      videoRecording: sessionData.videoRecording,
      audioSourceType: sessionData.audioConfig?.sourceType || 'microphone',
    });

    await startSessionWithCountdown(sessionData, handleScreenshotCaptured);
  }, [lastSettings, startSessionWithCountdown, handleScreenshotCaptured]);

  // Update settings handlers
  const updateScreenshots = (enabled: boolean) => {
    // Update last settings for next session
    const newSettings = { ...lastSettings, enableScreenshots: enabled };
    setLastSettings(newSettings);
    saveLastSessionSettings(newSettings);

    // If session is active, update the running session too
    if (activeSession) {
      updateActiveSession({ enableScreenshots: enabled });

      // Show user feedback
      addNotification({
        type: 'info',
        title: 'Screenshot Settings Updated',
        message: enabled ? 'Screenshots enabled for active session' : 'Screenshots disabled for active session',
      });
    }
  };

  const updateAudio = (enabled: boolean) => {
    // Update last settings for next session
    const newSettings = { ...lastSettings, audioRecording: enabled };
    setLastSettings(newSettings);
    saveLastSessionSettings(newSettings);

    // If session is active, update the running session too
    if (activeSession) {
      updateActiveSession({ audioRecording: enabled });

      // Show user feedback
      addNotification({
        type: 'info',
        title: 'Audio Settings Updated',
        message: enabled ? 'Audio recording enabled for active session' : 'Audio recording disabled for active session',
      });
    }
  };

  const updateVideo = async (enabled: boolean) => {
    // Update last settings for next session
    const newSettings = { ...lastSettings, videoRecording: enabled };
    setLastSettings(newSettings);
    saveLastSessionSettings(newSettings);

    // If session is active, update the running session too
    if (activeSession) {
      updateActiveSession({ videoRecording: enabled });

      // Show user feedback
      addNotification({
        type: 'info',
        title: 'Video Settings Updated',
        message: enabled ? 'Video recording enabled for active session' : 'Video recording disabled for active session',
      });
    }
  };

  const updateInterval = (interval: number) => {
    // Update last settings for next session
    const newSettings = { ...lastSettings, screenshotInterval: interval };
    setLastSettings(newSettings);
    saveLastSessionSettings(newSettings);

    // If session is active, update the running session too
    if (activeSession) {
      updateActiveSession({ screenshotInterval: interval });

      // Determine interval label for user feedback
      const intervalLabel = interval === -1 ? 'Adaptive (AI-driven)' :
                           interval === 10/60 ? '10 seconds' :
                           interval === 0.5 ? '30 seconds' :
                           interval === 1 ? '1 minute' :
                           interval === 2 ? '2 minutes' :
                           interval === 3 ? '3 minutes' :
                           interval === 5 ? '5 minutes' : `${interval} minutes`;

      // Show user feedback
      addNotification({
        type: 'info',
        title: 'Screenshot Interval Updated',
        message: `Screenshot interval changed to ${intervalLabel}`,
      });
    }
  };

  // PHASE 1 FIX: Handle session selection with smooth scroll reset
  // When user clicks on a different session, smoothly scroll to top of list
  const handleSessionClick = (sessionId: string | null) => {
    // Add smooth scroll to top when session changes
    const scrollContainer = sessionListScrollRef.current;
    if (scrollContainer && sessionId !== selectedSessionId) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setSelectedSessionId(sessionId);
  };

  // Get current settings (from active session if running, otherwise from last settings)
  const currentSettings: LastSessionSettings = activeSession ? {
    enableScreenshots: activeSession.enableScreenshots,
    audioRecording: activeSession.audioRecording,
    videoRecording: activeSession.videoRecording,
    screenshotInterval: activeSession.screenshotInterval,
    autoAnalysis: activeSession.autoAnalysis,
    lastUsed: new Date().toISOString(),
  } : lastSettings;

  return (
    <div className={`h-full w-full relative flex flex-col ${BACKGROUND_GRADIENT.primary}`}>
      {/* Animated gradient overlay */}
      <div className={`absolute inset-0 ${BACKGROUND_GRADIENT.secondary} pointer-events-none`} />

      {/* Sessions Introduction Tooltip */}
      <div className="absolute top-32 left-1/2 -translate-x-1/2 z-[200]">
        <FeatureTooltip
          show={showSessionsIntro}
          onDismiss={() => {
            setShowSessionsIntro(false);
            uiDispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: 'sessions' });
          }}
          position="bottom"
          title="🎥 Welcome to Sessions - Deep Work Tracking"
          message={
            <div>
              <p>Sessions help you understand your work patterns:</p>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>📸 <strong>Screenshots:</strong> Capture your screen at intervals</li>
                <li>🎤 <strong>Audio:</strong> Record and transcribe your thoughts</li>
                <li>📹 <strong>Video:</strong> Full screen recording with AI chapters</li>
                <li>🤖 <strong>AI Analysis:</strong> Insights, blockers, achievements</li>
              </ul>
              <p className="mt-3"><strong>Perfect for:</strong></p>
              <ul className="list-disc ml-4 mt-1 space-y-1">
                <li>Documenting complex work</li>
                <li>Time tracking with context</li>
                <li>Async updates to your team</li>
              </ul>
            </div>
          }
          primaryAction={{
            label: "Explore on my own",
            onClick: () => {},
          }}
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mb-4"></div>
            <p className="text-gray-400">Loading sessions...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-200 mb-2">Failed to Load Sessions</h3>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => refreshSessions()}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Main content with padding */}
      {!loading && !error && (
        <div ref={mainContainerRef} className="relative z-10 flex-1 flex flex-col px-6 pb-6 min-h-0" style={{ paddingTop: '96px' }}>

        {/* Hidden measurement element - always in FULL mode (compactMode=false) */}
        <div ref={menuBarMeasurementRef} style={{ visibility: 'hidden', position: 'absolute', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: -9999 }}>
          <SessionsTopBar
            activeSession={activeSession ?? undefined}
            sessions={sessions}
            allPastSessions={allPastSessions}
            isStarting={isStarting}
            isEnding={isEnding}
            countdown={countdown}
            handleQuickStart={handleQuickStart}
            startSession={handleStartSessionFromModal}
            handleEndSession={handleEndSession}
            pauseSession={pauseSession}
            resumeSession={resumeSession}
            currentSettings={currentSettings}
            updateScreenshots={updateScreenshots}
            updateAudio={updateAudio}
            updateVideo={updateVideo}
            updateInterval={updateInterval}
            updateActiveSession={updateActiveSession}
            sortBy={sortBy}
            onSortChange={setSortBy}
            selectedCategories={selectedCategories}
            selectedSubCategories={selectedSubCategories}
            selectedTags={selectedTags}
            onCategoriesChange={setSelectedCategories}
            onSubCategoriesChange={setSelectedSubCategories}
            onTagsChange={setSelectedTags}
            selectedCompanyIds={selectedCompanyIds}
            selectedContactIds={selectedContactIds}
            onCompanyIdsChange={setSelectedCompanyIds}
            onContactIdsChange={setSelectedContactIds}
            companies={entitiesState.companies}
            contacts={entitiesState.contacts}
            bulkSelectMode={bulkSelectMode}
            selectedSessionIds={selectedSessionIds}
            onBulkSelectModeChange={setBulkSelectMode}
            onSelectedSessionIdsChange={setSelectedSessionIds}
            audioDevices={audioDevices}
            displays={displays}
            windows={windows}
            webcams={webcams}
            loadingDevices={loadingDevices}
            onLoadDevices={loadDevices}
            compactMode={false}
          />
        </div>

        {/* Top Controls Bar with Stats Pill - Side by Side Layout */}
        <motion.div
          className="flex items-center justify-between gap-4 mb-4 relative z-50"
          animate={{ opacity: scrollY < 100 ? 1 : 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div className="bg-white/40 backdrop-blur-2xl rounded-[9999px] border-2 border-white/50 shadow-xl px-4 py-2">
            <SessionsTopBar
                activeSession={activeSession ?? undefined}
                sessions={sessions}
                allPastSessions={allPastSessions}
                isStarting={isStarting}
                isEnding={isEnding}
                countdown={countdown}
                handleQuickStart={handleQuickStart}
                startSession={handleStartSessionFromModal}
                handleEndSession={handleEndSession}
                pauseSession={pauseSession}
                resumeSession={resumeSession}
                currentSettings={currentSettings}
                updateScreenshots={updateScreenshots}
                updateAudio={updateAudio}
                updateVideo={updateVideo}
                updateInterval={updateInterval}
                updateActiveSession={updateActiveSession}
                sortBy={sortBy}
                onSortChange={setSortBy}
                selectedCategories={selectedCategories}
                selectedSubCategories={selectedSubCategories}
                selectedTags={selectedTags}
                onCategoriesChange={setSelectedCategories}
                onSubCategoriesChange={setSelectedSubCategories}
                onTagsChange={setSelectedTags}
                selectedCompanyIds={selectedCompanyIds}
                selectedContactIds={selectedContactIds}
                onCompanyIdsChange={setSelectedCompanyIds}
                onContactIdsChange={setSelectedContactIds}
                companies={entitiesState.companies}
                contacts={entitiesState.contacts}
                bulkSelectMode={bulkSelectMode}
                selectedSessionIds={selectedSessionIds}
                onBulkSelectModeChange={setBulkSelectMode}
                onSelectedSessionIdsChange={setSelectedSessionIds}
                audioDevices={audioDevices}
                displays={displays}
                windows={windows}
                webcams={webcams}
                loadingDevices={loadingDevices}
                onLoadDevices={loadDevices}
                compactMode={compactMode}
              />
          </div>

          {/* Stats pill - side-by-side with menu */}
          <SessionsStatsBar ref={statsPillRef} sessions={sessions} />
        </motion.div>

        {/* Dropdown Menu - Shows when MenuButton is toggled while scrolled */}
        {scrollY >= 100 && uiState.zoneMenuPinned && (
          <motion.div
            className="fixed top-20 left-24 z-[100] bg-white/40 backdrop-blur-2xl rounded-[40px] border-2 border-white/50 shadow-2xl ring-1 ring-black/5 px-6 py-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <SessionsTopBar
                activeSession={activeSession ?? undefined}
                sessions={sessions}
                allPastSessions={allPastSessions}
                isStarting={isStarting}
                isEnding={isEnding}
                countdown={countdown}
                handleQuickStart={handleQuickStart}
                startSession={handleStartSessionFromModal}
                handleEndSession={handleEndSession}
                pauseSession={pauseSession}
                resumeSession={resumeSession}
                currentSettings={currentSettings}
                updateScreenshots={updateScreenshots}
                updateAudio={updateAudio}
                updateVideo={updateVideo}
                updateInterval={updateInterval}
                updateActiveSession={updateActiveSession}
                sortBy={sortBy}
                onSortChange={setSortBy}
                selectedCategories={selectedCategories}
                selectedSubCategories={selectedSubCategories}
                selectedTags={selectedTags}
                onCategoriesChange={setSelectedCategories}
                onSubCategoriesChange={setSelectedSubCategories}
                onTagsChange={setSelectedTags}
                selectedCompanyIds={selectedCompanyIds}
                selectedContactIds={selectedContactIds}
                onCompanyIdsChange={setSelectedCompanyIds}
                onContactIdsChange={setSelectedContactIds}
                companies={entitiesState.companies}
                contacts={entitiesState.contacts}
                bulkSelectMode={bulkSelectMode}
                selectedSessionIds={selectedSessionIds}
                onBulkSelectModeChange={setBulkSelectMode}
                onSelectedSessionIdsChange={setSelectedSessionIds}
                audioDevices={audioDevices}
                displays={displays}
                windows={windows}
                webcams={webcams}
                loadingDevices={loadingDevices}
                onLoadDevices={loadDevices}
                compactMode={compactMode}
              />
          </motion.div>
        )}

        {/* Two-Panel Layout */}
        <div ref={contentRef} className="flex-1 flex gap-4 min-h-0 relative mt-4">
          {/* LEFT PANEL - Past Sessions List */}
          <SessionsListPanel
            sessions={sessions}
            allPastSessions={allPastSessions}
            groupedSessions={groupedSessions}
            filteredSessions={filteredSessions}
            activeSession={activeSession ?? null}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            selectedFilter={selectedFilter}
            onSelectedFilterChange={setSelectedFilter}
            selectedCategories={selectedCategories}
            selectedSubCategories={selectedSubCategories}
            selectedTags={selectedTags}
            onRemoveCategory={(category) => setSelectedCategories(selectedCategories.filter(c => c !== category))}
            onRemoveSubCategory={(subCategory) => setSelectedSubCategories(selectedSubCategories.filter(sc => sc !== subCategory))}
            onRemoveTag={(tag) => setSelectedTags(selectedTags.filter(t => t !== tag))}
            onClearAllFilters={() => {
              setSelectedCategories([]);
              setSelectedSubCategories([]);
              setSelectedTags([]);
            }}
            bulkSelectMode={bulkSelectMode}
            selectedSessionIds={selectedSessionIds}
            onSelectAll={() => {
              const newSet = new Set<string>();
              filteredSessions.forEach(s => newSet.add(s.id));
              setSelectedSessionIds(newSet);
            }}
            onDelete={() => {
              if (window.confirm(`Delete ${selectedSessionIds.size} session${selectedSessionIds.size !== 1 ? 's' : ''}? This action cannot be undone.`)) {
                selectedSessionIds.forEach(id => {
                  deleteSession(id);
                });
                addNotification({
                  type: 'success',
                  title: 'Sessions Deleted',
                  message: `${selectedSessionIds.size} session${selectedSessionIds.size !== 1 ? 's' : ''} deleted successfully`,
                });
                setSelectedSessionIds(new Set());
                setBulkSelectMode(false);
              }
            }}
            onCategorize={() => {
              alert('Bulk categorize feature coming soon!');
            }}
            onTag={() => {
              alert('Bulk tag feature coming soon!');
            }}
            onExport={() => {
              alert('Bulk export feature coming soon!');
            }}
            selectedSessionId={selectedSessionId}
            onSessionClick={handleSessionClick}
            onSessionSelect={(id) => {
              const newSet = new Set(selectedSessionIds);
              if (newSet.has(id)) {
                newSet.delete(id);
              } else {
                newSet.add(id);
              }
              setSelectedSessionIds(newSet);
            }}
            isSessionNewlyCompleted={isSessionNewlyCompleted}
            isSidebarExpanded={isSidebarExpanded}
            onSidebarToggle={handleSidebarToggle}
            sessionListScrollRef={sessionListScrollRef as React.RefObject<HTMLDivElement>}
            metadataError={metadataError}
            onDismissMetadataError={() => setMetadataError(null)}
          />
        {/* End of LEFT PANEL */}

        {/* RIGHT PANEL - Selected Session or Active Session */}
        <div className={`flex-1 ${getGlassClasses('strong')} ${getRadiusClass('card')} flex flex-col overflow-hidden`}>
          {selectedSessionForDetail ? (
            // Show selected session detail (can be active or past session)
            selectedSessionForDetail.status === 'active' || selectedSessionForDetail.status === 'paused' ? (
              // Selected session is the active one - show ActiveSessionView
              <Suspense fallback={
                <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-xl rounded-[24px]">
                  <LoadingSpinner size="lg" message="Loading active session..." colorScheme="ocean" />
                </div>
              }>
                <div className="flex flex-col h-full">
                  {/* ERROR BANNERS - Show at top of active session panel */}
                  {!isEnding && (
                    <div className="p-4 space-y-2">
                      <AnimatePresence mode="popLayout">
                        {recordingState.lastError.screenshots && (
                          <RecordingErrorBanner
                            key="screenshots-error"
                            service="screenshots"
                            error={recordingState.lastError.screenshots}
                            onRetry={() => {
                              clearError('screenshots');
                              if (activeSession) {
                                startScreenshots(activeSession, addScreenshot);
                              }
                            }}
                            onDismiss={() => clearError('screenshots')}
                            onOpenSettings={openSystemSettings}
                          />
                        )}
                        {recordingState.lastError.audio && (
                          <RecordingErrorBanner
                            key="audio-error"
                            service="audio"
                            error={recordingState.lastError.audio}
                            onRetry={() => {
                              clearError('audio');
                              if (activeSession) {
                                startAudio(activeSession, addAudioSegment)
                                  .catch(err => console.error('Retry failed:', err));
                              }
                            }}
                            onDismiss={() => clearError('audio')}
                            onOpenSettings={openSystemSettings}
                          />
                        )}
                        {recordingState.lastError.video && (
                          <RecordingErrorBanner
                            key="video-error"
                            service="video"
                            error={recordingState.lastError.video}
                            onRetry={() => {
                              clearError('video');
                              if (activeSession) {
                                startVideo(activeSession)
                                  .catch(err => console.error('Retry failed:', err));
                              }
                            }}
                            onDismiss={() => clearError('video')}
                            onOpenSettings={openSystemSettings}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Use activeSession directly for fresh data (no 1-second debounce lag) */}
                  <div className="flex-1 overflow-hidden">
                    <ActiveSessionView session={activeSession || selectedSessionForDetail} />
                  </div>
                </div>
              </Suspense>
            ) : (
              // Selected session is a completed past session - show SessionDetailView
              <Suspense fallback={
                <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-xl rounded-[24px]">
                  <LoadingSpinner size="lg" message="Loading session details..." colorScheme="ocean" />
                </div>
              }>
                <SessionDetailView
                  session={selectedSessionForDetail}
                  onClose={() => setSelectedSessionId(null)}
                  onDelete={(sessionId) => {
                    deleteSession(sessionId );
                    setSelectedSessionId(null);
                  }}
                  onAddComment={(screenshotId, comment) => {
                    addScreenshotComment(screenshotId, comment);
                  }}
                  onToggleFlag={(screenshotId) => {
                    toggleScreenshotFlag(screenshotId);
                  }}
                  isSidebarExpanded={isSidebarExpanded}
                  onToggleSidebar={() => handleSidebarToggle(!isSidebarExpanded)}
                />
              </Suspense>
            )
          ) : activeSession ? (
            // No session selected, but there's an active session - show it
            <Suspense fallback={
              <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-xl rounded-[24px]">
                <LoadingSpinner size="lg" message="Loading active session..." colorScheme="ocean" />
              </div>
            }>
              <div className="flex flex-col h-full">
                {/* ERROR BANNERS - Show at top of active session panel */}
                {!isEnding && (
                  <div className="p-4 space-y-2">
                    <AnimatePresence mode="popLayout">
                      {recordingState.lastError.screenshots && (
                        <RecordingErrorBanner
                          key="screenshots-error"
                          service="screenshots"
                          error={recordingState.lastError.screenshots}
                          onRetry={() => {
                            clearError('screenshots');
                            startScreenshots(activeSession, addScreenshot);
                          }}
                          onDismiss={() => clearError('screenshots')}
                          onOpenSettings={openSystemSettings}
                        />
                      )}
                      {recordingState.lastError.audio && (
                        <RecordingErrorBanner
                          key="audio-error"
                          service="audio"
                          error={recordingState.lastError.audio}
                          onRetry={() => {
                            clearError('audio');
                            startAudio(activeSession, addAudioSegment)
                              .catch(err => console.error('Retry failed:', err));
                          }}
                          onDismiss={() => clearError('audio')}
                          onOpenSettings={openSystemSettings}
                        />
                      )}
                      {recordingState.lastError.video && (
                        <RecordingErrorBanner
                          key="video-error"
                          service="video"
                          error={recordingState.lastError.video}
                          onRetry={() => {
                            clearError('video');
                            startVideo(activeSession)
                              .catch(err => console.error('Retry failed:', err));
                          }}
                          onDismiss={() => clearError('video')}
                          onOpenSettings={openSystemSettings}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <div className="flex-1 overflow-hidden">
                  <ActiveSessionView session={activeSession} />
                </div>
              </div>
            </Suspense>
          ) : (
            // Empty state
            <div className="flex items-center justify-center h-full text-center px-12">
              <div>
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Session Selected</h3>
                <p className="text-gray-600">
                  {sessions.length === 0
                    ? 'Start a session to begin tracking your work'
                    : 'Select a session from the list to view its details'}
                </p>
              </div>
            </div>
          )}
        </div>
        {/* End of RIGHT PANEL */}
        </div>
        {/* End of Two-Panel Layout */}
      </div>
      )}

      {/* Subtle toast notification during countdown */}
      {isStarting && countdown !== null && countdown > 0 && (
        <div className={`fixed bottom-6 right-6 ${getToastClasses('info')} animate-in slide-in-from-bottom-4 z-50`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-lg animate-pulse">
              {countdown}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900">Starting session...</span>
              <span className="text-xs text-gray-600">Get ready to capture</span>
            </div>
          </div>
        </div>
      )}

      {/* Enrichment Progress: Rainbow border only (no modal) */}
      {/* The RainbowBorderProgressIndicator on SessionCards is sufficient */}

      {/* TASK 11: Media Processing Screen Overlay */}
      {processingSessionId && (
        <Suspense fallback={null}>
          <SessionProcessingScreen sessionId={processingSessionId} />
        </Suspense>
      )}

    </div>
  );
}

// Active Session View Component




