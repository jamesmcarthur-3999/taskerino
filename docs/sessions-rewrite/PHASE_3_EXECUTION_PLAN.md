# Phase 3 Execution Plan: Audio Architecture Implementation

**Status**: Ready to Execute
**Current Progress**: 10% (1/10 tasks complete)
**Estimated Time**: 12-15 days
**Last Updated**: 2025-10-24

---

## Executive Summary

**Task 3.1 (Audio Graph Architecture Design) is ✅ COMPLETE** (October 24, 2025)
- Comprehensive architecture with 4,989 lines of design, documentation, and prototype code
- All trait definitions, graph structure, and examples ready for implementation
- 9 remaining tasks organized into 3 waves for parallel execution

**Execution Strategy**:
- **Wave 2** (Tasks 3.2-3.3): Foundation implementation - 2 tasks in parallel (3-4 days)
- **Wave 3** (Tasks 3.4-3.7): Source/Sink implementations - 4 tasks in parallel (4-5 days)
- **Wave 4** (Tasks 3.8-3.10): Integration and testing - 3 tasks sequential (3-4 days)

**Total Estimated Time**: 10-13 days (can be compressed with parallel execution)

---

## Wave 2: Foundation Implementation (Tasks 3.2-3.3)

### ✅ Task 3.1: Audio Graph Architecture Design
**Status**: COMPLETE
**Completed**: October 24, 2025
**Agent**: Audio Architecture Specialist
**Time**: 4 hours
**Deliverables**:
- ✅ AUDIO_GRAPH_ARCHITECTURE.md (2,114 lines)
- ✅ AUDIO_GRAPH_EXAMPLES.md (1,089 lines)
- ✅ src-tauri/src/audio/graph/traits.rs (644 lines, 11 tests)
- ✅ src-tauri/src/audio/graph/mod.rs (671 lines, 10 tests)
- ✅ src-tauri/src/audio/graph/prototype_demo.rs (471 lines, 7 tests)
- ✅ TASK_3.1_VERIFICATION_REPORT.md

---

### ❌ Task 3.2: Implement Core Traits (Sources Module)

**Agent Type**: Rust/Audio Specialist
**Estimated Time**: 1.5-2 days
**Priority**: HIGH
**Status**: NOT STARTED
**Can Start**: YES (no dependencies)

#### Objective
Extract existing audio sources from audio_capture.rs into the new graph-based architecture. Create MicrophoneSource and SystemAudioSource implementations using existing code.

#### Required Reading
**MUST read BEFORE starting**:
1. `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/AUDIO_GRAPH_ARCHITECTURE.md` (Section 3.3: AudioSource Trait)
2. `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/AUDIO_GRAPH_EXAMPLES.md` (Example 1: Dual-Source)
3. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio/graph/traits.rs` (AudioSource trait definition)
4. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio_capture.rs` (lines 1-400, current implementation)
5. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/macos_audio.rs` (macOS system audio capture)

#### Implementation Steps

**Step 1: Create sources module structure** (30 min)
```bash
mkdir -p src-tauri/src/audio/sources
touch src-tauri/src/audio/sources/mod.rs
touch src-tauri/src/audio/sources/microphone.rs
touch src-tauri/src/audio/sources/system_audio.rs
touch src-tauri/src/audio/sources/silence.rs  # For testing
```

**Step 2: Implement MicrophoneSource** (4-5 hours)
- File: `src-tauri/src/audio/sources/microphone.rs`
- Use `cpal` crate (already in dependencies)
- Extract microphone capture logic from `audio_capture.rs:150-280`
- Implement AudioSource trait with proper state management
- Ring buffer using `Arc<Mutex<VecDeque<AudioBuffer>>>`
- Add device enumeration and selection
- Handle device errors gracefully

**Step 3: Implement SystemAudioSource (macOS)** (4-5 hours)
- File: `src-tauri/src/audio/sources/system_audio.rs`
- Platform-specific: Use existing `macos_audio.rs` code
- Wrap ScreenCaptureKit audio capture
- Convert to AudioSource trait interface
- Handle ScreenCaptureKit callback → buffer queue
- Add fallback for older macOS versions

**Step 4: Implement SilenceSource for testing** (1 hour)
- File: `src-tauri/src/audio/sources/silence.rs`
- Generate silent audio buffers at specified rate
- Useful for testing graph topology without hardware

**Step 5: Update mod.rs exports** (30 min)
- File: `src-tauri/src/audio/sources/mod.rs`
- Export all sources
- Add platform-specific conditional compilation
- Add factory functions for platform-appropriate sources

#### Testing Requirements

**Unit Tests** (in each source file):
- [ ] Test source creation with valid device
- [ ] Test source creation with invalid device (should error)
- [ ] Test start/stop lifecycle
- [ ] Test buffer production (read() returns Some after start)
- [ ] Test format() returns correct AudioFormat
- [ ] Test stats() tracking (buffers produced, overruns)
- [ ] Test double-start prevention
- [ ] Test graceful cleanup on drop

**Integration Tests** (in `src-tauri/tests/audio_sources_test.rs`):
- [ ] Record 1 second from MicrophoneSource
- [ ] Record 1 second from SystemAudioSource
- [ ] Verify buffer timestamps are monotonic
- [ ] Verify no buffer overruns with proper read rate
- [ ] Test simultaneous sources (mic + system)

**Target Coverage**: 80%+ for source implementations

#### Quality Checklist
- [ ] All required reading completed (5 documents)
- [ ] MicrophoneSource implements AudioSource trait
- [ ] SystemAudioSource implements AudioSource trait
- [ ] SilenceSource implements AudioSource trait (test helper)
- [ ] All sources are Send + Sync
- [ ] All unit tests passing (minimum 8 tests per source)
- [ ] Integration tests passing
- [ ] cargo check passes (0 errors)
- [ ] cargo clippy passes (0 warnings in new code)
- [ ] No memory leaks (verify with Instruments on macOS)
- [ ] Documentation added (doc comments for all public items)
- [ ] Error handling comprehensive (no unwrap/expect in public API)

#### Completion Criteria
1. Three source files created and building
2. All sources implement AudioSource trait
3. Unit tests: 24+ tests passing (8 per source × 3 sources)
4. Integration tests: 5 tests passing
5. Code coverage: 80%+ measured by cargo-tally
6. Documentation complete (all pub items have doc comments)
7. Verification report written (TASK_3.2_VERIFICATION_REPORT.md)

#### Deliverables
- `src-tauri/src/audio/sources/mod.rs` (~50 lines)
- `src-tauri/src/audio/sources/microphone.rs` (~300 lines)
- `src-tauri/src/audio/sources/system_audio.rs` (~250 lines)
- `src-tauri/src/audio/sources/silence.rs` (~100 lines)
- Unit tests in each file (~400 lines total)
- `src-tauri/tests/audio_sources_test.rs` (~200 lines)
- `docs/sessions-rewrite/TASK_3.2_VERIFICATION_REPORT.md`

**Estimated Total LOC**: ~1,300 lines

---

### ❌ Task 3.3: Implement Sinks Module

**Agent Type**: Rust/Audio Specialist
**Estimated Time**: 1.5-2 days
**Priority**: HIGH
**Status**: NOT STARTED
**Can Start**: YES (no dependencies - can run in parallel with Task 3.2)

#### Objective
Implement audio sink nodes for encoding recorded audio to various formats. Start with WAV encoding (primary format) and add BufferSink for testing.

#### Required Reading
**MUST read BEFORE starting**:
1. `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/AUDIO_GRAPH_ARCHITECTURE.md` (Section 3.5: AudioSink Trait)
2. `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/AUDIO_GRAPH_EXAMPLES.md` (Example 1, 2, 7)
3. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio/graph/traits.rs` (AudioSink trait definition)
4. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio_capture.rs` (lines 400-600, WAV encoding)
5. `hound` crate documentation: https://docs.rs/hound/latest/hound/

#### Implementation Steps

**Step 1: Create sinks module structure** (30 min)
```bash
mkdir -p src-tauri/src/audio/sinks
touch src-tauri/src/audio/sinks/mod.rs
touch src-tauri/src/audio/sinks/wav_encoder.rs
touch src-tauri/src/audio/sinks/buffer.rs
touch src-tauri/src/audio/sinks/null.rs
```

**Step 2: Implement WavEncoderSink** (5-6 hours)
- File: `src-tauri/src/audio/sinks/wav_encoder.rs`
- Use `hound` crate (already in dependencies)
- Extract WAV encoding logic from `audio_capture.rs`
- Implement AudioSink trait
- Support multiple sample formats (f32, i16)
- Handle file creation, writing, and finalization
- Track samples written, file size

**Step 3: Implement BufferSink** (2 hours)
- File: `src-tauri/src/audio/sinks/buffer.rs`
- Accumulates buffers in memory (Vec<AudioBuffer>)
- Useful for testing and preview
- Limit max size to prevent OOM
- Provide API to retrieve accumulated buffers

**Step 4: Implement NullSink** (1 hour)
- File: `src-tauri/src/audio/sinks/null.rs`
- Discards all buffers (for benchmarking)
- Tracks throughput stats

**Step 5: Update mod.rs exports** (30 min)
- Export all sinks
- Add helper functions for common configurations

#### Testing Requirements

**Unit Tests** (in each sink file):
- [ ] Test sink creation with valid path
- [ ] Test sink creation with invalid path (should error)
- [ ] Test write() accepts buffers
- [ ] Test flush() writes all data
- [ ] Test close() finalizes file
- [ ] Test stats() tracking
- [ ] Test double-close prevention
- [ ] Test error handling (disk full, permission denied)

**Integration Tests** (in `src-tauri/tests/audio_sinks_test.rs`):
- [ ] Write 1000 buffers to WavEncoderSink
- [ ] Verify output file is valid WAV
- [ ] Verify file size matches expected
- [ ] Verify audio samples are correct (no corruption)
- [ ] Test BufferSink accumulation
- [ ] Test NullSink discards correctly

**Target Coverage**: 80%+

#### Quality Checklist
- [ ] All required reading completed
- [ ] WavEncoderSink implements AudioSink trait
- [ ] BufferSink implements AudioSink trait
- [ ] NullSink implements AudioSink trait
- [ ] All sinks are Send + Sync
- [ ] Unit tests passing (8+ per sink = 24+ tests)
- [ ] Integration tests passing (6+ tests)
- [ ] cargo check/clippy passes
- [ ] No memory leaks
- [ ] Documentation complete
- [ ] Error handling comprehensive

#### Completion Criteria
1. Three sink files created and building
2. All sinks implement AudioSink trait
3. Unit tests: 24+ passing
4. Integration tests: 6+ passing
5. Coverage: 80%+
6. Can write valid WAV files verified by external player
7. Verification report written

#### Deliverables
- `src-tauri/src/audio/sinks/mod.rs` (~50 lines)
- `src-tauri/src/audio/sinks/wav_encoder.rs` (~350 lines)
- `src-tauri/src/audio/sinks/buffer.rs` (~150 lines)
- `src-tauri/src/audio/sinks/null.rs` (~80 lines)
- Unit tests (~500 lines total)
- `src-tauri/tests/audio_sinks_test.rs` (~250 lines)
- `docs/sessions-rewrite/TASK_3.3_VERIFICATION_REPORT.md`

**Estimated Total LOC**: ~1,380 lines

---

## Wave 2 Summary

**Tasks**: 2 (Tasks 3.2-3.3)
**Can Run in Parallel**: YES
**Dependencies**: Both depend on Task 3.1 (complete)
**Estimated Time**: 3-4 days (if run in parallel)
**Deliverables**: Sources and Sinks modules (~2,680 lines of code + tests)

**Agents Required**:
- Rust/Audio Specialist #1 (Task 3.2)
- Rust/Audio Specialist #2 (Task 3.3)

**Wave 2 Completion Criteria**:
- [ ] All sources module complete (MicrophoneSource, SystemAudioSource, SilenceSource)
- [ ] All sinks module complete (WavEncoderSink, BufferSink, NullSink)
- [ ] 48+ unit tests passing
- [ ] 11+ integration tests passing
- [ ] 80%+ code coverage
- [ ] 2 verification reports created

---

## Wave 3: Processor Implementations (Tasks 3.4-3.7)

### ❌ Task 3.4: Implement Mixer Processor

**Agent Type**: Rust/Audio DSP Specialist
**Estimated Time**: 1-1.5 days
**Priority**: CRITICAL (required for dual-source recording)
**Status**: NOT STARTED
**Dependencies**: Tasks 3.2 and 3.3 (needs sources and sinks for testing)

#### Objective
Implement the Mixer processor that combines multiple audio sources into a single stream. This is critical for the current dual-source recording use case (microphone + system audio).

#### Required Reading
1. AUDIO_GRAPH_ARCHITECTURE.md (Section 3.4: AudioProcessor Trait)
2. AUDIO_GRAPH_EXAMPLES.md (Example 1: Dual-Source Recording)
3. src-tauri/src/audio_capture.rs (lines 300-400, current mixing logic)
4. traits.rs (AudioProcessor trait definition)

#### Implementation Steps

**Step 1: Create processors module** (30 min)
```bash
mkdir -p src-tauri/src/audio/processors
touch src-tauri/src/audio/processors/mod.rs
touch src-tauri/src/audio/processors/mixer.rs
```

**Step 2: Implement Mixer** (4-5 hours)
- File: `src-tauri/src/audio/processors/mixer.rs`
- Support 2-8 input sources
- Configurable mix balance (0-100 per source)
- Handles format mismatches (auto-resample if needed)
- Peak limiting (prevent clipping)
- Mix algorithms: sum, average, weighted

**Step 3: Add tests** (2-3 hours)
- Unit tests for mix algorithms
- Integration test: MicSource + SystemSource → Mixer → WavSink

#### Deliverables
- `src-tauri/src/audio/processors/mod.rs` (~30 lines)
- `src-tauri/src/audio/processors/mixer.rs` (~400 lines)
- Unit tests (~200 lines)
- Integration test (~100 lines)
- `docs/sessions-rewrite/TASK_3.4_VERIFICATION_REPORT.md`

**Estimated Total LOC**: ~730 lines

---

### ❌ Task 3.5: Implement Resampler Processor

**Agent Type**: Rust/Audio DSP Specialist
**Estimated Time**: 1.5-2 days
**Priority**: HIGH
**Status**: NOT STARTED
**Dependencies**: Tasks 3.2 and 3.3

#### Objective
Implement high-quality resampling for converting between sample rates (e.g., 16kHz → 48kHz or vice versa). This is needed when mixing sources with different sample rates.

#### Required Reading
1. AUDIO_GRAPH_ARCHITECTURE.md (Section 3.4: AudioProcessor, Section 7.1: Performance)
2. `rubato` crate documentation: https://docs.rs/rubato/latest/rubato/
3. traits.rs (AudioProcessor trait)

#### Implementation Steps

**Step 1: Add rubato dependency** (15 min)
- Update Cargo.toml
- Add rubato = "0.14"

**Step 2: Implement Resampler** (6-8 hours)
- File: `src-tauri/src/audio/processors/resampler.rs`
- Wrap rubato's FftFixedInOut resampler
- Support common rates: 16kHz, 44.1kHz, 48kHz
- Handle mono and stereo
- Manage input/output buffer alignment
- Track resampling quality (latency, CPU usage)

**Step 3: Add tests** (2-3 hours)
- Test all rate combinations
- Verify output length is correct
- Measure quality (SNR, THD)

#### Deliverables
- `src-tauri/src/audio/processors/resampler.rs` (~450 lines)
- Unit tests (~250 lines)
- `docs/sessions-rewrite/TASK_3.5_VERIFICATION_REPORT.md`

**Estimated Total LOC**: ~700 lines

---

### ❌ Task 3.6: Implement Basic Utility Processors

**Agent Type**: Rust/Audio Specialist
**Estimated Time**: 1 day
**Priority**: MEDIUM
**Status**: NOT STARTED
**Dependencies**: Tasks 3.2 and 3.3

#### Objective
Implement simple utility processors: VolumeControl, SilenceDetector (VAD), and Normalizer.

#### Implementation Steps

**Step 1: VolumeControl** (2 hours)
- File: `src-tauri/src/audio/processors/volume.rs`
- Simple gain multiplication
- dB conversion helpers
- Smooth gain ramping (avoid clicks)

**Step 2: SilenceDetector (VAD)** (3 hours)
- File: `src-tauri/src/audio/processors/vad.rs`
- RMS-based silence detection
- Configurable threshold
- Min silence duration (avoid false positives)
- Useful for cost optimization (skip silent segments)

**Step 3: Normalizer** (2 hours)
- File: `src-tauri/src/audio/processors/normalizer.rs`
- Peak normalization to target level
- Look-ahead buffer for true peak detection

**Step 4: Tests** (2 hours)
- Unit tests for each processor

#### Deliverables
- `volume.rs` (~150 lines)
- `vad.rs` (~200 lines)
- `normalizer.rs` (~180 lines)
- Tests (~250 lines)
- `docs/sessions-rewrite/TASK_3.6_VERIFICATION_REPORT.md`

**Estimated Total LOC**: ~780 lines

---

### ❌ Task 3.7: Integration Testing and Performance Benchmarks

**Agent Type**: QA/Performance Specialist
**Estimated Time**: 1 day
**Priority**: HIGH
**Status**: NOT STARTED
**Dependencies**: Tasks 3.2-3.6 (all previous Wave 3 tasks)

#### Objective
Create comprehensive integration tests and performance benchmarks for the complete audio graph system.

#### Implementation Steps

**Step 1: Full graph integration tests** (3-4 hours)
- Test dual-source recording (mic + system → mixer → WAV)
- Test resampling pipeline
- Test multi-format output
- Test error recovery scenarios

**Step 2: Performance benchmarks** (2-3 hours)
- CPU usage measurement
- Memory usage tracking
- Latency profiling
- Compare with old audio_capture.rs performance

**Step 3: Stress tests** (2 hours)
- 1-hour continuous recording
- Multiple simultaneous graphs
- Rapid start/stop cycles
- Resource cleanup verification

#### Deliverables
- `src-tauri/tests/audio_graph_integration.rs` (~400 lines)
- `src-tauri/benches/audio_graph_bench.rs` (~200 lines)
- `docs/sessions-rewrite/TASK_3.7_VERIFICATION_REPORT.md`
- Performance comparison report

**Estimated Total LOC**: ~600 lines

---

## Wave 3 Summary

**Tasks**: 4 (Tasks 3.4-3.7)
**Can Run in Parallel**: Partially (3.4-3.6 parallel, 3.7 depends on all)
**Dependencies**: All depend on Wave 2 completion
**Estimated Time**: 4-5 days
**Deliverables**: Processors module + comprehensive testing (~2,810 lines)

**Agents Required**:
- Rust/Audio DSP Specialist #1 (Task 3.4)
- Rust/Audio DSP Specialist #2 (Task 3.5)
- Rust/Audio Specialist (Task 3.6)
- QA/Performance Specialist (Task 3.7)

**Wave 3 Completion Criteria**:
- [ ] Mixer processor complete and tested
- [ ] Resampler processor complete and tested
- [ ] Utility processors complete and tested
- [ ] Integration tests passing (10+ tests)
- [ ] Performance benchmarks complete
- [ ] CPU overhead < 10% verified
- [ ] 4 verification reports created

---

## Wave 4: Integration and Migration (Tasks 3.8-3.10)

### ❌ Task 3.8: Create Backward-Compatible Wrapper

**Agent Type**: Rust/Integration Specialist
**Estimated Time**: 1.5-2 days
**Priority**: CRITICAL
**Status**: NOT STARTED
**Dependencies**: All Wave 3 tasks complete

#### Objective
Update audio_capture.rs to use the new audio graph internally while maintaining the existing API. This ensures zero breaking changes during migration.

#### Required Reading
1. AUDIO_GRAPH_ARCHITECTURE.md (Section 9: Migration Path)
2. src-tauri/src/audio_capture.rs (entire file, understand current API)
3. All graph implementation files (understand new API)

#### Implementation Steps

**Step 1: Deprecate old implementation** (1 hour)
- Add #[deprecated] attributes to old AudioRecorder methods
- Add doc comments pointing to new graph API

**Step 2: Create wrapper struct** (4-5 hours)
- Keep AudioRecorder struct name
- Replace internals with AudioGraph
- Map old API calls to new graph operations
- Preserve all existing behavior

**Step 3: Migration guide** (2 hours)
- Document API differences
- Provide migration examples
- Update CLAUDE.md

**Step 4: Testing** (3-4 hours)
- Verify all existing audio tests still pass
- No behavior changes
- No performance regression

#### Deliverables
- Updated `src-tauri/src/audio_capture.rs` (~300 lines modified)
- `docs/sessions-rewrite/AUDIO_MIGRATION_GUIDE.md` (~200 lines)
- Updated `CLAUDE.md` (audio section)
- `docs/sessions-rewrite/TASK_3.8_VERIFICATION_REPORT.md`

**Estimated Total LOC**: ~500 lines

---

### ❌ Task 3.9: End-to-End Testing

**Agent Type**: QA Specialist
**Estimated Time**: 1 day
**Priority**: CRITICAL
**Status**: NOT STARTED
**Dependencies**: Task 3.8 complete

#### Objective
Verify the complete audio recording pipeline works end-to-end through the Tauri command interface and TypeScript integration.

#### Implementation Steps

**Step 1: Backend E2E tests** (3 hours)
- Test Tauri commands with new graph backend
- Verify audio file creation
- Verify file format correctness
- Test error scenarios

**Step 2: TypeScript integration tests** (2 hours)
- Test audioRecordingService.ts still works
- Test session recording with audio
- Verify audio attachment creation

**Step 3: Manual testing checklist** (3 hours)
- Record test session with audio
- Verify playback works
- Verify enrichment works
- Test on all supported macOS versions

#### Deliverables
- `src-tauri/tests/audio_e2e.rs` (~300 lines)
- Manual testing checklist
- Test recording samples
- `docs/sessions-rewrite/TASK_3.9_VERIFICATION_REPORT.md`

**Estimated Total LOC**: ~300 lines

---

### ❌ Task 3.10: Documentation and Cleanup

**Agent Type**: Documentation Specialist
**Estimated Time**: 1 day
**Priority**: MEDIUM
**Status**: NOT STARTED
**Dependencies**: Tasks 3.8-3.9 complete

#### Objective
Finalize all documentation, clean up code, and prepare Phase 3 completion summary.

#### Implementation Steps

**Step 1: Update all documentation** (3 hours)
- Update PROGRESS.md (mark Phase 3 complete)
- Update CLAUDE.md (audio architecture section)
- Update ARCHITECTURE.md (mark audio complete)
- Create PHASE_3_SUMMARY.md

**Step 2: Code cleanup** (2 hours)
- Remove old commented code
- Consistent formatting
- Final clippy/fmt pass

**Step 3: Verification** (2 hours)
- All tests passing
- All docs accurate
- No TODOs remaining
- Ready for Phase 4

#### Deliverables
- Updated `PROGRESS.md`
- Updated `CLAUDE.md`
- Updated `ARCHITECTURE.md`
- New `PHASE_3_SUMMARY.md` (~300 lines)
- `docs/sessions-rewrite/TASK_3.10_VERIFICATION_REPORT.md`

---

## Wave 4 Summary

**Tasks**: 3 (Tasks 3.8-3.10)
**Can Run in Parallel**: NO (sequential dependencies)
**Dependencies**: All Wave 3 tasks complete
**Estimated Time**: 3-4 days (sequential)
**Deliverables**: Migration wrapper, E2E tests, documentation (~1,100 lines)

**Wave 4 Completion Criteria**:
- [ ] AudioRecorder wrapper complete (no breaking changes)
- [ ] All E2E tests passing
- [ ] Manual testing checklist complete
- [ ] All documentation updated
- [ ] Phase 3 marked 100% complete
- [ ] 3 verification reports created

---

## Overall Phase 3 Summary

### Progress
- **Complete**: Task 3.1 (10%)
- **Remaining**: Tasks 3.2-3.10 (90%)
- **Total Estimated Time**: 10-13 days

### Execution Timeline

| Wave | Tasks | Agents | Duration | Start After |
|------|-------|--------|----------|-------------|
| Wave 1 | 3.1 | 1 | ✅ COMPLETE | - |
| Wave 2 | 3.2-3.3 | 2 parallel | 3-4 days | Wave 1 ✅ |
| Wave 3 | 3.4-3.7 | 4 (3 parallel, 1 sequential) | 4-5 days | Wave 2 |
| Wave 4 | 3.8-3.10 | 3 sequential | 3-4 days | Wave 3 |

**Critical Path**: Wave 1 → Wave 2 → Wave 3 (Tasks 3.4-3.6) → Task 3.7 → Wave 4 (sequential)

### Resource Requirements

**Agents Needed**:
- Wave 2: 2 Rust/Audio Specialists (parallel)
- Wave 3: 4 specialists (3 parallel + 1 sequential)
- Wave 4: 3 specialists (sequential)

**Maximum Parallelism**: 4 agents (during Wave 3, Tasks 3.4-3.6)

### Quality Gates

**Wave 2 Exit Criteria**:
- [ ] All sources and sinks implement correct traits
- [ ] 48+ unit tests passing
- [ ] 11+ integration tests passing
- [ ] 80%+ code coverage
- [ ] cargo check/clippy passes
- [ ] No memory leaks

**Wave 3 Exit Criteria**:
- [ ] All processors implement correct traits
- [ ] Integration tests passing (10+)
- [ ] Performance benchmarks meet targets (< 10% CPU)
- [ ] Stress tests passing (1-hour continuous recording)
- [ ] All verification reports complete

**Wave 4 Exit Criteria (Phase 3 Complete)**:
- [ ] AudioRecorder wrapper complete
- [ ] All E2E tests passing
- [ ] Manual testing checklist complete
- [ ] All documentation updated
- [ ] PROGRESS.md shows Phase 3 at 100%
- [ ] Ready to proceed to Phase 4

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance regression | Medium | High | Benchmark early, optimize if needed |
| Cross-platform issues | Low | Medium | Test on all platforms before Wave 4 |
| API compatibility break | Low | High | Wrapper maintains exact old API |
| Resampling quality | Low | Medium | Use proven rubato crate |
| Testing gaps | Medium | Medium | Comprehensive test plan, 80%+ coverage |

---

## Success Criteria

Phase 3 is complete when:
1. ✅ All 10 tasks marked complete in PROGRESS.md
2. ✅ All tests passing (100+ total tests)
3. ✅ 80%+ code coverage across audio module
4. ✅ Performance benchmarks meet targets
5. ✅ E2E testing passes
6. ✅ Manual testing checklist complete
7. ✅ All verification reports created (10 total)
8. ✅ Documentation updated
9. ✅ Zero breaking changes to existing API
10. ✅ Ready to proceed to Phase 4 (Storage Rewrite)

---

## Next Steps

**Immediate Action**: Launch Wave 2 agents

### Agent 1: Rust/Audio Specialist (Task 3.2 - Sources)
**Assignment**: Implement MicrophoneSource, SystemAudioSource, SilenceSource
**Estimated Time**: 1.5-2 days
**Start**: Immediately

### Agent 2: Rust/Audio Specialist (Task 3.3 - Sinks)
**Assignment**: Implement WavEncoderSink, BufferSink, NullSink
**Estimated Time**: 1.5-2 days
**Start**: Immediately (parallel with Agent 1)

**Both agents should**:
- Read all required documentation
- Create detailed todo lists
- Follow quality standards (80%+ coverage, no clippy warnings)
- Write verification reports
- Update PROGRESS.md upon completion

---

**Document Created**: 2025-10-24
**Last Updated**: 2025-10-24
**Status**: Ready for Wave 2 execution
**Next Review**: After Wave 2 completion
