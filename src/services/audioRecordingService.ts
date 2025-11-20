/**
 * AudioRecordingService
 *
 * Manages audio recording during active sessions.
 * - Records audio at configured intervals
 * - Processes audio through OpenAI (transcription or description)
 * - Creates audio segments for session timeline
 *
 * Note: Current implementation uses placeholder Rust commands.
 * Full audio capture (cpal, buffering) to be implemented in Phase 2.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Session, SessionAudioSegment, AudioDevice, AudioDeviceConfig } from '../types';
import { generateId } from '../utils/helpers';
import { openAIService } from './openAIService';
import { audioStorageService } from './audioStorageService';
import { audioCompressionService } from './audioCompressionService';
import { ParallelAudioQueue, type AudioProcessorDependencies } from './ParallelAudioQueue';
import { LiveSessionEventEmitter } from './liveSession/events';

interface AudioSegmentEvent {
  sessionId: string;
  audioBase64: string;
  duration: number;
}

export class AudioRecordingService {
  private activeSessionId: string | null = null;
  private isRecording: boolean = false;
  private segmentCounter: number = 0; // Track chunk index for storage
  private unlistenAudioChunk: (() => void) | null = null;
  private parallelQueue: ParallelAudioQueue | null = null;

  /**
   * Start audio recording for a session
   */
  async startRecording(
    session: Session,
    onAudioSegmentProcessed: (segment: SessionAudioSegment) => void
  ): Promise<void> {
    console.log(`🎤 [AUDIO SERVICE] startRecording() called for session: ${session.id}`);

    if (!session.audioRecording) {
      console.log('⚠️ [AUDIO SERVICE] Audio recording is OFF, skipping recording');
      return;
    }

    if (!(await openAIService.hasApiKey())) {
      console.error('❌ [AUDIO SERVICE] OpenAI API key not set');
      throw new Error('OpenAI API key not set. Please add your key in Settings.');
    }

    return this.startRecordingWithConfig(session, onAudioSegmentProcessed);
  }

  /**
   * Stop audio recording
   * ALWAYS cleans up state, even if Rust backend stop fails
   */
  async stopRecording(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    console.log('🛑 [AUDIO SERVICE] Stopping audio recording');

    let stopSucceeded = false;
    try {
      await invoke('stop_audio_recording');

      // Grace period: Wait 400ms for in-flight audio chunks to arrive
      // This accounts for:
      // - 100ms: Max delay for Rust processing thread to check stop flag
      // - 100ms: Event delivery latency (Tauri IPC)
      // - 200ms: Safety margin for final chunk processing
      console.log('⏳ [AUDIO SERVICE] Waiting 400ms grace period for pending audio chunks...');
      await new Promise(resolve => setTimeout(resolve, 400));
      stopSucceeded = true;
    } catch (error) {
      console.error('❌ [AUDIO SERVICE] Failed to stop audio recording:', error);
    } finally {
      // CRITICAL: Always cleanup state, even if invoke failed
      // Prevents 40-minute audio bleed bug where listener stays active
      this.isRecording = false;
      this.activeSessionId = null;
      this.segmentCounter = 0;
      this.unlistenAudioChunk?.();
      this.unlistenAudioChunk = null;
      this.parallelQueue = null;

      console.log(stopSucceeded
        ? '✅ [AUDIO SERVICE] Audio recording stopped successfully'
        : '⚠️ [AUDIO SERVICE] Audio recording stopped with errors (cleanup completed)');
    }
  }

  /**
   * Pause audio recording
   */
  async pauseRecording(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    console.log('⏸️  [AUDIO SERVICE] Pausing audio recording');

    try {
      await invoke('pause_audio_recording');
      this.isRecording = false;
      console.log('✅ [AUDIO SERVICE] Audio recording paused');
    } catch (error) {
      console.error('❌ [AUDIO SERVICE] Failed to pause audio recording:', error);
    }
  }

  /**
   * Resume audio recording
   */
  async resumeRecording(
    session: Session,
    onAudioSegmentProcessed: (segment: SessionAudioSegment) => void
  ): Promise<void> {
    if (this.isRecording || !session.audioRecording) {
      return;
    }

    console.log('▶️  [AUDIO SERVICE] Resuming audio recording');
    await this.startRecording(session, onAudioSegmentProcessed);
  }

  /**
   * Process audio chunk (called when audio data is available)
   *
   * Flow:
   * 1. Save original high-quality audio to storage (WAV)
   * 2. Compress audio for API transmission (downsample + MP3 encode)
   * 3. Send compressed audio to OpenAI for transcription
   * 4. Create SessionAudioSegment with attachment reference
   * 5. Notify caller with completed segment
   */
  async processAudioChunk(
    audioBase64: string,
    duration: number,
    sessionId: string,
    onAudioSegmentProcessed: (segment: SessionAudioSegment) => void
  ): Promise<void> {
    if (!this.activeSessionId || this.activeSessionId !== sessionId) {
      console.warn('⚠️  [AUDIO SERVICE] Received audio for inactive session, ignoring');
      return;
    }

    console.log(`🎤 [AUDIO SERVICE] Processing audio chunk (${duration}s, Whisper-1 transcription)`);

    try {
      // 1. Save original high-quality audio to storage
      const segmentIndex = this.segmentCounter++;
      const audioAttachment = await audioStorageService.saveAudioChunk(
        audioBase64,
        sessionId,
        segmentIndex,
        duration
      );

      console.log(`💾 [AUDIO SERVICE] Audio saved: ${audioAttachment.id}`);

      // 2. Compress audio for API transmission
      const compressedAudio = await audioCompressionService.compressForAPI(
        audioBase64,
        'transcription'
      );

      // 3. Transcribe audio using OpenAI Whisper-1 (with compressed version)
      const transcription = await openAIService.transcribeAudio(compressedAudio);

      const timestamp = new Date().toISOString();

      console.log(`📝 [AUDIO SERVICE] Transcription: "${transcription.substring(0, 100)}..."`);

      // 4. Create audio segment with attachment reference
      const segment: SessionAudioSegment = {
        id: generateId(),
        sessionId: sessionId,
        timestamp,
        duration,
        transcription,
        attachmentId: audioAttachment.id, // Link to stored audio file
        hash: audioAttachment.hash, // CA storage hash for direct lookup
      };

      console.log(`✅ [AUDIO SERVICE] Audio segment created: ${segment.id}`);

      // Emit event for Live Session Intelligence
      LiveSessionEventEmitter.emitAudioProcessed(sessionId, segment);

      // 5. Notify caller
      onAudioSegmentProcessed(segment);
    } catch (error) {
      console.error('❌ [AUDIO SERVICE] Failed to process audio chunk:', error);
      // Don't throw - just log the error and continue recording
    }
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get active session ID
   */
  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * Get all available audio devices
   */
  async getAudioDevices(): Promise<AudioDevice[]> {
    try {
      const devices = await invoke<AudioDevice[]>('get_audio_devices');

      // Validate response
      if (!Array.isArray(devices)) {
        throw new Error('Invalid response from get_audio_devices - expected array');
      }

      console.log('🎤 [AUDIO SERVICE] Enumerated devices:', devices);
      return devices;
    } catch (error) {
      console.error('❌ [AUDIO SERVICE] Failed to enumerate devices:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to enumerate audio devices: ${errorMessage}`);
    }
  }

  /**
   * Set audio mix configuration (balance between mic and system audio)
   */
  async setMixConfig(config: AudioDeviceConfig): Promise<void> {
    try {
      // Use update_audio_balance command to set the balance value
      if (config.balance !== undefined) {
        await invoke('update_audio_balance', { balance: config.balance });
        console.log('🎛️ [AUDIO SERVICE] Audio balance updated:', config.balance);
      }
      // Note: Full config management (device switching, volume) is handled by
      // start_audio_recording_with_config when starting recording
      console.log('🎛️ [AUDIO SERVICE] Mix config set:', config);
    } catch (error) {
      console.error('❌ [AUDIO SERVICE] Failed to set mix config:', error);
      throw error;
    }
  }

  /**
   * Get current mix configuration
   * Note: This retrieves the stored config, not the live recording state
   */
  async getMixConfig(): Promise<AudioDeviceConfig | null> {
    try {
      // For now, we don't have a backend command to retrieve the current config
      // The config is managed at the session level and passed when starting recording
      console.warn('⚠️ [AUDIO SERVICE] getMixConfig not implemented - config is session-specific');
      return null;
    } catch (error) {
      console.error('❌ [AUDIO SERVICE] Failed to get mix config:', error);
      return null;
    }
  }

  /**
   * Switch audio input device during active recording
   * Allows changing the microphone without stopping the recording
   * @param deviceId - ID of the new microphone device
   * @throws Error if device switch fails or device ID is invalid
   */
  async switchInputDevice(deviceId: string): Promise<void> {
    if (!deviceId || deviceId.trim() === '') {
      throw new Error('Device ID is required and cannot be empty');
    }

    try {
      console.log('[AUDIO] Switching input device to:', deviceId);
      await invoke('switch_audio_input_device', { deviceId });
      console.log('[AUDIO] Input device switched successfully');
    } catch (error) {
      console.error('[AUDIO] Failed to switch input device:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to switch input device: ${errorMessage}`);
    }
  }

  /**
   * Switch system audio output device during active recording
   * Allows changing the system audio capture device without stopping the recording
   * @param deviceId - ID of the new output device to capture
   * @throws Error if device switch fails or device ID is invalid
   */
  async switchOutputDevice(deviceId: string): Promise<void> {
    if (!deviceId || deviceId.trim() === '') {
      throw new Error('Device ID is required and cannot be empty');
    }

    try {
      console.log('[AUDIO] Switching output device to:', deviceId);
      await invoke('switch_audio_output_device', { deviceId });
      console.log('[AUDIO] Output device switched successfully');
    } catch (error) {
      console.error('[AUDIO] Failed to switch output device:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to switch output device: ${errorMessage}`);
    }
  }

  /**
   * Calculate chunk duration for audio recording
   *
   * Always returns 10 seconds for fast, consistent transcription delivery.
   * Audio processing is independent of screenshot intervals for optimal UX.
   */
  private calculateChunkDuration(session: Session): number {
    console.log('🎤 [AUDIO SERVICE] Using 10s audio chunks (constant)');
    return 10;
  }

  /**
   * Process audio segment from event
   */
  private async processAudioSegment(
    sessionId: string,
    event: AudioSegmentEvent
  ): Promise<SessionAudioSegment | null> {
    try {
      const segmentIndex = this.segmentCounter++;
      const audioAttachment = await audioStorageService.saveAudioChunk(
        event.audioBase64,
        sessionId,
        segmentIndex,
        event.duration
      );

      console.log(`💾 [AUDIO SERVICE] Audio saved: ${audioAttachment.id}`);

      const compressedAudio = await audioCompressionService.compressForAPI(
        event.audioBase64,
        'transcription'
      );

      const transcription = await openAIService.transcribeAudio(compressedAudio);
      const timestamp = new Date().toISOString();

      console.log(`📝 [AUDIO SERVICE] Transcription: "${transcription.substring(0, 100)}..."`);

      const segment: SessionAudioSegment = {
        id: generateId(),
        sessionId: sessionId,
        timestamp,
        duration: event.duration,
        transcription,
        attachmentId: audioAttachment.id,
        hash: audioAttachment.hash, // CA storage hash for direct lookup
      };

      console.log(`✅ [AUDIO SERVICE] Audio segment created: ${segment.id}`);

      // Emit event for Live Session Intelligence
      LiveSessionEventEmitter.emitAudioProcessed(sessionId, segment);

      return segment;
    } catch (error) {
      console.error('❌ [AUDIO SERVICE] Failed to process audio segment:', error);
      return null;
    }
  }

  /**
   * Start recording with specific audio configuration
   */
  async startRecordingWithConfig(
    session: Session,
    onAudioSegmentProcessed: (segment: SessionAudioSegment) => void
  ): Promise<void> {
    if (this.isRecording) {
      console.warn('⚠️ [AUDIO SERVICE] Recording already in progress');
      return;
    }

    console.log('🎙️ [AUDIO SERVICE] Starting recording with config:', session.audioConfig);

    this.activeSessionId = session.id;
    this.isRecording = true;

    const chunkDurationSecs = this.calculateChunkDuration(session);

    // Initialize parallel processing queue (6 concurrent chunks)
    this.parallelQueue = new ParallelAudioQueue(6, {
      saveAudioChunk: (sessionId, audioBase64, duration, timestamp, segmentIndex) =>
        audioStorageService.saveAudioChunk(audioBase64, sessionId, segmentIndex, duration),
      compressForAPI: (audioBase64) =>
        audioCompressionService.compressForAPI(audioBase64, 'transcription'),
      transcribeAudio: (compressedAudio) =>
        openAIService.transcribeAudio(compressedAudio),
      createSegment: (sessionId, audioAttachment, transcription, duration, timestamp, isSilent) => ({
        id: generateId(),
        sessionId,
        timestamp: new Date(timestamp).toISOString(),
        duration,
        transcription,
        attachmentId: audioAttachment.id,
        hash: audioAttachment.hash,
      })
    });

    const unlisten = await listen<AudioSegmentEvent>('audio-chunk', (event) => {
      console.log('🎵 [AUDIO SERVICE] Received audio chunk');

      // FIX: Check event payload sessionId instead of closure-captured session.id
      // This prevents processing chunks from old/ended sessions
      if (!this.isRecording ||
          this.activeSessionId !== event.payload.sessionId ||
          !this.parallelQueue) {
        if (event.payload.sessionId !== this.activeSessionId) {
          console.warn(`⚠️ [AUDIO SERVICE] Ignoring chunk for inactive session (expected: ${this.activeSessionId}, got: ${event.payload.sessionId})`);
        }
        return;
      }

      // Enqueue chunk for parallel processing (6 concurrent chunks)
      const segmentIndex = this.segmentCounter++;
      this.parallelQueue.enqueue({
        sessionId: session.id,
        chunkData: {
          audioBase64: event.payload.audioBase64,
          duration: event.payload.duration,
          timestamp: Date.now(),
          isSilent: false,
          segmentIndex
        },
        callback: (segment) => {
          if (segment) {
            onAudioSegmentProcessed(segment);
          }
        }
      });
    });

    this.unlistenAudioChunk = unlisten;

    try {
      if (session.audioConfig) {
        // Map TypeScript AudioDeviceConfig to Rust AudioDeviceConfig format
        const rustConfig = {
          enableMicrophone: session.audioConfig.sourceType === 'microphone' || session.audioConfig.sourceType === 'both',
          enableSystemAudio: session.audioConfig.sourceType === 'system-audio' || session.audioConfig.sourceType === 'both',
          balance: session.audioConfig.balance || 50,
          microphoneDeviceName: session.audioConfig.micDeviceId || null,
          systemAudioDeviceName: session.audioConfig.systemAudioDeviceId || null,
        };

        await invoke('start_audio_recording_with_config', {
          sessionId: session.id,
          chunkDurationSecs,
          config: rustConfig,
        });
      } else {
        await invoke('start_audio_recording', {
          sessionId: session.id,
          chunkDurationSecs,
        });
      }

      console.log('✅ [AUDIO SERVICE] Recording started successfully');
    } catch (error) {
      this.isRecording = false;
      this.activeSessionId = null;
      this.unlistenAudioChunk?.();
      this.unlistenAudioChunk = null;
      this.parallelQueue = null;
      console.error('❌ [AUDIO SERVICE] Failed to start recording:', error);
      throw error;
    }
  }

}

// Export singleton instance
export const audioRecordingService = new AudioRecordingService();
