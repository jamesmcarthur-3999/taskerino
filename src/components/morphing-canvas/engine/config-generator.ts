/**
 * Configuration Generator
 *
 * Generates MorphingCanvasConfig from session data using intelligent
 * heuristics to select layouts and compose modules automatically.
 */

import type {
  SessionData,
  MorphingCanvasConfig,
  ThemeMode,
  ModuleConfig,
} from '../types';
import type {
  LayoutType,
  ConfigGenerationOptions,
  ConfigGenerationResult,
  SessionCharacteristics,
  LayoutSelectionResult,
  ModuleCompositionResult,
} from '../types/engine';
import { LayoutEngine } from './layout-engine';
import { ModuleRegistry } from './registry';
import { analyzeSessionData } from './session-analyzer';

/**
 * Generate a complete Morphing Canvas configuration from session data
 *
 * This is the main entry point for creating configurations. It analyzes
 * the session data and intelligently selects layouts and modules.
 *
 * @param sessionData - The session data to analyze
 * @param options - Optional configuration preferences
 * @returns Complete configuration generation result
 */
export function generateConfig(
  sessionData: SessionData,
  options: ConfigGenerationOptions = {}
): ConfigGenerationResult {
  try {
    console.log('[Config Generator] Starting config generation...');
    console.log('[Config Generator] Options:', options);

    const registry = ModuleRegistry.getInstance();
    const registryStats = registry.getStats();
    console.log('[Config Generator] Registry stats:', registryStats);

    const engine = new LayoutEngine(registry);

    // Step 1: Select the best layout
    const layoutSelection = options.layoutType
      ? createManualLayoutSelection(options.layoutType)
      : engine.selectLayout(sessionData);

    console.log('[Config Generator] Selected layout:', layoutSelection.layoutType);
    console.log('[Config Generator] Layout confidence:', layoutSelection.confidence);
    console.log('[Config Generator] Layout reasoning:', layoutSelection.reasoning);

    // Step 2: Compose modules for the selected layout
    const moduleComposition = engine.composeModules(
      layoutSelection.layoutType,
      sessionData,
      {
        maxModules: options.maxModules,
        preferredVariant: options.defaultVariant,
        excludedModules: options.excludedModules,
        requiredModules: options.preferredModules,
        fillEmptySlots: true,
      }
    );

    console.log('[Config Generator] Module composition result:', {
      totalModules: moduleComposition.totalModules,
      filledSlots: moduleComposition.filledSlots,
      availableSlots: moduleComposition.availableSlots,
      warnings: moduleComposition.warnings,
    });
    console.log('[Config Generator] Composed modules:', moduleComposition.modules.map(m => m.type));

    // Step 3: Get the layout template
    const layoutTemplate = engine.getLayout(layoutSelection.layoutType);

    if (!layoutTemplate) {
      return {
        success: false,
        error: `Layout template not found for type: ${layoutSelection.layoutType}`,
        layoutSelection,
        moduleComposition,
        warnings: ['Failed to retrieve layout template'],
      };
    }

    // Step 4: Build the complete configuration
    const config: MorphingCanvasConfig = {
      id: `config-${Date.now()}`,
      name: `${sessionData.userId || 'Session'} - ${layoutSelection.layoutType}`,
      description: `Auto-generated configuration for ${layoutSelection.layoutType} layout`,

      // Layout
      layout: layoutTemplate,
      alternativeLayouts: layoutSelection.alternatives?.map((alt) =>
        engine.getLayout(alt.layoutType)
      ).filter((t): t is typeof layoutTemplate => t !== undefined),

      // Theme
      theme: createDefaultTheme(options.themeMode || 'auto'),

      // Modules
      modules: moduleComposition.modules,

      // Behavior
      behavior: {
        enableAnimations: options.enableAnimations !== false,
        respectReducedMotion: true,
        enableAutoLayout: options.enableAutoLayout !== false,
        persistState: true,
      },

      // Metadata
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: sessionData.userId || 'system',
        tags: [
          layoutSelection.layoutType,
          ...extractSessionTags(sessionData),
        ],
      },
    };

    // Collect all warnings
    const warnings = [
      ...layoutSelection.reasoning,
      ...(moduleComposition.warnings || []),
    ];

    console.log('[Config Generator] ✓ Config generation successful');
    console.log('[Config Generator] Final config:', {
      layout: config.layout.id,
      moduleCount: config.modules.length,
      warnings: warnings.length,
    });

    return {
      success: true,
      config,
      layoutSelection,
      moduleComposition,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error('[Config Generator] ✗ Config generation failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      layoutSelection: createManualLayoutSelection('default'),
      moduleComposition: {
        modules: [],
        warnings: ['Failed to compose modules'],
        totalModules: 0,
        filledSlots: 0,
        availableSlots: 0,
      },
    };
  }
}

// Re-export analyzeSessionData for convenience
export { analyzeSessionData } from './session-analyzer';

/**
 * Determine layout type using simple heuristics
 *
 * This function uses straightforward rules to determine the best layout:
 * - Code changes → deep_work_dev
 * - Video chapters → learning_session
 * - Many screenshots → research_review or creative_workshop
 * - Decisions → collaborative_meeting
 * - Default → default layout
 *
 * @param sessionData - Session data to analyze
 * @returns Recommended layout type
 */
export function determineLayoutType(sessionData: SessionData): LayoutType {
  const characteristics = analyzeSessionData(sessionData);

  // Priority-based heuristics
  if (characteristics.hasCodeChanges && characteristics.codeChangeCount > 10) {
    return 'deep_work_dev';
  }

  if (characteristics.hasVideoContent && characteristics.videoChapterCount > 3) {
    return 'learning_session';
  }

  if (characteristics.hasDecisions && characteristics.participantCount > 1) {
    return 'collaborative_meeting';
  }

  if (characteristics.hasScreenshots) {
    if (characteristics.screenshotCount > 20) {
      return 'research_review';
    }
    if (characteristics.hasNotes) {
      return 'creative_workshop';
    }
  }

  // Check for presentation mode (linear flow)
  if (
    characteristics.hasVideoContent &&
    characteristics.hasScreenshots &&
    characteristics.participantCount === 1
  ) {
    return 'presentation';
  }

  return 'default';
}

/**
 * Select modules based on session content
 *
 * This function examines session data and returns module types
 * that are appropriate for the content.
 *
 * @param sessionData - Session data to analyze
 * @returns Array of recommended module types
 */
export function selectModulesForSession(sessionData: SessionData): string[] {
  const characteristics = analyzeSessionData(sessionData);
  const modules: string[] = [];

  // Always include basic modules
  modules.push('quick-actions');

  // Content-specific modules
  if (characteristics.hasVideoContent) {
    modules.push('media');
  }

  if (characteristics.hasTasks) {
    modules.push('tasks');
  }

  if (characteristics.hasNotes) {
    modules.push('notes');
  }

  if (characteristics.hasScreenshots) {
    modules.push('feed'); // Gallery or feed for screenshots
  }

  // Add timeline for temporal content
  if (
    characteristics.hasVideoContent ||
    characteristics.hasAudioContent ||
    characteristics.duration > 30
  ) {
    modules.push('chart'); // Could be timeline visualization
  }

  // Add analytics for heavy sessions
  if (characteristics.intensity === 'heavy') {
    modules.push('chart');
  }

  return modules;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a manual layout selection result (when layout is specified)
 */
function createManualLayoutSelection(layoutType: LayoutType): LayoutSelectionResult {
  return {
    layoutType,
    confidence: 1.0,
    reasoning: ['Layout manually specified by user'],
    timestamp: new Date(),
  };
}

/**
 * Extract tags from session data
 */
function extractSessionTags(sessionData: SessionData): string[] {
  const tags: string[] = [];

  // Add tags from session data if available
  if ('tags' in sessionData && Array.isArray(sessionData.tags)) {
    tags.push(...sessionData.tags);
  }

  // Add permission-based tags if available
  if ('permissions' in sessionData && Array.isArray(sessionData.permissions)) {
    tags.push(...sessionData.permissions);
  }

  return [...new Set(tags)]; // Deduplicate
}

/**
 * Create a default theme configuration
 */
function createDefaultTheme(mode: ThemeMode) {
  const isDark = mode === 'dark' || (mode === 'auto' && prefersDarkMode());

  return {
    mode,
    colors: {
      primary: isDark ? '#60a5fa' : '#3b82f6',
      secondary: isDark ? '#818cf8' : '#6366f1',
      accent: isDark ? '#f472b6' : '#ec4899',
      background: isDark ? '#0f172a' : '#ffffff',
      surface: isDark ? '#1e293b' : '#f8fafc',
      text: isDark ? '#f1f5f9' : '#0f172a',
      textSecondary: isDark ? '#94a3b8' : '#64748b',
      border: isDark ? '#334155' : '#e2e8f0',
      error: '#ef4444',
      warning: '#f59e0b',
      success: '#10b981',
      info: '#06b6d4',
    },
    borderRadius: {
      small: '0.25rem',
      medium: '0.5rem',
      large: '1rem',
    },
    spacing: {
      unit: 8,
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
}

/**
 * Check if user prefers dark mode
 */
function prefersDarkMode(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/**
 * Validate a generated configuration
 *
 * @param config - Configuration to validate
 * @returns Validation result with any errors or warnings
 */
export function validateConfig(config: MorphingCanvasConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!config.id) errors.push('Configuration must have an id');
  if (!config.name) errors.push('Configuration must have a name');
  if (!config.layout) errors.push('Configuration must have a layout');
  if (!config.theme) errors.push('Configuration must have a theme');
  if (!config.modules) errors.push('Configuration must have modules array');

  // Check modules
  if (config.modules && config.modules.length === 0) {
    warnings.push('Configuration has no modules');
  }

  // Check for duplicate module IDs
  if (config.modules) {
    const ids = config.modules.map((m) => m.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate module IDs found: ${duplicates.join(', ')}`);
    }
  }

  // Check slot assignments
  if (config.modules && config.layout) {
    const slotIds = Object.keys(config.layout.slots);
    const invalidSlots = config.modules
      .map((m) => m.slotId)
      .filter((slotId) => slotId && !slotIds.includes(slotId));

    if (invalidSlots.length > 0) {
      warnings.push(
        `Some modules reference non-existent slots: ${invalidSlots.join(', ')}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Quick helper to generate a config with defaults
 *
 * @param sessionData - Session data
 * @returns Morphing canvas configuration or null if generation fails
 */
export function quickGenerateConfig(
  sessionData: SessionData
): MorphingCanvasConfig | null {
  const result = generateConfig(sessionData);
  return result.success ? result.config : null;
}
