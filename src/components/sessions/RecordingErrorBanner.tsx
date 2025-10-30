import React from 'react';
import { AlertCircle, Settings, RotateCcw, X, Camera as CameraIcon, Mic, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import type { RecordingError } from '../../types';
import { getGlassClasses, getRadiusClass } from '../../design-system/theme';
import { formatRecordingError, isPermissionError, getPermissionDisplayName } from '../../types';

interface RecordingErrorBannerProps {
  service: 'screenshots' | 'audio' | 'video';
  error: RecordingError;
  onRetry?: () => void;
  onDismiss: () => void;
  onOpenSettings?: (permission: string) => void;
}

export function RecordingErrorBanner({
  service,
  error,
  onRetry,
  onDismiss,
  onOpenSettings
}: RecordingErrorBannerProps) {
  const serviceLabel = {
    screenshots: 'Screenshots',
    audio: 'Audio Recording',
    video: 'Video Recording'
  }[service];

  const Icon = {
    screenshots: CameraIcon,
    audio: Mic,
    video: Video
  }[service];

  const canOpenSettings = isPermissionError(error) && onOpenSettings;
  const canRetry = error.data && 'canRetry' in error.data ? error.data.canRetry : true;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`
        ${getGlassClasses('medium')}
        ${getRadiusClass('card')}
        border border-red-500/30
        p-4 mb-4
      `}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-red-600 dark:text-red-400">
              {serviceLabel} Failed
            </h4>
            <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
              {formatRecordingError(error)}
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-red-500/10 rounded transition-colors"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4 text-red-600 dark:text-red-400" />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {canOpenSettings && isPermissionError(error) && (
          <button
            onClick={() => onOpenSettings(error.data.permission)}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md
              bg-red-500 hover:bg-red-600 text-white
              transition-colors
              flex items-center gap-1.5
            `}
          >
            <Settings className="w-3.5 h-3.5" />
            Open System Settings
          </button>
        )}
        {canRetry && onRetry && (
          <button
            onClick={onRetry}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md
              border border-red-500/30 hover:bg-red-500/10
              text-red-600 dark:text-red-400
              transition-colors
              flex items-center gap-1.5
            `}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
      </div>
    </motion.div>
  );
}
