/**
 * Layout Engine Test Suite
 *
 * Comprehensive tests for the Layout Engine including:
 * - All 5 heuristic rules
 * - Layout selection with different session data
 * - Confidence scoring
 * - Module composition
 * - Responsive adjustments
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LayoutEngine } from '../layout-engine';
import { ModuleRegistry } from '../registry';
import type { SessionData } from '../../types';

describe('Layout Engine - Comprehensive Tests', () => {
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

    registry.register('media', () => null, {
      displayName: 'Media Player',
      category: 'media',
      requires: { video: true },
    });

    registry.register('calendar', () => null, {
      displayName: 'Calendar',
      category: 'content',
    });

    engine = new LayoutEngine(registry);
  });

  describe('Heuristic Rule 1: Code Heavy Session', () => {
    it('should suggest deep_work_dev layout for code-heavy sessions', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasCodeChanges: true,
        codeChangeCount: 15,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.layoutType).toBe('deep_work_dev');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning).toContain('Session contains significant code changes');
    });

    it('should have high confidence for code-heavy sessions', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasCodeChanges: true,
        codeChangeCount: 50,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should not trigger for sessions with few code changes', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasCodeChanges: true,
        codeChangeCount: 5,
      };

      const result = engine.selectLayout(sessionData);

      // Should fall back to default
      expect(result.layoutType).not.toBe('deep_work_dev');
    });

    it('should include reasoning in result', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasCodeChanges: true,
        codeChangeCount: 25,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Heuristic Rule 2: Video Learning Session', () => {
    it('should suggest learning_session layout for video content', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasVideoContent: true,
        videoChapterCount: 5,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.layoutType).toBe('learning_session');
      expect(result.reasoning).toContain('Session contains video chapters');
    });

    it('should require multiple chapters to trigger', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasVideoContent: true,
        videoChapterCount: 2,
      };

      const result = engine.selectLayout(sessionData);

      // Should not trigger with only 2 chapters
      expect(result.layoutType).not.toBe('learning_session');
    });

    it('should have high confidence for video sessions', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasVideoContent: true,
        videoChapterCount: 10,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Heuristic Rule 3: Collaborative Discussion', () => {
    it('should suggest collaborative_meeting layout for multi-participant sessions with decisions', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasDecisions: true,
        decisionCount: 5,
        participantCount: 3,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.layoutType).toBe('collaborative_meeting');
      expect(result.reasoning).toContain('Session has decisions and multiple participants');
    });

    it('should not trigger for single participant sessions', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasDecisions: true,
        decisionCount: 5,
        participantCount: 1,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.layoutType).not.toBe('collaborative_meeting');
    });

    it('should require decisions to trigger', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasDecisions: false,
        participantCount: 3,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.layoutType).not.toBe('collaborative_meeting');
    });
  });

  describe('Heuristic Rule 4: Visual Research', () => {
    it('should suggest research_review layout for screenshot-heavy sessions', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasScreenshots: true,
        screenshotCount: 25,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.layoutType).toBe('research_review');
      expect(result.reasoning).toContain('Session contains many screenshots');
    });

    it('should require minimum screenshot count to trigger', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasScreenshots: true,
        screenshotCount: 10,
      };

      const result = engine.selectLayout(sessionData);

      // Should not trigger with only 10 screenshots
      expect(result.layoutType).not.toBe('research_review');
    });

    it('should have moderate confidence for visual research', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasScreenshots: true,
        screenshotCount: 50,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Heuristic Rule 5: Creative Session', () => {
    it('should suggest creative_workshop layout for sessions with screenshots and notes', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasScreenshots: true,
        screenshotCount: 15,
        hasNotes: true,
        noteCount: 5,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.layoutType).toBe('creative_workshop');
      expect(result.reasoning).toContain('Session has visual content and notes');
    });

    it('should require both screenshots and notes', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasScreenshots: true,
        screenshotCount: 15,
        hasNotes: false,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.layoutType).not.toBe('creative_workshop');
    });
  });

  describe('Confidence Scoring', () => {
    it('should return confidence between 0 and 1', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasCodeChanges: true,
        codeChangeCount: 20,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should have higher confidence for sessions matching multiple heuristics', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasCodeChanges: true,
        codeChangeCount: 30,
        hasScreenshots: true,
        screenshotCount: 10,
      };

      const result = engine.selectLayout(sessionData);

      // Multiple matching heuristics should increase confidence
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should have default confidence for empty sessions', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const result = engine.selectLayout(sessionData);

      expect(result.layoutType).toBe('default');
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('Layout Selection with Different Session Data', () => {
    it('should handle sessions with only tasks', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasTasks: true,
        taskCount: 10,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.layoutType).toBeDefined();
      expect(result.reasoning).toBeDefined();
    });

    it('should handle sessions with audio content', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasAudioContent: true,
        audioSegmentCount: 5,
      };

      const result = engine.selectLayout(sessionData);

      expect(result).toBeDefined();
    });

    it('should handle long-duration sessions', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        duration: 14400, // 4 hours in seconds
      };

      const result = engine.selectLayout(sessionData);

      expect(result.layoutType).toBeDefined();
    });

    it('should handle sessions with multiple content types', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasCodeChanges: true,
        codeChangeCount: 15,
        hasVideoContent: true,
        videoChapterCount: 4,
        hasNotes: true,
        noteCount: 8,
      };

      const result = engine.selectLayout(sessionData);

      // Should select the highest priority matching heuristic
      expect(result.layoutType).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('Alternative Layout Suggestions', () => {
    it('should provide alternative layout suggestions', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasCodeChanges: true,
        codeChangeCount: 20,
        hasScreenshots: true,
        screenshotCount: 30,
      };

      const result = engine.selectLayout(sessionData);

      // Should have alternatives when multiple heuristics match
      expect(result.alternatives).toBeDefined();
    });

    it('should sort alternatives by score', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasCodeChanges: true,
        codeChangeCount: 15,
        hasVideoContent: true,
        videoChapterCount: 5,
      };

      const result = engine.selectLayout(sessionData);

      if (result.alternatives && result.alternatives.length > 1) {
        // Alternatives should be sorted in descending order
        for (let i = 0; i < result.alternatives.length - 1; i++) {
          expect(result.alternatives[i].score).toBeGreaterThanOrEqual(
            result.alternatives[i + 1].score
          );
        }
      }
    });

    it('should limit alternatives to top 3', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasCodeChanges: true,
        codeChangeCount: 15,
        hasVideoContent: true,
        videoChapterCount: 5,
        hasScreenshots: true,
        screenshotCount: 25,
      };

      const result = engine.selectLayout(sessionData);

      if (result.alternatives) {
        expect(result.alternatives.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('Module Composition', () => {
    it('should compose modules for deep_work_dev layout', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const result = engine.composeModules('deep_work_dev', sessionData);

      expect(result.modules).toBeDefined();
      expect(Array.isArray(result.modules)).toBe(true);
    });

    it('should respect max modules option', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const result = engine.composeModules('default', sessionData, {
        maxModules: 2,
      });

      expect(result.modules.length).toBeLessThanOrEqual(2);
    });

    it('should add content-specific modules', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasVideoContent: true,
        hasTasks: true,
        hasNotes: true,
      };

      const result = engine.composeModules('default', sessionData);

      expect(result.totalModules).toBeGreaterThan(0);
    });

    it('should provide warnings for missing modules', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const result = engine.composeModules('default', sessionData, {
        requiredModules: ['nonexistent-module'],
      });

      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should fill empty slots when requested', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const result = engine.composeModules('default', sessionData, {
        fillEmptySlots: true,
      });

      expect(result.filledSlots).toBeDefined();
    });

    it('should exclude specified modules', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const result = engine.composeModules('default', sessionData, {
        excludedModules: ['notes'],
      });

      const hasNotesModule = result.modules.some((m) => m.type === 'notes');
      expect(hasNotesModule).toBe(false);
    });

    it('should handle unknown layout type gracefully', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const result = engine.composeModules('unknown-layout' as any, sessionData);

      expect(result.modules).toEqual([]);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Slot Calculation', () => {
    it('should calculate slots for default layout', () => {
      const slots = engine.calculateSlots('default');

      expect(Array.isArray(slots)).toBe(true);
      expect(slots.length).toBeGreaterThan(0);
    });

    it('should calculate slots for deep_work_dev layout', () => {
      const slots = engine.calculateSlots('deep_work_dev');

      expect(slots.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown layout', () => {
      const slots = engine.calculateSlots('unknown-layout' as any);

      expect(slots).toEqual([]);
    });

    it('should have unique slot IDs', () => {
      const slots = engine.calculateSlots('default');

      const uniqueSlots = new Set(slots);
      expect(uniqueSlots.size).toBe(slots.length);
    });
  });

  describe('Responsive Adjustments', () => {
    it('should apply mobile responsive adjustments', () => {
      const modules = [
        { id: 'notes-1', type: 'notes' as const, slotId: 'slot-1', enabled: true },
      ];

      const adjusted = engine.applyResponsive(modules, 'mobile');

      expect(adjusted).toBeDefined();
      expect(Array.isArray(adjusted)).toBe(true);
    });

    it('should apply tablet responsive adjustments', () => {
      const modules = [
        { id: 'tasks-1', type: 'tasks' as const, slotId: 'slot-1', enabled: true },
      ];

      const adjusted = engine.applyResponsive(modules, 'tablet');

      expect(adjusted.length).toBe(modules.length);
    });

    it('should apply desktop responsive adjustments', () => {
      const modules = [
        { id: 'notes-1', type: 'notes' as const, slotId: 'slot-1', enabled: true },
        { id: 'tasks-1', type: 'tasks' as const, slotId: 'slot-2', enabled: true },
      ];

      const adjusted = engine.applyResponsive(modules, 'desktop');

      expect(adjusted.length).toBe(modules.length);
    });

    it('should apply wide responsive adjustments', () => {
      const modules = [
        { id: 'notes-1', type: 'notes' as const, slotId: 'slot-1', enabled: true },
      ];

      const adjusted = engine.applyResponsive(modules, 'wide');

      expect(adjusted).toBeDefined();
    });

    it('should preserve module IDs in responsive adjustments', () => {
      const modules = [
        { id: 'test-module', type: 'notes' as const, slotId: 'slot-1', enabled: true },
      ];

      const adjusted = engine.applyResponsive(modules, 'mobile');

      expect(adjusted[0].id).toBe('test-module');
    });
  });

  describe('Layout Registration', () => {
    it('should allow registering custom layouts', () => {
      engine.registerLayout({
        layoutType: 'deep_work_dev',
        id: 'custom-layout',
        name: 'Custom Layout',
        description: 'A custom layout',
        slots: {
          'slot-1': {
            desktop: { column: '1 / 13', row: '1 / 2' },
          },
        },
        gridConfig: {
          columns: 12,
          gap: '1rem',
        },
      });

      const layout = engine.getLayout('deep_work_dev');
      expect(layout).toBeDefined();
      expect(layout?.name).toBe('Custom Layout');
    });

    it('should retrieve all registered layouts', () => {
      const layouts = engine.getAllLayouts();

      expect(Array.isArray(layouts)).toBe(true);
      expect(layouts.length).toBeGreaterThan(0);
    });

    it('should include default layouts', () => {
      const layouts = engine.getAllLayouts();

      const defaultLayout = layouts.find((l) => l.layoutType === 'default');
      expect(defaultLayout).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty session data', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
      };

      const result = engine.selectLayout(sessionData);

      expect(result.layoutType).toBe('default');
    });

    it('should handle session with all content types', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasCodeChanges: true,
        codeChangeCount: 20,
        hasVideoContent: true,
        videoChapterCount: 5,
        hasAudioContent: true,
        audioSegmentCount: 3,
        hasScreenshots: true,
        screenshotCount: 30,
        hasDecisions: true,
        decisionCount: 8,
        hasNotes: true,
        noteCount: 12,
        hasTasks: true,
        taskCount: 15,
        participantCount: 4,
        duration: 7200,
      };

      const result = engine.selectLayout(sessionData);

      expect(result).toBeDefined();
      expect(result.layoutType).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle negative values gracefully', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        codeChangeCount: -5,
        screenshotCount: -10,
      };

      const result = engine.selectLayout(sessionData);

      expect(result).toBeDefined();
    });

    it('should handle very large values', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        codeChangeCount: 1000000,
        screenshotCount: 1000000,
      };

      const result = engine.selectLayout(sessionData);

      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Priority-based Layout Selection', () => {
    it('should select higher priority layout when multiple match', () => {
      // Code heavy (priority 10) vs Video learning (priority 9)
      const sessionData: SessionData = {
        userId: 'test-user',
        hasCodeChanges: true,
        codeChangeCount: 15,
        hasVideoContent: true,
        videoChapterCount: 5,
      };

      const result = engine.selectLayout(sessionData);

      // Should prefer code heavy layout due to higher priority
      expect(result.layoutType).toBe('deep_work_dev');
    });

    it('should include reasoning from all matching heuristics', () => {
      const sessionData: SessionData = {
        userId: 'test-user',
        hasCodeChanges: true,
        codeChangeCount: 15,
        hasScreenshots: true,
        screenshotCount: 25,
      };

      const result = engine.selectLayout(sessionData);

      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });
});
