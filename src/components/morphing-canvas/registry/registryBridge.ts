/**
 * Registry Bridge
 *
 * Bridges the UI component registry and the engine registry to ensure
 * both systems have access to the same module definitions.
 */

import type { ModuleDefinition } from '../types';
import type { ModuleCategory } from '../types/engine';
import { ModuleRegistry } from '../engine/registry';

/**
 * Maps module types to their categories for the engine registry
 */
const MODULE_CATEGORY_MAP: Record<string, ModuleCategory> = {
  'clock': 'interaction',
  'quick-actions': 'interaction',
  'notes': 'content',
  'task-action-item': 'content',
  'timeline': 'timeline',
  'screenshot-gallery': 'media',
  'video-chapter-navigator': 'media',
  'code-changes': 'content',
};

/**
 * Determines the category for a module type
 */
function getCategoryForModule(type: string): ModuleCategory {
  return MODULE_CATEGORY_MAP[type] || 'content';
}

/**
 * Populates the engine registry with module definitions from the UI registry
 *
 * @param moduleDefinitions - Array of module definitions from the UI registry
 * @returns Number of modules successfully registered
 */
export function bridgeRegistries(moduleDefinitions: ModuleDefinition[]): number {
  const engineRegistry = ModuleRegistry.getInstance();
  let successCount = 0;

  console.log('[Registry Bridge] Starting registry synchronization...');
  console.log(`[Registry Bridge] Found ${moduleDefinitions.length} modules to register`);

  for (const definition of moduleDefinitions) {
    try {
      // Map UI registry format to engine registry format
      const result = engineRegistry.register(
        definition.type as any,
        definition.component,
        {
          displayName: definition.displayName,
          description: definition.description,
          category: getCategoryForModule(definition.type),
          variants: ['standard', 'compact'], // All modules support standard and compact variants
          defaultVariant: 'standard',
          icon: definition.defaultConfig?.chrome?.icon,
          tags: [], // Could be extended based on module type
        }
      );

      if (result.success === false) {
        console.error(`[Registry Bridge] ✗ Failed to register ${definition.type}:`, result.error);
      } else {
        successCount++;
        console.log(`[Registry Bridge] ✓ Registered module: ${definition.type}`);
      }
    } catch (error) {
      console.error(`[Registry Bridge] ✗ Error registering ${definition.type}:`, error);
    }
  }

  const stats = engineRegistry.getStats();
  console.log('[Registry Bridge] Registration complete');
  console.log(`[Registry Bridge] Successfully registered: ${successCount}/${moduleDefinitions.length}`);
  console.log(`[Registry Bridge] Engine registry now contains ${stats.totalModules} modules`);

  return successCount;
}

/**
 * Verifies that both registries are synchronized
 *
 * @param uiModuleCount - Expected number of modules from UI registry
 * @returns True if registries are in sync, false otherwise
 */
export function verifyRegistrySync(uiModuleCount: number): boolean {
  const engineRegistry = ModuleRegistry.getInstance();
  const stats = engineRegistry.getStats();

  const inSync = stats.totalModules === uiModuleCount;

  if (inSync) {
    console.log(`[Registry Bridge] ✓ Registries are synchronized (${stats.totalModules} modules)`);
  } else {
    console.warn(`[Registry Bridge] ✗ Registry mismatch! UI: ${uiModuleCount}, Engine: ${stats.totalModules}`);
  }

  return inSync;
}
