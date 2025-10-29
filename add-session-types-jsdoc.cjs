const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/types.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('\nTask 2: Adding JSDoc to session-related types...\n');

const sessionTypes = [
  {
    pattern: /^export interface SessionScreenshot \{$/m,
    doc: `/**
 * Session Screenshot - Captured screen image with AI analysis
 *
 * Screenshots are automatically captured at intervals (default: 2 min, or adaptive).
 * Each screenshot is analyzed by Claude Vision API to extract:
 * - Activity detection (coding, email, slides, etc.)
 * - OCR text extraction
 * - Context changes (what changed since last screenshot)
 * - Suggested actions (TODOs noticed by AI)
 *
 * STORAGE:
 * - Stored via Content-Addressable Storage (CAS) using attachment hash
 * - attachmentId references deduplicated file in /attachments-ca/
 * - path field is DEPRECATED - use attachmentId instead
 *
 * AI ANALYSIS:
 * - Powered by Sessions Agent (sessionsAgentService.ts)
 * - Adaptive scheduling based on curiosity score (0-1)
 * - Progress tracking (achievements, blockers, insights)
 *
 * @see SessionsAgentService for analysis implementation
 * @see ContentAddressableStorage for storage system
 *
 * @example
 * \`\`\`typescript
 * {
 *   id: 'screenshot-123',
 *   sessionId: 'session-456',
 *   timestamp: '2025-10-26T14:30:00Z',
 *   attachmentId: 'att-789',  // ✅ New (CAS reference)
 *   path: '/screenshots/img.png',  // ❌ Deprecated
 *   analysisStatus: 'complete',
 *   aiAnalysis: {
 *     summary: 'Writing authentication logic in VS Code',
 *     detectedActivity: 'coding',
 *     extractedText: 'function validateToken(token: string) {...}',
 *     keyElements: ['VS Code', 'TypeScript', 'auth.ts'],
 *     confidence: 0.95,
 *     curiosity: 0.7,  // High interest - next screenshot sooner
 *     curiosityReason: 'Implementing new feature - want to see progress'
 *   }
 * }
 * \`\`\`
 */
export interface SessionScreenshot {`
  },
  {
    pattern: /^export interface SessionAudioSegment \{$/m,
    doc: `/**
 * Session Audio Segment - Recorded audio chunk with transcription
 *
 * Audio is recorded in 10-second segments and transcribed using OpenAI Whisper-1.
 * Segments are later upgraded to word-level transcripts during ONE-TIME audio review.
 *
 * STORAGE:
 * - Audio WAV file stored via Content-Addressable Storage
 * - attachmentId references deduplicated audio in /attachments-ca/
 * - Compressed MP3 version available in attachment.compressed field
 *
 * TRANSCRIPTION QUALITY:
 * - draft: Initial 10s chunk transcript from Whisper-1 (real-time)
 * - final: Word-accurate transcript from full session re-transcription (ONE-TIME review)
 *
 * AI METADATA:
 * - keyPhrases: Important phrases extracted from this segment
 * - sentiment: Emotional tone (positive/neutral/negative)
 * - containsTask/containsBlocker: AI-detected flags for summary generation
 *
 * @see OpenAI Whisper-1 for transcription
 * @see AudioInsights for ONE-TIME comprehensive audio review
 *
 * @example
 * \`\`\`typescript
 * {
 *   id: 'audio-123',
 *   sessionId: 'session-456',
 *   timestamp: '2025-10-26T14:30:00Z',
 *   duration: 10,
 *   transcription: 'Okay so I need to implement OAuth authentication...',
 *   attachmentId: 'att-audio-789',
 *   transcriptionQuality: 'draft',  // Will become 'final' after ONE-TIME review
 *   enrichedTranscription: 'Okay, so I need to implement OAuth authentication.',  // Word-accurate
 *   keyPhrases: ['OAuth', 'authentication', 'implement'],
 *   sentiment: 'neutral',
 *   containsTask: true
 * }
 * \`\`\`
 */
export interface SessionAudioSegment {`
  },
  {
    pattern: /^export interface SessionVideo \{$/m,
    doc: `/**
 * Session Video - Full session screen recording with intelligent chunking
 *
 * Records the entire session as a single video file, then optionally chunks it
 * into topic-aligned segments for easier navigation and on-demand analysis.
 *
 * STORAGE:
 * - Full video stored via Content-Addressable Storage
 * - fullVideoAttachmentId references complete recording
 * - chunks[] are separate video files for each topic segment
 *
 * VIDEO CHAPTERS:
 * - AI-detected semantic boundaries in the recording
 * - chapters[] provides thumbnail + summary for each topic change
 * - Generated during enrichment pipeline (optional, user-configurable)
 *
 * CHUNKING STATUS:
 * - pending: Not yet processed
 * - processing: Currently analyzing and splitting video
 * - complete: All chunks generated
 * - error: Chunking failed (see chunkingError)
 *
 * @see VideoChapter for chapter structure
 * @see SessionVideoChunk for chunked segment details
 * @see EnrichmentPipeline for video chapter generation
 *
 * @example
 * \`\`\`typescript
 * {
 *   id: 'video-123',
 *   sessionId: 'session-456',
 *   fullVideoAttachmentId: 'att-video-789',
 *   duration: 3600,  // 1 hour
 *   chunkingStatus: 'complete',
 *   chapters: [
 *     {
 *       id: 'chapter-1',
 *       startTime: 0,
 *       endTime: 900,
 *       title: 'Setting up authentication flow',
 *       summary: 'Configured OAuth provider and created login endpoint',
 *       keyTopics: ['OAuth', 'login', 'backend']
 *     },
 *     {
 *       id: 'chapter-2',
 *       startTime: 900,
 *       endTime: 1800,
 *       title: 'Debugging token validation',
 *       summary: 'Fixed JWT expiration handling issues',
 *       keyTopics: ['JWT', 'debugging', 'tokens']
 *     }
 *   ]
 * }
 * \`\`\`
 */
export interface SessionVideo {`
  },
  {
    pattern: /^export interface VideoChapter \{$/m,
    doc: `/**
 * Video Chapter - Semantic segment of a session video
 *
 * AI-detected topic boundaries in session recordings. Each chapter represents
 * a distinct phase of work (e.g., "Implementing feature X", "Debugging issue Y").
 *
 * DETECTION:
 * - AI analyzes video frames for context switches
 * - Detects app changes, file switches, topic transitions
 * - Confidence score (0-1) indicates boundary certainty
 *
 * PURPOSE:
 * - Navigate long recordings quickly
 * - Jump to specific work phases
 * - Understand session structure at a glance
 *
 * @see SessionVideo for parent video
 * @see EnrichmentPipeline for chapter generation
 *
 * @example
 * \`\`\`typescript
 * {
 *   id: 'chapter-abc123',
 *   sessionId: 'session-456',
 *   startTime: 600,   // 10 minutes from session start
 *   endTime: 1200,    // 20 minutes (10-minute chapter)
 *   title: 'Implementing OAuth callback handler',
 *   summary: 'Created callback endpoint and validated tokens',
 *   keyTopics: ['OAuth', 'callback', 'token validation'],
 *   thumbnail: 'data:image/png;base64,...',  // First frame of chapter
 *   confidence: 0.92,  // High confidence in this boundary
 *   createdAt: '2025-10-26T15:00:00Z'
 * }
 * \`\`\`
 */
export interface VideoChapter {`
  },
  {
    pattern: /^export interface SessionContextItem \{$/m,
    doc: `/**
 * Session Context Item - User-added notes/markers during session
 *
 * Manual context added by user while session is active:
 * - Quick notes about what they're doing
 * - Markers for important moments
 * - Links to existing tasks/notes
 *
 * TYPES:
 * - note: Free-form text note
 * - task: Action item (can create Task later)
 * - marker: Timestamp marker (e.g., "Started debugging here")
 *
 * LINKING:
 * - linkedItemId: References existing Note or Task
 * - Allows associating session work with existing items
 *
 * DEPRECATED FIELDS:
 * - noteId/taskId: Legacy linking (use linkedItemId instead)
 *
 * @see Session.contextItems for all context in a session
 *
 * @example
 * \`\`\`typescript
 * {
 *   id: 'context-123',
 *   sessionId: 'session-456',
 *   timestamp: '2025-10-26T14:30:00Z',
 *   type: 'note',
 *   content: 'Discovered that token expiration handling was broken',
 *   linkedItemId: 'note-789'  // Links to existing note
 * }
 * \`\`\`
 */
export interface SessionContextItem {`
  },
  {
    pattern: /^export interface AudioDeviceConfig \{$/m,
    doc: `/**
 * Audio Device Configuration - Audio input settings for session
 *
 * Configures which audio sources to record during a session:
 * - Microphone only (voice narration)
 * - System audio only (app sounds, music)
 * - Both (mixed with configurable balance)
 *
 * DEVICE SELECTION:
 * - micDeviceId: Specific microphone (from AudioDevice list)
 * - systemAudioDeviceId: System audio loopback device
 * - undefined values = use system default
 *
 * MIXING:
 * - balance: 0 = all mic, 100 = all system audio, 50 = equal mix
 * - micVolume/systemVolume: Individual volume controls (0.0-1.0)
 *
 * @see AudioDevice for available devices
 * @see Session.audioConfig for per-session configuration
 *
 * @example
 * \`\`\`typescript
 * {
 *   sourceType: 'both',  // Record mic + system audio
 *   micDeviceId: 'mic-device-123',
 *   systemAudioDeviceId: 'loopback-device-456',
 *   balance: 30,  // 30% mic, 70% system audio
 *   micVolume: 0.8,
 *   systemVolume: 0.5
 * }
 * \`\`\`
 */
export interface AudioDeviceConfig {`
  },
  {
    pattern: /^export interface VideoRecordingConfig \{$/m,
    doc: `/**
 * Video Recording Configuration - Screen recording settings for session
 *
 * Configures what to record during a session:
 * - Which display(s) to capture
 * - Whether to include webcam (Picture-in-Picture)
 * - Video quality and frame rate
 *
 * SOURCE TYPES:
 * - display: Record one or more displays
 * - window: Record specific application windows
 * - webcam: Record webcam only
 * - display-with-webcam: Display + webcam overlay (PiP)
 * - multi-source: Multiple sources with compositing (Wave 1.3)
 *
 * QUALITY PRESETS:
 * - low: 720p @ 15fps (~200MB/hour)
 * - medium: 1080p @ 30fps (~500MB/hour)
 * - high: 1080p @ 60fps (~1GB/hour)
 * - ultra: 4K @ 60fps (~3GB/hour)
 *
 * PICTURE-IN-PICTURE:
 * - pipConfig.position: Where to overlay webcam
 * - pipConfig.size: Webcam overlay size
 * - pipConfig.borderRadius: Rounded corners
 *
 * @see DisplayInfo for available displays
 * @see WindowInfo for available windows
 * @see WebcamInfo for available cameras
 * @see PiPConfig for overlay configuration
 *
 * @example
 * \`\`\`typescript
 * {
 *   sourceType: 'display-with-webcam',
 *   displayIds: ['display-main'],
 *   webcamDeviceId: 'facetime-camera',
 *   pipConfig: {
 *     enabled: true,
 *     position: 'bottom-right',
 *     size: 'small',
 *     borderRadius: 8
 *   },
 *   quality: 'medium',  // 1080p @ 30fps
 *   fps: 30
 * }
 * \`\`\`
 */
export interface VideoRecordingConfig {`
  }
];

let count = 0;
for (const {pattern, doc} of sessionTypes) {
  if (content.match(pattern)) {
    content = content.replace(pattern, doc);
    count++;
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`✓ Added ${count}/7 JSDoc comments to session-related types`);
console.log('\nTask 2 complete!');
