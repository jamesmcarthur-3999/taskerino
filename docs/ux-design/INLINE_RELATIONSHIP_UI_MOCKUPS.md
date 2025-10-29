# Inline Relationship Management - UI Mockups

**Version:** 1.0
**Date:** October 26, 2025
**Purpose:** Visual reference for implementation

---

## Table of Contents

1. [TaskDetailInline - Complete Layout](#taskdetailinline---complete-layout)
2. [NoteDetailInline - Complete Layout](#notedetailinline---complete-layout)
3. [SessionDetailView - Complete Layout](#sessiondetailview---complete-layout)
4. [Component Close-ups](#component-close-ups)
5. [Interaction States](#interaction-states)
6. [Responsive Behavior](#responsive-behavior)

---

## TaskDetailInline - Complete Layout

### Desktop View (1280px+)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                                                                            [X] │
│  METADATA PILLS                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ ┌─────────┐ ┌──────────┐ │
│  │ ⚙ In Progress│ │ 🔴 High      │ │ 🕐 2h ago   │ │ ✓ Saved │ │ 🗑 Delete│ │
│  └──────────────┘ └──────────────┘ └─────────────┘ └─────────┘ └──────────┘ │
│                                                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                                │
│  TASK TITLE (EDITABLE)                                                         │
│  Fix authentication bug in login flow                                          │
│  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ │
│                                                                                │
│  📅 Due: [2025-10-30_____]    🕐 Time: [14:00___]    [Clear]                  │
│                                                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                                │
│  DESCRIPTION                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │ Users are unable to log in when using Google OAuth. The error           │ │
│  │ appears after successful authentication callback. Need to check          │ │
│  │ session storage configuration.                                           │ │
│  │                                                                          │ │
│  │                                                                          │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  SUBTASKS                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │ ✓ Reproduce issue locally                                               │ │
│  │ ○ Check OAuth callback configuration                                    │ │
│  │ ○ Review session storage implementation                                 │ │
│  │ ○ Test fix with multiple providers                                      │ │
│  ├──────────────────────────────────────────────────────────────────────────┤ │
│  │ [Add subtask...________________________] [+]                             │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                                │
│  RELATED NOTES                                                            (2)  │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │ 🔍 Search notes to link...                                               │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  ┌──────────────────────────────────┐ ┌────────────────────────────────────┐ │
│  │ 📄 Auth Investigation Notes      │ │ 📄 OAuth Configuration Guide       │ │
│  └──────────────────────────────────┘ └────────────────────────────────────┘ │
│                                                                                │
│  RELATED SESSIONS                                                         (1)  │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │ 🔍 Search sessions to link...                                            │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ 🎥 Debugging Session - Auth Issues                                     │   │
│  │    Oct 25, 2h 15m                                                      │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│  TAGS                                                                     (3)  │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │ 🔍 Search or create tags...                                              │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                                │
│  │ 🏷 urgent   │ │ 🏷 backend │ │ 🏷 bug     │                                │
│  └────────────┘ └────────────┘ └────────────┘                                │
│                                                                                │
│  TOPICS                                                                   (1)  │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │ 🔍 Search topics...                                                      │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  ┌──────────────────┐                                                          │
│  │ 📑 Authentication │                                                          │
│  └──────────────────┘                                                          │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Empty State Example

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  RELATED NOTES                                                            (0)  │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                          │ │
│  │                          📄                                              │ │
│  │                   No related notes yet                                   │ │
│  │                                                                          │ │
│  │         Link notes that provide context, references, or                  │ │
│  │         background information for this task.                            │ │
│  │                                                                          │ │
│  │                    [🔗 Link a note]                                      │ │
│  │                                                                          │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## NoteDetailInline - Complete Layout

### Desktop View with Header Sections

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────────────────────────────────────────────┐ │
│ │ HEADER (Non-Scrolling Glass Panel)                               [⚙][🗑] │ │
│ ├────────────────────────────────────────────────────────────────────────────┤ │
│ │                                                                            │ │
│ │ TITLE (Click to edit)                                                      │ │
│ │ Meeting Notes - Q4 Planning Session                                        │ │
│ │ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ │ │
│ │                                                                            │ │
│ │ 📱 manual  •  😊 positive  •  🕐 2 hours ago  •  ✓ Saved                  │ │
│ │                                                                            │ │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │
│ │                                                                            │ │
│ │ COMPANIES                                                             (2) │ │
│ │ [🔍 Search companies...]                                                   │ │
│ │ ┌────────────────┐ ┌────────────────┐                                    │ │
│ │ │ 🏢 Acme Corp   │ │ 🏢 Startup Inc │                                    │ │
│ │ └────────────────┘ └────────────────┘                                    │ │
│ │                                                                            │ │
│ │ CONTACTS                                                              (3) │ │
│ │ [🔍 Search contacts...]                                                    │ │
│ │ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐               │ │
│ │ │ 👤 John Doe    │ │ 👤 Jane Smith  │ │ 👤 Bob Wilson  │               │ │
│ │ └────────────────┘ └────────────────┘ └────────────────┘               │ │
│ │                                                                            │ │
│ │ TOPICS                                                                (2) │ │
│ │ [🔍 Search topics...]                                                      │ │
│ │ ┌──────────────────┐ ┌──────────────────┐                                │ │
│ │ │ 📑 Product       │ │ 📑 Strategy      │                                │ │
│ │ └──────────────────┘ └──────────────────┘                                │ │
│ │                                                                            │ │
│ │ TAGS                                                                  (5) │ │
│ │ [🔍 Search or create tags...]                                              │ │
│ │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ [+ 1 more]  │ │
│ │ │ 🏷 meeting │ │ 🏷 planning│ │ 🏷 q4      │ │ 🏷 strategy│             │ │
│ │ └────────────┘ └────────────┘ └────────────┘ └────────────┘             │ │
│ │                                                                            │ │
│ └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│ ┌────────────────────────────────────────────────────────────────────────────┐ │
│ │ SCROLLABLE CONTENT                                                ↕ SCROLL │ │
│ ├────────────────────────────────────────────────────────────────────────────┤ │
│ │                                                                            │ │
│ │ ┌──────────────────────────────────────────────────────────────────────┐   │ │
│ │ │ ✨ KEY TAKEAWAYS                                                      │   │ │
│ │ │ • Q4 focus will be on product-market fit                             │   │ │
│ │ │ • Need to hire 3 engineers by November                               │   │ │
│ │ │ • Budget approved for marketing campaign                             │   │ │
│ │ └──────────────────────────────────────────────────────────────────────┘   │ │
│ │                                                                            │ │
│ │ CONTENT                                                                    │ │
│ │ ┌──────────────────────────────────────────────────────────────────────┐   │ │
│ │ │ [Rich Text Editor Content Area]                                      │   │ │
│ │ │                                                                       │   │ │
│ │ │ Discussed Q4 roadmap with the team. Key decisions made:              │   │ │
│ │ │                                                                       │   │ │
│ │ │ 1. Product focus                                                     │   │ │
│ │ │    - Prioritize core features                                        │   │ │
│ │ │    - Defer nice-to-haves to Q1                                       │   │ │
│ │ │                                                                       │   │ │
│ │ │ 2. Team expansion                                                    │   │ │
│ │ │    - Engineering: 3 positions open                                   │   │ │
│ │ │    - Marketing: 1 position open                                      │   │ │
│ │ │                                                                       │   │ │
│ │ └──────────────────────────────────────────────────────────────────────┘   │ │
│ │                                                                            │ │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │
│ │                                                                            │ │
│ │ RELATED TASKS                                                         (4) │ │
│ │ ┌──────────────────────────────────────────────────────────────────────┐   │ │
│ │ │ 🔍 Search tasks to link...                                           │   │ │
│ │ └──────────────────────────────────────────────────────────────────────┘   │ │
│ │                                                                            │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐    │ │
│ │ │ ✓ Create Q4 product spec                 [Done]                     │    │ │
│ │ └─────────────────────────────────────────────────────────────────────┘    │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐    │ │
│ │ │ ⚙ Draft engineering hiring plan          [In Progress]             │    │ │
│ │ └─────────────────────────────────────────────────────────────────────┘    │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐    │ │
│ │ │ ○ Schedule marketing campaign kickoff    [Todo]                     │    │ │
│ │ └─────────────────────────────────────────────────────────────────────┘    │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐    │ │
│ │ │ ○ Review budget allocation                [Todo]                     │    │ │
│ │ └─────────────────────────────────────────────────────────────────────┘    │ │
│ │                                                                            │ │
│ │ RELATED SESSIONS                                                      (1) │ │
│ │ ┌──────────────────────────────────────────────────────────────────────┐   │ │
│ │ │ 🔍 Search sessions to link...                                        │   │ │
│ │ └──────────────────────────────────────────────────────────────────────┘   │ │
│ │                                                                            │ │
│ │ ┌────────────────────────────────────────────────────────────────────┐     │ │
│ │ │ 🎥 Q4 Planning Meeting                                             │     │ │
│ │ │    Oct 24, 1h 45m • 23 screenshots                                 │     │ │
│ │ └────────────────────────────────────────────────────────────────────┘     │ │
│ │                                                                            │ │
│ └────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## SessionDetailView - Complete Layout

### Overview Tab

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ SESSION: Q4 Planning Meeting                                    [⚙] [▶] [🗑]  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                                │
│ [Overview] [Timeline] [Extracted] [Raw Data]                                  │
│                                                                                │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐   │
│ │ ⏱ Duration           │ │ 📸 Screenshots       │ │ 📊 Activities        │   │
│ │ 1h 45m               │ │ 23                   │ │ 8 detected           │   │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘   │
│                                                                                │
│ ACTIVITY TIMELINE                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐   │
│ │ 14:00  🖥 Code editing (VSCode)                                          │   │
│ │ 14:15  🌐 Browser research (Chrome)                                      │   │
│ │ 14:30  📊 Spreadsheet work (Excel)                                       │   │
│ │ 14:45  💬 Video call (Zoom)                                              │   │
│ │ 15:00  🖥 Code editing (VSCode)                                          │   │
│ └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                                │
│ EXTRACTED TASKS                                                           (3)  │
│ ┌──────────────────────────────────────────────────────────────────────────┐   │
│ │ 🔍 Link additional tasks...                                              │   │
│ └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐    │
│ │ ✓ Create Q4 product spec                 [Done]                  ✨ 92%│    │
│ │    Extracted at 14:32                                                   │    │
│ └─────────────────────────────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────────────────────────────┐    │
│ │ ⚙ Draft engineering hiring plan          [In Progress]          ✨ 88%│    │
│ │    Extracted at 14:48                                                   │    │
│ └─────────────────────────────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────────────────────────────┐    │
│ │ ○ Schedule marketing campaign kickoff    [Todo]                 ✨ 85%│    │
│ │    Extracted at 15:12                                                   │    │
│ └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                │
│ EXTRACTED NOTES                                                           (2)  │
│ ┌──────────────────────────────────────────────────────────────────────────┐   │
│ │ 🔍 Link additional notes...                                              │   │
│ └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│ ┌────────────────────────────────────────────────────────────────────────┐     │
│ │ 📄 Q4 Budget Discussion                                         ✨ 95%│     │
│ │    Created at 14:25                                                    │     │
│ └────────────────────────────────────────────────────────────────────────┘     │
│ ┌────────────────────────────────────────────────────────────────────────┐     │
│ │ 📄 Engineering Team Expansion Plan                              ✨ 90%│     │
│ │    Created at 14:52                                                    │     │
│ └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                │
│ TAGS                                                                      (4)  │
│ ┌──────────────────────────────────────────────────────────────────────────┐   │
│ │ 🔍 Add tags...                                                           │   │
│ └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐                  │
│ │ 🏷 meeting │ │ 🏷 planning│ │ 🏷 q4      │ │ 🏷 strategy│                  │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘                  │
│                                                                                │
│ TOPICS                                                                    (2)  │
│ ┌──────────────────────────────────────────────────────────────────────────┐   │
│ │ 🔍 Add topics...                                                         │   │
│ └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│ ┌──────────────────┐ ┌──────────────────┐                                     │
│ │ 📑 Product       │ │ 📑 Strategy      │                                     │
│ └──────────────────┘ └──────────────────┘                                     │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Close-ups

### InlineEntitySearch - Expanded State with Results

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ 🔍 [weekly standup_____________________]                              [Clear] │
│ ┌──────────────────────────────────────────────────────────────────────────┐   │
│ │ SEARCH RESULTS (12)                                                      │   │
│ │                                                                          │   │
│ │ ┌────────────────────────────────────────────────────────────────────┐   │   │
│ │ │ 📄 Weekly Standup - Oct 24                            👁 2h ago   │   │   │
│ │ │    #standup #engineering                                           │   │   │
│ │ └────────────────────────────────────────────────────────────────────┘   │   │
│ │ ┌────────────────────────────────────────────────────────────────────┐   │   │
│ │ │ 📄 Weekly Standup - Oct 17                            👁 1w ago   │   │   │
│ │ │    #standup #engineering                                           │   │   │
│ │ └────────────────────────────────────────────────────────────────────┘   │   │
│ │ ┌────────────────────────────────────────────────────────────────────┐   │   │
│ │ │ 📄 Weekly Planning Meeting                            👁 3d ago   │   │   │
│ │ │    #planning #weekly                                               │   │   │
│ │ └────────────────────────────────────────────────────────────────────┘   │   │
│ │                                                                          │   │
│ │ [Show 9 more results...]                                                 │   │
│ └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│ Keyboard: ↑↓ Navigate • Enter Select • Esc Close                              │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Enhanced Pill - Normal State

```
┌───────────────────────────────────────┐
│ 📄 Meeting Agenda - Q4 Planning       │
└───────────────────────────────────────┘

Style:
- Background: blue-100/30 (translucent)
- Border: 2px solid blue-400/60
- Border radius: 9999px (full round)
- Padding: 6px 12px
- Font: 12px medium
- Cursor: pointer
```

### Enhanced Pill - Hover State

```
┌───────────────────────────────────────┐
│ 📄 Meeting Agenda - Q4 Planning    ❌│ ← Remove button appears
└───────────────────────────────────────┘

Hover Effects:
- Background: blue-100/40 (more opaque)
- Border: 2px solid blue-400/80 (stronger)
- Scale: 1.05
- Shadow: md (0 4px 6px rgba(0,0,0,0.1))
- X button: opacity 0 → 1
```

### Enhanced Pill - AI-Suggested (Low Confidence)

```
┌─────────────────────────────────────────┐
│ 📄 Engineering Spec Doc          ✨ 72%│
└─────────────────────────────────────────┘

Special Styling:
- Background: blue-100/20 (faded)
- Border: 2px dashed blue-400/40
- Sparkle icon + confidence %
- Tooltip: "AI suggested with 72% confidence
            Reasoning: Both mention auth flow"
```

---

## Interaction States

### Search Bar States

**1. Collapsed (Default)**
```
┌────────────────────────────────────┐
│ 🔍 Search notes to link...         │
└────────────────────────────────────┘
Width: Auto-fit content (~200px)
Opacity: 0.8
```

**2. Focus (Click)**
```
┌──────────────────────────────────────────────────────────────┐
│ 🔍 [_______________________________________]           [Clear]│
└──────────────────────────────────────────────────────────────┘
Width: Expand to 100%
Opacity: 1.0
Auto-focus: Yes
```

**3. Typing (With Results)**
```
┌──────────────────────────────────────────────────────────────┐
│ 🔍 [meeting agenda_______________]                     [Clear]│
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 📄 Meeting Agenda - Q4 Planning                        │   │
│ │ 📄 Team Meeting Notes                                  │   │
│ │ 📄 Client Meeting Recap                                │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
Dropdown: Visible
Results: Live update (300ms debounce)
```

**4. No Results**
```
┌──────────────────────────────────────────────────────────────┐
│ 🔍 [xyz123_______________]                             [Clear]│
│ ┌────────────────────────────────────────────────────────┐   │
│ │                  🔍                                     │   │
│ │         No results found for "xyz123"                  │   │
│ │                                                         │   │
│ │         Try a different search term                    │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**5. Loading**
```
┌──────────────────────────────────────────────────────────────┐
│ 🔍 [searchi_______________] ⌛                         [Clear]│
│ ┌────────────────────────────────────────────────────────┐   │
│ │                  ⟳                                     │   │
│ │                Searching...                            │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Pill Removal Animation

**Step 1: Hover**
```
┌────────────────────────────────────┐
│ 📄 Meeting Agenda           [hover]│
└────────────────────────────────────┘
Scale: 1.0 → 1.05
X button: opacity 0 → 1
Duration: 150ms
```

**Step 2: Click Remove**
```
┌────────────────────────────────────┐
│ 📄 Meeting Agenda              [X] │ ← User clicks
└────────────────────────────────────┘
Action: Optimistic removal
```

**Step 3: Fade Out**
```
┌────────────────────────────────────┐
│ 📄 Meeting Agenda              [X] │ ← Fading
└────────────────────────────────────┘
Opacity: 1.0 → 0
Scale: 1.05 → 0.95
Duration: 200ms
```

**Step 4: Collapse**
```
[pill disappears, surrounding pills shift left]
Gap closes with smooth animation
Duration: 200ms
```

**Step 5: Toast Notification**
```
┌────────────────────────────────────────────┐
│ ✓ Unlinked from Meeting Agenda    [Undo]  │
└────────────────────────────────────────────┘
Position: Bottom-right
Duration: 5 seconds
Action: Undo button restores relationship
```

### Pill Navigation Animation

**Click on Pill:**
```
┌────────────────────────────────────┐
│ 📄 Meeting Agenda             [nav]│ ← User clicks
└────────────────────────────────────┘

Action: Navigate to note detail
Animation: Slight press (scale 0.95)
Duration: 100ms
Feedback: Immediate
```

---

## Responsive Behavior

### Mobile (< 640px)

**Vertical Stack Layout:**
```
┌─────────────────────────────────────┐
│ RELATED NOTES                  (2)  │
├─────────────────────────────────────┤
│ [🔍 Search...]                      │ ← Full width
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 📄 Meeting Agenda               │ │ ← Full width pills
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 📄 Engineering Spec             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

Changes:
- Pills stack vertically (1 per row)
- Search bar full width
- Larger touch targets (44px min)
- Reduced max visible pills (3 instead of 5)
```

### Tablet (640px - 1024px)

**2-Column Layout:**
```
┌──────────────────────────────────────────────────┐
│ RELATED NOTES                               (4)  │
├──────────────────────────────────────────────────┤
│ [🔍 Search notes...]                             │
├──────────────────────────────────────────────────┤
│ ┌───────────────────────┐ ┌──────────────────┐  │
│ │ 📄 Meeting Agenda     │ │ 📄 Engineering   │  │
│ └───────────────────────┘ └──────────────────┘  │
│ ┌───────────────────────┐ ┌──────────────────┐  │
│ │ 📄 Design Mockups     │ │ 📄 Spec Doc      │  │
│ └───────────────────────┘ └──────────────────┘  │
└──────────────────────────────────────────────────┘

Changes:
- Pills in 2 columns
- Search bar 80% width
- Max visible pills: 4
```

### Desktop (> 1024px)

**Multi-Column Wrap:**
```
┌────────────────────────────────────────────────────────────────┐
│ RELATED NOTES                                             (6)  │
├────────────────────────────────────────────────────────────────┤
│ [🔍 Search notes to link...]                                   │
├────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐ │
│ │ 📄 Note 1   │ │ 📄 Note 2   │ │ 📄 Note 3   │ │ 📄 Note 4│ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘ │
│ ┌─────────────┐ [+ 1 more]                                    │
│ │ 📄 Note 5   │                                                │
│ └─────────────┘                                                │
└────────────────────────────────────────────────────────────────┘

Changes:
- Pills wrap naturally (flex-wrap)
- Search bar 60% width
- Max visible pills: 5
- Larger "+X more" button
```

---

## Summary: Key Visual Principles

### 1. Glass Morphism Consistency
- All containers use `getGlassClasses()` from theme
- Translucent backgrounds with backdrop blur
- Visible borders (2px) for definition
- Subtle shadows for elevation

### 2. Color Coding by Type
- Tasks: Blue (ocean theme)
- Notes: Purple (lavender theme)
- Sessions: Orange (sunset theme)
- Tags: Green (forest theme)
- Topics: Cyan (ocean accent)
- Companies: Amber (sunset accent)
- Contacts: Emerald (forest accent)

### 3. Progressive Disclosure
- Collapsed search bars (expand on focus)
- First 3-5 pills visible ("+X more" for overflow)
- Remove buttons on hover only
- Advanced modal for bulk operations

### 4. Clear Affordances
- Cursor: pointer on clickable items
- Hover states: scale + shadow + brightness
- Focus states: ring + border color change
- Loading states: spinner + "Loading..." text

### 5. Smooth Animations
- 200ms for micro-interactions (hover, focus)
- 300ms for section expansions
- Spring animations for modals (cubic-bezier)
- Staggered delays for multiple pills (50ms offset)

### 6. Accessible Design
- 44px minimum touch targets (mobile)
- ARIA labels on all interactive elements
- Keyboard navigation (Tab, Enter, Arrows, Esc)
- Screen reader announcements
- High contrast colors (WCAG AA)

---

**Document Version:** 1.0
**Last Updated:** October 26, 2025
**Next Steps:** Use these mockups for implementation reference
