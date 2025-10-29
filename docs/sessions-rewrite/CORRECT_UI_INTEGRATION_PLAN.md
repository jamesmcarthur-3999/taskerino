# Correct UI Integration Plan - Multi-Source Recording

**Date**: 2025-10-24
**Status**: READY FOR IMPLEMENTATION
**Backend Readiness**: Multi-source recording FULLY IMPLEMENTED in `videoRecordingService.ts`

---

## Executive Summary

This document maps the **ACTUAL** UI architecture for sessions capture settings and provides a concrete plan for integrating multi-source recording capabilities. The backend infrastructure (`startMultiSourceRecording`, compositor support) is already complete - this is a **frontend integration only** task.

### Key Findings

1. **No separate screenshot/video buttons** - Unified "Capture" toggle
2. **CaptureQuickSettings dropdown** already exists and is well-structured
3. **DisplayMultiSelect component** already supports multi-selection (lines 1-276)
4. **Backend multi-source recording** already implemented (lines 441-489 of videoRecordingService.ts)
5. **Integration complexity**: LOW - only need to add compositor UI and state management

---

## Actual UI Architecture

### Current Capture Flow

```
User opens SessionsZone
  ↓
User clicks [Start Session] button in SessionsTopBar
  ↓
Before starting (optional): User clicks chevron next to "Capture" toggle
  ↓
CaptureQuickSettings dropdown opens
  ↓
User configures:
  - Video Recording toggle
  - Quality preset
  - Screenshot timing (adaptive/fixed)
  - Capture source (screen/window/webcam)
  - Display selection (ALREADY MULTI-SELECT!)
  - Window selection (multi-select)
  - Webcam PiP toggle
  ↓
User closes dropdown (settings persist in state)
  ↓
User clicks [Start Session] → Starts immediately (NO MODAL)
  ↓
Recording begins with configured settings
```

### Component Hierarchy

```
SessionsZone.tsx (parent)
  ↓
SessionsTopBar.tsx (lines 1-1155)
  ├── State: 50+ capture settings variables (lines 125-187)
  ├── [Capture] ToggleButton (line 803-810)
  ├── ChevronDown button (lines 813-818)
  └── CaptureQuickSettings dropdown (lines 821-848)
      ├── File: src/components/sessions/CaptureQuickSettings.tsx
      ├── Props: All capture settings + callbacks
      └── Contents:
          ├── Video Recording section (lines 134-161)
          ├── Screenshot Analysis section (lines 164-194)
          ├── Capture Source section (lines 197-326)
          │   ├── RadioGroup: screen/window/webcam
          │   ├── DisplayMultiSelect (lines 215-220) ✅ ALREADY MULTI
          │   └── WindowMultiSelect (lines 250-256) ✅ ALREADY MULTI
          └── Webcam Overlay section (lines 329-337)
```

### Key Component Analysis

#### SessionsTopBar.tsx (CAPTURE STATE)

**Lines 124-157**: Video settings state
```typescript
// Video settings
const [videoEnabled, setVideoEnabled] = useState(currentSettings.videoRecording || false);
const [videoQuality, setVideoQuality] = useState<'low' | 'medium' | 'high' | 'ultra' | 'custom'>('medium');
// ... more video state

// Source settings
const [captureSource, setCaptureSource] = useState<'screen' | 'window' | 'webcam'>('screen');
const [selectedDisplayIds, setSelectedDisplayIds] = useState<string[]>([]); // ✅ ALREADY ARRAY
const [selectedWindowIds, setSelectedWindowIds] = useState<string[]>([]); // ✅ ALREADY ARRAY
const [selectedWebcam, setSelectedWebcam] = useState<string>();
```

**Lines 334-440**: handleStartSession() builds session config
```typescript
// Build video config from video settings
if (videoEnabled) {
  sessionData.videoConfig = {
    sourceType: captureSource === 'screen' ? 'display' : ...,
    displayIds: captureSource === 'screen' && selectedDisplayIds.length > 0 ? selectedDisplayIds : undefined,
    windowIds: captureSource === 'window' && selectedWindowIds.length > 0 ? selectedWindowIds : undefined,
    // ... other config
  };
}

// Call startSession with the complete configuration
startSession(sessionData);
```

#### CaptureQuickSettings.tsx (CAPTURE UI)

**Lines 196-326**: Source selection section
- **Radio buttons**: screen/window/webcam (lines 198-206)
- **DisplayMultiSelect** called at line 215 (already supports multiple!)
- **WindowMultiSelect** called at line 250 (already supports multiple!)
- **Webcam selector** for webcam-only mode

**Lines 341-352**: Footer with "Advanced Settings..." button
- Opens `AdvancedCaptureModal` for power-user features

#### DisplayMultiSelect.tsx (ALREADY IMPLEMENTED)

**Lines 1-276**: Fully functional multi-select component
- 2-column grid layout
- Multi-select with checkboxes
- Display thumbnails (refresh every 5s)
- Primary display badge
- "Select All" and "Clear" buttons
- Selection validation (min 1 display required)
- Already integrated in CaptureQuickSettings!

**IMPORTANT NOTE** (lines 28-32):
```typescript
// While this UI allows selecting multiple displays, the current Swift recording layer
// (ScreenRecorder.swift:664-677) only uses the FIRST display from the array via .first().
// Multi-display recording requires architectural changes to the recording pipeline.
```

**HOWEVER**: The backend NOW SUPPORTS multi-source recording via `startMultiSourceRecording()`!

#### VideoRecordingService.ts (BACKEND)

**Lines 441-489**: Multi-source recording fully implemented
```typescript
async startMultiSourceRecording(config: RecordingConfig): Promise<void> {
  // Validate configuration
  if (!config.sources || config.sources.length === 0) {
    throw new Error('At least one source must be specified');
  }

  // Separate sources by type
  const displayIds = config.sources.filter(s => s.type === 'display').map(s => parseInt(s.id, 10));
  const windowIds = config.sources.filter(s => s.type === 'window').map(s => parseInt(s.id, 10));

  // Call Rust backend with compositor type
  await invoke('start_multi_source_recording', {
    sessionId: config.sessionId,
    outputPath: config.outputPath,
    width: config.width,
    height: config.height,
    fps: config.fps,
    displayIds: displayIds.length > 0 ? displayIds : null,
    windowIds: windowIds.length > 0 ? windowIds : null,
    compositorType: config.compositor, // 'passthrough' | 'grid' | 'sidebyside'
  });
}
```

**Lines 29-44**: RecordingConfig type definition
```typescript
export interface RecordingConfig {
  sessionId: string;
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  compositor: 'passthrough' | 'grid' | 'sidebyside';
  sources: RecordingSource[];
}
```

---

## Gap Analysis

### What We Have ✅

1. **UI for multi-select displays** - DisplayMultiSelect.tsx (fully functional)
2. **UI for multi-select windows** - WindowMultiSelect.tsx (fully functional)
3. **State management** - Arrays for selectedDisplayIds and selectedWindowIds
4. **Backend service** - startMultiSourceRecording() ready to use
5. **Backend compositor** - Supports passthrough/grid/sidebyside
6. **Capture quick settings** - Dropdown already structured and working

### What's Missing ❌

1. **Compositor selection UI** - No radio buttons for grid/side-by-side/passthrough
2. **Conditional visibility** - Compositor should only appear when 2+ sources selected
3. **Service integration** - SessionsTopBar calls old `startRecordingWithConfig()` instead of `startMultiSourceRecording()`
4. **RecordingSource mapping** - Need to convert displayIds/windowIds arrays to RecordingSource[] format

### Estimated Integration Time

**2-3 hours** (frontend changes only)

---

## Integration Plan

### Phase 1: Add Compositor UI (45 minutes)

**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/CaptureQuickSettings.tsx`

**Changes**:

1. Add compositor section after "Capture Source" section (around line 327)
2. Show only when 2+ sources selected (displays + windows combined)
3. Use existing RadioGroup primitive (already defined at lines 436-485)

**Implementation**:

```typescript
{/* SECTION: Compositor (only show if 2+ sources) */}
{(selectedDisplayIds.length + selectedWindowIds.length) >= 2 && (
  <Section label="Multi-Source Composition">
    <RadioGroup
      options={[
        {
          value: 'passthrough',
          label: 'Passthrough (Auto)',
          description: 'Backend decides best layout'
        },
        {
          value: 'grid',
          label: 'Grid Layout',
          description: 'Arrange sources in a grid'
        },
        {
          value: 'sidebyside',
          label: 'Side-by-Side',
          description: 'Horizontal arrangement'
        },
      ]}
      value={compositor}
      onChange={(v) => onCompositorChange(v as 'passthrough' | 'grid' | 'sidebyside')}
    />

    {/* Compositor explanation */}
    <div className="mt-2 p-3 bg-cyan-50/60 backdrop-blur-lg rounded-xl border border-cyan-200/60">
      <p className="text-xs text-cyan-900">
        <strong>Tip:</strong> {
          compositor === 'passthrough' ? 'Backend will automatically choose the best layout based on source count and aspect ratios.' :
          compositor === 'grid' ? 'Sources will be arranged in a grid pattern (e.g., 2x2 for 4 sources).' :
          'Sources will be arranged horizontally from left to right.'
        }
      </p>
    </div>
  </Section>
)}
```

**Props to add**:

```typescript
// Add to CaptureQuickSettingsProps interface
compositor: 'passthrough' | 'grid' | 'sidebyside';
onCompositorChange: (compositor: 'passthrough' | 'grid' | 'sidebyside') => void;
```

### Phase 2: Add Compositor State (15 minutes)

**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/SessionsTopBar.tsx`

**Changes**:

1. Add compositor state variable (around line 157)
2. Pass to CaptureQuickSettings
3. Default to 'passthrough'

**Implementation**:

```typescript
// Add after line 157 (after storageLocation/fileNamingPattern state)
const [compositor, setCompositor] = useState<'passthrough' | 'grid' | 'sidebyside'>('passthrough');
```

**Update CaptureQuickSettings call** (around line 821):

```typescript
<CaptureQuickSettings
  show={showCaptureQuickSettings}
  onClose={() => setShowCaptureQuickSettings(false)}
  // ... existing props
  compositor={compositor}
  onCompositorChange={setCompositor}
/>
```

### Phase 3: Update Service Integration (60 minutes)

**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/SessionsTopBar.tsx`

**Changes**:

Update `handleStartSession()` function (lines 334-440) to use multi-source recording when 2+ sources selected.

**Implementation**:

```typescript
// In handleStartSession(), replace videoConfig building section (around line 394-435)

// Build video config from video settings
if (videoEnabled) {
  // Check if we need multi-source recording
  const totalSources =
    (captureSource === 'screen' ? selectedDisplayIds.length : 0) +
    (captureSource === 'window' ? selectedWindowIds.length : 0);

  const isMultiSource = totalSources >= 2 ||
    (captureSource === 'screen' && selectedDisplayIds.length > 1) ||
    (captureSource === 'window' && selectedWindowIds.length > 1);

  if (isMultiSource) {
    // Use multi-source recording config
    console.log('🎬 [START SESSION] Multi-source recording detected:', {
      displayIds: selectedDisplayIds,
      windowIds: selectedWindowIds,
      compositor
    });

    // Map displays and windows to RecordingSource[]
    const sources: RecordingSource[] = [
      ...selectedDisplayIds.map(id => ({
        type: 'display' as const,
        id,
        name: displays.find(d => d.displayId === id)?.displayName
      })),
      ...selectedWindowIds.map(id => ({
        type: 'window' as const,
        id,
        name: windows.find(w => w.windowId === id)?.windowName
      }))
    ];

    // Store multi-source config in session
    sessionData.videoConfig = {
      sourceType: 'multi-source', // NEW type
      multiSourceConfig: {
        sources,
        compositor
      },
      quality: videoQuality === 'custom' ? 'medium' : videoQuality,
      fps,
      resolution,
    };
  } else {
    // Single-source recording (existing code)
    sessionData.videoConfig = {
      sourceType: captureSource === 'screen' ? 'display' : captureSource === 'window' ? 'window' : 'webcam',
      displayIds: captureSource === 'screen' && selectedDisplayIds.length > 0 ? selectedDisplayIds : undefined,
      windowIds: captureSource === 'window' && selectedWindowIds.length > 0 ? selectedWindowIds : undefined,
      webcamDeviceId: captureSource === 'webcam' && selectedWebcam ? selectedWebcam : undefined,
      quality: videoQuality === 'custom' ? 'medium' : videoQuality,
      fps,
      resolution,
      pipConfig: webcamPipEnabled ? {
        enabled: true,
        position: pipPosition === 'custom' ? 'bottom-right' : pipPosition,
        size: pipSize === 'custom' ? 'small' : pipSize,
      } : undefined,
    };
  }
}
```

### Phase 4: Update VideoRecordingService Call (30 minutes)

**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/videoRecordingService.ts`

**Changes**:

Update `startRecordingWithConfig()` to detect and call `startMultiSourceRecording()` when appropriate.

**Implementation**:

```typescript
// In startRecordingWithConfig() (lines 394-425), add multi-source detection:

async startRecordingWithConfig(session: Session): Promise<void> {
  console.log('🎬 [VIDEO SERVICE] Starting recording with config:', session.videoConfig);

  await this.ensureVideoDir();

  const appDataDir = await path.appDataDir();
  const videoFileName = `session-${session.id}-${Date.now()}.mp4`;
  const outputPath = await path.join(appDataDir, 'videos', videoFileName);

  this.activeSessionId = session.id;
  this.isRecording = true;

  try {
    if (!session.videoConfig) {
      throw new Error('Video config is required for advanced recording');
    }

    // DETECT MULTI-SOURCE MODE
    if (session.videoConfig.sourceType === 'multi-source' && session.videoConfig.multiSourceConfig) {
      // Use new multi-source recording API
      const multiConfig = session.videoConfig.multiSourceConfig;

      const recordingConfig: RecordingConfig = {
        sessionId: session.id,
        outputPath,
        width: session.videoConfig.resolution?.width || 1920,
        height: session.videoConfig.resolution?.height || 1080,
        fps: session.videoConfig.fps || 30,
        compositor: multiConfig.compositor || 'passthrough',
        sources: multiConfig.sources
      };

      console.log('🎬 [VIDEO SERVICE] Using multi-source recording:', recordingConfig);
      await this.startMultiSourceRecording(recordingConfig);
      return;
    }

    // EXISTING SINGLE-SOURCE CODE (unchanged)
    await invoke('start_video_recording_advanced', {
      sessionId: session.id,
      outputPath,
      config: session.videoConfig,
    });

    console.log('✅ [VIDEO SERVICE] Recording started successfully');
  } catch (error) {
    this.isRecording = false;
    this.activeSessionId = null;
    console.error('❌ [VIDEO SERVICE] Failed to start recording:', error);
    throw error;
  }
}
```

### Phase 5: Update Types (15 minutes)

**File**: `/Users/jamesmcarthur/Documents/taskerino/src/types.ts`

**Changes**:

Update VideoRecordingConfig type to support multi-source mode.

**Implementation**:

```typescript
// In VideoRecordingConfig interface (search for "export interface VideoRecordingConfig")

export interface VideoRecordingConfig {
  sourceType: 'display' | 'window' | 'webcam' | 'multi-source'; // Add 'multi-source'

  // Single-source mode (existing)
  displayIds?: string[];
  windowIds?: string[];
  webcamDeviceId?: string;

  // Multi-source mode (NEW)
  multiSourceConfig?: {
    sources: RecordingSource[];
    compositor: 'passthrough' | 'grid' | 'sidebyside';
  };

  // Common settings
  quality: 'low' | 'medium' | 'high' | 'ultra';
  fps?: number;
  resolution?: { width: number; height: number };
  pipConfig?: PiPConfig;
}

// Add RecordingSource type (if not already defined)
export interface RecordingSource {
  type: 'display' | 'window' | 'webcam';
  id: string;
  name?: string;
}
```

### Phase 6: Testing Checklist (30 minutes)

**Manual Testing**:

1. **Single Display** (baseline - should work as before)
   - [ ] Select 1 display
   - [ ] Compositor section NOT visible
   - [ ] Start session
   - [ ] Verify recording starts
   - [ ] Verify single-source code path used

2. **Multiple Displays** (new functionality)
   - [ ] Select 2 displays
   - [ ] Compositor section appears
   - [ ] Select "Grid" compositor
   - [ ] Start session
   - [ ] Verify multi-source recording starts
   - [ ] Check backend logs for `start_multi_source_recording` call

3. **Multiple Windows** (new functionality)
   - [ ] Select 2 windows
   - [ ] Compositor section appears
   - [ ] Select "Side-by-Side" compositor
   - [ ] Start session
   - [ ] Verify recording captures both windows

4. **Mixed Sources** (display + window)
   - [ ] Select 1 display + 1 window
   - [ ] Compositor section appears
   - [ ] Select "Passthrough" compositor
   - [ ] Start session
   - [ ] Verify backend handles mixed sources

5. **Edge Cases**
   - [ ] Select 2 displays, then remove 1 → Compositor hides
   - [ ] Select displays, change compositor → State updates
   - [ ] Start session with 0 displays → Validation error

---

## Implementation Timeline

| Phase | Task | Time | Total |
|-------|------|------|-------|
| 1 | Add Compositor UI | 45 min | 45 min |
| 2 | Add Compositor State | 15 min | 1h |
| 3 | Update Service Integration | 60 min | 2h |
| 4 | Update VideoRecordingService | 30 min | 2h 30m |
| 5 | Update Types | 15 min | 2h 45m |
| 6 | Testing | 30 min | **3h 15m** |

**Total Estimated Time**: 3-4 hours (frontend-only changes)

---

## Success Criteria

### Must Have ✅

- [ ] Compositor UI appears when 2+ sources selected
- [ ] Compositor UI hides when 1 source selected
- [ ] Multi-source recording starts correctly (2+ displays)
- [ ] Single-source recording still works (backward compatibility)
- [ ] Backend `start_multi_source_recording()` called with correct params
- [ ] Compositor type passed to backend correctly

### Nice to Have 🎯

- [ ] Compositor preview visualization (grid/side-by-side layout diagram)
- [ ] Source count badge ("2 displays selected")
- [ ] Compositor auto-select based on source count (e.g., 2 sources = side-by-side, 4 sources = grid)

### Must Not Break 🚫

- [ ] Single display recording (existing functionality)
- [ ] Webcam-only recording
- [ ] Screenshot capture (unrelated to multi-source video)
- [ ] Audio recording (independent of video sources)
- [ ] "Start Session" button behavior

---

## File Modification Summary

| File | Lines Changed | Type | Risk |
|------|---------------|------|------|
| `CaptureQuickSettings.tsx` | +40 | UI | LOW |
| `SessionsTopBar.tsx` | +60 | State + Logic | MEDIUM |
| `videoRecordingService.ts` | +30 | Service | MEDIUM |
| `types.ts` | +15 | Types | LOW |
| **Total** | **~145 lines** | **Frontend** | **LOW** |

**Risk Assessment**: LOW
- Backend already tested and working
- UI changes are additive (no breaking changes)
- Compositor is optional (defaults to 'passthrough')
- Single-source path unchanged

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ SessionsTopBar (State Management)                       │
│ ├─ selectedDisplayIds: string[]                         │
│ ├─ selectedWindowIds: string[]                          │
│ ├─ compositor: 'passthrough' | 'grid' | 'sidebyside'   │
│ └─ handleStartSession()                                  │
│     ├─ Detect multi-source (2+ displays/windows)        │
│     ├─ Build RecordingConfig                            │
│     └─ Pass to startSession()                           │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ CaptureQuickSettings (UI)                               │
│ ├─ DisplayMultiSelect (EXISTING ✅)                     │
│ ├─ WindowMultiSelect (EXISTING ✅)                      │
│ └─ CompositorRadioGroup (NEW ⭐)                        │
│     └─ Visible only if 2+ sources                       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ videoRecordingService.ts                                 │
│ ├─ startRecordingWithConfig()                           │
│ │   ├─ Detect multiSourceConfig                         │
│ │   └─ Call startMultiSourceRecording()                 │
│ └─ startMultiSourceRecording() (EXISTING ✅)            │
│     ├─ Map sources to displayIds/windowIds              │
│     ├─ Call Rust backend                                │
│     └─ invoke('start_multi_source_recording', ...)      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Rust Backend (EXISTING ✅)                               │
│ ├─ start_multi_source_recording()                       │
│ ├─ Compositor implementations                           │
│ │   ├─ PassthroughCompositor                            │
│ │   ├─ GridCompositor                                   │
│ │   └─ SideBySideCompositor                             │
│ └─ Multi-frame pipeline                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Review this document** with the development team
2. **Create feature branch**: `feature/multi-source-ui-integration`
3. **Implement Phase 1-2** (UI + State) first - test independently
4. **Implement Phase 3-4** (Service integration) - test with backend
5. **Implement Phase 5** (Types) - ensure TypeScript happy
6. **Run full test suite** (Phase 6)
7. **Code review** and merge

---

## Questions & Answers

### Q: Why not add compositor to AdvancedCaptureModal instead?

**A**: CaptureQuickSettings is the primary configuration surface, and compositor is a common setting that users will want to access quickly. AdvancedCaptureModal is for power-user settings (codec, bitrate, custom resolution). Keeping compositor in quick settings follows the "quick access for common features" principle.

### Q: Should we auto-select compositor based on source count?

**A**: We could, but explicit user choice is better. Defaulting to 'passthrough' lets the backend choose intelligently while still allowing users to override. Auto-selecting 'grid' for 4 sources might not match user intent (they might want side-by-side).

### Q: What if the user selects 10 displays?

**A**: The backend compositor handles this gracefully. Grid compositor will create an NxM grid (e.g., 3x4 for 10 sources). Side-by-side will create a horizontal strip (might be narrow per-source). Passthrough will likely choose grid automatically.

### Q: Do we need to update the "Start Session" modal?

**A**: No. The modal uses the same `startSession()` function, and it can pass through `videoConfig` with multi-source settings if the user configures them in quick settings beforehand. The modal is an alternative entry point, not a replacement.

---

## Appendix A: Related Files

### Files to Modify
- `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/SessionsTopBar.tsx`
- `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/CaptureQuickSettings.tsx`
- `/Users/jamesmcarthur/Documents/taskerino/src/services/videoRecordingService.ts`
- `/Users/jamesmcarthur/Documents/taskerino/src/types.ts`

### Files to Reference (No Changes)
- `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/DisplayMultiSelect.tsx` (already multi-select)
- `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/WindowMultiSelect.tsx` (already multi-select)
- `/Users/jamesmcarthur/Documents/taskerino/src/components/SessionsZone.tsx` (parent component)

### Backend Files (No Changes - Already Complete)
- `src-tauri/src/video_recording.rs` (multi-source recording)
- `src-tauri/src/compositor.rs` (grid/side-by-side/passthrough)

---

## Appendix B: Code Snippets

### Compositor Radio Button Icons (Optional Enhancement)

If you want visual icons for each compositor type:

```typescript
// In CaptureQuickSettings.tsx
import { Grid3x3, Columns2, Shuffle } from 'lucide-react';

const compositorIcons = {
  passthrough: <Shuffle size={16} className="text-cyan-600" />,
  grid: <Grid3x3 size={16} className="text-cyan-600" />,
  sidebyside: <Columns2 size={16} className="text-cyan-600" />,
};

// Use in RadioGroup option labels
{
  value: 'grid',
  label: (
    <span className="flex items-center gap-2">
      {compositorIcons.grid}
      Grid Layout
    </span>
  ),
  description: 'Arrange sources in a grid'
}
```

### Source Count Badge (Optional Enhancement)

Show selected source count next to "Capture Source" label:

```typescript
// In CaptureQuickSettings.tsx
<div className="flex items-center justify-between">
  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
    Capture Source
  </h4>
  {(selectedDisplayIds.length + selectedWindowIds.length) > 0 && (
    <span className="text-xs font-semibold text-cyan-600 bg-cyan-50 px-2 py-1 rounded-full">
      {selectedDisplayIds.length + selectedWindowIds.length} source{selectedDisplayIds.length + selectedWindowIds.length !== 1 ? 's' : ''}
    </span>
  )}
</div>
```

---

## Document Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2025-10-24 | Claude Code | Complete rewrite based on actual codebase analysis |
| 2025-10-24 | Claude Code | Added comprehensive integration plan with 6 phases |
| 2025-10-24 | Claude Code | Mapped actual component hierarchy and state management |

