/**
 * TopNavigation - Main Orchestrator Component
 *
 * Phase 5: Integration
 * Assembles all pieces together - hooks, components, and state management
 */

import { useState, useEffect, useRef } from 'react';
import { useUI } from '../../context/UIContext';
import { useSessions } from '../../context/SessionsContext';
import { useScrollAnimation } from '../../contexts/ScrollAnimationContext';
import type { TabType } from '../../types';
import { Z_INDEX } from '../../design-system/theme';

// Custom hooks
import { useIslandState } from './hooks/useIslandState';
import { useNavData } from './useNavData';
import { useNavActions } from './useNavActions';
import { useCompactNavigation } from '../../hooks/useCompactNavigation';

// Components
import { LogoContainer } from './components/LogoContainer';
import { MenuButton } from './components/MenuButton';
import { NavigationIsland } from './components/NavigationIsland';
import { RightActionsBar } from './components/RightActionsBar';

export function TopNavigation() {
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { pauseSession, resumeSession, endSession, startSession, activeSessionId } = useSessions();
  const { scrollY } = useScrollAnimation();

  // Compact mode hook
  const isCompact = useCompactNavigation();

  // Island state management hook
  const islandStateHook = useIslandState();
  const { islandState, isExpanded, closeIsland, createdTaskId } = islandStateHook;

  // Search input ref for focus management
  const searchInputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;

  // UI state
  const [hoveredTab, setHoveredTab] = useState<TabType | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showReferencePanelTooltip, setShowReferencePanelTooltip] = useState(false);

  // Session mode state
  const [isStarting, setIsStarting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Data aggregation hook
  const navData = useNavData();

  // Navigation actions hook
  const navActionsFromHook = useNavActions(islandStateHook, searchInputRef);

  // Navigation actions - merge hook actions with session handlers
  const navActions = {
    ...navActionsFromHook,
    onPauseSession: () => {
      if (activeSessionId) {
        pauseSession(activeSessionId);
      }
    },
    onResumeSession: () => {
      if (activeSessionId) {
        resumeSession(activeSessionId);
      }
    },
    onEndSession: async () => {
      if (activeSessionId) {
        await endSession(activeSessionId);
      }
    },
    onStartSession: async (config: any) => {
      setIsStarting(true);
      setCountdown(3);

      // Countdown animation
      for (let i = 3; i > 0; i--) {
        setCountdown(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      startSession(config);
      setIsStarting(false);
      setCountdown(null);
      closeIsland();
    },
    onNavigateToSessions: () => {
      uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'sessions' });
      closeIsland();
    },
    onJobClick: (jobId: string) => {
      // Handle processing job click if needed
      // TODO: Implement job click handler
    },
  };

  // CMD+K command palette listener (opens search)
  useEffect(() => {
    if (uiState.showCommandPalette) {
      islandStateHook.setIslandState('search-expanded');
      // Close the command palette flag
      uiDispatch({ type: 'TOGGLE_COMMAND_PALETTE' });
    }
  }, [uiState.showCommandPalette, uiDispatch, islandStateHook]);

  // Show reference panel tooltip when user first pins a note
  useEffect(() => {
    if (
      !uiState.onboarding.featureIntroductions.referencePanel &&
      uiState.pinnedNotes.length > 0 &&
      !showReferencePanelTooltip
    ) {
      // Delay to let user see the toggle button
      const timer = setTimeout(() => {
        setShowReferencePanelTooltip(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [uiState.pinnedNotes.length, uiState.onboarding.featureIntroductions.referencePanel, showReferencePanelTooltip]);

  return (
    <>
      {/* Blur overlay when island expanded */}
      {isExpanded && (
        <div
          className={`fixed inset-0 bg-black/20 backdrop-blur-sm ${Z_INDEX.modal} transition-opacity duration-300 ease-out`}
          style={{ opacity: isExpanded ? 1 : 0 }}
          onClick={closeIsland}
        />
      )}

      {/* Logo Container - Fades out as menu morphs to its position */}
      <div className={`fixed top-0 left-0 ${Z_INDEX.modal} pt-4 px-6 pointer-events-none`}>
        <LogoContainer scrollY={scrollY} isCompact={isCompact} />
        <MenuButton
          scrollY={scrollY}
          onClick={() => uiDispatch({ type: 'TOGGLE_SUBMENU_OVERLAY' })}
        />
      </div>

      {/* Navigation Island - Center */}
      <NavigationIsland
        islandState={islandState}
        onClose={closeIsland}
        islandStateHook={islandStateHook}
        navData={navData}
        navActions={navActions}
        activeTab={uiState.activeTab}
        hoveredTab={hoveredTab}
        setHoveredTab={setHoveredTab}
        // Search mode props
        searchQuery={islandStateHook.searchQuery}
        searchInputRef={searchInputRef}
        onSearchQueryChange={islandStateHook.setSearchQuery}
        onNavigate={navActions.handleTabClick}
        onOpenSidebar={(type, itemId, label) => {
          uiDispatch({ type: 'OPEN_SIDEBAR', payload: { type, itemId, label } });
        }}
        // Task mode props
        taskTitle={islandStateHook.taskTitle}
        taskDueDate={islandStateHook.taskDueDate}
        showSuccess={islandStateHook.showTaskSuccess}
        createdTaskId={createdTaskId}
        onTaskTitleChange={islandStateHook.setTaskTitle}
        onTaskDueDateChange={islandStateHook.setTaskDueDate}
        onCreateTask={navActions.handleCreateQuickTask}
        onViewTask={() => navActions.handleViewTask(createdTaskId)}
        // Note mode props
        noteInput={islandStateHook.noteInput}
        onNoteInputChange={islandStateHook.setNoteInput}
        onSaveNote={navActions.handleSaveQuickNote}
        onSendToAI={navActions.handleSendToAI}
        // Session mode props
        isStarting={isStarting}
        countdown={countdown}
        sessionDescription={islandStateHook.sessionDescription}
        onSessionDescriptionChange={islandStateHook.setSessionDescription}
        onPauseSession={navActions.onPauseSession}
        onResumeSession={navActions.onResumeSession}
        onEndSession={navActions.onEndSession}
        onStartSession={navActions.onStartSession}
        onNavigateToSessions={navActions.onNavigateToSessions}
        // Processing mode props
        onJobClick={navActions.onJobClick}
      />

      {/* Right Actions Bar */}
      <RightActionsBar
        isCompact={isCompact}
        notificationData={navData.notificationData}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
        notifications={uiState.notifications}
        pinnedNotesCount={uiState.pinnedNotes.length}
        referencePanelOpen={uiState.referencePanelOpen}
        onToggleReferencePanel={() => uiDispatch({ type: 'TOGGLE_REFERENCE_PANEL' })}
        showReferencePanelTooltip={showReferencePanelTooltip}
        setShowReferencePanelTooltip={setShowReferencePanelTooltip}
        nedOverlayOpen={uiState.nedOverlay.isOpen}
        onToggleNedOverlay={() => uiDispatch({ type: 'TOGGLE_NED_OVERLAY' })}
        activeTab={uiState.activeTab}
        onProfileClick={navActions.handleProfileClick}
        uiDispatch={uiDispatch}
      />
    </>
  );
}
