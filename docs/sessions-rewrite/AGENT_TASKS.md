# Agent Task Delegation Guide

This document provides templates for delegating work to specialized agents during the Sessions Rewrite project.

---

## General Agent Instructions

### Before Starting ANY Task

**MANDATORY READING** (in order):
1. Read `/Users/jamesmcarthur/Documents/taskerino/SESSIONS_REWRITE.md` (master plan)
2. Read `/Users/jamesmcarthur/Documents/taskerino/CLAUDE.md` (codebase guide)
3. Read the specific phase document for your task (e.g., `PHASE_1.md`)
4. Read ALL files mentioned in your task scope (use Read tool, not grep)
5. Understand the COMPLETE current implementation before changing anything

### Quality Standards

Every agent MUST:
- ✅ Read and understand existing code thoroughly
- ✅ Follow existing code style and patterns
- ✅ Write comprehensive tests (unit + integration)
- ✅ Document all new APIs and complex logic
- ✅ Verify changes don't break existing functionality
- ✅ Run type checking (`npx tsc --noEmit` for TS, `cargo check` for Rust)
- ✅ Check for memory leaks (Rust: `cargo clippy`, Swift: Instruments)
- ✅ Update progress tracking in `PROGRESS.md`

### Deliverable Format

Each task completion must include:
1. **Implementation**: All code changes
2. **Tests**: Passing test suite (80%+ coverage)
3. **Documentation**: Updated docs for changed APIs
4. **Progress Update**: Updated `PROGRESS.md` with status
5. **Verification Report**: Checklist of quality standards met

---

## Task Template

```markdown
## Task: [Task Name]

**Agent Type**: [Swift/Rust/React/Storage/AI/Performance Specialist]
**Phase**: [1-7]
**Week**: [1-14]
**Estimated Time**: [X hours/days]
**Dependencies**: [List any tasks that must complete first]
**Status**: ❌ Not Started | 🟡 In Progress | ✅ Complete

### Objective
[Clear, specific goal. What should exist after this task?]

### Required Reading
**MUST read BEFORE starting**:
1. [File 1 with line numbers if specific sections]
2. [File 2...]
3. [Documentation...]

### Current State Analysis
**What exists now**:
- [Current implementation details]
- [Current problems/limitations]
- [Performance/reliability issues]

### Target State
**What should exist after this task**:
- [New architecture]
- [Solved problems]
- [Performance improvements]

### Implementation Steps
1. **Step 1**: [Specific action]
   - Files to modify: [...]
   - Expected changes: [...]

2. **Step 2**: [...]

3. **Step 3**: [...]

### Testing Requirements
**Unit Tests** (minimum):
- [ ] Test case 1
- [ ] Test case 2
- [ ] ...

**Integration Tests** (minimum):
- [ ] Integration test 1
- [ ] ...

**Manual Verification**:
- [ ] Verification step 1
- [ ] ...

### Quality Checklist
Before marking complete, verify:
- [ ] All required reading completed
- [ ] Implementation follows existing patterns
- [ ] All tests pass (unit + integration)
- [ ] Type checking passes (no errors)
- [ ] No memory leaks detected
- [ ] Documentation updated
- [ ] Progress tracking updated
- [ ] Code reviewed (self-review at minimum)

### Completion Criteria
Task is complete when:
1. [Specific deliverable 1]
2. [Specific deliverable 2]
3. All quality checklist items checked

### Verification Report Template
```
Task: [Task Name]
Completed By: [Agent Name/ID]
Date: [YYYY-MM-DD]

✅ Implementation Complete
  - Files changed: [list]
  - LOC added/removed: [+X, -Y]

✅ Tests Passing
  - Unit tests: X passing
  - Integration tests: Y passing
  - Coverage: Z%

✅ Quality Standards Met
  - Type checking: PASS
  - Memory leak check: PASS
  - Performance benchmark: [results]

✅ Documentation Updated
  - Files updated: [list]

⚠️ Notes/Warnings
  - [Any issues, concerns, or follow-up needed]
```
```

---

## Phase 1 Tasks

### Task 1.1: Rust FFI Safety Wrappers

**Agent Type**: Rust/FFI Specialist
**Phase**: 1
**Week**: 1
**Estimated Time**: 2-3 days

#### Objective
Create safe RAII wrappers for all Swift FFI calls to eliminate memory leaks and use-after-free bugs.

#### Required Reading
**MUST read in full**:
1. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/video_recording.rs`
2. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio_capture.rs`
3. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/ScreenRecorder/ScreenRecorder.swift` (lines 1-500 for FFI exports)
4. Rust book chapter on FFI: https://doc.rust-lang.org/nomicon/ffi.html
5. Agent report on Rust bridge issues (search for "Rust Bridge Analysis" in conversation history)

#### Current State Analysis
**Problems**:
- Raw pointers (`*mut c_void`) used without safety guarantees
- Double recorder creation bug (video_recording.rs:351-437)
- No timeout handling for Swift calls (can deadlock)
- Manual memory management (error-prone)
- Use-after-free risk in Drop implementation

**Evidence**: Lines to review:
- video_recording.rs:351-437 (double creation)
- video_recording.rs:144-180 (Drop implementation)
- video_recording.rs:80-116 (unsafe Send/Sync)

#### Target State
**New Architecture**:
```rust
// Safe handle with automatic cleanup
struct SwiftRecorderHandle(NonNull<c_void>);

impl SwiftRecorderHandle {
    unsafe fn from_raw(ptr: *mut c_void) -> Result<Self, FFIError> {
        NonNull::new(ptr)
            .ok_or(FFIError::NullPointer)
            .map(SwiftRecorderHandle)
    }

    fn as_ptr(&self) -> *mut c_void {
        self.0.as_ptr()
    }
}

impl Drop for SwiftRecorderHandle {
    fn drop(&mut self) {
        unsafe {
            screen_recorder_destroy(self.as_ptr());
        }
    }
}

// Recording session with RAII
pub struct RecordingSession {
    handle: SwiftRecorderHandle,
    session_id: String,
    output_path: PathBuf,
}

impl RecordingSession {
    pub fn stop(self) -> Result<PathBuf, FFIError> {
        // Consumes self, ensures single-use
        unsafe {
            screen_recorder_stop(self.handle.as_ptr())?;
        }
        Ok(self.output_path)
    }
}
```

#### Implementation Steps

1. **Create new module `src-tauri/src/recording/ffi.rs`**
   - Define `SwiftRecorderHandle` with NonNull wrapper
   - Implement Drop for automatic cleanup
   - Add timeout wrapper for all FFI calls (5s default)

2. **Create `src-tauri/src/recording/error.rs`**
   - Define typed error enum (see error.rs in target state)
   - Implement Display and Error traits
   - Map Swift error codes to enum variants

3. **Create `src-tauri/src/recording/session.rs`**
   - Implement RecordingSession with safe ownership
   - Add timeout handling (tokio::timeout)
   - Prevent double-start/double-stop

4. **Update `video_recording.rs`**
   - Replace raw pointers with safe wrappers
   - Fix double recorder creation (lines 351-437)
   - Use RecordingSession instead of VideoRecorder

5. **Add FFI safety tests**
   - Test null pointer handling
   - Test timeout scenarios
   - Test double-free prevention

#### Testing Requirements

**Unit Tests** (in `src-tauri/src/recording/tests.rs`):
- [ ] Test SwiftRecorderHandle creation from null pointer (should error)
- [ ] Test SwiftRecorderHandle creation from valid pointer
- [ ] Test Drop is called exactly once
- [ ] Test RecordingSession prevents double-stop
- [ ] Test timeout handling (mock slow Swift call)

**Integration Tests** (in `src-tauri/tests/ffi_safety.rs`):
- [ ] Start and stop recording (verify no leaks with Valgrind)
- [ ] Rapid start/stop cycles (stress test)
- [ ] Error during recording (verify cleanup)

**Manual Verification**:
- [ ] Run `cargo clippy` - no warnings
- [ ] Run `cargo test` - all pass
- [ ] Inspect code with `cargo expand` - verify macros correct
- [ ] Memory leak check: Record 30s video, check memory usage before/after

#### Quality Checklist
- [ ] Read all 5 required documents
- [ ] Understand current FFI boundary completely
- [ ] All unsafe blocks have SAFETY comments
- [ ] No raw pointers exposed in public API
- [ ] All FFI calls have timeout handling
- [ ] Drop implementation verified (no double-free)
- [ ] Tests pass with zero leaks
- [ ] Documentation for new types complete

#### Completion Criteria
1. New `recording/` module with `ffi.rs`, `error.rs`, `session.rs`
2. video_recording.rs uses safe wrappers (no raw pointers in public API)
3. All tests pass (unit + integration)
4. Cargo clippy passes with zero warnings
5. Memory leak test passes (Valgrind clean)

---

### Task 1.2: Audio Service Critical Fixes

**Agent Type**: Rust/FFI Specialist
**Phase**: 1
**Week**: 1
**Estimated Time**: 2 days

#### Objective
Fix critical audio bugs: sourceType mismatch, windowIds field names, buffer management.

#### Required Reading
**MUST read in full**:
1. `/Users/jamesmcarthur/Documents/taskerino/src/services/audioRecordingService.ts`
2. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio_capture.rs`
3. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/macos_audio.rs`
4. Agent report on audio architecture (search for "Audio Architecture" in history)

#### Current State Analysis
**Bug 1: sourceType mismatch** (audioRecordingService.ts:412-413)
- UI sends `'microphone'` and `'system-audio'`
- Service checks for `'mic'` and `'system'`
- Result: Audio never enables, silent failure

**Bug 2: windowIds field** (already fixed, verify)
- Validation uses `windowId` (singular)
- Should use `windowIds` (array)

**Bug 3: Buffer overruns** (audio_capture.rs)
- No backpressure handling
- System audio buffer can overflow silently
- Lost data under high CPU load

#### Target State
1. SourceType strings match exactly
2. All field names use `windowIds` consistently
3. Ring buffers with backpressure detection
4. Overflow warnings logged and surfaced to UI

#### Implementation Steps
1. **Verify sourceType fix** (should already be done)
   - Check audioRecordingService.ts:412-413
   - Ensure `'microphone'` and `'system-audio'`
   - Add test for config mapping

2. **Verify windowIds fix** (should already be done)
   - Check sessionValidation.ts:121-129
   - Check StartSessionModal.tsx:290
   - Check types.rs:355

3. **Add buffer backpressure** (audio_capture.rs)
   - Monitor buffer fullness (90% threshold)
   - Emit warning event to TypeScript
   - Log overrun count for debugging

4. **Add audio health monitoring**
   - Track dropped chunks
   - Track buffer overruns
   - Emit health status every 10s

#### Testing Requirements
**Unit Tests**:
- [ ] sourceType mapping correct for all variants
- [ ] windowIds validation accepts arrays
- [ ] Buffer overflow detected and logged

**Integration Tests**:
- [ ] High-frequency audio chunks don't overflow
- [ ] Health status events emitted correctly

#### Completion Criteria
1. All three bugs verified fixed
2. Buffer monitoring active
3. Health events flowing to TypeScript
4. Tests pass

---

## Phase 2 Tasks

### Task 2.1: Extract Swift Components

**Agent Type**: Swift Specialist
**Phase**: 2
**Week**: 3
**Estimated Time**: 3-4 days

#### Objective
Extract reusable components from monolithic ScreenRecorder.swift into separate, testable modules.

#### Required Reading
**MUST read in full**:
1. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/ScreenRecorder/ScreenRecorder.swift`
2. Apple ScreenCaptureKit documentation: https://developer.apple.com/documentation/screencapturekit
3. Apple AVFoundation encoding guide
4. Agent report on Swift architecture (search for "Swift ScreenRecorder Analysis")

#### Current State Analysis
**Problem**: ScreenRecorder.swift is 2,540 lines with mixed responsibilities:
- Display/window capture
- Video encoding
- Frame compositing
- PiP rendering
- FFI exports

**Specific code to extract**:
- Lines 375-437: Video encoding logic
- Lines 664-713: Display capture
- Lines 717-776: Window capture
- Lines 780-843: Webcam capture

#### Target State
**New file structure**:
```
ScreenRecorder/
├── Core/
│   ├── VideoEncoder.swift          [NEW] Lines 375-437 extracted
│   ├── RecordingSource.swift       [NEW] Protocol definition
│   ├── FrameSynchronizer.swift     [NEW] Timestamp-based sync
│   └── FrameCompositor.swift       [NEW] Protocol definition
├── Sources/
│   ├── DisplaySource.swift         [NEW] Lines 664-713 extracted
│   ├── WindowSource.swift          [NEW] Lines 717-776 extracted
│   └── WebcamSource.swift          [NEW] Lines 780-843 extracted
└── ScreenRecorder.swift            [KEEP] Backward compat wrapper
```

#### Implementation Steps

1. **Create VideoEncoder.swift**
   ```swift
   import AVFoundation

   class VideoEncoder {
       private var assetWriter: AVAssetWriter?
       private var videoInput: AVAssetWriterInput?
       private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?

       func configure(url: URL, width: Int, height: Int, fps: Int, codec: AVVideoCodecType) throws
       func start() throws
       func writeFrame(_ buffer: CVPixelBuffer, at time: CMTime) throws
       func finish() async throws
   }
   ```
   - Extract lines 375-437 from ScreenRecorder.swift
   - Add codec detection logic (lines 214-262)
   - Make standalone (no dependencies on ScreenRecorder class)

2. **Create RecordingSource.swift protocol**
   ```swift
   protocol RecordingSource {
       func configure(width: Int, height: Int, fps: Int) async throws
       func start() async throws
       func stop() async throws
       var frameStream: AsyncStream<CVPixelBuffer> { get }
   }
   ```

3. **Create DisplaySource.swift**
   - Extract lines 664-713
   - Implement RecordingSource protocol
   - Use SCStream for single display capture

4. **Create WindowSource.swift**
   - Extract lines 717-776
   - Implement RecordingSource protocol
   - Use SCStream for single window capture

5. **Create WebcamSource.swift**
   - Extract lines 780-843
   - Implement RecordingSource protocol
   - Use AVCaptureSession

6. **Update ScreenRecorder.swift**
   - Mark old methods as @available(*, deprecated)
   - Delegate to new classes internally
   - Maintain backward compatibility

#### Testing Requirements

**Unit Tests** (create `ScreenRecorderTests/` directory):
- [ ] Test VideoEncoder.swift
  - [ ] HEVC codec detection
  - [ ] Fallback to H.264
  - [ ] Frame writing at various fps
  - [ ] Finish and file creation

- [ ] Test DisplaySource.swift
  - [ ] Configure and start
  - [ ] Frame stream emits CVPixelBuffers
  - [ ] Stop cleans up resources

- [ ] Test WindowSource.swift
  - [ ] Same tests as DisplaySource

- [ ] Test WebcamSource.swift
  - [ ] Enumerate devices
  - [ ] Start capture
  - [ ] Frame stream works

**Integration Tests**:
- [ ] Record 10s video with DisplaySource → VideoEncoder
- [ ] Verify output file is valid MP4
- [ ] Check file size and resolution

**Manual Verification**:
- [ ] Build project (no errors)
- [ ] Run old FFI API (should still work via deprecated wrapper)
- [ ] Record a test session (verify backward compat)

#### Quality Checklist
- [ ] Read ScreenRecorder.swift completely (2540 lines)
- [ ] Understand ScreenCaptureKit API
- [ ] All new files follow Swift style guide
- [ ] Async/await used (no semaphores)
- [ ] Actors used for thread safety where needed
- [ ] All protocols documented
- [ ] Unit tests achieve 80%+ coverage
- [ ] Integration tests pass
- [ ] No performance regression (benchmark)

#### Completion Criteria
1. 5 new Swift files created and building
2. All unit tests passing (80%+ coverage)
3. Integration tests passing
4. Old API still works (backward compat verified)
5. Performance benchmark shows no regression

---

## Progress Tracking Template

After completing each task, update `PROGRESS.md`:

```markdown
### Task X.Y: [Task Name]

**Status**: ✅ Complete
**Completed**: 2024-XX-XX
**Agent**: [Agent Name/ID]
**Time Taken**: [X hours/days]

**Deliverables**:
- ✅ [Deliverable 1]
- ✅ [Deliverable 2]
- ...

**Test Results**:
- Unit tests: X/X passing (100%)
- Integration tests: Y/Y passing (100%)
- Coverage: Z%

**Notes**:
- [Any important notes, warnings, or follow-up needed]

**Verification Report**:
[Link to full verification report or paste inline]
```

---

## Agent Communication Protocol

### Daily Standup Format
Each agent should report:
```markdown
**Agent**: [Name]
**Task**: [Current task number]
**Yesterday**: [What was accomplished]
**Today**: [What will be worked on]
**Blockers**: [Any blockers or questions]
**Help Needed**: [Any assistance needed from other agents or lead]
```

### Code Review Request
When task is complete:
```markdown
**Task**: X.Y - [Task Name]
**PR/Branch**: [link if applicable]
**Reviewers**: @lead-architect
**Changes**: [Summary of changes]
**Tests**: [Test results summary]
**Ready**: Yes/No
```

### Blocker Escalation
If blocked > 4 hours:
```markdown
**BLOCKER**: Task X.Y
**Issue**: [Clear description]
**Attempted Solutions**: [What was tried]
**Impact**: [How this affects timeline]
**Needed**: [What's needed to unblock]
```

---

## Quality Gates

### No phase proceeds until:
1. All tasks in previous phase marked ✅ Complete
2. All tests passing (unit + integration)
3. Code review approved
4. Performance benchmarks meet targets
5. Documentation updated
6. Lead architect sign-off

### Red Flags (Stop Work)
- Memory leaks detected
- Performance regression > 10%
- Test coverage < 80%
- Breaking changes without migration path
- Security vulnerabilities

---

## End of Agent Task Templates

More specific tasks will be added as phases are detailed in `PHASE_X.md` files.
