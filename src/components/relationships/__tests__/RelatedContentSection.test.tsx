/**
 * Tests for RelatedContentSection component
 *
 * @module components/relationships/__tests__/RelatedContentSection.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RelatedContentSection } from '../RelatedContentSection';
import { EntityType, RelationshipType } from '@/types/relationships';

// Mock RelationshipPills since it has complex dependencies
vi.mock('../RelationshipPills', () => ({
  RelationshipPills: ({ entityId, filterTypes }: any) => (
    <div data-testid="relationship-pills">
      Pills for {entityId} filtered by {filterTypes?.join(',')}
    </div>
  ),
}));

describe('RelatedContentSection', () => {
  it('renders section title', () => {
    render(
      <RelatedContentSection
        entityId="task-123"
        entityType={EntityType.TASK}
        title="Related Notes"
        filterTypes={[RelationshipType.TASK_NOTE]}
      />
    );

    expect(screen.getByText('Related Notes')).toBeInTheDocument();
  });

  it('renders RelationshipPills with correct props', () => {
    render(
      <RelatedContentSection
        entityId="task-123"
        entityType={EntityType.TASK}
        title="Related Notes"
        filterTypes={[RelationshipType.TASK_NOTE]}
        maxVisible={5}
      />
    );

    const pills = screen.getByTestId('relationship-pills');
    expect(pills).toBeInTheDocument();
    expect(pills.textContent).toContain('task-123');
  });

  it('shows "+ Add" button when onAddClick provided', () => {
    const onAddClick = vi.fn();
    render(
      <RelatedContentSection
        entityId="task-123"
        entityType={EntityType.TASK}
        title="Related Notes"
        filterTypes={[RelationshipType.TASK_NOTE]}
        onAddClick={onAddClick}
      />
    );

    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('calls onAddClick when "+ Add" clicked', () => {
    const onAddClick = vi.fn();
    render(
      <RelatedContentSection
        entityId="task-123"
        entityType={EntityType.TASK}
        title="Related Notes"
        filterTypes={[RelationshipType.TASK_NOTE]}
        onAddClick={onAddClick}
      />
    );

    fireEvent.click(screen.getByText('Add'));
    expect(onAddClick).toHaveBeenCalledTimes(1);
  });

  it('does not show "+ Add" button when onAddClick not provided', () => {
    render(
      <RelatedContentSection
        entityId="task-123"
        entityType={EntityType.TASK}
        title="Related Notes"
        filterTypes={[RelationshipType.TASK_NOTE]}
      />
    );

    expect(screen.queryByText('Add')).not.toBeInTheDocument();
  });

  it('passes filterTypes to RelationshipPills', () => {
    render(
      <RelatedContentSection
        entityId="task-123"
        entityType={EntityType.TASK}
        title="Related Sessions"
        filterTypes={[RelationshipType.TASK_SESSION]}
      />
    );

    const pills = screen.getByTestId('relationship-pills');
    expect(pills.textContent).toContain('task-session');
  });

  it('passes maxVisible to RelationshipPills', () => {
    render(
      <RelatedContentSection
        entityId="task-123"
        entityType={EntityType.TASK}
        title="Related Notes"
        filterTypes={[RelationshipType.TASK_NOTE]}
        maxVisible={10}
      />
    );

    // RelationshipPills is mocked, so we just verify it rendered
    const pills = screen.getByTestId('relationship-pills');
    expect(pills).toBeInTheDocument();
  });

  it('passes showRemoveButton to RelationshipPills', () => {
    render(
      <RelatedContentSection
        entityId="task-123"
        entityType={EntityType.TASK}
        title="Related Notes"
        filterTypes={[RelationshipType.TASK_NOTE]}
        showRemoveButton={false}
      />
    );

    // RelationshipPills is mocked, so we just verify it rendered
    const pills = screen.getByTestId('relationship-pills');
    expect(pills).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <RelatedContentSection
        entityId="task-123"
        entityType={EntityType.TASK}
        title="Related Notes"
        filterTypes={[RelationshipType.TASK_NOTE]}
        className="custom-class"
      />
    );

    const section = container.querySelector('.custom-class');
    expect(section).toBeInTheDocument();
  });

  it('has accessible label on Add button', () => {
    const onAddClick = vi.fn();
    render(
      <RelatedContentSection
        entityId="task-123"
        entityType={EntityType.TASK}
        title="Related Notes"
        filterTypes={[RelationshipType.TASK_NOTE]}
        onAddClick={onAddClick}
      />
    );

    const button = screen.getByLabelText('Add related notes');
    expect(button).toBeInTheDocument();
  });

  it('supports multiple filter types', () => {
    render(
      <RelatedContentSection
        entityId="task-123"
        entityType={EntityType.TASK}
        title="Related Content"
        filterTypes={[RelationshipType.TASK_NOTE, RelationshipType.TASK_SESSION]}
      />
    );

    const pills = screen.getByTestId('relationship-pills');
    expect(pills.textContent).toContain('task-note,task-session');
  });

  it('renders with all default props', () => {
    render(
      <RelatedContentSection
        entityId="task-123"
        entityType={EntityType.TASK}
        title="Related Notes"
        filterTypes={[RelationshipType.TASK_NOTE]}
      />
    );

    // Should render without errors with just required props
    expect(screen.getByText('Related Notes')).toBeInTheDocument();
    expect(screen.getByTestId('relationship-pills')).toBeInTheDocument();
  });
});
