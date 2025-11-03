/**
 * ManualRefreshButton
 *
 * Button to trigger manual summary update with loading state.
 * Used in LiveIntelligencePanel and CurrentFocusCard.
 *
 * @example
 * ```tsx
 * <ManualRefreshButton
 *   onRefresh={handleManualRefresh}
 *   isLoading={isRefreshing}
 *   size="md"
 *   variant="default"
 * />
 * ```
 */

import React, { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { getInfoGradient } from '@/design-system/theme';

interface ManualRefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg'; // Default: 'md'
  variant?: 'default' | 'minimal'; // Default: 'default'
}

const sizeMap = {
  sm: 16,
  md: 20,
  lg: 24
};

export const ManualRefreshButton: React.FC<ManualRefreshButtonProps> = ({
  onRefresh,
  isLoading = false,
  disabled = false,
  size = 'md',
  variant = 'default'
}) => {
  const [isLoadingInternal, setIsLoadingInternal] = useState(false);

  const handleRefresh = async () => {
    setIsLoadingInternal(true);
    try {
      await onRefresh();
    } finally {
      // Keep loading state for a brief moment to show feedback
      setTimeout(() => setIsLoadingInternal(false), 300);
    }
  };

  const isActuallyLoading = isLoading || isLoadingInternal;
  const iconSize = sizeMap[size];

  if (variant === 'minimal') {
    return (
      <button
        onClick={handleRefresh}
        disabled={disabled || isActuallyLoading}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Refresh summary"
        aria-label="Refresh summary"
      >
        {isActuallyLoading ? (
          <Loader2 size={iconSize} className="animate-spin text-cyan-600" />
        ) : (
          <RefreshCw size={iconSize} className="text-gray-600" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={disabled || isActuallyLoading}
      className={`flex items-center gap-2 px-4 py-2 ${
        getInfoGradient('strong').container
      } text-white rounded-lg font-medium hover:opacity-90 transition-all ${
        size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title="Refresh summary"
      aria-label="Refresh summary"
    >
      {isActuallyLoading ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : (
        <RefreshCw size={iconSize} />
      )}
      <span>Refresh</span>
    </button>
  );
};
