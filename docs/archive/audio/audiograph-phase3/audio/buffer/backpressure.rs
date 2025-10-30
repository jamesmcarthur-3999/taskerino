/**
 * Backpressure Detection for Audio Buffers
 *
 * Monitors buffer usage and detects backpressure conditions using hysteresis
 * to prevent rapid toggling between triggered and cleared states.
 *
 * Features:
 * - Hysteresis-based state transitions
 * - Trigger/clear threshold separation
 * - Event emission for state changes
 * - Duration tracking
 * - Trigger count statistics
 */

use std::time::{Duration, Instant};

/// Backpressure detector with hysteresis
///
/// Uses two thresholds to prevent rapid state toggling:
/// - Trigger threshold: When usage crosses this, backpressure triggers
/// - Clear threshold: When usage drops below this, backpressure clears
///
/// Hysteresis gap prevents rapid on/off transitions from noisy usage levels.
pub struct BackpressureDetector {
    /// Threshold for triggering backpressure (0.0-1.0)
    trigger_threshold: f32,

    /// Threshold for clearing backpressure (0.0-1.0)
    /// Should be lower than trigger_threshold for hysteresis
    clear_threshold: f32,

    /// Current state (triggered or not)
    is_triggered: bool,

    /// Time when backpressure was last triggered
    last_trigger: Option<Instant>,

    /// Total number of times backpressure has been triggered
    trigger_count: u64,

    /// Total duration spent in backpressure state
    total_backpressure_duration: Duration,
}

impl BackpressureDetector {
    /// Create new backpressure detector
    ///
    /// # Arguments
    /// * `trigger_threshold` - Usage level (0.0-1.0) to trigger backpressure
    /// * `clear_threshold` - Usage level (0.0-1.0) to clear backpressure
    ///
    /// # Example
    /// ```
    /// // Trigger at 90%, clear at 70%
    /// let detector = BackpressureDetector::new(0.9, 0.7);
    /// ```
    pub fn new(trigger_threshold: f32, clear_threshold: f32) -> Self {
        assert!(
            trigger_threshold >= clear_threshold,
            "Trigger threshold must be >= clear threshold for hysteresis"
        );
        assert!(
            trigger_threshold <= 1.0 && trigger_threshold >= 0.0,
            "Trigger threshold must be in range [0.0, 1.0]"
        );
        assert!(
            clear_threshold <= 1.0 && clear_threshold >= 0.0,
            "Clear threshold must be in range [0.0, 1.0]"
        );

        Self {
            trigger_threshold,
            clear_threshold,
            is_triggered: false,
            last_trigger: None,
            trigger_count: 0,
            total_backpressure_duration: Duration::ZERO,
        }
    }

    /// Update detector with current buffer usage
    ///
    /// Returns Some(event) if state changed, None otherwise
    ///
    /// # Arguments
    /// * `usage` - Current buffer usage (0.0-1.0)
    pub fn update(&mut self, usage: f32) -> Option<BackpressureEvent> {
        if !self.is_triggered && usage >= self.trigger_threshold {
            // Trigger backpressure
            self.is_triggered = true;
            self.last_trigger = Some(Instant::now());
            self.trigger_count += 1;

            return Some(BackpressureEvent::Triggered {
                usage,
                trigger_count: self.trigger_count,
                timestamp: Instant::now(),
            });
        } else if self.is_triggered && usage <= self.clear_threshold {
            // Clear backpressure
            self.is_triggered = false;

            let duration = self
                .last_trigger
                .map(|t| t.elapsed())
                .unwrap_or(Duration::ZERO);

            self.total_backpressure_duration += duration;

            return Some(BackpressureEvent::Cleared {
                usage,
                duration,
                timestamp: Instant::now(),
            });
        }

        None
    }

    /// Check if currently in backpressure state
    pub fn is_triggered(&self) -> bool {
        self.is_triggered
    }

    /// Get total number of backpressure triggers
    pub fn trigger_count(&self) -> u64 {
        self.trigger_count
    }

    /// Get total time spent in backpressure state
    pub fn total_backpressure_duration(&self) -> Duration {
        let mut total = self.total_backpressure_duration;

        // Add current backpressure duration if triggered
        if let Some(last_trigger) = self.last_trigger {
            if self.is_triggered {
                total += last_trigger.elapsed();
            }
        }

        total
    }

    /// Get current backpressure duration (if triggered)
    pub fn current_backpressure_duration(&self) -> Option<Duration> {
        if self.is_triggered {
            self.last_trigger.map(|t| t.elapsed())
        } else {
            None
        }
    }

    /// Get statistics snapshot
    pub fn stats(&self) -> BackpressureStats {
        BackpressureStats {
            is_triggered: self.is_triggered,
            trigger_count: self.trigger_count,
            total_duration: self.total_backpressure_duration(),
            current_duration: self.current_backpressure_duration(),
            trigger_threshold: self.trigger_threshold,
            clear_threshold: self.clear_threshold,
        }
    }

    /// Reset all statistics (but keep thresholds)
    pub fn reset(&mut self) {
        self.is_triggered = false;
        self.last_trigger = None;
        self.trigger_count = 0;
        self.total_backpressure_duration = Duration::ZERO;
    }
}

/// Backpressure event emitted on state changes
#[derive(Debug, Clone)]
pub enum BackpressureEvent {
    /// Backpressure triggered (buffer usage exceeded threshold)
    Triggered {
        /// Buffer usage when triggered (0.0-1.0)
        usage: f32,
        /// Total trigger count
        trigger_count: u64,
        /// When event occurred
        timestamp: Instant,
    },
    /// Backpressure cleared (buffer usage dropped below threshold)
    Cleared {
        /// Buffer usage when cleared (0.0-1.0)
        usage: f32,
        /// How long backpressure was active
        duration: Duration,
        /// When event occurred
        timestamp: Instant,
    },
}

/// Backpressure statistics snapshot
#[derive(Debug, Clone)]
pub struct BackpressureStats {
    /// Currently triggered
    pub is_triggered: bool,
    /// Total number of triggers
    pub trigger_count: u64,
    /// Total time in backpressure state
    pub total_duration: Duration,
    /// Current backpressure duration (if triggered)
    pub current_duration: Option<Duration>,
    /// Trigger threshold
    pub trigger_threshold: f32,
    /// Clear threshold
    pub clear_threshold: f32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn test_create_detector() {
        let detector = BackpressureDetector::new(0.9, 0.7);
        assert!(!detector.is_triggered());
        assert_eq!(detector.trigger_count(), 0);
    }

    #[test]
    #[should_panic(expected = "Trigger threshold must be >= clear threshold")]
    fn test_invalid_thresholds() {
        BackpressureDetector::new(0.7, 0.9); // Invalid: trigger < clear
    }

    #[test]
    fn test_trigger_backpressure() {
        let mut detector = BackpressureDetector::new(0.9, 0.7);

        // Below threshold - no event
        assert!(detector.update(0.5).is_none());
        assert!(!detector.is_triggered());

        // Cross threshold - should trigger
        let event = detector.update(0.95);
        assert!(event.is_some());
        assert!(detector.is_triggered());
        assert_eq!(detector.trigger_count(), 1);

        if let Some(BackpressureEvent::Triggered {
            usage,
            trigger_count,
            ..
        }) = event
        {
            assert_eq!(usage, 0.95);
            assert_eq!(trigger_count, 1);
        } else {
            panic!("Expected Triggered event");
        }
    }

    #[test]
    fn test_clear_backpressure() {
        let mut detector = BackpressureDetector::new(0.9, 0.7);

        // Trigger
        detector.update(0.95);
        assert!(detector.is_triggered());

        // Still above clear threshold - no change
        assert!(detector.update(0.8).is_none());
        assert!(detector.is_triggered());

        // Drop below clear threshold - should clear
        thread::sleep(Duration::from_millis(10)); // Let some time pass
        let event = detector.update(0.6);
        assert!(event.is_some());
        assert!(!detector.is_triggered());

        if let Some(BackpressureEvent::Cleared { usage, duration, .. }) = event {
            assert_eq!(usage, 0.6);
            assert!(duration.as_millis() >= 10);
        } else {
            panic!("Expected Cleared event");
        }
    }

    #[test]
    fn test_hysteresis_prevents_rapid_toggling() {
        let mut detector = BackpressureDetector::new(0.9, 0.7);

        // Trigger at 0.9
        assert!(detector.update(0.95).is_some());

        // Fluctuate between clear and trigger thresholds
        // Should NOT re-trigger until we go below clear threshold first
        assert!(detector.update(0.85).is_none()); // Still triggered
        assert!(detector.update(0.88).is_none()); // Still triggered
        assert!(detector.update(0.75).is_none()); // Still triggered

        // Only clears below 0.7
        assert!(detector.update(0.65).is_some()); // Cleared
    }

    #[test]
    fn test_multiple_triggers() {
        let mut detector = BackpressureDetector::new(0.9, 0.7);

        // First trigger
        detector.update(0.95);
        assert_eq!(detector.trigger_count(), 1);

        // Clear
        detector.update(0.6);
        assert_eq!(detector.trigger_count(), 1); // Count doesn't decrease

        // Second trigger
        detector.update(0.92);
        assert_eq!(detector.trigger_count(), 2);

        // Clear again
        detector.update(0.5);
        assert_eq!(detector.trigger_count(), 2);
    }

    #[test]
    fn test_duration_tracking() {
        let mut detector = BackpressureDetector::new(0.9, 0.7);

        // Trigger
        detector.update(0.95);
        thread::sleep(Duration::from_millis(50));

        // Check current duration
        let current = detector.current_backpressure_duration();
        assert!(current.is_some());
        assert!(current.unwrap().as_millis() >= 50);

        // Clear
        detector.update(0.6);
        assert!(detector.current_backpressure_duration().is_none());

        // Total duration should include the ~50ms
        let total = detector.total_backpressure_duration();
        assert!(total.as_millis() >= 50);
    }

    #[test]
    fn test_cumulative_duration() {
        let mut detector = BackpressureDetector::new(0.9, 0.7);

        // First backpressure period
        detector.update(0.95);
        thread::sleep(Duration::from_millis(30));
        detector.update(0.6);

        // Second backpressure period
        detector.update(0.92);
        thread::sleep(Duration::from_millis(30));
        detector.update(0.5);

        // Total should be ~60ms
        let total = detector.total_backpressure_duration();
        assert!(total.as_millis() >= 60);
    }

    #[test]
    fn test_stats_snapshot() {
        let mut detector = BackpressureDetector::new(0.9, 0.7);

        detector.update(0.95);
        thread::sleep(Duration::from_millis(20));

        let stats = detector.stats();
        assert!(stats.is_triggered);
        assert_eq!(stats.trigger_count, 1);
        assert!(stats.current_duration.is_some());
        assert!(stats.current_duration.unwrap().as_millis() >= 20);
        assert_eq!(stats.trigger_threshold, 0.9);
        assert_eq!(stats.clear_threshold, 0.7);
    }

    #[test]
    fn test_reset() {
        let mut detector = BackpressureDetector::new(0.9, 0.7);

        // Trigger and accumulate some state
        detector.update(0.95);
        thread::sleep(Duration::from_millis(10));
        detector.update(0.6);
        detector.update(0.92);

        assert_eq!(detector.trigger_count(), 2);
        assert!(detector.total_backpressure_duration().as_millis() > 0);

        // Reset
        detector.reset();

        assert!(!detector.is_triggered());
        assert_eq!(detector.trigger_count(), 0);
        assert_eq!(detector.total_backpressure_duration(), Duration::ZERO);
        assert!(detector.current_backpressure_duration().is_none());
    }

    #[test]
    fn test_edge_case_at_threshold() {
        let mut detector = BackpressureDetector::new(0.9, 0.7);

        // Exactly at trigger threshold should trigger
        let event = detector.update(0.9);
        assert!(event.is_some());
        assert!(detector.is_triggered());

        // Clear to below clear threshold
        detector.update(0.6);

        // Exactly at clear threshold should NOT re-trigger (still below trigger)
        let event = detector.update(0.7);
        assert!(event.is_none());
        assert!(!detector.is_triggered());
    }

    #[test]
    fn test_total_duration_while_triggered() {
        let mut detector = BackpressureDetector::new(0.9, 0.7);

        // Trigger and let it run
        detector.update(0.95);
        thread::sleep(Duration::from_millis(30));

        // Total duration should include current active period
        let total = detector.total_backpressure_duration();
        assert!(total.as_millis() >= 30);

        // Wait more
        thread::sleep(Duration::from_millis(20));
        let total2 = detector.total_backpressure_duration();
        assert!(total2.as_millis() >= 50);
        assert!(total2 > total);
    }
}
