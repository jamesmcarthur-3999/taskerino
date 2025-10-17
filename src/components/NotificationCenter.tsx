import { useEffect } from 'react';
import { useUI } from '../context/UIContext';
import { X, CheckCircle2, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import type { Notification, NotificationType } from '../types';
import { getToastClasses, Z_INDEX } from '../design-system/theme';

export function NotificationCenter() {
  const { state: uiState, dispatch: uiDispatch } = useUI();

  // Auto-dismiss notifications after specified time
  useEffect(() => {
    const timers: Record<string, NodeJS.Timeout> = {};

    uiState.notifications.forEach(notification => {
      if (notification.autoDismiss !== false && !notification.read) {
        const dismissAfter = notification.dismissAfter || 5000;
        timers[notification.id] = setTimeout(() => {
          uiDispatch({ type: 'DISMISS_NOTIFICATION', payload: notification.id });
        }, dismissAfter);
      }
    });

    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, [uiState.notifications, uiDispatch]);

  const handleDismiss = (id: string) => {
    uiDispatch({ type: 'DISMISS_NOTIFICATION', payload: id });
  };

  const handleAction = (notification: Notification) => {
    if (notification.action?.onClick) {
      notification.action.onClick();
      uiDispatch({ type: 'MARK_NOTIFICATION_READ', payload: notification.id });
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-cyan-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getToastVariant = (type: NotificationType): 'info' | 'success' | 'warning' | 'error' => {
    return type;
  };

  if (uiState.notifications.length === 0) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 ${Z_INDEX.notification} flex flex-col gap-2 max-w-md pointer-events-none`}>
      {uiState.notifications.map((notification) => (
        <div
          key={notification.id}
          className={`${getToastClasses(getToastVariant(notification.type))} pointer-events-auto animate-slide-in-right`}
        >
          <div className="flex items-start gap-3">
            {getIcon(notification.type)}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-gray-900">{notification.title}</h4>
              <p className="text-sm mt-1 text-gray-700">{notification.message}</p>
              {notification.action && (
                <button
                  onClick={() => handleAction(notification)}
                  className="mt-2 text-sm font-semibold px-3 py-1.5 bg-white/40 hover:bg-white/60 backdrop-blur-sm rounded-[16px] transition-all border border-white/60"
                >
                  {notification.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => handleDismiss(notification.id)}
              className="flex-shrink-0 p-1.5 rounded-[16px] hover:bg-white/60 transition-all hover:scale-105 active:scale-95"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
