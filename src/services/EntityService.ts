/**
 * EntityService - Unified CRUD API for all entities
 *
 * Single source of truth for creating, updating, and deleting Notes, Tasks, and Sessions.
 * Handles:
 * - Automatic relationship creation via RelationshipManager
 * - Entity count updates (topic.noteCount, etc.)
 * - Cascade delete cleanup (relationships, attachments, indexes)
 * - Zero UI blocking via PersistenceQueue
 *
 * @example
 * ```typescript
 * // Create note with relationships
 * const note = await entityService.createNote({
 *   content: "<h2>Meeting Notes</h2>",
 *   summary: "Discussion with Sarah",
 *   relationships: [
 *     { toType: EntityType.TOPIC, toId: "topic-123", type: RelationshipType.NOTE_TOPIC }
 *   ]
 * });
 *
 * // Delete note with automatic cleanup
 * await entityService.deleteNote(noteId);
 * // Cleans up: relationships, attachments, entity counts, indexes
 * ```
 */

import { relationshipManager } from './relationshipManager';
import { getStorage } from './storage';
import { getChunkedStorage } from './storage/ChunkedSessionStorage';
import { getCAStorage } from './storage/ContentAddressableStorage';
import { getInvertedIndexManager } from './storage/InvertedIndexManager';
import { getPersistenceQueue } from './storage/PersistenceQueue';
import { generateId } from '../utils/helpers';
import { EntityType, RelationshipType, type Relationship } from '../types/relationships';
import type { Note, Task, Session, Topic, Company, Contact } from '../types';

// ============================================================================
// Input Types (Clean - no legacy fields)
// ============================================================================

export interface RelationshipInput {
  toType: EntityType;
  toId: string;
  type: RelationshipType;
  metadata?: {
    source?: 'ai' | 'manual' | 'system';
    confidence?: number;
    reasoning?: string;
  };
}

export interface CreateNoteInput {
  content: string;
  summary: string;
  source?: 'call' | 'email' | 'thought' | 'other';
  tags?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  keyPoints?: string[];
  relationships?: RelationshipInput[];
  attachments?: any[]; // Keep existing attachment handling
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'todo' | 'in-progress' | 'done' | 'blocked';
  dueDate?: string;
  dueTime?: string;
  tags?: string[];
  subtasks?: Array<{ title: string }>;
  relationships?: RelationshipInput[];
}

export interface CreateSessionInput {
  name: string;
  description?: string;
  screenshotInterval?: number;
  autoAnalysis?: boolean;
  enableScreenshots?: boolean;
  audioMode?: 'none' | 'mic' | 'system' | 'both';
  audioRecording?: boolean;
  videoRecording?: boolean;
  relationships?: RelationshipInput[];
}

// ============================================================================
// EntityService Class
// ============================================================================

class EntityService {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await relationshipManager.init();
    this.initialized = true;
  }

  // ========================================
  // CREATE - Notes
  // ========================================

  async createNote(input: CreateNoteInput): Promise<Note> {
    this.ensureInitialized();

    const id = generateId();
    const now = new Date().toISOString();

    const note: Note = {
      id,
      content: input.content,
      summary: input.summary,
      timestamp: now,
      lastUpdated: now,
      source: input.source || 'thought',
      tags: input.tags || [],
      metadata: {
        sentiment: input.sentiment,
        keyPoints: input.keyPoints || [],
      },
      attachments: input.attachments || [],
      relationships: [],
    };

    // Create relationships
    if (input.relationships && input.relationships.length > 0) {
      for (const relInput of input.relationships) {
        await relationshipManager.addRelationship({
          sourceType: EntityType.NOTE,
          sourceId: id,
          targetType: relInput.toType,
          targetId: relInput.toId,
          type: relInput.type,
          metadata: {
            source: relInput.metadata?.source || 'manual',
            confidence: relInput.metadata?.confidence,
            reasoning: relInput.metadata?.reasoning,
            createdAt: now,
          },
        });
      }

      // Load relationships back
      note.relationships = relationshipManager.getRelationships({ entityId: id });
    }

    // Update entity counts
    await this.updateEntityCounts(note.relationships, 1);

    // Persist (queued, non-blocking)
    const storage = await getStorage();
    const allNotes = (await storage.load<Note[]>('notes')) || [];
    allNotes.push(note);

    const queue = getPersistenceQueue();
    queue.enqueue(
      async () => {
        await storage.save('notes', allNotes);
      },
      'normal'
    );

    return note;
  }

  // ========================================
  // CREATE - Tasks
  // ========================================

  async createTask(input: CreateTaskInput): Promise<Task> {
    this.ensureInitialized();

    const id = generateId();
    const now = new Date().toISOString();

    const task: Task = {
      id,
      title: input.title,
      description: input.description,
      priority: input.priority || 'medium',
      status: input.status || 'todo',
      done: input.status === 'done',
      dueDate: input.dueDate,
      dueTime: input.dueTime,
      tags: input.tags || [],
      subtasks:
        input.subtasks?.map((st) => ({
          id: generateId(),
          title: st.title,
          done: false,
        })) || [],
      createdAt: now,
      createdBy: 'manual',
      completedAt: input.status === 'done' ? now : undefined,
      relationships: [],
    };

    // Create relationships
    if (input.relationships && input.relationships.length > 0) {
      for (const relInput of input.relationships) {
        await relationshipManager.addRelationship({
          sourceType: EntityType.TASK,
          sourceId: id,
          targetType: relInput.toType,
          targetId: relInput.toId,
          type: relInput.type,
          metadata: {
            source: relInput.metadata?.source || 'manual',
            confidence: relInput.metadata?.confidence,
            reasoning: relInput.metadata?.reasoning,
            createdAt: now,
          },
        });
      }

      task.relationships = relationshipManager.getRelationships({ entityId: id });
    }

    // Persist
    const storage = await getStorage();
    const allTasks = (await storage.load<Task[]>('tasks')) || [];
    allTasks.push(task);

    const queue = getPersistenceQueue();
    queue.enqueue(
      async () => {
        await storage.save('tasks', allTasks);
      },
      'normal'
    );

    return task;
  }

  // ========================================
  // CREATE - Sessions
  // ========================================

  async createSession(input: CreateSessionInput): Promise<Session> {
    this.ensureInitialized();

    const id = generateId();
    const now = new Date().toISOString();

    const session: Session = {
      id,
      name: input.name,
      description: input.description,
      status: 'active',
      startTime: now,
      screenshotInterval: input.screenshotInterval || 120000,
      autoAnalysis: input.autoAnalysis !== false,
      enableScreenshots: input.enableScreenshots !== false,
      audioMode: input.audioMode || 'none',
      audioRecording: input.audioRecording || false,
      videoRecording: input.videoRecording || false,
      screenshots: [],
      audioSegments: [],
      relationships: [],
      enrichmentConfig: {
        autoEnrichOnComplete: true,
        includeAudioReview: true,
        includeVideoChapters: true,
        maxCostThreshold: 10.0,
      },
    };

    // Create relationships
    if (input.relationships && input.relationships.length > 0) {
      for (const relInput of input.relationships) {
        await relationshipManager.addRelationship({
          sourceType: EntityType.SESSION,
          sourceId: id,
          targetType: relInput.toType,
          targetId: relInput.toId,
          type: relInput.type,
          metadata: {
            source: relInput.metadata?.source || 'manual',
            confidence: relInput.metadata?.confidence,
            reasoning: relInput.metadata?.reasoning,
            createdAt: now,
          },
        });
      }

      session.relationships = relationshipManager.getRelationships({ entityId: id });
    }

    // Persist via ChunkedStorage
    const chunkedStorage = await getChunkedStorage();
    await chunkedStorage.saveFullSession(session);

    return session;
  }

  // ========================================
  // UPDATE Operations
  // ========================================

  async updateNote(id: string, updates: Partial<Note>): Promise<Note> {
    this.ensureInitialized();

    const storage = await getStorage();
    const allNotes = (await storage.load<Note[]>('notes')) || [];
    const index = allNotes.findIndex((n) => n.id === id);

    if (index === -1) {
      throw new Error(`Note ${id} not found`);
    }

    const updatedNote = {
      ...allNotes[index],
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    allNotes[index] = updatedNote;

    const queue = getPersistenceQueue();
    queue.enqueue(
      async () => {
        await storage.save('notes', allNotes);
      },
      'normal'
    );

    return updatedNote;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    this.ensureInitialized();

    const storage = await getStorage();
    const allTasks = (await storage.load<Task[]>('tasks')) || [];
    const index = allTasks.findIndex((t) => t.id === id);

    if (index === -1) {
      throw new Error(`Task ${id} not found`);
    }

    const updatedTask = {
      ...allTasks[index],
      ...updates,
    };

    allTasks[index] = updatedTask;

    const queue = getPersistenceQueue();
    queue.enqueue(
      async () => {
        await storage.save('tasks', allTasks);
      },
      'normal'
    );

    return updatedTask;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session> {
    this.ensureInitialized();

    const chunkedStorage = await getChunkedStorage();
    const session = await chunkedStorage.loadFullSession(id);

    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    const updatedSession = {
      ...session,
      ...updates,
    };

    await chunkedStorage.saveMetadata(id, updatedSession);

    return updatedSession;
  }

  // ========================================
  // DELETE Operations (with cascade cleanup)
  // ========================================

  async deleteNote(id: string): Promise<void> {
    this.ensureInitialized();

    const storage = await getStorage();
    const allNotes = (await storage.load<Note[]>('notes')) || [];
    const note = allNotes.find((n) => n.id === id);

    if (!note) return;

    // 1. Delete relationships
    const relationships = relationshipManager.getRelationships({ entityId: id });
    for (const rel of relationships) {
      await relationshipManager.removeRelationship({ relationshipId: rel.id });
    }

    // 2. Update entity counts
    await this.updateEntityCounts(relationships, -1);

    // 3. Delete attachments (if any)
    if (note.attachments && note.attachments.length > 0) {
      const casStorage = await getCAStorage();
      for (const attachment of note.attachments) {
        if (attachment.hash) {
          await casStorage.removeReference(attachment.hash, id, attachment.id);
        }
      }
    }

    // 4. Delete from storage
    const updated = allNotes.filter((n) => n.id !== id);
    const queue = getPersistenceQueue();
    queue.enqueue(
      async () => {
        await storage.save('notes', updated);
      },
      'normal'
    );

    // 5. Update indexes
    const indexManager = await getInvertedIndexManager();
    await indexManager.removeEntity('notes', id);
  }

  async deleteTask(id: string): Promise<void> {
    this.ensureInitialized();

    const storage = await getStorage();
    const allTasks = (await storage.load<Task[]>('tasks')) || [];
    const task = allTasks.find((t) => t.id === id);

    if (!task) return;

    // 1. Delete relationships
    const relationships = relationshipManager.getRelationships({ entityId: id });
    for (const rel of relationships) {
      await relationshipManager.removeRelationship({ relationshipId: rel.id });
    }

    // 2. Delete attachments (if any)
    if (task.attachments && task.attachments.length > 0) {
      const casStorage = await getCAStorage();
      for (const attachment of task.attachments) {
        if (attachment.hash) {
          await casStorage.removeReference(attachment.hash, id, attachment.id);
        }
      }
    }

    // 3. Delete from storage
    const updated = allTasks.filter((t) => t.id !== id);
    const queue = getPersistenceQueue();
    queue.enqueue(
      async () => {
        await storage.save('tasks', updated);
      },
      'normal'
    );

    // 4. Update indexes
    const indexManager = await getInvertedIndexManager();
    await indexManager.removeEntity('tasks', id);
  }

  async deleteSession(id: string): Promise<void> {
    this.ensureInitialized();

    const chunkedStorage = await getChunkedStorage();
    const session = await chunkedStorage.loadFullSession(id);

    if (!session) return;

    // 1. Delete relationships
    const relationships = relationshipManager.getRelationships({ entityId: id });
    for (const rel of relationships) {
      await relationshipManager.removeRelationship({ relationshipId: rel.id });
    }

    // 2. Delete screenshots (CAS references)
    if (session.screenshots && session.screenshots.length > 0) {
      const casStorage = await getCAStorage();
      for (const screenshot of session.screenshots) {
        if (screenshot.hash) {
          await casStorage.removeReference(screenshot.hash, id, screenshot.id);
        }
      }
    }

    // 3. Delete audio segments (CAS references)
    if (session.audioSegments && session.audioSegments.length > 0) {
      const casStorage = await getCAStorage();
      for (const segment of session.audioSegments) {
        if (segment.hash) {
          await casStorage.removeReference(segment.hash, id, segment.id);
        }
      }
    }

    // 4. Delete full audio (if exists)
    if (session.fullAudioAttachmentId) {
      const casStorage = await getCAStorage();
      const fullAudio = session.audioSegments?.find(
        (seg) => seg.id === session.fullAudioAttachmentId
      );
      if (fullAudio?.hash) {
        await casStorage.removeReference(fullAudio.hash, id, session.fullAudioAttachmentId);
      }
    }

    // 5. Delete session from chunked storage
    await chunkedStorage.deleteSession(id);

    // 6. Update indexes
    const indexManager = await getInvertedIndexManager();
    await indexManager.removeEntity('sessions', id);
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Update entity counts (topics, companies, contacts)
   * @param relationships - Relationships to process
   * @param delta - +1 for add, -1 for delete
   */
  private async updateEntityCounts(relationships: Relationship[], delta: number): Promise<void> {
    const storage = await getStorage();

    // Update topics
    const topicRels = relationships.filter(
      (r) => r.targetType === EntityType.TOPIC || r.sourceType === EntityType.TOPIC
    );

    if (topicRels.length > 0) {
      const topics = (await storage.load<Topic[]>('topics')) || [];
      let updated = false;

      for (const rel of topicRels) {
        const topicId = rel.targetType === EntityType.TOPIC ? rel.targetId : rel.sourceId;
        const topic = topics.find((t) => t.id === topicId);

        if (topic) {
          topic.noteCount = Math.max(0, topic.noteCount + delta);
          topic.lastUpdated = new Date().toISOString();
          updated = true;
        }
      }

      if (updated) {
        await storage.save('topics', topics);
      }
    }

    // Update companies
    const companyRels = relationships.filter(
      (r) => r.targetType === EntityType.COMPANY || r.sourceType === EntityType.COMPANY
    );

    if (companyRels.length > 0) {
      const companies = (await storage.load<Company[]>('companies')) || [];
      let updated = false;

      for (const rel of companyRels) {
        const companyId = rel.targetType === EntityType.COMPANY ? rel.targetId : rel.sourceId;
        const company = companies.find((c) => c.id === companyId);

        if (company) {
          company.noteCount = Math.max(0, company.noteCount + delta);
          company.lastUpdated = new Date().toISOString();
          updated = true;
        }
      }

      if (updated) {
        await storage.save('companies', companies);
      }
    }

    // Update contacts
    const contactRels = relationships.filter(
      (r) => r.targetType === EntityType.CONTACT || r.sourceType === EntityType.CONTACT
    );

    if (contactRels.length > 0) {
      const contacts = (await storage.load<Contact[]>('contacts')) || [];
      let updated = false;

      for (const rel of contactRels) {
        const contactId = rel.targetType === EntityType.CONTACT ? rel.targetId : rel.sourceId;
        const contact = contacts.find((c) => c.id === contactId);

        if (contact) {
          contact.noteCount = Math.max(0, contact.noteCount + delta);
          contact.lastUpdated = new Date().toISOString();
          updated = true;
        }
      }

      if (updated) {
        await storage.save('contacts', contacts);
      }
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('EntityService not initialized. Call init() first.');
    }
  }
}

// Export both the class (for instantiation) and singleton instance
export { EntityService };
export const entityService = new EntityService();
