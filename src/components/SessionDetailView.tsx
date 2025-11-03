import React, { useState, useMemo, useEffect, useCallback, Suspense, lazy } from 'react';
import { Calendar, Clock, Activity, Tag, Download, Trash2, CheckSquare, FileText, BookOpen, CheckCircle2, AlertCircle, Target, Lightbulb, Plus, Music, Camera, RefreshCw, ChevronDown, Columns, Focus, Settings } from 'lucide-react';
import type { Session, Task, Note } from '../types';
import { SessionActivityTimeline } from './SessionActivityTimeline';
import { calculateActivityStats } from '../utils/activityUtils';
import { groupActivitiesIntoBlocks } from '../utils/activityUtils';
import { useUI } from '../context/UIContext';
import { useTasks } from '../context/TasksContext';
import { useNotes } from '../context/NotesContext';
import { useSessionList } from '../context/SessionListContext';
import { useEnrichmentContext } from '../context/EnrichmentContext';
import { useScrollAnimation } from '../contexts/ScrollAnimationContext';
import { generateId, stripHtmlTags } from '../utils/helpers';
import { exportSessionJSON, exportSessionMarkdown } from '../utils/sessionExport';
import { audioExportService } from '../services/audioExportService';
import { InlineTagManager } from './InlineTagManager';
import { CompanyPillManager } from './CompanyPillManager';
import { ContactPillManager } from './ContactPillManager';
import { RainbowBorderProgressIndicator } from './RainbowBorderProgressIndicator';
import { getBackgroundEnrichmentManager } from '../services/enrichment/BackgroundEnrichmentManager';
import { getStorage } from '../services/storage';
import { getChunkedStorage } from '../services/storage/ChunkedSessionStorage';
import { useEntities } from '../context/EntitiesContext';
import {
  ICON_SIZES,
  SHADOWS,
  BACKGROUND_GRADIENT,
  getGlassClasses,
  getStatusBadgeClasses,
  getSuccessGradient,
  getDangerGradient,
  getInfoGradient,
  getWarningGradient,
  PRIORITY_COLORS,
  STATS_CARD_GRADIENTS,
  getRadiusClass,
  TRANSITIONS,
} from '../design-system/theme';
import { LoadingSpinner } from './LoadingSpinner';
import { RelationshipPills } from './relationships/RelationshipPills';
import { RelationshipModal } from './relationships/RelationshipModal';
import { RelationshipCardSection } from './relationships/RelationshipCardSection';
import { EntityType, RelationshipType } from '../types/relationships';

// Lazy load SessionReview and CanvasView to reduce initial bundle size
const SessionReview = lazy(() => import('./SessionReview').then(module => ({ default: module.SessionReview })));
const CanvasView = lazy(() => import('./CanvasView').then(module => ({ default: module.CanvasView })));

// Import SessionPreview for metadata preview mode
import { SessionPreview } from './sessions/SessionPreview';

type ViewMode = 'preview' | 'full';

interface SessionDetailViewProps {
  session: Session;
  onClose: () => void;
  onDelete?: (sessionId: string) => void;
  onAddComment?: (screenshotId: string, comment: string) => void;
  onToggleFlag?: (screenshotId: string) => void;
  isSidebarExpanded?: boolean;
  onToggleSidebar?: () => void;
}

export function SessionDetailView({
  session,
  onClose,
  onDelete,
  onAddComment,
  onToggleFlag,
  isSidebarExpanded,
  onToggleSidebar,
}: SessionDetailViewProps) {
  // Two-mode system: preview (fast, metadata-only) vs full (complete session data)
  // Auto-load full mode immediately (user doesn't want to click "Load Full Session" button)
  const [mode, setMode] = useState<ViewMode>('full');
  const [fullSession, setFullSession] = useState<Session | null>(null);
  const [isLoadingFull, setIsLoadingFull] = useState(true);
  const { dispatch: uiDispatch, addNotification } = useUI();
  const { addTask } = useTasks();
  const { addNote } = useNotes();
  const { sessions: allSessions, updateSession: updateSessionInContext } = useSessionList();
  const { getActiveEnrichment, startTracking, updateProgress, stopTracking } = useEnrichmentContext();
  const { scrollProgress, scrollY, isScrolled, registerScrollContainer, unregisterScrollContainer } = useScrollAnimation();
  const { state: entitiesState } = useEntities();

  // Delayed progress for SessionDetailView animations (only active after header collapse at 150px)
  // Maps scrollY 150-300 to progress 0-1
  const delayedProgress = useMemo(() => {
    if (scrollY < 150) return 0;
    if (scrollY >= 300) return 1;
    return (scrollY - 150) / 150; // 0-1 over 150px range
  }, [scrollY]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'review' | 'canvas'>('overview');
  const [isExportingAudio, setIsExportingAudio] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session>(session);
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
  const [showReEnrichMenu, setShowReEnrichMenu] = useState(false);
  const [isReEnriching, setIsReEnriching] = useState(false);

  // Check enrichment status for UI state
  const enrichmentStatus = currentSession.enrichmentStatus?.status || 'idle';
  const isEnriching = enrichmentStatus === 'in-progress' || enrichmentStatus === 'pending';
  const enrichmentComplete = enrichmentStatus === 'completed';
  const enrichmentFailed = enrichmentStatus === 'failed';
  const [pendingSeekTimestamp, setPendingSeekTimestamp] = useState<string | null>(null);
  const [relationshipModalOpen, setRelationshipModalOpen] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const exportMenuRef = React.useRef<HTMLDivElement>(null);
  const reEnrichMenuRef = React.useRef<HTMLDivElement>(null);
  const sessionReviewRef = React.useRef<any>(null);

  // Load full session data (screenshots, audio, etc.) from ChunkedSessionStorage
  useEffect(() => {
    const loadFull = async () => {
      try {
        setIsLoadingFull(true);
        const { getChunkedStorage } = await import('../services/storage/ChunkedSessionStorage');
        const chunkedStorage = await getChunkedStorage();

        const full = await chunkedStorage.loadFullSession(session.id);
        if (full) {
          setFullSession(full);
          setCurrentSession(full); // Update currentSession with full data
        } else {
          // Fall back to metadata if full session not found
          setFullSession(session);
          setCurrentSession(session);
        }
      } catch (error) {
        console.error('[SessionDetailView] Failed to load full session:', error);
        // Fall back to metadata on error
        setFullSession(session);
        setCurrentSession(session);

        addNotification({
          type: 'warning',
          title: 'Loading Issues',
          message: 'Some session data may not be available',
        });
      } finally {
        setIsLoadingFull(false);
      }
    };

    loadFull();
  }, [session.id]); // Re-load when session ID changes

  // Listen for media processing completion and reload session
  useEffect(() => {
    const handleMediaProcessingComplete = async (event: { sessionId: string; optimizedPath: string }) => {
      console.log('[SessionDetailView] media-processing-complete event received:', {
        eventSessionId: event.sessionId,
        currentSessionId: session.id,
        matches: event.sessionId === session.id,
        optimizedPath: event.optimizedPath
      });

      if (event.sessionId === session.id) {
        console.log('[SessionDetailView] Media processing complete, reloading session...');
        try {
          const chunkedStorage = await getChunkedStorage();
          const full = await chunkedStorage.loadFullSession(session.id);
          if (full) {
            console.log('[SessionDetailView] Loaded session from storage:', {
              hasVideo: !!full.video,
              optimizedPath: full.video?.optimizedPath,
              videoId: full.video?.id
            });
            setFullSession(full);
            setCurrentSession(full);
            console.log('[SessionDetailView] ✅ Session reloaded with optimized media path:', full.video?.optimizedPath);
          } else {
            console.warn('[SessionDetailView] ⚠️ Failed to load full session from storage');
          }
        } catch (error) {
          console.error('[SessionDetailView] ❌ Failed to reload session after media processing:', error);
        }
      }
    };

    // Import eventBus and set up listener
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const { eventBus } = await import('../utils/eventBus');
      // on() returns an unsubscribe function
      unsubscribe = eventBus.on('media-processing-complete', handleMediaProcessingComplete);
    })();

    // Return cleanup function
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [session.id]);

  // Get active enrichment for real-time tracking
  const activeEnrichment = getActiveEnrichment(currentSession.id);

  // Sync enrichment status from session prop (but don't overwrite full data!)
  useEffect(() => {
    // Only sync enrichment status if it changed
    const enrichmentStatusChanged =
      session.enrichmentStatus?.status !== currentSession.enrichmentStatus?.status ||
      session.enrichmentStatus?.completedAt !== currentSession.enrichmentStatus?.completedAt;

    if (enrichmentStatusChanged && fullSession) {
      console.log('[SessionDetailView] Enrichment status changed, syncing status only', {
        newStatus: session.enrichmentStatus?.status,
        oldStatus: currentSession.enrichmentStatus?.status,
      });
      // Only update enrichment status, preserve full session data
      setCurrentSession({
        ...currentSession,
        enrichmentStatus: session.enrichmentStatus,
      });
    }
  }, [
    session.enrichmentStatus?.status,
    session.enrichmentStatus?.completedAt,
    // Note: currentSession is NOT in dependencies - would cause infinite loop
    // since we update currentSession inside this effect
    fullSession,
  ]);

  const duration = useMemo(() => {
    if (!session.startTime) return 0;
    const endTime = session.endTime ? new Date(session.endTime) : new Date();
    return Math.floor((endTime.getTime() - new Date(session.startTime).getTime()) / 60000);
  }, [session.startTime, session.endTime]);

  const activityBlocks = useMemo(
    () => groupActivitiesIntoBlocks(session.screenshots, session),
    [session.screenshots, session]
  );

  const activityStats = useMemo(
    () => calculateActivityStats(activityBlocks),
    [activityBlocks]
  );


  const handleExportPDF = () => {
    window.print();
  };

  const handleExportAudioMP3 = async () => {
    if (!session.audioSegments || session.audioSegments.length === 0) {
      addNotification({
        type: 'error',
        title: 'No Audio Available',
        message: 'This session has no audio segments to export',
      });
      return;
    }

    setIsExportingAudio(true);
    setShowExportMenu(false);

    try {
      const mp3Blob = await audioExportService.exportAudioAsMP3(session, session.audioSegments);
      audioExportService.downloadAudioFile(mp3Blob, session, 'mp3');

      addNotification({
        type: 'success',
        title: 'Audio Export Successful',
        message: 'Session audio exported as MP3',
      });
    } catch (error) {
      console.error('Failed to export audio:', error);
      addNotification({
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to export session audio',
      });
    } finally {
      setIsExportingAudio(false);
    }
  };

  const handleExportAudioWAV = async () => {
    if (!session.audioSegments || session.audioSegments.length === 0) {
      addNotification({
          type: 'error',
          title: 'No Audio Available',
          message: 'This session has no audio segments to export',
      });
      return;
    }

    setIsExportingAudio(true);
    setShowExportMenu(false);

    try {
      const wavBlob = await audioExportService.exportAudioAsWAV(session, session.audioSegments);
      audioExportService.downloadAudioFile(wavBlob, session, 'wav');

      addNotification({
          type: 'success',
          title: 'Audio Export Successful',
          message: 'Session audio exported as WAV',
      });
    } catch (error) {
      console.error('Failed to export audio:', error);
      addNotification({
          type: 'error',
          title: 'Export Failed',
          message: 'Failed to export session audio',
      });
    } finally {
      setIsExportingAudio(false);
    }
  };

  const handleExportTranscriptionSRT = () => {
    if (!session.audioSegments || session.audioSegments.length === 0) {
      addNotification({
          type: 'error',
          title: 'No Audio Available',
          message: 'This session has no audio segments to export',
      });
      return;
    }

    const srt = audioExportService.exportTranscriptionAsSRT(session, session.audioSegments);
    audioExportService.downloadTranscriptionFile(srt, session, 'srt');
    setShowExportMenu(false);

    addNotification({
      type: 'success',
      title: 'Transcription Export Successful',
      message: 'Session transcription exported as SRT',
    });
  };

  const handleExportTranscriptionVTT = () => {
    if (!session.audioSegments || session.audioSegments.length === 0) {
      addNotification({
          type: 'error',
          title: 'No Audio Available',
          message: 'This session has no audio segments to export',
      });
      return;
    }

    const vtt = audioExportService.exportTranscriptionAsVTT(session, session.audioSegments);
    audioExportService.downloadTranscriptionFile(vtt, session, 'vtt');
    setShowExportMenu(false);

    addNotification({
      type: 'success',
      title: 'Transcription Export Successful',
      message: 'Session transcription exported as VTT',
    });
  };

  const handleExportTranscriptionTXT = () => {
    if (!session.audioSegments || session.audioSegments.length === 0) {
      addNotification({
          type: 'error',
          title: 'No Audio Available',
          message: 'This session has no audio segments to export',
      });
      return;
    }

    const txt = audioExportService.exportTranscriptionAsTXT(session, session.audioSegments);
    audioExportService.downloadTranscriptionFile(txt, session, 'txt');
    setShowExportMenu(false);

    addNotification({
      type: 'success',
      title: 'Transcription Export Successful',
      message: 'Session transcription exported as TXT',
    });
  };

  const handleExportAudioMarkdown = () => {
    if (!session.audioSegments || session.audioSegments.length === 0) {
      addNotification({
          type: 'error',
          title: 'No Audio Available',
          message: 'This session has no audio segments to export',
      });
      return;
    }

    const md = audioExportService.exportAsMarkdown(session, session.audioSegments);
    audioExportService.downloadTranscriptionFile(md, session, 'markdown');
    setShowExportMenu(false);

    addNotification({
      type: 'success',
      title: 'Export Successful',
      message: 'Session audio and transcription exported as Markdown',
    });
  };

  // Compute allTags at top level (before early return) to avoid hook ordering violation
  const allTags = useMemo(() =>
    Array.from(new Set(allSessions.flatMap(s => s.tags || []))),
    [allSessions]
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  /**
   * Switch to Review tab and seek to a specific timestamp
   * Used by Canvas citations to navigate to source moments
   */
  const switchToReviewAtTime = useCallback((timestamp: string) => {
    console.log('[SessionDetailView] Switching to Review at timestamp:', timestamp);

    // Switch to review tab
    setActiveView('review');

    // Store the timestamp to seek to once Review tab is mounted
    setPendingSeekTimestamp(timestamp);
  }, []);

  // Handle pending seek when Review tab is active
  useEffect(() => {
    if (activeView === 'review' && pendingSeekTimestamp && sessionReviewRef.current) {
      console.log('[SessionDetailView] Seeking to pending timestamp:', pendingSeekTimestamp);

      // Get the handleTimelineSeek function from SessionReview via ref
      if (typeof sessionReviewRef.current.seekToTimestamp === 'function') {
        sessionReviewRef.current.seekToTimestamp(pendingSeekTimestamp);
        setPendingSeekTimestamp(null); // Clear pending seek
      }
    }
  }, [activeView, pendingSeekTimestamp]);

  const handleDelete = () => {
    if (onDelete) {
      onDelete(session.id);
      handleClose();
    }
  };

  const handleExtractTask = (title: string, priority: 'low' | 'medium' | 'high' | 'urgent', context?: string) => {
    const now = new Date().toISOString();
    const taskId = generateId();
    const newTask: Task = {
      id: taskId,
      relationships: [
        {
          id: generateId(),
          sourceType: EntityType.TASK,
          sourceId: taskId,
          targetType: EntityType.SESSION,
          targetId: session.id,
          type: RelationshipType.TASK_SESSION,
          canonical: true,
          metadata: { source: 'ai' as const, createdAt: now },
        },
      ],
      title: title.trim(),
      done: false,
      priority,
      status: 'todo',
      createdBy: 'ai',
      createdAt: now,

      // Session linkage
      sourceExcerpt: title,

      // Rich context for AI agents
      description: context?.trim() || `Extracted from session: ${session.name}`,
      contextForAgent: context?.trim()
        ? `This task was identified during the session "${session.name}". Context: ${context.trim()}`
        : `This task was identified during the session "${session.name}".`,

      tags: [],
    };

    // Add task to state
    addTask(newTask);

    // Link task to session
    // Task-session linking handled automatically
    // dispatch({
    //   type: 'ADD_EXTRACTED_TASK_TO_SESSION',
    //   payload: { sessionId: session.id, taskId: newTask.id },
    // });

    // Show success notification
    addNotification({
      type: 'success',
      title: 'Task Created',
      message: `Task added from session "${session.name}"`,
    });

    // Open sidebar for editing
    uiDispatch({
      type: 'OPEN_SIDEBAR',
      payload: {
        type: 'task',
        itemId: newTask.id,
        label: newTask.title,
      },
    });
  };

  const handleExtractNote = (content: string) => {
    // Strip any HTML tags from content to ensure clean markdown/plain text
    const cleanContent = stripHtmlTags(content.trim());

    const now = new Date().toISOString();
    const noteId = generateId();
    const newNote: Note = {
      id: noteId,
      relationships: [
        {
          id: generateId(),
          sourceType: EntityType.NOTE,
          sourceId: noteId,
          targetType: EntityType.SESSION,
          targetId: session.id,
          type: RelationshipType.NOTE_SESSION,
          canonical: true,
          metadata: { source: 'manual' as const, createdAt: now },
        },
      ],
      content: cleanContent,
      summary: cleanContent.split('\n')[0].substring(0, 100),
      timestamp: now,
      lastUpdated: now,
      source: 'thought',
      tags: [],

      // Rich metadata following capture box pattern
      metadata: {
        keyPoints: [cleanContent.split('\n')[0].substring(0, 100)],
        relatedTopics: [session.name],
      },
    };

    // Add note to state
    addNote(newNote);

    // Link note to session
    // Note-session linking handled automatically
    // dispatch({
    //   type: 'ADD_EXTRACTED_NOTE_TO_SESSION',
    //   payload: { sessionId: session.id, noteId: newNote.id },
    // });

    // Show success notification
    addNotification({
      type: 'success',
      title: 'Note Created',
      message: `Note captured from session "${session.name}"`,
    });

    // Open sidebar for editing
    uiDispatch({
      type: 'OPEN_SIDEBAR',
      payload: {
        type: 'note',
        itemId: newNote.id,
        label: newNote.summary,
      },
    });
  };

  const handleCompaniesChange = (companyIds: string[]) => {
    if (!currentSession) return;

    // TODO: Update to use relationships array
    // Sessions don't directly store company/contact IDs
    // They are inferred from notes/tasks linked to the session
    console.log('Company IDs update requested:', companyIds);
  };

  const handleContactsChange = (contactIds: string[]) => {
    if (!currentSession) return;

    // TODO: Update to use relationships array
    // Sessions don't directly store company/contact IDs
    // They are inferred from notes/tasks linked to the session
    console.log('Contact IDs update requested:', contactIds);
  };

  const handleSessionUpdate = (updatedSession: Session) => {
    setCurrentSession(updatedSession);
    // Trigger sessions list refresh
    updateSessionInContext(updatedSession.id, updatedSession);
    console.log('🎯 [SESSION DETAIL] Session updated after enrichment');
  };

  const handleAudioReviewComplete = (updatedSession: Session) => {
    setCurrentSession(updatedSession);
    console.log('🎧 [SESSION DETAIL] Audio review completed, updated session state');
  };

  const handleSummaryRegenerationStart = () => {
    setIsRegeneratingSummary(true);
  };

  const handleSummaryRegenerationComplete = (updatedSession: Session) => {
    setCurrentSession(updatedSession);
    setIsRegeneratingSummary(false);
  };

  const handleReEnrich = async (options: { audio?: boolean; video?: boolean }) => {
    setShowReEnrichMenu(false);
    setIsReEnriching(true);

    try {
      console.log('✨ [SESSION DETAIL] Queuing re-enrichment for session:', options);

      // Queue re-enrichment via BackgroundEnrichmentManager
      const manager = await getBackgroundEnrichmentManager();
      const jobId = await manager.enqueueSession({
        sessionId: currentSession.id,
        sessionName: currentSession.name,
        priority: 'high', // User-initiated re-enrichment = high priority
        options: {
          skipAudio: !(options.audio ?? false),
          skipVideo: !(options.video ?? false),
          skipSummary: false,
          skipCanvas: false,
          forceReTranscribe: options.audio ?? false
        }
      });

      console.log('✅ [SESSION DETAIL] Re-enrichment queued with job ID:', jobId);

      addNotification({
          type: 'info',
          title: 'Re-enrichment Queued',
          message: 'Processing in background. Check status in top-right corner.',
      });

      // Reload session from storage to get updated enrichmentStatus
      const storage = await getStorage();
      const sessions = await storage.load<Session[]>('sessions') || [];

      if (Array.isArray(sessions)) {
        const freshSession = sessions.find((s) => s.id === currentSession.id);
        if (freshSession) {
          console.log('✅ [SESSION DETAIL] Reloaded session with updated enrichment status');
          setCurrentSession(freshSession);
          updateSessionInContext(freshSession.id, freshSession);
        }
      }
    } catch (error: any) {
      console.error('❌ [SESSION DETAIL] Failed to queue re-enrichment:', error);

      addNotification({
          type: 'error',
          title: 'Re-enrichment Failed',
          message: error.message || 'Failed to queue re-enrichment',
      });
    } finally {
      setIsReEnriching(false);
    }
  };

  // Handle click outside export menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
      if (reEnrichMenuRef.current && !reEnrichMenuRef.current.contains(event.target as Node)) {
        setShowReEnrichMenu(false);
      }
    };

    if (showExportMenu || showReEnrichMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu, showReEnrichMenu]);


  // Register content container with ScrollAnimationContext for RAF-based scroll detection
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    // Register the scroll container
    registerScrollContainer(contentElement);

    // Cleanup: unregister on unmount
    return () => {
      unregisterScrollContainer(contentElement);
    };
  }, [registerScrollContainer, unregisterScrollContainer]);

  // LOADING: Show spinner while loading full session data
  if (isLoadingFull && !fullSession) {
    return (
      <div className={`h-full w-full ${BACKGROUND_GRADIENT.primary} ${getRadiusClass('card')} shadow-xl overflow-hidden relative flex items-center justify-center`}>
        <LoadingSpinner size="lg" message="Loading session data..." />
      </div>
    );
  }

  // PREVIEW MODE: Show lightweight metadata preview
  if (mode === 'preview') {
    return (
      <SessionPreview
        sessionId={session.id}
        onLoadFull={() => setMode('full')}
      />
    );
  }

  // FULL MODE: Show complete session detail view (use fullSession if available)
  const displaySession = fullSession || session;
  return (
    <div className={`h-full w-full ${BACKGROUND_GRADIENT.primary} ${getRadiusClass('card')} shadow-xl overflow-hidden relative flex flex-col`}>
        {/* Rainbow border during enrichment */}
        {(activeEnrichment || currentSession.enrichmentStatus?.status === 'in-progress') && (
          <div className={`absolute inset-0 pointer-events-none z-50 ${getRadiusClass('card')} overflow-hidden`}>
            <RainbowBorderProgressIndicator />
          </div>
        )}
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 via-cyan-500/10 to-teal-500/10 animate-gradient-reverse pointer-events-none" />

        {/* Header */}
        <div
          className={`relative z-10 flex-shrink-0 ${getGlassClasses('medium')} border-b-2 shadow-xl transition-all duration-300`}
          style={{
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
            // Padding animations delayed until after header collapse (150px)
            paddingTop: scrollY >= 150 ? `${1.5 - (delayedProgress * 0.5)}rem` : '1.5rem',
            paddingBottom: scrollY >= 150 ? `${1.5 - (delayedProgress * 0.5)}rem` : '1.5rem',
          }}
        >
        <div className="max-w-7xl mx-auto flex items-start justify-between gap-8">
          <div
            className="flex-1 min-w-0 transition-all duration-300"
            style={{
              gap: isScrolled ? '0.25rem' : '0.375rem',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Title & Status */}
            <div className="flex items-center gap-3">
              <h1 className={`font-bold text-gray-900 truncate transition-all duration-300 ${
                isScrolled ? 'text-xl' : 'text-2xl'
              }`}>{session.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm flex-shrink-0 ${getStatusBadgeClasses(session.status as any)}`}>
                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
              </span>
            </div>

            {/* Category & Tags - Combined Row - Hide completely when scrolled */}
            <div
              className="flex items-center gap-3 transition-all duration-300"
              style={{
                maxHeight: isScrolled ? '0px' : '48px',
                opacity: isScrolled ? 0 : 1,
                marginBottom: isScrolled ? '0px' : '6px',
                overflow: isScrolled ? 'hidden' : 'visible',
              }}
            >
              <div className="flex-shrink-0">
                <InlineCategoryManager session={currentSession} />
              </div>
              <div className="flex-1 min-w-0">
                <InlineTagManager
                  tags={currentSession.tags || []}
                  onTagsChange={(newTags) => {
                    updateSessionInContext(currentSession.id, {
                        tags: newTags,
                    });
                  }}
                  allTags={allTags}
                  editable={true}
                />
              </div>
            </div>

            {/* Companies & Contacts - Combined Row - Hide completely when scrolled */}
            <div
              className="flex items-center gap-4 transition-all duration-300"
              style={{
                maxHeight: isScrolled ? '0px' : '48px',
                opacity: isScrolled ? 0 : 1,
                marginBottom: isScrolled ? '0px' : '6px',
                overflow: isScrolled ? 'hidden' : 'visible',
              }}
            >
              {/* Companies Section */}
              <div className="flex-shrink-0 min-w-0">
                <CompanyPillManager
                  companyIds={[]} // TODO: Derive from related notes/tasks
                  onCompaniesChange={handleCompaniesChange}
                  allCompanies={entitiesState.companies}
                  editable={currentSession.status === 'completed'}
                />
              </div>

              {/* Contacts Section */}
              <div className="flex-shrink-0 min-w-0">
                <ContactPillManager
                  contactIds={[]} // TODO: Derive from related notes/tasks
                  onContactsChange={handleContactsChange}
                  allContacts={entitiesState.contacts}
                  editable={currentSession.status === 'completed'}
                />
              </div>
            </div>

            {/* Quick Stats - Compact Row */}
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1.5">
                <Calendar size={14} />
                <span>{new Date(session.startTime).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={14} />
                <span>{Math.floor(duration / 60)}h {duration % 60}m</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Camera size={14} />
                <span>{session.screenshots.length} screenshots</span>
              </div>
            </div>

            {/* Description - Collapsible on scroll (delayed until after header collapse) */}
            <div
              className="overflow-hidden transition-all duration-150"
              style={{
                maxHeight: `${Math.max(0, (1 - delayedProgress) * 120)}px`,
                opacity: Math.max(0, 1 - delayedProgress * 1.2),
              }}
            >
              <p className="text-gray-700 text-sm leading-relaxed">{session.description}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Re-Enrich Button - Show if enrichment has been attempted (completed, partial, or failed) */}
            {currentSession.enrichmentStatus &&
              currentSession.enrichmentStatus.status !== 'idle' &&
              currentSession.enrichmentStatus.status !== 'in-progress' && (
              <div ref={reEnrichMenuRef} className="relative">
                <button
                  onClick={() => setShowReEnrichMenu(!showReEnrichMenu)}
                  disabled={isReEnriching}
                  className={`w-11 h-11 ${getSuccessGradient('light').container} hover:from-green-200 rounded-full transition-all hover:scale-105 active:scale-95 border-2 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Re-enrich session"
                >
                  {isReEnriching ? (
                    <RefreshCw size={18} className="text-green-700 animate-spin" />
                  ) : (
                    <RefreshCw size={18} className="text-green-700" />
                  )}
                </button>

                {/* Re-enrichment dropdown */}
                {showReEnrichMenu && !isReEnriching && (
                  <div className={`absolute top-full right-0 mt-2 w-52 ${getGlassClasses('extra-strong')} ${getRadiusClass('field')} shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200`}>
                    <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                      Re-Enrich Session
                    </div>
                    {currentSession.audioSegments && currentSession.audioSegments.length > 0 && (
                      <button
                        onClick={() => handleReEnrich({ audio: true, video: false })}
                        className={`w-full px-4 py-3 text-left hover:${getSuccessGradient('light').container} transition-colors flex items-center gap-3 text-gray-700 hover:text-gray-900`}
                      >
                        <RefreshCw size={16} />
                        <div>
                          <div className="font-semibold text-sm">Audio Only</div>
                          <div className="text-xs text-gray-600">Regenerate audio insights</div>
                        </div>
                      </button>
                    )}
                    {currentSession.video && (
                      <button
                        onClick={() => handleReEnrich({ audio: false, video: true })}
                        className={`w-full px-4 py-3 text-left hover:${getSuccessGradient('light').container} transition-colors flex items-center gap-3 text-gray-700 hover:text-gray-900 ${currentSession.audioSegments?.length ? 'border-t border-gray-100' : ''}`}
                      >
                        <RefreshCw size={16} />
                        <div>
                          <div className="font-semibold text-sm">Video Only</div>
                          <div className="text-xs text-gray-600">Regenerate video chapters</div>
                        </div>
                      </button>
                    )}
                    {currentSession.audioSegments?.length && currentSession.video && (
                      <button
                        onClick={() => handleReEnrich({ audio: true, video: true })}
                        className={`w-full px-4 py-3 text-left hover:${getSuccessGradient('light').container} transition-colors flex items-center gap-3 text-gray-700 hover:text-gray-900 border-t border-gray-100`}
                      >
                        <RefreshCw size={16} />
                        <div>
                          <div className="font-semibold text-sm">Both</div>
                          <div className="text-xs text-gray-600">Regenerate audio + video</div>
                        </div>
                      </button>
                    )}
                    <button
                      onClick={() => handleReEnrich({ audio: false, video: false })}
                      className={`w-full px-4 py-3 text-left hover:${getSuccessGradient('light').container} transition-colors flex items-center gap-3 text-gray-700 hover:text-gray-900 border-t border-gray-100`}
                    >
                      <RefreshCw size={16} />
                      <div>
                        <div className="font-semibold text-sm">Force Re-Enrich Summary</div>
                        <div className="text-xs text-gray-600">Generate new flexible summary with AI-chosen sections</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sidebar Toggle Button */}
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className={`
                  w-11 h-11 rounded-full transition-all hover:scale-105 active:scale-95 shadow-md flex items-center justify-center
                  ${isSidebarExpanded
                    ? `${getGlassClasses('medium')} text-gray-700`
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 border-2 border-cyan-400 text-white shadow-cyan-200/50'
                  }
                `}
                title={isSidebarExpanded ? "List View" : "Focus Mode (currently active)"}
              >
                {isSidebarExpanded ? (
                  <Columns size={ICON_SIZES.md} />
                ) : (
                  <Focus size={ICON_SIZES.md} />
                )}
              </button>
            )}

            {/* Export Dropdown */}
            <div ref={exportMenuRef} className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={`w-11 h-11 ${getGlassClasses('strong')} rounded-full transition-all hover:scale-105 active:scale-95 shadow-md flex items-center justify-center`}
                title="Export session"
              >
                <Download size={20} className="text-gray-700" />
              </button>

              {/* Dropdown Menu */}
              {showExportMenu && (
                <div className={`absolute top-full right-0 mt-2 w-64 ${getGlassClasses('extra-strong')} ${getRadiusClass('field')} shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 max-h-96 overflow-y-auto`}>
                  {/* Session Export Section */}
                  <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Session Data
                  </div>
                  <button
                    onClick={() => {
                      exportSessionJSON(session);
                      setShowExportMenu(false);
                      addNotification({
                        type: 'success',
                        title: 'Export Successful',
                        message: 'Session exported as JSON',
                      });
                    }}
                    className={`w-full px-4 py-3 text-left hover:${getInfoGradient('light').container} transition-colors flex items-center gap-3 text-gray-700 hover:text-gray-900`}
                  >
                    <FileText size={18} />
                    <div>
                      <div className="font-semibold text-sm">Export as JSON</div>
                      <div className="text-xs text-gray-600">Machine-readable format</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      exportSessionMarkdown(session);
                      setShowExportMenu(false);
                      addNotification({
                        type: 'success',
                        title: 'Export Successful',
                        message: 'Session exported as Markdown',
                      });
                    }}
                    className={`w-full px-4 py-3 text-left hover:${getInfoGradient('light').container} transition-colors flex items-center gap-3 text-gray-700 hover:text-gray-900`}
                  >
                    <BookOpen size={18} />
                    <div>
                      <div className="font-semibold text-sm">Export as Markdown</div>
                      <div className="text-xs text-gray-600">Human-readable format</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      handleExportPDF();
                      setShowExportMenu(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:${getInfoGradient('light').container} transition-colors flex items-center gap-3 text-gray-700 hover:text-gray-900`}
                  >
                    <Download size={18} />
                    <div>
                      <div className="font-semibold text-sm">Export as PDF</div>
                      <div className="text-xs text-gray-600">Print to PDF</div>
                    </div>
                  </button>

                  {/* Audio Export Section */}
                  {session.audioSegments && session.audioSegments.length > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide border-t border-gray-200 mt-2">
                        Audio & Transcription
                      </div>
                      <button
                        onClick={handleExportAudioMP3}
                        disabled={isExportingAudio}
                        className={`w-full px-4 py-3 text-left hover:${getInfoGradient('light').container} transition-colors flex items-center gap-3 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <Music size={18} />
                        <div>
                          <div className="font-semibold text-sm">Export Audio (MP3)</div>
                          <div className="text-xs text-gray-600">Compressed audio file</div>
                        </div>
                      </button>
                      <button
                        onClick={handleExportAudioWAV}
                        disabled={isExportingAudio}
                        className={`w-full px-4 py-3 text-left hover:${getInfoGradient('light').container} transition-colors flex items-center gap-3 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <Music size={18} />
                        <div>
                          <div className="font-semibold text-sm">Export Audio (WAV)</div>
                          <div className="text-xs text-gray-600">Uncompressed audio</div>
                        </div>
                      </button>
                      <button
                        onClick={handleExportTranscriptionSRT}
                        className={`w-full px-4 py-3 text-left hover:${getInfoGradient('light').container} transition-colors flex items-center gap-3 text-gray-700 hover:text-gray-900`}
                      >
                        <FileText size={18} />
                        <div>
                          <div className="font-semibold text-sm">Export Subtitles (SRT)</div>
                          <div className="text-xs text-gray-600">For video editing</div>
                        </div>
                      </button>
                      <button
                        onClick={handleExportTranscriptionVTT}
                        className={`w-full px-4 py-3 text-left hover:${getInfoGradient('light').container} transition-colors flex items-center gap-3 text-gray-700 hover:text-gray-900`}
                      >
                        <FileText size={18} />
                        <div>
                          <div className="font-semibold text-sm">Export Subtitles (VTT)</div>
                          <div className="text-xs text-gray-600">For web playback</div>
                        </div>
                      </button>
                      <button
                        onClick={handleExportTranscriptionTXT}
                        className={`w-full px-4 py-3 text-left hover:${getInfoGradient('light').container} transition-colors flex items-center gap-3 text-gray-700 hover:text-gray-900`}
                      >
                        <FileText size={18} />
                        <div>
                          <div className="font-semibold text-sm">Export Text (TXT)</div>
                          <div className="text-xs text-gray-600">Plain text transcript</div>
                        </div>
                      </button>
                      <button
                        onClick={handleExportAudioMarkdown}
                        className={`w-full px-4 py-3 text-left hover:${getInfoGradient('light').container} transition-colors flex items-center gap-3 text-gray-700 hover:text-gray-900`}
                      >
                        <BookOpen size={18} />
                        <div>
                          <div className="font-semibold text-sm">Audio + Transcription (MD)</div>
                          <div className="text-xs text-gray-600">Complete session report</div>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {onDelete && session.status === 'completed' && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className={`w-11 h-11 ${getDangerGradient('light').container} hover:bg-red-200 rounded-full transition-all hover:scale-105 active:scale-95 border-2 shadow-md flex items-center justify-center`}
                title="Delete session"
              >
                <Trash2 size={20} className="text-red-700" />
              </button>
            )}
          </div>
        </div>
        </div>

        {/* Floating View Tabs - Appears when scrolled */}
        <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 ${
          isScrolled ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}>
          <div className={`flex gap-2 ${getGlassClasses('subtle')} ${getRadiusClass('pill')} p-1.5 shadow-2xl`}>
            <button
              onClick={() => setActiveView('overview')}
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                activeView === 'overview'
                  ? 'bg-white/90 shadow-lg text-gray-900'
                  : 'text-white hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveView('review')}
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                activeView === 'review'
                  ? 'bg-white/90 shadow-lg text-gray-900'
                  : 'text-white hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              Review
            </button>
            <button
              onClick={() => setActiveView('canvas')}
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                activeView === 'canvas'
                  ? 'bg-white/90 shadow-lg text-gray-900'
                  : 'text-white hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              Canvas
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="relative z-0 flex-1 overflow-y-auto px-6 transition-all duration-300"
          style={{
            // Content padding animations delayed until after header collapse (150px)
            paddingTop: scrollY >= 150 ? `${1.5 - (delayedProgress * 0.5)}rem` : '1.5rem',
            paddingBottom: scrollY >= 150 ? `${2 - (delayedProgress * 1)}rem` : '2rem',
          }}
        >
          {/* View Tabs */}
          <div className="mb-6 flex justify-center">
            <div className={`flex gap-2 ${getGlassClasses('medium')} ${getRadiusClass('field')} p-1.5 inline-flex shadow-lg`}>
              <button
                onClick={() => setActiveView('overview')}
                className={`px-8 py-2.5 ${getRadiusClass('element')} font-semibold text-sm transition-all ${
                  activeView === 'overview'
                    ? 'bg-white shadow-lg text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveView('review')}
                className={`px-8 py-2.5 ${getRadiusClass('element')} font-semibold text-sm transition-all ${
                  activeView === 'review'
                    ? 'bg-white shadow-lg text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                Review
              </button>
              <button
                onClick={() => setActiveView('canvas')}
                className={`px-8 py-2.5 ${getRadiusClass('element')} font-semibold text-sm transition-all relative ${
                  activeView === 'canvas'
                    ? 'bg-white shadow-lg text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                Canvas
                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded uppercase tracking-wide">
                  Beta
                </span>
              </button>
            </div>
          </div>

          {activeView === 'overview' ? (
            <div className="max-w-7xl mx-auto">
            <div
              className="transition-all duration-300"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: isScrolled ? '1rem' : '1.5rem',
              }}
            >
              {/* Enrichment Loading Indicator - Shows when enrichment is in progress */}
              {(activeEnrichment || currentSession.enrichmentStatus?.status === 'in-progress') && (
                <div className={`${getInfoGradient('light').container} ${getRadiusClass('card')} p-4 shadow-lg`}>
                  <div className="flex items-center gap-4">
                    {/* Animated icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center shadow-lg">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-bold text-gray-900">Enriching session with AI...</h4>
                        <span className="text-xs font-semibold text-cyan-600">
                          {Math.round(activeEnrichment?.progress ?? currentSession.enrichmentStatus?.progress ?? 0)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {(activeEnrichment?.stage ?? currentSession.enrichmentStatus?.currentStage) === 'audio' && 'Analyzing audio and generating transcript...'}
                        {(activeEnrichment?.stage ?? currentSession.enrichmentStatus?.currentStage) === 'video' && 'Generating video chapters...'}
                        {(activeEnrichment?.stage ?? currentSession.enrichmentStatus?.currentStage) === 'summary' && 'Creating session summary...'}
                        {!(activeEnrichment?.stage ?? currentSession.enrichmentStatus?.currentStage) && 'Processing...'}
                      </p>
                    </div>

                    {/* Progress bar */}
                    <div className="flex-shrink-0 w-32">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 transition-all duration-500 relative overflow-hidden"
                          style={{ width: `${activeEnrichment?.progress ?? currentSession.enrichmentStatus?.progress ?? 0}%` }}
                        >
                          {/* Shimmer effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Session Summary - AI Synthesis */}
              {currentSession.summary && (
                <div className={`relative ${getGlassClasses('medium')} ${getRadiusClass('modal')} p-8 shadow-xl`}>
                  {/* Loading overlay when regenerating */}
                  {isRegeneratingSummary && (
                    <div className={`absolute inset-0 ${getGlassClasses('strong')} ${getRadiusClass('modal')} flex items-center justify-center z-10`}>
                      <div className="text-center">
                        <div className={`inline-flex items-center gap-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6 py-4 ${getRadiusClass('field')} shadow-lg`}>
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <div className="text-left">
                            <div className="font-semibold">Updating Summary</div>
                            <div className="text-sm text-white/90">Integrating audio insights...</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-cyan-600" />
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                        Session Narrative
                      </h3>
                    </div>
                    <button
                      onClick={() => handleExtractNote(currentSession.summary!.narrative)}
                      disabled={isRegeneratingSummary}
                      className={`px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white ${getRadiusClass('element')} text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-md flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <FileText size={14} />
                      Save as Note
                    </button>
                  </div>

                  {/* Narrative */}
                  <div className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-6 mb-6`}>
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{currentSession.summary.narrative}</p>
                  </div>

                  {/* Achievements & Blockers Grid */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Achievements */}
                    {currentSession.summary?.achievements && currentSession.summary?.achievements.length > 0 && (
                      <div className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-5`}>
                        <div className="flex items-center gap-2 mb-4">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                            Achievements
                          </h4>
                        </div>
                        <ul className="space-y-2">
                          {currentSession.summary!.achievements.map((achievement, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="flex-1">{achievement}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Blockers */}
                    {currentSession.summary?.blockers && currentSession.summary?.blockers.length > 0 && (
                      <div className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-5`}>
                        <div className="flex items-center gap-2 mb-4">
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                            Blockers
                          </h4>
                        </div>
                        <ul className="space-y-2">
                          {currentSession.summary!.blockers.map((blocker, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                              <span className="text-red-600 mt-0.5">⚠</span>
                              <span className="flex-1">{blocker}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Recommended Tasks */}
                  {currentSession.summary?.recommendedTasks && currentSession.summary?.recommendedTasks.length > 0 && (
                    <div className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-6 mb-6`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-cyan-600" />
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                            Recommended Tasks
                          </h4>
                        </div>
                        <button
                          onClick={() => {
                            // Create all tasks at once
                            currentSession.summary?.recommendedTasks?.forEach(task => {
                              handleExtractTask(task.title, task.priority, task.context);
                            });
                          }}
                          className={`px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white ${getRadiusClass('element')} text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-md flex items-center gap-1`}
                        >
                          <CheckSquare size={14} />
                          Create All
                        </button>
                      </div>
                      <div className="space-y-3">
                        {currentSession.summary!.recommendedTasks.map((task, i) => (
                          <div key={i} className={`group ${getGlassClasses('medium')} ${getRadiusClass('element')} p-4 hover:border-white/80 transition-all`}>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <h5 className="font-semibold text-gray-900 flex-1">{task.title}</h5>
                              <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
                                  PRIORITY_COLORS[task.priority as 'critical' | 'important' | 'normal' | 'low']?.bg || 'bg-gray-100'
                                } ${
                                  PRIORITY_COLORS[task.priority as 'critical' | 'important' | 'normal' | 'low']?.text || 'text-gray-700'
                                } border ${
                                  PRIORITY_COLORS[task.priority as 'critical' | 'important' | 'normal' | 'low']?.border || 'border-gray-200'
                                }`}>
                                  {task.priority}
                                </span>
                                <button
                                  onClick={() => handleExtractTask(task.title, task.priority, task.context)}
                                  className={`opacity-0 group-hover:opacity-100 flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white ${getRadiusClass('pill')} text-xs font-medium transition-all hover:scale-105 active:scale-95 shadow-sm`}
                                  title="Add to Tasks"
                                >
                                  <Plus size={12} />
                                  Add
                                </button>
                              </div>
                            </div>
                            <p className="text-sm text-gray-700">{task.context}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Insights */}
                  {currentSession.summary?.keyInsights && currentSession.summary?.keyInsights.length > 0 && (
                    <div className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-6`}>
                      <div className="flex items-center gap-2 mb-4">
                        <Lightbulb className="w-5 h-5 text-amber-600" />
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                          Key Insights
                        </h4>
                      </div>
                      <div className="space-y-3">
                        {currentSession.summary!.keyInsights.map((item, i) => (
                          <div key={i} className={`group ${getGlassClasses('medium')} ${getRadiusClass('element')} p-4 hover:border-white/80 transition-all`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm text-gray-800 font-medium mb-1">{item.insight}</p>
                                <p className="text-xs text-gray-600">
                                  {new Date(item.timestamp).toLocaleTimeString()}
                                </p>
                              </div>
                              <button
                                onClick={() => handleExtractNote(item.insight)}
                                className={`opacity-0 group-hover:opacity-100 flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white ${getRadiusClass('pill')} text-xs font-medium transition-all hover:scale-105 active:scale-95 shadow-sm`}
                                title="Save as Note"
                              >
                                <FileText size={12} />
                                Save
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Activity Timeline */}
              <div className={`${getGlassClasses('medium')} ${getRadiusClass('modal')} p-8 shadow-xl`}>
                <SessionActivityTimeline session={session} />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-6">
                {/* Duration */}
                <div className={`bg-gradient-to-br ${STATS_CARD_GRADIENTS.duration.bg} ${getGlassClasses('medium').split(' ').filter(c => c.includes('backdrop')).join(' ')} ${getRadiusClass('card')} border-2 ${STATS_CARD_GRADIENTS.duration.border} p-6 shadow-lg hover:shadow-xl transition-shadow`}>
                  <div className="flex items-center gap-2 text-blue-700 mb-3">
                    <Clock size={20} className={STATS_CARD_GRADIENTS.duration.icon} />
                    <span className="text-sm font-semibold uppercase tracking-wide">Duration</span>
                  </div>
                  <p className={`text-4xl font-bold ${STATS_CARD_GRADIENTS.duration.text}`}>
                    {Math.floor(duration / 60)}h {duration % 60}m
                  </p>
                  <p className={`text-sm ${STATS_CARD_GRADIENTS.duration.text} opacity-80 mt-2`}>
                    {new Date(session.startTime).toLocaleTimeString()} - {session.endTime ? new Date(session.endTime).toLocaleTimeString() : 'Ongoing'}
                  </p>
                </div>

                {/* Screenshots */}
                <div className={`bg-gradient-to-br ${STATS_CARD_GRADIENTS.screenshots.bg} ${getGlassClasses('medium').split(' ').filter(c => c.includes('backdrop')).join(' ')} ${getRadiusClass('card')} border-2 ${STATS_CARD_GRADIENTS.screenshots.border} p-6 shadow-lg hover:shadow-xl transition-shadow`}>
                  <div className="flex items-center gap-2 text-purple-700 mb-3">
                    <Activity size={20} className={STATS_CARD_GRADIENTS.screenshots.icon} />
                    <span className="text-sm font-semibold uppercase tracking-wide">Screenshots</span>
                  </div>
                  <p className={`text-4xl font-bold ${STATS_CARD_GRADIENTS.screenshots.text}`}>{session.screenshots.length}</p>
                  <p className={`text-sm ${STATS_CARD_GRADIENTS.screenshots.text} opacity-80 mt-2`}>
                    Captured every {session.screenshotInterval} minutes
                  </p>
                </div>

                {/* Activities */}
                <div className={`bg-gradient-to-br ${STATS_CARD_GRADIENTS.activities.bg} ${getGlassClasses('medium').split(' ').filter(c => c.includes('backdrop')).join(' ')} ${getRadiusClass('card')} border-2 ${STATS_CARD_GRADIENTS.activities.border} p-6 shadow-lg hover:shadow-xl transition-shadow`}>
                  <div className="flex items-center gap-2 text-teal-700 mb-3">
                    <Tag size={20} className={STATS_CARD_GRADIENTS.activities.icon} />
                    <span className="text-sm font-semibold uppercase tracking-wide">Activities</span>
                  </div>
                  <p className={`text-4xl font-bold ${STATS_CARD_GRADIENTS.activities.text}`}>{activityStats.activities.length}</p>
                  <p className={`text-sm ${STATS_CARD_GRADIENTS.activities.text} opacity-80 mt-2`}>
                    {activityStats.activities[0]?.name || 'No activities'} (top)
                  </p>
                </div>
              </div>

              {/* Activity Breakdown */}
              {activityStats.activities.length > 0 && (
                <div className={`bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-pink-500/20 backdrop-blur-xl ${getRadiusClass('modal')} border-2 border-indigo-300/40 p-8 shadow-xl`}>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-6">Activity Breakdown</h3>

                  <div className="space-y-5">
                    {activityStats.activities.map((activity) => (
                    <div key={activity.name} className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-5 h-5 rounded-lg shadow-md"
                            style={{ background: `linear-gradient(135deg, ${activity.color} 0%, ${activity.color}dd 100%)` }}
                          />
                          <span className="font-semibold text-gray-900">{activity.name}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-700 bg-white/50 px-3 py-1 rounded-full">
                          {Math.floor(activity.duration / 60)}h {activity.duration % 60}m ({Math.round(activity.percentage)}%)
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full overflow-hidden shadow-inner border border-gray-200/50">
                        <div
                          className="h-full rounded-full transition-all shadow-sm"
                          style={{
                            width: `${activity.percentage}%`,
                            background: `linear-gradient(90deg, ${activity.color} 0%, ${activity.color}dd 100%)`,
                          }}
                        />
                      </div>
                    </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Items - New Relationships System */}
              <div className="space-y-4">
                <RelationshipCardSection
                  entityId={currentSession.id}
                  entityType={EntityType.SESSION}
                  title="Related Tasks"
                  filterTypes={[RelationshipType.TASK_SESSION]}
                  maxVisible={8}
                  variant="default"
                  showActions={true}
                  showExcerpts={false}
                  onAddClick={() => setRelationshipModalOpen(true)}
                />

                <RelationshipCardSection
                  entityId={currentSession.id}
                  entityType={EntityType.SESSION}
                  title="Related Notes"
                  filterTypes={[RelationshipType.NOTE_SESSION]}
                  maxVisible={8}
                  variant="default"
                  showActions={true}
                  showExcerpts={false}
                  onAddClick={() => setRelationshipModalOpen(true)}
                />
              </div>
            </div>
            </div>
          ) : activeView === 'review' ? (
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner size="lg" message="Loading review..." />
              </div>
            }>
              <SessionReview
                session={currentSession}
                onAddComment={onAddComment}
                onToggleFlag={onToggleFlag}
                showContextCapture={session.status === 'active'}
                onSessionUpdate={async (updatedSession) => {
                  // Reload session from storage to get saved chapters
                  const { getStorage } = await import('../services/storage');
                  const storage = await getStorage();
                  const sessions = await storage.load<Session[]>('sessions') || [];

                  if (Array.isArray(sessions)) {
                    const freshSession = sessions.find((s: Session) => s.id === session.id);
                    if (freshSession) {
                      setCurrentSession(freshSession);
                      // CRITICAL: Update SessionsContext so chapters persist when navigating away
                      updateSessionInContext(freshSession.id, freshSession);
                    }
                  }

                  // Show success notification
                  addNotification({
                    type: 'success',
                    title: 'Chapters Saved',
                    message: 'Chapter markers have been added to the video',
                  });
                }}
              />
            </Suspense>
          ) : (
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner size="lg" message="Loading canvas..." />
              </div>
            }>
              <CanvasView session={currentSession} onNavigateToSource={(citation) => switchToReviewAtTime(citation.timestamp)} />
            </Suspense>
          )}
        </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className={`absolute inset-0 z-20 flex items-center justify-center ${getGlassClasses('subtle').split(' ').slice(0,2).join(' ')} bg-black/50 animate-in fade-in duration-200`}>
          <div className={`bg-white ${getRadiusClass('modal')} p-8 max-w-md mx-4 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300`}>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Delete Session?</h3>
            <p className="text-gray-700 mb-6">
              This will permanently delete "{session.name}" and all {session.screenshots.length} screenshots. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={`flex-1 px-6 py-3 ${getGlassClasses('medium')} hover:bg-gray-200 ${getRadiusClass('field')} font-medium transition-all`}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className={`flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white ${getRadiusClass('field')} font-medium transition-all`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Relationship Modal */}
      <RelationshipModal
        open={relationshipModalOpen}
        onClose={() => setRelationshipModalOpen(false)}
        entityId={currentSession.id}
        entityType={EntityType.SESSION}
      />

      {/* Enrichment Progress: Rainbow border only (no modal for auto-enrichment) */}
      {/* The RainbowBorderProgressIndicator above is sufficient for showing enrichment progress */}
    </div>
  );
}

// Inline Category Manager Component - Click to edit categories inline
function InlineCategoryManager({ session }: { session: Session }) {
  const { sessions: allSessions, updateSession } = useSessionList();
  const [isEditing, setIsEditing] = useState(false);
  const [category, setCategory] = useState(session.category || '');
  const [subCategory, setSubCategory] = useState(session.subCategory || '');
  const categoryInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (isEditing && categoryInputRef.current) {
      categoryInputRef.current.focus();
    }
  }, [isEditing]);

  // Get existing categories from all sessions
  const existingCategories = useMemo(() =>
    Array.from(new Set(allSessions.map(s => s.category).filter(Boolean))) as string[],
    [allSessions]
  );

  const existingSubCategories = useMemo(() =>
    Array.from(new Set(allSessions.map(s => s.subCategory).filter(Boolean))) as string[],
    [allSessions]
  );

  const handleSave = () => {
    updateSession(session.id, {
        category: category.trim() || undefined,
        subCategory: subCategory.trim() || undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setCategory(session.category || '');
    setSubCategory(session.subCategory || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={categoryInputRef}
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          placeholder="Category..."
          list="categories"
          className={`px-3 py-1.5 ${getGlassClasses('strong')} border-2 border-cyan-400 ${getRadiusClass('pill')} text-xs font-semibold text-gray-800 outline-none w-32`}
        />
        <input
          type="text"
          value={subCategory}
          onChange={(e) => setSubCategory(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          placeholder="Sub-category..."
          list="subcategories"
          className={`px-3 py-1.5 ${getGlassClasses('strong')} border-2 border-cyan-400 ${getRadiusClass('pill')} text-xs font-semibold text-gray-800 outline-none w-32`}
        />
        <button
          onClick={handleSave}
          className={`px-2 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white ${getRadiusClass('pill')} text-xs font-semibold transition-all`}
        >
          Save
        </button>
        <button
          onClick={handleCancel}
          className={`px-2 py-1 ${getGlassClasses('medium')} hover:bg-gray-300 text-gray-700 ${getRadiusClass('pill')} text-xs font-semibold transition-all`}
        >
          Cancel
        </button>
        <datalist id="categories">
          {existingCategories.map(cat => (
            <option key={cat} value={cat} />
          ))}
        </datalist>
        <datalist id="subcategories">
          {existingSubCategories.map(subCat => (
            <option key={subCat} value={subCat} />
          ))}
        </datalist>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap min-h-[32px]">
      {session.category && (
        <button
          onClick={() => setIsEditing(true)}
          className={`group px-3 py-1.5 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-cyan-400/10 hover:from-cyan-200/90 hover:to-blue-200/90 ${getRadiusClass('pill')} text-xs font-semibold text-cyan-800 transition-all flex items-center gap-1.5`}
        >
          <span>{session.category}</span>
        </button>
      )}
      {session.subCategory && (
        <button
          onClick={() => setIsEditing(true)}
          className={`group px-3 py-1.5 ${getGlassClasses('medium')} hover:bg-white/80 ${getRadiusClass('pill')} text-xs font-semibold text-gray-700 transition-all flex items-center gap-1.5`}
        >
          <span>{session.subCategory}</span>
        </button>
      )}
      {!session.category && !session.subCategory && (
        <button
          onClick={() => setIsEditing(true)}
          className={`px-3 py-1.5 ${getGlassClasses('medium')} hover:bg-white/60 border border-dashed border-gray-400 hover:border-cyan-400 ${getRadiusClass('pill')} text-xs text-gray-500 hover:text-cyan-700 font-medium transition-all flex items-center gap-1.5`}
        >
          <Plus size={12} />
          <span>Add Category</span>
        </button>
      )}
    </div>
  );
}
