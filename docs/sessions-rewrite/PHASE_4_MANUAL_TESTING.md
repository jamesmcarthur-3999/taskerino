# Phase 4 Manual Testing Checklist

This document provides a comprehensive manual testing checklist for Phase 4 storage features. Use this to verify the system works correctly in real-world scenarios.

---

## Prerequisites

Before starting manual testing:

- [ ] All automated tests passing (`npm test`)
- [ ] Type checking passing (`npm run type-check`)
- [ ] Dev server running (`npm run dev`)
- [ ] Browser DevTools open (Console + Network tabs)

---

## 1. Session Creation

### 1.1 Create Session with Screenshots

**Steps**:
1. Start a new session with screenshots enabled
2. Wait for 5-10 screenshots to be captured
3. End the session

**Verify**:
- [ ] Session appears in session list immediately
- [ ] Screenshots visible in session detail view
- [ ] No UI freezing during screenshot capture
- [ ] Console shows no errors

**Check**:
```javascript
// Open browser console
const storage = await import('./src/services/storage/ChunkedSessionStorage');
const chunked = new storage.ChunkedSessionStorage(await getStorage());
const metadata = await chunked.loadMetadata('YOUR-SESSION-ID');
console.log('Chunks:', metadata.chunks);
// Should show: { screenshots: { count: N, chunkCount: X, chunkSize: 20 } }
```

- [ ] Chunks created (chunkCount > 0)
- [ ] Chunk size correct (20 screenshots per chunk)

### 1.2 Create Session with Audio

**Steps**:
1. Start session with audio recording enabled
2. Speak for 1-2 minutes
3. End the session

**Verify**:
- [ ] Audio segments captured
- [ ] Transcription visible (if enabled)
- [ ] No audio glitches or dropouts
- [ ] Audio chunks created properly

**Check**:
```javascript
const metadata = await chunked.loadMetadata('YOUR-SESSION-ID');
console.log('Audio chunks:', metadata.chunks.audioSegments);
// Should show proper chunk count
```

- [ ] Audio chunks created
- [ ] ~100 segments per chunk

### 1.3 Verify Indexes Updated

**Steps**:
1. Create 2-3 sessions with different topics/tags
2. Search for sessions by text/topic/tag

**Verify**:
- [ ] Search returns correct results immediately
- [ ] Results sorted by relevance
- [ ] Search response time < 100ms

**Check**:
```javascript
const indexManager = await import('./src/services/storage/InvertedIndexManager');
const indexes = new indexManager.InvertedIndexManager(await getStorage());
const results = await indexes.search({ text: 'your-search-term' });
console.log('Search results:', results);
// Check: took < 100ms, sessionIds includes your sessions
```

- [ ] Search time < 100ms
- [ ] Correct sessions returned

### 1.4 Verify Cache Populated

**Steps**:
1. Create a session
2. Load session metadata twice

**Verify**:
- [ ] First load slower than second load
- [ ] Second load < 1ms (from cache)

**Check**:
```javascript
const storage = await import('./src/services/storage/ChunkedSessionStorage');
const chunked = new storage.ChunkedSessionStorage(await getStorage());

// Clear cache
chunked.clearCache();
chunked.resetCacheStats();

// First load (cold)
console.time('cold-load');
await chunked.loadMetadata('YOUR-SESSION-ID');
console.timeEnd('cold-load');

// Second load (hot)
console.time('hot-load');
await chunked.loadMetadata('YOUR-SESSION-ID');
console.timeEnd('hot-load');

const stats = chunked.getCacheStats();
console.log('Cache stats:', stats);
```

- [ ] Cold load: ~5-10ms
- [ ] Hot load: < 1ms
- [ ] Cache hit rate > 50%

---

## 2. Session Loading

### 2.1 Load Session List (Should be Fast)

**Steps**:
1. Create 20+ sessions
2. Navigate to sessions list
3. Measure load time

**Verify**:
- [ ] Session list loads in < 100ms
- [ ] All sessions visible
- [ ] Metadata displays correctly (name, date, duration)
- [ ] No missing data

**Check**:
```javascript
const storage = await import('./src/services/storage/ChunkedSessionStorage');
const chunked = new storage.ChunkedSessionStorage(await getStorage());

console.time('list-sessions');
const sessions = await chunked.listAllMetadata();
console.timeEnd('list-sessions');
console.log(`Loaded ${sessions.length} sessions`);
```

- [ ] Load time < 100ms
- [ ] All sessions present

### 2.2 Load Full Session (Should be Progressive)

**Steps**:
1. Open a large session (100+ screenshots)
2. Observe loading behavior

**Verify**:
- [ ] Session opens immediately (metadata loads first)
- [ ] Screenshots load progressively (not all at once)
- [ ] No UI blocking during load
- [ ] Smooth scrolling while loading

**Check Browser Network Tab**:
- [ ] Multiple chunk requests (not one huge request)
- [ ] Chunks load in parallel
- [ ] Total load time < 1s

### 2.3 Verify Cached vs Uncached Performance

**Steps**:
1. Load a session (cold start)
2. Navigate away
3. Load same session again (warm start)

**Verify**:
- [ ] First load: ~500ms-1s
- [ ] Second load: ~100-200ms (from cache)
- [ ] Visible performance difference

**Check**:
```javascript
// See cache stats
const stats = chunked.getCacheStats();
console.log('Cache performance:', {
  hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
  hits: stats.hits,
  misses: stats.misses,
  size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`
});
```

- [ ] Hit rate > 70%
- [ ] Cache size < 100MB

---

## 3. Search

### 3.1 Search by Text

**Steps**:
1. Create sessions with distinct names: "Coding Session", "Meeting Notes", "Research Time"
2. Search for "coding"

**Verify**:
- [ ] Only "Coding Session" returned
- [ ] Search time < 100ms
- [ ] Results ranked by relevance

**Measure**:
```javascript
const indexManager = await import('./src/services/storage/InvertedIndexManager');
const indexes = new indexManager.InvertedIndexManager(await getStorage());

const results = await indexes.search({ text: 'coding' });
console.log('Search results:', results);
```

- [ ] Correct results
- [ ] took < 100ms

### 3.2 Search by Topic

**Steps**:
1. Create sessions with categories: "Development", "Meeting", "Research"
2. Search by category: "Development"

**Verify**:
- [ ] Only Development sessions returned
- [ ] Search time < 50ms

**Measure**:
```javascript
const results = await indexes.search({ category: 'Development' });
console.log('Topic search:', results);
```

- [ ] took < 50ms
- [ ] Correct filtering

### 3.3 Search by Date Range

**Steps**:
1. Create sessions spread over several weeks
2. Search for "last 7 days"

**Verify**:
- [ ] Only recent sessions returned
- [ ] Date filtering accurate
- [ ] Search time < 50ms

**Measure**:
```javascript
const now = Date.now();
const results = await indexes.search({
  dateRange: {
    start: now - 7 * 86400000,
    end: now
  }
});
console.log('Date search:', results);
```

- [ ] took < 50ms
- [ ] Correct date range

### 3.4 Verify <100ms Response Time

**Steps**:
1. Build index with 100+ sessions
2. Perform complex search (text + category + tags)

**Verify**:
- [ ] Search completes in < 100ms
- [ ] Results accurate
- [ ] No UI lag

**Measure**:
```javascript
const results = await indexes.search({
  text: 'session',
  category: 'Development',
  tags: ['important'],
  operator: 'AND'
});
console.log('Complex search took:', results.took, 'ms');
```

- [ ] took < 100ms
- [ ] Multiple filters applied correctly

---

## 4. Migration

### 4.1 Run Full Migration

**Prerequisites**:
- Have some sessions in legacy format (pre-Phase 4)

**Steps**:
1. Run migration script: `npm run migrate-phase4`
2. Wait for completion
3. Check console for progress

**Verify**:
- [ ] All sessions migrated successfully
- [ ] No data loss
- [ ] Migration progress visible
- [ ] Error handling for failed sessions

**Check**:
```javascript
// After migration
const chunked = new ChunkedSessionStorage(await getStorage());
const sessions = await chunked.listAllMetadata();
console.log('Migrated sessions:', sessions.length);

// Verify chunked format
for (const session of sessions.slice(0, 5)) {
  const isChunked = await chunked.isChunked(session.id);
  console.log(`${session.name}: chunked=${isChunked}`);
}
```

- [ ] All sessions chunked
- [ ] storageVersion === 1

### 4.2 Verify All Data Migrated

**Steps**:
1. Compare session count before/after migration
2. Spot-check 5-10 sessions for data integrity

**Verify**:
- [ ] Session count unchanged
- [ ] All screenshots preserved
- [ ] All audio segments preserved
- [ ] All metadata preserved
- [ ] Tags/categories intact

**Check Each Session**:
```javascript
const session = await chunked.loadFullSession('SESSION-ID');
console.log('Session data:', {
  name: session.name,
  screenshots: session.screenshots.length,
  audio: session.audioSegments?.length,
  tags: session.tags,
  category: session.category
});
```

- [ ] All data present
- [ ] No corruption

### 4.3 Verify Storage Reduction Achieved

**Steps**:
1. Check storage size before migration
2. Run migration
3. Check storage size after

**Verify**:
- [ ] Storage size reduced by 50%+
- [ ] Attachments deduplicated
- [ ] Sessions compressed

**Measure**:
```javascript
// Check storage stats
const caStorage = await import('./src/services/storage/ContentAddressableStorage');
const ca = new caStorage.ContentAddressableStorage(await getStorage());
const stats = await ca.getStats();

console.log('Storage stats:', {
  totalAttachments: stats.totalAttachments,
  totalSize: `${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`,
  dedupSavings: `${(stats.dedupSavings / 1024 / 1024).toFixed(2)} MB`,
  avgReferences: stats.avgReferences.toFixed(2)
});
```

- [ ] Deduplication savings > 30%
- [ ] Avg references > 1.0 (proves deduplication)

---

## 5. Rollback

### 5.1 Create Rollback Point

**Steps**:
1. Before migration, create backup
2. Note session count and total storage size

**Verify**:
- [ ] Backup created successfully
- [ ] Backup includes all data

**Manual Backup** (if needed):
```bash
# Browser: Export IndexedDB
# Open DevTools > Application > Storage > IndexedDB > Export

# Tauri: Backup storage directory
cp -r ~/Library/Application\ Support/com.taskerino.app/storage ~/Desktop/taskerino-backup
```

### 5.2 Execute Rollback

**Steps**:
1. Run rollback script: `npm run rollback-phase4`
2. Wait for completion

**Verify**:
- [ ] Rollback completes successfully
- [ ] All data restored
- [ ] App still functional

### 5.3 Verify Data Restored

**Steps**:
1. Check session count after rollback
2. Compare with pre-migration count
3. Spot-check session data

**Verify**:
- [ ] Session count matches pre-migration
- [ ] All data intact
- [ ] No corruption

**Check**:
```javascript
const sessions = await chunked.listAllMetadata();
console.log('Sessions after rollback:', sessions.length);

// Verify legacy format
const isChunked = await chunked.isChunked(sessions[0].id);
console.log('Is chunked after rollback?', isChunked); // Should be false
```

- [ ] Data matches backup
- [ ] Legacy format restored

---

## 6. Performance

### 6.1 Measure Session Load Time

**Steps**:
1. Create a large session (200 screenshots)
2. Clear cache
3. Measure load time

**Verify**:
- [ ] Full session load < 1s
- [ ] Metadata load < 10ms
- [ ] Progressive loading works

**Measure**:
```javascript
chunked.clearCache();

// Metadata only
console.time('metadata-load');
const metadata = await chunked.loadMetadata('SESSION-ID');
console.timeEnd('metadata-load'); // Should be < 10ms

// Full session
console.time('full-load');
const session = await chunked.loadFullSession('SESSION-ID');
console.timeEnd('full-load'); // Should be < 1000ms
```

- [ ] Metadata < 10ms
- [ ] Full session < 1s

### 6.2 Measure Search Time

**Steps**:
1. Build index with 100+ sessions
2. Perform various searches
3. Measure response times

**Verify**:
- [ ] Text search < 100ms
- [ ] Topic search < 50ms
- [ ] Date search < 50ms
- [ ] Complex query < 100ms

**Measure**:
```javascript
const tests = [
  { name: 'Text search', query: { text: 'session' } },
  { name: 'Topic search', query: { category: 'Development' } },
  { name: 'Date search', query: { dateRange: { start: Date.now() - 30*86400000, end: Date.now() } } },
  { name: 'Complex query', query: { text: 'session', category: 'Development', tags: ['important'] } }
];

for (const test of tests) {
  const results = await indexes.search(test.query);
  console.log(`${test.name}: ${results.took.toFixed(2)}ms`);
}
```

- [ ] All searches meet targets

### 6.3 Measure Storage Size Reduction

**Steps**:
1. Check baseline storage size (before Phase 4)
2. Migrate to Phase 4
3. Compare sizes

**Verify**:
- [ ] Reduction ≥ 50%
- [ ] Deduplication working
- [ ] Compression effective

**Measure**:
```javascript
// Check compression stats
for (const session of sessions.slice(0, 5)) {
  const stats = await chunked.getSessionCompressionStats(session.id);
  console.log(`${session.name}:`, {
    compressed: stats.compressed,
    ratio: `${(stats.ratio * 100).toFixed(1)}%`,
    savings: `${((1 - stats.ratio) * 100).toFixed(1)}%`
  });
}
```

- [ ] Compression ratio 60-70%
- [ ] Overall reduction ≥ 50%

### 6.4 Verify 0ms UI Blocking

**Steps**:
1. Create session while using app
2. Edit notes while session active
3. Navigate between zones

**Verify**:
- [ ] No UI freezing
- [ ] Smooth scrolling maintained
- [ ] Typing remains responsive
- [ ] Background saves don't block

**Monitor**:
- Open DevTools > Performance tab
- Record while using app
- Check for long tasks (> 50ms)

- [ ] No long tasks during saves
- [ ] Frame rate remains 60fps

---

## 7. Edge Cases

### 7.1 Very Large Session (500+ screenshots)

**Steps**:
1. Create session with 500+ screenshots
2. Load and verify

**Verify**:
- [ ] Session loads successfully
- [ ] No memory issues
- [ ] Performance acceptable

### 7.2 Rapid Session Creation/Deletion

**Steps**:
1. Rapidly create and delete 10 sessions
2. Check for memory leaks

**Verify**:
- [ ] No errors
- [ ] Memory returns to baseline
- [ ] Cache evicts properly

### 7.3 Concurrent Operations

**Steps**:
1. Start a session
2. While recording, search sessions
3. Load another session

**Verify**:
- [ ] All operations succeed
- [ ] No race conditions
- [ ] Data consistency maintained

### 7.4 Offline/Online Transitions

**Steps** (Tauri only):
1. Go offline
2. Create/edit sessions
3. Go back online

**Verify**:
- [ ] Offline changes queued
- [ ] Sync on reconnection
- [ ] No data loss

---

## 8. Browser Compatibility

Test in each supported browser:

### Chrome/Edge
- [ ] All features work
- [ ] Performance targets met
- [ ] IndexedDB functioning

### Firefox
- [ ] All features work
- [ ] Performance acceptable
- [ ] IndexedDB functioning

### Safari (if supported)
- [ ] All features work
- [ ] Performance acceptable
- [ ] IndexedDB functioning

---

## 9. Regression Tests

### 9.1 Legacy Features Still Work

**Verify**:
- [ ] Session recording works
- [ ] Screenshot capture works
- [ ] Audio recording works
- [ ] AI analysis works
- [ ] Task extraction works
- [ ] Note creation works

### 9.2 UI Components Work

**Verify**:
- [ ] Session list displays
- [ ] Session detail view works
- [ ] Search UI responsive
- [ ] Filters work
- [ ] Morphing canvas renders

### 9.3 No New Bugs Introduced

**Check**:
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] No network errors
- [ ] No memory leaks

---

## 10. Final Verification

### Checklist Summary

- [ ] All session creation scenarios pass
- [ ] All loading scenarios pass
- [ ] All search scenarios pass
- [ ] Migration successful
- [ ] Rollback successful
- [ ] All performance targets met
- [ ] Edge cases handled
- [ ] Browser compatibility verified
- [ ] No regressions

### Performance Targets Met

- [ ] Session load < 1s
- [ ] Search < 100ms
- [ ] Storage reduction ≥ 50%
- [ ] UI blocking = 0ms
- [ ] Cache hit rate > 90%
- [ ] Compression 60-70%

### Sign-Off

**Tested By**: _______________________

**Date**: _______________________

**Environment**:
- OS: _______________________
- Browser: _______________________
- App Version: _______________________

**Notes/Issues**:
_______________________________________________________
_______________________________________________________
_______________________________________________________

---

## Appendix: Useful Commands

### Clear All Storage (Reset)

```javascript
// Browser Console
const storage = await import('./src/services/storage');
const adapter = await storage.getStorage();
// Note: No clear() method on adapter, use browser DevTools to clear IndexedDB
// DevTools > Application > Storage > IndexedDB > Right-click > Delete

// Or programmatically:
indexedDB.deleteDatabase('taskerino-storage');
```

### Check Storage Size

```javascript
// Browser
navigator.storage.estimate().then(estimate => {
  console.log('Storage usage:', {
    usage: `${(estimate.usage / 1024 / 1024).toFixed(2)} MB`,
    quota: `${(estimate.quota / 1024 / 1024).toFixed(2)} MB`,
    percent: `${((estimate.usage / estimate.quota) * 100).toFixed(1)}%`
  });
});
```

### Monitor Queue Stats

```javascript
const queue = await import('./src/services/storage/PersistenceQueue');
const q = queue.getPersistenceQueue();

setInterval(() => {
  const stats = q.getStats();
  console.log('Queue:', stats);
}, 1000);
```

### Monitor Cache Stats

```javascript
const chunked = new ChunkedSessionStorage(await getStorage());

setInterval(() => {
  const stats = chunked.getCacheStats();
  console.log('Cache:', {
    hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
    size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
    items: stats.items,
    evictions: stats.evictions
  });
}, 5000);
```
