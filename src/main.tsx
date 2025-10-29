/**
 * @file main.tsx - Vite entry point for Taskerino
 *
 * @overview
 * This is the Vite application entry point that renders the root React component.
 * Sets up the React 19 application with StrictMode, theme provider, animation provider,
 * and top-level error boundary.
 *
 * @react_19
 * Uses React 19's createRoot API from react-dom/client for improved concurrent rendering
 * and automatic batching of state updates.
 *
 * @strict_mode
 * StrictMode is enabled to help identify potential problems:
 * - Detects unexpected side effects in component lifecycles
 * - Warns about deprecated APIs
 * - Double-invokes effects in development (helps catch bugs early)
 *
 * @providers
 * The provider hierarchy at this level:
 * 1. **AnimationProvider** - Framer Motion animation configuration and global settings
 * 2. **ThemeProvider** - Dark/light theme management and CSS variables
 * 3. **ErrorBoundary** - Top-level error catching for the entire app
 * 4. **App** - Main application component (see App.tsx for additional providers)
 *
 * @performance
 * - Performance measurement tracks time to first render
 * - Logs render time to console for monitoring startup performance
 * - Target: <100ms for first render
 *
 * @environment
 * - Development: Vite dev server with hot module replacement (HMR)
 * - Production: Optimized bundle with tree-shaking and code splitting
 *
 * @see {@link ./App.tsx} - Main application component with full provider hierarchy
 * @see {@link ./context/ThemeContext.tsx} - Theme management
 * @see {@link ./components/ErrorBoundary.tsx} - Error boundary implementation
 * @see {@link ../index.css} - Global styles and Tailwind CSS imports
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AnimationProvider } from '@/lib/animations'

// Performance measurement: Track time to first render
const startTime = performance.now();

// Render app immediately - don't block on video repair
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnimationProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ThemeProvider>
    </AnimationProvider>
  </StrictMode>,
)

// Log time to first render
const renderTime = performance.now() - startTime;
console.log(`⚡ Time to first render: ${renderTime.toFixed(1)}ms`);

// REMOVED: Legacy video repair utility (no longer needed - corruption bug fixed)
// Previously ran fixCorruptedVideoAttachments() to repair video attachment paths
// that were incorrectly set to attachment IDs instead of file paths
