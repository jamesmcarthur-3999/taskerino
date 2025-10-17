/**
 * ScreenshotScrubber Component
 *
 * Allows browsing through session screenshots with a scrubber interface.
 * Shows current screenshot large, with a strip of thumbnails below for navigation.
 * Syncs with timeline - clicking a screenshot seeks the review timeline to that moment.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Eye, Flag } from 'lucide-react';
import type { Session, SessionScreenshot } from '../types';
import { attachmentStorage } from '../services/attachmentStorage';
import { ScreenshotViewer } from './ScreenshotViewer';
import { useLazyImage } from '../hooks/useLazyImage';
import { getGlassClasses, RADIUS, TRANSITIONS } from '../design-system/theme';

interface ScreenshotScrubberProps {
  session: Session;
  currentTime: number; // Seconds from session start
  onTimeChange: (time: number) => void;
  sessionDurationSeconds: number;
}

// Lazy-loaded thumbnail component
function ThumbnailImage({
  screenshot,
  isActive,
  screenshotTime,
  onClick,
}: {
  screenshot: SessionScreenshot;
  isActive: boolean;
  screenshotTime: number;
  onClick: () => void;
}) {
  const { src, loading, imgRef } = useLazyImage(screenshot.attachmentId, {
    rootMargin: '100px', // Load slightly before visible
    useThumbnail: true,
  });

  return (
    <button
      onClick={onClick}
      className={`relative flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden transition-all ${
        isActive
          ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-white/40 scale-105'
          : 'opacity-60 hover:opacity-100 hover:scale-105'
      }`}
    >
      <div ref={imgRef as any} className="w-full h-full bg-gray-200 flex items-center justify-center">
        {src ? (
          <img
            src={src}
            alt="Screenshot thumbnail"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-[10px] text-gray-500">
            {Math.floor(screenshotTime / 60)}:{String(Math.floor(screenshotTime % 60)).padStart(2, '0')}
          </div>
        )}
      </div>

      {screenshot.flagged && (
        <div className="absolute top-1 right-1">
          <Flag size={8} className="text-amber-400 fill-amber-400" />
        </div>
      )}
    </button>
  );
}

export function ScreenshotScrubber({
  session,
  currentTime,
  onTimeChange,
  sessionDurationSeconds,
}: ScreenshotScrubberProps) {
  const screenshots = session.screenshots || [];
  const [viewerScreenshot, setViewerScreenshot] = useState<SessionScreenshot | null>(null);
  const [currentScreenshotImage, setCurrentScreenshotImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Component-level cache for scrubbing
  const imageCache = useRef<Map<string, string>>(new Map());

  // Find screenshot closest to current time
  const sessionStartTime = new Date(session.startTime).getTime();
  const currentScreenshotIndex = screenshots.findIndex((s, i) => {
    const screenshotTime = (new Date(s.timestamp).getTime() - sessionStartTime) / 1000;
    const nextScreenshotTime = i < screenshots.length - 1
      ? (new Date(screenshots[i + 1].timestamp).getTime() - sessionStartTime) / 1000
      : sessionDurationSeconds;

    return currentTime >= screenshotTime && currentTime < nextScreenshotTime;
  });

  const currentScreenshot = currentScreenshotIndex >= 0 ? screenshots[currentScreenshotIndex] : screenshots[0];

  // Load current screenshot with caching
  useEffect(() => {
    if (!currentScreenshot) return;

    // Check cache first
    if (imageCache.current.has(currentScreenshot.attachmentId)) {
      setCurrentScreenshotImage(imageCache.current.get(currentScreenshot.attachmentId)!);
      return;
    }

    // Load from storage
    const loadImage = async () => {
      setLoading(true);
      try {
        const attachment = await attachmentStorage.getAttachment(currentScreenshot.attachmentId);

        if (attachment?.base64) {
          // Cache it
          imageCache.current.set(currentScreenshot.attachmentId, attachment.base64);
          setCurrentScreenshotImage(attachment.base64);
        }
      } catch (error) {
        console.error('Failed to load screenshot:', error);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [currentScreenshot?.id]);

  // Preload adjacent screenshots for smooth scrubbing
  useEffect(() => {
    if (!currentScreenshot) return;

    const currentIndex = screenshots.indexOf(currentScreenshot);
    const preloadIds = [
      screenshots[currentIndex - 1]?.attachmentId,
      screenshots[currentIndex + 1]?.attachmentId,
    ].filter(Boolean);

    preloadIds.forEach(async (id) => {
      if (id && !imageCache.current.has(id)) {
        try {
          const attachment = await attachmentStorage.getAttachment(id);
          if (attachment?.base64) {
            imageCache.current.set(id, attachment.base64);
          }
        } catch (error) {
          // Silent fail for preload
        }
      }
    });
  }, [currentScreenshot, screenshots]);

  const handleScreenshotClick = (screenshot: SessionScreenshot) => {
    const screenshotTime = (new Date(screenshot.timestamp).getTime() - sessionStartTime) / 1000;
    onTimeChange(screenshotTime);
  };

  const handlePrevious = () => {
    if (currentScreenshotIndex > 0) {
      const prevScreenshot = screenshots[currentScreenshotIndex - 1];
      handleScreenshotClick(prevScreenshot);
    }
  };

  const handleNext = () => {
    if (currentScreenshotIndex < screenshots.length - 1) {
      const nextScreenshot = screenshots[currentScreenshotIndex + 1];
      handleScreenshotClick(nextScreenshot);
    }
  };

  if (screenshots.length === 0) {
    return null;
  }

  return (
    <div className={`${getGlassClasses('medium')} rounded-[20px] overflow-hidden`}>
      {/* Main Screenshot Display */}
      <div className="relative bg-gray-900 aspect-video flex items-center justify-center">
        {currentScreenshotImage ? (
          <img
            src={currentScreenshotImage}
            alt="Current screenshot"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-gray-400 text-sm">Loading...</div>
        )}

        {/* Navigation Arrows */}
        {currentScreenshotIndex > 0 && (
          <button
            onClick={handlePrevious}
            className={`absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full ${getGlassClasses('strong')} bg-black/60 hover:bg-black/80 flex items-center justify-center text-white ${TRANSITIONS.standard}`}
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {currentScreenshotIndex < screenshots.length - 1 && (
          <button
            onClick={handleNext}
            className={`absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full ${getGlassClasses('strong')} bg-black/60 hover:bg-black/80 flex items-center justify-center text-white ${TRANSITIONS.standard}`}
          >
            <ChevronRight size={24} />
          </button>
        )}

        {/* Screenshot Info Overlay */}
        <div className={`absolute bottom-4 left-4 right-4 ${getGlassClasses('strong')} bg-black/60 rounded-lg p-3 text-white`}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-semibold">
              {currentScreenshot?.aiAnalysis?.detectedActivity || 'Screenshot'}
            </div>
            <div className="text-xs text-white/80">
              {currentScreenshotIndex + 1} / {screenshots.length}
            </div>
          </div>

          {currentScreenshot?.aiAnalysis?.summary && (
            <p className="text-xs text-white/90 line-clamp-2">
              {currentScreenshot.aiAnalysis.summary}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => setViewerScreenshot(currentScreenshot)}
              className="text-xs text-white/80 hover:text-white flex items-center gap-1"
            >
              <Eye size={12} />
              View Full
            </button>
            {currentScreenshot?.flagged && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <Flag size={12} fill="currentColor" />
                Flagged
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnail Strip with Lazy Loading */}
      <div className={`p-4 ${getGlassClasses('subtle')}`}>
        <div className="flex gap-2 overflow-x-auto">
          {screenshots.map((screenshot, index) => {
            const isActive = index === currentScreenshotIndex;
            const screenshotTime = (new Date(screenshot.timestamp).getTime() - sessionStartTime) / 1000;

            return (
              <ThumbnailImage
                key={screenshot.id}
                screenshot={screenshot}
                isActive={isActive}
                screenshotTime={screenshotTime}
                onClick={() => handleScreenshotClick(screenshot)}
              />
            );
          })}
        </div>
      </div>

      {/* Screenshot Viewer Modal */}
      {viewerScreenshot && (
        <ScreenshotViewer
          screenshot={viewerScreenshot}
          session={session}
          onClose={() => setViewerScreenshot(null)}
          onNext={() => {
            const index = screenshots.findIndex(s => s.id === viewerScreenshot.id);
            if (index < screenshots.length - 1) {
              setViewerScreenshot(screenshots[index + 1]);
            }
          }}
          onPrev={() => {
            const index = screenshots.findIndex(s => s.id === viewerScreenshot.id);
            if (index > 0) {
              setViewerScreenshot(screenshots[index - 1]);
            }
          }}
          hasNext={screenshots.findIndex(s => s.id === viewerScreenshot.id) < screenshots.length - 1}
          hasPrev={screenshots.findIndex(s => s.id === viewerScreenshot.id) > 0}
        />
      )}
    </div>
  );
}
