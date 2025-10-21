/**
 * Canvas Component System - Public API
 *
 * Exports the complete Canvas component system for AI-composable UIs.
 */

// Core renderer
export { ComponentRenderer, ComponentTreeList, validateComponentTree } from './ComponentRenderer';

// Type definitions
export type * from './types';

// All primitive components
export * from './primitives';
