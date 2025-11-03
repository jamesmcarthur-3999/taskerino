/**
 * Audio Review Service
 *
 * Handles one-time comprehensive audio review using GPT-4o-audio-preview.
 * Only runs when user first opens summary page for a completed session.
 *
 * Flow:
 * 1. Check if session needs review (has audio segments, not yet reviewed)
 * 2. Generate concatenated audio and compress to MP3 (16kHz @ 64kbps)
 * 3. Check size/duration constraints (25MB / 25min limits)
 * 4. Send to GPT-4o-audio-preview with comprehensive prompt
 * 5. Parse and structure JSON response
 * 6. Save results to session with audioReviewCompleted = true
 * 7. Handle large sessions with chunking if needed
 */

import type { Session, SessionAudioSegment, AudioInsights } from '../types';
import { audioConcatenationService } from './audioConcatenationService';
import { audioStorageService } from './audioStorageService';
import { openAIService } from './openAIService';
import { transcriptUpgradeService } from './transcriptUpgradeService';
import { audioCompressionService } from './audioCompressionService';

export interface AudioReviewResult {
  fullTranscription: string;
  insights: AudioInsights;
  fullAudioAttachmentId: string;
  upgradedSegments?: SessionAudioSegment[]; // Upgraded transcript segments
}

export interface AudioReviewProgress {
  stage: 'preparing' | 'concatenating' | 'analyzing' | 'upgrading-transcripts' | 'parsing' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
}

export class AudioReviewService {
  private readonly MAX_FILE_SIZE_MB = 23; // Leave 2MB buffer below 25MB limit (MP3 compressed)
  private readonly MAX_DURATION_SECONDS = 1440; // 24 minutes (leave buffer below 25min limit)
  private readonly CHUNK_DURATION_SECONDS = 900; // 15 minutes per chunk

  /**
   * Check if session needs audio review
   */
  needsReview(session: Session): boolean {
    return (
      session.audioSegments !== undefined &&
      session.audioSegments.length > 0 &&
      !session.audioReviewCompleted
    );
  }

  /**
   * Perform comprehensive audio review
   *
   * @param session - Session to review
   * @param onProgress - Callback for progress updates
   * @returns Review results
   */
  async reviewSession(
    session: Session,
    onProgress?: (progress: AudioReviewProgress) => void
  ): Promise<AudioReviewResult> {
    console.log(`🎧 [AUDIO REVIEW] Starting comprehensive review for session: ${session.id}`);

    try {
      // Stage 1: Preparation
      onProgress?.({
        stage: 'preparing',
        message: 'Preparing audio segments...',
        progress: 10,
      });

      if (!session.audioSegments || session.audioSegments.length === 0) {
        throw new Error('No audio segments to review');
      }

      // OPTIMIZATION: Check if we already have optimized MP3 from background processing
      let audioBase64: string;
      let totalDuration: number;
      let fullAudioAttachment: Awaited<ReturnType<typeof audioStorageService.saveFullSessionAudio>>;
      let wavBase64: string | undefined; // Only available for legacy path (needed for transcript upgrade)

      if (session.video?.optimizedPath && session.video.optimizedPath.endsWith('.mp3')) {
        console.log(`🎵 [AUDIO REVIEW] Using pre-optimized MP3 from background processing: ${session.video.optimizedPath}`);

        onProgress?.({
          stage: 'preparing',
          message: 'Loading optimized audio...',
          progress: 30,
        });

        // Read the optimized MP3 file and convert to base64
        const fs = await import('@tauri-apps/plugin-fs');
        const audioBuffer = await fs.readFile(session.video.optimizedPath);
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        audioBase64 = await this.blobToBase64(audioBlob);

        // Use duration from video object or calculate from audioSegments
        totalDuration = session.video.duration ||
          session.audioSegments.reduce((sum, seg) => sum + seg.duration, 0);

        // Create attachment record for the optimized MP3
        fullAudioAttachment = await audioStorageService.saveFullSessionAudio(
          audioBase64,
          session.id,
          totalDuration
        );

        console.log(`✅ [AUDIO REVIEW] Loaded optimized MP3: ${totalDuration.toFixed(1)}s`);
      } else {
        // LEGACY PATH: Concatenate audio segments (for old sessions without optimized MP3)
        console.log(`🎧 [AUDIO REVIEW] No optimized MP3 found, concatenating audio segments...`);

        onProgress?.({
          stage: 'concatenating',
          message: 'Creating full audio file...',
          progress: 30,
        });

        // Build timeline and generate downsampled WAV (8kHz mono)
        audioConcatenationService.buildTimeline(session.audioSegments);
        totalDuration = audioConcatenationService.getTotalDuration();

        console.log(`🎧 [AUDIO REVIEW] Total duration: ${totalDuration.toFixed(1)}s`);

        // Check if we need to chunk
        if (totalDuration > this.MAX_DURATION_SECONDS) {
          console.log(`⚠️  [AUDIO REVIEW] Session exceeds ${this.MAX_DURATION_SECONDS}s, using chunking strategy`);
          return await this.reviewInChunks(session, onProgress);
        }

        // Generate audio WAV (16kHz for better quality before MP3 compression)
        const wavBlob = await audioConcatenationService.exportDownsampledWAV(
          session.audioSegments,
          16000 // 16kHz - matches GPT-4o internal processing
        );

        // Convert to base64
        wavBase64 = await this.blobToBase64(wavBlob);

        // Compress to MP3 for efficient transmission
        // Use 'transcription' mode: 16kHz @ 64kbps (optimal for GPT-4o which processes at 16kHz)
        console.log(`🗜️  [AUDIO REVIEW] Compressing audio to MP3...`);
        audioBase64 = await audioCompressionService.compressForAPI(wavBase64, 'transcription');

        // Extract size from base64 (rough estimate: base64 length * 0.75)
        const base64Data = audioBase64.split(',')[1] || audioBase64;
        const fileSizeMB = (base64Data.length * 0.75) / 1024 / 1024;
        console.log(`🎧 [AUDIO REVIEW] Compressed audio: ${fileSizeMB.toFixed(1)}MB, ${totalDuration.toFixed(1)}s`);

        // Check file size
        if (fileSizeMB > this.MAX_FILE_SIZE_MB) {
          console.log(`⚠️  [AUDIO REVIEW] File exceeds ${this.MAX_FILE_SIZE_MB}MB, using chunking strategy`);
          return await this.reviewInChunks(session, onProgress);
        }

        // Save full audio attachment
        fullAudioAttachment = await audioStorageService.saveFullSessionAudio(
          audioBase64,
          session.id,
          totalDuration
        );
      }

      // Stage 3: AI Analysis
      onProgress?.({
        stage: 'analyzing',
        message: 'Analyzing audio with AI...',
        progress: 50,
      });

      const startTime = Date.now();

      // Send to GPT-4o-audio-preview
      const analysisResult = await openAIService.analyzeFullAudio(audioBase64, {
        sessionName: session.name,
        sessionDescription: session.description,
        duration: totalDuration,
        screenshotCount: session.screenshots.length,
        segmentCount: session.audioSegments.length,
      });

      const processingDuration = (Date.now() - startTime) / 1000;
      console.log(`✅ [AUDIO REVIEW] AI analysis complete in ${processingDuration.toFixed(1)}s`);

      // Stage 4: Upgrade segment transcripts with word-level timestamps
      // Only run if we have WAV data (legacy path) - optimized MP3 path skips this
      let upgradedSegments: SessionAudioSegment[] | undefined;
      if (wavBase64) {
        onProgress?.({
          stage: 'upgrading-transcripts',
          message: 'Ned is cleaning up the transcript...',
          progress: 70,
        });

        try {
          upgradedSegments = await transcriptUpgradeService.upgradeSegmentTranscripts(
            session,
            wavBase64 // Use uncompressed WAV for Whisper accuracy
          );
          console.log(`✅ [AUDIO REVIEW] Transcript upgrade complete: ${upgradedSegments.length} segments upgraded`);
        } catch (error: any) {
          console.warn(`⚠️  [AUDIO REVIEW] Transcript upgrade failed, keeping draft transcripts:`, error.message);
          // Not fatal - continue with draft transcripts
        }
      } else {
        console.log(`⏭️  [AUDIO REVIEW] Skipping transcript upgrade (optimized MP3 path - no WAV data available)`);
      }

      // Stage 5: Parse and structure results
      onProgress?.({
        stage: 'parsing',
        message: 'Structuring insights...',
        progress: 90,
      });

      const insights: AudioInsights = {
        ...analysisResult.insights,
        processedAt: new Date().toISOString(),
        modelUsed: 'gpt-4o-audio-preview',
        processingDuration,
      };

      // Stage 6: Complete
      onProgress?.({
        stage: 'complete',
        message: 'Review complete!',
        progress: 100,
      });

      return {
        fullTranscription: analysisResult.transcription,
        insights,
        fullAudioAttachmentId: fullAudioAttachment.id,
        upgradedSegments,
      };
    } catch (error: any) {
      console.error('❌ [AUDIO REVIEW] Review failed:', error);

      onProgress?.({
        stage: 'error',
        message: error.message || 'Review failed',
        progress: 0,
      });

      throw error;
    }
  }

  /**
   * Handle large sessions by chunking audio into smaller pieces
   * Process each chunk separately and merge insights programmatically
   */
  private async reviewInChunks(
    session: Session,
    onProgress?: (progress: AudioReviewProgress) => void
  ): Promise<AudioReviewResult> {
    console.log(`🎧 [AUDIO REVIEW] Using chunking strategy for large session`);

    if (!session.audioSegments) {
      throw new Error('No audio segments');
    }

    // Split segments into chunks of ~15 minutes
    const chunks = this.splitIntoChunks(session.audioSegments, this.CHUNK_DURATION_SECONDS);
    console.log(`🎧 [AUDIO REVIEW] Split into ${chunks.length} chunks`);

    const chunkResults: Array<{
      transcription: string;
      insights: AudioInsights;
    }> = [];

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkProgress = 30 + (60 / chunks.length) * i;

      onProgress?.({
        stage: 'analyzing',
        message: `Analyzing chunk ${i + 1} of ${chunks.length}...`,
        progress: chunkProgress,
      });

      // Generate audio for this chunk
      const chunkWavBlob = await audioConcatenationService.exportDownsampledWAV(chunk, 16000);
      const chunkWavBase64 = await this.blobToBase64(chunkWavBlob);

      // Compress to MP3 (transcription mode: 16kHz @ 64kbps)
      const chunkBase64 = await audioCompressionService.compressForAPI(chunkWavBase64, 'transcription');

      // Analyze chunk
      const chunkResult = await openAIService.analyzeFullAudio(chunkBase64, {
        sessionName: `${session.name} (Part ${i + 1}/${chunks.length})`,
        sessionDescription: session.description,
        duration: this.calculateDuration(chunk),
        screenshotCount: Math.floor(session.screenshots.length / chunks.length),
        segmentCount: chunk.length,
      });

      chunkResults.push({
        transcription: chunkResult.transcription,
        insights: {
          ...chunkResult.insights,
          processedAt: new Date().toISOString(),
          modelUsed: 'gpt-4o-audio-preview (chunked)',
          processingDuration: 0,
        },
      });
    }

    // Merge results
    onProgress?.({
      stage: 'parsing',
      message: 'Merging insights from all chunks...',
      progress: 95,
    });

    const mergedResult = this.mergeChunkResults(chunkResults);

    // Generate and save full concatenated audio (compressed MP3)
    const fullWavBlob = await audioConcatenationService.exportDownsampledWAV(
      session.audioSegments,
      16000
    );
    const fullWavBase64 = await this.blobToBase64(fullWavBlob);
    const fullBase64 = await audioCompressionService.compressForAPI(fullWavBase64, 'transcription');
    const fullAudioAttachment = await audioStorageService.saveFullSessionAudio(
      fullBase64,
      session.id,
      audioConcatenationService.getTotalDuration()
    );

    return {
      fullTranscription: mergedResult.transcription,
      insights: mergedResult.insights,
      fullAudioAttachmentId: fullAudioAttachment.id,
    };
  }

  /**
   * Split audio segments into chunks of specified duration
   */
  private splitIntoChunks(
    segments: SessionAudioSegment[],
    chunkDurationSeconds: number
  ): SessionAudioSegment[][] {
    const chunks: SessionAudioSegment[][] = [];
    let currentChunk: SessionAudioSegment[] = [];
    let currentDuration = 0;

    for (const segment of segments) {
      if (currentDuration + segment.duration > chunkDurationSeconds && currentChunk.length > 0) {
        // Start new chunk
        chunks.push(currentChunk);
        currentChunk = [segment];
        currentDuration = segment.duration;
      } else {
        currentChunk.push(segment);
        currentDuration += segment.duration;
      }
    }

    // Add last chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Calculate total duration of audio segments
   */
  private calculateDuration(segments: SessionAudioSegment[]): number {
    return segments.reduce((total, seg) => total + seg.duration, 0);
  }

  /**
   * Merge results from multiple chunks into single comprehensive result
   */
  private mergeChunkResults(chunks: Array<{
    transcription: string;
    insights: AudioInsights;
  }>): { transcription: string; insights: AudioInsights } {
    // Concatenate transcriptions
    const fullTranscription = chunks.map(c => c.transcription).join('\n\n--- \n\n');

    // Merge emotional journeys (adjust timestamps)
    const emotionalJourney: AudioInsights['emotionalJourney'] = [];
    let timeOffset = 0;
    for (const chunk of chunks) {
      emotionalJourney.push(
        ...chunk.insights.emotionalJourney.map(e => ({
          ...e,
          timestamp: e.timestamp + timeOffset,
        }))
      );
      timeOffset += 900; // 15 minutes per chunk
    }

    // Merge key moments (adjust timestamps)
    const keyMoments: AudioInsights['keyMoments'] = [];
    timeOffset = 0;
    for (const chunk of chunks) {
      keyMoments.push(
        ...chunk.insights.keyMoments.map(m => ({
          ...m,
          timestamp: m.timestamp + timeOffset,
        }))
      );
      timeOffset += 900;
    }

    // Merge flow states (adjust timestamps)
    const flowStates: AudioInsights['workPatterns']['flowStates'] = [];
    timeOffset = 0;
    for (const chunk of chunks) {
      flowStates.push(
        ...chunk.insights.workPatterns.flowStates.map(f => ({
          ...f,
          start: f.start + timeOffset,
          end: f.end + timeOffset,
        }))
      );
      timeOffset += 900;
    }

    // Create merged narrative
    const narrative = chunks.map((c, i) =>
      `Part ${i + 1}: ${c.insights.narrative}`
    ).join(' ');

    // Calculate average focus level
    const focusLevels = chunks.map(c => c.insights.workPatterns.focusLevel);
    const highCount = focusLevels.filter(f => f === 'high').length;
    const mediumCount = focusLevels.filter(f => f === 'medium').length;
    const focusLevel: 'high' | 'medium' | 'low' =
      highCount > chunks.length / 2 ? 'high' :
      highCount + mediumCount > chunks.length / 2 ? 'medium' : 'low';

    // Sum interruptions
    const interruptions = chunks.reduce(
      (sum, c) => sum + c.insights.workPatterns.interruptions,
      0
    );

    // Use first chunk's environmental context (likely representative)
    const environmentalContext = chunks[0].insights.environmentalContext;

    const mergedInsights: AudioInsights = {
      narrative,
      emotionalJourney,
      keyMoments,
      workPatterns: {
        focusLevel,
        interruptions,
        flowStates,
      },
      environmentalContext,
      processedAt: new Date().toISOString(),
      modelUsed: 'gpt-4o-audio-preview (chunked)',
      processingDuration: chunks.reduce((sum, c) => sum + c.insights.processingDuration, 0),
    };

    return {
      transcription: fullTranscription,
      insights: mergedInsights,
    };
  }

  /**
   * Convert blob to base64 data URL
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Get estimated cost for reviewing a session
   * GPT-4o-audio-preview: ~$0.026/minute
   */
  getCostEstimate(session: Session): { cost: number; duration: number } {
    if (!session.audioSegments || session.audioSegments.length === 0) {
      return { cost: 0, duration: 0 };
    }

    const totalDuration = session.audioSegments.reduce(
      (sum, seg) => sum + seg.duration,
      0
    );

    const durationMinutes = totalDuration / 60;
    const cost = durationMinutes * 0.026;

    return {
      cost: Math.round(cost * 100) / 100, // Round to cents
      duration: totalDuration,
    };
  }
}

// Export singleton instance
export const audioReviewService = new AudioReviewService();
