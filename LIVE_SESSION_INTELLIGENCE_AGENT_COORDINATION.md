# Live Session Intelligence - Agent Coordination Guide

**Version:** 1.0
**Date:** 2025-11-02
**Purpose:** Coordinate parallel work across 4 specialized agents

---

## Agent Roles & Responsibilities

### Agent 1: Backend Infrastructure
**Primary Focus:** Query engine, intelligence service, event system
**Expertise:** TypeScript services, Rust/Tauri, Claude API, event-driven architecture

**Phases:**
- Phase 1: Weeks 1-2 (Query Engine Foundation)
- Phase 2: Weeks 2-3 (Live Intelligence Service)

**Key Deliverables:**
- SessionQueryEngine (universal query API)
- LiveSessionContextProvider (data filtering)
- LiveSessionIntelligenceService (AI decision making)
- Tauri commands for external API
- Event emission integration

---

### Agent 2: Interactive AI Components
**Primary Focus:** Q&A system, query interface
**Expertise:** React/TypeScript, Framer Motion, UI/UX, state management

**Phases:**
- Phase 3: Weeks 3-4 (Interactive Q&A)
- Phase 4: Weeks 4-5 (AI Query Interface)

**Key Deliverables:**
- AIQuestionManager service
- InteractivePrompt component
- AIQueryInterface component
- SpaceMenuBar integration

---

### Agent 3: Action-Oriented UI
**Primary Focus:** Summary interface, suggestions, focus modes
**Expertise:** React/TypeScript, component architecture, animations, design system

**Phases:**
- Phase 5: Weeks 5-6 (Action-Oriented UI)

**Key Deliverables:**
- LiveIntelligencePanel component
- SuggestionCard components (task, note)
- FocusModeSelector component
- Dismissal tracking logic
- ActiveSessionView integration

---

### Agent 4: Integration & Quality
**Primary Focus:** Ned integration, external examples, polish, testing
**Expertise:** Full-stack TypeScript, technical writing, performance, QA

**Phases:**
- Phase 6: Weeks 6-8 (External Integration + Polish)
- Continuous: Quality assurance across all phases

**Key Deliverables:**
- Ned query tool integration
- External tool examples (Alfred, VS Code, Obsidian)
- API documentation
- Performance optimization
- Final testing & bug fixes

---

## Communication Protocol

### Daily Standup (Async)

**Format:** Post in shared document or chat channel

**Template:**
```
Agent [X]: [Date]

✅ Completed Yesterday:
- Task P1-T01: Created SessionQueryEngine core class
- Task P1-T02: Started LiveSessionContextProvider

🔄 Working Today:
- Task P1-T02: Complete LiveSessionContextProvider
- Task P1-T03: Start structured query handler

⚠️ Blockers:
- Waiting on EventBus event type definitions (Agent 1)
- Need clarification on focus mode filtering logic

📋 Questions:
- Should focus mode filtering be case-sensitive?
```

---

### Dependency Handoffs

**When Your Task is a Dependency for Another Agent:**

1. **Complete the task** according to acceptance criteria
2. **Run all tests** (must be passing)
3. **Commit and push** to feature branch
4. **Notify dependent agent** with details:
   ```
   @Agent[Y] - P1-T02 Complete

   Files Ready:
   - src/services/LiveSessionContextProvider.ts
   - src/services/LiveSessionContextProvider.test.ts

   How to Use:
   const provider = new LiveSessionContextProvider(session);
   const results = provider.searchScreenshots({ activity: 'coding' });

   Tests: All passing (85% coverage)
   Docs: JSDoc complete

   Next Steps:
   You can now start P2-T01 which depends on this.
   ```

5. **Review PR** if requested by dependent agent

---

### Merge Conflicts

**Prevention:**
- Work on separate files when possible
- Coordinate changes to shared files (e.g., types.ts, eventBus.ts)
- Pull from main daily
- Use feature branches

**Resolution Protocol:**
1. **Identify conflict** - Who modified what?
2. **Communicate** - Discuss intent with other agent
3. **Resolve together** - Pair review the merge
4. **Test after merge** - Ensure no functionality broken

---

## Parallel Work Strategy

### Weeks 1-2: Foundation (Agent 1 Solo)

```
Agent 1: Query Engine + Context Provider + Tauri Commands
- P1-T01 through P1-T06 (sequential)
- Critical path - blocks all other work
```

**Other Agents:**
- Agent 2: Review design docs, prepare component skeletons
- Agent 3: Review design docs, prepare UI mockups
- Agent 4: Set up testing infrastructure, prepare API doc templates

---

### Weeks 2-3: Intelligence + Q&A Prep (Agent 1 + Agent 2)

```
Agent 1: Live Intelligence Service
- P2-T01 through P2-T07 (sequential)

Agent 2: Q&A Service (can start early)
- P3-T01: AIQuestionManager (parallel with Agent 1)
```

**Coordination Points:**
- Agent 2 needs P2-T05 (EventBus events) from Agent 1 before P3-T02
- Agent 1 provides event types, Agent 2 builds Q&A around them

---

### Weeks 3-4: Q&A + Query UI (Agent 2 Solo)

```
Agent 2: Interactive Q&A + AI Query Interface
- P3-T01 through P3-T06 (Q&A)
- P4-T01 through P4-T06 (Query UI)
```

**Other Agents:**
- Agent 1: Code review, optimization
- Agent 3: Start component planning
- Agent 4: Write API documentation drafts

---

### Weeks 5-6: Action UI + Integration (Agent 3 + Agent 4)

```
Agent 3: Action-Oriented UI
- P5-T01 through P5-T11 (mostly parallel)

Agent 4: External Integration
- P6-T01 through P6-T04 (parallel with Agent 3)
```

**Coordination Points:**
- Agent 3 focuses on UI components
- Agent 4 integrates external tools and writes docs
- Both coordinate on final ActiveSessionView integration

---

### Weeks 6-8: Polish + Launch (All Agents)

```
Agent 1: Performance optimization, bug fixes
Agent 2: Animation polish, accessibility
Agent 3: UI refinement, responsive design
Agent 4: Final testing, documentation, deployment prep
```

**Final Sprint:**
- Daily sync meetings
- Shared bug board
- Code freeze 1 week before launch
- Final testing sprint
- Launch preparation

---

## File Ownership

### Shared Files (Require Coordination)

**High-Traffic Files:**
- `src/types.ts` - Type definitions
- `src/utils/eventBus.ts` - Event system
- `src/components/ActiveSessionView.tsx` - Main integration point

**Coordination Protocol for Shared Files:**
1. **Announce intent** before modifying
2. **Use feature flags** for incomplete changes
3. **Small, focused changes** (single responsibility)
4. **Immediate testing** after changes
5. **Quick PR review** (within 4 hours)

---

### Exclusive Ownership (No Coordination Needed)

**Agent 1:**
- `src/services/SessionQueryEngine.ts`
- `src/services/LiveSessionContextProvider.ts`
- `src/services/LiveSessionIntelligenceService.ts`
- `src-tauri/src/session_query_api.rs`

**Agent 2:**
- `src/services/AIQuestionManager.ts`
- `src/components/sessions/InteractivePrompt.tsx`
- `src/components/sessions/AIQueryInterface.tsx`

**Agent 3:**
- `src/components/sessions/LiveIntelligencePanel.tsx`
- `src/components/sessions/TaskSuggestionCard.tsx`
- `src/components/sessions/NoteSuggestionCard.tsx`
- `src/components/sessions/FocusModeSelector.tsx`

**Agent 4:**
- `docs/api/*`
- `docs/examples/*`
- `src/services/nedTools/queryActiveSessionTool.ts`

---

## Code Review Protocol

### When to Request Review

**Mandatory Reviews:**
- [ ] Any change to shared files (types.ts, eventBus.ts, ActiveSessionView.tsx)
- [ ] New public APIs (SessionQueryEngine, AIQuestionManager, etc.)
- [ ] Major architectural decisions
- [ ] Performance-critical code
- [ ] Before merging to main

**Optional Reviews:**
- Internal implementation details
- Test files (but encouraged to share)
- Documentation changes (but get feedback)

---

### Review Assignments

**Agent 1 Reviews:**
- Backend services (Agent 2, 3, 4)
- Tauri integration (Agent 4)
- Event system changes (All agents)

**Agent 2 Reviews:**
- React components (Agent 3)
- UI/UX decisions (Agent 3)
- Animations (Agent 3)

**Agent 3 Reviews:**
- UI components (Agent 2)
- Design system usage (Agent 2, 4)

**Agent 4 Reviews:**
- Everything (final QA)
- Documentation (All agents)
- External integrations (Agent 1)

---

### Review Checklist

**For Reviewer:**
- [ ] Code follows quality checklist
- [ ] Tests passing
- [ ] TypeScript strict mode (no errors)
- [ ] Documentation updated
- [ ] No obvious performance issues
- [ ] Accessibility considered (if UI)
- [ ] Backwards compatible (if API change)

**Review Response Time:**
- High Priority (blocking): 2 hours
- Medium Priority: 4 hours
- Low Priority: 1 day

---

## Testing Strategy

### Unit Testing Responsibility

**Each Agent Tests Their Own Code:**
- Agent 1: All backend services (80%+ coverage)
- Agent 2: Interactive components (80%+ coverage)
- Agent 3: UI components (70%+ coverage)
- Agent 4: Integration tests (100% critical paths)

---

### Integration Testing Coordination

**Cross-Agent Integration Tests:**

**Test 1: Full Query Flow (Agent 1 + Agent 2)**
- Agent 2 creates UI interaction test
- Agent 1 ensures query engine responds correctly
- Both verify end-to-end flow

**Test 2: Event-Driven Update (Agent 1 + Agent 3)**
- Agent 1 emits events
- Agent 3 verifies UI updates
- Both test full flow

**Test 3: External Tool Integration (Agent 1 + Agent 4)**
- Agent 1 provides API
- Agent 4 tests external tool examples
- Both verify Tauri IPC works

---

## Risk Management

### Identified Risks & Owners

**Risk 1: Query API Performance**
- Owner: Agent 1
- Mitigation: Profile early, optimize before Phase 2
- Monitor: <200ms structured, <3s natural language

**Risk 2: Animation Performance**
- Owner: Agent 2, Agent 3
- Mitigation: GPU-accelerated transforms, 60fps monitoring
- Monitor: React DevTools profiler, no janky animations

**Risk 3: Integration Complexity**
- Owner: Agent 4
- Mitigation: Early integration testing, clear interfaces
- Monitor: Integration test suite passing

**Risk 4: Scope Creep**
- Owner: All agents
- Mitigation: Stick to task list, defer nice-to-haves
- Monitor: Weekly scope review

---

## Decision Log

**When a major decision is made, log it:**

```
Decision #: [Number]
Date: [Date]
Made By: Agent [X]
Impacted Agents: [List]

Decision: What was decided

Reasoning: Why this decision was made

Alternatives Considered:
1. Alternative A - Rejected because...
2. Alternative B - Rejected because...

Impact:
- Agent 1: Will need to refactor X
- Agent 2: No impact
- Agent 3: Can now proceed with Y
```

**Example:**
```
Decision #1
Date: 2025-11-02
Made By: Agent 1
Impacted Agents: All

Decision: Use Tauri IPC for external API (not HTTP server)

Reasoning:
- More secure (OS-level permissions)
- No need for API keys/auth
- Works localhost without CORS
- Can add HTTP later if needed

Alternatives Considered:
1. HTTP REST API - Rejected: Security complexity, CORS issues
2. GraphQL - Rejected: Overkill for our use case

Impact:
- Agent 1: Will implement Tauri commands
- Agent 4: Will write Tauri IPC examples (not HTTP examples)
```

---

## Progress Tracking

### Weekly Progress Report

**Format:** Posted every Friday

```
Week [X] Progress Report

Agent 1 (Backend Infrastructure):
Completed:
- P1-T01: SessionQueryEngine core (✓)
- P1-T02: LiveSessionContextProvider (✓)

In Progress:
- P1-T03: Structured query handler (75%)

Blocked:
- None

Next Week:
- Complete P1-T03, P1-T04
- Start Phase 2

Agent 2 (Interactive AI):
...

Agent 3 (Action-Oriented UI):
...

Agent 4 (Integration & Quality):
...

Overall Status: [On Track | At Risk | Behind]
```

---

### Milestone Celebrations

**Phase Completion:**
When a phase completes, celebrate! 🎉

- Phase 1: Query engine works - External tools can query!
- Phase 2: AI makes decisions - No more fixed polling!
- Phase 3: AI asks questions - Interactive refinement!
- Phase 4: User queries work - "Ask AI" feature live!
- Phase 5: Modern UI complete - Suggestions are beautiful!
- Phase 6: Launch ready - Ship it! 🚀

---

## Summary

**Effective Coordination Requires:**
- ✅ Clear role separation
- ✅ Daily async standup
- ✅ Dependency handoff protocol
- ✅ Shared file coordination
- ✅ Timely code reviews
- ✅ Cross-agent integration testing
- ✅ Risk ownership
- ✅ Decision logging
- ✅ Weekly progress tracking

**Follow this guide to ensure smooth parallel development across all 4 agents.**
