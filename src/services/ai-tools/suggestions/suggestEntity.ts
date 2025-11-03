/**
 * suggestEntity Tool
 *
 * Creates entity suggestions (tasks, notes) from session data.
 * Suggestions are stored for user approval rather than created immediately.
 *
 * Three modes:
 * - task: Suggest task from audio/screenshot context
 * - note: Suggest note from screenshot/audio context
 * - batch: Suggest multiple entities at once
 *
 * Suggestions include:
 * - Source context (screenshot, audio segment, video frame)
 * - Confidence score
 * - Suggested content
 * - AI reasoning (why this suggestion?)
 */

import type {
  SuggestEntityInput,
  SuggestEntityOutput,
  EntitySuggestion,
  ToolExecutionResult
} from '../types';
import {
  loadSession,
  findScreenshot,
  findAudioSegment
} from '../utils/sessionLoader';
import {
  validateSessionId,
  validateNonEmptyString,
  validateConfidence,
  combineValidationResults,
  throwIfInvalid
} from '../utils/validation';
import {
  missingRequiredFieldError,
  invalidModeError,
  withErrorHandling,
  createToolError,
  logInfo,
  logWarning
} from '../utils/errorHandling';
import { getStorage } from '../../storage';

/**
 * Generate unique ID
 */
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Storage key for suggestions
 */
const SUGGESTIONS_KEY = 'entity-suggestions';

/**
 * Main tool execution function
 */
export async function suggestEntity(
  input: SuggestEntityInput
): Promise<ToolExecutionResult<SuggestEntityOutput>> {
  const startTime = Date.now();

  const result = await withErrorHandling(
    async () => executeSuggestEntity(input),
    {
      userMessage: 'Failed to create suggestion',
      toolName: 'suggestEntity',
      context: { mode: input.mode }
    }
  );

  const executionTime = Date.now() - startTime;

  return {
    success: true,
    data: result,
    metadata: {
      executionTime,
      mode: input.mode
    }
  };
}

/**
 * Core execution logic
 */
async function executeSuggestEntity(
  input: SuggestEntityInput
): Promise<SuggestEntityOutput> {
  // Route to appropriate handler based on mode
  switch (input.mode) {
    case 'task':
      return await handleTaskMode(input);

    case 'note':
      return await handleNoteMode(input);

    case 'batch':
      return await handleBatchMode(input);

    default:
      throw invalidModeError(input.mode, ['task', 'note', 'batch']);
  }
}

/**
 * Handle task mode
 * Create a single task suggestion
 */
async function handleTaskMode(input: SuggestEntityInput): Promise<SuggestEntityOutput> {
  // Validate required fields
  if (!input.suggestion) {
    throw missingRequiredFieldError('suggestion', 'task');
  }

  const validation = combineValidationResults(
    validateNonEmptyString(input.suggestion.title, 'suggestion.title'),
    validateConfidence(input.suggestion.confidence)
  );
  throwIfInvalid(validation, 'task suggestion');

  logInfo('suggestEntity', `Creating task suggestion: "${input.suggestion.title}"`);

  // Validate source context if provided
  if (input.suggestion.source_context) {
    await validateSourceContext(input.suggestion.source_context);
  }

  // Create suggestion
  const suggestion: EntitySuggestion = {
    id: generateId(),
    type: 'task',
    status: 'pending',
    confidence: input.suggestion.confidence,
    reasoning: input.suggestion.reasoning,
    source_context: input.suggestion.source_context,
    suggested_content: {
      title: input.suggestion.title,
      description: input.suggestion.description,
      priority: input.suggestion.priority,
      tags: input.suggestion.tags || [],
      dueDate: input.suggestion.due_date
    },
    created_at: new Date().toISOString(),
    created_by: 'ai'
  };

  // Store suggestion
  await storeSuggestion(suggestion);

  logInfo('suggestEntity', `Task suggestion created: ${suggestion.id}`);

  return {
    suggestion_id: suggestion.id,
    suggestion
  };
}

/**
 * Handle note mode
 * Create a single note suggestion
 */
async function handleNoteMode(input: SuggestEntityInput): Promise<SuggestEntityOutput> {
  // Validate required fields
  if (!input.suggestion) {
    throw missingRequiredFieldError('suggestion', 'note');
  }

  const validation = combineValidationResults(
    validateNonEmptyString(input.suggestion.title, 'suggestion.title'),
    validateConfidence(input.suggestion.confidence)
  );
  throwIfInvalid(validation, 'note suggestion');

  logInfo('suggestEntity', `Creating note suggestion: "${input.suggestion.title}"`);

  // Validate source context if provided
  if (input.suggestion.source_context) {
    await validateSourceContext(input.suggestion.source_context);
  }

  // Create suggestion
  const suggestion: EntitySuggestion = {
    id: generateId(),
    type: 'note',
    status: 'pending',
    confidence: input.suggestion.confidence,
    reasoning: input.suggestion.reasoning,
    source_context: input.suggestion.source_context,
    suggested_content: {
      title: input.suggestion.title,
      content: input.suggestion.content,
      tags: input.suggestion.tags || []
    },
    created_at: new Date().toISOString(),
    created_by: 'ai'
  };

  // Store suggestion
  await storeSuggestion(suggestion);

  logInfo('suggestEntity', `Note suggestion created: ${suggestion.id}`);

  return {
    suggestion_id: suggestion.id,
    suggestion
  };
}

/**
 * Handle batch mode
 * Create multiple suggestions at once
 */
async function handleBatchMode(input: SuggestEntityInput): Promise<SuggestEntityOutput> {
  if (!input.suggestions || input.suggestions.length === 0) {
    throw missingRequiredFieldError('suggestions', 'batch');
  }

  if (input.suggestions.length > 50) {
    throw createToolError(
      'Too many suggestions in batch (max 50)',
      new Error('Batch size limit exceeded'),
      { count: input.suggestions.length }
    );
  }

  logInfo('suggestEntity', `Creating ${input.suggestions.length} suggestions in batch`);

  const createdSuggestions: EntitySuggestion[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < input.suggestions.length; i++) {
    const suggestionInput = input.suggestions[i];

    try {
      // Validate
      const validation = combineValidationResults(
        validateNonEmptyString(suggestionInput.title, `suggestions[${i}].title`),
        validateConfidence(suggestionInput.confidence)
      );
      throwIfInvalid(validation, `suggestion ${i}`);

      // Validate source context if provided
      if (suggestionInput.source_context) {
        await validateSourceContext(suggestionInput.source_context);
      }

      // Create suggestion
      const suggestion: EntitySuggestion = {
        id: generateId(),
        type: suggestionInput.type || 'task',
        status: 'pending',
        confidence: suggestionInput.confidence,
        reasoning: suggestionInput.reasoning,
        source_context: suggestionInput.source_context,
        suggested_content: {
          title: suggestionInput.title,
          description: suggestionInput.description,
          content: suggestionInput.content,
          priority: suggestionInput.priority,
          tags: suggestionInput.tags || [],
          dueDate: suggestionInput.due_date
        },
        created_at: new Date().toISOString(),
        created_by: 'ai'
      };

      createdSuggestions.push(suggestion);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ index: i, error: message });
      logWarning('suggestEntity', `Failed to create suggestion ${i}: ${message}`);
    }
  }

  // Store all valid suggestions
  if (createdSuggestions.length > 0) {
    await storeSuggestions(createdSuggestions);
  }

  logInfo(
    'suggestEntity',
    `Batch complete: ${createdSuggestions.length} created, ${errors.length} failed`
  );

  return {
    suggestions: createdSuggestions,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validate source context references
 */
async function validateSourceContext(sourceContext: any): Promise<void> {
  if (!sourceContext.session_id) {
    throw createToolError(
      'source_context.session_id is required',
      new Error('Missing session_id'),
      { sourceContext }
    );
  }

  // Validate session exists
  const sessionValidation = validateSessionId(sourceContext.session_id);
  throwIfInvalid(sessionValidation, 'source_context.session_id');

  const session = await loadSession(sourceContext.session_id);

  // Validate screenshot_id if provided
  if (sourceContext.screenshot_id) {
    findScreenshot(session, sourceContext.screenshot_id);
  }

  // Validate audio_segment_id if provided
  if (sourceContext.audio_segment_id) {
    findAudioSegment(session, sourceContext.audio_segment_id);
  }

  // Validate video_timestamp if provided
  if (sourceContext.video_timestamp !== undefined) {
    const duration = session.endTime
      ? (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000
      : 0;

    if (sourceContext.video_timestamp < 0 || sourceContext.video_timestamp > duration) {
      throw createToolError(
        `video_timestamp ${sourceContext.video_timestamp}s is out of range (0-${duration}s)`,
        new Error('Invalid video_timestamp'),
        { sourceContext, duration }
      );
    }
  }
}

/**
 * Store a single suggestion
 */
async function storeSuggestion(suggestion: EntitySuggestion): Promise<void> {
  const storage = await getStorage();
  const existing = (await storage.load<EntitySuggestion[]>(SUGGESTIONS_KEY)) || [];
  existing.push(suggestion);
  await storage.save(SUGGESTIONS_KEY, existing);
}

/**
 * Store multiple suggestions
 */
async function storeSuggestions(suggestions: EntitySuggestion[]): Promise<void> {
  const storage = await getStorage();
  const existing = (await storage.load<EntitySuggestion[]>(SUGGESTIONS_KEY)) || [];
  existing.push(...suggestions);
  await storage.save(SUGGESTIONS_KEY, existing);
}

/**
 * Export for use in tool executor
 */
export default suggestEntity;

/**
 * Helper: Load all pending suggestions (for UI)
 */
export async function loadPendingSuggestions(): Promise<EntitySuggestion[]> {
  const storage = await getStorage();
  const all = (await storage.load<EntitySuggestion[]>(SUGGESTIONS_KEY)) || [];
  return all.filter(s => s.status === 'pending');
}

/**
 * Helper: Get suggestion by ID
 */
export async function getSuggestion(suggestionId: string): Promise<EntitySuggestion | null> {
  const storage = await getStorage();
  const all = (await storage.load<EntitySuggestion[]>(SUGGESTIONS_KEY)) || [];
  return all.find(s => s.id === suggestionId) || null;
}

/**
 * Helper: Update suggestion status
 */
export async function updateSuggestionStatus(
  suggestionId: string,
  status: 'pending' | 'approved' | 'rejected',
  entityId?: string
): Promise<void> {
  const storage = await getStorage();
  const all = (await storage.load<EntitySuggestion[]>(SUGGESTIONS_KEY)) || [];

  const suggestion = all.find(s => s.id === suggestionId);
  if (!suggestion) {
    throw new Error(`Suggestion not found: ${suggestionId}`);
  }

  suggestion.status = status;
  suggestion.reviewed_at = new Date().toISOString();

  if (entityId) {
    suggestion.entity_id = entityId;
  }

  await storage.save(SUGGESTIONS_KEY, all);
}

/**
 * Helper: Delete suggestion
 */
export async function deleteSuggestion(suggestionId: string): Promise<void> {
  const storage = await getStorage();
  const all = (await storage.load<EntitySuggestion[]>(SUGGESTIONS_KEY)) || [];
  const filtered = all.filter(s => s.id !== suggestionId);
  await storage.save(SUGGESTIONS_KEY, filtered);
}
