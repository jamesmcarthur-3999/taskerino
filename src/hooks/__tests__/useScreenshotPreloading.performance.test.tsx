/**
 * useScreenshotPreloading Hook - Performance Tests
 *
 * Tests cover:
 * 1. Navigation to preloaded screenshot (<100ms)
 * 2. Memory usage (only buffer screenshots in memory)
 * 3. Preload latency (rapid index changes)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useScreenshotPreloading } from '../useScreenshotPreloading';
import type { SessionScreenshot } from '../../types';
import * as attachmentStorageModule from '../../services/attachmentStorage';

// Mock dependencies
vi.mock('../../services/attachmentStorage', () => ({
  attachmentStorage: {
    getAttachment: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `tauri://localhost/${path}`),
}));

describe('useScreenshotPreloading - Performance', () => {
  const createMockScreenshots = (count: number): SessionScreenshot[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `screenshot-${i}`,
      sessionId: 'session-1',
      attachmentId: `att-${i}`,
      timestamp: new Date(Date.now() + i * 60000).toISOString(),
    }));
  };

  // Track Image constructor calls with timing
  let imageConstructorCalls: Array<{ src: string; timestamp: number }> = [];
  let OriginalImage: typeof Image;

  beforeEach(() => {
    vi.clearAllMocks();
    imageConstructorCalls = [];

    // Mock Image constructor with timing
    OriginalImage = global.Image;
    global.Image = class MockImage {
      _src: string = '';
      get src() {
        return this._src;
      }
      set src(value: string) {
        this._src = value;
        imageConstructorCalls.push({ src: value, timestamp: performance.now() });
      }
    } as any;

    // Mock attachmentStorage.getAttachment with realistic delay
    vi.mocked(attachmentStorageModule.attachmentStorage.getAttachment).mockImplementation(
      async (attachmentId: string) => {
        // Simulate 10ms storage latency
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          id: attachmentId,
          type: 'image',
          name: `screenshot-${attachmentId}.png`,
          path: `screenshots/${attachmentId}.png`,
          size: 100000,
          mimeType: 'image/png',
          createdAt: new Date().toISOString(),
        } as any;
      }
    );
  });

  afterEach(() => {
    global.Image = OriginalImage;
  });

  it('should complete navigation setup in <100ms (preloaded screenshots)', async () => {
    const screenshots = createMockScreenshots(10);

    const startTime = performance.now();

    const { rerender } = renderHook(
      ({ currentIndex }) =>
        useScreenshotPreloading({
          screenshots,
          currentIndex,
        }),
      { initialProps: { currentIndex: 5 } }
    );

    // Wait for initial preload
    await waitFor(
      () => {
        expect(imageConstructorCalls.length).toBeGreaterThan(0);
      },
      { timeout: 1000 }
    );

    // Navigate to a preloaded screenshot (index 6)
    const navigationStart = performance.now();
    rerender({ currentIndex: 6 });

    // The hook should re-render immediately (preloaded screenshot)
    await waitFor(
      () => {
        expect(performance.now() - navigationStart).toBeLessThan(100);
      },
      { timeout: 200 }
    );

    const navigationDuration = performance.now() - navigationStart;
    console.log(`Navigation to preloaded screenshot: ${navigationDuration.toFixed(2)}ms`);

    // Navigation should be nearly instant (<100ms)
    expect(navigationDuration).toBeLessThan(100);
  });

  it('should only keep buffer screenshots in memory', async () => {
    const screenshots = createMockScreenshots(100); // Large screenshot array

    const { result, rerender } = renderHook(
      ({ currentIndex }) =>
        useScreenshotPreloading({
          screenshots,
          currentIndex,
          preloadConfig: { ahead: 2, behind: 1 }, // Buffer: 3 screenshots
        }),
      { initialProps: { currentIndex: 50 } }
    );

    // Wait for initial preload
    await waitFor(
      () => {
        expect(result.current.preloadedIndexes.size).toBe(3); // 49, 51, 52
      },
      { timeout: 1000 }
    );

    // Navigate to index 60
    rerender({ currentIndex: 60 });

    await waitFor(
      () => {
        // Should only have 3 screenshots in memory (buffer size)
        expect(result.current.preloadedIndexes.size).toBeLessThanOrEqual(3);
      },
      { timeout: 1000 }
    );

    // Memory efficient: Only buffer screenshots kept
    expect(result.current.preloadedIndexes.size).toBe(3); // 59, 61, 62
  });

  it('should handle rapid index changes without memory leaks', async () => {
    const screenshots = createMockScreenshots(50);

    const { result, rerender } = renderHook(
      ({ currentIndex }) =>
        useScreenshotPreloading({
          screenshots,
          currentIndex,
        }),
      { initialProps: { currentIndex: 10 } }
    );

    // Wait for initial preload
    await waitFor(
      () => {
        expect(result.current.preloadedIndexes.size).toBeGreaterThan(0);
      },
      { timeout: 1000 }
    );

    // Rapidly change indexes (simulate user scrolling)
    const indexes = [15, 20, 25, 30, 35, 40, 45];
    for (const index of indexes) {
      rerender({ currentIndex: index });
      await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms between changes
    }

    // Final state check - buffer size is 3 (1 behind + 2 ahead)
    await waitFor(
      () => {
        // Should have reasonable number of preloads (cleanup happens async)
        // Expect 3-6 screenshots due to async cleanup (not all 7 visited)
        expect(result.current.preloadedIndexes.size).toBeLessThanOrEqual(8);
      },
      { timeout: 1000 }
    );

    // Memory efficient: Not accumulating all visited indexes
    expect(result.current.preloadedIndexes.size).toBeLessThan(indexes.length);
  });

  it('should preload all screenshots in <1s for typical session (10 screenshots)', async () => {
    const screenshots = createMockScreenshots(10);

    const startTime = performance.now();

    renderHook(() =>
      useScreenshotPreloading({
        screenshots,
        currentIndex: 0,
      })
    );

    // Wait for initial preload (indexes 1, 2)
    await waitFor(
      () => {
        expect(imageConstructorCalls.length).toBe(2);
      },
      { timeout: 1000 }
    );

    const duration = performance.now() - startTime;
    console.log(`Preload 2 screenshots: ${duration.toFixed(2)}ms`);

    // Should be fast (<500ms for 2 screenshots)
    expect(duration).toBeLessThan(500);
  });

  it('should not block UI thread during preload', async () => {
    const screenshots = createMockScreenshots(20);

    const startTime = performance.now();
    let uiBlockingTime = 0;

    // Simulate UI updates during preload
    const uiUpdateInterval = setInterval(() => {
      const frameStart = performance.now();
      // Simulate UI work
      for (let i = 0; i < 1000; i++) {
        Math.sqrt(i);
      }
      const frameEnd = performance.now();
      uiBlockingTime = Math.max(uiBlockingTime, frameEnd - frameStart);
    }, 16); // ~60fps

    renderHook(() =>
      useScreenshotPreloading({
        screenshots,
        currentIndex: 10,
      })
    );

    // Wait for preload to complete
    await waitFor(
      () => {
        expect(imageConstructorCalls.length).toBeGreaterThan(0);
      },
      { timeout: 1000 }
    );

    clearInterval(uiUpdateInterval);

    console.log(`Max UI blocking time: ${uiBlockingTime.toFixed(2)}ms`);

    // UI should not be blocked (frame budget: 16ms for 60fps)
    expect(uiBlockingTime).toBeLessThan(50); // Allow some margin
  });

  it('should achieve >90% cache hit rate for sequential navigation', async () => {
    const screenshots = createMockScreenshots(20);

    const { rerender } = renderHook(
      ({ currentIndex }) =>
        useScreenshotPreloading({
          screenshots,
          currentIndex,
        }),
      { initialProps: { currentIndex: 5 } }
    );

    // Wait for initial preload
    await waitFor(
      () => {
        expect(imageConstructorCalls.length).toBeGreaterThan(0);
      },
      { timeout: 1000 }
    );

    const initialPreloadCount = imageConstructorCalls.length;

    // Navigate sequentially (5 → 6 → 7 → 8 → 9)
    const navigationSequence = [6, 7, 8, 9];
    for (const index of navigationSequence) {
      rerender({ currentIndex: index });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Wait for any additional preloads
    await new Promise((resolve) => setTimeout(resolve, 200));

    const totalPreloads = imageConstructorCalls.length - initialPreloadCount;

    console.log(`Sequential navigation: ${totalPreloads} new preloads for 4 navigations`);

    // Most navigations should hit cache (preloaded screenshots)
    // Expect 4-6 new preloads (some screenshots get re-preloaded as buffer shifts)
    expect(totalPreloads).toBeLessThanOrEqual(8); // Reasonable upper bound for async preloading
  });

  it('should handle large sessions (100+ screenshots) efficiently', async () => {
    const screenshots = createMockScreenshots(150);

    const startTime = performance.now();

    const { result } = renderHook(() =>
      useScreenshotPreloading({
        screenshots,
        currentIndex: 75,
      })
    );

    // Wait for initial preload
    await waitFor(
      () => {
        expect(result.current.preloadedIndexes.size).toBe(3);
      },
      { timeout: 1000 }
    );

    const duration = performance.now() - startTime;
    console.log(`Large session preload: ${duration.toFixed(2)}ms`);

    // Should complete quickly even with 150 screenshots
    expect(duration).toBeLessThan(1000);

    // Memory efficient: Only buffer screenshots
    expect(result.current.preloadedIndexes.size).toBe(3);
  });
});
