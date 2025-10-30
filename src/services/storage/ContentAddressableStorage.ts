/**
 * ContentAddressableStorage - Deduplication via content-addressable storage
 *
 * Stores attachments by SHA-256 content hash for automatic deduplication:
 * - Calculate hash from attachment data
 * - Check if hash already exists (deduplication!)
 * - Track references to enable garbage collection
 * - Support migration from legacy attachment storage
 *
 * Storage structure:
 * ```
 * /attachments-ca/{hash-prefix}/
 *   {hash}/
 *     data.bin           # Actual attachment data (base64)
 *     metadata.json      # { hash, mimeType, size, references: [{sessionId, attachmentId}] }
 * ```
 *
 * Benefits:
 * - 50-70% storage reduction (similar screenshots automatically deduplicated)
 * - Automatic garbage collection (delete when refCount reaches 0)
 * - Fast lookup by hash
 * - Easy to implement integrity verification
 *
 * @see docs/sessions-rewrite/PHASE_4_KICKOFF.md (lines 157-184)
 */

import type { StorageAdapter } from './StorageAdapter';
import type { Attachment, AttachmentType } from '../../types';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/**
 * Reference to a session using an attachment
 */
export interface AttachmentReference {
  sessionId: string;
  attachmentId: string; // Original attachment ID in the session
  addedAt: number; // When this reference was added
}

/**
 * Metadata for a content-addressable attachment
 */
export interface CAAttachmentMetadata {
  hash: string; // SHA-256 hash of content
  mimeType: string;
  size: number; // Size in bytes
  type: AttachmentType;
  createdAt: number; // First time this hash was seen
  lastAccessedAt: number; // Most recent access
  references: AttachmentReference[]; // Which sessions use this attachment
  refCount: number; // Cached count for fast access
}

/**
 * Statistics about content-addressable storage
 */
export interface CAStorageStats {
  totalAttachments: number; // Total unique attachments (by hash)
  totalSize: number; // Actual storage used (bytes)
  dedupSavings: number; // Storage saved via deduplication (bytes)
  avgReferences: number; // Average references per attachment
  totalReferences: number; // Total attachment references across all sessions
}

/**
 * Result of garbage collection operation
 */
export interface GarbageCollectionResult {
  deleted: number; // Number of attachments deleted
  freed: number; // Bytes freed
  errors: string[]; // Any errors encountered
  duration: number; // Time taken (ms)
}

/**
 * Progress callback for long operations
 */
export interface ProgressCallback {
  (progress: {
    current: number;
    total: number;
    status: string;
    percentage: number;
  }): void;
}

/**
 * ContentAddressableStorage - Main class
 *
 * Handles storage and deduplication of attachments using content-addressable storage.
 * All attachments are stored by their SHA-256 hash, enabling automatic deduplication.
 */
export class ContentAddressableStorage {
  private adapter: StorageAdapter;
  private readonly CA_PREFIX = 'attachments-ca';
  private readonly INDEX_KEY = 'ca-attachment-index';

  // In-memory cache for fast lookups (will be replaced with LRU cache in Task 4.6)
  private metadataCache = new Map<string, CAAttachmentMetadata>();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(adapter: StorageAdapter) {
    this.adapter = adapter;
  }

  // ========================================
  // CORE OPERATIONS
  // ========================================

  /**
   * Save attachment and return its hash
   *
   * If an attachment with the same content already exists, it will be deduplicated
   * (reusing the existing file and incrementing the reference count).
   *
   * @param attachment - Attachment to save
   * @returns SHA-256 hash of the attachment content
   */
  async saveAttachment(attachment: Attachment): Promise<string> {
    // Validate attachment has base64 data
    if (!attachment.base64) {
      throw new Error(`[CA] Attachment ${attachment.id} has no base64 data`);
    }

    // Calculate SHA-256 hash
    const hash = await this.calculateHash(attachment.base64);
    console.log(`[CA] Calculated hash ${hash.slice(0, 8)}... for attachment ${attachment.id}`);

    // Check if this hash already exists
    const existingMetadata = await this.loadMetadata(hash);

    if (existingMetadata) {
      // Deduplication: Attachment with same content already exists
      console.log(`[CA] ✓ Deduplication: Hash ${hash.slice(0, 8)}... already exists (refCount: ${existingMetadata.refCount})`);

      // No need to save data again, just add reference
      // (Reference will be added by the caller via addReference)

      return hash;
    }

    // New attachment: Save data and metadata
    const hashPrefix = hash.slice(0, 2); // First 2 chars for directory organization
    const dataKey = `${this.CA_PREFIX}/${hashPrefix}/${hash}/data`;
    const metaKey = `${this.CA_PREFIX}/${hashPrefix}/${hash}/metadata`;

    // Save base64 data
    await this.adapter.save(dataKey, attachment.base64);

    // Save metadata
    const metadata: CAAttachmentMetadata = {
      hash,
      mimeType: attachment.mimeType,
      size: attachment.size,
      type: attachment.type,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      references: [], // Will be added by addReference
      refCount: 0,
    };

    await this.adapter.save(metaKey, metadata);

    // Update cache
    this.metadataCache.set(hash, metadata);

    // Update index
    await this.addToIndex(hash);

    console.log(`[CA] ✓ Saved new attachment with hash ${hash.slice(0, 8)}... (${(attachment.size / 1024).toFixed(2)} KB)`);

    return hash;
  }

  /**
   * Load attachment by hash
   *
   * @param hash - SHA-256 hash of attachment
   * @returns Attachment data or null if not found
   */
  async loadAttachment(hash: string): Promise<Attachment | null> {
    const metadata = await this.loadMetadata(hash);
    if (!metadata) {
      console.warn(`[CA] Attachment with hash ${hash.slice(0, 8)}... not found`);
      return null;
    }

    // Load base64 data
    const hashPrefix = hash.slice(0, 2);
    const dataKey = `${this.CA_PREFIX}/${hashPrefix}/${hash}/data`;
    const base64 = await this.adapter.load<string>(dataKey);

    if (!base64) {
      console.error(`[CA] Data file missing for hash ${hash.slice(0, 8)}...`);
      return null;
    }

    // Update last accessed time
    metadata.lastAccessedAt = Date.now();
    await this.saveMetadata(metadata);

    // Reconstruct Attachment object
    // Note: We don't have the original attachment ID here, caller will need to set it
    const attachment: Attachment = {
      id: hash, // Use hash as temporary ID
      type: metadata.type,
      name: `attachment-${hash.slice(0, 8)}.${this.getExtension(metadata.mimeType)}`,
      mimeType: metadata.mimeType,
      size: metadata.size,
      createdAt: new Date(metadata.createdAt).toISOString(),
      base64,
      hash,
    };

    return attachment;
  }

  /**
   * Delete attachment by hash
   *
   * Will only delete if refCount is 0. Use removeReference to decrement count.
   *
   * @param hash - SHA-256 hash of attachment
   * @returns true if deleted, false if still has references
   */
  async deleteAttachment(hash: string): Promise<boolean> {
    const metadata = await this.loadMetadata(hash);
    if (!metadata) {
      console.warn(`[CA] Cannot delete: hash ${hash.slice(0, 8)}... not found`);
      return false;
    }

    if (metadata.refCount > 0) {
      console.warn(`[CA] Cannot delete: hash ${hash.slice(0, 8)}... still has ${metadata.refCount} references`);
      return false;
    }

    // Delete data and metadata
    const hashPrefix = hash.slice(0, 2);
    const dataKey = `${this.CA_PREFIX}/${hashPrefix}/${hash}/data`;
    const metaKey = `${this.CA_PREFIX}/${hashPrefix}/${hash}/metadata`;

    await this.adapter.delete(dataKey);
    await this.adapter.delete(metaKey);

    // Remove from cache
    this.metadataCache.delete(hash);

    // Remove from index
    await this.removeFromIndex(hash);

    console.log(`[CA] ✓ Deleted attachment with hash ${hash.slice(0, 8)}... (freed ${(metadata.size / 1024).toFixed(2)} KB)`);

    return true;
  }

  /**
   * Check if attachment exists
   *
   * @param hash - SHA-256 hash of attachment
   * @returns true if exists, false otherwise
   */
  async attachmentExists(hash: string): Promise<boolean> {
    const metadata = await this.loadMetadata(hash);
    return metadata !== null;
  }

  // ========================================
  // REFERENCE COUNTING
  // ========================================

  /**
   * Add reference to attachment
   *
   * This is called when a session starts using an attachment.
   * Increments the reference count.
   *
   * @param hash - SHA-256 hash of attachment
   * @param sessionId - Session ID adding the reference
   * @param attachmentId - Attachment ID in the session
   */
  async addReference(hash: string, sessionId: string, attachmentId?: string): Promise<void> {
    const metadata = await this.loadMetadata(hash);
    if (!metadata) {
      throw new Error(`[CA] Cannot add reference: hash ${hash.slice(0, 8)}... not found`);
    }

    // Check if reference already exists
    const existing = metadata.references.find(
      ref => ref.sessionId === sessionId && ref.attachmentId === (attachmentId || hash)
    );

    if (existing) {
      console.warn(`[CA] Reference already exists for session ${sessionId}, hash ${hash.slice(0, 8)}...`);
      return;
    }

    // Add reference
    const reference: AttachmentReference = {
      sessionId,
      attachmentId: attachmentId || hash,
      addedAt: Date.now(),
    };

    metadata.references.push(reference);
    metadata.refCount = metadata.references.length;
    metadata.lastAccessedAt = Date.now();

    await this.saveMetadata(metadata);

    console.log(`[CA] ✓ Added reference for session ${sessionId}, hash ${hash.slice(0, 8)}... (refCount: ${metadata.refCount})`);
  }

  /**
   * Remove reference from attachment
   *
   * This is called when a session stops using an attachment (e.g., session deleted).
   * Decrements the reference count. If count reaches 0, attachment becomes eligible for GC.
   *
   * @param hash - SHA-256 hash of attachment
   * @param sessionId - Session ID removing the reference
   */
  async removeReference(hash: string, sessionId: string): Promise<void> {
    const metadata = await this.loadMetadata(hash);
    if (!metadata) {
      console.warn(`[CA] Cannot remove reference: hash ${hash.slice(0, 8)}... not found`);
      return;
    }

    // Remove all references from this session
    const beforeCount = metadata.references.length;
    metadata.references = metadata.references.filter(ref => ref.sessionId !== sessionId);
    const afterCount = metadata.references.length;

    if (beforeCount === afterCount) {
      console.warn(`[CA] No references found for session ${sessionId}, hash ${hash.slice(0, 8)}...`);
      return;
    }

    metadata.refCount = metadata.references.length;
    metadata.lastAccessedAt = Date.now();

    await this.saveMetadata(metadata);

    console.log(`[CA] ✓ Removed ${beforeCount - afterCount} reference(s) for session ${sessionId}, hash ${hash.slice(0, 8)}... (refCount: ${metadata.refCount})`);
  }

  /**
   * Get reference count for attachment
   *
   * @param hash - SHA-256 hash of attachment
   * @returns Reference count or 0 if not found
   */
  async getReferenceCount(hash: string): Promise<number> {
    const metadata = await this.loadMetadata(hash);
    return metadata?.refCount || 0;
  }

  /**
   * Get all references for attachment
   *
   * @param hash - SHA-256 hash of attachment
   * @returns Array of session IDs
   */
  async getReferences(hash: string): Promise<string[]> {
    const metadata = await this.loadMetadata(hash);
    if (!metadata) {
      return [];
    }
    return metadata.references.map(ref => ref.sessionId);
  }

  // ========================================
  // GARBAGE COLLECTION
  // ========================================

  /**
   * Collect garbage (delete unreferenced attachments)
   *
   * Scans all attachments and deletes those with refCount = 0.
   * This should be run periodically to reclaim storage.
   *
   * @param onProgress - Optional progress callback
   * @returns Statistics about the operation
   */
  async collectGarbage(onProgress?: ProgressCallback): Promise<GarbageCollectionResult> {
    const startTime = Date.now();
    const result: GarbageCollectionResult = {
      deleted: 0,
      freed: 0,
      errors: [],
      duration: 0,
    };

    console.log('[CA] Starting garbage collection...');

    // Get all attachment hashes
    const allHashes = await this.getAllHashes();
    const total = allHashes.length;

    console.log(`[CA] Found ${total} attachments to scan`);

    for (let i = 0; i < allHashes.length; i++) {
      const hash = allHashes[i];

      // Progress callback
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          status: `Scanning ${hash.slice(0, 8)}...`,
          percentage: ((i + 1) / total) * 100,
        });
      }

      try {
        const metadata = await this.loadMetadata(hash);
        if (!metadata) {
          console.warn(`[CA] Metadata missing for hash ${hash.slice(0, 8)}...`);
          continue;
        }

        // Delete if no references
        if (metadata.refCount === 0) {
          const deleted = await this.deleteAttachment(hash);
          if (deleted) {
            result.deleted++;
            result.freed += metadata.size;
          }
        }
      } catch (error) {
        const errorMsg = `Failed to process ${hash.slice(0, 8)}...: ${error}`;
        console.error(`[CA] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    result.duration = Date.now() - startTime;

    console.log(`[CA] ✓ Garbage collection complete: deleted ${result.deleted} attachments, freed ${(result.freed / 1024 / 1024).toFixed(2)} MB in ${result.duration}ms`);

    return result;
  }

  // ========================================
  // STATISTICS
  // ========================================

  /**
   * Get statistics about content-addressable storage
   *
   * @returns Storage statistics
   */
  async getStats(): Promise<CAStorageStats> {
    const allHashes = await this.getAllHashes();
    let totalSize = 0;
    let totalReferences = 0;

    for (const hash of allHashes) {
      const metadata = await this.loadMetadata(hash);
      if (metadata) {
        totalSize += metadata.size;
        totalReferences += metadata.refCount;
      }
    }

    // Calculate deduplication savings
    // Savings = (total references * avg size) - actual storage
    const dedupSavings = totalReferences > 0
      ? (totalReferences * (totalSize / allHashes.length)) - totalSize
      : 0;

    const avgReferences = allHashes.length > 0
      ? totalReferences / allHashes.length
      : 0;

    return {
      totalAttachments: allHashes.length,
      totalSize,
      dedupSavings: Math.max(0, dedupSavings),
      avgReferences,
      totalReferences,
    };
  }

  // ========================================
  // MIGRATION SUPPORT
  // ========================================

  /**
   * Migrate legacy attachment to content-addressable storage
   *
   * @param attachmentId - Legacy attachment ID
   * @param attachment - Attachment data
   * @param sessionId - Session ID that owns this attachment
   * @returns Hash of the migrated attachment
   */
  async migrateFromLegacy(
    attachmentId: string,
    attachment: Attachment,
    sessionId: string
  ): Promise<string> {
    // Save attachment (will deduplicate if hash already exists)
    const hash = await this.saveAttachment(attachment);

    // Add reference
    await this.addReference(hash, sessionId, attachmentId);

    console.log(`[CA] ✓ Migrated legacy attachment ${attachmentId} to hash ${hash.slice(0, 8)}...`);

    return hash;
  }

  /**
   * Get all attachment hashes
   *
   * @returns Array of all SHA-256 hashes
   */
  async getAllHashes(): Promise<string[]> {
    const index = await this.adapter.load<string[]>(this.INDEX_KEY);
    return index || [];
  }

  // ========================================
  // PRIVATE HELPERS
  // ========================================

  /**
   * Calculate SHA-256 hash from base64 data
   *
   * Uses Web Crypto API for fast hashing.
   *
   * @param base64 - Base64-encoded data
   * @returns SHA-256 hash as hex string
   */
  private async calculateHash(base64: string): Promise<string> {
    try {
      // Strip data URL prefix if present (e.g., "data:image/png;base64,")
      let base64Data = base64;
      if (base64.startsWith('data:') && base64.includes(',')) {
        base64Data = base64.split(',')[1];
        console.log('[CA] Stripped data URL prefix from base64 string');
      }

      // Additional validation: Check if string contains only valid base64 characters
      const validBase64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!validBase64Regex.test(base64Data.replace(/\s/g, ''))) {
        console.warn('[CA] Base64 string contains invalid characters, attempting cleanup');
        // Remove any whitespace or newlines
        base64Data = base64Data.replace(/\s/g, '');
      }

      // Decode base64 to bytes
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Calculate SHA-256 hash
      const hashBytes = sha256(bytes);
      const hashHex = bytesToHex(hashBytes);

      return hashHex;
    } catch (error) {
      console.error('[CA] Failed to calculate hash:', error);
      throw new Error(`Failed to calculate hash: ${error}`);
    }
  }

  /**
   * Load metadata for an attachment
   *
   * @param hash - SHA-256 hash
   * @returns Metadata or null if not found
   */
  private async loadMetadata(hash: string): Promise<CAAttachmentMetadata | null> {
    // Check cache first
    const cached = this.metadataCache.get(hash);
    if (cached) {
      this.cacheHits++;
      return cached;
    }

    this.cacheMisses++;

    // Load from storage
    const hashPrefix = hash.slice(0, 2);
    const metaKey = `${this.CA_PREFIX}/${hashPrefix}/${hash}/metadata`;
    const metadata = await this.adapter.load<CAAttachmentMetadata>(metaKey);

    if (metadata) {
      this.metadataCache.set(hash, metadata);
    }

    return metadata;
  }

  /**
   * Save metadata for an attachment
   *
   * @param metadata - Metadata to save
   */
  private async saveMetadata(metadata: CAAttachmentMetadata): Promise<void> {
    const hashPrefix = metadata.hash.slice(0, 2);
    const metaKey = `${this.CA_PREFIX}/${hashPrefix}/${metadata.hash}/metadata`;
    await this.adapter.save(metaKey, metadata);

    // Update cache
    this.metadataCache.set(metadata.hash, metadata);
  }

  /**
   * Add hash to index
   *
   * The index is a simple array of all hashes for fast scanning.
   *
   * @param hash - SHA-256 hash to add
   */
  private async addToIndex(hash: string): Promise<void> {
    const index = await this.adapter.load<string[]>(this.INDEX_KEY) || [];
    if (!index.includes(hash)) {
      index.push(hash);
      await this.adapter.save(this.INDEX_KEY, index);
    }
  }

  /**
   * Remove hash from index
   *
   * @param hash - SHA-256 hash to remove
   */
  private async removeFromIndex(hash: string): Promise<void> {
    const index = await this.adapter.load<string[]>(this.INDEX_KEY) || [];
    const filtered = index.filter(h => h !== hash);
    await this.adapter.save(this.INDEX_KEY, filtered);
  }

  /**
   * Get file extension from MIME type
   *
   * @param mimeType - MIME type
   * @returns File extension
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
   * Clear metadata cache
   */
  clearCache(): void {
    this.metadataCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    console.log('[CA] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;

    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      size: this.metadataCache.size,
      hitRate,
    };
  }
}

/**
 * Get singleton instance (for convenience)
 */
let instance: ContentAddressableStorage | null = null;

export async function getCAStorage(): Promise<ContentAddressableStorage> {
  if (instance) {
    return instance;
  }

  const { getStorage } = await import('./index');
  const adapter = await getStorage();
  instance = new ContentAddressableStorage(adapter);
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetCAStorage(): void {
  instance = null;
}
