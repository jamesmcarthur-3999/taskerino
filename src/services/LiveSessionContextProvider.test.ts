/**
 * LiveSessionContextProvider Unit Tests
 *
 * Comprehensive test suite for LiveSessionContextProvider with 85%+ coverage.
 *
 * Test Categories:
 * 1. searchScreenshots() - All filter parameters
 * 2. searchAudioSegments() - All filter parameters
 * 3. getRecentActivity() - Timeline merging and sorting
 * 4. getActivitySince() - Time filtering and chronological order
 * 5. filterByActivity() - Activity type filtering
 * 6. getProgressIndicators() - Aggregation and deduplication
 * 7. Focus filter application - All focus filter parameters
 * 8. Performance tests - <1ms for 100 items
 * 9. Edge cases - Empty arrays, null values, invalid inputs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LiveSessionContextProvider,
  type ScreenshotQuery,
  type AudioQuery,
  type SessionFocusFilter,
} from './LiveSessionContextProvider';
import type { Session, SessionScreenshot, SessionAudioSegment } from '../types';

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

/**
 * Create a mock session with configurable screenshots and audio.
 */
function createMockSession(
  screenshotCount: number = 10,
  audioCount: number = 10
): Session {
  const screenshots: SessionScreenshot[] = [];
  const audioSegments: SessionAudioSegment[] = [];

  // Create screenshots with varied data
  for (let i = 0; i < screenshotCount; i++) {
    const timestamp = new Date(2025, 10, 2, 10, i, 0).toISOString();
    screenshots.push({
      id: `screenshot-${i}`,
      sessionId: 'session-1',
      timestamp,
      attachmentId: `attachment-${i}`,
      analysisStatus: 'complete',
      aiAnalysis: {
        summary: i % 2 === 0 ? 'Working on authentication bug' : 'Reviewing code',
        detectedActivity: i % 3 === 0 ? 'coding' : i % 3 === 1 ? 'debugging' : 'reviewing',
        extractedText: i % 2 === 0 ? 'Login form with email field' : 'Code editor',
        keyElements: i % 2 === 0 ? ['Gmail', 'Login', 'Email'] : ['VS Code', 'TypeScript'],
        suggestedActions: [],
        confidence: 0.9,
        curiosity: i / screenshotCount, // 0 to 1 gradient
        curiosityReason: 'Interesting activity detected',
        progressIndicators: {
          achievements: i % 4 === 0 ? ['Fixed authentication bug'] : [],
          blockers: i % 5 === 0 ? ['Waiting on API key'] : [],
          insights: i % 6 === 0 ? ['User prefers email login'] : [],
        },
      },
    });
  }

  // Create audio segments with varied data
  for (let i = 0; i < audioCount; i++) {
    const timestamp = new Date(2025, 10, 2, 10, i, 30).toISOString();
    audioSegments.push({
      id: `audio-${i}`,
      sessionId: 'session-1',
      timestamp,
      duration: 10,
      transcription: i % 2 === 0 ? 'Found a bug in the authentication flow' : 'Making good progress',
      keyPhrases: i % 2 === 0 ? ['bug', 'authentication'] : ['progress', 'good'],
      sentiment: i % 3 === 0 ? 'negative' : i % 3 === 1 ? 'positive' : 'neutral',
      containsTask: i % 4 === 0,
      containsBlocker: i % 5 === 0,
    });
  }

  return {
    id: 'session-1',
    name: 'Test Session',
    description: 'A test session',
    status: 'active',
    startTime: new Date(2025, 10, 2, 10, 0, 0).toISOString(),
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'off',
    audioRecording: false,
    audioReviewCompleted: false,
    screenshots,
    audioSegments,
    relationships: [],
  } as Session;
}

// =============================================================================
// SEARCH SCREENSHOTS TESTS
// =============================================================================

describe('LiveSessionContextProvider - searchScreenshots', () => {
  let provider: LiveSessionContextProvider;
  let session: Session;

  beforeEach(() => {
    session = createMockSession(10, 10);
    provider = new LiveSessionContextProvider(session);
  });

  it('should return all screenshots when no filters', () => {
    const results = provider.searchScreenshots({});
    expect(results).toHaveLength(10);
  });

  it('should filter by activity (case-insensitive)', () => {
    const results = provider.searchScreenshots({ activity: 'coding' });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      expect(screenshot.aiAnalysis?.detectedActivity?.toLowerCase()).toContain('coding');
    });
  });

  it('should filter by activity (case-insensitive, uppercase)', () => {
    const results = provider.searchScreenshots({ activity: 'CODING' });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      expect(screenshot.aiAnalysis?.detectedActivity?.toLowerCase()).toContain('coding');
    });
  });

  it('should search text in extractedText', () => {
    const results = provider.searchScreenshots({ text: 'Login' });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const extractedText = screenshot.aiAnalysis?.extractedText?.toLowerCase() || '';
      const summary = screenshot.aiAnalysis?.summary?.toLowerCase() || '';
      expect(extractedText.includes('login') || summary.includes('login')).toBe(true);
    });
  });

  it('should search text in summary', () => {
    const results = provider.searchScreenshots({ text: 'authentication' });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const extractedText = screenshot.aiAnalysis?.extractedText?.toLowerCase() || '';
      const summary = screenshot.aiAnalysis?.summary?.toLowerCase() || '';
      expect(extractedText.includes('authentication') || summary.includes('authentication')).toBe(
        true
      );
    });
  });

  it('should search text (case-insensitive)', () => {
    const results = provider.searchScreenshots({ text: 'AUTHENTICATION' });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should filter by key elements', () => {
    const results = provider.searchScreenshots({ elements: ['Gmail'] });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const keyElements = screenshot.aiAnalysis?.keyElements || [];
      const hasMatch = keyElements.some((el) => el.toLowerCase().includes('gmail'));
      expect(hasMatch).toBe(true);
    });
  });

  it('should filter by key elements (case-insensitive)', () => {
    const results = provider.searchScreenshots({ elements: ['gmail'] });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should filter by multiple key elements (OR logic)', () => {
    const results = provider.searchScreenshots({ elements: ['Gmail', 'VS Code'] });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const keyElements = screenshot.aiAnalysis?.keyElements || [];
      const hasMatch = keyElements.some(
        (el) => el.toLowerCase().includes('gmail') || el.toLowerCase().includes('vs code')
      );
      expect(hasMatch).toBe(true);
    });
  });

  it('should filter by hasAchievements', () => {
    const results = provider.searchScreenshots({ hasAchievements: true });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const achievements = screenshot.aiAnalysis?.progressIndicators?.achievements || [];
      expect(achievements.length).toBeGreaterThan(0);
    });
  });

  it('should filter by hasBlockers', () => {
    const results = provider.searchScreenshots({ hasBlockers: true });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const blockers = screenshot.aiAnalysis?.progressIndicators?.blockers || [];
      expect(blockers.length).toBeGreaterThan(0);
    });
  });

  it('should filter by minCuriosity', () => {
    const results = provider.searchScreenshots({ minCuriosity: 0.5 });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const curiosity = screenshot.aiAnalysis?.curiosity || 0;
      expect(curiosity).toBeGreaterThanOrEqual(0.5);
    });
  });

  it('should filter by since timestamp', () => {
    const sinceTime = new Date(2025, 10, 2, 10, 5, 0).toISOString();
    const results = provider.searchScreenshots({ since: sinceTime });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const time = new Date(screenshot.timestamp).getTime();
      expect(time).toBeGreaterThanOrEqual(new Date(sinceTime).getTime());
    });
  });

  it('should filter by until timestamp', () => {
    const untilTime = new Date(2025, 10, 2, 10, 5, 0).toISOString();
    const results = provider.searchScreenshots({ until: untilTime });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const time = new Date(screenshot.timestamp).getTime();
      expect(time).toBeLessThanOrEqual(new Date(untilTime).getTime());
    });
  });

  it('should filter by time range (since and until)', () => {
    const sinceTime = new Date(2025, 10, 2, 10, 3, 0).toISOString();
    const untilTime = new Date(2025, 10, 2, 10, 7, 0).toISOString();
    const results = provider.searchScreenshots({ since: sinceTime, until: untilTime });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const time = new Date(screenshot.timestamp).getTime();
      expect(time).toBeGreaterThanOrEqual(new Date(sinceTime).getTime());
      expect(time).toBeLessThanOrEqual(new Date(untilTime).getTime());
    });
  });

  it('should limit results', () => {
    const results = provider.searchScreenshots({ limit: 3 });
    expect(results).toHaveLength(3);
  });

  it('should sort by timestamp (newest first)', () => {
    const results = provider.searchScreenshots({});
    for (let i = 0; i < results.length - 1; i++) {
      const time1 = new Date(results[i].timestamp).getTime();
      const time2 = new Date(results[i + 1].timestamp).getTime();
      expect(time1).toBeGreaterThanOrEqual(time2);
    }
  });

  it('should combine multiple filters (AND logic)', () => {
    const results = provider.searchScreenshots({
      activity: 'coding',
      hasAchievements: true,
      minCuriosity: 0.5,
    });
    results.forEach((screenshot) => {
      expect(screenshot.aiAnalysis?.detectedActivity?.toLowerCase()).toContain('coding');
      expect(screenshot.aiAnalysis?.progressIndicators?.achievements?.length || 0).toBeGreaterThan(
        0
      );
      expect(screenshot.aiAnalysis?.curiosity || 0).toBeGreaterThanOrEqual(0.5);
    });
  });

  it('should handle empty screenshots array', () => {
    const emptySession = createMockSession(0, 0);
    const emptyProvider = new LiveSessionContextProvider(emptySession);
    const results = emptyProvider.searchScreenshots({});
    expect(results).toHaveLength(0);
  });

  it('should handle undefined aiAnalysis', () => {
    const session = createMockSession(1, 0);
    session.screenshots[0].aiAnalysis = undefined;
    const provider = new LiveSessionContextProvider(session);
    const results = provider.searchScreenshots({ activity: 'coding' });
    expect(results).toHaveLength(0);
  });
});

// =============================================================================
// SEARCH AUDIO SEGMENTS TESTS
// =============================================================================

describe('LiveSessionContextProvider - searchAudioSegments', () => {
  let provider: LiveSessionContextProvider;
  let session: Session;

  beforeEach(() => {
    session = createMockSession(10, 10);
    provider = new LiveSessionContextProvider(session);
  });

  it('should return all audio segments when no filters', () => {
    const results = provider.searchAudioSegments({});
    expect(results).toHaveLength(10);
  });

  it('should search text in transcription', () => {
    const results = provider.searchAudioSegments({ text: 'bug' });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((segment) => {
      expect(segment.transcription.toLowerCase()).toContain('bug');
    });
  });

  it('should search text (case-insensitive)', () => {
    const results = provider.searchAudioSegments({ text: 'BUG' });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should filter by key phrases', () => {
    const results = provider.searchAudioSegments({ phrases: ['authentication'] });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((segment) => {
      const keyPhrases = segment.keyPhrases || [];
      const hasMatch = keyPhrases.some((phrase) => phrase.toLowerCase().includes('authentication'));
      expect(hasMatch).toBe(true);
    });
  });

  it('should filter by key phrases (case-insensitive)', () => {
    const results = provider.searchAudioSegments({ phrases: ['AUTHENTICATION'] });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should filter by multiple phrases (OR logic)', () => {
    const results = provider.searchAudioSegments({ phrases: ['bug', 'progress'] });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should filter by sentiment (positive)', () => {
    const results = provider.searchAudioSegments({ sentiment: 'positive' });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((segment) => {
      expect(segment.sentiment).toBe('positive');
    });
  });

  it('should filter by sentiment (negative)', () => {
    const results = provider.searchAudioSegments({ sentiment: 'negative' });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((segment) => {
      expect(segment.sentiment).toBe('negative');
    });
  });

  it('should filter by sentiment (neutral)', () => {
    const results = provider.searchAudioSegments({ sentiment: 'neutral' });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((segment) => {
      expect(segment.sentiment).toBe('neutral');
    });
  });

  it('should filter by containsTask (true)', () => {
    const results = provider.searchAudioSegments({ containsTask: true });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((segment) => {
      expect(segment.containsTask).toBe(true);
    });
  });

  it('should filter by containsTask (false)', () => {
    const results = provider.searchAudioSegments({ containsTask: false });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((segment) => {
      expect(segment.containsTask).toBe(false);
    });
  });

  it('should filter by containsBlocker (true)', () => {
    const results = provider.searchAudioSegments({ containsBlocker: true });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((segment) => {
      expect(segment.containsBlocker).toBe(true);
    });
  });

  it('should filter by containsBlocker (false)', () => {
    const results = provider.searchAudioSegments({ containsBlocker: false });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((segment) => {
      expect(segment.containsBlocker).toBe(false);
    });
  });

  it('should filter by since timestamp', () => {
    const sinceTime = new Date(2025, 10, 2, 10, 5, 30).toISOString();
    const results = provider.searchAudioSegments({ since: sinceTime });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((segment) => {
      const time = new Date(segment.timestamp).getTime();
      expect(time).toBeGreaterThanOrEqual(new Date(sinceTime).getTime());
    });
  });

  it('should filter by until timestamp', () => {
    const untilTime = new Date(2025, 10, 2, 10, 5, 30).toISOString();
    const results = provider.searchAudioSegments({ until: untilTime });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((segment) => {
      const time = new Date(segment.timestamp).getTime();
      expect(time).toBeLessThanOrEqual(new Date(untilTime).getTime());
    });
  });

  it('should limit results', () => {
    const results = provider.searchAudioSegments({ limit: 3 });
    expect(results).toHaveLength(3);
  });

  it('should sort by timestamp (newest first)', () => {
    const results = provider.searchAudioSegments({});
    for (let i = 0; i < results.length - 1; i++) {
      const time1 = new Date(results[i].timestamp).getTime();
      const time2 = new Date(results[i + 1].timestamp).getTime();
      expect(time1).toBeGreaterThanOrEqual(time2);
    }
  });

  it('should combine multiple filters (AND logic)', () => {
    const results = provider.searchAudioSegments({
      sentiment: 'negative',
      containsBlocker: true,
    });
    results.forEach((segment) => {
      expect(segment.sentiment).toBe('negative');
      expect(segment.containsBlocker).toBe(true);
    });
  });

  it('should handle empty audio segments array', () => {
    const emptySession = createMockSession(0, 0);
    const emptyProvider = new LiveSessionContextProvider(emptySession);
    const results = emptyProvider.searchAudioSegments({});
    expect(results).toHaveLength(0);
  });

  it('should handle undefined keyPhrases', () => {
    const session = createMockSession(0, 1);
    session.audioSegments![0].keyPhrases = undefined;
    const provider = new LiveSessionContextProvider(session);
    const results = provider.searchAudioSegments({ phrases: ['test'] });
    expect(results).toHaveLength(0);
  });
});

// =============================================================================
// RECENT ACTIVITY TESTS
// =============================================================================

describe('LiveSessionContextProvider - getRecentActivity', () => {
  let provider: LiveSessionContextProvider;
  let session: Session;

  beforeEach(() => {
    session = createMockSession(10, 10);
    provider = new LiveSessionContextProvider(session);
  });

  it('should merge screenshots and audio segments', () => {
    const results = provider.getRecentActivity(20);
    expect(results).toHaveLength(20);

    const screenshotCount = results.filter((item) => item.type === 'screenshot').length;
    const audioCount = results.filter((item) => item.type === 'audio').length;
    expect(screenshotCount).toBe(10);
    expect(audioCount).toBe(10);
  });

  it('should sort by timestamp (newest first)', () => {
    const results = provider.getRecentActivity(20);
    for (let i = 0; i < results.length - 1; i++) {
      const time1 = new Date(results[i].timestamp).getTime();
      const time2 = new Date(results[i + 1].timestamp).getTime();
      expect(time1).toBeGreaterThanOrEqual(time2);
    }
  });

  it('should limit results', () => {
    const results = provider.getRecentActivity(5);
    expect(results).toHaveLength(5);
  });

  it('should handle empty session', () => {
    const emptySession = createMockSession(0, 0);
    const emptyProvider = new LiveSessionContextProvider(emptySession);
    const results = emptyProvider.getRecentActivity(10);
    expect(results).toHaveLength(0);
  });

  it('should handle session with only screenshots', () => {
    const session = createMockSession(5, 0);
    const provider = new LiveSessionContextProvider(session);
    const results = provider.getRecentActivity(10);
    expect(results).toHaveLength(5);
    results.forEach((item) => {
      expect(item.type).toBe('screenshot');
    });
  });

  it('should handle session with only audio', () => {
    const session = createMockSession(0, 5);
    const provider = new LiveSessionContextProvider(session);
    const results = provider.getRecentActivity(10);
    expect(results).toHaveLength(5);
    results.forEach((item) => {
      expect(item.type).toBe('audio');
    });
  });
});

// =============================================================================
// ACTIVITY SINCE TESTS
// =============================================================================

describe('LiveSessionContextProvider - getActivitySince', () => {
  let provider: LiveSessionContextProvider;
  let session: Session;

  beforeEach(() => {
    session = createMockSession(10, 10);
    provider = new LiveSessionContextProvider(session);
  });

  it('should filter by timestamp', () => {
    const sinceTime = new Date(2025, 10, 2, 10, 5, 0).toISOString();
    const results = provider.getActivitySince(sinceTime);
    expect(results.length).toBeGreaterThan(0);
    results.forEach((item) => {
      const time = new Date(item.timestamp).getTime();
      expect(time).toBeGreaterThanOrEqual(new Date(sinceTime).getTime());
    });
  });

  it('should sort by timestamp (oldest first)', () => {
    const sinceTime = new Date(2025, 10, 2, 10, 0, 0).toISOString();
    const results = provider.getActivitySince(sinceTime);
    for (let i = 0; i < results.length - 1; i++) {
      const time1 = new Date(results[i].timestamp).getTime();
      const time2 = new Date(results[i + 1].timestamp).getTime();
      expect(time1).toBeLessThanOrEqual(time2);
    }
  });

  it('should include both screenshots and audio', () => {
    const sinceTime = new Date(2025, 10, 2, 10, 0, 0).toISOString();
    const results = provider.getActivitySince(sinceTime);
    const screenshotCount = results.filter((item) => item.type === 'screenshot').length;
    const audioCount = results.filter((item) => item.type === 'audio').length;
    expect(screenshotCount).toBeGreaterThan(0);
    expect(audioCount).toBeGreaterThan(0);
  });

  it('should return empty array if no activity since timestamp', () => {
    const futureTime = new Date(2025, 10, 2, 11, 0, 0).toISOString();
    const results = provider.getActivitySince(futureTime);
    expect(results).toHaveLength(0);
  });
});

// =============================================================================
// FILTER BY ACTIVITY TESTS
// =============================================================================

describe('LiveSessionContextProvider - filterByActivity', () => {
  let provider: LiveSessionContextProvider;
  let session: Session;

  beforeEach(() => {
    session = createMockSession(10, 10);
    provider = new LiveSessionContextProvider(session);
  });

  it('should filter screenshots by activity', () => {
    const results = provider.filterByActivity('coding');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((item) => {
      expect(item.type).toBe('screenshot');
      const screenshot = item.data as SessionScreenshot;
      expect(screenshot.aiAnalysis?.detectedActivity?.toLowerCase()).toContain('coding');
    });
  });

  it('should filter by activity (case-insensitive)', () => {
    const results = provider.filterByActivity('CODING');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should sort by timestamp (newest first)', () => {
    const results = provider.filterByActivity('coding');
    for (let i = 0; i < results.length - 1; i++) {
      const time1 = new Date(results[i].timestamp).getTime();
      const time2 = new Date(results[i + 1].timestamp).getTime();
      expect(time1).toBeGreaterThanOrEqual(time2);
    }
  });

  it('should return empty array if no matching activity', () => {
    const results = provider.filterByActivity('nonexistent');
    expect(results).toHaveLength(0);
  });
});

// =============================================================================
// PROGRESS INDICATORS TESTS
// =============================================================================

describe('LiveSessionContextProvider - getProgressIndicators', () => {
  let provider: LiveSessionContextProvider;
  let session: Session;

  beforeEach(() => {
    session = createMockSession(10, 10);
    provider = new LiveSessionContextProvider(session);
  });

  it('should aggregate all progress indicators', () => {
    const summary = provider.getProgressIndicators();
    expect(summary.achievements.length).toBeGreaterThan(0);
    expect(summary.blockers.length).toBeGreaterThan(0);
    expect(summary.insights.length).toBeGreaterThan(0);
  });

  it('should deduplicate achievements', () => {
    const summary = provider.getProgressIndicators();
    const uniqueAchievements = new Set(summary.achievements);
    expect(summary.achievements.length).toBe(uniqueAchievements.size);
  });

  it('should deduplicate blockers', () => {
    const summary = provider.getProgressIndicators();
    const uniqueBlockers = new Set(summary.blockers);
    expect(summary.blockers.length).toBe(uniqueBlockers.size);
  });

  it('should deduplicate insights', () => {
    const summary = provider.getProgressIndicators();
    const uniqueInsights = new Set(summary.insights);
    expect(summary.insights.length).toBe(uniqueInsights.size);
  });

  it('should filter by since timestamp', () => {
    const sinceTime = new Date(2025, 10, 2, 10, 5, 0).toISOString();
    const allSummary = provider.getProgressIndicators();
    const sinceSummary = provider.getProgressIndicators(sinceTime);

    // Since summary should have fewer or equal items
    expect(sinceSummary.achievements.length).toBeLessThanOrEqual(allSummary.achievements.length);
    expect(sinceSummary.blockers.length).toBeLessThanOrEqual(allSummary.blockers.length);
    expect(sinceSummary.insights.length).toBeLessThanOrEqual(allSummary.insights.length);
  });

  it('should return empty arrays for session with no progress indicators', () => {
    const session = createMockSession(1, 0);
    session.screenshots[0].aiAnalysis!.progressIndicators = undefined;
    const provider = new LiveSessionContextProvider(session);
    const summary = provider.getProgressIndicators();

    expect(summary.achievements).toHaveLength(0);
    expect(summary.blockers).toHaveLength(0);
    expect(summary.insights).toHaveLength(0);
  });
});

// =============================================================================
// FOCUS FILTER TESTS
// =============================================================================

describe('LiveSessionContextProvider - Focus Filter', () => {
  let session: Session;

  beforeEach(() => {
    session = createMockSession(10, 10);
  });

  it('should apply focus filter - activities (include)', () => {
    const focusFilter: SessionFocusFilter = {
      activities: ['coding'],
    };
    const provider = new LiveSessionContextProvider(session, focusFilter);
    const results = provider.searchScreenshots({});

    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const activity = screenshot.aiAnalysis?.detectedActivity?.toLowerCase() || '';
      expect(activity).toContain('coding');
    });
  });

  it('should apply focus filter - activities (exclude)', () => {
    const focusFilter: SessionFocusFilter = {
      excludeActivities: ['coding'],
    };
    const provider = new LiveSessionContextProvider(session, focusFilter);
    const results = provider.searchScreenshots({});

    results.forEach((screenshot) => {
      const activity = screenshot.aiAnalysis?.detectedActivity?.toLowerCase() || '';
      expect(activity).not.toContain('coding');
    });
  });

  it('should apply focus filter - keywords', () => {
    const focusFilter: SessionFocusFilter = {
      keywords: ['authentication'],
    };
    const provider = new LiveSessionContextProvider(session, focusFilter);
    const results = provider.searchScreenshots({});

    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const extractedText = screenshot.aiAnalysis?.extractedText?.toLowerCase() || '';
      const summary = screenshot.aiAnalysis?.summary?.toLowerCase() || '';
      const keyElements = screenshot.aiAnalysis?.keyElements?.join(' ').toLowerCase() || '';
      const hasKeyword =
        extractedText.includes('authentication') ||
        summary.includes('authentication') ||
        keyElements.includes('authentication');
      expect(hasKeyword).toBe(true);
    });
  });

  it('should apply focus filter - minCuriosity', () => {
    const focusFilter: SessionFocusFilter = {
      minCuriosity: 0.5,
    };
    const provider = new LiveSessionContextProvider(session, focusFilter);
    const results = provider.searchScreenshots({});

    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const curiosity = screenshot.aiAnalysis?.curiosity || 0;
      expect(curiosity).toBeGreaterThanOrEqual(0.5);
    });
  });

  it('should apply focus filter - hasAchievements', () => {
    const focusFilter: SessionFocusFilter = {
      hasAchievements: true,
    };
    const provider = new LiveSessionContextProvider(session, focusFilter);
    const results = provider.searchScreenshots({});

    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const achievements = screenshot.aiAnalysis?.progressIndicators?.achievements || [];
      expect(achievements.length).toBeGreaterThan(0);
    });
  });

  it('should apply focus filter - hasBlockers', () => {
    const focusFilter: SessionFocusFilter = {
      hasBlockers: true,
    };
    const provider = new LiveSessionContextProvider(session, focusFilter);
    const results = provider.searchScreenshots({});

    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const blockers = screenshot.aiAnalysis?.progressIndicators?.blockers || [];
      expect(blockers.length).toBeGreaterThan(0);
    });
  });

  it('should apply focus filter - time range (since)', () => {
    const focusFilter: SessionFocusFilter = {
      since: new Date(2025, 10, 2, 10, 5, 0).toISOString(),
    };
    const provider = new LiveSessionContextProvider(session, focusFilter);
    const results = provider.searchScreenshots({});

    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const time = new Date(screenshot.timestamp).getTime();
      expect(time).toBeGreaterThanOrEqual(new Date(focusFilter.since!).getTime());
    });
  });

  it('should apply focus filter - time range (until)', () => {
    const focusFilter: SessionFocusFilter = {
      until: new Date(2025, 10, 2, 10, 5, 0).toISOString(),
    };
    const provider = new LiveSessionContextProvider(session, focusFilter);
    const results = provider.searchScreenshots({});

    expect(results.length).toBeGreaterThan(0);
    results.forEach((screenshot) => {
      const time = new Date(screenshot.timestamp).getTime();
      expect(time).toBeLessThanOrEqual(new Date(focusFilter.until!).getTime());
    });
  });

  it('should apply focus filter to audio segments - keywords', () => {
    const focusFilter: SessionFocusFilter = {
      keywords: ['bug'],
    };
    const provider = new LiveSessionContextProvider(session, focusFilter);
    const results = provider.searchAudioSegments({});

    expect(results.length).toBeGreaterThan(0);
    results.forEach((segment) => {
      const transcription = segment.transcription?.toLowerCase() || '';
      const keyPhrases = segment.keyPhrases?.join(' ').toLowerCase() || '';
      expect(transcription.includes('bug') || keyPhrases.includes('bug')).toBe(true);
    });
  });

  it('should apply focus filter to recent activity', () => {
    const focusFilter: SessionFocusFilter = {
      activities: ['coding'],
    };
    const provider = new LiveSessionContextProvider(session, focusFilter);
    const results = provider.getRecentActivity(20);

    const screenshots = results.filter((item) => item.type === 'screenshot');
    screenshots.forEach((item) => {
      const screenshot = item.data as SessionScreenshot;
      const activity = screenshot.aiAnalysis?.detectedActivity?.toLowerCase() || '';
      expect(activity).toContain('coding');
    });
  });

  it('should apply focus filter to progress indicators', () => {
    const focusFilter: SessionFocusFilter = {
      hasAchievements: true,
    };
    const provider = new LiveSessionContextProvider(session, focusFilter);
    const summary = provider.getProgressIndicators();

    expect(summary.achievements.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// PERFORMANCE TESTS
// =============================================================================

describe('LiveSessionContextProvider - Performance', () => {
  it('should process 100 screenshots in <1ms', () => {
    const session = createMockSession(100, 0);
    const provider = new LiveSessionContextProvider(session);

    const start = performance.now();
    provider.searchScreenshots({ activity: 'coding', hasBlockers: true, minCuriosity: 0.5 });
    const end = performance.now();

    const duration = end - start;
    expect(duration).toBeLessThan(1);
  });

  it('should process 100 audio segments in <1ms', () => {
    const session = createMockSession(0, 100);
    const provider = new LiveSessionContextProvider(session);

    const start = performance.now();
    provider.searchAudioSegments({ sentiment: 'negative', containsBlocker: true });
    const end = performance.now();

    const duration = end - start;
    expect(duration).toBeLessThan(1);
  });

  it('should merge 200 items (100 screenshots + 100 audio) in <1ms', () => {
    const session = createMockSession(100, 100);
    const provider = new LiveSessionContextProvider(session);

    const start = performance.now();
    provider.getRecentActivity(200);
    const end = performance.now();

    const duration = end - start;
    expect(duration).toBeLessThan(1);
  });

  it('should aggregate progress indicators from 100 screenshots in <1ms', () => {
    const session = createMockSession(100, 0);
    const provider = new LiveSessionContextProvider(session);

    const start = performance.now();
    provider.getProgressIndicators();
    const end = performance.now();

    const duration = end - start;
    expect(duration).toBeLessThan(1);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('LiveSessionContextProvider - Edge Cases', () => {
  it('should handle session with no screenshots or audio', () => {
    const session = createMockSession(0, 0);
    const provider = new LiveSessionContextProvider(session);

    expect(provider.searchScreenshots({})).toHaveLength(0);
    expect(provider.searchAudioSegments({})).toHaveLength(0);
    expect(provider.getRecentActivity(10)).toHaveLength(0);
    expect(provider.getActivitySince(new Date().toISOString())).toHaveLength(0);
    expect(provider.filterByActivity('coding')).toHaveLength(0);

    const summary = provider.getProgressIndicators();
    expect(summary.achievements).toHaveLength(0);
    expect(summary.blockers).toHaveLength(0);
    expect(summary.insights).toHaveLength(0);
  });

  it('should handle screenshot with no aiAnalysis', () => {
    const session = createMockSession(1, 0);
    session.screenshots[0].aiAnalysis = undefined;
    const provider = new LiveSessionContextProvider(session);

    const results = provider.searchScreenshots({ activity: 'coding' });
    expect(results).toHaveLength(0);
  });

  it('should handle audio segment with no keyPhrases', () => {
    const session = createMockSession(0, 1);
    session.audioSegments![0].keyPhrases = undefined;
    const provider = new LiveSessionContextProvider(session);

    const results = provider.searchAudioSegments({ phrases: ['test'] });
    expect(results).toHaveLength(0);
  });

  it('should handle screenshot with no progressIndicators', () => {
    const session = createMockSession(1, 0);
    session.screenshots[0].aiAnalysis!.progressIndicators = undefined;
    const provider = new LiveSessionContextProvider(session);

    const results = provider.searchScreenshots({ hasAchievements: true });
    expect(results).toHaveLength(0);
  });

  it('should handle limit of 0', () => {
    const session = createMockSession(10, 10);
    const provider = new LiveSessionContextProvider(session);

    const results = provider.searchScreenshots({ limit: 0 });
    expect(results).toHaveLength(10); // Limit of 0 is ignored
  });

  it('should handle negative limit', () => {
    const session = createMockSession(10, 10);
    const provider = new LiveSessionContextProvider(session);

    const results = provider.searchScreenshots({ limit: -1 });
    expect(results).toHaveLength(10); // Negative limit is ignored
  });
});
