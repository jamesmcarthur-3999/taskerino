import { getStorage } from '../services/storage';
import type { Session, Note, Task } from '../types';

export async function migrateToCompressed() {
  console.log('[Migration] Starting compression migration...');

  const storage = await getStorage();
  const collections = ['sessions', 'notes', 'tasks'];

  for (const collection of collections) {
    console.log(`[Migration] Compressing ${collection}...`);

    // Load all entities using existing index
    const entities = await (storage as any).loadAll<any>(collection);

    if (!entities || entities.length === 0) {
      console.log(`[Migration] No ${collection} to compress`);
      continue;
    }

    // Save each entity with compression
    for (const entity of entities) {
      if (entity.id) {
        await (storage as any).saveEntityCompressed(collection, entity);
      }
    }

    console.log(`[Migration] ✓ Compressed ${entities.length} ${collection}`);

    // Optional: Delete old uncompressed files
    // This is left as a manual cleanup step for safety
  }

  console.log('[Migration] Compression migration complete!');
}
