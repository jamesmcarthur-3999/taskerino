/**
 * Activity Monitor Module
 *
 * Implements user activity tracking to determine screenshot timing:
 * - Tracks app switches, mouse clicks, keyboard events, window focus changes
 * - Rolling time window for metrics (configurable, default 60 seconds)
 * - Thread-safe state management using Arc<Mutex<T>>
 * - Event storage with timestamps for time-based filtering
 *
 * Phase 1: Stub implementation with manual event tracking
 * Phase 2 TODO: Integrate macOS NSWorkspace and CGEvent taps for automatic monitoring
 */
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Type of activity event being tracked
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EventType {
    AppSwitch,
    MouseClick,
    KeyboardEvent,
    WindowFocus,
}

/// Individual event with timestamp
#[derive(Debug, Clone)]
struct ActivityEvent {
    event_type: EventType,
    timestamp: DateTime<Utc>,
}

impl ActivityEvent {
    fn new(event_type: EventType) -> Self {
        Self {
            event_type,
            timestamp: Utc::now(),
        }
    }
}

/// Activity metrics for a given time window
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityMetrics {
    pub app_switches: u32,
    pub mouse_clicks: u32,
    pub keyboard_events: u32,
    pub window_focus_changes: u32,
    pub timestamp: String, // ISO 8601 format
}

impl ActivityMetrics {
    fn new() -> Self {
        Self {
            app_switches: 0,
            mouse_clicks: 0,
            keyboard_events: 0,
            window_focus_changes: 0,
            timestamp: Utc::now().to_rfc3339(),
        }
    }

    fn from_events(events: &[ActivityEvent]) -> Self {
        let mut metrics = Self::new();

        for event in events {
            match event.event_type {
                EventType::AppSwitch => metrics.app_switches += 1,
                EventType::MouseClick => metrics.mouse_clicks += 1,
                EventType::KeyboardEvent => metrics.keyboard_events += 1,
                EventType::WindowFocus => metrics.window_focus_changes += 1,
            }
        }

        metrics
    }
}

/// Monitoring state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MonitoringState {
    Stopped,
    Running,
}

/// Internal state for the activity monitor
struct MonitorState {
    events: Vec<ActivityEvent>,
    state: MonitoringState,
    window_seconds: u64,
    last_cleanup: Instant,
}

impl MonitorState {
    fn new(window_seconds: u64) -> Self {
        Self {
            events: Vec::new(),
            state: MonitoringState::Stopped,
            window_seconds,
            last_cleanup: Instant::now(),
        }
    }

    /// Add an event to the tracking buffer
    fn add_event(&mut self, event_type: EventType) {
        self.events.push(ActivityEvent::new(event_type));

        // Periodically cleanup old events (every 10 seconds)
        if self.last_cleanup.elapsed() > Duration::from_secs(10) {
            self.cleanup_old_events();
        }
    }

    /// Remove events older than the window duration
    fn cleanup_old_events(&mut self) {
        let cutoff = Utc::now() - chrono::Duration::seconds(self.window_seconds as i64);
        self.events.retain(|event| event.timestamp > cutoff);
        self.last_cleanup = Instant::now();
    }

    /// Get events within the specified time window
    fn get_recent_events(&mut self, window_seconds: u64) -> Vec<ActivityEvent> {
        // Cleanup first to ensure accuracy
        self.cleanup_old_events();

        let cutoff = Utc::now() - chrono::Duration::seconds(window_seconds as i64);
        self.events
            .iter()
            .filter(|event| event.timestamp > cutoff)
            .cloned()
            .collect()
    }

    /// Clear all tracked events
    fn clear(&mut self) {
        self.events.clear();
        self.last_cleanup = Instant::now();
    }
}

/// Global activity monitor with thread-safe state
pub struct ActivityMonitor {
    state: Arc<Mutex<MonitorState>>,
}

// SAFETY: ActivityMonitor uses Mutex for all internal state synchronization,
// making it safe to share across threads
unsafe impl Send for ActivityMonitor {}
unsafe impl Sync for ActivityMonitor {}

impl ActivityMonitor {
    /// Create a new activity monitor with default 60-second window
    pub fn new() -> Self {
        Self::with_window(60)
    }

    /// Create a new activity monitor with custom time window
    pub fn with_window(window_seconds: u64) -> Self {
        println!(
            "📊 [ACTIVITY MONITOR] Creating monitor with {}s window",
            window_seconds
        );
        Self {
            state: Arc::new(Mutex::new(MonitorState::new(window_seconds))),
        }
    }

    /// Start monitoring user activity
    pub fn start_monitoring(&self) -> Result<(), String> {
        let mut state = self
            .state
            .lock()
            .map_err(|e| format!("Failed to lock state: {}", e))?;

        if state.state == MonitoringState::Running {
            println!("⚠️  [ACTIVITY MONITOR] Already running");
            return Ok(());
        }

        println!("📊 [ACTIVITY MONITOR] Starting monitoring");
        state.state = MonitoringState::Running;
        state.clear();

        // TODO Phase 2: Initialize macOS event monitoring
        // - Set up NSWorkspace notifications for app switching
        // - Register CGEvent tap for mouse clicks (kCGEventLeftMouseDown, kCGEventRightMouseDown)
        // - Register CGEvent tap for keyboard events (kCGEventKeyDown)
        // - Set up accessibility notifications for window focus changes
        //
        // For now, events will be tracked manually via increment_* methods
        // which can be called from Tauri commands or other parts of the app

        println!("✅ [ACTIVITY MONITOR] Monitoring started");
        Ok(())
    }

    /// Stop monitoring user activity
    pub fn stop_monitoring(&self) -> Result<(), String> {
        let mut state = self
            .state
            .lock()
            .map_err(|e| format!("Failed to lock state: {}", e))?;

        if state.state == MonitoringState::Stopped {
            println!("⚠️  [ACTIVITY MONITOR] Already stopped");
            return Ok(());
        }

        println!("🛑 [ACTIVITY MONITOR] Stopping monitoring");
        state.state = MonitoringState::Stopped;
        state.clear();

        // TODO Phase 2: Clean up macOS event monitoring
        // - Remove NSWorkspace notification observers
        // - Disable and release CGEvent taps
        // - Remove accessibility notification observers

        println!("✅ [ACTIVITY MONITOR] Monitoring stopped");
        Ok(())
    }

    /// Get activity metrics for the last N seconds
    pub fn get_metrics(&self, window_seconds: u64) -> ActivityMetrics {
        let mut state = match self.state.lock() {
            Ok(s) => s,
            Err(_) => return ActivityMetrics::new(), // Return empty metrics on lock failure
        };
        let recent_events = state.get_recent_events(window_seconds);

        println!(
            "📊 [ACTIVITY MONITOR] Getting metrics for last {}s: {} events",
            window_seconds,
            recent_events.len()
        );

        ActivityMetrics::from_events(&recent_events)
    }

    /// Get metrics using the monitor's default window
    pub fn get_current_metrics(&self) -> ActivityMetrics {
        let window_seconds = match self.state.lock() {
            Ok(state) => state.window_seconds,
            Err(_) => return ActivityMetrics::new(), // Return empty metrics on lock failure
        };

        self.get_metrics(window_seconds)
    }

    /// Record an app switch event
    pub fn increment_app_switch(&self) {
        let mut state = match self.state.lock() {
            Ok(s) => s,
            Err(_) => return, // Silently fail on lock error
        };

        if state.state != MonitoringState::Running {
            return; // Ignore events when not monitoring
        }

        state.add_event(EventType::AppSwitch);
        println!("📊 [ACTIVITY MONITOR] App switch recorded");
    }

    /// Record a mouse click event
    pub fn increment_mouse_click(&self) {
        let mut state = match self.state.lock() {
            Ok(s) => s,
            Err(_) => return, // Silently fail on lock error
        };

        if state.state != MonitoringState::Running {
            return; // Ignore events when not monitoring
        }

        state.add_event(EventType::MouseClick);
        // Verbose logging disabled for high-frequency events
    }

    /// Record a keyboard event
    pub fn increment_keyboard_event(&self) {
        let mut state = match self.state.lock() {
            Ok(s) => s,
            Err(_) => return, // Silently fail on lock error
        };

        if state.state != MonitoringState::Running {
            return; // Ignore events when not monitoring
        }

        state.add_event(EventType::KeyboardEvent);
        // Verbose logging disabled for high-frequency events
    }

    /// Record a window focus change event
    pub fn increment_window_focus(&self) {
        let mut state = match self.state.lock() {
            Ok(s) => s,
            Err(_) => return, // Silently fail on lock error
        };

        if state.state != MonitoringState::Running {
            return; // Ignore events when not monitoring
        }

        state.add_event(EventType::WindowFocus);
        println!("📊 [ACTIVITY MONITOR] Window focus change recorded");
    }

    /// Get current monitoring state
    pub fn get_state(&self) -> MonitoringState {
        self.state
            .lock()
            .map(|s| s.state)
            .unwrap_or(MonitoringState::Stopped)
    }

    /// Check if currently monitoring
    pub fn is_monitoring(&self) -> bool {
        self.get_state() == MonitoringState::Running
    }

    /// Update the time window for metrics
    pub fn set_window(&self, window_seconds: u64) {
        if let Ok(mut state) = self.state.lock() {
            state.window_seconds = window_seconds;
            println!(
                "📊 [ACTIVITY MONITOR] Window updated to {}s",
                window_seconds
            );
        }
    }

    /// Get the current time window setting
    pub fn get_window(&self) -> u64 {
        self.state.lock().map(|s| s.window_seconds).unwrap_or(60) // Default to 60 seconds on error
    }

    /// Get total event count (for debugging/testing)
    #[allow(dead_code)]
    pub fn get_event_count(&self) -> usize {
        self.state.lock().map(|s| s.events.len()).unwrap_or(0)
    }
}

impl Default for ActivityMonitor {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// PHASE 2 IMPLEMENTATION NOTES
// ============================================================================
//
// macOS Event Monitoring Integration Plan:
//
// 1. App Switching (NSWorkspace):
//    - Use NSWorkspace.sharedWorkspace.notificationCenter
//    - Register for NSWorkspaceDidActivateApplicationNotification
//    - Extract app name from notification.userInfo
//    - Call increment_app_switch() from notification handler
//
// 2. Mouse Clicks (CGEvent Tap):
//    - Create CGEventTap with kCGEventLeftMouseDown | kCGEventRightMouseDown
//    - Request accessibility permissions if needed
//    - Call increment_mouse_click() from event callback
//    - Consider rate limiting to avoid performance impact
//
// 3. Keyboard Events (CGEvent Tap):
//    - Create CGEventTap with kCGEventKeyDown
//    - Request accessibility permissions if needed
//    - Call increment_keyboard_event() from event callback
//    - Consider rate limiting for performance
//
// 4. Window Focus (Accessibility API):
//    - Use AXObserver to monitor focused window changes
//    - Register for kAXFocusedWindowChangedNotification
//    - Call increment_window_focus() from notification handler
//
// 5. Permissions:
//    - Add LSApplicationQueriesSchemes to Info.plist
//    - Request accessibility permissions via AXIsProcessTrusted()
//    - Provide clear error messages if permissions denied
//
// 6. Performance Considerations:
//    - Implement rate limiting for high-frequency events (mouse, keyboard)
//    - Consider batching events before adding to Vec
//    - Use atomic counters for simple counts instead of full event storage
//    - Profile memory usage with long-running sessions
//
// 7. Testing Strategy:
//    - Unit tests for metric calculation and time windowing
//    - Integration tests for event recording
//    - Manual testing with real macOS events
//    - Performance testing with high event rates
//
// ============================================================================
