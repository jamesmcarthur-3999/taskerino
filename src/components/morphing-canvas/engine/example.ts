/**
 * Engine Usage Examples
 *
 * This file demonstrates how to use the morphing canvas engine
 * for intelligent layout selection and configuration generation.
 */

import {
  ModuleRegistry,
  LayoutEngine,
  generateConfig,
  analyzeSessionData,
  determineLayoutType,
} from './index';
import type { SessionData } from '../types';

// ============================================================================
// Example 1: Basic Module Registration
// ============================================================================

export function example1_BasicRegistration() {
  const registry = ModuleRegistry.getInstance();

  // Register a simple module
  const result = registry.register(
    'notes',
    () => null, // Placeholder component
    {
      displayName: 'Notes Module',
      category: 'content',
      description: 'Take and organize notes',
      variants: ['compact', 'standard', 'expanded'],
      defaultVariant: 'standard',
      tags: ['productivity', 'writing'],
    }
  );

  if (result.success) {
    console.log('Module registered successfully');
  } else {
    console.error('Registration failed:', result.error);
  }

  // Get module info
  const entry = registry.get('notes');
  console.log('Module:', entry?.definition.displayName);
  console.log('Variants:', entry?.definition.variants);
}

// ============================================================================
// Example 2: Layout Selection
// ============================================================================

export function example2_LayoutSelection() {
  // Sample session data
  const sessionData: SessionData = {
    userId: 'user-123',
    preferences: {
      codeChanges: Array(15).fill({}), // 15 code changes
    },
  };

  const engine = new LayoutEngine();

  // Let engine select layout
  const selection = engine.selectLayout(sessionData);

  console.log('Selected Layout:', selection.layoutType);
  console.log('Confidence:', `${selection.confidence * 100}%`);
  console.log('Reasoning:', selection.reasoning);

  // Check alternatives
  if (selection.alternatives) {
    console.log('Alternatives:');
    selection.alternatives.forEach((alt) => {
      console.log(`  - ${alt.layoutType}: ${alt.score}`);
    });
  }
}

// ============================================================================
// Example 3: Module Composition
// ============================================================================

export function example3_ModuleComposition() {
  const engine = new LayoutEngine();

  const sessionData: SessionData = {
    userId: 'user-123',
    preferences: {
      hasVideo: true,
      videoChapters: Array(5).fill({}),
    },
  };

  // Compose modules for learning session
  const composition = engine.composeModules(
    'learning_session',
    sessionData,
    {
      maxModules: 5,
      preferredVariant: 'standard',
      fillEmptySlots: true,
    }
  );

  console.log('Total Modules:', composition.totalModules);
  console.log('Filled Slots:', composition.filledSlots);
  console.log('Available Slots:', composition.availableSlots);

  composition.modules.forEach((module) => {
    console.log(`  - ${module.type} in slot ${module.slotId}`);
  });

  if (composition.warnings) {
    console.log('Warnings:', composition.warnings);
  }
}

// ============================================================================
// Example 4: Full Config Generation
// ============================================================================

export function example4_ConfigGeneration() {
  // Rich session data
  const sessionData: SessionData = {
    userId: 'developer-456',
    preferences: {
      codeChanges: Array(25).fill({}),
      notes: Array(10).fill({}),
      duration: 120, // 2 hours
    },
  };

  // Generate complete configuration
  const result = generateConfig(sessionData, {
    maxModules: 6,
    defaultVariant: 'standard',
    enableAnimations: true,
    themeMode: 'dark',
  });

  if (result.success && result.config) {
    console.log('Configuration Generated Successfully');
    console.log('Config ID:', result.config.id);
    console.log('Layout:', result.config.layout.name);
    console.log('Modules:', result.config.modules.length);
    console.log('Theme:', result.config.theme.mode);

    // Access modules
    result.config.modules.forEach((module) => {
      console.log(`  - ${module.type} (${module.slotId})`);
    });

    // Check metadata
    console.log('Created:', result.config.metadata?.createdAt);
    console.log('Tags:', result.config.metadata?.tags);
  } else {
    console.error('Generation failed:', result.error);
  }
}

// ============================================================================
// Example 5: Content-Based Module Selection
// ============================================================================

export function example5_ContentBasedModules() {
  const registry = ModuleRegistry.getInstance();

  // Register modules with content requirements
  registry.register('video-player', () => null, {
    displayName: 'Video Player',
    category: 'media',
    requires: { video: true },
  });

  registry.register('screenshot-gallery', () => null, {
    displayName: 'Screenshot Gallery',
    category: 'media',
    requires: { screenshots: true },
  });

  registry.register('code-viewer', () => null, {
    displayName: 'Code Viewer',
    category: 'content',
    requires: { code: true },
  });

  // Find modules for video content
  const videoModules = registry.getByRequirements({ video: true });
  console.log('Video modules:', videoModules.map((m) => m.definition.displayName));

  // Find all media modules
  const mediaModules = registry.getByCategory('media');
  console.log('Media modules:', mediaModules.map((m) => m.definition.displayName));
}

// ============================================================================
// Example 6: Custom Layout Registration
// ============================================================================

export function example6_CustomLayout() {
  const engine = new LayoutEngine();

  // Register a custom layout
  engine.registerLayout({
    layoutType: 'deep_work_dev', // Using existing type
    id: 'custom-dev',
    name: 'Custom Developer Layout',
    description: 'Custom layout for my workflow',
    slots: {
      'editor-main': {
        desktop: { column: '1 / 10', row: '1 / 4' },
      },
      'console-side': {
        desktop: { column: '10 / 13', row: '1 / 2' },
      },
      'files-side': {
        desktop: { column: '10 / 13', row: '2 / 4' },
      },
    },
    gridConfig: {
      columns: 12,
      gap: '1rem',
    },
    recommendedModules: ['notes', 'tasks'],
    triggers: {
      hasCodeChanges: true,
    },
    priority: 15,
  });

  // Get the custom layout
  const layout = engine.getLayout('deep_work_dev');
  console.log('Custom Layout:', layout?.name);
}

// ============================================================================
// Example 7: Responsive Adjustments
// ============================================================================

export function example7_ResponsiveAdjustments() {
  const engine = new LayoutEngine();

  // Create some module configs
  const modules = [
    { id: 'notes-1', type: 'notes' as const, slotId: 'slot-1', enabled: true },
    { id: 'tasks-1', type: 'tasks' as const, slotId: 'slot-2', enabled: true },
  ];

  // Apply responsive adjustments for mobile
  const mobileModules = engine.applyResponsive(modules, 'mobile');
  console.log('Mobile modules:', mobileModules);

  // Apply responsive adjustments for desktop
  const desktopModules = engine.applyResponsive(modules, 'desktop');
  console.log('Desktop modules:', desktopModules);
}

// ============================================================================
// Example 8: Session Analysis
// ============================================================================

export function example8_SessionAnalysis() {
  const sessionData: SessionData = {
    userId: 'analyst-789',
    preferences: {
      screenshots: Array(30).fill({}),
      notes: Array(5).fill({}),
      duration: 90,
    },
  };

  // Analyze session characteristics
  const characteristics = analyzeSessionData(sessionData);

  console.log('Session Analysis:');
  console.log('  Primary Content:', characteristics.primaryContentType);
  console.log('  Intensity:', characteristics.intensity);
  console.log('  Duration:', characteristics.duration, 'minutes');
  console.log('  Has Screenshots:', characteristics.hasScreenshots);
  console.log('  Screenshot Count:', characteristics.screenshotCount);

  // Use analysis for layout recommendation
  const layoutType = determineLayoutType(sessionData);
  console.log('Recommended Layout:', layoutType);
}

// ============================================================================
// Example 9: Registry Search and Filter
// ============================================================================

export function example9_RegistrySearch() {
  const registry = ModuleRegistry.getInstance();

  // Register some modules with tags
  registry.register('notes', () => null, {
    displayName: 'Notes',
    category: 'content',
    tags: ['productivity', 'writing', 'collaboration'],
  });

  registry.register('tasks', () => null, {
    displayName: 'Tasks',
    category: 'content',
    tags: ['productivity', 'planning'],
  });

  // Search by tags
  const productivityModules = registry.searchByTags(['productivity']);
  console.log('Productivity modules:', productivityModules.map((m) => m.definition.displayName));

  // Search requiring all tags
  const collaborativeWriting = registry.searchByTags(['writing', 'collaboration'], true);
  console.log('Collaborative writing:', collaborativeWriting.map((m) => m.definition.displayName));

  // Get statistics
  const stats = registry.getStats();
  console.log('Registry Stats:');
  console.log('  Total Modules:', stats.totalModules);
  console.log('  By Category:', stats.modulesByCategory);
}

// ============================================================================
// Example 10: Validation
// ============================================================================

export function example10_Validation() {
  const registry = ModuleRegistry.getInstance();

  registry.register('notes', () => null, {
    displayName: 'Notes',
    category: 'content',
    variants: ['compact', 'standard'],
    defaultVariant: 'standard',
  });

  // Validate valid config
  const validConfig = {
    variant: 'compact',
  };
  const validResult = registry.validateConfig('notes', validConfig);
  console.log('Valid config:', validResult.valid);

  // Validate invalid config
  const invalidConfig = {
    variant: 'expanded', // Not supported
  };
  const invalidResult = registry.validateConfig('notes', invalidConfig);
  console.log('Invalid config:', invalidResult.valid);
  console.log('Errors:', invalidResult.errors);
}

// ============================================================================
// Run All Examples
// ============================================================================

export function runAllExamples() {
  console.log('\n=== Example 1: Basic Registration ===');
  example1_BasicRegistration();

  console.log('\n=== Example 2: Layout Selection ===');
  example2_LayoutSelection();

  console.log('\n=== Example 3: Module Composition ===');
  example3_ModuleComposition();

  console.log('\n=== Example 4: Config Generation ===');
  example4_ConfigGeneration();

  console.log('\n=== Example 5: Content-Based Modules ===');
  example5_ContentBasedModules();

  console.log('\n=== Example 6: Custom Layout ===');
  example6_CustomLayout();

  console.log('\n=== Example 7: Responsive Adjustments ===');
  example7_ResponsiveAdjustments();

  console.log('\n=== Example 8: Session Analysis ===');
  example8_SessionAnalysis();

  console.log('\n=== Example 9: Registry Search ===');
  example9_RegistrySearch();

  console.log('\n=== Example 10: Validation ===');
  example10_Validation();
}
