import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Clock, MessageSquare, Flag } from 'lucide-react';
import type { Session, SessionScreenshot } from '../types';
import { attachmentStorage } from '../services/attachmentStorage';

interface ScreenshotViewerProps {
  screenshot: SessionScreenshot;
  session: Session;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onAddComment?: (screenshotId: string, comment: string) => void;
  onToggleFlag?: (screenshotId: string) => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  originPosition?: { x: number; y: number } | null;
}

export function ScreenshotViewer({
  screenshot,
  session,
  onClose,
  onNext,
  onPrev,
  onAddComment,
  onToggleFlag,
  hasNext = false,
  hasPrev = false,
  originPosition = null,
}: ScreenshotViewerProps) {
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [commentInput, setCommentInput] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);

  // Load screenshot image
  useEffect(() => {
    async function loadImage() {
      setLoading(true);
      setError(null);

      try {
        const attachment = await attachmentStorage.getAttachment(screenshot.attachmentId);

        if (!attachment) {
          throw new Error('Screenshot not found');
        }

        if (attachment.base64) {
          // If base64 doesn't have data URL prefix, add it
          const imageUrl = attachment.base64.startsWith('data:')
            ? attachment.base64
            : `data:${attachment.mimeType || 'image/jpeg'};base64,${attachment.base64}`;

          setImageData(imageUrl);
        } else if (attachment.path) {
          // Handle file path (Tauri)
          setImageData(attachment.path);
        } else {
          throw new Error('No image data available');
        }
      } catch (err) {
        console.error('Failed to load screenshot:', err);
        setError(err instanceof Error ? err.message : 'Failed to load screenshot');
      } finally {
        setLoading(false);
      }
    }

    loadImage();
  }, [screenshot.attachmentId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev && onPrev) {
        onPrev();
      } else if (e.key === 'ArrowRight' && hasNext && onNext) {
        onNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  // Reset zoom and pan when screenshot changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [screenshot.id]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleAddComment = useCallback(() => {
    if (commentInput.trim() && onAddComment) {
      onAddComment(screenshot.id, commentInput.trim());
      setCommentInput('');
      setShowCommentInput(false);
    }
  }, [commentInput, screenshot.id, onAddComment]);

  const timeIntoSession = Math.floor(
    (new Date(screenshot.timestamp).getTime() - new Date(session.startTime).getTime()) / 60000
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center p-6 overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-6">
        <div className="max-w-7xl mx-auto flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">{session.name}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-300">
              <div className="flex items-center gap-2">
                <Clock size={16} />
                {new Date(screenshot.timestamp).toLocaleTimeString()}
              </div>
              <span>•</span>
              <span>{timeIntoSession}min into session</span>
              {screenshot.aiAnalysis?.detectedActivity && (
                <>
                  <span>•</span>
                  <span>{screenshot.aiAnalysis.detectedActivity}</span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Close (ESC)"
          >
            <X size={24} className="text-white" />
          </button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {hasPrev && onPrev && (
        <button
          onClick={onPrev}
          className="absolute left-6 top-1/2 -translate-y-1/2 z-10 p-4 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all hover:scale-110 active:scale-95"
          title="Previous (←)"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {hasNext && onNext && (
        <button
          onClick={onNext}
          className="absolute right-6 top-1/2 -translate-y-1/2 z-10 p-4 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all hover:scale-110 active:scale-95"
          title="Next (→)"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {/* Main Content - Centered Layout */}
      <div className="w-full max-w-7xl h-full flex gap-4">
        {/* Left Side - Screenshot (constrained to viewport) */}
        <div className="flex-1 flex items-center justify-center p-4">
          {loading && (
            <div className="text-white text-center">
              <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4 mx-auto" />
              <p>Loading screenshot...</p>
            </div>
          )}

          {error && (
            <div className="text-center">
              <div className="text-red-400 text-lg mb-2">Failed to load screenshot</div>
              <div className="text-gray-400 text-sm">{error}</div>
            </div>
          )}

          {!loading && !error && imageData && (
            <div
              className="relative flex items-center justify-center"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                maxHeight: 'calc(100vh - 200px)'
              }}
            >
              <img
                src={imageData}
                alt="Screenshot"
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  transformOrigin: 'center',
                  transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                }}
                draggable={false}
              />
            </div>
          )}
        </div>

        {/* Right Side - AI Analysis & Info (scrollable) */}
        <div className="w-[400px] flex-shrink-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {screenshot.aiAnalysis && (
            <div className="bg-white/10 backdrop-blur-md rounded-[20px] p-5 text-white mb-4">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <span className="text-cyan-400">✨</span> AI Analysis
              </h3>

              <div className="mb-4">
                <div className="text-xs font-medium text-gray-400 mb-1">Activity</div>
                <div className="text-sm font-semibold text-white">
                  {screenshot.aiAnalysis.detectedActivity}
                </div>
              </div>

              <div className="mb-4">
                <div className="text-xs font-medium text-gray-400 mb-1">Summary</div>
                <p className="text-sm text-gray-200 leading-relaxed">{screenshot.aiAnalysis.summary}</p>
              </div>

              {screenshot.aiAnalysis.keyElements && screenshot.aiAnalysis.keyElements.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-400 mb-2">Key Elements</div>
                  <div className="flex flex-wrap gap-1.5">
                    {screenshot.aiAnalysis.keyElements.map((element, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-white/20 rounded-lg text-xs"
                      >
                        {element}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {screenshot.aiAnalysis.suggestedActions && screenshot.aiAnalysis.suggestedActions.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-400 mb-2">Suggested Actions</div>
                  <ul className="space-y-1.5">
                    {screenshot.aiAnalysis.suggestedActions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-200">
                        <span className="text-cyan-400 mt-0.5">→</span>
                        <span className="flex-1">{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-400 pt-3 border-t border-white/10">
                <span>Confidence: {Math.round((screenshot.aiAnalysis.confidence || 0) * 100)}%</span>
                {screenshot.flagged && (
                  <span className="flex items-center gap-1 text-red-400">
                    <Flag size={12} className="fill-red-400" />
                    Flagged
                  </span>
                )}
              </div>
            </div>
          )}

          {/* User Comment */}
          {screenshot.userComment && (
            <div className="bg-blue-500/20 backdrop-blur-md rounded-[20px] p-4 border border-blue-400/30 mb-4">
              <div className="flex items-center gap-2 text-blue-300 text-xs font-medium mb-2">
                <MessageSquare size={12} />
                Your Note
              </div>
              <p className="text-sm text-white">{screenshot.userComment}</p>
            </div>
          )}

          {/* Add Comment */}
          {!screenshot.userComment && onAddComment && (
            <div className="mb-4">
              {!showCommentInput ? (
                <button
                  onClick={() => setShowCommentInput(true)}
                  className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-[20px] text-sm text-blue-400 hover:text-blue-300 font-medium transition-all border border-white/10"
                >
                  + Add comment
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleAddComment();
                      if (e.key === 'Escape') {
                        setShowCommentInput(false);
                        setCommentInput('');
                      }
                    }}
                    placeholder="Add your comment..."
                    className="w-full px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddComment}
                      className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setShowCommentInput(false);
                        setCommentInput('');
                      }}
                      className="flex-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Flag Button */}
          {onToggleFlag && (
            <button
              onClick={() => onToggleFlag(screenshot.id)}
              className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-[20px] text-sm text-gray-300 hover:text-red-400 flex items-center justify-center gap-2 transition-all border border-white/10"
            >
              <Flag size={14} className={screenshot.flagged ? 'fill-red-400 text-red-400' : ''} />
              {screenshot.flagged ? 'Unflag' : 'Flag as important'}
            </button>
          )}
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-6 left-6 z-10 flex gap-2 bg-black/60 backdrop-blur-md rounded-[20px] p-2">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          className="p-2 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg transition-all hover:scale-110 active:scale-95"
          title="Zoom out (-)"
        >
          <ZoomOut size={18} />
        </button>
        <div className="text-center text-white text-sm px-3 py-2 min-w-[60px] flex items-center justify-center">
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 3}
          className="p-2 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg transition-all hover:scale-110 active:scale-95"
          title="Zoom in (+)"
        >
          <ZoomIn size={18} />
        </button>
        <div className="w-px bg-white/20 mx-1" />
        <button
          onClick={handleResetZoom}
          className="p-2 hover:bg-white/10 text-white rounded-lg transition-all hover:scale-110 active:scale-95"
          title="Reset zoom (0)"
        >
          <Maximize2 size={18} />
        </button>
      </div>
      </div>
    </div>
  );
}
