/**
 * Audio Review Progress Modal
 *
 * Shows detailed progress during audio review processing.
 * Displays stage-by-stage updates as Ned analyzes the session audio.
 */

import React from 'react';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getModalClasses, getModalHeaderClasses, getGlassClasses, getRadiusClass } from '../design-system/theme';

export interface AudioReviewProgress {
  stage: 'preparing' | 'concatenating' | 'analyzing' | 'complete';
  message: string;
  progress: number; // 0-100
  error?: string;
}

interface AudioReviewProgressModalProps {
  isOpen: boolean;
  progress: AudioReviewProgress;
  duration?: number; // Session duration in seconds
}

export function AudioReviewProgressModal({
  isOpen,
  progress,
  duration,
}: AudioReviewProgressModalProps) {
  const { colorScheme, glassStrength } = useTheme();

  if (!isOpen) return null;

  // Define stages for visual progress
  const stages = [
    {
      id: 'preparing' as const,
      label: 'Preparing audio segments',
      icon: Circle,
    },
    {
      id: 'concatenating' as const,
      label: 'Creating full audio file',
      icon: Circle,
    },
    {
      id: 'analyzing' as const,
      label: 'Analyzing with AI',
      icon: Circle,
    },
    {
      id: 'complete' as const,
      label: 'Review complete',
      icon: CheckCircle,
    },
  ];

  // Determine stage status
  const getStageStatus = (stageId: typeof stages[number]['id']) => {
    const stageOrder = ['preparing', 'concatenating', 'analyzing', 'complete'];
    const currentIndex = stageOrder.indexOf(progress.stage);
    const stageIndex = stageOrder.indexOf(stageId);

    if (stageIndex < currentIndex) return 'complete';
    if (stageIndex === currentIndex) return 'active';
    return 'pending';
  };

  const modalClasses = getModalClasses(colorScheme, glassStrength);

  return (
    <div className={modalClasses.overlay}>
      <div
        className={`${modalClasses.content} max-w-lg w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={getModalHeaderClasses(colorScheme)}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent mb-1">
                Ned is reviewing your work...
              </h2>
              <p className="text-sm text-gray-600">
                {duration ? `Analyzing ${Math.floor(duration / 60)} minutes of session audio` : 'Processing session audio'}
              </p>
            </div>
            <div className="flex-shrink-0 w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Overall Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {progress.message}
              </span>
              <span className="text-sm font-bold text-gray-900">
                {progress.progress}%
              </span>
            </div>
            <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full overflow-hidden shadow-inner border border-gray-200/50">
              <div
                className="h-full rounded-full transition-all duration-500 shadow-sm bg-gradient-to-r from-cyan-500 to-blue-500"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>

          {/* Stage-by-Stage Progress */}
          <div className={`${getGlassClasses('subtle')} ${getRadiusClass('field')} p-4 space-y-3`}>
            {stages.map((stage) => {
              const status = getStageStatus(stage.id);

              return (
                <div
                  key={stage.id}
                  className={`flex items-center gap-3 transition-all duration-300 ${
                    status === 'active' ? 'scale-105' : ''
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      status === 'complete'
                        ? 'bg-green-100 border-2 border-green-300'
                        : status === 'active'
                        ? 'bg-cyan-100 border-2 border-cyan-300'
                        : 'bg-gray-100 border-2 border-gray-200'
                    }`}
                  >
                    {status === 'complete' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : status === 'active' ? (
                      <Loader2 className="w-5 h-5 text-cyan-600 animate-spin" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium transition-colors ${
                      status === 'complete'
                        ? 'text-green-700'
                        : status === 'active'
                        ? 'text-cyan-700 font-semibold'
                        : 'text-gray-500'
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Helpful Note */}
          <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-[16px] p-4 border border-blue-200/50">
            <p className="text-sm text-gray-700 leading-relaxed">
              <span className="font-semibold">What's happening:</span> Ned is using GPT-4o-audio-preview to understand your full session — transcribing speech, detecting emotional shifts, identifying key moments, and analyzing your work patterns.
            </p>
          </div>

          {/* Error Display */}
          {progress.error && (
            <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-[16px] p-4 border border-red-200/50">
              <p className="text-sm text-red-700 font-medium">
                {progress.error}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-white/30 bg-white/40 backdrop-blur-xl rounded-b-[32px]">
          <p className="text-xs text-gray-600 text-center">
            This usually takes 1-2 minutes. You can continue working — we'll notify you when it's done.
          </p>
        </div>
      </div>
    </div>
  );
}
