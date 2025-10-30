# Background Enrichment - User Guide

**Version**: 1.0
**Date**: 2025-10-28
**Audience**: Taskerino Users

---

## What is Background Enrichment?

Background Enrichment is Taskerino's smart post-session processing system that automatically optimizes your session recordings and generates AI-powered insights **in the background** while you continue working.

### What Changed?

**Before**: When you ended a session, you had to wait 2-3 seconds for the video to load, and AI enrichment only happened if you manually clicked "Enrich".

**Now**: When you end a session, Taskerino immediately optimizes your video and starts enriching it **automatically** in the background. Your videos load **instantly**, take up **60% less storage**, and enrichment happens **reliably** even if you close the app.

---

## Key Benefits

### 1. Instant Video Playback

**What you'll notice**: Sessions open immediately, no more 2-3 second loading delay.

**Why**: Taskerino now creates a single optimized video file right after you end a session. This file is ready to play instantly, with perfect audio/video synchronization built in.

### 2. 60% Smaller Files

**What you'll notice**: Sessions take up much less disk space.

**Example**:
- Before: 500MB per 30-minute session
- After: 200MB per 30-minute session

**Why**: Taskerino compresses your videos using advanced H.264 encoding with optimized settings, reducing file size without losing quality.

### 3. Reliable Enrichment

**What you'll notice**: Enrichment always completes, even if you navigate away or close the app.

**Why**: Enrichment jobs are stored persistently. If you close Taskerino mid-enrichment, it will automatically resume when you reopen the app.

### 4. Non-Blocking Workflow

**What you'll notice**: After ending a session, you can immediately start a new session or work on something else while the old session processes in the background.

**Why**: Media optimization and AI enrichment run in the background without blocking your workflow. You'll get a notification when it's done.

---

## How It Works

### Step-by-Step Flow

#### 1. End Your Session

Click the "End Session" button as usual.

```
┌────────────────────────┐
│                        │
│   [End Session]        │
│                        │
└────────────────────────┘
```

#### 2. Processing Screen Appears

You'll see a full-screen progress indicator showing two stages:

**Stage 1: Combining Audio (0-50%)**
```
🎵 Combining Audio
▰▰▰▰▰▱▱▱▱▱ 45%
Merging audio segments into single file...
```

**Stage 2: Optimizing Video (50-100%)**
```
🎬 Optimizing Video
▰▰▰▰▰▰▰▰▱▱ 80%
Creating optimized video with audio...
```

**Duration**: Typically 30-40 seconds for a 30-minute session.

#### 3. Auto-Navigate to Session

When processing finishes, you'll see:

```
✨ Complete!
▰▰▰▰▰▰▰▰▰▰ 100%
Your session is ready to view

[View Session] button
```

After 2 seconds, Taskerino automatically navigates to your session detail page. Or you can click "View Session" to go there immediately.

#### 4. Background Enrichment Continues

While you view your session (or do anything else), Taskerino is enriching it in the background:

- **Audio Review**: Analyzing your audio commentary for key insights
- **Video Chaptering**: Identifying important moments in your recording
- **Summary Generation**: Creating a comprehensive session summary

You'll see a small indicator in the top navigation showing active enrichments:

```
TopNavigation
┌────────────────────────────────────────┐
│ 🔄 Enriching 2 sessions... (click)     │
└────────────────────────────────────────┘
```

Click it to see detailed progress.

#### 5. Notification When Complete

When enrichment finishes, you'll get an OS-level notification:

```
┌──────────────────────────────────┐
│ Taskerino                        │
│ Session Enriched!                │
│ My Work Session is ready         │
└──────────────────────────────────┘
```

Click the notification to jump directly to your enriched session.

---

## Using Enriched Sessions

### Viewing Your Optimized Video

1. Open any session from the Sessions list
2. The video player loads **instantly** (no delay)
3. Play/pause/seek work smoothly
4. Audio and video are perfectly synchronized

**Note**: If you open an **old session** (created before this update), you might notice a slight delay (2-3 seconds) while Taskerino prepares the audio. This is normal and only happens for legacy sessions.

### Exploring AI Insights

Once enrichment completes, your session includes:

**1. Audio Insights** - Key points from your audio commentary:
```
📝 Audio Insights

• Discussed authentication bug in login flow
• Decided to refactor user service for better testability
• Noted that API performance needs optimization
• Completed 3 out of 5 tasks from sprint backlog
```

**2. Video Chapters** - Important moments in your session:
```
📺 Video Chapters

00:05:23 - Started debugging authentication issue
00:12:45 - Implemented user service refactor
00:18:30 - Ran performance benchmarks
00:25:10 - Reviewed pull request feedback
```

Click any chapter to jump directly to that moment in the video.

**3. Session Summary** - AI-generated overview:
```
📊 Session Summary

Focus: Authentication system refactoring
Duration: 30 minutes
Tasks Completed: 3/5

This session focused on refactoring the authentication system. You debugged
a login flow issue, implemented a cleaner user service architecture, and
ran performance benchmarks. Key decisions included moving to a service-based
pattern and implementing better error handling.

Next Steps:
- Complete remaining 2 tasks from sprint
- Optimize API response times
- Write unit tests for user service
```

**4. Visual Canvas** - Interactive session review interface showing timeline, tasks, screenshots, and insights in a beautiful layout.

---

## Checking Enrichment Status

### TopNavigation Indicator

While enrichment is running, you'll see a badge in the top navigation:

```
┌────────────────────────────────────────┐
│ 🔄 Enriching 3 sessions... (click)     │
└────────────────────────────────────────┘
```

**Click it** to expand the enrichment panel:

```
┌────────────────────────────────────────────────┐
│ Background Enrichment                          │
├────────────────────────────────────────────────┤
│ Session A: My Work Session                     │
│ Audio Review [━━━━━━━░░░░░░] 70%               │
│                                                 │
│ Session B: Bug Investigation                   │
│ Summary Generation [━━━░░░░░░░░] 30%           │
│                                                 │
│ Session C: Code Review                         │
│ Waiting... [░░░░░░░░░░░░] 0%                   │
└────────────────────────────────────────────────┘
```

### Session Status Badge

In the Sessions list, enriching sessions show a badge:

```
┌─────────────────────────────────────┐
│ 🔄 My Work Session                  │
│ 30 minutes · Just now · Enriching...│
└─────────────────────────────────────┘
```

Once complete, the badge changes:

```
┌─────────────────────────────────────┐
│ ✅ My Work Session                  │
│ 30 minutes · 5 minutes ago          │
└─────────────────────────────────────┘
```

---

## Common Scenarios

### Scenario 1: "I closed Taskerino mid-enrichment"

**No problem!** Enrichment jobs are saved persistently. When you reopen Taskerino:

1. The enrichment panel shows pending jobs
2. Enrichment automatically resumes where it left off
3. You'll get a notification when complete

**Example**: You start enrichment for 3 sessions, then close Taskerino to take a break. When you return an hour later, all 3 sessions are fully enriched and ready.

### Scenario 2: "I want to start a new session while the old one is processing"

**Go ahead!** Media processing and enrichment run in the background. You can:

- Start a new session immediately
- Switch to a different zone (Tasks, Library, etc.)
- Close and reopen Taskerino
- Do anything else

The old session will continue processing. You'll get a notification when it's done.

### Scenario 3: "Can I cancel enrichment?"

**Yes!** In the enrichment panel, click the "Cancel" button next to any job:

```
┌────────────────────────────────────────────────┐
│ Session A: My Work Session                     │
│ Audio Review [━━━━━░░░░░░░] 50%   [Cancel]     │
└────────────────────────────────────────────────┘
```

The job will be cancelled immediately. The session will still be viewable, but it won't have AI-generated insights.

### Scenario 4: "Enrichment failed with an error"

**Taskerino will automatically retry**. Enrichment jobs retry up to 3 times with exponential backoff:

- Attempt 1: Immediate
- Attempt 2: After 1 second
- Attempt 3: After 2 seconds
- Attempt 4: After 4 seconds

If all retries fail, you'll see an error in the enrichment panel:

```
┌────────────────────────────────────────────────┐
│ Session A: My Work Session                     │
│ ❌ Failed: Network connection error  [Retry]   │
└────────────────────────────────────────────────┘
```

Click "Retry" to try again, or close the error to dismiss it.

### Scenario 5: "I don't see the processing screen"

**This is expected** if you navigate away quickly after ending a session. The processing screen is **non-blocking** - you can navigate away and processing continues in the background.

To check progress:
1. Look for the enrichment indicator in TopNavigation
2. Click it to see detailed status
3. Or just wait for the notification when complete

---

## FAQ

### Q: How long does processing take?

**A**: Typical times for a 30-minute session:
- Media optimization: 30-40 seconds
- Audio review: 10-30 seconds
- Video chaptering: 20-60 seconds
- Summary generation: 5-15 seconds
- **Total**: 1-2 minutes from session end to fully enriched

### Q: Does this use more battery/CPU?

**A**: Media processing is CPU-intensive but brief (30-40 seconds). AI enrichment is mostly network-bound (API calls to Claude/GPT-4), so CPU usage is minimal. Overall impact is negligible.

### Q: Can I disable automatic enrichment?

**A**: Currently, enrichment is automatic for all sessions. If you want to skip enrichment:
1. Let it fail gracefully (don't retry)
2. Or request a feature to disable auto-enrich in Settings

### Q: What happens to old sessions?

**A**: Old sessions (created before this update) still work perfectly. They use the "legacy playback mode" with the old audio/video sync logic. You might notice:
- Slight delay (2-3 seconds) when opening
- Larger file sizes (not optimized)

New sessions use optimized playback automatically.

### Q: Why do I see a delay for some sessions but not others?

**A**: New sessions (with optimized video) load instantly. Old sessions (without optimized video) need 2-3 seconds to prepare audio. This is expected and only affects sessions created before the background enrichment system was enabled.

### Q: Can I delete the original files after optimization?

**A**: Not yet. Taskerino keeps original files for potential AI reprocessing or higher-quality exports. Future updates may add an option to delete originals after enrichment completes.

### Q: Does this work offline?

**A**: Media optimization works offline (it's all local processing). AI enrichment requires internet connection to call Claude/GPT-4 APIs. If offline, enrichment will wait until you're back online and then resume automatically.

---

## Tips & Tricks

### Tip 1: Prioritize Important Sessions

When you end a session, it's automatically queued for enrichment with **normal priority**. If you want it enriched immediately, you can:

1. Open the enrichment panel
2. Find your session
3. Click "Prioritize" to move it to the front of the queue

**Note**: This feature is planned but not yet implemented in v1.0.

### Tip 2: Batch Enrich Historical Sessions

Have old sessions that never got enriched? You can batch enrich them:

1. Go to Sessions zone
2. Select multiple sessions (checkbox)
3. Click "Enrich Selected" in the actions menu

**Note**: This feature is planned but not yet implemented in v1.0.

### Tip 3: Monitor Storage Savings

Want to see how much space you've saved with optimization?

1. Go to Settings
2. Navigate to "Storage" section
3. View "Optimized Sessions" metric showing total savings

**Note**: This feature is planned but not yet implemented in v1.0.

---

## Troubleshooting

### Problem: Processing screen stuck at 0%

**Possible causes**:
- Background media processor hasn't started yet
- Large video file taking longer than usual

**Solution**:
1. Wait 10-15 seconds (large files can take time to start)
2. If still stuck, navigate away and check enrichment panel
3. If job shows "Failed", click "Retry"

### Problem: Enrichment never completes

**Possible causes**:
- Network connection issues
- API rate limits hit
- Session data corrupted

**Solution**:
1. Check enrichment panel for error message
2. Click "Retry" to attempt again
3. Check network connection
4. If persists, report bug with session ID

### Problem: Video plays but audio is out of sync

**This should not happen with optimized videos**. If you experience this:

1. Check if session has `video.optimizedPath` in session data
2. If yes, this is a bug - report it
3. If no, this is a legacy session - sync issues were known in old system

### Problem: Storage full during optimization

**Optimization requires ~140% space temporarily**:
- Original files: 500MB
- Optimized files: 200MB
- **Total during processing**: 700MB

If storage is full:
1. Free up space (delete old sessions or files)
2. Restart enrichment (it will retry automatically)

### Problem: Notification doesn't appear

**Possible causes**:
- OS notifications disabled for Taskerino
- Notification permissions not granted

**Solution**:
1. Check system preferences → Notifications
2. Enable notifications for Taskerino
3. Restart app and try again

---

## Getting Help

If you encounter issues not covered in this guide:

1. **Check Logs**: In the enrichment panel, failed jobs show error messages
2. **Retry**: Most errors are transient (network issues) - retry usually works
3. **Report Bug**: If problem persists, report with:
   - Session ID
   - Error message from enrichment panel
   - Steps to reproduce

---

## What's Next?

Future enhancements planned:

- **Manual priority control**: Move jobs to front of queue
- **Batch enrichment**: Enrich multiple sessions at once
- **Storage management**: Delete originals after optimization
- **Offline enrichment**: Queue enrichment when offline, process when online
- **Custom enrichment settings**: Choose which AI features to enable per session

---

**Document Version**: 1.0
**Last Updated**: 2025-10-28
**Questions**: Contact support or see developer documentation
