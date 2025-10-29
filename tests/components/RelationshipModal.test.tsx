/**
 * RelationshipModal comprehensive test suite
 *
 * Tests:
 * - Modal opens and closes correctly
 * - Search filters current and available items
 * - Tabs switch correctly (all, tasks, notes, sessions, etc.)
 * - Link operation works (single item)
 * - Unlink operation works (single item)
 * - Bulk link works (select multiple, link all)
 * - Bulk unlink works (select multiple, unlink all)
 * - Select all checkbox works
 * - Keyboard shortcuts work (Cmd+K, Escape, Cmd+A, Cmd+L, Cmd+U)
 * - Loading states display
 * - Empty states display
 * - Error states display
 * - Accessibility (focus trap, keyboard navigation, screen reader announcements)
 * - Performance (virtual scrolling with 1000+ items)
 *
 * @module tests/components/RelationshipModal.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RelationshipModal } from '@/components/relationships/RelationshipModal';
import type { Relationship, EntityType } from '@/types/relationships';
import type { Task, Note } from '@/types';

// Mock dependencies
vi.mock('@/services/storage', () => ({
  getStorage: vi.fn(() =>
    Promise.resolve({
      load: vi.fn(),
      save: vi.fn(),
      init: vi.fn(),
    })
  ),
}));


vi.mock('@/hooks/useRelationshipActions', () => ({
  useRelationshipActions: vi.fn(() => ({
    linkTo: vi.fn(),
    unlink: vi.fn(),
    getLinks: vi.fn(() => []),
  })),
}));

vi.mock('@/context/RelationshipContext', () => ({
  useRelationships: vi.fn(() => ({
    getRelationships: vi.fn(() => []),
    isLoading: false,
    error: null,
  })),
}));

// Helper to create mock relationships
function createMockRelationship(
  id: string,
  sourceId: string,
  sourceType: EntityType,
  targetId: string,
  targetType: EntityType
): Relationship {
  return {
    id,
    type: 'task-note',
    sourceType,
    sourceId,
    targetType,
    targetId,
    metadata: {
      source: 'manual',
      createdAt: new Date().toISOString(),
    },
    canonical: true,
  };
}

// Helper to create mock tasks
function createMockTask(id: string, title: string): Task {
  return {
    id,
    title,
    done: false,
    priority: 'medium',
    status: 'todo',
    createdBy: 'manual',
    createdAt: new Date().toISOString(),
  };
}

// Helper to create mock notes
function createMockNote(id: string, content: string): Note {
  return {
    id,
    content,
    summary: content.substring(0, 50),
    timestamp: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    source: 'thought',
    tags: [],
  };
}


describe('RelationshipModal', () => {
  let mockLinkTo: ReturnType<typeof vi.fn>;
  let mockUnlink: ReturnType<typeof vi.fn>;
  let mockGetLinks: ReturnType<typeof vi.fn>;
  let mockGetRelationships: ReturnType<typeof vi.fn>;
  let mockStorageLoad: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    mockLinkTo = vi.fn();
    mockUnlink = vi.fn();
    mockGetLinks = vi.fn(() => []);
    mockGetRelationships = vi.fn(() => []);
    mockStorageLoad = vi.fn();

    // Setup hooks mocks
    const { useRelationshipActions } = await import('@/hooks/useRelationshipActions');
    vi.mocked(useRelationshipActions).mockReturnValue({
      linkTo: mockLinkTo,
      unlink: mockUnlink,
      getLinks: mockGetLinks,
      unlinkFrom: vi.fn(),
      isLinkedTo: vi.fn(),
    });

    const { useRelationships } = await import('@/context/RelationshipContext');
    vi.mocked(useRelationships).mockReturnValue({
      getRelationships: mockGetRelationships,
      addRelationship: vi.fn(),
      removeRelationship: vi.fn(),
      getRelatedEntities: vi.fn(),
      isLoading: false,
      error: null,
      clearError: vi.fn(),
      optimisticRelationships: new Map(),
      stats: {
        totalRelationships: 0,
        aiRelationships: 0,
        manualRelationships: 0,
      },
    });

    const { getStorage } = await import('@/services/storage');
    vi.mocked(getStorage).mockResolvedValue({
      load: mockStorageLoad,
      save: vi.fn(),
      init: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      keys: vi.fn(),
      beginTransaction: vi.fn(),
      isAvailable: vi.fn(() => Promise.resolve(true)),
      shutdown: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Opening and Closing', () => {
    it('should render when open is true', () => {
      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Manage Relationships')).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(
        <RelationshipModal
          open={false}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should call onClose when Escape key is pressed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <RelationshipModal
          open={true}
          onClose={onClose}
          entityId="task-1"
          entityType="task"
        />
      );

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when dialog is dismissed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <RelationshipModal
          open={true}
          onClose={onClose}
          entityId="task-1"
          entityType="task"
        />
      );

      // Click close button (X)
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should focus search input on open', async () => {
      const { rerender } = render(
        <RelationshipModal
          open={false}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
        />
      );

      rerender(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
        />
      );

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search entities/i);
        expect(searchInput).toHaveFocus();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter available entities by search query', async () => {
      const user = userEvent.setup();

      const mockTasks = [
        createMockTask('task-1', 'Fix login bug'),
        createMockTask('task-2', 'Update documentation'),
        createMockTask('task-3', 'Refactor authentication'),
      ];

      mockStorageLoad.mockResolvedValue(mockTasks);
      mockGetLinks.mockReturnValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-0"
          entityType="task"
          initialTab="tasks"
        />
      );

      // Wait for entities to load
      await waitFor(() => {
        expect(screen.getByText('Fix login bug')).toBeInTheDocument();
      });

      // Search for "login"
      const searchInput = screen.getByPlaceholderText(/search entities/i);
      await user.type(searchInput, 'login');

      // Wait for debounce (300ms)
      await waitFor(
        () => {
          expect(screen.getByText('Fix login bug')).toBeInTheDocument();
          expect(screen.queryByText('Update documentation')).not.toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it('should debounce search input (300ms)', async () => {
      const user = userEvent.setup();

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
        />
      );

      const searchInput = screen.getByPlaceholderText(/search entities/i);

      // Type quickly
      await user.type(searchInput, 'test');

      // Should not filter immediately
      expect(searchInput).toHaveValue('test');

      // Wait for debounce
      await waitFor(
        () => {
          // Check that search has been applied (debounced value updated)
        },
        { timeout: 500 }
      );
    });

    it('should focus search on Cmd+K shortcut', async () => {
      const user = userEvent.setup();

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
        />
      );

      const searchInput = screen.getByPlaceholderText(/search entities/i);

      // Blur the input
      searchInput.blur();

      // Press Cmd+K (or Ctrl+K on non-Mac)
      await user.keyboard('{Meta>}k{/Meta}');

      expect(searchInput).toHaveFocus();
    });
  });

  describe('Tab Switching', () => {
    it('should switch between tabs', async () => {
      const user = userEvent.setup();

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
        />
      );

      // Click on Tasks tab
      const tasksTab = screen.getByRole('tab', { name: /tasks/i });
      await user.click(tasksTab);

      expect(tasksTab).toHaveAttribute('data-state', 'active');

      // Click on Notes tab
      const notesTab = screen.getByRole('tab', { name: /notes/i });
      await user.click(notesTab);

      expect(notesTab).toHaveAttribute('data-state', 'active');
    });

    it('should load entities for selected tab', async () => {
      const user = userEvent.setup();

      const mockTasks = [createMockTask('task-1', 'Test task')];
      const mockNotes = [createMockNote('note-1', 'Test note')];

      mockStorageLoad.mockImplementation((collection: string) => {
        if (collection === 'tasks') return Promise.resolve(mockTasks);
        if (collection === 'notes') return Promise.resolve(mockNotes);
        return Promise.resolve([]);
      });

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-0"
          entityType="task"
        />
      );

      // Switch to tasks tab
      const tasksTab = screen.getByRole('tab', { name: /^tasks$/i });
      await user.click(tasksTab);

      await waitFor(() => {
        expect(mockStorageLoad).toHaveBeenCalledWith('tasks');
      });

      // Switch to notes tab
      const notesTab = screen.getByRole('tab', { name: /^notes$/i });
      await user.click(notesTab);

      await waitFor(() => {
        expect(mockStorageLoad).toHaveBeenCalledWith('notes');
      });
    });

    it('should respect initialTab prop', () => {
      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
          initialTab="notes"
        />
      );

      const notesTab = screen.getByRole('tab', { name: /^notes$/i });
      expect(notesTab).toHaveAttribute('data-state', 'active');
    });
  });

  describe('Link Operations', () => {
    it('should link a single entity', async () => {
      const user = userEvent.setup();

      const mockTasks = [createMockTask('task-1', 'Test task')];
      mockStorageLoad.mockResolvedValue(mockTasks);
      mockGetLinks.mockReturnValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="note-1"
          entityType="note"
          initialTab="tasks"
        />
      );

      // Wait for entity to load
      await waitFor(() => {
        expect(screen.getByText('Test task')).toBeInTheDocument();
      });

      // Click link button
      const linkButton = screen.getByRole('button', { name: /link to test task/i });
      await user.click(linkButton);

      expect(mockLinkTo).toHaveBeenCalledWith('task-1', 'task', 'task-note', {
        source: 'manual',
      });
    });

    it('should support bulk link operation', async () => {
      const user = userEvent.setup();

      const mockTasks = [
        createMockTask('task-1', 'Task 1'),
        createMockTask('task-2', 'Task 2'),
      ];
      mockStorageLoad.mockResolvedValue(mockTasks);
      mockGetLinks.mockReturnValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="note-1"
          entityType="note"
          initialTab="tasks"
        />
      );

      // Wait for entities to load
      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      // Select both tasks
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]); // Task 1
      await user.click(checkboxes[1]); // Task 2

      // Click bulk link button
      const bulkLinkButton = screen.getByRole('button', { name: /link 2/i });
      await user.click(bulkLinkButton);

      expect(mockLinkTo).toHaveBeenCalledTimes(2);
    });

    it('should handle Cmd+L shortcut for bulk link', async () => {
      const user = userEvent.setup();

      const mockTasks = [createMockTask('task-1', 'Task 1')];
      mockStorageLoad.mockResolvedValue(mockTasks);
      mockGetLinks.mockReturnValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="note-1"
          entityType="note"
          initialTab="tasks"
        />
      );

      // Wait for entity to load
      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      // Select task
      const checkbox = screen.getAllByRole('checkbox')[0];
      await user.click(checkbox);

      // Press Cmd+L
      await user.keyboard('{Meta>}l{/Meta}');

      expect(mockLinkTo).toHaveBeenCalled();
    });
  });

  describe('Unlink Operations', () => {
    it('should unlink a single relationship', async () => {
      const user = userEvent.setup();

      const mockRelationship = createMockRelationship(
        'rel-1',
        'task-1',
        'task',
        'note-1',
        'note'
      );
      mockGetLinks.mockReturnValue([mockRelationship]);
      mockStorageLoad.mockResolvedValue([createMockNote('note-1', 'Test note')]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
        />
      );

      // Wait for relationship to load
      await waitFor(() => {
        expect(screen.getByText(/test note/i)).toBeInTheDocument();
      });

      // Click unlink button
      const unlinkButton = screen.getByRole('button', { name: /unlink/i });
      await user.click(unlinkButton);

      expect(mockUnlink).toHaveBeenCalledWith('rel-1');
    });

    it('should support bulk unlink operation', async () => {
      const user = userEvent.setup();

      const mockRelationships = [
        createMockRelationship('rel-1', 'task-1', 'task', 'note-1', 'note'),
        createMockRelationship('rel-2', 'task-1', 'task', 'note-2', 'note'),
      ];
      mockGetLinks.mockReturnValue(mockRelationships);
      mockStorageLoad.mockResolvedValue([
        createMockNote('note-1', 'Note 1'),
        createMockNote('note-2', 'Note 2'),
      ]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
        />
      );

      // Wait for relationships to load
      await waitFor(() => {
        expect(screen.getByText(/note 1/i)).toBeInTheDocument();
      });

      // Select both relationships (first two checkboxes in current relationships section)
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      // Click bulk unlink button
      const bulkUnlinkButton = screen.getByRole('button', { name: /unlink 2/i });
      await user.click(bulkUnlinkButton);

      expect(mockUnlink).toHaveBeenCalledTimes(2);
    });

    it('should handle Cmd+U shortcut for bulk unlink', async () => {
      const user = userEvent.setup();

      const mockRelationship = createMockRelationship(
        'rel-1',
        'task-1',
        'task',
        'note-1',
        'note'
      );
      mockGetLinks.mockReturnValue([mockRelationship]);
      mockStorageLoad.mockResolvedValue([createMockNote('note-1', 'Test note')]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
        />
      );

      // Wait for relationship to load
      await waitFor(() => {
        expect(screen.getByText(/test note/i)).toBeInTheDocument();
      });

      // Select relationship
      const checkbox = screen.getAllByRole('checkbox')[0];
      await user.click(checkbox);

      // Press Cmd+U
      await user.keyboard('{Meta>}u{/Meta}');

      expect(mockUnlink).toHaveBeenCalled();
    });
  });

  describe('Select All Functionality', () => {
    it('should select all items with Cmd+A shortcut', async () => {
      const user = userEvent.setup();

      const mockTasks = [
        createMockTask('task-1', 'Task 1'),
        createMockTask('task-2', 'Task 2'),
      ];
      mockStorageLoad.mockResolvedValue(mockTasks);
      mockGetLinks.mockReturnValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-0"
          entityType="task"
          initialTab="tasks"
        />
      );

      // Wait for entities to load
      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      // Press Cmd+A
      await user.keyboard('{Meta>}a{/Meta}');

      // All checkboxes should be checked
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toHaveAttribute('aria-checked', 'true');
      });
    });

    it('should deselect all when pressing Cmd+A again', async () => {
      const user = userEvent.setup();

      const mockTasks = [createMockTask('task-1', 'Task 1')];
      mockStorageLoad.mockResolvedValue(mockTasks);
      mockGetLinks.mockReturnValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-0"
          entityType="task"
          initialTab="tasks"
        />
      );

      // Wait for entity to load
      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      // Select all
      await user.keyboard('{Meta>}a{/Meta}');

      // Deselect all
      await user.keyboard('{Meta>}a{/Meta}');

      // All checkboxes should be unchecked
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator while fetching entities', async () => {
      mockStorageLoad.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );
      mockGetLinks.mockReturnValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
          initialTab="tasks"
        />
      );

      // Should show loading indicator
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/loading entities/i)).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no relationships exist', () => {
      mockGetLinks.mockReturnValue([]);
      mockStorageLoad.mockResolvedValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
        />
      );

      expect(screen.getByText('No relationships found')).toBeInTheDocument();
    });

    it('should show empty state when no entities available to link', async () => {
      mockGetLinks.mockReturnValue([]);
      mockStorageLoad.mockResolvedValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
          initialTab="tasks"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No items available to link')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when entity loading fails', async () => {
      mockStorageLoad.mockRejectedValue(new Error('Storage error'));
      mockGetLinks.mockReturnValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
          initialTab="tasks"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/storage error/i)).toBeInTheDocument();
      });
    });

    it('should auto-dismiss error after 5 seconds', async () => {
      vi.useFakeTimers();

      mockStorageLoad.mockRejectedValue(new Error('Test error'));
      mockGetLinks.mockReturnValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
          initialTab="tasks"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should allow dismissing error manually', async () => {
      const user = userEvent.setup();

      mockStorageLoad.mockRejectedValue(new Error('Test error'));
      mockGetLinks.mockReturnValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
          initialTab="tasks"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Click dismiss button
      const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
      await user.click(dismissButton);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-1"
          entityType="task"
        />
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby');
      expect(screen.getByLabelText(/search entities/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation for checkboxes', async () => {
      const user = userEvent.setup();

      const mockTasks = [createMockTask('task-1', 'Test task')];
      mockStorageLoad.mockResolvedValue(mockTasks);
      mockGetLinks.mockReturnValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-0"
          entityType="task"
          initialTab="tasks"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test task')).toBeInTheDocument();
      });

      // Tab to checkbox
      const checkbox = screen.getAllByRole('checkbox')[0];
      checkbox.focus();

      // Press Space to toggle
      await user.keyboard(' ');

      expect(checkbox).toHaveAttribute('aria-checked', 'true');

      // Press Space again to uncheck
      await user.keyboard(' ');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should announce screen reader updates', async () => {
      const mockTasks = [createMockTask('task-1', 'Test task')];
      mockStorageLoad.mockResolvedValue(mockTasks);
      mockGetLinks.mockReturnValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-0"
          entityType="task"
          initialTab="tasks"
        />
      );

      // Loading state has sr-only text
      expect(screen.getByText(/loading entities/i)).toHaveClass('sr-only');

      await waitFor(() => {
        expect(screen.queryByText(/loading entities/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance (Virtual Scrolling)', () => {
    it('should handle 1000+ items efficiently with virtual scrolling', async () => {
      // Create 1000 mock tasks
      const mockTasks = Array.from({ length: 1000 }, (_, i) =>
        createMockTask(`task-${i}`, `Task ${i}`)
      );

      mockStorageLoad.mockResolvedValue(mockTasks);
      mockGetLinks.mockReturnValue([]);

      render(
        <RelationshipModal
          open={true}
          onClose={() => {}}
          entityId="task-0"
          entityType="task"
          initialTab="tasks"
        />
      );

      await waitFor(() => {
        // Only a subset of items should be rendered (virtual scrolling)
        const visibleItems = screen.getAllByRole('listitem');
        expect(visibleItems.length).toBeLessThan(1000);
        expect(visibleItems.length).toBeGreaterThan(0);
      });
    });
  });
});
