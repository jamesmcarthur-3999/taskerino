import React, { createContext, useContext, useReducer, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '../types';
import { getStorage } from '../services/storage';
import { getCAStorage } from '../services/storage/ContentAddressableStorage';
import { perfMonitor } from '../utils/performance';
import { getPersistenceQueue } from '../services/storage/PersistenceQueue';
import { getChunkedStorage, type SessionMetadata } from '../services/storage/ChunkedSessionStorage';
import { getInvertedIndexManager } from '../services/storage/InvertedIndexManager';
import { EntityType, RelationshipType } from '../types/relationships';
import { useRelationships } from './RelationshipContext';
import { debug } from "../utils/debug";

/**
 * SessionListContext - Manages the list of completed sessions
 *
 * Responsibilities:
 * - Load sessions from storage (metadata-only for performance)
 * - CRUD operations for sessions
 * - Filtering and sorting
 * - Cleanup of session attachments
 * - Relationship management (link/unlink with tasks and notes)
 *
 * This context does NOT manage:
 * - Active session state (see ActiveSessionContext)
 * - Recording services (see RecordingContext)
 *
 * ============================================================================
 * PERSISTENCE ARCHITECTURE (Fixed 2025-10-29)
 * ============================================================================
 *
 * DESIGN PRINCIPLES:
 * 1. In-memory state (state.sessions) is the single source of truth
 * 2. Storage is persistence layer only, never queried for "latest" during updates
 * 3. CRUD operations own their persistence (no global auto-save effects)
 * 4. Effects are read-only (logging, events), never modify or save data
 *
 * PERSISTENCE PATTERNS:
 * - addSession() → Saves full session via ChunkedStorage.saveFullSession()
 * - updateSession() → Saves metadata via ChunkedStorage.saveMetadata()
 * - deleteSession() → Deletes session and cleans up ContentAddressable references
 * - Link/unlink operations → Delegated to RelationshipContext
 *
 * METADATA CONSTRUCTION:
 * - Use createMetadataFromSession() helper for consistency
 * - Explicitly excludes large data (screenshots, audio, video chunks)
 * - Video chapter thumbnails (base64) stripped to prevent memory leaks
 *
 * STORAGE LAYER:
 * - ChunkedStorage.saveMetadata() uses immediate writes (non-queued)
 * - Metadata is small (~10KB) and critical for session operations
 * - Large data (screenshots, audio) saved via chunked methods (queued)
 *
 * MEMORY LEAK FIX (2025-10-29):
 * - Removed auto-save effect that loaded metadata from storage on every state change
 * - Before: 30 MB disk I/O per state change → 15-28 GB memory with normal usage
 * - After: 0 MB disk I/O on state changes → <500 MB memory stable
 *
 * DESIGN DECISIONS:
 * - Relationships managed separately by RelationshipContext
 * - Session objects don't have in-memory relationships[] until reload (acceptable trade-off)
 * - PersistenceQueue used internally by ChunkedStorage, not exposed to this context
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

  // Relationship helpers (Phase C2)
  linkSessionToTask: (sessionId: string, taskId: string, metadata?: { confidence?: number; reasoning?: string }) => Promise<void>;
  linkSessionToNote: (sessionId: string, noteId: string, metadata?: { confidence?: number; reasoning?: string }) => Promise<void>;
  unlinkSessionFromTask: (sessionId: string, taskId: string) => Promise<void>;
  unlinkSessionFromNote: (sessionId: string, noteId: string) => Promise<void>;
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
// Helper Functions
// ============================================================================

/**
 * Creates SessionMetadata from a full Session object
 *
 * This helper ensures consistent metadata construction across all CRUD operations.
 * It explicitly excludes large data (screenshots, audio, video chunks) that are
 * stored separately in chunked storage.
 *
 * @param session - Full session object
 * @returns SessionMetadata object suitable for chunked storage
 */
function createMetadataFromSession(session: Session): SessionMetadata {
  return {
    // Core identity
    id: session.id,
    name: session.name,
    description: session.description,

    // Lifecycle
    status: session.status,
    startTime: session.startTime,
    endTime: session.endTime,
    lastScreenshotTime: session.lastScreenshotTime,
    pausedAt: session.pausedAt,
    totalPausedTime: session.totalPausedTime,

    // Configuration
    screenshotInterval: session.screenshotInterval,
    autoAnalysis: session.autoAnalysis,
    enableScreenshots: session.enableScreenshots,
    audioMode: session.audioMode,
    audioRecording: session.audioRecording,
    videoRecording: session.videoRecording,

    // References
    trackingNoteId: session.trackingNoteId,
    // Extract task and note IDs from relationships for backward compatibility
    extractedTaskIds: (session.relationships || [])
      .filter(r => r.targetType === EntityType.TASK && (r.type === RelationshipType.TASK_SESSION))
      .map(r => r.targetId),
    extractedNoteIds: (session.relationships || [])
      .filter(r => r.targetType === EntityType.NOTE && (r.type === RelationshipType.NOTE_SESSION))
      .map(r => r.targetId),
    relationships: session.relationships || [],

    // Chunk manifests
    chunks: {
      screenshots: {
        count: session.screenshots?.length || 0,
        chunkCount: Math.ceil((session.screenshots?.length || 0) / 10),
        chunkSize: 10,
      },
      audioSegments: {
        count: session.audioSegments?.length || 0,
        chunkCount: Math.ceil((session.audioSegments?.length || 0) / 50),
        chunkSize: 50,
      },
      videoChunks: {
        count: 0, // SessionVideo no longer has chunks property
        chunkCount: 0,
        chunkSize: 1,
      },
    },

    // Metadata
    tags: session.tags,
    category: session.category,
    subCategory: session.subCategory,
    activityType: session.activityType,
    totalDuration: session.totalDuration,

    // Feature flags
    hasSummary: !!session.summary,
    hasAudioInsights: !!session.audioInsights,
    hasCanvasSpec: !!session.canvasSpec,
    hasTranscription: !!session.fullTranscription,
    hasVideo: !!session.video,
    hasFullAudio: !!session.fullAudioAttachmentId,

    // Video metadata (exclude base64 thumbnails)
    video: session.video ? {
      ...session.video,
      chapters: session.video.chapters?.map(chapter => ({
        ...chapter,
        thumbnail: undefined, // Exclude base64 thumbnails from metadata
      })),
    } : undefined,

    // Audio review metadata
    audioReviewCompleted: session.audioReviewCompleted || false,
    fullAudioAttachmentId: session.fullAudioAttachmentId,
    transcriptUpgradeCompleted: session.transcriptUpgradeCompleted,

    // Enrichment tracking
    enrichmentStatus: session.enrichmentStatus,
    enrichmentConfig: session.enrichmentConfig,
    enrichmentLock: session.enrichmentLock,

    // Audio/video config
    audioConfig: session.audioConfig,
    videoConfig: session.videoConfig,

    // Version
    version: session.version,

    // Storage metadata
    storageVersion: 4, // Phase 4 storage
    createdAt: session.startTime, // Use startTime as creation time
    updatedAt: new Date().toISOString(),
  };
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

  // Get persistence queue for background saves
  const queue = getPersistenceQueue();

  // Track if initial load is complete
  const hasLoadedRef = useRef(false);

  // Get relationship context (may not be available during initial render)
  let relationshipsContext;
  try {
    relationshipsContext = useRelationships();
  } catch {
    // RelationshipContext not available yet - that's OK during migration
    relationshipsContext = null;
  }

  // Load sessions from storage (metadata only for performance)
  const loadSessions = useCallback(async () => {
    const end = perfMonitor.start('session-list-load');
    console.log('[SessionListContext] Loading sessions from storage (metadata only)...');
    dispatch({ type: 'LOAD_SESSIONS_START' });

    try {
      const chunkedStorage = await getChunkedStorage();
      const metadataList = await chunkedStorage.listAllMetadata();

      // Convert metadata to partial Session objects for UI compatibility
      // FIX: Do NOT load canvas specs on startup to prevent memory leak
      // Canvas specs can be large (40KB-50MB) and loading all of them causes OOM
      // They will be loaded on-demand when viewing session details
      const sessions = metadataList.map((metadata) => {
          return {
            // Core identity
            id: metadata.id,
            name: metadata.name,
            description: metadata.description,

            // Lifecycle
            status: metadata.status,
            startTime: metadata.startTime,
            endTime: metadata.endTime,
            lastScreenshotTime: metadata.lastScreenshotTime,
            pausedAt: metadata.pausedAt,
            totalPausedTime: metadata.totalPausedTime,

            // Configuration
            screenshotInterval: metadata.screenshotInterval,
            autoAnalysis: metadata.autoAnalysis,
            enableScreenshots: metadata.enableScreenshots,
            audioMode: metadata.audioMode,
            audioRecording: metadata.audioRecording,
            videoRecording: metadata.videoRecording,

            // References
            trackingNoteId: metadata.trackingNoteId,
            relationships: metadata.relationships || [],

            // Metadata
            tags: metadata.tags,
            category: metadata.category,
            subCategory: metadata.subCategory,
            activityType: metadata.activityType,
            totalDuration: metadata.totalDuration,

            // Feature flags (converted to actual data)
            audioReviewCompleted: metadata.audioReviewCompleted,
            fullAudioAttachmentId: metadata.fullAudioAttachmentId,
            transcriptUpgradeCompleted: metadata.transcriptUpgradeCompleted,

            // Video metadata
            video: metadata.video,

            // Enrichment
            enrichmentStatus: metadata.enrichmentStatus,
            enrichmentConfig: metadata.enrichmentConfig,
            enrichmentLock: metadata.enrichmentLock,

            // Audio/video config
            audioConfig: metadata.audioConfig,
            videoConfig: metadata.videoConfig,

            // Version
            version: metadata.version,

            // Canvas spec (NOT loaded - lazy load when viewing session)
            canvasSpec: undefined,

            // Arrays (empty for metadata-only loading)
            screenshots: [], // Don't load chunks yet
            audioSegments: [], // Don't load chunks yet
            contextItems: [], // Don't load yet
          };
        });

      console.log(`[SessionListContext] Loaded ${sessions.length} sessions (metadata only)`);

      dispatch({ type: 'LOAD_SESSIONS_SUCCESS', payload: sessions });

      // Update indexes for all loaded sessions asynchronously (non-blocking)
      (async () => {
        try {
          const indexManager = await getInvertedIndexManager();
          console.log(`[SessionListContext] Bulk updating indexes for ${metadataList.length} sessions...`);
          const startTime = performance.now();

          // Rebuild indexes from all metadata (more efficient than individual updates)
          await indexManager.buildIndexes(metadataList);

          const duration = performance.now() - startTime;
          console.log(`[SessionListContext] Indexes rebuilt in ${duration.toFixed(2)}ms`);
        } catch (error) {
          console.error('[SessionListContext] Failed to bulk update indexes:', error);
          // Non-fatal - search will use linear scan fallback if indexes corrupt
        }
      })();
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

  // Add session to list (saves via chunked storage)
  const addSession = useCallback(async (session: Session) => {
    const end = perfMonitor.start('session-add');
    console.log('[SessionListContext] Adding session:', session.id);

    try {
      const chunkedStorage = await getChunkedStorage();
      const storage = await getStorage();
      const tx = await storage.beginTransaction();

      try {
        // Save session using chunked storage
        await chunkedStorage.saveFullSession(session);

        // Also save activeSessionId in same transaction
        const settings = await storage.load<any>('settings') || {};
        tx.save('settings', { ...settings, activeSessionId: session.id });

        await tx.commit();

        // Update local state with metadata only
        const metadata = await chunkedStorage.loadMetadata(session.id);
        if (metadata) {
          const partialSession: Session = {
            ...session,
            screenshots: [], // Metadata-only state
            audioSegments: [],
            contextItems: [],
          };
          dispatch({ type: 'ADD_SESSION', payload: partialSession });

          // Update indexes asynchronously (non-blocking)
          (async () => {
            try {
              const indexManager = await getInvertedIndexManager();
              await indexManager.updateIndexes(metadata);
              console.log('[SessionListContext] Index updated for new session:', session.id);
            } catch (error) {
              console.error('[SessionListContext] Failed to update index for new session:', error);
              // Non-fatal - search will use linear scan fallback if indexes corrupt
            }
          })();
        }

        console.log('[SessionListContext] Session added via chunked storage:', session.id);
      } catch (error) {
        await tx.rollback();
        console.error('[SessionListContext] Transaction failed, rolled back:', error);
        throw error;
      }
    } finally {
      end();
    }
  }, []);

  // Update session (smart field detection for chunked storage)
  const updateSession = useCallback(async (id: string, updates: Partial<Session>) => {
    const end = perfMonitor.start('session-update');
    console.log('[SessionListContext] Updating session:', id, { updatingFields: Object.keys(updates) });

    try {
      // Update state immediately
      dispatch({ type: 'UPDATE_SESSION', payload: { id, updates } });

      // Get chunked storage
      const chunkedStorage = await getChunkedStorage();

      // Save special fields using dedicated ChunkedStorage methods
      // These fields are stored in separate files for performance

      // Canvas spec - stored in canvas-spec.json
      if ('canvasSpec' in updates) {
        if (updates.canvasSpec === undefined || updates.canvasSpec === null) {
          // Delete canvas spec
          console.log('[SessionListContext] Deleting canvas spec');
          const storage = await getStorage();
          await storage.delete(`sessions/${id}/canvas-spec`);
        } else {
          // Save canvas spec
          console.log('[SessionListContext] Saving canvas spec via ChunkedStorage');
          await chunkedStorage.saveCanvasSpec(id, updates.canvasSpec);
        }
      }

      // Summary - stored in summary.json
      if ('summary' in updates && updates.summary) {
        console.log('[SessionListContext] Saving summary via ChunkedStorage');
        await chunkedStorage.saveSummary(id, updates.summary);
      }

      // Audio insights - stored in audio-insights.json
      if ('audioInsights' in updates && updates.audioInsights) {
        console.log('[SessionListContext] Saving audio insights via ChunkedStorage');
        await chunkedStorage.saveAudioInsights(id, updates.audioInsights);
      }

      // Full transcription - stored in transcription.json
      if ('fullTranscription' in updates && updates.fullTranscription) {
        console.log('[SessionListContext] Saving transcription via ChunkedStorage');
        await chunkedStorage.saveTranscription(id, updates.fullTranscription);
      }

      // Context items - stored in context-items.json
      if ('contextItems' in updates && updates.contextItems) {
        console.log('[SessionListContext] Saving context items via ChunkedStorage');
        await chunkedStorage.saveContextItems(id, updates.contextItems);
      }

      // Screenshots - stored in chunked format
      if ('screenshots' in updates && updates.screenshots) {
        console.log('[SessionListContext] Saving screenshots via ChunkedStorage');
        await chunkedStorage.saveScreenshots(id, updates.screenshots);
      }

      // Audio segments - stored in chunked format
      if ('audioSegments' in updates && updates.audioSegments) {
        console.log('[SessionListContext] Saving audio segments via ChunkedStorage');
        await chunkedStorage.saveAudioSegments(id, updates.audioSegments);
      }

      // Update metadata with all changes
      const metadata = await chunkedStorage.loadMetadata(id);
      if (metadata) {
        // Build updated metadata object
        const updatedMetadata: SessionMetadata = {
          ...metadata,
          ...updates,
          // Preserve chunks manifest (don't let updates overwrite this)
          chunks: metadata.chunks,
          // Update feature flags based on what was saved
          hasCanvasSpec: 'canvasSpec' in updates
            ? (updates.canvasSpec !== undefined && updates.canvasSpec !== null)
            : metadata.hasCanvasSpec,
          hasSummary: 'summary' in updates
            ? (updates.summary !== undefined && updates.summary !== null)
            : metadata.hasSummary,
          hasAudioInsights: 'audioInsights' in updates
            ? (updates.audioInsights !== undefined && updates.audioInsights !== null)
            : metadata.hasAudioInsights,
          hasTranscription: 'fullTranscription' in updates
            ? (updates.fullTranscription !== undefined && updates.fullTranscription !== null)
            : metadata.hasTranscription,
          // Update timestamp
          updatedAt: new Date().toISOString(),
        };

        // Save metadata (uses the queue internally)
        await chunkedStorage.saveMetadata(updatedMetadata);
        console.log('[SessionListContext] ✅ Session metadata updated via ChunkedStorage');

        // Update indexes asynchronously (non-blocking)
        (async () => {
          try {
            const indexManager = await getInvertedIndexManager();
            await indexManager.updateIndexes(updatedMetadata);
            console.log('[SessionListContext] Index updated for session:', id);
          } catch (error) {
            console.error('[SessionListContext] Failed to update index for session:', error);
            // Non-fatal - search will use linear scan fallback if indexes corrupt
          }
        })();
      }
    } finally {
      end();
    }
  }, []);

  // Delete session (with cleanup)
  const deleteSession = useCallback(async (id: string) => {
    const end = perfMonitor.start('session-delete');
    console.log('[SessionListContext] Deleting session:', id);

    try {
      // CRITICAL: Load FULL session (not metadata-only) to ensure all attachment IDs are collected
      console.log('[SessionListContext] Loading full session for deletion:', id);
      const chunkedStorage = await getChunkedStorage();
      const session = await chunkedStorage.loadFullSession(id);

      if (!session) {
        console.warn('[SessionListContext] Session not found for deletion:', id);
        return;
      }

      // Check if enrichment is in progress
      if (session.enrichmentStatus?.status === 'in-progress') {
        throw new Error('Cannot delete session while enrichment is in progress');
      }

      // Phase 4: Remove all attachment references for this session
      // Garbage collection will automatically delete unreferenced data
      const caStorage = await getCAStorage();
      let removedReferences = 0;

      // Screenshots - remove references using hash
      if (session.screenshots) {
        for (const screenshot of session.screenshots) {
          const hash = screenshot.hash || screenshot.attachmentId; // Fallback for legacy
          if (hash && screenshot.attachmentId) {
            try {
              await caStorage.removeReference(hash, id);
              removedReferences++;
            } catch (error) {
              console.error(`[SessionListContext] Failed to remove screenshot reference: ${hash}`, error);
            }
          }
        }
      }

      // Audio segments - remove references using hash
      if (session.audioSegments) {
        for (const segment of session.audioSegments) {
          const hash = segment.hash || segment.attachmentId; // Fallback for legacy
          if (hash && segment.attachmentId) {
            try {
              await caStorage.removeReference(hash, id);
              removedReferences++;
            } catch (error) {
              console.error(`[SessionListContext] Failed to remove audio segment reference: ${hash}`, error);
            }
          }
        }
      }

      // Full audio attachment
      if (session.fullAudioAttachmentId) {
        console.log('[SessionListContext] Removing fullAudioAttachmentId reference:', session.fullAudioAttachmentId);
        try {
          await caStorage.removeReference(session.fullAudioAttachmentId, id);
          removedReferences++;
        } catch (error) {
          console.error('[SessionListContext] Failed to remove full audio reference:', error);
        }
      }

      // Video - no attachments to remove (video uses file paths, not CAS)
      // SessionVideo only has path and optimizedPath properties

      console.log(`[SessionListContext] ✅ Removed ${removedReferences} attachment references (GC will clean up unreferenced data)`);

      // Delete session from ChunkedStorage (metadata + all chunks)
      console.log('[SessionListContext] Deleting session from storage:', id);
      await chunkedStorage.deleteSession(id);

      // Update state
      dispatch({ type: 'DELETE_SESSION', payload: id });

      // Remove from indexes asynchronously (non-blocking)
      (async () => {
        try {
          const indexManager = await getInvertedIndexManager();
          await indexManager.deleteFromIndexes(id);
          console.log('[SessionListContext] Index updated after session deletion:', id);
        } catch (error) {
          console.error('[SessionListContext] Failed to remove session from index:', error);
          // Non-fatal - search will use linear scan fallback if indexes corrupt
        }
      })();
    } finally {
      end();
    }
  }, []);

  // Filter and sort sessions (using inverted indexes for fast search)
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);

  // Effect to handle async filtering with indexed search
  useEffect(() => {
    const filterAndSort = async () => {
      // Fast path: No filters, just sort
      if (!state.filter) {
        let result = [...state.sessions];

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

        setFilteredSessions(result);
        return;
      }

      // Build search query for index manager
      const hasIndexableFilters =
        state.filter.searchQuery ||
        (state.filter.tags && state.filter.tags.length > 0) ||
        (state.filter.startAfter || state.filter.startBefore) ||
        state.filter.category ||
        state.filter.subCategory ||
        (state.filter.status && state.filter.status.length > 0);

      if (hasIndexableFilters) {
        console.log('[SessionListContext] Using indexed search for filters:', {
          searchQuery: state.filter.searchQuery,
          tags: state.filter.tags,
          status: state.filter.status,
        });

        try {
          const indexManager = await getInvertedIndexManager();

          // Build search query
          const searchQuery: any = {
            text: state.filter.searchQuery || undefined,
            tags: state.filter.tags && state.filter.tags.length > 0 ? state.filter.tags : undefined,
            category: state.filter.category || undefined,
            subCategory: state.filter.subCategory || undefined,
            status: state.filter.status && state.filter.status.length > 0 ? state.filter.status : undefined,
            operator: 'AND' as const,  // All filters must match
          };

          // Add date range if specified
          if (state.filter.startAfter || state.filter.startBefore) {
            searchQuery.dateRange = {
              start: state.filter.startAfter ? state.filter.startAfter.getTime() : 0,
              end: state.filter.startBefore ? state.filter.startBefore.getTime() : Date.now(),
            };
          }

          // Execute indexed search (20-50x faster)
          const startTime = performance.now();
          const results = await indexManager.search(searchQuery);
          const duration = performance.now() - startTime;

          console.log(`[SessionListContext] Indexed search completed in ${duration.toFixed(2)}ms (${results.sessionIds.length} results)`);

          // Filter sessions by indexed results
          const resultSet = new Set(results.sessionIds);
          let filtered = state.sessions.filter(s => resultSet.has(s.id));

          // Apply sort
          filtered.sort((a, b) => {
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

          setFilteredSessions(filtered);
          return;
        } catch (error) {
          console.error('[SessionListContext] Indexed search failed, falling back to linear scan:', error);
          // Fall through to linear scan fallback
        }
      }

      // Linear scan fallback (if indexed search failed or no indexable filters)
      let result = [...state.sessions];

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

      setFilteredSessions(result);
    };

    filterAndSort();
  }, [state.sessions, state.filter, state.sortBy]);

  // Get session by ID
  const getSessionById = useCallback((id: string) => {
    return state.sessions.find(s => s.id === id);
  }, [state.sessions]);

  // Relationship helper methods (Phase C2)
  const linkSessionToTask = useCallback(async (
    sessionId: string,
    taskId: string,
    metadata?: { confidence?: number; reasoning?: string }
  ) => {
    if (!relationshipsContext) {
      console.warn('[SessionListContext] RelationshipContext not available - skipping linkSessionToTask');
      return;
    }

    try {
      await relationshipsContext.addRelationship({
        sourceType: EntityType.TASK,
        sourceId: taskId,
        targetType: EntityType.SESSION,
        targetId: sessionId,
        type: RelationshipType.TASK_SESSION,
        metadata: {
          source: 'ai',
          createdAt: new Date().toISOString(),
          confidence: metadata?.confidence,
          reasoning: metadata?.reasoning,
        },
      });

      console.log(`[SessionListContext] Linked task ${taskId} to session ${sessionId}`);
    } catch (error) {
      console.error('[SessionListContext] Failed to link session to task:', error);
      throw error;
    }
  }, [relationshipsContext]);

  const linkSessionToNote = useCallback(async (
    sessionId: string,
    noteId: string,
    metadata?: { confidence?: number; reasoning?: string }
  ) => {
    if (!relationshipsContext) {
      console.warn('[SessionListContext] RelationshipContext not available - skipping linkSessionToNote');
      return;
    }

    try {
      await relationshipsContext.addRelationship({
        sourceType: EntityType.NOTE,
        sourceId: noteId,
        targetType: EntityType.SESSION,
        targetId: sessionId,
        type: RelationshipType.NOTE_SESSION,
        metadata: {
          source: 'ai',
          createdAt: new Date().toISOString(),
          confidence: metadata?.confidence,
          reasoning: metadata?.reasoning,
        },
      });

      console.log(`[SessionListContext] Linked note ${noteId} to session ${sessionId}`);
    } catch (error) {
      console.error('[SessionListContext] Failed to link session to note:', error);
      throw error;
    }
  }, [relationshipsContext]);

  const unlinkSessionFromTask = useCallback(async (
    sessionId: string,
    taskId: string
  ) => {
    if (!relationshipsContext) {
      console.warn('[SessionListContext] RelationshipContext not available - skipping unlinkSessionFromTask');
      return;
    }

    try {
      // Find the relationship between session and task
      const relationships = relationshipsContext.getRelationships(sessionId);
      const relationship = relationships.find(r =>
        (r.sourceId === sessionId && r.targetId === taskId) ||
        (r.sourceId === taskId && r.targetId === sessionId)
      );

      if (relationship) {
        await relationshipsContext.removeRelationship(relationship.id);
        console.log(`[SessionListContext] Unlinked task ${taskId} from session ${sessionId}`);
      } else {
        console.warn(`[SessionListContext] No relationship found between session ${sessionId} and task ${taskId}`);
      }
    } catch (error) {
      console.error('[SessionListContext] Failed to unlink session from task:', error);
      throw error;
    }
  }, [relationshipsContext]);

  const unlinkSessionFromNote = useCallback(async (
    sessionId: string,
    noteId: string
  ) => {
    if (!relationshipsContext) {
      console.warn('[SessionListContext] RelationshipContext not available - skipping unlinkSessionFromNote');
      return;
    }

    try {
      // Find the relationship between session and note
      const relationships = relationshipsContext.getRelationships(sessionId);
      const relationship = relationships.find(r =>
        (r.sourceId === sessionId && r.targetId === noteId) ||
        (r.sourceId === noteId && r.targetId === sessionId)
      );

      if (relationship) {
        await relationshipsContext.removeRelationship(relationship.id);
        console.log(`[SessionListContext] Unlinked note ${noteId} from session ${sessionId}`);
      } else {
        console.warn(`[SessionListContext] No relationship found between session ${sessionId} and note ${noteId}`);
      }
    } catch (error) {
      console.error('[SessionListContext] Failed to unlink session from note:', error);
      throw error;
    }
  }, [relationshipsContext]);

  // Load sessions on mount (inline function pattern - matches EntitiesContext/NotesContext)
  useEffect(() => {
    const load = async () => {
      const end = perfMonitor.start('session-list-load');
      console.log('[SessionListContext] Loading sessions from storage (metadata only)...');
      dispatch({ type: 'LOAD_SESSIONS_START' });

      try {
        const chunkedStorage = await getChunkedStorage();
        const metadataList = await chunkedStorage.listAllMetadata();

        // Convert metadata to partial Session objects for UI compatibility
        // FIX: Do NOT load canvas specs on startup to prevent memory leak
        // Canvas specs can be large (40KB-50MB) and loading all of them causes OOM
        // They will be loaded on-demand when viewing session details
        const sessions = metadataList.map((metadata) => {
            return {
              // Core identity
              id: metadata.id,
              name: metadata.name,
              description: metadata.description,

              // Lifecycle
              status: metadata.status,
              startTime: metadata.startTime,
              endTime: metadata.endTime,
              lastScreenshotTime: metadata.lastScreenshotTime,
              pausedAt: metadata.pausedAt,
              totalPausedTime: metadata.totalPausedTime,

              // Configuration
              screenshotInterval: metadata.screenshotInterval,
              autoAnalysis: metadata.autoAnalysis,
              enableScreenshots: metadata.enableScreenshots,
              audioMode: metadata.audioMode,
              audioRecording: metadata.audioRecording,
              videoRecording: metadata.videoRecording,

              // References
              trackingNoteId: metadata.trackingNoteId,
              relationships: metadata.relationships || [],

              // Metadata
              tags: metadata.tags,
              category: metadata.category,
              subCategory: metadata.subCategory,
              activityType: metadata.activityType,
              totalDuration: metadata.totalDuration,

              // Feature flags (converted to actual data)
              audioReviewCompleted: metadata.audioReviewCompleted,
              fullAudioAttachmentId: metadata.fullAudioAttachmentId,
              transcriptUpgradeCompleted: metadata.transcriptUpgradeCompleted,

              // Video metadata
              video: metadata.video,

              // Enrichment
              enrichmentStatus: metadata.enrichmentStatus,
              enrichmentConfig: metadata.enrichmentConfig,
              enrichmentLock: metadata.enrichmentLock,

              // Audio/video config
              audioConfig: metadata.audioConfig,
              videoConfig: metadata.videoConfig,

              // Version
              version: metadata.version,

              // Canvas spec (NOT loaded - lazy load when viewing session)
              canvasSpec: undefined,

              // Arrays (empty for metadata-only loading)
              screenshots: [], // Don't load chunks yet
              audioSegments: [], // Don't load chunks yet
              contextItems: [], // Don't load yet
            };
          });

        console.log(`[SessionListContext] Loaded ${sessions.length} sessions (metadata only)`);

        dispatch({ type: 'LOAD_SESSIONS_SUCCESS', payload: sessions });

        // Update indexes for all loaded sessions asynchronously (non-blocking)
        (async () => {
          try {
            const indexManager = await getInvertedIndexManager();
            console.log(`[SessionListContext] Bulk updating indexes for ${metadataList.length} sessions...`);
            const startTime = performance.now();

            // Rebuild indexes from all metadata (more efficient than individual updates)
            await indexManager.buildIndexes(metadataList);

            const duration = performance.now() - startTime;
            console.log(`[SessionListContext] Indexes rebuilt in ${duration.toFixed(2)}ms`);
          } catch (error) {
            console.error('[SessionListContext] Failed to bulk update indexes:', error);
            // Non-fatal - search will use linear scan fallback if indexes corrupt
          }
        })();
      } catch (error) {
        console.error('[SessionListContext] Failed to load sessions:', error);
        dispatch({
          type: 'LOAD_SESSIONS_ERROR',
          payload: error instanceof Error ? error.message : 'Failed to load sessions'
        });
      } finally {
        end();
      }
    };

    load();
  }, []); // Empty deps: runs once on mount

  // Flush queue on unmount to ensure data is saved
  useEffect(() => {
    return () => {
      console.log('[SessionListContext] Flushing persistence queue on unmount');
      queue.flush();
    };
  }, [queue]);

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
    linkSessionToTask,
    linkSessionToNote,
    unlinkSessionFromTask,
    unlinkSessionFromNote,
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
