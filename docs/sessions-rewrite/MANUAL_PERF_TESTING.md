# Manual Performance Testing Checklist

This document provides step-by-step instructions for manual performance testing that cannot be automated. These tests should be performed at the end of each phase to validate performance improvements.

---

## Test Environment Setup

### Prerequisites
- [ ] Chrome/Edge browser (for DevTools)
- [ ] React DevTools extension installed
- [ ] Production build of the app (`npm run build`)
- [ ] Clean browser profile (no extensions except DevTools)
- [ ] Closed all other applications (reduce system load)

### Environment Preparation
```bash
# 1. Build production version
npm run build

# 2. Start production preview
npm run preview

# OR for Tauri:
npm run tauri:build
# Then run the built app from src-tauri/target/release/
```

### Important Notes
- **DISABLE React DevTools during performance testing** (it slows down rendering)
- Use **production builds only** (dev mode has extra overhead)
- **Clear cache** before each test session
- **Restart browser** between major test scenarios
- **Close other tabs** to reduce background CPU usage

---

## Test Scenario 1: Session Load Performance

### Objective
Measure time to load and display session list with varying amounts of data.

### Test 1.1: Empty Session List
**Target**: < 1000ms

1. [ ] Clear all application data (IndexedDB/storage)
2. [ ] Open Chrome DevTools → Performance tab
3. [ ] Click "Record" button
4. [ ] Navigate to Sessions zone
5. [ ] Stop recording when UI is fully loaded
6. [ ] Measure time from navigation to "fully loaded"
7. [ ] Record result: ______ ms

**Expected**: Near-instant (< 100ms)

### Test 1.2: 10 Sessions
**Target**: < 1000ms

1. [ ] Create 10 test sessions with:
   - Various durations (1-60 minutes)
   - 5-10 screenshots each
   - 2-5 audio segments each
2. [ ] Clear browser cache
3. [ ] Record performance profile
4. [ ] Navigate to Sessions zone
5. [ ] Measure load time
6. [ ] Record result: ______ ms

### Test 1.3: 100 Sessions
**Target**: < 1000ms

1. [ ] Create 100 test sessions (use script or mock data)
2. [ ] Clear browser cache
3. [ ] Record performance profile
4. [ ] Navigate to Sessions zone
5. [ ] Measure load time
6. [ ] Record result: ______ ms

**Notes**: If > 1000ms, this indicates need for optimization (chunked loading, pagination).

### Test 1.4: Large Session (100 Screenshots)
**Target**: < 1000ms

1. [ ] Create session with:
   - 100 screenshots
   - 1 hour audio (60 segments)
   - Full enrichment data
2. [ ] Clear browser cache
3. [ ] Record performance profile
4. [ ] Open session detail view
5. [ ] Measure load time
6. [ ] Record result: ______ ms

---

## Test Scenario 2: Timeline Scroll Performance

### Objective
Ensure smooth 60fps scrolling in timeline with many items.

### Test 2.1: Timeline with 100 Items
**Target**: 60fps (no dropped frames)

1. [ ] Create session with 100 timeline items (screenshots + audio)
2. [ ] Open session detail view
3. [ ] Open Chrome DevTools → Performance tab
4. [ ] Enable "Screenshots" and "FPS meter" in settings
5. [ ] Click "Record"
6. [ ] Scroll timeline rapidly up and down for 10 seconds
7. [ ] Stop recording
8. [ ] Analyze FPS chart:
   - Green = good (55-60fps)
   - Yellow = acceptable (30-55fps)
   - Red = poor (< 30fps)
9. [ ] Record FPS range: ______ fps
10. [ ] Check for "Long Tasks" (> 50ms)
11. [ ] Record number of long tasks: ______

**Expected**: Consistent 60fps, no long tasks

### Test 2.2: Timeline with 500 Items
**Target**: 60fps with virtual scrolling (Phase 2+)

**Note**: This test will likely fail in Phase 1 (no virtual scrolling yet). Document results for Phase 2 comparison.

1. [ ] Create session with 500 timeline items
2. [ ] Repeat Test 2.1 procedure
3. [ ] Record FPS range: ______ fps
4. [ ] Record number of long tasks: ______
5. [ ] Note any UI lag or jank

**Expected (Phase 1)**: May drop below 60fps (acceptable)
**Expected (Phase 2+)**: Consistent 60fps with virtual scrolling

### Test 2.3: Rapid Filtering
**Target**: < 100ms filter response time

1. [ ] Open session list with 100+ sessions
2. [ ] Open search/filter controls
3. [ ] Record performance profile
4. [ ] Type rapidly in search box: "test session"
5. [ ] Measure time from last keystroke to updated results
6. [ ] Record result: ______ ms

**Expected**: < 100ms (debounced to 300ms is acceptable)

---

## Test Scenario 3: Memory Usage

### Objective
Ensure memory usage stays within acceptable limits for long sessions.

### Test 3.1: 1 Hour Session Memory Profiling
**Target**: < 150MB JavaScript heap

**Setup**:
```bash
# Start Chrome with precise memory info
google-chrome --enable-precise-memory-info
```

1. [ ] Close all other tabs
2. [ ] Open Chrome DevTools → Memory tab
3. [ ] Take baseline heap snapshot
4. [ ] Create session with:
   - 100 screenshots (or 1/min for 1 hour)
   - 60 minutes of audio (1 segment/min)
   - Full enrichment data
5. [ ] Open session detail view
6. [ ] Wait for all data to load
7. [ ] Take heap snapshot
8. [ ] Compare snapshots:
   - Baseline: ______ MB
   - After load: ______ MB
   - Delta: ______ MB

**Expected**: < 150MB delta

### Test 3.2: Memory Leak Detection
**Target**: No memory leaks over time

1. [ ] Take baseline heap snapshot
2. [ ] Navigate through 10 different sessions
3. [ ] Return to session list
4. [ ] Force garbage collection (DevTools → Memory → 🗑️ icon)
5. [ ] Take another heap snapshot
6. [ ] Compare "Detached DOM nodes" count
7. [ ] Record detached nodes: ______

**Expected**: < 10 detached nodes (some is normal)

### Test 3.3: Long Session Test
**Target**: Memory remains stable over time

1. [ ] Open session detail view
2. [ ] Keep tab open for 10 minutes
3. [ ] Interact periodically (scroll, click)
4. [ ] Monitor memory in DevTools Performance Monitor:
   - JS Heap Size
   - DOM Nodes
   - JS Event Listeners
5. [ ] Record trends:
   - Heap size stable? [ ] Yes [ ] No
   - DOM nodes stable? [ ] Yes [ ] No
   - Event listeners stable? [ ] Yes [ ] No

**Expected**: All metrics remain stable (no continuous growth)

---

## Test Scenario 4: Storage Performance

### Objective
Validate storage operations don't block UI.

### Test 4.1: UI Blocking Test
**Target**: 0ms blocking time

1. [ ] Open Chrome DevTools → Performance tab
2. [ ] Enable "Show long tasks" in settings
3. [ ] Record profile
4. [ ] Create new session with screenshots
5. [ ] Perform these actions rapidly:
   - Add 10 screenshots
   - Update session name 5 times
   - Add/remove tags
6. [ ] Stop recording
7. [ ] Check for "Long Tasks" (> 50ms)
8. [ ] Record number of long tasks: ______

**Expected**: 0 long tasks (all storage ops are async)

### Test 4.2: Rapid State Updates
**Target**: UI remains responsive

1. [ ] Open session with 50+ screenshots
2. [ ] Open DevTools → Performance Monitor
3. [ ] Monitor "CPU usage" and "JS heap size"
4. [ ] Perform rapid actions:
   - Delete 10 screenshots quickly
   - Undo/redo if available
   - Filter timeline repeatedly
5. [ ] Note any UI freezing or lag
6. [ ] UI remained responsive? [ ] Yes [ ] No

**Expected**: UI remains responsive throughout

---

## Test Scenario 5: Enrichment Pipeline

### Objective
Ensure enrichment doesn't block UI and completes within reasonable time.

### Test 5.1: Background Enrichment
**Target**: UI responsive during enrichment

1. [ ] Create session with 50 screenshots + 30min audio
2. [ ] Enable full enrichment (audio review + summary)
3. [ ] End session to trigger enrichment
4. [ ] Return to session list immediately
5. [ ] Try to interact with other sessions
6. [ ] UI remained responsive? [ ] Yes [ ] No
7. [ ] Background progress indicator visible? [ ] Yes [ ] No

**Expected**: Full UI responsiveness, progress visible

### Test 5.2: Enrichment Duration
**Target**: Depends on API latency (document actual times)

1. [ ] Create session with:
   - 20 screenshots
   - 10 minutes audio
2. [ ] Note start time: ______
3. [ ] Trigger enrichment
4. [ ] Note completion time: ______
5. [ ] Calculate duration: ______ seconds
6. [ ] Check enrichment status for errors
7. [ ] Errors encountered? [ ] Yes [ ] No

**Expected**: No errors, reasonable duration (will vary by API speed)

---

## Test Scenario 6: Context Re-render Performance

### Objective
Ensure contexts don't cause excessive re-renders.

### Test 6.1: Re-render Frequency (with React DevTools Profiler)

**Note**: Enable React DevTools for this test only.

1. [ ] Install React DevTools extension
2. [ ] Open React DevTools → Profiler tab
3. [ ] Click "Record"
4. [ ] Perform these actions:
   - Load session list
   - Open session detail
   - Scroll timeline
   - Filter sessions
5. [ ] Stop recording
6. [ ] Analyze component render counts:
   - SessionListProvider: ______ renders
   - ActiveSessionContext: ______ renders
   - RecordingContext: ______ renders
7. [ ] Note components with > 10 renders: ______

**Expected**: Low render counts (< 5 per user action)

---

## Recording Results

### Template for Recording Results

```
===========================================
MANUAL PERFORMANCE TEST RESULTS
===========================================

Date: _______________
Tester: _______________
Phase: _______________
Environment: _______________
Build: [ ] Production [ ] Development

-------------------------------------------
SCENARIO 1: SESSION LOAD PERFORMANCE
-------------------------------------------
1.1 Empty list: ______ ms [ ] PASS [ ] FAIL
1.2 10 sessions: ______ ms [ ] PASS [ ] FAIL
1.3 100 sessions: ______ ms [ ] PASS [ ] FAIL
1.4 Large session: ______ ms [ ] PASS [ ] FAIL

-------------------------------------------
SCENARIO 2: TIMELINE SCROLL
-------------------------------------------
2.1 100 items: ______ fps [ ] PASS [ ] FAIL
    Long tasks: ______
2.2 500 items: ______ fps [ ] PASS [ ] FAIL
    Long tasks: ______
2.3 Filtering: ______ ms [ ] PASS [ ] FAIL

-------------------------------------------
SCENARIO 3: MEMORY USAGE
-------------------------------------------
3.1 1hr session: ______ MB [ ] PASS [ ] FAIL
3.2 Memory leaks: ______ nodes [ ] PASS [ ] FAIL
3.3 Long session: [ ] STABLE [ ] GROWING

-------------------------------------------
SCENARIO 4: STORAGE
-------------------------------------------
4.1 Long tasks: ______ [ ] PASS [ ] FAIL
4.2 Responsive: [ ] YES [ ] NO

-------------------------------------------
SCENARIO 5: ENRICHMENT
-------------------------------------------
5.1 Responsive: [ ] YES [ ] NO
5.2 Duration: ______ sec
    Errors: [ ] YES [ ] NO

-------------------------------------------
SCENARIO 6: RE-RENDERS
-------------------------------------------
6.1 SessionList: ______ renders
    ActiveSession: ______ renders
    Recording: ______ renders
    Excessive? [ ] YES [ ] NO

-------------------------------------------
OVERALL ASSESSMENT
-------------------------------------------
Total Tests: ______
Passed: ______
Failed: ______
Success Rate: ______ %

Recommendation:
[ ] Ready for next phase
[ ] Minor issues, acceptable
[ ] Major issues, requires optimization

Notes:
_________________________________________
_________________________________________
_________________________________________
```

---

## Recommendations

### Phase 1
- Focus on automated tests
- Manual tests optional (baseline documentation)
- Establish expected performance characteristics

### Phase 2
- Perform all manual tests
- Compare to Phase 1 baseline
- Validate virtual scrolling improvements

### Phase 3+
- Continuous performance monitoring
- Regression testing after major changes
- Real-world user session testing

---

## Troubleshooting

### Poor Scroll Performance
- Check for "Long Tasks" in DevTools
- Profile with Performance tab to find bottleneck
- Look for unnecessary re-renders
- Consider virtual scrolling (Phase 2+)

### High Memory Usage
- Check for memory leaks with heap snapshots
- Look for detached DOM nodes
- Ensure proper cleanup in useEffect
- Consider lazy loading (Phase 3+)

### UI Blocking
- Ensure all storage ops are async
- Check for synchronous loops in render
- Profile main thread activity
- Consider Web Workers for heavy computation

### Slow Load Times
- Check network tab for unnecessary requests
- Profile storage adapter performance
- Consider data pagination
- Implement chunked loading (Phase 2+)
