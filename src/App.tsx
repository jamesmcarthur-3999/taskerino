/**
 * @file App.tsx - Root application component for Taskerino
 *
 * @overview
 * This is the main entry point for the Taskerino application. It orchestrates the entire
 * application architecture including provider hierarchy, initialization flow, zone-based
 * navigation, and graceful shutdown handling.
 *
 * @architecture
 *
 * **Provider Hierarchy** (outermost to innermost):
 * 1. SettingsProvider - User settings and AI configuration (Claude, OpenAI API keys)
 * 2. UIProvider - UI state, preferences, onboarding, active tab management
 * 3. ScrollAnimationProvider - Coordinated scroll-driven animations across zones
 * 4. RelationshipProvider - Entity relationship management (companies, contacts)
 * 5. EntitiesProvider - Core entities (companies, contacts, topics)
 * 6. NotesProvider - Note CRUD operations and filtering
 * 7. TasksProvider - Task CRUD, subtasks, filtering
 * 8. EnrichmentProvider - Post-session AI enrichment pipeline
 * 9. SessionListProvider - Session CRUD, filtering, sorting (Phase 1)
 * 10. ActiveSessionProvider - Active session lifecycle management (Phase 1)
 * 11. RecordingProvider - Recording service management (screenshots, audio, video) (Phase 1)
 * 12. [REMOVED] SessionsProvider - Replaced with Phase 1 contexts:
 *     - SessionListProvider (session CRUD, filtering)
 *     - ActiveSessionProvider (active session lifecycle)
 *     - RecordingProvider (recording services)
 * 13. AppProvider - DEPRECATED - Migrating to specialized contexts
 *
 * @zones
 * The application uses a **six-zone navigation model** with lazy-loaded zone components:
 *
 * 1. **Capture Zone** - Universal input for quick note capture with AI processing
 *    - Auto-detects topics using fuzzy matching
 *    - Merges similar notes (30% similarity threshold)
 *    - Extracts tasks with priority inference
 *
 * 2. **Tasks Zone** - Interactive task management with multiple views
 *    - Views: List, Kanban, Table
 *    - Filters: Status, priority, tags, due date
 *    - Double-click for quick edit
 *
 * 3. **Library Zone** - Browse organized notes by topic
 *    - Rich entity cards with topic detection
 *    - Relationship tracking (companies, contacts)
 *    - Full-text search with highlighting
 *
 * 4. **Sessions Zone** - Work session tracking with AI-powered insights
 *    - Adaptive screenshot scheduling (curiosity-driven)
 *    - Audio recording with Whisper transcription
 *    - Video recording with ScreenCaptureKit (macOS)
 *    - AI-generated summaries and insights
 *    - Phase 4 storage: Chunked sessions, content-addressable attachments
 *
 * 5. **Assistant Zone** - Chat with Ned, the AI assistant
 *    - Tool execution capabilities (search, CRUD, session queries)
 *    - Permission system (forever, session, always-ask)
 *    - Streaming responses with thinking display
 *
 * 6. **Profile Zone** - Settings, API configuration, user preferences
 *    - API key management (secure Tauri storage)
 *    - Zoom controls (50% - 200%)
 *    - Storage metrics and cache management
 *
 * @initialization
 * The app initialization flow (in AppContent):
 *
 * 1. **API Key Migration** - Migrates keys from localStorage to Tauri secure storage
 * 2. **WAL Recovery** - Recovers from write-ahead log if app crashed
 * 3. **Index Building** - Builds/rebuilds indexes if stale (>7 days):
 *    - Date, topic, tag, full-text, category, sub-category, status indexes
 * 4. **API Key Loading** - Loads Claude and OpenAI API keys from secure storage
 * 5. **Service Initialization** - Configures AI services with loaded keys
 * 6. **Orphaned Session Check** - Detects and recovers active sessions from HMR or crashes
 * 7. **Background Enrichment** - Initializes BackgroundEnrichmentManager and resumes pending jobs
 *
 * @performance
 * - **Lazy Loading**: All zone components are lazy-loaded via React.lazy()
 * - **Error Boundaries**: Each zone wrapped in ErrorBoundary for isolation
 * - **Suspense**: ZoneLoadingFallback shown during lazy component loading
 * - **Browser Zoom**: Native browser zoom applied to document.body (50-200%)
 * - **Phase 4 Storage**: Metadata-only loading (<1ms), progressive chunking, LRU cache
 *
 * @persistence
 * - **Startup Backup** - Automatic backup created on app launch
 * - **Hourly Backups** - Automatic backups every 60 minutes
 * - **Shutdown Backup** - Backup created during graceful shutdown
 * - **Graceful Shutdown Flow**:
 *   1. Flush PersistenceQueue (ensures all enqueued saves complete)
 *   2. Create shutdown backup
 *   3. Flush storage adapter (IndexedDB transactions, file writes)
 *
 * @context_dependencies
 * - **Sessions Rewrite (Phase 1)**: New contexts available:
 *   - useSessionList() - Session CRUD, filtering, sorting
 *   - useActiveSession() - Active session lifecycle
 *   - useRecording() - Recording service management
 * - **Deprecated Contexts** (DO NOT USE):
 *   - useSessions() from SessionsContext - Use Phase 1 contexts instead
 *   - useApp() from AppContext - Migrating to specialized contexts
 *
 * @navigation
 * Two navigation systems:
 * 1. **Top Navigation Island** - Fixed tabs at top, expands for search/commands
 * 2. **Space Sub Menus** - Scroll-driven morphing menus within each zone
 *
 * @keyboard_shortcuts
 * - CMD+K / CTRL+K - Command palette (search, navigate, create)
 * - CMD+Enter - Submit capture in Capture Zone
 * - CMD+Plus / CMD+Minus - Zoom in/out
 * - CMD+0 - Reset zoom to 100%
 *
 * @onboarding
 * Progressive feature introduction via tooltips:
 * - Tooltip #7: Command Palette (after 5 activities)
 * - Tooltip #8: Keyboard Shortcuts (after 10 activities)
 *
 * @see {@link ./context/SessionListContext.tsx} - Session list management (Phase 1)
 * @see {@link ./context/ActiveSessionContext.tsx} - Active session lifecycle (Phase 1)
 * @see {@link ./context/RecordingContext.tsx} - Recording service management (Phase 1)
 * @see {@link ./services/storage/ChunkedSessionStorage.ts} - Phase 4 chunked storage
 * @see {@link ./services/storage/PersistenceQueue.ts} - Background persistence queue
 * @see {@link ../CLAUDE.md} - Complete architecture documentation
 */

import { useEffect, useState, lazy, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { AppProvider, useApp } from './context/AppContext';
import { SettingsProvider } from './context/SettingsContext';
import { UIProvider, useUI } from './context/UIContext';
import { RelationshipProvider } from './context/RelationshipContext';
import { EntitiesProvider } from './context/EntitiesContext';
import { NotesProvider } from './context/NotesContext';
import { TasksProvider } from './context/TasksContext';
import { EnrichmentProvider } from './context/EnrichmentContext';
import { SessionListProvider } from './context/SessionListContext';
import { ActiveSessionProvider, useActiveSession } from './context/ActiveSessionContext';
import { RecordingProvider } from './context/RecordingContext';
import { ScrollAnimationProvider } from './contexts/ScrollAnimationContext';
import { TopNavigation } from './components/TopNavigation';
import { ReferencePanel } from './components/ReferencePanel';
import { QuickTaskModal } from './components/QuickTaskModal';
import { SessionRecoveryModal } from './components/SessionRecoveryModal';
import { TaskDetailSidebar } from './components/TaskDetailSidebar';
import { NoteDetailSidebar } from './components/NoteDetailSidebar';
import { FloatingControls } from './components/FloatingControls';
import { NedOverlay } from './components/NedOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { Session } from './types';
import { FeatureTooltip } from './components/FeatureTooltip';
import { QueueMonitor } from './components/dev/QueueMonitor';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { claudeService } from './services/claudeService';
import { sessionsAgentService } from './services/sessionsAgentService';
import { nedService } from './services/nedService';
import { contextAgent } from './services/contextAgent';
import { sessionsQueryAgent } from './services/sessionsQueryAgent';
import { migrateApiKeysToTauri } from './utils/apiKeyMigration';
import { getStorage, isTauriApp } from './services/storage';
import { getPersistenceQueue } from './services/storage/PersistenceQueue';
import { getBackgroundEnrichmentManager } from './services/enrichment/BackgroundEnrichmentManager';

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

function MainApp({ orphanedSession, setOrphanedSession }: {
  orphanedSession: Session | null;
  setOrphanedSession: (session: Session | null) => void;
}) {
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
      <SessionRecoveryModal
        session={orphanedSession}
        onClose={() => setOrphanedSession(null)}
      />
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
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { activeSession } = useActiveSession();
  const [isReady, setIsReady] = useState(false);
  const [orphanedSession, setOrphanedSession] = useState<Session | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Add 10 second timeout
        const timeoutId = setTimeout(async () => {
          console.warn('Initialization timeout - forcing ready state');
          setIsReady(true);
          // Note: app-ready event removed (no splash screen)
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

        // Build indexes if not present or stale (> 7 days)
        const shouldRebuildIndexes = async () => {
          const dateIndex = await storage.loadIndex('sessions', 'date');

          if (!dateIndex) return true;

          const age = Date.now() - dateIndex.metadata.lastBuilt;
          const sevenDays = 7 * 24 * 60 * 60 * 1000;

          return age > sevenDays;
        };

        if (await shouldRebuildIndexes()) {
          console.log('[APP] Building indexes...');
          try {
            const { IndexingEngine } = await import('./services/storage/IndexingEngine');
            const indexingEngine = new IndexingEngine(storage);

            await indexingEngine.rebuildAllIndexes('sessions');
            await indexingEngine.rebuildAllIndexes('notes');
            await indexingEngine.rebuildAllIndexes('tasks');

            console.log('[APP] Indexes built successfully');
          } catch (error) {
            console.error('[APP] Index building failed:', error);
            // Continue anyway - indexes are for performance optimization
          }
        }

        // Load API keys with error handling
        try {
          const savedClaudeKey = await invoke<string | null>('get_claude_api_key');
          if (savedClaudeKey) {
            await claudeService.setApiKey(savedClaudeKey);
            await sessionsAgentService.setApiKey(savedClaudeKey);
            await nedService.setApiKey(savedClaudeKey);
            await contextAgent.setApiKey(savedClaudeKey);
            await sessionsQueryAgent.setApiKey(savedClaudeKey);
          }

          // Load OpenAI API key
          const savedOpenAIKey = await invoke<string | null>('get_openai_api_key');
          if (savedOpenAIKey) {
            const { openAIService } = await import('./services/openAIService');
            await openAIService.setApiKey(savedOpenAIKey);
          }
        } catch (error) {
          console.error('Failed to load API keys:', error);
          // Continue anyway
        }

        // Check for orphaned active session (from hot reload, crash, or improper shutdown)
        try {
          console.log('[APP] Checking for orphaned active session...');
          const storage = await getStorage();
          let foundHMRSession = false;

          // First check sessionStorage for HMR recovery (dev only, takes priority)
          const hmrSessionId = sessionStorage.getItem('hmr_activeSessionId');
          if (hmrSessionId) {
            console.log('[APP] Found HMR-preserved activeSessionId:', hmrSessionId);
            sessionStorage.removeItem('hmr_activeSessionId'); // Clear after reading

            const { getChunkedStorage } = await import('./services/storage/ChunkedSessionStorage');
            const chunkedStorage = await getChunkedStorage();
            const session = await chunkedStorage.loadFullSession(hmrSessionId);

            if (session && session.status === 'active') {
              console.log('[APP] Orphaned active session detected (HMR):', session.name);
              setOrphanedSession(session);
              foundHMRSession = true;
            } else {
              console.log('[APP] HMR session found but not active (status:', session?.status, ')');
            }
          }

          // If no HMR recovery, check settings for persisted activeSessionId
          const settings = await storage.load<Record<string, unknown>>('settings');

          if (!foundHMRSession && settings?.activeSessionId && typeof settings.activeSessionId === 'string') {
            console.log('[APP] Found activeSessionId in settings:', settings.activeSessionId);

            const { getChunkedStorage } = await import('./services/storage/ChunkedSessionStorage');
            const chunkedStorage = await getChunkedStorage();
            const session = await chunkedStorage.loadFullSession(settings.activeSessionId);

            if (session && session.status === 'active') {
              console.log('[APP] Orphaned active session detected:', session.name);
              setOrphanedSession(session);
            } else {
              console.log('[APP] Session found but not active (status:', session?.status, '), cleaning up...');
              // Clean up stale activeSessionId
              await storage.save('settings', { ...settings, activeSessionId: undefined });
            }
          } else {
            console.log('[APP] No active session found in settings');
          }
        } catch (error) {
          console.error('[APP] Failed to check for orphaned session:', error);
          // Continue anyway - non-critical
        }

        // Initialize BackgroundEnrichmentManager and resume pending jobs
        try {
          console.log('[APP] Initializing BackgroundEnrichmentManager...');
          const manager = await getBackgroundEnrichmentManager();

          // Initialize the manager (opens IndexedDB, sets up event listeners)
          await manager.initialize();
          console.log('[APP] ✓ BackgroundEnrichmentManager initialized');

          // Get all jobs from the queue
          const queue = manager.getQueue();
          if (queue) {
            const allJobs = await queue.getAllJobs();

            // Filter for pending and failed jobs that can be retried
            const pendingJobs = allJobs.filter(job => job.status === 'pending');
            const failedJobs = allJobs.filter(job => job.status === 'failed');

            console.log(`[APP] Found ${pendingJobs.length} pending jobs and ${failedJobs.length} failed jobs from previous session`);

            // Resume pending jobs (they'll be processed automatically by the queue)
            if (pendingJobs.length > 0) {
              console.log('[APP] Pending jobs will be processed automatically by the queue');
              for (const job of pendingJobs) {
                console.log(`[APP] - Pending job: ${job.sessionName} (${job.sessionId})`);
              }
            }

            // Optionally log failed jobs (user can manually retry these)
            if (failedJobs.length > 0) {
              console.log('[APP] Failed jobs (manual retry required):');
              for (const job of failedJobs) {
                console.log(`[APP] - Failed job: ${job.sessionName} (${job.sessionId}) - Error: ${job.error}`);
              }
            }

            if (pendingJobs.length === 0 && failedJobs.length === 0) {
              console.log('[APP] No pending or failed enrichment jobs to resume');
            }
          } else {
            console.warn('[APP] Queue not available (manager not properly initialized)');
          }

          console.log('[APP] ✓ BackgroundEnrichmentManager ready');
        } catch (error) {
          console.error('[APP] Failed to initialize BackgroundEnrichmentManager:', error);
          // Non-fatal error - app should still work, just enrichment won't auto-resume
        }

        clearTimeout(timeoutId);
        setIsReady(true);

        // Note: app-ready event removed (no splash screen)
        console.log('[APP] ✅ Initialization complete');
      } catch (error) {
        console.error('Initialization failed:', error);
        setIsReady(true); // ALWAYS set ready
        // Note: app-ready event removed (no splash screen)
      }
    };
    initializeApp();
  }, []);

  // HMR state preservation for development (Phase 2)
  // Save activeSessionId to sessionStorage before hot reload
  useEffect(() => {
    if (import.meta.hot) {
      // Register dispose handler - runs before module is replaced
      const disposeHandler = import.meta.hot.dispose(() => {
        if (activeSession?.id) {
          console.log('[HMR] Saving activeSessionId to sessionStorage:', activeSession.id);
          sessionStorage.setItem('hmr_activeSessionId', activeSession.id);
        } else {
          console.log('[HMR] No active session to save');
          sessionStorage.removeItem('hmr_activeSessionId');
        }
      });

      // Cleanup
      return () => {
        // HMR dispose handlers are automatically cleaned up by Vite
      };
    }
  }, [activeSession]);

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
  // CRITICAL: Tauri handles this via WindowEvent::CloseRequested (src-tauri/src/lib.rs lines 1077-1140)
  // The Rust backend intercepts window close, emits 'shutdown-requested', waits for 'shutdown-complete'
  useEffect(() => {
    // Tauri: Use shutdown-requested event (synchronous shutdown guaranteed by Rust backend)
    if (isTauriApp()) {
      let unlisten: (() => void) | null = null;

      listen('shutdown-requested', async () => {
        console.log('[APP] Received shutdown-requested from Tauri (backend blocked window close)');

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
          console.log('[APP] ✓ Graceful shutdown complete');

          // Notify Tauri we're done (backend will unblock and close window)
          await emit('shutdown-complete');
          console.log('[APP] Emitted shutdown-complete to Tauri');
        } catch (error) {
          console.error('[APP] Failed during shutdown:', error);
          // Still emit complete even on error to allow app to close
          await emit('shutdown-complete');
        }
      }).then(fn => {
        unlisten = fn;
      });

      return () => {
        if (unlisten) {
          unlisten();
        }
      };
    }

    // Web: NO beforeunload handler (causes data loss due to async limitations)
    // Browser shutdown is best-effort only - hourly backups protect against data loss
    else {
      console.log('[APP] Running in browser - shutdown flush not supported (use Tauri app for guaranteed persistence)');
      // No cleanup needed for browser mode
    }
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

  // Loading state
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-cyan-500/20">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  // Main app
  return <MainApp orphanedSession={orphanedSession} setOrphanedSession={setOrphanedSession} />;
}

export default function App() {
  return (
    <SettingsProvider>
      <UIProvider>
        <ScrollAnimationProvider>
          {/* Phase C2: Add RelationshipProvider before EntitiesProvider so entities can use relationships */}
          <RelationshipProvider>
            <EntitiesProvider>
              <NotesProvider>
                <TasksProvider>
                  <EnrichmentProvider>
                    {/* NEW: Split session contexts for better maintainability */}
                    {/* Provider Hierarchy (Phase 1): RecordingProvider ABOVE ActiveSessionProvider */}
                    {/* ActiveSessionContext uses useRecording(), so RecordingProvider must wrap it */}
                    <SessionListProvider>
                      <RecordingProvider>
                        <ActiveSessionProvider>
                          {/* OLD AppProvider - TODO: Remove once all components are migrated (13 remaining) */}
                          <AppProvider>
                            <AppContent />
                          </AppProvider>
                        </ActiveSessionProvider>
                      </RecordingProvider>
                    </SessionListProvider>
                  </EnrichmentProvider>
                </TasksProvider>
              </NotesProvider>
            </EntitiesProvider>
          </RelationshipProvider>
        </ScrollAnimationProvider>
      </UIProvider>
    </SettingsProvider>
  );
}
