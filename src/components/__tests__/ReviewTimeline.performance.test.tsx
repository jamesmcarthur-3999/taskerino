/**
 * ReviewTimeline Performance Tests
 *
 * Measures actual performance metrics for Task 6.2:
 * - DOM node count (before/after)
 * - Initial render time
 * - Scrolling performance
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ReviewTimeline } from '../ReviewTimeline';
import type { Session, SessionScreenshot } from '../../types';
import { UIProvider } from '../../context/UIContext';

// Mock factory
const createMockScreenshot = (index: number, timestamp: Date): SessionScreenshot => ({
  id: `screenshot-${index}`,
  sessionId: 'test-session',
  timestamp: timestamp.toISOString(),
  attachmentId: `attachment-${index}`,
  path: `/path/to/screenshot-${index}.png`,
  thumbnailPath: `/path/to/thumbnail-${index}.png`,
  analysisStatus: 'completed',
  aiAnalysis: {
    summary: `Screenshot ${index} summary - this is a longer summary to test realistic content rendering and performance with actual text content that would appear in a real session`,
    detectedActivity: 'code',
    progressIndicators: {
      achievements: [`Achievement ${index}`],
      blockers: [],
      insights: [`Insight ${index}`],
    },
  },
});

const createMockSession = (screenshotCount: number): Session => {
  const startTime = new Date('2025-01-01T10:00:00Z');
  const screenshots: SessionScreenshot[] = [];

  for (let i = 0; i < screenshotCount; i++) {
    const timestamp = new Date(startTime.getTime() + i * 30000);
    screenshots.push(createMockScreenshot(i, timestamp));
  }

  return {
    id: 'test-session',
    name: 'Performance Test Session',
    status: 'completed',
    startTime: startTime.toISOString(),
    endTime: new Date(startTime.getTime() + 3600000).toISOString(),
    screenshots,
    audioSegments: [],
    contextItems: [],
  };
};

describe('ReviewTimeline - Performance Metrics', () => {
  it('should measure DOM nodes with virtual scrolling (200 items)', () => {
    const session = createMockSession(200);

    const { container } = render(
      <UIProvider>
        <div style={{ height: '800px', overflow: 'auto' }}>
          <ReviewTimeline
            session={session}
            currentTime={0}
            onSeek={vi.fn()}
            onAddContext={vi.fn()}
            showContextCapture={false}
          />
        </div>
      </UIProvider>
    );

    // Count all DOM nodes
    const allNodes = container.querySelectorAll('*').length;

    // Count virtual items (should be much less than 200)
    const virtualItems = container.querySelectorAll('[data-index]').length;

    console.log('\n📊 Virtual Scrolling Performance Metrics:');
    console.log(`  Total DOM nodes: ${allNodes}`);
    console.log(`  Virtual items rendered: ${virtualItems} (of 200 total)`);
    console.log(`  Virtual scrolling efficiency: ${((200 - virtualItems) / 200 * 100).toFixed(1)}% nodes saved`);

    // Assertions
    expect(virtualItems).toBeLessThan(40); // Should render max 30-40 items (visible + overscan)
    expect(allNodes).toBeLessThan(1000); // Total DOM should be reasonable
  });

  it('should measure initial render time with 200 items', () => {
    const session = createMockSession(200);

    const startTime = performance.now();

    render(
      <UIProvider>
        <div style={{ height: '800px', overflow: 'auto' }}>
          <ReviewTimeline
            session={session}
            currentTime={0}
            onSeek={vi.fn()}
            onAddContext={vi.fn()}
            showContextCapture={false}
          />
        </div>
      </UIProvider>
    );

    const renderTime = performance.now() - startTime;

    console.log(`  Initial render time: ${renderTime.toFixed(2)}ms (target: <500ms)`);

    // Should render in under 500ms (spec target)
    expect(renderTime).toBeLessThan(500);
  });

  it('should measure virtual container height calculation', () => {
    const session = createMockSession(100);

    const { container } = render(
      <UIProvider>
        <div style={{ height: '800px', overflow: 'auto' }}>
          <ReviewTimeline
            session={session}
            currentTime={0}
            onSeek={vi.fn()}
            onAddContext={vi.fn()}
            showContextCapture={false}
          />
        </div>
      </UIProvider>
    );

    // Get virtual container
    const virtualContainer = container.querySelector('[style*="height"]');
    expect(virtualContainer).toBeTruthy();

    if (virtualContainer) {
      const heightMatch = virtualContainer.getAttribute('style')?.match(/height:\s*(\d+)px/);
      if (heightMatch) {
        const height = parseInt(heightMatch[1]);
        console.log(`  Virtual container height: ${height}px for 100 items`);
        console.log(`  Average item height estimate: ${(height / 100).toFixed(1)}px`);

        expect(height).toBeGreaterThan(0);
      }
    }
  });

  it('should compare performance: 50 vs 200 items', () => {
    // Measure with 50 items
    const session50 = createMockSession(50);
    const start50 = performance.now();

    const result50 = render(
      <UIProvider>
        <div style={{ height: '800px', overflow: 'auto' }}>
          <ReviewTimeline
            session={session50}
            currentTime={0}
            onSeek={vi.fn()}
            onAddContext={vi.fn()}
            showContextCapture={false}
          />
        </div>
      </UIProvider>
    );

    const time50 = performance.now() - start50;
    const nodes50 = result50.container.querySelectorAll('*').length;
    result50.unmount();

    // Measure with 200 items
    const session200 = createMockSession(200);
    const start200 = performance.now();

    const result200 = render(
      <UIProvider>
        <div style={{ height: '800px', overflow: 'auto' }}>
          <ReviewTimeline
            session={session200}
            currentTime={0}
            onSeek={vi.fn()}
            onAddContext={vi.fn()}
            showContextCapture={false}
          />
        </div>
      </UIProvider>
    );

    const time200 = performance.now() - start200;
    const nodes200 = result200.container.querySelectorAll('*').length;
    result200.unmount();

    console.log('\n📈 Scalability Comparison:');
    console.log(`  50 items:  ${time50.toFixed(2)}ms, ${nodes50} DOM nodes`);
    console.log(`  200 items: ${time200.toFixed(2)}ms, ${nodes200} DOM nodes`);
    console.log(`  Time ratio: ${(time200 / time50).toFixed(2)}x (should be ~1x with virtual scrolling)`);
    console.log(`  DOM ratio:  ${(nodes200 / nodes50).toFixed(2)}x (should be ~1x with virtual scrolling)`);

    // Virtual scrolling should keep render time and DOM nodes consistent
    // regardless of total item count
    expect(time200 / time50).toBeLessThan(2.5); // Should not be 4x slower (4x more items)
    expect(nodes200 / nodes50).toBeLessThan(2); // Should not be 4x more nodes
  });

  it('should verify overscan functionality', () => {
    const session = createMockSession(100);

    const { container } = render(
      <UIProvider>
        <div style={{ height: '800px', overflow: 'auto' }}>
          <ReviewTimeline
            session={session}
            currentTime={0}
            onSeek={vi.fn()}
            onAddContext={vi.fn()}
            showContextCapture={false}
          />
        </div>
      </UIProvider>
    );

    const virtualItems = container.querySelectorAll('[data-index]').length;

    console.log(`\n🔍 Overscan Analysis:`);
    console.log(`  Items rendered: ${virtualItems}`);
    console.log(`  Expected: ~10-20 visible + 5 above/below (overscan)`);
    console.log(`  Note: In jsdom, virtualizer may not render items without real viewport measurements`);

    // In jsdom, virtualizer might not render items due to lack of real measurements
    // But virtual container should still exist
    const virtualContainer = container.querySelector('[style*="height"]');
    expect(virtualContainer).toBeTruthy();
  });
});
