/**
 * ScreenshotCard Lazy Loading Tests
 *
 * Tests for Task 6.4 - Image Lazy Loading (Phase 6 Wave 2)
 *
 * Verifies:
 * - Skeleton placeholder rendering
 * - Intersection Observer behavior
 * - Lazy loading attributes (loading="lazy", decoding="async")
 * - Image load/error handling
 * - Accessibility (alt text, ARIA labels)
 * - Cleanup on unmount
 *
 * Coverage: 8+ comprehensive tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { ScreenshotCard } from '../ScreenshotCard';
import type { SessionScreenshot } from '../../types';

// Mock attachment storage
vi.mock('../../services/attachmentStorage', () => ({
  attachmentStorage: {
    getAttachment: vi.fn((id: string) =>
      Promise.resolve({
        id,
        type: 'image' as const,
        name: 'test-screenshot.png',
        mimeType: 'image/png',
        size: 1024,
        createdAt: new Date().toISOString(),
        base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      })
    ),
  },
}));

// Mock Tauri convertFileSrc
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `tauri://localhost/${path}`),
}));

// Mock IntersectionObserver
class MockIntersectionObserver {
  private callback: IntersectionObserverCallback;
  private elements: Set<Element> = new Set();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  // Helper method to trigger intersection
  triggerIntersection(isIntersecting: boolean) {
    const entries = Array.from(this.elements).map((target) => ({
      target,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    }));
    this.callback(entries as IntersectionObserverEntry[], this as any);
  }
}

let mockObserverInstance: MockIntersectionObserver | null = null;

beforeEach(() => {
  // Setup IntersectionObserver mock
  global.IntersectionObserver = vi.fn((callback) => {
    mockObserverInstance = new MockIntersectionObserver(callback);
    return mockObserverInstance as any;
  }) as any;
});

afterEach(() => {
  cleanup();
  mockObserverInstance = null;
  vi.clearAllMocks();
});

// Mock screenshot factory
const createMockScreenshot = (overrides?: Partial<SessionScreenshot>): SessionScreenshot => ({
  id: 'screenshot-1',
  sessionId: 'session-1',
  timestamp: new Date('2025-01-01T10:00:00Z').toISOString(),
  attachmentId: 'attachment-1',
  path: '/path/to/screenshot.png',
  thumbnailPath: '/path/to/thumbnail.png',
  analysisStatus: 'completed',
  aiAnalysis: {
    summary: 'Working on authentication flow',
    detectedActivity: 'code',
    progressIndicators: {
      achievements: ['Implemented login'],
      blockers: [],
      insights: ['Good progress'],
    },
  },
  ...overrides,
});

describe('ScreenshotCard - Lazy Loading', () => {
  const sessionStartTime = new Date('2025-01-01T10:00:00Z').toISOString();

  describe('Test 1: Skeleton Placeholder', () => {
    it('should render skeleton placeholder initially (before intersection)', () => {
      const screenshot = createMockScreenshot();

      render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Should show skeleton with loading label
      const skeleton = screen.getByLabelText('Loading screenshot');
      expect(skeleton).toBeInTheDocument();

      // Should NOT load attachment yet (not intersecting)
      expect(screen.queryByAltText(/screenshot/i)).not.toBeInTheDocument();
    });

    it('should show skeleton with appropriate styling', () => {
      const screenshot = createMockScreenshot();

      render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      const skeleton = screen.getByLabelText('Loading screenshot');

      // Check for shimmer animation classes
      expect(skeleton.className).toMatch(/animate-pulse/);
      expect(skeleton.className).toMatch(/bg-gradient-to-r/);
    });
  });

  describe('Test 2: Intersection Observer Behavior', () => {
    it('should load image when scrolled into view (Intersection Observer)', async () => {
      const screenshot = createMockScreenshot();

      const { container } = render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Initially should show skeleton
      expect(screen.getByLabelText('Loading screenshot')).toBeInTheDocument();

      // Trigger intersection
      if (mockObserverInstance) {
        mockObserverInstance.triggerIntersection(true);
      }

      // Wait for attachment to load and image to appear
      await waitFor(() => {
        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
      });
    });

    it('should start loading 100px before entering viewport (rootMargin)', () => {
      const screenshot = createMockScreenshot();

      render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Check IntersectionObserver was created with correct options
      expect(global.IntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          rootMargin: '100px',
          threshold: 0,
        })
      );
    });

    it('should disconnect observer after first intersection', async () => {
      const screenshot = createMockScreenshot();

      render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      expect(mockObserverInstance).toBeTruthy();
      const disconnectSpy = vi.spyOn(mockObserverInstance!, 'disconnect');

      // Trigger intersection
      mockObserverInstance!.triggerIntersection(true);

      // Wait for state update
      await waitFor(() => {
        expect(disconnectSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Test 3: Lazy Loading Attributes', () => {
    it('should use loading="lazy" attribute', async () => {
      const screenshot = createMockScreenshot();

      const { container } = render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Trigger intersection to load image
      if (mockObserverInstance) {
        mockObserverInstance.triggerIntersection(true);
      }

      await waitFor(() => {
        const img = container.querySelector('img');
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });

    it('should use decoding="async" attribute', async () => {
      const screenshot = createMockScreenshot();

      const { container } = render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Trigger intersection to load image
      if (mockObserverInstance) {
        mockObserverInstance.triggerIntersection(true);
      }

      await waitFor(() => {
        const img = container.querySelector('img');
        expect(img).toHaveAttribute('decoding', 'async');
      });
    });
  });

  describe('Test 4: Image Load Success', () => {
    it('should show image when loaded (onLoad handler)', async () => {
      const screenshot = createMockScreenshot();

      const { container } = render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Trigger intersection
      if (mockObserverInstance) {
        mockObserverInstance.triggerIntersection(true);
      }

      // Wait for image to appear
      await waitFor(() => {
        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
      });

      // Simulate image load event
      const img = container.querySelector('img')!;
      img.dispatchEvent(new Event('load'));

      // Wait for imageLoaded state to update
      await waitFor(() => {
        expect(img.className).toMatch(/opacity-100/);
      });
    });

    it('should hide skeleton overlay after image loads', async () => {
      const screenshot = createMockScreenshot();

      const { container } = render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Trigger intersection
      if (mockObserverInstance) {
        mockObserverInstance.triggerIntersection(true);
      }

      // Wait for image to appear in DOM
      await waitFor(() => {
        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
      });

      // Simulate image load
      const img = container.querySelector('img')!;
      img.dispatchEvent(new Event('load'));

      // Wait for imageLoaded state to update and skeleton overlay to disappear
      await waitFor(() => {
        // Image should have full opacity after load
        expect(img.className).toMatch(/opacity-100/);

        // Count loading labels - initial skeleton might still be in DOM structure
        // but the overlay skeleton should be gone
        const loadingLabels = screen.queryAllByLabelText('Loading screenshot');
        expect(loadingLabels.length).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Test 5: Error Handling', () => {
    it('should handle load errors gracefully (shows error placeholder)', async () => {
      const screenshot = createMockScreenshot();

      const { container } = render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Trigger intersection
      if (mockObserverInstance) {
        mockObserverInstance.triggerIntersection(true);
      }

      // Wait for image to appear
      await waitFor(() => {
        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
      });

      // Simulate image error
      const img = container.querySelector('img')!;
      img.dispatchEvent(new Event('error'));

      // Should show error placeholder
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    it('should handle attachment loading errors', async () => {
      // Mock attachment storage to reject
      const { attachmentStorage } = await import('../../services/attachmentStorage');
      vi.mocked(attachmentStorage.getAttachment).mockRejectedValueOnce(
        new Error('Network error')
      );

      const screenshot = createMockScreenshot();

      const { container } = render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Trigger intersection
      if (mockObserverInstance) {
        mockObserverInstance.triggerIntersection(true);
      }

      // Should show error state
      await waitFor(() => {
        const errorElement = screen.getByRole('alert');
        expect(errorElement).toBeInTheDocument();
      });
    });
  });

  describe('Test 6: Accessibility', () => {
    it('should have proper alt text from AI analysis', async () => {
      const screenshot = createMockScreenshot({
        aiAnalysis: {
          summary: 'User working on authentication flow',
          detectedActivity: 'code',
          progressIndicators: {
            achievements: [],
            blockers: [],
            insights: [],
          },
        },
      });

      const { container } = render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Trigger intersection
      if (mockObserverInstance) {
        mockObserverInstance.triggerIntersection(true);
      }

      await waitFor(() => {
        const img = container.querySelector('img');
        expect(img).toHaveAttribute(
          'alt',
          expect.stringContaining('User working on authentication flow')
        );
      });
    });

    it('should have fallback alt text when AI analysis missing', async () => {
      const screenshot = createMockScreenshot({
        aiAnalysis: undefined,
      });

      const { container } = render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Trigger intersection
      if (mockObserverInstance) {
        mockObserverInstance.triggerIntersection(true);
      }

      await waitFor(() => {
        const img = container.querySelector('img');
        expect(img).toHaveAttribute('alt', 'Session screenshot');
      });
    });

    it('should have ARIA labels on skeleton placeholder', () => {
      const screenshot = createMockScreenshot();

      render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Skeleton should have proper ARIA label
      const skeleton = screen.getByLabelText('Loading screenshot');
      expect(skeleton).toHaveAttribute('role', 'img');
    });

    it('should have ARIA labels on error state', async () => {
      const screenshot = createMockScreenshot();

      const { container } = render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Trigger intersection
      if (mockObserverInstance) {
        mockObserverInstance.triggerIntersection(true);
      }

      // Wait for image and trigger error
      await waitFor(() => {
        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
      });

      const img = container.querySelector('img')!;
      img.dispatchEvent(new Event('error'));

      // Error state should have proper ARIA
      await waitFor(() => {
        const errorElement = screen.getByRole('alert');
        expect(errorElement).toHaveAttribute('aria-label', 'Failed to load screenshot');
      });
    });
  });

  describe('Test 7: Cleanup on Unmount', () => {
    it('should cleanup Intersection Observer on unmount', () => {
      const screenshot = createMockScreenshot();

      const { unmount } = render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      expect(mockObserverInstance).toBeTruthy();
      const disconnectSpy = vi.spyOn(mockObserverInstance!, 'disconnect');

      // Unmount component
      unmount();

      // Observer should be disconnected
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('Test 8: Performance - No Loading Without Intersection', () => {
    it('should NOT load attachment until intersecting (bandwidth optimization)', async () => {
      const { attachmentStorage } = await import('../../services/attachmentStorage');
      const getAttachmentSpy = vi.mocked(attachmentStorage.getAttachment);
      getAttachmentSpy.mockClear();

      const screenshot = createMockScreenshot();

      render(
        <ScreenshotCard
          screenshot={screenshot}
          sessionStartTime={sessionStartTime}
        />
      );

      // Wait a bit to ensure no premature loading
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should NOT have called getAttachment yet
      expect(getAttachmentSpy).not.toHaveBeenCalled();

      // Now trigger intersection
      if (mockObserverInstance) {
        mockObserverInstance.triggerIntersection(true);
      }

      // NOW it should load
      await waitFor(() => {
        expect(getAttachmentSpy).toHaveBeenCalledWith('attachment-1');
      });
    });
  });
});
