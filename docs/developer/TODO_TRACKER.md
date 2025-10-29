# TODO Marker Tracker

This document catalogs all TODO comments in the Taskerino codebase for systematic resolution.

**Last Updated**: October 26, 2025
**Total TODOs**: 65
**Priority TODOs**: 16

---

## Table of Contents
1. [High Priority (Platform Critical)](#high-priority-platform-critical)
2. [Medium Priority](#medium-priority)
3. [Low Priority](#low-priority)
4. [Resolution Guidelines](#resolution-guidelines)

---

## High Priority (Platform Critical)

### 1. Windows/Linux Audio Support (8 TODOs)
**Impact**: Cross-platform functionality blocked
**Status**: Awaiting platform-specific implementation

**Files**:
- `src-tauri/src/audio/platform/windows/mod.rs` (Lines 3, 12-14, 21)
- `src-tauri/src/audio/platform/linux/mod.rs` (Lines 3, 12-14, 21)
- `src-tauri/src/audio/mod.rs` (Lines 9-10, 127-128)

**Blockers**:
- Windows: Requires WASAPI (Windows Audio Session API) implementation
- Linux: Requires PulseAudio or PipeWire integration

**Tasks**:
- [ ] Implement Windows WASAPI microphone capture
- [ ] Implement Windows WASAPI system audio loopback
- [ ] Implement Windows WASAPI per-app audio
- [ ] Implement Linux PulseAudio/PipeWire microphone capture
- [ ] Implement Linux PulseAudio/PipeWire system audio
- [ ] Implement Linux PulseAudio/PipeWire per-app audio
- [ ] Add platform detection and fallback
- [ ] Test on Windows 10/11 and Linux (Ubuntu/Fedora)

### 2. Video Analysis SDK Integration (8 TODOs)
**Impact**: Video analysis features currently disabled
**Status**: Blocked - awaiting SDK installation decision

**Files**:
- `src/services/videoAnalysisAgent.ts` (Lines 8, 33, 37-38, 104, 270, 276, 308)

**Blockers**:
- Decision needed: Install `@anthropic-ai/sdk` or use different approach
- Current implementation is mock/stub

**Tasks**:
- [ ] Decide on SDK installation strategy
- [ ] Install `@anthropic-ai/sdk` if approved
- [ ] Replace mock implementations with real Claude API calls
- [ ] Implement frame selection algorithm
- [ ] Implement chapter generation from video
- [ ] Add error handling and retry logic
- [ ] Test with various video formats and lengths

---

## Medium Priority

### 3. Activity Monitoring - Phase 2 (3 TODOs)
**Impact**: Enhanced activity tracking for adaptive screenshots
**Status**: Deferred to Phase 2

**Files**:
- `src-tauri/src/activity_monitor.rs` (Lines 11, 186, 215)

**Tasks**:
- [ ] Integrate macOS NSWorkspace for window tracking
- [ ] Integrate macOS CGEvent taps for keyboard/mouse activity
- [ ] Initialize event monitoring on session start
- [ ] Clean up event monitoring on session end
- [ ] Test with various macOS applications

### 4. Session State Machine Services (9 TODOs)
**Impact**: Session lifecycle stubs need real implementations
**Status**: Phase 1 machine created, services need hookup

**Files**:
- `src/machines/sessionMachineServices.ts` (Lines 228, 245, 262, 280, 299, 309, 319, 331, 345)

**Tasks**:
- [ ] Implement pause logic (stop recording services)
- [ ] Implement resume logic (restart recording services)
- [ ] Implement stop logic (cleanup and save)
- [ ] Implement health monitoring (check services still running)
- [ ] Implement permission checks (screenshot, audio, video)
- [ ] Integrate screenshot service with machine
- [ ] Integrate audio service with machine
- [ ] Integrate video service with machine
- [ ] Add comprehensive testing for all transitions

### 5. Component Migration Completion (1 TODO)
**Impact**: AppProvider can be removed once complete
**Status**: 13 components remaining (noted in App.tsx:557)

**Files**:
- `src/App.tsx` (Line 557)

**Current Status**: Phase 1 contexts implemented, AppProvider still needed for 13 legacy components

**Tasks**:
- [ ] Identify remaining 13 components using AppProvider
- [ ] Migrate to specialized contexts (UIContext, EntitiesContext, etc.)
- [ ] Remove AppProvider from App.tsx
- [ ] Update tests
- [ ] Verify no regression in functionality

### 6. UI Features Missing (8 TODOs)
**Impact**: Missing modal interfaces and features
**Status**: Deferred features

**Files**:
- `src/components/TasksZone.tsx` (Lines 1037, 1041)
- `src/components/LibraryZone.tsx` (Lines 665, 669, 673)
- `src/components/ProcessingIndicator.tsx` (Line 37)
- `src/hooks/useKeyboardShortcuts.ts` (Line 75)
- `src/components/TopNavigation/index.tsx` (Line 97)

**Tasks**:
- [ ] Implement priority selector modal
- [ ] Implement tag selector modal
- [ ] Implement topic selector modal
- [ ] Implement archive functionality
- [ ] Implement results review modal
- [ ] Implement keyboard shortcuts help modal
- [ ] Implement job click handler

### 7. Relationship Creation for Tasks (3 TODOs)
**Impact**: Task relationships not fully implemented
**Status**: Needs relationship manager integration

**Files**:
- `src/components/TaskDetailInline.tsx` (Lines 147, 162, 176)

**Tasks**:
- [ ] Create/remove TASK_TOPIC relationships on topic change
- [ ] Create/remove TASK_COMPANY relationships on company change
- [ ] Create/remove TASK_CONTACT relationships on contact change
- [ ] Test relationship persistence
- [ ] Verify relationship queries work

### 8. Media Features (5 TODOs)
**Impact**: Missing features in media system
**Status**: Various priorities

**Files**:
- `src/services/videoStorageService.ts` (Lines 139, 144, 169)
- `src/components/ActiveSessionView.tsx` (Line 147)
- `src/components/StartSessionModal.tsx` (Line 177)

**Tasks**:
- [ ] Implement video thumbnail generation (canvas + FFmpeg)
- [ ] Implement video file deletion via Tauri fs
- [ ] Implement hot-swap support in videoRecordingService
- [ ] Implement actual audio recording and playback in modal

---

## Low Priority

### 9. Data Integration (4 TODOs)
**Impact**: Missing data connections
**Status**: Low priority enhancements

**Files**:
- `src/components/CommandPalette.tsx` (Line 153)
- `src/components/SessionsTopBar.tsx` (Line 200)
- `src/components/ned/NedChat.tsx` (Lines 196, 289)
- `src/components/AICanvasRenderer.tsx` (Line 262)

**Tasks**:
- [ ] Add sessions data to CommandPalette
- [ ] Populate SessionsTopBar from Tauri command
- [ ] Get session ID from SessionsContext in NedChat
- [ ] Track actual token usage from API response in NedChat
- [ ] Fix field extraction in AICanvasRenderer (using title/description instead of task names)

### 10. Missing Implementations (5 TODOs)
**Impact**: Placeholders and stubs
**Status**: Future enhancements

**Files**:
- `src/services/sessionEnrichmentService.ts` (Line 366)
- `src/services/InvertedIndexManager.ts` (Line 291)
- `src/services/audioConcatenationService.ts` (Line 437)
- `src/context/SessionListContext.tsx` (Line 449)
- `src/utils/testEnhancedEnrichment.ts` (Lines 25, 34)

**Tasks**:
- [ ] Implement actual incremental processing in enrichAudio/enrichVideo
- [ ] Extract topics from summary once loaded
- [ ] Convert WAV to MP3 using lamejs
- [ ] Integrate async indexed search in Phase 4.3.2
- [ ] Complete test utility functions

### 11. Feature Completions (5 TODOs)
**Impact**: Deferred Phase 2/3 features
**Status**: Documented for future work

**Files**:
- `src/components/ActiveSessionMediaControls.tsx` (Line 33)
- `src/components/CaptureZone.tsx` (Line 640)
- `src/components/ProfileZone.tsx` (Line 148)
- `src/components/ChapterGenerator.tsx` (Line 32)

**Tasks**:
- [ ] Phase 2 features in ActiveSessionMediaControls (multiline comment)
- [ ] Update learnings in SettingsContext
- [ ] Add attachment export in Phase 3
- [ ] Show error notification in ChapterGenerator

### 12. Audio Graph Enhancement (1 TODO)
**Impact**: Multi-input processor support
**Status**: Future enhancement

**Files**:
- `src-tauri/src/audio/graph/mod.rs` (Line 461)

**Tasks**:
- [ ] Implement multi-input processors (currently only processes first input)
- [ ] Design multi-input API
- [ ] Test with mixing scenarios
- [ ] Document usage patterns

---

## Resolution Guidelines

### When Working on TODOs

1. **Don't Remove TODOs Until Complete**
   - Only remove when work is fully implemented and tested
   - Partial implementations keep the TODO marker

2. **Update This Tracker**
   - Check off completed items
   - Add issue/PR numbers when work begins
   - Update status and blockers as needed

3. **Add Issue Numbers**
   - Link TODOs to GitHub issues for tracking
   - Format: `TODO (#123): Description`

4. **Document Blockers**
   - Note dependencies or decisions needed
   - Update "Blockers" section when status changes

5. **Test Thoroughly**
   - All TODO resolutions require tests
   - Update related documentation

### Priority Definitions

- **High Priority**: Blocks features, cross-platform support, or has significant user impact
- **Medium Priority**: Improves functionality but has workarounds
- **Low Priority**: Nice-to-have enhancements or optimizations

### Finding TODOs in Code

```bash
# All TODO comments
grep -r "TODO" src/ src-tauri/ --include="*.ts" --include="*.tsx" --include="*.rs"

# High priority (platform/SDK blockers)
grep -r "TODO.*WASAPI\|TODO.*PulseAudio\|TODO.*@anthropic-ai" src-tauri/ src/

# Medium priority (Phase 2/implementation)
grep -r "TODO Phase 2\|TODO.*Implement actual" src/

# By file type
grep -r "TODO" src-tauri/ --include="*.rs"  # Rust TODOs
grep -r "TODO" src/ --include="*.tsx"       # React component TODOs
```

---

## Statistics

| Priority | Count | % of Total |
|----------|-------|------------|
| High | 16 | 24.6% |
| Medium | 33 | 50.8% |
| Low | 16 | 24.6% |
| **Total** | **65** | **100%** |

### By Category

| Category | Count |
|----------|-------|
| Platform Audio Support | 8 |
| Video Analysis | 8 |
| Session State Machine | 9 |
| UI Features | 8 |
| Activity Monitoring | 3 |
| Media Features | 5 |
| Data Integration | 4 |
| Relationship Creation | 3 |
| Missing Implementations | 5 |
| Feature Completions | 5 |
| Component Migration | 1 |
| Audio Graph | 1 |
| Other | 5 |

---

## Next Steps

**Immediate** (Next Sprint):
1. Decide on video analysis SDK approach
2. Begin Windows WASAPI implementation
3. Complete component migration (remove AppProvider)

**Short-term** (Next Quarter):
1. Linux audio support
2. Session state machine service integration
3. Implement missing UI modals

**Long-term** (Next Year):
1. Activity monitoring Phase 2
2. Multi-input audio processor
3. Complete Phase 2/3 deferred features

---

**Last Updated**: October 26, 2025
**Maintained By**: Development Team
**Update Frequency**: Monthly or when 10+ TODOs resolved
