/**
 * SkeletonImage - Reusable skeleton placeholder for lazy-loaded images
 *
 * Provides a smooth loading experience with:
 * - Animated gradient shimmer effect
 * - Customizable dimensions
 * - Accessibility support (ARIA labels)
 * - Optional icon placeholder
 * - Dark mode support
 *
 * Used by: ScreenshotCard, SessionReview, and other image components
 * Part of: Task 6.4 - Image Lazy Loading (Phase 6 Wave 2)
 */

import React from 'react';
import { Monitor } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SkeletonImageProps {
  /** Width in pixels (default: full width) */
  width?: number | string;
  /** Height in pixels (default: full height) */
  height?: number | string;
  /** Additional CSS classes */
  className?: string;
  /** Show icon placeholder (default: true) */
  showIcon?: boolean;
  /** Icon component to display (default: Monitor) */
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  /** Icon size in pixels (default: 32) */
  iconSize?: number;
  /** ARIA label for accessibility (default: "Loading image") */
  ariaLabel?: string;
  /** Border radius (default: 'rounded-lg') */
  borderRadius?: string;
}

export function SkeletonImage({
  width,
  height,
  className,
  showIcon = true,
  icon: Icon = Monitor,
  iconSize = 32,
  ariaLabel = 'Loading image',
  borderRadius = 'rounded-lg',
}: SkeletonImageProps) {
  const style: React.CSSProperties = {};
  if (width !== undefined) {
    style.width = typeof width === 'number' ? `${width}px` : width;
  }
  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }

  return (
    <div
      className={cn(
        // Base styles
        'relative flex items-center justify-center',
        // Shimmer gradient animation
        'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200',
        'dark:from-gray-700 dark:via-gray-600 dark:to-gray-700',
        // Animation
        'animate-pulse bg-[length:200%_100%]',
        // Border radius
        borderRadius,
        // Overflow
        'overflow-hidden',
        // Custom classes
        className
      )}
      style={style}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Optional icon placeholder */}
      {showIcon && (
        <Icon
          size={iconSize}
          className="text-gray-300 dark:text-gray-500"
          aria-hidden="true"
        />
      )}

      {/* Shimmer animation overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * SkeletonImageGrid - Grid of skeleton image placeholders
 *
 * Useful for gallery views with multiple loading images
 */
interface SkeletonImageGridProps {
  /** Number of skeleton items to show */
  count?: number;
  /** Columns in grid (default: 3) */
  columns?: number;
  /** Width of each item */
  itemWidth?: number | string;
  /** Height of each item */
  itemHeight?: number | string;
  /** Additional CSS classes */
  className?: string;
}

export function SkeletonImageGrid({
  count = 6,
  columns = 3,
  itemWidth = 200,
  itemHeight = 150,
  className,
}: SkeletonImageGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-3',
        columns === 4 && 'grid-cols-4',
        columns === 5 && 'grid-cols-5',
        className
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonImage
          key={index}
          width={itemWidth}
          height={itemHeight}
        />
      ))}
    </div>
  );
}
