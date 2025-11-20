/**
 * ChapterGenerator
 *
 * UI for generating AI chapter markers for session videos.
 * Shows proposed chapters and allows editing before saving.
 */

import { useState } from 'react';
import { Sparkles, Check, X, Edit3 } from 'lucide-react';
import type { Session } from '../types';
import { videoChapteringService } from '../services/videoChapteringService';
import type { ChapterProposal } from '../services/videoChapteringService';
import { useUI } from '../context/UIContext';

interface ChapterGeneratorProps {
  session: Session;
  onChaptersSaved: () => void;
}

export function ChapterGenerator({ session, onChaptersSaved }: ChapterGeneratorProps) {
  const { dispatch: uiDispatch } = useUI();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [proposals, setProposals] = useState<ChapterProposal[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const chapters = await videoChapteringService.proposeChapters(session);
      setProposals(chapters);
    } catch (error) {
      console.error('Failed to generate chapters:', error);

      uiDispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: 'Chapter Generation Failed',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
        },
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await videoChapteringService.saveChapters(session.id, proposals);
      setProposals([]); // Clear proposals
      onChaptersSaved(); // This triggers parent reload

      uiDispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'success',
          title: 'Chapters Saved',
          message: `${proposals.length} chapter${proposals.length !== 1 ? 's' : ''} saved successfully`,
        },
      });
    } catch (error) {
      console.error('Failed to save chapters:', error);

      uiDispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: 'Save Failed',
          message: error instanceof Error ? error.message : 'Failed to save chapters',
        },
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white/40 backdrop-blur-xl rounded-[24px] border-2 border-white/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={16} className="text-cyan-500" />
            AI Chapter Markers
          </h4>
          <p className="text-xs text-gray-600 mt-1">
            Automatically detect topic transitions in your session
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-50"
        >
          {isGenerating ? 'Analyzing...' : 'Generate Chapters'}
        </button>
      </div>

      {/* Empty State */}
      {proposals.length === 0 && !isGenerating && (
        <p className="text-xs text-gray-600 mt-2">
          Click "Generate Chapters" to automatically detect topic transitions in your session video.
          You can review and edit the proposals before saving.
        </p>
      )}

      {/* Generating State */}
      {isGenerating && (
        <div className="mt-4 text-center p-4 bg-white/60 rounded-xl">
          <div className="inline-flex items-center gap-2 text-sm text-gray-700">
            <div className="animate-spin h-4 w-4 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
            Analyzing session timeline and video frames...
          </div>
          <p className="text-xs text-gray-500 mt-2">
            This may take a few seconds
          </p>
        </div>
      )}

      {/* Proposed chapters */}
      {proposals.length > 0 && (
        <div className="space-y-3 mt-4">
          {proposals.map((proposal, index) => (
            <div
              key={index}
              className="bg-white/60 rounded-xl border border-gray-200/60 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">
                      {formatTime(proposal.startTime)} - {formatTime(proposal.endTime)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      proposal.confidence >= 0.8
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {Math.round(proposal.confidence * 100)}% confident
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-gray-900 mt-1">
                    {proposal.title}
                  </h5>
                  <p className="text-xs text-gray-600 mt-1">{proposal.summary}</p>
                  {proposal.keyTopics && proposal.keyTopics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {proposal.keyTopics.map(topic => (
                        <span
                          key={topic}
                          className="text-xs px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded-full"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setEditingId(editingId === String(index) ? null : String(index))}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            </div>
          ))}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check size={16} />
              {isSaving ? 'Saving...' : 'Save Chapters'}
            </button>
            <button
              onClick={() => setProposals([])}
              className="px-4 py-2 bg-white/60 text-gray-700 rounded-xl font-semibold text-sm hover:bg-white/80 transition-all flex items-center gap-2"
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
