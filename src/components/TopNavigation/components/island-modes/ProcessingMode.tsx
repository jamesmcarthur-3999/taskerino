/**
 * ProcessingMode Component
 *
 * Processing status view mode for the navigation island
 */

import { motion } from 'framer-motion';
import { X, Loader2, CheckCircle2, Edit3 } from 'lucide-react';
import type { ProcessingModeProps } from '../../types';
import { getRadiusClass } from '../../../../design-system/theme';
import { modeContentVariants, contentSpring } from '../../utils/islandAnimations';
import { useReducedMotion } from '../../../../lib/animations';

export function ProcessingMode({
  processingJobs,
  completedJobs,
  onClose,
  onJobClick,
}: ProcessingModeProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={modeContentVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
      className="px-4 py-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-900 text-sm">Processing Status</h3>
        <button
          onClick={onClose}
          className={`p-1 hover:bg-white/60 ${getRadiusClass('element')} transition-all`}
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {/* Active Processing Jobs */}
        {processingJobs.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-2">
              Processing Now
            </div>
            {processingJobs.map((job) => (
              <div
                key={job.id}
                className={`bg-gradient-to-r from-violet-50/80 to-purple-50/80 border border-violet-200/60 ${getRadiusClass('element')} p-3 mb-2`}
              >
                <div className="flex items-start gap-3">
                  <Loader2 className="w-4 h-4 text-violet-600 animate-spin flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 line-clamp-2">
                      {job.input}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-violet-200/40 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-violet-500 to-purple-500 h-full transition-all duration-500"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-violet-700">
                        {job.progress}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Completed Jobs */}
        {completedJobs.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-cyan-600 uppercase tracking-wide mb-2 mt-3">
              Ready to Review ({completedJobs.length})
            </div>
            {completedJobs.map((job) => (
              <div
                key={job.id}
                className={`bg-cyan-50/80 border border-cyan-200/60 ${getRadiusClass('element')} p-3 mb-2 cursor-pointer hover:bg-cyan-100/80 transition-all`}
                onClick={() => onJobClick(job.id)}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 line-clamp-2">
                      {job.input}
                    </p>
                    <p className="text-xs text-cyan-600 mt-1 font-medium">
                      Click to review
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {processingJobs.length === 0 && completedJobs.length === 0 && (
          <div className="text-center py-8">
            <Edit3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600">No processing activity</p>
            <p className="text-xs text-gray-500 mt-1">Capture notes to get started</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
