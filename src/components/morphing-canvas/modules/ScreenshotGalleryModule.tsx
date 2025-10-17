/**
 * Screenshot Gallery Module Component
 *
 * A flexible screenshot display module for the Morphing Canvas system.
 * Supports multiple variants: grid, carousel, lightbox.
 *
 * Features:
 * - Multiple view variants (grid, carousel, lightbox)
 * - Image thumbnails with lazy loading
 * - Full-size image viewer with lightbox
 * - Responsive design
 * - Loading, empty, and error states
 * - Smooth animations with Framer Motion
 * - Keyboard navigation support
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '../../../lib/animations';
import {
  ZoomIn,
  ZoomOut,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Download,
  Calendar,
  Camera,
  Loader2,
  AlertCircle,
  ImageOff,
  Play,
  Pause,
} from 'lucide-react';
import { Card } from '../../Card';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ScreenshotGalleryVariant = 'grid' | 'carousel' | 'lightbox';

export interface Screenshot {
  id: string;
  url: string;
  thumbnailUrl?: string;
  title?: string;
  description?: string;
  timestamp: string;
  width?: number;
  height?: number;
  fileSize?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ScreenshotGalleryData {
  screenshots: Screenshot[];
  sessionId?: string;
  sessionName?: string;
}

export interface ScreenshotGalleryConfig {
  columns?: 2 | 3 | 4 | 5;
  showTimestamps?: boolean;
  showTitles?: boolean;
  enableDownload?: boolean;
  autoPlayCarousel?: boolean;
  carouselInterval?: number;
  thumbnailQuality?: 'low' | 'medium' | 'high';
  enableZoom?: boolean;
  maxZoom?: number;
}

export interface ScreenshotGalleryModuleProps {
  data: ScreenshotGalleryData;
  variant?: ScreenshotGalleryVariant;
  config?: ScreenshotGalleryConfig;
  onScreenshotClick?: (screenshot: Screenshot) => void;
  onDownload?: (screenshot: Screenshot) => void;
  isLoading?: boolean;
  error?: string | null;
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

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';

  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Lightbox Component for Full-Size Image Viewing
 */
function Lightbox({
  screenshot,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  onDownload,
}: {
  screenshot: Screenshot;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  onDownload?: (screenshot: Screenshot) => void;
}) {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && hasPrev) onPrev?.();
    if (e.key === 'ArrowRight' && hasNext) onNext?.();
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
        {onDownload && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(screenshot);
            }}
            className={`p-2 ${getRadiusClass('pill')} bg-white/10 hover:bg-white/20 transition-colors ml-2`}
            aria-label="Download image"
          >
            <Download className="w-5 h-5 text-white" />
          </button>
        )}
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

      {/* Image */}
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: zoom }}
        className="max-w-7xl max-h-screen p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={screenshot.url}
          alt={screenshot.title || 'Screenshot'}
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        />
      </motion.div>

      {/* Image Info */}
      <div className={`absolute bottom-4 left-4 right-4 ${getGlassClasses('subtle')} ${getRadiusClass('card')} p-4`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {screenshot.title && (
              <h3 className="text-white font-semibold text-lg mb-1 truncate">
                {screenshot.title}
              </h3>
            )}
            {screenshot.description && (
              <p className="text-white/80 text-sm line-clamp-2">
                {screenshot.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 text-white/60 text-xs">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatTimestamp(screenshot.timestamp)}
            </span>
            {screenshot.fileSize && (
              <span>{formatFileSize(screenshot.fileSize)}</span>
            )}
            {screenshot.width && screenshot.height && (
              <span>{screenshot.width} × {screenshot.height}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Screenshot Thumbnail Component
 */
function ScreenshotThumbnail({
  screenshot,
  onClick,
  showTitle,
  showTimestamp,
}: {
  screenshot: Screenshot;
  onClick: () => void;
  showTitle?: boolean;
  showTimestamp?: boolean;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <motion.div
      variants={itemVariants}
      className="group cursor-pointer"
      onClick={onClick}
    >
      <Card variant="interactive" hover className="overflow-hidden p-0">
        {/* Image Container */}
        <div className="relative aspect-video bg-gray-100 overflow-hidden">
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          )}
          <img
            src={screenshot.thumbnailUrl || screenshot.url}
            alt={screenshot.title || 'Screenshot'}
            className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setIsLoaded(true)}
            loading="lazy"
          />

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

          {/* Timestamp Badge */}
          {showTimestamp && (
            <div className={`absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 ${getRadiusClass('element')} flex items-center gap-1`}>
              <Camera className="w-3 h-3" />
              {formatTimestamp(screenshot.timestamp)}
            </div>
          )}
        </div>

        {/* Title */}
        {showTitle && screenshot.title && (
          <div className="p-3">
            <h4 className="text-sm font-medium text-gray-800 truncate">
              {screenshot.title}
            </h4>
            {screenshot.description && (
              <p className="text-xs text-gray-600 line-clamp-1 mt-1">
                {screenshot.description}
              </p>
            )}
          </div>
        )}
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
  config,
  onScreenshotClick,
}: {
  screenshots: Screenshot[];
  config: ScreenshotGalleryConfig;
  onScreenshotClick: (screenshot: Screenshot) => void;
}) {
  const columns = config.columns || 3;

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
          showTitle={config.showTitles}
          showTimestamp={config.showTimestamps}
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
  config,
  onScreenshotClick,
}: {
  screenshots: Screenshot[];
  config: ScreenshotGalleryConfig;
  onScreenshotClick: (screenshot: Screenshot) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? screenshots.length - 1 : prev - 1));
  }, [screenshots.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === screenshots.length - 1 ? 0 : prev + 1));
  }, [screenshots.length]);

  // Auto-play - disabled when reduced motion is preferred or manually paused
  useEffect(() => {
    if (config.autoPlayCarousel && !prefersReducedMotion && !isPaused) {
      const interval = setInterval(handleNext, config.carouselInterval || 3000);
      return () => clearInterval(interval);
    }
  }, [config.autoPlayCarousel, config.carouselInterval, prefersReducedMotion, isPaused, handleNext]);

  const currentScreenshot = screenshots[currentIndex];

  return (
    <div className="relative">
      {/* Main Image */}
      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.img
            key={currentScreenshot.id}
            src={currentScreenshot.url}
            alt={currentScreenshot.title || 'Screenshot'}
            className="w-full h-full object-cover cursor-pointer"
            onClick={() => onScreenshotClick(currentScreenshot)}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3 }}
          />
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
              {currentScreenshot.title && (
                <h3 className="text-white font-semibold text-lg mb-1 truncate">
                  {currentScreenshot.title}
                </h3>
              )}
              {currentScreenshot.description && (
                <p className="text-white/80 text-sm line-clamp-2">
                  {currentScreenshot.description}
                </p>
              )}
            </div>
            <div className="text-white/60 text-sm flex items-center gap-1">
              <Camera className="w-4 h-4" />
              {formatTimestamp(currentScreenshot.timestamp)}
            </div>
          </div>
        </div>

        {/* Counter and Play/Pause */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {config.autoPlayCarousel && !prefersReducedMotion && (
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`p-2 ${getRadiusClass('pill')} bg-black/60 backdrop-blur-sm hover:bg-black/70 transition-colors`}
              aria-label={isPaused ? 'Resume auto-play' : 'Pause auto-play'}
              title={isPaused ? 'Resume auto-play' : 'Pause auto-play'}
            >
              {isPaused ? (
                <Play className="w-4 h-4 text-white" />
              ) : (
                <Pause className="w-4 h-4 text-white" />
              )}
            </button>
          )}
          <div className={`bg-black/60 backdrop-blur-sm text-white text-sm px-3 py-1 ${getRadiusClass('pill')}`}>
            {currentIndex + 1} / {screenshots.length}
          </div>
        </div>
      </div>

      {/* Thumbnail Strip */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {screenshots.map((screenshot, index) => (
          <button
            key={screenshot.id}
            onClick={() => setCurrentIndex(index)}
            className={`flex-shrink-0 w-24 h-16 ${getRadiusClass('card')} overflow-hidden transition-all ${
              index === currentIndex
                ? 'ring-2 ring-cyan-500 ring-offset-2'
                : 'opacity-50 hover:opacity-100'
            }`}
          >
            <img
              src={screenshot.thumbnailUrl || screenshot.url}
              alt={screenshot.title || `Screenshot ${index + 1}`}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Lightbox Variant - Full-screen viewer with navigation
 */
function LightboxView({
  screenshots,
  onDownload,
}: {
  screenshots: Screenshot[];
  config?: ScreenshotGalleryConfig;
  onDownload?: (screenshot: Screenshot) => void;
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
      onClose={() => {}}
      onNext={handleNext}
      onPrev={handlePrev}
      hasNext={currentIndex < screenshots.length - 1}
      hasPrev={currentIndex > 0}
      onDownload={onDownload}
    />
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ScreenshotGalleryModule - Main component for displaying screenshots
 */
export function ScreenshotGalleryModule({
  data,
  variant = 'grid',
  config = {},
  onScreenshotClick,
  onDownload,
  isLoading = false,
  error = null,
}: ScreenshotGalleryModuleProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const handleScreenshotClick = useCallback(
    (screenshot: Screenshot) => {
      const index = data.screenshots.findIndex((s) => s.id === screenshot.id);
      setLightboxIndex(index);
      setLightboxOpen(true);
      onScreenshotClick?.(screenshot);
    },
    [data.screenshots, onScreenshotClick]
  );

  const handleLightboxClose = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const handleLightboxNext = useCallback(() => {
    setLightboxIndex((prev) =>
      prev === data.screenshots.length - 1 ? 0 : prev + 1
    );
  }, [data.screenshots.length]);

  const handleLightboxPrev = useCallback(() => {
    setLightboxIndex((prev) =>
      prev === 0 ? data.screenshots.length - 1 : prev - 1
    );
  }, [data.screenshots.length]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-8 h-8 text-cyan-500" />
        </motion.div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card variant="flat" className="p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="font-semibold">Error loading screenshots</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  // Empty state
  if (data.screenshots.length === 0) {
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
          screenshots={data.screenshots}
          config={config}
          onScreenshotClick={handleScreenshotClick}
        />
      )}
      {variant === 'carousel' && (
        <CarouselView
          screenshots={data.screenshots}
          config={config}
          onScreenshotClick={handleScreenshotClick}
        />
      )}
      {variant === 'lightbox' && (
        <LightboxView
          screenshots={data.screenshots}
          config={config}
          onDownload={onDownload}
        />
      )}

      {/* Lightbox Overlay */}
      <AnimatePresence>
        {lightboxOpen && variant !== 'lightbox' && (
          <Lightbox
            screenshot={data.screenshots[lightboxIndex]}
            onClose={handleLightboxClose}
            onNext={handleLightboxNext}
            onPrev={handleLightboxPrev}
            hasNext={lightboxIndex < data.screenshots.length - 1}
            hasPrev={lightboxIndex > 0}
            onDownload={onDownload}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default ScreenshotGalleryModule;
