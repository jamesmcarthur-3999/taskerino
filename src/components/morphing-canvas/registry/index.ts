/**
 * Module Registry Index
 *
 * Imports and registers all available modules
 */

import { registerModules } from './moduleRegistry';
import { ClockModule } from '../modules/ClockModule';
import { QuickActionsModule } from '../modules/QuickActionsModule';
import { NotesModule } from '../modules/NotesModule';
import { TaskModule } from '../modules/TaskModule';
import { TimelineModule } from '../modules/TimelineModule';
import { ScreenshotGalleryModule } from '../modules/ScreenshotGalleryModule';
import { VideoChapterNavigatorModule } from '../modules/VideoChapterNavigatorModule';
import { CodeChangesModule } from '../modules/CodeChangesModule';
import type { ModuleDefinition } from '../types';
import { slideUpVariants } from '../animations/transitions';
import { bridgeRegistries, verifyRegistrySync } from './registryBridge';

/**
 * All available module definitions
 */
export const moduleDefinitions: ModuleDefinition[] = [
  {
    type: 'clock',
    component: ClockModule,
    displayName: 'Clock',
    description: 'Display current time and date',
    defaultConfig: {
      id: '',
      type: 'clock',
      slotId: '',
      settings: {
        format24h: false,
        showSeconds: true,
        showDate: true,
      },
      chrome: {
        showHeader: false,
      },
      animation: {
        entrance: slideUpVariants,
      },
    },
  },
  {
    type: 'quick-actions',
    component: QuickActionsModule,
    displayName: 'Quick Actions',
    description: 'Quick action buttons for common tasks',
    defaultConfig: {
      id: '',
      type: 'quick-actions',
      slotId: '',
      settings: {
        columns: 2,
      },
      chrome: {
        showHeader: true,
        title: 'Quick Actions',
      },
      animation: {
        entrance: slideUpVariants,
      },
    },
  },
  {
    type: 'notes',
    component: NotesModule,
    displayName: 'Notes',
    description: 'Simple note-taking module',
    defaultConfig: {
      id: '',
      type: 'notes',
      slotId: '',
      chrome: {
        showHeader: false,
      },
      animation: {
        entrance: slideUpVariants,
      },
    },
  },
  {
    type: 'task-action-item',
    component: TaskModule,
    displayName: 'Task Action Item',
    description: 'Display and manage tasks with multiple view variants',
    defaultConfig: {
      id: '',
      type: 'task-action-item',
      slotId: '',
      settings: {
        sortBy: 'priority',
        showCompleted: true,
        compactSpacing: false,
      },
      chrome: {
        showHeader: true,
        title: 'Tasks',
      },
      animation: {
        entrance: slideUpVariants,
      },
    },
  },
  {
    type: 'timeline',
    component: TimelineModule,
    displayName: 'Timeline',
    description: 'Visualize events and focus periods in a timeline',
    defaultConfig: {
      id: '',
      type: 'timeline',
      slotId: '',
      settings: {
        showDuration: true,
        showFocusPeriods: true,
        enableScrubbing: false,
      },
      chrome: {
        showHeader: true,
        title: 'Timeline',
      },
      animation: {
        entrance: slideUpVariants,
      },
    },
  },
  {
    type: 'screenshot-gallery',
    component: ScreenshotGalleryModule,
    displayName: 'Screenshot Gallery',
    description: 'Display and manage screenshot collections',
    defaultConfig: {
      id: '',
      type: 'screenshot-gallery',
      slotId: '',
      settings: {
        columns: 3,
        showTimestamps: true,
        showTitles: true,
      },
      chrome: {
        showHeader: true,
        title: 'Screenshots',
      },
      animation: {
        entrance: slideUpVariants,
      },
    },
  },
  {
    type: 'video-chapter-navigator',
    component: VideoChapterNavigatorModule,
    displayName: 'Video Chapter Navigator',
    description: 'Navigate through video chapters and timestamps',
    defaultConfig: {
      id: '',
      type: 'video-chapter-navigator',
      slotId: '',
      settings: {
        showThumbnails: true,
        showDuration: true,
        showProgress: true,
      },
      chrome: {
        showHeader: true,
        title: 'Chapters',
      },
      animation: {
        entrance: slideUpVariants,
      },
    },
  },
  {
    type: 'code-changes',
    component: CodeChangesModule,
    displayName: 'Code Changes',
    description: 'View and manage code changes and diffs',
    defaultConfig: {
      id: '',
      type: 'code-changes',
      slotId: '',
      settings: {
        showDiff: true,
        showStats: true,
        showAuthor: true,
      },
      chrome: {
        showHeader: true,
        title: 'Code Changes',
      },
      animation: {
        entrance: slideUpVariants,
      },
    },
  },
];

/**
 * Initialize the module registry
 * Call this once at app startup
 */
export function initializeModuleRegistry(): void {
  // Register modules in the UI component registry
  registerModules(moduleDefinitions);

  // Bridge the UI registry to the engine registry
  const registeredCount = bridgeRegistries(moduleDefinitions);

  // Verify both registries are in sync
  verifyRegistrySync(moduleDefinitions.length);

  console.log(`[Module Registry] Initialized ${registeredCount} modules in both registries`);
}

// Re-export registry functions
export {
  registerModule,
  registerModules,
  getModule,
  hasModule,
  getRegisteredModuleTypes,
  getAllModules,
  unregisterModule,
  clearRegistry,
  getRegistrySize,
  preloadModule,
  preloadModules,
  getRegistry,
} from './moduleRegistry';
