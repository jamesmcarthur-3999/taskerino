/**
 * Module Registry
 *
 * Central registry for all available modules in the morphing canvas system.
 * Handles registration, retrieval, and metadata for modules.
 */

import type { ComponentType } from 'react';
import type { ModuleType, ModuleProps } from '../types';
import type {
  ExtendedModuleDefinition,
  RegistryEntry,
  RegistryStats,
  ModuleCategory,
  ModuleVariant,
  Result,
} from '../types/engine';

/**
 * Singleton registry for managing module definitions
 */
export class ModuleRegistry {
  private static instance: ModuleRegistry | null = null;
  private registry: Map<ModuleType, RegistryEntry>;

  private constructor() {
    this.registry = new Map();
  }

  /**
   * Get the singleton instance of the registry
   */
  public static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }

  /**
   * Register a new module type
   *
   * @param type - Unique module type identifier
   * @param component - React component for the module
   * @param definition - Module metadata and configuration
   * @returns Result indicating success or error
   */
  public register(
    type: ModuleType,
    component: ComponentType<ModuleProps<any>>,
    definition: Partial<ExtendedModuleDefinition> & {
      displayName: string;
      category: ModuleCategory;
    }
  ): Result<void> {
    try {
      // Validate module type is not already registered
      if (this.registry.has(type)) {
        return {
          success: false,
          error: `Module type "${type}" is already registered`,
        };
      }

      // Build complete definition with defaults
      const completeDefinition: ExtendedModuleDefinition = {
        type,
        variants: definition.variants || ['standard'],
        defaultVariant: definition.defaultVariant || 'standard',
        category: definition.category,
        displayName: definition.displayName,
        description: definition.description,
        icon: definition.icon,
        tags: definition.tags || [],
        requires: definition.requires,
      };

      // Create registry entry
      const entry: RegistryEntry = {
        definition: completeDefinition,
        component,
        defaultConfig: this.buildDefaultConfig(type, completeDefinition),
        registeredAt: new Date(),
        version: '1.0.0',
      };

      // Store in registry
      this.registry.set(type, entry);

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: `Failed to register module: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get a registered module by type
   *
   * @param type - Module type to retrieve
   * @returns Registry entry or null if not found
   */
  public get(type: string): RegistryEntry | null {
    return this.registry.get(type as ModuleType) || null;
  }

  /**
   * Get all registered modules
   *
   * @returns Array of all registry entries
   */
  public getAll(): RegistryEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * Get modules by category
   *
   * @param category - Module category to filter by
   * @returns Array of matching registry entries
   */
  public getByCategory(category: ModuleCategory): RegistryEntry[] {
    return this.getAll().filter(
      (entry) => entry.definition.category === category
    );
  }

  /**
   * Get modules that support a specific variant
   *
   * @param variant - Module variant to filter by
   * @returns Array of matching registry entries
   */
  public getByVariant(variant: ModuleVariant): RegistryEntry[] {
    return this.getAll().filter((entry) =>
      entry.definition.variants.includes(variant)
    );
  }

  /**
   * Get modules that match content requirements
   *
   * @param requirements - Content requirements to match
   * @returns Array of matching registry entries
   */
  public getByRequirements(requirements: {
    screenshots?: boolean;
    audio?: boolean;
    video?: boolean;
    code?: boolean;
    decisions?: boolean;
    notes?: boolean;
    tasks?: boolean;
  }): RegistryEntry[] {
    return this.getAll().filter((entry) => {
      const moduleRequires = entry.definition.requires || {};

      // Check if module matches any of the requirements
      return Object.entries(requirements).some(([key, value]) => {
        if (!value) return false;
        return moduleRequires[key as keyof typeof moduleRequires] === true;
      });
    });
  }

  /**
   * Check if a module type is registered
   *
   * @param type - Module type to check
   * @returns True if registered, false otherwise
   */
  public has(type: string): boolean {
    return this.registry.has(type as ModuleType);
  }

  /**
   * Unregister a module type
   *
   * @param type - Module type to unregister
   * @returns Result indicating success or error
   */
  public unregister(type: string): Result<void> {
    if (!this.registry.has(type as ModuleType)) {
      return {
        success: false,
        error: `Module type "${type}" is not registered`,
      };
    }

    this.registry.delete(type as ModuleType);
    return { success: true, data: undefined };
  }

  /**
   * Clear all registered modules
   * WARNING: This will remove all modules from the registry
   */
  public clear(): void {
    this.registry.clear();
  }

  /**
   * Get registry statistics
   *
   * @returns Statistics about registered modules
   */
  public getStats(): RegistryStats {
    const entries = this.getAll();

    const modulesByCategory: Record<ModuleCategory, number> = {
      media: 0,
      timeline: 0,
      content: 0,
      analytics: 0,
      navigation: 0,
      interaction: 0,
    };

    const modulesByType: Record<string, number> = {};

    entries.forEach((entry) => {
      modulesByCategory[entry.definition.category]++;
      modulesByType[entry.definition.type] = (modulesByType[entry.definition.type] || 0) + 1;
    });

    return {
      totalModules: entries.length,
      modulesByCategory,
      modulesByType,
    };
  }

  /**
   * Get available variants for a module type
   *
   * @param type - Module type
   * @returns Array of available variants or empty array if not found
   */
  public getVariants(type: ModuleType): ModuleVariant[] {
    const entry = this.get(type);
    return entry?.definition.variants || [];
  }

  /**
   * Get default variant for a module type
   *
   * @param type - Module type
   * @returns Default variant or 'standard' if not found
   */
  public getDefaultVariant(type: string): ModuleVariant {
    const entry = this.get(type);
    return entry?.definition.defaultVariant || 'standard';
  }

  /**
   * Search modules by tags
   *
   * @param tags - Tags to search for
   * @param matchAll - If true, module must have all tags; if false, any tag matches
   * @returns Array of matching registry entries
   */
  public searchByTags(tags: string[], matchAll: boolean = false): RegistryEntry[] {
    return this.getAll().filter((entry) => {
      const moduleTags = entry.definition.tags || [];

      if (matchAll) {
        return tags.every((tag) => moduleTags.includes(tag));
      } else {
        return tags.some((tag) => moduleTags.includes(tag));
      }
    });
  }

  /**
   * Get module display name
   *
   * @param type - Module type
   * @returns Display name or the type string if not found
   */
  public getDisplayName(type: string): string {
    const entry = this.get(type);
    return entry?.definition.displayName || type;
  }

  /**
   * Validate module configuration
   *
   * @param type - Module type
   * @param config - Configuration to validate
   * @returns Validation result
   */
  public validateConfig(
    type: ModuleType,
    config: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const entry = this.get(type);

    if (!entry) {
      return {
        valid: false,
        errors: [`Module type "${type}" is not registered`],
      };
    }

    // Basic validation - can be extended based on module requirements
    const errors: string[] = [];

    // Check if variant is supported
    if (config.variant && !entry.definition.variants.includes(config.variant)) {
      errors.push(
        `Variant "${config.variant}" is not supported for module "${type}". ` +
          `Available variants: ${entry.definition.variants.join(', ')}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build default configuration for a module
   *
   * @param type - Module type
   * @param definition - Module definition
   * @returns Default configuration object
   */
  private buildDefaultConfig(
    type: ModuleType,
    definition: ExtendedModuleDefinition
  ): Record<string, any> {
    return {
      id: `${type}-${Date.now()}`,
      type,
      slotId: '', // Will be assigned during composition
      priority: 'normal',
      enabled: true,
      settings: {},
      chrome: {
        showHeader: true,
        title: definition.displayName,
        icon: definition.icon,
        actions: [],
      },
      animation: {
        layout: true,
      },
    };
  }
}

/**
 * Convenience function to get the registry instance
 */
export const getRegistry = (): ModuleRegistry => {
  return ModuleRegistry.getInstance();
};

/**
 * Convenience function to register a module
 */
export const registerModule = (
  type: ModuleType,
  component: ComponentType<ModuleProps<any>>,
  definition: Partial<ExtendedModuleDefinition> & {
    displayName: string;
    category: ModuleCategory;
  }
): Result<void> => {
  return getRegistry().register(type, component, definition);
};
