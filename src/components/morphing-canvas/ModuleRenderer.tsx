/**
 * Module Renderer
 *
 * Renders individual modules with chrome, animations, and error boundaries
 */

import { Component } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getModule } from './registry';
import type {
  ModuleConfig,
  ModuleAction,
  SessionData,
  ModuleState,
  ModuleErrorFallbackProps,
} from './types';
import {
  fadeInVariants,
  useReducedMotion,
  getLayoutTransition,
} from './animations/transitions';
import { cn } from '../../lib/utils';
import { getRadiusClass } from '../../design-system/theme';

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (props: ModuleErrorFallbackProps) => ReactNode;
  moduleConfig: ModuleConfig;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ModuleErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Module error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback({
        error: this.state.error,
        resetError: this.resetError,
        moduleConfig: this.props.moduleConfig,
      });
    }

    return this.props.children;
  }
}

// ============================================================================
// MODULE CHROME
// ============================================================================

interface ModuleChromeProps {
  config: ModuleConfig;
  state: ModuleState;
  children: ReactNode;
}

function ModuleChrome({ config, state, children }: ModuleChromeProps) {
  const chrome = config.chrome;

  if (!chrome?.showHeader) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {chrome.icon && (
            <span className="text-gray-600 dark:text-gray-400">
              {chrome.icon}
            </span>
          )}
          {chrome.title && (
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {chrome.title}
            </h3>
          )}
        </div>

        {chrome.actions && chrome.actions.length > 0 && (
          <div className="flex items-center gap-1">
            {chrome.actions.map((action) => (
              <button
                key={action.id}
                onClick={action.onClick}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-element transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                title={action.label}
              >
                {action.icon}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function ModuleLoadingState() {
  return (
    <div className="flex items-center justify-center h-full">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400"
      >
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-sm">Loading module...</span>
      </motion.div>
    </div>
  );
}

// ============================================================================
// ERROR STATE
// ============================================================================

function ModuleErrorState({
  error,
  resetError,
  moduleConfig,
}: ModuleErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Module Error
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {error.message || 'An unexpected error occurred'}
        </p>
        <div className={`text-xs text-gray-500 dark:text-gray-500 mb-4 font-mono bg-gray-100 dark:bg-gray-800 p-3 ${getRadiusClass('element')} overflow-x-auto`}>
          Module: {moduleConfig.type} ({moduleConfig.id})
        </div>
        <button
          onClick={resetError}
          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-field hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </motion.div>
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function ModuleEmptyState({ config }: { config: ModuleConfig }) {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center text-gray-500 dark:text-gray-400"
      >
        <p className="text-sm">No data available</p>
      </motion.div>
    </div>
  );
}

// ============================================================================
// MODULE NOT FOUND STATE
// ============================================================================

function ModuleNotFoundState({ config }: { config: ModuleConfig }) {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Module Not Found
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          The module type "{config.type}" is not registered in the system.
        </p>
        <div className={`text-xs text-gray-500 dark:text-gray-500 font-mono bg-gray-100 dark:bg-gray-800 p-3 ${getRadiusClass('element')}`}>
          Module ID: {config.id}
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// MAIN MODULE RENDERER
// ============================================================================

export interface ModuleRendererProps {
  config: ModuleConfig;
  sessionData?: SessionData;
  onAction?: (action: ModuleAction) => void;
  data?: unknown;
  className?: string;
  state?: ModuleState;
}

export function ModuleRenderer({
  config,
  sessionData,
  onAction,
  data,
  className,
  state = 'ready',
}: ModuleRendererProps) {
  const reducedMotion = useReducedMotion();

  // Check if module is enabled
  if (config.enabled === false) {
    return null;
  }

  // Get module definition from registry
  const moduleDefinition = getModule(config.type);

  if (!moduleDefinition) {
    return (
      <motion.div
        layout
        transition={getLayoutTransition(reducedMotion)}
        className={cn(
          'bg-white dark:bg-gray-900 rounded-card shadow-lg overflow-hidden',
          'border border-gray-200 dark:border-gray-700',
          className
        )}
        style={config.style}
      >
        <ModuleNotFoundState config={config} />
      </motion.div>
    );
  }

  const ModuleComponent = moduleDefinition.component;

  // Determine animation variants
  const animationVariants =
    config.animation?.entrance ||
    moduleDefinition.defaultConfig?.animation?.entrance ||
    fadeInVariants;

  return (
    <ModuleErrorBoundary
      moduleConfig={config}
      fallback={(props) => (
        <motion.div
          layout
          transition={getLayoutTransition(reducedMotion)}
          className={cn(
            'bg-white dark:bg-gray-900 rounded-card shadow-lg overflow-hidden',
            'border border-gray-200 dark:border-gray-700',
            className
          )}
          style={config.style}
        >
          <ModuleErrorState {...props} />
        </motion.div>
      )}
    >
      <motion.div
        layout={config.animation?.layout !== false}
        variants={reducedMotion ? fadeInVariants : animationVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={getLayoutTransition(reducedMotion)}
        className={cn(
          'bg-white dark:bg-gray-900 rounded-card shadow-lg overflow-hidden',
          'border border-gray-200 dark:border-gray-700',
          'h-full',
          className
        )}
        style={config.style}
      >
        <ModuleChrome config={config} state={state}>
          {(state === 'loading' || state === 'idle') ? (
            <ModuleLoadingState />
          ) : state === 'empty' ? (
            <ModuleEmptyState config={config} />
          ) : state === 'error' ? (
            <div className="flex items-center justify-center h-full p-6">
              <p className="text-sm text-gray-500">Module encountered an error</p>
            </div>
          ) : (
            <ModuleComponent
              config={config}
              sessionData={sessionData}
              onAction={onAction}
              state={state}
              data={data}
            />
          )}
        </ModuleChrome>
      </motion.div>
    </ModuleErrorBoundary>
  );
}

ModuleRenderer.displayName = 'ModuleRenderer';
