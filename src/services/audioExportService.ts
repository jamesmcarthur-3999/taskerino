/**
 * Audio Export Service
 *
 * Handles exporting session audio and transcriptions in various formats:
 * - Audio: MP3, WAV, M4A
 * - Transcriptions: SRT, VTT, TXT, JSON
 * - Combined: Markdown with timestamps, HTML with embedded player
 */

import type { Session, SessionAudioSegment } from '../types';
import { audioConcatenationService } from './audioConcatenationService';
import * as lamejs from '@breezystack/lamejs';

export type AudioExportFormat = 'mp3' | 'wav' | 'm4a';
export type TranscriptionExportFormat = 'srt' | 'vtt' | 'txt' | 'json' | 'markdown';

interface ExportOptions {
  includeTimestamps?: boolean;
  includeSpeakerLabels?: boolean;
  gapDuration?: number; // ms between segments
}

export class AudioExportService {
  /**
   * Export full session audio as MP3
   */
  async exportAudioAsMP3(session: Session, segments: SessionAudioSegment[]): Promise<Blob> {
    console.log(`🎵 [AUDIO EXPORT] Exporting ${segments.length} segments as MP3...`);

    // First, get WAV blob (with session-based caching)
    const wavBlob = await audioConcatenationService.exportAsWAV(segments, {}, session.id);

    // Convert WAV to MP3
    const mp3Blob = await this.convertWAVToMP3(wavBlob);

    console.log(`✅ [AUDIO EXPORT] MP3 export complete: ${(mp3Blob.size / 1024 / 1024).toFixed(1)}MB`);
    return mp3Blob;
  }

  /**
   * Export full session audio as WAV
   */
  async exportAudioAsWAV(session: Session, segments: SessionAudioSegment[]): Promise<Blob> {
    console.log(`🎵 [AUDIO EXPORT] Exporting ${segments.length} segments as WAV...`);

    // Use session-based caching
    const wavBlob = await audioConcatenationService.exportAsWAV(segments, {}, session.id);

    console.log(`✅ [AUDIO EXPORT] WAV export complete: ${(wavBlob.size / 1024 / 1024).toFixed(1)}MB`);
    return wavBlob;
  }

  /**
   * Export transcriptions as SRT subtitle file
   */
  exportTranscriptionAsSRT(session: Session, segments: SessionAudioSegment[], options: ExportOptions = {}): string {
    console.log(`📝 [AUDIO EXPORT] Exporting transcriptions as SRT...`);

    let srt = '';
    let index = 1;
    const currentTime = 0;

    segments.forEach((segment) => {
      const startTime = audioConcatenationService.segmentTimeToSessionTime(segment.id, 0);
      const endTime = startTime + segment.duration;

      // SRT format:
      // 1
      // 00:00:00,000 --> 00:00:05,000
      // Text content
      // (blank line)

      srt += `${index}\n`;
      srt += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`;
      srt += `${segment.transcription}\n`;
      srt += '\n';

      index++;
    });

    console.log(`✅ [AUDIO EXPORT] SRT export complete: ${segments.length} subtitles`);
    return srt;
  }

  /**
   * Export transcriptions as VTT (WebVTT) subtitle file
   */
  exportTranscriptionAsVTT(session: Session, segments: SessionAudioSegment[], options: ExportOptions = {}): string {
    console.log(`📝 [AUDIO EXPORT] Exporting transcriptions as VTT...`);

    let vtt = 'WEBVTT\n\n';

    segments.forEach((segment) => {
      const startTime = audioConcatenationService.segmentTimeToSessionTime(segment.id, 0);
      const endTime = startTime + segment.duration;

      // VTT format:
      // 00:00:00.000 --> 00:00:05.000
      // Text content
      // (blank line)

      vtt += `${this.formatVTTTime(startTime)} --> ${this.formatVTTTime(endTime)}\n`;
      vtt += `${segment.transcription}\n`;
      vtt += '\n';
    });

    console.log(`✅ [AUDIO EXPORT] VTT export complete: ${segments.length} subtitles`);
    return vtt;
  }

  /**
   * Export transcriptions as plain text
   */
  exportTranscriptionAsTXT(session: Session, segments: SessionAudioSegment[], options: ExportOptions = {}): string {
    console.log(`📝 [AUDIO EXPORT] Exporting transcriptions as TXT...`);

    let txt = `Session: ${session.name}\n`;
    txt += `Date: ${new Date(session.startTime).toLocaleString()}\n`;
    txt += `Duration: ${this.formatDuration(session.totalDuration || 0)}\n`;
    txt += `\n${'='.repeat(80)}\n\n`;

    segments.forEach((segment, i) => {
      const startTime = audioConcatenationService.segmentTimeToSessionTime(segment.id, 0);

      if (options.includeTimestamps !== false) {
        txt += `[${this.formatTime(startTime)}] `;
      }

      txt += `${segment.transcription}\n`;

      if (i < segments.length - 1) {
        txt += '\n';
      }
    });

    console.log(`✅ [AUDIO EXPORT] TXT export complete`);
    return txt;
  }

  /**
   * Export transcriptions as JSON (machine-readable)
   */
  exportTranscriptionAsJSON(session: Session, segments: SessionAudioSegment[]): string {
    console.log(`📝 [AUDIO EXPORT] Exporting transcriptions as JSON...`);

    const data = {
      session: {
        id: session.id,
        name: session.name,
        description: session.description,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.totalDuration,
      },
      segments: segments.map(segment => ({
        id: segment.id,
        timestamp: segment.timestamp,
        sessionTime: audioConcatenationService.segmentTimeToSessionTime(segment.id, 0),
        duration: segment.duration,
        transcription: segment.transcription,
        description: segment.description,
        mode: segment.mode,
        model: segment.model,
      })),
      metadata: {
        exportedAt: new Date().toISOString(),
        totalSegments: segments.length,
        totalDuration: session.totalDuration,
      },
    };

    const json = JSON.stringify(data, null, 2);
    console.log(`✅ [AUDIO EXPORT] JSON export complete`);
    return json;
  }

  /**
   * Export as Markdown with embedded timestamps
   */
  exportAsMarkdown(session: Session, segments: SessionAudioSegment[]): string {
    console.log(`📝 [AUDIO EXPORT] Exporting as Markdown...`);

    let md = `# ${session.name}\n\n`;
    md += `**Description:** ${session.description}\n\n`;
    md += `**Date:** ${new Date(session.startTime).toLocaleDateString()}\n\n`;
    md += `**Duration:** ${this.formatDuration(session.totalDuration || 0)}\n\n`;
    md += `---\n\n`;

    md += `## Audio Transcription\n\n`;

    segments.forEach((segment) => {
      const startTime = audioConcatenationService.segmentTimeToSessionTime(segment.id, 0);
      const timeString = this.formatTime(startTime);

      md += `### ${timeString}\n\n`;
      md += `${segment.transcription}\n\n`;

      if (segment.description) {
        md += `*Environment: ${segment.description}*\n\n`;
      }
    });

    // Add session summary if available
    if (session.summary) {
      md += `---\n\n`;
      md += `## Session Summary\n\n`;
      md += `${session.summary.narrative}\n\n`;

      if (session.summary.achievements.length > 0) {
        md += `### Achievements\n\n`;
        session.summary.achievements.forEach(achievement => {
          md += `- ${achievement}\n`;
        });
        md += `\n`;
      }

      if (session.summary.blockers.length > 0) {
        md += `### Blockers\n\n`;
        session.summary.blockers.forEach(blocker => {
          md += `- ${blocker}\n`;
        });
        md += `\n`;
      }
    }

    md += `---\n\n`;
    md += `*Exported from Taskerino on ${new Date().toLocaleString()}*\n`;

    console.log(`✅ [AUDIO EXPORT] Markdown export complete`);
    return md;
  }

  /**
   * Download audio file
   */
  downloadAudioFile(blob: Blob, session: Session, format: AudioExportFormat): void {
    const filename = `${session.name} - ${new Date(session.startTime).toLocaleDateString()}.${format}`;
    this.downloadBlob(blob, filename);
  }

  /**
   * Download transcription file
   */
  downloadTranscriptionFile(content: string, session: Session, format: TranscriptionExportFormat): void {
    const blob = new Blob([content], { type: 'text/plain' });
    const filename = `${session.name} - Transcription.${format}`;
    this.downloadBlob(blob, filename);
  }

  /**
   * Convert WAV blob to MP3 using lamejs
   */
  private async convertWAVToMP3(wavBlob: Blob, bitrate: number = 128): Promise<Blob> {
    console.log(`🔄 [AUDIO EXPORT] Converting WAV to MP3 (${bitrate}kbps)...`);

    // Read WAV file
    const arrayBuffer = await wavBlob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get mono audio data
    const samples = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Convert float32 to int16
    const samples16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      samples16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Create MP3 encoder
    const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, bitrate);
    const mp3Data: Uint8Array[] = [];

    // Encode in chunks
    const chunkSize = 1152;
    for (let i = 0; i < samples16.length; i += chunkSize) {
      const chunk = samples16.subarray(i, i + chunkSize);
      const mp3buf = mp3encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    // Flush remaining data
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    // Combine all MP3 chunks
    const totalLength = mp3Data.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of mp3Data) {
      result.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.length), offset);
      offset += chunk.length;
    }

    console.log(`✅ [AUDIO EXPORT] MP3 conversion complete: ${(result.byteLength / 1024 / 1024).toFixed(1)}MB`);
    return new Blob([result.buffer], { type: 'audio/mp3' });
  }

  /**
   * Format time for SRT (HH:MM:SS,mmm)
   */
  private formatSRTTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Format time for VTT (HH:MM:SS.mmm)
   */
  private formatVTTTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Format time for display (HH:MM:SS or MM:SS)
   */
  private formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(minutes: number): string {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  }

  /**
   * Download blob as file
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    console.log(`💾 [AUDIO EXPORT] Downloaded: ${filename}`);
  }
}

// Export singleton instance
export const audioExportService = new AudioExportService();
