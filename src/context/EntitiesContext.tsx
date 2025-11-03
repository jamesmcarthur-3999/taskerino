import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Company, Contact, Topic, ManualTopicData } from '../types';
import { getStorage } from '../services/storage';
import { generateId } from '../utils/helpers';
import { debug } from "../utils/debug";

// Entities State
interface EntitiesState {
  companies: Company[];
  contacts: Contact[];
  topics: Topic[];
}

type EntitiesAction =
  // Company actions
  | { type: 'ADD_COMPANY'; payload: Company }
  | { type: 'UPDATE_COMPANY'; payload: Company }
  | { type: 'DELETE_COMPANY'; payload: string }

  // Contact actions
  | { type: 'ADD_CONTACT'; payload: Contact }
  | { type: 'UPDATE_CONTACT'; payload: Contact }
  | { type: 'DELETE_CONTACT'; payload: string }

  // Topic actions
  | { type: 'ADD_TOPIC'; payload: Topic }
  | { type: 'UPDATE_TOPIC'; payload: Topic }
  | { type: 'DELETE_TOPIC'; payload: string }
  | { type: 'CREATE_MANUAL_TOPIC'; payload: ManualTopicData }

  // Data management
  | { type: 'LOAD_ENTITIES'; payload: Partial<EntitiesState> };

// Default state
const defaultState: EntitiesState = {
  companies: [],
  contacts: [],
  topics: [],
};

// Reducer (logic copied from AppContext)
function entitiesReducer(state: EntitiesState, action: EntitiesAction): EntitiesState {
  switch (action.type) {
    // Company actions
    case 'ADD_COMPANY':
      return { ...state, companies: [...state.companies, action.payload] };

    case 'UPDATE_COMPANY':
      return {
        ...state,
        companies: state.companies.map(company =>
          company.id === action.payload.id ? action.payload : company
        ),
      };

    case 'DELETE_COMPANY':
      return {
        ...state,
        companies: state.companies.filter(company => company.id !== action.payload),
      };

    // Contact actions
    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, action.payload] };

    case 'UPDATE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.map(contact =>
          contact.id === action.payload.id ? action.payload : contact
        ),
      };

    case 'DELETE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.filter(contact => contact.id !== action.payload),
      };

    // Topic actions
    case 'ADD_TOPIC':
      return { ...state, topics: [...state.topics, action.payload] };

    case 'UPDATE_TOPIC':
      return {
        ...state,
        topics: state.topics.map(topic =>
          topic.id === action.payload.id ? action.payload : topic
        ),
      };

    case 'DELETE_TOPIC':
      return {
        ...state,
        topics: state.topics.filter(topic => topic.id !== action.payload),
      };

    case 'CREATE_MANUAL_TOPIC': {
      const topicData = action.payload;
      const timestamp = new Date().toISOString();
      const id = generateId();

      // Create appropriate entity based on type
      if (topicData.type === 'company') {
        const newCompany: Company = {
          id,
          name: topicData.name,
          createdAt: timestamp,
          lastUpdated: timestamp,
          noteCount: 0,
          profile: {},
        };
        return { ...state, companies: [...state.companies, newCompany] };
      } else if (topicData.type === 'person') {
        const newContact: Contact = {
          id,
          name: topicData.name,
          createdAt: timestamp,
          lastUpdated: timestamp,
          noteCount: 0,
          profile: {},
        };
        return { ...state, contacts: [...state.contacts, newContact] };
      } else {
        const newTopic: Topic = {
          id,
          name: topicData.name,
          createdAt: timestamp,
          lastUpdated: timestamp,
          noteCount: 0,
        };
        return { ...state, topics: [...state.topics, newTopic] };
      }
    }

    // Data management
    case 'LOAD_ENTITIES':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// Context
const EntitiesContext = createContext<{
  state: EntitiesState;
  dispatch: React.Dispatch<EntitiesAction>;
} | null>(null);

// Provider
export function EntitiesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(entitiesReducer, defaultState);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load from storage on mount
  useEffect(() => {
    async function loadEntities() {
      try {
        const storage = await getStorage();
        const [companies, contacts, topics] = await Promise.all([
          storage.load<Company[]>('companies'),
          storage.load<Contact[]>('contacts'),
          storage.load<Topic[]>('topics'),
        ]);

        dispatch({
          type: 'LOAD_ENTITIES',
          payload: {
            companies: Array.isArray(companies) ? companies : [],
            contacts: Array.isArray(contacts) ? contacts : [],
            topics: Array.isArray(topics) ? topics : [],
          },
        });

        setHasLoaded(true);
      } catch (error) {
        console.error('Failed to load entities:', error);
        setHasLoaded(true);
      }
    }
    loadEntities();
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
        await Promise.all([
          storage.save('companies', state.companies),
          storage.save('contacts', state.contacts),
          storage.save('topics', state.topics),
        ]);
        debug.log("Entities saved to storage");
      } catch (error) {
        console.error('Failed to save entities:', error);
      }
    }, 5000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasLoaded, state.companies, state.contacts, state.topics]);

  return (
    <EntitiesContext.Provider value={{ state, dispatch }}>
      {children}
    </EntitiesContext.Provider>
  );
}

// Hook
export function useEntities() {
  const context = useContext(EntitiesContext);
  if (!context) {
    throw new Error('useEntities must be used within EntitiesProvider');
  }

  // Helper methods for adding entities
  const addCompany = (company: Company) => {
    context.dispatch({ type: 'ADD_COMPANY', payload: company });
  };

  const addContact = (contact: Contact) => {
    context.dispatch({ type: 'ADD_CONTACT', payload: contact });
  };

  const addTopic = (topic: Topic) => {
    context.dispatch({ type: 'ADD_TOPIC', payload: topic });
  };

  return {
    ...context,
    addCompany,
    addContact,
    addTopic,
  };
}
