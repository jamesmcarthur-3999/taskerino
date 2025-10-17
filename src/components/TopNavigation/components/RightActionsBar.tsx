/**
 * RightActionsBar Component
 *
 * Right-side action buttons (notifications, reference panel, AI assistant, profile)
 */

import { useRef, useEffect } from 'react';
import { Bell, User, Sparkles, X, CheckCircle2, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import type { TabType, Notification, NotificationType } from '../../../types';
import { NavButton } from './NavButton';
import { FeatureTooltip } from '../../FeatureTooltip';
import { getSuccessGradient, getInfoGradient, getWarningGradient, getDangerGradient, getNavButtonClasses } from '../../../design-system/theme';

export interface RightActionsBarProps {
  // Notification state
  notificationData: {
    unreadNotifications: Notification[];
    hasUnreadNotifications: boolean;
  };
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
  notifications: Notification[];

  // Reference panel state
  pinnedNotesCount: number;
  referencePanelOpen: boolean;
  onToggleReferencePanel: () => void;
  showReferencePanelTooltip: boolean;
  setShowReferencePanelTooltip: (show: boolean) => void;

  // Ned AI state
  nedOverlayOpen: boolean;
  onToggleNedOverlay: () => void;

  // Profile state
  activeTab: TabType;
  onProfileClick: () => void;

  // Actions
  uiDispatch: any;
}

export function RightActionsBar({
  notificationData,
  showNotifications,
  setShowNotifications,
  notifications,
  pinnedNotesCount,
  referencePanelOpen,
  onToggleReferencePanel,
  showReferencePanelTooltip,
  setShowReferencePanelTooltip,
  nedOverlayOpen,
  onToggleNedOverlay,
  activeTab,
  onProfileClick,
  uiDispatch,
}: RightActionsBarProps) {
  const notificationsRef = useRef<HTMLDivElement>(null);
  const { unreadNotifications, hasUnreadNotifications } = notificationData;

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
  }, [showNotifications, setShowNotifications]);

  // Helper functions for notifications
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
        return `${getSuccessGradient('light').container} text-gray-900`;
      case 'info':
        return `${getInfoGradient('light').container} text-gray-900`;
      case 'warning':
        return `${getWarningGradient('light').container} text-gray-900`;
      case 'error':
        return `${getDangerGradient('light').container} text-gray-900`;
    }
  };

  return (
    <div className="fixed top-0 right-0 z-50 pt-4 px-6 pointer-events-none">
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Notifications Button */}
        <div className="relative" ref={notificationsRef}>
          <NavButton
            variant="icon"
            icon={Bell}
            isActive={hasUnreadNotifications}
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
            aria-label={`Notifications${hasUnreadNotifications ? ` (${unreadNotifications.length} unread)` : ''}`}
            aria-expanded={showNotifications}
          >
            {hasUnreadNotifications && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                {unreadNotifications.length}
              </span>
            )}
          </NavButton>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute top-full right-0 mt-2 w-96 backdrop-blur-2xl bg-white/40 rounded-[24px] border-2 border-white/50 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header */}
              <div className="px-4 py-3 border-b-2 border-white/30 bg-white/20">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Notifications</h3>
                  {notifications.length > 0 && (
                    <button
                      onClick={() => {
                        notifications.forEach(n => {
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

              {/* Notifications List */}
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  <div className="p-2 space-y-2">
                    {notifications.map((notification) => (
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

        {/* Reference Panel Toggle (only show when there are pinned notes) */}
        {pinnedNotesCount > 0 && (
          <div className="relative">
            <button
              onClick={onToggleReferencePanel}
              className={`${getNavButtonClasses('default', referencePanelOpen)} text-sm font-medium`}
              style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              title="Toggle reference panel"
            >
              📌 {pinnedNotesCount}
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

        {/* Ask Ned AI Assistant Button */}
        <NavButton
          variant="action"
          icon={Sparkles}
          label="Ask Ned"
          isActive={nedOverlayOpen}
          onClick={onToggleNedOverlay}
          title="Ask Ned - Your AI Assistant (⌘J)"
        />

        {/* Profile Button */}
        <NavButton
          variant="icon"
          icon={User}
          isActive={activeTab === 'profile'}
          onClick={onProfileClick}
          title="Profile & Settings (⌘,)"
        />
      </div>
    </div>
  );
}
