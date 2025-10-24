import { useEffect, useState, lazy, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppProvider, useApp } from './context/AppContext';
import { SettingsProvider } from './context/SettingsContext';
import { UIProvider, useUI } from './context/UIContext';
import { EntitiesProvider } from './context/EntitiesContext';
import { NotesProvider } from './context/NotesContext';
import { TasksProvider } from './context/TasksContext';
import { EnrichmentProvider } from './context/EnrichmentContext';
import { SessionsProvider } from './context/SessionsContext';
import { SessionListProvider } from './context/SessionListContext';
import { ActiveSessionProvider } from './context/ActiveSessionContext';
import { RecordingProvider } from './context/RecordingContext';
import { ScrollAnimationProvider } from './contexts/ScrollAnimationContext';
import { TopNavigation } from './components/TopNavigation';
import { ReferencePanel } from './components/ReferencePanel';
import { QuickTaskModal } from './components/QuickTaskModal';
import { TaskDetailSidebar } from './components/TaskDetailSidebar';
import { NoteDetailSidebar } from './components/NoteDetailSidebar';
import { WelcomeFlow } from './components/WelcomeFlow';
import { FloatingControls } from './components/FloatingControls';
import { NedOverlay } from './components/NedOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeatureTooltip } from './components/FeatureTooltip';
import { QueueMonitor } from './components/dev/QueueMonitor';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { claudeService } from './services/claudeService';
import { sessionsAgentService } from './services/sessionsAgentService';
import { nedService } from './services/nedService';
import { contextAgent } from './services/contextAgent';
import { sessionsQueryAgent } from './services/sessionsQueryAgent';
import { migrateApiKeysToTauri } from './utils/apiKeyMigration';
import { getStorage } from './services/storage';
import { getPersistenceQueue } from './services/storage/PersistenceQueue';

// Lazy load zone components for better performance
const CaptureZone = lazy(() => import('./components/CaptureZone'));
const TasksZone = lazy(() => import('./components/TasksZone'));
const NotesZone = lazy(() => import('./components/LibraryZone'));
const SessionsZone = lazy(() => import('./components/SessionsZone'));
const AssistantZone = lazy(() => import('./components/AssistantZone'));
const ProfileZone = lazy(() => import('./components/ProfileZone'));

function ZoneLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

function MainApp() {
  const { state, dispatch } = useApp();
  const { state: uiState, dispatch: uiDispatch } = useUI();

  // Enable global keyboard shortcuts
  useKeyboardShortcuts();

  // Tooltip state
  const [showCmdKTooltip, setShowCmdKTooltip] = useState(false);
  const [showShortcutsTooltip, setShowShortcutsTooltip] = useState(false);

  // Get zoom level from preferences
  const zoomLevel = uiState.preferences.zoomLevel || 100;

  // Apply zoom to document body (browser-native zoom)
  useEffect(() => {
    (document.body as any).style.zoom = `${zoomLevel}%`;
    return () => {
      (document.body as any).style.zoom = '100%';
    };
  }, [zoomLevel]);

  // Zoom keyboard shortcuts
  useEffect(() => {
    const handleZoom = (e: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      if (e.metaKey || e.ctrlKey) {
        const currentZoom = uiState.preferences.zoomLevel || 100;

        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const newZoom = Math.min(currentZoom + 10, 200);
          uiDispatch({ type: 'UPDATE_PREFERENCES', payload: { zoomLevel: newZoom } });
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          const newZoom = Math.max(currentZoom - 10, 50);
          uiDispatch({ type: 'UPDATE_PREFERENCES', payload: { zoomLevel: newZoom } });
        } else if (e.key === '0') {
          e.preventDefault();
          uiDispatch({ type: 'UPDATE_PREFERENCES', payload: { zoomLevel: 100 } });
        }
      }
    };

    window.addEventListener('keydown', handleZoom);
    return () => window.removeEventListener('keydown', handleZoom);
  }, [uiState.preferences.zoomLevel, uiDispatch]);

  // Tooltip #7: Command Palette (⌘K) - Show after 5 total activities
  useEffect(() => {
    const totalActivity =
      uiState.onboarding.stats.captureCount +
      uiState.onboarding.stats.taskCount;

    if (totalActivity >= 5 && !uiState.onboarding.featureIntroductions.cmdK) {
      setShowCmdKTooltip(true);
    }
  }, [
    uiState.onboarding.stats.captureCount,
    uiState.onboarding.stats.taskCount,
    uiState.onboarding.featureIntroductions.cmdK,
  ]);

  // Tooltip #8: Keyboard Shortcuts - Show after 10 total activities and cmdK seen
  useEffect(() => {
    const totalActivity =
      uiState.onboarding.stats.captureCount +
      uiState.onboarding.stats.taskCount;

    // Only show if they've seen cmdK tooltip first
    if (totalActivity >= 10 &&
        uiState.onboarding.featureIntroductions.cmdK &&
        !uiState.onboarding.featureIntroductions.quickAdd) {
      setShowShortcutsTooltip(true);
    }
  }, [
    uiState.onboarding.stats.captureCount,
    uiState.onboarding.stats.taskCount,
    uiState.onboarding.featureIntroductions.cmdK,
    uiState.onboarding.featureIntroductions.quickAdd,
  ]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Top Navigation */}
      <TopNavigation />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<ZoneLoadingFallback />}>
          {uiState.activeTab === 'capture' && (
            <ErrorBoundary>
              <CaptureZone />
            </ErrorBoundary>
          )}
          {uiState.activeTab === 'tasks' && (
            <ErrorBoundary>
              <TasksZone />
            </ErrorBoundary>
          )}
          {uiState.activeTab === 'notes' && (
            <ErrorBoundary>
              <NotesZone />
            </ErrorBoundary>
          )}
          {uiState.activeTab === 'sessions' && (
            <ErrorBoundary>
              <SessionsZone />
            </ErrorBoundary>
          )}
          {uiState.activeTab === 'assistant' && (
            <ErrorBoundary>
              <AssistantZone />
            </ErrorBoundary>
          )}
          {uiState.activeTab === 'profile' && (
            <ErrorBoundary>
              <ProfileZone />
            </ErrorBoundary>
          )}
        </Suspense>
      </main>

      {/* Global Overlays */}
      <ReferencePanel />
      <QuickTaskModal />
      <FloatingControls />
      <NedOverlay />
      <QueueMonitor />

      {/* Sidebar (for task/note details) */}
      {uiState.sidebar.isOpen && uiState.sidebar.type === 'task' && uiState.sidebar.itemId && (
        <TaskDetailSidebar taskId={uiState.sidebar.itemId} />
      )}
      {uiState.sidebar.isOpen && uiState.sidebar.type === 'note' && uiState.sidebar.itemId && (
        <NoteDetailSidebar noteId={uiState.sidebar.itemId} />
      )}

      {/* Onboarding Tooltips */}
      {showCmdKTooltip && (
        <FeatureTooltip
          show={true}
          onDismiss={() => {
            setShowCmdKTooltip(false);
            uiDispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: 'cmdK' });
          }}
          position="center"
          title="💡 Pro Tip: Command Palette"
          message={
            <div>
              <p>Press <kbd className="px-2 py-1 bg-gray-200 rounded">⌘K</kbd> anytime to quickly:</p>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Search everything</li>
                <li>Navigate zones</li>
                <li>Create tasks</li>
                <li>Take actions</li>
              </ul>
              <p className="mt-2 font-medium text-cyan-600">Power users live in ⌘K!</p>
            </div>
          }
          primaryAction={{
            label: "Try it now",
            onClick: () => {
              // Open command palette
              uiDispatch({ type: 'TOGGLE_COMMAND_PALETTE' });
            },
          }}
          secondaryAction={{
            label: "Dismiss",
            onClick: () => {},
          }}
        />
      )}

      {showShortcutsTooltip && (
        <FeatureTooltip
          show={true}
          onDismiss={() => {
            setShowShortcutsTooltip(false);
            uiDispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: 'quickAdd' });
          }}
          position="center"
          title="⌨️ Pro Tip: Keyboard Shortcuts"
          message={
            <div>
              <p>You're getting the hang of this! Here are shortcuts to speed up your workflow:</p>
              <ul className="list-none mt-2 space-y-1">
                <li><kbd className="px-2 py-1 bg-gray-200 rounded">⌘K</kbd> - Command Palette (search everything)</li>
                <li><kbd className="px-2 py-1 bg-gray-200 rounded">⌘Enter</kbd> - Submit capture</li>
                <li><kbd className="px-2 py-1 bg-gray-200 rounded">⌘+/-</kbd> - Zoom in/out</li>
                <li><strong>Double-click task</strong> - Quick edit</li>
              </ul>
            </div>
          }
          primaryAction={{
            label: "Got it",
            onClick: () => {},
          }}
        />
      )}
    </div>
  );
}

function AppContent() {
  const { state, dispatch } = useApp();
  const [isReady, setIsReady] = useState(false);
  const [hasApiKeys, setHasApiKeys] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Add 10 second timeout
        const timeoutId = setTimeout(() => {
          console.warn('Initialization timeout - forcing ready state');
          setIsReady(true);
        }, 10000);

        // Run migration from localStorage to Tauri secure storage
        const migrationResult = await migrateApiKeysToTauri();
        if (migrationResult.migrated) {
          console.log('API keys migrated successfully:', migrationResult);
        }

        // Recover from WAL if app crashed
        console.log('[APP] Checking for WAL recovery...');
        const storage = await getStorage();
        if ('recoverFromWAL' in storage) {
          try {
            await (storage as any).recoverFromWAL();
            console.log('[APP] WAL recovery complete');
          } catch (error) {
            console.error('[APP] WAL recovery failed:', error);
            // Continue anyway - recovery failure shouldn't block app startup
          }
        }

        // Check if per-entity file migration is needed
        const migrationFlag = await storage.load<boolean>('__migration_per_entity_complete');
        if (!migrationFlag) {
          console.log('[APP] Running per-entity file migration...');
          try {
            const { migrateToPerEntityFiles } = await import('./migrations/splitCollections');
            await migrateToPerEntityFiles();
            await storage.save('__migration_per_entity_complete', true);
            console.log('[APP] Per-entity file migration complete');
          } catch (error) {
            console.error('[APP] Per-entity file migration failed:', error);
            // Continue anyway - migration failure shouldn't block app startup
            // User can retry by deleting the flag or re-running migration manually
          }
        }

        // Add version field to sessions for optimistic locking
        const hasVersionMigration = await storage.load<boolean>('__migration_version_field');
        if (!hasVersionMigration) {
          console.log('[APP] Running version field migration...');
          try {
            await (storage as any).addVersionField?.('sessions');
            await storage.save('__migration_version_field', true);
            console.log('[APP] Version field migration complete');
          } catch (error) {
            console.error('[APP] Version field migration failed:', error);
            // Continue anyway - migration failure shouldn't block app startup
          }
        }

        // Load API keys with error handling
        try {
          const savedClaudeKey = await invoke<string | null>('get_claude_api_key');
          if (savedClaudeKey) {
            claudeService.setApiKey(savedClaudeKey);
            sessionsAgentService.setApiKey(savedClaudeKey);
            await nedService.setApiKey(savedClaudeKey);
            contextAgent.setApiKey(savedClaudeKey);
            await sessionsQueryAgent.setApiKey(savedClaudeKey);
          }

          // Load OpenAI API key
          const savedOpenAIKey = await invoke<string | null>('get_openai_api_key');
          if (savedOpenAIKey) {
            const { openAIService } = await import('./services/openAIService');
            openAIService.setApiKey(savedOpenAIKey);
          }

          // Set hasApiKeys flag based on whether we have both required keys
          setHasApiKeys(!!savedClaudeKey && !!savedOpenAIKey);
        } catch (error) {
          console.error('Failed to load API keys:', error);
          // Continue anyway
        }

        clearTimeout(timeoutId);
        setIsReady(true);
      } catch (error) {
        console.error('Initialization failed:', error);
        setIsReady(true); // ALWAYS set ready
      }
    };
    initializeApp();
  }, []);

  // Automatic backup on startup
  useEffect(() => {
    const createStartupBackup = async () => {
      try {
        console.log('[APP] Creating startup backup...');
        const storage = await getStorage();
        const backupId = await storage.createBackup();
        console.log(`[APP] ✓ Startup backup created: ${backupId}`);
      } catch (error) {
        console.error('[APP] Failed to create startup backup:', error);
        // Show user notification about backup failure
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'warning',
            title: 'Backup Warning',
            message: 'Failed to create startup backup. Your data may be at risk.',
            autoDismiss: false,
          },
        });
      }
    };

    createStartupBackup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = run once on mount (dispatch is stable)

  // Graceful shutdown: flush queue, create backup, and flush pending writes on app close
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      try {
        // Step 1: Flush persistence queue first (ensures all enqueued saves complete)
        console.log('[APP] Flushing persistence queue...');
        const queue = getPersistenceQueue();
        await queue.shutdown();
        console.log('[APP] ✓ Persistence queue flushed');

        // Step 2: Create shutdown backup
        console.log('[APP] Creating shutdown backup...');
        const storage = await getStorage();
        await storage.createBackup();
        console.log('[APP] ✓ Shutdown backup created');

        // Step 3: Flush any remaining pending writes
        console.log('[APP] Flushing pending writes before shutdown...');
        await storage.shutdown();
        console.log('[APP] Graceful shutdown complete');
      } catch (error) {
        console.error('[APP] Failed during shutdown:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Hourly automatic backups
  useEffect(() => {
    const createHourlyBackup = async () => {
      try {
        console.log('[APP] Creating hourly backup...');
        const storage = await getStorage();
        const backupId = await storage.createBackup();
        console.log(`[APP] ✓ Hourly backup created: ${backupId}`);
      } catch (error) {
        console.error('[APP] Failed to create hourly backup:', error);
      }
    };

    // Create backup immediately, then every hour
    createHourlyBackup();
    const interval = setInterval(createHourlyBackup, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
  }, []);

  const handleWelcomeComplete = async (name: string, anthropicKey: string, openAIKey: string) => {
    // Save Anthropic API key to Tauri secure storage
    await invoke('set_claude_api_key', { apiKey: anthropicKey });
    claudeService.setApiKey(anthropicKey);
    sessionsAgentService.setApiKey(anthropicKey);
    await nedService.setApiKey(anthropicKey);
    contextAgent.setApiKey(anthropicKey);
    await sessionsQueryAgent.setApiKey(anthropicKey);

    // Save OpenAI API key to Tauri secure storage
    await invoke('set_openai_api_key', { apiKey: openAIKey });
    const { openAIService } = await import('./services/openAIService');
    openAIService.setApiKey(openAIKey);

    // Update hasApiKeys flag
    setHasApiKeys(true);

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

  // Check if onboarding should be shown
  // Show welcome flow if onboarding is not completed AND we don't have API keys
  // This prevents showing onboarding during hot reloads when we already have keys
  const needsOnboarding = !state.ui.onboarding.completed && !hasApiKeys;

  // Show welcome flow for users who need onboarding
  if (needsOnboarding) {
    return <WelcomeFlow onComplete={handleWelcomeComplete} />;
  }

  // Main app
  return <MainApp />;
}

export default function App() {
  return (
    <SettingsProvider>
      <UIProvider>
        <ScrollAnimationProvider>
          <EntitiesProvider>
            <NotesProvider>
              <TasksProvider>
                <EnrichmentProvider>
                  {/* NEW: Split session contexts for better maintainability */}
                  <SessionListProvider>
                    <ActiveSessionProvider>
                      <RecordingProvider>
                        {/* OLD: Keep SessionsProvider for backward compatibility during migration */}
                        <SessionsProvider>
                          {/* OLD AppProvider - TODO: Remove once all components are migrated (13 remaining) */}
                          <AppProvider>
                            <AppContent />
                          </AppProvider>
                        </SessionsProvider>
                      </RecordingProvider>
                    </ActiveSessionProvider>
                  </SessionListProvider>
                </EnrichmentProvider>
              </TasksProvider>
            </NotesProvider>
          </EntitiesProvider>
        </ScrollAnimationProvider>
      </UIProvider>
    </SettingsProvider>
  );
}
