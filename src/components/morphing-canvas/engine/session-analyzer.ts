/**
 * Session Data Analyzer
 *
 * This module provides functions to analyze session data and extract
 * characteristics used for layout selection.
 */

import type { SessionData } from '../types';
import type { SessionCharacteristics } from '../types/engine';

/**
 * Analyze session data to extract characteristics
 *
 * This function examines the session data and extracts relevant
 * characteristics used for layout selection.
 *
 * @param sessionData - Session data to analyze
 * @returns Session characteristics
 */
export function analyzeSessionData(sessionData: SessionData): SessionCharacteristics {
  // Check if characteristics are already present in sessionData (for testing)
  // Check if any of the characteristic boolean flags exist
  const hasCharacteristics =
    ('hasCodeChanges' in sessionData && typeof sessionData.hasCodeChanges === 'boolean') ||
    ('hasVideoContent' in sessionData && typeof sessionData.hasVideoContent === 'boolean') ||
    ('hasAudioContent' in sessionData && typeof sessionData.hasAudioContent === 'boolean') ||
    ('hasScreenshots' in sessionData && typeof sessionData.hasScreenshots === 'boolean') ||
    ('hasDecisions' in sessionData && typeof sessionData.hasDecisions === 'boolean') ||
    ('hasNotes' in sessionData && typeof sessionData.hasNotes === 'boolean') ||
    ('hasTasks' in sessionData && typeof sessionData.hasTasks === 'boolean');

  if (hasCharacteristics) {
    // SessionData already contains characteristics - extract them
    const characteristics: SessionCharacteristics = {
      hasCodeChanges: sessionData.hasCodeChanges as boolean || false,
      codeChangeCount: (sessionData.codeChangeCount as number) || 0,
      hasVideoContent: (sessionData.hasVideoContent as boolean) || false,
      videoChapterCount: (sessionData.videoChapterCount as number) || 0,
      hasAudioContent: (sessionData.hasAudioContent as boolean) || false,
      audioSegmentCount: (sessionData.audioSegmentCount as number) || 0,
      hasScreenshots: (sessionData.hasScreenshots as boolean) || false,
      screenshotCount: (sessionData.screenshotCount as number) || 0,
      hasDecisions: (sessionData.hasDecisions as boolean) || false,
      decisionCount: (sessionData.decisionCount as number) || 0,
      hasNotes: (sessionData.hasNotes as boolean) || false,
      noteCount: (sessionData.noteCount as number) || 0,
      hasTasks: (sessionData.hasTasks as boolean) || false,
      taskCount: (sessionData.taskCount as number) || 0,
      duration: (sessionData.duration as number) || 0,
      participantCount: (sessionData.participantCount as number) || 1,
    };

    // Calculate derived properties
    const contentTypes: Array<'code' | 'media' | 'discussion' | 'visual'> = [];
    if (characteristics.hasCodeChanges) contentTypes.push('code');
    if (characteristics.hasVideoContent || characteristics.hasAudioContent) {
      contentTypes.push('media');
    }
    if (characteristics.hasDecisions) contentTypes.push('discussion');
    if (characteristics.hasScreenshots) contentTypes.push('visual');

    // Determine primary type
    if (contentTypes.length === 1) {
      characteristics.primaryContentType = contentTypes[0];
    } else if (contentTypes.length === 0) {
      characteristics.primaryContentType = 'mixed';
    } else {
      const codeRatio = characteristics.codeChangeCount / Math.max(1, characteristics.screenshotCount);
      const mediaRatio = (characteristics.videoChapterCount + characteristics.audioSegmentCount) / Math.max(1, characteristics.duration);

      if (codeRatio > 0.5) {
        characteristics.primaryContentType = 'code';
      } else if (mediaRatio > 0.2) {
        characteristics.primaryContentType = 'media';
      } else if (characteristics.hasDecisions && characteristics.decisionCount > 3) {
        characteristics.primaryContentType = 'discussion';
      } else if (characteristics.screenshotCount > 10) {
        characteristics.primaryContentType = 'visual';
      } else {
        characteristics.primaryContentType = 'mixed';
      }
    }

    // Determine intensity
    const totalContent =
      characteristics.codeChangeCount +
      characteristics.videoChapterCount +
      characteristics.audioSegmentCount +
      characteristics.screenshotCount +
      characteristics.decisionCount +
      characteristics.noteCount +
      characteristics.taskCount;

    if (totalContent < 10) {
      characteristics.intensity = 'light';
    } else if (totalContent < 50) {
      characteristics.intensity = 'moderate';
    } else {
      characteristics.intensity = 'heavy';
    }

    return characteristics;
  }

  // Initialize characteristics object with default values
  const characteristics: SessionCharacteristics = {
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
  };

  // Extract duration from session data
  if (sessionData.startTime && sessionData.endTime) {
    const startMs = new Date(sessionData.startTime as string).getTime();
    const endMs = new Date(sessionData.endTime as string).getTime();
    characteristics.duration = Math.floor((endMs - startMs) / (1000 * 60)); // Convert to minutes
  } else if (sessionData.totalDuration) {
    characteristics.duration = sessionData.totalDuration as number;
  } else if (sessionData.duration) {
    characteristics.duration = sessionData.duration as number;
  }

  // Count screenshots
  if (Array.isArray(sessionData.screenshots)) {
    characteristics.screenshotCount = sessionData.screenshots.length;
    characteristics.hasScreenshots = characteristics.screenshotCount > 0;
  }

  // Count audio segments
  if (Array.isArray(sessionData.audioSegments)) {
    characteristics.audioSegmentCount = sessionData.audioSegments.length;
    characteristics.hasAudioContent = characteristics.audioSegmentCount > 0;
  }

  // Count video chapters
  if (sessionData.video && Array.isArray((sessionData.video as any).chapters)) {
    characteristics.videoChapterCount = (sessionData.video as any).chapters.length;
    characteristics.hasVideoContent = characteristics.videoChapterCount > 0;
  } else if (sessionData.video) {
    // Has video but no chapters yet
    characteristics.hasVideoContent = true;
    characteristics.videoChapterCount = 0;
  }

  // Count extracted tasks
  if (Array.isArray(sessionData.extractedTaskIds)) {
    characteristics.taskCount = sessionData.extractedTaskIds.length;
    characteristics.hasTasks = characteristics.taskCount > 0;
  }

  // Count extracted notes
  if (Array.isArray(sessionData.extractedNoteIds)) {
    characteristics.noteCount = sessionData.extractedNoteIds.length;
    characteristics.hasNotes = characteristics.noteCount > 0;
  }

  // Detect code changes from screenshots with AI analysis
  if (Array.isArray(sessionData.screenshots)) {
    let codeChangeCount = 0;

    for (const screenshot of sessionData.screenshots as any[]) {
      let isCodeRelated = false;

      // Check for code-related activities
      if (screenshot.aiAnalysis?.detectedActivity) {
        const activity = screenshot.aiAnalysis.detectedActivity.toLowerCase();

        if (
          activity.includes('coding') ||
          activity.includes('programming') ||
          activity.includes('vscode') ||
          activity.includes('ide') ||
          activity.includes('terminal') ||
          activity.includes('git') ||
          activity.includes('debugging') ||
          activity.includes('code-review') ||
          activity.includes('editor')
        ) {
          isCodeRelated = true;
        }
      }

      // Also check key elements for development tools (if activity didn't match)
      if (!isCodeRelated && screenshot.aiAnalysis?.keyElements) {
        const elements = screenshot.aiAnalysis.keyElements.map((e: string) => e.toLowerCase());
        if (
          elements.some((e: string) =>
            e.includes('vscode') ||
            e.includes('terminal') ||
            e.includes('git') ||
            e.includes('code') ||
            e.includes('editor')
          )
        ) {
          isCodeRelated = true;
        }
      }

      if (isCodeRelated) {
        codeChangeCount++;
      }
    }

    characteristics.codeChangeCount = codeChangeCount;
    characteristics.hasCodeChanges = codeChangeCount > 0;
  }

  // Detect decisions from audio insights and session summary
  let decisionCount = 0;

  if (sessionData.audioInsights && Array.isArray((sessionData.audioInsights as any).keyMoments)) {
    const audioInsights = sessionData.audioInsights as any;
    decisionCount += audioInsights.keyMoments.filter((m: any) => m.type === 'decision').length;
  }

  if (sessionData.summary && Array.isArray((sessionData.summary as any).keyInsights)) {
    const summary = sessionData.summary as any;
    decisionCount += summary.keyInsights.length;
  }

  characteristics.decisionCount = decisionCount;
  characteristics.hasDecisions = decisionCount > 0;

  // Count participants (for collaborative sessions)
  if (Array.isArray(sessionData.participants)) {
    characteristics.participantCount = Math.max(1, sessionData.participants.length);
  } else {
    characteristics.participantCount = 1; // Solo session
  }

  // Determine primary content type based on content ratios
  const contentTypes: Array<'code' | 'media' | 'discussion' | 'visual'> = [];

  if (characteristics.hasCodeChanges) contentTypes.push('code');
  if (characteristics.hasVideoContent || characteristics.hasAudioContent) {
    contentTypes.push('media');
  }
  if (characteristics.hasDecisions) contentTypes.push('discussion');
  if (characteristics.hasScreenshots) contentTypes.push('visual');

  // Determine primary type based on dominance
  if (contentTypes.length === 1) {
    characteristics.primaryContentType = contentTypes[0];
  } else if (contentTypes.length === 0) {
    characteristics.primaryContentType = 'mixed';
  } else {
    // Multiple types - determine which is dominant
    const codeRatio = characteristics.codeChangeCount / Math.max(1, characteristics.screenshotCount);
    const mediaRatio = (characteristics.videoChapterCount + characteristics.audioSegmentCount) / Math.max(1, characteristics.duration);

    if (codeRatio > 0.5) {
      characteristics.primaryContentType = 'code';
    } else if (mediaRatio > 0.2) {
      characteristics.primaryContentType = 'media';
    } else if (characteristics.hasDecisions && characteristics.decisionCount > 3) {
      characteristics.primaryContentType = 'discussion';
    } else if (characteristics.screenshotCount > 10) {
      characteristics.primaryContentType = 'visual';
    } else {
      characteristics.primaryContentType = 'mixed';
    }
  }

  // Determine intensity based on content volume
  const totalContent =
    characteristics.codeChangeCount +
    characteristics.videoChapterCount +
    characteristics.audioSegmentCount +
    characteristics.screenshotCount +
    characteristics.decisionCount +
    characteristics.noteCount +
    characteristics.taskCount;

  if (totalContent < 10) {
    characteristics.intensity = 'light';
  } else if (totalContent < 50) {
    characteristics.intensity = 'moderate';
  } else {
    characteristics.intensity = 'heavy';
  }

  return characteristics;
}
