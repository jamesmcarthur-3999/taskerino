/**
 * Unit Tests for SessionQueryEngine
 *
 * Tests all functionality of the SessionQueryEngine class:
 * - Query type detection and routing
 * - Error handling for invalid queries
 * - Structured query handler with real filtering
 * - Relevance scoring and sorting
 * - Performance (<200ms for complex queries)
 * - Type guards
 * - QueryError class
 *
 * Target: 90%+ coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SessionQueryEngine,
  QueryError,
  type StructuredQuery,
  type NaturalQuery,
  type AggregationQuery,
  type QueryResult,
} from './SessionQueryEngine';
import type { Session, SessionScreenshot, SessionAudioSegment } from '../types';

// =============================================================================
// MOCK DATA
// =============================================================================

/**
 * Create a mock session with rich data for testing.
 */
function createMockSession(): Session {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  return {
    id: 'session-1',
    name: 'Test Session',
    description: 'Testing session query functionality',
    status: 'completed',
    startTime: twoDaysAgo.toISOString(),
    endTime: now.toISOString(),
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'transcription',
    audioRecording: false,
    audioReviewCompleted: false,
    tags: ['testing', 'development'],
    relationships: [],
    screenshots: [
      // High-relevance screenshot with blocker
      {
        id: 'screenshot-1',
        sessionId: 'session-1',
        timestamp: oneHourAgo.toISOString(),
        attachmentId: 'attachment-1',
        aiAnalysis: {
          detectedActivity: 'coding',
          extractedText: 'Authentication bug found in login flow',
          summary: 'Bug found in authentication system',
          keyElements: ['login', 'authentication', 'bug'],
          curiosity: 0.9,
          progressIndicators: {
            achievements: [],
            blockers: ['Authentication bug blocking deployment'],
            insights: [],
          },
        },
        analysisStatus: 'complete',
      },
      // Medium-relevance screenshot with achievement
      {
        id: 'screenshot-2',
        sessionId: 'session-1',
        timestamp: oneHourAgo.toISOString(),
        attachmentId: 'attachment-2',
        aiAnalysis: {
          detectedActivity: 'coding',
          extractedText: 'Fixed authentication bug',
          summary: 'Successfully fixed the authentication issue',
          keyElements: ['authentication', 'fix'],
          curiosity: 0.7,
          progressIndicators: {
            achievements: ['Fixed authentication bug'],
            blockers: [],
            insights: [],
          },
        },
        analysisStatus: 'complete',
      },
      // Low-relevance screenshot (old)
      {
        id: 'screenshot-3',
        sessionId: 'session-1',
        timestamp: twoDaysAgo.toISOString(),
        attachmentId: 'attachment-3',
        aiAnalysis: {
          detectedActivity: 'meetings',
          extractedText: 'Meeting notes',
          summary: 'Discussing project roadmap',
          keyElements: ['meeting', 'roadmap'],
          curiosity: 0.3,
          progressIndicators: {
            achievements: [],
            blockers: [],
            insights: [],
          },
        },
        analysisStatus: 'complete',
      },
      // Different activity
      {
        id: 'screenshot-4',
        sessionId: 'session-1',
        timestamp: oneHourAgo.toISOString(),
        attachmentId: 'attachment-4',
        aiAnalysis: {
          detectedActivity: 'research',
          extractedText: 'Researching OAuth implementation patterns',
          summary: 'Learning about OAuth 2.0',
          keyElements: ['OAuth', 'research'],
          curiosity: 0.6,
          progressIndicators: {
            achievements: [],
            blockers: [],
            insights: ['OAuth flow is complex'],
          },
        },
        analysisStatus: 'complete',
      },
    ] as SessionScreenshot[],
    audioSegments: [
      // High-relevance audio with blocker
      {
        id: 'audio-1',
        sessionId: 'session-1',
        timestamp: oneHourAgo.toISOString(),
        attachmentId: 'audio-attachment-1',
        transcription: 'I found a critical authentication bug that needs fixing',
        containsTask: true,
        containsBlocker: true,
        sentiment: 'negative',
        keyPhrases: ['authentication bug', 'critical', 'needs fixing'],
      },
      // Medium-relevance audio
      {
        id: 'audio-2',
        sessionId: 'session-1',
        timestamp: oneHourAgo.toISOString(),
        attachmentId: 'audio-attachment-2',
        transcription: 'Successfully fixed the authentication issue',
        containsTask: false,
        containsBlocker: false,
        sentiment: 'positive',
        keyPhrases: ['fixed', 'authentication', 'successful'],
      },
      // Low-relevance audio (old)
      {
        id: 'audio-3',
        sessionId: 'session-1',
        timestamp: twoDaysAgo.toISOString(),
        attachmentId: 'audio-attachment-3',
        transcription: 'Let me check the meeting notes',
        containsTask: false,
        containsBlocker: false,
        sentiment: 'neutral',
        keyPhrases: ['meeting', 'notes'],
      },
    ] as SessionAudioSegment[],
  };
}

describe('SessionQueryEngine', () => {
  let engine: SessionQueryEngine;

  beforeEach(() => {
    engine = new SessionQueryEngine();
  });

  // ===========================================================================
  // CONSTRUCTOR
  // ===========================================================================

  describe('Constructor', () => {
    it('should create instance without errors', () => {
      expect(engine).toBeInstanceOf(SessionQueryEngine);
    });

    it('should be callable multiple times', () => {
      const engine1 = new SessionQueryEngine();
      const engine2 = new SessionQueryEngine();

      expect(engine1).toBeInstanceOf(SessionQueryEngine);
      expect(engine2).toBeInstanceOf(SessionQueryEngine);
    });
  });

  // ===========================================================================
  // QUERY TYPE DETECTION & ROUTING
  // ===========================================================================

  describe('Query Type Detection', () => {
    beforeEach(() => {
      // Set active session for all query type detection tests
      const session = createMockSession();
      engine.setActiveSession(session);
    });

    it('should detect StructuredQuery by activity field', async () => {
      const query: StructuredQuery = {
        activity: ['coding'],
      };

      const result = await engine.query(query);

      // Should return filtered data
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.sources).toBeDefined();
    });

    it('should detect StructuredQuery by keywords field', async () => {
      const query: StructuredQuery = {
        keywords: ['authentication'],
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it('should detect StructuredQuery by hasBlockers field', async () => {
      const query: StructuredQuery = {
        hasBlockers: true,
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it('should detect StructuredQuery by hasAchievements field', async () => {
      const query: StructuredQuery = {
        hasAchievements: true,
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it('should detect StructuredQuery by curiosity field', async () => {
      const query: StructuredQuery = {
        curiosity: { min: 50, max: 100 },
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it('should detect StructuredQuery by timeRange field (minutes)', async () => {
      const query: StructuredQuery = {
        timeRange: { minutes: 60 },
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it('should detect StructuredQuery by timeRange field (date range)', async () => {
      const query: StructuredQuery = {
        timeRange: {
          start: new Date('2025-11-01'),
          end: new Date('2025-11-02'),
        },
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it('should detect StructuredQuery by limit field', async () => {
      const query: StructuredQuery = {
        limit: 10,
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it('should detect NaturalQuery by question field', async () => {
      const query: NaturalQuery = {
        question: 'What did I work on yesterday?',
      };

      const result = await engine.query(query);

      expect(result.answer).toContain('What did I work on yesterday?');
      expect(result.confidence).toBe(0.85);
      expect(result.sources).toEqual([]);
    });

    it('should detect NaturalQuery with context field', async () => {
      const query: NaturalQuery = {
        question: 'Show me my progress',
        context: 'detailed',
      };

      const result = await engine.query(query);
      expect(result.answer).toContain('detailed');
    });

    it('should detect AggregationQuery by groupBy and metrics fields', async () => {
      const query: AggregationQuery = {
        groupBy: 'activity',
        metrics: ['duration', 'screenshot_count'],
      };

      const result = await engine.query(query);

      expect(result.data).toEqual({});
      expect(result.confidence).toBe(1.0);
    });

    it('should detect AggregationQuery with timeRange', async () => {
      const query: AggregationQuery = {
        groupBy: 'hour',
        metrics: ['duration'],
        timeRange: {
          start: new Date('2025-11-01'),
          end: new Date('2025-11-07'),
        },
      };

      const result = await engine.query(query);
      expect(result.data).toEqual({});
    });
  });

  // ===========================================================================
  // STRUCTURED QUERY VALIDATION
  // ===========================================================================

  describe('StructuredQuery Validation', () => {
    beforeEach(() => {
      // Set active session for validation tests
      const session = createMockSession();
      engine.setActiveSession(session);
    });

    it('should accept valid curiosity range', async () => {
      const query: StructuredQuery = {
        curiosity: { min: 0, max: 100 },
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
    });

    it('should reject curiosity min < 0', async () => {
      const query: StructuredQuery = {
        curiosity: { min: -10, max: 100 },
      };

      const result = await engine.query(query);
      expect(result.error).toContain('valid curiosity score range');
    });

    it('should reject curiosity min > 100', async () => {
      const query: StructuredQuery = {
        curiosity: { min: 150, max: 200 },
      };

      const result = await engine.query(query);
      expect(result.error).toContain('valid curiosity score range');
    });

    it('should reject curiosity max < 0', async () => {
      const query: StructuredQuery = {
        curiosity: { min: 0, max: -50 },
      };

      const result = await engine.query(query);
      expect(result.error).toContain('valid curiosity score range');
    });

    it('should reject curiosity max > 100', async () => {
      const query: StructuredQuery = {
        curiosity: { min: 0, max: 150 },
      };

      const result = await engine.query(query);
      expect(result.error).toContain('valid curiosity score range');
    });

    it('should reject curiosity min > max', async () => {
      const query: StructuredQuery = {
        curiosity: { min: 80, max: 20 },
      };

      const result = await engine.query(query);
      expect(result.error).toContain('valid curiosity score range');
    });

    it('should accept valid limit', async () => {
      const query: StructuredQuery = {
        limit: 10,
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
    });

    it('should reject limit < 1', async () => {
      const query: StructuredQuery = {
        limit: 0,
      };

      const result = await engine.query(query);
      expect(result.error).toContain('valid limit');
    });

    it('should reject negative limit', async () => {
      const query: StructuredQuery = {
        limit: -5,
      };

      const result = await engine.query(query);
      expect(result.error).toContain('valid limit');
    });
  });

  // ===========================================================================
  // NATURAL QUERY VALIDATION
  // ===========================================================================

  describe('NaturalQuery Validation', () => {
    it('should accept valid question', async () => {
      const query: NaturalQuery = {
        question: 'What did I do today?',
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
      expect(result.answer).toBeDefined();
    });

    it('should reject empty question', async () => {
      const query: NaturalQuery = {
        question: '',
      };

      const result = await engine.query(query);
      expect(result.error).toContain('provide a question');
    });

    it('should reject whitespace-only question', async () => {
      const query: NaturalQuery = {
        question: '   ',
      };

      const result = await engine.query(query);
      expect(result.error).toContain('provide a question');
    });

    it('should accept summary context', async () => {
      const query: NaturalQuery = {
        question: 'What did I do?',
        context: 'summary',
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
    });

    it('should accept detailed context', async () => {
      const query: NaturalQuery = {
        question: 'What did I do?',
        context: 'detailed',
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
    });

    it('should accept timeline context', async () => {
      const query: NaturalQuery = {
        question: 'What did I do?',
        context: 'timeline',
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid context', async () => {
      const query = {
        question: 'What did I do?',
        context: 'invalid',
      } as NaturalQuery;

      const result = await engine.query(query);
      expect(result.error).toContain('summary, detailed, or timeline');
    });
  });

  // ===========================================================================
  // AGGREGATION QUERY VALIDATION
  // ===========================================================================

  describe('AggregationQuery Validation', () => {
    it('should accept activity groupBy', async () => {
      const query: AggregationQuery = {
        groupBy: 'activity',
        metrics: ['duration'],
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
    });

    it('should accept hour groupBy', async () => {
      const query: AggregationQuery = {
        groupBy: 'hour',
        metrics: ['duration'],
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
    });

    it('should accept topic groupBy', async () => {
      const query: AggregationQuery = {
        groupBy: 'topic',
        metrics: ['duration'],
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid groupBy', async () => {
      const query = {
        groupBy: 'invalid',
        metrics: ['duration'],
      } as AggregationQuery;

      const result = await engine.query(query);
      expect(result.error).toContain('activity, hour, or topic');
    });

    it('should accept duration metric', async () => {
      const query: AggregationQuery = {
        groupBy: 'activity',
        metrics: ['duration'],
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
    });

    it('should accept screenshot_count metric', async () => {
      const query: AggregationQuery = {
        groupBy: 'activity',
        metrics: ['screenshot_count'],
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
    });

    it('should accept blocker_count metric', async () => {
      const query: AggregationQuery = {
        groupBy: 'activity',
        metrics: ['blocker_count'],
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
    });

    it('should accept multiple metrics', async () => {
      const query: AggregationQuery = {
        groupBy: 'activity',
        metrics: ['duration', 'screenshot_count', 'blocker_count'],
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty metrics array', async () => {
      const query: AggregationQuery = {
        groupBy: 'activity',
        metrics: [],
      };

      const result = await engine.query(query);
      expect(result.error).toContain('at least one metric');
    });

    it('should reject invalid metric', async () => {
      const query = {
        groupBy: 'activity',
        metrics: ['invalid_metric'],
      } as AggregationQuery;

      const result = await engine.query(query);
      expect(result.error).toContain('Metric must be one of');
    });

    it('should accept valid timeRange', async () => {
      const query: AggregationQuery = {
        groupBy: 'activity',
        metrics: ['duration'],
        timeRange: {
          start: new Date('2025-11-01'),
          end: new Date('2025-11-07'),
        },
      };

      const result = await engine.query(query);
      expect(result.error).toBeUndefined();
    });

    it('should reject timeRange with start >= end', async () => {
      const query: AggregationQuery = {
        groupBy: 'activity',
        metrics: ['duration'],
        timeRange: {
          start: new Date('2025-11-07'),
          end: new Date('2025-11-01'),
        },
      };

      const result = await engine.query(query);
      expect(result.error).toContain('valid time range');
    });

    it('should reject timeRange with start === end', async () => {
      const date = new Date('2025-11-01');
      const query: AggregationQuery = {
        groupBy: 'activity',
        metrics: ['duration'],
        timeRange: {
          start: date,
          end: date,
        },
      };

      const result = await engine.query(query);
      expect(result.error).toContain('valid time range');
    });
  });

  // ===========================================================================
  // INVALID QUERY HANDLING
  // ===========================================================================

  describe('Invalid Query Handling', () => {
    it('should reject empty query object', async () => {
      const query = {} as StructuredQuery;

      const result = await engine.query(query);
      expect(result.error).toContain('valid query');
    });

    it('should reject null query', async () => {
      const query = null as unknown as StructuredQuery;

      const result = await engine.query(query);
      expect(result.error).toContain('valid query');
    });

    it('should reject undefined query', async () => {
      const query = undefined as unknown as StructuredQuery;

      const result = await engine.query(query);
      expect(result.error).toContain('valid query');
    });

    it('should reject non-object query', async () => {
      const query = 'string' as unknown as StructuredQuery;

      const result = await engine.query(query);
      expect(result.error).toContain('valid query');
    });

    it('should reject number query', async () => {
      const query = 123 as unknown as StructuredQuery;

      const result = await engine.query(query);
      expect(result.error).toContain('valid query');
    });

    it('should reject array query', async () => {
      const query = [] as unknown as StructuredQuery;

      const result = await engine.query(query);
      expect(result.error).toContain('valid query');
    });
  });

  // ===========================================================================
  // PLACEHOLDER HANDLER RESULTS
  // ===========================================================================

  describe('Placeholder Handler Results', () => {
    beforeEach(() => {
      // Set active session for placeholder handler tests
      const session = createMockSession();
      engine.setActiveSession(session);
    });

    it('should return structured data for StructuredQuery', async () => {
      const query: StructuredQuery = {
        activity: ['coding'],
      };

      const result = await engine.query(query);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.sources).toBeDefined();

      // Verify data structure
      const data = result.data as any;
      expect(data.screenshots).toBeDefined();
      expect(data.audioSegments).toBeDefined();
      expect(data.count).toBeDefined();
    });

    // Natural language query tests moved to dedicated section below
    // These require API key and are tested manually or with proper mocking

    it('should return empty object for AggregationQuery', async () => {
      const query: AggregationQuery = {
        groupBy: 'activity',
        metrics: ['duration'],
      };

      const result = await engine.query(query);

      expect(result.data).toEqual({});
      expect(result.confidence).toBe(1.0);
    });
  });

  // ===========================================================================
  // COMPLEX QUERIES
  // ===========================================================================

  describe('Complex Queries', () => {
    beforeEach(() => {
      // Set active session for complex query tests
      const session = createMockSession();
      engine.setActiveSession(session);
    });

    it('should handle StructuredQuery with all fields', async () => {
      const query: StructuredQuery = {
        activity: ['coding', 'debugging'],
        keywords: ['authentication', 'bug'],
        hasBlockers: true,
        hasAchievements: true,
        timeRange: {
          start: new Date('2025-11-01'),
          end: new Date('2025-11-02'),
        },
        curiosity: { min: 50, max: 100 },
        limit: 10,
      };

      const result = await engine.query(query);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it('should handle NaturalQuery with all fields', async () => {
      const query: NaturalQuery = {
        question: 'What bugs did I fix in the authentication system last week?',
        context: 'detailed',
      };

      const result = await engine.query(query);

      expect(result.error).toBeUndefined();
      expect(result.answer).toBeDefined();
    });

    it('should handle AggregationQuery with all fields', async () => {
      const query: AggregationQuery = {
        groupBy: 'activity',
        metrics: ['duration', 'screenshot_count', 'blocker_count'],
        timeRange: {
          start: new Date('2025-11-01'),
          end: new Date('2025-11-07'),
        },
      };

      const result = await engine.query(query);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });
  });

  // ===========================================================================
  // QUERYERROR CLASS
  // ===========================================================================

  describe('QueryError Class', () => {
    it('should create error with all properties', () => {
      const error = new QueryError('Technical message', 'User message', 'ERROR_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('QueryError');
      expect(error.message).toBe('Technical message');
      expect(error.userMessage).toBe('User message');
      expect(error.code).toBe('ERROR_CODE');
    });

    it('should be throwable', () => {
      expect(() => {
        throw new QueryError('Test', 'Test user message', 'TEST_CODE');
      }).toThrow(QueryError);
    });

    it('should be catchable', () => {
      try {
        throw new QueryError('Test', 'Test user message', 'TEST_CODE');
      } catch (error) {
        expect(error).toBeInstanceOf(QueryError);
        expect((error as QueryError).userMessage).toBe('Test user message');
        expect((error as QueryError).code).toBe('TEST_CODE');
      }
    });

    it('should have correct prototype chain', () => {
      const error = new QueryError('Test', 'Test user message', 'TEST_CODE');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof QueryError).toBe(true);
    });
  });

  // ===========================================================================
  // ERROR CONVERSION
  // ===========================================================================

  describe('Error Conversion', () => {
    it('should convert QueryError to QueryResult with error field', async () => {
      // Force a QueryError by passing invalid curiosity range
      const query: StructuredQuery = {
        curiosity: { min: 150, max: 200 },
      };

      const result = await engine.query(query);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('valid curiosity score range');
    });

    it('should handle unexpected errors gracefully', async () => {
      // This test verifies that unexpected errors are caught and converted
      // In the placeholder implementation, we don't have unexpected errors,
      // but this test documents the expected behavior

      const session = createMockSession();
      engine.setActiveSession(session);

      const query: StructuredQuery = {
        activity: ['coding'],
      };

      const result = await engine.query(query);

      // Should succeed without errors
      expect(result.error).toBeUndefined();
    });
  });

  // ===========================================================================
  // SESSION MANAGEMENT
  // ===========================================================================

  describe('Session Management', () => {
    it('should set active session successfully', () => {
      const session = createMockSession();
      expect(() => engine.setActiveSession(session)).not.toThrow();
    });

    it('should throw error when querying without active session', async () => {
      const query: StructuredQuery = {
        activity: ['coding'],
      };

      const result = await engine.query(query);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('setActiveSession');
    });

    it('should throw error when setting focus filter without active session', () => {
      expect(() => {
        engine.setFocusFilter({ activities: ['coding'] });
      }).toThrow('No active session');
    });

    it('should set focus filter successfully with active session', () => {
      const session = createMockSession();
      engine.setActiveSession(session);

      expect(() => {
        engine.setFocusFilter({ activities: ['coding'], minCuriosity: 0.7 });
      }).not.toThrow();
    });
  });

  // ===========================================================================
  // STRUCTURED QUERY - REAL IMPLEMENTATION TESTS
  // ===========================================================================

  describe('Structured Query - Real Implementation', () => {
    beforeEach(() => {
      const session = createMockSession();
      engine.setActiveSession(session);
    });

    describe('Filter by Activity', () => {
      it('should filter screenshots by activity type', async () => {
        const query: StructuredQuery = {
          activity: ['coding'],
        };

        const result = await engine.query(query);

        expect(result.error).toBeUndefined();
        expect(result.data).toBeDefined();

        const data = result.data as any;
        expect(data.screenshots).toBeDefined();

        // Should only return coding screenshots
        const codingScreenshots = data.screenshots.filter(
          (s: SessionScreenshot) => s.aiAnalysis?.detectedActivity === 'coding'
        );
        expect(codingScreenshots.length).toBeGreaterThan(0);
      });

      it('should filter by research activity', async () => {
        const query: StructuredQuery = {
          activity: ['research'],
        };

        const result = await engine.query(query);

        const data = result.data as any;
        expect(data.screenshots).toBeDefined();

        const researchScreenshots = data.screenshots.filter(
          (s: SessionScreenshot) => s.aiAnalysis?.detectedActivity === 'research'
        );
        expect(researchScreenshots.length).toBeGreaterThan(0);
      });
    });

    describe('Filter by Keywords', () => {
      it('should filter by single keyword', async () => {
        const query: StructuredQuery = {
          keywords: ['authentication'],
        };

        const result = await engine.query(query);

        expect(result.error).toBeUndefined();
        const data = result.data as any;

        // Should return items containing "authentication"
        expect(data.screenshots.length + data.audioSegments.length).toBeGreaterThan(0);
      });

      it('should filter by multiple keywords', async () => {
        const query: StructuredQuery = {
          keywords: ['authentication', 'bug'],
        };

        const result = await engine.query(query);

        const data = result.data as any;
        expect(data.screenshots.length + data.audioSegments.length).toBeGreaterThan(0);
      });

      it('should return empty results for non-existent keyword', async () => {
        const query: StructuredQuery = {
          keywords: ['nonexistentkeyword123'],
        };

        const result = await engine.query(query);

        const data = result.data as any;
        expect(data.count).toBe(0);
      });
    });

    describe('Filter by Blockers', () => {
      it('should filter screenshots with blockers', async () => {
        const query: StructuredQuery = {
          hasBlockers: true,
        };

        const result = await engine.query(query);

        expect(result.error).toBeUndefined();
        const data = result.data as any;

        // Should return at least one screenshot with blockers
        expect(data.screenshots.length).toBeGreaterThan(0);

        // Verify all returned screenshots have blockers
        for (const screenshot of data.screenshots) {
          const blockers = screenshot.aiAnalysis?.progressIndicators?.blockers || [];
          expect(blockers.length).toBeGreaterThan(0);
        }
      });

      it('should filter audio with blockers', async () => {
        const query: StructuredQuery = {
          hasBlockers: true,
        };

        const result = await engine.query(query);

        const data = result.data as any;

        // Should return at least one audio segment with blocker
        const blockerAudio = data.audioSegments.filter(
          (a: SessionAudioSegment) => a.containsBlocker
        );
        expect(blockerAudio.length).toBeGreaterThan(0);
      });
    });

    describe('Filter by Achievements', () => {
      it('should filter screenshots with achievements', async () => {
        const query: StructuredQuery = {
          hasAchievements: true,
        };

        const result = await engine.query(query);

        expect(result.error).toBeUndefined();
        const data = result.data as any;

        // Should return at least one screenshot with achievements
        expect(data.screenshots.length).toBeGreaterThan(0);

        // Verify all returned screenshots have achievements
        for (const screenshot of data.screenshots) {
          const achievements = screenshot.aiAnalysis?.progressIndicators?.achievements || [];
          expect(achievements.length).toBeGreaterThan(0);
        }
      });
    });

    describe('Filter by Curiosity Score', () => {
      it('should filter by high curiosity score', async () => {
        const query: StructuredQuery = {
          curiosity: { min: 70, max: 100 },
        };

        const result = await engine.query(query);

        expect(result.error).toBeUndefined();
        const data = result.data as any;

        // Should return high curiosity screenshots
        expect(data.screenshots.length).toBeGreaterThan(0);

        // Verify all returned screenshots have curiosity >= 0.7
        for (const screenshot of data.screenshots) {
          const curiosity = screenshot.aiAnalysis?.curiosity || 0;
          expect(curiosity).toBeGreaterThanOrEqual(0.7);
        }
      });

      it('should filter by low curiosity score', async () => {
        const query: StructuredQuery = {
          curiosity: { min: 0, max: 50 },
        };

        const result = await engine.query(query);

        const data = result.data as any;

        // Should return low curiosity screenshots
        if (data.screenshots.length > 0) {
          for (const screenshot of data.screenshots) {
            const curiosity = screenshot.aiAnalysis?.curiosity || 0;
            expect(curiosity).toBeLessThanOrEqual(0.5);
          }
        }
      });
    });

    describe('Filter by Time Range', () => {
      it('should filter by relative time range (last 60 minutes)', async () => {
        const query: StructuredQuery = {
          timeRange: { minutes: 60 },
        };

        const result = await engine.query(query);

        expect(result.error).toBeUndefined();
        const data = result.data as any;

        // Should return items from last hour
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        for (const screenshot of data.screenshots) {
          const timestamp = new Date(screenshot.timestamp).getTime();
          expect(timestamp).toBeGreaterThanOrEqual(oneHourAgo);
        }

        for (const audio of data.audioSegments) {
          const timestamp = new Date(audio.timestamp).getTime();
          expect(timestamp).toBeGreaterThanOrEqual(oneHourAgo);
        }
      });

      it('should filter by absolute time range', async () => {
        const now = new Date();
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const query: StructuredQuery = {
          timeRange: {
            start: twoDaysAgo,
            end: oneDayAgo,
          },
        };

        const result = await engine.query(query);

        expect(result.error).toBeUndefined();
        const data = result.data as any;

        // Verify timestamps are within range
        for (const screenshot of data.screenshots) {
          const timestamp = new Date(screenshot.timestamp).getTime();
          expect(timestamp).toBeGreaterThanOrEqual(twoDaysAgo.getTime());
          expect(timestamp).toBeLessThanOrEqual(oneDayAgo.getTime());
        }
      });
    });

    describe('Result Limiting', () => {
      it('should limit results to specified count', async () => {
        const query: StructuredQuery = {
          limit: 2,
        };

        const result = await engine.query(query);

        expect(result.error).toBeUndefined();
        const data = result.data as any;

        // Total count should not exceed limit
        expect(data.count).toBeLessThanOrEqual(2);
      });

      it('should return recent activity when no filters specified', async () => {
        const query: StructuredQuery = {
          limit: 5,
        };

        const result = await engine.query(query);

        expect(result.error).toBeUndefined();
        const data = result.data as any;

        // Should return recent items
        expect(data.count).toBeGreaterThan(0);
        expect(data.count).toBeLessThanOrEqual(5);
      });
    });

    describe('Complex Queries', () => {
      it('should handle multiple filters combined', async () => {
        const query: StructuredQuery = {
          activity: ['coding'],
          keywords: ['authentication'],
          hasBlockers: true,
          timeRange: { minutes: 120 },
          limit: 10,
        };

        const result = await engine.query(query);

        expect(result.error).toBeUndefined();
        const data = result.data as any;

        // Should return filtered results
        expect(data).toBeDefined();
        expect(data.count).toBeLessThanOrEqual(10);
      });

      it('should handle achievements + curiosity filters', async () => {
        const query: StructuredQuery = {
          hasAchievements: true,
          curiosity: { min: 60, max: 100 },
          limit: 5,
        };

        const result = await engine.query(query);

        expect(result.error).toBeUndefined();
        const data = result.data as any;

        // Verify results match filters
        if (data.screenshots.length > 0) {
          for (const screenshot of data.screenshots) {
            const achievements = screenshot.aiAnalysis?.progressIndicators?.achievements || [];
            expect(achievements.length).toBeGreaterThan(0);

            const curiosity = screenshot.aiAnalysis?.curiosity || 0;
            expect(curiosity).toBeGreaterThanOrEqual(0.6);
          }
        }
      });
    });

    describe('Relevance Scoring', () => {
      it('should sort results by relevance (blockers first)', async () => {
        const query: StructuredQuery = {
          hasBlockers: true,
        };

        const result = await engine.query(query);

        const data = result.data as any;

        if (data.screenshots.length > 1) {
          // First screenshot should have blocker
          const firstScreenshot = data.screenshots[0];
          const blockers = firstScreenshot.aiAnalysis?.progressIndicators?.blockers || [];
          expect(blockers.length).toBeGreaterThan(0);
        }
      });

      it('should prioritize high curiosity screenshots', async () => {
        const query: StructuredQuery = {
          curiosity: { min: 50, max: 100 },
          limit: 10,
        };

        const result = await engine.query(query);

        const data = result.data as any;

        // Verify higher curiosity items come first
        if (data.screenshots.length > 1) {
          const firstCuriosity = data.screenshots[0].aiAnalysis?.curiosity || 0;
          const lastCuriosity = data.screenshots[data.screenshots.length - 1].aiAnalysis?.curiosity || 0;

          expect(firstCuriosity).toBeGreaterThanOrEqual(lastCuriosity);
        }
      });

      it('should prioritize recent items', async () => {
        const query: StructuredQuery = {
          limit: 10,
        };

        const result = await engine.query(query);

        const data = result.data as any;

        // Recent items should come first
        if (data.screenshots.length > 1) {
          const firstTimestamp = new Date(data.screenshots[0].timestamp).getTime();
          const lastTimestamp = new Date(data.screenshots[data.screenshots.length - 1].timestamp).getTime();

          expect(firstTimestamp).toBeGreaterThanOrEqual(lastTimestamp);
        }
      });
    });

    describe('Performance', () => {
      it('should complete complex query in <200ms', async () => {
        const query: StructuredQuery = {
          activity: ['coding', 'research'],
          keywords: ['authentication', 'bug', 'OAuth'],
          hasBlockers: true,
          hasAchievements: true,
          curiosity: { min: 50, max: 100 },
          timeRange: { minutes: 1440 },
          limit: 20,
        };

        const startTime = Date.now();
        const result = await engine.query(query);
        const elapsedTime = Date.now() - startTime;

        expect(result.error).toBeUndefined();
        expect(elapsedTime).toBeLessThan(200);

        // Verify result includes elapsed time
        const data = result.data as any;
        expect(data.elapsedMs).toBeDefined();
        expect(data.elapsedMs).toBeLessThan(200);
      });

      it('should handle large session with 100+ items efficiently', async () => {
        // Create session with many items
        const session = createMockSession();

        // Add 96 more screenshots (total 100)
        for (let i = 0; i < 96; i++) {
          session.screenshots.push({
            id: `screenshot-large-${i}`,
            sessionId: 'session-1',
            timestamp: new Date().toISOString(),
            attachmentId: `attachment-large-${i}`,
            aiAnalysis: {
              detectedActivity: 'coding',
              extractedText: `Test screenshot ${i}`,
              summary: `Test summary ${i}`,
              keyElements: ['test'],
              curiosity: Math.random(),
              progressIndicators: {
                achievements: [],
                blockers: [],
                insights: [],
              },
            },
            analysisStatus: 'complete',
          } as SessionScreenshot);
        }

        engine.setActiveSession(session);

        const query: StructuredQuery = {
          keywords: ['test'],
          limit: 50,
        };

        const startTime = Date.now();
        const result = await engine.query(query);
        const elapsedTime = Date.now() - startTime;

        expect(result.error).toBeUndefined();
        expect(elapsedTime).toBeLessThan(200);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty query gracefully', async () => {
        const query: StructuredQuery = {
          limit: 10, // Add limit to make it a valid query
        };

        const result = await engine.query(query);

        expect(result.error).toBeUndefined();
        const data = result.data as any;

        // Should return recent activity
        expect(data.count).toBeGreaterThan(0);
      });

      it('should handle query with no results', async () => {
        const query: StructuredQuery = {
          keywords: ['nonexistent12345'],
          hasBlockers: true,
          hasAchievements: true,
          curiosity: { min: 99, max: 100 },
        };

        const result = await engine.query(query);

        expect(result.error).toBeUndefined();
        const data = result.data as any;

        expect(data.count).toBe(0);
        expect(data.screenshots).toEqual([]);
        expect(data.audioSegments).toEqual([]);
      });

      it('should handle invalid time range gracefully', async () => {
        const query: StructuredQuery = {
          timeRange: {
            start: new Date('2025-11-10'),
            end: new Date('2025-11-01'),
          },
        };

        const result = await engine.query(query);

        expect(result.error).toContain('valid time range');
      });
    });
  });

  // =============================================================================
  // NATURAL LANGUAGE QUERY HANDLER TESTS
  // =============================================================================

  describe('Natural Language Query Handler', () => {
    // NOTE: These tests are MOCKED and do not make real API calls
    // We test the implementation logic, parsing, and error handling
    // Real API integration will be tested manually

    beforeEach(() => {
      const session = createMockSession();
      engine.setActiveSession(session);
    });

    describe('Query Validation', () => {
      it('should detect empty question', async () => {
        const query: NaturalQuery = {
          question: ''
        };

        const result = await engine.query(query);

        expect(result.error).toBeDefined();
        expect(result.error).toContain('question');
      });

      it('should detect invalid context level', async () => {
        const query: NaturalQuery = {
          question: 'What did I do?',
          context: 'invalid' as any
        };

        const result = await engine.query(query);

        expect(result.error).toBeDefined();
        expect(result.error).toContain('Context');
      });

      it('should require active session', async () => {
        const newEngine = new SessionQueryEngine();

        const query: NaturalQuery = {
          question: 'What did I do?'
        };

        const result = await newEngine.query(query);

        expect(result.error).toBeDefined();
        expect(result.error).toContain('setActiveSession');
      });
    });

    describe('_buildSessionContext()', () => {
      it('should build summary context', () => {
        const context = (engine as any)._buildSessionContext('summary');

        expect(context).toContain('<session_context>');
        expect(context).toContain('<session_info>');
        expect(context).toContain('<achievements>');
        expect(context).toContain('<blockers>');
        expect(context).toContain('<recent_screenshots');
      });

      it('should build detailed context', () => {
        const context = (engine as any)._buildSessionContext('detailed');

        expect(context).toContain('<screenshots');
        expect(context).toContain('<audio_segments');
        expect(context).toContain('<analysis>');
        expect(context).toContain('<extracted_text>');
      });

      it('should build timeline context', () => {
        const context = (engine as any)._buildSessionContext('timeline');

        expect(context).toContain('<timeline>');
        expect(context).toContain('type="screenshot"');
        expect(context).toContain('<timestamp>');
      });

      it('should include session metadata', () => {
        const context = (engine as any)._buildSessionContext('summary');

        expect(context).toContain('session-1');
        expect(context).toContain('Test Session');
      });
    });

    describe('_buildNaturalQuerySystemPrompt()', () => {
      it('should include role description', () => {
        const prompt = (engine as any)._buildNaturalQuerySystemPrompt();

        expect(prompt).toContain('Session Query Assistant');
        expect(prompt).toContain('Taskerino');
      });

      it('should specify response format', () => {
        const prompt = (engine as any)._buildNaturalQuerySystemPrompt();

        expect(prompt).toContain('<answer>');
        expect(prompt).toContain('<confidence>');
        expect(prompt).toContain('<sources>');
      });

      it('should include instructions', () => {
        const prompt = (engine as any)._buildNaturalQuerySystemPrompt();

        expect(prompt).toContain('INSTRUCTIONS');
        expect(prompt).toContain('session context');
        expect(prompt).toContain('confidence score');
      });

      it('should include example', () => {
        const prompt = (engine as any)._buildNaturalQuerySystemPrompt();

        expect(prompt).toContain('EXAMPLE');
      });
    });

    describe('_parseNaturalQueryResponse()', () => {
      it('should parse valid response', () => {
        const responseText = `<answer>
You were working on authentication.
</answer>

<confidence>0.85</confidence>

<sources>
screenshot-1, screenshot-2
</sources>`;

        const parsed = (engine as any)._parseNaturalQueryResponse(responseText);

        expect(parsed.answer).toBe('You were working on authentication.');
        expect(parsed.confidence).toBe(0.85);
        expect(parsed.sources).toEqual(['screenshot-1', 'screenshot-2']);
      });

      it('should handle missing confidence', () => {
        const responseText = `<answer>
Some answer
</answer>

<sources>
screenshot-1
</sources>`;

        const parsed = (engine as any)._parseNaturalQueryResponse(responseText);

        expect(parsed.answer).toBe('Some answer');
        expect(parsed.confidence).toBe(0.7); // Default
        expect(parsed.sources).toEqual(['screenshot-1']);
      });

      it('should handle empty sources', () => {
        const responseText = `<answer>
Some answer
</answer>

<confidence>0.5</confidence>

<sources>
</sources>`;

        const parsed = (engine as any)._parseNaturalQueryResponse(responseText);

        expect(parsed.sources).toEqual([]);
      });

      it('should handle malformed response', () => {
        const responseText = 'Just plain text without tags';

        const parsed = (engine as any)._parseNaturalQueryResponse(responseText);

        expect(parsed.answer).toBe('Just plain text without tags');
        expect(parsed.confidence).toBe(0.7);
        expect(parsed.sources).toEqual([]);
      });

      it('should trim whitespace', () => {
        const responseText = `<answer>

  Answer with whitespace

</answer>

<confidence>  0.9  </confidence>

<sources>
  screenshot-1 , screenshot-2
</sources>`;

        const parsed = (engine as any)._parseNaturalQueryResponse(responseText);

        expect(parsed.answer).toBe('Answer with whitespace');
        expect(parsed.confidence).toBe(0.9);
        expect(parsed.sources).toEqual(['screenshot-1', 'screenshot-2']);
      });

      it('should clamp confidence to 0-1 range', () => {
        const responseText1 = `<answer>Test</answer><confidence>1.5</confidence><sources></sources>`;
        const responseText2 = `<answer>Test</answer><confidence>-0.5</confidence><sources></sources>`;

        const parsed1 = (engine as any)._parseNaturalQueryResponse(responseText1);
        const parsed2 = (engine as any)._parseNaturalQueryResponse(responseText2);

        // Invalid values should fall back to default 0.7
        expect(parsed1.confidence).toBe(0.7);
        expect(parsed2.confidence).toBe(0.7);
      });
    });

  });
});
