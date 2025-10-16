/**
 * Debug utility for activity monitoring
 * Call from browser console:
 * - await window.debugActivity() - Check current state
 * - await window.simulateActivity() - Test event recording
 */

import { invoke } from '@tauri-apps/api/core';
import { adaptiveScreenshotScheduler } from '../services/adaptiveScreenshotScheduler';

export async function debugActivityMonitor() {
  console.log('🔍 === Activity Monitor Debug ===');

  // Check scheduler state
  const schedulerState = adaptiveScreenshotScheduler.getState();
  console.log('📊 Scheduler State:', {
    isActive: schedulerState.isActive,
    sessionId: schedulerState.sessionId,
    captureCount: schedulerState.captureCount,
    lastActivityScore: schedulerState.lastActivityScore,
    lastCuriosityScore: schedulerState.lastCuriosityScore,
    lastUrgency: schedulerState.lastUrgency,
    nextCaptureTime: schedulerState.nextCaptureTime ? new Date(schedulerState.nextCaptureTime).toLocaleTimeString() : null,
  });

  // Get activity metrics from Rust
  try {
    const metrics = await invoke('get_activity_metrics', { windowSeconds: 60 });
    console.log('📈 Activity Metrics (last 60s):', metrics);
  } catch (error) {
    console.error('❌ Failed to get activity metrics:', error);
  }

  console.log('✅ Debug complete');
}

export async function simulateActivity() {
  console.log('🧪 === Simulating Activity Events ===');

  try {
    // Simulate 5 app switches
    for (let i = 0; i < 5; i++) {
      await invoke('record_app_switch');
      console.log('✓ Recorded app switch', i + 1);
    }

    // Simulate 10 mouse clicks
    for (let i = 0; i < 10; i++) {
      await invoke('record_mouse_click');
      console.log('✓ Recorded mouse click', i + 1);
    }

    // Simulate 3 window focus changes
    for (let i = 0; i < 3; i++) {
      await invoke('record_window_focus');
      console.log('✓ Recorded window focus', i + 1);
    }

    console.log('✅ Simulated activity recorded!');
    console.log('📊 Checking metrics in 1 second...');

    setTimeout(async () => {
      const metrics = await invoke('get_activity_metrics', { windowSeconds: 60 });
      console.log('📈 Updated metrics:', metrics);
    }, 1000);
  } catch (error) {
    console.error('❌ Failed to simulate activity:', error);
  }
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).debugActivity = debugActivityMonitor;
  (window as any).simulateActivity = simulateActivity;
  console.log('💡 Debug utilities loaded!');
  console.log('   • window.debugActivity() - Check current state');
  console.log('   • window.simulateActivity() - Test event recording');
}
