import { useUI } from '../context/UIContext';
import { useTasks } from '../context/TasksContext';
import { useNotes } from '../context/NotesContext';
import { useSessions } from '../context/SessionsContext';
import { useEntities } from '../context/EntitiesContext';
import { Edit3, CheckSquare, BookOpen, Sparkles, User, Search, Command, Plus, Calendar, X, Send, Save, Settings, Activity, Bell, CheckCircle2, Info, AlertTriangle, AlertCircle, Eye, Loader2, Play, Pause, Square, ArrowRight, MessageCircle } from 'lucide-react';
import type { TabType, Task, NotificationType } from '../types';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { generateId } from '../utils/helpers';
import { loadLastSessionSettings } from '../utils/lastSessionSettings';
import { FeatureTooltip } from './FeatureTooltip';
import { useSessionStarting } from '../hooks/useSessionStarting';

interface TabConfig {
  id: TabType;
  label: string;
  icon: typeof Edit3;
  shortcut: string;
}

const tabs: TabConfig[] = [
  { id: 'capture', label: 'Capture', icon: Edit3, shortcut: '⌘1' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, shortcut: '⌘2' },
  { id: 'notes', label: 'Notes', icon: BookOpen, shortcut: '⌘3' },
  { id: 'sessions', label: 'Sessions', icon: Activity, shortcut: '⌘5' },
];

type IslandState = 'collapsed' | 'task-expanded' | 'note-expanded' | 'search-expanded' | 'processing-expanded' | 'session-expanded';

export function TopNavigation() {
  const { state: uiState, dispatch: uiDispatch, addNotification, addProcessingJob } = useUI();
  const { state: tasksState, addTask } = useTasks();
  const { state: notesState, addNote } = useNotes();
  const { sessions, activeSessionId, pauseSession, resumeSession, endSession, startSession } = useSessions();
  const { state: entitiesState } = useEntities();
  const { isStarting, countdown, handleStartSession } = useSessionStarting();
  const activeTab = uiState.activeTab;
  const [hoveredTab, setHoveredTab] = useState<TabType | null>(null);
  const [islandState, setIslandState] = useState<IslandState>('collapsed');
  const islandRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Reference Panel Tooltip State
  const [showReferencePanelTooltip, setShowReferencePanelTooltip] = useState(false);

  const handleTabClick = useCallback((tabId: TabType) => {
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: tabId });
  }, [uiDispatch]);

  const handleQuickAction = useCallback((tabId: TabType, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (tabId === 'tasks') {
      setIslandState(prev => prev === 'task-expanded' ? 'collapsed' : 'task-expanded');
    } else if (tabId === 'notes') {
      setIslandState(prev => prev === 'note-expanded' ? 'collapsed' : 'note-expanded');
    } else if (tabId === 'sessions') {
      setIslandState(prev => prev === 'session-expanded' ? 'collapsed' : 'session-expanded');
    }
  }, []);

  const handleProcessingBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIslandState(prev => prev === 'processing-expanded' ? 'collapsed' : 'processing-expanded');
  }, []);

  const handleSessionBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIslandState(prev => prev === 'session-expanded' ? 'collapsed' : 'session-expanded');
  }, []);

  const closeIsland = useCallback(() => {
    setIslandState('collapsed');
    setTaskTitle('');
    setTaskDueDate('');
    setNoteInput('');
    setSearchQuery('');
    setShowTaskSuccess(false);
    setSessionDescription('');
  }, []);

  const handleProfileClick = () => {
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'profile' });
  };

  const handleSearchClick = () => {
    if (islandState === 'search-expanded') {
      closeIsland();
    } else {
      setIslandState('search-expanded');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  // Memoize expensive calculations
  const activeTasks = useMemo(() =>
    tasksState.tasks.filter(t => !t.done).length,
    [tasksState.tasks]
  );

  // Processing counts
  const processingData = useMemo(() => {
    const processingJobs = uiState.backgroundProcessing.queue.filter(j => j.status === 'processing' || j.status === 'queued');
    const completedJobs = uiState.backgroundProcessing.completed;
    return {
      processingJobs,
      completedJobs,
      processingCount: processingJobs.length + completedJobs.length,
      hasActiveProcessing: processingJobs.length > 0,
      hasCompletedItems: completedJobs.length > 0,
    };
  }, [uiState.backgroundProcessing.queue, uiState.backgroundProcessing.completed]);

  const { processingJobs, completedJobs, processingCount, hasActiveProcessing, hasCompletedItems } = processingData;

  // Session info
  const sessionData = useMemo(() => {
    const activeSession = sessions.find(s => s.id === activeSessionId);
    return {
      activeSession,
      isSessionActive: activeSession?.status === 'active',
      isSessionPaused: activeSession?.status === 'paused',
    };
  }, [sessions, activeSessionId]);

  const { activeSession, isSessionActive, isSessionPaused } = sessionData;

  // Notifications
  const notificationData = useMemo(() => {
    const unreadNotifications = uiState.notifications.filter(n => !n.read);
    return {
      unreadNotifications,
      hasUnreadNotifications: unreadNotifications.length > 0,
    };
  }, [uiState.notifications]);

  const { unreadNotifications, hasUnreadNotifications } = notificationData;

  // Listen for CMD+K command palette toggle and open search instead
  useEffect(() => {
    if (uiState.showCommandPalette) {
      setIslandState('search-expanded');
      // Close the command palette flag
      uiDispatch({ type: 'TOGGLE_COMMAND_PALETTE' });

      // Focus search input after a small delay to ensure it's rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [uiState.showCommandPalette, uiDispatch]);

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

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getNotificationColors = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return 'bg-gradient-to-r from-emerald-50/40 to-teal-50/40 border-white/50 text-gray-900';
      case 'info':
        return 'bg-gradient-to-r from-cyan-50/40 to-blue-50/40 border-white/50 text-gray-900';
      case 'warning':
        return 'bg-gradient-to-r from-amber-50/40 to-orange-50/40 border-white/50 text-gray-900';
      case 'error':
        return 'bg-gradient-to-r from-rose-50/40 to-red-50/40 border-white/50 text-gray-900';
    }
  };

  // Format elapsed time for session
  const formatElapsedTime = (startTime: string) => {
    const start = new Date(startTime).getTime();
    const now = new Date().getTime();
    const diff = now - start;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format relative time
  const formatRelativeTime = (timestamp: string) => {
    const now = new Date().getTime();
    const then = new Date(timestamp).getTime();
    const diff = now - then;

    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  // Quick Task Dropdown State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [showTaskSuccess, setShowTaskSuccess] = useState(false);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);

  // Quick Note Dropdown State
  const [noteInput, setNoteInput] = useState('');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Session State
  const [sessionDescription, setSessionDescription] = useState('');

  // Live time update for session elapsed time - using ref to avoid re-renders
  const sessionTimeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Update DOM directly every second when session island is open (no re-render needed)
    if (islandState === 'session-expanded' && activeSession) {
      const interval = setInterval(() => {
        if (sessionTimeRef.current) {
          sessionTimeRef.current.textContent = formatElapsedTime(activeSession.startTime);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [islandState, activeSession]);

  const handleCreateQuickTask = () => {
    if (!taskTitle.trim()) return;

    const newTask: Task = {
      id: generateId(),
      title: taskTitle,
      done: false,
      priority: 'medium',
      status: 'todo',
      createdBy: 'manual',
      createdAt: new Date().toISOString(),
      dueDate: taskDueDate || undefined,
    };

    addTask(newTask);
    setCreatedTaskId(newTask.id);
    setShowTaskSuccess(true);
    setTaskTitle('');
    setTaskDueDate('');

    // Auto-hide success after 2s
    setTimeout(() => {
      closeIsland();
    }, 2000);
  };

  const handleViewTask = () => {
    if (createdTaskId) {
      uiDispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'task', itemId: createdTaskId, label: 'Task Details' } });
      uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'tasks' });
      closeIsland();
    }
  };

  const handleSaveQuickNote = async () => {
    if (!noteInput.trim()) return;

    const newNote = {
      id: generateId(),
      content: noteInput,
      summary: noteInput.substring(0, 100),
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      source: 'thought' as const,
      tags: [],
    };

    addNote(newNote);

    addNotification({
      type: 'success',
      title: 'Quick Note Saved',
      message: 'Your note has been saved to notes',
    });

    closeIsland();
  };

  const handleSendToAI = async () => {
    if (!noteInput.trim()) return;

    addProcessingJob({
      type: 'note',
      input: noteInput,
      status: 'queued',
      progress: 0,
    });

    closeIsland();
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'capture' });
  };

  const isExpanded = islandState !== 'collapsed';

  return (
    <>
    {/* Blur overlay when island is expanded */}
    {isExpanded && (
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity duration-300 ease-out"
        style={{ opacity: isExpanded ? 1 : 0 }}
        onClick={closeIsland}
      />
    )}

    {/* Fixed Logo - Left */}
    <div className="fixed top-0 left-0 z-50 pt-4 px-6 pointer-events-none">
      <div className="flex items-center gap-2 px-3 py-3 bg-white/60 backdrop-blur-2xl rounded-3xl shadow-xl border-2 border-white/50 ring-1 ring-black/5 pointer-events-auto transition-all duration-300 hover:shadow-2xl hover:scale-105" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
          <span className="text-white font-bold text-xs">T</span>
        </div>
        <span className="font-bold text-lg bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
          Taskerino
        </span>
      </div>
    </div>

    {/* Fixed Profile - Right */}
    <div className="fixed top-0 right-0 z-50 pt-4 px-6 pointer-events-none">
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-3 rounded-3xl transition-all duration-300 shadow-xl border-2 border-white/50 backdrop-blur-2xl ring-1 ring-black/5 hover:scale-105 ${
              hasUnreadNotifications
                ? 'bg-white/90 text-cyan-600 shadow-cyan-200/40'
                : 'bg-white/60 text-gray-600 hover:bg-white/80 hover:shadow-2xl'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            title="Notifications"
            aria-label={`Notifications${hasUnreadNotifications ? ` (${unreadNotifications.length} unread)` : ''}`}
            aria-expanded={showNotifications}
            type="button"
          >
            <Bell className="w-5 h-5" />
            {hasUnreadNotifications && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                {unreadNotifications.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute top-full right-0 mt-2 w-96 backdrop-blur-2xl bg-white/40 rounded-[24px] border-2 border-white/50 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-4 py-3 border-b-2 border-white/30 bg-white/20">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Notifications</h3>
                  {uiState.notifications.length > 0 && (
                    <button
                      onClick={() => {
                        uiState.notifications.forEach(n => {
                          uiDispatch({ type: 'DISMISS_NOTIFICATION', payload: n.id });
                        });
                      }}
                      className="text-xs text-gray-600 hover:text-cyan-600 font-medium"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {uiState.notifications.length > 0 ? (
                  <div className="p-2 space-y-2">
                    {uiState.notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`${getNotificationColors(notification.type)} border-2 rounded-[16px] p-3 shadow-sm`}
                      >
                        <div className="flex items-start gap-3">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-gray-900">{notification.title}</h4>
                            <p className="text-sm mt-1 text-gray-600">{notification.message}</p>
                            {notification.action && (
                              <button
                                onClick={() => {
                                  if (notification.action?.onClick) {
                                    notification.action.onClick();
                                    uiDispatch({ type: 'MARK_NOTIFICATION_READ', payload: notification.id });
                                  }
                                }}
                                className="mt-2 text-sm font-semibold px-3 py-1.5 bg-white/50 hover:bg-white/70 backdrop-blur-sm rounded-[12px] transition-all border-2 border-white/60 text-gray-700 hover:text-cyan-600"
                              >
                                {notification.action.label}
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() => uiDispatch({ type: 'DISMISS_NOTIFICATION', payload: notification.id })}
                            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/60 transition-all text-gray-400 hover:text-gray-600"
                            aria-label="Dismiss"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600">No notifications</p>
                    <p className="text-xs text-gray-500 mt-1">You're all caught up!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Reference Panel Toggle */}
        {uiState.pinnedNotes.length > 0 && (
          <div className="relative">
            <button
              onClick={() => uiDispatch({ type: 'TOGGLE_REFERENCE_PANEL' })}
              className={`px-3 py-2 rounded-2xl text-sm font-medium transition-all duration-300 shadow-xl border-2 border-white/50 backdrop-blur-2xl ring-1 ring-black/5 hover:scale-105 ${
                uiState.referencePanelOpen
                  ? 'bg-white/90 text-cyan-600 shadow-cyan-200/40'
                  : 'bg-white/60 text-gray-600 hover:bg-white/80 hover:shadow-2xl'
              }`}
              style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              title="Toggle reference panel"
            >
              📌 {uiState.pinnedNotes.length}
            </button>

            {/* Reference Panel Tooltip */}
            <FeatureTooltip
              show={showReferencePanelTooltip}
              onDismiss={() => {
                setShowReferencePanelTooltip(false);
                uiDispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: 'referencePanel' });
              }}
              position="left"
              title="💡 Tip: Reference Panel"
              message={
                <div>
                  <p>You just pinned this note! Pinned notes stay visible in the right panel while you work.</p>
                  <p className="mt-2"><strong>Perfect for:</strong></p>
                  <ul className="list-disc ml-4 mt-1 space-y-1">
                    <li>Active project notes</li>
                    <li>Important contacts</li>
                    <li>Quick reference info</li>
                  </ul>
                  <p className="mt-2">Max 5 pins. Toggle panel with the button →</p>
                </div>
              }
              primaryAction={{
                label: "Got it",
                onClick: () => {},
              }}
            />
          </div>
        )}

        {/* Ned AI Assistant Button */}
        <button
          onClick={() => uiDispatch({ type: 'TOGGLE_NED_OVERLAY' })}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-3xl transition-all duration-300 shadow-xl border-2 border-white/50 backdrop-blur-2xl ring-1 ring-black/5 hover:scale-105 ${
            uiState.nedOverlay.isOpen
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-cyan-200/40'
              : 'bg-white/60 text-gray-700 hover:bg-white/80 hover:shadow-2xl'
          }`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          title="Ask Ned - Your AI Assistant (⌘J)"
        >
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold text-sm">Ask Ned</span>
        </button>

        {/* Profile Button */}
        <button
          onClick={handleProfileClick}
          className={`p-3 rounded-3xl transition-all duration-300 shadow-xl border-2 border-white/50 backdrop-blur-2xl ring-1 ring-black/5 hover:scale-105 ${
            activeTab === 'profile'
              ? 'bg-white/90 text-cyan-600 shadow-cyan-200/40'
              : 'bg-white/60 text-gray-600 hover:bg-white/80 hover:shadow-2xl'
          }`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          title="Profile & Settings (⌘,)"
        >
          <User className="w-5 h-5" />
        </button>
      </div>
    </div>

    {/* Dynamic Island - Center */}
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-6 pointer-events-none">
      <div
        ref={islandRef}
        className={`
          bg-white/40 backdrop-blur-2xl rounded-[40px] shadow-2xl border-2 border-white/50 ring-1 ring-black/5
          pointer-events-auto overflow-hidden
          ${isExpanded ? 'w-full max-w-2xl' : 'w-auto'}
        `}
        style={{
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: isExpanded ? 'width, height' : 'auto',
        }}
      >
        {/* Navigation Tabs */}
        <div className={`flex items-center justify-center gap-2 px-4 py-3 transition-all duration-200 ${isExpanded ? 'opacity-0 h-0 overflow-hidden py-0' : 'opacity-100'}`}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              // Badge logic for each tab
              let badge = 0;
              let badgeType: 'count' | 'status' | 'processing' = 'count';
              let badgeStatus: 'active' | 'paused' | null = null;

              if (tab.id === 'tasks') {
                badge = activeTasks;
              } else if (tab.id === 'capture') {
                if (hasActiveProcessing) {
                  badgeType = 'processing';
                  badge = processingJobs.length;
                } else if (hasCompletedItems) {
                  badge = completedJobs.length;
                }
              } else if (tab.id === 'sessions' && (isSessionActive || isSessionPaused)) {
                badgeType = 'status';
                badgeStatus = isSessionActive ? 'active' : 'paused';
              }

              // Quick action logic
              let hasQuickAction = false;
              if (tab.id === 'tasks' || tab.id === 'notes' || tab.id === 'sessions') {
                hasQuickAction = true; // Always show for tasks/notes/sessions
              }
              // Note: Capture tab has no quick action - badge itself is clickable

              const isHovered = hoveredTab === tab.id;

              return (
                <div
                  key={tab.id}
                  className="relative group"
                  onMouseEnter={() => setHoveredTab(tab.id)}
                  onMouseLeave={() => setHoveredTab(null)}
                >
                  <button
                    onClick={() => handleTabClick(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 ${
                      isActive
                        ? 'bg-white/90 backdrop-blur-lg shadow-lg text-cyan-600 border border-white/60'
                        : 'bg-white/50 backdrop-blur-md text-gray-600 hover:text-gray-900 hover:bg-white/80 hover:shadow-md border border-transparent hover:border-white/40'
                    } ${hasQuickAction && (isActive || isHovered) ? 'pr-10' : ''}`}
                    title={`${tab.label} (${tab.shortcut})`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>

                    {/* Regular count badge - clickable for Capture tab */}
                    {badge > 0 && badgeType === 'count' && (
                      tab.id === 'capture' ? (
                        <span
                          onClick={handleProcessingBadgeClick}
                          className="ml-1 px-1.5 py-0.5 bg-cyan-100 hover:bg-cyan-200 text-cyan-700 text-xs font-bold rounded-full min-w-[20px] text-center transition-all duration-200 hover:shadow-md cursor-pointer"
                        >
                          {badge}
                        </span>
                      ) : (
                        <span className="ml-1 px-1.5 py-0.5 bg-cyan-100 text-cyan-700 text-xs font-bold rounded-full min-w-[20px] text-center">
                          {badge}
                        </span>
                      )
                    )}

                    {/* Processing badge with spinner - clickable */}
                    {badgeType === 'processing' && badge > 0 && (
                      <span
                        onClick={handleProcessingBadgeClick}
                        className="ml-1 px-1.5 py-0.5 bg-gradient-to-r from-violet-100 to-purple-100 hover:from-violet-200 hover:to-purple-200 text-violet-700 text-xs font-bold rounded-full min-w-[20px] text-center flex items-center gap-1 transition-all duration-200 hover:shadow-md cursor-pointer"
                      >
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {badge}
                      </span>
                    )}

                    {/* Session status dot - clickable */}
                    {badgeType === 'status' && badgeStatus && (
                      <span
                        onClick={handleSessionBadgeClick}
                        className={`ml-1.5 w-2 h-2 rounded-full transition-all duration-200 hover:scale-150 cursor-pointer ${
                          badgeStatus === 'active' ? 'bg-green-500 animate-pulse shadow-lg shadow-green-400/50' : 'bg-yellow-500 shadow-lg shadow-yellow-400/50'
                        }`}
                        title="View session controls"
                      />
                    )}

                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />
                    )}
                  </button>

                  {/* Quick Action Button / Session Controls */}
                  {hasQuickAction && tab.id === 'sessions' && activeSession ? (
                    // Session controls: Pause/Resume + Stop (when session exists)
                    <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex gap-2 transition-all duration-200 ${
                      (isActive || isHovered) ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
                    }`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (isSessionActive) {
                            pauseSession();
                          } else {
                            resumeSession();
                          }
                        }}
                        className="p-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all duration-200"
                        title={isSessionActive ? 'Pause session' : 'Resume session'}
                      >
                        {isSessionActive ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          endSession();
                        }}
                        className="p-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:shadow-lg transition-all duration-200"
                        title="Stop session"
                      >
                        <Square className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : hasQuickAction ? (
                    // Regular quick action button (Plus for tasks/notes/sessions)
                    <button
                      onClick={(e) => handleQuickAction(tab.id, e)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all duration-200 ${
                        (isActive || isHovered) ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
                      }`}
                      title={
                        tab.id === 'tasks' ? 'Quick add task' :
                        tab.id === 'notes' ? 'Quick add note' :
                        tab.id === 'sessions' ? 'Start session' :
                        'View processing items'
                      }
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              );
            })}

            {/* Search Button */}
            <div className="h-8 w-px bg-white/30 mx-2"></div>
            <button
              onClick={handleSearchClick}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-600 hover:text-gray-900 bg-white/50 backdrop-blur-md hover:bg-white/80 hover:shadow-md transition-all duration-200 border border-transparent hover:border-white/40"
              title="Search (⌘K)"
            >
              <Search className="w-4 h-4" />
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">⌘K</kbd>
            </button>
        </div>

        {/* Search Mode - Spotlight-style integrated search */}
        {islandState === 'search-expanded' && (
          <div
            className="animate-in fade-in duration-300"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-white/30 bg-white/20">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeIsland();
                }}
                placeholder="Search anything or run a command..."
                className="flex-1 bg-transparent border-0 focus:outline-none text-base placeholder-gray-400 text-gray-900"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 hover:bg-white/60 rounded-lg transition-all duration-200"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
              <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {(() => {
                const query = searchQuery.toLowerCase();
                const taskResults = tasksState.tasks.filter(task =>
                  task.title.toLowerCase().includes(query)
                ).slice(0, 5);
                const noteResults = notesState.notes.filter(note =>
                  note.content.toLowerCase().includes(query) ||
                  note.summary.toLowerCase().includes(query) ||
                  note.tags.some(tag => tag.toLowerCase().includes(query))
                ).slice(0, 5);
                const topicResults = entitiesState.topics.filter(topic =>
                  topic.name.toLowerCase().includes(query)
                ).slice(0, 3);

                const hasResults = taskResults.length > 0 || noteResults.length > 0 || topicResults.length > 0;
                const showActions = !searchQuery || !hasResults;

                return (
                  <div className="p-2">
                    {/* Quick Actions - Always show when no search or no results */}
                    {showActions && (
                      <div className="mb-2">
                        <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Actions</div>
                        <div className="space-y-1">
                          <button
                            onClick={() => {
                              uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'capture' });
                              closeIsland();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                              <Edit3 className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Go to Capture</div>
                              <div className="text-xs text-gray-500">Create and process notes</div>
                            </div>
                            <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘1</kbd>
                          </button>

                          <button
                            onClick={() => {
                              uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'tasks' });
                              closeIsland();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <CheckSquare className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Go to Tasks</div>
                              <div className="text-xs text-gray-500">Manage your tasks</div>
                            </div>
                            <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘2</kbd>
                          </button>

                          <button
                            onClick={() => {
                              uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'notes' });
                              closeIsland();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                              <BookOpen className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Go to Notes</div>
                              <div className="text-xs text-gray-500">Browse all notes</div>
                            </div>
                            <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘3</kbd>
                          </button>

                          <button
                            onClick={() => {
                              uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'sessions' });
                              closeIsland();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                              <Activity className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Go to Sessions</div>
                              <div className="text-xs text-gray-500">Track work sessions</div>
                            </div>
                            <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘5</kbd>
                          </button>

                          <button
                            onClick={() => {
                              uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'assistant' });
                              closeIsland();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Ask AI Assistant</div>
                              <div className="text-xs text-gray-500">Get help with your notes</div>
                            </div>
                            <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘4</kbd>
                          </button>

                          <div className="h-px bg-white/30 my-2" />

                          <button
                            onClick={() => {
                              setIslandState('task-expanded');
                              setSearchQuery('');
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <Plus className="w-4 h-4 text-cyan-600" />
                            <div className="text-sm font-medium text-gray-900">Create New Task</div>
                          </button>

                          <button
                            onClick={() => {
                              setIslandState('note-expanded');
                              setSearchQuery('');
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <Plus className="w-4 h-4 text-purple-600" />
                            <div className="text-sm font-medium text-gray-900">Create New Note</div>
                          </button>

                          <button
                            onClick={() => {
                              uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'profile' });
                              closeIsland();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <Settings className="w-4 h-4 text-gray-600" />
                            <div className="text-sm font-medium text-gray-900">Settings</div>
                            <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘,</kbd>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Search Results */}
                    {searchQuery && hasResults && (
                      <>
                        {/* Tasks */}
                        {taskResults.length > 0 && (
                          <div className="mb-2">
                            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasks</div>
                            <div className="space-y-1">
                              {taskResults.map(task => (
                                <button
                                  key={task.id}
                                  onClick={() => {
                                    uiDispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'task', itemId: task.id, label: task.title } });
                                    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'tasks' });
                                    closeIsland();
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left"
                                >
                                  <CheckSquare className={`w-4 h-4 ${task.done ? 'text-green-600' : 'text-cyan-600'}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium truncate ${task.done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                      {task.title}
                                    </div>
                                    {(task.dueDate || task.priority !== 'medium') && (
                                      <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                        {task.priority !== 'medium' && (
                                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                                            task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                            task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                            'bg-blue-100 text-blue-700'
                                          }`}>
                                            {task.priority}
                                          </span>
                                        )}
                                        {task.dueDate && <span>{new Date(task.dueDate).toLocaleDateString()}</span>}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {noteResults.length > 0 && (
                          <div className="mb-2">
                            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</div>
                            <div className="space-y-1">
                              {noteResults.map(note => (
                                <button
                                  key={note.id}
                                  onClick={() => {
                                    uiDispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'note', itemId: note.id, label: note.summary } });
                                    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'notes' });
                                    closeIsland();
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left"
                                >
                                  <BookOpen className="w-4 h-4 text-purple-600" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">{note.summary}</div>
                                    {note.tags.length > 0 && (
                                      <div className="flex gap-1 mt-0.5">
                                        {note.tags.slice(0, 2).map(tag => (
                                          <span key={tag} className="text-xs text-gray-500">#{tag}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Topics */}
                        {topicResults.length > 0 && (
                          <div className="mb-2">
                            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Topics</div>
                            <div className="space-y-1">
                              {topicResults.map(topic => (
                                <button
                                  key={topic.id}
                                  onClick={() => {
                                    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'notes' });
                                    closeIsland();
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left"
                                >
                                  <Command className="w-4 h-4 text-cyan-600" />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">{topic.name}</div>
                                    <div className="text-xs text-gray-500">{topic.noteCount} notes</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* No results */}
                    {searchQuery && !hasResults && (
                      <div className="text-center py-8">
                        <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-900 mb-1">No results found</p>
                        <p className="text-xs text-gray-500">Try a different search term</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="border-t-2 border-white/30 px-4 py-2 bg-white/20 flex items-center justify-between text-xs text-gray-600">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white/60 border border-white/60 rounded text-xs">↵</kbd>
                  <span>Select</span>
                </div>
              </div>
              <div>
                Press <kbd className="px-1.5 py-0.5 bg-white/60 border border-white/60 rounded">⌘K</kbd> to open
              </div>
            </div>
          </div>
        )}

        {/* Expanded Content Area - Tasks */}
        {islandState === 'task-expanded' && (
          <div
            className="px-6 pb-5 pt-4 animate-in fade-in duration-300"
          >
            {!showTaskSuccess ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && taskTitle.trim()) handleCreateQuickTask();
                    if (e.key === 'Escape') closeIsland();
                  }}
                  placeholder="What needs to be done?"
                  className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-white/50 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:bg-white/80 transition-all placeholder-gray-400"
                  autoFocus
                />

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500 ml-1" />
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white/60 backdrop-blur-sm border-2 border-white/50 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:bg-white/80 transition-all text-sm"
                  />
                </div>

                {taskTitle.trim() && (
                  <button
                    onClick={handleCreateQuickTask}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold hover:shadow-xl transform hover:scale-105 transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600"
                  >
                    Create Task
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-3">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Task Created</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleViewTask}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
                  >
                    View
                  </button>
                  <button
                    onClick={closeIsland}
                    className="flex-1 px-3 py-2 bg-white/60 hover:bg-white/80 text-gray-700 rounded-xl text-sm font-semibold transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {islandState === 'note-expanded' && (
          <div
            className="animate-in fade-in duration-300"
          >
            <div className="px-2 pt-2">
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeIsland();
                }}
                placeholder="Capture your thoughts..."
                className="w-full px-4 py-3 bg-transparent border-0 focus:outline-none focus:ring-0 text-base min-h-[100px] resize-none placeholder-gray-400"
                autoFocus
              />
            </div>

            {noteInput.trim() && (
              <div className="px-4 pb-4 pt-2 flex gap-2">
                <button
                  onClick={handleSaveQuickNote}
                  className="flex items-center gap-2 px-4 py-2 bg-white/60 hover:bg-white/80 backdrop-blur-sm rounded-xl transition-all text-sm font-semibold text-gray-700 hover:text-cyan-600"
                >
                  <Save className="w-4 h-4" />
                  Save Note
                </button>
                <button
                  onClick={handleSendToAI}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold hover:shadow-xl transform hover:scale-105 transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600"
                >
                  Process & File
                </button>
              </div>
            )}
          </div>
        )}

        {/* Processing Status View */}
        {islandState === 'processing-expanded' && (
          <div className="animate-in fade-in duration-300 px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-sm">Processing Status</h3>
              <button
                onClick={closeIsland}
                className="p-1 hover:bg-white/60 rounded-lg transition-all"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {/* Active Processing Jobs */}
              {processingJobs.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-2">
                    Processing Now
                  </div>
                  {processingJobs.map((job) => (
                    <div
                      key={job.id}
                      className="bg-gradient-to-r from-violet-50/80 to-purple-50/80 border border-violet-200/60 rounded-[16px] p-3 mb-2"
                    >
                      <div className="flex items-start gap-3">
                        <Loader2 className="w-4 h-4 text-violet-600 animate-spin flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 line-clamp-2">
                            {job.input}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 bg-violet-200/40 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-violet-500 to-purple-500 h-full transition-all duration-500"
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-violet-700">
                              {job.progress}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed Jobs */}
              {completedJobs.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-cyan-600 uppercase tracking-wide mb-2 mt-3">
                    Ready to Review ({completedJobs.length})
                  </div>
                  {completedJobs.map((job) => (
                    <div
                      key={job.id}
                      className="bg-cyan-50/80 border border-cyan-200/60 rounded-[16px] p-3 mb-2 cursor-pointer hover:bg-cyan-100/80 transition-all"
                      onClick={() => {
                        uiDispatch({ type: 'SET_PENDING_REVIEW_JOB', payload: job.id });
                        uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'capture' });
                        closeIsland();
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 line-clamp-2">
                            {job.input}
                          </p>
                          <p className="text-xs text-cyan-600 mt-1 font-medium">
                            Click to review
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {processingJobs.length === 0 && completedJobs.length === 0 && (
                <div className="text-center py-8">
                  <Edit3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600">No processing activity</p>
                  <p className="text-xs text-gray-500 mt-1">Capture notes to get started</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Session Control View */}
        {islandState === 'session-expanded' && (
          <div className="animate-in fade-in duration-300 px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-sm">
                {activeSession ? 'Session Control' : 'Start New Session'}
              </h3>
              <button
                onClick={closeIsland}
                className="p-1 hover:bg-white/60 rounded-lg transition-all"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {activeSession ? (
              <>
                {/* Session Info Card */}
                <div className="bg-gradient-to-r from-orange-50/40 to-red-50/40 border-2 border-white/50 rounded-[16px] p-4 mb-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 text-base">{activeSession.name}</h4>
                      <p className="text-sm text-gray-600 mt-0.5">{activeSession.description}</p>
                    </div>
                  </div>

                  {/* Session Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t-2 border-white/30">
                    <div className="text-center">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Duration</div>
                      <div ref={sessionTimeRef} className="text-lg font-bold text-gray-900">{formatElapsedTime(activeSession.startTime)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Screenshots</div>
                      <div className="text-lg font-bold text-gray-900">{activeSession.screenshots.length}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Last Capture</div>
                      <div className="text-sm font-semibold text-gray-700">
                        {activeSession.lastScreenshotTime
                          ? formatRelativeTime(activeSession.lastScreenshotTime)
                          : 'None yet'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex gap-3 mb-3">
                  <button
                    onClick={() => {
                      if (isSessionActive) {
                        pauseSession();
                      } else {
                        resumeSession();
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-[16px] font-semibold hover:shadow-lg transition-all text-sm"
                  >
                    {isSessionActive ? (
                      <>
                        <Pause className="w-4 h-4" />
                        Pause Session
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Resume Session
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Stop this session? You can view the results in the Sessions page.')) {
                        endSession();
                        closeIsland();
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-[16px] font-semibold hover:shadow-lg transition-all text-sm"
                  >
                    <Square className="w-4 h-4" />
                    Stop Session
                  </button>
                </div>

                {/* View All Button */}
                <button
                  onClick={() => {
                    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'sessions' });
                    closeIsland();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 backdrop-blur-sm rounded-[16px] transition-all border-2 border-white/60 text-gray-700 hover:text-orange-600 font-medium text-sm"
                >
                  View All Screenshots
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                {!isStarting ? (
                  <div className="space-y-3">
                    <textarea
                      value={sessionDescription}
                      onChange={(e) => setSessionDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') closeIsland();
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && sessionDescription.trim()) {
                          e.preventDefault();
                          // Use session starting hook for countdown and navigation
                          const savedSettings = loadLastSessionSettings();
                          const sessionName = `Session - ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
                          handleStartSession({
                            name: sessionName,
                            description: sessionDescription,
                            status: 'active',
                            screenshotInterval: savedSettings.screenshotInterval,
                            autoAnalysis: savedSettings.autoAnalysis,
                            tags: [],
                            audioRecording: savedSettings.audioRecording,
                            enableScreenshots: savedSettings.enableScreenshots,
                            videoRecording: savedSettings.videoRecording,
                            audioMode: savedSettings.audioRecording ? 'transcription' : 'off',
                            audioReviewCompleted: false,
                          }).then(() => {
                            // Clean up UI after countdown completes
                            setTimeout(() => {
                              closeIsland();
                              setSessionDescription('');
                            }, 500);
                          });
                        }
                      }}
                      placeholder="What are you working on?"
                      className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border-2 border-white/50 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white/80 transition-all placeholder-gray-400 min-h-[100px] resize-none"
                      autoFocus
                    />

                    {sessionDescription.trim() && (
                      <button
                        onClick={() => {
                          // Use session starting hook for countdown and navigation
                          const savedSettings = loadLastSessionSettings();
                          const sessionName = `Session - ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
                          handleStartSession({
                            name: sessionName,
                            description: sessionDescription,
                            status: 'active',
                            screenshotInterval: savedSettings.screenshotInterval,
                            autoAnalysis: savedSettings.autoAnalysis,
                            tags: [],
                            audioRecording: savedSettings.audioRecording,
                            enableScreenshots: savedSettings.enableScreenshots,
                            videoRecording: savedSettings.videoRecording,
                            audioMode: savedSettings.audioRecording ? 'transcription' : 'off',
                            audioReviewCompleted: false,
                          }).then(() => {
                            // Clean up UI after countdown completes
                            setTimeout(() => {
                              closeIsland();
                              setSessionDescription('');
                            }, 500);
                          });
                        }}
                        className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-[16px] font-bold hover:shadow-xl transition-all text-sm flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Start Session
                      </button>
                    )}

                    <p className="text-xs text-gray-500 text-center">
                      Press ⌘Enter to start
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-3">
                    {countdown !== null && countdown > 0 ? (
                      <>
                        <div className="text-5xl font-bold text-orange-600 mb-2">{countdown}</div>
                        <p className="text-sm font-semibold text-gray-700">Starting session...</p>
                      </>
                    ) : countdown === 0 ? (
                      <>
                        <div className="text-3xl mb-2">🎬</div>
                        <p className="text-sm font-semibold text-gray-700">Recording!</p>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl mb-2">🎬</div>
                        <p className="text-sm font-semibold text-gray-700">Starting...</p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </nav>

    </>
  );
}
