import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import { useSessions } from '../context/SessionsContext';
import { useUI } from '../context/UIContext';
import { useTasks } from '../context/TasksContext';
import { Play, Pause, Square, Clock, Calendar, Tag, Activity, CheckCircle2, AlertCircle, Target, Lightbulb, Search, FileText, CheckSquare, TrendingUp, Camera, BookOpen, Trash2, Sparkles, Save, Filter, SlidersHorizontal, CheckCheck, Video, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import type { Session, SessionScreenshot, SessionAudioSegment, SessionContextItem } from '../types';
import { screenshotCaptureService } from '../services/screenshotCaptureService';
import { adaptiveScreenshotScheduler } from '../services/adaptiveScreenshotScheduler';
import { audioRecordingService } from '../services/audioRecordingService';
import { videoRecordingService } from '../services/videoRecordingService';
import { videoStorageService } from '../services/videoStorageService';
import { sessionsAgentService } from '../services/sessionsAgentService';
import { attachmentStorage } from '../services/attachmentStorage';
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
import { SessionsFilterMenu } from './sessions/SessionsFilterMenu';
import { SessionListGroup } from './sessions/SessionListGroup';
import { SessionCard } from './sessions/SessionCard';
import { SessionsTopBar } from './sessions/SessionsTopBar';
import { SessionsListPanel } from './sessions/SessionsListPanel';
import { groupSessionsByDate, calculateTotalStats } from '../utils/sessionHelpers';
import { MenuMorphPill } from './MenuMorphPill';

export default function SessionsZone() {
  const { sessions, activeSessionId, startSession, endSession, pauseSession, resumeSession, updateSession, deleteSession, addScreenshot, addAudioSegment, updateScreenshotAnalysis, addScreenshotComment, toggleScreenshotFlag, setActiveSession, addExtractedTask, addExtractedNote, addContextItem } = useSessions();
  const { state: uiState, dispatch: uiDispatch, addNotification } = useUI();
  const { state: tasksState, dispatch: tasksDispatch } = useTasks();
  const { scrollY, registerScrollContainer, unregisterScrollContainer } = useScrollAnimation();
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

  // Sort dropdown state
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Interval dropdown state
  const [showIntervalDropdown, setShowIntervalDropdown] = useState(false);

  // Bulk selection state
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

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

  // Ref to track active session ID for audio chunk listener (avoids stale closures)
  const activeSessionIdRef = useRef<string | null>(activeSessionId);

  // Ref to track previous active session ID for detecting completion transitions
  const prevActiveSessionIdRef = useRef<string | null>(null);

  // Ref to track video recording initialization attempts (prevents duplicate starts)
  const videoRecordingInitializedRef = useRef<string | null>(null);

  // Ref to store latest state (avoids stale closures in callbacks)
  const stateRef = useRef({ sessions });

  // Ref to store audio segment handler (prevents duplicate event listeners)
  const handleAudioSegmentProcessedRef = useRef<((segment: SessionAudioSegment) => void) | null>(null);

  // Ref to track if audio listener is already active (prevents duplicate registration in StrictMode)
  const audioListenerActiveRef = useRef<boolean>(false);

  // Ref for session list scroll container (enables auto-scroll to live session)
  const sessionListScrollRef = useRef<HTMLDivElement>(null);

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
  const menuBarWrapperRef = useRef<HTMLDivElement>(null);

  // Ref for hidden measurement element (always in full mode)
  const menuBarMeasurementRef = useRef<HTMLDivElement>(null);

  // State for compact mode - enables icon-only buttons when space is constrained
  const [compactMode, setCompactMode] = useState(false);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Get the selected session from state by ID (always fresh, never stale)
  const selectedSessionForDetail = selectedSessionId
    ? sessions.find(s => s.id === selectedSessionId)
    : null;

  // Debug logging for right panel rendering decision
  console.log('🖼️ [Right Panel] Render decision:', {
    selectedSessionId,
    selectedSessionForDetail: selectedSessionForDetail?.id,
    selectedSessionForDetailStatus: selectedSessionForDetail?.status,
    activeSessionId,
    activeSession: activeSession?.id,
    activeSessionStatus: activeSession?.status,
    willShow: selectedSessionForDetail ? 'selectedSessionForDetail' : activeSession ? 'activeSession' : 'empty'
  });

  // Update refs on every render (cheap operation, avoids stale closures)
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
    stateRef.current = { sessions };
  }, [activeSessionId, sessions]);

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
  const allPastSessions = sessions
    .filter(s => {
      // Only include completed sessions
      if (s.status !== 'completed') return false;

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
    );

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
  }, [allPastSessions, selectedCategories, selectedSubCategories, selectedTags, selectedFilter, searchQuery, sortBy]);

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
   * Note: Only depends on addScreenshot and updateScreenshotAnalysis to avoid recreating on every session update
   * Uses stateRef to access latest state without causing callback recreation
   */
  const handleScreenshotCaptured = useCallback(async (screenshot: SessionScreenshot) => {
    console.log('📸 Screenshot captured, starting AI analysis...');

    // Get current active session ID from ref (avoids stale closure)
    const currentActiveSessionId = activeSessionIdRef.current;
    if (!currentActiveSessionId) return;

    // Add screenshot to session
    addScreenshot(currentActiveSessionId, screenshot);

    // Get the session from stateRef to check autoAnalysis setting
    const sessionForAnalysis = stateRef.current.sessions.find(s => s.id === currentActiveSessionId);
    if (!sessionForAnalysis) return;

    // Trigger AI analysis if enabled
    if (sessionForAnalysis.autoAnalysis) {
      try {
        // Update status to 'analyzing'
        updateScreenshotAnalysis(screenshot.id, undefined, 'analyzing');

        // Load the screenshot attachment from storage
        console.log('📷 Loading screenshot attachment:', screenshot.attachmentId);
        const attachment = await attachmentStorage.getAttachment(screenshot.attachmentId);

        if (!attachment || !attachment.base64) {
          throw new Error('Screenshot attachment not found or has no image data');
        }

        const screenshotData = attachment.base64;
        const mimeType = attachment.mimeType || 'image/jpeg';
        console.log('✅ Screenshot loaded:', {
          size: screenshotData.length,
          mimeType
        });

        // Analyze with AI (use sessionForAnalysis which has latest state)
        const analysis = await sessionsAgentService.analyzeScreenshot(
          screenshot,
          sessionForAnalysis,
          screenshotData,
          mimeType
        );

        // Update with analysis results
        updateScreenshotAnalysis(screenshot.id, analysis, 'complete');

        console.log('✅ Screenshot analysis complete');

        // Feed AI curiosity score back to adaptive scheduler (if active)
        if (analysis && analysis.curiosity !== undefined && adaptiveScreenshotScheduler.isActive()) {
          adaptiveScreenshotScheduler.updateCuriosityScore(analysis.curiosity);
          console.log(`🧠 [ADAPTIVE] Curiosity score updated: ${analysis.curiosity.toFixed(1)}`);
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
  }, [updateScreenshotAnalysis]);

  /**
   * Handle audio segment processed callback
   * Note: Only depends on addAudioSegment to avoid recreating on every session update
   */
  const handleAudioSegmentProcessed = useCallback(async (segment: SessionAudioSegment) => {
    console.log('🎤 Audio segment processed:', segment.id);

    // Get current active session ID from ref (avoids stale closure)
    const currentActiveSessionId = activeSessionIdRef.current;
    if (!currentActiveSessionId) return;

    // Add audio segment to session
    addAudioSegment(currentActiveSessionId, segment);

    console.log('✅ Audio segment added to session');
  }, [addAudioSegment]);

  // Update ref whenever callback changes
  useEffect(() => {
    handleAudioSegmentProcessedRef.current = handleAudioSegmentProcessed;
  }, [handleAudioSegmentProcessed]);

  /**
   * Manage screenshot capture and audio recording lifecycle
   */
  useEffect(() => {
    console.log('🔵 [SESSIONS ZONE] useEffect triggered');
    console.log('🔵 [SESSIONS ZONE] activeSession:', activeSession?.id, 'status:', activeSession?.status);

    if (!activeSession) {
      // No active session - stop capture and audio
      console.log('⛔ [SESSIONS ZONE] No active session, stopping capture and audio');
      screenshotCaptureService.stopCapture();
      audioRecordingService.stopRecording();
      return;
    }

    if (activeSession.status === 'active') {
      // Active session - start or resume capture
      const isCapturingThisSession = screenshotCaptureService.getActiveSessionId() === activeSession.id;
      const isCurrentlyCapturing = screenshotCaptureService.isCapturing();
      const isAudioRecording = audioRecordingService.isCurrentlyRecording();

      console.log('🔵 [SESSIONS ZONE] Active session detected');
      console.log('🔵 [SESSIONS ZONE] isCapturingThisSession:', isCapturingThisSession);
      console.log('🔵 [SESSIONS ZONE] isCurrentlyCapturing:', isCurrentlyCapturing);
      console.log('🔵 [SESSIONS ZONE] isAudioRecording:', isAudioRecording);

      // Handle screenshot capture based on enableScreenshots setting
      if (activeSession.enableScreenshots) {
        // Only start capture if not already capturing this session, or if we need to restart for settings changes
        // Check if we're already capturing this specific session
        if (!isCurrentlyCapturing || !isCapturingThisSession) {
          console.log('🚀 [SESSIONS ZONE] Starting screenshot capture for session:', activeSession.id);

          // Check permissions before starting (macOS only, non-blocking)
          checkScreenRecordingPermission().then(hasPermission => {
            if (!hasPermission) {
              console.warn('⚠️ Screen recording permission may not be granted');
              showMacOSPermissionInstructions();
            } else {
              console.log('✅ [SESSIONS ZONE] Screen recording permission granted');
            }
          });

          screenshotCaptureService.startCapture(activeSession, handleScreenshotCaptured);
        } else {
          console.log('✅ [SESSIONS ZONE] Already capturing for this session');
        }
      } else {
        // Screenshots are disabled - stop capture if running
        if (isCurrentlyCapturing && isCapturingThisSession) {
          console.log('⏹️ [SESSIONS ZONE] Stopping screenshot capture (disabled by user)');
          screenshotCaptureService.stopCapture();
        } else {
          console.log('⏭️ [SESSIONS ZONE] Screenshot capture disabled for this session (audio-only mode)');
        }
      }

      // Handle audio recording based on audioRecording setting
      if (activeSession.audioRecording) {
        // Audio is enabled
        if (!isAudioRecording) {
          console.log('🚀 [SESSIONS ZONE] Starting audio recording');
          audioRecordingService.startRecording(activeSession, handleAudioSegmentProcessed)
            .catch(error => {
              console.error('❌ [SESSIONS ZONE] Failed to start audio recording:', error);
              // Don't throw - audio failure shouldn't stop the session
            });
        } else {
          console.log('✅ [SESSIONS ZONE] Already recording audio');
        }
      } else {
        // Audio is disabled - stop recording if running
        if (isAudioRecording) {
          console.log('⏹️ [SESSIONS ZONE] Stopping audio recording (disabled by user)');
          audioRecordingService.stopRecording();
        }
      }

      // Handle video recording based on videoRecording setting
      console.log('🎬 [SESSIONS ZONE] Video recording check - videoRecording flag:', activeSession.videoRecording, 'session:', activeSession.id);
      if (activeSession.videoRecording) {
        // Video is enabled - check backend recording status
        const activeVideoSessionId = videoRecordingService.getActiveSessionId();
        const isAlreadyRecordingThisSession = activeVideoSessionId === activeSession.id;
        const hasAttemptedInitialization = videoRecordingInitializedRef.current === activeSession.id;

        console.log('🎬 [SESSIONS ZONE] Video is ENABLED - activeVideoSessionId:', activeVideoSessionId, 'currentSession:', activeSession.id, 'hasAttempted:', hasAttemptedInitialization);

        if (!isAlreadyRecordingThisSession && !hasAttemptedInitialization) {
          // Mark as attempted to prevent duplicate initialization
          videoRecordingInitializedRef.current = activeSession.id;

          // Check backend recording status and forcefully stop any existing recording
          console.log('🎬 [SESSIONS ZONE] Checking backend recording status...');
          videoRecordingService.isCurrentlyRecording()
            .then(isRecording => {
              console.log('🎬 [SESSIONS ZONE] Backend recording status:', isRecording);

              if (isRecording) {
                console.warn('⚠️ [SESSIONS ZONE] Backend has active recording - forcefully stopping before starting new one');
                return videoRecordingService.stopRecording()
                  .catch(err => {
                    console.error('❌ [SESSIONS ZONE] Failed to stop existing recording:', err);
                    // Continue anyway - try to start
                    
                  });
              }
              
            })
            .then(() => {
              // Now start the new recording
              console.log('🎬 [SESSIONS ZONE] Starting video recording for session:', activeSession.id);
              return videoRecordingService.startRecording(activeSession);
            })
            .then(() => {
              console.log('✅ [SESSIONS ZONE] Video recording started successfully for session:', activeSession.id);
            })
            .catch(error => {
              console.error('❌ [SESSIONS ZONE] Failed to start video recording:', error);
              // Reset the flag so user can retry manually if needed
              videoRecordingInitializedRef.current = null;
              // Don't throw - video failure shouldn't stop the session
            });
        } else if (isAlreadyRecordingThisSession) {
          console.log('✅ [SESSIONS ZONE] Already recording video for this session:', activeSession.id);
        } else {
          console.log('ℹ️ [SESSIONS ZONE] Video initialization already attempted for session:', activeSession.id);
        }
      } else {
        // Video is disabled - stop recording if running
        console.log('⚠️ [SESSIONS ZONE] Video is DISABLED for session:', activeSession.id);
        const activeVideoSessionId = videoRecordingService.getActiveSessionId();
        if (activeVideoSessionId === activeSession.id) {
          console.log('⏹️ [SESSIONS ZONE] Stopping video recording (disabled by user)');
          videoRecordingService.stopRecording()
            .catch(error => {
              console.error('❌ [SESSIONS ZONE] Failed to stop video recording:', error);
            });
          // Reset initialization flag when video is disabled
          videoRecordingInitializedRef.current = null;
        } else {
          console.log('ℹ️ [SESSIONS ZONE] No video to stop for this session');
        }
      }
    } else if (activeSession.status === 'paused') {
      // Paused session - pause capture and audio
      console.log('⏸️ [SESSIONS ZONE] Session paused, pausing capture and audio');
      screenshotCaptureService.pauseCapture();
      audioRecordingService.pauseRecording();
    } else if (activeSession.status === 'completed') {
      // Completed session - stop capture and audio, but allow grace period for pending audio
      console.log('⏹️ [SESSIONS ZONE] Session completed, stopping capture');
      screenshotCaptureService.stopCapture();

      // Stop audio recording (Rust backend stops sending new chunks)
      console.log('⏹️ [SESSIONS ZONE] Stopping audio recording (waiting for pending chunks...)');
      audioRecordingService.stopRecording();

      // NOTE: Video stopping is handled by the dedicated useEffect below (VIDEO COMPLETION)
      // to avoid race conditions and duplicate stops. The separate useEffect ensures video
      // is stopped exactly once when the session completes.

      // Wait for pending audio chunks to be processed before cleanup
      // Audio events may still arrive for ~5 seconds after stopping
      const cleanupTimer = setTimeout(() => {
        console.log('🧹 [SESSIONS ZONE] Grace period ended, clearing session context');
        sessionsAgentService.clearSessionContext(activeSession.id);
      }, 5000);

      return () => clearTimeout(cleanupTimer);
    }

    // Cleanup on unmount
    return () => {
      console.log('🔵 [SESSIONS ZONE] useEffect cleanup');
      if (activeSession?.status === 'completed') {
        screenshotCaptureService.stopCapture();
        audioRecordingService.stopRecording();
        // NOTE: Video stopping is handled by dedicated useEffect (VIDEO COMPLETION)
      }
    };
  }, [activeSession?.id, activeSession?.status, activeSession?.audioRecording, activeSession?.videoRecording, activeSession?.enableScreenshots, activeSession?.screenshotInterval, handleScreenshotCaptured, handleAudioSegmentProcessed]);

  /**
   * Detect session completion transition and stop video recording
   *
   * This is the SINGLE SOURCE OF TRUTH for video stopping to avoid race conditions.
   * It catches the moment when a session completes and stops the video exactly once.
   */
  useEffect(() => {
    const prevSessionId = prevActiveSessionIdRef.current;
    const currentSessionId = activeSessionId;

    console.log('🎬 [VIDEO COMPLETION] Checking for session completion transition');
    console.log('🎬 [VIDEO COMPLETION] prevSessionId:', prevSessionId, 'currentSessionId:', currentSessionId);

    // Detect session completion: had active session, now undefined
    if (prevSessionId && !currentSessionId) {
      const completedSession = sessions.find(s => s.id === prevSessionId && s.status === 'completed');

      console.log('🎬 [VIDEO COMPLETION] Detected activeSessionId cleared, looking for completed session:', prevSessionId);
      console.log('🎬 [VIDEO COMPLETION] Found completed session:', completedSession?.id, 'status:', completedSession?.status);

      if (completedSession) {
        console.log('⏹️ [VIDEO COMPLETION] Session completed, stopping video recording...');

        // Check if video was recording for this session
        const activeVideoSessionId = videoRecordingService.getActiveSessionId();
        console.log('🎬 [VIDEO COMPLETION] activeVideoSessionId:', activeVideoSessionId, 'completedSessionId:', completedSession.id);

        if (activeVideoSessionId === completedSession.id) {
          console.log('⏹️ [VIDEO COMPLETION] Stopping video recording for completed session:', completedSession.id);

          // Stop recording - this is the ONLY place video stopping happens
          videoRecordingService.stopRecording()
            .then(async (sessionVideo) => {
              if (sessionVideo) {
                console.log('✅ [VIDEO COMPLETION] Video recording stopped, sessionVideo:', sessionVideo);

                // Get fresh session from state (not from closure) to avoid staleness
                const freshSession = sessions.find(s => s.id === completedSession.id);
                if (!freshSession) {
                  console.error('❌ [VIDEO COMPLETION] Session not found in state after video stop:', completedSession.id);
                  return;
                }

                // Update session with video data
                console.log('✅ [VIDEO COMPLETION] Updating session with video data for session:', freshSession.id);
                updateSession({
                  ...freshSession, // Use fresh session to avoid overwriting concurrent updates
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
              videoRecordingInitializedRef.current = null;
            })
            .catch(error => {
              console.error('❌ [VIDEO COMPLETION] Failed to stop video recording:', error);
              // Reset flag even on error to allow retry in next session
              videoRecordingInitializedRef.current = null;
            });
        } else {
          console.log('ℹ️ [VIDEO COMPLETION] No video to stop - activeVideoSessionId:', activeVideoSessionId, 'completedSession:', completedSession.id);
          // Reset flag since this session is ending
          videoRecordingInitializedRef.current = null;
        }
      }
    }

    // Update prev ref for next render
    prevActiveSessionIdRef.current = currentSessionId ?? null;
  }, [activeSessionId, sessions, updateSession]);

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
          pauseSession(activeSession.id );
        }
      });

      // Resume session from menu bar
      unlistenResume = await listen('menubar-resume-session', () => {
        console.log('📊 [MENU BAR] Resume session requested');
        if (activeSession) {
          resumeSession(activeSession.id );
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
            const attachment = {
              id: attachmentId,
              type: 'screenshot' as const,
              name: `Quick Capture ${new Date().toLocaleTimeString()}.png`,
              mimeType: 'image/png',
              size: base64Data.length,
              createdAt: timestamp,
              base64: base64Data,
            };

            await attachmentStorage.saveAttachment(attachment);

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
   * Listen for audio-chunk events from Rust audio recorder
   * Using refs to prevent duplicate listeners and stale closures
   *
   * CRITICAL FIX: This effect handles the async nature of listen() properly to prevent
   * duplicate listeners in React Strict Mode. The cleanup function ensures that any
   * in-progress setup is canceled and existing listeners are properly removed.
   */
  useEffect(() => {
    let unlistenAudioChunk: (() => void) | undefined;
    let isCancelled = false;

    const setupAudioListener = async () => {
      // Check if listener is already active (prevents duplicate registration)
      if (audioListenerActiveRef.current) {
        console.log('🎤 [AUDIO LISTENER] Already active, skipping duplicate setup');
        return;
      }

      console.log('🎤 [AUDIO LISTENER] Setting up audio-chunk listener');

      // Mark listener as active
      audioListenerActiveRef.current = true;

      const unlistenFn = await listen<{sessionId: string; audioBase64: string; duration: number}>('audio-chunk', async (event) => {
        console.log('🎤 [AUDIO CHUNK] Received audio chunk from Rust');

        const { sessionId, audioBase64, duration } = event.payload;

        // Debug logging
        console.log('🎤 [AUDIO CHUNK] Payload sessionId:', sessionId);
        console.log('🎤 [AUDIO CHUNK] activeSessionIdRef.current:', activeSessionIdRef.current);

        // Only process if this is for the active session (read from ref to avoid stale closure)
        if (!activeSessionIdRef.current || activeSessionIdRef.current !== sessionId) {
          console.warn('⚠️  [AUDIO CHUNK] Received audio for inactive session, ignoring', {
            hasActiveSession: !!activeSessionIdRef.current,
            activeSessionId: activeSessionIdRef.current,
            receivedSessionId: sessionId,
            match: activeSessionIdRef.current === sessionId
          });
          return;
        }

        // Get current handler from ref (prevents stale closure)
        const handler = handleAudioSegmentProcessedRef.current;
        if (!handler) {
          console.warn('⚠️  [AUDIO CHUNK] No handler available, ignoring');
          return;
        }

        // Process the audio chunk through OpenAI and create the segment
        // The audioRecordingService will create the SessionAudioSegment and call our callback
        try {
          await audioRecordingService.processAudioChunk(
            audioBase64,
            duration,
            sessionId,
            handler
          );
        } catch (error) {
          console.error('❌ [AUDIO CHUNK] Failed to process audio chunk:', error);
        }
      });

      // Check if cleanup was called while we were setting up
      if (isCancelled) {
        console.log('🎤 [AUDIO LISTENER] Setup was cancelled, cleaning up immediately');
        unlistenFn();
        return;
      }

      // Store the unlisten function for cleanup
      unlistenAudioChunk = unlistenFn;
      console.log('🎤 [AUDIO LISTENER] Audio-chunk listener registered successfully');
    };

    setupAudioListener();

    // Cleanup listener on unmount or re-render
    return () => {
      console.log('🎤 [AUDIO LISTENER] Cleanup called');
      isCancelled = true;
      if (unlistenAudioChunk) {
        console.log('🎤 [AUDIO LISTENER] Removing audio-chunk listener');
        unlistenAudioChunk();
        unlistenAudioChunk = undefined;
      }
      // Reset the active flag to allow re-registration
      audioListenerActiveRef.current = false;
    };
  }, []); // Empty dependencies - listener is set up once and uses refs for current values

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
   * Stats pill fade animation
   * Fades out independently as menu morphs (50-300px range)
   */
  useEffect(() => {
    if (!statsPillRef.current) return;

    const pill = statsPillRef.current;

    // Stats fades over 50-300px range
    const statsRawProgress = clamp((scrollY - 50) / 250, 0, 1);

    // Opacity fade
    const statsOpacity = 1 - easeOutCubic(statsRawProgress);

    // Subtle scale for refinement
    const statsScaleProgress = easeOutQuart(statsRawProgress);
    const statsScale = 1 - (statsScaleProgress * 0.03);

    // Progressive blur for depth
    const statsBlur = statsRawProgress * 3;

    pill.style.opacity = String(statsOpacity);
    pill.style.transform = `scale(${statsScale})`;
    pill.style.filter = `blur(${statsBlur}px)`;
  }, [scrollY]);

  /**
   * Responsive compact mode detection
   * Automatically enables icon-only mode when menu bar would overlap with stats pill
   *
   * CORRECT FIX: Measures the FULL (non-compact) width using a hidden element
   * - Hidden element is always in full mode (compactMode=false)
   * - We measure that stable width and compare against available space
   * - No circular dependency: compact mode doesn't affect the measurement
   */
  useEffect(() => {
    const checkOverlap = () => {
      const measurementElement = menuBarMeasurementRef.current;
      const statsPill = statsPillRef.current;
      const visibleContainer = menuBarWrapperRef.current;

      if (!measurementElement || !statsPill || !visibleContainer) {
        return;
      }

      // Measure the FULL width from the hidden element (always in full mode)
      const fullWidth = measurementElement.offsetWidth;

      // Get the visible container's position
      const visibleRect = visibleContainer.getBoundingClientRect();
      const statsPillRect = statsPill.getBoundingClientRect();

      // Guard against hidden elements
      if (fullWidth === 0 || statsPillRect.width === 0) {
        return;
      }

      // Calculate where the menu bar WOULD end if it were in full mode
      const fullModeRight = visibleRect.left + fullWidth;

      // Calculate the gap
      const gap = statsPillRect.left - fullModeRight;

      // Simple threshold - no hysteresis needed because we're measuring a stable value
      const REQUIRED_GAP = 40; // Minimum gap between full-width menu bar and stats pill
      const needsCompact = gap < REQUIRED_GAP;

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
  }, [activeSession]); // Re-check when active session changes

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

        updateSession({
          ...freshSession,  // Use fresh data, not stale closure
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

        updateSession({
          ...freshSession,  // Use fresh data, not stale closure
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
    if (!activeSession && prevActiveSessionIdRef.current) {
      const completedSessionId = prevActiveSessionIdRef.current;
      const completedSession = sessions.find(s => s.id === completedSessionId);

      if (completedSession && completedSession.status === 'completed') {
        console.log('🎬 Session completed, transitioning to summary view:', completedSessionId);
        setSelectedSessionId(completedSession.id);
      }
    }

    // Update the ref for next render
    prevActiveSessionIdRef.current = activeSession?.id || null;
  }, [activeSession, sessions]);

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
    });
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
      tags: [],
      screenshotInterval: lastSettings.screenshotInterval,
      enableScreenshots: lastSettings.enableScreenshots,
      autoAnalysis: lastSettings.autoAnalysis,
      audioRecording: lastSettings.audioRecording,
      audioMode: lastSettings.audioRecording ? 'transcription' : 'off',
      audioReviewCompleted: false,
      videoRecording: lastSettings.videoRecording,
    });
  };

  // Update settings handlers
  const updateScreenshots = (enabled: boolean) => {
    // Update last settings for next session
    const newSettings = { ...lastSettings, enableScreenshots: enabled };
    setLastSettings(newSettings);
    saveLastSessionSettings(newSettings);

    // If session is active, update the running session too
    if (activeSession) {
      updateSession({ ...activeSession, enableScreenshots: enabled });
    }
  };

  const updateAudio = (enabled: boolean) => {
    // Update last settings for next session
    const newSettings = { ...lastSettings, audioRecording: enabled };
    setLastSettings(newSettings);
    saveLastSessionSettings(newSettings);

    // If session is active, update the running session too
    if (activeSession) {
      updateSession({ ...activeSession, audioRecording: enabled });
    }
  };

  const updateVideo = async (enabled: boolean) => {
    // Update last settings for next session
    const newSettings = { ...lastSettings, videoRecording: enabled };
    setLastSettings(newSettings);
    saveLastSessionSettings(newSettings);

    // If session is active, update the running session too
    if (activeSession) {
      updateSession({ ...activeSession, videoRecording: enabled });
    }
  };

  const updateInterval = (interval: number) => {
    // Update last settings for next session
    const newSettings = { ...lastSettings, screenshotInterval: interval };
    setLastSettings(newSettings);
    saveLastSessionSettings(newSettings);

    // If session is active, update the running session too
    if (activeSession) {
      updateSession({ ...activeSession, screenshotInterval: interval });
    }
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
    <div className={`h-full w-full relative flex flex-col ${BACKGROUND_GRADIENT.primary} overflow-hidden`}>
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

      {/* Main content with padding */}
      <div ref={mainContainerRef} className="relative z-10 flex-1 flex flex-col px-6 pb-6 min-h-0" style={{ paddingTop: '96px' }}>

        {/* Hidden measurement element - always in FULL mode (compactMode=false) */}
        <div ref={menuBarMeasurementRef} style={{ visibility: 'hidden', position: 'absolute', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: -9999 }}>
          <SessionsTopBar
            activeSession={activeSession}
            sessions={sessions}
            allPastSessions={allPastSessions}
            isStarting={isStarting}
            isEnding={isEnding}
            countdown={countdown}
            handleQuickStart={handleQuickStart}
            handleEndSession={handleEndSession}
            pauseSession={pauseSession}
            resumeSession={resumeSession}
            currentSettings={currentSettings}
            updateScreenshots={updateScreenshots}
            updateAudio={updateAudio}
            updateVideo={updateVideo}
            updateInterval={updateInterval}
            sortBy={sortBy}
            onSortChange={setSortBy}
            selectedCategories={selectedCategories}
            selectedSubCategories={selectedSubCategories}
            selectedTags={selectedTags}
            onCategoriesChange={setSelectedCategories}
            onSubCategoriesChange={setSelectedSubCategories}
            onTagsChange={setSelectedTags}
            bulkSelectMode={bulkSelectMode}
            selectedSessionIds={selectedSessionIds}
            onBulkSelectModeChange={setBulkSelectMode}
            onSelectedSessionIdsChange={setSelectedSessionIds}
            compactMode={false}
          />
        </div>

        {/* Top Controls Bar - In Normal Flow */}
        <div className="flex items-center justify-between relative z-50 mb-4">
          <div ref={menuBarWrapperRef}>
            <MenuMorphPill resetKey={selectedSessionId || 'default'}>
              <SessionsTopBar
                activeSession={activeSession}
                sessions={sessions}
                allPastSessions={allPastSessions}
                isStarting={isStarting}
                isEnding={isEnding}
                countdown={countdown}
                handleQuickStart={handleQuickStart}
                handleEndSession={handleEndSession}
                pauseSession={pauseSession}
                resumeSession={resumeSession}
                currentSettings={currentSettings}
                updateScreenshots={updateScreenshots}
                updateAudio={updateAudio}
                updateVideo={updateVideo}
                updateInterval={updateInterval}
                sortBy={sortBy}
                onSortChange={setSortBy}
                selectedCategories={selectedCategories}
                selectedSubCategories={selectedSubCategories}
                selectedTags={selectedTags}
                onCategoriesChange={setSelectedCategories}
                onSubCategoriesChange={setSelectedSubCategories}
                onTagsChange={setSelectedTags}
                bulkSelectMode={bulkSelectMode}
                selectedSessionIds={selectedSessionIds}
                onBulkSelectModeChange={setBulkSelectMode}
                onSelectedSessionIdsChange={setSelectedSessionIds}
                compactMode={compactMode}
              />
            </MenuMorphPill>
          </div>

          {/* Stats pill OUTSIDE MenuMorphPill */}
          <SessionsStatsBar ref={statsPillRef} sessions={sessions} />
        </div>

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
            onSessionClick={setSelectedSessionId}
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
                <ActiveSessionView session={selectedSessionForDetail} />
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
              <ActiveSessionView session={activeSession} />
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

    </div>
  );
}

// Active Session View Component




