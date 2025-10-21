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
