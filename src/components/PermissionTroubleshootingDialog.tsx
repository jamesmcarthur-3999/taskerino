/**
 * PermissionTroubleshootingDialog
 *
 * A comprehensive troubleshooting dialog that guides users through fixing permission issues.
 * Provides step-by-step instructions, deep links to System Settings, and common solutions.
 */

import React, { useState } from 'react';
import { useRecording } from '../context/RecordingContext';

interface PermissionTroubleshootingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  permissionType?: 'screenRecording' | 'microphone' | 'camera' | 'all';
}

export function PermissionTroubleshootingDialog({
  isOpen,
  onClose,
  permissionType = 'all',
}: PermissionTroubleshootingDialogProps) {
  const { openSystemPreferences, invalidatePermissionCache } = useRecording();
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const getStepsForPermission = (type: 'screenRecording' | 'microphone' | 'camera') => {
    const commonSteps = {
      screenRecording: [
        {
          title: 'Open System Settings',
          description: 'Click the button below to open Privacy & Security settings',
          action: () => openSystemPreferences('screenRecording'),
          actionLabel: 'Open Settings',
        },
        {
          title: 'Locate Taskerino',
          description: 'Find Taskerino in the list of applications under Screen Recording',
        },
        {
          title: 'Enable Permission',
          description: 'Toggle the switch next to Taskerino to enable screen recording',
        },
        {
          title: 'Restart Taskerino',
          description: 'Close and reopen Taskerino for the permission change to take effect',
        },
        {
          title: 'Verify Permission',
          description: 'Come back here and click "Refresh Status" to verify the permission is granted',
          action: () => invalidatePermissionCache(),
          actionLabel: 'Refresh Status',
        },
      ],
      microphone: [
        {
          title: 'Open System Settings',
          description: 'Click the button below to open Privacy & Security settings',
          action: () => openSystemPreferences('microphone'),
          actionLabel: 'Open Settings',
        },
        {
          title: 'Locate Taskerino',
          description: 'Find Taskerino in the list of applications under Microphone',
        },
        {
          title: 'Enable Permission',
          description: 'Toggle the switch next to Taskerino to enable microphone access',
        },
        {
          title: 'Verify Permission',
          description: 'Click "Refresh Status" to verify the permission is granted',
          action: () => invalidatePermissionCache(),
          actionLabel: 'Refresh Status',
        },
      ],
      camera: [
        {
          title: 'Open System Settings',
          description: 'Click the button below to open Privacy & Security settings',
          action: () => openSystemPreferences('camera'),
          actionLabel: 'Open Settings',
        },
        {
          title: 'Locate Taskerino',
          description: 'Find Taskerino in the list of applications under Camera',
        },
        {
          title: 'Enable Permission',
          description: 'Toggle the switch next to Taskerino to enable camera access',
        },
        {
          title: 'Verify Permission',
          description: 'Click "Refresh Status" to verify the permission is granted',
          action: () => invalidatePermissionCache(),
          actionLabel: 'Refresh Status',
        },
      ],
    };

    return commonSteps[type];
  };

  const getPermissionTitle = () => {
    switch (permissionType) {
      case 'screenRecording':
        return 'Fix Screen Recording Permission';
      case 'microphone':
        return 'Fix Microphone Permission';
      case 'camera':
        return 'Fix Camera Permission';
      default:
        return 'Fix Recording Permissions';
    }
  };

  const steps =
    permissionType !== 'all'
      ? getStepsForPermission(permissionType)
      : getStepsForPermission('screenRecording'); // Default to screen recording for "all"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {getPermissionTitle()}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Progress Indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Step {currentStep + 1} of {steps.length}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {Math.round(((currentStep + 1) / steps.length) * 100)}% complete
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Current Step */}
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                {currentStep + 1}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {steps[currentStep].title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {steps[currentStep].description}
                </p>
                {steps[currentStep].action && (
                  <button
                    onClick={steps[currentStep].action}
                    className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                  >
                    {steps[currentStep].actionLabel}
                  </button>
                )}
              </div>
            </div>

            {/* All Steps Preview */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                All Steps:
              </h4>
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      index === currentStep
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : index < currentStep
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-gray-50 dark:bg-gray-900/20'
                    }`}
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center">
                      {index < currentStep ? (
                        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-xs font-medium">{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${index === currentStep ? 'font-medium' : ''}`}>
                        {step.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Common Issues */}
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
              Common Issues
            </h4>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <li>• <strong>Taskerino not in list:</strong> Try starting a recording first to trigger the permission prompt</li>
              <li>• <strong>Toggle is grayed out:</strong> Your device may be managed by an administrator</li>
              <li>• <strong>Permission still denied:</strong> Try quitting Taskerino completely and reopening</li>
              <li>• <strong>macOS Ventura or later:</strong> You may need to unlock System Settings with your password first</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div className="flex gap-2">
            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
