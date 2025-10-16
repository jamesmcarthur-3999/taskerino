import { useEffect, useState } from 'react';
import { useUI } from '../context/UIContext';
import { useTasks } from '../context/TasksContext';
import { useNotes } from '../context/NotesContext';
import { useEntities } from '../context/EntitiesContext';
import { Command } from 'cmdk';
import {
  Search,
  FileText,
  CheckSquare,
  Plus,
  Settings,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Home,
  Tag,
  Clock,
  Pin,
  Zap,
  Camera,
  Activity,
} from 'lucide-react';
import { formatRelativeTime } from '../utils/helpers';
import type { Note, Session } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function CommandPalette({ isOpen, onClose, onOpenSettings }: CommandPaletteProps) {
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { state: tasksState, dispatch: tasksDispatch } = useTasks();
  const { state: notesState } = useNotes();
  const { state: entitiesState } = useEntities();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  const handleNavigate = (tab: 'assistant' | 'capture' | 'notes' | 'tasks') => {
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
    onClose();
  };

  const handleOpenNote = (note: Note) => {
    uiDispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'note', itemId: note.id, label: note.summary } });
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'notes' });
    onClose();
  };

  const handleOpenSession = () => {
    // Navigate to sessions zone
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'sessions' });
    // Note: The SessionsZone component will need to handle opening the detail view
    // For now, we'll just navigate to the sessions page
    onClose();
  };

  const handleToggleTask = (taskId: string) => {
    tasksDispatch({ type: 'TOGGLE_TASK', payload: taskId });
    onClose();
  };

  const handlePinNote = (noteId: string) => {
    if (uiState.pinnedNotes.includes(noteId)) {
      uiDispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'info',
          title: 'Already Pinned',
          message: 'This note is already in your reference panel',
        }
      });
    } else if (uiState.pinnedNotes.length >= 5) {
      uiDispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'warning',
          title: 'Maximum Reached',
          message: 'You can only pin up to 5 notes. Unpin one to add another.',
        }
      });
    } else {
      uiDispatch({ type: 'PIN_NOTE', payload: noteId });
      uiDispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'success',
          title: 'Note Pinned',
          message: 'Note added to reference panel',
        }
      });
    }
    onClose();
  };

  const handleNewNote = () => {
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'notes' });
    onClose();
  };

  const handleQuickTask = () => {
    uiDispatch({ type: 'TOGGLE_QUICK_CAPTURE' });
    onClose();
  };

  // Filter notes and tasks based on search
  const filteredNotes = search
    ? notesState.notes.filter(
        (note) =>
          note.content.toLowerCase().includes(search.toLowerCase()) ||
          note.summary.toLowerCase().includes(search.toLowerCase()) ||
          note.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
      )
    : notesState.notes.slice(0, 5);

  const filteredTasks = search
    ? tasksState.tasks.filter((task) =>
        task.title.toLowerCase().includes(search.toLowerCase())
      )
    : tasksState.tasks.filter((t) => !t.done).slice(0, 5);

  const filteredTopics = search
    ? entitiesState.topics.filter((topic) =>
        topic.name.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  // Filter sessions based on search (same deep search as SessionsZone)
  const filteredSessions: Session[] = search
    ? ([] as Session[]) // TODO: Add sessions data from useSessions() hook
        .filter((session: Session) => session.status === 'completed') // Only show completed sessions
        .filter((s: Session) => {
          const query = search.toLowerCase();
          // Search in basic fields
          const basicMatch =
            s.name.toLowerCase().includes(query) ||
            s.description.toLowerCase().includes(query) ||
            (s.summary?.narrative || '').toLowerCase().includes(query);

          // Search in screenshot analyses
          const screenshotMatch = s.screenshots?.some(
            (screenshot: any) =>
              screenshot.aiAnalysis?.summary?.toLowerCase().includes(query) ||
              screenshot.aiAnalysis?.detectedActivity?.toLowerCase().includes(query) ||
              screenshot.aiAnalysis?.keyElements?.some((element: string) =>
                element.toLowerCase().includes(query)
              )
          );

          // Search in audio transcriptions
          const audioMatch = s.audioSegments?.some((segment: any) =>
            segment.transcription?.toLowerCase().includes(query)
          );

          return basicMatch || screenshotMatch || audioMatch;
        })
        .slice(0, 5)
    : [];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-2xl px-4">
        <Command
          className="bg-white/30 backdrop-blur-2xl rounded-[32px] shadow-2xl border-2 border-white/50 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center border-b-2 border-white/50 px-4 bg-white/30 backdrop-blur-sm">
            <Search className="w-5 h-5 text-gray-400 mr-3" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search notes, tasks, sessions, or run command..."
              className="w-full py-4 bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 text-base"
              autoFocus
            />
            <kbd className="px-2 py-1 bg-white/60 text-gray-600 rounded-lg text-xs font-mono border border-white/60">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-gray-500">
              No results found.
            </Command.Empty>

            {/* Navigation Actions */}
            {!search && (
              <Command.Group heading="Navigate" className="mb-2">
                <Command.Item
                  onSelect={() => handleNavigate('assistant')}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 data-[selected]:bg-gradient-to-r data-[selected]:from-cyan-50 data-[selected]:to-blue-50 transition-all"
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">AI Assistant</div>
                    <div className="text-xs text-gray-500">Ask questions about your notes</div>
                  </div>
                  <ArrowUp className="w-4 h-4 text-gray-400" />
                </Command.Item>

                <Command.Item
                  onSelect={() => handleNavigate('capture')}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 data-[selected]:bg-gradient-to-r data-[selected]:from-cyan-50 data-[selected]:to-blue-50 transition-all"
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
                    <Home className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Capture Zone</div>
                    <div className="text-xs text-gray-500">Create a new note</div>
                  </div>
                  <kbd className="px-2 py-1 bg-white/60 text-gray-600 rounded-lg text-xs font-mono border border-white/60">
                    Home
                  </kbd>
                </Command.Item>

                <Command.Item
                  onSelect={() => handleNavigate('notes')}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 data-[selected]:bg-gradient-to-r data-[selected]:from-cyan-50 data-[selected]:to-blue-50 transition-all"
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Notes</div>
                    <div className="text-xs text-gray-500">Browse all notes</div>
                  </div>
                  <ArrowDown className="w-4 h-4 text-gray-400" />
                </Command.Item>
              </Command.Group>
            )}

            {/* Quick Actions */}
            {!search && (
              <Command.Group heading="Actions" className="mb-2">
                <Command.Item
                  onSelect={handleQuickTask}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 data-[selected]:bg-gradient-to-r data-[selected]:from-cyan-50 data-[selected]:to-blue-50 transition-all"
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Quick Add Task</div>
                    <div className="text-xs text-gray-500">Natural language task creation</div>
                  </div>
                  <kbd className="px-2 py-1 bg-white/60 text-gray-600 rounded-lg text-xs font-mono border border-white/60">
                    ⌘⇧N
                  </kbd>
                </Command.Item>

                <Command.Item
                  onSelect={handleNewNote}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 data-[selected]:bg-gradient-to-r data-[selected]:from-cyan-50 data-[selected]:to-blue-50 transition-all"
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">New Note</div>
                    <div className="text-xs text-gray-500">Create a manual note</div>
                  </div>
                </Command.Item>

                <Command.Item
                  onSelect={() => {
                    onOpenSettings();
                    onClose();
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 data-[selected]:bg-gradient-to-r data-[selected]:from-cyan-50 data-[selected]:to-blue-50 transition-all"
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-white/80 backdrop-blur-sm border border-white/60 rounded-lg">
                    <Settings className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Settings</div>
                    <div className="text-xs text-gray-500">Configure AI and preferences</div>
                  </div>
                  <kbd className="px-2 py-1 bg-white/60 text-gray-600 rounded-lg text-xs font-mono border border-white/60">
                    ⌘,
                  </kbd>
                </Command.Item>
              </Command.Group>
            )}

            {/* Topics */}
            {filteredTopics.length > 0 && (
              <Command.Group heading="Topics" className="mb-2">
                {filteredTopics.slice(0, 5).map((topic) => (
                  <Command.Item
                    key={topic.id}
                    onSelect={() => {
                      uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'notes' });
                      onClose();
                    }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 data-[selected]:bg-gradient-to-r data-[selected]:from-cyan-50 data-[selected]:to-blue-50 transition-all"
                  >
                    <Tag className="w-4 h-4 text-cyan-600" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{topic.name}</div>
                      <div className="text-xs text-gray-500">
                        {topic.noteCount} notes
                      </div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Notes */}
            {filteredNotes.length > 0 && (
              <Command.Group heading="Notes" className="mb-2">
                {filteredNotes.slice(0, 8).map((note) => {
                  const isPinned = uiState.pinnedNotes.includes(note.id);
                  return (
                    <div key={note.id} className="relative group">
                      <Command.Item
                        onSelect={() => handleOpenNote(note)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 data-[selected]:bg-gradient-to-r data-[selected]:from-cyan-50 data-[selected]:to-blue-50 transition-all"
                      >
                        <FileText className="w-4 h-4 text-violet-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate flex items-center gap-2">
                            {note.summary}
                            {isPinned && <Pin className="w-3 h-3 text-cyan-600 fill-cyan-600" />}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatRelativeTime(note.timestamp)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePinNote(note.id);
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100 ${
                            isPinned
                              ? 'bg-cyan-100 text-cyan-700'
                              : 'bg-white/60 text-gray-600 hover:bg-white/80 border border-white/60'
                          }`}
                          title={isPinned ? 'Already pinned' : 'Pin to reference panel'}
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                      </Command.Item>
                    </div>
                  );
                })}
              </Command.Group>
            )}

            {/* Tasks */}
            {filteredTasks.length > 0 && (
              <Command.Group heading="Tasks" className="mb-2">
                {filteredTasks.slice(0, 8).map((task) => (
                  <Command.Item
                    key={task.id}
                    onSelect={() => handleToggleTask(task.id)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 data-[selected]:bg-gradient-to-r data-[selected]:from-cyan-50 data-[selected]:to-blue-50 transition-all"
                  >
                    <CheckSquare
                      className={`w-4 h-4 flex-shrink-0 ${
                        task.done ? 'text-green-600' : 'text-gray-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-medium truncate ${
                          task.done ? 'text-gray-500 line-through' : 'text-gray-900'
                        }`}
                      >
                        {task.title}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                            task.priority === 'urgent'
                              ? 'bg-red-100 text-red-700'
                              : task.priority === 'high'
                              ? 'bg-orange-100 text-orange-700'
                              : task.priority === 'medium'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {task.priority}
                        </span>
                        {task.dueDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Sessions */}
            {filteredSessions.length > 0 && (
              <Command.Group heading="Sessions" className="mb-2">
                {filteredSessions.map((session) => {
                  const duration = session.totalDuration || 0;
                  const hours = Math.floor(duration / 60);
                  const mins = duration % 60;
                  const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

                  return (
                    <Command.Item
                      key={session.id}
                      onSelect={() => handleOpenSession()}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 data-[selected]:bg-gradient-to-r data-[selected]:from-cyan-50 data-[selected]:to-blue-50 transition-all"
                    >
                      <Camera className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {session.name}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(session.startTime).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {durationText}
                          </span>
                          <span>•</span>
                          <span>{session.screenshots?.length || 0} shots</span>
                        </div>
                      </div>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div className="border-t-2 border-white/50 px-4 py-3 bg-white/30 backdrop-blur-sm flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/60 border border-white/60 rounded text-xs">
                  ↑↓
                </kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/60 border border-white/60 rounded text-xs">
                  ↵
                </kbd>
                <span>Select</span>
              </div>
            </div>
            <div>
              Press <kbd className="px-1.5 py-0.5 bg-white/60 border border-white/60 rounded">⌘K</kbd>{' '}
              to open
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
