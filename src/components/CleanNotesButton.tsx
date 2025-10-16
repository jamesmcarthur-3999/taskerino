/**
 * Developer utility button to clean HTML tags from notes
 *
 * This can be temporarily added to the UI to run the cleanup script
 * For example, add it to the Settings page or Notes view
 */

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { cleanAllNotesHtml, previewNotesWithHtml } from '../utils/cleanNotesHtml';
import { useUI } from '../context/UIContext';

export function CleanNotesButton() {
  const { addNotification } = useUI();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    totalNotes: number;
    cleanedNotes: number;
    cleanedNoteIds: string[];
  } | null>(null);

  const handlePreview = async () => {
    setIsProcessing(true);
    try {
      const notesWithHtml = await previewNotesWithHtml();

      addNotification({
        type: 'info',
        title: 'Notes with HTML',
        message: `Found ${notesWithHtml.length} notes with HTML tags. Check console for details.`,
      });
    } catch (error) {
      console.error('Failed to preview notes:', error);
      addNotification({
        type: 'error',
        title: 'Preview Failed',
        message: 'Failed to preview notes with HTML',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClean = async () => {
    if (!confirm('Are you sure you want to clean HTML tags from all notes? This action cannot be undone.')) {
      return;
    }

    setIsProcessing(true);
    try {
      const cleanResult = await cleanAllNotesHtml();
      setResult(cleanResult);

      addNotification({
        type: 'success',
        title: 'Notes Cleaned',
        message: `Cleaned ${cleanResult.cleanedNotes} of ${cleanResult.totalNotes} notes`,
      });

      // Reload the page to refresh the notes list
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Failed to clean notes:', error);
      addNotification({
        type: 'error',
        title: 'Cleaning Failed',
        message: 'Failed to clean HTML from notes',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border-2 border-white/60 p-6 shadow-lg">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-orange-100 rounded-full">
          <Trash2 className="w-6 h-6 text-orange-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Clean HTML from Notes</h3>
          <p className="text-sm text-gray-700 mb-4">
            Remove HTML tags from AI-generated notes, preserving only the text content.
            This will clean notes that have unwanted HTML formatting like {`<p class="mb-3">`}.
          </p>

          {result && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ Cleaned {result.cleanedNotes} of {result.totalNotes} notes
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              disabled={isProcessing}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all disabled:opacity-50"
            >
              Preview Affected Notes
            </button>
            <button
              onClick={handleClean}
              disabled={isProcessing}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Clean All Notes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
