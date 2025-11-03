import { describe, it, expect } from 'vitest';
import {
  Relationship,
  RelationshipType,
  EntityType,
  RELATIONSHIP_CONFIGS,
  isBidirectional,
  supportsCascadeDelete,
  getDisplayConfig,
  validateRelationshipTypes,
  type RelationshipMetadata,
  type RelationshipTypeConfig,
} from '../relationships';
import type { Task, Note, Session } from '../../types';

describe('Relationship Types', () => {
  describe('RelationshipType enum', () => {
    it('should have all 15 relationship types defined', () => {
      const types = Object.values(RelationshipType);
      expect(types).toHaveLength(15);

      // Current types (Phase 1)
      expect(types).toContain(RelationshipType.TASK_NOTE);
      expect(types).toContain(RelationshipType.TASK_SESSION);
      expect(types).toContain(RelationshipType.NOTE_SESSION);
      expect(types).toContain(RelationshipType.TASK_TOPIC);
      expect(types).toContain(RelationshipType.NOTE_TOPIC);
      expect(types).toContain(RelationshipType.NOTE_COMPANY);
      expect(types).toContain(RelationshipType.NOTE_CONTACT);
      expect(types).toContain(RelationshipType.NOTE_PARENT);

      // Future types
      expect(types).toContain(RelationshipType.TASK_FILE);
      expect(types).toContain(RelationshipType.NOTE_FILE);
      expect(types).toContain(RelationshipType.SESSION_FILE);
      expect(types).toContain(RelationshipType.TASK_TASK);
      expect(types).toContain(RelationshipType.PROJECT_TASK);
      expect(types).toContain(RelationshipType.PROJECT_NOTE);
      expect(types).toContain(RelationshipType.GOAL_TASK);
    });

    it('should have consistent string values', () => {
      expect(RelationshipType.TASK_NOTE).toBe('task-note');
      expect(RelationshipType.TASK_SESSION).toBe('task-session');
      expect(RelationshipType.NOTE_SESSION).toBe('note-session');
      expect(RelationshipType.NOTE_PARENT).toBe('note-parent');
    });
  });

  describe('EntityType enum', () => {
    it('should have all 9 entity types defined', () => {
      const types = Object.values(EntityType);
      expect(types).toHaveLength(9);

      // Current types
      expect(types).toContain(EntityType.TASK);
      expect(types).toContain(EntityType.NOTE);
      expect(types).toContain(EntityType.SESSION);
      expect(types).toContain(EntityType.TOPIC);
      expect(types).toContain(EntityType.COMPANY);
      expect(types).toContain(EntityType.CONTACT);

      // Future types
      expect(types).toContain(EntityType.FILE);
      expect(types).toContain(EntityType.PROJECT);
      expect(types).toContain(EntityType.GOAL);
    });

    it('should have consistent string values', () => {
      expect(EntityType.TASK).toBe('task');
      expect(EntityType.NOTE).toBe('note');
      expect(EntityType.SESSION).toBe('session');
    });
  });

  describe('Relationship interface', () => {
    it('should create a valid AI-created relationship with all fields', () => {
      const metadata: RelationshipMetadata = {
        source: 'ai',
        confidence: 0.95,
        reasoning: 'Task mentions fixing bug discussed in note',
        createdAt: new Date().toISOString(),
      };

      const relationship: Relationship = {
        id: 'rel_123',
        type: RelationshipType.TASK_NOTE,
        sourceType: EntityType.TASK,
        sourceId: 'task_456',
        targetType: EntityType.NOTE,
        targetId: 'note_789',
        metadata,
        canonical: true,
      };

      expect(relationship.type).toBe(RelationshipType.TASK_NOTE);
      expect(relationship.sourceType).toBe(EntityType.TASK);
      expect(relationship.targetType).toBe(EntityType.NOTE);
      expect(relationship.metadata.source).toBe('ai');
      expect(relationship.metadata.confidence).toBe(0.95);
      expect(relationship.canonical).toBe(true);
    });

    it('should create a valid manual relationship without AI fields', () => {
      const metadata: RelationshipMetadata = {
        source: 'manual',
        createdAt: new Date().toISOString(),
        createdBy: 'user_123',
      };

      const relationship: Relationship = {
        id: 'rel_456',
        type: RelationshipType.NOTE_COMPANY,
        sourceType: EntityType.NOTE,
        sourceId: 'note_789',
        targetType: EntityType.COMPANY,
        targetId: 'company_101',
        metadata,
        canonical: true,
      };

      expect(relationship.metadata.source).toBe('manual');
      expect(relationship.metadata.confidence).toBeUndefined();
      expect(relationship.metadata.reasoning).toBeUndefined();
      expect(relationship.metadata.createdBy).toBe('user_123');
    });

    it('should create a migration relationship with extra metadata', () => {
      const metadata: RelationshipMetadata = {
        source: 'migration',
        createdAt: new Date().toISOString(),
        extra: {
          migrationVersion: '1.0.0',
          legacyFieldName: 'noteId',
        },
      };

      const relationship: Relationship = {
        id: 'rel_789',
        type: RelationshipType.TASK_NOTE,
        sourceType: EntityType.TASK,
        sourceId: 'task_111',
        targetType: EntityType.NOTE,
        targetId: 'note_222',
        metadata,
        canonical: true,
      };

      expect(relationship.metadata.source).toBe('migration');
      expect(relationship.metadata.extra).toBeDefined();
      expect(relationship.metadata.extra?.migrationVersion).toBe('1.0.0');
    });

    it('should support non-canonical (inverse) relationships', () => {
      const metadata: RelationshipMetadata = {
        source: 'system',
        createdAt: new Date().toISOString(),
      };

      const relationship: Relationship = {
        id: 'rel_inverse',
        type: RelationshipType.TASK_NOTE,
        sourceType: EntityType.NOTE,
        sourceId: 'note_333',
        targetType: EntityType.TASK,
        targetId: 'task_444',
        metadata,
        canonical: false, // Inverse relationship
      };

      expect(relationship.canonical).toBe(false);
    });
  });

  describe('RELATIONSHIP_CONFIGS', () => {
    it('should have configs for all relationship types', () => {
      const relationshipTypes = Object.values(RelationshipType);
      const configKeys = Object.keys(RELATIONSHIP_CONFIGS);

      expect(configKeys.length).toBe(relationshipTypes.length);

      relationshipTypes.forEach((type) => {
        expect(RELATIONSHIP_CONFIGS[type]).toBeDefined();
      });
    });

    it('should have valid config structure for each type', () => {
      Object.values(RELATIONSHIP_CONFIGS).forEach((config: RelationshipTypeConfig) => {
        expect(config.type).toBeDefined();
        expect(config.sourceTypes).toBeInstanceOf(Array);
        expect(config.targetTypes).toBeInstanceOf(Array);
        expect(config.sourceTypes.length).toBeGreaterThan(0);
        expect(config.targetTypes.length).toBeGreaterThan(0);
        expect(typeof config.bidirectional).toBe('boolean');
        expect(typeof config.cascadeDelete).toBe('boolean');
        expect(config.displayName).toBeDefined();
        expect(config.displayName.length).toBeGreaterThan(0);
      });
    });

    it('should use Tailwind color values for colors', () => {
      const configs = Object.values(RELATIONSHIP_CONFIGS);
      const tailwindColorRegex = /^#[0-9A-F]{6}$/i;

      configs.forEach((config: RelationshipTypeConfig) => {
        if (config.color) {
          expect(config.color).toMatch(tailwindColorRegex);
        }
      });
    });

    it('should have correct config for TASK_NOTE relationship', () => {
      const config = RELATIONSHIP_CONFIGS[RelationshipType.TASK_NOTE];

      expect(config.type).toBe(RelationshipType.TASK_NOTE);
      expect(config.sourceTypes).toContain(EntityType.TASK);
      expect(config.targetTypes).toContain(EntityType.NOTE);
      expect(config.bidirectional).toBe(true);
      expect(config.cascadeDelete).toBe(false);
      expect(config.displayName).toBe('Created from');
      expect(config.icon).toBe('FileText');
      expect(config.color).toBe('#3B82F6'); // blue-600
    });

    it('should have correct config for NOTE_PARENT relationship', () => {
      const config = RELATIONSHIP_CONFIGS[RelationshipType.NOTE_PARENT];

      expect(config.type).toBe(RelationshipType.NOTE_PARENT);
      expect(config.sourceTypes).toContain(EntityType.NOTE);
      expect(config.targetTypes).toContain(EntityType.NOTE);
      expect(config.bidirectional).toBe(false); // Parent-child is directional
      expect(config.cascadeDelete).toBe(false);
      expect(config.displayName).toBe('Parent note');
    });

    it('should mark all current relationships as non-cascade-delete', () => {
      const configs = Object.values(RELATIONSHIP_CONFIGS);

      // Safety check: No relationships should cascade delete in Phase 1
      configs.forEach((config: RelationshipTypeConfig) => {
        expect(config.cascadeDelete).toBe(false);
      });
    });

    it('should have different colors for different relationship types', () => {
      const config1 = RELATIONSHIP_CONFIGS[RelationshipType.TASK_NOTE];
      const config2 = RELATIONSHIP_CONFIGS[RelationshipType.TASK_SESSION];
      const config3 = RELATIONSHIP_CONFIGS[RelationshipType.NOTE_COMPANY];

      // Verify different types have different colors
      expect(config1.color).not.toBe(config2.color);
      expect(config2.color).not.toBe(config3.color);
      expect(config1.color).not.toBe(config3.color);
    });
  });

  describe('isBidirectional helper', () => {
    it('should return true for bidirectional relationships', () => {
      expect(isBidirectional(RelationshipType.TASK_NOTE)).toBe(true);
      expect(isBidirectional(RelationshipType.TASK_SESSION)).toBe(true);
      expect(isBidirectional(RelationshipType.NOTE_SESSION)).toBe(true);
      expect(isBidirectional(RelationshipType.NOTE_COMPANY)).toBe(true);
    });

    it('should return false for unidirectional relationships', () => {
      expect(isBidirectional(RelationshipType.NOTE_PARENT)).toBe(false);
      expect(isBidirectional(RelationshipType.TASK_TASK)).toBe(false);
    });
  });

  describe('supportsCascadeDelete helper', () => {
    it('should return false for all current relationships', () => {
      // Phase 1: No cascade deletes
      expect(supportsCascadeDelete(RelationshipType.TASK_NOTE)).toBe(false);
      expect(supportsCascadeDelete(RelationshipType.NOTE_PARENT)).toBe(false);
      expect(supportsCascadeDelete(RelationshipType.NOTE_COMPANY)).toBe(false);
    });
  });

  describe('getDisplayConfig helper', () => {
    it('should return display config for a relationship type', () => {
      const display = getDisplayConfig(RelationshipType.TASK_NOTE);

      expect(display.displayName).toBe('Created from');
      expect(display.icon).toBe('FileText');
      expect(display.color).toBe('#3B82F6');
    });

    it('should handle relationships without icon or color', () => {
      // All current relationships should have icon and color
      const display = getDisplayConfig(RelationshipType.NOTE_PARENT);

      expect(display.displayName).toBeDefined();
      expect(display.displayName.length).toBeGreaterThan(0);
    });
  });

  describe('validateRelationshipTypes helper', () => {
    it('should validate correct relationship type combinations', () => {
      expect(
        validateRelationshipTypes(
          RelationshipType.TASK_NOTE,
          EntityType.TASK,
          EntityType.NOTE
        )
      ).toBe(true);

      expect(
        validateRelationshipTypes(
          RelationshipType.NOTE_COMPANY,
          EntityType.NOTE,
          EntityType.COMPANY
        )
      ).toBe(true);

      expect(
        validateRelationshipTypes(
          RelationshipType.NOTE_PARENT,
          EntityType.NOTE,
          EntityType.NOTE
        )
      ).toBe(true);
    });

    it('should reject invalid relationship type combinations', () => {
      // Task cannot be source of NOTE_COMPANY
      expect(
        validateRelationshipTypes(
          RelationshipType.NOTE_COMPANY,
          EntityType.TASK,
          EntityType.COMPANY
        )
      ).toBe(false);

      // Session cannot be target of TASK_NOTE
      expect(
        validateRelationshipTypes(
          RelationshipType.TASK_NOTE,
          EntityType.TASK,
          EntityType.SESSION
        )
      ).toBe(false);

      // Company cannot be source of TASK_NOTE
      expect(
        validateRelationshipTypes(
          RelationshipType.TASK_NOTE,
          EntityType.COMPANY,
          EntityType.NOTE
        )
      ).toBe(false);
    });

    it('should handle multi-type source constraints', () => {
      // Future: PROJECT_TASK might allow multiple source types
      // Currently all relationships have single source type
      const config = RELATIONSHIP_CONFIGS[RelationshipType.TASK_NOTE];
      expect(config.sourceTypes.length).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should allow Task with legacy fields only', () => {
      const legacyTask: Task = {
        id: 'task_1',
        title: 'Legacy Task',
        done: false,
        priority: 'medium',
        createdAt: new Date().toISOString(),
        status: 'todo',
        createdBy: 'manual',
        noteId: 'note_1', // Legacy field
        sourceNoteId: 'note_1', // Legacy field
        sourceSessionId: 'session_1', // Legacy field
      };

      expect(legacyTask.noteId).toBe('note_1');
      expect(legacyTask.relationships).toBeUndefined();
      expect(legacyTask.relationshipVersion).toBeUndefined();
    });

    it('should allow Task with both legacy and new relationship fields', () => {
      const transitionTask: Task = {
        id: 'task_2',
        title: 'Transition Task',
        done: false,
        priority: 'high',
        createdAt: new Date().toISOString(),
        status: 'in-progress',
        createdBy: 'ai',
        // Legacy fields (deprecated but still present)
        noteId: 'note_2',
        sourceSessionId: 'session_2',
        // New unified relationship system
        relationships: [
          {
            id: 'rel_1',
            type: RelationshipType.TASK_NOTE,
            sourceType: EntityType.TASK,
            sourceId: 'task_2',
            targetType: EntityType.NOTE,
            targetId: 'note_2',
            metadata: {
              source: 'migration',
              createdAt: new Date().toISOString(),
            },
            canonical: true,
          },
        ],
        relationshipVersion: 1,
      };

      expect(transitionTask.noteId).toBe('note_2');
      expect(transitionTask.relationships).toHaveLength(1);
      expect(transitionTask.relationshipVersion).toBe(1);
    });

    it('should allow Task with only new relationship fields', () => {
      const modernTask: Task = {
        id: 'task_3',
        title: 'Modern Task',
        done: false,
        priority: 'urgent',
        createdAt: new Date().toISOString(),
        status: 'todo',
        createdBy: 'ai',
        relationships: [
          {
            id: 'rel_2',
            type: RelationshipType.TASK_SESSION,
            sourceType: EntityType.TASK,
            sourceId: 'task_3',
            targetType: EntityType.SESSION,
            targetId: 'session_3',
            metadata: {
              source: 'ai',
              confidence: 0.92,
              reasoning: 'Task extracted from session summary',
              createdAt: new Date().toISOString(),
            },
            canonical: true,
          },
        ],
        relationshipVersion: 1,
      };

      expect(modernTask.relationships).toHaveLength(1);
      expect(modernTask.noteId).toBeUndefined();
      expect(modernTask.sourceSessionId).toBeUndefined();
    });

    it('should allow Note with legacy fields only', () => {
      const legacyNote: Note = {
        id: 'note_1',
        content: 'Legacy note content',
        summary: 'Legacy summary',
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        source: 'thought',
        tags: ['legacy'],
        topicId: 'topic_1', // Legacy field
        sourceSessionId: 'session_1', // Legacy field
      };

      expect(legacyNote.topicId).toBe('topic_1');
      expect(legacyNote.relationships).toBeUndefined();
      expect(legacyNote.relationshipVersion).toBeUndefined();
    });

    it('should allow Note with new relationship system', () => {
      const modernNote: Note = {
        id: 'note_2',
        content: 'Modern note content',
        summary: 'Modern summary',
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        source: 'call',
        tags: ['modern'],
        relationships: [
          {
            id: 'rel_3',
            type: RelationshipType.NOTE_COMPANY,
            sourceType: EntityType.NOTE,
            sourceId: 'note_2',
            targetType: EntityType.COMPANY,
            targetId: 'company_1',
            metadata: {
              source: 'ai',
              confidence: 0.88,
              createdAt: new Date().toISOString(),
            },
            canonical: true,
          },
        ],
        relationshipVersion: 1,
      };

      expect(modernNote.relationships).toHaveLength(1);
      expect(modernNote.topicId).toBeUndefined();
    });

    it('should allow Session with legacy fields only', () => {
      const legacySession: Session = {
        id: 'session_1',
        name: 'Legacy Session',
        description: 'Test session',
        status: 'completed',
        startTime: new Date().toISOString(),
        screenshotInterval: 2,
        autoAnalysis: true,
        enableScreenshots: true,
        audioMode: 'off',
        audioRecording: false,
        audioReviewCompleted: false,
        screenshots: [],
        extractedTaskIds: ['task_1', 'task_2'], // Legacy field
        extractedNoteIds: ['note_1'], // Legacy field
        tags: [],
      };

      expect(legacySession.extractedTaskIds).toHaveLength(2);
      expect(legacySession.relationships).toBeUndefined();
      expect(legacySession.relationshipVersion).toBeUndefined();
    });

    it('should allow Session with new relationship system', () => {
      const modernSession: Session = {
        id: 'session_2',
        name: 'Modern Session',
        description: 'Test session',
        status: 'completed',
        startTime: new Date().toISOString(),
        screenshotInterval: 2,
        autoAnalysis: true,
        enableScreenshots: true,
        audioMode: 'off',
        audioRecording: false,
        audioReviewCompleted: false,
        screenshots: [],
        extractedTaskIds: [], // Empty legacy field
        extractedNoteIds: [], // Empty legacy field
        tags: [],
        relationships: [
          {
            id: 'rel_4',
            type: RelationshipType.NOTE_SESSION,
            sourceType: EntityType.NOTE,
            sourceId: 'note_3',
            targetType: EntityType.SESSION,
            targetId: 'session_2',
            metadata: {
              source: 'system',
              createdAt: new Date().toISOString(),
            },
            canonical: false, // Inverse relationship
          },
        ],
        relationshipVersion: 1,
      };

      expect(modernSession.relationships).toHaveLength(1);
      expect(modernSession.extractedTaskIds).toHaveLength(0);
      expect(modernSession.relationshipVersion).toBe(1);
    });
  });

  describe('Type Safety', () => {
    it('should enforce RelationshipSource type', () => {
      const validSources: Array<RelationshipMetadata['source']> = [
        'ai',
        'manual',
        'migration',
        'system',
      ];

      validSources.forEach((source) => {
        const metadata: RelationshipMetadata = {
          source,
          createdAt: new Date().toISOString(),
        };
        expect(metadata.source).toBe(source);
      });
    });

    it('should allow optional fields in RelationshipMetadata', () => {
      const minimalMetadata: RelationshipMetadata = {
        source: 'manual',
        createdAt: new Date().toISOString(),
      };

      expect(minimalMetadata.confidence).toBeUndefined();
      expect(minimalMetadata.reasoning).toBeUndefined();
      expect(minimalMetadata.createdBy).toBeUndefined();
      expect(minimalMetadata.extra).toBeUndefined();
    });

    it('should allow extra metadata of any structure', () => {
      const metadata: RelationshipMetadata = {
        source: 'migration',
        createdAt: new Date().toISOString(),
        extra: {
          migrationVersion: '1.0.0',
          legacyFieldName: 'noteId',
          customData: {
            nested: {
              value: 123,
            },
          },
        },
      };

      expect(metadata.extra?.migrationVersion).toBe('1.0.0');
      expect(metadata.extra?.customData).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle relationships with same source and target type', () => {
      const selfReferentialConfig = RELATIONSHIP_CONFIGS[RelationshipType.NOTE_PARENT];

      expect(selfReferentialConfig.sourceTypes).toContain(EntityType.NOTE);
      expect(selfReferentialConfig.targetTypes).toContain(EntityType.NOTE);
    });

    it('should handle empty extra metadata', () => {
      const metadata: RelationshipMetadata = {
        source: 'system',
        createdAt: new Date().toISOString(),
        extra: {},
      };

      expect(metadata.extra).toEqual({});
    });

    it('should handle relationship with confidence of 0', () => {
      const metadata: RelationshipMetadata = {
        source: 'ai',
        confidence: 0,
        createdAt: new Date().toISOString(),
      };

      expect(metadata.confidence).toBe(0);
    });

    it('should handle relationship with confidence of 1', () => {
      const metadata: RelationshipMetadata = {
        source: 'ai',
        confidence: 1,
        createdAt: new Date().toISOString(),
      };

      expect(metadata.confidence).toBe(1);
    });

    it('should handle very long reasoning strings', () => {
      const longReasoning = 'A'.repeat(1000);
      const metadata: RelationshipMetadata = {
        source: 'ai',
        reasoning: longReasoning,
        createdAt: new Date().toISOString(),
      };

      expect(metadata.reasoning?.length).toBe(1000);
    });
  });
});
