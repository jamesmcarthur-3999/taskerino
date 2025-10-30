/**
 * Buffer Pool for Zero-Allocation Audio Processing
 *
 * Pre-allocates buffers for audio processing to eliminate runtime allocations.
 * Uses object pooling pattern to reuse buffers across audio chunks.
 *
 * Features:
 * - Pre-allocated buffer pool
 * - Acquire/release API for buffer reuse
 * - Statistics tracking (hits/misses)
 * - Thread-safe with mutex
 * - Configurable pool size limits
 */

use std::collections::VecDeque;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

/// Pre-allocated buffer pool for zero-allocation audio processing
pub struct BufferPool {
    /// Pool of pre-allocated buffers
    pool: Arc<Mutex<VecDeque<Vec<f32>>>>,

    /// Buffer size (samples per buffer)
    buffer_size: usize,

    /// Maximum pool size (prevents unbounded growth)
    max_pool_size: usize,

    /// Statistics - total buffers allocated
    total_allocated: Arc<AtomicUsize>,

    /// Statistics - pool hits (buffer reused)
    pool_hits: Arc<AtomicUsize>,

    /// Statistics - pool misses (new allocation needed)
    pool_misses: Arc<AtomicUsize>,
}

impl BufferPool {
    /// Create new buffer pool
    ///
    /// # Arguments
    /// * `buffer_size` - Size of each buffer in samples
    /// * `initial_count` - Number of buffers to pre-allocate
    /// * `max_pool_size` - Maximum number of buffers to keep in pool
    ///
    /// # Example
    /// ```
    /// // Pool of 10 buffers, each 1024 samples, max 100 buffers
    /// let pool = BufferPool::new(1024, 10, 100);
    /// ```
    pub fn new(buffer_size: usize, initial_count: usize, max_pool_size: usize) -> Self {
        let mut pool = VecDeque::with_capacity(initial_count);

        // Pre-allocate initial buffers
        for _ in 0..initial_count {
            pool.push_back(vec![0.0f32; buffer_size]);
        }

        Self {
            pool: Arc::new(Mutex::new(pool)),
            buffer_size,
            max_pool_size,
            total_allocated: Arc::new(AtomicUsize::new(initial_count)),
            pool_hits: Arc::new(AtomicUsize::new(0)),
            pool_misses: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Acquire buffer from pool (reuse if available, allocate if needed)
    ///
    /// Returns a buffer ready for use. The buffer is cleared and resized to buffer_size.
    pub fn acquire(&self) -> Vec<f32> {
        let mut pool = match self.pool.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("⚠️ [BUFFER POOL] Pool lock poisoned, recovering...");
                poisoned.into_inner()
            }
        };

        if let Some(mut buffer) = pool.pop_front() {
            // Reuse existing buffer
            buffer.clear();
            buffer.resize(self.buffer_size, 0.0);
            self.pool_hits.fetch_add(1, Ordering::Relaxed);
            buffer
        } else {
            // Allocate new buffer (pool empty)
            self.pool_misses.fetch_add(1, Ordering::Relaxed);
            self.total_allocated.fetch_add(1, Ordering::Relaxed);
            vec![0.0f32; self.buffer_size]
        }
    }

    /// Release buffer back to pool for reuse
    ///
    /// If pool is at capacity, the buffer is dropped (not retained).
    pub fn release(&self, buffer: Vec<f32>) {
        let mut pool = match self.pool.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("⚠️ [BUFFER POOL] Pool lock poisoned, recovering...");
                poisoned.into_inner()
            }
        };

        if pool.len() < self.max_pool_size {
            pool.push_back(buffer);
        }
        // else: drop buffer (pool at capacity)
    }

    /// Get pool statistics
    pub fn stats(&self) -> PoolStats {
        let pool = match self.pool.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("⚠️ [BUFFER POOL] Pool lock poisoned, recovering...");
                poisoned.into_inner()
            }
        };
        PoolStats {
            buffer_size: self.buffer_size,
            max_pool_size: self.max_pool_size,
            current_pool_size: pool.len(),
            total_allocated: self.total_allocated.load(Ordering::Relaxed),
            pool_hits: self.pool_hits.load(Ordering::Relaxed),
            pool_misses: self.pool_misses.load(Ordering::Relaxed),
        }
    }

    /// Get hit rate (percentage of acquires that reused a buffer)
    pub fn hit_rate(&self) -> f32 {
        let hits = self.pool_hits.load(Ordering::Relaxed);
        let misses = self.pool_misses.load(Ordering::Relaxed);
        let total = hits + misses;

        if total == 0 {
            0.0
        } else {
            (hits as f32 / total as f32) * 100.0
        }
    }

    /// Clear all buffers from pool
    pub fn clear(&self) {
        let mut pool = match self.pool.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("⚠️ [BUFFER POOL] Pool lock poisoned, recovering...");
                poisoned.into_inner()
            }
        };
        pool.clear();
    }

    /// Get current pool size
    pub fn len(&self) -> usize {
        match self.pool.lock() {
            Ok(guard) => guard.len(),
            Err(poisoned) => {
                eprintln!("⚠️ [BUFFER POOL] Pool lock poisoned, recovering...");
                poisoned.into_inner().len()
            }
        }
    }

    /// Check if pool is empty
    pub fn is_empty(&self) -> bool {
        match self.pool.lock() {
            Ok(guard) => guard.is_empty(),
            Err(poisoned) => {
                eprintln!("⚠️ [BUFFER POOL] Pool lock poisoned, recovering...");
                poisoned.into_inner().is_empty()
            }
        }
    }
}

/// Pool statistics snapshot
#[derive(Debug, Clone)]
pub struct PoolStats {
    /// Size of each buffer (samples)
    pub buffer_size: usize,
    /// Maximum pool size
    pub max_pool_size: usize,
    /// Current number of buffers in pool
    pub current_pool_size: usize,
    /// Total buffers allocated over lifetime
    pub total_allocated: usize,
    /// Number of successful buffer reuses
    pub pool_hits: usize,
    /// Number of new allocations needed
    pub pool_misses: usize,
}

impl PoolStats {
    /// Calculate hit rate percentage
    pub fn hit_rate_percent(&self) -> f32 {
        let total = self.pool_hits + self.pool_misses;
        if total == 0 {
            0.0
        } else {
            (self.pool_hits as f32 / total as f32) * 100.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_pool() {
        let pool = BufferPool::new(1024, 10, 100);
        let stats = pool.stats();

        assert_eq!(stats.buffer_size, 1024);
        assert_eq!(stats.max_pool_size, 100);
        assert_eq!(stats.current_pool_size, 10);
        assert_eq!(stats.total_allocated, 10);
    }

    #[test]
    fn test_acquire_from_pool() {
        let pool = BufferPool::new(1024, 5, 100);

        // First acquire should reuse pre-allocated buffer
        let buffer = pool.acquire();
        assert_eq!(buffer.len(), 1024);

        let stats = pool.stats();
        assert_eq!(stats.pool_hits, 1);
        assert_eq!(stats.pool_misses, 0);
        assert_eq!(stats.current_pool_size, 4); // One buffer taken
    }

    #[test]
    fn test_acquire_when_empty() {
        let pool = BufferPool::new(1024, 0, 100); // Start with empty pool

        // Should allocate new buffer
        let buffer = pool.acquire();
        assert_eq!(buffer.len(), 1024);

        let stats = pool.stats();
        assert_eq!(stats.pool_hits, 0);
        assert_eq!(stats.pool_misses, 1);
        assert_eq!(stats.total_allocated, 1);
    }

    #[test]
    fn test_release_back_to_pool() {
        let pool = BufferPool::new(1024, 5, 100);

        let buffer = pool.acquire();
        assert_eq!(pool.len(), 4);

        pool.release(buffer);
        assert_eq!(pool.len(), 5); // Back to original size
    }

    #[test]
    fn test_pool_size_limit() {
        let pool = BufferPool::new(1024, 0, 3); // Max 3 buffers

        // Release 5 buffers
        for _ in 0..5 {
            let buffer = vec![0.0f32; 1024];
            pool.release(buffer);
        }

        // Pool should only keep 3 (max)
        assert_eq!(pool.len(), 3);
    }

    #[test]
    fn test_acquire_release_cycle() {
        let pool = BufferPool::new(1024, 5, 100);

        // Acquire all buffers
        let mut buffers = Vec::new();
        for _ in 0..5 {
            buffers.push(pool.acquire());
        }

        assert_eq!(pool.len(), 0);
        assert_eq!(pool.stats().pool_hits, 5);

        // Release them back
        for buffer in buffers {
            pool.release(buffer);
        }

        assert_eq!(pool.len(), 5);

        // Next acquire should hit the pool
        let _ = pool.acquire();
        assert_eq!(pool.stats().pool_hits, 6);
    }

    #[test]
    fn test_hit_rate_calculation() {
        let pool = BufferPool::new(1024, 5, 100);

        // 3 hits (from pool)
        for _ in 0..3 {
            pool.release(pool.acquire());
        }

        // Deplete pool
        let mut buffers = Vec::new();
        for _ in 0..5 {
            buffers.push(pool.acquire());
        }

        // 2 misses (pool empty)
        for _ in 0..2 {
            pool.acquire();
        }

        // Total: 8 hits (3 + 5), 2 misses = 80% hit rate
        let hit_rate = pool.hit_rate();
        assert!((hit_rate - 80.0).abs() < 1.0); // 80% hit rate (8/10)
    }

    #[test]
    fn test_clear_pool() {
        let pool = BufferPool::new(1024, 10, 100);
        assert_eq!(pool.len(), 10);

        pool.clear();
        assert_eq!(pool.len(), 0);
        assert!(pool.is_empty());
    }

    #[test]
    fn test_buffer_reuse_clears_data() {
        let pool = BufferPool::new(4, 1, 10);

        let mut buffer = pool.acquire();
        buffer[0] = 1.0;
        buffer[1] = 2.0;
        pool.release(buffer);

        // Acquire again - should be cleared
        let buffer = pool.acquire();
        assert_eq!(buffer[0], 0.0);
        assert_eq!(buffer[1], 0.0);
    }

    #[test]
    fn test_concurrent_acquire_release() {
        use std::thread;

        let pool = Arc::new(BufferPool::new(1024, 10, 100));

        let mut handles = vec![];

        for _ in 0..4 {
            let pool_clone = Arc::clone(&pool);
            let handle = thread::spawn(move || {
                for _ in 0..25 {
                    let buffer = pool_clone.acquire();
                    // Simulate some work
                    thread::yield_now();
                    pool_clone.release(buffer);
                }
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }

        let stats = pool.stats();
        // 4 threads * 25 iterations = 100 total operations
        assert_eq!(stats.pool_hits + stats.pool_misses, 100);
        // Most should be hits since we're releasing back
        assert!(stats.pool_hits > stats.pool_misses);
    }

    #[test]
    fn test_stats_snapshot() {
        let pool = BufferPool::new(2048, 5, 50);

        pool.acquire();
        pool.acquire();

        let stats = pool.stats();
        assert_eq!(stats.buffer_size, 2048);
        assert_eq!(stats.max_pool_size, 50);
        assert_eq!(stats.current_pool_size, 3);
        assert_eq!(stats.total_allocated, 5);
        assert_eq!(stats.pool_hits, 2);
        assert_eq!(stats.hit_rate_percent(), 100.0);
    }
}
