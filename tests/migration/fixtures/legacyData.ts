/**
 * Test Fixtures for Migration Testing
 *
 * Provides comprehensive test data covering all migration scenarios:
 * - Valid relationships (should migrate successfully)
 * - Orphaned references (should be detected and reported)
 * - Already migrated entities (should be skipped)
 * - Edge cases (circular refs, self-refs, empty arrays)
 *
 * @module tests/migration/fixtures/legacyData
 */

import type { Task, Note, Session, Company, Contact, Topic } from '@/types';

/**
 * Test Topics
 */
export const legacyTopics: Topic[] = [
  {
    id: 'topic-1',
    name: 'Project Alpha',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    noteCount: 2,
  },
  {
    id: 'topic-2',
    name: 'Research',
    createdAt: '2024-01-02T00:00:00.000Z',
    lastUpdated: '2024-01-02T00:00:00.000Z',
    noteCount: 1,
  },
];

/**
 * Test Companies
 */
export const legacyCompanies: Company[] = [
  {
    id: 'company-1',
    name: 'Acme Corp',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    noteCount: 1,
  },
];

/**
 * Test Contacts
 */
export const legacyContacts: Contact[] = [
  {
    id: 'contact-1',
    name: 'John Doe',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    noteCount: 1,
  },
];

/**
 * Test Tasks
 *
 * Covers:
 * - task-1: Valid noteId and sourceSessionId (should create 2 relationships)
 * - task-2: Orphaned noteId (note doesn't exist - should be reported)
 * - task-3: Orphaned sourceSessionId (session doesn't exist - should be reported)
 * - task-4: Already migrated (relationshipVersion=1 - should be skipped)
 * - task-5: Both noteId and sourceNoteId (both valid - should create 2 relationships)
 * - task-6: Duplicate noteId and sourceNoteId (same note - should create 1 relationship)
 * - task-7: No legacy fields (clean task - should be migrated but no relationships)
 */
export const legacyTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Task with valid references',
    done: false,
    priority: 'high',
    status: 'todo',
    createdAt: '2024-01-15T10:00:00.000Z',
    createdBy: 'ai',
    noteId: 'note-1', // Valid reference
    sourceSessionId: 'session-1', // Valid reference
  },
  {
    id: 'task-2',
    title: 'Task with orphaned noteId',
    done: false,
    priority: 'medium',
    status: 'todo',
    createdAt: '2024-01-16T10:00:00.000Z',
    createdBy: 'ai',
    noteId: 'note-nonexistent', // Orphaned reference
  },
  {
    id: 'task-3',
    title: 'Task with orphaned sourceSessionId',
    done: false,
    priority: 'low',
    status: 'todo',
    createdAt: '2024-01-17T10:00:00.000Z',
    createdBy: 'manual',
    sourceSessionId: 'session-nonexistent', // Orphaned reference
  },
  {
    id: 'task-4',
    title: 'Already migrated task',
    done: false,
    priority: 'medium',
    status: 'in-progress',
    createdAt: '2024-01-18T10:00:00.000Z',
    createdBy: 'ai',
    relationshipVersion: 1, // Already migrated
    relationships: [
      {
        id: 'rel-existing-1',
        type: 'task-note',
        sourceType: 'task',
        sourceId: 'task-4',
        targetType: 'note',
        targetId: 'note-2',
        metadata: {
          source: 'migration',
          createdAt: '2024-01-18T10:00:00.000Z',
        },
        canonical: true,
      },
    ],
  },
  {
    id: 'task-5',
    title: 'Task with both noteId and sourceNoteId',
    done: false,
    priority: 'high',
    status: 'todo',
    createdAt: '2024-01-19T10:00:00.000Z',
    createdBy: 'ai',
    noteId: 'note-1',
    sourceNoteId: 'note-2', // Different from noteId
  },
  {
    id: 'task-6',
    title: 'Task with duplicate noteId and sourceNoteId',
    done: false,
    priority: 'medium',
    status: 'todo',
    createdAt: '2024-01-20T10:00:00.000Z',
    createdBy: 'ai',
    noteId: 'note-1',
    sourceNoteId: 'note-1', // Same as noteId - should dedupe
  },
  {
    id: 'task-7',
    title: 'Clean task with no legacy fields',
    done: false,
    priority: 'low',
    status: 'todo',
    createdAt: '2024-01-21T10:00:00.000Z',
    createdBy: 'manual',
    // No legacy relationship fields
  },
];

/**
 * Test Notes
 *
 * Covers:
 * - note-1: Multiple topics, company, contact, session (should create 5 relationships)
 * - note-2: Single topicId (legacy field - should create 1 relationship)
 * - note-3: Orphaned sourceSessionId (should be reported)
 * - note-4: Parent note relationship (should create 1 relationship)
 * - note-5: Already migrated (should be skipped)
 * - note-6: Empty arrays (no relationships to create)
 * - note-7: Self-referential parent (circular - should still create relationship)
 */
export const legacyNotes: Note[] = [
  {
    id: 'note-1',
    content: 'Note with multiple relationships',
    summary: 'Test note 1',
    timestamp: '2024-01-10T10:00:00.000Z',
    lastUpdated: '2024-01-10T10:00:00.000Z',
    source: 'thought',
    tags: ['test'],
    topicIds: ['topic-1', 'topic-2'], // 2 relationships
    companyIds: ['company-1'], // 1 relationship
    contactIds: ['contact-1'], // 1 relationship
    sourceSessionId: 'session-1', // 1 relationship
  },
  {
    id: 'note-2',
    content: 'Note with legacy topicId field',
    summary: 'Test note 2',
    timestamp: '2024-01-11T10:00:00.000Z',
    lastUpdated: '2024-01-11T10:00:00.000Z',
    source: 'call',
    tags: [],
    topicId: 'topic-1', // Legacy field - should migrate
  },
  {
    id: 'note-3',
    content: 'Note with orphaned session',
    summary: 'Test note 3',
    timestamp: '2024-01-12T10:00:00.000Z',
    lastUpdated: '2024-01-12T10:00:00.000Z',
    source: 'email',
    tags: [],
    sourceSessionId: 'session-nonexistent', // Orphaned
  },
  {
    id: 'note-4',
    content: 'Note with parent',
    summary: 'Test note 4',
    timestamp: '2024-01-13T10:00:00.000Z',
    lastUpdated: '2024-01-13T10:00:00.000Z',
    source: 'thought',
    tags: [],
    parentNoteId: 'note-1', // Parent relationship
  },
  {
    id: 'note-5',
    content: 'Already migrated note',
    summary: 'Test note 5',
    timestamp: '2024-01-14T10:00:00.000Z',
    lastUpdated: '2024-01-14T10:00:00.000Z',
    source: 'thought',
    tags: [],
    relationshipVersion: 1, // Already migrated
    relationships: [
      {
        id: 'rel-existing-2',
        type: 'note-topic',
        sourceType: 'note',
        sourceId: 'note-5',
        targetType: 'topic',
        targetId: 'topic-2',
        metadata: {
          source: 'migration',
          createdAt: '2024-01-14T10:00:00.000Z',
        },
        canonical: true,
      },
    ],
  },
  {
    id: 'note-6',
    content: 'Note with empty arrays',
    summary: 'Test note 6',
    timestamp: '2024-01-15T10:00:00.000Z',
    lastUpdated: '2024-01-15T10:00:00.000Z',
    source: 'thought',
    tags: [],
    topicIds: [], // Empty - no relationships
    companyIds: [], // Empty - no relationships
    contactIds: [], // Empty - no relationships
  },
  {
    id: 'note-7',
    content: 'Self-referential note',
    summary: 'Test note 7',
    timestamp: '2024-01-16T10:00:00.000Z',
    lastUpdated: '2024-01-16T10:00:00.000Z',
    source: 'thought',
    tags: [],
    parentNoteId: 'note-7', // Self-referential - circular reference
  },
];

/**
 * Test Sessions
 *
 * Covers:
 * - session-1: Valid extracted task and note IDs (should create 2 relationships)
 * - session-2: Orphaned task IDs (should be reported)
 * - session-3: Mixed valid and orphaned (should create relationships for valid only)
 * - session-4: Already migrated (should be skipped)
 * - session-5: Empty arrays (no relationships to create)
 */
export const legacySessions: Session[] = [
  {
    id: 'session-1',
    name: 'Session with valid references',
    description: 'Test session 1',
    status: 'completed',
    startTime: '2024-01-01T09:00:00.000Z',
    endTime: '2024-01-01T10:00:00.000Z',
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'off',
    audioRecording: false,
    audioReviewCompleted: false,
    screenshots: [],
    extractedTaskIds: ['task-1'], // Valid
    extractedNoteIds: ['note-1'], // Valid
    tags: [],
  },
  {
    id: 'session-2',
    name: 'Session with orphaned references',
    description: 'Test session 2',
    status: 'completed',
    startTime: '2024-01-02T09:00:00.000Z',
    endTime: '2024-01-02T10:00:00.000Z',
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'off',
    audioRecording: false,
    audioReviewCompleted: false,
    screenshots: [],
    extractedTaskIds: ['task-nonexistent'], // Orphaned
    extractedNoteIds: ['note-nonexistent'], // Orphaned
    tags: [],
  },
  {
    id: 'session-3',
    name: 'Session with mixed references',
    description: 'Test session 3',
    status: 'completed',
    startTime: '2024-01-03T09:00:00.000Z',
    endTime: '2024-01-03T10:00:00.000Z',
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'off',
    audioRecording: false,
    audioReviewCompleted: false,
    screenshots: [],
    extractedTaskIds: ['task-1', 'task-nonexistent'], // 1 valid, 1 orphaned
    extractedNoteIds: ['note-1', 'note-nonexistent'], // 1 valid, 1 orphaned
    tags: [],
  },
  {
    id: 'session-4',
    name: 'Already migrated session',
    description: 'Test session 4',
    status: 'completed',
    startTime: '2024-01-04T09:00:00.000Z',
    endTime: '2024-01-04T10:00:00.000Z',
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'off',
    audioRecording: false,
    audioReviewCompleted: false,
    screenshots: [],
    extractedTaskIds: [],
    extractedNoteIds: [],
    tags: [],
    relationshipVersion: 1, // Already migrated
    relationships: [
      {
        id: 'rel-existing-3',
        type: 'task-session',
        sourceType: 'task',
        sourceId: 'task-5',
        targetType: 'session',
        targetId: 'session-4',
        metadata: {
          source: 'migration',
          createdAt: '2024-01-04T09:00:00.000Z',
        },
        canonical: true,
      },
    ],
  },
  {
    id: 'session-5',
    name: 'Session with empty arrays',
    description: 'Test session 5',
    status: 'completed',
    startTime: '2024-01-05T09:00:00.000Z',
    endTime: '2024-01-05T10:00:00.000Z',
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'off',
    audioRecording: false,
    audioReviewCompleted: false,
    screenshots: [],
    extractedTaskIds: [], // Empty - no relationships
    extractedNoteIds: [], // Empty - no relationships
    tags: [],
  },
];

/**
 * Expected migration results
 *
 * Used in tests to verify migration correctness
 */
export const expectedMigrationResults = {
  // Total relationships that should be created
  totalRelationships: {
    taskNote: 4, // task-1→note-1, task-5→note-1, task-5→note-2, task-6→note-1
    taskSession: 3, // task-1→session-1 (from task), task-1→session-1 (from session-1), task-1→session-3 (from session-3)
    noteSession: 3, // note-1→session-1 (from note), note-1→session-1 (from session-1), note-1→session-3 (from session-3)
    noteTopic: 3, // note-1→topic-1, note-1→topic-2, note-2→topic-1
    noteCompany: 1, // note-1→company-1
    noteContact: 1, // note-1→contact-1
    noteParent: 2, // note-4→note-1, note-7→note-7 (self-ref)
  },

  // Entities that should be migrated
  entitiesMigrated: {
    tasks: 4, // task-1, task-2, task-3, task-5, task-6, task-7 (task-4 already migrated)
    notes: 6, // note-1 through note-7 except note-5 (already migrated)
    sessions: 4, // session-1 through session-5 except session-4 (already migrated)
  },

  // Orphaned references that should be detected
  orphanedReferences: {
    tasks: {
      'task-2': ['note-nonexistent'],
      'task-3': ['session-nonexistent'],
    },
    notes: {
      'note-3': ['session-nonexistent'],
    },
    sessions: {
      'session-2': ['task-nonexistent', 'note-nonexistent'],
      'session-3': ['task-nonexistent', 'note-nonexistent'],
    },
  },

  // Total orphaned references
  totalOrphanedReferences: 7, // 2 from task-2/task-3, 1 from note-3, 4 from session-2/session-3
};
