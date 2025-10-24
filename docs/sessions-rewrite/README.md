# Sessions Rewrite Documentation

This directory contains comprehensive documentation for the Sessions System Rewrite project.

---

## Document Overview

### 📋 Master Plan
**File**: `/Users/jamesmcarthur/Documents/taskerino/SESSIONS_REWRITE.md`
**Purpose**: Executive summary, objectives, and high-level overview
**Audience**: Stakeholders, project managers
**Status**: ✅ Complete

### 🔧 Agent Task Guide
**File**: `AGENT_TASKS.md`
**Purpose**: Templates for delegating work to specialized agents
**Audience**: Lead architect, agent coordinators
**Status**: ✅ Complete
**Contents**:
- General agent instructions (mandatory reading, quality standards)
- Task template format
- Phase 1 detailed tasks (Tasks 1.1 - 1.7)
- Phase 2 detailed tasks (Tasks 2.1 - 2.10)
- Progress tracking templates
- Communication protocols
- Quality gates

### 📊 Progress Tracking
**File**: `PROGRESS.md`
**Purpose**: Live tracking of all tasks, metrics, and risks
**Audience**: Everyone (single source of truth for status)
**Status**: ✅ Initialized
**Contents**:
- Phase progress overview (0/85 tasks complete)
- Weekly status reports
- Individual task tracking
- Metrics dashboard (performance, cost, quality)
- Risk register
- Blockers and issues log
- Change log

### 🏗️ Architecture Specifications
**File**: `ARCHITECTURE.md`
**Purpose**: Technical specifications for all subsystems
**Audience**: Developers, agents (reference during implementation)
**Status**: ✅ Complete
**Contents**:
- System overview and component diagram
- Data models (SessionMetadata, chunks, attachments)
- State machines (XState specs)
- Storage architecture (chunked, content-addressable)
- Recording pipeline (Swift, Rust, TypeScript)
- Enrichment pipeline (saga pattern)
- Review system (progressive loading, virtual timeline)
- API specifications (Tauri commands)

### 📖 Phase Details
**Files**: `PHASE_1.md` through `PHASE_7.md`
**Purpose**: Week-by-week detailed breakdown of each phase
**Audience**: Agents executing specific phases
**Status**: ⏳ To be created
**Will contain**:
- Week-by-week task breakdown
- Dependencies and prerequisites
- Detailed implementation guides
- Testing requirements
- Success criteria

### 🧪 Testing Requirements
**File**: `TESTING.md`
**Purpose**: Comprehensive testing strategy and requirements
**Audience**: QA, developers, agents
**Status**: ⏳ To be created
**Will contain**:
- Unit test requirements (per component)
- Integration test scenarios
- Performance benchmarks
- Manual test checklists
- Test data setup
- CI/CD integration

---

## Quick Start for Agents

### Before Starting ANY Task

1. **Read Required Documentation** (in order):
   - `/Users/jamesmcarthur/Documents/taskerino/SESSIONS_REWRITE.md` (master plan)
   - `/Users/jamesmcarthur/Documents/taskerino/CLAUDE.md` (codebase guide)
   - `docs/sessions-rewrite/ARCHITECTURE.md` (technical specs)
   - `docs/sessions-rewrite/AGENT_TASKS.md` (task templates)
   - Your specific phase document (e.g., `PHASE_1.md`)

2. **Find Your Task**:
   - Check `PROGRESS.md` for task assignment
   - Read full task specification in `AGENT_TASKS.md`
   - Understand dependencies (what must complete first)

3. **Execute Task**:
   - Follow implementation steps exactly
   - Read ALL referenced files before changing code
   - Write tests as you go (not after)
   - Update `PROGRESS.md` as you work

4. **Complete Task**:
   - Run quality checklist (in task specification)
   - Write verification report
   - Update `PROGRESS.md` to ✅ Complete
   - Submit for code review

---

## Project Phases

### Phase 1: Critical Fixes & Foundation (Weeks 1-2)
**Status**: Not Started
**Tasks**: 12
- Week 1: Rust FFI safety, audio fixes, storage transactions
- Week 2: XState setup, context split, ref elimination, storage queue

### Phase 2: Swift Recording Rewrite (Weeks 3-5)
**Status**: Not Started
**Tasks**: 15
- Week 3: Extract Swift components, create protocols
- Week 4: Multi-window compositors, recording session orchestrator
- Week 5: New FFI layer, Rust + TypeScript integration

### Phase 3: Audio Architecture (Weeks 6-7)
**Status**: Not Started
**Tasks**: 10
- Week 6: Audio graph, high-quality resampling, buffer management
- Week 7: Per-app capture, gapless switching, dynamic range compression

### Phase 4: Storage Rewrite (Weeks 8-9)
**Status**: Not Started
**Tasks**: 12
- Week 8: Chunked storage, content-addressable attachments, indexes
- Week 9: Data migration, compression workers, LRU caching

### Phase 5: Enrichment Optimization (Weeks 10-11)
**Status**: Not Started
**Tasks**: 14
- Week 10: Saga pattern, worker-based processing, checkpointing
- Week 11: Adaptive model selection, deduplication, tiered plans, lazy enrichment

### Phase 6: Review & Playback (Week 12)
**Status**: Not Started
**Tasks**: 10
- Progressive audio loading, virtual timeline, Web Audio sync, memory management

### Phase 7: Testing & Launch (Weeks 13-14)
**Status**: Not Started
**Tasks**: 12
- Week 13: Integration tests, performance tests, stress tests
- Week 14: Documentation, polish, feature flag rollout

---

## Success Metrics

### Performance (Target vs Current)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Session load time | 5-10s | < 1s | 🔴 |
| Timeline scroll | 15fps | 60fps | 🔴 |
| Memory (1hr session) | 300-500MB | < 150MB | 🔴 |
| Save blocking | 200-500ms | 0ms | 🔴 |

### Reliability

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Memory leaks | Multiple | 0 | 🔴 |
| Enrichment success | ~95% | 99.9% | 🔴 |
| Frame drops | 5-10% | < 2% | 🔴 |
| Race conditions | Multiple | 0 | 🔴 |

### Cost

| Metric | Target | Status |
|--------|--------|--------|
| Cost per session | 50% reduction | 🔴 |
| Screenshot analysis | $0.002/img (from $0.004) | 🔴 |
| Lazy enrichment | 40-60% savings | 🔴 |

### Code Quality

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| SessionsContext LOC | 1161 | < 400 | 🔴 |
| Refs in SessionsZone | 12+ | 0 | 🔴 |
| Test coverage | ~30% | 80%+ | 🔴 |

---

## Communication Channels

### Daily Standup
- **When**: Every morning, 9:00 AM
- **Format**: See `AGENT_TASKS.md` → "Agent Communication Protocol"
- **Required**: All agents working on active tasks

### Weekly Review
- **When**: Every Friday, 3:00 PM
- **Purpose**: Review deliverables, adjust timeline, unblock issues
- **Required**: Lead architect, all agents

### Code Review
- **Process**: All tasks require code review before marking complete
- **Reviewers**: Lead architect (mandatory), peer agent (optional)
- **Criteria**: See quality checklist in task specification

---

## Important Links

### External Documentation
- [XState Documentation](https://xstate.js.org/docs/)
- [Tauri v2 Docs](https://v2.tauri.app/)
- [Swift ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit)
- [Rust FFI Nomicon](https://doc.rust-lang.org/nomicon/ffi.html)

### Internal References
- [CLAUDE.md](/Users/jamesmcarthur/Documents/taskerino/CLAUDE.md) - Codebase guide
- [Current SessionsContext](/Users/jamesmcarthur/Documents/taskerino/src/context/SessionsContext.tsx)
- [Current ScreenRecorder.swift](/Users/jamesmcarthur/Documents/taskerino/src-tauri/ScreenRecorder/ScreenRecorder.swift)
- [Current audio_capture.rs](/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio_capture.rs)

---

## Appendix: Document Checklist

### Documentation Completion Status

- [x] Master plan (`SESSIONS_REWRITE.md`)
- [x] Agent task guide (`AGENT_TASKS.md`)
- [x] Progress tracking (`PROGRESS.md`)
- [x] Architecture specs (`ARCHITECTURE.md`)
- [x] This README (`README.md`)
- [ ] Phase 1 details (`PHASE_1.md`)
- [ ] Phase 2 details (`PHASE_2.md`)
- [ ] Phase 3 details (`PHASE_3.md`)
- [ ] Phase 4 details (`PHASE_4.md`)
- [ ] Phase 5 details (`PHASE_5.md`)
- [ ] Phase 6 details (`PHASE_6.md`)
- [ ] Phase 7 details (`PHASE_7.md`)
- [ ] Testing requirements (`TESTING.md`)

### Next Actions
1. Create phase-specific documents (PHASE_1.md - PHASE_7.md)
2. Create testing requirements document (TESTING.md)
3. Get user approval on plan
4. Create feature branch `rewrite/sessions-v2`
5. Begin Phase 1 execution

---

**Last Updated**: 2024-XX-XX
**Maintained By**: Lead Architect
**Questions**: Refer to agent task templates or escalate to lead
