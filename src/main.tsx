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

// Run video repair in background after app is interactive (5 second delay)
setTimeout(() => {
  import('./utils/fixVideoAttachments').then(({ fixCorruptedVideoAttachments }) => {
    console.log('🔧 [BACKGROUND] Starting video repair utility...');
    const repairStartTime = performance.now();

    fixCorruptedVideoAttachments()
      .then((result) => {
        const repairTime = performance.now() - repairStartTime;
        console.log(`✅ [BACKGROUND] Video repair complete in ${repairTime.toFixed(1)}ms:`, result);
      })
      .catch((error) => {
        console.error('❌ [BACKGROUND] Video repair failed:', error);
      });
  });
}, 5000); // Run 5 seconds after app startup
