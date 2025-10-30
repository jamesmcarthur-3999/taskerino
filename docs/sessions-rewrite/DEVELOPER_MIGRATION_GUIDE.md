# Developer Migration Guide - Phase 4 Storage

**Version**: 1.0.0
**Date**: October 24, 2025
**Audience**: Taskerino Developers
**Phase**: 4 - Storage Rewrite

---

## Overview

This guide helps developers migrate from Phase 3 (monolithic storage) to Phase 4 (chunked + CA + indexes + cache).

### What Changed in Phase 4

| Component | Before | After |
|-----------|--------|-------|
| Session Storage | Monolithic JSON | Chunked metadata + chunks |
| Attachment Storage | Direct storage | Content-addressable (SHA-256) |
| Search | Linear scan | Inverted indexes |
| Caching | None | LRU cache (>90% hit rate) |
| Save Operations | Blocking (200-500ms) | Queued (0ms) |
| Compression | None | Background worker |

---

## API Changes

### ChunkedSessionStorage API

**New Service** (replaces direct storage access):

```typescript
// ❌ OLD (Phase 3):
import { getStorage } from '@/services/storage';
const storage = await getStorage();
const session = await storage.load(`sessions/${sessionId}`);

// ✅ NEW (Phase 4):
import { getChunkedStorage } from '@/services/storage/ChunkedSessionStorage';
const chunkedStorage = await getChunkedStorage();
const session = await chunkedStorage.loadFullSession(sessionId);
```

**Load Metadata Only** (for list views):

```typescript
// ❌ OLD (loads all data):
const sessions = await storage.load('sessions');

// ✅ NEW (metadata only, 20-30x faster):
const metadata = await chunkedStorage.loadAllMetadata();
```

**Append Operations** (for active sessions):

```typescript
// ❌ OLD (load → modify → save):
const session = await storage.load(`sessions/${sessionId}`);
session.screenshots.push(newScreenshot);
await storage.save(`sessions/${sessionId}`, session);

// ✅ NEW (append directly, no load):
await chunkedStorage.appendScreenshot(sessionId, newScreenshot);
```

### ContentAddressableStorage API

**New Service** (for attachments):

```typescript
// ❌ OLD (direct attachment storage):
import { attachmentStorage } from '@/services/attachmentStorage';
await attachmentStorage.saveAttachment(attachment);

// ✅ NEW (content-addressable with deduplication):
import { getCAStorage } from '@/services/storage/ContentAddressableStorage';
const caStorage = await getCAStorage();
const hash = await caStorage.saveAttachment(attachment);
await caStorage.addReference(hash, sessionId, attachmentId);
```

**Reference Counting**:

```typescript
// When deleting session:
for (const screenshot of session.screenshots) {
  if (screenshot.attachmentHash) {
    await caStorage.removeReference(screenshot.attachmentHash, sessionId);
    // Attachment auto-deleted if refCount reaches 0
  }
}
```

### InvertedIndexManager API

**New Service** (for search):

```typescript
// ❌ OLD (linear scan):
const filtered = sessions.filter(s =>
  s.name.toLowerCase().includes(query.toLowerCase())
);

// ✅ NEW (indexed search, 20-500x faster):
import { getInvertedIndexManager } from '@/services/storage/InvertedIndexManager';
const indexManager = await getInvertedIndexManager();
const result = await indexManager.search({
  text: query,
  tags: selectedTags,
  dateRange: { start, end },
  operator: 'AND'
});
```

**Index Updates**:

```typescript
// After session creation/update:
await indexManager.updateSession(session);

// After session deletion:
await indexManager.removeSession(sessionId);
```

---

## Code Examples

### Example 1: Session List View

**Before (Phase 3)**:
```typescript
function SessionListView() {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    async function loadSessions() {
      const storage = await getStorage();
      const allSessions = await storage.load('sessions') || [];
      setSessions(allSessions);  // Loads ALL data (slow)
    }
    loadSessions();
  }, []);

  return (
    <div>
      {sessions.map(session => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}
```

**After (Phase 4)**:
```typescript
function SessionListView() {
  const [metadata, setMetadata] = useState<SessionMetadata[]>([]);

  useEffect(() => {
    async function loadMetadata() {
      const chunkedStorage = await getChunkedStorage();
      const allMetadata = await chunkedStorage.loadAllMetadata();
      setMetadata(allMetadata);  // Metadata only (20-30x faster)
    }
    loadMetadata();
  }, []);

  return (
    <div>
      {metadata.map(meta => (
        <SessionCard key={meta.id} metadata={meta} />
      ))}
    </div>
  );
}
```

### Example 2: Session Detail View

**Before (Phase 3)**:
```typescript
function SessionDetailView({ sessionId }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    async function loadSession() {
      const storage = await getStorage();
      const fullSession = await storage.load(`sessions/${sessionId}`);
      setSession(fullSession);  // Loads all at once (slow)
    }
    loadSession();
  }, [sessionId]);

  return <div>{/* Render session */}</div>;
}
```

**After (Phase 4)**:
```typescript
function SessionDetailView({ sessionId }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    async function loadSession() {
      const chunkedStorage = await getChunkedStorage();

      // Option 1: Progressive load (faster initial render)
      const metadata = await chunkedStorage.loadMetadata(sessionId);
      setSession({ ...metadata, screenshots: [], audioSegments: [] });

      // Load chunks as needed
      const fullSession = await chunkedStorage.loadFullSession(sessionId);
      setSession(fullSession);

      // Option 2: Load full session (still 3-5x faster than Phase 3)
      // const fullSession = await chunkedStorage.loadFullSession(sessionId);
      // setSession(fullSession);
    }
    loadSession();
  }, [sessionId]);

  return <div>{/* Render session */}</div>;
}
```

### Example 3: Active Session Recording

**Before (Phase 3)**:
```typescript
async function addScreenshot(sessionId: string, screenshot: SessionScreenshot) {
  const storage = await getStorage();

  // Load entire session
  const session = await storage.load(`sessions/${sessionId}`);

  // Add screenshot
  session.screenshots.push(screenshot);

  // Save entire session (blocks UI for 200-500ms)
  await storage.save(`sessions/${sessionId}`, session);
}
```

**After (Phase 4)**:
```typescript
async function addScreenshot(sessionId: string, screenshot: SessionScreenshot) {
  const chunkedStorage = await getChunkedStorage();

  // Append screenshot (no load required, 0ms UI blocking)
  await chunkedStorage.appendScreenshot(sessionId, screenshot);

  // Auto-queued via PersistenceQueue
  // Auto-cached via LRUCache
  // Auto-indexed via InvertedIndexManager
}
```

### Example 4: Search Implementation

**Before (Phase 3)**:
```typescript
function searchSessions(query: string, sessions: Session[]): Session[] {
  return sessions.filter(session => {
    const searchText = `${session.name} ${session.description || ''}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  });
  // O(n) linear scan - slow for large datasets
}
```

**After (Phase 4)**:
```typescript
async function searchSessions(query: string): Promise<SessionMetadata[]> {
  const indexManager = await getInvertedIndexManager();
  const chunkedStorage = await getChunkedStorage();

  // Search indexes (O(log n) - 20-500x faster)
  const result = await indexManager.search({
    text: query,
    operator: 'AND'
  });

  // Load metadata from cache (>90% hit rate)
  const metadata = await Promise.all(
    result.sessionIds.map(id => chunkedStorage.loadMetadata(id))
  );

  return metadata;
}
```

### Example 5: Attachment Handling

**Before (Phase 3)**:
```typescript
async function saveScreenshotAttachment(
  session: Session,
  screenshot: SessionScreenshot,
  blob: Blob
) {
  const attachment = await attachmentStorage.createAttachment({
    type: 'image',
    name: `screenshot-${Date.now()}.png`,
    mimeType: 'image/png',
    size: blob.size,
    base64: await blobToBase64(blob)
  });

  screenshot.attachmentId = attachment.id;

  // No deduplication - duplicates waste storage
}
```

**After (Phase 4)**:
```typescript
async function saveScreenshotAttachment(
  sessionId: string,
  screenshot: SessionScreenshot,
  blob: Blob
) {
  const caStorage = await getCAStorage();

  const attachment: Attachment = {
    id: generateId(),
    type: 'image',
    name: `screenshot-${Date.now()}.png`,
    mimeType: 'image/png',
    size: blob.size,
    base64: await blobToBase64(blob),
    createdAt: Date.now()
  };

  // Save to CA storage (auto-deduplicates)
  const hash = await caStorage.saveAttachment(attachment);

  // Add reference
  await caStorage.addReference(hash, sessionId, attachment.id);

  // Store hash in screenshot
  screenshot.attachmentId = attachment.id;
  screenshot.attachmentHash = hash;

  // 30-50% storage savings via deduplication
}
```

---

## Testing Changes

### Unit Test Updates

**Before (Phase 3)**:
```typescript
describe('SessionStorage', () => {
  it('should save session', async () => {
    const storage = await getStorage();
    await storage.save(`sessions/${session.id}`, session);

    const loaded = await storage.load(`sessions/${session.id}`);
    expect(loaded).toEqual(session);
  });
});
```

**After (Phase 4)**:
```typescript
describe('ChunkedSessionStorage', () => {
  it('should save session', async () => {
    const chunkedStorage = await getChunkedStorage();
    await chunkedStorage.saveFullSession(session);

    const loaded = await chunkedStorage.loadFullSession(session.id);
    expect(loaded).toEqual(session);
  });

  it('should load metadata only', async () => {
    const metadata = await chunkedStorage.loadMetadata(session.id);
    expect(metadata.id).toBe(session.id);
    expect(metadata.name).toBe(session.name);
    // Screenshots/audio not loaded
  });
});
```

### Mock Strategies

**Mocking ChunkedSessionStorage**:
```typescript
vi.mock('@/services/storage/ChunkedSessionStorage', () => ({
  getChunkedStorage: vi.fn(() => ({
    loadMetadata: vi.fn(),
    saveMetadata: vi.fn(),
    loadFullSession: vi.fn(),
    saveFullSession: vi.fn(),
    appendScreenshot: vi.fn(),
  }))
}));
```

**Mocking InvertedIndexManager**:
```typescript
vi.mock('@/services/storage/InvertedIndexManager', () => ({
  getInvertedIndexManager: vi.fn(() => ({
    search: vi.fn(() => ({
      sessionIds: ['session-1', 'session-2'],
      totalResults: 2
    })),
    updateSession: vi.fn(),
    removeSession: vi.fn(),
  }))
}));
```

### Performance Testing

**Phase 4 Performance Tests**:
```typescript
describe('Performance', () => {
  it('should load metadata in <100ms', async () => {
    const start = performance.now();
    await chunkedStorage.loadAllMetadata();
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('should search in <100ms', async () => {
    const start = performance.now();
    await indexManager.search({ text: 'test' });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('should have >90% cache hit rate', async () => {
    // Warm up cache
    for (let i = 0; i < 100; i++) {
      await chunkedStorage.loadMetadata(`session-${i % 20}`);
    }

    const stats = chunkedStorage.getCacheStats();
    const hitRate = stats.hits / (stats.hits + stats.misses);

    expect(hitRate).toBeGreaterThan(0.9);
  });
});
```

---

## Deployment

### Migration Steps

**Step 1: Backup Data**
```bash
# Export current data
npm run export-data -- --output backup-$(date +%Y%m%d).json

# Verify backup
npm run verify-backup -- --file backup-$(date +%Y%m%d).json
```

**Step 2: Run Migration**
```typescript
import { migrateToPhase4Storage } from '@/migrations/migrate-to-phase4-storage';
import { createRollbackPoint } from '@/services/storage/StorageRollback';

// Create rollback point
const rollbackPoint = await createRollbackPoint('pre-phase4-migration');

try {
  // Run migration (dry run first)
  const dryRunResult = await migrateToPhase4Storage({
    dryRun: true,
    verbose: true
  });

  console.log('Dry run results:', dryRunResult);

  // If dry run successful, run actual migration
  const result = await migrateToPhase4Storage({
    verbose: true,
    onProgress: (progress) => {
      console.log(`Migration progress: ${progress.percentage}%`);
    }
  });

  console.log('Migration complete:', result);
} catch (error) {
  console.error('Migration failed:', error);
  // Rollback will happen automatically
}
```

**Step 3: Verify Migration**
```typescript
import { verifyPhase4Migration } from '@/migrations/migrate-to-phase4-storage';

const verification = await verifyPhase4Migration();

if (verification.success) {
  console.log('Migration verified successfully');
} else {
  console.error('Verification failed:', verification.errors);
  // Consider rollback
}
```

**Step 4: Monitor Production**
```typescript
// Monitor cache hit rate
const cacheStats = chunkedStorage.getCacheStats();
console.log(`Cache hit rate: ${cacheStats.hitRate}%`);

// Monitor search performance
const searchStart = performance.now();
await indexManager.search({ text: 'test' });
console.log(`Search time: ${performance.now() - searchStart}ms`);

// Monitor storage size
const caStats = await caStorage.getStats();
console.log(`Deduplication savings: ${caStats.dedupSavings}%`);
```

### Rollback Procedure

**If migration fails**:
```typescript
import { rollbackToPhase3Storage } from '@/services/storage/StorageRollback';

// Rollback to Phase 3
const result = await rollbackToPhase3Storage(true);  // Requires confirmation

if (result.success) {
  console.log('Rollback successful');
  console.log('Sessions restored:', result.sessionsRestored);
} else {
  console.error('Rollback failed:', result.errors);
}
```

### Verification Checklist

- [ ] All sessions migrated to chunked format
- [ ] All attachments in CA storage
- [ ] All indexes built and valid
- [ ] Cache hit rate >90%
- [ ] Search time <100ms
- [ ] UI blocking 0ms
- [ ] No data loss (verify checksums)
- [ ] Rollback point created
- [ ] Production monitoring active

---

## Troubleshooting

### Common Issues

**Issue 1: Slow Session Loading**
```typescript
// Check cache hit rate
const stats = chunkedStorage.getCacheStats();
if (stats.hitRate < 0.8) {
  // Increase cache size
  chunkedStorage.setCacheSize(200 * 1024 * 1024); // 200MB
}
```

**Issue 2: Search Still Slow**
```typescript
// Rebuild indexes
const indexManager = await getInvertedIndexManager();
await indexManager.rebuildIndexes();

// Verify integrity
const verification = await indexManager.verifyIntegrity(sessions);
if (!verification.valid) {
  console.error('Index integrity issues:', verification.errors);
}
```

**Issue 3: High Storage Usage**
```typescript
// Run garbage collection
const caStorage = await getCAStorage();
const gcResult = await caStorage.collectGarbage();
console.log(`Freed: ${gcResult.freed} bytes`);

// Enable compression
// Settings > Background Compression > Enable
```

**Issue 4: Migration Failed**
```typescript
// Check error logs
const status = await getMigrationStatus();
console.log('Migration errors:', status.errors);

// Rollback if needed
await rollbackToPhase3Storage(true);
```

---

## Best Practices

### 1. Always Load Metadata First

```typescript
// ✅ GOOD: Load metadata for list, full session on demand
const metadata = await chunkedStorage.loadAllMetadata();
// User clicks session
const session = await chunkedStorage.loadFullSession(selectedId);

// ❌ BAD: Load all full sessions upfront
const sessions = await Promise.all(
  ids.map(id => chunkedStorage.loadFullSession(id))
);
```

### 2. Use Content-Addressable Storage for All Attachments

```typescript
// ✅ GOOD: Use CA storage for deduplication
const hash = await caStorage.saveAttachment(attachment);
await caStorage.addReference(hash, sessionId, attachmentId);

// ❌ BAD: Store duplicates
await attachmentStorage.saveAttachment(attachment);
```

### 3. Update Indexes on Every Session Change

```typescript
// ✅ GOOD: Update indexes immediately
await chunkedStorage.saveMetadata(updatedMetadata);
await indexManager.updateSession(session);

// ❌ BAD: Forget to update indexes
await chunkedStorage.saveMetadata(updatedMetadata);
// Indexes now stale
```

### 4. Monitor Performance in Production

```typescript
// Set up monitoring
setInterval(async () => {
  const cacheStats = chunkedStorage.getCacheStats();
  const caStats = await caStorage.getStats();
  const queueStats = queue.getStats();

  if (cacheStats.hitRate < 0.9) {
    console.warn('Low cache hit rate:', cacheStats.hitRate);
  }

  if (queueStats.pending > 100) {
    console.warn('High queue backlog:', queueStats.pending);
  }
}, 60000); // Every minute
```

### 5. Use Background Compression

```typescript
// Enable in settings
const compressionSettings = {
  enabled: true,
  mode: 'auto',
  maxCPU: 20,
  ageThresholdDays: 7,
  compressScreenshots: true
};

await saveSettings({ compression: compressionSettings });
```

---

## Summary

Phase 4 migration brings significant performance improvements with minimal code changes. Key points:

1. **Use ChunkedSessionStorage** for all session operations
2. **Load metadata only** for list views
3. **Use ContentAddressableStorage** for attachments
4. **Update InvertedIndexManager** on session changes
5. **Monitor performance** in production
6. **Test thoroughly** before deploying

For questions or issues, refer to:
- **STORAGE_ARCHITECTURE.md** - Technical architecture
- **PHASE_4_SUMMARY.md** - Overview and metrics
- **TROUBLESHOOTING.md** - Common issues and solutions
- **PERFORMANCE_TUNING.md** - Optimization guide

---

**Version**: 1.0.0
**Last Updated**: October 24, 2025
**Status**: COMPLETE
