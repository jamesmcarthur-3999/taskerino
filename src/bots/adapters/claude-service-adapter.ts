// src/bots/adapters/claude-service-adapter.ts
/**
 * Adapter that provides the same interface as claudeService
 * but uses Baleybots under the hood.
 */

import { processCapture } from '../capture-processor';
import type { Topic, Note, Task, Attachment } from '../../types';
import type { CaptureResult } from '../types';

class ClaudeServiceAdapter {
  private hasApiKey = false;

  async setApiKey(apiKey: string): Promise<void> {
    const { updateApiKeys } = await import('../config');
    await updateApiKeys({ claudeApiKey: apiKey });
    this.hasApiKey = true;
  }

  async processInput(
    text: string,
    existingTopics: Topic[],
    existingNotes: Note[],
    settings: { systemInstructions?: string },
    _userLearnings?: unknown,
    _learningSettings?: unknown,
    existingTasks?: Task[],
    attachments?: Attachment[],
    _extractTasks?: boolean
  ): Promise<CaptureResult & { processingSteps: string[] }> {
    const result = await processCapture(
      text,
      existingTopics,
      existingNotes,
      existingTasks || [],
      settings.systemInstructions,
      attachments
    );

    // Add processing steps for UI compatibility
    return {
      ...result,
      processingSteps: [
        'Analyzing input...',
        'Detecting topics...',
        'Extracting notes...',
        'Extracting tasks...',
        'Complete!',
      ],
    };
  }
}

export const claudeService = new ClaudeServiceAdapter();
