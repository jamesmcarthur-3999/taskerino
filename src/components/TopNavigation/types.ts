/**
 * TopNavigation - Type Definitions
 *
 * All TypeScript interfaces and types for the TopNavigation component system
 */

import type { TabType } from '../../types';
import type { LucideIcon } from 'lucide-react';

/**
 * Island expansion states
 */
export type IslandState =
  | 'collapsed'
  | 'task-expanded'
  | 'note-expanded'
  | 'search-expanded'
  | 'processing-expanded'
  | 'session-expanded';

/**
 * Tab configuration for navigation tabs
 */
export interface TabConfig {
  id: TabType;
  label: string;
  icon: LucideIcon;
  shortcut: string;
}

/**
 * Badge configuration for tab badges
 */
export interface BadgeConfig {
  count: number;
  type: 'count' | 'status' | 'processing';
  status?: 'active' | 'paused' | null;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Quick action configuration for tabs
 */
export interface QuickActionConfig {
  hasQuickAction: boolean;
  icon?: LucideIcon;
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
  variant?: 'default' | 'session-controls';
}

/**
 * Navigation button props
 */
export interface NavButtonProps {
  tab: TabConfig;
  isActive: boolean;
  isHovered: boolean;
  badge?: BadgeConfig;
  quickAction?: QuickActionConfig;
  onTabClick: (tabId: TabType) => void;
  onHoverChange: (tabId: TabType | null) => void;
}

/**
 * Props for island mode components
 */
export interface IslandModeProps {
  onClose: () => void;
}

/**
 * Task mode specific props
 */
export interface TaskModeProps extends IslandModeProps {
  taskTitle: string;
  taskDueDate: string;
  showSuccess: boolean;
  createdTaskId: string | null;
  onTaskTitleChange: (value: string) => void;
  onTaskDueDateChange: (value: string) => void;
  onCreateTask: () => void;
  onViewTask: () => void;
}

/**
 * Note mode specific props
 */
export interface NoteModeProps extends IslandModeProps {
  noteInput: string;
  onNoteInputChange: (value: string) => void;
  onSaveNote: () => void;
  onSendToAI: () => void;
}

/**
 * Search mode specific props
 */
export interface SearchModeProps extends IslandModeProps {
  searchQuery: string;
  searchInputRef: React.RefObject<HTMLInputElement>;
  onSearchQueryChange: (value: string) => void;
  onNavigate: (tabId: TabType) => void;
  onOpenSidebar: (type: 'task' | 'note', itemId: string, label: string) => void;
}

/**
 * Processing mode specific props
 */
export interface ProcessingModeProps extends IslandModeProps {
  processingJobs: any[];
  completedJobs: any[];
  onJobClick: (jobId: string) => void;
}

/**
 * Session mode specific props
 */
export interface SessionModeProps extends IslandModeProps {
  activeSession: any | null;
  isSessionActive: boolean;
  isSessionPaused: boolean;
  isStarting: boolean;
  countdown: number | null;
  sessionDescription: string;
  onSessionDescriptionChange: (value: string) => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onEndSession: () => void;
  onStartSession: (config: any) => Promise<void>;
  onNavigateToSessions: () => void;
}
