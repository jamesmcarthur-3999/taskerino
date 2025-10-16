# Sessions Feature Roadmap

**Last Updated:** 2025-10-10

---

## 📋 Current State (Completed)

### Core Functionality ✅
- [x] Session lifecycle management (start, pause, resume, stop)
- [x] Automatic screenshot capture (configurable interval, default 2min)
- [x] AI vision analysis of screenshots using Claude Sonnet 4.5
- [x] Timeline view with AI analysis results
- [x] User comments on screenshots
- [x] Screenshot flagging system
- [x] Session summary generation (tasks, notes, time breakdown)
- [x] Navigation island integration for quick session controls
- [x] Context window system (maintains last 5 screenshots for better AI context)
- [x] Activity type tracking
- [x] Tag support for sessions

### What Works Well
- Screenshot capture is reliable and non-intrusive
- AI analysis provides valuable insights (activity detection, OCR, suggested actions)
- Session controls are easily accessible from navigation
- Timeline provides good chronological view of work

### Known Limitations
- Cannot view actual screenshot images (only see AI analysis)
- Suggested tasks/notes from AI aren't actionable (can't easily save them)
- Past sessions are just a list - hard to explore or get value from
- No visual representation of time spent on different activities
- Storage can grow large with screenshots (need cleanup)

---

## 🎯 High Priority Features

### 1. Screenshot Viewer/Gallery 🖼️
**Status:** ✅ COMPLETED
**Priority:** CRITICAL
**Estimated Effort:** Medium
**Completed:** 2025-10-10

**Description:**
Users need to actually SEE their screenshots, not just the AI analysis.

**Requirements:**
- Click screenshot in timeline → opens full-size image viewer
- Modal with zoom, pan, full-screen capabilities
- Navigate between screenshots with arrow keys (← →)
- ESC to close
- Show timestamp, AI analysis alongside image
- Responsive design (works on different screen sizes)

**Technical Notes:**
- Load images from attachmentStorage
- Consider lazy loading for performance
- Use `<img>` with base64 data or blob URLs
- Add image caching to avoid repeated storage reads

**Files to Modify:**
- `SessionTimeline.tsx` - add click handler to screenshot cards
- Create new `ScreenshotViewer.tsx` component
- `attachmentStorage.ts` - ensure efficient image retrieval

---

### 2. Session Detail Page 📊
**Status:** ✅ COMPLETED
**Priority:** HIGH
**Estimated Effort:** Large
**Completed:** 2025-10-10

**Description:**
Transform past sessions from a simple list into rich, explorable detail views.

**Requirements:**
- Click past session → navigate to dedicated detail page
- Header: session name, description, date, duration, status
- Stats cards: total time, screenshots captured, activities detected, tasks/notes extracted
- Visual timeline (horizontal or vertical) showing activity flow
- Full screenshot gallery view
- Export session as PDF report
- Activity breakdown charts (pie chart or bar chart)
- All screenshots with AI analysis
- Edit session metadata (name, description, tags)
- Delete session with confirmation

**Visual Design Ideas:**
- Timeline visualization like GitHub contributions graph
- Color-coded activity blocks
- Productivity metrics / insights
- "Session at a glance" summary card

**Technical Notes:**
- Add routing (or use modal overlay approach)
- Create reusable chart components
- PDF export using browser print API or library
- Consider session analytics calculations

**Files to Create:**
- `SessionDetailView.tsx` - main detail page component
- `SessionActivityChart.tsx` - activity breakdown visualization
- `SessionStats.tsx` - stats cards component

**Files to Modify:**
- `SessionsZone.tsx` - make SessionCard clickable
- `types.ts` - add any new analytics types

---

### 3. Task/Note Extraction Workflow ✅→📝
**Status:** ✅ COMPLETED
**Priority:** HIGH
**Estimated Effort:** Medium
**Completed:** 2025-10-10

**Description:**
Make AI-suggested tasks and insights actionable with one-click capture.

**Requirements:**
- "Add to Tasks" button on each suggested action in AI analysis
- "Save as Note" button on insights
- Quick "Create Task" modal pre-filled with AI suggestion
- Quick "Create Note" modal pre-filled with insight
- Link created tasks/notes back to session (sourceSessionId field)
- Bulk action: "Extract all suggested tasks from this session"
- Session summary view showing extracted tasks/notes with links

**User Flow:**
1. User reviews session timeline
2. Sees AI suggested action: "Follow up with client about feedback"
3. Clicks "Add to Tasks"
4. Task modal opens, pre-filled
5. User adjusts priority/due date, saves
6. Task appears in Tasks zone with link back to session

**Technical Notes:**
- Add `sourceSessionId` field to Task and Note types
- Create lightweight task/note creation modals
- Update SessionTimeline to show action buttons
- Add session reference in created items

**Files to Modify:**
- `SessionTimeline.tsx` - add action buttons to AI analysis
- `types.ts` - add sourceSessionId to Task and Note
- Create `QuickTaskFromSession.tsx` modal
- Create `QuickNoteFromSession.tsx` modal
- `AppContext.tsx` - update task/note creation to include session reference

---

### 4. Visual Activity Timeline 📈
**Status:** ✅ COMPLETED
**Priority:** HIGH
**Estimated Effort:** Medium
**Completed:** 2025-10-10

**Description:**
Show at-a-glance what the user worked on and when using a visual timeline.

**Requirements:**
- Horizontal timeline showing session duration
- Activity blocks color-coded by type (email=blue, coding=purple, docs=green, etc.)
- Hover over block → see activity name and duration
- Click block → jump to that screenshot in timeline
- Show time markers (hours)
- Compact view for session cards (mini timeline)
- Detailed view for session detail page (full timeline)

**Visual Design:**
```
9am    10am   11am   12pm   1pm    2pm
|------|------|------|------|------|
  [Email] [Code........] [Meeting] [Code]
```

**Activity Type Colors:**
- Email: Blue (#3B82F6)
- Coding: Purple (#8B5CF6)
- Documentation: Green (#10B981)
- Meetings: Orange (#F59E0B)
- Design: Pink (#EC4899)
- Other: Gray (#6B7280)

**Technical Notes:**
- Calculate activity blocks from screenshot analysis
- Group consecutive same-activity screenshots
- Use CSS grid or flexbox for timeline layout
- Make responsive (vertical on mobile?)

**Files to Create:**
- `SessionActivityTimeline.tsx` - timeline visualization
- `activityUtils.ts` - helper functions for activity grouping/calculations

---

## 🔧 Medium Priority Features

### 5. Session Templates 🎯
**Status:** Not Started
**Priority:** MEDIUM
**Estimated Effort:** Small

**Description:**
Pre-configured session types for common workflows.

**Template Examples:**
- **Deep Work** - 30min screenshots, focus on code/writing detection
- **Email Triage** - 5min screenshots, focus on communication apps
- **Meetings** - 10min screenshots, focus on video call apps
- **Creative Work** - 15min screenshots, focus on design tools
- **Research** - 20min screenshots, focus on browser/reading

**Requirements:**
- Template picker when starting session
- Each template has: name, description, default interval, custom AI prompt
- Save custom templates
- Edit/delete custom templates

---

### 6. Manual Screenshot Trigger 📸
**Status:** Not Started
**Priority:** MEDIUM
**Estimated Effort:** Small

**Description:**
Capture important moments on demand, not just at intervals.

**Requirements:**
- "Capture Now" button in navigation island when session active
- Global keyboard shortcut (e.g., Cmd+Shift+S)
- Manual screenshots marked differently in timeline (star icon?)
- Option to add comment immediately after manual capture

---

### 7. Session Search & Filters 🔍
**Status:** Not Started
**Priority:** MEDIUM
**Estimated Effort:** Medium

**Requirements:**
- Search sessions by name, description, tags
- Search within session analysis text (full-text search)
- Filter by date range (last week, last month, custom)
- Filter by tags
- Filter by activity type
- Sort by: newest, oldest, longest, most screenshots

---

### 8. Screenshot Management 🗑️
**Status:** Not Started
**Priority:** MEDIUM
**Estimated Effort:** Small

**Requirements:**
- Delete individual screenshots from timeline
- Bulk delete screenshots from session
- Auto-cleanup: delete sessions older than X days (configurable)
- Storage usage indicator in Settings
- "Clear old sessions" utility (keeps summaries, deletes screenshots)

---

## 💎 Polish & UX Improvements

### 9. Better Empty States
**Status:** Not Started
**Priority:** LOW
**Estimated Effort:** Small

- Better "no past sessions yet" message
- Session feature walkthrough/demo
- Tips for getting most value from sessions
- Example session showcase

---

### 10. Session Stats Dashboard 📊
**Status:** Not Started
**Priority:** LOW
**Estimated Effort:** Large

**Requirements:**
- Weekly/monthly productivity overview
- Most common activities (pie chart)
- Average session duration
- Total productive hours tracked
- Activity trends over time (line chart)
- Insights: "You code most productively between 10-12pm"

---

## 💡 Your Ideas

_Space for you to add your own ideas and thoughts as we develop_

**Add your ideas here:**
-
-
-

---

## 📝 Development Notes

### Technical Debt / Future Improvements
- Consider compressing screenshots before storage (reduce size by 50-70%)
- Add session export formats: JSON, Markdown, PDF
- Session sharing/collaboration features?
- Integration with time tracking tools?
- Multi-monitor support for screenshots?

### Performance Considerations
- Lazy load screenshots in timeline (virtualized list for 100+ screenshots)
- Cache AI analysis results to avoid re-processing
- Background cleanup service for old sessions
- Optimize storage queries (index by session ID)

---

## 🚀 Next Steps

**Immediate Focus:**
1. Screenshot Viewer - Most critical missing piece
2. Task Extraction Flow - Make AI insights actionable
3. Session Detail View - Make past sessions valuable

**To Discuss:**
- Preferred visual design for activity timeline
- Screenshot storage limits and cleanup strategy
- Session templates you'd find most useful
- Analytics/insights you want to see

---

## 📊 Progress Tracking

### Sprint 1: Core Viewing Experience
- [x] Screenshot Viewer/Gallery ✅
- [x] Session Detail Page ✅
- [x] Visual Activity Timeline ✅

### Sprint 2: Making It Actionable
- [x] Task/Note Extraction Workflow ✅
- [ ] Manual Screenshot Trigger
- [ ] Session Templates

### Sprint 3: Management & Polish
- [ ] Session Search & Filters
- [ ] Screenshot Management
- [ ] Better Empty States

### Sprint 4: Analytics & Insights
- [ ] Session Stats Dashboard
- [ ] Activity trends
- [ ] Productivity insights

---

**Questions? Ideas? Feedback?** Add notes here as we develop! 🎉
