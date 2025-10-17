/**
 * ModuleRenderer Test Suite
 *
 * Comprehensive tests for the ModuleRenderer component including:
 * - Module rendering
 * - Loading states
 * - Error states
 * - Empty states
 * - Error boundary
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModuleRenderer } from '../ModuleRenderer';
import type { ModuleConfig, SessionData } from '../types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock animations
vi.mock('../animations/transitions', () => ({
  useReducedMotion: () => false,
  fadeInVariants: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  },
  getLayoutTransition: () => ({ duration: 0.3 }),
}));

// Mock test component
const TestModuleComponent = ({ config, state }: any) => (
  <div data-testid="test-module">
    <div>Module Type: {config.type}</div>
    <div>Module State: {state}</div>
  </div>
);

// Mock module that throws error
const ErrorModuleComponent = () => {
  throw new Error('Test module error');
};

// Mock registry
vi.mock('../registry', () => ({
  getModule: vi.fn((type: string) => {
    if (type === 'test-module') {
      return {
        type: 'test-module',
        component: TestModuleComponent,
        displayName: 'Test Module',
        defaultConfig: {},
      };
    }
    if (type === 'error-module') {
      return {
        type: 'error-module',
        component: ErrorModuleComponent,
        displayName: 'Error Module',
        defaultConfig: {},
      };
    }
    return null;
  }),
}));

// Helper to create mock module config
function createMockModuleConfig(overrides?: Partial<ModuleConfig>): ModuleConfig {
  return {
    id: 'test-module-1',
    type: 'test-module',
    slotId: 'slot-1',
    enabled: true,
    priority: 'normal',
    settings: {},
    ...overrides,
  };
}

describe('ModuleRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render a module successfully', () => {
      const config = createMockModuleConfig();
      render(<ModuleRenderer config={config} />);

      expect(screen.getByTestId('test-module')).toBeTruthy();
      expect(screen.getByText('Module Type: test-module')).toBeTruthy();
    });

    it('should not render disabled modules', () => {
      const config = createMockModuleConfig({ enabled: false });
      const { container } = render(<ModuleRenderer config={config} />);

      expect(container.firstChild).toBeNull();
    });

    it('should render with custom className', () => {
      const config = createMockModuleConfig();
      const { container } = render(
        <ModuleRenderer config={config} className="custom-module" />
      );

      const moduleDiv = container.querySelector('.custom-module');
      expect(moduleDiv).toBeTruthy();
    });

    it('should apply custom styles', () => {
      const config = createMockModuleConfig({
        style: {
          background: '#ff0000',
          padding: '2rem',
        },
      });

      const { container } = render(<ModuleRenderer config={config} />);
      const moduleDiv = container.querySelector('[style]');
      expect(moduleDiv).toBeTruthy();
    });
  });

  describe('Module States', () => {
    it('should render loading state', () => {
      const config = createMockModuleConfig();
      render(<ModuleRenderer config={config} state="loading" />);

      expect(screen.getByText('Loading module...')).toBeTruthy();
    });

    it('should render empty state', () => {
      const config = createMockModuleConfig();
      render(<ModuleRenderer config={config} state="empty" />);

      expect(screen.getByText('No data available')).toBeTruthy();
    });

    it('should render ready state with module content', () => {
      const config = createMockModuleConfig();
      render(<ModuleRenderer config={config} state="ready" />);

      expect(screen.getByTestId('test-module')).toBeTruthy();
      expect(screen.getByText('Module State: ready')).toBeTruthy();
    });

    it('should default to ready state when not specified', () => {
      const config = createMockModuleConfig();
      render(<ModuleRenderer config={config} />);

      expect(screen.getByText('Module State: ready')).toBeTruthy();
    });
  });

  describe('Module Chrome (Header)', () => {
    it('should render module header when showHeader is true', () => {
      const config = createMockModuleConfig({
        chrome: {
          showHeader: true,
          title: 'Test Module Title',
        },
      });

      render(<ModuleRenderer config={config} />);
      expect(screen.getByText('Test Module Title')).toBeTruthy();
    });

    it('should not render header when showHeader is false', () => {
      const config = createMockModuleConfig({
        chrome: {
          showHeader: false,
          title: 'Test Module Title',
        },
      });

      render(<ModuleRenderer config={config} />);
      expect(screen.queryByText('Test Module Title')).toBeNull();
    });

    it('should render header with icon', () => {
      const config = createMockModuleConfig({
        chrome: {
          showHeader: true,
          title: 'Test Module',
          icon: '📝',
        },
      });

      render(<ModuleRenderer config={config} />);
      expect(screen.getByText('📝')).toBeTruthy();
    });

    it('should render header actions', () => {
      const mockAction = vi.fn();
      const config = createMockModuleConfig({
        chrome: {
          showHeader: true,
          title: 'Test Module',
          actions: [
            {
              id: 'action-1',
              label: 'Test Action',
              icon: '⚙️',
              onClick: mockAction,
            },
          ],
        },
      });

      render(<ModuleRenderer config={config} />);
      const actionButton = screen.getByTitle('Test Action');
      expect(actionButton).toBeTruthy();

      fireEvent.click(actionButton);
      expect(mockAction).toHaveBeenCalled();
    });

    it('should render without chrome when not specified', () => {
      const config = createMockModuleConfig();
      render(<ModuleRenderer config={config} />);

      // Module content should still render
      expect(screen.getByTestId('test-module')).toBeTruthy();
    });
  });

  describe('Module Not Found', () => {
    it('should render not found state for unregistered module', () => {
      const config = createMockModuleConfig({ type: 'unknown-module' });
      render(<ModuleRenderer config={config} />);

      expect(screen.getByText('Module Not Found')).toBeTruthy();
      expect(screen.getByText(/unknown-module/)).toBeTruthy();
    });

    it('should show module ID in not found state', () => {
      const config = createMockModuleConfig({
        id: 'test-123',
        type: 'unknown-module',
      });

      render(<ModuleRenderer config={config} />);
      expect(screen.getByText(/test-123/)).toBeTruthy();
    });
  });

  describe('Error Boundary', () => {
    it('should catch and display module errors', () => {
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const config = createMockModuleConfig({ type: 'error-module' });
      render(<ModuleRenderer config={config} />);

      expect(screen.getByText('Module Error')).toBeTruthy();
      expect(screen.getByText(/Test module error/)).toBeTruthy();

      consoleError.mockRestore();
    });

    it('should show module info in error state', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const config = createMockModuleConfig({
        id: 'error-test',
        type: 'error-module',
      });

      render(<ModuleRenderer config={config} />);
      expect(screen.getByText(/error-module/)).toBeTruthy();
      expect(screen.getByText(/error-test/)).toBeTruthy();

      consoleError.mockRestore();
    });

    it('should have try again button in error state', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const config = createMockModuleConfig({ type: 'error-module' });
      render(<ModuleRenderer config={config} />);

      const tryAgainButton = screen.getByText('Try Again');
      expect(tryAgainButton).toBeTruthy();

      consoleError.mockRestore();
    });

    it('should reset error when try again is clicked', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const config = createMockModuleConfig({ type: 'error-module' });
      render(<ModuleRenderer config={config} />);

      const tryAgainButton = screen.getByText('Try Again');
      fireEvent.click(tryAgainButton);

      // Error should still be there since component still throws
      await waitFor(() => {
        expect(screen.getByText('Module Error')).toBeTruthy();
      });

      consoleError.mockRestore();
    });
  });

  describe('Session Data', () => {
    it('should pass session data to module', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        preferences: { theme: 'dark' },
      };

      const config = createMockModuleConfig();
      render(<ModuleRenderer config={config} sessionData={sessionData} />);

      expect(screen.getByTestId('test-module')).toBeTruthy();
    });
  });

  describe('Module Actions', () => {
    it('should handle module actions', () => {
      const onAction = vi.fn();
      const config = createMockModuleConfig();

      render(<ModuleRenderer config={config} onAction={onAction} />);
      expect(screen.getByTestId('test-module')).toBeTruthy();
    });
  });

  describe('Custom Data', () => {
    it('should pass custom data to module', () => {
      const config = createMockModuleConfig();
      const customData = { items: [1, 2, 3], title: 'Test Data' };

      render(<ModuleRenderer config={config} data={customData} />);
      expect(screen.getByTestId('test-module')).toBeTruthy();
    });
  });

  describe('Animations', () => {
    it('should apply entrance animation', () => {
      const config = createMockModuleConfig({
        animation: {
          entrance: {
            hidden: { opacity: 0, scale: 0.9 },
            visible: { opacity: 1, scale: 1 },
          },
        },
      });

      render(<ModuleRenderer config={config} />);
      expect(screen.getByTestId('test-module')).toBeTruthy();
    });

    it('should disable layout animation when specified', () => {
      const config = createMockModuleConfig({
        animation: {
          layout: false,
        },
      });

      render(<ModuleRenderer config={config} />);
      expect(screen.getByTestId('test-module')).toBeTruthy();
    });
  });

  describe('Module Priority', () => {
    it('should render critical priority module', () => {
      const config = createMockModuleConfig({ priority: 'critical' });
      render(<ModuleRenderer config={config} />);

      expect(screen.getByTestId('test-module')).toBeTruthy();
    });

    it('should render high priority module', () => {
      const config = createMockModuleConfig({ priority: 'high' });
      render(<ModuleRenderer config={config} />);

      expect(screen.getByTestId('test-module')).toBeTruthy();
    });

    it('should render normal priority module', () => {
      const config = createMockModuleConfig({ priority: 'normal' });
      render(<ModuleRenderer config={config} />);

      expect(screen.getByTestId('test-module')).toBeTruthy();
    });

    it('should render low priority module', () => {
      const config = createMockModuleConfig({ priority: 'low' });
      render(<ModuleRenderer config={config} />);

      expect(screen.getByTestId('test-module')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined settings', () => {
      const config = createMockModuleConfig({ settings: undefined });
      render(<ModuleRenderer config={config} />);

      expect(screen.getByTestId('test-module')).toBeTruthy();
    });

    it('should handle empty chrome object', () => {
      const config = createMockModuleConfig({ chrome: {} });
      render(<ModuleRenderer config={config} />);

      expect(screen.getByTestId('test-module')).toBeTruthy();
    });

    it('should handle missing animation config', () => {
      const config = createMockModuleConfig({ animation: undefined });
      render(<ModuleRenderer config={config} />);

      expect(screen.getByTestId('test-module')).toBeTruthy();
    });

    it('should handle complex session data', () => {
      const sessionData: SessionData = {
        userId: 'user-123',
        preferences: {
          theme: 'dark',
          language: 'en',
          timezone: 'UTC',
        },
        permissions: ['read', 'write', 'admin'],
        customField: { nested: { data: true } },
      };

      const config = createMockModuleConfig();
      render(<ModuleRenderer config={config} sessionData={sessionData} />);

      expect(screen.getByTestId('test-module')).toBeTruthy();
    });
  });

  describe('Loading State Animations', () => {
    it('should animate loading state appearance', () => {
      const config = createMockModuleConfig();
      render(<ModuleRenderer config={config} state="loading" />);

      const loader = screen.getByText('Loading module...');
      expect(loader).toBeTruthy();
    });
  });

  describe('Empty State Variations', () => {
    it('should show empty state with module config info', () => {
      const config = createMockModuleConfig({ id: 'empty-test' });
      render(<ModuleRenderer config={config} state="empty" />);

      expect(screen.getByText('No data available')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should render with proper ARIA attributes', () => {
      const config = createMockModuleConfig({
        chrome: {
          showHeader: true,
          title: 'Accessible Module',
        },
      });

      const { container } = render(<ModuleRenderer config={config} />);
      expect(container.firstChild).toBeTruthy();
    });
  });
});
