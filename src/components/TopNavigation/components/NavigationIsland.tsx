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

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavTabs } from './NavTabs';
import { SearchMode } from './island-modes/SearchMode';
import { TaskMode } from './island-modes/TaskMode';
import { NoteMode } from './island-modes/NoteMode';
import { ProcessingMode } from './island-modes/ProcessingMode';
import { SessionMode } from './island-modes/SessionMode';
import type { IslandState } from '../types';
import type { TabType } from '../../../types';
import { islandVariants, springConfig } from '../utils/islandAnimations';
import { NAVIGATION } from '../../../design-system/theme';

interface NavigationIslandProps {
  islandState: IslandState;
  onClose: () => void;
  islandStateHook: ReturnType<any>; // Will be properly typed when hooks are implemented
  navData: ReturnType<any>; // Will be properly typed when hooks are implemented
  navActions: ReturnType<any>; // Will be properly typed when hooks are implemented
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
  onStartSession: (config: any) => Promise<void>;
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
  const islandRef = useRef<HTMLDivElement>(null);
  const isExpanded = islandState !== 'collapsed';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-6 pointer-events-none">
      <motion.div
        ref={islandRef}
        layout
        initial={false}
        animate={isExpanded ? 'expanded' : 'collapsed'}
        variants={islandVariants}
        transition={springConfig}
        className={`
          ${NAVIGATION.island.container}
          pointer-events-auto overflow-hidden
          ${isExpanded ? 'max-w-2xl' : ''}
        `}
      >
        {/* Navigation Tabs - Visible when collapsed */}
        <AnimatePresence mode="wait">
          {islandState === 'collapsed' && (
            <NavTabs
              key="nav-tabs"
              activeTab={activeTab}
              hoveredTab={hoveredTab}
              setHoveredTab={setHoveredTab}
              onTabClick={navActions.handleTabClick}
              onQuickAction={navActions.handleQuickAction}
              onSearchClick={navActions.handleSearchClick}
              navData={{
                activeTasks: navData.activeTasks,
                processingJobs: navData.processingData.processingJobs,
                completedJobs: navData.processingData.completedJobs,
                hasActiveProcessing: navData.processingData.hasActiveProcessing,
                hasCompletedItems: navData.processingData.hasCompletedItems,
                activeSession: navData.sessionData.activeSession,
                isSessionActive: navData.sessionData.isSessionActive,
                isSessionPaused: navData.sessionData.isSessionPaused,
              }}
              onProcessingBadgeClick={navActions.handleProcessingBadgeClick}
              onSessionBadgeClick={navActions.handleSessionBadgeClick}
              onPauseSession={navActions.onPauseSession}
              onResumeSession={navActions.onResumeSession}
              onEndSession={navActions.onEndSession}
            />
          )}
        </AnimatePresence>

        {/* Mode Components - Visible when expanded */}
        <AnimatePresence mode="wait">
          {islandState === 'search-expanded' && (
            <SearchMode
              key="search-mode"
              searchQuery={searchQuery}
              searchInputRef={searchInputRef}
              onSearchQueryChange={onSearchQueryChange}
              onNavigate={onNavigate}
              onOpenSidebar={onOpenSidebar}
              onClose={onClose}
            />
          )}
          {islandState === 'task-expanded' && (
            <TaskMode
              key="task-mode"
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
          )}
          {islandState === 'note-expanded' && (
            <NoteMode
              key="note-mode"
              noteInput={noteInput}
              onNoteInputChange={onNoteInputChange}
              onSaveNote={onSaveNote}
              onSendToAI={onSendToAI}
              onClose={onClose}
            />
          )}
          {islandState === 'processing-expanded' && (
            <ProcessingMode
              key="processing-mode"
              processingJobs={navData.processingData.processingJobs}
              completedJobs={navData.processingData.completedJobs}
              onJobClick={onJobClick}
              onClose={onClose}
            />
          )}
          {islandState === 'session-expanded' && (
            <SessionMode
              key="session-mode"
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
          )}
        </AnimatePresence>
      </motion.div>
    </nav>
  );
}
