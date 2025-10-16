/**
 * Key Moments Detection Service
 *
 * Analyzes session audio to detect and mark important moments:
 * - Volume spikes (sudden loud sounds)
 * - Questions (voice pitch + interrogative words)
 * - Eureka moments (excitement + positive words)
 * - Frustration (repeated attempts + negative words)
 * - Activity changes (context switches)
 */

import type { Session, SessionAudioSegment, AudioKeyMoment, SessionScreenshot } from '../types';
import { audioConcatenationService } from './audioConcatenationService';
import { generateId } from '../utils/helpers';

interface DetectionConfig {
  volumeSpikeThreshold: number; // Multiplier of average volume
  minTimeBetweenMoments: number; // Seconds between same-type moments
  enableQuestionDetection: boolean;
  enableEurekaDetection: boolean;
  enableFrustrationDetection: boolean;
  enableActivityChangeDetection: boolean;
}

const DEFAULT_CONFIG: DetectionConfig = {
  volumeSpikeThreshold: 1.5,
  minTimeBetweenMoments: 30, // 30 seconds
  enableQuestionDetection: true,
  enableEurekaDetection: true,
  enableFrustrationDetection: true,
  enableActivityChangeDetection: true,
};

export class KeyMomentsDetectionService {
  // Session-based key moments cache: sessionId -> { moments, timestamp }
  private keyMomentsCache: Map<string, { moments: AudioKeyMoment[]; timestamp: number }> = new Map();

  /**
   * Detect all key moments in a session (with session-based caching)
   */
  async detectKeyMoments(
    session: Session,
    config: Partial<DetectionConfig> = {}
  ): Promise<AudioKeyMoment[]> {
    // Check cache first
    const cached = this.keyMomentsCache.get(session.id);
    if (cached) {
      console.log(`✅ [KEY MOMENTS] Using cached key moments for session ${session.id} (${cached.moments.length} moments)`);
      return cached.moments;
    }
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    const segments = session.audioSegments || [];
    const screenshots = session.screenshots || [];

    if (segments.length === 0) {
      console.log('ℹ️  [KEY MOMENTS] No audio segments to analyze');
      return [];
    }

    console.log(`🔍 [KEY MOMENTS] Analyzing ${segments.length} segments...`);

    const moments: AudioKeyMoment[] = [];

    // Detect different types of moments
    if (fullConfig.enableQuestionDetection) {
      moments.push(...await this.detectQuestions(segments));
    }

    if (fullConfig.enableEurekaDetection) {
      moments.push(...await this.detectEurekaMoments(segments));
    }

    if (fullConfig.enableFrustrationDetection) {
      moments.push(...await this.detectFrustration(segments));
    }

    if (fullConfig.enableActivityChangeDetection) {
      moments.push(...await this.detectActivityChanges(segments, screenshots));
    }

    // Sort by timestamp and deduplicate
    const sortedMoments = moments.sort((a, b) => a.timestamp - b.timestamp);
    const dedupedMoments = this.deduplicateMoments(sortedMoments, fullConfig.minTimeBetweenMoments);

    console.log(`✅ [KEY MOMENTS] Detected ${dedupedMoments.length} key moments`);

    // Cache the result
    this.keyMomentsCache.set(session.id, {
      moments: dedupedMoments,
      timestamp: Date.now(),
    });
    console.log(`💾 [KEY MOMENTS] Cached key moments for session ${session.id}`);

    return dedupedMoments;
  }

  /**
   * Detect questions in audio
   * Looks for interrogative words and question marks
   */
  private async detectQuestions(segments: SessionAudioSegment[]): Promise<AudioKeyMoment[]> {
    const moments: AudioKeyMoment[] = [];

    // Question patterns
    const questionPatterns = [
      /^(how|what|why|when|where|who|which|whose)/i,
      /\?$/,
      /(can|could|would|should|will|do|does|did|is|are|was|were)\s+(I|we|you|they|he|she|it)/i,
    ];

    for (const segment of segments) {
      const text = segment.transcription.toLowerCase();

      // Check if text matches question patterns
      const isQuestion = questionPatterns.some(pattern => pattern.test(segment.transcription));

      if (isQuestion) {
        const sessionTime = audioConcatenationService.segmentTimeToSessionTime(segment.id, 0);

        moments.push({
          id: generateId(),
          timestamp: sessionTime,
          label: 'Question asked',
          type: 'insight',
          segmentId: segment.id,
          excerpt: segment.transcription.substring(0, 100),
        });
      }
    }

    console.log(`❓ [KEY MOMENTS] Found ${moments.length} questions`);
    return moments;
  }

  /**
   * Detect eureka moments (excitement + positive words)
   */
  private async detectEurekaMoments(segments: SessionAudioSegment[]): Promise<AudioKeyMoment[]> {
    const moments: AudioKeyMoment[] = [];

    // Positive/excitement words
    const positiveWords = [
      'yes', 'great', 'perfect', 'works', 'fixed', 'solved', 'done', 'success',
      'finally', 'awesome', 'excellent', 'got it', 'figured', 'working', 'completed',
      'breakthrough', 'ah ha', 'aha', 'found it', 'that\'s it'
    ];

    for (const segment of segments) {
      const text = segment.transcription.toLowerCase();

      // Count positive words
      const positiveCount = positiveWords.filter(word => text.includes(word)).length;

      // Detect excitement (multiple positive words or strong indicators)
      if (positiveCount >= 2 || text.match(/(yes!|great!|perfect!|got it!|finally!|that's it!)/i)) {
        const sessionTime = audioConcatenationService.segmentTimeToSessionTime(segment.id, 0);

        moments.push({
          id: generateId(),
          timestamp: sessionTime,
          label: 'Eureka moment',
          type: 'achievement',
          segmentId: segment.id,
          excerpt: segment.transcription.substring(0, 100),
        });
      }
    }

    console.log(`🎉 [KEY MOMENTS] Found ${moments.length} eureka moments`);
    return moments;
  }

  /**
   * Detect frustration (negative words + repetition)
   */
  private async detectFrustration(segments: SessionAudioSegment[]): Promise<AudioKeyMoment[]> {
    const moments: AudioKeyMoment[] = [];

    // Frustration indicators
    const frustrationWords = [
      'damn', 'ugh', 'argh', 'frustrated', 'again', 'why', 'failed', 'broken',
      'doesn\'t work', 'not working', 'error', 'bug', 'issue', 'problem',
      'stuck', 'confused', 'wrong', 'still', 'same'
    ];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const text = segment.transcription.toLowerCase();

      // Count frustration words
      const frustrationCount = frustrationWords.filter(word => text.includes(word)).length;

      // Check for repetition (same words in previous segment)
      let hasRepetition = false;
      if (i > 0) {
        const prevText = segments[i - 1].transcription.toLowerCase();
        const currentWords = text.split(' ');
        const prevWords = prevText.split(' ');
        const overlap = currentWords.filter(word => prevWords.includes(word) && word.length > 3);
        hasRepetition = overlap.length > 3; // Significant overlap
      }

      // Detect frustration
      if (frustrationCount >= 2 || (frustrationCount >= 1 && hasRepetition)) {
        const sessionTime = audioConcatenationService.segmentTimeToSessionTime(segment.id, 0);

        moments.push({
          id: generateId(),
          timestamp: sessionTime,
          label: 'Frustration detected',
          type: 'blocker',
          segmentId: segment.id,
          excerpt: segment.transcription.substring(0, 100),
        });
      }
    }

    console.log(`😤 [KEY MOMENTS] Found ${moments.length} frustration moments`);
    return moments;
  }

  /**
   * Detect significant activity changes
   * Correlates with screenshot analysis
   */
  private async detectActivityChanges(
    segments: SessionAudioSegment[],
    screenshots: SessionScreenshot[]
  ): Promise<AudioKeyMoment[]> {
    const moments: AudioKeyMoment[] = [];

    if (screenshots.length === 0) {
      return moments;
    }

    // Group screenshots by activity
    let lastActivity: string | null = null;
    let lastActivityTime = 0;
    const MIN_ACTIVITY_DURATION = 5 * 60; // 5 minutes

    for (const screenshot of screenshots) {
      if (!screenshot.aiAnalysis?.detectedActivity) continue;

      const currentActivity = screenshot.aiAnalysis.detectedActivity;
      const screenshotTime = (new Date(screenshot.timestamp).getTime() - new Date(screenshots[0].timestamp).getTime()) / 1000;

      if (lastActivity && currentActivity !== lastActivity) {
        const timeSinceLastChange = screenshotTime - lastActivityTime;

        // Significant activity change (lasted at least 5 minutes)
        if (timeSinceLastChange >= MIN_ACTIVITY_DURATION) {
          // Find closest audio segment
          const closestSegment = segments.reduce((closest, segment) => {
            const segmentTime = audioConcatenationService.segmentTimeToSessionTime(segment.id, 0);
            const closestTime = audioConcatenationService.segmentTimeToSessionTime(closest.id, 0);

            return Math.abs(segmentTime - screenshotTime) < Math.abs(closestTime - screenshotTime)
              ? segment
              : closest;
          }, segments[0]);

          if (closestSegment) {
            moments.push({
              id: generateId(),
              timestamp: screenshotTime,
              label: `Activity change: ${lastActivity} → ${currentActivity}`,
              type: 'decision',
              segmentId: closestSegment.id,
              excerpt: closestSegment.transcription.substring(0, 100),
            });
          }
        }

        lastActivity = currentActivity;
        lastActivityTime = screenshotTime;
      } else if (!lastActivity) {
        lastActivity = currentActivity;
        lastActivityTime = screenshotTime;
      }
    }

    console.log(`🔄 [KEY MOMENTS] Found ${moments.length} activity changes`);
    return moments;
  }

  /**
   * Deduplicate moments that are too close together
   */
  private deduplicateMoments(moments: AudioKeyMoment[], minTimeBetween: number): AudioKeyMoment[] {
    const deduplicated: AudioKeyMoment[] = [];
    const lastByType: Record<string, number> = {};

    for (const moment of moments) {
      const lastTime = lastByType[moment.type] || -Infinity;

      if (moment.timestamp - lastTime >= minTimeBetween) {
        deduplicated.push(moment);
        lastByType[moment.type] = moment.timestamp;
      }
    }

    return deduplicated;
  }

  /**
   * Clear cached key moments
   * @param sessionId - Optional session ID to clear only that session's cache
   */
  clearCache(sessionId?: string): void {
    if (sessionId) {
      this.keyMomentsCache.delete(sessionId);
      console.log(`🗑️  [KEY MOMENTS] Cleared cache for session ${sessionId}`);
    } else {
      this.keyMomentsCache.clear();
      console.log('🗑️  [KEY MOMENTS] Cleared all cached key moments');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { sessionsCached: number } {
    return {
      sessionsCached: this.keyMomentsCache.size,
    };
  }

  /**
   * Get summary statistics for key moments
   */
  getStatistics(moments: AudioKeyMoment[]): {
    total: number;
    byType: Record<string, number>;
    averageTimeBetween: number;
  } {
    const byType: Record<string, number> = {
      achievement: 0,
      blocker: 0,
      decision: 0,
      insight: 0,
    };

    moments.forEach(moment => {
      byType[moment.type] = (byType[moment.type] || 0) + 1;
    });

    // Calculate average time between moments
    let totalTime = 0;
    for (let i = 1; i < moments.length; i++) {
      totalTime += moments[i].timestamp - moments[i - 1].timestamp;
    }
    const averageTimeBetween = moments.length > 1 ? totalTime / (moments.length - 1) : 0;

    return {
      total: moments.length,
      byType,
      averageTimeBetween,
    };
  }

  /**
   * Export key moments as JSON
   */
  exportAsJSON(session: Session, moments: AudioKeyMoment[]): string {
    const data = {
      session: {
        id: session.id,
        name: session.name,
        startTime: session.startTime,
        endTime: session.endTime,
      },
      keyMoments: moments.map(moment => ({
        timestamp: moment.timestamp,
        timeString: this.formatTime(moment.timestamp),
        type: moment.type,
        label: moment.label,
        excerpt: moment.excerpt,
      })),
      statistics: this.getStatistics(moments),
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Format time for display
   */
  private formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// Export singleton instance
export const keyMomentsDetectionService = new KeyMomentsDetectionService();
