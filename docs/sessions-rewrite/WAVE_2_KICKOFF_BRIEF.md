# Phase 3 Wave 2 Kickoff Brief

**Wave**: Wave 2 (Foundation Implementation)
**Tasks**: 3.2 (Sources Module) + 3.3 (Sinks Module)
**Agents**: 2 Rust/Audio Specialists (parallel execution)
**Duration**: 3-4 days
**Status**: Ready to Execute
**Date**: October 24, 2025

---

## 🎯 Mission

Implement the **Sources** and **Sinks** modules for the audio graph architecture, providing the foundation for audio capture and output in the new graph-based system.

**Dependencies**: Task 3.1 (Audio Graph Architecture Design) ✅ COMPLETE

**Can Run in Parallel**: YES - Tasks 3.2 and 3.3 are independent

---

## 📚 Required Reading (MANDATORY)

### Before Starting ANY Work:

1. **AUDIO_GRAPH_ARCHITECTURE.md** - Complete technical design
   - Section 3.3: AudioSource Trait
   - Section 3.5: AudioSink Trait
   - Section 7: Performance Requirements

2. **AUDIO_GRAPH_EXAMPLES.md** - Usage examples
   - Example 1: Dual-Source Recording (shows sources + sinks in action)
   - Example 2: Multi-format Output

3. **traits.rs** - Trait definitions
   - `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio/graph/traits.rs`
   - Study AudioSource, AudioSink traits

4. **Current Implementation** - Understand existing code
   - `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio_capture.rs`
   - `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/macos_audio.rs`

5. **PHASE_3_EXECUTION_PLAN.md** - Detailed task specifications
   - Lines 43-154 (Task 3.2 full spec)
   - Lines 158-267 (Task 3.3 full spec)

**Reading Time**: 1-2 hours (DO NOT SKIP)

---

## 👤 Agent 1: Sources Module (Task 3.2)

### Objective
Extract and refactor existing audio sources into the new graph-based architecture. Implement MicrophoneSource, SystemAudioSource, and SilenceSource.

### Deliverables
1. **Module Structure**:
   - `src-tauri/src/audio/sources/mod.rs` (~50 lines)
   - `src-tauri/src/audio/sources/microphone.rs` (~300 lines)
   - `src-tauri/src/audio/sources/system_audio.rs` (~250 lines)
   - `src-tauri/src/audio/sources/silence.rs` (~100 lines)

2. **Testing**:
   - Unit tests in each source file (~400 lines total, 24+ tests)
   - Integration tests: `src-tauri/tests/audio_sources_test.rs` (~200 lines, 5+ tests)

3. **Documentation**:
   - `TASK_3.2_VERIFICATION_REPORT.md`

**Total Estimated LOC**: ~1,300 lines

### Quality Standards
- [ ] All sources implement AudioSource trait
- [ ] Sources are Send + Sync
- [ ] Unit tests: 8+ per source (24+ total)
- [ ] Integration tests: 5+
- [ ] Coverage: 80%+
- [ ] cargo check passes (0 errors)
- [ ] cargo clippy passes (0 warnings in new code)
- [ ] No memory leaks (verify with Instruments)
- [ ] All pub items have doc comments

### Implementation Checklist
- [ ] Read all 5 required documents (1-2 hours)
- [ ] Create module structure (30 min)
- [ ] Implement MicrophoneSource (4-5 hours)
- [ ] Implement SystemAudioSource (4-5 hours)
- [ ] Implement SilenceSource (1 hour)
- [ ] Write unit tests (3-4 hours)
- [ ] Write integration tests (2 hours)
- [ ] Write verification report (1 hour)
- [ ] Update PROGRESS.md

### Key Technical Details

**MicrophoneSource**:
- Use `cpal` crate (already in dependencies)
- Extract from `audio_capture.rs:150-280`
- Ring buffer: `Arc<Mutex<VecDeque<AudioBuffer>>>`
- Device enumeration and selection
- Graceful error handling

**SystemAudioSource** (macOS):
- Use existing `macos_audio.rs` code
- Wrap ScreenCaptureKit audio capture
- Convert to AudioSource trait interface
- Handle ScreenCaptureKit callback → buffer queue

**SilenceSource**:
- Generate silent audio buffers at specified rate
- Useful for testing graph topology without hardware

---

## 👤 Agent 2: Sinks Module (Task 3.3)

### Objective
Implement audio sink nodes for encoding recorded audio. Create WavEncoderSink (primary), BufferSink (testing), and NullSink (benchmarking).

### Deliverables
1. **Module Structure**:
   - `src-tauri/src/audio/sinks/mod.rs` (~50 lines)
   - `src-tauri/src/audio/sinks/wav_encoder.rs` (~350 lines)
   - `src-tauri/src/audio/sinks/buffer.rs` (~150 lines)
   - `src-tauri/src/audio/sinks/null.rs` (~80 lines)

2. **Testing**:
   - Unit tests in each sink file (~500 lines total, 24+ tests)
   - Integration tests: `src-tauri/tests/audio_sinks_test.rs` (~250 lines, 6+ tests)

3. **Documentation**:
   - `TASK_3.3_VERIFICATION_REPORT.md`

**Total Estimated LOC**: ~1,380 lines

### Quality Standards
- [ ] All sinks implement AudioSink trait
- [ ] Sinks are Send + Sync
- [ ] Unit tests: 8+ per sink (24+ total)
- [ ] Integration tests: 6+
- [ ] Coverage: 80%+
- [ ] cargo check passes (0 errors)
- [ ] cargo clippy passes (0 warnings in new code)
- [ ] No memory leaks
- [ ] All pub items have doc comments
- [ ] WAV files playable by external players

### Implementation Checklist
- [ ] Read all 5 required documents (1-2 hours)
- [ ] Create module structure (30 min)
- [ ] Implement WavEncoderSink (5-6 hours)
- [ ] Implement BufferSink (2 hours)
- [ ] Implement NullSink (1 hour)
- [ ] Write unit tests (4-5 hours)
- [ ] Write integration tests (2-3 hours)
- [ ] Write verification report (1 hour)
- [ ] Update PROGRESS.md

### Key Technical Details

**WavEncoderSink**:
- Use `hound` crate (already in dependencies)
- Extract WAV encoding from `audio_capture.rs:400-600`
- Support f32 and i16 sample formats
- Track samples written, file size
- Proper finalization on close

**BufferSink**:
- Accumulates buffers in memory (Vec<AudioBuffer>)
- Limit max size to prevent OOM
- API to retrieve accumulated buffers

**NullSink**:
- Discards all buffers (for benchmarking)
- Tracks throughput stats

---

## 🔄 Coordination Protocol

### Daily Updates
**Format**:
```markdown
**Agent**: [1 or 2]
**Task**: [3.2 or 3.3]
**Yesterday**: [What was accomplished]
**Today**: [What will be worked on]
**Blockers**: [Any issues]
**Help Needed**: [Any assistance needed]
```

**Post To**: Update PROGRESS.md with your status

### Completion Checklist
Before marking task complete:
- [ ] All quality standards met
- [ ] All tests passing locally
- [ ] Verification report written
- [ ] PROGRESS.md updated

### Blocker Escalation
If blocked > 4 hours:
1. Document the issue
2. Update PROGRESS.md with blocker status
3. Reach out for assistance

---

## 📦 Deliverable Format

### Verification Report Template
Create `TASK_3.X_VERIFICATION_REPORT.md`:

```markdown
# Task 3.X Verification Report

**Task**: [Sources Module or Sinks Module]
**Agent**: [Your identifier]
**Completed**: [YYYY-MM-DD]
**Time Taken**: [X hours/days]

## ✅ Implementation Complete

**Files Created**:
- [List all files with line counts]

**LOC Summary**:
- Implementation: X lines
- Tests: Y lines
- Total: Z lines

## ✅ Tests Passing

**Unit Tests**:
- Source/Sink 1: X tests passing
- Source/Sink 2: Y tests passing
- Source/Sink 3: Z tests passing
- Total: XX tests passing

**Integration Tests**:
- Test 1: [description] ✅
- Test 2: [description] ✅
- ...
- Total: Y tests passing

**Coverage**: Z% (measured by cargo-tally)

## ✅ Quality Standards Met

- [ ] All sources/sinks implement correct traits
- [ ] All items are Send + Sync
- [ ] cargo check: 0 errors
- [ ] cargo clippy: 0 warnings in new code
- [ ] Memory leak check: PASS (Instruments clean)
- [ ] Documentation: All pub items documented
- [ ] Error handling: No unwrap/expect in public API

## ✅ Integration Testing

[Describe end-to-end tests performed]

**Example**: Recorded 1 second from MicrophoneSource → Verified buffer timestamps monotonic → No overruns

## 📊 Performance Metrics

[If applicable, include performance benchmarks]

## ⚠️ Notes / Issues

[Any concerns, warnings, or follow-up needed]

## ✅ Ready for Wave 3

Confirmed ready to proceed with processor implementations.
```

---

## 🎯 Wave 2 Success Criteria

Wave 2 is complete when:

### Sources Module (Task 3.2):
- [ ] MicrophoneSource complete and tested
- [ ] SystemAudioSource complete and tested
- [ ] SilenceSource complete and tested
- [ ] 24+ unit tests passing
- [ ] 5+ integration tests passing
- [ ] 80%+ coverage
- [ ] Verification report created

### Sinks Module (Task 3.3):
- [ ] WavEncoderSink complete and tested
- [ ] BufferSink complete and tested
- [ ] NullSink complete and tested
- [ ] 24+ unit tests passing
- [ ] 6+ integration tests passing
- [ ] 80%+ coverage
- [ ] WAV files playable externally
- [ ] Verification report created

### Combined:
- [ ] Total: 48+ unit tests passing
- [ ] Total: 11+ integration tests passing
- [ ] Both modules building together
- [ ] No integration conflicts
- [ ] PROGRESS.md updated to show Wave 2 complete
- [ ] Ready to proceed to Wave 3 (processor implementations)

---

## 🚀 Launch Commands

### Agent 1 (Sources)
```bash
# Read documentation first (1-2 hours)
# Then start implementation:
cd /Users/jamesmcarthur/Documents/taskerino
mkdir -p src-tauri/src/audio/sources
# Begin Task 3.2 implementation
```

### Agent 2 (Sinks)
```bash
# Read documentation first (1-2 hours)
# Then start implementation:
cd /Users/jamesmcarthur/Documents/taskerino
mkdir -p src-tauri/src/audio/sinks
# Begin Task 3.3 implementation
```

---

## 📞 Resources

### Documentation
- **Architecture**: `docs/sessions-rewrite/AUDIO_GRAPH_ARCHITECTURE.md`
- **Examples**: `docs/sessions-rewrite/AUDIO_GRAPH_EXAMPLES.md`
- **Task Specs**: `docs/sessions-rewrite/PHASE_3_EXECUTION_PLAN.md`
- **Progress**: `docs/sessions-rewrite/PROGRESS.md`
- **Status**: `docs/sessions-rewrite/CURRENT_STATUS.md`

### Code References
- **Traits**: `src-tauri/src/audio/graph/traits.rs`
- **Graph Core**: `src-tauri/src/audio/graph/mod.rs`
- **Current Audio**: `src-tauri/src/audio_capture.rs`
- **macOS Audio**: `src-tauri/src/macos_audio.rs`

### External Documentation
- **cpal**: https://docs.rs/cpal/latest/cpal/
- **hound**: https://docs.rs/hound/latest/hound/
- **ScreenCaptureKit**: https://developer.apple.com/documentation/screencapturekit

---

## ⏱️ Timeline

**Day 1**: Reading + setup + initial implementation (4-6 hours)
**Day 2**: Complete implementation + unit tests (6-8 hours)
**Day 3**: Integration tests + verification report (4-6 hours)

**Total**: 1.5-2 days per agent (3-4 days if parallel)

---

## ✅ Pre-flight Checklist

Before starting implementation:
- [ ] All required documentation read (1-2 hours)
- [ ] Understand AudioSource/AudioSink traits
- [ ] Reviewed existing audio_capture.rs code
- [ ] Development environment set up
- [ ] Can build and run existing tests
- [ ] PROGRESS.md updated to show task in progress

---

**Status**: Ready to Execute
**Start Date**: As soon as agents are available
**Next Review**: Daily status updates
**Completion Target**: 3-4 days from start
