# Phase 5: Enrichment Optimization - Kickoff Brief

**Created**: 2025-10-26
**Updated**: 2025-10-26 (Model update to Claude 4.5 family + new optimization strategies)
**Phase**: 5 - Enrichment Optimization
**Prerequisites**: Phases 1-4 Complete ✅
**Estimated Duration**: 10-14 days
**Total Tasks**: 16 (14 enrichment + 2 Phase 4 cleanup)

---

## 📋 Document Updates (2025-10-26)

**Models Updated to Claude 4.5 Family:**
- ✅ Haiku 4.5: $1/$5 per MTok (input/output) - 90% of Sonnet performance, 4-5x faster
- ✅ Sonnet 4.5: $3/$15 per MTok - Best coding model, frontier performance
- ✅ Opus 4.1: $15/$75 per MTok - Most powerful model for complex reasoning

**New Optimization Strategies Added:**
- ✅ Prompt Caching: Up to 90% cost savings + 85% latency reduction
- ✅ Message Batches API: 50% cost savings for async batch processing (up to 10,000 requests)
- ✅ Screenshot Batching: Updated to 20 images per request (was 10) = 95% API call reduction
- ✅ Combined Impact: 70-85% total cost reduction (updated from 50-70%)

**Updated Targets:**
- Cost Reduction: 70-85% (was 50-70%)
- Speed Improvement: 5-10x faster (was 3-5x)
- API Efficiency: 20x improvement (was 3x)
- Real-time Analysis: 1.5-2.5s latency (new capability)

**Model Selection Changes:**
- ✅ Removed Opus 4.1 from default enrichment (Sonnet 4.5 outperforms it)
- ✅ Haiku 4.5 for real-time analysis (4-5x faster, 90% quality)
- ✅ Sonnet 4.5 for batch analysis (best overall performance)
- ℹ️ Opus 4.1 kept only for rare high-stakes reasoning (not recommended for sessions)

**Prompt Engineering Updates (from audit):**
- ✅ Task 5.10 enhanced with Anthropic 2025 best practices
- ✅ Prompt caching guidance added (90% savings potential)
- ✅ Token-efficient tool use beta feature documented (14-70% output savings)
- ✅ XML structure standardization guidance
- ✅ Few-shot examples requirements (1-2 per prompt)
- ✅ System vs user prompt separation best practices
- ✅ Anti-overfitting guidelines (use "should" not "must")

---

## Executive Summary

Phase 5 focuses on optimizing the AI enrichment pipeline to dramatically reduce costs, improve quality, and enable real-time enrichment capabilities. This phase builds on the solid foundation laid by Phases 1-4, leveraging the new storage architecture for caching and the audio graph for efficient processing.

**Critical Note**: Before starting Phase 5 proper tasks, we must **stabilize Phase 4** by fixing type errors and test failures introduced during the storage rewrite.

**User Experience Note**: Cost tracking is implemented as a backend/admin concern only. Users will NOT see costs in the main UI - this prevents cost anxiety while still enabling system optimization.

---

## Current State Assessment

### What's Working ✅
- **Phases 1-3**: Fully complete and production-ready
- **Phase 4 Core**: Storage rewrite complete (12/12 tasks)
  - ChunkedSessionStorage: 44 tests passing
  - ContentAddressableStorage: 39 tests passing
  - InvertedIndexManager: 71 tests passing
  - LRUCache: 39 tests passing
  - PersistenceQueue: 46 tests passing
- **Enrichment Service**: Sophisticated implementation exists
  - Checkpointing system
  - Cost estimation
  - Parallel processing
  - Error recovery

### What Needs Fixing ⚠️
- **TypeScript Compilation**: 28 type errors (Phase 4 integration issues)
- **Test Suite**: 160 failing tests (89% pass rate, needs to be 95%+)
- **Integration Issues**: Phase 4 storage not fully integrated with existing code

### Impact on Phase 5
These issues must be resolved **before** starting Phase 5 enrichment optimization work. The Phase 4 storage architecture is required for enrichment caching, so we need a stable foundation.

---

## Phase 5 Objectives

### Primary Goals
1. **Cost Reduction**: 70-85% reduction in enrichment costs (via prompt caching, batching, model selection)
2. **Speed Improvement**: 5-10x faster enrichment through caching and Haiku 4.5 (4-5x faster than Sonnet)
3. **Quality Enhancement**: Better AI prompts and adaptive model selection (Haiku 4.5 = 90% of Sonnet 4.5)
4. **Scalability**: Support for batch enrichment of multiple sessions (up to 10,000 concurrent)

### Key Features to Deliver
1. **Enrichment Caching** - Never re-process identical content
2. **Incremental Enrichment** - Only process new data (append mode)
3. **Parallel Processing** - Multiple sessions enriched concurrently
4. **Smart API Usage** - Batching, prompt optimization, adaptive model selection
5. **Prompt Caching** - Cache repeated context for 90% cost savings
6. **Message Batches API** - Async batch processing for 50% cost savings
7. **Cost Monitoring** - Backend tracking with Settings UI (admin only)

### Optimization Strategy Breakdown

| Optimization | Cost Impact | Speed Impact | Applies To |
|--------------|-------------|--------------|------------|
| **Model Selection** | -60 to -80% | +4-5x (Haiku 4.5) | All API calls |
| **Screenshot Batching** | -95% API calls | +10x throughput | Post-session analysis |
| **Real-time Analysis** | +0% (new mode) | 1.5-2.5s latency | Active sessions |
| **Prompt Caching** | -90% (cached) | -85% latency | Repeat prompts |
| **Message Batches API** | -50% | Async (no wait) | Background enrichment |
| **Context Compression** | -30 to -50% | Negligible | All prompts |
| **Result Caching** | -100% (hit) | +1000x (instant) | Duplicate content |
| **Incremental Enrichment** | -70 to -90% | +5-10x | Append operations |
| **COMBINED IMPACT** | **-70% to -85%** | **+5-10x faster** | **All enrichment** |

### Real-time vs Batch Analysis Strategy

**For Active Sessions (Real-time):**
- Model: **Haiku 4.5** (4-5x faster than Sonnet, 90% of performance)
- Processing: Individual screenshots as captured (~1.5-2.5s latency)
- Compression: WebP @ 80% quality, 1920px max, ~300-500KB
- Cost: ~$0.002 per screenshot
- Analysis: Quick activity detection, OCR, basic insights
- **Value**: Immediate context while working

**For Completed Sessions (Batch):**
- Model: **Sonnet 4.5** with prompt caching (90% savings)
- Processing: Batches of 20 screenshots (~1-2min total)
- Compression: Original quality for deep analysis
- Cost: ~$0.0005 per screenshot (cached)
- Analysis: Deep story, patterns, breakthroughs, connections
- **Value**: Comprehensive narrative after work

**Hybrid Approach (Recommended):**
- Real-time during session + batch re-analysis after = Best UX
- Only 25% more expensive than pure batch
- 100x better user experience (immediate feedback)

---

## UI/UX Philosophy: Cost Tracking

**User-Facing UI**: MINIMAL
- No cost indicators in sessions list
- No cost counters during enrichment
- No cost warnings during normal usage
- Users should feel free to enrich without anxiety

**Settings Zone Only** (Admin/Developer):
- Cost dashboard in Settings → Advanced → System Health
- Historical cost trends
- Budget alerts (email/log only, not UI popups)
- Opt-in visibility for power users

**Backend Tracking** (Always On):
- Detailed cost attribution
- Per-session cost logging
- Daily/monthly aggregates
- Optimization recommendations in logs

**Rationale**: Cost anxiety inhibits usage. Track for optimization, not to stress users.

---

## Phase 5 Task Breakdown

### Wave 0: Phase 4 Stabilization (CRITICAL)
**Duration**: 2-3 days
**Status**: Must complete before Wave 1

#### Task 5.0.1: Fix Phase 4 Type Errors
**Priority**: CRITICAL
**Estimated**: 1 day
**Agent**: TypeScript Specialist

**Issues to Fix** (28 total):
1. GlassSelect component: RefObject type mismatches (3 errors)
2. Phase4MigrationProgress: Missing MigrationProgress export (1 error)
3. migrate-to-phase4-storage: Type-only import violations (2 errors)
4. BackgroundMigrationService: Type-only import violations (3 errors)
5. ChunkedSessionStorage: Generic type argument issues (8 errors)
6. ContentAddressableStorage: AttachmentType mismatch (2 errors)
7. LazyLoader: Type predicate issues (2 errors)
8. NoteDetailSidebar: Missing Calendar component (1 error)
9. TasksZone: Type mismatch in done property (2 errors)
10. aiDeduplication: Syntax error with erasableSyntaxOnly (1 error)
11. SessionsTopBar: RefObject type mismatch (1 error)
12. BackgroundMigrationService: Comparison type error (1 error)

**Deliverables**:
- All 28 type errors resolved
- `npm run type-check` passes with 0 errors
- No breaking changes to existing functionality

**Quality Gates**:
- Type checking passes
- All existing tests still pass
- No regression in functionality

#### Task 5.0.2: Fix Phase 4 Test Failures
**Priority**: CRITICAL
**Estimated**: 1-2 days
**Agent**: Testing Specialist

**Issues to Fix** (160 failing tests):
- Storage adapter initialization errors
- IndexedDB mock setup issues
- Context provider test failures
- Integration test failures

**Approach**:
1. Categorize failures by root cause
2. Fix storage mock infrastructure
3. Update test setup for Phase 4 storage
4. Verify all integration points

**Deliverables**:
- Test pass rate: 95%+ (target: 1370+ passing / <70 failing)
- All critical path tests passing
- Test infrastructure updated for Phase 4

**Quality Gates**:
- No regressions in existing tests
- New Phase 4 tests remain passing
- CI/CD pipeline green

---

### Wave 1: Caching & Memoization (Tasks 5.1-5.4)
**Duration**: 3-4 days
**Dependencies**: Wave 0 complete
**Agents**: 2 specialists (can run in parallel)

#### Task 5.1: Enrichment Result Cache
**Priority**: HIGH
**Estimated**: 1.5-2 days
**Agent**: Caching Specialist

**Objective**: Never re-process identical content

**Implementation**:
```typescript
class EnrichmentResultCache {
  // Use ContentAddressableStorage from Phase 4
  private caStorage: ContentAddressableStorage;

  // Cache key: SHA-256(audioData + prompt + modelConfig)
  async getCachedResult(key: string): Promise<EnrichmentResult | null>;

  // Store result with content-addressable deduplication
  async cacheResult(key: string, result: EnrichmentResult): Promise<void>;

  // Statistics (backend only, no UI)
  getCacheStats(): { hits: number; misses: number; savingsUSD: number };
}
```

**Features**:
- Content-addressable caching (reuse Phase 4 infrastructure)
- Automatic cache invalidation (TTL: 30 days)
- Cache hit statistics (logged, not shown to users)
- Graceful cache miss handling

**UI Constraints**:
- NO cost indicators in main UI
- NO cache stats in sessions UI
- Optional stats in Settings → Advanced → System Health
- All metrics logged for developer analysis

**Deliverables**:
- EnrichmentResultCache implementation (~500 lines)
- Integration with sessionEnrichmentService
- Backend logging infrastructure
- Settings page stats (optional, hidden by default)
- Unit tests (20+ tests)
- Performance benchmarks

**Success Metrics**:
- Cache hit rate: >60% after 1 week of usage
- Cost savings: $5-10 per 100 cached sessions (tracked in logs)
- Cache lookup: <10ms

#### Task 5.2: Incremental Enrichment
**Priority**: HIGH
**Estimated**: 2 days
**Agent**: Enrichment Specialist

**Objective**: Only process new data since last enrichment

**Current Problem**:
- Re-processes entire session on every enrichment call
- Wastes money on unchanged screenshots/audio
- Slow for long sessions (>1 hour)

**Solution**:
```typescript
interface EnrichmentCheckpoint {
  sessionId: string;
  lastProcessedTimestamp: string;
  lastScreenshotIndex: number;
  lastAudioSegmentIndex: number;
  audioHash: string;  // Detect audio changes
  videoHash: string;  // Detect video changes
}

// Only process new data
const newScreenshots = session.screenshots.slice(checkpoint.lastScreenshotIndex);
const newAudioSegments = session.audioSegments.slice(checkpoint.lastAudioSegmentIndex);
```

**Features**:
- Track last processed timestamp
- Delta detection for screenshots/audio
- Merge new insights with existing summary
- Checkpoint persistence via ChunkedStorage

**UI Constraints**:
- Progress indicator shows "Enriching..." (no cost/time estimates shown)
- Success message: "Session enriched" (no cost mentioned)
- Error messages focus on user action, not cost implications

**Deliverables**:
- Incremental enrichment implementation (~600 lines)
- Checkpoint management system
- Delta detection logic
- Integration tests (15+ tests)

**Success Metrics**:
- Cost reduction: 70-90% for append operations (logged, not shown)
- Processing time: 80-95% faster for incremental updates
- Zero data loss during merge

#### Task 5.3: Enrichment Memoization
**Priority**: MEDIUM
**Estimated**: 1 day
**Agent**: Performance Specialist

**Objective**: Cache intermediate AI API results

**Memoization Targets**:
1. **Screenshot Analysis**
   - Key: `SHA-256(imageData + analysisPrompt)`
   - Value: `{ summary, detectedActivity, extractedText }`
   - Hit Rate: 40-60% (duplicate screenshots common)

2. **Audio Transcription**
   - Key: `SHA-256(audioData + whisperModel)`
   - Value: `{ transcription, confidence }`
   - Hit Rate: 20-30% (silence segments)

3. **Summary Generation**
   - Key: `SHA-256(allData + summaryPrompt)`
   - Value: `{ summary, extractedTasks, extractedNotes }`
   - Hit Rate: 10-20% (exact duplicates rare)

**Implementation**:
```typescript
class MemoizationCache<T> {
  private cache = new Map<string, T>();
  private maxSize = 10000;  // LRU eviction

  async getOrCompute(
    key: string,
    computeFn: () => Promise<T>,
    ttl: number = 86400000  // 24 hours
  ): Promise<T>;

  // Backend stats only
  getStats(): { size: number; hitRate: number; evictions: number };
}
```

**UI Constraints**:
- Zero user-facing cost indicators
- All metrics logged to backend
- Optional stats in Settings → Advanced (hidden by default)

**Deliverables**:
- MemoizationCache implementation (~300 lines)
- Integration with AI services
- Backend statistics logging
- Unit tests (15+ tests)

**Success Metrics**:
- 30-50% reduction in API calls (logged)
- $2-5 savings per 100 sessions (logged)
- <1ms cache lookup time

#### Task 5.4: Cache Invalidation Strategy
**Priority**: MEDIUM
**Estimated**: 0.5 days
**Agent**: Caching Specialist

**Objective**: Smart cache invalidation rules

**Invalidation Triggers**:
1. **Content Changes**: Automatic (content-addressable)
2. **Prompt Updates**: Manual (user-initiated "re-enrich")
3. **Model Upgrades**: Automatic (new model versions)
4. **TTL Expiry**: Automatic (30 days default)

**Implementation**:
- Model version tracking
- Prompt fingerprinting
- Bulk invalidation API

**UI Constraints**:
- Invalidation happens silently in background
- No user notifications about cache invalidation
- Settings UI for manual cache clearing (admin only)

**Deliverables**:
- Invalidation logic (~200 lines)
- Settings UI for cache management (admin only)
- Tests (10+ tests)

---

### Wave 2: Parallel Processing (Tasks 5.5-5.8)
**Duration**: 3-4 days
**Dependencies**: Wave 1 complete
**Agents**: 2 specialists (can run in parallel)

#### Task 5.5: Parallel Enrichment Queue
**Priority**: HIGH
**Estimated**: 2 days
**Agent**: Queue Specialist

**Objective**: Process multiple sessions concurrently

**Current Problem**:
- Enrichment is serial (one session at a time)
- Wastes idle API capacity
- Slow for batch operations (enriching 50 sessions)

**Solution**:
```typescript
class ParallelEnrichmentQueue {
  private maxConcurrency = 5;  // Configurable
  private queue: EnrichmentJob[] = [];

  async enqueue(sessionId: string, options: EnrichmentOptions): Promise<string>;
  async processQueue(): Promise<void>;

  // Backend monitoring only
  getQueueStatus(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}
```

**Features**:
- Configurable concurrency (1-10 sessions)
- Priority queue (user-triggered > background)
- Progress tracking per session
- Error isolation (one failure doesn't block others)
- Rate limiting (respect API quotas)

**UI Constraints**:
- Simple progress indicator: "Enriching N sessions..."
- NO cost indicators during batch processing
- NO ETA based on cost estimates
- Success: "N sessions enriched successfully"

**Deliverables**:
- ParallelEnrichmentQueue implementation (~700 lines)
- Simple progress UI (no cost info)
- Backend monitoring
- Integration tests (20+ tests)

**Success Metrics**:
- 5x throughput increase (5 concurrent vs 1)
- Zero deadlocks
- 100% error isolation

#### Task 5.6: Worker Pool Management
**Priority**: MEDIUM
**Estimated**: 1.5 days
**Agent**: Concurrency Specialist

**Objective**: Efficient resource management for parallel processing

**Implementation**:
```typescript
class EnrichmentWorkerPool {
  private workers: EnrichmentWorker[] = [];
  private maxWorkers = 5;

  async acquireWorker(): Promise<EnrichmentWorker>;
  async releaseWorker(worker: EnrichmentWorker): Promise<void>;

  // Backend health monitoring
  getPoolStatus(): {
    active: number;
    idle: number;
    errorRate: number;
  };
}
```

**Features**:
- Worker lifecycle management
- Health checks
- Auto-restart on failure
- Resource cleanup

**UI Constraints**:
- NO worker status shown to users
- All health metrics backend only
- Settings UI for pool configuration (admin only)

**Deliverables**:
- Worker pool implementation (~500 lines)
- Backend health monitoring
- Auto-recovery logic
- Tests (15+ tests)

**Success Metrics**:
- 99.9% worker uptime
- <100ms worker acquisition time
- Zero resource leaks

#### Task 5.7: Progress Tracking
**Priority**: MEDIUM
**Estimated**: 1 day
**Agent**: UI Specialist

**Objective**: Real-time visibility into enrichment progress (no cost info)

**UI Components**:
1. **Batch Progress View**
   - Sessions in queue
   - Currently processing
   - Completion rate
   - Simple ETA ("~5 minutes remaining")
   - **NO COST INFO**

2. **Per-Session Progress**
   - "Analyzing audio..." (0-100%)
   - "Processing video..." (0-100%)
   - "Generating summary..." status
   - **NO COST ACCUMULATION**

**Example UI**:
```
┌─────────────────────────────────┐
│ Enriching 5 sessions...         │
│                                 │
│ [████████░░] 80%               │
│                                 │
│ 4 complete, 1 in progress      │
│ ~2 minutes remaining           │
└─────────────────────────────────┘
```

**Deliverables**:
- Progress tracking components (~400 lines)
- Real-time status updates (no cost data)
- Tests (10+ tests)

**Success Metrics**:
- Real-time updates (<1s latency)
- Accurate ETAs (±10% error)
- Clear error messaging (no cost implications)

#### Task 5.8: Error Handling & Retry
**Priority**: HIGH
**Estimated**: 1 day
**Agent**: Reliability Specialist

**Objective**: Robust error handling for production

**Error Categories**:
1. **Transient Errors** (retry automatically)
   - API rate limits → exponential backoff
   - Network timeouts → 3 retries
   - Service unavailable → circuit breaker

2. **Permanent Errors** (fail fast)
   - Invalid API key → notify user
   - Malformed data → log and skip
   - Cost exceeded → stop enrichment (logged, not shown to user)

3. **Partial Failures** (graceful degradation)
   - Audio fails → continue with video
   - Video fails → continue with audio
   - Summary fails → use basic summary

**User-Facing Error Messages** (NO COST MENTIONS):
- ❌ "Couldn't reach the API. Retrying..."
- ❌ "This session couldn't be enriched. Try again later."
- ✅ "Session partially enriched (audio only)"
- ❌ "Your API key needs to be configured"

**Implementation**:
```typescript
class EnrichmentErrorHandler {
  async handleError(
    error: Error,
    context: EnrichmentContext
  ): Promise<ErrorResolution>;

  // Circuit breaker
  shouldStopRetrying(errorHistory: Error[]): boolean;

  // Exponential backoff
  getRetryDelay(attemptNumber: number): number;

  // User-friendly messages (no cost info)
  getUserMessage(error: Error): string;
}
```

**Deliverables**:
- Error handling system (~400 lines)
- Circuit breaker implementation
- Retry logic with backoff
- User-friendly error messages
- Tests (20+ tests)

**Success Metrics**:
- 99% recovery rate for transient errors
- <10s max retry delay
- Clear error attribution (backend logs)

---

### Wave 3: Cost Optimization (Tasks 5.9-5.12)
**Duration**: 3-4 days
**Dependencies**: Wave 2 complete
**Agents**: 2 specialists (can run in parallel)

**Important**: All cost optimization is **backend only**. Users benefit from faster/better enrichment without seeing cost metrics.

#### Task 5.9: Smart API Usage
**Priority**: HIGH
**Estimated**: 2 days
**Agent**: AI Optimization Specialist

**Objective**: Reduce API costs through intelligent batching

**Optimization Strategies**:

1. **Screenshot Processing Strategy**

   **Real-time (Active Sessions):**
   - Model: Haiku 4.5 (4-5x faster)
   - Processing: Individual screenshots as captured
   - Compression: WebP @ 80%, 1920px max, ~300-500KB
   - Latency: 1.5-2.5 seconds per screenshot
   - Cost: ~$0.002 per screenshot
   - **Value**: Immediate insights while working

   **Batch (Post-Session):**
   - Model: Sonnet 4.5 with prompt caching
   - Processing: 20 screenshots per API call
   - Compression: Original quality
   - Latency: Async background (1-2min total)
   - Cost: ~$0.0005 per screenshot (90% cached savings)
   - Savings: 95% reduction in API calls vs individual
   - **Value**: Deep story and patterns

2. **Context Compression**
   - Remove duplicate text from prompts
   - Use references instead of full content
   - Savings: 30-50% token reduction

3. **Model Selection** (Claude 4.5 Family)
   - Simple analysis: Haiku 4.5 ($1 input / $5 output per MTok)
   - Complex analysis: Sonnet 4.5 ($3 input / $15 output per MTok)
   - Summary generation: Opus 4.1 ($15 input / $75 output per MTok)
   - Savings: 60-80% by using cheapest sufficient model

4. **Prompt Caching** (New!)
   - Cache repeated context (session metadata, instructions)
   - Savings: Up to 90% cost reduction + 85% latency reduction
   - Best for: Multi-screenshot batches with shared instructions

5. **Message Batches API** (New!)
   - Async batch processing (up to 10,000 requests)
   - Savings: 50% cost reduction for non-urgent enrichment
   - Best for: Background enrichment of historical sessions

**Implementation**:
```typescript
class SmartAPIUsage {
  // Real-time screenshot analysis (Haiku 4.5, compressed)
  async analyzeScreenshotRealtime(
    screenshot: Screenshot,
    sessionContext: SessionContext
  ): Promise<ScreenshotAnalysis> {
    // Compress image for faster upload & analysis
    const compressed = await this.compressScreenshot(screenshot, {
      format: 'webp',
      quality: 80,
      maxDimension: 1920,
      targetSize: '300-500KB'
    });

    // Use Haiku 4.5 for speed (4-5x faster)
    return await this.callClaude({
      model: 'claude-haiku-4-5-20251015',
      image: compressed,
      context: sessionContext,
      analysis: 'quick'  // Activity, OCR, basic insights
    });
  }

  // Batch screenshot analysis (Sonnet 4.5, up to 20 images)
  async batchScreenshotAnalysis(
    screenshots: SessionScreenshot[]
  ): Promise<ScreenshotAnalysis[]> {
    // Process in batches of 20 (API limit)
    const batches = chunk(screenshots, 20);

    return await Promise.all(batches.map(batch =>
      this.callClaudeWithCache({
        model: 'claude-sonnet-4-5-20250929',
        images: batch,
        analysis: 'deep',  // Story, patterns, connections
        cache_control: { type: 'ephemeral' }  // 90% savings
      })
    ));
  }

  // Image compression
  private async compressScreenshot(
    screenshot: Screenshot,
    options: CompressionOptions
  ): Promise<Blob> {
    // WebP compression optimized for Claude analysis
    // Maintains visual quality while reducing size 40-60%
  }

  // Choose model based on complexity and mode
  selectOptimalModel(task: AITask): ModelConfig;

  // Prompt caching for repeated context (90% savings)
  async analyzeWithCache(
    context: CachedContext,
    content: Content
  ): Promise<Analysis>;

  // Message Batches API for async enrichment (50% savings)
  async enqueueBatchEnrichment(
    sessions: Session[]
  ): Promise<BatchJobId>;

  // Backend cost tracking only
  private logCost(operation: string, cost: number): void;
}
```

**Prompt Caching Strategy**:
```typescript
// Cache shared instructions across multiple API calls
const cachedInstructions = {
  system: [
    {
      type: "text",
      text: "You are analyzing work session screenshots...",
      cache_control: { type: "ephemeral" }  // Cache this!
    }
  ]
};

// Each screenshot batch reuses cached instructions
// First call: Full cost
// Subsequent calls: 90% discount on cached portion
```

**Message Batches API Strategy**:
```typescript
// For non-urgent enrichment (historical sessions)
const batch = await anthropic.messages.batches.create({
  requests: sessions.map(session => ({
    custom_id: session.id,
    params: {
      model: 'claude-haiku-4-5-20251015',
      messages: [/* enrichment prompt */],
      max_tokens: 2048
    }
  }))
});

// Process results asynchronously (50% cost savings)
// Typical completion: < 1 hour for batches of 10,000
```

**UI Constraints**:
- All optimization is transparent to users
- No UI changes based on model selection
- Quality remains consistent regardless of model
- Cost savings logged to backend only

**Deliverables**:
- Smart API usage implementation (~1000 lines)
- Model selection heuristics (Claude 4.5 family)
- **Real-time screenshot analysis** (Haiku 4.5, 1.5-2.5s latency)
- **Image compression** (WebP @ 80%, 40-60% size reduction)
- Batch screenshot analysis (Sonnet 4.5, 20 images per call)
- Prompt compression logic
- Prompt caching integration (90% savings)
- Message Batches API integration (50% savings)
- A/B testing framework
- Backend cost logging
- Tests (30+ tests)

**Success Metrics**:
- Real-time analysis: 1.5-2.5s latency per screenshot
- Image compression: 40-60% size reduction, <1ms quality loss
- Batch analysis: 95% reduction in API calls (1→20 per call)
- 70-85% cost reduction with all optimizations (logged)
- Prompt caching: 90% savings on cached portions
- Message Batches API: 50% savings on async enrichment
- Quality maintained (>95% accuracy for Haiku, >98% for Sonnet)
- <50ms model selection time
- Users see immediate insights during active sessions

#### Task 5.10: Prompt Optimization
**Priority**: MEDIUM
**Estimated**: 1.5 days
**Agent**: Prompt Engineering Specialist

**Objective**: Better prompts for lower costs and higher quality

**Current Issues Identified** (from comprehensive audit):
- 40% token waste from duplicated content blocks
- Prompt caching not implemented (0 out of 5 major prompts)
- Few-shot examples missing from most prompts
- Some prompts lack XML structure
- Over-constrained schemas limiting AI creativity
- System/user prompt separation inconsistent

**Optimization Areas**:

1. **Token Efficiency**
   - Remove redundant instructions (40% savings potential identified)
   - Deduplicate repeated content blocks
   - Use few-shot examples (1-2 per prompt, not 5+)
   - Structured output with JSON schema
   - Implement token-efficient tool use (beta: `token-efficient-tools-2025-02-19`)

2. **Prompt Caching (90% savings)**
   - Split prompts into static (cached) + dynamic (uncached) blocks
   - Use `cache_control: { type: 'ephemeral' }` on static content
   - Cache: system instructions, schemas, guidelines, examples
   - Don't cache: user input, session data, timestamps
   - Minimum 1024 tokens to cache (Anthropic requirement)

3. **Structure & Format (Anthropic Best Practices)**
   - Use XML tags for clear sections: `<instructions>`, `<examples>`, `<schema>`
   - System prompt: High-level role, constraints, tool definitions
   - User prompt: Specific task, input data, context
   - Avoid overfitting: Use "should" not "must", allow AI creativity
   - Clear output format: Provide schema, not just description

4. **Few-Shot Examples**
   - Add 1-2 realistic examples per prompt (not generic templates)
   - Show edge cases and variations
   - Include reasoning in examples (why this output)
   - Balance: enough to guide, not so many to overfit

5. **Quality Improvement**
   - Task-specific prompts (don't mix responsibilities)
   - Clear success criteria
   - Explicit handling of edge cases
   - Allow AI flexibility where appropriate

6. **A/B Testing**
   - Compare prompt variants
   - Measure quality and cost
   - Automatic rollout of winners

**Best Practice Implementation Example**:
```typescript
// GOOD: Split static (cached) and dynamic (uncached) content
const buildOptimizedPrompt = (session: Session, screenshot: Screenshot) => {
  // Static content (cached with cache_control)
  const staticPrompt = `
<role>
You are an expert at analyzing work session screenshots to track progress.
</role>

<instructions>
Analyze the screenshot and identify:
1. Current activity (what is the user doing?)
2. Progress signals (achievements, completions, milestones)
3. Blockers (errors, stuck points, confusion)
4. Key extracted text (important code, messages, data)
</instructions>

<output_schema>
{
  "summary": "string (max 200 chars)",
  "detectedActivity": "string (enum: coding, debugging, testing, ...)",
  "progressIndicators": {
    "achievements": "string[]",
    "blockers": "string[]"
  },
  "confidence": "number (0-1)"
}
</output_schema>

<examples>
<example_1>
Input: VS Code with red squiggly lines in auth.js
Output: {
  "summary": "Syntax error in authentication module",
  "detectedActivity": "debugging",
  "progressIndicators": {
    "blockers": ["Syntax error in auth.js line 47"]
  },
  "confidence": 0.9
}
</example_1>
</examples>
`;

  // Dynamic content (not cached)
  const dynamicContext = `
<session_context>
Duration: ${session.duration}
Previous activity: ${session.lastActivity}
</session_context>

<screenshot>
[Image attached]
</screenshot>
`;

  return {
    contentBlocks: [
      {
        type: 'text',
        text: staticPrompt,
        cache_control: { type: 'ephemeral' }  // 90% savings after first call
      },
      {
        type: 'text',
        text: dynamicContext
      },
      {
        type: 'image',
        source: screenshot.data
      }
    ]
  };
};
```

**Token-Efficient Tool Use** (New 2025 feature):
```typescript
// Enable token-efficient tool calling (14-70% output token savings)
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251015',
  max_tokens: 2048,
  messages: [/* ... */],
  tools: [/* tool definitions */],
  betas: ['token-efficient-tools-2025-02-19']  // Add this!
});
```

**UI Constraints**:
- Prompt changes are invisible to users
- A/B testing happens in background
- Quality metrics tracked backend only

**Prompts to Optimize** (from audit):
1. Screenshot analysis (180 lines → 140 lines, add caching)
2. Session summary (285 lines → 180 lines, split live/completed)
3. Video chaptering (45 lines → add examples)
4. Capture processing (deduplicate 40% redundancy)
5. Session metadata (add few-shot examples)

**Deliverables**:
- Optimized prompt library (~600 lines, down from ~1000)
- Prompt caching implemented across all 5 prompts (90% savings)
- Token-efficient tool use beta enabled (14-70% output savings)
- 2-3 few-shot examples per prompt
- XML structure standardized
- A/B testing framework
- Quality measurement tools
- Backend analytics
- Best practices documentation

**Success Metrics**:
- 40-50% token reduction from deduplication (logged)
- 25-35% additional savings from prompt caching
- 14-70% output token savings from token-efficient tools
- Quality improvement: +10-20% (measured)
- Output consistency: +15-25% from examples
- A/B test framework operational
- Zero overfitting issues (maintain AI creativity)

#### Task 5.11: Adaptive Model Selection
**Priority**: MEDIUM
**Estimated**: 1 day
**Agent**: ML Specialist

**Objective**: Automatically choose the cheapest sufficient model

**Selection Heuristics**:
```typescript
function selectModel(task: AITask): ModelConfig {
  // Real-time screenshot analysis (speed critical)
  if (task.type === 'screenshot_analysis' && task.realtime) {
    return {
      model: 'claude-haiku-4-5-20251015',
      inputCost: 1.0,
      outputCost: 5.0,
      reason: '4-5x faster, 90% of Sonnet performance'
    };
  }

  // Simple classification and extraction
  if (task.type === 'classification' ||
      (task.type === 'extraction' && task.complexity < 5)) {
    return {
      model: 'claude-haiku-4-5-20251015',
      inputCost: 1.0,
      outputCost: 5.0,
      reason: 'Sufficient for simple tasks, 3x cheaper'
    };
  }

  // Session summarization and deep analysis
  if (task.type === 'summarization' || task.complexity >= 5) {
    return {
      model: 'claude-sonnet-4-5-20250929',
      inputCost: 3.0,
      outputCost: 15.0,
      reason: 'Best overall performance, outperforms Opus in most benchmarks'
    };
  }

  // RARE: Only for high-stakes complex reasoning
  // (Legal decisions, nested hypotheticals, multi-turn deduction)
  // NOT RECOMMENDED for session enrichment
  if (task.type === 'critical_reasoning' && task.stakes === 'high') {
    return {
      model: 'claude-opus-4-1-20250820',
      inputCost: 15.0,
      outputCost: 75.0,
      reason: 'Only for mission-critical complex reasoning (5x cost premium)'
    };
  }

  // Default: Sonnet 4.5 (best balance)
  return {
    model: 'claude-sonnet-4-5-20250929',
    inputCost: 3.0,
    outputCost: 15.0,
    reason: 'Superior to Opus for coding, cheaper, autonomous for 30+ hours'
  };
}
```

**Model Selection Philosophy for Sessions:**

| Task | Model | Reasoning |
|------|-------|-----------|
| **Real-time screenshot analysis** | Haiku 4.5 | 1.5-2.5s latency, 90% of Sonnet quality |
| **Post-session batch analysis** | Sonnet 4.5 | Best overall, outperforms Opus in benchmarks |
| **Session summarization** | Sonnet 4.5 | Superior to Opus for practical tasks |
| **Task extraction** | Haiku 4.5 | Sufficient accuracy, 3x cheaper |
| **Audio transcription insights** | Sonnet 4.5 | Complex reasoning, 5x cheaper than Opus |
| **Complex reasoning** | Opus 4.1 | ONLY for legal/financial high-stakes (rarely) |

**Why Opus 4.1 is NOT recommended for sessions:**
- ❌ Sonnet 4.5 outperforms Opus in coding (77.2% vs 74.5%)
- ❌ Sonnet 4.5 outperforms Opus in computer use (61.4% vs 44.4%)
- ❌ 5x cost premium not justified for enrichment quality
- ✅ Use Sonnet for 95% of enrichment, Haiku for 5% (real-time)

**Features**:
- Complexity scoring
- Historical success rates
- Fallback to stronger model on failure
- Cost/quality trade-off tuning

**UI Constraints**:
- Model selection is completely transparent
- No user indication of which model was used
- Quality is the only visible metric

**Deliverables**:
- Model selection engine (~400 lines)
- Complexity scoring algorithm
- Fallback logic
- Backend tracking
- Tests (15+ tests)

**Success Metrics**:
- 40-60% cost reduction from model selection alone (logged)
- Haiku 4.5 achieves 90% of Sonnet 4.5's performance
- <5% quality degradation (measured)
- 100% fallback success rate
- 4-5x faster processing with Haiku 4.5

#### Task 5.12: Cost Monitoring & Alerts (Backend Only)
**Priority**: HIGH
**Estimated**: 1 day
**Agent**: Monitoring Specialist

**Objective**: Backend cost tracking with Settings UI (admin only)

**Features**:
1. **Backend Logging**
   - Per-session cost (logged, not shown)
   - Daily/weekly/monthly totals
   - Cost per enrichment type
   - Model usage statistics

2. **Budget Controls** (backend enforcement)
   - Per-session limits (silent cutoff)
   - Daily spending caps
   - Alert thresholds (logs only)

3. **Settings UI** (Admin/Advanced Only)
   - Hidden under Settings → Advanced → System Health
   - Requires explicit navigation
   - Clearly labeled "Developer/Admin View"
   - Optional, not prominent

**Settings UI Example**:
```
Settings → Advanced → System Health
┌──────────────────────────────────┐
│ Enrichment Cost Analytics        │
│ (Developer View - Last 30 Days)  │
│                                  │
│ Total: $45.23                    │
│ Per Session: $0.18 avg          │
│                                  │
│ Model Usage:                     │
│ • Haiku: 65% of calls           │
│ • Sonnet: 30% of calls          │
│ • Opus: 5% of calls             │
│                                  │
│ Cache Hit Rate: 62%             │
│ Cost Savings: $23.10            │
└──────────────────────────────────┘
```

**Implementation**:
```typescript
class CostMonitoringService {
  // Backend tracking (always on)
  async logCost(sessionId: string, cost: number, metadata: CostMetadata): Promise<void>;

  // Backend aggregation
  async getDailyCosts(): Promise<number>;
  async getMonthlyCosts(): Promise<number>;

  // Budget enforcement (silent)
  async checkBudget(estimatedCost: number): Promise<boolean>;

  // Settings UI data (opt-in viewing)
  async getAdminDashboard(): Promise<CostDashboard>;
}
```

**UI Constraints**:
- NO cost indicators in main Sessions UI
- NO cost alerts/popups during normal usage
- Settings UI hidden under Advanced section
- Optional viewing for admins/developers
- All enforcement happens silently in backend

**Deliverables**:
- Backend cost monitoring service (~500 lines)
- Settings UI component (~200 lines)
- Alert system (logs only, no popups)
- Database schema for cost tracking
- Tests (15+ tests)

**Success Metrics**:
- <1 minute reporting latency
- 100% accurate cost attribution
- Zero user-facing cost anxiety
- 100% silent budget enforcement

---

### Wave 4: Quality & Polish (Tasks 5.13-5.14)
**Duration**: 2 days
**Dependencies**: Waves 1-3 complete
**Agents**: 1 specialist

#### Task 5.13: Integration Testing & Quality Assurance
**Priority**: HIGH
**Estimated**: 1 day
**Agent**: QA Specialist

**Test Coverage**:
1. **End-to-End Flows**
   - Single session enrichment
   - Batch enrichment (10 sessions)
   - Incremental enrichment
   - Cache hit scenarios
   - Cost limits (backend enforcement)

2. **Error Scenarios**
   - API failures
   - Cost limit exceeded (silent cutoff)
   - Malformed data
   - Concurrent enrichments

3. **Performance Tests**
   - Throughput benchmarks
   - Cache hit rate validation
   - Cost reduction verification (backend metrics)

4. **UI/UX Tests**
   - Verify NO cost indicators in main UI
   - Verify Settings UI is hidden/optional
   - Verify error messages have NO cost mentions
   - Verify progress indicators show NO cost data

**Deliverables**:
- Integration test suite (~800 lines)
- Performance benchmarks
- Quality metrics
- UI/UX verification checklist
- Verification report

**Success Metrics**:
- 100% critical path coverage
- All performance targets met
- Zero cost anxiety in UX
- Zero critical bugs

#### Task 5.14: Phase 5 Documentation
**Priority**: HIGH
**Estimated**: 1 day
**Agent**: Documentation Specialist

**Documents to Create/Update**:
1. **PHASE_5_SUMMARY.md** - Executive summary
2. **ENRICHMENT_OPTIMIZATION_GUIDE.md** - Best practices
3. **COST_OPTIMIZATION_GUIDE.md** - Developer guide (backend focus)
4. **CLAUDE.md** - Update enrichment section
5. **PROGRESS.md** - Mark Phase 5 complete

**UI/UX Documentation**:
- Document cost tracking philosophy (backend only)
- User-facing messaging guidelines (no cost mentions)
- Settings UI usage guide (admin only)

**Deliverables**:
- 5 comprehensive documents (~2,000 lines total)
- API reference updates
- Migration guide
- Troubleshooting guide
- UX philosophy doc

**Success Metrics**:
- Documentation complete
- Examples working
- All questions answered
- Cost philosophy documented

---

## Success Metrics

### Performance Targets

| Metric | Before Phase 5 | After Phase 5 | Target Improvement |
|--------|----------------|---------------|-------------------|
| Enrichment Cost | Baseline | -70% to -85% | **With caching+batching** |
| Processing Time | 60s | 9s (cached) | **85% reduction** |
| Cache Hit Rate | 0% | 60%+ | **New capability** |
| Batch Throughput | 1 session/min | 5 sessions/min | **5x faster** |
| API Efficiency | 1x | 20x (batching) | **20x improvement** |

**Note**: All cost metrics tracked in backend logs, not shown to users.

### Quality Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test Coverage | 90%+ | Vitest coverage report |
| Type Safety | 100% | 0 TypeScript errors |
| Cache Reliability | 99.9%+ | Cache hit/miss tracking |
| Error Recovery | 99%+ | Retry success rate |
| Cost Attribution | 100% | Exact cost tracking (backend) |
| User Cost Anxiety | 0% | No cost UI in main flow |

---

## Agent Execution Strategy

### Wave 0: Phase 4 Stabilization (Serial)
**Duration**: 2-3 days
**Priority**: BLOCKING

1. **Day 1**: TypeScript Specialist fixes all type errors
2. **Day 2-3**: Testing Specialist fixes test failures

**Blocker**: Cannot proceed to Wave 1 until complete

### Wave 1-3: Parallel Execution
**Duration**: 9-12 days
**Strategy**: Maximum parallelization

**Track A** (Caching):
- Task 5.1: Enrichment Result Cache (Days 1-2)
- Task 5.2: Incremental Enrichment (Days 3-4)
- Task 5.3: Memoization (Day 5)
- Task 5.4: Cache Invalidation (Day 5)

**Track B** (Processing):
- Task 5.5: Parallel Queue (Days 1-2)
- Task 5.6: Worker Pool (Days 3-4)
- Task 5.7: Progress Tracking (Day 5) **[NO COST UI]**
- Task 5.8: Error Handling (Day 6) **[NO COST ERRORS]**

**Track C** (Optimization - Backend Only):
- Task 5.9: Smart API Usage (Days 1-2) **[TRANSPARENT TO USERS]**
- Task 5.10: Prompt Optimization (Days 3-4) **[BACKEND ONLY]**
- Task 5.11: Adaptive Models (Day 5) **[TRANSPARENT]**
- Task 5.12: Cost Monitoring (Day 6) **[SETTINGS UI ONLY]**

### Wave 4: Sequential Polish
**Duration**: 2 days

1. **Day 1**: Integration testing **[VERIFY NO COST UI]**
2. **Day 2**: Documentation **[DOCUMENT COST PHILOSOPHY]**

---

## Risk Mitigation

### High-Risk Areas

1. **Phase 4 Stabilization Delays**
   - **Risk**: Type errors and test fixes take longer than expected
   - **Mitigation**: Allocate 3 days instead of 2, prioritize critical fixes
   - **Escalation**: If >5 days, reassess Phase 5 timeline

2. **Cache Complexity**
   - **Risk**: Cache invalidation bugs cause stale data
   - **Mitigation**: Comprehensive testing, conservative TTLs
   - **Escalation**: Add cache bypass flag for debugging

3. **API Rate Limits**
   - **Risk**: Parallel processing hits rate limits
   - **Mitigation**: Configurable concurrency, exponential backoff
   - **Escalation**: Reduce max concurrency, add request queuing

4. **Cost Overruns During Development**
   - **Risk**: Testing enrichment costs money
   - **Mitigation**: Use mock data, small test sessions
   - **Budget**: $50-100 for testing

5. **User Cost Anxiety**
   - **Risk**: Users see costs and become anxious
   - **Mitigation**: NO cost UI in main flow, Settings only
   - **Success Metric**: Zero user complaints about cost visibility

---

## Getting Started

### Prerequisites Checklist
- [x] Phase 4 complete and documented ✅
- [x] Type errors identified (28 errors) ✅
- [x] Test failures cataloged (160 failures) ✅
- [x] Phase 5 plan approved ✅
- [x] Cost UI philosophy approved ✅
- [ ] Agent resources allocated ⏳

### Kickoff Process

1. **Review Phase 4**
   - Read PHASE_4_SUMMARY.md
   - Understand storage architecture
   - Review enrichment service code

2. **Start Wave 0**
   - Launch TypeScript Specialist agent
   - Fix all 28 type errors
   - Launch Testing Specialist agent
   - Fix all test failures

3. **Validate Readiness**
   - Run `npm run type-check` (0 errors)
   - Run `npm test` (95%+ pass rate)
   - Run `cargo check` (no errors)

4. **Launch Wave 1**
   - Create detailed task briefs
   - Launch 2 agents in parallel
   - Daily progress tracking

---

## Next Actions

**Immediate** (Right Now):
1. [x] Review Phase 5 kickoff document ✅
2. [x] Approve execution strategy ✅
3. [x] Approve cost UI philosophy ✅
4. [ ] Allocate agent resources ⏳
5. [ ] Start Wave 0 Task 5.0.1 (TypeScript fixes)

**This Week** (Wave 0):
- [ ] Complete all Phase 4 stabilization work
- [ ] Validate readiness for Wave 1
- [ ] Prepare agent task briefs

**Next Week** (Wave 1):
- [ ] Launch caching implementation
- [ ] Begin incremental enrichment
- [ ] Start parallel processing design

---

## Quality Philosophy

### Code Quality
- Production-ready code (no TODOs, no placeholders)
- Comprehensive error handling
- Full test coverage (90%+)
- Type-safe implementations
- Performance benchmarks

### User Experience
- **Zero cost anxiety**: No cost indicators in main UI
- **Transparent optimization**: Users see speed, not savings
- **Clear progress**: Simple, friendly status messages
- **Graceful errors**: Helpful messages, no cost blame

### Developer Experience
- Backend cost tracking for optimization
- Settings UI for admin visibility (optional)
- Detailed logs for debugging
- Clear documentation

---

**Status**: ✅ Ready for Execution
**Priority**: HIGH (Phase 4 stabilization is blocking)
**Next Review**: After Wave 0 completion

---

**Created**: 2025-10-26
**Updated**: 2025-10-26 (Cost UI philosophy integrated)
**Maintained By**: Lead Architect / Project Manager
**Approved By**: Product Owner ✅
