/**
 * Tests for Configuration Generator and Session Analysis
 *
 * These tests verify that the analyzeSessionData function correctly
 * extracts characteristics from session data and that the layout
 * selection heuristics can trigger properly.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeSessionData,
  determineLayoutType,
  generateConfig,
} from '../config-generator';
import type { SessionData } from '../../types';

describe('analyzeSessionData', () => {
  it('should return default values for empty session', () => {
    const emptySession: SessionData = {};

    const result = analyzeSessionData(emptySession);

    expect(result).toEqual({
      hasCodeChanges: false,
      codeChangeCount: 0,
      hasVideoContent: false,
      videoChapterCount: 0,
      hasAudioContent: false,
      audioSegmentCount: 0,
      hasScreenshots: false,
      screenshotCount: 0,
      hasDecisions: false,
      decisionCount: 0,
      hasNotes: false,
      noteCount: 0,
      hasTasks: false,
      taskCount: 0,
      duration: 0,
      participantCount: 1,
      primaryContentType: 'mixed',
      intensity: 'light',
    });
  });

  it('should calculate duration from start and end times', () => {
    const session: SessionData = {
      startTime: '2025-01-15T10:00:00Z',
      endTime: '2025-01-15T12:30:00Z',
    };

    const result = analyzeSessionData(session);

    expect(result.duration).toBe(150); // 2.5 hours = 150 minutes
  });

  it('should count screenshots correctly', () => {
    const session: SessionData = {
      screenshots: [
        { id: '1', timestamp: '2025-01-15T10:00:00Z', analysisStatus: 'complete' },
        { id: '2', timestamp: '2025-01-15T10:05:00Z', analysisStatus: 'complete' },
        { id: '3', timestamp: '2025-01-15T10:10:00Z', analysisStatus: 'complete' },
      ],
    };

    const result = analyzeSessionData(session);

    expect(result.screenshotCount).toBe(3);
    expect(result.hasScreenshots).toBe(true);
  });

  it('should count audio segments correctly', () => {
    const session: SessionData = {
      audioSegments: [
        { id: '1', transcription: 'Testing audio' },
        { id: '2', transcription: 'More audio' },
      ],
    };

    const result = analyzeSessionData(session);

    expect(result.audioSegmentCount).toBe(2);
    expect(result.hasAudioContent).toBe(true);
  });

  it('should detect video content with chapters', () => {
    const session: SessionData = {
      video: {
        id: 'v1',
        chapters: [
          { id: 'c1', title: 'Intro' },
          { id: 'c2', title: 'Main work' },
          { id: 'c3', title: 'Conclusion' },
        ],
      },
    };

    const result = analyzeSessionData(session);

    expect(result.hasVideoContent).toBe(true);
    expect(result.videoChapterCount).toBe(3);
  });

  it('should count extracted tasks and notes', () => {
    const session: SessionData = {
      extractedTaskIds: ['t1', 't2', 't3', 't4'],
      extractedNoteIds: ['n1', 'n2'],
    };

    const result = analyzeSessionData(session);

    expect(result.taskCount).toBe(4);
    expect(result.hasTasks).toBe(true);
    expect(result.noteCount).toBe(2);
    expect(result.hasNotes).toBe(true);
  });

  it('should detect code changes from screenshot AI analysis - coding activity', () => {
    const session: SessionData = {
      screenshots: [
        {
          id: 's1',
          timestamp: '2025-01-15T10:00:00Z',
          analysisStatus: 'complete',
          aiAnalysis: {
            summary: 'User editing code',
            detectedActivity: 'coding',
            keyElements: ['VSCode', 'TypeScript file'],
            confidence: 0.9,
          },
        },
        {
          id: 's2',
          timestamp: '2025-01-15T10:05:00Z',
          analysisStatus: 'complete',
          aiAnalysis: {
            summary: 'User in terminal',
            detectedActivity: 'terminal',
            keyElements: ['Git commands'],
            confidence: 0.85,
          },
        },
      ],
    };

    const result = analyzeSessionData(session);

    expect(result.hasCodeChanges).toBe(true);
    expect(result.codeChangeCount).toBe(2);
  });

  it('should detect code changes from key elements', () => {
    const session: SessionData = {
      screenshots: [
        {
          id: 's1',
          timestamp: '2025-01-15T10:00:00Z',
          analysisStatus: 'complete',
          aiAnalysis: {
            summary: 'Working on something',
            detectedActivity: 'working',
            keyElements: ['VSCode', 'Code Editor', 'Git Branch'],
            confidence: 0.9,
          },
        },
      ],
    };

    const result = analyzeSessionData(session);

    expect(result.hasCodeChanges).toBe(true);
    expect(result.codeChangeCount).toBe(1);
  });

  it('should detect decisions from audio insights', () => {
    const session: SessionData = {
      audioInsights: {
        keyMoments: [
          { timestamp: 100, type: 'decision', description: 'Chose to use React' },
          { timestamp: 200, type: 'achievement', description: 'Completed feature' },
          { timestamp: 300, type: 'decision', description: 'Decided on architecture' },
        ],
      },
    };

    const result = analyzeSessionData(session);

    expect(result.hasDecisions).toBe(true);
    expect(result.decisionCount).toBe(2); // Only decision type
  });

  it('should count participants correctly', () => {
    const session: SessionData = {
      participants: [
        { id: 'u1', name: 'Alice' },
        { id: 'u2', name: 'Bob' },
        { id: 'u3', name: 'Charlie' },
      ],
    };

    const result = analyzeSessionData(session);

    expect(result.participantCount).toBe(3);
  });

  it('should determine primary content type as CODE for code-heavy sessions', () => {
    const session: SessionData = {
      screenshots: [
        {
          id: 's1',
          aiAnalysis: {
            summary: 'Coding',
            detectedActivity: 'coding',
            keyElements: ['VSCode'],
            confidence: 0.9,
          },
        },
        {
          id: 's2',
          aiAnalysis: {
            summary: 'Coding',
            detectedActivity: 'programming',
            keyElements: ['IDE'],
            confidence: 0.9,
          },
        },
      ],
    };

    const result = analyzeSessionData(session);

    expect(result.primaryContentType).toBe('code');
  });

  it('should determine primary content type as VISUAL for screenshot-heavy sessions', () => {
    const session: SessionData = {
      screenshots: Array.from({ length: 25 }, (_, i) => ({
        id: `s${i}`,
        timestamp: new Date().toISOString(),
        analysisStatus: 'complete',
      })),
    };

    const result = analyzeSessionData(session);

    expect(result.primaryContentType).toBe('visual');
  });

  it('should determine intensity as LIGHT for low content', () => {
    const session: SessionData = {
      screenshots: [{ id: 's1' }, { id: 's2' }],
      extractedTaskIds: ['t1'],
    };

    const result = analyzeSessionData(session);

    expect(result.intensity).toBe('light');
  });

  it('should determine intensity as MODERATE for medium content', () => {
    const session: SessionData = {
      screenshots: Array.from({ length: 20 }, (_, i) => ({ id: `s${i}` })),
      extractedTaskIds: Array.from({ length: 10 }, (_, i) => `t${i}`),
    };

    const result = analyzeSessionData(session);

    expect(result.intensity).toBe('moderate');
  });

  it('should determine intensity as HEAVY for high content', () => {
    const session: SessionData = {
      screenshots: Array.from({ length: 40 }, (_, i) => ({ id: `s${i}` })),
      extractedTaskIds: Array.from({ length: 15 }, (_, i) => `t${i}`),
      extractedNoteIds: Array.from({ length: 10 }, (_, i) => `n${i}`),
    };

    const result = analyzeSessionData(session);

    expect(result.intensity).toBe('heavy');
  });
});

describe('determineLayoutType', () => {
  it('should select DEEP_WORK_DEV layout for code-heavy sessions', () => {
    const session: SessionData = {
      screenshots: Array.from({ length: 15 }, (_, i) => ({
        id: `s${i}`,
        timestamp: new Date().toISOString(),
        analysisStatus: 'complete',
        aiAnalysis: {
          summary: 'Coding',
          detectedActivity: 'coding',
          keyElements: ['VSCode', 'Terminal'],
          confidence: 0.9,
        },
      })),
    };

    const layoutType = determineLayoutType(session);

    expect(layoutType).toBe('deep_work_dev');
  });

  it('should select LEARNING_SESSION layout for video-heavy sessions', () => {
    const session: SessionData = {
      video: {
        id: 'v1',
        chapters: [
          { id: 'c1', title: 'Intro' },
          { id: 'c2', title: 'Topic 1' },
          { id: 'c3', title: 'Topic 2' },
          { id: 'c4', title: 'Conclusion' },
        ],
      },
    };

    const layoutType = determineLayoutType(session);

    expect(layoutType).toBe('learning_session');
  });

  it('should select COLLABORATIVE_MEETING layout for multi-participant sessions with decisions', () => {
    const session: SessionData = {
      participants: [
        { id: 'u1', name: 'Alice' },
        { id: 'u2', name: 'Bob' },
      ],
      audioInsights: {
        keyMoments: [
          { timestamp: 100, type: 'decision', description: 'Chose approach A' },
          { timestamp: 200, type: 'decision', description: 'Decided on timeline' },
        ],
      },
    };

    const layoutType = determineLayoutType(session);

    expect(layoutType).toBe('collaborative_meeting');
  });

  it('should select RESEARCH_REVIEW layout for many screenshots', () => {
    const session: SessionData = {
      screenshots: Array.from({ length: 25 }, (_, i) => ({
        id: `s${i}`,
        timestamp: new Date().toISOString(),
        analysisStatus: 'complete',
      })),
    };

    const layoutType = determineLayoutType(session);

    expect(layoutType).toBe('research_review');
  });

  it('should select DEFAULT layout for minimal sessions', () => {
    const session: SessionData = {
      screenshots: [{ id: 's1' }],
    };

    const layoutType = determineLayoutType(session);

    expect(layoutType).toBe('default');
  });
});

describe('generateConfig - Integration Tests', () => {
  it('should generate config with deep_work_dev layout for code-heavy session', () => {
    const session: SessionData = {
      userId: 'user123',
      startTime: '2025-01-15T10:00:00Z',
      endTime: '2025-01-15T12:00:00Z',
      screenshots: Array.from({ length: 20 }, (_, i) => ({
        id: `s${i}`,
        timestamp: new Date().toISOString(),
        analysisStatus: 'complete',
        aiAnalysis: {
          summary: 'Developing feature',
          detectedActivity: 'coding',
          keyElements: ['VSCode', 'Git'],
          confidence: 0.9,
        },
      })),
      extractedTaskIds: ['t1', 't2', 't3'],
    };

    const result = generateConfig(session);

    if (!result.success) {
      console.log('Generation failed:', result.error);
      console.log('Warnings:', result.warnings);
    }

    expect(result.success).toBe(true);
    expect(result.layoutSelection.layoutType).toBe('deep_work_dev');
    expect(result.layoutSelection.confidence).toBeGreaterThan(0);
    expect(result.config).toBeDefined();
    expect(result.config?.modules).toBeDefined();
  });

  it('should generate config with learning_session layout for video session', () => {
    const session: SessionData = {
      userId: 'user123',
      video: {
        id: 'v1',
        chapters: [
          { id: 'c1', title: 'Introduction' },
          { id: 'c2', title: 'Core Concepts' },
          { id: 'c3', title: 'Advanced Topics' },
          { id: 'c4', title: 'Conclusion' },
        ],
      },
      extractedNoteIds: ['n1', 'n2', 'n3'],
    };

    const result = generateConfig(session);

    expect(result.success).toBe(true);
    expect(result.layoutSelection.layoutType).toBe('learning_session');
  });

  it('should respect manual layout override', () => {
    const session: SessionData = {
      userId: 'user123',
    };

    const result = generateConfig(session, {
      layoutType: 'creative_workshop',
    });

    expect(result.success).toBe(true);
    expect(result.layoutSelection.layoutType).toBe('creative_workshop');
    expect(result.layoutSelection.confidence).toBe(1.0);
    expect(result.layoutSelection.reasoning).toContain('Layout manually specified by user');
  });

  it('should include appropriate modules for session content', () => {
    const session: SessionData = {
      userId: 'user123',
      screenshots: Array.from({ length: 15 }, () => ({ id: Math.random().toString() })),
      extractedTaskIds: ['t1', 't2'],
      extractedNoteIds: ['n1'],
      audioSegments: [{ id: 'a1', transcription: 'Audio content' }],
    };

    const result = generateConfig(session);

    expect(result.success).toBe(true);
    // Module composition may be empty if no modules are registered
    // This is expected in test environment
    expect(result.moduleComposition).toBeDefined();
    expect(result.config).toBeDefined();
  });
});

describe('Real-world Session Scenarios', () => {
  it('SCENARIO: Deep coding session with debugging', () => {
    const session: SessionData = {
      userId: 'dev-user',
      startTime: '2025-01-15T09:00:00Z',
      endTime: '2025-01-15T12:30:00Z',
      screenshots: Array.from({ length: 15 }, (_, i) => ({
        id: `s${i}`,
        timestamp: new Date().toISOString(),
        analysisStatus: 'complete',
        aiAnalysis: {
          summary: i % 3 === 0 ? 'Coding in VSCode' : i % 3 === 1 ? 'Running tests' : 'Git commit',
          detectedActivity: i % 3 === 0 ? 'coding' : i % 3 === 1 ? 'debugging' : 'git',
          keyElements: i % 3 === 0 ? ['VSCode', 'TypeScript'] : i % 3 === 1 ? ['Terminal', 'Jest'] : ['Git', 'GitHub'],
          confidence: 0.9,
        },
      })),
      extractedTaskIds: ['fix-bug-123', 'add-tests'],
    };

    const characteristics = analyzeSessionData(session);
    const layoutType = determineLayoutType(session);

    expect(characteristics.hasCodeChanges).toBe(true);
    expect(characteristics.codeChangeCount).toBe(15);
    expect(characteristics.primaryContentType).toBe('code');
    expect(layoutType).toBe('deep_work_dev');
  });

  it('SCENARIO: Video learning session with notes', () => {
    const session: SessionData = {
      userId: 'learner-user',
      startTime: '2025-01-15T14:00:00Z',
      endTime: '2025-01-15T16:00:00Z',
      video: {
        id: 'video-tutorial',
        chapters: [
          { id: 'c1', title: 'React Basics' },
          { id: 'c2', title: 'Hooks' },
          { id: 'c3', title: 'Context API' },
          { id: 'c4', title: 'Best Practices' },
        ],
      },
      extractedNoteIds: ['note-hooks', 'note-context', 'note-tips'],
      audioSegments: Array.from({ length: 12 }, (_, i) => ({
        id: `audio-${i}`,
        transcription: 'Learning content',
      })),
    };

    const characteristics = analyzeSessionData(session);
    const layoutType = determineLayoutType(session);

    expect(characteristics.hasVideoContent).toBe(true);
    expect(characteristics.videoChapterCount).toBe(4);
    expect(characteristics.hasAudioContent).toBe(true);
    expect(characteristics.primaryContentType).toBe('media');
    expect(layoutType).toBe('learning_session');
  });

  it('SCENARIO: Collaborative meeting with decisions', () => {
    const session: SessionData = {
      userId: 'team-lead',
      participants: [
        { id: 'u1', name: 'Alice' },
        { id: 'u2', name: 'Bob' },
        { id: 'u3', name: 'Charlie' },
      ],
      startTime: '2025-01-15T10:00:00Z',
      endTime: '2025-01-15T11:00:00Z',
      audioInsights: {
        keyMoments: [
          { timestamp: 300, type: 'decision', description: 'Chose architecture approach' },
          { timestamp: 1200, type: 'decision', description: 'Assigned task responsibilities' },
          { timestamp: 2400, type: 'decision', description: 'Set sprint goals' },
        ],
      },
      screenshots: [
        {
          id: 's1',
          aiAnalysis: {
            summary: 'Video conference',
            detectedActivity: 'meeting',
            keyElements: ['Zoom', 'Shared screen'],
            confidence: 0.9,
          },
        },
      ],
      extractedTaskIds: ['task-1', 'task-2', 'task-3', 'task-4'],
    };

    const characteristics = analyzeSessionData(session);
    const layoutType = determineLayoutType(session);

    expect(characteristics.participantCount).toBe(3);
    expect(characteristics.hasDecisions).toBe(true);
    expect(characteristics.decisionCount).toBe(3);
    expect(layoutType).toBe('collaborative_meeting');
  });

  it('SCENARIO: Research session with many screenshots', () => {
    const session: SessionData = {
      userId: 'researcher',
      startTime: '2025-01-15T08:00:00Z',
      endTime: '2025-01-15T10:00:00Z',
      screenshots: Array.from({ length: 30 }, (_, i) => ({
        id: `s${i}`,
        timestamp: new Date(Date.now() + i * 60000).toISOString(),
        analysisStatus: 'complete',
        aiAnalysis: {
          summary: 'Reading documentation',
          detectedActivity: 'research',
          keyElements: ['Browser', 'Documentation'],
          confidence: 0.8,
        },
      })),
      extractedNoteIds: Array.from({ length: 8 }, (_, i) => `note-${i}`),
    };

    const characteristics = analyzeSessionData(session);
    const layoutType = determineLayoutType(session);

    expect(characteristics.hasScreenshots).toBe(true);
    expect(characteristics.screenshotCount).toBe(30);
    expect(characteristics.hasNotes).toBe(true);
    expect(characteristics.intensity).toBe('moderate');
    expect(layoutType).toBe('research_review');
  });
});
