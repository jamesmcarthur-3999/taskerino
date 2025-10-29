/**
 * SessionPreview Component Tests
 *
 * Comprehensive test suite for SessionPreview component:
 * - Metadata loading performance (<100ms)
 * - UI rendering and data display
 * - Error handling
 * - User interactions
 *
 * Total Tests: 12
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SessionPreview } from '../sessions/SessionPreview';
import type { SessionMetadata } from '../../services/storage/ChunkedSessionStorage';
import type { SessionSummary } from '../../types';

// Mock ChunkedSessionStorage
vi.mock('../../services/storage/ChunkedSessionStorage', () => ({
  getChunkedStorage: vi.fn(),
}));

describe('SessionPreview', () => {
  const mockMetadata: SessionMetadata = {
    // Core identity
    id: 'session-1',
    name: 'Test Session',
    description: 'A test session for preview mode',

    // Lifecycle
    status: 'completed',
    startTime: '2025-01-15T10:00:00Z',
    endTime: '2025-01-15T12:30:00Z',

    // Configuration
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'transcription',
    audioRecording: false,

    // References
    extractedTaskIds: [],
    extractedNoteIds: [],

    // Chunk manifests
    chunks: {
      screenshots: {
        count: 75,
        chunkCount: 4,
        chunkSize: 20,
      },
      audioSegments: {
        count: 150,
        chunkCount: 2,
        chunkSize: 100,
      },
      videoChunks: {
        count: 0,
        chunkCount: 0,
        chunkSize: 100,
      },
    },

    // Metadata
    tags: ['backend', 'API', 'testing'],
    category: 'Development',
    subCategory: 'API Development',

    // Feature flags
    hasSummary: true,
    hasAudioInsights: false,
    hasCanvasSpec: false,
    hasTranscription: false,
    hasVideo: false,
    hasFullAudio: false,

    // Audio review
    audioReviewCompleted: false,

    // Storage metadata
    storageVersion: 1,
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T12:30:00Z',
  };

  const mockSummary: SessionSummary = {
    narrative: 'Built authentication system with JWT tokens and refresh tokens.',
    achievements: ['Implemented JWT authentication', 'Added refresh token support', 'Wrote unit tests'],
    blockers: ['API key missing from environment', 'Database connection timeout'],
    recommendedTasks: [
      {
        title: 'Add API key to production environment',
        priority: 'high',
        context: 'Required for authentication to work in production',
        relatedScreenshotIds: ['screenshot-1'],
      },
      {
        title: 'Fix database connection pooling',
        priority: 'medium',
        context: 'Reduce timeout errors during high load',
        relatedScreenshotIds: ['screenshot-2'],
      },
    ],
    keyInsights: [
      {
        insight: 'JWT tokens should expire after 15 minutes for security',
        timestamp: '2025-01-15T11:30:00Z',
        screenshotIds: ['screenshot-3'],
      },
      {
        insight: 'Refresh tokens need to be stored in httpOnly cookies',
        timestamp: '2025-01-15T12:00:00Z',
        screenshotIds: ['screenshot-4'],
      },
    ],
    focusAreas: [
      {
        area: 'Authentication',
        duration: 90,
        percentage: 60,
      },
      {
        area: 'Testing',
        duration: 60,
        percentage: 40,
      },
    ],
    lastUpdated: '2025-01-15T12:30:00Z',
    screenshotCount: 75,
  };

  let mockLoadMetadata: ReturnType<typeof vi.fn>;
  let mockLoadSummary: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLoadMetadata = vi.fn();
    mockLoadSummary = vi.fn();

    const { getChunkedStorage } = require('../../services/storage/ChunkedSessionStorage');
    getChunkedStorage.mockResolvedValue({
      loadMetadata: mockLoadMetadata,
      loadSummary: mockLoadSummary,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Test 1: Metadata loads in <100ms
   */
  it('should load metadata in <100ms', async () => {
    mockLoadMetadata.mockResolvedValue(mockMetadata);
    mockLoadSummary.mockResolvedValue(mockSummary);

    const start = performance.now();
    render(<SessionPreview sessionId="session-1" onLoadFull={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  /**
   * Test 2: Displays session name and timestamps
   */
  it('should display session name and timestamps', async () => {
    mockLoadMetadata.mockResolvedValue(mockMetadata);
    mockLoadSummary.mockResolvedValue(mockSummary);

    render(<SessionPreview sessionId="session-1" onLoadFull={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument();
      expect(screen.getByText(/Jan 15, 2025/)).toBeInTheDocument();
      expect(screen.getByText(/2h 30m/)).toBeInTheDocument();
    });
  });

  /**
   * Test 3: Displays category and tags
   */
  it('should display category and tags', async () => {
    mockLoadMetadata.mockResolvedValue(mockMetadata);
    mockLoadSummary.mockResolvedValue(mockSummary);

    render(<SessionPreview sessionId="session-1" onLoadFull={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Development')).toBeInTheDocument();
      expect(screen.getByText('API Development')).toBeInTheDocument();
      expect(screen.getByText('backend')).toBeInTheDocument();
      expect(screen.getByText('API')).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
    });
  });

  /**
   * Test 4: Displays summary if available
   */
  it('should display summary if available', async () => {
    mockLoadMetadata.mockResolvedValue(mockMetadata);
    mockLoadSummary.mockResolvedValue(mockSummary);

    render(<SessionPreview sessionId="session-1" onLoadFull={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Built authentication system/)).toBeInTheDocument();
      expect(screen.getByText(/Implemented JWT authentication/)).toBeInTheDocument();
      expect(screen.getByText(/API key missing from environment/)).toBeInTheDocument();
    });
  });

  /**
   * Test 5: Displays stats (screenshot count, audio segments)
   */
  it('should display stats', async () => {
    mockLoadMetadata.mockResolvedValue(mockMetadata);
    mockLoadSummary.mockResolvedValue(mockSummary);

    render(<SessionPreview sessionId="session-1" onLoadFull={vi.fn()} />);

    await waitFor(() => {
      // Screenshots
      expect(screen.getByText('75')).toBeInTheDocument();

      // Audio segments
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('segments')).toBeInTheDocument();
    });
  });

  /**
   * Test 6: Shows "Load Full Session" button
   */
  it('should show "Load Full Session" button', async () => {
    mockLoadMetadata.mockResolvedValue(mockMetadata);
    mockLoadSummary.mockResolvedValue(mockSummary);

    render(<SessionPreview sessionId="session-1" onLoadFull={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Load Full Session')).toBeInTheDocument();
    });
  });

  /**
   * Test 7: Calls onLoadFull when button clicked
   */
  it('should call onLoadFull when button clicked', async () => {
    mockLoadMetadata.mockResolvedValue(mockMetadata);
    mockLoadSummary.mockResolvedValue(mockSummary);

    const onLoadFull = vi.fn();
    render(<SessionPreview sessionId="session-1" onLoadFull={onLoadFull} />);

    await waitFor(() => {
      expect(screen.getByText('Load Full Session')).toBeInTheDocument();
    });

    const button = screen.getByText('Load Full Session');
    fireEvent.click(button);

    expect(onLoadFull).toHaveBeenCalledTimes(1);
  });

  /**
   * Test 8: Handles missing summary gracefully
   */
  it('should handle missing summary gracefully', async () => {
    mockLoadMetadata.mockResolvedValue({
      ...mockMetadata,
      hasSummary: false,
    });
    mockLoadSummary.mockResolvedValue(null);

    render(<SessionPreview sessionId="session-1" onLoadFull={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    // Summary section should not be present
    expect(screen.queryByText('AI Summary')).not.toBeInTheDocument();
  });

  /**
   * Test 9: Handles missing description gracefully
   */
  it('should handle missing description gracefully', async () => {
    mockLoadMetadata.mockResolvedValue({
      ...mockMetadata,
      description: '',
    });
    mockLoadSummary.mockResolvedValue(mockSummary);

    render(<SessionPreview sessionId="session-1" onLoadFull={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    // Description section should not be present
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
  });

  /**
   * Test 10: Renders skeleton while loading
   */
  it('should render skeleton while loading', () => {
    mockLoadMetadata.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockMetadata), 1000))
    );

    render(<SessionPreview sessionId="session-1" onLoadFull={vi.fn()} />);

    expect(screen.getByText('Loading preview...')).toBeInTheDocument();
  });

  /**
   * Test 11: Handles session not found error
   */
  it('should handle session not found error', async () => {
    mockLoadMetadata.mockResolvedValue(null);

    render(<SessionPreview sessionId="non-existent-session" onLoadFull={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Preview Not Available')).toBeInTheDocument();
      expect(screen.getByText('Session not found')).toBeInTheDocument();
    });
  });

  /**
   * Test 12: Handles loading error
   */
  it('should handle loading error', async () => {
    mockLoadMetadata.mockRejectedValue(new Error('Storage error'));

    render(<SessionPreview sessionId="session-1" onLoadFull={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Preview Not Available')).toBeInTheDocument();
      expect(screen.getByText('Failed to load session preview')).toBeInTheDocument();
    });
  });

  /**
   * Test 13: Shows load time after loading (performance tracking)
   */
  it('should show load time after loading', async () => {
    mockLoadMetadata.mockResolvedValue(mockMetadata);
    mockLoadSummary.mockResolvedValue(mockSummary);

    render(<SessionPreview sessionId="session-1" onLoadFull={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Preview loaded in \d+ms/)).toBeInTheDocument();
    });
  });

  /**
   * Test 14: Displays preview mode badge
   */
  it('should display preview mode badge', async () => {
    mockLoadMetadata.mockResolvedValue(mockMetadata);
    mockLoadSummary.mockResolvedValue(mockSummary);

    render(<SessionPreview sessionId="session-1" onLoadFull={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Preview Mode')).toBeInTheDocument();
    });
  });
});
