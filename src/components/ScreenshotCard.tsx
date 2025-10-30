/**
 * ScreenshotCard Component - Informative Timeline Design
 *
 * Redesigned screenshot card for timeline display with:
 * - Horizontal layout: compact thumbnail (120x90) + rich content area
 * - AI summary displayed prominently (2-3 lines)
 * - Top insight (blocker or achievement) shown when available
 * - Activity type, timestamp, and relative time
 * - Visual hint dots for quick scanning
 * - Click to view full screenshot modal
 * - Glassmorphism with activity-specific colors
 *
 * Focus: Showing context and insights while maintaining scannability.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Code2,
  Palette,
  Mail,
  Globe,
  Video,
  FileText,
  Terminal,
  Monitor,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { GradientIconBadge } from './GradientIconBadge';
import { ScreenshotModal } from './ScreenshotModal';
import type { SessionScreenshot, Attachment } from '../types';
import { getCAStorage } from '../services/storage/ContentAddressableStorage';
import { RADIUS, ACTIVITY_COLORS, TRANSITIONS, ICON_SIZES, getActivityGradient } from '../design-system/theme';

interface ScreenshotCardProps {
  screenshot: SessionScreenshot;
  sessionStartTime: string;
  isActive?: boolean;
  onClick?: () => void;
}

// Activity detection and color mapping
const detectActivity = (screenshot: SessionScreenshot) => {
  const activity = screenshot.aiAnalysis?.detectedActivity?.toLowerCase() || 'unknown';

  if (activity.includes('code') || activity.includes('programming') || activity.includes('development')) {
    return 'code';
  } else if (activity.includes('design') || activity.includes('figma') || activity.includes('sketch')) {
    return 'design';
  } else if (activity.includes('email') || activity.includes('gmail') || activity.includes('outlook')) {
    return 'email';
  } else if (activity.includes('browser') || activity.includes('web') || activity.includes('browsing')) {
    return 'browser';
  } else if (activity.includes('meeting') || activity.includes('zoom') || activity.includes('teams')) {
    return 'meeting';
  } else if (activity.includes('document') || activity.includes('word') || activity.includes('docs')) {
    return 'document';
  } else if (activity.includes('terminal') || activity.includes('command')) {
    return 'terminal';
  }

  return 'unknown';
};

// Activity icon mapping
const getActivityIcon = (activityType: keyof typeof ACTIVITY_COLORS) => {
  const icons = {
    code: Code2,
    design: Palette,
    email: Mail,
    browser: Globe,
    meeting: Video,
    document: FileText,
    terminal: Terminal,
    writing: FileText,
    unknown: Monitor,
  };
  return icons[activityType] || Monitor;
};

// Activity-specific class mappings using design system
const getActivityClasses = (activityType: string) => {
  const activityGradient = getActivityGradient(activityType);
  return {
    border: activityGradient.border,
    overlay: `bg-gradient-to-t ${activityGradient.background}`,
    text: activityGradient.text,
  };
};

export const ScreenshotCard = React.memo(function ScreenshotCard({
  screenshot,
  sessionStartTime,
  isActive = false,
  onClick,
}: ScreenshotCardProps) {
  const [imageError, setImageError] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading (100px before entering viewport)
  useEffect(() => {
    if (!cardRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0,
      }
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Load screenshot attachment only when intersecting (Phase 4: Content-Addressable Storage)
  useEffect(() => {
    if (screenshot.hash && isIntersecting) {
      setLoading(true);
      getCAStorage()
        .then(caStorage => caStorage.loadAttachment(screenshot.hash!))
        .then((att) => {
          setAttachment(att || null);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load screenshot attachment:', err);
          setLoading(false);
          setImageError(true);
        });
    } else if (!screenshot.hash) {
      setLoading(false);
    }
  }, [screenshot.hash, isIntersecting]);

  // Handle image load success
  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  // Handle image load error
  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  // Detect activity type and get colors
  const activityType = detectActivity(screenshot);
  const activityColors = ACTIVITY_COLORS[activityType];
  const ActivityIcon = getActivityIcon(activityType);
  const activityClasses = getActivityClasses(activityType);

  // Calculate timestamp from session start
  const sessionStart = new Date(sessionStartTime).getTime();
  const screenshotTime = new Date(screenshot.timestamp).getTime();
  const relativeTime = Math.floor((screenshotTime - sessionStart) / 1000);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get image URL from attachment (new) or legacy path (fallback)
  const imageUrl = attachment?.base64 || (screenshot.path ? convertFileSrc(screenshot.path) : null);

  // Get summary (keep it short - 1 line max)
  const summary = screenshot.aiAnalysis?.summary;
  const activityName = screenshot.aiAnalysis?.detectedActivity || 'Activity';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowModal(true);
  };

  // Check for insights to show visual hints
  const hasBlocker = (screenshot.aiAnalysis?.progressIndicators?.blockers?.length ?? 0) > 0;
  const hasAchievement = (screenshot.aiAnalysis?.progressIndicators?.achievements?.length ?? 0) > 0;
  const hasInsights = (screenshot.aiAnalysis?.progressIndicators?.insights?.length ?? 0) > 0;

  // Get top insight to display (blocker takes priority)
  const getTopInsight = () => {
    const blockers = screenshot.aiAnalysis?.progressIndicators?.blockers || [];
    const achievements = screenshot.aiAnalysis?.progressIndicators?.achievements || [];

    if (blockers.length > 0) {
      return { type: 'blocker', text: blockers[0] };
    }
    if (achievements.length > 0) {
      return { type: 'achievement', text: achievements[0] };
    }
    return null;
  };

  const topInsight = getTopInsight();

  // Check if AI is currently analyzing
  const isAnalyzing = screenshot.analysisStatus === 'analyzing';

  return (
    <>
      {/* Screenshot Modal */}
      {showModal && imageUrl && (
        <ScreenshotModal
          screenshot={screenshot}
          imageUrl={imageUrl}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Main Card - Horizontal Layout with Rich Content */}
      <div
        ref={cardRef}
        onClick={handleClick}
        className={`
          relative group cursor-pointer
          bg-white/80 backdrop-blur-xl
          border-2 ${activityClasses.border}
          rounded-[24px]
          shadow-md hover:shadow-lg
          ${TRANSITIONS.standard}
          hover:scale-[1.01]
          p-4
          ${isAnalyzing ? 'animate-pulse' : ''}
        `}
      >
        {/* Horizontal Layout: Thumbnail + Content */}
        <div className="flex gap-4">
          {/* Left: Compact Thumbnail */}
          <div className="flex-shrink-0">
            <div
              className={`
                relative w-[120px] h-[90px]
                bg-gray-100 border ${activityClasses.border}
                rounded-lg overflow-hidden
                ${TRANSITIONS.standard}
                group-hover:shadow-md
              `}
            >
              {!isIntersecting || loading ? (
                /* Skeleton placeholder while loading */
                <div
                  className="w-full h-full flex items-center justify-center bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse bg-[length:200%_100%]"
                  aria-label="Loading screenshot"
                  role="img"
                >
                  <Monitor size={32} className="text-gray-300" aria-hidden="true" />
                </div>
              ) : imageUrl && !imageError ? (
                <>
                  {/* Lazy-loaded image with native browser lazy loading */}
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    alt={screenshot.aiAnalysis?.summary || screenshot.aiAnalysis?.detectedActivity || 'Session screenshot'}
                    loading="lazy"
                    decoding="async"
                    className={`
                      w-full h-full object-cover
                      ${TRANSITIONS.standard}
                      group-hover:scale-105
                      ${imageLoaded ? 'opacity-100' : 'opacity-0'}
                    `}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                  />

                  {/* Show skeleton overlay while image decodes */}
                  {!imageLoaded && (
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse bg-[length:200%_100%]"
                      aria-label="Loading screenshot"
                    />
                  )}

                  {/* Activity Icon Badge - Top Left */}
                  {imageLoaded && (
                    <div className="absolute top-1.5 left-1.5">
                      <GradientIconBadge
                        icon={ActivityIcon}
                        iconSize={12}
                        gradientFrom={activityColors.bg}
                        gradientTo={activityColors.bg}
                        iconColor={activityColors.text}
                        size={24}
                      />
                    </div>
                  )}
                </>
              ) : (
                /* Error state - failed to load image */
                <div
                  className="w-full h-full flex flex-col items-center justify-center bg-red-50 text-red-500"
                  role="alert"
                  aria-label="Failed to load screenshot"
                >
                  <Monitor size={24} className="mb-1" aria-hidden="true" />
                  <span className="text-[9px] text-center px-2">Failed to load</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Content Area */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Header: Activity Name + Time + Dots */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold uppercase tracking-wide ${activityClasses.text}`}>
                {activityName}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-xs text-gray-500">
                {new Date(screenshot.timestamp).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </span>

              {/* Visual Hint Dots */}
              {(hasBlocker || hasAchievement || hasInsights) && (
                <div className="ml-auto flex gap-1.5">
                  {hasBlocker && (
                    <div
                      className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"
                      title="Has blocker"
                    />
                  )}
                  {hasAchievement && (
                    <div
                      className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm"
                      title="Has achievement"
                    />
                  )}
                  {hasInsights && !hasBlocker && !hasAchievement && (
                    <div
                      className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-sm"
                      title="Has insights"
                    />
                  )}
                </div>
              )}
            </div>

            {/* AI Analysis Content */}
            {isAnalyzing ? (
              /* Loading State - Beautiful Shimmer Effect */
              <>
                {/* Shimmer for summary */}
                <div className="mb-2 space-y-2">
                  <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded animate-shimmer bg-[length:200%_100%]" />
                  <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded animate-shimmer bg-[length:200%_100%] w-4/5" style={{ animationDelay: '0.1s' }} />
                </div>

                {/* Analyzing indicator */}
                <div className="flex items-center gap-2 text-xs text-blue-600 font-medium mb-2">
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Analyzing screenshot...</span>
                </div>

                {/* Shimmer for insight */}
                <div className="mb-2">
                  <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded animate-shimmer bg-[length:200%_100%] w-3/5" style={{ animationDelay: '0.2s' }} />
                </div>
              </>
            ) : (
              <>
                {/* AI Summary (2-3 lines) */}
                {summary && (
                  <div className="mb-2">
                    <p className="text-sm text-gray-700 leading-snug line-clamp-2">
                      {summary}
                    </p>
                  </div>
                )}

                {/* Top Insight (Blocker or Achievement) */}
                {topInsight && (
                  <div className="mb-2">
                    <div className="flex items-start gap-1.5">
                      {topInsight.type === 'blocker' ? (
                        <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                      )}
                      <p className={`text-xs leading-snug line-clamp-1 ${
                        topInsight.type === 'blocker' ? 'text-red-700' : 'text-green-700'
                      }`}>
                        {topInsight.type === 'blocker' ? 'Blocker: ' : 'Achievement: '}
                        {topInsight.text}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Footer: Relative Time */}
            <div className="mt-auto pt-1">
              <span className="text-[10px] text-gray-400">
                +{formatTime(relativeTime)} from start
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});
