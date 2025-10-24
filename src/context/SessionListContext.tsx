import React, { createContext, useContext, useReducer, useCallback, useMemo, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '../types';
import { getStorage } from '../services/storage';
import { attachmentStorage } from '../services/attachmentStorage';
import { perfMonitor } from '../utils/performance';

/**
 * SessionListContext - Manages the list of completed sessions
 *
 * Responsibilities:
 * - Load sessions from storage
 * - CRUD operations for sessions
 * - Filtering and sorting
 * - Cleanup of session attachments
 *
 * This context does NOT manage:
 * - Active session state (see ActiveSessionContext)
 * - Recording services (see RecordingContext)
 */

// ============================================================================
// Types
// ============================================================================

interface SessionListState {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  filter: SessionFilter | null;
  sortBy: SessionSortOption;
}

interface SessionFilter {
  status?: Array<'completed' | 'interrupted'>;
  tags?: string[];
  startAfter?: Date;
  startBefore?: Date;
  searchQuery?: string;
  category?: string;
  subCategory?: string;
}

type SessionSortOption =
  | 'startTime-desc'
  | 'startTime-asc'
  | 'name-asc'
  | 'name-desc'
  | 'duration-desc'
  | 'duration-asc';

type SessionListAction =
  | { type: 'LOAD_SESSIONS_START' }
  | { type: 'LOAD_SESSIONS_SUCCESS'; payload: Session[] }
  | { type: 'LOAD_SESSIONS_ERROR'; payload: string }
  | { type: 'ADD_SESSION'; payload: Session }
  | { type: 'UPDATE_SESSION'; payload: { id: string; updates: Partial<Session> } }
  | { type: 'DELETE_SESSION'; payload: string }
  | { type: 'SET_FILTER'; payload: SessionFilter | null }
  | { type: 'SET_SORT'; payload: SessionSortOption };

interface SessionListContextValue {
  // State
  sessions: Session[];
  loading: boolean;
  error: string | null;
  filter: SessionFilter | null;
  sortBy: SessionSortOption;

  // Computed
  filteredSessions: Session[];

  // Actions
  loadSessions: () => Promise<void>;
  addSession: (session: Session) => Promise<void>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  setFilter: (filter: SessionFilter | null) => void;
  setSortBy: (sort: SessionSortOption) => void;
  refreshSessions: () => Promise<void>;

  // Utilities
  getSessionById: (id: string) => Session | undefined;
}

// ============================================================================
// Reducer
// ============================================================================

function sessionListReducer(state: SessionListState, action: SessionListAction): SessionListState {
  switch (action.type) {
    case 'LOAD_SESSIONS_START':
      return { ...state, loading: true, error: null };

    case 'LOAD_SESSIONS_SUCCESS':
      return { ...state, loading: false, sessions: action.payload };

    case 'LOAD_SESSIONS_ERROR':
      return { ...state, loading: false, error: action.payload };

    case 'ADD_SESSION':
      return { ...state, sessions: [action.payload, ...state.sessions] };

    case 'UPDATE_SESSION': {
      const { id, updates } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === id ? { ...s, ...updates } : s
        ),
      };
    }

    case 'DELETE_SESSION':
      return {
        ...state,
        sessions: state.sessions.filter(s => s.id !== action.payload),
      };

    case 'SET_FILTER':
      return { ...state, filter: action.payload };

    case 'SET_SORT':
      return { ...state, sortBy: action.payload };

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

const SessionListContext = createContext<SessionListContextValue | undefined>(undefined);

interface SessionListProviderProps {
  children: ReactNode;
}

export function SessionListProvider({ children }: SessionListProviderProps) {
  const [state, dispatch] = useReducer(sessionListReducer, {
    sessions: [],
    loading: false,
    error: null,
    filter: null,
    sortBy: 'startTime-desc',
  });

  // Track if initial load is complete
  const hasLoadedRef = useRef(false);

  // Load sessions from storage
  const loadSessions = useCallback(async () => {
    const end = perfMonitor.start('session-list-load');
    console.log('[SessionListContext] Loading sessions from storage...');
    dispatch({ type: 'LOAD_SESSIONS_START' });

    try {
      const storage = await getStorage();
      const sessions = await storage.load<Session[]>('sessions') || [];

      // Migrate and validate sessions
      const validSessions = sessions
        .map(session => {
          // Validate required fields
          if (!session.id || !session.name || !session.startTime) {
            console.warn('[SessionListContext] Skipping corrupted session:', session.id);
            return null;
          }

          // Validate startTime is parseable
          const startDate = new Date(session.startTime);
          if (isNaN(startDate.getTime())) {
            console.warn('[SessionListContext] Skipping session with invalid date:', session.id, session.startTime);
            return null;
          }

          // Clean up null values for optional fields
          const migrated = { ...session };
          if (migrated.audioConfig === null) {
            delete migrated.audioConfig;
          }
          if (migrated.videoConfig === null) {
            delete migrated.videoConfig;
          }

          return migrated;
        })
        .filter((s): s is Session => s !== null);

      console.log(`[SessionListContext] Loaded ${validSessions.length} valid sessions (${sessions.length} raw)`);

      dispatch({ type: 'LOAD_SESSIONS_SUCCESS', payload: validSessions });
    } catch (error) {
      console.error('[SessionListContext] Failed to load sessions:', error);
      dispatch({
        type: 'LOAD_SESSIONS_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to load sessions'
      });
    } finally {
      end();
    }
  }, []);

  // Add session to list
  const addSession = useCallback(async (session: Session) => {
    const end = perfMonitor.start('session-add');
    console.log('[SessionListContext] Adding session:', session.id);

    try {
      const storage = await getStorage();
      const currentSessions = await storage.load<Session[]>('sessions') || [];
      await storage.save('sessions', [...currentSessions, session]);

      dispatch({ type: 'ADD_SESSION', payload: session });
    } finally {
      end();
    }
  }, []);

  // Update session
  const updateSession = useCallback(async (id: string, updates: Partial<Session>) => {
    const end = perfMonitor.start('session-update');
    console.log('[SessionListContext] Updating session:', id);

    try {
      const storage = await getStorage();
      const sessions = await storage.load<Session[]>('sessions') || [];
      const updated = sessions.map(s => s.id === id ? { ...s, ...updates } : s);
      await storage.save('sessions', updated);

      dispatch({ type: 'UPDATE_SESSION', payload: { id, updates } });
    } finally {
      end();
    }
  }, []);

  // Delete session (with cleanup)
  const deleteSession = useCallback(async (id: string) => {
    const end = perfMonitor.start('session-delete');
    console.log('[SessionListContext] Deleting session:', id);

    try {
      // Find session for cleanup
      const session = state.sessions.find(s => s.id === id);
      if (!session) {
        console.warn('[SessionListContext] Session not found for deletion:', id);
        return;
      }

      // Check if enrichment is in progress
      if (session.enrichmentStatus?.status === 'in-progress') {
        throw new Error('Cannot delete session while enrichment is in progress');
      }

      // Collect all attachment IDs for cleanup
      const attachmentIds: string[] = [];

      // Screenshots
      session.screenshots?.forEach(screenshot => {
        if (screenshot.attachmentId) {
          attachmentIds.push(screenshot.attachmentId);
        }
      });

      // Audio segments
      session.audioSegments?.forEach(segment => {
        if (segment.attachmentId) {
          attachmentIds.push(segment.attachmentId);
        }
      });

      // Video
      if (session.video?.fullVideoAttachmentId) {
        attachmentIds.push(session.video.fullVideoAttachmentId);
      }
      if (session.video?.chunks) {
        session.video.chunks.forEach(chunk => {
          if (chunk.attachmentId) {
            attachmentIds.push(chunk.attachmentId);
          }
        });
      }

      // Delete attachments
      if (attachmentIds.length > 0) {
        console.log(`[SessionListContext] Cleaning up ${attachmentIds.length} attachments`);
        try {
          await attachmentStorage.deleteAttachments(attachmentIds);
        } catch (error) {
          console.error('[SessionListContext] Failed to clean up attachments:', error);
          // Continue with session deletion even if attachment cleanup fails
        }
      }

      // Delete from storage
      const storage = await getStorage();
      const sessions = await storage.load<Session[]>('sessions') || [];
      await storage.save('sessions', sessions.filter(s => s.id !== id));

      // Update state
      dispatch({ type: 'DELETE_SESSION', payload: id });
    } finally {
      end();
    }
  }, [state.sessions]);

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    let result = [...state.sessions];

    // Apply filter
    if (state.filter) {
      // Status filter
      if (state.filter.status && state.filter.status.length > 0) {
        result = result.filter(s =>
          state.filter!.status!.includes(s.status as 'completed' | 'interrupted')
        );
      }

      // Tags filter
      if (state.filter.tags && state.filter.tags.length > 0) {
        result = result.filter(s =>
          s.tags && state.filter!.tags!.some(tag => s.tags!.includes(tag))
        );
      }

      // Date range filters
      if (state.filter.startAfter) {
        const afterMs = state.filter.startAfter.getTime();
        result = result.filter(s => new Date(s.startTime).getTime() >= afterMs);
      }
      if (state.filter.startBefore) {
        const beforeMs = state.filter.startBefore.getTime();
        result = result.filter(s => new Date(s.startTime).getTime() <= beforeMs);
      }

      // Search query
      if (state.filter.searchQuery) {
        const query = state.filter.searchQuery.toLowerCase();
        result = result.filter(s =>
          s.name.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query) ||
          s.summary?.narrative?.toLowerCase().includes(query)
        );
      }

      // Category filter
      if (state.filter.category) {
        result = result.filter(s => s.category === state.filter!.category);
      }

      // Sub-category filter
      if (state.filter.subCategory) {
        result = result.filter(s => s.subCategory === state.filter!.subCategory);
      }
    }

    // Apply sort
    result.sort((a, b) => {
      switch (state.sortBy) {
        case 'startTime-desc':
          return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        case 'startTime-asc':
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'duration-desc':
          return (b.totalDuration || 0) - (a.totalDuration || 0);
        case 'duration-asc':
          return (a.totalDuration || 0) - (b.totalDuration || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [state.sessions, state.filter, state.sortBy]);

  // Get session by ID
  const getSessionById = useCallback((id: string) => {
    return state.sessions.find(s => s.id === id);
  }, [state.sessions]);

  // Load sessions on mount
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadSessions();
    }
  }, [loadSessions]);

  const value: SessionListContextValue = {
    sessions: state.sessions,
    loading: state.loading,
    error: state.error,
    filter: state.filter,
    sortBy: state.sortBy,
    filteredSessions,
    loadSessions,
    addSession,
    updateSession,
    deleteSession,
    setFilter: (filter) => dispatch({ type: 'SET_FILTER', payload: filter }),
    setSortBy: (sort) => dispatch({ type: 'SET_SORT', payload: sort }),
    refreshSessions: loadSessions,
    getSessionById,
  };

  return (
    <SessionListContext.Provider value={value}>
      {children}
    </SessionListContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export function useSessionList() {
  const context = useContext(SessionListContext);
  if (context === undefined) {
    throw new Error('useSessionList must be used within SessionListProvider');
  }
  return context;
}
