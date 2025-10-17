import { useState, useEffect, useCallback } from 'react';
import { useUI } from '../context/UIContext';
import { useScrollAnimation } from '../contexts/ScrollAnimationContext';
import CaptureZone from './CaptureZone';
import TasksZone from './TasksZone';
import LibraryZone from './LibraryZone';
import AssistantZone from './AssistantZone';
import ProfileZone from './ProfileZone';
import { SettingsModal } from './SettingsModal';
import { CommandPalette } from './CommandPalette';
import { TaskDetailSidebar } from './TaskDetailSidebar';
import { NoteDetailSidebar } from './NoteDetailSidebar';
import { ChevronUp, ChevronDown, User } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getGradientClasses } from '../design-system/theme';

type Zone = 'assistant' | 'capture' | 'tasks' | 'notes' | 'sessions' | 'profile';

export function ZoneLayout() {
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { resetScroll } = useScrollAnimation();
  const [currentZone, setCurrentZone] = useState<Zone>('capture');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const navigateToZone = useCallback((zone: Zone) => {
    setCurrentZone(zone);
    uiDispatch({ type: 'SET_ZONE', payload: zone });
    // Reset scroll position when switching zones
    resetScroll();
  }, [uiDispatch, resetScroll]);

  // Listen for zone changes from app state (e.g., "View Notes" button)
  useEffect(() => {
    if (uiState.currentZone && uiState.currentZone !== currentZone) {
      setCurrentZone(uiState.currentZone);
      // Reset scroll position when zone changes externally
      resetScroll();
    }
  }, [uiState.currentZone, currentZone, resetScroll]);

  const handleNavClick = (direction: 'up' | 'down') => {
    if (direction === 'up') {
      if (currentZone === 'profile') navigateToZone('notes');
      else if (currentZone === 'notes') navigateToZone('tasks');
      else if (currentZone === 'tasks') navigateToZone('capture');
      else if (currentZone === 'capture') navigateToZone('assistant');
    } else {
      if (currentZone === 'assistant') navigateToZone('capture');
      else if (currentZone === 'capture') navigateToZone('tasks');
      else if (currentZone === 'tasks') navigateToZone('notes');
      else if (currentZone === 'notes') navigateToZone('profile');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette: Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      // Settings: Cmd/Ctrl + ,
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      // Zone navigation: Cmd/Ctrl + Up/Down
      if (!(e.metaKey || e.ctrlKey)) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentZone === 'profile') navigateToZone('notes');
        else if (currentZone === 'notes') navigateToZone('tasks');
        else if (currentZone === 'tasks') navigateToZone('capture');
        else if (currentZone === 'capture') navigateToZone('assistant');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentZone === 'assistant') navigateToZone('capture');
        else if (currentZone === 'capture') navigateToZone('tasks');
        else if (currentZone === 'tasks') navigateToZone('notes');
        else if (currentZone === 'notes') navigateToZone('profile');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentZone, navigateToZone]);

  // Listen for Tauri global hotkey events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.listen('navigate-to-capture', () => {
          navigateToZone('capture');
        });
      } catch (error) {
        // Tauri might not be available in dev mode without tauri dev
        console.log('Tauri event listener not available:', error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [navigateToZone]);

  return (
    <>
      {/* Render all zones, show/hide with transitions to preserve state */}
      <div className="h-screen w-screen overflow-hidden relative">
        <div
          className={`absolute inset-0 transition-all duration-500 ease-in-out ${
            currentZone === 'assistant'
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <AssistantZone />
        </div>

        <div
          className={`absolute inset-0 transition-all duration-500 ease-in-out ${
            currentZone === 'capture'
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <CaptureZone />
        </div>

        <div
          className={`absolute inset-0 transition-all duration-500 ease-in-out ${
            currentZone === 'tasks'
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <TasksZone />
        </div>

        <div
          className={`absolute inset-0 transition-all duration-500 ease-in-out ${
            currentZone === 'notes'
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <LibraryZone />
        </div>

        <div
          className={`absolute inset-0 transition-all duration-500 ease-in-out ${
            currentZone === 'profile'
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <ProfileZone />
        </div>
      </div>

      {/* Navigation Arrows */}
      {currentZone !== 'assistant' && (
        <button
          onClick={() => handleNavClick('up')}
          className="fixed top-8 left-1/2 -translate-x-1/2 z-40 p-3 bg-white/80 backdrop-blur-xl rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200"
          aria-label="Scroll up"
        >
          <ChevronUp className="w-6 h-6 text-gray-600" />
        </button>
      )}

      {currentZone !== 'profile' && (
        <button
          onClick={() => handleNavClick('down')}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 p-3 bg-white/80 backdrop-blur-xl rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200"
          aria-label="Scroll down"
        >
          <ChevronDown className="w-6 h-6 text-gray-600" />
        </button>
      )}

      {/* Zone Indicator - Clickable */}
      <div className="fixed right-8 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-4">
        <button
          onClick={() => navigateToZone('assistant')}
          className={`w-2 h-2 rounded-full transition-all duration-200 hover:scale-125 ${
            currentZone === 'assistant' ? `${getGradientClasses('ocean', 'primary')} scale-150` : 'bg-gray-300'
          }`}
          aria-label="Go to Assistant"
        />
        <button
          onClick={() => navigateToZone('capture')}
          className={`w-2 h-2 rounded-full transition-all duration-200 hover:scale-125 ${
            currentZone === 'capture' ? `${getGradientClasses('ocean', 'primary')} scale-150` : 'bg-gray-300'
          }`}
          aria-label="Go to Capture"
        />
        <button
          onClick={() => navigateToZone('tasks')}
          className={`w-2 h-2 rounded-full transition-all duration-200 hover:scale-125 ${
            currentZone === 'tasks' ? `${getGradientClasses('ocean', 'primary')} scale-150` : 'bg-gray-300'
          }`}
          aria-label="Go to Tasks"
        />
        <button
          onClick={() => navigateToZone('notes')}
          className={`w-2 h-2 rounded-full transition-all duration-200 hover:scale-125 ${
            currentZone === 'notes' ? `${getGradientClasses('ocean', 'primary')} scale-150` : 'bg-gray-300'
          }`}
          aria-label="Go to Notes"
        />
        <button
          onClick={() => navigateToZone('profile')}
          className={`w-2 h-2 rounded-full transition-all duration-200 hover:scale-125 ${
            currentZone === 'profile' ? `${getGradientClasses('ocean', 'primary')} scale-150` : 'bg-gray-300'
          }`}
          aria-label="Go to Profile"
        />
      </div>

      {/* Top-Right Quick Access */}
      <div className="fixed top-8 right-8 z-40 flex items-center gap-3">
        <button
          onClick={() => navigateToZone('profile')}
          className={`p-4 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 group ${
            currentZone === 'profile'
              ? `${getGradientClasses('ocean', 'accent')} scale-110`
              : 'hover:scale-110'
          }`}
          aria-label="Go to Profile & Settings"
        >
          {currentZone === 'profile' ? (
            <User className="w-6 h-6 text-white" />
          ) : (
            <User className="w-6 h-6 text-gray-600 group-hover:text-cyan-600 transition-colors" />
          )}
        </button>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Sidebar - renders based on uiState.sidebar */}
      {uiState.sidebar.type === 'task' && uiState.sidebar.itemId && (
        <TaskDetailSidebar taskId={uiState.sidebar.itemId} />
      )}
      {uiState.sidebar.type === 'note' && uiState.sidebar.itemId && (
        <NoteDetailSidebar noteId={uiState.sidebar.itemId} />
      )}

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
