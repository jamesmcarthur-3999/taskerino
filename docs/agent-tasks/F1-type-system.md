# AGENT TASK F1: Type System

**Objective:** Design and implement the core type system for the unified relationship architecture.

**Priority:** P0 (Foundation - must complete first)

**Dependencies:** None

**Complexity:** Medium

**Estimated Time:** 3-4 hours

---

## Detailed Requirements

### 1. Create `src/types/relationships.ts`

This file will contain the complete type system for the unified relationship architecture.

**Required Types:**

```typescript
/**
 * Relationship type enumeration
 * Supports current and future entity relationship types
 */
export enum RelationshipType {
  // Current types
  TASK_NOTE = 'task-note',
  TASK_SESSION = 'task-session',
  NOTE_SESSION = 'note-session',
  TASK_TOPIC = 'task-topic',
  NOTE_TOPIC = 'note-topic',
  NOTE_COMPANY = 'note-company',
  NOTE_CONTACT = 'note-contact',
  NOTE_PARENT = 'note-parent', // For note threading

  // Future types (for extensibility)
  TASK_FILE = 'task-file',
  NOTE_FILE = 'note-file',
  SESSION_FILE = 'session-file',
  TASK_TASK = 'task-task', // Task dependencies
  PROJECT_TASK = 'project-task',
  PROJECT_NOTE = 'project-note',
  GOAL_TASK = 'goal-task',
}

/**
 * Source of the relationship (who/what created it)
 */
export type RelationshipSource = 'ai' | 'manual' | 'migration' | 'system';

/**
 * Metadata attached to each relationship
 */
export interface RelationshipMetadata {
  /** How relationship was created */
  source: RelationshipSource;

  /** AI confidence score (0-1), only for source='ai' */
  confidence?: number;

  /** AI reasoning for creating relationship */
  reasoning?: string;

  /** When relationship was created */
  createdAt: string; // ISO timestamp

  /** User ID if created manually */
  createdBy?: string;

  /** Additional type-specific metadata */
  extra?: Record<string, any>;
}

/**
 * Entity type enumeration
 */
export enum EntityType {
  TASK = 'task',
  NOTE = 'note',
  SESSION = 'session',
  TOPIC = 'topic',
  COMPANY = 'company',
  CONTACT = 'contact',
  // Future types
  FILE = 'file',
  PROJECT = 'project',
  GOAL = 'goal',
}

/**
 * Core relationship interface
 * Represents a directed edge in the relationship graph
 */
export interface Relationship {
  /** Unique identifier for this relationship */
  id: string;

  /** Type of relationship */
  type: RelationshipType;

  /** Source entity */
  sourceType: EntityType;
  sourceId: string;

  /** Target entity */
  targetType: EntityType;
  targetId: string;

  /** Metadata */
  metadata: RelationshipMetadata;

  /** Is this the canonical direction? */
  canonical: boolean;
}

/**
 * Relationship configuration for each type
 * Defines rules and behavior for relationship types
 */
export interface RelationshipTypeConfig {
  type: RelationshipType;
  sourceTypes: EntityType[];
  targetTypes: EntityType[];
  bidirectional: boolean;
  cascadeDelete: boolean;
  displayName: string;
  icon?: string;
  color?: string;
}

/**
 * Registry of all relationship type configurations
 */
export const RELATIONSHIP_CONFIGS: Record<RelationshipType, RelationshipTypeConfig> = {
  [RelationshipType.TASK_NOTE]: {
    type: RelationshipType.TASK_NOTE,
    sourceTypes: [EntityType.TASK],
    targetTypes: [EntityType.NOTE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Created from',
    icon: 'FileText',
    color: '#3B82F6', // blue
  },
  [RelationshipType.TASK_SESSION]: {
    type: RelationshipType.TASK_SESSION,
    sourceTypes: [EntityType.TASK],
    targetTypes: [EntityType.SESSION],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'From session',
    icon: 'Video',
    color: '#8B5CF6', // purple
  },
  [RelationshipType.NOTE_SESSION]: {
    type: RelationshipType.NOTE_SESSION,
    sourceTypes: [EntityType.NOTE],
    targetTypes: [EntityType.SESSION],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'From session',
    icon: 'Video',
    color: '#8B5CF6', // purple
  },
  [RelationshipType.TASK_TOPIC]: {
    type: RelationshipType.TASK_TOPIC,
    sourceTypes: [EntityType.TASK],
    targetTypes: [EntityType.TOPIC],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Topic',
    icon: 'Tag',
    color: '#10B981', // green
  },
  [RelationshipType.NOTE_TOPIC]: {
    type: RelationshipType.NOTE_TOPIC,
    sourceTypes: [EntityType.NOTE],
    targetTypes: [EntityType.TOPIC],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Topic',
    icon: 'Tag',
    color: '#10B981', // green
  },
  [RelationshipType.NOTE_COMPANY]: {
    type: RelationshipType.NOTE_COMPANY,
    sourceTypes: [EntityType.NOTE],
    targetTypes: [EntityType.COMPANY],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Company',
    icon: 'Building',
    color: '#F59E0B', // amber
  },
  [RelationshipType.NOTE_CONTACT]: {
    type: RelationshipType.NOTE_CONTACT,
    sourceTypes: [EntityType.NOTE],
    targetTypes: [EntityType.CONTACT],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Contact',
    icon: 'User',
    color: '#EC4899', // pink
  },
  [RelationshipType.NOTE_PARENT]: {
    type: RelationshipType.NOTE_PARENT,
    sourceTypes: [EntityType.NOTE],
    targetTypes: [EntityType.NOTE],
    bidirectional: false,
    cascadeDelete: false,
    displayName: 'Parent note',
    icon: 'Link',
    color: '#6366F1', // indigo
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
    color: '#64748B', // slate
  },
  [RelationshipType.NOTE_FILE]: {
    type: RelationshipType.NOTE_FILE,
    sourceTypes: [EntityType.NOTE],
    targetTypes: [EntityType.FILE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'File',
    icon: 'File',
    color: '#64748B', // slate
  },
  [RelationshipType.SESSION_FILE]: {
    type: RelationshipType.SESSION_FILE,
    sourceTypes: [EntityType.SESSION],
    targetTypes: [EntityType.FILE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'File',
    icon: 'File',
    color: '#64748B', // slate
  },
  [RelationshipType.TASK_TASK]: {
    type: RelationshipType.TASK_TASK,
    sourceTypes: [EntityType.TASK],
    targetTypes: [EntityType.TASK],
    bidirectional: false,
    cascadeDelete: false,
    displayName: 'Depends on',
    icon: 'Link',
    color: '#EF4444', // red
  },
  [RelationshipType.PROJECT_TASK]: {
    type: RelationshipType.PROJECT_TASK,
    sourceTypes: [EntityType.PROJECT],
    targetTypes: [EntityType.TASK],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Project',
    icon: 'Folder',
    color: '#14B8A6', // teal
  },
  [RelationshipType.PROJECT_NOTE]: {
    type: RelationshipType.PROJECT_NOTE,
    sourceTypes: [EntityType.PROJECT],
    targetTypes: [EntityType.NOTE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Project',
    icon: 'Folder',
    color: '#14B8A6', // teal
  },
  [RelationshipType.GOAL_TASK]: {
    type: RelationshipType.GOAL_TASK,
    sourceTypes: [EntityType.GOAL],
    targetTypes: [EntityType.TASK],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Goal',
    icon: 'Target',
    color: '#F97316', // orange
  },
};
```

### 2. Update `src/types.ts`

Add relationship fields to existing entity types:

```typescript
export interface Task {
  // ... existing fields ...

  /**
   * Unified relationship system
   * @since 2.0.0
   */
  relationships?: Relationship[];

  /**
   * Migration tracking
   * @since 2.0.0
   */
  relationshipVersion?: number; // 0 = legacy, 1 = migrated

  /**
   * @deprecated Use relationships array instead
   * Kept for backward compatibility during migration
   */
  noteId?: string;

  /**
   * @deprecated Use relationships array instead
   */
  sourceNoteId?: string;

  /**
   * @deprecated Use relationships array instead
   */
  sourceSessionId?: string;
}

export interface Note {
  // ... existing fields ...

  relationships?: Relationship[];
  relationshipVersion?: number;

  /** @deprecated Use relationships array */
  topicId?: string;

  /** @deprecated Use relationships array */
  sourceSessionId?: string;
}

export interface Session {
  // ... existing fields ...

  relationships?: Relationship[];
  relationshipVersion?: number;

  /**
   * @deprecated Use relationships array
   * Kept for backward compatibility
   */
  extractedTaskIds?: string[];

  /** @deprecated Use relationships array */
  extractedNoteIds?: string[];
}
```

### 3. Add JSDoc Documentation

- All types must have clear JSDoc comments
- Include @since tags for new fields
- Include @deprecated tags for legacy fields
- Include examples where helpful

---

## Deliverables

1. **`src/types/relationships.ts`** - Complete relationship type system (200-300 lines)
2. **Updated `src/types.ts`** - Add relationship fields to existing types
3. **`docs/architecture/type-system.md`** - Documentation of type system design

---

## Acceptance Criteria

- [ ] All types compile without TypeScript errors (strict mode)
- [ ] `RelationshipType` enum includes all current relationship types
- [ ] `RELATIONSHIP_CONFIGS` includes configuration for all types
- [ ] Legacy fields marked with @deprecated JSDoc tags
- [ ] New fields marked with @since tags
- [ ] `Relationship` interface includes all required metadata fields
- [ ] Type documentation generated successfully via TypeDoc
- [ ] No breaking changes to existing code (backward compatible)
- [ ] Schema version field (`relationshipVersion`) added to all entity types

---

## Testing Requirements

### 1. Type-only Tests

Create `tests/types/relationships.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  Relationship,
  RelationshipType,
  EntityType,
  RELATIONSHIP_CONFIGS,
} from '@/types/relationships';

describe('Relationship Types', () => {
  it('should infer correct types', () => {
    const rel: Relationship = {
      id: '123',
      type: RelationshipType.TASK_NOTE,
      sourceType: EntityType.TASK,
      sourceId: 'task-1',
      targetType: EntityType.NOTE,
      targetId: 'note-1',
      metadata: {
        source: 'ai',
        confidence: 0.95,
        reasoning: 'Test',
        createdAt: new Date().toISOString(),
      },
      canonical: true,
    };

    expect(rel.type).toBe(RelationshipType.TASK_NOTE);
  });

  it('should have configs for all relationship types', () => {
    const types = Object.values(RelationshipType);
    const configs = Object.keys(RELATIONSHIP_CONFIGS);

    expect(configs.length).toBe(types.length);
  });

  it('should validate relationship metadata', () => {
    const rel: Relationship = {
      id: '123',
      type: RelationshipType.TASK_NOTE,
      sourceType: EntityType.TASK,
      sourceId: 'task-1',
      targetType: EntityType.NOTE,
      targetId: 'note-1',
      metadata: {
        source: 'manual',
        createdAt: new Date().toISOString(),
        createdBy: 'user-1',
      },
      canonical: true,
    };

    expect(rel.metadata.source).toBe('manual');
    expect(rel.metadata.confidence).toBeUndefined();
  });
});
```

### 2. Backward Compatibility Tests

Ensure old Task/Note/Session structures still valid:

```typescript
describe('Backward Compatibility', () => {
  it('should allow legacy Task fields', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test',
      noteId: 'note-1',
      sourceNoteId: 'note-1',
      sourceSessionId: 'session-1',
      // ... other required fields
    };

    expect(task.noteId).toBe('note-1');
  });
});
```

---

## Notes

- Keep this phase simple - just types, no implementation
- Focus on extensibility - new types should be easy to add
- Document design decisions in `docs/architecture/type-system.md`
- All colors use Tailwind CSS color palette for consistency

---

## Quality Standards

- Production-ready code (not prototypes)
- TypeScript strict mode enabled
- Zero `any` types
- Complete JSDoc documentation
- All acceptance criteria met

---

**Task Complete When:**
- All deliverable files created
- All tests passing
- TypeScript compiles with zero errors
- Documentation complete
