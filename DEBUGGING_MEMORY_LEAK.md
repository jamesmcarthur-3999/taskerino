# Debugging Memory Leak - Step-by-Step Guide

## ✅ FIXES ALREADY APPLIED

Two critical fixes have been implemented:

1. **Fix 1: Screenshot Base64 Cache Removal** - Screenshots no longer cache 50-100MB base64 data
2. **Fix 2: Lazy Canvas Spec Loading** - Canvas specs (40KB-50MB each) no longer load on startup

## 🔍 HOW TO DEBUG

### Step 1: Open Chrome DevTools

**Mac**: Press `Cmd + Option + I` (or `Cmd + Shift + I`)

You should see a panel open at the bottom or side of your app with tabs like:
- Console
- Sources
- Network
- **Memory** (this is what we need!)
- Performance

### Step 2: Use the Visual Memory Monitor

I've added a **MemoryMonitor** component in the bottom-right corner of your app that shows:

- **Heap Used**: Current JavaScript memory usage
- **Growth Rate**: How fast memory is growing (MB per 30 seconds)
- **Cache Size**: LRU cache size and hit rate
- **Leak Detection**: Red alert if growing >100MB/30s

If you see:
- ✅ **Green**: Memory is stable (<80% of limit, slow growth)
- ⚠️ **Orange**: Memory is high (>80% of limit)
- 🔥 **Red "LEAK DETECTED"**: Memory growing >100MB/30s

### Step 3: Check Console Logs

In DevTools Console tab, you should now see:

```
[MemoryMonitor] {
  heapUsedMB: "256.34",
  heapTotalMB: "300.12",
  heapLimitMB: "2048.00",
  cacheSizeMB: "12.45",
  cacheItems: 142,
  cacheHitRate: "67.5%",
  growthRateMB: "+5.23 MB/30s"  // This is the key metric!
}
```

**What to look for**:
- `heapUsedMB` should stabilize around 200-500MB after startup
- `growthRateMB` should be near 0 after initial load (maybe +5-10MB/30s max)
- If `growthRateMB` is >100MB/30s -> **ACTIVE LEAK**

### Step 4: Take Heap Snapshots

If memory is still growing:

1. Go to **Memory** tab in DevTools
2. Select **"Heap snapshot"**
3. Click **"Take snapshot"**
4. Wait 30 seconds
5. Click **"Take snapshot"** again
6. Click on the second snapshot
7. Change dropdown from "Summary" to **"Comparison"**
8. Look at the **"Size Delta"** column

**What you're looking for**:
- Large positive numbers in Size Delta (objects that grew)
- Look for: `(array)`, `(string)`, `(object)`
- Filter by "Size Delta" descending to see biggest growers

**Common culprits**:
- `(array)` with +100MB -> Array accumulating data
- `(string)` with +500MB -> Base64 data or text accumulation
- `SessionScreenshot` objects -> Screenshots loading
- `CanvasSpec` objects -> Canvas specs loading

### Step 5: Profile Memory Timeline

1. Go to **Memory** tab
2. Select **"Allocation timeline"**
3. Click **"Start"**
4. Wait 30 seconds (let the leak happen)
5. Click **"Stop"**
6. Look at the blue bars (allocations)

**What you see**:
- Tall blue bars = large allocations
- Many bars = frequent allocations
- Click on a bar to see what's being allocated

## 🔥 WHAT TO DO IF LEAK PERSISTS

### If memory still grows after fixes:

1. **Check the Console** for these messages:
```
[SessionListContext] Loading sessions from storage (metadata only)...
[SessionListContext] Loaded 500 sessions (metadata only)
```

2. **Look for** these BAD messages:
```
[SessionListContext] Loaded canvas spec for session X  // Should NOT appear!
[ChunkedStorage] Cache set screenshots:X:Y  // Check size
```

3. **Run this in Console**:
```javascript
// Check if fixes are working
const chunkedStorage = await (await import('./services/storage/ChunkedSessionStorage')).getChunkedStorage();
const stats = chunkedStorage.getCacheStats();
console.log('Cache stats:', stats);

// Check how many sessions have canvas specs
const sessions = await (await import('./context/SessionListContext')).useSessionList().sessions;
const withCanvas = sessions.filter(s => s.canvasSpec !== undefined);
console.log(`${withCanvas.length} sessions have canvas specs loaded (should be 0)`);
```

4. **Check SessionListContext logs**:
If you see canvas spec loading:
```
[SessionListContext] Failed to load canvas spec for session X  // This is OK
// vs
[SessionListContext] Loaded canvas spec: { ... 50KB of data ... }  // BAD!
```

## 📊 EXPECTED RESULTS AFTER FIXES

### Startup (first 10 seconds):
- Memory: 100-300MB
- Growth: +20-50MB (initial load)
- Cache: 5-20MB

### Steady State (after 1 minute):
- Memory: 200-500MB
- Growth: 0-10MB/30s (should stabilize)
- Cache: 20-50MB

### After browsing 50 sessions:
- Memory: 300-600MB
- Growth: 0-5MB/30s
- Cache: 50-80MB (should evict old entries)

## 🐛 COMMON ISSUES

### "performance.memory not available"
**Solution**: The MemoryMonitor will show a red box. Open Chrome DevTools (Cmd+Option+I) first, then the memory API becomes available.

### "Cache hit rate is 0%"
**Cause**: You just started the app, cache is empty
**Expected**: After browsing sessions, should reach 60-90%

### "Heap used keeps growing even after fixes"
**Possible causes**:
1. Another leak source (not screenshots/canvas)
2. Fixes didn't apply correctly
3. Browser memory leak (try restarting app)

**Debug steps**:
1. Take heap snapshot
2. Look for large objects in "Summary" view
3. Sort by "Retained Size" descending
4. Check what's taking up space

## 🎯 SPECIFIC THINGS TO CHECK

### 1. Are screenshots still caching base64?

In Console:
```javascript
// Get a screenshot chunk from cache
const chunkedStorage = await (await import('./services/storage/ChunkedSessionStorage')).getChunkedStorage();
const screenshots = await chunkedStorage.loadScreenshotsChunk('some-session-id', 0);
console.log('First screenshot has base64?', screenshots[0]?.base64 !== undefined);
// Should be: false (base64 stripped from cache)
```

### 2. Are canvas specs loading on startup?

Check Console for:
```
[SessionListContext] Loading sessions from storage (metadata only)...
[SessionListContext] Loaded 500 sessions (metadata only)
```

Should **NOT** see:
```
[SessionListContext] Loading canvas spec...  // BAD!
```

### 3. What's the cache actually holding?

```javascript
const chunkedStorage = await (await import('./services/storage/ChunkedSessionStorage')).getChunkedStorage();
chunkedStorage.getCacheStats();
// If size is >500MB, something is wrong
```

## 📝 REPORTING RESULTS

If the leak persists, report:

1. **Heap snapshot comparison** (screenshot of Size Delta column)
2. **Memory Monitor readings** every 30 seconds for 3 minutes
3. **Console logs** showing what's being loaded
4. **Top 5 objects** from heap snapshot by Retained Size

This will help identify the root cause!

## 🚀 NEXT STEPS IF LEAK IS FIXED

1. Remove `<MemoryMonitor />` from App.tsx
2. Close Chrome DevTools
3. Enjoy your app without memory leaks! 🎉

---

**Created**: 2025-10-28
**Fixes Applied**: Screenshot base64 cache removal, Lazy canvas spec loading
