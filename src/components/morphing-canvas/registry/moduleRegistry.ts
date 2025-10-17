/**
 * Module Registry
 *
 * Central registry for all module components in the Morphing Canvas system.
 * Modules must be registered here to be rendered by the ModuleRenderer.
 */

import type {
  ModuleType,
  ModuleDefinition,
  ModuleRegistry as ModuleRegistryType,
} from '../types';

/**
 * The global module registry
 */
const moduleRegistry: ModuleRegistryType = new Map();

/**
 * Register a module component
 *
 * @param definition - The module definition
 * @throws Error if module type is already registered
 */
export function registerModule(definition: ModuleDefinition): void {
  if (moduleRegistry.has(definition.type)) {
    console.warn(
      `Module type "${definition.type}" is already registered. Overwriting.`
    );
  }

  moduleRegistry.set(definition.type, definition);
}

/**
 * Register multiple modules at once
 *
 * @param definitions - Array of module definitions
 */
export function registerModules(definitions: ModuleDefinition[]): void {
  definitions.forEach((definition) => registerModule(definition));
}

/**
 * Get a module definition by type
 *
 * @param type - The module type
 * @returns The module definition or undefined if not found
 */
export function getModule(type: string): ModuleDefinition | undefined {
  return moduleRegistry.get(type as ModuleType);
}

/**
 * Check if a module type is registered
 *
 * @param type - The module type
 * @returns True if registered
 */
export function hasModule(type: string): boolean {
  return moduleRegistry.has(type as ModuleType);
}

/**
 * Get all registered module types
 *
 * @returns Array of registered module types
 */
export function getRegisteredModuleTypes(): string[] {
  return Array.from(moduleRegistry.keys()) as string[];
}

/**
 * Get all registered module definitions
 *
 * @returns Array of module definitions
 */
export function getAllModules(): ModuleDefinition[] {
  return Array.from(moduleRegistry.values());
}

/**
 * Unregister a module
 *
 * @param type - The module type to unregister
 * @returns True if module was unregistered, false if not found
 */
export function unregisterModule(type: string): boolean {
  return moduleRegistry.delete(type as ModuleType);
}

/**
 * Clear all registered modules
 */
export function clearRegistry(): void {
  moduleRegistry.clear();
}

/**
 * Get the size of the registry
 *
 * @returns Number of registered modules
 */
export function getRegistrySize(): number {
  return moduleRegistry.size;
}

/**
 * Preload a module's dependencies
 *
 * @param type - The module type to preload
 * @returns Promise that resolves when preload is complete
 */
export async function preloadModule(type: string): Promise<void> {
  const definition = getModule(type);

  if (!definition) {
    throw new Error(`Module type "${type}" is not registered`);
  }

  if (definition.preload) {
    await definition.preload();
  }
}

/**
 * Preload multiple modules
 *
 * @param types - Array of module types to preload
 * @returns Promise that resolves when all preloads are complete
 */
export async function preloadModules(types: string[]): Promise<void> {
  await Promise.all(types.map((type) => preloadModule(type)));
}

/**
 * Export the registry for direct access (use with caution)
 */
export function getRegistry(): ModuleRegistryType {
  return moduleRegistry;
}
