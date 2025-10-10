import { useEffect } from 'react';
import { useApp } from '../context/AppContext';

export function useKeyboardShortcuts() {
  const { dispatch } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      // Don't trigger shortcuts when typing in inputs/textareas
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isMod && !isInput) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            dispatch({ type: 'SET_ACTIVE_TAB', payload: 'capture' });
            break;

          case '2':
            e.preventDefault();
            dispatch({ type: 'SET_ACTIVE_TAB', payload: 'tasks' });
            break;

          case '3':
            e.preventDefault();
            dispatch({ type: 'SET_ACTIVE_TAB', payload: 'library' });
            break;

          case '4':
            e.preventDefault();
            dispatch({ type: 'SET_ACTIVE_TAB', payload: 'assistant' });
            break;

          case ',':
            e.preventDefault();
            dispatch({ type: 'SET_ACTIVE_TAB', payload: 'profile' });
            break;

          case 'k':
            e.preventDefault();
            dispatch({ type: 'TOGGLE_COMMAND_PALETTE' });
            break;

          case 'n':
            if (isShift) {
              // ⌘⇧N - Quick task capture
              e.preventDefault();
              dispatch({ type: 'TOGGLE_QUICK_CAPTURE' });
            }
            // ⌘N without shift - handled in specific zones
            break;

          case 'r':
            if (isShift) {
              // ⌘⇧R - Toggle reference panel
              e.preventDefault();
              dispatch({ type: 'TOGGLE_REFERENCE_PANEL' });
            }
            break;
        }
      }

      // Help shortcut (⌘/)
      if (isMod && e.key === '/') {
        e.preventDefault();
        // TODO: Show keyboard shortcuts help modal
        console.log('Keyboard shortcuts help - to be implemented');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);
}
