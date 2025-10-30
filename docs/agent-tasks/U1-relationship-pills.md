# AGENT TASK U1: Relationship Pills Component

**Objective:** Build the inline relationship pills display component.

**Priority:** P1 (UI Components)

**Dependencies:** C2 (Context Integration)

**Complexity:** Medium

**Estimated Time:** 6-8 hours

---

## Detailed Requirements

### 1. Create Relationship Pills Component

**File:** `src/components/relationships/RelationshipPills.tsx`

Create a component that displays relationships as compact, colored pills with icons:

```typescript
import React from 'react';
import { Relationship, RelationshipType, RELATIONSHIP_CONFIGS } from '@/types/relationships';
import { useRelationships } from '@/context/RelationshipContext';
import { X } from 'lucide-react';

interface RelationshipPillsProps {
  entityId: string;
  entityType: EntityType;
  maxVisible?: number; // Default: 5
  onPillClick?: (relationship: Relationship) => void;
  onRemove?: (relationship: Relationship) => void;
  showRemoveButton?: boolean; // Default: false
  filterTypes?: RelationshipType[]; // Show only certain types
}

export function RelationshipPills({
  entityId,
  entityType,
  maxVisible = 5,
  onPillClick,
  onRemove,
  showRemoveButton = false,
  filterTypes,
}: RelationshipPillsProps) {
  const { getRelationships } = useRelationships();

  // Get relationships for entity
  let relationships = getRelationships(entityId);

  // Filter by types if specified
  if (filterTypes && filterTypes.length > 0) {
    relationships = relationships.filter(r => filterTypes.includes(r.type));
  }

  // Limit visible pills
  const visibleRels = relationships.slice(0, maxVisible);
  const hiddenCount = Math.max(0, relationships.length - maxVisible);

  if (relationships.length === 0) {
    return null; // Or empty state
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visibleRels.map(rel => (
        <RelationshipPill
          key={rel.id}
          relationship={rel}
          onClick={() => onPillClick?.(rel)}
          onRemove={showRemoveButton ? () => onRemove?.(rel) : undefined}
        />
      ))}
      {hiddenCount > 0 && (
        <button
          className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          onClick={() => onPillClick?.(visibleRels[0])} // Open modal
        >
          +{hiddenCount} more
        </button>
      )}
    </div>
  );
}

interface RelationshipPillProps {
  relationship: Relationship;
  onClick?: () => void;
  onRemove?: () => void;
}

function RelationshipPill({ relationship, onClick, onRemove }: RelationshipPillProps) {
  const config = RELATIONSHIP_CONFIGS[relationship.type];

  // Get target entity label (need to fetch entity)
  const [label, setLabel] = React.useState('');

  React.useEffect(() => {
    // Fetch target entity to get label
    async function fetchLabel() {
      const targetId = relationship.targetId;
      const targetType = relationship.targetType;

      // Load entity and extract label
      // This is simplified - actual implementation would use storage service
      const entity = await loadEntity(targetType, targetId);
      const label = getEntityLabel(entity, targetType);
      setLabel(label);
    }

    fetchLabel();
  }, [relationship]);

  return (
    <div
      className={`
        inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
        cursor-pointer transition-colors
        ${onClick ? 'hover:opacity-80' : ''}
      `}
      style={{
        backgroundColor: config.color + '20', // 20% opacity
        color: config.color,
      }}
      onClick={onClick}
    >
      {/* Icon */}
      {config.icon && (
        <span className="w-3 h-3">
          {/* Render icon based on config.icon name */}
        </span>
      )}

      {/* Label */}
      <span>{label || 'Loading...'}</span>

      {/* AI indicator (if AI-generated with low confidence) */}
      {relationship.metadata.source === 'ai' && (relationship.metadata.confidence || 0) < 0.8 && (
        <span className="opacity-60" title="AI suggested">
          ✨
        </span>
      )}

      {/* Remove button */}
      {onRemove && (
        <button
          className="hover:bg-black/10 rounded-full p-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/**
 * Helper to load entity by type and ID
 */
async function loadEntity(entityType: EntityType, entityId: string): Promise<any> {
  const storage = getStorage();
  const collectionName = getCollectionName(entityType);
  return storage.load(collectionName, entityId);
}

/**
 * Helper to get display label for an entity
 */
function getEntityLabel(entity: any, entityType: EntityType): string {
  switch (entityType) {
    case EntityType.TASK:
      return entity.title;
    case EntityType.NOTE:
      return entity.summary || entity.title || 'Untitled note';
    case EntityType.SESSION:
      return entity.name || 'Session';
    case EntityType.TOPIC:
      return entity.name;
    case EntityType.COMPANY:
      return entity.name;
    case EntityType.CONTACT:
      return entity.name;
    default:
      return 'Unknown';
  }
}

function getCollectionName(entityType: EntityType): string {
  // Implementation (same as in RelationshipManager)
}
```

### 2. Create Relationship Pill Variants

**File:** `src/components/relationships/RelationshipPillVariants.tsx`

Different visual styles for different contexts:

```typescript
// Compact variant (for list views)
export function CompactRelationshipPills({ ... }) {
  // Smaller pills, max 3 visible
}

// Detailed variant (for detail views)
export function DetailedRelationshipPills({ ... }) {
  // Larger pills with more metadata
  // Shows confidence, reasoning on hover
}

// Inline variant (for inline text)
export function InlineRelationshipPills({ ... }) {
  // Minimal pills that fit inline with text
}
```

---

## Deliverables

1. **`src/components/relationships/RelationshipPills.tsx`** - Main pills component (300-400 lines)
2. **`src/components/relationships/RelationshipPillVariants.tsx`** - Pill variants
3. **`src/components/relationships/RelationshipPill.stories.tsx`** - Storybook stories (if using Storybook)
4. **`tests/components/RelationshipPills.test.tsx`** - Component tests (200+ lines)
5. **`docs/components/relationship-pills.md`** - Component documentation

---

## Acceptance Criteria

- [ ] Pills display with correct colors from RELATIONSHIP_CONFIGS
- [ ] Pills show entity labels (not just IDs)
- [ ] AI confidence indicator shows for low-confidence relationships
- [ ] Remove button works and updates optimistically
- [ ] "+X more" button appears when maxVisible exceeded
- [ ] Click handler fires when pill clicked
- [ ] Pills are responsive (wrap on mobile)
- [ ] WCAG 2.1 AA compliant (color contrast, keyboard nav)
- [ ] Performance: No jank with 50+ relationships

---

## Testing Requirements

```typescript
describe('RelationshipPills', () => {
  it('should render relationships as pills', () => {
    render(
      <RelationshipPills
        entityId="task-1"
        entityType={EntityType.TASK}
      />
    );

    // Should show pills for task relationships
    expect(screen.getByText(/note/i)).toBeInTheDocument();
  });

  it('should show "+X more" when exceeds maxVisible', () => {
    render(
      <RelationshipPills
        entityId="task-1"
        entityType={EntityType.TASK}
        maxVisible={2}
      />
    );

    // Assuming task-1 has 5 relationships
    expect(screen.getByText(/\+3 more/i)).toBeInTheDocument();
  });

  it('should handle remove button click', async () => {
    const onRemove = vi.fn();

    render(
      <RelationshipPills
        entityId="task-1"
        entityType={EntityType.TASK}
        showRemoveButton
        onRemove={onRemove}
      />
    );

    const removeBtn = screen.getAllByRole('button')[0];
    await userEvent.click(removeBtn);

    expect(onRemove).toHaveBeenCalled();
  });
});
```

---

## Accessibility Requirements

- [ ] Pills are keyboard accessible (Tab to focus, Enter to activate)
- [ ] Remove button is keyboard accessible
- [ ] Color is not the only indicator (icons + text)
- [ ] Screen reader announces relationship type and target
- [ ] Focus indicators visible
- [ ] Sufficient color contrast (4.5:1 minimum)

---

**Task Complete When:**
- All deliverables created
- All acceptance criteria met
- All tests passing
- Accessibility validated
- Documentation complete
