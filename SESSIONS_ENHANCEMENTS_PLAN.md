# Sessions Page Enhancement Plan

## Overview
Complete enhancement of the Sessions page to improve usability, discoverability, and workflow efficiency.

---

## Phase 1: Session Templates & Quick Start (HIGHEST PRIORITY)

### Goals
- Reduce friction for starting new sessions
- Allow users to reuse common session configurations
- Enable one-click session starts

### Implementation Details

#### 1.1 Template Storage System
**Location:** `src/utils/sessionTemplates.ts` (new file)

**Data Structure:**
```typescript
interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji or lucide icon name
  screenshotInterval: number;
  audioMode: 'off' | 'transcription' | 'description';
  tags: string[];
  isDefault: boolean; // Can't be deleted
}
```

**Functions:**
- `getTemplates(): SessionTemplate[]` - Load from localStorage
- `saveTemplate(template: SessionTemplate): void` - Save new template
- `deleteTemplate(id: string): void` - Delete custom template
- `getDefaultTemplates(): SessionTemplate[]` - Return built-in templates

**Default Templates:**
1. Deep Work Session (3h, 2m intervals, no audio)
2. Quick Task (30m, 30s intervals, no audio)
3. Meeting Notes (1h, 1m intervals, transcription)
4. Design Session (2h, 3m intervals, no audio)
5. Debugging (1h, 30s intervals, description audio)

#### 1.2 Template Selector UI
**Location:** `EmptySessionCard` component in `SessionsZone.tsx`

**UI Layout:**
```
┌─────────────────────────────────────┐
│  Start New Session                  │
├─────────────────────────────────────┤
│  📋 Templates (or start from scratch)│
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│  │ 🎯   │ │ ⚡   │ │ 📝   │ │ 🎨   ││
│  │Deep  │ │Quick │ │Meet  │ │Design││
│  │Work  │ │Task  │ │Notes │ │      ││
│  └──────┘ └──────┘ └──────┘ └──────┘│
│  [+ Create Custom Template]          │
├─────────────────────────────────────┤
│  [Description field...]              │
│  [Interval selector...]              │
│  [Audio toggle...]                   │
│  [💾 Save as Template] [▶️ Start]   │
└─────────────────────────────────────┘
```

**Behavior:**
- Click template → Auto-fill form
- Form becomes editable after template selection
- "Save as Template" button appears when form is modified
- Templates show preview: duration, interval, audio mode

#### 1.3 Quick Start Dropdown
**Location:** Above `EmptySessionCard` when no active session

**UI:**
```
┌──────────────────────────────────┐
│ ⚡ Quick Start                   │
│ ┌─────────────────────────────┐ │
│ │ 🎯 Deep Work Session        │ │
│ │ ⚡ Quick Task               │ │
│ │ 📝 Meeting Notes            │ │
│ │ ─────────────────────────── │ │
│ │ Custom Templates:           │ │
│ │ 🔬 Code Review              │ │
│ └─────────────────────────────┘ │
└──────────────────────────────────┘
```

**Behavior:**
- Clicking starts session immediately with template settings
- Uses template name as session name
- Prompts for description in a modal before starting

---

## Phase 2: Enhanced Search (SECOND HIGHEST PRIORITY)

### Goals
- Find sessions based on content, not just metadata
- Faster navigation with autocomplete
- Search history for common queries

### Implementation Details

#### 2.1 Search in Screenshot Analyses
**Location:** Modify `filteredSessions` useMemo in `SessionsZone.tsx`

**Logic:**
```typescript
const filteredSessions = useMemo(() => {
  let filtered = allPastSessions;

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(s => {
      // Search in basic fields
      const basicMatch = s.name.toLowerCase().includes(query) ||
                        s.description.toLowerCase().includes(query) ||
                        (s.summary?.narrative || '').toLowerCase().includes(query);

      // Search in screenshot analyses
      const screenshotMatch = s.screenshots?.some(screenshot =>
        screenshot.analysis?.activities?.some(activity =>
          activity.toLowerCase().includes(query)
        ) ||
        screenshot.analysis?.observations?.toLowerCase().includes(query)
      );

      return basicMatch || screenshotMatch;
    });
  }

  return filtered;
}, [allPastSessions, searchQuery]);
```

#### 2.2 Search Suggestions Dropdown
**Location:** Below search input in `SessionsZone.tsx`

**Features:**
- Show matching sessions as you type (limit 5)
- Show recent searches from localStorage
- "Press Enter to see all X results"

**UI:**
```
┌────────────────────────────────────┐
│ 🔍 [debugging bug fix___]         │
├────────────────────────────────────┤
│ Sessions matching "debugging":     │
│ • Debugging Session - Oct 10       │
│ • Bug Fix Sprint - Oct 8           │
│ ────────────────────────────────   │
│ Recent Searches:                   │
│ • "code review"                    │
│ • "client meeting"                 │
│ ────────────────────────────────   │
│ Press Enter to see all 12 results  │
└────────────────────────────────────┘
```

#### 2.3 Search Chips
**Location:** Above session results, below search bar

**UI:**
```
┌────────────────────────────────────┐
│ Active Filters:                    │
│ [🔍 "debugging" ✕] [🏷️ Work ✕]   │
│ [Clear all filters]                │
└────────────────────────────────────┘
```

---

## Phase 3: Advanced Filters

### Goals
- Find sessions by duration, date range, activity level
- Sort sessions beyond chronological order
- Combine multiple filter criteria

### Implementation Details

#### 3.1 Sort Dropdown
**Location:** Above session groups, right side

**Options:**
- Most Recent (default)
- Oldest First
- Longest Duration
- Shortest Duration
- Most Screenshots
- Most Tasks Extracted

**State:**
```typescript
const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc' | 'screenshots' | 'tasks'>('date-desc');
```

#### 3.2 Duration Filter
**Location:** Next to tag filters

**UI:** Button group
```
[ All ] [ <30m ] [ 30m-1h ] [ 1h-3h ] [ >3h ]
```

#### 3.3 Date Range Picker
**Location:** Next to duration filter

**Options:**
- Today
- Yesterday
- Last 7 days
- Last 30 days
- Custom (opens date picker)

**Note:** This can replace or supplement the current "Today/Yesterday/This Week" grouping

---

## Phase 4: Bulk Operations

### Goals
- Delete multiple sessions at once for cleanup
- Apply tags to multiple sessions
- Export multiple sessions

### Implementation Details

#### 4.1 Select Mode Toggle
**Location:** Header next to search bar

**UI:**
```
┌────────────────────────────────────┐
│ [🔍 Search...] [Select] [Filters]  │
└────────────────────────────────────┘
```

**State:**
```typescript
const [selectMode, setSelectMode] = useState(false);
const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
```

#### 4.2 Checkboxes on Cards
**Location:** Top-left of each SessionCard

**Behavior:**
- Only visible when `selectMode === true`
- Click card → toggle checkbox (instead of opening detail view)
- Click checkbox → toggle selection

**UI:**
```
┌─[☑️]─────────────────────────────┐
│  Session Title                   │
│  AI Summary...                   │
└──────────────────────────────────┘
```

#### 4.3 Floating Action Bar
**Location:** Fixed at bottom of screen when selections exist

**UI:**
```
┌────────────────────────────────────┐
│ 3 sessions selected                │
│ [🗑️ Delete] [🏷️ Tag] [📤 Export] [✕ Cancel] │
└────────────────────────────────────┘
```

**Actions:**
- Delete: Confirm dialog, then delete all selected
- Tag: Modal with tag selector (add/remove tags)
- Export: Choose format, download ZIP
- Cancel: Clear selections, exit select mode

#### 4.4 Select All
**Location:** Above session list when in select mode

**UI:**
```
┌────────────────────────────────────┐
│ [☐ Select All (12)] [Sort ▼]       │
└────────────────────────────────────┘
```

---

## Phase 5: Export & Backup

### Goals
- Save session data for backup
- Share sessions with team/clients
- Archive old sessions

### Implementation Details

#### 5.1 Export Utility Functions
**Location:** `src/utils/sessionExport.ts` (new file)

**Functions:**

```typescript
// Export single session as JSON
exportSessionJSON(session: Session): void {
  const data = {
    session,
    exportedAt: new Date().toISOString(),
    version: '1.0'
  };
  downloadFile(JSON.stringify(data, null, 2), `session-${session.id}.json`, 'application/json');
}

// Export single session as Markdown
exportSessionMarkdown(session: Session): void {
  const markdown = `
# ${session.name}

**Date:** ${new Date(session.startTime).toLocaleDateString()}
**Duration:** ${formatDuration(session.totalDuration)}
**Screenshots:** ${session.screenshots.length}

## Description
${session.description}

## AI Summary
${session.summary?.narrative || 'No summary available'}

## Achievements
${session.summary?.achievements?.map(a => `- ${a}`).join('\n') || 'None'}

## Blockers
${session.summary?.blockers?.map(b => `- ${b}`).join('\n') || 'None'}

## Recommended Tasks
${session.summary?.recommendedTasks?.map(t => `- ${t.title} (${t.priority})`).join('\n') || 'None'}
  `;

  downloadFile(markdown, `session-${session.id}.md`, 'text/markdown');
}

// Export multiple sessions as ZIP
exportSessionsZIP(sessions: Session[]): void {
  // Create ZIP with JSZip library
  // Include JSON files for each session
  // Include markdown summaries
  // Include metadata.json with session list
}

// Helper: Trigger browser download
downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

#### 5.2 Export Button in SessionDetailView
**Location:** Header toolbar next to delete button

**UI:**
```
[📥 Export ▼]
  │
  ├─ Export as JSON
  ├─ Export as Markdown
  └─ Export as PDF (future)
```

#### 5.3 Bulk Export
**Location:** Floating action bar in select mode

**Behavior:**
- Exports all selected sessions
- Creates ZIP file with folder structure:
  ```
  sessions-export-2025-01-13/
    ├── session-1.json
    ├── session-1.md
    ├── session-2.json
    ├── session-2.md
    └── metadata.json
  ```

#### 5.4 Export Options Modal
**UI:**
```
┌────────────────────────────────────┐
│ Export 3 Sessions                  │
├────────────────────────────────────┤
│ Format:                            │
│ ○ JSON (machine-readable)          │
│ ● Markdown (human-readable)        │
│ ○ Both                             │
│                                    │
│ Include:                           │
│ ☑ Screenshots                      │
│ ☑ Audio transcripts                │
│ ☑ AI analyses                      │
│                                    │
│ [Cancel] [Export]                  │
└────────────────────────────────────┘
```

---

## Testing Checklist

### Phase 1: Templates
- [ ] Create custom template
- [ ] Delete custom template
- [ ] Select template auto-fills form
- [ ] Quick start creates session immediately
- [ ] Default templates can't be deleted
- [ ] Templates persist across page reloads

### Phase 2: Search
- [ ] Search finds sessions by name
- [ ] Search finds sessions by screenshot analysis
- [ ] Suggestions appear while typing
- [ ] Recent searches are saved
- [ ] Search chips appear for active filters
- [ ] Clear button removes search

### Phase 3: Filters
- [ ] Sort by each option works correctly
- [ ] Duration filter shows correct sessions
- [ ] Date range picker filters accurately
- [ ] Filters combine correctly (AND logic)
- [ ] Filter state persists during session

### Phase 4: Bulk Operations
- [ ] Select mode enables checkboxes
- [ ] Select all selects all visible sessions
- [ ] Action bar appears when items selected
- [ ] Bulk delete with confirmation works
- [ ] Bulk tagging adds/removes tags
- [ ] Cancel clears selections

### Phase 5: Export
- [ ] Single session exports as JSON
- [ ] Single session exports as Markdown
- [ ] Multiple sessions export as ZIP
- [ ] Downloaded files have correct filenames
- [ ] Exported data is valid and complete
- [ ] Large exports (>50 sessions) work

---

## File Structure Changes

```
src/
├── components/
│   └── SessionsZone.tsx (modified - all UI changes)
├── utils/
│   ├── sessionTemplates.ts (new - template CRUD)
│   ├── sessionExport.ts (new - export functions)
│   └── sessionFilters.ts (new - filter/sort logic)
└── types/
    └── index.ts (modified - add Template type)
```

---

## Dependencies to Add

```bash
npm install jszip  # For ZIP file creation in bulk export
npm install file-saver  # For reliable file downloads
```

---

## localStorage Keys

```
taskerino:session-templates  # Array<SessionTemplate>
taskerino:recent-searches    # Array<string> (max 10)
taskerino:filter-preferences # FilterPreferences object
```

---

## Estimated Implementation Time

- Phase 1: 3-4 hours
- Phase 2: 2-3 hours
- Phase 3: 2 hours
- Phase 4: 2-3 hours
- Phase 5: 2 hours
- Testing: 2 hours

**Total:** 13-16 hours

---

## Notes

- All features should maintain the app's glassy, gradient aesthetic
- Error handling for localStorage quota exceeded
- Graceful degradation if features aren't supported
- Mobile-responsive design considerations
- Accessibility (keyboard navigation, screen readers)
