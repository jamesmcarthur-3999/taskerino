# Performance Tuning Guide - Phase 4 Storage

**Version**: 1.0.0
**Date**: October 24, 2025
**Audience**: Power Users & Administrators

---

## Overview

This guide helps you optimize Taskerino's Phase 4 storage system for maximum performance based on your usage patterns and system specifications.

---

## Cache Tuning

### Optimal Cache Size

**Recommendation**: Configure based on available RAM

| System RAM | Recommended Cache Size | Expected Sessions Cached |
|------------|----------------------|-------------------------|
| 4GB | 50MB | ~50-100 sessions |
| 8GB | 100MB (default) | ~100-200 sessions |
| 16GB | 200MB | ~200-400 sessions |
| 32GB+ | 500MB | ~500-1000 sessions |

**Configuration**:
Settings > Storage > Cache > Max Cache Size

**Formula**: Cache Size ≈ 10-20% of available RAM

### Cache Hit Rate Monitoring

**Target**: >90% hit rate

**Check Hit Rate**:
Settings > Storage > Cache Statistics

**If hit rate <80%**:
1. Increase cache size
2. Reduce TTL (keep data fresh longer)
3. Check for memory leaks
4. Review access patterns

### TTL Configuration

**Default**: 5 minutes

**Recommendations**:
- **Short TTL (1-2 min)**: Frequently changing data
- **Medium TTL (5 min)**: Default for most use cases
- **Long TTL (15-30 min)**: Static data, archival sessions

**Trade-off**: Longer TTL = higher hit rate but potentially stale data

---

## Compression Tuning

### Auto vs Manual Mode

**Auto Mode** (Recommended):
- Runs during idle time
- Pauses when user active
- Processes oldest sessions first
- Zero user intervention

**Manual Mode**:
- User-triggered
- Full control
- Faster completion
- Requires user action

**Configuration**:
Settings > Background Compression > Mode

### CPU Usage Limits

**Default**: 20%

**Recommendations**:
- **Low-end systems**: 10-15%
- **Mid-range systems**: 20-30% (default)
- **High-end systems**: 40-50%
- **Dedicated compression**: 80-100%

**Configuration**:
Settings > Background Compression > Max CPU

**Monitor**: Task Manager / Activity Monitor for actual CPU usage

### Age Threshold Optimization

**Default**: 7 days

**Recommendations**:
- **Aggressive compression**: 1-3 days (save storage ASAP)
- **Balanced**: 7-14 days (default, good trade-off)
- **Conservative**: 30-90 days (only compress old data)
- **Selective**: Never compress recent sessions

**Configuration**:
Settings > Background Compression > Age Threshold

**Trade-off**: Lower threshold = more storage savings, but may compress sessions you're still working on

### Screenshot Compression

**WebP Conversion**: 20-40% size reduction

**Enable if**:
- Storage space limited
- Many screenshots captured
- Visual quality not critical

**Disable if**:
- Need lossless quality
- Exporting screenshots for presentations
- Storage space not an issue

**Configuration**:
Settings > Background Compression > Compress Screenshots

---

## Index Tuning

### When to Rebuild Indexes

**Rebuild indexes when**:
1. Search becomes slow (>200ms)
2. Search results seem incomplete
3. After bulk session import
4. After data corruption/recovery

**How to Rebuild**:
```typescript
const indexManager = await getInvertedIndexManager();
await indexManager.rebuildIndexes();
```

### Index Optimization Frequency

**Recommended Schedule**:
- **Light usage** (<100 sessions): Weekly
- **Medium usage** (100-500 sessions): Every 3-4 days
- **Heavy usage** (500+ sessions): Daily
- **Very heavy** (1000+ sessions): Twice daily

**Auto-Optimization**:
Settings > Storage > Maintenance > Auto-optimize indexes

### Troubleshooting Slow Searches

**Issue**: Search takes >200ms

**Diagnosis**:
1. Check index integrity
2. Verify index size (should be ~42KB per 1000 sessions)
3. Monitor index rebuild time

**Solutions**:
1. Rebuild indexes
2. Optimize indexes (compact)
3. Reduce full-text index size (filter more stop words)
4. Increase index cache size

**Manual Optimization**:
```typescript
const result = await indexManager.optimize();
console.log(`Optimized: ${result.compacted} entries`);
```

---

## Queue Tuning

### Priority Configuration

**Critical Priority** (immediate):
- Active session updates
- Active session end
- User-facing operations

**Normal Priority** (batched, 100ms):
- Session metadata updates
- Session list updates
- Settings changes

**Low Priority** (idle time):
- Index updates
- Cache warming
- Garbage collection

**Default**: Auto-configured, no tuning needed

**Advanced**: Modify priority levels in code if needed

### Batching Settings

**Chunk Write Batching**:
- Default: 10 chunks → 1 transaction
- Recommendation: Keep default

**Index Update Batching**:
- Default: Batch within 100ms window
- Recommendation: Keep default

**CA Storage Batching**:
- Default: 20 refs → 1 transaction
- Recommendation: Keep default

**Trade-off**: Larger batches = higher latency but better throughput

### Queue Size Limits

**Default**: 1000 items max

**Increase if**:
- Heavy concurrent usage
- Frequent "queue full" warnings
- Many long sessions recording simultaneously

**Decrease if**:
- Memory pressure
- Want faster queue processing
- Single user, light usage

**Configuration** (code only):
```typescript
const queue = getPersistenceQueue();
queue.setMaxSize(2000); // Increase to 2000
```

---

## Migration Tuning

### Background vs Manual Migration

**Background Migration** (Recommended):
- Zero UI impact
- Pauses on user activity
- May take longer (hours for large datasets)

**Manual Migration**:
- Faster completion
- User must wait
- May block other operations

**Choose Background if**:
- User can keep app running overnight
- Large dataset (500+ sessions)
- Don't want to interrupt work

**Choose Manual if**:
- Small dataset (<100 sessions)
- Want immediate completion
- Scheduled maintenance window

### Batch Size Optimization

**Default**: 20 sessions per batch

**Recommendations**:
- **Small sessions** (<50 screenshots): 30-50 per batch
- **Medium sessions** (50-200 screenshots): 20 per batch (default)
- **Large sessions** (200+ screenshots): 10 per batch
- **Very large sessions** (1000+ screenshots): 5 per batch

**Configuration**:
```typescript
await backgroundMigration.start({
  batchSize: 30, // Increase for small sessions
  batchDelay: 100
});
```

### Activity Detection Sensitivity

**Default**: Pause after 1 second of activity

**Recommendations**:
- **Aggressive**: 500ms (pause quickly)
- **Balanced**: 1000ms (default)
- **Lenient**: 2000ms (allow brief activity)
- **Disabled**: null (never pause, not recommended)

**Configuration**:
```typescript
await backgroundMigration.start({
  activityCheckInterval: 5000,  // Check every 5 seconds
  pauseOnActivity: true
});
```

---

## Performance Monitoring

### Key Metrics to Track

**Cache Performance**:
- Hit rate (target: >90%)
- Memory usage (should not exceed max)
- Evictions (high = cache too small)

**Search Performance**:
- Search time (target: <100ms)
- Index build time (should be stable)
- Index size (grows linearly with sessions)

**Storage Performance**:
- Deduplication rate (target: 30-50%)
- Compression ratio (target: 55%)
- Storage size trend (should grow sub-linearly)

**Queue Performance**:
- Pending items (should be low, <10)
- Processing time (should be <100ms)
- Failed items (should be 0)

### Monitoring Tools

**Settings UI**:
- Settings > Storage > Cache Statistics
- Settings > Storage > Storage Statistics
- Settings > Storage > Queue Statistics

**Browser Console**:
```typescript
// Cache stats
const cacheStats = chunkedStorage.getCacheStats();
console.log('Cache hit rate:', cacheStats.hitRate);

// CA storage stats
const caStats = await caStorage.getStats();
console.log('Deduplication savings:', caStats.dedupSavings);

// Queue stats
const queueStats = queue.getStats();
console.log('Queue pending:', queueStats.pending);

// Index stats
const indexStats = await indexManager.getStats();
console.log('Index size:', indexStats.totalSize);
```

### Performance Alerts

**Set up alerts for**:
1. Cache hit rate <80% → Increase cache size
2. Search time >200ms → Rebuild indexes
3. Queue size >100 → Check for backlog
4. Storage growing too fast → Enable compression

---

## Recommended Configurations

### Configuration 1: Power User (16GB RAM, Heavy Usage)

```typescript
// Cache
setCacheSize(200 * 1024 * 1024); // 200MB

// Compression
{
  enabled: true,
  mode: 'auto',
  maxCPU: 30,
  ageThresholdDays: 7,
  compressScreenshots: true
}

// Index optimization: Daily
// Queue size: 2000 items
// Migration batch size: 20 sessions
```

### Configuration 2: Light User (8GB RAM, Occasional Usage)

```typescript
// Cache
setCacheSize(50 * 1024 * 1024); // 50MB

// Compression
{
  enabled: true,
  mode: 'auto',
  maxCPU: 20,
  ageThresholdDays: 14,
  compressScreenshots: true
}

// Index optimization: Weekly
// Queue size: 1000 items (default)
// Migration batch size: 30 sessions
```

### Configuration 3: Low-End System (4GB RAM, Limited Resources)

```typescript
// Cache
setCacheSize(25 * 1024 * 1024); // 25MB

// Compression
{
  enabled: true,
  mode: 'manual', // Trigger manually to control CPU
  maxCPU: 15,
  ageThresholdDays: 30,
  compressScreenshots: false // Skip for faster processing
}

// Index optimization: Monthly
// Queue size: 500 items
// Migration batch size: 10 sessions
```

### Configuration 4: High-Performance Workstation (32GB RAM, Many Sessions)

```typescript
// Cache
setCacheSize(500 * 1024 * 1024); // 500MB

// Compression
{
  enabled: true,
  mode: 'auto',
  maxCPU: 50,
  ageThresholdDays: 3,
  compressScreenshots: true
}

// Index optimization: Twice daily
// Queue size: 5000 items
// Migration batch size: 50 sessions
```

---

## Summary

**Key Takeaways**:
1. **Cache size** = 10-20% of RAM
2. **Compression** = Enable auto mode for storage savings
3. **Indexes** = Rebuild if search becomes slow
4. **Queue** = Default settings work for most use cases
5. **Monitor** = Check statistics regularly

**Quick Wins**:
- Increase cache size if hit rate <90%
- Enable background compression for 50%+ storage savings
- Rebuild indexes if search >200ms
- Review queue size if backlog grows

**Need More Help?**:
- See **TROUBLESHOOTING.md** for common issues
- See **STORAGE_ARCHITECTURE.md** for technical details
- See **DEVELOPER_MIGRATION_GUIDE.md** for API changes

---

**Version**: 1.0.0
**Last Updated**: October 24, 2025
**Status**: COMPLETE
