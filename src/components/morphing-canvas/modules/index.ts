/**
 * Morphing Canvas Modules Index
 *
 * Export all module components for easy importing
 */

export { TaskModule } from './TaskModule';
export { TimelineModule } from './TimelineModule';
export { ScreenshotGalleryModule } from './ScreenshotGalleryModule';
// export { default as TimelineModuleExample } from './TimelineModule.example'; // File doesn't exist

// Re-export types for convenience
export type {
  // Task Module
  TaskModuleProps,
  TaskModuleData,
  TaskModuleConfig,
  TaskVariant,
  TaskAction,
  // Timeline Module
  TimelineModuleProps,
  TimelineData,
  TimelineEvent,
  TimelineEventType,
  FocusPeriod,
  // Common
  ModuleConfig
} from '../types/module';

// Re-export Screenshot Gallery types
export type {
  ScreenshotGalleryModuleProps,
  ScreenshotGalleryData,
  ScreenshotGalleryConfig,
  ScreenshotGalleryVariant,
  Screenshot
} from './ScreenshotGalleryModule';
