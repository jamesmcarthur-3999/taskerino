/**
 * EnrichmentStatusIndicator Tests
 *
 * Test Coverage:
 * 1. Status polling (every 5 seconds)
 * 2. Auto-hide when no active jobs
 * 3. Show badge when jobs active
 * 4. Expand/collapse panel on click
 * 5. Job count display
 * 6. Manager initialization handling
 * 7. Error handling
 * 8. Cleanup (interval cleared on unmount)
 *
 * Coverage Target: >80%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnrichmentStatusIndicator } from './EnrichmentStatusIndicator';
import { getBackgroundEnrichmentManager } from '@/services/enrichment/BackgroundEnrichmentManager';
import type { QueueStatus } from '@/services/enrichment/PersistentEnrichmentQueue';

// ============================================================================
// Mocks
// ============================================================================

// Mock BackgroundEnrichmentManager
vi.mock('@/services/enrichment/BackgroundEnrichmentManager', () => ({
  getBackgroundEnrichmentManager: vi.fn(),
}));

// Mock EnrichmentPanel
vi.mock('@/components/enrichment/EnrichmentPanel', () => ({
  EnrichmentPanel: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="enrichment-panel">
      <button onClick={onClose} data-testid="close-panel">Close</button>
    </div>
  ),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, onClick, className, title, ...props }: any) => (
      <button onClick={onClick} className={className} title={title} data-testid="enrichment-badge">
        {children}
      </button>
    ),
    div: ({ children, onClick, className, ...props }: any) => (
      <div onClick={onClick} className={className}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// ============================================================================
// Test Utilities
// ============================================================================

const createMockManager = (overrides?: Partial<ReturnType<typeof createMockManager>>) => {
  const defaultManager = {
    isInitialized: vi.fn().mockReturnValue(true),
    getQueueStatus: vi.fn(),
    cancelEnrichment: vi.fn(),
    retryEnrichment: vi.fn(),
  };

  return { ...defaultManager, ...overrides };
};

const createMockQueueStatus = (overrides?: Partial<QueueStatus>): QueueStatus => ({
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  totalJobs: 0,
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('EnrichmentStatusIndicator', () => {
  let mockManager: ReturnType<typeof createMockManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create fresh mock manager
    mockManager = createMockManager();
    (getBackgroundEnrichmentManager as any).mockReturnValue(mockManager);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ========================================
  // Basic Rendering
  // ========================================

  describe('Rendering', () => {
    it('should not render when no active jobs', async () => {
      // Mock: No active jobs
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 0, processing: 0 })
      );

      const { container } = render(<EnrichmentStatusIndicator />);

      // Wait for initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should not render anything
      expect(container.firstChild).toBeNull();
    });

    it('should render badge when jobs are active', async () => {
      // Mock: 2 pending, 1 processing = 3 active jobs
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 2, processing: 1 })
      );

      render(<EnrichmentStatusIndicator />);

      // Wait for initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should show badge with job count
      const badge = await screen.findByText(/Enriching 3 sessions/i, {}, { timeout: 1000 });
      expect(badge).toBeInTheDocument();
    });

    it('should render singular "session" for 1 job', async () => {
      // Mock: 1 active job
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 0, processing: 1 })
      );

      render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should show "session" (singular)
      const badge = await screen.findByText(/Enriching 1 session\.\.\./i, {}, { timeout: 1000 });
      expect(badge).toBeInTheDocument();
    });

    it('should render plural "sessions" for multiple jobs', async () => {
      // Mock: 5 active jobs
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 3, processing: 2 })
      );

      render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should show "sessions" (plural)
      const badge = await screen.findByText(/Enriching 5 sessions/i, {}, { timeout: 1000 });
      expect(badge).toBeInTheDocument();
    });

    it('should not render when manager is not initialized', async () => {
      // Mock: Manager not initialized
      mockManager.isInitialized.mockReturnValue(false);

      const { container } = render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should not render
      expect(container.firstChild).toBeNull();
    });
  });

  // ========================================
  // Status Polling
  // ========================================

  describe('Status Polling', () => {
    it('should poll status every 5 seconds', async () => {
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 1, processing: 0 })
      );

      render(<EnrichmentStatusIndicator />);

      // Initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(mockManager.getQueueStatus).toHaveBeenCalledTimes(1);

      // After 5 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(mockManager.getQueueStatus).toHaveBeenCalledTimes(2);

      // After another 5 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(mockManager.getQueueStatus).toHaveBeenCalledTimes(3);
    });

    it('should use custom polling interval', async () => {
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 1, processing: 0 })
      );

      render(<EnrichmentStatusIndicator pollingInterval={2000} />);

      // Initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(mockManager.getQueueStatus).toHaveBeenCalledTimes(1);

      // After 2 seconds (custom interval)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(mockManager.getQueueStatus).toHaveBeenCalledTimes(2);
    });

    it('should clear interval on unmount', async () => {
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 1, processing: 0 })
      );

      const { unmount } = render(<EnrichmentStatusIndicator />);

      // Initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Unmount component
      unmount();

      // Advance time - should NOT fetch again after unmount
      const callCountBeforeUnmount = mockManager.getQueueStatus.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });

      expect(mockManager.getQueueStatus).toHaveBeenCalledTimes(callCountBeforeUnmount);
    });
  });

  // ========================================
  // Auto-Hide Behavior
  // ========================================

  describe('Auto-Hide', () => {
    it('should hide when jobs complete (go from active to 0)', async () => {
      // Start with active jobs
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 1, processing: 0 })
      );

      const { rerender } = render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Badge should be visible
      expect(screen.getByText(/Enriching 1 session/i)).toBeInTheDocument();

      // Jobs complete (no active jobs)
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 0, processing: 0, completed: 1 })
      );

      // Advance to next poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // Badge should disappear
      expect(screen.queryByText(/Enriching/i)).not.toBeInTheDocument();
    });

    it('should show when new jobs are added', async () => {
      // Start with no jobs
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 0, processing: 0 })
      );

      render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // No badge initially
      expect(screen.queryByText(/Enriching/i)).not.toBeInTheDocument();

      // New job added
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 1, processing: 0 })
      );

      // Advance to next poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // Badge should appear
      const badge = await screen.findByText(/Enriching 1 session/i, {}, { timeout: 1000 });
      expect(badge).toBeInTheDocument();
    });
  });

  // ========================================
  // Expand/Collapse Panel
  // ========================================

  describe('Panel Expansion', () => {
    it('should expand panel when badge is clicked', async () => {
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 1, processing: 0 })
      );

      render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Badge should be visible
      const badge = await screen.findByText(/Enriching 1 session/i, {}, { timeout: 1000 });
      expect(badge).toBeInTheDocument();

      // Click badge to expand panel
      await act(async () => {
        badge.click();
      });

      // Panel should be visible
      const panel = await screen.findByTestId('enrichment-panel', {}, { timeout: 1000 });
      expect(panel).toBeInTheDocument();
    });

    it('should collapse panel when close is clicked', async () => {
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 1, processing: 0 })
      );

      render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Expand panel
      const badge = await screen.findByText(/Enriching 1 session/i, {}, { timeout: 1000 });
      await act(async () => {
        badge.click();
      });

      const panel = await screen.findByTestId('enrichment-panel', {}, { timeout: 1000 });
      expect(panel).toBeInTheDocument();

      // Close panel
      const closeButton = screen.getByTestId('close-panel');
      await act(async () => {
        closeButton.click();
      });

      // Panel should be gone
      expect(screen.queryByTestId('enrichment-panel')).not.toBeInTheDocument();
    });

    it('should toggle panel on repeated badge clicks', async () => {
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 1, processing: 0 })
      );

      render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const badge = await screen.findByText(/Enriching 1 session/i, {}, { timeout: 1000 });

      // Click 1: Expand
      await act(async () => {
        badge.click();
      });
      let panel = await screen.findByTestId('enrichment-panel', {}, { timeout: 1000 });
      expect(panel).toBeInTheDocument();

      // Click 2: Collapse
      await act(async () => {
        badge.click();
      });
      expect(screen.queryByTestId('enrichment-panel')).not.toBeInTheDocument();

      // Click 3: Expand again
      await act(async () => {
        badge.click();
      });
      panel = await screen.findByTestId('enrichment-panel', {}, { timeout: 1000 });
      expect(panel).toBeInTheDocument();
    });
  });

  // ========================================
  // Error Handling
  // ========================================

  describe('Error Handling', () => {
    it('should not render on fetch error', async () => {
      // Mock: Fetch throws error
      mockManager.getQueueStatus.mockRejectedValue(new Error('Network error'));

      const { container } = render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should not render due to error
      expect(container.firstChild).toBeNull();
    });

    it('should continue polling after error', async () => {
      // First call fails
      mockManager.getQueueStatus.mockRejectedValueOnce(new Error('Network error'));

      // Second call succeeds
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 1, processing: 0 })
      );

      render(<EnrichmentStatusIndicator />);

      // First fetch (error)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should not render yet
      expect(screen.queryByText(/Enriching/i)).not.toBeInTheDocument();

      // Second fetch (success)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // Should render now
      const badge = await screen.findByText(/Enriching 1 session/i, {}, { timeout: 1000 });
      expect(badge).toBeInTheDocument();
    });
  });

  // ========================================
  // Job Count Display
  // ========================================

  describe('Job Count Display', () => {
    it('should display correct count for pending jobs only', async () => {
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 5, processing: 0 })
      );

      render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByText(/Enriching 5 sessions/i)).toBeInTheDocument();
    });

    it('should display correct count for processing jobs only', async () => {
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 0, processing: 3 })
      );

      render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByText(/Enriching 3 sessions/i)).toBeInTheDocument();
    });

    it('should display correct count for pending + processing', async () => {
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 4, processing: 2 })
      );

      render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByText(/Enriching 6 sessions/i)).toBeInTheDocument();
    });

    it('should not count completed jobs', async () => {
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 1, processing: 0, completed: 10 })
      );

      render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should only show 1 (not 11)
      expect(screen.getByText(/Enriching 1 session/i)).toBeInTheDocument();
    });

    it('should not count failed jobs', async () => {
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 2, processing: 0, failed: 5 })
      );

      render(<EnrichmentStatusIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should only show 2 (not 7)
      expect(screen.getByText(/Enriching 2 sessions/i)).toBeInTheDocument();
    });
  });

  // ========================================
  // Custom Props
  // ========================================

  describe('Custom Props', () => {
    it('should apply custom className', async () => {
      mockManager.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pending: 1, processing: 0 })
      );

      const { container } = render(
        <EnrichmentStatusIndicator className="custom-test-class" />
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Find button with custom class
      const button = container.querySelector('button.custom-test-class');
      expect(button).toBeInTheDocument();
    });
  });
});
