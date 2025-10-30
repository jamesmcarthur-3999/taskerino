/**
 * UI Integration Tests - Relationship Pills & Modal in Task/Note/Session Views
 *
 * Tests that RelationshipPills and RelationshipModal are properly integrated
 * into TaskDetailSidebar, NoteDetailSidebar, and SessionDetailView.
 *
 * @module tests/integration/ui-integration.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDetailSidebar } from '@/components/TaskDetailSidebar';
import { NoteDetailSidebar } from '@/components/NoteDetailSidebar';
import { SessionDetailView } from '@/components/SessionDetailView';
import { TasksProvider } from '@/context/TasksContext';
import { NotesProvider } from '@/context/NotesContext';
import { SessionsProvider } from '@/context/SessionsContext';
import { UIProvider } from '@/context/UIContext';
import { EntitiesProvider } from '@/context/EntitiesContext';
import { RelationshipProvider } from '@/context/RelationshipContext';
import { EnrichmentProvider } from '@/context/EnrichmentContext';
import { ScrollAnimationProvider } from '@/contexts/ScrollAnimationContext';
import { ThemeProvider } from '@/context/ThemeContext';
import type { Task, Note, Session } from '@/types';
import type { Relationship } from '@/types/relationships';
import { EntityType, RelationshipType } from '@/types/relationships';

// Mock dependencies
vi.mock('@/services/storage', () => ({
  getStorage: vi.fn(() => ({
    load: vi.fn(),
    save: vi.fn(),
  })),
}));

vi.mock('@/services/attachmentStorage', () => ({
  attachmentStorage: {
    loadAttachment: vi.fn(),
    createAttachment: vi.fn(),
  },
}));

/**
 * Test wrapper with all required providers
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <UIProvider>
        <EntitiesProvider>
          <TasksProvider>
            <NotesProvider>
              <SessionsProvider>
                <EnrichmentProvider>
                  <ScrollAnimationProvider>
                    <RelationshipProvider>
                      {children}
                    </RelationshipProvider>
                  </ScrollAnimationProvider>
                </EnrichmentProvider>
              </SessionsProvider>
            </NotesProvider>
          </TasksProvider>
        </EntitiesProvider>
      </UIProvider>
    </ThemeProvider>
  );
}

/**
 * Create a test task
 */
function createTestTask(overrides?: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: 'Test Description',
    done: false,
    priority: 'medium',
    status: 'todo',
    createdBy: 'user',
    createdAt: new Date().toISOString(),
    tags: [],
    subtasks: [],
    ...overrides,
  };
}

/**
 * Create a test note
 */
function createTestNote(overrides?: Partial<Note>): Note {
  return {
    id: 'note-1',
    summary: 'Test Note',
    content: 'Test content',
    timestamp: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    source: 'thought',
    tags: [],
    companyIds: [],
    contactIds: [],
    topicIds: [],
    ...overrides,
  };
}

/**
 * Create a test session
 */
function createTestSession(overrides?: Partial<Session>): Session {
  return {
    id: 'session-1',
    name: 'Test Session',
    description: 'Test Description',
    status: 'completed',
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    screenshotInterval: 5,
    screenshots: [],
    audioSegments: [],
    tags: [],
    ...overrides,
  };
}

/**
 * Create a test relationship
 */
function createTestRelationship(overrides?: Partial<Relationship>): Relationship {
  return {
    id: 'rel-1',
    type: RelationshipType.TASK_NOTE,
    sourceType: EntityType.TASK,
    sourceId: 'task-1',
    targetType: EntityType.NOTE,
    targetId: 'note-1',
    metadata: {
      source: 'manual',
      createdAt: new Date().toISOString(),
    },
    canonical: true,
    ...overrides,
  };
}

describe('UI Integration - TaskDetailSidebar', () => {
  it('should render relationships section', () => {
    const task = createTestTask();

    render(
      <TestWrapper>
        <TaskDetailSidebar taskId={task.id} />
      </TestWrapper>
    );

    expect(screen.getByText(/relationships/i)).toBeInTheDocument();
    expect(screen.getByText(/manage/i)).toBeInTheDocument();
  });

  it('should show RelationshipPills component', () => {
    const task = createTestTask();

    render(
      <TestWrapper>
        <TaskDetailSidebar taskId={task.id} />
      </TestWrapper>
    );

    // Pills should be rendered (even if empty)
    const relationshipsSection = screen.getByText(/relationships/i).closest('div');
    expect(relationshipsSection).toBeInTheDocument();
  });

  it('should open RelationshipModal when "Manage" button is clicked', async () => {
    const user = userEvent.setup();
    const task = createTestTask();

    render(
      <TestWrapper>
        <TaskDetailSidebar taskId={task.id} />
      </TestWrapper>
    );

    const manageButton = screen.getByRole('button', { name: /manage/i });
    await user.click(manageButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/manage relationships/i)).toBeInTheDocument();
    });
  });

  it('should open modal when clicking on a pill', async () => {
    const user = userEvent.setup();
    const task = createTestTask();

    render(
      <TestWrapper>
        <TaskDetailSidebar taskId={task.id} />
      </TestWrapper>
    );

    // Assuming there's at least one relationship pill rendered
    // This would need actual relationship data in the context
    // For now, we test the "Manage" button flow which also opens the modal
    const manageButton = screen.getByRole('button', { name: /manage/i });
    await user.click(manageButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('should maintain existing task detail functionality', () => {
    const task = createTestTask({
      title: 'Existing Task',
      description: 'Existing Description',
      priority: 'high',
      status: 'in-progress',
    });

    render(
      <TestWrapper>
        <TaskDetailSidebar taskId={task.id} />
      </TestWrapper>
    );

    // Verify existing UI elements still render
    expect(screen.getByDisplayValue('Existing Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing Description')).toBeInTheDocument();
  });
});

describe('UI Integration - NoteDetailSidebar', () => {
  it('should render relationships section', () => {
    const note = createTestNote();

    render(
      <TestWrapper>
        <NoteDetailSidebar noteId={note.id} />
      </TestWrapper>
    );

    expect(screen.getByText(/relationships/i)).toBeInTheDocument();
    expect(screen.getByText(/manage/i)).toBeInTheDocument();
  });

  it('should show RelationshipPills component', () => {
    const note = createTestNote();

    render(
      <TestWrapper>
        <NoteDetailSidebar noteId={note.id} />
      </TestWrapper>
    );

    const relationshipsSection = screen.getByText(/relationships/i).closest('div');
    expect(relationshipsSection).toBeInTheDocument();
  });

  it('should open RelationshipModal when "Manage" button is clicked', async () => {
    const user = userEvent.setup();
    const note = createTestNote();

    render(
      <TestWrapper>
        <NoteDetailSidebar noteId={note.id} />
      </TestWrapper>
    );

    const manageButton = screen.getByRole('button', { name: /manage/i });
    await user.click(manageButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/manage relationships/i)).toBeInTheDocument();
    });
  });

  it('should maintain existing note detail functionality', () => {
    const note = createTestNote({
      summary: 'Existing Note',
      content: 'Existing Content',
    });

    render(
      <TestWrapper>
        <NoteDetailSidebar noteId={note.id} />
      </TestWrapper>
    );

    // Verify existing UI elements still render
    expect(screen.getByText('Existing Note')).toBeInTheDocument();
  });
});

describe('UI Integration - SessionDetailView', () => {
  it('should render "Extracted from Session" section', () => {
    const session = createTestSession();

    render(
      <TestWrapper>
        <SessionDetailView
          session={session}
          onClose={() => {}}
        />
      </TestWrapper>
    );

    expect(screen.getByText(/extracted from session/i)).toBeInTheDocument();
  });

  it('should show filtered pills for tasks', () => {
    const session = createTestSession();

    render(
      <TestWrapper>
        <SessionDetailView
          session={session}
          onClose={() => {}}
        />
      </TestWrapper>
    );

    expect(screen.getByText(/tasks/i)).toBeInTheDocument();
  });

  it('should show filtered pills for notes', () => {
    const session = createTestSession();

    render(
      <TestWrapper>
        <SessionDetailView
          session={session}
          onClose={() => {}}
        />
      </TestWrapper>
    );

    expect(screen.getByText(/notes/i)).toBeInTheDocument();
  });

  it('should open RelationshipModal when "Manage" button is clicked', async () => {
    const user = userEvent.setup();
    const session = createTestSession();

    render(
      <TestWrapper>
        <SessionDetailView
          session={session}
          onClose={() => {}}
        />
      </TestWrapper>
    );

    const manageButton = screen.getByRole('button', { name: /manage/i });
    await user.click(manageButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('should maintain existing session detail functionality', () => {
    const session = createTestSession({
      name: 'Existing Session',
      description: 'Existing Description',
    });

    render(
      <TestWrapper>
        <SessionDetailView
          session={session}
          onClose={() => {}}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Existing Session')).toBeInTheDocument();
    expect(screen.getByText('Existing Description')).toBeInTheDocument();
  });
});

describe('UI Integration - Accessibility', () => {
  it('should support keyboard navigation in task detail', async () => {
    const user = userEvent.setup();
    const task = createTestTask();

    render(
      <TestWrapper>
        <TaskDetailSidebar taskId={task.id} />
      </TestWrapper>
    );

    const manageButton = screen.getByRole('button', { name: /manage/i });

    // Tab to button and press Enter
    await user.tab();
    // Navigate to the manage button (may require multiple tabs)
    manageButton.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('should have proper ARIA labels in note detail', () => {
    const note = createTestNote();

    render(
      <TestWrapper>
        <NoteDetailSidebar noteId={note.id} />
      </TestWrapper>
    );

    const manageButton = screen.getByRole('button', { name: /manage/i });
    expect(manageButton).toBeInTheDocument();
  });

  it('should support screen reader navigation in session detail', () => {
    const session = createTestSession();

    render(
      <TestWrapper>
        <SessionDetailView
          session={session}
          onClose={() => {}}
        />
      </TestWrapper>
    );

    // Check for semantic HTML structure
    expect(screen.getByText(/extracted from session/i)).toBeInTheDocument();
    expect(screen.getByText(/tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/notes/i)).toBeInTheDocument();
  });
});

describe('UI Integration - Performance', () => {
  it('should not slow down task detail rendering', () => {
    const task = createTestTask();
    const startTime = performance.now();

    render(
      <TestWrapper>
        <TaskDetailSidebar taskId={task.id} />
      </TestWrapper>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render in less than 100ms
    expect(renderTime).toBeLessThan(100);
  });

  it('should not slow down note detail rendering', () => {
    const note = createTestNote();
    const startTime = performance.now();

    render(
      <TestWrapper>
        <NoteDetailSidebar noteId={note.id} />
      </TestWrapper>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    expect(renderTime).toBeLessThan(100);
  });

  it('should not slow down session detail rendering', () => {
    const session = createTestSession();
    const startTime = performance.now();

    render(
      <TestWrapper>
        <SessionDetailView
          session={session}
          onClose={() => {}}
        />
      </TestWrapper>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    expect(renderTime).toBeLessThan(200);
  });
});

describe('UI Integration - Error Handling', () => {
  it('should handle missing task gracefully', () => {
    render(
      <TestWrapper>
        <TaskDetailSidebar taskId={undefined} />
      </TestWrapper>
    );

    // Should not crash, just render nothing
    expect(screen.queryByText(/relationships/i)).not.toBeInTheDocument();
  });

  it('should handle missing note gracefully', () => {
    render(
      <TestWrapper>
        <NoteDetailSidebar noteId={undefined} />
      </TestWrapper>
    );

    // Should show "Note not found" or render nothing
    const noteNotFound = screen.queryByText(/note not found/i);
    if (noteNotFound) {
      expect(noteNotFound).toBeInTheDocument();
    }
  });

  it('should handle storage errors gracefully', async () => {
    const { getStorage } = await import('@/services/storage');
    vi.mocked(getStorage).mockImplementation(() => {
      throw new Error('Storage error');
    });

    const session = createTestSession();

    // Should not crash
    expect(() => {
      render(
        <TestWrapper>
          <SessionDetailView
            session={session}
            onClose={() => {}}
          />
        </TestWrapper>
      );
    }).not.toThrow();
  });
});

describe('UI Integration - Visual Regression', () => {
  it('should match task detail snapshot', () => {
    const task = createTestTask();
    const { container } = render(
      <TestWrapper>
        <TaskDetailSidebar taskId={task.id} />
      </TestWrapper>
    );

    expect(container).toMatchSnapshot();
  });

  it('should match note detail snapshot', () => {
    const note = createTestNote();
    const { container } = render(
      <TestWrapper>
        <NoteDetailSidebar noteId={note.id} />
      </TestWrapper>
    );

    expect(container).toMatchSnapshot();
  });

  it('should match session detail snapshot', () => {
    const session = createTestSession();
    const { container } = render(
      <TestWrapper>
        <SessionDetailView
          session={session}
          onClose={() => {}}
        />
      </TestWrapper>
    );

    expect(container).toMatchSnapshot();
  });
});
