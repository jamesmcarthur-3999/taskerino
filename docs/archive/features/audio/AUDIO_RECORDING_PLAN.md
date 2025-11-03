# Audio Recording Implementation Plan

## Overview

Add audio recording capabilities to Taskerino sessions with two modes:
- **Transcription Mode**: Pure speech-to-text using GPT-4o-mini-transcribe ($0.003/min)
- **Audio Description Mode**: Full audio scene description using GPT-4o-audio-preview ($0.006-0.012/min)

Users can toggle audio recording and screenshot capture ON/OFF during active sessions.

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER STARTS SESSION                      │
│                  (Chooses audio mode: off/transcription/description)│
└─────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RUST AUDIO CAPTURE (Tauri)                    │
│  - Record microphone input (60-second chunks)                    │
│  - Encode to base64 + compress                                   │
│  - Emit 'audio-chunk' event to frontend                          │
└─────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND AudioRecordingService                      │
│  - Receives audio chunk events                                   │
│  - Routes to OpenAI API based on mode:                           │
│    • Transcription: gpt-4o-mini-transcribe                       │
│    • Description: gpt-4o-audio-preview                           │
└─────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                    OPENAI API PROCESSING                         │
│  Transcription Mode: "User said: 'Let's add auth'"              │
│  Description Mode: "User said 'Let's add auth' (confident).     │
│                    Background: Slack notification, music"        │
└─────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                    STORAGE & DISPLAY                             │
│  - Create SessionAudioSegment with transcription/description     │
│  - Store in session timeline                                     │
│  - Pass to Claude for context-aware analysis                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### 1. Type Definitions (`src/types.ts`)

```typescript
// Audio mode options
export type AudioMode = 'off' | 'transcription' | 'description';

// Audio segment data structure
export interface SessionAudioSegment {
  id: string;
  sessionId: string;
  timestamp: string;
  duration: number; // seconds
  transcription: string; // Speech-to-text
  description?: string; // Environmental sounds (description mode only)
  mode: 'transcription' | 'description';
  model: string; // e.g., 'gpt-4o-mini-transcribe'
  // Optional: store raw audio as attachment
  attachmentId?: string;
}

// Update Session interface
export interface Session {
  // ... existing fields ...
  audioMode: AudioMode;
  audioRecording: boolean; // true when actively recording
  audioSegments?: SessionAudioSegment[];
}
```

### 2. Rust Backend (`src-tauri/src/lib.rs`)

**Dependencies needed:**
```toml
[dependencies]
cpal = "0.15" # Cross-platform audio I/O
hound = "3.5"  # WAV encoding
base64 = "0.21"
```

**Commands to implement:**

```rust
// Audio capture state
struct AudioCaptureState {
    active: bool,
    session_id: String,
    buffer: Vec<f32>, // 60 seconds of audio samples
}

#[tauri::command]
fn start_audio_recording(
    state: State<AudioCaptureHandle>,
    session_id: String,
) -> Result<(), String> {
    // Initialize microphone capture
    // Start background thread for 60-second buffering
    // Emit audio chunks to frontend
}

#[tauri::command]
fn stop_audio_recording(state: State<AudioCaptureHandle>) -> Result<(), String> {
    // Stop recording
    // Clear buffer
}

#[tauri::command]
fn pause_audio_recording(state: State<AudioCaptureHandle>) -> Result<(), String> {
    // Pause without clearing buffer
}
```

**Event emission (every 60 seconds):**
```rust
app.emit("audio-chunk", AudioChunkPayload {
    session_id: session_id,
    audio_base64: base64_encoded_wav,
    duration: 60,
    timestamp: now,
})?;
```

### 3. Frontend Audio Service (`src/services/audioRecordingService.ts`)

```typescript
export class AudioRecordingService {
  private activeSessionId: string | null = null;
  private audioMode: AudioMode = 'off';
  private openAIClient: OpenAI | null = null;

  /**
   * Start audio recording for a session
   */
  async startRecording(
    session: Session,
    onAudioSegmentProcessed: (segment: SessionAudioSegment) => void
  ): Promise<void> {
    this.activeSessionId = session.id;
    this.audioMode = session.audioMode;

    // Request microphone permission (browser-level)
    // Start Rust audio capture
    await invoke('start_audio_recording', { sessionId: session.id });

    // Listen for audio chunk events
    await listen('audio-chunk', (event) => {
      this.processAudioChunk(event.payload, onAudioSegmentProcessed);
    });
  }

  /**
   * Process audio chunk through OpenAI
   */
  private async processAudioChunk(
    chunk: AudioChunkPayload,
    callback: (segment: SessionAudioSegment) => void
  ): Promise<void> {
    const model = this.audioMode === 'description'
      ? 'gpt-4o-audio-preview'
      : 'gpt-4o-mini-transcribe';

    // Call OpenAI API
    const response = await this.openAIClient.audio.transcriptions.create({
      file: this.base64ToFile(chunk.audio_base64),
      model: model,
      prompt: this.getPromptForMode(),
    });

    // Create audio segment
    const segment: SessionAudioSegment = {
      id: generateId(),
      sessionId: chunk.session_id,
      timestamp: chunk.timestamp,
      duration: chunk.duration,
      transcription: response.text,
      description: this.audioMode === 'description' ? response.text : undefined,
      mode: this.audioMode,
      model: model,
    };

    // Callback to parent (SessionsZone)
    callback(segment);
  }

  private getPromptForMode(): string {
    if (this.audioMode === 'transcription') {
      return 'Transcribe all speech clearly and accurately.';
    } else {
      return 'Describe all audio: speech (with tone/emotion), music, sounds, notifications, and ambient noise. Provide rich audio description as if for a deaf person.';
    }
  }

  // Stop, pause, resume methods (similar to screenshotCaptureService)
}

export const audioRecordingService = new AudioRecordingService();
```

### 4. OpenAI Integration (`src/services/openAIService.ts`)

```typescript
import OpenAI from 'openai';

export class OpenAIService {
  private client: OpenAI | null = null;

  constructor() {
    this.loadApiKeyFromStorage();
  }

  private loadApiKeyFromStorage() {
    const savedKey = localStorage.getItem('openai-api-key');
    if (savedKey) {
      this.client = new OpenAI({
        apiKey: savedKey.trim(),
        dangerouslyAllowBrowser: true,
      });
    }
  }

  setApiKey(apiKey: string) {
    localStorage.setItem('openai-api-key', apiKey);
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }

  async transcribeAudio(
    audioBase64: string,
    mode: 'transcription' | 'description'
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI API key not set');
    }

    const model = mode === 'description'
      ? 'gpt-4o-audio-preview'
      : 'gpt-4o-mini-transcribe';

    const file = this.base64ToFile(audioBase64, 'audio.wav');

    const response = await this.client.audio.transcriptions.create({
      file: file,
      model: model,
    });

    return response.text;
  }

  private base64ToFile(base64: string, filename: string): File {
    const byteString = atob(base64);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([uint8Array], { type: 'audio/wav' });
    return new File([blob], filename, { type: 'audio/wav' });
  }
}

export const openAIService = new OpenAIService();
```

---

## UI/UX Implementation

### 1. Session Start Modal Updates (`src/components/SessionStartModal.tsx`)

**Add audio mode selector:**

```tsx
<div className="space-y-2">
  <label className="text-sm font-medium">Audio Recording</label>
  <div className="space-y-2">
    <label className="flex items-center gap-2">
      <input
        type="radio"
        name="audioMode"
        value="off"
        checked={audioMode === 'off'}
        onChange={(e) => setAudioMode('off')}
      />
      <span>Off</span>
    </label>

    <label className="flex items-center gap-2">
      <input
        type="radio"
        name="audioMode"
        value="transcription"
        checked={audioMode === 'transcription'}
        onChange={(e) => setAudioMode('transcription')}
      />
      <span>Transcription Only</span>
      <span className="text-xs text-gray-500">(~$0.18/hour)</span>
    </label>

    <label className="flex items-center gap-2">
      <input
        type="radio"
        name="audioMode"
        value="description"
        checked={audioMode === 'description'}
        onChange={(e) => setAudioMode('description')}
      />
      <span>Full Audio Description</span>
      <span className="text-xs text-gray-500">(~$0.36/hour)</span>
    </label>
  </div>

  {audioMode !== 'off' && (
    <p className="text-xs text-gray-600 mt-2">
      {audioMode === 'transcription'
        ? 'Captures speech only. Great for meetings and dictation.'
        : 'Captures speech + environmental sounds. Provides rich context.'}
    </p>
  )}
</div>
```

### 2. Active Session Controls (`src/components/ActiveSessionControls.tsx`)

**New component for in-session toggles:**

```tsx
export function ActiveSessionControls({ session, onUpdate }) {
  const [recording, setRecording] = useState(session.audioRecording);
  const [capturing, setCapturing] = useState(session.screenCapture); // assuming this field exists

  const toggleRecording = async () => {
    if (recording) {
      await audioRecordingService.pauseRecording();
      setRecording(false);
    } else {
      await audioRecordingService.resumeRecording(session, handleAudioSegment);
      setRecording(true);
    }
    onUpdate({ ...session, audioRecording: !recording });
  };

  const toggleCapture = async () => {
    if (capturing) {
      screenshotCaptureService.pauseCapture();
      setCapturing(false);
    } else {
      screenshotCaptureService.resumeCapture(session, handleScreenshot);
      setCapturing(true);
    }
    onUpdate({ ...session, screenCapture: !capturing });
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
      <button
        onClick={toggleRecording}
        className={`flex items-center gap-2 px-3 py-2 rounded-md transition ${
          recording
            ? 'bg-red-500 text-white'
            : 'bg-gray-300 text-gray-700'
        }`}
      >
        <MicrophoneIcon className="w-4 h-4" />
        {recording ? 'Recording' : 'Record Audio'}
      </button>

      <button
        onClick={toggleCapture}
        className={`flex items-center gap-2 px-3 py-2 rounded-md transition ${
          capturing
            ? 'bg-blue-500 text-white'
            : 'bg-gray-300 text-gray-700'
        }`}
      >
        <CameraIcon className="w-4 h-4" />
        {capturing ? 'Capturing' : 'Capture Screenshots'}
      </button>

      {recording && (
        <div className="flex items-center gap-1 text-red-500 animate-pulse">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-sm">Live</span>
        </div>
      )}
    </div>
  );
}
```

### 3. Audio Segment Display (`src/components/SessionTimeline.tsx`)

**Show audio segments in timeline:**

```tsx
{session.audioSegments?.map((segment) => (
  <div key={segment.id} className="flex items-start gap-3 p-3 border-l-4 border-purple-500 bg-purple-50 rounded">
    <MicrophoneIcon className="w-5 h-5 text-purple-600 mt-1" />
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-purple-700">
          {segment.mode === 'description' ? 'Audio Description' : 'Transcription'}
        </span>
        <span className="text-xs text-gray-500">
          {formatTimestamp(segment.timestamp)}
        </span>
      </div>
      <p className="text-sm text-gray-800">{segment.transcription}</p>
      {segment.description && (
        <p className="text-xs text-gray-600 mt-1 italic">{segment.description}</p>
      )}
    </div>
  </div>
))}
```

### 4. Settings Page - OpenAI API Key (`src/components/SettingsPage.tsx`)

```tsx
<div className="space-y-2">
  <label className="text-sm font-medium">OpenAI API Key</label>
  <input
    type="password"
    value={openAIApiKey}
    onChange={(e) => setOpenAIApiKey(e.target.value)}
    placeholder="sk-..."
    className="w-full px-3 py-2 border rounded-md"
  />
  <p className="text-xs text-gray-500">
    Required for audio transcription and description. Get your key from{' '}
    <a href="https://platform.openai.com/api-keys" target="_blank" className="text-blue-500">
      platform.openai.com
    </a>
  </p>
  <button
    onClick={() => openAIService.setApiKey(openAIApiKey)}
    className="px-4 py-2 bg-blue-500 text-white rounded-md"
  >
    Save OpenAI Key
  </button>
</div>
```

---

## Integration with Claude Analysis

### Update `sessionsAgentService.ts`

**Include audio context in screenshot analysis:**

```typescript
private buildContext(session: Session, screenshot: SessionScreenshot): string {
  // ... existing code ...

  // Add recent audio segments as context
  const recentAudio = session.audioSegments
    ?.filter(seg => {
      const segTime = new Date(seg.timestamp).getTime();
      const screenshotTime = new Date(screenshot.timestamp).getTime();
      return segTime <= screenshotTime && (screenshotTime - segTime) < 5 * 60 * 1000; // 5 min window
    })
    .map(seg => {
      if (seg.mode === 'description') {
        return `[Audio at ${seg.timestamp}] ${seg.transcription}\n  Environment: ${seg.description}`;
      } else {
        return `[Audio at ${seg.timestamp}] ${seg.transcription}`;
      }
    })
    .join('\n');

  if (recentAudio) {
    context += `\n\nRECENT AUDIO CONTEXT:\n${recentAudio}`;
  }

  return context;
}
```

**Claude now sees:**
```
SCREENSHOT ANALYSIS REQUEST

RECENT AUDIO CONTEXT:
[Audio at 14:32:15] User said: "Let's implement the authentication feature now"
  Environment: Confident tone. Background: Slack notification sound, instrumental music playing quietly

SCREENSHOT: [image showing IDE with auth code]

What is the user working on?
```

---

## Cost Estimation

### Transcription Mode
- Model: `gpt-4o-mini-transcribe`
- Cost: $0.003/min = $0.18/hour
- Output: Speech only

### Audio Description Mode
- Model: `gpt-4o-audio-preview`
- Cost: ~$0.006-0.012/min = $0.36-0.72/hour
- Output: Speech + environmental sounds

### Combined with Screenshots
- Audio (transcription): $0.18/hour
- Screenshots (2-min interval): ~$0.10-0.20/hour (Claude analysis)
- **Total**: ~$0.28-0.38/hour for full session tracking

---

## Privacy & Security Considerations

1. **Visual Indicators**
   - Red dot animation when recording
   - "Live" badge in active session controls
   - Menu bar icon shows recording state

2. **User Consent**
   - Explicit opt-in during session start
   - Easy toggle to turn off mid-session
   - Clear cost display

3. **Data Storage**
   - Audio segments stored as text (transcription/description only)
   - Option to store raw audio (disabled by default)
   - Audio attachments use same storage as screenshots (Tauri file system)

4. **API Key Security**
   - OpenAI key stored in localStorage (encrypted in production)
   - Never transmitted except to OpenAI API
   - User-provided, not hardcoded

---

## Testing Plan

### Unit Tests
- [ ] Audio capture state management (Rust)
- [ ] 60-second buffering logic
- [ ] OpenAI API integration (mock responses)
- [ ] Audio segment creation and storage

### Integration Tests
- [ ] Start session with audio → Verify recording starts
- [ ] Toggle recording mid-session → Verify state updates
- [ ] Process audio chunk → Verify transcription saved
- [ ] Claude analysis includes audio context

### Manual Testing
- [ ] Record 5-minute session with transcription mode
- [ ] Record 5-minute session with description mode
- [ ] Toggle recording on/off during session
- [ ] Verify audio segments appear in timeline
- [ ] Verify Claude analysis uses audio context
- [ ] Test with no OpenAI key (should show error)
- [ ] Test with invalid OpenAI key (should handle gracefully)

---

## Deployment Checklist

- [ ] Add OpenAI SDK to package.json
- [ ] Add Rust audio dependencies to Cargo.toml
- [ ] Request microphone permission in Tauri capabilities
- [ ] Update app permissions for macOS (Info.plist)
- [ ] Add OpenAI API key setup to onboarding flow
- [ ] Update documentation with audio feature guide
- [ ] Add cost calculator to settings page

---

## Future Enhancements (Phase 2)

1. **System Audio Capture**
   - Capture computer audio (meetings, videos, music)
   - Requires BlackHole or similar virtual audio device on macOS

2. **Real-time Transcription**
   - Stream audio to OpenAI Realtime API
   - Show live transcription in session UI

3. **Speaker Diarization**
   - Identify different speakers in meetings
   - Label transcriptions by speaker

4. **Audio Search**
   - Search sessions by spoken content
   - "Find sessions where I discussed authentication"

5. **Audio Summaries**
   - Claude generates summary of all audio segments
   - "In this session, you discussed X, Y, Z"

---

## File Structure

```
src/
├── services/
│   ├── audioRecordingService.ts          (NEW)
│   ├── openAIService.ts                  (NEW)
│   ├── screenshotCaptureService.ts       (UPDATE - add toggle methods)
│   └── sessionsAgentService.ts           (UPDATE - include audio context)
│
├── components/
│   ├── SessionStartModal.tsx             (UPDATE - add audio mode)
│   ├── ActiveSessionControls.tsx         (NEW)
│   ├── SessionTimeline.tsx               (UPDATE - display audio segments)
│   ├── SettingsPage.tsx                  (UPDATE - add OpenAI key)
│   └── SessionsZone.tsx                  (UPDATE - wire up audio service)
│
├── types.ts                              (UPDATE - add audio types)
│
src-tauri/
└── src/
    └── lib.rs                            (UPDATE - add audio capture commands)
```

---

## Implementation Order

1. ✅ **Planning & Documentation** (this document)
2. **Backend Foundation** (Rust audio capture)
3. **Frontend Services** (OpenAI integration, audio service)
4. **UI Components** (session controls, audio display)
5. **Integration** (wire everything together)
6. **Testing** (end-to-end verification)
7. **Polish** (visual indicators, error handling)

---

**Estimated Implementation Time**: 12-16 hours
**Estimated Testing Time**: 3-4 hours
**Total**: ~15-20 hours for complete audio recording feature
