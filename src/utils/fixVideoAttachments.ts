/**
 * Utility to fix corrupted video attachments
 *
 * Bug: Some video attachments have their path field set to another attachment ID
 * instead of the actual file path. This utility finds and fixes them.
 */

import { attachmentStorage } from '../services/attachmentStorage';
import type { Attachment } from '../types';

export async function fixCorruptedVideoAttachments(): Promise<{
  fixed: number;
  errors: string[];
}> {
  const result = {
    fixed: 0,
    errors: [] as string[],
  };

  try {
    // Get all attachments
    const allAttachments = await attachmentStorage.getAllAttachments();

    // Find video attachments with corrupted paths
    const videoAttachments = allAttachments.filter(a => a.type === 'video');

    // Separate corrupted and valid attachments
    const corruptedAttachments = videoAttachments.filter(
      a => a.path?.startsWith('video-') && !a.path.includes('/')
    );
    const validAttachments = videoAttachments.filter(
      a => a.path && a.path.includes('/')
    );

    if (corruptedAttachments.length === 0) {
      return result;
    }

    console.log(`🔧 [FIX VIDEO] Found ${corruptedAttachments.length} corrupted video attachments, repairing...`);

    for (const attachment of corruptedAttachments) {
      try {
        // Strategy 1: Try to find the referenced attachment
        const referencedAttachment = await attachmentStorage.getAttachment(attachment.path!);

        if (referencedAttachment && referencedAttachment.path && referencedAttachment.path.includes('/')) {
          // Found the real file path via reference
          const fixed: Attachment = {
            ...attachment,
            path: referencedAttachment.path,
            size: referencedAttachment.size || attachment.size,
            duration: referencedAttachment.duration || attachment.duration,
            thumbnail: referencedAttachment.thumbnail || attachment.thumbnail,
          };

          await attachmentStorage.saveAttachment(fixed);
          result.fixed++;
        } else {
          // Strategy 2: Try to find a valid attachment with similar timestamp/session
          const idParts = attachment.id.split('-');
          const timestamp = idParts[1];

          // Find valid attachments with matching timestamp
          const matchingAttachment = validAttachments.find(a => a.id.includes(timestamp));

          if (matchingAttachment) {
            const fixed: Attachment = {
              ...attachment,
              path: matchingAttachment.path,
              size: matchingAttachment.size || attachment.size,
              duration: matchingAttachment.duration || attachment.duration,
              thumbnail: matchingAttachment.thumbnail || attachment.thumbnail,
            };

            await attachmentStorage.saveAttachment(fixed);
            result.fixed++;
          } else {
            result.errors.push(`${attachment.id}: No valid attachment found`);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`${attachment.id}: ${errorMsg}`);
      }
    }

    if (result.fixed > 0) {
      console.log(`✅ [FIX VIDEO] Repaired ${result.fixed} corrupted video attachments`);
    }
    if (result.errors.length > 0) {
      console.warn(`⚠️ [FIX VIDEO] Failed to repair ${result.errors.length} attachments:`, result.errors);
    }

    return result;
  } catch (error) {
    console.error('❌ [FIX VIDEO] Failed to repair video attachments:', error);
    throw error;
  }
}
