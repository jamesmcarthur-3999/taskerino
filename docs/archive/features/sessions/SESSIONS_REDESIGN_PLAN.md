# SessionsZone Redesign Plan

## Overview
Redesign SessionsZone to surface AI intelligence already being generated (session summaries, achievements, blockers, tasks, insights) in the main UI instead of hiding it behind detail views.

## Design Principles
1. **Intelligence-First**: Show AI synthesis data prominently
2. **Glassmorphism**: Follow existing design system (white/40 backdrop-blur-xl, cyan-blue gradients)
3. **Progressive Disclosure**: Basic info visible, details on click
4. **Semantic Color**: Use icon colors for meaning, not background gradients

---

## Phase 1: Enhanced Session Cards (High Impact, Low Effort)

### 1.1 Past Session Cards Enhancement

**Current State:**
- Basic info: title, description, date, duration, screenshot count
- Plain card with hover effect
- Click opens detail view

**New Features:**
- **Summary Preview**: First 100 chars of session.summary.narrative
- **Intelligence Badges**: Pills showing:
  - ✓ X achievements (green icon)
  - ⚠ X blockers (red icon)
  - 🎯 X tasks (cyan icon)
  - 💡 X insights (amber icon)
- **Conditional Display**: Only show badges if summary exists

**Implementation:**
```tsx
{session.summary && (
  <div className="flex items-center gap-2 mt-3">
    <div className="text-xs text-gray-700 bg-white/40 px-2 py-1 rounded-full">
      <CheckCircle2 className="w-3 h-3 inline text-green-600" />
      {session.summary.achievements.length}
    </div>
    {/* ... more badges */}
  </div>
)}
```

### 1.2 Active Session Card Enhancement

**Current State:**
- Shows: title, description, stats (duration, screenshots, tasks)
- Status indicator (green pulse)
- Control buttons (pause/resume, stop)

**New Features:**
- **Live Synthesis Preview Section**:
  - Collapsible section showing current synthesis
  - Updates every 5 minutes
  - Shows narrative + current counts
  - "Last updated 3m ago" timestamp
- **AI Status Indicator**: "AI Learning..." badge when analyzing

**Layout:**
```
┌────────────────────────────────────────┐
│  🟢 Session Title                      │
│  Description                           │
│                                        │
│  [Stats Grid: 4 cards]                 │
│                                        │
│  📊 AI SYNTHESIS PREVIEW (LIVE)        │
│  ┌──────────────────────────────────┐  │
│  │ "Building auth flow, debugged..." │  │
│  │ ✓ 2  ⚠ 1  🎯 3  💡 2             │  │
│  │ Updated 2m ago                    │  │
│  └──────────────────────────────────┘  │
│                                        │
│  [View Full Timeline]                  │
└────────────────────────────────────────┘
```

---

## Phase 2: Organization & Statistics (Medium Effort)

### 2.1 Grouped Timeline

**Current State:**
- Flat list sorted by date (newest first)

**New Implementation:**
- Group sessions by:
  - **Today**: Sessions from today
  - **Yesterday**: Sessions from yesterday
  - **This Week**: Last 7 days (excluding today/yesterday)
  - **Earlier**: Everything else

**Grouping Logic:**
```typescript
const groupSessionsByDate = (sessions: Session[]) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    today: sessions.filter(s => new Date(s.startTime) >= todayStart),
    yesterday: sessions.filter(s => {
      const date = new Date(s.startTime);
      return date >= yesterdayStart && date < todayStart;
    }),
    thisWeek: sessions.filter(s => {
      const date = new Date(s.startTime);
      return date >= weekStart && date < yesterdayStart;
    }),
    earlier: sessions.filter(s => new Date(s.startTime) < weekStart),
  };
};
```

**Visual Design:**
```tsx
<div className="space-y-8">
  {grouped.today.length > 0 && (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-3">
        Today
      </h2>
      <div className="space-y-3">
        {grouped.today.map(session => <SessionCard... />)}
      </div>
    </div>
  )}
  {/* repeat for yesterday, thisWeek, earlier */}
</div>
```

### 2.2 Stats Overview Banner

**New Component**: `SessionsStatsBanner`

**Data to Display:**
- Total sessions count
- Total time tracked (sum of all session durations)
- Total tasks extracted
- Total screenshots captured

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  YOUR TRACKING STATS                                │
│  ──────────────────────────────────────────────────│
│  📊 42 Sessions  ⏱ 87h 23m  🎯 156 Tasks  📸 892  │
└─────────────────────────────────────────────────────┘
```

**Styling:**
- `bg-white/40 backdrop-blur-xl rounded-[24px]`
- Grid layout with 4 columns
- Icon + number + label for each stat

---

## Phase 3: Filters & Search (Nice to Have)

### 3.1 Filter Bar

**Current State:**
- No filtering capability

**New Features:**
- **Tag Filters**: Filter by session tags (e.g., "Work", "Personal", "Research")
- **All Filter**: Default view showing everything
- **Dynamic Tag Detection**: Build filter options from all unique tags in sessions

**Implementation:**
```tsx
const [selectedFilter, setSelectedFilter] = useState<string>('all');

const uniqueTags = Array.from(
  new Set(pastSessions.flatMap(s => s.tags || []))
);

const filteredSessions = selectedFilter === 'all'
  ? pastSessions
  : pastSessions.filter(s => s.tags?.includes(selectedFilter));
```

**Visual:**
```
[All] [Work] [Personal] [Research] [Debugging]
 ^^^
active
```

### 3.2 Search Functionality

**Search Fields:**
- Session name
- Session description
- Session summary narrative (if exists)

**Implementation:**
```tsx
const [searchQuery, setSearchQuery] = useState('');

const searchedSessions = filteredSessions.filter(s => {
  const query = searchQuery.toLowerCase();
  return (
    s.name.toLowerCase().includes(query) ||
    s.description.toLowerCase().includes(query) ||
    (s.summary?.narrative || '').toLowerCase().includes(query)
  );
});
```

**UI Component:**
```tsx
<div className="relative">
  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
  <input
    type="text"
    placeholder="Search sessions..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full pl-12 pr-4 py-3 bg-white/40 backdrop-blur-xl border-2 border-white/50 rounded-[20px]..."
  />
</div>
```

### 3.3 Quick Action Buttons

**Hover State for Past Session Cards:**
- Shows overlay with 3 buttons:
  1. **View Details**: Opens SessionDetailView (existing behavior)
  2. **Extract Tasks**: Quick-creates all recommended tasks from summary
  3. **Review Summary**: Opens detail view scrolled to summary section

**Implementation:**
```tsx
<div className="group relative">
  {/* Card content */}

  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[24px] flex items-end justify-center p-6">
    <div className="flex gap-3">
      <button className="px-4 py-2 bg-white/90 rounded-[16px]...">
        <FileText size={16} /> View Details
      </button>
      <button className="px-4 py-2 bg-cyan-500 rounded-[16px]...">
        <CheckSquare size={16} /> Extract Tasks
      </button>
    </div>
  </div>
</div>
```

---

## Component Structure

### New Components
1. `SessionsStatsBanner` - Phase 2
2. `SessionFilterBar` - Phase 3
3. `SessionSearchBar` - Phase 3

### Modified Components
1. `SessionCard` - Add summary preview + badges (Phase 1)
2. `ActiveSessionCard` - Add live synthesis preview (Phase 1)
3. `SessionsZone` - Add grouping logic, stats banner, filters (Phase 2 & 3)

### Helper Functions
1. `groupSessionsByDate()` - Phase 2
2. `calculateTotalStats()` - Phase 2
3. `filterSessionsByTag()` - Phase 3
4. `searchSessions()` - Phase 3

---

## Technical Considerations

### Performance
- **Memo grouping logic**: Use `useMemo` for date grouping
- **Debounce search**: Debounce search input (300ms)
- **Lazy loading**: Consider virtualizing if >100 sessions

### Data Requirements
- All data already exists in Redux state
- No new API calls needed
- session.summary populated by existing synthesis system

### Edge Cases
1. **No summary yet**: Hide badges/preview, show "Analysis pending..."
2. **Empty states**:
   - No sessions: Show existing empty state
   - No results from filter/search: "No sessions found"
3. **Long narratives**: Truncate at 100 chars with "..."

---

## Testing Checklist

### Phase 1
- [ ] Past session cards show summary preview when available
- [ ] Badge counts are accurate
- [ ] Active session shows live synthesis preview
- [ ] Preview updates when synthesis runs
- [ ] Works with missing summary data

### Phase 2
- [ ] Sessions grouped correctly by date
- [ ] Stats banner shows accurate totals
- [ ] Groups collapse/expand (if implemented)

### Phase 3
- [ ] Tag filters work correctly
- [ ] Search matches name/description/narrative
- [ ] Quick actions trigger correct behavior
- [ ] Hover effects smooth on all devices

### General
- [ ] Design system consistency (colors, spacing, borders)
- [ ] Responsive on different screen sizes
- [ ] No console errors
- [ ] Build succeeds without errors

---

## Visual Design Tokens

### Colors
- **Primary Gradient**: `from-cyan-500 to-blue-500`
- **Card Background**: `bg-white/40 backdrop-blur-xl`
- **Border**: `border-2 border-white/50`
- **Success (Achievement)**: `text-green-600`
- **Error (Blocker)**: `text-red-600`
- **Warning (Task)**: `text-cyan-600`
- **Info (Insight)**: `text-amber-600`

### Spacing
- **Card Padding**: `p-6` to `p-8`
- **Rounded Corners**: `rounded-[20px]` to `rounded-[40px]`
- **Gap Between Cards**: `space-y-4`
- **Section Margin**: `mb-8` to `mb-12`

### Typography
- **Section Header**: `text-xs font-bold uppercase tracking-wide text-gray-600`
- **Card Title**: `text-xl font-bold text-gray-900`
- **Badge Text**: `text-xs font-semibold`
- **Stats Numbers**: `text-3xl font-bold`

---

## Implementation Order

1. ✅ Phase 1.1: Enhanced past session cards (SessionCard)
2. ✅ Phase 1.2: Live synthesis in active session (ActiveSessionCard)
3. ✅ Phase 2.1: Grouped timeline with date sections
4. ✅ Phase 2.2: Stats banner component
5. ✅ Phase 3.1: Filter bar by tags
6. ✅ Phase 3.2: Search functionality
7. ✅ Phase 3.3: Quick action buttons on hover
8. ✅ Test & Build

**Estimated Time**: ~2-3 hours for full implementation
