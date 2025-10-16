import React, { useState } from 'react';
import { Settings, EyeOff } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { useSessions } from '../context/SessionsContext';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function FloatingControls() {
  const { dispatch: uiDispatch } = useUI();
  const { sessions, activeSessionId } = useSessions();
  const [isExpanded, setIsExpanded] = useState(false);
  const activeSession = sessions.find(s => s.id === activeSessionId);

  const handleMinimize = async () => {
    try {
      const window = getCurrentWindow();
      await window.hide();
    } catch (error) {
      console.error('Failed to minimize:', error);
    }
  };

  const handleOpenSettings = () => {
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'profile' });
  };

  // Don't show if no active session
  if (!activeSession) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className={`
        backdrop-blur-2xl bg-white/40 rounded-full border-2 border-white/50 shadow-2xl
        transition-all duration-300 ease-out
        ${isExpanded ? 'px-4 py-3' : 'p-3'}
      `}>
        <div className="flex items-center gap-3">
          {/* Recording indicator */}
          <div className="flex items-center gap-2">
            <div className={`
              w-2 h-2 rounded-full
              ${activeSession.status === 'active' ? 'bg-red-500 animate-pulse' : 'bg-yellow-400'}
            `} />
            {isExpanded && (
              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-200">
                {activeSession.status === 'active' ? 'Recording' : 'Paused'}
              </span>
            )}
          </div>

          {/* Action buttons - only show when expanded */}
          {isExpanded && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
              <button
                onClick={handleOpenSettings}
                className="p-2 hover:bg-white/60 rounded-full transition-all hover:scale-110 active:scale-95"
                title="Settings"
              >
                <Settings size={18} className="text-gray-700" />
              </button>
              <button
                onClick={handleMinimize}
                className="p-2 hover:bg-white/60 rounded-full transition-all hover:scale-110 active:scale-95"
                title="Minimize (⌘⇧T)"
              >
                <EyeOff size={18} className="text-gray-700" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
