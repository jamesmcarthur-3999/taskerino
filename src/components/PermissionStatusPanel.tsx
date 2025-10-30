/**
 * PermissionStatusPanel
 *
 * Displays the current permission status for all recording capabilities and provides
 * actionable UI for requesting permissions or opening System Settings.
 *
 * Features:
 * - Visual permission status indicators
 * - Permission request buttons
 * - Deep links to System Settings
 * - Cache invalidation for refreshing permission status
 */

import React, { useEffect } from 'react';
import { useRecording } from '../context/RecordingContext';

interface PermissionItemProps {
  name: string;
  description: string;
  status: boolean | null;
  onRequest?: () => Promise<void>;
  onOpenSettings: () => void;
  systemSettingsPane: 'screenRecording' | 'microphone' | 'camera';
}

function PermissionItem({
  name,
  description,
  status,
  onRequest,
  onOpenSettings,
}: PermissionItemProps) {
  const getStatusIcon = () => {
    if (status === null) return '⚪'; // Not checked yet
    return status ? '✅' : '❌';
  };

  const getStatusText = () => {
    if (status === null) return 'Unknown';
    return status ? 'Granted' : 'Denied';
  };

  const getStatusColor = () => {
    if (status === null) return 'text-gray-500';
    return status ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{getStatusIcon()}</span>
          <h3 className="font-medium text-gray-900 dark:text-white">{name}</h3>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
      <div className="flex gap-2 ml-4">
        {status === false && onRequest && (
          <button
            onClick={onRequest}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Request
          </button>
        )}
        {status === false && (
          <button
            onClick={onOpenSettings}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Open Settings
          </button>
        )}
      </div>
    </div>
  );
}

export function PermissionStatusPanel() {
  const {
    recordingState,
    checkAllPermissions,
    requestMicrophonePermission,
    requestCameraPermission,
    openSystemPreferences,
    invalidatePermissionCache,
  } = useRecording();

  const { permissionStatus } = recordingState;

  // Check permissions on mount
  useEffect(() => {
    checkAllPermissions();
  }, [checkAllPermissions]);

  const handleRefresh = async () => {
    await invalidatePermissionCache();
  };

  const handleRequestMicrophone = async () => {
    await requestMicrophonePermission();
  };

  const handleRequestCamera = async () => {
    await requestCameraPermission();
  };

  const allGranted =
    permissionStatus.screenRecording === true &&
    permissionStatus.microphone === true &&
    permissionStatus.camera === true;

  const anyDenied =
    permissionStatus.screenRecording === false ||
    permissionStatus.microphone === false ||
    permissionStatus.camera === false;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recording Permissions
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {permissionStatus.lastChecked
              ? `Last checked: ${permissionStatus.lastChecked.toLocaleTimeString()}`
              : 'Not yet checked'}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={permissionStatus.isChecking}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {permissionStatus.isChecking ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {/* Status Summary */}
      {allGranted && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="font-medium text-green-900 dark:text-green-100">
                All Permissions Granted
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                You're ready to start recording sessions with full capabilities.
              </p>
            </div>
          </div>
        </div>
      )}

      {anyDenied && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-medium text-yellow-900 dark:text-yellow-100">
                Some Permissions Required
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Grant the required permissions below to enable full recording capabilities.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Permission Items */}
      <div className="space-y-3">
        <PermissionItem
          name="Screen Recording"
          description="Required for capturing screenshots and video during sessions"
          status={permissionStatus.screenRecording}
          onOpenSettings={() => openSystemPreferences('screenRecording')}
          systemSettingsPane="screenRecording"
        />

        <PermissionItem
          name="Microphone"
          description="Required for recording audio during sessions"
          status={permissionStatus.microphone}
          onRequest={handleRequestMicrophone}
          onOpenSettings={() => openSystemPreferences('microphone')}
          systemSettingsPane="microphone"
        />

        <PermissionItem
          name="Camera"
          description="Required for webcam recording during video sessions"
          status={permissionStatus.camera}
          onRequest={handleRequestCamera}
          onOpenSettings={() => openSystemPreferences('camera')}
          systemSettingsPane="camera"
        />
      </div>

      {/* Help Text */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Troubleshooting
        </h4>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• If permissions show as denied, click "Open Settings" to grant access</li>
          <li>• After granting permissions in System Settings, click "Refresh" to update status</li>
          <li>• You may need to restart the app after granting screen recording permission</li>
          <li>• Some permissions may require administrator approval on managed devices</li>
        </ul>
      </div>
    </div>
  );
}
