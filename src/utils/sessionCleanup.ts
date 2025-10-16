/**
 * Session Cleanup Utilities
 *
 * Helper functions for cleaning up session-related resources
 */

import type { Session } from '../types';

/**
 * Helper function to collect all attachment IDs from a session
 * Returns array of attachment IDs to be deleted
 *
 * Collects attachments from:
 * - Screenshots (screenshot.attachmentId)
 * - Audio segments (audioSegment.attachmentId)
 * - Full audio file (session.fullAudioAttachmentId)
 * - Video (video.fullVideoAttachmentId)
 * - Video chunks (chunk.attachmentId)
 */
export function collectSessionAttachmentIds(session: Session): string[] {
  const attachmentIds: string[] = [];

  // Screenshots
  session.screenshots?.forEach(screenshot => {
    if (screenshot.attachmentId) {
      attachmentIds.push(screenshot.attachmentId);
    }
  });

  // Audio segments
  session.audioSegments?.forEach(segment => {
    if (segment.attachmentId) {
      attachmentIds.push(segment.attachmentId);
    }
  });

  // Full audio attachment (concatenated audio for enrichment)
  if (session.fullAudioAttachmentId) {
    attachmentIds.push(session.fullAudioAttachmentId);
  }

  // Video attachments
  if (session.video) {
    // Full video attachment
    if (session.video.fullVideoAttachmentId) {
      attachmentIds.push(session.video.fullVideoAttachmentId);
    }

    // Video chunks
    session.video.chunks?.forEach(chunk => {
      if (chunk.attachmentId) {
        attachmentIds.push(chunk.attachmentId);
      }
    });
  }

  return attachmentIds;
}
