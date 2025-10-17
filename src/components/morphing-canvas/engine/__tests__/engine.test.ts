/**
 * Engine Test Suite
 *
 * Comprehensive tests for the morphing canvas engine system.
 */

import {
  ModuleRegistry,
  LayoutEngine,
  generateConfig,
  analyzeSessionData,
  determineLayoutType,
  validateConfig,
} from '../index';
import type { SessionData } from '../../types';

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = ModuleRegistry.getInstance();
    registry.clear();
  });

  describe('Module Registration', () => {
    it('should register a module successfully', () => {
      const result = registry.register('notes', () => null, {
        displayName: 'Notes',
        category: 'content',
      });

      expect(result.success).toBe(true);
      expect(registry.has('notes')).toBe(true);
    });

    it('should prevent duplicate registration', () => {
      registry.register('notes', () => null, {
        displayName: 'Notes',
        category: 'content',
      });

      const result = registry.register('notes', () => null, {
        displayName: 'Notes 2',
        category: 'content',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already registered');
    });

    it('should set default values for optional fields', () => {
      registry.register('notes', () => null, {
        displayName: 'Notes',
        category: 'content',
      });

      const entry = registry.get('notes');
      expect(entry?.definition.variants).toEqual(['standard']);
      expect(entry?.definition.defaultVariant).toBe('standard');
      expect(entry?.definition.tags).toEqual([]);
    });
  });

  describe('Module Retrieval', () => {
    beforeEach(() => {
      registry.register('notes', () => null, {
        displayName: 'Notes',
        category: 'content',
        variants: ['compact', 'standard'],
        tags: ['productivity'],
      });

      registry.register('tasks', () => null, {
        displayName: 'Tasks',
        category: 'content',
        variants: ['minimal', 'standard'],
        tags: ['productivity', 'planning'],
      });

      registry.register('media', () => null, {
        displayName: 'Media Player',
        category: 'media',
        requires: { video: true },
      });
    });

    it('should retrieve a registered module', () => {
      const entry = registry.get('notes');
      expect(entry).not.toBeNull();
      expect(entry?.definition.displayName).toBe('Notes');
    });

    it('should return null for unregistered module', () => {
      const entry = registry.get('calendar');
      expect(entry).toBeNull();
    });

    it('should get all modules', () => {
      const all = registry.getAll();
      expect(all).toHaveLength(3);
    });

    it('should filter by category', () => {
      const content = registry.getByCategory('content');
      expect(content).toHaveLength(2);
      expect(content.every((e) => e.definition.category === 'content')).toBe(true);
    });

    it('should filter by variant', () => {
      const compactModules = registry.getByVariant('compact');
      expect(compactModules).toHaveLength(1);
      expect(compactModules[0].definition.type).toBe('notes');
    });

    it('should filter by requirements', () => {
      const videoModules = registry.getByRequirements({ video: true });
      expect(videoModules).toHaveLength(1);
      expect(videoModules[0].definition.type).toBe('media');
    });

    it('should search by tags', () => {
      const productivityModules = registry.searchByTags(['productivity']);
      expect(productivityModules).toHaveLength(2);

      const planningModules = registry.searchByTags(['planning']);
      expect(planningModules).toHaveLength(1);
      expect(planningModules[0].definition.type).toBe('tasks');
    });

    it('should search by tags with match all', () => {
      const modules = registry.searchByTags(['productivity', 'planning'], true);
      expect(modules).toHaveLength(1);
      expect(modules[0].definition.type).toBe('tasks');
    });
  });

  describe('Module Validation', () => {
    beforeEach(() => {
      registry.register('notes', () => null, {
        displayName: 'Notes',
        category: 'content',
        variants: ['compact', 'standard'],
      });
    });

    it('should validate valid configuration', () => {
      const result = registry.validateConfig('notes', {
        variant: 'compact',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid variant', () => {
      const result = registry.validateConfig('notes', {
        variant: 'expanded',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not supported');
    });

    it('should reject unregistered module', () => {
      const result = registry.validateConfig('calendar', {});

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not registered');
    });
  });

  describe('Registry Statistics', () => {
    beforeEach(() => {
      registry.register('notes', () => null, {
        displayName: 'Notes',
        category: 'content',
      });

      registry.register('tasks', () => null, {
        displayName: 'Tasks',
        category: 'content',
      });

      registry.register('media', () => null, {
        displayName: 'Media',
        category: 'media',
      });
    });

    it('should provide accurate statistics', () => {
      const stats = registry.getStats();

      expect(stats.totalModules).toBe(3);
      expect(stats.modulesByCategory.content).toBe(2);
      expect(stats.modulesByCategory.media).toBe(1);
    });
  });
});

describe('LayoutEngine', () => {
  let engine: LayoutEngine;
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = ModuleRegistry.getInstance();
    registry.clear();

    // Register test modules
    registry.register('notes', () => null, {
      displayName: 'Notes',
      category: 'content',
    });

    registry.register('tasks', () => null, {
      displayName: 'Tasks',
      category: 'content',
    });

    engine = new LayoutEngine(registry);
  });

  describe('Layout Selection', () => {
    it('should select default layout for empty session', () => {
      const sessionData: SessionData = {
        userId: 'test',
      };

      const result = engine.selectLayout(sessionData);

      expect(result.layoutType).toBe('default');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning).toBeDefined();
    });

    it('should return confidence score between 0 and 1', () => {
      const sessionData: SessionData = {
        userId: 'test',
      };

      const result = engine.selectLayout(sessionData);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should provide reasoning for selection', () => {
      const sessionData: SessionData = {
        userId: 'test',
      };

      const result = engine.selectLayout(sessionData);

      expect(result.reasoning).toBeDefined();
      expect(Array.isArray(result.reasoning)).toBe(true);
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('Module Composition', () => {
    it('should compose modules for a layout', () => {
      const sessionData: SessionData = {
        userId: 'test',
      };

      const result = engine.composeModules('default', sessionData);

      expect(result.modules).toBeDefined();
      expect(Array.isArray(result.modules)).toBe(true);
      expect(result.totalModules).toBeGreaterThanOrEqual(0);
    });

    it('should respect max modules option', () => {
      const sessionData: SessionData = {
        userId: 'test',
      };

      const result = engine.composeModules('default', sessionData, {
        maxModules: 2,
      });

      expect(result.modules.length).toBeLessThanOrEqual(2);
    });

    it('should provide composition metadata', () => {
      const sessionData: SessionData = {
        userId: 'test',
      };

      const result = engine.composeModules('default', sessionData);

      expect(result.totalModules).toBeDefined();
      expect(result.filledSlots).toBeDefined();
      expect(result.availableSlots).toBeDefined();
    });
  });

  describe('Slot Calculation', () => {
    it('should calculate slots for default layout', () => {
      const slots = engine.calculateSlots('default');

      expect(Array.isArray(slots)).toBe(true);
      expect(slots.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown layout', () => {
      const slots = engine.calculateSlots('unknown' as any);

      expect(slots).toEqual([]);
    });
  });

  describe('Responsive Adjustments', () => {
    it('should apply responsive adjustments for mobile', () => {
      const modules = [
        { id: 'notes-1', type: 'notes' as const, slotId: 'slot-1', enabled: true },
      ];

      const adjusted = engine.applyResponsive(modules, 'mobile');

      expect(adjusted).toBeDefined();
      expect(Array.isArray(adjusted)).toBe(true);
      expect(adjusted.length).toBe(modules.length);
    });

    it('should apply responsive adjustments for desktop', () => {
      const modules = [
        { id: 'notes-1', type: 'notes' as const, slotId: 'slot-1', enabled: true },
      ];

      const adjusted = engine.applyResponsive(modules, 'desktop');

      expect(adjusted).toBeDefined();
      expect(Array.isArray(adjusted)).toBe(true);
    });
  });

  describe('Layout Registration', () => {
    it('should allow registering custom layouts', () => {
      engine.registerLayout({
        layoutType: 'deep_work_dev',
        id: 'custom-dev',
        name: 'Custom Dev Layout',
        description: 'Custom',
        slots: {},
        gridConfig: { columns: 12, gap: '1rem' },
      });

      const layout = engine.getLayout('deep_work_dev');
      expect(layout).toBeDefined();
      expect(layout?.name).toBe('Custom Dev Layout');
    });

    it('should retrieve all layouts', () => {
      const layouts = engine.getAllLayouts();

      expect(Array.isArray(layouts)).toBe(true);
      expect(layouts.length).toBeGreaterThan(0);
    });
  });
});

describe('Config Generator', () => {
  beforeEach(() => {
    const registry = ModuleRegistry.getInstance();
    registry.clear();

    registry.register('notes', () => null, {
      displayName: 'Notes',
      category: 'content',
    });
  });

  describe('Configuration Generation', () => {
    it('should generate config from session data', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const result = generateConfig(sessionData);

      expect(result.success).toBeDefined();
      if (result.success) {
        expect(result.config).toBeDefined();
        expect(result.layoutSelection).toBeDefined();
        expect(result.moduleComposition).toBeDefined();
      }
    });

    it('should include layout selection in result', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const result = generateConfig(sessionData);

      expect(result.layoutSelection).toBeDefined();
      expect(result.layoutSelection.layoutType).toBeDefined();
      expect(result.layoutSelection.confidence).toBeDefined();
    });

    it('should include module composition in result', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const result = generateConfig(sessionData);

      expect(result.moduleComposition).toBeDefined();
      expect(result.moduleComposition.modules).toBeDefined();
    });

    it('should respect options', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const result = generateConfig(sessionData, {
        layoutType: 'default',
        maxModules: 3,
        themeMode: 'dark',
      });

      if (result.success && result.config) {
        expect(result.layoutSelection.layoutType).toBe('default');
        expect(result.config.theme.mode).toBe('dark');
      }
    });
  });

  describe('Session Analysis', () => {
    it('should analyze session data', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const characteristics = analyzeSessionData(sessionData);

      expect(characteristics).toBeDefined();
      expect(characteristics.primaryContentType).toBeDefined();
      expect(characteristics.intensity).toBeDefined();
    });
  });

  describe('Layout Type Determination', () => {
    it('should determine layout type from session', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const layoutType = determineLayoutType(sessionData);

      expect(layoutType).toBeDefined();
      expect(typeof layoutType).toBe('string');
    });

    it('should return default for empty session', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const layoutType = determineLayoutType(sessionData);

      expect(layoutType).toBe('default');
    });
  });

  describe('Config Validation', () => {
    it('should validate generated config', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const result = generateConfig(sessionData);

      if (result.success && result.config) {
        const validation = validateConfig(result.config);

        expect(validation.valid).toBeDefined();
        expect(validation.errors).toBeDefined();
        expect(validation.warnings).toBeDefined();
      }
    });
  });
});
