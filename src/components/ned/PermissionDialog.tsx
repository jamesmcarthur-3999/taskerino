/**
 * Permission Dialog
 *
 * Modal that appears when Ned tries to use a write tool for the first time.
 * Offers three permission levels: Forever, Session, or Always Ask.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Clock, AlertCircle } from 'lucide-react';
import { getRadiusClass, MODAL_OVERLAY, TRANSITIONS } from '../../design-system/theme';
import { modalBackdropVariants, modalConfirmationVariants } from '../../animations/variants';

interface PermissionDialogProps {
  isOpen: boolean;
  toolName: string;
  toolDescription: string;
  context?: string; // What Ned wants to do (e.g., "Create task: 'Review Q4 earnings'")
  onGrant: (level: 'forever' | 'session' | 'always-ask') => void;
  onDeny: () => void;
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  create_task: 'Create Tasks',
  update_task: 'Update Tasks',
  complete_task: 'Complete Tasks',
  delete_task: 'Delete Tasks',
  create_note: 'Create Notes',
  update_note: 'Update Notes',
  delete_note: 'Delete Notes',
  record_memory: 'Record Memories',
};

export const PermissionDialog: React.FC<PermissionDialogProps> = ({
  isOpen,
  toolName,
  toolDescription,
  context,
  onGrant,
  onDeny,
}) => {
  const displayName = TOOL_DISPLAY_NAMES[toolName] || toolName;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={modalBackdropVariants.critical}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`${MODAL_OVERLAY} z-50`}
            onClick={onDeny}
          />

          {/* Dialog */}
          <motion.div
            variants={modalConfirmationVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              x: '-50%',
            }}
            className="z-50 w-full max-w-md pointer-events-none"
          >
            <div className="pointer-events-auto">
            <div className={`bg-white dark:bg-gray-800 ${getRadiusClass('modal')} shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden`}>
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 bg-white/20 ${getRadiusClass('field')} backdrop-blur-sm`}>
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Permission Request
                    </h2>
                    <p className="text-sm text-white/80 mt-0.5">
                      Ned wants to {displayName.toLowerCase()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Context */}
                {context && (
                  <div className={`bg-gray-50 dark:bg-gray-900/50 ${getRadiusClass('field')} p-4 border border-gray-200 dark:border-gray-700`}>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      What Ned wants to do:
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {context}
                    </p>
                  </div>
                )}

                {/* Description */}
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {toolDescription}
                </div>

                {/* Permission Levels */}
                <div className="space-y-3 pt-2">
                  {/* Forever */}
                  <button
                    onClick={() => onGrant('forever')}
                    className={`w-full flex items-start gap-3 p-4 ${getRadiusClass('field')} border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 ${TRANSITIONS.standard} group`}
                  >
                    <Shield className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div className="text-left flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                        Allow Forever
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Always allow this action without asking
                      </div>
                    </div>
                  </button>

                  {/* Session */}
                  <button
                    onClick={() => onGrant('session')}
                    className={`w-full flex items-start gap-3 p-4 ${getRadiusClass('field')} border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 ${TRANSITIONS.standard} group`}
                  >
                    <Clock className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-left flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        Allow This Session
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Allow until you close the app
                      </div>
                    </div>
                  </button>

                  {/* Always Ask */}
                  <button
                    onClick={() => onGrant('always-ask')}
                    className={`w-full flex items-start gap-3 p-4 ${getRadiusClass('field')} border-2 border-gray-200 dark:border-gray-700 hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 ${TRANSITIONS.standard} group`}
                  >
                    <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="text-left flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-orange-600 dark:group-hover:text-orange-400">
                        Ask Every Time
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Show this dialog for each action
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={onDeny}
                  className={`w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 ${TRANSITIONS.colors}`}
                >
                  Cancel
                </button>
              </div>
            </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
