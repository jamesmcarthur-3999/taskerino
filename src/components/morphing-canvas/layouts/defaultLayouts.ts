/**
 * Default Layout Templates
 *
 * Pre-configured layout templates for common use cases
 */

import type { LayoutTemplate } from '../types';

/**
 * Dashboard Layout - Balanced grid with clock, actions, and notes
 */
export const dashboardLayout: LayoutTemplate = {
  id: 'dashboard',
  name: 'Dashboard',
  description: 'Balanced layout with clock, quick actions, and notes',
  gridConfig: {
    columns: 12,
    gap: '1.5rem',
    minHeight: '100vh',
  },
  slots: {
    // Top row - Clock (left), Quick Actions (right)
    clock: {
      mobile: {
        column: '1 / 13',
        row: '1 / 2',
      },
      tablet: {
        column: '1 / 7',
        row: '1 / 3',
      },
      desktop: {
        column: '1 / 7',
        row: '1 / 3',
      },
      wide: {
        column: '1 / 7',
        row: '1 / 3',
      },
    },
    'quick-actions': {
      mobile: {
        column: '1 / 13',
        row: '2 / 3',
      },
      tablet: {
        column: '7 / 13',
        row: '1 / 3',
      },
      desktop: {
        column: '7 / 13',
        row: '1 / 3',
      },
      wide: {
        column: '7 / 13',
        row: '1 / 3',
      },
    },
    // Bottom row - Notes (full width)
    notes: {
      mobile: {
        column: '1 / 13',
        row: '3 / 5',
      },
      tablet: {
        column: '1 / 13',
        row: '3 / 6',
      },
      desktop: {
        column: '1 / 13',
        row: '3 / 6',
      },
      wide: {
        column: '1 / 13',
        row: '3 / 6',
      },
    },
  },
};

/**
 * Focus Layout - Large content area with minimal sidebar
 */
export const focusLayout: LayoutTemplate = {
  id: 'focus',
  name: 'Focus',
  description: 'Large content area with compact sidebar',
  gridConfig: {
    columns: 12,
    gap: '1.5rem',
    minHeight: '100vh',
  },
  slots: {
    // Left sidebar - Clock and Quick Actions stacked
    clock: {
      mobile: {
        column: '1 / 13',
        row: '1 / 2',
      },
      tablet: {
        column: '1 / 5',
        row: '1 / 3',
      },
      desktop: {
        column: '1 / 4',
        row: '1 / 3',
      },
      wide: {
        column: '1 / 3',
        row: '1 / 3',
      },
    },
    'quick-actions': {
      mobile: {
        column: '1 / 13',
        row: '2 / 3',
      },
      tablet: {
        column: '1 / 5',
        row: '3 / 5',
      },
      desktop: {
        column: '1 / 4',
        row: '3 / 5',
      },
      wide: {
        column: '1 / 3',
        row: '3 / 5',
      },
    },
    // Main content - Notes
    notes: {
      mobile: {
        column: '1 / 13',
        row: '3 / 6',
      },
      tablet: {
        column: '5 / 13',
        row: '1 / 6',
      },
      desktop: {
        column: '4 / 13',
        row: '1 / 6',
      },
      wide: {
        column: '3 / 13',
        row: '1 / 6',
      },
    },
  },
};

/**
 * Compact Layout - Three column layout
 */
export const compactLayout: LayoutTemplate = {
  id: 'compact',
  name: 'Compact',
  description: 'Three column layout for maximum information density',
  gridConfig: {
    columns: 12,
    gap: '1rem',
    minHeight: '100vh',
  },
  slots: {
    clock: {
      mobile: {
        column: '1 / 13',
        row: '1 / 2',
      },
      tablet: {
        column: '1 / 7',
        row: '1 / 4',
      },
      desktop: {
        column: '1 / 5',
        row: '1 / 4',
      },
      wide: {
        column: '1 / 5',
        row: '1 / 4',
      },
    },
    'quick-actions': {
      mobile: {
        column: '1 / 13',
        row: '2 / 3',
      },
      tablet: {
        column: '7 / 13',
        row: '1 / 4',
      },
      desktop: {
        column: '5 / 9',
        row: '1 / 4',
      },
      wide: {
        column: '5 / 9',
        row: '1 / 4',
      },
    },
    notes: {
      mobile: {
        column: '1 / 13',
        row: '3 / 5',
      },
      tablet: {
        column: '1 / 13',
        row: '4 / 7',
      },
      desktop: {
        column: '9 / 13',
        row: '1 / 4',
      },
      wide: {
        column: '9 / 13',
        row: '1 / 4',
      },
    },
  },
};

/**
 * Zen Layout - Minimal, centered layout
 */
export const zenLayout: LayoutTemplate = {
  id: 'zen',
  name: 'Zen',
  description: 'Minimal centered layout for distraction-free focus',
  gridConfig: {
    columns: 12,
    gap: '2rem',
    minHeight: '100vh',
  },
  slots: {
    clock: {
      mobile: {
        column: '1 / 13',
        row: '1 / 2',
      },
      tablet: {
        column: '3 / 11',
        row: '1 / 2',
      },
      desktop: {
        column: '4 / 10',
        row: '2 / 3',
      },
      wide: {
        column: '5 / 9',
        row: '2 / 3',
      },
    },
    'quick-actions': {
      mobile: {
        column: '1 / 13',
        row: '2 / 3',
      },
      tablet: {
        column: '3 / 11',
        row: '2 / 3',
      },
      desktop: {
        column: '4 / 10',
        row: '3 / 4',
      },
      wide: {
        column: '5 / 9',
        row: '3 / 4',
      },
    },
    notes: {
      mobile: {
        column: '1 / 13',
        row: '3 / 5',
      },
      tablet: {
        column: '3 / 11',
        row: '3 / 6',
      },
      desktop: {
        column: '4 / 10',
        row: '4 / 7',
      },
      wide: {
        column: '5 / 9',
        row: '4 / 7',
      },
    },
  },
};

/**
 * All available layouts
 */
export const defaultLayouts = {
  dashboard: dashboardLayout,
  focus: focusLayout,
  compact: compactLayout,
  zen: zenLayout,
};

/**
 * Get a layout by ID
 */
export function getLayoutById(id: string): LayoutTemplate | undefined {
  return defaultLayouts[id as keyof typeof defaultLayouts];
}

/**
 * Get all layout IDs
 */
export function getAllLayoutIds(): string[] {
  return Object.keys(defaultLayouts);
}
