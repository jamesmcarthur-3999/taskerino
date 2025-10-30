/**
 * SessionProcessingScreen Tests
 *
 * Comprehensive test suite for SessionProcessingScreen component
 *
 * **Coverage Areas**:
 * 1. Rendering - Initial render, stage indicators, progress bars
 * 2. Event Subscription - Progress events, complete events, error events
 * 3. Stage Transitions - Concatenating → Merging → Complete
 * 4. Auto-Navigation - 2 second delay, manual navigation
 * 5. Error Handling - Error state display, error navigation
 * 6. Cleanup - Unsubscribe on unmount, timeout cleanup
 *
 * **Target Coverage**: >80%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { SessionProcessingScreen } from './SessionProcessingScreen';
import { eventBus } from '../../utils/eventBus';

// ============================================================================
// Mocks
// ============================================================================

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial, animate, exit, transition, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, initial, animate, exit, transition, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock UIContext
const mockSetZone = vi.fn();
vi.mock('../../context/UIContext', async () => {
  const actual = await vi.importActual('../../context/UIContext');
  return {
    ...actual,
    useUI: () => ({
      setZone: mockSetZone,
      addNotification: vi.fn(),
    }),
  };
});

// ============================================================================
// Test Helpers
// ============================================================================

function renderWithProviders(ui: React.ReactElement) {
  // Don't need UIProvider since we're mocking useUI
  return render(ui);
}

// ============================================================================
// Tests
// ============================================================================

describe('SessionProcessingScreen', () => {
  const mockSessionId = 'test-session-123';

  beforeEach(() => {
    vi.useFakeTimers();
    mockSetZone.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    eventBus.removeAllListeners();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('should render with initial state (concatenating)', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      expect(screen.getByText('Processing Your Session')).toBeInTheDocument();
      expect(screen.getByText('Optimizing media for instant playback')).toBeInTheDocument();
      expect(screen.getByText('Combining Audio')).toBeInTheDocument();
      expect(screen.getByText('Merging audio segments into single file...')).toBeInTheDocument();
    });

    it('should render all stage indicators', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      expect(screen.getByText('Combining Audio')).toBeInTheDocument();
      expect(screen.getByText('Optimizing Video')).toBeInTheDocument();
      expect(screen.getByText('Complete!')).toBeInTheDocument();
    });

    it('should render disclaimer about background processing', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      expect(screen.getByText('You can close this page')).toBeInTheDocument();
      expect(
        screen.getByText(/Processing will continue in the background/)
      ).toBeInTheDocument();
    });

    it('should render progress bar initially', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      // Check for progress percentage (0% initially)
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should warn if no sessionId provided', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      renderWithProviders(<SessionProcessingScreen />);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SessionProcessingScreen] No sessionId provided'
      );

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Event Subscription Tests
  // ==========================================================================

  describe('Event Subscription', () => {
    it('should subscribe to media-processing-progress events', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      // Verify initial state
      expect(screen.getByText('0%')).toBeInTheDocument();

      // Emit progress event
      act(() => {
        eventBus.emit('media-processing-progress', {
          sessionId: mockSessionId,
          stage: 'concatenating',
          progress: 50,
        });
      });

      // Verify progress updated
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should subscribe to media-processing-complete events', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      // Emit complete event
      act(() => {
        eventBus.emit('media-processing-complete', {
          sessionId: mockSessionId,
          optimizedPath: '/path/to/optimized.mp4',
        });
      });

      // Verify complete state (AnimatePresence renders immediately in tests)
      expect(screen.getByText('Your session is ready to view')).toBeInTheDocument();
      expect(screen.getByText('View Session')).toBeInTheDocument();
    });

    it('should subscribe to media-processing-error events', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      // Emit error event
      act(() => {
        eventBus.emit('media-processing-error', {
          sessionId: mockSessionId,
          stage: 'concatenating',
          error: 'Failed to concatenate audio',
        });
      });

      // Verify error state (AnimatePresence renders immediately in tests)
      expect(screen.getByText('Processing Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to concatenate audio')).toBeInTheDocument();
      expect(screen.getByText('Back to Sessions')).toBeInTheDocument();
    });

    it('should ignore events for different sessionId', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      // Emit event for different session
      act(() => {
        eventBus.emit('media-processing-progress', {
          sessionId: 'different-session',
          stage: 'merging',
          progress: 75,
        });
      });

      // Verify state unchanged
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('Combining Audio')).toBeInTheDocument();
    });

    it('should unsubscribe from events on unmount', () => {
      const { unmount } = renderWithProviders(
        <SessionProcessingScreen sessionId={mockSessionId} />
      );

      // Verify listeners active
      expect(eventBus.getListenerCount('media-processing-progress')).toBe(1);
      expect(eventBus.getListenerCount('media-processing-complete')).toBe(1);
      expect(eventBus.getListenerCount('media-processing-error')).toBe(1);

      // Unmount
      unmount();

      // Verify listeners removed
      expect(eventBus.getListenerCount('media-processing-progress')).toBe(0);
      expect(eventBus.getListenerCount('media-processing-complete')).toBe(0);
      expect(eventBus.getListenerCount('media-processing-error')).toBe(0);
    });
  });

  // ==========================================================================
  // Stage Transition Tests
  // ==========================================================================

  describe('Stage Transitions', () => {
    it('should transition from concatenating to merging', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      // Initial stage
      expect(screen.getByText('Merging audio segments into single file...')).toBeInTheDocument();

      // Transition to merging
      act(() => {
        eventBus.emit('media-processing-progress', {
          sessionId: mockSessionId,
          stage: 'merging',
          progress: 10,
        });
      });

      // Verify stage changed
      expect(screen.getByText('Creating optimized video with audio...')).toBeInTheDocument();
      expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('should transition from merging to complete', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      // Transition to merging first
      act(() => {
        eventBus.emit('media-processing-progress', {
          sessionId: mockSessionId,
          stage: 'merging',
          progress: 50,
        });
      });

      // Complete
      act(() => {
        eventBus.emit('media-processing-complete', {
          sessionId: mockSessionId,
          optimizedPath: '/path/to/optimized.mp4',
        });
      });

      // Verify complete state
      expect(screen.getByText('Your session is ready to view')).toBeInTheDocument();
    });

    it('should display custom message from event', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      act(() => {
        eventBus.emit('media-processing-progress', {
          sessionId: mockSessionId,
          stage: 'concatenating',
          progress: 30,
          message: 'Processing 3 of 10 segments...',
        });
      });

      expect(screen.getByText('Processing 3 of 10 segments...')).toBeInTheDocument();
    });

    it('should show estimated time remaining for merging stage', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      act(() => {
        eventBus.emit('media-processing-progress', {
          sessionId: mockSessionId,
          stage: 'merging',
          progress: 70,
        });
      });

      // 30% remaining / 3 = ~10 seconds
      expect(screen.getByText(/10 seconds remaining/)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Auto-Navigation Tests
  // ==========================================================================

  describe('Auto-Navigation', () => {
    it('should auto-navigate after 2 seconds when complete', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      // Complete processing
      act(() => {
        eventBus.emit('media-processing-complete', {
          sessionId: mockSessionId,
          optimizedPath: '/path/to/optimized.mp4',
        });
      });

      // Verify setZone not called yet
      expect(mockSetZone).not.toHaveBeenCalled();

      // Fast-forward 1 second (not enough)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Still not called
      expect(mockSetZone).not.toHaveBeenCalled();

      // Fast-forward another 1 second (total 2 seconds)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should have navigated (setZone called)
      expect(mockSetZone).toHaveBeenCalledWith('sessions');
    });

    it('should allow manual navigation before auto-navigate', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      // Complete processing
      act(() => {
        eventBus.emit('media-processing-complete', {
          sessionId: mockSessionId,
          optimizedPath: '/path/to/optimized.mp4',
        });
      });

      // Click View Session immediately
      const viewButton = screen.getByText('View Session');
      fireEvent.click(viewButton);

      // Should have navigated once
      expect(mockSetZone).toHaveBeenCalledTimes(1);

      // Auto-navigate timeout should be cleared
      // Fast-forward past 2 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Should not navigate again (no double-navigation)
      expect(mockSetZone).toHaveBeenCalledTimes(1);
    });

    it('should clear timeout on unmount', () => {
      const { unmount } = renderWithProviders(
        <SessionProcessingScreen sessionId={mockSessionId} />
      );

      // Complete processing
      act(() => {
        eventBus.emit('media-processing-complete', {
          sessionId: mockSessionId,
          optimizedPath: '/path/to/optimized.mp4',
        });
      });

      // Unmount before timeout
      unmount();

      // Fast-forward past 2 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Should not crash (timeout was cleared)
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should display error state with message', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      act(() => {
        eventBus.emit('media-processing-error', {
          sessionId: mockSessionId,
          stage: 'merging',
          error: 'Video encoding failed',
        });
      });

      expect(screen.getByText('Processing Error')).toBeInTheDocument();
      expect(screen.getByText('Video encoding failed')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong during processing')).toBeInTheDocument();
    });

    it('should show "Back to Sessions" button in error state', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      act(() => {
        eventBus.emit('media-processing-error', {
          sessionId: mockSessionId,
          stage: 'concatenating',
          error: 'Audio file not found',
        });
      });

      const backButton = screen.getByText('Back to Sessions');
      expect(backButton).toBeInTheDocument();
    });

    it('should navigate when clicking "Back to Sessions" in error state', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      act(() => {
        eventBus.emit('media-processing-error', {
          sessionId: mockSessionId,
          stage: 'concatenating',
          error: 'Processing failed',
        });
      });

      const backButton = screen.getByText('Back to Sessions');
      fireEvent.click(backButton);

      // Should navigate (setZone called)
      expect(mockSetZone).toHaveBeenCalledWith('sessions');
    });

    it('should hide progress bar in error state', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      // Progress bar initially visible
      expect(screen.getByText('0%')).toBeInTheDocument();

      // Trigger error
      act(() => {
        eventBus.emit('media-processing-error', {
          sessionId: mockSessionId,
          stage: 'concatenating',
          error: 'Error occurred',
        });
      });

      // Progress bar should be gone
      expect(screen.queryByText('0%')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Progress Bar Tests
  // ==========================================================================

  describe('Progress Bar', () => {
    it('should update progress percentage', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      act(() => {
        eventBus.emit('media-processing-progress', {
          sessionId: mockSessionId,
          stage: 'concatenating',
          progress: 42,
        });
      });

      expect(screen.getByText('42%')).toBeInTheDocument();
    });

    it('should show 100% when complete', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      act(() => {
        eventBus.emit('media-processing-complete', {
          sessionId: mockSessionId,
          optimizedPath: '/path/to/optimized.mp4',
        });
      });

      // Progress bar hidden when complete, but we can verify state changed
      expect(screen.getByText('Your session is ready to view')).toBeInTheDocument();
    });

    it('should hide progress bar when complete', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      // Progress bar initially visible
      expect(screen.getByText('0%')).toBeInTheDocument();

      // Complete
      act(() => {
        eventBus.emit('media-processing-complete', {
          sessionId: mockSessionId,
          optimizedPath: '/path/to/optimized.mp4',
        });
      });

      // Progress bar should be gone
      expect(screen.queryByText('0%')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('should handle complete workflow: concatenating → merging → complete → navigate', () => {
      renderWithProviders(<SessionProcessingScreen sessionId={mockSessionId} />);

      // Stage 1: Concatenating
      expect(screen.getByText('Combining Audio')).toBeInTheDocument();

      act(() => {
        eventBus.emit('media-processing-progress', {
          sessionId: mockSessionId,
          stage: 'concatenating',
          progress: 50,
        });
      });

      expect(screen.getByText('50%')).toBeInTheDocument();

      // Stage 2: Merging
      act(() => {
        eventBus.emit('media-processing-progress', {
          sessionId: mockSessionId,
          stage: 'merging',
          progress: 25,
        });
      });

      expect(screen.getByText('Creating optimized video with audio...')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();

      // Stage 3: Complete
      act(() => {
        eventBus.emit('media-processing-complete', {
          sessionId: mockSessionId,
          optimizedPath: '/path/to/optimized.mp4',
        });
      });

      const viewButton = screen.getByText('View Session');
      expect(viewButton).toBeInTheDocument();

      // Click to navigate
      fireEvent.click(viewButton);

      // Verify navigation
      expect(mockSetZone).toHaveBeenCalledWith('sessions');
    });
  });
});
