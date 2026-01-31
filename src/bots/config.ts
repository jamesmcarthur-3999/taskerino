// src/bots/config.ts
import { setDefaultApiKey, anthropic, openai } from '@baleybots/core';
import { invoke } from '@tauri-apps/api/core';

export interface BotConfig {
  claudeApiKey?: string;
  openaiApiKey?: string;
  verbose?: boolean;
}

let isInitialized = false;

/**
 * Initialize Baleybots with API keys from Tauri secure storage
 */
export async function initializeBots(): Promise<void> {
  if (isInitialized) return;

  try {
    const claudeKey = await invoke<string | null>('get_claude_api_key');
    const openaiKey = await invoke<string | null>('get_openai_api_key');

    if (claudeKey) {
      setDefaultApiKey('anthropic', claudeKey);
    }
    if (openaiKey) {
      setDefaultApiKey('openai', openaiKey);
    }

    isInitialized = true;
  } catch (error) {
    console.error('[Baleybots] Failed to initialize:', error);
    throw new Error('Failed to initialize Baleybots - check API key configuration');
  }
}

/**
 * Update API keys at runtime (called from settings)
 */
export async function updateApiKeys(config: BotConfig): Promise<void> {
  if (config.claudeApiKey) {
    setDefaultApiKey('anthropic', config.claudeApiKey);
    await invoke('set_claude_api_key', { apiKey: config.claudeApiKey });
  }
  if (config.openaiApiKey) {
    setDefaultApiKey('openai', config.openaiApiKey);
    await invoke('set_openai_api_key', { apiKey: config.openaiApiKey });
  }
}

/**
 * Check if bots are ready to use
 */
export function isBotsReady(): boolean {
  return isInitialized;
}

// Model configurations
export const MODELS = {
  // Fast model for real-time analysis (screenshots, search)
  FAST: anthropic('claude-haiku-4-5-20251001'),
  // Standard model for comprehensive tasks (summaries, processing)
  STANDARD: anthropic('claude-sonnet-4-5-20250929'),
  // Audio model for transcription and analysis
  AUDIO: openai('gpt-4o-audio-preview'),
} as const;
