/**
 * Transcript Upgrade Service
 *
 * Upgrades draft transcripts from 10-second chunks to final coherent transcripts
 * using word-level timestamps from Whisper.
 *
 * Process:
 * 1. Get full session audio with word-level timestamps
 * 2. Map words back to original 10-second segments
 * 3. Update segment transcripts with clean, complete text
 * 4. Mark segments as 'final' quality
 */

import type { Session, SessionAudioSegment } from '../types';
import { openAIService } from './openAIService';
import { invoke } from '@tauri-apps/api/core';
import type { ClaudeChatResponse, ClaudeMessage } from '../types/tauri-ai-commands';

export class TranscriptUpgradeService {
  /**
   * Batch merge multiple transcript pairs with AI (Haiku 4.5)
   * 95% cheaper and 98% faster than individual Sonnet calls
   *
   * @param transcriptPairs - Array of {live, enriched} transcript pairs
   * @returns Array of merged transcripts in same order
   */
  private async batchMergeTranscriptsWithAI(
    transcriptPairs: Array<{ live: string; enriched: string }>
  ): Promise<string[]> {
    console.log(`🤖 [AI MERGE BATCH] Merging ${transcriptPairs.length} segments in single call...`);

    try {
      // Build batch prompt asking for JSON array output
      const prompt = `You are merging multiple audio transcription pairs. For each pair, use the accurate words from ENRICHED and apply punctuation/capitalization from LIVE.

INPUT (JSON array):
${JSON.stringify(transcriptPairs.map((pair, i) => ({
  index: i,
  live: pair.live,
  enriched: pair.enriched
})), null, 2)}

TASK:
For each pair in the array:
1. Use accurate words/phrasing from "enriched"
2. Apply punctuation, capitalization, sentence structure from "live"
3. If transcripts differ significantly, prefer enriched words but maintain natural punctuation
4. Return ONLY a JSON array of merged transcripts in same order

OUTPUT FORMAT:
[
  "merged transcript for index 0",
  "merged transcript for index 1",
  ...
]

Return ONLY the JSON array, no explanations or markdown.`;

      const messages: ClaudeMessage[] = [
        { role: 'user', content: prompt }
      ];

      const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
        request: {
          model: 'claude-haiku-4-5', // 3x cheaper, 2x faster than Sonnet
          maxTokens: 4096, // Larger for batch responses
          messages,
          system: undefined,
          temperature: 0, // Deterministic for text processing
        }
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      // Parse JSON response
      const responseText = content.text.trim();
      let jsonText = responseText;

      // Extract JSON from markdown if present
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      const mergedTranscripts = JSON.parse(jsonText);

      if (!Array.isArray(mergedTranscripts)) {
        throw new Error('Expected array of merged transcripts from Claude');
      }

      if (mergedTranscripts.length !== transcriptPairs.length) {
        console.warn(`⚠️ [AI MERGE BATCH] Mismatch: sent ${transcriptPairs.length} pairs, got ${mergedTranscripts.length} results`);
      }

      console.log(`✅ [AI MERGE BATCH] Successfully merged ${mergedTranscripts.length} segments`);
      return mergedTranscripts;

    } catch (error) {
      console.error('🤖 [AI MERGE BATCH] Error merging transcripts:', error);
      // Fallback to enriched transcripts if batch fails
      console.warn('⚠️ [AI MERGE BATCH] Falling back to enriched transcripts');
      return transcriptPairs.map(pair => pair.enriched);
    }
  }

  /**
   * Upgrade all segment transcripts using word-level timestamps
   *
   * @param session - Session with audio segments
   * @param fullAudioBase64 - Base64-encoded full session audio
   * @returns Updated audio segments with upgraded transcripts
   */
  async upgradeSegmentTranscripts(
    session: Session,
    fullAudioBase64: string
  ): Promise<SessionAudioSegment[]> {
    console.log(`📝 [TRANSCRIPT UPGRADE] Starting upgrade for ${session.audioSegments?.length || 0} segments`);

    if (!session.audioSegments || session.audioSegments.length === 0) {
      throw new Error('No audio segments to upgrade');
    }

    // Step 1: Get word-level transcription from Whisper
    const { text, words } = await openAIService.transcribeAudioWithTimestamps(fullAudioBase64);
    console.log(`📝 [TRANSCRIPT UPGRADE] Received ${words.length} words from Whisper`);

    // Step 2: Calculate segment timing relative to session start
    const sessionStartTime = new Date(session.startTime).getTime();
    const segmentsWithTiming = session.audioSegments.map((segment) => {
      const segmentTime = new Date(segment.timestamp).getTime();
      const relativeStart = (segmentTime - sessionStartTime) / 1000; // Convert to seconds
      const relativeEnd = relativeStart + segment.duration;

      return {
        segment,
        relativeStart,
        relativeEnd,
      };
    });

    // Step 3A: Build enriched transcripts and prepare for batch merging
    const enrichedData = segmentsWithTiming.map(({ segment, relativeStart, relativeEnd }) => {
      const wordsInSegment = words.filter(
        (word) => word.start >= relativeStart && word.start < relativeEnd
      );
      const enrichedTranscript = wordsInSegment.map((w) => w.word).join(' ');

      return {
        segment,
        relativeStart,
        relativeEnd,
        wordsInSegment,
        enrichedTranscript
      };
    });

    // Step 3B: Prepare transcript pairs for batch merging (skip empty segments)
    const pairsToMerge: Array<{ live: string; enriched: string; index: number }> = [];
    const emptySegmentIndices: number[] = [];

    enrichedData.forEach((data, index) => {
      if (data.enrichedTranscript.trim()) {
        pairsToMerge.push({
          live: data.segment.transcription || '',
          enriched: data.enrichedTranscript,
          index
        });
      } else {
        emptySegmentIndices.push(index);
      }
    });

    // Step 3C: Batch merge all non-empty segments in single API call
    console.log(`🤖 [AI MERGE BATCH] Processing ${pairsToMerge.length} segments (${emptySegmentIndices.length} empty)`);
    const mergedTranscripts = await this.batchMergeTranscriptsWithAI(
      pairsToMerge.map(p => ({ live: p.live, enriched: p.enriched }))
    );

    // Step 3D: Map results back to segments
    const upgradedSegments = enrichedData.map((data, index) => {
      if (emptySegmentIndices.includes(index)) {
        // Empty segment
        const finalTranscript = data.segment.transcription || '(no speech detected)';
        console.log(
          `📝 [TRANSCRIPT UPGRADE] Segment ${data.segment.id}: 0 words (${data.relativeStart.toFixed(1)}s - ${data.relativeEnd.toFixed(1)}s) - No speech`
        );
        return {
          ...data.segment,
          transcription: finalTranscript,
          transcriptionQuality: 'final' as const,
          draftTranscription: data.segment.transcription,
          enrichedTranscription: undefined,
        };
      } else {
        // Find merged result for this segment
        const pairIndex = pairsToMerge.findIndex(p => p.index === index);
        const finalTranscript = mergedTranscripts[pairIndex] || data.enrichedTranscript;

        console.log(
          `📝 [TRANSCRIPT UPGRADE] Segment ${data.segment.id}: ${data.wordsInSegment.length} words (${data.relativeStart.toFixed(1)}s - ${data.relativeEnd.toFixed(1)}s)`
        );

        return {
          ...data.segment,
          transcription: finalTranscript,
          transcriptionQuality: 'final' as const,
          draftTranscription: data.segment.transcription,
          enrichedTranscription: data.enrichedTranscript,
        };
      }
    });

    console.log(`✅ [TRANSCRIPT UPGRADE] Upgraded ${upgradedSegments.length} segments (batch merged: ${pairsToMerge.length})`);
    return upgradedSegments;
  }

  /**
   * Check if a session needs transcript upgrade
   */
  needsUpgrade(session: Session): boolean {
    return (
      session.audioSegments !== undefined &&
      session.audioSegments.length > 0 &&
      !session.transcriptUpgradeCompleted
    );
  }
}

// Export singleton instance
export const transcriptUpgradeService = new TranscriptUpgradeService();
