/**
 * Audio Loader Utility
 *
 * Centralized audio data loading from ContentAddressableStorage.
 * Handles loading individual segments, time ranges, and full session audio.
 */

import type { Session, SessionAudioSegment } from '../../../types';
import { getCAStorage } from '../../storage/ContentAddressableStorage';
import { audioConcatenationService } from '../../audioConcatenationService';
import { invoke } from '@tauri-apps/api/core';
import {
  audioDataNotFoundError,
  noAudioSegmentsError,
  storageError,
  logInfo,
  logWarning,
  createToolError
} from './errorHandling';
import {
  hasAudioRecording,
  getAudioSegmentsInRange,
  getVideoPath
} from './sessionLoader';

/**
 * Load audio data for a single segment
 */
export async function loadSegmentAudio(
  segment: SessionAudioSegment,
  format: 'wav' | 'mp3' = 'mp3'
): Promise<{ audioBase64: string; duration: number; sampleRate?: number; channels?: number }> {
  try {
    logInfo('AudioLoader', `Loading audio for segment: ${segment.id}`, { format });

    const caStorage = await getCAStorage();

    // Use hash if available (Phase 4), fallback to attachmentId
    const identifier = segment.hash || segment.attachmentId;

    if (!identifier) {
      throw audioDataNotFoundError(segment.id);
    }

    const attachment = await caStorage.loadAttachment(identifier);

    if (!attachment || !attachment.base64) {
      throw audioDataNotFoundError(identifier);
    }

    // Attachment is stored as WAV
    let audioBase64 = attachment.base64;

    // Convert to MP3 if requested
    if (format === 'mp3') {
      // Import audioCompressionService for conversion
      const { audioCompressionService } = await import('../../audioCompressionService');
      audioBase64 = await audioCompressionService.compressForAPI(audioBase64, 'transcription');
      logInfo('AudioLoader', `Converted segment audio to MP3: ${segment.id}`);
    }

    return {
      audioBase64,
      duration: segment.duration,
      sampleRate: 16000, // Standard for our recordings
      channels: 1 // Mono
    };

  } catch (error) {
    throw storageError('load segment audio', error, { segmentId: segment.id, format });
  }
}

/**
 * Load audio for a time range (multiple segments)
 */
export async function loadTimeRangeAudio(
  session: Session,
  startTime: number,
  endTime: number,
  format: 'wav' | 'mp3' = 'mp3'
): Promise<{ audioBase64: string; duration: number; segments: SessionAudioSegment[] }> {
  if (!hasAudioRecording(session)) {
    throw noAudioSegmentsError(session.id);
  }

  try {
    logInfo('AudioLoader', `Loading audio for time range: ${startTime}s - ${endTime}s`, {
      sessionId: session.id,
      format
    });

    // Get segments in range
    const segments = getAudioSegmentsInRange(session, startTime, endTime);

    if (segments.length === 0) {
      logWarning('AudioLoader', `No audio segments found in range ${startTime}s - ${endTime}s`);
      throw new Error(`No audio segments found in time range ${startTime}s - ${endTime}s`);
    }

    // Build timeline for concatenation
    audioConcatenationService.buildTimeline(segments);
    const totalDuration = audioConcatenationService.getTotalDuration();

    // Generate concatenated WAV
    const wavBlob = await audioConcatenationService.exportDownsampledWAV(segments, 16000);
    const wavBase64 = await blobToBase64(wavBlob);

    let audioBase64 = wavBase64;

    // Convert to MP3 if requested
    if (format === 'mp3') {
      const { audioCompressionService } = await import('../../audioCompressionService');
      audioBase64 = await audioCompressionService.compressForAPI(wavBase64, 'transcription');
      logInfo('AudioLoader', `Converted time range audio to MP3`);
    }

    logInfo('AudioLoader', `Loaded audio for ${segments.length} segments (${totalDuration.toFixed(1)}s)`);

    return {
      audioBase64,
      duration: totalDuration,
      segments
    };

  } catch (error) {
    throw storageError('load time range audio', error, {
      sessionId: session.id,
      startTime,
      endTime,
      format
    });
  }
}

/**
 * Load full session audio
 * Prefers optimized MP3 if available, falls back to WAV concatenation
 */
export async function loadFullSessionAudio(
  session: Session,
  format: 'wav' | 'mp3' = 'mp3'
): Promise<{ audioBase64: string; duration: number; segments: SessionAudioSegment[] }> {
  if (!hasAudioRecording(session)) {
    throw noAudioSegmentsError(session.id);
  }

  try {
    logInfo('AudioLoader', `Loading full session audio: ${session.id}`, { format });

    // Check for optimized MP3 from background processing
    const videoPath = getVideoPath(session);
    if (videoPath && videoPath.endsWith('.mp3')) {
      logInfo('AudioLoader', `Using pre-optimized MP3: ${videoPath}`);

      try {
        // Read the optimized MP3 file
        const fs = await import('@tauri-apps/plugin-fs');
        const audioBuffer = await fs.readFile(videoPath);
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        let audioBase64 = await blobToBase64(audioBlob);

        // Convert to WAV if requested (unlikely, but supported)
        if (format === 'wav') {
          logWarning('AudioLoader', 'Converting optimized MP3 to WAV (inefficient)');
          // TODO: Implement MP3 to WAV conversion if needed
          // For now, fall through to concatenation path
        } else {
          const totalDuration = session.audioSegments!.reduce((sum, seg) => sum + seg.duration, 0);

          return {
            audioBase64,
            duration: totalDuration,
            segments: session.audioSegments!
          };
        }
      } catch (error) {
        logWarning('AudioLoader', `Failed to load optimized MP3, falling back to concatenation: ${error}`);
        // Fall through to concatenation
      }
    }

    // LEGACY PATH: Concatenate audio segments
    logInfo('AudioLoader', `Concatenating ${session.audioSegments!.length} audio segments`);

    audioConcatenationService.buildTimeline(session.audioSegments!);
    const totalDuration = audioConcatenationService.getTotalDuration();

    // Generate WAV
    const wavBlob = await audioConcatenationService.exportDownsampledWAV(
      session.audioSegments!,
      16000 // 16kHz sample rate
    );
    const wavBase64 = await blobToBase64(wavBlob);

    let audioBase64 = wavBase64;

    // Convert to MP3 if requested
    if (format === 'mp3') {
      const { audioCompressionService } = await import('../../audioCompressionService');
      audioBase64 = await audioCompressionService.compressForAPI(wavBase64, 'transcription');
      logInfo('AudioLoader', `Converted full session audio to MP3`);
    }

    logInfo('AudioLoader', `Loaded full session audio (${totalDuration.toFixed(1)}s)`);

    return {
      audioBase64,
      duration: totalDuration,
      segments: session.audioSegments!
    };

  } catch (error) {
    throw storageError('load full session audio', error, {
      sessionId: session.id,
      format
    });
  }
}

/**
 * Convert Blob to base64 string
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Generate waveform data from audio (for visualization)
 */
export async function generateWaveform(
  audioBase64: string,
  sampleCount: number = 100
): Promise<number[]> {
  try {
    // Decode base64 audio
    const audioData = atob(audioBase64.split(',')[1]);
    const bytes = new Uint8Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      bytes[i] = audioData.charCodeAt(i);
    }

    // Create AudioContext
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);

    // Extract channel data
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / sampleCount);

    // Calculate RMS for each block
    const waveform: number[] = [];
    for (let i = 0; i < sampleCount; i++) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channelData.length);

      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += channelData[j] * channelData[j];
      }

      const rms = Math.sqrt(sum / (end - start));
      waveform.push(rms);
    }

    // Normalize to 0-1 range
    const max = Math.max(...waveform);
    return waveform.map(v => v / max);

  } catch (error) {
    logWarning('AudioLoader', `Failed to generate waveform: ${error}`);
    // Return empty waveform on error
    return new Array(sampleCount).fill(0);
  }
}

/**
 * Estimate audio file size
 */
export function estimateAudioSize(
  duration: number,
  format: 'wav' | 'mp3',
  sampleRate: number = 16000
): { bytes: number; megabytes: number } {
  let bytes: number;

  if (format === 'wav') {
    // WAV: sampleRate * duration * 2 bytes (16-bit) * channels (1 for mono)
    bytes = sampleRate * duration * 2;
  } else {
    // MP3: ~64 kbps for our compression
    bytes = (64 * 1000 / 8) * duration;
  }

  return {
    bytes,
    megabytes: bytes / (1024 * 1024)
  };
}
