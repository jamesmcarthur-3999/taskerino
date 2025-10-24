/**
 * Attachment Storage Service
 *
 * Handles storing large attachment data (images, screenshots) on the file system.
 * Uses Tauri's file system API for reliable, large file storage.
 *
 * Storage structure:
 * - App data directory/attachments/{id}.dat (base64 data)
 * - App data directory/attachments/{id}.meta.json (metadata)
 *
 * PERFORMANCE: Added in-memory LRU cache (100MB limit) for fast repeat access
 */

import { BaseDirectory, exists, readTextFile, writeTextFile, mkdir, remove, readDir } from '@tauri-apps/plugin-fs';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import type { Attachment, AttachmentRef } from '../types';
import { getStorage } from './storage';

interface CacheEntry {
  attachment: Attachment;
  size: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  currentSize: number;
  maxSize: number;
  entryCount: number;
}

class AttachmentStorageService {
  private readonly ATTACHMENTS_DIR = 'attachments';

  // LRU Cache configuration
  private readonly CACHE_MAX_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly MAX_CACHE_AGE = 10 * 60 * 1000; // 10 minutes
  private cache: Map<string, CacheEntry> = new Map();
  private cacheSize = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private cleanupInterval: ReturnType<typeof setInterval>;

  /**
   * Initialize cache with periodic cleanup
   */
  constructor() {
    // Clean up stale cache entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleEntries();
    }, 5 * 60 * 1000);

    console.log('💾 AttachmentStorageService initialized with LRU cache (100MB limit)');
  }

  /**
   * Calculate SHA-256 hash from base64 data
   */
  private async calculateSHA256(base64: string): Promise<string> {
    try {
      // Decode base64 to Uint8Array
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Calculate hash
      const hash = sha256(bytes);
      return bytesToHex(hash);
    } catch (error) {
      console.error('Failed to calculate hash:', error);
      throw error;
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtension(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
    };
    return mimeMap[mimeType] || 'bin';
  }

  /**
   * Load attachment reference by hash
   */
  private async loadAttachmentRef(hash: string): Promise<AttachmentRef | null> {
    const storage = await getStorage();
    const refs = await storage.load<AttachmentRef[]>('attachment_refs') || [];
    return refs.find(ref => ref.hash === hash) || null;
  }

  /**
   * Create new attachment reference
   */
  private async createAttachmentRef(ref: AttachmentRef): Promise<void> {
    const storage = await getStorage();
    const refs = await storage.load<AttachmentRef[]>('attachment_refs') || [];
    refs.push(ref);
    await storage.save('attachment_refs', refs);
  }

  /**
   * Increment reference count when attachment reused
   */
  private async incrementRefCount(hash: string, attachmentId: string): Promise<void> {
    const storage = await getStorage();
    const refs = await storage.load<AttachmentRef[]>('attachment_refs') || [];

    const refIndex = refs.findIndex(r => r.hash === hash);
    if (refIndex !== -1) {
      refs[refIndex].refCount++;
      refs[refIndex].attachmentIds.push(attachmentId);
      refs[refIndex].lastAccessedAt = Date.now();
      await storage.save('attachment_refs', refs);

      console.log(`✅ Incremented ref count for hash ${hash.slice(0, 8)}... (refCount: ${refs[refIndex].refCount})`);
    }
  }

  /**
   * Decrement reference count when attachment deleted
   * Returns true if physical file was deleted
   */
  private async decrementRefCount(hash: string, attachmentId: string): Promise<boolean> {
    const storage = await getStorage();
    const refs = await storage.load<AttachmentRef[]>('attachment_refs') || [];

    const refIndex = refs.findIndex(r => r.hash === hash);
    if (refIndex !== -1) {
      refs[refIndex].refCount--;
      refs[refIndex].attachmentIds = refs[refIndex].attachmentIds.filter(id => id !== attachmentId);

      // If refCount reaches 0, delete physical file
      if (refs[refIndex].refCount <= 0) {
        const physicalPath = refs[refIndex].physicalPath;

        // Delete physical file
        try {
          const metaPath = `${this.ATTACHMENTS_DIR}/${hash}.meta.json`;
          const dataPath = `${this.ATTACHMENTS_DIR}/${hash}.dat`;

          if (await exists(metaPath, { baseDir: BaseDirectory.AppData })) {
            await remove(metaPath, { baseDir: BaseDirectory.AppData });
          }

          if (await exists(dataPath, { baseDir: BaseDirectory.AppData })) {
            await remove(dataPath, { baseDir: BaseDirectory.AppData });
          }

          console.log(`🗑️  Deleted physical file for hash ${hash.slice(0, 8)}... (no more references)`);
        } catch (error) {
          console.error(`Failed to delete physical file for ${hash}:`, error);
        }

        // Remove ref entry
        refs.splice(refIndex, 1);
        await storage.save('attachment_refs', refs);

        return true; // Physical file deleted
      } else {
        // Still has references, just update count
        await storage.save('attachment_refs', refs);
        console.log(`✅ Decremented ref count for hash ${hash.slice(0, 8)}... (refCount: ${refs[refIndex].refCount}, retained)`);
        return false; // Physical file retained
      }
    }

    return false;
  }

  /**
   * Ensure attachments directory exists
   */
  private async ensureDir(): Promise<void> {
    try {
      const dirExists = await exists(this.ATTACHMENTS_DIR, { baseDir: BaseDirectory.AppData });
      if (!dirExists) {
        await mkdir(this.ATTACHMENTS_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
        console.log('📁 Created attachments directory');
      }
    } catch (error) {
      console.error('❌ Failed to create attachments directory:', error);
      throw error;
    }
  }

  /**
   * Estimate memory size of an attachment (in bytes)
   */
  private estimateSize(attachment: Attachment): number {
    let size = 0;

    // Base64 data is the largest contributor
    if (attachment.base64) {
      size += attachment.base64.length * 2; // UTF-16 in JavaScript
    }

    // Thumbnail data
    if (attachment.thumbnail) {
      size += attachment.thumbnail.length * 2;
    }

    // Metadata (approximate)
    size += JSON.stringify({
      id: attachment.id,
      type: attachment.type,
      name: attachment.name,
      mimeType: attachment.mimeType,
    }).length * 2;

    return size;
  }

  /**
   * Evict least recently used cache entries until size is under limit
   */
  private evictLRU(): void {
    if (this.cacheSize <= this.CACHE_MAX_SIZE) {
      return;
    }

    // Sort entries by lastAccessed (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    // Evict oldest entries until we're under the limit
    for (const [id, entry] of entries) {
      if (this.cacheSize <= this.CACHE_MAX_SIZE * 0.8) {
        // Keep cache at 80% after eviction to reduce thrashing
        break;
      }

      this.cache.delete(id);
      this.cacheSize -= entry.size;
      console.log(`🗑️  Evicted attachment ${id} from cache (${Math.round(entry.size / 1024)}KB)`);
    }
  }

  /**
   * Add attachment to cache
   */
  private addToCache(attachment: Attachment): void {
    const size = this.estimateSize(attachment);

    // Don't cache if single item is larger than max size
    if (size > this.CACHE_MAX_SIZE) {
      console.warn(`⚠️  Attachment ${attachment.id} too large to cache (${Math.round(size / 1024 / 1024)}MB)`);
      return;
    }

    // Remove existing entry if present
    this.removeFromCache(attachment.id);

    // Add to cache
    this.cache.set(attachment.id, {
      attachment,
      size,
      lastAccessed: Date.now(),
    });

    this.cacheSize += size;

    // Evict if necessary
    this.evictLRU();

    console.log(`💾 Cached attachment ${attachment.id} (${Math.round(size / 1024)}KB, cache: ${Math.round(this.cacheSize / 1024 / 1024)}MB)`);
  }

  /**
   * Get attachment from cache
   */
  private getFromCache(id: string): Attachment | null {
    const entry = this.cache.get(id);

    if (entry) {
      // Update last accessed time
      entry.lastAccessed = Date.now();
      this.cacheHits++;
      console.log(`✅ Cache HIT for attachment ${id}`);
      return entry.attachment;
    }

    this.cacheMisses++;
    console.log(`❌ Cache MISS for attachment ${id}`);
    return null;
  }

  /**
   * Remove attachment from cache
   */
  private removeFromCache(id: string): void {
    const entry = this.cache.get(id);
    if (entry) {
      this.cache.delete(id);
      this.cacheSize -= entry.size;
    }
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheSize = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    console.log('🗑️  Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      currentSize: this.cacheSize,
      maxSize: this.CACHE_MAX_SIZE,
      entryCount: this.cache.size,
    };
  }

  /**
   * Create attachment with deduplication
   * Checks for duplicate files by hash and reuses existing physical files
   */
  async createAttachment(params: {
    type: 'image' | 'video' | 'audio' | 'document' | 'other';
    name: string;
    mimeType: string;
    size: number;
    base64: string;
  }): Promise<Attachment> {
    const attachmentId = `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Calculate SHA-256 hash of file content
    const hash = await this.calculateSHA256(params.base64);

    // Check if file with this hash already exists
    const existingRef = await this.loadAttachmentRef(hash);

    let physicalPath: string;

    if (existingRef) {
      // Deduplicate: Use existing physical file
      physicalPath = existingRef.physicalPath;

      // Update reference count
      await this.incrementRefCount(hash, attachmentId);

      console.log(`[Attachment] ✓ Deduplicated ${params.name} (hash: ${hash.slice(0, 8)}..., saved ${(params.size / 1024).toFixed(2)} KB)`);

    } else {
      // New file: Save to disk
      // Store in subdirectory based on hash prefix for better organization
      const hashPrefix = hash.slice(0, 2);
      const hashSubdir = `${this.ATTACHMENTS_DIR}/${hashPrefix}`;

      // Ensure subdirectory exists
      const subdirExists = await exists(hashSubdir, { baseDir: BaseDirectory.AppData });
      if (!subdirExists) {
        await mkdir(hashSubdir, { baseDir: BaseDirectory.AppData, recursive: true });
      }

      const extension = this.getExtension(params.mimeType);
      physicalPath = `${hashSubdir}/${hash}.${extension}`;

      // Save metadata
      const metadata = {
        hash,
        mimeType: params.mimeType,
        size: params.size,
        createdAt: Date.now(),
      };

      const metaPath = `${hashSubdir}/${hash}.meta.json`;
      await writeTextFile(metaPath, JSON.stringify(metadata), { baseDir: BaseDirectory.AppData });

      // Save base64 data
      const dataPath = `${hashSubdir}/${hash}.dat`;
      await writeTextFile(dataPath, params.base64, { baseDir: BaseDirectory.AppData });

      // Create reference entry
      await this.createAttachmentRef({
        hash,
        physicalPath,
        refCount: 1,
        size: params.size,
        attachmentIds: [attachmentId],
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      });

      console.log(`[Attachment] ✓ Created ${params.name} (hash: ${hash.slice(0, 8)}..., ${(params.size / 1024).toFixed(2)} KB)`);
    }

    const attachment: Attachment = {
      id: attachmentId,
      type: params.type as any,
      name: params.name,
      path: physicalPath, // All attachments with same hash share same physical path
      size: params.size,
      mimeType: params.mimeType,
      createdAt: new Date().toISOString(),
      hash,
      base64: params.base64, // Keep in memory for immediate use
    };

    // Save attachment metadata (separate from physical file)
    await this.saveAttachmentMetadata(attachment);

    // Add to cache
    this.addToCache(attachment);

    return attachment;
  }

  /**
   * Save attachment metadata to storage
   */
  private async saveAttachmentMetadata(attachment: Attachment): Promise<void> {
    const storage = await getStorage();
    const attachments = await storage.load<Attachment[]>('attachments') || [];

    // Remove existing entry if present
    const filtered = attachments.filter(a => a.id !== attachment.id);
    filtered.push(attachment);

    await storage.save('attachments', filtered);
  }

  /**
   * Load attachment metadata from storage
   */
  private async loadAttachmentMetadata(attachmentId: string): Promise<Attachment | null> {
    const storage = await getStorage();
    const attachments = await storage.load<Attachment[]>('attachments') || [];
    return attachments.find(a => a.id === attachmentId) || null;
  }

  /**
   * Delete attachment metadata from storage
   */
  private async deleteAttachmentMetadata(attachmentId: string): Promise<void> {
    const storage = await getStorage();
    const attachments = await storage.load<Attachment[]>('attachments') || [];
    const filtered = attachments.filter(a => a.id !== attachmentId);
    await storage.save('attachments', filtered);
  }

  /**
   * Save attachment to file system
   * Stores base64 data and metadata separately
   * PERFORMANCE: Also adds to cache for fast subsequent access
   */
  async saveAttachment(attachment: Attachment): Promise<void> {
    await this.ensureDir();

    try {
      // Save metadata (without base64 data)
      const metadata = {
        id: attachment.id,
        type: attachment.type,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: attachment.createdAt,
        thumbnail: attachment.thumbnail, // Keep thumbnail for quick display
        path: attachment.path, // File path (for videos and other file-based attachments)
        duration: attachment.duration, // Video duration
        dimensions: attachment.dimensions, // Video/image dimensions
      };

      const metaPath = `${this.ATTACHMENTS_DIR}/${attachment.id}.meta.json`;
      await writeTextFile(metaPath, JSON.stringify(metadata), { baseDir: BaseDirectory.AppData });

      // Save base64 data separately (if present)
      if (attachment.base64) {
        const dataPath = `${this.ATTACHMENTS_DIR}/${attachment.id}.dat`;
        await writeTextFile(dataPath, attachment.base64, { baseDir: BaseDirectory.AppData });
      }

      console.log(`💾 Saved attachment ${attachment.id} to file system (${Math.round(attachment.size / 1024)}KB)`);

      // Add to cache for fast access
      this.addToCache(attachment);
    } catch (error) {
      console.error('❌ Failed to save attachment:', error);
      throw error;
    }
  }

  /**
   * Get attachment from file system
   * PERFORMANCE: Checks cache first to avoid file I/O
   */
  async getAttachment(id: string): Promise<Attachment | null> {
    // Check cache first
    const cached = this.getFromCache(id);
    if (cached) {
      return cached;
    }

    // Cache miss - read from file system
    try {
      // Read metadata
      const metaPath = `${this.ATTACHMENTS_DIR}/${id}.meta.json`;
      const metaExists = await exists(metaPath, { baseDir: BaseDirectory.AppData });

      if (!metaExists) {
        return null;
      }

      const metaContent = await readTextFile(metaPath, { baseDir: BaseDirectory.AppData });
      const metadata = JSON.parse(metaContent);

      // Read base64 data if exists
      const dataPath = `${this.ATTACHMENTS_DIR}/${id}.dat`;
      const dataExists = await exists(dataPath, { baseDir: BaseDirectory.AppData });

      let base64: string | undefined;
      if (dataExists) {
        base64 = await readTextFile(dataPath, { baseDir: BaseDirectory.AppData });
      }

      const attachment = {
        ...metadata,
        base64,
      };

      // Add to cache for next time
      this.addToCache(attachment);

      return attachment;
    } catch (error) {
      console.error('❌ Failed to get attachment:', error);
      return null;
    }
  }

  /**
   * Delete attachment from file system
   * Handles missing files gracefully - won't fail if file is already gone
   */
  async deleteAttachment(id: string): Promise<void> {
    try {
      // Remove from cache first
      this.removeFromCache(id);

      // Load attachment metadata
      const attachment = await this.loadAttachmentMetadata(id);

      if (!attachment) {
        console.warn(`[Attachment] Attachment ${id} not found`);
        return;
      }

      // If attachment has a hash, use reference counting
      if (attachment.hash) {
        // Decrement reference count (may delete physical file if count reaches 0)
        const physicalFileDeleted = await this.decrementRefCount(attachment.hash, id);

        // Delete attachment metadata
        await this.deleteAttachmentMetadata(id);

        console.log(`[Attachment] ✓ Deleted attachment ${id} (physical file ${physicalFileDeleted ? 'deleted' : 'retained'})`);
      } else {
        // Legacy attachment without hash - delete normally
        // Load from file system
        const fsAttachment = await this.getAttachment(id);

        // Delete the actual file if it exists
        if (fsAttachment?.path) {
          const actualFilePath = fsAttachment.path;
          try {
            if (await exists(actualFilePath, { baseDir: BaseDirectory.AppData })) {
              await remove(actualFilePath, { baseDir: BaseDirectory.AppData });
              console.log(`🗑️ Deleted actual file: ${actualFilePath}`);
            }
          } catch (error) {
            console.error(`Failed to delete actual file ${actualFilePath}:`, error);
          }
        }

        // Delete metadata file
        const metaPath = `${this.ATTACHMENTS_DIR}/${id}.meta.json`;
        if (await exists(metaPath, { baseDir: BaseDirectory.AppData })) {
          await remove(metaPath, { baseDir: BaseDirectory.AppData });
        }

        // Delete data file
        const dataPath = `${this.ATTACHMENTS_DIR}/${id}.dat`;
        if (await exists(dataPath, { baseDir: BaseDirectory.AppData })) {
          await remove(dataPath, { baseDir: BaseDirectory.AppData });
        }

        console.log(`✅ Attachment deleted (legacy): ${id}`);
      }
    } catch (error) {
      console.error(`Failed to delete attachment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple attachments in batch
   * Handles missing files gracefully - logs errors but doesn't fail the entire operation
   */
  async deleteAttachments(ids: string[]): Promise<void> {
    console.log(`🗑️  Deleting ${ids.length} attachments...`);

    const results = await Promise.allSettled(
      ids.map(id => this.deleteAttachment(id))
    );

    // Log any failures but don't throw
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`⚠️  Failed to delete ${failures.length} of ${ids.length} attachments`);
      failures.forEach((failure, index) => {
        if (failure.status === 'rejected') {
          console.warn(`  - ${ids[index]}: ${failure.reason}`);
        }
      });
    }

    const successes = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ Successfully deleted ${successes} of ${ids.length} attachments`);
  }

  /**
   * Get all attachments from file system
   */
  async getAllAttachments(): Promise<Attachment[]> {
    try {
      await this.ensureDir();

      // Read all files in the attachments directory
      const entries = await readDir(this.ATTACHMENTS_DIR, { baseDir: BaseDirectory.AppData });

      // Filter for .meta.json files and extract attachment IDs
      const metaFiles = entries.filter(entry => entry.name && entry.name.endsWith('.meta.json'));

      // Load all attachments
      const attachments: Attachment[] = [];
      for (const metaFile of metaFiles) {
        // Extract ID from filename (remove .meta.json extension)
        const id = metaFile.name!.replace('.meta.json', '');
        const attachment = await this.getAttachment(id);
        if (attachment) {
          attachments.push(attachment);
        }
      }

      return attachments;
    } catch (error) {
      // If directory doesn't exist yet, return empty array
      return [];
    }
  }

  /**
   * Check if running in Tauri environment
   * (Always returns true since we always use Tauri APIs)
   */
  isTauriEnvironment(): boolean {
    return true;
  }

  /**
   * Remove entries that haven't been accessed recently
   * Called periodically by cleanup interval
   */
  private cleanupStaleEntries(): void {
    const now = Date.now();
    const staleIds: string[] = [];

    for (const [id, entry] of this.cache.entries()) {
      if (now - entry.lastAccessed > this.MAX_CACHE_AGE) {
        staleIds.push(id);
      }
    }

    for (const id of staleIds) {
      const entry = this.cache.get(id);
      if (entry) {
        this.cache.delete(id);
        this.cacheSize -= entry.size;
        console.log(`⏰ Removed stale entry ${id} (${Math.round(entry.size / 1024)}KB)`);
      }
    }

    if (staleIds.length > 0) {
      console.log(`🧹 Cleaned up ${staleIds.length} stale cache entries`);
    }
  }

  /**
   * Rebuild attachment references from existing attachments
   * Used for recovery or migrating from non-deduplicated storage
   */
  async rebuildAttachmentRefs(): Promise<void> {
    console.log('[Attachment] Rebuilding attachment references...');

    const storage = await getStorage();

    // Load all data that contains attachments
    const sessions = await storage.load<any[]>('sessions') || [];
    const notes = await storage.load<any[]>('notes') || [];
    const tasks = await storage.load<any[]>('tasks') || [];

    const allAttachments: Attachment[] = [];

    // Collect all attachments from sessions
    for (const session of sessions) {
      // Screenshots
      if (session.screenshots) {
        for (const screenshot of session.screenshots) {
          if (screenshot.attachmentId) {
            const attachment = await this.loadAttachmentMetadata(screenshot.attachmentId);
            if (attachment) {
              allAttachments.push(attachment);
            }
          }
        }
      }

      // Audio segments
      if (session.audioSegments) {
        for (const segment of session.audioSegments) {
          if (segment.attachmentId) {
            const attachment = await this.loadAttachmentMetadata(segment.attachmentId);
            if (attachment) {
              allAttachments.push(attachment);
            }
          }
        }
      }

      // Full audio
      if (session.fullAudioAttachmentId) {
        const attachment = await this.loadAttachmentMetadata(session.fullAudioAttachmentId);
        if (attachment) {
          allAttachments.push(attachment);
        }
      }

      // Video
      if (session.video?.fullVideoAttachmentId) {
        const attachment = await this.loadAttachmentMetadata(session.video.fullVideoAttachmentId);
        if (attachment) {
          allAttachments.push(attachment);
        }
      }
    }

    // Collect attachments from notes
    for (const note of notes) {
      if (note.attachments) {
        for (const att of note.attachments) {
          allAttachments.push(att);
        }
      }
    }

    // Collect attachments from tasks
    for (const task of tasks) {
      if (task.attachments) {
        for (const att of task.attachments) {
          allAttachments.push(att);
        }
      }
    }

    console.log(`[Attachment] Found ${allAttachments.length} total attachments`);

    // Build refs map
    const refsMap = new Map<string, AttachmentRef>();

    for (const attachment of allAttachments) {
      if (!attachment.hash) {
        console.warn(`[Attachment] Skipping ${attachment.id} (no hash)`);
        continue;
      }

      const existing = refsMap.get(attachment.hash);

      if (existing) {
        // Duplicate found
        existing.refCount++;
        existing.attachmentIds.push(attachment.id);
      } else {
        // New unique file
        refsMap.set(attachment.hash, {
          hash: attachment.hash,
          physicalPath: attachment.path || '',
          refCount: 1,
          size: attachment.size,
          attachmentIds: [attachment.id],
          createdAt: new Date(attachment.createdAt).getTime(),
          lastAccessedAt: Date.now(),
        });
      }
    }

    // Save refs
    const refs = Array.from(refsMap.values());
    await storage.save('attachment_refs', refs);

    const duplicates = allAttachments.filter(a => a.hash).length - refs.length;
    const savings = refs.reduce((sum, ref) => sum + (ref.size * (ref.refCount - 1)), 0);

    console.log(`[Attachment] ✓ Rebuilt ${refs.length} references from ${allAttachments.length} attachments`);
    console.log(`[Attachment] Found ${duplicates} duplicates, saving ${(savings / 1024 / 1024).toFixed(2)} MB`);
  }

  /**
   * Get deduplication statistics
   */
  async getDeduplicationStats(): Promise<{
    totalAttachments: number;
    uniqueFiles: number;
    duplicates: number;
    totalSize: number;
    actualSize: number;
    savedSize: number;
    savedPercentage: number;
  }> {
    const storage = await getStorage();
    const refs = await storage.load<AttachmentRef[]>('attachment_refs') || [];
    const attachments = await storage.load<Attachment[]>('attachments') || [];

    const totalAttachments = attachments.length;
    const uniqueFiles = refs.length;
    const duplicates = Math.max(0, totalAttachments - uniqueFiles);

    const totalSize = refs.reduce((sum, ref) => sum + (ref.size * ref.refCount), 0);
    const actualSize = refs.reduce((sum, ref) => sum + ref.size, 0);
    const savedSize = totalSize - actualSize;
    const savedPercentage = totalSize > 0 ? (savedSize / totalSize) * 100 : 0;

    return {
      totalAttachments,
      uniqueFiles,
      duplicates,
      totalSize,
      actualSize,
      savedSize,
      savedPercentage,
    };
  }

  /**
   * Destroy service and cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearCache();
    console.log('💾 AttachmentStorageService destroyed');
  }
}

// Export singleton instance
export const attachmentStorage = new AttachmentStorageService();
