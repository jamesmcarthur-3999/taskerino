# Sessions V2 Rewrite - TODO List

**Last Updated**: October 24, 2025
**Overall Progress**: 37.5% (33/88 tasks complete)
**Status**: Phase 3 Wave 2 Ready to Execute

---

## 🚀 Immediate Actions (Right Now)

### Documentation Updates
- [x] Update PROGRESS.md with current status
- [x] Create CURRENT_STATUS.md executive summary
- [x] Create WAVE_2_KICKOFF_BRIEF.md for agents
- [x] Create TODO_LIST.md (this file)
- [ ] Update sessions-rewrite/README.md

### Parallel Execution Tracks
- [ ] **Phase 2 Manual E2E Testing** (30-60 min, QA specialist)
- [ ] **Phase 3 Task 3.2** (1.5-2 days, Rust/Audio Specialist #1)
- [ ] **Phase 3 Task 3.3** (1.5-2 days, Rust/Audio Specialist #2)

---

## 📋 Phase 2: Manual Testing

### Phase 2 E2E Test Checklist (30-60 min)
Reference: `PHASE_2_COMPLETE_FIX_SUMMARY.md`

- [ ] 1. Open SessionsZone
- [ ] 2. Click capture chevron → CaptureQuickSettings opens
- [ ] 3. Select 2 displays
- [ ] 4. Compositor options appear (Grid, Side-by-Side)
- [ ] 5. Select "Grid"
- [ ] 6. Close dropdown
- [ ] 7. Click "Start Session"
- [ ] 8. Recording starts
- [ ] 9. RecordingStats shows live frame counts
- [ ] 10. Frames increasing, drop rate shown
- [ ] 11. Click "Stop Session"
- [ ] 12. Video file saved
- [ ] 13. Session.video field populated
- [ ] 14. Session list shows completed session
- [ ] 15. Open session detail → video playable
- [ ] 16. Video shows grid layout with 2 displays

**Status**: ❌ NOT STARTED
**Owner**: QA/Testing Specialist
**Blocker**: None

---

## 📋 Phase 3: Audio Architecture (9/10 remaining)

### Wave 1: Architecture Design ✅ COMPLETE
- [x] **Task 3.1**: Audio Graph Architecture Design (Oct 24, 2025)
  - [x] AUDIO_GRAPH_ARCHITECTURE.md (2,114 lines)
  - [x] AUDIO_GRAPH_EXAMPLES.md (1,089 lines)
  - [x] Trait definitions (644 lines, 11 tests)
  - [x] Graph structure (671 lines, 10 tests)
  - [x] Prototype demo (471 lines, 7 tests)
  - [x] Verification report

---

### Wave 2: Foundation Implementation (Tasks 3.2-3.3)

**Status**: 🟡 READY TO START
**Can Run in Parallel**: YES
**Estimated**: 3-4 days (if parallel)

#### Task 3.2: Implement Sources Module
**Owner**: Rust/Audio Specialist #1
**Estimated**: 1.5-2 days
**Status**: ❌ NOT STARTED

**Implementation**:
- [ ] Read all required documentation (1-2 hours)
  - [ ] AUDIO_GRAPH_ARCHITECTURE.md (Section 3.3)
  - [ ] AUDIO_GRAPH_EXAMPLES.md (Example 1)
  - [ ] traits.rs (AudioSource trait)
  - [ ] audio_capture.rs (current implementation)
  - [ ] PHASE_3_EXECUTION_PLAN.md (lines 43-154)

- [ ] Create module structure (30 min)
  - [ ] src-tauri/src/audio/sources/mod.rs
  - [ ] src-tauri/src/audio/sources/microphone.rs
  - [ ] src-tauri/src/audio/sources/system_audio.rs
  - [ ] src-tauri/src/audio/sources/silence.rs

- [ ] Implement MicrophoneSource (4-5 hours)
  - [ ] Device enumeration
  - [ ] Ring buffer implementation
  - [ ] AudioSource trait implementation
  - [ ] Error handling
  - [ ] 8+ unit tests

- [ ] Implement SystemAudioSource (4-5 hours)
  - [ ] ScreenCaptureKit integration
  - [ ] Callback → buffer queue
  - [ ] AudioSource trait implementation
  - [ ] Error handling
  - [ ] 8+ unit tests

- [ ] Implement SilenceSource (1 hour)
  - [ ] Silent buffer generation
  - [ ] AudioSource trait implementation
  - [ ] 8+ unit tests

- [ ] Integration tests (2 hours)
  - [ ] Record 1s from MicrophoneSource
  - [ ] Record 1s from SystemAudioSource
  - [ ] Verify monotonic timestamps
  - [ ] Test simultaneous sources
  - [ ] 5+ integration tests

- [ ] Documentation & verification (1 hour)
  - [ ] Doc comments for all pub items
  - [ ] TASK_3.2_VERIFICATION_REPORT.md
  - [ ] Update PROGRESS.md

**Quality Gates**:
- [ ] 24+ unit tests passing
- [ ] 5+ integration tests passing
- [ ] 80%+ code coverage
- [ ] cargo check/clippy passes
- [ ] No memory leaks

**Deliverable**: ~1,300 lines (code + tests + docs)

---

#### Task 3.3: Implement Sinks Module
**Owner**: Rust/Audio Specialist #2
**Estimated**: 1.5-2 days
**Status**: ❌ NOT STARTED

**Implementation**:
- [ ] Read all required documentation (1-2 hours)
  - [ ] AUDIO_GRAPH_ARCHITECTURE.md (Section 3.5)
  - [ ] AUDIO_GRAPH_EXAMPLES.md (Examples 1, 2, 7)
  - [ ] traits.rs (AudioSink trait)
  - [ ] audio_capture.rs (WAV encoding)
  - [ ] PHASE_3_EXECUTION_PLAN.md (lines 158-267)

- [ ] Create module structure (30 min)
  - [ ] src-tauri/src/audio/sinks/mod.rs
  - [ ] src-tauri/src/audio/sinks/wav_encoder.rs
  - [ ] src-tauri/src/audio/sinks/buffer.rs
  - [ ] src-tauri/src/audio/sinks/null.rs

- [ ] Implement WavEncoderSink (5-6 hours)
  - [ ] hound crate integration
  - [ ] f32 and i16 format support
  - [ ] File creation and writing
  - [ ] Finalization logic
  - [ ] Error handling
  - [ ] 8+ unit tests

- [ ] Implement BufferSink (2 hours)
  - [ ] In-memory accumulation
  - [ ] Size limiting
  - [ ] Retrieval API
  - [ ] 8+ unit tests

- [ ] Implement NullSink (1 hour)
  - [ ] Discard logic
  - [ ] Stats tracking
  - [ ] 8+ unit tests

- [ ] Integration tests (2-3 hours)
  - [ ] Write 1000 buffers to WavEncoderSink
  - [ ] Verify WAV file validity
  - [ ] Verify file size
  - [ ] Test BufferSink accumulation
  - [ ] Test NullSink discarding
  - [ ] 6+ integration tests

- [ ] Documentation & verification (1 hour)
  - [ ] Doc comments for all pub items
  - [ ] TASK_3.3_VERIFICATION_REPORT.md
  - [ ] Update PROGRESS.md

**Quality Gates**:
- [ ] 24+ unit tests passing
- [ ] 6+ integration tests passing
- [ ] 80%+ code coverage
- [ ] cargo check/clippy passes
- [ ] No memory leaks
- [ ] WAV files playable externally

**Deliverable**: ~1,380 lines (code + tests + docs)

---

### Wave 3: Processor Implementations (Tasks 3.4-3.7)

**Status**: ❌ NOT STARTED
**Dependencies**: Wave 2 complete
**Estimated**: 4-5 days

#### Task 3.4: Implement Mixer Processor
**Owner**: Rust/Audio DSP Specialist #1
**Estimated**: 1-1.5 days
**Status**: ❌ NOT STARTED

- [ ] Read documentation
- [ ] Create processors module structure
- [ ] Implement Mixer (2-8 input sources)
- [ ] Configurable mix balance
- [ ] Format mismatch handling
- [ ] Peak limiting
- [ ] Unit tests (8+)
- [ ] Integration test (Mic + System → Mixer → WAV)
- [ ] Verification report
- [ ] Update PROGRESS.md

**Deliverable**: ~730 lines

---

#### Task 3.5: Implement Resampler Processor
**Owner**: Rust/Audio DSP Specialist #2
**Estimated**: 1.5-2 days
**Status**: ❌ NOT STARTED

- [ ] Read documentation
- [ ] Add rubato dependency
- [ ] Implement Resampler (wrap rubato)
- [ ] Support 16kHz, 44.1kHz, 48kHz
- [ ] Mono and stereo support
- [ ] Buffer alignment management
- [ ] Unit tests (10+)
- [ ] Quality tests (SNR, THD)
- [ ] Verification report
- [ ] Update PROGRESS.md

**Deliverable**: ~700 lines

---

#### Task 3.6: Implement Utility Processors
**Owner**: Rust/Audio Specialist
**Estimated**: 1 day
**Status**: ❌ NOT STARTED

- [ ] Read documentation
- [ ] Implement VolumeControl (2 hours)
- [ ] Implement SilenceDetector/VAD (3 hours)
- [ ] Implement Normalizer (2 hours)
- [ ] Unit tests for each (2 hours)
- [ ] Verification report
- [ ] Update PROGRESS.md

**Deliverable**: ~780 lines

---

#### Task 3.7: Integration Testing & Benchmarks
**Owner**: QA/Performance Specialist
**Estimated**: 1 day
**Status**: ❌ NOT STARTED
**Dependencies**: Tasks 3.4-3.6 complete

- [ ] Full graph integration tests (3-4 hours)
  - [ ] Dual-source recording test
  - [ ] Resampling pipeline test
  - [ ] Multi-format output test
  - [ ] Error recovery scenarios

- [ ] Performance benchmarks (2-3 hours)
  - [ ] CPU usage measurement
  - [ ] Memory tracking
  - [ ] Latency profiling
  - [ ] Compare with old implementation

- [ ] Stress tests (2 hours)
  - [ ] 1-hour continuous recording
  - [ ] Multiple simultaneous graphs
  - [ ] Rapid start/stop cycles
  - [ ] Resource cleanup verification

- [ ] Verification report & comparison
- [ ] Update PROGRESS.md

**Deliverable**: ~600 lines

---

### Wave 4: Integration & Migration (Tasks 3.8-3.10)

**Status**: ❌ NOT STARTED
**Dependencies**: Wave 3 complete
**Estimated**: 3-4 days (sequential)

#### Task 3.8: Create Backward-Compatible Wrapper
**Owner**: Rust/Integration Specialist
**Estimated**: 1.5-2 days
**Status**: ❌ NOT STARTED

- [ ] Read migration documentation
- [ ] Deprecate old implementation
- [ ] Create wrapper struct
- [ ] Map old API to new graph
- [ ] Migration guide
- [ ] Testing (all existing tests pass)
- [ ] Verification report
- [ ] Update PROGRESS.md

**Deliverable**: ~500 lines

---

#### Task 3.9: End-to-End Testing
**Owner**: QA Specialist
**Estimated**: 1 day
**Status**: ❌ NOT STARTED
**Dependencies**: Task 3.8 complete

- [ ] Backend E2E tests (3 hours)
- [ ] TypeScript integration tests (2 hours)
- [ ] Manual testing checklist (3 hours)
- [ ] Test on all macOS versions
- [ ] Verification report
- [ ] Update PROGRESS.md

**Deliverable**: ~300 lines

---

#### Task 3.10: Documentation & Cleanup
**Owner**: Documentation Specialist
**Estimated**: 1 day
**Status**: ❌ NOT STARTED
**Dependencies**: Tasks 3.8-3.9 complete

- [ ] Update PROGRESS.md (mark Phase 3 complete)
- [ ] Update CLAUDE.md (audio section)
- [ ] Update ARCHITECTURE.md
- [ ] Create PHASE_3_SUMMARY.md
- [ ] Code cleanup (formatting, TODOs)
- [ ] Final verification
- [ ] Ready for Phase 4

**Deliverable**: Updated documentation

---

## 📋 Phase 4: Storage Rewrite (0/12 tasks)

**Status**: ❌ NOT STARTED
**Dependencies**: Phase 3 complete
**Estimated**: 8-9 days

### Week 8: Core Storage
- [ ] Task 4.1: Chunked session storage
- [ ] Task 4.2: Content-addressable attachments
- [ ] Task 4.3: Inverted indexes
- [ ] Task 4.4: Storage queue optimization
- [ ] Task 4.5: Compression workers
- [ ] Task 4.6: LRU cache

### Week 9: Migration & Polish
- [ ] Task 4.7: Data migration tools
- [ ] Task 4.8: Background migration
- [ ] Task 4.9: Rollback mechanism
- [ ] Task 4.10: Storage benchmarks
- [ ] Task 4.11: Integration testing
- [ ] Task 4.12: Documentation

---

## 📋 Phase 5: Enrichment Optimization (0/14 tasks)

**Status**: ❌ NOT STARTED
**Dependencies**: Phase 4 complete
**Estimated**: 10-11 days

### Week 10: Saga Pattern
- [ ] Task 5.1: Saga pattern implementation
- [ ] Task 5.2: Worker-based processing
- [ ] Task 5.3: Checkpointing system
- [ ] Task 5.4: Resume capabilities
- [ ] Task 5.5: Cost tracking
- [ ] Task 5.6: Lock management
- [ ] Task 5.7: Integration testing

### Week 11: Optimizations
- [ ] Task 5.8: Adaptive model selection
- [ ] Task 5.9: Screenshot deduplication
- [ ] Task 5.10: Tiered enrichment plans
- [ ] Task 5.11: Lazy enrichment
- [ ] Task 5.12: Batch processing
- [ ] Task 5.13: Performance testing
- [ ] Task 5.14: Documentation

---

## 📋 Phase 6: Review & Playback (0/10 tasks)

**Status**: ❌ NOT STARTED
**Dependencies**: Phase 5 complete
**Estimated**: 5-6 days

### Week 12: Progressive Loading
- [ ] Task 6.1: Progressive audio loader
- [ ] Task 6.2: Virtual timeline component
- [ ] Task 6.3: Web Audio sync
- [ ] Task 6.4: Playback controls
- [ ] Task 6.5: Seek optimization
- [ ] Task 6.6: Memory management
- [ ] Task 6.7: Thumbnail generation
- [ ] Task 6.8: Performance optimization
- [ ] Task 6.9: Integration testing
- [ ] Task 6.10: Documentation

---

## 📋 Phase 7: Testing & Launch (8/12 remaining)

**Status**: ⚠️ PARTIAL (4/12 complete)
**Dependencies**: Phases 1-6 complete
**Estimated**: 6-7 days remaining

### Week 13: Testing
- [x] Task 7.1: Master plan documentation ✅
- [x] Task 7.2: Agent task templates ✅
- [x] Task 7.3: Progress tracking ✅
- [x] Task 7.4: Architecture specs ✅
- [ ] Task 7.5: Integration test suite
- [ ] Task 7.6: Performance test suite
- [ ] Task 7.7: Stress test suite
- [ ] Task 7.8: Manual testing checklist

### Week 14: Launch
- [ ] Task 7.9: Final documentation
- [ ] Task 7.10: Migration guide for users
- [ ] Task 7.11: Feature flag rollout
- [ ] Task 7.12: Production deployment

---

## 📊 Summary Statistics

### Overall Progress
- **Total Tasks**: 88
- **Completed**: 33 (37.5%)
- **In Progress**: 0
- **Not Started**: 55 (62.5%)

### By Phase
| Phase | Complete | Total | % |
|-------|----------|-------|---|
| Phase 1 | 12 | 12 | 100% |
| Phase 2 | 16 | 16 | 100% |
| Phase 3 | 1 | 10 | 10% |
| Phase 4 | 0 | 12 | 0% |
| Phase 5 | 0 | 14 | 0% |
| Phase 6 | 0 | 10 | 0% |
| Phase 7 | 4 | 12 | 33% |

### Timeline Estimate
- **Phase 3 remaining**: 10-13 days
- **Phases 4-7 remaining**: 29-33 days
- **Total remaining**: 39-46 days

---

## 🎯 Next Milestones

### This Week (Phase 3 Wave 2)
- [ ] Complete Phase 2 manual testing
- [ ] Complete Task 3.2 (Sources Module)
- [ ] Complete Task 3.3 (Sinks Module)
- [ ] Ready for Wave 3

### Next Week (Phase 3 Wave 3)
- [ ] Complete Tasks 3.4-3.7 (Processors)
- [ ] Performance benchmarking
- [ ] Ready for Wave 4

### Week After (Phase 3 Wave 4)
- [ ] Complete Tasks 3.8-3.10 (Integration)
- [ ] Phase 3 complete (100%)
- [ ] Ready for Phase 4

---

## 📝 Notes

- All tasks have detailed specifications in PHASE_3_EXECUTION_PLAN.md
- Wave 2 can start immediately (no blockers)
- Wave 3 depends on Wave 2 completion
- Manual testing runs in parallel (non-blocking)

---

**Last Updated**: October 24, 2025
**Maintained By**: Lead Architect / Project Manager
**Next Review**: After Wave 2 completion
