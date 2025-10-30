# Chapter Markers - Completion Task Plan

## Current State
- ✅ All UI components built
- ✅ All services implemented (with mock data)
- ✅ Integration complete
- ⚠️ Chapters don't persist to session data
- ⚠️ Timeline and video don't update when chapters saved
- ⚠️ Using mock data (no real Claude API)

## Goal
Get chapter generation working end-to-end:
1. User clicks "Generate Chapters"
2. Real/mock chapters appear
3. User clicks "Save Chapters"
4. Session updates with chapters
5. Timeline regroups by chapters
6. Video player shows chapter chips
7. Everything works!

---

## Phase 1: Data Persistence (Critical Path)

### Task 1.1: Update Session Storage to Save Chapters
**File**: Find where sessions are stored (likely `src/services/sessionStorage.ts` or similar)

**What to do**:
1. Find the session update/save function
2. Add logic to save `session.video.chapters` array
3. Ensure chapters persist to localStorage/database

**Code pattern**:
```typescript
// In sessionStorage service
async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
  const session = await this.getSession(sessionId);

  // Merge updates including video.chapters
  const updatedSession = {
    ...session,
    ...updates,
    video: updates.video ? {
      ...session.video,
      ...updates.video
    } : session.video
  };

  // Save to storage
  await this.saveSession(updatedSession);
  return updatedSession;
}
```

**How to test**:
1. Generate chapters
2. Save chapters
3. Reload page
4. Chapters should still be there

**Estimated time**: 30-45 minutes

---

### Task 1.2: Connect ChapterGenerator Save to Session Storage
**File**: `src/services/videoChapteringService.ts` (line ~397)

**What to do**:
Update the `saveChapters` method to actually save to session storage:

```typescript
async saveChapters(sessionId: string, chapters: ChapterProposal[]): Promise<VideoChapter[]> {
  const videoChapters: VideoChapter[] = chapters.map(proposal => ({
    id: `chapter-${sessionId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    sessionId,
    startTime: proposal.startTime,
    endTime: proposal.endTime,
    title: proposal.title,
    summary: proposal.summary,
    keyTopics: proposal.keyTopics,
    confidence: proposal.confidence,
    createdAt: new Date().toISOString()
  }));

  // REPLACE THIS TODO with real implementation:
  const { getStorage } = await import('../services/storage');
  const sessions = await getStorage('sessions') || [];
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);

  if (sessionIndex !== -1) {
    // Update session with chapters
    sessions[sessionIndex] = {
      ...sessions[sessionIndex],
      video: {
        ...sessions[sessionIndex].video,
        chapters: videoChapters
      }
    };

    // Save back to storage
    const { setStorage } = await import('../services/storage');
    await setStorage('sessions', sessions);
  }

  console.log(`✅ [CHAPTERING] Saved ${videoChapters.length} chapters to session ${sessionId}`);
  return videoChapters;
}
```

**How to test**:
1. Generate chapters in UI
2. Click "Save Chapters"
3. Check browser DevTools → Application → Local Storage
4. Should see chapters in session data

**Estimated time**: 15-20 minutes

---

### Task 1.3: Fix Session Refresh After Chapter Save
**File**: `src/components/SessionDetailView.tsx` (lines ~210-220)

**Current issue**: The callback updates state but doesn't reload session from storage

**What to do**:
```typescript
// In SessionDetailView.tsx, update the onSessionUpdate callback:
onSessionUpdate={async (updatedSession) => {
  // Reload session from storage to get saved chapters
  const { getStorage } = await import('../services/storage');
  const sessions = await getStorage('sessions') || [];
  const freshSession = sessions.find(s => s.id === session.id);

  if (freshSession) {
    setCurrentSession(freshSession);
  }

  // Show success notification
  dispatch({
    type: 'ADD_NOTIFICATION',
    payload: {
      type: 'success',
      title: 'Chapters Saved',
      message: 'Chapter markers have been added to the video',
    },
  });
}}
```

**How to test**:
1. Save chapters
2. Timeline should immediately regroup
3. Video player should show chapter chips
4. No page reload needed

**Estimated time**: 10-15 minutes

---

## Phase 2: UI State Updates (Make it Reactive)

### Task 2.1: Force Timeline to Re-render After Chapter Save
**File**: `src/components/SessionReview.tsx`

**What to do**:
Ensure SessionReview passes the updated session to ReviewTimeline:

```typescript
// In SessionReview.tsx
export function SessionReview({
  session,  // This should be the LATEST session with chapters
  onSessionUpdate,
  // ... other props
}: SessionReviewProps) {

  // When session prop updates, ReviewTimeline will auto re-render
  // with new chapters because it's reading session.video?.chapters

  return (
    <>
      {/* VideoPlayer gets updated session */}
      <VideoPlayer session={session} ... />

      {/* ChapterGenerator */}
      {hasVideo && session.status === 'completed' && (
        <ChapterGenerator
          session={session}
          onChaptersSaved={() => {
            // Trigger session reload in parent
            onSessionUpdate?.(session);
          }}
        />
      )}

      {/* ReviewTimeline gets updated session */}
      <ReviewTimeline session={session} ... />
    </>
  );
}
```

**How to test**:
1. Save chapters
2. Timeline should show chapter headers immediately
3. Video should show chapter chips immediately

**Estimated time**: 10 minutes

---

### Task 2.2: Add Loading State to ChapterGenerator
**File**: `src/components/ChapterGenerator.tsx`

**What to do**:
Add loading state when saving chapters:

```typescript
const [isSaving, setIsSaving] = useState(false);

const handleSave = async () => {
  setIsSaving(true);
  try {
    await videoChapteringService.saveChapters(session.id, proposals);
    onChaptersSaved(); // This triggers parent reload
    setProposals([]); // Clear proposals
  } catch (error) {
    console.error('Failed to save chapters:', error);
    // Show error notification
  } finally {
    setIsSaving(false);
  }
};

// Update button:
<button
  onClick={handleSave}
  disabled={isSaving}
  className="..."
>
  {isSaving ? 'Saving...' : 'Save Chapters'}
</button>
```

**How to test**:
1. Click "Save Chapters"
2. Button should show "Saving..." briefly
3. Then clear and show success

**Estimated time**: 10 minutes

---

## Phase 3: Testing & Bug Fixes

### Task 3.1: End-to-End Test Flow
**Test scenario**:
1. ✅ Navigate to completed session with video
2. ✅ Go to Review tab
3. ✅ See "AI Chapter Markers" section
4. ✅ Click "Generate Chapters"
5. ✅ See 2 mock chapter proposals
6. ✅ Click "Save Chapters"
7. ✅ See success notification
8. ✅ Timeline regroups by chapters (2 sections)
9. ✅ Chapter chips appear below video (2 chips)
10. ✅ Click chapter chip → video seeks to that time
11. ✅ Active chapter highlights while playing
12. ✅ Reload page → chapters still there

**If any fail**: Debug and fix

**Estimated time**: 30-45 minutes

---

### Task 3.2: Test Edge Cases
**Test scenarios**:

1. **No chapters saved yet**
   - Timeline should show flat (existing behavior)
   - No chapter chips in video player
   - ChapterGenerator shows "Generate Chapters" button

2. **Session without video**
   - ChapterGenerator should not appear
   - No chapter chips
   - Timeline works normally

3. **Active session**
   - ChapterGenerator should not appear (only for completed sessions)

4. **Generate chapters twice**
   - Second generation should replace first
   - No duplicates

**Estimated time**: 20-30 minutes

---

### Task 3.3: Fix VideoPlayer Chapter Navigation
**File**: `src/components/VideoPlayer.tsx`

**Potential issue**: The `seekToTime` function might not exist or work correctly

**What to check**:
```typescript
// Ensure this function works:
const seekToTime = (seconds: number) => {
  if (videoRef.current) {
    videoRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  }
};

// And chapter chips call it:
<ChapterChip
  onClick={() => seekToTime(chapter.startTime)}
  ...
/>
```

**How to test**:
1. Click each chapter chip
2. Video should jump to that time
3. Timeline should highlight items in that chapter

**Estimated time**: 15-20 minutes

---

## Phase 4: Polish & UX Improvements

### Task 4.1: Add Empty State for No Chapters
**File**: `src/components/ChapterGenerator.tsx`

**What to do**:
Add helpful text when no chapters generated yet:

```typescript
{proposals.length === 0 && !isGenerating && (
  <p className="text-xs text-gray-600 mt-2">
    Click "Generate Chapters" to automatically detect topic transitions in your session video.
    You can review and edit the proposals before saving.
  </p>
)}
```

**Estimated time**: 5 minutes

---

### Task 4.2: Add Chapter Count Badge
**File**: `src/components/VideoPlayer.tsx`

**What to do**:
Show how many chapters exist:

```typescript
{session.video?.chapters && session.video.chapters.length > 0 && (
  <div className="mt-4">
    <div className="text-xs text-gray-500 mb-2">
      {session.video.chapters.length} chapters
    </div>
    <div className="flex flex-wrap gap-2">
      {/* Chapter chips */}
    </div>
  </div>
)}
```

**Estimated time**: 5 minutes

---

### Task 4.3: Improve Chapter Generation Feedback
**File**: `src/components/ChapterGenerator.tsx`

**What to do**:
Better loading state during generation:

```typescript
{isGenerating && (
  <div className="mt-4 text-center">
    <div className="inline-flex items-center gap-2 text-sm text-gray-600">
      <div className="animate-spin h-4 w-4 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
      Analyzing session timeline and video frames...
    </div>
    <p className="text-xs text-gray-500 mt-2">
      This may take 5-10 seconds
    </p>
  </div>
)}
```

**Estimated time**: 10 minutes

---

## Phase 5: Optional Claude API Integration

### Task 5.1: Enable Real Claude API (Optional)
**Files**:
- `src/services/videoChapteringService.ts`
- `src/services/videoAnalysisAgent.ts`

**What to do**:
1. Set environment variable: `ANTHROPIC_API_KEY`
2. Uncomment real Claude API implementations
3. Test with real video analysis

**Note**: This is OPTIONAL for testing - mock data works fine for now!

**Estimated time**: 15-20 minutes (if doing now)

---

## Summary Task Checklist

### Critical Path (Must Complete)
- [ ] Task 1.1: Update session storage to save chapters (30-45min)
- [ ] Task 1.2: Connect save to storage (15-20min)
- [ ] Task 1.3: Fix session refresh callback (10-15min)
- [ ] Task 2.1: Ensure UI updates reactively (10min)
- [ ] Task 2.2: Add loading state to save (10min)
- [ ] Task 3.1: End-to-end test flow (30-45min)
- [ ] Task 3.2: Test edge cases (20-30min)
- [ ] Task 3.3: Fix video seeking (15-20min)

**Total Critical Path: ~2.5 - 3.5 hours**

### Polish (Nice to Have)
- [ ] Task 4.1: Empty state (5min)
- [ ] Task 4.2: Chapter count badge (5min)
- [ ] Task 4.3: Better loading feedback (10min)

**Total Polish: ~20 minutes**

### Optional
- [ ] Task 5.1: Real Claude API (15-20min)

---

## Recommended Approach

### Session 1 (1-1.5 hours): Core Persistence
1. Task 1.1 - Session storage
2. Task 1.2 - Connect save
3. Task 1.3 - Fix refresh
4. Quick test to verify chapters save

### Session 2 (1 hour): UI Updates
1. Task 2.1 - Reactive updates
2. Task 2.2 - Loading states
3. Task 3.1 - End-to-end test
4. Fix any bugs found

### Session 3 (30-45 min): Edge Cases & Polish
1. Task 3.2 - Edge cases
2. Task 3.3 - Video seeking
3. Tasks 4.1-4.3 - Polish

---

## Testing Checklist

After completing all tasks, verify:

1. **Generation Works**
   - [ ] Can click "Generate Chapters"
   - [ ] See mock/real chapter proposals
   - [ ] Proposals show title, summary, confidence, topics

2. **Saving Works**
   - [ ] Can click "Save Chapters"
   - [ ] See success notification
   - [ ] Proposals clear after save

3. **Persistence Works**
   - [ ] Chapters appear in timeline (grouped)
   - [ ] Chapters appear in video (chips)
   - [ ] Reload page → chapters still there

4. **Navigation Works**
   - [ ] Click chapter chip → video seeks
   - [ ] Play video → active chapter highlights
   - [ ] Timeline scrolls to active section

5. **Edge Cases Work**
   - [ ] No chapters → flat timeline
   - [ ] No video → no chapter UI
   - [ ] Active session → no generator

---

## File Reference

**Need to modify**:
1. `src/services/storage.ts` or similar (session persistence)
2. `src/services/videoChapteringService.ts` (line ~397)
3. `src/components/SessionDetailView.tsx` (line ~210-220)
4. `src/components/ChapterGenerator.tsx` (add loading states)
5. `src/components/VideoPlayer.tsx` (verify seeking works)

**Already complete**:
- ReviewTimeline.tsx (chapter grouping logic ✅)
- VideoPlayer.tsx (chapter chips UI ✅)
- ChapterGenerator.tsx (generation UI ✅)
- videoFrameExtractor.ts (frame extraction ✅)

---

## Success Criteria

When done, users should be able to:
1. Generate chapters for any completed session with video
2. Review AI-proposed chapters
3. Save chapters
4. See timeline grouped by chapters immediately
5. Navigate video using chapter chips
6. Reload page and chapters persist
7. Everything works smoothly with no bugs

**Let's get it done! 🚀**
