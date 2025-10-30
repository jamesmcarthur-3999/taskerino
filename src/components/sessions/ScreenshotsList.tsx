import React, { useState, useEffect } from 'react';
import { Camera, Grid, List, Clock } from 'lucide-react';
import type { Session, SessionScreenshot } from '../../types';
import { ScreenshotViewer } from '../ScreenshotViewer';
import { getCAStorage } from '../../services/storage/ContentAddressableStorage';
import { getGlassClasses, getRadiusClass, TRANSITIONS } from '../../design-system/theme';

interface ScreenshotsListProps {
  session: Session;
  onAddComment?: (screenshotId: string, comment: string) => void;
  onToggleFlag?: (screenshotId: string) => void;
}

type ViewMode = 'list' | 'grid';

export function ScreenshotsList({ session, onAddComment, onToggleFlag }: ScreenshotsListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedScreenshot, setSelectedScreenshot] = useState<SessionScreenshot | null>(null);
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());

  const screenshots = session.screenshots || [];
  const sortedScreenshots = [...screenshots].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Load thumbnails
  useEffect(() => {
    async function loadThumbnails() {
      const caStorage = await getCAStorage();
      const newThumbnails = new Map<string, string>();

      for (const screenshot of sortedScreenshots.slice(0, 20)) { // Load first 20
        if (screenshot.hash) {
          try {
            const attachment = await caStorage.loadAttachment(screenshot.hash);
            if (attachment?.base64) {
              const imageUrl = attachment.base64.startsWith('data:')
                ? attachment.base64
                : `data:${attachment.mimeType || 'image/jpeg'};base64,${attachment.base64}`;
              newThumbnails.set(screenshot.id, imageUrl);
            }
          } catch (error) {
            console.error(`Failed to load thumbnail for ${screenshot.id}:`, error);
          }
        }
      }

      setThumbnails(newThumbnails);
    }

    if (sortedScreenshots.length > 0) {
      loadThumbnails();
    }
  }, [session.screenshots]);

  const handleScreenshotClick = (screenshot: SessionScreenshot) => {
    setSelectedScreenshot(screenshot);
  };

  const handleCloseViewer = () => {
    setSelectedScreenshot(null);
  };

  const handleNext = () => {
    if (!selectedScreenshot) return;
    const currentIndex = sortedScreenshots.findIndex(s => s.id === selectedScreenshot.id);
    if (currentIndex < sortedScreenshots.length - 1) {
      setSelectedScreenshot(sortedScreenshots[currentIndex + 1]);
    }
  };

  const handlePrev = () => {
    if (!selectedScreenshot) return;
    const currentIndex = sortedScreenshots.findIndex(s => s.id === selectedScreenshot.id);
    if (currentIndex > 0) {
      setSelectedScreenshot(sortedScreenshots[currentIndex - 1]);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getActivityBadge = (screenshot: SessionScreenshot) => {
    const activity = screenshot.aiAnalysis?.detectedActivity || 'unknown';
    const colors = {
      coding: 'bg-purple-500/20 text-purple-700',
      meeting: 'bg-red-500/20 text-red-700',
      browser: 'bg-blue-500/20 text-blue-700',
      email: 'bg-green-500/20 text-green-700',
      design: 'bg-pink-500/20 text-pink-700',
      terminal: 'bg-gray-500/20 text-gray-700',
      unknown: 'bg-gray-400/20 text-gray-600',
    };

    return (
      <span className={`px-2 py-0.5 ${getRadiusClass('pill')} text-xs font-semibold ${colors[activity as keyof typeof colors] || colors.unknown}`}>
        {activity}
      </span>
    );
  };

  if (screenshots.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <Camera size={48} className="text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No screenshots yet</h3>
        <p className="text-sm text-gray-600">
          Screenshots will appear here as your session progresses
        </p>
      </div>
    );
  }

  const currentIndex = selectedScreenshot
    ? sortedScreenshots.findIndex(s => s.id === selectedScreenshot.id)
    : -1;

  return (
    <div className="h-full flex flex-col">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/20">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-cyan-600" />
          <span className="text-sm font-semibold text-gray-900">
            {screenshots.length} {screenshots.length === 1 ? 'Screenshot' : 'Screenshots'}
          </span>
        </div>

        <div className={`flex items-center gap-1 p-1 ${getGlassClasses('subtle')} ${getRadiusClass('field')}`}>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 ${getRadiusClass('element')} ${TRANSITIONS.standard} ${
              viewMode === 'list'
                ? 'bg-cyan-500/20 text-cyan-700'
                : 'text-gray-600 hover:bg-white/50'
            }`}
            aria-label="List view"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 ${getRadiusClass('element')} ${TRANSITIONS.standard} ${
              viewMode === 'grid'
                ? 'bg-cyan-500/20 text-cyan-700'
                : 'text-gray-600 hover:bg-white/50'
            }`}
            aria-label="Grid view"
          >
            <Grid size={16} />
          </button>
        </div>
      </div>

      {/* Screenshots container */}
      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === 'list' ? (
          <div className="space-y-3">
            {sortedScreenshots.map((screenshot) => (
              <button
                key={screenshot.id}
                onClick={() => handleScreenshotClick(screenshot)}
                className={`w-full flex items-center gap-3 p-3 ${getGlassClasses('medium')} ${getRadiusClass('field')} ${TRANSITIONS.standard} hover:shadow-lg hover:scale-[1.02] text-left`}
              >
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-32 h-20 bg-gray-200 rounded overflow-hidden">
                  {thumbnails.has(screenshot.id) ? (
                    <img
                      src={thumbnails.get(screenshot.id)}
                      alt="Screenshot thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera size={24} className="text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={14} className="text-gray-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-900">
                      {formatTime(screenshot.timestamp)}
                    </span>
                    {getActivityBadge(screenshot)}
                  </div>

                  {screenshot.aiAnalysis?.summary && (
                    <p className="text-xs text-gray-600 truncate">
                      {screenshot.aiAnalysis.summary}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sortedScreenshots.map((screenshot) => (
              <button
                key={screenshot.id}
                onClick={() => handleScreenshotClick(screenshot)}
                className={`flex flex-col gap-2 p-3 ${getGlassClasses('medium')} ${getRadiusClass('field')} ${TRANSITIONS.standard} hover:shadow-lg hover:scale-[1.02] text-left`}
              >
                {/* Square thumbnail */}
                <div className="w-full aspect-square bg-gray-200 rounded overflow-hidden">
                  {thumbnails.has(screenshot.id) ? (
                    <img
                      src={thumbnails.get(screenshot.id)}
                      alt="Screenshot thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera size={32} className="text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Clock size={12} className="text-gray-500" />
                    <span className="text-xs font-medium text-gray-900">
                      {formatTime(screenshot.timestamp)}
                    </span>
                  </div>
                  {getActivityBadge(screenshot)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Screenshot Viewer Modal */}
      {selectedScreenshot && (
        <ScreenshotViewer
          screenshot={selectedScreenshot}
          session={session}
          onClose={handleCloseViewer}
          onNext={currentIndex < sortedScreenshots.length - 1 ? handleNext : undefined}
          onPrev={currentIndex > 0 ? handlePrev : undefined}
          hasNext={currentIndex < sortedScreenshots.length - 1}
          hasPrev={currentIndex > 0}
          onAddComment={onAddComment}
          onToggleFlag={onToggleFlag}
          allScreenshots={sortedScreenshots}
          currentIndex={currentIndex}
        />
      )}
    </div>
  );
}
