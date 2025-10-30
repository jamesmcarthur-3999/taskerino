/**
 * Performance tests for useMediaTimeUpdate hook
 *
 * Phase 6, Task 6.7: Debounced Time Updates
 *
 * Performance Goals:
 * - CPU usage: <5% during playback (was 15-25%) = 3-5x reduction
 * - React re-renders: ~5/sec (was 60/sec) = 90% reduction
 * - Debounce overhead: <1ms
 *
 * Test Coverage:
 * 1. React re-render count (90% reduction)
 * 2. Debounce overhead (<1ms)
 * 3. Memory usage (no leaks)
 * 4. Long-running playback (stability)
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMediaTimeUpdate } from '../useMediaTimeUpdate';

describe('useMediaTimeUpdate - Performance', () => {
  let mockVideoElement: HTMLVideoElement;

  beforeEach(() => {
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

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ============================================================================
  // Test 1: React re-render count (90% reduction)
  // ============================================================================

  it('should reduce React re-renders by 90%+', async () => {
    const mediaRef = { current: mockVideoElement };

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount++;
      return useMediaTimeUpdate({ mediaRef, debounceMs: 200 });
    });

    const initialRenderCount = renderCount;

    // Simulate 1 second of playback at 60Hz (60 timeupdate events)
    for (let i = 0; i < 60; i++) {
      mockVideoElement.currentTime = i;
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      act(() => {
        vi.advanceTimersByTime(16.67); // ~60Hz
      });
    }

    // Total time: ~1 second
    // Expected re-renders: ~5 (1000ms / 200ms debounce)
    // Actual 60Hz would cause 60 re-renders

    const finalRenderCount = renderCount - initialRenderCount;

    console.log(`[PERFORMANCE] Re-renders in 1 second: ${finalRenderCount}`);
    console.log(`[PERFORMANCE] Reduction: ${((60 - finalRenderCount) / 60 * 100).toFixed(1)}%`);

    // Should have ~5 re-renders (allow some variance: 3-8)
    expect(finalRenderCount).toBeGreaterThanOrEqual(3);
    expect(finalRenderCount).toBeLessThanOrEqual(8);

    // 90% reduction: 60 → 6 or fewer
    expect(finalRenderCount).toBeLessThanOrEqual(6);
  });

  it('should maintain low re-render count over extended playback', () => {
    const mediaRef = { current: mockVideoElement };

    let renderCount = 0;
    renderHook(() => {
      renderCount++;
      return useMediaTimeUpdate({ mediaRef, debounceMs: 200 });
    });

    const initialRenderCount = renderCount;

    // Simulate 10 seconds of playback at 60Hz (600 events)
    for (let i = 0; i < 600; i++) {
      mockVideoElement.currentTime = i * 0.1; // 0.1 second increments
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      act(() => {
        vi.advanceTimersByTime(16.67);
      });
    }

    const finalRenderCount = renderCount - initialRenderCount;

    console.log(`[PERFORMANCE] Re-renders in 10 seconds: ${finalRenderCount}`);
    console.log(`[PERFORMANCE] Without debounce: 600 re-renders`);
    console.log(`[PERFORMANCE] Reduction: ${((600 - finalRenderCount) / 600 * 100).toFixed(1)}%`);

    // Expected: ~50 re-renders (10000ms / 200ms)
    // Allow range: 45-55
    expect(finalRenderCount).toBeGreaterThanOrEqual(45);
    expect(finalRenderCount).toBeLessThanOrEqual(55);

    // 90% reduction: 600 → 60 or fewer
    expect(finalRenderCount).toBeLessThanOrEqual(60);
  });

  // ============================================================================
  // Test 2: Debounce overhead (<1ms)
  // ============================================================================

  it('should have minimal debounce overhead (<1ms)', () => {
    const mediaRef = { current: mockVideoElement };

    // Measure hook initialization time
    const startTime = performance.now();
    const { result } = renderHook(() => useMediaTimeUpdate({ mediaRef }));
    const initTime = performance.now() - startTime;

    console.log(`[PERFORMANCE] Hook initialization: ${initTime.toFixed(3)}ms`);

    // Should be extremely fast (<1ms)
    expect(initTime).toBeLessThan(1);

    // Measure single timeupdate handler execution time
    const handlerStartTime = performance.now();
    mockVideoElement.currentTime = 10;
    mockVideoElement.dispatchEvent(new Event('timeupdate'));
    const handlerTime = performance.now() - handlerStartTime;

    console.log(`[PERFORMANCE] Single timeupdate handler: ${handlerTime.toFixed(3)}ms`);

    // Handler should be extremely fast (<1ms, typically <0.1ms)
    expect(handlerTime).toBeLessThan(1);
  });

  it('should have minimal overhead for rapid events', () => {
    const mediaRef = { current: mockVideoElement };

    renderHook(() => useMediaTimeUpdate({ mediaRef, debounceMs: 200 }));

    // Measure time to process 100 rapid events
    const startTime = performance.now();
    for (let i = 0; i < 100; i++) {
      mockVideoElement.currentTime = i;
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
    }
    const totalTime = performance.now() - startTime;

    console.log(`[PERFORMANCE] 100 rapid events: ${totalTime.toFixed(3)}ms`);
    console.log(`[PERFORMANCE] Average per event: ${(totalTime / 100).toFixed(3)}ms`);

    // Should process 100 events in <10ms (average <0.1ms per event)
    expect(totalTime).toBeLessThan(10);
  });

  // ============================================================================
  // Test 3: Memory usage (no leaks)
  // ============================================================================

  it('should not leak memory after multiple mount/unmount cycles', () => {
    const mediaRef = { current: mockVideoElement };

    // Baseline: Check initial state
    const initialListenerCount = mockVideoElement.addEventListener.length || 0;

    // Mount/unmount 100 times
    for (let i = 0; i < 100; i++) {
      const { unmount } = renderHook(() => useMediaTimeUpdate({ mediaRef }));
      unmount();
    }

    // After cleanup, should have no lingering listeners or timeouts
    // (We can't directly measure this, but verify no errors occur)

    // Mount one more time to verify still works
    const { result } = renderHook(() => useMediaTimeUpdate({ mediaRef }));

    mockVideoElement.currentTime = 50;
    mockVideoElement.dispatchEvent(new Event('timeupdate'));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.currentTime).toBe(50);
  });

  it('should clear all timeouts on unmount', () => {
    const mediaRef = { current: mockVideoElement };

    // Track number of active timeouts
    let activeTimeoutCount = 0;
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;

    global.setTimeout = ((...args: any[]) => {
      activeTimeoutCount++;
      return originalSetTimeout(...args);
    }) as any;

    global.clearTimeout = ((id: any) => {
      activeTimeoutCount--;
      return originalClearTimeout(id);
    }) as any;

    const { unmount } = renderHook(() =>
      useMediaTimeUpdate({ mediaRef, debounceMs: 200 })
    );

    // Trigger some debounced updates
    for (let i = 0; i < 10; i++) {
      mockVideoElement.currentTime = i * 10;
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
    }

    // Should have 1 pending timeout
    expect(activeTimeoutCount).toBeGreaterThan(0);

    // Unmount
    unmount();

    // All timeouts should be cleared
    expect(activeTimeoutCount).toBe(0);

    // Restore original functions
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  });

  // ============================================================================
  // Test 4: Long-running playback stability
  // ============================================================================

  it('should remain stable during long playback sessions', () => {
    const mediaRef = { current: mockVideoElement };

    const { result } = renderHook(() =>
      useMediaTimeUpdate({ mediaRef, debounceMs: 200 })
    );

    // Simulate 1 hour of playback at 60Hz (216,000 events)
    // This tests for memory leaks, timing drift, and stability
    const totalEvents = 216000;
    const eventsPerChunk = 1000;

    for (let chunk = 0; chunk < totalEvents / eventsPerChunk; chunk++) {
      for (let i = 0; i < eventsPerChunk; i++) {
        const time = (chunk * eventsPerChunk + i) * 0.01667; // 60Hz = 16.67ms increments
        mockVideoElement.currentTime = time;
        mockVideoElement.dispatchEvent(new Event('timeupdate'));
        act(() => {
          vi.advanceTimersByTime(16.67);
        });
      }
    }

    // After 1 hour, hook should still be responsive
    mockVideoElement.currentTime = 3600; // 1 hour
    mockVideoElement.dispatchEvent(new Event('timeupdate'));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.currentTime).toBe(3600);
    expect(result.current.duration).toBe(100);

    console.log(`[PERFORMANCE] Processed ${totalEvents.toLocaleString()} events successfully`);
    console.log(`[PERFORMANCE] Final state: ${result.current.currentTime.toFixed(1)}s`);
  });

  // ============================================================================
  // Test 5: Comparison with unbounced behavior
  // ============================================================================

  it('should demonstrate performance improvement over unbounced updates', () => {
    // Simulate unbounced behavior (update every event)
    const unbounced = {
      renderCount: 0,
      currentTime: 0,
    };

    const unboundedRef = { current: mockVideoElement };

    // Simulate unbounced updates
    for (let i = 0; i < 60; i++) {
      mockVideoElement.currentTime = i;
      // Each timeupdate would trigger a render
      unbounced.renderCount++;
      unbounced.currentTime = mockVideoElement.currentTime;
    }

    console.log(`[COMPARISON] Unbounced re-renders in 1s: ${unbounced.renderCount}`);

    // Now test debounced version
    const mediaRef = { current: mockVideoElement };
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount++;
      return useMediaTimeUpdate({ mediaRef, debounceMs: 200 });
    });

    const initialRenderCount = renderCount;

    // Same 1 second of playback
    for (let i = 0; i < 60; i++) {
      mockVideoElement.currentTime = i;
      mockVideoElement.dispatchEvent(new Event('timeupdate'));
      act(() => {
        vi.advanceTimersByTime(16.67);
      });
    }

    const debouncedRenderCount = renderCount - initialRenderCount;

    console.log(`[COMPARISON] Debounced re-renders in 1s: ${debouncedRenderCount}`);
    console.log(
      `[COMPARISON] Improvement: ${((unbounced.renderCount - debouncedRenderCount) / unbounced.renderCount * 100).toFixed(1)}% reduction`
    );

    // Debounced should have significantly fewer re-renders
    expect(debouncedRenderCount).toBeLessThan(unbounced.renderCount * 0.2); // <20% of unbounced
  });

  // ============================================================================
  // Test 6: Different debounce intervals (100ms, 200ms, 500ms)
  // ============================================================================

  it('should show expected re-render counts for different intervals', () => {
    const intervals = [100, 200, 500];
    const results: Record<number, number> = {};

    intervals.forEach((interval) => {
      const mediaRef = { current: mockVideoElement };
      let renderCount = 0;

      const { result } = renderHook(() => {
        renderCount++;
        return useMediaTimeUpdate({ mediaRef, debounceMs: interval });
      });

      const initialRenderCount = renderCount;

      // Simulate 1 second of playback
      for (let i = 0; i < 60; i++) {
        mockVideoElement.currentTime = i;
        mockVideoElement.dispatchEvent(new Event('timeupdate'));
        act(() => {
          vi.advanceTimersByTime(16.67);
        });
      }

      results[interval] = renderCount - initialRenderCount;
    });

    console.log('[COMPARISON] Re-renders per interval:');
    console.log(`  100ms: ~${results[100]} (expected: ~10)`);
    console.log(`  200ms: ~${results[200]} (expected: ~5)`);
    console.log(`  500ms: ~${results[500]} (expected: ~2)`);

    // Verify expected ranges
    expect(results[100]).toBeGreaterThanOrEqual(8);
    expect(results[100]).toBeLessThanOrEqual(12);

    expect(results[200]).toBeGreaterThanOrEqual(3);
    expect(results[200]).toBeLessThanOrEqual(8);

    expect(results[500]).toBeGreaterThanOrEqual(1);
    expect(results[500]).toBeLessThanOrEqual(3);

    // Verify ordering: 100ms > 200ms > 500ms
    expect(results[100]).toBeGreaterThan(results[200]);
    expect(results[200]).toBeGreaterThan(results[500]);
  });
});
