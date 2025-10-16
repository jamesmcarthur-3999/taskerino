import { useEffect } from 'react';
import { useUI } from '../context/UIContext';
import { X, CheckCircle2, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import type { Notification, NotificationType } from '../types';

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
        return <Info className="w-5 h-5 text-blue-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getColors = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return 'bg-white/30 backdrop-blur-2xl border-green-200/40 text-green-900';
      case 'info':
        return 'bg-white/30 backdrop-blur-2xl border-blue-200/40 text-blue-900';
      case 'warning':
        return 'bg-white/30 backdrop-blur-2xl border-yellow-200/40 text-yellow-900';
      case 'error':
        return 'bg-white/30 backdrop-blur-2xl border-red-200/40 text-red-900';
    }
  };

  if (uiState.notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md pointer-events-none">
      {uiState.notifications.map((notification) => (
        <div
          key={notification.id}
          className={`${getColors(notification.type)} border-2 rounded-[24px] shadow-xl p-4 pointer-events-auto animate-slide-in-right`}
        >
          <div className="flex items-start gap-3">
            {getIcon(notification.type)}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm">{notification.title}</h4>
              <p className="text-sm mt-1 opacity-90">{notification.message}</p>
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
