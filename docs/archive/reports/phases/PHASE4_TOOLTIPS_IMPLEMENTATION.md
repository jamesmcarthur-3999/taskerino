# Phase 4: Contextual Tooltips Implementation Guide

## Overview
This document provides the complete implementation for tooltips #5-8 for the Taskerino onboarding system.

## Component Status
- ✅ FeatureTooltip component already exists at `/src/components/FeatureTooltip.tsx`
- ✅ Types already updated in `/src/types.ts` with new `featureIntroductions` fields:
  - `referencePanel: boolean`
  - `sessions: boolean`
- ✅ AppContext reducer already handles `MARK_FEATURE_INTRODUCED` action

## Tooltip Implementations

### Tooltip #5: Reference Panel (Pin Note Action)

**Location:** Multiple locations where PIN_NOTE is dispatched
- Primary: `/src/components/CommandPalette.tsx` line 84
- Could also add to: NoteDetailSidebar, NoteDetailInline if they have pin buttons

**Implementation for CommandPalette.tsx:**

```typescript
// Add at top of file with other imports
import { FeatureTooltip } from './FeatureTooltip';
import { useRef } from 'react'; // if not already imported

// Inside CommandPalette component, add state
const [showReferencePanelTooltip, setShowReferencePanelTooltip] = useState(false);
const referencePanelButtonRef = useRef<HTMLButtonElement>(null);

// Modify handlePinNote function (around line 64)
const handlePinNote = (noteId: string) => {
  if (state.ui.pinnedNotes.includes(noteId)) {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        type: 'info',
        title: 'Already Pinned',
        message: 'This note is already in your reference panel',
      }
    });
  } else if (state.ui.pinnedNotes.length >= 5) {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        type: 'warning',
        title: 'Maximum Reached',
        message: 'You can only pin up to 5 notes. Unpin one to add another.',
      }
    });
  } else {
    dispatch({ type: 'PIN_NOTE', payload: noteId });

    // Show reference panel tooltip if this is the first pin
    if (state.ui.pinnedNotes.length === 0 && !state.ui.onboarding.featureIntroductions.referencePanel) {
      setShowReferencePanelTooltip(true);
    }

    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        type: 'success',
        title: 'Note Pinned',
        message: 'Note added to reference panel',
      }
    });
  }
  onClose();
};

// Add tooltip at the end of JSX, before closing </div>
{showReferencePanelTooltip && (
  <FeatureTooltip
    show={true}
    onDismiss={() => {
      setShowReferencePanelTooltip(false);
      dispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: 'referencePanel' });
    }}
    position="center"
    title="💡 Tip: Reference Panel"
    message={
      <div className="space-y-3">
        <p>You just pinned this note! Pinned notes stay visible in the right panel while you work.</p>
        <div>
          <p className="font-medium mb-2">Perfect for:</p>
          <ul className="space-y-1 ml-4">
            <li className="flex items-start gap-2">
              <span className="text-cyan-600">•</span>
              <span>Active project notes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-600">•</span>
              <span>Important contacts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-600">•</span>
              <span>Quick reference info</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-gray-600 italic">
          Max 5 pins. Toggle panel with the button →
        </p>
      </div>
    }
    primaryAction={{
      label: 'Got it',
      onClick: () => {}
    }}
  />
)}
```

---

### Tooltip #6: Sessions Introduction

**Location:** `/src/components/SessionsZone.tsx`

**Implementation:**

```typescript
// Add at top with other imports
import { FeatureTooltip } from './FeatureTooltip';

// Inside SessionsZone component, add state and effect
const [showSessionsTooltip, setShowSessionsTooltip] = useState(false);

// Add useEffect to check if tooltip should show
useEffect(() => {
  // Show tooltip when user first opens Sessions zone with no sessions
  if (
    state.sessions.length === 0 &&
    !state.ui.onboarding.featureIntroductions.sessions
  ) {
    // Delay to let the UI settle
    const timer = setTimeout(() => {
      setShowSessionsTooltip(true);
    }, 300);
    return () => clearTimeout(timer);
  }
}, [state.sessions.length, state.ui.onboarding.featureIntroductions.sessions]);

// Add tooltip JSX (in the main return, probably near the top level)
{showSessionsTooltip && (
  <FeatureTooltip
    show={true}
    onDismiss={() => {
      setShowSessionsTooltip(false);
      dispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: 'sessions' });
    }}
    position="center"
    title="🎥 Welcome to Sessions - Deep Work Tracking"
    message={
      <div className="space-y-3">
        <p>Sessions help you understand your work patterns:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-cyan-600">📸</span>
            <span><strong>Screenshots:</strong> Capture your screen at intervals</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-600">🎤</span>
            <span><strong>Audio:</strong> Record and transcribe your thoughts</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-600">📹</span>
            <span><strong>Video:</strong> Full screen recording with AI chapters</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-600">🤖</span>
            <span><strong>AI Analysis:</strong> Insights, blockers, achievements</span>
          </li>
        </ul>
        <div>
          <p className="font-medium mb-1">Perfect for:</p>
          <ul className="space-y-1 ml-4">
            <li className="flex items-start gap-2">
              <span className="text-cyan-600">•</span>
              <span>Documenting complex work</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-600">•</span>
              <span>Time tracking with context</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-600">•</span>
              <span>Async updates to your team</span>
            </li>
          </ul>
        </div>
      </div>
    }
    primaryAction={{
      label: 'Explore on my own',
      onClick: () => {}
    }}
    delay={300}
  />
)}
```

---

### Tooltip #7: Command Palette

**Location:** `/src/App.tsx` (or top-level layout)

**Implementation:**

```typescript
// Add at top with other imports
import { FeatureTooltip } from './components/FeatureTooltip';
import { useState, useEffect } from 'react'; // if not already imported

// Inside MainApp component (or appropriate location), add state
const [showCmdKTooltip, setShowCmdKTooltip] = useState(false);

// Add useEffect to monitor threshold
useEffect(() => {
  const totalActions = state.ui.onboarding.stats.captureCount + state.ui.onboarding.stats.taskCount;

  // Show after 5 total captures + tasks
  if (
    totalActions >= 5 &&
    !state.ui.onboarding.featureIntroductions.cmdK
  ) {
    setShowCmdKTooltip(true);
  }
}, [
  state.ui.onboarding.stats.captureCount,
  state.ui.onboarding.stats.taskCount,
  state.ui.onboarding.featureIntroductions.cmdK
]);

// Add in JSX (probably in MainApp return, at top level)
{showCmdKTooltip && (
  <FeatureTooltip
    show={true}
    onDismiss={() => {
      setShowCmdKTooltip(false);
      dispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: 'cmdK' });
    }}
    position="center"
    title="💡 Pro Tip: Command Palette"
    message={
      <div className="space-y-3">
        <p>Press ⌘K anytime to quickly:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-cyan-600">•</span>
            <span>Search everything</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-600">•</span>
            <span>Navigate zones</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-600">•</span>
            <span>Create tasks</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-600">•</span>
            <span>Take actions</span>
          </li>
        </ul>
        <p className="font-medium text-cyan-700">Power users live in ⌘K!</p>
      </div>
    }
    primaryAction={{
      label: 'Try it now',
      onClick: () => {
        dispatch({ type: 'TOGGLE_COMMAND_PALETTE' });
      }
    }}
    secondaryAction={{
      label: 'Dismiss',
      onClick: () => {}
    }}
  />
)}
```

---

### Tooltip #8: Keyboard Shortcuts

**Location:** `/src/App.tsx` (same as Tooltip #7)

**Implementation:**

```typescript
// Inside MainApp component, add state
const [showKeyboardShortcutsTooltip, setShowKeyboardShortcutsTooltip] = useState(false);

// Add useEffect to monitor threshold
useEffect(() => {
  const totalActions = state.ui.onboarding.stats.captureCount + state.ui.onboarding.stats.taskCount;

  // Show after 10 total actions AND after cmdK tooltip has been shown
  if (
    totalActions >= 10 &&
    state.ui.onboarding.featureIntroductions.cmdK &&
    !state.ui.onboarding.featureIntroductions.quickAdd
  ) {
    setShowKeyboardShortcutsTooltip(true);
  }
}, [
  state.ui.onboarding.stats.captureCount,
  state.ui.onboarding.stats.taskCount,
  state.ui.onboarding.featureIntroductions.cmdK,
  state.ui.onboarding.featureIntroductions.quickAdd
]);

// Add in JSX
{showKeyboardShortcutsTooltip && (
  <FeatureTooltip
    show={true}
    onDismiss={() => {
      setShowKeyboardShortcutsTooltip(false);
      dispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: 'quickAdd' });
    }}
    position="center"
    title="⌨️ Pro Tip: Keyboard Shortcuts"
    message={
      <div className="space-y-3">
        <p>You're getting the hang of this! Here are shortcuts to speed up your workflow:</p>
        <ul className="space-y-2">
          <li className="flex items-center gap-3">
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
              ⌘K
            </kbd>
            <span className="text-sm">Command Palette (search everything)</span>
          </li>
          <li className="flex items-center gap-3">
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
              ⌘Enter
            </kbd>
            <span className="text-sm">Submit capture</span>
          </li>
          <li className="flex items-center gap-3">
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
              ⌘+/-
            </kbd>
            <span className="text-sm">Zoom in/out</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="text-xs text-gray-600 italic">Double-click task</span>
            <span className="text-sm">Quick edit</span>
          </li>
        </ul>
      </div>
    }
    primaryAction={{
      label: 'Got it',
      onClick: () => {}
    }}
  />
)}
```

---

## Additional Requirements

### Increment Stats
When users perform actions, you need to increment the onboarding stats:

**In CaptureZone** (when capture is submitted):
```typescript
dispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'captureCount' });
```

**In TasksZone or QuickTaskModal** (when task is created):
```typescript
dispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'taskCount' });
```

**Note:** Check if these are already being incremented. If phases 1-3 were completed, they might already be in place.

---

## Testing Recommendations

### Manual Testing Checklist

1. **Reference Panel Tooltip (#5)**
   - [ ] Start with fresh state (clear localStorage or use incognito)
   - [ ] Open Command Palette (⌘K)
   - [ ] Search for a note
   - [ ] Click the pin icon on a note
   - [ ] Verify tooltip appears with correct content
   - [ ] Click "Got it" and verify tooltip dismisses
   - [ ] Pin another note - tooltip should NOT appear again
   - [ ] Check state: `featureIntroductions.referencePanel` should be `true`

2. **Sessions Tooltip (#6)**
   - [ ] Start with fresh state with NO sessions
   - [ ] Navigate to Sessions zone
   - [ ] Wait 300ms
   - [ ] Verify tooltip appears with correct content explaining sessions
   - [ ] Click "Explore on my own"
   - [ ] Verify tooltip dismisses
   - [ ] Navigate away and back - tooltip should NOT appear again
   - [ ] Check state: `featureIntroductions.sessions` should be `true`

3. **Command Palette Tooltip (#7)**
   - [ ] Start with fresh state
   - [ ] Create 3 captures and 2 tasks (total = 5)
   - [ ] Verify tooltip appears explaining ⌘K
   - [ ] Click "Try it now" - should open command palette
   - [ ] Verify tooltip dismissed after action
   - [ ] Check state: `featureIntroductions.cmdK` should be `true`

4. **Keyboard Shortcuts Tooltip (#8)**
   - [ ] Continue from previous test (cmdK tooltip shown)
   - [ ] Create 5 more actions (total = 10)
   - [ ] Verify tooltip appears with keyboard shortcuts
   - [ ] Click "Got it"
   - [ ] Verify tooltip dismisses
   - [ ] Check state: `featureIntroductions.quickAdd` should be `true`

### Edge Cases to Test

- [ ] Multiple tooltips triggered at once (should only show one)
- [ ] Tooltip positioning when Reference Panel is open/closed
- [ ] Tooltip positioning at different zoom levels
- [ ] Tooltip behavior when switching tabs rapidly
- [ ] Persistence across app restarts

### Browser Console Checks

```javascript
// Check onboarding state
JSON.parse(localStorage.getItem('taskerino-v3-state')).ui.onboarding

// Expected after all tooltips shown:
{
  completed: false,
  currentStep: 0,
  dismissedTooltips: [],
  featureIntroductions: {
    captureBox: true, // from phase 1-3
    toggles: true,
    quickAdd: true,
    filters: true,
    inlineEdit: true,
    cmdK: true, // NEW
    backgroundProcessing: true,
    nedAssistant: true,
    referencePanel: true, // NEW
    sessions: true, // NEW
    taskDetailSidebar: true,
    taskViews: true
  },
  stats: {
    captureCount: 10,
    taskCount: 10,
    sessionCount: 0,
    noteCount: X,
    nedQueryCount: X,
    tooltipsShown: 4, // +4 from this phase
    tooltipsDismissed: 4,
    lastActiveDate: "2025-XX-XX"
  }
}
```

---

## Positioning Notes

- **Reference Panel Tooltip**: Use `position="center"` since it's triggered from Command Palette (modal)
- **Sessions Tooltip**: Use `position="center"` for maximum visibility
- **Command Palette Tooltip**: Use `position="center"` as it's a global feature
- **Keyboard Shortcuts Tooltip**: Use `position="center"` as it's about global shortcuts

All tooltips should have a semi-transparent backdrop to focus attention.

---

## Known Challenges

### 1. Tooltip Queueing
If multiple tooltips trigger at the same time (e.g., user pins note and has 5 captures), only one should show. Consider adding a queue system:

```typescript
const [tooltipQueue, setTooltipQueue] = useState<string[]>([]);
const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
```

### 2. Reference Panel Button Reference
For proper positioning of Reference Panel tooltip, you may need to attach a ref to the toggle button in TopNavigation or ReferencePanel components.

### 3. Stats Persistence
Ensure stats are being incremented correctly and persisted to storage. Check that AppContext saves after `INCREMENT_ONBOARDING_STAT` dispatches.

---

## Implementation Priority

1. **High Priority**: Sessions tooltip (#6) - easiest to implement and test
2. **Medium Priority**: Command Palette (#7) and Keyboard Shortcuts (#8) - similar implementation
3. **Lower Priority**: Reference Panel (#5) - requires careful placement and may need ref management

---

## Files to Modify

1. `/src/components/CommandPalette.tsx` - Tooltip #5
2. `/src/components/SessionsZone.tsx` - Tooltip #6
3. `/src/App.tsx` - Tooltips #7 and #8
4. Potentially `/src/components/CaptureZone.tsx` - verify stats increment
5. Potentially `/src/components/TasksZone.tsx` - verify stats increment

---

## Summary

This phase adds 4 contextual tooltips that guide users through advanced features:
- Reference Panel (after first pin)
- Sessions Introduction (on first visit with no sessions)
- Command Palette (after 5 actions)
- Keyboard Shortcuts (after 10 actions)

All tooltips use the existing FeatureTooltip component and follow the established pattern of checking feature introduction flags and incrementing stats.
