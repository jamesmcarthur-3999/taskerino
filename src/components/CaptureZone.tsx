import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AIProcessResult, Task, Attachment, ProcessingJob, Topic, Note } from '../types';
import type { CaptureResult, RefinementRequest, RefinementResponse } from '../types/captureProcessing';
import { useSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useEntities } from '../context/EntitiesContext';
import { useNotes } from '../context/NotesContext';
import { useTasks } from '../context/TasksContext';
import { useSessionList } from '../context/SessionListContext';
import { createTopic, createNote, extractHashtags, combineTags, getTimeBasedGreeting, generateId } from '../utils/helpers';
import { CheckCircle2, FileText, Plus, Home, Brain, Upload, X, Image as ImageIcon, Paperclip, Loader2, ArrowRight, Clock, AlertCircle, CheckSquare, Eye, EyeOff, Check, ExternalLink, Lock } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { ResultsReview } from './ResultsReview';
import { CaptureReview } from './capture/CaptureReview';
import { QuickTaskConfirmation } from './capture/QuickTaskConfirmation';
import { LearningService } from '../services/learningService';
import { fileStorage } from '../services/fileStorageService';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { backgroundProcessor } from '../services/backgroundProcessor';
import { Button } from './Button';
import { FeatureTooltip } from './FeatureTooltip';
import { SarcasticQuote } from './SarcasticQuote';
import { GreetingHeader } from './GreetingHeader';
import { CaptureBoxTooltip, KeyboardShortcutsTooltip, useTooltipTriggers } from './OnboardingTooltips';
import { RADIUS, ICON_SIZES, SHADOWS, getGlassmorphism, getGlassClasses, getRadiusClass, getInfoGradient } from '../design-system/theme';
import { validateOpenAIKey, validateAnthropicKey } from '../utils/validation';
import { motion, AnimatePresence } from 'framer-motion';
import { claudeService } from '../services/claudeService';
import { sessionsAgentService } from '../services/sessionsAgentService';
import { nedService } from '../services/nedService';
import { contextAgent } from '../services/contextAgent';
import { sessionsQueryAgent } from '../services/sessionsQueryAgent';

type CaptureState = 'idle' | 'processing' | 'review' | 'complete';

interface ExtendedJob extends ProcessingJob {
  _autoSave?: boolean;
}

type ApiSetupTab = 'openai' | 'anthropic';

interface KeyState {
  value: string;
  isValid: boolean;
  error: string;
  showPassword: boolean;
}

// Inline API Key Input Component
function ApiKeyInput({ onComplete }: { onComplete: () => void }) {
  const [activeTab, setActiveTab] = useState<ApiSetupTab>('openai');
  const [isSaving, setIsSaving] = useState(false);

  const [openAIState, setOpenAIState] = useState<KeyState>({
    value: '',
    isValid: false,
    error: '',
    showPassword: false,
  });

  const [anthropicState, setAnthropicState] = useState<KeyState>({
    value: '',
    isValid: false,
    error: '',
    showPassword: false,
  });

  const canSave = openAIState.isValid && anthropicState.isValid;

  // Real-time validation for OpenAI key
  useEffect(() => {
    if (!openAIState.value.trim()) {
      setOpenAIState(prev => ({ ...prev, isValid: false, error: '' }));
      return;
    }

    const validation = validateOpenAIKey(openAIState.value);
    setOpenAIState(prev => ({
      ...prev,
      isValid: validation.isValid,
      error: validation.error || '',
    }));
  }, [openAIState.value]);

  // Real-time validation for Anthropic key
  useEffect(() => {
    if (!anthropicState.value.trim()) {
      setAnthropicState(prev => ({ ...prev, isValid: false, error: '' }));
      return;
    }

    const validation = validateAnthropicKey(anthropicState.value);
    setAnthropicState(prev => ({
      ...prev,
      isValid: validation.isValid,
      error: validation.error || '',
    }));
  }, [anthropicState.value]);

  const handleSave = async () => {
    if (!canSave || isSaving) return;

    setIsSaving(true);

    try {
      // Save both API keys
      await invoke('set_openai_api_key', { apiKey: openAIState.value.trim() });
      await invoke('set_claude_api_key', { apiKey: anthropicState.value.trim() });

      // Configure services
      const savedClaudeKey = await invoke<string | null>('get_claude_api_key');
      if (savedClaudeKey) {
        await claudeService.setApiKey(savedClaudeKey);
        await sessionsAgentService.setApiKey(savedClaudeKey);
        await nedService.setApiKey(savedClaudeKey);
        await contextAgent.setApiKey(savedClaudeKey);
        await sessionsQueryAgent.setApiKey(savedClaudeKey);
      }

      const savedOpenAIKey = await invoke<string | null>('get_openai_api_key');
      if (savedOpenAIKey) {
        const { openAIService } = await import('../services/openAIService');
        await openAIService.setApiKey(savedOpenAIKey);
      }

      onComplete();
    } catch (error) {
      console.error('[ApiKeyInput] Failed to save API keys:', error);
      setIsSaving(false);
    }
  };

  const [[activeTabIndex, direction], setActiveTabIndex] = useState([0, 0]);

  const handleTabChange = (tab: ApiSetupTab) => {
    const newIndex = tab === 'openai' ? 0 : 1;
    const dir = newIndex > activeTabIndex ? 1 : -1;
    setActiveTabIndex([newIndex, dir]);
    setActiveTab(tab);
  };

  const tabContentVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 20 : -20,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      },
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 20 : -20,
      opacity: 0,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1],
      },
    }),
  };

  return (
    <div className={`${getGlassClasses('strong')} ${getRadiusClass('card')} overflow-hidden`}>
      {/* Header */}
      <div className="p-6 pb-4 border-b-2 border-white/30">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            API Keys Required
          </h2>
        </div>
        <p className="text-sm text-gray-600 ml-11">
          Configure both API keys to unlock Taskerino's AI features
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-white/30 px-6">
        <button
          onClick={() => handleTabChange('openai')}
          className={`flex-1 py-3 text-sm font-medium transition-all relative ${
            activeTab === 'openai'
              ? 'text-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          OpenAI
          {activeTab === 'openai' && (
            <motion.div
              layoutId="activeApiTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-600 to-blue-600"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          {openAIState.isValid && (
            <Check className="w-4 h-4 text-green-500 absolute top-3 right-4" />
          )}
        </button>
        <button
          onClick={() => handleTabChange('anthropic')}
          className={`flex-1 py-3 text-sm font-medium transition-all relative ${
            activeTab === 'anthropic'
              ? 'text-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Anthropic
          {activeTab === 'anthropic' && (
            <motion.div
              layoutId="activeApiTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-600 to-blue-600"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          {anthropicState.isValid && (
            <Check className="w-4 h-4 text-green-500 absolute top-3 right-4" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-6 min-h-[320px]">
        <AnimatePresence mode="wait" custom={direction}>
          {activeTab === 'openai' && (
            <motion.div
              key="openai"
              custom={direction}
              variants={tabContentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  OpenAI API Key
                </h3>
                <p className="text-sm text-gray-600">
                  Used for Whisper transcription and GPT-4o audio analysis
                </p>
              </div>

              <div className="relative">
                <input
                  type={openAIState.showPassword ? 'text' : 'password'}
                  value={openAIState.value}
                  onChange={(e) => setOpenAIState(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="sk-..."
                  className={`w-full px-4 pr-20 py-3 ${getGlassClasses('medium')} border ${
                    openAIState.error
                      ? 'border-red-400'
                      : openAIState.isValid
                      ? 'border-green-400'
                      : 'border-white/60'
                  } ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all shadow-sm text-gray-900 placeholder:text-gray-500`}
                />

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {openAIState.value.trim() && (
                    <div className="flex items-center">
                      {openAIState.isValid ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : openAIState.error ? (
                        <X className="w-5 h-5 text-red-500" />
                      ) : null}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenAIState(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                    className="text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
                    tabIndex={-1}
                  >
                    {openAIState.showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {openAIState.error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-600"
                >
                  {openAIState.error}
                </motion.p>
              )}

              <div className="text-sm text-gray-600 space-y-2">
                <p>Your API key should start with "sk-"</p>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 transition-colors"
                >
                  Get your OpenAI API key
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          )}

          {activeTab === 'anthropic' && (
            <motion.div
              key="anthropic"
              custom={direction}
              variants={tabContentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Anthropic API Key
                </h3>
                <p className="text-sm text-gray-600">
                  Used for Claude Sonnet 4.5 processing and analysis
                </p>
              </div>

              <div className="relative">
                <input
                  type={anthropicState.showPassword ? 'text' : 'password'}
                  value={anthropicState.value}
                  onChange={(e) => setAnthropicState(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="sk-ant-..."
                  className={`w-full px-4 pr-20 py-3 ${getGlassClasses('medium')} border ${
                    anthropicState.error
                      ? 'border-red-400'
                      : anthropicState.isValid
                      ? 'border-green-400'
                      : 'border-white/60'
                  } ${getRadiusClass('field')} focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all shadow-sm text-gray-900 placeholder:text-gray-500`}
                />

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {anthropicState.value.trim() && (
                    <div className="flex items-center">
                      {anthropicState.isValid ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : anthropicState.error ? (
                        <X className="w-5 h-5 text-red-500" />
                      ) : null}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setAnthropicState(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                    className="text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
                    tabIndex={-1}
                  >
                    {anthropicState.showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {anthropicState.error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-600"
                >
                  {anthropicState.error}
                </motion.p>
              )}

              <div className="text-sm text-gray-600 space-y-2">
                <p>Your API key should start with "sk-ant-"</p>
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 transition-colors"
                >
                  Get your Anthropic API key
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-6 py-5 border-t-2 border-white/30">
        <Button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          variant="primary"
          size="lg"
          fullWidth
          className="font-semibold"
        >
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </Button>

        {!canSave && (
          <p className="text-xs text-gray-500 mt-3 text-center">
            Both API keys are required to continue
          </p>
        )}
      </div>
    </div>
  );
}

function LiveTime() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  return (
    <div className="text-center mb-8">
      <div className="text-9xl font-extralight text-gray-700/70 tracking-tighter mb-2" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.05em' }}>
        {formattedTime}
      </div>
      <div className="text-base text-gray-500/70 font-medium tracking-wide">
        {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}

// Helper function to create topic ID mapping
function createTopicIdMap(
  detectedTopics: AIProcessResult['detectedTopics'],
  addTopic: (topic: Topic) => void
): Map<string, string> {
  const topicIdMap = new Map<string, string>();
  detectedTopics.forEach(detected => {
    if (detected.existingTopicId) {
      topicIdMap.set(detected.name, detected.existingTopicId);
    } else {
      const newTopic = createTopic(detected.name);
      addTopic(newTopic );
      topicIdMap.set(detected.name, newTopic.id);
    }
  });
  return topicIdMap;
}

// Helper function to create or merge notes
function createOrMergeNote(
  noteResult: AIProcessResult['notes'][0],
  topicIdMap: Map<string, string>,
  result: AIProcessResult,
  notes: Note[],
  addNote: (note: Note) => void,
  updateNote: (note: Note) => void
): ReturnType<typeof createNote> | undefined {
  const topicId = topicIdMap.get(noteResult.topicName) || noteResult.topicId;
  const hashtagsFromSource = extractHashtags(noteResult.sourceText || '');
  const hashtagsFromContent = extractHashtags(noteResult.content);
  const allTags = combineTags(noteResult.tags || [], result.keyTopics, hashtagsFromSource, hashtagsFromContent);

  if (noteResult.isNew) {
    const newNote = createNote(
      topicId,
      noteResult.content,
      noteResult.summary,
      {
        tags: allTags,
        sourceText: noteResult.sourceText,
        metadata: {
          sentiment: noteResult.sentiment || result.sentiment,
          keyPoints: noteResult.keyPoints || [noteResult.summary],
          relatedTopics: noteResult.relatedTopics,
        },
      }
    );
    if (noteResult.source) {
      newNote.source = noteResult.source;
    }
    addNote(newNote );
    return newNote;
  } else if (noteResult.mergedWith) {
    const existingNote = notes.find(n => n.id === noteResult.mergedWith);
    if (existingNote) {
      const now = new Date().toISOString();
      const mergedTags = combineTags(existingNote.tags, allTags);

      const currentAsUpdate: import('../types').NoteUpdate = {
        id: generateId(),
        content: existingNote.content,
        timestamp: existingNote.lastUpdated || existingNote.timestamp,
        source: existingNote.source,
        summary: existingNote.summary,
        sourceText: existingNote.sourceText,
        tags: existingNote.tags,
      };

      const updatedUpdates = [
        ...(existingNote.updates || []),
        currentAsUpdate,
      ];

      const updatedNote = {
        ...existingNote,
        content: noteResult.content,
        summary: noteResult.summary,
        lastUpdated: now,
        tags: mergedTags,
        sourceText: noteResult.sourceText,
        updates: updatedUpdates,
        source: noteResult.source || existingNote.source,
        metadata: {
          ...existingNote.metadata,
          sentiment: noteResult.sentiment || result.sentiment,
          keyPoints: noteResult.keyPoints || [noteResult.summary],
          relatedTopics: noteResult.relatedTopics,
        },
      };
      updateNote(updatedNote );
      return updatedNote;
    }
  }
  return undefined;
}

// Helper function to create task with note link
function createTaskWithNoteLink(
  task: AIProcessResult['tasks'][0],
  primaryNoteId: string | undefined,
  addTask: (task: Task) => void
): void {
  const taskWithNoteLink: Task = {
    id: generateId(),
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    topicId: task.topicId,
    noteId: primaryNoteId,
    tags: task.tags || [],
    done: false,
    status: 'todo',
    createdBy: 'ai',
    createdAt: new Date().toISOString(),
    sourceNoteId: primaryNoteId,
    sourceExcerpt: task.sourceExcerpt,
    contextForAgent: task.contextForAgent,
    subtasks: task.suggestedSubtasks?.map((title, idx) => ({
      id: `${generateId()}-${idx}`,
      title,
      done: false,
      createdAt: new Date().toISOString(),
    })),
  };
  addTask(taskWithNoteLink );
}

export default function CaptureZone() {
  const { state: settingsState } = useSettings();
  const { state: uiState, dispatch: uiDispatch, addNotification, addProcessingJob } = useUI();
  const { state: entitiesState, addTopic } = useEntities();
  const { state: notesState, addNote, updateNote } = useNotes();
  const { state: tasksState, addTask } = useTasks();
  const { sessions } = useSessionList();
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [results, setResults] = useState<CaptureResult | null>(null);
  const [showQuickConfirm, setShowQuickConfirm] = useState(false);
  const [quickConfirmTask, setQuickConfirmTask] = useState<AIProcessResult['tasks'][0] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [autoSave, setAutoSave] = useState(true);
  const [extractTasks, setExtractTasks] = useState(true);
  const [showBackgroundTooltip, setShowBackgroundTooltip] = useState(false);
  const [isCaptureInputFocused, setIsCaptureInputFocused] = useState(false);

  // API key state
  const [hasApiKeys, setHasApiKeys] = useState(false);
  const [isCheckingKeys, setIsCheckingKeys] = useState(true);

  // Get tooltip trigger helper
  const { markFirstCaptureComplete } = useTooltipTriggers();

  // Check for API keys on mount
  useEffect(() => {
    const checkApiKeys = async () => {
      try {
        const openAIKey = await invoke<string | null>('get_openai_api_key');
        const claudeKey = await invoke<string | null>('get_claude_api_key');
        setHasApiKeys(!!openAIKey && !!claudeKey);
      } catch (error) {
        console.error('Failed to check API keys:', error);
        setHasApiKeys(false);
      } finally {
        setIsCheckingKeys(false);
      }
    };
    checkApiKeys();
  }, []);

  // Watch for pending review job ID from notifications
  useEffect(() => {
    const pendingJobId = uiState.pendingReviewJobId;
    if (pendingJobId && uiState.activeTab === 'capture') {
      // Find the job in completed queue
      const job = uiState.backgroundProcessing.completed.find(j => j.id === pendingJobId);
      if (job && job.result) {
        // Open review for this job
        setResults(job.result);
        setCurrentJobId(job.id);
        setCaptureState('review');
        // Clear the pending review job ID
        uiDispatch({ type: 'SET_PENDING_REVIEW_JOB', payload: undefined });
      }
    }
  }, [uiState.pendingReviewJobId, uiState.activeTab, uiState.backgroundProcessing.completed,  uiDispatch]);

  // Screenshot listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.listen<string>('screenshot-captured', async (event) => {
          const base64Data = event.payload;

          try {
            // Extract base64 and convert to blob
            const base64String = base64Data.split(',')[1];
            const byteCharacters = atob(base64String);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            const file = new File([blob], 'screenshot.png', { type: 'image/png' });

            // Create attachment
            const attachment: Attachment = {
              id: generateId(),
              type: 'screenshot',
              name: `Screenshot ${new Date().toLocaleString()}`,
              mimeType: 'image/png',
              size: blob.size,
              createdAt: new Date().toISOString(),
            };

            // Save to storage and get path
            const savedPath = await fileStorage.saveAttachment(attachment, byteArray);
            attachment.path = savedPath;

            // Use the base64 data directly as thumbnail (already have it!)
            attachment.thumbnail = base64Data;

            // Get dimensions
            const dimensions = await fileStorage.getImageDimensions(file);
            attachment.dimensions = dimensions;

            setAttachments(prev => [...prev, attachment]);
          } catch (error) {
            console.error('Failed to process screenshot:', error);
            setError('Failed to process screenshot: ' + (error instanceof Error ? error.message : 'Unknown error'));
          }
        });
      } catch (error) {
        console.log('Tauri event listener not available:', error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Helper functions for Capture Zone 3.0 (defined at component level for accessibility)
  const generateDefaultSummary = (result: AIProcessResult): string => {
    const userName = 'there'; // Could be from settings
    const taskCount = result.tasks?.length || 0;
    const noteCount = result.notes?.length || 0;

    if (taskCount > 0 && noteCount > 0) {
      return `Hey ${userName}, I found ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} and created ${noteCount} ${noteCount === 1 ? 'note' : 'notes'}.`;
    } else if (taskCount > 0) {
      return `Hey ${userName}, I found ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} from your capture.`;
    } else if (noteCount > 0) {
      return `Hey ${userName}, I created ${noteCount} ${noteCount === 1 ? 'note' : 'notes'}.`;
    }
    return `Hey ${userName}, I've processed your capture.`;
  };

  const wrapInCaptureResult = (aiResult: AIProcessResult, plainText: string, attachments: Attachment[]): CaptureResult => {
    return {
      ...aiResult,
      aiSummary: (aiResult as any).aiSummary || generateDefaultSummary(aiResult),
      modelUsed: 'claude-haiku-4.5',
      processingTimeMs: 0, // backgroundProcessor doesn't track timing yet
      conversationContext: {
        modelUsed: 'claude-haiku-4.5',
        messages: [
          { role: 'user', content: plainText },
          { role: 'assistant', content: JSON.stringify(aiResult) },
        ],
        originalCapture: plainText,
        originalAttachments: attachments,
        iterationCount: 0,
      },
    };
  };

  const shouldShowQuickConfirmation = (result: CaptureResult, originalText: string) => {
    return result.tasks?.length === 1
      && (result.notes?.length ?? 0) === 0
      && originalText.length < 100;
  };

  // Background processor callbacks
  useEffect(() => {
    // Progress callback
    backgroundProcessor.onProgress((job) => {
      uiDispatch({
        type: 'UPDATE_PROCESSING_JOB',
        payload: {
          id: job.id,
          updates: {
            status: job.status,
            progress: job.progress,
            currentStep: job.currentStep,
            processingSteps: job.processingSteps,
          }
        }
      });
    });

    // Complete callback
    backgroundProcessor.onComplete((job) => {
      uiDispatch({
        type: 'COMPLETE_PROCESSING_JOB',
        payload: {
          id: job.id,
          result: job.result!,
        }
      });

      // Check if this job should auto-save
      const shouldAutoSave = (job as ExtendedJob)._autoSave;

      if (shouldAutoSave && job.result) {
        // Auto-save directly without review
        const result = job.result;

        // Save topics
        const topicIdMap = new Map<string, string>();
        result.detectedTopics.forEach(detected => {
          if (detected.existingTopicId) {
            topicIdMap.set(detected.name, detected.existingTopicId);
          } else {
            const newTopic = createTopic(detected.name);
            addTopic(newTopic );
            topicIdMap.set(detected.name, newTopic.id);
          }
        });

        // Save notes
        const createdNotes: typeof notesState.notes = [];
        result.notes.forEach(noteResult => {
          const topicId = topicIdMap.get(noteResult.topicName) || noteResult.topicId;
          const hashtagsFromSource = extractHashtags(noteResult.sourceText || '');
          const hashtagsFromContent = extractHashtags(noteResult.content);
          const allTags = combineTags(noteResult.tags || [], result.keyTopics, hashtagsFromSource, hashtagsFromContent);

          const newNote = createNote(
            topicId,
            noteResult.content,
            noteResult.summary,
            {
              tags: allTags,
              sourceText: noteResult.sourceText,
              metadata: {
                sentiment: noteResult.sentiment || result.sentiment,
                keyPoints: noteResult.keyPoints || [noteResult.summary],
                relatedTopics: noteResult.relatedTopics,
              },
            }
          );
          if (noteResult.source) {
            newNote.source = noteResult.source;
          }
          addNote(newNote );
          uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'noteCount' });
          createdNotes.push(newNote);
        });

        // Save tasks (if any)
        const primaryNoteId = createdNotes.length > 0 ? createdNotes[0].id : undefined;
        result.tasks.forEach(task => {
          const taskWithNoteLink: Task = {
            id: generateId(),
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            topicId: task.topicId,
            noteId: primaryNoteId,
            tags: task.tags || [],
            done: false,
            status: 'todo',
            createdBy: 'ai',
            createdAt: new Date().toISOString(),
            sourceNoteId: primaryNoteId,
            sourceExcerpt: task.sourceExcerpt,
            contextForAgent: task.contextForAgent,
            subtasks: task.suggestedSubtasks?.map((title, idx) => ({
              id: `${generateId()}-${idx}`,
              title,
              done: false,
              createdAt: new Date().toISOString(),
            })),
          };
          addTask(taskWithNoteLink );
          uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'taskCount' });
        });

        // Remove job from queue
        uiDispatch({ type: 'REMOVE_PROCESSING_JOB', payload: job.id });

        // Show auto-save success notification
        const taskCount = result.tasks.length || 0;
        const noteCount = result.notes.length || 0;
        uiDispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'success',
            title: 'Auto-Saved!',
            message: `Saved ${noteCount} ${noteCount === 1 ? 'note' : 'notes'}${taskCount > 0 ? ` and ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}` : ''}.`,
          }
        });
      } else {
        // Wrap result in CaptureResult for new review UI
        const wrappedResult = wrapInCaptureResult(job.result!, job.input, []);

        // Check if we should show quick confirmation for single task
        if (shouldShowQuickConfirmation(wrappedResult, job.input)) {
          // Show quick task confirmation inline
          setQuickConfirmTask(wrappedResult.tasks![0]);
          setShowQuickConfirm(true);
          setCurrentJobId(job.id);

          uiDispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              type: 'success',
              title: 'Task Created!',
              message: 'Review and confirm your task below.',
            }
          });
        } else {
          // Show completion notification for manual review
          const taskCount = job.result?.tasks.length || 0;
          const topicCount = job.result?.detectedTopics.length || 0;

          uiDispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              type: 'success',
              title: 'Processing Complete!',
              message: `Found ${taskCount} tasks and ${topicCount} topics.`,
              action: {
                label: 'Review Now',
                onClick: () => {
                  // Use job data directly from closure to avoid race condition
                  // with async state updates (fixes stuck loading issue)
                  setResults(wrappedResult);
                  setCurrentJobId(job.id);
                  setCaptureState('review');
                  uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'capture' });
                },
              },
            }
          });
        }
      }
    });

    // Error callback
    backgroundProcessor.onError((job) => {
      uiDispatch({
        type: 'UPDATE_PROCESSING_JOB',
        payload: {
          id: job.id,
          updates: {
            status: 'error',
            error: job.error,
          }
        }
      });

      // Check if it's an API key error
      const isApiKeyError = job.error?.includes('API key not set');

      uiDispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: isApiKeyError ? 'API Key Required' : 'Processing Failed',
          message: job.error || 'An error occurred while processing your note.',
          action: isApiKeyError ? {
            label: 'Go to Settings',
            onClick: () => uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'profile' })
          } : undefined,
        }
      });
    });
  }, [uiDispatch]);

  const handleSubmit = async () => {
    // Strip HTML tags for plain text processing
    const plainText = inputText.replace(/<[^>]*>/g, '').trim();
    if (!plainText) return;

    // Add job to background processor - it returns the job with ID
    const job = backgroundProcessor.addJob(
      plainText,
      entitiesState.topics,
      notesState.notes,
      settingsState.aiSettings,
      settingsState.learnings,
      settingsState.learningSettings,
      tasksState.tasks,
      attachments,
      extractTasks // Pass the extractTasks preference
    );

    // Store auto-save preference in the job
    (job as ExtendedJob)._autoSave = autoSave;

    // Add to state using the SAME job from processor (must include ID for progress tracking)
    addProcessingJob({
        id: job.id,
        createdAt: job.createdAt,
        type: job.type,
        input: job.input,
        status: job.status,
        progress: job.progress,
      });

    // Track capture stat
    uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'captureCount' });

    // Mark first capture complete for tooltip
    markFirstCaptureComplete();

    // Clear input immediately
    setInputText('');
    setAttachments([]);
    setError(null);

    // Show success notification
    addNotification({
        type: 'info',
        title: autoSave ? 'Processing & Auto-Saving' : 'Processing in Background',
        message: autoSave
          ? 'Your note will be automatically saved after AI processing.'
          : 'Your note is being processed by AI. You can continue capturing more notes.',
      });
  };

  const handleSaveFromReview = (editedNotes: AIProcessResult['notes'], editedTasks: Task[], removedTaskIndexes: number[]) => {
    if (!results) return;

    // Save notes and topics as before
    const topicIdMap = new Map<string, string>();

    results.detectedTopics.forEach(detected => {
      if (detected.existingTopicId) {
        topicIdMap.set(detected.name, detected.existingTopicId);
      } else {
        const newTopic = createTopic(detected.name);
        addTopic(newTopic );
        topicIdMap.set(detected.name, newTopic.id);
      }
    });

    // Create/merge notes (using edited notes from review)
    const createdNotes: typeof notesState.notes = [];
    editedNotes.forEach(noteResult => {
      const topicId = topicIdMap.get(noteResult.topicName) || noteResult.topicId;
      const hashtagsFromSource = extractHashtags(noteResult.sourceText || '');
      const hashtagsFromContent = extractHashtags(noteResult.content);
      // Use edited tags from noteResult, combined with extracted hashtags
      const allTags = combineTags(noteResult.tags || [], results.keyTopics, hashtagsFromSource, hashtagsFromContent);

      if (noteResult.isNew) {
        const newNote = createNote(
          topicId,
          noteResult.content,
          noteResult.summary,
          {
            tags: allTags,
            sourceText: noteResult.sourceText,
            metadata: {
              sentiment: noteResult.sentiment || results.sentiment,
              keyPoints: noteResult.keyPoints || [noteResult.summary],
              relatedTopics: noteResult.relatedTopics,
            },
          }
        );
        // Set source from noteResult
        if (noteResult.source) {
          newNote.source = noteResult.source;
        }
        addNote(newNote );
        uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'noteCount' });
        createdNotes.push(newNote);
      } else if (noteResult.mergedWith) {
        const existingNote = notesState.notes.find(n => n.id === noteResult.mergedWith);
        if (existingNote) {
          const now = new Date().toISOString();
          const mergedTags = combineTags(existingNote.tags, allTags);

          const currentAsUpdate: import('../types').NoteUpdate = {
            id: generateId(),
            content: existingNote.content,
            timestamp: existingNote.lastUpdated || existingNote.timestamp,
            source: existingNote.source,
            summary: existingNote.summary,
            sourceText: existingNote.sourceText,
            tags: existingNote.tags,
          };

          const updatedUpdates = [
            ...(existingNote.updates || []),
            currentAsUpdate,
          ];

          const updatedNote = {
            ...existingNote,
            content: noteResult.content,
            summary: noteResult.summary,
            lastUpdated: now,
            tags: mergedTags,
            sourceText: noteResult.sourceText,
            updates: updatedUpdates,
            source: noteResult.source || existingNote.source,
            metadata: {
              ...existingNote.metadata,
              sentiment: noteResult.sentiment || results.sentiment,
              keyPoints: noteResult.keyPoints || [noteResult.summary],
              relatedTopics: noteResult.relatedTopics,
            },
          };
          updateNote(updatedNote );
          uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'noteCount' });
          createdNotes.push(updatedNote);
        }
      }
    });

    // Link tasks to the created/updated note
    const primaryNoteId = createdNotes.length > 0 ? createdNotes[0].id : undefined;

    // Process learnings from edited tasks
    const learningService = new LearningService(settingsState.learnings, settingsState.learningSettings);

    editedTasks.forEach((editedTask, index) => {
      // Find original task (before user edits)
      const originalTaskResult = results.tasks[index];

      if (originalTaskResult) {
        // Analyze what user changed
        learningService.analyzeTaskEdit(originalTaskResult, editedTask);
      }

      // Link task to the note BEFORE saving
      const taskWithNoteLink: Task = {
        ...editedTask,
        noteId: primaryNoteId,
      };

      // Save the task with note link
      addTask(taskWithNoteLink );
      uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'taskCount' });
    });

    // Track removed tasks (user rejected AI's task creation)
    removedTaskIndexes.forEach(index => {
      const removedTask = results.tasks[index];
      if (removedTask) {
        learningService.recordEvidence(
          'task-creation',
          'task extraction',
          'Do not create task',
          'reject',
          `Removed: "${removedTask.title}"`,
          { before: removedTask, after: null }
        );
      }
    });

    // TODO: Update learnings in SettingsContext
    // For now, learnings are updated in-memory but not persisted to SettingsContext
    // This will need to be fixed when we add a proper learnings update method to SettingsContext
    // uiDispatch({
    //   type: 'LOAD_STATE',
    //   payload: { learnings: learningService.getLearnings() }
    // });

    // Remove the job from completed queue
    if (currentJobId) {
      uiDispatch({ type: 'REMOVE_PROCESSING_JOB', payload: currentJobId });
      setCurrentJobId(null);
    }

    setCaptureState('complete');
  };

  // New handlers for Capture Zone 3.0

  const handleQuickTaskConfirm = async (task: AIProcessResult['tasks'][0]) => {
    // Create and save the task
    const taskWithMeta: Task = {
      id: generateId(),
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      tags: task.tags || [],
      done: false,
      status: 'todo',
      createdBy: 'ai',
      createdAt: new Date().toISOString(),
      sourceExcerpt: task.sourceExcerpt,
      subtasks: task.suggestedSubtasks?.map((title, idx) => ({
        id: `${generateId()}-${idx}`,
        title,
        done: false,
        createdAt: new Date().toISOString(),
      })),
    };

    addTask(taskWithMeta);
    uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'taskCount' });

    // Remove job from queue
    if (currentJobId) {
      uiDispatch({ type: 'REMOVE_PROCESSING_JOB', payload: currentJobId });
      setCurrentJobId(null);
    }

    // Clear quick confirmation state
    setShowQuickConfirm(false);
    setQuickConfirmTask(null);

    // Show success
    uiDispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        type: 'success',
        title: 'Task Saved!',
        message: `"${task.title}" has been added to your tasks.`,
      }
    });
  };

  const handleQuickTaskDiscard = () => {
    // Remove job from queue
    if (currentJobId) {
      uiDispatch({ type: 'REMOVE_PROCESSING_JOB', payload: currentJobId });
      setCurrentJobId(null);
    }

    // Clear quick confirmation state
    setShowQuickConfirm(false);
    setQuickConfirmTask(null);
  };

  const handleSaveFromNewReview = async (editedResult: CaptureResult) => {
    if (!editedResult) return;

    // Save topics
    const topicIdMap = new Map<string, string>();
    editedResult.detectedTopics.forEach(detected => {
      if (detected.existingTopicId) {
        topicIdMap.set(detected.name, detected.existingTopicId);
      } else {
        const newTopic = createTopic(detected.name);
        addTopic(newTopic);
        topicIdMap.set(detected.name, newTopic.id);
      }
    });

    // Save notes (if any)
    const createdNotes: typeof notesState.notes = [];
    if (editedResult.notes) {
      editedResult.notes.forEach(noteResult => {
        const topicId = topicIdMap.get(noteResult.topicName) || noteResult.topicId;
        const hashtagsFromSource = extractHashtags(noteResult.sourceText || '');
        const hashtagsFromContent = extractHashtags(noteResult.content);
        const allTags = combineTags(noteResult.tags || [], editedResult.keyTopics, hashtagsFromSource, hashtagsFromContent);

        const newNote = createNote(
          topicId,
          noteResult.content,
          noteResult.summary,
          {
            tags: allTags,
            sourceText: noteResult.sourceText,
            metadata: {
              sentiment: noteResult.sentiment || editedResult.sentiment,
              keyPoints: noteResult.keyPoints || [noteResult.summary],
              relatedTopics: noteResult.relatedTopics,
            },
          }
        );
        if (noteResult.source) {
          newNote.source = noteResult.source;
        }
        addNote(newNote);
        uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'noteCount' });
        createdNotes.push(newNote);
      });
    }

    // Save tasks (if any)
    if (editedResult.tasks) {
      const primaryNoteId = createdNotes.length > 0 ? createdNotes[0].id : undefined;
      editedResult.tasks.forEach(task => {
        const taskWithMeta: Task = {
          id: generateId(),
          title: task.title,
          description: task.description,
          priority: task.priority,
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          topicId: task.topicId,
          noteId: primaryNoteId,
          tags: task.tags || [],
          done: false,
          status: 'todo',
          createdBy: 'ai',
          createdAt: new Date().toISOString(),
          sourceNoteId: primaryNoteId,
          sourceExcerpt: task.sourceExcerpt,
          subtasks: task.suggestedSubtasks?.map((title, idx) => ({
            id: `${generateId()}-${idx}`,
            title,
            done: false,
            createdAt: new Date().toISOString(),
          })),
        };
        addTask(taskWithMeta);
        uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'taskCount' });
      });
    }

    // Remove job from queue
    if (currentJobId) {
      uiDispatch({ type: 'REMOVE_PROCESSING_JOB', payload: currentJobId });
      setCurrentJobId(null);
    }

    // Clear state
    setResults(null);
    setCaptureState('complete');
  };

  const handleRefineCapture = async (request: RefinementRequest): Promise<RefinementResponse> => {
    try {
      return await claudeService.refineCapture(request);
    } catch (error) {
      console.error('Failed to refine capture:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during refinement',
      };
    }
  };

  const handleReset = () => {
    setCaptureState('idle');
    setInputText('');
    setAttachments([]);
    setResults(null);
  };

  const handleViewNotes = () => {
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'notes'  });
  };

  // File handling functions
  const processFile = async (file: File): Promise<Attachment> => {
    const id = generateId();
    const attachment: Attachment = {
      id,
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
      name: file.name,
      mimeType: file.type,
      size: file.size,
      createdAt: new Date().toISOString(),
    };

    // Convert file to Uint8Array and save
    const fileData = await fileStorage.fileToUint8Array(file);
    const savedPath = await fileStorage.saveAttachment(attachment, fileData);
    attachment.path = savedPath;

    // Generate thumbnail for images
    if (file.type.startsWith('image/')) {
      const thumbnail = await fileStorage.generateThumbnail(file);
      attachment.thumbnail = thumbnail;

      const dimensions = await fileStorage.getImageDimensions(file);
      attachment.dimensions = dimensions;
    }

    return attachment;
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      try {
        const attachment = await processFile(file);
        setAttachments(prev => [...prev, attachment]);
      } catch (error) {
        console.error('Failed to process file:', error);
        setError(`Failed to process ${file.name}`);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const attachment = await processFile(file);
        setAttachments(prev => [...prev, attachment]);
      } catch (error) {
        console.error('Failed to process file:', error);
        setError(`Failed to process ${file.name}`);
      }
    }

    // Reset input
    e.target.value = '';
  };

  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          try {
            const attachment = await processFile(file);
            setAttachments(prev => [...prev, attachment]);
          } catch (error) {
            console.error('Failed to process pasted image:', error);
            setError('Failed to process pasted image');
          }
        }
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Add paste listener
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Auto-disable auto-save for long notes
  useEffect(() => {
    const plainText = inputText.replace(/<[^>]*>/g, '').trim();
    if (plainText.length > 1000 && autoSave) {
      setAutoSave(false);
      // Show notification to explain why auto-save was disabled
      addNotification({
          type: 'info',
          title: 'Auto-save Disabled',
          message: 'Auto-save has been turned off for this longer note so you can review it before saving.',
        });
    }
  }, [inputText, autoSave,  uiDispatch]);

  // Show background processing tooltip on first processing job
  useEffect(() => {
    const processingJobs = uiState.backgroundProcessing.queue.filter(
      j => j.status === 'processing' || j.status === 'queued'
    );

    if (
      !uiState.onboarding.featureIntroductions.backgroundProcessing &&
      processingJobs.length > 0 &&
      !showBackgroundTooltip
    ) {
      setShowBackgroundTooltip(true);
    }
  }, [uiState.backgroundProcessing.queue, uiState.onboarding.featureIntroductions.backgroundProcessing, showBackgroundTooltip]);

  const handleDismissBackgroundTooltip = () => {
    setShowBackgroundTooltip(false);
    uiDispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: 'backgroundProcessing' });
  };

  return (
    <div className="h-full w-full relative overflow-y-auto overflow-x-hidden">
      {/* Animated Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-teal-500/20 animate-gradient will-change-transform pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-tl from-blue-500/10 via-cyan-500/10 to-teal-500/10 animate-gradient-reverse will-change-transform pointer-events-none" />

      {/* Review Page (full zone takeover) */}
      {captureState === 'review' && results && (
        <div className="relative z-10 h-full w-full">
          <CaptureReview
            result={results}
            onSave={handleSaveFromNewReview}
            onCancel={() => {
              setCaptureState('idle');
              setResults(null);
            }}
            onRefine={handleRefineCapture}
          />
        </div>
      )}

      {/* Normal Capture Content - with max-w-3xl constraint */}
      {captureState !== 'review' && (
        <div className="relative z-10 w-full max-w-3xl mx-auto px-8 py-12 min-h-full flex flex-col">
          {/* Flexible top spacer - grows when there's space */}
          <div className="flex-grow min-h-[10vh]" />

        {captureState === 'idle' && (
          <div className="transform transition-all duration-300 ease-out flex-shrink-0">
            {/* Live Time Display */}
            <LiveTime />

            {/* Greeting Header - Combined greeting with inline name editing */}
            <div className="text-center mb-8">
              <GreetingHeader />
            </div>

            {/* AI-Generated Sarcastic Quote */}
            {settingsState.userProfile.name && <SarcasticQuote />}

            {/* Loading State */}
            {isCheckingKeys && (
              <div className={`${getGlassClasses('strong')} ${getRadiusClass('card')} p-12 text-center`}>
                <Loader2 size={ICON_SIZES.xl} className="text-cyan-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Checking API keys...</p>
              </div>
            )}

            {/* API Key Setup - Shown when no keys */}
            {!isCheckingKeys && !hasApiKeys && (
              <AnimatePresence mode="wait">
                <motion.div
                  key="api-setup"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <ApiKeyInput onComplete={() => {
                    setHasApiKeys(true);
                    uiDispatch({ type: 'COMPLETE_ONBOARDING' });
                  }} />
                </motion.div>
              </AnimatePresence>
            )}

            {/* Normal Capture Input - Shown when keys exist */}
            {!isCheckingKeys && hasApiKeys && (
              <AnimatePresence mode="wait">
                <motion.div
                  key="capture-input"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Frosted Glass Capture Box with Drag-Drop */}
                  <div
              className={`relative ${getGlassClasses('strong')} ${getRadiusClass('card')} overflow-hidden`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleFileDrop}
              role="region"
              aria-label="Capture input area with file drop support"
            >
              {/* Drag Overlay */}
              {dragActive && (
                <div className={`absolute inset-0 z-50 bg-cyan-500/20 backdrop-blur-sm border-2 border-dashed border-cyan-500 ${getRadiusClass('card')} flex items-center justify-center transition-all duration-200`}>
                  <div className="text-center">
                    <Upload size={ICON_SIZES['2xl']} className="text-cyan-600 mx-auto mb-4" />
                    <p className="text-2xl font-bold text-cyan-900">Drop files here</p>
                    <p className="text-cyan-700 mt-2">Images, videos, PDFs, and more</p>
                  </div>
                </div>
              )}

              <div className="p-6">
                <RichTextEditor
                  content={inputText}
                  onChange={setInputText}
                  placeholder="Capture your thoughts, call notes, or ideas here... Try bold, bullets, or links!"
                  onSubmit={handleSubmit}
                  autoFocus
                  minimal={false}
                  maxHeight="400px"
                  onFocus={() => setIsCaptureInputFocused(true)}
                  onBlur={() => setIsCaptureInputFocused(false)}
                />
              </div>

              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="px-6 py-4 border-t-2 border-white/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Paperclip size={ICON_SIZES.sm} className="text-gray-600" />
                    <span className="text-sm font-semibold text-gray-700">
                      {attachments.length} {attachments.length === 1 ? 'Attachment' : 'Attachments'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {attachments.map(attachment => (
                      <div key={attachment.id} className="relative group">
                        <div className={`aspect-square ${getRadiusClass('element')} overflow-hidden ${getGlassClasses('medium')} ${SHADOWS.input}`}>
                          {attachment.thumbnail ? (
                            <img
                              src={attachment.thumbnail}
                              alt={attachment.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon size={ICON_SIZES.lg} className="text-gray-400" />
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={() => removeAttachment(attachment.id)}
                          variant="danger"
                          size="sm"
                          className="absolute -top-2 -right-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity p-0"
                        >
                          <X size={ICON_SIZES.sm} />
                        </Button>
                        <div className="mt-1 text-xs text-gray-600 truncate">{attachment.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-8 py-5 border-t-2 border-white/30 space-y-3">
                {/* Top row: Keyboard hint and file picker */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-700/70 font-medium">
                      <kbd className="px-3 py-1.5 bg-white/50 backdrop-blur-sm rounded-lg text-xs font-semibold shadow-sm">⌘</kbd>
                      {' + '}
                      <kbd className="px-3 py-1.5 bg-white/50 backdrop-blur-sm rounded-lg text-xs font-semibold shadow-sm">Enter</kbd>
                      {' '}to process
                    </span>

                    {/* File Picker Button */}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,.pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <div className={`flex items-center gap-2 px-4 py-2 ${getGlassClasses('medium')} ${getRadiusClass('field')} hover:bg-white/80 transition-all duration-300 text-sm font-semibold text-gray-700 hover:text-cyan-600`}>
                        <Upload size={ICON_SIZES.sm} />
                        Add Files
                      </div>
                    </label>
                  </div>

                  {(inputText.trim() || attachments.length > 0) && (
                    <Button
                      onClick={handleSubmit}
                      variant="primary"
                      size="md"
                    >
                      Process & File
                    </Button>
                  )}
                </div>

                {/* Bottom row: Control toggles */}
                <div className="flex items-center gap-6 pt-2 border-t border-white/20">
                  {/* Auto-save toggle */}
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={autoSave}
                        onChange={(e) => setAutoSave(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className={`w-11 h-6 bg-white/40 backdrop-blur-sm peer-focus:outline-none ${getRadiusClass('pill')} peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:border-white/60 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-cyan-500 peer-checked:to-blue-500`}></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={ICON_SIZES.sm} className="text-gray-600 group-hover:text-cyan-600 transition-colors" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                        Auto-save (skip review)
                      </span>
                    </div>
                  </label>

                  {/* Extract tasks toggle */}
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={extractTasks}
                        onChange={(e) => setExtractTasks(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className={`w-11 h-6 bg-white/40 backdrop-blur-sm peer-focus:outline-none ${getRadiusClass('pill')} peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:border-white/60 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-cyan-500 peer-checked:to-blue-500`}></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckSquare size={ICON_SIZES.sm} className="text-gray-600 group-hover:text-cyan-600 transition-colors" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                        Extract tasks
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {error && (
              <div className={`mt-6 p-5 bg-gradient-to-r from-red-500/10 via-rose-500/5 to-red-400/10 backdrop-blur-2xl border-2 border-red-300/50 ${getRadiusClass('card')} text-red-700 font-medium shadow-lg`}>
                {error}
              </div>
            )}

            {/* Recent Activity Section */}
            {(uiState.backgroundProcessing.queue.length > 0 || uiState.backgroundProcessing.completed.length > 0) && (
              <div className="mt-8 space-y-4 relative">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Clock size={ICON_SIZES.md} className="text-cyan-600" />
                  Recent Activity
                </h2>

                {/* Background Processing Tooltip */}
                <FeatureTooltip
                  show={showBackgroundTooltip}
                  onDismiss={handleDismissBackgroundTooltip}
                  position="bottom-right"
                  title="💡 Tip: Working in the Background"
                  message="Your note is being processed! Notice the progress indicator above. You can keep working - I'll notify you when it's ready."
                  primaryAction={{
                    label: 'Got it',
                    onClick: () => {},
                  }}
                />

                {/* Processing Jobs */}
                {uiState.backgroundProcessing.queue.filter(j => j.status === 'processing' || j.status === 'queued').map(job => (
                  <div key={job.id} className={`${getGlassClasses('strong')} ${getRadiusClass('card')} p-6`}>
                    <div className="flex items-start gap-4">
                      <Loader2 size={ICON_SIZES.md} className="text-cyan-600 animate-spin flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-gray-900">Processing your note...</p>
                          <span className="text-sm text-gray-600">{job.progress}%</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                          {job.input}
                        </p>
                        {job.currentStep && (
                          <p className="text-xs text-cyan-700 mb-3">{job.currentStep}</p>
                        )}
                        <div className={`h-2 bg-white/40 ${getRadiusClass('pill')} overflow-hidden backdrop-blur-sm`}>
                          <div
                            className={`h-full bg-gradient-to-r from-cyan-500 to-blue-500 ${getRadiusClass('pill')} transition-all duration-300`}
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Completed Jobs */}
                {uiState.backgroundProcessing.completed.slice(0, 5).map(job => {
                  const taskCount = job.result?.tasks.length || 0;
                  const noteCount = job.result?.notes.length || 0;

                  return (
                    <div key={job.id} className={`${getGlassClasses('strong')} ${getRadiusClass('card')} p-6 hover:border-cyan-300 transition-all duration-300`}>
                      <div className="flex items-start gap-4">
                        <CheckCircle2 size={ICON_SIZES.md} className="text-green-600 flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-gray-900">Processing Complete!</p>
                            <span className="text-xs text-gray-500">
                              {new Date(job.completedAt!).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                            {job.input}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                            <span className="flex items-center gap-1">
                              <FileText size={ICON_SIZES.sm} />
                              {noteCount} {noteCount === 1 ? 'note' : 'notes'}
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle2 size={ICON_SIZES.sm} />
                              {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                const wrappedResult = wrapInCaptureResult(job.result!, job.input, []);
                                setResults(wrappedResult);
                                setCurrentJobId(job.id);
                                setCaptureState('review');
                              }}
                              variant="primary"
                              size="sm"
                              icon={<ArrowRight size={ICON_SIZES.sm} />}
                              iconPosition="right"
                            >
                              Review & Save
                            </Button>
                            <Button
                              onClick={() => uiDispatch({ type: 'REMOVE_PROCESSING_JOB', payload: job.id })}
                              variant="secondary"
                              size="sm"
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Error Jobs */}
                {uiState.backgroundProcessing.queue.filter(j => j.status === 'error').map(job => (
                  <div key={job.id} className={`bg-gradient-to-r from-red-500/20 via-rose-500/10 to-red-400/20 backdrop-blur-2xl ${getRadiusClass('card')} ${SHADOWS.elevated} border-2 border-red-300/50 p-6`}>
                    <div className="flex items-start gap-4">
                      <AlertCircle size={ICON_SIZES.md} className="text-red-600 flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-red-900">Processing Failed</p>
                        </div>
                        <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                          {job.input}
                        </p>
                        <p className="text-sm text-red-700 mb-4 font-medium">
                          {job.error}
                        </p>
                        <div className="flex gap-2">
                          {job.error?.includes('API key not set') && (
                            <Button
                              onClick={() => uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'profile' })}
                              variant="danger"
                              size="sm"
                              icon={<ArrowRight size={ICON_SIZES.sm} />}
                              iconPosition="right"
                            >
                              Go to Settings
                            </Button>
                          )}
                          <Button
                            onClick={() => uiDispatch({ type: 'REMOVE_PROCESSING_JOB', payload: job.id })}
                            variant="secondary"
                            size="sm"
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

                  {/* Onboarding Tooltips */}
                  <CaptureBoxTooltip isCaptureInputFocused={isCaptureInputFocused} />
                  <KeyboardShortcutsTooltip />
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        )}

        {/* Processing UI removed - now handled in background */}

        {/* Quick Task Confirmation (inline, below capture input) */}
        {showQuickConfirm && quickConfirmTask && (
          <QuickTaskConfirmation
            task={quickConfirmTask}
            processingTimeMs={results?.processingTimeMs || 0}
            onConfirm={handleQuickTaskConfirm}
            onEdit={(editedTask) => setQuickConfirmTask(editedTask)}
            onDiscard={handleQuickTaskDiscard}
          />
        )}

        {captureState === 'complete' && (
          <div className={`${getGlassClasses('strong')} ${getRadiusClass('modal')} p-10 space-y-6`}>
            {/* Success Header */}
            <div className="flex items-center gap-4">
              <CheckCircle2 size={ICON_SIZES.xl} className="text-green-500" />
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Successfully Saved!</h3>
                <p className="text-sm text-gray-700 font-medium">
                  Your notes and tasks have been saved and learnings updated
                </p>
              </div>
            </div>

            {/* AI Learning Badge */}
            <div className={`p-5 ${getInfoGradient('light').container} ${getRadiusClass('card')}`}>
              <div className="flex items-center gap-3">
                <Brain size={ICON_SIZES.md} className="text-cyan-600" />
                <div className="flex-1">
                  <h4 className="font-bold text-cyan-900">AI is Learning</h4>
                  <p className="text-sm text-cyan-700 mt-1">
                    Your edits help improve future suggestions
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleViewNotes}
                variant="primary"
                size="lg"
                icon={<FileText size={ICON_SIZES.sm} />}
                fullWidth
              >
                View Notes
              </Button>

              <Button
                onClick={handleReset}
                variant="secondary"
                size="lg"
                icon={<Plus size={ICON_SIZES.sm} />}
                fullWidth
              >
                Add Another
              </Button>

              <Button
                onClick={handleReset}
                variant="secondary"
                size="lg"
                className="px-6"
              >
                <Home size={ICON_SIZES.sm} />
              </Button>
            </div>
          </div>
        )}

          {/* Flexible bottom spacer - balances top spacing */}
          <div className="flex-grow min-h-[10vh]" />
        </div>
      )}
    </div>
  );
}
