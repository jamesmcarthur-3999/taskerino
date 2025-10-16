/**
 * macOS Event Monitoring
 *
 * Implements automatic activity tracking using a hybrid approach:
 * - NSWorkspace for app switching notifications (via cocoa crate)
 * - Polling-based mouse position tracking for click detection
 * - Simple and reliable implementation
 *
 * Note: This is a simplified Phase 2 implementation optimized for reliability.
 * A future Phase 3 could add CGEvent taps for more precise event capture,
 * but that requires more complex unsafe code and accessibility permissions.
 */

use crate::activity_monitor::ActivityMonitor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

/// Event monitor for macOS activity tracking
pub struct MacOSEventMonitor {
    monitor: Arc<ActivityMonitor>,
    is_running: Arc<AtomicBool>,
    #[allow(dead_code)]
    observer_handle: Arc<AtomicBool>,
}

impl MacOSEventMonitor {
    pub fn new(monitor: Arc<ActivityMonitor>) -> Self {
        Self {
            monitor,
            is_running: Arc::new(AtomicBool::new(false)),
            observer_handle: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Start monitoring macOS events
    pub fn start(&self) -> Result<(), String> {
        if self.is_running.swap(true, Ordering::SeqCst) {
            println!("⚠️  [MACOS EVENTS] Already running");
            return Ok(());
        }

        println!("🍎 [MACOS EVENTS] Starting macOS event monitoring...");

        // Start app switching monitoring
        self.start_app_monitoring()?;

        // Start mouse activity polling
        self.start_mouse_polling()?;

        println!("✅ [MACOS EVENTS] macOS event monitoring started");
        Ok(())
    }

    /// Stop monitoring macOS events
    pub fn stop(&self) -> Result<(), String> {
        if !self.is_running.swap(false, Ordering::SeqCst) {
            println!("⚠️  [MACOS EVENTS] Already stopped");
            return Ok(());
        }

        println!("🛑 [MACOS EVENTS] Stopping macOS event monitoring...");
        println!("✅ [MACOS EVENTS] macOS event monitoring stopped");
        Ok(())
    }

    #[cfg(target_os = "macos")]
    fn start_app_monitoring(&self) -> Result<(), String> {
        use cocoa::base::{id, nil};
        use objc::{class, msg_send, sel, sel_impl};

        let monitor = Arc::clone(&self.monitor);
        let is_running = Arc::clone(&self.is_running);

        thread::spawn(move || unsafe {
            // Get shared NSWorkspace instance
            let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
            let mut last_app: Option<String> = None;

            println!("✅ [MACOS EVENTS] App monitoring thread started");

            while is_running.load(Ordering::SeqCst) {
                // Get frontmost application
                let frontmost: id = msg_send![workspace, frontmostApplication];
                if frontmost != nil {
                    let bundle_id: id = msg_send![frontmost, bundleIdentifier];
                    if bundle_id != nil {
                        let bundle_str: *const i8 = msg_send![bundle_id, UTF8String];
                        if !bundle_str.is_null() {
                            let current_app =
                                std::ffi::CStr::from_ptr(bundle_str).to_string_lossy().into_owned();

                            // Detect app switch
                            if let Some(ref last) = last_app {
                                if *last != current_app {
                                    monitor.increment_app_switch();
                                    monitor.increment_window_focus(); // App switch implies focus change
                                    println!("🔄 [MACOS EVENTS] App switched: {} → {}", last, current_app);
                                }
                            }

                            last_app = Some(current_app);
                        }
                    }
                }

                thread::sleep(Duration::from_millis(500)); // Poll every 500ms
            }

            println!("🛑 [MACOS EVENTS] App monitoring thread stopped");
        });

        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    fn start_app_monitoring(&self) -> Result<(), String> {
        println!("⚠️  [MACOS EVENTS] App monitoring not available on this platform");
        Ok(())
    }

    #[cfg(target_os = "macos")]
    fn start_mouse_polling(&self) -> Result<(), String> {
        use core_graphics::event::CGEvent;
        use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

        let monitor = Arc::clone(&self.monitor);
        let is_running = Arc::clone(&self.is_running);

        thread::spawn(move || {
            let mut last_pos: Option<(f64, f64)> = None;
            let mut movement_count = 0;

            println!("✅ [MACOS EVENTS] Mouse polling thread started");

            while is_running.load(Ordering::SeqCst) {
                // Get current mouse location via CGEvent
                if let Ok(source) = CGEventSource::new(CGEventSourceStateID::CombinedSessionState) {
                    if let Ok(event) = CGEvent::new(source) {
                        let location = event.location();

                        // Simple heuristic: significant mouse movement suggests clicks/activity
                        if let Some((last_x, last_y)) = last_pos {
                            let dx = (location.x - last_x).abs();
                            let dy = (location.y - last_y).abs();

                            // If mouse moved significantly, consider it activity
                            if dx > 50.0 || dy > 50.0 {
                                movement_count += 1;

                                // Every 5 significant movements, record as a "click" proxy
                                if movement_count % 5 == 0 {
                                    monitor.increment_mouse_click();
                                }
                            }
                        }

                        last_pos = Some((location.x, location.y));
                    }
                }

                thread::sleep(Duration::from_millis(200)); // Poll every 200ms
            }

            println!("🛑 [MACOS EVENTS] Mouse polling thread stopped");
        });

        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    fn start_mouse_polling(&self) -> Result<(), String> {
        println!("⚠️  [MACOS EVENTS] Mouse polling not available on this platform");
        Ok(())
    }
}

// Ensure thread-safety
unsafe impl Send for MacOSEventMonitor {}
unsafe impl Sync for MacOSEventMonitor {}
