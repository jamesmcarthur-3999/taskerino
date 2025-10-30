# Memory Leak Verification Guide

**Phase 6, Task 6.3: Memory Cleanup & Leak Prevention**

This guide provides step-by-step instructions for manually verifying that memory leaks have been eliminated from the UnifiedMediaPlayer and attachmentStorage systems.

## Prerequisites

- Chrome or Chromium-based browser (for DevTools Memory profiler)
- Taskerino running in development mode (`npm run dev`)
- At least 10 test sessions with:
  - Video recordings
  - Audio recordings
  - Screenshots (10+ per session)

---

## Part 1: Chrome DevTools Memory Profiling

### Step 1: Take Initial Heap Snapshot

1. Open Taskerino in Chrome
2. Open Chrome DevTools (F12 or Cmd+Option+I)
3. Navigate to **Memory** tab
4. Select **Heap snapshot** from the dropdown
5. Click **Take snapshot**
6. Record the heap size from "Size" column (baseline, typically ~50-80MB)

```
Snapshot 1 (Baseline):
- Total heap size: _____ MB
- # of objects: _____
- Timestamp: _____
```

### Step 2: Open 10 Sessions Sequentially

For each session:

1. Navigate to **Sessions Zone**
2. Click on a session to open SessionDetailView
3. Wait for all media to load (video, audio, screenshots)
4. Observe playback briefly (5-10 seconds)
5. Navigate back to SessionsZone (close session)
6. Wait 2 seconds before opening next session

**Critical**: Do NOT keep sessions open simultaneously. Open one, close it, then open next.

```
Session 1: ✅ Opened, played, closed
Session 2: ✅ Opened, played, closed
Session 3: ✅ Opened, played, closed
Session 4: ✅ Opened, played, closed
Session 5: ✅ Opened, played, closed
Session 6: ✅ Opened, played, closed
Session 7: ✅ Opened, played, closed
Session 8: ✅ Opened, played, closed
Session 9: ✅ Opened, played, closed
Session 10: ✅ Opened, played, closed
```

### Step 3: Force Garbage Collection (Optional)

1. In DevTools Console, run:
   ```javascript
   if (global.gc) {
     global.gc();
   } else {
     console.log('GC not available. Restart Chrome with --expose-gc flag');
   }
   ```

2. Alternatively, click the **garbage can icon** in Memory tab (if available)

3. Wait 5 seconds for GC to complete

### Step 4: Take Final Heap Snapshot

1. In Memory tab, click **Take snapshot** again
2. Record the final heap size

```
Snapshot 2 (After 10 sessions):
- Total heap size: _____ MB
- # of objects: _____
- Timestamp: _____
- Growth from baseline: _____ MB
```

### Step 5: Compare Snapshots

1. Select **Comparison** view from dropdown
2. Compare Snapshot 2 to Snapshot 1
3. Look for retained objects by searching for:
   - `Blob` (should show 0 or very few)
   - `AudioContext` (should show 0-1, the singleton)
   - `Attachment` (should show <50, from LRU cache)
   - `VideoElement` (should show 0-1)
   - `AudioElement` (should show 0-1)

### Step 6: Analyze Detached DOM Nodes

1. In Comparison view, expand "Detached DOM tree" section
2. Look for:
   - Detached `<video>` elements (should be 0)
   - Detached `<audio>` elements (should be 0)
   - Detached event listeners (should be 0)

### Step 7: Check for Specific Leak Patterns

Search the heap snapshot for known leak indicators:

| Search Term | Expected Count | What It Means |
|-------------|----------------|---------------|
| `BlobImpl` | 0-2 | Unreleased Blob URLs |
| `AudioContext` | 0-1 | Audio contexts (1 singleton OK) |
| `MediaElement` | 0-2 | Unreleased video/audio elements |
| `Attachment` | <50 | Cached attachments (LRU limit) |
| `addEventListener` | <10 | Unreleased event listeners |

---

## Part 2: Expected Results

### Pass Criteria

✅ **Memory Growth**: <500MB after 10 sessions (target: <100MB)

✅ **Blob URLs**: 0 retained Blob URLs (all revoked)

✅ **AudioContext**: 0-1 instances (singleton service OK)

✅ **Attachment Cache**: <50 attachments (LRU limit enforced)

✅ **Event Listeners**: 0 accumulated listeners

✅ **Detached DOM**: 0 detached video/audio elements

### Fail Criteria

❌ **Memory Growth**: >500MB after 10 sessions

❌ **Blob URLs**: >0 retained Blob URLs

❌ **AudioContext**: >1 instances

❌ **Attachment Cache**: >50 attachments (cache unbounded)

❌ **Event Listeners**: >10 accumulated listeners

❌ **Detached DOM**: >0 detached media elements

---

## Part 3: Attachment Cache Verification

### Check Cache Statistics

1. Open browser console
2. Run:
   ```javascript
   const stats = window.__TASKERINO_ATTACHMENT_CACHE_STATS__;
   console.table(stats);
   ```

3. Verify:
   - `hits + misses > 0` (cache is active)
   - `entryCount <= 50` (LRU limit enforced)
   - `currentSize <= 104857600` (100MB limit enforced)
   - `hitRate > 0.6` (60%+ cache hit rate)

**Expected Output**:
```
hits: 45
misses: 15
currentSize: 87654321 bytes (~83MB)
maxSize: 104857600 bytes (100MB)
entryCount: 48
hitRate: 0.75 (75%)
```

---

## Part 4: Blob URL Revocation Verification

### Monitor Console Logs

During session opening/closing, watch for cleanup logs:

**Expected Console Output** (per session close):
```
[UNIFIED PLAYER] Revoked video Blob URL: blob:http://localhost/abc123...
[UNIFIED PLAYER] Revoked audio Blob URL: blob:http://localhost/def456...
```

**Failure Indicators**:
```
Error: Failed to revoke Blob URL (none)
Warning: Blob URL leaked (none)
```

---

## Part 5: Event Listener Verification

### Check Event Listener Count

Use Chrome DevTools:

1. Select **Elements** tab
2. Find `<video>` or `<audio>` element
3. In right panel, expand **Event Listeners**
4. Verify:
   - `timeupdate`: 0-1 listeners (should remove on unmount)
   - `ended`: 0-1 listeners
   - `play`: 0-1 listeners

### Alternative: Use getEventListeners()

In console:
```javascript
const video = document.querySelector('video');
console.log(getEventListeners(video));

// Expected: Empty object {} or minimal listeners after unmount
```

---

## Part 6: AudioContext Cleanup Verification

### Check AudioContext Instances

In console:
```javascript
// The singleton service should have exactly 1 AudioContext
const contexts = performance.getEntriesByType('measure').filter(e => e.name.includes('AudioContext'));
console.log(`Active AudioContext instances: ${contexts.length}`);

// Expected: 1 (the singleton)
```

---

## Part 7: Memory Leak Regression Test

### Automated Test Script

Run this in console to simulate 10 session opens/closes:

```javascript
async function memoryLeakTest() {
  const sessions = window.__TASKERINO_TEST_SESSIONS__ || [];
  const initialMemory = performance.memory?.usedJSHeapSize || 0;

  console.log(`Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);

  for (let i = 0; i < 10; i++) {
    console.log(`Opening session ${i + 1}/10...`);

    // Simulate session open
    window.location.hash = `#/sessions/${sessions[i]?.id || 'test'}`;
    await new Promise(r => setTimeout(r, 2000));

    // Simulate session close
    window.location.hash = '#/sessions';
    await new Promise(r => setTimeout(r, 1000));
  }

  if (global.gc) global.gc();
  await new Promise(r => setTimeout(r, 2000));

  const finalMemory = performance.memory?.usedJSHeapSize || 0;
  const growth = finalMemory - initialMemory;

  console.log(`Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Growth: ${(growth / 1024 / 1024).toFixed(2)} MB`);

  if (growth < 100 * 1024 * 1024) {
    console.log('✅ PASS: Memory growth < 100MB');
  } else if (growth < 500 * 1024 * 1024) {
    console.log('⚠️ WARNING: Memory growth < 500MB (acceptable, but investigate)');
  } else {
    console.log('❌ FAIL: Memory growth > 500MB (memory leak detected)');
  }
}

memoryLeakTest();
```

---

## Part 8: Production Verification Checklist

Use this checklist when verifying in production:

- [ ] Memory grows <500MB after 10 session opens
- [ ] All Blob URLs revoked (verified in console logs)
- [ ] Event listeners removed (verified in DevTools)
- [ ] Attachment cache capped at 50 items
- [ ] Attachment cache respects 100MB limit
- [ ] No detached DOM nodes (verified in Memory tab)
- [ ] AudioContext count = 1 (singleton only)
- [ ] Cache hit rate >60% (efficient caching)
- [ ] No console errors during session close
- [ ] Heap snapshot shows no unexpected retained objects

---

## Part 9: Troubleshooting

### Issue: Memory still grows >500MB

**Diagnosis**:
1. Take heap snapshot after 10 sessions
2. Sort by "Retained Size" (descending)
3. Look for top 10 retainers

**Common Culprits**:
- Unreleased closures (functions holding references)
- Event listeners not removed
- Timers not cleared (setInterval, setTimeout)
- Third-party libraries (check versions)

**Fix**:
- Add cleanup to useEffect return functions
- Use AbortController for fetch requests
- Clear all timers on unmount

### Issue: Blob URLs not revoked

**Diagnosis**:
1. Check console for "Revoked Blob URL" logs
2. If missing, check UnifiedMediaPlayer cleanup

**Fix**:
- Verify videoUrlRef.current and audioUrlRef.current are set
- Verify useEffect cleanup functions are called

### Issue: Attachment cache exceeds 50 items

**Diagnosis**:
1. Run `attachmentStorage.getCacheStats()` in console
2. Check `entryCount` value

**Fix**:
- Verify LRUCache is initialized with `maxItems: 50`
- Check Phase 4 LRUCache integration

---

## Part 10: Reporting Results

When documenting results in TASK_6.3_VERIFICATION_REPORT.md:

1. **Include Screenshots**:
   - Heap snapshot comparison
   - Cache statistics
   - Console logs showing cleanup

2. **Record Metrics**:
   - Initial heap size
   - Final heap size
   - Memory growth
   - Cache hit rate
   - Event listener count

3. **Pass/Fail Status**:
   - Overall: PASS/FAIL
   - Per criterion: Individual PASS/FAIL

4. **Known Issues**:
   - List any edge cases or limitations
   - Document workarounds

---

## Summary

This verification guide ensures comprehensive memory leak testing across:

- **Blob URLs**: Revoked on unmount
- **Event Listeners**: Removed on unmount
- **AudioContext**: Singleton pattern (no leaks)
- **Attachment Cache**: LRU eviction enforced
- **Heap Snapshots**: Manual verification

**Success Criteria**: All tests PASS, memory growth <500MB, zero memory leaks detected.
