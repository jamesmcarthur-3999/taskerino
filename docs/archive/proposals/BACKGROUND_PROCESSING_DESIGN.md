# Background Processing UX Design

## Problem
Current capture flow blocks the entire UI with a loading screen during AI processing (20-40 seconds). User cannot capture more notes while waiting.

## Solution: Background Processing

### User Flow

#### 1. Capture & Submit
```
User types note → Clicks Submit
  ↓
✅ Input cleared immediately
✅ Notification: "Processing in background..."
✅ User can continue capturing
✅ Top nav shows: 🔄 indicator with count
```

#### 2. While Processing
```
Top Navigation:
  [Capture] [Tasks] [Library] [AI] [🔄 1] [Search] [Profile]
                                   ↑
                          Click to see details

Dropdown shows:
  📝 Processing (1)
  ─────────────
  "Meeting notes with John..."
  ⚡ Analyzing content... 45%
  [View Progress]

  ✅ Ready for Review (0)
  (none)
```

#### 3. Processing Complete
```
✅ Notification: "Note processed! 3 tasks found. [Review Now]"

Top Navigation:
  [Capture] [Tasks] [Library] [AI] [✅ 1] [Search] [Profile]
                                   ↑
                            Ready for review

Dropdown shows:
  📝 Processing (0)
  (none)

  ✅ Ready for Review (1)
  ─────────────
  "Meeting notes with John..."
  3 tasks, 2 topics detected
  [Review & Save] [Dismiss]
```

#### 4. Review Results
```
User clicks "Review & Save"
  ↓
Opens ResultsReview modal (full screen)
  ↓
User edits tasks, confirms
  ↓
Saves to library
  ↓
Job removed from queue
```

---

## Components to Build

### 1. ProcessingIndicator (Top Nav)
- Shows count of processing + ready jobs
- Click opens dropdown
- Icons: 🔄 (processing) or ✅ (ready)

### 2. ProcessingDropdown
- List of processing jobs with progress
- List of completed jobs ready for review
- Actions: View Progress, Review & Save, Dismiss

### 3. ProcessingProgressModal
- Shows detailed progress for a specific job
- Live updates as processing happens
- Can minimize back to background

### 4. Updated ResultsReview
- Can be opened from queue
- Shows which job it's reviewing
- After save, removes from queue

---

## State Updates

### Processing Job Structure
```typescript
interface ProcessingJob {
  id: string;
  type: 'note' | 'task';
  input: string;
  inputPreview: string; // First 50 chars
  status: 'queued' | 'processing' | 'complete' | 'error';
  progress: number; // 0-100
  currentStep?: string;
  processingSteps?: string[];
  result?: AIProcessResult;
  error?: string;
  createdAt: string;
  completedAt?: string;
  attachments?: Attachment[];
}
```

### Actions
- `ADD_PROCESSING_JOB` - When user submits
- `UPDATE_PROCESSING_JOB` - Update progress
- `COMPLETE_PROCESSING_JOB` - When AI returns
- `REMOVE_PROCESSING_JOB` - After review & save
- `DISMISS_PROCESSING_JOB` - User dismisses without reviewing

---

## Implementation Plan

### Phase 1: Core Background Processing
1. Create background processor service
2. Update CaptureZone to use background processing
3. Add jobs to queue instead of blocking
4. Process jobs asynchronously

### Phase 2: UI Indicators
1. Add ProcessingIndicator to TopNavigation
2. Create ProcessingDropdown component
3. Wire up to state

### Phase 3: Review Flow
1. Update ResultsReview to work with queued jobs
2. Add "Review" action to dropdown
3. Handle save/dismiss

### Phase 4: Progress Details
1. Create ProcessingProgressModal
2. Show live progress updates
3. Allow minimize

---

## Benefits

✅ **Non-blocking** - Can capture multiple notes
✅ **Awareness** - Always see what's processing
✅ **Flexible** - Review results when ready
✅ **Parallel** - Process multiple notes simultaneously
✅ **Progressive** - See progress without blocking

---

## Technical Considerations

### Async Processing
- Use Web Workers or background service
- Queue jobs with priority
- Process one at a time (API rate limits)
- Update state on progress

### State Sync
- Jobs persist in localStorage
- Survive page refresh
- Resume processing on reload

### Error Handling
- Show errors in dropdown
- Allow retry
- Dismiss errors

---

## Next Steps

1. Implement background processor service
2. Update CaptureZone submit flow
3. Add ProcessingIndicator to TopNavigation
4. Create ProcessingDropdown
5. Update ResultsReview for queue
6. Test complete flow
