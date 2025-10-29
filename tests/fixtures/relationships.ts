/**
 * Test Fixtures for Relationship Tests
 *
 * Provides reusable test data for relationship tests:
 * - Sample entities (tasks, notes, sessions, topics, companies, contacts)
 * - Sample relationships
 * - Factory functions for creating test data
 */

import { nanoid } from 'nanoid';
import type {
  Relationship,
  RelationshipType,
  EntityType,
  RelationshipMetadata,
} from '@/types/relationships';
import type { Task, Note, Session, Topic, Company, Contact } from '@/types';

// ===== SAMPLE ENTITIES =====

export const testTask: Task = {
  id: 'task-1',
  title: 'Test Task',
  description: 'A test task for relationship tests',
  status: 'todo',
  priority: 'medium',
  createdAt: new Date('2024-01-15T10:00:00Z').toISOString(),
  updatedAt: new Date('2024-01-15T10:00:00Z').toISOString(),
  relationships: [],
  relationshipVersion: 1,
};

export const testTask2: Task = {
  id: 'task-2',
  title: 'Another Test Task',
  description: 'Another test task',
  status: 'in-progress',
  priority: 'high',
  createdAt: new Date('2024-01-16T10:00:00Z').toISOString(),
  updatedAt: new Date('2024-01-16T10:00:00Z').toISOString(),
  relationships: [],
  relationshipVersion: 1,
};

export const testNote: Note = {
  id: 'note-1',
  summary: 'Test Note',
  content: 'This is a test note for relationship tests',
  createdAt: new Date('2024-01-15T09:00:00Z').toISOString(),
  updatedAt: new Date('2024-01-15T09:00:00Z').toISOString(),
  topicIds: [],
  companyIds: [],
  contactIds: [],
  relationships: [],
  relationshipVersion: 1,
  updates: [],
};

export const testNote2: Note = {
  id: 'note-2',
  summary: 'Another Test Note',
  content: 'Another test note',
  createdAt: new Date('2024-01-16T09:00:00Z').toISOString(),
  updatedAt: new Date('2024-01-16T09:00:00Z').toISOString(),
  topicIds: [],
  companyIds: [],
  contactIds: [],
  relationships: [],
  relationshipVersion: 1,
  updates: [],
};

export const testSession: Session = {
  id: 'session-1',
  name: 'Test Session',
  description: 'A test session',
  startTime: new Date('2024-01-15T08:00:00Z').toISOString(),
  endTime: new Date('2024-01-15T09:00:00Z').toISOString(),
  screenshots: [],
  audioSegments: [],
  relationships: [],
  relationshipVersion: 1,
};

export const testTopic: Topic = {
  id: 'topic-1',
  name: 'Test Topic',
  description: 'A test topic',
  color: '#3B82F6',
  createdAt: new Date('2024-01-15T07:00:00Z').toISOString(),
  relationships: [],
  relationshipVersion: 1,
};

export const testCompany: Company = {
  id: 'company-1',
  name: 'Test Company Inc.',
  domain: 'testcompany.com',
  description: 'A test company',
  createdAt: new Date('2024-01-15T07:00:00Z').toISOString(),
  relationships: [],
  relationshipVersion: 1,
};

export const testContact: Contact = {
  id: 'contact-1',
  name: 'John Doe',
  email: 'john@example.com',
  companyId: 'company-1',
  createdAt: new Date('2024-01-15T07:00:00Z').toISOString(),
  relationships: [],
  relationshipVersion: 1,
};

// ===== FACTORY FUNCTIONS =====

/**
 * Create a test relationship with optional overrides
 */
export function createTestRelationship(
  overrides?: Partial<Relationship>
): Relationship {
  const defaults: Relationship = {
    id: nanoid(),
    type: 'task-note' as RelationshipType,
    sourceType: 'task' as EntityType,
    sourceId: 'task-1',
    targetType: 'note' as EntityType,
    targetId: 'note-1',
    metadata: {
      source: 'manual',
      createdAt: new Date().toISOString(),
    },
    canonical: true,
  };

  return { ...defaults, ...overrides };
}

/**
 * Create test metadata with optional overrides
 */
export function createTestMetadata(
  overrides?: Partial<RelationshipMetadata>
): RelationshipMetadata {
  const defaults: RelationshipMetadata = {
    source: 'manual',
    createdAt: new Date().toISOString(),
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a bidirectional relationship pair (canonical + inverse)
 */
export function createBidirectionalRelationships(
  type: RelationshipType,
  sourceType: EntityType,
  sourceId: string,
  targetType: EntityType,
  targetId: string
): [Relationship, Relationship] {
  const canonical = createTestRelationship({
    type,
    sourceType,
    sourceId,
    targetType,
    targetId,
    canonical: true,
  });

  const inverse = createTestRelationship({
    type,
    sourceType: targetType,
    sourceId: targetId,
    targetType: sourceType,
    targetId: sourceId,
    canonical: false,
  });

  return [canonical, inverse];
}

/**
 * Create a test task with optional overrides
 */
export function createTestTask(overrides?: Partial<Task>): Task {
  return {
    ...testTask,
    id: nanoid(),
    ...overrides,
  };
}

/**
 * Create a test note with optional overrides
 */
export function createTestNote(overrides?: Partial<Note>): Note {
  return {
    ...testNote,
    id: nanoid(),
    ...overrides,
  };
}

/**
 * Create a test session with optional overrides
 */
export function createTestSession(overrides?: Partial<Session>): Session {
  return {
    ...testSession,
    id: nanoid(),
    ...overrides,
  };
}

/**
 * Create a test topic with optional overrides
 */
export function createTestTopic(overrides?: Partial<Topic>): Topic {
  return {
    ...testTopic,
    id: nanoid(),
    ...overrides,
  };
}

/**
 * Create a test company with optional overrides
 */
export function createTestCompany(overrides?: Partial<Company>): Company {
  return {
    ...testCompany,
    id: nanoid(),
    ...overrides,
  };
}

/**
 * Create a test contact with optional overrides
 */
export function createTestContact(overrides?: Partial<Contact>): Contact {
  return {
    ...testContact,
    id: nanoid(),
    ...overrides,
  };
}

// ===== BULK DATA GENERATORS =====

/**
 * Generate multiple test tasks
 */
export function generateTasks(count: number): Task[] {
  return Array.from({ length: count }, (_, i) =>
    createTestTask({
      id: `task-${i + 1}`,
      title: `Task ${i + 1}`,
    })
  );
}

/**
 * Generate multiple test notes
 */
export function generateNotes(count: number): Note[] {
  return Array.from({ length: count }, (_, i) =>
    createTestNote({
      id: `note-${i + 1}`,
      summary: `Note ${i + 1}`,
    })
  );
}

/**
 * Generate multiple test relationships
 */
export function generateRelationships(count: number): Relationship[] {
  return Array.from({ length: count }, (_, i) =>
    createTestRelationship({
      id: `rel-${i + 1}`,
      sourceId: `task-${(i % 10) + 1}`,
      targetId: `note-${(i % 10) + 1}`,
    })
  );
}
