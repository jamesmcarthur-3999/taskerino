/**
 * Morphing Canvas Engine - Main Entry Point
 *
 * This file exports all the core engine components for easy importing.
 */

// Registry
export {
  ModuleRegistry,
  getRegistry,
  registerModule,
} from './registry';

// Layout Engine
export {
  LayoutEngine,
  createLayoutEngine,
} from './layout-engine';

// Config Generator
export {
  generateConfig,
  analyzeSessionData,
  determineLayoutType,
  selectModulesForSession,
  validateConfig,
  quickGenerateConfig,
} from './config-generator';

// Re-export types for convenience
export type {
  LayoutType,
  ModuleVariant,
  ModuleCategory,
  SessionCharacteristics,
  LayoutSelectionResult,
  ModuleCompositionResult,
  ConfigGenerationOptions,
  ConfigGenerationResult,
  ExtendedModuleDefinition,
  RegistryEntry,
  RegistryStats,
  IntelligentLayoutTemplate,
  CompositionOptions,
  ResponsiveAdjustment,
  LayoutHeuristic,
  Result,
} from '../types/engine';
