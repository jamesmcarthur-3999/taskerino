# Live Session Intelligence - Final Implementation Plan

**Version:** 1.0
**Date:** 2025-11-02
**Status:** Ready for Implementation
**Timeline:** 6-8 Weeks
**Effort:** ~160 hours

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Vision & Goals](#vision--goals)
3. [Architecture Overview](#architecture-overview)
4. [Implementation Phases](#implementation-phases)
5. [Agent Task Assignments](#agent-task-assignments)
6. [Quality Standards](#quality-standards)
7. [Testing Strategy](#testing-strategy)
8. [Success Criteria](#success-criteria)
9. [Risk Mitigation](#risk-mitigation)
10. [Deployment Plan](#deployment-plan)

---

## Executive Summary

### What We're Building

Transform live sessions from **passive recording** to **active AI collaboration** with a **universal query platform** that enables:

1. **For Users**: AI that proactively helps during work (suggests tasks/notes, asks clarifying questions, provides focus guidance)
2. **For Developers**: Universal query API that any internal component can use
3. **For External Tools**: Tauri IPC API for external integrations (Alfred, VS Code, Obsidian, etc.)
4. **For Ned**: Query tool to understand and discuss active work sessions

### Core Innovation

**From:** Fixed 1-minute polling with massive context dumps
**To:** Event-driven AI with queryable context and interactive refinement

### Key Metrics

- **Token Efficiency**: 50-70% reduction via queryable context
- **Summary Latency**: <5 seconds from trigger to display
- **Query Response**: <200ms structured, <3s natural language
- **UI Response**: <100ms for all interactions
- **External Integration**: <1 hour for developers to integrate

---

## Vision & Goals

### User Experience Goals

**During Active Sessions:**
- AI suggests tasks when blockers detected (one-click creation)
- AI suggests notes when learning moments detected
- AI asks clarifying questions when uncertain (15-20s timeout)
- User can ask AI questions anytime ("What am I working on?")
- Focus mode narrows AI's attention to specific activities
- Summary updates when meaningful (not arbitrary intervals)

**For Developers:**
- Query session data with simple API calls
- Subscribe to real-time updates
- Access both active and historical sessions
- Well-documented with working examples

**For External Tools:**
- Alfred/Raycast: Quick status queries
- VS Code: Session context in sidebar
- Obsidian: Sync session notes
- Custom integrations via Tauri IPC

### Technical Goals

1. **AI-Driven Intelligence** - All decisions made by Claude (no hardcoded rules)
2. **Universal Query Platform** - Reusable across all features
3. **Flexible Components** - Work inline, modal, overlay, future system-level
4. **External-First API** - External tools are first-class citizens
5. **Performance** - Sub-second UI, sub-5s summaries
6. **Extensibility** - Easy to add new query types, suggestion types, focus modes

---

## Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interactions                        │
├─────────────────────────────────────────────────────────────┤
│  • "Ask AI" button → Query modal                            │
│  • AI questions → Interactive prompt banner                  │
│  • Task/note suggestions → One-click creation                │
│  • Focus mode selector → Filter AI attention                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Session Query Engine (Universal API)            │
├─────────────────────────────────────────────────────────────┤
│  • Natural language queries (AI-powered)                     │
│  • Structured queries (direct filtering)                     │
│  • Aggregation queries (analytics)                           │
│  • Real-time subscriptions (event stream)                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           Live Session Intelligence Service                  │
├─────────────────────────────────────────────────────────────┤
│  • Event listeners (screenshot-analyzed, audio-processed)    │
│  • AI-based significance calculation                         │
│  • AI-based update trigger decisions                         │
│  • Proactive suggestion generation                           │
│  • Interactive Q&A management                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Session Data Layer                        │
├─────────────────────────────────────────────────────────────┤
│  • Screenshots with AI analysis                              │
│  • Audio segments with transcripts                           │
│  • Entities (topics, companies, contacts)                    │
│  • User interactions (tasks created, notes saved)            │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

**Core Services:**
1. **SessionQueryEngine** - Universal query API (internal + external)
2. **LiveSessionIntelligenceService** - Event-driven AI orchestration
3. **LiveSessionContextProvider** - Efficient data filtering for AI
4. **AIQuestionManager** - Interactive Q&A lifecycle

**UI Components (Flexible Rendering):**
1. **AIQueryInterface** - "Ask AI" modal (mode: inline/modal/overlay)
2. **InteractivePrompt** - AI questions banner (position: top/center/notification)
3. **SuggestionCard** - Task/note suggestions (layout: compact/detailed/notification)
4. **LiveIntelligencePanel** - Modern summary interface
5. **FocusModeSelector** - Focus filter controls

**External API:**
1. **Tauri Commands** - IPC interface for external tools
2. **Event Subscription** - Real-time update stream
3. **API Documentation** - Comprehensive guide with examples

---

## Implementation Phases

### Phase 1: Query Engine Foundation (Week 1-2, 32 hours)

**Goal:** Build universal API that everything uses

**Deliverables:**
- ✅ SessionQueryEngine class with 3 query types
- ✅ LiveSessionContextProvider for data filtering
- ✅ Tauri commands for external access
- ✅ Real-time event subscription system
- ✅ API documentation with examples

**Files Created:**
- `src/services/SessionQueryEngine.ts` (400 lines)
- `src/services/LiveSessionContextProvider.ts` (500 lines)
- `src-tauri/src/session_query_api.rs` (300 lines)
- `docs/api/SESSION_QUERY_API.md` (documentation)

**Quality Gates:**
- [ ] All query types return correct results
- [ ] Natural language queries via Claude work
- [ ] External tool example works (test script)
- [ ] Performance: <200ms structured, <3s natural language
- [ ] TypeScript strict mode, zero errors
- [ ] Unit tests: 80%+ coverage

---

### Phase 2: Live Intelligence Service (Week 2-3, 28 hours)

**Goal:** Event-driven AI decision making

**Deliverables:**
- ✅ LiveSessionIntelligenceService with AI-based decisions
- ✅ Event emission after screenshot analysis
- ✅ Proactive suggestion generation (tasks/notes)
- ✅ Event types added to EventBus

**Files Created:**
- `src/services/LiveSessionIntelligenceService.ts` (600 lines)
- `src/services/LiveSessionIntelligenceService.test.ts` (300 lines)
- `src/utils/eventBus.ts` (updated with new events)

**Files Modified:**
- `src/components/SessionsZone.tsx` (add event emission at line 763)
- `src/types.ts` (add new SessionSummary fields)

**Quality Gates:**
- [ ] Events fire correctly after screenshot analysis
- [ ] AI decides when to update (not fixed timing)
- [ ] Suggestions have valid confidence/relevance scores (>= 1.3 combined)
- [ ] No blocking operations on main thread
- [ ] Unit tests: 75%+ coverage
- [ ] Integration test: Full event flow works

---

### Phase 3: Interactive Q&A (Week 3-4, 24 hours)

**Goal:** AI asks clarifying questions

**Deliverables:**
- ✅ AIQuestionManager service
- ✅ InteractivePrompt component (flexible rendering)
- ✅ Integration with ActiveSessionView
- ✅ 15-20s timeout with auto-answer
- ✅ Answer feedback to summary generation

**Files Created:**
- `src/services/AIQuestionManager.ts` (300 lines)
- `src/components/sessions/InteractivePrompt.tsx` (250 lines)
- `src/components/sessions/InteractivePrompt.test.tsx` (150 lines)

**Files Modified:**
- `src/components/ActiveSessionView.tsx` (add InteractivePrompt banner)
- `src/services/LiveSessionIntelligenceService.ts` (integrate Q&A)

**Quality Gates:**
- [ ] Questions appear when AI is uncertain
- [ ] Timeout works correctly (15-20s)
- [ ] Auto-answer uses first suggested option
- [ ] Answers improve summary quality
- [ ] Component works in banner mode
- [ ] Framer Motion animations smooth
- [ ] Unit tests: 80%+ coverage

---

### Phase 4: AI Query Interface (Week 4-5, 20 hours)

**Goal:** User can ask AI questions

**Deliverables:**
- ✅ AIQueryInterface component
- ✅ "Ask AI" button in SpaceMenuBar
- ✅ Modal rendering with animations
- ✅ Connection to SessionQueryEngine
- ✅ Suggested questions feature

**Files Created:**
- `src/components/sessions/AIQueryInterface.tsx` (400 lines)
- `src/components/sessions/AIQueryInterface.test.tsx` (200 lines)

**Files Modified:**
- `src/components/ActiveSessionView.tsx` (add "Ask AI" button to SpaceMenuBar)

**Quality Gates:**
- [ ] Button opens modal correctly
- [ ] Queries return accurate answers
- [ ] Suggested questions work
- [ ] Loading states smooth
- [ ] Error handling graceful
- [ ] Modal closes on Escape key
- [ ] Unit tests: 80%+ coverage

---

### Phase 5: Action-Oriented UI (Week 5-6, 32 hours)

**Goal:** Modern summary interface with suggestions

**Deliverables:**
- ✅ LiveIntelligencePanel component
- ✅ SuggestionCard components (task, note)
- ✅ FocusModeSelector component
- ✅ One-click task/note creation
- ✅ Dismissal tracking with resurrection logic
- ✅ Focus mode filtering

**Files Created:**
- `src/components/sessions/LiveIntelligencePanel.tsx` (500 lines)
- `src/components/sessions/TaskSuggestionCard.tsx` (200 lines)
- `src/components/sessions/NoteSuggestionCard.tsx` (200 lines)
- `src/components/sessions/FocusModeSelector.tsx` (150 lines)
- `src/components/sessions/CurrentFocusCard.tsx` (150 lines)
- `src/components/sessions/BlockersPanel.tsx` (150 lines)

**Files Modified:**
- `src/components/ActiveSessionView.tsx` (replace Summary tab content)
- `src/types.ts` (add focus mode, dismissed suggestions to SessionSummary)

**Quality Gates:**
- [ ] All UI interactions work
- [ ] Task creation from suggestion works
- [ ] Note creation from suggestion works
- [ ] Dismissal tracking works
- [ ] Focus mode affects summary
- [ ] Dismissed suggestions resurrect correctly
- [ ] Animations smooth (Framer Motion)
- [ ] Responsive design works
- [ ] Unit tests: 70%+ coverage

---

### Phase 6: External Integration + Polish (Week 6-8, 24 hours)

**Goal:** API docs, Ned integration, examples, polish

**Deliverables:**
- ✅ Ned query tool integration
- ✅ Comprehensive API documentation
- ✅ 3+ working external tool examples
- ✅ UI polish and animations
- ✅ Performance optimization
- ✅ Error handling and edge cases

**Files Created:**
- `docs/api/SESSION_QUERY_API.md` (comprehensive guide)
- `docs/examples/alfred-workflow.js` (example)
- `docs/examples/vscode-extension.js` (example)
- `docs/examples/obsidian-plugin.js` (example)
- `src/services/nedTools/queryActiveSessionTool.ts` (Ned integration)

**Files Modified:**
- `src/services/nedToolExecutor.ts` (add query tool)

**Quality Gates:**
- [ ] Ned query tool works
- [ ] All example tools work
- [ ] API documentation complete
- [ ] Performance: <100ms UI, <5s summaries
- [ ] No crashes or errors in production
- [ ] All animations 60fps
- [ ] Accessibility: WCAG AA compliant
- [ ] Final code review passed

---

## Agent Task Assignments

Work is split across **4 specialized agents** for parallel execution:

### Agent 1: Backend Infrastructure (Weeks 1-3)
**Focus:** Query engine, intelligence service, event system

**Responsibilities:**
- Phase 1: SessionQueryEngine + LiveSessionContextProvider
- Phase 1: Tauri commands for external API
- Phase 2: LiveSessionIntelligenceService
- Phase 2: Event emission integration

**Skills Required:**
- TypeScript expert
- Rust/Tauri expert
- Claude API integration
- Event-driven architecture

**Deliverables:**
- Query API fully functional
- Intelligence service making AI decisions
- External tools can query via Tauri IPC
- Real-time subscriptions work

---

### Agent 2: Interactive AI Components (Weeks 3-4)
**Focus:** Q&A system, query interface

**Responsibilities:**
- Phase 3: AIQuestionManager service
- Phase 3: InteractivePrompt component
- Phase 4: AIQueryInterface component
- Phase 4: SpaceMenuBar integration

**Skills Required:**
- React/TypeScript expert
- Framer Motion animations
- UI/UX design
- State management

**Deliverables:**
- AI can ask questions with timeout
- User can ask AI questions
- Modal animations smooth
- Integration with existing UI clean

---

### Agent 3: Action-Oriented UI (Weeks 5-6)
**Focus:** Summary interface, suggestions, focus modes

**Responsibilities:**
- Phase 5: LiveIntelligencePanel component
- Phase 5: SuggestionCard components
- Phase 5: FocusModeSelector component
- Phase 5: Dismissal tracking logic

**Skills Required:**
- React/TypeScript expert
- Component architecture
- Framer Motion animations
- Design system integration

**Deliverables:**
- Modern summary UI complete
- Suggestions work end-to-end
- Focus modes filter correctly
- One-click actions work

---

### Agent 4: Integration & Quality (Weeks 6-8)
**Focus:** Ned integration, external examples, polish, testing

**Responsibilities:**
- Phase 6: Ned query tool
- Phase 6: External tool examples
- Phase 6: API documentation
- Phase 6: Performance optimization
- Phase 6: Final testing & bug fixes

**Skills Required:**
- Full-stack TypeScript
- Technical writing
- Performance optimization
- QA testing

**Deliverables:**
- Ned integration works
- 3+ external examples work
- Complete API docs
- Production-ready quality

---

## Quality Standards

### Code Quality

**TypeScript:**
- ✅ Strict mode enabled
- ✅ Zero type errors
- ✅ No `any` types (except unavoidable)
- ✅ All exports have JSDoc
- ✅ Consistent naming conventions

**React Components:**
- ✅ Functional components with hooks
- ✅ Props interface exported
- ✅ Memoization where appropriate
- ✅ No memory leaks (cleanup in useEffect)
- ✅ Accessible (ARIA labels, keyboard nav)

**Services:**
- ✅ Single responsibility
- ✅ Dependency injection
- ✅ Error handling comprehensive
- ✅ Logging for debugging
- ✅ Performance optimized

### Testing Requirements

**Unit Tests:**
- ✅ All services: 80%+ coverage
- ✅ All components: 70%+ coverage
- ✅ All critical paths: 100% coverage

**Integration Tests:**
- ✅ Query API end-to-end
- ✅ Event flow (screenshot → summary update)
- ✅ Q&A flow (question → answer → summary)
- ✅ External tool integration

**Performance Tests:**
- ✅ Query response times
- ✅ Summary generation times
- ✅ UI render times
- ✅ Memory usage

### Documentation Requirements

**Code Documentation:**
- ✅ All public APIs have JSDoc
- ✅ Complex logic has inline comments
- ✅ README in each new directory

**API Documentation:**
- ✅ Comprehensive guide
- ✅ All endpoints documented
- ✅ Request/response examples
- ✅ Error codes explained
- ✅ Working code examples

**User Documentation:**
- ✅ How to use "Ask AI" feature
- ✅ How focus modes work
- ✅ What AI suggestions mean
- ✅ How to integrate external tools

---

## Testing Strategy

### Unit Testing

**Tools:** Vitest, React Testing Library

**Coverage Targets:**
- Services: 80%+
- Components: 70%+
- Utils: 90%+

**Test Categories:**
1. Query API correctness
2. Event emission/handling
3. Component rendering
4. User interactions
5. Error handling

### Integration Testing

**Scenarios:**
1. **Full Query Flow**
   - User asks question
   - Query engine processes
   - Claude returns answer
   - UI displays result

2. **Event-Driven Update Flow**
   - Screenshot analyzed
   - Event emitted
   - Intelligence service decides
   - Summary generated
   - UI updated

3. **Interactive Q&A Flow**
   - AI generates question
   - User answers (or timeout)
   - Answer fed to summary
   - Summary regenerated

4. **External Tool Integration**
   - External tool queries via Tauri
   - Gets correct response
   - Subscribes to events
   - Receives updates

### Performance Testing

**Benchmarks:**
- Query API: <200ms structured, <3s natural language
- Summary generation: <5s end-to-end
- UI interactions: <100ms
- Event processing: <50ms

**Load Testing:**
- 100+ screenshots in session (query performance)
- Multiple concurrent queries
- Rapid event emission (no backlog)

### Manual Testing

**Checklist:**
- [ ] All UI interactions work
- [ ] Animations smooth (60fps)
- [ ] No console errors
- [ ] No memory leaks (long session)
- [ ] External tool examples work
- [ ] Ned integration works
- [ ] Focus modes affect results
- [ ] Dismissals tracked correctly

---

## Success Criteria

### Quantitative Metrics

**Performance:**
- ✅ Summary update latency: <5 seconds
- ✅ Query response: <200ms structured, <3s natural language
- ✅ UI response: <100ms for all interactions
- ✅ Token efficiency: 50-70% reduction vs current

**Reliability:**
- ✅ Zero crashes in 8-hour session
- ✅ Event delivery: 100% (no dropped events)
- ✅ Query accuracy: 95%+ for natural language

**Adoption:**
- ✅ 60%+ of sessions use Summary tab
- ✅ 40%+ of suggestions accepted
- ✅ 3+ external tool integrations created

### Qualitative Metrics

**User Experience:**
- ✅ Summaries feel timely (not delayed)
- ✅ Suggestions are relevant (not noise)
- ✅ Focus modes improve quality
- ✅ AI questions are helpful (not annoying)
- ✅ "Ask AI" gets regular use

**Developer Experience:**
- ✅ External integration takes <1 hour
- ✅ API is intuitive and well-documented
- ✅ Examples work out-of-the-box
- ✅ Debugging is straightforward

**Code Quality:**
- ✅ All TypeScript strict mode
- ✅ Comprehensive tests
- ✅ Clear documentation
- ✅ Maintainable architecture

---

## Risk Mitigation

### Risk 1: AI Question Fatigue
**Risk:** Users get annoyed by too many questions
**Likelihood:** Medium
**Impact:** High

**Mitigation:**
- AI decides when to ask (confidence-based)
- Track question frequency
- Monitor dismissal rate
- Adjust thresholds based on data
- Add user setting in v2 (proactiveness level)

### Risk 2: Token Costs
**Risk:** Query-based system costs more than expected
**Likelihood:** Low
**Impact:** Medium

**Mitigation:**
- Cache query results (1-hour TTL)
- Monitor token usage per query
- Optimize prompts for brevity
- Use structured queries when possible (no AI)
- Budget alerts if costs spike

### Risk 3: Performance Degradation
**Risk:** Long sessions (100+ screenshots) slow down
**Likelihood:** Medium
**Impact:** Medium

**Mitigation:**
- In-memory indexes for filtering
- Lazy loading for query results
- Profile regularly (lighthouse, React DevTools)
- Set hard limits (max 200 screenshots per query)

### Risk 4: External API Breaking Changes
**Risk:** Tauri IPC API changes break external tools
**Likelihood:** Low
**Impact:** High

**Mitigation:**
- Version API endpoints (v1, v2)
- Backward compatibility guarantee
- Deprecation notices (6-month window)
- External tool registry for contact

### Risk 5: AI Hallucinations
**Risk:** Natural language queries return wrong answers
**Likelihood:** Medium
**Impact:** High

**Mitigation:**
- Show confidence scores with answers
- Cite sources (which screenshots used)
- Allow user to report incorrect answers
- Fallback to structured queries if confidence low
- Monitor accuracy with test queries

---

## Deployment Plan

### Pre-Launch (Week 6)

**Code Review:**
- [ ] All PRs reviewed by 2+ developers
- [ ] Security audit (no API key leaks)
- [ ] Performance profiling complete
- [ ] Accessibility audit (WCAG AA)

**Testing:**
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Performance benchmarks met
- [ ] Manual testing checklist complete

**Documentation:**
- [ ] API docs published
- [ ] User guide updated
- [ ] External tool examples tested
- [ ] Changelog written

### Launch (Week 7)

**Deployment Steps:**
1. Merge feature branch to main
2. Tag release (v2.0.0)
3. Build production binaries
4. Deploy to production
5. Monitor error logs
6. Gather user feedback

**Monitoring:**
- Watch error logs (first 48 hours)
- Monitor performance metrics
- Track token usage
- Gather user feedback (in-app survey)

### Post-Launch (Week 8)

**Iteration:**
- Fix critical bugs (priority 1)
- Adjust AI thresholds based on data
- Refine prompts based on quality
- Optimize performance hotspots
- Plan v2 features (system overlay)

---

## Appendix: File Structure

```
src/
├── services/
│   ├── SessionQueryEngine.ts                    (NEW - 400 lines)
│   ├── LiveSessionContextProvider.ts            (NEW - 500 lines)
│   ├── LiveSessionIntelligenceService.ts        (NEW - 600 lines)
│   ├── LiveSessionIntelligenceService.test.ts   (NEW - 300 lines)
│   ├── AIQuestionManager.ts                     (NEW - 300 lines)
│   └── nedTools/
│       └── queryActiveSessionTool.ts             (NEW - 150 lines)
├── components/
│   └── sessions/
│       ├── AIQueryInterface.tsx                  (NEW - 400 lines)
│       ├── AIQueryInterface.test.tsx             (NEW - 200 lines)
│       ├── InteractivePrompt.tsx                 (NEW - 250 lines)
│       ├── InteractivePrompt.test.tsx            (NEW - 150 lines)
│       ├── LiveIntelligencePanel.tsx             (NEW - 500 lines)
│       ├── TaskSuggestionCard.tsx                (NEW - 200 lines)
│       ├── NoteSuggestionCard.tsx                (NEW - 200 lines)
│       ├── FocusModeSelector.tsx                 (NEW - 150 lines)
│       ├── CurrentFocusCard.tsx                  (NEW - 150 lines)
│       └── BlockersPanel.tsx                     (NEW - 150 lines)
├── utils/
│   └── eventBus.ts                               (MODIFIED - add events)
└── types.ts                                      (MODIFIED - add SessionSummary fields)

src-tauri/src/
└── session_query_api.rs                          (NEW - 300 lines)

docs/
├── api/
│   └── SESSION_QUERY_API.md                      (NEW - comprehensive guide)
└── examples/
    ├── alfred-workflow.js                        (NEW - example)
    ├── vscode-extension.js                       (NEW - example)
    └── obsidian-plugin.js                        (NEW - example)
```

**Total New Code:** ~5,300 lines
**Modified Code:** ~200 lines

---

## Summary

This plan delivers a **universal query platform** for live session intelligence with:

- ✅ Event-driven AI (no arbitrary polling)
- ✅ Proactive suggestions (tasks/notes)
- ✅ Interactive Q&A (AI asks questions)
- ✅ User queries ("Ask AI" feature)
- ✅ External API (Tauri IPC)
- ✅ Ned integration
- ✅ Focus modes
- ✅ Modern UI

**Timeline:** 6-8 weeks with 4 parallel agents
**Effort:** ~160 hours total
**Quality:** Production-ready with comprehensive testing

**Ready to begin implementation.**
