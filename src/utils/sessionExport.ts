/**
 * Session Export Utilities
 *
 * Handles exporting session data in various formats
 */

import type { Session } from '../types';

/**
 * Format duration in minutes to human-readable string
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Export session as JSON with metadata
 */
export function exportSessionJSON(session: Session): void {
  const data = {
    session,
    exportedAt: new Date().toISOString(),
    version: '1.0',
    application: 'Taskerino'
  };

  const jsonString = JSON.stringify(data, null, 2);
  const filename = `session-${session.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.json`;

  downloadFile(jsonString, filename, 'application/json');
}

/**
 * Export session as Markdown for human readability
 */
export function exportSessionMarkdown(session: Session): void {
  const startDate = new Date(session.startTime);
  const duration = session.totalDuration || 0;

  let markdown = `# ${session.name}\n\n`;

  // Metadata section
  markdown += `## Session Details\n\n`;
  markdown += `- **Date:** ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString()}\n`;
  markdown += `- **Duration:** ${formatDuration(duration)}\n`;
  markdown += `- **Screenshots:** ${session.screenshots?.length || 0}\n`;
  // Tasks Extracted removed - now tracked via task.relationships
  markdown += `- **Audio Mode:** ${session.audioMode || 'off'}\n`;

  if (session.tags && session.tags.length > 0) {
    markdown += `- **Tags:** ${session.tags.join(', ')}\n`;
  }

  markdown += `\n`;

  // Description
  if (session.description) {
    markdown += `## Description\n\n`;
    markdown += `${session.description}\n\n`;
  }

  // AI Summary
  if (session.summary) {
    markdown += `## AI Summary\n\n`;

    if (session.summary.narrative) {
      markdown += `### Narrative\n\n`;
      markdown += `${session.summary.narrative}\n\n`;
    }

    if (session.summary.achievements && session.summary.achievements.length > 0) {
      markdown += `### Achievements ✅\n\n`;
      session.summary.achievements.forEach(achievement => {
        markdown += `- ${achievement}\n`;
      });
      markdown += `\n`;
    }

    if (session.summary.blockers && session.summary.blockers.length > 0) {
      markdown += `### Blockers ⚠️\n\n`;
      session.summary.blockers.forEach(blocker => {
        markdown += `- ${blocker}\n`;
      });
      markdown += `\n`;
    }

    if (session.summary.keyInsights && session.summary.keyInsights.length > 0) {
      markdown += `### Key Insights 💡\n\n`;
      session.summary.keyInsights.forEach(insight => {
        markdown += `- ${insight}\n`;
      });
      markdown += `\n`;
    }

    if (session.summary.recommendedTasks && session.summary.recommendedTasks.length > 0) {
      markdown += `### Recommended Tasks 📝\n\n`;
      session.summary.recommendedTasks.forEach(task => {
        markdown += `- **${task.title}** (${task.priority})\n`;
        if (task.context) {
          markdown += `  - ${task.context}\n`;
        }
      });
      markdown += `\n`;
    }
  }

  // Screenshots section
  if (session.screenshots && session.screenshots.length > 0) {
    markdown += `## Screenshot Timeline (${session.screenshots.length} total)\n\n`;

    session.screenshots.forEach((screenshot, index) => {
      const screenshotTime = new Date(screenshot.timestamp);
      markdown += `### Screenshot ${index + 1} - ${screenshotTime.toLocaleTimeString()}\n\n`;

      if (screenshot.aiAnalysis) {
        if (screenshot.aiAnalysis.detectedActivity) {
          markdown += `**Activity:** ${screenshot.aiAnalysis.detectedActivity}\n\n`;
        }

        if (screenshot.aiAnalysis.summary) {
          markdown += `**Summary:** ${screenshot.aiAnalysis.summary}\n\n`;
        }

        if (screenshot.aiAnalysis.keyElements && screenshot.aiAnalysis.keyElements.length > 0) {
          markdown += `**Key Elements:**\n`;
          screenshot.aiAnalysis.keyElements.forEach(element => {
            markdown += `- ${element}\n`;
          });
          markdown += `\n`;
        }

        if (screenshot.aiAnalysis.suggestedActions && screenshot.aiAnalysis.suggestedActions.length > 0) {
          markdown += `**Suggested Actions:**\n`;
          screenshot.aiAnalysis.suggestedActions.forEach(action => {
            markdown += `- ${action}\n`;
          });
          markdown += `\n`;
        }
      }
    });
  }

  // Audio transcriptions
  if (session.audioSegments && session.audioSegments.length > 0) {
    markdown += `## Audio Transcriptions (${session.audioSegments.length} segments)\n\n`;

    session.audioSegments.forEach((segment, index) => {
      const segmentTime = new Date(segment.timestamp);
      markdown += `### Segment ${index + 1} - ${segmentTime.toLocaleTimeString()}\n\n`;

      if (segment.transcription) {
        markdown += `${segment.transcription}\n\n`;
      }
    });
  }

  // Footer
  markdown += `---\n\n`;
  markdown += `*Exported from Taskerino on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*\n`;

  const filename = `session-${session.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.md`;
  downloadFile(markdown, filename, 'text/markdown');
}

/**
 * Helper function to trigger browser download
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
