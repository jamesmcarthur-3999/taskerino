import { useState, useEffect } from 'react';
import type { AIProcessResult, Task, Attachment, ProcessingJob, Topic, Note } from '../types';
import { useSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useEntities } from '../context/EntitiesContext';
import { useNotes } from '../context/NotesContext';
import { useTasks } from '../context/TasksContext';
import { useSessions } from '../context/SessionsContext';
import { createTopic, createNote, extractHashtags, combineTags, getTimeBasedGreeting, generateId } from '../utils/helpers';
import { CheckCircle2, FileText, Plus, Home, Brain, Upload, X, Image as ImageIcon, Paperclip, Loader2, ArrowRight, Clock, AlertCircle, CheckSquare } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { ResultsReview } from './ResultsReview';
import { LearningService } from '../services/learningService';
import { fileStorage } from '../services/fileStorageService';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { backgroundProcessor } from '../services/backgroundProcessor';
import { Button } from './Button';
import { FeatureTooltip } from './FeatureTooltip';
import { RADIUS, ICON_SIZES, SHADOWS, getGlassmorphism, getGlassClasses, getRadiusClass, getInfoGradient } from '../design-system/theme';

type CaptureState = 'idle' | 'processing' | 'review' | 'complete';

interface ExtendedJob extends ProcessingJob {
  _autoSave?: boolean;
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
  const { sessions } = useSessions();
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [results, setResults] = useState<AIProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [autoSave, setAutoSave] = useState(true);
  const [extractTasks, setExtractTasks] = useState(true);
  const [showBackgroundTooltip, setShowBackgroundTooltip] = useState(false);

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
                setResults(job.result!);
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

      {/* Content - with flexible spacing */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-8 py-12 min-h-full flex flex-col">
        {/* Flexible top spacer - grows when there's space */}
        <div className="flex-grow min-h-[10vh]" />

        {captureState === 'idle' && (
          <div className="transform transition-all duration-300 ease-out flex-shrink-0">
            {/* Time Display */}
            {settingsState.userProfile.name && <LiveTime />}

            {/* Greeting */}
            {settingsState.userProfile.name && (
              <div className="text-center mb-8">
                <h1 className="text-5xl font-bold text-gray-800/90" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Good {getTimeBasedGreeting()}, {settingsState.userProfile.name}
                </h1>
              </div>
            )}

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
                                setResults(job.result!);
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
          </div>
        )}

        {/* Processing UI removed - now handled in background */}

        {captureState === 'review' && results && (
          <div className="h-full w-full overflow-y-auto">
            <ResultsReview
              results={results}
              onSave={handleSaveFromReview}
              onCancel={() => {
                setCaptureState('idle');
                setResults(null);
              }}
            />
          </div>
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
    </div>
  );
}
