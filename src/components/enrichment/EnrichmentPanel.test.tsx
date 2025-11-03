/**
 * EnrichmentPanel Tests
 *
 * Comprehensive test suite for EnrichmentPanel component
 * Coverage target: >80%
 *
 * Test areas:
 * - Job list rendering with all statuses
 * - Progress updates and animations
 * - Job actions (cancel, retry, view)
 * - Auto-refresh and event subscription
 * - Error handling
 * - Empty states
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EnrichmentPanel } from './EnrichmentPanel';
import type {
  EnrichmentJob,
  QueueStatus,
  PersistentEnrichmentQueue,
} from '../../services/enrichment/PersistentEnrichmentQueue';
import type { BackgroundEnrichmentManager } from '../../services/enrichment/BackgroundEnrichmentManager';

// ============================================================================
// Mocks
// ============================================================================

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: (timestamp: number) => '2 minutes ago',
}));

// Mock design system
vi.mock('../../design-system/theme', () => ({
  getGlassClasses: () => 'glass-mock',
  getRadiusClass: () => 'radius-mock',
  SHADOWS: {
    elevated: 'shadow-mock',
  },
}));

// Mock queue and manager
let mockQueue: Partial<PersistentEnrichmentQueue>;
let mockManager: Partial<BackgroundEnrichmentManager>;
let eventListeners: Map<string, Set<(...args: any[]) => void>>;

// Mock the manager getter function
const getBackgroundEnrichmentManager = () => mockManager;

vi.mock('../../services/enrichment/BackgroundEnrichmentManager', () => ({
  getBackgroundEnrichmentManager: () => mockManager,
}));

// ============================================================================
// Test Data
// ============================================================================

const createMockJob = (overrides: Partial<EnrichmentJob> = {}): EnrichmentJob => ({
  id: 'job-1',
  sessionId: 'session-1',
  sessionName: 'Test Session',
  status: 'processing',
  priority: 'normal',
  progress: 50,
  stage: 'audio',
  options: {},
  createdAt: Date.now() - 60000, // 1 minute ago
  lastUpdated: Date.now(),
  attempts: 0,
  maxAttempts: 3,
  ...overrides,
});

const createMockStatus = (overrides: Partial<QueueStatus> = {}): QueueStatus => ({
  pending: 1,
  processing: 2,
  completed: 3,
  failed: 1,
  cancelled: 0,
  total: 7,
  byPriority: {
    high: 0,
    normal: 1,
    low: 0,
  },
  ...overrides,
});

// ============================================================================
// Setup & Teardown
// ============================================================================

beforeEach(() => {
  eventListeners = new Map();

  // Mock queue with event system
  mockQueue = {
    getAllJobs: vi.fn(),
    on: vi.fn((event: string, listener: (...args: any[]) => void) => {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set());
      }
      eventListeners.get(event)!.add(listener);
    }),
    off: vi.fn((event: string, listener: (...args: any[]) => void) => {
      const listeners = eventListeners.get(event);
      if (listeners) {
        listeners.delete(listener);
      }
    }),
  };

  // Mock manager
  mockManager = {
    getQueue: vi.fn(() => mockQueue as PersistentEnrichmentQueue),
    getQueueStatus: vi.fn(),
    cancelEnrichment: vi.fn(),
    retryEnrichment: vi.fn(),
  };

  // Don't use fake timers by default - only in specific auto-refresh tests
  // vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

// ============================================================================
// Helper Functions
// ============================================================================

const emitQueueEvent = (event: string, ...args: any[]) => {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach(listener => listener(...args));
  }
};

// ============================================================================
// Tests
// ============================================================================

describe('EnrichmentPanel', () => {
  // ========================================
  // Rendering Tests
  // ========================================

  describe('Rendering', () => {
    it('should render loading state initially', async () => {
      (mockQueue.getAllJobs as any).mockResolvedValue([]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      render(<EnrichmentPanel onClose={vi.fn()} />);

      // Find spinner by className instead of role
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('No enrichment jobs')).toBeInTheDocument();
      });
    });

    it('should render empty state when no jobs', async () => {
      (mockQueue.getAllJobs as any).mockResolvedValue([]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0,
      }));

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('No enrichment jobs')).toBeInTheDocument();
      });
    });

    it('should render error state on fetch failure', async () => {
      (mockQueue.getAllJobs as any).mockRejectedValue(new Error('Failed to fetch'));

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch/i)).toBeInTheDocument();
      });
    });

    it('should render job list with correct sections', async () => {
      const jobs = [
        createMockJob({ status: 'processing', sessionName: 'Processing Job' }),
        createMockJob({ status: 'pending', sessionName: 'Pending Job', id: 'job-2', sessionId: 'session-2' }),
        createMockJob({ status: 'completed', sessionName: 'Completed Job', id: 'job-3', sessionId: 'session-3', completedAt: Date.now() }),
        createMockJob({ status: 'failed', sessionName: 'Failed Job', id: 'job-4', sessionId: 'session-4', error: 'Test error' }),
      ];

      (mockQueue.getAllJobs as any).mockResolvedValue(jobs);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Processing (1)')).toBeInTheDocument();
        expect(screen.getByText('Pending (1)')).toBeInTheDocument();
        expect(screen.getByText('Failed (1)')).toBeInTheDocument();
        expect(screen.getByText('Recently Completed (1)')).toBeInTheDocument();
      });
    });

    it('should display queue status in header', async () => {
      (mockQueue.getAllJobs as any).mockResolvedValue([]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus({
        processing: 2,
        pending: 3,
        completed: 5,
        failed: 1,
      }));

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('2 active, 3 pending, 5 completed, 1 failed')).toBeInTheDocument();
      });
    });
  });

  // ========================================
  // Job Item Rendering Tests
  // ========================================

  describe('Job Item Rendering', () => {
    it('should render processing job with progress bar', async () => {
      const job = createMockJob({
        status: 'processing',
        sessionName: 'Processing Job',
        progress: 75,
        stage: 'audio',
      });

      (mockQueue.getAllJobs as any).mockResolvedValue([job]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Processing Job')).toBeInTheDocument();
        expect(screen.getByText('Audio Review')).toBeInTheDocument();
        expect(screen.getByText('75%')).toBeInTheDocument();
      });
    });

    it('should render pending job with stage', async () => {
      const job = createMockJob({
        status: 'pending',
        sessionName: 'Pending Job',
        stage: undefined,
      });

      (mockQueue.getAllJobs as any).mockResolvedValue([job]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Pending Job')).toBeInTheDocument();
        expect(screen.getByText('Waiting...')).toBeInTheDocument();
      });
    });

    it('should render failed job with error message', async () => {
      const job = createMockJob({
        status: 'failed',
        sessionName: 'Failed Job',
        error: 'Session enrichment failed',
        attempts: 2,
      });

      (mockQueue.getAllJobs as any).mockResolvedValue([job]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Failed Job')).toBeInTheDocument();
        expect(screen.getByText('Session enrichment failed')).toBeInTheDocument();
        expect(screen.getByText('Retried 2 times')).toBeInTheDocument();
      });
    });

    it('should render completed job with timestamp', async () => {
      const job = createMockJob({
        status: 'completed',
        sessionName: 'Completed Job',
        completedAt: Date.now() - 120000, // 2 minutes ago
        progress: 100,
      });

      (mockQueue.getAllJobs as any).mockResolvedValue([job]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Completed Job')).toBeInTheDocument();
        expect(screen.getByText('2 minutes ago')).toBeInTheDocument();
      });
    });

    it('should show high priority badge', async () => {
      const job = createMockJob({
        priority: 'high',
        sessionName: 'High Priority Job',
      });

      (mockQueue.getAllJobs as any).mockResolvedValue([job]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('High')).toBeInTheDocument();
      });
    });
  });

  // ========================================
  // Job Actions Tests
  // ========================================

  describe('Job Actions', () => {
    it('should call cancelEnrichment when cancel button clicked', async () => {
      const job = createMockJob({
        status: 'pending',
        sessionName: 'Cancellable Job',
      });

      (mockQueue.getAllJobs as any).mockResolvedValue([job]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());
      (mockManager.cancelEnrichment as any).mockResolvedValue(undefined);

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Cancellable Job')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockManager.cancelEnrichment).toHaveBeenCalledWith('session-1');
      });
    });

    it('should disable cancel button for processing jobs', async () => {
      const job = createMockJob({
        status: 'processing',
        sessionName: 'Processing Job',
      });

      (mockQueue.getAllJobs as any).mockResolvedValue([job]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        expect(cancelButton).toBeDisabled();
      });
    });

    it('should call retryEnrichment when retry button clicked', async () => {
      const job = createMockJob({
        status: 'failed',
        sessionName: 'Failed Job',
        error: 'Test error',
      });

      (mockQueue.getAllJobs as any).mockResolvedValue([job]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());
      (mockManager.retryEnrichment as any).mockResolvedValue(undefined);

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Failed Job')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockManager.retryEnrichment).toHaveBeenCalledWith('session-1');
      });
    });

    it('should emit view-session event and close panel when view button clicked', async () => {
      const job = createMockJob({
        sessionName: 'View Job',
      });

      (mockQueue.getAllJobs as any).mockResolvedValue([job]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      const onClose = vi.fn();
      const eventListener = vi.fn();
      window.addEventListener('view-session', eventListener);

      render(<EnrichmentPanel onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('View Job')).toBeInTheDocument();
      });

      const viewButton = screen.getByText('View Session');
      fireEvent.click(viewButton);

      expect(onClose).toHaveBeenCalled();
      expect(eventListener).toHaveBeenCalled();

      window.removeEventListener('view-session', eventListener);
    });

    it('should handle action errors gracefully', async () => {
      const job = createMockJob({
        status: 'pending',
        sessionName: 'Error Job',
      });

      (mockQueue.getAllJobs as any).mockResolvedValue([job]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());
      (mockManager.cancelEnrichment as any).mockRejectedValue(new Error('Cancel failed'));

      // Mock alert
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Error Job')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Failed to cancel job: Cancel failed');
      });

      alertSpy.mockRestore();
    });
  });

  // ========================================
  // Auto-Refresh Tests
  // ========================================

  describe('Auto-Refresh', () => {
    it('should refresh data every 2 seconds', async () => {
      // Use fake timers for this test
      vi.useFakeTimers();

      const jobs = [createMockJob()];

      (mockQueue.getAllJobs as any).mockResolvedValue(jobs);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      render(<EnrichmentPanel onClose={vi.fn()} />);

      // Wait for initial fetch to be called
      await vi.waitFor(() => {
        expect(mockQueue.getAllJobs).toHaveBeenCalledTimes(1);
      });

      // Advance timer by 2 seconds (should trigger second fetch)
      await vi.advanceTimersByTimeAsync(2000);

      await vi.waitFor(() => {
        expect(mockQueue.getAllJobs).toHaveBeenCalledTimes(2);
      });

      // Advance timer by another 2 seconds
      await vi.advanceTimersByTimeAsync(2000);

      await vi.waitFor(() => {
        expect(mockQueue.getAllJobs).toHaveBeenCalledTimes(3);
      });

      vi.useRealTimers();
    });

    it('should cleanup interval on unmount', async () => {
      // Use fake timers for this test
      vi.useFakeTimers();

      const jobs = [createMockJob()];

      (mockQueue.getAllJobs as any).mockResolvedValue(jobs);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      const { unmount } = render(<EnrichmentPanel onClose={vi.fn()} />);

      // Wait for initial fetch
      await vi.waitFor(() => {
        expect(mockQueue.getAllJobs).toHaveBeenCalled();
      });

      const callCount = (mockQueue.getAllJobs as any).mock.calls.length;

      unmount();

      // Advance timer - should not trigger new fetch after unmount
      await vi.advanceTimersByTimeAsync(2000);

      // Should not call again after unmount
      expect(mockQueue.getAllJobs).toHaveBeenCalledTimes(callCount);

      vi.useRealTimers();
    });
  });

  // ========================================
  // Event Subscription Tests
  // ========================================

  describe('Event Subscription', () => {
    it('should subscribe to all queue events', async () => {
      (mockQueue.getAllJobs as any).mockResolvedValue([]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      render(<EnrichmentPanel onClose={vi.fn()} />);

      // Wait for data to load first
      await waitFor(() => {
        expect(mockQueue.getAllJobs).toHaveBeenCalled();
      });

      // Check event subscriptions
      expect(mockQueue.on).toHaveBeenCalledWith('job-enqueued', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('job-started', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('job-progress', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('job-completed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('job-failed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('job-cancelled', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('job-retry', expect.any(Function));
    });

    it('should refresh data when job-progress event fires', async () => {
      (mockQueue.getAllJobs as any).mockResolvedValue([createMockJob()]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(mockQueue.getAllJobs).toHaveBeenCalledTimes(1);
      });

      // Emit job-progress event
      emitQueueEvent('job-progress', createMockJob());

      await waitFor(() => {
        expect(mockQueue.getAllJobs).toHaveBeenCalledTimes(2);
      });
    });

    it('should unsubscribe from events on unmount', async () => {
      (mockQueue.getAllJobs as any).mockResolvedValue([]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      const { unmount } = render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(mockQueue.on).toHaveBeenCalled();
      });

      unmount();

      expect(mockQueue.off).toHaveBeenCalledWith('job-enqueued', expect.any(Function));
      expect(mockQueue.off).toHaveBeenCalledWith('job-started', expect.any(Function));
      expect(mockQueue.off).toHaveBeenCalledWith('job-progress', expect.any(Function));
      expect(mockQueue.off).toHaveBeenCalledWith('job-completed', expect.any(Function));
      expect(mockQueue.off).toHaveBeenCalledWith('job-failed', expect.any(Function));
      expect(mockQueue.off).toHaveBeenCalledWith('job-cancelled', expect.any(Function));
      expect(mockQueue.off).toHaveBeenCalledWith('job-retry', expect.any(Function));
    });
  });

  // ========================================
  // Panel Controls Tests
  // ========================================

  describe('Panel Controls', () => {
    it('should call onClose when close button clicked', async () => {
      (mockQueue.getAllJobs as any).mockResolvedValue([]);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      const onClose = vi.fn();

      render(<EnrichmentPanel onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Close panel')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close panel');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });
  });

  // ========================================
  // Job Grouping Tests
  // ========================================

  describe('Job Grouping', () => {
    it('should group jobs by status correctly', async () => {
      const jobs = [
        createMockJob({ status: 'processing', id: 'job-1', sessionId: 'session-1' }),
        createMockJob({ status: 'processing', id: 'job-2', sessionId: 'session-2' }),
        createMockJob({ status: 'pending', id: 'job-3', sessionId: 'session-3' }),
        createMockJob({ status: 'completed', id: 'job-4', sessionId: 'session-4', completedAt: Date.now() }),
        createMockJob({ status: 'failed', id: 'job-5', sessionId: 'session-5' }),
      ];

      (mockQueue.getAllJobs as any).mockResolvedValue(jobs);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Processing (2)')).toBeInTheDocument();
        expect(screen.getByText('Pending (1)')).toBeInTheDocument();
        expect(screen.getByText('Failed (1)')).toBeInTheDocument();
        expect(screen.getByText('Recently Completed (1)')).toBeInTheDocument();
      });
    });

    it('should limit completed jobs to 3 and show overflow count', async () => {
      const completedJobs = Array.from({ length: 5 }, (_, i) =>
        createMockJob({
          status: 'completed',
          id: `job-${i}`,
          sessionId: `session-${i}`,
          sessionName: `Completed Job ${i}`,
          completedAt: Date.now(),
        })
      );

      (mockQueue.getAllJobs as any).mockResolvedValue(completedJobs);
      (mockManager.getQueueStatus as any).mockResolvedValue(createMockStatus());

      render(<EnrichmentPanel onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Recently Completed (5)')).toBeInTheDocument();
        expect(screen.getByText('+2 more completed')).toBeInTheDocument();
      });
    });
  });
});
