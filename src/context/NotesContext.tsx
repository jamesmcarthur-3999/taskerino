import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Note, Company, Contact, Topic, ManualNoteData } from '../types';
import { getStorage } from '../services/storage';
import { generateId } from '../utils/helpers';
import { useEntities } from './EntitiesContext';
import { QueryEngine, type QueryFilter, type QuerySort } from '../services/storage/QueryEngine';
import { useRelationships } from './RelationshipContext';
import { EntityType, RelationshipType } from '../types/relationships';

// Notes State
interface NotesState {
  notes: Note[];
}

type NotesAction =
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'UPDATE_NOTE'; payload: Note }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'BATCH_ADD_NOTES'; payload: Note[] }
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
  queryNotes: (filters: QueryFilter[], sort?: QuerySort, limit?: number) => Promise<Note[]>;

  // Relationship helper methods (Phase C2)
  linkNoteToTopic: (noteId: string, topicId: string) => Promise<void>;
  unlinkNoteFromTopic: (noteId: string, topicId: string) => Promise<void>;
  linkNoteToCompany: (noteId: string, companyId: string) => Promise<void>;
  unlinkNoteFromCompany: (noteId: string, companyId: string) => Promise<void>;
  linkNoteToContact: (noteId: string, contactId: string) => Promise<void>;
  unlinkNoteFromContact: (noteId: string, contactId: string) => Promise<void>;
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
          dispatch({ type: 'LOAD_NOTES', payload: notes });
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
        console.log('Notes saved to storage');
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

  // ADD_NOTE with entity noteCount updates and relationship creation
  const addNote = async (note: Note) => {
    dispatch({ type: 'ADD_NOTE', payload: note });

    // Update entity noteCounts
    const linkedCompanyIds = note.companyIds || [];
    const linkedContactIds = note.contactIds || [];
    const linkedTopicIds = note.topicIds || [];

    // Also handle legacy topicId
    if (note.topicId && !linkedTopicIds.includes(note.topicId)) {
      linkedTopicIds.push(note.topicId);
    }

    const timestamp = note.timestamp;

    // Create lookup Maps for O(1) access
    const companiesMap = new Map(entitiesContext.state.companies.map(c => [c.id, c]));
    const contactsMap = new Map(entitiesContext.state.contacts.map(c => [c.id, c]));
    const topicsMap = new Map(entitiesContext.state.topics.map(t => [t.id, t]));

    // Update companies
    linkedCompanyIds.forEach(id => {
      const company = companiesMap.get(id);
      if (company) {
        entitiesContext.dispatch({
          type: 'UPDATE_COMPANY',
          payload: {
            ...company,
            noteCount: company.noteCount + 1,
            lastUpdated: timestamp,
          },
        });
      }
    });

    // Update contacts
    linkedContactIds.forEach(id => {
      const contact = contactsMap.get(id);
      if (contact) {
        entitiesContext.dispatch({
          type: 'UPDATE_CONTACT',
          payload: {
            ...contact,
            noteCount: contact.noteCount + 1,
            lastUpdated: timestamp,
          },
        });
      }
    });

    // Update topics
    linkedTopicIds.forEach(id => {
      const topic = topicsMap.get(id);
      if (topic) {
        entitiesContext.dispatch({
          type: 'UPDATE_TOPIC',
          payload: {
            ...topic,
            noteCount: topic.noteCount + 1,
            lastUpdated: timestamp,
          },
        });
      }
    });

    // Create relationships if RelationshipContext is available
    // Skip relationship creation for draft notes (they'll be created when approved)
    if (relationshipsContext && note.status !== 'draft') {
      try {
        // Create relationships for topics
        for (const topicId of linkedTopicIds) {
          await relationshipsContext.addRelationship({
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.TOPIC,
            targetId: topicId,
            type: RelationshipType.NOTE_TOPIC,
            metadata: { source: 'manual', createdAt: new Date().toISOString() },
          });
        }

        // Create relationships for companies
        for (const companyId of linkedCompanyIds) {
          await relationshipsContext.addRelationship({
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.COMPANY,
            targetId: companyId,
            type: RelationshipType.NOTE_COMPANY,
            metadata: { source: 'manual', createdAt: new Date().toISOString() },
          });
        }

        // Create relationships for contacts
        for (const contactId of linkedContactIds) {
          await relationshipsContext.addRelationship({
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.CONTACT,
            targetId: contactId,
            type: RelationshipType.NOTE_CONTACT,
            metadata: { source: 'manual', createdAt: new Date().toISOString() },
          });
        }

        // Create relationship to source session if specified
        if (note.sourceSessionId) {
          await relationshipsContext.addRelationship({
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.SESSION,
            targetId: note.sourceSessionId,
            type: RelationshipType.NOTE_SESSION,
            metadata: {
              source: 'manual', // Notes are created manually, even if from sessions
              createdAt: new Date().toISOString()
            },
          });
        }

        // Mark note as using relationship system
        if (!note.relationshipVersion) {
          const updatedNote = { ...note, relationshipVersion: 1 };
          dispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
        }
      } catch (error) {
        console.error('[NotesContext] Failed to create note relationships:', error);
      }
    }
  };

  // UPDATE_NOTE - simple dispatch without entity updates
  // Special case: Create relationships when draft note becomes approved
  const updateNote = async (note: Note) => {
    const oldNote = state.notes.find(n => n.id === note.id);
    const wasDraft = oldNote?.status === 'draft';
    const isNowApproved = note.status === 'approved';

    dispatch({ type: 'UPDATE_NOTE', payload: note });

    // Create relationships when draft note is approved
    if (wasDraft && isNowApproved && relationshipsContext) {
      const linkedCompanyIds = note.companyIds || [];
      const linkedContactIds = note.contactIds || [];
      const linkedTopicIds = note.topicIds || [];

      // Also handle legacy topicId
      if (note.topicId && !linkedTopicIds.includes(note.topicId)) {
        linkedTopicIds.push(note.topicId);
      }

      try {
        // Create relationships for topics
        for (const topicId of linkedTopicIds) {
          await relationshipsContext.addRelationship({
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.TOPIC,
            targetId: topicId,
            type: RelationshipType.NOTE_TOPIC,
            metadata: { source: 'manual', createdAt: new Date().toISOString() },
          });
        }

        // Create relationships for companies
        for (const companyId of linkedCompanyIds) {
          await relationshipsContext.addRelationship({
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.COMPANY,
            targetId: companyId,
            type: RelationshipType.NOTE_COMPANY,
            metadata: { source: 'manual', createdAt: new Date().toISOString() },
          });
        }

        // Create relationships for contacts
        for (const contactId of linkedContactIds) {
          await relationshipsContext.addRelationship({
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.CONTACT,
            targetId: contactId,
            type: RelationshipType.NOTE_CONTACT,
            metadata: { source: 'manual', createdAt: new Date().toISOString() },
          });
        }

        // Create relationship to source session if specified
        if (note.sourceSessionId) {
          await relationshipsContext.addRelationship({
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.SESSION,
            targetId: note.sourceSessionId,
            type: RelationshipType.NOTE_SESSION,
            metadata: {
              source: 'manual',
              createdAt: new Date().toISOString()
            },
          });
        }

        // Mark note as using relationship system
        if (!note.relationshipVersion) {
          const updatedNote = { ...note, relationshipVersion: 1 };
          dispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
        }
      } catch (error) {
        console.error('[NotesContext] Failed to create relationships for approved note:', error);
      }
    }
  };

  // DELETE_NOTE with entity noteCount updates and relationship cascade deletion
  const deleteNote = async (id: string) => {
    const deletedNote = state.notes.find(n => n.id === id);
    if (!deletedNote) return;

    // Delete relationships first if RelationshipContext is available
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

    // Update entity noteCounts
    const linkedCompanyIds = deletedNote.companyIds || [];
    const linkedContactIds = deletedNote.contactIds || [];
    const linkedTopicIds = deletedNote.topicIds || [];

    // Also handle legacy topicId
    if (deletedNote.topicId && !linkedTopicIds.includes(deletedNote.topicId)) {
      linkedTopicIds.push(deletedNote.topicId);
    }

    // Create lookup Maps for O(1) access
    const companiesMap = new Map(entitiesContext.state.companies.map(c => [c.id, c]));
    const contactsMap = new Map(entitiesContext.state.contacts.map(c => [c.id, c]));
    const topicsMap = new Map(entitiesContext.state.topics.map(t => [t.id, t]));

    // Update companies
    linkedCompanyIds.forEach(id => {
      const company = companiesMap.get(id);
      if (company) {
        entitiesContext.dispatch({
          type: 'UPDATE_COMPANY',
          payload: {
            ...company,
            noteCount: Math.max(0, company.noteCount - 1),
          },
        });
      }
    });

    // Update contacts
    linkedContactIds.forEach(id => {
      const contact = contactsMap.get(id);
      if (contact) {
        entitiesContext.dispatch({
          type: 'UPDATE_CONTACT',
          payload: {
            ...contact,
            noteCount: Math.max(0, contact.noteCount - 1),
          },
        });
      }
    });

    // Update topics
    linkedTopicIds.forEach(id => {
      const topic = topicsMap.get(id);
      if (topic) {
        entitiesContext.dispatch({
          type: 'UPDATE_TOPIC',
          payload: {
            ...topic,
            noteCount: Math.max(0, topic.noteCount - 1),
          },
        });
      }
    });
  };

  // BATCH_ADD_NOTES with entity noteCount updates
  const batchAddNotes = (notes: Note[]) => {
    dispatch({ type: 'BATCH_ADD_NOTES', payload: notes });

    // Track updates for all affected entities
    const companyUpdates = new Map<string, { count: number; lastUpdated: string }>();
    const contactUpdates = new Map<string, { count: number; lastUpdated: string }>();
    const topicUpdates = new Map<string, { count: number; lastUpdated: string }>();

    notes.forEach(note => {
      const timestamp = note.timestamp;

      // Process company IDs
      (note.companyIds || []).forEach(companyId => {
        const existing = companyUpdates.get(companyId);
        if (!existing || timestamp > existing.lastUpdated) {
          companyUpdates.set(companyId, {
            count: (existing?.count || 0) + 1,
            lastUpdated: timestamp,
          });
        } else {
          companyUpdates.set(companyId, {
            ...existing,
            count: existing.count + 1,
          });
        }
      });

      // Process contact IDs
      (note.contactIds || []).forEach(contactId => {
        const existing = contactUpdates.get(contactId);
        if (!existing || timestamp > existing.lastUpdated) {
          contactUpdates.set(contactId, {
            count: (existing?.count || 0) + 1,
            lastUpdated: timestamp,
          });
        } else {
          contactUpdates.set(contactId, {
            ...existing,
            count: existing.count + 1,
          });
        }
      });

      // Process topic IDs (including legacy topicId)
      const allTopicIds = [...(note.topicIds || [])];
      if (note.topicId && !allTopicIds.includes(note.topicId)) {
        allTopicIds.push(note.topicId);
      }
      allTopicIds.forEach(topicId => {
        const existing = topicUpdates.get(topicId);
        if (!existing || timestamp > existing.lastUpdated) {
          topicUpdates.set(topicId, {
            count: (existing?.count || 0) + 1,
            lastUpdated: timestamp,
          });
        } else {
          topicUpdates.set(topicId, {
            ...existing,
            count: existing.count + 1,
          });
        }
      });
    });

    // Create lookup Maps for O(1) access
    const companiesMap = new Map(entitiesContext.state.companies.map(c => [c.id, c]));
    const contactsMap = new Map(entitiesContext.state.contacts.map(c => [c.id, c]));
    const topicsMap = new Map(entitiesContext.state.topics.map(t => [t.id, t]));

    // Apply updates to companies
    companyUpdates.forEach((update, companyId) => {
      const company = companiesMap.get(companyId);
      if (company) {
        entitiesContext.dispatch({
          type: 'UPDATE_COMPANY',
          payload: {
            ...company,
            noteCount: company.noteCount + update.count,
            lastUpdated: update.lastUpdated,
          },
        });
      }
    });

    // Apply updates to contacts
    contactUpdates.forEach((update, contactId) => {
      const contact = contactsMap.get(contactId);
      if (contact) {
        entitiesContext.dispatch({
          type: 'UPDATE_CONTACT',
          payload: {
            ...contact,
            noteCount: contact.noteCount + update.count,
            lastUpdated: update.lastUpdated,
          },
        });
      }
    });

    // Apply updates to topics
    topicUpdates.forEach((update, topicId) => {
      const topic = topicsMap.get(topicId);
      if (topic) {
        entitiesContext.dispatch({
          type: 'UPDATE_TOPIC',
          payload: {
            ...topic,
            noteCount: topic.noteCount + update.count,
            lastUpdated: update.lastUpdated,
          },
        });
      }
    });
  };

  // CREATE_MANUAL_NOTE with entity creation and noteCount updates
  const createManualNote = (noteData: ManualNoteData) => {
    // Create entity if needed
    let topicId = noteData.topicId;

    if (!topicId && noteData.newTopicName) {
      const newId = generateId();
      const timestamp = new Date().toISOString();
      const entityType = noteData.newTopicType || 'other';

      if (entityType === 'company') {
        const newCompany: Company = {
          id: newId,
          name: noteData.newTopicName,
          createdAt: timestamp,
          lastUpdated: timestamp,
          noteCount: 0,
          profile: {},
        };
        entitiesContext.dispatch({ type: 'ADD_COMPANY', payload: newCompany });
        topicId = newId;
      } else if (entityType === 'person') {
        const newContact: Contact = {
          id: newId,
          name: noteData.newTopicName,
          createdAt: timestamp,
          lastUpdated: timestamp,
          noteCount: 0,
          profile: {},
        };
        entitiesContext.dispatch({ type: 'ADD_CONTACT', payload: newContact });
        topicId = newId;
      } else {
        const newTopic: Topic = {
          id: newId,
          name: noteData.newTopicName,
          createdAt: timestamp,
          lastUpdated: timestamp,
          noteCount: 0,
        };
        entitiesContext.dispatch({ type: 'ADD_TOPIC', payload: newTopic });
        topicId = newId;
      }
    }

    if (!topicId) {
      // If still no topic, create a default one
      const defaultId = generateId();
      const timestamp = new Date().toISOString();
      const defaultTopic: Topic = {
        id: defaultId,
        name: 'Uncategorized',
        createdAt: timestamp,
        lastUpdated: timestamp,
        noteCount: 0,
      };
      entitiesContext.dispatch({ type: 'ADD_TOPIC', payload: defaultTopic });
      topicId = defaultId;
    }

    const newNote: Note = {
      id: generateId(),
      topicId: topicId!,
      content: noteData.content,
      summary: noteData.content.substring(0, 100) + (noteData.content.length > 100 ? '...' : ''),
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      source: noteData.source || 'thought',
      tags: noteData.tags || [],
    };

    // Add note using the method that updates entity noteCounts
    addNote(newNote);
  };

  // Query Engine Methods (Phase 3.3)
  const queryNotes = React.useCallback(async (filters: QueryFilter[], sort?: QuerySort, limit?: number) => {
    const storage = await getStorage();
    const queryEngine = new QueryEngine(storage);

    const result = await queryEngine.execute<Note>({
      collection: 'notes',
      filters,
      sort,
      limit,
    });

    console.log(`[Notes] Query returned ${result.entitiesReturned} notes in ${result.executionTime}ms`);

    return result.entities;
  }, []);

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

  return (
    <NotesContext.Provider value={{
      state,
      dispatch,
      addNote,
      updateNote,
      deleteNote,
      batchAddNotes,
      createManualNote,
      queryNotes,
      linkNoteToTopic,
      unlinkNoteFromTopic,
      linkNoteToCompany,
      unlinkNoteFromCompany,
      linkNoteToContact,
      unlinkNoteFromContact,
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
