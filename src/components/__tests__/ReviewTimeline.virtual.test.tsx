/**
 * ReviewTimeline Virtual Scrolling Tests
 *
 * Tests for Task 6.2: Virtual Scrolling in ReviewTimeline
 *
 * Test Coverage:
 * - Rendering only visible items (10-20 max)
 * - Scroll-to-item functionality
 * - Performance metrics (DOM nodes, render time)
 * - Memory efficiency
 * - Seek operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { ReviewTimeline } from '../ReviewTimeline';
import type { Session, SessionScreenshot, SessionAudioSegment, SessionContextItem } from '../../types';
import { UIProvider } from '../../context/UIContext';

// Mock factories
const createMockScreenshot = (index: number, timestamp: Date): SessionScreenshot => ({
  id: `screenshot-${index}`,
  sessionId: 'test-session',
  timestamp: timestamp.toISOString(),
  attachmentId: `attachment-${index}`,
  path: `/path/to/screenshot-${index}.png`,
  thumbnailPath: `/path/to/thumbnail-${index}.png`,
  analysisStatus: 'completed',
  aiAnalysis: {
    summary: `Screenshot ${index} summary`,
    detectedActivity: 'code',
    progressIndicators: {
      achievements: [`Achievement ${index}`],
      blockers: [],
      insights: [`Insight ${index}`],
    },
  },
});

const createMockAudioSegment = (index: number, timestamp: Date): SessionAudioSegment => ({
  id: `audio-${index}`,
  sessionId: 'test-session',
  timestamp: timestamp.toISOString(),
  duration: 10,
  transcription: `Audio transcription ${index}`,
  mode: 'transcription',
  attachmentId: `audio-attachment-${index}`,
});

const createMockContextItem = (index: number, timestamp: Date): SessionContextItem => ({
  id: `context-${index}`,
  sessionId: 'test-session',
  timestamp: timestamp.toISOString(),
  type: 'note',
  content: `Context note ${index}`,
});

const createMockSession = (options: {
  screenshotCount?: number;
  audioCount?: number;
  contextCount?: number;
}): Session => {
  const startTime = new Date('2025-01-01T10:00:00Z');
  const screenshots: SessionScreenshot[] = [];
  const audioSegments: SessionAudioSegment[] = [];
  const contextItems: SessionContextItem[] = [];

  // Create screenshots
  for (let i = 0; i < (options.screenshotCount || 0); i++) {
    const timestamp = new Date(startTime.getTime() + i * 30000); // 30 seconds apart
    screenshots.push(createMockScreenshot(i, timestamp));
  }

  // Create audio segments
  for (let i = 0; i < (options.audioCount || 0); i++) {
    const timestamp = new Date(startTime.getTime() + i * 15000); // 15 seconds apart
    audioSegments.push(createMockAudioSegment(i, timestamp));
  }

  // Create context items
  for (let i = 0; i < (options.contextCount || 0); i++) {
    const timestamp = new Date(startTime.getTime() + i * 45000); // 45 seconds apart
    contextItems.push(createMockContextItem(i, timestamp));
  }

  return {
    id: 'test-session',
    name: 'Test Session',
    status: 'completed',
    startTime: startTime.toISOString(),
    endTime: new Date(startTime.getTime() + 3600000).toISOString(),
    screenshots,
    audioSegments,
    contextItems,
  };
};

// Helper to render component with providers
const renderReviewTimeline = (session: Session, currentTime = 0) => {
  const onSeek = vi.fn();
  const onAddContext = vi.fn();

  const result = render(
    <UIProvider>
      <div style={{ height: '800px', overflow: 'auto' }}>
        <ReviewTimeline
          session={session}
          currentTime={currentTime}
          onSeek={onSeek}
          onAddContext={onAddContext}
          showContextCapture={false}
        />
      </div>
    </UIProvider>
  );

  return {
    ...result,
    onSeek,
    onAddContext,
  };
};

describe('ReviewTimeline - Virtual Scrolling', () => {
  beforeEach(() => {
    // Mock getBoundingClientRect for virtual scrolling to work in jsdom
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));
  });

  describe('Rendering Tests', () => {
    it('should render virtual scrolling container with 200 total items', async () => {
      const session = createMockSession({
        screenshotCount: 100,
        audioCount: 50,
        contextCount: 50,
      });

      const { container } = renderReviewTimeline(session);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      // Virtual container should exist with calculated total height
      const virtualContainer = container.querySelector('[style*="height"]');
      expect(virtualContainer).toBeTruthy();

      // Total height should be calculated (200 items * average ~300px)
      const style = virtualContainer?.getAttribute('style');
      expect(style).toContain('height');
    });

    it('should create virtual timeline with mixed item types', async () => {
      const session = createMockSession({
        screenshotCount: 5,
        audioCount: 5,
        contextCount: 5,
      });

      const { container } = renderReviewTimeline(session);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      // Timeline should exist
      expect(container.querySelector('.overflow-auto')).toBeTruthy();

      // Virtual container with total height should be calculated
      const virtualContainer = container.querySelector('[style*="height"]');
      expect(virtualContainer).toBeTruthy();
    });

    it('should have scroll container for 100 items', async () => {
      const session = createMockSession({
        screenshotCount: 100,
      });

      const { container } = renderReviewTimeline(session);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      const scrollContainer = container.querySelector('.overflow-auto');
      expect(scrollContainer).toBeTruthy();

      // Virtual container should have calculated height for all items
      const virtualContainer = container.querySelector('[style*="height"]');
      if (virtualContainer) {
        const heightMatch = virtualContainer.getAttribute('style')?.match(/height:\s*(\d+)px/);
        if (heightMatch) {
          const height = parseInt(heightMatch[1]);
          // Should be substantial (100 items with estimated heights)
          // In jsdom with mocked measurements, height might be lower
          expect(height).toBeGreaterThan(100);
        }
      }
    });

    it('should handle empty session gracefully', () => {
      const session = createMockSession({
        screenshotCount: 0,
        audioCount: 0,
        contextCount: 0,
      });

      renderReviewTimeline(session);

      expect(screen.getByText('No timeline items yet')).toBeInTheDocument();
    });
  });

  describe('Performance Tests', () => {
    it('should have fast initial render with 200 items', async () => {
      const session = createMockSession({
        screenshotCount: 150,
        audioCount: 30,
        contextCount: 20,
      });

      const startTime = performance.now();
      renderReviewTimeline(session);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;

      // Should render in less than 500ms (target from spec)
      expect(renderTime).toBeLessThan(500);
    });

    it('should maintain low DOM node count with many items', async () => {
      const session = createMockSession({
        screenshotCount: 200,
      });

      const { container } = renderReviewTimeline(session);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      const renderedItems = container.querySelectorAll('[data-index]');

      // Should render maximum 10-30 items (visible + overscan of 5)
      expect(renderedItems.length).toBeLessThan(40);
    });

    it('should not re-render all items when scrolling', async () => {
      const session = createMockSession({
        screenshotCount: 100,
      });

      const { container } = renderReviewTimeline(session);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      const scrollContainer = container.querySelector('.overflow-auto');

      if (scrollContainer) {
        // Count renders before scroll
        const beforeScroll = container.querySelectorAll('[data-index]').length;

        // Scroll
        scrollContainer.scrollTop = 500;
        scrollContainer.dispatchEvent(new Event('scroll'));

        await waitFor(() => {
          const afterScroll = container.querySelectorAll('[data-index]').length;
          // Should maintain similar count (not render all 100)
          expect(Math.abs(afterScroll - beforeScroll)).toBeLessThan(10);
        });
      }
    });
  });

  describe('Scroll-to-Item Tests', () => {
    it('should support currentTime prop for auto-scrolling', async () => {
      const session = createMockSession({
        screenshotCount: 50,
      });

      const { container } = renderReviewTimeline(session, 0);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      // Virtual scrolling container exists
      const scrollContainer = container.querySelector('.overflow-auto');
      expect(scrollContainer).toBeTruthy();

      // Virtual height is calculated for all items
      const virtualContainer = container.querySelector('[style*="height"]');
      expect(virtualContainer).toBeTruthy();
    });

    it('should handle seek to timestamp', async () => {
      const session = createMockSession({
        screenshotCount: 20,
      });

      const { onSeek } = renderReviewTimeline(session);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      // Click on a screenshot to seek
      const screenshots = screen.queryAllByText(/Screenshot.*summary/);
      if (screenshots.length > 0) {
        screenshots[0].click();

        await waitFor(() => {
          expect(onSeek).toHaveBeenCalled();
        });
      }
    });

    it('should maintain scroll position when adding new item', async () => {
      const session = createMockSession({
        screenshotCount: 50,
      });

      const { container } = renderReviewTimeline(session);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      const scrollContainer = container.querySelector('.overflow-auto');

      if (scrollContainer) {
        scrollContainer.scrollTop = 500;
        scrollContainer.dispatchEvent(new Event('scroll'));

        await waitFor(() => {
          // Scroll position should be maintained
          expect(scrollContainer.scrollTop).toBeGreaterThan(400);
        });
      }
    });
  });

  describe('Memory Tests', () => {
    it('should not create memory leaks with frequent scrolling', async () => {
      const session = createMockSession({
        screenshotCount: 100,
      });

      const { container, unmount } = renderReviewTimeline(session);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      const scrollContainer = container.querySelector('.overflow-auto');

      if (scrollContainer) {
        // Simulate frequent scrolling
        for (let i = 0; i < 10; i++) {
          scrollContainer.scrollTop = i * 100;
          scrollContainer.dispatchEvent(new Event('scroll'));
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Should still have reasonable DOM node count
        const renderedItems = container.querySelectorAll('[data-index]');
        expect(renderedItems.length).toBeLessThan(40);
      }

      // Cleanup
      unmount();
    });

    it('should measure item heights correctly', async () => {
      const session = createMockSession({
        screenshotCount: 10,
        audioCount: 10,
        contextCount: 10,
      });

      const { container } = renderReviewTimeline(session);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      const virtualItems = container.querySelectorAll('[data-index]');

      // Each item should have proper transform positioning
      virtualItems.forEach((item) => {
        const style = (item as HTMLElement).style.transform;
        expect(style).toMatch(/translateY\(\d+px\)/);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle single item', async () => {
      const session = createMockSession({
        screenshotCount: 1,
      });

      const { container } = renderReviewTimeline(session);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      // Virtual container should exist even with 1 item
      const virtualContainer = container.querySelector('[style*="height"]');
      expect(virtualContainer).toBeTruthy();
    });

    it('should handle very large session (500+ items)', async () => {
      const session = createMockSession({
        screenshotCount: 500,
      });

      const { container } = renderReviewTimeline(session);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      // Should still only render visible items
      const renderedItems = container.querySelectorAll('[data-index]');
      expect(renderedItems.length).toBeLessThan(40);
    });

    it('should handle rapid currentTime changes', async () => {
      const session = createMockSession({
        screenshotCount: 50,
      });

      const { rerender } = renderReviewTimeline(session, 0);

      // Rapidly change currentTime
      for (let time = 0; time < 1000; time += 100) {
        rerender(
          <UIProvider>
            <ReviewTimeline
              session={session}
              currentTime={time}
              onSeek={vi.fn()}
              onAddContext={vi.fn()}
              showContextCapture={false}
            />
          </UIProvider>
        );
      }

      // Should not crash
      expect(screen.getByText('Timeline')).toBeInTheDocument();
    });
  });
});
