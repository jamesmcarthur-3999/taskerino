// src/bots/ned-assistant.ts
import { Baleybot, type ProcessOptions, type BaleybotStreamEvent } from '@baleybots/core';
import { ChatBot, History } from '@baleybots/chat';
import { MODELS } from './config';
import {
  allNedTools,
  setQueryToolsState,
  setMutationToolsDispatch,
  setSessionToolsState
} from './tools';
import type { Note, Task, Topic, Company, Contact, Session } from '../types';

// Conversation histories per user
const conversationHistories = new Map<string, History>();

function getConversationHistory(conversationId: string): History {
  if (!conversationHistories.has(conversationId)) {
    conversationHistories.set(conversationId, History.inMemory(50));
  }
  return conversationHistories.get(conversationId)!;
}

export function clearConversation(conversationId: string): void {
  conversationHistories.delete(conversationId);
}

export function createConversation(): string {
  return `ned-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Ned's system prompt
 */
const NED_GOAL = `You are Ned, an AI assistant for a productivity app called Taskerino.

Your personality:
- Helpful and efficient
- Concise but thorough
- Proactive about suggesting improvements
- Remember context from the conversation

Your capabilities:
- Search and query notes, tasks, and sessions
- Create, update, and delete tasks
- Create, update, and delete notes
- View session details and summaries
- Track time and dates

Guidelines:
- Always search before claiming you don't know something
- When creating tasks, infer priority from context
- When creating notes, use markdown formatting
- Reference specific items by ID when discussing them
- Ask clarifying questions when the request is ambiguous

You have access to tools - use them to help the user.`;

/**
 * Create Ned assistant bot with tools
 */
export function createNedAssistant() {
  return Baleybot.create({
    name: 'ned',
    goal: NED_GOAL,
    model: MODELS.STANDARD,
    tools: allNedTools,
    maxToolIterations: 10,
    verbose: false,
  });
}

/**
 * Ned Assistant interface
 */
export interface NedConfig {
  notes: Note[];
  tasks: Task[];
  topics: Topic[];
  companies: Company[];
  contacts: Contact[];
  sessions: Session[];
  dispatch: (action: { type: string; payload?: unknown }) => void;
  systemInstructions?: string;
}

/**
 * Initialize Ned with app state
 */
export function initializeNed(config: NedConfig): void {
  // Set state for query tools
  setQueryToolsState({
    notes: config.notes,
    tasks: config.tasks,
    topics: config.topics,
    companies: config.companies,
    contacts: config.contacts,
    sessions: config.sessions,
  });

  // Set dispatch for mutation tools
  setMutationToolsDispatch(config.dispatch);

  // Set sessions for session tools
  setSessionToolsState(config.sessions);
}

/**
 * Stream handler type
 */
export type NedStreamHandler = (event: BaleybotStreamEvent) => void;

/**
 * Send a message to Ned and get streaming response
 */
export async function sendMessageToNed(
  message: string,
  conversationId: string,
  config: NedConfig,
  onStream?: NedStreamHandler
): Promise<string> {
  // Initialize state before each message (data may have changed)
  initializeNed(config);

  const ned = createNedAssistant();
  const history = getConversationHistory(conversationId);
  const chat = ChatBot.forUser(ned, { history });

  const options: ProcessOptions | undefined = onStream ? {
    onToken: (_botName, event) => onStream(event),
  } : undefined;

  const result = await chat.send(message, options);

  // Result is string since no outputSchema
  return result as unknown as string;
}

/**
 * Non-streaming message send
 */
export async function askNed(
  message: string,
  conversationId: string,
  config: NedConfig
): Promise<string> {
  return sendMessageToNed(message, conversationId, config);
}
