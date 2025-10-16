/**
 * Migration Dialog Component
 *
 * Displays migration progress when upgrading from localStorage
 * to new storage system (file system or IndexedDB)
 */

import React, { useEffect, useState } from 'react';
import { migrateFromLocalStorage, rollbackMigration } from '../services/storage/migration';
import { getStorageType } from '../services/storage';
import { useTheme } from '../context/ThemeContext';
import { getModalClasses } from '../design-system/theme';

interface MigrationDialogProps {
  onComplete: () => void;
  onError: (error: Error) => void;
}

export function MigrationDialog({ onComplete, onError }: MigrationDialogProps) {
  const { colorScheme, glassStrength } = useTheme();
  const [progress, setProgress] = useState<string>('Preparing migration...');
  const [error, setError] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  useEffect(() => {
    performMigration();
  }, []);

  async function performMigration() {
    try {
      const success = await migrateFromLocalStorage((message) => {
        setProgress(message);
      });

      if (success) {
        // Wait a moment to show completion message
        setProgress('Migration completed successfully!');
        setTimeout(() => {
          onComplete();
        }, 1500);
      } else {
        // No data to migrate
        onComplete();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Migration failed:', err);
      setError(errorMessage);
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  async function handleRollback() {
    if (!confirm('This will restore your data from localStorage. Continue?')) {
      return;
    }

    setRollingBack(true);
    setError(null);

    try {
      const success = await rollbackMigration();

      if (success) {
        alert('Migration rolled back. Please refresh the app.');
        window.location.reload();
      } else {
        setError('Rollback failed: No backup available');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRollingBack(false);
    }
  }

  const storageType = getStorageType();
  const storageName = storageType === 'filesystem' ? 'file system (unlimited storage)' : 'IndexedDB (100s of MB)';
  const modalClasses = getModalClasses(colorScheme, glassStrength);

  return (
    <div className={modalClasses.overlay}>
      <div className={`${modalClasses.content} p-6 max-w-md w-full mx-4`}>
        <h2 className="text-xl font-semibold mb-4">
          {error ? '⚠️ Migration Error' : '🔄 Upgrading Storage System'}
        </h2>

        {error ? (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm font-medium mb-2">
                Migration failed
              </p>
              <p className="text-red-700 text-sm">
                {error}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm font-medium mb-2">
                Your data is safe
              </p>
              <p className="text-blue-700 text-sm">
                Your original data is still in localStorage and has not been modified.
                You can:
              </p>
              <ul className="text-blue-700 text-sm mt-2 ml-4 list-disc">
                <li>Try again (refresh the page)</li>
                <li>Continue with localStorage (not recommended - limited space)</li>
                <li>Contact support if the issue persists</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>

              <button
                onClick={handleRollback}
                disabled={rollingBack}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                {rollingBack ? 'Rolling back...' : 'Rollback'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                Taskerino is upgrading to a new storage system that provides much more space for your data.
              </p>
              <p className="text-blue-700 text-sm mt-2">
                <strong>New storage:</strong> {storageName}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Progress</span>
                <span className="text-blue-600 font-medium">{progress}</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300 animate-pulse"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-700 text-sm">
                <strong>Note:</strong> Your data is being transferred safely. A backup will be kept for 7 days.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
