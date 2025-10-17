import React, { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  type ColorScheme,
  COLOR_SCHEMES,
  TRANSITIONS,
} from '../design-system/theme';

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
type SpinnerVariant = 'default' | 'overlay';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  message?: string;
  variant?: SpinnerVariant;
  colorScheme?: ColorScheme;
}

export const LoadingSpinner = React.memo(function LoadingSpinner({
  size = 'md',
  message,
  variant = 'default',
  colorScheme = 'ocean',
}: LoadingSpinnerProps): ReactNode {
  // Size variants for the spinner icon
  const sizeClasses: Record<SpinnerSize, string> = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  // Get theme color for the spinner
  const getSpinnerColor = (): string => {
    const colorMap = {
      ocean: 'text-cyan-500',
      sunset: 'text-orange-500',
      forest: 'text-emerald-500',
      lavender: 'text-purple-500',
      monochrome: 'text-gray-500',
    };
    return colorMap[colorScheme];
  };

  // Spinner element
  const spinner = (
    <Loader2
      className={`${sizeClasses[size]} ${getSpinnerColor()} animate-spin`}
      strokeWidth={2.5}
    />
  );

  // Default variant - just the spinner
  if (variant === 'default') {
    return (
      <div className="inline-flex items-center justify-center">
        {spinner}
      </div>
    );
  }

  // Overlay variant - full-screen centered with glass background
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-xl">
      <div className={`flex flex-col items-center gap-4 ${TRANSITIONS.fast}`}>
        {spinner}
        {message && (
          <p className="text-base font-medium text-gray-700">
            {message}
          </p>
        )}
      </div>
    </div>
  );
});
