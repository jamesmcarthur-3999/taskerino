# Capture Flow Testing Guide

## Complete User Flow (Capture → Process → Review → Save)

### Prerequisites
**⚠️ IMPORTANT: You must set your Claude API key first!**

1. Click the **Profile** button (user icon) in top-right
2. Go to **Settings** tab
3. Paste your Anthropic API key
4. Click **Save API Key**

Without an API key, processing will fail with: _"API key not set. Please configure your Claude API key in Settings."_

---

## Step-by-Step Flow

### 1. **Capture a Note**
- Type or paste text into the capture box
- Optionally add attachments (images, files, screenshots)
- Click **"Process & File"** or press `⌘+Enter`

**What Happens:**
- ✅ Input clears immediately
- ✅ Toast notification: "Processing in Background"
- ✅ You can immediately capture another note!

### 2. **Background Processing**
The "Recent Activity" section appears below the capture box showing:

**Processing Jobs:**
- Spinner icon + progress bar
- Current step (e.g., "🤖 AI is analyzing your note...")
- Progress percentage (0% → 100%)

**Example:**
```
🔄 Processing your note...        45%
"Had a call with Sarah about the new project..."
🤖 AI is analyzing your note...
[===========>     ] 45%
```

### 3. **Processing Complete**
When AI finishes, the card changes to:

**Completed Jobs:**
- ✅ Green checkmark
- Timestamp
- Note/task counts: "2 notes, 3 tasks"
- **Two buttons:**
  - 🔵 **"Review & Save"** - Opens review modal to edit results
  - ⚪ **"Dismiss"** - Discards results

**Example:**
```
✅ Processing Complete!         3:45 PM
"Had a call with Sarah about the new project..."
📝 2 notes  ✓ 3 tasks
[Review & Save →] [Dismiss]
```

### 4. **Review Results**
Click **"Review & Save"** to open the ResultsReview modal:

- **Topics Detected:** Edit or remove detected topics
- **Notes Created:** Review/edit note content and summaries
- **Tasks Extracted:** Edit titles, priorities, due dates
  - Toggle checkboxes to remove unwanted tasks
  - Edit inline to customize

### 5. **Save to Your Library**
After reviewing:
- Click **"Save All"** at bottom of review modal
- Notes/tasks/topics are saved to your library
- Learning system records your edits
- Success screen appears
- Job removed from Recent Activity

### 6. **View Saved Items**
- **Notes:** Click "Library" tab → See all notes organized by topic
- **Tasks:** Click "Tasks" tab → See all extracted tasks with due dates/priorities

---

## Error Handling

### If Processing Fails:

**Error Jobs show in Recent Activity:**
```
⚠️ Processing Failed
"Your note text..."
API key not set. Please configure your Claude API key in Settings.
[Go to Settings →] [Dismiss]
```

**Common Errors:**
1. **"API key not set"** → Click "Go to Settings" → Add your Anthropic API key
2. **Rate limit exceeded** → Wait a few minutes, then try again
3. **Network error** → Check internet connection

---

## Testing Checklist

### Basic Flow
- [ ] Set API key in Profile > Settings
- [ ] Capture a note with text
- [ ] See processing job appear with progress
- [ ] Wait for completion (green checkmark)
- [ ] Click "Review & Save"
- [ ] Review modal opens with detected topics/notes/tasks
- [ ] Edit tasks (change title, priority, due date)
- [ ] Click "Save All"
- [ ] Success screen appears
- [ ] Job removed from Recent Activity
- [ ] Go to "Library" tab → See your note
- [ ] Go to "Tasks" tab → See your tasks

### Advanced Testing
- [ ] Capture multiple notes quickly (queue multiple jobs)
- [ ] Review and save first job while second processes
- [ ] Dismiss a completed job without saving
- [ ] Capture with attachments (images/PDFs)
- [ ] Test with no API key → See error message
- [ ] Click "Go to Settings" from error → Navigate to settings

---

## What Gets Saved?

When you click "Save All" in the review modal:

### Topics
- New topics created for companies, projects, people mentioned
- Or matched to existing topics

### Notes
- Content saved with rich formatting
- AI-generated summary
- Auto-extracted tags (#hashtags)
- Linked to detected topic
- Metadata: sentiment, key points

### Tasks
- Title, description
- Priority (low/medium/high/urgent)
- Due date (AI-inferred or manually set)
- Status (todo/in-progress/done)
- Linked to source note and topic

### Learnings (Background)
- AI tracks your edits
- Learns your preferences over time
- E.g., if you always change "urgent" to "high", AI learns this pattern

---

## Troubleshooting

### "I don't see my notes/tasks!"
**Cause:** You need to click "Review & Save" to actually save results.

**Solution:**
1. Look for completed jobs in Recent Activity (green checkmark)
2. Click "Review & Save" button
3. Click "Save All" in the review modal
4. Then check Library/Tasks tabs

### "Processing never completes"
**Possible causes:**
- Invalid API key
- Network issues
- API rate limits

**Solution:**
1. Check browser console (F12) for errors
2. Verify API key in Settings
3. Try dismissing and re-capturing

### "Processing is too slow"
**Why:** AI processing takes 10-20 seconds depending on:
- Input length
- Number of topics to match
- Task complexity

**But:** Background processing lets you continue capturing while AI works!

---

## Top Navigation Indicator

The **🔄 indicator** in top-right shows:
- Spinner + count when processing: `🔄 2` (2 jobs processing)
- Checkmark + count when complete: `✅ 3` (3 jobs ready)
- Click to expand dropdown with all job details

This is your **global processing queue** - works across all tabs!

---

## Key Features

✅ **Non-blocking**: Capture multiple notes while AI processes
✅ **Review before saving**: Edit AI results before committing
✅ **Error recovery**: Clear error messages with action buttons
✅ **Visual feedback**: Progress bars, step indicators, timestamps
✅ **Learning system**: AI improves based on your edits
✅ **Queue visibility**: See all processing/completed jobs

---

## Next Steps After Testing

Once you verify the flow works:
1. Try capturing real meeting notes
2. Test task extraction with action items
3. Review how AI groups related notes by topic
4. Check how learnings improve over multiple captures
5. Use Command Palette (⌘K) to search across all notes
