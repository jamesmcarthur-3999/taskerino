/**
 * Artifact Gallery Module Component
 *
 * A flexible screenshot display module for the AI Canvas system.
 * Displays session screenshots with AI-generated analysis and metadata.
 *
 * Features:
 * - Multiple view variants (grid, carousel, lightbox)
 * - AI metadata display (detected activity, summary, key elements)
 * - Image thumbnails with lazy loading
 * - Full-size image viewer with lightbox and AI details
 * - Responsive design
 * - Loading, empty, and error states
 * - Smooth animations with Framer Motion
 * - Keyboard navigation support
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ZoomIn,
  ZoomOut,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Calendar,
  Camera,
  Loader2,
  AlertCircle,
  ImageOff,
  Brain,
  MessageSquare,
  Activity,
  Clock,
} from 'lucide-react';
import { Card } from '../../Card';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';
import { getCAStorage } from '../../../services/storage/ContentAddressableStorage';
import type { SessionScreenshot } from '../../../types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ArtifactGalleryVariant = 'grid' | 'carousel' | 'lightbox';

export interface ArtifactGalleryProps {
  screenshots: SessionScreenshot[];
  variant?: ArtifactGalleryVariant;
  columns?: 2 | 3 | 4;
  onClickScreenshot?: (screenshot: SessionScreenshot) => void;
  theme?: {
    mode: 'light' | 'dark' | 'auto' | 'system';
    primaryColor: string;
  };
}

// ============================================================================
// CONSTANTS & CONFIGS
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTimestamp(timestamp: string, showTime: boolean = true): string {
  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday && showTime) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: showTime ? 'numeric' : undefined,
    minute: showTime ? '2-digit' : undefined,
  });
}

function calculateTimeInSession(timestamp: string, sessionStart: string): string {
  const screenshotTime = new Date(timestamp).getTime();
  const startTime = new Date(sessionStart).getTime();
  const diffMs = screenshotTime - startTime;

  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

async function loadImageFromAttachment(identifier: string): Promise<string | null> {
  try {
    const caStorage = await getCAStorage();
    const attachment = await caStorage.loadAttachment(identifier);
    if (!attachment || !attachment.base64) {
      return null;
    }

    // Create data URL from base64
    const mimeType = attachment.mimeType || 'image/png';
    return `data:${mimeType};base64,${attachment.base64}`;
  } catch (error) {
    console.error('Failed to load image from attachment:', error);
    return null;
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Lightbox Component for Full-Size Image Viewing with AI Details
 */
function Lightbox({
  screenshot,
  sessionStart,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}: {
  screenshot: SessionScreenshot;
  sessionStart?: string;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load image
  useEffect(() => {
    setIsLoading(true);
    loadImageFromAttachment(screenshot.attachmentId).then((url) => {
      setImageUrl(url);
      setIsLoading(false);
    });
  }, [screenshot.attachmentId]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev?.();
      if (e.key === 'ArrowRight' && hasNext) onNext?.();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  const aiAnalysis = screenshot.aiAnalysis;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className={`absolute top-4 right-4 p-2 ${getRadiusClass('pill')} bg-white/10 hover:bg-white/20 transition-colors z-10`}
        aria-label="Close lightbox"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Image Controls */}
      <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          className={`p-2 ${getRadiusClass('pill')} bg-white/10 hover:bg-white/20 transition-colors`}
          aria-label="Zoom out"
        >
          <ZoomOut className="w-5 h-5 text-white" />
        </button>
        <span className="text-white text-sm font-medium px-3">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          className={`p-2 ${getRadiusClass('pill')} bg-white/10 hover:bg-white/20 transition-colors`}
          aria-label="Zoom in"
        >
          <ZoomIn className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Navigation Arrows */}
      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev?.();
          }}
          className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 ${getRadiusClass('pill')} bg-white/10 hover:bg-white/20 transition-colors`}
          aria-label="Previous image"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}

      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext?.();
          }}
          className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 ${getRadiusClass('pill')} bg-white/10 hover:bg-white/20 transition-colors`}
          aria-label="Next image"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Main Content Area */}
      <div className="flex items-start justify-center w-full h-full p-8 gap-6" onClick={(e) => e.stopPropagation()}>
        {/* Image */}
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: zoom }}
          className="flex-1 flex items-center justify-center"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt="Screenshot"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
          ) : (
            <div className="text-white/60 flex flex-col items-center gap-2">
              <ImageOff className="w-12 h-12" />
              <p>Failed to load image</p>
            </div>
          )}
        </motion.div>

        {/* AI Details Sidebar */}
        <div
          className={`w-96 h-full overflow-y-auto ${getGlassClasses('subtle')} ${getRadiusClass('card')} p-6 space-y-4`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Activity Badge */}
          {aiAnalysis?.detectedActivity && (
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <span className="text-white font-semibold text-lg">
                {aiAnalysis.detectedActivity}
              </span>
            </div>
          )}

          {/* Timestamp */}
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Calendar className="w-4 h-4" />
            {formatTimestamp(screenshot.timestamp)}
          </div>

          {/* Time in Session */}
          {sessionStart && (
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Clock className="w-4 h-4" />
              <span>Time in session: {calculateTimeInSession(screenshot.timestamp, sessionStart)}</span>
            </div>
          )}

          {/* AI Summary */}
          {aiAnalysis?.summary && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white/80 font-medium">
                <Brain className="w-4 h-4 text-purple-400" />
                <span>AI Analysis</span>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">
                {aiAnalysis.summary}
              </p>
            </div>
          )}

          {/* Key Elements */}
          {aiAnalysis?.keyElements && aiAnalysis.keyElements.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-white/80 font-medium text-sm">Key Elements</h4>
              <div className="flex flex-wrap gap-2">
                {aiAnalysis.keyElements.map((element, index) => (
                  <span
                    key={index}
                    className={`px-3 py-1 ${getRadiusClass('pill')} bg-white/10 text-white/80 text-xs`}
                  >
                    {element}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Confidence Score */}
          {aiAnalysis?.confidence !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/80">Confidence</span>
                <span className="text-white font-medium">
                  {Math.round(aiAnalysis.confidence * 100)}%
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${aiAnalysis.confidence * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="bg-gradient-to-r from-cyan-400 to-purple-400 h-2 rounded-full"
                />
              </div>
            </div>
          )}

          {/* User Comment */}
          {screenshot.userComment && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2 text-white/80 font-medium">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span>Note</span>
              </div>
              <p className="text-white/70 text-sm leading-relaxed italic">
                "{screenshot.userComment}"
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Screenshot Thumbnail Component with AI Badge
 */
function ScreenshotThumbnail({
  screenshot,
  onClick,
}: {
  screenshot: SessionScreenshot;
  onClick: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load image
  useEffect(() => {
    setIsLoading(true);
    loadImageFromAttachment(screenshot.attachmentId).then((url) => {
      setImageUrl(url);
      setIsLoading(false);
    });
  }, [screenshot.attachmentId]);

  return (
    <motion.div
      variants={itemVariants}
      className="group cursor-pointer"
      onClick={onClick}
    >
      <Card variant="interactive" hover className="overflow-hidden p-0">
        {/* Image Container */}
        <div className="relative aspect-video bg-gray-100 overflow-hidden">
          {isLoading || !isLoaded ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : null}

          {imageUrl && (
            <img
              src={imageUrl}
              alt={screenshot.aiAnalysis?.detectedActivity || 'Screenshot'}
              className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setIsLoaded(true)}
              loading="lazy"
            />
          )}

          {!imageUrl && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <ImageOff className="w-8 h-8" />
            </div>
          )}

          {/* Overlay on Hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0 }}
              whileHover={{ scale: 1 }}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            >
              <div className={`bg-white ${getRadiusClass('pill')} p-3`}>
                <Maximize2 className="w-6 h-6 text-gray-700" />
              </div>
            </motion.div>
          </div>

          {/* Activity Badge */}
          {screenshot.aiAnalysis?.detectedActivity && (
            <div className={`absolute top-2 left-2 bg-cyan-500/90 backdrop-blur-sm text-white text-xs px-2 py-1 ${getRadiusClass('element')} flex items-center gap-1 font-medium`}>
              <Activity className="w-3 h-3" />
              {screenshot.aiAnalysis.detectedActivity}
            </div>
          )}

          {/* Timestamp Badge */}
          <div className={`absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 ${getRadiusClass('element')} flex items-center gap-1`}>
            <Camera className="w-3 h-3" />
            {formatTimestamp(screenshot.timestamp)}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ============================================================================
// VARIANT RENDERERS
// ============================================================================

/**
 * Grid Variant - Grid layout with thumbnails
 */
function GridView({
  screenshots,
  columns,
  onScreenshotClick,
}: {
  screenshots: SessionScreenshot[];
  columns: number;
  onScreenshotClick: (screenshot: SessionScreenshot) => void;
}) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-${columns}`}
    >
      {screenshots.map((screenshot) => (
        <ScreenshotThumbnail
          key={screenshot.id}
          screenshot={screenshot}
          onClick={() => onScreenshotClick(screenshot)}
        />
      ))}
    </motion.div>
  );
}

/**
 * Carousel Variant - Horizontal scrollable carousel
 */
function CarouselView({
  screenshots,
  onScreenshotClick,
}: {
  screenshots: SessionScreenshot[];
  onScreenshotClick: (screenshot: SessionScreenshot) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentScreenshot = screenshots[currentIndex];

  // Load current image
  useEffect(() => {
    setIsLoading(true);
    loadImageFromAttachment(currentScreenshot.attachmentId).then((url) => {
      setImageUrl(url);
      setIsLoading(false);
    });
  }, [currentScreenshot.attachmentId]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? screenshots.length - 1 : prev - 1));
  }, [screenshots.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === screenshots.length - 1 ? 0 : prev + 1));
  }, [screenshots.length]);

  return (
    <div className="relative">
      {/* Main Image */}
      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-gray-400 animate-spin" />
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {imageUrl && (
            <motion.img
              key={currentScreenshot.id}
              src={imageUrl}
              alt={currentScreenshot.aiAnalysis?.detectedActivity || 'Screenshot'}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => onScreenshotClick(currentScreenshot)}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>

        {/* Navigation Arrows */}
        <button
          onClick={handlePrev}
          className={`absolute left-4 top-1/2 -translate-y-1/2 p-2 ${getRadiusClass('pill')} bg-white/80 hover:bg-white transition-colors shadow-lg`}
          aria-label="Previous screenshot"
        >
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <button
          onClick={handleNext}
          className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 ${getRadiusClass('pill')} bg-white/80 hover:bg-white transition-colors shadow-lg`}
          aria-label="Next screenshot"
        >
          <ChevronRight className="w-6 h-6 text-gray-800" />
        </button>

        {/* Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 min-w-0">
              {currentScreenshot.aiAnalysis?.detectedActivity && (
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-white font-semibold text-lg truncate">
                    {currentScreenshot.aiAnalysis.detectedActivity}
                  </h3>
                </div>
              )}
              {currentScreenshot.aiAnalysis?.summary && (
                <p className="text-white/80 text-sm line-clamp-2">
                  {currentScreenshot.aiAnalysis.summary}
                </p>
              )}
            </div>
            <div className="text-white/60 text-sm flex items-center gap-1">
              <Camera className="w-4 h-4" />
              {formatTimestamp(currentScreenshot.timestamp)}
            </div>
          </div>
        </div>

        {/* Counter */}
        <div className={`absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-sm px-3 py-1 ${getRadiusClass('pill')}`}>
          {currentIndex + 1} / {screenshots.length}
        </div>
      </div>

      {/* Thumbnail Strip */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {screenshots.map((screenshot, index) => (
          <ThumbnailPreview
            key={screenshot.id}
            screenshot={screenshot}
            isActive={index === currentIndex}
            onClick={() => setCurrentIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Small thumbnail preview for carousel
 */
function ThumbnailPreview({
  screenshot,
  isActive,
  onClick,
}: {
  screenshot: SessionScreenshot;
  isActive: boolean;
  onClick: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    loadImageFromAttachment(screenshot.attachmentId).then(setImageUrl);
  }, [screenshot.attachmentId]);

  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-24 h-16 ${getRadiusClass('card')} overflow-hidden transition-all ${
        isActive
          ? 'ring-2 ring-cyan-500 ring-offset-2'
          : 'opacity-50 hover:opacity-100'
      }`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Screenshot ${screenshot.id}`}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
        </div>
      )}
    </button>
  );
}

/**
 * Lightbox Variant - Full-screen viewer with navigation
 */
function LightboxView({
  screenshots,
  sessionStart,
}: {
  screenshots: SessionScreenshot[];
  sessionStart?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? screenshots.length - 1 : prev - 1));
  }, [screenshots.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === screenshots.length - 1 ? 0 : prev + 1));
  }, [screenshots.length]);

  return (
    <Lightbox
      screenshot={screenshots[currentIndex]}
      sessionStart={sessionStart}
      onClose={() => {}}
      onNext={handleNext}
      onPrev={handlePrev}
      hasNext={currentIndex < screenshots.length - 1}
      hasPrev={currentIndex > 0}
    />
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ArtifactGalleryModule - Main component for displaying session screenshots
 */
export function ArtifactGalleryModule({
  screenshots,
  variant = 'grid',
  columns = 3,
  onClickScreenshot,
}: ArtifactGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Calculate session start from first screenshot
  const sessionStart = screenshots.length > 0 ? screenshots[0].timestamp : undefined;

  const handleScreenshotClick = useCallback(
    (screenshot: SessionScreenshot) => {
      const index = screenshots.findIndex((s) => s.id === screenshot.id);
      setLightboxIndex(index);
      setLightboxOpen(true);
      onClickScreenshot?.(screenshot);
    },
    [screenshots, onClickScreenshot]
  );

  const handleLightboxClose = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const handleLightboxNext = useCallback(() => {
    setLightboxIndex((prev) =>
      prev === screenshots.length - 1 ? 0 : prev + 1
    );
  }, [screenshots.length]);

  const handleLightboxPrev = useCallback(() => {
    setLightboxIndex((prev) =>
      prev === 0 ? screenshots.length - 1 : prev - 1
    );
  }, [screenshots.length]);

  // Empty state
  if (screenshots.length === 0) {
    return (
      <Card variant="flat" className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <ImageOff className="w-12 h-12 text-gray-300 mb-4" />
          </motion.div>
          <h3 className="text-lg font-semibold text-gray-600 mb-1">
            No screenshots available
          </h3>
          <p className="text-sm text-gray-400">
            Screenshots will appear here once captured
          </p>
        </div>
      </Card>
    );
  }

  // Render based on variant
  return (
    <>
      {variant === 'grid' && (
        <GridView
          screenshots={screenshots}
          columns={columns}
          onScreenshotClick={handleScreenshotClick}
        />
      )}
      {variant === 'carousel' && (
        <CarouselView
          screenshots={screenshots}
          onScreenshotClick={handleScreenshotClick}
        />
      )}
      {variant === 'lightbox' && (
        <LightboxView
          screenshots={screenshots}
          sessionStart={sessionStart}
        />
      )}

      {/* Lightbox Overlay */}
      <AnimatePresence>
        {lightboxOpen && variant !== 'lightbox' && (
          <Lightbox
            screenshot={screenshots[lightboxIndex]}
            sessionStart={sessionStart}
            onClose={handleLightboxClose}
            onNext={handleLightboxNext}
            onPrev={handleLightboxPrev}
            hasNext={lightboxIndex < screenshots.length - 1}
            hasPrev={lightboxIndex > 0}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default ArtifactGalleryModule;
