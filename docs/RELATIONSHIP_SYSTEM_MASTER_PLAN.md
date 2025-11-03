# Taskerino Relationship System Rebuild - Master Plan

**Project:** Unified Relationship Management System
**Version:** 1.0
**Date:** 2025-10-24
**Status:** Ready for Implementation
**Estimated Duration:** 5 weeks (25 agent-days + validation)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Architectural Principles](#architectural-principles)
4. [Implementation Phases](#implementation-phases)
5. [Agent Task Breakdown](#agent-task-breakdown)
6. [Quality Gates & Validation](#quality-gates--validation)
7. [Progress Tracking](#progress-tracking)
8. [Risk Management](#risk-management)
9. [Success Criteria](#success-criteria)
10. [Orchestrator Responsibilities](#orchestrator-responsibilities)

---

## Executive Summary

### Project Goals

Complete rebuild of the task/note/session relationship system with:

1. **Automatic Bidirectional Sync** - All relationships maintained consistently across both entities
2. **Manual Management UI** - Inline pills + modal for user control
3. **Backward-Compatible Migration** - Preserve all existing relationships during upgrade
4. **Improved AI Associations** - Enhanced deduplication and confidence scoring
5. **Atomic Transactions** - Prevent data corruption through ACID guarantees
6. **Scalable Architecture** - Plugin system for future entity types

### Key Decisions

Based on stakeholder input:

- **Priority:** Full rebuild (not incremental improvements)
- **Compatibility:** Critical - must preserve all existing data
- **UI Pattern:** Inline pills + modal (not dedicated panel)
- **Sync Strategy:** Automatic bidirectional (not query-based)

### Expected Outcomes

**For Users:**
- Clear visibility of all relationships in task/note/session views
- Easy manual add/remove of associations
- Better AI suggestions with fewer duplicates
- No data loss or corruption

**For Developers:**
- Clean, maintainable architecture
- Easy to add new entity types
- Well-tested, documented codebase
- Reduced technical debt

---

## Current State Analysis

### Existing Problems

**Data Model Issues:**
1. **Inconsistent Relationships**
   - Task has both `noteId` and `sourceNoteId` (unclear which is authoritative)
   - Note has both `topicId` (legacy) and `topicIds[]` (new) - migration incomplete
   - Session has `extractedTaskIds[]` but Task.sourceSessionId can diverge

2. **No Bidirectional Consistency**
   - Task → Note link exists, but no reverse index
   - Requires O(n) scan to find "all tasks from this note"
   - Orphaned references when entities deleted

3. **Non-Atomic Updates**
   - Adding task to session updates two entities separately
   - If second update fails → data corruption
   - No transaction support across entities

4. **Manual Count Synchronization**
   - Topic.noteCount manually updated, prone to errors
   - Can get out of sync if note reassigned

**UI Issues:**
1. **Limited Relationship Display**
   - Tasks show AI context only for AI-created tasks
   - No way to see session that created a task
   - No manual association UI in task modals

2. **No Manual Control**
   - Notes have relationship manager for companies/contacts/topics
   - Tasks have NO manual relationship management
   - Sessions show extracted items but can't manually link

3. **Dated UI Patterns**
   - "Linked Tasks" section in notes is basic list
   - No rich metadata display (confidence, reasoning)
   - No visual indicators in list views

**AI Association Issues:**
1. **Weak Deduplication**
   - AI sometimes suggests tasks that already exist
   - No similarity scoring, just exact match
   - Creates duplicate tasks unnecessarily

2. **No Confidence Tracking**
   - AI reasoning stored but not used
   - No way to filter by confidence level
   - Can't identify weak associations

### What Works Well

1. **Rich Session Data** - Comprehensive screenshot/audio/video pipeline
2. **AI Extraction Quality** - Task/note extraction from sessions is high quality
3. **Storage Layer** - IndexedDB/Tauri FS abstraction works well
4. **Note Entity Relationships** - Company/contact/topic management is solid pattern to replicate

### Technical Debt to Address

1. Complete migration from legacy fields (`topicId`, `noteId` ambiguity)
2. Remove manual count synchronization logic
3. Add transaction support for multi-entity updates
4. Create relationship index for O(1) lookups
5. Consolidate AI association logic (scattered across multiple services)

---

## Architectural Principles

### 1. Design Philosophy

**Core Principle: Extensible Relationship Graph**

All entities (Tasks, Notes, Sessions, Companies, Contacts, Topics, and future types) are nodes in a directed graph. Relationships are edges with rich metadata.

```
[Task] --[created_from]--> [Note]
       <--[extracted]------

[Task] --[from_session]--> [Session]
       <--[created]--------

[Note] --[about]--> [Company]
```

**Benefits:**
- Adding new entity type = register node type, no core changes
- Adding new relationship type = add configuration, no code changes
- Querying relationships = graph traversal, not scans
- Metadata attached to edges, not nodes

### 2. Architectural Patterns

#### Pattern 1: Repository Pattern

```
UI Components
    ↓
Service Layer (Business Logic)
    ↓
Repository Layer (Data Access)
    ↓
Storage Layer (IndexedDB/Tauri FS)
```

**Separation of Concerns:**
- UI: Presentation, user interaction
- Services: Business rules, validation, orchestration
- Repositories: CRUD operations, queries, transactions
- Storage: Persistence, indexing, caching

**Benefits:**
- Testable in isolation
- Swappable storage backends
- Clear dependency flow
- Easy to mock for testing

#### Pattern 2: Event-Driven Updates

```
Action → Event Bus → Listeners → UI Updates
                  → Audit Log
                  → Analytics
                  → Sync Engine
```

**Events:**
- `RELATIONSHIP_ADDED`
- `RELATIONSHIP_REMOVED`
- `RELATIONSHIP_UPDATED`
- `ENTITY_DELETED` (trigger cascade)

**Benefits:**
- Decoupled components
- Easy to add new behaviors
- Audit trail built-in
- Cross-window sync via events

#### Pattern 3: Strategy Pattern for Relationship Types

```
RelationshipManager
    ↓
RelationshipStrategy (interface)
    ↓
├── TaskNoteStrategy
├── TaskSessionStrategy
├── NoteSessionStrategy
└── (future strategies)
```

**Each Strategy Defines:**
- Validation rules
- Cascade delete behavior
- Metadata requirements
- Bidirectional sync rules

**Benefits:**
- Easy to add new relationship types
- Encapsulates type-specific logic
- Testable in isolation
- Configuration-driven

### 3. Scalability Considerations

#### Performance Requirements

| Operation | Target | Strategy |
|-----------|--------|----------|
| Relationship lookup | <5ms | Indexed Map<entityId, Relationship[]> |
| Add relationship | <10ms | Single transaction, optimized path |
| Remove relationship | <10ms | Single transaction, cascade optional |
| Bulk operations | <100ms for 100 items | Batch API, single transaction |
| Modal search | <100ms for 10k items | Indexed search, fuzzy matching |
| Sidebar open | <100ms with 50 rels | Lazy load, virtual scrolling |

#### Storage Scalability

| Dataset Size | Expected Performance | Strategy |
|--------------|---------------------|----------|
| 1k entities | Instant (<10ms) | In-memory cache |
| 10k entities | Fast (<50ms) | Partial cache, indexed |
| 100k entities | Good (<200ms) | Query optimization, pagination |
| 1M+ entities | Acceptable (<1s) | Consider server-side sync |

#### Extensibility Points

**1. New Entity Types**
```typescript
// Register new entity type
RelationshipManager.registerEntityType({
  type: 'project',
  displayName: 'Project',
  color: '#FF6B6B',
  icon: FolderIcon,
  getLabel: (entity) => entity.name,
  canRelateWith: ['task', 'note', 'session'],
});
```

**2. New Relationship Types**
```typescript
// Define new relationship
RelationshipManager.registerRelationType({
  type: 'blocks',
  sourceTypes: ['task'],
  targetTypes: ['task'],
  bidirectional: true,
  metadata: { required: ['reason'] },
  cascadeDelete: false,
});
```

**3. Custom Strategies**
```typescript
// Implement custom sync strategy
class CustomStrategy extends RelationshipStrategy {
  async onAdd(source, target, metadata) {
    // Custom logic
  }
}
```

### 4. Future-Proofing

**Planned Extensions (Next 6-12 months):**

1. **File Entities** - Link files to tasks/notes/sessions
2. **Event Entities** - Calendar events linked to tasks
3. **Goal Entities** - High-level goals composed of tasks
4. **Tag Entities** - First-class tags with relationships
5. **Workspace Entities** - Projects/workspaces containing items
6. **Template Entities** - Reusable task/note templates

**Technical Roadmap:**

| Quarter | Capability | Architecture Support |
|---------|-----------|---------------------|
| Q1 2025 | Unified relationships | ✓ This project |
| Q2 2025 | Real-time sync | Event bus ready |
| Q3 2025 | Server-side storage | Storage adapter pattern |
| Q4 2025 | Team collaboration | Multi-user relationship metadata |

---

## Implementation Phases

### Phase 0: Documentation & Setup (Week 0 - Prep)

**Deliverables:**
- Complete documentation structure created
- Agent task specifications written
- Progress tracking dashboard set up
- Development environment validated

**Tasks:**
- Create all `docs/agent-tasks/*.md` files
- Set up validation reporting structure
- Create progress dashboard template
- Verify tooling and test infrastructure

### Phase 1: Foundation (Week 1)

**Goal:** Establish core type system, storage layer, and migration infrastructure.

**Tasks:**
- F1: Type System - Define all relationship types and interfaces
- F2: Storage Layer - Implement transactions and indexing
- F3: Migration Service - Build backward-compatible migration

**Deliverables:**
- `src/types/relationships.ts` - Complete type system
- `src/services/storage/relationshipIndex.ts` - O(1) lookup index
- `src/services/relationshipMigration.ts` - Migration with rollback

**Success Criteria:**
- All types compile without errors
- Transaction tests pass (100+ scenarios)
- Migration preserves 100% of relationships on test data

### Phase 2: Core Services (Week 2)

**Goal:** Build RelationshipManager and refactor AI association logic.

**Tasks:**
- S1: Relationship Manager - Core CRUD with bidirectional sync
- S2: AI Association Improvements - Enhanced deduplication

**Deliverables:**
- `src/services/relationshipManager.ts` - Complete service
- `src/services/relationshipStrategies/` - Strategy implementations
- Updated AI services using RelationshipManager

**Success Criteria:**
- All relationship operations atomic
- Bidirectional consistency maintained automatically
- AI duplicate detection improved >80%

### Phase 3: State Management (Week 3 Part 1)

**Goal:** Create React contexts integrating relationship system.

**Tasks:**
- C1: Relationship Context - New context for relationship state
- C2: Context Integration - Update existing contexts

**Deliverables:**
- `src/context/RelationshipContext.tsx` - New context
- Updated TasksContext, NotesContext, SessionsContext
- Hooks: `useRelationships()`, `useRelatedItems()`

**Success Criteria:**
- Optimistic updates work correctly
- Cross-window sync functional
- No performance regressions

### Phase 4: UI Components (Week 3 Part 2 - Week 4)

**Goal:** Build relationship management UI components.

**Tasks:**
- U1: Relationship Pills - Display component
- U2: Relationship Modal - Selection and management
- U3: UI Integration - Integrate into existing views

**Deliverables:**
- `src/components/relationships/RelationshipPills.tsx`
- `src/components/relationships/RelationshipModal.tsx`
- Updated TaskDetailSidebar, NoteDetailSidebar, SessionDetailView

**Success Criteria:**
- Manual add/remove works smoothly
- UI accessible (WCAG 2.1 AA)
- Mobile-friendly
- No visual regressions

### Phase 5: Testing & Validation (Week 5)

**Goal:** Comprehensive testing and quality assurance.

**Tasks:**
- V1: End-to-End Testing - Complete user workflows
- V2: Code Quality Review - Documentation and quality metrics

**Deliverables:**
- Complete E2E test suite
- Quality metrics report
- Final documentation update
- Migration validation on real user data

**Success Criteria:**
- >80% test coverage
- All performance benchmarks met
- Zero high-severity issues
- Complete documentation

---

## Agent Task Breakdown

### Task Dependency Graph

```
        ┌─────┐
        │ F1  │ Type System
        └──┬──┘
           │
     ┌─────┴─────┐
     ↓           ↓
  ┌─────┐     ┌─────┐
  │ F2  │     │ F3  │
  └──┬──┘     └──┬──┘
     │           │
     └─────┬─────┘
           ↓
        ┌─────┐
        │ S1  │ Relationship Manager
        └──┬──┘
           │
     ┌─────┴─────┐
     ↓           ↓
  ┌─────┐     ┌─────┐
  │ S2  │     │ C1  │
  └─────┘     └──┬──┘
                 ↓
              ┌─────┐
              │ C2  │
              └──┬──┘
                 │
        ┌────────┴────────┐
        ↓                 ↓
     ┌─────┐           ┌─────┐
     │ U1  │           │ U2  │
     └──┬──┘           └──┬──┘
        └────────┬────────┘
                 ↓
              ┌─────┐
              │ U3  │
              └──┬──┘
                 │
        ┌────────┴────────┐
        ↓                 ↓
     ┌─────┐           ┌─────┐
     │ V1  │           │ V2  │
     └─────┘           └─────┘
```

### Task Summary Table

| ID | Task Name | Dependencies | Complexity | Est. Hours | Can Parallelize |
|----|-----------|--------------|------------|------------|-----------------|
| F1 | Type System | None | Medium | 3-4 | No (foundation) |
| F2 | Storage Layer | F1 | High | 6-8 | No (foundation) |
| F3 | Migration Service | F1, F2 | High | 8-10 | No (foundation) |
| S1 | Relationship Manager | F1, F2, F3 | High | 10-12 | No (core service) |
| S2 | AI Associations | S1 | Medium-High | 8-10 | With C1 |
| C1 | Relationship Context | S1 | Medium | 6-8 | With S2 |
| C2 | Context Integration | C1 | Medium | 6-8 | No (touches all contexts) |
| U1 | Relationship Pills | C2 | Medium | 6-8 | With U2 |
| U2 | Relationship Modal | C2 | High | 10-12 | With U1 |
| U3 | UI Integration | U1, U2 | Medium | 6-8 | No (integration) |
| V1 | E2E Testing | All above | High | 12-15 | With V2 |
| V2 | Quality Review | All above | High | 10-12 | With V1 |

**Total Estimated Hours:** 93-118 hours (12-15 agent-days of work + validation cycles)

### Detailed Task Specifications

All task specifications are in `docs/agent-tasks/` with format:

```
docs/agent-tasks/
├── F1-type-system.md
├── F2-storage-layer.md
├── F3-migration-service.md
├── S1-relationship-manager.md
├── S2-ai-associations.md
├── C1-relationship-context.md
├── C2-context-integration.md
├── U1-relationship-pills.md
├── U2-relationship-modal.md
├── U3-ui-integration.md
├── V1-e2e-testing.md
└── V2-quality-review.md
```

Each task specification includes:
- Objective
- Detailed requirements
- Deliverables (specific files)
- Acceptance criteria (checklist)
- Testing requirements
- Complexity estimate

**See Section: [Detailed Agent Tasks](#detailed-agent-tasks) for full specifications**

---

## Quality Gates & Validation

### Quality Gate Process

```
Implementation → Gate 1: Self-Validation
                    ↓
                Gate 2: Code Validation (Separate Agent)
                    ↓
                Gate 3: Integration Validation
                    ↓
                Gate 4: Final Review (Orchestrator)
                    ↓
                APPROVED
```

#### Gate 1: Task Completion (Agent Self-Validation)

**Checklist:**
- [ ] Implementation complete
- [ ] All tests written and passing locally
- [ ] Acceptance criteria reviewed and met
- [ ] Code documented (JSDoc comments)
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Task marked complete with report

**Agent delivers:**
- Task completion report
- List of files created/modified
- Test results
- Notes on implementation decisions

#### Gate 2: Code Validation (Validation Agent)

**Validation agent reviews:**
1. Code quality (readability, maintainability)
2. Test coverage (>80% target)
3. Acceptance criteria (all items checked)
4. Documentation completeness
5. Edge cases and error handling
6. Performance considerations

**Validation report includes:**
- Status: PASS / FAIL / REVISE
- Test results details
- Acceptance criteria checklist
- Issues found (categorized by severity)
- Recommendations for improvement

**If FAIL/REVISE:**
- Detailed feedback provided to implementation agent
- Agent addresses issues
- Re-validation requested

#### Gate 3: Integration Validation

**After each phase completes:**

Integration validation agent tests:
1. Components work together correctly
2. No regressions in existing functionality
3. Performance benchmarks met
4. Data migration still works
5. No memory leaks

**Integration report includes:**
- Integration test results
- Performance benchmark results
- Regression test results
- Issues found and severity

#### Gate 4: Final Review (Orchestrator)

**Before marking project complete:**

Orchestrator validates:
1. All tasks completed and validated
2. E2E test suite passes
3. All documentation complete and accurate
4. All acceptance criteria met across all tasks
5. No open high-severity issues
6. Performance benchmarks met
7. Migration validated on real data

**Final review deliverables:**
- Project completion report
- Quality metrics summary
- Known limitations documented
- Recommendations for future work

### Validation Agent Prompt Template

```markdown
TASK: Validate implementation of [TASK_ID: Task Name]

SPECIFICATION: Read docs/agent-tasks/[TASK_ID].md

VALIDATION STEPS:
1. Review all deliverable files listed in specification
2. Run test suite: npm test (or appropriate command)
3. Verify each acceptance criterion is met
4. Check code quality:
   - TypeScript strict mode compliance
   - ESLint clean (zero errors)
   - Code complexity <15 (cyclomatic)
   - Clear naming and structure
   - Adequate error handling
5. Review documentation completeness
6. Check for edge cases
7. Verify performance targets met (if applicable)

OUTPUT: Create validation report in docs/validation/[TASK_ID]-validation.md

REPORT STRUCTURE:
# Validation Report: [TASK_ID]

## Status
- [ ] PASS
- [ ] FAIL
- [ ] REVISE (minor issues)

## Test Results
- Unit tests: X/Y passed
- Integration tests: X/Y passed
- Coverage: X%

## Acceptance Criteria
- [ ] Criterion 1: [Met/Not Met - details]
- [ ] Criterion 2: [Met/Not Met - details]
...

## Code Quality Review
- TypeScript: [Pass/Fail - details]
- ESLint: [Pass/Fail - details]
- Complexity: [Pass/Fail - details]
- Documentation: [Complete/Incomplete - details]

## Issues Found
### High Severity
- Issue 1: [description, file:line]

### Medium Severity
- Issue 1: [description, file:line]

### Low Severity / Suggestions
- Suggestion 1: [description]

## Performance (if applicable)
- Benchmark 1: [result vs target]
- Benchmark 2: [result vs target]

## Recommendation
[Approve / Request Revisions / Reject]

If revisions requested, provide specific feedback for implementation agent.
```

### Quality Metrics Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test Coverage | >80% overall, >90% core | nyc/istanbul |
| TypeScript Coverage | 100% | TypeScript compiler |
| Code Complexity | <15 per function | ESLint complexity rule |
| Code Duplication | <5% | jscpd |
| Documentation Coverage | 100% public APIs | TypeDoc |
| Accessibility | WCAG 2.1 AA | axe-core |
| Performance | See benchmarks | Custom tests |
| Bundle Size Impact | <50KB gzipped | webpack-bundle-analyzer |

### Performance Benchmarks

| Operation | Target | Test Method |
|-----------|--------|-------------|
| Relationship lookup | <5ms | Benchmark with 10k entities |
| Add relationship | <10ms | Benchmark with transaction |
| Remove relationship | <10ms | Benchmark with cascade |
| Bulk add (100 items) | <100ms | Batch operation test |
| Modal search (10k items) | <100ms | Search performance test |
| Sidebar open (50 rels) | <100ms | Component render test |
| Migration (10k entities) | <30s | Migration benchmark |

---

## Progress Tracking

### Progress Dashboard Location

**Primary:** `docs/progress/dashboard.md`

**Updated:** After each task completion and validation

### Dashboard Structure

```markdown
# Relationship System Rebuild - Progress Dashboard

**Last Updated:** [Date & Time]
**Overall Progress:** X% Complete
**Current Phase:** [Phase Name]
**Next Milestone:** [Description]

## Phase Progress

### Phase 1: Foundation (F1-F3)
**Status:** [Not Started / In Progress / Complete]
**Progress:** X/3 tasks complete

- [✓] F1: Type System - COMPLETE (validated)
- [⏳] F2: Storage Layer - IN_PROGRESS (agent assigned)
- [⬜] F3: Migration Service - NOT_STARTED

### Phase 2: Core Services (S1-S2)
**Status:** [Not Started / In Progress / Complete]
**Progress:** X/2 tasks complete

- [⬜] S1: Relationship Manager - NOT_STARTED
- [⬜] S2: AI Associations - NOT_STARTED

[... other phases ...]

## Current Activity

**Active Task:** F2 - Storage Layer
**Agent:** general-purpose-1
**Started:** 2025-10-24 10:00 AM
**Status:** Implementation in progress
**Next:** Validation by separate agent

## Recently Completed

1. F1: Type System - Completed 2025-10-24, Validated ✓
2. [previous task]

## Upcoming (Next 3 Tasks)

1. F3: Migration Service - Depends on F2 completion
2. S1: Relationship Manager - Depends on F1-F3
3. S2: AI Associations - Can parallel with C1 after S1

## Blockers

[None / List current blockers]

## Risks & Issues

### Active Risks
- Risk 1: [description, mitigation status]

### Open Issues
- Issue 1: [description, severity, assigned to]

## Quality Metrics

- Tasks completed: X/12
- Tasks validated: X/12
- Test coverage: X% (target: >80%)
- Open issues: X high, X medium, X low

## Timeline

- **Week 1:** Foundation phase (on track / behind / ahead)
- **Week 2:** Core services
- **Week 3:** State & UI (part 1)
- **Week 4:** UI completion
- **Week 5:** Testing & validation

**Estimated Completion:** [Date]
```

### Todo System Integration

Using TodoWrite tool to track:

```json
{
  "todos": [
    {
      "content": "Complete F1: Type System implementation",
      "activeForm": "Completing F1: Type System implementation",
      "status": "completed"
    },
    {
      "content": "Validate F1: Type System",
      "activeForm": "Validating F1: Type System",
      "status": "completed"
    },
    {
      "content": "Complete F2: Storage Layer implementation",
      "activeForm": "Completing F2: Storage Layer implementation",
      "status": "in_progress"
    },
    {
      "content": "Validate F2: Storage Layer",
      "activeForm": "Validating F2: Storage Layer",
      "status": "pending"
    }
  ]
}
```

**Todo Management Rules:**
1. Create todo when assigning task to agent
2. Update to in_progress when agent starts
3. Create validation todo when implementation complete
4. Mark both complete after validation passes
5. Keep only current phase + next 3 tasks in active todos

### Weekly Reports

**Location:** `docs/progress/weekly-reports/YYYY-MM-DD.md`

**Template:**
```markdown
# Weekly Progress Report - Week of [Date]

## Summary
- Tasks completed: X
- Tasks in progress: X
- Blockers: X
- On schedule: Yes/No

## Completed This Week
1. [Task ID]: [Task Name]
   - Completed: [Date]
   - Validated: [Date]
   - Notes: [Any notable points]

## In Progress
1. [Task ID]: [Task Name]
   - Started: [Date]
   - Status: [Details]
   - ETA: [Date]

## Blockers & Issues
[List any blockers with mitigation plans]

## Next Week Plan
1. [Task ID]: [Task Name] - [Estimated completion]
2. [Task ID]: [Task Name] - [Estimated completion]

## Metrics
- Test coverage: X%
- Open issues: X (high: X, medium: X, low: X)
- Performance benchmarks: [Status]

## Notes
[Any important observations or decisions]
```

### Decision Log

**Location:** `docs/progress/decisions.md`

**Purpose:** Record architectural decisions and rationale

**Format:**
```markdown
## Decision [Number]: [Title]

**Date:** YYYY-MM-DD
**Status:** Accepted / Rejected / Superseded
**Context:** [Why was this decision needed?]

**Decision:** [What did we decide?]

**Rationale:** [Why did we make this decision?]

**Consequences:**
- Positive: [Benefits]
- Negative: [Trade-offs]
- Neutral: [Other impacts]

**Alternatives Considered:**
1. [Alternative 1] - Rejected because [reason]
2. [Alternative 2] - Rejected because [reason]

**Related Decisions:** [Links to related decisions]
```

---

## Risk Management

### Risk Categories

1. **Technical Risks** - Architecture, performance, compatibility
2. **Schedule Risks** - Delays, scope creep, dependency issues
3. **Quality Risks** - Bugs, test coverage, technical debt
4. **Data Risks** - Data loss, corruption, migration failures

### Risk Assessment Matrix

| Likelihood | Impact | Risk Level | Response |
|------------|--------|------------|----------|
| High | Critical | 🔴 RED | Immediate mitigation required |
| High | High | 🟠 ORANGE | Active monitoring & mitigation |
| Medium | High | 🟡 YELLOW | Contingency plan prepared |
| Low | Any | 🟢 GREEN | Accept and monitor |

### Identified Risks

#### Risk R1: Data Loss During Migration
- **Category:** Data Risk
- **Likelihood:** Low
- **Impact:** Critical
- **Risk Level:** 🟠 ORANGE
- **Description:** Migration process could fail and corrupt existing relationship data
- **Mitigation:**
  - Comprehensive backup before migration starts
  - Dry-run mode for validation
  - Rollback mechanism if any errors detected
  - Extensive testing with various data scenarios
  - Progressive rollout (test on sample data first)
- **Contingency:**
  - Manual data recovery procedures documented
  - Backup restoration tested
  - Support contact for user assistance
- **Status:** Mitigation in progress (F3 task includes all safeguards)

#### Risk R2: Performance Degradation
- **Category:** Technical Risk
- **Likelihood:** Medium
- **Impact:** High
- **Risk Level:** 🟡 YELLOW
- **Description:** New relationship system could be slower than current implementation
- **Mitigation:**
  - Performance benchmarks defined upfront
  - Profiling during development
  - Indexed lookups for O(1) access
  - Lazy loading where appropriate
  - Caching strategy for frequently accessed data
- **Contingency:**
  - Optimization pass if benchmarks not met
  - Can defer non-critical features if needed
  - Rollback option if performance unacceptable
- **Status:** Being monitored (benchmarks in place)

#### Risk R3: Scope Creep
- **Category:** Schedule Risk
- **Likelihood:** Medium
- **Impact:** Medium
- **Risk Level:** 🟡 YELLOW
- **Description:** Additional feature requests during implementation could delay completion
- **Mitigation:**
  - Clear task specifications with fixed scope
  - All tasks approved before work starts
  - Change control process for any additions
  - Phase 2 planned for additional features
- **Contingency:**
  - Defer non-critical features to Phase 2
  - Re-estimate timeline if major changes needed
  - Stakeholder approval required for scope changes
- **Status:** Monitored (no changes so far)

#### Risk R4: Integration Issues
- **Category:** Technical Risk
- **Likelihood:** Medium
- **Impact:** High
- **Risk Level:** 🟡 YELLOW
- **Description:** New components may not integrate smoothly with existing code
- **Mitigation:**
  - Integration validation after each phase
  - Comprehensive E2E tests
  - Backward compatibility maintained
  - Incremental integration approach
- **Contingency:**
  - Dedicated debugging agent if issues arise
  - Extended testing phase if needed
  - Rollback option for critical issues
- **Status:** Being monitored (integration validation planned)

#### Risk R5: Agent Task Failures
- **Category:** Schedule Risk
- **Likelihood:** Low-Medium
- **Impact:** Medium
- **Risk Level:** 🟢 GREEN
- **Description:** Agent may struggle with complex tasks or misunderstand requirements
- **Mitigation:**
  - Clear, detailed task specifications
  - Validation gate after each task
  - Orchestrator guidance available
  - Can reassign or break down tasks further
- **Contingency:**
  - Manual intervention if agent stuck
  - Break task into smaller pieces
  - Provide additional context/examples
- **Status:** Being monitored

#### Risk R6: Test Coverage Gaps
- **Category:** Quality Risk
- **Likelihood:** Medium
- **Impact:** Medium
- **Risk Level:** 🟡 YELLOW
- **Description:** Tests may not cover all edge cases, leading to bugs in production
- **Mitigation:**
  - Test coverage targets defined (>80%)
  - Edge cases explicitly listed in task specs
  - Code review validates test completeness
  - E2E tests cover critical user paths
- **Contingency:**
  - Additional test pass if coverage low
  - Manual testing for critical paths
  - Bug fix sprint if issues found
- **Status:** Being monitored (coverage tracked per task)

### Risk Monitoring

**Review Frequency:** Weekly (in weekly report)

**Escalation Criteria:**
- Any risk moves to RED level → Immediate stakeholder notification
- Risk mitigation not working → Reassess and adjust plan
- New high-impact risks identified → Add to risk register

**Risk Log Location:** `docs/progress/risks.md`

---

## Success Criteria

### Functional Requirements

**Must Have (P0):**
- [ ] All existing relationships preserved after migration (100% fidelity)
- [ ] Manual add/remove relationships works for Task ↔ Note, Task ↔ Session, Note ↔ Session
- [ ] AI associations continue to work with no quality degradation
- [ ] Bidirectional relationships automatically maintained (zero manual sync)
- [ ] Navigation between related items works seamlessly
- [ ] Relationship metadata displayed (AI confidence, reasoning, date)

**Should Have (P1):**
- [ ] Mobile-friendly UI (responsive design)
- [ ] Keyboard shortcuts for power users
- [ ] Bulk relationship operations (select multiple, add/remove)
- [ ] Relationship filtering and search in modal
- [ ] Empty states and helpful onboarding
- [ ] Undo/redo for relationship changes

**Nice to Have (P2):**
- [ ] Relationship visualization (graph view)
- [ ] AI suggestions in modal ("You might also want to link...")
- [ ] Relationship strength indicators (visual weight)
- [ ] Export relationship data (for analysis)

### Non-Functional Requirements

**Performance (Must Meet):**
- [ ] Relationship lookup: <5ms (avg 10k entities)
- [ ] Add relationship: <10ms
- [ ] Remove relationship: <10ms
- [ ] Bulk operations (100 items): <100ms
- [ ] Modal search (10k items): <100ms
- [ ] Sidebar open with 50 relationships: <100ms
- [ ] Migration (10k entities): <30s
- [ ] No memory leaks (tested with 1hr usage)

**Reliability (Must Meet):**
- [ ] Zero data corruption (tested with concurrent operations)
- [ ] Transaction rollback works correctly
- [ ] Migration rollback works correctly
- [ ] Handles network/storage failures gracefully
- [ ] Cross-window sync works reliably

**Maintainability (Must Meet):**
- [ ] Code quality score >8/10 (CodeClimate or similar)
- [ ] Cyclomatic complexity <15 for all functions
- [ ] Zero code duplication >20 lines
- [ ] All public APIs documented (JSDoc)
- [ ] Architecture diagrams up to date

**Testability (Must Meet):**
- [ ] Test coverage >80% overall
- [ ] Test coverage >90% for core services (RelationshipManager, Migration)
- [ ] All acceptance criteria have corresponding tests
- [ ] E2E tests cover critical user paths
- [ ] Performance benchmarks automated

**Accessibility (Must Meet):**
- [ ] WCAG 2.1 AA compliant (axe-core validation)
- [ ] Keyboard navigation fully functional
- [ ] Screen reader tested (VoiceOver/NVDA)
- [ ] Color contrast meets standards
- [ ] Focus indicators visible

**Scalability (Should Meet):**
- [ ] Works with 100k+ entities (tested)
- [ ] Memory usage scales linearly with relationship count
- [ ] Storage size reasonable (indexed overhead <20%)
- [ ] Plugin architecture supports future entity types

### Quality Gates

**Code Quality:**
- [ ] TypeScript strict mode enabled (zero errors)
- [ ] ESLint clean (zero errors, <10 warnings)
- [ ] Prettier formatted (zero inconsistencies)
- [ ] No console.log statements in production code
- [ ] No any types (except unavoidable)

**Documentation:**
- [ ] All agent tasks documented with specifications
- [ ] Architecture documented with diagrams
- [ ] API reference complete (TypeDoc generated)
- [ ] User guide created for relationship features
- [ ] Migration guide for developers
- [ ] Validation reports for all tasks

**Testing:**
- [ ] All unit tests pass (100%)
- [ ] All integration tests pass (100%)
- [ ] All E2E tests pass (100%)
- [ ] Performance benchmarks met (100%)
- [ ] Accessibility tests pass (axe-core)
- [ ] No test timeouts or flakiness

### Acceptance Checklist

**Before marking project complete:**

1. **Functionality:**
   - [ ] All P0 requirements implemented and tested
   - [ ] Manual testing completed by stakeholder
   - [ ] No critical or high-severity bugs open

2. **Performance:**
   - [ ] All performance benchmarks met
   - [ ] No performance regressions from baseline
   - [ ] Memory usage validated (no leaks)

3. **Quality:**
   - [ ] All quality gates passed
   - [ ] Test coverage meets targets
   - [ ] Code review completed

4. **Documentation:**
   - [ ] All documentation complete and reviewed
   - [ ] User guide written and tested
   - [ ] Developer migration guide available

5. **Validation:**
   - [ ] All tasks validated by separate agents
   - [ ] Integration validation passed
   - [ ] E2E validation passed
   - [ ] Final orchestrator review completed

6. **Migration:**
   - [ ] Migration tested on real user data (sample)
   - [ ] Rollback tested and working
   - [ ] Backup procedures documented

7. **Deployment:**
   - [ ] Deployment plan created
   - [ ] Rollback plan documented
   - [ ] User communication prepared (if needed)

---

## Orchestrator Responsibilities

### My Role

As orchestrator, I am responsible for:

1. **Task Management**
   - Assign tasks to agents with clear specifications
   - Ensure dependencies are met before assignment
   - Monitor progress and identify blockers
   - Adjust schedule if needed

2. **Quality Assurance**
   - Ensure validation happens for every task
   - Review validation reports
   - Send tasks back for revision if issues found
   - Maintain quality standards throughout

3. **Integration Oversight**
   - Ensure components work together correctly
   - Run integration validation after each phase
   - Identify and resolve integration issues

4. **Documentation**
   - Maintain master plan (this document)
   - Update progress dashboard regularly
   - Keep documentation synchronized with implementation
   - Record architectural decisions

5. **Risk Management**
   - Monitor identified risks
   - Identify new risks as they emerge
   - Ensure mitigation strategies are working
   - Escalate critical risks to stakeholder

6. **Communication**
   - Provide daily progress updates
   - Send weekly summary reports
   - Alert stakeholder of blockers immediately
   - Report milestone completions

7. **Context Preservation**
   - Maintain continuity across conversation contexts
   - Refer to this master plan for all decisions
   - Update documentation as things change
   - Ensure agents have necessary context

### What I Will NOT Do

- ❌ Write implementation code directly (agents do this)
- ❌ Skip validation steps to save time
- ❌ Mark tasks complete without proper validation
- ❌ Make architectural decisions without documentation
- ❌ Rush to completion at the cost of quality
- ❌ Ignore test failures or quality issues

### Agent Management Protocol

#### Task Assignment

**Before assigning a task:**
1. ✓ Verify all dependencies are complete
2. ✓ Ensure task specification is clear and complete
3. ✓ Check agent has necessary context
4. ✓ Set clear acceptance criteria
5. ✓ Specify quality standards
6. ✓ Provide estimated completion time

**Assignment message format:**
```
AGENT TASK ASSIGNMENT: [TASK_ID]

OBJECTIVE: [Brief description]

SPECIFICATION: Read full specification in docs/agent-tasks/[TASK_ID].md

CONTEXT:
- [Relevant context item 1]
- [Relevant context item 2]

DEPENDENCIES COMPLETE:
- [X] Task F1
- [X] Task F2

QUALITY STANDARD: Production-ready code with comprehensive tests

ACCEPTANCE CRITERIA: See specification document

DELIVERABLES:
1. [File 1]
2. [File 2]
...

ESTIMATED TIME: X-Y hours

When complete, provide task completion report with:
- List of files created/modified
- Test results
- Acceptance criteria checklist
- Any implementation notes

IMPORTANT: Follow all requirements in the specification. Do not skip tests or documentation. Quality over speed.
```

#### Progress Monitoring

**Monitoring frequency:** Check every 2 hours (simulated)

**Check if:**
- Agent making progress (commits, file changes)
- Agent stuck or blocked (no activity)
- Agent needs guidance (questions, uncertainties)

**If blocked:**
- Provide additional context or examples
- Break task into smaller pieces if needed
- Reassign if agent unable to complete

#### Validation Protocol

**After task completion:**

1. **Assign validation agent** with validation prompt
2. **Review validation report** thoroughly
3. **Decide action:**
   - PASS → Mark task complete, update progress, assign next task
   - REVISE → Send specific feedback to implementation agent
   - FAIL → Escalate issue, may need to reassign

4. **Update documentation:**
   - Mark task complete in progress dashboard
   - Update todo list
   - Record any decisions made
   - Note any risks or issues discovered

**Validation agent selection:**
- Use different agent instance for validation (fresh perspective)
- Provide full context (task spec, implementation, tests)
- Clear evaluation criteria

### Communication Standards

**To Stakeholder:**

**Daily Update (End of day):**
```
Daily Progress Update - [Date]

Today's Accomplishments:
- [Completed item 1]
- [Completed item 2]

In Progress:
- [Current task] - [X% complete]

Blockers: [None / List]

Tomorrow's Plan:
- [Planned activity 1]
- [Planned activity 2]

Overall Status: [On track / Behind / Ahead]
```

**Weekly Summary (End of week):**
```
Weekly Summary - Week of [Date]

Progress: X% overall (up from Y% last week)

Completed This Week:
- [Task 1]: [Brief description]
- [Task 2]: [Brief description]

Validation Results:
- X tasks validated successfully
- Y tasks required revisions (now complete)

Metrics:
- Test coverage: X%
- Open issues: Y
- Quality score: Z/10

Next Week Goals:
- [Goal 1]
- [Goal 2]

Risks & Concerns: [None / List]

On schedule for [target completion date]: Yes/No
```

**Blocker Alert (Immediate):**
```
BLOCKER ALERT - [Date & Time]

Task: [Task ID & Name]
Blocker: [Description of blocker]
Impact: [How this affects timeline/quality]
Attempted Resolution: [What we've tried]
Recommendation: [Proposed solution]

Needs stakeholder input: [Yes/No - specific question]
```

**Milestone Completion:**
```
MILESTONE COMPLETE - [Date]

Phase: [Phase name]
Tasks Completed: [List]
Validation: All tasks validated and approved

Key Achievements:
- [Achievement 1]
- [Achievement 2]

Quality Metrics:
- Test coverage: X%
- Performance: [Met/Exceeded targets]
- Documentation: Complete

Next Phase: [Phase name]
Estimated Start: [Date]
```

**To Agents:**

**Clear, structured task assignments** (see format above)

**Timely feedback on validation:**
```
VALIDATION FEEDBACK: [TASK_ID]

Status: REVISE

Issues to Address:
1. [Issue 1] - [Severity] - [Location] - [What needs to change]
2. [Issue 2] - [Severity] - [Location] - [What needs to change]

Specific Guidance:
- [Helpful hint or example]

Please address these issues and request re-validation.
```

**Positive reinforcement:**
```
TASK APPROVED: [TASK_ID]

Excellent work! Validation passed with no issues.

Highlights:
- [Something done particularly well]
- [Another positive note]

Task marked complete. Next task: [TASK_ID]
```

### Context Preservation Strategy

**Critical for operating across conversations:**

1. **Always reference this master plan document**
   - Location: `/Users/jamesmcarthur/Documents/taskerino/docs/RELATIONSHIP_SYSTEM_MASTER_PLAN.md`
   - Read at start of each session
   - Update as things change

2. **Maintain progress dashboard**
   - Location: `/Users/jamesmcarthur/Documents/taskerino/docs/progress/dashboard.md`
   - Update after each task completion
   - Read at start of each session to understand current state

3. **Record all decisions**
   - Location: `/Users/jamesmcarthur/Documents/taskerino/docs/progress/decisions.md`
   - Document why choices were made
   - Future context can reference these decisions

4. **Keep validation reports**
   - Location: `/Users/jamesmcarthur/Documents/taskerino/docs/validation/`
   - Preserve all validation history
   - Reference when similar issues arise

5. **Weekly reports for history**
   - Location: `/Users/jamesmcarthur/Documents/taskerino/docs/progress/weekly-reports/`
   - Summarize each week's work
   - Provide narrative context for future sessions

**Session startup checklist:**
- [ ] Read RELATIONSHIP_SYSTEM_MASTER_PLAN.md
- [ ] Read progress/dashboard.md
- [ ] Check for any new decisions in progress/decisions.md
- [ ] Review latest weekly report
- [ ] Check for open risks in progress/risks.md
- [ ] Review current todo list
- [ ] Understand what needs to happen next

---

## Detailed Agent Tasks

### AGENT TASK F1: Type System

**File:** `docs/agent-tasks/F1-type-system.md`

**Objective:** Design and implement the core type system for the unified relationship architecture.

**Priority:** P0 (Foundation - must complete first)

**Dependencies:** None

**Complexity:** Medium

**Estimated Time:** 3-4 hours

#### Detailed Requirements

1. **Create `src/types/relationships.ts`:**

```typescript
/**
 * Relationship type enumeration
 * Supports current and future entity relationship types
 */
export enum RelationshipType {
  // Current types
  TASK_NOTE = 'task-note',
  TASK_SESSION = 'task-session',
  NOTE_SESSION = 'note-session',
  TASK_TOPIC = 'task-topic',
  NOTE_TOPIC = 'note-topic',
  NOTE_COMPANY = 'note-company',
  NOTE_CONTACT = 'note-contact',
  NOTE_PARENT = 'note-parent', // For note threading

  // Future types (for extensibility)
  TASK_FILE = 'task-file',
  NOTE_FILE = 'note-file',
  SESSION_FILE = 'session-file',
  TASK_TASK = 'task-task', // Task dependencies
  PROJECT_TASK = 'project-task',
  PROJECT_NOTE = 'project-note',
  GOAL_TASK = 'goal-task',
}

/**
 * Source of the relationship (who/what created it)
 */
export type RelationshipSource = 'ai' | 'manual' | 'migration' | 'system';

/**
 * Metadata attached to each relationship
 */
export interface RelationshipMetadata {
  /** How relationship was created */
  source: RelationshipSource;

  /** AI confidence score (0-1), only for source='ai' */
  confidence?: number;

  /** AI reasoning for creating relationship */
  reasoning?: string;

  /** When relationship was created */
  createdAt: string; // ISO timestamp

  /** User ID if created manually */
  createdBy?: string;

  /** Additional type-specific metadata */
  extra?: Record<string, any>;
}

/**
 * Entity type enumeration
 */
export enum EntityType {
  TASK = 'task',
  NOTE = 'note',
  SESSION = 'session',
  TOPIC = 'topic',
  COMPANY = 'company',
  CONTACT = 'contact',
  // Future types
  FILE = 'file',
  PROJECT = 'project',
  GOAL = 'goal',
}

/**
 * Core relationship interface
 * Represents a directed edge in the relationship graph
 */
export interface Relationship {
  /** Unique identifier for this relationship */
  id: string;

  /** Type of relationship */
  type: RelationshipType;

  /** Source entity */
  sourceType: EntityType;
  sourceId: string;

  /** Target entity */
  targetType: EntityType;
  targetId: string;

  /** Metadata */
  metadata: RelationshipMetadata;

  /** Is this the canonical direction? */
  canonical: boolean;
}

/**
 * Relationship configuration for each type
 * Defines rules and behavior for relationship types
 */
export interface RelationshipTypeConfig {
  type: RelationshipType;
  sourceTypes: EntityType[];
  targetTypes: EntityType[];
  bidirectional: boolean;
  cascadeDelete: boolean;
  displayName: string;
  icon?: string;
  color?: string;
}

/**
 * Registry of all relationship type configurations
 */
export const RELATIONSHIP_CONFIGS: Record<RelationshipType, RelationshipTypeConfig> = {
  [RelationshipType.TASK_NOTE]: {
    type: RelationshipType.TASK_NOTE,
    sourceTypes: [EntityType.TASK],
    targetTypes: [EntityType.NOTE],
    bidirectional: true,
    cascadeDelete: false,
    displayName: 'Created from',
    icon: 'FileText',
    color: '#3B82F6', // blue
  },
  // ... (other configs)
};
```

2. **Update `src/types.ts`:**

Add relationship fields to existing types:

```typescript
export interface Task {
  // ... existing fields ...

  /**
   * Unified relationship system
   * @since 2.0.0
   */
  relationships?: Relationship[];

  /**
   * Migration tracking
   * @since 2.0.0
   */
  relationshipVersion?: number; // 0 = legacy, 1 = migrated

  /**
   * @deprecated Use relationships array instead
   * Kept for backward compatibility during migration
   */
  noteId?: string;

  /**
   * @deprecated Use relationships array instead
   */
  sourceNoteId?: string;

  /**
   * @deprecated Use relationships array instead
   */
  sourceSessionId?: string;
}

export interface Note {
  // ... existing fields ...

  relationships?: Relationship[];
  relationshipVersion?: number;

  /** @deprecated Use relationships array */
  topicId?: string;

  /** @deprecated Use relationships array */
  sourceSessionId?: string;
}

export interface Session {
  // ... existing fields ...

  relationships?: Relationship[];
  relationshipVersion?: number;

  /**
   * @deprecated Use relationships array
   * Kept for backward compatibility
   */
  extractedTaskIds?: string[];

  /** @deprecated Use relationships array */
  extractedNoteIds?: string[];
}
```

3. **Add JSDoc documentation:**
   - All types must have clear JSDoc comments
   - Include @since tags for new fields
   - Include @deprecated tags for legacy fields
   - Include examples where helpful

#### Deliverables

1. `src/types/relationships.ts` - Complete relationship type system (200-300 lines)
2. Updated `src/types.ts` - Add relationship fields to existing types
3. `docs/architecture/type-system.md` - Documentation of type system design

#### Acceptance Criteria

- [ ] All types compile without TypeScript errors (strict mode)
- [ ] `RelationshipType` enum includes all current relationship types
- [ ] `RELATIONSHIP_CONFIGS` includes configuration for all types
- [ ] Legacy fields marked with @deprecated JSDoc tags
- [ ] New fields marked with @since tags
- [ ] `Relationship` interface includes all required metadata fields
- [ ] Type documentation generated successfully via TypeDoc
- [ ] No breaking changes to existing code (backward compatible)
- [ ] Schema version field (`relationshipVersion`) added to all entity types

#### Testing Requirements

1. **Type-only tests** (`tests/types/relationships.test.ts`):
```typescript
// Type inference tests
describe('Relationship Types', () => {
  it('should infer correct types', () => {
    const rel: Relationship = {
      id: '123',
      type: RelationshipType.TASK_NOTE,
      sourceType: EntityType.TASK,
      sourceId: 'task-1',
      targetType: EntityType.NOTE,
      targetId: 'note-1',
      metadata: {
        source: 'ai',
        confidence: 0.95,
        reasoning: 'Test',
        createdAt: new Date().toISOString(),
      },
      canonical: true,
    };

    expect(rel.type).toBe(RelationshipType.TASK_NOTE);
  });
});
```

2. **Backward compatibility tests:**
   - Ensure old Task/Note/Session structures still valid
   - Test that code can read legacy fields

#### Notes

- Keep this phase simple - just types, no implementation
- Focus on extensibility - new types should be easy to add
- Document design decisions in `docs/architecture/type-system.md`

---

### AGENT TASK F2: Storage Layer with Transactions

**File:** `docs/agent-tasks/F2-storage-layer.md`

**Objective:** Implement atomic transactions and relationship indexing in the storage layer.

**Priority:** P0 (Foundation)

**Dependencies:** F1 (Type System must be complete)

**Complexity:** High

**Estimated Time:** 6-8 hours

#### Detailed Requirements

1. **Create Relationship Index:**

File: `src/services/storage/relationshipIndex.ts`

```typescript
/**
 * High-performance index for relationship lookups
 * Provides O(1) access to relationships by entity
 */
export class RelationshipIndex {
  // Map<entityId, Relationship[]>
  private byEntity: Map<string, Relationship[]>;

  // Map<relationshipId, Relationship>
  private byId: Map<string, Relationship>;

  // Map<sourceId, Map<targetId, Relationship>>
  private bySourceTarget: Map<string, Map<string, Relationship>>;

  constructor(initialRelationships?: Relationship[]) {
    this.byEntity = new Map();
    this.byId = new Map();
    this.bySourceTarget = new Map();

    if (initialRelationships) {
      initialRelationships.forEach(rel => this.add(rel));
    }
  }

  /**
   * Add relationship to index
   * Updates all index structures
   */
  add(relationship: Relationship): void {
    // Add to byId
    this.byId.set(relationship.id, relationship);

    // Add to byEntity (source)
    const sourceRels = this.byEntity.get(relationship.sourceId) || [];
    sourceRels.push(relationship);
    this.byEntity.set(relationship.sourceId, sourceRels);

    // Add to byEntity (target) if bidirectional
    if (RELATIONSHIP_CONFIGS[relationship.type].bidirectional) {
      const targetRels = this.byEntity.get(relationship.targetId) || [];
      targetRels.push(relationship);
      this.byEntity.set(relationship.targetId, targetRels);
    }

    // Add to bySourceTarget
    if (!this.bySourceTarget.has(relationship.sourceId)) {
      this.bySourceTarget.set(relationship.sourceId, new Map());
    }
    this.bySourceTarget.get(relationship.sourceId)!.set(
      relationship.targetId,
      relationship
    );
  }

  /**
   * Remove relationship from index
   */
  remove(relationshipId: string): boolean {
    const rel = this.byId.get(relationshipId);
    if (!rel) return false;

    // Remove from all indexes
    this.byId.delete(relationshipId);

    // Remove from byEntity (source)
    const sourceRels = this.byEntity.get(rel.sourceId) || [];
    this.byEntity.set(
      rel.sourceId,
      sourceRels.filter(r => r.id !== relationshipId)
    );

    // Remove from byEntity (target)
    const targetRels = this.byEntity.get(rel.targetId) || [];
    this.byEntity.set(
      rel.targetId,
      targetRels.filter(r => r.id !== relationshipId)
    );

    // Remove from bySourceTarget
    this.bySourceTarget.get(rel.sourceId)?.delete(rel.targetId);

    return true;
  }

  /**
   * Get all relationships for an entity
   * O(1) lookup
   */
  getByEntity(entityId: string): Relationship[] {
    return this.byEntity.get(entityId) || [];
  }

  /**
   * Get relationship by ID
   * O(1) lookup
   */
  getById(relationshipId: string): Relationship | undefined {
    return this.byId.get(relationshipId);
  }

  /**
   * Check if relationship exists between two entities
   * O(1) lookup
   */
  exists(sourceId: string, targetId: string): boolean {
    return this.bySourceTarget.get(sourceId)?.has(targetId) || false;
  }

  /**
   * Get relationship between two entities
   * O(1) lookup
   */
  getBetween(sourceId: string, targetId: string): Relationship | undefined {
    return this.bySourceTarget.get(sourceId)?.get(targetId);
  }

  /**
   * Clear all indexes
   */
  clear(): void {
    this.byEntity.clear();
    this.byId.clear();
    this.bySourceTarget.clear();
  }

  /**
   * Get index statistics
   */
  getStats() {
    return {
      totalRelationships: this.byId.size,
      entitiesWithRelationships: this.byEntity.size,
      sourceTargetPairs: Array.from(this.bySourceTarget.values())
        .reduce((sum, map) => sum + map.size, 0),
    };
  }
}
```

2. **Add Transaction Support to Storage Adapters:**

Update both `src/services/storage/indexedDBAdapter.ts` and `src/services/storage/tauriAdapter.ts`:

```typescript
export interface StorageTransaction {
  id: string;
  operations: TransactionOperation[];
  status: 'pending' | 'committed' | 'rolled_back';
}

export interface TransactionOperation {
  type: 'write' | 'delete';
  collection: string;
  entityId: string;
  data?: any;
  previousData?: any; // For rollback
}

export class IndexedDBAdapter {
  private transactions: Map<string, StorageTransaction> = new Map();

  /**
   * Begin a new transaction
   * Returns transaction ID
   */
  beginTransaction(): string {
    const txId = generateId();
    this.transactions.set(txId, {
      id: txId,
      operations: [],
      status: 'pending',
    });
    return txId;
  }

  /**
   * Add operation to transaction
   */
  addOperation(txId: string, operation: TransactionOperation): void {
    const tx = this.transactions.get(txId);
    if (!tx) throw new Error(`Transaction ${txId} not found`);
    if (tx.status !== 'pending') throw new Error('Transaction already completed');

    tx.operations.push(operation);
  }

  /**
   * Commit transaction
   * All operations succeed or all fail
   */
  async commitTransaction(txId: string): Promise<void> {
    const tx = this.transactions.get(txId);
    if (!tx) throw new Error(`Transaction ${txId} not found`);

    try {
      // Execute all operations atomically
      const db = await this.getDB();
      const idbTx = db.transaction(
        Array.from(new Set(tx.operations.map(op => op.collection))),
        'readwrite'
      );

      // Execute each operation
      for (const op of tx.operations) {
        const store = idbTx.objectStore(op.collection);
        if (op.type === 'write') {
          await store.put(op.data);
        } else if (op.type === 'delete') {
          await store.delete(op.entityId);
        }
      }

      // Wait for transaction to complete
      await idbTx.complete;

      tx.status = 'committed';
      this.transactions.delete(txId);
    } catch (error) {
      // Rollback on error
      await this.rollbackTransaction(txId);
      throw error;
    }
  }

  /**
   * Rollback transaction
   * Restore previous state
   */
  async rollbackTransaction(txId: string): Promise<void> {
    const tx = this.transactions.get(txId);
    if (!tx) return;

    // Restore previous data for all operations
    const db = await this.getDB();
    const idbTx = db.transaction(
      Array.from(new Set(tx.operations.map(op => op.collection))),
      'readwrite'
    );

    for (const op of tx.operations) {
      const store = idbTx.objectStore(op.collection);
      if (op.previousData) {
        await store.put(op.previousData);
      } else if (op.type === 'write') {
        // Was a new write, delete it
        await store.delete(op.entityId);
      }
    }

    await idbTx.complete;
    tx.status = 'rolled_back';
    this.transactions.delete(txId);
  }
}
```

3. **Integrate Index with Storage:**

Update storage system to maintain relationship index:

```typescript
// In storage service
export class StorageService {
  private relationshipIndex: RelationshipIndex;

  constructor() {
    this.relationshipIndex = new RelationshipIndex();
    this.loadRelationshipsIntoIndex();
  }

  private async loadRelationshipsIntoIndex(): Promise<void> {
    // Load all entities and build index
    const tasks = await this.load<Task>('tasks');
    const notes = await this.load<Note>('notes');
    const sessions = await this.load<Session>('sessions');

    // Extract all relationships
    const allRelationships: Relationship[] = [];
    tasks.forEach(task => {
      if (task.relationships) {
        allRelationships.push(...task.relationships);
      }
    });
    notes.forEach(note => {
      if (note.relationships) {
        allRelationships.push(...note.relationships);
      }
    });
    sessions.forEach(session => {
      if (session.relationships) {
        allRelationships.push(...session.relationships);
      }
    });

    // Build index
    this.relationshipIndex = new RelationshipIndex(allRelationships);
  }

  /**
   * Get relationship index for fast lookups
   */
  getRelationshipIndex(): RelationshipIndex {
    return this.relationshipIndex;
  }
}
```

#### Deliverables

1. `src/services/storage/relationshipIndex.ts` - Relationship index implementation (300-400 lines)
2. Updated `src/services/storage/indexedDBAdapter.ts` - Add transaction support
3. Updated `src/services/storage/tauriAdapter.ts` - Add transaction support
4. `tests/storage/relationshipIndex.test.ts` - Comprehensive index tests (200+ lines)
5. `tests/storage/transactions.test.ts` - Transaction tests
6. `docs/architecture/storage-transactions.md` - Transaction design documentation

#### Acceptance Criteria

- [ ] Transaction rollback leaves no partial state (tested with simulated failures)
- [ ] Relationship index stays synchronized with data (tested with concurrent operations)
- [ ] Concurrent modifications detected and rejected (optimistic locking)
- [ ] Performance: <5ms for indexed lookups (benchmarked with 10k relationships)
- [ ] Memory: Index size scales linearly with relationship count (tested up to 100k)
- [ ] Both IndexedDB and Tauri adapters support transactions consistently
- [ ] Transaction can be nested (savepoints supported)

#### Testing Requirements

1. **Index Tests:**
```typescript
describe('RelationshipIndex', () => {
  it('should add and retrieve relationships', () => {
    const index = new RelationshipIndex();
    const rel: Relationship = createTestRelationship();

    index.add(rel);

    const retrieved = index.getById(rel.id);
    expect(retrieved).toEqual(rel);
  });

  it('should return all relationships for entity', () => {
    const index = new RelationshipIndex();
    const rel1 = createTestRelationship({ sourceId: 'task-1' });
    const rel2 = createTestRelationship({ sourceId: 'task-1' });

    index.add(rel1);
    index.add(rel2);

    const rels = index.getByEntity('task-1');
    expect(rels).toHaveLength(2);
  });

  it('should handle bidirectional relationships', () => {
    // Test that both source and target appear in byEntity
  });

  it('should remove relationships correctly', () => {
    // Test removal from all indexes
  });
});
```

2. **Transaction Tests:**
```typescript
describe('Storage Transactions', () => {
  it('should commit all operations atomically', async () => {
    const storage = new StorageService();
    const txId = storage.beginTransaction();

    storage.addOperation(txId, {
      type: 'write',
      collection: 'tasks',
      entityId: 'task-1',
      data: { id: 'task-1', title: 'Test' },
    });

    storage.addOperation(txId, {
      type: 'write',
      collection: 'notes',
      entityId: 'note-1',
      data: { id: 'note-1', summary: 'Test' },
    });

    await storage.commitTransaction(txId);

    // Both should exist
    const task = await storage.load('tasks', 'task-1');
    const note = await storage.load('notes', 'note-1');
    expect(task).toBeDefined();
    expect(note).toBeDefined();
  });

  it('should rollback on failure', async () => {
    // Simulate failure mid-transaction
    // Verify no partial state remains
  });

  it('should handle concurrent transactions', async () => {
    // Start two transactions
    // Verify optimistic locking prevents conflicts
  });
});
```

3. **Performance Benchmarks:**
```typescript
describe('Performance', () => {
  it('should lookup relationships in <5ms', () => {
    const index = new RelationshipIndex(generate10kRelationships());

    const start = performance.now();
    index.getByEntity('task-5000');
    const end = performance.now();

    expect(end - start).toBeLessThan(5);
  });
});
```

#### Notes

- Transaction implementation is critical - take time to get it right
- Test extensively with simulated failures
- Document transaction guarantees clearly
- Consider edge cases (power loss, browser crash, etc.)

---

### AGENT TASK F3: Migration Service

**File:** `docs/agent-tasks/F3-migration-service.md`

**Objective:** Build backward-compatible migration from legacy relationship fields to unified system.

**Priority:** P0 (Foundation)

**Dependencies:** F1 (Type System), F2 (Storage Layer)

**Complexity:** High

**Estimated Time:** 8-10 hours

#### Detailed Requirements

1. **Create Migration Service:**

File: `src/services/relationshipMigration.ts`

```typescript
export interface MigrationReport {
  success: boolean;
  totalEntities: number;
  entitiesScanned: {
    tasks: number;
    notes: number;
    sessions: number;
  };
  relationshipsCreated: {
    taskNote: number;
    taskSession: number;
    noteSession: number;
    noteTopic: number;
    noteCompany: number;
    noteContact: number;
  };
  entitiesMigrated: number;
  issues: MigrationIssue[];
  orphanedReferences: OrphanedReference[];
  duration: number; // milliseconds
}

export interface MigrationIssue {
  severity: 'error' | 'warning' | 'info';
  entityType: EntityType;
  entityId: string;
  field: string;
  message: string;
}

export interface OrphanedReference {
  sourceType: EntityType;
  sourceId: string;
  field: string;
  targetType: EntityType;
  targetId: string;
  action: 'removed' | 'kept' | 'created_placeholder';
}

export class RelationshipMigrationService {
  constructor(
    private storage: StorageService,
    private logger: Logger
  ) {}

  /**
   * Perform migration from legacy fields to unified relationships
   * @param dryRun - If true, don't actually modify data, just report
   */
  async migrate(dryRun: boolean = false): Promise<MigrationReport> {
    const startTime = Date.now();
    const report: MigrationReport = {
      success: false,
      totalEntities: 0,
      entitiesScanned: { tasks: 0, notes: 0, sessions: 0 },
      relationshipsCreated: {
        taskNote: 0,
        taskSession: 0,
        noteSession: 0,
        noteTopic: 0,
        noteCompany: 0,
        noteContact: 0,
      },
      entitiesMigrated: 0,
      issues: [],
      orphanedReferences: [],
      duration: 0,
    };

    try {
      // Step 1: Load all entities
      this.logger.info('Loading entities for migration...');
      const tasks = await this.storage.load<Task>('tasks');
      const notes = await this.storage.load<Note>('notes');
      const sessions = await this.storage.load<Session>('sessions');

      report.entitiesScanned = {
        tasks: tasks.length,
        notes: notes.length,
        sessions: sessions.length,
      };
      report.totalEntities = tasks.length + notes.length + sessions.length;

      // Step 2: Create entity maps for validation
      const taskMap = new Map(tasks.map(t => [t.id, t]));
      const noteMap = new Map(notes.map(n => [n.id, n]));
      const sessionMap = new Map(sessions.map(s => [s.id, s]));

      // Step 3: Migrate tasks
      this.logger.info(`Migrating ${tasks.length} tasks...`);
      for (const task of tasks) {
        if (task.relationshipVersion === 1) {
          // Already migrated
          continue;
        }

        const relationships: Relationship[] = [];

        // Migrate noteId
        if (task.noteId) {
          if (noteMap.has(task.noteId)) {
            relationships.push(this.createRelationship({
              type: RelationshipType.TASK_NOTE,
              sourceType: EntityType.TASK,
              sourceId: task.id,
              targetType: EntityType.NOTE,
              targetId: task.noteId,
              metadata: {
                source: 'migration',
                createdAt: task.createdAt,
              },
            }));
            report.relationshipsCreated.taskNote++;
          } else {
            // Orphaned reference
            report.orphanedReferences.push({
              sourceType: EntityType.TASK,
              sourceId: task.id,
              field: 'noteId',
              targetType: EntityType.NOTE,
              targetId: task.noteId,
              action: 'removed',
            });
            report.issues.push({
              severity: 'warning',
              entityType: EntityType.TASK,
              entityId: task.id,
              field: 'noteId',
              message: `References non-existent note: ${task.noteId}`,
            });
          }
        }

        // Migrate sourceNoteId (prioritize over noteId if different)
        if (task.sourceNoteId && task.sourceNoteId !== task.noteId) {
          if (noteMap.has(task.sourceNoteId)) {
            relationships.push(this.createRelationship({
              type: RelationshipType.TASK_NOTE,
              sourceType: EntityType.TASK,
              sourceId: task.id,
              targetType: EntityType.NOTE,
              targetId: task.sourceNoteId,
              metadata: {
                source: 'migration',
                createdAt: task.createdAt,
              },
            }));
            report.relationshipsCreated.taskNote++;
          }
        }

        // Migrate sourceSessionId
        if (task.sourceSessionId) {
          if (sessionMap.has(task.sourceSessionId)) {
            relationships.push(this.createRelationship({
              type: RelationshipType.TASK_SESSION,
              sourceType: EntityType.TASK,
              sourceId: task.id,
              targetType: EntityType.SESSION,
              targetId: task.sourceSessionId,
              metadata: {
                source: 'migration',
                createdAt: task.createdAt,
              },
            }));
            report.relationshipsCreated.taskSession++;
          } else {
            report.orphanedReferences.push({
              sourceType: EntityType.TASK,
              sourceId: task.id,
              field: 'sourceSessionId',
              targetType: EntityType.SESSION,
              targetId: task.sourceSessionId,
              action: 'removed',
            });
          }
        }

        // Update task with relationships
        if (relationships.length > 0) {
          task.relationships = relationships;
          task.relationshipVersion = 1;
          report.entitiesMigrated++;
        }
      }

      // Step 4: Migrate notes (similar pattern)
      this.logger.info(`Migrating ${notes.length} notes...`);
      for (const note of notes) {
        // ... similar migration logic for notes
      }

      // Step 5: Migrate sessions
      this.logger.info(`Migrating ${sessions.length} sessions...`);
      for (const session of sessions) {
        // ... migrate extractedTaskIds and extractedNoteIds
      }

      // Step 6: Validate bidirectional consistency
      this.logger.info('Validating bidirectional consistency...');
      const inconsistencies = this.validateBidirectional(tasks, notes, sessions);
      if (inconsistencies.length > 0) {
        report.issues.push(...inconsistencies);
      }

      // Step 7: Save changes (if not dry run)
      if (!dryRun) {
        this.logger.info('Saving migrated entities...');
        const txId = this.storage.beginTransaction();

        this.storage.addOperation(txId, {
          type: 'write',
          collection: 'tasks',
          data: tasks,
        });
        this.storage.addOperation(txId, {
          type: 'write',
          collection: 'notes',
          data: notes,
        });
        this.storage.addOperation(txId, {
          type: 'write',
          collection: 'sessions',
          data: sessions,
        });

        await this.storage.commitTransaction(txId);
      } else {
        this.logger.info('Dry run - no changes saved');
      }

      report.success = true;
      report.duration = Date.now() - startTime;

      return report;
    } catch (error) {
      this.logger.error('Migration failed:', error);
      report.success = false;
      report.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Validate bidirectional consistency
   */
  private validateBidirectional(
    tasks: Task[],
    notes: Note[],
    sessions: Session[]
  ): MigrationIssue[] {
    const issues: MigrationIssue[] = [];

    // For each relationship, ensure reverse exists (if bidirectional)
    // ...

    return issues;
  }

  /**
   * Create a relationship object
   */
  private createRelationship(params: {
    type: RelationshipType;
    sourceType: EntityType;
    sourceId: string;
    targetType: EntityType;
    targetId: string;
    metadata: Partial<RelationshipMetadata>;
  }): Relationship {
    return {
      id: generateId(),
      type: params.type,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: {
        source: params.metadata.source || 'migration',
        createdAt: params.metadata.createdAt || new Date().toISOString(),
        ...params.metadata,
      },
      canonical: true,
    };
  }

  /**
   * Rollback migration
   * Restores entities to pre-migration state
   */
  async rollback(): Promise<void> {
    this.logger.warn('Rolling back migration...');
    // Implementation: restore from backup
  }
}
```

2. **Create Migration Validator:**

File: `src/services/migrationValidator.ts`

```typescript
export class MigrationValidator {
  /**
   * Validate database state before migration
   */
  async preValidate(storage: StorageService): Promise<ValidationResult> {
    // Check data integrity
    // Identify potential issues
    // Estimate migration time
  }

  /**
   * Validate database state after migration
   */
  async postValidate(storage: StorageService): Promise<ValidationResult> {
    // Verify all relationships created
    // Check bidirectional consistency
    // Ensure no data loss
  }
}
```

3. **Create Migration UI Component:**

File: `src/components/MigrationProgress.tsx`

```typescript
/**
 * Shows migration progress to user
 * Displays: progress bar, current step, issues found
 */
export function MigrationProgress({ report }: { report: MigrationReport }) {
  // ... UI implementation
}
```

#### Deliverables

1. `src/services/relationshipMigration.ts` - Complete migration service (600-800 lines)
2. `src/services/migrationValidator.ts` - Pre/post validation (200-300 lines)
3. `src/components/MigrationProgress.tsx` - Migration UI
4. `tests/migration/relationshipMigration.test.ts` - Extensive migration tests (400+ lines)
5. `tests/migration/fixtures/` - Test data fixtures (various scenarios)
6. `docs/migration/migration-guide.md` - User-facing documentation

#### Acceptance Criteria

- [ ] 100% of legacy relationships preserved in test fixtures
- [ ] Bidirectional consistency validated and enforced
- [ ] Orphaned references detected and reported (not silently ignored)
- [ ] Migration completes in <30 seconds for 10k entities (benchmarked)
- [ ] Rollback restores exact original state (tested)
- [ ] Migration is idempotent - safe to run multiple times
- [ ] Dry-run mode works correctly (no data modified)
- [ ] Progress UI shows real-time updates
- [ ] Migration report is comprehensive and actionable

#### Testing Requirements

1. **Create Test Fixtures:**
```typescript
// tests/migration/fixtures/legacyData.ts
export const legacyTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Test task',
    noteId: 'note-1',  // Valid reference
    sourceSessionId: 'session-1',
    // ... other fields
  },
  {
    id: 'task-2',
    title: 'Orphaned task',
    noteId: 'note-nonexistent', // Orphaned reference
    // ... other fields
  },
  // ... more scenarios
];

export const legacyNotes: Note[] = [
  // ... test notes
];

export const legacySessions: Session[] = [
  // ... test sessions
];
```

2. **Migration Tests:**
```typescript
describe('Relationship Migration', () => {
  it('should migrate all valid relationships', async () => {
    const service = new RelationshipMigrationService(storage, logger);
    const report = await service.migrate(false);

    expect(report.success).toBe(true);
    expect(report.relationshipsCreated.taskNote).toBeGreaterThan(0);
  });

  it('should detect orphaned references', async () => {
    // Load fixture with orphaned refs
    const report = await service.migrate(true);

    expect(report.orphanedReferences.length).toBeGreaterThan(0);
  });

  it('should maintain bidirectional consistency', async () => {
    const report = await service.migrate(false);

    // For each task→note relationship, verify note→task exists
  });

  it('should be idempotent', async () => {
    const report1 = await service.migrate(false);
    const report2 = await service.migrate(false);

    expect(report2.entitiesMigrated).toBe(0); // Already migrated
  });

  it('should rollback on failure', async () => {
    // Simulate failure mid-migration
    // Verify original state restored
  });
});
```

3. **Performance Tests:**
```typescript
describe('Migration Performance', () => {
  it('should complete 10k entities in <30s', async () => {
    const largeDataset = generate10kEntities();

    const start = Date.now();
    const report = await service.migrate(false);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(30000);
  });
});
```

#### Notes

- Migration is high-risk - test extensively
- Provide clear feedback to users during migration
- Document all edge cases and how they're handled
- Consider adding telemetry to track migration success rates

---

## CONTINUATION: Remaining Agent Tasks

Due to length constraints, the remaining agent task specifications (S1, S2, C1, C2, U1, U2, U3, V1, V2) are documented in separate files:

- `docs/agent-tasks/S1-relationship-manager.md`
- `docs/agent-tasks/S2-ai-associations.md`
- `docs/agent-tasks/C1-relationship-context.md`
- `docs/agent-tasks/C2-context-integration.md`
- `docs/agent-tasks/U1-relationship-pills.md`
- `docs/agent-tasks/U2-relationship-modal.md`
- `docs/agent-tasks/U3-ui-integration.md`
- `docs/agent-tasks/V1-e2e-testing.md`
- `docs/agent-tasks/V2-quality-review.md`

Each follows the same structure:
- Objective
- Detailed Requirements
- Deliverables
- Acceptance Criteria
- Testing Requirements
- Notes

---

## APPENDIX

### A. Glossary

**Bidirectional Relationship:** Relationship stored on both entities (e.g., Task has reference to Note, Note has reference to Task)

**Canonical Direction:** The "primary" direction of a relationship (e.g., Task → Note is canonical, Note → Task is reverse)

**Entity:** First-class object in the system (Task, Note, Session, etc.)

**Orphaned Reference:** Reference to an entity that no longer exists

**Relationship Metadata:** Additional information attached to a relationship (confidence, reasoning, timestamps)

**Transaction:** Atomic operation that ensures all changes succeed or all fail

### B. Acronyms

- **ACID:** Atomicity, Consistency, Isolation, Durability
- **E2E:** End-to-End
- **CRUD:** Create, Read, Update, Delete
- **UI:** User Interface
- **API:** Application Programming Interface
- **FK:** Foreign Key
- **JSDoc:** JavaScript Documentation
- **WCAG:** Web Content Accessibility Guidelines

### C. References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Context API](https://react.dev/reference/react/useContext)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Tauri Storage](https://tauri.app/v1/api/js/fs/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

### D. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-24 | Orchestrator | Initial master plan created |

---

**END OF MASTER PLAN**

This document serves as the single source of truth for the Relationship System Rebuild project. All agents, validation procedures, and progress tracking should reference this document.

**Location:** `/Users/jamesmcarthur/Documents/taskerino/docs/RELATIONSHIP_SYSTEM_MASTER_PLAN.md`
