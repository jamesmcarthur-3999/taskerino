# Phase 6: Review & Playback Optimization - Kickoff Brief

**Created**: 2025-10-26
**Phase**: 6 - Review & Playback Optimization
**Prerequisites**: Phases 1-5 Complete
**Estimated Duration**: 5-6 days
**Total Tasks**: 10

---

## Executive Summary

Phase 6 optimizes the session review and playback experience for smooth, memory-efficient playback of long sessions (100+ screenshots, 1+ hours of audio/video).

**Current State**: Well-architected system with Phase 4 storage optimizations, but suffers from:
- Audio concatenation blocks UI for 1-5 seconds
- ReviewTimeline renders 100+ items without virtualization
- Memory leaks from unreleased Blob URLs (100MB+ per session open)
- No progressive loading - all data upfront before playback

**Goals**: Sub-1s session load time, <100MB memory footprint, 60fps scrolling, progressive loading

---

## Current Performance Analysis

### What's Working Well ✅

**From Phase 4 (Already Optimized):**
- ✅ Metadata loading: <50ms (was 2-3s) = **40-60x faster**
- ✅ Session search: <100ms (was 2-3s) = **20-30x faster**
- ✅ UI blocking: 0ms (was 200-500ms) = **100% eliminated**
- ✅ ChunkedSessionStorage with progressive hydration
- ✅ LRU caching (>90% hit rate)
- ✅ ContentAddressableStorage deduplication (30-50% savings)

**Architecture Strengths:**
- Clean component hierarchy (SessionDetailView → SessionReview → UnifiedMediaPlayer + ReviewTimeline)
- Master-slave video/audio sync
- Chapter-based navigation
- YouTube-style overlay controls
- Lazy code splitting (React.lazy + Suspense)
- Component memoization (ScreenshotCard, AudioSegmentCard)

---

### Critical Bottlenecks Identified ⚠️

| Issue | Impact | Current | Target | Fix |
|-------|--------|---------|--------|-----|
| **Audio Concatenation** | Blocks UI 1-5s | Upfront WAV encoding | <500ms | Progressive loading |
| **No Virtualization** | 100+ DOM nodes | All items rendered | 10-20 visible | react-virtual |
| **Memory Leaks** | 100MB+ per open | Blob URLs never revoked | <100MB total | Cleanup on unmount |
| **Timeline Scrolling** | Janky at 100+ items | 15-30fps | 60fps | Virtual scrolling |
| **Screenshot Loading** | All upfront | 200MB loaded | Lazy load | Intersection Observer |

---

## Phase 6 Objectives

### Primary Goals

1. **Load Time**: <1s to start playback (currently 1.5-6.5s)
2. **Memory Usage**: <100MB per session (currently 200-500MB)
3. **Scrolling**: 60fps timeline scrolling (currently 15-30fps)
4. **Progressive Loading**: Start playback immediately, load rest in background

### Success Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Session load time | 1.5-6.5s | <1s | **3-6x faster** |
| Memory per session | 200-500MB | <100MB | **2-5x reduction** |
| DOM nodes (timeline) | 100+ | 10-20 | **5-10x reduction** |
| Timeline scrolling | 15-30fps | 60fps | **2-4x smoother** |
| Playback start | 1-5s (audio concat) | <500ms | **2-10x faster** |
| CPU during playback | 15-25% | <5% | **3-5x reduction** |

---

## Phase 6 Task Breakdown

### Wave 1: Critical Performance (Tasks 6.1-6.3)
**Duration**: 2-3 days
**Priority**: CRITICAL

#### Task 6.1: Progressive Audio Loading
**Priority**: CRITICAL
**Estimated**: 1 day
**Agent**: Audio Specialist

**Current Problem:**
```typescript
// BLOCKS UI for 1-5 seconds
const wavBlob = await audioConcatenationService.exportAsWAV(segments);
setAudioUrl(URL.createObjectURL(wavBlob));
// User can't interact until this completes
```

**Solution: Stream-Based Playback**
```typescript
class ProgressiveAudioLoader {
  private segments: SessionAudioSegment[];
  private loadedBuffers: Map<string, AudioBuffer> = new Map();
  private audioContext: AudioContext;

  async initialize(sessionId: string) {
    // 1. Load metadata instantly (no audio data)
    this.segments = await loadAudioSegmentsMetadata(sessionId);

    // 2. Load first 3 segments for immediate playback
    const priority = this.segments.slice(0, 3);
    await Promise.all(priority.map(s => this.loadSegment(s.id)));

    // 3. Background load remaining segments
    this.loadRemainingInBackground();

    // User can start playback NOW (500ms vs 5s)
  }

  private async loadRemainingInBackground() {
    const remaining = this.segments.slice(3);

    // Load 2 at a time to avoid overwhelming system
    for (let i = 0; i < remaining.length; i += 2) {
      const batch = remaining.slice(i, i + 2);
      await Promise.all(batch.map(s => this.loadSegment(s.id)));

      // Yield to main thread
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async playSegmentAt(currentTime: number): Promise<void> {
    const segment = this.findSegmentAtTime(currentTime);
    if (!segment) return;

    // Load on-demand if not already loaded
    const buffer = await this.loadSegment(segment.id);
    this.playBuffer(buffer, currentTime - segment.startTime);
  }
}
```

**Deliverables:**
- ProgressiveAudioLoader service (~400 lines)
- Integration with UnifiedMediaPlayer
- Buffering UI indicator
- Tests (15+ tests)

**Success Metrics:**
- First playback: <500ms (was 1-5s) = **2-10x faster**
- User can scrub immediately (no blocking)
- Background loading transparent
- Zero audio gaps during playback

---

#### Task 6.2: Virtual Scrolling in ReviewTimeline
**Priority**: CRITICAL
**Estimated**: 1 day
**Agent**: React Specialist

**Current Problem:**
```typescript
// ALL items in DOM (100+ div elements)
{sortedTimelineItems.map(item => <TimelineItem key={item.id} item={item} />)}
// Causes 15-30fps scrolling, slow rendering
```

**Solution: Virtual List**
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function ReviewTimeline({ sessionId, items }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 300, // Estimated height per item
    overscan: 5, // Render 5 items above/below viewport
  });

  return (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => {
          const item = items[virtualItem.index];

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <TimelineItem item={item} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Deliverables:**
- Virtual scrolling implementation in ReviewTimeline
- Proper item height estimation
- Scroll-to-item functionality
- Tests (10+ tests)

**Success Metrics:**
- DOM nodes: 10-20 (was 100+) = **5-10x reduction**
- Scrolling: 60fps (was 15-30fps) = **2-4x smoother**
- Initial render: <500ms (was 500-1000ms) = **2x faster**
- Memory: 50MB reduction for 100-item sessions

---

#### Task 6.3: Memory Cleanup & Leak Prevention
**Priority**: CRITICAL
**Estimated**: 0.5 days
**Agent**: Performance Specialist

**Current Problems:**
1. Blob URLs never revoked (100MB+ leak per session open)
2. Attachment cache unbounded
3. Event listeners not removed

**Solution:**
```typescript
// UnifiedMediaPlayer cleanup
useEffect(() => {
  return () => {
    // Revoke Blob URLs
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    // Remove event listeners
    if (audioRef.current) {
      audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.removeEventListener('ended', handleEnded);
    }

    // Clear audio buffers
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };
}, [audioUrl, videoUrl]);

// Attachment storage with LRU eviction
class AttachmentCache {
  private cache = new Map<string, Attachment>();
  private maxSize = 50; // Limit to 50 screenshots in memory

  get(id: string): Attachment | undefined {
    const item = this.cache.get(id);
    if (item) {
      // Move to end (most recently used)
      this.cache.delete(id);
      this.cache.set(id, item);
    }
    return item;
  }

  set(id: string, attachment: Attachment): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    this.cache.set(id, attachment);
  }
}
```

**Deliverables:**
- Cleanup hooks in UnifiedMediaPlayer
- LRU cache for attachmentStorage
- Memory profiling tests
- Leak detection tests (15+ tests)

**Success Metrics:**
- Memory after 10 session opens: <500MB (was 1-2GB) = **2-4x reduction**
- Leak-free (Chrome DevTools heap snapshot verification)
- Cache eviction working (50 screenshot limit)

---

### Wave 2: Progressive Loading (Tasks 6.4-6.6)
**Duration**: 1.5-2 days
**Priority**: HIGH

#### Task 6.4: Image Lazy Loading
**Priority**: HIGH
**Estimated**: 0.5 days
**Agent**: React Specialist

**Implementation:**
```typescript
// Native lazy loading
<img
  src={imageUrl}
  loading="lazy"
  decoding="async"
  alt={screenshot.summary}
/>

// Or: Intersection Observer for more control
function LazyImage({ src, alt }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' }); // Preload 200px ahead

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={isVisible ? src : placeholder}
      alt={alt}
    />
  );
}
```

**Deliverables:**
- Lazy loading in ScreenshotCard
- Placeholder/skeleton during load
- Preloading for adjacent screenshots
- Tests (8+ tests)

**Success Metrics:**
- Initial render: 200ms (was 500ms) = **2.5x faster**
- Memory: Only visible screenshots loaded
- Bandwidth: 80% reduction for long sessions

---

#### Task 6.5: Metadata Preview Mode
**Priority**: HIGH
**Estimated**: 1 day
**Agent**: React Specialist

**Concept: Fast Preview Before Full Load**
```typescript
function SessionDetailView({ sessionId }: Props) {
  const [mode, setMode] = useState<'preview' | 'full'>('preview');
  const { metadata } = useSessionMetadata(sessionId); // Fast: <50ms

  if (mode === 'preview') {
    return (
      <SessionPreview
        metadata={metadata}
        onLoadFull={() => setMode('full')}
      />
    );
  }

  return <SessionReview sessionId={sessionId} />; // Full load
}
```

**Deliverables:**
- SessionPreview component
- Smooth transition to full mode
- "Load full session" button
- Tests (10+ tests)

**Success Metrics:**
- Preview mode: <100ms (instant)
- User can decide whether to load full session
- 10x faster session browsing

---

#### Task 6.6: Screenshot Preloading
**Priority**: MEDIUM
**Estimated**: 0.5 days
**Agent**: Performance Specialist

**Implementation:**
```typescript
function ScreenshotViewer({ screenshots, currentIndex }: Props) {
  // Preload next/prev screenshots
  useEffect(() => {
    const preloadIndexes = [
      currentIndex - 1,
      currentIndex + 1,
      currentIndex + 2, // Preload 2 ahead for fast navigation
    ].filter(i => i >= 0 && i < screenshots.length);

    preloadIndexes.forEach(index => {
      const img = new Image();
      img.src = getImageUrl(screenshots[index].attachmentId);
    });
  }, [currentIndex, screenshots]);

  return <img src={currentImageUrl} />;
}
```

**Deliverables:**
- Preloading logic in ScreenshotViewer
- Preload buffer size configuration
- Tests (5+ tests)

**Success Metrics:**
- Next/prev navigation: <100ms (instant)
- No loading spinner on arrow keys
- Smart preloading (2 ahead, 1 behind)

---

### Wave 3: Performance Polish (Tasks 6.7-6.9)
**Duration**: 1-1.5 days
**Priority**: MEDIUM

#### Task 6.7: Debounced Time Updates
**Priority**: MEDIUM
**Estimated**: 0.5 days
**Agent**: Performance Specialist

**Current: Fires every ~16ms (60Hz)**
```typescript
const handleTimeUpdate = () => {
  setCurrentTime(videoRef.current.currentTime);
  scrollTranscriptToTime(videoRef.current.currentTime);
  updateChapterProgress(videoRef.current.currentTime);
};
```

**Optimized: Fires every 200ms**
```typescript
const handleTimeUpdate = useCallback(
  debounce(() => {
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    scrollTranscriptToTime(time);
    updateChapterProgress(time);
  }, 200),
  []
);
```

**Deliverables:**
- Debounced time updates
- Configurable debounce interval
- Tests (5+ tests)

**Success Metrics:**
- CPU usage: <5% (was 15-25%) = **3-5x reduction**
- Transcript scroll smoother
- Battery life improvement on laptops

---

#### Task 6.8: Chapter Grouping Optimization
**Priority**: MEDIUM
**Estimated**: 0.5 days
**Agent**: Algorithms Specialist

**Current: O(n*m) complexity**
```typescript
function groupItemsByChapter(items: TimelineItem[], chapters: VideoChapter[]) {
  return items.map(item => {
    // Linear search through chapters for EVERY item
    const chapter = chapters.find(c =>
      item.timestamp >= c.startTime && item.timestamp <= c.endTime
    );
    return { item, chapter };
  });
}
```

**Optimized: O(n log m) with binary search**
```typescript
function findChapterForTime(time: number, chapters: VideoChapter[]): VideoChapter | null {
  let left = 0;
  let right = chapters.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const chapter = chapters[mid];

    if (time >= chapter.startTime && time <= chapter.endTime) {
      return chapter;
    } else if (time < chapter.startTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return null;
}
```

**Deliverables:**
- Binary search implementation
- Memoized grouping results
- Tests (10+ tests)

**Success Metrics:**
- Grouping time: <10ms (was 50-100ms) = **5-10x faster**
- Works for 50+ chapters

---

#### Task 6.9: Web Audio API Integration
**Priority**: MEDIUM
**Estimated**: 1 day
**Agent**: Audio Specialist

**Current: Simple <audio> element**

**Upgrade: Web Audio API for better control**
```typescript
class WebAudioPlayback {
  private audioContext: AudioContext;
  private sourceNode: AudioBufferSourceNode;
  private gainNode: GainNode;
  private analyser: AnalyserNode;

  async loadSegment(segment: SessionAudioSegment): Promise<void> {
    const audioData = await attachmentStorage.getAudioData(segment.attachmentId);
    const audioBuffer = await this.audioContext.decodeAudioData(audioData);

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = audioBuffer;

    // Connect nodes: source → gain → analyser → destination
    this.sourceNode.connect(this.gainNode);
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  play(): void {
    this.sourceNode.start();
  }

  // Bonus: Real-time waveform visualization
  getWaveformData(): Uint8Array {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }
}
```

**Deliverables:**
- WebAudioPlayback service
- Integration with UnifiedMediaPlayer
- Optional waveform visualization
- Tests (12+ tests)

**Success Metrics:**
- Better audio sync precision (<50ms vs 150ms)
- Visualizations enabled
- Real-time audio effects possible

---

### Wave 4: Testing & Documentation (Task 6.10)
**Duration**: 1 day
**Priority**: HIGH

#### Task 6.10: Integration Testing & Documentation
**Priority**: HIGH
**Estimated**: 1 day
**Agent**: QA Specialist + Documentation Specialist

**Test Coverage:**

1. **Progressive Loading Tests**
   - Verify audio playback starts <500ms
   - Verify screenshots lazy-load on scroll
   - Verify background loading doesn't block UI

2. **Memory Tests**
   - Heap snapshot before/after 10 session opens
   - Verify Blob URL revocation
   - Verify LRU cache eviction

3. **Performance Tests**
   - Measure session load time (target: <1s)
   - Measure timeline scrolling (target: 60fps)
   - Measure memory footprint (target: <100MB)

4. **Stress Tests**
   - 500-screenshot session
   - 4-hour audio session
   - 10GB video file

**Deliverables:**
- Integration test suite (~600 lines)
- Performance benchmarks
- PHASE_6_SUMMARY.md documentation
- User-facing changelog
- Migration guide

**Success Metrics:**
- 100% critical path coverage
- All performance targets met
- Zero memory leaks detected

---

## Risk Mitigation

### High-Risk Areas

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Audio gap during segment transitions | Medium | High | Implement smooth crossfade |
| Virtual scrolling breaks chapter UI | Low | Medium | Test with/without chapters |
| Memory cleanup breaks active playback | Low | High | Guard clauses, only cleanup on unmount |
| Progressive loading feels buggy | Medium | Medium | Clear loading indicators, fast first load |

---

## Success Criteria

**Phase 6 Complete When:**
- [ ] Progressive audio loading: <500ms first playback
- [ ] Virtual scrolling: 60fps timeline scrolling
- [ ] Memory cleanup: <100MB per session
- [ ] Image lazy loading: Only visible screenshots loaded
- [ ] All 10 tasks complete with verification reports
- [ ] 80+ tests passing (60 unit + 20 integration)
- [ ] Performance benchmarks meet targets
- [ ] No memory leaks (heap snapshot verification)
- [ ] Documentation complete

**Manual Testing Checklist:**
- [ ] Open 10 sessions sequentially → Memory <500MB total
- [ ] Scroll timeline with 200 screenshots → 60fps
- [ ] Start playback of 2-hour session → <500ms
- [ ] Navigate screenshots with arrow keys → Instant
- [ ] Scrub through audio/video → No gaps

---

## Next Actions

**Immediate** (Right Now):
1. [ ] Review Phase 6 kickoff document
2. [ ] Approve execution strategy
3. [ ] Allocate agent resources

**Week 1** (Wave 1 - Critical):
- [ ] Launch Task 6.1 (Progressive Audio)
- [ ] Launch Task 6.2 (Virtual Scrolling)
- [ ] Launch Task 6.3 (Memory Cleanup)

**Week 2** (Waves 2-3 - Polish):
- [ ] Launch Tasks 6.4-6.9 in parallel
- [ ] Integration testing
- [ ] Performance validation

---

**Status**: ✅ Ready for Execution
**Priority**: HIGH (After Phase 5)
**Next Review**: After Wave 1 completion

---

**Created**: 2025-10-26
**Maintained By**: Lead Architect / Project Manager
