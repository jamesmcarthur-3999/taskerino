/**
 * Migration: Split Collections to Per-Entity Files (Phase 2.2)
 *
 * This migration splits monolithic collection files into per-entity files:
 * - sessions.json -> sessions/session-{id}.json + sessions/index.json
 * - notes.json -> notes/note-{id}.json + notes/index.json
 * - tasks.json -> tasks/task-{id}.json + tasks/index.json
 * - topics.json -> topics/topic-{id}.json + topics/index.json
 * - companies.json -> companies/company-{id}.json + companies/index.json
 * - contacts.json -> contacts/contact-{id}.json + contacts/index.json
 *
 * Benefits:
 * - Better concurrency (no file locking on entire collection)
 * - Faster individual entity access
 * - Reduced memory usage (load only what you need)
 * - SHA-256 checksums for each entity
 */

import { getStorage } from '../services/storage';
import type { Session, Note, Task, Topic, Company, Contact } from '../types';

export async function migrateToPerEntityFiles(): Promise<void> {
  console.log('[Migration] Starting per-entity file migration...');

  const storage = await getStorage();
  const collections = ['sessions', 'notes', 'tasks', 'topics', 'companies', 'contacts'];

  for (const collection of collections) {
    try {
      console.log(`[Migration] Migrating ${collection}...`);

      // Load old monolithic file
      const oldData = await storage.load<any[]>(collection);
      if (!oldData || oldData.length === 0) {
        console.log(`[Migration] ${collection} is empty, skipping`);
        continue;
      }

      // Save each entity using saveEntity() method
      for (const entity of oldData) {
        if (entity.id) {
          // Use type assertion to access saveEntity
          await (storage as any).saveEntity(collection, entity);
        }
      }

      console.log(`[Migration] ✓ Migrated ${oldData.length} ${collection}`);

    } catch (error) {
      console.error(`[Migration] Failed to migrate ${collection}:`, error);
      throw error; // Halt migration on error
    }
  }

  console.log('[Migration] Per-entity file migration complete!');
}
