import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Note, Company, Contact, Topic, ManualNoteData } from '../types';
import { getStorage } from '../services/storage';
import { generateId } from '../utils/helpers';
import { useEntities } from './EntitiesContext';
// QueryEngine removed - use UnifiedIndexManager for search operations
import { useRelationships } from './RelationshipContext';
import { EntityType, RelationshipType } from '../types/relationships';
import { normalizeNotes } from '../utils/entityMigration';
import { debug } from "../utils/debug";

// Notes State
interface NotesState {
  notes: Note[];
}

type NotesAction =
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'UPDATE_NOTE'; payload: Note }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'BATCH_ADD_NOTES'; payload: Note[] }
  | { type: 'BATCH_UPDATE_NOTES'; payload: { ids: string[]; updates: Partial<Note> } }
  | { type: 'CREATE_MANUAL_NOTE'; payload: ManualNoteData }
  | { type: 'LOAD_NOTES'; payload: Note[] };

// Default state
const defaultState: NotesState = {
  notes: [],
};

// Reducer
function notesReducer(state: NotesState, action: NotesAction): NotesState {
  switch (action.type) {
    case 'ADD_NOTE':
      return { ...state, notes: [...state.notes, action.payload] };

    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map(note =>
          note.id === action.payload.id ? action.payload : note
        ),
      };

    case 'DELETE_NOTE':
      return {
        ...state,
        notes: state.notes.filter(note => note.id !== action.payload),
      };

    case 'BATCH_ADD_NOTES':
      return { ...state, notes: [...state.notes, ...action.payload] };

    case 'BATCH_UPDATE_NOTES': {
      const { ids, updates } = action.payload;
      return {
        ...state,
        notes: state.notes.map(note =>
          ids.includes(note.id)
            ? { ...note, ...updates, lastUpdated: new Date().toISOString() }
            : note
        ),
      };
    }

    case 'LOAD_NOTES':
      return { ...state, notes: action.payload };

    default:
      return state;
  }
}

// Context
const NotesContext = createContext<{
  state: NotesState;
  dispatch: React.Dispatch<NotesAction>;
  // Exposed methods that handle cross-context updates
  addNote: (note: Note) => void;
  updateNote: (note: Note) => void;
  deleteNote: (id: string) => void;
  batchAddNotes: (notes: Note[]) => void;
  createManualNote: (data: ManualNoteData) => void;

  // Query Engine Methods (Phase 3.3)
  // queryNotes removed - use UnifiedIndexManager directly for search operations

  // Relationship helper methods (Phase C2)
  linkNoteToTopic: (noteId: string, topicId: string) => Promise<void>;
  unlinkNoteFromTopic: (noteId: string, topicId: string) => Promise<void>;
  linkNoteToCompany: (noteId: string, companyId: string) => Promise<void>;
  unlinkNoteFromCompany: (noteId: string, companyId: string) => Promise<void>;
  linkNoteToContact: (noteId: string, contactId: string) => Promise<void>;
  unlinkNoteFromContact: (noteId: string, contactId: string) => Promise<void>;

  // Phase 5 methods: Merge and batch update
  mergeNotes: (sourceIds: string[], targetId: string, strategy: 'append' | 'replace') => Promise<Note>;
  batchUpdateNotes: (noteIds: string[], updates: Partial<Note>) => Promise<void>;
} | null>(null);

// Provider
export function NotesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notesReducer, defaultState);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Access EntitiesContext for cross-context updates
  const entitiesContext = useEntities();

  // Get relationship context (may not be available during initial render)
  let relationshipsContext;
  try {
    relationshipsContext = useRelationships();
  } catch {
    // RelationshipContext not available yet - that's OK during migration
    relationshipsContext = null;
  }

  // Load from storage on mount
  useEffect(() => {
    async function loadNotes() {
      try {
        const storage = await getStorage();
        const notes = await storage.load<Note[]>('notes');

        if (Array.isArray(notes)) {
          // Normalize notes to ensure relationships array exists (backward compatibility)
          const normalizedNotes = normalizeNotes(notes);
          dispatch({ type: 'LOAD_NOTES', payload: normalizedNotes });
        }

        setHasLoaded(true);
      } catch (error) {
        console.error('Failed to load notes:', error);
        setHasLoaded(true);
      }
    }
    loadNotes();
  }, []);

  // Save to storage on change (debounced 5 seconds)
  useEffect(() => {
    if (!hasLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const storage = await getStorage();
        await storage.save('notes', state.notes);
        debug.log("Notes saved to storage");
      } catch (error) {
        console.error('Failed to save notes:', error);
      }
    }, 5000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasLoaded, state.notes]);

  // ADD_NOTE
  const addNote = async (note: Note) => {
    dispatch({ type: 'ADD_NOTE', payload: note });
  };

  // UPDATE_NOTE
  const updateNote = async (note: Note) => {
    dispatch({ type: 'UPDATE_NOTE', payload: note });
  };

  // DELETE_NOTE
  const deleteNote = async (id: string) => {
    const deletedNote = state.notes.find(n => n.id === id);
    if (!deletedNote) return;

    // Delete relationships
    if (relationshipsContext) {
      try {
        const relationships = relationshipsContext.getRelationships(id);
        for (const rel of relationships) {
          await relationshipsContext.removeRelationship(rel.id);
        }
      } catch (error) {
        console.error('[NotesContext] Failed to delete note relationships:', error);
      }
    }

    dispatch({ type: 'DELETE_NOTE', payload: id });
  };

  // BATCH_ADD_NOTES
  const batchAddNotes = (notes: Note[]) => {
    dispatch({ type: 'BATCH_ADD_NOTES', payload: notes });
  };

  // CREATE_MANUAL_NOTE - simplified for new relationship system
  const createManualNote = (noteData: ManualNoteData) => {
    // Generate summary/title based on content length
    const timestamp = new Date().toISOString();
    let summary: string;
    if (noteData.content.trim().length < 50) {
      // Short note: use "Note [DATETIME]" format
      const date = new Date(timestamp);
      const dateStr = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      summary = `Note ${dateStr}`;
    } else {
      // Long note: truncate content for summary
      summary = noteData.content.substring(0, 100) + (noteData.content.length > 100 ? '...' : '');
    }

    const newNote: Note = {
      id: generateId(),
      relationships: [], // Empty for manual notes - user can add later
      content: noteData.content,
      summary,
      timestamp,
      lastUpdated: timestamp,
      source: noteData.source || 'thought',
      tags: noteData.tags || [],
    };

    // Add note
    addNote(newNote);
  };

  // REMOVED: queryNotes method (QueryEngine deprecated)
  // Use UnifiedIndexManager instead:
  //
  // import { getUnifiedIndexManager } from '../services/storage/UnifiedIndexManager';
  // const unifiedIndex = await getUnifiedIndexManager();
  // const result = await unifiedIndex.search({
  //   entityTypes: ['notes'],
  //   query: 'search text',
  //   filters: { ... },
  //   limit: 20
  // });
  //
  // See: /docs/UNIFIED_INDEX_MANAGER_IMPLEMENTATION_SUMMARY.md

  // Relationship helper methods (Phase C2)
  const linkNoteToTopic = React.useCallback(async (noteId: string, topicId: string) => {
    if (!relationshipsContext) {
      console.warn('[NotesContext] RelationshipContext not available - skipping linkNoteToTopic');
      return;
    }

    try {
      await relationshipsContext.addRelationship({
        sourceType: EntityType.NOTE,
        sourceId: noteId,
        targetType: EntityType.TOPIC,
        targetId: topicId,
        type: RelationshipType.NOTE_TOPIC,
        metadata: { source: 'manual', createdAt: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[NotesContext] Failed to link note to topic:', error);
      throw error;
    }
  }, [relationshipsContext]);

  const unlinkNoteFromTopic = React.useCallback(async (noteId: string, topicId: string) => {
    if (!relationshipsContext) {
      console.warn('[NotesContext] RelationshipContext not available - skipping unlinkNoteFromTopic');
      return;
    }

    try {
      const relationships = relationshipsContext.getRelationships(noteId, RelationshipType.NOTE_TOPIC);
      const rel = relationships.find(r => r.targetId === topicId);
      if (rel) {
        await relationshipsContext.removeRelationship(rel.id);
      }
    } catch (error) {
      console.error('[NotesContext] Failed to unlink note from topic:', error);
      throw error;
    }
  }, [relationshipsContext]);

  const linkNoteToCompany = React.useCallback(async (noteId: string, companyId: string) => {
    if (!relationshipsContext) {
      console.warn('[NotesContext] RelationshipContext not available - skipping linkNoteToCompany');
      return;
    }

    try {
      await relationshipsContext.addRelationship({
        sourceType: EntityType.NOTE,
        sourceId: noteId,
        targetType: EntityType.COMPANY,
        targetId: companyId,
        type: RelationshipType.NOTE_COMPANY,
        metadata: { source: 'manual', createdAt: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[NotesContext] Failed to link note to company:', error);
      throw error;
    }
  }, [relationshipsContext]);

  const unlinkNoteFromCompany = React.useCallback(async (noteId: string, companyId: string) => {
    if (!relationshipsContext) {
      console.warn('[NotesContext] RelationshipContext not available - skipping unlinkNoteFromCompany');
      return;
    }

    try {
      const relationships = relationshipsContext.getRelationships(noteId, RelationshipType.NOTE_COMPANY);
      const rel = relationships.find(r => r.targetId === companyId);
      if (rel) {
        await relationshipsContext.removeRelationship(rel.id);
      }
    } catch (error) {
      console.error('[NotesContext] Failed to unlink note from company:', error);
      throw error;
    }
  }, [relationshipsContext]);

  const linkNoteToContact = React.useCallback(async (noteId: string, contactId: string) => {
    if (!relationshipsContext) {
      console.warn('[NotesContext] RelationshipContext not available - skipping linkNoteToContact');
      return;
    }

    try {
      await relationshipsContext.addRelationship({
        sourceType: EntityType.NOTE,
        sourceId: noteId,
        targetType: EntityType.CONTACT,
        targetId: contactId,
        type: RelationshipType.NOTE_CONTACT,
        metadata: { source: 'manual', createdAt: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[NotesContext] Failed to link note to contact:', error);
      throw error;
    }
  }, [relationshipsContext]);

  const unlinkNoteFromContact = React.useCallback(async (noteId: string, contactId: string) => {
    if (!relationshipsContext) {
      console.warn('[NotesContext] RelationshipContext not available - skipping unlinkNoteFromContact');
      return;
    }

    try {
      const relationships = relationshipsContext.getRelationships(noteId, RelationshipType.NOTE_CONTACT);
      const rel = relationships.find(r => r.targetId === contactId);
      if (rel) {
        await relationshipsContext.removeRelationship(rel.id);
      }
    } catch (error) {
      console.error('[NotesContext] Failed to unlink note from contact:', error);
      throw error;
    }
  }, [relationshipsContext]);

  // Phase 5: Merge notes
  const mergeNotes = React.useCallback(async (
    sourceIds: string[],
    targetId: string,
    strategy: 'append' | 'replace'
  ): Promise<Note> => {
    const sourceNotes = state.notes.filter(n => sourceIds.includes(n.id));
    const targetNote = state.notes.find(n => n.id === targetId);

    if (!targetNote) {
      throw new Error(`Target note not found: ${targetId}`);
    }

    // Merge content based on strategy
    const mergedContent = strategy === 'append'
      ? targetNote.content + '\n\n' + sourceNotes.map(n => n.content).join('\n\n')
      : sourceNotes[sourceNotes.length - 1].content;

    // Merge tags (deduplicate)
    const allTags = [...targetNote.tags, ...sourceNotes.flatMap(n => n.tags || [])];
    const mergedTags = [...new Set(allTags)];

    // Create merged note
    const mergedNote: Note = {
      ...targetNote,
      content: mergedContent,
      tags: mergedTags,
      lastUpdated: new Date().toISOString(),
      metadata: {
        ...targetNote.metadata,
        aiEnrichment: {
          ...(targetNote.metadata?.aiEnrichment || {}),
          enrichedAt: new Date().toISOString(),
          model: 'merge-operation',
          autoEnriched: false,
          // Track merge history in aiEnrichment metadata
          relatedNoteIds: [...(targetNote.metadata?.aiEnrichment?.relatedNoteIds || []), ...sourceIds],
        },
      } as Note['metadata'],
    };

    // Update target note
    dispatch({ type: 'UPDATE_NOTE', payload: mergedNote });

    // Delete source notes
    sourceIds.forEach(id => dispatch({ type: 'DELETE_NOTE', payload: id }));

    return mergedNote;
  }, [state.notes]);

  // Phase 5: Batch update notes
  const batchUpdateNotes = React.useCallback(async (
    noteIds: string[],
    updates: Partial<Note>
  ): Promise<void> => {
    dispatch({
      type: 'BATCH_UPDATE_NOTES',
      payload: { ids: noteIds, updates }
    });
  }, []);

  return (
    <NotesContext.Provider value={{
      state,
      dispatch,
      addNote,
      updateNote,
      deleteNote,
      batchAddNotes,
      createManualNote,
      // queryNotes removed - use UnifiedIndexManager
      linkNoteToTopic,
      unlinkNoteFromTopic,
      linkNoteToCompany,
      unlinkNoteFromCompany,
      linkNoteToContact,
      unlinkNoteFromContact,
      mergeNotes,
      batchUpdateNotes,
    }}>
      {children}
    </NotesContext.Provider>
  );
}

// Hook
export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within NotesProvider');
  }
  return context;
}
