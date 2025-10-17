import React, { type ReactNode } from 'react';
import { RADIUS, getInfoGradient } from '../design-system/theme';

type SkeletonVariant = 'card' | 'list' | 'text' | 'avatar' | 'custom';

interface SkeletonLoaderProps {
  variant: SkeletonVariant;
  count?: number;
  className?: string;
}

export const SkeletonLoader = React.memo(function SkeletonLoader({
  variant,
  count = 1,
  className = '',
}: SkeletonLoaderProps): ReactNode {
  // Base skeleton classes with glass morphism and animation
  const infoGradient = getInfoGradient('light');
  const baseClasses = `${infoGradient.container} animate-pulse`;

  // Card variant - rectangular card placeholder
  if (variant === 'card') {
    return (
      <div className={`${baseClasses} ${RADIUS.card} h-48 w-full`} />
    );
  }

  // List variant - multiple list item rows
  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${RADIUS.field} h-16 w-full`}
          />
        ))}
      </div>
    );
  }

  // Text variant - single or multiple text lines
  if (variant === 'text') {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} rounded-lg h-4 w-full`}
            style={{
              // Vary the width for a more natural text appearance
              width: index === count - 1 && count > 1 ? '75%' : '100%',
            }}
          />
        ))}
      </div>
    );
  }

  // Avatar variant - circular avatar placeholder
  if (variant === 'avatar') {
    return (
      <div className={`${baseClasses} rounded-full h-12 w-12`} />
    );
  }

  // Custom variant - allow custom className
  if (variant === 'custom') {
    return <div className={`${baseClasses} ${className}`} />;
  }

  return null;
});
