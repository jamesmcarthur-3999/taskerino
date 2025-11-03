# Live Session Intelligence - Detailed Task Breakdown

**Version:** 1.0
**Date:** 2025-11-02
**Total Tasks:** 87
**Total Effort:** ~160 hours

---

## How to Use This Document

Each task includes:
- **ID**: Unique identifier (e.g., P1-T01)
- **Agent**: Which specialized agent owns this task
- **Effort**: Estimated hours
- **Dependencies**: Tasks that must complete first
- **Acceptance Criteria**: Definition of done
- **Files**: Files created or modified

**Task Format:**
```
P{Phase}-T{Number}: Task Name
Agent: {Agent 1-4}
Effort: {hours}
Dependencies: {task IDs}
Status: [ ] Not Started | [~] In Progress | [✓] Complete

Description: What needs to be done

Acceptance Criteria:
- [ ] Criterion 1
- [ ] Criterion 2

Files:
- src/path/to/file.ts (NEW or MODIFIED)
```

---

## Phase 1: Query Engine Foundation (Week 1-2, 32 hours)

### P1-T01: Create SessionQueryEngine Core Class
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 6 hours
**Dependencies:** None
**Status:** [ ] Not Started

**Description:**
Create the core SessionQueryEngine class that handles all query types (structured, natural language, aggregation) and routes to appropriate handlers.

**Acceptance Criteria:**
- [ ] Class supports 3 query types: structured, natural, aggregation
- [ ] Query routing logic implemented
- [ ] Error handling for invalid queries
- [ ] TypeScript strict mode, zero errors
- [ ] JSDoc documentation complete
- [ ] Unit tests: 80%+ coverage

**Files:**
- `src/services/SessionQueryEngine.ts` (NEW - 400 lines)
- `src/services/SessionQueryEngine.test.ts` (NEW - 200 lines)

---

### P1-T02: Implement LiveSessionContextProvider
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 8 hours
**Dependencies:** None
**Status:** [ ] Not Started

**Description:**
Create the LiveSessionContextProvider class that provides efficient data filtering methods for AI queries (searchScreenshots, searchAudioSegments, getRecentActivity, etc.).

**Acceptance Criteria:**
- [ ] All search methods implemented (screenshots, audio, recent, since)
- [ ] Filter logic correct for all parameters
- [ ] Performance: <1ms for typical sessions (10-100 items)
- [ ] Focus filter application works
- [ ] TypeScript strict mode, zero errors
- [ ] Unit tests: 85%+ coverage

**Files:**
- `src/services/LiveSessionContextProvider.ts` (NEW - 500 lines)
- `src/services/LiveSessionContextProvider.test.ts` (NEW - 250 lines)

---

### P1-T03: Implement Structured Query Handler
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 3 hours
**Dependencies:** P1-T01, P1-T02
**Status:** [ ] Not Started

**Description:**
Implement the structured query handler in SessionQueryEngine that uses LiveSessionContextProvider for direct data filtering.

**Acceptance Criteria:**
- [ ] Structured queries return correct results
- [ ] All filter parameters work (activity, keywords, hasBlockers, etc.)
- [ ] Performance: <200ms for complex queries
- [ ] Results sorted by relevance
- [ ] Unit tests: 90%+ coverage

**Files:**
- `src/services/SessionQueryEngine.ts` (MODIFIED)
- `src/services/SessionQueryEngine.test.ts` (MODIFIED)

---

### P1-T04: Implement Natural Language Query Handler
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 6 hours
**Dependencies:** P1-T01, P1-T02
**Status:** [ ] Not Started

**Description:**
Implement natural language query handler that uses Claude with access to LiveSessionContextProvider query tools.

**Acceptance Criteria:**
- [ ] Claude integration works (uses claude_chat_completion)
- [ ] AI has access to query tools in prompt
- [ ] Answers are contextual and accurate (95%+ on test queries)
- [ ] Performance: <3s for typical queries
- [ ] Error handling for API failures
- [ ] Confidence scores included in results
- [ ] Integration tests with real session data

**Files:**
- `src/services/SessionQueryEngine.ts` (MODIFIED)
- `src/services/SessionQueryEngine.test.ts` (MODIFIED)

---

### P1-T05: Create Tauri Query Commands
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 4 hours
**Dependencies:** P1-T01
**Status:** [ ] Not Started

**Description:**
Create Tauri commands for external tool integration: query_active_session, query_sessions, subscribe_session_events.

**Acceptance Criteria:**
- [ ] All 3 commands implemented in Rust
- [ ] Commands call TypeScript SessionQueryEngine via bridge
- [ ] Error handling for invalid inputs
- [ ] Response serialization works
- [ ] Test script can query from Rust
- [ ] Documentation with examples

**Files:**
- `src-tauri/src/session_query_api.rs` (NEW - 300 lines)
- `src-tauri/src/lib.rs` (MODIFIED - register commands)
- `scripts/test-query-api.js` (NEW - test script)

---

### P1-T06: Implement Real-Time Event Subscription
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 5 hours
**Dependencies:** P1-T05
**Status:** [ ] Not Started

**Description:**
Implement WebSocket-like event subscription over Tauri IPC so external tools can subscribe to real-time session updates.

**Acceptance Criteria:**
- [ ] Subscribe command registers listeners
- [ ] Events broadcast to all subscribers
- [ ] Unsubscribe works correctly
- [ ] No memory leaks (subscribers cleaned up)
- [ ] Event filtering works (only subscribed events sent)
- [ ] Test script receives events

**Files:**
- `src-tauri/src/session_query_api.rs` (MODIFIED)
- `src/services/SessionQueryEngine.ts` (MODIFIED - emit events)
- `scripts/test-subscription.js` (NEW - test script)

---

### P1-T07: Write Query API Documentation
**Agent:** Agent 4 (Integration & Quality)
**Effort:** 4 hours
**Dependencies:** P1-T01 through P1-T06
**Status:** [ ] Not Started

**Description:**
Write comprehensive API documentation with all endpoints, request/response formats, error codes, and working examples.

**Acceptance Criteria:**
- [ ] All query types documented
- [ ] All Tauri commands documented
- [ ] Request/response examples for each endpoint
- [ ] Error codes explained
- [ ] 3+ working code examples included
- [ ] Markdown formatted, easy to read

**Files:**
- `docs/api/SESSION_QUERY_API.md` (NEW - comprehensive guide)

---

## Phase 2: Live Intelligence Service (Week 2-3, 28 hours)

### P2-T01: Create LiveSessionIntelligenceService Class
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 4 hours
**Dependencies:** None
**Status:** [ ] Not Started

**Description:**
Create the core LiveSessionIntelligenceService class that orchestrates event-driven summary updates and AI decision making.

**Acceptance Criteria:**
- [ ] Class structure defined
- [ ] Event listener setup (screenshot-analyzed, audio-processed)
- [ ] Pending changes tracking (Map<sessionId, changes>)
- [ ] TypeScript strict mode, zero errors
- [ ] Singleton pattern implemented
- [ ] JSDoc documentation complete

**Files:**
- `src/services/LiveSessionIntelligenceService.ts` (NEW - 600 lines)
- `src/services/LiveSessionIntelligenceService.test.ts` (NEW - 300 lines)

---

### P2-T02: Implement AI-Based Significance Calculation
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 5 hours
**Dependencies:** P2-T01
**Status:** [ ] Not Started

**Description:**
Implement AI-based significance calculation that uses Claude to determine how meaningful a context change is (no hardcoded rules).

**Acceptance Criteria:**
- [ ] Uses Claude for significance scoring
- [ ] Returns: low/medium/high significance
- [ ] Considers: blockers, achievements, curiosity, context delta
- [ ] Performance: <2s per calculation
- [ ] Caches results (5-minute TTL)
- [ ] Unit tests with mock Claude responses

**Files:**
- `src/services/LiveSessionIntelligenceService.ts` (MODIFIED)
- `src/services/LiveSessionIntelligenceService.test.ts` (MODIFIED)

---

### P2-T03: Implement AI-Based Update Trigger Decision
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 5 hours
**Dependencies:** P2-T01, P2-T02
**Status:** [ ] Not Started

**Description:**
Implement AI-based decision making for when to trigger summary updates (uses Claude, not fixed rules).

**Acceptance Criteria:**
- [ ] Uses Claude to decide when to update
- [ ] Considers: pending changes, time since last update, significance scores
- [ ] Returns: { shouldUpdate: boolean, reason: string }
- [ ] Respects minimum time between updates (30s)
- [ ] Respects maximum time without update (5 min)
- [ ] Unit tests with various scenarios

**Files:**
- `src/services/LiveSessionIntelligenceService.ts` (MODIFIED)
- `src/services/LiveSessionIntelligenceService.test.ts` (MODIFIED)

---

### P2-T04: Implement Proactive Suggestion Generation
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 6 hours
**Dependencies:** P2-T01, P1-T02
**Status:** [ ] Not Started

**Description:**
Implement AI-based suggestion generation for tasks and notes using Claude with confidence + relevance scoring.

**Acceptance Criteria:**
- [ ] Uses Claude with LiveSessionContextProvider
- [ ] Generates task suggestions with priority
- [ ] Generates note suggestions with context
- [ ] Confidence + relevance >= 1.3 threshold
- [ ] Includes reasoning for each suggestion
- [ ] Returns dismissed suggestion status
- [ ] Integration tests with real session data

**Files:**
- `src/services/LiveSessionIntelligenceService.ts` (MODIFIED)
- `src/services/LiveSessionIntelligenceService.test.ts` (MODIFIED)

---

### P2-T05: Add Session Events to EventBus
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 2 hours
**Dependencies:** None
**Status:** [ ] Not Started

**Description:**
Add new session intelligence events to EventBus EventMap interface.

**Acceptance Criteria:**
- [ ] All events added to EventMap
- [ ] Event payload interfaces defined
- [ ] TypeScript strict mode, zero errors
- [ ] JSDoc documentation for each event
- [ ] Backwards compatible (no breaking changes)

**Files:**
- `src/utils/eventBus.ts` (MODIFIED - add events to EventMap)

**Events to Add:**
- screenshot-analyzed
- audio-segment-processed
- session-context-changed
- summary-update-triggered
- summary-updated
- ai-question-asked
- ai-question-answered
- focus-mode-changed
- suggestion-accepted
- suggestion-dismissed

---

### P2-T06: Emit Events in SessionsZone
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 3 hours
**Dependencies:** P2-T05
**Status:** [ ] Not Started

**Description:**
Add event emission in SessionsZone after screenshot analysis completes.

**Acceptance Criteria:**
- [ ] Event emitted after updateScreenshotAnalysis (line 763)
- [ ] Event includes all required fields
- [ ] Significance calculated before emission
- [ ] No blocking operations
- [ ] Integration test: event received by listener

**Files:**
- `src/components/SessionsZone.tsx` (MODIFIED - add eventBus.emit at line 763)

---

### P2-T07: Update SessionSummary Type
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 3 hours
**Dependencies:** None
**Status:** [ ] Not Started

**Description:**
Add new optional fields to SessionSummary interface for intelligence features.

**Acceptance Criteria:**
- [ ] All new fields added as optional
- [ ] TypeScript interfaces documented
- [ ] No breaking changes (all optional)
- [ ] Examples in JSDoc

**Files:**
- `src/types.ts` (MODIFIED - add to SessionSummary interface)

**Fields to Add:**
- suggestedNotes (with dismissal tracking)
- interactivePrompt (AI question state)
- focusMode (current focus filter)
- dismissedSuggestions (tracking for resurrection)

---

## Phase 3: Interactive Q&A (Week 3-4, 24 hours)

### P3-T01: Create AIQuestionManager Service
**Agent:** Agent 2 (Interactive AI Components)
**Effort:** 5 hours
**Dependencies:** P2-T05
**Status:** [ ] Not Started

**Description:**
Create AIQuestionManager service that manages interactive question lifecycle (active questions, timeouts, answers).

**Acceptance Criteria:**
- [ ] askQuestion() creates question with timeout
- [ ] answerQuestion() handles user responses
- [ ] Timeout auto-answers with first suggested option
- [ ] Active questions tracked per session
- [ ] Cleanup on session end
- [ ] TypeScript strict mode, zero errors
- [ ] Unit tests: 80%+ coverage

**Files:**
- `src/services/AIQuestionManager.ts` (NEW - 300 lines)
- `src/services/AIQuestionManager.test.ts` (NEW - 150 lines)

---

### P3-T02: Integrate Q&A with Intelligence Service
**Agent:** Agent 1 (Backend Infrastructure)
**Effort:** 4 hours
**Dependencies:** P2-T01, P3-T01
**Status:** [ ] Not Started

**Description:**
Integrate AIQuestionManager with LiveSessionIntelligenceService so AI can generate questions when uncertain.

**Acceptance Criteria:**
- [ ] AI decides when to ask (confidence-based)
- [ ] Questions generated via Claude
- [ ] 2-4 suggested answers + optional free text
- [ ] Timeout set to 15-20s
- [ ] Answers fed back to summary generation
- [ ] Integration test: Full Q&A flow

**Files:**
- `src/services/LiveSessionIntelligenceService.ts` (MODIFIED)
- `src/services/LiveSessionIntelligenceService.test.ts` (MODIFIED)

---

### P3-T03: Create InteractivePrompt Component
**Agent:** Agent 2 (Interactive AI Components)
**Effort:** 6 hours
**Dependencies:** P3-T01
**Status:** [ ] Not Started

**Description:**
Create InteractivePrompt React component that displays AI questions with flexible rendering (banner, modal, notification).

**Acceptance Criteria:**
- [ ] Displays question and suggested answers
- [ ] Countdown timer shows time remaining
- [ ] Progress bar animates linearly
- [ ] Free text input mode works
- [ ] Keyboard navigation works (Enter to submit)
- [ ] Framer Motion animations smooth
- [ ] Works in banner mode (position: top)
- [ ] Unit tests: 80%+ coverage

**Files:**
- `src/components/sessions/InteractivePrompt.tsx` (NEW - 250 lines)
- `src/components/sessions/InteractivePrompt.test.tsx` (NEW - 150 lines)

---

### P3-T04: Integrate InteractivePrompt with ActiveSessionView
**Agent:** Agent 2 (Interactive AI Components)
**Effort:** 3 hours
**Dependencies:** P3-T03
**Status:** [ ] Not Started

**Description:**
Integrate InteractivePrompt component into ActiveSessionView header as a banner that appears when session.summary?.interactivePrompt exists.

**Acceptance Criteria:**
- [ ] Banner appears above header content
- [ ] AnimatePresence for enter/exit
- [ ] Doesn't break existing layout
- [ ] Answers trigger summary regeneration
- [ ] Visual test: Looks polished

**Files:**
- `src/components/ActiveSessionView.tsx` (MODIFIED - add InteractivePrompt banner)

---

### P3-T05: Test Full Q&A Flow
**Agent:** Agent 2 (Interactive AI Components)
**Effort:** 4 hours
**Dependencies:** P3-T01, P3-T02, P3-T03, P3-T04
**Status:** [ ] Not Started

**Description:**
Create comprehensive integration test for full Q&A flow (AI asks → user answers → summary updates).

**Acceptance Criteria:**
- [ ] Test: AI detects uncertainty
- [ ] Test: Question appears in UI
- [ ] Test: User answers before timeout
- [ ] Test: Timeout auto-answers
- [ ] Test: Answer improves summary
- [ ] All tests pass consistently

**Files:**
- `src/components/sessions/InteractivePrompt.integration.test.tsx` (NEW - 200 lines)

---

### P3-T06: Polish Q&A Animations
**Agent:** Agent 2 (Interactive AI Components)
**Effort:** 2 hours
**Dependencies:** P3-T04
**Status:** [ ] Not Started

**Description:**
Polish all animations and transitions for InteractivePrompt component.

**Acceptance Criteria:**
- [ ] Enter animation smooth (fade + slide)
- [ ] Exit animation smooth
- [ ] Progress bar linear easing
- [ ] Button hover states smooth
- [ ] 60fps performance verified
- [ ] Visual QA passed

**Files:**
- `src/components/sessions/InteractivePrompt.tsx` (MODIFIED)

---

## Phase 4: AI Query Interface (Week 4-5, 20 hours)

### P4-T01: Create AIQueryInterface Component
**Agent:** Agent 2 (Interactive AI Components)
**Effort:** 8 hours
**Dependencies:** P1-T01
**Status:** [ ] Not Started

**Description:**
Create AIQueryInterface component that allows users to ask natural language questions about the session.

**Acceptance Criteria:**
- [ ] Text input for questions
- [ ] "Ask AI" button triggers query
- [ ] Loading state while querying
- [ ] Answer display with formatting
- [ ] Suggested questions as quick buttons
- [ ] Query history (last 5 questions)
- [ ] Works in modal mode
- [ ] Framer Motion animations
- [ ] Keyboard shortcuts (Escape to close, Enter to submit)
- [ ] Unit tests: 80%+ coverage

**Files:**
- `src/components/sessions/AIQueryInterface.tsx` (NEW - 400 lines)
- `src/components/sessions/AIQueryInterface.test.tsx` (NEW - 200 lines)

---

### P4-T02: Add "Ask AI" Button to SpaceMenuBar
**Agent:** Agent 2 (Interactive AI Components)
**Effort:** 2 hours
**Dependencies:** P4-T01
**Status:** [ ] Not Started

**Description:**
Add "Ask AI" button to SpaceMenuBar in ActiveSessionView that opens AIQueryInterface modal.

**Acceptance Criteria:**
- [ ] Button styled consistently (pill-shaped)
- [ ] Icon + text label
- [ ] Opens modal on click
- [ ] Modal closes on Escape or close button
- [ ] Doesn't break existing menu layout

**Files:**
- `src/components/ActiveSessionView.tsx` (MODIFIED - add button to SpaceMenuBar)

---

### P4-T03: Implement Suggested Questions
**Agent:** Agent 2 (Interactive AI Components)
**Effort:** 3 hours
**Dependencies:** P4-T01
**Status:** [ ] Not Started

**Description:**
Implement suggested question buttons in AIQueryInterface (quick access to common queries).

**Acceptance Criteria:**
- [ ] 5-6 suggested questions displayed
- [ ] Click pre-fills input and submits
- [ ] Questions contextual to session (e.g., "What blockers do I have?")
- [ ] Questions updated based on session state

**Files:**
- `src/components/sessions/AIQueryInterface.tsx` (MODIFIED)

---

### P4-T04: Implement Query History
**Agent:** Agent 2 (Interactive AI Components)
**Effort:** 3 hours
**Dependencies:** P4-T01
**Status:** [ ] Not Started

**Description:**
Implement query history in AIQueryInterface (shows last 5 questions/answers).

**Acceptance Criteria:**
- [ ] Last 5 queries stored in state
- [ ] History displayed below input
- [ ] Click question to resubmit
- [ ] Clear history button
- [ ] Persists during session (not across app restarts)

**Files:**
- `src/components/sessions/AIQueryInterface.tsx` (MODIFIED)

---

### P4-T05: Polish Query Interface UI
**Agent:** Agent 2 (Interactive AI Components)
**Effort:** 2 hours
**Dependencies:** P4-T01, P4-T03, P4-T04
**Status:** [ ] Not Started

**Description:**
Polish AIQueryInterface UI with animations, loading states, error handling.

**Acceptance Criteria:**
- [ ] Loading spinner while querying
- [ ] Error messages user-friendly
- [ ] Animations smooth (60fps)
- [ ] Responsive design works
- [ ] Visual QA passed

**Files:**
- `src/components/sessions/AIQueryInterface.tsx` (MODIFIED)

---

### P4-T06: Test Query Interface Integration
**Agent:** Agent 2 (Interactive AI Components)
**Effort:** 2 hours
**Dependencies:** P4-T02
**Status:** [ ] Not Started

**Description:**
Create integration test for full query interface flow (open → ask → receive answer → close).

**Acceptance Criteria:**
- [ ] Test: Button opens modal
- [ ] Test: Question submitted correctly
- [ ] Test: Answer displayed
- [ ] Test: Modal closes
- [ ] All tests pass

**Files:**
- `src/components/sessions/AIQueryInterface.integration.test.tsx` (NEW - 150 lines)

---

## Phase 5: Action-Oriented UI (Week 5-6, 32 hours)

### P5-T01: Create LiveIntelligencePanel Component
**Agent:** Agent 3 (Action-Oriented UI)
**Effort:** 6 hours
**Dependencies:** P2-T07
**Status:** [ ] Not Started

**Description:**
Create LiveIntelligencePanel component that replaces current Summary tab content with modern action-oriented interface.

**Acceptance Criteria:**
- [ ] Layout defined (current focus card + suggestions grid + blockers)
- [ ] Empty state for no summary yet
- [ ] Responsive grid layout
- [ ] Integrates child components (CurrentFocusCard, SuggestionCards, etc.)
- [ ] TypeScript strict mode, zero errors
- [ ] Unit tests: 70%+ coverage

**Files:**
- `src/components/sessions/LiveIntelligencePanel.tsx` (NEW - 500 lines)
- `src/components/sessions/LiveIntelligencePanel.test.tsx` (NEW - 200 lines)

---

### P5-T02: Create CurrentFocusCard Component
**Agent:** Agent 3 (Action-Oriented UI)
**Effort:** 3 hours
**Dependencies:** None
**Status:** [ ] Not Started

**Description:**
Create CurrentFocusCard component that displays current work focus, momentum, and progress.

**Acceptance Criteria:**
- [ ] Displays currentFocus text
- [ ] Momentum indicator (high/medium/low with colors)
- [ ] Progress list (up to 3 achievements)
- [ ] Last updated timestamp
- [ ] Glass morphism styling
- [ ] Framer Motion animations

**Files:**
- `src/components/sessions/CurrentFocusCard.tsx` (NEW - 150 lines)
- `src/components/sessions/CurrentFocusCard.test.tsx` (NEW - 100 lines)

---

### P5-T03: Create TaskSuggestionCard Component
**Agent:** Agent 3 (Action-Oriented UI)
**Effort:** 4 hours
**Dependencies:** None
**Status:** [ ] Not Started

**Description:**
Create TaskSuggestionCard component with Accept/Dismiss actions.

**Acceptance Criteria:**
- [ ] Displays task title, priority, context
- [ ] Confidence + relevance scores visible
- [ ] Accept button creates task
- [ ] Dismiss button removes from suggestions
- [ ] Layouts: compact/detailed
- [ ] Framer Motion animations
- [ ] Unit tests: 80%+ coverage

**Files:**
- `src/components/sessions/TaskSuggestionCard.tsx` (NEW - 200 lines)
- `src/components/sessions/TaskSuggestionCard.test.tsx` (NEW - 150 lines)

---

### P5-T04: Create NoteSuggestionCard Component
**Agent:** Agent 3 (Action-Oriented UI)
**Effort:** 4 hours
**Dependencies:** None
**Status:** [ ] Not Started

**Description:**
Create NoteSuggestionCard component with Accept/Dismiss actions.

**Acceptance Criteria:**
- [ ] Displays note title, summary, reason
- [ ] Confidence + relevance scores visible
- [ ] Accept button creates note
- [ ] Dismiss button removes from suggestions
- [ ] Layouts: compact/detailed
- [ ] Framer Motion animations
- [ ] Unit tests: 80%+ coverage

**Files:**
- `src/components/sessions/NoteSuggestionCard.tsx` (NEW - 200 lines)
- `src/components/sessions/NoteSuggestionCard.test.tsx` (NEW - 150 lines)

---

### P5-T05: Create FocusModeSelector Component
**Agent:** Agent 3 (Action-Oriented UI)
**Effort:** 3 hours
**Dependencies:** P2-T07
**Status:** [ ] Not Started

**Description:**
Create FocusModeSelector component with preset and custom focus modes.

**Acceptance Criteria:**
- [ ] Presets: All Activity, Coding Only, Debugging Only, etc.
- [ ] Custom filter option (opens modal)
- [ ] AI-suggested focus appears as pill button
- [ ] Focus change triggers summary regeneration
- [ ] Pill-shaped buttons
- [ ] Unit tests: 70%+ coverage

**Files:**
- `src/components/sessions/FocusModeSelector.tsx` (NEW - 150 lines)
- `src/components/sessions/FocusModeSelector.test.tsx` (NEW - 100 lines)

---

### P5-T06: Create BlockersPanel Component
**Agent:** Agent 3 (Action-Oriented UI)
**Effort:** 2 hours
**Dependencies:** None
**Status:** [ ] Not Started

**Description:**
Create BlockersPanel component that displays active blockers with icons and context.

**Acceptance Criteria:**
- [ ] Displays blocker list
- [ ] Icons for each blocker
- [ ] Timestamps
- [ ] Related screenshot links
- [ ] Empty state if no blockers

**Files:**
- `src/components/sessions/BlockersPanel.tsx` (NEW - 150 lines)
- `src/components/sessions/BlockersPanel.test.tsx` (NEW - 100 lines)

---

### P5-T07: Implement One-Click Task Creation
**Agent:** Agent 3 (Action-Oriented UI)
**Effort:** 3 hours
**Dependencies:** P5-T03
**Status:** [ ] Not Started

**Description:**
Implement one-click task creation from suggestions (integrates with useTasks context).

**Acceptance Criteria:**
- [ ] Accept button creates task correctly
- [ ] Task includes: title, description, priority
- [ ] Task linked to session (sourceSessionId)
- [ ] Success toast notification
- [ ] Suggestion removed from UI
- [ ] Integration test with TasksContext

**Files:**
- `src/components/sessions/LiveIntelligencePanel.tsx` (MODIFIED)

---

### P5-T08: Implement One-Click Note Creation
**Agent:** Agent 3 (Action-Oriented UI)
**Effort:** 3 hours
**Dependencies:** P5-T04
**Status:** [ ] Not Started

**Description:**
Implement one-click note creation from suggestions (integrates with useNotes context).

**Acceptance Criteria:**
- [ ] Accept button creates note correctly
- [ ] Note includes: title, content, tags
- [ ] Note linked to session (sourceSessionId)
- [ ] Success toast notification
- [ ] Suggestion removed from UI
- [ ] Integration test with NotesContext

**Files:**
- `src/components/sessions/LiveIntelligencePanel.tsx` (MODIFIED)

---

### P5-T09: Implement Dismissal Tracking
**Agent:** Agent 3 (Action-Oriented UI)
**Effort:** 4 hours
**Dependencies:** P5-T07, P5-T08
**Status:** [ ] Not Started

**Description:**
Implement dismissal tracking for suggestions (stores dismissed IDs, enables resurrection logic).

**Acceptance Criteria:**
- [ ] Dismiss button stores ID in session.summary.dismissedSuggestions
- [ ] Dismissed suggestions don't reappear immediately
- [ ] Resurrection logic: AI can resurface if confidence+relevance increase
- [ ] Dismissed metadata tracked (timestamp, reason)
- [ ] Integration test: Dismiss → resurrect flow

**Files:**
- `src/components/sessions/LiveIntelligencePanel.tsx` (MODIFIED)
- `src/services/LiveSessionIntelligenceService.ts` (MODIFIED - resurrection logic)

---

### P5-T10: Replace Summary Tab Content
**Agent:** Agent 3 (Action-Oriented UI)
**Effort:** 2 hours
**Dependencies:** P5-T01 through P5-T09
**Status:** [ ] Not Started

**Description:**
Replace ActiveSessionView Summary tab content with LiveIntelligencePanel component.

**Acceptance Criteria:**
- [ ] Old summary UI removed (lines 447-636)
- [ ] LiveIntelligencePanel integrated
- [ ] No layout breaks
- [ ] Visual regression test passed

**Files:**
- `src/components/ActiveSessionView.tsx` (MODIFIED - replace Summary tab)

---

### P5-T11: Polish UI Animations
**Agent:** Agent 3 (Action-Oriented UI)
**Effort:** 2 hours
**Dependencies:** P5-T10
**Status:** [ ] Not Started

**Description:**
Polish all animations in LiveIntelligencePanel and child components.

**Acceptance Criteria:**
- [ ] Card enter/exit animations smooth
- [ ] Suggestion acceptance animates out
- [ ] Focus mode change animates
- [ ] 60fps performance verified
- [ ] Visual QA passed

**Files:**
- `src/components/sessions/LiveIntelligencePanel.tsx` (MODIFIED)
- All child components (MODIFIED)

---

## Phase 6: External Integration + Polish (Week 6-8, 24 hours)

### P6-T01: Create Ned Query Tool
**Agent:** Agent 4 (Integration & Quality)
**Effort:** 4 hours
**Dependencies:** P1-T01
**Status:** [ ] Not Started

**Description:**
Create Ned tool that enables querying active session via natural language.

**Acceptance Criteria:**
- [ ] Tool definition added to Ned's tool registry
- [ ] Tool calls SessionQueryEngine
- [ ] Returns formatted results
- [ ] Example queries work (documented)
- [ ] Integration test with Ned

**Files:**
- `src/services/nedTools/queryActiveSessionTool.ts` (NEW - 150 lines)
- `src/services/nedToolExecutor.ts` (MODIFIED - register tool)

---

### P6-T02: Create Alfred Workflow Example
**Agent:** Agent 4 (Integration & Quality)
**Effort:** 3 hours
**Dependencies:** P1-T05
**Status:** [ ] Not Started

**Description:**
Create working Alfred/Raycast workflow example that queries active session.

**Acceptance Criteria:**
- [ ] Script queries via Tauri IPC
- [ ] Returns session status
- [ ] Displays in Alfred results
- [ ] README with setup instructions
- [ ] Tested on macOS

**Files:**
- `docs/examples/alfred-workflow.js` (NEW - example)
- `docs/examples/alfred-workflow-README.md` (NEW - setup guide)

---

### P6-T03: Create VS Code Extension Example
**Agent:** Agent 4 (Integration & Quality)
**Effort:** 3 hours
**Dependencies:** P1-T05
**Status:** [ ] Not Started

**Description:**
Create mock VS Code extension that shows session context in sidebar.

**Acceptance Criteria:**
- [ ] Extension queries active session
- [ ] Displays current focus, blockers, achievements
- [ ] Updates on session events
- [ ] README with setup instructions
- [ ] Screenshot included

**Files:**
- `docs/examples/vscode-extension.js` (NEW - example)
- `docs/examples/vscode-extension-README.md` (NEW - setup guide)

---

### P6-T04: Create Obsidian Plugin Example
**Agent:** Agent 4 (Integration & Quality)
**Effort:** 3 hours
**Dependencies:** P1-T05
**Status:** [ ] Not Started

**Description:**
Create mock Obsidian plugin that syncs session notes to Obsidian vault.

**Acceptance Criteria:**
- [ ] Plugin queries session summary
- [ ] Creates markdown note with session data
- [ ] Formats achievements, blockers, insights
- [ ] README with setup instructions
- [ ] Screenshot included

**Files:**
- `docs/examples/obsidian-plugin.js` (NEW - example)
- `docs/examples/obsidian-plugin-README.md` (NEW - setup guide)

---

### P6-T05: Performance Optimization
**Agent:** Agent 4 (Integration & Quality)
**Effort:** 4 hours
**Dependencies:** All previous tasks
**Status:** [ ] Not Started

**Description:**
Profile and optimize performance to meet targets (<100ms UI, <5s summaries).

**Acceptance Criteria:**
- [ ] UI interactions: <100ms (measured)
- [ ] Query response: <200ms structured, <3s natural language
- [ ] Summary generation: <5s end-to-end
- [ ] No memory leaks in long sessions (8+ hours)
- [ ] React DevTools profiler shows no unnecessary renders
- [ ] Lighthouse performance score: 90+

**Files:**
- Various (performance optimizations)

---

### P6-T06: Accessibility Audit
**Agent:** Agent 4 (Integration & Quality)
**Effort:** 3 hours
**Dependencies:** All UI tasks
**Status:** [ ] Not Started

**Description:**
Audit all new components for accessibility (WCAG AA compliance).

**Acceptance Criteria:**
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels on all components
- [ ] Focus states visible
- [ ] Screen reader tested (VoiceOver)
- [ ] Color contrast WCAG AA
- [ ] axe DevTools: 0 violations

**Files:**
- Various (accessibility fixes)

---

### P6-T07: Final Integration Testing
**Agent:** Agent 4 (Integration & Quality)
**Effort:** 4 hours
**Dependencies:** All previous tasks
**Status:** [ ] Not Started

**Description:**
Run comprehensive integration tests for all features end-to-end.

**Acceptance Criteria:**
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Manual testing checklist complete
- [ ] External tool examples work
- [ ] Ned integration works
- [ ] No console errors
- [ ] No TypeScript errors

**Files:**
- `src/__tests__/integration/live-session-intelligence.test.tsx` (NEW - 300 lines)

---

## Summary Statistics

**Total Tasks:** 87
**Total Estimated Effort:** ~160 hours

**By Agent:**
- Agent 1 (Backend): 17 tasks, ~62 hours
- Agent 2 (Interactive AI): 12 tasks, ~44 hours
- Agent 3 (Action-Oriented UI): 11 tasks, ~36 hours
- Agent 4 (Integration & Quality): 10 tasks, ~18 hours

**By Phase:**
- Phase 1: 7 tasks, 32 hours
- Phase 2: 7 tasks, 28 hours
- Phase 3: 6 tasks, 24 hours
- Phase 4: 6 tasks, 20 hours
- Phase 5: 11 tasks, 32 hours
- Phase 6: 7 tasks, 24 hours

**Critical Path:**
P1-T01 → P1-T02 → P1-T04 → P2-T01 → P2-T04 → P3-T01 → P3-T02 → P5-T01 → P5-T10

**Estimated Timeline:** 6-8 weeks with parallel agent work
