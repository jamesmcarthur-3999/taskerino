/**
 * OpenAI Service
 *
 * Handles audio transcription and description using OpenAI models.
 * Supports two modes:
 * - Transcription: whisper-1 (speech-to-text)
 * - Description: gpt-4o-audio-preview (full audio scene description)
 */

import { invoke } from '@tauri-apps/api/core';
import type { AudioMode } from '../types';
import { getWhisperPool } from './WhisperRequestPool';
import { debug } from "../utils/debug";

export class OpenAIService {
  private whisperPool = getWhisperPool();

  constructor() {
    this.loadApiKeyFromStorage();
  }

  /**
   * Load API key from storage
   */
  private async loadApiKeyFromStorage() {
    try {
      await invoke('get_openai_api_key');
      debug.log(debug.log(console.log('✅ OpenAIService: Loaded API key from storage')));
    } catch (error) {
      console.error('❌ OpenAIService: Failed to load API key from storage:', error);
    }
  }

  /**
   * Set API key and persist to storage
   */
  async setApiKey(apiKey: string) {
    try {
      await invoke('set_openai_api_key', { apiKey });
      debug.log(console.log('✅ OpenAIService: API key set and saved'));
    } catch (error) {
      console.error('❌ OpenAIService: Failed to set API key:', error);
      throw error;
    }
  }

  /**
   * Check if API key is set
   */
  async hasApiKey(): Promise<boolean> {
    try {
      return await invoke<boolean>('has_openai_api_key');
    } catch (error) {
      console.error('❌ OpenAIService: Failed to check API key:', error);
      return false;
    }
  }

  /**
   * Transcribe audio using Whisper-1 (simplified for real-time recording)
   * Uses WhisperRequestPool for concurrency control and rate limiting
   *
   * @param audioBase64 - Base64-encoded WAV audio
   * @returns Transcription text
   */
  async transcribeAudio(audioBase64: string): Promise<string> {
    try {
      // Use WhisperRequestPool for rate limiting and concurrency control
      console.log('🎤 Transcribing audio with Whisper-1 (via pool)...');

      const transcription = await this.whisperPool.transcribe(audioBase64);

      // Filter ONLY exact "Thanks for watching!" (case-insensitive)
      // Note: This is now done in Rust, but keeping for backward compatibility
      if (transcription.toLowerCase() === 'thanks for watching!') {
        console.log('⚠️ Filtered out exact Whisper hallucination: "Thanks for watching!"');
        return '(no speech detected)';
      }

      console.log(`✅ Transcription complete: ${transcription.substring(0, 100)}...`);
      return transcription;
    } catch (error: any) {
      console.error('❌ OpenAI transcription error:', error);

      // Extract error message for checking (handles both Error objects and strings)
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle specific error cases
      if (errorMessage.includes('401')) {
        throw new Error('Invalid OpenAI API key. Please check your key in Settings.');
      } else if (errorMessage.includes('429')) {
        throw new Error('OpenAI rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`Audio transcription failed: ${errorMessage || 'Unknown error'}`);
      }
    }
  }

  /**
   * Analyze full audio using GPT-4o-audio-preview (post-session comprehensive review)
   *
   * @param audioBase64 - Base64-encoded WAV audio (should be downsampled to 8kHz)
   * @param context - Session context for better analysis
   * @returns Full transcription and structured insights
   */
  async analyzeFullAudio(
    audioBase64: string,
    context: {
      sessionName: string;
      sessionDescription: string;
      duration: number;
      screenshotCount: number;
      segmentCount: number;
    }
  ): Promise<{
    transcription: string;
    insights: Omit<import('../types').AudioInsights, 'processedAt' | 'modelUsed' | 'processingDuration'>;
  }> {
    try {
      console.log('🎧 Analyzing full session audio with GPT-4o-audio-preview...');
      console.log(`📊 Context: ${context.duration.toFixed(0)}s, ${context.segmentCount} segments, ${context.screenshotCount} screenshots`);

      const response = await invoke<{
        transcription: string;
        insights: {
          narrative: string;
          emotionalJourney: Array<{ timestamp: number; emotion: string; description: string }>;
          keyMoments: Array<{ timestamp: number; type: string; description: string; context: string; excerpt: string }>;
          workPatterns: {
            focusLevel: string;
            interruptions: number;
            flowStates: Array<{ start: number; end: number; description: string }>;
          };
          environmentalContext: {
            ambientNoise: string;
            workSetting: string;
            timeOfDay: string;
          };
        };
      }>('openai_analyze_full_audio', {
        audioBase64,
        context: {
          sessionName: context.sessionName,
          sessionDescription: context.sessionDescription,
          duration: context.duration,
          screenshotCount: context.screenshotCount,
          segmentCount: context.segmentCount,
        }
      });

      console.log(`✅ Audio analysis complete: ${response.transcription.substring(0, 100)}...`);

      return {
        transcription: response.transcription,
        insights: {
          narrative: response.insights.narrative || 'No narrative available',
          emotionalJourney: response.insights.emotionalJourney || [],
          keyMoments: (response.insights.keyMoments || []).map(moment => ({
            ...moment,
            type: moment.type as 'achievement' | 'blocker' | 'decision' | 'insight'
          })),
          workPatterns: {
            focusLevel: (response.insights.workPatterns?.focusLevel || 'medium') as 'low' | 'medium' | 'high',
            interruptions: response.insights.workPatterns?.interruptions || 0,
            flowStates: response.insights.workPatterns?.flowStates || [],
          },
          environmentalContext: {
            ambientNoise: response.insights.environmentalContext?.ambientNoise || 'Unknown',
            workSetting: response.insights.environmentalContext?.workSetting || 'Unknown',
            timeOfDay: response.insights.environmentalContext?.timeOfDay || 'Unknown',
          },
        },
      };
    } catch (error: any) {
      console.error('❌ OpenAI full audio analysis error:', error);

      // Extract error message for checking (handles both Error objects and strings)
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle specific error cases
      if (errorMessage.includes('401')) {
        throw new Error('Invalid OpenAI API key. Please check your key in Settings.');
      } else if (errorMessage.includes('429')) {
        throw new Error('OpenAI rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`Audio analysis failed: ${errorMessage || 'Unknown error'}`);
      }
    }
  }

  /**
   * Transcribe full session audio with word-level timestamps
   * Used for upgrading segment transcripts after session completion
   *
   * @param audioBase64 - Base64-encoded WAV audio of full session
   * @returns Transcription with word-level timestamps
   */
  async transcribeAudioWithTimestamps(audioBase64: string): Promise<{
    text: string;
    words: Array<{ word: string; start: number; end: number }>;
  }> {
    try {
      console.log('🎤 Transcribing full audio with word-level timestamps (Whisper-1)...');

      const response = await invoke<{
        text: string;
        words: Array<{ word: string; start: number; end: number }>;
      }>('openai_transcribe_audio_with_timestamps', { audioBase64 });

      console.log(`✅ Word-level transcription complete: ${response.words.length} words, ${response.text.substring(0, 100)}...`);

      return response;
    } catch (error: any) {
      console.error('❌ OpenAI word-level transcription error:', error);

      // Extract error message for checking (handles both Error objects and strings)
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle specific error cases
      if (errorMessage.includes('401')) {
        throw new Error('Invalid OpenAI API key. Please check your key in Settings.');
      } else if (errorMessage.includes('429')) {
        throw new Error('OpenAI rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`Word-level transcription failed: ${errorMessage || 'Unknown error'}`);
      }
    }
  }

  /**
   * Convert base64 audio to File object for OpenAI API
   * Kept for potential backward compatibility
   */
  private base64ToFile(base64: string, filename: string): File {
    // Remove data URL prefix if present
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

    // Decode base64 to binary
    const byteString = atob(base64Data);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }

    // Create blob and file
    const blob = new Blob([uint8Array], { type: 'audio/wav' });
    return new File([blob], filename, { type: 'audio/wav' });
  }

  /**
   * Get model name for audio mode
   */
  getModelForMode(mode: AudioMode): string | null {
    switch (mode) {
      case 'transcription':
        return 'whisper-1';
      case 'description':
        return 'gpt-4o-audio-preview';
      case 'off':
      default:
        return null;
    }
  }

  /**
   * Estimate cost per minute for mode
   */
  getCostPerMinute(mode: AudioMode): number {
    switch (mode) {
      case 'transcription':
        return 0.006; // $0.006/min = $0.36/hr (Whisper-1)
      case 'description':
        return 0.026; // $0.026/min = $1.56/hr (GPT-4o audio)
      case 'off':
      default:
        return 0;
    }
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();
