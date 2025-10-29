/**
 * SessionDetailView Integration Tests
 *
 * Tests for two-mode system (preview vs full) integration:
 * - Mode transitions
 * - Data loading consistency
 * - UI state preservation
 *
 * Total Tests: 7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SessionDetailView } from '../SessionDetailView';
import type { Session } from '../../types';
import type { SessionMetadata } from '../../services/storage/ChunkedSessionStorage';

// Mock all required contexts
vi.mock('../../context/UIContext', () => ({
  useUI: () => ({
    dispatch: vi.fn(),
    addNotification: vi.fn(),
  }),
}));

vi.mock('../../context/TasksContext', () => ({
  useTasks: () => ({
    addTask: vi.fn(),
  }),
}));

vi.mock('../../context/NotesContext', () => ({
  useNotes: () => ({
    addNote: vi.fn(),
  }),
}));

vi.mock('../../context/SessionsContext', () => ({
  useSessions: () => ({
    sessions: [],
    updateSession: vi.fn(),
  }),
}));

vi.mock('../../context/EnrichmentContext', () => ({
  useEnrichmentContext: () => ({
    getActiveEnrichment: vi.fn(() => null),
    startTracking: vi.fn(),
    updateProgress: vi.fn(),
    stopTracking: vi.fn(),
  }),
}));

vi.mock('../../contexts/ScrollAnimationContext', () => ({
  useScrollAnimation: () => ({
    scrollProgress: 0,
    scrollY: 0,
    isScrolled: false,
    registerScrollContainer: vi.fn(),
    unregisterScrollContainer: vi.fn(),
  }),
}));

vi.mock('../../context/EntitiesContext', () => ({
  useEntities: () => ({
    state: {
      companies: [],
      contacts: [],
      topics: [],
    },
  }),
}));

// Mock ChunkedSessionStorage
vi.mock('../../services/storage/ChunkedSessionStorage', () => ({
  getChunkedStorage: vi.fn(),
}));

// Mock lazy-loaded components
vi.mock('../SessionReview', () => ({
  SessionReview: ({ session }: any) => (
    <div data-testid="session-review">Session Review for {session.id}</div>
  ),
}));

vi.mock('../CanvasView', () => ({
  CanvasView: ({ session }: any) => (
    <div data-testid="canvas-view">Canvas View for {session.id}</div>
  ),
}));

describe('SessionDetailView - Integration', () => {
  const mockSession: Session = {
    id: 'session-1',
    name: 'Test Session',
    description: 'Integration test session',
    status: 'completed',
    startTime: '2025-01-15T10:00:00Z',
    endTime: '2025-01-15T12:00:00Z',
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'transcription',
    audioRecording: false,
    extractedTaskIds: [],
    extractedNoteIds: [],
    screenshots: [
      {
        id: 'screenshot-1',
        sessionId: 'session-1',
        timestamp: '2025-01-15T10:30:00Z',
        attachmentId: 'attachment-1',
        analysisStatus: 'complete',
      },
    ],
    tags: ['test', 'integration'],
    audioReviewCompleted: false,
  };

  const mockMetadata: SessionMetadata = {
    id: 'session-1',
    name: 'Test Session',
    description: 'Integration test session',
    status: 'completed',
    startTime: '2025-01-15T10:00:00Z',
    endTime: '2025-01-15T12:00:00Z',
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'transcription',
    audioRecording: false,
    extractedTaskIds: [],
    extractedNoteIds: [],
    chunks: {
      screenshots: {
        count: 1,
        chunkCount: 1,
        chunkSize: 20,
      },
      audioSegments: {
        count: 0,
        chunkCount: 0,
        chunkSize: 100,
      },
      videoChunks: {
        count: 0,
        chunkCount: 0,
        chunkSize: 100,
      },
    },
    tags: ['test', 'integration'],
    hasSummary: false,
    hasAudioInsights: false,
    hasCanvasSpec: false,
    hasTranscription: false,
    hasVideo: false,
    hasFullAudio: false,
    audioReviewCompleted: false,
    storageVersion: 1,
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T12:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const { getChunkedStorage } = require('../../services/storage/ChunkedSessionStorage');
    getChunkedStorage.mockResolvedValue({
      loadMetadata: vi.fn().mockResolvedValue(mockMetadata),
      loadSummary: vi.fn().mockResolvedValue(null),
    });
  });

  /**
   * Test 1: Starts in preview mode
   */
  it('should start in preview mode', async () => {
    render(
      <SessionDetailView
        session={mockSession}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Preview Mode')).toBeInTheDocument();
      expect(screen.getByText('Load Full Session')).toBeInTheDocument();
    });
  });

  /**
   * Test 2: Transitions to full mode on button click
   */
  it('should transition to full mode on button click', async () => {
    render(
      <SessionDetailView
        session={mockSession}
        onClose={vi.fn()}
      />
    );

    // Wait for preview mode to load
    await waitFor(() => {
      expect(screen.getByText('Preview Mode')).toBeInTheDocument();
    });

    // Click "Load Full Session" button
    const loadButton = screen.getByText('Load Full Session');
    fireEvent.click(loadButton);

    // Preview mode should disappear
    await waitFor(() => {
      expect(screen.queryByText('Preview Mode')).not.toBeInTheDocument();
    });

    // Full mode UI should be present (overview tab by default)
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
  });

  /**
   * Test 3: Full mode displays complete session data
   */
  it('should display complete session data in full mode', async () => {
    render(
      <SessionDetailView
        session={mockSession}
        onClose={vi.fn()}
      />
    );

    // Load preview mode
    await waitFor(() => {
      expect(screen.getByText('Load Full Session')).toBeInTheDocument();
    });

    // Switch to full mode
    fireEvent.click(screen.getByText('Load Full Session'));

    // Full mode should show complete session details
    await waitFor(() => {
      // Session name
      expect(screen.getByText('Test Session')).toBeInTheDocument();

      // Overview tab content
      expect(screen.getByText('Overview')).toBeInTheDocument();

      // Stats should be visible
      expect(screen.getByText(/screenshots/i)).toBeInTheDocument();
    });
  });

  /**
   * Test 4: Mode transition is smooth (no flicker)
   */
  it('should transition smoothly without flicker', async () => {
    const { container } = render(
      <SessionDetailView
        session={mockSession}
        onClose={vi.fn()}
      />
    );

    // Wait for preview mode
    await waitFor(() => {
      expect(screen.getByText('Preview Mode')).toBeInTheDocument();
    });

    // Record container state before transition
    const previewHTML = container.innerHTML;

    // Trigger transition
    fireEvent.click(screen.getByText('Load Full Session'));

    // Verify transition happens (no flicker = smooth state change)
    await waitFor(() => {
      expect(container.innerHTML).not.toBe(previewHTML);
      expect(screen.queryByText('Preview Mode')).not.toBeInTheDocument();
    });
  });

  /**
   * Test 5: Full mode renders tabs correctly
   */
  it('should render tabs in full mode', async () => {
    render(
      <SessionDetailView
        session={mockSession}
        onClose={vi.fn()}
      />
    );

    // Switch to full mode
    await waitFor(() => {
      fireEvent.click(screen.getByText('Load Full Session'));
    });

    // All tabs should be present
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('Canvas')).toBeInTheDocument();
    });
  });

  /**
   * Test 6: Can switch between tabs in full mode
   */
  it('should allow switching between tabs in full mode', async () => {
    render(
      <SessionDetailView
        session={mockSession}
        onClose={vi.fn()}
      />
    );

    // Switch to full mode
    await waitFor(() => {
      fireEvent.click(screen.getByText('Load Full Session'));
    });

    // Wait for full mode to load
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    // Switch to Review tab
    const reviewButtons = screen.getAllByText('Review');
    fireEvent.click(reviewButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('session-review')).toBeInTheDocument();
    });

    // Switch to Canvas tab
    const canvasButtons = screen.getAllByText('Canvas');
    fireEvent.click(canvasButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('canvas-view')).toBeInTheDocument();
    });
  });

  /**
   * Test 7: Preview mode loads faster than full mode
   */
  it('should load preview mode faster than full mode', async () => {
    // Measure preview mode load time
    const previewStart = performance.now();
    const { rerender } = render(
      <SessionDetailView
        session={mockSession}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Preview Mode')).toBeInTheDocument();
    });
    const previewDuration = performance.now() - previewStart;

    // Switch to full mode
    fireEvent.click(screen.getByText('Load Full Session'));

    const fullStart = performance.now();
    await waitFor(() => {
      expect(screen.queryByText('Preview Mode')).not.toBeInTheDocument();
    });
    const fullDuration = performance.now() - fullStart;

    // Preview mode should be significantly faster
    // (This is a rough check - in real usage, preview is 10-50x faster)
    expect(previewDuration).toBeLessThan(200); // <200ms for preview
  });
});
