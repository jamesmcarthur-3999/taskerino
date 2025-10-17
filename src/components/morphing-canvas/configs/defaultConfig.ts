/**
 * Default Morphing Canvas Configuration
 *
 * Example configuration showing how to set up the morphing canvas
 */

import type { MorphingCanvasConfig, ThemeConfig } from '../types';
import {
  dashboardLayout,
  focusLayout,
  compactLayout,
  zenLayout,
} from '../layouts/defaultLayouts';

/**
 * Default theme configuration
 */
export const defaultTheme: ThemeConfig = {
  mode: 'light',
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#f59e0b',
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
    small: '0.5rem',
    medium: '1rem',
    large: '1.5rem',
  },
  spacing: {
    unit: 8,
  },
  typography: {
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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

/**
 * Dark theme configuration
 */
export const darkTheme: ThemeConfig = {
  ...defaultTheme,
  mode: 'dark',
  colors: {
    primary: '#60a5fa',
    secondary: '#a78bfa',
    accent: '#fbbf24',
    background: '#111827',
    surface: '#1f2937',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    border: '#374151',
    error: '#f87171',
    warning: '#fbbf24',
    success: '#34d399',
    info: '#60a5fa',
  },
};

/**
 * Default morphing canvas configuration
 */
export const defaultMorphingCanvasConfig: MorphingCanvasConfig = {
  id: 'default-canvas',
  name: 'Default Canvas',
  description: 'Default morphing canvas configuration',

  // Layout
  layout: dashboardLayout,
  alternativeLayouts: [focusLayout, compactLayout, zenLayout],

  // Theme
  theme: defaultTheme,

  // Modules
  modules: [
    {
      id: 'clock-1',
      type: 'clock',
      slotId: 'clock',
      priority: 'high',
      enabled: true,
      settings: {
        format24h: false,
        showSeconds: true,
        showDate: true,
      },
      chrome: {
        showHeader: false,
      },
      style: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem',
      },
    },
    {
      id: 'quick-actions-1',
      type: 'quick-actions',
      slotId: 'quick-actions',
      priority: 'normal',
      enabled: true,
      settings: {
        columns: 2,
        actions: [
          {
            id: 'new-task',
            label: 'New Task',
            icon: 'plus',
            color: 'blue',
            action: 'create-task',
          },
          {
            id: 'new-note',
            label: 'New Note',
            icon: 'fileText',
            color: 'green',
            action: 'create-note',
          },
          {
            id: 'schedule',
            label: 'Schedule',
            icon: 'calendar',
            color: 'purple',
            action: 'open-calendar',
          },
          {
            id: 'timer',
            label: 'Timer',
            icon: 'clock',
            color: 'orange',
            action: 'start-timer',
          },
        ],
      },
      chrome: {
        showHeader: true,
        title: 'Quick Actions',
      },
    },
    {
      id: 'notes-1',
      type: 'notes',
      slotId: 'notes',
      priority: 'normal',
      enabled: true,
      chrome: {
        showHeader: false,
      },
    },
  ],

  // Behavior
  behavior: {
    enableAnimations: true,
    respectReducedMotion: true,
    enableAutoLayout: false,
    persistState: true,
  },

  // Metadata
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'System',
    tags: ['default', 'dashboard'],
  },
};

/**
 * Example configurations for different use cases
 */
export const exampleConfigs = {
  default: defaultMorphingCanvasConfig,

  // Minimal configuration
  minimal: {
    ...defaultMorphingCanvasConfig,
    id: 'minimal-canvas',
    name: 'Minimal Canvas',
    description: 'Minimal canvas with just clock and notes',
    layout: zenLayout,
    alternativeLayouts: [dashboardLayout],
    modules: [
      {
        id: 'clock-minimal',
        type: 'clock',
        slotId: 'clock',
        priority: 'high',
        enabled: true,
        settings: {
          format24h: true,
          showSeconds: false,
          showDate: true,
        },
        chrome: {
          showHeader: false,
        },
      },
      {
        id: 'notes-minimal',
        type: 'notes',
        slotId: 'notes',
        priority: 'normal',
        enabled: true,
        chrome: {
          showHeader: false,
        },
      },
    ],
  } as MorphingCanvasConfig,

  // Dark mode configuration
  dark: {
    ...defaultMorphingCanvasConfig,
    id: 'dark-canvas',
    name: 'Dark Mode Canvas',
    description: 'Canvas with dark theme',
    theme: darkTheme,
  } as MorphingCanvasConfig,
};

/**
 * Get a config by ID
 */
export function getConfigById(
  id: keyof typeof exampleConfigs
): MorphingCanvasConfig {
  return exampleConfigs[id];
}
