import { getStorage } from '../services/storage';
import { attachmentStorage } from '../services/attachmentStorage';
import type { Session, Note, Task, Attachment } from '../types';

/**
 * Migration: Calculate hashes for existing attachments and build deduplication refs
 *
 * This migration:
 * 1. Loads all existing attachment files from disk
 * 2. Calculates SHA-256 hash for each file
 * 3. Updates attachment metadata with hash field
 * 4. Rebuilds attachment_refs for deduplication tracking
 *
 * Run this ONCE after upgrading to Phase 3.5 (Deduplication)
 */
export async function migrateAttachmentHashes() {
  console.log('[Migration] Starting attachment hash migration...');

  const storage = await getStorage();

  // Step 1: Collect all attachments from all sources
  console.log('[Migration] Step 1: Collecting attachments...');

  const allAttachments: Attachment[] = [];
  const attachmentSources: Map<string, { type: string; parentId: string }> = new Map();

  // Collect from sessions
  const sessions = await storage.load<Session[]>('sessions') || [];
  for (const session of sessions) {
    // Screenshots
    if (session.screenshots) {
      for (const screenshot of session.screenshots) {
        if (screenshot.attachmentId) {
          // Load from file system
          const attachment = await attachmentStorage.getAttachment(screenshot.attachmentId);
          if (attachment) {
            allAttachments.push(attachment);
            attachmentSources.set(attachment.id, { type: 'screenshot', parentId: session.id });
          }
        }
      }
    }

    // Audio segments
    if (session.audioSegments) {
      for (const segment of session.audioSegments) {
        if (segment.attachmentId) {
          const attachment = await attachmentStorage.getAttachment(segment.attachmentId);
          if (attachment) {
            allAttachments.push(attachment);
            attachmentSources.set(attachment.id, { type: 'audio', parentId: session.id });
          }
        }
      }
    }

    // Full audio
    if (session.fullAudioAttachmentId) {
      const attachment = await attachmentStorage.getAttachment(session.fullAudioAttachmentId);
      if (attachment) {
        allAttachments.push(attachment);
        attachmentSources.set(attachment.id, { type: 'fullAudio', parentId: session.id });
      }
    }

    // Video
    if (session.video?.fullVideoAttachmentId) {
      const attachment = await attachmentStorage.getAttachment(session.video.fullVideoAttachmentId);
      if (attachment) {
        allAttachments.push(attachment);
        attachmentSources.set(attachment.id, { type: 'video', parentId: session.id });
      }
    }
  }

  // Collect from notes
  const notes = await storage.load<Note[]>('notes') || [];
  for (const note of notes) {
    if (note.attachments) {
      for (const att of note.attachments) {
        allAttachments.push(att);
        attachmentSources.set(att.id, { type: 'noteAttachment', parentId: note.id });
      }
    }
  }

  // Collect from tasks
  const tasks = await storage.load<Task[]>('tasks') || [];
  for (const task of tasks) {
    if (task.attachments) {
      for (const att of task.attachments) {
        allAttachments.push(att);
        attachmentSources.set(att.id, { type: 'taskAttachment', parentId: task.id });
      }
    }
  }

  console.log(`[Migration] Found ${allAttachments.length} attachments to process`);

  // Step 2: Calculate hashes for attachments that don't have them
  console.log('[Migration] Step 2: Calculating hashes...');

  let hashesCalculated = 0;
  let alreadyHashed = 0;
  let errors = 0;

  for (const attachment of allAttachments) {
    if (attachment.hash) {
      alreadyHashed++;
      continue;
    }

    // Only calculate hash if we have base64 data
    if (!attachment.base64) {
      console.warn(`[Migration] Skipping ${attachment.id} - no base64 data`);
      errors++;
      continue;
    }

    try {
      // Calculate hash using the private method through a workaround
      // We'll use the same algorithm here
      const { sha256 } = await import('@noble/hashes/sha2.js');
      const { bytesToHex } = await import('@noble/hashes/utils.js');

      const binaryString = atob(attachment.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const hash = sha256(bytes);
      attachment.hash = bytesToHex(hash);

      // Save updated attachment
      await attachmentStorage.saveAttachment(attachment);

      hashesCalculated++;

      if (hashesCalculated % 10 === 0) {
        console.log(`[Migration] Processed ${hashesCalculated} attachments...`);
      }
    } catch (error) {
      console.error(`[Migration] Failed to hash attachment ${attachment.id}:`, error);
      errors++;
    }
  }

  console.log(`[Migration] Hash calculation complete:`);
  console.log(`  - Already hashed: ${alreadyHashed}`);
  console.log(`  - Newly hashed: ${hashesCalculated}`);
  console.log(`  - Errors: ${errors}`);

  // Step 3: Rebuild attachment references for deduplication
  console.log('[Migration] Step 3: Building deduplication references...');

  try {
    await attachmentStorage.rebuildAttachmentRefs();
  } catch (error) {
    console.error('[Migration] Failed to rebuild attachment refs:', error);
    throw error;
  }

  // Step 4: Show deduplication statistics
  console.log('[Migration] Step 4: Calculating deduplication statistics...');

  try {
    const stats = await attachmentStorage.getDeduplicationStats();

    console.log('[Migration] Deduplication Statistics:');
    console.log(`  - Total attachments: ${stats.totalAttachments}`);
    console.log(`  - Unique files: ${stats.uniqueFiles}`);
    console.log(`  - Duplicates: ${stats.duplicates}`);
    console.log(`  - Total size (with duplicates): ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Actual size (deduplicated): ${(stats.actualSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Space saved: ${(stats.savedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Savings: ${stats.savedPercentage.toFixed(2)}%`);
  } catch (error) {
    console.error('[Migration] Failed to calculate stats:', error);
  }

  console.log('[Migration] Attachment hash migration complete!');
}
