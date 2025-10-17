/**
 * Video Chapter Navigator Module Component
 *
 * A flexible video chapter navigation module for the Morphing Canvas system.
 * Supports multiple variants: vertical, horizontal, minimal.
 *
 * Features:
 * - Multiple view variants (vertical, horizontal, minimal)
 * - Chapter thumbnails and timestamps
 * - Progress tracking within chapters
 * - Navigation between chapters
 * - Responsive design
 * - Loading, empty, and error states
 * - Smooth animations with Framer Motion
 * - Keyboard navigation support
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Clock,
  ChevronRight,
  ChevronDown,
  PlayCircle,
  CheckCircle2,
  Circle,
  Video,
  Loader2,
  AlertCircle,
  Bookmark,
  List,
} from 'lucide-react';
// Removed unused ModuleProps import
import { Card } from '../../Card';
import { Badge } from '../../Badge';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type VideoChapterNavigatorVariant = 'vertical' | 'horizontal' | 'minimal';

export interface VideoChapter {
  id: string;
  title: string;
  description?: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  duration: number; // in seconds
  thumbnailUrl?: string;
  isWatched?: boolean;
  isActive?: boolean;
  tags?: string[];
  keyPoints?: string[];
  resources?: Array<{
    title: string;
    url: string;
    type: 'link' | 'document' | 'code';
  }>;
}

export interface VideoChapterNavigatorData {
  chapters: VideoChapter[];
  videoTitle?: string;
  videoUrl?: string;
  totalDuration?: number;
  currentTime?: number;
  currentChapter?: string;
}

export interface VideoChapterNavigatorConfig {
  showThumbnails?: boolean;
  showDuration?: boolean;
  showProgress?: boolean;
  autoNavigate?: boolean;
  enableKeyboardNav?: boolean;
  highlightActive?: boolean;
  showKeyPoints?: boolean;
  compactMode?: boolean;
}

export interface VideoChapterNavigatorModuleProps {
  data: VideoChapterNavigatorData;
  variant?: VideoChapterNavigatorVariant;
  config?: VideoChapterNavigatorConfig;
  onChapterClick?: (chapter: VideoChapter) => void;
  onSeek?: (time: number) => void;
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
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2 },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function calculateProgress(chapter: VideoChapter, currentTime?: number): number {
  if (!currentTime) return 0;
  if (currentTime < chapter.startTime) return 0;
  if (currentTime > chapter.endTime) return 100;

  const chapterProgress = ((currentTime - chapter.startTime) / chapter.duration) * 100;
  return Math.max(0, Math.min(100, chapterProgress));
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Chapter Item Component - Full details
 */
function ChapterItem({
  chapter,
  index,
  isActive,
  progress,
  config,
  onClick,
}: {
  chapter: VideoChapter;
  index: number;
  isActive: boolean;
  progress: number;
  config: VideoChapterNavigatorConfig;
  onClick: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div variants={itemVariants}>
      <Card
        variant={isActive ? 'elevated' : 'interactive'}
        hover
        className={`overflow-hidden cursor-pointer transition-all ${
          isActive ? 'ring-2 ring-cyan-500 ring-offset-2' : ''
        }`}
        onClick={onClick}
      >
        <div className="flex gap-3 p-3">
          {/* Thumbnail */}
          {config.showThumbnails && chapter.thumbnailUrl && (
            <div className="relative flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-gray-100">
              <img
                src={chapter.thumbnailUrl}
                alt={chapter.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <div className={`bg-white/90 ${getRadiusClass('pill')} p-2`}>
                  <PlayCircle className="w-6 h-6 text-gray-800" />
                </div>
              </div>
              {/* Duration Badge */}
              {config.showDuration && (
                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                  {formatTime(chapter.duration)}
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                {/* Chapter Number */}
                <div className={`flex-shrink-0 w-6 h-6 ${getRadiusClass('pill')} flex items-center justify-center text-xs font-bold ${
                  chapter.isWatched
                    ? 'bg-green-100 text-green-700'
                    : isActive
                    ? 'bg-cyan-100 text-cyan-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {chapter.isWatched ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-semibold truncate ${
                    isActive ? 'text-cyan-700' : 'text-gray-800'
                  }`}>
                    {chapter.title}
                  </h4>
                  {chapter.description && (
                    <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">
                      {chapter.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Time Badge */}
              {config.showDuration && !chapter.thumbnailUrl && (
                <Badge variant="info" size="sm">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(chapter.duration)}
                </Badge>
              )}
            </div>

            {/* Progress Bar */}
            {config.showProgress && progress > 0 && (
              <div className="mt-2 mb-2">
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}

            {/* Key Points (Expandable) */}
            {config.showKeyPoints && chapter.keyPoints && chapter.keyPoints.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className="flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-700 font-medium"
                >
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                  {chapter.keyPoints.length} Key Points
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <ul className="mt-2 space-y-1">
                        {chapter.keyPoints.map((point, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                            <span className="text-cyan-500 mt-0.5">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Tags */}
            {chapter.tags && chapter.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {chapter.tags.map((tag) => (
                  <Badge key={tag} variant="default" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/**
 * Compact Chapter Item - Minimal version
 */
function CompactChapterItem({
  chapter,
  index,
  isActive,
  progress,
  onClick,
}: {
  chapter: VideoChapter;
  index: number;
  isActive: boolean;
  progress: number;
  onClick: () => void;
}) {
  return (
    <motion.div
      variants={itemVariants}
      className={`flex items-center gap-3 px-3 py-2 ${getRadiusClass('card')} cursor-pointer transition-colors ${
        isActive
          ? 'bg-cyan-50 border border-cyan-200'
          : 'hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      {/* Status Icon */}
      <div className="flex-shrink-0">
        {chapter.isWatched ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : isActive ? (
          <PlayCircle className="w-5 h-5 text-cyan-500" />
        ) : (
          <Circle className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-gray-500 font-medium">Ch {index + 1}</span>
          <h4 className={`text-sm font-medium truncate ${
            isActive ? 'text-cyan-700' : 'text-gray-800'
          }`}>
            {chapter.title}
          </h4>
        </div>
        {progress > 0 && progress < 100 && (
          <div className="mt-1 h-0.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Time */}
      <div className="flex-shrink-0 text-xs text-gray-500 font-medium">
        {formatTime(chapter.duration)}
      </div>
    </motion.div>
  );
}

// ============================================================================
// VARIANT RENDERERS
// ============================================================================

/**
 * Vertical Variant - Vertical list with full details
 */
function VerticalView({
  chapters,
  config,
  currentTime,
  currentChapter,
  onChapterClick,
}: {
  chapters: VideoChapter[];
  config: VideoChapterNavigatorConfig;
  currentTime?: number;
  currentChapter?: string;
  onChapterClick: (chapter: VideoChapter) => void;
}) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      {chapters.map((chapter, index) => {
        const isActive = !!(currentChapter === chapter.id || chapter.isActive);
        const progress = calculateProgress(chapter, currentTime);

        return (
          <ChapterItem
            key={chapter.id}
            chapter={chapter}
            index={index}
            isActive={isActive}
            progress={progress}
            config={config}
            onClick={() => onChapterClick(chapter)}
          />
        );
      })}
    </motion.div>
  );
}

/**
 * Horizontal Variant - Horizontal scrollable list
 */
function HorizontalView({
  chapters,
  config,
  currentTime,
  currentChapter,
  onChapterClick,
}: {
  chapters: VideoChapter[];
  config: VideoChapterNavigatorConfig;
  currentTime?: number;
  currentChapter?: string;
  onChapterClick: (chapter: VideoChapter) => void;
}) {
  return (
    <div className="relative">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {chapters.map((chapter, index) => {
          const isActive = currentChapter === chapter.id || chapter.isActive;
          const progress = calculateProgress(chapter, currentTime);

          return (
            <motion.div
              key={chapter.id}
              variants={itemVariants}
              className="flex-shrink-0 w-72"
            >
              <Card
                variant={isActive ? 'elevated' : 'interactive'}
                hover
                className={`cursor-pointer transition-all ${
                  isActive ? 'ring-2 ring-cyan-500 ring-offset-2' : ''
                }`}
                onClick={() => onChapterClick(chapter)}
              >
                {/* Thumbnail */}
                {config.showThumbnails && chapter.thumbnailUrl && (
                  <div className="relative h-40 bg-gray-100 overflow-hidden">
                    <img
                      src={chapter.thumbnailUrl}
                      alt={chapter.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <div className={`bg-white/90 ${getRadiusClass('pill')} p-3`}>
                        <PlayCircle className="w-8 h-8 text-gray-800" />
                      </div>
                    </div>
                    {/* Duration Badge */}
                    {config.showDuration && (
                      <div className={`absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 ${getRadiusClass('element')}`}>
                        {formatTime(chapter.duration)}
                      </div>
                    )}
                    {/* Chapter Number Badge */}
                    <div className={`absolute top-2 left-2 bg-white/90 text-gray-800 text-xs font-bold px-2 py-1 ${getRadiusClass('element')}`}>
                      {index + 1}
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className={`text-sm font-semibold line-clamp-2 ${
                      isActive ? 'text-cyan-700' : 'text-gray-800'
                    }`}>
                      {chapter.title}
                    </h4>
                    {chapter.isWatched && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>

                  {chapter.description && (
                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                      {chapter.description}
                    </p>
                  )}

                  {/* Progress Bar */}
                  {config.showProgress && progress > 0 && (
                    <div className="mb-2">
                      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {chapter.tags && chapter.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {chapter.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="default" size="sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Minimal Variant - Compact list view
 */
function MinimalView({
  chapters,
  currentTime,
  currentChapter,
  onChapterClick,
}: {
  chapters: VideoChapter[];
  currentTime?: number;
  currentChapter?: string;
  onChapterClick: (chapter: VideoChapter) => void;
}) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-1"
    >
      {chapters.map((chapter, index) => {
        const isActive = !!(currentChapter === chapter.id || chapter.isActive);
        const progress = calculateProgress(chapter, currentTime);

        return (
          <CompactChapterItem
            key={chapter.id}
            chapter={chapter}
            index={index}
            isActive={isActive}
            progress={progress}
            onClick={() => onChapterClick(chapter)}
          />
        );
      })}
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * VideoChapterNavigatorModule - Main component for video chapter navigation
 */
export function VideoChapterNavigatorModule({
  data,
  variant = 'vertical',
  config = {},
  onChapterClick,
  onSeek,
  isLoading = false,
  error = null,
}: VideoChapterNavigatorModuleProps) {
  const handleChapterClick = useCallback(
    (chapter: VideoChapter) => {
      onSeek?.(chapter.startTime);
      onChapterClick?.(chapter);
    },
    [onSeek, onChapterClick]
  );

  // Sort chapters by start time
  const sortedChapters = useMemo(() => {
    return [...data.chapters].sort((a, b) => a.startTime - b.startTime);
  }, [data.chapters]);

  // Calculate total watched progress
  const watchedCount = useMemo(() => {
    return data.chapters.filter((c) => c.isWatched).length;
  }, [data.chapters]);

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
            <p className="font-semibold">Error loading chapters</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  // Empty state
  if (sortedChapters.length === 0) {
    return (
      <Card variant="flat" className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <List className="w-12 h-12 text-gray-300 mb-4" />
          </motion.div>
          <h3 className="text-lg font-semibold text-gray-600 mb-1">
            No chapters available
          </h3>
          <p className="text-sm text-gray-400">
            Video chapters will appear here once added
          </p>
        </div>
      </Card>
    );
  }

  // Render based on variant
  return (
    <div className="space-y-4">
      {/* Header */}
      {data.videoTitle && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {data.videoTitle}
            </h3>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Video className="w-4 h-4" />
                {sortedChapters.length} chapters
              </span>
              {data.totalDuration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTime(data.totalDuration)}
                </span>
              )}
              {watchedCount > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  {watchedCount} watched
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chapters */}
      {variant === 'vertical' && (
        <VerticalView
          chapters={sortedChapters}
          config={config}
          currentTime={data.currentTime}
          currentChapter={data.currentChapter}
          onChapterClick={handleChapterClick}
        />
      )}
      {variant === 'horizontal' && (
        <HorizontalView
          chapters={sortedChapters}
          config={config}
          currentTime={data.currentTime}
          currentChapter={data.currentChapter}
          onChapterClick={handleChapterClick}
        />
      )}
      {variant === 'minimal' && (
        <MinimalView
          chapters={sortedChapters}
          currentTime={data.currentTime}
          currentChapter={data.currentChapter}
          onChapterClick={handleChapterClick}
        />
      )}
    </div>
  );
}

export default VideoChapterNavigatorModule;
