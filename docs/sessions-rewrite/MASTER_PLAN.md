# Sessions System Rewrite - Master Plan

**Status**: Planning → Implementation
**Timeline**: 12-14 weeks (3 months)
**Start Date**: TBD
**Completion Target**: TBD

---

## Executive Summary

Complete redesign of the sessions recording, storage, enrichment, and review system to address:
- **Critical Safety Issues**: Memory leaks, race conditions, use-after-free in Rust/Swift FFI
- **Performance Problems**: UI blocking, poor scaling, memory bloat (300-500MB per session)
- **Cost Inefficiencies**: Redundant AI calls, suboptimal compression (can reduce 50%+)
- **Maintainability**: God objects (1161-line context), complex state (12+ refs), tight coupling

### Core Objectives
1. **Reliability**: Zero crashes, zero data loss, robust error recovery
2. **Performance**: 3-5x faster (< 1s load times, 60fps scrolling, < 150MB memory)
3. **Cost**: 50%+ AI cost reduction through smart deduplication and optimization
4. **Maintainability**: Clean architecture, clear separation of concerns, comprehensive tests

### What We're NOT Doing (Scope Boundaries)
- ❌ Not rewriting the entire app (only sessions subsystem)
- ❌ Not changing user-facing workflows (same UX, better internals)
- ❌ Not breaking backward compatibility until final migration (Week 14)
- ❌ Not optimizing for multi-window as THE priority (it's one of many features)

---

## Architecture Vision

### Current State (Problems)
```
SessionsContext (1161 lines, god object)
├── Recording Services (singleton classes with hidden state)
│   ├── Screenshots (manual scheduling, race conditions)
│   ├── Audio (buffer overruns, poor mixing)
│   └── Video (memory leaks, FFI safety issues)
├── Storage (monolithic sessions, no chunking, slow saves)
├── Enrichment (fire-and-forget, no resume, expensive)
└── Review (blocking loads, memory leaks, janky scrolling)
```

### Target State (Solution)
```
Session Orchestrator (State Machine + XState)
├── Recording Coordinator (health monitoring, error recovery)
│   ├── Video Stream (modular sources, safe FFI, compositing)
│   ├── Audio Graph (node-based, high-quality, robust)
│   └── Screenshot Stream (adaptive, deduplicated, efficient)
├── Chunked Storage (incremental, content-addressable, indexed)
├── Enrichment Pipeline (saga pattern, resumable, cost-optimized)
└── Review System (progressive loading, virtual timeline, efficient)
```

---

## Project Structure

### Phase Breakdown
- **Phase 1** (Weeks 1-2): Critical Fixes & Foundation
- **Phase 2** (Weeks 3-5): Swift Recording Rewrite
- **Phase 3** (Weeks 6-7): Audio Architecture
- **Phase 4** (Weeks 8-9): Storage Rewrite
- **Phase 5** (Weeks 10-11): Enrichment Optimization
- **Phase 6** (Week 12): Review & Playback
- **Phase 7** (Weeks 13-14): Testing & Launch

### Documentation Files
- `docs/sessions-rewrite/PHASE_*.md` - Detailed phase plans
- `docs/sessions-rewrite/AGENT_TASKS.md` - Agent delegation templates
- `docs/sessions-rewrite/PROGRESS.md` - Tracking and status
- `docs/sessions-rewrite/ARCHITECTURE.md` - Technical specifications
- `docs/sessions-rewrite/TESTING.md` - Test requirements

---

## Success Criteria

### Performance Metrics
- [ ] Session load time < 1 second (currently 5-10s)
- [ ] Timeline scrolling at 60fps (currently 15fps with lag)
- [ ] Memory usage < 150MB for 1-hour session (currently 300-500MB)
- [ ] Zero UI blocking during saves (currently 200-500ms freezes)

### Reliability Metrics
- [ ] Zero memory leaks (4-hour stress test passes)
- [ ] 99.9% enrichment success rate (currently ~95%)
- [ ] < 2% frame drop rate at 30fps (currently 5-10%)
- [ ] Zero race conditions (all state transitions tested)

### Cost Metrics
- [ ] 50%+ cost reduction per session (smart deduplication)
- [ ] Budget alerts prevent overages
- [ ] Lazy enrichment saves 40-60% (selective enrichment)

### Code Quality Metrics
- [ ] 80%+ test coverage
- [ ] SessionsContext < 400 lines (currently 1161)
- [ ] Zero refs in SessionsZone (currently 12+)
- [ ] All services stateless (pure functions + React hooks)

---

## Risk Management

### Technical Risks
1. **XState Learning Curve**: Team unfamiliar with state machines
   - **Mitigation**: Week 2 dedicated training, examples, documentation

2. **Swift/Rust FFI Complexity**: Safe wrappers are tricky
   - **Mitigation**: Prototype in Week 1, comprehensive tests, pair programming

3. **Data Migration**: 100GB+ of existing session data
   - **Mitigation**: Background migration, rollback capability, dual-write period

### Timeline Risks
1. **Phase 2 (Swift) is Critical Path**: Most complex work
   - **Mitigation**: 3 weeks allocated, can extend to Week 6 if needed

2. **Testing Underestimated**: May need more than 2 weeks
   - **Mitigation**: Continuous testing from Week 1, automated test runs

### Scope Risks
1. **Feature Creep**: Temptation to add new features
   - **Mitigation**: Strict scope freeze after Week 2, no new features until Week 14

---

## Agent Delegation Strategy

### Agent Roles
1. **Swift Specialist**: Handles Phase 2 (recording rewrite)
2. **Rust/FFI Specialist**: Handles Rust bridge, state machine, audio
3. **React/State Specialist**: Handles contexts, hooks, state management
4. **Storage Specialist**: Handles Phase 4 (storage rewrite)
5. **AI/Enrichment Specialist**: Handles Phase 5 (cost optimization)
6. **Performance Specialist**: Handles Phase 6 (review optimization)

### Agent Instructions Template
See `AGENT_TASKS.md` for detailed task templates with:
- Clear objectives and deliverables
- Required reading (documentation, existing code)
- Step-by-step implementation guide
- Quality checklist (must verify before completion)
- Test requirements (what to test, how to verify)

### Progress Tracking
- **Daily standups**: Each agent reports progress, blockers
- **Weekly reviews**: Check deliverables, adjust timeline
- **Quality gates**: No phase starts until previous phase passes review

---

## Next Steps

1. **Create detailed phase documents** (`PHASE_1.md` through `PHASE_7.md`)
2. **Create agent task templates** (`AGENT_TASKS.md`)
3. **Set up progress tracking** (`PROGRESS.md`)
4. **Write technical specifications** (`ARCHITECTURE.md`)
5. **Define test requirements** (`TESTING.md`)
6. **Create feature branch**: `rewrite/sessions-v2`
7. **Begin Phase 1**: Week 1 critical fixes

---

## Approval & Sign-Off

- [ ] User approves overall plan
- [ ] Timeline confirmed (12-14 weeks)
- [ ] Resources allocated (agents available)
- [ ] Feature branch created
- [ ] Documentation complete
- [ ] Ready to begin Phase 1

**Approved By**: ________________
**Date**: ________________
