/**
 * Layout Engine
 *
 * Intelligent system for selecting layouts, composing modules, and handling
 * responsive behavior based on session data and user preferences.
 */

import type {
  SessionData,
  ModuleConfig,
  LayoutTemplate,
  GridSlot,
  ResponsiveGridSlot,
  Breakpoint,
  ModuleType,
} from '../types';
import type {
  LayoutType,
  IntelligentLayoutTemplate,
  SessionCharacteristics,
  LayoutSelectionResult,
  ModuleCompositionResult,
  CompositionOptions,
  ResponsiveAdjustment,
  LayoutHeuristic,
  ModuleVariant,
} from '../types/engine';
import { ModuleRegistry } from './registry';
import { analyzeSessionData } from './session-analyzer';

/**
 * Layout Engine for intelligent layout selection and module composition
 */
export class LayoutEngine {
  private registry: ModuleRegistry;
  private layoutTemplates: Map<LayoutType, IntelligentLayoutTemplate>;
  private heuristics: LayoutHeuristic[];

  constructor(registry?: ModuleRegistry) {
    this.registry = registry || ModuleRegistry.getInstance();
    this.layoutTemplates = new Map();
    this.heuristics = this.initializeHeuristics();
    this.initializeDefaultLayouts();
  }

  /**
   * Select the best layout type for a given session
   *
   * @param sessionData - Session data to analyze
   * @returns Layout selection result with confidence score and reasoning
   */
  public selectLayout(sessionData: SessionData): LayoutSelectionResult {
    // Analyze session characteristics
    const characteristics = this.analyzeSession(sessionData);

    // Score each layout type
    const scores = new Map<LayoutType, { score: number; reasoning: string[] }>();

    for (const heuristic of this.heuristics) {
      if (heuristic.condition(characteristics)) {
        const current = scores.get(heuristic.suggestedLayout) || {
          score: 0,
          reasoning: [],
        };

        current.score += heuristic.confidence * heuristic.priority;
        current.reasoning.push(heuristic.description);

        scores.set(heuristic.suggestedLayout, current);
      }
    }

    // If no heuristics matched, use default
    if (scores.size === 0) {
      return {
        layoutType: 'default',
        confidence: 0.5,
        reasoning: ['No specific layout patterns detected, using default layout'],
        timestamp: new Date(),
      };
    }

    // Find the layout with the highest score
    let bestLayout: LayoutType = 'default';
    let bestScore = 0;
    const allScores: Array<{ layoutType: LayoutType; score: number; reasoning: string[] }> = [];

    scores.forEach((value, key) => {
      allScores.push({ layoutType: key, score: value.score, reasoning: value.reasoning });
      if (value.score > bestScore) {
        bestScore = value.score;
        bestLayout = key;
      }
    });

    // Normalize confidence to 0-1 range
    // Use the highest possible score from a single heuristic as the maximum
    const maxPossibleScore = Math.max(
      ...this.heuristics.map((h) => h.confidence * h.priority)
    );
    const confidence = Math.min(bestScore / maxPossibleScore, 1.0);

    // Sort alternatives by score
    const alternatives = allScores
      .filter((s) => s.layoutType !== bestLayout)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Top 3 alternatives

    return {
      layoutType: bestLayout,
      confidence,
      reasoning: scores.get(bestLayout)?.reasoning || [],
      alternatives,
      timestamp: new Date(),
    };
  }

  /**
   * Compose modules according to a layout template
   *
   * @param layoutType - Type of layout to use
   * @param sessionData - Session data for module selection
   * @param options - Composition options
   * @returns Module composition result
   */
  public composeModules(
    layoutType: LayoutType,
    sessionData: SessionData,
    options: CompositionOptions = {}
  ): ModuleCompositionResult {
    console.log('[Layout Engine] Composing modules for layout:', layoutType);

    const template = this.layoutTemplates.get(layoutType);

    if (!template) {
      console.warn('[Layout Engine] Layout template not found:', layoutType);
      return {
        modules: [],
        warnings: [`Layout type "${layoutType}" not found, using default`],
        totalModules: 0,
        filledSlots: 0,
        availableSlots: 0,
      };
    }

    const warnings: string[] = [];
    const modules: ModuleConfig[] = [];
    const slotIds = Object.keys(template.slots);

    // Get recommended modules for this layout
    const recommendedModules = template.recommendedModules || [];
    console.log('[Layout Engine] Recommended modules:', recommendedModules);

    // Filter by user preferences
    let selectedModules = [...recommendedModules];

    if (options.requiredModules) {
      selectedModules = [...new Set([...selectedModules, ...options.requiredModules])];
    }

    if (options.excludedModules) {
      selectedModules = selectedModules.filter(
        (m) => !options.excludedModules!.includes(m)
      );
    }

    // Analyze session to add content-specific modules
    const characteristics = this.analyzeSession(sessionData);
    const contentModules = this.selectModulesForContent(characteristics);

    selectedModules = [...new Set([...selectedModules, ...contentModules])];
    console.log('[Layout Engine] Selected modules after content analysis:', selectedModules);

    // Limit modules if specified
    if (options.maxModules && selectedModules.length > options.maxModules) {
      selectedModules = selectedModules.slice(0, options.maxModules);
      console.log('[Layout Engine] Limited to maxModules:', options.maxModules);
    }

    // Limit by available slots
    const maxSlots = Math.min(slotIds.length, selectedModules.length);
    console.log('[Layout Engine] Creating configs for', maxSlots, 'modules in', slotIds.length, 'slots');

    // Create module configurations
    for (let i = 0; i < maxSlots; i++) {
      const moduleType = selectedModules[i];
      const slotId = slotIds[i];

      console.log(`[Layout Engine] Attempting to create module: ${moduleType} for slot: ${slotId}`);

      const registryEntry = this.registry.get(moduleType);

      if (!registryEntry) {
        const warning = `Module type "${moduleType}" not found in registry, skipping`;
        warnings.push(warning);
        console.warn(`[Layout Engine] ✗ ${warning}`);
        continue;
      }

      console.log(`[Layout Engine] ✓ Found module in registry: ${moduleType}`);

      // Determine variant
      let variant: ModuleVariant = options.preferredVariant || 'standard';
      if (!registryEntry.definition.variants.includes(variant)) {
        variant = registryEntry.definition.defaultVariant;
      }

      // Build module config
      const config: ModuleConfig = {
        id: `${moduleType}-${Date.now()}-${i}`,
        type: moduleType,
        slotId,
        priority: 'normal',
        enabled: true,
        settings: {},
        chrome: {
          showHeader: true,
          title: registryEntry.definition.displayName,
          icon: registryEntry.definition.icon,
          actions: [],
        },
        animation: {
          layout: true,
        },
      };

      modules.push(config);
    }

    // Fill empty slots if requested
    if (options.fillEmptySlots && modules.length < slotIds.length) {
      const fillerModules = this.getFillModules(
        slotIds.length - modules.length,
        selectedModules
      );

      for (const moduleType of fillerModules) {
        const slotId = slotIds[modules.length];
        const registryEntry = this.registry.get(moduleType);

        if (registryEntry) {
          const config: ModuleConfig = {
            id: `${moduleType}-${Date.now()}-${modules.length}`,
            type: moduleType,
            slotId,
            priority: 'low',
            enabled: true,
            settings: {},
            chrome: {
              showHeader: true,
              title: registryEntry.definition.displayName,
              icon: registryEntry.definition.icon,
              actions: [],
            },
            animation: {
              layout: true,
            },
          };

          modules.push(config);
        }
      }
    }

    console.log('[Layout Engine] Module composition complete:', {
      totalModules: modules.length,
      filledSlots: modules.length,
      availableSlots: slotIds.length,
      warningCount: warnings.length,
    });

    if (warnings.length > 0) {
      console.warn('[Layout Engine] Composition warnings:', warnings);
    }

    return {
      modules,
      warnings,
      totalModules: modules.length,
      filledSlots: modules.length,
      availableSlots: slotIds.length,
    };
  }

  /**
   * Calculate slot definitions for a layout type
   *
   * @param layoutType - Layout type
   * @returns Array of slot IDs available in the layout
   */
  public calculateSlots(layoutType: LayoutType): string[] {
    const template = this.layoutTemplates.get(layoutType);
    if (!template) {
      return [];
    }
    return Object.keys(template.slots);
  }

  /**
   * Apply responsive adjustments to a configuration
   *
   * @param config - Module configurations
   * @param breakpoint - Target breakpoint
   * @returns Adjusted module configurations
   */
  public applyResponsive(
    config: ModuleConfig[],
    breakpoint: Breakpoint
  ): ModuleConfig[] {
    const adjustments = this.getResponsiveAdjustments(breakpoint);

    return config.map((moduleConfig) => {
      const adjusted = { ...moduleConfig };

      // Hide modules on smaller screens
      if (adjustments.hideModules?.includes(moduleConfig.id)) {
        adjusted.enabled = false;
      }

      // Switch to compact variant on smaller screens
      if (adjustments.compactModules?.includes(moduleConfig.id)) {
        const registryEntry = this.registry.get(moduleConfig.type);
        if (registryEntry?.definition.variants.includes('compact')) {
          // Note: We can't directly modify settings here without type issues
          // This would be handled by the module renderer
          adjusted.settings = {
            ...adjusted.settings,
            variant: 'compact',
          };
        }
      }

      // Reorder modules
      const reorder = adjustments.reorderModules?.find(
        (r) => r.moduleId === moduleConfig.id
      );
      if (reorder) {
        adjusted.slotId = reorder.newSlotId;
      }

      return adjusted;
    });
  }

  /**
   * Register a custom layout template
   *
   * @param template - Layout template to register
   */
  public registerLayout(template: IntelligentLayoutTemplate): void {
    this.layoutTemplates.set(template.layoutType, template);
  }

  /**
   * Get a layout template by type
   *
   * @param layoutType - Layout type
   * @returns Layout template or undefined
   */
  public getLayout(layoutType: LayoutType): IntelligentLayoutTemplate | undefined {
    return this.layoutTemplates.get(layoutType);
  }

  /**
   * Get all registered layout templates
   *
   * @returns Array of all layout templates
   */
  public getAllLayouts(): IntelligentLayoutTemplate[] {
    return Array.from(this.layoutTemplates.values());
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Analyze session data to extract characteristics
   */
  private analyzeSession(sessionData: SessionData): SessionCharacteristics {
    // Use the real analyzeSessionData function from config-generator
    return analyzeSessionData(sessionData);
  }

  /**
   * Select modules based on session content characteristics
   */
  private selectModulesForContent(characteristics: SessionCharacteristics): string[] {
    const modules: string[] = [];

    // This would use the registry's getByRequirements method
    // For now, return basic modules based on characteristics

    if (characteristics.hasVideoContent) {
      modules.push('video-chapter-navigator');
    }

    if (characteristics.hasTasks) {
      modules.push('task-action-item');
    }

    if (characteristics.hasNotes) {
      modules.push('notes');
    }

    if (characteristics.hasScreenshots) {
      modules.push('screenshot-gallery');
    }

    return modules;
  }

  /**
   * Get filler modules for empty slots
   */
  private getFillModules(count: number, exclude: string[]): string[] {
    const allModules = this.registry.getAll();
    const available = allModules
      .filter((entry) => !exclude.includes(entry.definition.type))
      .map((entry) => entry.definition.type);

    return available.slice(0, count);
  }

  /**
   * Get responsive adjustments for a breakpoint
   */
  private getResponsiveAdjustments(breakpoint: Breakpoint): ResponsiveAdjustment {
    // Define responsive behavior based on breakpoint
    switch (breakpoint) {
      case 'mobile':
        return {
          breakpoint,
          hideModules: [],
          compactModules: [],
          reorderModules: [],
          gridColumns: 1,
          gridGap: '0.5rem',
        };

      case 'tablet':
        return {
          breakpoint,
          hideModules: [],
          compactModules: [],
          reorderModules: [],
          gridColumns: 2,
          gridGap: '1rem',
        };

      case 'desktop':
      case 'wide':
      default:
        return {
          breakpoint,
          hideModules: [],
          compactModules: [],
          reorderModules: [],
          gridColumns: 12,
          gridGap: '1.5rem',
        };
    }
  }

  /**
   * Initialize default heuristics for layout selection
   */
  private initializeHeuristics(): LayoutHeuristic[] {
    return [
      {
        name: 'Code Heavy Session',
        description: 'Session contains significant code changes',
        condition: (c) => c.hasCodeChanges && c.codeChangeCount > 10,
        suggestedLayout: 'deep_work_dev',
        confidence: 0.9,
        priority: 10,
      },
      {
        name: 'Video Learning Session',
        description: 'Session contains video chapters',
        condition: (c) => c.hasVideoContent && c.videoChapterCount > 3,
        suggestedLayout: 'learning_session',
        confidence: 0.85,
        priority: 9,
      },
      {
        name: 'Collaborative Discussion',
        description: 'Session has decisions and multiple participants',
        condition: (c) => c.hasDecisions && c.participantCount > 1,
        suggestedLayout: 'collaborative_meeting',
        confidence: 0.8,
        priority: 8,
      },
      {
        name: 'Visual Research',
        description: 'Session contains many screenshots',
        condition: (c) => c.hasScreenshots && c.screenshotCount > 20,
        suggestedLayout: 'research_review',
        confidence: 0.75,
        priority: 7,
      },
      {
        name: 'Creative Session',
        description: 'Session has visual content and notes',
        condition: (c) => c.hasScreenshots && c.hasNotes,
        suggestedLayout: 'creative_workshop',
        confidence: 0.7,
        priority: 6,
      },
    ];
  }

  /**
   * Initialize default layout templates
   */
  private initializeDefaultLayouts(): void {
    // Deep Work Dev Layout
    this.registerLayout({
      layoutType: 'deep_work_dev',
      id: 'deep-work-dev',
      name: 'Deep Work (Development)',
      description: 'Layout optimized for code-heavy development sessions',
      slots: {
        'code-primary': {
          desktop: { column: '1 / 9', row: '1 / 3' },
        },
        'timeline-side': {
          desktop: { column: '9 / 13', row: '1 / 2' },
        },
        'notes-side': {
          desktop: { column: '9 / 13', row: '2 / 3' },
        },
      },
      gridConfig: {
        columns: 12,
        gap: '1rem',
      },
      recommendedModules: ['code-changes', 'timeline', 'notes'],
      triggers: {
        hasCodeChanges: true,
      },
      priority: 10,
    });

    // Collaborative Meeting Layout
    this.registerLayout({
      layoutType: 'collaborative_meeting',
      id: 'collaborative-meeting',
      name: 'Collaborative Meeting',
      description: 'Layout for discussion and decision-heavy meetings',
      slots: {
        'timeline-main': {
          desktop: { column: '1 / 7', row: '1 / 2' },
        },
        'decisions-main': {
          desktop: { column: '7 / 13', row: '1 / 2' },
        },
        'notes-bottom': {
          desktop: { column: '1 / 13', row: '2 / 3' },
        },
      },
      gridConfig: {
        columns: 12,
        gap: '1rem',
      },
      recommendedModules: ['timeline', 'task-action-item', 'notes'],
      triggers: {
        hasDecisions: true,
        participantCount: 2,
      },
      priority: 8,
    });

    // Learning Session Layout
    this.registerLayout({
      layoutType: 'learning_session',
      id: 'learning-session',
      name: 'Learning Session',
      description: 'Layout for educational content with media',
      slots: {
        'media-primary': {
          desktop: { column: '1 / 9', row: '1 / 3' },
        },
        'chapters-side': {
          desktop: { column: '9 / 13', row: '1 / 2' },
        },
        'notes-side': {
          desktop: { column: '9 / 13', row: '2 / 3' },
        },
      },
      gridConfig: {
        columns: 12,
        gap: '1rem',
      },
      recommendedModules: ['video-chapter-navigator', 'notes', 'timeline'],
      triggers: {
        hasVideoContent: true,
      },
      priority: 9,
    });

    // Research Review Layout
    this.registerLayout({
      layoutType: 'research_review',
      id: 'research-review',
      name: 'Research & Review',
      description: 'Layout for screenshot and document heavy research sessions',
      slots: {
        'feed-main': {
          desktop: { column: '1 / 9', row: '1 / 3' },
        },
        'notes-side': {
          desktop: { column: '9 / 13', row: '1 / 3' },
        },
      },
      gridConfig: {
        columns: 12,
        gap: '1rem',
      },
      recommendedModules: ['screenshot-gallery', 'notes'],
      triggers: {
        hasScreenshots: true,
      },
      priority: 7,
    });

    // Creative Workshop Layout
    this.registerLayout({
      layoutType: 'creative_workshop',
      id: 'creative-workshop',
      name: 'Creative Workshop',
      description: 'Layout for creative work with visual content and notes',
      slots: {
        'canvas-main': {
          desktop: { column: '1 / 9', row: '1 / 3' },
        },
        'notes-side': {
          desktop: { column: '9 / 13', row: '1 / 2' },
        },
        'feed-side': {
          desktop: { column: '9 / 13', row: '2 / 3' },
        },
      },
      gridConfig: {
        columns: 12,
        gap: '1rem',
      },
      recommendedModules: ['notes', 'screenshot-gallery', 'task-action-item'],
      triggers: {
        hasScreenshots: true,
        hasNotes: true,
      },
      priority: 6,
    });

    // Presentation Layout
    this.registerLayout({
      layoutType: 'presentation',
      id: 'presentation',
      name: 'Presentation',
      description: 'Linear content flow for presentations',
      slots: {
        'media-full': {
          desktop: { column: '1 / 13', row: '1 / 3' },
        },
      },
      gridConfig: {
        columns: 12,
        gap: '1rem',
      },
      recommendedModules: ['video-chapter-navigator', 'screenshot-gallery'],
      triggers: {
        hasVideoContent: true,
        hasScreenshots: true,
      },
      priority: 5,
    });

    // Default Layout
    this.registerLayout({
      layoutType: 'default',
      id: 'default',
      name: 'Default Layout',
      description: 'General purpose flexible layout',
      slots: {
        'slot-1': {
          desktop: { column: '1 / 7', row: '1 / 2' },
        },
        'slot-2': {
          desktop: { column: '7 / 13', row: '1 / 2' },
        },
        'slot-3': {
          desktop: { column: '1 / 5', row: '2 / 3' },
        },
        'slot-4': {
          desktop: { column: '5 / 9', row: '2 / 3' },
        },
        'slot-5': {
          desktop: { column: '9 / 13', row: '2 / 3' },
        },
      },
      gridConfig: {
        columns: 12,
        gap: '1rem',
      },
      recommendedModules: ['quick-actions', 'task-action-item', 'notes', 'timeline', 'clock'],
      priority: 1,
    });
  }
}

/**
 * Create a new layout engine instance
 */
export const createLayoutEngine = (registry?: ModuleRegistry): LayoutEngine => {
  return new LayoutEngine(registry);
};
