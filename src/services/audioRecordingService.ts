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
import type { Session, SessionAudioSegment, AudioMode } from '../types';
import { generateId } from '../utils/helpers';
import { openAIService } from './openAIService';
import { audioStorageService } from './audioStorageService';
import { audioCompressionService } from './audioCompressionService';

export class AudioRecordingService {
  private activeSessionId: string | null = null;
  private isRecording: boolean = false;
  private segmentCounter: number = 0; // Track chunk index for storage

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

    // Check if OpenAI API key is set
    if (!(await openAIService.hasApiKey())) {
      console.error('❌ [AUDIO SERVICE] OpenAI API key not set');
      throw new Error('OpenAI API key not set. Please add your key in Settings.');
    }

    this.activeSessionId = session.id;
    this.isRecording = true;

    // Calculate audio chunk duration based on screenshot mode
    let chunkDurationSecs: number;

    if (session.screenshotInterval === -1) {
      // ADAPTIVE MODE: Use short 20-second chunks to align with dynamic screenshot timing
      // Screenshots can happen every 10s-5min, so 20s chunks stay roughly synchronized
      chunkDurationSecs = 20;
      console.log(`🎤 [AUDIO SERVICE] Adaptive mode: using 20s audio chunks for screenshot alignment`);
    } else {
      // FIXED INTERVAL MODE: Match screenshot interval (capped at 2 minutes max)
      const intervalMinutes = session.screenshotInterval || 2;
      chunkDurationSecs = Math.min(intervalMinutes * 60, 120); // Cap at 2 minutes
      console.log(`🎤 [AUDIO SERVICE] Fixed interval mode: using ${chunkDurationSecs}s chunks (${intervalMinutes}m interval)`);
    }

    // Apply minimum chunk duration (10 seconds)
    chunkDurationSecs = Math.max(10, chunkDurationSecs);

    console.log(`🎤 [AUDIO SERVICE] Starting audio recording with Whisper-1, chunk duration: ${chunkDurationSecs}s`);

    try {
      // Start Rust audio capture with calculated chunk duration
      await invoke('start_audio_recording', {
        sessionId: session.id,
        chunkDurationSecs: chunkDurationSecs
      });
      console.log('✅ [AUDIO SERVICE] Audio recording started');

      // TODO: In Phase 2, listen for 'audio-chunk' events from Rust
      // For now, this is a placeholder
    } catch (error) {
      console.error('❌ [AUDIO SERVICE] Failed to start audio recording:', error);
      throw error;
    }
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

      // Keep accepting audio chunks for 5 more seconds (grace period for in-flight chunks)
      const sessionIdToKeep = this.activeSessionId;
      setTimeout(() => {
        if (this.activeSessionId === sessionIdToKeep) {
          console.log('🧹 [AUDIO SERVICE] Grace period ended, clearing session');
          this.activeSessionId = null;
          this.segmentCounter = 0;
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

}

// Export singleton instance
export const audioRecordingService = new AudioRecordingService();
