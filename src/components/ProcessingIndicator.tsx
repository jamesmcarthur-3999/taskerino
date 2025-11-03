import { useState, useRef, useEffect } from 'react';
import { useUI } from '../context/UIContext';
import { Loader2, CheckCircle2, XCircle, ChevronDown, Eye, Trash2 } from 'lucide-react';
import { getInfoGradient, getSuccessGradient, getDangerGradient, GLASS_STYLES, Z_INDEX } from '../design-system/theme';

export function ProcessingIndicator() {
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { backgroundProcessing } = uiState;
  const processingJobs = backgroundProcessing.queue.filter(j => j.status === 'processing' || j.status === 'queued');
  const completedJobs = backgroundProcessing.completed;
  const totalCount = processingJobs.length + completedJobs.length;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (totalCount === 0) return null;

  const handleDismissCompleted = (jobId: string) => {
    uiDispatch({ type: 'REMOVE_PROCESSING_JOB', payload: jobId });
  };

  const handleViewResults = (jobId: string) => {
    // TODO: Open results review modal
    const job = completedJobs.find(j => j.id === jobId);
    if (job && job.result) {
      // For now, just dismiss it
      // In the future, we'll open a ResultsReview modal
      console.log('Would open results for:', job);
    }
  };

  const infoGradient = getInfoGradient('light');
  const successGradient = getSuccessGradient('light');
  const dangerGradient = getDangerGradient('light');

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Indicator Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 shadow-xl border-2 border-white/50 backdrop-blur-2xl ring-1 ring-black/5 hover:scale-105 ${
          processingJobs.length > 0
            ? `${infoGradient.container} ${infoGradient.textPrimary}`
            : completedJobs.length > 0
            ? `${successGradient.container} ${successGradient.textPrimary}`
            : `${GLASS_STYLES.control} text-gray-700 hover:bg-white/80`
        }`}
        title="Background processing"
        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        {processingJobs.length > 0 ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{processingJobs.length}</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            <span>{completedJobs.length}</span>
          </>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={`absolute top-full right-0 mt-2 w-96 ${GLASS_STYLES.dropdown} rounded-2xl shadow-2xl border-2 border-white/50 ${Z_INDEX.dropdown} overflow-hidden`}>
          {/* Processing Section */}
          {processingJobs.length > 0 && (
            <div className="border-b border-gray-200">
              <div className={`px-4 py-3 ${infoGradient.container} border-b`}>
                <div className="flex items-center gap-2">
                  <Loader2 className={`w-4 h-4 ${infoGradient.iconColor} animate-spin`} />
                  <h3 className={`font-semibold ${infoGradient.textPrimary}`}>Processing ({processingJobs.length})</h3>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {processingJobs.map((job) => (
                  <div key={job.id} className="p-4 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-start gap-3">
                      <Loader2 className={`w-5 h-5 ${infoGradient.iconColor} animate-spin flex-shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {job.input.substring(0, 60)}
                          {job.input.length > 60 ? '...' : ''}
                        </p>
                        {job.currentStep && (
                          <p className="text-xs text-gray-600 mt-1">{job.currentStep}</p>
                        )}
                        {/* Progress bar */}
                        <div className="mt-2">
                          <div className={`h-1.5 ${infoGradient.iconBg} rounded-full overflow-hidden`}>
                            <div
                              className={`h-full ${infoGradient.iconColor.replace('text-', 'bg-')} rounded-full transition-all duration-300 animate-pulse`}
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{job.progress}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Section */}
          {completedJobs.length > 0 && (
            <div>
              <div className={`px-4 py-3 ${successGradient.container} border-b`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${successGradient.iconColor}`} />
                  <h3 className={`font-semibold ${successGradient.textPrimary}`}>Ready for Review ({completedJobs.length})</h3>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {completedJobs.map((job) => {
                  const taskCount = job.result?.tasks.length || 0;
                  const noteCount = job.result?.notes.length || 0;

                  return (
                    <div key={job.id} className="p-4 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className={`w-5 h-5 ${successGradient.iconColor} flex-shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {job.input.substring(0, 60)}
                            {job.input.length > 60 ? '...' : ''}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {noteCount} notes, {taskCount} tasks detected
                          </p>
                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={() => handleViewResults(job.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all text-xs font-semibold shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                            >
                              <Eye className="w-3 h-3" />
                              Review & Save
                            </button>
                            <button
                              onClick={() => handleDismissCompleted(job.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-white/60 text-gray-700 border border-white/60 rounded-lg hover:bg-white/80 transition-all text-xs font-medium hover:scale-105 active:scale-95"
                            >
                              <Trash2 className="w-3 h-3" />
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error Section (if any) */}
          {backgroundProcessing.queue.some(j => j.status === 'error') && (
            <div className="border-t border-gray-200">
              <div className={`px-4 py-3 ${dangerGradient.container}`}>
                <div className="flex items-center gap-2">
                  <XCircle className={`w-4 h-4 ${dangerGradient.iconColor}`} />
                  <h3 className={`font-semibold ${dangerGradient.textPrimary}`}>Errors</h3>
                </div>
              </div>
              {backgroundProcessing.queue.filter(j => j.status === 'error').map((job) => (
                <div key={job.id} className="p-4 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-start gap-3">
                    <XCircle className={`w-5 h-5 ${dangerGradient.iconColor} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {job.input.substring(0, 60)}
                      </p>
                      <p className={`text-xs ${dangerGradient.textSecondary} mt-1`}>{job.error}</p>
                      <button
                        onClick={() => handleDismissCompleted(job.id)}
                        className="text-xs text-gray-600 hover:text-gray-900 mt-2"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
