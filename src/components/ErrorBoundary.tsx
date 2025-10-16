/**
 * Error Boundary Component
 *
 * Catches React errors and prevents the entire app from crashing.
 * Shows a fallback UI when errors occur.
 */

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="max-w-md w-full mx-4 p-6 bg-white rounded-lg shadow-lg border border-red-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-red-600 text-2xl">⚠️</div>
              <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
            </div>

            <p className="text-gray-600 text-sm mb-4">
              An error occurred while rendering this component. The app is still running.
            </p>

            {this.state.error && (
              <details className="mb-4">
                <summary className="text-sm text-gray-700 cursor-pointer hover:text-gray-900 mb-2">
                  Error details
                </summary>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40 text-gray-800">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
