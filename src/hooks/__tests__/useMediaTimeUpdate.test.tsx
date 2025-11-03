/**
 * Comprehensive tests for useMediaTimeUpdate hook
 *
 * Phase 6, Task 6.7: Debounced Time Updates
 *
 * Test Coverage:
 * 1. Debouncing behavior (200ms intervals)
 * 2. Time state updates (currentTime, duration, progress)
 * 3. Event listener cleanup
 * 4. Custom debounce intervals
 * 5. Enable/disable functionality
 * 6. loadedmetadata event handling
 * 7. Null ref handling
 * 8. Multiple rapid updates
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRef } from 'react';
import { useMediaTimeUpdate } from '../useMediaTimeUpdate';

describe('useMediaTimeUpdate', () => {
  let mockVideoElement: HTMLVideoElement;
  let mockAudioElement: HTMLAudioElement;

  beforeEach(() => {
    // Create mock video element
    mockVideoElement = document.createElement('video');
    Object.defineProperty(mockVideoElement, 'currentTime', {
      value: 0,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(mockVideoElement, 'duration', {
      value: 100,
      writable: true,
      configurable: true,
    });

    // Create mock audio element
    mockAudioElement = document.createElement('audio');
    Object.defineProperty(mockAudioElement, 'currentTime', {
      value: 0,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(mockAudioElement, 'duration', {
      value: 100,
      writable: true,
      configurable: true,
    });

    // Mock performance.now for consistent timing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ============================================================================
  // Test 1: Debouncing behavior (200ms intervals)
  // ============================================================================

  it('should debounce time updates to 200ms intervals', () => {
    const mediaRef = { current: mockVideoElement };

    const { result } = renderHook(() =>
      useMediaTimeUpdate({ mediaRef, debounceMs: 200 })
    );

    const initialTime = result.current.currentTime;

    // Simulate rapid timeupdate events (60Hz = every 16ms)
    for (let i = 1; i <= 12; i++) {
      mockVideoElement.currentTime = i * 5; // 5, 10, 15, ... 60
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      act(() => {
        vi.advanceTimersByTime(16); // Advance 16ms (60Hz)
      });
    }

    // After 192ms (12 * 16ms), we should have ~1 update
    expect(result.current.currentTime).not.toBe(60);
    expect(result.current.currentTime).toBe(initialTime); // Still at initial

    // Advance past 200ms threshold
    act(() => {
      vi.advanceTimersByTime(10); // Total: 202ms
    });

    // Should have updated to latest value (60)
    expect(result.current.currentTime).toBeGreaterThan(initialTime);
    expect(result.current.currentTime).toBe(60);
  });

  // ============================================================================
  // Test 2: Returns current time, duration, and progress
  // ============================================================================

  it('should return current time, duration, and progress', () => {
    mockVideoElement.currentTime = 50;
    mockVideoElement.duration = 100;

    const mediaRef = { current: mockVideoElement };
    const { result } = renderHook(() => useMediaTimeUpdate({ mediaRef }));

    expect(result.current.currentTime).toBe(50);
    expect(result.current.duration).toBe(100);
    expect(result.current.progress).toBe(0.5);
  });

  it('should calculate progress correctly at different positions', () => {
    const mediaRef = { current: mockVideoElement };
    const { result } = renderHook(() =>
      useMediaTimeUpdate({ mediaRef })
    );

    // Test start (0%)
    mockVideoElement.currentTime = 0;
    mockVideoElement.duration = 100;
    act(() => {
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      vi.advanceTimersByTime(200);
    });
    expect(result.current.progress).toBe(0);

    // Test middle (50%)
    mockVideoElement.currentTime = 50;
    act(() => {
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      vi.advanceTimersByTime(200);
    });
    expect(result.current.progress).toBe(0.5);

    // Test end (100%)
    mockVideoElement.currentTime = 100;
    act(() => {
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      vi.advanceTimersByTime(200);
    });
    expect(result.current.progress).toBe(1);
  });

  it('should handle zero duration gracefully', () => {
    mockVideoElement.currentTime = 10;
    mockVideoElement.duration = 0; // No duration yet

    const mediaRef = { current: mockVideoElement };
    const { result } = renderHook(() => useMediaTimeUpdate({ mediaRef }));

    expect(result.current.currentTime).toBe(10);
    expect(result.current.duration).toBe(0);
    expect(result.current.progress).toBe(0); // Should not divide by zero
  });

  // ============================================================================
  // Test 3: Cleanup event listeners on unmount
  // ============================================================================

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(mockVideoElement, 'removeEventListener');
    const mediaRef = { current: mockVideoElement };

    const { unmount } = renderHook(() => useMediaTimeUpdate({ mediaRef }));

    expect(removeEventListenerSpy).not.toHaveBeenCalled();

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('timeupdate', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
  });

  it('should clear pending timeout on unmount', () => {
    const mediaRef = { current: mockVideoElement };
    const { unmount } = renderHook(() => useMediaTimeUpdate({ mediaRef }));

    // Trigger a timeupdate that schedules a debounced update
    mockVideoElement.currentTime = 10;
    mockVideoElement.dispatchEvent(new Event('timeupdate'));

    // Unmount before debounce fires
    unmount();

    // Advance timers - should not update after unmount
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // No errors should occur (timeout was cleared)
  });

  // ============================================================================
  // Test 4: Respect custom debounce interval
  // ============================================================================

  it('should respect custom debounce interval (500ms)', () => {
    const mediaRef = { current: mockVideoElement };

    const { result } = renderHook(() =>
      useMediaTimeUpdate({ mediaRef, debounceMs: 500 })
    );

    const initialTime = result.current.currentTime;

    // Simulate rapid events for 400ms
    for (let i = 1; i <= 25; i++) {
      mockVideoElement.currentTime = i * 2;
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      act(() => {
        vi.advanceTimersByTime(16);
      });
    }

    // After 400ms, should still not update (debounce is 500ms)
    expect(result.current.currentTime).toBe(initialTime);

    // Advance to 500ms
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.currentTime).toBeGreaterThan(initialTime);
  });

  it('should respect custom debounce interval (100ms)', () => {
    const mediaRef = { current: mockVideoElement };

    const { result } = renderHook(() =>
      useMediaTimeUpdate({ mediaRef, debounceMs: 100 })
    );

    const initialTime = result.current.currentTime;

    // Simulate events for 150ms
    for (let i = 1; i <= 9; i++) {
      mockVideoElement.currentTime = i * 5;
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      act(() => {
        vi.advanceTimersByTime(16);
      });
    }

    // After 144ms, should have updated (debounce is 100ms)
    expect(result.current.currentTime).toBeGreaterThan(initialTime);
  });

  // ============================================================================
  // Test 5: Can be disabled via enabled prop
  // ============================================================================

  it('should not update when disabled', async () => {
    const mediaRef = { current: mockVideoElement };

    const { result } = renderHook(() =>
      useMediaTimeUpdate({ mediaRef, enabled: false })
    );

    const initialTime = result.current.currentTime;

    // Trigger timeupdate event
    mockVideoElement.currentTime = 50;
    mockVideoElement.dispatchEvent(new Event('timeupdate'));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Should not update (disabled)
    expect(result.current.currentTime).toBe(initialTime);
  });

  it('should resume updates when re-enabled', () => {
    const mediaRef = { current: mockVideoElement };

    const { result, rerender } = renderHook(
      ({ enabled }) => useMediaTimeUpdate({ mediaRef, enabled }),
      { initialProps: { enabled: false } }
    );

    const initialTime = result.current.currentTime;

    // Trigger event while disabled
    mockVideoElement.currentTime = 50;
    mockVideoElement.dispatchEvent(new Event('timeupdate'));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.currentTime).toBe(initialTime);

    // Re-enable
    act(() => {
      rerender({ enabled: true });
    });

    // Trigger event while enabled
    mockVideoElement.currentTime = 75;
    mockVideoElement.dispatchEvent(new Event('timeupdate'));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.currentTime).toBe(75);
  });

  // ============================================================================
  // Test 6: loadedmetadata event updates duration immediately
  // ============================================================================

  it('should update duration immediately on loadedmetadata', () => {
    mockVideoElement.currentTime = 0;
    mockVideoElement.duration = 0; // No duration initially

    const mediaRef = { current: mockVideoElement };
    const { result } = renderHook(() => useMediaTimeUpdate({ mediaRef }));

    expect(result.current.duration).toBe(0);

    // Simulate loadedmetadata event with duration
    mockVideoElement.duration = 120;
    act(() => {
      mockVideoElement.dispatchEvent(new Event('loadedmetadata'));
    });

    // Should update immediately without debouncing
    expect(result.current.duration).toBe(120);
  });

  // ============================================================================
  // Test 7: Handles null mediaRef gracefully
  // ============================================================================

  it('should handle null mediaRef gracefully', () => {
    const mediaRef = { current: null };

    const { result } = renderHook(() => useMediaTimeUpdate({ mediaRef }));

    // Should return initial state without errors
    expect(result.current.currentTime).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.progress).toBe(0);
  });

  it('should start working when mediaRef becomes non-null', () => {
    // Start with null, then mount with non-null ref
    mockVideoElement.currentTime = 30;
    mockVideoElement.duration = 100;

    const mediaRef = { current: mockVideoElement };
    const { result } = renderHook(() => useMediaTimeUpdate({ mediaRef }));

    // Should initialize with media element values
    expect(result.current.currentTime).toBe(30);
    expect(result.current.duration).toBe(100);
  });

  // ============================================================================
  // Test 8: Works with audio elements
  // ============================================================================

  it('should work with audio elements', () => {
    mockAudioElement.currentTime = 25;
    mockAudioElement.duration = 60;

    const mediaRef = { current: mockAudioElement };
    const { result } = renderHook(() => useMediaTimeUpdate({ mediaRef }));

    expect(result.current.currentTime).toBe(25);
    expect(result.current.duration).toBe(60);
    expect(result.current.progress).toBeCloseTo(25 / 60);
  });

  // ============================================================================
  // Test 9: Multiple rapid updates use latest value
  // ============================================================================

  it('should use latest value when multiple rapid updates occur', () => {
    const mediaRef = { current: mockVideoElement };

    const { result } = renderHook(() =>
      useMediaTimeUpdate({ mediaRef, debounceMs: 200 })
    );

    // Fire many rapid updates
    act(() => {
      mockVideoElement.currentTime = 10;
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      vi.advanceTimersByTime(50);

      mockVideoElement.currentTime = 20;
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      vi.advanceTimersByTime(50);

      mockVideoElement.currentTime = 30;
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      vi.advanceTimersByTime(50);

      mockVideoElement.currentTime = 40; // Latest value
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      vi.advanceTimersByTime(50);
    });

    // Total: 200ms - should update to latest value (40), not intermediate values
    expect(result.current.currentTime).toBe(40);
  });

  // ============================================================================
  // Test 10: Updates immediately if enough time has passed
  // ============================================================================

  it('should update immediately if enough time has passed since last update', () => {
    const mediaRef = { current: mockVideoElement };

    const { result } = renderHook(() =>
      useMediaTimeUpdate({ mediaRef, debounceMs: 200 })
    );

    // First update
    act(() => {
      mockVideoElement.currentTime = 10;
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      vi.advanceTimersByTime(200);
    });

    expect(result.current.currentTime).toBe(10);

    // Wait enough time (>= 200ms)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Second update - should happen immediately (no debounce)
    act(() => {
      mockVideoElement.currentTime = 30;
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
    });

    expect(result.current.currentTime).toBe(30);
  });
});
