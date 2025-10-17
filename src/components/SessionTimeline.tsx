import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Clock, CheckCircle2, AlertCircle, Loader2, MessageSquare, Flag, Eye, CheckSquare, FileText, Sparkles, ChevronDown, ChevronUp, Plus, Link as LinkIcon, Edit3 } from 'lucide-react';
import type { Session, SessionScreenshot, SessionAudioSegment, Task, Note, SessionContextItem } from '../types';
import { ScreenshotViewer } from './ScreenshotViewer';
import { ScreenshotCard } from './ScreenshotCard';
import { AudioSegmentCard } from './AudioSegmentCard';
import { useUI } from '../context/UIContext';
import { useTasks } from '../context/TasksContext';
import { useNotes } from '../context/NotesContext';
import { generateId } from '../utils/helpers';
import { RADIUS, getGlassClasses, getRadiusClass, TRANSITIONS, SCALE } from '../design-system/theme';

interface SessionTimelineProps {
  session: Session;
  onAddComment?: (screenshotId: string, comment: string) => void;
  onToggleFlag?: (screenshotId: string) => void;
  onAddContext?: (contextItem: SessionContextItem) => void;
  showContextCapture?: boolean;
}

export function SessionTimeline({ session, onAddComment, onToggleFlag, onAddContext }: SessionTimelineProps) {
  const { dispatch: uiDispatch, addNotification } = useUI();
  const { state: tasksState, addTask } = useTasks();
  const { state: notesState, addNote } = useNotes();
  const [selectedScreenshot, setSelectedScreenshot] = useState<SessionScreenshot | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [viewerScreenshot, setViewerScreenshot] = useState<SessionScreenshot | null>(null);
  const [expandedScreenshots, setExpandedScreenshots] = useState<Set<string>>(new Set());
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [showContextInput, setShowContextInput] = useState(false);
  const [contextMode, setContextMode] = useState<'quick' | 'link'>('quick');
  const [quickNoteContent, setQuickNoteContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLinkType, setSelectedLinkType] = useState<'note' | 'task'>('note');
  const contextInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus context input when shown
  useEffect(() => {
    if (showContextInput && contextInputRef.current) {
      contextInputRef.current.focus();
    }
  }, [showContextInput]);

  // Filter notes and tasks based on search
  const filteredNotes = notesState.notes.filter(note =>
    note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  const filteredTasks = tasksState.tasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  const screenshots = session.screenshots || [];
  const audioSegments = session.audioSegments || [];
  const contextItems = session.contextItems || [];

  // Merge screenshots, audio segments, and context items into timeline items
  type TimelineItem =
    | { type: 'screenshot'; data: SessionScreenshot }
    | { type: 'audio'; data: SessionAudioSegment }
    | { type: 'context'; data: SessionContextItem };

  const timelineItems: TimelineItem[] = [
    ...screenshots.map(s => ({ type: 'screenshot' as const, data: s })),
    ...audioSegments.map(a => ({ type: 'audio' as const, data: a })),
    ...contextItems.map(c => ({ type: 'context' as const, data: c }))
  ];

  // Sort by timestamp (most recent first)
  const sortedTimelineItems = [...timelineItems].sort((a, b) => {
    const timeA = new Date(a.data.timestamp).getTime();
    const timeB = new Date(b.data.timestamp).getTime();
    return timeB - timeA; // Reverse order (newest first)
  });

  const toggleExpanded = (screenshotId: string) => {
    setExpandedScreenshots(prev => {
      const next = new Set(prev);
      if (next.has(screenshotId)) {
        next.delete(screenshotId);
      } else {
        next.add(screenshotId);
      }
      return next;
    });
  };

  if (timelineItems.length === 0) {
    return (
      <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-12 text-center`}>
        <ImageIcon size={64} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Timeline Items Yet</h3>
        <p className="text-gray-600">
          Screenshots and audio segments will appear here as the session progresses
        </p>
      </div>
    );
  }

  const handleAddComment = (screenshotId: string) => {
    if (commentInput.trim() && onAddComment) {
      onAddComment(screenshotId, commentInput.trim());
      setCommentInput('');
    }
  };

  const handleViewScreenshot = (screenshot: SessionScreenshot, event: React.MouseEvent) => {
    // Capture the position of the clicked element
    const rect = event.currentTarget.getBoundingClientRect();
    setClickPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setViewerScreenshot(screenshot);
  };

  const handleCloseViewer = () => {
    setViewerScreenshot(null);
    setClickPosition(null);
  };

  const handleNextScreenshot = () => {
    if (!viewerScreenshot) return;
    const currentIndex = screenshots.findIndex(s => s.id === viewerScreenshot.id);
    if (currentIndex < screenshots.length - 1) {
      setViewerScreenshot(screenshots[currentIndex + 1]);
    }
  };

  const handlePrevScreenshot = () => {
    if (!viewerScreenshot) return;
    const currentIndex = screenshots.findIndex(s => s.id === viewerScreenshot.id);
    if (currentIndex > 0) {
      setViewerScreenshot(screenshots[currentIndex - 1]);
    }
  };

  const currentViewerIndex = viewerScreenshot
    ? screenshots.findIndex(s => s.id === viewerScreenshot.id)
    : -1;

  // Direct task creation with sidebar opening
  const handleExtractTask = (action: string, screenshotId: string) => {
    const now = new Date().toISOString();
    const newTask: Task = {
      id: generateId(),
      title: action.trim(),
      done: false,
      priority: 'medium',
      status: 'todo',
      createdBy: 'ai',
      createdAt: now,
      sourceSessionId: session.id,
      sourceExcerpt: action,
      description: `Extracted from session: ${session.name}`,
      contextForAgent: `This task was identified during the session "${session.name}".`,
      tags: [],
    };

    addTask(newTask);
    // Task-session linking handled automatically
    addNotification({
      type: 'success',
      title: 'Task Created',
      message: `Task added from session "${session.name}"`,
    });

    // Open sidebar for editing
    uiDispatch({
      type: 'OPEN_SIDEBAR',
      payload: {
        type: 'task',
        itemId: newTask.id,
        label: newTask.title,
      },
    });
  };

  // Direct note creation with sidebar opening
  const handleExtractNote = (summary: string, screenshotId: string) => {
    const now = new Date().toISOString();
    const newNote: Note = {
      id: generateId(),
      content: summary.trim(),
      summary: summary.trim().split('\n')[0].substring(0, 100),
      timestamp: now,
      lastUpdated: now,
      source: 'thought',
      tags: [],
      sourceSessionId: session.id,
      metadata: {
        keyPoints: [summary.trim().split('\n')[0].substring(0, 100)],
        relatedTopics: [session.name],
      },
    };

    addNote(newNote);
    // Note-session linking handled automatically
    addNotification({
      type: 'success',
      title: 'Note Created',
      message: `Note captured from session "${session.name}"`,
    });

    // Open sidebar for editing
    uiDispatch({
      type: 'OPEN_SIDEBAR',
      payload: {
        type: 'note',
        itemId: newNote.id,
        label: newNote.summary,
      },
    });
  };

  // Delete audio file while keeping transcription
  const handleDeleteAudio = (segmentId: string) => {
    // Audio deletion handled by parent component
    addNotification({
      type: 'success',
      title: 'Audio Deleted',
      message: 'Audio file removed. Transcription preserved.',
    });
  };

  // Handle adding quick note
  const handleAddQuickNote = () => {
    if (!quickNoteContent.trim() || !onAddContext) return;

    const contextItem: SessionContextItem = {
      id: `context-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sessionId: session.id,
      timestamp: new Date().toISOString(),
      type: 'note',
      content: quickNoteContent.trim(),
    };

    onAddContext(contextItem);
    setQuickNoteContent('');
    setShowContextInput(false);

    addNotification({
      type: 'success',
      title: 'Note Added',
      message: 'Quick note added to timeline',
    });
  };

  // Handle linking existing note/task
  const handleLinkItem = (itemId: string, itemType: 'note' | 'task') => {
    if (!onAddContext) return;

    const item = itemType === 'note'
      ? notesState.notes.find(n => n.id === itemId)
      : tasksState.tasks.find(t => t.id === itemId);

    if (!item) return;

    const contextItem: SessionContextItem = {
      id: `context-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sessionId: session.id,
      timestamp: new Date().toISOString(),
      type: itemType === 'note' ? 'note' : 'task',
      content: itemType === 'note' ? (item as Note).content : (item as Task).title,
      linkedItemId: itemId,
    };

    onAddContext(contextItem);
    setSearchQuery('');
    setShowContextInput(false);

    addNotification({
      type: 'success',
      title: `${itemType === 'note' ? 'Note' : 'Task'} Linked`,
      message: `Linked to timeline at ${new Date().toLocaleTimeString()}`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/40">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Session Timeline</h3>
          <p className="text-xs text-gray-600">
            {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''} • {audioSegments.length} audio segment{audioSegments.length !== 1 ? 's' : ''}
            {session.contextItems && session.contextItems.length > 0 && (
              <span> • {session.contextItems.length} context item{session.contextItems.length !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        {onAddContext && session.status === 'active' && (
          <button
            onClick={() => setShowContextInput(!showContextInput)}
            className={`px-3 py-1.5 ${getRadiusClass('element')} font-semibold text-xs ${TRANSITIONS.standard} flex items-center gap-1.5 ${
              showContextInput
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                : `${getGlassClasses('medium')} text-gray-700 hover:bg-white/60 ${SCALE.buttonHover}`
            }`}
          >
            <Plus size={14} />
            {showContextInput ? 'Hide' : 'Add Context'}
          </button>
        )}
      </div>

      {/* Inline Context Capture - Redesigned */}
      {showContextInput && onAddContext && (
        <div className={`${getGlassClasses('medium')} ${getRadiusClass('field')} p-4 animate-in slide-in-from-top-2 fade-in duration-200 shadow-lg`}>
          {/* Mode Toggle */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setContextMode('quick')}
              className={`flex-1 px-3 py-2 ${getRadiusClass('element')} text-xs font-semibold ${TRANSITIONS.standard} flex items-center justify-center gap-1.5 ${
                contextMode === 'quick'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                  : `${getGlassClasses('medium')} text-gray-700 hover:bg-white/80`
              }`}
            >
              <Edit3 size={12} />
              Quick Note
            </button>
            <button
              onClick={() => setContextMode('link')}
              className={`flex-1 px-3 py-2 ${getRadiusClass('element')} text-xs font-semibold ${TRANSITIONS.standard} flex items-center justify-center gap-1.5 ${
                contextMode === 'link'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                  : `${getGlassClasses('medium')} text-gray-700 hover:bg-white/80`
              }`}
            >
              <LinkIcon size={12} />
              Link Existing
            </button>
          </div>

          {/* Quick Note Mode */}
          {contextMode === 'quick' && (
            <div className="space-y-2">
              <input
                ref={contextInputRef}
                type="text"
                value={quickNoteContent}
                onChange={(e) => setQuickNoteContent(e.target.value)}
                placeholder="Type your note and press Enter..."
                className={`w-full px-3 py-2 bg-white/60 backdrop-blur-sm border border-white/80 ${getRadiusClass('element')} focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 outline-none transition-all text-sm text-gray-900 placeholder:text-gray-500`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && quickNoteContent.trim()) {
                    handleAddQuickNote();
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">Press Enter to add</span>
                <button
                  onClick={() => {
                    setShowContextInput(false);
                    setQuickNoteContent('');
                  }}
                  className="text-[10px] text-gray-500 hover:text-gray-700 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Link Existing Mode */}
          {contextMode === 'link' && (
            <div className="space-y-3">
              {/* Type selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedLinkType('note')}
                  className={`flex-1 px-3 py-1.5 ${getRadiusClass('element')} text-xs font-semibold ${TRANSITIONS.standard} ${
                    selectedLinkType === 'note'
                      ? 'bg-white/80 text-gray-900 border-2 border-cyan-300 shadow-sm'
                      : `${getGlassClasses('subtle')} text-gray-600 hover:bg-white/60`
                  }`}
                >
                  📝 Notes
                </button>
                <button
                  onClick={() => setSelectedLinkType('task')}
                  className={`flex-1 px-3 py-1.5 ${getRadiusClass('element')} text-xs font-semibold ${TRANSITIONS.standard} ${
                    selectedLinkType === 'task'
                      ? 'bg-white/80 text-gray-900 border-2 border-cyan-300 shadow-sm'
                      : `${getGlassClasses('subtle')} text-gray-600 hover:bg-white/60`
                  }`}
                >
                  ✓ Tasks
                </button>
              </div>

              {/* Search */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${selectedLinkType === 'note' ? 'notes' : 'tasks'}...`}
                className={`w-full px-3 py-2 ${getGlassClasses('medium')} border-2 border-white/80 ${getRadiusClass('element')} focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 outline-none ${TRANSITIONS.fast} text-sm text-gray-900 placeholder:text-gray-500`}
              />

              {/* Results */}
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {selectedLinkType === 'note' && filteredNotes.length > 0 && (
                  <>
                    {filteredNotes.map(note => (
                      <button
                        key={note.id}
                        onClick={() => handleLinkItem(note.id, 'note')}
                        className={`w-full text-left px-3 py-2 ${getGlassClasses('medium')} hover:bg-white/80 border-2 border-white/60 hover:border-cyan-300 ${getRadiusClass('element')} ${TRANSITIONS.standard} group`}
                      >
                        <div className="text-xs font-semibold text-gray-900 mb-0.5 truncate">
                          {note.summary || note.content.substring(0, 50)}
                        </div>
                        <div className="text-[10px] text-gray-600 truncate">
                          {note.content.substring(0, 80)}...
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {selectedLinkType === 'task' && filteredTasks.length > 0 && (
                  <>
                    {filteredTasks.map(task => (
                      <button
                        key={task.id}
                        onClick={() => handleLinkItem(task.id, 'task')}
                        className={`w-full text-left px-3 py-2 ${getGlassClasses('medium')} hover:bg-white/80 border-2 border-white/60 hover:border-cyan-300 ${getRadiusClass('element')} ${TRANSITIONS.standard} group`}
                      >
                        <div className="flex items-center gap-2">
                          <CheckSquare size={12} className={task.done ? 'text-green-600' : 'text-gray-400'} />
                          <div className="text-xs font-semibold text-gray-900 truncate flex-1">
                            {task.title}
                          </div>
                        </div>
                        {task.description && (
                          <div className="text-[10px] text-gray-600 truncate ml-5">
                            {task.description.substring(0, 60)}...
                          </div>
                        )}
                      </button>
                    ))}
                  </>
                )}

                {((selectedLinkType === 'note' && filteredNotes.length === 0) ||
                  (selectedLinkType === 'task' && filteredTasks.length === 0)) && (
                  <div className="text-center py-4 text-xs text-gray-500">
                    No {selectedLinkType === 'note' ? 'notes' : 'tasks'} found
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setShowContextInput(false);
                  setSearchQuery('');
                }}
                className="text-[10px] text-gray-500 hover:text-gray-700 font-medium"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-4 relative">
        {/* Timeline connector line */}
        <div className="absolute left-2.5 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-200 via-blue-200 to-cyan-200 opacity-50" />

        {sortedTimelineItems.map((item, index) => {
          // Context items - user-added notes/links
          if (item.type === 'context') {
            const contextItem = item.data as SessionContextItem;
            return (
              <div
                key={contextItem.id}
                className="flex gap-4 relative animate-in fade-in slide-in-from-top-2 duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Timeline dot for context */}
                <div className="relative flex-shrink-0 animate-in zoom-in duration-500" style={{ animationDelay: `${index * 50 + 100}ms` }}>
                  <div className="w-5 h-5 rounded-full bg-white border-2 border-amber-400 shadow-sm" />
                </div>

                {/* Context Card */}
                <div className={`flex-1 ${getGlassClasses('medium')} ${getRadiusClass('field')} border-l-4 border-l-amber-400 border-t-2 border-r-2 border-b-2 border-t-gray-200/50 border-r-gray-200/50 border-b-gray-200/50 p-4 hover:shadow-md ${TRANSITIONS.standard}`}>
                  <div className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                    <Edit3 size={12} />
                    User Context
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-2 break-words">
                    {contextItem.content}
                  </p>
                  {contextItem.linkedItemId && (
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <LinkIcon size={10} />
                      Linked to {contextItem.type === 'note' ? 'note' : 'task'}
                    </div>
                  )}
                  <div className="text-[10px] text-gray-400 mt-2">
                    {new Date(contextItem.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {Math.floor((new Date(contextItem.timestamp).getTime() - new Date(session.startTime).getTime()) / 60000)}m
                  </div>
                </div>
              </div>
            );
          }

          // Audio segments render as AudioSegmentCard
          if (item.type === 'audio') {
            const segment = item.data as SessionAudioSegment;
            return (
              <div
                key={segment.id}
                className="flex gap-4 relative animate-in fade-in slide-in-from-top-2 duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Timeline dot for audio */}
                <div className="relative flex-shrink-0 animate-in zoom-in duration-500" style={{ animationDelay: `${index * 50 + 100}ms` }}>
                  <div className="w-5 h-5 rounded-full border-3 border-white shadow-md transition-all duration-300 bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-200" />
                </div>

                {/* Audio Card */}
                <div className="flex-1">
                  <AudioSegmentCard
                    segment={segment}
                    sessionStartTime={session.startTime}
                  />
                </div>
              </div>
            );
          }

          // Screenshots render using unified ScreenshotCard component
          const screenshot = item.data as SessionScreenshot;

          return (
            <div
              key={screenshot.id}
              className="flex gap-4 relative animate-in fade-in slide-in-from-top-2 duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Timeline dot */}
              <div className="relative flex-shrink-0 animate-in zoom-in duration-500 mt-2" style={{ animationDelay: `${index * 50 + 100}ms` }}>
                <div className="w-5 h-5 rounded-full bg-white border-2 border-blue-400 shadow-sm" />
                {screenshot.flagged && (
                  <div className="absolute -top-0.5 -right-0.5">
                    <Flag size={10} className="text-red-400 fill-red-400" />
                  </div>
                )}
              </div>

              {/* Unified Screenshot Card */}
              <div className="flex-1">
                <ScreenshotCard
                  screenshot={screenshot}
                  sessionStartTime={session.startTime}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Screenshot Viewer Modal */}
      {viewerScreenshot && (
        <ScreenshotViewer
          screenshot={viewerScreenshot}
          session={session}
          onClose={handleCloseViewer}
          onNext={handleNextScreenshot}
          onPrev={handlePrevScreenshot}
          onAddComment={onAddComment}
          onToggleFlag={onToggleFlag}
          hasNext={currentViewerIndex < screenshots.length - 1}
          hasPrev={currentViewerIndex > 0}
          originPosition={clickPosition}
        />
      )}
    </div>
  );
}
