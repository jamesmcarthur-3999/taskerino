# Adaptive Screenshots Implementation Plan

## Overview
Add intelligent, activity-driven screenshot capture as an option alongside existing fixed intervals. The system balances user value (better context capture) with cost optimization (fewer redundant screenshots).

## Goals
- **User Value**: Capture screenshots when activity is high or AI needs more context
- **Cost Optimization**: Reduce captures during idle periods or when context is clear
- **Flexibility**: Keep as an opt-in feature alongside fixed intervals

## Architecture

### 1. Activity Monitoring Layer (Rust/Tauri)
**Location**: `src-tauri/src/activity_monitor.rs`

Lightweight event tracking:
- App/window switches (NSWorkspace on macOS)
- Mouse clicks via event tap
- Keyboard events via event tap
- Window focus changes

**Exposed Command**: `get_activity_metrics(window_seconds: u64) -> ActivityMetrics`

Returns:
```rust
struct ActivityMetrics {
    app_switches: u32,
    mouse_clicks: u32,
    keyboard_events: u32,
    window_focus_changes: u32,
    timestamp: String,
}
```

**Privacy**: Only counts events, no content logging

### 2. Adaptive Scheduler (TypeScript)
**Location**: `src/services/adaptiveScreenshotScheduler.ts`

Core algorithm:
```typescript
// Weighted scoring
activityScore = normalize(appSwitches, mouseClicks, windowChanges)  // 0-1
aiCuriosityScore = AI feedback from last analysis                   // 0-1
finalUrgency = (activityScore × 0.65) + (aiCuriosityScore × 0.35)

// Calculate delay
minDelay = 2000ms      // Maximum capture rate (2 seconds)
maxDelay = 300000ms    // Minimum capture rate (5 minutes, safety net)
nextDelay = maxDelay - (finalUrgency × (maxDelay - minDelay))
```

**Normalization weights**:
- App switches: 50% (>10 switches in 60s = max score)
- Mouse clicks: 30% (>50 clicks in 30s = max score)
- Window focus changes: 20% (>8 changes in 60s = max score)

### 3. AI Curiosity Integration
**Location**: `src/services/sessionsAgentService.ts`

Enhance screenshot analysis to return curiosity score:
```typescript
aiAnalysis: {
  summary: string;
  curiosity: number;          // NEW: 0-1 score
  curiosityReason?: string;   // NEW: Why AI wants more info
  // ... existing fields
}
```

**AI Curiosity Levels**:
- **0.0-0.3**: Clear understanding, low priority for next capture
- **0.4-0.6**: Moderate interest, normal capture rate
- **0.7-1.0**: High uncertainty, error detected, or blocker - capture sooner

**Prompt Enhancement**:
```
Additionally, provide a "curiosity" score (0.0-1.0) indicating how much
you would benefit from seeing the next screenshot sooner:

- 0.0-0.3: Clear, steady work. Low priority for next screenshot.
- 0.4-0.6: Normal work progress. Standard capture timing.
- 0.7-1.0: Error messages, blockers, context changes, or ambiguity detected.
           Would benefit greatly from seeing next screenshot sooner.

Include brief curiosityReason explaining your score.
```

### 4. UI Integration
**Location**: `src/components/sessions/IntervalControl.tsx`

Add "Adaptive" option to interval selector:
```typescript
const INTERVAL_OPTIONS: IntervalOption[] = [
  { value: -1, label: 'Adaptive' },  // NEW: Special value for adaptive mode
  { value: 10/60, label: '10s' },
  { value: 0.5, label: '30s' },
  { value: 1, label: '1m' },
  { value: 2, label: '2m' },
  { value: 3, label: '3m' },
  { value: 5, label: '5m' },
];
```

**Visual indicator**: Show when adaptive is active and display estimated next capture time

### 5. Type System Updates
**Location**: `src/types.ts`

```typescript
export interface Session {
  // Existing fields...
  screenshotInterval: number;  // -1 = adaptive mode, >0 = fixed interval
  adaptiveSettings?: {
    lastActivityScore: number;
    lastCuriosityScore: number;
    nextCaptureEstimate: string;  // ISO timestamp
  };
}

export interface ActivityMetrics {
  appSwitches: number;
  mouseClicks: number;
  keyboardEvents: number;
  windowFocusChanges: number;
  timestamp: string;
}
```

## Example Scenarios

| Scenario | Activity Score | AI Curiosity | Final Urgency | Next Delay |
|----------|---------------|--------------|---------------|------------|
| Deep focus coding | 0.2 | 0.3 | 0.235 | ~228s (3.8min) |
| Rapid app switching | 0.9 | 0.4 | 0.725 | ~84s (1.4min) |
| Error encountered | 0.4 | 0.95 | 0.593 | ~121s (2min) |
| Reading docs | 0.1 | 0.2 | 0.135 | ~258s (4.3min) |
| Idle period | 0.05 | 0.15 | 0.085 | ~273s (4.6min) |

## Implementation Strategy

### Phase 1: Foundation (Activity Monitoring)
- [ ] Create Rust activity monitor module
- [ ] Implement macOS event tracking
- [ ] Add privacy-conscious event counting
- [ ] Expose Tauri command for metrics
- [ ] Test activity tracking independently

### Phase 2: Adaptive Scheduler
- [ ] Create adaptive scheduler service
- [ ] Implement scoring algorithm
- [ ] Add normalization functions
- [ ] Replace setInterval with dynamic setTimeout
- [ ] Add logging/debugging mode

### Phase 3: AI Integration
- [ ] Update AI prompt for curiosity scoring
- [ ] Parse curiosity from AI response
- [ ] Feed curiosity back to scheduler
- [ ] Test AI scoring accuracy

### Phase 4: UI & Polish
- [ ] Add "Adaptive" option to interval control
- [ ] Show next capture estimate in UI
- [ ] Add debug panel (dev mode only)
- [ ] Update session detail view
- [ ] Add analytics/metrics tracking

### Phase 5: Testing & Refinement
- [ ] Test with various work patterns
- [ ] Tune weights and thresholds
- [ ] Compare screenshot counts: adaptive vs fixed
- [ ] Gather cost metrics
- [ ] A/B test with users

## Cost Optimization Strategy

**Baseline**: 2-minute interval = 30 screenshots/hour = 720/day (24h)

**Expected with Adaptive**:
- Deep focus work: ~15-20 screenshots/hour (50% reduction)
- Mixed activity: ~20-25 screenshots/hour (25% reduction)
- High-context work: ~30-35 screenshots/hour (similar or slight increase)

**Cost Savings**: Estimated 30-40% reduction in screenshot processing costs

## Privacy & Permissions

**Required macOS Permissions**:
- Screen recording (already required)
- Accessibility (for mouse/keyboard monitoring)
- Input monitoring (optional, for enhanced tracking)

**User Control**:
- Clear opt-in for adaptive mode
- Can switch back to fixed intervals anytime
- Activity data never leaves device
- No keystroke logging, only event counts

## Success Metrics

1. **User Value**:
   - Higher-quality session summaries
   - Better capture of important moments
   - Fewer redundant screenshots in timeline

2. **Cost Efficiency**:
   - 30-40% reduction in screenshots during idle periods
   - Similar or better capture during active periods

3. **User Adoption**:
   - Track % of sessions using adaptive mode
   - User feedback on accuracy

## Rollout Plan

1. **Phase 1**: Internal testing (dev mode only)
2. **Phase 2**: Beta flag for early adopters
3. **Phase 3**: General availability as opt-in
4. **Phase 4**: Potentially make default (if metrics are strong)

## Technical Considerations

### Performance
- Activity monitoring: <1% CPU overhead
- Metric polling: Every 5-10 seconds
- No blocking operations in main thread

### Battery Impact
- Minimal - event monitoring is passive
- Reduce capture frequency saves battery

### Network/Storage
- Fewer screenshots = less storage
- Fewer AI analysis calls = cost savings

## Future Enhancements

- **Machine learning**: Learn user patterns over time
- **Context-aware**: Different weights for different activity types
- **User feedback loop**: Let users flag missed important moments
- **Cross-platform**: Windows/Linux activity monitoring

---

## References
- Main implementation: `src/services/adaptiveScreenshotScheduler.ts`
- Activity monitor: `src-tauri/src/activity_monitor.rs`
- AI integration: `src/services/sessionsAgentService.ts`
- UI controls: `src/components/sessions/IntervalControl.tsx`
