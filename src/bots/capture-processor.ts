// src/bots/capture-processor.ts
import { Baleybot, text, image, combine } from '@baleybots/core';
import { MODELS } from './config';
import { CaptureResultSchema, type CaptureResult } from './types';
import type { Topic, Note, Task, Attachment } from '../types';

/**
 * Build system prompt with existing data context
 */
function buildSystemPrompt(
  existingTopics: Topic[],
  existingNotes: Note[],
  existingTasks: Task[],
  systemInstructions?: string
): string {
  const parts: string[] = [];

  parts.push(`You are an intelligent note and task processor for a productivity app.

Your job is to:
1. Detect topics (companies, people, projects) with confidence scores
2. Create or merge notes with appropriate topics
3. Extract tasks with priorities and due dates
4. Understand temporal references (EOD, next week, ASAP)

Topic hierarchy:
- PRIMARY: Companies, organizations
- SECONDARY: People, contacts
- TERTIARY: Projects, features, concepts`);

  if (systemInstructions) {
    parts.push(`\n\nUser's custom instructions:\n${systemInstructions}`);
  }

  // Existing topics for matching
  if (existingTopics.length > 0) {
    const topicList = existingTopics
      .slice(0, 50) // Limit to prevent token overflow
      .map(t => `- ${t.name} (id: ${t.id})`)
      .join('\n');
    parts.push(`\n\nExisting topics (match when confidence > 0.7):\n${topicList}`);
  }

  // Recent notes for deduplication
  if (existingNotes.length > 0) {
    const noteList = existingNotes
      .slice(0, 20)
      .map(n => `- [${n.id}] ${n.summary || n.content.slice(0, 100)}`)
      .join('\n');
    parts.push(`\n\nRecent notes (merge if similar, >30% overlap):\n${noteList}`);
  }

  // Recent tasks for deduplication
  if (existingTasks.length > 0) {
    const taskList = existingTasks
      .filter(t => !t.done)
      .slice(0, 20)
      .map(t => `- [${t.id}] ${t.title}`)
      .join('\n');
    parts.push(`\n\nOpen tasks (skip duplicates):\n${taskList}`);
  }

  return parts.join('\n');
}

/**
 * Capture Processor Bot
 *
 * Processes user input (notes, thoughts, transcripts) to extract
 * topics, notes, and tasks.
 */
export function createCaptureProcessor(
  existingTopics: Topic[],
  existingNotes: Note[],
  existingTasks: Task[],
  systemInstructions?: string
) {
  return Baleybot.create({
    name: 'capture-processor',
    goal: buildSystemPrompt(existingTopics, existingNotes, existingTasks, systemInstructions),
    model: MODELS.STANDARD,
    outputSchema: CaptureResultSchema,
    verbose: false,
  });
}

/**
 * Process captured input (text and optional attachments)
 */
export async function processCapture(
  inputText: string,
  existingTopics: Topic[],
  existingNotes: Note[],
  existingTasks: Task[],
  systemInstructions?: string,
  attachments?: Attachment[]
): Promise<CaptureResult> {
  const processor = createCaptureProcessor(
    existingTopics,
    existingNotes,
    existingTasks,
    systemInstructions
  );

  // Build input with optional images
  if (attachments && attachments.length > 0) {
    const imageAttachments = attachments.filter(a =>
      a.type === 'image' || a.type === 'screenshot'
    );

    if (imageAttachments.length > 0) {
      const parts = [text(inputText)];

      for (const att of imageAttachments) {
        if (att.base64) {
          parts.push(image({
            data: att.base64,
            mediaType: (att.mimeType || 'image/png') as 'image/png' | 'image/jpeg'
          }));
        }
      }

      return processor.process(combine(...parts));
    }
  }

  return processor.process(text(inputText));
}
