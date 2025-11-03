/**
 * AIIntegrationService - Converts AI output to real entities
 *
 * This service bridges the gap between AI-generated data (with temp IDs and relationship specs)
 * and actual persisted entities in the database. It handles:
 *
 * 1. Entity matching/creation (topics, companies, contacts)
 * 2. Temp ID → Real ID mapping
 * 3. Relationship creation via RelationshipManager
 * 4. Entity persistence via EntityService
 *
 * @example
 * ```typescript
 * const aiResult = await claudeService.processInput(text, ...);
 * const processed = await aiIntegrationService.processAIResult(aiResult, {
 *   existingTopics,
 *   existingCompanies,
 *   existingContacts
 * });
 * // processed.notes and processed.tasks have real IDs and relationships
 * ```
 */

import { relationshipManager } from './relationshipManager';
import { generateId } from '../utils/helpers';
import { EntityType, RelationshipType } from '../types/relationships';
import type { Note, Task, Topic, Company, Contact, AIProcessResult } from '../types';

export interface ProcessedAIResult {
  notes: Note[];
  tasks: Task[];
  topics: Topic[];
  companies: Company[];
  contacts: Contact[];
  aiSummary: string;
}

export interface AIIntegrationContext {
  existingTopics: Topic[];
  existingCompanies: Company[];
  existingContacts: Contact[];
  existingNotes?: Note[];
  existingTasks?: Task[];
}

class AIIntegrationService {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await relationshipManager.init();
    this.initialized = true;
  }

  /**
   * Process AI result and create real entities with relationships
   *
   * This is the main entry point that converts AI output to database entities.
   * It handles the full lifecycle: entity creation → ID mapping → relationship creation.
   *
   * @param aiResult - Raw AI output from ClaudeService
   * @param context - Existing entities for matching
   * @returns Processed result with real entities
   */
  async processAIResult(
    aiResult: AIProcessResult,
    context: AIIntegrationContext
  ): Promise<ProcessedAIResult> {
    this.ensureInitialized();

    // Maps for temp ID → real ID resolution
    const topicMap = new Map<string, string>(); // topic name → real ID
    const companyMap = new Map<string, string>(); // company name → real ID
    const contactMap = new Map<string, string>(); // contact name → real ID
    const noteMap = new Map<string, string>(); // AI temp ID → real ID
    const taskMap = new Map<string, string>(); // AI temp ID → real ID

    const createdTopics: Topic[] = [];
    const createdCompanies: Company[] = [];
    const createdContacts: Contact[] = [];
    const createdNotes: Note[] = [];
    const createdTasks: Task[] = [];

    // ========================================
    // STEP 1: Create/match topics
    // ========================================
    for (const topicData of aiResult.newEntities?.topics || []) {
      const existing = this.findMatchingTopic(topicData.name, context.existingTopics);

      if (existing) {
        topicMap.set(topicData.name, existing.id);
      } else {
        const newTopic: Topic = {
          id: generateId(),
          name: topicData.name,
          type: topicData.type === 'company' ? 'company' :
                topicData.type === 'person' ? 'person' : 'other',
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          noteCount: 0,
        };
        createdTopics.push(newTopic);
        topicMap.set(topicData.name, newTopic.id);
      }
    }

    // ========================================
    // STEP 2: Create/match companies
    // ========================================
    for (const companyData of aiResult.newEntities?.companies || []) {
      const existing = this.findMatchingCompany(companyData.name, context.existingCompanies);

      if (existing) {
        companyMap.set(companyData.name, existing.id);
      } else {
        const newCompany: Company = {
          id: generateId(),
          name: companyData.name,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          noteCount: 0,
          profile: {},
        };
        createdCompanies.push(newCompany);
        companyMap.set(companyData.name, newCompany.id);
      }
    }

    // ========================================
    // STEP 3: Create/match contacts
    // ========================================
    for (const contactData of aiResult.newEntities?.contacts || []) {
      const existing = this.findMatchingContact(contactData.name, context.existingContacts);

      if (existing) {
        contactMap.set(contactData.name, existing.id);
      } else {
        const newContact: Contact = {
          id: generateId(),
          name: contactData.name,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          noteCount: 0,
          profile: {},
        };
        createdContacts.push(newContact);
        contactMap.set(contactData.name, newContact.id);
      }
    }

    // ========================================
    // STEP 4: Create notes (no relationships yet)
    // ========================================
    const now = new Date().toISOString();

    for (const noteData of aiResult.notes || []) {
      const realId = generateId();

      const note: Note = {
        id: realId,
        content: noteData.content,
        summary: noteData.summary,
        timestamp: now,
        lastUpdated: now,
        source: noteData.source || 'thought',
        tags: noteData.tags || [],
        sentiment: noteData.sentiment,
        keyPoints: noteData.keyPoints || [],
        relationships: [], // Will be populated in step 6
      };

      createdNotes.push(note);
      noteMap.set(noteData.id, realId); // Map AI temp ID to real ID
    }

    // ========================================
    // STEP 5: Create tasks (no relationships yet)
    // ========================================
    for (const taskData of aiResult.tasks || []) {
      const realId = generateId();

      const task: Task = {
        id: realId,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority || 'medium',
        status: 'todo',
        done: false,
        dueDate: taskData.dueDate,
        dueTime: taskData.dueTime,
        tags: taskData.tags || [],
        subtasks: taskData.suggestedSubtasks?.map(title => ({
          id: generateId(),
          title,
          done: false,
        })) || [],
        createdAt: now,
        createdBy: 'ai',
        relationships: [], // Will be populated in step 6
      };

      createdTasks.push(task);
      taskMap.set(taskData.id, realId); // Map AI temp ID to real ID
    }

    // ========================================
    // STEP 6: Create relationships (AI-specified)
    // ========================================
    for (const relSpec of aiResult.relationships || []) {
      try {
        // Resolve source entity
        const sourceId = this.resolveEntityId(
          relSpec.from,
          noteMap,
          taskMap,
          topicMap,
          companyMap,
          contactMap
        );

        if (!sourceId) {
          console.warn('[AIIntegrationService] Could not resolve source:', relSpec.from);
          continue;
        }

        // Resolve target entity
        const targetId = this.resolveEntityId(
          relSpec.to,
          noteMap,
          taskMap,
          topicMap,
          companyMap,
          contactMap
        );

        if (!targetId) {
          console.warn('[AIIntegrationService] Could not resolve target:', relSpec.to);
          continue;
        }

        // Create relationship
        await relationshipManager.addRelationship({
          sourceType: this.mapToEntityType(relSpec.from.type),
          sourceId,
          targetType: this.mapToEntityType(relSpec.to.type),
          targetId,
          type: relSpec.relationType as RelationshipType,
          metadata: {
            source: 'ai',
            confidence: relSpec.metadata?.confidence,
            reasoning: relSpec.metadata?.reasoning,
            createdAt: now,
          },
        });
      } catch (error) {
        console.error('[AIIntegrationService] Failed to create relationship:', relSpec, error);
        // Continue processing other relationships
      }
    }

    // ========================================
    // STEP 7: Load relationships back into entities
    // ========================================
    for (const note of createdNotes) {
      note.relationships = relationshipManager.getRelationships({ entityId: note.id });
    }

    for (const task of createdTasks) {
      task.relationships = relationshipManager.getRelationships({ entityId: task.id });
    }

    return {
      notes: createdNotes,
      tasks: createdTasks,
      topics: createdTopics,
      companies: createdCompanies,
      contacts: createdContacts,
      aiSummary: aiResult.aiSummary || '',
    };
  }

  /**
   * Resolve entity ID from relationship spec
   *
   * Handles both temp IDs (from AI) and existing entity IDs/names.
   */
  private resolveEntityId(
    entity: { type: string; id?: string; name?: string },
    noteMap: Map<string, string>,
    taskMap: Map<string, string>,
    topicMap: Map<string, string>,
    companyMap: Map<string, string>,
    contactMap: Map<string, string>
  ): string | null {
    // If AI gave us a temp ID, look it up
    if (entity.id) {
      if (entity.type === 'note') return noteMap.get(entity.id) || null;
      if (entity.type === 'task') return taskMap.get(entity.id) || null;
      // For other types, assume it's already a real ID
      return entity.id;
    }

    // If AI gave us a name, look it up
    if (entity.name) {
      if (entity.type === 'topic') return topicMap.get(entity.name) || null;
      if (entity.type === 'company') return companyMap.get(entity.name) || null;
      if (entity.type === 'contact') return contactMap.get(entity.name) || null;
    }

    return null;
  }

  /**
   * Map AI entity type string to EntityType enum
   */
  private mapToEntityType(type: string): EntityType {
    const mapping: Record<string, EntityType> = {
      'note': EntityType.NOTE,
      'task': EntityType.TASK,
      'topic': EntityType.TOPIC,
      'company': EntityType.COMPANY,
      'contact': EntityType.CONTACT,
      'session': EntityType.SESSION,
    };
    return mapping[type] || EntityType.NOTE;
  }

  /**
   * Find matching topic by name (fuzzy matching)
   */
  private findMatchingTopic(name: string, existing: Topic[]): Topic | null {
    const normalized = name.toLowerCase().trim();
    return existing.find(t => t.name.toLowerCase().trim() === normalized) || null;
  }

  /**
   * Find matching company by name (fuzzy matching)
   */
  private findMatchingCompany(name: string, existing: Company[]): Company | null {
    const normalized = name.toLowerCase().trim();
    return existing.find(c => c.name.toLowerCase().trim() === normalized) || null;
  }

  /**
   * Find matching contact by name (fuzzy matching)
   */
  private findMatchingContact(name: string, existing: Contact[]): Contact | null {
    const normalized = name.toLowerCase().trim();
    return existing.find(c => c.name.toLowerCase().trim() === normalized) || null;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AIIntegrationService not initialized. Call init() first.');
    }
  }
}

export const aiIntegrationService = new AIIntegrationService();
