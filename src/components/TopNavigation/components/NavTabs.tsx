/**
 * NavTabs Component
 *
 * Renders navigation tabs with badges and quick actions
 * Handles special session controls logic
 */

import { motion, LayoutGroup } from 'framer-motion';
import { Search } from 'lucide-react';
import { tabs } from '../constants';
import { NavButton } from './NavButton';
import type { BadgeConfig, QuickActionConfig } from './NavButton';
import type { TabType } from '../../../types';
import { contentSpring } from '../utils/islandAnimations';
import type { Variants } from 'framer-motion';

/**
 * Tabs-specific variants with opacity-only animation
 * Prevents jarring movements during island transitions
 */
const tabsVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
  },
};

interface NavTabsProps {
  activeTab: TabType;
  hoveredTab: TabType | null;
  setHoveredTab: (tab: TabType | null) => void;
  onTabClick: (tabId: TabType) => void;
  onQuickAction: (tabId: TabType, e: React.MouseEvent) => void;
  onSearchClick: () => void;
  navData: {
    activeTasks: number;
    processingJobs: any[];
    completedJobs: any[];
    hasActiveProcessing: boolean;
    hasCompletedItems: boolean;
    activeSession: any | null;
    isSessionActive: boolean;
    isSessionPaused: boolean;
  };
  onProcessingBadgeClick: (e: React.MouseEvent) => void;
  onSessionBadgeClick: (e: React.MouseEvent) => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onEndSession: () => void;
}

/**
 * Helper: Get badge configuration for a tab
 */
function getBadgeConfig(
  tabId: TabType,
  navData: NavTabsProps['navData'],
  onProcessingBadgeClick: (e: React.MouseEvent) => void,
  onSessionBadgeClick: (e: React.MouseEvent) => void
): BadgeConfig | undefined {
  const {
    activeTasks,
    processingJobs,
    completedJobs,
    hasActiveProcessing,
    hasCompletedItems,
    isSessionActive,
    isSessionPaused,
  } = navData;

  // Tasks: Show count of active tasks
  if (tabId === 'tasks') {
    return activeTasks > 0
      ? {
          count: activeTasks,
          type: 'count',
        }
      : undefined;
  }

  // Capture: Show processing or completed count
  if (tabId === 'capture') {
    if (hasActiveProcessing) {
      return {
        count: processingJobs.length,
        type: 'processing',
        onClick: onProcessingBadgeClick,
      };
    } else if (hasCompletedItems) {
      return {
        count: completedJobs.length,
        type: 'count',
        onClick: onProcessingBadgeClick,
      };
    }
    return undefined;
  }

  // Sessions: Show status dot if session is active or paused
  if (tabId === 'sessions' && (isSessionActive || isSessionPaused)) {
    return {
      count: 1, // Not used for status type, but required
      type: 'status',
      status: isSessionActive ? 'active' : 'paused',
      onClick: onSessionBadgeClick,
    };
  }

  return undefined;
}

/**
 * Helper: Get quick action configuration for a tab
 */
function getQuickActionConfig(
  tabId: TabType,
  navData: NavTabsProps['navData'],
  onQuickAction: (tabId: TabType, e: React.MouseEvent) => void,
  onPauseSession: () => void,
  onResumeSession: () => void,
  onEndSession: () => void
): QuickActionConfig | undefined {
  const { activeSession, isSessionActive } = navData;

  // Sessions: Special dual-button controls when session is active
  if (tabId === 'sessions' && activeSession) {
    return {
      type: 'session-controls',
      isSessionActive,
      onPause: onPauseSession,
      onResume: onResumeSession,
      onStop: onEndSession,
    };
  }

  // Tasks/Notes/Sessions: Show Plus button
  if (tabId === 'tasks' || tabId === 'notes' || tabId === 'sessions') {
    const labels = {
      tasks: 'Quick add task',
      notes: 'Quick add note',
      sessions: 'Start session',
    };

    return {
      type: 'default',
      onClick: (e) => onQuickAction(tabId, e),
      label: labels[tabId],
    };
  }

  // Capture: No quick action (badge itself is clickable)
  return undefined;
}

export function NavTabs({
  activeTab,
  hoveredTab,
  setHoveredTab,
  onTabClick,
  onQuickAction,
  onSearchClick,
  navData,
  onProcessingBadgeClick,
  onSessionBadgeClick,
  onPauseSession,
  onResumeSession,
  onEndSession,
}: NavTabsProps) {
  return (
    <motion.div
      variants={tabsVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={contentSpring}
      className="flex items-center justify-center gap-2 px-4 py-2"
    >
      <LayoutGroup>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isHovered = hoveredTab === tab.id;

          // Get badge configuration
          const badge = getBadgeConfig(tab.id, navData, onProcessingBadgeClick, onSessionBadgeClick);

          // Get quick action configuration
          const quickAction = getQuickActionConfig(
            tab.id,
            navData,
            onQuickAction,
            onPauseSession,
            onResumeSession,
            onEndSession
          );

          return (
            <NavButton
              key={tab.id}
              variant="tab"
              icon={tab.icon}
              label={tab.label}
              isActive={isActive}
              isHovered={isHovered}
              badge={badge}
              quickAction={quickAction}
              onClick={() => onTabClick(tab.id)}
              onHoverChange={(hovered) => setHoveredTab(hovered ? tab.id : null)}
              title={`${tab.label} (${tab.shortcut})`}
            />
          );
        })}
      </LayoutGroup>

      {/* Search Button */}
      <div className="h-8 w-px bg-white/30 mx-2"></div>
      <NavButton
        variant="search"
        icon={Search}
        onClick={onSearchClick}
        title="Search (⌘K)"
      >
        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">⌘K</kbd>
      </NavButton>
    </motion.div>
  );
}
