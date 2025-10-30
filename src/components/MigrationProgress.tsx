/**
 * Migration Progress Component
 *
 * Displays real-time migration progress with detailed status information.
 * Shows current step, progress percentage, issues found, and allows cancellation.
 *
 * @module components/MigrationProgress
 * @since 2.0.0
 */

import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, Loader2, Info } from 'lucide-react';
import type {
  MigrationReport,
  MigrationIssue,
  OrphanedReference,
} from '@/services/relationshipMigration';

/**
 * Migration step information
 */
export interface MigrationStep {
  /** Step ID */
  id: string;

  /** Step name */
  name: string;

  /** Current status */
  status: 'pending' | 'in-progress' | 'completed' | 'error';

  /** Progress within this step (0-100) */
  progress: number;

  /** Optional error message */
  error?: string;
}

/**
 * Props for MigrationProgress component
 */
export interface MigrationProgressProps {
  /** Is migration currently running? */
  isRunning: boolean;

  /** Is this a dry run? */
  isDryRun: boolean;

  /** Current migration step */
  currentStep?: MigrationStep;

  /** All migration steps */
  steps: MigrationStep[];

  /** Overall progress (0-100) */
  overallProgress: number;

  /** Entities scanned so far */
  entitiesScanned?: {
    tasks: number;
    notes: number;
    sessions: number;
  };

  /** Issues found so far */
  issues: MigrationIssue[];

  /** Orphaned references found */
  orphanedReferences: OrphanedReference[];

  /** Final migration report (when complete) */
  report?: MigrationReport;

  /** Callback to cancel migration */
  onCancel?: () => void;

  /** Callback when migration completes */
  onComplete?: (report: MigrationReport) => void;
}

/**
 * Migration Progress Component
 *
 * **Usage**:
 * ```tsx
 * const [isRunning, setIsRunning] = useState(false);
 * const [steps, setSteps] = useState<MigrationStep[]>([...]);
 * const [progress, setProgress] = useState(0);
 *
 * <MigrationProgress
 *   isRunning={isRunning}
 *   isDryRun={false}
 *   steps={steps}
 *   overallProgress={progress}
 *   issues={issues}
 *   orphanedReferences={orphaned}
 *   onCancel={() => setIsRunning(false)}
 * />
 * ```
 */
export const MigrationProgress: React.FC<MigrationProgressProps> = ({
  isRunning,
  isDryRun,
  currentStep,
  steps,
  overallProgress,
  entitiesScanned,
  issues,
  orphanedReferences,
  report,
  onCancel,
  onComplete,
}) => {
  // Count issues by severity
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  // Determine overall status
  const isComplete = !isRunning && report !== undefined;
  const hasErrors = errorCount > 0;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isDryRun ? 'Migration Preview' : 'Relationship Migration'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {isDryRun
              ? 'Analyzing legacy relationships (no data will be modified)'
              : 'Migrating legacy relationship fields to unified system'}
          </p>
        </div>

        {/* Status Icon */}
        <div>
          {isRunning && (
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          )}
          {isComplete && !hasErrors && (
            <CheckCircle className="w-8 h-8 text-green-600" />
          )}
          {isComplete && hasErrors && (
            <XCircle className="w-8 h-8 text-red-600" />
          )}
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-semibold text-gray-900">{Math.round(overallProgress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isComplete && hasErrors
                ? 'bg-red-600'
                : isComplete
                ? 'bg-green-600'
                : 'bg-blue-600'
            }`}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Current Step */}
      {currentStep && isRunning && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">{currentStep.name}</p>
              <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${currentStep.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Steps Overview */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Steps</h3>
        <div className="space-y-1">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                step.status === 'in-progress'
                  ? 'bg-blue-50'
                  : step.status === 'completed'
                  ? 'bg-green-50'
                  : step.status === 'error'
                  ? 'bg-red-50'
                  : 'bg-gray-50'
              }`}
            >
              {/* Status Icon */}
              {step.status === 'in-progress' && (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
              )}
              {step.status === 'completed' && (
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              )}
              {step.status === 'error' && (
                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              {step.status === 'pending' && (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
              )}

              {/* Step Name */}
              <span
                className={`text-sm flex-1 ${
                  step.status === 'completed'
                    ? 'text-green-900 line-through'
                    : step.status === 'in-progress'
                    ? 'text-blue-900 font-medium'
                    : step.status === 'error'
                    ? 'text-red-900'
                    : 'text-gray-600'
                }`}
              >
                {step.name}
              </span>

              {/* Error Message */}
              {step.error && (
                <span className="text-xs text-red-600">{step.error}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Entities Scanned */}
      {entitiesScanned && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 uppercase tracking-wide">Tasks</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{entitiesScanned.tasks}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 uppercase tracking-wide">Notes</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{entitiesScanned.notes}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 uppercase tracking-wide">Sessions</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{entitiesScanned.sessions}</p>
          </div>
        </div>
      )}

      {/* Issues Summary */}
      {(errorCount > 0 || warningCount > 0 || infoCount > 0) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Issues Found</h3>
          <div className="space-y-2">
            {errorCount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <span className="text-sm font-medium text-red-900">
                  {errorCount} {errorCount === 1 ? 'Error' : 'Errors'}
                </span>
              </div>
            )}
            {warningCount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <span className="text-sm font-medium text-yellow-900">
                  {warningCount} {warningCount === 1 ? 'Warning' : 'Warnings'}
                </span>
              </div>
            )}
            {infoCount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <span className="text-sm font-medium text-blue-900">
                  {infoCount} {infoCount === 1 ? 'Info' : 'Informational'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orphaned References */}
      {orphanedReferences.length > 0 && (
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900">
                {orphanedReferences.length} Orphaned Reference{orphanedReferences.length > 1 ? 's' : ''} Found
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                These references point to entities that no longer exist and will not be migrated.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Final Report */}
      {report && (
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Migration Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">Entities Migrated</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{report.entitiesMigrated}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">Relationships Created</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {Object.values(report.relationshipsCreated).reduce((sum, count) => sum + count, 0)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">Duration</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{(report.duration / 1000).toFixed(1)}s</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">Status</p>
              <p
                className={`text-xl font-bold mt-1 ${
                  report.success ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {report.success ? 'Success' : 'Failed'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
        {isRunning && onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            Cancel Migration
          </button>
        )}

        {isComplete && report && onComplete && (
          <button
            onClick={() => onComplete(report)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              hasErrors
                ? 'text-red-700 bg-red-50 hover:bg-red-100'
                : 'text-green-700 bg-green-50 hover:bg-green-100'
            }`}
          >
            {hasErrors ? 'Review Issues' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  );
};
