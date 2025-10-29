# Troubleshooting Guide - Phase 4 Storage

**Version**: 1.0.0
**Date**: October 24, 2025
**Audience**: All Users & Developers

---

## Common Issues

### Issue 1: Slow Session Loading

**Symptoms**:
- Session list takes >2 seconds to load
- Individual sessions take >1 second to load
- UI feels sluggish

**Diagnosis**:
1. Check cache hit rate: Settings > Storage > Cache Statistics
2. If hit rate <80%, cache is too small
3. Check storage size: May be loading too much data

**Solutions**:

**Solution 1: Increase Cache Size**
```
Settings > Storage > Cache > Max Cache Size
Recommended: 100-200MB for 8-16GB RAM systems
```

**Solution 2: Clear Cache and Rebuild**
```
Settings > Storage > Cache > Clear Cache
Restart app to warm up cache with fresh data
```

**Solution 3: Check for Memory Leaks**
```
Close and reopen app
Monitor cache size over time
If cache grows beyond max, report bug
```

**Expected After Fix**: Session loads in <500ms, cached loads <1ms

---

### Issue 2: Slow Search

**Symptoms**:
- Search takes >200ms
- Search results incomplete
- Search feels unresponsive

**Diagnosis**:
1. Check index build time
2. Run index integrity check
3. Check dataset size (>1000 sessions may be slower)

**Solutions**:

**Solution 1: Rebuild Indexes**
```typescript
// Browser console
const indexManager = await getInvertedIndexManager();
await indexManager.rebuildIndexes();
```

**Solution 2: Optimize Indexes**
```typescript
// Browser console
const result = await indexManager.optimize();
console.log('Optimization result:', result);
```

**Solution 3: Verify Index Integrity**
```typescript
// Browser console
const verification = await indexManager.verifyIntegrity(sessions);
if (!verification.valid) {
  console.error('Index errors:', verification.errors);
  await indexManager.rebuildIndexes();
}
```

**Expected After Fix**: Search completes in <100ms for 1000 sessions

---

### Issue 3: High Memory Usage

**Symptoms**:
- Browser uses >500MB RAM
- System becomes slow
- Out of memory errors

**Diagnosis**:
1. Check cache size setting
2. Check actual cache usage
3. Check for memory leaks

**Solutions**:

**Solution 1: Reduce Cache Size**
```
Settings > Storage > Cache > Max Cache Size
Reduce to 50MB or lower for low-memory systems
```

**Solution 2: Clear Cache**
```
Settings > Storage > Cache > Clear Cache
Frees memory immediately
```

**Solution 3: Restart App**
```
Close and reopen Taskerino
Memory will be reclaimed
```

**Solution 4: Check for Leaks** (Advanced)
```
1. Open Chrome DevTools > Memory
2. Take heap snapshot
3. Record for 30 seconds
4. Take another snapshot
5. Compare for growing objects
6. Report findings
```

**Expected After Fix**: Memory usage <200MB for typical usage

---

### Issue 4: Storage Quota Exceeded

**Symptoms**:
- "Storage quota exceeded" error
- Cannot save new sessions
- App warns about disk space

**Diagnosis**:
1. Check total storage size
2. Check for large sessions
3. Check garbage collection status

**Solutions**:

**Solution 1: Run Garbage Collection**
```typescript
// Browser console
const caStorage = await getCAStorage();
const result = await caStorage.collectGarbage();
console.log('Freed:', result.freed, 'bytes');
```

**Solution 2: Enable Compression**
```
Settings > Background Compression > Enable
Set Mode to Auto
Set Age Threshold to 7 days
Wait for compression to complete (may take hours)
```

**Solution 3: Delete Old Sessions**
```
Sessions > Select old sessions > Delete
Garbage collection runs automatically
```

**Solution 4: Clear Browser Storage** (Nuclear Option)
```
⚠️ WARNING: Deletes all data!

Settings > Storage > Advanced > Clear All Storage
Exports data first (recommended)
```

**Expected After Fix**: Storage usage reduced by 30-70%

---

### Issue 5: Migration Failed

**Symptoms**:
- Migration stuck at specific percentage
- Migration errors in console
- Data appears corrupted after migration

**Diagnosis**:
1. Check migration logs
2. Check storage space (need 2x current size)
3. Check for corrupted source data

**Solutions**:

**Solution 1: Check Migration Status**
```typescript
// Browser console
const status = await getMigrationStatus();
console.log('Migration status:', status);
console.log('Errors:', status.errors);
```

**Solution 2: Retry Migration**
```typescript
// Browser console
const result = await migrateToPhase4Storage({
  verbose: true,
  skipChunked: status.chunkedComplete,  // Skip completed steps
  skipCA: status.caComplete,
  skipIndexes: status.indexesComplete
});
```

**Solution 3: Rollback and Retry**
```typescript
// Browser console
await rollbackToPhase3Storage(true);
await migrateToPhase4Storage({ verbose: true });
```

**Solution 4: Manual Recovery** (Advanced)
```typescript
// Export data
const allSessions = await storage.load('sessions');
const backup = JSON.stringify(allSessions);
// Save backup to file

// Clear storage
await storage.clear();

// Import backup
await storage.save('sessions', JSON.parse(backup));

// Retry migration
await migrateToPhase4Storage({ verbose: true });
```

**Expected After Fix**: Migration completes successfully, all data intact

---

## Debugging Tools

### Cache Statistics

**Access**: Settings > Storage > Cache Statistics

**What to Look For**:
- **Hit Rate**: Should be >90%
- **Memory Usage**: Should not exceed max size
- **Evictions**: High count may indicate cache too small
- **Oldest Entry**: Should not be too old (>1 hour)

**Interpretation**:
```
Hit Rate: 92.3% ✅ Good
Memory Usage: 45.2 MB / 100 MB ✅ Good
Cached Items: 234 ✅ Good
Evictions: 12 ✅ Normal

Hit Rate: 67.8% ⚠️ Low - Increase cache size
Memory Usage: 98.7 MB / 100 MB ⚠️ Near limit - May need more
Evictions: 823 ⚠️ High - Cache too small
```

### Queue Statistics

**Access**: Settings > Storage > Queue Statistics

**What to Look For**:
- **Pending**: Should be <10
- **Processing**: Should be 0-1
- **Completed**: Growing steadily
- **Failed**: Should be 0

**Interpretation**:
```
Pending: 3 ✅ Normal
Processing: 1 ✅ Normal
Completed: 1,234 ✅ Good
Failed: 0 ✅ Perfect

Pending: 157 ⚠️ Backlog - Check for issues
Processing: 0 ⚠️ Queue may be stuck
Failed: 12 ❌ Problems - Check logs
```

### Index Integrity Check

**Run Check**:
```typescript
const indexManager = await getInvertedIndexManager();
const sessions = await chunkedStorage.loadAllMetadata();
const verification = await indexManager.verifyIntegrity(sessions);

if (verification.valid) {
  console.log('✅ Indexes valid');
} else {
  console.error('❌ Index errors:', verification.errors);
  // Rebuild
  await indexManager.rebuildIndexes();
}
```

**Common Errors**:
- `Missing index entry for session X` → Rebuild indexes
- `Orphaned index entry for session Y` → Optimize indexes
- `Index count mismatch` → Rebuild indexes

### Migration Status

**Check Status**:
```typescript
const status = await getMigrationStatus();
console.log('Migration status:', status);
```

**Status Fields**:
- `completed`: true if migration done
- `chunkedComplete`: true if step 1 done
- `caComplete`: true if step 2 done
- `indexesComplete`: true if step 3 done
- `compressionComplete`: true if step 4 done
- `errors`: Array of error messages
- `timestamp`: When migration ran

---

## Error Messages

### Error: "Storage quota exceeded"

**Cause**: Not enough disk space

**Solutions**:
1. Run garbage collection
2. Enable compression
3. Delete old sessions
4. Clear browser cache (non-Taskerino data)

**Prevention**: Enable auto-compression, set age threshold to 7-14 days

---

### Error: "Cache size limit exceeded"

**Cause**: Cache configured too large for available RAM

**Solutions**:
1. Reduce cache size in settings
2. Clear cache
3. Restart app

**Prevention**: Configure cache to 10-20% of available RAM

---

### Error: "Index rebuild failed"

**Cause**: Corrupted index data or out of memory

**Solutions**:
1. Clear indexes: `await indexManager.clear()`
2. Rebuild: `await indexManager.rebuildIndexes()`
3. Check available memory
4. Restart app and retry

**Prevention**: Regular index optimization (weekly)

---

### Error: "Migration verification failed"

**Cause**: Data corruption during migration

**Solutions**:
1. Rollback: `await rollbackToPhase3Storage(true)`
2. Check source data integrity
3. Retry migration with verbose logging
4. Report bug if persists

**Prevention**: Always run dry run before actual migration

---

### Error: "Attachment not found"

**Cause**: Attachment deleted but still referenced, or CA storage corruption

**Solutions**:
1. Check attachment exists: `await caStorage.attachmentExists(hash)`
2. Check references: `await caStorage.getReferences(hash)`
3. Remove bad reference: `await caStorage.removeReference(hash, sessionId)`
4. Rebuild session if needed

**Prevention**: Always use CA storage API, never delete attachments directly

---

## Performance Issues

### Symptom: App feels sluggish

**Diagnosis Checklist**:
- [ ] Check cache hit rate (should be >90%)
- [ ] Check queue backlog (should be <10 pending)
- [ ] Check memory usage (should be <200MB)
- [ ] Check CPU usage (should be <10% when idle)

**Solutions**:
1. Increase cache size
2. Clear queue: `queue.clear()`
3. Restart app
4. Disable background compression temporarily

---

### Symptom: High CPU usage

**Possible Causes**:
- Background compression running
- Migration in progress
- Large garbage collection
- Index rebuild

**Solutions**:
1. Check compression settings, reduce Max CPU
2. Pause migration: `migration.pause()`
3. Check console for active operations
4. Restart app if stuck

---

### Symptom: High network usage

**Note**: Phase 4 is local-only storage, no network usage expected

**If seeing network activity**:
1. Check for cloud sync (if enabled in future)
2. Check for analytics/telemetry
3. May be unrelated to storage system

---

## Data Integrity Issues

### Symptom: Sessions appear corrupted

**Verification Steps**:
1. Load session: `const session = await chunkedStorage.loadFullSession(id)`
2. Check for missing fields
3. Check screenshots/audio arrays
4. Verify timestamps

**Recovery**:
1. If Phase 4 migration not complete: Rollback
2. If complete: Load from backup if available
3. Manual repair if specific field corrupted
4. Report bug with details

---

### Symptom: Missing attachments

**Diagnosis**:
1. Check if attachment hash stored: `screenshot.attachmentHash`
2. Check if attachment exists: `await caStorage.attachmentExists(hash)`
3. Check reference count: `await caStorage.getReferenceCount(hash)`

**Recovery**:
1. If attachment exists but not referenced: Re-add reference
2. If attachment deleted: Cannot recover (no backup)
3. Consider attachment retention policy

**Prevention**: Always add reference when saving attachment

---

## Recovery Procedures

### Procedure 1: Full Rollback to Phase 3

**When to Use**: Critical data corruption, migration failure, need to revert

**Steps**:
```typescript
// 1. Create safety backup
const sessions = await chunkedStorage.loadAllMetadata();
const backup = JSON.stringify(sessions);
// Save to file

// 2. Rollback
await rollbackToPhase3Storage(true);

// 3. Verify data
const restored = await storage.load('sessions');
console.log('Restored sessions:', restored.length);

// 4. Test app functionality
// 5. If successful, delete rollback points to free space
```

---

### Procedure 2: Partial Recovery (Specific Session)

**When to Use**: Single session corrupted, others fine

**Steps**:
```typescript
// 1. Identify corrupted session
const sessionId = 'session-123';

// 2. Try loading metadata only
const metadata = await chunkedStorage.loadMetadata(sessionId);

// 3. If metadata OK, try chunks
const screenshots = await chunkedStorage.loadScreenshotsChunk(sessionId, 0);

// 4. If specific chunk corrupted, may need to skip it
// 5. Reconstruct session from available data
// 6. Resave: await chunkedStorage.saveFullSession(reconstructed);
```

---

### Procedure 3: Index Recovery

**When to Use**: Search not working, index corruption

**Steps**:
```typescript
// 1. Clear corrupted indexes
await indexManager.clear();

// 2. Rebuild from sessions
const sessions = await chunkedStorage.loadAllMetadata();
await indexManager.buildAllIndexes(sessions);

// 3. Verify
const verification = await indexManager.verifyIntegrity(sessions);
console.log('Verification:', verification);

// 4. If still failing, check session data quality
```

---

## Support Resources

**Documentation**:
- **STORAGE_ARCHITECTURE.md** - Technical architecture
- **PHASE_4_SUMMARY.md** - Overview and metrics
- **DEVELOPER_MIGRATION_GUIDE.md** - API changes and migration
- **PERFORMANCE_TUNING.md** - Optimization guide

**Getting Help**:
1. Check this troubleshooting guide first
2. Check browser console for error messages
3. Export logs: `console.save('taskerino-logs.txt')`
4. Report bug with steps to reproduce

**Emergency Data Recovery**:
1. Export all data: Settings > Export Data
2. Keep regular backups (daily for active users)
3. Rollback points kept for 30 days (use if needed)

---

**Version**: 1.0.0
**Last Updated**: October 24, 2025
**Status**: COMPLETE
