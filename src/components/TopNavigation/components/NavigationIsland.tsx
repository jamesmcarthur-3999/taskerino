/**
 * NavigationIsland Component
 *
 * Main container that orchestrates the dynamic island navigation:
 * - Collapsed: Renders navigation tabs
 * - Expanded: Renders mode-specific components (Search, Task, Note, Processing, Session)
 *
 * Features:
 * - Spring-based expansion/collapse animations
 * - Glassmorphism styling
 * - Fixed positioning with backdrop blur
 * - willChange optimization during transitions
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavTabs } from './NavTabs';
import { SearchMode } from './island-modes/SearchMode';
import { TaskMode } from './island-modes/TaskMode';
import { NoteMode } from './island-modes/NoteMode';
import { ProcessingMode } from './island-modes/ProcessingMode';
import { SessionMode } from './island-modes/SessionMode';
import type { IslandState } from '../types';
import type { TabType } from '../../../types';
import { springConfig } from '../utils/islandAnimations';
import { NAVIGATION } from '../../../design-system/theme';
import { useCompactNavigation } from '../../../hooks/useCompactNavigation';
import { springs, durations, easings } from '../../../animations/tokens';
import { useReducedMotion, getIslandVariants } from '../../../lib/animations';

interface ProcessingData {
  processingJobs: Array<{ id: string; input: string; progress: number }>;
  completedJobs: Array<{ id: string; input: string }>;
  hasActiveProcessing: boolean;
  hasCompletedItems: boolean;
}

interface SessionData {
  activeSession: {
    id: string;
    name: string;
    description: string;
    startTime: string;
    screenshots: string[];
    lastScreenshotTime: string | null;
  } | null;
  isSessionActive: boolean;
  isSessionPaused: boolean;
}

interface NavData {
  activeTasks: number;
  processingData: ProcessingData;
  sessionData: SessionData;
}

interface NavActions {
  handleTabClick: (tabId: TabType) => void;
  handleQuickAction: (tabId: TabType, e: React.MouseEvent) => void;
  handleSearchClick: () => void;
  handleProcessingBadgeClick: (e: React.MouseEvent) => void;
  handleSessionBadgeClick: (e: React.MouseEvent) => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onEndSession: () => void;
}

interface NavigationIslandProps {
  islandState: IslandState;
  onClose: () => void;
  islandStateHook: unknown; // Intentionally opaque - not used in this component
  navData: NavData;
  navActions: NavActions;
  activeTab: TabType;
  hoveredTab: TabType | null;
  setHoveredTab: (tab: TabType | null) => void;
  // Search mode props
  searchQuery: string;
  searchInputRef: React.RefObject<HTMLInputElement>;
  onSearchQueryChange: (value: string) => void;
  onNavigate: (tabId: TabType) => void;
  onOpenSidebar: (type: 'task' | 'note', itemId: string, label: string) => void;
  // Task mode props
  taskTitle: string;
  taskDueDate: string;
  showSuccess: boolean;
  createdTaskId: string | null;
  onTaskTitleChange: (value: string) => void;
  onTaskDueDateChange: (value: string) => void;
  onCreateTask: () => void;
  onViewTask: () => void;
  // Note mode props
  noteInput: string;
  onNoteInputChange: (value: string) => void;
  onSaveNote: () => void;
  onSendToAI: () => void;
  // Session mode props
  isStarting: boolean;
  countdown: number | null;
  sessionDescription: string;
  onSessionDescriptionChange: (value: string) => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onEndSession: () => void;
  onStartSession: (config: {
    name: string;
    description: string;
    status: 'active';
    screenshotInterval: number;
    autoAnalysis: boolean;
    tags: string[];
    audioRecording: boolean;
    enableScreenshots: boolean;
    videoRecording: boolean;
    audioMode: 'transcription' | 'off';
    audioReviewCompleted: boolean;
  }) => Promise<void>;
  onNavigateToSessions: () => void;
  // Processing mode props
  onJobClick: (jobId: string) => void;
}

export function NavigationIsland({
  islandState,
  onClose,
  islandStateHook,
  navData,
  navActions,
  activeTab,
  hoveredTab,
  setHoveredTab,
  // Search mode props
  searchQuery,
  searchInputRef,
  onSearchQueryChange,
  onNavigate,
  onOpenSidebar,
  // Task mode props
  taskTitle,
  taskDueDate,
  showSuccess,
  createdTaskId,
  onTaskTitleChange,
  onTaskDueDateChange,
  onCreateTask,
  onViewTask,
  // Note mode props
  noteInput,
  onNoteInputChange,
  onSaveNote,
  onSendToAI,
  // Session mode props
  isStarting,
  countdown,
  sessionDescription,
  onSessionDescriptionChange,
  onPauseSession,
  onResumeSession,
  onEndSession,
  onStartSession,
  onNavigateToSessions,
  // Processing mode props
  onJobClick,
}: NavigationIslandProps) {
  const isExpanded = islandState !== 'collapsed';
  const isCompact = useCompactNavigation();
  const prefersReducedMotion = useReducedMotion();

  /**
   * PERFORMANCE OPTIMIZATION:
   * Memoize the navData object to prevent unnecessary re-renders of NavTabs.
   * Without this, a new object is created on every render, breaking referential equality
   * and causing NavTabs to re-render even when the actual data hasn't changed.
   */
  const navDataMemo = useMemo(() => ({
    activeTasks: navData.activeTasks,
    processingJobs: navData.processingData.processingJobs,
    completedJobs: navData.processingData.completedJobs,
    hasActiveProcessing: navData.processingData.hasActiveProcessing,
    hasCompletedItems: navData.processingData.hasCompletedItems,
    activeSession: navData.sessionData.activeSession,
    isSessionActive: navData.sessionData.isSessionActive,
    isSessionPaused: navData.sessionData.isSessionPaused,
  }), [
    navData.activeTasks,
    navData.processingData.processingJobs,
    navData.processingData.completedJobs,
    navData.processingData.hasActiveProcessing,
    navData.processingData.hasCompletedItems,
    navData.sessionData.activeSession,
    navData.sessionData.isSessionActive,
    navData.sessionData.isSessionPaused,
  ]);

  /**
   * ANIMATION CONFIGURATION:
   * Memoize animation properties based on state and user preferences
   */
  const dynamicIslandVariants = useMemo(() => {
    return getIslandVariants(isCompact);
  }, [isCompact]);

  const islandTransition = useMemo(() => {
    if (prefersReducedMotion) {
      return { duration: 0 };
    }
    return {
      ...springConfig,
      layout: springs.smooth,
      width: springs.smooth, // Smooth spring transition for width changes
      maxWidth: springs.smooth,
      backgroundColor: {
        duration: durations.s.normal,
        ease: 'easeInOut',
      },
      backdropFilter: {
        duration: durations.s.normal,
        ease: 'easeInOut',
      },
    };
  }, [prefersReducedMotion]);

  const modeContentTransition = useMemo(() => {
    if (prefersReducedMotion) {
      return { duration: 0 };
    }
    return {
      duration: durations.s.fast,
      ease: 'easeInOut',
    };
  }, [prefersReducedMotion]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-6 pointer-events-none">
      <motion.div
        layoutId="navigation-island"
        initial={false}
        animate={{
          // Width animations based on state AND compact mode
          ...(isExpanded ? dynamicIslandVariants.expanded : dynamicIslandVariants.collapsed),
          // Max width based on compact mode
          maxWidth: isCompact ? '24rem' : '80rem', // 384px / 1280px
          // Background opacity changes on expand/collapse
          backgroundColor: isExpanded
            ? 'rgba(255, 255, 255, 0.5)'
            : 'rgba(255, 255, 255, 0.4)',
        }}
        transition={islandTransition}
        style={{
          willChange: isExpanded || !isCompact ? 'width, transform, background-color, backdrop-filter' : 'auto',
        }}
        className={`
          backdrop-blur-2xl rounded-[40px] shadow-2xl border-2 border-white/50 ring-1 ring-black/5
          pointer-events-auto overflow-hidden
          ${isCompact ? 'max-w-sm' : 'max-w-7xl'}
          relative
        `}
        aria-expanded={isExpanded}
      >
        {/* Navigation Tabs - Visible when collapsed */}
        <AnimatePresence>
          {islandState === 'collapsed' && (
            <div className="w-full">
              <NavTabs
              key="nav-tabs"
              activeTab={activeTab}
              hoveredTab={hoveredTab}
              setHoveredTab={setHoveredTab}
              onTabClick={navActions.handleTabClick}
              onQuickAction={navActions.handleQuickAction}
              onSearchClick={navActions.handleSearchClick}
              navData={navDataMemo}
              onProcessingBadgeClick={navActions.handleProcessingBadgeClick}
              onSessionBadgeClick={navActions.handleSessionBadgeClick}
              onPauseSession={navActions.onPauseSession}
              onResumeSession={navActions.onResumeSession}
              onEndSession={navActions.onEndSession}
              isCompact={isCompact}
            />
            </div>
          )}
        </AnimatePresence>

        {/* Mode Components - Visible when expanded */}
        <AnimatePresence mode="wait">
          {islandState === 'search-expanded' && (
            <motion.div
              key="search-mode"
              className="w-full"
              initial={{ opacity: 0, scale: 0.98, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -4 }}
              transition={modeContentTransition}
            >
              <SearchMode
                searchQuery={searchQuery}
                searchInputRef={searchInputRef}
                onSearchQueryChange={onSearchQueryChange}
                onNavigate={onNavigate}
                onOpenSidebar={onOpenSidebar}
                onClose={onClose}
              />
            </motion.div>
          )}
          {islandState === 'task-expanded' && (
            <motion.div
              key="task-mode"
              className="w-full"
              initial={{ opacity: 0, scale: 0.98, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -4 }}
              transition={modeContentTransition}
            >
              <TaskMode
                taskTitle={taskTitle}
                taskDueDate={taskDueDate}
                showSuccess={showSuccess}
                createdTaskId={createdTaskId}
                onTaskTitleChange={onTaskTitleChange}
                onTaskDueDateChange={onTaskDueDateChange}
                onCreateTask={onCreateTask}
                onViewTask={onViewTask}
                onClose={onClose}
              />
            </motion.div>
          )}
          {islandState === 'note-expanded' && (
            <motion.div
              key="note-mode"
              className="w-full"
              initial={{ opacity: 0, scale: 0.98, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -4 }}
              transition={modeContentTransition}
            >
              <NoteMode
                noteInput={noteInput}
                onNoteInputChange={onNoteInputChange}
                onSaveNote={onSaveNote}
                onSendToAI={onSendToAI}
                onClose={onClose}
              />
            </motion.div>
          )}
          {islandState === 'processing-expanded' && (
            <motion.div
              key="processing-mode"
              className="w-full"
              initial={{ opacity: 0, scale: 0.98, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -4 }}
              transition={modeContentTransition}
            >
              <ProcessingMode
                processingJobs={navData.processingData.processingJobs}
                completedJobs={navData.processingData.completedJobs}
                onJobClick={onJobClick}
                onClose={onClose}
              />
            </motion.div>
          )}
          {islandState === 'session-expanded' && (
            <motion.div
              key="session-mode"
              className="w-full"
              initial={{ opacity: 0, scale: 0.98, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -4 }}
              transition={modeContentTransition}
            >
              <SessionMode
                activeSession={navData.sessionData.activeSession}
                isSessionActive={navData.sessionData.isSessionActive}
                isSessionPaused={navData.sessionData.isSessionPaused}
                isStarting={isStarting}
                countdown={countdown}
                sessionDescription={sessionDescription}
                onSessionDescriptionChange={onSessionDescriptionChange}
                onPauseSession={onPauseSession}
                onResumeSession={onResumeSession}
                onEndSession={onEndSession}
                onStartSession={onStartSession}
                onNavigateToSessions={onNavigateToSessions}
                onClose={onClose}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </nav>
  );
}
