// src/bots/audio-reviewer.ts
import { Baleybot, audio, text, combine } from '@baleybots/core';
import { MODELS } from './config';
import { AudioInsightsSchema, type AudioInsights } from './types';

/**
 * Audio Reviewer Bot
 *
 * Analyzes session audio recordings to extract insights,
 * emotional patterns, and key moments.
 */
export const audioReviewer = Baleybot.create({
  name: 'audio-reviewer',
  goal: `You are an audio analysis agent for a productivity app. Given audio from a work session, analyze:

1. Overall narrative - what was the session about?
2. Emotional journey - detect emotional states throughout
3. Key moments - breakthroughs, blockers, decisions
4. Work patterns - focus level, interruptions, flow states
5. Environmental context - work setting, ambient noise, time of day

Provide timestamps in seconds from the start of the audio.
Be thorough in identifying actionable insights.`,
  model: MODELS.AUDIO,
  outputSchema: AudioInsightsSchema,
  verbose: false,
});

// Cost estimation constants
const COST_PER_MINUTE = 0.026; // GPT-4o audio preview pricing

/**
 * Estimate cost for audio review
 */
export function estimateAudioReviewCost(durationSeconds: number): {
  cost: number;
  duration: number;
} {
  const minutes = durationSeconds / 60;
  return {
    cost: minutes * COST_PER_MINUTE,
    duration: durationSeconds,
  };
}

/**
 * Review audio and extract insights
 *
 * @param audioBase64 - Base64 encoded audio (MP3 format recommended)
 * @param sessionName - Name of the session for context
 * @param format - Audio format (default: mp3)
 */
export async function reviewAudio(
  audioBase64: string,
  sessionName: string,
  format: 'mp3' | 'wav' | 'webm' = 'mp3'
): Promise<AudioInsights> {
  const input = combine(
    text(`Session: "${sessionName}"\n\nAnalyze this audio recording:`),
    audio({ data: audioBase64, format })
  );

  return audioReviewer.process(input);
}

/**
 * Review audio in chunks for long sessions (>25 minutes)
 *
 * @param audioChunks - Array of base64 encoded audio chunks
 * @param sessionName - Name of the session
 * @param format - Audio format
 */
export async function reviewAudioChunked(
  audioChunks: string[],
  sessionName: string,
  format: 'mp3' | 'wav' | 'webm' = 'mp3'
): Promise<AudioInsights[]> {
  const results: AudioInsights[] = [];

  for (let i = 0; i < audioChunks.length; i++) {
    const chunkContext = audioChunks.length > 1
      ? `Session: "${sessionName}" (Part ${i + 1}/${audioChunks.length})`
      : `Session: "${sessionName}"`;

    const input = combine(
      text(`${chunkContext}\n\nAnalyze this audio recording:`),
      audio({ data: audioChunks[i], format })
    );

    const result = await audioReviewer.process(input);
    results.push(result);
  }

  return results;
}
