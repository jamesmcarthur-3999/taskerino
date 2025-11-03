/**
 * Unified Relationship Type System
 *
 * This module defines the core type system for managing relationships between
 * entities in the Taskerino application. It provides a flexible, extensible
 * architecture that supports both current and future entity relationship types.
 *
 * @module types/relationships
 * @since 2.0.0
 */

/**
 * Relationship type enumeration
 *
 * Defines all possible relationship types between entities in the system.
 * Each relationship type represents a specific semantic connection between
 * two entity types (source and target).
 *
 * **Current Types** (Phase 1 - Implemented):
 * - Task-Note relationships (task created from note)
 * - Task-Session relationships (task extracted from session)
 * - Note-Session relationships (note created during session)
 * - Task-Topic, Note-Topic relationships (categorization)
 * - Note-Company, Note-Contact relationships (entity linking)
 * - Note-Parent relationships (note threading/hierarchy)
 *
 * **Future Types** (Phase 2+ - Planned):
 * - File attachments (task-file, note-file, session-file)
 * - Task dependencies (task-task)
 * - Project relationships (project-task, project-note)
 * - Goal relationships (goal-task)
 *
 * @since 2.0.0
 */
export const RelationshipType = {
  // Current types - Phase 1
  TASK_NOTE: 'task-note',
  TASK_SESSION: 'task-session',
  NOTE_SESSION: 'note-session',
  TASK_TOPIC: 'task-topic',
  NOTE_TOPIC: 'note-topic',
  NOTE_COMPANY: 'note-company',
  NOTE_CONTACT: 'note-contact',
  NOTE_PARENT: 'note-parent',
  TASK_COMPANY: 'task-company',
  TASK_CONTACT: 'task-contact',
  SESSION_COMPANY: 'session-company',
  SESSION_CONTACT: 'session-contact',
  SESSION_TOPIC: 'session-topic',

  // Future types - Phase 2+
  TASK_FILE: 'task-file',
  NOTE_FILE: 'note-file',
  SESSION_FILE: 'session-file',
  TASK_TASK: 'task-task',
  PROJECT_TASK: 'project-task',
  PROJECT_NOTE: 'project-note',
  GOAL_TASK: 'goal-task',
} as const;

export type RelationshipType = (typeof RelationshipType)[keyof typeof RelationshipType];

/**
 * Entity type enumeration
 *
 * Defines all entity types that can participate in relationships.
 * Each entity type represents a first-class object in the system
 * that can be the source or target of a relationship.
 *
 * @since 2.0.0
 */
export const EntityType = {
  TASK: 'task',
  NOTE: 'note',
  SESSION: 'session',
  TOPIC: 'topic',
  COMPANY: 'company',
  CONTACT: 'contact',
  // Future types
  FILE: 'file',
  PROJECT: 'project',
  GOAL: 'goal',
} as const;

export type EntityType = (typeof EntityType)[keyof typeof EntityType];

/**
 * Source of the relationship
 *
 * Indicates how and why a relationship was created, which is critical
 * for understanding relationship provenance and building user trust.
 *
 * @since 2.0.0
 */
export type RelationshipSource =
  /** Created by AI during automated processing */
  | 'ai'
  /** Created manually by the user */
  | 'manual'
  /** Created during data migration from legacy system */
  | 'migration'
  /** Created automatically by system logic */
  | 'system';

/**
 * Metadata attached to each relationship
 *
 * Provides rich context about how, when, and why a relationship was created.
 * This metadata is essential for:
 * - Building user trust (showing AI confidence and reasoning)
 * - Auditing and debugging relationship creation
 * - Learning from user feedback on AI-suggested relationships
 *
 * @since 2.0.0
 */
export interface RelationshipMetadata {
  /**
   * How the relationship was created
   *
   * @example 'ai' - Created by AI suggestion
   * @example 'manual' - User explicitly created this relationship
   */
  source: RelationshipSource;

  /**
   * AI confidence score (0-1)
   *
   * Only present when source='ai'. Indicates how confident the AI
   * is that this relationship is correct and meaningful.
   *
   * @example 0.95 - Very confident (obvious relationship)
   * @example 0.65 - Moderate confidence (needs user confirmation)
   */
  confidence?: number;

  /**
   * AI reasoning for creating the relationship
   *
   * Only present when source='ai'. Provides transparency into
   * why the AI suggested this relationship, helping users understand
   * and trust AI decisions.
   *
   * @example "Task mentions 'fix login bug' and note contains detailed analysis of login issues"
   */
  reasoning?: string;

  /**
   * When the relationship was created (ISO 8601 timestamp)
   *
   * @example "2024-01-15T10:30:00.000Z"
   */
  createdAt: string;

  /**
   * User ID if created manually
   *
   * Tracks which user created this relationship for multi-user scenarios.
   */
  createdBy?: string;

  /**
   * Additional type-specific metadata
   *
   * Allows different relationship types to store custom metadata
   * without modifying the core relationship interface.
   *
   * @example { "migrationVersion": "1.0.0" } for migration source
   * @example { "extractionTimestamp": "..." } for session relationships
   */
  extra?: Record<string, unknown>;
}

/**
 * Core relationship interface
 *
 * Represents a directed edge in the relationship graph. Each relationship
 * connects a source entity to a target entity with a specific relationship type.
 *
 * **Design Decisions**:
 * - **Directed**: Relationships have a clear source→target direction
 * - **Bidirectional Support**: Config can mark relationships as bidirectional
 * - **Canonical Flag**: For bidirectional relationships, marks the "primary" direction
 * - **Rich Metadata**: Extensive metadata for transparency and debugging
 *
 * @since 2.0.0
 */
export interface Relationship {
  /**
   * Unique identifier for this relationship
   *
   * Generated using UUID or similar unique ID generator.
   * @example "rel_abc123def456"
   */
  id: string;

  /**
   * Type of relationship
   *
   * Determines the semantic meaning of the source→target connection.
   */
  type: RelationshipType;

  /**
   * Source entity type
   *
   * The entity type that is the "origin" of this relationship.
   */
  sourceType: EntityType;

  /**
   * Source entity ID
   *
   * The specific entity instance that is the source.
   * @example "task_123"
   */
  sourceId: string;

  /**
   * Target entity type
   *
   * The entity type that is the "destination" of this relationship.
   */
  targetType: EntityType;

  /**
   * Target entity ID
   *
   * The specific entity instance that is the target.
   * @example "note_456"
   */
  targetId: string;

  /**
   * Relationship metadata
   *
   * Rich context about how and why this relationship was created.
   */
  metadata: RelationshipMetadata;

  /**
   * Is this the canonical direction?
   *
   * For bidirectional relationships, one direction is marked as canonical (true)
   * and the other is the inverse (false). This determines:
   * - Which relationship appears in queries for "primary" relationships
   * - Which metadata is considered authoritative
   *
   * @example
   * Task→Note relationship: canonical=true (task "created from" note)
   * Note→Task relationship: canonical=false (inverse, auto-generated)
   */
  canonical: boolean;
}

/**
 * Relationship configuration for each type
 *
 * Defines rules, constraints, and display properties for each relationship type.
 * This configuration drives:
 * - Validation (which entity types can participate)
 * - UI rendering (colors, icons, display names)
 * - Behavior (bidirectional, cascade delete)
 *
 * @since 2.0.0
 */
export interface RelationshipTypeConfig {
  /** Relationship type this config describes */
  type: RelationshipType;

  /**
   * Allowed source entity types
   *
   * Constrains which entity types can be the source of this relationship.
   * @example [EntityType.TASK] - Only tasks can be the source
   */
  sourceTypes: EntityType[];

  /**
   * Allowed target entity types
   *
   * Constrains which entity types can be the target of this relationship.
   * @example [EntityType.NOTE] - Only notes can be the target
   */
  targetTypes: EntityType[];

  /**
   * Is this relationship bidirectional?
   *
   * If true, creating A→B automatically creates B→A (with canonical=false).
   * @example true - Task→Note also creates Note→Task
   */
  bidirectional: boolean;

  /**
   * Should deleting the source cascade delete the target?
   *
   * If true, deleting the source entity will also delete all related target entities.
   * Use with caution - most relationships should NOT cascade delete.
   *
   * @example false - Deleting a task doesn't delete the note it came from
   */
  cascadeDelete: boolean;

  /**
   * Human-readable display name
   *
   * Used in UI to describe the relationship from source→target perspective.
   * @example "Created from" (for Task→Note)
   */
  displayName: string;

  /**
   * Icon name (Lucide icon)
   *
   * Used in UI to visually represent this relationship type.
   * @example "FileText" for note relationships
   */
  icon?: string;

  /**
   * Color (Tailwind CSS color value)
   *
   * Used in UI for visual distinction between relationship types.
   * Should use Tailwind color palette for consistency.
   * @example "#3B82F6" (blue-600)
   */
  color?: string;
}

/**
 * Registry of all relationship type configurations
 *
 * This is the single source of truth for all relationship type rules and display properties.
 * Every RelationshipType MUST have a corresponding entry in this registry.
 *
 * **Usage**:
 * ```typescript
 * const config = RELATIONSHIP_CONFIGS[RelationshipType.TASK_NOTE];
 * console.log(config.displayName); // "Created from"
 * console.log(config.bidirectional); // true
 * ```
 *
 * @since 2.0.0
 */
export const RELATIONSHIP_CONFIGS: Record<RelationshipType, RelationshipTypeConfig> = {
  [RelationshipType.TASK_NOTE]: {
    type: RelationshipType.TASK_NOTE,
    sourceTypes: [EntityType.TASK, EntityType.NOTE],
    targetTypes: [EntityType.NOTE, EntityType.TASK],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Created from',
    icon: 'FileText',
    color: '#3B82F6', // blue-600
  },

  [RelationshipType.TASK_SESSION]: {
    type: RelationshipType.TASK_SESSION,
    sourceTypes: [EntityType.TASK, EntityType.SESSION],
    targetTypes: [EntityType.SESSION, EntityType.TASK],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'From session',
    icon: 'Video',
    color: '#8B5CF6', // purple-600
  },

  [RelationshipType.NOTE_SESSION]: {
    type: RelationshipType.NOTE_SESSION,
    sourceTypes: [EntityType.NOTE, EntityType.SESSION],
    targetTypes: [EntityType.SESSION, EntityType.NOTE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'From session',
    icon: 'Video',
    color: '#8B5CF6', // purple-600
  },

  [RelationshipType.TASK_TOPIC]: {
    type: RelationshipType.TASK_TOPIC,
    sourceTypes: [EntityType.TASK, EntityType.TOPIC],
    targetTypes: [EntityType.TOPIC, EntityType.TASK],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Topic',
    icon: 'Tag',
    color: '#10B981', // green-600
  },

  [RelationshipType.NOTE_TOPIC]: {
    type: RelationshipType.NOTE_TOPIC,
    sourceTypes: [EntityType.NOTE, EntityType.TOPIC],
    targetTypes: [EntityType.TOPIC, EntityType.NOTE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Topic',
    icon: 'Tag',
    color: '#10B981', // green-600
  },

  [RelationshipType.NOTE_COMPANY]: {
    type: RelationshipType.NOTE_COMPANY,
    sourceTypes: [EntityType.NOTE, EntityType.COMPANY],
    targetTypes: [EntityType.COMPANY, EntityType.NOTE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Company',
    icon: 'Building',
    color: '#F59E0B', // amber-600
  },

  [RelationshipType.NOTE_CONTACT]: {
    type: RelationshipType.NOTE_CONTACT,
    sourceTypes: [EntityType.NOTE, EntityType.CONTACT],
    targetTypes: [EntityType.CONTACT, EntityType.NOTE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Contact',
    icon: 'User',
    color: '#EC4899', // pink-600
  },

  [RelationshipType.NOTE_PARENT]: {
    type: RelationshipType.NOTE_PARENT,
    sourceTypes: [EntityType.NOTE],
    targetTypes: [EntityType.NOTE],
    bidirectional: false,
    cascadeDelete: false,
    displayName: 'Parent note',
    icon: 'Link',
    color: '#6366F1', // indigo-600
  },

  [RelationshipType.TASK_COMPANY]: {
    type: RelationshipType.TASK_COMPANY,
    sourceTypes: [EntityType.TASK, EntityType.COMPANY],
    targetTypes: [EntityType.COMPANY, EntityType.TASK],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Company',
    icon: 'Building',
    color: '#F59E0B', // amber-600
  },

  [RelationshipType.TASK_CONTACT]: {
    type: RelationshipType.TASK_CONTACT,
    sourceTypes: [EntityType.TASK, EntityType.CONTACT],
    targetTypes: [EntityType.CONTACT, EntityType.TASK],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Contact',
    icon: 'User',
    color: '#EC4899', // pink-600
  },

  [RelationshipType.SESSION_COMPANY]: {
    type: RelationshipType.SESSION_COMPANY,
    sourceTypes: [EntityType.SESSION, EntityType.COMPANY],
    targetTypes: [EntityType.COMPANY, EntityType.SESSION],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Company',
    icon: 'Building',
    color: '#F59E0B', // amber-600
  },

  [RelationshipType.SESSION_CONTACT]: {
    type: RelationshipType.SESSION_CONTACT,
    sourceTypes: [EntityType.SESSION, EntityType.CONTACT],
    targetTypes: [EntityType.CONTACT, EntityType.SESSION],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Contact',
    icon: 'User',
    color: '#EC4899', // pink-600
  },

  [RelationshipType.SESSION_TOPIC]: {
    type: RelationshipType.SESSION_TOPIC,
    sourceTypes: [EntityType.SESSION, EntityType.TOPIC],
    targetTypes: [EntityType.TOPIC, EntityType.SESSION],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Topic',
    icon: 'Tag',
    color: '#10B981', // green-600
  },

  // Future types (not implemented yet, but defined for extensibility)

  [RelationshipType.TASK_FILE]: {
    type: RelationshipType.TASK_FILE,
    sourceTypes: [EntityType.TASK],
    targetTypes: [EntityType.FILE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'File',
    icon: 'File',
    color: '#64748B', // slate-600
  },

  [RelationshipType.NOTE_FILE]: {
    type: RelationshipType.NOTE_FILE,
    sourceTypes: [EntityType.NOTE],
    targetTypes: [EntityType.FILE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'File',
    icon: 'File',
    color: '#64748B', // slate-600
  },

  [RelationshipType.SESSION_FILE]: {
    type: RelationshipType.SESSION_FILE,
    sourceTypes: [EntityType.SESSION],
    targetTypes: [EntityType.FILE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'File',
    icon: 'File',
    color: '#64748B', // slate-600
  },

  [RelationshipType.TASK_TASK]: {
    type: RelationshipType.TASK_TASK,
    sourceTypes: [EntityType.TASK],
    targetTypes: [EntityType.TASK],
    bidirectional: false,
    cascadeDelete: false,
    displayName: 'Depends on',
    icon: 'Link',
    color: '#EF4444', // red-600
  },

  [RelationshipType.PROJECT_TASK]: {
    type: RelationshipType.PROJECT_TASK,
    sourceTypes: [EntityType.PROJECT],
    targetTypes: [EntityType.TASK],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Project',
    icon: 'Folder',
    color: '#14B8A6', // teal-600
  },

  [RelationshipType.PROJECT_NOTE]: {
    type: RelationshipType.PROJECT_NOTE,
    sourceTypes: [EntityType.PROJECT],
    targetTypes: [EntityType.NOTE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Project',
    icon: 'Folder',
    color: '#14B8A6', // teal-600
  },

  [RelationshipType.GOAL_TASK]: {
    type: RelationshipType.GOAL_TASK,
    sourceTypes: [EntityType.GOAL],
    targetTypes: [EntityType.TASK],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Goal',
    icon: 'Target',
    color: '#F97316', // orange-600
  },
};

/**
 * Type guard to check if a relationship type is bidirectional
 *
 * @param type - Relationship type to check
 * @returns True if the relationship type is configured as bidirectional
 *
 * @example
 * ```typescript
 * if (isBidirectional(RelationshipType.TASK_NOTE)) {
 *   // Create inverse relationship
 * }
 * ```
 *
 * @since 2.0.0
 */
export function isBidirectional(type: RelationshipType): boolean {
  return RELATIONSHIP_CONFIGS[type].bidirectional;
}

/**
 * Type guard to check if a relationship type supports cascade delete
 *
 * @param type - Relationship type to check
 * @returns True if deleting the source should cascade delete the target
 *
 * @since 2.0.0
 */
export function supportsCascadeDelete(type: RelationshipType): boolean {
  return RELATIONSHIP_CONFIGS[type].cascadeDelete;
}

/**
 * Get display configuration for a relationship type
 *
 * @param type - Relationship type
 * @returns Display configuration (name, icon, color)
 *
 * @example
 * ```typescript
 * const display = getDisplayConfig(RelationshipType.TASK_NOTE);
 * console.log(display.displayName); // "Created from"
 * console.log(display.icon); // "FileText"
 * console.log(display.color); // "#3B82F6"
 * ```
 *
 * @since 2.0.0
 */
export function getDisplayConfig(type: RelationshipType): {
  displayName: string;
  icon?: string;
  color?: string;
} {
  const config = RELATIONSHIP_CONFIGS[type];
  return {
    displayName: config.displayName,
    icon: config.icon,
    color: config.color,
  };
}

/**
 * Validate that a relationship's source and target types are allowed
 *
 * @param type - Relationship type
 * @param sourceType - Source entity type
 * @param targetType - Target entity type
 * @returns True if the combination is valid according to the config
 *
 * @example
 * ```typescript
 * const valid = validateRelationshipTypes(
 *   RelationshipType.TASK_NOTE,
 *   EntityType.TASK,
 *   EntityType.NOTE
 * );
 * console.log(valid); // true
 * ```
 *
 * @since 2.0.0
 */
export function validateRelationshipTypes(
  type: RelationshipType,
  sourceType: EntityType,
  targetType: EntityType
): boolean {
  const config = RELATIONSHIP_CONFIGS[type];
  return (
    config.sourceTypes.includes(sourceType) &&
    config.targetTypes.includes(targetType)
  );
}
