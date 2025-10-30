/**
 * RelationshipPills Component Tests
 *
 * Comprehensive test suite for RelationshipPills and its variants.
 * Tests cover:
 * - Rendering with entity labels
 * - Colors and icons from config
 * - AI confidence indicators
 * - Click and remove handlers
 * - MaxVisible and "+X more" button
 * - Keyboard accessibility
 * - Error handling
 * - Performance with many relationships
 * - Variant components (Compact, Detailed, Inline)
 *
 * Target coverage: >85%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { RelationshipPills } from '@/components/relationships/RelationshipPills';
import {
  CompactRelationshipPills,
  DetailedRelationshipPills,
  InlineRelationshipPills,
  formatRelationshipMetadata,
  getRelationshipPillColor,
} from '@/components/relationships/RelationshipPillVariants';
import {
  type Relationship,
  RelationshipType,
  EntityType,
  RELATIONSHIP_CONFIGS,
} from '@/types/relationships';

// Mock dependencies
vi.mock('@/context/RelationshipContext', () => ({
  useRelationships: vi.fn(),
}));

vi.mock('@/services/storage', () => ({
  getStorage: vi.fn(),
}));

// Import mocked modules
import { useRelationships } from '@/context/RelationshipContext';
import { getStorage } from '@/services/storage';

// Test data
const mockTask = {
  id: 'task-1',
  title: 'Complete feature',
  status: 'in-progress',
};

const mockNote = {
  id: 'note-1',
  summary: 'Meeting notes',
  title: 'Meeting with team',
};

const mockTopic = {
  id: 'topic-1',
  name: 'Engineering',
};

const mockRelationships: Relationship[] = [
  {
    id: 'rel-1',
    type: RelationshipType.TASK_NOTE,
    sourceType: EntityType.TASK,
    sourceId: 'task-1',
    targetType: EntityType.NOTE,
    targetId: 'note-1',
    metadata: {
      source: 'manual',
      createdAt: '2024-01-15T10:00:00.000Z',
    },
    canonical: true,
  },
  {
    id: 'rel-2',
    type: RelationshipType.TASK_TOPIC,
    sourceType: EntityType.TASK,
    sourceId: 'task-1',
    targetType: EntityType.TOPIC,
    targetId: 'topic-1',
    metadata: {
      source: 'ai',
      confidence: 0.65,
      reasoning: 'Task mentions engineering work',
      createdAt: '2024-01-15T11:00:00.000Z',
    },
    canonical: true,
  },
  {
    id: 'rel-3',
    type: RelationshipType.TASK_SESSION,
    sourceType: EntityType.TASK,
    sourceId: 'task-1',
    targetType: EntityType.SESSION,
    targetId: 'session-1',
    metadata: {
      source: 'ai',
      confidence: 0.95,
      createdAt: '2024-01-15T12:00:00.000Z',
    },
    canonical: true,
  },
];

// Mock storage adapter
const mockStorageAdapter = {
  load: vi.fn(),
};

describe('RelationshipPills', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useRelationships hook
    (useRelationships as any).mockReturnValue({
      getRelationships: vi.fn((entityId: string) => {
        if (entityId === 'task-1') {
          return mockRelationships;
        }
        return [];
      }),
    });

    // Mock storage
    (getStorage as any).mockResolvedValue(mockStorageAdapter);

    // Mock storage.load to return entity collections
    mockStorageAdapter.load.mockImplementation((collection: string) => {
      if (collection === 'notes') {
        return Promise.resolve([mockNote]);
      }
      if (collection === 'topics') {
        return Promise.resolve([mockTopic]);
      }
      if (collection === 'sessions') {
        return Promise.resolve([{ id: 'session-1', name: 'Work Session' }]);
      }
      if (collection === 'tasks') {
        return Promise.resolve([mockTask]);
      }
      return Promise.resolve([]);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render relationships as pills', async () => {
      render(
        <RelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      // Wait for entity labels to load
      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.getByText('Work Session')).toBeInTheDocument();
    });

    it('should show loading state while fetching labels', () => {
      render(
        <RelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      // Should initially show "Loading..."
      expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
    });

    it('should return null when there are no relationships', () => {
      const { container } = render(
        <RelationshipPills entityId="task-999" entityType={EntityType.TASK} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render with correct colors from RELATIONSHIP_CONFIGS', async () => {
      render(
        <RelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      // Check that pills have color styles
      const pills = screen.getAllByRole('button');
      expect(pills.length).toBeGreaterThan(0);

      // Pills should have inline styles with config colors
      const firstPill = pills[0];
      expect(firstPill).toHaveStyle({ color: RELATIONSHIP_CONFIGS[RelationshipType.TASK_NOTE].color });
    });
  });

  describe('AI Confidence Indicator', () => {
    it('should show sparkle emoji for low confidence AI relationships', async () => {
      render(
        <RelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument();
      });

      // rel-2 has confidence 0.65 (< 0.8), should show sparkle
      const engineeringPill = screen.getByText('Engineering').closest('[role="button"]');
      expect(engineeringPill).toHaveTextContent('✨');
    });

    it('should not show sparkle for high confidence AI relationships', async () => {
      render(
        <RelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getByText('Work Session')).toBeInTheDocument();
      });

      // rel-3 has confidence 0.95 (>= 0.8), should NOT show sparkle
      const sessionPill = screen.getByText('Work Session').closest('[role="button"]');
      expect(sessionPill).not.toHaveTextContent('✨');
    });

    it('should not show sparkle for manual relationships', async () => {
      render(
        <RelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      // rel-1 is manual, should NOT show sparkle
      const notePill = screen.getByText('Meeting notes').closest('[role="button"]');
      expect(notePill).not.toHaveTextContent('✨');
    });
  });

  describe('MaxVisible and "+X more" Button', () => {
    it('should limit visible pills to maxVisible', async () => {
      render(
        <RelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          maxVisible={2}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      // Should show 2 pills + "+1 more" button
      const pills = screen.getAllByRole('button');
      expect(pills.length).toBe(3); // 2 visible pills + 1 more button
    });

    it('should show "+X more" button when relationships exceed maxVisible', async () => {
      render(
        <RelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          maxVisible={1}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
      });
    });

    it('should not show "+X more" when relationships fit within maxVisible', async () => {
      render(
        <RelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          maxVisible={10}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
    });

    it('should call onPillClick when "+X more" is clicked', async () => {
      const handleClick = vi.fn();

      render(
        <RelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          maxVisible={1}
          onPillClick={handleClick}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
      });

      const moreButton = screen.getByText(/\+2 more/);
      fireEvent.click(moreButton);

      expect(handleClick).toHaveBeenCalledWith(mockRelationships[0]);
    });
  });

  describe('Click Handlers', () => {
    it('should call onPillClick when pill is clicked', async () => {
      const handleClick = vi.fn();

      render(
        <RelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          onPillClick={handleClick}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      const pill = screen.getByText('Meeting notes').closest('[role="button"]');
      fireEvent.click(pill!);

      expect(handleClick).toHaveBeenCalledWith(mockRelationships[0]);
    });

    it('should call onRemove when remove button is clicked', async () => {
      const handleRemove = vi.fn();

      render(
        <RelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          showRemoveButton
          onRemove={handleRemove}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      // Find remove button (X icon)
      const removeButtons = screen.getAllByLabelText(/Remove relationship/);
      fireEvent.click(removeButtons[0]);

      expect(handleRemove).toHaveBeenCalledWith(mockRelationships[0]);
    });

    it('should not show remove button when showRemoveButton is false', async () => {
      render(
        <RelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          showRemoveButton={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      expect(screen.queryByLabelText(/Remove relationship/)).not.toBeInTheDocument();
    });
  });

  describe('Filtering by Relationship Types', () => {
    it('should filter relationships by type', async () => {
      render(
        <RelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          filterTypes={[RelationshipType.TASK_NOTE]}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      // Should only show TASK_NOTE relationship
      expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
      expect(screen.queryByText('Work Session')).not.toBeInTheDocument();
    });

    it('should show multiple types when filterTypes includes them', async () => {
      render(
        <RelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          filterTypes={[RelationshipType.TASK_NOTE, RelationshipType.TASK_TOPIC]}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.queryByText('Work Session')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show "Unknown" for entities that fail to load', async () => {
      mockStorageAdapter.load.mockRejectedValue(new Error('Storage error'));

      render(
        <RelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
      });
    });

    it('should not crash when storage fails', async () => {
      (getStorage as any).mockRejectedValue(new Error('Storage unavailable'));

      expect(() => {
        render(<RelationshipPills entityId="task-1" entityType={EntityType.TASK} />);
      }).not.toThrow();
    });

    it('should handle missing entity gracefully', async () => {
      // Return empty collection (entity not found)
      mockStorageAdapter.load.mockResolvedValue([]);

      render(
        <RelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(
        <RelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      const pill = screen.getByText('Meeting notes').closest('[role="button"]');
      expect(pill).toHaveAttribute('aria-label');
      expect(pill?.getAttribute('aria-label')).toContain('Created from');
    });

    it('should be keyboard accessible (Tab, Enter)', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <RelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          onPillClick={handleClick}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      const pill = screen.getByText('Meeting notes').closest('[role="button"]');

      // Focus with Tab
      pill?.focus();
      expect(pill).toHaveFocus();

      // Activate with Enter
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalled();
    });

    it('should be keyboard accessible with Space key', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <RelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          onPillClick={handleClick}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      const pill = screen.getByText('Meeting notes').closest('[role="button"]');
      pill?.focus();

      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalled();
    });

    it('should have proper focus indicators', async () => {
      render(
        <RelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          onPillClick={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      const pill = screen.getByText('Meeting notes').closest('[role="button"]');
      expect(pill?.className).toContain('focus:ring-2');
    });

    it('should announce screen reader context', async () => {
      render(
        <RelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getByRole('group', { name: 'Related entities' })).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should not re-render when parent re-renders unnecessarily', async () => {
      const { rerender } = render(
        <RelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      const initialCallCount = mockStorageAdapter.load.mock.calls.length;

      // Re-render with same props
      rerender(<RelationshipPills entityId="task-1" entityType={EntityType.TASK} />);

      // Should not fetch again
      expect(mockStorageAdapter.load.mock.calls.length).toBe(initialCallCount);
    });

    it('should handle 50+ relationships without jank', async () => {
      const manyRelationships = Array.from({ length: 60 }, (_, i) => ({
        ...mockRelationships[0],
        id: `rel-${i}`,
        targetId: `note-${i}`,
      }));

      (useRelationships as any).mockReturnValue({
        getRelationships: vi.fn(() => manyRelationships),
      });

      mockStorageAdapter.load.mockResolvedValue({ id: 'note-1', summary: 'Note' });

      const startTime = performance.now();

      render(
        <RelationshipPills entityId="task-1" entityType={EntityType.TASK} maxVisible={10} />
      );

      const endTime = performance.now();

      // Should render in under 100ms (performance budget)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('CompactRelationshipPills Variant', () => {
    it('should render in compact mode with max 3 visible', async () => {
      render(
        <CompactRelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      // Default maxVisible for compact is 3
      const pills = screen.getAllByRole('button');
      expect(pills.length).toBeLessThanOrEqual(3);
    });

    it('should apply compact styles', async () => {
      const { container } = render(
        <CompactRelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      expect(container.querySelector('.compact-relationship-pills')).toBeInTheDocument();
    });
  });

  describe('DetailedRelationshipPills Variant', () => {
    it('should render in detailed mode with max 10 visible by default', async () => {
      const manyRelationships = Array.from({ length: 15 }, (_, i) => ({
        ...mockRelationships[0],
        id: `rel-${i}`,
        targetId: `note-${i}`,
      }));

      (useRelationships as any).mockReturnValue({
        getRelationships: vi.fn(() => manyRelationships),
      });

      render(
        <DetailedRelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      // Should show "+5 more" (15 total - 10 visible)
      expect(screen.getByText(/\+5 more/)).toBeInTheDocument();
    });

    it('should apply detailed styles', async () => {
      const { container } = render(
        <DetailedRelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      expect(container.querySelector('.detailed-relationship-pills')).toBeInTheDocument();
    });
  });

  describe('InlineRelationshipPills Variant', () => {
    it('should render inline with prefix text', async () => {
      render(
        <InlineRelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          prefix="related to"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      expect(screen.getByText('related to')).toBeInTheDocument();
    });

    it('should apply inline styles', async () => {
      const { container } = render(
        <InlineRelationshipPills entityId="task-1" entityType={EntityType.TASK} />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      expect(container.querySelector('.inline-relationship-pills')).toBeInTheDocument();
    });

    it('should never show remove buttons in inline mode', async () => {
      render(
        <InlineRelationshipPills
          entityId="task-1"
          entityType={EntityType.TASK}
          showRemoveButton
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
      });

      expect(screen.queryByLabelText(/Remove relationship/)).not.toBeInTheDocument();
    });
  });

  describe('Helper Functions', () => {
    it('should format relationship metadata correctly', () => {
      const formatted = formatRelationshipMetadata(mockRelationships[1]);

      expect(formatted.source).toBe('ai');
      expect(formatted.confidence).toBe('65%');
      expect(formatted.date).toBeTruthy();
    });

    it('should get relationship pill color with correct opacity', () => {
      const colors = getRelationshipPillColor(mockRelationships[0], 0.5);

      expect(colors.background).toBeTruthy();
      expect(colors.border).toBeTruthy();
      expect(colors.text).toBeTruthy();
    });
  });
});
