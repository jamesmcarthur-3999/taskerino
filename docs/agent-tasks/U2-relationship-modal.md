# AGENT TASK U2: Relationship Modal Component

**Objective:** Build the relationship management modal with search, bulk operations, and filtering.

**Priority:** P1 (UI Components)

**Dependencies:** C2 (Context Integration)

**Complexity:** High

**Estimated Time:** 10-12 hours

---

## Detailed Requirements

### 1. Create Relationship Modal Component

**File:** `src/components/relationships/RelationshipModal.tsx`

A full-featured modal for managing relationships:

```typescript
import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRelationships } from '@/context/RelationshipContext';
import { useRelationshipActions } from '@/hooks/useRelationshipActions';
import { Search, Filter, Link, Unlink } from 'lucide-react';

interface RelationshipModalProps {
  open: boolean;
  onClose: () => void;
  entityId: string;
  entityType: EntityType;
}

export function RelationshipModal({
  open,
  onClose,
  entityId,
  entityType,
}: RelationshipModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('all'); // all, tasks, notes, sessions
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const { getRelationships } = useRelationships();
  const { linkTo, unlink } = useRelationshipActions(entityId, entityType);

  // Get existing relationships
  const relationships = getRelationships(entityId);

  // Filter relationships by tab
  const filteredRelationships = useMemo(() => {
    let filtered = relationships;

    // Filter by tab
    if (selectedTab !== 'all') {
      const typeMap: Record<string, EntityType> = {
        tasks: EntityType.TASK,
        notes: EntityType.NOTE,
        sessions: EntityType.SESSION,
      };
      const targetType = typeMap[selectedTab];
      filtered = filtered.filter(r => r.targetType === targetType || r.sourceType === targetType);
    }

    // Filter by search query
    if (searchQuery) {
      // Search in relationship labels (would need to load entities)
      // Simplified for spec
      filtered = filtered; // TODO: implement search
    }

    return filtered;
  }, [relationships, selectedTab, searchQuery]);

  // Available entities to link to
  const [availableEntities, setAvailableEntities] = useState<any[]>([]);

  // Load available entities based on selected tab
  React.useEffect(() => {
    async function loadAvailable() {
      // Load entities that can be linked
      // Filter out already linked entities
      const storage = getStorage();

      const collectionName = getCollectionNameForTab(selectedTab);
      if (!collectionName) return;

      const all = await storage.load(collectionName);

      // Filter out already linked
      const linkedIds = new Set(relationships.map(r =>
        r.sourceId === entityId ? r.targetId : r.sourceId
      ));

      const available = all.filter(e => !linkedIds.has(e.id));
      setAvailableEntities(available);
    }

    if (open) {
      loadAvailable();
    }
  }, [open, selectedTab, relationships, entityId]);

  // Filtered available entities by search
  const filteredAvailable = useMemo(() => {
    if (!searchQuery) return availableEntities;

    return availableEntities.filter(entity => {
      const label = getEntityLabel(entity, selectedTab);
      return label.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [availableEntities, searchQuery]);

  // Handle link/unlink
  const handleLink = async (targetId: string, targetType: EntityType) => {
    const relType = getRelationshipType(entityType, targetType);
    await linkTo(targetId, targetType, relType);
  };

  const handleUnlink = async (relationshipId: string) => {
    await unlink(relationshipId);
  };

  // Bulk operations
  const handleBulkLink = async () => {
    for (const id of selectedItems) {
      const targetType = getEntityTypeForTab(selectedTab);
      await handleLink(id, targetType);
    }
    setSelectedItems(new Set());
  };

  const handleBulkUnlink = async () => {
    for (const id of selectedItems) {
      const rel = relationships.find(r =>
        r.sourceId === id || r.targetId === id
      );
      if (rel) {
        await handleUnlink(rel.id);
      }
    }
    setSelectedItems(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Relationships</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4">
            {/* Current Relationships */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2">Current Relationships ({filteredRelationships.length})</h3>
              <div className="space-y-2">
                {filteredRelationships.map(rel => (
                  <RelationshipListItem
                    key={rel.id}
                    relationship={rel}
                    onUnlink={() => handleUnlink(rel.id)}
                    selected={selectedItems.has(rel.id)}
                    onSelect={(selected) => {
                      const newSet = new Set(selectedItems);
                      if (selected) {
                        newSet.add(rel.id);
                      } else {
                        newSet.delete(rel.id);
                      }
                      setSelectedItems(newSet);
                    }}
                  />
                ))}
                {filteredRelationships.length === 0 && (
                  <p className="text-sm text-gray-500">No relationships found</p>
                )}
              </div>
            </div>

            {/* Available to Link */}
            <div>
              <h3 className="text-sm font-medium mb-2">Available to Link ({filteredAvailable.length})</h3>
              <div className="space-y-2">
                {filteredAvailable.map(entity => (
                  <AvailableEntityItem
                    key={entity.id}
                    entity={entity}
                    entityType={getEntityTypeForTab(selectedTab)}
                    onLink={() => handleLink(entity.id, getEntityTypeForTab(selectedTab))}
                    selected={selectedItems.has(entity.id)}
                    onSelect={(selected) => {
                      const newSet = new Set(selectedItems);
                      if (selected) {
                        newSet.add(entity.id);
                      } else {
                        newSet.delete(entity.id);
                      }
                      setSelectedItems(newSet);
                    }}
                  />
                ))}
                {filteredAvailable.length === 0 && (
                  <p className="text-sm text-gray-500">No items available to link</p>
                )}
              </div>
            </div>
          </div>
        </Tabs>

        {/* Bulk Actions */}
        {selectedItems.size > 0 && (
          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={handleBulkLink}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Link size={16} className="inline mr-2" />
              Link {selectedItems.size} items
            </button>
            <button
              onClick={handleBulkUnlink}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              <Unlink size={16} className="inline mr-2" />
              Unlink {selectedItems.size} items
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Sub-components
function RelationshipListItem({ relationship, onUnlink, selected, onSelect }) {
  // Render relationship with metadata
}

function AvailableEntityItem({ entity, entityType, onLink, selected, onSelect }) {
  // Render available entity with link button
}

// Helpers
function getRelationshipType(sourceType: EntityType, targetType: EntityType): RelationshipType {
  // Determine relationship type based on source and target
}

function getCollectionNameForTab(tab: string): string {
  // Map tab to collection name
}

function getEntityTypeForTab(tab: string): EntityType {
  // Map tab to entity type
}

function getEntityLabel(entity: any, tab: string): string {
  // Get display label for entity
}
```

### 2. Add Keyboard Shortcuts

Support keyboard navigation:
- `Cmd/Ctrl + K` - Focus search
- `Escape` - Close modal
- `Cmd/Ctrl + A` - Select all
- `Cmd/Ctrl + L` - Link selected
- `Cmd/Ctrl + U` - Unlink selected

---

## Deliverables

1. **`src/components/relationships/RelationshipModal.tsx`** - Main modal component (600-800 lines)
2. **`src/components/relationships/RelationshipListItem.tsx`** - List item for relationships
3. **`src/components/relationships/AvailableEntityItem.tsx`** - List item for available entities
4. **`tests/components/RelationshipModal.test.tsx`** - Component tests (400+ lines)
5. **`docs/components/relationship-modal.md`** - Component documentation

---

## Acceptance Criteria

- [ ] Modal opens and closes smoothly
- [ ] Search filters both current and available items
- [ ] Tabs switch correctly (all, tasks, notes, sessions)
- [ ] Link/unlink operations work
- [ ] Bulk operations work (select multiple, link/unlink)
- [ ] Optimistic updates (UI updates immediately)
- [ ] Keyboard shortcuts work
- [ ] Accessible (WCAG 2.1 AA)
- [ ] Performance: No lag with 1000+ items (use virtual scrolling)
- [ ] Mobile-friendly (responsive design)

---

## Testing Requirements

```typescript
describe('RelationshipModal', () => {
  it('should open and close', () => {
    const onClose = vi.fn();
    render(<RelationshipModal open={true} onClose={onClose} ... />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close/i });
    await userEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });

  it('should search items', async () => {
    render(<RelationshipModal ... />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'test');

    // Should filter items
  });

  it('should link item', async () => {
    render(<RelationshipModal ... />);

    const linkBtn = screen.getAllByRole('button', { name: /link/i })[0];
    await userEvent.click(linkBtn);

    // Should create relationship
  });

  it('should bulk link', async () => {
    // Select multiple items
    // Click bulk link
    // Verify all linked
  });
});
```

---

**Task Complete When:**
- All deliverables created
- All acceptance criteria met
- All tests passing
- Accessibility validated
- Documentation complete
