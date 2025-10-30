/**
 * Buffer Health Monitoring System
 *
 * Tracks buffer health metrics for audio processing including:
 * - Dropped chunks (buffer overflow)
 * - Overrun events
 * - Latency statistics
 * - Throughput metrics
 * - Uptime tracking
 *
 * Thread-safe using atomic operations for lock-free performance.
 */

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Buffer health monitor with thread-safe metrics
pub struct BufferHealthMonitor {
    /// Total chunks dropped due to overflow
    dropped_chunks: Arc<AtomicU64>,

    /// Total buffer overrun events
    overruns: Arc<AtomicU64>,

    /// Total chunks processed successfully
    total_chunks: Arc<AtomicU64>,

    /// Latency samples for statistical analysis
    latency_samples: Arc<Mutex<VecDeque<Duration>>>,

    /// Maximum number of latency samples to keep
    max_latency_samples: usize,

    /// When monitoring started
    start_time: Instant,
}

impl BufferHealthMonitor {
    /// Create new health monitor
    ///
    /// # Arguments
    /// * `max_latency_samples` - Maximum number of latency samples to retain
    ///
    /// # Example
    /// ```
    /// let monitor = BufferHealthMonitor::new(100); // Keep last 100 latency samples
    /// ```
    pub fn new(max_latency_samples: usize) -> Self {
        Self {
            dropped_chunks: Arc::new(AtomicU64::new(0)),
            overruns: Arc::new(AtomicU64::new(0)),
            total_chunks: Arc::new(AtomicU64::new(0)),
            latency_samples: Arc::new(Mutex::new(VecDeque::with_capacity(max_latency_samples))),
            max_latency_samples,
            start_time: Instant::now(),
        }
    }

    /// Record a dropped chunk (buffer overflow)
    pub fn record_drop(&self) {
        self.dropped_chunks.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a buffer overrun event
    pub fn record_overrun(&self) {
        self.overruns.fetch_add(1, Ordering::Relaxed);
    }

    /// Record successful chunk processing with latency
    ///
    /// # Arguments
    /// * `latency` - Time taken to process the chunk
    pub fn record_chunk(&self, latency: Duration) {
        self.total_chunks.fetch_add(1, Ordering::Relaxed);

        let mut samples = match self.latency_samples.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("⚠️ [HEALTH] Latency samples lock poisoned, recovering...");
                poisoned.into_inner()
            }
        };
        samples.push_back(latency);

        // Keep only the most recent samples
        if samples.len() > self.max_latency_samples {
            samples.pop_front();
        }
    }

    /// Get total dropped chunks
    pub fn dropped_chunks(&self) -> u64 {
        self.dropped_chunks.load(Ordering::Relaxed)
    }

    /// Get total overrun events
    pub fn overruns(&self) -> u64 {
        self.overruns.load(Ordering::Relaxed)
    }

    /// Get total chunks processed
    pub fn total_chunks(&self) -> u64 {
        self.total_chunks.load(Ordering::Relaxed)
    }

    /// Get drop rate (percentage of chunks dropped)
    pub fn drop_rate(&self) -> f32 {
        let dropped = self.dropped_chunks.load(Ordering::Relaxed);
        let total = self.total_chunks.load(Ordering::Relaxed);

        if total == 0 {
            0.0
        } else {
            (dropped as f32 / (total + dropped) as f32) * 100.0
        }
    }

    /// Calculate average latency from samples
    pub fn avg_latency(&self) -> Duration {
        let samples = match self.latency_samples.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("⚠️ [HEALTH] Latency samples lock poisoned, recovering...");
                poisoned.into_inner()
            }
        };

        if samples.is_empty() {
            return Duration::ZERO;
        }

        let sum: Duration = samples.iter().sum();
        sum / samples.len() as u32
    }

    /// Get maximum latency from samples
    pub fn max_latency(&self) -> Duration {
        let samples = match self.latency_samples.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("⚠️ [HEALTH] Latency samples lock poisoned, recovering...");
                poisoned.into_inner()
            }
        };
        samples.iter().max().copied().unwrap_or(Duration::ZERO)
    }

    /// Get minimum latency from samples
    pub fn min_latency(&self) -> Duration {
        let samples = match self.latency_samples.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("⚠️ [HEALTH] Latency samples lock poisoned, recovering...");
                poisoned.into_inner()
            }
        };
        samples.iter().min().copied().unwrap_or(Duration::ZERO)
    }

    /// Calculate latency percentile (p50, p95, p99)
    ///
    /// # Arguments
    /// * `percentile` - Percentile to calculate (0.0-1.0)
    pub fn latency_percentile(&self, percentile: f32) -> Duration {
        let samples = match self.latency_samples.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("⚠️ [HEALTH] Latency samples lock poisoned, recovering...");
                poisoned.into_inner()
            }
        };

        if samples.is_empty() {
            return Duration::ZERO;
        }

        let mut sorted: Vec<Duration> = samples.iter().copied().collect();
        sorted.sort();

        let index = ((sorted.len() - 1) as f32 * percentile) as usize;
        sorted[index]
    }

    /// Get uptime (time since monitoring started)
    pub fn uptime(&self) -> Duration {
        self.start_time.elapsed()
    }

    /// Calculate throughput (chunks per second)
    pub fn throughput(&self) -> f64 {
        let total = self.total_chunks.load(Ordering::Relaxed);
        let uptime_secs = self.uptime().as_secs_f64();

        if uptime_secs == 0.0 {
            0.0
        } else {
            total as f64 / uptime_secs
        }
    }

    /// Get current health snapshot
    pub fn snapshot(&self) -> BufferHealthSnapshot {
        BufferHealthSnapshot {
            dropped_chunks: self.dropped_chunks(),
            overruns: self.overruns(),
            total_chunks: self.total_chunks(),
            drop_rate: self.drop_rate(),
            avg_latency: self.avg_latency(),
            max_latency: self.max_latency(),
            min_latency: self.min_latency(),
            p50_latency: self.latency_percentile(0.5),
            p95_latency: self.latency_percentile(0.95),
            p99_latency: self.latency_percentile(0.99),
            throughput: self.throughput(),
            uptime: self.uptime(),
        }
    }

    /// Reset all statistics (keeps start_time)
    pub fn reset(&self) {
        self.dropped_chunks.store(0, Ordering::Relaxed);
        self.overruns.store(0, Ordering::Relaxed);
        self.total_chunks.store(0, Ordering::Relaxed);
        match self.latency_samples.lock() {
            Ok(mut guard) => guard.clear(),
            Err(poisoned) => {
                eprintln!("⚠️ [HEALTH] Latency samples lock poisoned, recovering...");
                poisoned.into_inner().clear();
            }
        }
    }

    /// Check if health is good (low drop rate, acceptable latency)
    ///
    /// # Arguments
    /// * `max_drop_rate` - Maximum acceptable drop rate (0.0-100.0)
    /// * `max_latency` - Maximum acceptable average latency
    pub fn is_healthy(&self, max_drop_rate: f32, max_latency: Duration) -> bool {
        self.drop_rate() <= max_drop_rate && self.avg_latency() <= max_latency
    }
}

/// Health statistics snapshot
#[derive(Debug, Clone)]
pub struct BufferHealthSnapshot {
    /// Total chunks dropped
    pub dropped_chunks: u64,
    /// Total overrun events
    pub overruns: u64,
    /// Total chunks processed
    pub total_chunks: u64,
    /// Drop rate percentage (0.0-100.0)
    pub drop_rate: f32,
    /// Average latency
    pub avg_latency: Duration,
    /// Maximum latency
    pub max_latency: Duration,
    /// Minimum latency
    pub min_latency: Duration,
    /// 50th percentile latency (median)
    pub p50_latency: Duration,
    /// 95th percentile latency
    pub p95_latency: Duration,
    /// 99th percentile latency
    pub p99_latency: Duration,
    /// Throughput (chunks/sec)
    pub throughput: f64,
    /// Uptime
    pub uptime: Duration,
}

impl BufferHealthSnapshot {
    /// Check if snapshot indicates healthy operation
    pub fn is_healthy(&self, max_drop_rate: f32, max_avg_latency: Duration) -> bool {
        self.drop_rate <= max_drop_rate && self.avg_latency <= max_avg_latency
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn test_create_monitor() {
        let monitor = BufferHealthMonitor::new(100);
        assert_eq!(monitor.dropped_chunks(), 0);
        assert_eq!(monitor.overruns(), 0);
        assert_eq!(monitor.total_chunks(), 0);
    }

    #[test]
    fn test_record_drops() {
        let monitor = BufferHealthMonitor::new(100);

        monitor.record_drop();
        monitor.record_drop();
        monitor.record_drop();

        assert_eq!(monitor.dropped_chunks(), 3);
    }

    #[test]
    fn test_record_overruns() {
        let monitor = BufferHealthMonitor::new(100);

        monitor.record_overrun();
        monitor.record_overrun();

        assert_eq!(monitor.overruns(), 2);
    }

    #[test]
    fn test_record_chunks() {
        let monitor = BufferHealthMonitor::new(100);

        monitor.record_chunk(Duration::from_millis(10));
        monitor.record_chunk(Duration::from_millis(20));
        monitor.record_chunk(Duration::from_millis(30));

        assert_eq!(monitor.total_chunks(), 3);
    }

    #[test]
    fn test_drop_rate_calculation() {
        let monitor = BufferHealthMonitor::new(100);

        // 7 successful, 3 dropped = 30% drop rate
        for _ in 0..7 {
            monitor.record_chunk(Duration::from_millis(10));
        }
        for _ in 0..3 {
            monitor.record_drop();
        }

        let drop_rate = monitor.drop_rate();
        assert!((drop_rate - 30.0).abs() < 0.1);
    }

    #[test]
    fn test_avg_latency() {
        let monitor = BufferHealthMonitor::new(100);

        monitor.record_chunk(Duration::from_millis(10));
        monitor.record_chunk(Duration::from_millis(20));
        monitor.record_chunk(Duration::from_millis(30));

        let avg = monitor.avg_latency();
        assert_eq!(avg.as_millis(), 20); // (10 + 20 + 30) / 3
    }

    #[test]
    fn test_max_min_latency() {
        let monitor = BufferHealthMonitor::new(100);

        monitor.record_chunk(Duration::from_millis(15));
        monitor.record_chunk(Duration::from_millis(5));
        monitor.record_chunk(Duration::from_millis(25));

        assert_eq!(monitor.max_latency().as_millis(), 25);
        assert_eq!(monitor.min_latency().as_millis(), 5);
    }

    #[test]
    fn test_latency_percentiles() {
        let monitor = BufferHealthMonitor::new(100);

        // Add 100 samples: 1ms, 2ms, 3ms, ..., 100ms
        for i in 1..=100 {
            monitor.record_chunk(Duration::from_millis(i));
        }

        let p50 = monitor.latency_percentile(0.5);
        let p95 = monitor.latency_percentile(0.95);
        let p99 = monitor.latency_percentile(0.99);

        assert_eq!(p50.as_millis(), 50); // Median
        assert_eq!(p95.as_millis(), 95);
        assert_eq!(p99.as_millis(), 99);
    }

    #[test]
    fn test_latency_sample_limit() {
        let monitor = BufferHealthMonitor::new(5); // Only keep 5 samples

        // Add 10 samples
        for i in 1..=10 {
            monitor.record_chunk(Duration::from_millis(i));
        }

        // Should only have last 5: 6, 7, 8, 9, 10
        let avg = monitor.avg_latency();
        assert_eq!(avg.as_millis(), 8); // (6+7+8+9+10)/5
    }

    #[test]
    fn test_throughput_calculation() {
        let monitor = BufferHealthMonitor::new(100);

        // Process some chunks
        for _ in 0..100 {
            monitor.record_chunk(Duration::from_millis(1));
        }

        thread::sleep(Duration::from_millis(100)); // Wait a bit

        let throughput = monitor.throughput();
        // Should be approximately 1000 chunks/sec (100 chunks in 0.1 sec)
        assert!(throughput > 900.0 && throughput < 1100.0);
    }

    #[test]
    fn test_uptime() {
        let monitor = BufferHealthMonitor::new(100);

        thread::sleep(Duration::from_millis(50));

        let uptime = monitor.uptime();
        assert!(uptime.as_millis() >= 50);
    }

    #[test]
    fn test_snapshot() {
        let monitor = BufferHealthMonitor::new(100);

        monitor.record_chunk(Duration::from_millis(10));
        monitor.record_chunk(Duration::from_millis(20));
        monitor.record_drop();

        // Small delay to ensure uptime is measurable
        thread::sleep(Duration::from_micros(100));

        let snapshot = monitor.snapshot();

        assert_eq!(snapshot.total_chunks, 2);
        assert_eq!(snapshot.dropped_chunks, 1);
        assert_eq!(snapshot.avg_latency.as_millis(), 15);
        assert!(snapshot.uptime.as_micros() >= 100);
    }

    #[test]
    fn test_reset() {
        let monitor = BufferHealthMonitor::new(100);

        monitor.record_chunk(Duration::from_millis(10));
        monitor.record_chunk(Duration::from_millis(20));
        monitor.record_drop();
        monitor.record_overrun();

        monitor.reset();

        assert_eq!(monitor.total_chunks(), 0);
        assert_eq!(monitor.dropped_chunks(), 0);
        assert_eq!(monitor.overruns(), 0);
        assert_eq!(monitor.avg_latency(), Duration::ZERO);
    }

    #[test]
    fn test_is_healthy() {
        let monitor = BufferHealthMonitor::new(100);

        // 95 successful, 5 dropped = 5% drop rate
        for _ in 0..95 {
            monitor.record_chunk(Duration::from_millis(10));
        }
        for _ in 0..5 {
            monitor.record_drop();
        }

        // Healthy with 10% max drop rate and 50ms max latency
        assert!(monitor.is_healthy(10.0, Duration::from_millis(50)));

        // Not healthy with 2% max drop rate
        assert!(!monitor.is_healthy(2.0, Duration::from_millis(50)));

        // Not healthy with 5ms max latency
        assert!(!monitor.is_healthy(10.0, Duration::from_millis(5)));
    }

    #[test]
    fn test_concurrent_updates() {
        use std::thread;

        let monitor = Arc::new(BufferHealthMonitor::new(100));

        let mut handles = vec![];

        // Spawn multiple threads recording metrics
        for i in 0..4 {
            let monitor_clone = Arc::clone(&monitor);
            let handle = thread::spawn(move || {
                for _ in 0..25 {
                    monitor_clone.record_chunk(Duration::from_millis(i * 10));
                    if i % 2 == 0 {
                        monitor_clone.record_drop();
                    }
                }
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }

        // 4 threads * 25 iterations = 100 chunks
        assert_eq!(monitor.total_chunks(), 100);
        // 2 threads (even) * 25 = 50 drops
        assert_eq!(monitor.dropped_chunks(), 50);
    }

    #[test]
    fn test_empty_monitor_stats() {
        let monitor = BufferHealthMonitor::new(100);

        assert_eq!(monitor.avg_latency(), Duration::ZERO);
        assert_eq!(monitor.max_latency(), Duration::ZERO);
        assert_eq!(monitor.min_latency(), Duration::ZERO);
        assert_eq!(monitor.latency_percentile(0.99), Duration::ZERO);
        assert_eq!(monitor.drop_rate(), 0.0);
    }

    #[test]
    fn test_snapshot_is_healthy() {
        let monitor = BufferHealthMonitor::new(100);

        // Good health
        for _ in 0..100 {
            monitor.record_chunk(Duration::from_millis(5));
        }

        let snapshot = monitor.snapshot();
        assert!(snapshot.is_healthy(10.0, Duration::from_millis(10)));
        // With 0% drop rate and 5ms latency, should still be healthy even with 0% max drop rate
        assert!(snapshot.is_healthy(0.0, Duration::from_millis(10)));
        // But not healthy with 1ms max latency
        assert!(!snapshot.is_healthy(10.0, Duration::from_millis(1)));
    }
}
