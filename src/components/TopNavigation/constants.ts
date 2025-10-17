/**
 * TopNavigation - Constants
 *
 * Configuration constants for navigation behavior and animation
 */

import { Edit3, CheckSquare, BookOpen, Activity } from 'lucide-react';
import type { TabConfig } from './types';

/**
 * Navigation tabs configuration
 */
export const tabs: TabConfig[] = [
  { id: 'capture', label: 'Capture', icon: Edit3, shortcut: '⌘1' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, shortcut: '⌘2' },
  { id: 'notes', label: 'Notes', icon: BookOpen, shortcut: '⌘3' },
  { id: 'sessions', label: 'Sessions', icon: Activity, shortcut: '⌘5' },
];

/**
 * Navigation scroll animation constants
 */
export const NAV_CONSTANTS = {
  // Scroll ranges for morphing animations
  SCROLL_MORPH_RANGE: 300,
  LOGO_FADE_START: 50,
  MENU_REVEAL_START: 150,

  // Layout constants
  BUTTON_HEIGHT: 82,
  ISLAND_MAX_WIDTH: '32rem',

  // Scroll thresholds
  LOGO_FADE_END: 300,
  MENU_FADE_END: 300,
} as const;

/**
 * Animation configuration
 */
export const ANIMATION_CONFIG = {
  // Island expansion
  island: {
    expandDuration: '0.5s',
    expandEasing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    collapseDuration: '0.35s',
    collapseEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Mode transitions
  mode: {
    duration: '0.4s',
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  // Logo/Menu morph
  morph: {
    logoFadeRange: 250, // pixels (from 50 to 300)
    menuFadeRange: 150, // pixels (from 150 to 300)
  },
} as const;

/**
 * Z-index hierarchy
 */
export const Z_INDEX = {
  overlay: 30,
  navigation: 50,
  dropdown: 9999,
} as const;
