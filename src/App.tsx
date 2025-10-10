import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { TopNavigation } from './components/TopNavigation';
import { NotificationCenter } from './components/NotificationCenter';
import { ReferencePanel } from './components/ReferencePanel';
import { QuickTaskModal } from './components/QuickTaskModal';
import { CaptureZone } from './components/CaptureZone';
import { TasksZone } from './components/TasksZone';
import { LibraryZone } from './components/LibraryZone';
import { AssistantZone } from './components/AssistantZone';
import { ProfileZone } from './components/ProfileZone';
import { TaskDetailSidebar } from './components/TaskDetailSidebar';
import { NoteDetailSidebar } from './components/NoteDetailSidebar';
import { WelcomeFlow } from './components/WelcomeFlow';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { claudeService } from './services/claudeService';

function MainApp() {
  const { state } = useApp();

  // Enable global keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Top Navigation */}
      <TopNavigation />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden">
        {state.ui.activeTab === 'capture' && <CaptureZone />}
        {state.ui.activeTab === 'tasks' && <TasksZone />}
        {state.ui.activeTab === 'library' && <LibraryZone />}
        {state.ui.activeTab === 'assistant' && <AssistantZone />}
        {state.ui.activeTab === 'profile' && <ProfileZone />}
      </main>

      {/* Global Overlays */}
      <NotificationCenter />
      <ReferencePanel />
      <QuickTaskModal />

      {/* Sidebar (for task/note details) */}
      {state.sidebar.isOpen && state.sidebar.type === 'task' && state.sidebar.itemId && (
        <TaskDetailSidebar taskId={state.sidebar.itemId} />
      )}
      {state.sidebar.isOpen && state.sidebar.type === 'note' && state.sidebar.itemId && (
        <NoteDetailSidebar noteId={state.sidebar.itemId} />
      )}
    </div>
  );
}

function AppContent() {
  const { state, dispatch } = useApp();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Load API key on mount
    const savedKey = localStorage.getItem('claude-api-key');
    if (savedKey) {
      claudeService.setApiKey(savedKey);
    }
    setIsReady(true);
  }, []);

  const handleWelcomeComplete = (name: string, apiKey: string) => {
    // Save API key
    localStorage.setItem('claude-api-key', apiKey);
    claudeService.setApiKey(apiKey);

    // Save user name
    dispatch({ type: 'UPDATE_USER_PROFILE', payload: { name } });

    // Mark onboarding as complete
    dispatch({ type: 'COMPLETE_ONBOARDING' });

    // Show notification
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        type: 'success',
        title: `Welcome, ${name}!`,
        message: 'You\'re all set! Start by capturing your first note.',
        autoDismiss: true,
        dismissAfter: 5000,
      },
    });
  };

  // Loading state
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-cyan-500/20">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  // Check if this is first launch (no existing data and onboarding not completed)
  const hasExistingData = state.notes.length > 0 || state.tasks.length > 0 || state.topics.length > 0 || state.companies.length > 0 || state.contacts.length > 0;
  const needsOnboarding = !state.ui.onboarding.completed && !hasExistingData;

  // Show welcome flow for first-time users
  if (needsOnboarding) {
    return <WelcomeFlow onComplete={handleWelcomeComplete} />;
  }

  // Main app
  return <MainApp />;
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
