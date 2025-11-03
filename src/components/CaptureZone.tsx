import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AIProcessResult, Task, Attachment, ProcessingJob, Topic, Note } from '../types';
import type { CaptureResult, RefinementRequest, RefinementResponse } from '../types/captureProcessing';
import { useSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useEntities } from '../context/EntitiesContext';
import { useNotes } from '../context/NotesContext';
import { useTasks } from '../context/TasksContext';
import { useSessionList } from '../context/SessionListContext';
import { useRelationships } from '../context/RelationshipContext';
import { EntityType, RelationshipType } from '../types/relationships';
import { createTopic, createNote, extractHashtags, combineTags, getTimeBasedGreeting, generateId } from '../utils/helpers';
import { CheckCircle2, FileText, Plus, Home, Brain, Upload, X, Image as ImageIcon, Paperclip, Loader2, ArrowRight, Clock, AlertCircle, CheckSquare, Eye, EyeOff, Check, ExternalLink, Lock } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { CaptureReview } from './capture/CaptureReview';
import { QuickTaskConfirmation } from './capture/QuickTaskConfirmation';
import { LearningService } from '../services/learningService';
import { savePendingReview, deletePendingReview, cleanupOldReviews, loadPendingReviews, deduplicatePendingReviews, getPendingReview } from '../services/captureReviewStorage';
import type { PersistedReviewJob } from '../types/captureProcessing';
import { getStorage } from '../services/storage';
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
        ease: [0.4, 0, 0.2, 1] as const,
      },
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 20 : -20,
      opacity: 0,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1] as const,
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

export default function CaptureZone() {
  const { state: settingsState, dispatch: settingsDispatch } = useSettings();
  const { state: uiState, dispatch: uiDispatch, addNotification, addProcessingJob } = useUI();
  const { state: entitiesState, addTopic } = useEntities();
  const { state: notesState, addNote, updateNote, deleteNote } = useNotes();
  const { state: tasksState, addTask } = useTasks();
  const { sessions } = useSessionList();
  const relationshipsContext = useRelationships();
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [results, setResults] = useState<CaptureResult | null>(null);
  const [showQuickConfirm, setShowQuickConfirm] = useState(false);
  const [quickConfirmTask, setQuickConfirmTask] = useState<AIProcessResult['tasks'][0] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [showBackgroundTooltip, setShowBackgroundTooltip] = useState(false);
  const [isCaptureInputFocused, setIsCaptureInputFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // API key state
  const [hasApiKeys, setHasApiKeys] = useState(false);
  const [isCheckingKeys, setIsCheckingKeys] = useState(true);

  // Pending reviews state
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [showPendingReviews, setShowPendingReviews] = useState(false);
  const [pendingReviewsList, setPendingReviewsList] = useState<PersistedReviewJob[]>([]);

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

  // Load pending reviews on mount and cleanup old ones
  // ALSO restore most recent review to survive hot reloads
  useEffect(() => {
    const loadPendingReviewsData = async () => {
      try {
        // Deduplicate reviews (remove duplicates from the bug)
        const removedCount = await deduplicatePendingReviews();
        if (removedCount > 0) {
          console.log(`[CaptureZone] Removed ${removedCount} duplicate pending reviews`);
        }

        // Cleanup old reviews (>7 days)
        await cleanupOldReviews();

        // Load pending reviews
        const reviews = await loadPendingReviews();
        const activeReviews = reviews.filter(
          (r) => r.status === 'pending_review' || r.status === 'in_review'
        );
        setPendingReviewsCount(activeReviews.length);
        setPendingReviewsList(activeReviews);

        // Auto-expand if there are pending reviews
        if (activeReviews.length > 0) {
          setShowPendingReviews(true);

          // Verify draft notes still exist for each review
          // Clean up any stale reviews where notes were deleted
          for (const review of activeReviews) {
            const notesExist = (review.draftNoteIds || []).every(
              id => notesState.notes.find(n => n.id === id)
            );

            if (!notesExist) {
              console.warn('[CaptureZone] Draft notes missing for review, cleaning up:', review.id);
              await deletePendingReview(review.id);
            }
          }

          // Reload pending reviews after cleanup
          const updatedReviews = await loadPendingReviews();
          const validReviews = updatedReviews.filter(
            (r) => r.status === 'pending_review' || r.status === 'in_review'
          );
          setPendingReviewsList(validReviews);
          setPendingReviewsCount(validReviews.length);
        }
      } catch (error) {
        console.error('Failed to load pending reviews:', error);
      }
    };

    loadPendingReviewsData();
  }, []);

  // Load draft capture text from storage on mount
  useEffect(() => {
    const loadDraftText = async () => {
      try {
        const storage = await getStorage();
        const draftText = await storage.load<string>('capture-draft-text');
        if (draftText) {
          setInputText(draftText);
          console.log('[CaptureZone] Loaded draft text from storage');
        }
      } catch (error) {
        console.error('[CaptureZone] Failed to load draft text:', error);
      } finally {
        setIsDraftLoaded(true);
      }
    };

    loadDraftText();
  }, []);

  // Save draft capture text to storage as user types (debounced)
  useEffect(() => {
    // Skip initial load
    if (!isDraftLoaded) return;

    const saveDraftText = async () => {
      try {
        const storage = await getStorage();
        if (inputText.trim()) {
          await storage.save('capture-draft-text', inputText);
        } else {
          // Clear storage if text is empty
          await storage.save('capture-draft-text', '');
        }
      } catch (error) {
        console.error('[CaptureZone] Failed to save draft text:', error);
      }
    };

    // Debounce saves by 1 second
    const timeoutId = setTimeout(saveDraftText, 1000);

    return () => clearTimeout(timeoutId);
  }, [inputText, isDraftLoaded]);

  // Auto-scroll to align capture box below navigation when expanding
  useEffect(() => {
    if (!isExpanded || !editorContainerRef.current) return;

    // Small delay to let the expansion animation start
    const scrollTimer = setTimeout(() => {
      const captureBox = editorContainerRef.current;
      if (!captureBox) return;

      const captureBoxTop = captureBox.getBoundingClientRect().top;
      const captureBoxBottom = captureBox.getBoundingClientRect().bottom;
      const viewportHeight = window.innerHeight;
      const navigationHeight = 100; // Navigation island height + some padding

      // Only auto-scroll if:
      // 1. Capture box top is above navigation (user scrolled past it)
      // 2. Capture box is mostly in view (user is focused on it, not content below)
      const isAboveNavigation = captureBoxTop < navigationHeight;
      const isMostlyInView = captureBoxTop < viewportHeight * 0.8;

      if (isAboveNavigation || (isMostlyInView && captureBoxBottom > navigationHeight)) {
        const scrollOffset = window.scrollY;
        const targetScrollPosition = scrollOffset + captureBoxTop - navigationHeight;

        window.scrollTo({
          top: targetScrollPosition,
          behavior: 'smooth'
        });

        console.log('[Auto-scroll] Aligning capture box below navigation');
      } else {
        console.log('[Auto-scroll] Skipped - user is viewing content below');
      }
    }, 100);

    return () => clearTimeout(scrollTimer);
  }, [isExpanded]);

  // Scroll detection for expansion
  useEffect(() => {
    if (!editorContainerRef.current) return;

    const checkScroll = () => {
      const container = editorContainerRef.current;
      if (!container) return;

      // Get the ProseMirror editor element (the actual content)
      const proseMirrorElement = container.querySelector('.ProseMirror') as HTMLElement;
      if (!proseMirrorElement) return;

      // Always measure against the COLLAPSED height (400px) to avoid feedback loops
      const contentHeight = proseMirrorElement.scrollHeight;
      const collapsedMaxHeight = 400; // Match the collapsed maxHeight
      const threshold = 20; // Buffer for padding/margins

      console.log('[Scroll Detection]', {
        contentHeight,
        collapsedMaxHeight,
        needsExpansion: contentHeight > collapsedMaxHeight + threshold,
        canCollapse: contentHeight <= collapsedMaxHeight - threshold,
        isExpanded
      });

      // Expand: Content exceeds collapsed height
      if (contentHeight > collapsedMaxHeight + threshold && !isExpanded) {
        console.log('[Expanding] Content exceeds collapsed height');
        setIsExpanded(true);
      }
      // Collapse: Content comfortably fits in collapsed height (with hysteresis)
      else if (contentHeight <= collapsedMaxHeight - threshold && isExpanded) {
        console.log('[Collapsing] Content fits within collapsed height');
        setIsExpanded(false);
      }
    };

    // Use ResizeObserver to detect content size changes
    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });

    const container = editorContainerRef.current;
    const proseMirrorElement = container.querySelector('.ProseMirror');

    if (proseMirrorElement) {
      resizeObserver.observe(proseMirrorElement);
    }

    // Also observe the container for size changes
    resizeObserver.observe(container);

    // Initial check with slight delay to ensure DOM is ready
    setTimeout(checkScroll, 100);

    return () => {
      resizeObserver.disconnect();
    };
  }, [inputText, isExpanded]);

  // Watch for pending review job ID from notifications
  useEffect(() => {
    const pendingJobId = uiState.pendingReviewJobId;
    if (pendingJobId && uiState.activeTab === 'capture') {
      const openReview = async () => {
        // Find the job in completed queue
        const job = uiState.backgroundProcessing.completed.find(j => j.id === pendingJobId);
        if (job && job.result) {
          // Fetch createdNoteIds from persisted review
          const persistedReview = await getPendingReview(pendingJobId);
          const noteIds = persistedReview?.draftNoteIds || [];

          // Open review for this job
          const wrappedResult = wrapInCaptureResult(job.result, job.input, [], noteIds);
          setResults(wrappedResult);
          setCurrentJobId(job.id);
          setCaptureState('review');
          // Clear the pending review job ID
          uiDispatch({ type: 'SET_PENDING_REVIEW_JOB', payload: undefined });
        }
      };
      openReview();
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

  const wrapInCaptureResult = (aiResult: AIProcessResult, plainText: string, attachments: Attachment[], createdNoteIds: string[] = []): CaptureResult => {
    return {
      ...aiResult,
      aiSummary: (aiResult as any).aiSummary || generateDefaultSummary(aiResult),
      modelUsed: 'claude-haiku-4.5',
      processingTimeMs: 0, // backgroundProcessor doesn't track timing yet
      createdNoteIds,
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

  const shouldShowQuickConfirmation = (result: CaptureResult) => {
    return result.tasks?.length === 1 && (result.notes?.length ?? 0) === 0;
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
      // Create draft notes BEFORE completing the job so createdNoteIds can be included in the result
      const createdNoteIds: string[] = [];
      if (job.result?.notes && job.result.notes.length > 0) {
        job.result.notes.forEach(noteResult => {
          const newNote: Note = {
            id: generateId(),
            relationships: [], // Empty for now - relationships created when user clicks Save
            content: noteResult.content,
            summary: noteResult.summary,
            sourceText: '', // AIProcessResult notes don't include sourceText
            timestamp: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            source: noteResult.source || 'thought',
            status: 'draft', // Set as draft for review workflow
            tags: noteResult.tags || [],
            metadata: {
              sentiment: noteResult.sentiment,
              keyPoints: noteResult.keyPoints,
            },
          };
          addNote(newNote);
          createdNoteIds.push(newNote.id);
        });
      }

      // Complete the job
      uiDispatch({
        type: 'COMPLETE_PROCESSING_JOB',
        payload: {
          id: job.id,
          result: job.result!,
        }
      });

      // Always show review - simplified binary decision:
      // - Single task only → Quick confirmation inline
      // - Everything else → Full review modal

      // Wrap result in CaptureResult for review UI
      const wrappedResult = wrapInCaptureResult(job.result!, job.input, [], createdNoteIds);

      // Save pending review for persistence across app restarts
      const persistedReview: PersistedReviewJob = {
        id: job.id,
        createdAt: new Date().toISOString(),
        result: wrappedResult,
        draftNoteIds: createdNoteIds,
        status: 'pending_review',
        lastModified: new Date().toISOString(),
      };
      savePendingReview(persistedReview).catch((error) => {
        console.error('Failed to save pending review:', error);
      });

      // Check if we should show quick confirmation for single task
      if (shouldShowQuickConfirmation(wrappedResult)) {
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
        const topicCount = job.result?.newEntities?.topics?.length || 0;
        const noteCount = createdNoteIds.length;

        uiDispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'success',
            title: 'Processing Complete!',
            message: `Found ${noteCount} notes, ${taskCount} tasks and ${topicCount} topics.`,
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

    // Collapse the capture box
    setIsExpanded(false);

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
      true // Always extract tasks
    );

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

    // Clear input and draft from storage
    setInputText('');
    setAttachments([]);
    setError(null);

    // Clear draft from storage
    try {
      const storage = await getStorage();
      await storage.save('capture-draft-text', '');
    } catch (error) {
      console.error('[CaptureZone] Failed to clear draft text:', error);
    }

    // Show success notification
    addNotification({
        type: 'info',
        title: 'Processing in Background',
        message: 'Your note is being processed by AI. You can continue capturing more notes.',
      });
  };

  const handleSaveFromReview = async (editedNotes: AIProcessResult['notes'], editedTasks: Task[], removedTaskIndexes: number[]) => {
    if (!results) return;

    // Create topics from AI detections
    const topicIdMap = new Map<string, string>();
    if (results.newEntities?.topics) {
      for (const topicData of results.newEntities.topics) {
        const existing = entitiesState.topics.find(t => t.name.toLowerCase() === topicData.name.toLowerCase());
        if (existing) {
          topicIdMap.set(topicData.name, existing.id);
        } else {
          const newTopic = createTopic(topicData.name);
          addTopic(newTopic);
          topicIdMap.set(topicData.name, newTopic.id);
        }
      }
    }

    // If no topics detected, create "General Notes" topic
    if (topicIdMap.size === 0 && editedNotes.length > 0) {
      let generalTopicId: string;
      const existing = entitiesState.topics.find(t => t.name === 'General Notes');
      if (existing) {
        generalTopicId = existing.id;
      } else {
        const generalTopic = createTopic('General Notes');
        addTopic(generalTopic);
        generalTopicId = generalTopic.id;
      }
      topicIdMap.set('General Notes', generalTopicId);
    }

    // Create/merge notes (using edited notes from review)
    const createdNotes: typeof notesState.notes = [];
    const noteIds: string[] = [];

    editedNotes.forEach(noteResult => {
      const hashtagsFromContent = extractHashtags(noteResult.content);
      const allTags = combineTags(noteResult.tags || [], hashtagsFromContent);

      if (noteResult.action === 'create') {
        const newNote = createNote(
          noteResult.content,
          noteResult.summary,
          {
            tags: allTags,
            sourceText: '', // AIProcessResult notes don't include sourceText
            metadata: {
              sentiment: noteResult.sentiment || results.sentiment,
              keyPoints: noteResult.keyPoints || [noteResult.summary],
            },
          }
        );
        if (noteResult.source) {
          newNote.source = noteResult.source;
        }
        addNote(newNote);
        uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'noteCount' });
        createdNotes.push(newNote);
        noteIds.push(newNote.id);
      } else if (noteResult.mergeWith && noteResult.mergeWith.length > 0) {
        const existingNote = notesState.notes.find(n => n.id === noteResult.mergeWith![0]);
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

          const updatedNote = {
            ...existingNote,
            content: noteResult.content,
            summary: noteResult.summary,
            lastUpdated: now,
            tags: mergedTags,
            sourceText: existingNote.sourceText, // Keep existing sourceText (AIProcessResult notes don't include it)
            updates: [...(existingNote.updates || []), currentAsUpdate],
            source: noteResult.source || existingNote.source,
            metadata: {
              ...existingNote.metadata,
              sentiment: noteResult.sentiment || results.sentiment,
              keyPoints: noteResult.keyPoints || [noteResult.summary],
            },
          };
          updateNote(updatedNote);
          uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'noteCount' });
          createdNotes.push(updatedNote);
          noteIds.push(updatedNote.id);
        }
      }
    });

    // Create note→topic relationships
    if (results.relationships && noteIds.length > 0) {
      for (const rel of results.relationships) {
        if (rel.from.type === 'note' && rel.to.type === 'topic' && rel.to.id) {
          const tempNoteIndex = results.notes.findIndex(n => n.id === rel.from.id);
          if (tempNoteIndex >= 0 && tempNoteIndex < noteIds.length) {
            const realNoteId = noteIds[tempNoteIndex];
            const topicId = topicIdMap.get(rel.to.id);

            if (topicId) {
              await relationshipsContext.addRelationship({
                sourceType: EntityType.NOTE,
                sourceId: realNoteId,
                targetType: EntityType.TOPIC,
                targetId: topicId,
                type: RelationshipType.NOTE_TOPIC,
                metadata: { source: 'ai', createdAt: new Date().toISOString() },
              });
            }
          }
        }
      }
    } else if (topicIdMap.size > 0 && noteIds.length > 0) {
      // Fallback: link all notes to first topic
      const firstTopicId = Array.from(topicIdMap.values())[0];
      for (const noteId of noteIds) {
        await relationshipsContext.addRelationship({
          sourceType: EntityType.NOTE,
          sourceId: noteId,
          targetType: EntityType.TOPIC,
          targetId: firstTopicId,
          type: RelationshipType.NOTE_TOPIC,
          metadata: { source: 'ai', createdAt: new Date().toISOString() },
        });
      }
    }

    // Process learnings from edited tasks
    const learningService = new LearningService(settingsState.learnings, settingsState.learningSettings);

    editedTasks.forEach((editedTask, index) => {
      // Find original task (before user edits)
      const originalTaskResult = results.tasks[index];

      if (originalTaskResult) {
        // Analyze what user changed
        learningService.analyzeTaskEdit(originalTaskResult, editedTask);
      }

      // Save the task (relationships will be in editedTask already)
      addTask(editedTask);
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

    // Persist updated learnings to SettingsContext
    settingsDispatch({
      type: 'LOAD_SETTINGS',
      payload: {
        learnings: learningService.getLearnings()
      }
    });

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
      relationships: [],
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

  const handleSaveFromNewReview = async (noteIds: string[], editedTasks: Task[], removedTaskIndexes: number[]) => {
    // Delete the persisted review job since it's being saved
    if (currentJobId) {
      deletePendingReview(currentJobId).catch((error) => {
        console.error('Failed to delete pending review:', error);
      });
      handleReviewsChanged(); // Update count
    }

    // Notes were created as drafts and CaptureReview already updated them to status='approved'
    // Just need to update onboarding stats
    noteIds.forEach(() => {
      uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'noteCount' });
    });

    // Save tasks (if any) - they already have relationships set by CaptureReview
    editedTasks.forEach(task => {
      addTask(task);
      uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'taskCount' });
    });

    // Show success notification
    uiDispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        type: 'success',
        title: 'Saved Successfully',
        message: `${noteIds.length} ${noteIds.length === 1 ? 'note' : 'notes'} and ${editedTasks.length} ${editedTasks.length === 1 ? 'task' : 'tasks'} saved`,
        autoDismiss: true,
        dismissAfter: 3000,
      },
    });

    // Remove job from queue
    if (currentJobId) {
      uiDispatch({ type: 'REMOVE_PROCESSING_JOB', payload: currentJobId });
      setCurrentJobId(null);
    }

    // Clear state
    setResults(null);
    setCaptureState('idle');
    setInputText('');
  };

  const handleRefineCapture = async (request: RefinementRequest): Promise<RefinementResponse> => {
    try {
      return await claudeService.refineCapture(request, {
        updateNote,
        state: notesState,
      });
    } catch (error) {
      console.error('Failed to refine capture:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during refinement',
      };
    }
  };

  const handleReset = async () => {
    setCaptureState('idle');
    setInputText('');
    setAttachments([]);
    setResults(null);

    // Clear draft from storage
    try {
      const storage = await getStorage();
      await storage.save('capture-draft-text', '');
    } catch (error) {
      console.error('[CaptureZone] Failed to clear draft text:', error);
    }
  };

  const handleViewNotes = () => {
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'notes'  });
  };

  // Pending reviews handlers
  const handleResumeReview = (review: PersistedReviewJob) => {
    // Transfer draftNoteIds to result.createdNoteIds (fixes notes not showing in review)
    const resultWithNoteIds = {
      ...review.result,
      createdNoteIds: review.draftNoteIds || [],
    };
    setResults(resultWithNoteIds);
    setCurrentJobId(review.id);
    setCaptureState('review');
    setShowPendingReviews(false);
  };

  const handleReviewsChanged = async () => {
    // Reload count AND list after reviews change
    try {
      const reviews = await loadPendingReviews();
      const activeReviews = reviews.filter(
        (r) => r.status === 'pending_review' || r.status === 'in_review'
      );
      setPendingReviewsCount(activeReviews.length);
      setPendingReviewsList(activeReviews); // THIS WAS MISSING! 🔥
    } catch (error) {
      console.error('Failed to reload pending reviews count:', error);
    }
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
            jobId={currentJobId || undefined}  // Pass jobId to prevent duplicate reviews
            onSave={handleSaveFromNewReview}
            onCancel={() => {
              // Just close the modal - don't delete anything
              // This allows users to close and reopen pending reviews
              setCaptureState('idle');
              setResults(null);
            }}
            onRefine={handleRefineCapture}
          />
        </div>
      )}

      {/* Normal Capture Content - max-w responsive to expansion */}
      {captureState !== 'review' && (
        <div className={`relative z-10 w-full ${isExpanded ? 'max-w-6xl' : 'max-w-3xl'} mx-auto px-8 py-12 min-h-full flex flex-col transition-all duration-300`}>
          {/* Flexible top spacer - grows when there's space */}
          <div className="flex-grow min-h-[10vh]" />

        {captureState === 'idle' && (
          <div className="transition-all duration-300 ease-out flex-shrink-0">
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
                  <motion.div
              ref={editorContainerRef}
              layout
              animate={{
                scale: isExpanded ? 1.02 : 1.0,
              }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
              }}
              className={`relative ${getGlassClasses('strong')} ${getRadiusClass('card')} overflow-visible w-full`}
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
                  maxHeight={isExpanded ? undefined : '400px'}
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

              {/* Static Controls - Collapsed State */}
              {!isExpanded && (
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

                </div>
              )}

              {/* Floating Controls - Expanded State (Fixed to viewport) */}
              {isExpanded && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1
                    }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="fixed bottom-6 z-[9999]"
                    style={{
                      right: 'calc((100vw - 72rem) / 2 + 1.5rem)' // Align with max-w-6xl right edge + padding
                    }}
                  >
                    <div className={`${getGlassClasses('strong')} ${getRadiusClass('pill')} px-6 py-4 shadow-2xl border-2 border-white/60`}>
                      <div className="flex items-center gap-3">

                        {/* File upload - icon only */}
                        <label className="cursor-pointer" title="Add files">
                          <input
                            type="file"
                            multiple
                            accept="image/*,video/*,.pdf"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          <div className={`w-10 h-10 ${getGlassClasses('medium')} ${getRadiusClass('pill')} flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-white/80 text-gray-700 hover:text-cyan-600`}>
                            <Upload size={ICON_SIZES.sm} />
                          </div>
                        </label>

                        {/* Process button - pill style */}
                        {(inputText.trim() || attachments.length > 0) && (
                          <>
                            <div className="w-px h-8 bg-white/40" />
                            <button
                              onClick={handleSubmit}
                              className={`${getRadiusClass('pill')} px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold text-sm hover:from-cyan-600 hover:to-blue-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2`}
                            >
                              <ArrowRight size={ICON_SIZES.sm} />
                              Process & File
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </motion.div>

            {error && (
              <div className={`mt-6 p-5 bg-gradient-to-r from-red-500/10 via-rose-500/5 to-red-400/10 backdrop-blur-2xl border-2 border-red-300/50 ${getRadiusClass('card')} text-red-700 font-medium shadow-lg`}>
                {error}
              </div>
            )}

            {/* Recent Activity Section */}
            {(uiState.backgroundProcessing.queue.length > 0 || uiState.backgroundProcessing.completed.length > 0 || pendingReviewsList.length > 0) && (
              <div className="mt-8 space-y-4 relative">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Clock size={ICON_SIZES.md} className="text-cyan-600" />
                    Recent Activity
                  </h2>

                  {/* Clear All Button */}
                  {(pendingReviewsList.length > 0 || uiState.backgroundProcessing.completed.length > 0) && (
                    <Button
                      onClick={async () => {
                        // Delete all persisted reviews and their draft notes
                        for (const review of pendingReviewsList) {
                          (review.draftNoteIds || []).forEach(noteId => {
                            deleteNote(noteId);
                          });
                          await deletePendingReview(review.id);
                        }

                        // Clear all completed jobs from UIContext
                        uiState.backgroundProcessing.completed.forEach(job => {
                          uiDispatch({ type: 'REMOVE_PROCESSING_JOB', payload: job.id });
                        });

                        // Reload list
                        await handleReviewsChanged();
                      }}
                      variant="secondary"
                      size="sm"
                    >
                      Clear All Completed
                    </Button>
                  )}
                </div>

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

                {/* Persisted Reviews (from storage - survive hot reload) */}
                {pendingReviewsList.map(review => {
                  const taskCount = review.result.tasks?.length || 0;
                  const noteCount = review.draftNoteIds?.length || 0;

                  return (
                    <div key={review.id} className={`${getGlassClasses('strong')} ${getRadiusClass('card')} p-6 hover:border-cyan-300 transition-all duration-300`}>
                      <div className="flex items-start gap-4">
                        <CheckCircle2 size={ICON_SIZES.md} className="text-green-600 flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-gray-900">Processing Complete!</p>
                            <span className="text-xs text-gray-500">
                              {new Date(review.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                            {review.result.aiSummary || 'Review pending'}
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
                                // Transfer draftNoteIds to result.createdNoteIds (fixes notes not showing)
                                const resultWithNoteIds = {
                                  ...review.result,
                                  createdNoteIds: review.draftNoteIds || [],
                                };
                                setResults(resultWithNoteIds);
                                setCurrentJobId(review.id);
                                setCaptureState('review');
                              }}
                              variant="primary"
                              size="sm"
                              icon={<ArrowRight size={ICON_SIZES.sm} />}
                              iconPosition="right"
                            >
                              Review
                            </Button>
                            <Button
                              onClick={async () => {
                                // Delete from storage
                                await deletePendingReview(review.id);

                                // Delete draft notes associated with this review
                                (review.draftNoteIds || []).forEach(noteId => {
                                  deleteNote(noteId);
                                });

                                // Also remove from UIContext if it exists there
                                uiDispatch({ type: 'REMOVE_PROCESSING_JOB', payload: review.id });

                                // Reload list
                                await handleReviewsChanged();
                              }}
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

                {/* Completed Jobs (in-memory - lost on hot reload) */}
                {uiState.backgroundProcessing.completed
                  .slice() // Create a copy to avoid mutating the original array
                  .reverse() // Newest first
                  .slice(0, 5) // Take first 5
                  .filter(job => {
                    // Hide the card if we're showing QuickTaskConfirmation for this job
                    if (showQuickConfirm && currentJobId === job.id) {
                      return false;
                    }

                    // DEDUPE: Hide if this job already exists in persisted reviews
                    const existsInPersisted = pendingReviewsList.some(review => review.id === job.id);
                    if (existsInPersisted) {
                      return false;
                    }

                    return true;
                  })
                  .map(job => {
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
                                onClick={async () => {
                                  // Fetch createdNoteIds from persisted review
                                  const persistedReview = await getPendingReview(job.id);
                                  const noteIds = persistedReview?.draftNoteIds || [];
                                  const wrappedResult = wrapInCaptureResult(job.result!, job.input, [], noteIds);
                                  setResults(wrappedResult);
                                  setCurrentJobId(job.id);
                                  setCaptureState('review');
                                }}
                                variant="primary"
                                size="sm"
                                icon={<ArrowRight size={ICON_SIZES.sm} />}
                                iconPosition="right"
                              >
                                Review
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
