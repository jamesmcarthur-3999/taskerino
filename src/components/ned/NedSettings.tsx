/**
 * Ned Settings
 *
 * Settings panel for Ned AI assistant.
 * Includes chattiness, permissions, token usage, etc.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  MessageCircle,
  Shield,
  Eye,
  Activity,
  Trash2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { WRITE_TOOLS } from '../../services/nedTools';
import { getRadiusClass, TRANSITIONS } from '../../design-system/theme';

const TOOL_DESCRIPTIONS: Record<string, string> = {
  create_task: 'Create new tasks',
  update_task: 'Modify existing tasks',
  complete_task: 'Mark tasks as complete',
  delete_task: 'Delete tasks',
  create_note: 'Create new notes',
  update_note: 'Modify existing notes',
  delete_note: 'Delete notes',
  record_memory: 'Save memories about preferences and context',
};

export const NedSettings: React.FC = () => {
  const { state: settingsState, dispatch: settingsDispatch } = useSettings();
  const [showTokens, setShowTokens] = useState(false);

  const { nedSettings } = settingsState;

  const handleChattinessChange = (chattiness: 'concise' | 'balanced' | 'verbose') => {
    settingsDispatch({
      type: 'UPDATE_NED_SETTINGS',
      payload: { chattiness },
    });
  };

  const handleShowThinkingToggle = () => {
    settingsDispatch({
      type: 'UPDATE_NED_SETTINGS',
      payload: { showThinking: !nedSettings.showThinking },
    });
  };

  const handleRevokePermission = (toolName: string) => {
    settingsDispatch({
      type: 'REVOKE_NED_PERMISSION',
      payload: { toolName },
    });
  };

  const handleClearSessionPermissions = () => {
    settingsDispatch({ type: 'CLEAR_SESSION_PERMISSIONS' });
  };

  const allPermissions = [...nedSettings.permissions, ...nedSettings.sessionPermissions];
  const hasSessionPermissions = nedSettings.sessionPermissions.length > 0;

  // Calculate cost estimate (approximate)
  const costPerMToken = 3.00; // Sonnet
  const estimatedCost = (nedSettings.tokenUsage.total / 1_000_000) * costPerMToken;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`p-3 ${getRadiusClass('card')} bg-gradient-to-br from-purple-500 to-pink-500`}>
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Ned Settings
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure your AI assistant
          </p>
        </div>
      </div>

      {/* Chattiness */}
      <div className={`bg-white dark:bg-gray-800 ${getRadiusClass('card')} border border-gray-200 dark:border-gray-700 p-5`}>
        <div className="flex items-start gap-3 mb-4">
          <MessageCircle className="w-5 h-5 text-purple-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              Chattiness Level
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              How verbose should Ned be in responses?
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['concise', 'balanced', 'verbose'] as const).map((level) => (
            <button
              key={level}
              onClick={() => handleChattinessChange(level)}
              className={`px-4 py-2 ${getRadiusClass('field')} text-sm font-medium ${TRANSITIONS.standard} ${
                nedSettings.chattiness === level
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Show Thinking */}
      <div className={`bg-white dark:bg-gray-800 ${getRadiusClass('card')} border border-gray-200 dark:border-gray-700 p-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-purple-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                Show Thinking
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Display Ned's thought process and tool usage
              </p>
            </div>
          </div>
          <button
            onClick={handleShowThinkingToggle}
            className={`relative inline-flex h-6 w-11 items-center ${getRadiusClass('pill')} ${TRANSITIONS.colors} ${
              nedSettings.showThinking ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform ${getRadiusClass('pill')} bg-white ${TRANSITIONS.transform} ${
                nedSettings.showThinking ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Permissions */}
      <div className={`bg-white dark:bg-gray-800 ${getRadiusClass('card')} border border-gray-200 dark:border-gray-700 p-5`}>
        <div className="flex items-start gap-3 mb-4">
          <Shield className="w-5 h-5 text-purple-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              Permissions
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              Manage what Ned can do automatically
            </p>
          </div>
        </div>

        {allPermissions.length === 0 ? (
          <div className={`flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 ${getRadiusClass('field')} p-4`}>
            <Info className="w-4 h-4" />
            <span>No permissions granted yet. Ned will ask when trying to perform actions.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {allPermissions.map((permission) => {
              const isSession = permission.level === 'session';
              const description = TOOL_DESCRIPTIONS[permission.toolName] || permission.toolName;

              return (
                <div
                  key={permission.toolName}
                  className={`flex items-center justify-between p-3 ${getRadiusClass('field')} bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {description}
                      </span>
                      <span className={`text-xs px-2 py-0.5 ${getRadiusClass('pill')} ${
                        permission.level === 'forever'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          : permission.level === 'session'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                      }`}>
                        {permission.level === 'forever' ? 'Always' : permission.level === 'session' ? 'Session' : 'Ask'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Granted {new Date(permission.grantedAt).toLocaleDateString()}
                      {isSession && ' (clears on restart)'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevokePermission(permission.toolName)}
                    className={`p-2 ${getRadiusClass('field')} hover:bg-red-100 dark:hover:bg-red-900/30 ${TRANSITIONS.colors}`}
                    title="Revoke permission"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              );
            })}

            {hasSessionPermissions && (
              <button
                onClick={handleClearSessionPermissions}
                className={`w-full mt-2 px-4 py-2 text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 ${getRadiusClass('field')} ${TRANSITIONS.colors}`}
              >
                Clear All Session Permissions
              </button>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className={`mt-4 p-3 ${getRadiusClass('field')} bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800`}>
          <div className="flex gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Ned will always ask before performing write operations unless you grant permission.
              You can revoke permissions at any time.
            </p>
          </div>
        </div>
      </div>

      {/* Token Usage */}
      <div className={`bg-white dark:bg-gray-800 ${getRadiusClass('card')} border border-gray-200 dark:border-gray-700 p-5`}>
        <div className="flex items-start gap-3 mb-4">
          <Activity className="w-5 h-5 text-purple-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              Token Usage
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              Track your AI usage and costs
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={`p-4 ${getRadiusClass('field')} bg-gray-50 dark:bg-gray-900/50`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Tokens</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {(nedSettings.tokenUsage.total / 1000).toFixed(1)}K
            </p>
          </div>
          <div className={`p-4 ${getRadiusClass('field')} bg-gray-50 dark:bg-gray-900/50`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">This Month</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {(nedSettings.tokenUsage.thisMonth / 1000).toFixed(1)}K
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowTokens(!showTokens)}
          className={`mt-3 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 ${TRANSITIONS.colors}`}
        >
          {showTokens ? 'Hide' : 'Show'} cost estimate
        </button>

        {showTokens && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={`mt-3 p-3 ${getRadiusClass('field')} bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800`}
          >
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Estimated cost: <span className="font-semibold">${estimatedCost.toFixed(1)}</span>
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              Based on Claude Sonnet pricing (~${costPerMToken}/M tokens)
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};
