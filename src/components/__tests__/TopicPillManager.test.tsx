import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopicPillManager } from '../TopicPillManager';
import type { Topic } from '../../types';

const mockTopics: Topic[] = [
  { id: 'topic-1', name: 'Engineering', noteCount: 5, createdAt: '2024-01-01', lastUpdated: '2024-01-01' },
  { id: 'topic-2', name: 'Design', noteCount: 3, createdAt: '2024-01-01', lastUpdated: '2024-01-01' },
  { id: 'topic-3', name: 'Product', noteCount: 8, createdAt: '2024-01-01', lastUpdated: '2024-01-01' },
];

describe('TopicPillManager', () => {
  it('renders empty state when no topic selected', () => {
    render(
      <TopicPillManager
        topicId={undefined}
        onTopicChange={vi.fn()}
        allTopics={mockTopics}
        editable={true}
      />
    );

    expect(screen.getByText('Add topic')).toBeInTheDocument();
  });

  it('renders selected topic', () => {
    render(
      <TopicPillManager
        topicId="topic-1"
        onTopicChange={vi.fn()}
        allTopics={mockTopics}
        editable={true}
      />
    );

    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('opens dropdown on click when editable', () => {
    render(
      <TopicPillManager
        topicId={undefined}
        onTopicChange={vi.fn()}
        allTopics={mockTopics}
        editable={true}
      />
    );

    fireEvent.click(screen.getByText('Add topic'));
    expect(screen.getByPlaceholderText('Search topics...')).toBeInTheDocument();
  });

  it('calls onTopicChange when topic selected', () => {
    const onTopicChange = vi.fn();
    render(
      <TopicPillManager
        topicId={undefined}
        onTopicChange={onTopicChange}
        allTopics={mockTopics}
        editable={true}
      />
    );

    fireEvent.click(screen.getByText('Add topic'));
    fireEvent.click(screen.getByText('Engineering'));

    expect(onTopicChange).toHaveBeenCalledWith('topic-1');
  });

  it('filters topics by search query', () => {
    render(
      <TopicPillManager
        topicId={undefined}
        onTopicChange={vi.fn()}
        allTopics={mockTopics}
        editable={true}
      />
    );

    fireEvent.click(screen.getByText('Add topic'));
    const searchInput = screen.getByPlaceholderText('Search topics...');
    fireEvent.change(searchInput, { target: { value: 'eng' } });

    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.queryByText('Design')).not.toBeInTheDocument();
  });

  it('does not open dropdown when not editable', () => {
    render(
      <TopicPillManager
        topicId="topic-1"
        onTopicChange={vi.fn()}
        allTopics={mockTopics}
        editable={false}
      />
    );

    fireEvent.click(screen.getByText('Engineering'));
    expect(screen.queryByPlaceholderText('Search topics...')).not.toBeInTheDocument();
  });

  it('closes dropdown on escape key', () => {
    render(
      <TopicPillManager
        topicId={undefined}
        onTopicChange={vi.fn()}
        allTopics={mockTopics}
        editable={true}
      />
    );

    fireEvent.click(screen.getByText('Add topic'));
    const searchInput = screen.getByPlaceholderText('Search topics...');
    expect(searchInput).toBeInTheDocument();

    fireEvent.keyDown(searchInput, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Search topics...')).not.toBeInTheDocument();
  });

  it('shows note count for topics with notes', () => {
    render(
      <TopicPillManager
        topicId={undefined}
        onTopicChange={vi.fn()}
        allTopics={mockTopics}
        editable={true}
      />
    );

    fireEvent.click(screen.getByText('Add topic'));
    expect(screen.getByText('(5 notes)')).toBeInTheDocument();
    expect(screen.getByText('(3 notes)')).toBeInTheDocument();
  });

  it('calls onTopicChange with undefined when removing topic', () => {
    const onTopicChange = vi.fn();
    render(
      <TopicPillManager
        topicId="topic-1"
        onTopicChange={onTopicChange}
        allTopics={mockTopics}
        editable={true}
      />
    );

    const pillContainer = screen.getByText('Engineering').closest('.group');
    expect(pillContainer).toBeInTheDocument();

    // Hover to show remove button
    if (pillContainer) {
      fireEvent.mouseEnter(pillContainer);
    }

    const removeButton = screen.getByLabelText('Remove topic');
    fireEvent.click(removeButton);

    expect(onTopicChange).toHaveBeenCalledWith(undefined);
  });

  it('shows "No topics found" when search has no results', () => {
    render(
      <TopicPillManager
        topicId={undefined}
        onTopicChange={vi.fn()}
        allTopics={mockTopics}
        editable={true}
      />
    );

    fireEvent.click(screen.getByText('Add topic'));
    const searchInput = screen.getByPlaceholderText('Search topics...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('No topics found')).toBeInTheDocument();
  });

  it('highlights selected topic in dropdown', () => {
    render(
      <TopicPillManager
        topicId="topic-2"
        onTopicChange={vi.fn()}
        allTopics={mockTopics}
        editable={true}
      />
    );

    fireEvent.click(screen.getByText('Design'));

    // Find the button with the selected topic
    const buttons = screen.getAllByRole('option');
    const designButton = buttons.find(btn => btn.textContent?.includes('Design'));
    expect(designButton).toHaveClass('bg-amber-100');
    expect(designButton).toHaveClass('font-semibold');
  });
});
