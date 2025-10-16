import { useState } from 'react';
import type { AIProcessResult, Task } from '../types';
import { generateId, formatNoteContent } from '../utils/helpers';
import { RichTextEditor } from './RichTextEditor';
import {
  CheckCircle2,
  Edit2,
  Trash2,
  Calendar,
  FileText,
  Tag,
  X,
  Sparkles,
  Save,
  Building2,
  User,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  Phone,
  Mail,
  Lightbulb,
  Smile,
  Meh,
  Frown,
  List,
  Users,
  Flag,
} from 'lucide-react';

interface ResultsReviewProps {
  results: AIProcessResult;
  onSave: (editedNotes: AIProcessResult['notes'], editedTasks: Task[], removedTaskIndexes: number[]) => void;
  onCancel: () => void;
}

interface EditableTask {
  index: number;
  task: Task;
  isRemoved: boolean;
  isModified: boolean;
}

interface EditableTopic {
  topic: AIProcessResult['detectedTopics'][0];
  isRemoved: boolean;
}

export function ResultsReview({ results, onSave, onCancel }: ResultsReviewProps) {
  const initialTasks: EditableTask[] = results.tasks.map((taskResult, index) => ({
    index,
    task: {
      id: generateId(),
      title: taskResult.title,
      done: false,
      priority: taskResult.priority,
      dueDate: taskResult.dueDate,
      dueTime: taskResult.dueTime,
      dueDateReasoning: taskResult.dueDateReasoning,
      topicId: taskResult.topicId,
      createdAt: new Date().toISOString(),
      status: 'todo',
      description: taskResult.description,
      tags: taskResult.tags,
      subtasks: taskResult.suggestedSubtasks?.map(title => ({
        id: generateId(),
        title,
        done: false,
        createdAt: new Date().toISOString(),
      })),
      createdBy: 'ai' as const,
      sourceExcerpt: taskResult.sourceExcerpt,
      aiContext: {
        sourceNoteId: '',
        extractedFrom: taskResult.description || taskResult.title,
        confidence: 0.85,
        reasoning: taskResult.dueDateReasoning,
      },
    },
    isRemoved: false,
    isModified: false,
  }));

  const initialTopics: EditableTopic[] = results.detectedTopics.map(topic => ({
    topic,
    isRemoved: false,
  }));

  const [editableTasks, setEditableTasks] = useState<EditableTask[]>(initialTasks);
  const [editableNotes, setEditableNotes] = useState(results.notes);
  const [editableTopics, setEditableTopics] = useState<EditableTopic[]>(initialTopics);

  // UI State
  const [topicsExpanded, setTopicsExpanded] = useState(false);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);

  const handleRemoveTask = (index: number) => {
    setEditableTasks(prev => prev.map((et, i) =>
      i === index ? { ...et, isRemoved: true } : et
    ));
  };

  const handleRestoreTask = (index: number) => {
    setEditableTasks(prev => prev.map((et, i) =>
      i === index ? { ...et, isRemoved: false } : et
    ));
  };

  const handleUpdateTask = (index: number, updates: Partial<Task>) => {
    setEditableTasks(prev => prev.map((et, i) =>
      i === index ? { ...et, task: { ...et.task, ...updates }, isModified: true } : et
    ));
  };

  const handleRemoveTopic = (topicName: string) => {
    setEditableTopics(prev => prev.map(et =>
      et.topic.name === topicName ? { ...et, isRemoved: true } : et
    ));
  };

  const handleSaveAll = () => {
    const activeTasks = editableTasks
      .filter(et => !et.isRemoved)
      .map(et => et.task);

    const removedIndexes = editableTasks
      .filter(et => et.isRemoved)
      .map(et => et.index);

    onSave(editableNotes, activeTasks, removedIndexes);
  };

  const activeTasks = editableTasks.filter(et => !et.isRemoved);
  const removedTasks = editableTasks.filter(et => et.isRemoved);
  const activeTopics = editableTopics.filter(et => !et.isRemoved);

  const getTopicIcon = (type: string) => {
    switch (type) {
      case 'company': return <Building2 className="w-4 h-4" />;
      case 'person': return <User className="w-4 h-4" />;
      case 'project': return <FolderOpen className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const totalItems = editableNotes.length + activeTasks.length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-teal-500/20">
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 via-cyan-500/10 to-teal-500/10 animate-gradient-reverse pointer-events-none" />
      {/* Backdrop */}
      <div className="absolute inset-0 backdrop-blur-sm bg-white/30" onClick={onCancel} />

      {/* Modal Container */}
      <div className="relative h-full flex flex-col max-w-7xl mx-auto p-6 pt-24">
        {/* Header */}
        <div className="relative backdrop-blur-2xl bg-white/40 rounded-t-[40px] border-2 border-white/50 shadow-2xl p-6 flex items-center justify-between z-10">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-cyan-600" />
              Review AI Results
            </h1>
            <p className="text-gray-600 mt-1">
              {activeTopics.length} {activeTopics.length === 1 ? 'topic' : 'topics'} • {editableNotes.length} {editableNotes.length === 1 ? 'note' : 'notes'} • {activeTasks.length} {activeTasks.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-600 hover:bg-white/30 backdrop-blur-md rounded-[20px] transition-all duration-300 hover:scale-110 active:scale-95"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Two Column Layout */}
        <div className="relative flex-1 overflow-hidden backdrop-blur-2xl bg-white/40 border-x-2 border-white/50 shadow-2xl flex">

          {/* Left Column: Topics + Note */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Topics Section - Collapsible */}
            <section>
              <button
                onClick={() => setTopicsExpanded(!topicsExpanded)}
                className="w-full flex items-center justify-between p-4 backdrop-blur-xl bg-white/30 border-2 border-white/60 rounded-[24px] hover:bg-white/40 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  {topicsExpanded ? <ChevronDown className="w-5 h-5 text-cyan-600" /> : <ChevronRight className="w-5 h-5 text-cyan-600" />}
                  <Tag className="w-5 h-5 text-cyan-600" />
                  <span className="font-bold text-gray-900">Topics ({activeTopics.length})</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {!topicsExpanded && activeTopics.slice(0, 3).map((et, i) => (
                    <span key={i} className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm flex items-center gap-1.5">
                      {getTopicIcon(et.topic.type)}
                      {et.topic.name}
                    </span>
                  ))}
                  {!topicsExpanded && activeTopics.length > 3 && (
                    <span className="text-sm text-gray-500">+{activeTopics.length - 3} more</span>
                  )}
                </div>
              </button>

              {topicsExpanded && (
                <div className="mt-3 space-y-2">
                  {editableTopics.map((et, index) => {
                    if (et.isRemoved) return null;
                    return (
                      <div
                        key={index}
                        className="backdrop-blur-xl bg-white/30 border-2 border-white/60 rounded-[24px] p-4 flex items-center gap-3 group"
                      >
                        <div className="p-2 bg-cyan-100 rounded-lg text-cyan-600">
                          {getTopicIcon(et.topic.type)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{et.topic.name}</h3>
                          <p className="text-xs text-gray-600 capitalize">{et.topic.type}</p>
                        </div>
                        {et.topic.existingTopicId && (
                          <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                            Existing
                          </span>
                        )}
                        <button
                          onClick={() => handleRemoveTopic(et.topic.name)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95"
                          title="Remove topic"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Notes Section */}
            {editableNotes.map((note, noteIndex) => (
              <NoteSection
                key={noteIndex}
                note={note}
                isEditing={editingNoteIndex === noteIndex}
                onEdit={() => setEditingNoteIndex(noteIndex)}
                onSave={(updatedNote) => {
                  setEditableNotes(prev => prev.map((n, i) => i === noteIndex ? updatedNote : n));
                  setEditingNoteIndex(null);
                }}
                onCancel={() => setEditingNoteIndex(null)}
                getTopicIcon={getTopicIcon}
              />
            ))}
          </div>

          {/* Right Column: Tasks Sidebar */}
          <div className="w-96 border-l-2 border-white/50 bg-white/20 backdrop-blur-sm overflow-y-auto p-6">
            <div className="sticky top-0 bg-white/40 backdrop-blur-xl -mx-6 -mt-6 px-6 pt-6 pb-4 mb-4 border-b-2 border-white/50 z-10">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <h2 className="text-xl font-bold text-gray-900">Tasks</h2>
              </div>
              <p className="text-sm text-gray-600">
                {activeTasks.length} {activeTasks.length === 1 ? 'task' : 'tasks'} from this note
              </p>
            </div>

            {activeTasks.length === 0 ? (
              <div className="backdrop-blur-xl bg-white/30 border-2 border-dashed border-gray-300 rounded-[24px] p-6 text-center">
                <CheckCircle2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-600 font-medium">No tasks extracted</p>
                <p className="text-xs text-gray-500 mt-1">Tasks appear when AI detects action items in your notes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {editableTasks.map((et, index) => {
                  if (et.isRemoved) return null;

                  return editingTaskIndex === index ? (
                    <TaskEditCard
                      key={index}
                      task={et.task}
                      onSave={(updates) => {
                        handleUpdateTask(index, updates);
                        setEditingTaskIndex(null);
                      }}
                      onCancel={() => setEditingTaskIndex(null)}
                    />
                  ) : (
                    <TaskViewCard
                      key={index}
                      task={et.task}
                      isModified={et.isModified}
                      onEdit={() => setEditingTaskIndex(index)}
                      onRemove={() => handleRemoveTask(index)}
                    />
                  );
                })}
              </div>
            )}

            {/* Removed Tasks */}
            {removedTasks.length > 0 && (
              <details className="mt-4 backdrop-blur-xl bg-red-100/20 rounded-[24px] border-2 border-red-200 overflow-hidden">
                <summary className="cursor-pointer p-3 font-semibold text-red-900 hover:bg-red-100/50 transition-all flex items-center gap-2 text-sm">
                  <Trash2 className="w-4 h-4" />
                  {removedTasks.length} Removed
                </summary>
                <div className="p-3 pt-0 space-y-2">
                  {removedTasks.map((et) => (
                    <div key={et.index} className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
                      <p className="text-xs text-gray-700 line-through flex-1">{et.task.title}</p>
                      <button
                        onClick={() => handleRestoreTask(et.index)}
                        className="text-xs px-2 py-1 text-violet-600 hover:bg-violet-100 rounded transition-all font-medium hover:scale-105 active:scale-95"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="relative backdrop-blur-2xl bg-white/40 rounded-b-[40px] border-2 border-white/50 border-t-0 shadow-2xl p-6 flex items-center justify-between z-10">
          <p className="text-sm text-gray-600">
            Review and edit, then save to notes
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-3 text-gray-700 hover:bg-white/30 backdrop-blur-md rounded-[20px] transition-all font-semibold hover:scale-105 active:scale-95 duration-300"
            >
              Discard
            </button>
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-[20px] font-semibold hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg shadow-cyan-200/50"
            >
              <Save className="w-5 h-5" />
              Save Notes ({totalItems})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Note Section Component
function NoteSection({
  note,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  getTopicIcon,
}: {
  note: AIProcessResult['notes'][0];
  isEditing: boolean;
  onEdit: () => void;
  onSave: (note: AIProcessResult['notes'][0]) => void;
  onCancel: () => void;
  getTopicIcon: (type: string) => React.JSX.Element;
}) {
  const [summary, setSummary] = useState(note.summary);
  const [content, setContent] = useState(note.content);
  const [keyPoints, setKeyPoints] = useState(note.keyPoints || []);
  const [tags, setTags] = useState(note.tags || []);
  const [source, setSource] = useState<'call' | 'email' | 'thought' | 'other'>(note.source || 'thought');
  const [sentiment, setSentiment] = useState<'positive' | 'neutral' | 'negative'>(note.sentiment || 'neutral');
  const [relatedTopics, setRelatedTopics] = useState(note.relatedTopics || []);
  const [newKeyPoint, setNewKeyPoint] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newRelatedTopic, setNewRelatedTopic] = useState('');

  const handleSave = () => {
    onSave({
      ...note,
      summary,
      content,
      keyPoints,
      tags,
      source,
      sentiment,
      relatedTopics,
    });
  };

  const addKeyPoint = () => {
    if (newKeyPoint.trim()) {
      setKeyPoints([...keyPoints, newKeyPoint.trim()]);
      setNewKeyPoint('');
    }
  };

  const removeKeyPoint = (index: number) => {
    setKeyPoints(keyPoints.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim().toLowerCase())) {
      setTags([...tags, newTag.trim().toLowerCase()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const addRelatedTopic = () => {
    if (newRelatedTopic.trim() && !relatedTopics.includes(newRelatedTopic.trim())) {
      setRelatedTopics([...relatedTopics, newRelatedTopic.trim()]);
      setNewRelatedTopic('');
    }
  };

  const removeRelatedTopic = (topic: string) => {
    setRelatedTopics(relatedTopics.filter(t => t !== topic));
  };

  if (!isEditing) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-violet-600" />
            <h2 className="text-2xl font-bold text-gray-900">Note: {note.summary}</h2>
          </div>
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-[20px] font-medium hover:bg-violet-700 transition-all hover:scale-105 active:scale-95 duration-300"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>

        <div className="backdrop-blur-xl bg-white/30 border-2 border-white/60 rounded-[24px] p-6 space-y-4">
          {/* Summary */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Summary</label>
            <p className="text-gray-900 font-medium">{note.summary}</p>
          </div>

          {/* Content Preview */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Content</label>
            <div className="prose prose-sm max-w-none bg-gray-50/50 rounded-xl p-4">
              <div dangerouslySetInnerHTML={{ __html: formatNoteContent(note.content) }} />
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            {/* Key Points */}
            {note.keyPoints && note.keyPoints.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <List className="w-4 h-4" />
                  Key Points
                </div>
                <ul className="space-y-1">
                  {note.keyPoints.map((point, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-cyan-600 font-bold">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metadata badges */}
            <div className="space-y-2">
              {note.source && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600">Source:</span>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded-full flex items-center gap-1">
                    {note.source === 'call' && <Phone className="w-3 h-3" />}
                    {note.source === 'email' && <Mail className="w-3 h-3" />}
                    {note.source === 'thought' && <Lightbulb className="w-3 h-3" />}
                    {note.source}
                  </span>
                </div>
              )}
              {note.sentiment && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600">Sentiment:</span>
                  <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                    note.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                    note.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {note.sentiment === 'positive' && <Smile className="w-3 h-3" />}
                    {note.sentiment === 'negative' && <Frown className="w-3 h-3" />}
                    {note.sentiment === 'neutral' && <Meh className="w-3 h-3" />}
                    {note.sentiment}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Tag className="w-4 h-4" />
                Tags
              </div>
              <div className="flex flex-wrap gap-2">
                {note.tags.map((tag, i) => (
                  <span key={i} className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related Topics */}
          {note.relatedTopics && note.relatedTopics.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Users className="w-4 h-4" />
                Related Topics
              </div>
              <div className="flex flex-wrap gap-2">
                {note.relatedTopics.map((topic, i) => (
                  <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Edit Mode
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-violet-600" />
          <h2 className="text-2xl font-bold text-gray-900">Editing Note</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-all hover:scale-105 active:scale-95 duration-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-[20px] font-medium hover:shadow-lg transition-all hover:scale-105 active:scale-95 duration-300"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="backdrop-blur-xl bg-violet-100/20 border-2 border-violet-300 rounded-[24px] p-6 space-y-6">
        {/* Summary */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Summary</label>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full px-4 py-3 bg-white/30 backdrop-blur-sm border-2 border-violet-200 rounded-[20px] focus:border-violet-400 focus:outline-none font-medium transition-all"
            placeholder="Brief summary of the note"
          />
        </div>

        {/* Source and Sentiment */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Source Type</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
              className="w-full px-4 py-2 bg-white/80 border-2 border-violet-200 rounded-xl focus:border-violet-400 focus:outline-none transition-all"
            >
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="thought">Thought</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Sentiment</label>
            <select
              value={sentiment}
              onChange={(e) => setSentiment(e.target.value as typeof sentiment)}
              className="w-full px-4 py-2 bg-white/80 border-2 border-violet-200 rounded-xl focus:border-violet-400 focus:outline-none transition-all"
            >
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
        </div>

        {/* Content Editor */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Content</label>
          <div className="bg-white/30 backdrop-blur-sm border-2 border-violet-200 rounded-[20px] overflow-hidden">
            <RichTextEditor
              content={formatNoteContent(content)}
              onChange={setContent}
              placeholder="Write your note content... Use the toolbar for rich formatting!"
              autoFocus={false}
              minimal={false}
            />
          </div>
        </div>

        {/* Key Points */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <List className="w-4 h-4" />
            Key Points
          </label>
          <div className="space-y-2">
            {keyPoints.map((point, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-white/20 rounded-[16px] group">
                <span className="text-cyan-600 font-bold mt-0.5">•</span>
                <span className="flex-1 text-sm text-gray-700">{point}</span>
                <button
                  onClick={() => removeKeyPoint(i)}
                  className="p-1 text-red-600 hover:bg-red-100 rounded transition-all opacity-0 group-hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyPoint}
                onChange={(e) => setNewKeyPoint(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addKeyPoint()}
                placeholder="Add a key point..."
                className="flex-1 px-3 py-2 bg-white/30 border border-violet-200 rounded-[16px] focus:border-violet-400 focus:outline-none text-sm"
              />
              <button
                onClick={addKeyPoint}
                className="px-4 py-2 bg-violet-600 text-white rounded-[16px] hover:bg-violet-700 transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Tags
          </label>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, i) => (
                <span key={i} className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm flex items-center gap-2 group">
                  #{tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-cyan-900 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 bg-white/30 border border-violet-200 rounded-[16px] focus:border-violet-400 focus:outline-none text-sm"
              />
              <button
                onClick={addTag}
                className="px-4 py-2 bg-cyan-600 text-white rounded-[16px] hover:bg-cyan-700 transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Related Topics */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Related Topics
          </label>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {relatedTopics.map((topic, i) => (
                <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-2 group">
                  {topic}
                  <button
                    onClick={() => removeRelatedTopic(topic)}
                    className="hover:text-gray-900 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newRelatedTopic}
                onChange={(e) => setNewRelatedTopic(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addRelatedTopic()}
                placeholder="Add a related topic..."
                className="flex-1 px-3 py-2 bg-white/30 border border-violet-200 rounded-[16px] focus:border-violet-400 focus:outline-none text-sm"
              />
              <button
                onClick={addRelatedTopic}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Task View Card
function TaskViewCard({
  task,
  isModified,
  onEdit,
  onRemove,
}: {
  task: Task;
  isModified: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
    }
  };

  const getPriorityBadge = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div className="backdrop-blur-xl bg-white/30 border-2 border-white/60 rounded-[24px] p-4 hover:border-green-300 transition-all duration-300 group hover:scale-[1.02] active:scale-[0.98]">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className={`w-1 h-12 rounded-full ${getPriorityColor(task.priority)} flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-1">
              {task.title}
              {isModified && (
                <span className="ml-2 text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">
                  Edited
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityBadge(task.priority)}`}>
                {task.priority}
              </span>
              {task.dueDate && (
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">
                  {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 text-violet-600 hover:bg-violet-100 rounded transition-all hover:scale-110 active:scale-95"
            title="Edit"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-all hover:scale-110 active:scale-95"
            title="Remove"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="space-y-2 ml-3 text-xs">
        {task.description && (
          <p className="text-gray-700 leading-relaxed">{task.description}</p>
        )}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Task Edit Card
function TaskEditCard({
  task,
  onSave,
  onCancel,
}: {
  task: Task;
  onSave: (updates: Partial<Task>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [dueTime, setDueTime] = useState(task.dueTime || '');
  const [description, setDescription] = useState(task.description || '');

  const handleSave = () => {
    onSave({
      title,
      priority,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      description: description || undefined,
    });
  };

  return (
    <div className="backdrop-blur-xl bg-violet-100/20 border-2 border-violet-300 rounded-[24px] p-4 space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-3 py-2 bg-white/30 backdrop-blur-sm border-2 border-violet-200 rounded-[16px] focus:border-violet-400 focus:outline-none font-semibold text-sm transition-all"
        placeholder="Task title"
        autoFocus
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task['priority'])}
            className="w-full px-2 py-1.5 bg-white/30 border-2 border-violet-200 rounded-[16px] focus:border-violet-400 focus:outline-none text-xs transition-all"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-2 py-1.5 bg-white/30 border-2 border-violet-200 rounded-[16px] focus:border-violet-400 focus:outline-none text-xs transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-white/30 border-2 border-violet-200 rounded-[16px] focus:border-violet-400 focus:outline-none text-xs resize-none transition-all"
          placeholder="Add details..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded-lg transition-all font-medium hover:scale-105 active:scale-95"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-xs bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold hover:scale-105 active:scale-95"
        >
          Save
        </button>
      </div>
    </div>
  );
}
