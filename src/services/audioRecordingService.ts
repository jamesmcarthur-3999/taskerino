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
   * Keeps session ID active for 5 seconds to allow pending chunks to complete
   */
  async stopRecording(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    console.log('🛑 [AUDIO SERVICE] Stopping audio recording (grace period for pending chunks)');

    try {
      await invoke('stop_audio_recording');
      this.isRecording = false;

      const sessionIdToKeep = this.activeSessionId;
      setTimeout(() => {
        if (this.activeSessionId === sessionIdToKeep) {
          console.log('🧹 [AUDIO SERVICE] Grace period ended, clearing session');
          this.activeSessionId = null;
          this.segmentCounter = 0;
          this.unlistenAudioChunk?.();
          this.unlistenAudioChunk = null;
        }
      }, 5000);

      console.log('✅ [AUDIO SERVICE] Audio recording stopped (accepting pending chunks for 5s)');
    } catch (error) {
      console.error('❌ [AUDIO SERVICE] Failed to stop audio recording:', error);
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
      };

      console.log(`✅ [AUDIO SERVICE] Audio segment created: ${segment.id}`);

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
   * Calculate chunk duration based on screenshot interval
   */
  private calculateChunkDuration(session: Session): number {
    let chunkDurationSecs: number;

    if (session.screenshotInterval === -1) {
      chunkDurationSecs = 20;
      console.log(`🎤 [AUDIO SERVICE] Adaptive mode: using 20s audio chunks for screenshot alignment`);
    } else {
      const intervalMinutes = session.screenshotInterval || 2;
      chunkDurationSecs = Math.min(intervalMinutes * 60, 120);
      console.log(`🎤 [AUDIO SERVICE] Fixed interval mode: using ${chunkDurationSecs}s chunks (${intervalMinutes}m interval)`);
    }

    return Math.max(10, chunkDurationSecs);
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
      };

      console.log(`✅ [AUDIO SERVICE] Audio segment created: ${segment.id}`);
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

    const unlisten = await listen<AudioSegmentEvent>('audio-chunk', async (event) => {
      console.log('🎵 [AUDIO SERVICE] Received audio chunk');

      if (!this.isRecording || this.activeSessionId !== session.id) {
        return;
      }

      try {
        const audioSegment = await this.processAudioSegment(
          session.id,
          event.payload
        );

        if (audioSegment) {
          onAudioSegmentProcessed(audioSegment);
        }
      } catch (error) {
        console.error('❌ [AUDIO SERVICE] Error processing audio chunk:', error);
      }
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
      console.error('❌ [AUDIO SERVICE] Failed to start recording:', error);
      throw error;
    }
  }

}

// Export singleton instance
export const audioRecordingService = new AudioRecordingService();
