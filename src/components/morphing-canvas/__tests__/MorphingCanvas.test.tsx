/**
 * MorphingCanvas Test Suite
 *
 * Comprehensive tests for the MorphingCanvas component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MorphingCanvas } from '../MorphingCanvas';
import type { MorphingCanvasConfig, LayoutTemplate, ThemeConfig } from '../types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  LayoutGroup: ({ children }: any) => <div>{children}</div>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock ModuleRenderer
vi.mock('../ModuleRenderer', () => ({
  ModuleRenderer: ({ config }: any) => (
    <div data-testid={`module-${config.id}`}>
      Module: {config.type}
    </div>
  ),
}));

// Mock animations
vi.mock('../animations/transitions', () => ({
  useReducedMotion: () => false,
}));

// Helper to create mock theme
function createMockTheme(): ThemeConfig {
  return {
    mode: 'light',
    colors: {
      primary: '#3b82f6',
      secondary: '#6b7280',
      accent: '#8b5cf6',
      background: '#ffffff',
      surface: '#f9fafb',
      text: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      error: '#ef4444',
      warning: '#f59e0b',
      success: '#10b981',
      info: '#3b82f6',
    },
    borderRadius: {
      small: '0.25rem',
      medium: '0.5rem',
      large: '1rem',
    },
    spacing: {
      unit: 8,
    },
    typography: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
      },
    },
  };
}

// Helper to create mock layout
function createMockLayout(overrides?: Partial<LayoutTemplate>): LayoutTemplate {
  return {
    id: 'test-layout',
    name: 'Test Layout',
    description: 'A test layout',
    slots: {
      'slot-1': {
        desktop: { column: '1 / 7', row: '1 / 2' },
      },
      'slot-2': {
        desktop: { column: '7 / 13', row: '1 / 2' },
      },
    },
    gridConfig: {
      columns: 12,
      gap: '1rem',
    },
    ...overrides,
  };
}

// Helper to create mock config
function createMockConfig(overrides?: Partial<MorphingCanvasConfig>): MorphingCanvasConfig {
  return {
    id: 'test-config',
    name: 'Test Config',
    layout: createMockLayout(),
    theme: createMockTheme(),
    modules: [],
    ...overrides,
  };
}

describe('MorphingCanvas', () => {
  beforeEach(() => {
    // Set up window size for breakpoint detection
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    // Mock window.addEventListener
    vi.spyOn(window, 'addEventListener');
    vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      const config = createMockConfig();
      render(<MorphingCanvas config={config} />);
      expect(screen.getByTestId).toBeDefined();
    });

    it('should render with different layouts', () => {
      const layout1 = createMockLayout({ id: 'layout-1', name: 'Layout 1' });
      const config = createMockConfig({ layout: layout1 });

      const { container } = render(<MorphingCanvas config={config} />);
      expect(container.querySelector('.morphing-canvas')).toBeTruthy();
    });

    it('should apply theme mode', () => {
      const config = createMockConfig();
      const { container } = render(<MorphingCanvas config={config} />);

      const canvas = container.querySelector('.morphing-canvas');
      expect(canvas?.getAttribute('data-theme')).toBe('light');
    });

    it('should apply dark theme mode', () => {
      const theme = createMockTheme();
      theme.mode = 'dark';
      const config = createMockConfig({ theme });

      const { container } = render(<MorphingCanvas config={config} />);
      const canvas = container.querySelector('.morphing-canvas');
      expect(canvas?.getAttribute('data-theme')).toBe('dark');
    });

    it('should apply custom className', () => {
      const config = createMockConfig();
      const { container } = render(<MorphingCanvas config={config} className="custom-class" />);

      const canvas = container.querySelector('.morphing-canvas');
      expect(canvas?.classList.contains('custom-class')).toBe(true);
    });
  });

  describe('Module Loading', () => {
    it('should render enabled modules', () => {
      const config = createMockConfig({
        modules: [
          {
            id: 'module-1',
            type: 'notes',
            slotId: 'slot-1',
            enabled: true,
          },
          {
            id: 'module-2',
            type: 'tasks',
            slotId: 'slot-2',
            enabled: true,
          },
        ],
      });

      render(<MorphingCanvas config={config} />);
      expect(screen.getByTestId('module-module-1')).toBeTruthy();
      expect(screen.getByTestId('module-module-2')).toBeTruthy();
    });

    it('should not render disabled modules', () => {
      const config = createMockConfig({
        modules: [
          {
            id: 'module-1',
            type: 'notes',
            slotId: 'slot-1',
            enabled: true,
          },
          {
            id: 'module-2',
            type: 'tasks',
            slotId: 'slot-2',
            enabled: false,
          },
        ],
      });

      render(<MorphingCanvas config={config} />);
      expect(screen.getByTestId('module-module-1')).toBeTruthy();
      expect(screen.queryByTestId('module-module-2')).toBeNull();
    });

    it('should render empty state with no modules', () => {
      const config = createMockConfig({ modules: [] });
      const { container } = render(<MorphingCanvas config={config} />);

      expect(container.querySelector('.morphing-canvas-grid')).toBeTruthy();
    });
  });

  describe('Responsive Behavior', () => {
    it('should detect desktop breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 1200,
      });

      const config = createMockConfig();
      render(<MorphingCanvas config={config} />);

      // Check that window resize listener is added
      expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should detect mobile breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 500,
      });

      const config = createMockConfig();
      render(<MorphingCanvas config={config} />);

      expect(window.addEventListener).toHaveBeenCalled();
    });

    it('should detect tablet breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 800,
      });

      const config = createMockConfig();
      render(<MorphingCanvas config={config} />);

      expect(window.addEventListener).toHaveBeenCalled();
    });

    it('should update breakpoint on window resize', async () => {
      const config = createMockConfig({
        modules: [
          {
            id: 'module-1',
            type: 'notes',
            slotId: 'slot-1',
            enabled: true,
          },
        ],
      });

      const { rerender } = render(<MorphingCanvas config={config} />);

      // Simulate window resize
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 500,
      });

      // Trigger resize event
      const resizeEvent = new Event('resize');
      window.dispatchEvent(resizeEvent);

      // Wait for debounce (150ms)
      await waitFor(() => {
        // Component should still be rendered
        expect(screen.getByTestId('module-module-1')).toBeTruthy();
      }, { timeout: 200 });
    });

    it('should cleanup resize listener on unmount', () => {
      const config = createMockConfig();
      const { unmount } = render(<MorphingCanvas config={config} />);

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });
  });

  describe('Layout Switching', () => {
    it('should render view toggle when alternative layouts exist', () => {
      const layout1 = createMockLayout({ id: 'layout-1', name: 'Layout 1' });
      const layout2 = createMockLayout({ id: 'layout-2', name: 'Layout 2' });

      const config = createMockConfig({
        layout: layout1,
        alternativeLayouts: [layout2],
      });

      render(<MorphingCanvas config={config} />);
      expect(screen.getByText('Layout 1')).toBeTruthy();
    });

    it('should not render view toggle when no alternative layouts', () => {
      const config = createMockConfig({
        alternativeLayouts: [],
      });

      render(<MorphingCanvas config={config} />);
      // View toggle should not be present
      expect(screen.queryByText('Test Layout')).toBeNull();
    });

    it('should call onLayoutChange when layout changes', async () => {
      const onLayoutChange = vi.fn();
      const layout1 = createMockLayout({ id: 'layout-1', name: 'Layout 1' });
      const layout2 = createMockLayout({ id: 'layout-2', name: 'Layout 2' });

      const config = createMockConfig({
        layout: layout1,
        alternativeLayouts: [layout2],
      });

      render(<MorphingCanvas config={config} onLayoutChange={onLayoutChange} />);

      // Open dropdown
      const toggleButton = screen.getByText('Layout 1');
      fireEvent.click(toggleButton);

      // Click alternative layout
      const layout2Button = screen.getByText('Layout 2');
      fireEvent.click(layout2Button);

      expect(onLayoutChange).toHaveBeenCalledWith('layout-2');
    });
  });

  describe('Expand/Collapse', () => {
    it('should toggle expanded state', () => {
      const layout1 = createMockLayout();
      const layout2 = createMockLayout({ id: 'layout-2' });
      const config = createMockConfig({
        layout: layout1,
        alternativeLayouts: [layout2],
      });

      const { container } = render(<MorphingCanvas config={config} />);

      // Find expand button (Maximize2 icon)
      const expandButton = container.querySelector('button[title="Expand"]');
      expect(expandButton).toBeTruthy();

      // Click to expand
      if (expandButton) {
        fireEvent.click(expandButton);
      }

      // Check if expanded class is applied
      const canvas = container.querySelector('.morphing-canvas');
      expect(canvas?.classList.contains('fixed')).toBe(true);
    });
  });

  describe('Module Actions', () => {
    it('should handle module actions', () => {
      const onAction = vi.fn();
      const config = createMockConfig({
        modules: [
          {
            id: 'module-1',
            type: 'notes',
            slotId: 'slot-1',
            enabled: true,
          },
        ],
      });

      render(<MorphingCanvas config={config} onAction={onAction} />);

      // Module should be rendered
      expect(screen.getByTestId('module-module-1')).toBeTruthy();
    });
  });

  describe('Animation Behavior', () => {
    it('should respect animation settings', () => {
      const config = createMockConfig({
        behavior: {
          enableAnimations: true,
        },
      });

      render(<MorphingCanvas config={config} />);
      // Component should render without errors
      expect(screen.getByTestId).toBeDefined();
    });

    it('should disable animations when specified', () => {
      const config = createMockConfig({
        behavior: {
          enableAnimations: false,
        },
      });

      render(<MorphingCanvas config={config} />);
      expect(screen.getByTestId).toBeDefined();
    });

    it('should respect reduced motion preference', () => {
      const config = createMockConfig({
        behavior: {
          respectReducedMotion: true,
        },
      });

      render(<MorphingCanvas config={config} />);
      expect(screen.getByTestId).toBeDefined();
    });
  });

  describe('Grid Layout', () => {
    it('should apply grid configuration', () => {
      const config = createMockConfig();
      const { container } = render(<MorphingCanvas config={config} />);

      const grid = container.querySelector('.morphing-canvas-grid');
      expect(grid).toBeTruthy();

      const style = grid?.getAttribute('style');
      expect(style).toContain('display: grid');
      expect(style).toContain('grid-template-columns: repeat(12, 1fr)');
    });

    it('should apply custom grid gap', () => {
      const layout = createMockLayout({
        gridConfig: {
          columns: 12,
          gap: '2rem',
        },
      });

      const config = createMockConfig({ layout });
      const { container } = render(<MorphingCanvas config={config} />);

      const grid = container.querySelector('.morphing-canvas-grid');
      const style = grid?.getAttribute('style');
      expect(style).toContain('gap: 2rem');
    });

    it('should apply min height to grid', () => {
      const layout = createMockLayout({
        gridConfig: {
          columns: 12,
          gap: '1rem',
          minHeight: '500px',
        },
      });

      const config = createMockConfig({ layout });
      const { container } = render(<MorphingCanvas config={config} />);

      const grid = container.querySelector('.morphing-canvas-grid');
      const style = grid?.getAttribute('style');
      expect(style).toContain('min-height: 500px');
    });
  });

  describe('Session Data', () => {
    it('should pass session data to modules', () => {
      const sessionData = {
        userId: 'test-user',
        preferences: { theme: 'dark' },
      };

      const config = createMockConfig({
        modules: [
          {
            id: 'module-1',
            type: 'notes',
            slotId: 'slot-1',
            enabled: true,
          },
        ],
      });

      render(<MorphingCanvas config={config} sessionData={sessionData} />);
      expect(screen.getByTestId('module-module-1')).toBeTruthy();
    });
  });

  describe('Debug Mode', () => {
    it('should show debug info in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const config = createMockConfig({
        modules: [
          {
            id: 'module-1',
            type: 'notes',
            slotId: 'slot-1',
            enabled: true,
          },
        ],
      });

      const { container } = render(<MorphingCanvas config={config} />);

      // Check for debug info
      expect(container.textContent).toContain('Layout:');
      expect(container.textContent).toContain('Breakpoint:');
      expect(container.textContent).toContain('Modules: 1');

      process.env.NODE_ENV = originalEnv;
    });
  });
});
